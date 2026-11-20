import type { Elements, RenderElement, RenderInput } from 'claude-code'
import type { Host } from './host'

import { t } from './i18n'
import type { SoberGauge } from './limits'
import { CELL_H, CELL_W } from './view-shared'

type Band = RenderInput<'AbovePrompt'>
type Words = Pick<Elements['terminal'], 'Box' | 'Text'>
type Card = Pick<Elements['desktop'], 'Box' | 'Text' | 'Svg'>

const DEFAULT_COLS = 100
// The card's border and its padding, on both sides, then the room between two columns.
const EDGES = 4
const GAP = 2
/** Under this many cells (about 384 px) the gauges stand one above the other, whatever they say. */
export const SOBER_BREAK = 48
// A letter of the small text against a cell: what a line of it takes, counted wide.
const LETTER = 0.8
const BAR_H = 8
const TRACK_H = 4
// The app's orange, and tones that read on its light theme as on its dark one: a bar cannot follow the theme.
const ORANGE = '#D97757'
const RED = '#CF4A4A'
const GREY = '#87867F'
const TRACK = '#87867F4D'
const METER_MIN = 6
const METER_MAX = 24
const METER_MARGIN = 34

const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v))

/** The words after the name: what is used, the time left, when it resets. The last two only with a reset time. */
const values = (g: SoberGauge) => [g.percent, g.left, g.at].filter(Boolean)

/**
 * How many lines every gauge writes on in `cells` of room, the same for all so that the bars stay level: the name and
 * its values on one, else the name over its values, else the reset on a third line. Null: not even three hold it.
 */
export function soberLines(gauges: readonly SoberGauge[], cells: number): 1 | 2 | 3 | null {
  const room = cells / LETTER
  const fits = (...words: ((g: SoberGauge) => string)[]) => gauges.every(g => words.every(word => word(g).length <= room))
  if (fits(g => `${g.label} ${values(g).join(' · ')}`)) return 1
  if (fits(g => g.label, g => values(g).join(' · '))) return 2
  if (fits(g => g.label, g => [g.percent, g.left].filter(Boolean).join(' · '), g => g.at)) return 3
  return null
}

/**
 * How the card lays its gauges out in `columns` cells: side by side while each column holds its text, else one above
 * the other, each on the whole width. Under the break they always stand one above the other.
 */
export function soberLayout(gauges: readonly SoberGauge[], columns: number): { stacked: boolean; lines: 1 | 2 | 3 } {
  const inner = columns - EDGES
  const beside = columns < SOBER_BREAK ? null : soberLines(gauges, (inner - GAP * (gauges.length - 1)) / gauges.length)
  if (beside) return { stacked: false, lines: beside }
  return { stacked: true, lines: soberLines(gauges, inner) ?? 3 }
}

/** One stretch of a bar: its ink and its share of the width. The mark has no share: it is a hairline. */
export type Stretch = { ink: 'orange' | 'red' | 'track'; share: number } | { ink: 'mark' }

/**
 * A bar from left to right: orange up to the mark of the ideal pace, red past it, the track for what is left, the
 * mark where it falls. A stretch with nothing in it is left out.
 */
export function soberStretches(g: SoberGauge): Stretch[] {
  const used = clamp(g.used, 0, 100)
  const mark = g.mark === null ? null : clamp(g.mark, 0, 100)
  const shares: Stretch[] =
    mark === null
      ? [{ ink: 'orange', share: used }, { ink: 'track', share: 100 - used }]
      : used > mark
        ? [{ ink: 'orange', share: mark }, { ink: 'mark' }, { ink: 'red', share: used - mark }, { ink: 'track', share: 100 - used }]
        : [{ ink: 'orange', share: used }, { ink: 'track', share: mark - used }, { ink: 'mark' }, { ink: 'track', share: 100 - mark }]
  return shares.filter(s => s.ink === 'mark' || s.share > 0)
}

const INKS = { orange: ORANGE, red: RED, track: TRACK, mark: GREY } as const

/** A round end, two pixels wide: half a disc in `ink`, on `back` where the bar goes on behind it. */
function cap(side: 'left' | 'right', ink: string, back: string | null) {
  const half = side === 'left' ? 'M2 0A2 2 0 0 0 2 4Z' : 'M0 0A2 2 0 0 1 0 4Z'
  const behind = back ? `<rect width="2" height="${TRACK_H}" fill="${back}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="${TRACK_H}" viewBox="0 0 2 ${TRACK_H}">${behind}<path d="${half}" fill="${ink}"/></svg>`
}

/**
 * The fine bar, as wide as its column whatever that is: each stretch grows by its share. What is used is round at
 * both of its ends, by half the bar's height, and straight where orange meets red; the track ends round too.
 */
function bar({ Box, Svg }: Card, g: SoberGauge) {
  const stretches = soberStretches(g)
  const alt = t('sober.alt', { label: g.label, percent: g.percent })
  const end = (key: string, side: 'left' | 'right', ink: string, back: string | null) => <Svg key={key} source={cap(side, ink, back)} alt={alt} width={2} height={TRACK_H} />
  const filled = stretches.filter(s => s.ink === 'orange' || s.ink === 'red')
  const last = stretches[stretches.length - 1]!
  const parts: RenderElement[] = [end('start', 'left', filled.length ? ORANGE : TRACK, null)]
  stretches.forEach((s, i) => {
    if (s.ink === 'mark') return void parts.push(<Box key="mark" width={1 / CELL_W} height={BAR_H / CELL_H} backgroundColor={GREY} />)
    parts.push(<Box key={`${s.ink}-${i}`} flexGrow={s.share} width={0} height={TRACK_H / CELL_H} backgroundColor={INKS[s.ink]} />)
    // Where what is used stops short of the end, its last ink closes round over the track.
    if (s === filled[filled.length - 1] && s !== last) parts.push(end('used', 'right', INKS[s.ink], TRACK))
  })
  parts.push(end('end', 'right', INKS[last.ink === 'mark' ? 'track' : last.ink], null))
  return (
    <Box key="bar" flexDirection="row" alignItems="center" height={BAR_H / CELL_H}>
      {parts}
    </Box>
  )
}

/** A gauge's text, on as many lines as the card settled. Its colours are the theme's own, and nothing of it is cut. */
function words({ Text }: Pick<Card, 'Text'>, g: SoberGauge, lines: 1 | 2 | 3) {
  const name = <Text>{g.label}</Text>
  const percent = <Text weight="medium" tabular>{g.percent}</Text>
  const dim = (text: string) => <Text color="inactive" tabular>{text}</Text>
  const row = (key: string, ...parts: RenderElement[]) => <Text key={key} size="caption" wrap="wrap">{parts}</Text>
  const rest = [g.left, g.at].filter(Boolean)
  if (lines === 1) return [row('line', name, <Text> </Text>, percent, ...rest.map(text => dim(` · ${text}`)))]
  if (lines === 2) return [row('name', name), row('values', percent, ...rest.map(text => dim(` · ${text}`)))]
  return [row('name', name), row('values', percent, ...(g.left ? [dim(` · ${g.left}`)] : [])), ...(g.at ? [row('reset', dim(g.at))] : [])]
}

/**
 * The card on a surface that draws. Nothing in it has a width of its own: side by side, the columns share the card's
 * width evenly, and one above the other each takes it whole, the text over its bar.
 */
function card(ui: Card, gauges: readonly SoberGauge[], columns: number) {
  const { Box, Text } = ui
  if (!gauges.length) {
    return (
      <Box key="sober-band" borderStyle="round" borderColor="promptBorder" paddingX={1}>
        <Text size="caption" color="inactive">{t('sober.none')}</Text>
      </Box>
    )
  }
  const { stacked, lines } = soberLayout(gauges, columns)
  return (
    <Box key="sober-band" flexDirection={stacked ? 'column' : 'row'} gap={stacked ? 'xs' : GAP} borderStyle="round" borderColor="promptBorder" paddingX={1}>
      {gauges.map(g => (
        <Box key={`sober-${g.kind}`} flexDirection="column" {...(stacked ? {} : { flexGrow: 1, width: 0 })}>
          {words(ui, g, lines)}
          {bar(ui, g)}
        </Box>
      ))}
    </Box>
  )
}

/** A gauge in cells, for the terminal: orange up to the mark, red past it. */
function meter({ Text }: Words, g: SoberGauge, width: number) {
  const used = Math.round((width * g.used) / 100)
  const mark = g.mark === null ? -1 : Math.min(width - 1, Math.round((width * g.mark) / 100))
  const cells = Array.from({ length: width }, (_, i) => {
    if (i === mark) return <Text color={GREY}>│</Text>
    if (i >= used) return <Text dimColor>░</Text>
    return <Text color={mark >= 0 && i > mark ? RED : ORANGE}>█</Text>
  })
  return <Text>{cells}</Text>
}

/** The same limits in cells: a row for each, since a terminal's columns are too few to stand side by side. */
function rows(ui: Words, gauges: readonly SoberGauge[], columns: number) {
  const { Box, Text } = ui
  if (!gauges.length) return <Box key="sober-band"><Text dimColor>{t('sober.none')}</Text></Box>
  const room = clamp(columns - METER_MARGIN, METER_MIN, METER_MAX)
  return (
    <Box key="sober-band" flexDirection="column">
      {gauges.map(g => (
        <Box key={`sober-${g.kind}`} flexDirection="row" gap={1}>
          <Text dimColor>{g.label}</Text>
          {meter(ui, g, room)}
          <Text>{g.percent}</Text>
          <Text dimColor>{[g.left, g.at].filter(Boolean).join(' · ')}</Text>
        </Box>
      ))}
    </Box>
  )
}

/** The sober look above the prompt: the limits and nothing else, still, in the colours of the app. */
export function soberBand(host: Host, e: Band, gauges: readonly SoberGauge[]) {
  const columns = e.props.bodyColumns || DEFAULT_COLS
  if (e.surface === 'terminal') return rows(host.ui.resolve(e) as unknown as Words, gauges, columns)
  return card(host.ui.resolve(e) as unknown as Card, gauges, columns)
}
