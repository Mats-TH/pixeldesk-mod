import type { Host } from './host'
import type { Limit } from '../types'

import { onDisk, readText, stateDir } from './disk'
import type { Memory } from './memory'
import { writeLimits } from './state'

/**
 * The limits are the account's, not a conversation's, but the engine reads them only after a conversation's first
 * answer: until then a new conversation, or each one after a restart, would have nothing to show. So the last
 * reading any conversation had is kept on disk, and a conversation takes it while its own is older or missing.
 */
export const limitsPath = (m: Memory) => `${stateDir(m)}/limits.json`

type Shared = { at: number; limits: Limit[] }

function parse(text: string | undefined): Shared | undefined {
  if (!text) return undefined
  try {
    const value = JSON.parse(text) as Partial<Shared>
    if (typeof value.at !== 'number' || !Array.isArray(value.limits)) return undefined
    const limits = value.limits.filter((l): l is Limit => !!l && typeof l.kind === 'string' && typeof l.percentUsed === 'number')
    return limits.length ? { at: value.at, limits } : undefined
  } catch {
    return undefined
  }
}

/** A reading of this conversation's own: shown, and handed to the others. An empty one changes nothing. */
export async function keepLimits(host: Host, m: Memory, limits: readonly Limit[]) {
  if (!limits.length) return
  const at = await host.clock.now()
  m.limitsAt = at
  await writeLimits(host, [...limits])
  if (onDisk(m)) await host.fs.write(limitsPath(m), JSON.stringify({ at, limits }))
}

/** Takes the reading another conversation left, when it is newer than the one shown here. */
export async function adoptLimits(host: Host, m: Memory) {
  if (!onDisk(m)) return
  const shared = parse(await readText(host, limitsPath(m)))
  if (!shared || shared.at <= m.limitsAt) return
  m.limitsAt = shared.at
  await writeLimits(host, shared.limits)
}
