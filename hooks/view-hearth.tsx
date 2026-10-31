import type { Elements, EngineInterface, RenderInput } from 'claude-code'

import type { Briefing } from '../types'
import { zoneCells } from './card'
import { briefingButtons, briefingRow, rowArea } from './card-briefing'
import type { BriefingButton, PlacedButton } from './card-briefing'
import { tilde } from './briefing-gather'
import { plural, t } from './i18n'
import type { TextKey } from './i18n'
import { cut } from './lines'
import type { Memory } from './memory'
import { readBriefing, readHearth } from './state'
import { pressRows } from './view-settings'
import { bandWidth } from './view-shared'
import type { Table } from './view-shared'

type Band = RenderInput<'AbovePrompt'>
type Row = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button'>

const STEPS: readonly TextKey[] = ['briefing.step1', 'briefing.step2', 'briefing.step3', 'briefing.step4', 'briefing.step5']
const LINE = 'truncate-end'
const WIDTH_MARGIN = 2
// A plain image stops at the body, where the band's frame runs past it.
const ROW_PAST = 10
const ignore = () => undefined

/** The presses reach their hooks by key, whatever the row became in between. */
function wordButtons({ Box, Button }: Row, labels: readonly BriefingButton[]) {
  return (
    <Box key="briefing-buttons" flexDirection="row" gap={1}>
      {labels.map(b => <Button key={b.key} label={b.label} variant={b.primary ? 'primary' : 'secondary'} onPress={ignore} />)}
    </Box>
  )
}

function waitingWords(view: Briefing, percent: number) {
  const n = view.waitingAgents + view.waitingChats
  const words = n ? plural('briefing.waiting', n, { n }) : t('briefing.waitingTurn')
  return view.urgent ? `${words} ${t('briefing.urgent', { percent })}` : words
}

const WORDS: Record<Exclude<Briefing['phase'], 'idle'>, (view: Briefing, percent: number, home: string) => string> = {
  offered: (_v, percent) => t('briefing.offer', { percent }),
  waiting: waitingWords,
  writing: view => t('briefing.writing', { n: view.step + 1, step: t(STEPS[view.step] ?? 'briefing.step1') }),
  ready: (view, _p, home) => `${t('briefing.titleReady', { n: view.words })} ${t('briefing.savedIn', { file: tilde(view.file ?? '', home) })}`,
  failed: (view, _p, home) => `${t('briefing.titleFailed', { error: view.error })}${view.file ? ` ${t('briefing.draftIn', { file: tilde(view.file, home) })}` : ''}`,
}

/** The briefing in words, with its buttons, where no drawing goes: the terminal and a phone. */
function wordRow(ui: Row, view: Briefing, phase: keyof typeof WORDS, percent: number, width: number, home: string) {
  const { Box, Text } = ui
  const labels = briefingButtons(view)
  return (
    <Box key="briefing-row" flexDirection="column">
      <Text wrap={LINE}>{cut(WORDS[phase](view, percent, home), width)}</Text>
      {view.note ? <Text dimColor wrap={LINE}>{cut(view.note, width)}</Text> : null}
      {labels.length ? wordButtons(ui, labels) : null}
    </Box>
  )
}

/**
 * A drawn button's press, its whole height, cell by cell as the settings do.
 * No look under the pointer: above the prompt, the app shows a hover drawing in a bubble of its own, away from the button.
 */
function buttonZone(ui: Table, b: PlacedButton) {
  const zone = zoneCells(rowArea(b))
  return (
    <ui.Box key={`${b.key}-zone`} position="absolute" left={zone.left} top={zone.top} width={zone.cols} height={zone.rows} overflow="hidden">
      {pressRows(ui, row => (row ? `${b.key}-${row}` : b.key), zone.cols, zone.rows)}
    </ui.Box>
  )
}

/** The row of the design: a plain image the width of the band, and the presses laid over its buttons. */
function drawnRow(ui: Table, view: Briefing, width: number, top: number) {
  const { Box, Svg } = ui
  const row = briefingRow(view, width)
  return (
    <Box key="briefing-row" flexDirection="column" marginX={-1} marginTop={top}>
      <Svg source={row.source} alt={row.alt} width={row.width} height={row.height} />
      {row.buttons.map(b => buttonZone(ui, b))}
    </Box>
  )
}

/** What the band adds above itself, or null: it only speaks when a briefing is under way, and the band itself never moves for it. */
export async function hearthRows($: EngineInterface, m: Memory, e: Band, top: number) {
  const view = await readBriefing($)
  if (!view || view.phase === 'idle') return null
  if (e.surface === 'desktop' || e.surface === 'vscode') return drawnRow($.ui.resolve(e) as unknown as Table, view, ROW_PAST + bandWidth(e.props.bodyColumns), top)
  const percent = (await readHearth($))?.contextPercent ?? 0
  const width = Math.max(1, (e.props.bodyColumns || 0) - WIDTH_MARGIN)
  return wordRow($.ui.resolve(e) as unknown as Row, view, view.phase, percent, width, m.home)
}
