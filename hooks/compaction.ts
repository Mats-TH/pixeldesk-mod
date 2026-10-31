import type { EngineInterface, SessionCompactInput, SessionCompactResult, SessionMessage } from 'claude-code'

import { guard, log, reason, toast } from './disk'
import { pruneHandoffs, saveHearth, addNotes, notesPath } from './handoff-disk'
import { gather, scrubbed, tilde } from './handoff-gather'
import { keeperCalls } from './heat'
import { t } from './i18n'
import type { Memory } from './memory'

const NOTE_FILES = 15

const section = (title: string, lines: readonly string[]) => (lines.length ? `### ${title}\n${lines.map(line => `- ${line}`).join('\n')}\n` : '')

/** The files, decisions and requests of what is about to be compacted, while the words are still there. */
export async function writeNotes($: EngineInterface, m: Memory, messages: readonly SessionMessage[]) {
  const found = gather(messages, m.home)
  const date = new Date(await $.clock.now()).toISOString().slice(0, 16).replace('T', ' ')
  const title = t('notes.title', { n: m.heat.compactions + 1, date })
  const body = [section(t('notes.files'), found.files.slice(0, NOTE_FILES)), section(t('notes.decisions'), found.decisions), section(t('notes.requests'), found.asks)]
  await addNotes($, m, scrubbed(`## ${title}\n${body.filter(Boolean).join('')}`))
  await pruneHandoffs($, m)
}

/** One compaction more for this conversation, whoever ran it. The cached prefix is gone with the old messages. */
async function counted($: EngineInterface, m: Memory) {
  const h = m.heat
  h.compactions += 1
  h.at = 0
  keeperCalls(m, 'broom', await $.clock.now())
  await guard($, m, 'hearth file', () => saveHearth($, m))
}

/** Every compaction of the main conversation goes through here: the person's, the engine's and the mod's own. */
export async function onCompact($: EngineInterface, m: Memory, e: SessionCompactInput, next: (e: SessionCompactInput) => Promise<SessionCompactResult>) {
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

/** The mod compacts, between two turns, with the handoff's brief. A hook's refusal or a turn in the way is only logged. */
export async function compactNow($: EngineInterface, m: Memory) {
  const h = m.heat
  const before = h.compactions
  h.ownCompact = true
  h.compacting = true
  try {
    await guard($, m, 'compaction notes', async () => writeNotes($, m, await $.session.messages()))
    const done = await $.session.compact({ instructions: t('handoff.compactBrief', { file: tilde(notesPath(m), m.home) }) })
    if (done.skip !== undefined) await log($, m, `compaction skipped: ${done.skip}`)
    else {
      if (h.compactions === before) await counted($, m)
      toast($, m, t('handoff.compactedToast'))
    }
  } catch (err) {
    await log($, m, `compaction: ${reason(err)}`)
  } finally {
    h.ownCompact = false
    h.compacting = false
  }
}
