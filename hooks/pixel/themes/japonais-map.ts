import { t } from '../../i18n'
import { canvas, mix, noise, paths } from '../canvas'
import type { Canvas } from '../canvas'
import { caseEtape } from '../decor'
import { fit, textWidth } from '../font'
import type { Point } from '../hearth'
import { WORLD, pattern, pick } from '../pack'
import type { MapPack, MapRoom, MapView } from '../pack'
import { TENUES, person } from '../sprites'
import type { DeskState } from '../sprites'
import { def, line, use } from '../text'
import { japonais } from './japonais'

type C = Canvas
type Paint = string | ((x: number, y: number, d: number) => string | null)

const WASHI = ['#FFF8E8', '#F4ECD8', '#E4D6B6', '#CDBB96'] as const
const CEDAR = ['#201214', '#34201E', '#4C2E28', '#6A4234', '#8C5E46', '#B0825E'] as const
const HINOKI = ['#6E5034', '#8E6E48', '#B09064', '#D0B284', '#E8D2A6'] as const
const LAQUE = ['#5E1A1A', '#8A2822', '#B23A2E', '#D85A44', '#F08A68'] as const
const SUMI = ['#16141C', '#24222C', '#35323E', '#4A4654'] as const
const OR = ['#8C6A2E', '#C9A24A', '#E8C868', '#FFE08A'] as const
const NUIT = ['#1A2248', '#24305A', '#2F3E70', '#3F5288', '#5A70A8', '#8CA0CC'] as const
const TUILE = ['#14162A', '#1C2038', '#262B48', '#343A5C', '#4A5278'] as const
const CREME = '#F4E4C1'
const ECRAN = '#EDFFF5'
const [PLAQUE_BORD, PLAQUE, PLAQUE_REPOS] = ['#4A2C2A', '#7A4A32', '#4F4560']
// The engine dims the count of a room at rest: its plate goes darker to keep it legible.
const COMPTE_REPOS = '#241F38'
const [ETAT, ETAT_REPOS] = ['#FFC857', '#C9BEDB']

const disc = (c: C, cx: number, cy: number, rx: number, ry: number, paint: Paint) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d > 1) continue
      const p = typeof paint === 'string' ? paint : paint(x, y, d)
      if (p) c.set(x, y, p)
    }
  }
}
const nappe = (c: C, x: number, y: number, w: number, p: string) => {
  c.rect(x + 3, y, w - 6, 1, p)
  c.rect(x, y + 1, w, 2, p)
  c.rect(x + 5, y + 3, w - 12, 1, p)
}
const miroir = (s: C) => {
  const c = canvas(s.w, s.h)
  for (let y = 0; y < s.h; y += 1) for (let x = 0; x < s.w; x += 1) c.set(x, y, s.get(s.w - 1 - x, y))
  return c
}

// The sky runs past the world, band by band: a wide pane shows more night, not a frame.
const CIEL = [[0, '#0C1028'], [36, '#10163A'], [76, '#141C44'], [120, '#19234E'], [168, '#1F2B5A'], [224, '#263464'], [356, '#0E1430']] as const
const AU_DELA = 3000

function ciel() {
  return CIEL.map(([y, p], i) => {
    const top = i ? y * 2 : -AU_DELA
    return `<rect x="${-AU_DELA}" y="${top}" width="${WORLD.w + 2 * AU_DELA}" height="${(CIEL[i + 1]?.[0] ?? y + 12) * 2 - top}" fill="${p}"/>`
  }).join('')
}

/** What shows round the house: stars, the moon, the mountain, the mist and the pond. */
function astres() {
  const c = canvas(390, 380)
  for (let i = 0; i < 40; i += 1) {
    const [x, y] = [Math.floor(noise(i, 11) * 390), Math.floor(noise(i, 12) * 150)]
    c.set(x, y, i % 5 === 0 ? OR[3] : i % 2 ? WASHI[1] : NUIT[5])
  }
  disc(c, 24, 30, 15, 15, '#2A3560')
  disc(c, 24, 30, 12, 12, WASHI[0])
  disc(c, 20, 26, 3, 3, WASHI[2])
  disc(c, 29, 34, 4, 3, WASHI[2])
  disc(c, 27, 23, 2, 2, WASHI[2])
  for (let y = 38; y < 262; y += 2) {
    const half = Math.round((y - 38) * 0.74)
    const left = y > 64 ? Math.max(338, 366 - half) : Math.max(316, 366 - half)
    c.rect(left, y, 366 - left, 2, '#2A3866')
    c.rect(366, y, half, 2, '#232F5A')
  }
  for (let dx = -26; dx < 26; dx += 2) {
    const teeth = 24 + Math.round(9 * Math.abs(Math.sin(dx * 0.42)))
    const y0 = 38 + Math.round(Math.abs(dx) / 0.74)
    if (y0 < 38 + teeth) c.rect(366 + dx, y0, 2, 38 + teeth - y0, dx < 0 ? WASHI[1] : WASHI[3])
  }
  for (let x = 0; x < 60; x += 4) {
    const h = Math.round(26 + 8 * Math.sin(x * 0.09) + 3 * Math.sin(x * 0.31))
    c.rect(x, 262 - h, 4, h, '#1B2650')
  }
  for (const [x, y, w, p] of [[-4, 86, 70, '#3F4A78'], [20, 96, 52, '#34406E'], [336, 112, 64, '#46527E'], [312, 124, 90, '#3A4674'], [348, 196, 60, '#3F4A78'], [-6, 210, 56, '#34406E'], [340, 212, 56, '#34406E']] as const) nappe(c, x, y, w, p)
  for (let i = 0; i < 16; i += 1) c.rect(Math.floor(noise(i, 21) * 380), 360 + Math.floor(noise(i, 22) * 19), 6 + Math.floor(noise(i, 23) * 12), 1, i % 3 ? '#182048' : '#26305C')
  c.rect(0, 356, 390, 1, '#141C40')
  for (const [x, w, y] of [[0, 34, 372], [8, 22, 368], [352, 38, 372], [366, 24, 367]] as const) {
    c.rect(x, y, w, 380 - y, '#1E3A30')
    c.rect(x + 2, y, w - 4, 1, '#2F5A42')
  }
  return c
}

/** The twisted pine, on the eaves of the left. */
function pin() {
  const c = canvas(46, 76)
  for (const [x0, y0, x1, y1] of [[22, 75, 21, 56], [21, 56, 26, 42], [26, 42, 20, 28], [26, 42, 36, 32], [21, 56, 11, 48]] as const) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let i = 0; i <= n; i += 1) {
      const [x, y] = [Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)]
      c.rect(x, y, 3, 1, CEDAR[1])
      c.set(x, y, CEDAR[3])
    }
  }
  const nuage = (cx: number, cy: number, rx: number, ry: number) => {
    disc(c, cx, cy + 1, rx, ry, '#142E2A')
    disc(c, cx, cy, rx, ry - 0.6, '#2F5D46')
    disc(c, cx - 1, cy - 1.4, rx - 3, ry - 2, '#4E8A50')
  }
  nuage(10, 46, 10, 5)
  nuage(36, 30, 10, 5)
  nuage(20, 24, 14, 6.4)
  nuage(22, 10, 9, 4.4)
  return c
}

const sori = (t: number) => Math.round(7 * t ** 3)

// The tiles of a roof are one fill: laying them column by column costs 10 000 characters.
const couvert = (c: C) => paths(c).replace(`fill="${TUILE[1]}"`, 'fill="url(#cote)"').replace(`fill="${OR[0]}"`, 'fill="url(#egout)"')

function toit() {
  const [W, H] = [318, 60]
  const c = canvas(W, H)
  const [bas, top, mid] = [52, 12, W / 2]
  for (let x = 0; x < W; x += 1) {
    const k = Math.abs(x - mid) / mid
    const yTop = k < 0.44 ? top : Math.round(top + ((k - 0.44) / 0.56) * (bas - top - 8))
    const yBas = bas - sori(k)
    if (yBas <= yTop) continue
    c.rect(x, yTop, 1, yBas - yTop, TUILE[1])
    c.rect(x, yTop, 1, 1, TUILE[4])
    c.rect(x, yBas, 1, 3, OR[0])
    c.rect(x, yBas, 1, 1, OR[1])
    c.rect(x, yBas + 3, 1, 3, TUILE[0])
  }
  const [xa, xb] = [Math.round(mid * 0.56), Math.round(mid * 1.44)]
  c.rect(xa, 8, xb - xa, 4, TUILE[3])
  c.rect(xa, 8, xb - xa, 1, TUILE[4])
  c.rect(xa, 11, xb - xa, 1, TUILE[0])
  for (const x of [xa - 3, xb - 5]) {
    c.rect(x, 4, 8, 8, TUILE[3])
    c.rect(x + 1, 2, 6, 2, OR[1])
    c.rect(x + 1, 2, 6, 1, OR[3])
    c.rect(x + 3, 0, 2, 2, OR[2])
  }
  // Rows of tiles, only where there is roof to lie on.
  const rangs = canvas(W, H)
  for (let y = top + 6; y < bas - 2; y += 6) for (let x = 0; x < W; x += 1) if (c.get(x, y) === TUILE[1]) rangs.set(x, y, '#0C0E1E|0.5')
  return `<g transform="scale(2)">${couvert(c)}${paths(rangs)}</g>`
}

function pignon() {
  const [W, H] = [120, 40]
  const c = canvas(W, H)
  const mid = W / 2
  for (let y = 2; y < 32; y += 1) {
    const hw = Math.round((y - 2) * 1.5) + 4
    c.rect(mid - hw - 3, y, 3, 1, CEDAR[3])
    c.rect(mid - hw, y, hw * 2, 1, CEDAR[1])
    c.rect(mid + hw, y, 3, 1, CEDAR[3])
  }
  c.rect(mid - 52, 31, 104, 3, CEDAR[3])
  c.rect(mid - 52, 31, 104, 1, OR[1])
  disc(c, mid, 19, 7, 7, OR[1])
  disc(c, mid, 19, 5, 5, LAQUE[2])
  disc(c, mid, 19, 2, 2, OR[3])
  return c
}

function auvent(w: number) {
  const c = canvas(w, 14)
  for (let x = 0; x < w; x += 1) {
    const e = Math.min(x, w - 1 - x)
    const up = e < 6 ? Math.round((6 - e) ** 2 / 9) : 0
    const [top, b] = [2, 11 - up]
    if (b <= top) continue
    c.rect(x, top, 1, b - top, TUILE[1])
    c.rect(x, top, 1, 1, TUILE[3])
    c.rect(x, b, 1, 2, OR[0])
    c.rect(x, b, 1, 1, OR[1])
    c.rect(x, b + 2, 1, 1, TUILE[0])
  }
  return `<g transform="scale(2)">${paths(c).replace(`fill="${TUILE[1]}"`, 'fill="url(#cote)"')}</g>`
}

/** The engawa: waxed boards on top, the beam in front where a room's state is written. */
function galerie(w: number) {
  const c = canvas(w, 13)
  c.rect(0, 0, w, 4, '#7A5238')
  c.rect(0, 0, w, 1, HINOKI[2])
  for (let i = 0, x = 6; x < w; i += 1, x += 22 + Math.floor(noise(i, 9) * 18)) c.rect(x, 1, 1, 3, CEDAR[2])
  c.rect(0, 4, w, 8, CEDAR[1])
  c.rect(0, 4, w, 1, CEDAR[0])
  c.rect(0, 5, w, 1, CEDAR[3])
  c.rect(0, 11, w, 1, CEDAR[2])
  c.rect(0, 12, w, 1, CEDAR[0])
  return c
}

function pilotis() {
  const c = canvas(6, 24)
  c.rect(1, 0, 4, 21, CEDAR[1])
  c.rect(1, 0, 1, 21, CEDAR[3])
  c.rect(4, 0, 1, 21, CEDAR[0])
  c.rect(0, 20, 6, 1, '#26305C')
  c.rect(1, 22, 4, 1, CEDAR[0])
  return c
}

/** The steep stairs, in section: two flights that cross, one above the other, to repeat up the tower. */
function escalier() {
  const [W, H, TUILEE] = [17, 96, 36]
  const c = canvas(W, H)
  c.rect(0, 0, W, H, '#1A1420')
  c.rect(2, 0, W - 4, H, '#241A24')
  for (let v = 0; v < 5; v += 1) {
    const y0 = H - 2 - v * 18
    for (let i = 0; i < 6; i += 1) {
      const x = v % 2 ? 12 - i * 2 : 2 + i * 2
      c.rect(x, y0 - i * 3, 3, 1, HINOKI[1])
      c.set(x, y0 - i * 3, HINOKI[3])
      c.rect(x, y0 - i * 3 + 1, 3, 2, CEDAR[1])
    }
    c.rect(v % 2 ? 2 : 10, y0 - 18, 5, 1, HINOKI[0])
  }
  c.rect(0, 0, 2, H, CEDAR[2])
  c.rect(0, 0, 1, H, CEDAR[4])
  c.rect(W - 2, 0, 2, H, CEDAR[2])
  c.rect(W - 1, 0, 1, H, CEDAR[0])
  const tuile = canvas(W, TUILEE)
  for (let y = 0; y < TUILEE; y += 1) for (let x = 0; x < W; x += 1) tuile.set(x, y, c.get(x, y + TUILEE))
  return miroir(tuile)
}

function coiffe() {
  const c = canvas(27, 11)
  for (let y = 0; y < 8; y += 1) {
    const hw = Math.round(3 + y * 1.4 + (y > 5 ? 2 : 0))
    c.rect(13 - hw, y, hw * 2 + 1, 1, y === 0 ? TUILE[3] : y % 2 ? TUILE[1] : TUILE[2])
  }
  c.rect(0, 8, 27, 1, OR[1])
  c.rect(1, 9, 25, 2, TUILE[0])
  c.rect(11, 0, 5, 1, OR[2])
  return c
}

/** The rail of the bridges, one baluster: a rail of any length repeats it. */
function rambarde() {
  const c = canvas(7, 10)
  c.rect(0, 5, 7, 1, CEDAR[2])
  c.rect(0, 2, 2, 8, CEDAR[2])
  c.rect(0, 2, 1, 8, CEDAR[4])
  c.rect(0, 0, 7, 2, CEDAR[3])
  c.rect(0, 0, 7, 1, CEDAR[5])
  return c
}

function poteau() {
  const c = canvas(4, 4)
  c.rect(0, 0, 4, 4, CEDAR[2])
  c.rect(0, 0, 1, 4, CEDAR[4])
  c.rect(3, 0, 1, 4, CEDAR[0])
  return c
}

/** The shoji between two rooms, one bar of paper high, lit or dark. */
function cloison(allume: boolean) {
  const [W, H] = [8, 9]
  const c = canvas(W, H)
  const [a, b, k] = allume ? ['#F2DFB4', '#E8CE96', CEDAR[3]] : ['#2C3760', '#262F56', CEDAR[1]]
  c.rect(2, 0, 4, H, a)
  c.rect(4, 0, 2, H, b)
  c.rect(2, 4, 4, 1, k)
  c.rect(4, 0, 1, H, k)
  c.rect(0, 0, 2, H, CEDAR[2])
  c.rect(0, 0, 1, H, CEDAR[4])
  c.rect(6, 0, 2, H, CEDAR[2])
  c.rect(7, 0, 1, H, CEDAR[0])
  return c
}

function seigaiha(base: string, ring: string, edge: string) {
  const [w, h, R] = [20, 10, 10]
  const c = canvas(w, h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let color = base
      for (let r = -2; r < 6; r += 1) {
        const off = r % 2 ? 10 : 0
        for (let k = -1; k < 3; k += 1) {
          const d = Math.hypot(x - (k * 20 + off), y - r * 5)
          if (d > R) continue
          color = d > R - 1 ? edge : (d > R - 3.2 && d <= R - 2.2) || (d > R - 5.8 && d <= R - 4.8) ? ring : base
        }
      }
      c.set(x, y, color)
    }
  }
  return c
}

function ichimatsu(a: string, b: string, fleck: string) {
  const c = canvas(24, 24)
  c.rect(0, 0, 24, 24, a)
  c.rect(12, 0, 12, 12, b)
  c.rect(0, 12, 12, 12, b)
  for (let i = 0; i < 40; i += 1) c.set(Math.floor(noise(i, 31) * 24), Math.floor(noise(i, 32) * 24), fleck)
  return c
}

function asanoha(base: string, encre: string) {
  const [w, h] = [18, 32]
  const c = canvas(w, h)
  c.rect(0, 0, w, h, base)
  const boucle = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2
    for (let i = 0; i <= n; i += 1) c.set(((Math.round(x0 + ((x1 - x0) * i) / n) % w) + w) % w, ((Math.round(y0 + ((y1 - y0) * i) / n) % h) + h) % h, encre)
  }
  const tri = (a: readonly [number, number], b: readonly [number, number], d: readonly [number, number]) => {
    const m = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3] as const
    for (const p of [a, b, d]) boucle(p[0], p[1], m[0], m[1])
    boucle(a[0], a[1], b[0], b[1])
    boucle(b[0], b[1], d[0], d[1])
    boucle(d[0], d[1], a[0], a[1])
  }
  tri([0, 0], [18, 0], [9, 16])
  tri([0, 32], [18, 32], [9, 16])
  tri([0, 0], [9, 16], [-9, 16])
  tri([0, 32], [9, 16], [-9, 16])
  return c
}

function planches() {
  const c = canvas(150, 60)
  const tones = ['#6A4636', '#724C3A', '#624032', '#6E4A38', '#5E3C30'] as const
  for (let row = 0; row < 6; row += 1) {
    const y = row * 10
    const off = [0, 62, 28, 96, 44, 118][row]!
    for (let i = -1; i < 3; i += 1) {
      const x = off + i * 75
      const base = tones[Math.floor(noise(i + row * 7 + 4, 5) * 5)]!
      for (let px = x; px < x + 75; px += 1) c.rect(((px % 150) + 150) % 150, y, 1, 9, base)
      for (let g = 0; g < 5; g += 1) {
        const gx = x + 4 + Math.floor(noise(i + g, row + 40) * 56)
        const gy = y + 1 + Math.floor(noise(g + 2, i + row) * 7)
        const len = 6 + Math.floor(noise(i, g + row) * 14)
        for (let k = 0; k < len; k += 1) c.set((((gx + k) % 150) + 150) % 150, gy, mix(base, '#3E2620', 0.34))
      }
      const joint = (((x + 74) % 150) + 150) % 150
      c.rect(joint, y, 1, 9, '#38221C')
      c.rect((joint + 1) % 150, y, 1, 9, mix(base, '#A07858', 0.3))
    }
    c.rect(0, y, 150, 1, '#84604A')
    c.rect(0, y + 9, 150, 1, '#38221C')
  }
  return c
}

function tatami() {
  const c = canvas(120, 64)
  const tones = ['#7E7C50', '#78764C', '#84824F', '#747248'] as const
  const nat = (x: number, y: number, w: number, h: number, long: boolean, s: number) => {
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
  nat(0, 0, 64, 32, false, 1)
  nat(0, 32, 64, 32, false, 2)
  nat(64, 0, 32, 64, true, 3)
  nat(96, 0, 24, 64, true, 0)
  return c
}

/** The cedar under the paper. `h`: 8 in a room, 12 in the great hall. */
function lambris(h: number) {
  const c = canvas(44, h)
  c.rect(0, 0, 44, h, CEDAR[2])
  for (let x = 0; x < 44; x += 11) {
    c.rect(x + 1, 2, 10, h - 3, mix(CEDAR[2], CEDAR[3], noise(x, 7) * 0.7))
    c.rect(x, 2, 1, h - 3, CEDAR[0])
  }
  c.rect(0, 0, 44, 1, HINOKI[4])
  c.rect(0, 1, 44, 1, HINOKI[2])
  c.rect(0, h - 1, 44, 1, CEDAR[0])
  return c
}

/** The lit lattice over the walls. */
function ranma() {
  const c = canvas(4, 9)
  c.rect(0, 0, 4, 9, CEDAR[1])
  c.rect(0, 0, 4, 1, CEDAR[3])
  c.rect(0, 2, 4, 5, '#E8B868')
  c.rect(0, 2, 1, 5, CEDAR[2])
  c.set(2, 4, CEDAR[2])
  c.rect(0, 7, 4, 2, CEDAR[2])
  c.rect(0, 8, 4, 1, CEDAR[0])
  return c
}

/** A room at rest, two panels of it: the shoji closed, the moon on them, no light left. */
function repos() {
  const [w, h, pw] = [42, 70, 21]
  const c = canvas(w, h)
  c.rect(0, 0, w, h, '#2C3760')
  c.rect(0, 0, w, 30, '#333F6C')
  for (let x = 6; x < w; x += 7) c.rect(x, 9, 1, h - 21, '#232C50')
  for (let y = 18; y < h - 12; y += 9) c.rect(0, y, w, 1, '#232C50')
  c.rect(0, h - 12, w, 12, CEDAR[1])
  for (let i = 0; i < 2; i += 1) {
    const x = i * pw
    c.rect(x, 9, 2, h - 9, CEDAR[2])
    c.rect(x, 9, 1, h - 9, CEDAR[3])
    c.rect(x + 3, h - 10, pw - 5, 8, CEDAR[2])
    c.rect(i % 2 ? x + 2 : x + pw - 3, 40, 2, 4, SUMI[2])
  }
  c.rect(0, 0, w, 9, CEDAR[1])
  c.rect(0, 0, w, 1, CEDAR[2])
  c.rect(0, 2, w, 5, '#1E2748')
  for (let x = 0; x < w; x += 4) c.rect(x, 2, 1, 5, CEDAR[1])
  c.rect(0, 7, w, 2, CEDAR[2])
  c.rect(0, 8, w, 1, CEDAR[0])
  c.rect(0, h - 1, w, 1, CEDAR[0])
  return c
}

/** The shadow of a bamboo the moon casts on closed shoji. */
function ombreBambou() {
  const c = canvas(16, 49)
  const encre = '#20294A'
  for (const [x, y, l] of [[2, 5, 7], [8, 13, 8], [0, 21, 6], [10, 25, 7], [4, 33, 6]] as const) {
    c.rect(x, y, l, 1, encre)
    c.rect(x + 1, y + 1, l - 3, 1, encre)
  }
  c.rect(6, 0, 2, 49, encre)
  return c
}

/** What a lit room throws on the pond. */
function reflet() {
  const c = canvas(84, 20)
  for (let i = 0; i < 10; i += 1) c.rect(14 + Math.floor(noise(i, 4) * 26), i * 2, 44 - i * 4, 1, i < 4 ? '#E8B868|0.55' : i < 7 ? '#C08A50|0.42' : '#8A6440|0.3')
  return c
}

/** The mail cabinet, black and vermilion lacquer, its letter box on top. */
function casier() {
  const [W, H] = [62, 54]
  const c = canvas(W, H)
  c.rect(2, 51, W - 4, 3, '#1B1730|0.34')
  c.rect(2, 12, W - 4, 40, SUMI[1])
  c.rect(2, 12, W - 4, 1, SUMI[3])
  c.rect(2, 12, 1, 40, SUMI[3])
  c.rect(W - 3, 12, 1, 40, SUMI[0])
  c.rect(2, 51, W - 4, 1, SUMI[0])
  c.rect(0, 10, W, 3, LAQUE[2])
  c.rect(0, 10, W, 1, LAQUE[3])
  c.rect(0, 12, W, 1, LAQUE[0])
  for (let j = 0; j < 2; j += 1) {
    for (let i = 0; i < 3; i += 1) {
      const [x, y] = [5 + i * 18, 15 + j * 12]
      c.rect(x, y, 16, 10, CEDAR[0])
      c.rect(x, y, 16, 1, '#100C14')
      if ((i + j * 2) % 4 !== 3) {
        c.rect(x + 2, y + 3, 12, 7, WASHI[1])
        c.rect(x + 2, y + 3, 12, 1, WASHI[0])
        c.rect(x + 13, y + 3, 1, 7, WASHI[3])
        if (i % 2 === j % 2) {
          c.rect(x + 7, y + 5, 3, 3, LAQUE[2])
          c.set(x + 7, y + 5, LAQUE[4])
        } else c.rect(x + 4, y + 7, 7, 1, SUMI[3])
      }
      c.rect(x, y + 9, 16, 1, OR[0])
    }
  }
  c.rect(5, 39, 52, 10, LAQUE[1])
  c.rect(5, 39, 52, 1, LAQUE[3])
  c.rect(5, 48, 52, 1, LAQUE[0])
  c.rect(27, 42, 8, 3, OR[1])
  c.rect(27, 42, 8, 1, OR[3])
  c.rect(29, 45, 4, 2, OR[0])
  for (const [x, y] of [[2, 12], [W - 7, 12], [2, 47], [W - 7, 47]] as const) {
    c.rect(x, y, 5, 5, OR[1])
    c.rect(x, y, 5, 1, OR[3])
    c.set(x + 1, y + 2, OR[0])
  }
  c.rect(6, 1, 34, 9, SUMI[1])
  c.rect(6, 1, 34, 1, SUMI[3])
  c.rect(6, 3, 34, 1, OR[1])
  c.rect(6, 9, 34, 1, SUMI[0])
  c.rect(20, 1, 6, 9, LAQUE[2])
  c.rect(20, 1, 1, 9, LAQUE[3])
  c.rect(21, 4, 4, 3, OR[2])
  return c
}

function lanterne() {
  const c = canvas(16, 20)
  disc(c, 8, 10, 8, 9.5, '#FFB868|0.12')
  disc(c, 8, 10, 6, 7, '#FFB868|0.16')
  c.rect(7, 0, 2, 4, SUMI[1])
  c.rect(5, 4, 6, 1, SUMI[1])
  c.rect(4, 5, 8, 9, '#FFD890')
  c.rect(4, 5, 2, 9, '#FFF0C0')
  c.rect(10, 5, 2, 9, '#E8A050')
  c.rect(4, 8, 8, 1, '#E8A050')
  c.rect(4, 11, 8, 1, '#E8A050')
  c.rect(5, 14, 6, 1, SUMI[1])
  c.rect(7, 15, 2, 3, LAQUE[2])
  return c
}

function lettre() {
  const c = canvas(14, 10)
  c.rect(1, 2, 13, 8, '#1B1730|0.3')
  c.rect(0, 0, 13, 9, WASHI[2])
  c.rect(1, 1, 11, 7, WASHI[0])
  c.rect(1, 7, 11, 1, WASHI[2])
  c.rect(12, 1, 1, 7, WASHI[3])
  for (let i = 0; i < 6; i += 1) {
    c.set(i, Math.floor(i / 1.3), WASHI[3])
    c.set(12 - i, Math.floor(i / 1.3), WASHI[3])
  }
  c.rect(5, 3, 3, 3, LAQUE[2])
  c.set(5, 3, LAQUE[4])
  return c
}

function messager() {
  const rows = ['................', '.........hhh....', '.......hhHHHhh..', '.....hhHHHHHHHhh', '.......sSSSs....', '.......sSgSs....', '.......sSSSs....', '......bbbbbB....', '.....bBBwBBBB...', '.....bBBwBBBbss.', '.....bBBwBBB....', '......kkkkk.....', '......bBBBB.....', '.....bBB.BBb....', '....dBB...BBd...', '....dd.....dd...', '...ss.......ss..']
  const c = canvas(16, 18)
  c.sprite(rows, { h: '#B09064', H: '#E8D2A6', s: '#E0A878', S: '#F0C098', g: '#1B1730', b: '#20306A', B: '#2F4A98', w: '#E8ECF4', k: '#B23A2E', d: '#14183A' }, 0, 0)
  c.rect(1, 17, 14, 1, '#1B1730|0.34')
  return c
}

type Salle = { x: number; y: number; w: number }

const HAUT = 140
const POUTRE = 26
const CLOISON = 16
const ETAGE = 356
const REZ = 546
const SALON = { x: 87, w: 570, h: 176 }
const TELE = { x: 159, y: 20 }
// Two thirds of the size where the font is sharp: three cells fall on two pixels, and a small word stays readable.
const MOT_TELE = 12.45
// The most lines the register holds, and the seats a room shows.
const LIGNES = 7
const SIEGES = 3
const [TOUR_LARGE, TOUR_ETROITE] = [732, 665]

function rangee(n: number, y: number, x: number, w: number): Salle[] {
  // Rooms on the grid of 2 pixels: their widths differ by 2 at most when the row does not divide evenly.
  const at = (i: number) => x + Math.round((i * (w + CLOISON)) / n / 2) * 2
  return Array.from({ length: n }, (_, i) => ({ x: at(i), y, w: at(i + 1) - at(i) - CLOISON }))
}

/**
 * The hall stays on top. Up to 4 other conversations stand on one row, past that on two, the larger half on the
 * ground floor. A row of 1 or 2 rooms is 570 wide, of 3 to 5 it is 720, with the stairs at its end.
 */
function maison(n: number) {
  const autres = Math.max(0, n - 1)
  const deux = autres > 4
  const bas = deux ? Math.ceil(autres / 2) : autres
  const haut = autres - bas
  const large = bas > 2
  const hautX = haut > 3 || (haut === 3 && bas !== 4) ? 12 : haut === 3 ? 104 : 87
  const hautW = hautX === 12 ? 720 : hautX === 104 ? 536 : 570
  return {
    deux,
    large,
    hautX,
    hautW,
    salonY: deux ? 130 : 320,
    pin: deux ? (hautX > 12 ? { x: 2, y: 372 } : null) : large ? null : { x: 0, y: 592 },
    tour: large ? TOUR_LARGE : TOUR_ETROITE,
    etage: deux ? rangee(haut, ETAGE, hautX, hautW) : [],
    rez: rangee(bas, REZ, large ? 12 : 87, large ? 720 : 570),
  }
}
type Maison = ReturnType<typeof maison>

const salles = (m: Maison) => [...m.etage, ...m.rez]

const MEUBLES = { andon: { w: 30, y: 82 }, bonsai: { w: 38, y: 82 }, bambou: { w: 32, y: 72 }, dansu: { w: 50, y: 80 }, byobu: { w: 74, y: 88 } } as const
type Meuble = keyof typeof MEUBLES
const pose = (id: Meuble, x: number) => ({ id, x })
const pair = (n: number) => Math.round(n / 2) * 2
/** The wall and floor of a conversation. */
const tirage = (seed: number) => {
  const mur = pick(seed, 1, 3)
  return { mur, sol: mur === 1 ? 'tatami' : 'planches' }
}

/** Where the desks of a room stand and what keeps them company. The furniture comes from the conversation, not its place. */
function amenage(w: number, k: number, seed: number) {
  const rang = (xs: number[], y = 92) => xs.map(x => ({ x, y }))
  if (w >= 500) return { sieges: rang([136, 206, 276].slice(0, k)), meubles: [pose('byobu', 14), pose('bonsai', 372), pose('dansu', 428)] }
  if (k === 3 && w < 212) {
    const [m, pas] = w < 168 ? [4, 64] : [8, 68]
    return { sieges: [...rang([m, m + pas], 64), ...rang([m + pas / 2])], meubles: [] }
  }
  if (k < 2) {
    const v = pick(seed, 2, 3)
    if (w < 168) return { sieges: rang([4].slice(0, k)), meubles: [[pose('andon', 88)], [pose('bonsai', 84)], [pose('dansu', 78)]][v]! }
    const coins = [
      { x: 14, meubles: [pose('byobu', w - 80)] },
      { x: pair((w - 80) / 2), meubles: [pose('andon', 6), pose('bambou', w - 62)] },
      { x: pair((w - 68) / 2), meubles: [pose('bonsai', 8), pose('dansu', w - 52)] },
    ][v]!
    return { sieges: rang([coins.x].slice(0, k)), meubles: coins.meubles }
  }
  const large = k * 60 + (k - 1) * 8
  const cote = pair((w - large) / 2)
  if (cote < 30) {
    const x = Math.min(cote, 10)
    return { sieges: rang(Array.from({ length: k }, (_, i) => x + i * 68)), meubles: [] }
  }
  const gauche: Meuble = cote >= 46 && pick(seed, 3, 2) ? 'bonsai' : 'andon'
  const droite: Meuble = cote >= 58 && pick(seed, 4, 2) ? 'dansu' : 'bambou'
  return { sieges: rang(Array.from({ length: k }, (_, i) => cote + i * 68)), meubles: [pose(gauche, Math.max(4, pair((cote - MEUBLES[gauche].w) / 2))), pose(droite, w - MEUBLES[droite].w - Math.max(2, pair((cote - MEUBLES[droite].w) / 2)))] }
}

const vrai = (id: string, c: C) => `<g id="${id}">${paths(c)}</g>`
const groupe = (id: string, body: string) => `<g id="${id}">${body}</g>`
/** A tile in cells, for a drawing already scaled. */
const bandes = (id: string, tones: readonly string[]) => {
  const c = canvas(tones.length, 1)
  tones.forEach((p, x) => c.set(x, 0, p))
  return `<pattern id="${id}" width="${c.w}" height="1" patternUnits="userSpaceOnUse">${paths(c)}</pattern>`
}
const auMur = (id: string) => vrai(id, japonais.wall.items[id]!.draw())
const auSol = (id: string) => vrai(id, japonais.floor.items[id]!())
const hauteurRegistre = (lignes: number) => Math.max(68, 40 + lignes * 16)

/** Everything a world may ask for, drawn on demand: what no room needs weighs nothing. */
const DESSINS: Record<string, () => string> = {
  cote: () => bandes('cote', [TUILE[1], TUILE[1], TUILE[2], TUILE[0]]),
  egout: () => bandes('egout', [TUILE[3], TUILE[3], OR[0], OR[0]]),
  astres: () => def('astres', astres()),
  pin: () => def('pin', pin()),
  toit: () => groupe('toit', toit()),
  pignon: () => def('pignon', pignon()),
  auventLong: () => groupe('auventLong', auvent(367)),
  auventCourt: () => groupe('auventCourt', auvent(306)),
  galerie: () => pattern('galerie', galerie(40)),
  rambarde: () => pattern('rambarde', rambarde()),
  poteau: () => pattern('poteau', poteau()),
  clo0: () => pattern('clo0', cloison(false)),
  clo1: () => pattern('clo1', cloison(true)),
  pilotis: () => def('pilotis', pilotis()),
  escalier: () => pattern('escalier', escalier()),
  coiffe: () => def('coiffe', coiffe()),
  reflet: () => def('reflet', reflet()),
  lanterne: () => vrai('lanterne', lanterne()),
  casier: () => def('casier', casier()),
  torii: () => vrai('torii', japonais.tele.draw()),
  repos: () => pattern('repos', repos()),
  ombre: () => def('ombre', ombreBambou()),
  mur0: () => pattern('mur0', seigaiha('#26335F', '#34447A', '#1C2750')),
  mur1: () => pattern('mur1', ichimatsu('#5C7A5A', '#4E6C50', '#6A8A66')),
  mur2: () => pattern('mur2', asanoha('#9C4A32', '#C07050')),
  planches: () => pattern('planches', planches()),
  tatami: () => pattern('tatami', tatami()),
  lambris: () => pattern('lambris', lambris(8)),
  lambrisHaut: () => pattern('lambrisHaut', lambris(12)),
  ranma: () => pattern('ranma', ranma()),
  shoji: () => auMur('shoji'),
  kakemono: () => auMur('kakemono'),
  estampe: () => auMur('estampe'),
  chochin: () => auMur('chochin'),
  andon: () => auSol('andon'),
  bambou: () => auSol('bambou'),
  bonsai: () => auSol('bonsai'),
  dansu: () => auSol('dansu'),
  byobu: () => auSol('byobu'),
  chaise: () => vrai('chaise', japonais.seat.chair!()),
  'bureau-working': () => vrai('bureau-working', japonais.seat.desk('working')),
  'bureau-done': () => vrai('bureau-done', japonais.seat.desk('done')),
  'bureau-failed': () => vrai('bureau-failed', japonais.seat.desk('failed')),
  'bureau-rest': () => vrai('bureau-rest', japonais.seat.desk('rest')),
  messager: () => vrai('messager', messager()),
  lettre: () => vrai('lettre', lettre()),
  'case-completed': () => def('case-completed', caseEtape('completed')),
  'case-in_progress': () => def('case-in_progress', caseEtape('in_progress')),
  'case-pending': () => def('case-pending', caseEtape('pending')),
  ...Object.fromEntries(TENUES.map((tenue, i) => [`perso${i}`, () => vrai(`perso${i}`, person(tenue))])),
  ...Object.fromEntries(Array.from({ length: LIGNES }, (_, i) => hauteurRegistre(i + 1)).map(h => [`registre${h}`, () => groupe(`registre${h}`, japonais.board.art(170, h))])),
}

const prets = new Map<string, string>()
const dessin = (id: string) => {
  const done = prets.get(id)
  if (done !== undefined) return done
  const made = DESSINS[id]!()
  prets.set(id, made)
  return made
}

/** What a drawing has used so far: the sprites it needs in `defs`, the words it writes. */
function atelier() {
  const ids = new Set(['cote', 'egout'])
  const mots: string[] = []
  return {
    defs: () => [...ids].map(dessin).join(''),
    words: () => mots.join(''),
    dit(s: string) {
      mots.push(s)
      return s
    },
    sprite(id: string, x = 0, y = 0) {
      ids.add(id)
      return use(id, x, y)
    },
    /** A surface: the tile starts at its corner, so a trim falls where it should. */
    plan(id: string, x: number, y: number, w: number, h: number) {
      ids.add(id)
      return `<rect transform="translate(${x} ${y})" width="${w}" height="${h}" fill="url(#${id})"/>`
    },
  }
}
type Atelier = ReturnType<typeof atelier>
type Personne = { hue: number; state: DeskState | 'rest' }

const voile = (w: number, y: number, h: number, ink: string, alpha: string) => `<rect y="${y}" width="${w}" height="${h}" fill="${ink}" fill-opacity="${alpha}"/>`
const PLAQUE_H = 26

const plaque = (s: string, x: number, y: number, w: number, fond: string, h = PLAQUE_H) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PLAQUE_BORD}"/><rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" fill="${fond}"/>${s ? line(s, x + 7, y + Math.floor((h - 18) / 2), 16, CREME) : ''}`
const largeurPlaque = (s: string) => pair(textWidth(s, 16) + 15)

const siege = (a: Atelier, p: Personne, x: number, y: number) => `${a.sprite('chaise', x, y + 2)}${a.sprite(`perso${p.hue % TENUES.length}`, x + 22, y)}${a.sprite(`bureau-${p.state}`, x, y + 2)}`

function surplus(a: Atelier, n: number, x: number, y: number) {
  if (n <= 0) return ''
  const s = a.dit(`+ ${n}`)
  return plaque(s, x, y, largeurPlaque(s), PLAQUE, 22)
}

function registreDe(a: Atelier, v: MapView) {
  const vus = v.list.length > LIGNES ? v.list.slice(0, LIGNES - 1) : v.list
  const reste = v.list.length - vus.length
  const entrees = vus.map((l, i) => {
    const y = 34 + i * 16
    const label = a.dit(fit(l.text, 16, 112))
    const lueur = l.status === 'in_progress' ? `<rect x="16" y="${y}" width="${Math.ceil(textWidth(label, 16)) + 20}" height="16" fill="${japonais.board.glow}"/>` : ''
    return `${lueur}${a.sprite(`case-${l.status}`, 18, y + 3)}${line(label, 34, y, 16, japonais.board.inks[l.status])}`
  }).join('')
  const plus = reste ? line(a.dit(t('floor.more', { n: reste })), 34, 34 + vus.length * 16, 16, japonais.board.inks.pending) : ''
  const titre = a.dit('Conversations')
  return `<g transform="translate(263 14)">${a.sprite(`registre${hauteurRegistre(vus.length + (reste ? 1 : 0))}`)}${line(titre, 16, 14, 18, japonais.board.title)}${entrees}${plus}</g>`
}

function salon(a: Atelier, v: MapView, r: MapRoom, m: Maison) {
  const titre = a.dit(fit(r.title, 16, 125))
  const etat = a.dit(fit(r.meta, 16, 560))
  const fond = `${a.plan('mur0', 0, 18, SALON.w, 74)}${voile(SALON.w, 18, 4, '#FFC878', '.26')}${voile(SALON.w, 22, 6, '#FFC878', '.12')}${a.plan('lambrisHaut', 0, 92, SALON.w, 24)}${a.plan('tatami', 0, 116, SALON.w, 60)}${voile(SALON.w, 116, 4, '#1B1730', '.45')}${a.plan('ranma', 0, 0, SALON.w, 18)}`
  const orne = v.detail < 3 ? `${a.sprite('shoji', 17, 52)}${a.sprite('kakemono', 89, 52)}${a.sprite('chochin', 121, 50)}` : ''
  const label = a.dit(t('room.tokens'))
  const tele = `<g transform="translate(${TELE.x} ${TELE.y}) scale(2)">${a.sprite('torii')}</g>${line(label, Math.round(TELE.x + 44 - textWidth(label, MOT_TELE) / 2), TELE.y + 39, MOT_TELE, '#80E0C7')}`
  const compte = v.news.shown ? a.dit(String(v.news.shown)) : ''
  const cw = Math.ceil(textWidth(compte, 16)) + 14
  const badge = compte ? `<rect x="${557 - cw}" y="56" width="${cw}" height="22" fill="${LAQUE[0]}"/><rect x="${559 - cw}" y="58" width="${cw - 4}" height="18" fill="${LAQUE[2]}"/>${line(compte, 564 - cw, 58, 16, '#FFF6DE')}` : ''
  // The boss has his seat at work and at rest.
  const gens: Personne[] = r.people[0]?.hue === 0 ? r.people : [{ hue: 0, state: 'rest' }, ...r.people]
  const seats = gens.slice(0, SIEGES).map((p, i) => siege(a, p, 17 + i * 66, 126)).join('')
  const nom = plaque(titre, 12, 20, largeurPlaque(titre), PLAQUE)
  return `<g transform="translate(${SALON.x} ${m.salonY})">${fond}${orne}${tele}${registreDe(a, v)}${a.sprite('casier', 443, 56)}${badge}${seats}${surplus(a, gens.length - SIEGES, 215, 146)}${nom}</g>${line(etat, 93, m.salonY + SALON.h + 8, 16, ETAT)}`
}

function chambreRepos(a: Atelier, v: MapView, r: MapRoom, s: Salle, titre: string, tv: number) {
  // The plates stand as low as the counts of a lit room's screen: a count does not know the state of its room.
  const y = 29
  const ombre = v.detail < 1 ? a.sprite('ombre', pair(6 + largeurPlaque(titre) + pick(r.seed, 5, Math.max(1, tv - largeurPlaque(titre) - 22))), 18) : ''
  return `${a.plan('repos', 0, 0, s.w, HAUT)}${ombre}${plaque(titre, 6, y, largeurPlaque(titre), PLAQUE_REPOS)}${plaque('', tv, y, 44, COMPTE_REPOS)}`
}

function chambreAllumee(a: Atelier, v: MapView, r: MapRoom, s: Salle, titre: string, tv: number) {
  const { mur, sol } = tirage(r.seed)
  const w = s.w
  const fond = `${a.plan(`mur${mur}`, 0, 18, w, 42)}${voile(w, 18, 4, '#FFC878', '.26')}${voile(w, 22, 6, '#FFC878', '.12')}${a.plan('lambris', 0, 60, w, 16)}${a.plan(sol, 0, 76, w, 64)}${voile(w, 76, 4, '#1B1730', '.45')}${a.plan('ranma', 0, 0, w, 18)}`
  const { sieges, meubles } = amenage(w, Math.min(r.people.length, SIEGES), r.seed)
  const pw = largeurPlaque(titre)
  const libre = tv - 6 - pw
  const auxMurs = () => {
    if (w >= 500) return `${a.sprite('kakemono', 180, 22)}${a.sprite('estampe', 330, 28)}`
    if (w < 228 || libre < 60) return ''
    return pick(r.seed, 6, 2) ? a.sprite('kakemono', pair(6 + pw + (libre - 24) / 2), 22) : a.sprite('estampe', pair(6 + pw + (libre - 40) / 2), 28)
  }
  const objets = v.detail < 2 ? meubles.map(o => a.sprite(o.id, o.x, MEUBLES[o.id].y)).join('') : ''
  const gens = sieges.map((p, i) => siege(a, r.people[i]!, p.x, p.y)).join('')
  return `${fond}${v.detail < 1 ? auxMurs() : ''}${objets}${gens}${surplus(a, r.people.length - SIEGES, w - 40, 114)}<g transform="translate(${tv} 22)">${a.sprite('torii')}</g>${plaque(titre, 6, 22, pw, PLAQUE)}`
}

function chambre(a: Atelier, v: MapView, r: MapRoom, s: Salle) {
  const tv = s.w - 50
  const titre = a.dit(fit(r.title, 16, Math.min(tv - 26, 146)))
  const etat = line(a.dit(fit(r.meta, 16, s.w - 12)), s.x + 6, s.y + HAUT + 8, 16, r.rest ? ETAT_REPOS : ETAT)
  const corps = r.rest ? chambreRepos(a, v, r, s, titre, tv) : chambreAllumee(a, v, r, s, titre, tv)
  const nb = Math.max(1, Math.round(s.w / 190))
  const reflets = !r.rest && s.y === REZ && v.detail < 1 ? Array.from({ length: nb }, (_, i) => a.sprite('reflet', pair(s.x + ((i + 0.5) * s.w) / nb - 84), 718)).join('') : ''
  return `<g transform="translate(${s.x} ${s.y})">${corps}</g>${etat}${reflets}`
}

const linteau = (x: number, y: number) => `<rect x="${x}" y="${y}" width="34" height="4" fill="${CEDAR[3]}"/>`

/** The bones of the house: what no conversation owns. */
function charpente(a: Atelier, v: MapView, m: Maison) {
  const salonBas = m.salonY + SALON.h
  const out = [ciel()]
  if (v.detail < 4) out.push(a.sprite('astres'))
  if (v.detail < 3 && m.pin) out.push(a.sprite('pin', m.pin.x, m.pin.y))
  out.push(a.sprite('toit', 54, m.salonY - 122), a.sprite('pignon', 252, m.salonY - 104))
  for (let x = m.large ? 40 : 100; x < (m.large ? 760 : 600); x += 120) out.push(a.sprite('pilotis', x, 712))
  const poteaux = [[79, m.salonY, SALON.h], [657, m.salonY, SALON.h], [m.large ? 4 : 79, REZ, HAUT], ...(m.large ? [] : [[657, REZ, HAUT]])]
  if (m.etage.length) poteaux.push(...(m.hautX === 12 ? [[4, ETAGE, HAUT]] : [[m.hautX - 8, ETAGE, HAUT], [m.hautX + m.hautW, ETAGE, HAUT]]))
  for (const [x, y, h] of poteaux) out.push(a.plan('poteau', x!, y!, 8, h!))
  // Between two rooms at rest a shoji goes out with them.
  const cloisons = (list: Salle[], from: number) => list.slice(0, -1).forEach((s, i) => {
    const dark = v.rooms[from + i]?.rest && v.rooms[from + i + 1]?.rest
    out.push(a.plan(dark ? 'clo0' : 'clo1', s.x + s.w, s.y, CLOISON, HAUT))
  })
  cloisons(m.etage, 1)
  cloisons(m.rez, 1 + m.etage.length)
  if (m.deux) out.push(a.plan('escalier', TOUR_LARGE, 304, 34, 192), a.plan('escalier', TOUR_LARGE, 496, 34, 192), linteau(TOUR_LARGE, 304), linteau(TOUR_LARGE, 496), a.sprite('coiffe', 722, 286))
  else out.push(a.plan('escalier', m.tour, 494, 34, 192), linteau(m.tour, 494), a.sprite('coiffe', m.tour - 10, 476))
  out.push(a.plan('galerie', 79, salonBas, (m.large ? 733 : 699) - 79, POUTRE))
  if (m.etage.length) out.push(m.hautX === 12 ? a.plan('galerie', 4, ETAGE + HAUT, 760, POUTRE) : a.plan('galerie', m.hautX - 8, ETAGE + HAUT, TOUR_LARGE - m.hautX + 8, POUTRE))
  out.push(m.large ? a.plan('galerie', 4, REZ + HAUT, 760, POUTRE) : a.plan('galerie', 79, REZ + HAUT, 620, POUTRE))
  if (m.large) out.push(a.plan('rambarde', 657, salonBas - 20, 76, 20))
  if (m.etage.length && m.hautX > 12) out.push(a.plan('rambarde', m.hautX + m.hautW + 8, ETAGE + HAUT - 20, 732 - m.hautX - m.hautW, 20))
  return out.join('')
}

/** Eaves and lanterns stand over the rooms; the stairs stand in front of the eaves. */
function devant(a: Atelier, v: MapView, m: Maison) {
  const auvent = (y: number, long: boolean) => {
    const [id, x, w] = long ? ['auventLong', 2, 734] as const : ['auventCourt', 62, 612] as const
    return `<svg x="${x}" y="${y}" width="${Math.min(w, m.tour - x)}" height="28">${a.sprite(id)}</svg>`
  }
  const out: string[] = []
  if (m.etage.length) out.push(auvent(ETAGE - 24, m.hautX === 12))
  out.push(auvent(REZ - 24, m.large), a.sprite('lanterne', 92, m.salonY - 24), a.sprite('lanterne', 642, m.salonY - 24))
  for (const list of [m.etage, m.rez]) {
    const first = list[0]
    if (!first) continue
    if (list.length === 1) out.push(...[45, 285, 525].map(dx => a.sprite('lanterne', first.x + dx, first.y + 2)))
    else out.push(...list.slice(0, -1).map(s => a.sprite('lanterne', s.x + s.w, s.y + 2)))
    if (list === m.rez && m.large) out.push(a.sprite('lanterne', first.x + 40, first.y + 2))
  }
  return out.join('')
}

/** The news on their way: from a lit room along its gallery, up the stairs, over the bridge and into the cabinet. */
function trajet(a: Atelier, v: MapView, m: Maison) {
  const lit = v.rooms.findIndex((r, i) => i > 0 && !r.rest)
  const s = salles(m)[(lit > 0 ? lit : 1) - 1]
  if (!s) return ''
  const sol = s.y + HAUT - 14
  const haut = m.salonY + SALON.h - 14
  const tour = m.tour + 9
  const pieds: Point[] = [{ x: s.x + Math.round(s.w / 2) - 8, y: sol }, { x: tour, y: sol }, { x: tour, y: haut }, { x: Math.min(tour, 665), y: haut }]
  const route = [...pieds, { x: SALON.x + 488, y: m.salonY + 125 }]
  const legs = route.slice(1).map((p, i) => Math.abs(p.x - route[i]!.x) + Math.abs(p.y - route[i]!.y))
  const total = legs.reduce((sum, l) => sum + l, 0)
  const temps = route.map((_, i) => Math.round((legs.slice(0, i).reduce((sum, l) => sum + l, 0) / total) * 1000) / 1000)
  const [debut, arrivee] = [route[0]!, pieds[pieds.length - 1]!]
  const anim = (pts: Point[]) => `<animateTransform attributeName="transform" type="translate" values="${pts.map(p => `${p.x - debut.x} ${p.y - debut.y}`).join(';')}" keyTimes="${temps.join(';')}" dur="${v.flightS}s" fill="freeze"/>`
  const fondu = (k: number) => `<animate attributeName="opacity" values="1;1;0" keyTimes="0;${k};1" dur="${v.flightS}s" fill="freeze"/>`
  return `<g class="ev" transform="translate(${debut.x} ${debut.y})"><g>${anim([...pieds, arrivee])}${fondu(temps[pieds.length - 1]!)}${a.sprite('messager')}</g><g>${anim(route)}${fondu(0.98)}${a.sprite('lettre', 10, -9)}</g></g>`
}

export const japonaisMap: MapPack = {
  back: '#0E1430',
  places(n) {
    const m = maison(n)
    return [{ x: 79, y: m.salonY, w: 586, h: SALON.h + POUTRE }, ...salles(m).map(s => ({ x: s.x, y: s.y, w: s.w, h: HAUT + POUTRE }))]
  },
  counts(n) {
    const m = maison(n)
    return [{ x: SALON.x + TELE.x + 44, y: m.salonY + TELE.y + 22, size: 24, ink: ECRAN }, ...salles(m).map(s => ({ x: s.x + s.w - 28, y: s.y + 33, size: 16, ink: ECRAN }))]
  },
  draw(v) {
    const m = maison(v.rooms.length)
    const a = atelier()
    const pieces = salles(m)
    const back = charpente(a, v, m)
    const rooms = v.rooms.map((r, i) => (i ? chambre(a, v, r, pieces[i - 1]!) : salon(a, v, r, m)))
    const front = devant(a, v, m) + (v.news.flying ? trajet(a, v, m) : '')
    return { defs: a.defs(), back, rooms, front, words: a.words() }
  },
  walk(n) {
    const m = maison(n)
    const x = m.tour + 17
    const niveaux = [[m.salonY + SALON.h, 84], ...(m.etage.length ? [[ETAGE + HAUT, m.hautX]] : []), [REZ + HAUT, m.large ? 12 : 87]]
    // From the ground up: each gallery to its far end and back to the stairs, then down the stairs to close the loop.
    return niveaux.reverse().flatMap(([y, bout]) => [{ x, y: y! }, { x: bout!, y: y! }, { x, y: y! }])
  },
}
