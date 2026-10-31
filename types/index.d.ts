// ---------- Plans: every view of a step builds on the line the board shows ----------

export type PlanStatus = 'pending' | 'in_progress' | 'completed'

/** A step at its barest: what a board, a rail or another conversation needs. */
export type PlanLine = { text: string; status: PlanStatus }

/** A step as the band and the pane draw it. */
export type DrawnStep = PlanLine & { detail?: string; who?: string }

/** A step as the mod keeps it: `id` only on a step mirrored from the task tools. */
export type PlanStep = DrawnStep & { id?: string; doneAt?: string }

/** The main conversation's plan, as drawn. */
export type DrawnPlan = { title: string; steps: DrawnStep[] }

// ---------- Agents ----------

/** `failed` is a desk that stopped, the agent gone or not. */
export type AgentPhase = 'working' | 'done' | 'failed'

/** One action of an agent, in plain words. */
export type AgentAction = { live: string }

/** `endedAt` stays 0 while the agent works; `plan` is absent until it announces one. */
export type AgentRecord = {
  id: string
  description: string
  type: string
  phase: AgentPhase
  errored?: true
  startedAt: number
  endedAt: number
  count: number
  steps: AgentAction[]
  tokens: number
  liveTokens: number
  seat: number
  hue: number
  plan?: PlanStep[]
}

// ---------- The conversation's own turn ----------

/** Times are clock readings, 0 until a turn has started or ended. `count` and `now`: the calls of this turn, the last in plain words. */
export type ChatTurn = { working: boolean; since: number; ended: number; count: number; now: string }

/** The manager's desk: his turn, and where his plan stands. No agent ever changes it. */
export type ManagerDesk = { working: boolean; done?: number; total?: number; live?: boolean }

// ---------- Preferences ----------

/** `plan`: finished desks leave together once the plan is over. `each`: one by one. */
export type Departure = 'plan' | 'each'

/** How a conversation changes when its ash is full: on its own, or at the press of `Changer`. */
export type HandoffMode = 'auto' | 'manual'

/** How many compactions a conversation takes before it changes for a new one. */
export type CompactBefore = 0 | 1 | 2 | 3 | 'always'

/** What the settings button shows. `open` never reaches the disk. */
export type SettingsView = { open: boolean; departure: Departure; warm: boolean; handoffMode: HandoffMode; compactBefore: CompactBefore }

// ---------- The hearth and the handoff ----------

/** The share of the cache's time still ahead: past 60 %, 30 % and 10 %, then the embers, then nothing. */
export type Fire = 'full' | 'medium' | 'low' | 'embers' | 'out'

/** How full the context is, by 1, 25, 50 and 80 %. */
export type Ash = 'none' | 'small' | 'medium' | 'large' | 'full'

/** What the keeper carries on his visit: a log after a relaunch, a broom after a compaction. */
export type Keeper = 'log' | 'broom'

/** Why relaunches stopped until the next turn: three failures, a cap, a cold cache, nothing to read yet, or a handoff. */
export type WarmStop = 'failed' | 'cap' | 'cold' | 'nothing' | 'handoff'

/**
 * The cache and the context, for the room's hearth. `coolsAt`: when the cache goes cold, null with no clock.
 * `relaunchCap`: null while the session is active. `keeper` goes back to null once his visit is over, and `keeperRun`
 * grows with each visit. `lengthMs`, `warmSince` and `failures` carry the clock through a reload.
 */
export type Hearth = {
  fire: Fire
  ash: Ash
  coolsAt: number | null
  relaunches: number
  relaunchCap: number | null
  active: boolean
  contextPercent: number
  compactions: number
  compactTarget: CompactBefore
  keeper: Keeper | null
  keeperRun: number
  warmStop: WarmStop | null
  warmError: string
  lengthMs: number
  warmSince: number
  failures: number
}

export type HandoffPhase = 'idle' | 'offered' | 'waiting' | 'writing' | 'ready' | 'failed'

/**
 * Where a change of conversation stands. `step`: 0 to 4 while writing. `file`: the handoff, or the draft after a failure,
 * as an absolute path. `urgent`: the context is past 85 %. `words`, `error` and `note` are what the card and the row say.
 * `asked`: somebody asked for this handoff, as opposed to the ash waiting for the work to end.
 */
export type Handoff = {
  phase: HandoffPhase
  waitingAgents: number
  waitingChats: number
  step: number
  file: string | null
  urgent: boolean
  words: number
  error: string
  note: string
  asked: boolean
  opening?: boolean
}

// ---------- The floor ----------

/** A desk of a room. `rest`: the manager between two turns. */
export type FloorDesk = { title: string; state: AgentPhase; hue: number; done?: number; total?: number; live?: boolean; rest?: boolean }

/** A room of the floor, the conversation that leads first. */
export type FloorSeat = {
  id: string
  title: string
  agents: number
  working: number
  summary: string
  desks: FloorDesk[]
  steps: PlanLine[]
  tokens: number
  since?: number
  state?: AgentPhase | 'idle'
  manager?: ManagerDesk
}

// ---------- Everything else the drawings read ----------

/** One rate limit window, as the engine reports it. */
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

/** The desks last drawn: an arrival is `shown` differing from `previous`. */
export type Seen = { shown: number; previous: number }

/** `count` is the true number of news, `shown` how many reached the tray. */
export type News = { count: number; shown: number }

declare module 'claude-code' {
  interface PluginState {
    pixeldesk: {
      agents: AgentRecord[]
      chat: ChatTurn
      floor: FloorSeat[]
      handoff: Handoff
      hearth: Hearth
      language: 'fr' | 'en'
      limits: Limit[]
      minute: number
      cardClock: number
      news: News
      plan: DrawnPlan | null
      seen: Seen
      settings: SettingsView
      shimmer: number
      summaries: Record<string, string>
      tokens: number
    }
  }
}
