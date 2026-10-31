import { paths } from '../canvas'
import type { Canvas } from '../canvas'
import { ASH_TOP, STOVE_DEPOSIT, ash, fire, fireFrames, spriteBody } from '../hearth'
import { PX, once, pattern, pick, scaled } from '../pack'
import type { Art, Board, Moving, Pack, Plaque, Tele } from '../pack'
import { person } from '../sprites'
import { AUBE, DESERT, NUIT, SCENE_H, ballon, bords, caisses, capsule, chaise, ciel, console_, dalle, dome, flammeReacteur, fusee, generateur, hangar, horizon, hublot, jet, nuage, paillasse, parabole, plaque, plots, pylone, reacteur, reservoirs, rover, scaphandre, scientifique, scories, solSable, solTerre, solTole, sonde, tableau, telescope, tour, vapeur, voyant } from './base-art'
import type { Scene } from './base-art'

type Draw = { scene: Scene; nuit: boolean; sol: readonly [Art, Art] }
const DRAWS: readonly Draw[] = [
  { scene: AUBE, nuit: false, sol: [once(() => solTerre(false)), once(() => solTerre(true))] },
  { scene: DESERT, nuit: false, sol: [once(() => solSable(false)), once(() => solSable(true))] },
  { scene: NUIT, nuit: true, sol: [once(() => solTole(false)), once(() => solTole(true))] },
]
const drawOf = (seed: number) => DRAWS[pick(seed, 2, DRAWS.length)]!

// A room writes its back several times over: the same scene at the same width is the same string.
const seen = new Map<string, string>()
function kept(key: string, make: () => string) {
  if (seen.size >= 12) seen.clear()
  const made = seen.get(key) ?? make()
  seen.set(key, made)
  return made
}

// From the right of the room: the widest board and the screen stand there, so the rocket never flies over them.
const TOWER_RIGHT = 384
const TOWER_Y = 18
// The rocket's corner from the tower's: its axis falls on the pad's.
const ROCKET_DX = 28
const ROCKET_Y = 34
const ROCKET_W = 96
// How far down the moving drawing reaches: the cloud around the pad.
const ROCKET_LOW = 216
const towerX = (w: number) => (w - TOWER_RIGHT) & ~1

const text = (make: () => string) => {
  let made = ''
  return () => (made ||= make())
}
const tourArt = text(() => paths(tour()))

function backOf(seed: number, w: number, h: number, leger: boolean) {
  const { scene, nuit, sol } = drawOf(seed)
  const cells = Math.ceil(w / PX)
  const land = kept(`${scene.loin} ${cells} ${leger}`, () => paths(horizon(scene, nuit, cells, leger)))
  const skyline = SCENE_H * PX
  return {
    defs: `${pattern('ciel', ciel(scene))}${pattern('sol', sol[leger ? 1 : 0]())}<pattern id="plots" width="4" height="8" patternUnits="userSpaceOnUse">${paths(plots())}</pattern>`,
    body: `<rect width="${w}" height="${skyline}" fill="url(#ciel)"/><g transform="scale(${PX})">${land}</g><rect y="${skyline}" width="${w}" height="${h - skyline}" fill="url(#sol)"/><g transform="translate(${towerX(w)} ${TOWER_Y}) scale(${PX})">${tourArt()}</g>`,
  }
}

// The whole flight, from the moment the engine lights, in seconds of a cycle.
const CYCLE = 210
const LIFT = 4
const CLOUD_OUT = 12
const GONE = 18
const BACK = 32
const DUST = 38
const TOUCH = 46
const SWAP = 50
const REST = 52
const pct = (s: number) => `${Math.round((s / CYCLE) * 100000) / 1000}%`
/** Where the rocket stands at these seconds, and how many whole steps it takes to the next. */
const FLIGHT: readonly (readonly [s: number, y: number, steps: number])[] = [[0, 0, 1], [LIFT, 0, 8], [8, -16, 24], [12, -64, 48], [16, -160, 50], [GONE, -260, 1], [BACK, -260, 45], [34, -170, 50], [DUST, -70, 27], [42, -16, 8], [TOUCH, 0, 1]]
const shows = (name: string, ...turns: readonly (readonly [s: number, on: 0 | 1])[]) => `@keyframes ${name}{${turns.map(([s, on]) => `${pct(s)}{opacity:${on}}`).join('')}100%{opacity:${turns[turns.length - 1]![1]}}}`
const IMAGE_S = 0.14

const flightStyle = text(() => {
  const each = (['fz', 'fb', 'fr', 'fv', 'fd', 'fe', 'fn', 'fo'] as const).map(n => `.${n}{animation-name:${n}}`).join('')
  const moves = FLIGHT.map(([s, y, steps]) => `${pct(s)}{transform:translateY(${y}px);animation-timing-function:steps(${steps})}`).join('')
  const turns = [shows('fb', [0, 1], [GONE, 0], [SWAP, 1]), shows('fr', [0, 0], [BACK, 1], [SWAP, 0]), shows('fv', [0, 0], [REST, 1]), shows('fd', [0, 1], [GONE, 0]), shows('fe', [0, 0], [BACK, 1], [TOUCH, 0]), shows('fn', [0, 1], [CLOUD_OUT, 0]), shows('fo', [0, 0], [DUST, 1], [REST, 0])].join('')
  const images = `.fi{animation:fi ${Math.round(IMAGE_S * 3 * 100) / 100}s steps(1) infinite}.fi1{animation-delay:-${IMAGE_S}s}.fi2{animation-delay:-${Math.round(IMAGE_S * 2 * 100) / 100}s}.fh{animation:fh .56s steps(1) infinite}@keyframes fi{0%{opacity:1}33.4%,100%{opacity:0}}@keyframes fh{0%{opacity:1}50%,100%{opacity:0}}`
  return `.fu{animation-duration:${CYCLE}s;animation-iteration-count:infinite;animation-timing-function:steps(1)}.fr,.fd,.fe,.fn,.fo{opacity:0}${each}@keyframes fz{${moves}100%{transform:translateY(0)}}${turns}${images}@media (prefers-reduced-motion: reduce){.fu,.fi,.fh{animation:none!important}}`
})

const images = (draw: (i: number) => Canvas, n: number) => Array.from({ length: n }, (_, i) => `<g class="fi fi${i}">${paths(draw(i))}</g>`).join('')
const puffs = (draw: (i: number) => Canvas) => `<g class="fh">${paths(draw(0))}</g><g class="fh" style="animation-delay:-.28s">${paths(draw(1))}</g>`

const flightBody = text(() => {
  const ground = `<g class="fu fn">${puffs(i => nuage('decollage', i))}</g><g class="fu fo">${puffs(i => nuage('retour', i))}</g>`
  const flying = `<g class="fu fv">${paths(vapeur())}</g><g class="fu fd">${images(i => jet('decollage', i), 3)}</g><g class="fu fe">${images(i => jet('retour', i), 3)}</g><g class="fu fb">${paths(fusee('pas'))}</g><g class="fu fr">${paths(fusee('retour'))}</g>`
  return `<g class="fu fz">${flying}</g>${ground}`
})

/** The rocket on its pad, away and back, on a slow cycle: only the hour of the launch changes from a room to the next. */
function rocket(seed: number, w: number): Moving {
  const x = towerX(w) + ROCKET_DX
  return {
    key: 'fusee',
    box: { x, y: 0, w: ROCKET_W, h: ROCKET_LOW },
    style: `${flightStyle()}.fu{animation-delay:-${seed % CYCLE}s}`,
    body: `<g transform="translate(${x} ${ROCKET_Y}) scale(${PX})">${flightBody()}</g>`,
    alt: 'sky',
  }
}

const TELE: Tele = { draw: once(console_), dx: 0, dy: 0, digits: { cx: 36, y: 10, size: 24, ink: '#EDFFF5' }, label: { y: 30, size: 12, ink: '#80E0C7' } }
const PLAQUE: Plaque = { draw: once(plaque), dx: 0, dy: -26, cost: { cx: 36, y: 7, size: 12, ink: '#FFC857' } }
const BOARD: Board = { art: (w, h) => scaled(tableau(w, h)), title: '#22252E', paper: '#FFF6DE', glow: '#FFDF8F', inks: { completed: '#6E7480', in_progress: '#1B1730', pending: '#323641' } }

const vif = (level: string) => level === 'low' || level === 'embers'
const NIVEAUX = { none: 0, small: 1, medium: 2, large: 3, full: 4 } as const
// The last segment of a full gauge blinks, on the image that holds the slag.
const BLINK = '<style>.vb{animation:vb 1s steps(1) infinite}@keyframes vb{50%{opacity:0}}@media (prefers-reduced-motion: reduce){.vb{animation:none}}</style>'
const jauge = (level: keyof typeof NIVEAUX) => {
  const lit = paths(voyant(NIVEAUX[level]))
  return `<g transform="translate(0 ${-ASH_TOP})">${lit}${level === 'full' ? `${BLINK}<path class="vb" fill="#FFFFFF" d="M42 33h3v3h-3z"/>` : ''}</g>`
}

export const base: Pack = {
  id: 'base',
  backdrop: (seed, w, h, detail) => backOf(seed, w, h, detail > 0),
  rug(seed, w, h) {
    if (!pick(seed, 4, 4)) return null
    return `${paths(dalle(w, h))}<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="url(#plots)"/>${paths(bords(w, h))}`
  },
  light: null,
  wall: {
    end: w => towerX(w) / PX + 3,
    picks: [
      ['parabole', 'hangar', 'dome'],
      ['reservoirs', 'pylone', 'ballon'],
      ['dome', 'hangar', 'parabole', 'ballon', null],
      ['pylone', 'ballon', null],
    ],
    items: {
      parabole: { draw: once(parabole), y: 22 },
      reservoirs: { draw: once(reservoirs), y: 42 },
      dome: { draw: once(dome), y: 40 },
      pylone: { draw: once(pylone), y: 17 },
      ballon: { draw: once(ballon), y: 2 },
      hangar: { draw: once(hangar), y: 42 },
    },
  },
  floor: {
    slots: [
      // Left of the pad: only where the tower leaves the room for it.
      { x: 52, up: 99, w: 72, items: ['rover', 'sonde', 'scaphandre', 'telescope'], minW: 318 },
      { x: 52, up: 99, w: 60, items: ['sonde', 'telescope', 'scaphandre', 'caisses'], minW: 300 },
      // Past the console's foot: nothing may hide its desk.
      { right: 74, up: 99, w: 72, items: ['generateur', 'rover', 'telescope', 'sonde'] },
      { right: 58, up: 70, w: 52, items: ['telescope', 'sonde', 'caisses', null], front: true },
      { x: 10, up: 26, w: 34, items: ['scaphandre', 'caisses', null], front: true },
      { right: 58, up: 22, w: 52, items: ['caisses', 'generateur', 'scaphandre', 'sonde', null], front: true },
      { right: 118, up: 8, w: 44, items: ['telescope', 'sonde', null], front: true },
    ],
    items: {
      rover: once(rover),
      sonde: once(sonde),
      caisses: once(caisses),
      scaphandre: once(scaphandre),
      telescope: once(telescope),
      generateur: once(generateur),
    },
  },
  seat: { chair: once(chaise), desk: paillasse, person: tenue => scientifique(person(tenue), tenue) },
  tele: TELE,
  plaque: PLAQUE,
  board: BOARD,
  hearth: {
    w: 96,
    feet: 122,
    body: () => `${paths(reacteur())}${paths(voyant(0))}`,
    front: () => paths(hublot()),
    flames: (level, frame) => flammeReacteur(spriteBody(fire(level, frame)), vif(level)),
    frames: fireFrames,
    ash: (level, frame) => `${jauge(level)}${scories(spriteBody(ash(level, frame)))}`,
    ashTop: ASH_TOP,
    fireArea: { x: 11, y: 33, w: 26, h: 31 },
    deposit: STOVE_DEPOSIT,
  },
  basket: capsule,
  moving: (seed, w) => [rocket(seed, w)],
}
