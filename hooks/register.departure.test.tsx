import { describe, expect, test } from 'claude-code/testing'

import { DESK_FILE, NOON, PLAN_FILE, SETTINGS_FILE, callTool, command, endTurn, mountPane, sendPlan, sourceOf, spawn, start, startTurn, step, steps, usage, world } from './test-kit'

const LEAVE = 30_000
const ZOOM = 'attributeName="viewBox"'
const ids = (w: any) => w.state.agents.map((a: any) => a.id)
const OPEN = [step('One', 'in_progress'), step('Two', 'pending')]
const OVER = [step('One', 'completed'), step('Two', 'completed')]

async function done($: any, w: any, ...agents: string[]) {
  for (const id of agents) await spawn($, w, id)
  for (const id of agents) await endTurn($, { agentId: id })
}

const eachMode = { files: { [SETTINGS_FILE]: '{"departure":"each"}' } }

describe('end of plan, the default', () => {
  test('an open plan keeps a finished desk, with its tick, however long', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1')
    await w.clock.advance(5 * LEAVE)
    expect(ids(w)).toEqual(['a1'])
    expect(w.state.agents[0].phase).toBe('done')
  })

  test('a finished plan: all leave after 30 s, in one go, with no zoom and no loop, the Manager stays', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1', 'a2')
    const ui = await mountPane($)
    await w.clock.advance(10_000)
    await sendPlan($, OVER)
    await w.clock.advance(LEAVE - 2000)
    expect(ids(w), 'just before').toEqual(['a1', 'a2'])
    w.stateWrites.length = 0
    await w.clock.advance(2000)
    expect(ids(w)).toEqual([])
    expect(w.stateWrites.filter((key: string) => key === 'agents'), 'one publication').toHaveLength(1)
    expect(w.state.seen).toEqual({ shown: 0, previous: 0 })
    expect(await sourceOf(ui)).not.toContain(ZOOM)
    expect(await sourceOf(ui, 'room-labels'), 'the Manager stays').toContain('href="#M"')
    const [lists, writes] = [w.agentLists, w.stateWrites.length]
    await w.clock.advance(60_000)
    expect(w.agentLists, 'no list to read').toBe(lists)
    expect(w.stateWrites.filter((key: string) => key === 'agents').length, 'nothing more published').toBe(writes === 0 ? 0 : 1)
  })

  test('nobody leaves while an agent works, and a later end moves the clock', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1')
    await spawn($, w, 'a2')
    await sendPlan($, OVER)
    await w.clock.advance(2 * LEAVE)
    expect(ids(w)).toEqual(['a1', 'a2'])
    await endTurn($, { agentId: 'a2' })
    await w.clock.advance(LEAVE - 2000)
    expect(ids(w)).toEqual(['a1', 'a2'])
    await w.clock.advance(2000)
    expect(ids(w)).toEqual([])
  })

  test('with no plan the wave leaves together, 30 s after its last desk', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await spawn($, w, 'a2')
    await endTurn($, { agentId: 'a1' })
    await w.clock.advance(20_000)
    await endTurn($, { agentId: 'a2' })
    await w.clock.advance(LEAVE - 2000)
    expect(ids(w)).toEqual(['a1', 'a2'])
    await w.clock.advance(2000)
    expect(ids(w)).toEqual([])
  })

  test('an empty plan counts as no plan', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [])
    await done($, w, 'a1')
    await w.clock.advance(LEAVE)
    expect(ids(w)).toEqual([])
  })

  test('a broken preference leaves the default', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{broken' } })
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1')
    await w.clock.advance(5 * LEAVE)
    expect(ids(w)).toEqual(['a1'])
    expect(w.state.settings.departure).toBe('plan')
  })
})

describe('a new plan', () => {
  test('another name frees the desks at once, and the steps follow their usual rules', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress', { detail: 'kept', who: 'Claude' }), step('Two', 'pending')], 'Job')
    await done($, w, 'a1')
    await sendPlan($, [step('One', 'in_progress'), step('Two', 'pending')], 'Other job')
    expect(ids(w)).toEqual([])
    expect(w.json(PLAN_FILE).steps[0]).toMatchObject({ detail: 'kept', who: 'Claude' })
    expect(w.state.plan.title).toBe('Other job')
  })

  test('work after a finished plan frees them, before their 30 s', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1')
    await sendPlan($, OVER)
    expect(ids(w), 'a plan just finished frees nobody').toEqual(['a1'])
    await sendPlan($, [step('Next', 'pending')])
    expect(ids(w)).toEqual([])
  })

  test('the first plan of the session frees them', async ($, on) => {
    const w = world(on)
    await start($)
    await done($, w, 'a1')
    await sendPlan($, OPEN)
    expect(ids(w)).toEqual([])
  })

  test('the same plan updated frees nobody, nor an agent working', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1')
    await spawn($, w, 'a2')
    await sendPlan($, [step('One', 'completed'), step('Two', 'in_progress')], 'Job')
    await sendPlan($, [step('One', 'completed'), step('Two', 'in_progress'), step('Three', 'pending')])
    expect(ids(w)).toEqual(['a1', 'a2'])
    await sendPlan($, OPEN, 'Other')
    expect(ids(w), 'only an agent at work stays').toEqual(['a2'])
  })

  test('a mirror goes by the same rule, and an agent\'s plan frees nobody', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1')
    await spawn($, w, 'a2')
    await sendPlan($, [step('Mine', 'in_progress')], 'Mine', 'a2')
    expect(ids(w)).toEqual(['a1', 'a2'])
    await sendPlan($, OVER)
    await callTool($, 'TodoWrite', { todos: [{ content: 'Next', status: 'pending' }] })
    expect(ids(w)).toEqual(['a2'])
  })

  test('a plan read back at the start frees nobody', async ($, on) => {
    const saved = { id: 'a1', description: 'x', type: 't', phase: 'done', startedAt: 1, endedAt: NOON - 1000, count: 0, steps: [], tokens: 0, liveTokens: 0, seat: 0, hue: 1 }
    const w = world(on, { held: { agents: [saved] }, files: { [PLAN_FILE]: '{"title":"Job","steps":[{"text":"One","status":"in_progress"}]}' } })
    await start($)
    expect(ids(w)).toEqual(['a1'])
  })
})

describe('as they finish', () => {
  test('each leaves 30 s after its own end, plan open and others at work', async ($, on) => {
    const w = world(on, eachMode)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await spawn($, w, 'a1')
    await spawn($, w, 'a2')
    await endTurn($, { agentId: 'a1' })
    await w.clock.advance(LEAVE - 2000)
    expect(ids(w)).toEqual(['a1', 'a2'])
    await w.clock.advance(2000)
    expect(ids(w)).toEqual(['a2'])
  })
})

describe('a stopped desk', () => {
  test('it waits for the next wave, then leaves with no zoom of its own', async ($, on) => {
    for (const files of [{}, eachMode.files]) {
      const w = world(on, { files })
      await start($)
      await spawn($, w, 'a1')
      await endTurn($, { agentId: 'a1', reason: 'error' })
      await w.clock.advance(10 * LEAVE)
      expect(ids(w)).toEqual(['a1'])
      await spawn($, w, 'a2')
      expect(ids(w)).toEqual(['a2'])
      expect(w.state.seen).toEqual({ shown: 1, previous: 0 })
      return
    }
  })

  test('a finished desk does not go with it', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await spawn($, w, 'a1')
    await spawn($, w, 'a2')
    await endTurn($, { agentId: 'a1', reason: 'error' })
    await endTurn($, { agentId: 'a2' })
    await spawn($, w, 'a3')
    expect(ids(w)).toEqual(['a2', 'a3'])
  })

  test('it leaves with the next plan', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1', reason: 'error' })
    await sendPlan($, OPEN, 'Other')
    expect(ids(w)).toEqual([])
  })
})

describe('what a departure leaves', () => {
  test('the tokens stay, and a late call does not bring the agent back', async ($, on) => {
    const w = world(on)
    const step_ = steps(on)
    await start($)
    await spawn($, w, 'a1')
    await step_($, usage(40), 'a1')
    await endTurn($, { agentId: 'a1' })
    await w.clock.advance(LEAVE)
    expect(ids(w)).toEqual([])
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    expect(ids(w)).toEqual([])
    await w.clock.advance(5000)
    expect(w.json(DESK_FILE).tokens).toBe(40)
  })

  test('the desk file follows at its next pass', async ($, on) => {
    const w = world(on)
    await start($)
    await done($, w, 'a1')
    await w.clock.advance(5000)
    expect(w.json(DESK_FILE).desks).toHaveLength(1)
    await w.clock.advance(LEAVE)
    expect(w.json(DESK_FILE).desks).toEqual([])
  })

  test('a room with no departure ahead publishes nothing, and its source stands still', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1')
    const ui = await mountPane($)
    const source = await sourceOf(ui)
    w.stateWrites.length = 0
    await w.clock.advance(60_000)
    expect(w.stateWrites.filter((key: string) => key === 'agents')).toEqual([])
    expect(await sourceOf(ui)).toBe(source)
  })

  test('the 2 s pass runs for a departure, without reading the list', async ($, on) => {
    const w = world(on)
    await start($)
    await done($, w, 'a1')
    const lists = w.agentLists
    await w.clock.advance(10_000)
    expect(w.agentLists).toBe(lists)
    await w.clock.advance(LEAVE)
    expect(ids(w)).toEqual([])
  })

  test('a turn of the conversation has no part in it', async ($, on) => {
    const w = world(on)
    await start($)
    await done($, w, 'a1')
    await startTurn($)
    await w.clock.advance(LEAVE)
    expect(ids(w)).toEqual([])
  })

  test('an old state is cleaned on load, and the copy rewritten', async ($, on) => {
    const base = { description: 'x', type: 't', startedAt: 1, count: 0, steps: [], tokens: 0, liveTokens: 0, seat: 0, hue: 1 }
    const agents = [
      { ...base, id: 'old', phase: 'done', endedAt: NOON - LEAVE },
      { ...base, id: 'recent', phase: 'done', endedAt: NOON - 1000 },
      { ...base, id: 'error', phase: 'failed', errored: true, endedAt: NOON - 10 * LEAVE },
      { ...base, id: 'working', phase: 'working', endedAt: 0 },
    ]
    const w = world(on, { held: { agents, seen: { shown: 4, previous: 3 } } })
    await start($)
    expect(ids(w)).toEqual(['recent', 'error', 'working'])
    expect(w.state.seen).toEqual({ shown: 3, previous: 3 })
  })
})

describe('the preference', () => {
  test('it is read at the start, before any pane opens', async ($, on) => {
    const w = world(on, eachMode)
    await start($)
    expect(w.state.settings.departure).toBe('each')
    expect(w.reads.indexOf(SETTINGS_FILE) >= 0).toBe(true)
  })

  test('a pass reads the file once for both settings', async ($, on) => {
    const w = world(on)
    await start($)
    w.reads.length = 0
    await w.clock.advance(3000)
    expect(w.reads.filter((path: string) => path === SETTINGS_FILE)).toHaveLength(1)
  })

  test('an unknown value is plan', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"departure":"never"}' } })
    await start($)
    expect(w.state.settings.departure).toBe('plan')
  })

  test('hide keeps departure, and show too', async ($, on) => {
    const w = world(on, eachMode)
    await start($)
    await command($, 'hide')
    expect(w.json(SETTINGS_FILE)).toEqual({ departure: 'each', hidden: true })
    await command($, 'show')
    expect(w.json(SETTINGS_FILE)).toEqual({ departure: 'each' })
  })
})

describe('/pixeldesk departure', () => {
  test('with no value it tells the current one', async ($, on) => {
    const w = world(on)
    await start($)
    expect((await command($, 'departure')).text).toBe('Départ des bureaux : Fin du plan (plan). Change-le avec /pixeldesk departure plan ou /pixeldesk departure each.')
    expect(w.file(SETTINGS_FILE)).toBeUndefined()
  })

  test('a value is saved, confirmed and applied at once, other keys kept', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"theme":"night","hidden":true}' } })
    await start($)
    await sendPlan($, OPEN, 'Job')
    await done($, w, 'a1')
    await w.clock.advance(2 * LEAVE)
    const answer = await command($, 'departure each')
    expect(answer.text).toBe("Départ des bureaux réglé sur Au fil de l'eau (each).")
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'night', hidden: true, departure: 'each' })
    expect(w.state.settings.departure).toBe('each')
    expect(ids(w)).toEqual([])
    expect((await command($, 'departure')).text).toContain('(each)')
  })

  test('the case and the spaces do not matter', async ($, on) => {
    const w = world(on)
    await start($)
    await command($, '  Departure   EACH ')
    expect(w.json(SETTINGS_FILE).departure).toBe('each')
  })

  for (const args of ['departure sometimes', 'departure plan each']) {
    test(`"${args}" changes nothing and gives the usage`, async ($, on) => {
      const w = world(on)
      await start($)
      const answer = await command($, args)
      expect(answer.text).toContain('/pixeldesk')
      expect(w.file(SETTINGS_FILE)).toBeUndefined()
    })
  }

  test('the English messages', async ($, on) => {
    world(on, { env: { USERPROFILE: 'C:\\Users\\test', LANG: 'en_US.UTF-8' } })
    await start($)
    expect((await command($, 'departure')).text).toBe('When desks leave: End of plan (plan). Change it with /pixeldesk departure plan or /pixeldesk departure each.')
    expect((await command($, 'departure each')).text).toBe('When desks leave is now As they finish (each).')
    expect((await command($, 'departure maybe')).text).toBe('Unknown value. Use /pixeldesk departure plan or /pixeldesk departure each.')
  })
})
