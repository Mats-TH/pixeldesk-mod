import type { EngineInterface, RenderElement } from 'claude-code'

import type { AgentRecord, ChatTurn, DrawnPlan, Briefing, Hearth, Seen, SettingsView } from '../types'
import { desk, metaOf, sayOf, summaryOf } from './agents'
import { SHADOW, WIDE, bubblePlace, agentCard, cardAlt, cardPlace, cardSvg, managerCard, stepCard, zoneCells } from './card'
import type { CardZone, StepAgent } from './card'
import { briefingCard } from './card-briefing'
import type { BriefingCard } from './card-briefing'
import { hearthCard } from './card-hearth'
import { managerSay, minutesBetween } from './chat'
import { managerOf } from './desks'
import { log } from './disk'
import { plural, t } from './i18n'
import type { Memory } from './memory'
import { COLD_HEARTH, boardLines, deskBoxes, hearthBox, letterBox, lineSvg, managerBox, roomBackSvg, roomCountSvg, roomSvg, settled, viewOf, zoomPair } from './room'
import type { HearthLook, HearthPanel, RoomDesk, RoomInput } from './room'
import { buttonLit, crabAsleep, crabLayer, decorLayers, deskLayers, fireLayer, keeperLayer, labelsSvg } from './room-layers'
import type { Layer } from './room-layers'
import { CELL_H, CELL_W, cellsOf, hoverZone, lightest, liveBox } from './view-shared'
import { panelCells, pressRows, settingsElements } from './view-settings'
import type { PanelCells } from './view-settings'
import type { Frame, Table } from './view-shared'
import { packOf } from './pixel/themes'

// The engine refuses a drawing past this many characters.
const SVG_MAX = 131_072

export type RoomView = {
  agents: readonly AgentRecord[]
  summaries: Readonly<Record<string, string>>
  plan: DrawnPlan | null
  seen: Seen
  tokens: number
  cost: number | null
  now: number
  chat: ChatTurn
  settings: SettingsView
  hearth: Hearth | null
  briefing: Briefing | null
}

/** What the open settings panel leaves a zone: it only exists from its right or from below it. */
export const clearOf = (zone: CardZone, panel: PanelCells | null) => !panel || zone.left >= panel.left + panel.cols || zone.top >= panel.top + panel.rows

/** A desk's box in cells of the pane, on the rows a short pane keeps: it loses as much at the top as at the bottom. */
function zoneOf(b: { x: number; y: number; w: number; h: number }, n: number, frame: Frame): CardZone {
  const room = viewOf(n)
  const crop = Math.max(0, (room.h * frame.width) / room.w - frame.height) / 2
  return { left: Math.round(b.x / CELL_W), top: Math.round((b.y - crop) / CELL_H), width: Math.max(1, Math.round(b.w / CELL_W)), height: Math.max(1, Math.round(b.h / CELL_H)) }
}

/** The hover zones of the desks. */
function deskZones(ui: Table, view: RoomView, frame: Frame, panel: PanelCells | null) {
  const n = view.agents.length
  const boxes = deskBoxes(n, frame.width, frame.height, view.settings.theme)
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
  const zone = zoneOf(managerBox(n, frame.width, frame.height, view.settings.theme), n, frame)
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
    const light = lineSvg(step.status, l.label, l, board.scale, CELL_W, CELL_H, packOf(view.settings.theme).board)
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

/**
 * The image under all else and its count, each sent once with the zoom of an arrival. `still`: a plain image reloads
 * at no cost, so nothing holds its zoom back once the arrival is over.
 */
function drawings(m: Memory, input: RoomInput, previous: number, image: (p: RoomInput) => string, still: boolean) {
  const n = input.desks.length
  const at = (zoom: boolean) => ({ ...input, previous: zoom ? previous : n })
  const pair = zoomPair(m.roomPair, previous !== n, zoom => image(at(zoom)), zoom => roomCountSvg(at(zoom)))
  m.roomPair = still && previous === n ? settled(pair) : pair
  return m.roomPair
}

/** What the plate over the stove says, when it says anything. */
function panelOf(hearth: Hearth | null, briefing: Briefing | null): HearthPanel | null {
  const title = t('hearth.panel.title')
  const panel = (sub: string, letter: HearthPanel['letter']) => ({ title, sub, letter, button: false })
  switch (briefing?.phase) {
    case 'offered': return { title: t('hearth.panel.change'), sub: '', letter: 'discreet', button: true }
    case 'waiting': {
      const n = briefing.waitingAgents + briefing.waitingChats
      return panel(n ? plural('hearth.panel.after', n, { n }) : t('hearth.panel.afterTurn'), 'waiting')
    }
    case 'writing': return panel(t('hearth.panel.writing'), 'discreet')
    case 'ready': return panel(t('hearth.panel.ready'), 'bright')
    default: return hearth?.ash === 'full' && briefing?.phase !== 'failed' ? panel('', 'discreet') : null
  }
}

const LETTERS: Partial<Record<Briefing['phase'], HearthLook['letter']>> = { offered: 'discreet', waiting: 'waiting', writing: 'discreet', ready: 'bright', failed: 'discreet' }

/** The hearth as the room shows it. A visit holds back what the logic has already moved, until the keeper gets there. */
function hearthLook(m: Memory, { hearth, briefing }: RoomView): HearthLook {
  const letter = LETTERS[briefing?.phase ?? 'idle'] ?? null
  if (!hearth) return { ...COLD_HEARTH, letter }
  const shown = m.hearthShown ?? { fire: hearth.fire, ash: hearth.ash }
  if (!hearth.keeper) {
    m.hearthShown = { fire: hearth.fire, ash: hearth.ash }
    m.visit = null
  } else if (m.visit?.run !== hearth.keeperRun) m.visit = { ...shown, run: hearth.keeperRun, tool: hearth.keeper, layer: null }
  const fire = m.visit?.tool === 'log' ? m.visit.fire : hearth.fire
  return { fire, ash: hearth.ash, letter, panel: panelOf(hearth, briefing) }
}

/** The keeper's drawing, once for each visit: a source that moved would start him over. */
function keeperOf(m: Memory, input: RoomInput): Layer | null {
  const v = m.visit
  if (!v) return null
  v.layer ??= keeperLayer(input, v.tool, v.run, v)
  return v.layer
}

/** The card of the hearth, over the stove. */
function hearthZone(ui: Table, view: RoomView, frame: Frame, panel: PanelCells | null) {
  const n = view.agents.length
  const zone = zoneOf(hearthBox(n, frame.width, frame.height, view.settings.theme), n, frame)
  if (!view.hearth || !clearOf(zone, panel)) return null
  const card = hearthCard({ hearth: view.hearth, fire: view.settings.fire, now: view.now })
  return hoverZone(ui, 'hearth-card', zone, cardSvg(card, frame.width, frame.height), cardAlt(card), frame)
}

// The height of a button on the briefing's card, as `card-briefing.ts` draws it.
const CARD_BUTTON_H = 24

/** The first row of a zone goes by the gesture's own key, the next ones add their row to it. */
const gestureRow = (name: string) => (row: number) => (row ? `${name}-${row}` : name)

/** The button on the stove: the labels show it, this is its look under the pointer, and one blank Button per row, as a press only reaches the engine on a Button. */
function changeZone(ui: Table, input: RoomInput, label: string) {
  const { Box, Svg } = ui
  const lit = buttonLit(input, label)
  return (
    <Box key="hearth-change" position="absolute" left={lit.left} top={lit.top} width={lit.cols} height={lit.rows}>
      <Box position="absolute" left={0} top={0} display="none" hover={{ display: 'flex' }}>
        <Svg source={lit.source} alt={label} width={lit.width} height={lit.height} />
      </Box>
      <Box position="absolute" left={0} top={0} width={lit.cols} height={lit.rows} overflow="hidden">
        {pressRows(ui, gestureRow('briefing-change'), lit.cols, lit.rows)}
      </Box>
    </Box>
  )
}

/** The press of a button the briefing's card draws, in the cells of the card. */
function cardButton(ui: Table, b: BriefingCard['buttons'][number], k: number) {
  const { Box } = ui
  const zone = zoneCells({ x: b.x * k, y: b.y * k, w: b.w * k, h: CARD_BUTTON_H * k })
  return (
    <Box key={`zone-${b.key}`} position="absolute" left={zone.left} top={zone.top} width={zone.cols} height={zone.rows} overflow="hidden">
      {pressRows(ui, gestureRow(b.key), zone.cols, zone.rows)}
    </Box>
  )
}

/** The card of a briefing under way, over the letter: it stays open while the pointer is on it, for its buttons. */
function briefingZone(ui: Table, view: RoomView, frame: Frame, panel: PanelCells | null) {
  const { Box, Svg } = ui
  const briefing = view.briefing
  if (!briefing || briefing.phase === 'idle') return null
  const n = view.agents.length
  const zone = zoneOf(letterBox(n, frame.width, frame.height, view.settings.theme), n, frame)
  if (!clearOf(zone, panel)) return null
  const card = briefingCard(briefing)
  const drawn = cardSvg(card, frame.width, frame.height)
  const size = cellsOf(drawn)
  const at = cardPlace(zone, size, frame.pane)
  return (
    <Box key="briefing-card" position="absolute" left={zone.left} top={zone.top} width={zone.width} height={zone.height}>
      <Box position="absolute" left={at.left - zone.left} top={at.top - zone.top} width={size.cols} height={size.rows} display="none" hover={{ display: 'flex' }}>
        <Svg source={drawn.source} alt={cardAlt(card)} width={drawn.width} height={drawn.height} />
        {card.buttons.map(b => cardButton(ui, b, drawn.width / (WIDE + SHADOW)))}
      </Box>
    </Box>
  )
}

/** The room as a drawing; null when it will not fit the engine's limit, and the list takes over. */
export async function roomView($: EngineInterface, m: Memory, ui: Table, frame: Frame, view: RoomView, mobile: boolean, list: readonly RenderElement[] | null) {
  const { Box, Svg } = ui
  const desks: RoomDesk[] = view.agents.map(desk)
  const steps = (view.plan?.steps ?? []).map(st => ({ text: st.text, status: st.status }))
  const manager = managerOf(view.chat.working ? 'working' : undefined, steps)
  const look = hearthLook(m, view)
  const input: RoomInput = { sessionId: m.sessionId, desks, manager, previous: desks.length, steps, tokens: view.tokens, cost: view.cost, theme: view.settings.theme, width: frame.width, height: frame.height, hearth: look, ...(mobile ? {} : { settings: true }) }
  // A phone's web view moves an image: the room stays whole there. On the desktop an image stands still.
  const pair = drawings(m, input, Math.min(view.seen.previous, desks.length), mobile ? roomSvg : roomBackSvg, !mobile)
  if (pair.image.sent.length > SVG_MAX) {
    await log($, m, `room drawing too large: ${pair.image.sent.length}`)
    return null
  }
  const alt = plural('pane.roomAlt', desks.length, { n: desks.length, summary: summaryOf(view.agents), manager: t(view.chat.working ? 'manager.working' : 'manager.resting') })
  const image = <Svg key="room-svg" source={pair.image.sent} alt={alt} width={frame.width} height={frame.height} />
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
  const labels = (
    <Box key="room-labels" position="absolute" left={0} top={0} width="100%" height="100%" flexDirection="column">
      <Svg source={labelsSvg(input)} alt={t('pane.labels')} width={frame.width} height={frame.height} />
    </Box>
  )
  const keeper = keeperOf(m, input)
  const board = boardLines({ desks, steps, theme: view.settings.theme, width: frame.width, height: frame.height })
  const panel = view.settings.open ? panelCells(view.settings, frame) : null
  // Once the panel reaches the board's column the lines have no zone left.
  const lines = panel && panel.left + panel.cols > Math.floor(board.left / CELL_W) ? [] : visibleLines(board.lines, frame.height)
  const whole = (
    <Box key="room" flexDirection="column" marginX={-1} height={frame.fit} overflow="hidden" backgroundColor="transparent">
      <Svg key="room-svg" source={roomSvg(input)} alt={alt} width={frame.width} height={frame.height} />
      {count}
      {settingsElements(ui, view.settings, frame)}
    </Box>
  )
  // Too heavy for the client, a room gives up the crab's walk, then the bubbles of its plan, then its cards, then its layers.
  const tree = (shed: number) => shed > 3 ? whole : (
    <Box key="room" flexDirection="column" marginX={-1} height={frame.fit} overflow="hidden" backgroundColor="transparent">
      {image}
      {count}
      {decorLayers(input).map(l => liveBox(ui, l))}
      {liveBox(ui, shed ? crabAsleep(input) : crabLayer(input))}
      {deskLayers(input, view.agents.map(a => a.id)).map(l => liveBox(ui, l))}
      {liveBox(ui, fireLayer(input, look.fire))}
      {labels}
      {keeper ? liveBox(ui, keeper) : null}
      {shed < 2 ? reveals(ui, view, input, lines, board, frame) : null}
      {shed < 3 ? managerZone(ui, view, frame, panel, false) : null}
      {shed < 3 ? deskZones(ui, view, frame, panel) : null}
      {shed < 3 ? hearthZone(ui, view, frame, panel) : null}
      {briefingZone(ui, view, frame, panel)}
      {lines.length && shed < 2 ? lineColumn(ui, lines, frame) : null}
      {look.panel?.button ? changeZone(ui, input, look.panel.title) : null}
      {settingsElements(ui, view.settings, frame)}
    </Box>
  )
  const drawn = lightest(tree, 5)
  if (!drawn) await log($, m, 'room tree too heavy: the list takes over')
  return drawn
}
