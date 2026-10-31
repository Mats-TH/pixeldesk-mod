import type { CompactBefore, Departure, RoomTheme, SettingsView } from '../types'
import { COMPACT_STEPS, ROOM_THEMES, drawnCells, gearSvg, optionSvg, settingsPlace, settingsSvg, stepSvg, themeSvg, zoneCells } from './card'
import type { GearLook, OptionId, SettingsPlace } from './card'
import { t } from './i18n'
import type { Frame, Table } from './view-shared'

/** The rows a click zone may hold: each has a key and a hook of its own. */
export const ZONE_ROWS = 6
export const PRESS_ZONES = ['settings-button', 'settings-plan', 'settings-each'] as const

const NO_BREAK = ' '
const OPTIONS: readonly Departure[] = ['plan', 'each']

/** The cells the open panel takes, for what must stay out from under it. */
export type PanelCells = { left: number; top: number; cols: number; rows: number }

const ignore = () => undefined

/** What a zone's Buttons say to a reader, where the drawing under them shows the rest. */
type Said = { label: string; variant: 'primary' | 'secondary' }

/**
 * One invisible Button per row of a zone. A press only reaches the engine on a Button, so a zone is filled with them:
 * blank, wider than the zone so that no ellipsis shows, and answered by the `ui.press` hooks.
 * Given words, the Button keeps them for a reader, and draws only its blank.
 */
export function pressRows({ Box, Button }: Pick<Table, 'Box' | 'Button'>, keyOf: (row: number) => string, cols: number, rows: number, said?: Said) {
  const blank = NO_BREAK.repeat(cols * 3)
  const hover = { backgroundColor: 'transparent' }
  const buttons = Array.from({ length: Math.min(ZONE_ROWS, rows) }, (_, i) =>
    said ? (
      <Button key={keyOf(i)} plain label={said.label} variant={said.variant} hover={hover} onPress={ignore}>
        {blank}
      </Button>
    ) : (
      <Button key={keyOf(i)} plain label={blank} hover={hover} onPress={ignore} />
    ),
  )
  return (
    <Box flexDirection="column" flexShrink={0}>
      {buttons}
    </Box>
  )
}

function settingsButton(ui: Table, open: boolean, frame: Frame) {
  const { Box, Svg } = ui
  const place = settingsPlace(frame.width, frame.height)
  const zone = zoneCells(place.button)
  const at = drawnCells(place.button)
  const aspect = (look: GearLook) => gearSvg(look, at.dx, at.dy, at.width, at.height)
  const shown = aspect(open ? 'open' : 'normal')
  const hover = aspect('hover')
  return [
    <Box key="settings-look" position="absolute" left={at.left} top={at.top} width={at.cols} height={at.rows}>
      <Svg source={shown.source} alt={t(open ? 'settings.close' : 'settings.title')} width={shown.width} height={shown.height} />
    </Box>,
    <Box key="settings-button" position="absolute" left={zone.left} top={zone.top} width={zone.cols} height={zone.rows}>
      {open ? null : (
        <Box position="absolute" left={at.left - zone.left} top={at.top - zone.top} width={at.cols} height={at.rows} flexDirection="column" display="none" hover={{ display: 'flex' }}>
          <Svg source={hover.source} alt={t('settings.title')} width={hover.width} height={hover.height} />
        </Box>
      )}
      <Box position="absolute" left={0} top={0} width={zone.cols} height={zone.rows} overflow="hidden">
        {pressRows(ui, row => `settings-button-${row}`, zone.cols, zone.rows)}
      </Box>
    </Box>,
  ]
}

type Zone = ReturnType<typeof zoneCells>
type Lit = ReturnType<typeof optionSvg>

/** A place of the panel: its look under the pointer, if it has one, then its presses. */
function panelZone(ui: Table, key: string, pressKey: string, zone: Zone, lit: Lit | null, keyOf: (row: number) => string, panel: PanelCells) {
  const { Box, Svg } = ui
  return (
    <Box key={key} position="absolute" left={zone.left - panel.left} top={zone.top - panel.top} width={zone.cols} height={zone.rows}>
      {lit ? (
        <Box position="absolute" left={lit.left - zone.left} top={lit.top - zone.top} width={lit.cols} height={lit.rows} flexDirection="column" display="none" hover={{ display: 'flex' }}>
          <Svg source={lit.source} alt={t('settings.title')} width={lit.width} height={lit.height} />
        </Box>
      ) : null}
      <Box key={pressKey} position="absolute" left={0} top={0} width={zone.cols} height={zone.rows} overflow="hidden">
        {pressRows(ui, keyOf, zone.cols, zone.rows)}
      </Box>
    </Box>
  )
}

function departureZone(ui: Table, id: Departure, chosen: boolean, panel: PanelCells, place: SettingsPlace) {
  return panelZone(ui, `settings-zone-${id}`, `settings-${id}`, zoneCells(place.options[id]), chosen ? null : optionSvg(id, place), row => `settings-${id}-${row}`, panel)
}

/** The first row of a hearth zone goes by the gesture's own key, the next ones add their row to it. */
const gestureRow = (name: string) => (row: number) => (row ? `${name}-${row}` : name)

function hearthZone(ui: Table, id: OptionId, name: string, lit: Lit | null, panel: PanelCells, place: SettingsPlace) {
  return panelZone(ui, `settings-zone-${id}`, `${name}-zone`, zoneCells(place.options[id]), lit, gestureRow(name), panel)
}

function stepZone(ui: Table, value: CompactBefore, chosen: boolean, panel: PanelCells, place: SettingsPlace) {
  const name = `hearth-compact-${value}`
  return panelZone(ui, `settings-zone-${name}`, `${name}-zone`, zoneCells(place.steps[COMPACT_STEPS.indexOf(value)]!), chosen ? null : stepSvg(value, place), gestureRow(name), panel)
}

function themeZone(ui: Table, id: RoomTheme, chosen: boolean, panel: PanelCells, place: SettingsPlace) {
  const name = `theme-${id}`
  return panelZone(ui, `settings-zone-${name}`, `${name}-zone`, zoneCells(place.themes[ROOM_THEMES.indexOf(id)]!), chosen ? null : themeSvg(id, place), gestureRow(name), panel)
}

/** The sections of the cache and the briefing: the cursor only where it applies. */
function hearthZones(ui: Table, view: SettingsView, panel: PanelCells, place: SettingsPlace) {
  const auto = view.briefingMode === 'auto'
  return [
    hearthZone(ui, 'fire', view.fire ? 'hearth-fire-off' : 'hearth-fire-on', optionSvg('fire', place, view.fire), panel, place),
    hearthZone(ui, 'auto', 'hearth-mode-auto', auto ? null : optionSvg('auto', place), panel, place),
    hearthZone(ui, 'manual', 'hearth-mode-manual', auto ? optionSvg('manual', place) : null, panel, place),
    ...(auto ? COMPACT_STEPS.map(value => stepZone(ui, value, value === view.compactBefore, panel, place)) : []),
  ]
}

/** What the open panel covers: the same cells its drawing lands on. A departure alone reads as the tall panel. */
export function panelCells(choice: Departure | SettingsView, frame: Frame): PanelCells {
  const mode = typeof choice === 'string' ? 'auto' : choice.briefingMode
  const { left, top, cols, rows } = drawnCells(settingsPlace(frame.width, frame.height, mode).panel)
  return { left, top, cols, rows }
}

/** Over everything else in the room: the button, and while it is open the panel, last of all. */
export function settingsElements(ui: Table, view: SettingsView, frame: Frame) {
  const { Box, Svg } = ui
  const button = settingsButton(ui, view.open, frame)
  if (!view.open) return button
  const place = settingsPlace(frame.width, frame.height, view.briefingMode)
  const drawn = settingsSvg(view, place)
  const panel = (
    <Box key="settings-panel" position="absolute" left={drawn.left} top={drawn.top} width={drawn.cols} height={drawn.rows}>
      <Svg source={drawn.source} alt={drawn.alt} width={drawn.width} height={drawn.height} />
      {OPTIONS.map(id => departureZone(ui, id, id === view.departure, drawn, place))}
      {hearthZones(ui, view, drawn, place)}
      {ROOM_THEMES.map(id => themeZone(ui, id, id === view.theme, drawn, place))}
    </Box>
  )
  return [...button, panel]
}
