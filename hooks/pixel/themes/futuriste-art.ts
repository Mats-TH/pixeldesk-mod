import { canvas, mix, noise } from '../canvas'
import type { Canvas } from '../canvas'
import type { AshLevel, FireLevel } from '../hearth'
import type { DeskState } from '../sprites'

type C = Canvas
const INK = '#2A2036'
const SH = '#0A0818|0.42'
export const COQUE = ['#F4F8FC', '#D4DEEA', '#A8B6CA', '#7A88A4', '#525E7E', '#343C5A', '#1E2440'] as const
export const ACIER = ['#0C0E1C', '#161A2E', '#222842', '#323A5A', '#4A5478', '#6E7A9E'] as const
export const CYAN = ['#0E3A4C', '#14606E', '#1E9AA6', '#3CD0D8', '#8CF4F0', '#DCFFFC'] as const
export const MAGENTA = ['#4A1250', '#84207C', '#C43A9E', '#F06AC0', '#FFB0E0', '#FFE4F4'] as const
export const AMBRE = ['#7A3E10', '#C4761E', '#F4A83A', '#FFD478', '#FFF0C0'] as const
export const VIOLET = ['#2A1660', '#4A2AA0', '#7A4AE0', '#A884F4', '#D8C8FF'] as const
export const VERT = ['#14342A', '#1E5C48', '#2C8A62', '#46C088', '#8CF0B0'] as const
const box = (c: C, x: number, y: number, w: number, h: number, base: string, lit: string, dark: string) => {
  c.rect(x, y, w, h, base)
  c.rect(x, y, w, 1, lit)
  c.rect(x, y, 1, h, lit)
  c.rect(x + w - 1, y, 1, h, dark)
  c.rect(x, y + h - 1, w, 1, dark)
}
export const disc = (c: C, cx: number, cy: number, rx: number, ry: number, paint: string | ((x: number, y: number, d: number) => string | null)) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    if (d > 1) continue
    const p = typeof paint === 'string' ? paint : paint(x, y, d)
    if (p) c.set(x, y, p)
  }
}
const line = (c: C, x0: number, y0: number, x1: number, y1: number, paint: string) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i += 1) c.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), paint)
}
/** What floats: its shadow on the deck, then the glow that holds it up. */
const halo = (c: C, cx: number, cy: number, rx: number, ry: number, col = '#3CD0D8') => {
  disc(c, cx, cy + 1, rx + 2, ry + 1, SH)
  disc(c, cx, cy, rx, ry, (_, __, d) => (d < 0.22 ? `${CYAN[5]}|0.5` : d < 0.55 ? `${col}|0.34` : `${col}|0.16`))
}
const lueur = (c: C, cx: number, cy: number, rx: number, ry: number, col: string, a = 0.14) => disc(c, cx, cy, rx, ry, (_, __, d) => (d < 0.4 ? `${col}|${a * 1.7}` : `${col}|${a}`))
const emetteur = (c: C, x: number, y: number, w: number) => {
  c.rect(x, y, w, 2, ACIER[2])
  c.rect(x, y, w, 1, ACIER[5])
  c.rect(x + 1, y + 2, w - 2, 1, CYAN[4])
}

/** The glass rail: the sky shows through it. */
export function gardeCorps() {
  const c = canvas(44, 24)
  c.rect(0, 2, 44, 20, '#8CF4F0|0.08')
  for (let i = 0; i < 44; i += 1) for (let k = 0; k < 3; k += 1) {
    const y = 21 - Math.round((i + k) * 0.9)
    if (y > 2) c.set(i + 5, y, '#DCFFFC|0.16')
  }
  for (let k = 0; k < 12; k += 1) c.set(29 + k, 20 - k, '#DCFFFC|0.12')
  c.rect(0, 2, 44, 1, '#DCFFFC|0.4')
  c.rect(0, 21, 44, 1, '#3CD0D8|0.4')
  c.rect(0, 0, 44, 2, COQUE[2])
  c.rect(0, 0, 44, 1, COQUE[0])
  for (let x = 4; x < 44; x += 8) c.set(x, 1, CYAN[3])
  c.rect(0, 2, 2, 22, ACIER[3])
  c.rect(0, 2, 1, 22, ACIER[5])
  c.rect(2, 2, 1, 22, ACIER[0])
  for (const y of [6, 16]) c.set(1, y, CYAN[4])
  c.rect(0, 22, 44, 2, ACIER[2])
  c.rect(0, 22, 44, 1, ACIER[4])
  return c
}

/** Very long indigo plates, with a faint line of cyan. */
export function solCoque() {
  const c = canvas(150, 60)
  const tones = ['#1A1C30', '#1C1E34', '#191A2E'] as const
  const seams = [20, 96, 58] as const
  seams.forEach((off, row) => {
    const y = row * 20
    c.rect(0, y, 150, 19, tones[row]!)
    c.rect(0, y, 150, 1, '#22253E')
    c.rect(0, y + 19, 150, 1, '#101122')
    c.rect(off, y, 1, 19, '#101122')
    c.rect(off + 1, y, 1, 19, '#20233A')
    for (const [a, l, d] of [[8, 40, 6], [70, 28, 12], [112, 30, 4]] as const) c.rect((off + a) % 150, y + d, Math.min(l, 150 - (off + a) % 150), 1, '#17182A')
  })
  for (let x = 6; x < 150; x += 30) c.rect(x, 39, 10, 1, '#14606E')
  return c
}

/** Thin blades of dark bronze, with points of amber. */
export function solLames() {
  const c = canvas(150, 60)
  const tones = ['#241C26', '#282028', '#211A24', '#2A2129', '#261D26']
  for (let row = 0; row < 10; row += 1) {
    const y = row * 6
    const s = Math.floor(noise(row, 5) * 150)
    c.rect(0, y, 150, 5, tones[row % 5]!)
    c.rect(0, y, 150, 1, '#352A30')
    c.rect(0, y + 5, 150, 1, '#141016')
    c.rect(s, y, 1, 5, '#141016')
    c.rect((s + 75) % 150, y, 1, 5, '#141016')
    for (let g = 0; g < 3; g += 1) {
      const gx = Math.floor(noise(g, row + 9) * 130)
      c.rect(gx, y + 2, 8 + Math.floor(noise(row, g) * 12), 1, tones[(row + 2) % 5]!)
    }
  }
  for (let x = 10; x < 150; x += 25) c.rect(x, 29, 3, 1, AMBRE[1])
  return c
}

/** A black grating, a violet line every fifty cells. */
export function solGrille() {
  const c = canvas(50, 60)
  c.rect(0, 0, 50, 60, '#13141F')
  for (let y = 0; y < 60; y += 3) for (let x = y % 6 ? 2 : 0; x < 50; x += 4) {
    c.set(x, y, '#0B0C15')
    c.set(x + 1, y, '#1B1C2A')
  }
  c.rect(0, 0, 2, 60, '#1A1B2A')
  c.rect(0, 0, 1, 60, '#26273A')
  for (let y = 4; y < 60; y += 15) c.rect(0, y, 1, 5, VIOLET[1])
  c.rect(0, 30, 50, 1, '#1A1B2A')
  return c
}

/** The landing pad, in light under the desks. `lean`: its two rings alone. */
export function aire(w: number, h: number, lean: boolean) {
  const c = canvas(w, h)
  const [cx, cy] = [(w - 1) / 2, (h - 1) / 2]
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const r = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2))
    const a = Math.atan2((y - cy) * 1.7, x - cx)
    if (r > 0.97 && r < 1) {
      if (Math.floor((a + 4) * 12) % 3) c.set(x, y, '#3CD0D8|0.34')
    } else if (r > 0.8 && r < 0.83) c.set(x, y, '#3CD0D8|0.14')
    else if (!lean && r < 0.8 && r > 0.3 && Math.abs(Math.sin(a * 4)) < 0.012 * (1 / r)) c.set(x, y, '#3CD0D8|0.08')
  }
  return c
}

export function voiture(f = 0) {
  const c = canvas(46, 20)
  disc(c, 22, 18, 15, 1.6, `${MAGENTA[3]}|0.3`)
  for (let i = f * 2; i < 8; i += 1) {
    c.rect(i, 9, 1, 2, i < 3 ? `${CYAN[4]}|${0.12 + i * 0.1}` : i < 6 ? `${CYAN[4]}|0.5` : CYAN[5])
  }
  for (let x = 8; x < 44; x += 1) {
    const t = (x - 8) / 36
    const top = Math.round(9 - 5 * Math.sin(Math.min(1, t * 1.5) * Math.PI))
    const bot = 15 - Math.round(t * t * 3)
    c.rect(x, top, 1, bot - top, COQUE[2])
    c.set(x, top, COQUE[0])
    c.rect(x, bot - 2, 1, 2, COQUE[4])
  }
  for (let x = 17; x < 33; x += 1) {
    const t = (x - 8) / 36
    const top = Math.round(9 - 5 * Math.sin(Math.min(1, t * 1.5) * Math.PI)) + 1
    c.rect(x, top, 1, 9 - top, x < 24 ? CYAN[3] : CYAN[1])
  }
  c.rect(24, 5, 1, 4, ACIER[2])
  c.rect(9, 11, 33, 1, MAGENTA[3])
  c.rect(8, 8, 3, 3, ACIER[1])
  c.set(43, 10, AMBRE[4])
  c.set(42, 11, AMBRE[3])
  c.rect(14, 15, 6, 2, ACIER[3])
  c.rect(27, 14, 6, 2, ACIER[3])
  c.rect(15, 17, 4, 1, MAGENTA[4])
  c.rect(28, 16, 4, 1, MAGENTA[4])
  return c
}

export function navette(f = 0) {
  const c = canvas(64, 24)
  for (const y of [7, 15]) for (let i = f * 2; i < 7; i += 1) c.rect(i, y, 1, 3, i < 3 ? `${AMBRE[3]}|${0.15 + i * 0.12}` : AMBRE[4])
  disc(c, 36, 12, 28, 8, (x, y) => (y < 8 ? COQUE[0] : y < 12 ? COQUE[1] : y < 16 ? COQUE[2] : COQUE[4]))
  c.rect(7, 5, 12, 14, COQUE[3])
  c.rect(7, 5, 12, 1, COQUE[1])
  c.rect(6, 7, 2, 3, ACIER[2])
  c.rect(6, 15, 2, 3, ACIER[2])
  line(c, 12, 5, 8, 0, COQUE[3])
  line(c, 16, 5, 11, 0, COQUE[2])
  c.rect(8, 0, 4, 1, MAGENTA[3])
  for (let x = 24; x < 54; x += 5) {
    c.rect(x, 9, 3, 3, CYAN[4])
    c.set(x, 9, CYAN[5])
  }
  c.rect(56, 8, 6, 4, ACIER[2])
  c.rect(57, 9, 4, 2, CYAN[2])
  c.rect(16, 14, 44, 1, VIOLET[2])
  c.rect(22, 19, 22, 2, ACIER[3])
  c.rect(24, 21, 18, 1, CYAN[3])
  c.set(63, 12, f === 1 ? '#7A2A3A' : '#FF5A6E')
  return c
}

export function vaisseau(f = 0) {
  const c = canvas(104, 36)
  for (const y of [13, 21]) {
    for (let i = f * 3; i < 12; i += 1) c.rect(i, y - 1, 1, 4, i < 5 ? `${CYAN[4]}|${0.1 + i * 0.08}` : i < 9 ? `${CYAN[4]}|0.6` : CYAN[5])
    c.rect(11, y - 3, 8, 8, ACIER[3])
    c.rect(11, y - 3, 8, 1, ACIER[5])
  }
  c.rect(18, 8, 68, 20, ACIER[3])
  c.rect(18, 8, 68, 1, ACIER[5])
  c.rect(18, 27, 68, 1, ACIER[0])
  for (let x = 20; x < 84; x += 12) {
    const col = [MAGENTA[2], COQUE[2], AMBRE[1], CYAN[1], COQUE[3]][Math.floor(x / 12) % 5]!
    box(c, x, 3, 11, 6, col, mix(col, '#FFFFFF', 0.3), mix(col, '#000000', 0.3))
    box(c, x, 27, 11, 5, ACIER[2], ACIER[4], ACIER[0])
  }
  for (let x = 86; x < 102; x += 1) {
    const t = (x - 86) / 16
    const hw = 10 - t * 7
    c.rect(x, Math.round(18 - hw), 1, Math.round(hw * 2), ACIER[3])
    c.set(x, Math.round(18 - hw), ACIER[5])
  }
  c.rect(90, 13, 7, 5, CYAN[3])
  c.rect(90, 13, 7, 1, CYAN[5])
  for (let x = 22; x < 84; x += 5) {
    c.rect(x, 12, 3, 2, x % 3 ? AMBRE[3] : ACIER[1])
    c.rect(x, 22, 3, 1, ACIER[1])
  }
  c.rect(18, 17, 68, 1, CYAN[2])
  c.set(103, 18, f === 1 ? '#7A2A3A' : '#FF5A6E')
  c.set(30, 2, f === 1 ? '#FF5A6E' : '#7A2A3A')
  return c
}

export function droneLivreur(f = 0) {
  const c = canvas(48, 46)
  lueur(c, 24, 42, 11, 3, CYAN[3], 0.16)
  for (const x of [6, 42]) {
    disc(c, x, 8, 6 - (f === 1 ? 2 : 0), 1.6, `${CYAN[4]}|0.3`)
    if (f === 2) {
      c.rect(x - 6, 8, 3, 1, `${CYAN[5]}|0.5`)
      c.rect(x + 3, 8, 3, 1, `${CYAN[5]}|0.5`)
    } else c.rect(x - 6 + f * 2, 8, 12 - f * 4, 1, `${CYAN[5]}|0.5`)
    c.rect(x - 1, 8, 3, 4, ACIER[2])
    c.rect(x - 1, 8, 1, 4, ACIER[5])
  }
  line(c, 8, 12, 17, 15, ACIER[3])
  line(c, 8, 13, 17, 16, ACIER[1])
  line(c, 40, 12, 31, 15, ACIER[3])
  line(c, 40, 13, 31, 16, ACIER[1])
  disc(c, 24, 16, 9, 6, (x, y) => (y < 14 ? COQUE[0] : y < 17 ? COQUE[1] : COQUE[3]))
  c.rect(18, 16, 12, 2, ACIER[1])
  c.rect(19, 16, 3, 1, CYAN[4])
  c.rect(26, 16, 3, 1, MAGENTA[3])
  c.rect(22, 10, 4, 1, ACIER[2])
  c.set(24, 9, f === 1 ? '#7A2A3A' : '#FF5A6E')
  for (const x of [15, 31]) {
    c.rect(x, 21, 2, 5, ACIER[3])
    c.rect(x, 21, 1, 5, ACIER[5])
    c.rect(x - 1, 25, 3, 1, AMBRE[3])
  }
  box(c, 14, 26, 20, 14, COQUE[3], COQUE[1], COQUE[5])
  for (let x = 15; x < 33; x += 1) for (let y = 27; y < 30; y += 1) if ((x + y) % 6 < 3) c.set(x, y, AMBRE[2])
  else c.set(x, y, ACIER[1])
  c.rect(17, 32, 8, 5, COQUE[0])
  c.rect(18, 33, 6, 1, ACIER[3])
  c.rect(18, 35, 4, 1, ACIER[3])
  c.rect(28, 32, 3, 5, CYAN[3])
  c.rect(28, 32, 1, 5, CYAN[5])
  return c
}

export function sphereDonnees() {
  const c = canvas(46, 50)
  lueur(c, 23, 22, 22, 21, CYAN[3], 0.07)
  for (let y = 36; y < 44; y += 1) {
    const hw = 3 + (43 - y) * 0.9
    c.rect(Math.round(23 - hw), y, Math.round(hw * 2), 1, `${CYAN[4]}|0.16`)
  }
  disc(c, 23, 22, 15, 15, `${CYAN[1]}|0.6`)
  for (let i = -3; i <= 3; i += 1) {
    const ry = Math.cos((i * Math.PI) / 7) * 15, y = 22 + Math.sin((i * Math.PI) / 7) * 15
    for (let a = 0; a < 6.3; a += 0.02) c.set(Math.round(23 + Math.cos(a) * ry), Math.round(y + Math.sin(a) * ry * 0.14), i % 2 ? CYAN[3] : CYAN[4])
  }
  for (const k of [0.25, 0.62, 0.92]) for (let a = 0; a < 6.3; a += 0.02) c.set(Math.round(23 + Math.cos(a) * 15 * k), Math.round(22 + Math.sin(a) * 15), CYAN[3])
  for (let i = 0; i < 26; i += 1) {
    const [x, y] = [10 + Math.floor(noise(i, 41) * 26), 9 + Math.floor(noise(i, 42) * 26)]
    if ((x - 23) ** 2 + (y - 22) ** 2 < 200) c.rect(x, y, 2, 1, i % 3 ? CYAN[5] : MAGENTA[4])
  }
  for (let a = 0; a < 6.3; a += 0.01) {
    const [u, v] = [Math.cos(a) * 21, Math.sin(a) * 6]
    const y = 22 + v + u * 0.22
    if (v > -2) c.set(Math.round(23 + u), Math.round(y), MAGENTA[3])
  }
  for (const a of [0.4, 2.5, 1.5]) {
    const [u, v] = [Math.cos(a) * 21, Math.sin(a) * 6]
    const [x, y] = [Math.round(23 + u), Math.round(22 + v + u * 0.22)]
    c.rect(x - 1, y - 1, 3, 3, MAGENTA[5])
  }
  disc(c, 23, 44, 9, 3, (x, y) => (y < 44 ? ACIER[4] : ACIER[2]))
  c.rect(16, 43, 15, 1, CYAN[4])
  c.rect(19, 47, 9, 1, `${CYAN[4]}|0.6`)
  c.rect(21, 48, 5, 1, `${CYAN[4]}|0.3`)
  return c
}

export function panneauDonnees() {
  const c = canvas(56, 44)
  const pan = (x: number, y: number) => {
    c.set(x, y, y % 2 ? '#08222E|0.78' : '#0C2E3C|0.78')
  }
  for (let y = 2; y < 32; y += 1) for (let x = 2 + Math.max(0, 4 - (y - 2)); x < 54 - Math.max(0, 4 - (31 - y)); x += 1) pan(x, y)
  for (const [x, w] of [[6, 18], [34, 18]] as const) {
    c.rect(x, 2, w, 1, CYAN[4])
    c.rect(x, 31, w, 1, CYAN[3])
  }
  c.rect(2, 8, 1, 18, CYAN[3])
  c.rect(53, 6, 1, 18, CYAN[4])
  let py = 18
  for (let x = 6; x < 30; x += 1) {
    const y = Math.round(16 - 6 * Math.sin(x * 0.42) - x * 0.1)
    line(c, x - 1, py, x, y, CYAN[5])
    py = y
    if (x % 4 === 0) c.rect(x, y + 1, 1, 20 - y, `${CYAN[3]}|0.5`)
  }
  for (let x = 6; x < 30; x += 1) c.set(x, 21, CYAN[2])
  disc(c, 42, 13, 7, 7, (x, y, d) => (d > 0.5 ? (Math.atan2(y - 13, x - 42) < 1.4 ? MAGENTA[3] : VIOLET[1]) : null))
  c.rect(40, 12, 4, 2, CYAN[5])
  for (let i = 0; i < 6; i += 1) {
    const h = [3, 5, 2, 6, 4, 5][i]!
    c.rect(34 + i * 3, 28 - h, 2, h, i % 2 ? AMBRE[3] : CYAN[4])
  }
  for (const [i, w] of [16, 22, 11].entries()) c.rect(6, 24 + i * 2, w, 1, CYAN[3])
  for (let y = 33; y < 38; y += 1) {
    const hw = 7 + (37 - y) * 2.4
    c.rect(Math.round(28 - hw), y, Math.round(hw * 2), 1, `${CYAN[4]}|0.14`)
  }
  emetteur(c, 20, 38, 17)
  c.rect(23, 42, 11, 1, `${CYAN[4]}|0.3`)
  return c
}

export function droneCamera(f = 0) {
  const c = canvas(32, 34)
  disc(c, 16, 31, 8, 2.2, `${CYAN[3]}|0.2`)
  for (const s of [1, -1]) {
    for (let i = 0; i < 6; i += 1) c.rect(16 + s * (11 + i), 11 + i, s > 0 ? 1 : 1, 4 - Math.floor(i / 2), i > 3 ? COQUE[3] : COQUE[2])
    c.rect(16 + s * 16, 16, 1, 2, CYAN[4])
  }
  disc(c, 16, 13, 12, 12, (x, y) => {
      const l = (16 - x) * 0.6 + (13 - y) * 0.8
      return l > 5 ? COQUE[0] : l > 0 ? COQUE[1] : l > -5 ? COQUE[2] : COQUE[3]
  })
  disc(c, 16, 14, 7.6, 7.6, ACIER[0])
  disc(c, 16, 14, 6, 6, (x, y) => (x + y < 30 ? CYAN[2] : CYAN[1]))
  disc(c, 16 + (f === 1 ? 1 : f === 2 ? -1 : 0), 14, 3, 3, CYAN[4])
  c.rect(15 + (f === 1 ? 1 : f === 2 ? -1 : 0), 13, 2, 2, CYAN[5])
  c.rect(12, 10, 2, 2, '#FFFFFF')
  c.rect(14, 1, 4, 2, ACIER[3])
  c.rect(15, 0, 1, 1, f === 1 ? '#7A2A3A' : '#FF5A6E')
  disc(c, 16, 25, 5, 2, ACIER[2])
  c.rect(13 + (f === 1 ? 1 : 0), 26, 7 - (f === 1 ? 2 : 0), 1, CYAN[4])
  return c
}

export function lanterne() {
  const c = canvas(28, 44)
  lueur(c, 14, 18, 14, 18, AMBRE[3], 0.1)
  c.rect(11, 2, 6, 2, ACIER[3])
  c.rect(11, 2, 6, 1, ACIER[5])
  c.rect(13, 0, 2, 2, ACIER[2])
  for (let y = 4; y < 32; y += 1) {
    const hw = Math.round(7 * Math.sin(((y - 2) / 31) * Math.PI) + 1)
    c.rect(14 - hw, y, hw * 2, 1, y < 12 ? AMBRE[4] : y < 24 ? '#FFFBE8' : AMBRE[3])
    c.set(14 - hw, y, AMBRE[3])
    c.set(13 + hw, y, AMBRE[2])
  }
  for (const y of [10, 18, 26]) c.rect(6, y, 16, 1, `${ACIER[3]}|0.6`)
  for (const s of [-1, 1]) {
    line(c, 14 + s * 8, 26, 14 + s * 12, 33, ACIER[4])
    line(c, 14 + s * 7, 27, 14 + s * 11, 34, ACIER[2])
  }
  emetteur(c, 9, 32, 11)
  c.rect(11, 36, 7, 1, `${AMBRE[3]}|0.5`)
  c.rect(12, 38, 5, 1, `${AMBRE[3]}|0.3`)
  c.rect(13, 40, 3, 1, `${AMBRE[3]}|0.16`)
  return c
}

export function relais() {
  const c = canvas(64, 36)
  const aile = (x: number) => {
    box(c, x, 12, 20, 12, ACIER[1], CYAN[2], ACIER[0])
    for (let i = 1; i < 20; i += 1) for (let j = 1; j < 11; j += 1) c.set(x + i, 12 + j, i % 5 === 0 || j % 5 === 0 ? CYAN[1] : (i + j) % 3 === 0 ? '#1C3A7C' : '#142C64')
    c.rect(x, 12, 20, 1, CYAN[4])
  }
  aile(0)
  aile(44)
  c.rect(20, 17, 4, 2, COQUE[2])
  c.rect(40, 17, 4, 2, COQUE[2])
  disc(c, 32, 18, 9, 10, (x, y) => (x + y < 48 ? COQUE[0] : x + y < 52 ? COQUE[1] : COQUE[3]))
  c.rect(24, 18, 16, 1, ACIER[3])
  disc(c, 32, 21, 3, 3, ACIER[0])
  disc(c, 32, 21, 2, 2, CYAN[4])
  c.set(31, 20, CYAN[5])
  disc(c, 32, 8, 7, 3, (x, y) => (y > 8 ? null : COQUE[1]))
  c.rect(25, 8, 15, 1, COQUE[3])
  c.rect(31, 2, 1, 6, ACIER[4])
  c.set(31, 1, '#FF5A6E')
  c.rect(32, 8, 1, 2, ACIER[3])
  emetteur(c, 26, 28, 12)
  c.rect(28, 31, 8, 1, `${CYAN[4]}|0.4`)
  c.rect(30, 33, 4, 1, `${CYAN[4]}|0.2`)
  return c
}

/** No legs, and its hands float beside it. */
export function droide() {
  const c = canvas(40, 58)
  halo(c, 20, 53, 11, 3, AMBRE[3])
  c.rect(19, 0, 2, 4, ACIER[4])
  c.set(19, 0, AMBRE[3])
  c.set(20, 0, AMBRE[3])
  box(c, 11, 4, 18, 13, ACIER[3], ACIER[5], ACIER[1])
  c.rect(12, 4, 16, 2, ACIER[5])
  c.rect(10, 8, 1, 6, ACIER[4])
  c.rect(29, 8, 1, 6, ACIER[1])
  c.rect(13, 8, 14, 5, ACIER[0])
  c.rect(14, 9, 12, 3, AMBRE[2])
  c.rect(14, 9, 12, 1, AMBRE[4])
  c.rect(16, 10, 3, 1, '#FFFFFF')
  c.rect(21, 10, 3, 1, '#FFFFFF')
  c.rect(16, 17, 8, 2, ACIER[1])
  c.rect(16, 17, 8, 1, CYAN[3])
  for (let y = 19; y < 42; y += 1) {
    const hw = Math.round(13 - (y - 19) * 0.3)
    c.rect(20 - hw, y, hw * 2, 1, y < 21 ? ACIER[5] : ACIER[3])
    c.set(20 - hw, y, ACIER[5])
    c.set(19 + hw, y, ACIER[1])
  }
  for (let y = 24; y < 40; y += 4) c.rect(10, y, 20, 1, ACIER[2])
  box(c, 15, 23, 10, 9, ACIER[1], ACIER[4], ACIER[0])
  c.rect(17, 25, 6, 1, CYAN[4])
  c.rect(17, 27, 4, 1, MAGENTA[3])
  c.rect(17, 29, 5, 1, AMBRE[3])
  c.rect(14, 42, 12, 3, ACIER[2])
  c.rect(14, 42, 12, 1, ACIER[5])
  c.rect(16, 45, 8, 1, AMBRE[3])
  c.rect(18, 46, 4, 2, `${AMBRE[3]}|0.6`)
  c.rect(19, 48, 2, 2, `${AMBRE[3]}|0.3`)
  for (const s of [-1, 1]) {
    disc(c, 20 + s * 15, 22, 4, 4, (x, y) => (x + y < 20 + s * 15 + 22 ? ACIER[5] : ACIER[3]))
    c.set(20 + s * 15, 22, AMBRE[3])
    c.rect(20 + s * 15 - 1, 27, 3, 4, ACIER[3])
    c.rect(20 + s * 15 - 1, 27, 1, 4, ACIER[5])
    c.rect(20 + s * 15 - 2, 33, 5, 4, ACIER[4])
    c.rect(20 + s * 15 - 2, 33, 5, 1, ACIER[5])
    c.rect(20 + s * 15 - 2, 37, 1, 2, ACIER[3])
    c.rect(20 + s * 15, 37, 1, 2, ACIER[3])
    c.rect(20 + s * 15 + 2, 37, 1, 2, ACIER[3])
  }
  return c
}

export function capsule() {
  const c = canvas(42, 70)
  halo(c, 21, 65, 17, 3.6)
  for (let y = 2; y < 56; y += 1) {
    const hw = y < 12 ? Math.round(15 * Math.sqrt(1 - ((12 - y) / 11) ** 2)) + 1 : 16
    c.rect(21 - hw, y, hw * 2, 1, COQUE[2])
    c.set(21 - hw, y, COQUE[0])
    c.set(22 - hw, y, COQUE[1])
    c.set(20 + hw, y, COQUE[4])
    c.set(19 + hw, y, COQUE[3])
  }
  for (let y = 6; y < 48; y += 1) {
    const hw = y < 15 ? Math.round(11 * Math.sqrt(Math.max(0, 1 - ((15 - y) / 10) ** 2))) : 11
    for (let x = 21 - hw; x < 21 + hw; x += 1) {
      const t = (y - 6) / 42
      c.set(x, y, t > 0.78 ? (noise(x, y) > 0.5 ? CYAN[5] : CYAN[4]) : t > 0.6 ? (noise(x, y) > 0.7 ? CYAN[4] : CYAN[3]) : (x + y) % 9 === 0 ? CYAN[2] : CYAN[1])
    }
  }
  disc(c, 21, 16, 4, 4.4, CYAN[0])
  for (let y = 20; y < 38; y += 1) c.rect(21 - Math.max(3, 6 - Math.floor((y - 20) / 4)), y, Math.max(3, 6 - Math.floor((y - 20) / 4)) * 2, 1, CYAN[0])
  for (let i = 0; i < 40; i += 1) c.set(10 + Math.floor(noise(i, 51) * 22), 8 + Math.floor(noise(i, 52) * 38), CYAN[5])
  for (let y = 10; y < 40; y += 1) {
    c.set(13 + Math.round((40 - y) * 0.12), y, '#FFFFFF')
    if (y % 3) c.set(14 + Math.round((40 - y) * 0.12), y, CYAN[5])
  }
  c.rect(10, 48, 22, 7, COQUE[3])
  c.rect(10, 48, 22, 1, COQUE[0])
  c.rect(12, 50, 10, 3, ACIER[0])
  c.rect(13, 51, 6, 1, CYAN[4])
  c.rect(25, 50, 2, 2, VERT[3])
  c.rect(28, 50, 2, 2, AMBRE[3])
  box(c, 3, 56, 36, 5, ACIER[3], ACIER[5], ACIER[0])
  c.rect(5, 58, 32, 1, CYAN[3])
  emetteur(c, 8, 61, 8)
  emetteur(c, 26, 61, 8)
  for (const [x, y] of [[4, 22], [37, 22], [4, 38], [37, 38]] as const) c.rect(x, y, 2, 3, ACIER[2])
  return c
}

export function plante() {
  const c = canvas(48, 62)
  halo(c, 24, 57, 13, 3.2)
  disc(c, 24, 25, 22, 22, `${CYAN[3]}|0.1`)
  for (const [a, b, d] of [[24, 33, 42], [24, 26, 40], [24, 20, 39], [24, 30, 38]] as const) line(c, a, 28, b, d, '#B8C8A0')
  c.rect(19, 25, 10, 5, ACIER[3])
  c.rect(19, 25, 10, 1, ACIER[5])
  const f = (x0: number, y0: number, a: number, l: number, w: number, t1: string, t2: string) => {
    const n = l * 3
    for (let i = 0; i <= n; i += 1) {
      const t = i / n, hw = w * Math.sin(Math.PI * t), cx = x0 + Math.cos(a) * l * t, cy = y0 - Math.sin(a) * l * t
      for (let s = -hw; s <= hw; s += 0.4) c.set(Math.round(cx - Math.sin(a) * s), Math.round(cy - Math.cos(a) * s), Math.abs(s) < 0.5 ? MAGENTA[4] : s > 0 ? t1 : t2)
    }
  }
  for (const [x, y, a, l, w, p, q] of [[24, 25, 2.7, 15, 4, VERT[2], VERT[3]], [24, 25, 0.5, 15, 4, VERT[2], VERT[3]], [24, 25, 2.1, 17, 5, VERT[3], VERT[4]], [24, 25, 1.05, 17, 5, VERT[3], VERT[4]], [24, 25, 1.57, 20, 5.5, MAGENTA[2], MAGENTA[3]]] as const) f(x, y, a, l, w, p, q)
  for (const [x, y] of [[11, 33], [36, 30], [15, 40], [33, 38], [9, 22]] as const) {
    c.rect(x, y, 2, 2, CYAN[4])
    c.set(x, y, CYAN[5])
  }
  for (let a = 0; a < 6.3; a += 0.008) {
    const [x, y] = [Math.round(24 + Math.cos(a) * 22), Math.round(25 + Math.sin(a) * 22)]
    c.set(x, y, Math.sin(a - 3.9) > 0.5 ? CYAN[5] : Math.sin(a - 3.9) < -0.6 ? CYAN[1] : CYAN[3])
  }
  for (let a = 3.5; a < 4.4; a += 0.02) {
    c.set(Math.round(24 + Math.cos(a) * 18), Math.round(25 + Math.sin(a) * 18), '#FFFFFF')
    c.set(Math.round(24 + Math.cos(a) * 17), Math.round(25 + Math.sin(a) * 17), `${CYAN[5]}|0.6`)
  }
  c.rect(14, 46, 20, 3, ACIER[3])
  c.rect(14, 46, 20, 1, ACIER[5])
  c.rect(16, 49, 16, 1, CYAN[4])
  return c
}

export function banquette() {
  const c = canvas(92, 48)
  halo(c, 24, 43, 15, 3.4, MAGENTA[3])
  halo(c, 68, 43, 15, 3.4, MAGENTA[3])
  for (let x = 2; x < 90; x += 1) {
    const e = Math.min(x - 2, 89 - x)
    const top = 6 + (e < 8 ? 8 - e : 0)
    const bot = 38 - (e < 5 ? 5 - e : 0)
    c.rect(x, top, 1, bot - top, COQUE[1])
    c.set(x, top, COQUE[0])
    c.set(x, top + 1, COQUE[0])
    c.rect(x, bot - 4, 1, 4, COQUE[3])
    c.set(x, bot - 1, COQUE[5])
  }
  for (let i = 0; i < 3; i += 1) {
    const x = 11 + i * 24
    box(c, x, 9, 23, 15, VIOLET[1], VIOLET[3], VIOLET[0])
    for (let u = 1; u < 22; u += 1) for (let v = 1; v < 14; v += 1) c.set(x + u, 9 + v, (u + v) % 7 === 0 || (u - v + 21) % 7 === 0 ? VIOLET[0] : v < 5 ? VIOLET[2] : VIOLET[1])
  }
  for (let i = 0; i < 3; i += 1) {
    const x = 10 + i * 24
    box(c, x, 23, 24, 9, VIOLET[2], VIOLET[4], VIOLET[0])
    c.rect(x + 1, 24, 22, 2, VIOLET[3])
    c.rect(x + 1, 29, 22, 2, VIOLET[1])
  }
  c.rect(6, 33, 80, 1, MAGENTA[3])
  c.rect(6, 34, 80, 1, MAGENTA[1])
  for (const x of [6, 83]) {
    c.rect(x, 12, 3, 20, COQUE[2])
    c.rect(x, 12, 1, 20, COQUE[0])
    c.rect(x + 1, 16, 1, 12, MAGENTA[3])
  }
  const co = (x: number, y: number, s: number, a: string, b: string, d: string) => {
    box(c, x, y, s, s, a, b, d)
    c.rect(x + 1, y + 1, s - 2, 2, b)
    for (const [p, q] of [[x, y], [x + s - 1, y], [x, y + s - 1], [x + s - 1, y + s - 1]] as const) c.set(p, q, null)
  }
  co(15, 12, 13, MAGENTA[3], MAGENTA[4], MAGENTA[1])
  line(c, 18, 21, 25, 14, MAGENTA[1])
  co(65, 11, 13, CYAN[3], CYAN[4], CYAN[1])
  for (let y = 14; y < 23; y += 3) c.rect(66, y, 11, 1, CYAN[1])
  c.rect(42, 21, 12, 2, ACIER[0])
  c.rect(43, 21, 10, 1, CYAN[4])
  emetteur(c, 16, 38, 18)
  emetteur(c, 58, 38, 18)
  return c
}

export function tableHolo() {
  const c = canvas(66, 56)
  halo(c, 33, 51, 16, 3.4)
  for (let y = 4; y < 29; y += 1) {
    const hw = 10 + (y - 4) * 0.72
    c.rect(Math.round(33 - hw), y, Math.round(hw * 2), 1, y % 2 ? `${CYAN[4]}|0.1` : `${CYAN[4]}|0.05`)
  }
  for (const [x, w, h] of [[16, 5, 8], [22, 6, 14], [29, 5, 21], [35, 7, 12], [43, 5, 17], [49, 3, 7]] as const) {
    const t = 28 - h
    for (let px = x; px < x + w; px += 1) c.rect(px, t, 1, h, `${CYAN[2]}|0.44`)
    c.rect(x, t, w, 1, CYAN[5])
    c.rect(x, t, 1, h, CYAN[4])
    c.rect(x + w - 1, t, 1, h, CYAN[4])
    for (let y = t + 2; y < 28; y += 3) c.rect(x + 1, y, w - 2, 1, `${CYAN[5]}|0.5`)
  }
  c.rect(31, 2, 1, 5, CYAN[5])
  c.set(31, 1, MAGENTA[4])
  for (const [x, y] of [[12, 12], [54, 9], [20, 5], [46, 3]] as const) c.rect(x, y, 2, 1, MAGENTA[4])
  disc(c, 33, 32, 28, 6, (x, y, d) => (d > 0.82 ? (y < 32 ? COQUE[0] : COQUE[2]) : d > 0.3 ? ACIER[2] : CYAN[2]))
  disc(c, 33, 31, 8, 1.8, CYAN[5])
  for (let x = 6; x < 61; x += 1) {
    const y = Math.round(32 + 6 * Math.sqrt(Math.max(0, 1 - ((x - 33) / 28) ** 2)))
    c.set(x, y + 1, COQUE[3])
    c.set(x, y + 2, COQUE[5])
  }
  for (let x = 10; x < 58; x += 4) {
    const y = Math.round(32 + 6 * Math.sqrt(Math.max(0, 1 - ((x - 33) / 28) ** 2)))
    c.set(x, y + 1, CYAN[4])
  }
  for (const x of [32, 34]) c.rect(x, 39, 1, 4, ACIER[4])
  c.rect(25, 42, 17, 3, ACIER[3])
  c.rect(25, 42, 17, 1, ACIER[5])
  c.rect(27, 45, 13, 1, CYAN[4])
  return c
}

export function moto() {
  const c = canvas(88, 46)
  halo(c, 22, 41, 15, 3, '#FF8A3C')
  halo(c, 64, 41, 15, 3, '#FF8A3C')
  const nacelle = (x: number, w: number) => {
    disc(c, x + w / 2, 30, w / 2, 6, (px, py) => (py < 28 ? AMBRE[2] : py < 31 ? ACIER[3] : ACIER[1]))
    c.rect(x + 3, 29, w - 6, 1, ACIER[5])
    c.rect(x + 5, 36, w - 10, 1, '#FF8A3C')
    c.rect(x + 7, 37, w - 14, 1, '#FF8A3C|0.5')
  }
  for (let x = 8; x < 78; x += 1) {
    const t = (x - 8) / 70
    const top = Math.round(22 - 8 * Math.sin(t * Math.PI) * (t > 0.5 ? 1 : 0.5))
    const bot = 29
    c.rect(x, top, 1, bot - top, ACIER[3])
    c.set(x, top, ACIER[5])
    c.rect(x, bot - 2, 1, 2, ACIER[1])
  }
  for (let x = 12; x < 74; x += 1) c.set(x, 24, AMBRE[2])
  for (let x = 14; x < 70; x += 8) c.rect(x, 26, 4, 1, ACIER[1])
  for (let x = 16; x < 46; x += 1) {
    const top = x < 23 ? 10 + Math.max(0, 19 - x) : 14 + Math.round(Math.abs(x - 32) * 0.08)
    c.rect(x, top, 1, 20 - top, (x - 16) % 5 === 0 ? '#2A140A' : '#4A2614')
    c.set(x, top, AMBRE[1])
    c.set(x, top + 1, '#6A3A1C')
  }
  c.rect(16, 20, 30, 1, ACIER[0])
  for (let x = 46; x < 56; x += 3) c.rect(x, 19, 2, 4, ACIER[1])
  c.rect(46, 23, 14, 1, CYAN[3])
  for (let i = 0; i < 10; i += 1) c.rect(58 + i, 3 + i, 2, 12 - i, i < 4 ? `${CYAN[4]}|0.5` : `${CYAN[3]}|0.4`)
  line(c, 58, 2, 69, 14, CYAN[5])
  line(c, 52, 13, 56, 6, ACIER[4])
  c.rect(50, 5, 8, 2, ACIER[2])
  c.rect(50, 5, 3, 2, AMBRE[2])
  c.rect(60, 15, 6, 3, ACIER[0])
  c.rect(61, 16, 4, 1, CYAN[4])
  c.rect(78, 20, 6, 6, ACIER[2])
  c.rect(84, 21, 2, 4, AMBRE[4])
  for (let i = 0; i < 3; i += 1) c.rect(86 + i, 22, 1, 2, `${AMBRE[4]}|${0.5 - i * 0.14}`)
  c.rect(2, 19, 7, 8, ACIER[2])
  c.rect(2, 19, 7, 1, ACIER[5])
  c.rect(1, 21, 1, 4, '#FF8A3C')
  c.rect(0, 22, 1, 2, '#FF8A3C|0.5')
  line(c, 4, 19, 1, 13, ACIER[3])
  c.rect(0, 12, 4, 1, AMBRE[2])
  nacelle(6, 32)
  nacelle(48, 32)
  return c
}

export function panier(dort = false) {
  const c = canvas(38, 24)
  disc(c, 19, 21, 15, 2.4, SH)
  disc(c, 19, 21, 10, 1.6, `${CYAN[3]}|0.36`)
  disc(c, 19, 21, 4, 1, `${CYAN[5]}|0.5`)
  disc(c, 19, 13, 18, 4.4, ACIER[1])
  disc(c, 19, 13, 17, 3.4, (x, y) => (y < 13 ? ACIER[4] : ACIER[2]))
  for (let a = 0; a < 6.3; a += 0.05) {
    if (Math.sin(a) > 0.1) c.set(Math.round(19 + Math.cos(a) * 17.6), Math.round(13.4 + Math.sin(a) * 4), Math.floor(a * 5) % 2 ? CYAN[4] : CYAN[2])
  }
  disc(c, 19, 9.6, 15, 5, (x, y, d) => (d > 0.8 ? (y < 10 ? VIOLET[3] : VIOLET[0]) : y < 8 ? VIOLET[3] : VIOLET[2]))
  disc(c, 19, 10, 3, 1.1, VIOLET[1])
  for (const [x, y] of [[9, 9], [29, 9], [14, 7], [24, 7], [14, 12], [24, 12]] as const) c.set(x, y, VIOLET[1])
  c.rect(15, 16, 8, 2, ACIER[2])
  c.rect(16, 18, 6, 1, CYAN[4])
  if (dort) c.sprite(['...cccccccccc...', '..cLLLLLLLLLLc..', '.cLccccccccccsc.', 'cccgccccccgcccss', 'ccccccccccccccss', '.ccccccLLccccss.', '..cc.cccccc.cc..'], { c: '#D97757', L: '#EE9A7C', s: '#B85A3C', g: '#1B1730' }, 11, 3)
  return c
}

export function chaise() {
  const c = canvas(60, 45)
  for (let y = 2; y < 27; y += 1) {
    const hw = y < 5 ? 8 + (y - 2) * 2 : 14 - Math.floor((y - 5) / 8)
    c.rect(30 - hw, y, hw * 2, 1, COQUE[2])
    c.set(30 - hw, y, COQUE[0])
    c.set(31 - hw, y, COQUE[1])
    c.set(29 + hw, y, COQUE[4])
    c.set(28 + hw, y, COQUE[3])
    if (y > 3) c.rect(33 - hw, y, Math.max(0, hw * 2 - 6), 1, y % 2 ? VIOLET[1] : VIOLET[2])
  }
  c.rect(19, 2, 22, 1, COQUE[0])
  c.rect(24, 27, 12, 2, ACIER[2])
  c.rect(24, 27, 12, 1, ACIER[5])
  c.rect(26, 29, 8, 1, CYAN[4])
  c.rect(27, 30, 6, 1, `${CYAN[4]}|0.5`)
  return c
}

export function bureau(state: DeskState | 'rest') {
  const c = canvas(60, 45)
  disc(c, 30, 43, 28, 2, SH)
  for (const x of [14, 46]) {
    disc(c, x, 43, 9, 1.8, `${CYAN[3]}|0.36`)
    disc(c, x, 43, 4, 1, `${CYAN[5]}|0.6`)
    for (let y = 39; y < 42; y += 1) c.rect(x - 4 + (y - 39), y, 8 - (y - 39) * 2, 1, `${CYAN[4]}|${0.5 - (y - 39) * 0.14}`)
  }
  c.rect(5, 37, 50, 2, COQUE[4])
  c.rect(9, 39, 42, 1, COQUE[5])
  c.rect(2, 28, 56, 10, COQUE[2])
  c.rect(2, 28, 56, 1, COQUE[3])
  c.rect(2, 36, 56, 2, COQUE[3])
  c.rect(2, 29, 1, 8, COQUE[0])
  c.rect(57, 29, 1, 8, COQUE[4])
  for (const x of [10, 45]) {
    c.rect(x, 38, 6, 1, ACIER[2])
    c.rect(x + 1, 39, 4, 1, CYAN[4])
  }
  c.rect(1, 18, 58, 9, COQUE[5])
  c.rect(1, 18, 58, 1, COQUE[3])
  for (let i = 0; i < 16; i += 1) {
    const x = 3 + i * 4
    c.rect(x, 19, 1, 7, '#2A3050')
  }
  for (let k = 0; k < 7; k += 1) {
    c.rect(26 + k, 19 + k, 5, 1, COQUE[4])
  }
  c.rect(0, 19, 1, 8, COQUE[1])
  c.rect(59, 19, 1, 8, COQUE[3])
  c.rect(0, 26, 60, 2, COQUE[0])
  c.rect(0, 27, 60, 1, CYAN[3])
  c.rect(5, 30, 50, 10, ACIER[1])
  c.rect(6, 31, 48, 8, '#E4F0F6')
  c.rect(6, 31, 48, 1, '#FFFFFF')
  c.rect(6, 38, 48, 1, '#BCD0DC')
  for (const [x, y] of [[7, 32], [52, 32], [7, 37], [52, 37]] as const) c.set(x, y, CYAN[2])
  const bad = state === 'failed', off = state === 'rest'
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
  c.rect(42, 17, 6, 6, INK)
  c.rect(43, 17, 4, 5, COQUE[1])
  c.rect(43, 17, 4, 1, '#5A3A22')
  c.rect(43, 18, 1, 4, COQUE[0])
  c.rect(46, 18, 1, 4, COQUE[3])
  c.rect(48, 18, 1, 3, INK)
  c.rect(41, 23, 8, 1, CYAN[4])
  c.rect(29, 21, 10, 5, ACIER[0])
  c.rect(30, 22, 8, 3, CYAN[1])
  c.rect(31, 22, 5, 1, CYAN[4])
  c.rect(31, 24, 3, 1, MAGENTA[3])
  disc(c, 54, 16, 3.6, 3.6, (x, y, d) => (d > 0.6 ? CYAN[3] : (x + y) % 2 ? CYAN[2] : CYAN[4]))
  c.rect(51, 21, 7, 1, `${CYAN[4]}|0.5`)
  c.rect(50, 22, 9, 2, ACIER[3])
  c.rect(50, 22, 9, 1, ACIER[5])
  return c
}

/** A screen of light, projected by its base. */
export function tele() {
  const c = canvas(36, 30)
  for (let y = 23; y < 27; y += 1) {
    const hw = 7 + (26 - y) * 3.2
    c.rect(Math.round(18 - hw), y, Math.round(hw * 2), 1, `${CYAN[4]}|0.18`)
  }
  for (let y = 1; y < 24; y += 1) {
    const cut = Math.max(0, 3 - (y - 1), 3 - (23 - y))
    for (let x = 1 + cut; x < 35 - cut; x += 1) c.set(x, y, y % 2 ? '#062430|0.88' : '#08303C|0.88')
  }
  for (const [x, w] of [[4, 7], [25, 7]] as const) {
    c.rect(x, 1, w, 1, CYAN[4])
    c.rect(x, 23, w, 1, CYAN[3])
  }
  for (const [x, y] of [[1, 4], [34, 4]] as const) c.rect(x, y, 1, 4, CYAN[4])
  for (const [x, y] of [[1, 17], [34, 17]] as const) c.rect(x, y, 1, 4, CYAN[3])
  for (const [x, y] of [[3, 2], [2, 3], [32, 2], [33, 3], [3, 22], [2, 21], [32, 22], [33, 21]] as const) c.set(x, y, CYAN[5])
  disc(c, 18, 27.4, 8.6, 2.4, (x, y) => (y < 27 ? ACIER[4] : ACIER[2]))
  c.rect(11, 26, 14, 1, CYAN[5])
  c.rect(13, 29, 10, 1, ACIER[0])
  c.set(14, 28, MAGENTA[3])
  c.set(22, 28, '#7FE0C8')
  return c
}

export function plaque() {
  const c = canvas(36, 12)
  for (let y = 3; y < 11; y += 1) {
    const cut = Math.max(0, 2 - (y - 3), 2 - (10 - y))
    for (let x = 0 + cut; x < 36 - cut; x += 1) c.set(x, y, y % 2 ? '#2A1A08|0.88' : '#35220A|0.88')
  }
  c.rect(4, 3, 8, 1, AMBRE[3])
  c.rect(24, 3, 8, 1, AMBRE[3])
  c.rect(4, 10, 28, 1, AMBRE[1])
  c.rect(0, 5, 1, 4, AMBRE[3])
  c.rect(35, 5, 1, 4, AMBRE[3])
  c.set(2, 4, AMBRE[4])
  c.set(33, 4, AMBRE[4])
  for (const x of [17, 18]) c.rect(x, 0, 1, 3, `${AMBRE[3]}|0.5`)
  c.rect(14, 0, 8, 1, `${AMBRE[3]}|0.8`)
  return c
}

/** A panel of light, projected by a bar, in pixels of the room: the lines stay clear on it. */
export function tableau(w: number, h: number) {
  const c = canvas(w + 4, h + 8)
  for (let y = h + 2; y < h + 4; y += 2) c.rect(26, y, w - 52, 2, `${CYAN[4]}|0.2`)
  for (let y = 2; y < h + 2; y += 2) {
    const cut = Math.max(0, 10 - (y - 2), 10 - (h - y))
    for (let x = cut; x < w - cut; x += 2) {
      c.rect(x, y, 2, 2, (y / 2) % 2 ? '#071E2C|0.92' : '#0A2636|0.92')
    }
  }
  c.rect(10, 14, w - 20, h - 20, '#0A2230')
  for (let i = 0; i < 4; i += 1) for (const [x, y] of [[0, 12], [w - 2, 12], [0, h - 16], [w - 2, h - 16]] as const) c.rect(x, y + i * 2 + (y < 40 ? 0 : -2), 2, 2, CYAN[4])
  for (const [x, l] of [[12, 34], [w - 46, 34]] as const) {
    c.rect(x, 2, l, 2, CYAN[4])
    c.rect(x, h, l, 2, CYAN[3])
  }
  for (const [x, y] of [[8, 4], [6, 6], [4, 8], [w - 10, 4], [w - 8, 6], [w - 6, 8], [8, h - 2], [6, h - 4], [4, h - 6], [w - 10, h - 2], [w - 8, h - 4], [w - 6, h - 6]] as const) c.rect(x, y, 2, 2, CYAN[5])
  c.rect(10, 8, 34, 2, `${CYAN[3]}|0.6`)
  c.rect(w - 22, 8, 12, 2, MAGENTA[3])
  c.rect(w - 28, 8, 4, 2, AMBRE[3])
  c.rect(26, h + 4, w - 52, 4, ACIER[2])
  c.rect(26, h + 4, w - 52, 2, ACIER[5])
  c.rect(30, h + 4, w - 60, 2, CYAN[5])
  return c
}
const anneau = (c: C, cx: number, cy: number, a: number, b: number, rot: number, front: boolean, c1: string, c2: string, c3: string) => {
  const [cr, sr] = [Math.cos(rot), Math.sin(rot)]
  for (let t = 0; t < 6.3; t += 0.012) {
    if ((Math.sin(t) > 0) !== front) continue
    const [u, v] = [Math.cos(t) * a, Math.sin(t) * b]
    const [x, y] = [Math.round(cx + u * cr - v * sr), Math.round(cy + u * sr + v * cr)]
    c.set(x, y + 1, c3)
    c.set(x, y, c2)
    c.set(x, y - 1, c1)
  }
}

/** The core on the stove's grid, with the back half of its rings. */
export function noyauSprite() {
  const c = canvas(48, 68)
  disc(c, 24, 62, 21, 4.4, SH)
  disc(c, 24, 59, 18, 3.6, (x, y) => (y < 59 ? ACIER[4] : ACIER[2]))
  disc(c, 24, 57, 13, 2.8, (x, y) => (y < 57 ? ACIER[5] : ACIER[3]))
  disc(c, 24, 55.4, 7, 1.8, CYAN[4])
  c.rect(7, 60, 34, 1, CYAN[2])
  for (let x = 10; x < 40; x += 6) c.set(x, 61, CYAN[4])
  for (const s of [-1, 1]) for (let y = 22; y < 56; y += 1) {
    const t = (y - 22) / 34
    const x = 24 + s * Math.round(23 - 26 * (t - 0.5) ** 2 - 6.5 * (t > 0.86 ? (t - 0.86) * 7 : 0))
    c.set(x, y, ACIER[3])
    c.set(x - s, y, ACIER[5])
    c.set(x + s, y, ACIER[1])
    if (y % 7 === 0) {
      c.set(x, y, CYAN[4])
      c.set(x - s, y, CYAN[5])
    }
  }
  disc(c, 24, 18, 9, 3, (x, y) => (y < 18 ? ACIER[5] : ACIER[2]))
  c.rect(16, 20, 17, 1, CYAN[4])
  c.rect(21, 13, 6, 3, ACIER[3])
  c.rect(21, 13, 6, 1, ACIER[5])
  c.rect(23, 9, 2, 4, ACIER[4])
  c.set(23, 8, '#FF5A6E')
  for (let y = 22; y < 31; y += 1) c.rect(22, y, 4, 1, `${CYAN[4]}|${0.34 - (y - 22) * 0.03}`)
  anneau(c, 24, 40.5, 21, 6, -0.32, false, COQUE[0], COQUE[2], COQUE[4])
  anneau(c, 24, 40.5, 19, 7, 0.46, false, CYAN[5], CYAN[3], CYAN[1])
  return c
}

/** The plasma: it shows between the two halves of the rings. */
export function noyauFeu(niveau: FireLevel, image: number) {
  const c = canvas(48, 68)
  const [cx, cy, ph] = [24, 40.5, image * 2.1]
  const orbe = (r: number, a: string, b: string, d: string, e: string, f: string) => disc(c, cx, cy, r, r, (x, y, k) => {
      const n = Math.sin(x * 1.3 + y + ph) + Math.sin(y * 1.1 - x * 0.6 + ph * 0.7)
      return k > 0.72 ? (n > 0 ? a : b) : k > 0.4 ? (n > 0.4 ? d : e) : k > 0.14 ? f : '#FFFFFF'
  })
  const braise = (pts: readonly (readonly [
        number,
        number,
        string
    ])[]) => {
    for (const [x, y, col] of pts) c.set(x, y, col)
  }
  if (niveau === 'full') {
    disc(c, 24, 62, 15, 2.4, `${CYAN[4]}|0.22`)
    lueur(c, cx, cy, 17, 16, VIOLET[3], 0.1)
    disc(c, cx, cy, 10, 10, `${MAGENTA[3]}|0.3`)
    orbe(8, MAGENTA[3], VIOLET[2], MAGENTA[4], CYAN[4], CYAN[5])
    for (const [x, y] of [[13, 30], [35, 29], [11, 46], [37, 47], [24, 28]] as const) {
      const [a, b] = image ? [x + (image * 3) % 5 - 2, y + image * 2 - 3] : [x, y]
      c.set(a, b, MAGENTA[4])
      c.set(a + 1, b + 1, CYAN[5])
    }
  }
  if (niveau === 'medium') {
    disc(c, 24, 62, 10, 1.8, `${CYAN[4]}|0.14`)
    lueur(c, cx, cy, 12, 12, VIOLET[3], 0.08)
    orbe(6, VIOLET[2], VIOLET[1], MAGENTA[3], CYAN[3], CYAN[4])
    braise([[15 + image, 33, MAGENTA[3]], [33 - image, 47, CYAN[4]]])
  }
  if (niveau === 'low') {
    lueur(c, cx, cy, 8, 8, VIOLET[2], 0.08)
    disc(c, cx, cy, 4 - image * 0.6, 4 - image * 0.6, (x, y, k) => (k > 0.55 ? VIOLET[1] : k > 0.18 ? VIOLET[2] : MAGENTA[3]))
    braise([[24, 40, CYAN[4]], [23 + image, 41, VIOLET[3]]])
  }
  if (niveau === 'embers') braise(image ? [[22, 42, MAGENTA[2]], [25, 39, VIOLET[3]], [27, 42, MAGENTA[1]], [24, 44, VIOLET[2]], [20, 39, VIOLET[1]]] : [[23, 41, VIOLET[3]], [26, 42, MAGENTA[2]], [21, 43, MAGENTA[1]], [25, 38, VIOLET[2]], [28, 40, VIOLET[1]]])
  if (niveau === 'out' && image) braise([[19, 35, '#9DB4FF'], [17, 37, '#5E6A9E'], [20, 37, '#5E6A9E']])
  return c
}

/** Spent crystals at the foot of the core, on the grid of `ash`. */
export function residu(niveau: AshLevel, image: number) {
  const c = canvas(48, 20)
  const nb = { none: 0, small: 3, medium: 6, large: 10, full: 15 }[niveau]
  if (!nb) return c
  const eclat = (x: number, b: number, h: number, w: number, t: 0 | 1 | 2) => {
    for (let i = 0; i < h; i += 1) {
      const hw = Math.round(w * (1 - i / h))
      c.rect(x - hw, b - i, hw + 1, 1, ([ACIER[5], VIOLET[1], '#6A7AA8'] as const)[t])
      c.rect(x + 1, b - i, hw, 1, ([ACIER[3], VIOLET[0], ACIER[4]] as const)[t])
    }
    c.set(x, b - h + 1, ([CYAN[4], VIOLET[3], CYAN[5]] as const)[t])
  }
  const tas: readonly (readonly [number, number, number, number, 0 | 1 | 2])[] = [[22, 15, 7, 3, 0], [27, 16, 5, 2, 1], [18, 16, 4, 2, 2], [31, 15, 8, 3, 2], [13, 15, 7, 3, 1], [24, 17, 6, 3, 2], [36, 16, 6, 3, 0], [9, 16, 5, 2, 0], [17, 18, 6, 3, 0], [30, 18, 6, 3, 1], [25, 12, 8, 3, 1], [41, 17, 5, 2, 2], [5, 17, 4, 2, 1], [20, 12, 9, 3, 2], [35, 12, 7, 3, 0]]
  disc(c, 23, 17, 3 + nb * 1.3, 1.6 + nb * 0.12, SH)
  const pris = tas.slice(0, nb).sort((a, b) => a[1] - b[1])
  for (const [x, b, h, w, t] of pris) eclat(x, b, h, w, t)
  if (niveau === 'full') for (const [x, y] of (image ? [[16, 2], [29, 0], [37, 3]] : [[20, 1], [33, 2], [12, 4]]) as readonly (readonly [number, number])[]) {
    c.set(x, y, `${CYAN[5]}|0.6`)
    c.set(x + 1, y + 1, `${MAGENTA[4]}|0.5`)
  }
  return c
}

/** The front half of the rings, over the plasma. */
export function noyauAvant() {
  const c = canvas(48, 68)
  anneau(c, 24, 40.5, 21, 6, -0.32, true, COQUE[0], COQUE[2], COQUE[4])
  anneau(c, 24, 40.5, 19, 7, 0.46, true, CYAN[5], CYAN[3], CYAN[1])
  for (const a of [0.6, 2.4]) {
    const [u, v] = [Math.cos(a) * 21, Math.sin(a) * 6]
    c.rect(Math.round(24 + u * 0.95 + v * 0.31) - 1, Math.round(40.5 - u * 0.31 + v * 0.95) - 1, 3, 3, AMBRE[3])
  }
  return c
}
