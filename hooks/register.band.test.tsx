import { describe, expect, test } from 'claude-code/testing'

import { BENEATH, NOON, PLAN_FILE, altOf, hasKey, kids, mountBand, receive, sendPlan, sourceOf, spawn, start, step, submit, textsOf, world } from './test-kit'
import type { World } from './test-kit'
import { idleSvg } from './band'
import { gauge } from './limits'

const KID = (id: string, more: Record<string, unknown> = {}) => JSON.stringify({ sessionId: id, title: '', agents: 0, working: 0, summary: '', updatedAt: NOON, cwd: 'C:/work/app', desks: [], steps: [], tokens: 0, ...more })
const DESK = (id: string) => `/Users/test/.claude/pixeldesk/state/desk-${id}.json`

/** A conversation with a child on the floor: both files on disk, read by the first beat. */
const withKid = (more: Record<string, unknown> = {}) => ({ files: { [DESK('kid')]: KID('kid', more) } })

const beat = (w: World) => w.clock.advance(5000)

const LIMITS = [
  { kind: 'five_hour', percentUsed: 50, resetsAt: new Date(2026, 9, 27, 14, 0).toISOString() },
  { kind: 'seven_day', percentUsed: 12, resetsAt: new Date(2026, 9, 30, 9, 0).toISOString() },
]

const allText = (el: any): string => (typeof el === 'string' ? el : (el?.children ?? []).map(allText).join(''))
const flatten = (el: any): any[] => (typeof el === 'object' && el !== null ? [el, ...(el.children ?? []).flatMap(flatten)] : [])
const paints = (el: any, mark: string) => flatten(el).filter(node => node.type === 'Text' && node.children?.[0] === mark)

describe('choosing the case', () => {
  for (const surface of ['desktop', 'terminal'] as const) {
    test(`an open plan comes first on ${surface}, then the overview, then the finished plan, then rest`, async ($, on) => {
      const w = world(on, withKid())
      await start($, surface)
      await sendPlan($, [step('One', 'in_progress')], 'Job')
      await beat(w)
      const ui = await mountBand($, surface)
      expect(await hasKey(ui, 'plan-band')).toBe(true)
      await sendPlan($, [step('One', 'completed')], 'Job')
      await beat(w)
      expect(await hasKey(ui, 'overview-band')).toBe(true)
    })

    test(`with no child a finished plan stays on ${surface}`, async ($, on) => {
      world(on)
      await start($, surface)
      await sendPlan($, [step('One', 'completed')], 'Job')
      const ui = await mountBand($, surface)
      expect(await hasKey(ui, 'plan-band')).toBe(true)
      expect(await hasKey(ui, 'overview-band')).toBe(false)
    })

    test(`and a finished plan read from disk too on ${surface}`, async ($, on) => {
      world(on, { files: { [PLAN_FILE]: '{"title":"Old","steps":[{"text":"One","status":"completed"}]}' } })
      await start($, surface)
      const ui = await mountBand($, surface)
      expect(await hasKey(ui, 'plan-band')).toBe(true)
    })

    test(`an empty plan rests on ${surface}`, async ($, on) => {
      world(on)
      await start($, surface)
      await sendPlan($, [])
      const ui = await mountBand($, surface)
      expect(await hasKey(ui, 'idle-band')).toBe(true)
    })

    test(`a survey takes the place on ${surface}`, async ($, on) => {
      world(on)
      await start($, surface)
      const ui = await mountBand($, surface, { hasSurvey: true })
      expect(await textsOf(ui)).toEqual([BENEATH])
      expect(await hasKey(ui, 'idle-band')).toBe(false)
    })

    test(`another mod's drawing stays above the band on ${surface}`, async ($, on) => {
      const w = world(on)
      await start($, surface)
      const ui = await mountBand($, surface)
      const root = await ui.drawn()
      expect(kids(root)[0].children).toEqual([BENEATH])
      expect(await hasKey(ui, 'idle-band')).toBe(true)
      w.beneath = 'engine'
      await ui.redraw()
      expect(await ui.find({ text: BENEATH })).toBeUndefined()
      expect(JSON.stringify(await ui.drawn())).not.toContain('"engine"')
    })

    test(`a failed drawing beneath is ignored on ${surface}`, async ($, on) => {
      const w = world(on)
      w.beneath = 'broken'
      await start($, surface)
      const ui = await mountBand($, surface)
      expect(await hasKey(ui, 'idle-band')).toBe(true)
    })

    test(`an agent adds nothing, and there is no cross on ${surface}`, async ($, on) => {
      const w = world(on)
      await start($, surface)
      await sendPlan($, [step('One', 'in_progress')], 'Job')
      const ui = await mountBand($, surface)
      const before = JSON.stringify(await ui.drawn())
      await spawn($, w, 'a1')
      expect(JSON.stringify(await ui.drawn())).toBe(before)
      expect(await hasKey(ui, 'plan-dismiss')).toBe(false)
      expect(await ui.findAll({ type: 'Button' })).toEqual([])
    })
  }
})

describe('the band on the desktop', () => {
  test('a drawing 80 high, its box over the card\'s padding, in a clear column', async ($, on) => {
    const w = world(on)
    w.beneath = 'engine'
    await start($)
    await sendPlan($, [step('One', 'in_progress')], 'Job')
    const ui = await mountBand($, 'desktop', { bodyColumns: 100 })
    const root = await ui.drawn()
    expect(root.props).toMatchObject({ flexDirection: 'column', backgroundColor: 'transparent' })
    expect((await ui.find({ key: 'plan-band' }))?.props).toMatchObject({ marginX: -1, marginTop: -1, marginBottom: -1 })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg?.props).toMatchObject({ width: 800, height: 80, isInteractive: true })
    expect(svg?.props.source).toContain('shape-rendering="crispEdges"')
  })

  for (const [columns, width] of [[0, 800], [10, 420], [1000, 1600]] as const) {
    test(`${columns} columns make ${width} px`, async ($, on) => {
      world(on)
      await start($)
      const ui = await mountBand($, 'desktop', { bodyColumns: columns })
      expect((await ui.find({ type: 'Svg' }))?.props.width).toBe(width)
    })
  }

  test('the alternative gives title, count, percent, step and limits', async ($, on) => {
    world(on, { limits: LIMITS })
    await start($)
    await sendPlan($, [step('One', 'completed'), step('Two', 'in_progress')], 'Job')
    const ui = await mountBand($)
    expect(await altOf(ui)).toBe('Job : Tâches 1/2, 50%. En cours : Two. 5 H 50% 14:00, 7 J 12% ven 9h')
  })

  for (const [hour, night] of [[19, false], [20, true], [6, true], [7, false]] as const) {
    test(`at ${hour} h it is ${night ? 'night' : 'day'}`, async ($, on) => {
      const now = new Date(2026, 9, 27, hour, 0).getTime()
      world(on, { now })
      await start($)
      const ui = await mountBand($)
      const gauges: [ReturnType<typeof gauge>, ReturnType<typeof gauge>] = [gauge([], 'five_hour', now), gauge([], 'seven_day', now)]
      expect(await sourceOf(ui)).toBe(idleSvg({ gauges, width: 800, night }))
    })
  }

  test('rest keeps its source to the character', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountBand($)
    const source = await sourceOf(ui)
    await ui.redraw()
    await w.clock.advance(30_000)
    await ui.redraw()
    expect(await sourceOf(ui)).toBe(source)
    expect(source).toContain('animate')
  })

  test('the alternative of rest does not move either', async ($, on) => {
    const w = world(on, { limits: LIMITS })
    await start($)
    const ui = await mountBand($)
    const alt = await altOf(ui)
    await w.clock.advance(60_000)
    expect(await altOf(ui)).toBe(alt)
    expect(alt).toBe('Au repos. 5 H 50% 14:00, 7 J 12% ven 9h')
  })

  test('the overview counts the news at once, and drops them when the person writes', async ($, on) => {
    const w = world(on, withKid())
    await start($)
    await beat(w)
    const ui = await mountBand($)
    await receive($)
    expect(await altOf(ui)).toContain('1 nouvelle.')
    expect(w.state.news).toEqual({ count: 1, shown: 0 })
    await submit($)
    expect(await altOf(ui)).not.toContain('nouvelle')
  })

  test('the overview counts the children only, older rooms included', async ($, on) => {
    const w = world(on, withKid({ working: 2, agents: 2 }))
    await start($)
    await beat(w)
    const ui = await mountBand($)
    expect(await altOf(ui)).toContain('Vue d’ensemble : 1 conversation sur 1 au travail, 2 agents.')
  })
})

describe('the band in the terminal', () => {
  const planBand = async ($: any, on: any, steps: any[], columns = 80, title = 'Job') => {
    const w = world(on, { limits: LIMITS })
    await start($, 'terminal')
    await sendPlan($, steps, title)
    const ui = await mountBand($, 'terminal', { bodyColumns: columns })
    return { w, ui, band: await ui.find({ key: 'plan-band' }) }
  }

  test('no drawing at all; width 30 when it is unknown', async ($, on) => {
    world(on, { limits: LIMITS })
    await start($, 'terminal')
    const ui = await mountBand($, 'terminal', { bodyColumns: 0 })
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    const row = await ui.find({ key: 'gauge-5 H' })
    expect(allText(kids(row)[1])).toHaveLength(8)
  })

  test('the row: a dot, the title, the bar, the tasks, the percent with no space', async ($, on) => {
    const { band } = await planBand($, on, [step('One', 'completed'), step('Two', 'in_progress')])
    const [dot, title, , tasks, percent] = kids(kids(band)[0])
    expect(dot).toMatchObject({ children: ['●'], props: { color: '#6d28d9' } })
    expect(title).toMatchObject({ children: ['Job'], props: { bold: true } })
    expect(tasks).toMatchObject({ children: ['Tâches 1/2'], props: { bold: true, color: '#8b5cf6' } })
    expect(percent).toMatchObject({ children: ['50%'], props: { dimColor: true } })
  })

  test('the title takes a third of the width, cut with an ellipsis', async ($, on) => {
    const { band } = await planBand($, on, [step('One', 'pending')], 60, 'A very long title for a very small band')
    expect(kids(kids(band)[0])[1].children[0]).toBe(`${'A very long title f'}…`)
  })

  test('at most 28 columns, at least 6', async ($, on) => {
    const wide = await planBand($, on, [step('One', 'pending')], 200, 'x'.repeat(50))
    expect(kids(kids(wide.band)[0])[1].children[0]).toHaveLength(28)
    const narrow = await mountBand($, 'terminal', { bodyColumns: 12 })
    expect(kids(kids(await narrow.find({ key: 'plan-band' }))[0])[1].children[0]).toHaveLength(6)
  })

  test('full blocks for what is done, then the step at work, then the rest', async ($, on) => {
    const { band } = await planBand($, on, [step('A', 'completed'), step('B', 'in_progress'), step('C', 'pending'), step('D', 'pending')], 80)
    const bar = kids(kids(band)[0])[2]
    const width = 80 - 'Job'.length - 'Tâches 1/4'.length - '25%'.length - 10
    const drawn = allText(bar)
    expect(drawn).toHaveLength(width)
    const full = Math.round(width / 4)
    const warm = Math.round(width / 2) - full
    expect(drawn).toBe(`${'█'.repeat(full)}${'▓'.repeat(warm)}${'░'.repeat(width - full - warm)}`)
    expect(flatten(bar).find(node => node.children?.[0]?.startsWith?.('░'))?.props.dimColor).toBe(true)
  })

  test('a very tight bar keeps six cells', async ($, on) => {
    const { band } = await planBand($, on, [step('A', 'pending')], 20)
    expect(allText(kids(kids(band)[0])[2])).toHaveLength(6)
  })

  test('the full blocks run from light to dark', async ($, on) => {
    const { band } = await planBand($, on, [step('A', 'completed'), step('B', 'pending')], 80)
    const cells = paints(kids(band)[0], '█')
    expect(cells[0].props.color.toLowerCase()).toBe('#c4b5fd')
    expect(cells[cells.length - 1].props.color.toLowerCase()).toBe('#6d28d9')
  })

  test('the step at work shimmers every 350 ms, between two violets', async ($, on) => {
    const { w, ui } = await planBand($, on, [step('A', 'in_progress'), step('B', 'pending')], 80)
    const colors = async () => paints(await ui.find({ key: 'plan-band' }), '▓').map(cell => cell.props.color)
    const before = await colors()
    expect([...new Set(before)].sort()).toEqual(['#8b5cf6', '#c4b5fd'])
    await w.clock.advance(350)
    expect(await colors()).not.toEqual(before)
    await w.clock.advance(350)
    expect(await colors()).toEqual(before)
  })

  test('no shimmer with no step at work', async ($, on) => {
    const { w } = await planBand($, on, [step('A', 'pending')], 80)
    await w.clock.advance(700)
    expect(w.state.shimmer).toBeUndefined()
  })

  test('the shimmer stops when the step ends', async ($, on) => {
    const { w } = await planBand($, on, [step('A', 'in_progress')], 80)
    await w.clock.advance(350)
    await sendPlan($, [step('A', 'pending')], 'Job')
    const at = w.state.shimmer
    await w.clock.advance(1050)
    expect(w.state.shimmer).toBe(at)
  })

  for (const [steps, line] of [
    [[step('A', 'completed'), step('B', 'in_progress')], 'En cours : B'],
    [[step('A', 'completed'), step('B', 'pending')], 'Ensuite : B'],
    [[step('A', 'completed')], 'Toutes les étapes sont faites'],
  ] as const) {
    test(`"${line}" under the row`, async ($, on) => {
      const { band } = await planBand($, on, [...steps], 80)
      expect(kids(band)[1]).toMatchObject({ children: [line], props: { dimColor: true } })
    })
  }

  test('the line is cut to the width', async ($, on) => {
    const { band } = await planBand($, on, [step('x'.repeat(100), 'in_progress')], 40)
    expect(kids(band)[1].children[0]).toHaveLength(40)
  })

  test('each case ends with a row per gauge: the marker, past it, before it', async ($, on) => {
    const windows = [{ kind: 'five_hour', percentUsed: 80, resetsAt: new Date(NOON + 2.5 * 3_600_000).toISOString() }]
    const w = world(on, { limits: windows })
    await start($, 'terminal')
    const ui = await mountBand($, 'terminal', { bodyColumns: 46 })
    const row = await ui.find({ key: 'gauge-5 H' })
    const [label, meter, percent, at] = kids(row)
    expect(label).toMatchObject({ children: ['5 H'], props: { dimColor: true } })
    expect(allText(meter)).toHaveLength(24)
    expect(percent.children).toEqual(['80%'])
    expect(at).toMatchObject({ children: ['14:30'], props: { dimColor: true } })
    const cells = kids(meter)
    expect(cells[12]).toMatchObject({ children: ['│'], props: { color: '#eab308' } })
    expect(cells[0].props.color).toBe('#16a34a')
    expect(cells[13].props.color).toBe('#d97757')
    expect(cells[23]).toMatchObject({ children: ['░'], props: { dimColor: true } })
    expect(w.state.limits).toEqual(windows)
  })

  test('the gauge never goes under 6 cells nor over 24', async ($, on) => {
    world(on, { limits: LIMITS })
    await start($, 'terminal')
    const tight = await mountBand($, 'terminal', { bodyColumns: 20 })
    expect(allText(kids(await tight.find({ key: 'gauge-5 H' }))[1])).toHaveLength(6)
    const wide = await mountBand($, 'terminal', { bodyColumns: 300 })
    expect(allText(kids(await wide.find({ key: 'gauge-5 H' }))[1])).toHaveLength(24)
  })

  test('the overview: a title, a square per child, the news, the line, the gauges', async ($, on) => {
    const w = world(on, withKid({ working: 1, agents: 1 }))
    await start($, 'terminal')
    await beat(w)
    await receive($)
    const ui = await mountBand($, 'terminal')
    const band = await ui.find({ key: 'overview-band' })
    const [head, line] = kids(band)
    const [title, cells, news] = kids(head)
    expect(title).toMatchObject({ children: ['Vue d’ensemble'], props: { bold: true } })
    expect(allText(cells)).toBe('■')
    expect(news).toMatchObject({ children: ['1'], props: { color: '#d97757' } })
    expect(line).toMatchObject({ children: ['1 conversation sur 1 au travail, 1 agent'], props: { dimColor: true } })
    expect(await hasKey(ui, 'gauge-5 H')).toBe(true)
    expect(await hasKey(ui, 'gauge-7 J')).toBe(true)
  })

  test('rest says so, then the gauges', async ($, on) => {
    world(on)
    await start($, 'terminal')
    const ui = await mountBand($, 'terminal')
    const band = await ui.find({ key: 'idle-band' })
    expect(kids(band)[0]).toMatchObject({ children: ['Au repos'], props: { bold: true } })
    expect(await hasKey(ui, 'gauge-5 H')).toBe(true)
    expect(await hasKey(ui, 'gauge-7 J')).toBe(true)
  })
})

describe('the limits', () => {
  test('the state follows the start, then each measure', async ($, on) => {
    const w = world(on, { limits: LIMITS })
    await start($)
    expect(w.state.limits).toEqual(LIMITS)
    const next = [{ kind: 'five_hour', percentUsed: 60 }]
    await $.session.measure({ context: {} as never, rateLimits: next, changed: [] })
    expect(w.state.limits).toEqual(next)
  })

  test('both gauges are always there, empty ones saying so', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountBand($)
    expect(await altOf(ui)).toBe('Au repos. 5 H -- --:--, 7 J -- --:--')
  })

  test('the minute counter redraws the marks', async ($, on) => {
    const w = world(on, { limits: LIMITS })
    await start($)
    const ui = await mountBand($)
    const source = await sourceOf(ui)
    await w.clock.advance(30 * 60_000)
    expect(await sourceOf(ui)).not.toBe(source)
  })
})

describe('a band under another mod', () => {
  const CASES = [
    ['plan-band', async ($: any) => sendPlan($, [step('One', 'in_progress')], 'Job')],
    ['idle-band', async () => undefined],
  ] as const

  for (const [key, set] of CASES) {
    test(`${key} leaves it whole: top margin 1 under a drawing`, async ($, on) => {
      world(on)
      await start($)
      await set($)
      const ui = await mountBand($, 'desktop')
      expect((await ui.find({ key }))?.props).toMatchObject({ marginTop: 1, marginBottom: -1, marginX: -1 })
      expect(await textsOf(ui)).toContain(BENEATH)
    })

    test(`${key}: an empty box shows nothing`, async ($, on) => {
      const w = world(on)
      w.beneath = 'empty'
      await start($)
      await set($)
      const ui = await mountBand($, 'desktop')
      expect((await ui.find({ key }))?.props.marginTop).toBe(-1)
    })

    test(`${key}: the engine's fallback shows nothing`, async ($, on) => {
      const w = world(on)
      w.beneath = 'engine'
      await start($)
      await set($)
      const ui = await mountBand($, 'desktop')
      expect((await ui.find({ key }))?.props.marginTop).toBe(-1)
    })
  }

  test('the overview too', async ($, on) => {
    const kid = JSON.stringify({ sessionId: 'kid', title: '', agents: 0, working: 0, summary: '', updatedAt: NOON, cwd: 'C:/work/app', desks: [], steps: [], tokens: 0 })
    const w = world(on, { files: { '/Users/test/.claude/pixeldesk/state/desk-kid.json': kid } })
    await start($)
    await w.clock.advance(5000)
    const ui = await mountBand($, 'desktop')
    expect((await ui.find({ key: 'overview-band' }))?.props).toMatchObject({ marginTop: 1, marginBottom: -1 })
  })
})
