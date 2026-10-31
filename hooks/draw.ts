import type { FloorSlot, Pack } from './pixel/pack'
import { packOf } from './pixel/themes'

export type Box = { x: number; y: number; w: number; h: number }
export type Placed = Box & { id: string; slotW: number }
export type DrawnRoom = { wall: Placed[]; floor: Placed[]; basket: Box; window: boolean }
/**
 * What a room holds before its decor is drawn, in cells: its size, the screen and the board on the wall, the rug on the
 * floor. `corner`: how far from the left the wall stays clear of decor, for the settings button. `wallEnd`: where the
 * wall's decor stops whatever the plan, so the lights never move with a board that grows; what the screen then reaches
 * steps down. `stove`: the floor it takes. `taken`: what else stands on the floor, as desks a theme does not seat on the rug.
 */
export type RoomFit = { w: number; h: number; tele: Box; board: Box; rug: Box; corner?: number; wallEnd?: number; stove?: Box; taken?: readonly Box[] }

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

const WALL_LEFT = 6
const WALL_GAP = 4
const WALL_GAP_MAX = 14
const WIDE = 300
// What a string of lights leaves clear below it.
const STRING_LOW = 17
const STRING_W = 130

// How far furniture may stand before what hangs on the wall.
const WALL_OVERLAP = 10
const BAND = 6
const BASKET_X = 6

const crosses = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const above = (o: Box, x: number, w: number) => x < o.x + o.w && o.x < x + w

const wallLeft = (fit: RoomFit) => Math.max(WALL_LEFT, fit.corner ?? 0)

function placeWall(roll: (n: number) => number, fit: RoomFit, { wall: decor }: Pack) {
  const end = Math.floor(fit.wallEnd ?? fit.tele.x) - 3
  const used = new Set<string>()
  const picked: { id: string; w: number; h: number }[] = []
  let room = end - wallLeft(fit)
  for (const items of decor.picks) {
    // A long wall leaves no slot empty.
    const free = items.filter(id => (id === null ? fit.w < WIDE : !used.has(id)))
    const id = free[roll(free.length || 1)] ?? null
    if (!id) continue
    const c = decor.items[id]!.draw()
    const gap = picked.length ? WALL_GAP : 0
    if (c.w + gap <= room) {
      room -= c.w + gap
      used.add(id)
      picked.push({ id, w: c.w, h: c.h })
    }
  }
  const spread = picked.length > 1 ? Math.min(WALL_GAP_MAX, WALL_GAP + Math.floor(room / (picked.length - 1))) : 0
  const wall: Placed[] = []
  let x = wallLeft(fit)
  for (const it of picked) {
    wall.push({ id: it.id, x, y: decor.items[it.id]!.y, w: it.w, h: it.h, slotW: it.w + spread })
    x += it.w + spread
  }
  return wall
}

/** The string of lights above what hangs on the wall, from the window to the screen. */
function placeLights(roll: (n: number) => number, wall: Placed[], fit: RoomFit, { wall: decor }: Pack): Placed | null {
  const lit = roll(3) > 0
  const string = decor.string
  if (!string) return null
  // What the theme keeps apart from it, as what it would cross.
  if (decor.clash?.some(pair => pair.includes(string.id) && wall.some(it => pair.includes(it.id)))) return null
  const win = wall.find(it => it.id === 'fenetre')
  const left = win ? win.x + win.w + 2 : wallLeft(fit)
  const w = Math.floor((Math.floor(fit.wallEnd ?? fit.tele.x) - 2 - left) / string.sag) * string.sag
  const clear = wall.every(it => !above(it, left, Math.min(w, STRING_W)) || it.y >= STRING_LOW)
  if (!lit || w < 2 * string.sag || !clear) return null
  return { id: string.id, x: left, y: string.y, w: Math.min(w, STRING_W), h: string.h, slotW: Math.min(w, STRING_W) }
}

/** The crab's basket, in every room: in the left corner of the floor, or the first place along it. */
function placeBasket(fit: RoomFit, pack: Pack, blocked: (b: Box) => boolean): Box {
  const c = pack.basket(false)
  const at = { x: BASKET_X, y: fit.h - BAND - c.h, w: c.w, h: c.h }
  while (at.x + at.w < fit.w && blocked(at)) at.x += 4
  return at.x + at.w < fit.w ? at : { ...at, x: BASKET_X }
}

function placeFloor(roll: (n: number) => number, fit: RoomFit, pack: Pack, free: (b: Box) => boolean, fixed: readonly Box[], basket: Box) {
  const usedFloor = new Set<string>()
  const floor: Placed[] = []
  const put = (id: string, b: Box, slotW: number) => {
    usedFloor.add(id)
    floor.push({ id, ...b, slotW })
  }
  const clear = (b: Box) => !crosses(basket, b) && !floor.some(o => crosses(o, b)) && !(fit.stove && crosses(fit.stove, b)) && !fit.taken?.some(o => crosses(o, b))
  const settle = (slot: FloorSlot, id: string, x: number) => {
    const c = pack.floor.items[id]!()
    if (slot.front) {
      const side = { x, y: fit.h - slot.up - c.h, w: c.w, h: c.h }
      if (!crosses(side, fit.rug) && clear(side)) return side
      // Where the rug takes the whole floor, what stood beside it moves to the band below.
      const band = { x, y: fit.h - BAND - c.h, w: c.w, h: c.h }
      while (band.x + band.w < fit.w && !clear(band)) band.x += 4
      return band.x + band.w < fit.w && band.y >= fit.rug.y + fit.rug.h && clear(band) ? band : null
    }
    const back = { x, y: slot.up - c.h, w: c.w, h: c.h }
    if (free(back) && clear(back)) return back
    // Under a board that grew, a piece steps forward rather than cover it.
    const hit = fixed.filter(o => above(o, x, c.w))
    const low = { ...back, y: Math.ceil(Math.max(...hit.map(o => o.y + o.h), back.y)) }
    return hit.length && free(low) && clear(low) && !crosses(low, fit.rug) ? low : null
  }
  for (const slot of pack.floor.slots) {
    const open = slot.items.filter(id => id === null || !usedFloor.has(id))
    const start = roll(open.length)
    if (slot.minW && fit.w < slot.minW) continue
    const x = Math.round(slot.x ?? fit.w - slot.right!)
    for (let i = 0; i < open.length; i += 1) {
      const id = open[(start + i) % open.length] ?? null
      if (id === null) break
      if (pack.floor.items[id]!().w > slot.w) continue
      const spot = settle(slot, id, x)
      if (spot) {
        put(id, spot, slot.w)
        break
      }
    }
  }
  return floor
}

export function drawRoom(sessionId: string, fit: RoomFit = BASE_FIT, pack: Pack = packOf(undefined)): DrawnRoom {
  const roll = rng(seedOf(sessionId))
  const placed = placeWall(roll, fit, pack)
  const lights = placeLights(roll, placed, fit, pack)
  const hung = placed.filter(it => !crosses(it, fit.tele) && !(pack.wall.stands && [...(fit.taken ?? []), ...(fit.stove ? [fit.stove] : [])].some(o => crosses(it, o))))
  const wall = lights ? [lights, ...hung] : hung
  const fixed = [fit.tele, fit.board]
  // A piece never hides the wall decor, and never the screen or the board, not even a little.
  const free = (b: Box) => !hung.some(o => above(o, b.x, b.w) && b.y + WALL_OVERLAP < o.y + o.h) && !fixed.some(o => crosses(o, b))
  const basket = placeBasket(fit, pack, b => !!(fit.stove && crosses(fit.stove, b)) || !!fit.taken?.some(o => crosses(o, b)))
  const floor = placeFloor(roll, fit, pack, free, fixed, basket)
  return { wall, floor, basket, window: hung.some(it => it.id === 'fenetre') }
}
