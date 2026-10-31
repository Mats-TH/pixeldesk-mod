import { expect, test } from 'claude-code/testing'

import type { Ash, Fire, RoomTheme } from '../../../types'
import { deskBoxes, managerBox, roomBackSvg, roomCountSvg, roomSvg } from '../../room'
import type { RoomInput } from '../../room'
import { deskLayers, fireLayer, labelsSvg, decorLayers } from '../../room-layers'
import { packOf } from '.'

const THEMES: RoomTheme[] = ['cosy', 'japonais', 'nature', 'futuriste', 'geek', 'base']
const FIRES: Fire[] = ['full', 'medium', 'low', 'embers', 'out']
const ASHES: Ash[] = ['none', 'small', 'medium', 'large', 'full']
const LIMIT = 131_072

const room = (theme: RoomTheme, n: number, id = 'seed', over: Partial<RoomInput> = {}): RoomInput => ({
  sessionId: id,
  theme,
  desks: Array.from({ length: n }, (_, i) => ({ title: `Tâche ${i + 1}`, state: (['working', 'done', 'failed'] as const)[i % 3]!, hue: i + 1, done: 1, total: 3, live: true })),
  manager: { working: true, done: 1, total: 3, live: true },
  previous: n,
  steps: [{ text: 'Lire', status: 'completed' }, { text: 'Faire', status: 'in_progress' }, { text: 'Tester', status: 'pending' }],
  tokens: 128_400,
  cost: 1.24,
  width: 780,
  height: 760,
  settings: true,
  hearth: { fire: 'full', ash: 'small', letter: null, panel: null },
  ...over,
})

for (const theme of THEMES) {
  test(`${theme}: every room stays under the engine's limit`, { timeoutMs: 120000 }, async () => {
    for (const n of [0, 1, 3, 6, 16]) {
      for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        for (const [width, height] of [[780, 760], [540, 420]] as const) {
          const p = room(theme, n, id, { width, height })
          expect(roomBackSvg(p).length, `${n} agents, ${id}, the back`).toBeLessThan(LIMIT)
          expect(roomSvg(p).length, `${n} agents, ${id}, whole`).toBeLessThan(LIMIT)
        }
      }
    }
  })

  test(`${theme}: every desk stands whole in the room, apart from the others`, async () => {
    for (let n = 0; n <= 16; n += 1) {
      const all = [managerBox(n, 780, 760, theme), ...deskBoxes(n, 780, 760, theme)]
      for (const b of all) expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= 780 && b.y + b.h <= 760, `${n}: ${JSON.stringify(b)}`).toBe(true)
      all.forEach((a, i) => all.slice(i + 1).forEach(b => expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${n}: ${JSON.stringify([a, b])}`).toBe(true)))
    }
  })

  test(`${theme}: the hearth draws every fire and every ash`, async () => {
    const { hearth } = packOf(theme)
    for (const level of FIRES) {
      expect(hearth.frames(level), level).toBeGreaterThan(0)
      for (let frame = 0; frame < hearth.frames(level); frame += 1) expect(typeof hearth.flames(level, frame)).toBe('string')
      expect(fireLayer(room(theme, 1), level).source).toContain('<svg')
    }
    for (const level of ASHES) expect(labelsSvg(room(theme, 1, 'a', { hearth: { fire: 'low', ash: level, letter: null, panel: null } }))).toContain('<svg')
  })

  test(`${theme}: the screen, the plate, the board and the basket are in every room`, async () => {
    for (const id of ['a', 'b', 'c', 'd']) {
      const svg = roomSvg(room(theme, 2, id))
      for (const part of ['href="#tele"', 'href="#plaque"', 'href="#tableau-', 'href="#basket"']) expect(svg, part).toContain(part)
    }
  })

  test(`${theme}: the amount shows only when there is one`, async () => {
    expect(roomCountSvg(room(theme, 1))).toContain('transform="translate(')
    expect(roomCountSvg(room(theme, 1, 'a', { cost: null })).length).toBeLessThan(roomCountSvg(room(theme, 1)).length)
  })

  test(`${theme}: a room of the same conversation draws the same, another may not`, async () => {
    expect(roomSvg(room(theme, 2, 'same'))).toBe(roomSvg({ ...room(theme, 2, 'same') }))
    expect(new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(id => roomBackSvg(room(theme, 2, id)))).size, 'six conversations').toBeGreaterThan(2)
  })

  test(`${theme}: the small drawings of a room stay small`, async () => {
    for (const l of deskLayers(room(theme, 3), ['a', 'b', 'c'])) expect(l.source.length, l.key).toBeLessThan(40_000)
    for (const l of decorLayers(room(theme, 3))) expect(l.source.length, l.key).toBeLessThan(60_000)
  })
}
