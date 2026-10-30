import type { ManagerDesk, PlanLine, PlanStatus } from '../types'
import { drawRoom, seedOf } from './draw'
import type { Box } from './draw'
import { getLanguage, t } from './i18n'
import { canvas, mix, noise, paths } from './pixel/canvas'
import type { Canvas } from './pixel/canvas'
import { FLOOR_DECOR, THEMES, WALL_DECOR, bulle, caseEtape, casier, compteur, enveloppe, frange, guirlande, tableau, tapis, tele, tube } from './pixel/decor'
import type { Theme } from './pixel/decor'
import { fit, textWidth } from './pixel/font'
import { FONT_SIZE, GLYPHS, SPACE, UNIT } from './pixel/font-data'
import { TENUES, WOOD as W, agentHue, chair, crab, desk, person, skinOf } from './pixel/sprites'
import type { DeskState } from './pixel/sprites'

/**
 * `done`, `total` and `live` are absent on a desk saved by an older version: it reads as no plan yet.
 * `rest`: the manager between two turns, screen off.
 */
export type RoomDesk = { title: string; state: DeskState; hue: number; done?: number; total?: number; live?: boolean; rest?: boolean }
export type { ManagerDesk }
export const AT_REST: ManagerDesk = { working: false }
/** The room of the conversation that leads others: the news that reached its tray, and whether one is on its way. */
export type Chief = { shown: number; flying: boolean }
/** `desks`: the agents, the manager apart: he is no arrival and his desk never leaves. `settings`: the button stands in the corner. */
export type RoomInput = { sessionId: string; desks: RoomDesk[]; manager: ManagerDesk; previous: number; steps: PlanLine[]; tokens: number; width: number; height: number; chief?: Chief; settings?: boolean }
/** A room ready to be placed: its body, the definitions it needs, by id, and the letters it writes. */
export type Scene = { defs: Map<string, string>; letters: string; body: string; w: number; h: number }
/**
 * `base` is the width a floor cell shows, `plate` the name plate over its corner, in pixels of the room.
 * `detail` gives way under the size limit, step by step: the furniture, the small movements and the light, the end of
 * long labels, what hangs on the wall, more of the labels and the names of the desks, then all that moves at a desk,
 * and last the labels themselves. The screen and the box of every step of the plan always stay.
 */
export type SceneOptions = { base?: number; plate?: { w: number; h: number }; detail?: number }

const PX = 2
const BOARD_EDGE = 8
// How far from the left of the pane, in true pixels, the wall stays clear for the settings button.
const SETTINGS_CORNER = 52
const ROOM_MARGIN = 10
const CELL_MARGIN = 6
// How long an envelope takes up the tube: the news wait as long to land.
export const FLIGHT_MS = 2400
// The engine refuses a drawing past 131 072 characters.
export const MAX_SVG = 130_000
const WALL = 75
const DESK_W = 130
const DESK_H = 106
// What the sprite of a desk takes, inside the step between two desks.
const SPRITE_W = 120
const SPRITE_H = 90
const TITLE = 16
const INK = '#1B1730'
// From three rows on the room shows at about scale 1, in a pane about as high as it is wide.
const OPEN_W = 780
const OPEN_COL = 132
const OPEN_RATIO = 1.03
const ROOM_FLOOR = 293
// In a floor cell, a room with agents shows its desks smaller, on one rug.
const CELL_DESK = 0.72
const CELL_ROW = 68
const CELL_COL = 114
const PAIR_COL = 100

/** `col` and `row`: the steps between desks. `s`: the scale of a desk in the room. `edge`: what the board leaves on its right. */
type View = { w: number; h: number; cols: number; rows: number; extra: number; top: number; shift: number; col: number; row: number; s: number; edge: number }

// Up to three agents stand on one row.
const colsOf = (n: number) => (n > 3 ? Math.ceil(Math.sqrt(n)) : Math.max(1, n))
/** The manager's row, then the agents'. */
const rowsOf = (n: number, cols: number) => (n ? 1 + Math.ceil(n / cols) : 1)

/** The room a number of agents needs, in CSS pixels at scale 1. Alone, the manager takes the place of a single desk. */
export function viewOf(n: number): View {
  const cols = colsOf(n)
  const rows = rowsOf(n, cols)
  if (!n) return { w: 540, h: 360, cols, rows, extra: 0, top: 215, shift: 0, col: DESK_W, row: DESK_H, s: 1, edge: ROOM_MARGIN }
  const h = rows * DESK_H + ROOM_FLOOR
  const open = rows > 2
  return { w: open ? Math.max(OPEN_W, Math.round(h * OPEN_RATIO)) : 615, h, cols, rows, extra: 0, top: open ? 255 : 234, shift: 0, col: open ? OPEN_COL : DESK_W, row: DESK_H, s: 1, edge: ROOM_MARGIN }
}

// What the news take beside the first row of desks: the tray stands 126 after its desk, 12 down, the tube 62 further.
const TRAY_DX = 126
const TRAY_DY = 12
const TUBE_DX = 62
const TUBE_DY = 20
const TUBE_W = 50
const CHIEF_W = TRAY_DX - DESK_W + TUBE_DX + TUBE_W
const CHIEF_RUG = 320
/** The width two stacked rooms show, each a whole room. Their desks stand as in the design, on a deeper rug. */
export const PAIR_W = 780
const PAIR_TOP = 210
const PAIR_RUG_Y = 198
const PAIR_RUG = 16
const PAIR_DESK_Y = 204

/** A floor cell shows less wall around its desks. */
function cellOf(n: number, base: number, chief: boolean): View {
  const cols = colsOf(n)
  const rows = rowsOf(n, cols)
  const [col, row, s] = n ? [base === PAIR_W ? PAIR_COL : CELL_COL, CELL_ROW, CELL_DESK] : [DESK_W, DESK_H, 1]
  const h = Math.max(360, n ? rows * CELL_ROW + 216 : 0)
  return { w: Math.max(base, cols * col + 34 + (chief ? CHIEF_W : 0)), h, cols, rows, extra: 0, top: rows > 2 ? 200 : !n && base === PAIR_W ? PAIR_TOP : 226, shift: 0, col, row, s, edge: CELL_MARGIN }
}

/** The same room stretched to a pane's shape: the floor grows and the desks stay centred on it. A floor cell also widens. */
function sized(n: number, width: number, height: number, base?: number, chief = false): View {
  const v = base === undefined ? viewOf(n) : cellOf(n, base, chief)
  const h = Math.max(v.h, Math.round((height * v.w) / width))
  const w = base === undefined ? v.w : Math.max(v.w, Math.round((width * h) / height))
  const extra = h - v.h
  // Past the widest row's last desk come the tray and the tube: the desks step aside when those would leave the room.
  const seats = Math.min(v.cols, Math.max(1, n))
  const shift = chief ? Math.min(0, w - 6 - (Math.round((w + seats * v.col) / 2) + CHIEF_W + 5)) : 0
  // In a cell the desks stay nearer the wall than the middle of the floor; two stacked rooms hold them under the wall.
  const top = base === undefined ? v.top : n && base === PAIR_W ? PAIR_DESK_Y - Math.round(extra / 2) : v.top - Math.round(extra / 4)
  // With at most one agent the wall shows at its largest, and the board keeps 8 true pixels on its right.
  const edge = base === undefined && n <= 1 ? Math.round((BOARD_EDGE * v.w) / width) : v.edge
  return { ...v, w, h, extra, top, shift, edge }
}

/** Where the first of `seats` desks stands on a row, so the row stays centred on the room's axis. */
const seatX = (seats: number, v: View) => Math.round((v.w - seats * v.col) / 2) + Math.round((v.col - SPRITE_W * v.s) / 2) + v.shift

/** The manager heads the room, on its axis, whatever stands below him. */
const managerOrigin = (v: View) => ({ x: seatX(1, v), y: v.top + Math.round(v.extra / 2) })

/** The last row, when it is not full, stays centred. */
function deskOrigin(i: number, v: View, n: number) {
  const row = Math.floor(i / v.cols)
  const seats = row === Math.floor((n - 1) / v.cols) ? n - row * v.cols : v.cols
  return { x: seatX(seats, v) + (i % v.cols) * v.col, y: managerOrigin(v).y + (row + 1) * v.row }
}

const boxOf = (o: { x: number; y: number }, k: number) => ({ x: Math.round(o.x * k), y: Math.round(o.y * k), w: Math.round(SPRITE_W * k), h: Math.round(SPRITE_H * k) })

/** Where each desk falls in a room of that size, for the hover zones. */
export function deskBoxes(n: number, width: number, height: number) {
  const v = sized(n, width, height)
  return Array.from({ length: n }, (_, i) => boxOf(deskOrigin(i, v, n), width / v.w))
}

/** Where the manager's desk falls, for his hover zone. */
export function managerBox(n: number, width: number, height: number) {
  const v = sized(n, width, height)
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

/** The token count as the screen shows it: 950, 12,4k, 128k, 1,2M. */
export function formatTokens(n: number) {
  const whole = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
  const short = (v: number, unit: string) => `${v < 99.95 ? String(Math.round(v * 10) / 10).replace('.', t('room.decimal')) : Math.round(v)}${unit}`
  if (whole < 1000) return String(whole)
  if (whole < 999_500) return short(whole / 1000, 'k')
  return short(whole / 1_000_000, 'M')
}

function wallTile(T: Theme) {
  const c = canvas(20, 24)
  c.rect(0, 0, 20, 24, T.base)
  for (let x = 0; x < 20; x += 10) c.rect(x, 0, 1, 24, T.st)
  for (const [x, y] of [[5, 6], [15, 6], [0, 18], [10, 18]] as const) {
    for (const [a, b] of [[0, 0], [1, 1], [-1, 1], [0, 2]] as const) c.set((x + a + 20) % 20, y + b, T.dot)
  }
  return c
}

function panelTile(T: Theme) {
  const c = canvas(22, 24)
  c.rect(0, 0, 22, 24, T.pan)
  c.rect(0, 0, 22, 2, T.panL)
  c.rect(0, 2, 22, 1, T.pan2)
  c.rect(4, 5, 18, 13, T.panD)
  c.rect(4, 5, 18, 1, T.pan2)
  c.rect(4, 5, 1, 13, T.pan2)
  c.rect(4, 17, 18, 1, T.pan3)
  c.rect(21, 5, 1, 13, T.pan3)
  c.rect(0, 20, 22, 4, W[2])
  c.rect(0, 20, 22, 1, W[4])
  c.rect(0, 23, 22, 1, W[0])
  return c
}

function floorTile() {
  const tones = ['#8A5A3A', '#80523A', '#925F3E', '#7A4E36', '#86563A']
  const c = canvas(114, 42)
  for (let row = 0; row < 6; row += 1) {
    const y = row * 7
    const off = (row % 3) * 17
    for (let i = -1; i < 4; i += 1) {
      const x = i * 38 - off
      c.rect(x, y, 38, 6, tones[Math.floor(noise(i + row * 9, 3) * 5)]!)
      c.rect(x + 37, y, 1, 6, '#5C3A28')
      for (let g = 0; g < 3; g += 1) c.rect(x + 3 + Math.floor(noise(i + g, row) * 28), y + 1 + Math.floor(noise(g, i + row) * 4), 5 + Math.floor(noise(i, g + row) * 8), 1, '#6E462F')
    }
    c.rect(0, y, 114, 1, '#A06E48')
    c.rect(0, y + 6, 114, 1, '#5C3A28')
  }
  return c
}

const scaled = (c: Canvas) => `<g transform="scale(${PX})">${paths(c)}</g>`
const pattern = (id: string, c: Canvas) => `<pattern id="${id}" width="${c.w * PX}" height="${c.h * PX}" patternUnits="userSpaceOnUse">${scaled(c)}</pattern>`
const def = (id: string, c: Canvas) => `<g id="${id}" transform="scale(${PX})">${paths(c)}</g>`
const use = (id: string, x = 0, y = 0) => `<use href="#${id}"${x ? ` x="${x}"` : ''}${y ? ` y="${y}"` : ''}/>`

// Letters and digits take one character as an id: a floor writes thousands of them.
const letterId = (ch: string) => (/[a-zA-Z]/.test(ch) ? ch : `g${ch.codePointAt(0)}`)

/** One definition per letter, each carrying its own offset: a line only says how far along it is. */
export function letterDefs(s: string): string {
  return [...new Set(s)].filter(ch => GLYPHS[ch]).map(ch => {
    const [, dx, dy, d] = GLYPHS[ch]!
    return `<path id="${letterId(ch)}" transform="translate(${dx} ${dy})" d="${d}"/>`
  }).join('')
}

function letterUses(s: string) {
  let at = 0
  let out = ''
  for (const ch of s) {
    const glyph = GLYPHS[ch]
    if (glyph) out += use(letterId(ch), at)
    at += glyph?.[0] ?? SPACE
  }
  return out
}

const fontScale = (size: number) => Math.round((size / FONT_SIZE) * UNIT * 10000) / 10000

/** A line of text through `letterDefs`, from the top left corner at (x, y). */
export function line(s: string, x: number, y: number, size: number, fill: string) {
  return `<g fill="${fill}" transform="translate(${x} ${y}) scale(${fontScale(size)})">${letterUses(s)}</g>`
}

// What a floor cell changes: a tighter margin, a board that leaves the name its place, and a larger screen.
const CELL_BOARD_W = 120
const CHIEF_BOARD_W = 164
const ROOM_BOARD_W = 164
const CELL_TELE = 1.25
const STEP = 17
const BOARD_TOP = 14
const BOARD_HEAD = 19
const BOARD_ROWS = BOARD_TOP + BOARD_HEAD + 4
const BOARD_LOW = 158
const BOARD_TALL = 150
const INKS: Record<PlanStatus, string> = { completed: '#7A6A5E', in_progress: INK, pending: '#3A2E33' }
const TELE_Y = 36
const TELE_H = 60

/** The size of the plan board: it hugs its labels, and its lines shrink once they no longer fit on the wall. */
function planBoard(steps: RoomInput['steps'], maxW: number, detail: number, title = t('room.planTitle')) {
  const chrome = BOARD_TOP + BOARD_HEAD + 13
  // An empty board still says so, on one line.
  const rows = Math.max(1, steps.length)
  const full = chrome + rows * STEP
  const k = full > BOARD_TALL ? (BOARD_TALL - chrome) / (rows * STEP) : 1
  const widest = Math.max(0, ...steps.map(st => textWidth(st.text, 16)))
  const w = Math.min(maxW, Math.max(96, Math.ceil((Math.max(widest * k + 20 * k, textWidth(title, 18)) + 32) / 8) * 8))
  const room = (w - 32) / k - 20
  const most = detail === 6 ? 24 : detail === 5 ? 60 : detail >= 3 ? room * 0.6 : room
  const labels = steps.map(st => (detail >= 7 ? '' : fit(st.text, 16, most)))
  return { w, h: Math.round(Math.min(full, BOARD_TALL)), k, labels, title }
}

/** Where the board hangs: against the right of the wall, as high as the wall lets it. */
function boardSpot(plan: ReturnType<typeof planBoard>, v: View, cell: boolean) {
  return { x: v.w - v.edge - plan.w, y: Math.max(8, Math.min(cell ? 10 : 18, BOARD_LOW - plan.h)) }
}

function board(plan: ReturnType<typeof planBoard>, steps: RoomInput['steps'], x: number, y: number) {
  const k = Math.round(plan.k * 1000) / 1000
  const boxes = plan.labels.map((label, i) => {
    const top = i * STEP
    const glow = steps[i]!.status === 'in_progress' ? `<rect y="${top}" width="${Math.ceil(textWidth(label, 16)) + 20}" height="${STEP}" fill="#FFDF8F"/>` : ''
    return glow + use(`c${steps[i]!.status[0]}`, 2, top + 3)
  })
  const pitch = STEP / UNIT
  const inks = (['completed', 'in_progress', 'pending'] as const).map(status => {
    const rows = plan.labels.map((label, i) => (label && steps[i]!.status === status ? `<g transform="translate(0 ${Math.round(i * pitch * 10) / 10})">${letterUses(label)}</g>` : ''))
    return rows.some(Boolean) ? `<g fill="${INKS[status]}">${rows.join('')}</g>` : ''
  })
  const shrink = k < 1 ? ` scale(${k})` : ''
  const empty = steps.length ? '' : line(t('room.noPlan'), 16, BOARD_ROWS, 16, INKS.completed)
  return `<g transform="translate(${x} ${y - 4})">${use(`tableau-${plan.w}-${plan.h}`)}${line(plan.title, 16, BOARD_TOP + 2, 18, '#4A2C2A')}${empty}<g transform="translate(16 ${BOARD_ROWS})${shrink}">${boxes.join('')}<g transform="translate(18) scale(${fontScale(16)})">${inks.join('')}</g></g></g>`
}

const teleAt = (x: number, y: number, k: number) => `translate(${x} ${y})${k !== 1 ? ` scale(${k})` : ''}`
/** Where the set hangs: left of the board, whatever the detail. */
const teleOf = (plan: ReturnType<typeof planBoard>, v: View, cell: boolean) => {
  const k = cell ? CELL_TELE : 1
  return { x: boardSpot(plan, v, cell).x - 10 - 72 * k, y: cell ? 13 : TELE_Y, k }
}

/** The screen on the wall. Its count changes often and reloads a frame: it lives on a drawing of its own. */
const screen = (x: number, y: number, k: number) => `<g transform="${teleAt(x, y, k)}">${use('tele')}</g>`

// The shade a floor lays over a room at rest.
export const SHADE = { ink: '#17142B', alpha: 0.56 }
const DIGITS = '#EDFFF5'

/**
 * The count of a room, large and centred, at the very place of the set under it. Digits alone: on a scale that is not
 * whole the edges of a drawing are soft, and a copy of the screen on top would show them twice.
 * `dim`: the shade lies over the set in the frame, so the digits take its colour.
 */
export function roomCount(p: RoomInput, o: { base?: number; dim?: boolean } = {}) {
  const cell = o.base !== undefined
  const v = sized(p.desks.length, p.width, p.height, o.base, !!p.chief)
  const { x, y, k } = teleOf(boardOf(p, cell, 0), v, cell)
  const value = formatTokens(p.tokens)
  const dx = Math.round(36 - textWidth(value, 24) / 2)
  return { value, w: v.w, h: v.h, body: `<g transform="${teleAt(x, y, k)}">${line(value, dx, 10, 24, o.dim ? mix(DIGITS, SHADE.ink, SHADE.alpha) : DIGITS)}</g>` }
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
function lights(v: View, windowX: number | null) {
  const moon = (x: number) => `<polygon points="${x},${(WALL + 5) * PX} ${x + 44},${(WALL + 5) * PX} ${x + 94},${(WALL + 56) * PX} ${x + 50},${(WALL + 56) * PX}" fill="#9DB4FF" fill-opacity=".1"/>`
  const cy = v.h / 2 + WALL + 8
  const pool = (rx: number, ry: number, a: number) => `<ellipse cx="${v.w / 2}" cy="${cy}" rx="${Math.round(rx)}" ry="${Math.round(ry)}" fill="#FFC857" fill-opacity="${a}"/>`
  return `${windowX === null ? '' : moon(windowX + 20) + moon(windowX + 72)}${pool(v.w * 0.39, (v.h - 150) * 0.48, 0.05)}${pool(v.w * 0.27, (v.h - 150) * 0.34, 0.06)}`
}

// CSS moves plain elements only: a part inside a <use> would not run in every engine.
// The four phases keep desks out of step without an inline delay on every moving part.
const phase = (i: number) => (i % 4 ? ` d${i % 4}` : '')
const spot = (cls: string, d: string, fill?: string) => `<path class="${cls}"${fill ? ` fill="${fill}"` : ''} d="${d}"/>`

/** The person at a desk: typing, shaking their head, or at rest. */
function actor(d: RoomDesk, i: number, detail: number) {
  const hue = d.hue % TENUES.length
  if (detail >= 6) return use(`person-${hue}`, 44, -4)
  const skin = skinOf(TENUES[hue]!)
  const move = d.state === 'working' ? 'bo' : d.state === 'failed' ? 'sh' : 'br'
  return `<g class="${move}${phase(i)}">${use(`person-${hue}`, 44, -4)}${detail >= 2 ? '' : spot(`bl${phase(i)}`, 'M50 10h4v4h-4zM64 10h4v4h-4z', skin)}</g>`
}

/** What shows the work: hands on the keys, a thought bubble, a pulsing screen and steam. */
function work(d: RoomDesk, i: number, lean: boolean) {
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
const ZZ = 'M82 4h8v2h-8zM86 6h2v2h-2zM84 8h2v2h-2zM82 10h8v2h-8zM92 0h6v2h-6zM94 2h2v2h-2zM92 4h6v2h-6z'

/** The manager as a desk: at work he shows his plan, at rest his desk stays closed. */
const managerSeat = (m: ManagerDesk): RoomDesk =>
  m.working ? { title: t('role.manager'), state: 'working', hue: 0, done: m.done ?? 0, total: m.total ?? 0, live: m.live ?? false } : { title: t('role.manager'), state: 'done', hue: 0, rest: true }
const deskId = (d: RoomDesk) => `desk-${d.rest ? 'rest' : d.state}`

/**
 * The rail of a desk, at most four shapes. A level is one definition per value, so a full floor
 * stays light; dots that take turns stay plain, as CSS moves nothing inside a <use>.
 * On the last step of the size limit a plan falls on one of eleven bands: the definitions stop growing.
 */
function deskRail(d: RoomDesk, detail: number, need: (id: string, make: () => string) => void) {
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

/** Small lights and stars that twinkle on the decor the room drew. */
function sparkle(room: ReturnType<typeof drawRoom>) {
  const odd: string[] = []
  const even: string[] = []
  for (const it of room.wall) {
    if (it.id === 'guirlande') {
      for (let i = 6; i < it.w; i += 13) {
        const y = Math.round(2 + Math.abs(Math.sin((i * Math.PI) / 26)) * 7)
        ;(i % 2 ? odd : even).push(`M${(it.x + i - 1) * PX} ${(it.y + y + 1) * PX}h6v6h-6z`)
      }
    }
    if (it.id === 'fenetre') {
      for (const [x, y] of [[12, 8], [20, 11], [33, 7], [44, 15]] as const) (x % 2 ? odd : even).push(`M${(it.x + x) * PX} ${(it.y + y) * PX}h2v2h-2z`)
    }
  }
  return (odd.length ? spot('tw', odd.join(''), '#FFF6DE') : '') + (even.length ? spot('tw d2', even.join(''), '#FFF6DE') : '')
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
.c{animation:cr 40s linear infinite alternate}@keyframes cr{from{transform:translateX(-120px)}to{transform:translateX(120px)}}
.lg{animation:bo .5s steps(2) infinite}
.d1{animation-delay:-.37s}.d2{animation-delay:-.74s}.d3{animation-delay:-1.11s}
@media (prefers-reduced-motion: reduce){*{animation:none!important}.ev{display:none}}`

/** How a floor cell shows a room: its scale, and where the screen starts, in pixels of the cell. */
export function cellFrame(p: Pick<RoomInput, 'desks' | 'steps' | 'width' | 'height' | 'chief'>, base: number) {
  const v = sized(p.desks.length, p.width, p.height, base, !!p.chief)
  const k = p.width / v.w
  const taken = CELL_MARGIN + boardOf(p, true, 0).w + 10 + 72 * CELL_TELE
  return { k, teleLeft: (v.w - taken) * k }
}

const cells = (b: Box): Box => ({ x: b.x / PX, y: b.y / PX, w: b.w / PX, h: b.h / PX })

/** The board a room hangs: the plan of its own, or in the chief's room the list of its conversations. */
function boardOf(p: Pick<RoomInput, 'steps' | 'chief'>, cell: boolean, detail: number) {
  return planBoard(p.steps, cell ? (p.chief ? CHIEF_BOARD_W : CELL_BOARD_W) : ROOM_BOARD_W, detail, t(p.chief ? 'room.conversations' : 'room.planTitle'))
}

/** The tray, the tube and the envelope on its way, from where the tray stands. */
function mailroom(c: Chief, x: number, y: number, h: number) {
  const tubeX = x + TUBE_DX
  const tubeY = y + TUBE_DY
  const tubeH = h - tubeY
  const count = String(c.shown)
  const countW = Math.ceil(textWidth(count, 16)) + 14
  const countX = x + 69 - countW
  const badge = c.shown ? compteur(countX, y + 30, countW) + line(count, countX + 7, y + 30, 16, '#FFF6DE') : ''
  // Up the tube, then left into the tray: the same speed along both legs.
  const [up, left] = [tubeH - 26 - 3, 44]
  const flight = c.flying
    ? `<g class="ev" transform="translate(${tubeX + 32} ${tubeY + tubeH - 26})"><g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${-up};${-left} ${-up}" keyTimes="0;${Math.round((up / (up + left)) * 100) / 100};1" dur="${FLIGHT_MS / 1000}s" fill="freeze"/>${use('env')}</g></g>`
    : ''
  return `<g transform="translate(${tubeX} ${tubeY})">${tube(tubeH)}</g>${flight}<g transform="translate(${x} ${y})">${casier(c.shown)}</g>${badge}`
}

/**
 * Where a plan's board and its lines fall in a pane, in pixels of the pane, after the crop of a short one.
 * A line keeps its true height, however thin: past the 21 px of a row, the zones share out the band they make.
 */
export function boardLines(p: Pick<RoomInput, 'desks' | 'steps' | 'width' | 'height'>) {
  const v = sized(p.desks.length, p.width, p.height)
  const plan = planBoard(p.steps, ROOM_BOARD_W, 0)
  const spot = boardSpot(plan, v, false)
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
export function lineSvg(status: PlanStatus, label: string, b: { x: number; y: number; w: number; h: number }, scale: number, cellW: number, cellH: number) {
  const [left, top] = [Math.floor(b.x / cellW), Math.floor(b.y / cellH)]
  const [dx, dy] = [b.x - left * cellW, b.y - top * cellH]
  const [cols, rows] = [Math.ceil((dx + b.w) / cellW), Math.ceil((dy + b.h) / cellH)]
  const [width, height] = [cols * cellW, rows * cellH]
  const id = `c${status[0]}`
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><defs>${def(id, caseEtape(status))}${letterDefs(label)}</defs><g transform="translate(${Math.round(dx * 100) / 100} ${Math.round(dy * 100) / 100}) scale(${Math.round(scale * 1000) / 1000})"><rect width="${Math.ceil(textWidth(label, 16)) + 20}" height="${STEP}" fill="#F4E4C1"/>${use(id, 2, 3)}${line(label, 18, 0, 16, INKS[status])}</g></svg>`
  return { source, left, top, cols, rows, width, height }
}

/** The rug, in cells for its size: it holds every desk and stays on the axis of the manager. */
function rugOf(v: View, n: number, base: number | undefined, chief: boolean) {
  const first = managerOrigin(v).y
  const pair = base === PAIR_W
  const fit = (w: number, h: number, y: number) => ({ w: Math.round(w / PX), h: Math.round(h / PX), y })
  // The manager alone: the rug takes in a little of what the floor gains.
  const alone = (w: number, h: number, least: number) => {
    const size = fit(w, h, 0)
    return { ...size, y: pair ? PAIR_RUG_Y : Math.max(least, Math.round(first + 45 - size.h)) }
  }
  const rug =
    base !== undefined
      ? n
        ? fit(Math.min(v.w - 20, v.cols * v.col + (pair ? 140 : 110)), v.rows * CELL_ROW + 8, first - 6)
        : alone(Math.min(v.w - 20, Math.max(chief ? CHIEF_RUG : 300, 210)), 130 + (pair ? PAIR_RUG : 0), 206)
      : !n
        ? alone(346, 116 + v.extra * 0.55, 206)
        : v.rows === 2
          ? n < 3
            ? fit(394, 236, first - 9)
            : fit(418, 268, first - 36)
          : fit(Math.max(530, v.cols * OPEN_COL + 134), v.rows * DESK_H + 22, first - 19)
  return { ...rug, x: Math.round((v.w - rug.w * PX) / 2) + v.shift }
}

/** One room, ready for a drawing of its own or for a cell of the floor plan. */
export function roomScene(p: RoomInput, o: SceneOptions = {}): Scene {
  const detail = o.detail ?? 0
  const cell = o.base !== undefined
  const n = p.desks.length
  // A state saved by an older version may still seat an agent in the manager's colours.
  const agents = p.desks.map(d => ({ ...d, hue: agentHue(d.hue) }))
  const boss = managerSeat(p.manager)
  const v = sized(n, p.width, p.height, o.base, !!p.chief)
  const plan = boardOf(p, cell, detail)
  const { x: boardX, y: boardY } = boardSpot(plan, v, cell)
  const { x: teleX, y: teleY, k: teleK } = teleOf(plan, v, cell)
  const teleW = 72 * teleK

  const { w: rugW, h: rugH, x: rugX, y: rugY } = rugOf(v, n, o.base, !!p.chief)
  // The tray stands after the last desk of the widest row, level with the manager: the tube runs down clear of them all.
  const seats = Math.min(v.cols, Math.max(1, n))
  const tray = p.chief ? { x: seatX(seats, v) + (seats - 1) * v.col + Math.round(SPRITE_W * v.s) + TRAY_DX - SPRITE_W, y: managerOrigin(v).y + TRAY_DY } : null

  const drawn = drawRoom(p.sessionId, {
    w: v.w / PX,
    h: v.h / PX,
    tele: cells({ x: teleX, y: teleY, w: teleW, h: 60 * teleK }),
    board: cells({ x: boardX, y: boardY - 4, w: plan.w + 4, h: plan.h + 8 }),
    rug: cells({ x: rugX, y: rugY, w: rugW * PX, h: rugH * PX }),
    ...(o.plate ? { plate: cells({ x: 0, y: 0, w: o.plate.w, h: o.plate.h }) } : {}),
    ...(tray ? { tube: cells({ x: tray.x + TUBE_DX, y: tray.y + TUBE_DY, w: TUBE_W, h: v.h - tray.y - TUBE_DY }) } : {}),
    ...(p.settings ? { corner: Math.ceil((SETTINGS_CORNER * v.w) / p.width / PX) } : {}),
  })
  const room = { ...drawn, floor: detail ? [] : drawn.floor, wall: detail >= 4 ? [] : drawn.wall }
  const T = THEMES[room.theme]

  const defs = new Map<string, string>()
  const need = (id: string, make: () => string) => {
    if (!defs.has(id)) defs.set(id, make())
  }
  const wall = `wall-${room.theme}`
  const wainscot = `wainscot-${room.theme}`
  const rug = `rug-${room.theme}-${rugW}-${rugH}`
  const frame = `tableau-${plan.w}-${plan.h}`
  need(wall, () => pattern(wall, wallTile(T)))
  need(wainscot, () => pattern(wainscot, panelTile(T)))
  need('floor', () => pattern('floor', floorTile()))
  need('trims', () => `<g id="trims"><rect width="3000" height="2" fill="${W[4]}"/><rect y="2" width="3000" height="4" fill="${W[2]}"/><rect y="6" width="3000" height="2" fill="${T.pan2}"/><rect y="150" width="3000" height="6" fill="#4A2E22"/><rect y="156" width="3000" height="4" fill="#64402C"/></g>`)
  need('crab', () => def('crab', crab()))
  need('tele', () => `<g id="tele">${scaled(tele())}${line(t('room.tokens'), Math.round(36 - textWidth(t('room.tokens'), 12) / 2), 30, 12, '#80E0C7')}</g>`)
  need(rug, () => `<g id="${rug}" transform="scale(${PX})">${paths(tapis(T, rugW, rugH))}${frange(rugW, rugH)}</g>`)
  need(frame, () => `<g id="${frame}">${paths(tableau(plan.w, plan.h))}</g>`)
  for (const st of new Set(p.steps.map(s => s.status))) need(`c${st[0]}`, () => def(`c${st[0]}`, caseEtape(st)))
  const everyone = [boss, ...agents]
  if (detail < 6) need('chair', () => def('chair', chair()))
  if (everyone.some(d => d.state === 'working') && detail < 2) need('bulle', () => def('bulle', bulle()))
  if (boss.rest) need('zz', () => `<path id="zz" fill="#F4E4C1" d="${ZZ}"/>`)
  if (p.chief?.flying) need('env', () => `<g id="env">${enveloppe()}</g>`)
  for (const d of everyone) need(deskId(d), () => def(deskId(d), desk(d.rest ? 'rest' : d.state)))
  for (const hue of new Set(everyone.map(d => d.hue % TENUES.length))) need(`person-${hue}`, () => def(`person-${hue}`, person(TENUES[hue]!)))
  const hung = (it: (typeof room.wall)[number]) => (it.id === 'guirlande' ? `w-guirlande-${it.w}` : `w-${it.id}`)
  for (const it of room.wall) need(hung(it), () => def(hung(it), it.id === 'guirlande' ? guirlande(it.w) : WALL_DECOR[it.id]()))
  for (const it of room.floor) need(`f-${it.id}`, () => def(`f-${it.id}`, FLOOR_DECOR[it.id]()))

  const titles = agents.map(d => (detail >= 5 ? '' : fit(d.title, TITLE, 98)))
  const items: { bottom: number; svg: string }[] = room.floor.map(it => {
    const svg = use(`f-${it.id}`, it.x * PX, it.y * PX)
    return { bottom: it.y + it.h, svg: it.id === 'chat' ? `<g class="sl">${svg}</g>` : svg }
  })
  const seat = (d: RoomDesk, i: number, at: { x: number; y: number }, title: string, fresh: boolean) => {
    const tx = Math.round(60 - textWidth(title, TITLE) / 2)
    // Past the point where nothing moves at a desk, a person and a desk make one definition: a full floor writes hundreds.
    const pair = `p${d.hue}${d.rest ? 'z' : d.state[0]}`
    if (detail >= 6) need(pair, () => `<g id="${pair}">${use(`person-${d.hue}`, 44, -4)}${use(deskId(d))}</g>`)
    const seated = detail >= 6 ? use(pair) : use('chair') + actor(d, i, detail) + use(deskId(d))
    const body = seated + (d.rest ? '' : deskRail(d, detail, need)) + (title ? line(title, tx, 59, TITLE, INK) : '') + work(d, i, detail >= 2)
    const fade = fresh ? '<animate attributeName="opacity" from="0" to="1" begin=".75s" dur=".3s" fill="freeze"/>' : ''
    const shrink = v.s < 1 ? ` scale(${v.s})` : ''
    items.push({ bottom: (at.y + SPRITE_H * v.s) / PX, svg: `<g transform="translate(${at.x} ${at.y})${shrink}"${fresh ? ' opacity="0"' : ''}>${fade}${body}</g>` })
  }
  // The manager comes last in the phases, and his plate stays to the last step of the size limit.
  seat(boss, n, managerOrigin(v), boss.title, false)
  agents.forEach((d, i) => seat(d, i, deskOrigin(i, v, n), titles[i]!, i >= p.previous && p.previous !== n))
  // The tray and the counter stay to the last step of the size limit.
  if (p.chief && tray) items.push({ bottom: (tray.y + 66) / PX, svg: mailroom(p.chief, tray.x, tray.y, v.h) })
  items.sort((a, b) => a.bottom - b.bottom)

  const win = room.wall.find(it => it.id === 'fenetre')
  const body = `<rect width="${v.w}" height="102" fill="url(#${wall})"/><rect y="102" width="${v.w}" height="48" fill="url(#${wainscot})"/><rect y="150" width="${v.w}" height="${v.h - 150}" fill="url(#floor)"/>${use('trims')}
${use(rug, rugX, rugY)}${detail >= 2 ? '' : lights(v, win ? win.x * PX : null)}${room.wall.map(it => use(hung(it), it.x * PX, it.y * PX)).join('')}${sparkle(room)}
${screen(teleX, teleY, teleK)}${board(plan, p.steps, boardX, boardY)}
${items.map(it => it.svg).join('')}<g class="c" style="animation-delay:-${seedOf(p.sessionId) % 80}s"><g class="lg">${use('crab', Math.round(v.w / 2) - 20, v.h - 34)}</g></g>`
  const words = `${t('room.tokens')}${boss.title}${plan.title}${p.steps.length ? '' : t('room.noPlan')}${p.chief?.shown ?? ''}`
  return { defs, letters: `${words}${titles.join('')}${plan.labels.join('')}`, body, w: v.w, h: v.h }
}

const box = (w: number, h: number) => `0 0 ${w} ${h}`

/** The zoom out to a room of `w` by `h`, while desks arrive. It stays on the room's axis: the manager does not slide aside. */
function zoomOf(p: RoomInput, w: number, h: number) {
  const was = sized(p.previous, p.width, p.height)
  return p.previous !== p.desks.length ? `<animate attributeName="viewBox" from="${Math.round((w - was.w) / 2)} 0 ${was.w} ${was.h}" to="${box(w, h)}" dur=".8s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/>` : ''
}

function draw(p: RoomInput, detail: number): string {
  const s = roomScene(p, { detail })
  return `${svgOpen(p.width, p.height, box(s.w, s.h))}
<style>${MOTION}</style>
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
export function roomSvg(p: RoomInput): string {
  const key = JSON.stringify([getLanguage(), { ...p, tokens: 0 }])
  if (key !== lastKey) {
    lastKey = key
    // A full room gives up its furniture before it gives up a desk.
    lastSvg = [1, 2, 3, 4, 5, 6, 7].reduce((svg, detail) => (svg.length > MAX_SVG ? draw(p, detail) : svg), draw(p, 0))
  }
  return lastSvg
}
