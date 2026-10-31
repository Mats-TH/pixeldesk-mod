import { paths } from './canvas'
import type { Canvas } from './canvas'
import { FONT_SIZE, GLYPHS, SPACE, UNIT } from './font-data'
import { PX } from './pack'

export const def = (id: string, c: Canvas) => `<g id="${id}" transform="scale(${PX})">${paths(c)}</g>`
export const use = (id: string, x = 0, y = 0) => `<use href="#${id}"${x ? ` x="${x}"` : ''}${y ? ` y="${y}"` : ''}/>`

// Letters and digits take one character as an id: a floor writes thousands of them.
const letterId = (ch: string) => (/[a-zA-Z]/.test(ch) ? ch : `g${ch.codePointAt(0)}`)

/** One definition per letter, each carrying its own offset: a line only says how far along it is. */
export function letterDefs(s: string): string {
  return [...new Set(s)].filter(ch => GLYPHS[ch]).map(ch => {
    const [, dx, dy, d] = GLYPHS[ch]!
    return `<path id="${letterId(ch)}" transform="translate(${dx} ${dy})" d="${d}"/>`
  }).join('')
}

export function letterUses(s: string) {
  let at = 0
  let out = ''
  for (const ch of s) {
    const glyph = GLYPHS[ch]
    if (glyph) out += use(letterId(ch), at)
    at += glyph?.[0] ?? SPACE
  }
  return out
}

export const fontScale = (size: number) => Math.round((size / FONT_SIZE) * UNIT * 10000) / 10000

/** A line of text through `letterDefs`, from the top left corner at (x, y). */
export function line(s: string, x: number, y: number, size: number, fill: string) {
  return `<g fill="${fill}" transform="translate(${x} ${y}) scale(${fontScale(size)})">${letterUses(s)}</g>`
}
