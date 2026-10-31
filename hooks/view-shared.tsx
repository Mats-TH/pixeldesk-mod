import type { Elements, EngineInterface, RenderInput } from 'claude-code'

import { cardPlace } from './card'
import type { CardDrawing, CardZone } from './card'
import { setLanguage } from './i18n'
import type { Memory } from './memory'
import { CELL_H, CELL_W } from './room'
import type { Layer } from './room-layers'
import { readLanguage } from './state'

export type Pane = RenderInput<'Pane'>
/** What a pane's drawing is built with, on the surfaces that have `Svg`. */
export type Table = Pick<Elements['desktop'], 'Box' | 'Svg' | 'Button'>
/** The drawing's size, in pixels and in cells. `fit` is the height the root takes. */
export type Frame = { width: number; height: number; fit: number | string; pane: { cols: number; rows: number } }

export { CELL_H, CELL_W }
const MAX_PX = 4096
const BAND_MIN = 420
const BAND_MAX = 1600
const DEFAULT_COLS = 100
const MIN_COLS = 32
const DEFAULT_ROWS = 22

/** How wide the band draws, and what stands above it. */
export const bandWidth = (columns: number) => Math.max(BAND_MIN, Math.min(BAND_MAX, (columns || DEFAULT_COLS) * CELL_W))

/** A pane's cells. The drawing runs past both edges of the body, by a column each, and the site brings it back. */
export function frameOf(e: Pane): Frame {
  const cols = Math.max(MIN_COLS, e.props.bodyColumns || 0)
  const bodyRows = e.props.scroll?.bodyRows || 0
  const width = Math.min(MAX_PX, (e.surface === 'mobile' ? cols : cols + 2) * CELL_W)
  const height = Math.min(MAX_PX, (bodyRows || DEFAULT_ROWS) * CELL_H)
  return { width, height, fit: bodyRows || '100%', pane: { cols: Math.floor(width / CELL_W), rows: Math.floor(height / CELL_H) } }
}

// The client refuses a tree of 262 144 characters and more, in silence: the pane says its plugin has not drawn.
export const TREE_ROOM = 256_000

const strings = (o: object | undefined) => Object.entries(o ?? {}).reduce((n, [k, v]) => n + k.length + (typeof v === 'string' ? v.length : 0), 0)

/** A tree as the client measures it: a drawing by its source and its words, anything else by the strings it holds. */
export function treeChars(el: unknown): number {
  if (typeof el === 'string') return el.length
  if (typeof el !== 'object' || el === null) return 0
  const { type, props, hover, children } = el as { type?: string; props?: { source?: string; alt?: string }; hover?: object; children?: unknown[] }
  const own = type === 'Svg' ? (props?.source?.length ?? 0) + (props?.alt?.length ?? 0) : strings(props) + strings(hover)
  return (children ?? []).reduce((n: number, kid) => n + treeChars(kid), own)
}

/** The first tree that fits, of `steps` that each give up more. Null: none does. */
export function lightest<T>(tree: (shed: number) => T, steps: number): T | null {
  for (let shed = 0; shed < steps; shed += 1) {
    const drawn = tree(shed)
    if (treeChars(drawn) < TREE_ROOM) return drawn
  }
  return null
}

/** The size of a card in whole cells. */
export const cellsOf = (d: CardDrawing) => ({ cols: Math.ceil(d.width / CELL_W), rows: Math.ceil(d.height / CELL_H) })

/** A place on the pane that opens a card under the pointer: the card stands whole, relative to the place. */
export function hoverZone({ Box, Svg }: Table, key: string, zone: CardZone, card: CardDrawing, alt: string, frame: Frame) {
  const at = cardPlace(zone, cellsOf(card), frame.pane)
  return (
    <Box key={key} position="absolute" left={zone.left} top={zone.top} width={zone.width} height={zone.height}>
      <Box position="absolute" left={at.left - zone.left} top={at.top - zone.top} display="none" hover={{ display: 'flex' }}>
        <Svg source={card.source} alt={alt} width={card.width} height={card.height} />
      </Box>
    </Box>
  )
}

/** A small drawing that moves, on its cells. Its key keeps the frame through every redraw. */
export function liveBox({ Box, Svg }: Table, l: Layer) {
  return (
    <Box key={l.key} position="absolute" left={l.left} top={l.top} width={l.cols} height={l.rows} flexDirection="column">
      <Svg source={l.source} alt={l.alt} width={l.width} height={l.height} isInteractive />
    </Box>
  )
}

/** A drawing keeps the session's language through a reload that never ran `session.start`. */
export async function followLanguage($: EngineInterface, m: Memory) {
  const language = await readLanguage($)
  if (language && !m.forced) setLanguage(language)
}
