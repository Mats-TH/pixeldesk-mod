import type { CompactBefore, Departure, RoomTheme, SettingsView } from '../types'
import { COMPACT_STEPS, ROOM_THEMES, drawnCells, gearSvg, optionSvg, settingsPlace, settingsSvg, stepSvg, themeSvg, zoneCells } from './card'
import type { GearLook, OptionId, SettingsPlace } from './card'
import { t } from './i18n'
import type { Frame, Table } from './view-shared'

const NO_BREAK = ' '
const OPTIONS: readonly Departure[] = ['plan', 'each']

/** The cells the open panel takes, for what must stay out from under it. `bare`: its places keep no look under the pointer. */
export type PanelCells = { left: number; top: number; cols: number; rows: number; bare?: boolean }

const ignore = () => undefined

/** What a zone's Buttons say to a reader, where the drawing under them shows the rest. */
type Said = { label: string; variant: 'primary' | 'secondary' }

/**
 * The invisible Button of a zone, for the zone's Box to hold as its only child: a Box lays out in a row, so the Button
 * stretches to its height. A press only reaches the engine on a Button. Blank and wider than the zone, so that no ellipsis
 * shows, it is answered by the `ui.press` hooks. Given words, it keeps them for a reader, and draws only its blank.
 */
export function pressButton({ Button }: Pick<Table, 'Button'>, key: string, cols: number, said?: Said) {
  const blank = NO_BREAK.repeat(Math.ceil(cols * 3))
  const hover = { backgroundColor: 'transparent' }
  return said ? (
    <Button key={key} plain label={said.label} variant={said.variant} hover={hover} onPress={ignore}>
      {blank}
    </Button>
  ) : (
    <Button key={key} plain label={blank} hover={hover} onPress={ignore} />
  )
}

type Zone = ReturnType<typeof zoneCells>

/** A zone's Box, from a Box that stands at the cell (`left`, `top`). */
export const zoneBox = (zone: Zone, left = 0, top = 0) => ({ position: 'absolute' as const, left: zone.left - left, top: zone.top - top, marginLeft: zone.marginLeft, marginTop: zone.marginTop, width: zone.cols, height: zone.rows })

/** What stands inside a zone on whole cells takes its margins back. */
const onCells = (zone: Zone) => ({ marginLeft: -zone.marginLeft, marginTop: -zone.marginTop })

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
    <Box key="settings-button" {...zoneBox(zone)}>
      {open ? null : (
        <Box position="absolute" left={at.left - zone.left} top={at.top - zone.top} {...onCells(zone)} width={at.cols} height={at.rows} flexDirection="column" display="none" hover={{ display: 'flex' }}>
          <Svg source={hover.source} alt={t('settings.title')} width={hover.width} height={hover.height} />
        </Box>
      )}
      <Box position="absolute" left={0} top={0} width={zone.cols} height={zone.rows} overflow="hidden">
        {pressButton(ui, 'settings-button-0', zone.cols)}
      </Box>
    </Box>,
  ]
}

type Lit = ReturnType<typeof optionSvg>

/** A place of the panel: its look under the pointer, if it has one, then its presses. */
function panelZone(ui: Table, key: string, pressKey: string, zone: Zone, lit: Lit | null, button: string, panel: PanelCells) {
  const { Box, Svg } = ui
  return (
    <Box key={key} {...zoneBox(zone, panel.left, panel.top)}>
      {lit && !panel.bare ? (
        <Box position="absolute" left={lit.left - zone.left} top={lit.top - zone.top} {...onCells(zone)} width={lit.cols} height={lit.rows} flexDirection="column" display="none" hover={{ display: 'flex' }}>
          <Svg source={lit.source} alt={t('settings.title')} width={lit.width} height={lit.height} />
        </Box>
      ) : null}
      <Box key={pressKey} position="absolute" left={0} top={0} width={zone.cols} height={zone.rows} overflow="hidden">
        {pressButton(ui, button, zone.cols)}
      </Box>
    </Box>
  )
}

function departureZone(ui: Table, id: Departure, chosen: boolean, panel: PanelCells, place: SettingsPlace) {
  return panelZone(ui, `settings-zone-${id}`, `settings-${id}`, zoneCells(place.options[id]), chosen ? null : optionSvg(id, place), `settings-${id}-0`, panel)
}

function hearthZone(ui: Table, id: OptionId, name: string, lit: Lit | null, panel: PanelCells, place: SettingsPlace) {
  return panelZone(ui, `settings-zone-${id}`, `${name}-zone`, zoneCells(place.options[id]), lit, name, panel)
}

function stepZone(ui: Table, value: CompactBefore, chosen: boolean, panel: PanelCells, place: SettingsPlace) {
  const name = `hearth-compact-${value}`
  return panelZone(ui, `settings-zone-${name}`, `${name}-zone`, zoneCells(place.steps[COMPACT_STEPS.indexOf(value)]!), chosen ? null : stepSvg(value, place), name, panel)
}

function themeZone(ui: Table, id: RoomTheme, chosen: boolean, panel: PanelCells, place: SettingsPlace) {
  const name = `theme-${id}`
  return panelZone(ui, `settings-zone-${name}`, `${name}-zone`, zoneCells(place.themes[ROOM_THEMES.indexOf(id)]!), chosen ? null : themeSvg(id, place), name, panel)
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

/** Over everything else in the room: the button, and while it is open the panel, last of all. `looks`: its places light up under the pointer. */
export function settingsElements(ui: Table, view: SettingsView, frame: Frame, looks = true) {
  const { Box, Svg } = ui
  const button = settingsButton(ui, view.open, frame)
  if (!view.open) return button
  const place = settingsPlace(frame.width, frame.height, view.briefingMode)
  const drawn = settingsSvg(view, place)
  const cells = { ...drawn, bare: !looks }
  const panel = (
    <Box key="settings-panel" position="absolute" left={drawn.left} top={drawn.top} width={drawn.cols} height={drawn.rows}>
      <Svg source={drawn.source} alt={drawn.alt} width={drawn.width} height={drawn.height} />
      {OPTIONS.map(id => departureZone(ui, id, id === view.departure, cells, place))}
      {hearthZones(ui, view, cells, place)}
      {ROOM_THEMES.map(id => themeZone(ui, id, id === view.theme, cells, place))}
    </Box>
  )
  return [...button, panel]
}
