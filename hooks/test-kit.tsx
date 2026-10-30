import { mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'

/**
 * The world beneath the mod, for the tests: a disk, a clock, an environment and the engine's calls, all in memory.
 * Everything the mod does to the outside ends up here, where a test can read it back.
 */

export const PLUGIN = 'pixeldesk'
export const HOME = 'C:\\Users\\test'
export const SESSION = 'session-1'
export const CWD = 'C:/work/app'
/** A Tuesday at noon, local time: daylight in the band, and far from the epoch that means "never started". */
export const NOON = new Date(2026, 9, 27, 12, 0, 0).getTime()
export const ROOT = '/Users/test/.claude/pixeldesk'
export const PLAN_FILE = `${ROOT}/state/plan-${SESSION}.json`
export const DESK_FILE = `${ROOT}/state/desk-${SESSION}.json`
export const SETTINGS_FILE = `${ROOT}/settings.json`
export const LOG_FILE = `${ROOT}/logs/pixeldesk.log`

export const FRENCH = { USERPROFILE: HOME, LANG: 'fr_FR.UTF-8' }
export const ENGLISH = { USERPROFILE: HOME, LANG: 'en_US.UTF-8' }

// Loose on purpose: a test speaks to the engine's `$` and its `on` with the plain shapes of the events.
type Loose = any
type Answer = Record<string, unknown>
type Hook = (e: Loose) => Answer | Promise<Answer>

export type WorldOptions = {
  env?: Record<string, string>
  files?: Record<string, string>
  session?: string | null
  now?: number
  agents?: Record<string, unknown>[]
  limits?: { kind: string; percentUsed: number; resetsAt?: string }[]
  store?: Record<string, unknown>
  /** What `$.settings.read` answers: an object of settings, or a function that throws or denies. */
  settings?: Record<string, unknown> | (() => Answer)
  /** What PowerShell prints for the culture; a function may refuse. */
  culture?: string | (() => Answer)
  summary?: () => Answer
  /** What the host still holds for the session, by key of the state: a reload. */
  held?: Record<string, unknown>
  refuseStore?: boolean
  refuseStoreRead?: boolean
}

/** One place for a path, whatever the host made of it: forward slashes, no drive. */
export function pathKey(path: string) {
  const slashed = path.replace(/\\/g, '/')
  return slashed.match(/[A-Za-z]:(\/.*)$/)?.[1] ?? slashed
}

/** What the kit draws beneath the mod. */
export const BENEATH = 'drawing beneath'

const denied = (reason: string) => ({ deny: reason })

export type World = ReturnType<typeof world>

/** Registers the whole world beneath the plugin. Call it first in a test: `$` loads the plugins on its first call. */
export function world(on: Loose, options: WorldOptions = {}) {
  const files = new Map(Object.entries(options.files ?? {}).map(([path, text]) => [pathKey(path), text]))
  const w = {
    files,
    clock: mock.clock(on, { now: options.now ?? NOON }) as MockClock,
    reads: [] as string[],
    writes: [] as string[],
    lists: [] as string[],
    toasts: [] as string[],
    opened: [] as Loose[],
    closed: [] as string[],
    panes: new Set<string>(),
    statuses: [] as (string | undefined)[],
    commands: [] as Loose[],
    tools: [] as Loose[],
    spawned: [] as Loose[],
    runs: [] as Loose[],
    summaries: [] as Loose[],
    stored: { ...(options.store ?? {}) } as Record<string, unknown>,
    storeWrites: [] as Loose[],
    settingsReads: 0,
    agents: [...(options.agents ?? [])] as Loose[],
    limits: options.limits ?? [],
    nextAgent: 'a1',
    /** The path of a read or write that must fail. */
    refuseRead: null as RegExp | null,
    refuseWrite: null as RegExp | null,
    refuseList: null as RegExp | null,
    refuseOpen: false,
    refuseToast: false,
    /** The engine's calls that fail, by name: `agent.list`, `session.usage`, `tool.register`, `ui.panes`, `model.complete`. */
    refuse: new Set<string>(),
    agentLists: 0,
    /** Keys of the state a write of the mod bounces off. */
    refuseState: new Set<string>(),
    /** What the mod published last, by key of the state. */
    state: { ...(options.held ?? {}) } as Record<string, Loose>,
    /** Every key of the state the mod wrote, in order. */
    stateWrites: [] as string[],
    /** The prompts the engine drops. */
    dropPrompts: false,
    /** The deliveries something beneath takes for itself. */
    consumeReceived: false,
    /** What sits beneath the mod's drawing: another mod's, the engine's fallback, or a failure. */
    beneath: 'mod' as 'mod' | 'engine' | 'broken' | 'empty',
    /** What a tool answers, by its name. */
    answers: {} as Record<string, Hook>,
    calls: [] as Loose[],
    file: (path: string) => files.get(pathKey(path)),
    json: (path: string) => JSON.parse(files.get(pathKey(path)) ?? 'null') as Loose,
    log: () => files.get(LOG_FILE) ?? '',
    entries(dir: string) {
      const base = `${pathKey(dir).replace(/\/+$/, '')}/`
      const names = new Map<string, 'file' | 'dir'>()
      for (const path of files.keys()) {
        if (!path.startsWith(base)) continue
        const [name, ...rest] = path.slice(base.length).split('/')
        names.set(name!, rest.length ? 'dir' : 'file')
      }
      return [...names].map(([name, kind]) => ({ name, kind, size: 0, modifiedAt: 0 }))
    },
  }

  mock.env(on, options.env ?? FRENCH)

  on('session.id', () => (options.session === null ? denied('no session') : { value: options.session ?? SESSION }))
  on('session.usage', () => (w.refuse.has('session.usage') ? denied('no usage') : { value: { startedAt: 0, context: {}, rateLimits: w.limits } }))
  on('session.start', (_: Loose, e: Loose) => ({ cwd: e.cwd }))
  on('session.measure', (_: Loose, e: Loose) => ({ changed: e.changed ?? [] }))
  on('session.receive', (_: Loose, e: Loose) => (w.consumeReceived ? { consumed: 'taken' } : { text: e.text }))
  on('prompt.submit', (_: Loose, e: Loose) => (w.dropPrompts ? { drop: 'dropped' } : { text: e.text }))
  on('prompt.compose', () => ({ sections: [] }))
  on('turn.start', (_: Loose, e: Loose) => ({ turnId: e.turnId }))
  on('turn.complete', (_: Loose, e: Loose) => ({ text: e.answer, usage: e.usage }))

  on('command.register', (_: Loose, e: Loose) => {
    w.commands.push(e)
    return { value: { command: e.name } }
  })
  on('tool.register', (_: Loose, e: Loose) => {
    if (w.refuse.has('tool.register')) return denied('no tools here')
    w.tools.push(e)
    return { value: { name: e.name } }
  })
  on('agent.spawn', (_: Loose, e: Loose) => {
    w.spawned.push(e)
    return { model: 'haiku', agentId: w.nextAgent }
  })
  on('agent.list', () => {
    w.agentLists += 1
    return w.refuse.has('agent.list') ? denied('no list') : { value: w.agents }
  })

  on('ui.open', (_: Loose, e: Loose) => {
    if (w.refuseOpen) return denied('no pane here')
    w.opened.push(e)
    w.panes.add(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_: Loose, e: Loose) => {
    w.closed.push(e.id)
    w.panes.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => (w.refuse.has('ui.panes') ? denied('no panes') : { value: [...w.panes].map(id => ({ id, title: id, isActive: true })) }))
  on('ui.toast', (_: Loose, e: Loose) => {
    if (w.refuseToast) return denied('no toasts')
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_: Loose, e: Loose) => {
    w.statuses.push(e.text)
    return { value: undefined }
  })

  on('model.complete', (_: Loose, e: Loose) => {
    w.summaries.push(e)
    if (w.refuse.has('model.complete')) return denied('no model')
    return options.summary?.() ?? { value: { isAnswered: true, text: 'A plain sentence.' } }
  })

  on('settings.read', () => {
    w.settingsReads += 1
    return typeof options.settings === 'function' ? options.settings() : { value: options.settings ?? {} }
  })
  on('store.get', (_: Loose, e: Loose) => (options.refuseStoreRead ? denied('store refused') : { value: w.stored[e.key] }))
  on('store.set', (_: Loose, e: Loose) => {
    if (options.refuseStore) return denied('store refused')
    w.storeWrites.push(e)
    w.stored[e.key] = e.value
    return { value: undefined }
  })
  on('process.run', (_: Loose, e: Loose) => {
    w.runs.push(e)
    if (typeof options.culture === 'function') return options.culture()
    return { value: { exitCode: 0, stdout: `${options.culture ?? ''}\r\n`, stderr: '' } }
  })

  on('fs.read', (_: Loose, e: Loose) => {
    const path = pathKey(e.path)
    w.reads.push(path)
    if (w.refuseRead?.test(path)) return denied('read refused')
    const text = files.get(path)
    return text === undefined ? denied(`no such file: ${path}`) : { value: text }
  })
  on('fs.write', (_: Loose, e: Loose) => {
    const path = pathKey(e.path)
    w.writes.push(path)
    if (w.refuseWrite?.test(path)) return denied('write refused')
    files.set(path, e.text)
    return { value: undefined }
  })
  on('fs.exists', (_: Loose, e: Loose) => {
    const path = pathKey(e.path)
    return { value: files.has(path) || w.entries(path).length > 0 }
  })
  on('fs.list', (_: Loose, e: Loose) => {
    const path = pathKey(e.path)
    w.lists.push(path)
    if (w.refuseList?.test(path)) return denied('list refused')
    const found = w.entries(path)
    return found.length ? { value: found } : denied(`no such folder: ${path}`)
  })

  on('tool.call', (_: Loose, e: Loose) => {
    w.calls.push(e)
    return (w.answers[e.tool] ?? (() => ({ result: {} })))(e)
  })

  on('state.get', (_: Loose, e: Loose, next: Loose) => (options.held && e.key in options.held ? { value: { value: options.held[e.key], version: 1 } } : next(e)))
  on('state.set', (_: Loose, e: Loose, next: Loose) => {
    if (w.refuseState.has(e.key)) return denied('state refused')
    w.state[e.key] = e.value
    w.stateWrites.push(e.key)
    return next(e)
  })

  // What is drawn beneath the mod, for the hooks that leave a drawing through.
  on('ui.render', ($: Loose, e: Loose) => {
    if (w.beneath === 'broken') throw new Error('nothing to draw')
    if (w.beneath === 'engine') return { type: 'engine', ref: 0 }
    const { Box, Text } = $.ui.resolve(e)
    if (w.beneath === 'empty') return <Box><Box /></Box>
    return <Text>{BENEATH}</Text>
  })

  return w
}

/** What a turn spends, one call of the model. */
export const usage = (input: number, output = 0, read = 0, created = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: created,
  model: 'haiku',
})

export const start = ($: Loose, surface: string | null = 'desktop', cwd = CWD) => $.session.start({ cwd, surface, isInteractive: true })

/** Starts an agent as the Agent tool does. */
export async function spawn($: Loose, w: World, id: string, o: { description?: string; type?: string; prompt?: string; resume?: string; workflow?: unknown } = {}) {
  w.nextAgent = id
  return $.agent.spawn({
    tool_use_id: `tu-${id}`,
    prompt: o.prompt ?? 'Do the job.',
    description: o.description ?? 'Write the tests',
    subagentType: o.type ?? 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    ...(o.resume === undefined ? {} : { resume: o.resume }),
    ...(o.workflow === undefined ? {} : { workflow: o.workflow }),
  })
}

export const callTool = ($: Loose, tool: string, input: Record<string, unknown> = {}, agentId?: string) =>
  $.tool.call({ tool, ...input, ...(agentId === undefined ? {} : { agentId }) })

export const planTool = 'mcp__pixeldesk__plan'

export const step = (text: string, status: string, more: Record<string, unknown> = {}) => ({ text, status, ...more })

export const sendPlan = ($: Loose, steps: unknown, title?: unknown, agentId?: string) =>
  callTool($, planTool, { steps, ...(title === undefined ? {} : { title }) }, agentId)

/** A step of the model: walks the engine's stream to its end. */
async function modelStep($: Loose, agentId?: string) {
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'haiku', messageCount: 1, ...(agentId === undefined ? {} : { agentId }) })
  for (;;) {
    const { done, value } = await stream.next()
    if (done) return value
  }
}

/** Puts the bottom of `turn.step` in place: a step that spends what the test says. */
export function steps(on: Loose) {
  const next = { usage: null as ReturnType<typeof usage> | null }
  on('turn.step', async function* (): AsyncGenerator<never, Record<string, unknown>> {
    return { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: next.usage }
  })
  return async ($: Loose, spent: ReturnType<typeof usage> | null, agentId?: string) => {
    next.usage = spent
    return modelStep($, agentId)
  }
}

/** A turn opens, on the main loop or an agent's. */
export const startTurn = ($: Loose, agentId?: string) => $.turn.start({ text: '', turnId: 't', ...(agentId === undefined ? {} : { agentId }) })

export const endTurn = ($: Loose, o: { agentId?: string; reason?: string; isAborted?: boolean; usage?: unknown } = {}) =>
  $.turn.complete({
    answer: '',
    durationMs: 1,
    isAborted: o.isAborted ?? false,
    turnId: 't',
    reason: o.reason ?? 'answer',
    ...(o.reason === 'refusal' ? { refusal: { category: null, explanation: null } } : {}),
    ...(o.agentId === undefined ? {} : { agentId: o.agentId }),
    ...(o.usage === undefined ? {} : { usage: o.usage }),
  })

export const submit = ($: Loose, text = 'hello', kind = 'composer', more: Record<string, unknown> = {}) =>
  $.prompt.submit({ text, wait: false, origin: { kind }, ...more })

export const receive = ($: Loose, text = 'a message', kind = 'peer', more: Record<string, unknown> = {}) =>
  $.session.receive({ text, origin: { kind }, ...more })

export const command = ($: Loose, args = '') =>
  $.command.run({ command: PLUGIN, args, origin: { kind: 'composer' }, presentation: { kind: 'plain' } })

const PANE_PROPS = { title: 'PixelDesk', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 22 }, view: {} }
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 }

export const paneProps = (props: Record<string, unknown> = {}) => ({ ...PANE_PROPS, ...props })

export const mountPane = ($: Loose, surface = 'desktop', props: Record<string, unknown> = {}) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PLUGIN, props: paneProps(props) })

export const mountBand = ($: Loose, surface = 'desktop', props: Record<string, unknown> = {}) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: { ...BAND_PROPS, ...props } })

/** The drawing of a mounted tree: the main picture, or the keyed box's own. */
export const svgOf = async (ui: Loose, key?: string) => {
  if (key === undefined) return ui.find({ type: 'Svg' })
  const box = await ui.find({ key })
  return box?.children.find((child: Loose) => child?.type === 'Svg') ?? box
}

/** The text of every element, for what must not appear anywhere. */
export async function everyText(ui: Loose) {
  return JSON.stringify(await ui.drawn())
}

/** Whether a tree holds a key. */
export const hasKey = async (ui: Loose, key: string) => (await ui.find({ key })) !== undefined

export const textsOf = async (ui: Loose): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map((el: Loose) => el.text)

export const altOf = async (ui: Loose, key?: string): Promise<string> => (await svgOf(ui, key))?.props.alt

export const sourceOf = async (ui: Loose, key?: string): Promise<string> => (await svgOf(ui, key))?.props.source

/** An element's children that are elements, in order. */
export const kids = (el: Loose): Loose[] => (el?.children ?? []).filter((child: Loose) => typeof child === 'object' && child !== null)

/** The hidden card of a hover zone: the box the pointer reveals, and the drawing in it. */
export function cardIn(zone: Loose) {
  const box = kids(zone)[0]
  return { box, svg: kids(box)[0] }
}
