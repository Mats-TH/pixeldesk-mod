import type { Host } from './host'

import type { DrawnPlan, FloorSeat } from '../types'
import { lastAction, isWorking } from './agents'
import { keptRoom, roleOf } from './desks'
import { briefingsDir, reason } from './disk'
import { draftPath, pruneBriefings, readNotes } from './briefing-disk'
import { MOST_FILES, gather, promptValues, scrubbed, slugOf, stampOf, tilde, unwrapped, wordsOf } from './briefing-gather'
import type { Found } from './briefing-gather'
import { workNow } from './heat'
import { t } from './i18n'
import type { TextKey } from './i18n'
import type { Memory } from './memory'
import { drawnPlan } from './plan'
import { readFloorRooms } from './state'

const DRAFT_FILES = 15
const NOTES_CHARS = 24_000
const ROOM_WORD: Record<string, TextKey> = { working: 'state.working', done: 'state.done', failed: 'state.failed', idle: 'state.rest' }
const STEP_WORD: Record<string, TextKey> = { completed: 'briefing.running.done', in_progress: 'briefing.running.live', pending: 'briefing.running.todo' }

export type Written = { ok: true; file: string; text: string; words: number; sentAt: number } | { ok: false; error: string; failedStep: number; draft: string | null; text: string }

class Stopped extends Error {}

/** A list under a heading of its own, or nothing at all. */
const block = (title: string, lines: readonly string[]) => (lines.length ? [`### ${title}`, ...lines.map(line => `- ${line}`), ''] : [])

const agentLines = (m: Memory) => m.agents.filter(isWorking).map(a => `${roleOf(a.type, a.description)} : ${a.description}${lastAction(a) ? ` (${lastAction(a)})` : ''}`)

const chatLines = (rooms: readonly FloorSeat[]) => rooms.map(r => `${r.title} : ${t(ROOM_WORD[r.state ?? 'idle'] ?? 'state.rest')}${r.summary ? `, ${r.summary}` : ''}`)

const planLines = (plan: DrawnPlan | null) => (plan?.steps ?? []).map(st => `${t(STEP_WORD[st.status] ?? 'briefing.running.todo')} : ${st.text}`)

/** What still runs: never left to the model, and always in the document, even empty. */
export async function runningSection(host: Host, m: Memory, carryOn: boolean) {
  const rooms = ((await readFloorRooms(host)) ?? []).slice(1).map(keptRoom)
  const agents = agentLines(m)
  const plan = m.plan ? drawnPlan(m.plan) : null
  const body = [...block(t('briefing.running.agents'), agents), ...block(t('briefing.running.chats'), chatLines(rooms)), ...block(t('briefing.running.plan'), planLines(plan))]
  const { agents: live, chats } = await workNow(host, m)
  const carry = carryOn && live + chats > 0 ? [t('briefing.running.carryOn'), ''] : []
  return [`## ${t('briefing.running.title')}`, '', ...carry, ...(body.length ? body : [t('briefing.running.none'), ''])].join('\n').trimEnd()
}

/** The plain draft: enough to pick the work up if the model never answers. */
function draftOf(cwd: string, found: Found, notes: string, running: string) {
  const list = (title: TextKey, items: readonly string[]) => [`## ${t(title)}`, '', ...(items.length ? items.map(item => `- ${item}`) : [t('briefing.none')]), '']
  return [
    `# ${t('briefing.draftTitle')}`,
    '',
    t('briefing.draftIntro', { cwd }),
    '',
    ...list('briefing.draftAsks', found.asks),
    ...list('briefing.draftFiles', found.files.slice(0, DRAFT_FILES)),
    ...list('briefing.draftTools', found.skills),
    ...list('briefing.draftLinks', found.links),
    ...(notes ? [`## ${t('briefing.draftNotes')}`, '', notes, ''] : []),
    running,
    '',
  ].join('\n')
}

/** Only the files still on the disk, the most used first. */
async function onDiskOnly(host: Host, files: readonly string[]) {
  const kept: string[] = []
  for (const path of files) {
    if (kept.length >= MOST_FILES) break
    if (await host.fs.exists(path).catch(() => false)) kept.push(path)
  }
  return kept
}

async function askModel(host: Host, m: Memory, prompt: string) {
  m.heat.forks.add(prompt)
  try {
    const reply = await host.model.fork({ prompt })
    if (reply.isAnswered && reply.text.trim()) return reply.text
    if (reply.isAnswered) throw new Stopped(t('briefing.errNone', { reason: 'empty-reply' }))
    if (reply.reason === 'api-error') throw new Stopped(t('briefing.errApi', { status: reply.status ?? '?' }))
    throw new Stopped(t('briefing.errNone', { reason: reply.reason }))
  } finally {
    m.heat.forks.delete(prompt)
  }
}

async function saveChecked(host: Host, path: string, text: string) {
  await host.fs.write(path, text)
  if ((await host.fs.read(path)) !== text) throw new Stopped(t('briefing.errMismatch'))
}

/**
 * Writes the briefing, in five steps. `at` tells each one as it starts. The draft goes on the disk before the model is
 * called, so that a failure leaves something; a failure of the model never costs a second call.
 * `signal` stops it at the next step, so nothing is saved after it: the engine cannot cut a fork on its way.
 */
export async function writeBriefingFile(host: Host, m: Memory, carryOn: boolean, signal: AbortSignal, at: (step: number) => Promise<void>): Promise<Written> {
  let step = 0
  let draft: string | null = null
  let draftText = ''
  const enter = (n: number) => {
    if (signal.aborted) throw new Stopped(t('briefing.errNone', { reason: 'aborted' }))
    step = n
    return at(n)
  }
  try {
    await enter(0)
    const messages = await host.session.messages()
    await enter(1)
    const raw = gather(messages, m.home)
    const found = { ...raw, files: await onDiskOnly(host, raw.files) }
    await enter(2)
    const notes = (await readNotes(host, m)).slice(-NOTES_CHARS)
    const running = await runningSection(host, m, carryOn)
    const cwd = tilde(m.cwd, m.home)
    draftText = scrubbed(draftOf(cwd, found, notes, running))
    await host.fs.write(draftPath(m), draftText)
    draft = draftPath(m)
    await enter(3)
    const sentAt = await host.clock.now()
    const prompt = t('briefing.prompt', { ...promptValues(found), cwd, notes: notes || t('briefing.none') })
    const reply = unwrapped(await askModel(host, m, prompt))
    await enter(4)
    const text = scrubbed(`${reply}\n\n${running}\n`)
    const file = `${briefingsDir(m)}/${stampOf(await host.clock.now())}-${slugOf(text)}.md`
    await saveChecked(host, file, text)
    await pruneBriefings(host, m)
    return { ok: true, file, text, words: wordsOf(reply), sentAt }
  } catch (err) {
    const error = err instanceof Stopped ? err.message : reason(err)
    return { ok: false, error, failedStep: step, draft, text: draftText }
  }
}
