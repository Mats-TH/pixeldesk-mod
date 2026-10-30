import type { Timer } from 'claude-code'

import type { AgentRecord, ChatTurn, Departure, News, PlanStep, Seen } from '../types'
import type { ChatState, SessionLink } from './desks'
import type { Language } from './i18n'
import type { SummaryMark } from './plain'
import { NOTHING_DRAWN } from './room'
import type { DrawnPair } from './room'

/** The pane's id and the full name of the tool, as the notes to the model spell it. */
export const PANE = 'pixeldesk'
export const PLAN_TOOL = 'mcp__pixeldesk__plan'

/** The plan of the main conversation, as the mod keeps it. */
export type Plan = { title: string; steps: PlanStep[]; updatedAt: string }

/** What a turn of the main conversation has told the model so far. */
export type Turn = { planSeen: boolean; noted: boolean; calls: number; staleSent: boolean }

export const FRESH_TURN: Turn = { planSeen: false, noted: false, calls: 0, staleSent: false }

/** The conversation's turn before it has had one. */
export const NO_TURN: ChatTurn = { working: false, since: 0, ended: 0, count: 0, now: '' }

/** All the mod holds in memory for one load: a reload starts over, from the host's state and the files. */
export type Memory = {
  forced: Language | null
  started: boolean
  home: string
  sessionId: string
  cwd: string
  hidden: boolean
  departure: Departure
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

export const createMemory = (forced: Language | null): Memory => ({
  forced,
  started: false,
  home: '',
  sessionId: '',
  cwd: '',
  hidden: false,
  departure: 'plan',
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
