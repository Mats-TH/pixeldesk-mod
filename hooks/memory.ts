import type { Timer } from 'claude-code'

import type { AgentRecord, Ash, ChatTurn, CompactBefore, Departure, Fire, BriefingMode, BriefingPhase, Keeper, News, PlanStep, RoomTheme, Seen, RelaunchStop } from '../types'
import type { ChatState, SessionLink } from './desks'
import type { Language } from './i18n'
import type { SummaryMark } from './plain'
import { NOTHING_DRAWN } from './room'
import type { DrawnPair } from './room'
import type { Layer } from './room-layers'

/** The pane's id and the full name of the tool, as the notes to the model spell it. */
export const PANE = 'pixeldesk'
export const PLAN_TOOL = 'mcp__pixeldesk__plan'
export const MOVE_TOOL = 'mcp__pixeldesk__move'

/** The plan of the main conversation, as the mod keeps it. */
export type Plan = { title: string; steps: PlanStep[]; updatedAt: string }

/** What a turn of the main conversation has told the model so far. */
export type Turn = { planSeen: boolean; noted: boolean; calls: number; staleSent: boolean }

export const FRESH_TURN: Turn = { planSeen: false, noted: false, calls: 0, staleSent: false }

/** The conversation's turn before it has had one. */
export const NO_TURN: ChatTurn = { working: false, since: 0, ended: 0, count: 0, now: '' }

/** The cache's two known lengths. */
export type CacheLength = '5m' | '1h'

/** The cache and the context as the mod follows them; the hearth is what the drawings get of it. */
export type Heat = {
  // When the request that last reached the cache left, 0 with no clock; the model that made it; how long it lasts.
  at: number
  model: string
  lengthMs: number
  known: CacheLength | null
  lengthReadAt: number
  transcript: string
  // The main loop's requests in flight, and when its last turn ended.
  requests: number
  endedAt: number
  sending: boolean
  relaunches: number
  since: number
  failures: number
  retryAt: number
  stop: RelaunchStop | null
  error: string
  toldFailure: boolean
  wasActive: boolean
  percent: number
  tokens: number
  compactions: number
  compacting: boolean
  ownCompact: boolean
  keeper: Keeper | null
  keeperRun: number
  keeperUntil: number
  // The prompts of the mod's own forks, and the turns they raised: neither is a turn of the conversation.
  forks: Set<string>
  forkTurns: Set<string>
  // Nothing of the mod can be seen: no model call goes out on its own.
  blind: boolean
  shown: string
  alarm: Timer | null
  pulsing: boolean
  again: boolean
}

/** What the room's hearth showed last between two visits. */
export type HearthShown = { fire: Fire; ash: Ash }

/** The keeper's visit under way: what he comes to change stays as it was until his moment, and his drawing never moves. */
export type Visit = HearthShown & { run: number; tool: Keeper; layer: Layer | null }

/** A change of conversation as the mod runs it. `wanted`: someone asked, and the writing waits for its conditions. */
export type Change = {
  phase: BriefingPhase
  wanted: boolean
  // It runs to the end with no gesture; it does not wait for the agents.
  auto: boolean
  forced: boolean
  // At most one automatic step for each end of turn, and none under this many tokens once refused.
  acted: boolean
  snooze: number
  step: number
  file: string | null
  text: string
  words: number
  error: string
  note: string
  opening: boolean
  shown: string
  // Cuts the writing under way: nothing of a briefing someone closed may come back.
  stop: AbortController | null
}

/** All the mod holds in memory for one load: a reload starts over, from the host's state and the files. */
export type Memory = {
  forced: Language | null
  started: boolean
  home: string
  sessionId: string
  cwd: string
  hidden: boolean
  departure: Departure
  theme: RoomTheme
  fire: boolean
  briefingMode: BriefingMode
  compactBefore: CompactBefore
  heat: Heat
  change: Change
  wake: () => void
  logs: Promise<void>
  agents: AgentRecord[]
  // Agents gone for good, and ids no list names: neither comes back through a call in flight.
  gone: Set<string>
  strangers: Set<string>
  goneTokens: number
  mainTokens: number
  shownTokens: number
  nextHue: number
  nextSeat: number
  poll: Timer | null
  polling: boolean
  marks: Map<string, SummaryMark>
  connectors: Map<string, string>
  plan: Plan | null
  turn: Turn
  shimmer: Timer | null
  shimmerStep: number
  seen: Seen
  roomPair: DrawnPair
  floorPair: DrawnPair
  floorBefore: number | null
  hearthShown: HearthShown | null
  visit: Visit | null
  news: News
  flight: Timer | null
  // The peer deliveries still on their way in, and whether each was counted on arrival.
  arrivals: boolean[]
  chat: ChatState | undefined
  chatTurn: ChatTurn
  lastDesk: string
  deskAt: number
  links: SessionLink[]
  linksAt: number
  ticking: boolean
}

const FIVE_MINUTES = 300_000

const coldHeat = (): Heat => ({
  at: 0,
  model: '',
  lengthMs: FIVE_MINUTES,
  known: null,
  lengthReadAt: 0,
  transcript: '',
  requests: 0,
  endedAt: 0,
  sending: false,
  relaunches: 0,
  since: 0,
  failures: 0,
  retryAt: 0,
  stop: null,
  error: '',
  toldFailure: false,
  wasActive: false,
  percent: 0,
  tokens: 0,
  compactions: 0,
  compacting: false,
  ownCompact: false,
  keeper: null,
  keeperRun: 0,
  keeperUntil: 0,
  forks: new Set(),
  forkTurns: new Set(),
  blind: false,
  shown: '',
  alarm: null,
  pulsing: false,
  again: false,
})

const noChange = (): Change => ({ phase: 'idle', wanted: false, auto: false, forced: false, acted: false, snooze: 0, step: 0, file: null, text: '', words: 0, error: '', note: '', opening: false, shown: '', stop: null })

export const createMemory = (forced: Language | null): Memory => ({
  forced,
  started: false,
  home: '',
  sessionId: '',
  cwd: '',
  hidden: false,
  departure: 'plan',
  theme: 'cosy',
  fire: true,
  briefingMode: 'auto',
  compactBefore: 2,
  heat: coldHeat(),
  change: noChange(),
  wake: () => undefined,
  logs: Promise.resolve(),
  agents: [],
  gone: new Set(),
  strangers: new Set(),
  goneTokens: 0,
  mainTokens: 0,
  shownTokens: 0,
  nextHue: 1,
  nextSeat: 0,
  poll: null,
  polling: false,
  marks: new Map(),
  connectors: new Map(),
  plan: null,
  turn: FRESH_TURN,
  shimmer: null,
  shimmerStep: 0,
  seen: { shown: 0, previous: 0 },
  roomPair: NOTHING_DRAWN,
  floorPair: NOTHING_DRAWN,
  floorBefore: null,
  hearthShown: null,
  visit: null,
  news: { count: 0, shown: 0 },
  flight: null,
  arrivals: [],
  chat: undefined,
  chatTurn: NO_TURN,
  lastDesk: '',
  deskAt: 0,
  links: [],
  linksAt: 0,
  ticking: false,
})
