import { canvas as blank, mix, noise, paths } from '../canvas'
import type { Canvas } from '../canvas'
import type { AshLevel, FireLevel } from '../hearth'
import type { DeskState } from '../sprites'

type C = Canvas
type Ramp = readonly string[]
type Put = (x: number, y: number, p: string) => void

/** A canvas that takes fractions: the curves of a clearing land on the nearest cell. */
function canvas(w: number, h: number): C {
  const c = blank(w, h)
  const set = c.set
  c.set = (x, y, p) => set(Math.round(x), Math.round(y), p)
  return c
}

const INK = '#2A2036'
const SH = '#1B1730|0.28'
const CR = '#F4E4C1'
const PAP = '#FFF6DE'
const B = ['#241810', '#38261A', '#523824', '#6E4E32', '#8E6C46', '#B08E60', '#D2B484'] as const
const E = ['#1C1712', '#2C241C', '#3E3226', '#54463A', '#6E5E4E'] as const
const M = ['#1A3024', '#24432E', '#325A38', '#467442', '#64904C', '#8EB058', '#BCD078'] as const
const F = ['#10281E', '#183A2A', '#225038', '#2E6A44', '#428652', '#62A45E'] as const
const L = ['#6E5220', '#9C7A2E', '#C8A444', '#EED27A'] as const
const P = ['#FAF2DA', '#EFE4C4', '#DCCCA4', '#C0AC84'] as const
const R = ['#3A3C3E', '#54585A', '#74787A', '#989C9A'] as const
const box = (c: C, x: number, y: number, w: number, h: number, base: string, lit: string, dark: string) => {
  c.rect(x, y, w, h, base)
  c.rect(x, y, w, 1, lit)
  c.rect(x, y, 1, h, lit)
  c.rect(x + w - 1, y, 1, h, dark)
  c.rect(x, y + h - 1, w, 1, dark)
}
const disc = (c: C, cx: number, cy: number, rx: number, ry: number, paint: string | ((x: number, y: number, d: number) => string | null)) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d > 1) continue
      const p = typeof paint === 'string' ? paint : paint(x, y, d)
      if (p) c.set(x, y, p)
    }
}
const line = (c: C, x0: number, y0: number, x1: number, y1: number, p: string) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i += 1) c.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, p)
}
const grain = (c: C, x: number, y: number, w: number, h: number, a: string, b: string, seed: number) => {
  for (let i = 0; i < (w * h) / 9; i += 1) {
    const px = x + Math.floor(noise(i, seed) * w)
    const py = y + Math.floor(noise(i, seed + 1) * h)
    c.rect(px, py, Math.min(2 + Math.floor(noise(i, seed + 2) * 6), x + w - px), 1, noise(i, seed + 3) > 0.5 ? a : b)
  }
}
const gl = (c: C, x: number, y: number, w: number, h: number, col: string, a: number) => {
  for (let j = 0; j < h; j += 1)
    for (let i = 0; i < w; i += 1) {
      const [px, py] = [Math.round(x + i), Math.round(y + j)]
      const p = c.get(px, py)
      c.set(px, py, p && !p.includes('|') ? mix(p, col, a) : col + '|' + a)
    }
}
const wrap = (c: C): Put => (x, y, p) => c.set(((Math.round(x) % c.w) + c.w) % c.w, ((Math.round(y) % c.h) + c.h) % c.h, p)
const paste = (c: C, s: C, ox: number, oy: number) => {
  for (let y = 0; y < s.h; y += 1)
    for (let x = 0; x < s.w; x += 1) {
      const p = s.get(x, y)
      if (p) c.set(ox + x, oy + y, p)
    }
}

const frond = (c: C, x0: number, y0: number, ang: number, len: number, bend: number, ramp: Ramp, wide = 5) => {
  let [x, y, a] = [x0, y0, ang]
  for (let i = 0; i < len; i += 1) {
    const t = i / len
    x += Math.cos(a)
    y += Math.sin(a)
    a += bend / len
    const k = Math.max(1, Math.round(wide * Math.sin(Math.min(1, t * 1.2 + 0.18) * Math.PI) ** 0.7))
    if (i % 2 === 0)
      for (const s of [-1, 1])
        for (let j = 1; j <= k; j += 1) {
          const aa = a + s * 1.1
          c.set(x + Math.cos(aa) * j, y + Math.sin(aa) * j, j === k ? ramp[2]! : s > 0 ? ramp[0]! : ramp[1]!)
        }
    c.set(x, y, ramp[2]!)
  }
}
const ivy = (c: C, x: number, y: number, k: 2 | 3) => c.sprite(['..a..', '.aab.', 'aaabb', '.abb.', '..b..'], { a: M[k + 1]!, b: M[k] }, x, y)
const bark = (c: C, x: number, y: number, w: number, h: number, seed: number, r: Ramp = E) => {
  for (let i = x; i < x + w; i += 1)
    for (let j = y; j < y + h; j += 1)
      if (c.get(i, j)) {
        const n = noise(i * 3 + seed, Math.floor(j / 3) + seed)
        c.set(i, j, n > 0.72 ? r[3]! : n > 0.38 ? r[2]! : r[1]!)
      }
}
const mush = (c: C, x: number, y: number, s: number, cap: string, lit: string, dark: string) => {
  c.rect(x + s - 1, y + s - 1, 2, s + 1, P[1])
  c.rect(x + s, y + s - 1, 1, s + 1, P[3])
  disc(c, x + s - 0.5, y + s - 1, s + 0.5, s - 0.2, (px, py) => (py > y + s - 1 ? null : px < x + s - 1 ? lit : px > x + s + 1 ? dark : cap))
  c.rect(x, y + s - 1, s * 2, 1, dark)
}

const leafy = (put: Put, cx: number, cy: number, rx: number, ry: number, r: Ramp, seed = 0, block = 2) => {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      const [bx, by] = [Math.floor(x / block), Math.floor(y / block)]
      const n = noise(bx + seed, by)
      if (d > 1 - n * 0.28) continue
      const l = (-(x - cx) / rx) * 0.5 - ((y - cy) / ry) * 0.8 + (n - 0.5) * 1.2
      put(x, y, r[Math.max(0, Math.min(r.length - 1, Math.floor(((l + 1) / 2) * r.length)))]!)
    }
}
const branch = (c: C, x0: number, y0: number, x1: number, y1: number) => {
  line(c, x0 - 1, y0, x1 - 1, y1, B[5])
  line(c, x0, y0, x1, y1, B[3])
  line(c, x0 + 1, y0, x1 + 1, y1, B[1])
}

export type Scene = {
  key: string
  sky: Ramp
  far: string
  far2: string
  mid: Ramp
  near: Ramp
  tr: Ramp
  fl: Ramp
  g: Ramp
  sp: string
  sp2: string
  lac?: Ramp
  etoiles?: boolean
  veil: string | null
}

const JOUR: Scene = { key: 'j', sky: ['#6FB4D8', '#8CC8DC', '#B0DCDC', '#D0ECD8'], far: '#7FB496', far2: '#6AA488', mid: ['#2E6A48', '#3E7E50', '#559A58', '#7AB460'], near: ['#163A28', '#1E4E30', '#2E6A3C', '#468A44', '#6EAE50', '#A0CC60'], tr: ['#2E2018', '#4A3424', '#644830', '#7E5E40'], fl: ['#F4E070', '#F0A0B8', '#FFFFFF'], g: ['#2C4A2A', '#305030', '#28442A', '#345634'], sp: '#4A7040', sp2: '#567C44', veil: null }
const SOIR: Scene = { key: 's', sky: ['#3A3A6A', '#7A4A7A', '#C8606A', '#EE9858', '#FFD088'], far: '#A0686A', far2: '#7A5468', mid: ['#2E3440', '#3E4246', '#54544A', '#6E6A50'], near: ['#14242A', '#1C3430', '#2A4A38', '#3E6444', '#5E8250', '#98A25E'], tr: ['#1A1418', '#2A2024', '#3E2E2A', '#54403A'], fl: ['#F0A060', '#E07898', '#F4D8A0'], g: ['#263C2C', '#2A4230', '#223628', '#2E4834'], sp: '#42603E', sp2: '#6A6A44', lac: ['#E89868', '#C8706A', '#7A4A70', '#4A3A60'], veil: '#3A1E3A|0.26' }
const NUIT: Scene = { key: 'n', sky: ['#0C1430', '#121C40', '#18284E', '#1E3458', '#284864'], far: '#1E3E50', far2: '#1A3648', mid: ['#10283A', '#143440', '#1A4446', '#22544E'], near: ['#0A1A22', '#0E2A2C', '#163C36', '#205040', '#2E6A4C', '#4A8A5C'], tr: ['#0E0E16', '#1A1A24', '#262834', '#343A44'], fl: ['#9CC8F0', '#C4A8E8', '#E8F0FF'], g: ['#1C3030', '#203630', '#1A2C2C', '#243C34'], sp: '#305848', sp2: '#3A6A58', etoiles: true, veil: '#0C1640|0.3' }
export const SCENES = [JOUR, SOIR, NUIT] as const

// The forest repeats across the room, 200 cells at a time. Drawn whole on one canvas it would weigh 60 000 characters:
// it stands instead on a few sprites, and every crown or bush is one of them, in its place.
const FOREST = 200
const TILE = FOREST * 2
const px = (x: number) => Math.round(x) * 2
const sprite = (id: string, c: C) => `<g id="${id}" transform="scale(2)">${paths(c)}</g>`
const at = (id: string, x: number, y: number) => `<use href="#${id}" x="${px(x)}" y="${px(y)}"/>`

function ciel(v: Scene, lean: boolean) {
  const c = canvas(FOREST, 70)
  const n = v.sky.length
  for (let y = 0; y < 70; y += 1) c.rect(0, y, FOREST, 1, v.sky[Math.min(n - 1, Math.floor(y / (56 / n)))]!)
  if (lean) return paths(c)
  if (v.etoiles) {
    for (let i = 0; i < 50; i += 1) c.set(Math.floor(noise(i, 5) * FOREST), Math.floor(noise(i, 6) * 40), i % 5 ? '#C8D4F0' : '#FFF6DE')
  } else if (v.lac) {
    disc(c, 92, 44, 8, 8, '#FFE8A8')
    disc(c, 92, 44, 5.4, 5.4, '#FFF6DE')
  } else {
    for (const [x, y, r] of [[64, 14, 9], [76, 11, 7], [52, 16, 6], [140, 24, 7], [150, 22, 6]] as const) disc(c, x, y, r, r * 0.5, '#F4FAF4')
  }
  return paths(c)
}

function rideau(v: Scene) {
  const c = canvas(FOREST, 80)
  for (let x = 0; x < FOREST; x += 1) {
    const t = Math.round(40 + 5 * Math.sin((x * 6.283 * 3) / FOREST) + 3 * Math.sin((x * 6.283 * 8) / FOREST))
    c.rect(x, t, 1, 80 - t, v.far)
  }
  return paths(c)
}

function lac(v: Scene) {
  const c = canvas(FOREST, 74)
  for (let y = 56; y < 74; y += 1) c.rect(0, y, FOREST, 1, v.lac![Math.min(3, Math.floor((y - 56) / 5))]!)
  for (let i = 0; i < 40; i += 1) c.rect(Math.floor(84 + noise(i, 8) * 18 - 2), 56 + Math.floor(noise(i, 9) * 16), 3 + Math.floor(noise(i, 7) * 6), 1, '#FFE0A0')
  return paths(c)
}

function lune() {
  const c = canvas(24, 24)
  disc(c, 12, 12, 11, 11, (x, y, d) => (d > 0.7 && (x + y) % 2 ? '#3A5474' : null))
  disc(c, 12, 12, 8, 8, (x, y) => (noise(x >> 1, y >> 1) > 0.84 ? '#DCE0D0' : '#F4F0DC'))
  return c
}

const touffe = (rx: number, ry: number, ramp: Ramp, seed: number, block = 2) => {
  const c = canvas(rx * 2 + 4, ry * 2 + 4)
  leafy(c.set, rx + 2, ry + 2, rx, ry, ramp, seed, block)
  return c
}

/** A tree of the middle distance, its trunk running down behind the hedge. */
function arbreMoyen(v: Scene, seed: number) {
  const c = canvas(34, 62)
  c.rect(17, 16, 2, 46, v.tr[1]!)
  c.rect(19, 16, 1, 46, v.tr[0]!)
  leafy(c.set, 17, 16, 15, 14, v.mid, seed)
  return c
}

const TRUNK_SIDE = 6

function tronc(v: Scene, tw: number, seed: number) {
  const c = canvas(tw + TRUNK_SIDE * 2, 84)
  const x = TRUNK_SIDE
  for (let y = 0; y < 84; y += 1) {
    const fl = y > 66 ? Math.round((y - 66) * 0.3) : 0
    for (let k = -fl; k < tw + fl; k += 1) {
      const t = (k + fl) / (tw + fl * 2)
      const nn = noise(Math.floor((seed + k) / 2), Math.floor(y / 4) + seed)
      c.set(x + k, y, t < 0.18 ? v.tr[3]! : t > 0.72 ? v.tr[0]! : nn > 0.6 ? v.tr[2]! : v.tr[1]!)
    }
  }
  for (const [dx, dy] of [[3, 30], [6, 52]] as const) for (let k = 0; k < 4; k += 1) c.set(x + dx + k, dy + (k === 1 || k === 2 ? 1 : 0), v.tr[0]!)
  for (let i = 0; i < 6; i += 1) {
    const a = i * 40 + seed
    c.set(x + (a % tw), 60 + (i * 3) % 18, v.near[3]!)
    c.set(x + (a % tw) + 1, 60 + (i * 3) % 18, v.near[4]!)
  }
  return c
}

/** A bush of the hedge: its low edge is torn, and bites into the grass. */
function haie(v: Scene, ry: number, seed: number) {
  const c = canvas(30, 28)
  leafy(c.set, 15, 13, 13, ry, v.near.slice(0, 5), seed)
  for (let x = 0; x < 30; x += 1) {
    const b = Math.round(20 + 2 * Math.sin(x * 0.7) + noise(x + seed, 41) * 3)
    for (let y = b; y < 28; y += 1) c.set(x, y, null)
  }
  return c
}

function fougereHaie(v: Scene) {
  const c = canvas(32, 16)
  const r = [v.near[1]!, v.near[3]!, v.near[5]!]
  frond(c, 15, 15, -2.1, 13, -0.8, r, 3)
  frond(c, 16, 15, -1.0, 13, 0.8, r, 3)
  frond(c, 15, 15, -1.57, 11, 0.1, r, 3)
  return c
}

function fleurs(v: Scene) {
  const c = canvas(FOREST, 92)
  for (let i = 0; i < 46; i += 1) {
    const [x, y, col] = [Math.floor(noise(i, 61) * (FOREST - 2)), 68 + Math.floor(noise(i, 62) * 15), v.fl[i % 3]!]
    c.rect(x, y, 2, 2, col)
    if (i % 2) c.set(x + 1, y + 1, L[3])
  }
  return c
}

const SPRITES = (v: Scene, lean: boolean) =>
  lean
    ? [sprite('nm0', arbreMoyen(v, 1)), sprite('nt0', tronc(v, 13, 20)), sprite('nv0', touffe(15, 13, v.near, 9, 3)), sprite('nh0', haie(v, 12, 2))]
    : [
        sprite('nc', touffe(9, 9, [v.far2, v.far, v.far], 3, 3)),
        sprite('nm0', arbreMoyen(v, 1)),
        sprite('nm1', arbreMoyen(v, 6)),
        sprite('nt0', tronc(v, 14, 20)),
        sprite('nt1', tronc(v, 10, 76)),
        sprite('nv0', touffe(15, 15, v.near, 7, 3)),
        sprite('nv1', touffe(15, 12, v.near, 15, 3)),
        sprite('nv2', touffe(15, 11, v.near, 27, 3)),
        sprite('nh0', haie(v, 12, 2)),
        sprite('nh1', haie(v, 14, 11)),
        sprite('nh2', haie(v, 11, 17)),
        sprite('nf', fougereHaie(v)),
        sprite('nl', fleurs(v)),
        ...(v.etoiles ? [sprite('nu', lune())] : []),
      ]

/** What stands far off: the curtain, its clumps, the lake, the trees of the middle distance. */
function loin(v: Scene, lean: boolean) {
  let out = `<g transform="scale(2)">${ciel(v, lean)}${rideau(v)}${v.lac && !lean ? lac(v) : ''}</g>`
  if (!lean) for (let i = 0; i < 16; i += 1) out += at('nc', (i * FOREST) / 16 + noise(i, 2) * 6 - 11, 29 + noise(i, 3) * 6)
  for (let i = 0; i < 9; i += 1) out += at(`nm${lean ? 0 : i % 2}`, (i * FOREST) / 9 + 8 + noise(i, 12) * 8 - 17, 10 + noise(i, 13) * 8)
  return v.etoiles && !lean ? out + at('nu', 84, 4) : out
}

/** The great trunks, the vault with its gaps on the sky, the hedge, its ferns and flowers. */
function pres(turn: number, lean: boolean) {
  let out = ''
  for (const [x, kind] of [[20, 0], [76, 1], [124, 0], [176, 1]] as const) out += at(`nt${lean ? 0 : kind}`, ((x + turn * 37) % FOREST) - TRUNK_SIDE, 0)
  for (let i = 0; i < 30; i += 1) {
    const cx = (i * FOREST) / 30 + noise(i, 21) * 5
    if (i % 7 === 3 || Math.abs(cx - 96) < 26) continue
    const kind = lean ? 0 : i % 5 === 2 ? 0 : 1 + (i % 2)
    out += at(`nv${kind}`, cx - 17, noise(i, 22) * 6 - (kind ? 4 : 12))
  }
  for (let i = 0; i < 26; i += 1) out += at(`nh${lean ? 0 : i % 3}`, (i * FOREST) / 26 + noise(i, 31) * 6 - 15, 63 + noise(i, 32) * 3)
  if (lean) return out
  for (let i = 0; i < 12; i += 1) out += at('nf', 10 + i * 15.5 + noise(i, 51) * 6 - 15, 69)
  return out + at('nl', 0, 0)
}

function herbe(v: Scene, lean: boolean) {
  const [w, h] = lean ? [60, 42] : [120, 84]
  const c = canvas(w, h)
  const s = wrap(c)
  const t = v.g
  c.rect(0, 0, w, h, t[0]!)
  for (let i = 0; i < (lean ? 0 : 26); i += 1) {
    const [cx, cy, rx, ry, p] = [Math.floor(noise(i, 71) * w), Math.floor(noise(i, 72) * h), 6 + noise(i, 73) * 10, 3 + noise(i, 74) * 6, t[1 + (i % 3)]!]
    for (let y = -Math.ceil(ry / 2); y * 2 <= ry; y += 1) {
      const half = rx * Math.sqrt(Math.max(0, 1 - ((y * 2) / ry) ** 2)) + (noise(i, y + 40) - 0.5) * 4
      for (let x = -Math.round(half / 2); x * 2 < half; x += 1) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) s(cx + x * 2 + a, cy + y * 2 + b, p)
    }
  }
  for (let i = 0; i < (lean ? 18 : 44); i += 1) {
    const [x, y] = [Math.floor(noise(i, 81) * w), Math.floor(noise(i, 82) * h)]
    s(x, y, v.sp)
    s(x - 1, y - 1, v.sp)
    s(x + 1, y - 2, i % 3 ? v.sp : v.sp2)
  }
  for (let i = 0; i < (lean ? 0 : 9); i += 1) {
    const [x, y] = [Math.floor(noise(i, 91) * w), Math.floor(noise(i, 92) * h)]
    s(x, y, v.fl[i % 3]!)
    s(x, y + 1, v.sp)
  }
  return c
}

const drawn = new Map<string, string>()
const memo = (key: string, make: () => string) => {
  if (!drawn.has(key)) drawn.set(key, make())
  return drawn.get(key)!
}

/**
 * The whole of a room's back: grass, then the forest in three layers so that what crosses a tile's edge stays whole,
 * then the veil of the evening or the night. `turn` shifts the great trunks from one conversation to the next.
 */
export function foret(v: Scene, turn: number, w: number, h: number, lean: boolean) {
  const key = `${v.key}${lean ? 'l' : ''}`
  const still = memo(key, () => {
    const c = herbe(v, lean)
    return `<pattern id="ng" width="${c.w * 2}" height="${c.h * 2}" patternUnits="userSpaceOnUse"><g transform="scale(2)">${paths(c)}</g></pattern>${SPRITES(v, lean).join('')}<g id="nb">${loin(v, lean)}</g>`
  })
  const tiles = Array.from({ length: Math.ceil(w / TILE) + 1 }, (_, i) => (i - 1) * TILE)
  const row = (id: string) => tiles.map(x => `<use href="#${id}"${x ? ` x="${x}"` : ''}/>`).join('')
  const [veil, alpha] = v.veil?.split('|') ?? []
  return {
    defs: `${still}<g id="nn">${pres(turn, lean)}</g>`,
    body: `<rect y="112" width="${w}" height="${h - 112}" fill="url(#ng)"/>${row('nb')}${row('nn')}${veil ? `<rect width="${w}" height="${h}" fill="${veil}" fill-opacity="${alpha}"/>` : ''}`,
  }
}

/** The trodden ground: two shades that stop in steps, row by row. As cells it would weigh as much as a forest. */
export function clairiere(w: number, h: number, lean: boolean) {
  const step = lean ? 4 : 2
  const shade = (reach: number, salt: number) => {
    let d = ''
    for (let y = 0; y < h; y += step) {
      const v = (y + step / 2 - h / 2) / (h / 2)
      const half = (w / 2) * reach * Math.sqrt(Math.max(0, 1 - (v / reach) ** 2))
      if (half < 2) continue
      const [a, b] = [Math.round((w / 2 - half + noise(y, salt) * 7) / 2) * 2, Math.round((w / 2 + half - noise(y, salt + 1) * 7) / 2) * 2]
      if (b > a) d += `M${a} ${y}h${b - a}v${step}h${a - b}`
    }
    return d
  }
  return `<path fill="#20160E" fill-opacity=".18" d="${shade(1, 3)}"/><path fill="#20160E" fill-opacity=".17" d="${shade(0.74, 5)}"/>`
}
export function souche() {
  const c = canvas(46, 40)
  c.rect(4, 37, 38, 3, SH)
  for (const [x0, y0, x1, y1] of [[10, 26, 2, 36], [14, 28, 8, 37], [30, 28, 38, 36], [34, 26, 43, 35], [22, 28, 22, 37]] as const)
    for (let k = -1; k <= 2; k += 1) line(c, x0 + k, y0, x1 + k, y1, k < 0 ? E[4] : k < 2 ? E[3] : E[2])
  for (let y = 11; y < 34; y += 1) {
    const hw = 15 + Math.floor((y - 11) * 0.14)
    c.rect(23 - hw, y, hw * 2, 1, E[2])
  }
  bark(c, 7, 11, 32, 23, 3)
  for (let x = 7; x < 39; x += 3) for (let y = 13; y < 33; y += 1) if (noise(x, Math.floor(y / 4)) > 0.45) c.set(x, y, E[1])
  disc(c, 12, 34, 7, 3, E[2])
  disc(c, 34, 34, 7, 3, E[2])
  for (let y = 12; y < 33; y += 1) {
    c.set(8, y, E[3])
    c.set(37, y, E[0])
  }
  disc(c, 23, 11, 16.5, 7.4, (x, y, d) => (d > 0.86 ? E[3] : Math.floor(Math.sqrt(d) * 7) % 2 ? B[4] : B[5]))
  disc(c, 23, 11, 2, 1, B[2])
  line(c, 23, 11, 34, 7, B[2])
  disc(c, 11, 23, 4.5, 5, (x, y) => (noise(x >> 1, y >> 1) > 0.8 ? null : noise(x >> 1, y >> 1) > 0.5 ? M[5] : M[3]))
  disc(c, 11, 33, 7, 2.6, (x, y) => (noise(x >> 1, y >> 1) > 0.6 ? M[5] : M[3]))
  disc(c, 13, 12, 6, 2.4, (x, y) => (noise(x >> 1, y >> 1) > 0.6 ? M[6] : M[4]))
  line(c, 32, 6, 44, 0, B[6])
  line(c, 32, 7, 45, 0, B[4])
  line(c, 33, 8, 45, 1, B[2])
  c.sprite(['..kkkkkkk..', '.kmmmmmmmk.', 'kmmmmmlllmk', 'kmmmlllllk.', 'kmllllkkk..', '.kkkk......'], { k: E[0], m: '#5E6A72', l: '#B4C0C4' }, 25, 3)
  c.rect(26, 8, 8, 1, B[1])
  mush(c, 33, 26, 3, '#B07A3C', '#D8A868', '#7E5228')
  mush(c, 39, 29, 2, '#B07A3C', '#D8A868', '#7E5228')
  mush(c, 28, 30, 2, '#C4553A', '#E08060', '#8E3220')
  frond(c, 4, 36, -1.2, 11, -0.7, [F[2], F[3], F[5]], 3)
  frond(c, 3, 36, -2.1, 7, 0.4, [F[3], F[4], F[5]], 2)
  return c
}
export function panierChampignons() {
  const c = canvas(40, 32)
  c.rect(3, 29, 34, 3, SH)
  for (let a = 3.3; a < 6.13; a += 0.03) {
    c.set(20 + Math.cos(a) * 15.5, 16 + Math.sin(a) * 15.5, B[5])
    c.set(20 + Math.cos(a) * 14.5, 16 + Math.sin(a) * 14.5, B[3])
  }
  disc(c, 20, 15, 16, 5, (x, y) => (noise(x >> 1, y >> 1) > 0.5 ? M[4] : M[3]))
  mush(c, 7, 7, 4, '#8A5A30', '#B08050', '#5A3820')
  mush(c, 15, 5, 5, '#B8402E', '#D8604A', '#7E2A1E')
  for (const [x, y] of [[17, 6], [22, 5], [20, 8], [24, 8]] as const)
    c.rect(x, y, 2, 1, PAP)
  mush(c, 27, 8, 4, '#A8743C', '#D0A060', '#6E4A24')
  mush(c, 24, 13, 2, '#E0C080', '#F0DCA8', '#A88A50')
  for (let y = 16; y < 30; y += 1) {
    const inset = Math.round(((y - 16) / 14) ** 2 * 7)
    for (let x = 3 + inset; x < 37 - inset; x += 1) {
      const row = Math.floor((y - 16) / 2)
      const weave = (x + (row % 2 ? 2 : 0)) % 4 < 2
      const lit = x < 10 ? 1 : x > 28 ? -1 : 0
      c.set(x, y, lit > 0 ? (weave ? B[6] : B[4]) : lit < 0 ? (weave ? B[3] : B[2]) : weave ? B[5] : B[3])
    }
  }
  c.rect(2, 15, 36, 3, B[5])
  c.rect(2, 15, 36, 1, B[6])
  c.rect(2, 17, 36, 1, B[3])
  for (let x = 3; x < 37; x += 4) c.rect(x, 15, 2, 3, B[4])
  c.rect(10, 29, 20, 1, B[1])
  return c
}

/** The hammock, strung between two trunks of its own. */
export function hamac() {
  const c = canvas(108, 60)
  c.rect(10, 56, 88, 4, SH)
  for (const x of [6, 90]) {
    c.rect(x, 0, 12, 58, E[2])
    bark(c, x, 0, 12, 58, x)
    c.rect(x, 0, 2, 58, E[4])
    c.rect(x + 10, 0, 2, 58, E[0])
    c.rect(x - 2, 54, 16, 4, E[2])
    bark(c, x - 2, 54, 16, 4, x)
    c.rect(x - 3, 56, 18, 2, E[1])
    for (const y of [40, 50]) {
      ivy(c, x + (y % 3), y, 3)
    }
    c.rect(x, 16, 12, 2, B[6])
    c.rect(x, 18, 12, 1, B[3])
    leafy(c.set, x + 6, 7, 17, 11, M.slice(0, 6), x, 3)
  }
  const curve = (x: number) => 27 + 15 * Math.sin((Math.PI * (x - 24)) / 60)
  line(c, 18, 17, 25, 27, B[6])
  line(c, 18, 17, 25, 30, B[5])
  line(c, 90, 17, 83, 27, B[6])
  line(c, 90, 17, 83, 30, B[5])
  const st = ['#C8583E', P[1], '#3E7A62', P[1]]
  for (let x = 24; x <= 84; x += 1) {
    const y = Math.round(curve(x)),
      th = 6 + Math.round(3 * Math.sin((Math.PI * (x - 24)) / 60)),
      lift = Math.round(4 * Math.sin((Math.PI * (x - 24)) / 60))
    for (let j = -lift; j < th; j += 1) c.set(x, y + j, mix(st[Math.floor((x - 24) / 7) % 4]!, '#1B1730', j < 1 ? 0.28 : j > th - 3 ? 0.3 : 0))
    c.set(x, y - lift, P[0])
    c.set(x, y + th, '#1B1730|0.4')
    if (x % 3 === 0) {
      c.set(x, y + th, P[2])
      c.set(x, y + th + 1, P[3])
    }
  }
  disc(c, 36, 33, 7, 4, (x, y) => (y < 32 ? P[0] : P[2]))
  disc(c, 36, 34, 5, 2, P[1])
  c.rect(58, 37, 10, 3, '#3E6A58')
  c.rect(58, 37, 10, 1, '#5E8E78')
  c.rect(62, 37, 2, 3, P[0])
  return c
}
export function sac() {
  const c = canvas(34, 40)
  c.rect(3, 36, 28, 4, SH)
  c.rect(5, 2, 24, 7, '#3E7A62')
  c.rect(5, 2, 24, 2, '#5E9E80')
  c.rect(5, 7, 24, 2, '#2A5A48')
  disc(c, 28, 5, 3.4, 3.4, (x, y, d) => (Math.floor(Math.sqrt(d) * 3) % 2 ? '#5E9E80' : '#2A5A48'))
  for (const x of [10, 21]) c.rect(x, 1, 2, 9, B[1])
  disc(c, 17, 22, 13, 15, (x, y) => (y < 10 ? null : x < 9 ? '#C4883E' : x > 24 ? '#7A4E26' : '#A86E30'))
  disc(c, 17, 28, 13, 9, (x, y) => (y > 35 ? '#5A3818' : x < 9 ? '#C4883E' : x > 24 ? '#7A4E26' : '#A86E30'))
  c.rect(4, 9, 26, 3, '#8A5A28')
  c.rect(4, 9, 26, 1, '#C4883E')
  c.rect(9, 12, 16, 7, '#8A5A28')
  c.rect(9, 12, 16, 1, '#C4883E')
  c.rect(9, 18, 16, 1, '#5A3818')
  disc(c, 17, 29, 9, 6, (x, y, d) => (d > 0.8 ? '#5A3818' : y < 26 ? '#C4883E' : '#946228'))
  for (const x of [13, 21]) {
    c.rect(x, 18, 2, 6, B[1])
    c.rect(x, 22, 2, 2, L[2])
  }
  c.rect(16, 27, 3, 2, L[2])
  c.set(16, 27, L[3])
  disc(c, 2.5, 26, 2.6, 6, (x, y) => (x < 2 ? '#7EA6A0' : '#4E7A76'))
  c.rect(1, 19, 3, 2, B[1])
  c.rect(0, 23, 5, 1, B[1])
  c.rect(29, 24, 5, 6, R[3])
  c.rect(29, 24, 5, 1, CR)
  c.rect(33, 25, 1, 5, R[1])
  return c
}
export function lanterne() {
  const c = canvas(32, 54)
  disc(c, 19, 26, 13, 13, (_, __, d) => (d < 0.45 ? '#FFC857|0.18' : '#FFC857|0.08'))
  c.rect(6, 51, 12, 3, SH)
  c.rect(8, 6, 3, 46, B[3])
  c.rect(8, 6, 1, 46, B[5])
  c.rect(10, 6, 1, 46, B[1])
  for (let a = 0; a < 3.2; a += 0.05) c.set(15 + Math.cos(a + 3.14) * 6, 8 + Math.sin(a + 3.14) * 6, K_FER)
  c.rect(20, 8, 1, 8, K_FER)
  c.rect(5, 47, 9, 2, E[2])
  c.rect(9, 44, 1, 8, E[1])
  frond(c, 9, 52, -2.2, 10, -0.7, [F[2], F[3], F[5]], 2)
  frond(c, 10, 52, -0.9, 9, 0.7, [F[2], F[3], F[5]], 2)
  for (let a = 3.3; a < 6.2; a += 0.05) c.set(20 + Math.cos(a) * 7, 24 + Math.sin(a) * 9, K_FER)
  c.rect(16, 16, 9, 2, '#3E5A4C')
  c.rect(16, 16, 9, 1, '#6E9480')
  c.rect(18, 15, 5, 1, K_FER)
  disc(c, 20.5, 24, 5.4, 7, (x, y, d) => (d < 0.3 ? PAP : d < 0.62 ? '#FFD880' : '#F0A848'))
  c.rect(20, 25, 2, 4, PAP)
  c.rect(15, 18, 1, 13, K_FER)
  c.rect(26, 18, 1, 13, K_FER)
  c.rect(14, 31, 13, 4, '#3E5A4C')
  c.rect(14, 31, 13, 1, '#6E9480')
  c.rect(14, 34, 13, 1, K_FER)
  return c
}
const K_FER = '#1E2E28'
export function canoe() {
  const c = canvas(96, 34)
  c.rect(6, 30, 84, 4, SH)
  const top = (x: number) => 13 - 9 * ((x - 48) / 48) ** 4 - 2 * ((x - 48) / 48) ** 2
  const bot = (x: number) => 13 + 16 * (1 - ((x - 48) / 48) ** 2) ** 0.7
  for (let x = 1; x < 95; x += 1) {
    const [a, b] = [Math.round(top(x)), Math.round(bot(x))]
    for (let y = a; y <= b; y += 1) {
      const t = (y - a) / Math.max(1, b - a)
      c.set(x, y, t < 0.14 ? B[6] : t < 0.24 ? B[3] : t > 0.82 ? '#1E4A3C' : (y + (x % 22 < 11 ? 0 : 2)) % 4 === 0 ? '#2A5E4A' : '#2E6A54')
    }
    c.set(x, b + 1, '#163A2E')
  }
  for (let x = 6; x < 90; x += 1) {
    const y = Math.round(top(x)) + Math.round(5 + (1 - ((x - 48) / 48) ** 2) * 4)
    c.set(x, y, P[1])
    c.set(x, y + 1, P[2])
  }
  for (const x of [28, 64]) {
    c.rect(x, Math.round(top(x)) - 1, 8, 2, B[4])
    c.rect(x, Math.round(top(x)) - 1, 8, 1, B[6])
  }
  for (const x of [4, 90]) c.rect(x, Math.round(top(x)) - 1, 3, 3, L[1])
  line(c, 70, 30, 92, 1, B[6])
  line(c, 71, 30, 93, 1, B[4])
  disc(c, 91, 3, 2.6, 4.6, B[5])
  disc(c, 92, 4, 1.4, 3, B[3])
  c.rect(88, 1, 0, 0, B[1])
  for (const x of [20, 24, 62]) {
    frond(c, x, 31, -1.8, 6, 0.3, [F[2], F[3], F[5]], 2)
  }
  return c
}
export function marmite() {
  const c = canvas(40, 46)
  c.rect(6, 42, 28, 4, SH)
  branch(c, 19, 2, 5, 43)
  branch(c, 21, 2, 35, 43)
  branch(c, 20, 0, 23, 40)
  for (let j = 0; j < 3; j += 1) c.rect(17, 5 + j * 2, 6, 1, B[6])
  c.rect(20, 8, 1, 11, R[1])
  for (let y = 9; y < 19; y += 2) c.set(20, y, R[3])
  for (let a = 3.2; a < 6.2; a += 0.06) c.set(20 + Math.cos(a) * 9, 26 + Math.sin(a) * 7, R[1])
  disc(c, 20, 31, 11, 9, (x, y) => (y < 24 ? null : x < 15 ? '#3E4246' : x > 26 ? '#16161C' : (x + y) % 3 ? '#26262E' : '#2E2E36'))
  c.rect(9, 24, 22, 3, '#3E4246')
  c.rect(9, 24, 22, 1, '#74787A')
  c.rect(9, 26, 22, 1, '#16161C')
  c.rect(18, 22, 4, 2, R[2])
  c.rect(7, 25, 3, 2, R[0])
  c.rect(30, 25, 3, 2, R[0])
  c.rect(16, 39, 8, 1, '#16161C')
  line(c, 26, 23, 32, 15, B[5])
  line(c, 27, 23, 33, 15, B[3])
  for (const [x, y] of [[13, 20], [15, 17], [24, 19], [23, 15], [17, 13]] as const)
    gl(c, x, y, 2, 2, '#E8E4DC', 0.4)
  for (const [x, y, s] of [[12, 41, 3], [20, 42, 3.4], [28, 41, 3]] as const)
    disc(c, x, y, s + 1, s * 0.7, (px, py) => (py < y ? R[3] : R[1]))
  return c
}
export function fagots() {
  const c = canvas(48, 34)
  c.rect(3, 30, 42, 4, SH)
  const log = (x: number, y: number, r: number) => {
    c.rect(x - 12, y - r, 12, r * 2 + 1, E[2])
    disc(c, x, y, r, r, (px, py, d) => (d > 0.72 ? B[3] : Math.floor(Math.sqrt(d) * 3) % 2 ? B[5] : B[6]))
    c.set(x, y, B[3])
  }
  c.rect(6, 12, 2, 18, B[2])
  for (const [x, y] of [[16, 26], [27, 26], [38, 26], [22, 18], [33, 18], [28, 10]] as const)
    log(x, y, 5)
  bark(c, 3, 5, 26, 26, 8)
  for (const [x, y] of [[16, 26], [27, 26], [38, 26], [22, 18], [33, 18], [28, 10]] as const)
    disc(c, x, y, 5, 5, (px, py, d) => (d > 0.72 ? B[3] : Math.floor(Math.sqrt(d) * 3) % 2 ? B[5] : B[6]))
  for (let k = 0; k < 8; k += 1) line(c, 2 + k, 31, 30 + (k % 3), 22 + k - 6 + (k % 2), [B[4], B[3], B[5]][k % 3]!)
  c.rect(14, 22, 3, 9, B[6])
  c.rect(15, 22, 1, 9, B[3])
  disc(c, 40, 16, 5, 2, (x, y) => (noise(x >> 1, y >> 1) > 0.5 ? M[5] : M[3]))
  return c
}
function nichoir() {
  const c = canvas(32, 46)
  box(c, 7, 17, 18, 24, B[4], B[5], B[1])
  grain(c, 8, 18, 16, 22, B[3], B[5], 36)
  for (const x of [13, 19]) c.rect(x, 18, 1, 22, B[2])
  disc(c, 16, 25, 4.4, 4.4, B[6])
  disc(c, 16, 25, 3.6, 3.6, B[0])
  disc(c, 15, 26, 2, 2, '#14100C')
  c.rect(14, 32, 5, 1, B[1])
  c.rect(14, 31, 4, 1, B[6])
  c.rect(5, 40, 22, 2, B[3])
  c.rect(5, 40, 22, 1, B[5])
  c.rect(6, 42, 20, 1, B[1])
  for (let j = 0; j < 13; j += 1) {
    const hw = 3 + j
    for (let x = 16 - hw; x < 16 + hw; x += 1) {
      const s = (x + (j % 4 < 2 ? 0 : 2)) % 4 === 0
      c.set(x, 6 + j, j % 4 === 3 ? B[0] : s ? B[1] : j % 4 === 0 ? B[3] : B[2])
    }
  }
  for (let x = 1; x < 31; x += 1) {
    c.set(x, 19, B[0])
    c.set(x, 18, x % 2 ? B[2] : B[4])
  }
  for (const [x, y, rx, ry] of [[13, 10, 5, 2.4], [8, 15, 5, 2], [21, 14, 4, 2.2]] as const)
    disc(c, x, y, rx, ry, (px, py) => (py < y - 0.6 ? M[5] : noise(px >> 1, py >> 1) > 0.5 ? M[3] : M[4]))
  c.sprite(['..ccc...', '.cwwcc..', '.cwkwc.t', '.yyyyctt', '.yyyybt.', '..yybb..', '..o..o..'], { c: '#3C7CA8', w: '#F4F0E4', k: '#1B1730', y: '#E8C848', b: '#527A64', t: '#2E5C7C', o: '#54463A' }, 19, 0)
  return c
}

/** A birdhouse nailed to a mossy trunk. */
export function arbreNichoir() {
  const c = canvas(48, 104)
  c.rect(4, 100, 40, 4, SH)
  for (let y = 0; y < 102; y += 1) {
    const fl = y > 84 ? Math.round((y - 84) * 0.5) : 0
    c.rect(14 - fl, y, 20 + fl * 2, 1, E[2])
  }
  bark(c, 4, 0, 40, 102, 11)
  for (let x = 14; x < 34; x += 3) for (let y = 0; y < 100; y += 1) if (noise(x, Math.floor(y / 5)) > 0.5) c.set(x, y, E[1])
  for (let y = 0; y < 84; y += 1) {
    c.rect(14, y, 2, 1, E[4])
    c.rect(32, y, 2, 1, E[0])
  }
  disc(c, 26, 16, 3, 5, E[0])
  disc(c, 26, 16, 1.6, 3, E[3])
  for (const [x, y, s] of [[12, 80, 7], [18, 92, 8], [32, 94, 6]] as const)
    disc(c, x, y, s, s * 0.7, (px, py) => (noise(px >> 1, py >> 1) > 0.6 ? M[5] : noise(px >> 1, py >> 1) > 0.3 ? M[4] : M[3]))
  leafy(c.set, 24, 9, 24, 13, M.slice(0, 6), 5, 3)
  paste(c, nichoir(), 8, 22)
  c.rect(23, 28, 2, 2, E[4])
  for (const [x, y, k] of [[10, 62, 3], [8, 68, 2], [13, 72, 3]] as const)
    ivy(c, x, y, k)
  mush(c, 30, 72, 2, '#D8A040', '#F0C870', '#A87020')
  mush(c, 32, 77, 3, '#D8A040', '#F0C870', '#A87020')
  frond(c, 6, 100, -2.2, 12, -0.7, [F[2], F[3], F[5]], 3)
  frond(c, 42, 100, -0.9, 12, 0.7, [F[2], F[3], F[5]], 3)
  return c
}
export function banc() {
  const c = canvas(68, 26)
  c.rect(4, 22, 60, 4, SH)
  for (const x of [8, 48]) {
    c.rect(x, 12, 12, 11, E[2])
    bark(c, x, 12, 12, 11, x)
    c.rect(x, 12, 1, 11, E[4])
    c.rect(x + 11, 12, 1, 11, E[0])
  }
  c.rect(1, 2, 66, 11, B[4])
  c.rect(1, 2, 66, 2, B[6])
  c.rect(1, 4, 66, 1, B[5])
  grain(c, 2, 5, 64, 3, B[3], B[5], 44)
  c.rect(1, 7, 66, 6, E[2])
  bark(c, 1, 8, 66, 5, 17)
  c.rect(1, 12, 66, 1, E[0])
  disc(c, 1, 7, 1.4, 5, B[6])
  disc(c, 67, 7, 1.4, 5, B[5])
  disc(c, 12, 10, 8, 2.6, (x, y) => (noise(x >> 1, y >> 1) > 0.5 ? M[5] : M[3]))
  c.rect(44, 0, 8, 2, CR)
  c.rect(44, 0, 8, 1, '#3C6E8C')
  c.rect(52, 0, 1, 2, INK)
  return c
}
export function caisse() {
  const c = canvas(44, 36)
  c.rect(3, 32, 38, 4, SH)
  for (const [x, y] of [[10, 9], [16, 8], [22, 10], [13, 12]] as const) {
    disc(c, x, y, 3.4, 3.4, (px, py) => (px < x ? '#E0604A' : '#B83A2E'))
    c.set(x - 1, y - 2, '#F8B0A0')
    c.set(x, y - 4, B[1])
  }
  c.rect(27, 5, 9, 8, R[2])
  c.rect(27, 5, 2, 8, R[3])
  c.rect(34, 5, 2, 8, R[1])
  c.rect(27, 8, 9, 3, '#C8583E')
  line(c, 37, 12, 41, 1, P[1])
  line(c, 38, 12, 42, 1, P[2])
  line(c, 39, 12, 43, 1, P[3])
  c.rect(4, 13, 36, 20, B[1])
  for (const y of [13, 20, 27]) {
    c.rect(4, y, 36, 6, B[4])
    c.rect(4, y, 36, 1, B[6])
    c.rect(4, y + 5, 36, 1, B[2])
    grain(c, 5, y + 1, 34, 3, B[3], B[5], y)
  }
  for (const x of [4, 36]) {
    c.rect(x, 13, 4, 20, B[3])
    c.rect(x, 13, 1, 20, B[5])
    c.rect(x + 3, 13, 1, 20, B[1])
    for (const y of [15, 23, 30]) c.set(x + 2, y, R[3])
  }
  for (let a = 0; a < 3.2; a += 0.1) c.set(22 + Math.cos(a) * 5, 22 + Math.sin(a) * 3, B[6])
  c.rect(4, 32, 36, 1, B[0])
  return c
}
export function fanions(w = 140) {
  const c = canvas(w, 24),
    col = ['#C8583E', P[1], '#3E7A62', '#D8A848']
  const y0 = (x: number) => 2 + 6 * Math.sin((Math.PI * x) / w)
  for (let x = 0; x < w; x += 1) c.set(x, y0(x), B[6])
  for (let i = 0, x = 5; x < w - 8; x += 12, i += 1) {
    const y = Math.round(y0(x + 4))
    const a = col[i % 4]!
    for (let j = 0; j < 12; j += 1) {
      const hw = 4.5 * (1 - j / 12)
      for (let k = -hw; k <= hw; k += 1) c.set(x + 4 + k, y + 1 + j, k > hw * 0.3 ? mix(a, '#1B1730', 0.22) : a)
    }
  }
  return c
}
export function grandArbre() {
  const c = canvas(100, 140)
  const r = ['#1E4E30', '#2E6A3C', '#468A44', '#6EAE50', '#A0CC60']
  disc(c, 50, 134, 34, 5, SH)
  for (let y = 40; y < 136; y += 1) {
    const fl = y > 112 ? Math.round((y - 112) ** 1.4 * 0.12) : 0
    c.rect(41 - fl, y, 18 + fl * 2, 1, E[2])
  }
  bark(c, 20, 40, 60, 96, 13)
  for (let x = 41; x < 59; x += 3) for (let y = 40; y < 134; y += 1) if (noise(x, Math.floor(y / 5)) > 0.5) c.set(x, y, E[1])
  for (let y = 40; y < 112; y += 1) {
    c.rect(41, y, 2, 1, E[4])
    c.rect(57, y, 2, 1, E[0])
  }
  disc(c, 50, 92, 3, 5, E[0])
  disc(c, 50, 92, 1.4, 3, E[3])
  branch(c, 46, 56, 24, 34)
  branch(c, 54, 52, 78, 30)
  for (const [x, y, rx, ry, s] of [[50, 36, 44, 30, 1], [22, 46, 22, 16, 2], [78, 44, 22, 18, 3], [34, 20, 26, 19, 4], [68, 18, 26, 18, 5], [50, 12, 26, 12, 6]] as const)
    leafy(c.set, x, y, rx, ry, r, s * 9, 4)
  for (const [x, y, s] of [[40, 128, 8], [62, 130, 7]] as const)
    disc(c, x, y, s, s * 0.6, (px, py) => (noise(px >> 1, py >> 1) > 0.6 ? M[5] : noise(px >> 1, py >> 1) > 0.3 ? M[4] : M[3]))
  frond(c, 26, 134, -2.3, 12, -0.7, [F[2], F[3], F[5]], 3)
  frond(c, 74, 134, -0.8, 12, 0.7, [F[2], F[3], F[5]], 3)
  return c
}
export function buisson() {
  const c = canvas(56, 36)
  const r = M.slice(0, 6)
  disc(c, 28, 32, 26, 4, SH)
  for (const [x, y, rx, ry, s] of [[28, 20, 22, 14, 1], [14, 25, 13, 10, 2], [42, 25, 13, 10, 3], [28, 13, 13, 10, 4]] as const)
    leafy(c.set, x, y, rx, ry, r, s * 7, 3)
  for (let i = 0; i < 16; i += 1) {
    const x = Math.floor(8 + noise(i, 4) * 40)
    const y = Math.floor(6 + noise(i, 5) * 24)
    if (!c.get(x, y)) continue
    const col = i % 2 ? '#F0A0B8' : '#F4E070'
    c.rect(x, y, 2, 2, col)
    c.set(x + 1, y + 1, L[2])
  }
  return c
}
export function rocher() {
  const c = canvas(52, 34)
  disc(c, 26, 30, 24, 4, SH)
  const roc = (x: number, y: number, rx: number, ry: number) =>
    disc(c, x, y, rx, ry, (px, py) => {
      const l = (-(px - x) / rx) * 0.6 - (py - y) / ry + (noise(Math.floor(px / 2), Math.floor(py / 2)) - 0.5) * 0.7
      return R[Math.max(0, Math.min(3, Math.floor((l + 1) * 2)))]!
    })
  roc(36, 22, 13, 10)
  roc(18, 19, 16, 14)
  roc(8, 26, 7, 5)
  line(c, 20, 8, 25, 20, R[0])
  line(c, 25, 20, 22, 30, R[0])
  line(c, 38, 15, 41, 25, R[0])
  disc(c, 18, 9, 13, 5, (x, y) => (noise(x >> 1, y >> 1) > 0.82 ? null : noise(x >> 1, y >> 1) > 0.5 ? M[5] : M[3]))
  disc(c, 36, 14, 8, 3, (x, y) => (noise(x >> 1, y >> 1) > 0.8 ? null : noise(x >> 1, y >> 1) > 0.5 ? M[5] : M[4]))
  disc(c, 26, 28, 12, 2.4, (x, y) => (noise(x >> 1, y >> 1) > 0.5 ? M[4] : M[3]))
  for (const [x, y, k] of [[8, 13, M[6]], [16, 6, M[6]], [38, 11, M[6]]] as const)
    c.rect(x, y, 2, 1, k)
  frond(c, 46, 30, -1.1, 10, 0.8, [F[2], F[3], F[5]], 3)
  return c
}
export function fougeres() {
  const c = canvas(56, 34)
  const a = [F[1], F[2], F[4]]
  const b = [F[2], F[3], F[5]]
  disc(c, 28, 31, 22, 3, SH)
  for (const [x, an, l, be] of [[24, -2.0, 24, -1.0], [30, -1.1, 24, 1.0], [27, -1.6, 22, 0.1]] as const)
    frond(c, x, 32, an, l, be, a, 4)
  for (const [x, an, l, be] of [[22, -2.6, 20, -1.1], [32, -0.5, 20, 1.1], [26, -1.9, 17, -0.6], [29, -1.2, 17, 0.6]] as const)
    frond(c, x, 32, an, l, be, b, 4)
  return c
}

export function ruisseau() {
  const c = canvas(150, 56)
  const [yc, hw] = [(x: number) => 30 - 10 * Math.sin((x / 150) * 6.283 * 0.9), (x: number) => 8 + 5 * Math.sin((x / 150) * 6.283 + 1)]
  for (let x = 0; x < 150; x += 1) {
    const [a, b] = [Math.round(yc(x) - hw(x)), Math.round(yc(x) + hw(x))]
    for (let y = a - 2; y <= b + 2; y += 1) c.set(x, y, y < a || y > b ? ((x + y) % 5 ? E[2] : E[3]) : ['#1E5660', '#184A54', '#123A46'][Math.min(2, Math.floor(((y - a) / (b - a + 1)) * 3))]!)
    if (x % 19 < 8) c.set(x, a + 3 + (x % 4), '#3E8A8E')
    if ((x + 9) % 23 < 6) c.set(x, b - 3, '#84C8BC')
    c.set(x, a, '#3E8A8E')
  }
  for (let i = 0; i < 26; i += 1) {
    const x = Math.floor(noise(i, 3) * 150)
    const t = i % 2
    const y = Math.round(yc(x) + (t ? 1 : -1) * (hw(x) + 3))
    const s = 2 + noise(i, 4) * 2
    disc(c, x, y, s + 1, s, (px, py) => (py < y ? R[3] : R[1]))
  }
  for (const x of [22, 26, 30, 104, 108, 112, 132]) {
    const y = Math.round(yc(x) + hw(x) + 4)
    for (let j = 0; j < 12; j += 1) c.set(x + Math.round(j * 0.1), y - j, j % 3 ? M[4] : M[3])
    c.rect(x, y - 15, 2, 4, B[2])
  }
  return c
}

/** The crab's nest, of twigs and moss. */
export function nid(dort = false) {
  const c = canvas(38, 22)
  c.rect(2, 19, 34, 3, SH)
  disc(c, 19, 11, 17.5, 9, B[1])
  disc(c, 19, 9, 13.5, 5.5, M[2])
  disc(c, 19, 8.5, 12, 4.4, (x, y) => (noise(x >> 1, y >> 1) > 0.66 ? M[5] : noise(x >> 1, y >> 1) > 0.3 ? M[4] : M[3]))
  for (let i = 0; i < 90; i += 1) {
    const a = noise(i, 11) * 6.28
    const r = 0.74 + noise(i, 12) * 0.28
    const x = 19 + Math.cos(a) * 17 * r
    const y = 11 + Math.sin(a) * 9 * r
    const ta = a + 1.2 + noise(i, 13)
    const l = 3 + noise(i, 14) * 4
    if (y < 6 && Math.abs(x - 19) < 12) continue
    line(c, x, y, x + Math.cos(ta) * l, y + Math.sin(ta) * l * 0.6, [B[3], B[4], B[5], B[2]][i % 4]!)
  }
  for (const [x, y] of [[2, 6], [34, 5], [31, 19], [5, 17]] as const)
    line(c, x, y, x + 4, y - 2, B[5])
  if (dort) c.sprite(['...cccccccccc...', '..cLLLLLLLLLLc..', '.cLccccccccccsc.', 'cccgccccccgcccss', 'ccccccccccccccss', '.ccccccLLccccss.', '..cc.cccccc.cc..'], { c: '#D97757', L: '#EE9A7C', s: '#B85A3C', g: '#1B1730' }, 11, 3)
  return c
}

/** The tent behind a person: 64 by 46 cells, 2 to the left of the desk and 22 above it. */
export function tente() {
  const c = canvas(64, 46)
  const cx = 32
  const W = ['#6E6248', '#8A7E60', '#A89A78', '#C8BA94', '#E4D8B4'] as const
  line(c, 12, 22, 0, 44, B[6])
  line(c, 52, 22, 63, 44, B[5])
  for (const x of [0, 62]) {
    c.rect(x, 42, 2, 4, B[2])
    c.set(x, 42, B[5])
  }
  for (let y = 3; y < 46; y += 1) {
    const hw = Math.round((y - 3) * 0.7) + 1,
      oh = y > 8 ? Math.round((y - 8) * 0.56) : -1
    for (let x = cx - hw; x < cx + hw; x += 1) {
      const left = x < cx,
        e = Math.abs(x + 0.5 - cx) / hw
      let p: string | null = left ? W[e > 0.9 ? 4 : 3] : W[e > 0.8 ? 0 : 1]
      if ((y + Math.floor(Math.abs(x - cx) * 1.3)) % 11 === 0) p = left ? W[2] : W[0]
      if (Math.abs(x + 0.5 - cx) <= oh) p = null
      if (p) c.set(x, y, p)
    }
    for (let x = cx - oh; x < cx + oh; x += 1) c.set(x, y, mix('#5A3A20', '#20160E', Math.min(1, (y - 8) / 16 + Math.abs(x - cx) / 24)))
    if (oh > 0) {
      for (let k = 0; k < 4; k += 1) {
        c.set(cx - oh - 1 - k, y, k < 2 ? W[4] : W[2])
        c.set(cx + oh + k, y, k < 2 ? W[1] : W[0])
      }
    }
  }
  for (const s of [-1, 1]) {
    const y = 26
    const oh = 10
    c.rect(cx + s * (oh + 2) - 1, y, 3, 2, B[1])
    line(c, cx + s * oh, y + 1, cx + s * (oh + 7), y + 1, B[6])
  }
  c.rect(cx - 1, 0, 2, 5, B[4])
  c.set(cx - 1, 0, B[6])
  c.sprite(['rrrr.', 'rrrrr', 'rrr..'], { r: '#C8583E' }, cx + 1, 0)
  box(c, 12, 34, 7, 6, '#7E6E3E', '#A08E54', '#5E5230')
  for (const y of [34, 39]) for (let x = 12; x < 19; x += 2) c.set(x, y, P[0])
  disc(c, 48, 42, 8, 3.4, (x, y) => (noise(x >> 1, y >> 1) > 0.5 ? M[3] : M[2]))
  return c
}

/** A camp table on trestles, with the marks of `desk()`: the rail, the name and the hands land on it the same. */
export function bureau(state: DeskState | 'rest') {
  const c = canvas(60, 45)
  c.rect(3, 41, 54, 4, SH)
  c.rect(1, 43, 58, 2, SH)
  for (const x of [5, 47]) {
    for (const [a, b] of [[0, 8], [8, 0]] as const) {
      line(c, x + a, 27, x + b, 43, B[1])
      line(c, x + a + 1, 27, x + b + 1, 43, B[4])
      line(c, x + a + 2, 27, x + b + 2, 43, B[2])
    }
    c.rect(x - 1, 43, 12, 1, B[1])
  }
  for (const x of [9, 50]) {
    c.rect(x, 28, 1, 3, B[6])
  }
  c.rect(5, 30, 50, 10, B[1])
  c.rect(6, 31, 48, 8, CR)
  c.rect(6, 31, 48, 1, PAP)
  c.rect(6, 38, 48, 1, '#D8C49E')
  for (const x of [7, 52]) {
    c.rect(x, 34, 1, 2, B[3])
    c.set(x, 33, B[1])
  }
  c.rect(1, 18, 58, 9, B[4])
  for (const y of [20, 22, 24]) {
    c.rect(1, y, 58, 1, B[2])
  }
  grain(c, 2, 19, 56, 7, B[3], B[5], 91)
  for (const y of [20, 22, 24]) c.rect(1, y, 58, 1, B[2])
  c.rect(1, 18, 58, 1, B[6])
  c.rect(0, 26, 60, 2, B[3])
  c.rect(0, 26, 60, 1, B[5])
  c.rect(0, 27, 60, 1, B[1])
  for (const x of [4, 55]) {
    c.rect(x, 19, 1, 7, B[1])
  }
  c.rect(0, 19, 1, 7, B[5])
  c.rect(59, 19, 1, 7, B[2])
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
  c.rect(43, 17, 4, 5, CR)
  c.rect(43, 17, 4, 1, '#3C6E8C')
  c.rect(43, 21, 4, 1, '#3C6E8C')
  c.rect(46, 18, 1, 3, '#D8C49E')
  c.rect(48, 18, 1, 3, INK)
  c.rect(29, 21, 9, 5, P[3])
  c.rect(30, 20, 9, 5, P[0])
  line(c, 31, 23, 37, 21, '#3E7A62')
  c.rect(32, 22, 2, 1, '#C8A65E')
  disc(c, 34, 24, 1.4, 1, L[2])
  c.set(34, 24, '#C8583E')
  disc(c, 27.5, 21, 1.6, 2.4, (x, y) => ((x + y) % 2 ? B[2] : B[4]))
  disc(c, 54, 15, 6.5, 7.5, (_, __, d) => (d < 0.5 ? '#FFC857|0.2' : '#FFC857|0.09'))
  c.rect(51, 21, 7, 2, '#3E5A4C')
  c.rect(51, 21, 7, 1, '#6E9480')
  c.rect(52, 23, 5, 1, INK)
  disc(c, 54.5, 17, 3, 4, (x, y, d) => (d < 0.4 ? PAP : '#FFD880'))
  c.rect(51, 13, 7, 1, '#3E5A4C')
  c.rect(53, 12, 3, 1, '#6E9480')
  for (let a = 3.3; a < 6.2; a += 0.1) c.set(54.5 + Math.cos(a) * 3, 11 + Math.sin(a) * 3, K_FER)
  return c
}

/** The screen on a tripod of branches: 44 by 80 cells, the glass 30 by 19 at (7, 18). */
export function tele() {
  const c = canvas(44, 80)
  disc(c, 22, 77, 20, 2.6, SH)
  branch(c, 32, 0, 8, 78)
  branch(c, 12, 0, 37, 78)
  branch(c, 22, 30, 22, 74)
  c.rect(19, 46, 7, 3, B[6])
  c.rect(19, 47, 7, 1, B[3])
  c.rect(4, 15, 36, 25, E[1])
  const h = (y: number) => {
    c.rect(0, y, 44, 4, E[2])
    bark(c, 0, y, 44, 4, y)
    c.rect(0, y, 44, 1, B[5])
    c.rect(0, y + 3, 44, 1, B[1])
    disc(c, 0.5, y + 1.5, 1.4, 2, B[6])
    disc(c, 43.5, y + 1.5, 1.4, 2, B[6])
  }
  const v = (x: number) => {
    c.rect(x, 11, 4, 33, E[2])
    bark(c, x, 11, 4, 33, x)
    c.rect(x, 11, 1, 33, B[5])
    c.rect(x + 3, 11, 1, 33, B[1])
    disc(c, x + 1.5, 11.5, 2, 1.4, B[6])
  }
  h(14)
  h(37)
  v(3)
  v(37)
  for (const [x, y] of [[3, 14], [37, 14], [3, 37], [37, 37]] as const)
    for (let k = 0; k < 4; k += 1) {
      c.set(x + k, y + k, P[2])
      c.set(x + 3 - k, y + k, P[1])
    }
  c.rect(7, 18, 30, 19, '#0B0A14')
  c.rect(8, 19, 28, 17, '#0C2018')
  for (let y = 20; y < 35; y += 2) c.rect(8, y, 28, 1, '#102A20')
  c.rect(8, 19, 28, 1, '#1D4A3C')
  c.rect(8, 35, 28, 1, '#1D4A3C')
  c.rect(8, 20, 1, 15, '#1D4A3C')
  c.rect(35, 20, 1, 15, '#1D4A3C')
  for (const [x, y, w] of [[31, 20, 4], [32, 21, 3], [33, 22, 2]] as const)
    c.rect(x, y, w, 1, '#2A6A54')
  c.rect(33, 38, 2, 1, '#7FE0C8')
  disc(c, 13, 14, 8, 2.2, (x, y) => (noise(x >> 1, y >> 1) > 0.5 ? M[5] : M[3]))
  ivy(c, 34, 11, 3)
  ivy(c, 38, 13, 2)
  return c
}

/** The cost on a nailed arrow: 36 by 12 cells, its text in (2, 3), 31 by 7. */
export function plaque() {
  const c = canvas(36, 12)
  c.rect(0, 2, 33, 9, B[4])
  for (let k = 0; k < 4; k += 1) c.rect(33 + k - 1, 3 + k, 1, 7 - k * 2, B[4])
  c.rect(0, 2, 33, 1, B[6])
  c.rect(0, 10, 33, 1, B[2])
  c.rect(0, 2, 1, 9, B[6])
  grain(c, 1, 3, 34, 7, B[3], B[5], 17)
  c.rect(2, 3, 31, 7, '#1C140E')
  c.rect(2, 3, 31, 1, '#120C08')
  c.rect(2, 9, 31, 1, '#2C2016')
  for (const [x, y] of [[1, 3], [1, 9], [33, 6]] as const)
    c.set(x, y, R[3])
  c.rect(1, 11, 32, 1, '#1B1730|0.28')
  return c
}

/**
 * The trail sign of the plan, `w` by `h` pixels of the room: the paper and the wood follow them, the roof and the two
 * posts stay. A cell is 2 pixels; the sign stands 4 to the left of the board's place and 10 above it.
 */
export function panneau(w: number, h: number) {
  const width = Math.ceil(w / 2) + 4
  const paper = Math.floor(h / 2) + 4
  const foot = Math.max(paper + 21, 81)
  // A full board stands high on the wall: its roof loses a course or two to stay in the room.
  const roof = h >= 130 ? 3 : 0
  const c = canvas(width, foot + 1)
  disc(c, width / 2, foot - 1, width / 2 - 2, 2, SH)
  for (const x of [5, width - 9]) {
    c.rect(x, 6, 4, foot - 6, E[2])
    bark(c, x, 6, 4, foot - 6, x)
    c.rect(x, 6, 1, foot - 6, B[5])
    c.rect(x + 3, 6, 1, foot - 6, B[1])
  }
  c.rect(3, 8, width - 6, paper - 4, B[3])
  grain(c, 3, 8, width - 6, paper - 4, B[2], B[4], 5)
  for (const x of [14, 30, 47]) if (x < width - 8) c.rect(x, 8, 1, paper - 4, B[2])
  c.rect(3, paper + 3, width - 6, 1, B[1])
  c.rect(5, paper + 4, width - 10, 1, '#1B1730|0.3')
  c.rect(5, 9, width - 10, paper - 8, '#C9B48A')
  c.rect(6, 10, width - 12, paper - 10, PAP)
  c.rect(5, paper + 1, width - 10, 1, B[1])
  for (let j = roof; j < 9; j += 1) {
    const ins = Math.round((8 - j) * 0.7)
    for (let x = ins; x < width - ins; x += 1) {
      const s = (x + (j % 3 === 1 ? 2 : j % 3 === 2 ? 4 : 0)) % 6 === 0
      c.set(x, j, j % 3 === 2 ? B[0] : s ? B[1] : j % 3 === 0 ? B[3] : B[2])
    }
  }
  c.rect(0, 8, width, 1, B[4])
  c.rect(1, 9, width - 2, 1, '#1B1730|0.4')
  for (const [x, y, rx] of [[18, 3, 10], [width - 19, 5, 11], [width / 2, 1, 6]] as const) disc(c, x, Math.max(y, roof + 2), rx, 2.2, (px, py) => (noise(px >> 1, py >> 1) > 0.75 ? null : noise(px >> 1, py >> 1) > 0.45 ? M[5] : M[3]))
  const sign = paper + 8
  c.rect(9, sign, width - 18, 7, B[4])
  c.rect(9, sign, width - 18, 1, B[6])
  c.rect(9, sign + 6, width - 18, 1, B[2])
  grain(c, 9, sign + 1, width - 18, 5, B[3], B[5], 7)
  for (let k = 0; k < 7; k += 1) c.rect(Math.round(width / 2) - 11 + k * 3, sign + 2, 2, 3, ['#C8583E', P[1], '#3E7A62'][k % 3]!)
  for (const x of [9, width - 10]) c.set(x, sign + 3, R[3])
  for (const x of [8, width - 7]) {
    frond(c, x, foot, -2.1, 9, -0.7, [F[2], F[3], F[5]], 2)
    frond(c, x, foot, -1, 9, 0.7, [F[2], F[3], F[5]], 2)
  }
  for (const [x, y, k] of [[3, paper + 4, 3], [6, paper + 10, 2], [4, paper + 16, 3], [width - 11, paper + 6, 2], [width - 8, paper + 14, 3]] as const) ivy(c, x, y, k)
  return `<g transform="translate(-4 -10) scale(2)">${paths(c)}</g>`
}

/** The campfire: stones and logs. Flames, smoke and ash all fall on the same grid of 60 by 64 cells. */
export function foyer() {
  const c = canvas(60, 64)
  disc(c, 30, 54, 26, 8, SH)
  disc(c, 30, 51, 21, 8, (x, y) => (noise(x >> 1, y >> 1) > 0.6 ? E[1] : E[0]))
  const pierre = (x: number, y: number, s: number) =>
    disc(c, x, y, s + 1, s, (px, py) => {
      const l = (-(px - x) / (s + 1)) * 0.6 - (py - y) / s + (noise(Math.floor(px / 2), py) - 0.5) * 0.5
      return R[Math.max(0, Math.min(3, Math.floor((l + 1) * 2)))]!
    })
  const anneau = (from: number, to: number) => {
    for (let i = from; i < to; i += 1) {
      const a = (i / 14) * 6.283 + 0.2
      pierre(30 + Math.cos(a) * 23, 51 + Math.sin(a) * 9, 3 + (i % 3) * 0.6)
    }
  }
  anneau(7, 14)
  for (const [x0, y0, x1, y1] of [[16, 54, 34, 30], [44, 54, 26, 30], [30, 57, 30, 28], [22, 56, 38, 34], [38, 56, 22, 34]] as const) {
    for (let k = -2; k <= 2; k += 1) line(c, x0 + k, y0, x1 + k, y1, k < 0 ? B[4] : k > 0 ? B[1] : B[3])
    line(c, x1 - 1, y1, x1 + 1, y1 + 3, E[0])
    line(c, x1, y1, x1 + 1, y1 + 5, E[1])
    disc(c, x0, y0, 2.4, 1.8, B[6])
    c.set(x0, y0, B[3])
  }
  disc(c, 30, 52, 10, 3, (x, y) => (noise(x >> 1, y >> 1) > 0.5 ? E[4] : R[1]))
  anneau(0, 7)
  disc(c, 8, 56, 3, 1.4, (x, y) => (noise(x >> 1, y >> 1) > 0.5 ? M[5] : M[3]))
  return c
}
function flammes() {
  const c = canvas(60, 64)
  disc(c, 30, 50, 29, 13, (_, __, d) => (d < 0.4 ? '#FFC857|0.2' : '#FFC857|0.09'))
  const cols = (cy: number, hw: number, h: number, p: string, s: number) => {
    for (let x = 30 - hw; x <= 30 + hw; x += 1) {
      const u = (x - 30) / hw,
        t = Math.max(0, 1 - u * u),
        hh = h * t * (0.72 + 0.34 * Math.sin(x * 1.35 + s) * Math.sin(x * 0.53 + s))
      for (let j = 0; j < hh; j += 1) c.set(x, cy - j, p)
    }
  }
  cols(52, 17, 40, '#B8452A', 1)
  cols(52, 14, 32, '#E4633A', 3)
  cols(52, 11, 24, '#FFA03C', 5)
  cols(52, 8, 17, '#FFC857', 2)
  cols(52, 4, 10, '#FFF6DE', 4)
  for (const [x, y] of [[17, 22], [41, 16], [26, 8], [36, 26], [21, 13], [46, 30]] as const) {
    c.set(x, y, '#FFC857')
    c.set(x, y + 1, '#E4633A')
  }
  return c
}
function fumee() {
  const c = canvas(60, 64)
  for (const [s0, ph, n] of [[0, 0, 15], [1, 2.2, 11]] as const)
    for (let i = 0; i < n; i += 1) {
      const y = 26 - i * 1.7
      const x = 30 + s0 * 3 + (2 + i * 0.5) * Math.sin(i * 0.7 + ph)
      const r = 1.2 + i * 0.16
      disc(c, x, y, r, r, i % 2 ? '#E8E8E0|0.26' : '#D4D4CC|0.32')
    }
  return c
}

const LEVELS: Record<FireLevel, number> = { full: 3, medium: 3, low: 2, embers: 2, out: 2 }
export const fireFrames = (level: FireLevel) => LEVELS[level]

/** Every level of the fire, on the campfire's grid. Full, first image: the drawing as designed. */
function flammesNiveau(niveau: FireLevel, frame: number) {
  const image = (frame % LEVELS[niveau]) + 1
  if (niveau === 'full' && image === 1) return flammes()
  const c = canvas(60, 64),
    o = (image - 1) * 1.7
  const cols = (cx: number, hw: number, h: number, p: string, s: number) => {
    for (let x = cx - hw; x <= cx + hw; x += 1) {
      const u = (x - cx) / hw,
        t = Math.max(0, 1 - u * u),
        hh = h * t * (0.72 + 0.34 * Math.sin(x * 1.35 + s + o) * Math.sin(x * 0.53 + s + o))
      for (let j = 0; j < hh; j += 1) c.set(x, 52 - j, p)
    }
  }
  const pts = (l: readonly (readonly [number, number])[]) => {
    for (const [x, y] of l) {
      c.set(x, y, '#FFC857')
      c.set(x, y + 1, '#E4633A')
    }
  }
  if (niveau === 'full') {
    disc(c, 30, 50, 29, 13, (_, __, d) => (d < 0.4 ? '#FFC857|0.2' : '#FFC857|0.09'))
    cols(30, 17, 40, '#B8452A', 1)
    cols(30, 14, 32, '#E4633A', 3)
    cols(30, 11, 24, '#FFA03C', 5)
    cols(30, 8, 17, '#FFC857', 2)
    cols(30, 4, 10, '#FFF6DE', 4)
    pts(
      image === 2
        ? [[14, 20], [44, 12], [30, 6], [38, 24], [24, 16], [48, 28]]
        : [[20, 18], [38, 10], [26, 12], [46, 24], [15, 28], [34, 4]],
    )
  } else if (niveau === 'medium') {
    disc(c, 30, 51, 24, 11, (_, __, d) => (d < 0.4 ? '#FFC857|0.15' : '#FFC857|0.07'))
    cols(30, 14, 26, '#B8452A', 1)
    cols(30, 11, 20, '#E4633A', 3)
    cols(30, 8, 14, '#FFA03C', 5)
    cols(30, 5, 9, '#FFC857', 2)
    pts([[20 + image * 3, 28 - image], [40 - image * 2, 24 + image], [30, 20 - image]] as const)
  } else if (niveau === 'low') {
    disc(c, 30, 52, 17, 8, (_, __, d) => (d < 0.4 ? '#FFC857|0.12' : '#FFC857|0.05'))
    for (const [cx, h] of image === 1
      ? [[22, 9], [30, 13], [38, 8]]
      : [[24, 12], [33, 9], [40, 6]] as const) {
      cols(cx, 4, h, '#B8452A', 1)
      cols(cx, 3, h * 0.7, '#E4633A', 3)
      cols(cx, 1, h * 0.4, '#FFC857', 2)
    }
  } else if (niveau === 'embers') {
    disc(c, 30, 52, 16, 7, '#E4633A|0.08')
    disc(c, 30, 52, 12, 4.4, (x, y) => {
      const n = noise(x + image * 7, y)
      return n > 0.86 ? '#FFC857' : n > 0.62 ? '#E4633A' : n > 0.42 ? '#B8452A' : null
    })
    for (const [x, y] of image === 1
      ? [[26, 43], [33, 40]]
      : [[29, 41], [35, 44]] as const) {
      c.rect(x, y, 2, 1, '#E4633A')
      c.set(x, y + 1, '#B8452A')
    }
  } else if (image === 2) {
    for (const [x, y, p] of [[30, 40, '#8A8078'], [31, 37, '#7A736C'], [30, 34, '#6A6460'], [31, 31, '#5A5652|0.7'], [30, 28, '#5A5652|0.5']] as const) {
      c.set(x, y, p)
      c.set(x, y - 1, p)
    }
  }
  return c
}

/** The fire of a level with its smoke, on the same grid: the drawn layer shows it and nothing outside. */
export const flammesFeu = (level: FireLevel, frame: number) => paths(flammesNiveau(level, frame)) + (level === 'full' || level === 'medium' || level === 'low' ? paths(fumee()) : '')

/** The ash between the stones and the flames: it leaves the ring as it grows. */
export function cendres(niveau: AshLevel, frame: number) {
  const image = frame + 1
  const c = canvas(60, 64),
    A = '#A59A90',
    C_ = '#D6CFC4',
    G = '#8A8078',
    H = '#7A6A5E'
  const tas = (cx: number, base: number, hw: number, h: number, seed: number) => {
    for (let x = cx - hw; x <= cx + hw; x += 1) {
      const u = (x - cx) / hw,
        t = 1 - u * u,
        top = Math.round(base - h * t ** 0.7 - (noise(x, seed) - 0.5) * (h > 4 ? 1.6 : 0.6)),
        bot = Math.round(base + 3 * Math.sqrt(t))
      for (let y = top; y <= bot; y += 1) {
        const n = noise(x + seed, y)
        c.set(x, y, y < top + 1 ? C_ : u > 0.4 ? (n > 0.6 ? H : G) : u < -0.4 ? (n > 0.7 ? C_ : A) : n > 0.86 ? G : n > 0.14 ? A : C_)
      }
      c.set(x, bot + 1, '#1B1730|0.28')
    }
  }
  const semis = (n: number, seed: number) => {
    for (let i = 0; i < n; i += 1) {
      const a = noise(i, seed) * 6.283
      const r = 0.85 + noise(i, seed + 1) * 0.3
      const x = 30 + Math.cos(a) * 27 * r
      const y = 53 + Math.sin(a) * 10 * r
      c.set(x, y, i % 3 ? G : A)
      if (i % 4 === 0) c.set(x + 1, y, A)
    }
  }
  const braise = (l: readonly (readonly [number, number, string])[]) => {
    for (const [x, y, p] of l) c.set(x, y, p)
  }
  if (niveau === 'small') {
    tas(30, 54, 13, 3, 3)
    semis(6, 5)
    braise([[27, 53, '#E4633A'], [34, 54, '#B8452A']] as const)
  }
  if (niveau === 'medium') {
    tas(30, 55, 19, 6, 4)
    semis(16, 7)
    braise([[23, 54, '#E4633A'], [34, 52, '#E4633A'], [38, 56, '#B8452A'], [29, 50, '#FFC857']] as const)
  }
  if (niveau === 'large') {
    tas(14, 58, 8, 3, 6)
    tas(46, 58, 8, 3, 8)
    tas(30, 56, 24, 11, 5)
    semis(26, 9)
    braise([[20, 52, '#E4633A'], [31, 48, '#E4633A'], [40, 54, '#E4633A'], [26, 56, '#B8452A'], [35, 50, '#FFC857']] as const)
  }
  if (niveau === 'full') {
    tas(9, 60, 8, 3, 7)
    tas(51, 60, 8, 3, 9)
    tas(30, 57, 27, 17, 6)
    semis(30, 11)
    braise(
      image === 1
        ? [[22, 50, '#E4633A'], [30, 44, '#E4633A'], [39, 52, '#E4633A'], [27, 54, '#FFC857'], [35, 47, '#FFC857'], [18, 56, '#B8452A']]
        : [[24, 48, '#E4633A'], [33, 45, '#FFC857'], [41, 50, '#E4633A'], [29, 53, '#E4633A'], [36, 56, '#B8452A'], [20, 54, '#FFC857']],
    )
    const f =
      image === 1
        ? ([[30, 38], [31, 36], [30, 34], [32, 32], [33, 29]] as const)
        : ([[31, 38], [30, 36], [31, 33], [29, 31], [28, 28]] as const)
    for (const [x, y] of f) c.set(x, y, '#FFF6DE|0.5')
  }
  return c
}
