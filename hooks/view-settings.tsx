import type { Departure, SettingsView } from '../types'
import { drawnCells, gearSvg, optionSvg, settingsPlace, settingsSvg, zoneCells } from './card'
import type { GearLook } from './card'
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

/**
 * One invisible Button per row of a zone. A press only reaches the engine on a Button, so a zone is filled with them:
 * blank, wider than the zone so that no ellipsis shows, and answered by the `ui.press` hooks.
 */
function pressRows({ Box, Button }: Table, name: string, cols: number, rows: number) {
  const label = NO_BREAK.repeat(cols * 3)
  const buttons = Array.from({ length: Math.min(ZONE_ROWS, rows) }, (_, i) => <Button key={`${name}-${i}`} plain label={label} hover={{ backgroundColor: 'transparent' }} onPress={ignore} />)
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
        <Box position="absolute" left={at.left - zone.left} top={at.top - zone.top} display="none" hover={{ display: 'flex' }}>
          <Svg source={hover.source} alt={t('settings.title')} width={hover.width} height={hover.height} />
        </Box>
      )}
      <Box position="absolute" left={0} top={0} width={zone.cols} height={zone.rows} overflow="hidden">
        {pressRows(ui, 'settings-button', zone.cols, zone.rows)}
      </Box>
    </Box>,
  ]
}

function optionZone(ui: Table, id: Departure, chosen: boolean, panel: PanelCells, frame: Frame) {
  const { Box, Svg } = ui
  const place = settingsPlace(frame.width, frame.height)
  const zone = zoneCells(place.options[id])
  const lit = chosen ? null : optionSvg(id, place)
  return (
    <Box key={`settings-zone-${id}`} position="absolute" left={zone.left - panel.left} top={zone.top - panel.top} width={zone.cols} height={zone.rows}>
      {lit ? (
        <Box position="absolute" left={lit.left - zone.left} top={lit.top - zone.top} display="none" hover={{ display: 'flex' }}>
          <Svg source={lit.source} alt={t('settings.title')} width={lit.width} height={lit.height} />
        </Box>
      ) : null}
      <Box key={`settings-${id}`} position="absolute" left={0} top={0} width={zone.cols} height={zone.rows} overflow="hidden">
        {pressRows(ui, `settings-${id}`, zone.cols, zone.rows)}
      </Box>
    </Box>
  )
}

/** What the open panel covers: the same cells its drawing lands on. */
export function panelCells(choice: Departure, frame: Frame): PanelCells {
  const { left, top, cols, rows } = settingsSvg(choice, settingsPlace(frame.width, frame.height))
  return { left, top, cols, rows }
}

/** Over everything else in the room: the button, and while it is open the panel, last of all. */
export function settingsElements(ui: Table, view: SettingsView, frame: Frame) {
  const { Box, Svg } = ui
  const button = settingsButton(ui, view.open, frame)
  if (!view.open) return button
  const drawn = settingsSvg(view.departure, settingsPlace(frame.width, frame.height))
  const panel = (
    <Box key="settings-panel" position="absolute" left={drawn.left} top={drawn.top} width={drawn.cols} height={drawn.rows}>
      <Svg source={drawn.source} alt={drawn.alt} width={drawn.width} height={drawn.height} />
      {OPTIONS.map(id => optionZone(ui, id, id === view.departure, drawn, frame))}
    </Box>
  )
  return [...button, panel]
}
