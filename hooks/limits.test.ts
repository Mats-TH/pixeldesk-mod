import { expect, test } from 'claude-code/testing'

import { gauge } from './limits'

const HOUR = 3_600_000
const NOW = Date.parse('2026-10-30T10:00:00Z')
const at = (ms: number) => new Date(ms).toISOString()

test('the mark follows the time spent in the window', async () => {
  const start = gauge([{ kind: 'five_hour', percentUsed: 10, resetsAt: at(NOW + 5 * HOUR) }], 'five_hour', NOW)
  expect(start.mark, 'start').toBe(0)
  const middle = gauge([{ kind: 'five_hour', percentUsed: 10, resetsAt: at(NOW + 2.5 * HOUR) }], 'five_hour', NOW)
  expect(middle.mark, 'middle').toBe(50)
  const week = gauge([{ kind: 'seven_day', percentUsed: 10, resetsAt: at(NOW + 84 * HOUR) }], 'seven_day', NOW)
  expect(week.mark, 'mid-week').toBe(50)
})

test('with no reading, or a past reset, the gauge stays empty', async () => {
  const none = gauge([], 'five_hour', NOW)
  expect(none.used, 'missing').toBe(null)
  expect(none.percent, 'missing').toBe('--')
  expect(none.at, 'missing').toBe('--:--')
  const old = gauge([{ kind: 'five_hour', percentUsed: 40, resetsAt: at(NOW - HOUR) }], 'five_hour', NOW)
  expect(old.used, 'past').toBe(null)
})

test('the percentage is rounded and the fill capped at 100', async () => {
  const over = gauge([{ kind: 'five_hour', percentUsed: 104.6, resetsAt: at(NOW + HOUR) }], 'five_hour', NOW)
  expect(over.used, 'capped').toBe(100)
  expect(over.percent, 'shown').toBe('105%')
})

test('with no reset time the percentage stays and the mark goes', async () => {
  const g = gauge([{ kind: 'seven_day', percentUsed: 12 }], 'seven_day', NOW)
  expect(g.used, 'used').toBe(12)
  expect(g.mark, 'mark').toBe(null)
  expect(g.at, 'hour').toBe('--:--')
})

test('a short hour for the 5 h gauge, day and hour for the weekly one', async () => {
  const short = gauge([{ kind: 'five_hour', percentUsed: 1, resetsAt: at(NOW + HOUR) }], 'five_hour', NOW)
  expect(/^\d\d:\d\d$/.test(short.at), short.at).toBe(true)
  const long = gauge([{ kind: 'seven_day', percentUsed: 1, resetsAt: at(NOW + 48 * HOUR) }], 'seven_day', NOW)
  expect(/^(lun|mar|mer|jeu|ven|sam|dim) \d+h(\d\d)?$/.test(long.at), long.at).toBe(true)
})
