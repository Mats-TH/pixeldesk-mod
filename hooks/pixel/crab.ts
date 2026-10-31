import type { Canvas } from './canvas'
import { crabImage } from './crab-art'
import type { CrabSet } from './crab-art'
import { PX, pick } from './pack'

/**
 * The crab's life in a room: one loop of a few minutes, built from the conversation and the shape of the room alone, and
 * played by SMIL with no redraw. A source that changes starts the loop over, so nothing that moves during a turn gets in.
 */

export type Area = { x: number; y: number; w: number; h: number }
/**
 * What the crab needs of a room, in pixels of the room. `top`, `bottom`: the floor a pane shows. `items`: what stands on
 * the floor and stays there, and he may go and see. `blocked`: what is only in the way, as a piece that steps forward
 * under a board that grows: the plan must not change this drawing.
 */
export type Ground = { w: number; top: number; bottom: number; basket: Area; desks: readonly Area[]; stove: Area | null; items: readonly Area[]; blocked: readonly Area[] }
export type Spot = { x: number; y: number }
/** What he does for `ms`, from `from`, at `x`, `y`, on his way to `to`. No `image`: the set in a loop. `flip`: the other way round. */
export type Beat = Spot & { set: CrabSet; image?: number; flip: boolean; from: number; ms: number; to?: Spot }
/** `bed`: where he stays under a reduced motion. `still`: the image he shows there, by default the sleeper. */
export type Script = { ms: number; beats: Beat[]; bed: Spot; still?: readonly [CrabSet, number] }
/** What a life heavier than its drawing can hold goes without, in that order. */
const GESTURES = ['paper', 'hello', 'fire'] as const
type Gesture = (typeof GESTURES)[number]

// The zone of a walking crab, from his place.
export const CRAB_W = 40
export const CRAB_H = 28
// The walk's grid: fine enough for the alleys between desks, and every place stays on the pixels of the room.
const CELL = 8
const EDGE = 4
const CLEAR = 2
const STEP_MS = 140
// Two cells of the drawing an image: 4 pixels of the room.
const SPEED = (2 * PX) / STEP_MS
const LOOPS = { droite: 4, dos: 4, face: 4, assis: 2, sommeil: 4, feu: 3, miniDroite: 2, miniGauche: 2, miniDos: 2, miniFace: 2 } as const satisfies Partial<Record<CrabSet, number>>
type Loop = keyof typeof LOOPS
// The two images of the floor's small crab hold longer: he crosses less ground in each.
const MINI_STEP_MS = 200
const BEATS: Record<Loop, number> = { droite: STEP_MS, dos: STEP_MS, face: STEP_MS, assis: 700, sommeil: 900, feu: 700, miniDroite: MINI_STEP_MS, miniGauche: MINI_STEP_MS, miniDos: MINI_STEP_MS, miniFace: MINI_STEP_MS }
const WAKE_MS = 320
const HOP_RISE = 12
const SHORTEST_S = 120
const LONGEST_S = 240
const LAST_NAP_MS = 8000
// How far above his place a gesture reaches: the crab who jumps stays on the drawing.
const HEADROOM = 44
// In cells of the drawing: where a sleeper lies on his basket, and how far along a shoe he ends up.
const BED_Y = -3
const SLEEP_W = 22
const SHOE = 13 * PX
const FAR = 100
// What a shoe takes between him and the desk it comes from under.
const SHOE_GAP = 16

const crosses = (a: Area, b: Area) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The cells of the floor where he fits. */
function gridOf(g: Ground) {
  const cols = Math.floor((g.w - EDGE - CRAB_W) / CELL) + 1
  const rows = Math.max(0, Math.floor((g.bottom - EDGE - CRAB_H - g.top) / CELL) + 1)
  const walls = [...g.desks, ...g.items, ...g.blocked, g.basket, ...(g.stove ? [g.stove] : [])].map(b => ({ x: b.x - CLEAR, y: b.y - CLEAR, w: b.w + 2 * CLEAR, h: b.h + 2 * CLEAR }))
  const free = new Uint8Array(cols * rows)
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const body = { x: i * CELL, y: g.top + j * CELL, w: CRAB_W, h: CRAB_H }
      if (i * CELL >= EDGE && !walls.some(b => crosses(b, body))) free[j * cols + i] = 1
    }
  }
  return { cols, rows, free }
}
type Grid = ReturnType<typeof gridOf>

/** How many steps from each cell to `goal`, -1 from a cell that never gets there. */
function stepsTo({ cols, rows, free }: Grid, goal: number) {
  const dist = new Int32Array(cols * rows).fill(-1)
  const queue = new Int32Array(cols * rows)
  let [head, tail] = [0, 1]
  queue[0] = goal
  dist[goal] = 0
  while (head < tail) {
    const at = queue[head++]!
    const step = dist[at]! + 1
    const i = at % cols
    for (const next of [i ? at - 1 : -1, i < cols - 1 ? at + 1 : -1, at - cols, at + cols]) {
      if (next >= 0 && next < dist.length && free[next] && dist[next] === -1) {
        dist[next] = step
        queue[tail++] = next
      }
    }
  }
  return dist
}

/** The way from `from` down a map of steps: straight on as long as it gets nearer, so he turns as little as he can. */
function wayDown(grid: Grid, dist: Int32Array, from: number) {
  const { cols } = grid
  const turns: number[] = []
  let at = from
  let last = 0
  while (dist[at]! > 0) {
    const i = at % cols
    const ways = [i ? -1 : 0, i < cols - 1 ? 1 : 0, -cols, cols].filter(d => d && at + d >= 0 && at + d < dist.length && dist[at + d] === dist[at]! - 1)
    const way = ways.includes(last) ? last : ways[0]!
    if (way !== last) turns.push(at)
    last = way
    at += way
  }
  turns.push(at)
  return turns
}

/** One life: asleep at both ends, so the loop closes on a breath. `lean`: only the walk and the rest, for a drawing short of room. `skip`: the gestures it goes without. */
export function crabScript(seed: number, g: Ground, lean = false, skip: readonly Gesture[] = []): Script {
  const grid = gridOf(g)
  const { cols, free } = grid
  let salt = 0
  const roll = (n: number) => pick(seed, (salt += 1), n)
  const spotOf = (cell: number): Spot => ({ x: (cell % cols) * CELL, y: g.top + Math.floor(cell / cols) * CELL })
  const cellOf = (s: Spot) => Math.round((s.y - g.top) / CELL) * cols + Math.round(s.x / CELL)
  const bed = { x: Math.round(g.basket.x + (g.basket.w - SLEEP_W * PX) / 2), y: g.basket.y + BED_Y * PX }
  const beats: Beat[] = []
  let now = 0
  let place: Spot = bed
  const show = (set: CrabSet, ms: number, o: { image?: number; flip?: boolean; to?: Spot } = {}) => {
    beats.push({ set, flip: o.flip ?? false, from: now, ms, ...place, ...(o.image === undefined ? {} : { image: o.image }), ...(o.to ? { to: o.to } : {}) })
    now += ms
    if (o.to) place = o.to
  }
  const play = (set: CrabSet, images: readonly (readonly [number, number])[], flip = false) => {
    for (const [image, ms] of images) show(set, ms, { image, flip })
  }

  // Beside the basket, the nearest place from which the room opens up.
  const around = (cell: number) => {
    const s = spotOf(cell)
    return Math.abs(s.x + CRAB_W / 2 - g.basket.x - g.basket.w / 2) + Math.abs(s.y + CRAB_H - g.basket.y - g.basket.h)
  }
  const open: number[] = []
  free.forEach((f, cell) => void (f && open.push(cell)))
  const doors = [...open].sort((a, b) => around(a) - around(b) || a - b)
  let door = doors[0] ?? -1
  let fromDoor = door < 0 ? null : stepsTo(grid, door)
  const wide = (d: Int32Array) => d.reduce((n, step) => n + (step >= 0 ? 1 : 0), 0) * 2 >= open.length
  for (const cell of doors.slice(1, 40)) {
    if (!fromDoor || wide(fromDoor)) break
    fromDoor = stepsTo(grid, cell)
    door = cell
  }

  const hop = (to: Spot) => {
    const peak = { x: Math.round((place.x + to.x) / 2 / 2) * 2, y: Math.min(place.y, to.y) - HOP_RISE }
    if (lean) return show('face', 240, { to })
    play('bond', [[0, 120]])
    show('bond', 120, { image: 1, to: peak })
    show('bond', 120, { image: 1, to })
    play('bond', [[2, 120]])
  }
  const walk = (cell: number) => {
    const turns = wayDown(grid, stepsTo(grid, cell), cellOf(place))
    for (const turn of turns) {
      const to = spotOf(turn)
      const [dx, dy] = [to.x - place.x, to.y - place.y]
      if (!dx && !dy) continue
      const ms = Math.round((Math.abs(dx) + Math.abs(dy)) / SPEED)
      if (dx) show('droite', ms, { flip: dx < 0, to })
      else show(dy < 0 ? 'dos' : 'face', ms, { to })
    }
  }
  const sit = (ms: number) => show('assis', ms)

  const rests = [
    () => { for (const image of [0, 1, 2]) { play('regarde', [[image, 500]]); sit(500) } },
    () => play('cligne', [[0, 80], [1, 80], [0, 80]]),
    () => play('baille', [[0, 240], [1, 420], [2, 800], [1, 240], [0, 240]]),
  ]
  const rest = () => {
    sit(1400 + 700 * roll(5))
    if (lean) return
    rests[roll(rests.length)]!()
    sit(1400 + 700 * roll(3))
  }
  const salute = () => {
    play('salue', [[0, 160]])
    for (let k = 0; k < 3; k += 1) play('salue', [[1, 180], [2, 180]])
    play('salue', [[0, 160]])
  }
  const shoe = (flip: boolean) => {
    play('pied', [[0, 240], [1, 160], [0, 240], [1, 160], [2, 200], [3, 1200]], flip)
    // He sat on it, further along than his place: it goes off under him and he is thrown back.
    const home = place
    const flown = { x: home.x + (flip ? -SHOE : SHOE), y: home.y }
    place = flown
    for (const [image, ms, t] of [[0, 100, 0.4], [1, 160, 0.8], [2, 120, 1], [3, 240, 1]] as const) {
      const to = { x: Math.round(flown.x + (home.x - flown.x) * t), y: home.y }
      show('sursaut', ms, { image, ...(to.x === place.x ? {} : { to }) })
    }
    sit(1400)
  }

  // A place he can get to from `want`, in the first of the rows it may take, or none.
  const fits = (want: Spot, spread: readonly number[]) => {
    for (const dy of spread) {
      const j = Math.floor((want.y + dy - g.top) / CELL)
      const i = Math.floor(want.x / CELL)
      const cell = j * cols + i
      if (j >= 0 && j < grid.rows && i >= 0 && i < cols && free[cell] && fromDoor && fromDoor[cell]! >= 0) return cell
    }
    return null
  }
  const beside = (b: Area, y: number, spread: readonly number[], gap = 0) => [
    { cell: fits({ x: b.x - CLEAR - CRAB_W - gap, y }, spread), flip: false },
    { cell: fits({ x: b.x + b.w + CLEAR + gap + CELL - 1, y }, spread), flip: true },
  ].filter((o): o is { cell: number; flip: boolean } => o.cell !== null)
  const ROWS = [0, CELL, -CELL, 2 * CELL, -2 * CELL]
  const anyOf = <T>(l: readonly T[]) => l[roll(l.length)]

  type Act = { cell: number; ms: number; run: () => void }
  const atDesk = (): Act | undefined => {
    const desk = anyOf(g.desks)
    if (!desk) return undefined
    const sides = beside(desk, desk.y + desk.h - 38, ROWS, SHOE_GAP)
    const side = anyOf(sides)
    if (!side) return undefined
    return roll(3) || skip.includes('hello') ? { cell: side.cell, ms: 5200, run: () => shoe(side.flip) } : { cell: side.cell, ms: 1400, run: salute }
  }
  const atItem = (): Act | undefined => {
    const item = anyOf(g.items)
    const side = item && anyOf(beside(item, Math.max(g.top + HEADROOM, item.y + item.h - CRAB_H + 2), ROWS))
    if (!side) return undefined
    return { cell: side.cell, ms: 2200, run: () => { for (let k = 0; k < 2; k += 1) play('pince', [[0, 240], [1, 140], [2, 300]], side.flip); sit(1400) } }
  }
  const atFire = (): Act | undefined => {
    const side = g.stove && anyOf(beside(g.stove, g.stove.y + g.stove.h - CRAB_H, ROWS))
    if (!side || skip.includes('fire')) return undefined
    // Turned left, the way he is drawn, when the fire stands on his left.
    const ms = 6300 + 2100 * roll(3)
    return { cell: side.cell, ms: ms + 2000, run: () => { show('feu', ms, { flip: !side.flip }); rests[2]!() } }
  }
  const anywhere = (): number | undefined => {
    const cells = open.filter(cell => fromDoor && fromDoor[cell]! >= 0 && spotOf(cell).y - HEADROOM >= g.top)
    for (let k = 0; k < 8; k += 1) {
      const cell = cells[roll(cells.length)]
      if (cell === undefined) return undefined
      const s = spotOf(cell)
      if (k === 7 || Math.abs(s.x - place.x) + Math.abs(s.y - place.y) >= FAR) return cell
    }
    return undefined
  }
  const atRest = (): Act | undefined => {
    const cell = anywhere()
    return cell === undefined ? undefined : { cell, ms: 7000, run: rest }
  }
  const atPaper = (): Act | undefined => {
    const cell = skip.includes('paper') ? undefined : anywhere()
    return cell === undefined ? undefined : { cell, ms: 1400, run: () => play('papier', [[0, 300], [1, 200], [2, 240], [3, 600]]) }
  }

  const nap = (ms: number) => show('sommeil', ms)
  const longest = LONGEST_S * 1000
  const target = (SHORTEST_S + roll(LONGEST_S - SHORTEST_S + 1)) * 1000
  nap(6300 + 900 * roll(8))
  if (fromDoor) {
    const home = spotOf(door)
    if (!lean) play('reveil', [[0, WAKE_MS], [1, WAKE_MS], [2, WAKE_MS]])
    hop(home)
    if (!lean) play('etire', [[0, 220], [1, 260], [2, 600], [3, 220]])
    const kinds = lean ? [atRest] : [atDesk, atRest, atItem, atFire, atDesk, atPaper, atRest]
    const start = roll(kinds.length)
    let turn = 0
    for (let misses = 0; misses < kinds.length * 2 && now < target;) {
      const act = kinds[(start + turn * 3) % kinds.length]!()
      turn += 1
      const steps = act ? stepsTo(grid, act.cell)[cellOf(place)]! : -1
      const cost = act && steps >= 0 ? ((steps + fromDoor[act.cell]!) * CELL) / SPEED + act.ms : Infinity
      if (!act || cost === Infinity) {
        misses += 1
        continue
      }
      if (now + cost + 2000 + LAST_NAP_MS > longest) break
      walk(act.cell)
      act.run()
    }
    walk(door)
    hop(bed)
    if (!lean) play('reveil', [[2, WAKE_MS], [1, WAKE_MS], [0, WAKE_MS]])
  }
  nap(Math.max(LAST_NAP_MS, target - now))
  return { ms: now, beats, bed }
}

// The floor's small crab, in pixels of the world: his zone, and how fast he goes, the same on every stretch.
const MINI_W = 12 * PX
const MINI_H = 8 * PX
const MINI_SPEED = 24 / 1000

/** His rounds on a floor, his feet along the closed loop `path`, facing where he goes. Null: he has nowhere to go. */
export function roundsScript(path: readonly Spot[]): Script | null {
  const spots = path.map(p => ({ x: Math.round(p.x - MINI_W / 2), y: Math.round(p.y - MINI_H) }))
  const beats: Beat[] = []
  let now = 0
  spots.forEach((from, i) => {
    const to = spots[(i + 1) % spots.length]!
    const [dx, dy] = [to.x - from.x, to.y - from.y]
    if (!dx && !dy) return
    const ms = Math.max(1, Math.round(Math.hypot(dx, dy) / MINI_SPEED))
    const set = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'miniGauche' : 'miniDroite') : dy < 0 ? 'miniDos' : 'miniFace'
    beats.push({ ...from, set, flip: false, from: now, ms, to })
    now += ms
  })
  const first = beats[0]
  return first ? { ms: now, beats, bed: { x: first.x, y: first.y }, still: [first.set, 0] } : null
}

/** A drawing that shows through the room's frame: a line per row, far lighter than a rectangle per run. */
function strokes(c: Canvas) {
  const byColor = new Map<string, string>()
  for (let y = 0; y < c.h; y += 1) {
    let x = 0
    while (x < c.w) {
      const paint = c.get(x, y)
      let end = x + 1
      if (!paint) {
        x = end
        continue
      }
      while (end < c.w && c.get(end, y) === paint) end += 1
      byColor.set(paint, `${byColor.get(paint) ?? ''}M${x} ${y}h${end - x}`)
      x = end
    }
  }
  return [...byColor].map(([paint, d]) => `<path stroke="${paint}" d="${d}"/>`).join('')
}

// The sets drawn by rows of strokes: half a cell down, as a stroke runs along the middle of its row.
const ON_CELLS = `scale(${PX}) translate(0 .5)`
const MIRROR = 'translate(20) scale(-1 1)'
const fraction = (n: number) => String(Math.round(n * 100000) / 100000).replace(/^0\./, '.')
const keep = (ms: number) => `${Math.round(ms) / 1000}s`

/** A switch that follows the loop, on from each `[from, to]`. */
function turns(windows: readonly (readonly [number, number])[], total: number, attribute: string, on: string, off: string, ms: number) {
  const values: string[] = []
  const times: string[] = []
  const add = (at: number, value: string) => {
    if (values[values.length - 1] === value) return
    values.push(value)
    times.push(fraction(at / total))
  }
  if (windows[0]![0] > 0) add(0, off)
  for (const [from, to] of windows) {
    add(from, on)
    if (to < total) add(to, off)
  }
  return `<animate attributeName="${attribute}" calcMode="discrete" values="${values.join(';')}" keyTimes="${times.join(';')}" dur="${keep(ms)}" repeatCount="indefinite"/>`
}

/** The drawing of a sleeper, for a crab that does not move. */
const asleep = (id: string, bed: Spot) => `<use href="#${id}" transform="translate(${bed.x} ${bed.y}) ${ON_CELLS}"/>`

export type CrabArt = { style: string; defs: string; body: string }

/** The crab in his basket, and nothing else: the lightest he gets. */
export function crabPose(g: Ground): CrabArt {
  const bed = { x: Math.round(g.basket.x + (g.basket.w - SLEEP_W * PX) / 2), y: g.basket.y + BED_Y * PX }
  return { style: '', defs: `<g id="k0" fill="none">${strokes(crabImage('sommeil', 3).c)}</g>`, body: asleep('k0', bed) }
}

/** The script as a drawing: only the images it uses, on their moments, the walk and the breath in loops of their own. */
export function crabArt(s: Script): CrabArt {
  const ids = new Map<string, string>()
  const defs: string[] = []
  const idOf = (set: CrabSet, i: number) => {
    const key = `${set} ${i}`
    if (!ids.has(key)) {
      ids.set(key, `k${ids.size}`)
      defs.push(`<g id="${ids.get(key)}">${strokes(crabImage(set, i).c)}</g>`)
    }
    return ids.get(key)!
  }
  const useOf = (set: CrabSet, i: number, more = '') => {
    const { dx, dy } = crabImage(set, i)
    return `<use href="#${idOf(set, i)}"${dx ? ` x="${dx}"` : ''}${dy ? ` y="${dy}"` : ''}${more}`
  }
  const tracks = new Map<string, { b: Beat; windows: [number, number][] }>()
  for (const b of s.beats) {
    const key = `${b.set} ${b.image ?? ''} ${b.flip}`
    const t = tracks.get(key) ?? { b, windows: [] }
    const last = t.windows[t.windows.length - 1]
    if (last?.[1] === b.from) last[1] = b.from + b.ms
    else t.windows.push([b.from, b.from + b.ms])
    tracks.set(key, t)
  }
  const body = [...tracks.values()].map(({ b, windows }) => {
    const shown = turns(windows, s.ms, 'display', 'inline', 'none', s.ms)
    const faced = (inner: string) => (b.flip ? `<g transform="${MIRROR}">${inner}</g>` : inner)
    if (b.image === undefined) {
      const n = LOOPS[b.set as Loop]
      const ms = BEATS[b.set as Loop]
      const images = Array.from({ length: n }, (_, i) => `${useOf(b.set, i, i ? ' visibility="hidden"' : '')}>${turns([[(i * ms), (i + 1) * ms]], n * ms, 'visibility', 'visible', 'hidden', n * ms)}</use>`)
      return `<g display="none">${shown}${faced(images.join(''))}</g>`
    }
    if (b.flip) return `<g display="none">${shown}${faced(`${useOf(b.set, b.image)}/>`)}</g>`
    return `${useOf(b.set, b.image, ' display="none"')}>${shown}</use>`
  })
  // Each stop once: a straight line needs its ends alone, and a jump is two stops on one moment.
  const stops: { at: number; x: number; y: number }[] = []
  const stop = (at: number, p: Spot) => {
    const [a, b] = [stops[stops.length - 2], stops[stops.length - 1]]
    if (a && b && a.x === p.x && a.y === p.y && b.x === p.x && b.y === p.y) b.at = at
    else stops.push({ at, x: p.x, y: p.y })
  }
  for (const b of s.beats) {
    stop(b.from, b)
    stop(b.from + b.ms, b.to ?? b)
  }
  const values = stops.map(p => `${p.x} ${p.y}`).join(';')
  const times = stops.map(p => fraction(p.at / s.ms)).join(';')
  const moved = `<animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="${times}" dur="${keep(s.ms)}" repeatCount="indefinite"/>`
  const sleeper = idOf(...(s.still ?? ['sommeil', 3]))
  return {
    style: '.cz{display:none}@media (prefers-reduced-motion: reduce){.cm{display:none}.cz{display:inline}}',
    defs: defs.join(''),
    body: `<g fill="none"><g class="cm" transform="translate(${s.bed.x} ${s.bed.y})">${moved}<g transform="${ON_CELLS}">${body.join('')}</g></g><g class="cz">${asleep(sleeper, s.bed)}</g></g>`,
  }
}

// What a drawing of the crab may weigh: the frame around it takes the rest of the 60 000 it is held to.
const MOST = 56_000
const weightOf = (a: CrabArt) => a.defs.length + a.body.length

let lastKey = ''
let lastArt: CrabArt | null = null

/** The life of a conversation's crab in a room, as a drawing. The same room, the same string, with no more work. */
export function crabLife(seed: number, g: Ground, lean = false): CrabArt {
  const key = JSON.stringify([seed, g, lean])
  if (key !== lastKey || !lastArt) {
    lastKey = key
    let art = crabArt(crabScript(seed, g, lean))
    for (let n = 1; n <= GESTURES.length && weightOf(art) > MOST; n += 1) art = crabArt(crabScript(seed, g, lean, GESTURES.slice(0, n)))
    lastArt = art
  }
  return lastArt
}
