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

describe("the account's own figures", () => {
  const FABLE_WEEK = { utilization: 37.25, resets_at: FRIDAY }
  const ANSWER = JSON.stringify({ five_hour: null, seven_day: { utilization: 12, resets_at: FRIDAY }, seven_day_fable: FABLE_WEEK, seven_day_oauth_apps: null, extra_usage: { is_enabled: false } })
  const settle = async () => {
    const later = (globalThis as any).setTimeout as (fn: () => void, ms: number) => void
    for (let i = 0; i < 20; i++) await new Promise<void>(resolve => later(resolve, 0))
  }

  test("the week of a model comes from the account, through the session's credential, and goes to the log by name", async ($, on) => {
    const w = world(on, { account: { status: 200, text: ANSWER } })
    await start($)
    await settle()
    expect(w.fetches).toHaveLength(1)
    expect(w.fetches[0]).toMatchObject({ url: 'https://api.anthropic.com/api/oauth/usage', init: { auth: 'handle-1', headers: { 'anthropic-beta': 'oauth-2025-04-20' } } })
    expect(w.state.limits).toEqual([
      { kind: 'seven_day', percentUsed: 12, resetsAt: FRIDAY },
      { kind: 'seven_day_fable', percentUsed: 37.3, resetsAt: FRIDAY },
    ])
    expect(w.log()).toContain('account windows: seven_day, seven_day_fable')
    expect(w.log()).not.toContain('37')
  })

  test("the engine's measure keeps the model's week it does not know", async ($, on) => {
    const w = world(on, { account: { status: 200, text: ANSWER } })
    await start($)
    await settle()
    await $.session.measure({ context: {} as never, rateLimits: [{ kind: 'seven_day', percentUsed: 13, resetsAt: FRIDAY }], changed: [] })
    expect(w.state.limits.map((l: any) => [l.kind, l.percentUsed])).toEqual([['seven_day', 13], ['seven_day_fable', 37.3]])
  })

  test('asked no more than every three minutes, whichever conversation asked', async ($, on) => {
    const w = world(on, { account: { status: 200, text: ANSWER } })
    await start($)
    await settle()
    await w.clock.advance(60_000)
    await settle()
    expect(w.fetches).toHaveLength(1)
    await w.clock.advance(125_000)
    await settle()
    expect(w.fetches).toHaveLength(2)
  })

  test('another conversation asked a minute ago: this one takes its figures and asks nothing', async ($, on) => {
    const shared = { at: NOON - 60_000, accountAt: NOON - 60_000, limits: [{ kind: 'seven_day_fable', percentUsed: 30, resetsAt: FRIDAY }] }
    const w = world(on, { account: { status: 200, text: ANSWER }, files: { [LIMITS_FILE]: JSON.stringify(shared) } })
    await start($)
    await settle()
    expect(w.fetches).toHaveLength(0)
    expect(w.state.limits).toEqual(shared.limits)
  })

  test('with no sign-in to ask with nothing is sent; a refusal goes to the log once and changes nothing', async ($, on) => {
    const none = world(on)
    await start($)
    await settle()
    expect(none.fetches).toHaveLength(0)
  })

  test('a refusal goes to the log once, and the gauges keep what they had', async ($, on) => {
    const w = world(on, { limits: [WEEK], account: { status: 401, text: '{"error":"no"}' } })
    await start($)
    await settle()
    expect(w.state.limits).toEqual([WEEK])
    expect(w.log()).toContain('account usage: status 401')
  })
})
