import { t } from '../../i18n'
import { canvas, noise } from '../canvas'
import type { Canvas } from '../canvas'
import { fit, textWidth } from '../font'
import type { Point } from '../hearth'
import { WORLD, once, pattern, pick, scaled } from '../pack'
import type { Art, MapPack, MapRoom, MapView } from '../pack'
import { TENUES, person } from '../sprites'
import type { DeskState, Tenue } from '../sprites'
import { def, line, use } from '../text'
import { bureau, flammesFeu, foyer, tente } from './nature-art'

type C = Canvas
type Ink = string | ((x: number, y: number, d: number) => string | null)
type Pair = readonly [number, number]
/** A stretch of trail, in cells: from, to, and the point it bends towards. */
type Bend = readonly [Pair, Pair, Pair]

const INK = '#2A2036'
const SH = '#1B1730|0.28'
const CR = '#F4E4C1'
const PAP = '#FFF6DE'
const NIGHT = '#1B1730'
const BANNER = 0.72
const RIVER = ['#1E4E58', '#3E8A8E'] as const
const B = ['#241810', '#38261A', '#523824', '#6E4E32', '#8E6C46', '#B08E60', '#D2B484'] as const
const E = ['#1C1712', '#2C241C', '#3E3226', '#54463A', '#6E5E4E'] as const
const M = ['#1A3024', '#24432E', '#325A38', '#467442', '#64904C', '#8EB058', '#BCD078'] as const
const R = ['#3A3C3E', '#54585A', '#74787A', '#989C9A'] as const
const TOP = ['#12281E', '#183424', '#1E402A', '#264E30', '#2E5C36'] as const

/** The drawings place pixels between cells: every canvas here lands them on the nearest one. */
function grid(w: number, h: number): C {
  const c = canvas(w, h)
  const set = c.set
  c.set = (x, y, p) => set(Math.round(x), Math.round(y), p)
  return c
}
const box = (c: C, x: number, y: number, w: number, h: number, base: string, lit: string, dark: string) => {
  c.rect(x, y, w, h, base)
  c.rect(x, y, w, 1, lit)
  c.rect(x, y, 1, h, lit)
  c.rect(x + w - 1, y, 1, h, dark)
  c.rect(x, y + h - 1, w, 1, dark)
}
const disc = (c: C, cx: number, cy: number, rx: number, ry: number, paint: Ink) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d > 1) continue
      const p = typeof paint === 'string' ? paint : paint(x, y, d)
      if (p) c.set(x, y, p)
    }
  }
}
/** A tree top from above, in three tones: a forest of them has to stay light. */
const cime = (put: (x: number, y: number, p: string) => void, cx: number, cy: number, r: number) => {
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if ((x * x + y * y) / (r * r) > 1) continue
      put(cx + x, cy + y, x + y < -r * 0.7 ? TOP[3] : x + y > r * 0.6 ? TOP[1] : TOP[2])
    }
  }
}

function canopee() {
  const [w, h] = [60, 48]
  const c = grid(w, h)
  const put = (x: number, y: number, p: string) => c.set(((x % w) + w) % w, ((y % h) + h) % h, p)
  c.rect(0, 0, w, h, TOP[0])
  for (let j = 0; j < 4; j += 1) {
    for (let i = 0; i < 5; i += 1) cime(put, i * 12 + (j % 2 ? 6 : 0) + Math.floor(noise(i, j) * 3), j * 12 + Math.floor(noise(j, i + 9) * 3), 7 + Math.floor(noise(i + 3, j) * 2))
  }
  return c
}
/** A trail as dashes along a curve. Past eight camps it loses its shadow to stay light. */
function sentier(c: C, [[x0, y0], [x1, y1], [mx, my]]: Bend, pas: number, ombre: boolean) {
  let [px, py, reste] = [x0, y0, 0]
  for (let i = 1; i <= 240; i += 1) {
    const u = i / 240
    const [x, y] = [(1 - u) ** 2 * x0 + 2 * u * (1 - u) * mx + u * u * x1, (1 - u) ** 2 * y0 + 2 * u * (1 - u) * my + u * u * y1]
    reste += Math.hypot(x - px, y - py)
    px = x
    py = y
    if (reste < pas) continue
    reste = 0
    const [w, h] = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? [4, 2] : [2, 4]
    if (ombre) c.rect(Math.round(x) + 1, Math.round(y) + 1, w, h, TOP[0])
    c.rect(Math.round(x), Math.round(y), w, h, '#A08A62')
  }
}
const across = (c: C, x: number, y: number, glint: boolean) => {
  c.rect(x, y - 2, 24, 12, E[3])
  c.rect(x, y, 24, 8, RIVER[0])
  c.rect(x, y, 24, 1, RIVER[1])
  if (glint) c.rect(x + 8, y + 3, 7, 1, RIVER[1])
}
const down = (c: C, x: number, y: number, glint: boolean) => {
  c.rect(x - 2, y, 12, 24, E[3])
  c.rect(x, y, 8, 24, RIVER[0])
  c.rect(x, y, 1, 24, RIVER[1])
  if (glint) c.rect(x + 3, y + 8, 1, 7, RIVER[1])
}
const WAVE = [0, 2, 4, 2] as const
const STEPS_ACROSS = [118, 120, 122, 120, 118, 120, 122, 124, 122, 120, 118] as const
const STEPS_DOWN: readonly Pair[] = [[250, 124], [254, 148], [258, 172], [254, 196], [250, 220], [254, 244], [258, 268], [254, 292], [250, 316], [254, 340], [258, 364]]
const STEPS_FULL: readonly Pair[] = [[250, 96], [254, 120], [258, 144], [254, 168], [250, 192], [254, 216], [258, 240], [254, 264], [250, 288], [254, 312], [258, 336], [254, 360]]
// Up to four camps the river bars the forest; to eight it turns between the columns; past that it runs down the side.
const rivers = {
  bar(c: C) {
    for (let i = 0; i < 17; i += 1) across(c, i * 24, 184 + WAVE[i % 4 as 0 | 1 | 2 | 3], true)
  },
  bend(c: C) {
    STEPS_ACROSS.forEach((y, i) => across(c, i * 24, y, true))
    STEPS_DOWN.forEach(([x, y]) => down(c, x, y, true))
  },
  side(c: C) {
    for (let i = 0; i < 6; i += 1) across(c, 258 + i * 24, 92, false)
    STEPS_FULL.forEach(([x, y]) => down(c, x, y, false))
  },
}

/** A world for `n` conversations, in cells. `o`: where the big camp's frame stands. `off`: how far its sign drops, in pixels. */
type Plan = { o: Pair; off: number; river: keyof typeof rivers; camps: readonly Pair[]; trails: readonly (readonly Bend[])[]; bridges: readonly Pair[]; small: boolean; bird: Pair }

const CAMPS: readonly Pair[] = [[264, 8], [8, 134], [136, 138], [268, 134], [14, 262], [142, 258], [268, 262]]
const TRAILS: readonly (readonly Bend[])[] = [
  [[[236, 100], [278, 84], [262, 102]]],
  [[[64, 108], [64, 138], [48, 122]]],
  [[[164, 108], [192, 142], [158, 128]]],
  [[[248, 108], [300, 138], [274, 116]]],
  [[[123, 110], [123, 226], [123, 168]], [[123, 226], [76, 266], [122, 252]]],
  [[[131, 110], [131, 232], [131, 170]], [[131, 232], [190, 260], [136, 254]]],
  [[[250, 102], [304, 113], [270, 112]], [[304, 113], [384, 140], [362, 113]], [[384, 140], [384, 232], [384, 186]], [[384, 232], [348, 268], [384, 256]]],
]
const CROSSINGS: readonly (Pair | null)[] = [null, [52, 116], [158, 116], null, [120, 116], [120, 116], null]
// Which camps stand: those left empty keep the others spread over the map.
const CHOSEN: Readonly<Record<number, readonly number[]>> = { 5: [0, 1, 3, 5], 6: [0, 1, 3, 4, 6], 7: [0, 1, 3, 4, 5, 6], 8: [0, 1, 2, 3, 4, 5, 6] }
const CAMPS_SMALL: readonly Pair[] = [[277, 4], [16, 100], [146, 100], [277, 100], [16, 196], [146, 196], [277, 196], [16, 291], [146, 291], [277, 291]]
const CHOSEN_SMALL: Readonly<Record<number, readonly number[]>> = { 9: [0, 1, 2, 3, 4, 6, 7, 9], 10: [0, 1, 2, 3, 4, 6, 7, 8, 9], 11: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
const FEW: Readonly<Record<number, { x: readonly number[]; trails: readonly Bend[]; bridges: readonly number[] }>> = {
  2: { x: [139], trails: [[[196, 130], [196, 212], [170, 170]]], bridges: [180] },
  3: { x: [44, 234], trails: [[[170, 130], [104, 212], [120, 170]], [[222, 130], [286, 212], [270, 170]]], bridges: [110, 264] },
  4: { x: [6, 139, 272], trails: [[[150, 130], [66, 212], [96, 168]], [[196, 130], [196, 212], [170, 170]], [[240, 130], [324, 212], [296, 168]]], bridges: [79, 180, 298] },
}

function trailSmall(i: number): readonly Bend[] {
  if (i === 0) return [[[236, 60], [282, 44], [262, 62]]]
  const [row, col] = [Math.floor((i - 1) / 3), (i - 1) % 3]
  const y = [130, 226, 321][row]!
  const x = [118 + row * 4, 130 + row * 4, 240 + row * 3][col]!
  return [[[x, 96], [x, y], [x, (96 + y) / 2]], [[x, y], [[108, 150, 282][col]!, y + 4], [[114, 146, 262][col]!, y + 4]]]
}

const plans = new Map<number, Plan>()
function planOf(count: number): Plan {
  const n = Math.max(2, Math.min(11, count))
  const made = plans.get(n)
  if (made) return made
  let plan: Plan
  if (n <= 4) {
    const few = FEW[n]!
    plan = { o: [64, 15], off: 0, river: 'bar', camps: few.x.map((x): Pair => [x, 210]), trails: few.trails.map(b => [b]), bridges: few.bridges.map((x): Pair => [x, 182]), small: false, bird: [122, 270] }
  } else if (n <= 8) {
    const at = CHOSEN[n]!
    const bridges = [...new Set(at.map(i => CROSSINGS[i]).filter((b): b is Pair => !!b))]
    plan = { o: [0, 0], off: 0, river: 'bend', camps: at.map(i => CAMPS[i]!), trails: at.map(i => TRAILS[i]!), bridges, small: false, bird: [144, 224] }
  } else {
    const at = CHOSEN_SMALL[n]!
    const bridges = at.filter(i => i > 0 && i % 3 === 0).map((i): Pair => [254, [126, 222, 317][i / 3 - 1]!])
    plan = { o: [0, -18], off: 176, river: 'side', camps: at.map(i => CAMPS_SMALL[i]!), trails: at.map(trailSmall), bridges, small: true, bird: [144, 230] }
  }
  plans.set(n, plan)
  return plan
}

const reliefs = new Map<number, string>()
function relief(n: number) {
  const made = reliefs.get(n)
  if (made) return made
  const plan = planOf(n)
  const c = grid(WORLD.w / 2, WORLD.h / 2)
  rivers[plan.river](c)
  plan.trails.forEach(trail => trail.forEach(bend => sentier(c, bend, plan.small ? 12 : 10, !plan.small)))
  const drawn = scaled(c)
  reliefs.set(n, drawn)
  return drawn
}

function pont() {
  const c = grid(14, 16)
  c.rect(1, 2, 12, 14, SH)
  for (let y = 0; y < 14; y += 3) {
    c.rect(0, y, 13, 2, B[4])
    c.rect(0, y, 13, 1, B[5])
    c.rect(0, y + 2, 13, 1, B[1])
  }
  c.rect(0, 0, 1, 14, B[1])
  c.rect(12, 0, 1, 14, B[1])
  return c
}
/** A clearing from above, closed by its ring of trees. `repos` tips it into the blue of the night. */
function clairiere(w: number, h: number, repos: boolean, bare: boolean) {
  const c = grid(w, h)
  const [cx, cy] = [(w - 1) / 2, (h - 1) / 2]
  const tones = repos ? ['#141E2A', '#18263A', '#1C2C42'] : ['#2E3C24', '#384628', '#46502E']
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const r = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2))
      if (r <= 0.94) c.set(x, y, tones[r < 0.56 ? 2 : r < 0.86 ? 1 : 0]!)
    }
  }
  const tuft = repos ? '#2A3C50' : M[3]
  for (let i = 0; !bare && i < (w * h) / 400; i += 1) {
    const [x, y] = [Math.floor(noise(i, 3) * w), Math.floor(noise(i, 4) * h)]
    if (!c.get(x, y)) continue
    c.set(x, y, tuft)
    c.set(x + 1, y - 1, tuft)
    if (!repos && i % 4 === 0) c.set(x + 2, y, '#F4E070')
  }
  const n = Math.round((w + h) / 13)
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * 6.283 + 0.3
    cime(c.set, Math.round(cx + Math.cos(a) * (w / 2 - 5)), Math.round(cy + Math.sin(a) * (h / 2 - 4)), 6 + (i % 3))
  }
  return c
}
/** The big clearing runs past the top of a full world: what the world does not hold is cut, not drawn. */
function haut(c: C, rows: number) {
  const out = grid(c.w, c.h - rows)
  for (let y = rows; y < c.h; y += 1) for (let x = 0; x < c.w; x += 1) out.set(x, y - rows, c.get(x, y))
  return out
}
function tenteMini(ouverte: boolean) {
  const c = grid(20, 18)
  const W = ouverte ? ['#6E6248', '#8A7E60', '#C8BA94', '#E4D8B4'] as const : ['#3E4654', '#54606E', '#6E7A86', '#8A949E'] as const
  c.rect(2, 15, 18, 3, SH)
  for (let y = 1; y < 16; y += 1) {
    const hw = Math.round(y * 0.6) + 1
    const oh = ouverte && y > 4 ? Math.round((y - 4) * 0.42) : -1
    for (let x = 10 - hw; x < 10 + hw; x += 1) c.set(x, y, Math.abs(x + 0.5 - 10) <= oh ? '#24180E' : x < 10 ? W[x < 10 - hw + 1 ? 3 : 2] : W[x > 10 + hw - 2 ? 0 : 1])
    if (!ouverte && y > 4) c.set(9, y, W[0])
  }
  c.rect(9, 0, 2, 2, B[4])
  c.rect(11, 0, 3, 2, ouverte ? '#C8583E' : '#5A6474')
  return c
}
const LOOKS: Record<Tenue, readonly [shirt: string, hair: string, skin: string]> = {
  Corail: ['#E4633A', '#3B2A20', '#F0C8A0'],
  Turquoise: ['#2A9D8F', '#C98B3C', '#C98F62'],
  Violet: ['#7F6BD6', '#1F1A2E', '#E8B98A'],
  Rose: ['#D4537E', '#5A3A22', '#8A5A3C'],
  Bleu: ['#3F7CC8', '#D9A441', '#F0C8A0'],
  Or: ['#E0A030', '#6A2C1E', '#C98F62'],
}
/** Someone at a bench, 16 by 13 cells. The screen stands apart: six outfits by three states would weigh too much. */
function personne(tenue: Tenue) {
  const c = grid(16, 13)
  const [S, H, Q] = LOOKS[tenue]
  c.sprite(['..oooo..', '.oHHHHo.', '.oHHHHo.', '.oPPPPo.', '.oPkPko.', '..oPPo..', '.oSSSSo.', 'oSSSSSSo', 'oSSSSSSo', '.oSSSSo.'], { o: INK, H, P: Q, k: '#1F1A2E', S }, 0, 0)
  c.rect(0, 10, 16, 3, B[3])
  c.rect(0, 10, 16, 1, B[5])
  c.rect(0, 12, 16, 1, B[1])
  return c
}
function ecran(etat: DeskState) {
  const c = grid(8, 6)
  c.rect(1, 0, 7, 5, NIGHT)
  c.rect(2, 1, 5, 3, etat === 'done' ? '#4E8F5A' : etat === 'failed' ? '#E4505F' : '#7FE0C8')
  c.rect(0, 5, 8, 1, '#6A6E8C')
  if (etat === 'done') for (const [x, y] of [[3, 2], [4, 3], [5, 2], [6, 1]] as const) c.set(x, y, CR)
  return c
}
function feuMini(allume: boolean) {
  const c = grid(22, 20)
  if (allume) disc(c, 11, 11, 11, 9, (_, __, d) => (d < 0.5 ? '#FFC857|0.22' : '#FFC857|0.1'))
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * 6.283
    const [x, y] = [11 + Math.cos(a) * 7, 12 + Math.sin(a) * 5]
    disc(c, x, y, 2.4, 1.8, (_, py) => (py < y ? R[3] : R[1]))
  }
  disc(c, 11, 12, 5, 3.4, allume ? '#3A2A20' : E[1])
  c.rect(7, 12, 9, 2, B[3])
  c.rect(9, 10, 2, 6, B[4])
  if (allume) c.sprite(['....r.....', '...rr..r..', '..ryr..r..', '.rryyrrr..', '.ryywyyr..', '.ryywwyr..', '..rryyrr..'], { r: '#E4633A', y: '#FFC857', w: PAP }, 6, 4)
  else {
    c.set(12, 9, '#8A8078')
    c.set(13, 7, '#6E6660')
    c.set(12, 5, '#54504C')
  }
  return c
}
function ecriteau(repos: boolean) {
  const c = grid(100, 15)
  const [a, b, d] = repos ? ['#4F4560', '#6A6078', '#3A3048'] : [B[3], B[5], B[1]]
  c.rect(1, 2, 72, 13, SH)
  box(c, 0, 1, 72, 12, a, b, d)
  for (let i = 0; i < 12; i += 1) c.rect(2 + Math.floor(noise(i, 3) * 60), 3 + Math.floor(noise(i, 4) * 8), 4 + Math.floor(noise(i, 5) * 8), 1, d)
  for (const [x, y] of [[2, 3], [69, 3], [2, 10], [69, 10]] as const) c.set(x, y, R[3])
  c.rect(72, 5, 4, 2, B[1])
  c.rect(77, 2, 23, 13, SH)
  box(c, 76, 1, 23, 12, '#14121F', a, d)
  c.rect(77, 2, 21, 10, '#0C2018')
  for (let y = 3; y < 12; y += 2) c.rect(77, y, 21, 1, '#102A20')
  return c
}
function panneauCamps() {
  const c = grid(84, 84)
  disc(c, 42, 82, 40, 2, SH)
  for (const x of [8, 72]) {
    c.rect(x, 6, 4, 77, E[2])
    for (let y = 6; y < 83; y += 1) if (noise(x, Math.floor(y / 3)) > 0.5) c.rect(x, y, 4, 1, E[3])
    c.rect(x, 6, 1, 77, B[5])
    c.rect(x + 3, 6, 1, 77, B[1])
  }
  c.rect(3, 8, 78, 68, B[3])
  for (const x of [18, 42, 62]) c.rect(x, 8, 1, 68, B[2])
  c.rect(5, 9, 74, 66, '#C9B48A')
  c.rect(6, 10, 72, 64, PAP)
  c.rect(3, 75, 78, 1, B[1])
  for (let j = 0; j < 9; j += 1) {
    const ins = Math.round((8 - j) * 0.7)
    for (let x = ins; x < 84 - ins; x += 1) {
      const s = (x + (j % 3 === 1 ? 2 : j % 3 === 2 ? 4 : 0)) % 6 === 0
      c.set(x, j, j % 3 === 2 ? B[0] : s ? B[1] : j % 3 === 0 ? B[3] : B[2])
    }
  }
  c.rect(0, 8, 84, 1, B[4])
  for (const [x, y, rx] of [[20, 3, 11], [58, 5, 12], [40, 1, 7]] as const) disc(c, x, y, rx, 2.2, (px, py) => (noise(px, py) > 0.75 ? null : noise(px, py) > 0.45 ? M[5] : M[3]))
  return c
}
/** The dovecote, its letters and its count apart: they follow the news. */
function pigeonnier() {
  const c = grid(40, 54)
  disc(c, 20, 52, 13, 2, SH)
  c.rect(18, 26, 4, 27, E[2])
  c.rect(18, 26, 1, 27, B[5])
  c.rect(21, 26, 1, 27, B[1])
  for (let i = 0; i < 3; i += 1) c.rect(16 - i, 42 + i * 3, 8 + i * 2, 1, '#1B1730|0.14')
  box(c, 8, 12, 24, 16, B[4], B[5], B[1])
  for (const y of [16, 22]) c.rect(9, y, 22, 1, B[2])
  for (const x of [12, 20, 28]) {
    disc(c, x, 18, 2.4, 3, B[0])
    c.rect(x - 2, 21, 5, 1, B[5])
  }
  c.rect(6, 28, 28, 2, B[3])
  c.rect(6, 28, 28, 1, B[5])
  for (let j = 0; j < 11; j += 1) {
    const hw = 3 + j * 1.4
    for (let x = 20 - hw; x < 20 + hw; x += 1) c.set(x, 2 + j, j % 3 === 2 ? B[0] : (x + j * 2) % 5 < 1 ? B[1] : j % 3 === 0 ? '#7A3E2A' : '#5E3020')
  }
  disc(c, 14, 8, 4, 1.6, M[4])
  c.sprite(['.gg...', 'gwgg..', '.gGGGg', '.gGGGG', '..oo..'], { g: '#A8B0B8', w: '#E8ECEC', G: '#7E8690', o: '#D8A048' }, 24, 7)
  return c
}
function lettre() {
  const c = grid(13, 2)
  c.rect(0, 0, 13, 1, PAP)
  c.rect(0, 1, 13, 1, '#D8C49E')
  c.rect(5, 0, 3, 1, '#E4633A')
  return c
}
function pigeonVol() {
  const c = grid(30, 28)
  c.sprite(['....gg........gg....', '...gwwg......gwwg...', '..gwwwwg....gwwwwg..', '...gwwwwgggggwwwwg..', '....gwwGGGGGGwwg....', '.....ggGGGGGGgg.bb..', '.......gGGGGgggkbo..', '......ll..gg..gg....', '.....lllll..........', '.....lrrll..........', '.....lllll..........'], { g: '#7E8690', w: '#E8ECEC', G: '#A8B0B8', b: '#C8D0D4', k: NIGHT, o: '#D8A048', l: PAP, r: '#E4633A' }, 2, 0)
  disc(c, 13, 24, 9, 2.4, '#0C1810|0.5')
  return c
}

const tenueOf = (hue: number): Tenue => TENUES[hue % TENUES.length]!
const ART: Record<string, Art> = {
  tente: once(() => tenteMini(true)),
  tenteR: once(() => tenteMini(false)),
  feu: once(() => feuMini(true)),
  feuR: once(() => feuMini(false)),
  plaque: once(() => ecriteau(false)),
  plaqueR: once(() => ecriteau(true)),
  pont: once(pont),
  panneau: once(panneauCamps),
  pigeonnier: once(pigeonnier),
  lettre: once(lettre),
  vol: once(pigeonVol),
  toile: once(tente),
  etabli: once(() => bureau('working')),
  etabliR: once(() => bureau('rest')),
  foyer: once(foyer),
  chef: once(() => person('Corail')),
  ecworking: once(() => ecran('working')),
  ecdone: once(() => ecran('done')),
  ecfailed: once(() => ecran('failed')),
  ...Object.fromEntries(TENUES.map(tenue => [`mini${tenue}`, once(() => personne(tenue))])),
}
const clearings = new Map<string, Canvas>()
function clearing(id: string, bare: boolean) {
  const key = `${id}${bare}`
  const made = clearings.get(key)
  if (made) return made
  const repos = id.endsWith('R')
  const c = id.startsWith('grand') ? clairiere(258, 112, false, bare) : id.startsWith('reduite') ? clairiere(96, 66, repos, bare) : clairiere(112, 84, repos, bare)
  const cut = id === 'grandHaut' ? haut(c, 14) : c
  clearings.set(key, cut)
  return cut
}
const lazy = (make: () => string) => {
  let made = ''
  return () => (made ||= make())
}
const canopy = lazy(() => pattern('canopee', canopee()))
const brasier = lazy(() => `<g id="brasier" transform="scale(2)">${flammesFeu('full', 1)}</g>`)

const px = ([x, y]: Pair): Pair => [x * 2, y * 2]
// In cells from a camp's corner. The first ones have a tent, the others only a bench: nobody is ever left out.
const SEATS = [[12, 12], [46, 6], [78, 14], [8, 42], [82, 44], [30, 44], [66, 44], [34, 60], [50, 60], [66, 60]] as const
const SEATS_SMALL = [[6, 4], [38, 0], [68, 6], [12, 32], [70, 30], [26, 32], [60, 30], [34, 46], [52, 46]] as const
const TENTS = 5
// Those who work in the conversation that leads, on benches around its camp, in cells from its frame.
const CREW = [[184, 88], [202, 88], [220, 88], [238, 88], [184, 102], [202, 102], [220, 102], [238, 102], [112, 6], [130, 6], [148, 6], [112, 20], [130, 20], [148, 20]] as const
const CREW_SMALL = [[184, 103], [202, 103], [220, 103], [238, 103], [112, 18], [130, 18], [148, 18], [112, 32], [130, 32], [148, 32], [52, 18], [70, 18]] as const
/** A seat, then the same ones again a little aside once they are all taken. */
const seat = (seats: readonly Pair[], i: number): Pair => {
  const [x, y] = seats[i % seats.length]!
  const lap = Math.floor(i / seats.length)
  return [x + lap * 3, y + lap * 2]
}
const STATUS = { completed: { box: '#4E8F5A', text: NIGHT, bar: '#5FC9B8' }, in_progress: { box: '#FFC857', text: NIGHT, bar: '#FFC857' }, pending: { box: PAP, text: '#7A6A5E', bar: '#3A3355' } } as const
const rect = (x: number, y: number, w: number, h: number, fill: string, opacity?: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opacity ? ` fill-opacity="${opacity}"` : ''}/>`

/** What one drawing needs, and the letters it writes. */
type Sheet = { used: Set<string>; words: string[]; put: (id: string, x?: number, y?: number) => string; write: (s: string, x: number, y: number, size: number, ink: string) => string }
function sheet(): Sheet {
  const used = new Set<string>()
  const words: string[] = []
  return {
    used,
    words,
    put(id, x = 0, y = 0) {
      used.add(id)
      return use(id, x, y)
    },
    write(s, x, y, size, ink) {
      words.push(s)
      return line(s, Math.round(x), y, size, ink)
    },
  }
}
const seated = (s: Sheet, p: MapRoom['people'][number], x: number, y: number) => `${s.put(`mini${tenueOf(p.hue)}`, x, y)}${s.put(`ec${p.state}`, x + 14, y + 10)}`
function sign(s: Sheet, r: MapRoom, x: number, y: number, metaMax: number) {
  const meta = fit(r.meta, 16, metaMax)
  const body = s.put(r.rest ? 'plaqueR' : 'plaque', x, y)
  return `${body}${s.write(fit(r.title, 16, 126), x + 10, y + 4, 16, CR)}${rect(x + 4, y + 32, Math.ceil(textWidth(meta, 16)) + 10, 18, NIGHT, BANNER)}${s.write(meta, x + 9, y + 31, 16, r.rest ? '#C9BEDB' : '#FFC857')}`
}

function camp(s: Sheet, r: MapRoom, at: Pair, small: boolean) {
  const [x, y] = px(at)
  const [w, id] = small ? [192, 'reduite'] : [224, 'clairiere']
  const ground = `${id}${r.rest ? 'R' : ''}`
  s.used.add(ground)
  const body = pick(r.seed, 1, 2) ? `<g transform="translate(${x + w} ${y}) scale(-1 1)">${use(ground)}</g>` : use(ground, x, y)
  const fire = small ? s.put(r.rest ? 'feuR' : 'feu', x + 76, y + 52) : s.put(r.rest ? 'feuR' : 'feu', x + 90, y + 72)
  const seats = small ? SEATS_SMALL : SEATS
  const tents = Array.from({ length: Math.min(TENTS, Math.max(r.people.length, r.rest ? 2 : 0)) }, (_, i) => {
    const [sx, sy] = seats[i]!
    return s.put(r.rest ? 'tenteR' : 'tente', x + sx * 2, y + sy * 2)
  })
  const people = r.people.map((p, i) => {
    const [sx, sy] = seat(seats, i)
    return i % seats.length < TENTS ? seated(s, p, x + (sx + 2) * 2, y + (sy + 12) * 2) : seated(s, p, x + sx * 2, y + sy * 2)
  })
  const plate = small ? sign(s, r, x - 4, y + 112, 190) : sign(s, r, x + 12, y + 156, 196)
  return `<g>${body}${fire}${tents.join('')}${people.join('')}${plate}</g>`
}

function board(s: Sheet, list: MapView['list'], x: number, y: number, full: boolean) {
  const rows = list.length
  const pitch = Math.min(15, Math.floor(106 / Math.max(1, rows)))
  const size = pitch >= 15 ? 14 : pitch >= 13 ? 13 : 11
  const [mark, dot] = pitch >= 13 ? [8, 4] : [6, 2]
  const rise = full || rows > 8 ? 4 : 0
  const top = y + 42 - rise
  const lines = list.map((item, i) => {
    const look = STATUS[item.status]
    const ry = top + i * pitch
    const mid = ry + (pitch >= 13 ? 4 : 3)
    return `${rect(x + 14, mid, mark, mark, NIGHT)}${rect(x + 16, mid + 2, dot, dot, look.box)}${s.write(fit(item.text, size, 118), x + 19 + mark, ry, size, look.text)}`
  })
  return `${s.put('panneau', x, y)}${s.write(t('room.conversations'), x + 14, y + 22 - rise, 16, '#4A2C2A')}${lines.join('')}`
}

/** One step of the band on the bench for each conversation listed: its state, nothing more. */
function progress(list: MapView['list'], x: number, y: number) {
  const steps = list.slice(0, 12)
  const w = Math.floor((100 - 2 * (steps.length - 1)) / Math.max(1, steps.length))
  const inner = steps.length * w + 2 * (steps.length - 1)
  return `${rect(x, y, inner + 4, 8, NIGHT)}${steps.map((st, i) => rect(x + 2 + i * (w + 2), y + 2, w, 4, STATUS[st.status].bar)).join('')}`
}

function tray(s: Sheet, shown: number, x: number, y: number) {
  if (!shown) return ''
  const count = String(shown)
  const w = Math.max(22, Math.ceil(textWidth(count, 16)) + 12)
  const left = x + 69 - Math.floor(w / 2)
  const pile = Array.from({ length: Math.min(shown, 6) }, (_, i) => s.put('lettre', x + 6, y + 94 - i * 4)).join('')
  return `${pile}${rect(left, y, w, 20, NIGHT)}${rect(left + 2, y + 2, w - 4, 16, '#D8402E')}${rect(left + 2, y + 2, w - 4, 2, '#F07058')}${s.write(count, x + 69 - textWidth(count, 16) / 2, y - 1, 16, '#FFFFFF')}`
}

function bigCamp(s: Sheet, v: MapView, plan: Plan) {
  const r = v.rooms[0]!
  const [ox, oy] = px(plan.o)
  const clear = plan.small ? s.put('grandHaut', ox + 4, 0) : s.put('grand', ox + 4, oy + 8)
  const manager = r.people[0]?.hue === 0
  const crew = r.people.slice(manager ? 1 : 0).map((p, i) => {
    const [sx, sy] = seat(plan.small ? CREW_SMALL : CREW, i)
    return seated(s, p, ox + sx * 2, oy + sy * 2)
  })
  const [dx, dy] = [ox + 128, oy + 96]
  const label = t('role.manager')
  const post = `${s.put('toile', dx - 4, dy - 44)}${manager ? s.put('chef', dx + 44, dy - 4) : ''}${s.put(manager ? 'etabli' : 'etabliR', dx, dy)}${progress(v.list, dx + 8, dy + 52)}${s.write(label, dx + 60 - textWidth(label, 16) / 2, dy + 60, 16, NIGHT)}`
  const fire = `${s.put('foyer', ox + 240, oy + 80)}${use('brasier', ox + 240, oy + 80)}`
  const dove = `${s.put('pigeonnier', ox + 16, oy + 68)}${tray(s, v.news.shown, ox + 16, oy + 68)}`
  const list = board(s, v.list, ox + 356, Math.max(oy, 0), plan.small)
  return `<g>${clear}${dove}${fire}${post}${crew.join('')}${list}${sign(s, { ...r, rest: false }, ox + 20, oy + 8 + plan.off, 180)}</g>`
}

function flight(s: Sheet, v: MapView, plan: Plan) {
  if (!v.news.flying) return ''
  const [ox, oy] = px(plan.o)
  const [fromX, fromY] = [ox + plan.bird[0], oy + plan.bird[1]]
  const [dx, dy] = [ox + 54 - fromX, oy + 38 - fromY]
  const time = `dur="${v.flightS}s" fill="freeze"`
  return `<g class="ev" transform="translate(${fromX} ${fromY})"><g><animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy}" ${time}/><animate attributeName="opacity" values="1;1;0" keyTimes="0;.92;1" ${time}/>${s.put('vol')}</g></g>`
}

const frame = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
function places(n: number) {
  const plan = planOf(n)
  const [ox, oy] = px(plan.o)
  const big = plan.small ? frame(ox, 0, 524, 200) : frame(ox, oy, 524, 240)
  const others = plan.camps.slice(0, Math.max(0, n - 1)).map(at => {
    const [x, y] = px(at)
    return plan.small ? frame(x - 4, y, 200, 164) : frame(x, y, 224, 214)
  })
  return [big, ...others]
}
function counts(n: number) {
  const plan = planOf(n)
  const [ox, oy] = px(plan.o)
  const ink = '#EDFFF5'
  const others = plan.camps.slice(0, Math.max(0, n - 1)).map(at => {
    const [x, y] = px(at)
    return plan.small ? { x: x + 171, y: y + 117, size: 16, ink } : { x: x + 187, y: y + 161, size: 16, ink }
  })
  return [{ x: ox + 195, y: oy + 13 + plan.off, size: 16, ink }, ...others]
}
function draw(v: MapView) {
  const n = v.rooms.length
  const plan = planOf(n)
  const s = sheet()
  const rooms = v.rooms.map((r, i) => (i === 0 ? bigCamp(s, v, plan) : camp(s, r, plan.camps[i - 1]!, plan.small)))
  const bridges = plan.bridges.map(b => s.put('pont', b[0] * 2, b[1] * 2)).join('')
  const front = flight(s, v, plan)
  const sprites = [...s.used].map(id => def(id, ART[id]?.() ?? clearing(id, v.detail > 0))).join('')
  const back = `<rect width="${WORLD.w}" height="${WORLD.h}" fill="url(#canopee)"/>${relief(n)}${bridges}`
  return { defs: `${canopy()}${brasier()}${sprites}`, back, rooms, front, words: s.words.join('') }
}

/** Out along each trail and back to the big camp: the only roads there are. */
function walk(n: number): Point[] {
  const plan = planOf(n)
  return plan.trails.slice(0, Math.max(1, n - 1)).flatMap(trail => {
    const out = trail.flatMap(([[x0, y0], [x1, y1], [mx, my]], i) => (i ? [0.25, 0.5, 0.75, 1] : [0, 0.25, 0.5, 0.75, 1]).map(u => ({ x: Math.round(((1 - u) ** 2 * x0 + 2 * u * (1 - u) * mx + u * u * x1) * 2), y: Math.round(((1 - u) ** 2 * y0 + 2 * u * (1 - u) * my + u * u * y1) * 2) })))
    return [...out, ...[...out].reverse().slice(1)]
  })
}

export const natureMap: MapPack = { back: TOP[0], places, counts, draw, walk }
