import { describe, expect, test } from 'claude-code/testing'

import { accountLimits, accountShape } from './account-limits'
import { soberGauges } from './limits'
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

  test('a conversation asks once as it opens, then leaves it to whichever asked in the last three minutes', async ($, on) => {
    const shared = { at: NOON - 60_000, accountAt: NOON - 60_000, limits: [{ kind: 'seven_day_fable', percentUsed: 30, resetsAt: FRIDAY }] }
    const w = world(on, { account: { status: 200, text: ANSWER }, files: { [LIMITS_FILE]: JSON.stringify(shared) } })
    await start($)
    await settle()
    expect(w.fetches).toHaveLength(1)
    const later = { at: NOON + 60_000, accountAt: NOON + 60_000, limits: shared.limits }
    w.files.set(LIMITS_FILE, JSON.stringify(later))
    await w.clock.advance(185_000)
    await settle()
    expect(w.fetches).toHaveLength(1)
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

describe("the account's answer, wherever a window lies", () => {
  test('a window told inside its object reads by its path and its naming words', () => {
    const text = JSON.stringify({ seven_day: { utilization: 12, resets_at: FRIDAY }, limits: [{ model: 'Fable', window: 'seven_day', utilization: 40.04, resets_at: FRIDAY }], seven_day_opus: null })
    expect(accountLimits(text).map(l => [l.kind, l.percentUsed])).toEqual([['seven_day', 12], ['limits_fable_seven_day', 40]])
    expect(accountShape(text)).toBe('{seven_day:{utilization:number,resets_at:string},limits:[{model:string,window:string,utilization:number,resets_at:string}],seven_day_opus:null}')
    expect(accountShape(text)).not.toContain('40')
  })
})

describe("the account's list of limits", () => {
  const LIST = JSON.stringify({
    seven_day: { utilization: 12, resets_at: FRIDAY },
    limits: [
      { kind: 'weekly', group: 'all_models', percent: 12, severity: 'ok', resets_at: FRIDAY, scope: null, is_active: true },
      { kind: 'weekly', group: 'fable', percent: 41.26, severity: 'ok', resets_at: FRIDAY, scope: null, is_active: true },
    ],
    seven_day_breakdown: { as_of: FRIDAY, rows: [{ key: 'fable', display_name: 'Fable', percent: 30, percent_of_limit: 40 }] },
  })

  test("an item of the list reads by its kind and its group; a breakdown row with no reset is no window", () => {
    expect(accountLimits(LIST).map(l => [l.kind, l.percentUsed])).toEqual([
      ['seven_day', 12],
      ['limits_weekly_all_models', 12],
      ['limits_weekly_fable', 41.3],
    ])
  })

  test("Fable's week of the list shows on the card, and the week of all once", () => {
    expect(soberGauges(accountLimits(LIST), NOON).map(g => g.label)).toEqual(['Fable hebdo', 'Hebdo'])
  })

  test('the labels of the list go to the log as they are, the figures never', () => {
    const shape = accountShape(LIST)
    expect(shape).toContain('kind:"weekly",group:"fable",percent:number')
    expect(shape).toContain('display_name:"Fable"')
    expect(shape).not.toContain('41')
  })
})

describe("the account as it answers today", () => {
  // The answer of a real account, its figures changed: the week of all, and a week scoped to Fable.
  const REAL = JSON.stringify({
    five_hour: null,
    seven_day: { utilization: 13, resets_at: '2026-11-27T08:00:00.490432+00:00', limit_dollars: null },
    seven_day_opus: null,
    limits: [
      { kind: 'weekly_all', group: 'weekly', percent: 13, severity: 'normal', resets_at: '2026-11-27T08:00:00.490432+00:00', scope: null, is_active: true },
      { kind: 'weekly_scoped', group: 'weekly', percent: 21, severity: 'normal', resets_at: '2026-11-27T08:00:00.490575+00:00', scope: { model: { id: 'claude-fable-5-2', display_name: 'Fable' }, surface: null }, is_active: true },
    ],
    weekly_scoped_shares: [{ limit_index: 1, used_percent_of_weekly: 10, allowance_percent_of_weekly: 50 }],
  })

  test('the week scoped to Fable reads as the week of Fable, beside the week of all, as /usage shows them', () => {
    const now = Date.parse('2026-11-20T18:00:00Z')
    expect(soberGauges(accountLimits(REAL), now).map(g => [g.label, g.percent])).toEqual([['Fable hebdo', '21 %'], ['Hebdo', '13 %']])
  })
})

describe('the time of a reset', () => {
  test('reads to the nearest minute: a reset the account puts a fraction of a second before nine reads nine', () => {
    const [early] = soberGauges([{ kind: 'seven_day', percentUsed: 21, resetsAt: '2026-11-27T07:59:59.817982+00:00' }], Date.parse('2026-11-20T18:00:00Z'))
    expect(early?.at.replace(/\u00A0/g, ' ')).toBe('ven 9h')
  })
})

describe('how far past the pace', () => {
  // Tuesday noon, a week that ends Friday at nine: the ideal pace stands at 58.9 %.
  const at = (percentUsed: number) => soberGauges([{ kind: 'seven_day', percentUsed, resetsAt: new Date(2026, 9, 30, 9, 0).toISOString() }], NOON)[0]!

  test('past the pace it says by how much, in whole points; on it or under it, nothing', () => {
    expect(at(71).over.replace(/\u00A0/g, ' ')).toBe('+12 %')
    expect(at(59).over).toBe('')
    expect(at(42).over).toBe('')
  })

  test('without a reset there is no pace, so no overrun', () => {
    expect(soberGauges([{ kind: 'seven_day', percentUsed: 90 }], NOON)[0]!.over).toBe('')
  })
})
