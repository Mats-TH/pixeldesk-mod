import { t } from '../../i18n'
import { canvas, mix, noise, paths } from '../canvas'
import type { Canvas } from '../canvas'
import { fit, textWidth } from '../font'
import { WORLD, ZZ, once, pattern, pick } from '../pack'
import type { MapPack, MapRoom } from '../pack'
import { TENUES, person } from '../sprites'
import type { DeskState } from '../sprites'
import { def, line } from '../text'
import { bureau, chaise } from './geek-art'

type C = Canvas
type Ramp = readonly [string, string, string, string, string]
type Sol = { g: readonly [string, string, string]; t: readonly [string, string, string] }
type Box = { x: number; y: number; w: number; h: number }
type Spot = { x: number; y: number }

const BACK = '#14122A'
const SH = '#1B1730|0.28',
  CR = '#F4E4C1',
  PAP = '#FFF6DE',
  NOIR = '#0E0C16'
const NUIT = ['#120E1E', '#1C1630', '#2A2146', '#3A2E60', '#4E4080', '#6C5CA8'] as const
const ACIER = ['#181A24', '#262A38', '#3A3F52', '#565C74', '#8088A0', '#B8C0D4'] as const
const MAG: Ramp = ['#6A1450', '#A01E72', '#D83092', '#FF5AB4', '#FFA8DC']
const CYA: Ramp = ['#0C4A5A', '#127A8C', '#1EB4C4', '#4CE4E8', '#B0FAF8']
const JAU: Ramp = ['#8A5A10', '#C88A18', '#F4BC2C', '#FFE066', '#FFF6B0']
const VER: Ramp = ['#145A38', '#1E8A4C', '#38C468', '#7CF08C', '#C8FFC0']
const ROU: Ramp = ['#6E1420', '#A8202C', '#E03A3C', '#FF7060', '#FFB0A0']
const VIO: Ramp = ['#34186A', '#5228A0', '#7440D0', '#9A68F0', '#C8A8FC']
const BOIS = ['#1E1418', '#30222A', '#463038', '#604A4A', '#806660', '#A88C7C'] as const

const box = (c: C, x: number, y: number, w: number, h: number, b: string, l: string, d: string) => {
  c.rect(x, y, w, h, b)
  c.rect(x, y, w, 1, l)
  c.rect(x, y, 1, h, l)
  c.rect(x + w - 1, y, 1, h, d)
  c.rect(x, y + h - 1, w, 1, d)
}
const disc = (c: C, cx: number, cy: number, rx: number, ry: number, p: string | ((x: number, y: number) => string | null)) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue
      const q = typeof p === 'string' ? p : p(x, y)
      if (q) c.set(x, y, q)
    }
}
const trait = (c: C, x0: number, y0: number, x1: number, y1: number, p: string) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i += 1) c.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), p)
}
const tri = (c: C, cx: number, top: number, h: number, w: number, A: string, B: string) => {
  for (let j = 0; j < h; j += 1) {
    const r = Math.round(((j + 1) / h) * w)
    c.rect(cx - r, top + j, r, 1, A)
    c.rect(cx, top + j, r, 1, B)
  }
}

/** The ground of the map: a dark sky ruled like a game map, 130 by 130 cells, repeated. */
function motif(stars: boolean) {
  const c = canvas(130, 130)
  c.rect(0, 0, 130, 130, BACK)
  for (const k of [0, 65]) {
    c.rect(0, k, 130, 1, '#191734')
    c.rect(k, 0, 1, 130, '#191734')
  }
  if (!stars) return c
  for (let i = 0; i < 46; i += 1) c.set(Math.floor(noise(i, 501) * 130), Math.floor(noise(i, 502) * 130), i % 3 ? '#26234A' : '#332E60')
  for (const [x, y, p] of [
    [22, 34, '#3E3A72'],
    [96, 18, '#3E5088'],
    [48, 104, '#3E5088'],
    [112, 88, '#3E3A72'],
  ] as const) {
    c.rect(x - 2, y, 5, 1, p)
    c.rect(x, y - 2, 1, 5, p)
  }
  return c
}

const SOLS = {
  foret: { g: ['#1E4A34', '#2A6040', '#3E7A4C'], t: ['#1A1420', '#2A1E2E', '#3C2A38'] },
  desert: { g: ['#8A6230', '#A87C3C', '#C89C54'], t: ['#2C1C20', '#442A2A', '#5C3A32'] },
  glace: { g: ['#4E7A96', '#7CA8C0', '#B8D8E4'], t: ['#1C2A44', '#2A3E5C', '#3C5678'] },
  volcan: { g: ['#3A2228', '#4C2C30', '#64383A'], t: ['#180E16', '#261420', '#381C26'] },
  ville: { g: ['#2A2848', '#363458', '#4A4670'], t: ['#12101E', '#1C1A2E', '#2A2642'] },
  lune: { g: ['#4A4860', '#625F7A', '#827E98'], t: ['#1A1A2A', '#26263A', '#34344C'] },
  marais: { g: ['#2E4A3A', '#3C5C44', '#527A54'], t: ['#16181E', '#22242A', '#30322E'] },
} satisfies Record<string, Sol>
type Monde = keyof typeof SOLS
const ORDRE = Object.keys(SOLS) as Monde[]

/** A floating island: the top of its biome, a cliff in strata. `grain`: the flecks on top, the first thing to go. */
function ile(c: C, W: number, cy: number, rx: number, ry: number, prof: number, S: Sol, seed: number, pas = 3, grain = true) {
  const cx = (W - 1) / 2
  for (let k = 0; k * pas < W; k += 1) {
    const u = (k * pas + pas / 2 - cx) / rx
    if (Math.abs(u) >= 1) continue
    const s = Math.sqrt(1 - u * u)
    const top = Math.round(cy - ry * s - (noise(k, seed) > 0.6 ? 1 : 0))
    const bot = Math.round(cy + ry * s + (noise(k, seed + 1) > 0.5 ? 1 : 0))
    const fond = bot + Math.round(3 + prof * s * (0.55 + 0.45 * noise(k, seed + 2)))
    const x = k * pas
    c.rect(x, bot, pas, fond - bot, S.t[1])
    c.rect(x, bot, pas, 2, S.t[2])
    for (let y = bot + 5 + (k % 2) * 2; y < fond - 1; y += 5) c.rect(x, y, pas, 1, S.t[0])
    c.rect(x, fond, pas, 1, S.t[0])
    c.rect(x, top, pas, bot - top, S.g[1])
    c.rect(x, top, pas, 1, S.g[2])
    c.rect(x, bot - 1, pas, 1, S.g[0])
  }
  if (!grain) return
  for (let i = 0; i < W * 0.9; i += 1) {
    const [x, y] = [Math.floor(noise(i, seed + 3) * W), Math.round(cy - ry + noise(i, seed + 4) * 2 * ry)]
    if (c.get(x, y) === S.g[1] && c.get(x + 3, y) === S.g[1]) c.rect(x, y, 2 + (i % 3), 1, i % 2 ? S.g[0] : S.g[2])
  }
}

const sapin = (c: C, x: number, y: number, k: 0 | 1 = 0) => {
  const vert = k ? VER[2] : VER[1]
  c.rect(x - 1, y + 16, 2, 3, BOIS[3])
  tri(c, x, y, 7, 4, VER[0], vert)
  tri(c, x, y + 4, 7, 6, VER[0], vert)
  tri(c, x, y + 9, 7, 8, VER[0], vert)
  c.set(x - 1, y + 2, VER[3])
  c.set(x + 1, y + 7, VER[3])
  c.set(x + 3, y + 13, VER[3])
}

const DECORS: Record<Monde, (c: C) => void> = {
  foret(c) {
    sapin(c, 12, 11)
    sapin(c, 22, 5, 1)
    sapin(c, 57, 7, 1)
    sapin(c, 65, 13)
    disc(c, 40, 19, 6, 3, VER[1])
    disc(c, 39, 18, 3, 1.5, VER[2])
    c.rect(36, 22, 1, 1, ROU[3])
    c.rect(44, 20, 1, 1, JAU[3])
  },
  desert(c) {
    for (let j = 0; j < 20; j += 1) {
      c.rect(21 - j, 4 + j, j + 1, 1, '#E0B868')
      c.rect(21, 4 + j, j + 1, 1, '#A87C3C')
      if (j % 4 === 3) {
        c.rect(21 - j, 4 + j, j + 1, 1, '#C89C54')
        c.rect(21, 4 + j, j + 1, 1, '#8A6230')
      }
    }
    c.rect(19, 18, 4, 6, BOIS[0])
    c.rect(58, 8, 4, 16, VER[1])
    c.rect(58, 8, 1, 16, VER[3])
    c.rect(54, 12, 4, 2, VER[1])
    c.rect(54, 9, 2, 3, VER[2])
    c.rect(62, 15, 4, 2, VER[1])
    c.rect(64, 11, 2, 4, VER[1])
    disc(c, 44, 8, 4, 4, JAU[3])
    disc(c, 44, 8, 2.4, 2.4, JAU[4])
  },
  glace(c) {
    const cristal = (x: number, y: number, h: number, w: number) => {
      tri(c, x, y, h, w, CYA[3], CYA[2])
      c.rect(x - w, y + h, w, h, CYA[3])
      c.rect(x, y + h, w, h, CYA[1])
      c.rect(x - 1, y + 2, 1, h * 2 - 3, CYA[4])
    }
    cristal(14, 6, 7, 4)
    cristal(22, 12, 5, 3)
    cristal(7, 14, 4, 3)
    cristal(60, 8, 6, 4)
    cristal(67, 14, 4, 3)
    disc(c, 42, 24, 9, 8, (x, y) => (y > 24 ? null : y % 3 === 0 || (x + (y % 6 < 3 ? 0 : 3)) % 6 === 0 ? '#9CC4D8' : PAP))
    c.rect(39, 20, 6, 5, '#1C2A44')
  },
  volcan(c) {
    for (let j = 0; j < 24; j += 1) {
      const r = 7 + j
      c.rect(36 - r, 2 + j, r, 1, '#3A2228')
      c.rect(36, 2 + j, r, 1, '#2A161C')
    }
    c.rect(29, 2, 14, 2, ROU[2])
    c.rect(30, 1, 12, 1, ROU[3])
    c.rect(33, 2, 6, 1, JAU[3])
    for (const [a, b, d, e] of [
      [34, 4, 30, 16],
      [30, 16, 34, 25],
      [39, 4, 42, 12],
      [42, 12, 47, 22],
    ] as const) {
      trait(c, a, b, d, e, ROU[2])
      trait(c, a + 1, b, d + 1, e, JAU[2])
    }
    for (const [x, y, r] of [
      [26, -1, 2],
      [46, 0, 1.6],
      [34, -2, 1.4],
    ] as const)
      disc(c, x, y + 2, r, r, '#4A4458')
  },
  ville(c) {
    const imm = (x: number, w: number, h: number, A: Ramp) => {
      const y = 26 - h
      c.rect(x, y, w, h, NUIT[2])
      c.rect(x, y, 1, h, NUIT[4])
      c.rect(x, y, w, 1, A[3])
      for (let j = y + 2; j < 25; j += 3) for (let i = x + 2; i < x + w - 1; i += 2) if (noise(i, j) > 0.34) c.set(i, j, noise(j, i) > 0.5 ? JAU[3] : A[3])
    }
    imm(7, 9, 15, CYA)
    imm(15, 8, 22, MAG)
    imm(52, 9, 24, VIO)
    imm(60, 9, 14, CYA)
    imm(25, 7, 11, JAU)
    c.rect(19, 0, 1, 4, ACIER[4])
    c.set(19, 0, ROU[3])
    c.rect(44, 12, 7, 14, NUIT[1])
    c.rect(45, 13, 5, 3, MAG[3])
    c.rect(45, 13, 5, 1, MAG[4])
  },
  lune(c) {
    for (const [x, y, r] of [
      [13, 32, 5],
      [62, 36, 4],
      [27, 41, 3],
      [55, 27, 3],
    ] as const) {
      disc(c, x, y, r + 1, (r + 1) * 0.5, '#827E98')
      disc(c, x, y + 0.5, r, r * 0.45, '#4A4860')
    }
    const R = ['.....a.....', '....aaa....', '...abbba...', '...abcba...', '...abdba...', '...abcba...', '...abbba...', '..eabbbae..', '.eeabbbaee.', '.ee.fff.ee.', '....g.g....', '...ggggg...']
    c.sprite(R, { a: ROU[2], b: PAP, c: CYA[3], d: '#1A2448', e: ROU[1], f: ACIER[3], g: JAU[3] }, 12, 8)
    c.rect(58, 6, 1, 18, ACIER[4])
    c.rect(59, 6, 9, 5, MAG[2])
    c.rect(59, 6, 9, 1, MAG[4])
    c.rect(62, 8, 3, 1, PAP)
  },
  marais(c) {
    disc(c, 44, 33, 15, 5, '#1C3A44')
    disc(c, 42, 32, 10, 3, '#285060')
    c.rect(40, 32, 6, 1, '#4E8AA0')
    trait(c, 15, 28, 13, 6, BOIS[3])
    trait(c, 16, 28, 14, 6, BOIS[1])
    trait(c, 14, 15, 7, 9, BOIS[3])
    trait(c, 14, 12, 21, 6, BOIS[3])
    trait(c, 18, 9, 22, 11, BOIS[3])
    for (const x of [60, 63, 66]) {
      c.rect(x, 18 + (x % 4), 1, 10, VER[1])
      c.rect(x - 1, 15 + (x % 4), 2, 4, BOIS[3])
    }
    disc(c, 8, 28, 4, 2, VER[0])
    disc(c, 25, 24, 3, 1.5, VER[1])
    c.rect(32, 20, 1, 1, JAU[4])
    c.rect(38, 16, 1, 1, JAU[4])
    c.rect(52, 22, 1, 1, JAU[4])
  },
}

/** A world: its island and its scenery, 75 by 60 cells. `sobre`: what the size limit leaves of it. */
function niveau(monde: Monde, sobre: number) {
  const c = canvas(75, 60)
  ile(c, 75, 32, 37, 14, 10, SOLS[monde], monde.length * 17 + monde.charCodeAt(0), sobre > 1 ? 5 : 3, !sobre)
  if (sobre < 3) DECORS[monde](c)
  return c
}

/** A person's post: a small arcade counter, with the light of their state. 18 by 12 cells. */
function poste(etat: DeskState) {
  const c = canvas(18, 12)
  const A = { working: CYA, done: VER, failed: ROU }[etat]
  c.rect(1, 11, 16, 1, SH)
  c.rect(0, 0, 18, 11, NUIT[1])
  c.rect(0, 0, 18, 2, NUIT[4])
  c.rect(0, 0, 18, 1, NUIT[5])
  c.rect(0, 10, 18, 1, NUIT[0])
  c.rect(1, 2, 1, 8, NUIT[3])
  c.rect(4, 4, 10, 4, NOIR)
  c.rect(5, 5, 8, 2, A[1])
  c.rect(5, 5, 8, 1, A[3])
  if (etat === 'done') c.sprite(['....x', '.x.x.', '..x..'], { x: PAP }, 7, 4)
  if (etat === 'failed') {
    c.rect(8, 4, 2, 3, PAP)
    c.set(8, 7, PAP)
    c.set(9, 7, PAP)
  }
  c.rect(2, 9, 14, 1, A[2])
  return c
}

/** A world's plate: name, state and score. `W` cells wide, 20 tall. */
function cartouche(repos: boolean, W: number) {
  const c = canvas(W, 20)
  const [a, b, l] = repos ? ['#2A2438', '#342C46', '#4F4560'] : [NUIT[1], NUIT[2], NUIT[5]]
  c.rect(1, 18, W, 2, SH)
  c.rect(1, 0, W - 2, 18, b)
  c.rect(0, 1, W, 16, b)
  c.rect(1, 0, W - 2, 1, l)
  c.rect(1, 17, W - 2, 1, NUIT[0])
  c.rect(0, 1, 1, 16, repos ? l : MAG[3])
  c.rect(W - 1, 1, 1, 16, repos ? l : CYA[3])
  c.rect(2, 2, W - 4, 14, a)
  // The score's coin, in front of the number.
  const [p, q, r] = repos ? ['#6A6280', '#8A84A0', '#4F4560'] : [JAU[2], JAU[4], JAU[0]]
  disc(c, W - 21, 12, 2.5, 2.5, p)
  c.set(W - 22, 11, q)
  c.rect(W - 21, 11, 1, 3, r)
  return c
}

/** The sign of a world at rest. 26 by 22 cells. */
function pause() {
  const c = canvas(26, 22)
  c.rect(2, 2, 24, 20, SH)
  c.rect(1, 0, 22, 20, NOIR)
  c.rect(0, 1, 24, 18, NOIR)
  c.rect(1, 1, 22, 18, '#2A2438')
  c.rect(1, 1, 22, 1, '#6A6280')
  for (const x of [7, 14]) {
    c.rect(x, 5, 4, 10, CR)
    c.rect(x, 5, 4, 1, PAP)
    c.rect(x + 3, 6, 1, 9, '#C8B48C')
  }
  return c
}

/** The arcade coin that carries the news. 9 by 10 cells. */
function piece() {
  const c = canvas(9, 10)
  disc(c, 4, 5, 4.4, 4.4, JAU[0])
  disc(c, 4, 4, 4.4, 4.2, JAU[2])
  disc(c, 4, 4, 3, 2.8, JAU[3])
  c.rect(3, 2, 3, 5, JAU[1])
  c.rect(4, 3, 1, 3, JAU[4])
  c.set(2, 1, PAP)
  return c
}

/** The coin box: coins fall in, its window shows the pile. 24 by 38 cells. */
function monnayeur(pile: number) {
  const c = canvas(24, 38)
  c.rect(2, 35, 21, 3, SH)
  for (let j = 0; j < 5; j += 1) c.rect(1 + j, j, 22 - j * 2, 1, j ? ACIER[3] : ACIER[5])
  c.rect(7, 0, 10, 2, NOIR)
  box(c, 3, 5, 18, 30, ACIER[2], ACIER[4], ACIER[0])
  c.rect(3, 7, 18, 1, MAG[3])
  c.rect(3, 31, 18, 1, CYA[3])
  box(c, 6, 9, 12, 13, NOIR, ACIER[0], ACIER[4])
  for (let i = 0; i < pile; i += 1) {
    const y = 18 - i * 3
    c.rect(8, y, 8, 2, JAU[2])
    c.rect(8, y, 8, 1, JAU[4])
    c.rect(8, y + 2, 8, 1, JAU[0])
  }
  c.rect(7, 10, 1, 4, '#FFFFFF|0.2')
  c.rect(10, 24, 4, 5, ACIER[0])
  c.rect(11, 25, 2, 3, ROU[3])
  c.set(11, 25, ROU[4])
  for (const [x, y] of [
    [5, 24],
    [18, 24],
    [5, 29],
    [18, 29],
  ] as const)
    c.set(x, y, ACIER[5])
  for (const x of [5, 16]) c.rect(x, 35, 4, 1, NOIR)
  return c
}

/** The boss's great board, the list of the worlds. 100 by 88 cells. */
function tableauNiveaux() {
  const [W, H] = [100, 88]
  const c = canvas(W, H)
  const cx = 49
  const hw = (y: number) => (y < 9 ? Math.round(30 + 18 * Math.sqrt(1 - ((9 - y) / 9) ** 2)) : 48)
  for (let y = 0; y < H - 6; y += 1) c.rect(cx - hw(y) + 2, y + 2, hw(y) * 2, 1, '#0F0A1A|0.38')
  for (let y = 0; y < H - 6; y += 1) {
    const w = hw(y)
    c.rect(cx - w, y, w * 2, 1, NUIT[2])
    c.set(cx - w, y, MAG[3])
    c.set(cx - w + 1, y, MAG[1])
    c.set(cx + w - 1, y, CYA[3])
    c.set(cx + w - 2, y, CYA[1])
  }
  c.rect(cx - 30, 0, 60, 1, MAG[4])
  for (let y = 1; y < 9; y += 1) {
    const w = hw(y)
    if (w - hw(y - 1) > 1) {
      c.rect(cx - w, y, w - hw(y - 1), 1, MAG[3])
      c.rect(cx + hw(y - 1), y, w - hw(y - 1), 1, CYA[3])
    }
  }
  for (let y = 3; y < 9; y += 1) {
    const w = hw(y) - 4
    c.rect(cx - w, y, w * 2, 1, NUIT[1])
  }
  c.sprite(['..aaaaaaaaa..', 'bbabbbbbbbabb', 'b.acbbbbbba.b', '.bacbbbbbab..', '...acbbba....', '.....ab......', '....aaba.....'], { a: JAU[1], b: JAU[3], c: JAU[4] }, cx - 6, 1)
  c.rect(5, 9, W - 11, H - 17, CYA[1])
  c.rect(5, 9, W - 11, 1, CYA[2])
  c.rect(6, 10, W - 13, H - 19, '#100C20')
  const bulbe = (x: number, y: number, k: number) => {
    const A = k % 4 === 3 ? [JAU[0], JAU[1]] : [JAU[3], JAU[4]]
    c.rect(x, y, 2, 2, A[0]!)
    c.set(x, y, A[1]!)
  }
  for (let i = 0; i < 17; i += 1) {
    bulbe(2, 12 + i * 4, i)
    bulbe(W - 5, 12 + i * 4, i + 2)
  }
  for (const [x, y, k] of [
    [12, 5, 0],
    [7, 7, 1],
    [82, 5, 2],
    [87, 7, 0],
    [20, 2, 1],
    [74, 2, 0],
    [28, 1, 2],
    [66, 1, 1],
  ] as const)
    bulbe(x, y, k)
  c.rect(0, H - 6, W, 4, NUIT[3])
  c.rect(0, H - 6, W, 1, NUIT[5])
  c.rect(0, H - 3, W, 1, NUIT[0])
  for (const [x, A] of [
    [6, MAG],
    [12, CYA],
    [82, CYA],
    [88, MAG],
  ] as const) {
    c.rect(x, H - 5, 4, 2, A[1])
    c.rect(x, H - 5, 4, 1, A[3])
  }
  return c
}

const LETTRES: Record<string, readonly string[]> = {
  B: ['xxxx.', 'x...x', 'xxxx.', 'x...x', 'xxxx.'],
  O: ['.xxx.', 'x...x', 'x...x', 'x...x', '.xxx.'],
  S: ['.xxxx', 'x....', '.xxx.', '....x', 'xxxx.'],
}

/** The boss's stronghold, on the largest island. 204 by 128 cells. */
function forteresse() {
  const c = canvas(204, 128)
  ile(c, 204, 100, 101, 18, 10, { g: ['#241C3C', '#2E2650', '#44386C'], t: ['#120E1E', '#1E1630', '#2C2244'] }, 901, 6)
  c.rect(10, 16, 184, 74, NUIT[1])
  for (let j = 0; j < 7; j += 1) {
    const y = 16 + j * 11
    c.rect(10, y, 184, 1, NUIT[3])
    c.rect(10, y + 10, 184, 1, NUIT[0])
    for (let x = 118 + (j % 2) * 12; x < 194; x += 24) c.rect(x, y, 1, 11, NUIT[0])
  }
  for (let x = 10; x < 194; x += 9) {
    c.rect(x, 10, 6, 6, NUIT[2])
    c.rect(x, 10, 6, 1, NUIT[5])
  }
  // The great gate, behind the desk.
  c.rect(126, 40, 58, 50, NUIT[3])
  for (let j = 0; j < 8; j += 1) {
    const r = Math.round(Math.sqrt(1 - ((8 - j) / 9) ** 2) * 28)
    c.rect(155 - r, 34 + j, r * 2, 1, NUIT[3])
  }
  c.rect(130, 44, 50, 46, NOIR)
  for (let j = 0; j < 6; j += 1) {
    const r = Math.round(Math.sqrt(1 - ((6 - j) / 7) ** 2) * 25)
    c.rect(155 - r, 38 + j, r * 2, 1, NOIR)
  }
  for (let x = 134; x < 178; x += 6) c.rect(x, 42, 1, 26, CYA[0])
  for (let y = 48; y < 68; y += 6) c.rect(130, y, 50, 1, CYA[0])
  c.rect(130, 88, 50, 2, MAG[2])
  // The boss's sign.
  c.rect(130, 18, 50, 15, NOIR)
  c.rect(130, 18, 50, 1, MAG[3])
  c.rect(130, 32, 50, 1, CYA[3])
  ;[...'BOSS'].forEach((k, i) =>
    LETTRES[k]!.forEach((row, j) =>
      [...row].forEach((ch, n) => {
        if (ch !== 'x') return
        c.rect(133 + i * 11 + n * 2, 21 + j * 2, 2, 2, JAU[3])
        c.set(133 + i * 11 + n * 2, 21 + j * 2, JAU[4])
      }),
    ),
  )
  const tour = (x: number, A: Ramp) => {
    box(c, x, 4, 24, 86, NUIT[2], NUIT[4], NUIT[0])
    for (let y = 12; y < 86; y += 8) c.rect(x + 1, y, 22, 1, NUIT[1])
    for (let i = 0; i < 3; i += 1) {
      c.rect(x + i * 9, 0, 6, 5, NUIT[3])
      c.rect(x + i * 9, 0, 6, 1, NUIT[5])
    }
    c.rect(x + 9, 16, 6, 12, NOIR)
    c.rect(x + 10, 17, 4, 10, A[2])
    c.rect(x + 10, 17, 4, 1, A[4])
    c.rect(x + 4, 34, 16, 26, A[1])
    c.rect(x + 4, 34, 16, 1, A[3])
    for (let i = 0; i < 4; i += 1) c.rect(x + 4 + i * 4, 60, 2, 2, A[1])
    c.rect(x + 8, 40, 8, 8, JAU[2])
    c.rect(x + 10, 42, 4, 4, NUIT[1])
    c.rect(x + 11, 74, 2, 2, A[3])
  }
  tour(2, MAG)
  tour(178, CYA)
  for (let x = 26; x < 178; x += 1) c.set(x, 89, mix(MAG[3], CYA[3], (x - 26) / 152))
  return c
}

/** One dotted ray from `a` to `b`, a dot every 7 cells: `libre` says where a dot may stand, in pixels of the world. */
function pointilles(c: C, a: Spot, b: Spot, col: string, libre: (x: number, y: number) => boolean) {
  const n = Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2)
  for (let k = 0; k < n; k += 7) {
    const [px, py] = [a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n]
    if (!libre(px, py)) continue
    const [x, y] = [Math.round(px / 2), Math.round(py / 2)]
    c.rect(x - 1, y + 1, 3, 1, '#0A0818')
    c.rect(x - 1, y - 1, 3, 2, col)
  }
}

const MENTIONS = { work: '#FFC857', rest: '#C9BEDB', failed: '#FF7060' }
const BOARD_INKS = { in_progress: [JAU[3], CR], completed: ['#4E8F5A', '#A8A4C4'], pending: ['#2A2438', '#8A84A8'], failed: [ROU[2], ROU[3]] } as const
const RAIL = { completed: '#5FC9B8', in_progress: '#FFC857', pending: '#3A3355' } as const

// Ten worlds at most. The lower arc takes the larger half; both keep the same pitch and tuck their ends in by the boss.
const HAUT: Record<number, readonly (readonly [number, number])[]> = {
  0: [],
  1: [[306, 8]],
  2: [[120, 60], [492, 60]],
  3: [[14, 78], [304, 8], [598, 92]],
  4: [[14, 240], [160, 50], [452, 50], [598, 240]],
  5: [[12, 250], [120, 60], [306, 8], [492, 60], [600, 250]],
}
const BAS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[306, 590]],
  2: [[120, 560], [492, 560]],
  3: [[16, 506], [306, 590], [596, 504]],
  4: [[16, 506], [212, 590], [402, 586], [596, 504]],
  5: [[12, 424], [120, 590], [306, 598], [492, 590], [600, 424]],
}
const [WORLD_W, WORLD_H, BOSS_W, BOSS_H] = [168, 160, 408, 256]

/** The places of `k` worlds, dealt in a fixed scatter: going round the map never reads as going down the list. */
function dealt(k: number) {
  const all = [...BAS[Math.ceil(k / 2)]!, ...HAUT[Math.floor(k / 2)]!]
  return all.map((p, i) => ({ p, o: noise(i, k * 73) })).sort((a, b) => a.o - b.o).map(o => ({ x: o.p[0], y: o.p[1] }))
}

/** The map for `n` conversations. One or two worlds bring it closer: everything at 1.5, the boss above, the worlds below. */
function layout(n: number) {
  const k = Math.min(n - 1, 10)
  const s = k <= 2 ? 1.5 : 1
  const boss = s > 1 ? { x: 84, y: 36 } : { x: 186, y: 252 }
  const worlds = s === 1 ? dealt(k) : (k === 1 ? [264] : [92, 436]).slice(0, k).map(x => ({ x, y: 500 }))
  return { s, boss, worlds }
}

const hit = (x: number, y: number, b: Box) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
const middle = (w: Spot, s: number) => ({ x: w.x + 84 * s, y: w.y + 60 * s })
const scaled = (p: Spot, s: number) => `<g transform="translate(${p.x} ${p.y})${s > 1 ? ` scale(${s})` : ''}">`
const useAt = (id: string, x: number, y: number, more = '') => `<use href="#${id}" x="${x}" y="${y}"${more}/>`

const ART = {
  fort: once(forteresse),
  tableau: once(tableauNiveaux),
  chaise: once(chaise),
  piece: once(piece),
  pause: once(pause),
  fond: [once(() => motif(true)), once(() => motif(false))],
  allume: once(() => cartouche(false, 84)),
  eteint: once(() => cartouche(true, 84)),
  long: once(() => cartouche(false, 150)),
}

const stopped = (r: MapRoom) => r.people.length > 0 && r.people.every(p => p.state === 'failed')
// Those who finished still stand at their post: only an empty world goes dark.
const dark = (r: MapRoom) => r.rest && !r.people.length

/** What the coin flies along: to the mouth of the coin box, round the stronghold when it starts below it. */
function route(from: Spot, boss: Spot, s: number) {
  const mouth = { x: boss.x + 384 * s, y: boss.y + 118 * s }
  const above = { x: mouth.x, y: mouth.y - 34 * s }
  const round = { x: boss.x + (BOSS_W + 16) * s, y: boss.y + (BOSS_H + 2) * s }
  return from.y > above.y ? [from, round, above, mouth] : [from, above, mouth]
}

export const geekMap: MapPack = {
  back: BACK,
  places(n) {
    const { s, boss, worlds } = layout(n)
    return [{ x: boss.x, y: boss.y, w: BOSS_W * s, h: BOSS_H * s }, ...worlds.map(w => ({ x: w.x, y: w.y, w: WORLD_W * s, h: WORLD_H * s }))]
  },
  counts(n) {
    const { s, boss, worlds } = layout(n)
    const size = 16 * s
    return [{ x: boss.x + 334 * s, y: boss.y + 225 * s, size, ink: MENTIONS.work }, ...worlds.map(w => ({ x: w.x + 148 * s, y: w.y + 137 * s, size, ink: MENTIONS.work }))]
  },
  walk(n) {
    const { s, boss, worlds } = layout(n)
    const [w, h] = [BOSS_W * s, BOSS_H * s]
    const c = { x: boss.x + w / 2, y: boss.y + h / 2 }
    const angle = (p: Spot) => Math.atan2(p.y - c.y, p.x - c.x)
    // Out along each ray and back, the rim of the stronghold between two: the crab keeps to the star.
    const rim = (p: Spot) => {
      const k = Math.min(w / 2 / Math.max(Math.abs(p.x - c.x), 1), h / 2 / Math.max(Math.abs(p.y - c.y), 1))
      return { x: Math.round(c.x + (p.x - c.x) * k), y: Math.round(c.y + (p.y - c.y) * k) }
    }
    const corners = [boss, { x: boss.x + w, y: boss.y }, { x: boss.x + w, y: boss.y + h }, { x: boss.x, y: boss.y + h }]
    // It turns back short of the island, whose people stand at the end of the ray.
    const short = (from: Spot, to: Spot) => ({ x: Math.round(from.x + (to.x - from.x) * 0.72), y: Math.round(from.y + (to.y - from.y) * 0.72) })
    const stops = [...worlds.map(p => middle(p, s)).map(p => ({ a: angle(p), path: [rim(p), short(rim(p), p), rim(p)] })), ...corners.map(p => ({ a: angle(p), path: [p] }))]
    return stops.sort((a, b) => a.a - b.a).flatMap(o => o.path)
  },
  draw(v) {
    const { s, boss, worlds } = layout(v.rooms.length)
    const sobre = Math.min(3, Math.max(0, v.detail - 1))
    const defs = new Map<string, string>()
    const need = (id: string, draw: () => C) => {
      if (!defs.has(id)) defs.set(id, def(id, draw()))
      return id
    }
    let words = ''
    const write = (text: string, x: number, y: number, size: number, ink: string) => {
      words += text
      return line(text, x, y, size, ink)
    }

    const row = (people: MapRoom['people'], cx: number, room: number, y: number) => {
      const gap = people.length > 1 ? Math.min(36, Math.floor(room / (people.length - 1))) : 0
      const left = Math.round(cx - (36 + (people.length - 1) * gap) / 2)
      return people
        .map((p, i) => {
          const tenue = TENUES[p.hue % TENUES.length]!
          const x = left + i * gap
          return useAt(need(`gkP${tenue}`, () => person(tenue)), x + 2, y - 30) + useAt(need(`gkT${p.state}`, () => poste(p.state)), x, y)
        })
        .join('')
    }

    const plate = (r: MapRoom, id: string, y: number, titleW: number, metaW: number, ink: string, titleInk = CR) =>
      useAt(id, 0, y) + write(fit(r.title, 16, titleW), 8, y + 2, 16, titleInk) + write(fit(r.meta, 16, metaW), 8, y + 17, 16, ink)

    const world = (r: MapRoom, at: Spot) => {
      const monde = ORDRE[pick(r.seed, 7, ORDRE.length)]!
      const iso = need(`gkI${monde}`, () => niveau(monde, sobre))
      const off = dark(r)
      const front = off ? useAt(need('gkZ', ART.pause), 57, 44) : row(r.people, 84, 120, 70)
      const ink = off ? MENTIONS.rest : stopped(r) ? MENTIONS.failed : MENTIONS.work
      const card = plate(r, need(off ? 'gkCo' : 'gkCa', off ? ART.eteint : ART.allume), 120, 152, 116, ink, off ? MENTIONS.rest : CR)
      return `${scaled(at, s)}${useAt(iso, 9, 0, off ? ' opacity=".42"' : '')}${front}${card}</g>`
    }

    const board = () => {
      const rows = v.list
      const pitch = rows.length > 8 ? 11.5 : 13
      const body = rows.map((l, i) => {
        const room = v.rooms[i + 1]
        const look = BOARD_INKS[room && stopped(room) ? 'failed' : l.status]
        const y = Math.round(i * pitch)
        return `<rect x="50" y="${59 + y}" width="10" height="10" fill="#6C5CA8"/><rect x="52" y="${61 + y}" width="6" height="6" fill="${look[0]}"/>${write(fit(l.text, 12, 150), 65, 57 + y, 12, look[1])}`
      })
      return useAt(need('gkB', ART.tableau), 32, 16) + write(fit(t('room.conversations'), 16, 150), 50, 37, 16, JAU[3]) + body.join('')
    }

    // One case per conversation it leads, as a plan's rail has one per step: those done first, then those at work.
    const rail = () => {
      const order = ['completed', 'in_progress', 'pending'] as const
      const cases = order.flatMap(st => v.list.filter(l => l.status === st).map(() => RAIL[st]))
      const pitch = 102 / Math.max(cases.length, 1)
      return `<rect x="8" y="52" width="104" height="8" fill="#1B1730"/>${cases
        .map((ink, i) => {
          const x = Math.round(i * pitch)
          return `<rect x="${10 + x}" y="54" width="${Math.round((i + 1) * pitch) - 2 - x}" height="4" fill="${ink}"/>`
        })
        .join('')}`
    }

    const chief = (r: MapRoom) => {
      const atWork = r.people[0]?.hue === 0
      const crew = atWork ? r.people.slice(1) : r.people
      const seat = atWork ? 'working' : 'rest'
      const name = t('role.manager')
      const nameX = Math.round(60 - textWidth(name, 16) / 2)
      const manager = `<g transform="translate(244 100)">${useAt(need('gkS', ART.chaise), 0, 0)}${useAt(need('gkPCorail', () => person('Corail')), 44, -4)}${useAt(need(`gkD${seat}`, () => bureau(seat)), 0, 0)}${atWork ? '' : `<path fill="${CR}" d="${ZZ}"/>`}${rail()}${write(name, nameX, 61, 16, '#1B1730')}</g>`
      const pile = Math.min(v.news.shown, 3)
      const coins = useAt(need(`gkM${pile}`, () => monnayeur(pile)), 360, 116)
      const count = String(v.news.shown)
      const w = Math.max(30, Math.ceil(textWidth(count, 16)) + 12)
      const badge = v.news.shown ? `<rect x="${406 - w}" y="100" width="${w}" height="20" fill="#1B1730"/><rect x="${408 - w}" y="102" width="${w - 4}" height="16" fill="#B8452A"/>${write(count, Math.round(406 - w / 2 - textWidth(count, 16) / 2), 101, 16, PAP)}` : ''
      const card = `<g transform="translate(54 0)">${plate(r, need('gkCl', ART.long), 208, 284, 238, MENTIONS.work)}</g>`
      // Figma seats the manager alone: whoever else works there keeps watch on the rampart.
      return `${scaled(boss, s)}${useAt(need('gkF', ART.fort), 0, 0)}${board()}${row(crew, 296, 80, 12)}${manager}${coins}${badge}${card}</g>`
    }

    const flight = () => {
      if (!v.news.flying || !worlds.length) return ''
      const mouth = { x: boss.x + 384 * s, y: boss.y + 118 * s }
      const near = (p: Spot) => Math.hypot(p.x - mouth.x, p.y - mouth.y)
      const from = worlds.map((w, i) => ({ w, on: !dark(v.rooms[i + 1]!) })).sort((a, b) => Number(b.on) - Number(a.on) || near(a.w) - near(b.w))[0]!.w
      const path = route({ x: from.x + 76 * s, y: from.y + 20 * s }, boss, s)
      const legs = path.slice(1).map((p, i) => Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y))
      const total = legs.reduce((a, b) => a + b, 0)
      let walked = 0
      const times = [0, ...legs.map(l => Math.round(((walked += l) / total) * 1000) / 1000)]
      const dots = canvas(WORLD.w / 2, WORLD.h / 2)
      const clear = (x: number, y: number) => !hit(x, y, { x: boss.x, y: boss.y, w: BOSS_W * s, h: BOSS_H * s }) && !worlds.some(w => hit(x, y, { x: w.x, y: w.y, w: WORLD_W * s, h: WORLD_H * s }))
      path.slice(1).forEach((p, i) => pointilles(dots, path[i]!, p, JAU[3], clear))
      const spots = path.map(p => `${Math.round(p.x - 9 * s)} ${Math.round(p.y - 10 * s)}`).join(';')
      const keys = times.join(';')
      const fade = `<animate attributeName="opacity" values="1;1;0" keyTimes="0;.92;1" dur="${v.flightS}s" fill="freeze"/>`
      return `<g class="ev">${fade}<g transform="scale(2)">${paths(dots)}</g><g><animateTransform attributeName="transform" type="translate" values="${spots}" keyTimes="${keys}" dur="${v.flightS}s" fill="freeze"/>${s > 1 ? `<g transform="scale(${s})">` : ''}${useAt(need('gkO', ART.piece), 0, 0)}${s > 1 ? '</g>' : ''}</g></g>`
    }

    // The links run behind everything: what the stronghold covers needs no dot of its own.
    const links = canvas(WORLD.w / 2, WORLD.h / 2)
    const centre = { x: boss.x + (BOSS_W / 2) * s, y: boss.y + (BOSS_H / 2) * s }
    const inner = { x: boss.x + 60 * s, y: boss.y + 40 * s, w: (BOSS_W - 120) * s, h: (BOSS_H - 80) * s }
    worlds.forEach((w, i) => {
      const free = (x: number, y: number) => !hit(x, y, inner) && !worlds.some(o => hit(x, y, { x: o.x - 6, y: o.y - 6, w: WORLD_W * s + 12, h: WORLD_H * s + 12 }))
      pointilles(links, centre, middle(w, s), dark(v.rooms[i + 1]!) ? '#3A3468' : '#8A7648', free)
    })

    const rooms = v.rooms.map((r, i) => (i ? world(r, worlds[i - 1]!) : chief(r)))
    const front = flight()
    const back = `<rect width="${WORLD.w}" height="${WORLD.h}" fill="url(#gkFond)"/><g transform="scale(2)">${paths(links)}</g>`
    const ground = pattern('gkFond', ART.fond[v.detail ? 1 : 0]!())
    return { defs: ground + [...defs.values()].join(''), back, rooms, front, words }
  },
}
