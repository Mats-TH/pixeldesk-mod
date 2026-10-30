import type { PlanLine } from '../types'
import type { KidState } from './desks'
import { decides, getLanguage, plural, t } from './i18n'
import type { Gauge } from './limits'
import { canvas, mix, noise, paths } from './pixel/canvas'
import type { Canvas } from './pixel/canvas'
import { compteur, enveloppe } from './pixel/decor'
import { SHARP, fit, text, textWidth } from './pixel/font'
import { crab } from './pixel/sprites'
import { railPaths } from './room'

export const BAND_H = 80

export type BandInput = {
  title: string
  steps: PlanLine[]
  gauges: [Gauge, Gauge]
  width: number
  night: boolean
}

/** The band of a conversation that delegates: its sub-conversations in place of a plan. */
export type OverviewInput = { states: KidState[]; agents: number; news: number; gauges: [Gauge, Gauge]; width: number; night: boolean }

/** The band with nothing to tell: the world at rest, and the limits. */
export type IdleInput = { gauges: [Gauge, Gauge]; width: number; night: boolean }

const PX = 2
const ART_H = BAND_H / PX
const PANEL = 116
const BAR = 100
const TEXT = SHARP
const PLAQUE_H = 12
const WOOD = ['#2E1A1E', '#4A2C2A', '#6B4030', '#8A5A3A', '#A97A4E', '#C99A68']
const CREAM = '#F4E4C1'
const GOLD = '#FFC857'
const INK = '#1B1730'
const OUTLINE = '#2A2036'
const TEAL = ['#2A9D8F', '#5FC9B8', '#1E7468']
const CORAL = ['#E4633A', '#F08A66', '#B8452A']

type Sky = (typeof SKY)['night']

const SKY = {
  night: {
    bands: ['#17143A', '#1E1A42', '#2A2550', '#3A2F6B', '#4F3F80'],
    far: '#3B3470', farLight: '#4C4490', farDark: '#2E2A5C', snow: '#8F88C8',
    hills: ['#20383F', '#27455A', '#2F5A5E'],
    grass: ['#264C3A', '#2F5D46', '#3E7A52', '#4E8F5A'],
    pine: ['#14282C', '#1F3B3A', '#2C5A4E'],
    cloud: ['#55508A', '#3F3B70'], edge: '#3A2F28',
  },
  day: {
    bands: ['#4F9FD6', '#6FB9E4', '#8FCBEA', '#B4DFEE', '#D8F0F2'],
    far: '#7FA6C9', farLight: '#A0C2DE', farDark: '#6488AC', snow: '#F4FAFC',
    hills: ['#4E8F6E', '#5E9E78', '#74B386'],
    grass: ['#3E7A4C', '#4E8F5A', '#6FAE5C', '#8CC265'],
    pine: ['#1F5040', '#2F6B4F', '#4C9068'],
    cloud: ['#FFFFFF', '#CFE4F0'], edge: '#5A4A3A',
  },
}

// The same person as at the desks, standing: head and chest, then two walking frames of legs.
const HERO_BODY = ['....oooooooo....', '...oHHhhhhHHo...', '..oHHhhhhhhHHo..', '.oDHHHhhhHHHHDo.', '.oDHHHHHHHHHHDo.', '.oDHSSSSSSSSHDo.', '.oDSSSSSSSSSSDo.', '.osSweSSSSewSso.', '.osSweSSSSewSso.', '.osSSSSSSSSSSso.', '..osSpSSSSpSso..', '...ossSmmSsso...', '....oossssoo....', '...oLCgSSgCCo...', '..oLCCCggCCCco..', '.oLCCCCCCCCCCco.', '.oSsoCCCCCCoSso.', '..ooocCCCCcooo..', '...oBBBBBBBBo...']
const HERO_LEGS_A = ['...oBBooooBBo...', '...oBBo..oBBo...', '...oKKo..oKKo...', '...ooo....ooo...']
const HERO_LEGS_B = ['....oBBooBBo....', '....oBBooBBo....', '....oKKooKKo....', '.....ooo.ooo....']
const HERO_COLORS = {
  o: OUTLINE, H: '#3B2A20', h: '#5E4432', D: '#241A1E', S: '#F0C8A0', s: '#C9976E', w: '#F9F1DE', e: '#1F1A2E',
  p: '#EDA57E', m: '#8A4A4A', C: CORAL[0]!, c: CORAL[2]!, L: CORAL[1]!, g: CREAM, B: '#3F4F7E', K: WOOD[1]!,
}

/** Blends a colour over a pixel already drawn; the sky has no transparent cells. */
const over = (c: Canvas, x: number, y: number, color: string, a: number) => {
  const old = c.get(x, y)
  if (old) c.set(x, y, mix(old, color, a))
}

function pine(c: Canvas, x: number, base: number, h: number, S: Sky) {
  const [dark, mid, light] = S.pine as [string, string, string]
  for (let j = 0; j < h; j += 1) {
    const t = j % 4
    const half = Math.floor(t + j / 3) + 1
    const y = base - h + j
    c.rect(x - half - 1, y, half * 2 + 3, 1, dark)
    c.rect(x - half, y, half * 2 + 1, 1, mid)
    c.rect(x - half, y, Math.max(1, half - 1), 1, light)
    if (t === 3) c.rect(x - half + 1, y, half * 2 - 1, 1, dark)
  }
  c.rect(x - 1, base, 3, 2, WOOD[1]!)
  c.set(x - 1, base, WOOD[2]!)
}

function bush(c: Canvas, x: number, y: number, S: Sky) {
  const [dark, mid, light] = S.pine as [string, string, string]
  c.rect(x, y + 1, 9, 3, dark)
  c.rect(x + 1, y, 7, 4, mid)
  c.rect(x + 2, y, 3, 1, light)
  c.rect(x + 1, y + 1, 2, 1, light)
  c.set(x + 3, y + 2, '#F4A0A8')
  c.set(x + 6, y + 1, GOLD)
}

function cottage(c: Canvas, x: number, y: number, lit: boolean) {
  c.rect(x, y + 6, 18, 8, '#E8D6B0')
  c.rect(x, y + 6, 1, 8, '#C9B48A')
  c.rect(x + 17, y + 6, 1, 8, '#C9B48A')
  for (let i = 0; i < 7; i += 1) c.rect(x - 1 + i, y + 6 - i, 20 - i * 2, 1, i % 2 ? '#B8452A' : '#C75A4E')
  c.rect(x - 2, y + 6, 22, 1, '#8E3320')
  c.rect(x + 14, y - 3, 3, 6, WOOD[2]!)
  c.rect(x + 14, y - 3, 3, 1, WOOD[4]!)
  c.rect(x + 7, y + 9, 4, 5, WOOD[2]!)
  c.rect(x + 7, y + 9, 4, 1, WOOD[4]!)
  c.rect(x + 2, y + 8, 3, 3, lit ? GOLD : '#5FB0E0')
  c.rect(x + 13, y + 8, 3, 3, lit ? GOLD : '#5FB0E0')
  c.set(x + 3, y + 9, WOOD[1]!)
  c.set(x + 14, y + 9, WOOD[1]!)
  over(c, x + 15, y - 5, '#D9DCE8', 0.6)
  over(c, x + 16, y - 7, '#D9DCE8', 0.45)
  over(c, x + 15, y - 9, '#D9DCE8', 0.3)
}

function sky(c: Canvas, S: Sky, night: boolean) {
  const W = c.w
  S.bands.forEach((color, i) => c.rect(0, i * 6, W, i === 4 ? 10 : 6, color))
  for (let x = 0; x < W; x += 1) {
    for (const [y, band] of [[5, 1], [11, 2], [17, 3], [23, 4]] as const) if ((x + y) % 2 === 0) c.set(x, y, S.bands[band]!)
  }
  const orbX = W - PANEL - 52
  const halo = (radius: number, a: number, color: string) => {
    for (let j = -radius; j <= radius + 6; j += 1) {
      for (let i = -radius; i <= radius + 6; i += 1) {
        if ((i - 3) ** 2 + (j - 3) ** 2 <= (radius + 3) ** 2) over(c, orbX + i, 6 + j, color, a)
      }
    }
  }
  if (night) {
    for (let i = 0; i < 40; i += 1) {
      const x = 120 + ((i * 53 + i * i * 7) % Math.max(1, W - PANEL - 124))
      const y = (i * 11 + ((i * i) % 7)) % 20
      c.set(x, y, i % 5 === 0 ? GOLD : CREAM)
      if (i % 8 === 0) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) over(c, x + a, y + b, CREAM, 0.5)
    }
    halo(5, 0.1, CREAM)
  } else {
    halo(7, 0.14, '#FFE9A8')
    halo(5, 0.18, '#FFE9A8')
  }
  const orb = night ? CREAM : GOLD
  c.rect(orbX, 6, 7, 7, orb)
  c.rect(orbX + 1, 5, 5, 9, orb)
  c.rect(orbX - 1, 7, 9, 5, orb)
  if (night) {
    c.rect(orbX + 4, 5, 3, 3, S.bands[0]!)
    c.rect(orbX + 6, 7, 2, 3, S.bands[0]!)
    c.set(orbX + 1, 9, '#D8C49E')
    c.rect(orbX + 2, 11, 2, 1, '#D8C49E')
  } else {
    c.rect(orbX + 1, 6, 3, 2, '#FFF0B8')
    c.rect(orbX + 4, 11, 3, 1, '#F0A838')
  }
}

function hills(c: Canvas, S: Sky) {
  const W = c.w
  const PEAKS = [[20, 17], [64, 13], [108, 19], [152, 14], [196, 18], [238, 13], [282, 16], [330, 14]] as const
  for (let x = 0; x < W; x += 1) {
    let h = 0
    let side = 0
    for (let round = 0; round < 3; round += 1) {
      for (const [peak, top] of PEAKS) {
        const p = peak + round * 350
        const v = top - Math.abs(x - p) * 0.62
        if (v > h) {
          h = v
          side = x < p ? 1 : -1
        }
      }
    }
    h = Math.round(h)
    if (h > 0) {
      const top = 28 - h
      c.rect(x, top, 1, h, side > 0 ? S.farLight : S.farDark)
      if ((x * 3 + top) % 5 === 0) c.rect(x, top + 3, 1, Math.max(1, h - 5), S.far)
      if (h > 10) c.rect(x, top, 1, h - 10 + (x % 3 === 0 ? 1 : 0), S.snow)
    }
  }
  for (let x = 0; x < W; x += 1) {
    const h = Math.round(5 + 2.4 * Math.sin(x * 0.12 + 2) + 1.4 * Math.sin(x * 0.31))
    c.rect(x, 29 - h, 1, h, S.hills[1]!)
    c.rect(x, 29 - h, 1, 1, S.hills[2]!)
    if ((x + h) % 7 === 0) c.rect(x, 31 - h, 1, Math.max(1, h - 2), S.hills[0]!)
  }
}

function ground(c: Canvas, S: Sky, room: number) {
  const W = c.w
  const [g0, g1, g2, g3] = S.grass as [string, string, string, string]
  c.rect(0, 27, W, 13, g1)
  c.rect(0, 27, W, 1, g3)
  c.rect(0, 28, W, 1, g2)
  c.rect(0, 38, W, 2, g0)
  for (let i = 0; i < 120; i += 1) {
    const x = Math.floor(noise(i, 3) * W)
    const y = 29 + Math.floor(noise(i, 4) * 10)
    if (y < 31 || y > 35) c.set(x, y, i % 3 ? g2 : g3)
  }
  for (let i = 0; i < 22; i += 1) {
    const x = Math.floor(noise(i, 8) * room)
    c.set(x, 37, i % 2 ? '#F4A0A8' : GOLD)
    c.set(x, 38, g3)
  }
}

function fence(c: Canvas, end: number) {
  for (let x = 4; x < end; x += 11) {
    if (noise(x, 2) >= 0.28) {
      c.rect(x, 25, 1, 5, WOOD[3]!)
      c.set(x, 25, WOOD[5]!)
      c.rect(x, 26, 11, 1, WOOD[4]!)
      c.rect(x, 28, 11, 1, WOOD[3]!)
    }
  }
}

function path(c: Canvas, S: Sky, from: number, to: number, head: number) {
  const dirt = ['#5A4A3A', '#4E4032', '#665442'] as const
  const sand = ['#E8C27A', '#D9AE62', '#F2D69A'] as const
  for (let x = from; x < to; x += 1) {
    const r = x < head ? sand : dirt
    c.rect(x, 31, 1, 4, r[0])
    c.set(x, 31, r[2])
    c.set(x, 34, r[1])
    if (noise(x, 6) > 0.72) c.set(x, 32 + (x % 2), r[1])
    if (noise(x, 9) > 0.86) c.set(x, 33, r[2])
  }
  c.rect(from, 35, to - from, 1, S.edge)
  for (let x = from; x < to; x += 4 + Math.floor(noise(x, 1) * 5)) {
    c.rect(x, 30, 2, 1, '#8A8FA3')
    c.set(x, 30, '#B8BCCB')
  }
}

function lantern(c: Canvas, x: number, lit: boolean) {
  if (lit) {
    for (let j = -3; j < 9; j += 1) {
      for (let k = -3; k < 6; k += 1) if ((k - 1) ** 2 + (j - 3) ** 2 <= 22) over(c, x + k, 17 + j, GOLD, 0.22)
    }
  }
  c.rect(x, 23, 2, 8, WOOD[2]!)
  c.rect(x, 23, 1, 8, WOOD[3]!)
  c.rect(x - 1, 15, 4, 1, WOOD[1]!)
  c.rect(x - 2, 16, 6, 1, WOOD[1]!)
  c.rect(x - 1, 17, 4, 6, WOOD[1]!)
  c.rect(x, 18, 2, 4, lit ? GOLD : '#5A4E44')
  if (lit) {
    c.set(x, 18, '#FFF6DE')
    c.set(x + 1, 19, '#FFF6DE')
  }
  c.rect(x - 2, 23, 6, 1, WOOD[1]!)
}

function flagAt(c: Canvas, x: number, finished: boolean) {
  c.rect(x, 10, 2, 21, '#D9DCE8')
  c.rect(x, 10, 1, 21, '#FFFFFF')
  c.rect(x - 1, 8, 4, 2, GOLD)
  const [mid, light, dark] = finished ? [GOLD, '#FFE08A', '#C9962E'] : ['#D1495B', '#E8707E', '#A83A44']
  for (let i = 0; i < 14; i += 1) {
    const wave = Math.round(Math.sin(i * 0.7))
    c.rect(x + 2 + i, 11 + wave, 1, 7, mid)
    c.set(x + 2 + i, 11 + wave, light)
    c.set(x + 2 + i, 17 + wave, dark)
  }
  if (finished) {
    for (const [a, b] of [[x - 36, 8], [x - 22, 3], [x - 10, 6], [x + 18, 5]] as const) {
      for (const [i, j] of [[0, -2], [0, 2], [-2, 0], [2, 0], [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 0]] as const) c.set(a + i, b + j, GOLD)
    }
  }
}

const PATH_START = 6
// The room the designs draw, in cells: the world scales from it.
const ROOM_BASE = 259
/** Where stop `i` of `total` falls on the path, in cells. */
const stopAt = (W: number, i: number, total: number) => Math.round(PATH_START + ((W - PANEL - 24 - PATH_START) * i) / Math.max(1, total))

/**
 * The whole scene; answers where the walker stands. A path without `lamps` stays dark, one without `flag` leaves its
 * end free, and one with `trail` off stays brown: its lamps alone say how far along.
 */
function world(c: Canvas, night: boolean, done: number, total: number, { lamps = true, flag = true, trail = true } = {}) {
  const S = night ? SKY.night : SKY.day
  const room = c.w - PANEL
  const end = room - 24
  const scale = room / ROOM_BASE
  const at = (x: number) => Math.round(x * scale)
  sky(c, S, night)
  hills(c, S)
  cottage(c, at(170), 13, night)
  for (const [x, h] of [[70, 12], [92, 16], [108, 11], [140, 14], [206, 15], [226, 11], [240, 13]] as const) pine(c, at(x), 28, h, S)
  ground(c, S, room)
  for (const x of [38, 124, 222]) bush(c, at(x), 24, S)
  fence(c, end)
  const pos = (i: number) => stopAt(c.w, i, total)
  path(c, S, PATH_START, end, trail ? pos(done) : PATH_START)
  if (lamps) for (let i = 0; i < total; i += 1) lantern(c, pos(i) + (i === 0 ? 2 : 0), i <= done)
  const finished = total > 0 && done === total
  if (flag) flagAt(c, pos(total), finished)
  return finished ? pos(total) - 18 : Math.max(1, pos(done) - 8)
}

function woodPanel(c: Canvas) {
  const x = c.w - PANEL
  c.rect(x, 0, PANEL, ART_H, WOOD[2]!)
  for (let i = 0; i < 70; i += 1) {
    const gx = x + 2 + Math.floor(noise(i, 11) * (PANEL - 10))
    const gy = 2 + Math.floor(noise(i, 12) * 36)
    const grain = noise(i, 14) > 0.5 ? mix(WOOD[2]!, WOOD[1]!, 0.45) : mix(WOOD[2]!, WOOD[3]!, 0.4)
    c.rect(gx, gy, 3 + Math.floor(noise(i, 13) * 9), 1, grain)
  }
  c.rect(x, 0, PANEL, 1, WOOD[3]!)
  c.rect(x, ART_H - 1, PANEL, 1, WOOD[1]!)
  c.rect(x, 0, 2, ART_H, WOOD[1]!)
  c.rect(x + 2, 0, 1, ART_H, WOOD[3]!)
  c.rect(x + 3, 20, PANEL - 3, 1, WOOD[1]!)
  c.rect(x + 3, 21, PANEL - 3, 1, WOOD[3]!)
  for (const [a, b] of [[x + 4, 2], [c.w - 3, 2], [x + 4, 37], [c.w - 3, 37]] as const) c.set(a, b, '#C9A24A')
}

function barOf(c: Canvas, g: Gauge, x: number, y: number) {
  c.rect(x, y + 7, BAR + 4, 1, WOOD[1]!)
  c.rect(x, y, BAR + 4, 7, INK)
  c.rect(x + 2, y + 1, BAR, 5, '#3A3355')
  c.rect(x + 2, y + 1, BAR, 1, '#2C2642')
  if (g.used === null) return
  const used = Math.round((BAR * g.used) / 100)
  const mark = g.mark === null ? BAR : Math.round((BAR * g.mark) / 100)
  const shaded = (from: number, w: number, [mid, light, dark]: readonly string[]) => {
    c.rect(from, y + 1, w, 5, mid!)
    c.rect(from, y + 1, w, 1, light!)
    c.rect(from, y + 5, w, 1, dark!)
  }
  shaded(x + 2, Math.min(used, mark), TEAL)
  if (used > mark) shaded(x + 2 + mark, used - mark, CORAL)
  if (g.mark !== null) {
    c.rect(x + 1 + mark, y - 1, 1, 9, GOLD)
    c.rect(x + mark, y - 2, 3, 1, GOLD)
    c.set(x + 1 + mark, y - 2, '#FFF6DE')
  }
}

function gaugeText(g: Gauge, x: number, y: number) {
  const right = (s: string, edge: number, color: string) => text(s, edge - textWidth(s, TEXT), y, TEXT, color)
  return text(g.label, x + 4, y, TEXT, CREAM) + right(g.percent, x + 142, CREAM) + right(g.at, x + 208, GOLD)
}

function plaque(widthPx: number) {
  const c = canvas(Math.ceil(widthPx / PX), PLAQUE_H)
  c.rect(0, 0, c.w, PLAQUE_H, WOOD[1]!)
  c.rect(1, 1, c.w - 2, PLAQUE_H - 2, CREAM)
  c.rect(1, 1, c.w - 2, 1, '#FFF6DE')
  c.rect(1, PLAQUE_H - 2, c.w - 2, 1, '#D8C49E')
  for (const [x, y] of [[2, 2], [c.w - 3, 2], [2, 9], [c.w - 3, 9]] as const) c.set(x, y, '#C9A24A')
  return c
}

const CLOUD_W = 26
// What a cloud leaves between its nose and the panel at the end of its run.
const CLOUD_GAP = 4

function cloudArt(S: Sky) {
  const [a, b] = S.cloud as [string, string]
  const c = canvas(CLOUD_W, 7)
  c.rect(6, 0, 10, 2, a)
  c.rect(3, 2, 18, 2, a)
  c.rect(0, 4, 26, 3, a)
  c.rect(1, 6, 24, 1, b)
  c.rect(18, 4, 7, 2, b)
  return c
}

function sprite(rows: readonly string[]) {
  const c = canvas(rows[0]!.length, rows.length)
  c.sprite(rows, HERO_COLORS, 0, 0)
  return c
}

const counts = (p: BandInput) => {
  const total = p.steps.length
  const done = p.steps.filter(st => st.status === 'completed').length
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 }
}

export function bandAlt(p: BandInput) {
  const { total, done, percent } = counts(p)
  const now = p.steps.find(st => st.status === 'in_progress')
  const limits = p.gauges.map(g => `${g.label} ${g.percent} ${g.at}`).join(', ')
  const head = t('band.alt', { title: p.title, tasks: t('band.tasks', { done, total }), n: percent })
  return `${head}${now ? ` ${t('band.altNow', { text: now.text })}` : ''} ${limits}`
}

/** Walking, the clouds drifting by: what every band of the world has in common. */
function moving(width: number) {
  // A cloud fades out and is gone with its nose short of the wood: the panel is never crossed.
  const lastX = width - PANEL * PX - CLOUD_W * PX - CLOUD_GAP
  return `<style>
.h{animation:wk .4s steps(2) infinite}@keyframes wk{from{transform:translateY(0)}to{transform:translateY(-2px)}}
.a{animation:la .4s steps(1) infinite}.b{animation:lb .4s steps(1) infinite}
@keyframes la{0%{opacity:1}50%{opacity:0}}@keyframes lb{0%{opacity:0}50%{opacity:1}}
.n{animation:cl 90s linear infinite}.m{animation:cl 60s linear infinite;animation-delay:-30s}
@keyframes cl{from{transform:translateX(-60px)}94%{opacity:1}to{transform:translateX(${lastX}px);opacity:0}}
@media (prefers-reduced-motion: reduce){.h,.a,.b,.n,.m{animation:none}.b{opacity:0}}
</style>`
}

function clouds(night: boolean) {
  const cloud = paths(cloudArt(SKY[night ? 'night' : 'day']), PX)
  return `<g class="n"><g transform="translate(0 4)">${cloud}</g></g>
<g class="m"><g transform="translate(0 20)">${cloud}</g></g>`
}

const walker = (x: number) => `<g transform="translate(${x * PX} 24)"><g class="h">${paths(sprite(HERO_BODY), PX)}<g transform="translate(0 38)"><g class="a">${paths(sprite(HERO_LEGS_A), PX)}</g><g class="b">${paths(sprite(HERO_LEGS_B), PX)}</g></g></g></g>`

function draw(p: BandInput): string {
  const { total, done, percent } = counts(p)
  const W = Math.floor(p.width / PX)
  const c = canvas(W, ART_H)
  const heroX = world(c, p.night, done, total)
  woodPanel(c)
  const px = W - PANEL
  const gaugeX = px * PX + 8
  barOf(c, p.gauges[0], px + 6, 10)
  barOf(c, p.gauges[1], px + 6, 30)

  const count = t('band.tasks', { done, total })
  const pct = t('band.percentPlate', { n: percent })
  const countW = textWidth(count, TEXT)
  const signW = Math.ceil(countW + textWidth(pct, TEXT) + 28)
  const stepX = 6 + signW + 8
  const now = p.steps.find(st => st.status === 'in_progress') ?? p.steps.find(st => st.status === 'pending')
  const room = Math.max(0, p.width - PANEL * PX - stepX - 30)
  const step = now ? fit(now.text, TEXT, room) : t('band.doneShort')
  const stepW = Math.ceil(textWidth(step, TEXT) + 20)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${BAND_H}" viewBox="0 0 ${p.width} ${BAND_H}" shape-rendering="crispEdges" style="display:block;border-radius:10px">
${moving(p.width)}
${paths(c, PX)}
${clouds(p.night)}
${walker(heroX)}
<g transform="translate(6 1)">${paths(plaque(signW), PX)}</g>
<g transform="translate(${stepX} 1)">${paths(plaque(stepW), PX)}</g>
${text(count, 16, 3, TEXT, INK)}${text(pct, 16 + countW + 8, 3, TEXT, CORAL[2]!)}
${text(step, stepX + 10, 3, TEXT, INK)}
${gaugeText(p.gauges[0], gaugeX, 0)}${gaugeText(p.gauges[1], gaugeX, 40)}
</svg>`
}

// What the design holds to: the rail starts after the walker and stops short of the flag.
const SIGN_PAD = 25
const STEP_PLATE = 308
const RAIL_X = 38
const RAIL_Y = 60
const RAIL_H = 12
const RAIL_END = 8
// The envelope stands left of the flag's pole, the counter right of it.
const MAIL_DX = 14
const MAIL_Y = 6
const COUNT_DX = 9
const COUNT_Y = 3
const COUNT_PAD = 14
const COUNT_SIZE = 16
const KID_COLORS: Record<KidState, string> = { done: '#8CC265', working: GOLD, failed: CORAL[0]!, idle: '#3A3355' }
const KID_ORDER: readonly KidState[] = ['done', 'working', 'failed', 'idle']
const MAX_CELLS = 12

/** The second plate of the band, in words. */
export function overviewLine(p: Pick<OverviewInput, 'states' | 'agents'>) {
  const working = p.states.filter(s => s === 'working').length
  const total = p.states.length
  const head = plural('overview.conversations', decides(working, total), { n: working, total })
  return p.agents ? `${head}, ${plural('overview.agents', p.agents, { n: p.agents })}` : head
}

export function overviewAlt(p: OverviewInput) {
  const limits = p.gauges.map(g => `${g.label} ${g.percent} ${g.at}`).join(', ')
  const head = t('band.overviewAlt', { overview: t('band.overview'), line: overviewLine(p) })
  return `${head}${p.news ? ` ${plural('overview.news', p.news, { n: p.news })}.` : ''} ${limits}`
}

/** One cell per conversation in their order; past 12 the band tells shares, so each state is one block. */
export function kidColors(states: readonly KidState[]) {
  const shown = states.length > MAX_CELLS ? KID_ORDER.flatMap(state => states.filter(s => s === state)) : states
  return shown.map(state => KID_COLORS[state])
}

function drawOverview(p: OverviewInput): string {
  const W = Math.floor(p.width / PX)
  const c = canvas(W, ART_H)
  // One stretch of path, no lamp: the walker stays at the start and the flag at the end.
  const heroX = world(c, p.night, 0, 1, { lamps: false })
  woodPanel(c)
  const px = W - PANEL
  const gaugeX = px * PX + 8
  barOf(c, p.gauges[0], px + 6, 10)
  barOf(c, p.gauges[1], px + 6, 30)

  const flagX = (W - PANEL - 24) * PX
  const overview = t('band.overview')
  const signW = Math.ceil(textWidth(overview, TEXT) + SIGN_PAD)
  const stepX = 6 + signW + 8
  const room = Math.max(0, flagX - MAIL_DX - 8 - stepX)
  const step = fit(overviewLine(p), TEXT, Math.max(0, room - 20))
  const stepW = Math.min(room, Math.max(STEP_PLATE, Math.ceil(textWidth(step, TEXT) + 20)))
  const railW = Math.max(0, flagX - RAIL_END - RAIL_X)
  const count = String(p.news)
  const countW = Math.ceil(textWidth(count, COUNT_SIZE)) + COUNT_PAD
  const mail = p.news
    ? `<g transform="translate(${flagX - MAIL_DX} ${MAIL_Y})">${enveloppe()}</g>${compteur(flagX + COUNT_DX, COUNT_Y, countW)}<g shape-rendering="geometricPrecision">${text(count, flagX + COUNT_DX + COUNT_PAD / 2, COUNT_Y + 2, COUNT_SIZE, '#FFF6DE')}</g>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${BAND_H}" viewBox="0 0 ${p.width} ${BAND_H}" shape-rendering="crispEdges" style="display:block;border-radius:10px">
${moving(p.width)}
${paths(c, PX)}
${clouds(p.night)}
${walker(heroX)}
<rect x="${RAIL_X}" y="${RAIL_Y}" width="${railW}" height="${RAIL_H}" fill="${INK}"/>${railPaths(kidColors(p.states), RAIL_X + 2, RAIL_Y + 2, railW - 4, RAIL_H - 4)}
<g transform="translate(6 1)">${paths(plaque(signW), PX)}</g>
${stepW > 20 ? `<g transform="translate(${stepX} 1)">${paths(plaque(stepW), PX)}</g>${text(step, stepX + 10, 3, TEXT, INK)}` : ''}
${text(overview, 16, 3, TEXT, INK)}
${mail}
${gaugeText(p.gauges[0], gaugeX, 0)}${gaugeText(p.gauges[1], gaugeX, 40)}
</svg>`
}

// What the design holds to: five stops, the person on the bench of the second at night, of the fourth by day.
const IDLE_STOPS = 5
const PLATE_PAD = 20
const BENCH_W = 32
const BENCH_H = 8
const BENCH_Y = 27
const HERO_Y = 10
const HERO_LEGS_Y = 29
const REST_SIGN_Y = 7
const REST_SIGN_COLORS = { A: WOOD[1]!, B: WOOD[5]!, C: WOOD[4]!, D: CREAM, E: WOOD[3]! }
const REST_SIGN = ['AAAAAAAAAAAAAAAAAAAAAA', 'ABBBBBBBBBBBBBBBBBBBBA', 'ACCCCCCCCCCCCCCCCCCCCA', 'ACCCCCCCCCCCCCCCCCCCCA', 'ACCCCCDDDDDDCCCCCCCCCA', 'ACCCCCCCCCDCCCCCCCCCCA', 'ACCCCCCCCDCCCCCCCCCCCA', 'ACCCCCCCDCCCCCDDDCCCCA', 'ACCCCCCDCCCCCCCDCCCCCA', 'ACCCCCDDDDDDCCDDDCCCCA', 'ACCCCCCCCCCCCCCCCCCCCA', 'ACCCCCCCCCCCCCCCCCCCCA', 'AEEEEEEEEEEEEEEEEEEEEA', 'AAAAAAAAAAAAAAAAAAAAAA', ...Array.from({ length: 11 }, () => '..AEEA')]
// The crab's place in the designs, in cells of the room, and how it walks: from there to the sign, back to the start of the path, and home.
const CRAB_NIGHT = 118
const CRAB_DAY = 75
const CRAB_Y = 46
const CRAB_W = 40
const CRAB_SPEED = 12

function bench(c: Canvas, x: number) {
  c.rect(x, BENCH_Y, BENCH_W, 1, WOOD[5]!)
  c.rect(x, BENCH_Y + 1, BENCH_W, 2, WOOD[3]!)
  c.rect(x, BENCH_Y + 3, BENCH_W, 1, WOOD[1]!)
  for (const leg of [2, BENCH_W - 4]) c.rect(x + leg, BENCH_Y + 4, 2, BENCH_H - 4, WOOD[1]!)
  for (let i = 1; i < BENCH_W - 1; i += 1) over(c, x + i, BENCH_Y + BENCH_H, INK, 0.3)
}

/** The crab on the path. SMIL walks it with no redraw, and CSS cannot stop SMIL: a crab that stands waits in its place. */
function walkingCrab(W: number, night: boolean) {
  const [from, to] = [PATH_START * PX, stopAt(W, IDLE_STOPS, IDLE_STOPS) * PX - CRAB_W - 4]
  const home = Math.max(from, Math.min(to, Math.round(((night ? CRAB_NIGHT : CRAB_DAY) * (W - PANEL)) / ROOM_BASE) * PX))
  const legs = [to - home, to - from, home - from]
  const length = legs[0]! + legs[1]! + legs[2]!
  const times = [0, legs[0]! / length, (legs[0]! + legs[1]!) / length, 1].map(t => Math.round(t * 1000) / 1000)
  const values = [home, to, from, home].map(x => `${x} ${CRAB_Y}`).join(';')
  return `<style>.cs{display:none}@media (prefers-reduced-motion: reduce){.cw{display:none}.cs{display:inline}}</style>
<defs><g id="k">${paths(crab(), PX)}</g></defs>
<g class="cw"><g transform="translate(${home} ${CRAB_Y})"><animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="${times.join(';')}" dur="${Math.round(length / CRAB_SPEED)}s" repeatCount="indefinite"/><g class="h"><use href="#k"/></g></g></g>
<g class="cs" transform="translate(${home} ${CRAB_Y})"><use href="#k"/></g>`
}

export function idleAlt(p: IdleInput) {
  return `${t('band.idle')}. ${p.gauges.map(g => `${g.label} ${g.percent} ${g.at}`).join(', ')}`
}

function drawIdle(p: IdleInput): string {
  const W = Math.floor(p.width / PX)
  const c = canvas(W, ART_H)
  // The bench stands before a lantern, which goes behind the person sitting there. The lamps are lit up to it.
  const stop = p.night ? 1 : 3
  world(c, p.night, stop, IDLE_STOPS, { flag: false, trail: false })
  const seat = stopAt(W, stop, IDLE_STOPS)
  bench(c, seat - BENCH_W / 2)
  c.sprite(HERO_BODY, HERO_COLORS, seat - 8, HERO_Y)
  c.sprite(HERO_LEGS_A, HERO_COLORS, seat - 8, HERO_LEGS_Y)
  c.sprite(REST_SIGN, REST_SIGN_COLORS, stopAt(W, IDLE_STOPS, IDLE_STOPS) - 2, REST_SIGN_Y)
  woodPanel(c)
  const px = W - PANEL
  const gaugeX = px * PX + 8
  barOf(c, p.gauges[0], px + 6, 10)
  barOf(c, p.gauges[1], px + 6, 30)
  const idle = t('band.idle')
  const signW = Math.ceil(textWidth(idle, TEXT) + PLATE_PAD)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${BAND_H}" viewBox="0 0 ${p.width} ${BAND_H}" shape-rendering="crispEdges" style="display:block;border-radius:10px">
${moving(p.width)}
${paths(c, PX)}
${clouds(p.night)}
${walkingCrab(W, p.night)}
<g transform="translate(6 1)">${paths(plaque(signW), PX)}</g>
${text(idle, 16, 3, TEXT, INK)}
${gaugeText(p.gauges[0], gaugeX, 0)}${gaugeText(p.gauges[1], gaugeX, 40)}
</svg>`
}

let lastIdleKey = ''
let lastIdle = ''

/** The same memory as the plan's band: the crab walks by itself, and the source stays until a gauge moves. */
export function idleSvg(p: IdleInput): string {
  const key = JSON.stringify([getLanguage(), p])
  if (key !== lastIdleKey) {
    lastIdleKey = key
    lastIdle = drawIdle(p)
  }
  return lastIdle
}

let lastOverviewKey = ''
let lastOverview = ''

/** The same memory as the plan's band: one drawing at a time, kept while nothing changes. */
export function overviewSvg(p: OverviewInput): string {
  const key = JSON.stringify([getLanguage(), p])
  if (key !== lastOverviewKey) {
    lastOverviewKey = key
    lastOverview = drawOverview(p)
  }
  return lastOverview
}

let lastKey = ''
let lastSvg = ''

/** The drawing is slow to build and the band redraws often: same input, same string. */
export function bandSvg(p: BandInput): string {
  const key = JSON.stringify([getLanguage(), p])
  if (key !== lastKey) {
    lastKey = key
    lastSvg = draw(p)
  }
  return lastSvg
}
