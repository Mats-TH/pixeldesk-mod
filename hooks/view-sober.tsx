import type { Elements, RenderElement, RenderInput } from 'claude-code'
import type { Host } from './host'

import { t } from './i18n'
import type { SoberGauge } from './limits'
import { CELL_H, CELL_W } from './view-shared'

type Band = RenderInput<'AbovePrompt'>
type Words = Pick<Elements['terminal'], 'Box' | 'Text'>
type Card = Pick<Elements['desktop'], 'Box' | 'Text' | 'Svg'>

const DEFAULT_COLS = 100
// Between two columns and between two rows of the card, in cells: 20 px across, 10 px down, as in the design.
const COLUMN_GAP = 20 / CELL_W
const ROW_GAP = 10 / CELL_H
/** A column never gets narrower than this (105 px): one more would not fit, so the last one goes to the next row. */
export const COLUMN_MIN = 105 / CELL_W
const BAR_H = 8
const TRACK_H = 4
// A vivid orange and red, so that the bars stand out, in tones that read on the light theme as on the dark one.
const ORANGE = '#F26522'
const RED = '#E5262A'
const GREY = '#87867F'
const TRACK = '#87867F4D'
const METER_MIN = 6
const METER_MAX = 24
const METER_MARGIN = 34

const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v))

/** Words that stay together on a line: `3j 4h32` never breaks between its day and its hours. */
export const together = (text: string) => text.replace(/ /g, ' ')

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

/**
 * A gauge's text, one line that wraps where the column runs out: only before a dot, never inside a value. Its colours
 * are the theme's own, and nothing of it is cut.
 */
function words({ Text }: Pick<Card, 'Text'>, g: SoberGauge) {
  const dim = (text: string) => <Text color="inactive" tabular>{` · ${together(text)}`}</Text>
  return (
    <Text size="caption" wrap="wrap">
      <Text>{together(g.label)}</Text>
      <Text> </Text>
      <Text weight="medium" tabular>{together(g.percent)}</Text>
      {[g.left, g.at].filter(Boolean).map(text => dim(text))}
    </Text>
  )
}

/**
 * The card on a surface that draws, laid out by flex alone so that it follows its width live: the columns share a row
 * evenly, and when one would get narrower than `COLUMN_MIN` the last goes to the next row and takes it whole. In a row
 * every column is as tall as the tallest, its text at the top and its bar at the bottom, so the bars stay level.
 */
function card(ui: Card, gauges: readonly SoberGauge[]) {
  const { Box, Text } = ui
  if (!gauges.length) {
    return (
      <Box key="sober-band" flexGrow={1} borderStyle="round" borderColor="promptBorder" paddingX={1}>
        <Text size="caption" color="inactive">{t('sober.none')}</Text>
      </Box>
    )
  }
  return (
    <Box key="sober-band" flexGrow={1} flexDirection="row" flexWrap="wrap" alignItems="stretch" columnGap={COLUMN_GAP} rowGap={ROW_GAP} borderStyle="round" borderColor="promptBorder" paddingX={1}>
      {gauges.map(g => (
        <Box key={`sober-${g.kind}`} flexDirection="column" justifyContent="space-between" flexGrow={1} width={0} minWidth={COLUMN_MIN}>
          {words(ui, g)}
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
  return card(host.ui.resolve(e) as unknown as Card, gauges)
}
