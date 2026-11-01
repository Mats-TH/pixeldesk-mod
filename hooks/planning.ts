import type { Host } from './host'

import type { AgentRecord, PlanStep } from '../types'
import { clearDesks, known, pacePoll, publish, settle } from './agents'
import { guard, log, onDisk, planPath, readText, reason, toast } from './disk'
import { plural, t } from './i18n'
import { flat } from './lines'
import { FRESH_TURN, PLAN_TOOL } from './memory'
import type { Memory, Plan } from './memory'
import { allDone, drawnPlan, isOpen, planFile, planFromFile, readSteps, reconcile, startsOver, taskAdded, taskChanged, todoSteps } from './plan'
import { readPlan, writePlan, writeShimmer } from './state'

const SHIMMER_MS = 350
// How many calls of the main conversation a plan may sit through before the model hears about it.
const STALE_CALLS = 8
const MIRRORS: readonly string[] = ['TodoWrite', 'TaskCreate', 'TaskUpdate']

export const isMirror = (tool: string) => MIRRORS.includes(tool)

async function nowIso($: Host) {
  return new Date(await $.clock.now()).toISOString()
}

/** The shimmer only moves while a step is in progress. */
function paceShimmer($: Host, m: Memory) {
  const live = m.plan?.steps.some(st => st.status === 'in_progress') ?? false
  if (live && !m.shimmer) {
    m.shimmer = $.clock.every(SHIMMER_MS, () => {
      m.shimmerStep += 1
      void guard($, m, 'shimmer', () => writeShimmer($, m.shimmerStep))
    })
  } else if (!live && m.shimmer) {
    m.shimmer.cancel()
    m.shimmer = null
  }
}

/** To the drawings: the zoom's balance first, so that the new plan does not replay an arrival. */
async function showPlan($: Host, m: Memory) {
  if (!m.plan) return
  await settle($, m)
  await writePlan($, drawnPlan(m.plan))
  paceShimmer($, m)
  pacePoll($, m)
}

async function savePlan($: Host, m: Memory) {
  if (m.plan && onDisk(m)) await guard($, m, 'plan file', () => $.fs.write(planPath(m), planFile(m.plan!)))
}

/** A step just finished says so; the last one speaks for the whole list. */
function announce($: Host, m: Memory, steps: readonly PlanStep[], finished: readonly string[]) {
  if (!finished.length) return
  if (allDone(steps)) toast($, m, plural('toast.allDone', steps.length, { n: steps.length }))
  else toast($, m, t('toast.stepDone', { list: finished.join(', ') }))
}

/** A different job: the first of the session, work after a finished plan, or another name. The same plan updated is not. */
function isNewJob(plan: Plan | null, sent: readonly PlanStep[], title: string) {
  if (!plan) return true
  const old = plan.steps
  return (!old.length && sent.length > 0) || (allDone(old) && sent.some(st => st.status !== 'completed')) || (title !== '' && title !== plan.title)
}

/** A new list for the main conversation, whoever sent it: everything downstream of the plan goes through here. */
async function commit($: Host, m: Memory, sent: PlanStep[], title = '') {
  const old = m.plan?.steps ?? []
  const fresh = startsOver(old, sent)
  if (isNewJob(m.plan, sent, title)) await clearDesks($, m)
  const at = await nowIso($)
  const { steps, finished } = reconcile(fresh ? [] : old, sent, at)
  m.plan = { title: title || (fresh ? t('plan.defaultTitle') : m.plan!.title), steps, updatedAt: at }
  m.turn = { ...m.turn, calls: 0, staleSent: false }
  await savePlan($, m)
  await showPlan($, m)
  if (!fresh) announce($, m, steps, finished)
}

/** A list for an agent's desk: it stays there, with no file and no toast. */
async function commitDesk($: Host, m: Memory, a: AgentRecord, sent: PlanStep[]) {
  const old = a.plan ?? []
  a.plan = reconcile(startsOver(old, sent) ? [] : old, sent, await nowIso($)).steps
  await publish($, m)
}

const answer = (text: string) => ({ result: text })

/** The `plan` tool. The mod answers it alone, and the same words to the main conversation and to an agent. */
export async function answerPlan($: Host, m: Memory, input: Record<string, unknown>, agentId: string | undefined) {
  // A call counts as a plan on its way, whether it is sound or not.
  if (agentId === undefined) m.turn = { ...m.turn, planSeen: true }
  try {
    const read = readSteps(input.steps)
    if ('error' in read) return answer(read.error)
    if (agentId === undefined) await commit($, m, read.steps, typeof input.title === 'string' ? flat(input.title) : '')
    else {
      const a = await known($, m, agentId)
      if (a) await commitDesk($, m, a, read.steps)
    }
    const done = read.steps.filter(st => st.status === 'completed').length
    return answer(t('plan.saved', { done, total: read.steps.length }))
  } catch (err) {
    await log($, m, `plan tool: ${reason(err)}`)
    return answer(t('plan.err.internal'))
  }
}

/** What a mirrored tool leaves of a list; null when it changes nothing. */
function mirrored(tool: string, steps: readonly PlanStep[], input: Record<string, unknown>, result: unknown) {
  if (tool === 'TodoWrite') return todoSteps(input.todos)
  if (tool === 'TaskCreate') return taskAdded(steps, input.subject, (result as { task?: { id?: unknown } } | undefined)?.task?.id)
  return taskChanged(steps, input)
}

/** A list tool that ran: its result feeds the plan of whoever called it. */
export async function applyMirror($: Host, m: Memory, tool: string, input: Record<string, unknown>, result: unknown, agentId: string | undefined) {
  if (agentId === undefined) {
    const next = mirrored(tool, m.plan?.steps ?? [], input, result)
    if (next) await commit($, m, next)
    return
  }
  const a = await known($, m, agentId)
  const next = a && mirrored(tool, a.plan ?? [], input, result)
  if (a && next) await commitDesk($, m, a, next)
}

/** A prompt starts the count over. */
export const newTurn = (m: Memory) => {
  m.turn = FRESH_TURN
}

/** The note for this call of the main conversation, if the plan calls for one. Each comes once. */
export function noteFor(m: Memory) {
  const notes: string[] = []
  const live = isOpen(m.plan)
  if (!m.turn.planSeen && !m.turn.noted) {
    m.turn = { ...m.turn, noted: true }
    notes.push(t(live ? 'nudge.continue' : 'nudge.new', { tool: PLAN_TOOL }))
  }
  if (live && !m.turn.staleSent && m.turn.calls >= STALE_CALLS) {
    m.turn = { ...m.turn, staleSent: true }
    notes.push(t('nudge.stale', { tool: PLAN_TOOL }))
  }
  return notes
}

/** Takes the plan back at the start of a session: from its file, else from what the host still holds. */
export async function restorePlan($: Host, m: Memory) {
  if (m.plan) return
  const text = onDisk(m) ? await readText($, planPath(m)) : undefined
  if (text !== undefined) {
    try {
      m.plan = planFromFile(JSON.parse(text))
      if (!m.plan) await log($, m, 'plan file: not a plan')
    } catch (err) {
      await log($, m, `plan file: ${reason(err)}`)
    }
  }
  if (!m.plan) {
    const held = await readPlan($)
    if (held) m.plan = { title: held.title, steps: held.steps, updatedAt: '' }
  }
  await showPlan($, m)
}
