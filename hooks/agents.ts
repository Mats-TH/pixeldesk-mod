import type { Host } from './host'

import type { AgentRecord, AgentPhase } from '../types'
import { leaveAhead, leavers, LEAVE_MS, roleOf } from './desks'
import { guard, log, reason } from './disk'
import { plural, t } from './i18n'
import { PANE } from './memory'
import type { Memory } from './memory'
import { allDone } from './plan'
import { TENUES, agentHue } from './pixel/sprites'
import { dueForSummary, summarize } from './plain'
import { progressOf, zoomAgain } from './room'
import type { RoomDesk } from './room'
import { readAgents, readSeen, readSummaries, writeAgents, writeSeen, writeSummaries } from './state'
import { actionPhrase } from './words'

const MAX_DESKS = 16
const MAX_ACTIONS = 200
const POLL_MS = 2000
// The outfits an agent can wear: Corail, the first, is the manager's.
const AGENT_HUES = TENUES.length - 1

type Newcomer = { description?: string; type?: string }

/** A record from an older version: what it did not save is filled in, so it draws all the same. */
export function healed(old: Partial<AgentRecord> & { id: string }, i: number): AgentRecord {
  const seat = old.seat ?? i
  return {
    ...old,
    description: old.description ?? '',
    type: old.type ?? '',
    phase: old.phase ?? 'working',
    startedAt: old.startedAt ?? 0,
    endedAt: old.endedAt ?? 0,
    count: old.count ?? 0,
    steps: old.steps ?? [],
    tokens: old.tokens ?? 0,
    liveTokens: old.liveTokens ?? 0,
    seat,
    hue: agentHue(old.hue ?? seat),
  }
}

/** The agents with a desk: past 16, the finished ones leave and the latest others stay. */
export const seated = (list: readonly AgentRecord[]) => (list.length > MAX_DESKS ? list.filter(a => a.phase !== 'done').slice(-MAX_DESKS) : [...list])

/** An agent's desk, as the room draws it and the desk file publishes it. */
export function desk(a: AgentRecord): RoomDesk {
  const { done, total, live } = progressOf(a.plan ?? [])
  return { title: roleOf(a.type, a.description), state: a.phase, hue: a.hue, done, total, live }
}

export const lastAction = (a: AgentRecord) => a.steps[a.steps.length - 1]?.live ?? ''

/** The sentence of a card. */
export const sayOf = (a: AgentRecord, summaries: Readonly<Record<string, string>>) => summaries[a.id] || lastAction(a) || t('pane.starting')

/** The time and the actions of a card. Whole minutes, at least one; the clock of a finished agent stops with it. */
export function metaOf(a: AgentRecord, now: number) {
  const end = a.phase === 'working' ? now : a.endedAt || now
  const m = Math.max(1, Math.floor((end - (a.startedAt || end)) / 60_000))
  return plural('pane.meta', a.count, { m, n: a.count })
}

/** The numbers that are not zero, or a word for an empty room. */
export function summaryOf(list: readonly AgentRecord[]) {
  const count = (phase: AgentPhase) => list.filter(a => a.phase === phase).length
  const [working, done, stopped] = [count('working'), count('done'), count('failed')]
  const parts = [
    working ? t('pane.working', { n: working }) : '',
    done ? plural('pane.done', done, { n: done }) : '',
    stopped ? plural('pane.stopped', stopped, { n: stopped }) : '',
  ]
  return parts.filter(Boolean).join(' · ') || t('pane.none')
}

export const isWorking = (a: AgentRecord) => a.phase === 'working'

/** Whether the pane is up; a failure to tell counts as closed. */
export function paneOpen(host: Host) {
  return host.ui.panes().then(list => list.some(pane => pane.id === PANE), () => false)
}

/** Opens the pane; a refusal goes to the log. */
export function openPane(host: Host, m: Memory) {
  return guard(host, m, 'open pane', () => host.ui.open({ id: PANE, title: t('brand') }))
}

/** The summaries that are due. The mark goes on before the call: two summaries of one agent never run at once. */
async function freshen(host: Host, m: Memory) {
  if (!(await paneOpen(host))) return
  const now = await host.clock.now()
  for (const a of m.agents) {
    const mark = m.marks.get(a.id) ?? { at: 0, count: 0 }
    if (!dueForSummary(a, mark, now, true)) continue
    m.marks.set(a.id, { at: now, count: a.count })
    void summarize(host, a).then(async text => {
      if (!text) return
      await writeSummaries(host, { ...(await readSummaries(host)), [a.id]: text })
    }).catch((err: unknown) => log(host, m, `summary: ${reason(err)}`))
  }
}

/** When the plan ended, as `leavers` reads it: 0 without one, null while it is open. */
function planOver(m: Memory) {
  const steps = m.plan?.steps ?? []
  if (!allDone(steps)) return steps.length ? null : 0
  return Math.max(0, ...steps.map(st => Date.parse(st.doneAt ?? '')).filter(Number.isFinite))
}

/** The 2 s pass runs while anyone works, or while a finished desk has its departure ahead; never otherwise. */
export function pacePoll(host: Host, m: Memory) {
  const needed = m.agents.some(isWorking) || leaveAhead(m.agents, m.departure, planOver(m))
  if (needed && !m.poll) m.poll = host.clock.every(POLL_MS, () => void pass(host, m))
  else if (!needed && m.poll) {
    m.poll.cancel()
    m.poll = null
  }
}

/** Every change of a record ends here: the state gets a copy. */
export async function publish(host: Host, m: Memory) {
  await writeAgents(host, m.agents.map(a => ({ ...a })))
  pacePoll(host, m)
  await guard(host, m, 'summaries', () => freshen(host, m))
}

/** The room is settled: whatever comes next starts its zoom from a fresh mark. */
export async function settle(host: Host, m: Memory) {
  const n = seated(m.agents).length
  m.seen = { shown: n, previous: n }
  m.roomPair = zoomAgain(m.roomPair)
  await writeSeen(host, m.seen)
}

/** The outfit after this one, in the ring the agents share. */
const afterHue = (hue: number) => (hue % AGENT_HUES) + 1

/** The next outfit no one at work wears; when all are worn, simply the next. */
function nextHue(m: Memory) {
  const worn = new Set(m.agents.filter(isWorking).map(a => agentHue(a.hue)))
  const ring = Array.from({ length: AGENT_HUES }, (_, i) => ((m.nextHue - 1 + i) % AGENT_HUES) + 1)
  const hue = ring.find(tried => !worn.has(tried)) ?? ring[0]!
  m.nextHue = afterHue(hue)
  return hue
}

/** A record for an agent seen for the first time; the pane opens for the first one at work. */
async function enrol(host: Host, m: Memory, id: string, from: Newcomer) {
  const startedAt = await host.clock.now()
  // The clock took a moment: a parallel call may have enrolled it meanwhile.
  const held = m.agents.find(a => a.id === id)
  if (held) return held
  const quiet = !m.agents.some(isWorking)
  // A new wave clears the desks stopped by the last one: they have been seen.
  if (quiet) for (const stopped of m.agents.filter(other => other.phase === 'failed')) leave(m, stopped)
  const shown = seated(m.agents).length
  const a: AgentRecord = {
    id,
    description: from.description || t('agent.defaultDescription'),
    type: from.type || 'subagent',
    phase: 'working',
    startedAt,
    endedAt: 0,
    count: 0,
    steps: [],
    tokens: 0,
    liveTokens: 0,
    seat: m.nextSeat,
    hue: nextHue(m),
  }
  m.nextSeat += 1
  m.agents.push(a)
  m.seen = { shown: seated(m.agents).length, previous: shown }
  m.roomPair = zoomAgain(m.roomPair)
  await writeSeen(host, m.seen)
  if (quiet && !m.hidden) await openPane(host, m)
  return a
}

/** Back to work: a finished or stopped agent that acts again is at its desk. */
function revive(a: AgentRecord) {
  a.phase = 'working'
  a.endedAt = 0
  delete a.errored
}

/** `agent.spawn` named an agent. A new run of an id brings it back, even after it left. */
export async function arrive(host: Host, m: Memory, id: string, from: Newcomer) {
  m.gone.delete(id)
  m.strangers.delete(id)
  const known = m.agents.find(a => a.id === id)
  if (known) {
    known.description = from.description || known.description
    known.type = from.type || known.type
    if (!isWorking(known)) revive(known)
  } else await enrol(host, m, id, from)
  await publish(host, m)
}

/** The record of an id, adopted from the list if it is new. An id the list does not name is never looked for again. */
export async function known(host: Host, m: Memory, id: string) {
  const held = m.agents.find(a => a.id === id)
  if (held) return held
  if (m.gone.has(id) || m.strangers.has(id)) return null
  const info = (await host.agent.list()).find(a => a.id === id)
  if (!info) {
    m.strangers.add(id)
    return null
  }
  return enrol(host, m, id, info)
}

/** One tool call of an agent. */
export async function act(host: Host, m: Memory, id: string, tool: string, input: Record<string, unknown>) {
  const a = await known(host, m, id)
  if (!a) return
  if (!isWorking(a)) revive(a)
  a.count += 1
  a.steps = [...a.steps, { live: actionPhrase(tool, input, m.connectors) }].slice(-MAX_ACTIONS)
  await publish(host, m)
}

async function finish(host: Host, a: AgentRecord, phase: AgentPhase) {
  a.phase = phase
  a.endedAt = await host.clock.now()
  if (phase === 'failed') a.errored = true
}

/** Gone from the room, the state and the desk file. What it spent stays in the total. */
export function leave(m: Memory, a: AgentRecord) {
  m.agents = m.agents.filter(other => other !== a)
  m.gone.add(a.id)
  m.goneTokens += a.tokens + a.liveTokens
  m.marks.delete(a.id)
}

/** Every desk due leaves in one go, with one publication: no zoom, and nothing at all when none is due. */
export async function sweep(host: Host, m: Memory) {
  const due = leavers(m.agents, { mode: m.departure, now: await host.clock.now(), planOver: planOver(m) })
  if (due.length) {
    for (const a of due) leave(m, a)
    await settle(host, m)
    await publish(host, m)
  } else pacePoll(host, m)
}

/** A new plan clears the room at once: what the last one finished or stopped leaves without waiting. */
export async function clearDesks(host: Host, m: Memory) {
  const over = m.agents.filter(a => !isWorking(a))
  if (!over.length) return
  for (const a of over) leave(m, a)
  await settle(host, m)
  await publish(host, m)
}

/** Reads the list: only an agent at work can change. */
async function readList(host: Host, m: Memory) {
  await guard(host, m, 'agent list', async () => {
    if (!m.agents.some(isWorking)) return
    let moved = false
    let filled = false
    for (const info of await host.agent.list()) {
      const a = m.agents.find(other => other.id === info.id)
      if (!a || !isWorking(a)) continue
      if (!a.description && info.description) {
        a.description = info.description
        filled = true
      }
      if (info.status === 'killed') leave(m, a)
      else if (info.status === 'failed') await finish(host, a, 'failed')
      else if (info.status === 'completed' || info.status === 'idle') await finish(host, a, 'done')
      else continue
      moved = true
    }
    if (moved) await settle(host, m)
    if (moved || filled) await publish(host, m)
  })
}

/** The 2 s pass. One at a time: a slow list does not stack passes up. */
async function pass(host: Host, m: Memory) {
  if (m.polling) return
  m.polling = true
  await readList(host, m)
  await guard(host, m, 'departures', () => sweep(host, m))
  m.polling = false
}

/** The end of an agent's turn. The turn's sum takes over from the steps; an aborted turn never lowers the total. */
export async function endTurn(host: Host, m: Memory, id: string, end: { isAborted: boolean; reason: string; spent: number | null }) {
  const a = m.agents.find(other => other.id === id)
  if (!a) return
  const counted = end.spent ?? a.liveTokens
  a.tokens += end.isAborted ? Math.max(counted, a.liveTokens) : counted
  a.liveTokens = 0
  if (end.isAborted) leave(m, a)
  else await finish(host, a, end.reason === 'error' || end.reason === 'refusal' ? 'failed' : 'done')
  await settle(host, m)
  await publish(host, m)
}

/** Takes the copy the host kept. A desk stopped by an interruption, from an older version, does not stay, nor one finished long ago. */
export async function restoreAgents(host: Host, m: Memory) {
  const saved = await readAgents(host)
  if (m.agents.length || !saved?.length) return
  const now = await host.clock.now()
  const copy = saved.map(healed)
  const stale = (a: AgentRecord) => (a.phase === 'failed' ? !a.errored : a.phase === 'done' && now - a.endedAt >= LEAVE_MS)
  m.agents = copy.filter(a => !stale(a))
  for (const a of copy.filter(stale)) leave(m, a)
  m.nextHue = afterHue(Math.max(...copy.map(a => a.hue)))
  m.nextSeat = Math.max(...copy.map(a => a.seat)) + 1
  const n = seated(m.agents).length
  m.seen = (await readSeen(host)) ?? { shown: n, previous: n }
  if (m.agents.length < copy.length) await settle(host, m)
  await publish(host, m)
}
