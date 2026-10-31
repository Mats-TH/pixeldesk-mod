import { canvas, mix, noise } from '../canvas'
import type { Canvas } from '../canvas'
import { PX } from '../pack'
import type { Tenue } from '../sprites'

type C = Canvas

const INK = '#2A2036'
const SH = '#1B1730|0.28'
const ACIER = ['#22252E', '#323641', '#484D5A', '#636978', '#868D9C', '#B0B6C2', '#DCE0E8'] as const
const ALU = ['#6E7480', '#8E94A0', '#B0B6C0', '#CCD1D8', '#E6E9EE'] as const
const COQUE = ['#8E94A0', '#B8BEC8', '#DDE1E8', '#F4F6F8', '#FFFFFF'] as const
const BLEU = ['#18243C', '#223354', '#2E4670', '#3E5E90', '#5A82B2', '#8CB0D4'] as const
const ROUGE = ['#64161A', '#922624', '#BE3A2E', '#DC5A44', '#F28A6C'] as const
const ORANGE = ['#8A4416', '#B8601E', '#E08A2C', '#F4B04C', '#FFD88A'] as const
const EAU = ['#2A6C9C', '#3F8CC0', '#5FB0E0', '#8CCBEA', '#BFE6F5', '#E6F6FC'] as const
const OR = ['#8C6A2E', '#C9A24A', '#E8C868', '#FFE08A'] as const
const VERT = ['#1F4234', '#2C6A4A', '#3A9A68', '#6FD8A0', '#BFF5E6'] as const
const CARTON = ['#4E3A2A', '#6E5034', '#8E6C46', '#B08C5E', '#CCAA78'] as const
const PAPIER = ['#C8C4B8', '#E8E4D8', '#F8F6EE', '#FFFFFF'] as const
const JAUNE = ['#C89A28', '#F0C440', '#F8DE70'] as const
const FEU = ['#B8301E', '#E8602A', '#F8A030', '#FFD860', '#FFF6DE'] as const

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
/** Slanted hazard stripes. */
const danger = (c: C, x: number, y: number, w: number, h: number, a: string = JAUNE[1], b: string = ACIER[0], p = 3) => {
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) c.set(x + i, y + j, (i + j) % (p * 2) < p ? a : b)
}
/** A sphere lit from the left. */
const boule = (c: C, cx: number, cy: number, r: number, ramp: readonly string[]) => {
  disc(c, cx, cy, r, r, (x, y) => {
    const k = ((x - cx) * 0.8 + (y - cy) * 0.6) / r
    return ramp[k < -0.55 ? 4 : k < -0.15 ? 3 : k < 0.3 ? 2 : k < 0.68 ? 1 : 0]!
  })
}
/** A lattice column. */
const treillis = (c: C, x: number, y: number, w: number, h: number, a: string, b: string, pas = 6) => {
  c.rect(x, y, 1, h, a)
  c.rect(x + w - 1, y, 1, h, b)
  for (let j = 0; j + pas <= h; j += pas) {
    c.rect(x, y + j, w, 1, a)
    line(c, x, y + j, x + w - 1, y + j + pas, b)
    line(c, x + w - 1, y + j, x, y + j + pas, a)
  }
}

// ---------- Sky and ground ----------

export type Scene = { ciel: readonly string[]; loin: string; pres: string; sol: string; astre: string; halo: string }
export const AUBE: Scene = { ciel: ['#1E1F48', '#2C2758', '#4A3268', '#7A4070', '#B45A68', '#E08858', '#F4B868'], loin: '#5A3A62', pres: '#3C2A46', sol: '#33272C', astre: '#FFE6A8', halo: '#F8CC80' }
export const DESERT: Scene = { ciel: ['#2E5A8C', '#3C72A4', '#5A90B8', '#80ACC4', '#A8C4C8', '#CCD2BC', '#E4D8A8'], loin: '#A87C5C', pres: '#7A5440', sol: '#463426', astre: '#FFFBE8', halo: '#F4EAC4' }
export const NUIT: Scene = { ciel: ['#0A0E22', '#0E1430', '#121A3C', '#182248', '#1E2C56', '#263664', '#304470'], loin: '#1C2644', pres: '#121A32', sol: '#20242E', astre: '#F4F0DC', halo: '#3A4A78' }

export const SCENE_H = 80
const HORIZON = 64
const SCENE_W = 308

/** One repeat of the sky's dither: a room of any width repeats it sideways for next to nothing. */
export function ciel(T: Scene) {
  const c = canvas(6, SCENE_H)
  const n = T.ciel.length
  for (let y = 0; y < SCENE_H; y += 1) {
    const f = Math.min(y / HORIZON, 0.999) * n
    const k = Math.floor(f)
    const t = f - k
    for (let x = 0; x < 6; x += 1) {
      const trame = t > 0.8 && k + 1 < n && (x + y * 3) % 6 < 3 + Math.floor((t - 0.8) * 10)
      c.set(x, y, T.ciel[trame ? k + 1 : k]!)
    }
  }
  return c
}

/** What stands on the sky, `w` cells wide: stars or sun, the far mesas and the near ground. `leger`: no stars, no clouds. */
export function horizon(T: Scene, nuit: boolean, w: number, leger: boolean) {
  const c = canvas(w, SCENE_H)
  if (nuit) {
    if (!leger) {
      const k = w / SCENE_W
      for (let i = 0; i < 240 * k; i += 1) {
        const [x, y] = [Math.floor(noise(i, 61) * w), Math.floor(noise(i, 62) * 58)]
        c.set(x, y, i % 5 === 0 ? '#FFFFFF' : i % 3 === 0 ? '#8CA0CC' : '#B8C4E0')
      }
      for (let i = 0; i < 90; i += 1) {
        const t = i / 90
        c.set(Math.floor((30 + t * 240 + noise(i, 3) * 16) * k), Math.floor(4 + t * 34 + noise(i, 4) * 12), '#3A4A78')
      }
      for (const [x, y] of [[60, 16], [142, 9], [214, 28]] as const) {
        c.rect(x - 1, y, 3, 1, '#FFFFFF')
        c.rect(x, y - 1, 1, 3, '#FFFFFF')
      }
    }
    disc(c, 50, 18, 9, 9, (x, y) => (noise(x, y) > 0.84 ? '#CCC8B8' : (x - 50) + (y - 18) > 5 ? '#D8D4C4' : T.astre))
    disc(c, 46, 15, 1.8, 1.8, '#CCC8B8')
    disc(c, 55, 23, 1.4, 1.4, '#CCC8B8')
  } else {
    disc(c, 90, HORIZON - 8, 22, 22, (_, y) => (y < HORIZON ? mix(T.halo, T.ciel[5]!, 0.6) : null))
    disc(c, 90, HORIZON - 8, 12, 12, (_, y) => (y < HORIZON ? T.astre : null))
    if (!leger) {
      for (let run = 0; run * SCENE_W < w; run += 1) {
        for (const [x, y, l] of [[20, 20, 46], [36, 23, 28], [150, 14, 60], [168, 17, 34], [226, 30, 50], [250, 33, 22]] as const) {
          c.rect(run * SCENE_W + x, y, l, 1, mix(T.ciel[3]!, '#FFFFFF', 0.32))
          c.rect(run * SCENE_W + x + 8, y + 1, l - 14, 1, mix(T.ciel[3]!, '#FFFFFF', 0.18))
        }
      }
    }
  }
  for (let x = 0; x < w; x += 1) {
    const a = Math.floor((10 + 7 * Math.sin(x * 0.041 + 1) + 4 * Math.sin(x * 0.13)) / 3) * 3
    const b = Math.floor((5 + 4 * Math.sin(x * 0.07 + 3) + 2 * Math.sin(x * 0.19)) / 2) * 2
    c.rect(x, HORIZON - a, 1, a + 16, T.loin)
    c.set(x, HORIZON - a, mix(T.loin, T.ciel[5]!, 0.3))
    c.rect(x, HORIZON + 4 - b, 1, b + 12, T.pres)
  }
  c.rect(0, 74, w, 6, T.sol)
  for (let x = 0; x < w; x += 1) {
    const r = Math.round(1.6 + 1.6 * Math.sin(x * 0.09))
    c.rect(x, 72 + r, 1, 2, T.sol)
  }
  c.rect(0, 78, w, 2, mix(T.sol, '#000000', 0.12))
  return c
}

/** Dark beaten earth: soft ruts, no stones. `leger`, here and on the next two floors: without the grain. */
export function solTerre(leger: boolean) {
  const c = canvas(96, 64)
  const [a, b, d] = ['#33272C', '#392C31', '#2C2227']
  c.rect(0, 0, 96, 64, a)
  if (!leger) for (let y = 0; y < 64; y += 1) for (let x = 0; x < 96; x += 1) if (noise(x, y + 11) > 0.93) c.set(x, y, noise(x + 3, y) > 0.5 ? b : d)
  for (const [y, s] of [[10, 1], [30, 2], [50, 3]] as const) {
    for (let x = 0; x < 96; x += 1) {
      const dy = Math.round(2 * Math.sin((x / 96) * Math.PI * 2 * s))
      if ((x + s * 7) % 13 > 3) c.set(x, y + dy, d)
      if ((x + s * 3) % 17 > 5) c.set(x, y + dy + 1, b)
    }
  }
  return c
}

/** Dark desert sand, rippled by the wind. */
export function solSable(leger: boolean) {
  const c = canvas(120, 60)
  const [a, b, d] = ['#463426', '#4C3A2A', '#3E2E22']
  c.rect(0, 0, 120, 60, a)
  if (!leger) for (let y = 0; y < 60; y += 1) for (let x = 0; x < 120; x += 1) if (noise(x, y + 23) > 0.95) c.set(x, y, b)
  for (let r = 0; r < 6; r += 1) {
    for (let x = 0; x < 120; x += 1) {
      const y = r * 10 + 4 + Math.round(2.4 * Math.sin((x / 120) * Math.PI * 2 * (r % 3 + 1) + r))
      if ((x + r * 11) % 37 < 28) c.set(x, (y + 60) % 60, d)
      if ((x + r * 11) % 37 < 20) c.set(x, (y + 61) % 60, b)
    }
  }
  return c
}

/** A dark metal platform: tread plates, seams and rivets. */
export function solTole(leger: boolean) {
  const c = canvas(64, 48)
  c.rect(0, 0, 64, 48, '#20242E')
  if (!leger) for (let y = 2; y < 48; y += 4) for (let x = 2 + (y % 8 === 2 ? 0 : 2); x < 64; x += 4) {
    c.set(x, y, '#2A2F3B')
    c.set(x + 1, y + 1, '#191C24')
  }
  for (const [x, y] of [[0, 0], [32, 24]] as const) {
    c.rect(x, y, 32, 1, '#161922')
    c.rect(x, y + 1, 32, 1, '#2C313E')
    c.rect(x, y + 24 - 1, 32, 1, '#161922')
    c.rect(x, y, 1, 24, '#161922')
    c.rect(x + 1, y, 1, 24, '#2C313E')
  }
  c.rect(32, 0, 32, 1, '#161922')
  c.rect(32, 1, 32, 1, '#2C313E')
  c.rect(0, 24, 32, 1, '#161922')
  c.rect(0, 25, 32, 1, '#2C313E')
  c.rect(32, 0, 1, 24, '#161922')
  c.rect(33, 0, 1, 24, '#2C313E')
  c.rect(0, 24, 1, 24, '#161922')
  c.rect(1, 24, 1, 24, '#2C313E')
  for (const [x, y] of [[4, 4], [28, 4], [4, 20], [28, 20], [36, 28], [60, 28], [36, 44], [60, 44], [36, 4], [60, 4], [36, 20], [60, 20], [4, 28], [28, 28], [4, 44], [28, 44]] as const) {
    c.set(x, y, '#3A4050')
    c.set(x + 1, y + 1, '#14161E')
  }
  return c
}

/** The studs of the slab, one repeat in cells. */
export function plots() {
  const c = canvas(4, 8)
  c.set(0, 0, '#2E3340')
  c.set(2, 4, '#2E3340')
  return c
}

/** The work slab under the benches, matt plate, `w` by `h` cells: its studs go between `dalle` and `bords`. */
export function dalle(w: number, h: number) {
  const c = canvas(w, h)
  c.rect(0, 0, w, h, '#14161E')
  c.rect(1, 1, w - 2, h - 2, '#262A34')
  return c
}

/** The slab's edges, seams and hazard corners. */
export function bords(w: number, h: number) {
  const c = canvas(w, h)
  c.rect(1, 1, w - 2, 1, '#3A4050')
  c.rect(1, h - 2, w - 2, 1, '#191C24')
  for (const x of [Math.floor(w / 3), Math.floor((2 * w) / 3)]) c.rect(x, 2, 1, h - 4, '#1C1F28')
  for (const [x, y] of [[3, 3], [w - 19, 3], [3, h - 6], [w - 19, h - 6]] as const) danger(c, x, y, 16, 3, JAUNE[0], ACIER[0], 2)
  return c
}

/** The rocket, 48 by 96 cells, nose up: back from a flight it shows its legs and its soot. */
export function fusee(etat: 'pas' | 'retour') {
  const c = canvas(48, 96)
  const cx = 24
  const rang = (y: number) => (y < 16 ? 1 + ((y - 2) / 14) ** 0.7 * 7 : y < 56 ? 8 : 9)
  for (let y = 2; y < 62; y += 1) {
    const hw = Math.round(rang(y))
    for (let x = cx - hw; x < cx + hw; x += 1) {
      const t = (x - (cx - hw)) / (hw * 2)
      let col: string = COQUE[t < 0.14 ? 2 : t < 0.42 ? 4 : t < 0.64 ? 3 : t < 0.84 ? 1 : 0]!
      if (y % 10 === 5 && y > 18) col = COQUE[Math.max(0, t < 0.5 ? 1 : 0)]!
      if (etat === 'retour') {
        if (y > 34 && noise(x, y) > 1.5 - y / 60) col = mix(col, ACIER[3]!, 0.3)
        if (y > 50) col = mix(col, ACIER[1]!, (y - 50) / 16)
      }
      c.set(x, y, col)
    }
  }
  for (let y = 2; y < 9; y += 1) {
    const hw = Math.round(rang(y))
    for (let x = cx - hw; x < cx + hw; x += 1) c.set(x, y, x < cx - hw / 3 ? ROUGE[3]! : x < cx + hw / 2 ? ROUGE[2]! : ROUGE[1]!)
  }
  c.rect(cx, 0, 1, 3, ACIER[3])
  c.rect(cx - 7, 16, 14, 2, ROUGE[2])
  c.rect(cx - 7, 16, 4, 2, ROUGE[3])
  disc(c, cx - 1, 24, 3.4, 3.4, ACIER[2])
  disc(c, cx - 1, 24, 2.4, 2.4, BLEU[3])
  c.set(cx - 2, 23, EAU[4])
  for (const y of [34, 35, 36]) for (let x = cx - 8; x < cx + 8; x += 1) if ((x + 16) % 8 < 4) c.set(x, y, ACIER[1])
  c.rect(cx - 3, 40, 6, 8, COQUE[1])
  c.rect(cx - 3, 40, 6, 1, COQUE[0])
  c.rect(cx - 2, 42, 4, 1, ACIER[4])
  c.rect(cx - 2, 44, 3, 1, ACIER[4])
  c.rect(cx + 5, 12 + 8, 1, 36, COQUE[0])
  if (etat !== 'retour') {
    for (let i = 0; i < 16; i += 1) {
      const y = 46 + i
      const l = Math.round(i * 0.42)
      c.rect(cx - 9 - l, y, l + 1, 1, i % 4 === 0 ? ROUGE[3] : ROUGE[2])
      c.rect(cx + 8, y, l + 1, 1, ROUGE[1])
    }
  } else {
    for (const [x, m] of [[cx - 9, -1], [cx + 8, 1]] as const) {
      c.rect(x + (m < 0 ? -2 : 1), 12 + 8, 3, 6, ACIER[3])
      for (let y = 21; y < 25; y += 2) c.rect(x + (m < 0 ? -2 : 1), y, 3, 1, ACIER[1])
      line(c, x, 48, x + m * 12, 68, ACIER[3])
      line(c, x + m, 48, x + m * 13, 68, ACIER[1])
      line(c, x, 60, x + m * 11, 66, ACIER[2])
      c.rect(x + m * 13 - 2, 68, 6, 2, ACIER[4])
      c.rect(x + m * 13 - 2, 68, 6, 1, ACIER[5])
    }
  }
  c.rect(cx - 6, 61, 12, 1, ACIER[1])
  for (let i = 0; i < 4; i += 1) c.rect(cx - 4 - i, 62 + i, 8 + i * 2, 1, i === 3 ? ACIER[0] : ACIER[2 + (i % 2)]!)
  c.rect(cx - 4, 62, 2, 3, ACIER[5])
  return c
}

const panache = (c: C, x: number, y: number, r: number, col: string, ombre: string) => disc(c, x, y, r, r * 0.7, (_, py) => (py > y + r * 0.2 ? ombre : col))
// Each image shifts the puffs: image 0 stays the one of the design.
const bouge = (image: number, k: number) => (image ? Math.round(Math.sin(k * 3 + image * 2) * 1.6) : 0)

/** The propellant vapour, seeping out while the rocket waits. */
export function vapeur() {
  const c = canvas(48, 96)
  for (const [x, y, r] of [[12, 66, 4], [18, 68, 3], [34, 67, 4], [29, 69, 3], [24, 66, 2]] as const) panache(c, x, y, r, '#FFFFFF|0.4', '#DCE0E8|0.3')
  return c
}

/** The jet under the rocket: it leaves the ground with it. */
export function jet(etat: 'decollage' | 'retour', image: number) {
  const c = canvas(48, 96)
  const cx = 24
  const up = etat === 'decollage'
  const long = 20 + (up ? [0, 3, -3] : [0, -3, 3])[image]!
  for (let y = 66; y < 66 + long; y += 1) {
    const t = (y - 66) / long
    const hw = up ? Math.max(0, Math.round((8.5 - 8.5 * t ** 1.6) + 1.4 * Math.sin(y * 1.3 + image * 2.1))) : Math.max(0, Math.round((6.5 - 6.5 * t ** 1.4) + Math.sin(y * 1.7 + image * 2.1)))
    for (let x = cx - hw; x < cx + hw; x += 1) {
      const r = Math.abs(x + 0.5 - cx) / Math.max(1, hw)
      const k = r + t * (up ? 0.75 : 0.7)
      c.set(x, y, up ? FEU[k < 0.3 ? 4 : k < 0.6 ? 3 : k < 0.9 ? 2 : k < 1.25 ? 1 : 0]! : k < 0.35 ? '#FFFFFF' : k < 0.7 ? EAU[4] : k < 1.05 ? EAU[2] : EAU[1])
    }
  }
  return c
}

/** What the jet raises around the pad. It stays on the ground when the rocket goes, level with the pad. */
export function nuage(etat: 'decollage' | 'retour', image: number) {
  const c = canvas(48, 96)
  if (etat === 'decollage') {
    for (const [x, y, r] of [[8, 80, 8], [40, 80, 8], [15, 83, 7], [33, 83, 7], [24, 82, 9], [4, 85, 5], [44, 85, 5]] as const) panache(c, x + bouge(image, y + x), y + bouge(image, x), r, PAPIER[1], '#A8A4A0')
    for (const [x, y, r] of [[12, 75, 5], [36, 75, 5]] as const) panache(c, x + bouge(image, y + x), y + bouge(image, x), r + (image === 1 ? 1 : 0), PAPIER[2], PAPIER[0])
    return c
  }
  for (const [x, y, r] of [[10, 82, 6], [38, 82, 6], [17, 84, 5], [31, 84, 5], [3, 85, 3], [45, 85, 3]] as const) panache(c, x + bouge(image, y + x), y + bouge(image, x), r, '#DCE0E8|0.5', '#B0B6C2|0.4')
  return c
}

/** The launch tower and its pad, 60 by 80 cells. The rocket stands on the pad: its axis on cell 38, its base on row 72. */
export function tour() {
  const c = canvas(60, 80)
  c.rect(1, 76, 58, 4, SH)
  treillis(c, 4, 8, 12, 64, ACIER[3]!, ACIER[1]!)
  c.rect(5, 8, 1, 64, ACIER[5])
  for (const y of [8, 24, 40, 56]) {
    c.rect(2, y, 16, 2, ALU[1])
    c.rect(2, y, 16, 1, ALU[3])
    c.rect(2, y + 2, 16, 1, ACIER[0])
  }
  for (let y = 12; y < 72; y += 2) c.rect(13, y, 2, 1, ACIER[4])
  c.rect(9, 0, 2, 8, ACIER[4])
  c.rect(9, 0, 1, 8, ACIER[5])
  c.rect(9, 0, 2, 1, ROUGE[3])
  c.rect(6, 4, 8, 1, ACIER[2])
  for (const [y, l] of [[24, 13], [40, 13]] as const) {
    c.rect(16, y, l, 2, ALU[0])
    c.rect(16, y, l, 1, ALU[3])
    c.rect(27, y - 1, 2, 4, ACIER[1])
    line(c, 16, y + 2, 22, y + 5, ACIER[2])
  }
  box(c, 0, 72, 60, 5, ACIER[2], ACIER[4], ACIER[0])
  danger(c, 1, 73, 26, 2)
  danger(c, 48, 73, 11, 2)
  c.rect(28, 72, 20, 5, ACIER[0])
  c.rect(30, 73, 16, 3, '#14161E')
  c.rect(28, 72, 20, 1, ACIER[3])
  for (const x of [2, 18, 52]) c.rect(x, 77, 4, 2, ACIER[1])
  return c
}

export function parabole() {
  const c = canvas(60, 58)
  c.rect(14, 55, 32, 3, SH)
  treillis(c, 22, 36, 16, 16, ACIER[3]!, ACIER[1]!, 5)
  box(c, 18, 46, 24, 10, ALU[1], ALU[3], ACIER[2])
  c.rect(21, 49, 7, 4, BLEU[3])
  c.rect(21, 49, 3, 1, EAU[3])
  c.rect(32, 49, 6, 7, ACIER[2])
  c.rect(16, 55, 28, 2, ACIER[2])
  disc(c, 31, 25, 25, 22, ACIER[2])
  disc(c, 28, 23, 26, 22, (x, y, d) => {
    if (d > 0.9) return (x - 28) + (y - 23) < 0 ? COQUE[4]! : COQUE[1]!
    const a = Math.atan2(y - 23, x - 28)
    const rib = Math.abs(((a * 12) / Math.PI) % 1) < 0.14 || (d > 0.42 && d < 0.47)
    if (rib) return COQUE[0]!
    return d < 0.3 ? COQUE[1]! : (x - 28) + (y - 23) > 4 ? COQUE[3]! : COQUE[2]!
  })
  disc(c, 28, 23, 3, 3, ACIER[3])
  for (const [x, y] of [[8, 8], [48, 8], [28, 44]] as const) line(c, x, y, 36, 12, ACIER[1]!)
  box(c, 33, 8, 7, 6, ACIER[2], ACIER[5], ACIER[0])
  c.rect(35, 10, 3, 2, ROUGE[3])
  return c
}

export function reservoirs() {
  const c = canvas(46, 42)
  c.rect(2, 39, 42, 3, SH)
  for (const [x, h] of [[6, 14], [18, 14], [28, 14], [40, 14]] as const) {
    c.rect(x, 26, 2, h, ACIER[3])
    c.rect(x, 26, 1, h, ACIER[5])
  }
  c.rect(4, 32, 16, 1, ACIER[2])
  c.rect(26, 32, 16, 1, ACIER[2])
  boule(c, 13, 16, 13, COQUE)
  boule(c, 34, 20, 11, COQUE)
  for (const [cx, cy, r] of [[13, 16, 13], [34, 20, 11]] as const) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      const dy = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)) * 0.22
      c.set(x, Math.round(cy + dy), COQUE[0]!)
    }
    c.rect(cx - 2, cy - r - 1, 5, 2, ACIER[2])
    c.rect(cx - 1, cy - r - 2, 3, 1, ACIER[4])
  }
  c.rect(7, 7, 12, 3, ROUGE[2])
  c.rect(7, 7, 12, 1, ROUGE[3])
  c.rect(29, 14, 10, 2, BLEU[3])
  c.rect(20, 28, 8, 2, ACIER[3])
  c.rect(20, 28, 8, 1, ACIER[5])
  c.rect(22, 26, 4, 6, ACIER[1])
  c.rect(21, 25, 6, 2, ROUGE[2])
  c.rect(21, 25, 6, 1, ROUGE[4])
  c.rect(0, 38, 46, 2, ACIER[2])
  c.rect(0, 38, 46, 1, ACIER[4])
  return c
}

export function dome() {
  const c = canvas(52, 42)
  c.rect(2, 39, 48, 3, SH)
  box(c, 6, 21, 40, 18, ALU[1], ALU[3], ACIER[2])
  for (let x = 12; x < 44; x += 8) c.rect(x, 22, 1, 16, ALU[0])
  c.rect(6, 21, 40, 2, ACIER[3])
  c.rect(6, 21, 40, 1, ALU[4])
  c.rect(21, 28, 10, 11, ACIER[2])
  c.rect(22, 29, 8, 10, ACIER[1])
  c.rect(28, 34, 1, 2, JAUNE[1])
  c.rect(10, 27, 6, 5, BLEU[2])
  c.rect(10, 27, 3, 1, EAU[3])
  c.rect(36, 27, 6, 5, BLEU[2])
  c.rect(36, 27, 3, 1, EAU[3])
  disc(c, 26, 21, 20, 19, (x, y) => (y > 20 ? null : COQUE[(x - 26) < -10 ? 3 : (x - 26) < 6 ? 2 : (x - 26) < 13 ? 1 : 0]!))
  for (let i = 1; i < 6; i += 1) for (let y = 3; y < 21; y += 1) {
    const r = Math.sqrt(Math.max(0, 1 - ((y - 21) / 19) ** 2))
    c.set(Math.round(26 + (i * 7 - 21) * r), y, COQUE[0]!)
  }
  for (let y = 3; y < 21; y += 1) c.rect(24, y, 6, 1, BLEU[0])
  c.rect(24, 3, 6, 1, ACIER[1])
  line(c, 28, 19, 31, 9, ALU[3])
  line(c, 29, 19, 32, 9, ACIER[3])
  c.rect(30, 7, 3, 3, ALU[4])
  c.rect(25, 8, 1, 1, '#FFFFFF')
  c.rect(0, 38, 52, 2, ACIER[2])
  c.rect(0, 38, 52, 1, ACIER[4])
  return c
}

export function pylone() {
  const c = canvas(24, 66)
  c.rect(4, 63, 16, 3, SH)
  line(c, 12, 10, 0, 62, ACIER[2]!)
  line(c, 12, 10, 23, 62, ACIER[2]!)
  for (let i = 0; i < 9; i += 1) {
    const y = 8 + i * 6
    const hw = 1 + Math.round(i * 0.7)
    c.rect(12 - hw, y, hw * 2 + 1, 1, ACIER[4])
    line(c, 12 - hw, y, 12 + hw + 1, y + 6, ACIER[2]!)
    line(c, 12 + hw, y, 11 - hw, y + 6, ACIER[3]!)
    c.set(12 - hw - 1, y, ALU[3])
    c.set(12 + hw + 1, y, ACIER[2])
  }
  line(c, 11, 8, 6, 60, ALU[2]!)
  line(c, 13, 8, 18, 60, ACIER[3]!)
  c.rect(11, 0, 2, 9, ACIER[5])
  c.rect(11, 0, 2, 2, ROUGE[3])
  disc(c, 6, 18, 3.6, 5, (x) => (x < 6 ? COQUE[4]! : COQUE[1]!))
  c.rect(8, 18, 3, 1, ACIER[3])
  disc(c, 18, 28, 3.2, 4.4, (x) => (x > 18 ? COQUE[3]! : COQUE[1]!))
  c.rect(14, 28, 3, 1, ACIER[3])
  for (const y of [4, 7]) c.rect(7, y, 10, 1, ACIER[3])
  box(c, 7, 58, 10, 6, ACIER[3], ACIER[5], ACIER[1])
  c.rect(5, 63, 14, 1, ACIER[1])
  return c
}

export function ballon() {
  const c = canvas(30, 40)
  disc(c, 15, 13, 13, 13, (x, y) => {
    const k = (x - 15) * 0.8 + (y - 13) * 0.6
    const col = COQUE[k < -6 ? 4 : k < 0 ? 3 : k < 5 ? 2 : k < 8 ? 1 : 0]!
    return Math.abs((x - 15) % 6) === 0 ? mix(col, COQUE[0]!, 0.5) : col
  })
  c.rect(11, 25, 8, 2, COQUE[0])
  c.rect(14, 27, 2, 1, ACIER[2])
  line(c, 15, 27, 15, 31, ACIER[3]!)
  disc(c, 15, 32, 4, 1.6, ORANGE[2]!)
  c.rect(12, 31, 3, 1, ORANGE[3])
  line(c, 12, 33, 11, 35, ACIER[3]!)
  line(c, 18, 33, 19, 35, ACIER[3]!)
  box(c, 10, 35, 10, 5, OR[1], OR[3], OR[0])
  c.rect(12, 36, 3, 2, BLEU[3])
  c.set(17, 37, ROUGE[3])
  c.rect(4, 37, 6, 2, BLEU[2])
  c.rect(20, 37, 6, 2, BLEU[2])
  c.rect(4, 37, 6, 1, BLEU[4])
  c.rect(20, 37, 6, 1, BLEU[4])
  return c
}

export function hangar() {
  const c = canvas(50, 42)
  c.rect(2, 39, 46, 3, SH)
  box(c, 2, 8, 46, 31, ALU[1], ALU[3], ACIER[2])
  for (let x = 6; x < 46; x += 4) c.rect(x, 9, 1, 29, ALU[0])
  for (let x = 2; x < 48; x += 1) c.rect(x, 7 - Math.round(3 * Math.sin(((x - 2) / 46) * Math.PI)), 1, 4, ACIER[3])
  for (let x = 2; x < 48; x += 1) c.set(x, 7 - Math.round(3 * Math.sin(((x - 2) / 46) * Math.PI)), ALU[3])
  c.rect(4, 10, 42, 2, BLEU[3])
  c.rect(4, 10, 14, 2, ROUGE[2])
  c.rect(14, 14, 24, 25, ACIER[0])
  c.rect(19, 18, 14, 21, COQUE[1])
  c.rect(19, 18, 4, 21, COQUE[3])
  c.rect(29, 18, 4, 21, COQUE[0])
  c.rect(19, 28, 14, 2, ROUGE[2])
  c.rect(14, 14, 24, 1, JAUNE[1])
  for (const x of [8, 40]) {
    box(c, x, 14, 6, 25, ALU[2], ALU[4], ACIER[3])
    c.rect(x + 1, 22, 4, 1, ALU[0])
    c.rect(x + 1, 30, 4, 1, ALU[0])
  }
  c.rect(0, 38, 50, 2, ACIER[2])
  c.rect(0, 38, 50, 1, ACIER[4])
  return c
}

export function rover() {
  const c = canvas(70, 46)
  c.rect(4, 43, 62, 3, SH)
  c.rect(14, 4, 2, 18, ACIER[3])
  c.rect(14, 4, 1, 18, ACIER[5])
  box(c, 10, 0, 10, 6, COQUE[2], COQUE[4], ACIER[3])
  c.rect(12, 2, 3, 2, BLEU[1])
  c.set(12, 2, EAU[4])
  c.rect(16, 2, 2, 2, ACIER[1])
  line(c, 56, 20, 64, 2, ACIER[4]!)
  c.set(64, 1, ROUGE[3])
  c.rect(26, 11, 36, 2, ACIER[3])
  for (let x = 28; x < 60; x += 1) for (let y = 7; y < 11; y += 1) c.set(x, y, (x - 28) % 6 === 5 || y === 8 ? BLEU[3]! : BLEU[2]!)
  c.rect(28, 7, 32, 1, BLEU[4])
  c.rect(42, 13, 3, 7, ACIER[2])
  box(c, 8, 19, 56, 13, COQUE[2], COQUE[4], ACIER[3])
  c.rect(9, 29, 54, 2, COQUE[1])
  c.rect(4, 22, 5, 7, ACIER[2])
  c.rect(4, 22, 5, 1, ACIER[4])
  c.rect(2, 24, 2, 3, JAUNE[1])
  danger(c, 10, 26, 16, 2)
  box(c, 30, 21, 12, 7, ACIER[1], ACIER[3], ACIER[0])
  c.rect(31, 22, 6, 1, VERT[3])
  c.rect(31, 24, 4, 1, VERT[2])
  c.set(39, 22, ROUGE[3])
  c.set(39, 25, JAUNE[1])
  box(c, 45, 21, 16, 6, OR[1], OR[3], OR[0])
  for (let x = 47; x < 60; x += 3) c.rect(x, 22, 1, 4, OR[0])
  line(c, 16, 32, 8, 37, ACIER[2]!)
  line(c, 16, 32, 26, 37, ACIER[2]!)
  line(c, 54, 32, 46, 37, ACIER[2]!)
  line(c, 54, 32, 62, 37, ACIER[2]!)
  c.rect(26, 33, 22, 2, ACIER[3])
  c.rect(26, 33, 22, 1, ACIER[5])
  for (const x of [9, 26, 44, 61]) {
    disc(c, x, 38, 6.5, 6.5, (px, py) => ((px + py) % 3 === 0 ? ACIER[0]! : ACIER[1]!))
    disc(c, x, 38, 3.6, 3.6, (px, py) => (px + py < x + 38 ? ALU[3]! : ALU[1]!))
    c.rect(x - 1, 37, 2, 2, ACIER[1])
  }
  return c
}

export function sonde() {
  const c = canvas(44, 52)
  c.rect(4, 49, 36, 3, SH)
  for (const [a, b] of [[22, 8], [22, 36], [22, 22]] as const) {
    line(c, a, 34, b, 49, ACIER[3]!)
    line(c, a + 1, 34, b + 1, 49, ACIER[1]!)
  }
  c.rect(14, 42, 16, 1, ACIER[2])
  for (const [x0, w] of [[0, 13], [31, 13]] as const) {
    for (let x = x0; x < x0 + w; x += 1) for (let y = 16; y < 28; y += 1) c.set(x, y, (x - x0) % 4 === 3 || (y - 16) % 4 === 3 ? BLEU[3]! : BLEU[2]!)
    c.rect(x0, 16, w, 1, BLEU[5])
  }
  c.rect(13, 21, 31 - 13, 2, ACIER[4])
  box(c, 13, 13, 18, 20, OR[1], OR[3], OR[0])
  for (let i = 0; i < 26; i += 1) c.rect(14 + Math.floor(noise(i, 31) * 14), 14 + Math.floor(noise(i, 32) * 17), 2, 1, i % 2 ? OR[2] : OR[0])
  box(c, 17, 20, 10, 7, ACIER[1], ACIER[3], ACIER[0])
  disc(c, 22, 23.5, 2.4, 2.4, BLEU[2])
  c.set(21, 22, EAU[4])
  c.rect(21, 9, 3, 4, ACIER[3])
  disc(c, 22, 6, 11, 5.6, (x, y) => (y > 7 ? null : (x < 19 ? COQUE[4] : x < 27 ? COQUE[3] : COQUE[1])!))
  c.rect(11, 7, 23, 1, COQUE[0])
  c.rect(21, 1, 2, 5, ACIER[4])
  c.rect(21, 33, 3, 2, ACIER[1])
  return c
}

export function caisses() {
  const c = canvas(52, 42)
  c.rect(2, 39, 48, 3, SH)
  c.rect(2, 36, 48, 2, CARTON[2])
  c.rect(2, 36, 48, 1, CARTON[3])
  for (const x of [3, 23, 44]) c.rect(x, 38, 5, 2, CARTON[1])
  const malle = (x: number, y: number, w: number, h: number, a: string, b: string, d: string) => {
    box(c, x, y, w, h, a, b, d)
    for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]] as const) {
      c.rect(cx, cy, 3, 3, ALU[3])
      c.set(cx + 1, cy + 1, ACIER[2])
    }
    c.rect(x + 1, y + Math.floor(h / 2), w - 2, 1, d)
    c.rect(x + 6, y + Math.floor(h / 2) - 1, 4, 3, ALU[2])
    c.rect(x + w - 10, y + Math.floor(h / 2) - 1, 4, 3, ALU[2])
  }
  malle(4, 16, 26, 20, '#3E5E78', '#5A82A0', '#26405A')
  danger(c, 8, 19, 18, 3)
  c.rect(10, 28, 14, 5, PAPIER[2])
  c.rect(11, 29, 9, 1, ACIER[3])
  c.rect(11, 31, 6, 1, ACIER[3])
  malle(31, 22, 18, 14, ALU[1], ALU[3], ACIER[2])
  c.rect(35, 30, 8, 3, PAPIER[2])
  c.rect(36, 31, 6, 1, ROUGE[2])
  malle(11, 2, 22, 14, '#7A4A2A', '#A8703C', '#4E2E1A')
  c.rect(16, 4, 12, 3, PAPIER[1])
  c.rect(17, 5, 9, 1, ACIER[3])
  c.rect(20, 2, 2, 34, ACIER[1])
  box(c, 36, 12, 8, 10, ROUGE[2], ROUGE[4], ROUGE[0])
  c.rect(38, 10, 4, 2, ACIER[3])
  c.rect(37, 16, 6, 2, PAPIER[2])
  return c
}

export function scaphandre() {
  const c = canvas(32, 60)
  c.rect(3, 57, 26, 3, SH)
  c.rect(4, 2, 2, 54, ACIER[3])
  c.rect(4, 2, 1, 54, ACIER[5])
  c.rect(26, 2, 2, 54, ACIER[2])
  c.rect(26, 2, 1, 54, ACIER[4])
  c.rect(4, 2, 24, 2, ACIER[3])
  c.rect(4, 2, 24, 1, ACIER[5])
  c.rect(1, 55, 30, 2, ACIER[2])
  c.rect(1, 55, 30, 1, ACIER[4])
  c.rect(15, 4, 2, 3, ACIER[1])
  box(c, 8, 16, 16, 18, ACIER[2], ACIER[4], ACIER[0])
  disc(c, 16, 12, 7.5, 7.5, (x, y) => (x + y < 24 ? COQUE[4]! : x + y < 31 ? COQUE[3]! : COQUE[1]!))
  disc(c, 16, 12.5, 5.2, 4.8, (x, y) => (x + y < 25 ? OR[3]! : x + y < 29 ? OR[2]! : OR[0]!))
  c.rect(13, 10, 2, 1, '#FFFFFF')
  c.rect(10, 19, 12, 2, ACIER[3])
  box(c, 9, 20, 14, 14, COQUE[3], COQUE[4], COQUE[0])
  box(c, 12, 23, 8, 6, ACIER[1], ACIER[3], ACIER[0])
  c.set(14, 25, ROUGE[3])
  c.set(16, 25, VERT[3])
  c.set(18, 25, JAUNE[1])
  c.rect(14, 27, 4, 1, ACIER[4])
  for (const [x, l] of [[6, COQUE[3]], [23, COQUE[1]]] as const) {
    c.rect(x, 21, 3, 14, l!)
    c.rect(x, 26, 3, 1, ORANGE[2])
    c.rect(x, 33, 3, 3, ACIER[1])
    c.rect(x, 33, 3, 1, ORANGE[2])
  }
  c.rect(10, 34, 12, 3, ACIER[3])
  c.rect(10, 37, 5, 13, COQUE[3])
  c.rect(17, 37, 5, 13, COQUE[1])
  c.rect(10, 37, 1, 13, COQUE[4])
  c.rect(10, 43, 5, 1, ORANGE[2])
  c.rect(17, 43, 5, 1, ORANGE[2])
  c.rect(9, 50, 6, 5, ACIER[1])
  c.rect(17, 50, 6, 5, ACIER[1])
  c.rect(9, 50, 6, 1, ACIER[3])
  c.rect(17, 50, 6, 1, ACIER[3])
  return c
}

export function telescope() {
  const c = canvas(44, 58)
  c.rect(6, 55, 32, 3, SH)
  line(c, 22, 32, 8, 55, ACIER[4]!)
  line(c, 23, 32, 9, 55, ACIER[1]!)
  line(c, 22, 32, 36, 55, ACIER[3]!)
  line(c, 23, 32, 37, 55, ACIER[1]!)
  line(c, 22, 32, 22, 54, ACIER[3]!)
  line(c, 23, 32, 23, 54, ACIER[1]!)
  c.rect(15, 44, 15, 1, ACIER[2])
  const tube = (a: number, b: number, hw: number, ramp: readonly string[]) => {
    for (let i = a; i < b; i += 1) {
      const [x, y] = [14 + i * 0.62, 34 - i * 0.78]
      for (let k = -hw; k <= hw; k += 0.5) {
        const px = Math.round(x + k * 0.78)
        const py = Math.round(y + k * 0.62)
        const t = (k + hw) / (hw * 2)
        c.set(px, py, ramp[t < 0.2 ? 3 : t < 0.55 ? 2 : t < 0.8 ? 1 : 0]!)
      }
    }
  }
  tube(0, 40, 6, COQUE)
  tube(36, 41, 7, [ACIER[1]!, ACIER[2]!, ACIER[3]!, ACIER[5]!])
  tube(14, 18, 6.5, [OR[0]!, OR[1]!, OR[2]!, OR[3]!])
  tube(-6, 0, 4, [ACIER[0]!, ACIER[1]!, ACIER[2]!, ACIER[4]!])
  tube(-10, -6, 2, [ACIER[0]!, ACIER[1]!, ACIER[3]!, ACIER[4]!])
  line(c, 16, 22, 30, 4, ACIER[4]!)
  line(c, 17, 23, 31, 5, ACIER[1]!)
  disc(c, 23, 30, 4, 4, (x, y) => (x + y < 53 ? ACIER[4]! : ACIER[1]!))
  c.set(23, 30, JAUNE[1])
  line(c, 23, 30, 33, 38, ACIER[3]!)
  box(c, 32, 36, 6, 6, ACIER[2], ACIER[4], ACIER[0])
  return c
}

export function generateur() {
  const c = canvas(50, 44)
  c.rect(2, 41, 46, 3, SH)
  c.rect(37, 4, 4, 12, ACIER[2])
  c.rect(37, 4, 1, 12, ACIER[5])
  c.rect(36, 3, 6, 2, ACIER[1])
  for (const [x, y] of [[39, 1], [41, 0], [38, 0]] as const) c.set(x, y, '#FFFFFF|0.4')
  box(c, 3, 14, 44, 24, '#3E6E5A', '#5A9478', '#26483A')
  c.rect(4, 15, 42, 2, '#4E8870')
  c.rect(3, 36, 44, 2, ACIER[1])
  box(c, 6, 18, 17, 15, ACIER[1], ACIER[3], ACIER[0])
  disc(c, 14.5, 25.5, 6.4, 6.4, ACIER[0])
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) line(c, 14 + dx, 25 + dy, 14 + dx * 5 - dy * 2, 25 + dy * 5 + dx * 2, ACIER[4]!)
  c.rect(14, 25, 2, 2, ACIER[5])
  for (let y = 19; y < 33; y += 2) c.rect(7, y, 15, 1, '#1B1E26|0.6')
  box(c, 26, 18, 18, 11, ACIER[1], ACIER[3], ACIER[0])
  disc(c, 30, 22, 2.4, 2.4, PAPIER[2])
  c.set(31, 21, ROUGE[2])
  disc(c, 36, 22, 2.4, 2.4, PAPIER[2])
  c.set(35, 21, INK)
  c.set(41, 20, VERT[3])
  c.set(41, 22, JAUNE[1])
  c.set(41, 24, ROUGE[3])
  c.rect(28, 26, 7, 2, ACIER[0])
  c.rect(28, 26, 3, 1, ROUGE[3])
  c.rect(38, 26, 4, 2, ACIER[4])
  for (let y = 30; y < 35; y += 2) c.rect(26, y, 18, 1, '#26483A')
  danger(c, 3, 34, 44, 2, JAUNE[1], ACIER[0], 2)
  c.rect(1, 38, 48, 3, ACIER[2])
  c.rect(1, 38, 48, 1, ACIER[4])
  c.rect(46, 30, 2, 2, ROUGE[2])
  c.rect(47, 32, 1, 7, ACIER[0])
  return c
}

/** The crab's capsule, a small module back from orbit, with its cushion. */
export function capsule(dort = false) {
  const c = canvas(38, 22)
  c.rect(1, 19, 36, 3, SH)
  for (let y = 2; y < 18; y += 1) {
    const hw = 9 + Math.round(((y - 2) / 16) * 7)
    for (let x = 19 - hw; x < 19 + hw; x += 1) {
      const t = (x - (19 - hw)) / (hw * 2)
      c.set(x, y, COQUE[t < 0.12 ? 2 : t < 0.4 ? 3 : t < 0.7 ? 2 : t < 0.88 ? 1 : 0]!)
    }
  }
  c.rect(10, 1, 18, 2, ACIER[3])
  c.rect(10, 1, 18, 1, ACIER[5])
  c.rect(14, 0, 10, 1, ACIER[2])
  for (const y of [5, 15]) for (let x = 5; x < 34; x += 3) if (Math.abs(x - 19) < 8 + (y > 9 ? 8 : 2)) c.set(x, y, ACIER[3])
  disc(c, 19, 10, 11.5, 6.4, ACIER[3])
  disc(c, 19, 10, 10.5, 5.5, ACIER[0])
  disc(c, 19, 11, 9.6, 4.4, (x, y) => ((x + y) % 4 === 0 ? ORANGE[1]! : y < 10 ? ORANGE[3]! : ORANGE[2]!))
  if (dort) c.sprite(['...cccccccccc...', '..cLLLLLLLLLLc..', '.cLccccccccccsc.', 'cccgccccccgcccss', 'ccccccccccccccss', '.ccccccLLccccss.', '..cc.cccccc.cc..'], { c: '#D97757', L: '#EE9A7C', s: '#B85A3C', g: '#1B1730' }, 11, 7)
  for (let y = 18; y < 21; y += 1) {
    const hw = 16 - (y - 18) * 2
    for (let x = 19 - hw; x < 19 + hw; x += 1) c.set(x, y, noise(x, y) > 0.7 ? ACIER[2]! : ACIER[0]!)
  }
  c.rect(3, 17, 32, 1, ORANGE[0])
  disc(c, 34, 8, 3, 5, (x) => (x < 34 ? COQUE[3]! : COQUE[0]!))
  c.rect(29, 8, 3, 1, ACIER[2])
  c.set(8, 11, VERT[3])
  c.set(8, 13, ROUGE[3])
  return c
}

const TEINTES: Record<Tenue, string> = { Corail: '#E4633A', Turquoise: '#2A9D8F', Violet: '#7F6BD6', Rose: '#D4537E', Bleu: '#3F7CC8', Or: '#E0A030' }

/** Repaints `person()`: an open white coat, the outfit's colour at the collar, the waistcoat and the pocket pen. */
export function scientifique(p: C, tenue: Tenue) {
  const teinte = TEINTES[tenue]
  const blouse = '#F2F4F2'
  const c = canvas(16, 22)
  const map = new Map<string, string>([[teinte, blouse], [mix(teinte, '#1B1730', 0.3), '#BCC4CC'], [mix(teinte, '#FFFFFF', 0.25), '#FFFFFF'], ['#F4E4C1', teinte]])
  for (let y = 0; y < 22; y += 1) for (let x = 0; x < 16; x += 1) {
    const q = p.get(x, y)
    if (q) c.set(x, y, map.get(q) ?? q)
  }
  for (let y = 14; y < 22; y += 1) {
    c.set(7, y, teinte)
    c.set(8, y, teinte)
    c.set(6, y, '#BCC4CC')
    c.set(9, y, '#BCC4CC')
  }
  c.set(4, 17, teinte)
  c.set(11, 17, teinte)
  c.set(4, 16, '#BCC4CC')
  return c
}

/** The field seat: a tube frame, a canvas back and straps. It stands behind the person. */
export function chaise() {
  const c = canvas(60, 45)
  c.rect(13, 3, 2, 22, ACIER[3])
  c.rect(13, 3, 1, 22, ACIER[5])
  c.rect(45, 3, 2, 22, ACIER[2])
  c.rect(45, 3, 1, 22, ACIER[4])
  c.rect(13, 3, 34, 2, ALU[1])
  c.rect(13, 3, 34, 1, ALU[3])
  box(c, 47, 7, 9, 7, ACIER[1], ACIER[3], ACIER[0])
  c.rect(48, 8, 4, 1, VERT[3])
  c.rect(48, 10, 6, 1, VERT[2])
  c.set(54, 8, ROUGE[3])
  c.rect(47, 14, 9, 1, ACIER[2])
  line(c, 52, 7, 56, 1, ACIER[4]!)
  c.rect(20, 4, 20, 22, INK)
  c.rect(21, 5, 18, 20, BLEU[2])
  c.rect(21, 5, 18, 2, BLEU[4])
  c.rect(21, 7, 1, 18, BLEU[3])
  for (let y = 9; y < 25; y += 4) c.rect(23, y, 14, 1, BLEU[1])
  for (const x of [25, 33]) c.rect(x, 7, 2, 18, ACIER[2])
  for (const x of [15, 40]) {
    c.rect(x, 15, 5, 2, ACIER[0])
    c.rect(x, 15, 5, 1, ACIER[4])
    c.rect(x + 2, 17, 2, 5, ACIER[1])
  }
  return c
}

/** The open air lab bench, on trestles. Same laptop and same marks as `desk()`. */
export function paillasse(state: 'working' | 'done' | 'failed' | 'rest') {
  const c = canvas(60, 45)
  c.rect(3, 41, 54, 4, '#1B1730|0.28')
  c.rect(1, 43, 58, 2, '#1B1730|0.28')
  for (const x of [3, 52]) {
    c.rect(x, 38, 5, 4, ACIER[2])
    c.rect(x + 1, 38, 1, 4, ACIER[5])
    c.rect(x + 3, 38, 2, 4, ACIER[1])
  }
  c.rect(1, 42, 9, 1, ACIER[3])
  c.rect(1, 43, 9, 1, ACIER[0])
  c.rect(50, 42, 9, 1, ACIER[3])
  c.rect(50, 43, 9, 1, ACIER[0])
  c.rect(2, 28, 56, 12, ACIER[2])
  c.rect(2, 28, 56, 1, ACIER[0])
  for (let y = 30; y < 39; y += 3) for (let x = 3; x < 57; x += 3) c.set(x, y, ACIER[3])
  c.rect(2, 39, 56, 1, ACIER[0])
  c.rect(2, 29, 1, 10, ACIER[4])
  c.rect(57, 29, 1, 10, ACIER[1])
  c.rect(1, 18, 58, 9, ACIER[5])
  c.rect(1, 18, 58, 1, ACIER[6])
  for (let i = 0; i < 20; i += 1) {
    const x = 2 + Math.floor(noise(i, 11) * 54)
    const y = 19 + Math.floor(noise(i, 12) * 7)
    c.rect(x, y, Math.min(3 + Math.floor(noise(i, 13) * 8), 58 - x), 1, noise(i, 14) > 0.5 ? ALU[2]! : ALU[4]!)
  }
  c.rect(0, 26, 60, 2, ACIER[3])
  c.rect(0, 26, 60, 1, ACIER[5])
  c.rect(0, 27, 60, 1, ACIER[1])
  c.rect(0, 19, 1, 7, ACIER[4])
  c.rect(59, 19, 1, 7, ACIER[3])
  c.rect(27, 20, 13, 6, VERT[0])
  c.rect(27, 20, 13, 1, VERT[1])
  for (const [x, y, w] of [[28, 22, 5], [34, 22, 4], [29, 24, 8]] as const) c.rect(x, y, w, 1, OR[1])
  c.rect(31, 21, 3, 2, ACIER[0])
  c.rect(36, 23, 2, 2, ACIER[1])
  c.set(29, 21, ROUGE[3])
  c.rect(5, 30, 50, 10, ACIER[0])
  c.rect(6, 31, 48, 8, PAPIER[2])
  c.rect(6, 31, 48, 1, PAPIER[3])
  c.rect(6, 38, 48, 1, PAPIER[0])
  danger(c, 6, 31, 2, 8, JAUNE[1], ACIER[0], 1)
  danger(c, 52, 31, 2, 8, JAUNE[1], ACIER[0], 1)
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
  c.rect(42, 15, 6, 8, INK)
  c.rect(41, 15, 1, 1, INK)
  c.rect(43, 15, 4, 7, '#DCEAF0')
  c.rect(43, 18, 4, 4, VERT[2])
  c.rect(43, 18, 4, 1, VERT[3])
  c.set(44, 20, VERT[4])
  c.set(45, 19, VERT[4])
  c.rect(46, 15, 1, 7, '#A8C4D0')
  c.rect(33, 17, 9, 1, ACIER[1])
  c.rect(33, 19, 9, 1, ACIER[2])
  for (const [x, col] of [[34, ROUGE[3]], [37, EAU[2]], [40, JAUNE[1]]] as const) {
    c.rect(x, 12, 2, 7, '#DCEAF0')
    c.rect(x, 15, 2, 4, col!)
    c.rect(x, 12, 2, 1, ACIER[4])
  }
  c.rect(50, 8, 1, 16, ACIER[3])
  c.rect(49, 23, 8, 1, ACIER[1])
  c.rect(50, 11, 4, 1, ACIER[2])
  disc(c, 54, 13, 3, 3, '#DCEAF0')
  disc(c, 54, 14, 2.4, 1.8, ORANGE[3]!)
  c.rect(53, 8, 2, 3, '#DCEAF0')
  c.rect(53, 7, 2, 1, ACIER[4])
  c.set(53, 12, '#FFFFFF')
  c.rect(53, 21, 3, 3, ACIER[2])
  c.rect(53, 21, 1, 3, ACIER[5])
  if (!off) {
    c.rect(54, 18, 1, 3, EAU[2])
    c.set(54, 17, EAU[4])
    c.set(53, 19, EAU[1])
    c.set(55, 19, EAU[1])
  }
  return c
}

/** The mission control console: a chamfered screen, its desk and a column planted in the ground. 36 by 68 cells, the screen on the same marks. */
export function console_() {
  const c = canvas(36, 68)
  c.rect(4, 65, 28, 3, SH)
  c.rect(13, 52, 10, 14, ACIER[2])
  c.rect(13, 52, 3, 14, ACIER[4])
  c.rect(21, 52, 2, 14, ACIER[1])
  for (let y = 54; y < 64; y += 3) c.rect(16, y, 5, 1, ACIER[0])
  c.rect(8, 64, 20, 2, ACIER[1])
  c.rect(8, 64, 20, 1, ACIER[3])
  line(c, 9, 52, 4, 65, ACIER[3]!)
  line(c, 26, 52, 31, 65, ACIER[1]!)
  for (let y = 40; y < 52; y += 1) {
    const i = Math.floor((51 - y) / 3)
    c.rect(i, y, 36 - i * 2, 1, ACIER[1])
    c.set(i, y, ACIER[4])
    c.set(35 - i, y, ACIER[0])
  }
  c.rect(0, 51, 36, 1, ACIER[0])
  c.rect(3, 40, 30, 1, ACIER[3])
  for (let i = 0; i < 6; i += 1) {
    c.rect(5 + i * 3, 43, 2, 2, [ROUGE[3], JAUNE[1], VERT[3], EAU[3], VERT[3], ROUGE[2]][i]!)
    c.set(5 + i * 3, 43, '#FFFFFF|0.5')
  }
  for (let x = 25; x < 31; x += 2) for (const y of [42, 44]) c.set(x, y, ACIER[5])
  c.rect(4, 47, 12, 2, ACIER[0])
  c.rect(5, 47, 7, 1, VERT[3])
  disc(c, 21, 48, 2, 2, ACIER[0])
  c.rect(20, 48, 2, 1, EAU[3])
  c.rect(27, 46, 2, 4, ACIER[4])
  c.rect(26, 45, 4, 1, ROUGE[3])
  c.rect(15, 28, 6, 13, ACIER[3])
  c.rect(15, 28, 2, 13, ACIER[4])
  for (const [y, i] of [[1, 3], [2, 2], [3, 1], [26, 1], [27, 2], [28, 3]] as const) c.rect(i, y, 36 - i * 2, 1, ACIER[0])
  c.rect(0, 4, 36, 22, ACIER[0])
  c.rect(1, 4, 34, 22, ACIER[2])
  c.rect(3, 2, 30, 1, ACIER[4])
  c.rect(2, 3, 32, 1, ACIER[3])
  c.rect(1, 4, 1, 22, ACIER[4])
  c.rect(34, 4, 1, 22, ACIER[1])
  c.rect(2, 26, 32, 1, ACIER[1])
  c.rect(3, 4, 30, 21, '#0B0A14')
  c.rect(4, 5, 28, 19, '#0F2A30')
  for (let y = 6; y < 24; y += 2) c.rect(4, y, 28, 1, '#13333A')
  c.rect(4, 5, 28, 1, '#1D4A4E')
  c.rect(4, 23, 28, 1, '#1D4A4E')
  c.rect(4, 6, 1, 17, '#1D4A4E')
  c.rect(31, 6, 1, 17, '#1D4A4E')
  for (const x of [6, 28]) {
    c.rect(x, 0, 2, 2, ACIER[4])
    c.rect(x, 0, 1, 2, ACIER[5])
  }
  return c
}

/** The cost plate: hazard stripes, a readout and lugs resting on the screen. 36 by 13 cells. */
export function plaque() {
  const c = canvas(36, 13)
  for (const x of [6, 28]) {
    c.rect(x, 12, 2, 1, ACIER[4])
    c.set(x, 12, ACIER[5])
  }
  c.rect(0, 0, 36, 12, ACIER[0])
  c.rect(1, 1, 34, 10, ACIER[3])
  c.rect(1, 1, 34, 1, ACIER[5])
  c.rect(1, 2, 1, 9, ACIER[4])
  c.rect(34, 2, 1, 9, ACIER[1])
  danger(c, 2, 2, 32, 1, JAUNE[1], ACIER[0], 2)
  c.rect(2, 4, 32, 6, '#14121F')
  c.rect(2, 4, 32, 1, '#0B0A14')
  for (const [x, y] of [[1, 10], [34, 10]] as const) c.set(x, y, ACIER[6])
  return c
}

/** The checklist board: a gantry with its floodlights, a countdown strip and two posts down to the ground, around a sheet `w` by `h` pixels of the room. */
export function tableau(w: number, h: number) {
  const W = Math.ceil(w / PX)
  // The sheet ends where the frame of every board does; what is under it hangs past `h`.
  const feuille = Math.ceil(h / PX) - 3
  const bas = feuille + 7
  // The room hangs the board this high: its posts reach the same ground whatever its height.
  const haut = Math.max(4, Math.min(14, 154 - h))
  const sol = Math.max(bas + 2, Math.floor((174 - haut) / PX))
  const c = canvas(W + 1, sol)
  c.rect(4, sol - 3, W - 5, 3, SH)
  for (const x of [0, W - 5]) {
    c.rect(x, 6, 5, sol - 8, ACIER[1])
    const zebre = Math.min(26, sol - bas)
    danger(c, x + 1, sol - 2 - zebre, 3, zebre, JAUNE[1], ACIER[0], 2)
    c.rect(x + 1, 6, 1, sol - 8 - zebre, ACIER[4])
  }
  c.rect(0, sol - 4, 7, 2, ACIER[3])
  c.rect(W - 7, sol - 4, 7, 2, ACIER[3])
  if (sol - bas > 14) {
    line(c, 5, bas + 8, 20, bas, ACIER[2])
    line(c, W - 6, bas + 8, W - 21, bas, ACIER[2])
  }
  box(c, 0, 3, W, bas - 3, ACIER[2], ACIER[4], ACIER[0])
  c.rect(3, 5, W - 6, feuille - 5, ACIER[1])
  c.rect(4, 6, W - 8, feuille - 6, '#C9B48A')
  c.rect(5, 7, W - 10, feuille - 7, '#FFF6DE')
  c.rect(7, feuille + 1, W - 14, 5, '#14121F')
  const leds = Math.floor((W - 16) / 4)
  const debut = Math.floor((W - leds * 4 + 1) / 2)
  for (let i = 0; i < leds; i += 1) {
    const allume = i < (leds * 2) / 3
    c.rect(debut + i * 4, feuille + 2, 3, 3, allume ? ROUGE[2] : ROUGE[0])
    c.set(debut + i * 4, feuille + 2, allume ? ROUGE[4] : ROUGE[1])
  }
  c.rect(0, 2, W, 2, ACIER[3])
  c.rect(0, 2, W, 1, ACIER[5])
  for (const k of [0.13, 0.44, 0.75]) {
    const x = Math.round(W * k)
    box(c, x, 0, 7, 3, ACIER[1], ACIER[4], ACIER[0])
    c.rect(x + 1, 1, 5, 1, JAUNE[2])
  }
  return c
}

/** The test reactor, on the stove's grid: a finned vessel, a pipe and a skid. The fire keeps its place, behind the porthole. */
export function reacteur() {
  const c = canvas(48, 68)
  c.rect(4, 62, 40, 4, SH)
  c.rect(0, 2, 22, 6, ACIER[0])
  c.rect(0, 3, 21, 4, ACIER[3])
  c.rect(0, 3, 21, 1, ACIER[5])
  c.rect(0, 6, 21, 1, ACIER[1])
  c.rect(19, 2, 6, 24, ACIER[0])
  c.rect(20, 3, 4, 23, ACIER[3])
  c.rect(20, 3, 1, 23, ACIER[5])
  c.rect(23, 3, 1, 23, ACIER[1])
  for (const x of [8, 14]) c.rect(x, 2, 2, 6, ACIER[1])
  c.rect(18, 12, 8, 2, ACIER[1])
  c.rect(18, 18, 8, 2, ACIER[1])
  disc(c, 24, 28, 15, 6, (x, y) => (y > 28 ? null : COQUE[x < 18 ? 2 : x < 28 ? 1 : 0]!))
  c.rect(8, 28, 32, 2, ACIER[4])
  c.rect(8, 28, 32, 1, ACIER[5])
  c.rect(22, 21, 4, 2, ROUGE[2])
  for (let y = 30; y < 54; y += 1) {
    for (let x = 9; x < 39; x += 1) {
      const t = (x - 9) / 30
      c.set(x, y, ACIER[t < 0.1 ? 4 : t < 0.35 ? 3 : t < 0.75 ? 2 : 1]!)
    }
  }
  for (let y = 31; y < 54; y += 3) {
    c.rect(7, y, 2, 2, ACIER[4])
    c.rect(39, y, 2, 2, ACIER[1])
  }
  c.rect(9, 53, 30, 1, ACIER[0])
  disc(c, 24, 40.5, 10.5, 10.5, ACIER[0])
  c.rect(16, 33, 16, 15, '#101218')
  for (const [x, y] of [[17, 35], [18, 34], [19, 34]] as const) c.set(x, y, EAU[1])
  c.rect(5, 54, 38, 2, ACIER[3])
  c.rect(5, 54, 38, 1, ACIER[5])
  danger(c, 5, 56, 38, 3, JAUNE[1], ACIER[0], 3)
  c.rect(5, 59, 38, 1, ACIER[0])
  for (const x of [8, 36]) c.rect(x, 60, 4, 1, ACIER[1])
  disc(c, 34, 31, 2, 2, ACIER[0])
  c.rect(33, 31, 2, 1, EAU[3])
  return c
}

/** The porthole ring, over the fire: it rounds the square of the fire off. */
export function hublot() {
  const c = canvas(48, 68)
  const [cx, cy] = [23.5, 40]
  for (let y = 31; y < 51; y += 1) {
    for (let x = 14; x < 34; x += 1) {
      const r = Math.hypot(x - cx, y - cy)
      if (r < 8.3 || r > 10.8) continue
      const k = (x - cx) * 0.7 + (y - cy) * 0.7
      c.set(x, y, r > 9.8 ? ACIER[0]! : k < -3 ? ALU[4]! : k < 3 ? ALU[2]! : ALU[0]!)
    }
  }
  for (let y = 33; y < 48; y += 1) {
    for (let x = 16; x < 32; x += 1) {
      if (Math.hypot(x - cx, y - cy) >= 10.8) c.set(x, y, ACIER[2]!)
    }
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.39
    c.set(Math.round(cx + Math.cos(a) * 9.2), Math.round(cy + Math.sin(a) * 9.2), ACIER[6]!)
  }
  return c
}

/** The reactor's fire: the engine's flames, repainted as blue plasma. */
const PLASMA: Record<string, string> = {
  '#6B4030': '#101830', '#4A2C2A': '#0E1426', '#9DB4FF': '#6CCCF4', '#B8452A': '#1E3A8C', '#E4633A': '#2A6CC8', '#FFC857': '#6CCCF4', '#FFF6DE': '#E6F8FF', '#C99A68': '#3F4A5C', '#8A5A3A': '#262C3A', '#565A78': '#26405C',
}
const PLASMA_VIF: Record<string, string> = { '#B8452A': '#2A6CC8', '#E4633A': '#6CCCF4', '#FFC857': '#E6F8FF', '#6B4030': '#3F4A5C', '#8A5A3A': '#3F4A5C', '#C99A68': '#5A6678' }
export const flammeReacteur = (svg: string, vif = false) => svg.replace(/#[0-9A-Fa-f]{6}/g, h => (vif ? PLASMA_VIF[h.toUpperCase()] : undefined) ?? PLASMA[h.toUpperCase()] ?? h)

/** The engine's ash heaps, repainted as slag with a cold glow. */
const SCORIES: Record<string, string> = {
  '#2A2036': '#22252E', '#D6CFC4': '#C8CDD6', '#A59A90': '#868D9C', '#8A8078': '#6E7480', '#7A6A5E': '#565C68', '#E4633A': '#6CCCF4', '#FFC857': '#E6F8FF', '#FFF6DE': '#BFE6F5',
}
export const scories = (svg: string) => svg.replace(/#[0-9A-Fa-f]{6}/g, h => SCORIES[h.toUpperCase()] ?? h)

/** The overheat gauge on the vessel's flank: one segment per level of slag, 48 by 68 cells. */
export function voyant(niveau: number, image = 0) {
  const c = canvas(48, 68)
  box(c, 41, 32, 5, 22, ACIER[2]!, ACIER[4]!, ACIER[0]!)
  c.rect(42, 33, 3, 20, '#14121F')
  const teintes = [VERT[3]!, VERT[3]!, JAUNE[1]!, ORANGE[2]!, ROUGE[3]!]
  for (let i = 0; i < 5; i += 1) {
    const lit = i < niveau + (niveau === 4 ? 1 : 0)
    const clignote = niveau === 4 && i === 4 && image === 1
    c.rect(42, 49 - i * 4, 3, 3, clignote ? '#FFFFFF' : lit ? teintes[i]! : ACIER[1]!)
    if (lit && !clignote) c.set(42, 49 - i * 4, mix(teintes[i]!, '#FFFFFF', 0.5))
  }
  return c
}
