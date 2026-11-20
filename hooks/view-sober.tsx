import type { Elements, RenderElement, RenderInput } from 'claude-code'
import type { Host } from './host'

import { t } from './i18n'
import type { SoberGauge } from './limits'
import { CELL_W } from './view-shared'

type Band = RenderInput<'AbovePrompt'>
type Words = Pick<Elements['terminal'], 'Box' | 'Text'>
type Card = Pick<Elements['desktop'], 'Box' | 'Text' | 'Svg'>

const DEFAULT_COLS = 100
// The card's border and its padding, on both sides, then the room between two columns.
const EDGES = 4
const GAP = 2
const COLUMN_MIN = 8
// A letter of the small text against a cell: what a line of it takes, counted wide.
const LETTER = 0.8
const BAR_H = 8
const TRACK_H = 4
// The app's orange, and tones that read on its light theme as on its dark one: a drawing cannot follow the theme.
const ORANGE = '#D97757'
const RED = '#CF4A4A'
const GREY = '#87867F'
const LINE = 'truncate-end'
const METER_MIN = 6
const METER_MAX = 24
const METER_MARGIN = 34

const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v))

/** The words after the name: what is used, the time left, when it resets. The last two only with a reset time. */
const values = (g: SoberGauge) => [g.percent, g.left, g.at].filter(Boolean)

/**
 * How many lines every column writes on, the same for all so that the bars stay level: the name and its values on
 * one, else the name over its values, else the reset on a third line.
 */
export function soberLines(gauges: readonly SoberGauge[], cells: number): 1 | 2 | 3 {
  const room = cells / LETTER
  const fits = (words: (g: SoberGauge) => string) => gauges.every(g => words(g).length <= room)
  if (fits(g => `${g.label} ${values(g).join(' · ')}`)) return 1
  if (fits(g => values(g).join(' · '))) return 2
  return 3
}

/**
 * The fine bar: orange up to the mark of the ideal pace, red past it, the mark a hairline across.
 * What is used is round at both of its ends, by half the bar's height, and straight where orange meets red.
 */
export function soberBar(g: SoberGauge, width: number) {
  const top = (BAR_H - TRACK_H) / 2
  const at = (percent: number) => Math.round((width * percent) / 100)
  const used = at(g.used)
  const mark = g.mark === null ? null : Math.min(width - 1, at(g.mark))
  const calm = mark === null ? used : Math.min(used, mark)
  const over = mark !== null && used > mark ? `<rect x="${mark}" y="${top}" width="${used - mark}" height="${TRACK_H}" fill="${RED}"/>` : ''
  const line = mark === null ? '' : `<rect x="${mark}" y="0" width="1" height="${BAR_H}" fill="${GREY}"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BAR_H}" viewBox="0 0 ${width} ${BAR_H}">` +
    `<clipPath id="used"><rect y="${top}" width="${used}" height="${TRACK_H}" rx="${TRACK_H / 2}"/></clipPath>` +
    `<rect y="${top}" width="${width}" height="${TRACK_H}" rx="${TRACK_H / 2}" fill="${GREY}" fill-opacity="0.3"/>` +
    `<g clip-path="url(#used)"><rect y="${top}" width="${calm}" height="${TRACK_H}" fill="${ORANGE}"/>${over}</g>${line}</svg>`
  )
}

/** A column's text, on as many lines as the card settled. Its colours are the theme's own. */
function words({ Text }: Pick<Card, 'Text'>, g: SoberGauge, lines: 1 | 2 | 3) {
  const name = <Text>{g.label}</Text>
  const percent = <Text weight="medium" tabular>{g.percent}</Text>
  const dim = (text: string) => <Text color="inactive" tabular>{text}</Text>
  const row = (key: string, ...parts: RenderElement[]) => <Text key={key} size="caption" wrap={LINE}>{parts}</Text>
  const rest = [g.left, g.at].filter(Boolean)
  if (lines === 1) return [row('line', name, <Text> </Text>, percent, ...rest.map(text => dim(` · ${text}`)))]
  if (lines === 2) return [row('name', name), row('values', percent, ...rest.map(text => dim(` · ${text}`)))]
  return [row('name', name), row('values', percent, ...(g.left ? [dim(` · ${g.left}`)] : [])), ...(g.at ? [row('reset', dim(g.at))] : [])]
}

/** The card on a surface that draws: one column for each gauge, all of one width, the text over its bar. */
function card(ui: Card, gauges: readonly SoberGauge[], columns: number) {
  const { Box, Text, Svg } = ui
  if (!gauges.length) {
    return (
      <Box key="sober-band" borderStyle="round" borderColor="promptBorder" paddingX={1}>
        <Text size="caption" color="inactive">{t('sober.none')}</Text>
      </Box>
    )
  }
  const cells = Math.max(COLUMN_MIN, Math.floor((columns - EDGES - GAP * (gauges.length - 1)) / gauges.length))
  const lines = soberLines(gauges, cells)
  return (
    <Box key="sober-band" flexDirection="row" gap={GAP} borderStyle="round" borderColor="promptBorder" paddingX={1}>
      {gauges.map(g => (
        <Box key={`sober-${g.kind}`} flexDirection="column" width={cells}>
          {words(ui, g, lines)}
          <Svg source={soberBar(g, cells * CELL_W)} alt={t('sober.alt', { label: g.label, percent: g.percent })} width={cells * CELL_W} height={BAR_H} />
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
