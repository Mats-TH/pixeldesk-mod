import { paths } from '../canvas'
import type { Point } from '../hearth'
import { once, pick } from '../pack'
import type { Hearth, Pack, Plaque, Tele } from '../pack'
import { SCENES, arbreNichoir, banc, buisson, bureau, caisse, canoe, cendres, clairiere, fagots, fanions, fireFrames, flammesFeu, foret, fougeres, foyer, grandArbre, hamac, lanterne, marmite, nid, panierChampignons, panneau, plaque, rocher, ruisseau, sac, souche, tele, tente } from './nature-art'

const sceneOf = (seed: number) => SCENES[pick(seed, 1, SCENES.length)]!

const TELE: Tele = { draw: once(tele), dx: -8, dy: -26, digits: { cx: 36, y: 10, size: 24, ink: '#EDFFF5' }, label: { y: 33, size: 12, ink: '#7FE0C8' }, reach: { w: 72, h: 136 } }
const PLAQUE: Plaque = { draw: once(plaque), dx: 0, dy: -26, cost: { cx: 34, y: 6, size: 12, ink: '#FFC857' } }

const even = (v: number) => Math.round(v / 2) * 2
// The manager's row. A tent rises 44 over its desk.
const HEAD_Y = 150
const DESK_H = 90
const TENT = 44
// Above this, on the right, the screen and the board stand on their legs.
const SHOULDER = 240
const FIRE_H = 128

/** The manager stands on the axis, unless the screen's legs need the room. */
const headOf = (w: number) => Math.min(even(w / 2 - 60), w - 376)

/**
 * A ring of tents round the fire: on an ellipse up to eight agents, then along the four sides of the room, where
 * sixteen still leave the fire its ground. A room is as wide as its agents ask, and only grows taller.
 */
function ring(n: number, w: number, h: number): { seats: Point[]; fire: Point } {
  const [cx, head] = [w / 2, headOf(w)]
  const fireX = even(cx - 60)
  if (!n) return { seats: [{ x: head, y: 132 }], fire: { x: fireX, y: Math.max(226, even((222 + h - FIRE_H) / 2)) } }
  const low = h - (n < 4 ? 92 : 100)
  if (n > 8) {
    const rows = n > 12 ? 5 : 4
    const ys = Array.from({ length: rows }, (_, i) => even(HEAD_Y + (i * (low - HEAD_Y)) / (rows - 1)))
    const across = (i: number, of: number) => even(10 + (i * (w - 140)) / of)
    const last = Math.min(6, n - 2 - 2 * (rows - 2))
    const sides = ys.slice(1, -1)
    const seats = [
      { x: head, y: HEAD_Y },
      ...sides.map(y => ({ x: across(5, 5), y })),
      ...Array.from({ length: last }, (_, i) => ({ x: across(last - 1 - i, last - 1), y: ys[rows - 1]! })),
      ...sides.slice().reverse().map(y => ({ x: across(0, 5), y })),
      { x: head - 272, y: HEAD_Y },
      { x: head - 136, y: HEAD_Y },
    ]
    if (n > 14) seats.push({ x: across(4, 5), y: ys[1]! })
    if (n > 15) seats.push({ x: across(1, 5), y: ys[rows - 2]! })
    return { seats, fire: { x: fireX, y: even((HEAD_Y + DESK_H + low - TENT) / 2 - FIRE_H / 2) } }
  }
  const rx = (w - 140) / 2
  let angles = Array.from({ length: n + 1 }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / (n + 1))
  const ry = (low - HEAD_Y) / (1 + Math.max(...angles.map(Math.sin)))
  const cy = HEAD_Y + ry
  // Past five agents the first would stand on the board's legs: the others share the rest of the ring.
  const from = Math.asin(Math.min(1, (SHOULDER - cy) / ry))
  if (n > 5 && from > angles[1]!) angles = [angles[0]!, ...Array.from({ length: n }, (_, i) => from + (i * ((3 * Math.PI) / 2 - from)) / n)]
  const seats = angles.map((a, i) => ({ x: i ? even(cx + rx * Math.cos(a) - 60) : head, y: even(cy + ry * Math.sin(a)) }))
  const below = Math.min(low, ...seats.slice(1).filter(s => Math.abs(s.x - (cx - 60)) < 132).map(s => s.y - TENT))
  return { seats, fire: { x: fireX, y: even((HEAD_Y + DESK_H + below) / 2 - FIRE_H / 2) } }
}

// A room of four agents or more, in cells: the fire then stands where these pieces can keep it company.
const FULL = 380
const FOYER = once(foyer)

const HEARTH: Hearth = {
  w: 120,
  feet: 128,
  body: () => paths(FOYER()),
  flames: flammesFeu,
  frames: fireFrames,
  ash: (level, frame) => paths(cendres(level, frame)),
  ashTop: 0,
  fireArea: { x: 0, y: 0, w: 60, h: 64 },
  deposit: { x: 44, y: 50 },
  spot: (n, w, h) => ring(n, w, h).fire,
}

export const nature: Pack = {
  id: 'nature',
  backdrop: (seed, w, h, detail) => foret(sceneOf(seed), pick(seed, 2, 5), w, h, detail > 0),
  rug: (_, w, h, detail) => clairiere(w, h, detail > 0),
  light: null,
  veil: (seed, id) => (id === 'lanterne' ? null : sceneOf(seed).veil),
  wall: {
    stands: true,
    picks: [['hamac', 'grandArbre', 'arbreNichoir', 'buisson'], ['buisson', 'fougeres']],
    items: {
      hamac: { draw: once(hamac), y: 58 },
      grandArbre: { draw: once(grandArbre), y: 2 },
      arbreNichoir: { draw: once(arbreNichoir), y: 8 },
      buisson: { draw: once(buisson), y: 64 },
      fougeres: { draw: once(fougeres), y: 72 },
    },
    string: { id: 'fanions', y: 4, h: 24, sag: 24, draw: fanions },
  },
  floor: {
    slots: [
      { right: 110, up: 134, w: 96, items: ['canoe', 'rocher'] },
      { right: 142, up: 140, w: 32, items: ['lanterne', null] },
      { x: 112, up: 250, w: 48, items: ['fagots'], minW: FULL },
      { x: 232, up: 246, w: 40, items: ['marmite'], minW: FULL },
      { x: 62, up: 214, w: 48, items: ['fagots', null] },
      { x: 150, up: 324, w: 150, items: ['banc', 'ruisseau'], minW: FULL },
      { x: 2, up: 74, w: 52, items: ['rocher', 'souche'], front: true },
      { right: 46, up: 86, w: 44, items: ['panierChampignons', 'caisse'], front: true },
      { right: 46, up: 40, w: 44, items: ['caisse', 'sac', null], front: true },
      { x: 60, up: 10, w: 40, items: ['sac', 'lanterne', null], front: true },
    ],
    items: {
      canoe: once(canoe),
      rocher: once(rocher),
      souche: once(souche),
      fagots: once(fagots),
      marmite: once(marmite),
      banc: once(banc),
      panierChampignons: once(panierChampignons),
      caisse: once(caisse),
      sac: once(sac),
      lanterne: once(lanterne),
      ruisseau: once(ruisseau),
    },
  },
  seat: { chair: null, desk: bureau, behind: { draw: once(tente), dx: -2, dy: -22, h: 46 } },
  tele: TELE,
  plaque: PLAQUE,
  board: { art: panneau, title: '#3A2418', paper: '#FFF6DE', glow: '#FFDF8F', inks: { completed: '#7A6A5E', in_progress: '#1B1730', pending: '#3A2E33' } },
  hearth: HEARTH,
  basket: nid,
  place: (n, w, h) => ring(n, w, h).seats,
}
