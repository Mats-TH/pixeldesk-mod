import { expect, test } from 'claude-code/testing'

import { seedOf } from '../draw'
import { COLD_HEARTH, paneOf, roomScene } from '../room'
import type { RoomInput } from '../room'
import { crabLayer, floorCrabLayer } from '../room-layers'
import { CRAB_H, CRAB_W, crabArt, crabLife, crabPose, crabScript, roundsScript } from './crab'
import type { Area, Ground, Script, Spot } from './crab'
import { WORLD } from './pack'
import { packOf } from './themes'

const room = (sessionId: string, n: number, width = 780, height = 760, theme: RoomInput['theme'] = 'cosy'): RoomInput => ({ sessionId, theme, desks: Array.from({ length: n }, (_, i) => ({ title: 'Agent', state: 'working', hue: i + 1 })), manager: { working: false }, previous: n, steps: [], tokens: 0, width, height, hearth: COLD_HEARTH, settings: true })
const groundOf = (p: RoomInput) => roomScene(p, { layer: 'back' }).life.ground
const bodyAt = (s: Spot): Area => ({ x: s.x, y: s.y, w: CRAB_W, h: CRAB_H })
const crosses = (a: Area, b: Area) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const WALKS = new Set(['droite', 'dos', 'face'])
// A busy machine is slow on these loops: each case is worked out once.
const SLOW = { timeoutMs: 60000 }
const known = new Map<string, { g: Ground; s: Script }>()
function lifeOf(id: string, n: number, w: number, h: number) {
  const key = `${id} ${n} ${w} ${h}`
  if (!known.has(key)) {
    const g = groundOf(room(id, n, w, h))
    known.set(key, { g, s: crabScript(seedOf(id), g) })
  }
  return known.get(key)!
}

/** Each stretch he walks, as the box it sweeps. */
const swept = (s: Script) => s.beats.filter(b => WALKS.has(b.set) && b.to).map(b => {
  const [from, to] = [b, b.to!]
  return { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(from.x - to.x) + CRAB_W, h: Math.abs(from.y - to.y) + CRAB_H }
})
const CASES: [number, number, number][] = [[0, 780, 760], [1, 780, 760], [3, 780, 760], [6, 900, 700], [16, 1000, 900], [0, 540, 420], [3, 540, 420]]
const IDS = ['a', 'b', 'c', 'une conversation', '5cb604d8-a3f9-4749']

test('the same conversation gets the same crab, another gets another', SLOW, () => {
  const g = groundOf(room('a', 3))
  expect(crabScript(seedOf('a'), g)).toEqual(crabScript(seedOf('a'), g))
  expect(crabLife(seedOf('a'), g)).toEqual(crabLife(seedOf('a'), g))
  const scripts = IDS.map(id => JSON.stringify(crabScript(seedOf(id), g).beats))
  expect(new Set(scripts).size).toBe(IDS.length)
})

test('a loop lasts two to four minutes, with no hole and no leap', SLOW, () => {
  for (const [n, w, h] of CASES) for (const id of IDS) {
    const { s } = lifeOf(id, n, w, h)
    expect(s.ms, `${id} ${n}`).toBeGreaterThanOrEqual(120_000)
    expect(s.ms, `${id} ${n}`).toBeLessThanOrEqual(240_000)
    let now = 0
    for (const b of s.beats) {
      expect(b.from).toBe(now)
      expect(b.ms).toBeGreaterThan(0)
      now += b.ms
    }
    expect(now).toBe(s.ms)
  }
})

test('he stays on the floor the pane shows, and walks through no desk, stove or piece of furniture', SLOW, () => {
  for (const [n, w, h] of CASES) for (const id of IDS) {
    const { g, s } = lifeOf(id, n, w, h)
    for (const leg of swept(s)) {
      expect(leg.x, `${id} ${n}`).toBeGreaterThanOrEqual(0)
      expect(leg.x + leg.w, `${id} ${n}`).toBeLessThanOrEqual(g.w)
      expect(leg.y, `${id} ${n}`).toBeGreaterThanOrEqual(g.top)
      expect(leg.y + leg.h, `${id} ${n}`).toBeLessThanOrEqual(g.bottom)
      for (const b of [...g.desks, ...g.items, ...g.blocked, g.basket, ...(g.stove ? [g.stove] : [])]) expect(crosses(leg, b), `${id} ${n}`).toBe(false)
    }
  }
})

test('he wakes in his basket and goes back to it, and walks all four ways', SLOW, () => {
  const ways = new Set<string>()
  for (const [n, w, h] of CASES) for (const id of IDS) {
    const { s } = lifeOf(id, n, w, h)
    const [first, last] = [s.beats[0]!, s.beats[s.beats.length - 1]!]
    for (const b of [first, last]) {
      expect(b.set).toBe('sommeil')
      expect({ x: b.x, y: b.y }).toEqual(s.bed)
    }
    expect(s.beats.some(b => b.to && !b.image), `${id} ${n}: he gets up`).toBe(true)
    for (const b of s.beats) if (WALKS.has(b.set) && b.to) ways.add(b.set === 'droite' ? (b.flip ? 'left' : 'right') : b.set)
  }
  expect([...ways].sort()).toEqual(['dos', 'face', 'left', 'right'])
})

test('he goes and sees a person, an object and the fire', SLOW, () => {
  const sets = new Set<string>()
  for (const [n, w, h] of CASES) for (const id of IDS) for (const b of lifeOf(id, n, w, h).s.beats) sets.add(b.set)
  for (const set of ['pied', 'salue', 'pince', 'feu', 'assis', 'papier']) expect([...sets]).toContain(set)
})

test('a room left with no way out keeps him asleep, for the whole loop', () => {
  const g: Ground = { w: 200, top: 160, bottom: 200, basket: { x: 0, y: 160, w: 200, h: 40 }, desks: [], stove: null, items: [], blocked: [] }
  const s = crabScript(1, g)
  expect(s.beats.map(b => b.set)).toEqual(['sommeil', 'sommeil'])
  expect(s.ms).toBeGreaterThanOrEqual(120_000)
})

test('the layer takes the floor, weighs under 60 000 characters and carries only what it plays', SLOW, () => {
  for (const [n, w, h] of CASES) for (const id of IDS) for (const theme of ['cosy', 'base'] as const) {
    const p = room(id, n, w, h, theme)
    const l = crabLayer(p)
    expect(l.source.length, `${id} ${n}`).toBeLessThan(60_000)
    const g = paneOf(p)
    expect(l.left).toBe(0)
    expect(l.width).toBeGreaterThanOrEqual(p.width - 8)
    expect((l.top + l.rows) * 21).toBeGreaterThanOrEqual(p.height - 21)
    expect(g.v.w).toBeGreaterThan(0)
    const defined = [...l.source.matchAll(/<g id="(k\d+)"/g)].map(m => m[1]!)
    const used = new Set([...l.source.matchAll(/href="#(k\d+)"/g)].map(m => m[1]!))
    expect(defined.length).toBe(used.size)
    for (const id2 of defined) expect(used.has(id2)).toBe(true)
  }
})

test('a change of plan, of tokens or of state leaves the source as it was; only the room\'s shape changes it', SLOW, () => {
  const base = room('a', 3)
  const source = crabLayer(base).source
  const busy: RoomInput = { ...base, steps: Array.from({ length: 14 }, (_, i) => ({ text: `Une longue étape du plan ${i}`, status: 'pending' as const })), tokens: 99999, cost: 12, manager: { working: true, done: 1, total: 3, live: true }, desks: base.desks.map(d => ({ ...d, state: 'failed' as const })) }
  expect(crabLayer(busy).source).toBe(source)
  expect(crabLayer(room('a', 4)).source).not.toBe(source)
})

test('it plays by SMIL alone, on a loop, in the only way the app\'s scrub lets through', () => {
  const { source } = crabLayer(room('a', 3))
  expect(source).toContain('calcMode="discrete"')
  expect(source).toContain('repeatCount="indefinite"')
  expect(source).toContain('<animateTransform attributeName="transform"')
  expect(source).not.toMatch(/attributeName="(xlink:)?href"/)
  expect(source).not.toContain('<script')
})

test('a reduced motion leaves him asleep in his basket, at the place of the loop', () => {
  const g = groundOf(room('a', 3))
  const art = crabArt(crabScript(seedOf('a'), g))
  expect(art.style).toContain('@media (prefers-reduced-motion: reduce){.cm{display:none}.cz{display:inline}}')
  const { bed } = crabScript(seedOf('a'), g)
  expect(art.body).toContain(`<g class="cz"><use href="#`)
  expect(art.body).toContain(`transform="translate(${bed.x} ${bed.y}) `)
  expect(crabPose(g).body).toContain(`translate(${bed.x} ${bed.y}) `)
})

test('a lean crab keeps to the walk and the rest, and a pose weighs next to nothing', () => {
  const g = groundOf(room('a', 3))
  const lean = crabScript(seedOf('a'), g, true)
  expect([...new Set(lean.beats.map(b => b.set))].sort()).toEqual(['assis', 'dos', 'droite', 'face', 'sommeil'].filter(s => lean.beats.some(b => b.set === s)))
  const art = crabArt(lean)
  expect(art.defs.length + art.body.length).toBeLessThan(25_000)
  const pose = crabPose(g)
  expect(pose.defs.length + pose.body.length).toBeLessThan(2000)
})

const THEMES = ['cosy', 'japonais', 'nature', 'futuriste', 'geek', 'base'] as const
// His zone on a floor, in pixels of the world.
const MINI = { w: 24, h: 16 }

test('on every floor his rounds close, stay in the world and keep one speed', () => {
  for (const theme of THEMES) for (let n = 2; n <= 11; n += 1) {
    const s = roundsScript(packOf(theme).map.walk!(n))!
    const [first, last] = [s.beats[0]!, s.beats[s.beats.length - 1]!]
    expect(last.to, `${theme} ${n}`).toEqual({ x: first.x, y: first.y })
    expect(last.from + last.ms).toBe(s.ms)
    s.beats.forEach((b, i) => {
      const next = s.beats[(i + 1) % s.beats.length]!
      expect({ x: next.x, y: next.y }, `${theme} ${n}: no leap`).toEqual(b.to)
      expect(Math.abs(Math.hypot(b.to!.x - b.x, b.to!.y - b.y) / b.ms - 0.024), `${theme} ${n}: stretch ${i}`).toBeLessThan(0.001)
      expect(b.x >= 0 && b.y >= 0 && b.x + MINI.w <= WORLD.w && b.y + MINI.h <= WORLD.h, `${theme} ${n}: ${b.x} ${b.y}`).toBe(true)
    })
  }
})

test('on each stretch he looks where he goes, the longer way deciding', () => {
  const s = roundsScript([{ x: 100, y: 100 }, { x: 300, y: 120 }, { x: 310, y: 400 }, { x: 100, y: 420 }, { x: 90, y: 200 }])!
  expect(s.beats.map(b => b.set)).toEqual(['miniDroite', 'miniFace', 'miniGauche', 'miniDos', 'miniDos'])
  expect(s.still).toEqual(['miniDroite', 0])
})

test('with nowhere to go there is no crab, and a point said twice is no stretch', () => {
  expect(roundsScript([])).toBeNull()
  expect(roundsScript([{ x: 50, y: 50 }, { x: 50, y: 50 }])).toBeNull()
  const s = roundsScript([{ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 50 }])!
  expect(s.beats.map(b => b.set)).toEqual(['miniDroite', 'miniGauche'])
})

test('the floor\'s layer takes the world, weighs little and plays by SMIL alone', () => {
  for (const theme of THEMES) for (let n = 2; n <= 11; n += 1) {
    const l = floorCrabLayer(n, 780, 760, theme)!
    expect(l.source.length, `${theme} ${n}`).toBeLessThan(60_000)
    expect([l.left, l.top], `${theme} ${n}`).toEqual([0, 0])
    expect(l.width).toBeGreaterThanOrEqual(780)
    expect(l.height).toBeGreaterThanOrEqual(760)
    expect(l.source).toContain('<animateTransform attributeName="transform"')
    expect(l.source).not.toContain('<script')
  }
})

test('on a pane of another shape the layer stays on the world, with what the pane leaves around it', () => {
  const wide = floorCrabLayer(8, 1100, 760, 'cosy')!
  expect(wide.left).toBe(Math.floor(160 / 8))
  expect(/viewBox="0 0 /.test(wide.source), 'the world at the edge of a cell').toBe(true)
  const tall = floorCrabLayer(8, 780, 1000, 'cosy')!
  expect(tall.top).toBe(Math.floor(120 / 21))
  expect(/viewBox="0 -?[\d.]+ /.exec(tall.source)?.[0], 'the lines of the world under the top of the cell').toBe(`viewBox="0 ${-(120 - 5 * 21)} `)
})

test('his source goes by the theme, the conversations and the pane, and by nothing else', () => {
  const source = floorCrabLayer(8, 780, 760, 'cosy')!.source
  expect(floorCrabLayer(8, 780, 760, 'cosy')!.source).toBe(source)
  expect(floorCrabLayer(8, 780, 760, 'nature')!.source).not.toBe(source)
  expect(floorCrabLayer(9, 780, 760, 'cosy')!.source).not.toBe(source)
  expect(floorCrabLayer(8, 900, 760, 'cosy')!.source).not.toBe(source)
})

test('a reduced motion leaves him standing at the first point of his rounds', () => {
  const s = roundsScript(packOf('cosy').map.walk!(8))!
  const art = crabArt(s)
  expect(art.style).toContain('@media (prefers-reduced-motion: reduce){.cm{display:none}.cz{display:inline}}')
  expect(art.body).toContain(`<g class="cz"><use href="#k0" transform="translate(${s.bed.x} ${s.bed.y}) `)
  expect([...art.defs.matchAll(/<g id=/g)], 'two images each way, and no sleeper').toHaveLength(8)
})
