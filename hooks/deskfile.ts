import type { Host } from './host'

import { desk, isWorking, lastAction, seated } from './agents'
import { chatSummary } from './chat'
import { managerOf } from './desks'
import { guard, deskPath, onDisk, readText } from './disk'
import type { Memory } from './memory'
import { readSummaries } from './state'
import { totalOf } from './tokens'

const KEEP_ALIVE_MS = 60_000

/** What the latest agent at work is doing, else what the conversation is on. */
function summaryOf(m: Memory, summaries: Readonly<Record<string, string>>) {
  const a = m.agents.filter(isWorking).pop()
  return a ? summaries[a.id] || lastAction(a) : chatSummary(m.chatTurn.working, m.plan)
}

/** The conversation as the others read it. `updatedAt` stays out: it would change the content every time. */
async function exported(host: Host, m: Memory) {
  const summaries = (await readSummaries(host)) ?? {}
  const working = m.agents.filter(isWorking)
  const steps = (m.plan?.steps ?? []).map(st => ({ text: st.text, status: st.status }))
  return {
    sessionId: m.sessionId,
    title: '',
    agents: working.length,
    working: working.length,
    summary: summaryOf(m, summaries),
    cwd: m.cwd,
    desks: seated(m.agents).map(desk),
    steps,
    tokens: totalOf(m),
    since: working.length ? Math.min(...working.map(a => a.startedAt)) : 0,
    ...(m.chat ? { chat: m.chat } : {}),
    manager: managerOf(m.chat, steps),
    news: m.news.count,
  }
}

/** Writes the file when something changed. A busy conversation still writes once a minute, not to pass for dead. */
export async function writeDesk(host: Host, m: Memory) {
  if (!onDisk(m)) return
  const body = await exported(host, m)
  const content = JSON.stringify(body)
  const now = await host.clock.now()
  const busy = body.working > 0 || m.chat === 'working'
  if (content === m.lastDesk && !(busy && now - m.deskAt >= KEEP_ALIVE_MS)) return
  await host.fs.write(deskPath(m, m.sessionId), JSON.stringify({ ...body, updatedAt: now }))
  m.lastDesk = content
  m.deskAt = now
}

/** The saved file of this conversation, for what survives a restart; empty when it is missing or broken. */
export async function readOwnDesk(host: Host, m: Memory): Promise<{ tokens?: unknown; news?: unknown }> {
  const text = onDisk(m) ? await readText(host, deskPath(m, m.sessionId)) : undefined
  if (text === undefined) return {}
  const json = await guard(host, m, 'desk file', (): unknown => JSON.parse(text))
  return typeof json === 'object' && json !== null ? json : {}
}
