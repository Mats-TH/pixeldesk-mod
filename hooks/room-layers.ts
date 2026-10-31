import type { Keeper } from '../types'
import { getLanguage, t } from './i18n'
import { bulle } from './pixel/decor'
import { fit, textWidth } from './pixel/font'
import { ASH_TOP, STOVE_DEPOSIT, ash, keeper, spriteBody } from './pixel/hearth'
import type { AshLevel, FireLevel, KeeperPose } from './pixel/hearth'
import { TENUES, agentHue, chair, crab, desk, person } from './pixel/sprites'
import { CELL_H, CELL_W, COLD_HEARTH, INK, MAX_SVG, MOTION, PX, SPRITE_W, TITLE, ZZ, actor, buttonBody, buttonBox, def, deskId, deskOrigin, deskRail, flames, hearthFront, letterDefs, lightPaths, line, managerOrigin, managerSeat, onStove, paneOf, roomScene, stoveSpot, svgOpen, use, work } from './room'
import type { RoomDesk, RoomInput, StoveSpot } from './room'

/**
 * A room in layers: an iframe that reloads makes the whole app flicker, so nothing that changes often lives in one.
 * Bottom to top: the back and the count, plain images (`room.ts`); the small drawings of this file, each with a source
 * that stays the same as long as what it shows does; the labels, a plain image again, free to change at any time.
 */

/** A drawing on whole cells of the pane. `key`: the Box's, and the iframe's life. */
export type Layer = { key: string; left: number; top: number; cols: number; rows: number; width: number; height: number; source: string; alt: string }
type Cut = Omit<Layer, 'key' | 'source' | 'alt'> & { view: string }
type Geometry = ReturnType<typeof paneOf>
type Area = { x: number; y: number; w: number; h: number }

const round = (n: number) => Math.round(n * 1000) / 1000
// What the top of a desk's drawing takes above its origin: the thought bubble.
const DESK_TOP = -14
// A rail starts at 52 down a desk and stays on the labels: the person, their bubble and their hands all stop above 90.
const DESK_H = 104
const CRAB_W = 40
const CRAB_H = 26
const CRAB_TRAVEL = 120
// What the fire changes on the stove, on its grid: the window, the log basket and the floor.
const FIRE_AREA = { x: 11, y: 33, w: 26, h: 31 }

/** Where a desk's left edge falls: on a whole column, so a desk that moves along its row keeps its source. */
const deskLeft = (x: number, k: number) => Math.round((x * k) / CELL_W)

/**
 * The cells that hold `box`, relative to `at`, and the view that lines them up with the room. With `snapped` the
 * drawing starts on its column: all that is left of its place in the source is how far its row falls inside a cell.
 */
function cut(g: Geometry, at: { x: number; y: number }, box: Area, snapped = false): Cut {
  const px = (at.x + box.x) * g.k
  const py = (at.y + box.y) * g.k - g.crop
  const left = snapped ? deskLeft(at.x + box.x, g.k) : Math.floor(px / CELL_W)
  const top = Math.floor(py / CELL_H)
  const cols = Math.max(1, Math.ceil(((snapped ? 0 : px - left * CELL_W) + box.w * g.k) / CELL_W))
  const rows = Math.max(1, Math.ceil((py - top * CELL_H + box.h * g.k) / CELL_H))
  const [width, height] = [cols * CELL_W, rows * CELL_H]
  const x = snapped ? box.x : (left * CELL_W) / g.k - at.x
  const y = (top * CELL_H + g.crop) / g.k - at.y
  return { left, top, cols, rows, width, height, view: `${round(x)} ${round(y)} ${round(width / g.k)} ${round(height / g.k)}` }
}

/** The frame of a small drawing. Its colour scheme is the page's, or Chromium paints the frame opaque. */
const frameOpen = (c: Cut) => `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="${c.view}" shape-rendering="crispEdges" style="color-scheme:light dark">`

function layerOf(key: string, c: Cut, alt: string, style: string, defs: string, body: string): Layer {
  const { view: _, ...place } = c
  return { key, ...place, alt, source: `${frameOpen(c)}${style ? `<style>${style}</style>` : ''}${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>` }
}

const seen = new Map<string, unknown>()
const CACHE = 128

/** Sprites are costly to draw and a pane draws often: the same look is the same value, with no more work. */
function kept<T>(key: string, make: () => T): T {
  if (seen.has(key)) return seen.get(key) as T
  if (seen.size >= CACHE) seen.clear()
  const made = make()
  seen.set(key, made)
  return made
}

/** What a room's size depends on: the same room, the same place for all that stands in it. */
const roomKey = (p: RoomInput) => `${p.sessionId} ${p.desks.length} ${p.width} ${p.height} ${p.settings ?? false}`

/** The manager, then the agents, each at the place the room gives. */
function seatsOf(p: RoomInput) {
  const { v } = paneOf(p)
  const n = p.desks.length
  return [{ d: managerSeat(p.manager), at: managerOrigin(v) }, ...p.desks.map((d, i) => ({ d: { ...d, hue: agentHue(d.hue) }, at: deskOrigin(i, v, n) }))]
}

/** All that shows a desk at work, its desk included: a person stands behind theirs. A rail or a name never gets here. */
function deskLook(d: RoomDesk) {
  const hue = d.hue % TENUES.length
  const defs = [def('chair', chair()), def(deskId(d), desk(d.rest ? 'rest' : d.state)), def(`person-${hue}`, person(TENUES[hue]!))]
  if (d.rest) defs.push(`<path id="zz" fill="#F4E4C1" d="${ZZ}"/>`)
  else if (d.state === 'working') defs.push(def('bulle', bulle()))
  // The hue picks the phase: the order of the desks would shift it when one leaves.
  return { defs: defs.join(''), body: `${use('chair')}${actor(d, d.hue, 0)}${use(deskId(d))}${work(d, d.hue, false)}` }
}

function deskLayer(key: string, d: RoomDesk, at: { x: number; y: number }, g: Geometry): Layer {
  const c = cut(g, at, { x: 0, y: DESK_TOP, w: SPRITE_W, h: DESK_H }, true)
  const { view: _, ...place } = c
  const source = kept(`desk ${d.rest ? 'rest' : d.state} ${d.hue} ${c.view} ${c.cols} ${c.rows}`, () => {
    const parts = deskLook(d)
    return layerOf('', c, '', MOTION, parts.defs, parts.body).source
  })
  return { key, ...place, source, alt: d.title }
}

/** The desks that move, the manager first: `ids` names the agents in the order of the input. */
export function deskLayers(p: RoomInput, ids: readonly string[]) {
  const g = paneOf(p)
  return seatsOf(p).map(({ d, at }, i) => deskLayer(i ? `live-${ids[i - 1]}` : 'live-manager', d, at, g))
}

/** The fire, alone in its drawing: its images in turn, and its source is its level. */
export function fireLayer(p: RoomInput, level: FireLevel): Layer {
  return kept(`fire ${level} ${getLanguage()} ${roomKey(p)}`, () => {
    const g = paneOf(p)
    const at = stoveSpot(p)
    // On the stove's own grid: a room that grows and leaves the stove as it stood leaves this source as it was.
    const cell = PX * at.s
    const lit = flames(level)
    return layerOf('live-fire', cut({ ...g, k: g.k * cell }, { x: at.x / cell, y: at.y / cell }, FIRE_AREA), t('hearth.fireAlt'), lit.style, '', lit.body)
  })
}

const stillRoom = (p: RoomInput): RoomInput => ({ ...p, steps: [], tokens: 0, manager: { working: false }, hearth: COLD_HEARTH })

/** The small things of the decor that move: what a plan does to the room never reaches them. */
export function decorLayers(p: RoomInput) {
  return kept(`decor ${roomKey(p)}`, () => {
    const g = paneOf(p)
    const { life } = roomScene(stillRoom(p), { layer: 'back' })
    const layers: Layer[] = []
    if (life.lights.box) layers.push(layerOf('live-lights', cut(g, { x: 0, y: 0 }, life.lights.box), t('pane.lights'), MOTION, '', lightPaths(life.lights)))
    if (life.cat) layers.push(layerOf('live-cat', cut(g, { x: life.cat.x, y: life.cat.y }, { x: 0, y: -2, w: life.cat.w, h: life.cat.h + 2 }), t('pane.cat'), MOTION, '', `<g class="sl">${life.cat.svg}</g>`))
    return layers
  })
}

/** The crab on its beat, under the desks' labels but over the floor. */
export function crabLayer(p: RoomInput, delay: number): Layer {
  return kept(`crab ${delay} ${roomKey(p)}`, () => {
    const g = paneOf(p)
    const at = { x: Math.round(g.v.w / 2) - CRAB_W / 2, y: g.v.h - 34 }
    const c = cut(g, at, { x: -CRAB_TRAVEL, y: -2, w: CRAB_W + 2 * CRAB_TRAVEL, h: CRAB_H + 2 })
    return layerOf('live-crab', c, t('pane.crab'), MOTION, def('crab', crab()), `<g class="c" style="animation-delay:-${delay}s"><g class="lg">${use('crab')}</g></g>`)
  })
}

/** What is written on the desks, on the room's own frame: it lies over the iframes, and it changes as it likes. */
function labelsDraw(p: RoomInput, detail: number) {
  const { v, k } = paneOf(p)
  const defs = new Map<string, string>()
  const need = (id: string, make: () => string) => void (defs.has(id) || defs.set(id, make()))
  const seats = seatsOf(p)
  let words = ''
  const onDesks = seats.map(({ d, at }, i) => {
    const title = !i || detail < 5 ? fit(d.title, TITLE, 98) : ''
    words += title
    const name = title ? line(title, Math.round(60 - textWidth(title, TITLE) / 2), 59, TITLE, INK) : ''
    const rail = d.rest ? '' : deskRail(d, Math.max(detail, 6), need)
    return `<g transform="translate(${round((deskLeft(at.x, k) * CELL_W) / k)} ${at.y})">${rail}${name}</g>`
  })
  const manager = seats[0]!.at
  const front = hearthFront(p.hearth ?? COLD_HEARTH, stoveSpot(p), { x: (deskLeft(manager.x, k) * CELL_W) / k, y: manager.y })
  return `${svgOpen(p.width, p.height, `0 0 ${v.w} ${v.h}`)}<defs>${[...defs.values()].join('')}${letterDefs(words + front.letters)}</defs>${onDesks.join('')}${front.body}</svg>`
}

/** The labels of a room: the rails, the names, the ash, the plate and the letter. */
export function labelsSvg(p: RoomInput) {
  return kept(`labels ${getLanguage()} ${JSON.stringify([p.desks, p.manager, p.hearth, p.width, p.height])}`, () => [1, 2, 3, 4, 5, 6, 7].reduce((svg, detail) => (svg.length > MAX_SVG ? labelsDraw(p, detail) : svg), labelsDraw(p, 0)))
}

// ---------- The keeper's visit ----------

const VISIT_S = 12
// Up to the stove, the moment the fire takes, and the walk back.
const ARRIVES_S = 4.8
const DROPS_S = 5.6
const LEAVES_S = 6.4
// How long the feet hold each image.
const STEP_S = 0.25
const WORK_S = 0.4
const KEEPER_W = 60
const FEET = 58
const TIP_Y = 44
// A broom stops a little nearer the room and lower than the log's tip: the heap lies in front of the stove.
const BROOM_SHIFT = { x: 8, y: 11 }
const LANE_BOTTOM = 10

const seconds = (s: number) => `${round(s)}s`

/** One image of two in turn, as long as its group shows. */
function beat(body: string, turn: 0 | 1, every: number) {
  return `<g visibility="${turn ? 'hidden' : 'visible'}"><animate attributeName="visibility" values="${turn ? 'hidden;visible' : 'visible;hidden'}" dur="${seconds(every * 2)}" calcMode="discrete" repeatCount="indefinite"/>${body}</g>`
}

/** A pose between two moments. `back`: seen from the other side. */
function pose(name: KeeperPose, from: number, to: number, every: number, back = false) {
  const sprite = (frame: 0 | 1) => `<g transform="scale(${PX})">${spriteBody(keeper(name, frame))}</g>`
  const body = `${beat(sprite(0), 0, every)}${beat(sprite(1), 1, every)}`
  const facing = back ? `<g transform="translate(${KEEPER_W} 0) scale(-1 1)">${body}</g>` : body
  return `<g display="none"><set attributeName="display" to="inline" begin="${seconds(from)}" end="${seconds(to)}"/>${facing}</g>`
}

/** What takes at the very moment of the drop: the full fire over the old one, or the heap that goes. */
function atTheDrop(tool: Keeper, at: StoveSpot, held: { fire: FireLevel; ash: AshLevel }) {
  if (tool === 'log') {
    const lit = flames('full')
    return { style: lit.style, body: `<g display="none"><set attributeName="display" to="inline" begin="${seconds(DROPS_S)}" fill="freeze"/>${onStove(at, lit.body)}</g>` }
  }
  if (held.ash === 'none') return { style: '', body: '' }
  return { style: '', body: `<g><set attributeName="display" to="none" begin="${seconds(DROPS_S)}" fill="freeze"/>${onStove(at, `<g transform="translate(0 ${ASH_TOP})">${spriteBody(ash(held.ash, 0))}</g>`)}</g>` }
}

/**
 * One visit, played once: in by the right edge, along the bottom under the desks, up to the stove, and back the same
 * way. `held`: what the room showed before the visit, as the logic has moved on already. No line on the floor (D-31).
 */
export function keeperLayer(p: RoomInput, tool: Keeper, run: number, held: { fire: FireLevel; ash: AshLevel }): Layer {
  const g = paneOf(p)
  const at = stoveSpot(p)
  const stop = { x: at.x + STOVE_DEPOSIT.x * PX * at.s, y: at.y + (STOVE_DEPOSIT.y * PX - TIP_Y) * at.s }
  if (tool === 'broom') Object.assign(stop, { x: stop.x + BROOM_SHIFT.x * at.s, y: stop.y + BROOM_SHIFT.y * at.s })
  const bottom = (g.crop + p.height) / g.k
  const lane = bottom - (LANE_BOTTOM + FEET) * at.s
  const start = g.v.w + 8
  const [along, up] = [start - stop.x, Math.max(0, lane - stop.y)]
  const share = along / (along + up)
  const key = (s: number) => round(s / VISIT_S)
  const values = [[start, lane], [stop.x, lane], [stop.x, stop.y], [stop.x, stop.y], [stop.x, lane], [start, lane]].map(([x, y]) => `${round(x!)} ${round(y!)}`).join(';')
  const times = [0, key(ARRIVES_S * share), key(ARRIVES_S), key(LEAVES_S), key(LEAVES_S + (VISIT_S - LEAVES_S) * (1 - share)), 1].join(';')
  const walks = tool === 'log'
    ? `${pose('carry', 0, ARRIVES_S, STEP_S)}${pose('drop', ARRIVES_S, LEAVES_S, WORK_S)}${pose('walk', LEAVES_S, VISIT_S, STEP_S)}`
    : `${pose('broom', 0, ARRIVES_S, STEP_S)}${pose('sweep', ARRIVES_S, LEAVES_S, WORK_S)}${pose('broom', LEAVES_S, VISIT_S, STEP_S, true)}`
  const moved = `<g><animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="${times}" dur="${VISIT_S}s" fill="freeze"/><g transform="scale(${at.s})">${walks}</g></g>`
  const drop = atTheDrop(tool, at, held)
  const c = cut(g, { x: 0, y: 0 }, { x: 0, y: stop.y - 8, w: g.v.w, h: bottom - stop.y + 8 })
  const still = '@media (prefers-reduced-motion: reduce){svg>g{display:none}}'
  return layerOf(`live-keeper-${run}`, c, t('hearth.keeperAlt'), `${drop.style}${still}`, '', `${drop.body}${moved}`)
}

/** The look of the button under the pointer, on the cells it takes, and those cells. */
export function buttonLit(p: RoomInput, label: string) {
  const g = paneOf(p)
  const b = buttonBox(stoveSpot(p))
  const c = cut(g, { x: 0, y: 0 }, { x: b.x, y: b.y, w: b.w + 4 * b.k, h: b.h + 4 * b.k })
  const body = `<g transform="translate(${b.x} ${b.y}) scale(${b.k})">${buttonBody(label, true)}</g>`
  const { view: _, ...place } = c
  return { ...place, source: `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="${c.view}" shape-rendering="crispEdges"><defs>${letterDefs(label)}</defs>${body}</svg>` }
}

