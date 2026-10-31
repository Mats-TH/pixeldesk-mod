import { canvas, mix, noise, paths } from '../canvas'
import type { Canvas, Paint } from '../canvas'
import { HEARTH_PALETTE, fire, flue, spriteBody, stove } from '../hearth'
import { once, pattern, pick } from '../pack'
import type { Backdrop, Board, Hearth, Pack, Plaque, Tele } from '../pack'
import type { DeskState } from '../sprites'
import { ironStove } from './stove'

type C = Canvas
const INK = '#2A2036'
const SH = '#1B1730|0.28'
const WASHI = ['#FFF8E8', '#F4ECD8', '#E4D6B6', '#CDBB96'] as const
const CEDAR = ['#201214', '#34201E', '#4C2E28', '#6A4234', '#8C5E46', '#B0825E'] as const
const HINOKI = ['#6E5034', '#8E6E48', '#B09064', '#D0B284', '#E8D2A6'] as const
const LAQUE = ['#5E1A1A', '#8A2822', '#B23A2E', '#D85A44', '#F08A68'] as const
const SUMI = ['#16141C', '#24222C', '#35323E', '#4A4654'] as const
const OR = ['#8C6A2E', '#C9A24A', '#E8C868', '#FFE08A'] as const
const NUIT = ['#1A2248', '#24305A', '#2F3E70', '#3F5288', '#5A70A8', '#8CA0CC'] as const
const G = ['#22483A', '#2F5D46', '#3E7A4C', '#5E9A58', '#8CC265'] as const

const box = (c: C, x: number, y: number, w: number, h: number, base: string, lit: string, dark: string) => {
  c.rect(x, y, w, h, base)
  c.rect(x, y, w, 1, lit)
  c.rect(x, y, 1, h, lit)
  c.rect(x + w - 1, y, 1, h, dark)
  c.rect(x, y + h - 1, w, 1, dark)
}
const disc = (c: C, cx: number, cy: number, rx: number, ry: number, paint: string | ((x: number, y: number, d: number) => string | null)) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d > 1) continue
      const p = typeof paint === 'string' ? paint : paint(x, y, d)
      if (p) c.set(x, y, p)
    }
  }
}
const line = (c: C, x0: number, y0: number, x1: number, y1: number, paint: string) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i += 1) c.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), paint)
}
const grain = (c: C, x: number, y: number, w: number, h: number, a: string, b: string, seed: number) => {
  for (let i = 0; i < (w * h) / 9; i += 1) {
    const px = x + Math.floor(noise(i, seed) * w)
    const py = y + Math.floor(noise(i, seed + 1) * h)
    c.rect(px, py, Math.min(2 + Math.floor(noise(i, seed + 2) * 6), x + w - px), 1, noise(i, seed + 3) > 0.5 ? a : b)
  }
}
const wrap = (x: number, n: number) => ((x % n) + n) % n

/** Seigaiha waves. */
function seigaiha(base: string, ring: string, edge: string) {
  const [w, h, R] = [20, 10, 10]
  const c = canvas(w, h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let color = base
      for (let r = -2; r < 6; r += 1) {
        const cy = r * 5
        const off = r % 2 ? 10 : 0
        for (let k = -1; k < 3; k += 1) {
          const d = Math.hypot(x - (k * 20 + off), y - cy)
          if (d > R) continue
          color = d > R - 1 ? edge : (d > R - 3.2 && d <= R - 2.2) || (d > R - 5.8 && d <= R - 4.8) ? ring : base
        }
      }
      c.set(x, y, color)
    }
  }
  return c
}

/** An ichimatsu check. */
function ichimatsu(a: string, b: string, fleck: string) {
  const c = canvas(24, 24)
  c.rect(0, 0, 24, 24, a)
  c.rect(12, 0, 12, 12, b)
  c.rect(0, 12, 12, 12, b)
  for (let i = 0; i < 40; i += 1) c.set(Math.floor(noise(i, 31) * 24), Math.floor(noise(i, 32) * 24), fleck)
  return c
}

/** Asanoha hemp stars. */
function asanoha(base: string, ink: string) {
  const [w, h] = [18, 32]
  const c = canvas(w, h)
  c.rect(0, 0, w, h, base)
  const seam = (a: readonly [number, number], b: readonly [number, number]) => {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1) * 2
    for (let i = 0; i <= n; i += 1) c.set(wrap(Math.round(a[0] + ((b[0] - a[0]) * i) / n), w), wrap(Math.round(a[1] + ((b[1] - a[1]) * i) / n), h), ink)
  }
  const tri = (a: readonly [number, number], b: readonly [number, number], d: readonly [number, number]) => {
    const m = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3] as const
    for (const p of [a, b, d]) seam(p, m)
    seam(a, b)
    seam(b, d)
    seam(d, a)
  }
  tri([0, 0], [18, 0], [9, 16])
  tri([0, 32], [18, 32], [9, 16])
  tri([0, 0], [9, 16], [-9, 16])
  tri([0, 32], [9, 16], [-9, 16])
  return c
}

/** The foot of the wall: cedar boards, battens and a bamboo rail. */
function lambris() {
  const c = canvas(44, 24)
  c.rect(0, 0, 44, 24, CEDAR[2])
  for (let x = 0; x < 44; x += 11) c.rect(x + 1, 3, 10, 18, mix(CEDAR[2], CEDAR[3], noise(x, 7) * 0.7))
  grain(c, 0, 4, 44, 16, CEDAR[1], CEDAR[3], 41)
  for (let x = 0; x < 44; x += 11) {
    c.rect(x, 3, 1, 18, CEDAR[0])
    c.rect(x + 1, 3, 1, 18, CEDAR[3])
  }
  c.rect(0, 0, 44, 2, HINOKI[3])
  c.rect(0, 0, 44, 1, HINOKI[4])
  c.rect(0, 2, 44, 1, CEDAR[0])
  for (const x of [10, 32]) c.rect(x, 0, 1, 2, HINOKI[1])
  c.rect(0, 20, 44, 4, CEDAR[1])
  c.rect(0, 20, 44, 1, CEDAR[4])
  c.rect(0, 23, 44, 1, CEDAR[0])
  return c
}

/** Long waxed cedar boards, as on a veranda. `rich`: with their grain. */
function planches(rich: boolean) {
  const c = canvas(150, 60)
  const tones = ['#6A4636', '#724C3A', '#624032', '#6E4A38', '#5E3C30']
  for (let row = 0; row < 6; row += 1) {
    const y = row * 10
    const off = [0, 62, 28, 96, 44, 118][row]!
    for (let i = -1; i < 3; i += 1) {
      const x = off + i * 75
      const base = tones[Math.floor(noise(i + row * 7 + 4, 5) * 5)]!
      for (let px = x; px < x + 75; px += 1) c.rect(wrap(px, 150), y, 1, 9, base)
      for (let g = 0; rich && g < 5; g += 1) {
        const gx = x + 4 + Math.floor(noise(i + g, row + 40) * 56)
        const gy = y + 1 + Math.floor(noise(g + 2, i + row) * 7)
        const len = 6 + Math.floor(noise(i, g + row) * 14)
        for (let k = 0; k < len; k += 1) c.set(wrap(gx + k, 150), gy, mix(base, '#3E2620', 0.34))
      }
      const seam = wrap(x + 74, 150)
      c.rect(seam, y, 1, 9, '#38221C')
      c.rect((seam + 1) % 150, y, 1, 9, mix(base, '#A07858', 0.3))
    }
    c.rect(0, y, 150, 1, '#84604A')
    c.rect(0, y + 9, 150, 1, '#38221C')
  }
  return c
}

/** Dark, calm tatami: a weave you barely see, a thin edging. */
function tatami() {
  const c = canvas(120, 64)
  const tones = ['#7E7C50', '#78764C', '#84824F', '#747248']
  const mat = (x: number, y: number, w: number, h: number, long: boolean, s: number) => {
    const b = tones[s % 4]!
    c.rect(x, y, w, h, b)
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) if ((long ? i : j) % 2 === 0) c.set(x + i, y + j, mix(b, '#5E5C3C', 0.14))
    if (long) {
      c.rect(x, y, 1, h, '#3A4436')
      c.rect(x + w - 1, y, 1, h, '#3A4436')
    } else {
      c.rect(x, y, w, 1, '#3A4436')
      c.rect(x, y + h - 1, w, 1, '#3A4436')
    }
  }
  mat(0, 0, 64, 32, false, 1)
  mat(0, 32, 64, 32, false, 2)
  mat(64, 0, 32, 64, true, 3)
  mat(96, 0, 24, 64, true, 0)
  return c
}

/** Indigo carpet quilted in sashiko crosses. `rich`: with its nap. */
function moquette(rich: boolean) {
  const c = canvas(110, 66)
  c.rect(0, 0, 110, 66, '#2C3762')
  for (let y = 0; y < 66; y += 1) {
    for (let x = 0; x < 110; x += 1) {
      if (rich && y % 2 === 0) c.set(x, y, '#29335C')
      if (rich && noise(x, y) > 0.9) c.set(x, y, '#323E6C')
    }
  }
  const plus = (x: number, y: number) => {
    c.rect(x - 2, y, 5, 1, '#55669C')
    c.rect(x, y - 2, 1, 5, '#55669C')
    c.set(x, y, '#7486B8')
  }
  for (let y = 5; y < 66; y += 22) for (let x = 5; x < 110; x += 22) plus(x, y)
  for (let y = 16; y < 66; y += 22) for (let x = 16; x < 110; x += 22) plus(x, y)
  return c
}

/** Named apart from the other rooms' `fenetre`: no moonlight falls from this one, and the night stays behind the shoji. */
function shoji() {
  const c = canvas(62, 50)
  c.rect(1, 1, 60, 48, CEDAR[1])
  c.rect(4, 4, 54, 42, '#16204A')
  c.rect(4, 18, 54, 10, '#1E2A58')
  c.rect(4, 26, 54, 8, '#2C3A6E')
  c.rect(4, 32, 54, 6, '#46507E')
  for (let i = 0; i < 26; i += 1) c.set(4 + Math.floor(noise(i, 21) * 40), 4 + Math.floor(noise(i, 22) * 20), i % 4 ? WASHI[1] : OR[2])
  disc(c, 13, 13, 5, 5, (x, y) => (noise(x, y) > 0.86 ? WASHI[2] : WASHI[0]))
  for (let x = 4; x < 46; x += 1) {
    const h = Math.max(0, 25 - Math.abs(x - 26) * 1.15 + (Math.abs(x - 26) < 3 ? -1 : 0))
    if (h) c.rect(x, 39 - Math.round(h), 1, Math.round(h), mix('#3A4780', '#28345F', Math.abs(x - 26) / 22))
    const snow = Math.max(0, 8 - Math.abs(x - 26) * 0.55 + (x % 3 ? 1 : -1))
    if (h > 8) c.rect(x, 39 - Math.round(h), 1, Math.round(snow), x < 26 ? WASHI[0] : WASHI[2])
  }
  for (let x = 4; x < 58; x += 1) {
    const h = Math.round(5 + 2 * Math.sin(x * 0.5) + Math.sin(x * 0.21) * 2)
    c.rect(x, 46 - h, 1, h, '#141E3E')
    if (x % 5 === 0) c.set(x, 45 - h, '#141E3E')
  }
  line(c, 4, 30, 16, 36, CEDAR[0])
  disc(c, 9, 29, 5, 3, G[0])
  disc(c, 16, 33, 4, 2.4, G[1])
  // The sliding shoji, half open.
  c.rect(34, 2, 26, 46, WASHI[1])
  for (let y = 2; y < 48; y += 1) for (let x = 34; x < 60; x += 1) if (noise(x, y) > 0.9) c.set(x, y, WASHI[2])
  c.rect(34, 2, 26, 22, '#B8A880')
  for (const x of [34, 42, 51, 59]) c.rect(x, 2, 1, 46, CEDAR[3])
  for (const y of [11, 20, 29, 38]) c.rect(34, y, 26, 1, CEDAR[3])
  c.rect(33, 2, 2, 46, CEDAR[2])
  c.rect(33, 2, 1, 46, CEDAR[4])
  c.rect(58, 2, 2, 46, CEDAR[2])
  c.rect(37, 42, 3, 4, CEDAR[1])
  c.rect(0, 0, 62, 3, CEDAR[2])
  c.rect(0, 0, 62, 1, CEDAR[4])
  c.rect(0, 47, 62, 3, CEDAR[3])
  c.rect(0, 47, 62, 1, CEDAR[5])
  c.rect(0, 49, 62, 1, CEDAR[0])
  c.rect(0, 0, 3, 50, CEDAR[2])
  c.rect(0, 0, 1, 50, CEDAR[4])
  c.rect(59, 0, 3, 50, CEDAR[2])
  c.rect(61, 0, 1, 50, CEDAR[0])
  return c
}

function kakemono() {
  const c = canvas(24, 50)
  c.rect(8, 0, 1, 3, CEDAR[1])
  c.rect(15, 0, 1, 3, CEDAR[1])
  c.rect(8, 0, 8, 1, CEDAR[1])
  c.rect(11, 0, 2, 1, OR[1])
  c.rect(5, 44, 15, 4, SH)
  c.rect(3, 4, 18, 41, NUIT[2])
  c.rect(3, 4, 1, 41, NUIT[3])
  c.rect(20, 4, 1, 41, NUIT[1])
  c.rect(5, 9, 14, 30, WASHI[1])
  c.rect(5, 9, 14, 1, WASHI[0])
  c.rect(18, 9, 1, 30, WASHI[3])
  for (let i = 0; i < 18; i += 1) c.set(5 + Math.floor(noise(i, 51) * 14), 9 + Math.floor(noise(i, 52) * 30), WASHI[2])
  disc(c, 13, 16, 3.4, 3.4, LAQUE[2])
  disc(c, 12, 15, 1.4, 1.4, LAQUE[3])
  for (const [x, y, w] of [[8, 25, 7], [7, 26, 8], [9, 27, 6], [11, 28, 3]] as const) c.rect(x, y, w, 1, SUMI[2])
  c.rect(14, 22, 1, 4, SUMI[2])
  c.rect(14, 22, 3, 1, SUMI[1])
  c.set(15, 21, LAQUE[2])
  c.rect(10, 29, 1, 6, SUMI[3])
  c.rect(12, 29, 1, 6, SUMI[3])
  for (let x = 6; x < 18; x += 1) c.rect(x, 36 + Math.round(Math.sin(x * 0.9)), 1, 2, WASHI[3])
  c.rect(16, 33, 2, 2, LAQUE[2])
  c.rect(1, 3, 22, 3, CEDAR[3])
  c.rect(1, 3, 22, 1, CEDAR[5])
  c.rect(0, 44, 24, 4, SUMI[2])
  c.rect(0, 44, 24, 1, SUMI[3])
  c.rect(0, 47, 24, 1, SUMI[0])
  for (const x of [0, 22]) c.rect(x, 44, 2, 4, OR[1])
  c.rect(0, 44, 2, 1, OR[3])
  c.rect(22, 44, 2, 1, OR[3])
  return c
}

function tana() {
  const c = canvas(62, 40)
  const shelf = (x: number, y: number, w: number) => {
    c.rect(x, y, w, 3, CEDAR[3])
    c.rect(x, y, w, 1, CEDAR[5])
    c.rect(x, y + 2, w, 1, CEDAR[1])
    c.rect(x + 2, y + 3, w - 4, 1, '#1B1730|0.3')
  }
  c.rect(2, 3, 58, 33, CEDAR[1])
  c.rect(2, 3, 58, 1, CEDAR[0])
  grain(c, 3, 4, 56, 31, CEDAR[0], CEDAR[2], 61)
  c.rect(0, 0, 62, 3, CEDAR[3])
  c.rect(0, 0, 62, 1, CEDAR[5])
  c.rect(0, 3, 2, 34, CEDAR[3])
  c.rect(60, 3, 2, 34, CEDAR[2])
  shelf(2, 15, 34)
  shelf(26, 24, 34)
  c.rect(30, 18, 2, 6, CEDAR[3])
  c.rect(30, 18, 1, 6, CEDAR[4])
  // A daruma.
  disc(c, 10, 10, 4.5, 4.8, x => (x < 8 ? LAQUE[3] : x > 12 ? LAQUE[1] : LAQUE[2]))
  disc(c, 10, 9.5, 2.6, 2.2, WASHI[1])
  c.set(9, 9, SUMI[0])
  c.set(11, 9, SUMI[0])
  c.rect(7, 13, 7, 1, OR[2])
  // Scrolls.
  for (const [x, col] of [[18, WASHI[1]], [21, WASHI[2]], [24, WASHI[1]]] as const) {
    c.rect(x, 11, 3, 4, col)
    c.rect(x + 2, 11, 1, 4, WASHI[3])
    c.rect(x, 12, 3, 1, LAQUE[2])
  }
  c.rect(19, 8, 3, 3, WASHI[1])
  c.rect(19, 9, 3, 1, NUIT[3])
  // A tea bowl.
  disc(c, 44, 20, 6, 4, (x, y) => (y < 18 ? null : x < 42 ? '#A8C4B4' : x > 47 ? '#58806E' : '#7FA698'))
  c.rect(38, 18, 12, 1, '#4A6A5C')
  c.rect(41, 23, 6, 1, CEDAR[0])
  // A vase and its branch.
  c.rect(52, 16, 5, 8, NUIT[3])
  c.rect(52, 16, 1, 8, NUIT[4])
  c.rect(56, 16, 1, 8, NUIT[1])
  c.rect(53, 14, 3, 2, NUIT[2])
  line(c, 54, 13, 52, 5, CEDAR[4])
  line(c, 53, 9, 57, 6, CEDAR[4])
  for (const [x, y] of [[51, 5], [53, 4], [57, 6], [55, 8], [50, 8], [58, 4]] as const) {
    c.rect(x, y, 2, 2, '#E8A0B0')
    c.set(x, y, '#FAD4DC')
  }
  c.rect(4, 28, 21, 9, CEDAR[3])
  c.rect(4, 28, 21, 1, CEDAR[5])
  c.rect(14, 28, 1, 9, CEDAR[1])
  c.rect(4, 36, 21, 1, CEDAR[1])
  for (const x of [8, 19]) {
    c.rect(x, 32, 3, 2, OR[1])
    c.set(x, 32, OR[3])
  }
  c.rect(0, 37, 62, 3, CEDAR[3])
  c.rect(0, 37, 62, 1, CEDAR[5])
  c.rect(0, 39, 62, 1, CEDAR[0])
  return c
}

function sensu() {
  const c = canvas(46, 28)
  const [cx, cy, R, r] = [23, 26, 24, 8]
  for (let y = 0; y < 28; y += 1) {
    for (let x = 0; x < 46; x += 1) {
      const d = Math.hypot(x - cx, y - cy)
      const a = Math.atan2(cy - y, x - cx)
      if (d > R || d < r || a < 0.28 || a > Math.PI - 0.28) continue
      const pleat = Math.floor(a * 9) % 2
      let col: string = pleat ? WASHI[1] : WASHI[2]
      const k = (d - r) / (R - r)
      if (k > 0.3 && k < 0.62 + 0.14 * Math.sin(a * 14)) col = pleat ? NUIT[3] : NUIT[2]
      if (k >= 0.62 + 0.14 * Math.sin(a * 14) && k < 0.72 + 0.14 * Math.sin(a * 14)) col = WASHI[0]
      if (k > 0.92) col = pleat ? OR[2] : OR[1]
      c.set(x, y, col)
    }
  }
  disc(c, 30, 12, 3, 3, LAQUE[2])
  for (let i = 0; i <= 9; i += 1) {
    const a = 0.28 + (i * (Math.PI - 0.56)) / 9
    line(c, cx + Math.cos(a) * 4, cy - Math.sin(a) * 4, cx + Math.cos(a) * r, cy - Math.sin(a) * r, CEDAR[2])
  }
  c.rect(cx - 1, cy - 1, 3, 3, OR[1])
  c.set(cx, cy, OR[3])
  return c
}

function estampe() {
  const c = canvas(40, 30)
  c.rect(2, 2, 38, 28, SH)
  box(c, 0, 0, 38, 28, CEDAR[1], CEDAR[3], CEDAR[0])
  c.rect(2, 2, 34, 24, WASHI[1])
  c.rect(4, 4, 30, 20, '#E8DCB8')
  c.rect(4, 4, 30, 6, '#D8C89E')
  c.rect(4, 4, 30, 2, '#8CA8C0')
  for (let x = 4; x < 34; x += 1) {
    const h = Math.max(0, 8 - Math.abs(x - 26) * 0.9)
    if (h) c.rect(x, 18 - Math.round(h), 1, Math.round(h), '#5A70A8')
    if (h > 5) c.set(x, 18 - Math.round(h), WASHI[0])
  }
  for (let x = 4; x < 34; x += 1) {
    const t = (x - 4) / 30
    const crest = Math.round(21 - 13 * Math.exp(-(((t - 0.3) / 0.2) ** 2)) - 2 * Math.sin(t * 16))
    c.rect(x, crest, 1, 24 - crest, x % 3 ? NUIT[2] : NUIT[3])
    c.set(x, crest, WASHI[0])
    c.set(x, crest + 1, NUIT[5])
    if (noise(x, 71) > 0.55) c.set(x, crest - 1, WASHI[0])
  }
  for (const [x, y] of [[15, 7], [18, 9], [12, 6], [20, 11], [17, 5]] as const) c.rect(x, y, 2, 2, WASHI[0])
  c.rect(30, 6, 2, 3, LAQUE[2])
  return c
}

function chochin() {
  const c = canvas(28, 44)
  disc(c, 14, 22, 13, 14, (_, __, d) => (d < 0.55 ? '#FF9A50|0.16' : '#FF9A50|0.09'))
  c.rect(14, 0, 1, 8, SUMI[1])
  c.rect(10, 8, 9, 3, SUMI[1])
  c.rect(10, 8, 9, 1, SUMI[3])
  disc(c, 14, 21, 9.5, 11, (x, y) => {
    const tone = x < 10 ? LAQUE[3] : x > 19 ? LAQUE[1] : LAQUE[2]
    return y % 2 ? tone : mix(tone, LAQUE[0], 0.4)
  })
  // A white crest.
  disc(c, 14, 21, 4.4, 4.4, WASHI[1])
  disc(c, 14, 21, 2.6, 2.6, LAQUE[2])
  c.rect(13, 20, 3, 3, WASHI[1])
  c.rect(10, 31, 9, 3, SUMI[1])
  c.rect(10, 31, 9, 1, SUMI[3])
  c.rect(14, 34, 1, 3, OR[1])
  c.rect(13, 37, 3, 5, OR[2])
  c.rect(13, 37, 3, 1, OR[3])
  c.rect(15, 38, 1, 4, OR[0])
  return c
}

const SAG = 26
const LANTERN = 13
const sagged = (x: number) => Math.round(2 + Math.abs(Math.sin((x * Math.PI) / SAG)) * 7)

/** A string of small lanterns, `w` a whole number of `SAG`. */
function guirlande(w: number) {
  const c = canvas(w, 16)
  for (let i = 6; i < w; i += LANTERN) c.rect(i - 3, sagged(i), 7, 8, '#FFC857|0.14')
  for (let i = 0; i < w; i += 1) c.set(i, sagged(i), SUMI[1])
  for (let i = 6, n = 0; i < w; i += LANTERN, n += 1) {
    const y = sagged(i) + 1
    const [a, b, d] = n % 2 ? [WASHI[1], WASHI[0], WASHI[3]] : [LAQUE[2], LAQUE[3], LAQUE[1]]
    c.rect(i - 1, y, 3, 1, SUMI[1])
    c.rect(i - 2, y + 1, 5, 4, a)
    c.rect(i - 2, y + 1, 1, 4, b)
    c.rect(i + 2, y + 1, 1, 4, d)
    c.rect(i - 1, y + 2, 3, 1, d)
    c.rect(i - 1, y + 5, 3, 1, SUMI[1])
  }
  return c
}

function byobu() {
  const c = canvas(74, 50)
  c.rect(2, 47, 70, 3, SH)
  const panel = 12
  for (let i = 0; i < 6; i += 1) {
    const x = 1 + i * panel
    const lit = i % 2 === 0
    c.rect(x, 2, panel, 44, lit ? '#DDB95E' : '#C29E48')
    for (let j = 0; j < 44; j += 11) c.rect(x, 2 + j, panel, 1, lit ? '#CDA94E' : '#B28E3E')
    for (let j = 0; j < 4; j += 1) c.rect(x + (j % 2 ? 0 : panel / 2), 2 + j * 11, 1, 11, lit ? '#CDA94E' : '#B28E3E')
  }
  // Hills in the mist.
  for (let x = 2; x < 72; x += 1) {
    const h = Math.round(11 + 5 * Math.sin(x * 0.09 + 1) + 2 * Math.sin(x * 0.31))
    c.rect(x, 45 - h, 1, h, x % 12 > 5 ? '#4E6E5C' : '#5C7E68')
    c.rect(x, 45 - Math.round(h * 0.5), 1, Math.round(h * 0.5), x % 12 > 5 ? '#34523F' : '#40604C')
  }
  // A cherry branch across the panels.
  const pts = [[2, 12], [14, 16], [26, 13], [38, 20], [50, 17], [64, 25]] as const
  for (let i = 0; i < pts.length - 1; i += 1) {
    line(c, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], CEDAR[1])
    line(c, pts[i]![0], pts[i]![1] + 1, pts[i + 1]![0], pts[i + 1]![1] + 1, CEDAR[0])
  }
  line(c, 26, 13, 34, 6, CEDAR[1])
  line(c, 38, 20, 46, 30, CEDAR[1])
  line(c, 14, 16, 20, 25, CEDAR[1])
  for (let i = 0; i < 42; i += 1) {
    const [x, y] = [3 + Math.floor(noise(i, 81) * 66), 4 + Math.floor(noise(i, 82) * 28)]
    if (Math.abs(y - (12 + (x / 64) * 13)) > 13) continue
    c.rect(x, y, 3, 3, '#F4A8B8')
    c.set(x + 1, y + 1, '#D85A7A')
    c.set(x, y, '#FFE0E6')
  }
  // Cranes in flight.
  for (const [x, y] of [[54, 7], [62, 11]] as const) {
    c.rect(x, y, 5, 1, WASHI[0])
    c.rect(x - 2, y - 1, 2, 1, WASHI[0])
    c.rect(x + 5, y - 1, 2, 1, WASHI[0])
    c.set(x + 3, y + 1, SUMI[1])
  }
  c.rect(0, 0, 74, 2, SUMI[1])
  c.rect(0, 0, 74, 1, SUMI[3])
  c.rect(0, 45, 74, 2, SUMI[1])
  c.rect(0, 46, 74, 1, SUMI[0])
  for (let i = 0; i <= 6; i += 1) {
    const x = Math.min(73, i * panel)
    c.rect(x, 0, 2, 47, SUMI[1])
    c.rect(x, 0, 1, 47, i % 2 ? SUMI[0] : SUMI[3])
    for (const y of [10, 34]) c.rect(x, y, 2, 3, OR[1])
  }
  return c
}

function bonsai() {
  const c = canvas(38, 52)
  c.rect(4, 49, 30, 3, SH)
  c.rect(6, 34, 26, 3, CEDAR[3])
  c.rect(6, 34, 26, 1, CEDAR[5])
  c.rect(6, 36, 26, 1, CEDAR[1])
  c.rect(9, 37, 20, 2, CEDAR[1])
  for (const x of [9, 27]) {
    c.rect(x, 37, 2, 13, CEDAR[2])
    c.rect(x, 37, 1, 13, CEDAR[4])
  }
  c.rect(9, 44, 20, 1, CEDAR[2])
  c.rect(9, 29, 20, 5, NUIT[3])
  c.rect(9, 29, 20, 1, NUIT[5])
  c.rect(9, 29, 1, 5, NUIT[4])
  c.rect(28, 29, 1, 5, NUIT[1])
  c.rect(11, 34, 3, 1, NUIT[1])
  c.rect(24, 34, 3, 1, NUIT[1])
  c.rect(10, 28, 18, 1, '#3A2A20')
  for (const [x0, y0, x1, y1] of [[17, 28, 15, 22], [15, 22, 20, 16], [20, 16, 17, 10], [20, 16, 27, 12], [15, 22, 8, 18]] as const) {
    line(c, x0, y0, x1, y1, CEDAR[2])
    line(c, x0 + 1, y0, x1 + 1, y1, CEDAR[1])
    line(c, x0 - 1, y0, x1 - 1, y1, CEDAR[4])
  }
  const cloud = (cx: number, cy: number, rx: number, ry: number) => {
    disc(c, cx, cy + 1, rx, ry, G[0])
    disc(c, cx, cy, rx, ry - 0.5, (x, y) => (noise(x, y) > 0.72 ? G[2] : G[1]))
    disc(c, cx - 1, cy - 1, rx - 2, ry - 2, (x, y) => (noise(x, y) > 0.6 ? G[4] : G[3]))
  }
  cloud(7, 15, 6, 3.6)
  cloud(29, 10, 7, 4)
  cloud(17, 7, 9, 5)
  return c
}

function andon() {
  const c = canvas(30, 50)
  disc(c, 15, 22, 14.5, 20, (_, __, d) => (d < 0.5 ? '#FFD880|0.2' : '#FFD880|0.1'))
  c.rect(5, 47, 20, 3, SH)
  c.rect(7, 6, 16, 34, WASHI[0])
  c.rect(7, 22, 16, 18, '#FFE8B0')
  for (let y = 6; y < 40; y += 1) for (let x = 7; x < 23; x += 1) if (noise(x, y) > 0.92) c.set(x, y, WASHI[2])
  c.rect(10, 34, 10, 6, '#FFD070')
  c.rect(14, 12, 2, 28, HINOKI[3])
  c.rect(7, 22, 16, 1, HINOKI[3])
  for (const x of [5, 23]) {
    c.rect(x, 3, 2, 44, CEDAR[2])
    c.rect(x, 3, 1, 44, CEDAR[4])
  }
  c.rect(4, 3, 22, 3, CEDAR[3])
  c.rect(4, 3, 22, 1, CEDAR[5])
  c.rect(6, 39, 18, 3, CEDAR[3])
  c.rect(6, 39, 18, 1, CEDAR[5])
  c.rect(3, 46, 8, 2, CEDAR[1])
  c.rect(19, 46, 8, 2, CEDAR[1])
  return c
}

function bambou() {
  const c = canvas(32, 66)
  c.rect(4, 63, 24, 3, SH)
  const leaf = (x: number, y: number, dir: number, k: number) => {
    for (let i = 0; i < 6; i += 1) c.rect(dir > 0 ? x + i : x - i - 1, y + Math.floor(i / 3), 1, i < 4 ? 2 : 1, G[k]!)
  }
  const stalk = (x: number, top: number, tone: number) => {
    for (let y = top; y < 50; y += 1) {
      c.rect(x, y, 3, 1, ['#5E9A58', '#4E8A4C', '#3E7A4C'][tone]!)
      c.set(x, y, '#9CCC70')
      c.set(x + 2, y, G[1])
    }
    for (let y = top + 7; y < 50; y += 9) {
      c.rect(x - 1, y, 5, 1, G[0])
      c.rect(x, y + 1, 3, 1, '#B4D88A')
    }
  }
  stalk(9, 12, 2)
  stalk(20, 4, 1)
  stalk(14, 0, 0)
  for (let i = 0; i < 16; i += 1) {
    const x = [10, 15, 21][i % 3]!
    leaf(x + (i % 2 ? 3 : -1), 2 + i * 3 + Math.floor(noise(i, 91) * 3), i % 2 ? 1 : -1, 2 + (i % 3))
  }
  c.rect(5, 50, 22, 3, SUMI[2])
  c.rect(5, 50, 22, 1, SUMI[3])
  c.rect(7, 53, 18, 10, SUMI[1])
  c.rect(7, 53, 2, 10, SUMI[2])
  c.rect(23, 53, 2, 10, SUMI[0])
  c.rect(9, 62, 14, 1, SUMI[0])
  for (const [x, y] of [[12, 56], [15, 58], [18, 55], [20, 59]] as const) c.set(x, y, SUMI[3])
  c.rect(6, 49, 20, 1, '#3A2A20')
  return c
}

/** A step chest. */
function dansu() {
  const c = canvas(50, 54)
  c.rect(2, 51, 46, 3, SH)
  const step = (x: number, y: number, w: number, h: number) => {
    box(c, x, y, w, h, CEDAR[2], CEDAR[3], CEDAR[0])
    grain(c, x + 1, y + 1, w - 2, h - 2, CEDAR[1], CEDAR[3], x + y)
    c.rect(x, y, w, 2, HINOKI[2])
    c.rect(x, y, w, 1, HINOKI[3])
  }
  step(2, 38, 46, 14)
  step(2, 26, 32, 12)
  step(2, 14, 20, 12)
  step(2, 2, 10, 12)
  const pull = (x: number, y: number) => {
    c.rect(x, y, 5, 3, SUMI[2])
    c.rect(x, y, 5, 1, SUMI[3])
    c.rect(x + 1, y + 2, 3, 2, OR[1])
  }
  const drawer = (x: number, y: number, w: number, h: number) => {
    c.rect(x, y, w, h, CEDAR[3])
    c.rect(x, y, w, 1, CEDAR[4])
    c.rect(x, y + h - 1, w, 1, CEDAR[1])
    c.rect(x + w - 1, y, 1, h, CEDAR[1])
    pull(x + Math.floor(w / 2) - 2, y + 3)
    c.rect(x, y, 2, 2, SUMI[2])
    c.rect(x + w - 2, y, 2, 2, SUMI[2])
    c.rect(x, y + h - 2, 2, 2, SUMI[2])
    c.rect(x + w - 2, y + h - 2, 2, 2, SUMI[2])
  }
  drawer(4, 41, 20, 10)
  drawer(26, 41, 20, 10)
  drawer(4, 29, 28, 8)
  drawer(4, 17, 16, 8)
  drawer(4, 5, 6, 8)
  c.rect(26, 34, 6, 4, WASHI[1])
  c.rect(26, 33, 6, 1, LAQUE[2])
  c.rect(37, 31, 6, 7, NUIT[3])
  c.rect(37, 31, 1, 7, NUIT[4])
  c.rect(38, 29, 4, 2, NUIT[2])
  disc(c, 28, 22, 4, 3.4, (x, y) => (y < 20 ? null : x < 27 ? '#A8C4B4' : x > 30 ? '#58806E' : '#7FA698'))
  c.rect(24, 20, 9, 1, '#4A6A5C')
  c.rect(26, 25, 5, 1, CEDAR[0])
  return c
}

/** A low table, with the iron teapot and its cups. */
function chabudai() {
  const c = canvas(54, 30)
  c.rect(4, 27, 46, 3, SH)
  disc(c, 27, 21, 22, 6, CEDAR[1])
  for (const x of [9, 42]) {
    c.rect(x, 20, 4, 8, CEDAR[1])
    c.rect(x, 20, 1, 8, CEDAR[3])
  }
  disc(c, 27, 19, 24, 6.5, (x, y, d) => (d > 0.86 ? (y < 19 ? CEDAR[5] : CEDAR[4]) : y === 17 || (y === 21 && x % 7 > 2) ? CEDAR[2] : CEDAR[3]))
  disc(c, 22, 11, 7, 5.5, (x, y) => (x < 19 ? SUMI[3] : x > 25 ? SUMI[0] : (x + y) % 3 ? SUMI[2] : SUMI[1]))
  c.rect(19, 5, 6, 2, SUMI[1])
  c.rect(21, 3, 2, 2, SUMI[3])
  c.rect(28, 9, 4, 2, SUMI[2])
  c.rect(31, 8, 2, 2, SUMI[2])
  line(c, 15, 7, 17, 2, OR[0])
  line(c, 29, 7, 27, 2, OR[0])
  c.rect(17, 1, 11, 1, OR[0])
  for (const x of [34, 41]) {
    c.rect(x, 15, 5, 4, WASHI[1])
    c.rect(x, 15, 1, 4, WASHI[0])
    c.rect(x + 4, 15, 1, 4, WASHI[3])
    c.rect(x, 15, 5, 1, '#7FA698')
  }
  c.rect(11, 15, 7, 1, HINOKI[3])
  return c
}

function zabuton() {
  const c = canvas(32, 16)
  c.rect(2, 13, 28, 3, SH)
  box(c, 2, 4, 28, 10, LAQUE[1], LAQUE[3], LAQUE[0])
  c.rect(3, 5, 26, 7, LAQUE[2])
  c.rect(3, 5, 26, 1, LAQUE[3])
  box(c, 4, 0, 26, 9, NUIT[2], NUIT[4], NUIT[1])
  for (let y = 2; y < 8; y += 2) for (let x = 6; x < 28; x += 4) c.rect(x + (y % 4 ? 2 : 0), y, 2, 1, NUIT[3])
  for (const [x, y] of [[4, 0], [29, 0], [4, 8], [29, 8]] as const) c.set(x, y, OR[2])
  c.rect(16, 4, 2, 2, OR[1])
  return c
}

/** The crab's basket: wicker and an indigo cushion. */
function panier(dort = false) {
  const c = canvas(38, 22)
  c.rect(2, 19, 34, 3, SH)
  disc(c, 19, 11, 17, 9, (x, y) => ((x + y * 2) % 4 < 2 ? HINOKI[2] : HINOKI[1]))
  disc(c, 19, 9, 13.5, 5.5, NUIT[3])
  disc(c, 19, 8.5, 12, 4.4, (_, y) => (y < 7 ? NUIT[5] : NUIT[4]))
  disc(c, 19, 10, 17, 9, (x, y, d) => (d > 0.82 && y < 10 ? ((x * 3 + y) % 5 < 3 ? HINOKI[4] : HINOKI[3]) : null))
  for (let x = 6; x < 33; x += 1) c.set(x, Math.round(16 + Math.sqrt(Math.max(0, 1 - ((x - 19) / 15) ** 2)) * 3), HINOKI[0])
  if (dort) c.sprite(['...cccccccccc...', '..cLLLLLLLLLLc..', '.cLccccccccccsc.', 'cccgccccccgcccss', 'ccccccccccccccss', '.ccccccLLccccss.', '..cc.cccccc.cc..'], { c: '#D97757', L: '#EE9A7C', s: '#B85A3C', g: '#1B1730' }, 11, 3)
  return c
}

function chaise() {
  const c = canvas(60, 45)
  c.rect(20, 4, 20, 22, INK)
  c.rect(21, 5, 18, 20, CEDAR[2])
  c.rect(21, 5, 18, 2, CEDAR[4])
  for (let x = 23; x < 38; x += 3) {
    c.rect(x, 8, 2, 16, HINOKI[2])
    c.rect(x, 8, 1, 16, HINOKI[3])
  }
  c.rect(21, 22, 18, 3, LAQUE[1])
  c.rect(21, 22, 18, 1, LAQUE[2])
  return c
}

function bureau(state: DeskState | 'rest') {
  const c = canvas(60, 45)
  const [W0, W1, W2, W3, W4] = CEDAR
  c.rect(3, 41, 54, 4, SH)
  c.rect(1, 43, 58, 2, SH)
  for (const x of [3, 52]) {
    c.rect(x, 38, 5, 4, W1)
    c.rect(x + 1, 38, 1, 4, W3)
  }
  c.rect(2, 41, 7, 2, W0)
  c.rect(51, 41, 7, 2, W0)
  c.rect(2, 28, 56, 12, W2)
  c.rect(2, 28, 56, 1, W1)
  for (let x = 4; x < 57; x += 6) {
    c.rect(x, 29, 1, 10, W1)
    c.rect(x + 1, 29, 1, 10, W3)
  }
  c.rect(2, 39, 56, 1, W0)
  c.rect(2, 29, 1, 10, W4)
  c.rect(57, 29, 1, 10, W1)
  // The lacquered top, edged in vermilion.
  c.rect(1, 18, 58, 9, W1)
  c.rect(1, 18, 58, 1, W3)
  grain(c, 2, 19, 56, 7, W0, W2, 101)
  c.rect(0, 26, 60, 2, LAQUE[2])
  c.rect(0, 26, 60, 1, LAQUE[3])
  c.rect(0, 27, 60, 1, LAQUE[0])
  c.rect(0, 19, 1, 7, W2)
  c.rect(59, 19, 1, 7, W0)
  // The name plate, as a paper cartouche.
  c.rect(5, 30, 50, 10, W0)
  c.rect(6, 31, 48, 8, WASHI[1])
  c.rect(6, 31, 48, 1, WASHI[0])
  c.rect(6, 38, 48, 1, WASHI[2])
  c.rect(6, 31, 2, 8, LAQUE[2])
  c.rect(52, 31, 2, 8, LAQUE[2])
  c.rect(6, 31, 2, 1, LAQUE[3])
  c.rect(52, 31, 2, 1, LAQUE[3])
  // The laptop stays the same, so a state reads alike in every room.
  const bad = state === 'failed'
  const off = state === 'rest'
  if (state === 'done') {
    c.rect(5, 18, 20, 3, '#3F4258')
    c.rect(5, 18, 20, 1, '#6A6E8C')
    c.rect(4, 21, 22, 1, INK)
    c.rect(13, 19, 4, 1, '#565A78')
    c.rect(7, 7, 12, 11, '#2F6B45')
    c.rect(8, 8, 10, 9, '#4E8F5A')
    c.rect(8, 8, 10, 1, '#6FAE5C')
    c.sprite(['.......x', '......xx', 'x....xx.', 'xx..xx..', '.xxxx...', '..xx....'], { x: '#F4E4C1' }, 9, 9)
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
  // A tea cup in the mug's place: the steam starts from the same spot.
  c.rect(42, 18, 6, 5, INK)
  c.rect(43, 18, 4, 4, '#A8C4B4')
  c.rect(43, 18, 4, 1, '#4A6A5C')
  c.rect(43, 19, 1, 3, '#D0E4D8')
  c.rect(46, 19, 1, 3, '#7FA698')
  c.rect(29, 21, 9, 5, WASHI[3])
  c.rect(30, 20, 9, 5, WASHI[0])
  for (const y of [21, 23]) c.rect(32, y, 1, 1, SUMI[1])
  c.rect(34, 21, 1, 3, SUMI[1])
  c.rect(30, 24, 8, 1, LAQUE[2])
  c.rect(50, 21, 8, 3, NUIT[3])
  c.rect(50, 21, 8, 1, NUIT[5])
  c.rect(53, 17, 2, 4, W4)
  disc(c, 54, 15, 4, 2.6, G[2])
  disc(c, 53, 14, 2.4, 1.4, G[4])
  disc(c, 50, 17, 2, 1.2, G[3])
  return c
}

/** The screen under a torii, 44 by 36: its useful part keeps the same grid, 4 cells in. */
function torii() {
  const c = canvas(44, 36)
  const [L, S, O] = [LAQUE, SUMI[0], OR[2]]
  c.rect(0, 0, 44, 2, S)
  c.rect(1, 0, 42, 1, SUMI[2])
  c.set(0, 1, null)
  c.set(43, 1, null)
  c.rect(1, 2, 42, 3, L[2])
  c.rect(1, 2, 42, 1, L[4])
  c.rect(1, 4, 42, 1, L[0])
  c.rect(3, 8, 38, 2, L[2])
  c.rect(3, 8, 38, 1, L[3])
  c.rect(3, 9, 38, 1, L[0])
  c.rect(20, 5, 4, 3, L[1])
  c.rect(20, 5, 1, 3, L[3])
  for (const x of [2, 38]) {
    c.rect(x, 5, 4, 28, L[2])
    c.rect(x, 5, 1, 28, L[4])
    c.rect(x + 3, 5, 1, 28, L[0])
    c.rect(x - 1, 31, 6, 3, S)
    c.rect(x - 1, 31, 6, 1, SUMI[2])
  }
  c.rect(5, 10, 34, 22, '#14121F')
  c.rect(6, 11, 32, 20, '#241416')
  c.rect(7, 11, 30, 1, O)
  c.rect(8, 12, 28, 16, '#0B0A14')
  c.rect(9, 13, 26, 14, '#0F2A30')
  for (let y = 14; y < 27; y += 2) c.rect(9, y, 26, 1, '#13333A')
  c.rect(9, 13, 26, 1, '#1D4A4E')
  c.rect(9, 26, 26, 1, '#1D4A4E')
  c.rect(9, 14, 1, 12, '#1D4A4E')
  c.rect(34, 14, 1, 12, '#1D4A4E')
  for (const [x, y, w] of [[30, 14, 4], [31, 15, 3], [32, 16, 2], [33, 17, 1]] as const) c.rect(x, y, w, 1, '#2F6A6E')
  c.rect(9, 29, 5, 1, O)
  c.rect(31, 29, 4, 1, '#7FE0C8')
  c.rect(2, 34, 40, 2, SH)
  return c
}

/** Dark cedar under a gilt edge, on two brass hangers. */
function plaque() {
  const c = canvas(36, 12)
  for (const x of [6, 29]) c.rect(x, 0, 1, 3, OR[0])
  box(c, 0, 2, 36, 10, CEDAR[1], OR[1], CEDAR[0])
  c.rect(2, 4, 32, 6, '#14121F')
  return c
}

/** The plan on a hanging scroll, in pixels of the room: same paper and same place for the words as any board. */
function tableau(w: number, h: number) {
  const c = canvas(w + 4, h + 8)
  c.rect(4, 8, w, h, '#0F0A1A|0.38')
  c.rect(4, 6, w - 8, h - 2, NUIT[2])
  c.rect(4, 6, 2, h - 2, NUIT[3])
  c.rect(w - 6, 6, 2, h - 2, NUIT[1])
  c.rect(8, 12, w - 16, h - 16, WASHI[3])
  c.rect(10, 14, w - 20, h - 20, '#FFF6DE')
  c.rect(0, 4, w, 6, CEDAR[3])
  c.rect(0, 4, w, 2, CEDAR[5])
  c.rect(0, 8, w, 2, CEDAR[1])
  c.rect(0, h - 2, w, 6, SUMI[2])
  c.rect(0, h - 2, w, 2, SUMI[3])
  c.rect(0, h + 2, w, 2, SUMI[0])
  for (const x of [0, w - 4]) {
    c.rect(x, h - 2, 4, 6, OR[1])
    c.rect(x, h - 2, 4, 2, OR[3])
  }
  // The cord it hangs from.
  c.rect(12, 2, w - 24, 2, CEDAR[1])
  c.rect(12, 0, 2, 4, CEDAR[1])
  c.rect(w - 14, 0, 2, 4, CEDAR[1])
  c.rect(Math.floor(w / 2) - 4, 0, 8, 4, OR[1])
  c.rect(Math.floor(w / 2) - 4, 0, 8, 2, OR[3])
  return c
}

/** The cast iron reliefs and the kettle, laid on the stove's own grid. */
function poeleDetails() {
  const c = canvas(48, 68)
  c.rect(12, 29, 3, 1, OR[1])
  disc(c, 30, 20, 7, 5.6, (x, y) => (x < 27 ? SUMI[3] : x > 33 ? SUMI[0] : (x + y) % 3 ? SUMI[2] : SUMI[1]))
  c.rect(27, 14, 6, 2, SUMI[1])
  c.rect(29, 12, 2, 2, SUMI[3])
  c.rect(36, 18, 4, 2, SUMI[2])
  c.rect(39, 17, 2, 2, SUMI[2])
  line(c, 22, 16, 24, 10, OR[0])
  line(c, 38, 16, 36, 10, OR[0])
  c.rect(24, 9, 13, 1, OR[0])
  c.rect(26, 25, 8, 1, SUMI[0])
  return c
}

const FONTE: Record<string, Paint> = { r: '#4E4A58', l: '#3C3844', m: '#302C38', d: '#26222C', h: '#7A7686', t: '#B4B0A8', W: '#8E8A84', w: '#6E6A66', k: LAQUE[1], y: LAQUE[3] }
// The fire keeps its own wood and its own gold: only the glint on the glass turns to iron.
const VITRE: Record<string, Paint> = { l: FONTE.l! }

/** The stove's sprites read one shared palette: it takes these paints for as long as they draw. */
function repeint<T>(paints: Record<string, Paint>, draw: () => T): T {
  const saved = { ...HEARTH_PALETTE }
  Object.assign(HEARTH_PALETTE, paints)
  const made = draw()
  Object.assign(HEARTH_PALETTE, saved)
  return made
}

let poeleCorps: string | null = null

/** A nambu iron stove on a stone plinth, with its kettle. */
const POELE: Hearth = {
  ...ironStove,
  body: () => (poeleCorps ??= repeint(FONTE, () => `${spriteBody(flue())}${spriteBody(stove())}`) + paths(poeleDetails())),
  flames: (level, frame) => repeint(VITRE, () => spriteBody(fire(level, frame))),
}

const WALL = 102
const LOW = 48
const FLOOR = 160

const WALLS = [
  once(() => seigaiha('#26335F', '#34447A', '#1C2750')),
  once(() => ichimatsu('#5C7A5A', '#4E6C50', '#6A8A66')),
  once(() => asanoha('#9C4A32', '#C07050')),
]
const VAGUES = 0
const TATAMI = once(tatami)
const FLOORS = [
  [TATAMI, TATAMI],
  [once(() => planches(true)), once(() => planches(false))],
  [once(() => moquette(true)), once(() => moquette(false))],
] as const
const MOQUETTE = 2
const LAMBRIS = once(lambris)

/** The wall and the floor of a conversation: indigo carpet under the blue waves would read as one block. */
function tirage(seed: number) {
  const sol = pick(seed, 3, FLOORS.length)
  const mur = pick(seed, 2, WALLS.length)
  return { sol, mur: sol === MOQUETTE && mur === VAGUES ? 1 + pick(seed, 5, 2) : mur }
}

/** A tile starts at the top of its band, so a rail and a mat's edge fall on the trims and not across them. */
const band = (y: number, w: number, h: number, fill: string) => `<g transform="translate(0 ${y})"><rect width="${w}" height="${h}" fill="url(#${fill})"/></g>`

function fond(seed: number, w: number, h: number, detail: number): Backdrop {
  const { mur, sol } = tirage(seed)
  const trims = `<rect width="${w}" height="2" fill="${CEDAR[4]}"/><rect y="2" width="${w}" height="6" fill="${CEDAR[2]}"/><rect y="${WALL + LOW}" width="${w}" height="6" fill="${CEDAR[1]}"/><rect y="${WALL + LOW + 6}" width="${w}" height="4" fill="${CEDAR[2]}"/><rect y="${FLOOR}" width="${w}" height="8" fill="#1B1730" fill-opacity=".28"/>`
  return {
    defs: pattern('wall', WALLS[mur]!()) + pattern('low', LAMBRIS()) + pattern('floor', FLOORS[sol]![detail ? 1 : 0]()),
    body: `${band(0, w, WALL, 'wall')}${band(WALL, w, LOW, 'low')}${band(FLOOR, w, h - FLOOR, 'floor')}${trims}`,
  }
}

const TELE: Tele = { draw: once(torii), dx: -8, dy: -8, digits: { cx: 36, y: 14, size: 24, ink: '#EDFFF5' }, label: { y: 30, size: 12, ink: '#80E0C7' } }
const PLAQUE: Plaque = { draw: once(plaque), dx: 0, dy: -28, cost: { cx: 36, y: 7, size: 12, ink: '#FFC857' } }
const BOARD: Board = { art: (w, h) => paths(tableau(w, h)), title: '#4A2C2A', paper: '#FFF6DE', glow: '#FFDF8F', inks: { completed: '#7A6A5E', in_progress: '#1B1730', pending: '#3A2E33' } }

const WIDE = 300

export const japonais: Pack = {
  id: 'japonais',
  backdrop: fond,
  rug: () => null,
  light: [0.022, 0.026],
  wall: {
    picks: [
      ['shoji', 'tana', 'sensu'],
      ['kakemono', 'estampe', 'sensu'],
      ['tana', 'sensu', 'shoji', 'estampe'],
      ['chochin', 'estampe', 'kakemono', null],
      ['estampe', 'chochin', 'sensu', null],
    ],
    items: {
      shoji: { draw: once(shoji), y: 6, sparks: [[6, 9], [14, 7], [21, 8], [28, 6], [30, 9]] },
      kakemono: { draw: once(kakemono), y: 8 },
      tana: { draw: once(tana), y: 18 },
      sensu: { draw: once(sensu), y: 17 },
      estampe: { draw: once(estampe), y: 19 },
      chochin: { draw: once(chochin), y: 4 },
    },
    string: {
      id: 'guirlande',
      y: 2,
      h: 16,
      sag: SAG,
      draw: guirlande,
      // The paper lanterns alone: a cream light on a red one would read as a hole.
      sparks: w => Array.from({ length: Math.ceil((w - 6) / LANTERN) }, (_, k) => k).filter(k => k % 2).map(k => [5 + k * LANTERN, sagged(6 + k * LANTERN) + 3] as const),
    },
    clash: [['guirlande', 'kakemono']],
  },
  floor: {
    slots: [
      { x: 2, up: 110, w: 38, items: ['bambou', 'bonsai', 'andon'] },
      { x: 46, up: 104, w: 50, items: ['andon', 'dansu', 'bonsai', null] },
      { x: 100, up: 104, w: 50, items: ['dansu', 'bonsai', 'andon', null], minW: WIDE },
      { right: 78, up: 112, w: 74, items: ['byobu', 'dansu', 'bonsai', 'bambou'] },
      { right: 64, up: 44, w: 54, items: ['chabudai', 'zabuton'], front: true },
      { x: 26, up: 22, w: 32, items: ['zabuton', null], front: true },
      { right: 52, up: 8, w: 32, items: ['zabuton', null], front: true },
    ],
    items: {
      byobu: once(byobu),
      bonsai: once(bonsai),
      andon: once(andon),
      bambou: once(bambou),
      dansu: once(dansu),
      chabudai: once(chabudai),
      zabuton: once(zabuton),
    },
  },
  seat: { chair: once(chaise), desk: bureau },
  tele: TELE,
  plaque: PLAQUE,
  board: BOARD,
  hearth: POELE,
  basket: panier,
}
