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

type Node = Record<string, unknown>

const isNode = (v: unknown): v is Node => !!v && typeof v === 'object' && !Array.isArray(v)

/** One decimal at most, as the engine gives its own percents. */
const tenth = (n: number) => Math.round(n * 10) / 10

// The words of an object that say which window it is, when the window is told inside it rather than by its key.
const NAMING = ['kind', 'group', 'model', 'model_family', 'name', 'window', 'type', 'period']

/** Every text inside a window's `scope`: a limit kept for one model says which there (`scope.model`). */
function scopeWords(scope: unknown, depth = 0): string[] {
  if (depth > 3) return []
  if (typeof scope === 'string') return [scope]
  if (Array.isArray(scope)) return scope.flatMap(item => scopeWords(item, depth + 1))
  if (isNode(scope)) return Object.values(scope).flatMap(item => scopeWords(item, depth + 1))
  return []
}

/** A word fit for a kind: lower case, only letters, digits and underscores. */
const word = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

/**
 * Every window of the answer, wherever it lies: an object with a numeric `utilization` is one, named by the path that
 * leads to it and the naming words it holds, so `seven_day_fable` stays `seven_day_fable` and
 * `{ limits: [{ model: "fable", window: "seven_day", ... }] }` reads `limits_fable_seven_day`. A window with no figure
 * is left out; anything that is no such answer reads as none.
 */
export function accountLimits(text: string): Limit[] {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return []
  }
  const limits: Limit[] = []
  const seen = new Set<string>()
  const walk = (value: unknown, path: string[], depth: number) => {
    if (depth > 4) return
    if (Array.isArray(value)) return value.forEach(item => walk(item, path, depth + 1))
    if (!isNode(value)) return
    // A window: its `utilization`, or a `percent` with the time it resets (the account's list of limits).
    const figure = typeof value.utilization === 'number' ? value.utilization : typeof value.percent === 'number' && typeof value.resets_at === 'string' ? value.percent : undefined
    if (figure !== undefined) {
      const named = [...NAMING.map(key => value[key]).filter((v): v is string => typeof v === 'string'), ...scopeWords(value.scope)]
      const kind = [...path, ...named].map(word).filter(Boolean).join('_')
      if (!kind || seen.has(kind)) return
      seen.add(kind)
      const reset = value.resets_at ?? value.reset_at ?? value.resetsAt
      const resetsAt = typeof reset === 'string' && !Number.isNaN(Date.parse(reset)) ? reset : undefined
      limits.push({ kind, percentUsed: tenth(figure), ...(resetsAt ? { resetsAt } : {}) })
      return
    }
    for (const [key, child] of Object.entries(value)) walk(child, [...path, key], depth + 1)
  }
  walk(body, [], 0)
  return limits
}

/**
 * The shape of the answer, its names and the kinds of its values, never a figure: what the log keeps so that a window
 * the mod does not read yet can be found. `{"seven_day":{"utilization":12}}` reads `seven_day{utilization:number}`.
 */
export function accountShape(text: string, room = 4000): string {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return 'not json'
  }
  const shape = (value: unknown, depth: number): string => {
    if (value === null) return 'null'
    if (Array.isArray(value)) return depth > 3 ? '[...]' : `[${value.map(item => shape(item, depth + 1)).join(',')}]`
    if (isNode(value)) return depth > 3 ? '{...}' : `{${Object.entries(value).map(([k, v]) => `${k}:${LABELS.has(k) && typeof v === 'string' ? JSON.stringify(v) : shape(v, depth + 1)}`).join(',')}}`
    return typeof value
  }
  // The words that name a window are labels, never figures: they show as they are.
  const LABELS = new Set(['kind', 'group', 'key', 'display_name', 'severity', 'scope'])
  const text2 = shape(body, 0)
  return text2.length > room ? `${text2.slice(0, room)}...` : text2
}
