import { describe, expect, test } from 'claude-code/testing'

import { NOON, ROOT, start, world } from './test-kit'

const LIMITS_FILE = `${ROOT}/state/limits.json`
const FRIDAY = new Date(2026, 9, 30, 9, 0).toISOString()
const WEEK = { kind: 'seven_day', percentUsed: 42, resetsAt: FRIDAY }

describe('the limits are shared between the conversations', () => {
  test('a reading of its own is shown and left on disk for the others', async ($, on) => {
    const w = world(on, { limits: [WEEK] })
    await start($)
    expect(w.state.limits).toEqual([WEEK])
    expect(w.json(LIMITS_FILE)).toEqual({ at: NOON, limits: [WEEK] })
  })

  test('with none of its own yet, a conversation shows the one another left', async ($, on) => {
    const w = world(on, { files: { [LIMITS_FILE]: JSON.stringify({ at: NOON - 60_000, limits: [WEEK] }) } })
    await start($)
    expect(w.state.limits).toEqual([WEEK])
  })

  test('a newer reading from another conversation comes in on the beat; an older one never replaces its own', async ($, on) => {
    const w = world(on, { limits: [WEEK] })
    await start($)
    const older = { ...WEEK, percentUsed: 10 }
    w.files.set(LIMITS_FILE, JSON.stringify({ at: NOON - 60_000, limits: [older] }))
    await w.clock.advance(5000)
    expect(w.state.limits).toEqual([WEEK])
    const newer = { ...WEEK, percentUsed: 55 }
    w.files.set(LIMITS_FILE, JSON.stringify({ at: NOON + 4000, limits: [newer] }))
    await w.clock.advance(5000)
    expect(w.state.limits).toEqual([newer])
  })

  test('each measure of its own is shared; an empty one clears the gauges and leaves the file alone', async ($, on) => {
    const w = world(on, { limits: [WEEK] })
    await start($)
    const next = [{ ...WEEK, percentUsed: 60 }]
    await $.session.measure({ context: {} as never, rateLimits: next, changed: [] })
    expect(w.json(LIMITS_FILE).limits).toEqual(next)
    await $.session.measure({ context: {} as never, rateLimits: [], changed: [] })
    expect(w.state.limits).toEqual([])
    expect(w.json(LIMITS_FILE).limits).toEqual(next)
  })

  test('a broken file is left aside', async ($, on) => {
    const w = world(on, { files: { [LIMITS_FILE]: '{not json' } })
    await start($)
    expect(w.state.limits ?? []).toEqual([])
  })
})
