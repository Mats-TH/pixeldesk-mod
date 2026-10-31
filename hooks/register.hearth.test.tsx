import { describe, expect, test } from 'claude-code/testing'

import { FIVE, HOUR, READ, REWRITE, answers, hearthWorld } from './test-hearth'
import { NOON, SETTINGS_FILE, command, endTurn, mountBand, sendPlan, spawn, start, startTurn, step, usage } from './test-kit'

const SLOW = { timeoutMs: 30000 }
const PING = 'Reply with the single word: ok'
const pings = (forks: string[]) => forks.filter(prompt => prompt === PING).length

describe('the clock', () => {
  test('nothing before the first reply: no clock, a dead fire, no call', SLOW, async ($, on) => {
    const { w, forks } = hearthWorld(on)
    await start($)
    await w.clock.advance(FIVE * 3)
    expect(w.state.hearth).toMatchObject({ fire: 'out', coolsAt: null, ash: 'none', relaunches: 0 })
    expect(forks).toEqual([])
  })

  test('the time counts from the request, not from the reply', async ($, on) => {
    const { w, h, spend } = hearthWorld(on)
    let release = () => {}
    spend.hold(new Promise<void>(resolve => (release = resolve)))
    await start($)
    await startTurn($)
    const running = spend($, usage(1))
    await w.clock.advance(60_000)
    release()
    await running
    await endTurn($)
    await w.clock.advance(1)
    expect(w.state.hearth.coolsAt).toBe(NOON + FIVE)
    expect(h.model).toBe('opus')
  })

  test('an answer with no usage never reached the cache', async ($, on) => {
    const { w, spend } = hearthWorld(on)
    await start($)
    await startTurn($)
    await spend($, null)
    await endTurn($, { reason: 'error' })
    await w.clock.advance(1)
    expect(w.state.hearth.coolsAt).toBeNull()
  })

  test('the fire follows the share left: 60, 30 and 10 %, and writes only when it moves', SLOW, async ($, on) => {
    const { w, h, reply } = hearthWorld(on)
    h.fork = () => answers.overloaded
    await start($)
    await command($, 'warm off')
    await reply($)
    await w.clock.settle()
    const states = () => w.stateWrites.filter(key => key === 'hearth').length
    expect(w.state.hearth.fire).toBe('full')
    await w.clock.advance(FIVE * 0.41)
    expect(w.state.hearth.fire).toBe('medium')
    await w.clock.advance(FIVE * 0.3)
    expect(w.state.hearth.fire).toBe('low')
    await w.clock.advance(FIVE * 0.2)
    expect(w.state.hearth.fire).toBe('embers')
    await w.clock.advance(FIVE * 0.1)
    expect(w.state.hearth.fire).toBe('out')
    const seen = states()
    await w.clock.advance(FIVE)
    expect(states(), 'a dead fire stays quiet').toBe(seen)
  })
})

describe('relaunches', () => {
  test('on by default, 45 s before the end, and the clock restarts where the relaunch left', async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await w.clock.advance(FIVE - 45_001)
    expect(forks).toEqual([])
    await w.clock.advance(1)
    expect(forks).toEqual([PING])
    expect(w.state.hearth).toMatchObject({ relaunches: 1, coolsAt: NOON + FIVE - 45_000 + FIVE, fire: 'full', keeper: 'log', keeperRun: 1 })
    expect(w.log()).toContain('relaunch 1: read 90000, wrote 0')
  })

  test('the keeper leaves after his visit, and each visit has its own number', async ($, on) => {
    const { w, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await w.clock.advance(FIVE - 45_000)
    await w.clock.advance(12_001)
    expect(w.state.hearth).toMatchObject({ keeper: null, keeperRun: 1 })
    await w.clock.advance(FIVE - 45_000)
    expect(w.state.hearth).toMatchObject({ keeperRun: 2 })
  })

  test('a session at rest stops at 2 hours, and the fire goes out on its own', SLOW, async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await w.clock.advance(2 * HOUR + FIVE * 2)
    expect(pings(forks)).toBe(28)
    expect(w.state.hearth).toMatchObject({ warmStop: 'cap', fire: 'out', relaunchCap: 30, active: false })
  })

  test('a session at rest stops at the thirtieth relaunch, never a thirty-first', async ($, on) => {
    const held = { lengthMs: FIVE, coolsAt: NOON + 50_000, relaunches: 29, warmSince: NOON - 60_000, failures: 0, warmStop: null, warmError: '', keeperRun: 29, contextPercent: 10, compactions: 0 }
    const { w, forks } = hearthWorld(on, { held: { hearth: held } })
    await start($)
    await w.clock.advance(FIVE * 2)
    expect(pings(forks)).toBe(1)
    expect(w.state.hearth).toMatchObject({ warmStop: 'cap', relaunches: 30 })
  })

  test('an active session has no cap, of relaunches or of time', SLOW, async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await spawn($, w, 'a1')
    for (let part = 0; part < 14; part += 1) await w.clock.advance(HOUR / 6)
    expect(pings(forks)).toBe(32)
    expect(w.state.hearth).toMatchObject({ active: true, relaunchCap: null, warmStop: null })
  })

  test('a plan alone counts for 15 min after the last activity, then the session is at rest', SLOW, async ($, on) => {
    const { w, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await sendPlan($, [step('Forgotten', 'in_progress')])
    await w.clock.advance(15 * 60_000 - 5000)
    expect(w.state.hearth).toMatchObject({ active: true, relaunchCap: null })
    await w.clock.advance(10_000)
    expect(w.state.hearth).toMatchObject({ active: false, relaunchCap: 30, relaunches: 0 })
  })

  test('a quiet plan holds no cap off: the thirtieth relaunch is the last', SLOW, async ($, on) => {
    const held = { lengthMs: FIVE, coolsAt: NOON + 50_000, relaunches: 29, warmSince: NOON - 60_000, failures: 0, warmStop: null, warmError: '', keeperRun: 29, contextPercent: 10, compactions: 0 }
    const { w, forks } = hearthWorld(on, { held: { hearth: held } })
    await start($)
    await sendPlan($, [step('Forgotten', 'in_progress')])
    await w.clock.advance(FIVE * 2)
    expect(pings(forks)).toBe(1)
    expect(w.state.hearth).toMatchObject({ warmStop: 'cap', relaunches: 30, active: false })
  })

  test('a turn brings a quiet plan back to life', SLOW, async ($, on) => {
    const { w, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await sendPlan($, [step('Long job', 'in_progress')])
    await w.clock.advance(16 * 60_000)
    expect(w.state.hearth.active).toBe(false)
    await reply($)
    await w.clock.advance(5000)
    expect(w.state.hearth).toMatchObject({ active: true, relaunchCap: null })
  })

  test('when it stops being active the caps start afresh', SLOW, async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await sendPlan($, [step('Long job', 'in_progress')])
    await w.clock.advance(FIVE - 45_000)
    expect(pings(forks)).toBe(1)
    await sendPlan($, [step('Long job', 'completed')])
    await w.clock.advance(5000)
    expect(w.state.hearth).toMatchObject({ active: false, relaunches: 0, relaunchCap: 30, warmStop: null })
    await w.clock.advance(FIVE)
    expect(pings(forks)).toBe(2)
  })

  test('an agent at work keeps the session active, and its turn blocks nothing', async ($, on) => {
    const { w, forks, reply, spend } = hearthWorld(on)
    await start($)
    await reply($)
    await spawn($, w, 'a1')
    await startTurn($, 'a1')
    await spend($, usage(5), 'a1')
    await w.clock.advance(FIVE - 45_000)
    expect(forks).toEqual([PING])
    expect(w.state.hearth).toMatchObject({ active: true, relaunchCap: null })
  })

  test('a long tool in the middle of a turn is kept warm, a request in flight is not doubled', async ($, on) => {
    const { w, forks, spend } = hearthWorld(on)
    await start($)
    await startTurn($)
    await spend($, usage(10))
    await w.clock.advance(FIVE - 45_000)
    expect(forks).toEqual([PING])
    expect(w.state.chat.working).toBe(true)
  })

  test('its own turn is not a turn of the conversation', async ($, on) => {
    const { w, h, reply } = hearthWorld(on)
    h.fork = async () => {
      await $.turn.start({ text: PING, turnId: 'fork' })
      await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 'fork', reason: 'answer' })
      return answers.pong()
    }
    await start($)
    await reply($)
    const ended = w.state.chat.ended
    await w.clock.advance(FIVE - 45_000)
    expect(w.state.chat).toMatchObject({ working: false, ended })
    expect(w.state.hearth.relaunches).toBe(1)
  })
})

describe('what stops them', () => {
  test('a failure waits 20 s, three stop it with one toast, and the next turn starts over', SLOW, async ($, on) => {
    const { w, h, forks, reply } = hearthWorld(on)
    h.fork = () => answers.overloaded
    await start($)
    await reply($)
    await w.clock.advance(FIVE - 45_000)
    expect(forks).toHaveLength(1)
    expect(w.state.hearth).toMatchObject({ failures: 1, warmStop: null })
    await w.clock.advance(19_999)
    expect(forks).toHaveLength(1)
    await w.clock.advance(1)
    expect(forks).toHaveLength(2)
    await w.clock.advance(20_000)
    expect(forks).toHaveLength(3)
    expect(w.state.hearth).toMatchObject({ warmStop: 'failed', failures: 3, warmError: 'overloaded 529' })
    await w.clock.advance(HOUR)
    expect(forks).toHaveLength(3)
    expect(w.toasts.filter(text => text.includes('3 essais'))).toHaveLength(1)
    await reply($)
    await w.clock.advance(FIVE - 45_000)
    expect(forks).toHaveLength(4)
    await w.clock.advance(40_000)
    expect(w.toasts.filter(text => text.includes('3 essais')), 'never told twice').toHaveLength(1)
  })

  test('a call that throws counts as a failure', async ($, on) => {
    const { w, h, reply } = hearthWorld(on)
    h.fork = () => {
      throw new Error('no line')
    }
    await start($)
    await reply($)
    await w.clock.advance(FIVE - 45_000)
    expect(w.state.hearth).toMatchObject({ failures: 1, warmError: 'erreur' })
  })

  test('a reply with no words read the conversation all the same', async ($, on) => {
    const { w, h, reply } = hearthWorld(on)
    h.fork = () => ({ value: { isAnswered: false, reason: 'empty-reply', usage: READ } })
    await start($)
    await reply($)
    await w.clock.advance(FIVE - 45_000)
    expect(w.state.hearth).toMatchObject({ relaunches: 1, failures: 0, keeper: 'log' })
  })

  test('nothing to read stops them, silently', async ($, on) => {
    const { w, h, forks, reply } = hearthWorld(on)
    h.fork = () => answers.nothing
    await start($)
    await reply($)
    await w.clock.advance(FIVE)
    expect(forks).toHaveLength(1)
    expect(w.state.hearth.warmStop).toBe('nothing')
    expect(w.toasts).toEqual([])
  })

  test('a relaunch that had to write stops at once', SLOW, async ($, on) => {
    const { w, h, forks, reply } = hearthWorld(on)
    h.fork = () => answers.reply('ok', REWRITE)
    await start($)
    await reply($)
    await w.clock.advance(FIVE - 45_000)
    await w.clock.advance(FIVE)
    expect(forks).toHaveLength(1)
    expect(w.state.hearth.warmStop).toBe('cold')
  })

  test('never on a cold cache: turning them back on after the end sends nothing', SLOW, async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    await command($, 'warm off')
    await reply($)
    await w.clock.advance(FIVE + 1000)
    await command($, 'warm on')
    await w.clock.advance(HOUR)
    expect(forks).toEqual([])
  })

  test('after a change of model the cache is not there to read', async ($, on) => {
    const { w, h, forks, reply } = hearthWorld(on)
    await start($)
    await reply($)
    h.model = 'sonnet'
    await w.clock.advance(FIVE)
    expect(forks).toEqual([])
    expect(w.state.hearth).toMatchObject({ coolsAt: null, warmStop: 'cold' })
  })

  test('off in the settings file: no call at all, and the fire still follows the clock', async ($, on) => {
    const { w, forks, reply } = hearthWorld(on, { files: { [SETTINGS_FILE]: JSON.stringify({ warm: false }) } })
    await start($)
    await reply($)
    expect(w.state.settings.warm).toBe(false)
    await w.clock.advance(FIVE * 2)
    expect(forks).toEqual([])
    expect(w.state.hearth.fire).toBe('out')
  })

  test('a hidden pane is a matter of display: the relaunches go on', async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    await command($, 'hide')
    await reply($)
    await w.clock.advance(FIVE - 45_000)
    expect(forks).toEqual([PING])
  })

  test('a mod masked by an error asks the model for nothing, until it draws again', async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    await reply($)
    w.refuseStateRead.add('news')
    await mountBand($).catch(() => undefined)
    await w.clock.advance(FIVE - 45_000)
    expect(forks).toEqual([])
    w.refuseStateRead.clear()
    await mountBand($)
    await w.clock.advance(5000)
    expect(forks).toEqual([PING])
  })

  test('a hearth that cannot be published is the same as a hearth nobody sees', async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    w.refuseState.add('hearth')
    await reply($)
    await w.clock.advance(FIVE)
    expect(forks).toEqual([])
  })
})
