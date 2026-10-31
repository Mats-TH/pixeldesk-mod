import { describe, expect, test } from 'claude-code/testing'

import { HOME, NOON, SESSION, SETTINGS_FILE, altOf, callTool, cardIn, hasKey, kids, mountBand, mountPane, receive, sendPlan, sourceOf, spawn, start, step, textsOf, world } from './test-kit'
import type { World, WorldOptions } from './test-kit'
import { floorBoxes } from './floor'

const STATE = '/Users/test/.claude/pixeldesk/state'
const DATA = '/Users/test/AppData/Local/Claude-Data/profile/claude-code-sessions'
const LOCAL = 'C:\\Users\\test\\AppData\\Local'
const ZOOM = 'attributeName="viewBox"'
const FADE = 'attributeName="opacity"'

const desk = (id: string, more: Record<string, unknown> = {}) => JSON.stringify({ sessionId: id, title: '', agents: 0, working: 0, summary: '', updatedAt: NOON, cwd: 'C:/work/app', desks: [], steps: [], tokens: 0, ...more })
const deskFile = (id: string) => `${STATE}/desk-${id}.json`
const session = (id: string, cli: string, title: string, parent?: string, more: Record<string, unknown> = {}) => JSON.stringify({ sessionId: id, cliSessionId: cli, title, ...(parent ? { spawnedFrom: { sessionId: parent } } : {}), ...more })

/** This conversation leads `kid`, as the desktop app knows it. */
const linked = (more: WorldOptions = {}, kid: Record<string, unknown> = {}) => ({
  env: { USERPROFILE: HOME, LANG: 'fr_FR', LOCALAPPDATA: LOCAL },
  ...more,
  files: {
    [`${DATA}/local_me.json`]: session('me', SESSION, 'Chef'),
    [`${DATA}/local_kid.json`]: session('kidl', 'kid', 'Enfant', 'me'),
    [deskFile('kid')]: desk('kid', kid),
    ...(more.files ?? {}),
  },
})

const beat = (w: World) => w.clock.advance(5000)
const ids = (w: World) => (w.state.floor ?? []).map((room: any) => room.id)
const reads = (w: World, part: string) => w.reads.filter(path => path.includes(part)).length

describe('reading the floor', () => {
  test('a conversation with children shows the floor, from the links', async ($, on) => {
    const w = world(on, linked())
    await start($)
    await beat(w)
    expect(ids(w)).toEqual([SESSION, 'kid'])
    expect(w.state.floor[1].title).toBe('Enfant')
    const ui = await mountPane($)
    expect(await hasKey(ui, 'floor')).toBe(true)
    expect(await hasKey(ui, 'room')).toBe(false)
  })

  test('it is read with the pane closed and no plan, not under an open plan', async ($, on) => {
    const w = world(on, linked())
    await start($, 'terminal')
    await sendPlan($, [step('One', 'in_progress')])
    await beat(w)
    expect(w.reads.filter(path => path.includes('Claude-Data'))).toEqual([])
    expect(reads(w, 'desk-kid')).toBe(0)
  })

  test('an open pane reads it under an open plan', async ($, on) => {
    const w = world(on, linked())
    await start($)
    await sendPlan($, [step('One', 'in_progress')])
    await beat(w)
    expect(ids(w)).toEqual([SESSION, 'kid'])
  })

  test('the state of the pane is asked for at each pass', async ($, on) => {
    const w = world(on, linked())
    await start($, 'terminal')
    await sendPlan($, [step('One', 'in_progress')])
    await beat(w)
    expect(w.state.floor).toBeUndefined()
    w.panes.add('pixeldesk')
    await beat(w)
    expect(ids(w)).toEqual([SESSION, 'kid'])
  })

  test('a finished plan does not stop the reading', async ($, on) => {
    const w = world(on, linked())
    await start($, 'terminal')
    await sendPlan($, [step('One', 'completed')])
    await beat(w)
    expect(ids(w)).toEqual([SESSION, 'kid'])
  })

  test('the links are read at the first pass, then at most once a minute', async ($, on) => {
    const w = world(on, linked())
    await start($)
    await beat(w)
    const first = w.lists.length
    expect(first).toBeGreaterThan(0)
    await beat(w)
    await beat(w)
    expect(w.lists.length).toBe(first)
    await w.clock.advance(60_000)
    expect(w.lists.length).toBeGreaterThan(first)
  })

  test('with no LOCALAPPDATA there are no links', async ($, on) => {
    const w = world(on, { files: { [deskFile('kid')]: desk('kid') } })
    await start($)
    await beat(w)
    expect(w.lists.filter(path => path.includes('Claude-Data'))).toEqual([])
  })

  test('with links, only their files are read', async ($, on) => {
    const w = world(on, linked({ files: { [deskFile('stranger')]: desk('stranger') } }))
    await start($)
    await beat(w)
    expect(reads(w, 'desk-kid')).toBeGreaterThan(0)
    expect(reads(w, 'desk-stranger')).toBe(0)
  })

  test('a conversation with no child reads no one\'s file', async ($, on) => {
    const w = world(on, {
      env: { USERPROFILE: HOME, LANG: 'fr_FR', LOCALAPPDATA: LOCAL },
      files: { [`${DATA}/local_me.json`]: session('me', SESSION, 'Alone'), [deskFile('other')]: desk('other') },
    })
    await start($)
    await beat(w)
    expect(reads(w, 'desk-other')).toBe(0)
    expect(ids(w)).toEqual([])
  })

  test('with no link every desk file is read, and the project decides', async ($, on) => {
    const w = world(on, { files: { [deskFile('same')]: desk('same'), [deskFile('far')]: desk('far', { cwd: 'C:/elsewhere' }) } })
    await start($, 'desktop', 'C:/work/app')
    await beat(w)
    await beat(w)
    expect(ids(w)).toEqual([SESSION, 'same'])
  })

  test('a broken desk file is skipped until the next pass', async ($, on) => {
    const w = world(on, linked({ files: { [deskFile('kid')]: '{half' } }))
    await start($)
    await beat(w)
    expect(w.state.floor[1]).toMatchObject({ id: 'kid', agents: 0, tokens: 0, state: 'idle' })
    w.files.set(deskFile('kid'), desk('kid', { tokens: 9 }))
    await beat(w)
    expect(w.state.floor[1].tokens).toBe(9)
  })

  test('a missing desk file is no trouble', async ($, on) => {
    const w = world(on, linked())
    w.files.delete(deskFile('kid'))
    await start($)
    await beat(w)
    expect(ids(w)).toEqual([SESSION, 'kid'])
  })

  test('a state folder that is not there is an empty floor, with no line in the log', async ($, on) => {
    const w = world(on)
    w.refuseWrite = /desk-/
    await start($)
    await beat(w)
    expect(ids(w)).toEqual([])
    expect(w.log()).not.toContain('floor')
  })

  test('an error on the links goes to the log and the floor carries on', async ($, on) => {
    const w = world(on, { env: { USERPROFILE: HOME, LANG: 'fr_FR', LOCALAPPDATA: LOCAL }, files: { [`${DATA}/local_x.json`]: 'not json at all', [deskFile('kid')]: desk('kid') } })
    w.refuseList = /Claude-Data/
    await start($)
    await beat(w)
    expect(w.log()).toContain('session links')
    expect(ids(w)).toEqual([SESSION, 'kid'])
  })

  test('a session file of the wrong shape is ignored', async ($, on) => {
    const w = world(on, linked({ files: { [`${DATA}/local_bad.json`]: '[1,2]', [`${DATA}/other.json`]: session('x', 'y', 'Not a session') } }))
    await start($)
    await beat(w)
    expect(ids(w)).toEqual([SESSION, 'kid'])
    expect(w.reads.filter(path => path.endsWith('/other.json'))).toEqual([])
  })

  test('session files are looked for three folders down, no further', async ($, on) => {
    const w = world(on, {
      env: { USERPROFILE: HOME, LANG: 'fr_FR', LOCALAPPDATA: LOCAL },
      files: { [`${DATA}/a/b/c/local_deep.json`]: session('d', 'deep', 'Deep'), [`${DATA}/a/b/c/d/local_deeper.json`]: session('e', 'deeper', 'Deeper') },
    })
    await start($)
    await beat(w)
    expect(w.reads).toContain(`${DATA}/a/b/c/local_deep.json`)
    expect(w.reads).not.toContain(`${DATA}/a/b/c/d/local_deeper.json`)
  })

  test('a conversation with no child keeps its room', async ($, on) => {
    const w = world(on)
    await start($)
    await beat(w)
    const ui = await mountPane($)
    expect(await hasKey(ui, 'room')).toBe(true)
    expect(await hasKey(ui, 'floor')).toBe(false)
  })

  test('hidden, the floor is read all the same', async ($, on) => {
    const w = world(on, linked({ files: { '/Users/test/.claude/pixeldesk/settings.json': '{"hidden":true}' } }))
    await start($)
    await beat(w)
    expect(ids(w)).toEqual([SESSION, 'kid'])
  })
})

describe('the floor in the pane', () => {
  const floorPane = async ($: any, on: any, kid: Record<string, unknown> = {}) => {
    const w = world(on, linked({}, kid))
    await start($)
    await beat(w)
    return { w, ui: await mountPane($) }
  }

  test('the root fills the pane: drawing, count, the crab, a zone per room', async ($, on) => {
    const { ui } = await floorPane($, on)
    const root = await ui.find({ key: 'floor' })
    expect(root?.props).toMatchObject({ flexDirection: 'column', height: 22, overflow: 'hidden', backgroundColor: 'transparent', marginX: -1 })
    expect(kids(root).map(el => el.props?.key ?? el.type)).toEqual(['Svg', 'floor-count', 'floor-crab', `room-${SESSION}`, 'room-kid'])
    expect(kids(root)[0].props.isInteractive).toBeUndefined()
  })

  test('the crab has an image that plays, the zones lie over it, and nothing of a turn reaches it', async ($, on) => {
    const { w, ui } = await floorPane($, on)
    const box = await ui.find({ key: 'floor-crab' })
    expect(box?.props).toMatchObject({ position: 'absolute', flexDirection: 'column' })
    const image = kids(box)[0]
    expect(image.props.isInteractive).toBe(true)
    expect(image.props.alt).toBe('Le crabe')
    const source = await sourceOf(ui, 'floor-crab')
    w.files.set(deskFile('kid'), desk('kid', { tokens: 5000, working: 1, agents: 1, desks: [{ title: 'Testeur', state: 'working', hue: 0 }] }))
    await beat(w)
    await receive($)
    expect(await sourceOf(ui, 'floor-crab')).toBe(source)
  })

  test('100% with no measure', async ($, on) => {
    const w = world(on, linked())
    await start($)
    await beat(w)
    const ui = await mountPane($, 'desktop', { scroll: {} })
    expect((await ui.find({ key: 'floor' }))?.props.height).toBe('100%')
  })

  test('the alternative, and no header or button', async ($, on) => {
    const { ui } = await floorPane($, on)
    expect(await altOf(ui)).toBe('Étage avec 2 conversations')
    expect(await textsOf(ui)).toEqual([])
    expect(await ui.findAll({ type: 'Button' })).toEqual([])
  })

  test('a room\'s zone is a desk\'s, with its card', async ($, on) => {
    const { ui } = await floorPane($, on, { working: 1, agents: 1, summary: 'Busy', since: NOON - 25 * 60_000, desks: [{ title: 'Testeur', state: 'working', hue: 0 }] })
    const zone = await ui.find({ key: 'room-kid' })
    const box = floorBoxes(2, 496, 462)[1]!
    expect(zone?.props).toMatchObject({ position: 'absolute', left: Math.round(box.x / 8), top: Math.round(box.y / 21) })
    const { box: card, svg } = cardIn(zone)
    expect(card.props.display).toBe('none')
    expect(card.hover).toMatchObject({ display: 'flex' })
    expect(svg.props.alt).toContain('Enfant')
    expect(svg.props.alt).toContain('Busy')
    expect(svg.props.alt).toContain('1 agent · 25 min')
  })

  test('a card that does not fit above goes to the top of the pane, never over it', async ($, on) => {
    const { ui } = await floorPane($, on, { desks: [{ title: 'Testeur', state: 'working', hue: 0 }] })
    for (const zone of [await ui.find({ key: 'room-kid' }), await ui.find({ key: `room-${SESSION}` })]) {
      const { box } = cardIn(zone)
      expect((zone?.props.top as number) + box.props.top).toBeGreaterThanOrEqual(0)
    }
  })

  test('the words of a card', async ($, on) => {
    const desks = [{ title: 'Testeur', state: 'done', hue: 0 }, { title: 'Analyste', state: 'working', hue: 1 }]
    const { ui } = await floorPane($, on, { working: 1, agents: 2, summary: 'Busy', since: NOON - 25 * 60_000, desks, steps: [{ text: 'Tester', status: 'in_progress' }] })
    const { alt } = cardIn(await ui.find({ key: 'room-kid' })).svg.props
    expect(alt).toContain('Étape en cours : Tester')
    expect(alt).toContain('1 agent fini sur 2')
    expect(alt).toContain('2 agents · 25 min')
  })

  test('with no since there is no time', async ($, on) => {
    const { ui } = await floorPane($, on, { desks: [{ title: 'Testeur', state: 'working', hue: 0 }] })
    const { alt } = cardIn(await ui.find({ key: 'room-kid' })).svg.props
    expect(alt).toMatch(/1 agent$/)
    expect(alt).not.toContain(' min')
  })

  test('the floor has no zone of lines', async ($, on) => {
    const w = world(on, linked())
    await start($)
    await sendPlan($, [step('One', 'pending')])
    await beat(w)
    const ui = await mountPane($)
    for (const key of ['plan-lines', 'reveal-0', 'line-0']) expect(await hasKey(ui, key)).toBe(false)
  })

  test('in the terminal the children are lines of the list', async ($, on) => {
    const w = world(on, linked({}, { working: 1, summary: 'Busy' }))
    await start($, 'terminal')
    await beat(w)
    const ui = await mountPane($, 'terminal')
    const texts = await textsOf(ui)
    expect(texts).toContain('● Enfant : Busy')
    expect(texts).toContain('○ Chef : Au repos')
    expect(await hasKey(ui, 'floor')).toBe(false)
  })

  test('on the floor new tokens leave the source alone, the image moves', async ($, on) => {
    const { w, ui } = await floorPane($, on)
    await beat(w)
    await ui.redraw()
    const [source, count] = [await sourceOf(ui), await sourceOf(ui, 'floor-count')]
    w.files.set(deskFile('kid'), desk('kid', { tokens: 5000 }))
    await beat(w)
    expect(await sourceOf(ui)).toBe(source)
    expect(await sourceOf(ui, 'floor-count')).not.toBe(count)
    expect((await ui.find({ key: 'floor-count' }))?.props).toMatchObject({ flexDirection: 'column' })
    const image = kids(await ui.find({ key: 'floor-count' }))[0]
    expect(image.props.isInteractive).toBeUndefined()
    expect(image.props.alt).toBe('tokens')
  })

  test('a new room zooms once, and the next pass drops it: a redraw never plays it again', async ($, on) => {
    const { w, ui } = await floorPane($, on)
    await beat(w)
    expect(await sourceOf(ui)).not.toContain(ZOOM)
    w.files.set(`${DATA}/local_two.json`, session('twol', 'two', 'Deux', 'me'))
    w.files.set(deskFile('two'), desk('two'))
    await w.clock.advance(60_000)
    expect(w.state.floor).toHaveLength(3)
    expect(await sourceOf(ui)).toContain(ZOOM)
    await beat(w)
    await ui.redraw()
    expect(await sourceOf(ui)).not.toContain(ZOOM)
    await ui.redraw()
    expect(await sourceOf(ui)).not.toContain(ZOOM)
  })

  for (const theme of ['cosy', 'japonais', 'nature', 'futuriste', 'geek', 'base']) {
    test(`${theme}: once the rooms have arrived no source holds their fade, for the client makes a new image at every redraw`, async ($, on) => {
      const w = world(on, linked({ files: { [SETTINGS_FILE]: JSON.stringify({ theme }) } }))
      await start($)
      await beat(w)
      const ui = await mountPane($)
      expect(await sourceOf(ui), 'the first floor fades in').toContain(FADE)
      await beat(w)
      for (let i = 0; i < 3; i += 1) {
        await ui.redraw()
        expect(await sourceOf(ui)).not.toContain(FADE)
        expect(await sourceOf(ui, 'floor-count')).not.toContain(FADE)
      }
    })
  }

  test('a phone keeps the source it has: its web view holds the image', async ($, on) => {
    const w = world(on, linked())
    await start($, 'mobile')
    await beat(w)
    const ui = await mountPane($, 'mobile')
    const source = await sourceOf(ui)
    await beat(w)
    expect(await sourceOf(ui)).toBe(source)
  })

  test('a floor that did not change is no arrival', async ($, on) => {
    const { w, ui } = await floorPane($, on)
    const first = await sourceOf(ui)
    await beat(w)
    await beat(w)
    expect(await sourceOf(ui)).toBe(first)
  })

  test('the chief\'s tray: the envelope while one flies, then the count', async ($, on) => {
    const { w, ui } = await floorPane($, on)
    await beat(w)
    const calm = await sourceOf(ui)
    await receive($)
    const flying = await sourceOf(ui)
    expect(flying).not.toBe(calm)
    await w.clock.advance(2400)
    expect(w.state.news).toEqual({ count: 1, shown: 1 })
    expect(await sourceOf(ui)).not.toBe(flying)
  })

  test('a room from an older version draws all the same', async ($, on) => {
    const old = { id: 'kid', title: 'Old room', agents: 1, working: 1, summary: 'Busy' }
    const w = world(on, { held: { floor: [{ id: SESSION, title: 'Me', agents: 0, working: 0, summary: '' }, old] } })
    await start($)
    const ui = await mountPane($)
    expect(cardIn(await ui.find({ key: 'room-kid' })).svg.props.alt).toContain('Old room')
    const band = await mountBand($)
    expect(await hasKey(band, 'overview-band')).toBe(true)
    expect(w.state.floor).toHaveLength(2)
  })

  test('no zones on a phone', async ($, on) => {
    const w = world(on, linked())
    await start($, 'mobile')
    await beat(w)
    const ui = await mountPane($, 'mobile')
    expect((await ui.find({ key: 'floor' }))?.props.width).toBe('100%')
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
    expect(await hasKey(ui, 'room-kid')).toBe(false)
  })
})

describe('the desks of this conversation on the floor', () => {
  test('the first room is the conversation itself', async ($, on) => {
    const w = world(on, linked())
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await beat(w)
    await beat(w)
    expect(w.state.floor[0]).toMatchObject({ id: SESSION, title: 'Chef', working: 1 })
  })
})
