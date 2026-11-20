import type { Limit } from '../types'

/**
 * The account's own figures, as Claude Code's `/usage` reads them: every window the plan has, a week of its own for a
 * model among them (Fable). The engine's measures carry only the five hours and the week of all, so this is where a
 * model's week comes from. The request rides the session's credential through the engine: the mod never sees it.
 */
export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
export const USAGE_HEADERS = { 'anthropic-beta': 'oauth-2025-04-20' }

/** Read again no sooner than this, whichever conversation read last: the figures move slowly. */
export const ACCOUNT_MS = 3 * 60_000

type Window = { utilization?: unknown; resets_at?: unknown }

const isWindow = (v: unknown): v is Window => !!v && typeof v === 'object' && typeof (v as Window).utilization === 'number'

/** One decimal at most, as the engine gives its own percents. */
const tenth = (n: number) => Math.round(n * 10) / 10

/**
 * Every window of the answer, under the name the account gives it: `five_hour`, `seven_day`, `seven_day_fable`...
 * A window with no figure (null, a plan without it) is left out. Anything that is no such answer reads as none.
 */
export function accountLimits(text: string): Limit[] {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return []
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return []
  const limits: Limit[] = []
  for (const [kind, value] of Object.entries(body as Record<string, unknown>)) {
    if (!isWindow(value)) continue
    const resetsAt = typeof value.resets_at === 'string' && !Number.isNaN(Date.parse(value.resets_at)) ? value.resets_at : undefined
    limits.push({ kind, percentUsed: tenth(value.utilization as number), ...(resetsAt ? { resetsAt } : {}) })
  }
  return limits
}
