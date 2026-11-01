import type { EngineInterface, PluginState } from 'claude-code'

type Values = PluginState['pixeldesk']

// The engine reads each reference off the source of the file that uses it: this file is the one that does.
const AGENTS = { plugin: 'pixeldesk', key: 'agents' } as const
const CHAT = { plugin: 'pixeldesk', key: 'chat' } as const
const SETTINGS = { plugin: 'pixeldesk', key: 'settings' } as const
const LANGUAGE = { plugin: 'pixeldesk', key: 'language' } as const
const PLAN = { plugin: 'pixeldesk', key: 'plan' } as const
const SHIMMER = { plugin: 'pixeldesk', key: 'shimmer' } as const
const LIMITS = { plugin: 'pixeldesk', key: 'limits' } as const
const MINUTE = { plugin: 'pixeldesk', key: 'minute' } as const
const CARD_CLOCK = { plugin: 'pixeldesk', key: 'cardClock' } as const
const SUMMARIES = { plugin: 'pixeldesk', key: 'summaries' } as const
const SEEN = { plugin: 'pixeldesk', key: 'seen' } as const
const FLOOR = { plugin: 'pixeldesk', key: 'floor' } as const
const SUB = { plugin: 'pixeldesk', key: 'sub' } as const
const TOKENS = { plugin: 'pixeldesk', key: 'tokens' } as const
const COST = { plugin: 'pixeldesk', key: 'cost' } as const
const NEWS = { plugin: 'pixeldesk', key: 'news' } as const
const HEARTH = { plugin: 'pixeldesk', key: 'hearth' } as const
const BRIEFING = { plugin: 'pixeldesk', key: 'briefing' } as const

// What the host keeps for the session: it outlives a reload, and a read while drawing subscribes the drawing.
export async function readAgents($: EngineInterface) {
  return (await $.state.get(AGENTS)).value
}

export function writeAgents($: EngineInterface, value: Values['agents']) {
  return $.state.set(AGENTS, value)
}

export async function readChat($: EngineInterface) {
  return (await $.state.get(CHAT)).value
}

export function writeChat($: EngineInterface, value: Values['chat']) {
  return $.state.set(CHAT, value)
}

export async function readSettings($: EngineInterface) {
  return (await $.state.get(SETTINGS)).value
}

export function writeSettings($: EngineInterface, value: Values['settings']) {
  return $.state.set(SETTINGS, value)
}

export async function readLanguage($: EngineInterface) {
  return (await $.state.get(LANGUAGE)).value
}

export function writeLanguage($: EngineInterface, value: Values['language']) {
  return $.state.set(LANGUAGE, value)
}

export async function readPlan($: EngineInterface) {
  return (await $.state.get(PLAN)).value
}

export function writePlan($: EngineInterface, value: Values['plan']) {
  return $.state.set(PLAN, value)
}

export async function readShimmer($: EngineInterface) {
  return (await $.state.get(SHIMMER)).value
}

export function writeShimmer($: EngineInterface, value: number) {
  return $.state.set(SHIMMER, value)
}

export async function readLimits($: EngineInterface) {
  return (await $.state.get(LIMITS)).value
}

export function writeLimits($: EngineInterface, value: Values['limits']) {
  return $.state.set(LIMITS, value)
}

export async function readMinute($: EngineInterface) {
  return (await $.state.get(MINUTE)).value
}

export async function readCardClock($: EngineInterface) {
  return (await $.state.get(CARD_CLOCK)).value
}

export function writeCardClock($: EngineInterface, value: number) {
  return $.state.set(CARD_CLOCK, value)
}

export function writeMinute($: EngineInterface, value: number) {
  return $.state.set(MINUTE, value)
}

export async function readSummaries($: EngineInterface) {
  return (await $.state.get(SUMMARIES)).value
}

export function writeSummaries($: EngineInterface, value: Values['summaries']) {
  return $.state.set(SUMMARIES, value)
}

export async function readSeen($: EngineInterface) {
  return (await $.state.get(SEEN)).value
}

export function writeSeen($: EngineInterface, value: Values['seen']) {
  return $.state.set(SEEN, value)
}

export async function readFloorRooms($: EngineInterface) {
  return (await $.state.get(FLOOR)).value
}

export function writeFloorRooms($: EngineInterface, value: Values['floor']) {
  return $.state.set(FLOOR, value)
}

export async function readSub($: EngineInterface) {
  return (await $.state.get(SUB)).value
}

export function writeSub($: EngineInterface, value: boolean) {
  return $.state.set(SUB, value)
}

export async function readTokens($: EngineInterface) {
  return (await $.state.get(TOKENS)).value
}

export function writeTokens($: EngineInterface, value: number) {
  return $.state.set(TOKENS, value)
}

export async function readCost($: EngineInterface) {
  return (await $.state.get(COST)).value
}

export function writeCost($: EngineInterface, value: number) {
  return $.state.set(COST, value)
}

export async function readNews($: EngineInterface) {
  return (await $.state.get(NEWS)).value
}

export function writeNews($: EngineInterface, value: Values['news']) {
  return $.state.set(NEWS, value)
}

export async function readHearth($: EngineInterface) {
  return (await $.state.get(HEARTH)).value
}

export function writeHearth($: EngineInterface, value: Values['hearth']) {
  return $.state.set(HEARTH, value)
}

export async function readBriefing($: EngineInterface) {
  return (await $.state.get(BRIEFING)).value
}

export function writeBriefing($: EngineInterface, value: Values['briefing']) {
  return $.state.set(BRIEFING, value)
}
