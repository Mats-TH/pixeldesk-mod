import { paths } from '../canvas'
import type { FireLevel } from '../hearth'
import { once, pick, walled } from '../pack'
import type { Board, Pack, Plaque, Tele } from '../pack'
import { affiche, baie, borne, bureau, cartes, cartouches, chaise, consoleBasse, des, figurines, lambris, murCircuit, murEtoiles, murMousse, neon, panier, plaque, poele, poufPoire, solArcade, solEbene, solHexagones, tableJeu, tableau, tapis, tele, tour } from './geek-art'
import { ironStove } from './stove'

const WALLS = [once(murEtoiles), once(murCircuit), once(murMousse)]
const FLOORS = [once(solHexagones), once(solEbene), once(solArcade)]
// A full room keeps its floor, with less to write.
const LEAN_FLOORS = [FLOORS[0]!, FLOORS[1]!, once(() => solArcade(true))]
const LOW = once(lambris)
const STOVE = once(poele)
const TRIMS = (w: number) => `<rect width="${w}" height="2" fill="#6C5CA8"/><rect y="2" width="${w}" height="4" fill="#2A2146"/><rect y="6" width="${w}" height="2" fill="#120E1E"/><rect y="150" width="${w}" height="6" fill="#120E1E"/><rect y="156" width="${w}" height="4" fill="#2A2146"/><rect y="160" width="${w}" height="8" fill="#1B1730" fill-opacity=".28"/>`

/** The stove's fire alone: what it lays on the floor is the only paint with an opacity, and this set has its own shadow. */
const windowFire = (level: FireLevel, frame: number) => ironStove.flames(level, frame).replace(/<path fill="#\w+" fill-opacity="[^"]*" d="[^"]*"\/>/g, '')

const TELE: Tele = { draw: once(tele), dx: 0, dy: 0, digits: { cx: 36, y: 10, size: 24, ink: '#EDFFF5' }, label: { y: 30, size: 12, ink: '#7FE0C8' }, reach: { w: 80, h: 144 } }
const PLAQUE: Plaque = { draw: once(plaque), dx: 4, dy: -26, cost: { cx: 36, y: 6, size: 12, ink: '#FFE066' } }
const BOARD: Board = { art: tableau, title: '#FFE066', paper: '#100C20', glow: '#3A2E60', inks: { completed: '#8C80B8', in_progress: '#FFF6DE', pending: '#B0FAF8' } }

export const geek: Pack = {
  id: 'geek',
  backdrop(seed, w, h, detail) {
    return walled({ wall: WALLS[pick(seed, 2, WALLS.length)]!(), low: LOW(), floor: (detail ? LEAN_FLOORS : FLOORS)[pick(seed, 3, FLOORS.length)]!(), trims: TRIMS(w) }, w, h)
  },
  rug(seed, w, h, detail) {
    return pick(seed, 4, 3) ? paths(tapis(w, h, detail > 0)) : null
  },
  light: null,
  wall: {
    picks: [
      ['baie', 'neon', 'cartes'],
      ['affiche', 'cartouches', null],
      ['figurines', 'cartes', 'neon'],
      ['cartouches', 'affiche', null],
      ['neon', 'figurines', 'baie'],
      ['cartes', 'affiche', null],
    ],
    items: {
      baie: { draw: once(baie), y: 4, sparks: [[8, 16], [22, 15], [37, 14], [54, 17]] },
      affiche: { draw: once(affiche), y: 7 },
      figurines: { draw: once(figurines), y: 14 },
      neon: { draw: once(neon), y: 10, sparks: [[35, 16], [39, 12], [39, 19], [43, 16]] },
      cartes: { draw: once(cartes), y: 16, sparks: [[33, 24], [45, 26], [39, 33]] },
      cartouches: { draw: once(cartouches), y: 12 },
    },
  },
  floor: {
    slots: [
      { x: 3, up: 112, w: 44, items: ['borne', 'tour'] },
      { x: 50, up: 102, w: 36, items: ['tour'] },
      { x: 90, up: 102, w: 60, items: ['consoleBasse', 'tableJeu'] },
      { right: 66, up: 104, w: 62, items: ['tableJeu', 'consoleBasse', 'tour'] },
      { right: 46, up: 22, w: 44, items: ['borne', 'poufPoire', 'des'], front: true },
      { x: 24, up: 46, w: 48, items: ['poufPoire', 'des', null], front: true },
      { right: 96, up: 6, w: 48, items: ['des', 'poufPoire'], front: true },
    ],
    items: {
      borne: once(borne),
      tour: once(tour),
      consoleBasse: once(consoleBasse),
      tableJeu: once(tableJeu),
      poufPoire: once(poufPoire),
      des: once(des),
    },
  },
  seat: { chair: once(chaise), desk: bureau },
  tele: TELE,
  plaque: PLAQUE,
  board: BOARD,
  // The set stands on the stove's grid: same window, same feet, same place for the log, so its fire and ash fall right.
  hearth: { ...ironStove, body: () => paths(STOVE()), flames: windowFire, fireArea: { x: 16, y: 33, w: 16, h: 15 } },
  basket: panier,
}
