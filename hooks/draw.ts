import { FLOOR_DECOR, THEMES, WALL_DECOR } from './pixel/decor'
import type { FloorDecor, WallDecor } from './pixel/decor'

export type Box = { x: number; y: number; w: number; h: number }
export type Placed<I> = Box & { id: I; slotW: number }
export type DrawnRoom = { theme: keyof typeof THEMES; wall: Placed<WallDecor>[]; floor: Placed<FloorDecor>[]; window: boolean }
/**
 * What a room holds before its decor is drawn, in cells: its size, the screen and the board on the wall, the rug on the
 * floor. `corner`: how far from the left the wall stays clear of decor, for the settings button.
 */
export type RoomFit = { w: number; h: number; tele: Box; board: Box; rug: Box; plate?: Box; tube?: Box; corner?: number }

// A room of the base size, with a short plan.
const BASE_FIT: RoomFit = {
  w: 270,
  h: 180,
  tele: { x: 163, y: 18, w: 36, h: 30 },
  board: { x: 203, y: 9, w: 62, h: 49 },
  rug: { x: 67, y: 107, w: 136, h: 58 },
}

/** FNV-1a, so a chat always gets the same room. */
export function seedOf(id: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function rng(seed: number) {
  let s = seed || 1
  const next = (n: number) => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s % n
  }
  // Close seeds stay close for the first few draws.
  for (let i = 0; i < 6; i += 1) next(1)
  return next
}

// Picks stand left to right, in this order, until the wall runs out: a wider room shows more of them.
const WALL_PICKS: (WallDecor | null)[][] = [
  ['fenetre', 'etagere', 'liege'],
  ['horloge', 'suspendue', 'affiche', null],
  ['etagere', 'liege', 'peinture', 'fenetre'],
  ['suspendue', 'affiche', 'horloge', null],
  ['peinture', 'liege', 'etagere'],
  ['affiche', 'suspendue', 'peinture', null],
]
const WALL_Y: Record<WallDecor, number> = { fenetre: 7, etagere: 19, liege: 15, peinture: 17, affiche: 17, horloge: 17, suspendue: 3, guirlande: 3 }
const WALL_LEFT = 6
const WALL_GAP = 4
const WALL_GAP_MAX = 14
const WIDE = 300
// The lowest a thing on the wall may hang, above the wainscot.
const WALL_FLOOR = 58
const SAG = 26

// Each slot lists what may stand there, and may stay empty. A slot counts from the left or from the right
// of the room; `front` slots count up from its bottom, the others stand against the wall.
type FloorSlot = { x?: number; right?: number; up: number; w: number; items: (FloorDecor | null)[]; front?: boolean; minW?: number }
const FLOOR_SLOTS: FloorSlot[] = [
  { x: 6, up: 97, w: 44, items: ['cafe', 'bibliotheque', 'fontaine', 'lampe'] },
  { x: 46, up: 102, w: 34, items: ['monstera', 'lampe', 'fontaine', null] },
  { x: 86, up: 102, w: 72, items: ['canape', 'fontaine', null], minW: WIDE },
  { right: 78, up: 102, w: 72, items: ['canape', 'fontaine', 'monstera'] },
  { x: 24, up: 46, w: 24, items: ['pouf', 'poubelle', null], front: true },
  { x: 20, up: 10, w: 30, items: ['chat', 'poubelle', null], front: true },
  { right: 42, up: 22, w: 40, items: ['cartons', 'pouf', 'poubelle', null], front: true },
  { right: 60, up: 8, w: 16, items: ['poubelle', null], front: true },
]

// How far furniture may stand before what hangs on the wall.
const WALL_OVERLAP = 10
const BAND = 6

const crosses = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const above = (o: Box, x: number, w: number) => x < o.x + o.w && o.x < x + w

const wallLeft = (fit: RoomFit) => Math.max(WALL_LEFT, fit.corner ?? 0)

function placeWall(roll: (n: number) => number, fit: RoomFit) {
  const end = Math.floor(fit.tele.x) - 3
  const used = new Set<WallDecor>()
  const picked: { id: WallDecor; w: number; h: number }[] = []
  let room = end - wallLeft(fit)
  for (const items of WALL_PICKS) {
    // A long wall leaves no slot empty.
    const free = items.filter(id => (id === null ? fit.w < WIDE : !used.has(id)))
    const id = free[roll(free.length || 1)] ?? null
    if (!id) continue
    const c = WALL_DECOR[id]()
    const gap = picked.length ? WALL_GAP : 0
    if (c.w + gap <= room) {
      room -= c.w + gap
      used.add(id)
      picked.push({ id, w: c.w, h: c.h })
    }
  }
  const spread = picked.length > 1 ? Math.min(WALL_GAP_MAX, WALL_GAP + Math.floor(room / (picked.length - 1))) : 0
  const wall: Placed<WallDecor>[] = []
  let x = wallLeft(fit)
  for (const it of picked) {
    // The name plate of a floor cell covers the top left corner: what would sit under it hangs lower, or goes.
    const under = !!fit.plate && above(fit.plate, x, it.w) && WALL_Y[it.id] < fit.plate.y + fit.plate.h
    const y = under ? fit.plate!.y + fit.plate!.h : WALL_Y[it.id]
    if (under && y + it.h > WALL_FLOOR) continue
    wall.push({ id: it.id, x, y, w: it.w, h: it.h, slotW: it.w + spread })
    x += it.w + spread
  }
  return wall
}

/** The string of lights above what hangs on the wall, from the window to the screen. */
function placeLights(roll: (n: number) => number, wall: Placed<WallDecor>[], fit: RoomFit): Placed<WallDecor> | null {
  const lit = roll(3) > 0
  const win = wall.find(it => it.id === 'fenetre')
  const x = win ? win.x + win.w + 2 : wallLeft(fit)
  const left = fit.plate ? Math.max(x, Math.ceil(fit.plate.x + fit.plate.w) + 2) : x
  const w = Math.floor((Math.floor(fit.tele.x) - 2 - left) / SAG) * SAG
  const clear = wall.every(it => it.id === 'suspendue' || !above(it, left, Math.min(w, 130)) || it.y >= 17)
  if (!lit || w < 2 * SAG || !clear) return null
  return { id: 'guirlande', x: left, y: WALL_Y.guirlande, w: Math.min(w, 130), h: 14, slotW: Math.min(w, 130) }
}

export function drawRoom(sessionId: string, fit: RoomFit = BASE_FIT): DrawnRoom {
  const roll = rng(seedOf(sessionId))
  const names = Object.keys(THEMES) as (keyof typeof THEMES)[]
  const theme = names[roll(names.length)]!
  const hung = placeWall(roll, fit)
  const lights = placeLights(roll, hung, fit)
  const wall = lights ? [lights, ...hung] : hung
  const fixed = [fit.tele, fit.board, ...(fit.tube ? [fit.tube] : [])]
  // A piece never hides the wall decor, and never the screen or the board, not even a little.
  const free = (b: Box) => !hung.some(o => above(o, b.x, b.w) && b.y + WALL_OVERLAP < o.y + o.h) && !fixed.some(o => crosses(o, b))
  const usedFloor = new Set<FloorDecor>()
  const floor: Placed<FloorDecor>[] = []
  const put = (id: FloorDecor, b: Box, slotW: number) => {
    usedFloor.add(id)
    floor.push({ id, ...b, slotW })
  }
  for (const slot of FLOOR_SLOTS) {
    const open = slot.items.filter(id => id === null || !usedFloor.has(id))
    const start = roll(open.length)
    if (slot.minW && fit.w < slot.minW) continue
    const baseX = slot.x ?? fit.w - slot.right!
    for (let i = 0; i < open.length; i += 1) {
      const id = open[(start + i) % open.length] ?? null
      if (id === null) break
      const c = FLOOR_DECOR[id]()
      if (c.w > slot.w) continue
      const x = Math.round(baseX)
      const clear = (b: Box) => !floor.some(o => crosses(o, b)) && !(fit.tube && crosses(fit.tube, b))
      if (slot.front) {
        const side = { x, y: fit.h - slot.up - c.h, w: c.w, h: c.h }
        if (!crosses(side, fit.rug) && clear(side)) {
          put(id, side, slot.w)
          break
        }
        // Where the rug takes the whole floor, what stood beside it moves to the band below.
        const band = { x, y: fit.h - BAND - c.h, w: c.w, h: c.h }
        while (band.x + band.w < fit.w && !clear(band)) band.x += 4
        if (band.x + band.w < fit.w && band.y >= fit.rug.y + fit.rug.h && clear(band)) {
          put(id, band, slot.w)
          break
        }
        continue
      }
      const back = { x, y: slot.up - c.h, w: c.w, h: c.h }
      if (free(back) && clear(back)) {
        put(id, back, slot.w)
        break
      }
      // Under a board that grew, a piece steps forward rather than cover it.
      const hit = fixed.filter(o => above(o, x, c.w))
      const low = { ...back, y: Math.ceil(Math.max(...hit.map(o => o.y + o.h), back.y)) }
      if (hit.length && free(low) && clear(low) && !crosses(low, fit.rug)) {
        put(id, low, slot.w)
        break
      }
    }
  }
  return { theme, wall, floor, window: hung.some(it => it.id === 'fenetre') }
}
