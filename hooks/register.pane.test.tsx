import { describe, expect, test } from 'claude-code/testing'

import { NOON, cardIn, callTool, endTurn, hasKey, kids, mountPane, sendPlan, spawn, start, step, textsOf, world } from './test-kit'
import { managerOf } from './desks'
import { boardLines, deskBoxes, roomBackSvg, viewOf } from './room'

const CELL_W = 8
const CELL_H = 21

const zones = async (ui: any, prefix: string) => (await ui.drawn()).children.filter((el: any) => el?.props?.key?.startsWith(prefix))

describe('the room, on the desktop', () => {
  test('a card per agent, what it does and how many are at work', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { description: 'First' })
    await spawn($, w, 'a2', { description: 'Second' })
    await callTool($, 'Read', { file_path: 'x/a.ts' }, 'a1')
    w.refuse.add('model.complete')
    const ui = await mountPane($)
    expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Pièce avec 2 agents. 2 au travail. Manager au repos.')
    const card = cardIn(await ui.find({ key: 'desk-a2' }))
    expect(card.svg.props.alt).toContain('Second')
    expect(card.svg.props.alt).toContain('Démarrage')
  })

  test('60 columns draw 496 by 462, 22 rows by default', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($, 'desktop', { bodyColumns: 60, scroll: {} })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg?.props).toMatchObject({ width: 496, height: 462 })
    expect(svg?.props.isInteractive).toBeUndefined()
  })

  test('at least 32 columns, at most 4096 px', async ($, on) => {
    world(on)
    await start($)
    const narrow = await mountPane($, 'desktop', { bodyColumns: 5 })
    expect((await narrow.find({ type: 'Svg' }))?.props.width).toBe(272)
    await narrow.unmount()
    const huge = await mountPane($, 'desktop', { bodyColumns: 900, scroll: { offset: 0, bodyRows: 400 } })
    expect((await huge.find({ type: 'Svg' }))?.props).toMatchObject({ width: 4096, height: 4096 })
  })

  test('the root takes the height of the pane exactly, with no scroll', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($, 'desktop', { scroll: { offset: 0, bodyRows: 30 } })
    const root = await ui.find({ key: 'room' })
    expect(root?.props).toMatchObject({ marginX: -1, height: 30, overflow: 'hidden', backgroundColor: 'transparent' })
    expect((await ui.find({ type: 'Svg' }))?.props.height).toBe(630)
  })

  test('100% with no measure', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($, 'desktop', { scroll: {} })
    expect((await ui.find({ key: 'room' }))?.props.height).toBe('100%')
  })

  test('the order: drawing, count, reveals, Manager, desks, lines, settings', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await sendPlan($, [step('One', 'pending')])
    const ui = await mountPane($)
    const names = kids(await ui.find({ key: 'room' })).map(el => el.props?.key ?? el.type)
    // The lights and the cat depend on the seed of the room.
    expect(names.filter(name => name !== 'live-lights' && name !== 'live-cat')).toEqual(['Svg', 'room-count', 'live-crab', 'live-manager', 'live-a1', 'live-fire', 'room-labels', 'reveal-0', 'desk-manager', 'desk-a1', 'hearth-card', 'plan-lines', 'settings-look', 'settings-button'])
  })

  test('the count is a plain image at the size of the drawing', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($)
    const box = await ui.find({ key: 'room-count' })
    expect(box?.props).toMatchObject({ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', flexDirection: 'column' })
    const [image] = kids(box)
    expect(image.props).toMatchObject({ alt: 'tokens', width: 496, height: 462 })
    expect(image.props.isInteractive).toBeUndefined()
  })

  test('the alternative sums up the numbers that are not zero', async ($, on) => {
    const w = world(on)
    await start($)
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) await spawn($, w, id)
    await endTurn($, { agentId: 'a' })
    await endTurn($, { agentId: 'b' })
    await endTurn($, { agentId: 'c', reason: 'error' })
    await endTurn($, { agentId: 'd', reason: 'error' })
    const ui = await mountPane($)
    expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Pièce avec 6 agents. 2 au travail · 2 finis · 2 arrêtés. Manager au repos.')
  })

  test('no agents at all', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($)
    expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Pièce avec 0 agent. Aucun agent. Manager au repos.')
  })

  test('one agent in the singular', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1' })
    const ui = await mountPane($)
    expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Pièce avec 1 agent. 1 fini. Manager au repos.')
  })

  test('the sentence: the summary, else the last action, else starting', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const ui = await mountPane($, 'terminal')
    expect(await textsOf(ui)).toContain('● Write the tests : Démarrage')
    w.refuse.add('model.complete')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await w.clock.settle()
    expect(await textsOf(ui)).toContain('● Write the tests : Lecture de a.ts')
    w.refuse.clear()
    await w.clock.advance(45_000)
    await callTool($, 'Read', { file_path: 'b.ts' }, 'a1')
    await w.clock.settle()
    expect(await textsOf(ui)).toContain('● Write the tests : A plain sentence.')
  })

  test('whole minutes, at least one, and the clock of a finished agent stops', { timeoutMs: 30000 }, async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('A long job', 'in_progress')])
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await callTool($, 'Read', { file_path: 'b.ts' }, 'a1')
    const ui = await mountPane($)
    expect(cardIn(await ui.find({ key: 'desk-a1' })).svg.props.alt).toContain('1 min · 2 actions')
    await w.clock.advance(3 * 60_000 + 30_000)
    await endTurn($, { agentId: 'a1' })
    await w.clock.advance(10 * 60_000)
    expect(cardIn(await ui.find({ key: 'desk-a1' })).svg.props.alt).toContain('3 min · 2 actions')
  })

  test('one action in the singular', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    const ui = await mountPane($)
    expect(cardIn(await ui.find({ key: 'desk-a1' })).svg.props.alt).toContain('1 min · 1 action')
  })

  test('with no agent the room holds no sentence, and no count shows', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($)
    const input = { sessionId: 'session-1', desks: [], manager: managerOf(undefined, []), previous: 0, steps: [], tokens: 0, width: 496, height: 462, settings: true }
    expect((await ui.find({ type: 'Svg' }))?.props.source).toBe(roomBackSvg(input))
  })

  test('no header on the desktop', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const ui = await mountPane($)
    expect(await textsOf(ui)).toEqual([])
  })
})

describe('the pane in words', () => {
  test('a header, the summary in yellow, the Manager, then the agents', async ($, on) => {
    const w = world(on)
    await start($, 'terminal')
    await spawn($, w, 'a1', { description: 'First' })
    const ui = await mountPane($, 'terminal')
    const root = await ui.drawn()
    expect(root.props).toMatchObject({ flexDirection: 'column', width: 60 })
    const [head, boss, row] = kids(root)
    const [title, summary] = kids(head)
    expect(title).toMatchObject({ children: ['Bureau'], props: { bold: true } })
    expect(summary).toMatchObject({ children: ['1 au travail'], props: { color: '#eab308' } })
    expect(boss.props.key).toBe('row-manager')
    expect(kids(boss)[0].children).toEqual(['○ Manager : Au repos'])
    expect(row.children).toEqual(['● First : Démarrage'])
  })

  test('the three marks, cut at the end of the line', async ($, on) => {
    const w = world(on)
    await start($, 'terminal')
    await spawn($, w, 'a', { description: 'Working' })
    await spawn($, w, 'b', { description: 'Done' })
    await spawn($, w, 'c', { description: 'Stopped' })
    await endTurn($, { agentId: 'b' })
    await endTurn($, { agentId: 'c', reason: 'error' })
    const ui = await mountPane($, 'terminal')
    const rows = await ui.findAll({ type: 'Text', text: /^[●✓✗] / })
    expect(rows.map((row: any) => row.text[0])).toEqual(['●', '✓', '✗'])
    for (const row of rows) expect(row.props.wrap).toBe('truncate-end')
  })

  test('the agents come first, then the rooms of the floor', async ($, on) => {
    const kid = JSON.stringify({ sessionId: 'kid', title: '', agents: 0, working: 0, summary: '', updatedAt: NOON, cwd: 'C:/work/app', desks: [], steps: [], tokens: 0 })
    const w = world(on, { files: { '/Users/test/.claude/pixeldesk/state/desk-kid.json': kid } })
    await start($, 'terminal')
    await spawn($, w, 'a1', { description: 'First' })
    await w.clock.advance(5000)
    const ui = await mountPane($, 'terminal')
    const rows = (await textsOf(ui)).slice(2)
    expect(rows[0]).toBe('○ Manager : Au repos')
    expect(rows[1]).toBe('● First : Démarrage')
    expect(rows[2]).toMatch(/^[●○] .* : /)
    expect(rows).toHaveLength(4)
  })

  test('with no agent the list names the Manager', async ($, on) => {
    world(on)
    await start($, 'terminal')
    const ui = await mountPane($, 'terminal')
    expect((await textsOf(ui)).slice(2)).toEqual(['○ Manager : Au repos'])
    expect(await textsOf(ui)).toContain('Aucun agent')
  })

  test('no drawing in the terminal', async ($, on) => {
    world(on)
    await start($, 'terminal')
    const ui = await mountPane($, 'terminal')
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    expect(await hasKey(ui, 'room')).toBe(false)
  })
})

describe('the desks', () => {
  test('a zone per desk, on the desk\'s box in cells', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const ui = await mountPane($)
    const box = deskBoxes(1, 496, 462)[0]!
    const room = viewOf(1)
    const crop = Math.max(0, (room.h * 496) / room.w - 462) / 2
    expect((await ui.find({ key: 'desk-a1' }))?.props).toMatchObject({
      position: 'absolute',
      left: Math.round(box.x / CELL_W),
      top: Math.round((box.y - crop) / CELL_H),
      width: Math.max(1, Math.round(box.w / CELL_W)),
      height: Math.max(1, Math.round(box.h / CELL_H)),
    })
  })

  test('in a short pane the zone follows the crop', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const tall = await mountPane($, 'desktop', { bodyColumns: 60, scroll: { offset: 0, bodyRows: 22 } })
    const top = (await tall.find({ key: 'desk-a1' }))?.props.top as number
    await tall.unmount()
    const short = await mountPane($, 'desktop', { bodyColumns: 60, scroll: { offset: 0, bodyRows: 8 } })
    const low = (await short.find({ key: 'desk-a1' }))?.props.top as number
    const room = viewOf(1)
    const scaled = (room.h * 496) / room.w
    const cropOf = (h: number) => Math.max(0, scaled - h) / 2
    const box = deskBoxes(1, 496, 168)[0]!
    expect(low).toBe(Math.round((box.y - cropOf(168)) / CELL_H))
    expect(low).toBeLessThanOrEqual(top)
  })

  test('the card hides without a key, revealed on hover, whole in the pane', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const ui = await mountPane($)
    const zone = await ui.find({ key: 'desk-a1' })
    const { box, svg } = cardIn(zone)
    expect(box.props).toMatchObject({ display: 'none', position: 'absolute' })
    expect(box.props.key).toBeUndefined()
    expect(box.hover).toMatchObject({ display: 'flex' })
    const left = (zone?.props.left as number) + box.props.left
    const top = (zone?.props.top as number) + box.props.top
    expect(left).toBeGreaterThanOrEqual(0)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(left * CELL_W + svg.props.width).toBeLessThanOrEqual(496)
    expect(top * CELL_H + svg.props.height).toBeLessThanOrEqual(462)
  })

  test('post, task, sentence, progress, time and state', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { description: 'Relire le chapitre', type: 'general-purpose' })
    await sendPlan($, [step('Lire', 'in_progress')], undefined, 'a1')
    const ui = await mountPane($)
    const { alt } = cardIn(await ui.find({ key: 'desk-a1' })).svg.props
    expect(alt).toContain('Relecteur. Relire le chapitre. Démarrage.')
    expect(alt).toContain('0 étape sur 1')
    expect(alt).toContain('Au travail')
  })

  test('the three states read in the alternative', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a')
    await spawn($, w, 'b')
    await endTurn($, { agentId: 'b' })
    await spawn($, w, 'c')
    await endTurn($, { agentId: 'c', reason: 'error' })
    const ui = await mountPane($)
    const alt = async (id: string) => cardIn(await ui.find({ key: `desk-${id}` })).svg.props.alt as string
    expect(await alt('a')).toMatch(/Au travail$/)
    expect(await alt('b')).toMatch(/Fini$/)
    expect(await alt('c')).toMatch(/Arrêté$/)
  })

  test('a card is 276 wide, on crisp edges', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const ui = await mountPane($)
    const { svg } = cardIn(await ui.find({ key: 'desk-a1' }))
    expect(svg.props.width).toBe(276)
    expect(svg.props.source).toContain('shape-rendering="crispEdges"')
  })

  test('sixteen desks stand still with no cards, too many for the app: 5 images, and one frame for each desk and each moving thing', async ($, on) => {
    const w = world(on)
    await start($)
    for (let i = 0; i < 16; i += 1) await spawn($, w, `a${i}`)
    const ui = await mountPane($)
    expect(await zones(ui, 'desk-')).toEqual([])
    const svgs = await ui.findAll({ type: 'Svg' })
    expect(svgs.filter((svg: any) => !svg.props.isInteractive), 'the room, its count, its labels and the two looks of the button').toHaveLength(5)
    const read = async () => (await ui.findAll({ type: 'Svg' })).filter((svg: any) => svg.props.isInteractive).map((svg: any) => svg.props.source as string)
    const first: string[] = await read()
    expect(first.length, 'the desks, the fire, at most the lights and the cat').toBeLessThanOrEqual(20)
    await w.clock.advance(10_000)
    await ui.redraw()
    expect(await read()).toEqual(first)
  })

  test('a record with no plan shows the three dots', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const ui = await mountPane($)
    expect(cardIn(await ui.find({ key: 'desk-a1' })).svg.props.alt).toContain('Le plan n’est pas encore annoncé')
  })
})

describe('mobile', () => {
  test('the drawing stays, the list goes under it, and nothing hovers', async ($, on) => {
    const w = world(on)
    await start($, 'mobile')
    await spawn($, w, 'a1', { description: 'First' })
    await sendPlan($, [step('One', 'in_progress')])
    const ui = await mountPane($, 'mobile')
    const root = await ui.find({ key: 'room' })
    expect(root?.props.width).toBe('100%')
    expect(root?.props.height).toBeUndefined()
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
    expect(await textsOf(ui)).toContain('● First : Démarrage')
    for (const key of ['desk-a1', 'plan-lines', 'reveal-0', 'line-0']) expect(await hasKey(ui, key)).toBe(false)
  })
})

describe('the lines of the plan', () => {
  const planned = async ($: any, on: any, rows = 22, list = [step('One', 'completed'), step('Two', 'in_progress'), step('Three', 'pending')]) => {
    const w = world(on)
    await start($)
    await sendPlan($, list)
    return { w, ui: await mountPane($, 'desktop', { scroll: { offset: 0, bodyRows: rows } }) }
  }

  test('one column, a zone per line, sharing the height to the pixel', async ($, on) => {
    const { ui } = await planned($, on)
    const column = await ui.find({ key: 'plan-lines' })
    expect(column?.props).toMatchObject({ position: 'absolute', flexDirection: 'column' })
    expect(Number.isInteger(column?.props.height)).toBe(true)
    const parts = kids(column)
    expect(parts.map(part => part.props.key)).toEqual(['line-head', 'line-0', 'line-1', 'line-2', 'line-tail'])
    const grows = parts.map(part => part.props.flexGrow as number)
    expect(grows.every(grow => grow >= 0)).toBe(true)
    expect(grows.reduce((sum, grow) => sum + grow, 0)).toBe((column?.props.height as number) * CELL_H)
    expect(parts[1].hover).toEqual({ scope: 'line-0' })
    expect(parts[3].hover).toEqual({ scope: 'line-2' })
  })

  test('the column sits on the board', async ($, on) => {
    const { ui } = await planned($, on)
    const steps = [{ text: 'One', status: 'completed' }, { text: 'Two', status: 'in_progress' }, { text: 'Three', status: 'pending' }] as const
    const board = boardLines({ desks: [], steps: [...steps], width: 496, height: 462 })
    const column = await ui.find({ key: 'plan-lines' })
    expect(column?.props.left).toBe(Math.floor(board.lines[0]!.x / CELL_W))
    expect(column?.props.top).toBe(Math.floor(board.lines[0]!.y / CELL_H))
  })

  test('under each line a light then a bubble, hidden, by the scope of the line', async ($, on) => {
    const { ui } = await planned($, on)
    const anchor = await ui.find({ key: 'reveal-1' })
    expect(anchor?.props).toMatchObject({ position: 'absolute', left: 0, top: 0 })
    const [light, bubble] = kids(anchor)
    for (const box of [light, bubble]) {
      expect(box.props).toMatchObject({ display: 'none', position: 'absolute' })
      expect(box.props.key).toBeUndefined()
      expect(box.hover).toEqual({ display: 'flex', scope: 'line-1' })
    }
    expect(kids(light)[0].props.alt).toBe('Two')
    expect(kids(bubble)[0].props.alt).toContain('Two')
  })

  test('both stay whole in the pane', async ($, on) => {
    const { ui } = await planned($, on, 14)
    for (const anchor of (await zones(ui, 'reveal-'))) {
      for (const box of kids(anchor)) {
        const [svg] = kids(box)
        expect(box.props.left).toBeGreaterThanOrEqual(0)
        expect(box.props.top).toBeGreaterThanOrEqual(0)
        expect(box.props.left * CELL_W + svg.props.width).toBeLessThanOrEqual(496)
        expect(box.props.top * CELL_H + svg.props.height).toBeLessThanOrEqual(14 * CELL_H)
      }
    }
  })

  test('the bubble says who: Claude, an agent at its desk, or nobody yet', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { description: 'Vérifier', type: 'general-purpose' })
    await sendPlan($, [step('One', 'pending', { who: 'Claude', detail: 'Why' }), step('Two', 'pending', { who: 'Testeur' }), step('Three', 'pending', { who: 'Rédacteur' })])
    const ui = await mountPane($)
    const alt = async (i: number) => kids(kids(await ui.find({ key: `reveal-${i}` }))[1])[0].props.alt
    expect(await alt(0)).toBe('One. Why. Claude, Chat principal')
    expect(await alt(1)).toBe('Two. Testeur, Au travail')
    expect(await alt(2)).toBe('Three. Pas encore attribuée')
  })

  test('a plan with no notes has its bubbles', async ($, on) => {
    const { ui } = await planned($, on)
    expect(kids(kids(await ui.find({ key: 'reveal-0' }))[1])[0].props.alt).toBe('One. Pas encore attribuée')
  })

  test('a short pane keeps the lines whose middle stays in it, and the column never overflows', async ($, on) => {
    const many = Array.from({ length: 12 }, (_, i) => step(`Step ${i}`, 'pending'))
    const rows = 7
    const { ui } = await planned($, on, rows, many)
    const steps = many.map(st => ({ text: st.text as string, status: 'pending' as const }))
    const { lines } = boardLines({ desks: [], steps, width: 496, height: rows * CELL_H })
    const expected = lines.map((l, i) => ({ mid: l.y + l.h / 2, i })).filter(l => l.mid >= 0 && l.mid < rows * CELL_H).map(l => `line-${l.i}`)
    expect(expected.length).toBeGreaterThan(0)
    const column = await ui.find({ key: 'plan-lines' })
    expect(kids(column).slice(1, -1).map(part => part.props.key)).toEqual(expected)
    expect(await zones(ui, 'reveal-')).toHaveLength(expected.length)
    expect(column?.props.top).toBeGreaterThanOrEqual(0)
    expect((column?.props.top as number) + (column?.props.height as number)).toBeLessThanOrEqual(rows)
  })

  test('the lines change neither the height nor the crop of the root', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    const before = (await ui.find({ key: 'room' }))?.props
    const svg = (await ui.find({ type: 'Svg' }))?.props.height
    await sendPlan($, [step('One', 'pending'), step('Two', 'pending')])
    expect((await ui.find({ key: 'room' }))?.props).toEqual(before)
    expect((await ui.find({ type: 'Svg' }))?.props.height).toBe(svg)
    expect(w.state.plan.steps).toHaveLength(2)
  })

  test('a shorter plan drops its zones', async ($, on) => {
    const { ui } = await planned($, on)
    await sendPlan($, [step('Only', 'pending')])
    expect(await hasKey(ui, 'line-1')).toBe(false)
  })
})
