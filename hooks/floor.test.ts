import { expect, test } from 'claude-code/testing'

import type { RoomTheme } from '../types'
import { roomCard } from './card'
import { floorBoxes, floorCountSvg, floorSvg, shownRooms } from './floor'
import type { FloorRoom } from './desks'
import { setLanguage } from './i18n'
import { letterUses } from './pixel/text'
import { packOf } from './pixel/themes'

const THEMES: RoomTheme[] = ['cosy', 'japonais', 'nature', 'futuriste', 'geek', 'base']
const desks = (i: number, n: number): FloorRoom['desks'] => Array.from({ length: n }, (_, k) => ({ title: `Tâche ${k + 1}`, state: k % 3 === 1 ? 'done' : 'working', hue: i + k }))
const room = (i: number, agents = 1): FloorRoom => ({ id: `s${i}`, title: `Conversation ${i}`, agents, working: agents, summary: 'Travaille', desks: desks(i, agents), steps: [{ text: 'Lire', status: 'in_progress' }], tokens: 1000 * i })
const rooms = (n: number) => Array.from({ length: n }, (_, i) => room(i, i % 3))
const floor = (theme: RoomTheme, r: FloorRoom[], news = { shown: 0, flying: false }, over = {}) => ({ rooms: r, previous: r.length, width: 800, height: 600, news, theme, ...over })

test('the world keeps the one that leads, then those at work first', async () => {
  const shown = shownRooms(rooms(20))
  expect(shown).toHaveLength(11)
  expect(shown[0]!.id, 'the one that leads').toBe('s0')
  expect(shown.slice(1).every(r => r.working > 0), 'those at work').toBe(true)
  expect(shownRooms(rooms(5)).map(r => r.id), 'with room for all, the same order').toEqual(['s0', 's1', 's2', 's3', 's4'])
})

test('past eleven, the world says how many it leaves out', async () => {
  expect(floorSvg(floor('cosy', rooms(11))).length).toBeLessThan(floorSvg(floor('cosy', rooms(14))).length)
})

// The themes that write the name on the desk of the conversation that leads.
for (const theme of ['cosy', 'nature', 'geek'] as const) {
  test(`${theme}: the name on the desk that leads is its conversation's`, async () => {
    const letters = (sub: boolean) => floorSvg(floor(theme, [{ ...room(0, 0), sub }, { ...room(1, 0), sub: true }]))
    for (const [language, first] of [['fr', '#P'], ['en', '#B']] as const) {
      setLanguage(language)
      expect(letters(false), `${language}: the main one`).toContain(`href="${first}"`)
      expect(letters(false), `${language}: the main one`).not.toContain('href="#M"')
      expect(letters(true), `${language}: started from another`).toContain('href="#M"')
      expect(letters(true), `${language}: started from another`).not.toContain(`href="${first}"`)
    }
    setLanguage('fr')
  })
}

// The themes that seat each conversation at desks of the size of the floor.
for (const theme of ['japonais', 'futuriste'] as const) {
  test(`${theme}: every desk of a floor says whose it is`, async () => {
    const seated = { title: 'Testeur', state: 'working' as const, hue: 1 }
    const main = { ...room(0, 0), manager: { working: true }, desks: [seated], agents: 1, working: 1 }
    const kid = { ...room(1, 0), manager: { working: true }, desks: [], sub: true }
    for (const [language, boss] of [['fr', 'Patron'], ['en', 'Boss']] as const) {
      setLanguage(language)
      const svg = floorSvg(floor(theme, [main, { ...kid, agents: 1 }]))
      expect(svg, `${language}: the main one`).toContain(letterUses(boss))
      expect(svg, `${language}: a sub-conversation`).toContain(letterUses('Manager'))
      expect(svg, `${language}: an agent`).toContain(letterUses('Testeur'))
    }
    setLanguage('fr')
  })
}

test('on a floor each conversation says its own name, in both languages', async () => {
  const kid = { ...room(1, 0), manager: { working: true }, sub: true }
  expect(roomCard({ ...kid, sub: false }, 0).meta, 'the one main conversation').toBe('Patron au travail')
  expect(roomCard(kid, 0).meta, 'a sub-conversation').toBe('Manager au travail')
  setLanguage('en')
  expect(roomCard({ ...kid, sub: false }, 0).meta).toBe('Boss working')
  expect(roomCard(kid, 0).meta).toBe('Manager working')
  setLanguage('fr')
})

for (const theme of THEMES) {
  test(`${theme}: same state, same drawing`, async () => {
    expect(floorSvg(floor(theme, rooms(5)))).toBe(floorSvg(floor(theme, rooms(5))))
  })

  test(`${theme}: every floor stays under the limit`, { timeoutMs: 60000 }, async () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16]) {
      for (const news of [{ shown: 0, flying: false }, { shown: 3, flying: true }]) {
        const size = floorSvg(floor(theme, rooms(n), news)).length
        expect(size, `${n} rooms: ${size}`).toBeLessThan(131_072)
      }
    }
  })

  test(`${theme}: every conversation has its whole place, apart from the others`, async () => {
    for (let n = 2; n <= 11; n += 1) {
      const all = floorBoxes(n, 780, 760, theme)
      expect(all, `${n} rooms`).toHaveLength(n)
      for (const b of all) expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= 780 && b.y + b.h <= 760, `${n}: ${JSON.stringify(b)}`).toBe(true)
      all.forEach((a, i) => all.slice(i + 1).forEach(b => expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${n}: ${JSON.stringify([a, b])}`).toBe(true)))
      const spots = packOf(theme).map.counts(n)
      expect(spots, 'a count for each').toHaveLength(n)
      all.forEach((b, i) => expect(spots[i]!.x >= b.x && spots[i]!.x <= b.x + b.w && spots[i]!.y >= b.y && spots[i]!.y <= b.y + b.h, `${n}, count ${i} in its place`).toBe(true))
    }
  })

  test(`${theme}: a place follows the pane, the world stays whole`, async () => {
    const wide = floorBoxes(4, 1560, 760, theme)
    const small = floorBoxes(4, 780, 760, theme)
    expect(wide[0]!.w, 'the same scale').toBe(small[0]!.w)
    expect(wide[0]!.x, 'centred').toBe(small[0]!.x + 390)
  })

  test(`${theme}: the tokens leave the source alone, the second image moves`, async () => {
    const a = rooms(4)
    const b = a.map(r => ({ ...r, tokens: r.tokens + 500 }))
    expect(floorSvg(floor(theme, a))).toBe(floorSvg(floor(theme, b)))
    expect(floorCountSvg(floor(theme, a)) === floorCountSvg(floor(theme, b))).toBe(false)
  })

  test(`${theme}: a conversation at rest reads differently from one at work`, async () => {
    const r = rooms(3)
    const rest = r.map((x, i) => (i === 2 ? { ...x, working: 0, agents: 0, desks: [] } : x))
    expect(floorSvg(floor(theme, r)) === floorSvg(floor(theme, rest))).toBe(false)
  })

  test(`${theme}: the news show their number, and one on its way moves`, async () => {
    const r = rooms(3)
    const none = floorSvg(floor(theme, r))
    expect(floorSvg(floor(theme, r, { shown: 2, flying: false })) === none, 'a count').toBe(false)
    expect(floorSvg(floor(theme, r, { shown: 2, flying: true })) === floorSvg(floor(theme, r, { shown: 2, flying: false })), 'a flight').toBe(false)
  })

  test(`${theme}: a new conversation fades in and the world zooms out`, async () => {
    const svg = floorSvg(floor(theme, rooms(4), undefined, { previous: 3 }))
    expect(svg).toContain('attributeName="viewBox"')
    expect(svg).toContain('attributeName="opacity"')
  })
}
