import { describe, expect, test } from 'claude-code/testing'

import { FIVE, hearthWorld } from './test-hearth'
import { callTool, command, endTurn, hasKey, kids, mountPane, sendPlan, sourceOf, spawn, start, startTurn, step, usage } from './test-kit'

type Loose = any
type Seen = { changed: string[]; born: string[]; gone: string[] }

// What a first arrival moves: the room goes from the size of a lone desk to the size of a room with agents.
const REFRAMED = ['live-lights', 'live-cat', 'live-manager', 'live-crab']

/** Every iframe of a drawing, by the key of its Box. */
function framesIn(el: Loose, found = new Map<string, string>()) {
  for (const kid of kids(el)) {
    if (kid.type === 'Svg' && kid.props.isInteractive) found.set(el.props.key, kid.props.source)
    framesIn(kid, found)
  }
  return found
}

/** After each thing that happens, what became of the iframes: a source that changed reloads a frame. */
function watch(ui: Loose) {
  let last = new Map<string, string>()
  return async (): Promise<Seen> => {
    await ui.redraw()
    const now = framesIn(await ui.drawn())
    const seen = { changed: [...now].filter(([key, source]) => last.has(key) && last.get(key) !== source).map(([key]) => key), born: [...now.keys()].filter(key => !last.has(key)), gone: [...last.keys()].filter(key => !now.has(key)) }
    last = now
    return seen
  }
}

const QUIET = { changed: [], born: [], gone: [] }
const three = (done: number) => ['One', 'Two', 'Three'].map((text, i) => step(text, i < done ? 'completed' : i === done ? 'in_progress' : 'pending'))

describe('the iframes of a room', () => {
  test('a whole turn with two agents: a desk that changes reloads itself, and nothing else ever does', async ($, on) => {
    const { w, spend, fill } = hearthWorld(on)
    await start($)
    const ui = await mountPane($)
    const see = watch(ui)
    const first = await see()
    expect(first.born).toEqual(expect.arrayContaining(['live-manager', 'live-fire', 'live-crab']))
    expect(await see(), 'a redraw alone').toEqual(QUIET)

    await startTurn($)
    expect(await see(), 'the manager sits down').toEqual({ ...QUIET, changed: ['live-manager'] })
    await spend($, usage(10, 10, 100, 100))
    expect(await see(), 'the first request lights the fire').toEqual({ ...QUIET, changed: ['live-fire'] })
    await sendPlan($, three(0), 'The plan')
    expect(await see(), 'a plan').toEqual(QUIET)

    await spawn($, w, 'a1', { description: 'First' })
    const arrival = await see()
    expect(arrival.born).toEqual(['live-a1'])
    // The one reload that cannot be avoided: every drawing of the room changes scale, once.
    for (const key of arrival.changed) expect(REFRAMED, key).toContain(key)
    expect(arrival.gone).toEqual([])
    await spawn($, w, 'a2', { description: 'Second' })
    // The first desk only moves along its row. The design draws the stove smaller from two agents on: its fire follows, once.
    expect(await see(), 'a second arrival').toEqual({ ...QUIET, born: ['live-a2'], changed: ['live-fire'] })

    await sendPlan($, three(1), undefined, 'a1')
    expect(await see(), 'the plan of an agent').toEqual(QUIET)
    await callTool($, 'Read', { file_path: 'x/a.ts' }, 'a1')
    expect(await see(), 'an action').toEqual(QUIET)
    for (const done of [1, 2]) {
      await sendPlan($, three(done))
      expect(await see(), `the plan at ${done}`).toEqual(QUIET)
      await spend($, usage(1234 * done))
      await w.clock.advance(5000)
      expect(await see(), `the count at ${done}`).toEqual(QUIET)
    }
    expect(w.state.tokens).toBeGreaterThan(0)

    fill(60)
    await spend($, usage(10))
    await w.clock.advance(1000)
    expect(w.state.hearth.ash).toBe('large')
    expect(await see(), 'the ash').toEqual(QUIET)

    await endTurn($, { agentId: 'a1' })
    expect(await see(), 'a desk ends').toEqual({ ...QUIET, changed: ['live-a1'] })
    await endTurn($, { agentId: 'a2', isAborted: true, reason: 'error' })
    const failed = await see()
    expect(failed.changed.length, 'the other desk').toBeLessThanOrEqual(1)
    await endTurn($)
    expect(await see(), 'the manager rests').toEqual({ ...QUIET, changed: ['live-manager'] })
  })

  test('the room never becomes a frame: its images stay plain, whatever happens', async ($, on) => {
    const { w, reply, fill } = hearthWorld(on)
    await start($)
    const ui = await mountPane($)
    await spawn($, w, 'a1')
    fill(90)
    await reply($)
    await w.clock.advance(FIVE - 45_000)
    for (const key of ['room-count', 'room-labels']) expect((await ui.find({ key }))?.children.find((c: Loose) => c?.type === 'Svg').props.isInteractive).toBeUndefined()
    expect((await ui.find({ type: 'Svg' })).props.isInteractive).toBeUndefined()
    expect((await sourceOf(ui)).length).toBeLessThan(131_072)
    expect((await sourceOf(ui, 'room-labels')).length).toBeLessThan(131_072)
    for (const source of framesIn(await ui.drawn()).values()) expect(source.length).toBeLessThan(131_072)
  })

  test('a fire reloads with its level alone', async ($, on) => {
    const { w, reply } = hearthWorld(on)
    await start($)
    const ui = await mountPane($)
    const see = watch(ui)
    await see()
    await reply($)
    expect((await see()).changed, 'it lights').toEqual(['live-fire'])
    let reloads = 0
    for (let at = 0; at < 200_000; at += 20_000) {
      await w.clock.advance(20_000)
      const { changed, born, gone } = await see()
      expect([...born, ...gone]).toEqual([])
      for (const key of changed) expect(key).toBe('live-fire')
      reloads += changed.length
    }
    expect(w.state.hearth.fire).toBe('medium')
    expect(reloads).toBe(1)
  })

  test('a visit: one frame, keyed by its run, and the fire takes when he leaves', async ($, on) => {
    const { w, reply } = hearthWorld(on)
    await start($)
    const ui = await mountPane($)
    const see = watch(ui)
    await reply($)
    await see()
    await w.clock.advance(FIVE - 45_000 - 15_000)
    const level = w.state.hearth.fire
    await see()
    await w.clock.advance(15_000)
    expect(w.state.hearth).toMatchObject({ fire: 'full', keeper: 'log', keeperRun: 1 })
    expect(level).not.toBe('full')
    const comes = await see()
    expect(comes).toEqual({ ...QUIET, born: ['live-keeper-1'] })
    const source = framesIn(await ui.drawn()).get('live-keeper-1')!
    expect(source).toContain('<animateTransform')
    expect(source).toContain('dur="12s"')
    expect(source).not.toMatch(/repeatCount="indefinite"[^>]*attributeName="transform"/)
    await w.clock.advance(6000)
    expect(await see(), 'halfway').toEqual(QUIET)
    await w.clock.advance(6100)
    expect(await see(), 'gone, and the fire catches up').toEqual({ changed: ['live-fire'], born: [], gone: ['live-keeper-1'] })
  })

  test('the card of a handoff lays its presses over the buttons it draws', async ($, on) => {
    const { w, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await spawn($, w, 'a1')
    await command($, 'refresh')
    await w.clock.settle()
    expect(w.state.handoff.phase).toBe('waiting')
    const ui = await mountPane($)
    const zone = await ui.find({ key: 'handoff-card' })
    expect(kids(zone)[0].props.display).toBe('none')
    for (const key of ['handoff-now', 'handoff-cancel']) expect(await hasKey(ui, key), key).toBe(true)
    await ui.press({ key: 'handoff-cancel' })
    await w.clock.settle()
    expect(w.state.handoff.phase).toBe('idle')
    expect(await hasKey(ui, 'handoff-card')).toBe(false)
  })

  test('the hearth has its card, and a phone stays whole, with no frame', async ($, on) => {
    const { reply } = hearthWorld(on)
    await start($)
    await reply($)
    const ui = await mountPane($)
    expect(await hasKey(ui, 'hearth-card')).toBe(true)
    await ui.unmount()
    const phone = await mountPane($, 'mobile')
    for (const svg of await phone.findAll({ type: 'Svg' })) expect(svg.props.isInteractive).toBeUndefined()
    expect(await sourceOf(phone)).toContain('.f{animation:fl')
  })

  test('the button on the stove stands there in the offered phase only', async ($, on) => {
    const { w, fill, reply } = hearthWorld(on, { held: { handoff: { phase: 'offered', waitingAgents: 0, waitingChats: 0, step: 0, file: null, urgent: false, words: 0, error: '', note: '', asked: false } } })
    fill(90)
    await start($)
    await reply($)
    await w.clock.settle()
    const ui = await mountPane($)
    expect(await hasKey(ui, 'handoff-change')).toBe(true)
    expect(await hasKey(ui, 'hearth-change')).toBe(true)
  })
})
