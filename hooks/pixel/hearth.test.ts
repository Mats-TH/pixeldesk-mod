import { expect, test } from 'claude-code/testing'

import { ASH_LEVELS, ENVELOPE_STATES, FIRE_LEVELS, KEEPER_FEET, KEEPER_POSES, STOVE_DEPOSIT, ash, ashFrames, envelope, fire, fireFrames, flue, keeper, keeperFrames, stove } from './hearth'
import type { Sprite } from './hearth'

/** The paints of the components in the design file, written out here so that a typo in the art cannot pass. */
const DESIGN = new Set([
  '#2A2036', '#6A6E8C', '#565A78', '#484C66', '#3F4258', '#A8B0C8', '#1B1730', '#9DB4FF', '#4A2C2A', '#6B4030', '#8A5A3A', '#A97A4E', '#C99A68',
  '#C98B3C', '#C9A24A', '#D8C49E', '#FFF6DE', '#F9F1DE', '#B8452A', '#E4633A', '#FFC857', '#A59A90', '#D6CFC4', '#8A8078', '#7A6A5E',
  '#C75A4E', '#D9786A', '#A84640', '#F0C8A0', '#CD9D81', '#1F1A2E', '#EB8A6B', '#6F5036', '#3F6C8C', '#2C5068', '#5A8CAE',
  '#1B1730|0.28', '#FFC857|0.22', '#FFF6DE|0.5', '#FFC857|0.45',
])

/** Past this a sprite would no longer be compact; the engine's own limit is 131 072. */
const MOST = 6000

const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const allFires = () => FIRE_LEVELS.flatMap(level => range(fireFrames(level)).map(i => ({ name: `fire ${level} ${i}`, s: fire(level, i) })))
const allAsh = () => ASH_LEVELS.flatMap(level => range(ashFrames(level)).map(i => ({ name: `ash ${level} ${i}`, s: ash(level, i) })))
const allKeepers = () => KEEPER_POSES.flatMap(pose => range(keeperFrames(pose)).map(i => ({ name: `keeper ${pose} ${i}`, s: keeper(pose, i) })))
const allSprites = () => [
  { name: 'stove', s: stove() },
  { name: 'flue', s: flue() },
  ...allFires(),
  ...allAsh(),
  ...allKeepers(),
  ...ENVELOPE_STATES.map(state => ({ name: `envelope ${state}`, s: envelope(state) })),
]

const fills = (s: Sprite) => [...s.svg.matchAll(/<path fill="([^"]+)"(?: fill-opacity="([^"]+)")? d="([^"]*)"/g)]

test('every level has the images of the design', async () => {
  expect(FIRE_LEVELS.map(fireFrames)).toEqual([3, 3, 2, 2, 2])
  expect(ASH_LEVELS.map(ashFrames)).toEqual([1, 1, 1, 1, 2])
  expect(KEEPER_POSES.map(keeperFrames)).toEqual([2, 2, 2, 2, 2])
  expect(allSprites().length).toBe(2 + 12 + 6 + 10 + 3)
})

test('the images of a level differ, and the sequence starts over after the last', async () => {
  for (const level of FIRE_LEVELS) {
    const images = range(fireFrames(level)).map(i => fire(level, i).svg)
    expect(new Set(images).size, level).toBe(images.length)
    expect(fire(level, images.length).svg, `${level} wraps`).toBe(images[0])
  }
  for (const pose of KEEPER_POSES) expect(keeper(pose, 0).svg === keeper(pose, 1).svg, pose).toBe(false)
  expect(ash('full', 0).svg === ash('full', 1).svg).toBe(false)
  expect(ash('full', 2).svg).toBe(ash('full', 0).svg)
  expect(ash('small', 7).svg, 'one image holds').toBe(ash('small', 0).svg)
})

test('the levels are different drawings', async () => {
  expect(new Set(FIRE_LEVELS.map(level => fire(level, 0).svg)).size).toBe(FIRE_LEVELS.length)
  expect(new Set(ASH_LEVELS.map(level => ash(level, 0).svg)).size).toBe(ASH_LEVELS.length)
  expect(new Set(KEEPER_POSES.map(pose => keeper(pose, 0).svg)).size).toBe(KEEPER_POSES.length)
  expect(new Set(ENVELOPE_STATES.map(state => envelope(state).svg)).size).toBe(ENVELOPE_STATES.length)
})

test('dimensions, in cells of the grid', async () => {
  const size = (s: Sprite) => [s.w, s.h]
  expect(size(stove())).toEqual([48, 68])
  expect(size(flue())).toEqual([27, 26])
  for (const { name, s } of allFires()) expect(size(s), name).toEqual([48, 68])
  for (const { name, s } of allAsh()) expect(size(s), name).toEqual([48, 20])
  for (const { name, s } of allKeepers()) expect(size(s), name).toEqual([30, 32])
  for (const state of ENVELOPE_STATES) expect(size(envelope(state)), state).toEqual([14, 11])
})

test('each svg says its size, at 2 pixels of the room a cell', async () => {
  for (const { name, s } of allSprites()) {
    expect(s.svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w * 2}" height="${s.h * 2}" viewBox="0 0 ${s.w} ${s.h}" shape-rendering="crispEdges">`), name).toBe(true)
    expect(s.svg.endsWith('</svg>'), name).toBe(true)
  }
})

test('no shape leaves its grid', async () => {
  for (const { name, s } of allSprites()) {
    for (const [, , , d] of fills(s)) {
      for (const [, x, y, w, h] of d!.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+/g)) {
        expect(Number(x) + Number(w) <= s.w && Number(y) + Number(h) <= s.h, `${name} ${x} ${y}`).toBe(true)
      }
    }
  }
})

test('the stacked pieces share one anchor', async () => {
  const base = { x: 24, y: 61 }
  expect(stove().anchor).toEqual(base)
  expect(flue().anchor).toEqual(base)
  for (const { name, s } of allFires()) expect(s.anchor, name).toEqual(base)
  for (const { name, s } of allAsh()) expect(s.anchor, name).toEqual({ x: 24, y: 13 })
})

test('the keeper stands still between two poses', async () => {
  for (const { name, s } of allKeepers()) expect(s.anchor, name).toEqual({ x: 0, y: 22 })
  expect(KEEPER_FEET.y < 32 && KEEPER_FEET.x < 30).toBe(true)
  expect(STOVE_DEPOSIT.x < 48 && STOVE_DEPOSIT.y < 68).toBe(true)
})

test('no colour out of the design', async () => {
  for (const { name, s } of allSprites()) {
    for (const [, fill, opacity] of fills(s)) expect(DESIGN.has(opacity ? `${fill}|${opacity}` : fill!), `${name} ${fill} ${opacity}`).toBe(true)
    expect(s.svg.match(/#[0-9a-fA-F]{3,8}/g)?.length ?? 0, `${name} has no colour outside a path`).toBe(fills(s).length)
  }
})

test('only the empty ash draws nothing', async () => {
  for (const { name, s } of allSprites()) expect(fills(s).length > 0, name).toBe(name !== 'ash none 0')
})

test('every sprite stays compact', async () => {
  for (const { name, s } of allSprites()) expect(s.svg.length <= MOST, `${name}: ${s.svg.length}`).toBe(true)
})

test('fixed drawings: no path on the floor, no animation, no interaction', async () => {
  for (const { name, s } of allSprites()) {
    for (const word of ['stroke', 'dasharray', '<animate', 'isInteractive', 'class=']) expect(s.svg.includes(word), `${name} ${word}`).toBe(false)
  }
})

test('same call, same drawing', async () => {
  expect(fire('full', 1)).toEqual(fire('full', 1))
  expect(keeper('sweep', 1)).toEqual(keeper('sweep', 1))
})
