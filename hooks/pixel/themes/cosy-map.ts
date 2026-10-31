import { t } from '../../i18n'
import { canvas, mix, noise } from '../canvas'
import type { Canvas } from '../canvas'
import { caseEtape, compteur, enveloppe } from '../decor'
import { fit, textWidth } from '../font'
import { ZZ, once, pick } from '../pack'
import type { Art, MapPack, MapRoom, MapView } from '../pack'
import { TENUES, WOOD, chair, desk, person } from '../sprites'
import { def, line, use } from '../text'
import { cosy } from './cosy'

type C = Canvas
type R3 = readonly [string, string, string]
type R4 = readonly [string, string, string, string]
type R5 = readonly [string, string, string, string, string]
const NUIT = '#1B1730'
const SH = '#1B1730|0.3'
const B = ['#2E1C16', '#4A2E22', '#6B4030', '#8A5A3A', '#A8744A', '#C99A68'] as const
const CR = '#F4E4C1'
const LUM = ['#B8763C', '#E8A848', '#FFC857', '#FFE08A', '#FFF6DE'] as const
const VITRE = ['#1C2040', '#262C52', '#364070', '#5A6A9C'] as const
const ROUGE = ['#5E1E1E', '#8E2E2A', '#B84A40', '#DE7656'] as const
const TERRE: R5 = ['#5A241A', '#6E2E20', '#8E3E28', '#A84E30', '#C46A44']
const ARDOISE: R5 = ['#262238', '#2E2A44', '#3C3658', '#4A4468', '#6A6488']
const ZINC: R5 = ['#2C3440', '#343E4C', '#465464', '#566474', '#7E8C9C']
const MOUSSE: R5 = ['#26342C', '#2E3E34', '#3E5246', '#4C6252', '#6E8870']

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
const trait = (c: C, x0: number, y0: number, x1: number, y1: number, paint: string) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i += 1) c.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), paint)
}
const tuiles = (c: C, p: R5, x0: number, y0: number, w: number, h: number, keep: (x: number, y: number) => boolean) => {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      if (!keep(x, y)) continue
      const r = Math.floor((y - y0) / 4)
      const o = r % 2 ? 3 : 0
      const dy = (y - y0) % 4
      const seam = (x + o) % 6 === 0 && noise(Math.floor((x + o) / 6), r + 7) > 0.45
      c.set(x, y, dy === 3 ? p[0] : seam ? p[1] : dy === 0 ? p[3] : p[2])
    }
  }
}

const W = 78
const H = 118
type Vitrine = 'maison' | 'livres' | 'cafe' | 'pain' | 'horloges'
type Facade = { kind: 'bardage' | 'brique' | 'crepi' | 'colombage' | 'uni'; mur: R5; bois?: R3; toit: 'pignon' | 'long' | 'mansarde'; tuile: R5; chem: number; vitrine: Vitrine; face: R4; bande: R3; porte: R3; store?: readonly [string, string]; attic?: string; fleurs?: boolean }

/** The walls. The windows land on them afterwards, at `FENETRES`. */
const mur = (c: C, t: Facade, y0: number, y1: number) => {
  const m = t.mur
  c.rect(0, y0, W, y1 - y0, m[2])
  if (t.kind === 'bardage') {
    for (let y = y0; y < y1; y += 4) {
      c.rect(0, y, W, 1, m[3])
      c.rect(0, y + 3, W, 1, m[1])
    }
    for (let i = 0; i < 5; i += 1) c.rect(Math.floor(noise(i, 31) * 70), y0 + 4 * Math.floor(noise(i, 32) * 10) + 1, 5, 1, m[0])
  }
  if (t.kind === 'brique') {
    for (let y = y0; y < y1; y += 3) {
      c.rect(0, y + 2, W, 1, m[1])
      for (let x = (y % 2) * 4; x < W; x += 8) if (noise(x, y) > 0.55) c.rect(x, y, 1, 2, m[1])
      for (let x = (y % 2) * 4 + 1; x < W; x += 8) if (noise(x, y + 3) > 0.84) c.rect(x, y, 6, 2, noise(x, y + 4) > 0.5 ? m[3] : m[0])
    }
  }
  if (t.kind === 'crepi') {
    for (let i = 0; i < 16; i += 1) c.set(Math.floor(noise(i, 11) * W), y0 + Math.floor(noise(i, 12) * (y1 - y0)), noise(i, 13) > 0.5 ? m[3] : m[1])
    for (let y = y0; y < y1; y += 8) {
      for (const x of [0, W - 5]) {
        c.rect(x, y, 5, 7, m[3])
        c.rect(x, y, 5, 1, m[4])
        c.rect(x, y + 7, 5, 1, m[1])
      }
    }
  }
  if (t.kind === 'colombage') {
    const p = t.bois!
    for (let i = 0; i < 10; i += 1) c.set(Math.floor(noise(i, 11) * W), y0 + Math.floor(noise(i, 12) * (y1 - y0)), m[1])
    for (const x of [0, 5, 37, 39, 72, 76]) c.rect(x, y0, 2, y1 - y0, p[1])
    for (const x of [0, 5, 37, 39, 72, 76]) c.rect(x, y0, 1, y1 - y0, p[2])
    for (let i = 0; i < 26; i += 2) {
      c.rect(7 + Math.floor(i * 1.1), 65 - i, 3, 2, p[1])
      c.rect(70 - Math.floor(i * 1.1), 65 - i, 3, 2, p[1])
    }
    c.rect(0, 30, W, 3, p[1])
    c.rect(0, 30, W, 1, p[2])
  }
}

function toit(c: C, t: Facade) {
  const p = t.tuile
  if (t.toit === 'pignon') {
    // The wall rises to a point, and the barge board underlines it.
    const keep = (x: number, y: number) => Math.abs(x - 38.5) <= (y - 1) * 1.32
    const g = canvas(W, 33)
    mur(g, { ...t, kind: t.kind === 'crepi' ? t.kind : 'uni' }, 0, 33)
    for (let y = 0; y < 33; y += 1) for (let x = 0; x < W; x += 1) if (keep(x, y) && g.get(x, y)) c.set(x, y, g.get(x, y))
    if (t.kind === 'colombage') {
      c.rect(37, 4, 3, 29, t.bois![1])
      for (let i = 0; i < 16; i += 2) {
        c.rect(36 - i, 14 + i, 3, 2, t.bois![1])
        c.rect(39 + i, 14 + i, 3, 2, t.bois![1])
      }
    }
    for (let y = 1; y < 32; y += 1) {
      const hw = Math.round((Math.floor(y / 2) * 2 - 1) * 1.32)
      for (const s of [-1, 1]) {
        for (let k = -2; k <= 0; k += 1) {
          const x = Math.round(38.5 + s * (hw + k + 1))
          if (x >= 0 && x < W) c.set(x, y, k === 0 ? p[4] : k === -2 ? B[0] : p[2])
        }
      }
    }
    disc(c, 38.5, 19, 5.5, 5.5, B[1])
    disc(c, 38.5, 19, 4.4, 4.4, t.attic ?? VITRE[2])
    c.rect(38, 15, 1, 8, B[1])
    c.rect(34, 19, 9, 1, B[1])
    return
  }
  if (t.toit === 'long') {
    tuiles(c, p, 0, 8, W, 24, (x, y) => y >= 8 && x >= (32 - y) * 0.5 - 2 && x <= W + 1 - (32 - y) * 0.5)
    c.rect(11, 7, 56, 2, p[4])
    c.rect(11, 6, 56, 1, B[4])
    box(c, 32, 14, 14, 11, B[2], B[4], B[0])
    c.rect(34, 16, 10, 7, t.attic ?? VITRE[2])
    c.rect(38, 16, 2, 7, B[1])
    c.rect(30, 12, 18, 2, p[4])
  } else {
    const keep = (x: number, y: number) => (y >= 12 ? x >= (30 - y) * 0.36 - 1 && x <= W - (30 - y) * 0.36 : y >= 6 && x >= 6 + (12 - y) * 1.8 && x <= W - 7 - (12 - y) * 1.8)
    tuiles(c, p, 0, 6, W, 26, keep)
    for (let x = 6; x < W - 6; x += 1) if (keep(x, 11)) c.set(x, 11, p[4])
    c.rect(18, 5, 42, 1, B[4])
    for (const x of [14, 50]) {
      c.rect(x + 1, 13, 12, 2, CR)
      box(c, x + 2, 15, 10, 11, B[1], B[3], B[0])
      c.rect(x + 3, 16, 8, 9, t.attic ?? VITRE[2])
      c.rect(x + 6, 16, 2, 9, B[1])
    }
  }
  c.rect(0, 30, W, 2, B[0])
  c.rect(0, 30, W, 1, p[4])
}

const cheminee = (c: C, x: number, y: number) => {
  box(c, x, y, 9, 16, ROUGE[1], ROUGE[2], ROUGE[0])
  for (let j = 3; j < 14; j += 3) c.rect(x + 1, y + j, 7, 1, ROUGE[0])
  c.rect(x - 1, y, 11, 2, CR)
  c.rect(x - 1, y + 1, 11, 1, '#B8A888')
  c.rect(x + 2, y - 3, 2, 3, B[2])
  c.rect(x + 5, y - 3, 2, 3, B[2])
}

/** What each shop shows, in 26 by 26 cells. */
const VITRINES: Record<Vitrine, (c: C, x: number, y: number) => void> = {
  maison(c, x, y) {
    c.rect(x, y, 26, 26, '#5A3A52')
    disc(c, x + 7, y + 9, 7, 7, '#FFC857|0.35')
    c.rect(x + 6, y + 3, 3, 1, LUM[3])
    c.rect(x + 4, y + 4, 7, 3, LUM[2])
    c.rect(x + 7, y + 7, 1, 14, B[2])
    box(c, x + 13, y + 12, 11, 12, B[3], B[4], B[1])
    ;['#C75A4E', '#3F7CC8', '#E0A030', '#2A9D8F'].forEach((col, i) => c.rect(x + 14, y + 14 + i * 3, 9, 1, col))
    c.rect(x, y + 23, 26, 3, '#3C2438')
  },
  livres(c, x, y) {
    c.rect(x, y, 26, 26, B[1])
    const cols = ['#C75A4E', '#3F7CC8', '#E0A030', '#2A9D8F', '#7F6BD6', '#D4537E', CR, '#3E7A4C']
    for (const [row, top] of [[0, 2], [1, 13]] as const) {
      let px = x + 1
      for (let i = 0; px < x + 25; i += 1) {
        const w = 2 + Math.floor(noise(i, row + 3) * 2)
        const h = 7 + Math.floor(noise(i, row + 5) * 3)
        const col = cols[(i * 3 + row) % 8]!
        c.rect(px, y + top + 9 - h, Math.min(w, x + 25 - px), h, col)
        c.rect(px, y + top + 9 - h, 1, h, mix(col, '#FFFFFF', 0.3))
        px += w
      }
      c.rect(x, y + top + 9, 26, 2, B[3])
      c.rect(x, y + top + 9, 26, 1, B[5])
    }
    c.rect(x, y + 24, 26, 2, B[0])
  },
  cafe(c, x, y) {
    c.rect(x, y, 26, 26, '#6E3A2C')
    for (let i = 0; i < 3; i += 1) {
      c.rect(x + 4 + i * 8, y, 1, 5, NUIT)
      c.rect(x + 2 + i * 8, y + 5, 5, 2, B[4])
      c.rect(x + 3 + i * 8, y + 7, 3, 1, LUM[4])
      disc(c, x + 4.5 + i * 8, y + 9, 4, 3, '#FFC857|0.3')
    }
    c.rect(x + 2, y + 12, 11, 8, '#8A8FA3')
    c.rect(x + 2, y + 12, 3, 8, '#C8CCD8')
    c.rect(x + 3, y + 10, 9, 2, '#5A5E74')
    c.rect(x + 6, y + 16, 3, 1, NUIT)
    for (const [px, col] of [[15, '#C4553A'], [20, '#3C7E92']] as const) {
      c.rect(x + px, y + 16, 4, 4, col)
      c.rect(x + px, y + 16, 1, 4, mix(col, '#FFFFFF', 0.3))
    }
    c.rect(x, y + 20, 26, 6, B[3])
    c.rect(x, y + 20, 26, 1, B[5])
  },
  pain(c, x, y) {
    c.rect(x, y, 26, 26, '#C48A4A')
    c.rect(x, y, 26, 12, '#D8A25A')
    for (const [px, py] of [[2, 3], [9, 2], [16, 3]] as const) {
      disc(c, x + px + 3, y + py + 3, 3.6, 2.6, '#C07E38')
      c.set(x + px + 2, y + py + 2, '#F0D088')
    }
    c.rect(x, y + 8, 26, 2, B[2])
    for (let i = 0; i < 4; i += 1) {
      c.rect(x + 5 + i * 5, y + 11, 3, 8, i % 2 ? '#C48A3C' : '#E0AE5C')
      c.rect(x + 7 + i * 5, y + 11, 1, 8, '#8E5A28')
    }
    box(c, x + 2, y + 17, 22, 7, B[3], B[4], B[1])
    c.rect(x, y + 24, 26, 2, B[1])
  },
  horloges(c, x, y) {
    c.rect(x, y, 26, 26, '#4A2C2A')
    const cadran = (cx: number, cy: number, r: number, h1: number, h2: number) => {
      disc(c, cx, cy, r + 1, r + 1, B[3])
      disc(c, cx, cy, r, r, '#FFF6DE')
      c.rect(cx, cy - h1, 1, h1, NUIT)
      c.rect(cx, cy, h2, 1, NUIT)
    }
    cadran(x + 7, y + 7, 5, 4, 3)
    cadran(x + 19, y + 6, 3, 2, 2)
    cadran(x + 19, y + 15, 4, 3, 2)
    box(c, x + 3, y + 14, 9, 11, B[3], B[4], B[1])
    disc(c, x + 7, y + 18, 2, 2, '#FFF6DE')
    c.rect(x + 7, y + 20, 1, 3, LUM[1])
    c.rect(x, y + 24, 26, 2, B[0])
  },
}
const SIGNES: Record<Vitrine, readonly string[]> = {
  maison: [],
  livres: ['.CCCCCC.', 'CCCCCCCC', 'rrrrrrrr', 'rCCrrCCr', 'rCCrrCCr', 'rrrrrrrr'],
  cafe: ['.C.C.C..', '........', 'CCCCCCC.', 'CCCCCCCC', 'CCCCCC.C', '.CCCC...'],
  pain: ['...rr...', '.rCCrr..', 'rrCCrrr.', 'rrrCCrrr', '.rrrCCr.', '..rrr...'],
  horloges: ['..nnnn..', '.nCCnCn.', 'nCCCnCCn', 'nCCCnnCn', '.nCCCCn.', '..nnnn..'],
}

/** The five houses a conversation may draw, the lightest of the seven of the mock-up. */
const FACADES: readonly Facade[] = [
  { kind: 'bardage', mur: ['#16323F', '#1E4252', '#2C5E70', '#3C7E92', '#5AA0B0'], toit: 'long', tuile: ARDOISE, chem: 56, vitrine: 'livres', face: ['#16323F', '#20485A', '#2C6276', '#5AA0B0'], bande: ['#16323F', '#20485A', '#3C7E92'], porte: ['#3A1E1E', '#8E2E2A', '#B84A40'] },
  { kind: 'crepi', mur: ['#7E5A28', '#A87E38', '#C49A4C', '#D8B468', '#E8CC88'], toit: 'mansarde', tuile: ZINC, chem: 62, vitrine: 'cafe', face: ['#3A1414', '#5E1E1E', '#8E2E2A', '#B84A40'], bande: ['#3A1414', '#5E1E1E', '#8E2E2A'], porte: ['#3A1414', '#5E1E1E', '#8E2E2A'], store: ['#8E2E2A', '#E8D8B8'] },
  { kind: 'crepi', mur: ['#7A4638', '#9A5C4A', '#B4745E', '#C88C74', '#DCA890'], toit: 'pignon', tuile: MOUSSE, chem: 14, vitrine: 'horloges', face: [B[0], B[1], B[3], B[4]], bande: [B[0], B[2], B[3]], porte: ['#16323F', '#2C6276', '#3C7E92'] },
  { kind: 'colombage', mur: ['#7A6448', '#A08A68', '#BCA682', '#CCB896', '#DCC8A4'], bois: [B[0], B[1], B[2]], toit: 'pignon', tuile: TERRE, chem: 12, vitrine: 'maison', face: [B[0], B[1], B[2], B[3]], bande: [B[0], B[2], B[3]], porte: ['#1E3A30', '#2F5D46', '#4E8F5A'], fleurs: true },
  { kind: 'brique', mur: ['#6A2C22', '#5A2820', '#8A4230', '#A0543C', '#B86A4A'], toit: 'long', tuile: TERRE, chem: 10, vitrine: 'pain', face: ['#20304A', '#2E4670', '#4A6A9C', '#8CB0D4'], bande: ['#20304A', '#2E4670', '#3E5E90'], porte: ['#20304A', '#2E4670', '#5A82B2'], store: ['#2E4670', '#E8D8B8'], attic: LUM[1] },
]

function facade(t: Facade) {
  const c = canvas(W, H)
  cheminee(c, t.chem, t.toit === 'pignon' ? 6 : 0)
  toit(c, t)
  mur(c, t, 30, 68)
  c.rect(0, 32, W, 2, '#1B1730|0.35')
  const [e, f] = [t.face, t.bande]
  // The shop front: pilasters, plinth, the band of the name.
  c.rect(0, 68, W, 50, e[1])
  for (let i = 3; i < W; i += 6) c.rect(i, 80, 1, 38, e[0])
  box(c, 0, 68, W, 12, f[1], f[2], f[0])
  c.rect(1, 69, W - 2, 1, LUM[1])
  c.rect(1, 78, W - 2, 1, f[0])
  c.rect(0, 80, W, 2, e[2])
  c.rect(0, 114, W, 4, e[0])
  c.rect(0, 114, W, 1, e[2])
  c.rect(0, 82, W, 1, e[0])
  // The wooden sign the tokens stand on.
  box(c, 2, 81, 16, 8, B[1], B[3], B[0])
  box(c, 2, 90, 16, 28, t.porte[1], t.porte[2], t.porte[0])
  box(c, 4, 92, 12, 12, t.porte[0], t.porte[0], t.porte[2])
  c.rect(5, 93, 10, 10, LUM[2])
  c.rect(5, 93, 10, 3, LUM[3])
  c.rect(9, 93, 2, 10, t.porte[0])
  box(c, 5, 106, 10, 10, t.porte[1], t.porte[0], t.porte[2])
  c.rect(14, 104, 2, 2, LUM[3])
  c.rect(1, 116, 18, 2, B[3])
  c.rect(1, 116, 18, 1, B[5])
  box(c, 19, 84, 28, 30, e[2], e[3], e[0])
  VITRINES[t.vitrine](c, 20, 86)
  c.rect(20, 86, 26, 1, '#FFFFFF|0.3')
  c.rect(19, 112, 28, 2, e[3])
  if (t.store) {
    for (let x = 17; x < 49; x += 4) {
      const col = (x - 17) % 8 ? t.store[0] : t.store[1]
      c.rect(x, 82, 4, 6, col)
      c.rect(x, 88, 3, 1, col)
    }
    c.rect(17, 82, 32, 1, '#FFFFFF|0.25')
    c.rect(19, 89, 28, 1, '#1B1730|0.4')
  }
  const signe = SIGNES[t.vitrine]
  if (signe.length) {
    c.rect(37, 41, 3, 1, B[1])
    c.rect(38, 41, 1, 3, B[1])
    box(c, 34, 44, 10, 12, t.bande[1], LUM[1], t.bande[0])
    c.sprite(signe, { C: CR, r: LUM[2], n: NUIT, v: '#6FAE5C' }, 35, 47)
  } else {
    c.rect(37, 42, 4, 1, B[0])
    c.rect(38, 43, 2, 2, NUIT)
    c.rect(37, 45, 4, 6, LUM[3])
    c.rect(37, 51, 4, 1, NUIT)
  }
  if (t.fleurs) {
    for (let x = 20; x < 46; x += 5) {
      c.rect(x, 111, 3, 1, '#4E8F5A')
      c.set(x + 1, 110, x % 2 ? '#D4537E' : '#FFC857')
    }
  }
  return c
}

// `REPOS` dims a house to these very colours, so the closed door matches the house it stands on.
const eteint = (col: string) => mix(mix(col, '#55506E', 0.4), '#181529', 0.62)
const REPOS = '<filter id="repos" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feColorMatrix values=".228 0 0 0 .109 0 .228 0 0 .099 0 0 .228 0 .165 0 0 0 1 0"/></filter>'

/** The pane of the door, dark, and the sign that says the house sleeps. */
function ferme() {
  const c = canvas(10, 10)
  c.rect(0, 0, 10, 10, eteint(VITRE[1]))
  c.rect(0, 0, 10, 3, eteint(VITRE[2]))
  box(c, 0, 3, 10, 6, '#C9BEDB', '#E0D8EC', '#6A6080')
  c.rect(1, 5, 8, 1, '#6A6080')
  c.rect(2, 2, 1, 1, '#6A6080')
  c.rect(7, 2, 1, 1, '#6A6080')
  return c
}

/** Inside a window: a lit wall, a shelf. */
function fenetreFond() {
  const c = canvas(26, 30)
  c.rect(4, 2, 18, 24, '#E8A848')
  c.rect(4, 2, 18, 8, '#F4BC58')
  c.rect(4, 2, 18, 2, '#FFD27A')
  for (let i = 0; i < 18; i += 3) c.rect(4 + i, 12, 1, 14, '#D89838')
  c.rect(16, 6, 6, 1, B[3])
  c.rect(17, 3, 2, 3, '#C75A4E')
  c.rect(19, 4, 2, 2, '#3F7CC8')
  return c
}
/** The frame, the curtains, the sill. `ecran`: the back of a computer on it. */
function fenetreDevant(ecran: boolean) {
  const c = canvas(26, 30)
  box(c, 2, 0, 22, 2, B[3], B[5], B[2])
  c.rect(2, 0, 2, 27, B[3])
  c.rect(2, 0, 1, 27, B[5])
  c.rect(22, 0, 2, 27, B[2])
  c.rect(23, 0, 1, 27, B[1])
  for (let x = 4; x < 22; x += 1) {
    c.rect(x, 2, 1, x % 3 ? 3 : 2, ROUGE[x % 3 === 1 ? 2 : 1])
    c.set(x, 2, ROUGE[3])
  }
  for (const x of [4, 20]) {
    c.rect(x, 5, 2, 20, ROUGE[1])
    c.rect(x + (x === 4 ? 1 : 0), 5, 1, 20, ROUGE[2])
  }
  if (ecran) {
    c.rect(9, 20, 10, 5, '#3B3550')
    c.rect(9, 20, 10, 1, '#5A5474')
    c.rect(13, 22, 2, 1, '#8CE0C0')
    disc(c, 14, 17, 6, 4, '#8CE0C0|0.14')
  }
  c.rect(0, 25, 26, 2, CR)
  c.rect(0, 26, 26, 1, '#B8A888')
  c.rect(2, 27, 22, 3, B[2])
  c.rect(2, 27, 22, 1, B[4])
  for (let x = 3; x < 23; x += 3) {
    c.rect(x, 23, 2, 2, '#4E8F5A')
    c.set(x + (x % 2), 22, x % 6 ? '#D4537E' : '#FFC857')
  }
  return c
}
function fenetreEteinte() {
  const c = canvas(26, 30)
  c.rect(4, 2, 18, 24, VITRE[1])
  c.rect(4, 2, 18, 9, VITRE[2])
  for (let i = 0; i < 9; i += 1) c.rect(8 + i, 12 - i, 3, 1, VITRE[3])
  for (let i = 0; i < 5; i += 1) c.rect(13 + i, 18 - i, 2, 1, VITRE[2])
  c.rect(12, 2, 2, 24, B[2])
  c.rect(4, 13, 18, 1, B[2])
  const f = fenetreDevant(false)
  for (let y = 0; y < 30; y += 1) {
    for (let x = 0; x < 26; x += 1) {
      const p = f.get(x, y)
      if (p) c.set(x, y, mix(p.slice(0, 7), '#1C2040', 0.45))
    }
  }
  return c
}
/** Shutters closed: the house sleeps. */
function volets() {
  const c = canvas(26, 30)
  box(c, 2, 0, 22, 27, '#2A2C44', '#3A3C58', '#1C1E30')
  for (const x of [3, 13]) {
    box(c, x, 1, 10, 25, '#3A4A4E', '#50646A', '#262E34')
    for (let y = 3; y < 24; y += 2) c.rect(x + 1, y, 8, 1, '#2C383C')
    c.rect(x + 1, 13, 8, 1, '#50646A')
  }
  c.set(12, 13, '#8A8FA3')
  c.rect(0, 25, 26, 2, '#5A566E')
  c.rect(0, 26, 26, 1, '#3A3650')
  return c
}

const GM = { w: 134, h: 164, lucarnes: [[12, 11], [54, 11], [96, 11]], bureau: [71, 63], porte: [90, 118] } as const

/** The large house of the one that leads: a parlour upstairs, the notice board under its porch. */
function grandeMaison() {
  const [w, h] = [GM.w, GM.h]
  const c = canvas(w, h)
  for (const x of [22, 104]) {
    box(c, x, 2, 11, 16, ROUGE[1], ROUGE[2], ROUGE[0])
    for (let j = 5; j < 16; j += 3) c.rect(x + 1, j, 9, 1, ROUGE[0])
    c.rect(x - 1, 2, 13, 2, CR)
    c.rect(x - 1, 3, 13, 1, '#B8A888')
    c.rect(x + 2, 0, 3, 2, B[2])
    c.rect(x + 6, 0, 3, 2, B[2])
  }
  tuiles(c, ARDOISE, 0, 8, w, 38, (x, y) => (y >= 14 ? x >= (46 - y) * 0.14 && x < w - (46 - y) * 0.14 : x >= 5 + (14 - y) * 2 && x < w - 5 - (14 - y) * 2))
  for (let x = 5; x < w - 5; x += 1) c.set(x, 13, ARDOISE[4])
  c.rect(14, 7, w - 28, 1, B[4])
  c.rect(16, 6, w - 32, 1, '#3A3650')
  for (const [x, y] of GM.lucarnes) {
    for (let i = 0; i < 7; i += 1) c.rect(x + 10 - i * 2, y - 7 + i, 6 + i * 4, 1, i === 0 ? CR : i === 6 ? '#B8A888' : ARDOISE[3])
    c.rect(x - 2, y - 1, 30, 2, CR)
    c.rect(x - 2, y, 30, 1, '#B8A888')
    c.rect(x - 2, y + 1, 30, 29, ARDOISE[1])
    c.rect(x - 2, y + 1, 2, 29, ARDOISE[0])
    c.rect(x + 26, y + 1, 2, 29, ARDOISE[0])
  }
  c.rect(0, 44, w, 4, CR)
  c.rect(0, 44, w, 1, '#FFF6DE')
  c.rect(0, 47, w, 1, '#8A7A68')
  for (let x = 2; x < w; x += 10) c.rect(x, 45, 5, 2, '#C8B48E')
  const M = ['#6A4438', '#7E5442', '#92664E', '#A87A5C', '#BC9270'] as const
  c.rect(0, 48, w, h - 48, M[2])
  for (let y = 60; y < 118; y += 6) c.rect(0, y, w, 1, M[1])
  for (let i = 0; i < 18; i += 1) c.set(Math.floor(noise(i, 21) * w), 60 + Math.floor(noise(i, 22) * 100), noise(i, 23) > 0.5 ? M[3] : M[1])
  box(c, 0, 48, w, 12, '#5E1E1E', '#8E2E2A', '#3A1414')
  c.rect(1, 49, w - 2, 1, LUM[2])
  c.rect(1, 58, w - 2, 1, LUM[1])
  // The parlour: a wide bay open on its wallpaper.
  box(c, 68, 60, 66, 52, B[2], B[4], B[0])
  c.rect(70, 62, 62, 46, '#594A7A')
  for (let y = 66; y < 88; y += 10) for (let x = 72 + (y % 20 ? 0 : 7); x < 132; x += 14) c.rect(x, y, 1, 4, '#7E6CA0')
  c.rect(70, 62, 62, 2, '#6E5C92')
  disc(c, 88, 76, 18, 14, '#FFC857|0.16')
  disc(c, 88, 76, 10, 8, '#FFC857|0.2')
  c.rect(66, 108, 68, 2, CR)
  c.rect(66, 109, 68, 1, '#B8A888')
  for (let x = 68; x < 134; x += 4) c.rect(x, 110, 1, 5, NUIT)
  c.rect(66, 114, 68, 1, NUIT)
  c.rect(66, 115, 68, 2, '#1B1730|0.35')
  c.rect(66, 117, 68, h - 117, '#5E4034')
  for (let y = 124; y < h - 6; y += 7) c.rect(66, y, 68, 1, '#4A3026')
  c.rect(0, h - 6, w, 6, '#3A2A2A')
  c.rect(0, h - 6, w, 1, '#6A5A52')
  // The door with its fanlight.
  const [px, py] = GM.porte
  box(c, px - 4, py, 22, 46, B[1], B[3], B[0])
  disc(c, px + 7, py + 8, 9, 7, (_x, y) => (y < py + 9 ? LUM[3] : null))
  c.rect(px + 6, py + 2, 2, 7, B[1])
  c.rect(px - 2, py + 9, 18, 1, B[1])
  box(c, px - 2, py + 10, 18, 36, ROUGE[1], ROUGE[2], ROUGE[0])
  c.rect(px + 6, py + 10, 2, 36, ROUGE[0])
  for (const dy of [13, 29]) {
    box(c, px, py + dy, 5, 13, ROUGE[0], ROUGE[0], ROUGE[2])
    box(c, px + 9, py + dy, 5, 13, ROUGE[0], ROUGE[0], ROUGE[2])
  }
  c.rect(px + 5, py + 27, 1, 2, LUM[3])
  c.rect(px + 8, py + 27, 1, 2, LUM[3])
  c.rect(px - 6, h - 3, 26, 3, B[3])
  c.rect(px - 6, h - 3, 26, 1, B[5])
  box(c, 70, 119, 18, 9, B[1], B[3], B[0])
  c.rect(76, 130, 5, 1, B[0])
  c.rect(77, 131, 3, 2, NUIT)
  c.rect(76, 133, 5, 7, LUM[3])
  c.rect(77, 134, 3, 5, LUM[4])
  c.rect(76, 140, 5, 1, NUIT)
  for (const [x, col] of [[72, '#3E7A4C'], [80, '#D4537E']] as const) {
    disc(c, x + 3, h - 15, 4.5, 6, '#4E8F5A')
    disc(c, x + 3, h - 17, 2, 2, col)
    box(c, x, h - 10, 7, 7, '#A03E26', '#DE7656', '#7A2E1C')
  }
  // The porch of the notice board.
  for (const x of [3, 63]) {
    c.rect(x, 62, 2, h - 62, B[1])
    c.rect(x, 62, 1, h - 62, B[3])
  }
  tuiles(c, TERRE, 0, 56, 68, 10, (x, y) => x >= (66 - y) * 0.9 - 1 && x < 68 - (66 - y) * 0.9 + 1)
  c.rect(0, 66, 68, 2, B[0])
  c.rect(0, 66, 68, 1, B[4])
  c.rect(3, 68, 62, 2, '#1B1730|0.4')
  return c
}

/** The letterbox, under its zinc roof. The red count lands on it. */
function boite() {
  const c = canvas(22, 38)
  c.rect(10, 22, 2, 16, '#2A2C34')
  c.rect(10, 22, 1, 16, '#5A5E74')
  c.rect(6, 36, 10, 2, '#2A2C34')
  c.rect(1, 2, 20, 1, ZINC[3])
  c.rect(0, 3, 22, 2, ZINC[4])
  box(c, 2, 5, 18, 18, '#2C5240', '#3E7A4C', '#1E3A30')
  c.rect(2, 22, 18, 1, '#16302A')
  c.rect(5, 9, 12, 2, NUIT)
  c.rect(4, 7, 14, 2, '#6FAE5C')
  c.rect(4, 7, 14, 1, '#8CC265')
  c.rect(7, 6, 8, 4, CR)
  c.rect(7, 6, 8, 1, '#FFFFFF')
  c.rect(10, 8, 2, 1, ROUGE[2])
  box(c, 7, 14, 8, 6, LUM[1], LUM[3], LUM[0])
  c.rect(8, 16, 6, 1, LUM[0])
  return c
}

/** The postman on his bicycle, bag full, heading left. */
function facteur() {
  const c = canvas(38, 30)
  c.rect(4, 27, 30, 2, SH)
  const roue = (x: number, y: number) => {
    disc(c, x, y, 6.5, 6.5, (_a, _b, d) => (d > 0.6 ? NUIT : null))
    disc(c, x, y, 1.2, 1.2, '#C8CCD8')
    for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0], [3, 3], [-3, -3], [3, -3], [-3, 3]] as const) c.set(x + dx, y + dy, '#8A8FA3')
  }
  roue(8, 21)
  roue(30, 21)
  trait(c, 8, 21, 13, 11, '#C4553A')
  trait(c, 13, 11, 24, 14, '#C4553A')
  trait(c, 12, 12, 19, 21, '#C4553A')
  trait(c, 24, 14, 19, 21, '#C4553A')
  trait(c, 24, 14, 30, 21, '#C4553A')
  c.rect(10, 9, 5, 1, '#C8CCD8')
  c.rect(12, 9, 2, 2, '#8A8FA3')
  c.rect(3, 8, 9, 1, CR)
  c.rect(4, 6, 6, 2, CR)
  c.rect(5, 5, 3, 1, '#FFFFFF')
  box(c, 2, 9, 10, 5, B[4], B[5], B[2])
  box(c, 26, 12, 9, 7, B[3], B[5], B[1])
  c.rect(26, 14, 9, 1, B[1])
  c.rect(30, 14, 1, 2, LUM[2])
  trait(c, 23, 13, 20, 18, '#20304A')
  trait(c, 22, 13, 19, 18, '#2E4670')
  trait(c, 20, 18, 18, 21, '#2E4670')
  c.rect(17, 21, 4, 2, NUIT)
  c.rect(19, 5, 7, 9, '#2E4670')
  c.rect(24, 5, 2, 9, '#20304A')
  c.rect(19, 5, 1, 9, '#3E5E90')
  trait(c, 19, 7, 13, 9, '#2E4670')
  trait(c, 19, 8, 13, 10, '#20304A')
  c.rect(12, 9, 2, 1, '#E8B48A')
  c.rect(19, 9, 6, 1, '#D8AA48')
  c.rect(17, 0, 6, 5, '#E8B48A')
  c.rect(17, 3, 1, 1, NUIT)
  c.rect(21, 3, 2, 2, '#5A3A22')
  c.rect(17, 0, 7, 2, '#20304A')
  c.rect(15, 1, 3, 1, NUIT)
  c.rect(18, 0, 5, 1, '#3E5E90')
  return c
}

function reverbere() {
  const c = canvas(34, 56)
  disc(c, 17, 9, 9, 9, '#FFC857|0.1')
  c.rect(16, 16, 2, 36, '#2A2C34')
  c.rect(16, 16, 1, 36, '#5A5E74')
  c.rect(14, 50, 6, 4, '#2A2C34')
  c.rect(14, 50, 1, 4, '#5A5E74')
  c.rect(13, 54, 8, 2, '#1E2028')
  c.rect(14, 32, 6, 1, '#5A5E74')
  c.rect(13, 3, 8, 1, '#2A2C34')
  c.rect(14, 2, 6, 1, '#5A5E74')
  c.rect(16, 0, 2, 2, '#2A2C34')
  for (let i = 0; i < 10; i += 1) c.rect(13 + Math.floor(i / 4), 4 + i, 8 - Math.floor(i / 2), 1, i < 5 ? LUM[4] : LUM[3])
  c.rect(14, 14, 6, 2, '#2A2C34')
  c.rect(16, 5, 1, 8, '#2A2C34')
  return c
}

function arbre() {
  const c = canvas(64, 92)
  disc(c, 32, 88, 18, 3, SH)
  c.rect(29, 52, 7, 38, B[1])
  c.rect(29, 52, 2, 38, B[3])
  c.rect(34, 52, 2, 38, B[0])
  trait(c, 31, 62, 18, 46, B[1])
  trait(c, 32, 62, 19, 46, B[1])
  trait(c, 34, 60, 46, 44, B[1])
  trait(c, 35, 60, 47, 44, B[1])
  c.rect(26, 88, 13, 2, B[1])
  const O = ['#6E2A1A', '#A03E26', '#C4553A', '#D88038', '#E8A83C', '#F0CC70'] as const
  const touffe = (cx: number, cy: number, rx: number, ry: number) => disc(c, cx, cy, rx, ry, (x, y, d) => {
    const n = noise(Math.floor(x / 4), Math.floor(y / 3) + 4)
    if (d > 0.8 && n > 0.6) return null
    const l = ((cx - x) / rx) * 0.5 + ((cy - y) / ry) * 0.7 + n * 0.5
    return O[Math.max(1, Math.min(4, Math.floor(l * 2.2 + 1.8)))]!
  })
  for (const [x, y, rx, ry] of [[14, 40, 13, 12], [50, 38, 13, 13], [32, 44, 16, 11], [20, 22, 15, 14], [44, 20, 15, 13], [32, 13, 15, 12]] as const) touffe(x, y, rx, ry)
  for (let i = 0; i < 40; i += 1) {
    const [x, y] = [6 + Math.floor(noise(i, 5) * 52), 3 + Math.floor(noise(i, 6) * 48)]
    if (c.get(x, y)) c.rect(x, y, 2, 1, noise(i, 7) > 0.5 ? O[5] : O[4])
  }
  for (let i = 0; i < 12; i += 1) c.rect(12 + Math.floor(noise(i, 8) * 40), 86 + Math.floor(noise(i, 9) * 5), 2, 1, O[(i % 3) + 2]!)
  return c
}

function fumee() {
  const c = canvas(16, 32)
  for (const [x, y, r, a] of [[6, 28, 3, 0.34], [8, 22, 3.5, 0.28], [6, 15, 4, 0.2], [9, 8, 4.5, 0.13]] as const) disc(c, x, y, r, r, `#D8D0E4|${a}`)
  return c
}

function lumiereSol() {
  const c = canvas(78, 10)
  for (const [x0, w] of [[1, 18], [20, 28], [48, 28]] as const) for (let y = 0; y < 10; y += 1) c.rect(x0 - y, y, w + y * 2, 1, `#FFC857|${y < 4 ? 0.14 : 0.08}`)
  return c
}

const BITUME = '#2B2638'
const route = (x: number, y: number) => (y >= 182 && y < 208) || y >= 348 || (x >= 166 && x < 190 && y >= 208 && y < 348)

/** The autumn sky, the hill, the street and its pavements: once in a drawing. */
function fond() {
  const [w, h] = [390, 380]
  const c = canvas(w, h)
  const CIEL = ['#1E1A40', '#262048', '#302654', '#402C60', '#54326A', '#6E3A6E', '#8C456E', '#AE586A', '#CE7460'] as const
  CIEL.forEach((col, i) => c.rect(0, i * 7, w, 7, col))
  c.rect(0, 63, w, 40, CIEL[8])
  for (let i = 0; i < 22; i += 1) {
    const [x, y] = [Math.floor(noise(i, 41) * w), Math.floor(noise(i, 42) * 40)]
    c.set(x, y, noise(i, 43) > 0.7 ? '#FFF6DE' : '#B8B0D8')
    if (i % 9 === 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x + dx, y + dy, '#8880B0')
  }
  disc(c, 112, 20, 9, 9, '#FFF0C8')
  disc(c, 116, 18, 8, 8, (_x, y) => CIEL[Math.floor(y / 7)]!)
  // The hill and its steeple, far away.
  for (let x = 0; x < w; x += 1) {
    c.rect(x, Math.round(46 - 7 * Math.sin(x * 0.012 + 0.6) - 3 * Math.sin(x * 0.041)), 1, 110, '#3E2C5C')
    c.rect(x, Math.round(56 - 4 * Math.sin(x * 0.02 + 3) - 2 * Math.sin(x * 0.07)), 1, 110, '#2E2448')
  }
  for (let i = 0; i < 9; i += 1) {
    const [x, y] = [Math.floor(noise(i, 51) * w), 47 + Math.floor(noise(i, 52) * 12)]
    c.rect(x, y, 4, 4, '#2E2448')
    c.set(x + 1, y + 1, '#FFC857')
  }
  c.rect(36, 34, 6, 22, '#2A2040')
  for (let i = 0; i < 12; i += 1) c.rect(39 - Math.floor(i / 4), 22 + i, 1 + Math.floor(i / 2), 1, '#2A2040')
  c.rect(39, 18, 1, 5, '#2A2040')
  c.rect(38, 19, 3, 1, '#2A2040')
  c.set(39, 40, '#FFC857')
  // The upper pavement.
  c.rect(0, 150, w, 32, '#201B30')
  c.rect(0, 170, w, 11, '#3B3348')
  c.rect(0, 170, w, 2, '#2A2438')
  for (let x = 12; x < w; x += 52) c.rect(x, 172, 1, 9, '#332C40')
  // The bank, its fence and its ivy.
  c.rect(0, 208, w, 172, '#1F1A2C')
  c.rect(0, 210, w, 14, '#3E2C2C')
  c.rect(0, 209, w, 1, '#6A5040')
  c.rect(0, 216, w, 1, '#2A1E22')
  for (let x = 6; x < w; x += 12) c.rect(x, 210, 1, 14, '#241A20')
  for (let i = 0; i < 11; i += 1) {
    const x = 10 + i * 36 + Math.floor(noise(i, 62) * 18)
    disc(c, x, 214 + noise(i, 63) * 5, 5, 7, i % 3 ? '#2F5D46' : '#3E7A4C')
    disc(c, x - 1, 212 + noise(i, 63) * 5, 2.5, 3, '#3E7A4C')
  }
  // The small garden at the crossing.
  c.rect(164, 224, 64, 112, '#1E2A26')
  for (let i = 0; i < 16; i += 1) c.rect(192 + Math.floor(noise(i, 71) * 32), 226 + Math.floor(noise(i, 72) * 106), 3, 1, noise(i, 73) > 0.6 ? '#2A3A30' : noise(i, 74) > 0.5 ? '#C4553A' : '#8C5A2C')
  // The lower pavement.
  c.rect(0, 336, w, 12, '#3B3348')
  c.rect(0, 336, w, 2, '#2A2438')
  for (let x = 12; x < w; x += 52) c.rect(x, 338, 1, 10, '#332C40')
  // The roadway, its kerbs, its leaves.
  for (let y = 182; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (route(x, y)) c.set(x, y, BITUME)
      else if (route(x, y + 1) || route(x, y - 1) || route(x - 1, y) || route(x + 1, y)) c.set(x, y, '#6A5E70')
    }
  }
  for (let i = 0; i < 30; i += 1) {
    const [x, y] = [Math.floor(noise(i, 81) * w), 182 + Math.floor(noise(i, 82) * 198)]
    if (route(x, y)) c.rect(x, y, 2 + Math.floor(noise(i, 83) * 4), 1, noise(i, 84) > 0.5 ? '#332D42' : '#252032')
  }
  for (let i = 0; i < 28; i += 1) {
    const [x, y] = [Math.floor(noise(i, 91) * w), 172 + Math.floor(noise(i, 92) * 208)]
    if (!route(x, y) && !(y > 172 && y < 181) && !(y > 338 && y < 348)) continue
    const col = ['#C4553A', '#D88038', '#E8A83C', '#A03E26'][i % 4]!
    c.set(x, y, col)
    c.set(x + 1, y, col)
  }
  return c
}

const banc = (c: C, x: number, y: number) => {
  c.rect(x, y + 11, 24, 2, SH)
  for (let i = 0; i < 3; i += 1) c.rect(x + 1, y + i * 3, 22, 2, i % 2 ? B[3] : B[4])
  c.rect(x + 1, y, 22, 1, B[5])
  c.rect(x, y + 7, 24, 2, B[4])
  c.rect(x, y + 7, 24, 1, B[5])
  for (const px of [2, 20]) c.rect(x + px, y, 2, 13, B[1])
}

type Jardin = 'Verger' | 'Potager' | 'Tonnelle'

/** A free plot: never lit, so that nothing takes it for a conversation. */
function jardin(kind: Jardin) {
  const c = canvas(78, 118)
  c.rect(0, 26, 78, 92, '#1E2A26')
  c.rect(0, 22, 78, 6, '#22362C')
  for (let x = 0; x < 80; x += 13) {
    c.rect(x + 1, 18, 11, 4, '#2A4032')
    c.rect(x + 3, 17, 7, 1, '#34503E')
    c.rect(x + 3, 19, 4, 1, '#34503E')
  }
  for (let i = 0; i < 6; i += 1) c.rect(Math.floor(noise(i, 101) * 74), 34 + Math.floor(noise(i, 102) * 68), 3, 1, noise(i, 103) > 0.7 ? '#C4553A' : noise(i, 103) > 0.45 ? '#8C5A2C' : '#2C3E32')
  if (kind === 'Potager') {
    box(c, 6, 40, 30, 28, B[2], B[3], B[0])
    for (let x = 9; x < 36; x += 4) c.rect(x, 41, 1, 26, B[1])
    for (let i = 0; i < 8; i += 1) c.rect(2 + i * 2, 38 - i, 38 - i * 4, 1, i ? ZINC[2] : ZINC[4])
    box(c, 11, 50, 9, 18, B[1], B[2], B[0])
    c.set(18, 59, LUM[1])
    box(c, 24, 47, 9, 8, VITRE[1], B[4], B[1])
    c.rect(28, 47, 1, 8, B[1])
    c.rect(2, 68, 40, 2, SH)
    for (const [y, a] of [[72, 0], [83, 1], [94, 0]] as const) {
      c.rect(5, y, 68, 7, '#3A2A22')
      c.rect(5, y, 68, 1, '#4E3A2C')
      for (let x = 9; x < 70; x += 10) {
        const orange = (x + a * 10) % 20 === 9
        c.rect(x - 3, y, 7, 4, orange ? '#D88038' : '#3E7A4C')
        c.rect(x - 2, y - 1, 5, 6, orange ? '#D88038' : '#3E7A4C')
        if (orange) {
          c.rect(x - 1, y - 2, 2, 1, '#3E7A4C')
          c.rect(x - 2, y, 2, 1, '#E8A83C')
        } else c.rect(x - 1, y + 1, 2, 1, '#6FAE5C')
      }
    }
    c.rect(52, 58, 8, 9, '#8A8FA3')
    c.rect(52, 58, 2, 9, '#C8CCD8')
    c.rect(60, 60, 4, 1, '#8A8FA3')
    c.rect(54, 55, 4, 1, '#5A5E74')
    c.rect(53, 56, 1, 2, '#5A5E74')
    c.rect(57, 56, 1, 2, '#5A5E74')
  }
  if (kind === 'Tonnelle') {
    c.rect(4, 92, 22, 8, '#26382E')
    c.rect(52, 92, 22, 8, '#26382E')
    for (const [x, col] of [[8, '#D4537E'], [14, '#FFC857'], [20, '#D4537E'], [58, '#F0A080'], [64, '#E8E0F0'], [70, '#F0A080']] as const) c.rect(x, 94, 2, 2, col)
    for (const x of [20, 56]) {
      c.rect(x, 40, 3, 62, B[2])
      c.rect(x, 40, 1, 62, B[4])
    }
    for (let i = 0; i < 19; i += 1) c.rect(20 + i * 2, 40 - Math.round(10 * Math.sin((i / 18) * Math.PI)), 3, 3, B[3])
    for (let i = 0; i < 22; i += 1) {
      const u = noise(i, 111)
      const [x, y] = u < 0.5 ? [18 + noise(i, 112) * 42, 28 + noise(i, 113) * 12] : [noise(i, 114) > 0.5 ? 18 + noise(i, 112) * 6 : 54 + noise(i, 112) * 6, 42 + noise(i, 113) * 54]
      c.rect(Math.floor(x), Math.floor(y), 3, 2, '#2F5D46')
      if (i % 3 === 0) c.set(Math.floor(x) + 1, Math.floor(y), i % 2 ? '#D4537E' : '#F0A080')
    }
    banc(c, 27, 84)
  }
  if (kind === 'Verger') {
    banc(c, 50, 88)
    for (const [x, y] of [[20, 92], [26, 95], [12, 96], [34, 90]] as const) {
      c.rect(x, y, 2, 2, ROUGE[2])
      c.set(x, y, ROUGE[3])
    }
  }
  c.rect(0, 108, 78, 2, B[2])
  c.rect(0, 113, 78, 2, B[2])
  for (let x = 1; x < 78; x += 8) {
    c.rect(x, 104, 4, 14, B[4])
    c.rect(x, 104, 1, 14, B[5])
  }
  return c
}

// Every sprite, drawn once: an id says all a definition depends on.
const SPRITES: Record<string, Art> = {
  rue: once(fond),
  grande: once(grandeMaison),
  fa0: once(() => facade(FACADES[0]!)),
  fa1: once(() => facade(FACADES[1]!)),
  fa2: once(() => facade(FACADES[2]!)),
  fa3: once(() => facade(FACADES[3]!)),
  fa4: once(() => facade(FACADES[4]!)),
  fer: once(ferme),
  ff: once(fenetreFond),
  fd: once(() => fenetreDevant(true)),
  fc: once(() => fenetreDevant(false)),
  fe: once(fenetreEteinte),
  fv: once(volets),
  bx: once(boite),
  fac: once(facteur),
  rv: once(reverbere),
  ar: once(arbre),
  fu: once(fumee),
  ls: once(lumiereSol),
  chs: once(chair),
  bt: once(() => desk('working')),
  br: once(() => desk('rest')),
  jV: once(() => jardin('Verger')),
  jP: once(() => jardin('Potager')),
  jT: once(() => jardin('Tonnelle')),
  cc: once(() => caseEtape('completed')),
  ci: once(() => caseEtape('in_progress')),
  cp: once(() => caseEtape('pending')),
  plante: () => cosy.floor.items.monstera!(),
  bn: once(() => {
    const c = canvas(24, 13)
    banc(c, 0, 0)
    return c
  }),
}
const made = new Map<string, string>()
const defOf = (id: string) => {
  const known = made.get(id)
  if (known) return known
  const body = def(id, SPRITES[id]!())
  made.set(id, body)
  return body
}

const LOT = { w: 156, h: 260 }
const CHIEF = { x: 332, y: 12, w: 268, h: 352 }
type Lot = { x: number; y: number; garden: Jardin; tree?: boolean }
const lot = (x: number, y: number, garden: Jardin, tree = false): Lot => ({ x, y, garden, tree })

// A set order nobody can read as a rank: a conversation keeps its plot when another one arrives.
const STREET: readonly Lot[] = [lot(168, 436, 'Verger', true), lot(612, 104, 'Tonnelle'), lot(4, 104, 'Potager'), lot(460, 436, 'Potager'), lot(168, 104, 'Verger', true), lot(624, 436, 'Verger', true), lot(4, 436, 'Tonnelle')]
// Past eight, a third row: the scene steps back to 3/4 and shows 14 plots.
const LOW = 752
const QUARTER: readonly Lot[] = [lot(168, 436, 'Verger', true), lot(788, LOW, 'Tonnelle'), lot(612, 104, 'Tonnelle'), lot(4, LOW, 'Potager'), lot(624, 436, 'Verger', true), lot(4, 104, 'Potager'), lot(460, LOW, 'Tonnelle'), lot(776, 104, 'Verger', true), lot(4, 436, 'Tonnelle'), lot(788, 436, 'Potager'), lot(168, 104, 'Verger', true), lot(460, 436, 'Potager'), lot(168, LOW, 'Tonnelle'), lot(624, LOW, 'Verger', true)]

type Scene = { k: number; dx: number; dy: number; lots: readonly Lot[]; lamps: readonly (readonly [number, number])[]; trees: readonly (readonly [number, number])[]; wrap: (s: string) => string }
const plainScene: Scene = {
  k: 1,
  dx: 0,
  dy: 0,
  lots: STREET,
  lamps: [[128, 228], [292, 228], [572, 228], [128, 560], [294, 560], [584, 560]],
  trees: [[344, 512]],
  wrap: s => s,
}
const wideScene: Scene = {
  k: 0.75,
  dx: 48,
  dy: -12,
  lots: QUARTER,
  lamps: [[128, 228], [292, 228], [572, 228], [736, 228], [128, 560], [294, 560], [586, 560], [750, 560], [128, LOW + 124], [294, LOW + 124], [586, LOW + 124], [750, LOW + 124]],
  trees: [[344, 512], [344, LOW + 76]],
  wrap: s => `<g transform="scale(.75) translate(48 -12)">${s}</g>`,
}
const sceneOf = (n: number) => (n > 8 ? wideScene : plainScene)
const placed = (s: Scene, x: number, y: number, w: number, h: number) => ({ x: (x + s.dx) * s.k, y: (y + s.dy) * s.k, w: w * s.k, h: h * s.k })
// The root draws crisp edges; letters at these sizes need the opposite.
const inked = (s: string) => `<g shape-rendering="geometricPrecision">${s}</g>`

const WINDOWS = [[16, 68], [88, 68], [96, 168]] as const
const STATE = { busy: '#FFC857', asleep: '#A89FBC' }

/** The people of a house at most fit its windows; those left over are a count, never forgotten. */
const moreOf = (n: number) => (n > 3 ? `+${n - 3}` : '')

function house(room: MapRoom, b: Lot, v: MapView, need: (id: string) => void) {
  const pick5 = pick(room.seed, 2, v.detail >= 5 ? 3 : FACADES.length)
  const f = FACADES[pick5]!
  need(`fa${pick5}`)
  const parts: string[] = []
  const at = (id: string, x: number, y: number) => {
    need(id)
    parts.push(use(id, b.x + x, b.y + y))
  }
  if (room.rest) {
    parts.push(`<use href="#fa${pick5}" x="${b.x}" y="${b.y}" filter="url(#repos)"/>`)
    at('fer', 10, 186)
    for (const [x, y] of WINDOWS) at('fv', x, y)
  } else {
    if (v.detail < 2) at('fu', f.chem * 2 - 6, -60)
    at(`fa${pick5}`, 0, 0)
    if (v.detail < 2) at('ls', 0, 236)
    WINDOWS.forEach(([x, y], i) => {
      const who = room.people[i]
      if (!who) return at('fe', x, y)
      const tenue = who.hue % TENUES.length
      at('ff', x, y)
      at(`p${tenue}`, x + 10, y + 6)
      at('fd', x, y)
    })
  }
  const more = room.rest ? '' : moreOf(room.people.length)
  const title = fit(room.title, 16, 146)
  const meta = fit(room.meta, 14, more ? 124 : 148)
  const text = line(title, Math.round(b.x + 78 - textWidth(title, 16) / 2), b.y + 138, 16, room.rest ? '#C9BEDB' : CR) + line(meta, b.x + 6, b.y + 239, 14, room.rest ? STATE.asleep : STATE.busy) + (more ? line(more, b.x + 150 - textWidth(more, 14), b.y + 239, 14, CR) : '')
  return { svg: parts.join('') + inked(text), words: title + meta + more }
}

const BOARD_X = 2
const BOARD_Y = 138
const BOARD_W = 128

function noticeBoard(v: MapView, need: (id: string) => void) {
  const rows = v.list.length
  const pitch = Math.min(18, (190 - 39) / Math.max(rows, 1))
  const h = Math.round(39 + pitch * rows)
  const size = pitch >= 18 ? 15 : 13
  const title = t('room.conversations')
  const texts = v.list.map(l => fit(l.text, size, 84))
  const boxes: string[] = []
  const lines = v.list.map((l, i) => {
    const y = Math.round(BOARD_Y + 31 + i * pitch)
    const id = { completed: 'cc', in_progress: 'ci', pending: 'cp' }[l.status]
    need(id)
    if (l.status === 'in_progress') boxes.push(`<rect x="${BOARD_X + 12}" y="${y - 1}" width="${Math.ceil(textWidth(texts[i]!, size)) + 26}" height="${Math.floor(pitch)}" fill="${cosy.board.glow}"/>`)
    boxes.push(use(id, BOARD_X + 16, y + Math.floor(pitch / 2) - 6))
    return line(texts[i]!, BOARD_X + 34, y, size, cosy.board.inks[l.status])
  })
  return { svg: `<g transform="translate(${BOARD_X} ${BOARD_Y})">${cosy.board.art(BOARD_W, h)}</g>${boxes.join('')}${inked(line(title, BOARD_X + 14, BOARD_Y + 10, 18, cosy.board.title) + lines.join(''))}`, words: title + texts.join(''), h }
}

function chiefHouse(room: MapRoom, v: MapView, need: (id: string) => void) {
  const parts: string[] = []
  const at = (id: string, x: number, y: number) => {
    need(id)
    parts.push(use(id, x, y))
  }
  if (v.detail < 2) at('fu', 48, -48)
  at('grande', 0, 0)
  const managed = room.people[0]?.hue === 0
  const team = managed ? room.people.slice(1) : room.people
  GM.lucarnes.forEach(([x, y], i) => {
    const who = team[i]
    at('ff', x * 2, y * 2)
    if (who) at(`p${who.hue % TENUES.length}`, x * 2 + 10, y * 2 + 6)
    at('fc', x * 2, y * 2)
  })
  const [dx, dy] = [GM.bureau[0] * 2, GM.bureau[1] * 2]
  at('chs', dx, dy)
  at('p0', dx + 44, dy - 4)
  at(managed ? 'bt' : 'br', dx, dy)
  if (!managed) parts.push(`<path transform="translate(${dx} ${dy})" fill="${CR}" d="${ZZ}"/>`)
  const board = noticeBoard(v, need)
  // A short board leaves its wall bare: the plant of the parlour stands there.
  if (board.h < 100 && v.detail < 4) at('plante', 30, 204)
  else if (board.h < 160 && v.detail < 4) at('bn', 42, 290)
  parts.push(board.svg)
  at('bx', 222, 252)
  const manager = t('role.manager')
  const plate = `<rect x="152" y="186" width="100" height="19" fill="#3B2318"/><rect x="154" y="188" width="96" height="15" fill="${CR}"/>`
  const title = fit(room.title, 18, 252)
  const more = moreOf(team.length)
  const meta = fit(room.meta, 14, 256)
  const text = line(manager, Math.round(202 - textWidth(manager, 16) / 2), 186, 16, NUIT) + line(title, Math.round(134 - textWidth(title, 18) / 2), 97, 18, CR) + line(meta, 6, 331, 14, STATE.busy) + (more ? line(more, 240 - textWidth(more, 14), 70, 14, CR) : '')
  return { svg: `<g transform="translate(${CHIEF.x} ${CHIEF.y})">${parts.join('')}${plate}${inked(text)}</g>`, words: board.words + manager + title + meta + more }
}

/** The postman brings a letter from a house to the letterbox, then rides on. */
function flight(v: MapView, sender: Lot | undefined, need: (id: string) => void) {
  need('fac')
  const seconds = v.flightS
  const fromRow = sender && sender.y < 300
  const ride = fromRow ? Math.min(sender!.x + 40, 480) : 320
  const [ly, keys] = [fromRow ? 322 : 420, '0;.15;.6;.75;1']
  const rider = `<animateTransform attributeName="transform" type="translate" values="${ride} 356;${ride} 356;576 356;576 356;666 356" keyTimes="${keys}" dur="${seconds}s" fill="freeze"/>`
  const letter = `<animateTransform attributeName="transform" type="translate" values="${ride + 10} ${ly};${ride - 20} 346;556 346;562 266;562 266" keyTimes="${keys}" dur="${seconds}s" fill="freeze"/><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.74;.78;1" dur="${seconds}s" fill="freeze"/>`
  return `<g class="ev"><g>${rider}<g transform="translate(76) scale(-1 1)">${use('fac')}</g></g><g>${letter}${use('env')}</g></g>`
}

/** The background once more, cut in pieces around the first: past the edges, then for the third row. */
function wideBack() {
  const piece = (id: string, x: number, y: number, w: number, h: number, dx: number, dy: number) => ({
    clip: `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`,
    body: `<g clip-path="url(#${id})">${use('rue', dx, dy)}</g>`,
  })
  const parts = [[0, 780, 0], [780, 216, 380], [-48, 48, -448]].flatMap(([x, w, dx], i) => [piece(`q${i}`, x!, 0, w!, 732, dx!, 0), piece(`r${i}`, x!, 732, w!, 300, dx!, 316)])
  return { defs: parts.map(p => p.clip).join(''), body: parts.map(p => p.body).join('') }
}

export const cosyMap: MapPack = {
  back: '#1E1A40',
  places(n) {
    const s = sceneOf(n)
    return [placed(s, CHIEF.x, CHIEF.y, CHIEF.w, CHIEF.h), ...s.lots.slice(0, n - 1).map(b => placed(s, b.x, b.y, LOT.w, LOT.h))]
  },
  counts(n) {
    const s = sceneOf(n)
    const size = s.k === 1 ? 12 : 10
    const at = (x: number, y: number) => ({ x: (x + s.dx) * s.k, y: (y + s.dy) * s.k, size, ink: CR })
    return [at(CHIEF.x + 158, CHIEF.y + 240), ...s.lots.slice(0, n - 1).map(b => at(b.x + 20, b.y + 164))]
  },
  walk(n) {
    const s = sceneOf(n)
    const [low, end] = n > 8 ? [714, 950] : [728, 740]
    return ([[40, 392], [356, 392], [356, low], [end, low], [60, low], [356, low], [356, 392], [end, 392]] as const).map(([x, y]) => ({ x: (x + s.dx) * s.k, y: (y + s.dy) * s.k }))
  },
  draw(v) {
    const n = v.rooms.length
    const s = sceneOf(n)
    const used = new Set<string>(['rue', 'grande', ...(v.detail < 3 ? ['rv'] : []), ...(v.detail < 6 ? ['ar'] : [])])
    const need = (id: string) => void used.add(id)
    const lots = s.lots.slice(0, n - 1)
    const chief = chiefHouse(v.rooms[0]!, v, need)
    const houses = v.rooms.slice(1).map((r, i) => house(r, lots[i]!, v, need))
    // A full world gives up its gardens first: every plot an orchard, the lightest, then a bare plot of grass.
    const free = s.lots.slice(n - 1).map(b => {
      if (v.detail >= 4) return `<rect x="${b.x}" y="${b.y + 52}" width="156" height="184" fill="#1E2A26"/>`
      const id = `j${v.detail ? 'V' : b.garden[0]}`
      need(id)
      return use(id, b.x, b.y) + (b.tree || v.detail ? use('ar', b.x + 6, b.y + 24) : '')
    })
    const wide = s.k < 1 ? wideBack() : null
    const count = String(v.news.shown)
    const countW = Math.ceil(textWidth(count, 16)) + 14
    const badge = v.news.shown ? compteur(CHIEF.x + 242 - countW / 2, CHIEF.y + 252, countW) + line(count, CHIEF.x + 249 - countW / 2, CHIEF.y + 252, 16, '#FFF6DE') : ''
    if (!v.news.flying) need('fac')
    const front = (v.detail < 3 ? s.lamps.map(([x, y]) => use('rv', x, y)).join('') : '') + (v.detail < 6 ? s.trees.map(([x, y]) => use('ar', x, y)).join('') : '') + (v.news.flying ? flight(v, lots[0], need) : use('fac', 540, 356)) + badge
    const tenues = [...used].filter(id => /^p\d$/.test(id))
    const people = tenues.map(id => def(id, person(TENUES[Number(id.slice(1))]!)))
    const defs = [...used].filter(id => !/^p\d$/.test(id)).map(defOf).join('') + people.join('') + (v.news.flying ? `<g id="env">${enveloppe()}</g>` : '') + (v.rooms.some(r => r.rest) ? REPOS : '') + (wide?.defs ?? '')
    return {
      defs,
      back: s.wrap((wide?.body ?? use('rue')) + free.join('')),
      rooms: [s.wrap(chief.svg), ...houses.map(h => s.wrap(h.svg))],
      front: s.wrap(front),
      words: chief.words + houses.map(h => h.words).join('') + (v.news.shown ? count : ''),
    }
  },
}
