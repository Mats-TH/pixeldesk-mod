import type { Elements } from 'claude-code'
import type { Host } from './host'

import type { AgentPhase, AgentRecord, ChatTurn, DrawnPlan } from '../types'
import { healed, sayOf, seated, summaryOf } from './agents'
import { managerSay } from './chat'
import { keptRoom } from './desks'
import type { FloorRoom } from './desks'
import { postName, t } from './i18n'
import { NO_TURN } from './memory'
import type { Memory } from './memory'
import { readAgents, readCardClock, readChat, readFloorRooms, readBriefing, readHearth, readMinute, readNews, readPlan, readSeen, readSettings, readSub, readSummaries, readTokens, readCost } from './state'
import { floorView } from './view-floor'
import { roomView } from './view-room'
import type { RoomView } from './view-room'
import { followLanguage, frameOf } from './view-shared'
import type { Pane, Table } from './view-shared'

type Words = Pick<Elements['desktop'], 'Box' | 'Text'>

const MARKS: Record<AgentPhase, string> = { working: '●', done: '✓', failed: '✗' }
const HEADER_COLOR = '#eab308'
const LINE = 'truncate-end'

/** The manager's line, whatever else the list holds. */
function managerRow({ Box, Text }: Words, chat: ChatTurn, plan: DrawnPlan | null, sub: boolean) {
  const [mark, say] = chat.working ? ['●', managerSay(chat, plan)] : ['○', t('state.rest')]
  return (
    <Box key="row-manager">
      <Text wrap={LINE}>{t('pane.rowAgent', { mark, description: postName(sub), say })}</Text>
    </Box>
  )
}

function agentRows({ Text }: Words, agents: readonly AgentRecord[], summaries: Readonly<Record<string, string>>) {
  return agents.map(agent => <Text wrap={LINE}>{t('pane.rowAgent', { mark: MARKS[agent.phase], description: agent.description, say: sayOf(agent, summaries) })}</Text>)
}

function roomRows({ Text }: Words, rooms: readonly FloorRoom[]) {
  return rooms.map(r => <Text wrap={LINE}>{t('pane.rowRoom', { mark: r.working ? '●' : '○', title: r.title, summary: r.summary || t('band.idle') })}</Text>)
}

/** The pane in words, for a surface with no drawing and for a room too large to draw. */
function listView(ui: Words, width: number, agents: readonly AgentRecord[], summaries: Readonly<Record<string, string>>, rooms: readonly FloorRoom[], chat: ChatTurn, plan: DrawnPlan | null, sub: boolean) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" gap={1}>
        <Text bold>{t('pane.header')}</Text>
        <Text color={HEADER_COLOR}>{summaryOf(agents)}</Text>
      </Box>
      {managerRow(ui, chat, plan, sub)}
      {agentRows(ui, agents, summaries)}
      {roomRows(ui, rooms)}
    </Box>
  )
}

/** The pane: the floor when this conversation leads others, else its room, else the same in words. */
export async function drawPane(host: Host, m: Memory, e: Pane) {
  await followLanguage(host, m)
  const summaries = (await readSummaries(host)) ?? {}
  const plan = (await readPlan(host)) ?? null
  const tokens = (await readTokens(host)) ?? 0
  const cost = (await readCost(host)) ?? null
  const news = (await readNews(host)) ?? { count: 0, shown: 0 }
  await readMinute(host)
  await readCardClock(host)
  const agents = seated(((await readAgents(host)) ?? []).map(healed))
  const rooms = ((await readFloorRooms(host)) ?? []).map(keptRoom)
  const chat = (await readChat(host)) ?? NO_TURN
  const sub = (await readSub(host)) ?? false
  const words = () => listView(host.ui.resolve(e) as unknown as Words, Math.max(1, e.props.bodyColumns || 0), agents, summaries, rooms, chat, plan, sub)
  if (e.surface === 'terminal') return words()
  const ui = host.ui.resolve(e) as unknown as Table
  const frame = frameOf(e)
  const mobile = e.surface === 'mobile'
  const now = await host.clock.now()
  const settings = (await readSettings(host)) ?? { open: false, departure: m.departure, fire: m.fire, briefingMode: m.briefingMode, compactBefore: m.compactBefore, theme: m.theme }
  if (rooms.length) return floorView(m, ui, frame, rooms, news, now, mobile, settings)
  const seen = (await readSeen(host)) ?? { shown: agents.length, previous: agents.length }
  const view: RoomView = { agents, summaries, plan, seen, tokens, cost, now, chat, sub, settings, hearth: (await readHearth(host)) ?? null, briefing: (await readBriefing(host)) ?? null }
  const list = host.ui.resolve(e) as unknown as Words
  const rows = mobile ? [managerRow(list, chat, plan, sub), ...agentRows(list, agents, summaries)] : null
  return (await roomView(host, m, ui, frame, view, mobile, rows)) ?? words()
}
