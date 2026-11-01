import type { ModelForkResult, ModelUsage } from 'claude-code'
import type { Host } from './host'

import type { Ash, Fire, Hearth } from '../types'
import { isWorking } from './agents'
import { keptRoom } from './desks'
import { log, toast } from './disk'
import { t } from './i18n'
import type { CacheLength, Heat, Memory } from './memory'
import { readFloorRooms, readHearth, writeHearth } from './state'

const LEAD_MS = 45_000
const RETRY_MS = 20_000
const MAX_FAILURES = 3
const REST_RELAUNCHES = 30
const REST_MS = 2 * 60 * 60_000
const KEEPER_MS = 12_000
const FIVE_MINUTES = 300_000
// How long a step in progress counts as work once the conversation has gone quiet.
const PLAN_ALIVE_MS = 15 * 60_000
const ONE_HOUR = 3_600_000
// How much of a request must come from the cache, or miss it, for the request to say anything of its length.
const MOST = 0.8
const LITTLE = 0.2
const FIRE_SHARES: readonly [share: number, fire: Fire][] = [[0.6, 'full'], [0.3, 'medium'], [0.1, 'low'], [0, 'embers']]
const ASH_LEVELS: readonly [percent: number, ash: Ash][] = [[80, 'full'], [50, 'large'], [25, 'medium'], [1, 'small']]

/** What a relaunch asks. It is never translated: it must cost the same everywhere. */
export const PING = 'Answer only: ok'

export const lengthOf = (length: CacheLength) => (length === '1h' ? ONE_HOUR : FIVE_MINUTES)

/** The clock's span. With no proof of the length it is the longest the cache can last, an upper bound. */
const spanOf = (h: Heat) => (h.known ? h.lengthMs : ONE_HOUR)

export const coolsAtOf = (h: Heat) => (h.at ? h.at + spanOf(h) : null)

/** The length is proven: from here on it decides the cadence. */
export function settleLength(h: Heat, length: CacheLength) {
  h.known = length
  h.lengthMs = lengthOf(length)
}

/**
 * What a normal request says of the length, for free, `gap` after the one before it. Read from the cache past five
 * minutes, it lasts the hour. Written again within the hour, it lasted five minutes. Past the hour both lengths are
 * cold, and within five minutes both are lit: neither says anything.
 */
export function lengthProven(gap: number, usage: ModelUsage): CacheLength | null {
  if (gap <= FIVE_MINUTES) return null
  const { input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: written } = usage
  const total = input + read + written
  if (total > 0 && read / total >= MOST) return '1h'
  return total > 0 && gap < ONE_HOUR && read / total <= LITTLE && written / total >= MOST ? '5m' : null
}

/** The fire for what is left of the cache: it changes four times in a cycle, never with the second. */
export function fireOf(left: number, lengthMs: number): Fire {
  if (left <= 0) return 'out'
  return FIRE_SHARES.find(([share]) => left / lengthMs > share)?.[1] ?? 'embers'
}

export const ashOf = (percent: number): Ash => ASH_LEVELS.find(([from]) => percent >= from)?.[1] ?? 'none'

/** The moments the fire changes on its own, past `now`. */
export const fireMoments = (h: Heat) => (h.at ? FIRE_SHARES.map(([share]) => h.at + spanOf(h) * (1 - share)) : [])

/** The relaunch's own moment, the one a failure put off included. */
export const relaunchMoment = (h: Heat) => (h.at && h.known ? Math.max(h.at + h.lengthMs - LEAD_MS, h.retryAt) : null)

/** How many agents, and how many conversations of the floor, are at work. */
export async function workNow($: Host, m: Memory) {
  const rooms = ((await readFloorRooms($)) ?? []).slice(1).map(keptRoom)
  return { agents: m.agents.filter(isWorking).length, chats: rooms.filter(r => r.state === 'working').length }
}

/** The conversation's last sign of life: a turn, which holds its tools, or an agent. 0 when nothing happened in this run. */
const lastActivity = (m: Memory) => Math.max(m.chatTurn.since, m.chatTurn.ended, m.heat.endedAt, ...m.agents.map(a => a.endedAt || a.startedAt))

/** A step in progress is only work for a while: a plan forgotten halfway must not keep a session lit without end. */
const planAlive = (m: Memory, now: number) => (m.plan?.steps.some(st => st.status === 'in_progress') ?? false) && now - lastActivity(m) < PLAN_ALIVE_MS

/** A session stays active while a turn, an agent or a conversation of the floor works, or a plan was moving not long ago. */
export async function isActive($: Host, m: Memory) {
  const { agents, chats } = await workNow($, m)
  return m.chatTurn.working || agents > 0 || chats > 0 || planAlive(m, await $.clock.now())
}

/** The context as the status line has it. The call is free, and a failure keeps what was known. */
export async function readContext($: Host, m: Memory) {
  const usage = await $.session.usage().catch(() => null)
  if (!usage) return
  const { context } = usage
  const tokens = context.tokens ?? 0
  m.heat.tokens = tokens
  m.heat.percent = context.percent ?? (context.window ? Math.round((tokens / context.window) * 100) : 0)
}

/** The clock moves on to the moment a request left, never backwards. */
async function reached($: Host, m: Memory, at: number) {
  const h = m.heat
  h.at = Math.max(h.at, at)
  h.model = await $.session.model().catch(() => h.model)
}

/** A request of the main loop leaves. The API counts the cache's time from here, not from the reply. */
export function stepLeaves($: Host, m: Memory) {
  m.heat.requests += 1
  return $.clock.now()
}

/** A request of the person's own says what the length is. A change of model rewrites the cache whatever its length. */
async function learnLength($: Host, m: Memory, sentAt: number, usage: ModelUsage) {
  const h = m.heat
  if (h.known || !h.at || (await $.session.model().catch(() => '')) !== h.model) return
  const proven = lengthProven(sentAt - h.at, usage)
  if (proven) settleLength(h, proven)
}

/** That request came back; with no usage it never reached the cache. */
export async function stepBack($: Host, m: Memory, sentAt: number, usage: ModelUsage | null) {
  const h = m.heat
  h.requests = Math.max(0, h.requests - 1)
  if (usage) {
    await learnLength($, m, sentAt, usage)
    await reached($, m, sentAt)
  }
  m.wake()
}

/** A turn of the main loop is over: the counters start afresh, and whatever stopped the relaunches is forgotten. */
export async function turnEnded($: Host, m: Memory) {
  const h = m.heat
  const now = await $.clock.now()
  Object.assign(h, { requests: 0, endedAt: now, relaunches: 0, since: now, failures: 0, retryAt: 0, stop: null, error: '' })
  m.change.acted = false
}

/** Keeps the mod's own forks out of the conversation's turns; true when this turn is one of them. */
export function isForkTurn(m: Memory, text: string, turnId: string) {
  if (!m.heat.forks.has(text)) return false
  m.heat.forkTurns.add(turnId)
  return true
}

/** The moment the mod itself reached the cache, for a fork that read it. */
export async function stokedBy($: Host, m: Memory, at: number) {
  await reached($, m, at)
}

export function keeperCalls(m: Memory, tool: Heat['keeper'], now: number) {
  const h = m.heat
  h.keeper = tool
  h.keeperRun += 1
  h.keeperUntil = now + KEEPER_MS
}

/** The caps of a session at rest: an active one has none, and it starts its count afresh when it stops. */
function followCaps(h: Heat, active: boolean, now: number) {
  if (h.wasActive && !active) Object.assign(h, { relaunches: 0, since: now })
  h.wasActive = active
  if (active || h.stop) return
  if (h.relaunches >= REST_RELAUNCHES || (h.since && now - h.since >= REST_MS)) h.stop = 'cap'
}

/** While a briefing is being written or waits to be closed, this conversation is on its way out. */
const leaving = (m: Memory) => ['writing', 'ready', 'failed'].includes(m.change.phase)

/** Whether a relaunch may go out. Each line is a cost refused: a cold cache above all, and a length nobody has proven. */
function isDue(m: Memory, now: number) {
  const h = m.heat
  const cools = coolsAtOf(h)
  if (cools === null || !h.known || !m.fire || h.blind || h.stop || h.sending || h.compacting || h.requests > 0 || leaving(m)) return false
  return cools > now && cools - now <= LEAD_MS && now >= h.retryAt
}

function failed($: Host, m: Memory, text: string, now: number) {
  const h = m.heat
  h.relaunches += 1
  h.failures += 1
  h.error = text
  h.retryAt = now + RETRY_MS
  if (h.failures < MAX_FAILURES) return
  h.stop = 'failed'
  if (!h.toldFailure) toast($, m, t('fire.stopFailed', { error: text }))
  h.toldFailure = true
}

/** A relaunch that reached the API read the conversation, a reply with no words included. */
function read(h: Heat, usage: ModelUsage) {
  Object.assign(h, { failures: 0, retryAt: 0, error: '', toldFailure: false })
  h.relaunches += 1
  if (usage.cache_creation_input_tokens > usage.cache_read_input_tokens) h.stop = 'cold'
}

async function landed($: Host, m: Memory, sentAt: number, r: ModelForkResult) {
  const h = m.heat
  const now = await $.clock.now()
  if (r.isAnswered || r.reason === 'empty-reply') {
    read(h, r.usage)
    await reached($, m, sentAt)
    keeperCalls(m, 'log', now)
    await log($, m, `relaunch ${h.relaunches}: read ${r.usage.cache_read_input_tokens}, wrote ${r.usage.cache_creation_input_tokens}`)
  } else if (r.reason === 'nothing-to-fork') h.stop = 'nothing'
  else {
    const text = r.reason === 'api-error' ? `${r.error} ${r.status ?? ''}`.trim() : r.reason
    failed($, m, text, now)
    await log($, m, `relaunch failed: ${text}`)
  }
}

/** One relaunch. It runs on its own: nothing waits for it, and its outcome wakes the mod. */
async function relaunch($: Host, m: Memory, sentAt: number) {
  const h = m.heat
  h.forks.add(PING)
  try {
    await landed($, m, sentAt, await $.model.fork({ prompt: PING }))
  } catch (err) {
    failed($, m, t('fire.error'), await $.clock.now())
    await log($, m, `relaunch threw: ${String(err)}`)
  }
  h.forks.delete(PING)
  h.sending = false
  m.wake()
}

/** The caps, then a relaunch if one is due. A change of model leaves a cache nothing can read cheaply. */
export async function heatPass($: Host, m: Memory) {
  const h = m.heat
  const now = await $.clock.now()
  if (h.keeper && now >= h.keeperUntil) h.keeper = null
  followCaps(h, await isActive($, m), now)
  if (!isDue(m, now)) return
  const model = await $.session.model().catch(() => h.model)
  if (h.model && model !== h.model) {
    Object.assign(h, { at: 0, stop: 'cold' })
    return
  }
  h.sending = true
  void relaunch($, m, now)
}

/** What the drawings read. Written only when something moved: the fire changes four times in a cycle. */
export async function publishHearth($: Host, m: Memory) {
  const h = m.heat
  const now = await $.clock.now()
  const coolsAt = coolsAtOf(h)
  const active = await isActive($, m)
  const value: Hearth = {
    fire: coolsAt === null ? 'out' : fireOf(coolsAt - now, spanOf(h)),
    ash: ashOf(h.percent),
    coolsAt,
    relaunches: h.relaunches,
    relaunchCap: active ? null : REST_RELAUNCHES,
    active,
    contextPercent: h.percent,
    compactions: h.compactions,
    compactTarget: m.compactBefore,
    keeper: h.keeper,
    keeperRun: h.keeperRun,
    relaunchStop: h.stop,
    relaunchError: h.error,
    lengthMs: h.known ? h.lengthMs : 0,
    relaunchSince: h.since,
    failures: h.failures,
  }
  const text = JSON.stringify(value)
  if (text === h.shown) return
  h.shown = text
  try {
    await writeHearth($, value)
  } catch (err) {
    h.blind = true
    await log($, m, `hearth state: ${String(err)}`)
  }
}

/** A reload keeps the clock the host holds. A relaunch in flight did not survive it, and neither did its count. */
export async function restoreHeat($: Host, m: Memory) {
  const held = await readHearth($)
  if (!held) return false
  const h = m.heat
  if (held.lengthMs === ONE_HOUR) settleLength(h, '1h')
  if (held.lengthMs === FIVE_MINUTES) settleLength(h, '5m')
  Object.assign(h, { since: held.relaunchSince, relaunches: held.relaunches, failures: held.failures, stop: held.relaunchStop, error: held.relaunchError, keeperRun: held.keeperRun, percent: held.contextPercent, compactions: held.compactions })
  if (held.coolsAt !== null) h.at = held.coolsAt - spanOf(h)
  h.model = await $.session.model().catch(() => '')
  return true
}

/** After a `/clear` the conversation starts over: no clock, no ash, no count. */
export function clearHeat(m: Memory) {
  Object.assign(m.heat, { at: 0, relaunches: 0, failures: 0, stop: null, error: '', percent: 0, tokens: 0, compactions: 0, retryAt: 0 })
}
