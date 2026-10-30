import { FONT_SIZE, GLYPHS, SPACE, UNIT } from './font-data'

/** The size at which one cell of the font is one screen pixel: the only size that stays sharp. */
export const SHARP = FONT_SIZE / UNIT

const scaleOf = (size: number) => (size / FONT_SIZE) * UNIT
const advance = (ch: string) => GLYPHS[ch]?.[0] ?? SPACE
const round = (n: number) => Math.round(n * 100) / 100

export function textWidth(s: string, size: number): number {
  return [...s].reduce((n, ch) => n + advance(ch), 0) * scaleOf(size)
}

/** One path per glyph, drawn from the top left corner of the line at (x, y). */
export function text(s: string, x: number, y: number, size: number, fill: string): string {
  const k = scaleOf(size)
  const sharp = Math.abs(k - 1) < 1e-6
  const place = sharp ? Math.round : round
  const scale = sharp ? '' : ` scale(${Math.round(k * 10000) / 10000})`
  let at = 0
  let out = ''
  for (const ch of s) {
    const glyph = GLYPHS[ch]
    if (glyph) {
      const [, dx, dy, d] = glyph
      out += `<path fill="${fill}" transform="translate(${place(x + (at + dx) * k)} ${place(y + dy * k)})${scale}" d="${d}"/>`
    }
    at += advance(ch)
  }
  return out
}

/** Cuts `s` with an ellipsis so it fits in `max` pixels. */
export function fit(s: string, size: number, max: number): string {
  if (textWidth(s, size) <= max) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(`${out}${ch}…`, size) > max) break
    out += ch
  }
  return `${out}…`
}

/** `s` on at most `lines` lines of `max` pixels, broken between words; the end of what does not fit is cut. */
export function wrap(s: string, size: number, max: number, lines: number): string[] {
  const rows: string[] = []
  let row = ''
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = row ? `${row} ${word}` : word
    if (textWidth(next, size) <= max) row = next
    else {
      if (row) rows.push(row)
      row = word
    }
  }
  if (row) rows.push(row)
  const kept = rows.slice(0, lines - 1)
  const rest = rows.slice(lines - 1).join(' ')
  return (rest ? [...kept, rest] : kept).map(r => fit(r, size, max))
}
