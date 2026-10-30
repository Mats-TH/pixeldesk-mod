import { canvas, noise } from './canvas'
import type { Canvas } from './canvas'
import { WOOD as W } from './sprites'

const INK = '#2A2036'
const CR = '#F4E4C1'
const GOLD = '#FFC857'
const G = ['#2F5D46', '#3E7A4C', '#4E8F5A', '#6FAE5C', '#8CC265'] as const
const SH = '#1B1730|0.28'

export type Theme = { base: string; st: string; dot: string; pan: string; panL: string; panD: string; pan2: string; pan3: string; rug: [string, string, string] }

export const THEMES: Record<'mauve' | 'vert' | 'terre' | 'bleu' | 'ocre' | 'rose' | 'sarcelle' | 'ardoise', Theme> = {
  mauve: { base: '#5B4A7A', st: '#634F86', dot: '#7263A0', pan: '#46385F', panL: '#6E5A9E', panD: '#3F3257', pan2: '#2F2542', pan3: '#5A4A7A', rug: ['#3F4F7E', '#4A5C90', '#C75A4E'] },
  vert: { base: '#3F6B5E', st: '#467566', dot: '#5A8F7C', pan: '#2F5048', panL: '#4F8070', panD: '#29453E', pan2: '#1F3731', pan3: '#3F6B5E', rug: ['#8A4A3A', '#9C5A46', '#E0A030'] },
  terre: { base: '#9A5A48', st: '#A36350', dot: '#BC7C66', pan: '#6E3D32', panL: '#B0705C', panD: '#60342B', pan2: '#4C2822', pan3: '#8A4F42', rug: ['#2A6B60', '#34806F', '#F4E4C1'] },
  bleu: { base: '#4A6A9C', st: '#42608F', dot: '#6080B4', pan: '#2F4468', panL: '#5A78AA', panD: '#273A5A', pan2: '#1E2A45', pan3: '#40598A', rug: ['#8A4A3A', '#9C5A46', '#E0A030'] },
  ocre: { base: '#A88A46', st: '#9C7F3E', dot: '#C0A25C', pan: '#705A2A', panL: '#B4965A', panD: '#5E4B24', pan2: '#4A3A1C', pan3: '#8C7236', rug: ['#3F4F7E', '#4A5C90', '#C75A4E'] },
  rose: { base: '#A85C78', st: '#9C526E', dot: '#C0748F', pan: '#6E3650', panL: '#B36A86', panD: '#5E2E44', pan2: '#4F2436', pan3: '#8C4A64', rug: ['#2A6B60', '#34806F', '#F4E4C1'] },
  sarcelle: { base: '#3F7A84', st: '#387078', dot: '#54949E', pan: '#26525A', panL: '#4A8791', panD: '#1F454D', pan2: '#1A3A42', pan3: '#34707A', rug: ['#5A3F7A', '#6A4F8E', '#FFC857'] },
  ardoise: { base: '#5F6878', st: '#565F6E', dot: '#767F90', pan: '#3F4552', panL: '#6C7586', panD: '#363B47', pan2: '#2A2E38', pan3: '#545D6D', rug: ['#3F4F7E', '#4A5C90', '#C75A4E'] },
}

const pot = (c: Canvas, x: number, y: number, w: number, h: number) => {
  c.rect(x, y, w, h, '#B8452A')
  c.rect(x, y, w, 1, '#D96A48')
  c.rect(x, y, 1, h, '#D96A48')
  c.rect(x + w - 1, y, 1, h, '#8E3320')
  c.rect(x + 1, y + h, w - 2, 1, '#8E3320')
}

function fenetre() {
  const c = canvas(58, 48)
  c.rect(4, 2, 50, 40, W[1])
  c.rect(5, 3, 48, 38, W[3])
  c.rect(5, 3, 48, 1, W[4])
  c.rect(7, 5, 44, 34, '#1E1A42')
  c.rect(7, 14, 44, 10, '#2A2550')
  c.rect(7, 22, 44, 8, '#3A2F6B')
  for (let i = 0; i < 26; i += 1) c.set(7 + Math.floor(noise(i, 1) * 44), 5 + Math.floor(noise(i, 2) * 18), i % 4 ? CR : GOLD)
  c.rect(39, 8, 7, 7, CR)
  c.rect(42, 8, 4, 4, '#1E1A42')
  c.set(39, 8, '#1E1A42')
  for (let x = 7; x < 51; x += 1) {
    const h = Math.round(9 + 3 * Math.sin(x * 0.28) + 2 * Math.sin(x * 0.11))
    c.rect(x, 39 - h, 1, h, '#27305A')
  }
  for (let x = 7; x < 51; x += 1) {
    const h = Math.round(4 + 2 * Math.sin(x * 0.4 + 2))
    c.rect(x, 39 - h, 1, h, '#1F3B3A')
  }
  for (const [x, y] of [[14, 33], [22, 35], [31, 34], [44, 33]] as const) c.rect(x, y, 2, 2, GOLD)
  c.rect(28, 5, 2, 34, W[3])
  c.rect(7, 21, 44, 1, W[3])
  for (let i = 0; i < 9; i += 1) {
    const col = ['#C75A4E', '#A84640', '#D9786A'][i % 3]!
    c.rect(2 + i, 1, 1, 41 - Math.abs(i - 2), col)
    c.rect(55 - i, 1, 1, 41 - Math.abs(i - 2), col)
  }
  c.rect(0, 0, 58, 2, W[0])
  c.rect(0, 0, 58, 1, W[2])
  c.set(0, 1, GOLD)
  c.set(57, 1, GOLD)
  c.rect(3, 42, 52, 3, W[4])
  c.rect(3, 42, 52, 1, W[5])
  c.rect(3, 45, 52, 1, W[1])
  c.rect(23, 38, 8, 4, '#B8452A')
  c.rect(23, 38, 8, 1, '#D96A48')
  c.rect(26, 33, 1, 5, G[2])
  c.rect(24, 34, 5, 2, G[3])
  c.rect(25, 32, 3, 2, G[4])
  return c
}

function etagere() {
  const c = canvas(66, 34)
  const cols = ['#C75A4E', '#3F7CC8', '#E0A030', '#2A9D8F', '#7F6BD6', '#D4537E', '#F4E4C1', '#5A3A22']
  let x = 3
  for (let i = 0; i < 13; i += 1) {
    const w = 2 + Math.floor(noise(i, 3) * 3)
    const h = 11 + Math.floor(noise(i, 4) * 7)
    const col = cols[i % 8]!
    c.rect(x, 29 - h, w, h, col)
    c.rect(x, 29 - h, 1, h, col === CR ? '#FFF6DE' : `${col}`)
    c.rect(x, 29 - h + 3, w, 1, '#FFFFFF|0.35')
    c.rect(x + w - 1, 29 - h, 1, h, '#1B1730|0.3')
    x += w
    if (i === 5) x += 2
  }
  c.rect(x + 1, 23, 3, 6, '#E0A030')
  c.rect(x, 22, 5, 1, '#F2C25C')
  c.rect(46, 18, 6, 3, '#B8452A')
  c.rect(47, 21, 4, 8, '#B8452A')
  c.rect(47, 21, 1, 8, '#D96A48')
  c.rect(47, 12, 1, 6, G[2])
  c.rect(50, 10, 1, 8, G[1])
  c.rect(45, 11, 3, 2, G[3])
  c.rect(50, 12, 4, 1, G[3])
  c.rect(49, 9, 3, 2, G[4])
  c.rect(54, 20, 9, 9, W[2])
  c.rect(54, 20, 9, 1, W[4])
  c.rect(57, 23, 3, 2, GOLD)
  c.rect(0, 29, 66, 3, W[3])
  c.rect(0, 29, 66, 1, W[5])
  c.rect(0, 31, 66, 1, W[1])
  c.rect(4, 32, 3, 2, W[1])
  c.rect(59, 32, 3, 2, W[1])
  return c
}

function peinture() {
  const c = canvas(34, 28)
  c.rect(0, 0, 34, 28, '#8C6A2E')
  c.rect(1, 1, 32, 26, '#D6A94A')
  c.rect(1, 1, 32, 1, '#F2D27C')
  c.rect(3, 3, 28, 22, '#6B4A1E')
  c.rect(4, 4, 26, 20, '#F0A868')
  c.rect(4, 4, 26, 6, '#D9786A')
  c.rect(4, 8, 26, 2, '#E89070')
  c.rect(19, 9, 6, 6, '#FFE08A')
  for (let x = 4; x < 30; x += 1) {
    const h = Math.round(5 + 3 * Math.sin(x * 0.5))
    c.rect(x, 24 - h - 3, 1, h + 3, '#5A4A7A')
  }
  c.rect(4, 20, 26, 4, '#3E7A4C')
  return c
}

function affiche() {
  const c = canvas(26, 34)
  c.rect(1, 1, 24, 32, '#1B1730|0.3')
  c.rect(0, 0, 24, 32, CR)
  c.rect(0, 0, 24, 1, '#FFF6DE')
  c.rect(2, 2, 20, 28, '#2A9D8F')
  c.rect(2, 2, 20, 10, '#3AB5A4')
  c.rect(13, 4, 6, 6, GOLD)
  c.rect(2, 20, 20, 10, '#E4633A')
  c.sprite(['...cccccccc...', '...cccccccc...', '...ceccccec...', '.cccecccceccc.', '.cccccccccccc.', '...cccccccc...', '....c.c.c.c...'], { c: '#D97757', e: INK }, 5, 14)
  c.rect(5, 24, 14, 2, CR)
  c.rect(8, 27, 8, 1, CR)
  c.rect(11, 0, 2, 2, '#E4505F')
  return c
}

function horloge() {
  const c = canvas(18, 18)
  c.sprite(['.....oooooooo.....', '...ooWWWWWWWWoo...', '..oWWWWWkWWWWWWo..', '.oWWWWWWkWWWWWWWo.', '.oWWWWWWkWWWWWWWo.', 'oWWWWWWWkWWWWWWWWo', 'oWWWWWWWkWWWWWWWWo', 'oWWWWWWWkWWWWWWWWo', 'oWkWWWWWkkkkWWWkWo', 'oWWWWWWWWWWWWWWWWo', 'oWWWWWWWWWWWWWWWWo', 'oWWWWWWWWWWWWWWWWo', '.oWWWWWWWWWWWWWWo.', '.oWWWWWWWWWWWWWWo.', '..oWWWWWkWWWWWWo..', '...ooWWWWWWWWoo...', '.....oooooooo.....'], { o: W[2], W: '#FFF6DE', k: INK }, 0, 0)
  return c
}

function suspendue() {
  const c = canvas(26, 44)
  c.rect(12, 0, 2, 12, '#C9B48A')
  c.rect(10, 8, 1, 5, '#C9B48A')
  c.rect(15, 8, 1, 5, '#C9B48A')
  c.rect(7, 13, 12, 7, '#E8D6B0')
  c.rect(7, 13, 12, 1, '#FFF6DE')
  c.rect(7, 16, 12, 1, '#C9B48A')
  c.rect(9, 20, 8, 1, '#C9B48A')
  const vine = (x: number, len: number, dir: number) => {
    for (let i = 0; i < len; i += 1) {
      const px = x + Math.round(Math.sin(i * 0.5) * dir * 2)
      c.set(px, 14 + i, G[i % 3]!)
      if (i % 4 === 1) {
        c.rect(px + dir, 14 + i, 2, 2, G[3])
        c.set(px + dir, 14 + i, G[4])
      }
      if (i % 4 === 3) c.rect(px - 2 * dir, 14 + i, 2, 2, G[2])
    }
  }
  vine(6, 24, 1)
  vine(19, 29, -1)
  vine(10, 12, 1)
  vine(15, 16, -1)
  c.rect(8, 10, 10, 4, G[2])
  c.rect(9, 9, 8, 2, G[3])
  c.rect(11, 8, 3, 2, G[4])
  return c
}

/** A string of lights; `w` is a multiple of 26, one sag of the wire. */
export function guirlande(w = 130) {
  const c = canvas(w, 14)
  for (let i = 0; i < w; i += 1) {
    const y = Math.round(2 + Math.abs(Math.sin((i * Math.PI) / 26)) * 7)
    c.set(i, y, W[0])
    if (i % 13 === 6) {
      c.rect(i - 3, y - 1, 7, 7, '#FFC857|0.16')
      c.rect(i - 2, y, 5, 5, '#FFC857|0.2')
      c.rect(i - 1, y + 1, 3, 3, GOLD)
      c.set(i, y + 1, '#FFF6DE')
    }
  }
  return c
}

/** The wall screen with the running token count, 36 by 30 cells, its text left to the room. */
export function tele() {
  const c = canvas(36, 30)
  c.rect(2, 28, 32, 1, '#000000|0.28')
  c.rect(17, 28, 2, 2, '#14121F')
  for (const x of [8, 25]) {
    c.rect(x, 0, 3, 2, '#46405C')
    c.rect(x, 0, 3, 1, '#6A6488')
  }
  c.rect(1, 2, 34, 1, '#14121F')
  c.rect(1, 27, 34, 1, '#14121F')
  c.rect(0, 3, 1, 24, '#14121F')
  c.rect(35, 3, 1, 24, '#14121F')
  c.rect(1, 3, 34, 24, '#2A2740')
  c.rect(2, 3, 32, 1, '#4A4568')
  c.rect(1, 4, 1, 20, '#3C3856')
  c.rect(1, 24, 34, 3, '#1E1C30')
  c.rect(3, 5, 30, 18, '#0B0A14')
  c.rect(4, 6, 28, 16, '#0F2A30')
  for (let y = 7; y < 22; y += 2) c.rect(4, y, 28, 1, '#13333A')
  c.rect(4, 6, 28, 1, '#1D4A4E')
  c.rect(4, 21, 28, 1, '#1D4A4E')
  c.rect(4, 7, 1, 14, '#1D4A4E')
  c.rect(31, 7, 1, 14, '#1D4A4E')
  for (const [x, y, w] of [[27, 7, 4], [28, 8, 3], [29, 9, 2], [30, 10, 1]] as const) c.rect(x, y, w, 1, '#2F6A6E')
  c.rect(4, 25, 5, 1, '#6A6488')
  c.rect(26, 25, 2, 1, '#46405C')
  c.rect(29, 24, 4, 3, '#14121F')
  c.rect(30, 25, 2, 1, '#7FE0C8')
  return c
}

/** The wooden frame of the plan board, in pixels of the room: `h` tall, with 4 more above for its hooks and below for its shadow. */
export function tableau(w: number, h: number) {
  const c = canvas(w + 4, h + 8)
  c.rect(4, 8, w, h, '#0F0A1A|0.38')
  c.rect(0, 4, w, h, '#3B2318')
  c.rect(2, 6, w - 4, h - 4, '#8A5A3A')
  c.rect(2, 6, w - 4, 2, '#D4A878')
  c.rect(2, 8, 2, h - 6, '#B98A5C')
  c.rect(2, h, w - 4, 2, '#5C3A28')
  c.rect(w - 4, 8, 2, h - 8, '#6E462F')
  c.rect(20, 8, 14, 2, '#6E462F')
  c.rect(w - 34, 8, 10, 2, '#A97A4E')
  c.rect(12, h - 2, 12, 2, '#6E462F')
  c.rect(8, 12, w - 16, h - 16, '#C9B48A')
  c.rect(10, 14, w - 20, h - 20, '#FFF6DE')
  for (const x of [12, w - 18]) {
    c.rect(x, 0, 6, 6, '#46405C')
    c.rect(x, 0, 6, 2, '#8A84A8')
  }
  return c
}

/** The little box of a plan step, 5 by 5 cells. */
export function caseEtape(status: 'completed' | 'in_progress' | 'pending') {
  const c = canvas(5, 5)
  c.rect(0, 0, 5, 5, '#1B1730')
  c.rect(1, 1, 3, 3, status === 'completed' ? '#4E8F5A' : status === 'in_progress' ? GOLD : '#FFF6DE')
  if (status === 'in_progress') c.set(2, 2, '#1B1730')
  if (status === 'completed') {
    c.set(1, 2, '#F4FFF0')
    c.set(2, 3, '#F4FFF0')
    c.rect(3, 1, 1, 2, '#F4FFF0')
  }
  return c
}

/** The envelope of the news, 20 by 14 in pixels of the room. */
export const enveloppe = () =>
  '<path fill="#1B1730" d="M2 0h16v2h2v10h-2v2H2v-2H0V2h2z"/><path fill="#FFF6DE" d="M2 2h16v10H2z"/>' +
  '<path fill="#D8C49E" d="M2 2h2v2h2v2h2v2h4V6h2V4h2V2h2v2h-2v2h-2v2h-2v2H8V8H6V6H4V4H2z"/><path fill="#E4633A" d="M8 6h4v4H8z"/>'

/** The collecting tube, 50 wide and `h` tall: in from the left at the top, down the right, into its base. */
export const tube = (h: number) =>
  `<path fill="#2A2036" d="M0 0h46v${h - 12}h-8V8H0z"/><path fill="#46405C" d="M0 2h44v${h - 14}h-4V6H0z"/>` +
  `<path fill="#8A84A8" d="M0 2h42v2H0zM40 4h2v${h - 16}h-2z"/><path fill="#1B1730" d="M34 ${h - 12}h16v12H34z"/><path fill="#8A84A8" d="M36 ${h - 10}h12v2H36z"/>`

/**
 * The news tray, 68 by 66, with `pile` envelopes, 3 at most. Ten shapes at the fullest: the back and the tray
 * each carry their dark edge as a stroke, and the tray's feet are rings of that stroke with nothing inside.
 */
export function casier(pile: number) {
  const n = Math.max(0, Math.min(3, pile))
  const top = 28 - (n - 1) * 8
  const strips = Array.from({ length: n }, (_, i) => `M14 ${top + i * 8}h40v6H14z`).join('')
  const stack = n
    ? `<path fill="#1B1730" d="M12 ${top - 2}h44v${46 - top}H12z"/><path fill="#FFF6DE" d="${strips}"/>` +
      `<path fill="#D8C49E" d="M14 ${top}h2v2h2v2h2v2h28v-2h2v-2h2v-2h2v2h-2v2h-2v2h-2v2H20v-2h-2v-2h-2v-2h-2z"/><path fill="#E4633A" d="M32 ${top + 4}h4v4h-4z"/>`
    : ''
  return `<path fill="#1B1730" fill-opacity=".28" d="M0 60h68v6H0z"/><path fill="#2A1C18" stroke="#3B2318" stroke-width="2" d="M7 23h54v21H7z"/>${stack}` +
    '<path fill="#A97A4E" stroke="#4A2C2A" stroke-width="2" d="M3 41h62v18H3zM7 61h6v2H7zM55 61h6v2h-6z"/>' +
    '<path fill="#C99A68" d="M4 42h60v2H4z"/><path fill="#8A5A3A" d="M4 54h60v4H4z"/><path fill="#C9A24A" d="M24 46h20v6H24z"/>'
}

/** The red counter of the news: `w` wide, its dark edge, then its face. */
export const compteur = (x: number, y: number, w: number) => `<rect x="${x}" y="${y}" width="${w}" height="20" rx="2" fill="#1B1730"/><rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="16" fill="#B8452A"/>`

/** The thought bubble over a person at work, its dots left to the room. */
export function bulle() {
  const c = canvas(17, 11)
  c.rect(0, 1, 17, 7, '#1B1730')
  c.rect(1, 0, 15, 9, '#1B1730')
  c.rect(1, 1, 15, 7, '#FFF6DE')
  c.rect(1, 9, 2, 2, '#1B1730')
  return c
}

function liege() {
  const c = canvas(44, 32)
  c.rect(0, 0, 44, 32, W[2])
  c.rect(0, 0, 44, 1, W[4])
  c.rect(2, 2, 40, 28, '#C09A68')
  for (let i = 0; i < 120; i += 1) c.set(2 + Math.floor(noise(i, 5) * 40), 2 + Math.floor(noise(i, 6) * 28), i % 2 ? '#A8824F' : '#D2AE7E')
  c.rect(5, 5, 12, 12, '#FFE08A')
  c.rect(5, 5, 12, 2, '#F2C25C')
  c.rect(7, 9, 8, 1, '#8A7A52')
  c.rect(7, 12, 6, 1, '#8A7A52')
  c.set(10, 4, '#E4505F')
  c.rect(21, 4, 16, 13, '#FFF6DE')
  c.rect(22, 5, 14, 9, '#5FB0E0')
  c.rect(22, 10, 14, 4, '#4E8F5A')
  c.rect(31, 6, 3, 3, GOLD)
  c.set(28, 3, '#3F7CC8')
  c.rect(7, 20, 12, 8, '#8FD4C8')
  c.rect(9, 22, 8, 1, '#2A6B60')
  c.rect(9, 24, 5, 1, '#2A6B60')
  c.set(12, 19, GOLD)
  c.rect(24, 20, 13, 8, '#F4A0A8')
  c.rect(26, 22, 9, 1, '#8A3A44')
  c.rect(26, 24, 7, 1, '#8A3A44')
  c.set(30, 19, '#E4505F')
  return c
}

function monstera() {
  const c = canvas(34, 52)
  c.rect(7, 49, 20, 3, SH)
  pot(c, 10, 38, 14, 10)
  c.rect(16, 20, 2, 18, G[0])
  c.rect(14, 26, 2, 12, G[0])
  c.rect(19, 24, 2, 14, G[0])
  const leaf = (x: number, y: number, w: number, h: number, k: number) => {
    for (let j = 0; j < h; j += 1) {
      const hw = Math.round((Math.sin(((j + 0.5) / h) * Math.PI) * w) / 2)
      c.rect(x - hw, y + j, hw * 2 + 1, 1, G[k]!)
      if (hw > 2) c.rect(x - hw, y + j, 1, 1, G[k + 1]!)
    }
    c.rect(x, y + 1, 1, h - 2, G[k + 2] ?? G[4])
    for (let j = 2; j < h - 2; j += 3) {
      c.set(x - Math.round(w / 2) + 1, y + j, null)
      c.set(x + Math.round(w / 2) - 1, y + j, null)
    }
  }
  leaf(8, 20, 12, 14, 1)
  leaf(26, 18, 12, 15, 1)
  leaf(17, 4, 16, 18, 2)
  leaf(10, 8, 10, 12, 0)
  leaf(25, 6, 10, 12, 0)
  return c
}

function canape() {
  const c = canvas(70, 38)
  const [a, b, d, e] = ['#3F6C8C', '#5A8CAE', '#2C5068', '#7FB0CC'] as const
  c.rect(3, 35, 64, 3, SH)
  c.rect(6, 6, 58, 18, a)
  c.rect(6, 6, 58, 1, e)
  c.rect(6, 7, 58, 2, b)
  for (const x of [24, 46]) c.rect(x, 7, 1, 17, d)
  for (const [x, y] of [[15, 14], [35, 14], [55, 14]] as const) c.rect(x, y, 2, 2, d)
  for (const x of [1, 59]) {
    c.rect(x, 14, 10, 20, a)
    c.rect(x, 14, 10, 2, b)
    c.rect(x, 14, 10, 1, e)
    c.rect(x, 33, 10, 1, d)
  }
  c.rect(11, 22, 48, 10, b)
  c.rect(11, 22, 48, 1, e)
  c.rect(11, 31, 48, 2, d)
  c.rect(34, 22, 1, 10, d)
  c.rect(13, 12, 14, 12, '#E4633A')
  c.rect(13, 12, 14, 1, '#F08A66')
  c.rect(26, 12, 1, 12, '#B8452A')
  c.rect(45, 14, 12, 10, GOLD)
  c.rect(45, 14, 12, 1, '#FFE08A')
  c.rect(56, 14, 1, 10, '#C9962E')
  for (const x of [4, 63]) c.rect(x, 34, 3, 3, W[1])
  return c
}

function lampe() {
  const c = canvas(34, 62)
  c.rect(9, 60, 16, 2, SH)
  c.rect(11, 57, 12, 3, '#3A3355')
  c.rect(11, 57, 12, 1, '#6A6E8C')
  c.rect(16, 16, 2, 41, '#6A6E8C')
  c.rect(16, 16, 1, 41, '#9AA0BC')
  const shade = [[9, 16], [8, 18], [7, 20], [7, 20], [6, 22], [6, 22], [5, 24], [5, 24], [4, 26], [4, 26]] as const
  shade.forEach(([x, w], j) => {
    c.rect(x, 4 + j, w, 1, j < 2 ? '#FFE9A8' : j < 7 ? '#F2C25C' : '#D99A3A')
    c.set(x, 4 + j, '#FFF6DE')
  })
  c.rect(4, 14, 26, 1, '#B87A2A')
  c.rect(0, 15, 34, 2, '#FFC857|0.12')
  c.rect(2, 17, 30, 3, '#FFC857|0.09')
  c.rect(4, 20, 26, 4, '#FFC857|0.06')
  c.rect(15, 2, 4, 2, '#6A6E8C')
  return c
}

function cafe() {
  const c = canvas(38, 44)
  c.rect(1, 41, 36, 3, SH)
  c.rect(2, 20, 34, 21, W[3])
  c.rect(2, 20, 34, 2, W[5])
  c.rect(2, 22, 34, 1, W[2])
  c.rect(4, 25, 14, 14, W[2])
  c.rect(20, 25, 14, 14, W[2])
  c.rect(5, 26, 12, 12, W[3])
  c.rect(21, 26, 12, 12, W[3])
  c.rect(16, 31, 1, 2, GOLD)
  c.rect(21, 31, 1, 2, GOLD)
  c.rect(6, 3, 18, 17, '#3F4258')
  c.rect(6, 3, 18, 1, '#6A6E8C')
  c.rect(6, 4, 1, 16, '#565A78')
  c.rect(8, 6, 14, 5, '#232636')
  c.set(10, 8, '#E4505F')
  c.set(13, 8, '#7FE0C8')
  c.rect(10, 11, 10, 5, '#1B1730')
  c.rect(13, 11, 4, 1, '#6A6E8C')
  c.rect(12, 14, 6, 4, CR)
  c.rect(12, 14, 6, 1, '#5A3A22')
  c.rect(18, 15, 1, 2, CR)
  c.rect(27, 13, 8, 7, '#D4537E')
  c.rect(27, 13, 8, 1, '#E77FA0')
  c.rect(29, 8, 3, 5, G[2])
  c.rect(28, 9, 5, 2, G[3])
  return c
}

function fontaine() {
  const c = canvas(20, 50)
  c.rect(2, 47, 16, 3, SH)
  c.rect(3, 24, 14, 23, '#D9DCE8')
  c.rect(3, 24, 1, 23, '#FFFFFF')
  c.rect(16, 24, 1, 23, '#A8ACC0')
  c.rect(3, 24, 14, 1, '#FFFFFF')
  c.rect(6, 29, 8, 8, '#2F3448')
  c.rect(8, 31, 1, 2, '#3F7CC8')
  c.rect(11, 31, 1, 2, '#E4505F')
  c.rect(6, 38, 8, 1, '#A8ACC0')
  c.rect(5, 4, 10, 20, '#5FB0E0')
  c.rect(5, 4, 10, 3, '#8CCBEA')
  c.rect(6, 4, 1, 20, '#BFE6F5')
  c.rect(13, 7, 2, 17, '#3F8CC0')
  c.rect(7, 1, 6, 3, '#3F7CC8')
  c.rect(7, 1, 6, 1, '#7FA6E0')
  for (const [x, y] of [[9, 12], [11, 17], [8, 20]] as const) c.set(x, y, '#FFFFFF|0.7')
  return c
}

function cartons() {
  const c = canvas(40, 34)
  c.rect(1, 31, 38, 3, SH)
  const box = (x: number, y: number, w: number, h: number) => {
    c.rect(x, y, w, h, '#C09A68')
    c.rect(x, y, w, 1, '#E0C090')
    c.rect(x, y, 1, h, '#D2AE7E')
    c.rect(x + w - 1, y, 1, h, '#8A6A42')
    c.rect(x, y + h - 1, w, 1, '#8A6A42')
    c.rect(x + Math.floor(w / 2) - 1, y, 3, h, '#D8C49E')
    c.rect(x + 3, y + h - 5, 6, 3, '#FFF6DE')
    c.rect(x + 4, y + h - 4, 4, 1, '#8A7A52')
  }
  box(2, 12, 22, 20)
  box(22, 18, 16, 14)
  box(8, 0, 16, 12)
  return c
}

function chat() {
  const c = canvas(30, 16)
  c.rect(0, 10, 30, 5, '#C75A4E')
  c.rect(0, 10, 30, 1, '#D9786A')
  c.rect(1, 14, 28, 1, '#8E3320')
  c.sprite(['....o.....o.............', '...oao...oao............', '...oaaoooaao...ooooo....', '..oaaaaaaaaaoooaaaaaoo..', '..oakaaaakaaaaaaaaaaao.', '..oaaaakkaaaaabaabaaaao', '...oaaaaaaaaaabaabaaaao', '....ooaaaaaaaaaaaaaaoo.', '......oooooooooooooo...'], { o: INK, a: '#E0A050', b: '#C07A30', k: INK }, 3, 3)
  return c
}

function bibliotheque() {
  const c = canvas(44, 62)
  c.rect(1, 59, 42, 3, SH)
  c.rect(1, 0, 42, 60, W[2])
  c.rect(1, 0, 42, 2, W[5])
  c.rect(1, 0, 1, 60, W[4])
  c.rect(42, 0, 1, 60, W[1])
  c.rect(3, 3, 38, 54, W[0])
  const cols = ['#C75A4E', '#3F7CC8', '#E0A030', '#2A9D8F', '#7F6BD6', '#D4537E', '#F4E4C1', '#6B4030']
  for (let s = 0; s < 4; s += 1) {
    const y = 3 + s * 14
    c.rect(3, y + 12, 38, 2, W[3])
    c.rect(3, y + 12, 38, 1, W[5])
    let x = 4
    for (let i = 0; i < 14 && x < 37; i += 1) {
      if (noise(i, s + 9) > 0.86) {
        x += 4
      } else {
        const w = 2 + Math.floor(noise(i, s) * 2)
        const h = 7 + Math.floor(noise(s, i) * 4)
        c.rect(x, y + 12 - h, w, h, cols[(i * 3 + s) % 8]!)
        c.rect(x, y + 12 - h + 2, w, 1, '#FFFFFF|0.3')
        x += w
      }
    }
  }
  return c
}

function poubelle() {
  const c = canvas(16, 20)
  c.rect(1, 18, 14, 2, SH)
  c.rect(3, 6, 10, 12, '#565A78')
  c.rect(3, 6, 1, 12, '#8A8FA3')
  c.rect(12, 6, 1, 12, '#3F4258')
  for (const x of [6, 9]) c.rect(x, 8, 1, 9, '#3F4258')
  c.rect(2, 5, 12, 2, '#6A6E8C')
  c.rect(2, 5, 12, 1, '#9AA0BC')
  c.rect(5, 1, 5, 4, '#FFF6DE')
  c.rect(6, 0, 3, 2, '#D8C49E')
  c.rect(8, 2, 3, 3, '#E8DCC0')
  return c
}

function pouf() {
  const c = canvas(24, 18)
  c.rect(1, 15, 22, 3, SH)
  c.rect(2, 3, 20, 13, '#7F6BD6')
  c.rect(4, 2, 16, 1, '#A697EA')
  c.rect(2, 3, 20, 2, '#A697EA')
  c.rect(2, 14, 20, 2, '#5C4AB0')
  for (const x of [8, 15]) c.rect(x, 5, 1, 9, '#5C4AB0')
  return c
}

export const WALL_DECOR = { fenetre, etagere, peinture, affiche, horloge, suspendue, guirlande, liege } as const
export const FLOOR_DECOR = { monstera, canape, lampe, cafe, fontaine, cartons, chat, bibliotheque, poubelle, pouf } as const

export type WallDecor = keyof typeof WALL_DECOR
export type FloorDecor = keyof typeof FLOOR_DECOR

/** The rug under the desks; `w` and `h` in cells. */
export function tapis(T: Theme, w: number, h: number) {
  const [a, b, e] = T.rug
  const c = canvas(w, h)
  c.rect(0, 0, w, h, e)
  c.rect(2, 2, w - 4, h - 4, CR)
  c.rect(3, 3, w - 6, h - 6, a)
  c.rect(7, 7, w - 14, h - 14, e)
  c.rect(8, 8, w - 16, h - 16, a)
  c.rect(14, 14, w - 28, h - 28, b)
  c.rect(15, 15, w - 30, h - 30, a)
  for (const [x, y] of [[10, 10], [w - 12, 10], [10, h - 12], [w - 12, h - 12]] as const) c.rect(x, y, 2, 2, GOLD)
  return c
}

/** The rug's fringe: a dashed line, a pixel by pixel row would weigh more than the rest of the rug. */
export const frange = (w: number, h: number) => `<path fill="none" stroke="${CR}" stroke-dasharray="1 2" d="M0 .5h${w}M0 ${h - 0.5}h${w}"/>`
