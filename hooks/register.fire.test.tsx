import { describe, expect, test } from 'claude-code/testing'

import { FIVE, HELD_HEARTH, HOUR, TOO_BIG, TRANSCRIPT, hearthWorld, lengthLine } from './test-hearth'
import { HOME, LOG_FILE, NOON, SETTINGS_FILE, command, endTurn, spawn, start, startTurn, usage } from './test-kit'

const PING = 'Answer only: ok'

describe('the length of the cache', () => {
  const unknown = (on: any, more: object = {}) => {
    const t = hearthWorld(on, { files: TOO_BIG, ...more })
    t.w.refuseRead = /\.jsonl$/
    return t
  }

  test('known 5 min: relaunches 45 s before the five minutes', { timeoutMs: 30000 }, async ($, on) => {
    const { w, forks, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await w.clock.advance(FIVE - 45_001)
    expect(forks).toEqual([])
    await w.clock.advance(1)
    expect(forks).toEqual([PING])
    expect(w.state.hearth.lengthMs).toBe(FIVE)
  })

  test('while the fire burns the pane beats every 5 s, so an open card keeps its time', async ($, on) => {
    const { w, reply } = hearthWorld(on)
    await start($)
    await reply($)
    await w.clock.advance(5_000)
    const beat = w.state.cardClock
    await w.clock.advance(5_000)
    expect(w.state.cardClock).toBe(beat + 1)
  })

  test('no beat while the length of the cache is unknown: the card has no time to keep', async ($, on) => {
    const { w, reply } = unknown(on)
    await start($)
    await reply($)
    await w.clock.advance(15_000)
    expect(w.state.cardClock).toBeUndefined()
  })

  test('known 1 h: relaunches 45 s before the hour, and not before', { timeoutMs: 30000 }, async ($, on) => {
    const { w, forks, reply } = hearthWorld(on, { files: { [TRANSCRIPT]: lengthLine('ephemeral_1h_input_tokens') } })
    await start($)
    await w.clock.settle()
    await reply($)
    await w.clock.advance(FIVE * 2)
    expect(forks).toEqual([])
    await w.clock.advance(HOUR - 45_000 - FIVE * 2 - 1)
    expect(forks).toEqual([])
    await w.clock.advance(1)
    expect(forks).toEqual([PING])
    expect(w.state.hearth.lengthMs).toBe(HOUR)
  })

  const turn = async ($: any, spend: any, read: number, written: number) => {
    await startTurn($)
    await spend($, usage(10, 10, read, written))
    await endTurn($)
  }

  test('unknown on a big transcript: no relaunch at all, the fire stays a bound, the words say why', { timeoutMs: 30000 }, async ($, on) => {
    const { w, forks, reply } = unknown(on)
    await start($)
    await reply($)
    await w.clock.advance(FIVE)
    expect(w.state.hearth).toMatchObject({ lengthMs: 0, coolsAt: NOON + HOUR, fire: 'full', relaunchStop: null })
    expect((await command($, 'fire')).text).toContain('La durée du cache n’est pas encore connue')
    await w.clock.advance(HOUR)
    expect(forks).toEqual([])
    expect(w.state.hearth.fire).toBe('out')
  })

  test('an active session is no exception', { timeoutMs: 30000 }, async ($, on) => {
    const { w, forks, reply } = unknown(on)
    await start($)
    await reply($)
    await spawn($, w, 'a1')
    await w.clock.advance(HOUR + FIVE)
    expect(forks).toEqual([])
    expect(w.state.hearth.active).toBe(true)
  })

  test('a turn past five minutes that reads the cache proves the hour, at no cost', { timeoutMs: 30000 }, async ($, on) => {
    const { w, forks, spend } = unknown(on)
    await start($)
    await turn($, spend, 100, 90_000)
    await w.clock.advance(FIVE + 1000)
    const sentAt = w.clock.now()
    await turn($, spend, 90_000, 100)
    await w.clock.advance(1)
    expect(w.state.hearth).toMatchObject({ lengthMs: HOUR, coolsAt: sentAt + HOUR })
    expect(forks).toEqual([])
    await w.clock.advance(HOUR - 45_000 - 2)
    expect(forks).toEqual([])
    await w.clock.advance(1)
    expect(forks).toEqual([PING])
  })

  test('a turn past five minutes that writes it all again proves five minutes', async ($, on) => {
    const { w, forks, spend } = unknown(on)
    await start($)
    await turn($, spend, 100, 90_000)
    await w.clock.advance(FIVE + 1000)
    const sentAt = w.clock.now()
    await turn($, spend, 100, 90_000)
    await w.clock.advance(1)
    expect(w.state.hearth).toMatchObject({ lengthMs: FIVE, coolsAt: sentAt + FIVE })
    await w.clock.advance(FIVE - 45_000 - 1)
    expect(forks).toEqual([PING])
  })

  test('nothing is proven within five minutes, past the hour, or across a change of model', { timeoutMs: 30000 }, async ($, on) => {
    const { w, stage, spend } = unknown(on)
    await start($)
    await turn($, spend, 100, 90_000)
    await w.clock.advance(FIVE - 1000)
    await turn($, spend, 90_000, 100)
    await w.clock.advance(1)
    expect(w.state.hearth.lengthMs, 'within five minutes').toBe(0)
    await w.clock.advance(HOUR + 1000)
    await turn($, spend, 100, 90_000)
    await w.clock.advance(1)
    expect(w.state.hearth.lengthMs, 'past the hour').toBe(0)
    await w.clock.advance(FIVE + 1000)
    stage.model = 'sonnet'
    await turn($, spend, 100, 90_000)
    await w.clock.advance(1)
    expect(w.state.hearth.lengthMs, 'a new model writes anyway').toBe(0)
  })

  test('a proven length stays for the session through a reload, an unknown one stays unknown', async ($, on) => {
    const hearth = { ...HELD_HEARTH(NOON), lengthMs: HOUR, coolsAt: NOON + 50_000 }
    const { w, forks } = unknown(on, { held: { hearth } })
    await start($)
    await w.clock.advance(5001)
    expect(forks).toEqual([PING])
    expect(w.state.hearth.lengthMs).toBe(HOUR)
  })

  test('an unknown one stays unknown through a reload', async ($, on) => {
    const hearth = { ...HELD_HEARTH(NOON), lengthMs: 0, coolsAt: NOON + 50_000 }
    const { w, forks } = unknown(on, { held: { hearth } })
    await start($)
    await w.clock.advance(FIVE)
    expect(forks).toEqual([])
    expect(w.state.hearth.lengthMs).toBe(0)
  })
})

describe('/pixeldesk fire', () => {
  test('says where it stands, in the words of the state', async ($, on) => {
    const { w, reply } = hearthWorld(on)
    await start($)
    expect((await command($, 'fire')).text).toBe('La relance du cache est en marche. Le cache est froid : rien à relancer avant ta prochaine réponse. 0 relance depuis la dernière réponse.')
    await reply($)
    await w.clock.advance(30_000)
    expect((await command($, 'fire')).text).toContain('Temps restant : 4:30.')
  })

  test('off and on save the setting and keep the other keys', async ($, on) => {
    const { w } = hearthWorld(on, { files: { [SETTINGS_FILE]: JSON.stringify({ theme: 'night' }) } })
    await start($)
    expect((await command($, 'fire off')).text).toBe('Relance du cache coupée dans toutes les conversations. Le feu suivra la durée du cache.')
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'night', fire: false })
    expect((await command($, 'fire')).text).toBe('La relance du cache est coupée. Remets-la avec /pixeldesk fire on.')
    await command($, 'FIRE ON')
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'night', fire: true })
  })

  test('a broken file reads as no change, and a write replaces it', async ($, on) => {
    const { w } = hearthWorld(on, { files: { [SETTINGS_FILE]: '{ not json' } })
    await start($)
    expect(w.state.settings.fire).toBe(true)
    await command($, 'fire off')
    expect(w.json(SETTINGS_FILE)).toEqual({ fire: false })
  })

  test('a word it does not know changes nothing', async ($, on) => {
    const { w } = hearthWorld(on)
    await start($)
    expect((await command($, 'fire maybe')).text).toBe('Valeur inconnue. Utilise /pixeldesk fire, /pixeldesk fire on ou /pixeldesk fire off.')
    expect(w.file(SETTINGS_FILE)).toBeUndefined()
  })

  test('a setting changed elsewhere is followed within 3 s', async ($, on) => {
    const { w } = hearthWorld(on, { env: { USERPROFILE: HOME, LANG: 'fr_FR' } })
    await start($)
    w.files.set(SETTINGS_FILE, JSON.stringify({ fire: false, briefingMode: 'manual', compactBefore: 'always' }))
    await w.clock.advance(3000)
    expect(w.state.settings).toMatchObject({ fire: false, briefingMode: 'manual', compactBefore: 'always' })
    expect(w.state.hearth.compactTarget).toBe('always')
  })
})

describe('after a reload', () => {
  const held = { lengthMs: FIVE, coolsAt: NOON + 100_000, relaunches: 3, relaunchSince: NOON - 1000, failures: 1, relaunchStop: null, relaunchError: 'overloaded', keeperRun: 3, contextPercent: 40, compactions: 2 }

  test('the clock and the counts go on, and no relaunch is left half sent', async ($, on) => {
    const { w, forks } = hearthWorld(on, { held: { hearth: held } })
    await start($)
    await w.clock.advance(1)
    expect(w.state.hearth).toMatchObject({ coolsAt: NOON + 100_000, relaunches: 3, compactions: 2, failures: 1 })
    await w.clock.advance(54_999)
    expect(forks).toEqual([PING])
    expect(w.state.hearth.relaunches).toBe(4)
  })

  test('a cache that went cold during the reload is left alone', { timeoutMs: 30000 }, async ($, on) => {
    const { w, forks } = hearthWorld(on, { held: { hearth: { ...held, coolsAt: NOON - 1 } } })
    await start($)
    await w.clock.advance(HOUR)
    expect(forks).toEqual([])
    expect(w.state.hearth.fire).toBe('out')
  })

  test('a restart holds no clock: never a relaunch on a cache nobody can vouch for', { timeoutMs: 30000 }, async ($, on) => {
    const { w, forks } = hearthWorld(on)
    await start($)
    await w.clock.advance(HOUR)
    expect(forks).toEqual([])
    expect(w.log()).not.toContain('relaunch')
    expect(w.file(LOG_FILE) ?? '').not.toContain('TRACE')
  })
})
