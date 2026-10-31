import { canvas, mix, noise, paths } from '../canvas'
import type { Canvas } from '../canvas'
import { fireFrames } from '../hearth'
import { PX, once, pattern, pick } from '../pack'
import type { Art, Backdrop, Board, Hearth, Moving, Pack, Plaque, Tele } from '../pack'
import { ACIER, AMBRE, COQUE, CYAN, MAGENTA, VIOLET, aire, banquette, bureau, capsule, chaise, disc, droide, droneCamera, droneLivreur, gardeCorps, lanterne, moto, navette, noyauAvant, noyauFeu, noyauSprite, panier, panneauDonnees, plante, plaque, relais, residu, solCoque, solGrille, solLames, sphereDonnees, tableHolo, tableau, tele, vaisseau, voiture } from './futuriste-art'

type C = Canvas
const SKY_H = 80
// The sky repeats on this many cells; what must not repeat, a sun or a planet, is drawn apart.
const TILE = 320
// The glass, the rail and the deck, in pixels of the room.
const GLASS_Y = 102
const RAIL_Y = 150
const FLOOR_Y = 160

/** A frequency close to `f` that closes on the tile, so the sky repeats with no seam. `half`: for an |sin|. */
const closed = (f: number, half = false) => {
  const unit = (half ? Math.PI : 2 * Math.PI) / TILE
  return Math.round(f / unit) * unit
}

/** A sky of bands, the steps between them dithered: two cells wide, it weighs nothing. */
function degrade(bandes: readonly string[], fin: number) {
  const c = canvas(2, SKY_H)
  for (let y = 0; y < SKY_H; y += 1) for (let x = 0; x < 2; x += 1) {
    const t = Math.min(bandes.length - 1.001, (y / fin) * (bandes.length - 1))
    const k = Math.floor(t)
    const f = t - k
    c.set(x, y, f > 0.72 || (f > 0.44 && (x + y) % 2 === 0) ? bandes[k + 1]! : bandes[k]!)
  }
  return c
}

function tour(c: C, x: number, w: number, top: number, col: string, fen: readonly string[], p: number, seed: number) {
  c.rect(x, top, w, SKY_H - top, col)
  c.rect(x, top, 1, SKY_H - top, mix(col, '#B0A0F0', 0.25))
  c.rect(x + w - 1, top, 1, SKY_H - top, mix(col, '#05050F', 0.3))
  if (fen.length) for (let wy = top + 2; wy < SKY_H; wy += 2) for (let wx = x + 2; wx < x + w - 2; wx += 2) if (noise(wx + seed, wy) < p) c.set(wx, wy, fen[Math.floor(noise(wx, wy + seed) * fen.length)]!)
}

/** The neon night: towers up to the horizon. `lean`: their shapes only. */
function nuit(lean: boolean) {
  const [W, H] = [TILE, SKY_H]
  const c = canvas(W, H)
  if (!lean) for (let i = 0; i < 90; i += 1) c.set(Math.floor(noise(i, 1) * W), Math.floor(noise(i, 2) * 34), i % 6 ? '#C8CCF8' : CYAN[4])
  disc(c, 250, 22, 15, 15, (x, y, d) => (lean || d > 0.84 ? MAGENTA[4] : noise(x * 2, y) > 0.86 ? MAGENTA[3] : y < 22 ? MAGENTA[5] : MAGENTA[4]))
  if (!lean) for (let x = 228; x < 272; x += 1) {
    c.set(x, 22 + Math.round((x - 250) * 0.16), VIOLET[4])
    if (x % 2) c.set(x, 23 + Math.round((x - 250) * 0.16), VIOLET[3])
  }
  let x = 0
  for (let i = 0; x < W; i += 1) {
    const w = 8 + Math.floor(noise(i, 11) * 9)
    tour(c, x, Math.min(w, W - x), 34 + Math.floor(noise(i, 12) * 26), '#33206E', lean ? [] : [VIOLET[3], '#6E5AC0'], 0.26, 3)
    x += w
  }
  x = 3
  for (let i = 0; x < W; i += 1) {
    const w = 10 + Math.floor(noise(i, 13) * 12)
    const top = 30 + Math.floor(noise(i, 14) * 32)
    const v = Math.min(w, W - x)
    tour(c, x, v, top, '#1C1248', lean ? [] : [CYAN[3], CYAN[4], MAGENTA[3], AMBRE[3]], 0.3, 7)
    if (i % 3 === 0) c.rect(x + 2, top + 3, 2, H - top - 3, i % 2 ? MAGENTA[3] : CYAN[3])
    if (i % 4 === 1) {
      c.rect(x + Math.floor(v / 2), top - 7, 1, 7, '#1C1248')
      c.set(x + Math.floor(v / 2), top - 8, '#FF5A6E')
    }
    x += w + (i % 3 === 2 ? 3 : 0)
  }
  for (const [tx, w, top] of [[48, 16, 16], [150, 18, 10], [222, 14, 24], [292, 16, 18]] as const) {
    tour(c, tx, w, top, '#100C30', lean ? [] : [CYAN[4], CYAN[5], MAGENTA[4]], 0.4, tx)
    c.rect(tx + 3, top - 3, w - 6, 3, '#100C30')
    c.rect(tx + Math.floor(w / 2), top - 10, 1, 7, '#100C30')
    c.set(tx + Math.floor(w / 2), top - 11, '#FF5A6E')
    c.rect(tx - 1, top + 6, w + 2, 1, MAGENTA[3])
    c.rect(tx - 1, top + 20, w + 2, 1, CYAN[3])
    c.rect(tx + w, top + 12, 7, 14, AMBRE[2])
    c.rect(tx + w, top + 12, 7, 1, AMBRE[4])
    if (!lean) for (const [dy, l] of [[15, 5], [18, 3], [21, 4]] as const) c.rect(tx + w + 1, top + dy, l, 1, AMBRE[0])
  }
  if (!lean) for (const [y, col, pas] of [[54, AMBRE[3], 5], [60, '#FF5A6E', 8], [66, CYAN[4], 4]] as const) for (let i = 0; i < W; i += pas) c.rect(i, y, 2, 1, col)
  const [f, g] = [closed(0.09), closed(0.23)]
  for (let px = 0; px < W; px += 1) {
    const h = Math.round(5 + 2 * Math.sin(px * f) + 1.5 * Math.sin(px * g))
    c.rect(px, H - h, 1, h, '#7A2C88')
    c.set(px, H - h, '#B84A98')
  }
  return c
}

/** The sun of the dawn, alone: a wide room must not rise two. */
function soleil() {
  const c = canvas(53, 53)
  disc(c, 26, 26, 26, 26, '#FFD77C|0.3')
  disc(c, 26, 26, 20, 20, (_, __, d) => (d > 0.8 ? AMBRE[3] : AMBRE[4]))
  disc(c, 26, 26, 13, 13, '#FFFCE8')
  return c
}

/** The golden dawn over a sea of clouds. */
function aube(lean: boolean) {
  const [W, H] = [TILE, SKY_H]
  const c = canvas(W, H)
  if (!lean) {
    for (let i = 0; i < 26; i += 1) c.set(Math.floor(noise(i, 1) * W), Math.floor(noise(i, 2) * 16), '#E8E0FF')
    const [f, g] = [closed(0.05), closed(0.033)]
    for (let i = 0; i < 5; i += 1) for (let px = 0; px < W; px += 1) {
      const y = 14 + i * 9 + Math.round(1.6 * Math.sin(px * f + i * 2))
      if (Math.sin(px * g + i * 1.7) > 0.45) {
        c.set(px, y, '#FFD8A8')
        if (px % 3) c.set(px, y + 1, '#F4AE90')
      }
    }
  }
  for (const [tx, w, top, col] of [[176, 10, 26, '#5A4A98'], [190, 6, 38, '#6A58A4'], [40, 7, 36, '#6A58A4'], [262, 12, 18, '#4E4490'], [280, 7, 34, '#6A58A4'], [150, 6, 42, '#7A64AC']] as const) {
    for (let y = top; y < H; y += 1) {
      const hw = Math.min(w / 2, 1 + (y - top) * 0.24)
      c.rect(Math.round(tx - hw), y, Math.round(hw * 2), 1, col)
      if (!lean) c.set(Math.round(tx - hw), y, AMBRE[3])
    }
    c.rect(tx, top - 7, 1, 7, col)
    c.set(tx, top - 8, '#FFF0C0')
    if (!lean) for (let y = top + 6; y < H; y += 6) c.rect(tx - 1, y, 2, 1, AMBRE[4])
  }
  const nuage = (base: number, amp: number, f: number, a: string, b: string, d: string, s: number) => {
    const [f1, f2, f3] = [closed(f, true), closed(f * 2.3, true), closed(f * 5.1, true)]
    for (let px = 0; px < W; px += 1) {
      const h = base + amp * Math.abs(Math.sin(px * f1 + s)) + amp * 0.5 * Math.abs(Math.sin(px * f2 + s * 2)) + 1.5 * Math.abs(Math.sin(px * f3))
      const top = Math.round(H - h)
      c.rect(px, top, 1, H - top, b)
      c.rect(px, top, 1, 2, a)
      if (px % 2 && !lean) c.set(px, top + 3, d)
    }
  }
  if (!lean) nuage(14, 5, 0.05, '#FFD8B8', '#E8A0A0', '#D88CA0', 1)
  nuage(8, 5, 0.07, '#FFF0D0', '#F4B8A0', '#E4A0A0', 3)
  if (!lean) nuage(2, 5, 0.1, '#FFFBEE', '#FFD8BC', '#F4C0AC', 5)
  return c
}

/** Orbit: the planet under the deck. It curves across the whole room, so it is drawn at the room's width. */
function orbite(width: number, lean: boolean) {
  const W = Math.ceil(width / PX)
  const R = Math.max(TILE, W)
  const H = SKY_H
  const c = canvas(W, H)
  if (!lean) for (let y = 0; y < 60; y += 1) for (let x = 0; x < W; x += 1) {
    const n = Math.sin(x * 0.024 + 1) + Math.sin(x * 0.07 + y * 0.09) + Math.sin(y * 0.11 - x * 0.03)
    if (n > 1.5) c.set(x, y, n > 2.2 ? '#2A1660' : '#180E3C')
    else if (n < -1.8) c.set(x, y, '#0A1830')
  }
  const many = (n: number) => (Math.round((n * R) / TILE) * (lean ? 1 : 4)) / 4
  for (let i = 0; i < many(320); i += 1) {
    const [x, y] = [Math.floor(noise(i, 1) * R), Math.floor(noise(i, 2) * 62)]
    c.set(x, y, i % 9 === 0 ? CYAN[5] : i % 5 === 0 ? MAGENTA[4] : i % 2 ? '#8A90C0' : '#5A6090')
  }
  for (let i = 0; i < many(16); i += 1) {
    const [x, y] = [Math.floor(noise(i, 3) * R), Math.floor(noise(i, 4) * 50)]
    c.rect(x - 1, y, 3, 1, '#E8ECFF')
    c.rect(x, y - 1, 1, 3, '#E8ECFF')
  }
  disc(c, 268, 20, 11, 11, (x, y) => {
    const l = (x - 268) * -0.7 + (y - 20) * -0.7
    return l > 5 ? '#C8C8E0' : l > -2 ? '#8A8AB0' : l > -7 ? '#4A4A70' : '#26263E'
  })
  for (const [x, y, r] of [[264, 17, 2], [270, 24, 3], [273, 15, 1.5]] as const) disc(c, x, y, r, r, '#5A5A84')
  const [cx, cy, rx, ry] = [(130 * R) / TILE, 160, (340 * R) / TILE, 108]
  const dusk = (190 * R) / TILE
  for (let y = 40; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    if (d > 1.05) continue
    if (d > 1) {
      c.set(x, y, d > 1.03 ? '#14406E' : '#3C9CE0')
      continue
    }
    if (d > 0.975) {
      c.set(x, y, '#BEEFFF')
      continue
    }
    const n = Math.sin(x * 0.04 + y * 0.5) + Math.sin(x * 0.11 - y * 0.3) + 0.6 * Math.sin(x * 0.23 + y * 0.9)
    const dark = Math.max(0, (x - dusk) / ((130 * R) / TILE))
    const land = n > 1 ? '#E8F4FF' : n > 0.1 ? '#2E7EC0' : n > -0.9 ? '#1E5EA0' : '#2C8A62'
    // In a few steps, as each colour is a path of its own.
    const night = Math.ceil(Math.min(0.92, dark * 1.3) * 5) / 5
    if (lean) c.set(x, y, mix('#1E5EA0', '#060A20', night))
    else c.set(x, y, dark > 0.5 && noise(x, y) > 0.92 ? AMBRE[3] : mix(land, '#060A20', night))
  }
  disc(c, 62, 24, 15, 5.5, (_, y, d) => (d > 0.62 ? (y < 24 ? COQUE[1] : COQUE[3]) : null))
  c.rect(60, 18, 4, 12, COQUE[2])
  c.rect(60, 18, 1, 12, COQUE[0])
  for (const x of [46, 76]) c.set(x, 24, AMBRE[3])
  c.rect(52, 23, 20, 1, ACIER[5])
  return c
}

/** One pixel high, a run is half the characters as a stroke: a sky is mostly lit windows and stars. */
const thin = (svg: string) => svg.replace(/<path fill="(#\w+)"(?: fill-opacity="([\d.]+)")? d="([^"]*)"\/>/g, (_, fill: string, alpha: string | undefined, d: string) => {
  let strokes = ''
  const blocks = d.replace(/M(\d+) (\d+)h(\d+)v1h-\3/g, (_, x: string, y: string, w: string) => {
    strokes += `M${x} ${y}h${w}`
    return ''
  })
  const shade = alpha ? ` opacity="${alpha}"` : ''
  return `${blocks ? `<path fill="${fill}"${shade} d="${blocks}"/>` : ''}${strokes ? `<path fill="none" stroke="${fill}"${shade} transform="translate(0 .5)" d="${strokes}"/>` : ''}`
})
const tile = (id: string, c: C) => `<pattern id="${id}" width="${c.w * PX}" height="${c.h * PX}" patternUnits="userSpaceOnUse"><g transform="scale(${PX})">${thin(paths(c))}</g></pattern>`
const skyRect = (w: number, fill: string) => `<rect width="${w}" height="${RAIL_Y}" fill="${fill}"/>`
const inCells = (c: C, x = 0, y = 0) => `<g transform="translate(${x * PX} ${y * PX}) scale(${PX})">${thin(paths(c))}</g>`
const both = <T>(make: (lean: boolean) => T) => {
  const made = new Map<boolean, T>()
  return (lean: boolean) => {
    if (!made.has(lean)) made.set(lean, make(lean))
    return made.get(lean)!
  }
}

const nightTile = both(lean => tile('vue', nuit(lean)))
const nightSky = once(() => degrade(['#080822', '#10103A', '#1E1458', '#3A1A78', '#6E2288', '#B0348C', '#E85A8C'], 74))
const dawnTile = both(lean => tile('vue', aube(lean)))
const dawnSky = once(() => degrade(['#2A2E78', '#46408E', '#7A4E98', '#C06088', '#F08E60', '#FFC468', '#FFE9A8'], 64))
const dawnSun = once(soleil)
const orbits = new Map<string, string>()

/** `y`: in pixels of the room. `speed`: in pixels a second. */
type Flyer = { frames: () => readonly C[]; y: number; speed: number }
const CAR = { frames: () => [voiture(0), voiture(1), voiture(2)], speed: 34 }
const SHUTTLE = { frames: () => [navette(0), navette(1)], speed: 20 }
const CARGO = { frames: () => [vaisseau(0), vaisseau(1)], speed: 12 }

/** A sky, the deck under it, the line between them and what flies there, as in the design: they come together. */
type Scene = { sky: (w: number, lean: boolean) => Backdrop; floor: (lean: boolean) => C; line: string; fleet: readonly Flyer[] }
const SCENES: readonly Scene[] = [
  {
    sky: (w, lean) => ({ defs: pattern('ciel', nightSky()) + nightTile(lean), body: skyRect(w, 'url(#ciel)') + skyRect(w, 'url(#vue)') }),
    floor: both(solCoque),
    line: CYAN[3],
    fleet: [{ ...CARGO, y: 14 }, { ...SHUTTLE, y: 46 }, { ...CAR, y: 60 }],
  },
  {
    sky: (w, lean) => ({ defs: pattern('ciel', dawnSky()) + dawnTile(lean), body: `${skyRect(w, 'url(#ciel)')}${inCells(dawnSun(), 70, 26)}${skyRect(w, 'url(#vue)')}` }),
    floor: both(solLames),
    line: AMBRE[2],
    fleet: [{ ...SHUTTLE, y: 22 }, { ...CAR, y: 60 }],
  },
  {
    sky: (w, lean) => {
      const key = `${w} ${lean}`
      if (!orbits.has(key)) orbits.set(key, inCells(orbite(w, lean)))
      return { defs: '', body: skyRect(w, '#05060F') + orbits.get(key)! }
    },
    floor: both(solGrille),
    line: VIOLET[2],
    fleet: [{ ...CAR, y: 58 }],
  },
]
const sceneOf = (seed: number) => SCENES[pick(seed, 2, SCENES.length)]!

/** What all the images of a craft share, then what each adds: they differ by a few pixels. */
function split(frames: readonly C[]) {
  const { w, h } = frames[0]!
  const shared = canvas(w, h)
  const own = frames.map(() => canvas(w, h))
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const all = frames.map(f => f.get(x, y))
    if (all.every(p => p === all[0])) shared.set(x, y, all[0]!)
    else all.forEach((p, i) => own[i]!.set(x, y, p))
  }
  return { shared: paths(shared), own: own.map(c => paths(c)) }
}

// The widest plan and the screen beside it: the sky ends there, whatever the plan, so a plan never moves the band.
const SCREENS = 258
const FLY_SHARE = 0.6
const BLINK_S = 0.2

/** Craft cross the sky from the left and jump away before the screen. They end above the glass, which they pass behind. */
function fleet(seed: number, w: number): Moving[] {
  const flyers = sceneOf(seed).fleet
  const top = Math.min(...flyers.map(f => f.y))
  const box = { x: 0, y: top, w: w - SCREENS, h: GLASS_Y - top }
  let style = ''
  const body = flyers.map((f, i) => {
    const frames = f.frames()
    const wide = frames[0]!.w * PX
    const steps = Math.floor(box.w / PX)
    const [from, to] = [-wide, steps * PX - wide]
    const cycle = Math.round((to - from) / f.speed / FLY_SHARE)
    const fly = (x: number) => `transform:translateX(${x}px)`
    style += `.v${i}{animation:v${i} ${cycle}s linear infinite;animation-delay:-${Math.round((pick(seed, 7 + i, 100) * cycle) / 100)}s}@keyframes v${i}{0%{${fly(from)};opacity:1;animation-timing-function:steps(${steps})}${FLY_SHARE * 100}%{${fly(to)};opacity:1;animation-timing-function:steps(3)}${FLY_SHARE * 100 + 3}%,100%{${fly(to)};opacity:0}}`
    const { shared, own } = split(frames)
    const beat = own.map((d, k) => `<g class="vi" style="animation:vi${own.length} ${own.length * BLINK_S}s steps(1) infinite;animation-delay:${(k - own.length) * BLINK_S}s">${d}</g>`).join('')
    return `<g class="v${i}"><g transform="translate(0 ${f.y}) scale(${PX})">${shared}<g>${beat}</g></g></g>`
  }).join('')
  const blink = [2, 3].map(n => `@keyframes vi${n}{0%{opacity:1}${Math.round(100 / n)}%,100%{opacity:0}}`).join('')
  // Parked for good, they would stand in front of what hangs in the sky: a still room has none.
  const still = `@media (prefers-reduced-motion: reduce){${flyers.map((_, i) => `.v${i}`).join(',')}{animation:none;opacity:0}}`
  return [{ key: 'ciel', box, style: `${style}${blink}${still}`, body, alt: 'sky' }]
}

const glass = once(gardeCorps)
const drawn = new Map<string, string>()
const look = (key: string, draw: () => Canvas) => {
  if (!drawn.has(key)) drawn.set(key, paths(draw()))
  return drawn.get(key)!
}

const noyau: Hearth = {
  w: 96,
  feet: 130,
  body: () => look('noyau', noyauSprite),
  front: () => look('avant', noyauAvant),
  flames: (level, frame) => look(`feu ${level} ${frame}`, () => noyauFeu(level, frame)),
  frames: fireFrames,
  ash: (level, frame) => look(`residu ${level} ${frame}`, () => residu(level, frame)),
  ashTop: 48,
  // The plasma's glow reaches past the core's window, down to the base.
  fireArea: { x: 6, y: 24, w: 36, h: 42 },
  deposit: { x: 38, y: 48 },
}

const TELE: Tele = { draw: once(tele), dx: 0, dy: 0, digits: { cx: 36, y: 12, size: 24, ink: CYAN[5] }, label: { y: 32, size: 12, ink: CYAN[4] } }
const PLAQUE: Plaque = { draw: once(plaque), dx: 0, dy: -26, cost: { cx: 36, y: 7, size: 12, ink: AMBRE[3] } }
const BOARD: Board = { art: (w, h) => paths(tableau(w, h)), title: CYAN[5], paper: '#0A2230', glow: '#14606E', inks: { completed: '#6AB8BE', in_progress: '#FFFFFF', pending: '#C8E8EC' } }

const each = (all: Record<string, Art>) => Object.fromEntries(Object.entries(all).map(([id, draw]) => [id, once(draw)]))

export const futuriste: Pack = {
  id: 'futuriste',
  backdrop(seed, w, h, detail) {
    const scene = sceneOf(seed)
    const lean = detail > 0
    const view = scene.sky(w, lean)
    const defs = `${view.defs}${pattern('verre', glass())}${pattern('sol', scene.floor(lean))}`
    const band = (y: number, height: number, fill: string) => `<rect y="${y}" width="${w}" height="${height}" fill="${fill}"/>`
    const rail = `${band(RAIL_Y, 6, ACIER[2])}${band(RAIL_Y, 2, ACIER[5])}${band(RAIL_Y + 6, 2, scene.line)}${band(RAIL_Y + 8, 2, ACIER[0])}`
    const shade = `<rect y="${FLOOR_Y}" width="${w}" height="8" fill="#0A0818" fill-opacity=".34"/>`
    return { defs, body: `${view.body}<g transform="translate(0 ${GLASS_Y})"><rect width="${w}" height="48" fill="url(#verre)"/></g>${rail}<g transform="translate(0 ${FLOOR_Y})"><rect width="${w}" height="${h - FLOOR_Y}" fill="url(#sol)"/></g>${shade}` }
  },
  rug(seed, w, h, detail) {
    return pick(seed, 3, 3) ? look(`aire ${w} ${h} ${detail > 0}`, () => aire(w, h, detail > 0)) : null
  },
  light: null,
  wall: {
    picks: [
      ['sphereDonnees', 'panneauDonnees', 'lanterne'],
      ['relais', 'lanterne', null],
      ['panneauDonnees', 'relais', 'sphereDonnees', null],
    ],
    items: {
      sphereDonnees: { draw: once(sphereDonnees), y: 5 },
      panneauDonnees: { draw: once(panneauDonnees), y: 11 },
      lanterne: { draw: once(lanterne), y: 13 },
      relais: { draw: once(relais), y: 8 },
    },
  },
  floor: {
    slots: [
      { x: 2, up: 121, w: 44, items: ['capsule', 'droneLivreur'] },
      { x: 50, up: 118, w: 50, items: ['plante', 'capsule', 'droneLivreur'] },
      { x: 106, up: 112, w: 90, items: ['moto', 'tableHolo', null], minW: 300 },
      { right: 96, up: 114, w: 92, items: ['banquette', 'moto', 'tableHolo'] },
      { right: 46, up: 14, w: 40, items: ['droide'], front: true },
      { x: 6, up: 30, w: 48, items: ['droneLivreur', 'droneCamera', null], front: true },
      { right: 40, up: 82, w: 32, items: ['droneCamera', null], front: true },
    ],
    items: each({ capsule, plante, moto, tableHolo, banquette, droide, droneLivreur: () => droneLivreur(0), droneCamera: () => droneCamera(0) }),
  },
  seat: { chair: once(chaise), desk: bureau },
  tele: TELE,
  plaque: PLAQUE,
  board: BOARD,
  hearth: noyau,
  basket: panier,
  moving: (seed, w) => fleet(seed, w),
}
