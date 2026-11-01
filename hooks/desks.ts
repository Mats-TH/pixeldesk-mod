import type { AgentPhase, Departure, ManagerDesk, PlanLine, PlanStatus } from '../types'
import { t } from './i18n'
import type { TextKey } from './i18n'
import { AT_REST, progressOf } from './room'
import type { RoomDesk } from './room'

export const STALE_MS = 120_000

/** Where the conversation's own turn stands; absent before its first one, and from an older version. */
export type ChatState = 'working' | 'done' | 'failed'
/** How a sub-conversation reads from outside. `idle`: nothing known of it yet. */
export type KidState = ChatState | 'idle'
export type DeskExport = { sessionId: string; title: string; agents: number; working: number; summary: string; updatedAt: number; cwd: string; desks: RoomDesk[]; steps: PlanLine[]; tokens: number; since?: number; chat?: ChatState; news?: number; manager?: ManagerDesk }
export type SessionLink = { cli: string; local: string; title: string; parent: string | null; archived: boolean }
export type FloorRoom = { id: string; title: string; agents: number; working: number; summary: string; desks: RoomDesk[]; steps: PlanLine[]; tokens: number; since?: number; state?: KidState; manager?: ManagerDesk; sub?: boolean }

export const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// The first that matches wins, so the order is the table's. A word starts with a hint, it does not just hold one.
const ROLES: readonly [role: TextKey, type: string, words: RegExp][] = [
  ['role.researcher', 'explore', /\b(re)?cherch|\btrouv|\b(re)?search|\bfind\b|\bfinding|\blook(ing)? (for|up|into)|\bexplor|\binvestigat/],
  // The post of Manager is the conversation's own: an agent that plans reads as an analyst.
  ['role.analyst', 'plan', /\bplans?\b|\bplanifi|\bplanning\b|\borganis|\borganiz|\bcoordonn|\bcoordinat/],
  ['role.reviewer', 'code-reviewer', /\brevue|\brelis|\brelire\b|\brelecture|\breview|\bproofread/],
  ['role.tester', '', /\btest|\bverifi|\bverify|\bvalid|\bcheck/],
  ['role.designer', '', /\bfigma|\bmaquette|\bdesign|\bdessin|\bmock-?up|\bdraw/],
  ['role.writer', '', /\bredig|\bredact|\bdocs?\b|\bdocument|\btexte|\bnotes?\b|\bwrit|\bdraft|\btext\b/],
  ['role.analyst', '', /\baudit|\banalys|\banalyz|\bcompar|\bmesur|\bmeasur/],
]

/** What a desk's plate says: no model call, the agent's type first, then the words of its task. */
export function roleOf(type: string, description: string) {
  const kind = plain(type).split(':').pop()
  const words = plain(description)
  return t((ROLES.find(r => kind && r[1] === kind) ?? ROLES.find(r => r[2].test(words)))?.[0] ?? 'role.developer')
}

/** The state keeps a room between two versions: what an older one did not save is filled in. */
export const keptRoom = (r: FloorRoom): FloorRoom => ({ ...r, desks: r.desks ?? [], steps: r.steps ?? [], tokens: r.tokens ?? 0, state: r.state ?? (r.working ? 'working' : 'idle') })

// The frame of a subagent's own hand-back: the engine names it a peer, yet it comes from this conversation.
const OWN_AGENT = /^\s*(?:Another Claude session sent a message:\s*)?(?:<agent-message\b|\[Subagent hand-back\])/

/** A kind of delivery that may come from another conversation. */
export const isPeer = (kind: string) => kind === 'peer' || kind === 'peer-send-message'

/** A message from another conversation. The text is only looked at for its frame: it is counted, never followed. */
export const isMail = (kind: string, text: string) => isPeer(kind) && !OWN_AGENT.test(text)

/** The person: at the prompt, through Remote Control, or in the desktop app, which is an SDK host. */
export const isOwner = (kind: string) => kind === 'composer' || kind === 'bridge' || kind === 'sdk'

export function parseSession(json: unknown): SessionLink | null {
  const j = (json ?? {}) as { sessionId?: unknown; cliSessionId?: unknown; title?: unknown; isArchived?: unknown; spawnedFrom?: { sessionId?: unknown }; lineageDetached?: unknown }
  if (typeof j.sessionId !== 'string' || typeof j.cliSessionId !== 'string') return null
  // Moved to top level, a conversation keeps `spawnedFrom` on file: as for the app, the mark cuts the link.
  const parent = j.lineageDetached === true ? null : j.spawnedFrom?.sessionId
  return { cli: j.cliSessionId, local: j.sessionId, title: typeof j.title === 'string' ? j.title : '', parent: typeof parent === 'string' ? parent : null, archived: j.isArchived === true }
}

/** A worktree of a project counts as that project. */
export const projectRoot = (cwd: string) => cwd.replace(/\\/g, '/').replace(/\/\.claude\/worktrees\/.*$/, '').replace(/\/+$/, '')

/** A conversation that goes silent while it works has stopped: a live one writes at least once a minute. */
function stateOfExport(e: DeskExport | undefined, live: boolean): KidState {
  if (!e) return 'idle'
  const busy = e.working > 0 || e.chat === 'working'
  if (busy) return live ? 'working' : 'failed'
  if (e.chat) return e.chat
  return e.steps?.length && e.steps.every(st => st.status === 'completed') ? 'done' : 'idle'
}

export type { Departure }

// How long a finished desk shows its tick, or a finished plan its 100 %.
export const LEAVE_MS = 30_000

/** What ~/.claude/pixeldesk/settings.json says: anything but `each` is the default. */
export const departureOf = (json: unknown): Departure => ((json as { departure?: unknown } | null)?.departure === 'each' ? 'each' : 'plan')

/**
 * The finished desks that leave now. `planOver`: when the plan ended, 0 without a plan, null while one is open.
 * `plan` keeps them all to the end of the plan, or without one to the end of the wave: they go together, 30 s after the
 * last thing that happened. A desk stopped on an error is never one of them: it waits for the next plan or the next wave.
 */
export function leavers<T extends { phase: AgentPhase; endedAt: number }>(list: readonly T[], o: { mode: Departure; now: number; planOver: number | null }): T[] {
  const done = list.filter(a => a.phase === 'done')
  if (o.mode === 'each') return done.filter(a => o.now - a.endedAt >= LEAVE_MS)
  if (o.planOver === null || list.some(a => a.phase === 'working')) return []
  return o.now - Math.max(o.planOver, ...done.map(a => a.endedAt)) >= LEAVE_MS ? done : []
}

/** Whether a tick has anything to wait for: a finished desk, with no open plan holding it. */
export const leaveAhead = (list: readonly { phase: AgentPhase }[], mode: Departure, planOver: number | null) => list.some(a => a.phase === 'done') && (mode === 'each' || planOver !== null)

/** The manager of a conversation: its own turn and its plan, whatever its agents do. */
export const managerOf = (chat: ChatState | undefined, steps: readonly { status: PlanStatus }[]): ManagerDesk => ({ working: chat === 'working', ...progressOf(steps) })

const roomOf = (id: string, title: string, e: DeskExport | undefined, now: number, sub: boolean): FloorRoom => {
  const live = !!e && now - e.updatedAt < STALE_MS
  return {
    id,
    title: title || e?.title || t('floor.defaultTitle'),
    agents: live ? e!.agents : 0,
    working: live ? e!.working : 0,
    summary: live ? e!.summary : '',
    desks: live ? e!.desks ?? [] : [],
    steps: live ? e!.steps ?? [] : [],
    // Tokens were spent whatever became of the conversation: its screen keeps the last count.
    tokens: e?.tokens ?? 0,
    since: live ? e!.since ?? 0 : 0,
    state: stateOfExport(e, live),
    // An older file says it all the same, through its turn and its plan. A silent conversation works no more.
    manager: live ? e!.manager ?? managerOf(e!.chat, e!.steps ?? []) : AT_REST,
    sub,
  }
}

/** Whether a conversation hangs from another; null when the links do not hold it. */
export function subOf(me: string, links: readonly SessionLink[]) {
  const mine = links.find(l => l.cli === me)
  return mine ? mine.parent !== null : null
}

/** Which conversations make up the floor; null when nothing links them and the project decides. */
export function floorIds(me: string, links: readonly SessionLink[]) {
  if (!links.length) return null
  const mine = links.find(l => l.cli === me)
  const kids = mine ? links.filter(l => l.parent === mine.local && !l.archived) : []
  return kids.length ? [me, ...kids.map(l => l.cli)] : []
}

/** The mother room first, then its children; empty when there is nothing to show but itself. */
export function floorRooms(me: string, links: readonly SessionLink[], exports: readonly DeskExport[], now: number): FloorRoom[] {
  const byId = new Map(exports.map(e => [e.sessionId, e]))
  if (links.length) {
    const mine = links.find(l => l.cli === me)
    if (!mine) return []
    const kids = links.filter(l => l.parent === mine.local && !l.archived)
    if (!kids.length) return []
    return [mine, ...kids].map(l => roomOf(l.cli, l.title, byId.get(l.cli), now, l.parent !== null))
  }
  const own = byId.get(me)
  if (!own) return []
  const root = projectRoot(own.cwd)
  const same = exports.filter(e => projectRoot(e.cwd) === root)
  if (same.length < 2) return []
  // Nothing says who started whom here: the one boss of the floor is the conversation that leads it.
  return [own, ...same.filter(e => e !== own)].map(e => roomOf(e.sessionId, e.title, e, now, e !== own))
}
