import type { Host } from './host'

import type { ChatTurn, DrawnPlan } from '../types'
import { t } from './i18n'
import { NO_TURN } from './memory'
import type { Memory } from './memory'
import { readChat, writeChat } from './state'
import { actionPhrase } from './words'

const MINUTE_MS = 60_000

function show(host: Host, m: Memory, turn: ChatTurn) {
  m.chatTurn = turn
  return writeChat(host, turn)
}

/** A turn of the main loop opens, whatever started it. */
export async function openTurn(host: Host, m: Memory) {
  m.chat = 'working'
  await show(host, m, { ...m.chatTurn, working: true, since: await host.clock.now(), count: 0, now: '' })
}

/** The turn is over, however it ended. */
export async function closeTurn(host: Host, m: Memory, failed: boolean) {
  m.chat = failed ? 'failed' : 'done'
  await show(host, m, { ...m.chatTurn, working: false, ended: await host.clock.now(), now: '' })
}

/** A call of the main loop, while a turn runs. */
export async function noteCall(host: Host, m: Memory, tool: string, input: Record<string, unknown>) {
  if (m.chatTurn.working) await show(host, m, { ...m.chatTurn, count: m.chatTurn.count + 1, now: actionPhrase(tool, input, m.connectors) })
}

/** After a reload the host still holds the turn: one in progress ends the usual way. */
export async function restoreChat(host: Host, m: Memory) {
  const held = await readChat(host)
  if (!held) return
  m.chatTurn = { ...NO_TURN, ...held }
  if (held.working) m.chat = 'working'
}

const liveStep = (plan: DrawnPlan | null) => plan?.steps.find(st => st.status === 'in_progress')

/** What the manager is at: the step in progress, else the last call, else a word of his own. */
export const managerSay = (turn: ChatTurn, plan: DrawnPlan | null) => liveStep(plan)?.detail || turn.now || t('manager.thinking')

/** Whole minutes between two readings of the clock, at least one. */
export const minutesBetween = (from: number, to: number) => Math.max(1, Math.floor((to - from) / MINUTE_MS))

/** The line that sums the file's `summary` up when no agent is at work: never a tool's phrase, which would reload the floor on each call. */
export function chatSummary(working: boolean, plan: DrawnPlan | null) {
  if (!working) return ''
  return liveStep(plan)?.text || t('desk.chatWorking')
}
