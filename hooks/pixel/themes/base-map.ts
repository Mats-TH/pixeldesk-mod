import { t } from '../../i18n'
import { canvas, noise } from '../canvas'
import type { Canvas } from '../canvas'
import { fit, textWidth } from '../font'
import type { Point } from '../hearth'
import { pick } from '../pack'
import type { MapDrawing, MapPack, MapRoom, MapView } from '../pack'
import { TENUES } from '../sprites'
import type { DeskState, Tenue } from '../sprites'
import { def, line, use } from '../text'

const INK = '#2A2036'
const SH = '#0E1016|0.45'
const VOILE = '#17142B|0.56'
const ACIER = ['#22252E', '#323641', '#484D5A', '#636978', '#868D9C', '#B0B6C2', '#DCE0E8']
const COQUE = ['#8E94A0', '#B8BEC8', '#DDE1E8', '#F4F6F8', '#FFFFFF']
const BLEU = ['#18243C', '#223354', '#2E4670', '#3E5E90', '#5A82B2', '#8CB0D4']
const ROUGE = ['#64161A', '#922624', '#BE3A2E', '#DC5A44', '#F28A6C']
const OR = ['#8C6A2E', '#C9A24A', '#E8C868', '#FFE08A']
const VERT = ['#1F4234', '#2C6A4A', '#3A9A68', '#6FD8A0', '#BFF5E6']
const JAUNE = ['#C89A28', '#F0C440', '#F8DE70']
const TERRE = ['#1E1A1E', '#241F22', '#2A2427', '#322B2C', '#3C3432']
const DECK = ['#1F222B', '#272B35', '#2E333E', '#363C48']
const EAU = '#3F8CC0'
const PAPIER = '#FFFFFF'
const NUIT = '#14121F'

type Paint = string | null
type C = Canvas

const box = (c: C, x: number, y: number, w: number, h: number, base: string, lit: string, dark: string) => {
  c.rect(x, y, w, h, base)
  c.rect(x, y, w, 1, lit)
  c.rect(x, y, 1, h, lit)
  c.rect(x + w - 1, y, 1, h, dark)
  c.rect(x, y + h - 1, w, 1, dark)
}

function disc(c: C, cx: number, cy: number, rx: number, ry: number, paint: string | ((x: number, y: number, d: number) => string)) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d <= 1) c.set(x, y, typeof paint === 'string' ? paint : paint(x, y, d))
    }
  }
}

function danger(c: C, x: number, y: number, w: number, h: number, a: string, b: string) {
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) c.set(x + i, y + j, (i + j) % 6 < 3 ? a : b)
}

/** The cut-cornered footprint every building has from above. `bord`: how far from its edge a cell lies. */
function plateau(c: C, x: number, y: number, w: number, h: number, pan: number, paint: (i: number, j: number, bord: number) => Paint) {
  for (let j = 0; j < h; j += 1) {
    const inset = Math.max(0, pan - j, pan - (h - 1 - j))
    for (let i = inset; i < w - inset; i += 1) c.set(x + i, y + j, paint(i, j, Math.min(i - inset, w - 1 - inset - i, j, h - 1 - j)))
  }
}

/** Two rails and their ties along one straight stretch. `fine`: the narrow gauge of a crowded base. */
function voie(c: C, x0: number, y0: number, x1: number, y1: number, fine: boolean) {
  const hor = y0 === y1
  const [a, b] = [Math.min(hor ? x0 : y0, hor ? x1 : y1), Math.max(hor ? x0 : y0, hor ? x1 : y1)]
  const at = hor ? y0 : x0
  const [low, high] = fine ? [-1, 2] : [-2, 3]
  for (let t = a; t < b; t += 1) {
    const put = (o: number, p: string) => (hor ? c.set(t, at + o, p) : c.set(at + o, t, p))
    put(low, ACIER[3]!)
    put(high, ACIER[3]!)
    if ((t - a) % 8 === 4) for (let o = low + 1; o < high; o += 1) put(o, ACIER[1]!)
    if (!fine && (t - a) % 32 === 20) for (let o = -4; o < 6; o += 1) put(o, ACIER[2]!)
  }
}

function dalle(c: C, x: number, y: number, w: number, h: number) {
  c.rect(x, y, w, h, DECK[1]!)
  c.rect(x, y, w, 1, DECK[3]!)
  c.rect(x, y, 1, h, DECK[3]!)
  c.rect(x + w - 1, y, 1, h, DECK[0]!)
  c.rect(x, y + h - 1, w, 1, DECK[0]!)
}

type Trace = readonly (readonly [number, number])[]

/** One monorail line, in cells of the world, from the control centre to a sector. */
function ligne(trace: Trace, fine: boolean, depart: boolean) {
  const c = canvas(390, 380)
  const [corner, endW, endH, r] = fine ? [7, 9, 7, 3] : [13, 15, 11, 6]
  for (let i = 0; i + 1 < trace.length; i += 1) voie(c, trace[i]![0], trace[i]![1], trace[i + 1]![0], trace[i + 1]![1], fine)
  for (let i = 1; i + 1 < trace.length; i += 1) dalle(c, trace[i]![0] - r, trace[i]![1] - r, corner, corner)
  const end = trace[trace.length - 1]!
  dalle(c, end[0] - (endW >> 1), end[1] - (endH >> 1), endW, endH)
  // The rooms draw in order, the centre first: this foot stands against its wall, not over it.
  if (depart) dalle(c, trace[0]![0] - r, trace[0]![1], corner, fine ? 3 : 6)
  return c
}

/** The ground the base stands on: scars in the soil, and the launch pad at its heart. */
function socle() {
  const [w, h] = [390, 380]
  const c = canvas(w, h)
  for (let i = 0; i < 16; i += 1) {
    const [x, y] = [Math.floor(noise(i, 71) * w), Math.floor(noise(i, 72) * h)]
    c.rect(x, y, 2 + Math.floor(noise(i, 73) * 5), 1, i % 3 ? TERRE[0]! : TERRE[3]!)
  }
  const [px, py] = [200, 194]
  plateau(c, px - 45, py - 45, 90, 90, 26, (_, __, b) => (b === 0 ? ACIER[4]! : b === 1 ? ACIER[2]! : DECK[2]!))
  plateau(c, px - 26, py - 26, 52, 52, 14, (_, __, b) => (b < 2 ? DECK[3]! : DECK[1]!))
  for (let i = 3; i < 9; i += 1) {
    const t = -38 + i * 7
    const paint = i % 2 ? JAUNE[1]! : ACIER[0]!
    c.rect(px - 40, py + t, 2, 3, paint)
    c.rect(px + 38, py + t, 2, 3, paint)
    c.rect(px + t, py - 40, 3, 2, paint)
    c.rect(px + t, py + 38, 3, 2, paint)
  }
  c.rect(px - 40, py - 3, 80, 6, ACIER[0]!)
  c.rect(px - 3, py - 40, 6, 80, ACIER[0]!)
  c.rect(px - 40, py - 3, 80, 1, ACIER[2]!)
  c.rect(px - 3, py - 40, 1, 80, ACIER[2]!)
  // The tower, then the rocket from above: fins, hull, red nose.
  box(c, px + 18, py - 30, 14, 14, ACIER[2]!, ACIER[4]!, ACIER[0]!)
  for (let i = 0; i < 12; i += 3) c.rect(px + 19, py - 29 + i, 12, 1, ACIER[1]!)
  c.rect(px + 8, py - 25, 10, 2, COQUE[0]!)
  c.rect(px + 8, py - 25, 10, 1, COQUE[2]!)
  c.rect(px + 8, py - 9, 12, 2, COQUE[0]!)
  c.rect(px + 16, py - 16, 2, 8, COQUE[0]!)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    for (let k = 8; k < 15; k += 1) {
      const l = Math.max(0, Math.round((15 - k) / 2))
      for (let o = -l; o <= l; o += 1) c.set(px + dx * k + dy * o, py + dy * k + dx * o, k % 3 ? ROUGE[2]! : ROUGE[1]!)
    }
  }
  disc(c, px, py, 9.5, 9.5, (x, y) => COQUE[x - px + (y - py) < -5 ? 4 : x - px + (y - py) < 3 ? 3 : x - px + (y - py) < 8 ? 1 : 0]!)
  disc(c, px, py, 5.2, 5.2, (x, y) => (x - px + (y - py) < 0 ? ROUGE[3]! : ROUGE[1]!))
  disc(c, px, py, 1.6, 1.6, ROUGE[4]!)
  return c
}

/** A free lot, marked on the ground: a place no conversation holds, and no rail reaches. */
function aireLibre() {
  const c = canvas(104, 99)
  plateau(c, 0, 0, 104, 99, 9, (_, __, b) => (b === 0 ? TERRE[3]! : null))
  for (const [x, y, w, h] of [[42, 4, 20, 2], [42, 93, 20, 2], [4, 40, 2, 20], [98, 40, 2, 20]] as const) c.rect(x, y, w, h, TERRE[2]!)
  return c
}

function lampes(c: C, pts: readonly (readonly [number, number])[], allumee: boolean) {
  for (const [x, y] of pts) {
    c.rect(x, y, 4, 4, ACIER[1]!)
    c.rect(x + 1, y + 1, 2, 2, allumee ? JAUNE[2]! : ACIER[0]!)
    if (allumee) {
      c.rect(x - 2, y + 1, 2, 2, '#FFE08A|0.28')
      c.rect(x + 4, y + 1, 2, 2, '#FFE08A|0.28')
      c.rect(x + 1, y - 2, 2, 2, '#FFE08A|0.28')
      c.rect(x + 1, y + 4, 2, 2, '#FFE08A|0.28')
    }
  }
}

function tole(i: number, j: number, bord: number, teinte = DECK) {
  if (bord === 0) return ACIER[j < 3 || i < 3 ? 5 : 2]!
  if (bord === 1) return ACIER[3]!
  if (bord === 2) return teinte[0]!
  if (i % 18 === 0 || j % 18 === 0) return teinte[0]!
  if (i % 18 === 1 || j % 18 === 1) return teinte[3]!
  return teinte[2]!
}

function secteur(allume: boolean) {
  const c = canvas(108, 104)
  plateau(c, 3, 4, 105, 100, 9, () => '#0E1016|0.5')
  plateau(c, 0, 0, 104, 99, 9, tole)
  c.rect(6, 6, 68, 11, ACIER[0]!)
  c.rect(7, 7, 66, 9, allume ? BLEU[1]! : ACIER[1]!)
  c.rect(7, 7, 66, 1, allume ? BLEU[3]! : ACIER[2]!)
  c.rect(7, 7, 2, 9, allume ? EAU : ACIER[2]!)
  c.rect(10, 84, 84, 9, ACIER[0]!)
  c.rect(11, 85, 82, 7, NUIT)
  danger(c, 4, 19, 96, 1, allume ? JAUNE[0]! : ACIER[2]!, DECK[0]!)
  disc(c, 30, 62, 14, 14, DECK[3]!)
  disc(c, 30, 62, 12.5, 12.5, DECK[2]!)
  c.rect(24, 61, 13, 2, DECK[3]!)
  c.rect(29, 56, 2, 13, DECK[3]!)
  c.rect(50, 78, 2, 6, ACIER[0]!)
  c.rect(54, 72, 34, 1, DECK[0]!)
  lampes(c, [[6, 77], [94, 77]], allume)
  return c
}

/** The shade of a sector at rest, cut to its footprint so the ground around it stays as it is. */
function voile() {
  const c = canvas(104, 99)
  plateau(c, 0, 0, 104, 99, 9, () => VOILE)
  return c
}

function centre() {
  const c = canvas(162, 118)
  plateau(c, 3, 4, 159, 114, 12, () => '#0E1016|0.5')
  plateau(c, 0, 0, 158, 113, 12, (i, j, b) => tole(i, j, b, ['#1C2436', '#232D42', '#2A364E', '#34425C']))
  c.rect(10, 6, 100, 12, ACIER[0]!)
  c.rect(11, 7, 98, 10, BLEU[2]!)
  c.rect(11, 7, 98, 1, BLEU[4]!)
  c.rect(11, 7, 2, 10, OR[2]!)
  c.rect(10, 96, 92, 9, ACIER[0]!)
  c.rect(11, 97, 90, 7, NUIT)
  danger(c, 108, 104, 40, 2, OR[1]!, DECK[0]!)
  danger(c, 6, 20, 146, 1, OR[0]!, DECK[0]!)
  for (const x of [86, 106, 126]) {
    box(c, x, 23, 18, 12, ACIER[1]!, ACIER[3]!, ACIER[0]!)
    c.rect(x + 2, 25, 14, 8, '#0F2A30')
    c.rect(x + 3, 26, 8, 1, x === 106 ? '#FFC857' : '#7FE0C8')
    c.rect(x + 3, 28, 11, 1, '#2F6A6E')
    c.rect(x + 3, 30, 6, 1, '#2F6A6E')
  }
  disc(c, 94, 68, 14, 14, '#34425C')
  disc(c, 94, 68, 12.5, 12.5, '#2A364E')
  lampes(c, [[4, 88], [150, 88], [150, 10]], true)
  return c
}

/** A bench at the scale of the floor. Its screen tells how the work stands. */
function poste(etat: DeskState | 'rest') {
  const c = canvas(26, 17)
  c.rect(1, 15, 24, 2, SH)
  c.rect(0, 7, 26, 7, ACIER[5]!)
  c.rect(0, 7, 26, 1, ACIER[6]!)
  c.rect(0, 13, 26, 1, ACIER[3]!)
  c.rect(2, 14, 3, 2, ACIER[2]!)
  c.rect(21, 14, 3, 2, ACIER[2]!)
  const ecran = etat === 'rest' ? '#2D2F44' : etat === 'done' ? '#2F6B45' : etat === 'failed' ? '#7A2232' : '#245A5C'
  c.rect(2, 1, 11, 8, '#1B1730')
  c.rect(3, 2, 9, 6, ecran)
  c.rect(1, 9, 13, 1, ACIER[3]!)
  if (etat === 'working') {
    c.rect(6, 4, 3, 2, '#7FE0C8')
    c.set(7, 3, '#BFF5E6')
  }
  if (etat === 'done') for (const [x, y] of [[5, 5], [6, 6], [7, 5], [8, 4], [9, 3]] as const) c.set(x, y, '#F4E4C1')
  if (etat === 'failed') {
    c.rect(7, 3, 1, 3, '#FFB0B8')
    c.set(7, 7, '#FFB0B8')
  }
  c.rect(17, 5, 4, 6, '#DCEAF0')
  c.rect(17, 8, 4, 3, VERT[2]!)
  c.rect(17, 5, 1, 6, PAPIER)
  c.rect(23, 6, 2, 5, '#DCEAF0')
  c.rect(23, 8, 2, 3, ROUGE[3]!)
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

/** A scientist at the scale of the floor. */
function buste(tenue: Tenue) {
  const [T, H, S] = LOOKS[tenue]
  const c = canvas(10, 10)
  c.sprite(['..oooooo..', '.oHHHHHHo.', '.oHHHHHHo.', '.oSSSSSSo.', '.oeSSSSeo.', '.oSSSSSSo.', '..ooSSoo..', '.oCCTTCCo.', 'oCCCTTCCCo', 'oCCCTTCCCo'], { o: INK, H, S, e: '#1F1A2E', C: '#F2F4F2', T }, 0, 0)
  return c
}

function ecran() {
  const c = canvas(30, 14)
  c.rect(1, 1, 28, 12, ACIER[0]!)
  c.rect(0, 2, 30, 10, ACIER[0]!)
  c.rect(1, 2, 28, 10, ACIER[2]!)
  c.rect(1, 2, 28, 1, ACIER[4]!)
  c.rect(2, 3, 26, 8, '#0F2A30')
  for (let y = 4; y < 11; y += 2) c.rect(2, y, 26, 1, '#13333A')
  c.rect(13, 12, 4, 2, ACIER[1]!)
  return c
}

function liste(h: number) {
  const c = canvas(76, h + 2)
  c.rect(2, 2, 74, h, '#0E1016|0.5')
  box(c, 0, 0, 74, h, ACIER[2]!, ACIER[4]!, ACIER[0]!)
  c.rect(2, 2, 70, h - 4, '#C9B48A')
  c.rect(3, 3, 68, h - 6, '#FFF6DE')
  for (const x of [10, 60]) {
    c.rect(x, 0, 4, 2, JAUNE[2]!)
    c.rect(x, 0, 4, 1, JAUNE[1]!)
  }
  return c
}

function caseListe(inner: string) {
  const c = canvas(5, 5)
  c.rect(0, 0, 5, 5, INK)
  c.rect(1, 1, 3, 3, inner)
  return c
}

function casier() {
  const c = canvas(24, 22)
  c.rect(2, 19, 22, 3, SH)
  box(c, 0, 2, 22, 18, ACIER[3]!, ACIER[5]!, ACIER[0]!)
  c.rect(2, 4, 18, 14, ACIER[0]!)
  for (const [x, y] of [[3, 11], [11, 11], [7, 5]] as const) {
    c.rect(x, y, 8, 6, PAPIER)
    c.rect(x, y, 8, 1, ACIER[5]!)
    c.rect(x + 3, y + 2, 2, 2, ROUGE[3]!)
  }
  c.rect(0, 0, 22, 2, ACIER[2]!)
  c.rect(0, 0, 22, 1, ACIER[4]!)
  return c
}

function capsule() {
  const c = canvas(6, 6)
  c.rect(0, 0, 6, 6, INK)
  c.rect(1, 1, 4, 4, PAPIER)
  c.rect(2, 2, 2, 2, ROUGE[3]!)
  return c
}

function navette(chargee: boolean) {
  const c = canvas(14, 28)
  c.rect(2, 3, 12, 25, SH)
  for (let y = 0; y < 26; y += 1) {
    const hw = y < 5 ? 2 + y : y > 22 ? 6 - (y - 22) : 6
    for (let x = 6 - hw; x < 6 + hw; x += 1) c.set(x, y, COQUE[x < 2 ? 4 : x < 7 ? 3 : x < 10 ? 1 : 0]!)
  }
  c.rect(2, 3, 8, 4, BLEU[2]!)
  c.rect(2, 3, 4, 1, '#8CCBEA')
  for (const y of [10, 22]) c.rect(0, y, 12, 1, ROUGE[2]!)
  if (chargee) {
    c.rect(3, 13, 6, 6, INK)
    c.rect(4, 14, 4, 4, PAPIER)
    c.rect(5, 15, 2, 2, ROUGE[3]!)
  } else c.rect(3, 13, 6, 6, COQUE[0]!)
  return c
}

const ACCESSOIRES = ['cuve', 'parabole', 'caisses', 'panneaux'] as const

function accessoire(kind: (typeof ACCESSOIRES)[number]) {
  const c = canvas(26, 24)
  if (kind === 'cuve') {
    for (const [x, y, r] of [[8, 9, 8], [19, 15, 6.5]] as const) {
      disc(c, x + 1, y + 2, r, r, SH)
      disc(c, x, y, r, r, (a, b) => COQUE[a - x + (b - y) < -3 ? 4 : a - x + (b - y) < 2 ? 2 : a - x + (b - y) < 6 ? 1 : 0]!)
    }
    c.rect(6, 7, 4, 2, ROUGE[2]!)
    c.rect(18, 14, 3, 2, BLEU[3]!)
  }
  if (kind === 'parabole') {
    disc(c, 13, 13, 11, 10, SH)
    disc(c, 12, 11, 11, 10, (a, b, d) => (d > 0.84 ? COQUE[4]! : d < 0.2 ? ACIER[3]! : (a + b) % 5 === 0 ? COQUE[0]! : COQUE[2]!))
    c.rect(11, 10, 3, 3, ROUGE[3]!)
  }
  if (kind === 'caisses') {
    c.rect(2, 3, 24, 21, SH)
    box(c, 0, 0, 13, 11, '#3E5E78', '#5A82A0', '#26405A')
    box(c, 13, 3, 11, 9, ACIER[3]!, ACIER[5]!, ACIER[1]!)
    box(c, 3, 11, 16, 11, '#7A4A2A', '#A8703C', '#4E2E1A')
    c.rect(4, 15, 14, 1, '#4E2E1A')
    c.rect(5, 2, 4, 2, JAUNE[1]!)
  }
  if (kind === 'panneaux') {
    c.rect(1, 2, 25, 22, SH)
    for (let i = 0; i < 2; i += 1) {
      box(c, 0, i * 11, 24, 10, BLEU[2]!, BLEU[5]!, BLEU[0]!)
      for (let x = 4; x < 24; x += 4) c.rect(x, i * 11 + 1, 1, 8, BLEU[3]!)
    }
  }
  return c
}

// ---------- The plan ----------

type Lieu = { x: number; y: number; trace: Trace; depart: boolean }
type Plan = { k: number; fine: boolean; centre: Point; lieux: readonly Lieu[]; navette: Point; socle: Point; walk: readonly Point[] }

// A conversation keeps its place while the others come and go: each takes the next free one. The list is shuffled
// around the pad so that nothing reads as a sequence, and the first line is the one the shuttle runs on.
const OPEN: Plan = {
  k: 1,
  fine: false,
  centre: { x: 228, y: 10 },
  lieux: [
    { x: 562, y: 268, trace: [[268, 118], [268, 186], [281, 186]], depart: true },
    { x: 2, y: 268, trace: [[118, 118], [118, 186], [105, 186]], depart: true },
    { x: 282, y: 536, trace: [[144, 118], [144, 268]], depart: true },
    { x: 2, y: 16, trace: [[114, 55], [105, 55]], depart: false },
    { x: 562, y: 16, trace: [[272, 55], [281, 55]], depart: false },
    { x: 2, y: 536, trace: [[131, 118], [131, 255], [55, 255], [55, 268]], depart: true },
    { x: 562, y: 536, trace: [[255, 118], [255, 255], [335, 255], [335, 268]], depart: true },
  ],
  navette: { x: 524, y: 280 },
  socle: { x: 0, y: 0 },
  walk: [{ x: 262, y: 252 }, { x: 262, y: 510 }, { x: 510, y: 510 }, { x: 510, y: 252 }],
}

// Past eight, ten places at three quarters, the lines packed along the flanks of the centre, none crossing another.
const TIGHT: Plan = {
  k: 0.75,
  fine: true,
  centre: { x: 268, y: 8 },
  lieux: [
    { x: 412, y: 580, trace: [[244, 89], [244, 290]], depart: true },
    { x: 6, y: 200, trace: [[134, 50], [103, 50], [103, 135], [81, 135]], depart: false },
    { x: 616, y: 10, trace: [[252, 30], [308, 30]], depart: false },
    { x: 212, y: 580, trace: [[146, 89], [146, 290]], depart: true },
    { x: 616, y: 390, trace: [[252, 65], [276, 65], [276, 230], [308, 230]], depart: false },
    { x: 6, y: 10, trace: [[134, 30], [81, 30]], depart: false },
    { x: 6, y: 580, trace: [[134, 80], [123, 80], [123, 280], [42, 280], [42, 290]], depart: false },
    { x: 616, y: 200, trace: [[252, 50], [286, 50], [286, 135], [308, 135]], depart: false },
    { x: 6, y: 390, trace: [[134, 65], [113, 65], [113, 230], [81, 230]], depart: false },
    { x: 616, y: 580, trace: [[252, 80], [266, 80], [266, 280], [347, 280], [347, 290]], depart: false },
  ],
  navette: { x: 479, y: 212 },
  socle: { x: -10, y: -8 },
  walk: [{ x: 258, y: 200 }, { x: 258, y: 520 }, { x: 520, y: 520 }, { x: 520, y: 200 }],
}

const planOf = (n: number) => (n <= OPEN.lieux.length + 1 ? OPEN : TIGHT)

// Sizes on the plate of a sector or of the centre, in pixels at full scale.
const SECTOR = { w: 216, h: 208, titleW: 124 }
const CENTRE = { w: 324, h: 236, titleW: 190 }
const TOKENS = { dx: 178, dy: 10, chiefDx: 274, size: 14, ink: '#EDFFF5' }
const SIZE = { title: 16, chief: 18, state: 14, list: 12 }
const DOCK = -34
// Where the capsule lands, from the corner of the centre, and where it rides on the shuttle.
const TRAY = { x: 266, y: 152 }
const ROOF = { x: 6, y: 26 }
const FLY = { up: 0.35, tray: 0.8 }

const SPRITES: Record<string, () => Canvas> = {
  socle,
  aire: aireLibre,
  secteur: () => secteur(true),
  eteint: () => secteur(false),
  voile,
  centre,
  ecran,
  liste: () => liste(70),
  longue: () => liste(75),
  casier,
  capsule,
  navette: () => navette(true),
  vide: () => navette(false),
  'case-completed': () => caseListe(VERT[2]!),
  'case-in_progress': () => caseListe(OR[2]!),
  'case-pending': () => caseListe('#FFF6DE'),
  ...Object.fromEntries(ACCESSOIRES.map(a => [`acc-${a}`, () => accessoire(a)])),
  ...Object.fromEntries((['working', 'done', 'failed', 'rest'] as const).map(e => [`poste-${e}`, () => poste(e)])),
  ...Object.fromEntries(TENUES.map(x => [`buste-${x}`, () => buste(x)])),
}

const made = new Map<string, string>()
const defOf = (id: string) => {
  const ready = made.get(id)
  if (ready !== undefined) return ready
  const body = def(id, SPRITES[id]!())
  made.set(id, body)
  return body
}

const lignes = new Map<string, string>()
function ligneDef(plan: Plan, i: number) {
  const id = `${plan.fine ? 'rail' : 'voie'}${i}`
  if (!lignes.has(id)) lignes.set(id, def(id, ligne(plan.lieux[i]!.trace, plan.fine, plan.lieux[i]!.depart)))
  return { id, body: lignes.get(id)! }
}

const tenue = (hue: number) => TENUES[hue % TENUES.length]!
const at = (x: number, y: number, k: number, body: string) => `<g transform="translate(${x} ${y})${k === 1 ? '' : ` scale(${k})`}">${body}</g>`

type Pen = { u: (id: string, x?: number, y?: number) => string; say: (s: string, x: number, y: number, size: number, ink: string) => string }

function pen(): Pen & { sprites: Set<string>; words: () => string } {
  const sprites = new Set<string>()
  let words = ''
  return {
    sprites,
    words: () => words,
    u: (id, x = 0, y = 0) => {
      sprites.add(id)
      return use(id, x, y)
    },
    say: (s, x, y, size, ink) => {
      words += s
      return `<g class="tx">${line(s, x, y, size, ink)}</g>`
    },
  }
}

type Seated = { hue: number; state: DeskState | 'rest' }

/** A bench and whoever works at it. `hue` absent: a bench nobody sits at. */
function bench({ u }: Pen, x: number, y: number, hue?: number, state?: Seated['state']) {
  return `${hue === undefined ? '' : u(`buste-${tenue(hue)}`, x + 28, y - 6)}${u(`poste-${state ?? 'rest'}`, x, y)}`
}

/** Past what the benches hold, busts alone, as many as it takes in the room there is. */
function crowd({ u }: Pen, people: readonly Seated[], x: number, y: number, w: number, h: number) {
  const cols = Math.max(1, Math.floor(w / 24))
  const rows = Math.ceil(people.length / cols)
  const pitch = Math.min(24, h / rows)
  return people.map((p, i) => u(`buste-${tenue(p.hue)}`, x + (i % cols) * 24, Math.round(y + Math.floor(i / cols) * pitch))).join('')
}

function team(p: Pen, people: MapRoom['people']) {
  if (people.length === 0) return bench(p, 16, 54)
  if (people.length > 6) return crowd(p, people, 16, 30, SECTOR.w - 32, 132)
  return people.map((who, i) => bench(p, 16 + (i % 3) * 62, 54 + Math.floor(i / 3) * 52, who.hue, who.state)).join('')
}

/** The boss has his bench at work and at rest. */
function chiefTeam(p: Pen, team: MapRoom['people']) {
  const people: Seated[] = team[0]?.hue === 0 ? team : [{ hue: 0, state: 'rest' }, ...team]
  if (people.length === 1) return bench(p, 180, 108, people[0]!.hue, people[0]!.state)
  if (people.length > 3) return crowd(p, people, 176, 74, 124, 62)
  const spots = [[180, 92], [242, 92], [180, 142]] as const
  return people.map((who, i) => bench(p, spots[i]![0], spots[i]![1], who.hue, who.state)).join('')
}

function sectorRoom(p: Pen, r: MapRoom, detail: number) {
  // The sixth bench would stand where the sector keeps its prop.
  const prop = detail < 2 && r.people.length < 6 ? p.u(`acc-${ACCESSOIRES[pick(r.seed, 1, ACCESSOIRES.length)]!}`, 144, 104) : ''
  const shade = r.rest ? p.u('voile') : ''
  const title = fit(r.title, SIZE.title, SECTOR.titleW)
  const meta = fit(r.meta, SIZE.state, 164)
  return `${p.u(r.rest ? 'eteint' : 'secteur')}${p.u('ecran', 148, 6)}${prop}${team(p, r.people)}${shade}${p.say(title, 22, 14, SIZE.title, r.rest ? '#A8A6BC' : '#F2F4F8')}${p.say(meta, 26, 169, SIZE.state, r.rest ? '#C4C0D4' : '#FFC857')}`
}

/** A box and a name for each conversation, from `top`, every `pitch` pixels. */
function rowsOf(p: Pen, list: MapView['list'], top: number, pitch: number, size: number) {
  return list.map((row, i) => {
    const y = top + i * pitch
    return `${p.u(`case-${row.status}`, 28, Math.round(y + (size + 4 - 10) / 2))}${p.say(fit(row.text, size, 120), 42, Math.round(y), size, row.status === 'pending' ? '#8A8578' : INK)}`
  }).join('')
}

/**
 * The board of the centre. At full scale, as on the plan in a room. On a tight base the whole centre shrinks and it
 * has to stay legible: a taller sheet gives its heading's room to larger names.
 */
function board(p: Pen, list: MapView['list'], tight: boolean) {
  if (!tight) return `${p.u('liste', 16, 40)}${p.say(t('room.conversations'), 28, 47, SIZE.state, INK)}${rowsOf(p, list, 64, 15, SIZE.list)}`
  const pitch = Math.min(15, 142 / list.length)
  return `${p.u('longue', 16, 38)}${rowsOf(p, list, 42, pitch, Math.min(14, Math.floor(pitch)))}`
}

function badge(p: Pen, shown: number) {
  if (!shown) return ''
  const count = String(shown)
  const w = Math.max(20, Math.ceil(textWidth(count, SIZE.state)) + 8)
  const x = 300 - w
  return `<rect x="${x}" y="138" width="${w}" height="20" fill="${ROUGE[0]}"/><rect x="${x + 2}" y="140" width="${w - 4}" height="16" fill="${ROUGE[2]}"/>${p.say(count, Math.round(x + (w - textWidth(count, SIZE.state)) / 2), 140, SIZE.state, '#FFF6DE')}`
}

function chiefRoom(p: Pen, v: MapView) {
  const r = v.rooms[0]!
  const title = fit(r.title, SIZE.chief, CENTRE.titleW)
  const meta = fit(r.meta, SIZE.state, 176)
  return `${p.u('centre')}${p.u('ecran', 244, 6)}${board(p, v.list, v.rooms.length > OPEN.lieux.length + 1)}${chiefTeam(p, r.people)}${p.u('casier', 248, 142)}${badge(p, v.news.shown)}${p.say(title, 28, 14, SIZE.chief, '#F2F4F8')}${p.say(meta, 26, 193, SIZE.state, '#FFC857')}`
}

/** The shuttle up its line to the dock, the capsule on into the tray, then the shuttle home, empty. */
function flight(p: Pen, plan: Plan, flightS: number) {
  const { k, navette: n, centre: c } = plan
  const [fromX, fromY] = [n.x + ROOF.x * k, n.y + ROOF.y * k]
  const dx = Math.round((c.x + TRAY.x * k - fromX) / k)
  const dy = Math.round((c.y + TRAY.y * k - fromY) / k)
  const ride = `values="0 0;0 ${DOCK};0 ${DOCK};0 0" keyTimes="0;${FLY.up};${FLY.tray};1"`
  // A list of key times has to end on 1, or the browser drops the whole animation.
  const hop = `values="0 0;0 ${DOCK};0 ${dy};${dx} ${dy};${dx} ${dy}" keyTimes="0;${FLY.up};${(FLY.up + FLY.tray) / 2};${FLY.tray};1"`
  const moving = (how: string, body: string) => `<g><animateTransform attributeName="transform" type="translate" ${how} dur="${flightS}s" fill="freeze"/>${body}</g>`
  return `<g class="ev">${at(n.x, n.y, k, `${moving(ride, p.u('vide'))}${moving(hop, p.u('capsule', ROOF.x, ROOF.y))}`)}</g>`
}

// While the flight runs, its own shuttle takes the place of the one at the dock, unless motion is turned off.
const FLYING = '@media (prefers-reduced-motion: no-preference){.nv{display:none}}'

export const baseMap: MapPack = {
  back: TERRE[1]!,
  places(n) {
    const plan = planOf(n)
    const { k, lieux, centre: c } = plan
    return [{ x: c.x, y: c.y, w: CENTRE.w * k, h: CENTRE.h * k }, ...lieux.slice(0, n - 1).map(l => ({ x: l.x, y: l.y, w: SECTOR.w * k, h: SECTOR.h * k }))]
  },
  counts(n) {
    const { k, centre: c, lieux } = planOf(n)
    const { dx, dy, chiefDx, size, ink } = TOKENS
    const small = Math.round(size * k)
    return [{ x: c.x + chiefDx * k, y: c.y + dy * k, size: small, ink }, ...lieux.slice(0, n - 1).map(l => ({ x: l.x + dx * k, y: l.y + dy * k, size: small, ink }))]
  },
  walk(n) {
    return [...planOf(n).walk]
  },
  draw(v): MapDrawing {
    const plan = planOf(v.rooms.length)
    const p = pen()
    const { k, lieux, centre: c, navette: n, socle: s } = plan
    const taken = v.rooms.length - 1
    const free = v.detail < 1 ? lieux.slice(taken).map(l => at(l.x, l.y, k, p.u('aire'))).join('') : ''
    const back = `${p.u('socle', s.x, s.y)}${free}`
    const lines = lieux.slice(0, taken).map((_, i) => ligneDef(plan, i))
    const rooms = v.rooms.map((r, i) => (i === 0 ? at(c.x, c.y, k, chiefRoom(p, v)) : `${use(lines[i - 1]!.id)}${at(lieux[i - 1]!.x, lieux[i - 1]!.y, k, sectorRoom(p, r, v.detail))}`))
    const docked = at(n.x, n.y, k, p.u('navette'))
    const front = v.news.flying ? `<g class="nv">${docked}</g>${flight(p, plan, v.flightS)}` : docked
    const defs = [...p.sprites].map(defOf).join('') + lines.map(l => l.body).join('')
    return { defs, back, rooms, front, words: p.words(), style: `.tx{shape-rendering:geometricPrecision}${v.news.flying ? FLYING : ''}` }
  },
}
