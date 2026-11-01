import { expect, test } from 'claude-code/testing'
import { packOf } from './pixel/themes'

import { bubblePlace, cardAlt, cardPlace, cardSvg, gearSvg, agentCard, managerCard, optionSvg, roomCard, settingsPlace, settingsSvg, stepCard, zoneCells } from './card'
import type { FloorRoom } from './desks'
import { AT_REST, NOTHING_DRAWN, NOT_DRAWN, boardLines, deskBoxes, formatTokens, lineSvg, managerBox, progressOf, railCells, railPaths, roomCountSvg, roomSvg, zoomOnce, zoomPair } from './room'
import type { RoomDesk, RoomInput } from './room'

const desks = (n: number): RoomInput['desks'] =>
  Array.from({ length: n }, (_, i) => ({ title: `Tâche ${i + 1}`, state: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'working' : 'failed', hue: i }))
const input = (n: number, previous = n): RoomInput => ({
  sessionId: 'abc',
  desks: desks(n),
  previous,
  steps: [{ text: 'Lire le code', status: 'completed' }, { text: 'Écrire', status: 'in_progress' }],
  tokens: 12_400,
  manager: AT_REST,
  width: 540,
  height: 360,
})
const plan = (n: number): RoomInput['steps'] =>
  Array.from({ length: n }, (_, i) => ({ text: `Étape ${i + 1}`, status: i < 2 ? 'completed' : i === 2 ? 'in_progress' : 'pending' }))
const count = (svg: string, part: RegExp) => (svg.match(part) ?? []).length
const placeOf = (svg: string, id: string) => Number(new RegExp(`translate\\((\\d+) \\d+\\)(?: scale\\([\\d.]+\\))?"><use href="#${id}`).exec(svg)?.[1])

test('same state, same drawing', async () => {
  expect(roomSvg(input(3))).toBe(roomSvg(input(3)))
})

test('the room fits under the engine limit', async () => {
  for (const n of [0, 1, 6, 16]) {
    for (let seed = 0; seed < 12; seed += 1) {
      const size = roomSvg({ ...input(n), sessionId: `s${seed}`, steps: plan(8) }).length
      expect(size < 131_072, `${n} desks, seed ${seed}: ${size}`).toBe(true)
    }
  }
})

test('with no plan the board stays and says so', async () => {
  const svg = roomSvg({ ...input(1), steps: [] })
  expect(count(svg, /<use href="#tableau-/g), 'the board').toBe(1)
  expect(svg, 'a line in the color of a done step').toContain('fill="#7A6A5E"')
  expect(svg, 'the board of the design').toContain('id="tableau-96-63"')
  expect(count(svg, /<use href="#c[cip]"/g), 'no cell').toBe(0)
  expect(roomSvg(input(1)).includes('fill="#7A6A5E" transform="translate(16 '), 'with a plan, nothing of the kind').toBe(false)
})

test('the token count reads the French way', async () => {
  const shown = [0, 950, 999, 1000, 1500, 12_400, 99_940, 128_000, 999_400, 1_200_000, 12_400_000, 128_000_000]
  expect(shown.map(formatTokens)).toEqual(['0', '950', '999', '1k', '1,5k', '12,4k', '99,9k', '128k', '999k', '1,2M', '12,4M', '128M'])
  expect(formatTokens(99_960), 'rounded up to 100k').toBe('100k')
  expect(formatTokens(999_600), 'rounded up to 1M').toBe('1M')
  expect(formatTokens(Number.NaN), 'missing value').toBe('0')
})

test('the screen is in every room, against the left of the board', async () => {
  for (const n of [0, 1, 6]) {
    for (let seed = 0; seed < 8; seed += 1) {
      const svg = roomSvg({ ...input(n), sessionId: `s${seed}`, width: 780, height: 760 })
      expect(count(svg, /<use href="#tele"\/>/g), 'one screen').toBe(1)
      expect(placeOf(svg, 'tableau') - placeOf(svg, 'tele'), 'against the board').toBe(72 + 10)
    }
  }
})

test('the screen has its label, the digits are on the image above', async () => {
  const label = /<g fill="#80E0C7"[^>]*>(.*?)<\/g>/.exec(roomSvg(input(1)))?.[1] ?? ''
  expect(count(label, /<use /g), 'tokens, six letters').toBe(6)
  expect(roomCountSvg(input(1)).includes('#80E0C7'), 'the label stays on the screen').toBe(false)
})

test('the board shows every step, with no window', async () => {
  for (const n of [1, 3, 4, 8, 12, 20]) {
    const svg = roomSvg({ ...input(2), steps: plan(n) })
    expect(count(svg, /<use href="#c[cip]"/g), `${n} cells`).toBe(n)
  }
})

test('the board grows with the plan, then shrinks its lines to stay on the wall', async () => {
  const frame = (n: number) => Number(/id="tableau-\d+-(\d+)"/.exec(roomSvg({ ...input(2), steps: plan(n) }))![1])
  expect(frame(4) > frame(3), 'it grows').toBe(true)
  expect(frame(8) <= 150, 'it stays on the wall').toBe(true)
  expect(frame(20), 'even at 20 steps').toBe(frame(8))
  expect(roomSvg({ ...input(2), steps: plan(8) }), 'at 8 steps, lines reduced').toContain('scale(0.765)')
})

test('only labels too long are cut', async () => {
  const long = 'Une étape au libellé vraiment beaucoup trop long pour tenir sur le tableau'
  const svg = roomSvg({ ...input(2), steps: [{ text: 'Court', status: 'pending' }, { text: long, status: 'pending' }] })
  expect(count(svg, /href="#g8230"/g), 'a single cut').toBe(1)
})

test('the room fills its frame with no empty strip', async () => {
  expect(roomSvg(input(1))).toContain('preserveAspectRatio="xMidYMid slice"')
})

test('a room defines the patterns of its back', async () => {
  const svg = roomSvg(input(1))
  expect(svg, 'wall').toContain('id="wall"')
  expect(svg, 'panelling').toContain('id="low"')
})

test('a new agent starts the zoom, a plain redraw does not', async () => {
  expect(roomSvg(input(3, 2)), 'arrival').toContain('attributeName="viewBox"')
  expect(roomSvg(input(3, 3)).includes('attributeName="viewBox"'), 'no arrival').toBe(false)
})

test('each desk is drawn once in the definitions', async () => {
  const svg = roomSvg(input(6))
  expect((svg.match(/id="desk-working"/g) ?? []).length, 'definition').toBe(1)
  expect((svg.match(/href="#desk-/g) ?? []).length, 'uses, the Manager as well').toBe(7)
})

test('one hover zone per desk, inside the room', async () => {
  const boxes = deskBoxes(6, 540, 360)
  expect(boxes).toHaveLength(6)
  for (const b of [...boxes, managerBox(6, 540, 360)]) expect(b.x >= 0 && b.x + b.w <= 540, JSON.stringify(b)).toBe(true)
})

test('the drawing follows the pane', async () => {
  expect(roomSvg({ ...input(1), width: 900, height: 1000 })).toContain('width="900" height="1000"')
})

test('in a tall room the desks stay in the drawing', async () => {
  for (const b of deskBoxes(4, 800, 1200)) expect(b.y + b.h <= 1200, JSON.stringify(b)).toBe(true)
  expect(deskBoxes(1, 800, 1200)[0]!.y > deskBoxes(1, 800, 700)[0]!.y, 'centered').toBe(true)
})

test('a person at work types, blinks and thinks', async () => {
  const svg = roomSvg({ ...input(2), desks: [{ title: 'A', state: 'working', hue: 0 }] })
  for (const part of ['class="ha"', 'class="hb"', 'class="td0"', 'class="bo"', 'class="bl"', 'class="sc"']) expect(svg, part).toContain(part)
})

test('a finished agent stays at its desk, relaxed', async () => {
  const svg = roomSvg({ ...input(1), desks: [{ title: 'A', state: 'done', hue: 2 }] })
  expect(svg, 'the person is there').toContain('href="#person-2"')
  expect(svg, 'it rests').toContain('class="br"')
  expect(svg.includes('class="td0"'), 'no more bubble').toBe(false)
})

test('the animation stops if the person prefers less motion', async () => {
  expect(roomSvg(input(1))).toContain('prefers-reduced-motion')
})

const [TEAL, GOLD, DARK, GREEN, RED] = ['#5FC9B8', '#FFC857', '#3A3355', '#8CC265', '#E4633A']
const repeat = (n: number, c: string) => Array.from({ length: n }, () => c)
const at = (state: RoomDesk['state'], done: number, total: number, live = false): RoomDesk => ({ title: 'Testeur', state, hue: 1, done, total, live })
const roomOf = (d: RoomDesk) => roomSvg({ ...input(1), desks: [d] })

test('progressOf counts the done steps and spots the one in progress', async () => {
  expect(progressOf(plan(5))).toEqual({ done: 2, total: 5, live: true })
  expect(progressOf([{ status: 'pending' }])).toEqual({ done: 0, total: 1, live: false })
  expect(progressOf([])).toEqual({ done: 0, total: 0, live: false })
})

test('one cell per step, in the color of its state', async () => {
  expect(railCells(at('working', 3, 5, true)), 'at work').toEqual([TEAL, TEAL, TEAL, GOLD, DARK])
  expect(railCells(at('working', 3, 5)), 'nothing in progress').toEqual([TEAL, TEAL, TEAL, DARK, DARK])
  expect(railCells(at('done', 3, 5)), 'done').toEqual(repeat(5, GREEN))
  expect(railCells(at('failed', 2, 5, true)), 'stopped: the level stays frozen').toEqual([RED, RED, DARK, DARK, DARK])
  expect(railCells(at('working', 9, 5, true)).filter(c => c === TEAL), 'never more than the total').toHaveLength(5)
})

test('with no plan, dots at work and stopped, a full cell once done', async () => {
  expect(railCells(at('working', 0, 0))).toEqual([])
  expect(railCells(at('failed', 0, 0))).toEqual([])
  expect(railCells(at('done', 0, 0))).toEqual([GREEN])
  expect(railCells({ state: 'working' }), 'a desk from an older version').toEqual([])
})

test('past 12 steps, a continuous strip at the true done-to-total ratio', async () => {
  expect(railCells(at('working', 9, 15, true)), 'no gold in the strip').toEqual([...repeat(9, TEAL), ...repeat(6, DARK)])
  const band = railPaths(railCells(at('working', 9, 15, true)), 10, 54, 100, 4)
  expect(band, 'turquoise over 9/15').toBe(`<path fill="${TEAL}" d="M10 54h60v4h-60z"/><path fill="${DARK}" d="M70 54h40v4h-40z"/>`)
  expect(railPaths(railCells(at('done', 14, 14)), 10, 54, 100, 4), 'done: a single strip').toBe(`<path fill="${GREEN}" d="M10 54h100v4h-100z"/>`)
})

test('cells fill the rail with a gap of 2, the rest shared out', async () => {
  for (const n of [1, 2, 3, 5, 7, 12]) {
    const boxes = [...railPaths(repeat(n, TEAL), 10, 54, 100, 4).matchAll(/M(\d+) 54h(\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as const)
    expect(boxes, `${n} cells`).toHaveLength(n)
    expect(boxes[0]![0], 'start').toBe(10)
    expect(boxes[n - 1]![0] + boxes[n - 1]![1], 'arrival').toBe(110)
    boxes.slice(1).forEach(([x], i) => expect(x - (boxes[i]![0] + boxes[i]![1]), 'gap').toBe(2))
    const sizes = boxes.map(b => b[1])
    expect(Math.max(...sizes) - Math.min(...sizes) <= 1, sizes.join()).toBe(true)
  }
})

test('the rail sits on the desk and takes at most four shapes', async () => {
  const svg = roomOf(at('working', 3, 12, true))
  const rail = /<g id="(r[^"]+)">(.*?)<\/g>/.exec(svg)
  expect(rail?.[2], 'rail background').toContain('<rect x="8" y="52" width="104" height="8" fill="#1B1730"/>')
  expect(count(rail?.[2] ?? '', /<(rect|path)/g) <= 4, rail?.[2]).toBe(true)
  expect(count(svg, new RegExp(`<use href="#${rail?.[1]}"`, 'g')), 'once on the desk').toBe(1)
})

test('with no plan, three turquoise dots light up in turn', async () => {
  const svg = roomOf(at('working', 0, 0))
  for (const k of [0, 1, 2]) expect(svg, `dot ${k}`).toContain(`<path class="td${k}" fill="${TEAL}" d="M${50 + k * 8} 54h4v4h-4z"/>`)
})

test('stopped with no plan, three still red dots', async () => {
  const svg = roomOf(at('failed', 0, 0))
  expect(svg, 'red dots').toContain(`<path fill="${RED}" d="M50 54h4v4h-4zM58 54h4v4h-4zM66 54h4v4h-4z"/>`)
  expect(svg.includes(`class="td0" fill="${RED}"`), 'no animation').toBe(false)
})

test('a full room stays under the limit and keeps the progress of each desk', async () => {
  for (const total of [0, 5, 12, 14]) {
    for (const n of [6, 16]) {
      const list = Array.from({ length: n }, (_, i) => ({ ...at(i % 3 === 0 ? 'working' : i % 3 === 1 ? 'done' : 'failed', Math.min(total, i), total, true), title: 'Développeur', hue: i }))
      const svg = roomSvg({ ...input(n), desks: list, steps: plan(20), width: 780, height: 760 })
      expect(svg.length < 131_072, `${n} desks, ${total} steps: ${svg.length}`).toBe(true)
      expect(count(svg, /<use href="#r(b|[wdf]\d|[wdf]")/g), 'one rail per desk').toBe(n)
    }
  }
})

const steps5 = plan(5)
const agent = { role: 'Testeur', task: 'Tests du panneau', text: 'Vérifie que chaque bouton du panneau réagit comme prévu.', meta: '3 min · 12 actions', hue: 4 }

test('the texts of the card follow the state of the agent', async () => {
  const work = agentCard({ ...agent, state: 'working', plan: steps5 })
  expect([work.label, work.step, work.chip]).toEqual(['2 étapes sur 5', 'En cours : Étape 3', 'working'])
  const none = agentCard({ ...agent, state: 'working', plan: [] })
  expect([none.label, none.step, none.dots]).toEqual(['Durée inconnue', 'Le plan n’est pas encore annoncé', 'working'])
  const done = agentCard({ ...agent, state: 'done', plan: steps5.map(st => ({ ...st, status: 'completed' as const })) })
  expect([done.label, done.step, done.chip]).toEqual(['5 étapes sur 5', 'Tout est fait', 'done'])
  const quiet = agentCard({ ...agent, state: 'done', plan: [] })
  expect([quiet.label, quiet.step, quiet.dots, quiet.cells]).toEqual(['Aucun plan annoncé', 'Tout est fait', null, [GREEN]])
  const stop = agentCard({ ...agent, state: 'failed', plan: steps5 })
  expect([stop.label, stop.step, stop.chip]).toEqual(['2 étapes sur 5', 'Arrêté à : Étape 3', 'failed'])
  const lost = agentCard({ ...agent, state: 'failed', plan: [] })
  expect([lost.label, lost.step, lost.dots]).toEqual(['Durée inconnue', 'Arrêté avant d’annoncer son plan', 'failed'])
})

test('the count of the card always comes from the true plan, singular or plural', async () => {
  const steps = (n: number, done: number) => Array.from({ length: n }, (_, i) => ({ text: `É${i}`, status: i < done ? 'completed' as const : 'pending' as const }))
  expect(agentCard({ ...agent, state: 'working', plan: steps(15, 9) }).label).toBe('9 étapes sur 15')
  expect(agentCard({ ...agent, state: 'working', plan: steps(1, 0) }).label).toBe('0 étape sur 1')
  expect(agentCard({ ...agent, state: 'working', plan: steps(3, 1) }).label).toBe('1 étape sur 3')
  expect(agentCard({ ...agent, state: 'working', plan: steps(3, 1) }).step, 'nothing in progress: what comes next').toBe('Ensuite : É1')
  expect(agentCard({ ...agent, state: 'done', plan: steps(5, 3) }).step, 'done before the end of its plan').toBe('Travail terminé')
})

test('the card measures what the design says', async () => {
  const card = agentCard({ ...agent, state: 'working', plan: steps5 })
  const drawn = cardSvg(card, 800, 800)
  expect([drawn.width, drawn.height], '266 high, plus the shadow').toEqual([276, 270])
  expect(cardSvg({ ...card, text: `${agent.text} Et une ligne de plus.` }, 800, 800).height, 'one line more').toBe(292)
  expect(cardSvg({ ...card, task: 'Brancher les limites 5 h sur la barre du haut' }, 800, 800).height, 'the task on two lines').toBe(292)
  expect(cardSvg({ ...card, step: 'En cours : Relier la jauge aux vrais chiffres, toutes les minutes' }, 800, 800).height, 'the step on two lines').toBe(288)
})

test('the card takes the desk’s outfit, its screws and its state colors', async () => {
  const source = (state: RoomDesk['state']) => cardSvg(agentCard({ ...agent, state, plan: steps5 }), 800, 800).source
  expect(source('working'), 'medal of the Bleu outfit').toContain('fill="#6F9DD6"')
  expect(source('working'), 'shirt of the character').toContain('#3F7CC8')
  expect(count(source('working'), /fill="#C9A24A"/g) >= 4, 'four screws').toBe(true)
  expect(source('working'), 'gold separator').toContain('<rect x="21" y="85" width="230" height="2" fill="#C9A24A"/>')
  expect(source('done'), 'green separator').toContain('<rect x="21" y="85" width="230" height="2" fill="#6FAE5C"/>')
  expect(source('failed'), 'red separator').toContain('<rect x="21" y="85" width="230" height="2" fill="#B8452A"/>')
  expect(source('working'), 'dark chip').toContain('fill="#2A2036"')
  expect(source('done'), 'green chip').toContain('fill="#3E7A4C"')
  expect(source('failed'), 'red chip').toContain('rx="2" fill="#B8452A"')
  expect(source('working'), 'Jersey 10 as drawing').toContain('shape-rendering="crispEdges"')
})

test('the card stays under the engine limit and repeats identically', async () => {
  const long = 'Un texte très long '.repeat(40)
  const card = agentCard({ ...agent, task: long, text: long, state: 'working', plan: [{ text: long, status: 'in_progress' }] })
  expect(cardSvg(card, 800, 800).source.length < 20_000, String(cardSvg(card, 800, 800).source.length)).toBe(true)
  expect(cardSvg(card, 800, 800)).toBe(cardSvg(card, 800, 800))
})

test('in a short pane the card tightens then shrinks, never cut', async () => {
  const card = agentCard({ ...agent, task: 'Une tâche longue qui demande deux lignes pour tenir', text: 'Un descriptif assez long pour demander trois lignes, et même un peu plus que cela pour de bon.', state: 'working', plan: steps5 })
  const roomy = cardSvg(card, 800, 800)
  const tight = cardSvg(card, 800, 300)
  expect(tight.height <= 300 && tight.height < roomy.height, String(tight.height)).toBe(true)
  expect(tight.source.includes('scale('), 'fewer lines').toBe(true)
  const tiny = cardSvg(card, 200, 150)
  expect(tiny.height <= 150 && tiny.width <= 200, `${tiny.width} × ${tiny.height}`).toBe(true)
  expect(tiny.source, 'scaled').toContain('viewBox="0 0 276 ')
})

test('the card opens on the right side and fits in the pane', async () => {
  const pane = { cols: 80, rows: 40 }
  const card = { cols: 35, rows: 13 }
  const zone = (left: number, top: number) => ({ left, top, width: 15, height: 4 })
  expect(cardPlace(zone(5, 5), card, pane), 'top left: below').toEqual({ left: 5, top: 9 })
  expect(cardPlace(zone(60, 5), card, pane), 'on the right: against the desk').toEqual({ left: 40, top: 9 })
  expect(cardPlace(zone(5, 30), card, pane), 'at the bottom: above').toEqual({ left: 5, top: 17 })
  expect(cardPlace(zone(5, 8), card, { cols: 80, rows: 14 }), 'neither above nor below: at the top of the pane').toEqual({ left: 5, top: 0 })
  expect(cardPlace(zone(5, 12), card, { cols: 80, rows: 24 }), 'at the bottom with no room above: at the top of the pane').toEqual({ left: 5, top: 0 })
  expect(cardPlace(zone(2, 2), { cols: 35, rows: 13 }, { cols: 34, rows: 13 }), 'wider than the pane: on the left').toEqual({ left: 0, top: 0 })
})

test('no card is cut, whatever the pane and the desk under the pointer', async () => {
  const tall = agentCard({ ...agent, task: 'Une tâche longue qui demande deux lignes pour tenir', text: 'Un descriptif assez long pour demander trois lignes, et même un peu plus que cela pour de bon.', state: 'working', plan: steps5 })
  for (const pane of [{ cols: 34, rows: 12 }, { cols: 60, rows: 22 }, { cols: 100, rows: 40 }, { cols: 40, rows: 60 }]) {
    const drawn = cardSvg(tall, pane.cols * 8, pane.rows * 21)
    const card = { cols: Math.ceil(drawn.width / 8), rows: Math.ceil(drawn.height / 21) }
    for (let n = 1; n <= 16; n += 1) {
      for (const b of [...deskBoxes(n, (pane.cols + 2) * 8, (pane.rows + 1) * 21), managerBox(n, (pane.cols + 2) * 8, (pane.rows + 1) * 21)]) {
        const at = cardPlace({ left: Math.round(b.x / 8), top: Math.round(b.y / 21), width: Math.round(b.w / 8), height: Math.max(1, Math.round(b.h / 21)) }, card, pane)
        const whole = at.left >= 0 && at.top >= 0 && at.left + card.cols <= pane.cols && at.top + card.rows <= pane.rows
        expect(whole, `${JSON.stringify(pane)}, ${n} desks: ${JSON.stringify(at)}`).toBe(true)
      }
    }
  }
})

const floorRoom: FloorRoom = {
  id: 'a2',
  title: 'A2 : relecture',
  agents: 3,
  working: 3,
  summary: 'Trois agents branchent le formulaire : ils testent les champs et les envois.',
  desks: [{ title: 'A', state: 'working', hue: 0 }, { title: 'B', state: 'working', hue: 1 }, { title: 'C', state: 'working', hue: 2 }],
  steps: [{ text: 'Connecter', status: 'completed' }, { text: 'Tester', status: 'in_progress' }],
  tokens: 0,
}

test('the card of a room follows the design, with no portrait or chip', async () => {
  const card = roomCard(floorRoom, 24)
  expect([card.title, card.task, card.text]).toEqual(['A2 : relecture', 'Étape en cours : Tester', floorRoom.summary])
  expect([card.label, card.step, card.meta]).toEqual(['0 agent fini sur 3', '3 agents au travail', '3 agents · 24 min'])
  expect([card.hue, card.chip, card.dots]).toEqual([null, null, null])
  expect(card.cells, 'one gold cell per agent at work').toEqual([GOLD, GOLD, GOLD])
  expect(cardSvg(card, 800, 800).height, '286 high, plus the shadow').toBe(290)
})

test('one cell per agent, in the color of its state', async () => {
  const room = { ...floorRoom, working: 1, desks: [{ title: 'A', state: 'done', hue: 0 }, { title: 'B', state: 'working', hue: 1 }, { title: 'C', state: 'failed', hue: 2 }] } as FloorRoom
  const card = roomCard(room, 0)
  expect(card.cells).toEqual([GREEN, GOLD, RED])
  expect([card.label, card.step, card.meta]).toEqual(['1 agent fini sur 3', '1 agent au travail · 1 arrêté', '3 agents'])
})

test('an idle room says so, with no bar', async () => {
  const room = { ...floorRoom, agents: 0, working: 0, summary: '', desks: [], steps: [] }
  const card = roomCard(room, 0)
  expect([card.task, card.text, card.meta, card.cells]).toEqual(['Aucune étape en cours', 'Au repos', 'Au repos', []])
  expect(cardSvg(card, 800, 800).source.includes('fill="#1B1730"/>'), 'no bar').toBe(false)
})

test('the text alternative of the card says everything it shows', async () => {
  const alt = cardAlt(agentCard({ ...agent, state: 'working', plan: steps5 }))
  for (const part of ['Testeur', 'Tests du panneau', agent.text, '2 étapes sur 5', 'En cours : Étape 3', '3 min · 12 actions', 'Au travail']) expect(alt, part).toContain(part)
})

const testeur = { role: 'Testeur', hue: 4, state: 'working' as const }
const stepOf = (over: object = {}) => ({ text: 'Tester', status: 'in_progress' as const, detail: 'Vérifie que chaque bouton du panneau réagit comme prévu.', who: 'Testeur', ...over })

test('the bubble names the agent by its post and shows its own state', async () => {
  expect(stepCard(stepOf(), [testeur]).who, 'recognized').toEqual(testeur)
  expect(stepCard(stepOf({ who: 'testeur' }), [testeur]).who, 'whatever the case').toEqual(testeur)
  expect(stepCard(stepOf({ who: 'Redacteur' }), [{ ...testeur, role: 'Rédacteur' }]).who, 'without the accents').toEqual({ ...testeur, role: 'Rédacteur' })
  const finished = { ...testeur, hue: 1, state: 'done' as const }
  expect(stepCard(stepOf({ status: 'completed' }), [testeur, finished]).who, 'the one at work first, even on a finished step').toEqual(testeur)
  expect(stepCard(stepOf(), [finished]).who, 'failing that, the last').toEqual(finished)
  expect(stepCard(stepOf({ who: 'Claude' }), [testeur]).who, 'the main chat').toBe('claude')
  expect(stepCard(stepOf({ who: 'Designer' }), [testeur]).who, 'a post nobody holds').toBeNull()
  expect(stepCard({ text: 'Vieille étape' }, [testeur]), 'an old plan').toEqual({ title: 'Vieille étape', detail: '', who: null })
})

test('the bubble measures what the design says', async () => {
  const size = (c: ReturnType<typeof stepCard>) => { const d = cardSvg(c, 800, 800); return [d.width, d.height] }
  expect(size(stepCard(stepOf(), [testeur])), '136 high, plus the shadow').toEqual([224, 140])
  expect(size(stepCard(stepOf({ who: undefined }), [])), 'not assigned: 126').toEqual([224, 130])
  expect(size(stepCard(stepOf({ detail: undefined }), [testeur])), 'no detail').toEqual([224, 98])
})

test('the bubble takes the medal, the light and the labels of the design', async () => {
  const source = (who: object, agents: object[]) => cardSvg(stepCard(stepOf(who), agents as never), 800, 800).source
  expect(source({}, [testeur]), 'Bleu outfit').toContain('fill="#6F9DD6"')
  expect(source({}, [testeur]), 'light at work').toContain('fill="#2A9D8F"')
  expect(source({}, [{ ...testeur, state: 'done' }]), 'light done').toContain('fill="#4E8F5A"')
  expect(source({}, [{ ...testeur, state: 'failed' }]), 'light stopped').toContain('fill="#B8452A"')
  expect(source({}, [testeur]), 'cropped bust').toContain('viewBox="4 1 24 24"')
  expect(source({ who: 'Claude' }, []), 'crab background').toContain('fill="#3A3355"')
  expect(source({ who: 'Claude' }, []).includes('fill="#2A9D8F"'), 'no light for Claude').toBe(false)
  expect(cardAlt(stepCard(stepOf(), [testeur])), 'the agent').toBe('Tester. Vérifie que chaque bouton du panneau réagit comme prévu.. Testeur, Au travail')
  expect(cardAlt(stepCard(stepOf({ who: 'Claude', detail: '' }), [])), 'Claude').toBe('Tester. Claude, Chat principal')
  expect(cardAlt(stepCard({ text: 'Corriger' }, [])), 'nobody').toBe('Corriger. Pas encore attribuée')
})

test('the bubble keeps its memory and is never cut in a short pane', async () => {
  const card = stepCard(stepOf({ detail: 'Une phrase bien plus longue que d’habitude, qui prend quatre lignes et même un peu plus que cela, pour de bon et sans détour.' }), [testeur])
  expect(cardSvg(card, 800, 800), 'same drawing').toBe(cardSvg(card, 800, 800))
  const low = cardSvg(card, 800, 120)
  expect(low.height <= 120, String(low.height)).toBe(true)
  const thin = cardSvg(card, 150, 800)
  expect(thin.width <= 150, String(thin.width)).toBe(true)
})

test('the bubble opens left of the board, under the screen for a high line', async () => {
  const pane = { cols: 97, rows: 36 }
  const card = { cols: 28, rows: 7 }
  expect(bubblePlace(80, 9, 6, card, pane), 'a low line, at its height').toEqual({ left: 52, top: 6 })
  expect(bubblePlace(80, 3, 6, card, pane), 'a high line, under the screen').toEqual({ left: 52, top: 6 })
  expect(bubblePlace(80, 14, 6, card, pane), 'lower').toEqual({ left: 52, top: 11 })
  expect(bubblePlace(80, 9, 6, card, { cols: 97, rows: 9 }), 'short pane').toEqual({ left: 52, top: 2 })
  expect(bubblePlace(10, 9, 6, card, pane), 'board too far left').toEqual({ left: 0, top: 6 })
})

test('each line of the board has its true place, even shrunk, with no overlap', async () => {
  for (const [width, height] of [[780, 760], [496, 420], [496, 210]] as const) {
    for (const n of [1, 3, 8, 12, 20]) {
      const b = boardLines({ desks: desks(3), steps: plan(n), width, height })
      expect(b.lines, `${n} lines`).toHaveLength(n)
      b.lines.slice(1).forEach((l, i) => expect(Math.abs(l.y - (b.lines[i]!.y + b.lines[i]!.h)) < 0.01, `${width}, ${n}, line ${i}`).toBe(true))
      expect(b.left < b.lines[0]!.x, 'in the board').toBe(true)
    }
  }
})

test('lines follow the drawing: the board’s offset and the crop of a short pane', async () => {
  const tall = boardLines({ desks: desks(0), steps: plan(3), width: 540, height: 360 })
  const svg = roomSvg({ ...input(0), steps: plan(3), width: 540, height: 360 })
  const [, x, y] = /translate\((\d+) (\d+)\)"><use href="#tableau/.exec(svg)!
  const k = 540 / Number(/viewBox="0 0 (\d+) /.exec(svg)![1])
  expect(Math.abs(tall.left - Number(x) * k) < 0.01, 'the edge of the board').toBe(true)
  expect(Math.abs(tall.lines[0]!.y - (Number(y) + 37) * k) < 0.01, 'the first line').toBe(true)
  const short = boardLines({ desks: desks(0), steps: plan(3), width: 540, height: 200 })
  expect(short.lines[0]!.y < tall.lines[0]!.y, 'cut at the top').toBe(true)
  expect(short.under < tall.under, 'the screen too').toBe(true)
})

test('the line under the pointer redraws to the pixel, on #F4E4C1, in whole cells', async () => {
  const lit = lineSvg('pending', 'Documenter', { x: 500, y: 190, w: 100, h: 16.5 }, 1, 8, 21, packOf(undefined).board)
  expect([lit.left, lit.top, lit.cols, lit.rows], 'the cells').toEqual([62, 9, 13, 1])
  expect([lit.width, lit.height], 'the drawing fills them').toEqual([104, 21])
  expect(lit.source, 'the highlight').toContain('fill="#F4E4C1"')
  expect(lit.source, 'to the pixel').toContain('translate(4 1)')
  expect(lit.source, 'the cell of the step').toContain('id="cp"')
})

test('the zoom plays once: same drawing, same source; drawing changed, no more zoom', async () => {
  const zoomed = () => 'b+zoom'
  const arrived = zoomOnce(NOT_DRAWN, 'b', zoomed)
  expect(arrived.sent, 'arrival').toBe('b+zoom')
  expect(zoomOnce(arrived, 'b', zoomed), 'same drawing').toBe(arrived)
  expect(zoomOnce(arrived, 'b', null).sent, 'SEEN settled: the source does not move').toBe('b+zoom')
  expect(zoomOnce(arrived, 'c', zoomed).sent, 'a real change').toBe('c')
})

test('with no arrival waiting the mark goes back to zero: the next arrival plays again', async () => {
  const played = zoomOnce(zoomOnce(NOT_DRAWN, 'b', () => 'b+zoom'), 'b', null)
  expect(played.played).toBe(false)
  expect(zoomOnce(played, 'c', () => 'c+zoom').sent).toBe('c+zoom')
})

test('the pair: the digits follow the zoom of the room, then never again', async () => {
  const image = (zoom: boolean) => (zoom ? 'piece+zoom' : 'piece')
  const counted = (value: string) => (zoom: boolean) => (zoom ? `${value}+zoom` : value)
  const arrived = zoomPair(NOTHING_DRAWN, true, image, counted('12'))
  expect([arrived.image.sent, arrived.count.sent], 'on arrival').toEqual(['piece+zoom', '12+zoom'])
  const again = zoomPair(arrived, true, image, counted('12'))
  expect([again.image.sent, again.count.sent], 'nothing changed').toEqual(['piece+zoom', '12+zoom'])
  const moved = zoomPair(again, true, image, counted('13'))
  expect([moved.image.sent, moved.count.sent], 'the digits alone').toEqual(['piece+zoom', '13'])
})

test('tokens no longer change the source of the room', async () => {
  expect(roomSvg({ ...input(3), tokens: 999 })).toBe(roomSvg({ ...input(3), tokens: 1_250_000 }))
  expect(roomSvg({ ...input(3), tokens: 98_000 }).includes('href="#g57"'), 'no more digits in the iframe').toBe(false)
})

test('the second image has the digits, in the exact frame of the room', async () => {
  const svg = roomCountSvg(input(3))
  const frame = (s: string) => /<svg [^>]*>/.exec(s)![0]
  expect(frame(svg), 'same frame').toBe(frame(roomSvg(input(3))))
  expect(svg, 'the digit 1').toContain('href="#g49"')
  expect(svg, 'the comma').toContain('href="#g44"')
  expect(svg, 'the k').toContain('href="#k"')
  expect(Number(/translate\((\d+) \d+\)"><g fill="#EDFFF5"/.exec(svg)?.[1]), 'in place of the screen').toBe(placeOf(roomSvg(input(3)), 'tele'))
  expect(svg.includes('<style>'), 'no animation').toBe(false)
  expect(roomCountSvg(input(3, 2)), 'it follows the zoom').toContain('attributeName="viewBox"')
  expect(roomCountSvg(input(3, 3)).includes('attributeName="viewBox"'), 'no arrival').toBe(false)
  expect(svg.length < 2_000, `weight ${svg.length}`).toBe(true)
})

const close = (got: number, want: number, what: string) => expect(Math.abs(got - want) <= 1.5, `${what} : ${got}, design ${want}`).toBe(true)
const working = (done = 1, total = 3, live = true) => ({ working: true, done, total, live })
const mock = (n: number, over: object = {}): RoomInput => ({ ...input(n), width: 780, height: 760, ...over })

test('a Manager desk in every room, whatever the list of subagents', async () => {
  for (const n of [0, 1, 3, 6, 16]) {
    const svg = roomSvg(mock(n))
    expect(count(svg, /href="#desk-/g), `${n} subagents`).toBe(n + 1)
    expect(svg, 'its plate').toContain('href="#P"')
    expect(count(svg, /href="#person-0"/g), 'the Corail outfit, once').toBe(1)
  }
})

test('no other desk wears Corail, even from an old state', async () => {
  const svg = roomSvg({ ...input(1), desks: [{ title: 'Ancien', state: 'working', hue: 6 }, { title: 'Ancien', state: 'working', hue: 0 }] })
  expect(count(svg, /href="#person-0"/g), 'only the Manager').toBe(1)
  expect(count(svg, /href="#person-1"/g), 'they move to another outfit, and may share it').toBe(2)
})

test('alone, the Manager takes the place of the single desk of the design', async () => {
  const b = managerBox(0, 780, 760)
  close(b.x, 303, 'x')
  close(b.y, 430, 'y')
  close(b.w, 173, 'width')
})

test('with 1 or 3 subagents: the Manager ahead, at the scale and pace of 6 agents', async () => {
  const boss = managerBox(3, 780, 760)
  close(boss.x, 314, 'Manager x')
  close(boss.y, 356, 'Manager y')
  close(boss.w, 152, 'scale 1.27')
  const subs = deskBoxes(3, 780, 760)
  subs.forEach((b, i) => {
    close(b.x, [149, 314, 479][i]!, `subagent ${i} x`)
    close(b.y, 491, `subagent ${i} y`)
  })
  close(deskBoxes(1, 780, 760)[0]!.x, 314, 'single subagent: under the Manager')
  close(deskBoxes(1, 780, 760)[0]!.y, 491, 'single subagent y')
})

test('with 6 subagents: 3 rows at scale 1, in 3 columns', async () => {
  const boss = managerBox(6, 780, 760)
  expect([boss.x, boss.y, boss.w], 'the Manager').toEqual([330, 330, 120])
  expect(deskBoxes(6, 780, 760).map(b => [b.x, b.y]), 'the columns and rows').toEqual([[198, 436], [330, 436], [462, 436], [198, 542], [330, 542], [462, 542]])
})

test('the Manager never moves sideways, and stays on the axis of the rug', async () => {
  for (let n = 0; n <= 16; n += 1) {
    const b = managerBox(n, 780, 760)
    close(b.x + b.w / 2, 390, `${n} subagents`)
    const svg = roomSvg(mock(n))
    const [, wide] = /id="rug-(\d+)-\d+"/.exec(svg)!
    const rug = Number(/<use href="#rug-[^"]+" x="(\d+)"/.exec(svg)![1])
    const [, w] = /viewBox="0 0 (\d+) /.exec(svg)!
    close(rug + Number(wide), Number(w) / 2, `the rug at ${n}`)
  }
})

test('up to 16 subagents, everything fits the room, with no overlap', async () => {
  for (let n = 1; n <= 16; n += 1) {
    const all = [managerBox(n, 780, 760), ...deskBoxes(n, 780, 760)]
    for (const b of all) expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= 780 && b.y + b.h <= 760, `${n} : ${JSON.stringify(b)}`).toBe(true)
    all.forEach((a, i) => all.slice(i + 1).forEach(b => expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${n} : ${JSON.stringify([a, b])}`).toBe(true)))
  }
})

test('the rug follows the design: the same under 1 and 2 subagents, the big one from 3', async () => {
  const rug = (n: number) => /id="rug-(\d+)-(\d+)"/.exec(roomSvg(mock(n)))!.slice(1).map(v => Number(v) * 2)
  expect(rug(0), 'alone').toEqual([346, 208])
  expect(rug(1), '1 subagent: the rug keeps its size on screen').toEqual([394, 236])
  expect(rug(3), '3 desks abreast').toEqual([418, 268])
  expect(rug(6), '3 rows').toEqual([530, 340])
})

test('at work with a plan: one box per step of the main plan, and all that moves', async () => {
  const svg = roomSvg(mock(0, { manager: working(1, 3) }))
  expect(svg, 'the desk lit').toContain('href="#desk-working"')
  expect(svg, 'the rail of the plan').toContain('href="#rw1-3l"')
  for (const part of ['class="ha', 'class="st', 'class="sc', 'class="bo']) expect(svg, part).toContain(part)
})

test('at work with no plan: the three dots in place of the boxes', async () => {
  const svg = roomSvg(mock(0, { manager: working(0, 0, false) }))
  expect(svg, 'the back of the rail').toContain('href="#rb"')
  for (const k of [0, 1, 2]) expect(svg, `dot ${k}`).toContain(`class="td${k}" fill="${TEAL}"`)
})

test('at rest: screen off, no steam, a small Zz, no tick and no alert', async () => {
  const svg = roomSvg(mock(0))
  expect(svg, 'the desk off').toContain('href="#desk-rest"')
  expect(svg, 'the black screen of the design').toContain('#2D2F44')
  expect(/<g id="desk-rest".*?<\/g>/.exec(svg)![0].includes('#7FE0C8'), 'no light').toBe(false)
  for (const part of ['class="st', 'class="sc', 'class="ha', 'class="al', 'href="#rb"']) expect(svg.includes(part), part).toBe(false)
  expect(svg, 'the Zz').toContain('href="#zz"')
  expect(svg, 'the colour of the Zz').toContain('fill="#F4E4C1" d="M82 4h8v2h-8z')
  expect(svg.includes('href="#desk-done"') || svg.includes('href="#desk-failed"'), 'no tick and no alert').toBe(false)
})

test('the end of a turn rests him even with an open plan: the plan stays on the board, not at the desk', async () => {
  const svg = roomSvg(mock(0, { manager: { working: false, done: 1, total: 3, live: true }, steps: plan(3) }))
  expect(svg, 'rest').toContain('href="#desk-rest"')
  expect(/<use href="#r[wdf]\d/.test(svg), 'no rail').toBe(false)
  expect(count(svg, /<use href="#c[cip]"/g), 'the board keeps its 3 lines').toBe(3)
})

test('going from rest to work is no arrival, and changes neither the frame nor the digits', async () => {
  const [rest, busy] = [mock(2), mock(2, { manager: working() })]
  expect(roomSvg(busy).includes('attributeName="viewBox"'), 'no zoom').toBe(false)
  expect(roomSvg(rest) === roomSvg(busy), 'the room changes').toBe(false)
  expect(roomCountSvg(rest), 'the image of the digits stays').toBe(roomCountSvg(busy))
  expect(/<svg [^>]*>/.exec(roomSvg(rest))![0], 'the same frame').toBe(/<svg [^>]*>/.exec(roomSvg(busy))![0])
})

test('the zoom runs around the axis: the Manager does not slide aside', async () => {
  expect(roomSvg(mock(1, { previous: 0 })), 'from the room alone to the room of two').toContain('from="38 0 540 526"')
})

test('no sentence left on the rug', async () => {
  expect(roomSvg(mock(0)).includes('text('), 'no free text left').toBe(false)
})

test('the Manager’s card at work: the post, the plan title, the description and the progress', async () => {
  const card = managerCard({ working: true, title: 'Refonte du panneau', text: 'Écrit la spec du panneau avant de lancer le travail.', meta: '4 min · 9 actions', plan: [{ text: 'Lire', status: 'completed' }, { text: 'Écrire la spec', status: 'in_progress' }, { text: 'Valider', status: 'pending' }] })
  expect([card.title, card.task, card.text]).toEqual(['Patron', 'Refonte du panneau', 'Écrit la spec du panneau avant de lancer le travail.'])
  expect([card.label, card.step, card.meta, card.chip, card.hue]).toEqual(['1 étape sur 3', 'En cours : Écrire la spec', '4 min · 9 actions', 'working', 0])
  expect(cardSvg(card, 800, 800).source, 'the Corail medal').toContain('fill="#EB8A6B"')
  const none = managerCard({ working: true, title: '', text: 'Lecture de room.ts', meta: '1 min · 1 action', plan: [] })
  expect([none.task, none.label, none.dots], 'no plan').toEqual(['Sans plan', 'Durée inconnue', 'working'])
})

test('the Manager’s card at rest: no progress block, with its chip and its last work', async () => {
  const card = managerCard({ working: false, title: 'Refonte du panneau', text: 'x', meta: 'Dernier travail il y a 12 min', plan: [{ text: 'Lire', status: 'in_progress' }] })
  expect([card.title, card.task, card.text, card.meta, card.chip, card.hue]).toEqual(['Patron', 'Aucune tâche en cours', 'Attend ta prochaine demande.', 'Dernier travail il y a 12 min', 'rest', 0])
  expect([card.label, card.cells, card.dots, card.step]).toEqual(['', [], null, ''])
  const drawn = cardSvg(card, 800, 800)
  expect([drawn.width, drawn.height], '174 high, plus the shadow').toEqual([276, 178])
  expect(drawn.source, 'the chip of the design').toContain('fill="#544B70"')
  expect(cardAlt(card), 'in words').toContain('Au repos')
})

test('the bubble reads an old plan that names the Manager as the main chat', async () => {
  for (const who of ['Manager', 'Patron', 'Boss']) expect(stepCard(stepOf({ who }), []).who).toBe('claude')
})

test('at 0 and 1 agent, the board keeps 8 px on its right, the screen stays against it', async () => {
  for (const n of [0, 1]) {
    const svg = roomSvg(mock(n))
    const w = Number(/viewBox="0 0 (\d+) /.exec(svg)![1])
    const k = 780 / w
    const frame = Number(/id="tableau-(\d+)-/.exec(svg)![1])
    close((w - placeOf(svg, 'tableau') - frame) * k, 8, `${n} agent`)
  }
})

test('the settings button stays 32 px, on the design grid, in its three looks', async () => {
  for (const look of ['normal', 'hover', 'open'] as const) {
    const drawn = gearSvg(look, 2, 10, 40, 42)
    expect([drawn.width, drawn.height]).toEqual([40, 42])
    expect(drawn.source, 'to the pixel').toContain('translate(2 10)')
    expect(drawn.source.includes('scale('), 'not at the scale of the room').toBe(false)
  }
  expect(gearSvg('normal', 0, 0, 40, 42).source, 'the frame').toContain('#3B2318')
  expect(gearSvg('normal', 0, 0, 40, 42).source, 'the cream gear').toContain('#F4E4C1')
  expect(gearSvg('hover', 0, 0, 40, 42).source, 'hovered, gold').toContain('#FFC857')
  expect(gearSvg('open', 0, 0, 40, 42).source, 'open, pressed').toContain('#6B4030')
})

test('the settings panel says the words of the design, the chosen option gold and ticked', async () => {
  const place = settingsPlace(780, 760)
  const choices = { departure: 'plan', fire: true, briefingMode: 'auto', compactBefore: 2, theme: 'cosy' } as const
  const on = settingsSvg(choices, place)
  expect(on.alt).toBe("Réglages. Départ des bureaux. Fin du plan, choisi. Au fil de l'eau. Cache. Garder le cache au chaud, choisi. Passation. Automatique, choisi. Manuel. Compacte 2 fois, puis change de conversation. Thème. Cosy, choisi.")
  expect(on.source, 'the chosen option').toContain('fill="#FFDF8F"')
  expect(on.source, 'its gold border').toContain('fill="#C9A24A"')
  expect(on.source, 'the other option').toContain('fill="#FFF6DE"')
  const other = settingsSvg({ ...choices, departure: 'each' }, place)
  expect(other.alt).toContain("Fin du plan. Au fil de l'eau, choisi.")
  expect(on.source === other.source, 'the tick moves line').toBe(false)
  expect(count(on.source, /fill="#FFC857"/g), 'a tick by section, the step of the cursor and the theme').toBe(5)
  expect(on.source.length < 40_000, String(on.source.length)).toBe(true)
})

test('an option hovered: #FFF2C4 back, gold border, on the line of the design', async () => {
  const place = settingsPlace(780, 760)
  const lit = optionSvg('each', place)
  expect(lit.source).toContain('fill="#FFF2C4"')
  expect(lit.source).toContain('fill="#C9A24A"')
  expect(lit.source, 'the purple sentence').toContain('fill="#6E5A9E"')
})

test('the zones follow the design at 780, and stay in true pixels elsewhere', async () => {
  const at = settingsPlace(780, 760)
  expect(at.k).toBe(1)
  expect(at.button).toEqual({ x: 10, y: 10, w: 32, h: 32 })
  expect(at.options.plan).toEqual({ x: 25, y: 121, w: 262, h: 72 })
  expect(at.options.each).toEqual({ x: 25, y: 199, w: 262, h: 54 })
  expect(at.options.fire).toEqual({ x: 25, y: 283, w: 262, h: 72 })
  expect(at.options.auto).toEqual({ x: 25, y: 385, w: 262, h: 54 })
  expect(at.options.manual).toEqual({ x: 25, y: 517, w: 262, h: 54 })
  expect(at.steps[4]).toEqual({ value: 'always', x: 193, y: 467, w: 94, h: 22 })
  expect(at.panel, '442 by 542, and its shadow').toEqual({ x: 8, y: 46, w: 446, h: 546 })
  const manual = settingsPlace(780, 760, 'manual')
  expect(manual.panel.h, '470 once the cursor is gone').toBe(474)
  expect(manual.options.manual.y).toBe(445)
  expect(settingsPlace(1400, 900), 'the button and the panel do not grow').toEqual(at)
})

test('in a low or narrow pane, the settings panel shrinks and is never cut', async () => {
  for (const [w, h] of [[496, 210], [300, 760], [780, 170], [240, 150]] as const) {
    const at = settingsPlace(w, h)
    expect(at.panel.x + at.panel.w <= w && at.panel.y + at.panel.h <= h, `${w} by ${h}: ${JSON.stringify(at.panel)}`).toBe(true)
    expect(at.options.each.y + at.options.each.h <= at.panel.y + at.panel.h, 'the option in the panel').toBe(true)
  }
})

test('a zone stands on whole cells, and its margins bring it to its drawing', async () => {
  const at = settingsPlace(780, 760)
  const [one, two] = [at.options.plan, at.options.each]
  const bottom = (b: typeof one) => { const z = zoneCells(b); return z.top * 21 + z.marginTop * 10.5 + z.rows * 21 }
  const top = (b: typeof one) => { const z = zoneCells(b); return z.top * 21 + z.marginTop * 10.5 }
  expect(bottom(one) <= top(two), 'the second starts after').toBe(true)
  expect(zoneCells(at.button)).toEqual({ left: 1, top: 0, marginLeft: 0.25, marginTop: 0.952, cols: 4, rows: 1.524 })
})

test('a room with no agent whose Manager works says so on its card', async () => {
  const quiet: FloorRoom = { id: 'k', title: 'Kid', agents: 0, working: 0, summary: '', desks: [], steps: [], tokens: 0 }
  const busy = roomCard({ ...quiet, manager: { working: true } }, 0)
  expect([busy.text, busy.meta]).toEqual(['Au travail', 'Patron au travail'])
  expect(roomCard({ ...quiet, summary: 'Écrit', manager: { working: true } }, 0).text).toBe('Écrit')
  const rest = roomCard(quiet, 0)
  expect([rest.text, rest.meta]).toEqual(['Au repos', 'Au repos'])
})
