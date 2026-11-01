import type { SessionCompactInput, SessionCompactResult, SessionMessage } from 'claude-code'
import type { Host } from './host'

import { guard, log, reason, toast } from './disk'
import { pruneBriefings, saveHearth, addNotes, notesPath } from './briefing-disk'
import { gather, scrubbed, tilde } from './briefing-gather'
import { keeperCalls } from './heat'
import { t } from './i18n'
import type { Memory } from './memory'

const NOTE_FILES = 15
const HEADLESS = /headless/i

const section = (title: string, lines: readonly string[]) => (lines.length ? `### ${title}\n${lines.map(line => `- ${line}`).join('\n')}\n` : '')

/** The files, decisions and requests of what is about to be compacted, while the words are still there. */
export async function writeNotes($: Host, m: Memory, messages: readonly SessionMessage[]) {
  const found = gather(messages, m.home)
  const date = new Date(await $.clock.now()).toISOString().slice(0, 16).replace('T', ' ')
  const title = t('notes.title', { n: m.heat.compactions + 1, date })
  const body = [section(t('notes.files'), found.files.slice(0, NOTE_FILES)), section(t('notes.decisions'), found.decisions), section(t('notes.requests'), found.asks)]
  await addNotes($, m, scrubbed(`## ${title}\n${body.filter(Boolean).join('')}`))
  await pruneBriefings($, m)
}

/** One compaction more for this conversation, whoever ran it. The cached prefix is gone with the old messages. */
async function counted($: Host, m: Memory) {
  const h = m.heat
  h.compactions += 1
  h.at = 0
  keeperCalls(m, 'broom', await $.clock.now())
  await guard($, m, 'hearth file', () => saveHearth($, m))
}

/** Every compaction of the main conversation goes through here: the person's, the engine's and the mod's own. */
export async function onCompact($: Host, m: Memory, e: SessionCompactInput, next: (e: SessionCompactInput) => Promise<SessionCompactResult>) {
  if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
  const h = m.heat
  const raised = Array.isArray(e.messages) ? e : { ...e, messages: await $.session.messages() }
  if (!h.ownCompact) await guard($, m, 'compaction notes', () => writeNotes($, m, raised.messages))
  h.compacting = true
  try {
    const done = await next(raised)
    if (done.skip === undefined) await counted($, m)
    return done
  } finally {
    h.compacting = false
    m.wake()
  }
}

/**
 * A session the app runs has no `$.session.compact`: there a compaction only runs as the command, queued for when
 * the session is idle, and only `onCompact` knows that it stood.
 */
async function compacted($: Host, m: Memory, brief: string): Promise<{ skip?: string }> {
  try {
    return await $.session.compact({ instructions: brief })
  } catch (err) {
    if (!HEADLESS.test(reason(err))) throw err
  }
  const before = m.heat.compactions
  await $.command.compact(brief)
  return m.heat.compactions === before ? { skip: 'the command compacted nothing' } : {}
}

/** The mod compacts, between two turns, with the instructions of a briefing. A hook's refusal or a turn in the way is logged, and answers false. */
export async function compactNow($: Host, m: Memory) {
  const h = m.heat
  const before = h.compactions
  h.ownCompact = true
  h.compacting = true
  try {
    await guard($, m, 'compaction notes', async () => writeNotes($, m, await $.session.messages()))
    const done = await compacted($, m, t('briefing.compactBrief', { file: tilde(notesPath(m), m.home) }))
    if (done.skip !== undefined) {
      await log($, m, `compaction skipped: ${done.skip}`)
      return false
    }
    if (h.compactions === before) await counted($, m)
    toast($, m, t('briefing.compactedToast'))
    return true
  } catch (err) {
    await log($, m, `compaction: ${reason(err)}`)
    return false
  } finally {
    h.ownCompact = false
    h.compacting = false
  }
}
