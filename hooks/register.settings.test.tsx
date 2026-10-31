import { describe, expect, test } from 'claude-code/testing'

import { PRESS_ZONES, ZONE_ROWS } from './view-settings'
import { ENGLISH, FRENCH, HOME, LOG_FILE, NOON, SETTINGS_FILE, altOf, callTool, endTurn, hasKey, kids, mountPane, sendPlan, sourceOf, spawn, start, step, world } from './test-kit'

const NO_BREAK = /^\u00A0+$/
const press = (ui: any, key: string) => ui.press({ key })
const LOCAL = 'C:\\Users\\test\\AppData\\Local'
const DATA = '/Users/test/AppData/Local/Claude-Data/profile/claude-code-sessions'
const session = (id: string, cli: string, parent?: string) => JSON.stringify({ sessionId: id, cliSessionId: cli, title: id, ...(parent ? { spawnedFrom: { sessionId: parent } } : {}) })
const FLOOR = {
  env: { USERPROFILE: HOME, LANG: 'fr_FR', LOCALAPPDATA: LOCAL },
  files: { [`${DATA}/local_me.json`]: session('me', 'session-1'), [`${DATA}/local_kid.json`]: session('kid', 'kid', 'me') },
}

describe('the button', () => {
  test('a zone in cells, plain blank buttons, and the panel closed', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($)
    expect((await ui.find({ key: 'settings-button' })).props).toMatchObject({ position: 'absolute', left: 1, top: 0, width: 4, height: 2 })
    expect((await ui.find({ key: 'settings-look' })).props).toMatchObject({ position: 'absolute', left: 1, top: 0, width: 5, height: 2 })
    expect(await altOf(ui, 'settings-look')).toBe('Réglages')
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.map((b: any) => b.props.key)).toEqual(['settings-button-0', 'settings-button-1'])
    for (const b of buttons) {
      expect(b.props.plain).toBe(true)
      expect(b.props.label).toMatch(NO_BREAK)
      expect(b.props.label).toHaveLength(12)
    }
    expect(await hasKey(ui, 'settings-panel')).toBe(false)
  })

  test('the rows of a zone stack in a column that does not shrink, clipped to the zone', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($)
    const zone = kids(await ui.find({ key: 'settings-button' })).pop()
    expect(zone.props).toMatchObject({ position: 'absolute', overflow: 'hidden', width: 4, height: 2 })
    expect(kids(zone)[0].props).toMatchObject({ flexDirection: 'column', flexShrink: 0 })
    for (const button of kids(kids(zone)[0])) expect(button.hover).toEqual({ backgroundColor: 'transparent' })
  })

  test('three looks: the hover one hidden in the zone, gone while the panel is open', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($)
    const normal = await sourceOf(ui, 'settings-look')
    const hover = kids(await ui.find({ key: 'settings-button' }))[0]
    expect(hover).toMatchObject({ props: { display: 'none' }, hover: { display: 'flex' } })
    const look = await ui.find({ key: 'settings-look' })
    expect({ left: hover.props.left, top: hover.props.top, width: hover.props.width, height: hover.props.height }).toEqual({ left: 0, top: 0, width: look?.props.width, height: look?.props.height })
    expect(hover.props.key).toBeUndefined()
    await press(ui, 'settings-button-0')
    expect(await sourceOf(ui, 'settings-look')).not.toBe(normal)
    expect(await altOf(ui, 'settings-look')).toBe('Fermer les réglages')
    expect(kids(await ui.find({ key: 'settings-button' }))).toHaveLength(1)
  })

  test('opening and closing leaves the room as it is, the second press closes', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const ui = await mountPane($)
    const [source, alt] = [await sourceOf(ui), await altOf(ui)]
    await press(ui, 'settings-button-1')
    expect(w.state.settings.open).toBe(true)
    expect(await altOf(ui, 'settings-panel')).toBe("Réglages. Départ des bureaux. Fin du plan, choisi. Au fil de l'eau. Cache. Garder le cache au chaud, choisi. Passation. Automatique, choisi. Manuel. Compacte 2 fois, puis change de conversation. Thème. Cosy, choisi.")
    expect([await sourceOf(ui), await altOf(ui)]).toEqual([source, alt])
    await press(ui, 'settings-button-0')
    expect(await hasKey(ui, 'settings-panel')).toBe(false)
    expect([await sourceOf(ui), await altOf(ui)]).toEqual([source, alt])
  })

  test('every drawn row of each zone answers, and the hook gives the element back', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    expect(await press(ui, 'settings-button-1')).toEqual({ element: 'settings-button-1' })
    expect(w.state.settings.open).toBe(true)
    for (const [key, departure] of [['settings-each-0', 'each'], ['settings-plan-0', 'plan'], ['settings-each-1', 'each'], ['settings-plan-2', 'plan']] as const) {
      await press(ui, key)
      expect(w.state.settings.departure).toBe(departure)
    }
    expect(ZONE_ROWS, 'a hook for six rows of each zone, whatever a pane draws').toBe(6)
    expect(PRESS_ZONES).toEqual(['settings-button', 'settings-plan', 'settings-each'])
  })

  test('a press elsewhere does nothing: the pane has no other button', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    await press(ui, 'settings-button-0')
    for (const button of await ui.findAll({ type: 'Button' })) expect(button.props.key).toMatch(/^(settings-(button|plan|each)-\d|hearth-(fire-on|fire-off|mode-auto|mode-manual|compact-[0-3]|compact-always)(-\d)?|theme-[a-z]+(-\d)?)$/)
    expect(w.state.settings.open).toBe(true)
  })
})

describe('the panel', () => {
  async function opened($: any, on: any, options: any = {}, props: any = {}) {
    const w = world(on, options)
    await start($)
    const ui = await mountPane($, 'desktop', props)
    await press(ui, 'settings-button-0')
    return { w, ui }
  }

  test('its zones are placed relative to it, the option not chosen lit under the pointer', async ($, on) => {
    const { ui } = await opened($, on)
    const panel = await ui.find({ key: 'settings-panel' })
    expect(panel.props).toMatchObject({ position: 'absolute', left: 1, top: 2 })
    expect((await ui.find({ key: 'settings-zone-plan' })).props).toMatchObject({ position: 'absolute', left: 2, top: 3, width: 25, height: 3 })
    expect((await ui.find({ key: 'settings-zone-each' })).props).toMatchObject({ position: 'absolute', left: 2, top: 6, width: 25, height: 2 })
    expect(kids(await ui.find({ key: 'settings-zone-plan' })).map((el: any) => el.props.key)).toEqual(['settings-plan'])
    const [lit, zone] = kids(await ui.find({ key: 'settings-zone-each' }))
    expect(zone.props.key).toBe('settings-each')
    expect(lit).toMatchObject({ props: { display: 'none' }, hover: { display: 'flex' } })
    expect(lit.props.key).toBeUndefined()
    expect(kids(lit)[0].props.alt).toBe('Réglages')
  })

  test('an option saves, keeps the other keys, the panel stays, any row answers', async ($, on) => {
    const { w, ui } = await opened($, on, { files: { [SETTINGS_FILE]: '{"theme":"night","hidden":true}' } })
    const [source, alt] = [await sourceOf(ui), await altOf(ui)]
    await press(ui, 'settings-each-1')
    expect(w.file(SETTINGS_FILE)).toBe('{\n  "theme": "night",\n  "hidden": true,\n  "departure": "each"\n}\n')
    expect(w.state.settings).toEqual({ open: true, departure: 'each', fire: true, briefingMode: 'auto', compactBefore: 2, theme: 'cosy' })
    expect(await altOf(ui, 'settings-panel')).toBe("Réglages. Départ des bureaux. Fin du plan. Au fil de l'eau, choisi. Cache. Garder le cache au chaud, choisi. Passation. Automatique, choisi. Manuel. Compacte 2 fois, puis change de conversation. Thème. Cosy, choisi.")
    expect([await sourceOf(ui), await altOf(ui)]).toEqual([source, alt])
    await press(ui, 'settings-each-0')
    expect(w.json(SETTINGS_FILE).departure, 'the same again').toBe('each')
    await press(ui, 'settings-plan-2')
    expect(w.json(SETTINGS_FILE).departure).toBe('plan')
  })

  test('an unreadable file is written anew', async ($, on) => {
    for (const broken of ['{not json', '[1,2]']) {
      const { w, ui } = await opened($, on, { files: { [SETTINGS_FILE]: broken } })
      await press(ui, 'settings-each-0')
      expect(w.json(SETTINGS_FILE)).toEqual({ departure: 'each' })
      return
    }
  })

  test('a write that fails goes to the log, and the choice holds here', async ($, on) => {
    const { w, ui } = await opened($, on)
    w.refuseWrite = /settings\.json/
    await press(ui, 'settings-each-0')
    expect(w.state.settings.departure).toBe('each')
    expect(w.file(LOG_FILE)).toContain('settings file')
    await w.clock.advance(3000)
    expect(w.state.settings.departure, 'until the next read').toBe('plan')
  })

  test('a choice applies at once, with no zoom', async ($, on) => {
    const { w, ui } = await opened($, on)
    await sendPlan($, [step('One', 'in_progress')], 'Job')
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1' })
    await ui.redraw()
    await w.clock.advance(60_000)
    expect(w.state.agents).toHaveLength(1)
    await press(ui, 'settings-each-0')
    expect(w.state.agents).toEqual([])
    expect(w.state.seen.shown).toBe(0)
    expect(await sourceOf(ui)).not.toContain('attributeName="viewBox"')
  })

  test('the timer of the departures is put right', async ($, on) => {
    const { w, ui } = await opened($, on)
    await sendPlan($, [step('One', 'in_progress')], 'Job')
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1' })
    await press(ui, 'settings-each-0')
    expect(w.state.agents, 'not yet due').toHaveLength(1)
    await w.clock.advance(30_000)
    expect(w.state.agents).toEqual([])
  })

  test('a value from another conversation arrives at the pass, a broken file changes nothing', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress')], 'Job')
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1' })
    await w.clock.advance(60_000)
    w.files.set(SETTINGS_FILE, '{broken')
    await w.clock.advance(3000)
    expect(w.state.settings.departure).toBe('plan')
    w.files.set(SETTINGS_FILE, '{"departure":"each"}')
    await w.clock.advance(3000)
    expect(w.state.settings.departure).toBe('each')
    expect(w.state.agents).toEqual([])
    w.files.set(SETTINGS_FILE, '{broken')
    await w.clock.advance(3000)
    expect(w.state.settings.departure).toBe('each')
    w.refuseRead = /settings\.json/
    await w.clock.advance(3000)
    expect(w.state.settings.departure).toBe('each')
    w.refuseRead = null
    w.files.set(SETTINGS_FILE, '[]')
    await w.clock.advance(3000)
    expect(w.state.settings.departure, 'valid JSON of another shape').toBe('plan')
  })

  test('it closes at each start, and its state never reaches the disk', async ($, on) => {
    const { w, ui } = await opened($, on)
    await start($)
    expect(w.state.settings.open).toBe(false)
    expect(await hasKey(ui, 'settings-panel')).toBe(false)
    expect(w.file(SETTINGS_FILE)).toBeUndefined()
  })

  test('no zone stays under it, it comes last, and the root keeps its height', async ($, on) => {
    const { w, ui } = await opened($, on, {}, { bodyColumns: 80, scroll: { offset: 0, bodyRows: 30 } })
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']) await spawn($, w, id)
    await sendPlan($, [step('One', 'in_progress')], 'Job')
    await ui.redraw()
    const root = await ui.find({ key: 'room' })
    const panel = await ui.find({ key: 'settings-panel' })
    const [right, bottom] = [panel.props.left + panel.props.width, panel.props.top + panel.props.height]
    const names = kids(root).map((el: any) => el.props?.key ?? el.type)
    expect(names[names.length - 1]).toBe('settings-panel')
    for (const zone of kids(root).filter((el: any) => /^desk-/.test(el.props?.key ?? ''))) {
      expect(zone.props.left >= right || zone.props.top >= bottom, zone.props.key).toBe(true)
    }
    expect(root.props).toMatchObject({ height: 30, overflow: 'hidden' })
  })

  test('a desk under the panel gets its zone back when it closes', async ($, on) => {
    const { w, ui } = await opened($, on, {}, { bodyColumns: 34, scroll: { offset: 0, bodyRows: 30 } })
    await sendPlan($, [step('One', 'in_progress')], 'Job')
    for (const id of ['a1', 'a2', 'a3', 'a4']) await spawn($, w, id)
    await ui.redraw()
    expect(await hasKey(ui, 'desk-a1')).toBe(false)
    expect(await hasKey(ui, 'plan-lines'), 'the panel reaches the board').toBe(false)
    await press(ui, 'settings-button-0')
    expect(await hasKey(ui, 'desk-a1')).toBe(true)
    expect(await hasKey(ui, 'plan-lines')).toBe(true)
  })
})

describe('where the button lives', () => {
  const SETTINGS_KEYS = ['settings-look', 'settings-button', 'settings-panel', 'settings-zone-plan', 'settings-zone-each']

  test('not on a phone, and the room leaves no corner for it', async ($, on) => {
    world(on)
    await start($, 'mobile')
    const ui = await mountPane($, 'mobile')
    for (const key of SETTINGS_KEYS) expect(await hasKey(ui, key)).toBe(false)
    expect(await ui.findAll({ type: 'Button' })).toEqual([])
  })

  test('nor in the terminal', async ($, on) => {
    world(on)
    await start($, 'terminal')
    const ui = await mountPane($, 'terminal')
    for (const key of SETTINGS_KEYS) expect(await hasKey(ui, key)).toBe(false)
  })

  test('and on the floor, as in a room', async ($, on) => {
    const w = world(on, FLOOR)
    await start($)
    await w.clock.advance(5000)
    const ui = await mountPane($)
    expect(await hasKey(ui, 'floor')).toBe(true)
    expect(await hasKey(ui, 'settings-button')).toBe(true)
  })

  test('the room asks to keep its corner clear on the desktop only', async ($, on) => {
    world(on)
    await start($)
    const desktop = await sourceOf(await mountPane($))
    const phone = await sourceOf(await mountPane($, 'mobile'))
    expect(desktop).not.toBe(phone)
  })
})

describe('the shapes of the engine', () => {
  test('turn.start carries turnId and answers it; the hook lets it through', async ($, on) => {
    world(on)
    await start($)
    expect(await $.turn.start({ text: '', turnId: 't1' })).toEqual({ turnId: 't1' })
    expect(await $.turn.start({ text: 'hello', turnId: 't2', agentId: 'a1' })).toEqual({ turnId: 't2' })
  })

  test('a turn with no typed prompt, a continuation, is a turn all the same', async ($, on) => {
    const w = world(on)
    await start($)
    await $.turn.start({ text: '', turnId: 'continued' })
    expect(w.state.chat.working).toBe(true)
  })

  test('Button is resolved on the desktop table, and ui.press reaches the mod by its key', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    expect(await ui.press({ key: 'settings-button-0' })).toEqual({ element: 'settings-button-0' })
    expect(w.state.settings.open).toBe(true)
  })
})

describe('in both languages', () => {
  test('the alternative in English', async ($, on) => {
    world(on, { env: ENGLISH })
    await start($)
    const ui = await mountPane($)
    await press(ui, 'settings-button-0')
    expect(await altOf(ui, 'settings-panel')).toBe('Settings. When desks leave. End of plan, selected. As they finish. Cache. Keep the fire going, selected. Briefing. Automatic, selected. Manual. Compacts twice, then changes conversation. Theme. Cosy, selected.')
    expect(await altOf(ui, 'settings-look')).toBe('Close settings')
  })

  test('a choice reads in French', async ($, on) => {
    world(on, { env: FRENCH, files: { [SETTINGS_FILE]: '{"departure":"each"}' } })
    await start($)
    const ui = await mountPane($)
    await press(ui, 'settings-button-0')
    expect(await altOf(ui, 'settings-panel')).toBe("Réglages. Départ des bureaux. Fin du plan. Au fil de l'eau, choisi. Cache. Garder le cache au chaud, choisi. Passation. Automatique, choisi. Manuel. Compacte 2 fois, puis change de conversation. Thème. Cosy, choisi.")
  })

  test('a call while the panel is open leaves it open', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    await press(ui, 'settings-button-0')
    await callTool($, 'Read', { file_path: 'a.ts' })
    await w.clock.advance(NOON % 1000 + 3000)
    expect(await hasKey(ui, 'settings-panel')).toBe(true)
  })
})
