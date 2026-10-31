import type { News, RoomTheme, SettingsView } from '../types'
import { cardAlt, cardSvg, roomCard } from './card'
import type { FloorRoom } from './desks'
import { floorBoxes, floorCountSvg, floorSvg, shownRooms } from './floor'
import type { FloorInput } from './floor'
import { t } from './i18n'
import type { Memory } from './memory'
import { settled, zoomPair } from './room'
import { floorCrabLayer, floorFireLayer } from './room-layers'
import { clearOf } from './view-room'
import { panelCells, settingsElements } from './view-settings'
import type { PanelCells } from './view-settings'
import { CELL_H, CELL_W, hoverZone, lightest, liveBox } from './view-shared'
import type { Frame, Table } from './view-shared'

const minutesSince = (since: number | undefined, now: number) => (since ? Math.floor((now - since) / 60_000) : 0)

function roomZones(ui: Table, rooms: readonly FloorRoom[], frame: Frame, now: number, theme: RoomTheme, panel: PanelCells | null) {
  const shown = shownRooms(rooms)
  const boxes = floorBoxes(shown.length, frame.width, frame.height, theme)
  return shown.flatMap((r, i) => {
    const b = boxes[i]!
    const zone = { left: Math.round(b.x / CELL_W), top: Math.round(b.y / CELL_H), width: Math.max(1, Math.round(b.w / CELL_W)), height: Math.max(1, Math.round(b.h / CELL_H)) }
    if (!clearOf(zone, panel)) return []
    const card = roomCard(r, minutesSince(r.since, now))
    return [hoverZone(ui, `room-${r.id}`, zone, cardSvg(card, frame.width, frame.height), cardAlt(card), frame)]
  })
}

/** The floor plan, one cell per conversation, in place of the room. */
export function floorView(m: Memory, ui: Table, frame: Frame, rooms: FloorRoom[], news: News, now: number, mobile: boolean, settings: SettingsView) {
  const { Box, Svg } = ui
  const { theme } = settings
  const n = rooms.length
  const previous = Math.min(m.floorBefore ?? n, n)
  const at = (zoom: boolean): FloorInput => ({ rooms, previous: zoom ? previous : n, theme, width: frame.width, height: frame.height, news: { shown: news.shown, flying: news.shown < news.count }, ...(mobile ? {} : { liveFire: true }) })
  const pair = zoomPair(m.floorPair, previous !== n, zoom => floorSvg(at(zoom)), zoom => floorCountSvg(at(zoom)))
  // A phone's web view holds its image: only the desktop's comes back at every redraw.
  m.floorPair = !mobile && previous === n ? settled(pair) : pair
  const image = <Svg source={m.floorPair.image.sent} alt={t('floor.alt', { n })} width={frame.width} height={frame.height} />
  const count = (
    <Box key="floor-count" position="absolute" left={0} top={0} width="100%" height="100%" flexDirection="column">
      <Svg source={m.floorPair.count.sent} alt="tokens" width={frame.width} height={frame.height} />
    </Box>
  )
  if (mobile) {
    return (
      <Box key="floor" flexDirection="column" width="100%" backgroundColor="transparent">
        {image}
        {count}
      </Box>
    )
  }
  const shown = shownRooms(rooms).length
  const crab = floorCrabLayer(shown, frame.width, frame.height, theme)
  const fire = floorFireLayer(shown, frame.width, frame.height, theme)
  const panel = settings.open ? panelCells(settings, frame) : null
  // Too heavy for the client, a floor gives up its cards, then the crab's rounds.
  const tree = (shed: number) => (
    <Box key="floor" flexDirection="column" marginX={-1} height={frame.fit} overflow="hidden" backgroundColor="transparent">
      {image}
      {count}
      {fire ? liveBox(ui, fire) : null}
      {crab && shed < 2 ? liveBox(ui, crab) : null}
      {shed ? null : roomZones(ui, rooms, frame, now, theme, panel)}
      {settingsElements(ui, settings, frame)}
    </Box>
  )
  return lightest(tree, 2) ?? tree(2)
}
