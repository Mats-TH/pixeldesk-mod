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
export async function writeNotes(host: Host, m: Memory, messages: readonly SessionMessage[]) {
  const found = gather(messages, m.home)
  const date = new Date(await host.clock.now()).toISOString().slice(0, 16).replace('T', ' ')
  const title = t('notes.title', { n: m.heat.compactions + 1, date })
  const body = [section(t('notes.files'), found.files.slice(0, NOTE_FILES)), section(t('notes.decisions'), found.decisions), section(t('notes.requests'), found.asks)]
  await addNotes(host, m, scrubbed(`## ${title}\n${body.filter(Boolean).join('')}`))
  await pruneBriefings(host, m)
}

/** One compaction more for this conversation, whoever ran it. The cached prefix is gone with the old messages. */
async function counted(host: Host, m: Memory) {
  const h = m.heat
  h.compactions += 1
  h.at = 0
  keeperCalls(m, 'broom', await host.clock.now())
  await guard(host, m, 'hearth file', () => saveHearth(host, m))
}

/** Every compaction of the main conversation goes through here: the person's, the engine's and the mod's own. */
export async function onCompact(host: Host, m: Memory, e: SessionCompactInput, next: (e: SessionCompactInput) => Promise<SessionCompactResult>) {
  if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
  const h = m.heat
  const raised = Array.isArray(e.messages) ? e : { ...e, messages: await host.session.messages() }
  if (!h.ownCompact) await guard(host, m, 'compaction notes', () => writeNotes(host, m, raised.messages))
  h.compacting = true
  try {
    const done = await next(raised)
    if (done.skip === undefined) await counted(host, m)
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
async function compacted(host: Host, m: Memory, brief: string): Promise<{ skip?: string }> {
  try {
    return await host.session.compact({ instructions: brief })
  } catch (err) {
    if (!HEADLESS.test(reason(err))) throw err
  }
  const before = m.heat.compactions
  await host.command.compact(brief)
  return m.heat.compactions === before ? { skip: 'the command compacted nothing' } : {}
}

/** The mod compacts, between two turns, with the instructions of a briefing. A hook's refusal or a turn in the way is logged, and answers false. */
export async function compactNow(host: Host, m: Memory) {
  const h = m.heat
  const before = h.compactions
  h.ownCompact = true
  h.compacting = true
  try {
    await guard(host, m, 'compaction notes', async () => writeNotes(host, m, await host.session.messages()))
    const done = await compacted(host, m, t('briefing.compactBrief', { file: tilde(notesPath(m), m.home) }))
    if (done.skip !== undefined) {
      await log(host, m, `compaction skipped: ${done.skip}`)
      return false
    }
    if (h.compactions === before) await counted(host, m)
    toast(host, m, t('briefing.compactedToast'))
    return true
  } catch (err) {
    await log(host, m, `compaction: ${reason(err)}`)
    return false
  } finally {
    h.ownCompact = false
    h.compacting = false
  }
}
