import { describe, expect, test } from 'claude-code/testing'

import { DESK_FILE, altOf, callTool, cardIn, endTurn, mountPane, sendPlan, sourceOf, spawn, start, step, steps, usage, world } from './test-kit'
import type { World } from './test-kit'

const ZOOM = 'attributeName="viewBox"'
const zoomed = async (ui: any) => (await sourceOf(ui)).includes(ZOOM)
const countZoomed = async (ui: any) => (await sourceOf(ui, 'room-count')).includes(ZOOM)

/** A room with an agent that came in and was drawn with its zoom, then the source left settled. */
async function arrived($: any, on: any) {
  const w = world(on)
  const step_ = steps(on)
  await start($)
  const ui = await mountPane($)
  await spawn($, w, 'a1')
  return { w, ui, step: step_ }
}

describe('the zoom of an arrival', () => {
  test('an arrival plays the zoom once', async ($, on) => {
    const { ui } = await arrived($, on)
    expect(await zoomed(ui)).toBe(true)
    await ui.redraw()
    expect(await zoomed(ui)).toBe(true)
  })

  test('no agent, no zoom', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($)
    expect(await zoomed(ui)).toBe(false)
  })

  test('the arrival reads in the state: new number, old number', async ($, on) => {
    const { w } = await arrived($, on)
    expect(w.state.seen).toEqual({ shown: 1, previous: 0 })
  })

  test('the end of a turn settles the balance', async ($, on) => {
    const { w, ui } = await arrived($, on)
    await endTurn($, { agentId: 'a1' })
    expect(w.state.seen).toEqual({ shown: 1, previous: 1 })
    expect(await zoomed(ui)).toBe(false)
  })

  test('so does a change read in the list', async ($, on) => {
    const { w, ui } = await arrived($, on)
    w.agents = [{ id: 'a1', description: 'x', type: 't', status: 'completed' }]
    await w.clock.advance(2000)
    expect(w.state.seen).toEqual({ shown: 1, previous: 1 })
    expect(await zoomed(ui)).toBe(false)
  })

  test('so does a departure', async ($, on) => {
    const { w } = await arrived($, on)
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'aborted' })
    expect(w.state.seen).toEqual({ shown: 0, previous: 0 })
  })

  test('a new plan writes the balance before the plan', async ($, on) => {
    const { w, ui } = await arrived($, on)
    const seen: unknown[] = []
    const original = w.state
    w.state = new Proxy(original, {
      set(target, key, value) {
        if (key === 'plan') seen.push(target.seen)
        return Reflect.set(target, key, value)
      },
    })
    await sendPlan($, [step('One', 'pending')])
    expect(seen).toEqual([{ shown: 1, previous: 1 }])
    expect(await zoomed(ui)).toBe(false)
  })

  test('after an arrival new tokens leave the source and the alternative alone', async ($, on) => {
    const { w, ui, step: spend } = await arrived($, on)
    await endTurn($, { agentId: 'a1' })
    const [source, alt, count] = [await sourceOf(ui), await altOf(ui), await sourceOf(ui, 'room-count')]
    await spend($, usage(1234))
    await w.clock.advance(5000)
    expect(w.state.tokens).toBe(1234)
    expect(await sourceOf(ui)).toBe(source)
    expect(await altOf(ui)).toBe(alt)
    expect(await sourceOf(ui, 'room-count')).not.toBe(count)
  })

  test('a real change redraws the room with no second zoom', async ($, on) => {
    const { w, ui } = await arrived($, on)
    await sendPlan($, [step('Main', 'pending')])
    await sendPlan($, [step('One', 'pending')], undefined, 'a1')
    await endTurn($, { agentId: 'a1' })
    const settled = await sourceOf(ui)
    await sendPlan($, [step('Main', 'in_progress')])
    expect(await sourceOf(ui)).not.toBe(settled)
    expect(await zoomed(ui)).toBe(false)
    expect(w.state.seen.shown).toBe(1)
  })

  test('the count zooms with the room on its first source, a later value stays still', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spawn($, w, 'a1')
    const ui = await mountPane($)
    expect(await countZoomed(ui)).toBe(true)
    await spend($, usage(50))
    await w.clock.advance(5000)
    expect(await countZoomed(ui)).toBe(false)
  })

  test('a second arrival zooms again, and the count follows', async ($, on) => {
    const { w, ui } = await arrived($, on)
    await endTurn($, { agentId: 'a1' })
    expect(await zoomed(ui)).toBe(false)
    await spawn($, w, 'a2')
    expect(w.state.seen).toEqual({ shown: 2, previous: 1 })
    expect(await zoomed(ui)).toBe(true)
    // Up to three agents the frame stays the same, and so does the count's image: it moves when the room grows.
    await spawn($, w, 'a3')
    await spawn($, w, 'a4')
    expect(await zoomed(ui)).toBe(true)
    expect(await countZoomed(ui)).toBe(true)
  })

  test('a departure does not zoom', async ($, on) => {
    const { w, ui } = await arrived($, on)
    await spawn($, w, 'a2')
    await endTurn($, { agentId: 'a2' })
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'aborted' })
    expect(await zoomed(ui)).toBe(false)
  })

  test('an arrival after a departure, at the same number of desks, zooms', async ($, on) => {
    const { w, ui } = await arrived($, on)
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'aborted' })
    await spawn($, w, 'a2')
    expect(await zoomed(ui)).toBe(true)
  })

  test('with or without a drawing in between', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'aborted' })
    await spawn($, w, 'a2')
    const ui = await mountPane($)
    expect(await zoomed(ui)).toBe(true)
  })

  test('the previous passed on is bounded by the desks seated', async ($, on) => {
    const w = world(on, { held: { seen: { shown: 40, previous: 40 } } })
    await start($)
    const ui = await mountPane($)
    expect(await zoomed(ui)).toBe(false)
    expect(w.state.agents).toBeUndefined()
  })
})

describe('tokens', () => {
  const beat = (w: World) => w.clock.advance(5000)

  test('the total: main, agents here, agents gone, all four counters', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spawn($, w, 'here')
    await spawn($, w, 'gone')
    await spend($, usage(1, 2, 3, 4))
    await spend($, usage(10), 'here')
    await spend($, usage(100), 'gone')
    await endTurn($, { agentId: 'gone', isAborted: true, reason: 'aborted' })
    await beat(w)
    expect(w.state.tokens).toBe(120)
    expect(w.json(DESK_FILE).tokens).toBe(120)
  })

  test('a step goes to the main count or the agent\'s turn', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spawn($, w, 'a1')
    await spend($, usage(7), 'a1')
    expect(w.state.agents[0].liveTokens).toBe(7)
    await spend($, null, 'a1')
    expect(w.state.agents[0].liveTokens).toBe(7)
  })

  test('the state moves on the 5 s beat, only for a new value', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spend($, usage(5))
    await w.clock.advance(4000)
    expect(w.state.tokens).toBeUndefined()
    await w.clock.advance(1000)
    expect(w.state.tokens).toBe(5)
    const before = w.state
    let writes = 0
    w.state = new Proxy(before, {
      set(target, key, value) {
        if (key === 'tokens') writes += 1
        return Reflect.set(target, key, value)
      },
    })
    await beat(w)
    expect(writes).toBe(0)
  })

  test('after a reload the count starts from the file, even an old one', async ($, on) => {
    const w = world(on, { files: { [DESK_FILE]: '{"tokens":4200}' } })
    await start($)
    expect(w.state.tokens).toBe(4200)
  })

  test('the main tokens taken back leave out the agents here and gone', async ($, on) => {
    const here = { id: 'a1', description: 'x', type: 't', phase: 'working', startedAt: 1, endedAt: 0, count: 0, steps: [], tokens: 100, liveTokens: 50, seat: 0, hue: 0 }
    const gone = { ...here, id: 'a2', phase: 'failed', tokens: 200, liveTokens: 0, seat: 1 }
    const w = world(on, { files: { [DESK_FILE]: '{"tokens":1000}' }, held: { agents: [here, gone] } })
    const spend = steps(on)
    await start($)
    await spend($, usage(1))
    await beat(w)
    expect(w.state.tokens).toBe(1001)
  })

  test('never below zero', async ($, on) => {
    const here = { id: 'a1', description: 'x', type: 't', phase: 'working', startedAt: 1, endedAt: 0, count: 0, steps: [], tokens: 100, liveTokens: 0, seat: 0, hue: 0 }
    const w = world(on, { files: { [DESK_FILE]: '{"tokens":40}' }, held: { agents: [here] } })
    await start($)
    await beat(w)
    expect(w.json(DESK_FILE).tokens).toBe(100)
  })

  test('a broken file or none leaves the count at zero', async ($, on) => {
    const w = world(on, { files: { [DESK_FILE]: '{broken' } })
    await start($)
    expect(w.state.tokens).toBeUndefined()
    expect(w.commands).toHaveLength(1)
  })

  test('an aborted turn does not lower the total', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spawn($, w, 'a1')
    await spend($, usage(500), 'a1')
    await beat(w)
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'aborted', usage: usage(10) })
    await beat(w)
    expect(w.state.tokens).toBe(500)
  })

  test('tokens leave the cards alone', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await w.clock.settle()
    const ui = await mountPane($)
    const card = cardIn(await ui.find({ key: 'desk-a1' })).svg.props.source
    await spend($, usage(5), 'a1')
    await beat(w)
    expect(cardIn(await ui.find({ key: 'desk-a1' })).svg.props.source).toBe(card)
  })
})
