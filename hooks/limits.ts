import type { Limit } from '../types'
import { getLanguage, t } from './i18n'
import type { TextKey } from './i18n'

export type LimitKind = 'five_hour' | 'seven_day'

export type Gauge = {
  label: '5 H' | '7 J' | '7 D'
  /** Share of the window used, 0 to 100, null without a reading. */
  used: number | null
  /** Where to be to end exactly at 100% on reset, 0 to 100, null when unknown. */
  mark: number | null
  percent: string
  at: string
}

const HOUR = 3_600_000
const SPAN: Record<LimitKind, number> = { five_hour: 5 * HOUR, seven_day: 168 * HOUR }
const LABEL: Record<LimitKind, TextKey> = { five_hour: 'gauge.five', seven_day: 'gauge.seven' }
const DAYS: readonly TextKey[] = ['day.0', 'day.1', 'day.2', 'day.3', 'day.4', 'day.5', 'day.6']
const EMPTY = { used: null, mark: null, percent: '--', at: '--:--' }

function resetText(fiveHour: boolean, end: number) {
  const date = new Date(end)
  const h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  if (fiveHour) return `${String(h).padStart(2, '0')}:${m}`
  const day = t(DAYS[date.getDay()]!)
  // English reads the week's end on a twelve-hour clock.
  const hour = getLanguage() === 'en' ? h % 12 || 12 : h
  return t(m === '00' ? 'gauge.week' : 'gauge.weekMinutes', { day, h: hour, m, period: h < 12 ? 'am' : 'pm' })
}

export function gauge(list: readonly Limit[], kind: LimitKind, now: number): Gauge {
  const label = t(LABEL[kind]) as Gauge['label']
  const reading = list.find(l => l.kind === kind)
  if (!reading) return { label, ...EMPTY }
  const end = reading.resetsAt ? Date.parse(reading.resetsAt) : NaN
  const known = !Number.isNaN(end)
  if (known && end <= now) return { label, ...EMPTY }
  const mark = known ? Math.max(0, Math.min(100, (1 - (end - now) / SPAN[kind]) * 100)) : null
  return {
    label,
    used: Math.max(0, Math.min(100, reading.percentUsed)),
    mark,
    percent: `${Math.round(reading.percentUsed)}%`,
    at: known ? resetText(kind === 'five_hour', end) : '--:--',
  }
}

// ---------- The sober look: a gauge for each limit the account sends ----------

/** A gauge of the sober card. `mark`, `left` and `at` are unknown without a reset time. */
/** `over`: how far past the ideal pace, `+9 %`; empty while on or under it, or with no pace known. */
export type SoberGauge = { kind: string; label: string; used: number; mark: number | null; percent: string; over: string; left: string; at: string }

const MINUTE = 60_000
// The models a week of its own can be kept for. The account names such a week after its model, `seven_day_fable`
// today; any name that holds a model and says it is a week is taken, so a new spelling still shows.
const MODELS = ['fable', 'mythos', 'opus', 'sonnet', 'haiku'] as const
const modelOf = (kind: string) => (/seven_day|week/.test(kind) ? MODELS.find(name => kind.split(/[^a-z0-9]+/).includes(name)) : undefined)
// Left to right, whatever order the engine sends them in: the five hours, each week of its own, the week of all.
const rank = (kind: string) => (kind === 'five_hour' ? 0 : kind === 'seven_day' ? 2 : 1)

/** How far past the pace, in whole points: `+9 %`. Nothing under a point, on the pace or under it. */
function overText(used: number, mark: number | null) {
  if (mark === null) return ''
  const over = Math.round(Math.min(100, used) - Math.max(0, Math.min(100, mark)))
  return over >= 1 ? t('sober.over', { n: over }) : ''
}

/** The time left, as short as it reads: `3j 4h32`, `4h32`, `32min`. Never less than a minute. */
export function countdown(ms: number) {
  const total = Math.max(1, Math.ceil(ms / MINUTE))
  const d = Math.floor(total / 1440)
  const h = Math.floor((total % 1440) / 60)
  const m = String(total % 60).padStart(2, '0')
  if (d) return t('left.days', { d, h, m })
  if (h) return t('left.hours', { h, m })
  return t('left.minutes', { m: total % 60 })
}

function soberLabel(kind: string) {
  if (kind === 'seven_day') return t('sober.week')
  if (kind === 'five_hour') return t('sober.five')
  const model = modelOf(kind)!
  return t('sober.weekOf', { name: model.charAt(0).toUpperCase() + model.slice(1) })
}

/**
 * One gauge for each window the account has: the five hours, then each week of its own, then the week.
 * A window the engine does not send, or one past its reset, has none; neither has a kind that is no such window.
 */
export function soberGauges(list: readonly Limit[], now: number): SoberGauge[] {
  const seen = new Set<string>()
  const kept = list.filter(l => {
    if (seen.has(l.kind) || !(l.kind === 'seven_day' || l.kind === 'five_hour' || modelOf(l.kind))) return false
    seen.add(l.kind)
    const end = l.resetsAt ? Date.parse(l.resetsAt) : NaN
    return Number.isNaN(end) || end > now
  })
  return [...kept].sort((a, b) => rank(a.kind) - rank(b.kind)).map(l => {
    // To the nearest minute: the account may say 8:59:59.8 for a reset at nine.
    const end = l.resetsAt ? Math.round(Date.parse(l.resetsAt) / MINUTE) * MINUTE : NaN
    const known = !Number.isNaN(end)
    const fiveHour = l.kind === 'five_hour'
    const span = fiveHour ? SPAN.five_hour : SPAN.seven_day
    return {
      kind: l.kind,
      label: soberLabel(l.kind),
      used: Math.max(0, Math.min(100, l.percentUsed)),
      mark: known ? Math.max(0, Math.min(100, (1 - (end - now) / span) * 100)) : null,
      percent: t('sober.percent', { n: Math.round(l.percentUsed) }),
      over: overText(l.percentUsed, known ? (1 - (end - now) / span) * 100 : null),
      left: known ? countdown(end - now) : '',
      at: known ? resetText(fiveHour, end) : '',
    }
  })
}
