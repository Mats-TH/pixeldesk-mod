import { canvas, mix, noise } from './canvas'
import type { Canvas } from './canvas'

export const WOOD = ['#2E1A1E', '#4A2C2A', '#6B4030', '#8A5A3A', '#A97A4E', '#C99A68'] as const
const INK = '#2A2036'
const WHITE = '#FFFFFF'
const CREAM = '#F4E4C1'

export type Tenue = 'Corail' | 'Turquoise' | 'Violet' | 'Rose' | 'Bleu' | 'Or'
export type DeskState = 'working' | 'done' | 'failed'

export const TENUES: readonly Tenue[] = ['Corail', 'Turquoise', 'Violet', 'Rose', 'Bleu', 'Or']
/** Corail is the manager's: an agent saved in it by an older version takes the next one. */
export const agentHue = (hue: number) => hue % TENUES.length || 1

const LOOKS: Record<Tenue, [shirt: string, hair: string, skin: string, extra: string]> = {
  Corail: ['#E4633A', '#3B2A20', '#F0C8A0', ''],
  Turquoise: ['#2A9D8F', '#C98B3C', '#C98F62', 'beret'],
  Violet: ['#7F6BD6', '#1F1A2E', '#E8B98A', 'lunettes'],
  Rose: ['#D4537E', '#5A3A22', '#8A5A3C', 'chignon'],
  Bleu: ['#3F7CC8', '#D9A441', '#F0C8A0', 'casque'],
  Or: ['#E0A030', '#6A2C1E', '#C98F62', 'barbe'],
}

const SEATED = ['....oooooooo....', '...oHHhhhhHHo...', '..oHHhhhhhhHHo..', '.oDHHHhhhHHHHDo.', '.oDHHHHHHHHHHDo.', '.oDHSSSSSSSSHDo.', '.oDSSSSSSSSSSDo.', '.osSweSSSSewSso.', '.osSweSSSSewSso.', '.osSSSSSSSSSSso.', '..osSpSSSSpSso..', '...ossSmmSsso...', '....oossssoo....', '...oLCgSSgCCo...', '..oLCCCggCCCco..', '.oLCCCCCCCCCCco.', '.oLCcCCCCCCcCco.', '.oCCcCCCCCCcCco.', '.oSsoCCCCCCoSso.', '.oSSoCCCCCCoSSo.', '..ooocCCCCcooo..', '....ocCCCCco....']

export const skinOf = (tenue: Tenue) => LOOKS[tenue][2]

/** A person seated at a desk, 16 by 22 cells. */
export function person(tenue: Tenue): Canvas {
  const [C, H, S, extra] = LOOKS[tenue]
  const c = canvas(16, 22)
  const pal = {
    o: INK, H, h: mix(H, '#E8A868', 0.3), D: mix(H, '#1B1730', 0.4), S, s: mix(S, '#7A3A3A', 0.3),
    w: '#F9F1DE', e: '#1F1A2E', p: mix(S, '#E4633A', 0.32), m: '#8A4A4A',
    C, c: mix(C, '#1B1730', 0.3), L: mix(C, WHITE, 0.25), g: CREAM,
  }
  c.sprite(SEATED, pal, 0, 0)
  if (extra === 'lunettes') {
    const glass = '#D9D4E8'
    for (const x of [2, 3, 4, 5, 6, 9, 10, 11, 12, 13]) c.set(x, 6, glass)
    for (const x of [2, 6, 9, 13]) {
      c.set(x, 7, glass)
      c.set(x, 8, glass)
    }
    for (const x of [3, 4, 5, 6, 9, 10, 11, 12]) c.set(x, 9, glass)
    c.set(7, 7, glass)
    c.set(8, 7, glass)
  }
  if (extra === 'casque') {
    const band = '#2F3448'
    for (const x of [4, 5, 6, 7, 8, 9, 10, 11]) c.set(x, 0, band)
    c.rect(1, 5, 2, 5, band)
    c.rect(13, 5, 2, 5, band)
    c.rect(1, 6, 1, 3, '#E4633A')
    c.rect(14, 6, 1, 3, '#E4633A')
    for (const [x, y] of [[2, 2], [3, 1], [12, 1], [13, 2], [2, 3], [13, 3], [2, 4], [13, 4]] as const) c.set(x, y, band)
  }
  if (extra === 'chignon') c.rect(6, 0, 4, 1, pal.D)
  if (extra === 'beret') {
    c.rect(3, 1, 10, 3, '#D4537E')
    c.rect(4, 0, 8, 1, '#D4537E')
    c.rect(4, 1, 6, 1, '#E77FA0')
    c.rect(12, 2, 2, 1, '#A83A60')
  }
  if (extra === 'barbe') {
    for (const [x, y] of [[3, 9], [12, 9], [3, 10], [4, 10], [5, 11], [6, 11], [9, 11], [10, 11], [11, 10], [12, 10], [4, 11], [11, 11], [6, 12], [7, 12], [8, 12], [9, 12], [5, 12], [10, 12]] as const) c.set(x, y, pal.D)
    c.set(7, 11, '#8A4A4A')
    c.set(8, 11, '#8A4A4A')
  }
  return c
}

/** The chair back, drawn behind the person; 60 by 45 cells like the desk. */
export function chair(): Canvas {
  const c = canvas(60, 45)
  c.rect(21, 5, 18, 20, INK)
  c.rect(22, 6, 16, 18, '#3B3550')
  c.rect(23, 7, 14, 2, '#544B70')
  c.rect(23, 9, 1, 14, '#544B70')
  for (let y = 10; y < 22; y += 3) c.rect(25, y, 10, 1, '#332D46')
  return c
}

/** The desk, 60 by 45 cells: laptop, mug, papers, a plant and the name plate. `rest`: the screen is off. */
export function desk(state: DeskState | 'rest'): Canvas {
  const c = canvas(60, 45)
  const W = WOOD
  c.rect(3, 41, 54, 4, '#1B1730|0.28')
  c.rect(1, 43, 58, 2, '#1B1730|0.28')
  c.rect(3, 38, 5, 5, W[1])
  c.rect(4, 38, 1, 5, W[2])
  c.rect(52, 38, 5, 5, W[1])
  c.rect(53, 38, 1, 5, W[2])
  c.rect(2, 28, 56, 12, W[3])
  c.rect(2, 28, 56, 1, W[2])
  c.rect(2, 39, 56, 1, W[1])
  c.rect(2, 29, 1, 10, W[4])
  c.rect(57, 29, 1, 10, W[2])
  for (let y = 30; y < 39; y += 3) for (let x = 3; x < 57; x += 1) if (noise(x, y) > 0.72) c.set(x, y, mix(W[3], W[2], 0.5))
  c.rect(1, 18, 58, 9, W[4])
  c.rect(1, 18, 58, 1, W[5])
  c.rect(0, 26, 60, 2, W[5])
  c.rect(0, 27, 60, 1, W[2])
  c.rect(0, 19, 1, 8, W[3])
  c.rect(59, 19, 1, 8, W[2])
  for (let i = 0; i < 46; i += 1) {
    const x = 2 + Math.floor(noise(i, 11) * 54)
    const y = 19 + Math.floor(noise(i, 12) * 7)
    const l = 2 + Math.floor(noise(i, 13) * 7)
    c.rect(x, y, Math.min(l, 58 - x), 1, noise(i, 14) > 0.5 ? mix(W[4], W[3], 0.55) : mix(W[4], W[5], 0.5))
  }
  c.rect(5, 30, 50, 10, W[1])
  c.rect(6, 31, 48, 8, CREAM)
  c.rect(6, 31, 48, 1, '#FFF6DE')
  c.rect(6, 38, 48, 1, '#D8C49E')
  for (const [x, y] of [[7, 32], [52, 32], [7, 37], [52, 37]] as const) c.set(x, y, '#C9A24A')
  const bad = state === 'failed'
  const off = state === 'rest'
  if (state === 'done') {
    c.rect(5, 18, 20, 3, '#3F4258')
    c.rect(5, 18, 20, 1, '#6A6E8C')
    c.rect(4, 21, 22, 1, INK)
    c.rect(13, 19, 4, 1, '#565A78')
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
  c.rect(43, 17, 4, 5, CREAM)
  c.rect(43, 19, 4, 1, '#E4633A')
  c.rect(43, 17, 4, 1, '#5A3A22')
  c.rect(48, 18, 1, 3, INK)
  c.rect(46, 17, 1, 5, '#D8C49E')
  c.rect(29, 21, 9, 5, '#D8C49E')
  c.rect(30, 20, 9, 5, '#FFF6DE')
  for (const y of [21, 23]) c.rect(31, y, 6, 1, '#A8B0C8')
  c.rect(37, 22, 1, 4, '#3F7CC8')
  c.rect(52, 19, 5, 4, '#B8452A')
  c.rect(53, 23, 3, 1, '#8E3320')
  c.rect(52, 19, 5, 1, '#D96A48')
  c.rect(53, 15, 1, 4, '#4E8F5A')
  c.rect(55, 14, 1, 5, '#3E7A4C')
  c.rect(54, 13, 2, 2, '#8CC265')
  c.rect(52, 15, 2, 1, '#6FAE5C')
  c.rect(56, 16, 2, 1, '#6FAE5C')
  if (state === 'done') {
    c.rect(7, 7, 12, 11, '#2F6B45')
    c.rect(8, 8, 10, 9, '#4E8F5A')
    c.rect(8, 8, 10, 1, '#6FAE5C')
    c.sprite(['.......x', '......xx', 'x....xx.', 'xx..xx..', '.xxxx...', '..xx....'], { x: CREAM }, 9, 9)
  }
  return c
}

/** The mascot, 20 by 13 cells, with an ink outline. */
export function crab(): Canvas {
  const c = canvas(20, 13)
  c.sprite(['...cccccccccccc...', '..cLLLLLLLLLLLLc..', '..cLccccccccccsc..', '..cceccccccceccc..', '.ccceccccccceccss.', 'ccccccccccccccccss', 'ccsccLccccLccsccss', '...ccccccccccss...', '...cccccccccss....', '....c.c....c.c....', '....s.s....s.s....'], { c: '#D97757', L: '#EE9A7C', s: '#B85A3C', e: '#1B1730' }, 1, 1)
  const ring: [number, number][] = []
  for (let y = 0; y < 13; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      if (!c.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => c.get(x + a!, y + b!))) ring.push([x, y])
    }
  }
  for (const [x, y] of ring) c.set(x, y, INK)
  return c
}
