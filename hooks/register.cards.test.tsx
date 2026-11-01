import { describe, expect, test } from 'claude-code/testing'

import { SETTINGS_FILE, altOf, endTurn, kids, mountBand, mountPane, spawn, start, textsOf } from './test-kit'
import { MANUAL, hearthWorld } from './test-hearth'

const svgs = (el: any): any[] => [...(el.type === 'Svg' ? [el] : []), ...kids(el).flatMap(svgs)]

async function offered($: any, on: any, percent = 81) {
  const t = hearthWorld(on, { files: MANUAL })
  t.fill(percent)
  await start($)
  await t.reply($)
  await t.w.clock.advance(1000)
  return t
}

describe('the row above the band', () => {
  test('nothing to say, nothing drawn, and the band stays where it was', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await start($)
    const ui = await mountBand($)
    expect(await ui.findAll({ key: 'briefing-row' })).toEqual([])
    expect(await ui.findAll({ type: 'Button' })).toEqual([])
    expect(t.w.state.briefing.phase).toBe('idle')
  })

  test('a plain image the width of the band, that says what it shows', async ($, on) => {
    await offered($, on)
    const ui = await mountBand($, 'desktop', { bodyColumns: 100 })
    const drawings = await ui.findAll({ type: 'Svg' })
    const [row, band] = [drawings[0], drawings[drawings.length - 1]]
    expect(row.props).toMatchObject({ width: 810, height: 34 })
    expect(row.props.alt.length > 0).toBe(true)
    expect(row.props.isInteractive).toBeUndefined()
    expect(band.props.isInteractive, 'the band keeps its own').toBe(true)
  })

  test('the Buttons lie over the drawing, blank, keyed by gesture: the words are in the drawing', async ($, on) => {
    await offered($, on, 86)
    const ui = await mountBand($, 'desktop', { bodyColumns: 100 })
    const buttons = await ui.findAll({ type: 'Button' })
    const change = buttons.find((b: any) => b.props.key === 'briefing-change')
    expect(change.props.plain).toBe(true)
    expect(change.props.label.trim()).toBe('')
    expect(await altOf(ui, 'briefing-row')).toContain('Déménager')
  })

  test('alone, the row eats the edge of the frame, and the band stays against it', async ($, on) => {
    const t = await offered($, on)
    t.w.beneath = 'engine'
    const ui = await mountBand($, 'desktop', { bodyColumns: 100 })
    expect((await ui.find({ key: 'briefing-row' })).props.marginTop).toBe(-1)
    expect((await ui.find({ key: 'idle-band' })).props.marginTop).toBe(0)
  })

  test('under another mod, the row keeps clear of it', async ($, on) => {
    await offered($, on)
    const ui = await mountBand($, 'desktop', { bodyColumns: 100 })
    expect((await ui.find({ key: 'briefing-row' })).props.marginTop).toBe(1)
  })

  test('no drawing waits under the pointer: above the prompt it would float away, in a bubble', async ($, on) => {
    await offered($, on)
    const ui = await mountBand($, 'desktop', { bodyColumns: 100 })
    const zone = await ui.find({ key: 'briefing-change-zone' })
    expect(zone.props).toMatchObject({ overflow: 'hidden' })
    expect(svgs(zone)).toEqual([])
    expect(kids(zone).map((el: any) => el.type)).toEqual(['Button'])
  })

  test('the terminal keeps its words and its buttons, with no drawing', async ($, on) => {
    await offered($, on)
    const ui = await mountBand($, 'terminal')
    expect((await textsOf(ui)).join(' ')).toContain('Contexte à 81 %')
    expect(await ui.findAll({ type: 'Svg' })).toEqual([])
    expect((await ui.findAll({ type: 'Button' })).map((b: any) => b.props.label)).toEqual(['Déménager', 'Fermer'])
  })

  test('so does a phone', async ($, on) => {
    await offered($, on)
    const ui = await mountBand($, 'mobile')
    expect((await textsOf(ui)).join(' ')).toContain('Contexte à 81 %')
  })

  test('while it waits, the count is said to a reader, and the urgent button says so', async ($, on) => {
    const t = await offered($, on, 86)
    await spawn($, t.w, 'a1')
    await ui_press($, 'briefing-change')
    await t.w.clock.settle()
    const ui = await mountBand($, 'desktop', { bodyColumns: 100 })
    expect((await ui.findAll({ type: 'Button' })).some((b: any) => b.props.key === 'briefing-now')).toBe(true)
    expect(await altOf(ui, 'briefing-row')).toContain('Changer maintenant (1 en cours)')
    expect(await altOf(ui, 'briefing-row')).toContain('Contexte presque plein : 1 agent continue ici')
    await endTurn($, { agentId: 'a1' })
  })
})

async function ui_press($: any, key: string) {
  const ui = await mountBand($, 'desktop', { bodyColumns: 100 })
  await ui.press({ key })
  await ui.unmount()
}

describe('the settings', () => {
  async function opened($: any, on: any, files: Record<string, string> = {}) {
    const t = hearthWorld(on, { files })
    await start($)
    const ui = await mountPane($, 'desktop', { bodyColumns: 100, scroll: { offset: 0, bodyRows: 40 } })
    await ui.press({ key: 'settings-button-0' })
    return { ...t, ui }
  }

  test('296 by 542 with its cursor, 470 once `Manuel` hides it', async ($, on) => {
    const { ui } = await opened($, on)
    const tall = (await ui.find({ key: 'settings-panel' })).props.height
    expect(await ui.find({ key: 'settings-zone-hearth-compact-1' })).toBeDefined()
    await ui.press({ key: 'hearth-mode-manual' })
    expect((await ui.find({ key: 'settings-panel' })).props.height < tall).toBe(true)
    expect(await ui.findAll({ key: 'settings-zone-hearth-compact-1' })).toEqual([])
  })

  test('the cache is one box: a press turns it off, the next turns it on', async ($, on) => {
    const { w, ui } = await opened($, on)
    await ui.press({ key: 'hearth-fire-off' })
    expect(w.json(SETTINGS_FILE).fire).toBe(false)
    await ui.press({ key: 'hearth-fire-on' })
    expect(w.json(SETTINGS_FILE).fire).toBe(true)
  })

  test('every step of the cursor answers, and the chosen one has no hover', async ($, on) => {
    const { w, ui } = await opened($, on)
    for (const [key, value] of [['hearth-compact-0', 0], ['hearth-compact-3', 3], ['hearth-compact-always', 'always'], ['hearth-compact-1', 1]] as const) {
      await ui.press({ key })
      expect(w.json(SETTINGS_FILE).compactBefore).toBe(value)
    }
    expect(kids(await ui.find({ key: 'settings-zone-hearth-compact-1' }))).toHaveLength(1)
    expect(kids(await ui.find({ key: 'settings-zone-hearth-compact-2' }))).toHaveLength(2)
  })

  test('each box revealed under the pointer is as big as what it covers, in a column, with a drawing that says something', async ($, on) => {
    const { ui } = await opened($, on)
    const panel = await ui.find({ key: 'settings-panel' })
    const zones = kids(panel).filter((el: any) => /^settings-zone-/.test(el.props?.key ?? ''))
    const lit = zones.flatMap((zone: any) => kids(zone).filter((el: any) => el.hover))
    expect(lit.length, 'an option and the four other steps, at the least').toBeGreaterThan(4)
    for (const box of lit) {
      expect(box.props).toMatchObject({ position: 'absolute', display: 'none', flexDirection: 'column' })
      expect(typeof box.props.width).toBe('number')
      expect(typeof box.props.height).toBe('number')
      const [drawing] = svgs(box)
      expect(drawing.props.alt.length > 0).toBe(true)
      expect(drawing.props.width).toBe(box.props.width * 8)
      expect(drawing.props.height).toBe(box.props.height * 21)
      expect(drawing.props.isInteractive).toBeUndefined()
    }
  })
})
