import { expect, test } from 'claude-code/testing'

import { drawRoom, seedOf } from './draw'
import type { Box, RoomFit } from './draw'

const crosses = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The cells a room of that size and board leaves free, as room.ts works them out. */
function fitOf(w: number, h: number, boardW: number, boardH: number): RoomFit {
  const board = { x: w - 5 - boardW, y: 7, w: boardW + 2, h: boardH + 4 }
  return { w, h, board, tele: { x: board.x - 41, y: 18, w: 36, h: 30 }, rug: { x: w / 2 - 80, y: 107, w: 160, h: 58 } }
}
const FITS = [215, 270, 307, 340, 433, 600].flatMap(w => [49, 75].flatMap(boardH => [48, 82].map(boardW => fitOf(w, 210, boardW, boardH))))

test('same session, same room', async () => {
  expect(drawRoom('abc')).toEqual(drawRoom('abc'))
})

test('different sessions make varied rooms', async () => {
  const rooms = new Set(Array.from({ length: 200 }, (_, i) => JSON.stringify(drawRoom(`session-${i}`))))
  expect(rooms.size > 150, String(rooms.size)).toBe(true)
})

test('no decoration overflows its slot', async () => {
  for (let i = 0; i < 300; i += 1) {
    for (const item of [...drawRoom(`s${i}`).wall, ...drawRoom(`s${i}`).floor]) {
      expect(item.w <= item.slotW, `${item.id} in ${item.slotW}`).toBe(true)
    }
  }
})

test('at every width, wall decorations stay left of the screen', { timeoutMs: 30000 }, async () => {
  for (const fit of FITS) {
    for (let i = 0; i < 80; i += 1) {
      const { wall } = drawRoom(`s${i}`, fit)
      for (const it of wall) {
        expect(it.x >= 0 && it.x + it.w <= fit.tele.x, `${it.id} at ${it.x} in ${fit.w}`).toBe(true)
        expect(crosses(it, fit.board), `${it.id} under the board`).toBe(false)
      }
      for (const a of wall) {
        for (const b of wall) {
          if (a !== b && a.id !== 'guirlande' && b.id !== 'guirlande') expect(crosses(a, b), `${a.id} over ${b.id}`).toBe(false)
        }
      }
    }
  }
})

test('at every width, no furniture hides the screen or the board', async () => {
  for (const fit of FITS) {
    for (let i = 0; i < 80; i += 1) {
      for (const it of drawRoom(`s${i}`, fit).floor) {
        expect(crosses(it, fit.tele), `${it.id} before the screen in ${fit.w}`).toBe(false)
        expect(crosses(it, fit.board), `${it.id} before the board in ${fit.w}`).toBe(false)
      }
    }
  }
})

test('a piece of furniture backs away from a growing board instead of hiding it', async () => {
  const rug = { x: 40, y: 150, w: 100, h: 40 }
  const short = { ...fitOf(307, 200, 62, 49), rug }
  const tall = { ...fitOf(307, 200, 62, 75), rug }
  const sofa = (fit: RoomFit, i: number) => drawRoom(`s${i}`, fit).floor.find(it => it.id === 'canape' && it.x > 200)
  const moved = Array.from({ length: 60 }, (_, i) => {
    const [before, after] = [sofa(short, i), sofa(tall, i)]
    return !!before && !!after && after.y > before.y
  })
  expect(moved.some(Boolean)).toBe(true)
})

test('furniture does not overlap and stays in the room', async () => {
  for (const fit of FITS) {
    for (let i = 0; i < 80; i += 1) {
      const { floor } = drawRoom(`s${i}`, fit)
      for (const a of floor) {
        expect(a.x >= 0 && a.x + a.w <= fit.w && a.y + a.h <= fit.h, `${a.id} in ${fit.w}`).toBe(true)
        for (const b of floor) if (a !== b) expect(crosses(a, b), `${a.id} over ${b.id}`).toBe(false)
      }
    }
  }
})

test('the seed is stable', async () => {
  expect(seedOf('abc')).toBe(seedOf('abc'))
  expect(seedOf('abc') === seedOf('abd')).toBe(false)
})

test('furniture never hides what is on the wall', async () => {
  for (let i = 0; i < 300; i += 1) {
    const room = drawRoom(`s${i}`)
    for (const f of room.floor) {
      for (const w of room.wall) {
        const hides = f.x < w.x + w.w && w.x < f.x + f.w && f.y + 10 < w.y + w.h
        expect(hides, `${f.id} before ${w.id}`).toBe(false)
      }
    }
  }
})

const cornered = (w: number, corner: number): RoomFit => ({ ...fitOf(w, 210, 48, 49), corner })

test('no wall decor in the button corner, at any width and in any draw', async () => {
  for (const w of [270, 308, 340, 390, 424, 500]) {
    const corner = Math.ceil(26 * (w / 390))
    for (let i = 0; i < 200; i += 1) {
      for (const it of drawRoom(`s${i}`, cornered(w, corner)).wall) expect(it.x >= corner, `${it.id} at ${it.x} in ${w}`).toBe(true)
    }
  }
})

test('in the worst draw, a tight wall stays short of the screen, decor at least 2 cells apart', async () => {
  for (const w of [270, 308, 390]) {
    for (let i = 0; i < 200; i += 1) {
      const fit = cornered(w, 18)
      const hung = drawRoom(`s${i}`, fit).wall.filter(it => it.id !== 'guirlande' && it.id !== 'suspendue').sort((a, b) => a.x - b.x)
      hung.forEach((it, k) => {
        expect(it.x + it.w <= fit.tele.x, `${it.id} before the screen`).toBe(true)
        if (k) expect(it.x - (hung[k - 1]!.x + hung[k - 1]!.w) >= 2, `${i} : ${it.id}`).toBe(true)
      })
    }
  }
})

test('with no button, the wall starts where it always did', async () => {
  expect(drawRoom('abc', fitOf(390, 210, 48, 49))).toEqual(drawRoom('abc', { ...fitOf(390, 210, 48, 49), corner: 0 }))
})
