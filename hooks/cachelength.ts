import type { EngineInterface } from 'claude-code'

import { listed, onDisk, readText } from './disk'
import { settleLength } from './heat'
import type { CacheLength, Memory } from './memory'

const READ_EVERY_MS = 5 * 60_000

type Line = { type?: unknown; isSidechain?: unknown; message?: { usage?: { cache_creation?: { ephemeral_1h_input_tokens?: unknown; ephemeral_5m_input_tokens?: unknown } } } }

const positive = (v: unknown) => typeof v === 'number' && v > 0

/** What one line of a transcript says of the main loop's cache, or null when it says nothing. */
function lengthInLine(text: string): CacheLength | null {
  if (!text.includes('ephemeral_')) return null
  try {
    const line = JSON.parse(text) as Line
    if (line.type !== 'assistant' || line.isSidechain === true) return null
    const created = line.message?.usage?.cache_creation
    if (positive(created?.ephemeral_1h_input_tokens)) return '1h'
    return positive(created?.ephemeral_5m_input_tokens) ? '5m' : null
  } catch {
    return null
  }
}

/** The length the transcript's latest answer wrote with. The engine tells a hook the tokens, never the length. */
export function lengthIn(transcript: string): CacheLength | null {
  for (let end = transcript.length; end > 0;) {
    const start = transcript.lastIndexOf('\n', end - 1)
    const found = lengthInLine(transcript.slice(start + 1, end))
    if (found) return found
    end = start
  }
  return null
}

/** Where the transcript lies: the engine's word when it gave it, else a look through the project folders. */
async function transcriptPath($: EngineInterface, m: Memory) {
  if (m.heat.transcript) return m.heat.transcript
  const projects = `${m.home}/.claude/projects`
  for (const entry of await listed($, projects)) {
    const path = `${projects}/${entry.name}/${m.sessionId}.jsonl`
    if (entry.kind === 'dir' && (await $.fs.exists(path).catch(() => false))) {
      m.heat.transcript = path
      return path
    }
  }
  return ''
}

/**
 * Reads the length, at most every five minutes. The engine gives it nowhere else: no message carries its usage and
 * `$.fs.read` takes a file whole, up to 4 MiB. Past that the transcript says nothing, what was known stays, and the
 * person's own requests are left to prove it (`heat.ts`). Until then no relaunch goes out.
 */
export async function readLength($: EngineInterface, m: Memory) {
  const h = m.heat
  const now = await $.clock.now()
  if (!onDisk(m) || (h.lengthReadAt && now - h.lengthReadAt < READ_EVERY_MS)) return
  h.lengthReadAt = now
  const path = await transcriptPath($, m)
  const text = path ? await readText($, path) : undefined
  const found = text === undefined ? null : lengthIn(text)
  if (!found || found === h.known) return
  settleLength(h, found)
  m.wake()
}
