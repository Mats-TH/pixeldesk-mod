import { describe, expect, test } from 'claude-code/testing'

import { DESK_FILE, callTool, endTurn, receive, sendPlan, spawn, start, startTurn, step, submit, world } from './test-kit'
import type { World } from './test-kit'
import { desk } from './register'

const FLIGHT = 2400
const FRAMED = '<agent-message from="me">done</agent-message>'
const count = (w: World) => w.state.news?.count ?? 0
const beat = (w: World) => w.clock.advance(5000)

describe('news', () => {
  for (const kind of ['peer', 'peer-send-message']) {
    test(`a ${kind} message counts once, whichever way it comes`, async ($, on) => {
      const w = world(on)
      await start($)
      await receive($, 'hello', kind)
      expect(count(w)).toBe(1)
      await submit($, 'hello', kind)
      expect(count(w)).toBe(1)
    })
  }

  test('one seen only at the prompt counts', async ($, on) => {
    const w = world(on)
    await start($)
    await submit($, 'hello', 'peer')
    expect(count(w)).toBe(1)
  })

  test('not for an agent', async ($, on) => {
    const w = world(on)
    await start($)
    await receive($, 'hello', 'peer', { agentId: 'a1' })
    expect(count(w)).toBe(0)
  })

  test('not once consumed', async ($, on) => {
    const w = world(on)
    w.consumeReceived = true
    await start($)
    await receive($)
    expect(count(w)).toBe(0)
  })

  test('not what isMail refuses', async ($, on) => {
    const w = world(on)
    await start($)
    await receive($, FRAMED)
    await receive($, `Another Claude session sent a message: ${FRAMED}`)
    await receive($, '[Subagent hand-back] done')
    expect(count(w)).toBe(0)
  })

  for (const kind of ['task-notification', 'coordinator', 'scheduled-trigger']) {
    test(`${kind} comes from the conversation itself`, async ($, on) => {
      const w = world(on)
      await start($)
      await receive($, 'hello', kind)
      await submit($, 'hello', kind)
      expect(count(w)).toBe(0)
    })
  }

  test('counted on arrival, framed as a hand-back at the prompt: taken back', async ($, on) => {
    const w = world(on)
    await start($)
    await receive($, 'hello')
    expect(count(w)).toBe(1)
    await submit($, FRAMED, 'peer')
    expect(count(w)).toBe(0)
  })

  for (const kind of ['composer', 'bridge', 'sdk']) {
    test(`the count falls to zero when the person writes (${kind})`, async ($, on) => {
      const w = world(on)
      await start($)
      await receive($)
      await receive($)
      await submit($, 'hi', kind)
      expect(w.state.news).toEqual({ count: 0, shown: 0 })
    })
  }

  test('a meta prompt does not clear it', async ($, on) => {
    const w = world(on)
    await start($)
    await receive($)
    await submit($, 'system note', 'composer', { isMeta: true })
    expect(count(w)).toBe(1)
  })

  test('clearing cancels the flight: nothing lands after', async ($, on) => {
    const w = world(on)
    await start($)
    await receive($)
    await submit($)
    await w.clock.advance(FLIGHT * 2)
    expect(w.state.news).toEqual({ count: 0, shown: 0 })
  })

  test('one envelope at a time, the true number at once, shown on landing', async ($, on) => {
    const w = world(on)
    await start($)
    await receive($)
    await receive($)
    expect(w.state.news).toEqual({ count: 2, shown: 0 })
    await w.clock.advance(FLIGHT - 1)
    expect(w.state.news.shown).toBe(0)
    await w.clock.advance(1)
    expect(w.state.news.shown).toBe(1)
    await w.clock.advance(FLIGHT)
    expect(w.state.news).toEqual({ count: 2, shown: 2 })
  })

  test('at a landing no more than three stay in the air', async ($, on) => {
    const w = world(on)
    await start($)
    for (let i = 0; i < 10; i += 1) await receive($)
    await w.clock.advance(FLIGHT)
    expect(w.state.news).toEqual({ count: 10, shown: 7 })
    await w.clock.advance(FLIGHT)
    expect(w.state.news.shown).toBe(8)
  })

  test('the count survives a restart, nothing flying', async ($, on) => {
    const w = world(on, { files: { [DESK_FILE]: '{"news":3,"tokens":0}' } })
    await start($)
    expect(w.state.news).toEqual({ count: 3, shown: 3 })
    await beat(w)
    expect(w.json(DESK_FILE).news).toBe(3)
  })
})

describe('the state of the conversation', () => {
  test('no chat before the first turn', async ($, on) => {
    const w = world(on)
    await start($)
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBeUndefined()
  })

  test('a turn sets it working', async ($, on) => {
    const w = world(on)
    await start($)
    await startTurn($)
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBe('working')
  })

  test('a prompt alone does not, dropped or not', async ($, on) => {
    const w = world(on)
    await start($)
    await startTurn($)
    await endTurn($)
    await submit($)
    w.dropPrompts = true
    await submit($)
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBe('done')
  })

  test('a prompt before any turn leaves it unset', async ($, on) => {
    const w = world(on)
    await start($)
    await submit($)
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBeUndefined()
  })

  test('the end of a turn sets it done', async ($, on) => {
    const w = world(on)
    await start($)
    await startTurn($)
    await endTurn($)
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBe('done')
  })

  for (const end of [{ isAborted: true, reason: 'aborted' }, { reason: 'error' }, { reason: 'refusal' }]) {
    test(`${JSON.stringify(end)} sets it failed`, async ($, on) => {
      const w = world(on)
      await start($)
      await startTurn($)
      await endTurn($, end)
      await beat(w)
      expect(w.json(DESK_FILE).chat).toBe('failed')
    })
  }

  test('the end of an agent\'s turn leaves it alone', async ($, on) => {
    const w = world(on)
    await start($)
    await startTurn($)
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1' })
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBe('working')
  })
})

describe('the desk file', () => {
  test('its fields, compact', async ($, on) => {
    const w = world(on)
    await start($, 'desktop', 'C:/work/app')
    await spawn($, w, 'a1', { description: 'Refonte', type: 'general-purpose' })
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    w.refuse.add('ui.panes')
    await sendPlan($, [step('One', 'in_progress', { detail: 'Hidden' })])
    await beat(w)
    const text = w.file(DESK_FILE)!
    expect(text.includes('\n')).toBe(false)
    expect(JSON.parse(text)).toMatchObject({
      sessionId: 'session-1',
      title: '',
      agents: 1,
      working: 1,
      cwd: 'C:/work/app',
      steps: [{ text: 'One', status: 'in_progress' }],
      tokens: 0,
      news: 0,
      updatedAt: w.clock.now(),
    })
    expect(JSON.parse(text).since).toBe(w.state.agents[0].startedAt)
    expect(JSON.parse(text).steps[0].detail).toBeUndefined()
  })

  test('written every 5 s if something changed, updatedAt aside', async ($, on) => {
    const w = world(on)
    await start($)
    await beat(w)
    const writes = () => w.writes.filter(path => path === DESK_FILE).length
    expect(writes()).toBe(1)
    await beat(w)
    expect(writes()).toBe(1)
    await sendPlan($, [step('One', 'pending')])
    await beat(w)
    expect(writes()).toBe(2)
  })

  test('a busy conversation still writes once a minute', async ($, on) => {
    const w = world(on)
    await start($)
    await startTurn($)
    await beat(w)
    const writes = () => w.writes.filter(path => path === DESK_FILE).length
    expect(writes()).toBe(1)
    await w.clock.advance(55_000)
    expect(writes()).toBe(1)
    await w.clock.advance(5000)
    expect(writes()).toBe(2)
  })

  test('so does one with an agent at work', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await beat(w)
    const writes = () => w.writes.filter(path => path === DESK_FILE).length
    await w.clock.advance(60_000)
    expect(writes()).toBeGreaterThanOrEqual(2)
  })

  test('an idle one does not', async ($, on) => {
    const w = world(on)
    await start($)
    await beat(w)
    await w.clock.advance(120_000)
    expect(w.writes.filter(path => path === DESK_FILE)).toHaveLength(1)
  })

  test('the summary of the latest at work, else its last action, else nothing', async ($, on) => {
    const w = world(on)
    await start($)
    await beat(w)
    expect(w.json(DESK_FILE).summary).toBe('')
    await spawn($, w, 'a1')
    w.refuse.add('model.complete')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await beat(w)
    expect(w.json(DESK_FILE).summary).toBe('Lecture de a.ts')
    w.refuse.clear()
    await w.clock.advance(45_000)
    await callTool($, 'Read', { file_path: 'b.ts' }, 'a1')
    await beat(w)
    expect(w.json(DESK_FILE).summary).toBe('A plain sentence.')
  })

  test('desks follow the seated agents, steps the whole plan', async ($, on) => {
    const w = world(on)
    await start($)
    for (let i = 0; i < 18; i += 1) await spawn($, w, `a${i}`)
    await sendPlan($, Array.from({ length: 30 }, (_, i) => step(`S${i}`, 'pending')))
    await beat(w)
    const file = w.json(DESK_FILE)
    expect(file.desks).toHaveLength(16)
    expect(file.steps).toHaveLength(30)
  })

  test('a finished agent of a general type, in French', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { description: 'Refonte', type: 'general-purpose' })
    await endTurn($, { agentId: 'a1' })
    await beat(w)
    expect(w.json(DESK_FILE).desks).toEqual([{ title: 'Développeur', state: 'done', hue: 1, done: 0, total: 0, live: false }])
    expect(desk(w.state.agents[0])).toEqual({ title: 'Développeur', state: 'done', hue: 1, done: 0, total: 0, live: false })
  })

  test('a file that cannot be written does not stop the beat', async ($, on) => {
    const w = world(on)
    await start($)
    w.refuseWrite = /desk-/
    await beat(w)
    w.refuseWrite = null
    await beat(w)
    expect(w.file(DESK_FILE)).toBeDefined()
  })
})
