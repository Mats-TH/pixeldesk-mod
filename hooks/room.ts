import type { ManagerDesk, PlanLine, PlanStatus, RoomTheme } from '../types'
import { drawRoom, seedOf } from './draw'
import type { Box, DrawnRoom } from './draw'
import { getLanguage, t } from './i18n'
import type { Canvas } from './pixel/canvas'
import { bulle, caseEtape } from './pixel/decor'
import { fit, textWidth } from './pixel/font'
import { UNIT } from './pixel/font-data'
import { envelope, spriteBody } from './pixel/hearth'
import type { AshLevel, EnvelopeState, FireLevel, Point } from './pixel/hearth'
import { PX, scaled, veiled } from './pixel/pack'
import { def, fontScale, letterDefs, letterUses, line, use } from './pixel/text'
import type { Moving, Pack } from './pixel/pack'
import { crabLife, crabPose } from './pixel/crab'
import type { Ground } from './pixel/crab'
import { TENUES, agentHue, person, skinOf } from './pixel/sprites'
import { packOf } from './pixel/themes'
import type { DeskState } from './pixel/sprites'

/**
 * `done`, `total` and `live` are absent on a desk saved by an older version: it reads as no plan yet.
 * `rest`: the manager between two turns, screen off.
 */
export type RoomDesk = { title: string; state: DeskState; hue: number; done?: number; total?: number; live?: boolean; rest?: boolean }
export type { ManagerDesk }
export const AT_REST: ManagerDesk = { working: false }
/** The plate over the stove: what it says, and the handover letter on it. `button`: the plate that takes a click. */
export type HearthPanel = { title: string; sub: string; letter: EnvelopeState; button: boolean }
/** What the room's hearth shows. `letter`: the envelope on the manager's desk. */
export type HearthLook = { fire: FireLevel; ash: AshLevel; letter: EnvelopeState | null; panel: HearthPanel | null }
export const COLD_HEARTH: HearthLook = { fire: 'out', ash: 'none', letter: null, panel: null }
/** `desks`: the agents, the manager apart: he is no arrival and his desk never leaves. `settings`: the button stands in the corner. */
export type RoomInput = { sessionId: string; desks: RoomDesk[]; manager: ManagerDesk; previous: number; steps: PlanLine[]; tokens: number; width: number; height: number; settings?: boolean; hearth?: HearthLook; theme?: RoomTheme; cost?: number | null }
/** What of a room moves on its own, for the layers: the lights on the wall as one path each, what its theme sets moving, and the floor the crab has. */
export type SceneLife = { lights: { odd: string; even: string; box: Box | null }; moving: Moving[]; ground: Ground }
/** A room ready to be placed: its body, the definitions it needs, by id, the letters it writes, and what its CSS adds. */
export type Scene = { defs: Map<string, string>; letters: string; body: string; w: number; h: number; style: string; life: SceneLife }
/**
 * `layer` 'back': only what never moves, for the bottom image of a room in layers.
 * `detail` gives way under the size limit, step by step: the furniture, the small movements and the light, the end of
 * long labels, what hangs on the wall, more of the labels and the names of the desks, then all that moves at a desk,
 * and last the labels themselves. The screen and the box of every step of the plan always stay.
 * `crab` 'pose': he stays asleep in his basket, the lightest he gets.
 */
export type SceneOptions = { detail?: number; layer?: 'back'; crab?: 'pose' }

export { PX, scaled }
export const CELL_W = 8
export const CELL_H = 21
const BOARD_EDGE = 8
// How far from the left of the pane, in true pixels, the wall stays clear for the settings button.
const SETTINGS_CORNER = 52
const ROOM_MARGIN = 10
// How long an envelope takes to arrive: the news wait as long to land.
export const FLIGHT_MS = 2400
// The engine refuses a drawing past 131 072 characters.
export const MAX_SVG = 130_000
const WALL = 75
const DESK_W = 130
const DESK_H = 106
// What the sprite of a desk takes, inside the step between two desks.
export const SPRITE_W = 120
const SPRITE_H = 90
export const TITLE = 16
export const INK = '#1B1730'
// From three rows on the room shows at about scale 1, in a pane about as high as it is wide.
const OPEN_W = 780
const OPEN_COL = 132
const OPEN_RATIO = 1.03
const ROOM_FLOOR = 293

/** `col` and `row`: the steps between desks. `edge`: what the board leaves on its right. `seats`: where a theme sets the manager and each agent, when not in rows. */
export type View = { w: number; h: number; cols: number; rows: number; extra: number; top: number; col: number; row: number; edge: number; seats?: Point[] }

// Up to three agents stand on one row.
const colsOf = (n: number) => (n > 3 ? Math.ceil(Math.sqrt(n)) : Math.max(1, n))
/** The manager's row, then the agents'. */
const rowsOf = (n: number, cols: number) => (n ? 1 + Math.ceil(n / cols) : 1)

/** The room a number of agents needs, in CSS pixels at scale 1. Alone, the manager takes the place of a single desk. */
export function viewOf(n: number): View {
  const cols = colsOf(n)
  const rows = rowsOf(n, cols)
  if (!n) return { w: 540, h: 360, cols, rows, extra: 0, top: 215, col: DESK_W, row: DESK_H, edge: ROOM_MARGIN }
  const h = rows * DESK_H + ROOM_FLOOR
  const open = rows > 2
  return { w: open ? Math.max(OPEN_W, Math.round(h * OPEN_RATIO)) : 615, h, cols, rows, extra: 0, top: open ? 255 : 234, col: open ? OPEN_COL : DESK_W, row: DESK_H, edge: ROOM_MARGIN }
}

/** The same room stretched to a pane's shape: the floor grows and the desks stay centred on it. */
export function sized(n: number, width: number, height: number, theme?: RoomTheme): View {
  const v = viewOf(n)
  const h = Math.max(v.h, Math.round((height * v.w) / width))
  // With at most one agent the wall shows at its largest, and the board keeps 8 true pixels on its right.
  const edge = n <= 1 ? Math.round((BOARD_EDGE * v.w) / width) : v.edge
  const seats = packOf(theme).place?.(n, v.w, h)
  return { ...v, h, extra: h - v.h, edge, ...(seats ? { seats } : {}) }
}

/** Where the first of `seats` desks stands on a row, so the row stays centred on the room's axis. */
const seatX = (seats: number, v: View) => Math.round((v.w - seats * v.col) / 2) + Math.round((v.col - SPRITE_W) / 2)

/** The manager heads the room, on its axis, whatever stands below him. */
export const managerOrigin = (v: View) => v.seats?.[0] ?? { x: seatX(1, v), y: v.top + Math.round(v.extra / 2) }

/** The last row, when it is not full, stays centred. */
export function deskOrigin(i: number, v: View, n: number) {
  const seat = v.seats?.[i + 1]
  if (seat) return seat
  const row = Math.floor(i / v.cols)
  const seats = row === Math.floor((n - 1) / v.cols) ? n - row * v.cols : v.cols
  return { x: seatX(seats, v) + (i % v.cols) * v.col, y: managerOrigin(v).y + (row + 1) * v.row }
}

const boxOf = (o: { x: number; y: number }, k: number, w = SPRITE_W, h = SPRITE_H) => ({ x: Math.round(o.x * k), y: Math.round(o.y * k), w: Math.round(w * k), h: Math.round(h * k) })

/** Where each desk falls in a room of that size, for the hover zones. */
export function deskBoxes(n: number, width: number, height: number, theme?: RoomTheme) {
  const v = sized(n, width, height, theme)
  return Array.from({ length: n }, (_, i) => boxOf(deskOrigin(i, v, n), width / v.w))
}

/** Where the manager's desk falls, for his hover zone. */
export function managerBox(n: number, width: number, height: number, theme?: RoomTheme) {
  const v = sized(n, width, height, theme)
  return boxOf(managerOrigin(v), width / v.w)
}

// The progress rail of a desk and of a card.
const RAIL_BACK = '#1B1730'
const RAIL_TODO = '#3A3355'
const RAIL_LIVE = '#FFC857'
const RAIL_DONE = '#5FC9B8'
const RAIL_WON = '#8CC265'
const RAIL_STOP = '#E4633A'
const RAIL_GAP = 2
const MAX_CELLS = 12

/** What the drawing of a plan needs from its steps. */
export const progressOf = (steps: readonly { status: PlanStatus }[]) => ({
  done: steps.filter(st => st.status === 'completed').length,
  total: steps.length,
  live: steps.some(st => st.status === 'in_progress'),
})

/** The colour of each box of the rail, in order. Empty: no plan known, the rail shows its dots. */
export function railCells(d: Pick<RoomDesk, 'state' | 'done' | 'total' | 'live'>): string[] {
  const total = d.total ?? 0
  const done = Math.min(d.done ?? 0, total)
  if (d.state === 'done') return Array.from({ length: Math.max(1, total) }, () => RAIL_WON)
  const hit = d.state === 'failed' ? RAIL_STOP : RAIL_DONE
  // The band past 12 steps shows how far along, not which step: its gold would be a sliver.
  const gold = d.state === 'working' && d.live && done < total && total <= MAX_CELLS
  return Array.from({ length: total }, (_, i) => (i < done ? hit : gold && i === done ? RAIL_LIVE : RAIL_TODO))
}

/**
 * The boxes in `w` by `h` from (x, y), one path per colour. Past 12 they touch, and a colour is one band.
 * Rounded box by box from the whole, so the pixels left over spread along the rail.
 */
export function railPaths(cells: readonly string[], x: number, y: number, w: number, h: number) {
  const n = cells.length
  const gap = n > MAX_CELLS ? 0 : RAIL_GAP
  const room = w - gap * (n - 1)
  const runs: { color: string; from: number; to: number }[] = []
  cells.forEach((color, i) => {
    const from = x + Math.round((i * room) / n) + i * gap
    const to = x + Math.round(((i + 1) * room) / n) + i * gap
    const last = runs[runs.length - 1]
    if (!gap && last?.color === color) last.to = to
    else runs.push({ color, from, to })
  })
  return [...new Set(cells)].map(color => {
    const d = runs.filter(r => r.color === color).map(r => `M${r.from} ${y}h${r.to - r.from}v${h}h-${r.to - r.from}z`).join('')
    return `<path fill="${color}" d="${d}"/>`
  }).join('')
}

const DOTS = [0, 1, 2]
const dotAt = (k: number, x: number, y: number) => `M${x + k * 8} ${y}h4v4h-4z`

/** Three dots from (x, y): no plan yet. They take turns while the agent works and stand still once it stopped. */
export function railDots(state: DeskState, x: number, y: number, moving = true) {
  if (state === 'failed') return `<path fill="${RAIL_STOP}" d="${DOTS.map(k => dotAt(k, x, y)).join('')}"/>`
  if (!moving) return `<path fill="${RAIL_DONE}" d="${DOTS.map(k => dotAt(k, x, y)).join('')}"/>`
  return DOTS.map(k => `<path class="td${k}" fill="${RAIL_DONE}" d="${dotAt(k, x, y)}"/>`).join('')
}

/** The amount as the plate shows it: 0,42 $, 1,24 $, 128 $. */
export function formatCost(usd: number) {
  const shown = Number.isFinite(usd) ? Math.max(0, usd) : 0
  return `${(shown < 100 ? shown.toFixed(2) : String(Math.round(shown))).replace('.', t('room.decimal'))} $`
}

/** The token count as the screen shows it: 950, 12,4k, 128k, 1,2M. */
export function formatTokens(n: number) {
  const whole = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
  const short = (v: number, unit: string) => `${v < 99.95 ? String(Math.round(v * 10) / 10).replace('.', t('room.decimal')) : Math.round(v)}${unit}`
  if (whole < 1000) return String(whole)
  if (whole < 999_500) return short(whole / 1000, 'k')
  return short(whole / 1_000_000, 'M')
}

export { def, letterDefs, line, use }

const ROOM_BOARD_W = 164
// The wall's decor counts on a board this wide, so a plan does not move it.
const STEADY_BOARD_W = 120
const STEP = 17
const BOARD_TOP = 14
const BOARD_HEAD = 19
const BOARD_ROWS = BOARD_TOP + BOARD_HEAD + 4
const BOARD_LOW = 158
const BOARD_TALL = 150
const TELE_Y = 36
const TELE_H = 60

/** The size of the plan board: it hugs its labels, and its lines shrink once they no longer fit on the wall. */
function planBoard(steps: RoomInput['steps'], detail: number) {
  const title = t('room.planTitle')
  const chrome = BOARD_TOP + BOARD_HEAD + 13
  // An empty board still says so, on one line.
  const rows = Math.max(1, steps.length)
  const full = chrome + rows * STEP
  const k = full > BOARD_TALL ? (BOARD_TALL - chrome) / (rows * STEP) : 1
  const widest = Math.max(0, ...steps.map(st => textWidth(st.text, 16)))
  const w = Math.min(ROOM_BOARD_W, Math.max(96, Math.ceil((Math.max(widest * k + 20 * k, textWidth(title, 18)) + 32) / 8) * 8))
  const room = (w - 32) / k - 20
  const most = detail === 6 ? 24 : detail === 5 ? 60 : detail >= 3 ? room * 0.6 : room
  const labels = steps.map(st => (detail >= 7 ? '' : fit(st.text, 16, most)))
  return { w, h: Math.round(Math.min(full, BOARD_TALL)), k, labels, title }
}

/** Where the board hangs: against the right of the wall, as high as the wall lets it. */
function boardSpot(plan: ReturnType<typeof planBoard>, v: View) {
  return { x: v.w - v.edge - plan.w, y: Math.max(8, Math.min(18, BOARD_LOW - plan.h)) }
}

function board(plan: ReturnType<typeof planBoard>, steps: RoomInput['steps'], x: number, y: number, look: Pack['board']) {
  const k = Math.round(plan.k * 1000) / 1000
  const boxes = plan.labels.map((label, i) => {
    const top = i * STEP
    const glow = steps[i]!.status === 'in_progress' ? `<rect y="${top}" width="${Math.ceil(textWidth(label, 16)) + 20}" height="${STEP}" fill="${look.glow}"/>` : ''
    return glow + use(`c${steps[i]!.status[0]}`, 2, top + 3)
  })
  const pitch = STEP / UNIT
  const inks = (['completed', 'in_progress', 'pending'] as const).map(status => {
    const rows = plan.labels.map((label, i) => (label && steps[i]!.status === status ? `<g transform="translate(0 ${Math.round(i * pitch * 10) / 10})">${letterUses(label)}</g>` : ''))
    return rows.some(Boolean) ? `<g fill="${look.inks[status]}">${rows.join('')}</g>` : ''
  })
  const shrink = k < 1 ? ` scale(${k})` : ''
  const empty = steps.length ? '' : line(t('room.noPlan'), 16, BOARD_ROWS, 16, look.inks.completed)
  return `<g transform="translate(${x} ${y - 4})">${use(`tableau-${plan.w}-${plan.h}`)}${line(plan.title, 16, BOARD_TOP + 2, 18, look.title)}${empty}<g transform="translate(16 ${BOARD_ROWS})${shrink}">${boxes.join('')}<g transform="translate(18) scale(${fontScale(16)})">${inks.join('')}</g></g></g>`
}

/** Where the set hangs: left of the board, whatever the detail. */
const teleOf = (plan: ReturnType<typeof planBoard>, v: View) => ({ x: boardSpot(plan, v).x - 10 - 72, y: TELE_Y })

/** The screen on the wall. Its count changes often and reloads a frame: it lives on a drawing of its own. */
const screen = (x: number, y: number) => `<g transform="translate(${x} ${y})">${use('tele')}</g>`

// The shade a floor lays over a room at rest.
export const SHADE = { ink: '#17142B', alpha: 0.56 }

/**
 * The count of a room, large and centred, at the very place of the set under it. Digits alone: on a scale that is not
 * whole the edges of a drawing are soft, and a copy of the screen on top would show them twice.
 */
function roomCount(p: RoomInput) {
  const pack = packOf(p.theme)
  const v = sized(p.desks.length, p.width, p.height, p.theme)
  const { x, y } = teleOf(planBoard(p.steps, 0), v)
  const value = formatTokens(p.tokens)
  const { cx, y: top, size, ink } = pack.tele.digits
  const digits = line(value, Math.round(cx - textWidth(value, size) / 2), top, size, ink)
  const amount = p.cost != null ? formatCost(p.cost) : ''
  const { cost } = pack.plaque
  const paid = amount ? `<g transform="translate(${pack.plaque.dx} ${pack.plaque.dy})">${line(amount, Math.round(cost.cx - textWidth(amount, cost.size) / 2), cost.y, cost.size, cost.ink)}</g>` : ''
  return { value: value + amount, w: v.w, h: v.h, body: `<g transform="translate(${x} ${y})">${digits}${paid}</g>` }
}

/** The drawing's frame: the room and the count over it share it to the character, so they line up. */
export const svgOpen = (width: number, height: number, view: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${view}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">`

/** What was last sent: `plain` is the drawing without the zoom, `played` whether the arrival under way has zoomed. */
export type Drawn = { plain: string; sent: string; played: boolean }
export const NOT_DRAWN: Drawn = { plain: '', sent: '', played: false }
/** The room's frame and the image of its counts. */
export type DrawnPair = { image: Drawn; count: Drawn }
export const NOTHING_DRAWN: DrawnPair = { image: NOT_DRAWN, count: NOT_DRAWN }

/**
 * The source to send next. `zoomed` is there while an arrival waits; without one the mark goes back to zero.
 * The same plain drawing: the last source again, zoom included, as any other change reloads the frame.
 * A new one: it zooms if the arrival has not, and stands as it is if it has.
 */
export function zoomOnce(last: Drawn, plain: string, zoomed: (() => string) | null): Drawn {
  if (!zoomed) return plain === last.plain ? { ...last, played: false } : { plain, sent: plain, played: false }
  if (plain === last.plain) return last
  return { plain, sent: last.played ? plain : zoomed(), played: true }
}

/**
 * The frame and its counts. The counts zoom with the very source that starts the frame's zoom, and only then:
 * a new image starts its animation over, and a late one would run alone over a room that stands still.
 */
export function zoomPair(last: DrawnPair, arrival: boolean, image: (zoom: boolean) => string, count: (zoom: boolean) => string): DrawnPair {
  const next = zoomOnce(last.image, image(false), arrival ? () => image(true) : null)
  const started = next.sent !== last.image.sent && next.sent !== next.plain
  return { image: next, count: zoomOnce({ ...last.count, played: false }, count(false), started ? () => count(true) : null) }
}

/** An arrival, or the settled state: whatever comes next starts from a fresh mark, even with no drawing in between. */
export const zoomAgain = (d: DrawnPair): DrawnPair => ({ ...d, image: { ...d.image, played: false } })

// Light is plain shapes: a row by row drawing would take most of the size budget.
function lights(v: View, windowX: number | null, glow: Pack['light']) {
  const moon = (x: number) => `<polygon points="${x},${(WALL + 5) * PX} ${x + 44},${(WALL + 5) * PX} ${x + 94},${(WALL + 56) * PX} ${x + 50},${(WALL + 56) * PX}" fill="#9DB4FF" fill-opacity=".1"/>`
  const cy = v.h / 2 + WALL + 8
  const pool = (rx: number, ry: number, a: number) => `<ellipse cx="${v.w / 2}" cy="${cy}" rx="${Math.round(rx)}" ry="${Math.round(ry)}" fill="#FFC857" fill-opacity="${a}"/>`
  const pools = glow ? `${pool(v.w * 0.39, (v.h - 150) * 0.48, glow[0])}${pool(v.w * 0.27, (v.h - 150) * 0.34, glow[1])}` : ''
  return `${windowX === null ? '' : moon(windowX + 20) + moon(windowX + 72)}${pools}`
}

// CSS moves plain elements only: a part inside a <use> would not run in every engine.
// The four phases keep desks out of step without an inline delay on every moving part.
const phase = (i: number) => (i % 4 ? ` d${i % 4}` : '')
const spot = (cls: string, d: string, fill?: string) => `<path class="${cls}"${fill ? ` fill="${fill}"` : ''} d="${d}"/>`

/** The person at a desk: typing, shaking their head, or at rest. */
export function actor(d: RoomDesk, i: number, detail: number) {
  const hue = d.hue % TENUES.length
  if (detail >= 6) return use(`person-${hue}`, 44, -4)
  const skin = skinOf(TENUES[hue]!)
  const move = d.state === 'working' ? 'bo' : d.state === 'failed' ? 'sh' : 'br'
  return `<g class="${move}${phase(i)}">${use(`person-${hue}`, 44, -4)}${detail >= 2 ? '' : spot(`bl${phase(i)}`, 'M50 10h4v4h-4zM64 10h4v4h-4z', skin)}</g>`
}

/** What shows the work: hands on the keys, a thought bubble, a pulsing screen and steam. */
export function work(d: RoomDesk, i: number, lean: boolean) {
  const ph = phase(i)
  if (d.rest) return use('zz')
  if (d.state === 'failed') return `<g fill="#E4505F">${spot('al', 'M8 0h4v8h-4z')}${spot('al', 'M8 10h4v4h-4z')}</g>`
  if (lean) return ''
  if (d.state === 'done') return spot(`st${ph}`, 'M88 28h2v2h-2z', '#FFFFFF')
  const skin = skinOf(TENUES[d.hue % TENUES.length]!)
  const hands = `<g fill="${skin}">${spot(`ha${ph}`, 'M50 32h6v4h-6z')}${spot(`hb${ph}`, 'M68 32h6v4h-6z')}</g>`
  const dots = `<g fill="${INK}">${[0, 1, 2].map(k => spot(`td${k}`, `M${86 + k * 7} -4h4v4h-4z`)).join('')}</g>`
  const steam = spot(`st${ph}`, 'M88 28h2v2h-2z', '#FFFFFF')
  return hands + use('bulle', 78, -12) + dots + spot(`sc${ph}`, 'M26 24h8v6h-8z', '#BFF5E6') + steam
}

const RAIL_RECT = `<rect x="8" y="52" width="104" height="8" fill="${RAIL_BACK}"/>`
export const ZZ = 'M82 4h8v2h-8zM86 6h2v2h-2zM84 8h2v2h-2zM82 10h8v2h-8zM92 0h6v2h-6zM94 2h2v2h-2zM92 4h6v2h-6z'

/** The manager as a desk: at work he shows his plan, at rest his desk stays closed. */
export const managerSeat = (m: ManagerDesk): RoomDesk =>
  m.working ? { title: t('role.manager'), state: 'working', hue: 0, done: m.done ?? 0, total: m.total ?? 0, live: m.live ?? false } : { title: t('role.manager'), state: 'done', hue: 0, rest: true }
export const deskId = (d: RoomDesk) => `desk-${d.rest ? 'rest' : d.state}`

/**
 * The rail of a desk, at most four shapes. A level is one definition per value, so a full floor
 * stays light; dots that take turns stay plain, as CSS moves nothing inside a <use>.
 * On the last step of the size limit a plan falls on one of eleven bands: the definitions stop growing.
 */
export function deskRail(d: RoomDesk, detail: number, need: (id: string, make: () => string) => void) {
  const total = d.total ?? 0
  const lean = detail >= 7 && total > 0
  const shown = lean ? { ...d, done: Math.round((Math.min(d.done ?? 0, total) * 10) / total) * 2, total: 20, live: false } : d
  const cells = railCells(shown)
  if (cells.length) {
    const id = `r${d.state[0]}${shown.done ?? 0}-${shown.total ?? 0}${shown.live ? 'l' : ''}`
    need(id, () => `<g id="${id}">${RAIL_RECT}${railPaths(cells, 10, 54, 100, 4)}</g>`)
    return use(id)
  }
  if (d.state === 'failed' || detail >= 6) {
    const id = `r${d.state[0]}`
    need(id, () => `<g id="${id}">${RAIL_RECT}${railDots(d.state, 50, 54, false)}</g>`)
    return use(id)
  }
  need('rb', () => `<g id="rb">${RAIL_RECT}</g>`)
  return use('rb') + railDots(d.state, 50, 54)
}

/** Small lights and stars that twinkle on the decor the room drew, and the part of the wall they take. */
function sparks(room: ReturnType<typeof drawRoom>, { wall }: Pack): SceneLife['lights'] {
  const odd: string[] = []
  const even: string[] = []
  const boxes: Box[] = []
  for (const it of room.wall) {
    const cells = it.id === wall.string?.id ? wall.string.sparks?.(it.w) : wall.items[it.id]?.sparks
    if (!cells?.length) continue
    for (const [x, y] of cells) (x % 2 ? odd : even).push(`M${(it.x + x) * PX} ${(it.y + y) * PX}h${it.id === wall.string?.id ? '6v6h-6' : '2v2h-2'}z`)
    boxes.push({ x: it.x * PX, y: it.y * PX, w: it.w * PX, h: it.h * PX })
  }
  if (!boxes.length) return { odd: '', even: '', box: null }
  const [x, y] = [Math.min(...boxes.map(b => b.x)), Math.min(...boxes.map(b => b.y))]
  return { odd: odd.join(''), even: even.join(''), box: { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y } }
}

/** The lights, as CSS moves them. */
export const lightPaths = (l: SceneLife['lights']) => (l.odd ? spot('tw', l.odd, '#FFF6DE') : '') + (l.even ? spot('tw d2', l.even, '#FFF6DE') : '')

// The stove stands by the left of the room, at this share of what the pane shows, as in the design.
const STOVE_TOP = 326 / 760
/** The widths the design sizes the stove for: it keeps the size of a room of those, whatever the room around it. */
const STOVE_BASE = { alone: 540, room: 615 }
// The design draws the plate on a pane 780 wide over a room of 615, at this scale of the stove.
const PLATE_K = 615 / 780
const PLATE = { x: 8, y: 270 - 326, w: 227, h: 42, tall: 58, button: 110, buttonH: 32 }
// Where the letter lies on the manager's desk.
const LETTER_DESK = { x: 54, y: 33 }
const LETTER_W = 28
const LETTER_H = 22
const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places

/** The room's scale on the pane, and what a short pane loses at the top and at the bottom, in pixels of the pane. */
export function paneOf(p: Pick<RoomInput, 'desks' | 'width' | 'height' | 'theme'>) {
  const v = sized(p.desks.length, p.width, p.height, p.theme)
  const k = p.width / v.w
  return { v, k, crop: Math.max(0, v.h * k - p.height) / 2 }
}

export type StoveSpot = { x: number; y: number; s: number }

/** Where the stove's grid starts, in pixels of the room, and how much larger than a room's pixels it is drawn. */
export function stoveSpot(p: Pick<RoomInput, 'desks' | 'width' | 'height' | 'theme'>): StoveSpot {
  const { v, k, crop } = paneOf(p)
  const n = p.desks.length
  const { hearth } = packOf(p.theme)
  const own = hearth.spot?.(n, v.w, v.h)
  if (own) return { ...own, s: 1 }
  const rug = rugOf(v, n)
  const s = Math.min(v.w / (n < 2 ? STOVE_BASE.alone : STOVE_BASE.room), Math.max(1, rug.x / hearth.w))
  return { x: 0, y: (crop + STOVE_TOP * p.height) / k, s }
}

/** The floor the stove takes, for what stands on it and for its hover zone, in pixels of the pane. */
export function hearthBox(n: number, width: number, height: number, theme?: RoomTheme) {
  const place = { desks: Array.from({ length: n }, () => ({})) as RoomDesk[], width, height, ...(theme ? { theme } : {}) }
  const at = stoveSpot(place)
  const { hearth } = packOf(theme)
  return boxOf(at, paneOf(place).k, hearth.w * at.s, hearth.feet * at.s)
}

/** Where the letter lies on the manager's desk, for its hover zone, in pixels of the pane. */
export function letterBox(n: number, width: number, height: number, theme?: RoomTheme) {
  const { v, k } = paneOf({ desks: Array.from({ length: n }, () => ({})) as RoomDesk[], width, height, ...(theme ? { theme } : {}) })
  const at = managerOrigin(v)
  return boxOf({ x: at.x + LETTER_DESK.x, y: at.y + LETTER_DESK.y }, k, LETTER_W, LETTER_H)
}

/** A drawing on the stove's grid, 2 pixels of the room to a cell. */
export const onStove = (at: StoveSpot, body: string) => `<g transform="translate(${round(at.x)} ${round(at.y)}) scale(${round(PX * at.s)})">${body}</g>`

// How long a fire holds each of its images.
const FLAME_S = 0.24
const SLOW_FLAME_S = 0.5

/** Its images in turn, by CSS alone: a new level is the only reason to touch it. */
export function flames(level: FireLevel, { hearth }: Pack) {
  const n = hearth.frames(level)
  const beat = n > 2 ? FLAME_S : SLOW_FLAME_S
  const images = Array.from({ length: n }, (_, i) => `<g class="f" style="animation-delay:${round((i - n) * beat)}s">${hearth.flames(level, i)}</g>`)
  return { body: images.join(''), style: `.f{animation:fl ${round(n * beat)}s steps(1) infinite}@keyframes fl{0%{opacity:1}${round(100 / n)}%,100%{opacity:0}}@media (prefers-reduced-motion: reduce){.f{animation:none;opacity:0}.f:first-child{opacity:1}}` }
}

const PLATE_EDGES = ['#3B2318', '#8A5A3A', '#4A2C2A'] as const
const PLATE_FILL = '#F4E4C1'
const SHADOW_FILL = 'fill="#3B2318" fill-opacity=".62"'
const rectOf = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
const letterAt = (state: EnvelopeState, x: number, y: number) => `<g transform="translate(${x} ${y}) scale(${PX})">${spriteBody(envelope(state))}</g>`

// The plate's words: its title, and the small line under it.
const PLATE_TEXT = { x: 46, size: 18, sub: 16 }
const BUTTON_TEXT = { x: 44, y: 2, size: 18 }

/** The plate, on the design's own pixels. */
function plateBody(panel: HearthPanel) {
  const h = panel.sub ? PLATE.tall : PLATE.h
  const edges = `<rect x="4" y="4" width="${PLATE.w}" height="${h}" ${SHADOW_FILL}/>${rectOf(0, 0, PLATE.w, h, PLATE_EDGES[0])}${rectOf(2, 2, PLATE.w - 4, h - 4, PLATE_EDGES[1])}${rectOf(5, 5, PLATE.w - 10, h - 10, PLATE_EDGES[2])}${rectOf(7, 7, PLATE.w - 14, h - 14, PLATE_FILL)}`
  const title = line(panel.title, PLATE_TEXT.x, panel.sub ? 6 : 9, PLATE_TEXT.size, INK)
  return `${edges}${letterAt(panel.letter, 13, Math.round(h / 2) - 11)}${title}${panel.sub ? line(panel.sub, PLATE_TEXT.x, 27, PLATE_TEXT.sub, '#7A4A32') : ''}`
}

/** The button on the stove, at rest in gold, under the pointer in cream. */
export function buttonBody(label: string, lit: boolean) {
  const [edge, fill] = lit ? ['#E4633A', '#FFF6DE'] : [PLATE_EDGES[0], '#FFC857']
  return `<rect x="4" y="4" width="${PLATE.button}" height="${PLATE.buttonH}" ${SHADOW_FILL}/>${rectOf(0, 0, PLATE.button, PLATE.buttonH, edge)}${rectOf(2, 2, PLATE.button - 4, PLATE.buttonH - 4, fill)}${letterAt('discreet', 10, 5)}${line(label, BUTTON_TEXT.x, BUTTON_TEXT.y, BUTTON_TEXT.size, INK)}`
}

/** The plate's corner over the stove, and its scale. */
export const plateAt = (at: StoveSpot) => {
  const k = round(at.s * PLATE_K)
  return { x: round(at.x + PLATE.x * k), y: round(at.y + PLATE.y * k), k }
}

/** The room of the button, in pixels of the room. */
export const buttonBox = (at: StoveSpot) => {
  const c = plateAt(at)
  return { x: c.x, y: c.y, w: PLATE.button * c.k, h: PLATE.buttonH * c.k, k: c.k }
}

/**
 * What lies in front of the stove and on the desk, in the one image that may change at any time.
 * `desk`: where the manager's desk stands.
 */
export function hearthFront(look: HearthLook, at: StoveSpot, desk: { x: number; y: number }, { hearth }: Pack) {
  const heap = look.ash === 'none' ? '' : onStove(at, `<g transform="translate(0 ${hearth.ashTop})">${hearth.ash(look.ash, 0)}</g>`)
  const letter = look.letter ? letterAt(look.letter, desk.x + LETTER_DESK.x, desk.y + LETTER_DESK.y) : ''
  const c = plateAt(at)
  const panel = look.panel
  const plate = panel ? `<g transform="translate(${c.x} ${c.y}) scale(${c.k})">${panel.button ? buttonBody(panel.title, false) : plateBody(panel)}</g>` : ''
  return { body: heap + letter + plate, letters: panel ? `${panel.title}${panel.sub}` : '' }
}

export const MOTION = `.bo{animation:bo .6s steps(2) infinite}@keyframes bo{to{transform:translateY(-2px)}}
.br{animation:bo 3s steps(2) infinite}
.sh{animation:sh 1.6s steps(4) infinite}@keyframes sh{25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
.bl{opacity:0;animation:bl 4s steps(1) infinite}@keyframes bl{0%,92%{opacity:0}93%,100%{opacity:1}}
.ha{animation:ty .3s steps(1) infinite}.hb{animation:ty .3s steps(1) infinite reverse}@keyframes ty{0%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.td0,.td1,.td2{animation:td 1.2s steps(1) infinite;opacity:.25}.td1{animation-delay:.3s}.td2{animation-delay:.6s}@keyframes td{0%,30%{opacity:1}31%,100%{opacity:.25}}
.sc{animation:sc 2s ease-in-out infinite}@keyframes sc{0%,100%{opacity:.15}50%{opacity:.8}}
.st{opacity:0;animation:st 3s linear infinite}@keyframes st{0%{opacity:0;transform:translateY(0)}20%{opacity:.7}100%{opacity:0;transform:translateY(-22px)}}
.al{animation:al 1s steps(1) infinite}@keyframes al{50%{opacity:0}}
.tw{animation:tw 2s steps(2) infinite}@keyframes tw{50%{opacity:.15}}
.sl{animation:bo 4s steps(2) infinite}
.d1{animation-delay:-.37s}.d2{animation-delay:-.74s}.d3{animation-delay:-1.11s}
@media (prefers-reduced-motion: reduce){*{animation:none!important}.ev{display:none}}`

const cells = (b: Box): Box => ({ x: b.x / PX, y: b.y / PX, w: b.w / PX, h: b.h / PX })

/**
 * Where a plan's board and its lines fall in a pane, in pixels of the pane, after the crop of a short one.
 * A line keeps its true height, however thin: past the 21 px of a row, the zones share out the band they make.
 */
export function boardLines(p: Pick<RoomInput, 'desks' | 'steps' | 'width' | 'height' | 'theme'>) {
  const v = sized(p.desks.length, p.width, p.height, p.theme)
  const plan = planBoard(p.steps, 0)
  const spot = boardSpot(plan, v)
  const k = p.width / v.w
  const crop = Math.max(0, v.h * k - p.height) / 2
  const top = spot.y - 4 + BOARD_ROWS
  const pitch = STEP * plan.k
  const lines = plan.labels.map((label, i) => ({
    label,
    x: (spot.x + 16) * k,
    y: (top + i * pitch) * k - crop,
    w: (Math.ceil(textWidth(label, 16)) + 20) * plan.k * k,
    h: pitch * k,
  }))
  return { lines, left: spot.x * k, right: (spot.x + plan.w) * k, under: (TELE_Y + TELE_H) * k - crop, scale: plan.k * k }
}

/** A line of the board as the pointer lights it, on a drawing of its own at `left` and `top` cells of `cellW` by `cellH`. */
export function lineSvg(status: PlanStatus, label: string, b: { x: number; y: number; w: number; h: number }, scale: number, cellW: number, cellH: number, look: Pack['board']) {
  const [left, top] = [Math.floor(b.x / cellW), Math.floor(b.y / cellH)]
  const [dx, dy] = [b.x - left * cellW, b.y - top * cellH]
  const [cols, rows] = [Math.ceil((dx + b.w) / cellW), Math.ceil((dy + b.h) / cellH)]
  const [width, height] = [cols * cellW, rows * cellH]
  const id = `c${status[0]}`
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><defs>${def(id, caseEtape(status))}${letterDefs(label)}</defs><g transform="translate(${Math.round(dx * 100) / 100} ${Math.round(dy * 100) / 100}) scale(${Math.round(scale * 1000) / 1000})"><rect width="${Math.ceil(textWidth(label, 16)) + 20}" height="${STEP}" fill="${look.paper}"/>${use(id, 2, 3)}${line(label, 18, 0, 16, look.inks[status])}</g></svg>`
  return { source, left, top, cols, rows, width, height }
}

/** The rug, in cells for its size: it holds every desk and stays on the axis of the manager. */
function rugOf(v: View, n: number) {
  const first = managerOrigin(v).y
  const fit = (w: number, h: number, y: number) => ({ w: Math.round(w / PX), h: Math.round(h / PX), y })
  // The manager alone: the rug takes in a little of what the floor gains.
  const alone = (w: number, h: number) => {
    const size = fit(w, h, 0)
    return { ...size, y: Math.max(206, Math.round(first + 45 - size.h)) }
  }
  const rug = !n
    ? alone(346, 116 + v.extra * 0.55)
    : v.rows === 2
      ? n < 3
        ? fit(394, 236, first - 9)
        : fit(418, 268, first - 36)
      : fit(Math.max(530, v.cols * OPEN_COL + 134), v.rows * DESK_H + 22, first - 19)
  return { ...rug, x: Math.round((v.w - rug.w * PX) / 2) }
}

// Where the floor starts under a wall, and what a desk takes above its origin, for the crab.
const FLOOR_TOP = 160
const DESK_RISE = -8

/** The floor of a room as the crab walks it, in pixels of the room. `k`, `height`: the pane, which may crop a short room. */
function groundOf(k: number, height: number, v: View, n: number, room: DrawnRoom, { seat, hearth }: Pack, stove: StoveSpot | null): Ground {
  const px = (b: Box): Box => ({ x: b.x * PX, y: b.y * PX, w: b.w * PX, h: b.h * PX })
  const tent = seat.behind ? { x: seat.behind.dx * PX, y: seat.behind.dy * PX, w: seat.behind.draw().w * PX } : null
  const left = Math.min(0, tent?.x ?? 0)
  const rise = Math.min(DESK_RISE, tent?.y ?? 0)
  const right = Math.max(SPRITE_W, tent ? tent.x + tent.w : 0)
  const desks = [managerOrigin(v), ...Array.from({ length: n }, (_, i) => deskOrigin(i, v, n))].map(at => ({ x: at.x + left, y: at.y + rise, w: right - left, h: SPRITE_H - rise }))
  // A plan's board can push what stands under it forward: it stays out of his way wherever it ends up.
  const column = v.w - v.edge - ROOM_BOARD_W
  const pieces = room.floor.map(px)
  const moves = (b: Box) => b.x + b.w > column && b.y < BOARD_LOW
  const movable = pieces.filter(moves)
  return {
    w: v.w,
    top: FLOOR_TOP,
    bottom: Math.floor(Math.min(v.h, (Math.max(0, v.h * k - height) / 2 + height) / k)),
    basket: px(room.basket),
    desks,
    stove: stove ? { x: stove.x, y: stove.y, w: hearth.w * stove.s, h: hearth.feet * stove.s } : null,
    items: pieces.filter(b => !moves(b)),
    blocked: [...movable, ...movable.map(b => ({ ...b, y: BOARD_LOW }))],
  }
}

/** One room, ready for its drawing. */
export function roomScene(p: RoomInput, o: SceneOptions = {}): Scene {
  const detail = o.detail ?? 0
  const n = p.desks.length
  // A state saved by an older version may still seat an agent in the manager's colours.
  const agents = p.desks.map(d => ({ ...d, hue: agentHue(d.hue) }))
  const boss = managerSeat(p.manager)
  const pack = packOf(p.theme)
  const seed = seedOf(p.sessionId)
  const v = sized(n, p.width, p.height, p.theme)
  const plan = planBoard(p.steps, detail)
  const { x: boardX, y: boardY } = boardSpot(plan, v)
  const { x: teleX, y: teleY } = teleOf(plan, v)

  const { w: rugW, h: rugH, x: rugX, y: rugY } = rugOf(v, n)
  const hearth = p.hearth ? stoveSpot(p) : null

  const tent = pack.seat.behind
  const seatBoxes = v.seats?.map(at => cells(tent ? { x: at.x + tent.dx * PX, y: at.y + tent.dy * PX, w: Math.max(SPRITE_W - tent.dx * PX, tent.draw().w * PX), h: SPRITE_H - tent.dy * PX } : { x: at.x, y: at.y, w: SPRITE_W, h: SPRITE_H }))
  const drawn = drawRoom(p.sessionId, {
    w: v.w / PX,
    h: v.h / PX,
    tele: cells({ x: teleX, y: teleY, w: pack.tele.reach?.w ?? 72, h: pack.tele.reach?.h ?? 60 }),
    board: cells({ x: boardX, y: boardY - 4, w: plan.w + 4, h: plan.h + 8 }),
    rug: cells({ x: rugX, y: rugY, w: rugW * PX, h: rugH * PX }),
    ...(p.settings ? { corner: Math.ceil((SETTINGS_CORNER * v.w) / p.width / PX) } : {}),
    wallEnd: pack.wall.end?.(v.w) ?? (v.w - ROOM_MARGIN - STEADY_BOARD_W - 10 - 72) / PX,
    ...(hearth ? { stove: cells({ x: hearth.x, y: hearth.y, w: pack.hearth.w * hearth.s, h: pack.hearth.feet * hearth.s }) } : {}),
    ...(seatBoxes ? { taken: seatBoxes } : {}),
  }, pack)
  const room = { ...drawn, floor: detail ? [] : drawn.floor, wall: detail >= 4 ? [] : drawn.wall }

  const defs = new Map<string, string>()
  const need = (id: string, make: () => string) => {
    if (!defs.has(id)) defs.set(id, make())
  }
  const rug = `rug-${rugW}-${rugH}`
  const frame = `tableau-${plan.w}-${plan.h}`
  const backdrop = pack.backdrop(seed, v.w, v.h, detail)
  if (backdrop.defs) defs.set('back', backdrop.defs)
  const rugArt = pack.rug(seed, rugW, rugH, detail)
  const label = pack.tele.label
  need('tele', () => `<g id="tele"><g transform="translate(${pack.tele.dx} ${pack.tele.dy})">${scaled(pack.tele.draw())}</g>${line(t('room.tokens'), Math.round(36 - textWidth(t('room.tokens'), label.size) / 2), label.y, label.size, label.ink)}</g>`)
  need('plaque', () => def('plaque', pack.plaque.draw()))
  if (rugArt) need(rug, () => `<g id="${rug}" transform="scale(${PX})">${rugArt}</g>`)
  need(frame, () => `<g id="${frame}">${pack.board.art(plan.w, plan.h)}</g>`)
  for (const st of new Set(p.steps.map(s => s.status))) need(`c${st[0]}`, () => def(`c${st[0]}`, caseEtape(st)))
  const everyone = [boss, ...agents]
  const { seat: furniture } = pack
  if (detail < 6 && furniture.chair) need('chair', () => def('chair', furniture.chair!()))
  if (detail < 6 && furniture.behind) need('behind', () => def('behind', furniture.behind!.draw()))
  if (everyone.some(d => d.state === 'working') && detail < 2) need('bulle', () => def('bulle', bulle()))
  if (boss.rest) need('zz', () => `<path id="zz" fill="#F4E4C1" d="${ZZ}"/>`)
  for (const d of everyone) need(deskId(d), () => def(deskId(d), furniture.desk(d.rest ? 'rest' : d.state)))
  for (const hue of new Set(everyone.map(d => d.hue % TENUES.length))) need(`person-${hue}`, () => def(`person-${hue}`, (furniture.person ?? person)(TENUES[hue]!)))
  const stringId = pack.wall.string?.id
  const hung = (it: (typeof room.wall)[number]) => (it.id === stringId ? `w-${it.id}-${it.w}` : `w-${it.id}`)
  const inHour = (id: string, c: Canvas) => {
    const veil = pack.veil?.(seed, id)
    return veil ? veiled(c, veil) : c
  }
  for (const it of room.wall) need(hung(it), () => def(hung(it), inHour(it.id, it.id === stringId ? pack.wall.string!.draw(it.w) : pack.wall.items[it.id]!.draw())))
  for (const it of room.floor) need(`f-${it.id}`, () => def(`f-${it.id}`, inHour(it.id, pack.floor.items[it.id]!())))
  need('basket', () => def('basket', pack.basket(false)))

  const titles = agents.map(d => (detail >= 5 ? '' : fit(d.title, TITLE, 98)))
  const back = o.layer === 'back'
  const items: { bottom: number; svg: string; desk?: boolean }[] = room.floor.map(it => ({ bottom: it.y + it.h, svg: use(`f-${it.id}`, it.x * PX, it.y * PX) }))
  items.push({ bottom: room.basket.y + room.basket.h, svg: use('basket', room.basket.x * PX, room.basket.y * PX) })
  const fired = hearth && !back ? flames(p.hearth!.fire, pack) : null
  if (hearth) items.push({ bottom: (hearth.y + pack.hearth.feet * hearth.s) / PX, svg: onStove(hearth, `${pack.hearth.body()}${fired?.body ?? ''}${pack.hearth.front?.() ?? ''}`) })
  const seat = (d: RoomDesk, i: number, at: { x: number; y: number }, title: string, fresh: boolean) => {
    const tx = Math.round(60 - textWidth(title, TITLE) / 2)
    // Past the point where nothing moves at a desk, a person and a desk make one definition: a full floor writes hundreds.
    const pair = `p${d.hue}${d.rest ? 'z' : d.state[0]}`
    if (detail >= 6) need(pair, () => `<g id="${pair}">${use(`person-${d.hue}`, 44, -4)}${use(deskId(d))}</g>`)
    const shelter = furniture.behind && detail < 6 ? use('behind', furniture.behind.dx * PX, furniture.behind.dy * PX) : ''
    const seated = detail >= 6 ? use(pair) : shelter + (furniture.chair ? use('chair') : '') + actor(d, i, detail) + use(deskId(d))
    const body = seated + (d.rest ? '' : deskRail(d, detail, need)) + (title ? line(title, tx, 59, TITLE, INK) : '') + work(d, i, detail >= 2)
    const fade = fresh ? '<animate attributeName="opacity" from="0" to="1" begin=".75s" dur=".3s" fill="freeze"/>' : ''
    items.push({ bottom: (at.y + SPRITE_H) / PX, desk: true, svg: `<g transform="translate(${at.x} ${at.y})"${fresh ? ' opacity="0"' : ''}>${fade}${body}</g>` })
  }
  // The manager comes last in the phases, and his plate stays to the last step of the size limit.
  if (!back) seat(boss, n, managerOrigin(v), boss.title, false)
  if (!back) agents.forEach((d, i) => seat(d, i, deskOrigin(i, v, n), titles[i]!, i >= p.previous && p.previous !== n))
  items.sort((a, b) => a.bottom - b.bottom)

  const win = room.wall.find(it => it.id === 'fenetre')
  const moving = pack.moving?.(seed, v.w, v.h) ?? []
  const life: SceneLife = { lights: sparks(room, pack), moving, ground: groundOf(p.width / v.w, p.height, v, n, drawn, pack, hearth) }
  const front = hearth && !back ? hearthFront(p.hearth!, hearth, managerOrigin(v), pack) : null
  // His life, under the desks as in the layers.
  const living = back ? null : o.crab === 'pose' ? crabPose(life.ground) : crabLife(seed, life.ground, true)
  if (living) defs.set('crab-life', living.defs)
  const stood = items.filter(it => !living || !it.desk).map(it => it.svg).join('')
  const seated = living ? items.filter(it => it.desk).map(it => it.svg).join('') : ''
  const paid = `<g transform="translate(${teleX} ${teleY})">${use('plaque', pack.plaque.dx, pack.plaque.dy)}</g>`
  const flying = back ? '' : moving.map(m => `<style>${m.style}</style>${m.body}`).join('')
  const body = `${backdrop.body}
${rugArt ? use(rug, rugX, rugY) : ''}${detail >= 2 ? '' : lights(v, win ? win.x * PX : null, pack.light)}${room.wall.map(it => use(hung(it), it.x * PX, it.y * PX)).join('')}${back ? '' : lightPaths(life.lights)}
${screen(teleX, teleY)}${paid}${board(plan, p.steps, boardX, boardY, pack.board)}
${stood}${living?.body ?? ''}${seated}${flying}${front?.body ?? ''}`
  const words = `${t('room.tokens')}${boss.title}${plan.title}${p.steps.length ? '' : t('room.noPlan')}${front?.letters ?? ''}`
  return { defs, letters: `${words}${titles.join('')}${plan.labels.join('')}`, body, w: v.w, h: v.h, style: `${fired?.style ?? ''}${living?.style ?? ''}`, life }
}

const box = (w: number, h: number) => `0 0 ${w} ${h}`

/** The zoom out to a room of `w` by `h`, while desks arrive. It stays on the room's axis: the manager does not slide aside. */
function zoomOf(p: RoomInput, w: number, h: number) {
  const was = sized(p.previous, p.width, p.height, p.theme)
  return p.previous !== p.desks.length ? `<animate attributeName="viewBox" from="${Math.round((w - was.w) / 2)} 0 ${was.w} ${was.h}" to="${box(w, h)}" dur=".8s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/>` : ''
}

function draw(p: RoomInput, detail: number, layer?: 'back', crabOption?: 'pose'): string {
  const s = roomScene(p, { detail, ...(layer ? { layer } : {}), ...(crabOption ? { crab: crabOption } : {}) })
  return `${svgOpen(p.width, p.height, box(s.w, s.h))}
<style>${MOTION}${s.style}</style>
${zoomOf(p, s.w, s.h)}<defs>${[...s.defs.values()].join('')}${letterDefs(s.letters)}</defs>
${s.body}
</svg>`
}

/** The count of a room, for a plain image over its drawing: nothing moves on it, and it changes alone. */
export function roomCountSvg(p: RoomInput): string {
  const s = roomCount(p)
  return `${svgOpen(p.width, p.height, box(s.w, s.h))}${zoomOf(p, s.w, s.h)}<defs>${letterDefs(s.value)}</defs>${s.body}</svg>`
}

let lastKey = ''
let lastSvg = ''

/** Same input, same string: an unchanged source never reloads the drawing. The count is not part of it. */
function drawn(key: string, make: (detail: number) => string) {
  if (key !== lastKey) {
    lastKey = key
    // A full room gives up its furniture before it gives up a desk.
    lastSvg = [1, 2, 3, 4, 5, 6, 7].reduce((svg, detail) => (svg.length > MAX_SVG ? make(detail) : svg), make(0))
  }
  return lastSvg
}

/** A whole room gives up the crab's walk before it gives up anything else. */
function whole(p: RoomInput, detail: number) {
  const svg = draw(p, detail)
  return svg.length > MAX_SVG ? draw(p, detail, undefined, 'pose') : svg
}

export const roomSvg = (p: RoomInput): string => drawn(JSON.stringify([getLanguage(), { ...p, tokens: 0, cost: null }]), detail => whole(p, detail))

/** The bottom image of a room in layers: neither a desk nor the hearth's state can change it. */
export function roomBackSvg(p: RoomInput): string {
  const still = { ...p, tokens: 0, cost: null, desks: p.desks.map(() => ({ title: '', state: 'done' as const, hue: 0 })), manager: AT_REST, hearth: COLD_HEARTH }
  return drawn(JSON.stringify(['back', getLanguage(), still]), detail => draw(still, detail, 'back'))
}
