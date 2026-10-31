import { canvas, mix, noise, paths } from '../canvas'
import type { Canvas } from '../canvas'
import { FLOOR_DECOR, THEMES, WALL_DECOR, frange, guirlande, tableau, tapis, tele } from '../decor'
import { once, pick, walled } from '../pack'
import type { Board, Pack, Plaque, Tele } from '../pack'
import { WOOD as W, chair, desk } from '../sprites'
import { ironStove } from './stove'

type C = Canvas
const INK = '#2A2036'
const SH = '#1B1730|0.28'
const CR = '#F4E4C1'
const GOLD = '#FFC857'
const G = ['#234A38', '#2F5D46', '#3E7A4C', '#4E8F5A', '#6FAE5C', '#8CC265'] as const
const TEAL = ['#16323F', '#20485A', '#2C6276', '#3C7E92', '#5AA0B0', '#8CC8D0'] as const
const OCRE = ['#6A4A1E', '#8C6428', '#B88A34', '#D8AA48', '#F0CC70', '#FFE8A0'] as const
const TERRE = ['#7A2E1C', '#A03E26', '#C4553A', '#DE7656', '#F0A080'] as const
const LAITON = ['#7A5A22', '#A88030', '#D0A848', '#F0D078'] as const

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

/** A buttoned back: diamonds, creases and buttons. */
const capiton = (c: C, x0: number, y0: number, w: number, h: number, ramp: readonly string[], px = 8, py = 7) => {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      if (!c.get(x, y)) continue
      const [u, v] = [(x - x0) / px, (y - y0) / py]
      const [a, b] = [u + v, u - v]
      const [fa, fb] = [a - Math.floor(a), b - Math.floor(b)]
      const crease = fa < 0.14 || fb < 0.14
      c.set(x, y, crease ? ramp[1]! : fa + fb < 1 ? ramp[3]! : ramp[2]!)
    }
  }
  for (let j = 0; j * py <= h; j += 1) {
    for (let i = 0; i * px <= w; i += 1) {
      if ((i + j) % 2) continue
      const [x, y] = [x0 + i * px, y0 + j * py]
      if (c.get(x, y)) {
        c.set(x, y, ramp[0]!)
        c.set(x, y - 1, ramp[4]!)
      }
    }
  }
}

function canape() {
  const c = canvas(72, 42)
  c.rect(4, 39, 64, 3, SH)
  for (let x = 9; x < 63; x += 1) {
    const top = 4 + Math.round(3 * Math.abs(Math.cos(((x - 9) / 54) * Math.PI)))
    c.rect(x, top, 1, 24 - top, TEAL[2])
    c.set(x, top, TEAL[5])
    c.set(x, top + 1, TEAL[4])
  }
  capiton(c, 10, 9, 52, 15, TEAL)
  for (const x of [7, 61]) {
    c.rect(x, 35, 4, 2, W[3])
    c.rect(x + 1, 37, 2, 2, W[2])
    c.set(x, 35, W[5])
  }
  for (const [x, w] of [[13, 23], [36, 23]] as const) {
    box(c, x, 22, w, 9, TEAL[3], TEAL[5], TEAL[1])
    c.rect(x + 1, 23, w - 2, 2, TEAL[4])
    c.rect(x + 1, 28, w - 2, 2, TEAL[2])
    c.set(x, 22, TEAL[2])
    c.set(x + w - 1, 22, TEAL[2])
  }
  c.rect(11, 31, 50, 4, TEAL[1])
  c.rect(11, 31, 50, 1, TEAL[3])
  c.rect(11, 34, 50, 1, TEAL[0])
  for (let x = 12; x < 60; x += 3) c.set(x, 32, LAITON[2])
  const arm = (x: number) => {
    c.rect(x, 18, 13, 17, TEAL[2])
    c.rect(x, 18, 13, 1, TEAL[5])
    c.rect(x, 19, 1, 15, TEAL[3])
    c.rect(x + 12, 19, 1, 15, TEAL[1])
    c.rect(x, 34, 13, 1, TEAL[0])
    disc(c, x + 6.5, 19, 6.8, 6.5, (px, py, d) => (d > 0.7 ? (py < 19 ? TEAL[5] : TEAL[3]) : d > 0.32 ? TEAL[2] : d > 0.12 ? TEAL[3] : TEAL[1]))
    c.set(x + 6, 19, LAITON[3])
  }
  arm(0)
  arm(59)
  const pillow = (x: number, y: number, s: number, a: readonly string[]) => {
    box(c, x, y, s, s, a[2]!, a[4]!, a[0]!)
    c.rect(x + 1, y + 1, s - 2, 2, a[3]!)
    for (const [px, py] of [[x, y], [x + s - 1, y], [x, y + s - 1], [x + s - 1, y + s - 1]] as const) c.set(px, py, null)
  }
  pillow(15, 11, 12, TERRE)
  line(c, 17, 13, 24, 20, TERRE[0])
  line(c, 24, 13, 17, 20, TERRE[0])
  pillow(45, 13, 11, OCRE)
  for (let i = 0; i < 3; i += 1) c.rect(47, 16 + i * 2, 7, 1, OCRE[1])
  c.rect(30, 4, 11, 21, '#8E2E2A')
  for (let y = 4; y < 25; y += 1) for (let x = 30; x < 41; x += 1) {
    if ((x - 30) % 5 === 2) c.set(x, y, '#D8B468')
    if ((y - 4) % 6 === 3) c.set(x, y, (x - 30) % 5 === 2 ? '#F0D088' : '#2A2036')
  }
  c.rect(30, 4, 11, 1, '#B84A40')
  c.rect(40, 5, 1, 20, '#5E1E1E')
  for (let x = 30; x < 41; x += 2) c.rect(x, 25, 1, 2, '#D8B468')
  return c
}

function fauteuil() {
  const c = canvas(44, 46)
  c.rect(4, 43, 36, 3, SH)
  c.rect(9, 3, 26, 26, OCRE[2])
  c.rect(10, 2, 24, 1, OCRE[5])
  c.rect(9, 3, 26, 1, OCRE[4])
  capiton(c, 11, 5, 22, 22, OCRE, 7, 7)
  for (const x of [5, 34]) {
    c.rect(x, 7, 5, 18, OCRE[2])
    c.rect(x, 7, 5, 1, OCRE[5])
    c.rect(x, 8, 1, 17, OCRE[4])
    c.rect(x + 4, 8, 1, 17, OCRE[0])
  }
  for (const x of [8, 32]) {
    c.rect(x, 37, 4, 3, W[3])
    c.rect(x + 1, 40, 2, 3, W[2])
    c.set(x, 37, W[5])
  }
  box(c, 12, 25, 20, 8, OCRE[3], OCRE[5], OCRE[1])
  c.rect(13, 26, 18, 2, OCRE[4])
  c.rect(9, 33, 26, 4, OCRE[1])
  c.rect(9, 33, 26, 1, OCRE[3])
  c.rect(9, 36, 26, 1, OCRE[0])
  for (const x of [2, 31]) {
    c.rect(x, 22, 11, 15, OCRE[2])
    c.rect(x, 22, 11, 1, OCRE[5])
    c.rect(x + 10, 23, 1, 13, OCRE[0])
    c.rect(x, 36, 11, 1, OCRE[0])
    disc(c, x + 5.5, 23, 5.8, 5.2, (_, py, d) => (d > 0.66 ? (py < 23 ? OCRE[5] : OCRE[3]) : d > 0.25 ? OCRE[2] : OCRE[3]))
  }
  c.rect(16, 23, 12, 3, CR)
  c.rect(22, 23, 1, 3, '#D8C49E')
  c.rect(16, 26, 12, 1, '#8E2E2A')
  return c
}

function lampe() {
  const c = canvas(36, 66)
  disc(c, 18, 26, 18, 14, (_, __, d) => (d < 0.45 ? '#FFC857|0.13' : '#FFC857|0.07'))
  disc(c, 18, 62, 13, 3, SH)
  line(c, 17, 24, 8, 61, W[3])
  line(c, 18, 24, 9, 61, W[1])
  line(c, 19, 24, 28, 61, W[2])
  line(c, 18, 24, 27, 61, W[4])
  line(c, 18, 24, 18, 60, W[3])
  line(c, 19, 24, 19, 60, W[1])
  c.rect(13, 42, 11, 1, LAITON[2])
  c.rect(16, 21, 5, 4, LAITON[2])
  c.rect(16, 21, 1, 4, LAITON[3])
  for (let j = 0; j < 17; j += 1) {
    const hw = 8 + Math.round(j * 0.6)
    for (let x = 18 - hw; x < 18 + hw; x += 1) {
      const lit = 1 - Math.abs(x + 0.5 - 18) / hw
      const base = lit > 0.55 ? '#FFEFC0' : lit > 0.22 ? '#F7D88C' : '#E0AE5C'
      c.set(x, 4 + j, (x + 40) % 3 === 0 ? mix(base, '#C88C3C', 0.28) : base)
    }
  }
  c.rect(10, 3, 16, 1, '#8E2E2A')
  c.rect(8, 21, 20, 2, '#8E2E2A')
  c.rect(8, 21, 20, 1, '#B84A40')
  for (let x = 8; x < 28; x += 2) c.rect(x, 23, 1, 2, LAITON[2])
  return c
}

function buffet() {
  const c = canvas(46, 48)
  c.rect(1, 45, 44, 3, SH)
  for (const x of [4, 38]) {
    c.rect(x, 41, 4, 4, W[2])
    c.rect(x, 41, 1, 4, W[4])
  }
  box(c, 2, 22, 42, 20, W[3], W[5], W[1])
  c.rect(2, 22, 42, 2, W[5])
  c.rect(1, 21, 44, 2, W[4])
  c.rect(1, 21, 44, 1, W[5])
  const door = (x: number) => {
    box(c, x, 26, 18, 14, W[2], W[1], W[4])
    box(c, x + 2, 28, 14, 10, W[3], W[4], W[1])
    for (let i = 0; i < 5; i += 1) c.rect(x + 4, 30 + i * 2, 10, 1, W[2])
  }
  door(4)
  door(24)
  c.rect(20, 32, 2, 2, LAITON[3])
  c.rect(24, 32, 2, 2, LAITON[3])
  c.rect(5, 20, 36, 2, CR)
  for (let x = 6; x < 40; x += 4) c.set(x, 21, '#8E2E2A')
  for (const x of [5, 40]) c.rect(x, 22, 1, 4, CR)
  c.rect(10, 13, 9, 7, '#8A8FA3')
  c.rect(10, 13, 2, 7, '#C8CCD8')
  c.rect(17, 13, 2, 7, '#5A5E74')
  c.rect(11, 8, 7, 5, '#A0A4B8')
  c.rect(11, 8, 2, 5, '#D8DCE8')
  c.rect(10, 12, 9, 1, '#5A5E74')
  c.rect(13, 6, 3, 2, INK)
  c.rect(9, 9, 2, 2, '#A0A4B8')
  c.rect(19, 9, 2, 1, INK)
  c.rect(20, 10, 1, 4, INK)
  for (const [x, col] of [[23, '#C4553A'], [29, '#3C7E92']] as const) {
    c.rect(x, 16, 5, 4, col)
    c.rect(x, 16, 1, 4, mix(col, '#FFFFFF', 0.3))
    c.rect(x + 5, 17, 1, 2, col)
  }
  c.rect(35, 9, 7, 11, '#D8E4E8|0.6')
  c.rect(35, 13, 7, 7, W[1])
  c.rect(35, 9, 1, 11, '#FFFFFF|0.5')
  c.rect(35, 8, 7, 2, W[4])
  for (const [x, y] of [[37, 15], [39, 17], [36, 18], [40, 14]] as const) c.set(x, y, W[3])
  return c
}

/** A monstera with real cut leaves, in a woven pot. */
function monstera() {
  const c = canvas(38, 56)
  c.rect(8, 53, 22, 3, SH)
  const leaf = (cx: number, cy: number, len: number, wide: number, a: number, k: number) => {
    const [ca, sa] = [Math.cos(a), Math.sin(a)]
    for (let y = -len - 2; y <= len + 2; y += 1) {
      for (let x = -len - 2; x <= len + 2; x += 1) {
        const u = x * ca + y * sa
        const v = -x * sa + y * ca
        const t = u / len
        if (t < -1 || t > 1) continue
        const edge = wide * Math.sqrt(1 - t * t) * (t < 0 ? 1.08 : 0.92)
        if (Math.abs(v) > edge) continue
        if (Math.abs(v) > edge * 0.45 && ((u + len + 40) % 5) < 1.1) continue
        const px = Math.round(cx + x)
        const py = Math.round(cy + y)
        const rib = Math.abs(v) < 0.6
        c.set(px, py, rib ? G[5] : v * sa + u * 0.3 < 0 ? G[k + 1]! : G[k]!)
      }
    }
  }
  for (const [x0, y0, x1, y1] of [[18, 40, 9, 22], [19, 40, 28, 20], [18, 40, 16, 10], [19, 40, 30, 32], [18, 40, 7, 34]] as const) {
    line(c, x0, y0, x1, y1, G[0])
    line(c, x0 + 1, y0, x1 + 1, y1, G[1])
  }
  leaf(8, 33, 8, 5, 2.6, 1)
  leaf(30, 31, 8, 5, 0.5, 1)
  leaf(9, 18, 10, 6.5, 2.2, 2)
  leaf(28, 17, 10, 6.5, 0.9, 2)
  leaf(18, 9, 10, 7, 1.57, 3)
  c.rect(10, 39, 18, 2, W[5])
  c.rect(10, 39, 18, 1, '#E8C89A')
  for (let y = 41; y < 52; y += 1) {
    const inset = Math.floor((y - 41) / 5)
    for (let x = 11 + inset; x < 27 - inset; x += 1) c.set(x, y, (x + y * 2) % 4 < 2 ? W[4] : W[3])
  }
  c.rect(12, 52, 14, 1, W[1])
  return c
}

function etagere() {
  const c = canvas(66, 40)
  const cols = ['#C75A4E', '#3F7CC8', '#E0A030', '#2A9D8F', '#7F6BD6', '#D4537E', '#F4E4C1', '#5A3A22']
  let x = 3
  for (let i = 0; i < 9; i += 1) {
    const w = 2 + Math.floor(noise(i, 3) * 3)
    const h = 12 + Math.floor(noise(i, 4) * 7)
    const col = cols[i % 8]!
    c.rect(x, 33 - h, w, h, col)
    c.rect(x, 33 - h, 1, h, mix(col, '#FFFFFF', 0.3))
    c.rect(x + w - 1, 33 - h, 1, h, mix(col, '#1B1730', 0.35))
    c.rect(x, 33 - h + 3, w, 1, '#FFFFFF|0.4')
    c.rect(x, 33 - h + 5, w, 1, '#FFFFFF|0.25')
    x += w
  }
  line(c, x + 1, 32, x + 7, 17, '#C75A4E')
  line(c, x + 2, 32, x + 8, 17, '#A03E26')
  line(c, x + 3, 32, x + 9, 17, '#E07868')
  for (const [px, w, col] of [[33, 13, '#2F5D46'], [34, 11, '#D8AA48'], [33, 12, '#3C5A8C']] as const) {
    const y = 29 + [33, 34].indexOf(px) * 1
    c.rect(px + 3, 30 - (px === 33 && col === '#3C5A8C' ? 6 : px === 34 ? 3 : 0), w, 3, col)
  }
  box(c, 52, 16, 11, 14, W[1], W[3], W[0])
  c.rect(53, 17, 9, 12, CR)
  c.rect(54, 18, 7, 7, '#7FB0CC')
  c.rect(54, 22, 7, 3, G[3])
  disc(c, 57, 20, 1.6, 1.6, GOLD)
  c.rect(46, 26, 3, 7, CR)
  c.rect(46, 26, 1, 7, '#FFFFFF')
  c.set(47, 25, INK)
  c.rect(47, 22, 1, 3, GOLD)
  c.set(47, 21, '#FFF6DE')
  disc(c, 47, 23, 3, 3.5, '#FFC857|0.2')
  c.rect(18, 26, 0, 0, INK)
  c.rect(0, 33, 66, 3, W[3])
  c.rect(0, 33, 66, 1, W[5])
  c.rect(0, 35, 66, 1, W[1])
  for (const px of [6, 56]) {
    c.rect(px, 36, 4, 1, W[1])
    c.rect(px, 37, 2, 2, W[1])
    c.set(px + 2, 37, W[1])
  }
  c.rect(60, 28, 6, 5, '#C4553A')
  c.rect(60, 28, 6, 1, '#DE7656')
  for (let i = 0; i < 9; i += 1) c.rect(60 + (i % 6), 33 + (i % 3), 1, 0, G[3])
  for (const [px, py] of [[60, 25], [63, 24], [65, 26], [58, 27], [66, 30], [64, 36], [65, 38]] as const) {
    c.rect(px, py, 3, 2, G[3])
    c.set(px, py, G[5])
  }
  line(c, 64, 28, 65, 39, G[1])
  return c
}

function peinture() {
  const c = canvas(38, 32)
  c.rect(2, 2, 36, 30, SH)
  c.rect(0, 0, 36, 30, LAITON[1])
  c.rect(1, 1, 34, 28, LAITON[2])
  c.rect(1, 1, 34, 1, LAITON[3])
  c.rect(1, 1, 1, 28, LAITON[3])
  c.rect(34, 2, 1, 27, LAITON[0])
  c.rect(2, 28, 33, 1, LAITON[0])
  for (let i = 3; i < 34; i += 3) {
    c.set(i, 2, LAITON[0])
    c.set(i, 27, LAITON[0])
  }
  for (let i = 4; i < 27; i += 3) {
    c.set(2, i, LAITON[0])
    c.set(33, i, LAITON[0])
  }
  for (const [x, y] of [[1, 1], [32, 1], [1, 26], [32, 26]] as const) {
    c.rect(x, y, 3, 3, LAITON[3])
    c.set(x + 1, y + 1, LAITON[0])
  }
  c.rect(4, 4, 28, 22, '#4A2C2A')
  const sky = ['#5A3A7A', '#8A4A7E', '#C75A6E', '#E8805A', '#F4A860', '#FFD088']
  sky.forEach((col, i) => c.rect(5, 5 + i * 2, 26, 2, col))
  disc(c, 21, 14, 4, 4, '#FFE8A8')
  disc(c, 21, 14, 2.4, 2.4, '#FFF6DE')
  for (let x = 5; x < 31; x += 1) {
    const h = Math.round(5 + 3 * Math.sin(x * 0.45 + 1) + 2 * Math.sin(x * 0.17))
    c.rect(x, 18 - h + 2, 1, h, '#6A4A8A')
    const k = Math.round(3 + 2.4 * Math.sin(x * 0.7 + 4))
    c.rect(x, 20 - k, 1, k, '#42345E')
  }
  c.rect(5, 20, 26, 5, '#3C5A7E')
  for (const [x, w, y] of [[18, 7, 20], [17, 9, 22], [19, 5, 24]] as const) c.rect(x, y, w, 1, '#F4B070')
  for (const x of [7, 11, 28]) {
    c.rect(x, 20, 1, 3, '#2A1C2E')
    c.rect(x - 1, 18, 3, 3, '#27304A')
    c.set(x, 16, '#27304A')
    c.rect(x - 1, 17, 3, 1, '#27304A')
  }
  return c
}

function horloge() {
  const c = canvas(22, 40)
  c.rect(2, 2, 20, 38, SH)
  c.rect(4, 0, 12, 2, W[4])
  c.rect(2, 2, 16, 2, W[3])
  c.rect(2, 2, 16, 1, W[5])
  box(c, 1, 4, 18, 32, W[2], W[4], W[1])
  disc(c, 10, 12, 8, 8, W[1])
  disc(c, 10, 12, 7, 7, LAITON[2])
  disc(c, 10, 12, 6, 6, '#FFF6DE')
  for (const [x, y] of [[10, 7], [15, 12], [10, 17], [5, 12], [13, 8], [14, 16], [7, 16], [6, 8]] as const) c.set(x, y, INK)
  c.rect(10, 9, 1, 4, INK)
  c.rect(10, 12, 3, 1, INK)
  c.set(10, 12, '#C75A4E')
  box(c, 5, 22, 10, 12, W[0], W[1], W[3])
  c.rect(10, 22, 1, 7, LAITON[1])
  disc(c, 10, 30, 2.4, 2.4, LAITON[2])
  c.set(9, 29, LAITON[3])
  c.rect(6, 23, 1, 9, '#FFFFFF|0.2')
  c.rect(1, 36, 18, 2, W[3])
  c.rect(1, 36, 18, 1, W[5])
  c.rect(4, 38, 12, 1, W[1])
  return c
}

function vinyles() {
  const c = canvas(54, 26)
  const cover = (x: number, y: number, a: string, b: string, draw: (px: number, py: number) => void) => {
    c.rect(x + 1, y + 1, 18, 18, SH)
    box(c, x, y, 17, 17, W[1], W[3], W[0])
    c.rect(x + 1, y + 1, 15, 15, a)
    c.rect(x + 1, y + 9, 15, 7, b)
    draw(x, y)
  }
  cover(0, 6, '#2C6276', '#20485A', (x, y) => {
    disc(c, x + 8.5, y + 8.5, 5, 5, '#1B1730')
    disc(c, x + 8.5, y + 8.5, 2, 2, GOLD)
    c.rect(x + 3, y + 3, 3, 1, '#FFFFFF|0.35')
  })
  cover(18, 2, '#E0A030', '#C4553A', (x, y) => {
    for (let i = 0; i < 4; i += 1) c.rect(x + 3 + i, y + 11 - i * 2, 11 - i * 2, 1, CR)
    disc(c, x + 11, y + 5, 2, 2, CR)
  })
  cover(36, 8, '#3A2A5A', '#7F4A8E', (x, y) => {
    for (let i = 0; i < 6; i += 1) line(c, x + 3 + i * 2, y + 14, x + 8, y + 3, i % 2 ? '#F0A080' : GOLD)
  })
  return c
}

function platine() {
  const c = canvas(46, 48)
  c.rect(2, 45, 42, 3, SH)
  for (const x of [5, 37]) {
    line(c, x + 2, 34, x, 45, W[3])
    line(c, x + 3, 34, x + 1, 45, W[1])
  }
  box(c, 2, 20, 42, 15, W[3], W[5], W[1])
  grainy(c, 3, 21, 40, 13)
  c.rect(4, 23, 18, 10, W[1])
  for (let y = 24; y < 32; y += 2) c.rect(5, y, 16, 1, W[2])
  const cols = ['#C4553A', '#2C6276', '#E0A030', '#7F4A8E', '#E4E0D0', '#3E7A4C', '#C75A4E']
  cols.forEach((col, i) => {
    c.rect(24 + i * 2 + (i > 3 ? 1 : 0), 23, 2, 10, col)
    c.rect(24 + i * 2 + (i > 3 ? 1 : 0), 23, 1, 10, mix(col, '#FFFFFF', 0.25))
  })
  box(c, 4, 12, 38, 8, W[2], W[4], W[1])
  c.rect(4, 12, 38, 1, W[5])
  disc(c, 19, 12, 12, 3.6, (x, y) => ((x + y) % 5 === 0 ? '#34304A' : '#1B1730'))
  disc(c, 19, 12, 4, 1.5, '#C4553A')
  c.set(19, 12, CR)
  line(c, 36, 9, 26, 12, '#C8CCD8')
  c.rect(35, 7, 3, 3, '#8A8FA3')
  c.rect(35, 7, 3, 1, '#C8CCD8')
  c.rect(38, 15, 2, 2, GOLD)
  c.rect(34, 15, 2, 2, '#8A8FA3')
  c.rect(26, 3, 1, 4, '#FFF6DE|0.7')
  c.rect(26, 3, 3, 1, '#FFF6DE|0.7')
  c.rect(24, 6, 2, 2, '#FFF6DE|0.7')
  return c
}

function grainy(c: C, x: number, y: number, w: number, h: number) {
  for (let i = 0; i < (w * h) / 10; i += 1) {
    const px = x + Math.floor(noise(i, 121) * w)
    c.rect(px, y + Math.floor(noise(i, 122) * h), Math.min(2 + Math.floor(noise(i, 123) * 5), x + w - px), 1, noise(i, 124) > 0.5 ? W[2] : W[4])
  }
}

function pouf() {
  const c = canvas(28, 22)
  c.rect(2, 19, 24, 3, SH)
  disc(c, 14, 12, 13, 9, (x, y, d) => {
    const row = Math.floor((y + 1) / 3)
    const st = (x + row * 2) % 4
    const tone = st < 2 ? TERRE[2] : TERRE[1]
    return d > 0.8 && y > 12 ? TERRE[0] : y < 7 ? (st < 2 ? TERRE[3] : TERRE[2]) : tone
  })
  disc(c, 14, 7, 4, 2, TERRE[3])
  disc(c, 14, 7, 1.6, 1, TERRE[0])
  return c
}

function corbeille() {
  const c = canvas(20, 26)
  c.rect(2, 23, 16, 3, SH)
  c.rect(5, 2, 7, 6, '#FFF6DE')
  c.rect(5, 2, 7, 1, '#FFFFFF')
  c.rect(7, 4, 2, 1, '#D8C49E')
  c.rect(10, 0, 5, 7, '#E8DCC0')
  c.rect(11, 2, 2, 1, '#B8A880')
  c.rect(10, 5, 2, 1, '#B8A880')
  c.rect(3, 5, 5, 4, '#F4E4C1')
  for (let y = 7; y < 23; y += 1) {
    const inset = Math.floor((y - 7) / 7)
    for (let x = 2 + inset; x < 18 - inset; x += 1) {
      const lit = x < 6 ? 1 : x > 13 ? -1 : 0
      const base = (x + (y % 4 < 2 ? 0 : 2)) % 4 < 2 ? W[4] : W[3]
      c.set(x, y, lit > 0 ? mix(base, W[5], 0.4) : lit < 0 ? mix(base, W[1], 0.4) : base)
    }
  }
  c.rect(1, 7, 18, 2, W[5])
  c.rect(1, 7, 18, 1, '#E8C89A')
  c.rect(1, 8, 18, 1, W[3])
  c.rect(4, 22, 12, 1, W[1])
  return c
}

/** The crab's basket: wicker and a tartan cushion. */
function panier(dort = false) {
  const c = canvas(38, 22)
  c.rect(2, 19, 34, 3, SH)
  disc(c, 19, 11, 17, 9, (x, y) => ((x + y * 2) % 4 < 2 ? W[4] : W[3]))
  disc(c, 19, 9, 13.5, 5.5, '#6E1E1E')
  disc(c, 19, 8.5, 12, 4.4, (x, y) => ((x % 5 === 2 ? 1 : 0) + (y % 3 === 1 ? 1 : 0) === 2 ? '#F0D088' : x % 5 === 2 || y % 3 === 1 ? '#D8B468' : '#A83A32'))
  disc(c, 19, 10, 17, 9, (x, y, d) => (d > 0.82 && y < 10 ? ((x * 3 + y) % 5 < 3 ? W[5] : W[4]) : null))
  for (let x = 6; x < 33; x += 1) c.set(x, Math.round(16 + Math.sqrt(Math.max(0, 1 - ((x - 19) / 15) ** 2)) * 3), W[1])
  if (dort) c.sprite(['...cccccccccc...', '..cLLLLLLLLLLc..', '.cLccccccccccsc.', 'cccgccccccgcccss', 'ccccccccccccccss', '.ccccccLLccccss.', '..cc.cccccc.cc..'], { c: '#D97757', L: '#EE9A7C', s: '#B85A3C', g: '#1B1730' }, 11, 3)
  return c
}



function murLosanges(T: Theme) {
  const c = canvas(20, 24)
  c.rect(0, 0, 20, 24, T.base)
  for (let x = 0; x < 20; x += 10) c.rect(x, 0, 1, 24, T.st)
  for (const [x, y] of [[5, 6], [15, 6], [0, 18], [10, 18]] as const) for (const [a, b] of [[0, 0], [1, 1], [-1, 1], [0, 2]] as const) c.set((x + a + 20) % 20, y + b, T.dot)
  return c
}

/** Velvet stripes with a thin gold line. */
function murRayures(T: Theme) {
  const c = canvas(24, 8)
  c.rect(0, 0, 24, 8, T.base)
  c.rect(0, 0, 12, 8, T.st)
  c.rect(0, 0, 1, 8, T.dot)
  c.rect(11, 0, 1, 8, T.dot)
  for (let y = 0; y < 8; y += 4) c.set(18, y, T.dot)
  return c
}

/** A small sprig of flowers, staggered. */
function murBrins(T: Theme) {
  const c = canvas(28, 28)
  c.rect(0, 0, 28, 28, T.base)
  const brin = (x: number, y: number) => {
    c.rect(x, y, 1, 6, T.dot)
    c.set(x - 1, y + 1, T.dot)
    c.set(x + 1, y + 2, T.dot)
    c.set(x - 2, y, T.dot)
    c.set(x + 2, y + 1, T.dot)
    c.set(x, y - 1, T.st)
    c.set(x - 2, y - 1, T.st)
    c.set(x + 2, y, T.st)
  }
  brin(6, 6)
  brin(20, 20)
  return c
}

function lambris(T: Theme) {
  const c = canvas(22, 24)
  c.rect(0, 0, 22, 24, T.pan)
  c.rect(0, 0, 22, 2, T.panL)
  c.rect(0, 2, 22, 1, T.pan2)
  c.rect(4, 5, 18, 13, T.panD)
  c.rect(4, 5, 18, 1, T.pan2)
  c.rect(4, 5, 1, 13, T.pan2)
  c.rect(4, 17, 18, 1, T.pan3)
  c.rect(21, 5, 1, 13, T.pan3)
  c.rect(0, 20, 22, 4, W[2])
  c.rect(0, 20, 22, 1, W[4])
  c.rect(0, 23, 22, 1, W[0])
  return c
}

/** Oak boards. */
function parquet() {
  const tones = ['#8A5A3A', '#80523A', '#925F3E', '#7A4E36', '#86563A']
  const c = canvas(114, 42)
  for (let row = 0; row < 6; row += 1) {
    const y = row * 7
    const off = (row % 3) * 17
    for (let i = -1; i < 4; i += 1) {
      const x = i * 38 - off
      c.rect(x, y, 38, 6, tones[Math.floor(noise(i + row * 9, 3) * 5)]!)
      c.rect(x + 37, y, 1, 6, '#5C3A28')
      for (let g = 0; g < 3; g += 1) c.rect(x + 3 + Math.floor(noise(i + g, row) * 28), y + 1 + Math.floor(noise(g, i + row) * 4), 5 + Math.floor(noise(i, g + row) * 8), 1, '#6E462F')
    }
    c.rect(0, y, 114, 1, '#A06E48')
    c.rect(0, y + 6, 114, 1, '#5C3A28')
  }
  return c
}

/** A dark walnut herringbone. */
function chevrons() {
  const [w, h] = [80, 60]
  const c = canvas(w, h)
  const tones = ['#5E3A2A', '#664030', '#583626', '#6C4632', '#623C2C']
  const band = 10
  for (let x = 0; x < w; x += 1) {
    const col = Math.floor(x / 20)
    const rel = col % 2 ? 19 - (x % 20) : x % 20
    for (let y = 0; y < h; y += 1) {
      const v = y + rel
      const k = Math.floor(v / band)
      const t = tones[(k * 3 + (col >> 1) * 2 + 25) % 5]!
      c.set(x, y, v % band === 0 ? '#3A2218' : v % band === 1 ? mix(t, '#8C6448', 0.35) : t)
      if (noise(x, k + 3) > 0.9) c.set(x, y, mix(t, '#3A2218', 0.3))
    }
    if (x % 20 === 0) c.rect(x, 0, 1, h, '#3A2218')
  }
  return c
}

/** A burgundy carpet with small florets. */
function moquette() {
  const c = canvas(48, 48)
  c.rect(0, 0, 48, 48, '#54262E')
  for (let y = 0; y < 48; y += 1) for (let x = 0; x < 48; x += 1) {
    if ((x + y) % 2 === 0) c.set(x, y, '#50242C')
    if (noise(x, y) > 0.92) c.set(x, y, '#5C2C34')
  }
  const fleuron = (x: number, y: number) => {
    for (const [a, b] of [[0, -2], [-2, 0], [2, 0], [0, 2]] as const) c.set(x + a, y + b, '#7E4A46')
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.set(x + a, y + b, '#6A3A3C')
    c.set(x, y, '#A87A58')
  }
  for (const [x, y] of [[12, 12], [36, 12], [24, 36], [0, 36], [48, 36]] as const) fleuron(x % 48, y)
  return c
}

/** A round braided rug, `w` by `h` in cells. */
function tapisRond(w: number, h: number, a: string, b: string, d: string) {
  const c = canvas(w, h)
  const [cx, cy] = [(w - 1) / 2, (h - 1) / 2]
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const r = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2))
      if (r > 1) continue
      const ring = Math.floor(r * 9)
      const col = [a, b, a, d, a, b, d, a, b][ring]!
      const ang = Math.atan2(y - cy, x - cx)
      c.set(x, y, Math.floor((ang + 4) * (ring + 3) * 1.6) % 2 ? col : mix(col, '#1B1730', 0.14))
    }
  }
  return c
}

const TINTS = Object.values(THEMES)
type Theme = (typeof TINTS)[number]
const WALLS = [murLosanges, murRayures, murBrins]
const FLOORS = [once(parquet), once(chevrons), once(moquette)]
const WIDE = 300
const tintOf = (seed: number) => TINTS[pick(seed, 1, TINTS.length)]!

/** Wood on a brass bracket, with the small dark window of a meter. */
function plaque() {
  const c = canvas(36, 12)
  for (const x of [6, 29]) c.rect(x, 0, 1, 3, LAITON[0])
  box(c, 0, 2, 36, 10, W[2], LAITON[2], W[0])
  c.rect(2, 4, 32, 6, '#14121F')
  return c
}

const TELE: Tele = { draw: once(tele), dx: 0, dy: 0, digits: { cx: 36, y: 10, size: 24, ink: '#EDFFF5' }, label: { y: 30, size: 12, ink: '#80E0C7' } }
const PLAQUE: Plaque = { draw: once(plaque), dx: 0, dy: -26, cost: { cx: 36, y: 7, size: 12, ink: GOLD } }
const BOARD: Board = { art: (w, h) => paths(tableau(w, h)), title: '#4A2C2A', paper: CR, glow: '#FFDF8F', inks: { completed: '#7A6A5E', in_progress: '#1B1730', pending: '#3A2E33' } }

export const cosy: Pack = {
  id: 'cosy',
  backdrop(seed, w, h, detail) {
    const T = tintOf(seed)
    const trims = `<rect width="${w}" height="2" fill="${W[4]}"/><rect y="2" width="${w}" height="4" fill="${W[2]}"/><rect y="6" width="${w}" height="2" fill="${T.pan2}"/><rect y="150" width="${w}" height="6" fill="#4A2E22"/><rect y="156" width="${w}" height="4" fill="#64402C"/>`
    return walled({ wall: WALLS[pick(seed, 2, WALLS.length)]!(T), low: lambris(T), floor: FLOORS[detail ? 0 : pick(seed, 3, FLOORS.length)]!(), trims }, w, h)
  },
  rug(seed, w, h, detail) {
    const T = tintOf(seed)
    const kind = pick(seed, 4, 5)
    if (!kind) return null
    return kind > 2 && !detail ? paths(tapisRond(w, h, T.rug[0], T.rug[2], T.rug[1])) : `${paths(tapis(T, w, h))}${frange(w, h)}`
  },
  light: [0.022, 0.026],
  wall: {
    picks: [
      ['fenetre', 'etagere', 'liege'],
      ['horloge', 'affiche', null],
      ['etagere', 'liege', 'peinture', 'fenetre'],
      ['vinyles', 'affiche', 'horloge', null],
      ['peinture', 'liege', 'etagere'],
      ['affiche', 'vinyles', 'peinture', null],
    ],
    items: {
      fenetre: { draw: once(WALL_DECOR.fenetre), y: 7, sparks: [[12, 8], [20, 11], [33, 7], [44, 15]] },
      etagere: { draw: once(etagere), y: 18 },
      liege: { draw: once(WALL_DECOR.liege), y: 15 },
      peinture: { draw: once(peinture), y: 17 },
      affiche: { draw: once(WALL_DECOR.affiche), y: 13 },
      horloge: { draw: once(horloge), y: 13 },
      vinyles: { draw: once(vinyles), y: 17 },
    },
    string: {
      id: 'guirlande',
      y: 3,
      h: 14,
      sag: 26,
      draw: guirlande,
      sparks: w => Array.from({ length: Math.ceil((w - 6) / 13) }, (_, k) => [5 + k * 13, Math.round(2 + Math.abs(Math.sin(((6 + k * 13) * Math.PI) / 26)) * 7) + 1] as const),
    },
  },
  floor: {
    slots: [
      { x: 6, up: 97, w: 48, items: ['platine', 'bibliotheque', 'buffet', 'lampe'] },
      { x: 58, up: 102, w: 38, items: ['monstera', 'lampe', null] },
      { x: 100, up: 102, w: 72, items: ['canape', 'fauteuil', null], minW: WIDE },
      { right: 78, up: 102, w: 72, items: ['canape', 'fauteuil', 'buffet', 'monstera'] },
      { x: 24, up: 46, w: 30, items: ['pouf', 'corbeille', null], front: true },
      { right: 46, up: 22, w: 44, items: ['fauteuil', 'pouf', 'corbeille', null], front: true },
      { right: 60, up: 8, w: 20, items: ['corbeille', null], front: true },
    ],
    items: {
      canape: once(canape),
      fauteuil: once(fauteuil),
      lampe: once(lampe),
      buffet: once(buffet),
      monstera: once(monstera),
      platine: once(platine),
      bibliotheque: once(FLOOR_DECOR.bibliotheque),
      pouf: once(pouf),
      corbeille: once(corbeille),
    },
  },
  seat: { chair: once(chair), desk },
  tele: TELE,
  plaque: PLAQUE,
  board: BOARD,
  hearth: ironStove,
  basket: panier,
}
