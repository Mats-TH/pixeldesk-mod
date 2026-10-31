import type { Fire as FireLevel, PlanStatus, RoomTheme, Ash as AshLevel } from '../../types'
import { canvas, mix, noise, paths } from './canvas'
import type { Canvas } from './canvas'
import type { Point } from './hearth'
import type { DeskState, Tenue } from './sprites'

export type Art = () => Canvas
/** What a room stands on, in pixels of the room. `defs`: what `body` refers to. */
export type Backdrop = { defs: string; body: string }
/** Something the wall holds. `y`: where it hangs, in cells. `sparks`: the cells that twinkle, from its corner. */
export type WallItem = { draw: Art; y: number; sparks?: readonly (readonly [number, number])[] }
/** A string along the top of the wall: `draw` takes its width, a whole number of `sag`. */
export type WallString = { id: string; y: number; h: number; sag: number; draw: (w: number) => Canvas; sparks?: (w: number) => (readonly [number, number])[] }
/**
 * Each slot lists what may stand there, and may stay empty. A slot counts from the left or from the right of the room;
 * `front` slots count up from its bottom, the others stand against the wall.
 */
export type FloorSlot = { x?: number; right?: number; up: number; w: number; items: readonly (string | null)[]; front?: boolean; minW?: number }
/** A person's desk. `behind`: what stands behind the chair, its corner from the desk's, in cells, as a tent. */
export type Seat = { chair: Art | null; desk: (state: DeskState | 'rest') => Canvas; person?: (tenue: Tenue) => Canvas; behind?: { draw: Art; dx: number; dy: number; h: number } }
/**
 * The screen on the wall. A set takes the 72 by 60 pixels the room leaves it; `dx` and `dy` move its drawing from
 * there, so a set may stand larger than its place. `digits` and `label`: where the count and its word stand on it.
 * `reach`: what the set takes from its place, in pixels, when it goes past 72 by 60: furniture keeps off it.
 */
export type Tele = { draw: Art; dx: number; dy: number; digits: { cx: number; y: number; size: number; ink: string }; label: { y: number; size: number; ink: string }; reach?: { w: number; h: number } }
/** The plate over the screen. `dx`, `dy`: from the set's place. `cost`: where the amount stands on it, centred on `cx`. */
export type Plaque = { draw: Art; dx: number; dy: number; cost: { cx: number; y: number; size: number; ink: string } }
/** The plan's board. `art` draws it at `w` by `h` pixels of the room, as an SVG group's content. */
export type Board = { art: (w: number, h: number) => string; title: string; paper: string; glow: string; inks: Record<PlanStatus, string> }
/** The hearth, on a grid of its own, 2 pixels of the room to a cell, then `at.s`. */
export type Hearth = {
  /** Its size, in pixels of the room at scale 1: to its feet, what stands on the floor. */
  w: number
  feet: number
  body: () => string
  /** What stays in front of the fire, as a window's frame. */
  front?: () => string
  flames: (level: FireLevel, frame: number) => string
  frames: (level: FireLevel) => number
  ash: (level: AshLevel, frame: number) => string
  /** Where the grid of the ash starts on the hearth's. */
  ashTop: number
  /** What the fire changes on the grid, for its small drawing. */
  fireArea: { x: number; y: number; w: number; h: number }
  /** Where the keeper's log lands. */
  deposit: Point
  /** Where it stands in the room, with no agent or with `n`; by default, on the left of the floor. */
  spot?: (n: number, w: number, h: number) => Point
}
/** What moves in a room apart from the desks: a drawing of its own over the back, in pixels of the room. */
export type Moving = { key: string; box: { x: number; y: number; w: number; h: number }; style: string; body: string; alt: 'lights' | 'sky' }

/** The world a floor is drawn on, the same in every theme. */
export const WORLD = { w: 780, h: 760 }
/** A conversation as its world shows it. `people`: who is at work there, the manager first. `rest`: seen at a glance. */
export type MapRoom = { id: string; seed: number; title: string; meta: string; rest: boolean; chief: boolean; people: { hue: number; state: DeskState }[]; working: number }
/**
 * What a world draws from. `list`: the conversations the one that leads lists on its board. `news`: what reached its
 * tray, and whether one is on its way, for `flightS` seconds. `detail` grows from 0 to 7 while the drawing weighs too much.
 * `liveFire`: a frame of its own burns over the main camp, which leaves its flames out.
 */
export type MapView = { rooms: MapRoom[]; list: { text: string; status: PlanStatus }[]; news: { shown: number; flying: boolean }; detail: number; flightS: number; liveFire: boolean }
/** A world, drawn. `rooms`: one group per conversation, in the order of the view. `words`: every letter it writes. */
export type MapDrawing = { defs: string; back: string; rooms: string[]; front: string; words: string; style?: string }
/** A floor as its theme shows it, on the `WORLD` grid, from 2 to 11 conversations. Nothing suggests an order among them. */
export type MapPack = {
  /** The colour past the edges of the world, on a pane of another shape. */
  back: string
  /** What the pointer takes for each conversation, the one that leads first. */
  places: (n: number) => { x: number; y: number; w: number; h: number }[]
  /** Where each count of tokens stands, centred on `x`: it lives on an image of its own. */
  counts: (n: number) => { x: number; y: number; size: number; ink: string }[]
  draw: (v: MapView) => MapDrawing
  /** Where the hearth's fire stands in the main camp, with `n` conversations, when the world has one. */
  fire?: (n: number) => Point
  /** The crab's rounds on this world, as a closed loop of points. */
  walk?: (n: number) => Point[]
}

/** Everything a theme brings to a room. All of it is drawn on demand: a theme nobody picks costs nothing. */
export type Pack = {
  id: RoomTheme
  backdrop: (seed: number, w: number, h: number, detail: number) => Backdrop
  /** The rug, or a clearing: the content of an SVG group, in cells. Null: none in this room. Past detail 0, the lightest it has. */
  rug: (seed: number, w: number, h: number, detail: number) => string | null
  /** The two pools of golden light a lamp would give the floor, by opacity. Null: none. */
  light: readonly [number, number] | null
  /** What the hour of a room lays over decor `id`, as the backdrop's own veil: a paint with its opacity, or null. */
  veil?: (seed: number, id: string) => string | null
  /**
   * `end`: where its decor stops in a room `w` pixels wide, in cells, when something of the theme stands past it.
   * `stands`: its decor stands on the ground, as trees, and gives way to the desks a theme seats out of rows.
   */
  wall: { picks: readonly (readonly (string | null)[])[]; items: Readonly<Record<string, WallItem>>; string?: WallString; clash?: readonly (readonly [string, string])[]; end?: (w: number) => number; stands?: boolean }
  floor: { slots: readonly FloorSlot[]; items: Readonly<Record<string, Art>> }
  seat: Seat
  tele: Tele
  plaque: Plaque
  board: Board
  hearth: Hearth
  /** The crab's basket, full of crab or not: the room draws it empty. */
  basket: (asleep: boolean) => Canvas
  /** Where the manager, then each of `n` agents, stands, when the theme does not seat them in rows. */
  place?: (n: number, w: number, h: number) => Point[]
  /** What moves on its own in that room, in pixels of the room. */
  moving?: (seed: number, w: number, h: number) => Moving[]
}

/** A theme whole: its rooms and its floor plan. */
export type Themed = Pack & { map: MapPack }

/** A sprite that takes time to draw, drawn once. Nothing writes on a canvas once it is drawn. */
export function once(draw: Art): Art {
  let made: Canvas | null = null
  return () => (made ??= draw())
}

export const PX = 2
/** The Zs of a nap, over a desk of the room's size. */
export const ZZ = 'M82 4h8v2h-8zM86 6h2v2h-2zM84 8h2v2h-2zM82 10h8v2h-8zM92 0h6v2h-6zM94 2h2v2h-2zM92 4h6v2h-6z'

/** `c` under `paint`, a colour with its opacity. What is already see-through stays as it is, and the drawing weighs the same. */
export function veiled(c: Canvas, paint: string) {
  const [tint, alpha] = paint.split('|') as [string, string]
  const out = canvas(c.w, c.h)
  for (let y = 0; y < c.h; y += 1) {
    for (let x = 0; x < c.w; x += 1) {
      const p = c.get(x, y)
      if (p) out.set(x, y, p.includes('|') ? p : mix(p, tint, Number(alpha)))
    }
  }
  return out
}

export const scaled = (c: Canvas) => `<g transform="scale(${PX})">${paths(c)}</g>`
export const pattern = (id: string, c: Canvas) => `<pattern id="${id}" width="${c.w * PX}" height="${c.h * PX}" patternUnits="userSpaceOnUse">${scaled(c)}</pattern>`

/** A wall of `wall` over a wainscot of `low`, a floor of `floor`, and the trims between them. */
export function walled(look: { wall: Canvas; low: Canvas; floor: Canvas; trims: string }, w: number, h: number): Backdrop {
  const defs = pattern('wall', look.wall) + pattern('low', look.low) + pattern('floor', look.floor)
  return { defs, body: `<rect width="${w}" height="102" fill="url(#wall)"/><rect y="102" width="${w}" height="48" fill="url(#low)"/><rect y="150" width="${w}" height="${h - 150}" fill="url(#floor)"/>${look.trims}` }
}

/** One of `n`, the same for a conversation every time. `salt`: another draw from the same conversation. */
export const pick = (seed: number, salt: number, n: number) => Math.floor(noise(seed & 0xffff, (seed >>> 16) + salt * 977) * n)
