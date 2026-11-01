import type { PluginState } from 'claude-code'

import type { Host } from './host'

type Values = PluginState['pixeldesk']

// What the host keeps for the session: it outlives a reload, and a read while drawing subscribes the drawing.
export async function readAgents(host: Host) {
  return host.values.agents.get()
}

export function writeAgents(host: Host, value: Values['agents']) {
  return host.values.agents.set(value)
}

export async function readChat(host: Host) {
  return host.values.chat.get()
}

export function writeChat(host: Host, value: Values['chat']) {
  return host.values.chat.set(value)
}

export async function readSettings(host: Host) {
  return host.values.settings.get()
}

export function writeSettings(host: Host, value: Values['settings']) {
  return host.values.settings.set(value)
}

export async function readLanguage(host: Host) {
  return host.values.language.get()
}

export function writeLanguage(host: Host, value: Values['language']) {
  return host.values.language.set(value)
}

export async function readPlan(host: Host) {
  return host.values.plan.get()
}

export function writePlan(host: Host, value: Values['plan']) {
  return host.values.plan.set(value)
}

export async function readShimmer(host: Host) {
  return host.values.shimmer.get()
}

export function writeShimmer(host: Host, value: number) {
  return host.values.shimmer.set(value)
}

export async function readLimits(host: Host) {
  return host.values.limits.get()
}

export function writeLimits(host: Host, value: Values['limits']) {
  return host.values.limits.set(value)
}

export async function readMinute(host: Host) {
  return host.values.minute.get()
}

export async function readCardClock(host: Host) {
  return host.values.cardClock.get()
}

export function writeCardClock(host: Host, value: number) {
  return host.values.cardClock.set(value)
}

export function writeMinute(host: Host, value: number) {
  return host.values.minute.set(value)
}

export async function readSummaries(host: Host) {
  return host.values.summaries.get()
}

export function writeSummaries(host: Host, value: Values['summaries']) {
  return host.values.summaries.set(value)
}

export async function readSeen(host: Host) {
  return host.values.seen.get()
}

export function writeSeen(host: Host, value: Values['seen']) {
  return host.values.seen.set(value)
}

export async function readFloorRooms(host: Host) {
  return host.values.floor.get()
}

export function writeFloorRooms(host: Host, value: Values['floor']) {
  return host.values.floor.set(value)
}

export async function readSub(host: Host) {
  return host.values.sub.get()
}

export function writeSub(host: Host, value: boolean) {
  return host.values.sub.set(value)
}

export async function readTokens(host: Host) {
  return host.values.tokens.get()
}

export function writeTokens(host: Host, value: number) {
  return host.values.tokens.set(value)
}

export async function readCost(host: Host) {
  return host.values.cost.get()
}

export function writeCost(host: Host, value: number) {
  return host.values.cost.set(value)
}

export async function readNews(host: Host) {
  return host.values.news.get()
}

export function writeNews(host: Host, value: Values['news']) {
  return host.values.news.set(value)
}

export async function readHearth(host: Host) {
  return host.values.hearth.get()
}

export function writeHearth(host: Host, value: Values['hearth']) {
  return host.values.hearth.set(value)
}

export async function readBriefing(host: Host) {
  return host.values.briefing.get()
}

export function writeBriefing(host: Host, value: Values['briefing']) {
  return host.values.briefing.set(value)
}
