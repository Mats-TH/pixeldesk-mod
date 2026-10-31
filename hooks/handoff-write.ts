import type { EngineInterface } from 'claude-code'

import type { DrawnPlan, FloorSeat } from '../types'
import { lastAction, isWorking } from './agents'
import { keptRoom, roleOf } from './desks'
import { handoffsDir, reason } from './disk'
import { draftPath, pruneHandoffs, readNotes } from './handoff-disk'
import { MOST_FILES, gather, promptValues, scrubbed, slugOf, stampOf, tilde, unwrapped, wordsOf } from './handoff-gather'
import type { Found } from './handoff-gather'
import { workNow } from './heat'
import { t } from './i18n'
import type { TextKey } from './i18n'
import type { Memory } from './memory'
import { drawnPlan } from './plan'
import { readFloorRooms } from './state'

const DRAFT_FILES = 15
const NOTES_CHARS = 24_000
const ROOM_WORD: Record<string, TextKey> = { working: 'state.working', done: 'state.done', failed: 'state.failed', idle: 'state.rest' }
const STEP_WORD: Record<string, TextKey> = { completed: 'handoff.running.done', in_progress: 'handoff.running.live', pending: 'handoff.running.todo' }

export type Written = { ok: true; file: string; text: string; words: number; sentAt: number } | { ok: false; error: string; failedStep: number; draft: string | null; text: string }

class Stopped extends Error {}

/** A list under a heading of its own, or nothing at all. */
const block = (title: string, lines: readonly string[]) => (lines.length ? [`### ${title}`, ...lines.map(line => `- ${line}`), ''] : [])

const agentLines = (m: Memory) => m.agents.filter(isWorking).map(a => `${roleOf(a.type, a.description)} : ${a.description}${lastAction(a) ? ` (${lastAction(a)})` : ''}`)

const chatLines = (rooms: readonly FloorSeat[]) => rooms.map(r => `${r.title} : ${t(ROOM_WORD[r.state ?? 'idle'] ?? 'state.rest')}${r.summary ? `, ${r.summary}` : ''}`)

const planLines = (plan: DrawnPlan | null) => (plan?.steps ?? []).map(st => `${t(STEP_WORD[st.status] ?? 'handoff.running.todo')} : ${st.text}`)

/** What still runs: never left to the model, and always in the document, even empty. */
export async function runningSection($: EngineInterface, m: Memory, carryOn: boolean) {
  const rooms = ((await readFloorRooms($)) ?? []).slice(1).map(keptRoom)
  const agents = agentLines(m)
  const plan = m.plan ? drawnPlan(m.plan) : null
  const body = [...block(t('handoff.running.agents'), agents), ...block(t('handoff.running.chats'), chatLines(rooms)), ...block(t('handoff.running.plan'), planLines(plan))]
  const { agents: live, chats } = await workNow($, m)
  const carry = carryOn && live + chats > 0 ? [t('handoff.running.carryOn'), ''] : []
  return [`## ${t('handoff.running.title')}`, '', ...carry, ...(body.length ? body : [t('handoff.running.none'), ''])].join('\n').trimEnd()
}

/** The plain draft: enough to pick the work up if the model never answers. */
function draftOf(cwd: string, found: Found, notes: string, running: string) {
  const list = (title: TextKey, items: readonly string[]) => [`## ${t(title)}`, '', ...(items.length ? items.map(item => `- ${item}`) : [t('handoff.none')]), '']
  return [
    `# ${t('handoff.draftTitle')}`,
    '',
    t('handoff.draftIntro', { cwd }),
    '',
    ...list('handoff.draftAsks', found.asks),
    ...list('handoff.draftFiles', found.files.slice(0, DRAFT_FILES)),
    ...list('handoff.draftTools', found.skills),
    ...list('handoff.draftLinks', found.links),
    ...(notes ? [`## ${t('handoff.draftNotes')}`, '', notes, ''] : []),
    running,
    '',
  ].join('\n')
}

/** Only the files still on the disk, the most used first. */
async function onDiskOnly($: EngineInterface, files: readonly string[]) {
  const kept: string[] = []
  for (const path of files) {
    if (kept.length >= MOST_FILES) break
    if (await $.fs.exists(path).catch(() => false)) kept.push(path)
  }
  return kept
}

async function askModel($: EngineInterface, m: Memory, prompt: string) {
  m.heat.forks.add(prompt)
  try {
    const reply = await $.model.fork({ prompt })
    if (reply.isAnswered && reply.text.trim()) return reply.text
    if (reply.isAnswered) throw new Stopped(t('handoff.errNone', { reason: 'empty-reply' }))
    if (reply.reason === 'api-error') throw new Stopped(t('handoff.errApi', { status: reply.status ?? '?' }))
    throw new Stopped(t('handoff.errNone', { reason: reply.reason }))
  } finally {
    m.heat.forks.delete(prompt)
  }
}

async function saveChecked($: EngineInterface, path: string, text: string) {
  await $.fs.write(path, text)
  if ((await $.fs.read(path)) !== text) throw new Stopped(t('handoff.errMismatch'))
}

/**
 * Writes the handoff, in five steps. `at` tells each one as it starts. The draft goes on the disk before the model is
 * called, so that a failure leaves something; a failure of the model never costs a second call.
 * `signal` stops it at the next step, so nothing is saved after it: the engine cannot cut a fork on its way.
 */
export async function writeHandoffFile($: EngineInterface, m: Memory, carryOn: boolean, signal: AbortSignal, at: (step: number) => Promise<void>): Promise<Written> {
  let step = 0
  let draft: string | null = null
  let draftText = ''
  const enter = (n: number) => {
    if (signal.aborted) throw new Stopped(t('handoff.errNone', { reason: 'aborted' }))
    step = n
    return at(n)
  }
  try {
    await enter(0)
    const messages = await $.session.messages()
    await enter(1)
    const raw = gather(messages, m.home)
    const found = { ...raw, files: await onDiskOnly($, raw.files) }
    await enter(2)
    const notes = (await readNotes($, m)).slice(-NOTES_CHARS)
    const running = await runningSection($, m, carryOn)
    const cwd = tilde(m.cwd, m.home)
    draftText = scrubbed(draftOf(cwd, found, notes, running))
    await $.fs.write(draftPath(m), draftText)
    draft = draftPath(m)
    await enter(3)
    const sentAt = await $.clock.now()
    const prompt = t('handoff.prompt', { ...promptValues(found), cwd, notes: notes || t('handoff.none') })
    const reply = unwrapped(await askModel($, m, prompt))
    await enter(4)
    const text = scrubbed(`${reply}\n\n${running}\n`)
    const file = `${handoffsDir(m)}/${stampOf(await $.clock.now())}-${slugOf(text)}.md`
    await saveChecked($, file, text)
    await pruneHandoffs($, m)
    return { ok: true, file, text, words: wordsOf(reply), sentAt }
  } catch (err) {
    const error = err instanceof Stopped ? err.message : reason(err)
    return { ok: false, error, failedStep: step, draft, text: draftText }
  }
}
