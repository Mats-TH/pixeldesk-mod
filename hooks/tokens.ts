import type { EngineInterface, ModelUsage } from 'claude-code'

import type { Memory } from './memory'
import { readTokens, writeTokens } from './state'

/** All the tokens of a call: in, out, and both sides of the cache. */
export const sumOf = (u: ModelUsage) => u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens

const present = (m: Memory) => m.agents.reduce((sum, a) => sum + a.tokens + a.liveTokens, 0)

/** The conversation, the agents in the room, and the ones that left. */
export const totalOf = (m: Memory) => m.mainTokens + present(m) + m.goneTokens

/** The screen moves on the export's beat, and only for a new number. */
export async function showTokens($: EngineInterface, m: Memory) {
  const total = totalOf(m)
  if (total === m.shownTokens) return
  m.shownTokens = total
  await writeTokens($, total)
}

/** After a restart the count picks up from what was saved, with nothing counted twice and nothing lost. */
export async function restoreTokens($: EngineInterface, m: Memory, saved: unknown) {
  const count = typeof saved === 'number' ? saved : await readTokens($)
  if (!count) return
  m.mainTokens = Math.max(0, count - present(m) - m.goneTokens)
  m.shownTokens = count
  await writeTokens($, count)
}
