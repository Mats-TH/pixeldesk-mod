import type { Host } from './host'
import type { Limit } from '../types'

import { ACCOUNT_MS, accountLimits, accountShape } from './account-limits'
import { log, onDisk, readText, stateDir } from './disk'
import type { Memory } from './memory'
import { readLimits, writeLimits } from './state'

/**
 * The limits are the account's, not a conversation's. Two sources feed them: the engine's measure after each answer
 * (the five hours and the week of all), and the account's own figures (every window, a model's week among them), read
 * every few minutes. The last reading any conversation had is kept on disk, so a new conversation, or each one after
 * a restart, shows it at once, and a conversation takes it while its own is older.
 */
export const limitsPath = (m: Memory) => `${stateDir(m)}/limits.json`

/** `at`: when `limits` was read. `accountAt`: when the account was last asked, by any conversation. */
type Shared = { at: number; limits: Limit[]; accountAt?: number }

function parse(text: string | undefined): Shared | undefined {
  if (!text) return undefined
  try {
    const value = JSON.parse(text) as Partial<Shared>
    if (typeof value.at !== 'number' || !Array.isArray(value.limits)) return undefined
    const limits = value.limits.filter((l): l is Limit => !!l && typeof l.kind === 'string' && typeof l.percentUsed === 'number')
    const accountAt = typeof value.accountAt === 'number' ? value.accountAt : undefined
    return { at: value.at, limits, ...(accountAt ? { accountAt } : {}) }
  } catch {
    return undefined
  }
}

const readShared = async (host: Host, m: Memory) => (onDisk(m) ? parse(await readText(host, limitsPath(m))) : undefined)

/**
 * A reading of this conversation's own: shown, and handed to the others. `whole` is the account's, every window it
 * has; otherwise the windows it names take their new figures and the others keep theirs, so the engine's measure,
 * which knows only two windows, never drops a model's week. An empty reading changes nothing.
 */
export async function keepLimits(host: Host, m: Memory, limits: readonly Limit[], whole = false, accountAt?: number) {
  if (!limits.length) return
  const at = await host.clock.now()
  const before = whole ? [] : ((await readLimits(host)) ?? [])
  const merged = [...limits, ...before.filter(old => !limits.some(l => l.kind === old.kind))]
  m.limitsAt = at
  await writeLimits(host, merged)
  if (!onDisk(m)) return
  const kept = accountAt ?? (await readShared(host, m))?.accountAt
  await host.fs.write(limitsPath(m), JSON.stringify({ at, limits: merged, ...(kept ? { accountAt: kept } : {}) }))
}

/** Takes the reading another conversation left, when it is newer than the one shown here. */
export async function adoptLimits(host: Host, m: Memory) {
  const shared = await readShared(host, m)
  if (!shared?.limits.length || shared.at <= m.limitsAt) return
  m.limitsAt = shared.at
  await writeLimits(host, shared.limits)
}

/**
 * Asks the account for its figures when no conversation did in the last few minutes. The windows it names go to the
 * log once a session, without their figures, so that a new window shows where it comes from.
 */
export async function refreshAccount(host: Host, m: Memory) {
  const now = await host.clock.now()
  // A conversation asks once as it opens, whatever the others did: so each one starts with the account's figures.
  const asked = m.accountAt ? Math.max(m.accountAt, (await readShared(host, m))?.accountAt ?? 0) : 0
  if (now - asked < ACCOUNT_MS) return
  m.accountAt = now
  const reply = await host.account.usage()
  if (!reply) return
  const limits = reply.ok ? accountLimits(reply.text) : []
  // Once a session is enough to say what the account answers: a refusal, or the windows it has.
  if (!m.windowsLogged) {
    m.windowsLogged = true
    await log(host, m, reply.ok ? `account windows: ${limits.map(l => l.kind).join(', ') || 'none'}` : `account usage: status ${reply.status}`)
    if (reply.ok) await log(host, m, `account shape: ${accountShape(reply.text)}`)
  }
  await keepLimits(host, m, limits, true, now)
}
