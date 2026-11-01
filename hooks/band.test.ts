import { expect, test } from 'claude-code/testing'

import { bandAlt, bandSvg, idleAlt, idleSvg, overviewAlt, overviewLine, overviewSvg } from './band'
import type { BandInput, IdleInput, OverviewInput } from './band'
import type { Gauge } from './limits'

const on = (used: number, mark: number): Gauge => ({ label: '5 H', used, mark, percent: String(used) + '%', at: '12:40' })
const none: Gauge = { label: '7 J', used: null, mark: null, percent: '--', at: '--:--' }
const steps = (done: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({ text: `Étape ${i + 1}`, status: i < done ? 'completed' : i === done ? 'in_progress' : 'pending' }) as BandInput['steps'][number])
const input = (over: Partial<BandInput> = {}): BandInput => ({ title: 'Plan', steps: steps(2, 4), gauges: [on(28, 75), none], width: 720, night: true, ...over })

test('same state, same drawing', async () => {
  expect(bandSvg(input())).toBe(bandSvg(input()))
})

test('the drawing stays under the engine limit, even very wide', async () => {
  for (const night of [true, false]) {
    const size = bandSvg(input({ width: 1600, night, gauges: [on(78, 55), on(52, 55)] })).length
    expect(size < 131_072, `size ${size}`).toBe(true)
  }
})

test('a mark that moves by less than a notch leaves the drawing alone', async () => {
  const a = bandSvg(input({ gauges: [on(28, 75.1), none] }))
  const b = bandSvg(input({ gauges: [on(28, 75.2), none] }))
  expect(a).toBe(b)
})

test('going past the mark draws the coral part', async () => {
  expect((bandSvg(input({ gauges: [on(78, 55), none] })).match(/#E4633A/g) ?? []).length, 'ahead').toBe(2)
  expect((bandSvg(input({ gauges: [on(28, 75), none] })).match(/#E4633A/g) ?? []).length, 'only the character stays coral').toBe(1)
})

test('a narrow width and a finished plan draw without error', async () => {
  expect(bandSvg(input({ width: 420, steps: steps(4, 4) })), 'finished plan').toContain('<svg')
  expect(bandSvg(input({ steps: [] })), 'empty plan').toContain('<svg')
})

test('the text alternative says everything the drawing shows', async () => {
  const alt = bandAlt(input())
  expect(alt).toContain('Plan')
  expect(alt).toContain('Tâches 2/4')
  expect(alt).toContain('50%')
  expect(alt).toContain('En cours : Étape 3')
  expect(alt).toContain('5 H 28% 12:40')
  expect(alt).toContain('7 J --')
})

const FIVE: OverviewInput['states'] = ['done', 'working', 'working', 'failed', 'working']
const view = (over: Partial<OverviewInput> = {}): OverviewInput => ({ states: FIVE, agents: 7, news: 2, gauges: [on(28, 75), none], width: 750, night: true, ...over })
const railBoxes = (svg: string) => [...svg.matchAll(/M(\d+) 62h(\d+)v8h-\d+z/g)].map(m => [Number(m[1]), Number(m[2])]).sort((a, b) => a[0]! - b[0]!)

test('the overview counts the conversations at work and their agents', async () => {
  expect(overviewLine(view())).toBe('3 conversations sur 5 au travail, 7 agents')
  expect(overviewLine(view({ states: ['working'], agents: 1 })), 'in the singular').toBe('1 conversation sur 1 au travail, 1 agent')
  expect(overviewLine(view({ states: ['done', 'failed'], agents: 0 })), 'no agent').toBe('0 conversation sur 2 au travail')
})

test('it keeps the height, the world and the gauges of the band', async () => {
  const svg = overviewSvg(view())
  expect(svg, 'the height').toContain('width="750" height="80" viewBox="0 0 750 80"')
  expect(svg, 'the walker').toContain('class="h"')
  expect(svg, 'the clouds').toContain('class="n"')
  expect(svg, 'reduced motion').toContain('prefers-reduced-motion')
  const end = bandSvg(input({ width: 750 })).slice(-1500)
  expect(svg.slice(-1500), 'the same gauges').toBe(end)
})

test('one cell per sub-conversation: gold at work, green done, red stopped', async () => {
  const svg = overviewSvg(view())
  const boxes = railBoxes(svg)
  expect(boxes, 'five cells').toHaveLength(5)
  expect(boxes[0]![0], 'start of the design').toBe(40)
  expect(boxes[4]![0]! + boxes[4]![1]!, 'end of the design').toBe(460)
  expect(svg, 'the background').toContain('<rect x="38" y="60" width="424" height="12" fill="#1B1730"/>')
  expect(/<path fill="#8CC265" d="M40 62h/.test(svg), 'the first is green').toBe(true)
  expect(svg, 'the red ones').toContain('<path fill="#E4633A" d="M')
  expect(svg, 'the gold ones').toContain('<path fill="#FFC857" d="M')
})

test('past 12, a continuous strip that follows the true share of each state', async () => {
  const states: OverviewInput['states'] = Array.from({ length: 14 }, (_, i) => (i % 7 === 0 ? 'failed' : i % 2 ? 'working' : 'done'))
  const boxes = railBoxes(overviewSvg(view({ states })))
  expect(boxes, 'one block per state').toHaveLength(3)
  boxes.slice(1).forEach(([x], i) => expect(x, 'no gap').toBe(boxes[i]![0]! + boxes[i]![1]!))
  expect(railBoxes(overviewSvg(view({ states: states.slice(0, 12) }))), '12: still cells').toHaveLength(12)
})

test('the envelope and the counter stay by the flag, and go when there is no news', async () => {
  const svg = overviewSvg(view())
  expect(svg, 'the envelope of the design').toContain('<g transform="translate(456 6)">')
  expect(svg, 'the counter of the design').toContain('<rect x="479" y="3" width="21" height="20" rx="2" fill="#1B1730"/>')
  const quiet = overviewSvg(view({ news: 0 }))
  expect(quiet.includes('translate(456 6)'), 'no envelope').toBe(false)
  expect(/<rect[^>]*#B8452A/.test(quiet), 'no counter').toBe(false)
  const wide = Number(/<rect x="479" y="3" width="(\d+)"/.exec(overviewSvg(view({ news: 128 })))?.[1])
  expect(wide > 21, 'the true number, wider').toBe(true)
})

test('the text alternative says everything, with no cumulated percentage', async () => {
  const alt = overviewAlt(view())
  expect(alt).toBe('Vue d’ensemble : 3 conversations sur 5 au travail, 7 agents. 2 nouvelles. 5 H 28% 12:40, 7 J -- --:--')
  expect(overviewAlt(view({ news: 1 })), 'in the singular').toContain('1 nouvelle.')
  expect(overviewAlt(view({ news: 0 })).includes('nouvelle'), 'no news').toBe(false)
})

test('the band stays under the limit and repeats identically, wide or narrow', async () => {
  const states: OverviewInput['states'] = Array.from({ length: 16 }, (_, i) => (i % 2 ? 'working' : 'done'))
  for (const night of [true, false]) {
    const size = overviewSvg(view({ states, width: 1600, night })).length
    expect(size < 131_072, `size ${size}`).toBe(true)
  }
  expect(overviewSvg(view())).toBe(overviewSvg(view()))
  expect(overviewSvg(view({ width: 420 })), 'narrow').toContain('<svg')
})

const rest = (over: Partial<IdleInput> = {}): IdleInput => ({ gauges: [on(28, 75), none], width: 750, night: true, ...over })

test('at rest: the height, the world and the gauges of the band, with no flag', async () => {
  const svg = idleSvg(rest())
  expect(svg, 'the height').toContain('width="750" height="80" viewBox="0 0 750 80"')
  expect(svg, 'the clouds').toContain('class="n"')
  const end = bandSvg(input({ width: 750 })).slice(-1500)
  expect(svg.slice(-1500), 'the same gauges').toBe(end)
  expect(svg.includes('#D1495B'), 'no flag').toBe(false)
  expect(svg.includes('#E8C27A'), 'a path with no progress').toBe(false)
  expect(svg, 'the plate of the design').toContain('<g transform="translate(6 1)"><path fill="#4A2C2A" d="M0 0h78v')
})

test('at rest: the crab walks the path alone, and stops under reduced motion', async () => {
  const svg = idleSvg(rest())
  expect(svg.match(/<animateTransform /g), 'a single trip').toHaveLength(1)
  expect(svg, 'forever').toContain('repeatCount="indefinite"')
  const xs = [.../(?:^|;)(\d+) 46/g[Symbol.matchAll](/values="([^"]+)"/.exec(svg)![1]!)].map(m => Number(m[1]))
  expect(xs[0], 'it leaves from its place in the design').toBe(236)
  expect(xs[xs.length - 1], 'and comes back to it').toBe(236)
  expect(Math.max(...xs) + 40 <= 470, 'it stops before the panel').toBe(true)
  expect(Math.min(...xs) >= 12, 'and at the start of the path').toBe(true)
  expect(idleSvg(rest({ night: false })), 'by day, its place in the design').toContain('values="150 46;')
  expect(svg, 'the crab standing still').toContain('<g class="cs" transform="translate(236 46)">')
  expect(svg, 'in place of the walking crab').toContain('@media (prefers-reduced-motion: reduce){.cw{display:none}.cs{display:inline}}')
})

test('at rest, same state, same drawing, and it weighs what a band weighs', async () => {
  expect(idleSvg(rest())).toBe(idleSvg(rest()))
  for (const night of [true, false]) {
    for (const width of [420, 750, 1600]) {
      const size = idleSvg(rest({ width, night })).length
      const band = bandSvg(input({ width, night })).length
      expect(size < band * 1.2, `${size} against ${band}`).toBe(true)
      expect(size < 131_072, `size ${size}`).toBe(true)
    }
  }
})

test('at rest, the text alternative says the plate and the gauges', async () => {
  expect(idleAlt(rest())).toBe('Au repos. 5 H 28% 12:40, 7 J -- --:--')
})

test('a cloud is gone before it reaches the wood of the gauges', async () => {
  const [width, sky, cloud] = [1280, 1280 - 232, 52]
  const drawn = [bandSvg(input({ width })), overviewSvg({ states: ['working'], agents: 1, news: 0, gauges: [on(28, 75), none], width, night: false }), idleSvg({ gauges: [on(28, 75), none], width, night: false })]
  for (const svg of drawn) {
    const keyframes = /@keyframes cl\{[^@]*?\}\}/.exec(svg)![0]
    const end = Number(/translateX\((\d+)px\);opacity:0/.exec(keyframes)?.[1])
    expect(end + cloud < sky, `its nose stops at ${end + cloud}, the wood starts at ${sky}`).toBe(true)
    expect(keyframes, 'it fades before that').toContain('94%{opacity:1}')
  }
})
