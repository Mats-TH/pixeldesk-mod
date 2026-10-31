import type { Elements, EngineInterface, RenderChildren, RenderElement, RenderInput } from 'claude-code'

import type { DrawnPlan, Limit } from '../types'
import { BAND_H, bandAlt, bandSvg, idleAlt, idleSvg, kidColors, overviewAlt, overviewLine, overviewSvg } from './band'
import type { OverviewInput } from './band'
import { keptRoom } from './desks'
import { t } from './i18n'
import { cut } from './lines'
import { gauge } from './limits'
import type { Gauge } from './limits'
import type { Memory } from './memory'
import { mix } from './pixel/canvas'
import { readFloorRooms, readLimits, readMinute, readNews, readPlan, readShimmer } from './state'
import { hearthRows } from './view-hearth'
import { bandWidth, followLanguage } from './view-shared'

type Band = RenderInput<'AbovePrompt'>
type TerminalTable = Pick<Elements['terminal'], 'Box' | 'Text'>
type Gauges = [Gauge, Gauge]

const TERMINAL_COLS = 30
const TITLE_MAX = 28
const TITLE_MIN = 6
const BAR_MARGIN = 10
const BAR_MIN = 6
const GAUGE_MIN = 6
const GAUGE_MAX = 24
const GAUGE_MARGIN = 22
const NIGHT_FROM = 20
const NIGHT_TO = 7
const MINUTE_MS = 60_000
// What the band keeps from a drawing above it, so as not to cover its buttons.
const UNDER_MOD = 1
const VIOLET_DARK = '#6d28d9'
const VIOLET = '#8b5cf6'
const VIOLET_LIGHT = '#c4b5fd'
const MARK = '#eab308'
const OVER = '#d97757'
const UNDER = '#16a34a'

const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v))
const isNight = (now: number) => {
  const hour = new Date(now).getHours()
  return hour >= NIGHT_FROM || hour < NIGHT_TO
}

/** One line of a terminal block, cut with its own ellipsis so that the width is known. */
const LINE = 'truncate-end'

/** The bar of a plan: done in a gradient, the step at work shimmering, the rest dim. */
function bar({ Text }: TerminalTable, width: number, done: number, total: number, live: boolean, shimmer: number) {
  const full = total ? Math.round((width * done) / total) : 0
  const edge = live && total ? Math.round((width * (done + 1)) / total) : full
  const hot = Array.from({ length: full }, (_, i) => <Text color={mix(VIOLET_LIGHT, VIOLET_DARK, full > 1 ? i / (full - 1) : 0)}>█</Text>)
  const warm = Array.from({ length: edge - full }, (_, i) => <Text color={(shimmer + i) % 2 ? VIOLET_LIGHT : VIOLET}>▓</Text>)
  return (
    <Text>
      {hot}
      {warm}
      <Text dimColor>{'░'.repeat(Math.max(0, width - edge))}</Text>
    </Text>
  )
}

/** A gauge in cells: green up to the mark, past it orange, the mark itself in yellow. */
function meter({ Text }: TerminalTable, g: Gauge, width: number) {
  const used = g.used === null ? 0 : Math.round((width * g.used) / 100)
  const mark = g.mark === null ? -1 : Math.min(width - 1, Math.round((width * g.mark) / 100))
  const cells = Array.from({ length: width }, (_, i) => {
    if (i === mark) return <Text color={MARK}>│</Text>
    if (i >= used) return <Text dimColor>░</Text>
    return <Text color={mark >= 0 && i > mark ? OVER : UNDER}>█</Text>
  })
  return <Text>{cells}</Text>
}

function gaugeRows(ui: TerminalTable, gauges: Gauges, width: number) {
  const { Box, Text } = ui
  const room = clamp(width - GAUGE_MARGIN, GAUGE_MIN, GAUGE_MAX)
  return gauges.map(g => (
    <Box key={`gauge-${g.label}`} flexDirection="row" gap={1}>
      <Text dimColor>{g.label}</Text>
      {meter(ui, g, room)}
      <Text>{g.percent}</Text>
      <Text dimColor>{g.at}</Text>
    </Box>
  ))
}

function terminalPlan(ui: TerminalTable, plan: DrawnPlan, gauges: Gauges, width: number, shimmer: number) {
  const { Box, Text } = ui
  const total = plan.steps.length
  const done = plan.steps.filter(st => st.status === 'completed').length
  const now = plan.steps.find(st => st.status === 'in_progress')
  const next = plan.steps.find(st => st.status === 'pending')
  const title = cut(plan.title, clamp(Math.floor(width / 3), TITLE_MIN, TITLE_MAX))
  const tasks = t('band.tasks', { done, total })
  const percent = `${total ? Math.round((done / total) * 100) : 0}%`
  const room = Math.max(BAR_MIN, width - title.length - tasks.length - percent.length - BAR_MARGIN)
  const line = now ? t('band.now', { text: now.text }) : next ? t('band.next', { text: next.text }) : t('band.allDone')
  return (
    <Box key="plan-band" flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={VIOLET_DARK}>●</Text>
        <Text bold>{title}</Text>
        {bar(ui, room, done, total, !!now, shimmer)}
        <Text bold color={VIOLET}>{tasks}</Text>
        <Text dimColor>{percent}</Text>
      </Box>
      <Text dimColor wrap={LINE}>{cut(line, width)}</Text>
      {gaugeRows(ui, gauges, width)}
    </Box>
  )
}

function terminalOverview(ui: TerminalTable, view: OverviewInput, width: number) {
  const { Box, Text } = ui
  return (
    <Box key="overview-band" flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text bold>{t('band.overview')}</Text>
        <Text>{kidColors(view.states).map(color => <Text color={color}>■</Text>)}</Text>
        {view.news ? <Text color={OVER}>{String(view.news)}</Text> : null}
      </Box>
      <Text dimColor wrap={LINE}>{cut(overviewLine(view), width)}</Text>
      {gaugeRows(ui, view.gauges, width)}
    </Box>
  )
}

function terminalIdle(ui: TerminalTable, gauges: Gauges, width: number) {
  const { Box, Text } = ui
  return (
    <Box key="idle-band" flexDirection="column">
      <Text bold>{t('band.idle')}</Text>
      {gaugeRows(ui, gauges, width)}
    </Box>
  )
}

/** The band in cells, for the terminal. */
async function terminalBand($: EngineInterface, e: Band, plan: DrawnPlan | null, open: boolean, view: OverviewInput | null, gauges: Gauges) {
  const ui = $.ui.resolve(e) as unknown as TerminalTable
  const width = e.props.bodyColumns || TERMINAL_COLS
  if (open && plan) return terminalPlan(ui, plan, gauges, width, (await readShimmer($)) ?? 0)
  if (view) return terminalOverview(ui, view, width)
  if (plan?.steps.length) return terminalPlan(ui, plan, gauges, width, 0)
  return terminalIdle(ui, gauges, width)
}

/** The band as a drawing. The same source goes back as long as nothing moved: the walker walks on its own. */
function drawnBand(e: Band, plan: DrawnPlan | null, open: boolean, view: OverviewInput | null, gauges: Gauges, night: boolean) {
  const width = bandWidth(e.props.bodyColumns)
  if (view && !open) {
    const input = { ...view, width, night }
    return { key: 'overview-band', source: overviewSvg(input), alt: overviewAlt(input), width }
  }
  if (plan?.steps.length) {
    const input = { title: plan.title, steps: plan.steps.map(st => ({ text: st.text, status: st.status })), gauges, width, night }
    return { key: 'plan-band', source: bandSvg(input), alt: bandAlt(input), width }
  }
  const input = { gauges, width, night }
  return { key: 'idle-band', source: idleSvg(input), alt: idleAlt(input), width }
}

// What only shows through what it holds.
const WRAPPERS: readonly string[] = ['Box', 'Text', 'fragment']

/** Whether a drawing puts anything on screen: an empty box or fragment does not. */
function shows(el: RenderChildren): boolean {
  if (typeof el === 'string') return el !== ''
  if (Array.isArray(el)) return el.some(shows)
  if (typeof el !== 'object' || el === null) return false
  const { type, children } = el as { type: string; children?: RenderChildren }
  if (type === 'engine') return false
  return WRAPPERS.includes(type) ? shows(children) : true
}

/** What the rest of the chain drew stays above the band, but never the engine's own fallback. */
async function beneath(pass: () => Promise<RenderElement>) {
  try {
    const drawn = await pass()
    return drawn.type === 'engine' ? null : drawn
  } catch {
    return null
  }
}

async function overviewOf($: EngineInterface, news: number, gauges: Gauges): Promise<OverviewInput | null> {
  const kids = ((await readFloorRooms($)) ?? []).slice(1).map(keptRoom)
  if (!kids.length) return null
  const states = kids.map(kid => kid.state ?? 'idle')
  return { states, agents: kids.reduce((sum, kid) => sum + kid.agents, 0), news, gauges, width: 0, night: false }
}

/** The band above the prompt: an open plan, else the overview, else a finished plan, else the world at rest. */
export async function drawBand($: EngineInterface, m: Memory, e: Band, pass: () => Promise<RenderElement>) {
  if (e.props.hasSurvey) return pass()
  await followLanguage($, m)
  const plan = (await readPlan($)) ?? null
  const limits: Limit[] = (await readLimits($)) ?? []
  const news = await readNews($)
  await readMinute($)
  const now = await $.clock.now()
  // A gauge's mark moves with the clock: held to the minute, the source stands still between two ticks.
  const minute = Math.floor(now / MINUTE_MS) * MINUTE_MS
  const gauges: Gauges = [gauge(limits, 'five_hour', minute), gauge(limits, 'seven_day', minute)]
  const open = !!plan && plan.steps.some(st => st.status !== 'completed')
  const view = await overviewOf($, news?.count ?? 0, gauges)
  const under = await beneath(pass)
  // What comes first eats the frame's edge, as long as nothing stands above it.
  const top = under && shows(under) ? UNDER_MOD : -1
  const rows = await hearthRows($, m, e, top)
  if (e.surface === 'terminal') {
    const { Box } = $.ui.resolve(e)
    const band = await terminalBand($, e, plan, open, view, gauges)
    return under || rows ? <Box flexDirection="column">{under}{rows}{band}</Box> : band
  }
  const { Box, Svg } = $.ui.resolve(e)
  const drawn = drawnBand(e, plan, open, view, gauges, isNight(now))
  return (
    <Box flexDirection="column" backgroundColor="transparent">
      {under}
      {rows}
      <Box key={drawn.key} marginX={-1} marginTop={rows ? 0 : top} marginBottom={-1}>
        <Svg source={drawn.source} alt={drawn.alt} width={drawn.width} height={BAND_H} isInteractive />
      </Box>
    </Box>
  )
}
