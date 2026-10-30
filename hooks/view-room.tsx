import type { EngineInterface, RenderElement } from 'claude-code'

import type { AgentRecord, ChatTurn, DrawnPlan, Seen, SettingsView } from '../types'
import { desk, metaOf, sayOf, summaryOf } from './agents'
import { bubblePlace, agentCard, cardAlt, cardSvg, managerCard, stepCard } from './card'
import type { CardZone, StepAgent } from './card'
import { managerSay, minutesBetween } from './chat'
import { managerOf } from './desks'
import { log } from './disk'
import { plural, t } from './i18n'
import type { Memory } from './memory'
import { boardLines, deskBoxes, lineSvg, managerBox, roomCountSvg, roomSvg, viewOf, zoomPair } from './room'
import type { RoomDesk, RoomInput } from './room'
import { CELL_H, CELL_W, cellsOf, hoverZone } from './view-shared'
import { panelCells, settingsElements } from './view-settings'
import type { PanelCells } from './view-settings'
import type { Frame, Table } from './view-shared'

// The engine refuses a drawing past this many characters.
const SVG_MAX = 131_072

export type RoomView = {
  agents: readonly AgentRecord[]
  summaries: Readonly<Record<string, string>>
  plan: DrawnPlan | null
  seen: Seen
  tokens: number
  now: number
  chat: ChatTurn
  settings: SettingsView
}

/** What the open settings panel leaves a zone: it only exists from its right or from below it. */
const clearOf = (zone: CardZone, panel: PanelCells | null) => !panel || zone.left >= panel.left + panel.cols || zone.top >= panel.top + panel.rows

/** A desk's box in cells of the pane, on the rows a short pane keeps: it loses as much at the top as at the bottom. */
function zoneOf(b: { x: number; y: number; w: number; h: number }, n: number, frame: Frame): CardZone {
  const room = viewOf(n)
  const crop = Math.max(0, (room.h * frame.width) / room.w - frame.height) / 2
  return { left: Math.round(b.x / CELL_W), top: Math.round((b.y - crop) / CELL_H), width: Math.max(1, Math.round(b.w / CELL_W)), height: Math.max(1, Math.round(b.h / CELL_H)) }
}

/** The hover zones of the desks. */
function deskZones(ui: Table, view: RoomView, frame: Frame, panel: PanelCells | null) {
  const n = view.agents.length
  const boxes = deskBoxes(n, frame.width, frame.height)
  return view.agents.flatMap((agent, i) => {
    const zone = zoneOf(boxes[i]!, n, frame)
    if (!clearOf(zone, panel)) return []
    const card = agentCard({ role: desk(agent).title, task: agent.description, text: sayOf(agent, view.summaries), meta: metaOf(agent, view.now), state: agent.phase, hue: agent.hue, plan: agent.plan ?? [] })
    return [hoverZone(ui, `desk-${agent.id}`, zone, cardSvg(card, frame.width, frame.height), cardAlt(card), frame)]
  })
}

/** The manager's card: what the conversation is doing, or how long it has been at rest. */
function managerCardOf({ chat, plan, now }: RoomView) {
  if (chat.working) {
    const meta = plural('pane.meta', chat.count, { m: minutesBetween(chat.since, now), n: chat.count })
    return managerCard({ working: true, title: plan?.title ?? '', text: managerSay(chat, plan), meta, plan: plan?.steps ?? [] })
  }
  return managerCard({ working: false, title: '', text: '', meta: chat.ended ? t('manager.lastWork', { m: minutesBetween(chat.ended, now) }) : '', plan: [] })
}

/** The manager's hover zone. On a phone it stands bare: nothing hovers there. */
function managerZone(ui: Table, view: RoomView, frame: Frame, panel: PanelCells | null, mobile: boolean) {
  const { Box } = ui
  const n = view.agents.length
  const zone = zoneOf(managerBox(n, frame.width, frame.height), n, frame)
  if (mobile) return <Box key="desk-manager" position="absolute" left={zone.left} top={zone.top} width={zone.width} height={zone.height} />
  if (!clearOf(zone, panel)) return null
  const card = managerCardOf(view)
  return hoverZone(ui, 'desk-manager', zone, cardSvg(card, frame.width, frame.height), cardAlt(card), frame)
}

type Line = ReturnType<typeof boardLines>['lines'][number] & { i: number }

/** The lines that keep a zone: those whose middle stays in the pane. */
function visibleLines(lines: ReturnType<typeof boardLines>['lines'], height: number): Line[] {
  return lines.map((l, i) => ({ ...l, i })).filter(l => l.y + l.h / 2 >= 0 && l.y + l.h / 2 < height)
}

/**
 * One column of whole rows over the board, its zones sharing it out by height: they cannot overlap, a line may be
 * thinner than a row, and the zones add up to the column to the pixel since they are cut at the same whole edges.
 */
function lineColumn({ Box }: Table, lines: readonly Line[], frame: Frame) {
  const first = lines[0]!
  const last = lines[lines.length - 1]!
  const top = Math.max(0, Math.floor(first.y / CELL_H))
  const bottom = Math.min(frame.pane.rows, Math.ceil((last.y + last.h) / CELL_H))
  if (bottom <= top) return null
  const edge = (y: number) => Math.round(Math.max(top * CELL_H, Math.min(bottom * CELL_H, y)))
  const edges = [...lines.map(l => edge(l.y)), edge(last.y + last.h)]
  const left = Math.floor(first.x / CELL_W)
  const right = Math.ceil(Math.max(...lines.map(l => l.x + l.w)) / CELL_W)
  return (
    <Box key="plan-lines" position="absolute" left={left} top={top} width={Math.max(1, Math.min(right, frame.pane.cols) - left)} height={bottom - top} flexDirection="column">
      <Box key="line-head" flexGrow={edges[0]! - top * CELL_H} />
      {lines.map((l, k) => <Box key={`line-${l.i}`} flexGrow={edges[k + 1]! - edges[k]!} hover={{ scope: `line-${l.i}` }} />)}
      <Box key="line-tail" flexGrow={bottom * CELL_H - edges[lines.length]!} />
    </Box>
  )
}

/** Under each line, what the pointer on it lights up: the line itself, then its bubble. */
function reveals({ Box, Svg }: Table, view: RoomView, input: Pick<RoomInput, 'desks' | 'steps'>, lines: readonly Line[], board: ReturnType<typeof boardLines>, frame: Frame) {
  const steps = view.plan?.steps ?? []
  const agents: StepAgent[] = input.desks.map(d => ({ role: d.title, hue: d.hue, state: d.state }))
  return lines.map(l => {
    const step = steps[l.i]!
    const scope = `line-${l.i}`
    const light = lineSvg(step.status, l.label, l, board.scale, CELL_W, CELL_H)
    const card = stepCard(step, agents)
    const bubble = cardSvg(card, frame.width, frame.height)
    const place = bubblePlace(Math.floor(board.left / CELL_W), (l.y + l.h / 2) / CELL_H, Math.ceil(board.under / CELL_H), cellsOf(bubble), frame.pane)
    return (
      <Box key={`reveal-${l.i}`} position="absolute" left={0} top={0}>
        <Box position="absolute" left={Math.max(0, Math.min(light.left, frame.pane.cols - light.cols))} top={Math.max(0, Math.min(light.top, frame.pane.rows - light.rows))} display="none" hover={{ display: 'flex', scope }}>
          <Svg source={light.source} alt={l.label} width={light.width} height={light.height} />
        </Box>
        <Box position="absolute" left={place.left} top={place.top} display="none" hover={{ display: 'flex', scope }}>
          <Svg source={bubble.source} alt={cardAlt(card)} width={bubble.width} height={bubble.height} />
        </Box>
      </Box>
    )
  })
}

/** The room and its count, each sent once with the zoom of an arrival. */
function drawings(m: Memory, input: RoomInput, previous: number) {
  const n = input.desks.length
  const at = (zoom: boolean) => ({ ...input, previous: zoom ? previous : n })
  m.roomPair = zoomPair(m.roomPair, previous !== n, zoom => roomSvg(at(zoom)), zoom => roomCountSvg(at(zoom)))
  return m.roomPair
}

/** The room as a drawing; null when it will not fit the engine's limit, and the list takes over. */
export async function roomView($: EngineInterface, m: Memory, ui: Table, frame: Frame, view: RoomView, mobile: boolean, list: readonly RenderElement[] | null) {
  const { Box, Svg } = ui
  const desks: RoomDesk[] = view.agents.map(desk)
  const steps = (view.plan?.steps ?? []).map(st => ({ text: st.text, status: st.status }))
  const manager = managerOf(view.chat.working ? 'working' : undefined, steps)
  const input: RoomInput = { sessionId: m.sessionId, desks, manager, previous: desks.length, steps, tokens: view.tokens, width: frame.width, height: frame.height, ...(mobile ? {} : { settings: true }) }
  const pair = drawings(m, input, Math.min(view.seen.previous, desks.length))
  if (pair.image.sent.length > SVG_MAX) {
    await log($, m, `room drawing too large: ${pair.image.sent.length}`)
    return null
  }
  const alt = plural('pane.roomAlt', desks.length, { n: desks.length, summary: summaryOf(view.agents), manager: t(view.chat.working ? 'manager.working' : 'manager.resting') })
  const image = <Svg key="room-svg" source={pair.image.sent} alt={alt} width={frame.width} height={frame.height} isInteractive />
  const count = (
    <Box key="room-count" position="absolute" left={0} top={0} width="100%" height="100%" flexDirection="column">
      <Svg source={pair.count.sent} alt="tokens" width={frame.width} height={frame.height} />
    </Box>
  )
  if (mobile) {
    return (
      <Box key="room" flexDirection="column" width="100%" backgroundColor="transparent">
        {image}
        {count}
        {managerZone(ui, view, frame, null, true)}
        {list}
      </Box>
    )
  }
  const board = boardLines({ desks, steps, width: frame.width, height: frame.height })
  const panel = view.settings.open ? panelCells(view.settings.departure, frame) : null
  // Once the panel reaches the board's column the lines have no zone left.
  const lines = panel && panel.left + panel.cols > Math.floor(board.left / CELL_W) ? [] : visibleLines(board.lines, frame.height)
  return (
    <Box key="room" flexDirection="column" marginX={-1} height={frame.fit} overflow="hidden" backgroundColor="transparent">
      {image}
      {count}
      {reveals(ui, view, input, lines, board, frame)}
      {managerZone(ui, view, frame, panel, false)}
      {deskZones(ui, view, frame, panel)}
      {lines.length ? lineColumn(ui, lines, frame) : null}
      {settingsElements(ui, view.settings, frame)}
    </Box>
  )
}
