import { expect, test } from 'claude-code/testing'

import { drawRoom } from './draw'
import { floorBoxes, floorCountSvg, floorSvg } from './floor'
import type { FloorRoom } from './desks'
import { mix } from './pixel/canvas'
import { casier, enveloppe, tube } from './pixel/decor'

const STEPS = ['Lire le code existant', 'Dessiner la maquette', 'Coder le panneau', 'Écrire les tests', 'Corriger les écarts', 'Documenter le mod', 'Relire le tout', 'Livrer la version']
const steps = (): FloorRoom['steps'] => STEPS.map((text, i) => ({ text, status: i < 2 ? 'completed' : i === 2 ? 'in_progress' : 'pending' }))
const desks = (i: number, n: number): FloorRoom['desks'] =>
  Array.from({ length: n }, (_, k) => ({ title: `Tâche ${k + 1}`, state: k % 3 === 1 ? 'done' : 'working', hue: i + k }))
const room = (i: number, agents = 1): FloorRoom => ({ id: `s${i}`, title: `Conversation ${i}`, agents, working: agents, summary: 'Travaille', desks: desks(i, agents), steps: steps(), tokens: 12_400 * i })
const rooms = (n: number) => Array.from({ length: n }, (_, i) => room(i, i % 3))
const floorOf = (r: FloorRoom[], news?: { shown: number; flying: boolean }) => floorSvg({ rooms: r, previous: r.length, width: 800, height: 600, ...(news ? { news } : {}) })
const count = (svg: string, part: RegExp) => (svg.match(part) ?? []).length

test('same state, same drawing', async () => {
  expect(floorOf(rooms(8))).toBe(floorOf(rooms(8)))
})

test('a full floor fits under the limit, at 8 and 16 rooms', async () => {
  for (const n of [8, 16]) {
    for (const agents of [1, 3, 6, 16]) {
      const svg = floorOf(Array.from({ length: n }, (_, i) => room(i, agents)))
      expect(svg.length < 131_072, `${n} rooms, ${agents} desks: ${svg.length}`).toBe(true)
      expect(count(svg, /<use href="#tele"\/>/g), 'one screen per room').toBe(n)
      expect(count(svg, /<use href="#c[cip]"/g), 'every step, and a line per conversation for the chief').toBe((n - 1) * 8 + (n - 1))
    }
  }
})

test('a desk on the floor plan keeps its progress at every level, under the limit', { timeoutMs: 30000 }, async () => {
  const worked = (agents: number) => (r: FloorRoom, i: number): FloorRoom => ({
    ...r,
    desks: Array.from({ length: agents }, (_, k) => ({ title: 'Développeur', state: k % 3 === 2 ? 'failed' as const : k % 3 === 1 ? 'done' as const : 'working' as const, hue: k, done: (i + k) % 7, total: k % 2 ? 0 : 6 + (i % 9), live: true })),
  })
  for (const n of [8, 16]) {
    for (const agents of [1, 3, 6, 16]) {
      const svg = floorOf(Array.from({ length: n }, (_, i) => room(i, agents)).map(worked(agents)))
      expect(svg.length < 131_072, `${n} rooms, ${agents} desks: ${svg.length}`).toBe(true)
      expect(count(svg, /<use href="#r(b|[wdf]\d|[wdf]")/g), 'one rail per desk').toBe(n * agents)
      expect(svg, 'the tray stays').toContain('M12 ')
    }
  }
})

test('even with a different progress on each of 256 desks, the floor stays under the limit', async () => {
  const mixed = Array.from({ length: 16 }, (_, i) => ({
    ...room(i, 16),
    desks: Array.from({ length: 16 }, (_, k) => ({ title: 'Développeur', state: (['working', 'done', 'failed'] as const)[k % 3]!, hue: k, done: (i * 7 + k * 13 + i * k) % 30, total: 1 + (i * 5 + k * 3) % 40, live: k % 2 === 0 })),
  }))
  const svg = floorOf(mixed)
  expect(svg.length < 131_072, String(svg.length)).toBe(true)
  expect(count(svg, /<use href="#r[wdf]\d/g), 'one rail per desk').toBe(256)
})

test('at 8 normal rooms, furniture and animations stay', async () => {
  const svg = floorOf(Array.from({ length: 8 }, (_, i) => room(i, (i % 3) + 1)))
  expect(svg, 'furniture').toContain('id="f-')
  expect(svg, 'typing hands').toContain('class="ha')
})

test('even an absurd floor stays under the limit, its steps shown', async () => {
  const long = 'Un libellé interminable qui remplit toute la largeur du tableau'
  const r = Array.from({ length: 16 }, (_, i) => ({ ...room(i, 16), title: long, steps: Array.from({ length: 24 }, () => ({ text: long, status: 'pending' as const })) }))
  const svg = floorOf(r)
  expect(svg.length < 131_072, String(svg.length)).toBe(true)
  expect(count(svg, /<use href="#tele"\/>/g)).toBe(16)
  expect(count(svg, /<use href="#cp"/g), 'the 15 conversations of the chief on top').toBe(15 * 24 + 15)
})

test('each cell is a real room in its own frame', async () => {
  const svg = floorOf(rooms(8))
  expect(count(svg, /<svg x="/g), 'frames').toBe(8)
  expect(svg, 'furniture or decoration').toContain('href="#w-')
  expect(svg, 'crab').toContain('href="#crab"')
  expect(svg, 'desk').toContain('href="#desk-')
  expect(svg, 'character').toContain('href="#person-')
  expect(svg, 'fills the pane').toContain('preserveAspectRatio="xMidYMid slice"')
})

test('each definition exists once, and a room depends on its id', async () => {
  const svg = floorOf(Array.from({ length: 16 }, (_, i) => room(i, 3)))
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]!)
  expect(new Set(ids).size, 'no duplicate').toBe(ids.length)
  expect(count(svg, /@keyframes bo/g), 'animations declared once').toBe(1)
  expect(count(svg, /<style>/g), 'one style sheet').toBe(1)
  const walls = new Set([...floorOf(rooms(16)).matchAll(/url\(#wall-([a-z]+)\)/g)].map(m => m[1]))
  expect(walls.size > 2, 'several themes').toBe(true)
})

test('the parent takes two cells, then rooms follow on 3 columns', async () => {
  const boxes = floorBoxes(8, 800, 600)
  expect(boxes).toHaveLength(8)
  expect(boxes[0]!.w > boxes[1]!.w, 'parent wider').toBe(true)
  for (const b of boxes) expect(b.x + b.w <= 800 && b.y + b.h <= 600, JSON.stringify(b)).toBe(true)
})

test('the wide cell shows a wider room, at the same scale', async () => {
  const views = [...floorOf(rooms(8)).matchAll(/<svg x="\d+" y="\d+" width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/g)].map(m => m.slice(1).map(Number))
  const [wide, regular] = [views[0]!, views[1]!]
  expect(wide[2]! > regular[2]! * 1.5, 'wider view').toBe(true)
  expect(Math.abs(wide[0]! / wide[2]! - regular[0]! / regular[2]!) < 0.02, 'same scale').toBe(true)
})

test('an idle room has its light dimmed, its plate stays readable', async () => {
  const svg = floorSvg({ rooms: [room(0), { ...room(1), agents: 0, working: 0 }], previous: 2, width: 800, height: 600 })
  expect(svg).toContain('fill-opacity=".56"')
  expect(svg.lastIndexOf('fill-opacity=".56"') < svg.lastIndexOf('</svg><rect'), 'plate out of the frame').toBe(true)
})

test('a new conversation zooms the floor out', async () => {
  expect(floorSvg({ rooms: rooms(4), previous: 3, width: 800, height: 600 })).toContain('attributeName="viewBox"')
})

const kid = (i: number, state: FloorRoom['state']): FloorRoom => ({ ...room(i, 1), title: `A${i} : tâche`, state })
const pair = (over: Partial<FloorRoom> = {}) => [{ ...room(0, 0), summary: '', steps: [], ...over }, kid(1, 'working')]
const paths = (s: string) => count(s, /<path /g)
const part = (svg: string, from: string, to: string) => svg.slice(svg.indexOf(from), svg.indexOf(to, svg.indexOf(from)))
const TRAY = '#2A1C18'

test('two rooms stack, each as wide as the pane, at the scale of the design', async () => {
  const boxes = floorBoxes(2, 780, 760)
  expect(boxes).toEqual([{ x: 0, y: 0, w: 780, h: 378 }, { x: 0, y: 382, w: 780, h: 378 }])
  const views = [...floorSvg({ rooms: pair(), previous: 2, width: 780, height: 760 }).matchAll(/<svg x="\d+" y="\d+" width="780" height="378" viewBox="0 0 (\d+) (\d+)"/g)]
  expect(views.map(m => m[1]), 'no zoom').toEqual(['780', '780'])
})

test('with no plan of its own, the chief’s Manager has no rail; it has the tray and the tube', async () => {
  const svg = floorSvg({ rooms: pair(), previous: 2, width: 780, height: 760 })
  expect(svg, 'the desk').toContain('href="#M"')
  expect(count(svg, /<use href="#r(b|[wdf]\d|[wdf]")/g), 'only the desks of the other room have a rail').toBe(1)
  expect(count(svg, new RegExp(`fill="${TRAY}"`, 'g')), 'a single tray').toBe(1)
  expect(svg, 'the tray of the design').toContain('<g transform="translate(456 ')
  expect(svg, 'the tube of the design').toContain('<g transform="translate(518 ')
})

test('the tray, the tube and the envelope take few paths', async () => {
  expect(paths(tube(132)), 'tube').toBe(5)
  expect(paths(enveloppe()), 'envelope').toBe(4)
  for (const pile of [0, 1, 2, 3]) expect(paths(casier(pile)) <= 10, `tray ${pile}`).toBe(true)
  expect(count(casier(9), /M14 \d+h40v6H14z/g), 'the pile stops at 3').toBe(3)
  expect(casier(0).includes('#FFF6DE'), 'empty').toBe(false)
})

test('the counter gives the true number, the pile has a ceiling', async () => {
  const empty = floorOf(pair(), { shown: 0, flying: false })
  expect(/<rect[^>]*#B8452A/.test(empty), 'nothing to count').toBe(false)
  const svg = floorOf(pair(), { shown: 12, flying: false })
  expect(svg, 'the counter').toContain('height="20" rx="2" fill="#1B1730"')
  expect(svg, 'the 1').toContain('href="#g49"')
  expect(svg, 'the 2').toContain('href="#g50"')
  expect(count(svg, /M14 \d+h40v6H14z/g), 'three high').toBe(3)
})

test('one thing moves: the envelope, once, and reduced motion hides it', async () => {
  const still = floorOf(pair(), { shown: 1, flying: false })
  expect(still.includes('animateTransform'), 'idle').toBe(false)
  const svg = floorOf(pair(), { shown: 1, flying: true })
  expect(count(svg, /<animateTransform /g), 'a single element').toBe(1)
  expect(svg, 'it does not loop').toContain('fill="freeze"')
  expect(svg.includes('repeatCount'), 'no repeat').toBe(false)
  expect(svg, 'it leaves from the bottom and takes the bend').toMatch(/values="0 0;0 -\d+;-44 -\d+"/)
  expect(svg, 'reduced motion').toContain('.ev{display:none}')
  expect(count(svg, /id="env"/g), 'one definition').toBe(1)
  expect(svg.indexOf('class="ev"') < svg.indexOf(`fill="${TRAY}"`), 'it goes in behind the tray').toBe(true)
})

test('the chief’s board lists its conversations: ticked, gold or empty', async () => {
  const rooms = [room(0, 0), kid(1, 'done'), kid(2, 'working'), kid(3, 'idle'), kid(4, 'failed')]
  const svg = floorOf(rooms)
  const chief = part(svg, '<svg x="', '</svg>')
  expect(count(chief, /<use href="#cc"/g), 'ticked').toBe(1)
  expect(count(chief, /<use href="#ci"/g), 'gold').toBe(1)
  expect(count(chief, /<use href="#cp"/g), 'empty').toBe(2)
  expect(chief, 'the title, capital C').toContain('href="#C"')
})

test('with no plan or sub-conversation, each room says so', async () => {
  const svg = floorOf([room(0, 0), { ...kid(1, 'idle'), steps: [] }])
  expect(svg, 'a line with no cell').toContain('fill="#7A6A5E"')
})

test('the chief’s room keeps its light and says it coordinates', async () => {
  const svg = floorOf(pair())
  expect(part(svg, '<svg x="', '</svg>').includes('fill-opacity=".56"'), 'no shadow').toBe(false)
  expect(floorOf(pair({ summary: 'Répartit le travail', agents: 2, working: 2, desks: desks(0, 2) })), 'its own agents stay').toContain('href="#desk-working"')
})

test('the chief’s room keeps everyone in the room, even at 16 agents', async () => {
  for (const n of [1, 3, 9, 16]) {
    const svg = floorSvg({ rooms: pair({ agents: n, working: n, desks: desks(0, n) }), previous: 2, width: 800, height: 600 })
    const [, width] = /<svg x="\d+" y="\d+" width="\d+" height="\d+" viewBox="0 0 (\d+) /.exec(svg)!
    const tubeX = Number(/<\/g><g transform="translate\((\d+) \d+\)"><path fill="#2A2036"/.exec(svg)?.[1] ?? /<g transform="translate\((\d+) \d+\)"><path fill="#2A2036"/.exec(svg)?.[1])
    expect(tubeX + 50 <= Number(width), `${n} agents: tube ${tubeX} in ${width}`).toBe(true)
    expect(count(svg, /<use href="#desk-/g), 'every desk, one Manager per room').toBe(n + 3)
  }
})

test('with the tray, the floor fits under the limit at 8 and 16 rooms, envelope on its way', async () => {
  for (const n of [8, 16]) {
    for (const agents of [1, 6, 16]) {
      const rooms = Array.from({ length: n }, (_, i) => ({ ...room(i, agents), state: 'working' as const }))
      const svg = floorOf(rooms, { shown: 128, flying: true })
      expect(svg.length < 131_072, `${n} rooms, ${agents} desks: ${svg.length}`).toBe(true)
      expect(count(svg, new RegExp(`fill="${TRAY}"`, 'g')), 'the tray').toBe(1)
      expect(svg, 'the counter').toContain('height="20" rx="2" fill="#1B1730"')
      expect(count(svg, /<animateTransform /g), 'the envelope').toBe(1)
    }
  }
})

test('furniture moves aside for the tube', async () => {
  for (let seed = 0; seed < 24; seed += 1) {
    const drawn = drawRoom(`s${seed}`, { w: 390, h: 189, tele: { x: 277, y: 7, w: 45, h: 37 }, board: { x: 326, y: 3, w: 60, h: 40 }, rug: { x: 115, y: 99, w: 160, h: 65 }, tube: { x: 259, y: 123, w: 25, h: 66 } })
    for (const it of drawn.floor) expect(it.x + it.w <= 259 || it.x >= 284 || it.y + it.h <= 123, `${seed}: ${it.id}`).toBe(true)
  }
})

test('the tokens of a room no longer change the source of the floor', async () => {
  const floor = (tokens: number) => floorSvg({ rooms: rooms(8).map((r, i) => (i === 2 ? { ...r, tokens } : r)), previous: 8, width: 800, height: 600 })
  expect(floor(5)).toBe(floor(6_000_000))
})

test('the second image of the floor has a screen per room, in place and under its shade', async () => {
  const input = { rooms: [...rooms(7).map(r => ({ ...r, working: 1 })), { ...room(7), agents: 0, working: 0 }], previous: 8, width: 800, height: 600 }
  const svg = floorCountSvg(input)
  const drawing = floorSvg(input)
  const frame = (s: string) => /<svg [^>]*>/.exec(s)![0]
  const views = (s: string) => [...s.matchAll(/<svg x="\d+" y="\d+" width="\d+" height="\d+" viewBox="0 0 \d+ \d+" preserveAspectRatio="xMidYMid slice">/g)].map(m => m[0])
  expect(frame(svg), 'same frame').toBe(frame(drawing))
  expect(views(svg), 'same cells').toEqual(views(drawing))
  expect(count(svg, /fill="#EDFFF5"/g), 'digits per active room').toBe(7)
  expect(count(svg, new RegExp(`fill="${mix('#EDFFF5', '#17142B', 0.56)}"`, 'g')), 'the idle room stays dark').toBe(1)
  expect(svg.includes('<style>'), 'no animation').toBe(false)
  expect(floorCountSvg({ ...input, previous: 7 }), 'it follows the zoom').toContain('attributeName="viewBox"')
  expect(floorCountSvg({ ...input, previous: 7 }), 'and the fade of the new room').toContain('begin=".75s"')
})

test('at 16 rooms the second image stays light', async () => {
  const size = floorCountSvg({ rooms: rooms(16), previous: 15, width: 1400, height: 1000 }).length
  expect(size < 20_000, `weight ${size}`).toBe(true)
})

const busy = { working: true, done: 1, total: 3, live: true }

test('each room has its Manager, and only one', async () => {
  for (const n of [2, 8, 16]) {
    const svg = floorOf(Array.from({ length: n }, (_, i) => room(i, 2)))
    expect(count(svg, /href="#person-0"/g), `${n} rooms`).toBe(n)
  }
  expect(count(floorOf(pair()), /href="#person-0"/g), 'the chief’s room does not have two').toBe(2)
})

test('the Manager of another conversation comes from what it exports', async () => {
  const svg = floorOf(pair({ manager: busy }))
  expect(part(svg, '<svg x="', '</svg>'), 'the chief at work, with the rail of its plan').toContain('href="#rw1-3l"')
  expect(floorOf([room(0, 0), kid(1, 'working')]), 'at rest by default').toContain('href="#desk-rest"')
})

test('small rooms head the desk, smaller, on an 86 px rug', async () => {
  const svg = floorSvg({ rooms: Array.from({ length: 8 }, (_, i) => room(i, 2)), previous: 8, width: 780, height: 760 })
  expect(svg, 'at the scale of the design').toContain('scale(0.72)')
  const rugs = [...svg.matchAll(/id="rug-[a-z]+-\d+-(\d+)"/g)].map(m => Number(m[1]) * 2)
  expect(rugs.every(h => Math.abs(h * 0.6 - 86) < 2), rugs.join()).toBe(true)
})

test('two stacked rooms: the chief alone stays large, a room of three heads them', async () => {
  const svg = floorSvg({ rooms: [room(0, 0), { ...room(1, 3), manager: busy }], previous: 2, width: 780, height: 760 })
  const [chief, other] = [part(svg, '<svg x="', '</svg>'), svg.slice(svg.indexOf('</svg>'))]
  expect(chief.includes('scale(0.72)'), 'the chief alone, large').toBe(false)
  expect(other, 'three abreast under the Manager').toContain('scale(0.72)')
})

test('a room with no agent whose Manager works stays lit, and says so', async () => {
  const quiet = { ...room(1, 0), summary: '', manager: busy }
  const svg = floorOf([room(0, 0), quiet])
  expect(svg.includes('fill-opacity=".56"'), 'no shade').toBe(false)
  expect(floorOf([room(0, 0), { ...quiet, manager: { working: false } }]), 'at rest the shade comes back').toContain('fill-opacity=".56"')
})

test('with the Managers, the floor stays under the limit and keeps them at the last level', async () => {
  for (const n of [8, 16]) {
    for (const agents of [1, 6, 16]) {
      const list = Array.from({ length: n }, (_, i) => ({ ...room(i, agents), manager: { working: i % 2 === 0, done: i % 5, total: 8, live: true } }))
      const svg = floorOf(list, { shown: 128, flying: true })
      expect(svg.length < 131_072, `${n} rooms, ${agents}: ${svg.length}`).toBe(true)
      expect(count(svg, /<use href="#(person-0|p0[wz])"/g) - count(svg, /<g id="p0[wz]"><use href="#person-0"/g), `${n} rooms, ${agents}: the Managers`).toBe(n)
    }
  }
})
