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

function resetText(kind: LimitKind, end: number) {
  const date = new Date(end)
  const h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  if (kind === 'five_hour') return `${String(h).padStart(2, '0')}:${m}`
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
    at: known ? resetText(kind, end) : '--:--',
  }
}
