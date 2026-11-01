import type { Host } from './host'

import { guard, briefingsDir, hearthPath, listed, onDisk, readText } from './disk'
import type { Memory } from './memory'

const KEEP = 20
const NOTES_KEEP = 200_000
const BRIEFING_NAME = /^\d{4}-\d{2}-\d{2}-\d{4}-.+\.md$/
const NOTES_NAME = /^notes-.+\.md$/
const DRAFT_NAME = /^draft-.+\.md$/

export const draftPath = (m: Memory) => `${briefingsDir(m)}/draft-${m.sessionId}.md`
export const notesPath = (m: Memory) => `${briefingsDir(m)}/notes-${m.sessionId}.md`

/**
 * Keeps the latest of a kind. `$.fs` cannot delete and no command may, so what falls out of the list is emptied:
 * the text is gone from the disk, and an empty file no longer counts.
 */
async function keepLatest(host: Host, m: Memory, name: RegExp) {
  const entries = (await listed(host, briefingsDir(m))).filter(entry => entry.kind === 'file' && entry.size > 0 && name.test(entry.name))
  const newestFirst = [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))
  for (const entry of newestFirst.slice(KEEP)) await host.fs.write(`${briefingsDir(m)}/${entry.name}`, '')
}

/** One pass for each kind of file the folder holds. A failure leaves one file too many, nothing worse. */
export async function pruneBriefings(host: Host, m: Memory) {
  for (const name of [BRIEFING_NAME, NOTES_NAME, DRAFT_NAME]) await guard(host, m, 'briefing files', () => keepLatest(host, m, name))
}

/** What this conversation's compactions left. */
export async function readNotes(host: Host, m: Memory) {
  return (onDisk(m) ? await readText(host, notesPath(m)) : undefined) ?? ''
}

/** The notes of a compaction join the earlier ones, in one file for the conversation. */
export async function addNotes(host: Host, m: Memory, text: string) {
  if (!onDisk(m)) return
  await host.fs.write(notesPath(m), `${await readNotes(host, m)}${text}\n`.slice(-NOTES_KEEP))
}

/** What must outlive a restart: how many compactions, and the point under which no offer comes back. */
export async function saveHearth(host: Host, m: Memory) {
  if (onDisk(m)) await host.fs.write(hearthPath(m), JSON.stringify({ compactions: m.heat.compactions, snooze: m.change.snooze }))
}

export async function restoreHearth(host: Host, m: Memory) {
  const text = onDisk(m) ? await readText(host, hearthPath(m)) : undefined
  if (text === undefined) return
  const saved = JSON.parse(text) as { compactions?: unknown; snooze?: unknown }
  if (typeof saved.compactions === 'number') m.heat.compactions = saved.compactions
  if (typeof saved.snooze === 'number') m.change.snooze = saved.snooze
}
