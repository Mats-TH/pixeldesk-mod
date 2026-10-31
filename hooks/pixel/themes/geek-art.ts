import { canvas, mix, noise, paths } from '../canvas'
import type { Canvas } from '../canvas'
import type { DeskState } from '../sprites'

type C = Canvas
type Ramp = readonly [string, string, string, string, string]
type Points = readonly (readonly [number, number])[]
type Pips = 1 | 2 | 3 | 4 | 5 | 6
type Face = (u: number, v: number) => readonly [number, number]

const INK = '#2A2036'
const SH = '#1B1730|0.28'
const CR = '#F4E4C1'
const PAP = '#FFF6DE'
const NOIR = '#0E0C16'
const NUIT = ['#120E1E', '#1C1630', '#2A2146', '#3A2E60', '#4E4080', '#6C5CA8'] as const
const ACIER = ['#181A24', '#262A38', '#3A3F52', '#565C74', '#8088A0', '#B8C0D4'] as const
const MAG = ['#6A1450', '#A01E72', '#D83092', '#FF5AB4', '#FFA8DC'] as const
const CYA = ['#0C4A5A', '#127A8C', '#1EB4C4', '#4CE4E8', '#B0FAF8'] as const
const JAU = ['#8A5A10', '#C88A18', '#F4BC2C', '#FFE066', '#FFF6B0'] as const
const VER = ['#145A38', '#1E8A4C', '#38C468', '#7CF08C', '#C8FFC0'] as const
const ROU = ['#6E1420', '#A8202C', '#E03A3C', '#FF7060', '#FFB0A0'] as const
const VIO = ['#34186A', '#5228A0', '#7440D0', '#9A68F0', '#C8A8FC'] as const
const BOIS = ['#1E1418', '#30222A', '#463038', '#604A4A', '#806660', '#A88C7C'] as const

const box = (c: C, x: number, y: number, w: number, h: number, b: string, l: string, d: string) => {
  c.rect(x, y, w, h, b)
  c.rect(x, y, w, 1, l)
  c.rect(x, y, 1, h, l)
  c.rect(x + w - 1, y, 1, h, d)
  c.rect(x, y + h - 1, w, 1, d)
}
const disc = (c: C, cx: number, cy: number, rx: number, ry: number, p: string | ((x: number, y: number, d: number) => string | null)) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d > 1) continue
      const q = typeof p === 'string' ? p : p(x, y, d)
      if (q) c.set(x, y, q)
    }
}
const line = (c: C, x0: number, y0: number, x1: number, y1: number, p: string) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i += 1) c.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), p)
}
const glow = (c: C, cx: number, cy: number, rx: number, ry: number, col: string) => disc(c, cx, cy, rx, ry, (_, __, d) => `${col}|${d < 0.45 ? 0.2 : d < 0.75 ? 0.12 : 0.06}`)
const outline = (c: C, p: string) => {
  const ring: (readonly [number, number])[] = []
  for (let y = 0; y < c.h; y += 1)
    for (let x = 0; x < c.w; x += 1)
      if (
        !c.get(x, y) &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([a, b]) => c.get(x + a!, y + b!))
      )
        ring.push([x, y])
  for (const [x, y] of ring) c.set(x, y, p)
}
const tube = (c: C, pts: Points, col: string, core: string) => {
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const [[a, b], [d, e]] = [pts[i]!, pts[i + 1]!]
    line(c, a + 1, b, d + 1, e, col)
    line(c, a, b + 1, d, e + 1, col)
    line(c, a, b, d, e, core)
  }
}
const fan = (c: C, cx: number, cy: number, r: number, A: string, B: string) => {
  disc(c, cx, cy, r + 0.5, r + 0.5, ACIER[0])
  disc(c, cx, cy, r, r, (x, y, d) => {
    const a = Math.atan2(y - cy, x - cx)
    if (d > 0.58) return mix(A, B, Math.round((Math.sin(a + 0.6) + 1) * 2) / 4)
    return d < 0.1 ? ACIER[3] : Math.floor((a + 4) * 1.9) % 2 ? ACIER[2] : ACIER[1]
  })
}

/** A starry night: small four-point stars and far pixels. */
export function murEtoiles() {
  const t = canvas(50, 26)
  t.rect(0, 0, 50, 26, '#1E1838')
  for (let i = 0; i < 26; i += 1) t.set(Math.floor(noise(i, 201) * 50), Math.floor(noise(i, 202) * 26), i % 3 ? '#2A2350' : '#352C62')
  const star = (x: number, y: number, a: string, b: string) => {
    for (const [i, j] of [
      [0, -2],
      [0, -1],
      [0, 1],
      [0, 2],
      [-2, 0],
      [-1, 0],
      [1, 0],
      [2, 0],
    ] as const)
      t.set((x + i + 50) % 50, (y + j + 26) % 26, Math.abs(i + j) > 1 ? a : b)
    t.set(x, y, b)
  }
  star(8, 6, '#2E2658', '#4A3F80')
  star(32, 18, '#2E2658', '#4A3F80')
  star(42, 5, '#2A3060', '#3E5088')
  star(20, 21, '#2A3060', '#3E5088')
  return t
}

/** A circuit board: traces, pads and a chip, night green. */
export function murCircuit() {
  const [W, H] = [50, 26]
  const t = canvas(W, H)
  const [base, pis, lit, pad] = ['#102826', '#183A36', '#205046', '#346E62']
  t.rect(0, 0, W, H, base)
  const pose = (x: number, y: number, p: string) => t.set(((x % W) + W) % W, ((y % H) + H) % H, p)
  const piste = (pts: Points) => {
    for (let i = 0; i + 1 < pts.length; i += 1) {
      const [[a, b], [d, e]] = [pts[i]!, pts[i + 1]!]
      const n = Math.max(Math.abs(d - a), Math.abs(e - b))
      for (let k = 0; k <= n; k += 1) pose(Math.round(a + ((d - a) * k) / n), Math.round(b + ((e - b) * k) / n), pis)
    }
  }
  const pastille = (x: number, y: number) => {
    for (const [i, j] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const)
      pose(x + i, y + j, pad)
    pose(x, y, base)
  }
  piste([
    [0, 4],
    [10, 4],
    [15, 9],
    [15, 16],
    [20, 21],
    [36, 21],
    [40, 25],
    [40, 26],
  ])
  piste([
    [40, 0],
    [40, 2],
    [44, 6],
    [50, 6],
  ])
  piste([
    [0, 6],
    [6, 6],
    [10, 10],
    [10, 22],
    [14, 26],
  ])
  piste([
    [14, 0],
    [14, 1],
    [20, 7],
    [32, 7],
    [36, 11],
    [50, 11],
  ])
  piste([
    [0, 11],
    [4, 11],
  ])
  piste([
    [24, 12],
    [30, 12],
    [34, 16],
    [46, 16],
    [50, 20],
  ])
  piste([
    [0, 20],
    [4, 24],
    [4, 26],
  ])
  piste([
    [4, 0],
    [4, 1],
  ])
  for (let x = 21; x < 29; x += 2) {
    pose(x, 13, lit)
    pose(x, 19, lit)
  }
  t.rect(20, 14, 10, 5, '#0E2422')
  t.rect(20, 14, 10, 1, lit)
  t.set(21, 15, pad)
  for (const [x, y] of [
    [4, 11],
    [24, 12],
    [15, 16],
    [44, 6],
    [36, 21],
    [32, 7],
    [46, 16],
  ] as const)
    pastille(x, y)
  return t
}

/** Acoustic foam: dark pyramids. */
export function murMousse() {
  const s = 12
  const t = canvas(24, 26)
  const [a, b, d, e, l] = ['#3A2448', '#2E1C3C', '#241630', '#1A1024', '#46305A']
  t.rect(0, 0, 24, 26, e)
  for (let j = 0; j < 2; j += 1)
    for (let i = 0; i < 2; i += 1) {
      const [ox, oy, h] = [i * s, j * 13, 13]
      for (let y = 0; y < h - 1; y += 1)
        for (let x = 0; x < s - 1; x += 1) {
          const [u, v] = [(x + 0.5) / (s - 1) - 0.5, (y + 0.5) / (h - 1) - 0.5]
          const top = Math.abs(v) > Math.abs(u)
          t.set(ox + x, oy + y, top ? (v < 0 ? a : d) : u < 0 ? b : mix(b, d, 0.6))
        }
      t.set(ox + 5, oy + 6, l)
      t.set(ox + 5, oy + 5, l)
    }
  return t
}

/** The wainscot: console panels, vents, screws and a strip of light. */
export function lambris() {
  const c = canvas(44, 24)
  c.rect(0, 0, 44, 24, NUIT[1])
  for (let x = 0; x < 44; x += 22) {
    box(c, x + 1, 4, 20, 15, NUIT[2], NUIT[3], NUIT[0])
    for (let y = 7; y < 16; y += 2) {
      c.rect(x + 8, y, 11, 1, NUIT[0])
      c.rect(x + 8, y + 1, 11, 1, NUIT[3])
    }
    box(c, x + 3, 7, 3, 9, NUIT[1], NUIT[0], NUIT[3])
    c.rect(x + 4, 8, 1, 3, x ? MAG[1] : CYA[1])
    for (const [i, j] of [
      [2, 5],
      [19, 5],
      [2, 17],
      [19, 17],
    ] as const)
      c.set(x + i, j, ACIER[3])
    c.rect(x, 3, 1, 17, NUIT[0])
  }
  c.rect(0, 0, 44, 2, NUIT[3])
  c.rect(0, 0, 44, 1, NUIT[4])
  c.rect(0, 2, 44, 1, CYA[0])
  for (let x = 3; x < 44; x += 6) c.set(x, 2, CYA[1])
  c.rect(0, 3, 44, 1, NUIT[0])
  c.rect(0, 20, 44, 4, NUIT[0])
  c.rect(0, 20, 44, 1, NUIT[3])
  c.rect(0, 23, 44, 1, '#0A0812')
  return c
}

/** Ebony boards, nearly black. */
export function solEbene() {
  const c = canvas(150, 60)
  const tones = ['#2C2430', '#302834', '#28202C', '#342A36', '#262030']
  for (let row = 0; row < 6; row += 1) {
    const y = row * 10
    const off = [0, 62, 28, 96, 44, 118][row]!
    for (let i = -1; i < 3; i += 1) {
      const x = off + i * 75
      const b = tones[Math.floor(noise(i + row * 7 + 4, 5) * 5)]!
      for (let px = x; px < x + 75; px += 1) c.rect(((px % 150) + 150) % 150, y, 1, 9, b)
      for (let g = 0; g < 5; g += 1) {
        const [gx, gy, n] = [x + 4 + Math.floor(noise(i + g, row + 40) * 56), y + 1 + Math.floor(noise(g + 2, i + row) * 7), 6 + Math.floor(noise(i, g + row) * 14)]
        for (let k = 0; k < n; k += 1) c.set((((gx + k) % 150) + 150) % 150, gy, mix(b, '#18121C', 0.3))
      }
      const seam = (((x + 74) % 150) + 150) % 150
      c.rect(seam, y, 1, 9, '#16121A')
      c.rect((seam + 1) % 150, y, 1, 9, mix(b, '#5A4A58', 0.25))
    }
    c.rect(0, y, 150, 1, '#3C3240')
    c.rect(0, y + 9, 150, 1, '#16121A')
  }
  return c
}

/** An arcade carpet with the lights off: small shapes, tone on tone. `lean`: without its grain, for a full room. */
export function solArcade(lean = false) {
  const [W, H] = [150, 90]
  const c = canvas(W, H)
  const base = '#1E1A2E'
  c.rect(0, 0, W, H, base)
  const pose = (x: number, y: number, p: string) => c.set(((x % W) + W) % W, ((y % H) + H) % H, p)
  for (let i = 0; i < (lean ? 0 : 150); i += 1) pose(Math.floor(noise(i, 301) * W), Math.floor(noise(i, 302) * H), i % 2 ? '#211C33' : '#1B172A')
  const cols = ['#28233E', '#262642', '#2D2240', '#242A40']
  for (let j = 0; j < 6; j += 1)
    for (let i = 0; i < 10; i += 1) {
      const [x, y, p, k] = [i * 15 + Math.floor(noise(i, j + 310) * 8) + 3, j * 15 + Math.floor(noise(i, j + 320) * 8) + 3, cols[Math.floor(noise(i, j + 330) * 4)]!, Math.floor(noise(i, j + 340) * 4)]
      if (k === 0)
        for (let m = 0; m < 4; m += 1) {
          pose(x + m, y + m, p)
          pose(x - m, y + m, p)
          pose(x - 3 + m * 2, y + 3, p)
          pose(x - 2 + m * 2, y + 3, p)
        }
      if (k === 1)
        for (let m = -2; m <= 2; m += 1) {
          pose(x + m, y, p)
          pose(x, y + m, p)
        }
      if (k === 2) for (let m = 0; m < 8; m += 1) pose(x + m, y + (m % 4 < 2 ? 0 : 1), p)
      if (k === 3)
        for (const [a, b] of [
          [-1, -2],
          [0, -2],
          [1, -2],
          [-2, -1],
          [2, -1],
          [-2, 0],
          [2, 0],
          [-2, 1],
          [2, 1],
          [-1, 2],
          [0, 2],
          [1, 2],
        ] as const)
          pose(x + a, y + b, p)
    }
  return c
}

/** A hexagon carpet, as a large game board, tone on tone. Four hexagons wide repeat: the tones hardly show, the weight would. */
export function solHexagones() {
  const [W, H, DX, DY] = [48, 28, 12, 7]
  const c = canvas(W, H)
  const tones = ['#262030', '#2A2234', '#241E2E', '#2C2436']
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const ds: (readonly [number, number, number])[] = []
      const [i0, j0] = [Math.round(x / DX), Math.round(y / DY)]
      for (let i = i0 - 2; i <= i0 + 2; i += 1)
        for (let j = j0 - 2; j <= j0 + 2; j += 1) {
          if ((i + j) & 1) continue
          ds.push([Math.hypot(x - i * DX, y - j * DY), i, j])
        }
      ds.sort((a, b) => a[0] - b[0])
      const [d1, i, j] = ds[0]!
      const d2 = ds[1]![0]
      const t = tones[Math.floor(noise(((i % 4) + 4) % 4, ((j % 4) + 4) % 4) * 4)]!
      const edge = d2 - d1
      c.set(x, y, edge < 1 ? '#19151F' : edge < 2.2 && y < j * DY ? mix(t, '#44384E', 0.3) : t)
    }
  return c
}

/** A game rug: a track of squares around a dark field. `lean`: the track in one piece, for a full room. */
export function tapis(w: number, h: number, lean = false) {
  const c = canvas(w, h)
  c.rect(0, 0, w, h, '#2A2340')
  c.rect(1, 1, w - 2, h - 2, '#3A2E58')
  c.rect(3, 3, w - 6, h - 6, '#241E38')
  const s = 10
  const cols = ['#33284E', '#2C3A52', '#3C2A4C', '#2A3448']
  const caseTapis = (x: number, y: number, k: number) => {
    c.rect(x, y, s - 1, s - 1, cols[k % 4]!)
    c.rect(x, y, s - 1, 1, mix(cols[k % 4]!, '#6C5CA8', 0.2))
    if (k % 5 === 0) c.rect(x + 3, y + 3, 3, 3, '#4A3F70')
  }
  const [nx, ny] = [Math.floor((w - 8) / s), Math.floor((h - 8) / s)]
  const [ox, oy] = [Math.floor((w - nx * s) / 2), Math.floor((h - ny * s) / 2)]
  if (lean) {
    c.rect(ox, oy, nx * s - 1, ny * s - 1, cols[0]!)
    c.rect(ox + s - 1, oy + s - 1, (nx - 2) * s + 1, (ny - 2) * s + 1, '#241E38')
  } else {
    for (let i = 0; i < nx; i += 1) {
      caseTapis(ox + i * s, oy, i)
      caseTapis(ox + i * s, oy + (ny - 1) * s, i + ny - 1)
    }
    for (let j = 1; j < ny - 1; j += 1) {
      caseTapis(ox, oy + j * s, j)
      caseTapis(ox + (nx - 1) * s, oy + j * s, nx - 1 + j)
    }
  }
  c.rect(ox + s + 3, oy + s + 3, nx * s - 2 * s - 7, 1, '#3A2E58')
  c.rect(ox + s + 3, oy + (ny - 1) * s - 5, nx * s - 2 * s - 7, 1, '#3A2E58')
  c.rect(ox + s + 3, oy + s + 3, 1, ny * s - 2 * s - 7, '#3A2E58')
  c.rect(ox + (nx - 1) * s - 5, oy + s + 3, 1, ny * s - 2 * s - 7, '#3A2E58')
  return c
}

export function baie() {
  const c = canvas(62, 50)
  c.rect(1, 1, 60, 48, ACIER[1])
  const dusk = ['#160E38', '#21124C', '#34166A', '#561C7C', '#84247E', '#B83480', '#E45A84']
  dusk.forEach((p, i) => c.rect(4, 4 + i * 5, 54, 5, p))
  for (let i = 0; i < 26; i += 1) c.set(4 + Math.floor(noise(i, 21) * 54), 4 + Math.floor(noise(i, 22) * 14), i % 4 ? CR : CYA[3])
  disc(c, 42, 25, 9, 9, (_, y) => (y > 25 && y % 3 === 0 ? null : mix(JAU[3], MAG[3], (y - 16) / 18)))
  let x = 4
  for (let i = 0; x < 58; i += 1) {
    const [w, h] = [5 + Math.floor(noise(i, 23) * 6), 12 + Math.floor(noise(i, 24) * 12)]
    c.rect(x, 46 - h, w, h, '#2A1658')
    x += w
  }
  x = 3
  for (let i = 0; x < 58; i += 1) {
    const [w, h] = [6 + Math.floor(noise(i, 25) * 7), 8 + Math.floor(noise(i, 26) * 15)]
    c.rect(x, 46 - h, w, h, '#120C28')
    c.rect(x, 46 - h, 1, h, '#20164A')
    for (let wy = 46 - h + 2; wy < 45; wy += 2)
      for (let wx = x + 2; wx < x + w - 1; wx += 2) if (noise(wx, wy) > 0.56) c.set(wx, wy, noise(wy, wx) > 0.72 ? CYA[3] : noise(wx + 1, wy) > 0.4 ? JAU[3] : MAG[3])
    x += w
  }
  c.rect(14, 24, 4, 13, '#0A0818')
  for (let y = 25; y < 36; y += 2) c.rect(15, y, 2, 1, MAG[3])
  c.rect(33, 30, 9, 4, '#0A0818')
  c.rect(34, 31, 7, 2, CYA[3])
  c.rect(36, 31, 1, 2, '#0A0818')
  c.rect(38, 28, 1, 2, ACIER[3])
  for (let y = 4; y < 13; y += 2) {
    c.rect(4, y, 54, 1, ACIER[3])
    c.rect(4, y + 1, 54, 1, ACIER[2])
  }
  c.rect(4, 4, 54, 1, ACIER[4])
  c.rect(10, 13, 1, 12, ACIER[4])
  c.rect(9, 25, 3, 2, ACIER[5])
  c.rect(30, 4, 2, 42, ACIER[1])
  c.rect(30, 4, 1, 42, ACIER[3])
  c.rect(0, 0, 62, 3, ACIER[2])
  c.rect(0, 0, 62, 1, ACIER[4])
  c.rect(0, 0, 3, 50, ACIER[2])
  c.rect(0, 0, 1, 50, ACIER[3])
  c.rect(59, 0, 3, 50, ACIER[1])
  c.rect(61, 0, 1, 50, ACIER[0])
  c.rect(3, 3, 56, 1, NUIT[0])
  c.rect(3, 3, 1, 43, NUIT[0])
  c.rect(0, 46, 62, 4, ACIER[3])
  c.rect(0, 46, 62, 1, ACIER[5])
  c.rect(0, 49, 62, 1, ACIER[0])
  for (let i = 0; i < 62; i += 1) c.set(i, 47, i % 12 < 6 ? MAG[3] : CYA[3])
  c.rect(47, 41, 8, 5, ROU[1])
  c.rect(47, 41, 8, 1, ROU[3])
  c.rect(47, 41, 1, 5, ROU[2])
  c.rect(50, 34, 3, 7, VER[1])
  c.rect(50, 34, 1, 7, VER[3])
  c.rect(48, 36, 2, 1, VER[2])
  c.rect(48, 34, 1, 2, VER[2])
  c.rect(53, 37, 2, 1, VER[2])
  c.rect(54, 35, 1, 2, VER[2])
  return c
}

/** The poster of a made-up game: sun, grid and ship. */
export function affiche() {
  const c = canvas(36, 46)
  c.rect(2, 2, 34, 44, SH)
  box(c, 0, 0, 34, 44, CR, PAP, '#C8B48C')
  const sky = ['#120E3A', '#241252', '#4A1872', '#8A2484', '#D03C86']
  sky.forEach((p, i) => c.rect(2, 2 + i * 5, 30, 5, p))
  for (let i = 0; i < 18; i += 1) c.set(3 + Math.floor(noise(i, 41) * 28), 3 + Math.floor(noise(i, 42) * 14), i % 3 ? PAP : CYA[3])
  disc(c, 17, 22, 10, 10, (_, y) => (y >= 23 ? null : y > 17 && y % 3 === 0 ? null : mix(JAU[4], MAG[3], (y - 12) / 11)))
  c.rect(2, 23, 30, 12, '#160A32')
  c.rect(2, 23, 30, 1, CYA[3])
  for (const y of [25, 28, 32]) c.rect(2, y, 30, 1, MAG[1])
  for (let i = -5; i <= 5; i += 1)
    for (let k = 0; k <= 10; k += 1) {
      const x = Math.round(17 + i * 2 + i * 0.4 * k)
      if (x >= 2 && x < 32) c.set(x, 24 + k, MAG[2])
    }
  c.sprite(
    [
      '.......aa.......',
      '......abba......',
      '......abba......',
      '.....abccba.....',
      'd...abbccbba...d',
      'da.abbbbbbbba.ad',
      'aaabbbbbbbbbbaaa',
      '..eefffffffee...',
      '...e.g....g.e...',
      '.....g....g.....',
    ],
    { a: ACIER[5], b: ACIER[4], c: CYA[3], d: MAG[3], e: ACIER[2], f: ACIER[3], g: JAU[3] },
    9,
    21,
  )
  c.rect(2, 35, 30, 7, '#120E2A')
  for (const [x, w] of [
    [5, 3],
    [9, 3],
    [13, 3],
    [17, 1],
    [19, 3],
    [23, 3],
    [27, 2],
  ] as const) {
    c.rect(x, 36, w, 3, JAU[3])
    c.rect(x, 36, w, 1, JAU[4])
  }
  c.rect(5, 40, 13, 1, CYA[2])
  c.rect(21, 40, 8, 1, MAG[3])
  for (const [x, y] of [
    [-1, 0],
    [29, 0],
  ] as const) {
    c.rect(x + 1, y, 5, 2, '#D8C8A0|0.8')
    c.rect(x + 1, y, 5, 1, '#F0E4C0|0.8')
  }
  c.set(33, 43, '#C8B48C')
  c.set(32, 43, '#C8B48C')
  c.set(33, 42, '#C8B48C')
  return c
}

/** A wall neon: a gamepad in tube, on its brackets. */
export function neon() {
  const c = canvas(52, 34)
  glow(c, 26, 16, 26, 17, MAG[3])
  for (const [x, y] of [
    [9, 5],
    [41, 5],
    [5, 26],
    [45, 26],
  ] as const) {
    c.rect(x, y, 3, 2, ACIER[2])
    c.set(x + 1, y, ACIER[4])
  }
  const m: Points = [
    [12, 6],
    [38, 6],
    [42, 9],
    [46, 21],
    [46, 25],
    [43, 28],
    [39, 28],
    [34, 21],
    [17, 21],
    [12, 28],
    [8, 28],
    [5, 25],
    [5, 21],
    [9, 9],
    [12, 6],
  ]
  tube(c, m, MAG[2], MAG[4])
  tube(
    c,
    [
      [15, 11],
      [15, 19],
    ],
    CYA[2],
    CYA[4],
  )
  tube(
    c,
    [
      [11, 15],
      [19, 15],
    ],
    CYA[2],
    CYA[4],
  )
  for (const [x, y, A] of [
    [34, 15, JAU],
    [38, 11, VER],
    [38, 18, ROU],
    [42, 15, CYA],
  ] as const) {
    c.rect(x, y, 3, 3, A[2])
    c.set(x + 1, y + 1, A[4])
  }
  tube(
    c,
    [
      [23, 15],
      [28, 15],
    ],
    VIO[2],
    VIO[4],
  )
  line(c, 26, 22, 26, 32, ACIER[3])
  c.rect(24, 31, 5, 3, ACIER[2])
  c.rect(24, 31, 5, 1, ACIER[4])
  return c
}

/** A lit case of made-up figurines. */
export function figurines() {
  const c = canvas(62, 40)
  box(c, 0, 0, 62, 37, NUIT[2], NUIT[4], NUIT[0])
  c.rect(2, 2, 58, 33, NUIT[0])
  for (let y = 3; y < 35; y += 1) for (let x = 3; x < 59; x += 1) if ((x + y * 3) % 7 === 0) c.set(x, y, NUIT[1])
  c.rect(2, 2, 58, 1, CYA[3])
  c.rect(2, 3, 58, 1, '#4CE4E8|0.3')
  c.rect(2, 4, 58, 1, '#4CE4E8|0.14')
  c.rect(2, 18, 58, 1, MAG[3])
  c.rect(2, 19, 58, 1, '#FF5AB4|0.3')
  c.rect(2, 20, 58, 1, '#FF5AB4|0.14')
  c.rect(2, 16, 58, 2, ACIER[3])
  c.rect(2, 16, 58, 1, ACIER[5])
  c.rect(2, 33, 58, 2, ACIER[3])
  c.rect(2, 33, 58, 1, ACIER[5])
  const robot = ['....c.....', '....d.....', '.aaaaaaaa.', '.abbbbbba.', '.abcbbcba.', '.abbbbbba.', '.aaaaaaaa.', '..eeeeee..', 'a.effffe.a', 'a.effffe.a', 'a.eeeeee.a', '..ee..ee..', '.gee..eeg.']
  c.sprite(robot, { a: ACIER[4], b: '#0C1C2C', c: CYA[3], d: ACIER[5], e: ACIER[3], f: JAU[2], g: ACIER[2] }, 5, 3)
  const chevalier = [
    '...rr.....',
    '..rrr.....',
    '..aaaaaa..',
    '.aabbbbaa.',
    '.aacccbaa.',
    '.aaaaaaaa.',
    '..dddddd.e',
    'ff.dddd..e',
    'fgf.dd...e',
    'fgfdddd.he',
    '.f.dddd..h',
    '..dd..dd..',
    '.ddd..ddd.',
  ]
  c.sprite(chevalier, { r: ROU[2], a: ACIER[4], b: ACIER[5], c: '#16121E', d: ACIER[3], e: ACIER[5], f: VIO[2], g: JAU[3], h: JAU[1] }, 18, 3)
  const mage = ['.....aa...', '....aaa...', '...aaba...', '...aaaa...', '..aaaaaa..', 'aaaaaaaaaa', '..cdccdc..', '..eeeeee..', '.aeeeeeea.', 'faaeeeeaa.', 'gaaaeeaaa.', 'g.aaaaaa..', 'g.aaaaaa..']
  c.sprite(mage, { a: VIO[1], b: JAU[3], c: '#E8B98A', d: NOIR, e: PAP, f: CYA[3], g: BOIS[4] }, 32, 3)
  const coffre = ['..aaaaaaaa..', '.abbbbbbbba.', 'abbbbbbbbbba', 'accccddcccca', 'abbbbddbbbba', 'abbbbbbbbba.', 'aaaaaaaaaaa.']
  c.sprite(coffre, { a: BOIS[1], b: BOIS[4], c: JAU[2], d: JAU[4] }, 46, 9)
  const blob = ['....aaaaa.....', '..aabbbbbaa...', '.abbbbbbbbba..', '.abbcccbbbba..', 'abbbcdcbbbbba.', 'abbbcccbbbbba.', 'abbbbbbbbbbba.', 'abebbbbbbbeba.', 'aaaaaaaaaaaa..']
  c.sprite(blob, { a: VER[1], b: VER[2], c: PAP, d: NOIR, e: VER[3] }, 4, 24)
  const dragon = ['.........aa.', 'b.......aaaa', 'bb.....aacaa', 'bbb...aaaaa.', '.bbbaaaaddd.', '..baaaaaa...', 'e.aaaaaaad..', 'ee.aaaaaad..', '.eeaaaaa....', '...aa.aa....', '..ff..ff....']
  c.sprite(dragon, { a: ROU[3], b: ROU[1], c: NOIR, d: JAU[3], e: ROU[2], f: JAU[1] }, 20, 22)
  const astro = [
    '...aaaaaa...',
    '..abbbbbba..',
    '..abccccba..',
    '..abccdcba..',
    '..abbbbbba..',
    '...aaaaaa...',
    '.aaaaaaaaaa.',
    'ab.aaeeaa.ba',
    'ab.aafgaa.ba',
    '...aaaaaa...',
    '...aa..aa...',
    '..haa..aah.',
  ]
  c.sprite(astro, { a: PAP, b: ACIER[4], c: '#1A2448', d: CYA[3], e: MAG[2], f: JAU[3], g: VER[3], h: ACIER[3] }, 34, 21)
  box(c, 48, 21, 10, 12, MAG[2], MAG[3], MAG[0])
  c.rect(49, 23, 8, 9, '#141024')
  c.sprite(['..aa..', '.abba.', '.aaaa.', '..cc..', '.cccc.', '..cc..', '.c..c.'], { a: JAU[3], b: NOIR, c: JAU[1] }, 50, 24)
  c.rect(49, 23, 1, 9, '#FFFFFF|0.3')
  c.rect(52, 23, 1, 4, '#FFFFFF|0.14')
  c.rect(49, 21, 8, 2, MAG[4])
  line(c, 8, 2, 2, 12, '#FFFFFF|0.08')
  line(c, 40, 19, 33, 32, '#FFFFFF|0.08')
  for (const x of [6, 52]) {
    c.rect(x, 37, 4, 1, NUIT[0])
    c.rect(x, 38, 2, 2, NUIT[0])
  }
  return c
}

/** Six made-up collectible cards under glass. */
export function cartes() {
  const c = canvas(56, 42)
  c.rect(2, 2, 54, 40, SH)
  box(c, 0, 0, 54, 40, BOIS[2], BOIS[4], BOIS[0])
  c.rect(2, 2, 50, 36, NUIT[3])
  for (let y = 3; y < 38; y += 3) for (let x = 3; x < 52; x += 3) c.set(x, y, NUIT[2])
  const carte = (x: number, y: number, A: Ramp, dessin: (x: number, y: number) => void) => {
    c.rect(x + 1, y + 1, 14, 16, NOIR)
    box(c, x, y, 14, 16, A[2], A[4], A[0])
    c.rect(x + 2, y + 2, 10, 8, '#141024')
    dessin(x + 2, y + 2)
    c.rect(x + 2, y + 11, 10, 1, PAP)
    c.rect(x + 2, y + 13, 7, 1, A[4])
    c.rect(x + 10, y + 13, 2, 1, JAU[3])
  }
  const col = 16
  carte(3, 2, ROU, (x, y) => {
    disc(c, x + 5, y + 5, 3, 3.4, ROU[3])
    disc(c, x + 5, y + 6, 1.6, 1.8, JAU[3])
    c.set(x + 5, y + 1, ROU[4])
    c.set(x + 3, y + 2, ROU[3])
  })
  carte(3 + col, 2, CYA, (x, y) => {
    line(c, x + 5, y + 1, x + 2, y + 5, CYA[3])
    line(c, x + 5, y + 1, x + 8, y + 5, CYA[3])
    disc(c, x + 5, y + 5, 3, 2.4, CYA[3])
    c.set(x + 4, y + 5, CYA[4])
  })
  carte(3 + col * 2, 2, VER, (x, y) => {
    disc(c, x + 5, y + 4, 3.4, 3, VER[3])
    c.rect(x + 3, y + 3, 1, 1, NOIR)
    c.rect(x + 6, y + 3, 1, 1, NOIR)
    c.rect(x + 4, y + 6, 3, 2, VER[1])
  })
  carte(3, 21, JAU, (x, y) => {
    line(c, x + 6, y + 1, x + 3, y + 4, JAU[3])
    c.rect(x + 3, y + 4, 5, 1, JAU[4])
    line(c, x + 7, y + 4, x + 4, y + 7, JAU[3])
  })
  carte(3 + col, 21, VIO, (x, y) => {
    c.sprite(['....a....', '...aba...', '..abbba..', '.abcbcba.', '..abbba..', '...aba...', '....a....'], { a: VIO[3], b: VIO[4], c: PAP }, x, y + 1)
  })
  carte(3 + col * 2, 21, MAG, (x, y) => {
    disc(c, x + 5, y + 4, 3.5, 3.5, MAG[3])
    disc(c, x + 5, y + 4, 2, 2, '#141024')
    c.set(x + 5, y + 4, JAU[3])
  })
  for (const [x, y] of [
    [33, 24],
    [45, 26],
    [39, 33],
  ] as const)
    c.set(x, y, PAP)
  line(c, 7, 2, 2, 12, '#FFFFFF|0.1')
  line(c, 12, 2, 2, 22, '#FFFFFF|0.07')
  line(c, 48, 18, 34, 37, '#FFFFFF|0.07')
  return c
}

/** A rack of cartridges of made-up games. */
export function cartouches() {
  const c = canvas(52, 38)
  c.rect(2, 2, 50, 36, SH)
  box(c, 0, 0, 50, 36, NUIT[3], NUIT[5], NUIT[0])
  c.rect(2, 2, 46, 32, NUIT[1])
  const cols = [ROU, CYA, JAU, VER, MAG, VIO]
  for (let r = 0; r < 3; r += 1) {
    const y = 3 + r * 10
    c.rect(2, y + 8, 46, 2, ACIER[3])
    c.rect(2, y + 8, 46, 1, ACIER[5])
    for (let i = 0; i < 7; i += 1) {
      if (noise(i, r + 91) > 0.84) continue
      const [x, A] = [3 + i * 6 + (r % 2), cols[(i * 2 + r * 3) % 6]!]
      c.rect(x, y, 5, 8, ACIER[1])
      c.rect(x, y, 5, 1, ACIER[3])
      c.rect(x, y + 1, 1, 7, ACIER[2])
      c.rect(x + 1, y + 2, 3, 4, A[2])
      c.rect(x + 1, y + 2, 3, 1, A[4])
      c.set(x + 2, y + 4, PAP)
      c.rect(x + 1, y + 7, 3, 1, JAU[1])
    }
  }
  for (const [x, y] of [
    [1, 1],
    [47, 1],
    [1, 33],
    [47, 33],
  ] as const)
    c.set(x, y, ACIER[5])
  return c
}

const manette = (c: C, x: number, y: number, a: string, b: string, d: string) =>
  c.sprite(
    ['...aaaaaaaaaa...', '..abbbbbbbbbba..', '.abbdbbbbbbjbba.', '.abdddbbbbkblba.', '.abbdbbaabbmbba.', 'aabbbbaaaabbbaa.', 'abbbaa....aabbba', 'abba........abba', '.aa..........aa.'],
    { a, b, d, j: JAU[3], k: VER[3], l: ROU[3], m: CYA[3] },
    x,
    y,
  )

/** The arcade cabinet of a made-up game. */
export function borne() {
  const c = canvas(44, 68)
  glow(c, 22, 8, 22, 9, JAU[3])
  c.rect(3, 65, 38, 3, SH)
  const prof = (y: number) => (y < 2 ? 0 : y < 13 ? 3 : y < 15 ? 4 : y < 34 ? 5 : y < 45 ? 2 : 4)
  for (let y = 2; y < 65; y += 1) {
    const m = prof(y)
    c.rect(m, y, 44 - m * 2, 1, VIO[1])
    c.set(m, y, CYA[3])
    c.set(43 - m, y, MAG[3])
    c.set(m + 1, y, VIO[2])
    c.set(42 - m, y, VIO[0])
  }
  box(c, 5, 3, 34, 10, JAU[3], JAU[4], JAU[1])
  for (let x = 6; x < 38; x += 1) c.set(x, 4 + (x % 2), JAU[4])
  c.rect(6, 8, 32, 4, MAG[2])
  c.rect(6, 8, 32, 1, MAG[4])
  for (let x = 6; x < 38; x += 4) c.rect(x, 10, 2, 2, MAG[1])
  c.sprite(['......a......', '.....aaa.....', '.a..abcba..a.', 'aaaabbbbbaaaa', '...dd...dd...'], { a: VIO[0], b: VIO[2], c: CYA[3], d: ROU[2] }, 15, 4)
  for (const x of [9, 12, 31, 34]) {
    c.rect(x - 1, 6, 3, 1, ROU[2])
    c.rect(x, 5, 1, 3, ROU[2])
  }
  c.rect(4, 13, 36, 2, ACIER[1])
  c.rect(4, 13, 36, 1, ACIER[3])
  c.rect(6, 15, 32, 20, NOIR)
  c.rect(7, 16, 30, 18, ACIER[0])
  c.rect(8, 17, 28, 16, '#0A0E2C')
  for (let y = 18; y < 33; y += 2) c.rect(8, y, 28, 1, '#0E1438')
  for (const [x, y] of [
    [8, 17],
    [35, 17],
    [8, 32],
    [35, 32],
  ] as const)
    c.set(x, y, NOIR)
  for (const [x, w] of [
    [10, 2],
    [13, 2],
    [16, 2],
    [19, 2],
  ] as const)
    c.rect(x, 18, w, 1, PAP)
  c.rect(30, 18, 4, 1, JAU[3])
  const bricks = [ROU, JAU, VER, CYA]
  bricks.forEach((A, r) => {
    for (let i = 0; i < 8; i += 1) {
      if (r === 3 && (i === 3 || i === 4)) continue
      c.rect(10 + i * 3, 20 + r * 2, 2, 1, A[r % 2 ? 2 : 3])
    }
  })
  c.rect(23, 27, 1, 1, PAP)
  c.rect(24, 28, 1, 1, '#B0FAF8|0.5')
  c.sprite(['..a..', '.aba.', 'aaaaa'], { a: CYA[3], b: PAP }, 18, 29)
  c.rect(8, 17, 3, 1, '#FFFFFF|0.14')
  c.rect(8, 18, 1, 4, '#FFFFFF|0.14')
  c.rect(2, 35, 40, 10, ACIER[2])
  c.rect(2, 35, 40, 1, ACIER[5])
  c.rect(2, 36, 40, 1, ACIER[4])
  c.rect(2, 44, 40, 1, ACIER[0])
  c.rect(3, 37, 38, 7, NUIT[2])
  for (let x = 4; x < 40; x += 3) c.set(x, 43, NUIT[3])
  disc(c, 11, 42, 3.4, 1.6, ACIER[1])
  c.rect(10, 38, 2, 4, ACIER[5])
  disc(c, 11, 37, 2.5, 2.5, ROU[2])
  c.rect(10, 36, 1, 1, ROU[4])
  for (const [x, y, A] of [
    [22, 39, CYA],
    [27, 38, MAG],
    [32, 38, JAU],
    [22, 42, VER],
    [27, 41, ROU],
    [32, 41, VIO],
  ] as const) {
    c.rect(x, y + 1, 3, 2, A[0])
    c.rect(x, y, 3, 2, A[2])
    c.set(x, y, A[4])
  }
  c.rect(37, 39, 2, 2, ROU[3])
  c.rect(37, 42, 2, 1, ACIER[4])
  for (let y = 46; y < 63; y += 1)
    for (let x = 6; x < 14; x += 1) {
      if ((x + y) % 8 < 2) c.set(x, y, MAG[2])
      else if ((x + y) % 8 < 3) c.set(x, y, VIO[3])
    }
  for (let y = 46; y < 63; y += 1)
    for (let x = 30; x < 38; x += 1) {
      if ((x - y + 80) % 8 < 2) c.set(x, y, CYA[2])
      else if ((x - y + 80) % 8 < 3) c.set(x, y, VIO[3])
    }
  box(c, 15, 47, 14, 15, ACIER[2], ACIER[4], ACIER[0])
  for (const x of [17, 23]) {
    c.rect(x, 49, 4, 7, ACIER[1])
    c.rect(x + 1, 50, 2, 5, ROU[3])
    c.rect(x + 1, 52, 2, 1, NOIR)
    c.rect(x + 1, 50, 1, 1, ROU[4])
  }
  c.rect(19, 58, 6, 2, NOIR)
  c.rect(19, 58, 6, 1, ACIER[1])
  for (const [x, y] of [
    [16, 48],
    [27, 48],
    [16, 60],
    [27, 60],
  ] as const)
    c.set(x, y, ACIER[5])
  c.rect(4, 63, 36, 2, NOIR)
  c.rect(4, 63, 36, 1, ACIER[1])
  c.rect(6, 65, 4, 1, ACIER[0])
  c.rect(34, 65, 4, 1, ACIER[0])
  return c
}

/** A PC tower with a glass side on its fans. */
export function tour() {
  const c = canvas(36, 54)
  glow(c, 18, 25, 18, 25, VIO[3])
  c.rect(3, 50, 30, 4, SH)
  box(c, 3, 2, 30, 47, ACIER[2], ACIER[4], ACIER[0])
  c.rect(4, 3, 28, 2, ACIER[3])
  for (let x = 6; x < 22; x += 2) c.rect(x, 3, 1, 2, ACIER[0])
  c.rect(26, 3, 3, 2, ACIER[1])
  c.set(27, 3, CYA[3])
  c.rect(5, 6, 26, 41, NOIR)
  c.rect(5, 6, 26, 41, '#100C1C')
  c.rect(6, 7, 18, 24, '#161226')
  for (const [a, b, d, e] of [
    [7, 11, 13, 11],
    [7, 26, 12, 26],
    [18, 8, 18, 14],
    [21, 20, 21, 27],
  ] as const)
    line(c, a, b, d, e, '#2A2146')
  fan(c, 13, 16, 6, CYA[3], MAG[3])
  for (let i = 0; i < 4; i += 1) {
    c.rect(20 + i, 8, 1, 15, i % 2 ? NUIT[3] : NUIT[4])
    c.set(20 + i, 9 + i * 3, i % 2 ? CYA[3] : MAG[3])
    c.set(20 + i, 8, JAU[3])
  }
  for (const [y, A, B] of [
    [12, MAG[3], VIO[3]],
    [23, VIO[3], CYA[3]],
    [34, CYA[3], VER[3]],
  ] as const)
    fan(c, 27, y, 3.6, A, B)
  c.rect(6, 25, 16, 6, ACIER[1])
  c.rect(6, 25, 16, 1, ACIER[4])
  c.rect(6, 30, 16, 1, MAG[3])
  for (const x of [10, 17]) {
    disc(c, x, 28, 2.4, 2, ACIER[0])
    c.rect(x - 1, 28, 3, 1, ACIER[3])
    c.set(x, 27, ACIER[3])
  }
  c.rect(6, 37, 18, 9, ACIER[1])
  c.rect(6, 37, 18, 1, ACIER[3])
  for (let x = 8; x < 22; x += 2) c.rect(x, 39, 1, 5, ACIER[0])
  c.rect(6, 45, 18, 1, CYA[2])
  line(c, 8, 32, 8, 36, ROU[2])
  line(c, 12, 32, 12, 36, JAU[2])
  line(c, 16, 6, 6, 26, '#FFFFFF|0.1')
  line(c, 17, 6, 7, 26, '#FFFFFF|0.1')
  line(c, 28, 26, 20, 46, '#FFFFFF|0.07')
  for (const [x, y] of [
    [4, 4],
    [31, 4],
    [4, 47],
    [31, 47],
  ] as const)
    c.set(x, y, ACIER[5])
  for (const x of [5, 27]) {
    c.rect(x, 49, 4, 2, ACIER[0])
    c.rect(x, 49, 4, 1, ACIER[3])
  }
  return c
}

/** A low unit, its console, its games and its pad. */
export function consoleBasse() {
  const c = canvas(60, 46)
  c.rect(2, 43, 56, 3, SH)
  for (const x of [5, 51]) {
    line(c, x + 2, 34, x, 43, ACIER[4])
    line(c, x + 3, 34, x + 1, 43, ACIER[2])
  }
  box(c, 2, 18, 56, 18, BOIS[2], BOIS[4], BOIS[0])
  c.rect(1, 17, 58, 2, BOIS[4])
  c.rect(1, 17, 58, 1, BOIS[5])
  c.rect(1, 19, 58, 1, MAG[3])
  c.rect(2, 20, 56, 1, '#FF5AB4|0.22')
  for (let i = 0; i < 40; i += 1) {
    const x = 3 + Math.floor(noise(i, 111) * 50)
    c.rect(x, 22 + Math.floor(noise(i, 112) * 13), 2 + Math.floor(noise(i, 113) * 3), 1, noise(i, 114) > 0.5 ? BOIS[1] : BOIS[3])
  }
  box(c, 4, 22, 22, 12, NUIT[0], NOIR, BOIS[4])
  const cols = [ROU, CYA, JAU, VIO, VER, MAG, CYA, JAU]
  cols.forEach((A, i) => {
    const h = 8 + ((i * 3) % 3)
    c.rect(6 + i * 2 + (i > 4 ? 1 : 0), 33 - h, 2, h, A[2])
    c.rect(6 + i * 2 + (i > 4 ? 1 : 0), 33 - h, 1, h, A[3])
    c.set(7 + i * 2 + (i > 4 ? 1 : 0), 31 - h + 3, PAP)
  })
  box(c, 28, 22, 12, 12, BOIS[3], BOIS[4], BOIS[1])
  c.rect(32, 27, 4, 2, ACIER[4])
  c.rect(32, 27, 4, 1, ACIER[5])
  box(c, 42, 22, 14, 12, NUIT[0], NOIR, BOIS[4])
  disc(c, 49, 28, 4.6, 4.6, ACIER[1])
  disc(c, 49, 28, 3, 3, (x, y) => ((x + y) % 2 ? ACIER[0] : ACIER[2]))
  disc(c, 49, 28, 1, 1, CYA[3])
  c.rect(6, 13, 28, 4, ACIER[0])
  box(c, 5, 7, 30, 8, ACIER[3], ACIER[5], ACIER[1])
  c.rect(5, 7, 30, 2, ACIER[4])
  c.rect(6, 7, 28, 1, ACIER[5])
  c.rect(8, 10, 16, 2, NOIR)
  c.rect(8, 11, 16, 1, ACIER[1])
  c.rect(26, 10, 3, 3, ROU[2])
  c.set(26, 10, ROU[4])
  c.rect(30, 10, 3, 1, VER[3])
  c.rect(30, 12, 3, 1, ACIER[1])
  for (let x = 8; x < 24; x += 3) c.rect(x, 13, 2, 1, ACIER[2])
  c.rect(14, 5, 12, 2, MAG[1])
  c.rect(14, 5, 12, 1, MAG[3])
  c.rect(15, 3, 10, 2, ACIER[0])
  c.rect(16, 3, 8, 1, JAU[3])
  line(c, 35, 13, 42, 15, ACIER[0])
  line(c, 42, 15, 44, 14, ACIER[0])
  manette(c, 40, 8, ACIER[0], ACIER[2], ACIER[4])
  box(c, 52, 3, 6, 14, VIO[2], VIO[4], VIO[0])
  c.rect(53, 5, 4, 5, JAU[3])
  c.rect(54, 6, 2, 3, ROU[2])
  c.rect(53, 12, 4, 1, PAP)
  return c
}

/** A board game table, mid game. */
export function tableJeu() {
  const c = canvas(62, 44)
  c.rect(3, 41, 56, 3, SH)
  for (const x of [5, 53]) {
    c.rect(x, 24, 4, 18, BOIS[2])
    c.rect(x, 24, 1, 18, BOIS[4])
    c.rect(x + 3, 24, 1, 18, BOIS[0])
  }
  c.rect(9, 34, 44, 2, BOIS[1])
  c.rect(9, 34, 44, 1, BOIS[3])
  for (let j = 0; j < 16; j += 1) {
    const m = 4 - Math.floor(j / 4)
    c.rect(m, 8 + j, 62 - m * 2, 1, BOIS[3])
    c.set(m, 8 + j, BOIS[5])
  }
  c.rect(4, 8, 54, 1, BOIS[5])
  for (let j = 0; j < 13; j += 1) {
    const m = 7 - Math.floor(j / 4)
    c.rect(m, 9 + j, 62 - m * 2, 1, '#1A3A3C')
  }
  for (let i = 0; i < 40; i += 1) c.set(6 + Math.floor(noise(i, 121) * 50), 10 + Math.floor(noise(i, 122) * 11), '#1E4446')
  c.rect(13, 10, 36, 12, '#C8B48C')
  c.rect(13, 10, 36, 1, CR)
  c.rect(14, 11, 34, 10, '#223E46')
  const cases = ['#A04A3C', '#B8923C', '#4E8A5C', '#3F7C9C', '#8A5A9C', '#C8B48C']
  for (let r = 0; r < 3; r += 1)
    for (let i = 0; i < 6 - (r % 2); i += 1) {
      const [x, y, col] = [15 + i * 5 + (r % 2) * 2, 12 + r * 3, cases[Math.floor(noise(i, r + 131) * 6)]!]
      c.rect(x, y, 4, 2, col)
      c.rect(x, y, 4, 1, mix(col, '#FFFFFF', 0.25))
    }
  const pion = (x: number, y: number, A: Ramp) => {
    disc(c, x, y + 4, 2, 1, NOIR)
    c.rect(x - 1, y + 1, 3, 3, A[2])
    c.set(x - 1, y + 1, A[3])
    disc(c, x, y, 1.6, 1.6, A[2])
    c.set(x - 1, y - 1, A[4])
    c.rect(x - 2, y + 3, 5, 1, A[1])
  }
  pion(22, 9, ROU)
  pion(30, 12, CYA)
  pion(38, 8, JAU)
  pion(43, 13, VER)
  const de = (x: number, y: number, A: Ramp) => {
    c.rect(x + 1, y + 1, 5, 5, NOIR)
    box(c, x, y, 5, 5, A[2], A[4], A[0])
    c.set(x + 1, y + 1, PAP)
    c.set(x + 3, y + 3, PAP)
    c.set(x + 2, y + 2, PAP)
  }
  de(7, 15, ROU)
  de(50, 11, VIO)
  box(c, 50, 17, 8, 5, VIO[1], VIO[3], VIO[0])
  c.rect(51, 16, 7, 1, VIO[3])
  for (const [x, y, A] of [
    [7, 11, JAU],
    [10, 12, JAU],
    [8, 12, ROU],
  ] as const) {
    c.rect(x, y, 3, 2, A[2])
    c.rect(x, y, 3, 1, A[4])
  }
  c.rect(1, 24, 60, 7, BOIS[2])
  c.rect(1, 24, 60, 1, BOIS[5])
  c.rect(1, 30, 60, 1, BOIS[0])
  for (const x of [8, 34]) {
    box(c, x, 26, 20, 4, BOIS[3], BOIS[4], BOIS[1])
    c.rect(x + 8, 27, 4, 1, JAU[2])
  }
  return c
}

/** A velvet beanbag, its seams, and a pad left on it. */
export function poufPoire() {
  const c = canvas(42, 38)
  disc(c, 21, 35, 20, 3, SH)
  const hw = (y: number) => {
    const a = y < 24 ? Math.sqrt(Math.max(0, 1 - ((y - 13.5) / 9) ** 2)) * 14 : 0
    const b = Math.sqrt(Math.max(0, 1 - ((y - 25) / 11.5) ** 2)) * 20.5
    const n = y > 13 && y < 26 ? 14 + ((y - 13) / 13) * 6.5 : 0
    return Math.max(a, b, n)
  }
  for (let y = 5; y < 36; y += 1) {
    const w = hw(y)
    for (let x = Math.ceil(21 - w); x <= 21 + w; x += 1) {
      const u = (x - 21) / w
      const v = (y - 20) / 15.5
      const l = 0.62 - 0.62 * (u + 0.3) ** 2 - 0.9 * (v + 0.35) ** 2 - 0.22 * u
      const k = l > 0.5 ? 4 : l > 0.3 ? 3 : l > -0.02 ? 2 : l > -0.42 ? 1 : 0
      const seam = [-0.5, 0.5].some(s => Math.abs(u - s * (0.55 + 0.45 * Math.min(1, (y - 5) / 14))) < 0.6 / w)
      c.set(x, y, seam ? VIO[Math.max(0, k - 1)]! : (x + y * 2) % 13 === 0 && k > 0 ? VIO[k - 1]! : VIO[k]!)
    }
  }
  disc(c, 21, 12, 9, 3, (x, y, d) => (y <= 12 ? (d > 0.6 ? VIO[1] : VIO[2]) : null))
  c.rect(19, 4, 5, 2, MAG[2])
  c.rect(19, 4, 5, 1, MAG[4])
  for (const [x, y, n] of [
    [7, 21, 4],
    [31, 22, 4],
    [10, 19, 3],
    [29, 20, 3],
  ] as const)
    c.rect(x, y, n, 1, VIO[1])
  for (const [x, y, n] of [
    [12, 16, 5],
    [11, 18, 2],
  ] as const)
    c.rect(x, y, n, 1, VIO[4])
  for (let x = 5; x < 38; x += 2) c.set(x, 34, VIO[3])
  manette(c, 13, 20, NOIR, ACIER[1], ACIER[4])
  return c
}

const cube = (c: C, cx: number, top: number, s: number, R: Ramp, nt: Pips, ng: Pips, nd: Pips, pc = PAP) => {
  const fill = (fn: Face, col: string) => {
    for (let u = 0; u <= s; u += 0.5)
      for (let v = 0; v <= s; v += 0.5) {
        const [x, y] = fn(u, v)
        c.set(Math.round(x), Math.round(y), col)
      }
  }
  const T: Face = (u, v) => [cx + u - v, top + (u + v) / 2]
  const G: Face = (u, v) => [cx - s + u, top + s / 2 + u / 2 + v]
  const D: Face = (u, v) => [cx + u, top + s - u / 2 + v]
  fill(T, R[3])
  fill(G, R[2])
  fill(D, R[1])
  for (let i = 0; i <= s; i += 0.5) {
    const a = T(i, 0)
    c.set(Math.round(a[0]), Math.round(a[1]), R[4])
    const b = T(0, i)
    c.set(Math.round(b[0]), Math.round(b[1]), R[4])
    const e = G(i, 0)
    c.set(Math.round(e[0]), Math.round(e[1]), R[4])
    const f = D(i, 0)
    c.set(Math.round(f[0]), Math.round(f[1]), R[3])
    const g = G(s, i)
    c.set(Math.round(g[0]), Math.round(g[1]), R[3])
    const h = G(i, s)
    c.set(Math.round(h[0]), Math.round(h[1]), R[0])
    const k = D(i, s)
    c.set(Math.round(k[0]), Math.round(k[1]), R[0])
  }
  const pips: Record<Pips, readonly (readonly [number, number])[]> = {
    1: [[0.5, 0.5]],
    2: [
      [0.27, 0.27],
      [0.73, 0.73],
    ],
    3: [
      [0.25, 0.25],
      [0.5, 0.5],
      [0.75, 0.75],
    ],
    4: [
      [0.27, 0.27],
      [0.73, 0.27],
      [0.27, 0.73],
      [0.73, 0.73],
    ],
    5: [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.5, 0.5],
      [0.25, 0.75],
      [0.75, 0.75],
    ],
    6: [
      [0.27, 0.22],
      [0.73, 0.22],
      [0.27, 0.5],
      [0.73, 0.5],
      [0.27, 0.78],
      [0.73, 0.78],
    ],
  }
  const pose = (fn: Face, n: Pips) => {
    for (const [a, b] of pips[n]) {
      const [x, y] = fn(a * s, b * s)
      c.rect(Math.round(x) - 1, Math.round(y), 2, 2, pc)
    }
  }
  pose(T, nt)
  pose(G, ng)
  pose(D, nd)
}

/** Giant foam dice and a large twenty-sided die. */
export function des() {
  const c = canvas(48, 40)
  c.rect(4, 36, 40, 4, SH)
  cube(c, 14, 13, 12, ROU, 2, 5, 3)
  cube(c, 33, 15, 10, CYA, 1, 4, 2)
  cube(c, 14, 5, 8, JAU, 1, 2, 1, NOIR)
  const [cx, cy, r] = [37, 27, 10]
  const R = VER
  for (let y = cy - r; y <= cy + r; y += 1)
    for (let x = cx - r; x <= cx + r; x += 1) {
      const [dx, dy] = [x - cx, y - cy]
      if (Math.abs(dy) > r || Math.abs(dx) > r * 0.9 * Math.min(1, (r - Math.abs(dy)) / (r * 0.5))) continue
      const inner = dy > -r * 0.5 && dy < r * 0.5 && Math.abs(dx) < (dy + r * 0.5) * 0.72
      const haut = dy < -r * 0.5 + (Math.abs(dx) / r) * r * 0.4
      let p: string = inner ? R[3] : haut ? (dx < 0 ? R[4] : R[3]) : dy > r * 0.5 ? R[1] : dx < 0 ? R[2] : R[1]
      if (Math.abs(dx) > r * 0.84 && dy > 0) p = R[0]
      c.set(x, y, p)
    }
  c.sprite(['aaa.aaa', '..a.a.a', 'aaa.a.a', 'a...a.a', 'aaa.aaa'], { a: NOIR }, cx - 3, cy - 2)
  return c
}

export function chaise() {
  const c = canvas(60, 45)
  const hw = (y: number) => (y < 1 ? 0 : y < 7 ? 10 : y < 8 ? 9 : y < 14 ? 14 : 14 - Math.ceil((y - 14) / 5))
  for (let y = 1; y < 27; y += 1) {
    const w = hw(y)
    for (let x = 30 - w; x < 30 + w; x += 1) {
      const e = Math.min(x - (30 - w), 30 + w - 1 - x)
      c.set(x, y, y < 7 ? NUIT[3] : e < 1 ? MAG[3] : e < 4 ? (x < 30 ? MAG[1] : MAG[0]) : y % 3 === 0 ? NUIT[1] : NUIT[2])
    }
  }
  c.rect(24, 2, 12, 4, MAG[1])
  c.rect(24, 2, 12, 1, MAG[3])
  c.rect(28, 3, 4, 2, JAU[3])
  c.rect(26, 8, 2, 3, NUIT[0])
  c.rect(32, 8, 2, 3, NUIT[0])
  c.rect(23, 20, 14, 5, MAG[1])
  c.rect(23, 20, 14, 1, MAG[3])
  c.rect(26, 22, 8, 1, MAG[0])
  c.rect(16, 13, 28, 1, MAG[0])
  outline(c, INK)
  return c
}

export function bureau(state: DeskState | 'rest') {
  const c = canvas(60, 45)
  c.rect(3, 41, 54, 4, SH)
  c.rect(1, 43, 58, 2, SH)
  for (const x of [3, 52]) {
    c.rect(x, 38, 5, 4, ACIER[1])
    c.rect(x + 1, 38, 1, 4, ACIER[3])
  }
  c.rect(2, 41, 7, 2, ACIER[0])
  c.rect(51, 41, 7, 2, ACIER[0])
  c.rect(2, 41, 7, 1, ACIER[2])
  c.rect(51, 41, 7, 1, ACIER[2])
  c.rect(2, 28, 56, 12, NUIT[1])
  c.rect(2, 28, 56, 1, NUIT[0])
  for (let y = 30; y < 39; y += 2) for (let x = 3 + (y % 4 ? 1 : 0); x < 58; x += 2) c.set(x, y, NUIT[0])
  c.rect(2, 29, 1, 10, NUIT[3])
  c.rect(57, 29, 1, 10, NUIT[0])
  for (let x = 2; x < 58; x += 1) {
    const t = Math.round(((x - 2) / 55) * 7) / 7
    c.set(x, 39, mix(MAG[3], CYA[3], t))
    c.set(x, 40, `${mix(MAG[3], CYA[3], t)}|0.35`)
  }
  c.rect(1, 18, 58, 9, NUIT[2])
  c.rect(1, 18, 58, 1, NUIT[4])
  for (let y = 19; y < 26; y += 1) for (let x = 2; x < 58; x += 1) if ((x + y) % 4 === 0) c.set(x, y, NUIT[1])
  c.rect(0, 26, 60, 2, NUIT[4])
  c.rect(0, 26, 60, 1, NUIT[5])
  c.rect(0, 27, 60, 1, NUIT[1])
  c.rect(0, 19, 1, 7, NUIT[3])
  c.rect(59, 19, 1, 7, NUIT[0])
  for (const [x, A] of [
    [0, MAG],
    [56, CYA],
  ] as const) {
    c.rect(x, 27, 4, 1, A[3])
    c.rect(x, 26, 4, 1, A[4])
  }
  c.rect(5, 30, 50, 10, NUIT[0])
  c.rect(6, 31, 48, 8, CR)
  c.rect(6, 31, 48, 1, PAP)
  c.rect(6, 38, 48, 1, '#D8C49E')
  c.rect(6, 31, 2, 8, MAG[2])
  c.rect(52, 31, 2, 8, CYA[2])
  c.rect(6, 31, 2, 1, MAG[4])
  c.rect(52, 31, 2, 1, CYA[4])
  const [bad, off] = [state === 'failed', state === 'rest']
  if (state === 'done') {
    c.rect(5, 18, 20, 3, '#3F4258')
    c.rect(5, 18, 20, 1, '#6A6E8C')
    c.rect(4, 21, 22, 1, INK)
    c.rect(13, 19, 4, 1, '#565A78')
    c.rect(7, 7, 12, 11, '#2F6B45')
    c.rect(8, 8, 10, 9, '#4E8F5A')
    c.rect(8, 8, 10, 1, '#6FAE5C')
    c.sprite(['.......x', '......xx', 'x....xx.', 'xx..xx..', '.xxxx...', '..xx....'], { x: CR }, 9, 9)
  } else {
    c.rect(5, 7, 20, 13, '#1B1730')
    c.rect(6, 8, 18, 11, off ? '#2D2F44' : '#3F4258')
    c.rect(6, 8, 18, 1, '#6A6E8C')
    c.rect(6, 9, 1, 10, off ? '#34364C' : '#565A78')
    for (let y = 9; y < 19; y += 1) for (let x = 7; x < 24; x += 1) if ((x + y) % 7 === 0) c.set(x, y, off ? '#23253A' : '#484C66')
    c.rect(13, 12, 4, 3, off ? '#23253A' : bad ? '#E4505F' : '#7FE0C8')
    c.set(14, 11, off ? '#23253A' : bad ? '#F4A0A8' : '#BFF5E6')
    c.rect(4, 20, 22, 2, '#6A6E8C')
    c.rect(4, 22, 22, 1, '#3F4258')
  }
  if (bad) {
    c.rect(4, 0, 2, 4, '#E4505F')
    c.rect(4, 5, 2, 2, '#E4505F')
  }
  c.rect(42, 17, 6, 6, INK)
  c.rect(43, 17, 4, 5, NUIT[3])
  c.rect(43, 19, 4, 1, CYA[3])
  c.rect(43, 17, 4, 1, '#5A3A22')
  c.rect(48, 18, 1, 3, INK)
  c.rect(46, 18, 1, 4, NUIT[4])
  c.rect(29, 21, 11, 5, NUIT[0])
  c.rect(29, 21, 11, 1, VIO[1])
  c.rect(29, 25, 11, 1, MAG[2])
  c.rect(33, 21, 4, 4, ACIER[3])
  c.rect(33, 21, 4, 1, ACIER[5])
  c.rect(34, 22, 2, 1, CYA[3])
  c.sprite(['...c...', '.aaaaa.', '.abcba.', '.aaaaa.', '..ddd..', 'a.ddd.a', '..d.d..', '.ee.ee.'], { a: ACIER[4], b: '#0C1C2C', c: CYA[3], d: ACIER[3], e: ACIER[1] }, 50, 15)
  return c
}

/** An old tube set on its legged stand. */
export function tele() {
  const c = canvas(40, 72)
  c.rect(3, 69, 34, 3, SH)
  for (const [a, d] of [
    [8, 5],
    [30, 33],
  ] as const) {
    for (let k = 0; k < 3; k += 1) line(c, a + k, 58, d + k, 69, [BOIS[4], BOIS[2], BOIS[1]][k]!)
  }
  c.rect(9, 62, 22, 1, BOIS[1])
  box(c, 2, 31, 36, 28, BOIS[2], BOIS[4], BOIS[0])
  for (let i = 0; i < 30; i += 1) {
    const x = 3 + Math.floor(noise(i, 411) * 30)
    c.rect(x, 33 + Math.floor(noise(i, 412) * 24), 2 + Math.floor(noise(i, 413) * 3), 1, noise(i, 414) > 0.5 ? BOIS[1] : BOIS[3])
  }
  c.rect(0, 29, 40, 2, BOIS[4])
  c.rect(0, 29, 40, 1, BOIS[5])
  c.rect(1, 31, 38, 1, MAG[3])
  box(c, 4, 33, 32, 12, NOIR, NOIR, BOIS[4])
  box(c, 6, 37, 28, 7, ACIER[2], ACIER[4], ACIER[0])
  c.rect(8, 39, 12, 2, NOIR)
  c.rect(8, 40, 12, 1, ACIER[1])
  c.rect(22, 39, 7, 3, '#061A14')
  c.rect(23, 40, 2, 1, VER[3])
  c.rect(26, 40, 2, 1, VER[3])
  c.rect(30, 39, 2, 1, ROU[3])
  c.rect(30, 41, 2, 1, ACIER[4])
  for (const x of [8, 11, 14]) c.set(x, 42, ACIER[4])
  c.rect(10, 34, 14, 3, NUIT[3])
  c.rect(10, 34, 14, 1, NUIT[5])
  c.rect(12, 35, 8, 1, PAP)
  for (const x of [4, 20]) {
    box(c, x, 46, 16, 12, BOIS[3], BOIS[4], BOIS[1])
    for (let y = 48; y < 56; y += 2) {
      c.rect(x + 2, y, 12, 1, BOIS[1])
      c.rect(x + 2, y + 1, 12, 1, BOIS[2])
    }
  }
  c.rect(18, 51, 1, 2, JAU[3])
  c.rect(21, 51, 1, 2, JAU[3])
  for (const x of [5, 30]) c.rect(x, 28, 5, 1, NOIR)
  const m = (y: number) => (y < 1 ? 5 : y < 2 ? 3 : y < 3 ? 2 : y < 5 ? 1 : y > 26 ? 3 : y > 25 ? 2 : y > 23 ? 1 : 0)
  for (let y = 0; y < 28; y += 1) {
    c.rect(m(y), y, 40 - m(y) * 2, 1, BOIS[3])
    c.set(m(y), y, BOIS[5])
    c.set(39 - m(y), y, BOIS[1])
    c.set(38 - m(y), y, BOIS[2])
  }
  c.rect(6, 0, 28, 1, BOIS[5])
  for (let i = 0; i < 26; i += 1) {
    const x = 2 + Math.floor(noise(i, 421) * 34)
    c.rect(x, 1 + Math.floor(noise(i, 422) * 26), 2 + Math.floor(noise(i, 423) * 4), 1, noise(i, 424) > 0.5 ? BOIS[2] : BOIS[4])
  }
  for (let y = 2; y < 27; y += 1) {
    const e = Math.min(y - 2, 26 - y)
    const i = e < 1 ? 3 : e < 2 ? 2 : 1
    c.rect(1 + i, y, 33 - i, 1, ACIER[1])
  }
  c.rect(4, 2, 28, 1, ACIER[3])
  c.rect(2, 4, 1, 21, ACIER[3])
  for (let y = 4; y < 24; y += 1)
    for (let x = 3; x < 33; x += 1) {
      const [dx, dy] = [Math.min(x - 3, 32 - x), Math.min(y - 4, 23 - y)]
      if (dx + dy < 2) continue
      const e = Math.min(dx, dy)
      c.set(x, y, e < 1 ? '#081A20' : e < 2 ? '#0B2228' : y % 2 ? '#0F2A30' : '#13333A')
    }
  for (const [x, y, w] of [
    [7, 5, 7],
    [5, 6, 3],
    [4, 8, 1],
    [4, 9, 1],
  ] as const)
    c.rect(x, y, w, 1, '#2F6A6E')
  c.rect(26, 22, 4, 1, '#1D4A4E')
  c.rect(5, 25, 8, 1, ACIER[3])
  for (const x of [16, 19, 22, 25]) c.set(x, 25, ACIER[4])
  for (const [y, A] of [
    [7, MAG],
    [14, CYA],
  ] as const) {
    disc(c, 36, y, 2.4, 2.4, ACIER[0])
    disc(c, 36, y, 1.6, 1.6, ACIER[4])
    c.set(35, y - 1, ACIER[5])
    c.set(36, y, A[3])
    c.set(36, y + 1, ACIER[1])
  }
  for (let y = 19; y < 24; y += 2) c.rect(34, y, 5, 1, BOIS[1])
  c.rect(35, 25, 2, 1, '#7FE0C8')
  return c
}

const BULBS: readonly (readonly [number, number])[] = [[11, 1], [16, 2], [21, 5], [25, 7]]
const TROPHY = ['..aaaaaaaaa..', 'bbabbbbbbbabb', 'b.acbbbbbba.b', '.bacbbbbbab..', '...acbbba....', '.....ab......', '....aaba.....']

/**
 * A score board of bulbs under an arc, as an SVG group's content, `w` by `h` pixels of the room. The room writes from
 * y 16 down, so the screen starts at 14; what stands above is the arc, as high as the cornice lets it. A long board hangs
 * higher on the wall and its arc flattens.
 */
export function tableau(w: number, h: number) {
  const spare = Math.max(8, Math.min(18, 158 - h)) - 12
  const top = Math.floor((14 + spare) / 2)
  const low = top + Math.ceil((h - 20) / 2)
  const W = Math.ceil(w / 2)
  const c = canvas(W + 2, low + 9)
  const [cx, half, arc] = [W / 2, W / 2 - 1, top - 1]
  const hw = (y: number) => (y < arc ? Math.round(half / 2 + (half / 2) * Math.sqrt(1 - ((arc - y) / arc) ** 2)) : half)
  for (let y = 0; y < low + 3; y += 1) c.rect(cx - hw(y) + 2, y + 2, hw(y) * 2, 1, '#0F0A1A|0.38')
  c.rect(2, low + 5, W, 3, '#0F0A1A|0.38')
  for (let y = 0; y < low + 3; y += 1) {
    const r = hw(y)
    c.rect(cx - r, y, r * 2, 1, NUIT[2])
    c.set(cx - r, y, MAG[3])
    c.set(cx - r + 1, y, MAG[1])
    c.set(cx + r - 1, y, CYA[3])
    c.set(cx + r - 2, y, CYA[1])
  }
  c.rect(cx - hw(0), 0, hw(0) * 2, 1, MAG[4])
  for (let y = 1; y < arc; y += 1) {
    const [r, was] = [hw(y), hw(y - 1)]
    if (r - was > 1) {
      c.rect(cx - r, y, r - was, 1, MAG[3])
      c.rect(cx + was, y, r - was, 1, CYA[3])
    }
  }
  for (let y = 3; y < arc; y += 1) c.rect(cx - hw(y) + 4, y, (hw(y) - 4) * 2, 1, NUIT[1])
  if (arc > 7) c.sprite(TROPHY, { a: JAU[1], b: JAU[3], c: JAU[4] }, cx - 7, 1)
  else c.sprite(['aaaaa', '.bcb.', '..b..'], { a: JAU[1], b: JAU[3], c: JAU[4] }, cx - 3, 0)
  for (const x of [cx - 15, W - 3 - (cx - 15)]) {
    const y = Math.min(5, arc - 2)
    c.rect(x - 1, y, 3, 1, MAG[3])
    c.rect(x, y - 1, 1, 3, MAG[3])
    c.set(x, y, MAG[4])
  }
  c.rect(5, top - 1, W - 10, low - top + 2, CYA[1])
  c.rect(5, top - 1, W - 10, 1, CYA[2])
  c.rect(6, top, W - 12, low - top, '#100C20')
  const bulbe = (x: number, y: number, k: number) => {
    const A = k % 4 === 3 ? [JAU[0], JAU[1]] : [JAU[3], JAU[4]]
    c.rect(x, y, 2, 2, A[0]!)
    c.set(x, y, A[1]!)
  }
  for (let i = 0; top + 2 + i * 4 + 2 <= low; i += 1) {
    bulbe(2, top + 2 + i * 4, i)
    bulbe(W - 4, top + 2 + i * 4, i + 2)
  }
  for (let i = 0; 6 + i * 5 + 2 <= W - 6; i += 1) bulbe(6 + i * 5, low + 1, i + 1)
  BULBS.forEach(([dx, dy], i) => {
    const [x, y] = [cx - Math.round((dx * half) / 30), Math.round((dy * arc) / 9)]
    bulbe(x, y, i + 1)
    bulbe(W - 2 - x, y, i)
  })
  c.rect(0, low + 3, W, 4, NUIT[3])
  c.rect(0, low + 3, W, 1, NUIT[5])
  c.rect(0, low + 6, W, 1, NUIT[0])
  c.rect(cx - 5, low + 4, 9, 2, NOIR)
  c.rect(cx - 2, low + 4, 3, 1, ROU[3])
  for (const [x, A] of [[6, MAG], [12, CYA], [W - 17, CYA], [W - 11, MAG]] as const) {
    c.rect(x, low + 4, 4, 2, A[1])
    c.rect(x, low + 4, 4, 1, A[3])
  }
  return `<g transform="translate(0 ${14 - top * 2}) scale(2)">${paths(c)}</g>`
}

/** A small bulb score display, set on the screen. */
export function plaque() {
  const c = canvas(36, 13)
  for (const x of [5, 27]) c.rect(x, 12, 4, 1, NOIR)
  c.rect(1, 0, 34, 12, NUIT[2])
  c.rect(0, 1, 36, 10, NUIT[2])
  c.rect(1, 0, 34, 1, NUIT[5])
  c.rect(1, 11, 34, 1, NUIT[0])
  c.rect(0, 1, 1, 10, MAG[3])
  c.rect(35, 1, 1, 10, CYA[3])
  c.rect(2, 3, 32, 7, '#14121F')
  for (let x = 3; x < 34; x += 3) {
    c.set(x, 1, x % 4 === 3 ? JAU[1] : JAU[3])
    c.set(x, 10, x % 4 === 1 ? JAU[1] : JAU[3])
  }
  return c
}

/** A giant console, a cartridge in its top, the fire in its face. */
export function poele() {
  const c = canvas(48, 68)
  c.rect(5, 61, 38, 3, SH)
  const anneau = (x: number, y: number, h: boolean) => {
    const R = [ACIER[3], ACIER[2], ACIER[1], ACIER[0]]
    if (h) for (let k = 0; k < 4; k += 1) c.set(x, y + k, x % 3 === 0 ? mix(R[k]!, NOIR, 0.4) : R[k]!)
    else for (let k = 0; k < 4; k += 1) c.set(x + k, y, y % 3 === 0 ? mix(R[k]!, NOIR, 0.4) : R[k]!)
  }
  for (let x = 0; x < 7; x += 1) anneau(x, 12, true)
  for (let y = 16; y < 28; y += 1) anneau(6, y, false)
  c.rect(7, 12, 3, 4, ACIER[2])
  c.rect(7, 12, 2, 1, ACIER[3])
  c.rect(8, 15, 2, 1, ACIER[1])
  c.rect(0, 11, 2, 6, ACIER[2])
  c.rect(0, 11, 2, 1, ACIER[4])
  c.rect(5, 26, 6, 2, MAG[2])
  c.rect(5, 26, 6, 1, MAG[4])
  c.rect(19, 0, 12, 3, ACIER[1])
  c.rect(19, 0, 12, 1, ACIER[3])
  for (let x = 20; x < 30; x += 2) c.rect(x, 1, 1, 2, NOIR)
  box(c, 15, 3, 20, 24, ACIER[3], ACIER[5], ACIER[1])
  for (let y = 5; y < 9; y += 2) c.rect(17, y, 16, 1, ACIER[2])
  c.rect(15, 10, 2, 4, ACIER[1])
  c.rect(33, 10, 2, 4, ACIER[1])
  c.rect(18, 10, 14, 15, NOIR)
  for (let y = 11; y < 24; y += 1) c.rect(19, y, 12, 1, mix(MAG[2], VIO[1], (y - 11) / 12))
  c.sprite(['.....a......', '....aa......', '...aaba.a...', '..aabbaaa...', '.aabbcbbaa..', '.abbcccbba..', '.abccdccba..', '..abcdcba...'], { a: ROU[3], b: JAU[2], c: JAU[3], d: JAU[4] }, 19, 12)
  c.rect(20, 21, 10, 1, PAP)
  c.rect(20, 23, 6, 1, CYA[3])
  for (let y = 26; y < 31; y += 1) {
    const m = 8 - (y - 26)
    c.rect(m, y, 48 - m * 2, 1, y === 26 ? ACIER[4] : ACIER[3 - Math.floor((y - 26) / 3)]!)
  }
  c.rect(13, 27, 24, 2, NOIR)
  c.rect(15, 26, 20, 2, ACIER[1])
  c.rect(15, 27, 20, 1, NOIR)
  box(c, 4, 31, 40, 25, '#1C1A26', ACIER[2], NOIR)
  c.rect(5, 32, 38, 1, MAG[3])
  c.rect(5, 52, 38, 1, CYA[3])
  c.rect(5, 53, 38, 1, ACIER[0])
  for (let y = 35; y < 51; y += 3) for (const x of [6, 36]) c.rect(x, y, 6, 1, '#14121C')
  box(c, 6, 34, 7, 5, ACIER[2], ACIER[4], ACIER[0])
  c.rect(7, 35, 3, 3, ROU[2])
  c.rect(7, 35, 3, 1, ROU[4])
  disc(c, 9, 44, 2.4, 2.4, ACIER[0])
  disc(c, 9, 44, 1.5, 1.5, JAU[2])
  c.set(8, 43, JAU[4])
  const leds = [VER[3], VER[3], JAU[3], ROU[3]]
  leds.forEach((p, i) => c.rect(6 + i * 2, 49, 1, 2, p))
  for (const [y, A] of [
    [37, CYA],
    [44, MAG],
  ] as const) {
    disc(c, 39, y, 3, 3, ACIER[2])
    disc(c, 39, y, 2, 2, NOIR)
    c.rect(38, y - 1, 3, 1, ACIER[4])
    c.rect(38, y + 1, 3, 1, ACIER[3])
    c.set(39, y, A[3])
  }
  c.rect(13, 31, 22, 21, ACIER[3])
  c.rect(13, 31, 22, 1, ACIER[5])
  c.rect(13, 51, 22, 1, ACIER[0])
  c.rect(14, 32, 20, 19, ACIER[1])
  c.rect(15, 32, 18, 17, '#0C0A12')
  c.rect(16, 33, 16, 15, '#1B1730')
  for (const [x, y] of [
    [14, 32],
    [33, 32],
    [14, 50],
    [33, 50],
  ] as const)
    c.set(x, y, ACIER[5])
  for (let x = 16; x < 32; x += 2) c.rect(x, 49, 1, 1, NOIR)
  c.rect(3, 55, 42, 3, ACIER[1])
  c.rect(3, 55, 42, 1, ACIER[3])
  c.rect(3, 57, 42, 1, NOIR)
  for (const x of [7, 35]) {
    c.rect(x, 58, 6, 3, NOIR)
    c.rect(x, 58, 6, 1, ACIER[2])
  }
  return c
}

/** The crab's basket: a velvet nest with a checked cushion. */
export function panier(dort: boolean) {
  const c = canvas(38, 22)
  c.rect(2, 19, 34, 3, SH)
  disc(c, 19, 11, 17, 9, (x, y) => (y > 13 ? VIO[1] : VIO[2]))
  disc(c, 19, 9, 13.5, 5.5, NUIT[0])
  disc(c, 19, 8.5, 12, 4.4, (x, y) => ((Math.floor(x / 3) + Math.floor(y / 2)) % 2 ? CYA[0] : '#163A4C'))
  disc(c, 19, 10, 17, 9, (x, y, d) => (d > 0.82 && y < 10 ? ((x * 3 + y) % 5 < 3 ? VIO[3] : VIO[2]) : null))
  for (let x = 6; x < 33; x += 1) c.set(x, Math.round(16 + Math.sqrt(Math.max(0, 1 - ((x - 19) / 15) ** 2)) * 3), MAG[2])
  for (let x = 7; x < 32; x += 3) c.set(x, 15, VIO[3])
  for (const x of [8, 13, 25, 30]) c.rect(x, 17, 1, 1, CYA[2])
  if (dort)
    c.sprite(
      ['...cccccccccc...', '..cLLLLLLLLLLc..', '.cLccccccccccsc.', 'cccgccccccgcccss', 'ccccccccccccccss', '.ccccccLLccccss.', '..cc.cccccc.cc..'],
      { c: '#D97757', L: '#EE9A7C', s: '#B85A3C', g: '#1B1730' },
      11,
      3,
    )
  return c
}
