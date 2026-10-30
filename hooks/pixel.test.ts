import { expect, test } from 'claude-code/testing'

import { canvas, mix, paths } from './pixel/canvas'
import { GLYPHS } from './pixel/font-data'
import { SHARP, fit, text, textWidth, wrap } from './pixel/font'

test('pixels of one color on a line make one run', async () => {
  const c = canvas(4, 2)
  c.rect(0, 0, 3, 1, '#ff0000')
  expect(paths(c), 'at scale 1').toBe('<path fill="#ff0000" d="M0 0h3v1h-3"/>')
  expect(paths(c, 2), 'at scale 2').toBe('<path fill="#ff0000" d="M0 0h6v2h-6"/>')
})

test('one run on several lines becomes one rectangle', async () => {
  const c = canvas(3, 3)
  c.rect(1, 0, 2, 3, '#ff0000')
  expect(paths(c)).toBe('<path fill="#ff0000" d="M1 0h2v3h-2"/>')
})

test('a color with opacity becomes fill-opacity', async () => {
  const c = canvas(1, 1)
  c.set(0, 0, '#000000|0.3')
  expect(paths(c)).toBe('<path fill="#000000" fill-opacity="0.3" d="M0 0h1v1h-1"/>')
})

test('a pixel off the grid is ignored', async () => {
  const c = canvas(1, 1)
  c.set(5, 5, '#ff0000')
  expect(paths(c)).toBe('')
})

test('sprite: a letter with no color stays transparent', async () => {
  const c = canvas(2, 1)
  c.sprite(['a.'], { a: '#00ff00' }, 0, 0)
  expect(c.get(0, 0)).toBe('#00ff00')
  expect(c.get(1, 0)).toBe(null)
})

test('mix gives the color in the middle', async () => {
  expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
})

test('the width adds up the glyphs, spaces included', async () => {
  expect(textWidth('', 16)).toBe(0)
  expect(textWidth('a b', 16) > textWidth('ab', 16), 'space').toBe(true)
  expect(textWidth('ab', 8), 'proportional').toBe(textWidth('ab', 16) / 2)
})

test('an unknown character counts as a space and does not break the drawing', async () => {
  expect(text('🦀', 0, 0, 16, '#000000')).toBe('')
  expect(textWidth('🦀', 16) > 0).toBe(true)
})

test('text draws one path per glyph, in the right position', async () => {
  const out = text('Té', 10, 20, 16, '#112233')
  expect(out.match(/<path /g)?.length, 'two glyphs').toBe(2)
  expect(out, 'color').toContain('fill="#112233"')
  const dy = Math.round((20 + GLYPHS.T![2] * (6 / 7)) * 100) / 100
  expect(out, 'position').toContain(`translate(10 ${dy})`)
})

test('every French character of the mod exists in the font', async () => {
  for (const ch of 'àâçéèêëîïôöùûüÀÂÉÈÊÎÔÙÇœŒ·…%:') expect(GLYPHS[ch], ch).toBeDefined()
})

test('fit cuts with an ellipsis without overflowing', async () => {
  const cut = fit('Un titre beaucoup trop long pour la plaque', 16, 80)
  expect(cut.endsWith('…'), cut).toBe(true)
  expect(textWidth(cut, 16) <= 80, cut).toBe(true)
  expect(fit('Court', 16, 80)).toBe('Court')
})

test('wrap breaks lines between words, without overflowing', async () => {
  const rows = wrap('Vérifie que chaque bouton du panneau réagit comme prévu.', 20, 230, 4)
  expect(rows.length, rows.join(' / ')).toBe(2)
  expect(rows.join(' ')).toBe('Vérifie que chaque bouton du panneau réagit comme prévu.')
  for (const row of rows) expect(textWidth(row, 20) <= 230, row).toBe(true)
  expect(wrap('', 20, 230, 4), 'empty text').toEqual([])
  expect(wrap('  deux   espaces ', 20, 230, 4), 'spaces reduced').toEqual(['deux espaces'])
})

test('wrap cuts what passes the number of lines, and words too long', async () => {
  const rows = wrap('un mot puis un autre mot puis encore un autre mot', 16, 60, 2)
  expect(rows).toHaveLength(2)
  expect(rows[1]!.endsWith('…'), rows[1]!).toBe(true)
  const long = wrap('Anticonstitutionnellement', 16, 40, 2)
  expect(textWidth(long[0]!, 16) <= 40, long[0]!).toBe(true)
})

test('at the sharp size each glyph lands on a whole pixel, with no scaling', async () => {
  const out = text('Tâches 2/4', 7, 3, SHARP, '#000000')
  expect(out.includes('scale('), 'no scale').toBe(false)
  for (const m of out.matchAll(/translate\(([^ ]+) ([^)]+)\)/g)) {
    expect(Number.isInteger(Number(m[1])), m[1]!).toBe(true)
    expect(Number.isInteger(Number(m[2])), m[2]!).toBe(true)
  }
})
