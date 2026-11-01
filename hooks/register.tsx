import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import { act, arrive, endTurn, known, publish } from './agents'
import { closeTurn, noteCall, openTurn } from './chat'
import { onCompact } from './compaction'
import { guard } from './disk'
import { afterTurn, answerMove, clearHearth, pressGesture } from './hearth'
import { isForkTurn, stepBack, stepLeaves } from './heat'
import { setLanguage, t } from './i18n'
import { forcedBy } from './language'
import { PLAN_TOOL, MOVE_TOOL, createMemory } from './memory'
import type { Host, System } from './host'
import type { Memory } from './memory'
import { entered, received } from './news'
import { pressSettings } from './preferences'
import { answerPlan, applyMirror, isMirror, newTurn, noteFor } from './planning'
import { runCommand, startSession } from './session'
import { writeCost, writeLimits } from './state'
import { sumOf } from './tokens'
import { drawBand } from './view-band'
import { drawPane } from './view-pane'

export { desk } from './agents'

const CULTURE_TIMEOUT = 3000
const FIRST_READ_MS = 180_000

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

/**
 * What a hook's `$` lets the rest of the mod do. `$` stays in this file: each call is written here in full, and the
 * words of each command with it. Built per hook: a state read while drawing subscribes that drawing.
 */
function hostOf($: EngineInterface): Host {
  return {
    agent: { list: () => $.agent.list() },
    clock: { after: (ms, fn) => $.clock.after(ms, fn), every: (ms, fn) => $.clock.every(ms, fn), now: () => $.clock.now() },
    command: {
      register: spec => $.command.register(spec),
      compact: brief => $.command.run({ command: 'compact', args: brief }),
    },
    env: {
      userProfile: () => $.env.get('USERPROFILE'),
      home: () => $.env.get('HOME'),
      localAppData: () => $.env.get('LOCALAPPDATA'),
      lcAll: () => $.env.get('LC_ALL'),
      lcMessages: () => $.env.get('LC_MESSAGES'),
      lang: () => $.env.get('LANG'),
      language: () => $.env.get('LANGUAGE'),
    },
    fs: { exists: path => $.fs.exists(path), list: path => $.fs.list(path), read: path => $.fs.read(path), write: (path, text) => $.fs.write(path, text) },
    model: { complete: args => $.model.complete(args), fork: args => $.model.fork(args) },
    process: {
      // `--tools=` leaves this first message no tool at all: nothing to allow, nothing to wait on. The `=` keeps the flag from swallowing what follows.
      claude: (message, id, cwd) => $.process.run(['claude', '-p', message, '--session-id', id, '--tools='], { cwd, timeoutMs: FIRST_READ_MS }),
      open: (system: System, target) => {
        if (system === 'windows') return $.process.run(['rundll32', 'url.dll,FileProtocolHandler', target])
        if (system === 'mac') return $.process.run(['open', target])
        return $.process.run(['xdg-open', target])
      },
      systemCulture: () => $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', '[System.Globalization.CultureInfo]::CurrentUICulture.Name'], { timeoutMs: CULTURE_TIMEOUT }),
    },
    session: {
      compact: args => $.session.compact(args),
      cwd: () => $.session.cwd(),
      id: () => $.session.id(),
      messages: () => $.session.messages(),
      model: () => $.session.model(),
      usage: () => $.session.usage(),
    },
    settings: { language: () => $.settings.read({ key: 'language' }) },
    store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
    tool: { register: spec => $.tool.register(spec) },
    ui: {
      close: pane => $.ui.close(pane),
      copy: args => $.ui.copy(args),
      open: pane => $.ui.open(pane),
      panes: () => $.ui.panes(),
      resolve: (e => $.ui.resolve(e)) as Host['ui']['resolve'],
      status: text => $.ui.status(text),
      toast: text => $.ui.toast(text),
    },
    values: {
      agents: { get: async () => (await $.state.get(AGENTS)).value, set: value => $.state.set(AGENTS, value) },
      chat: { get: async () => (await $.state.get(CHAT)).value, set: value => $.state.set(CHAT, value) },
      settings: { get: async () => (await $.state.get(SETTINGS)).value, set: value => $.state.set(SETTINGS, value) },
      language: { get: async () => (await $.state.get(LANGUAGE)).value, set: value => $.state.set(LANGUAGE, value) },
      plan: { get: async () => (await $.state.get(PLAN)).value, set: value => $.state.set(PLAN, value) },
      shimmer: { get: async () => (await $.state.get(SHIMMER)).value, set: value => $.state.set(SHIMMER, value) },
      limits: { get: async () => (await $.state.get(LIMITS)).value, set: value => $.state.set(LIMITS, value) },
      minute: { get: async () => (await $.state.get(MINUTE)).value, set: value => $.state.set(MINUTE, value) },
      cardClock: { get: async () => (await $.state.get(CARD_CLOCK)).value, set: value => $.state.set(CARD_CLOCK, value) },
      summaries: { get: async () => (await $.state.get(SUMMARIES)).value, set: value => $.state.set(SUMMARIES, value) },
      seen: { get: async () => (await $.state.get(SEEN)).value, set: value => $.state.set(SEEN, value) },
      floor: { get: async () => (await $.state.get(FLOOR)).value, set: value => $.state.set(FLOOR, value) },
      sub: { get: async () => (await $.state.get(SUB)).value, set: value => $.state.set(SUB, value) },
      tokens: { get: async () => (await $.state.get(TOKENS)).value, set: value => $.state.set(TOKENS, value) },
      cost: { get: async () => (await $.state.get(COST)).value, set: value => $.state.set(COST, value) },
      news: { get: async () => (await $.state.get(NEWS)).value, set: value => $.state.set(NEWS, value) },
      hearth: { get: async () => (await $.state.get(HEARTH)).value, set: value => $.state.set(HEARTH, value) },
      briefing: { get: async () => (await $.state.get(BRIEFING)).value, set: value => $.state.set(BRIEFING, value) },
    },
  }
}

/** What a call of the main conversation may add for the model, once the tool has answered. */
function notesAfter(m: Memory, ran: ToolCallResult) {
  m.turn = { ...m.turn, calls: m.turn.calls + 1 }
  return typeof ran === 'object' && ran !== null && ran.deny === undefined ? noteFor(m) : []
}

/** An agent's first answered call carries the note on its plan, once. The spawn itself passes through as it came. */
function agentNote(m: Memory, id: string, ran: ToolCallResult) {
  if (m.noted.has(id) || ran.deny !== undefined) return []
  m.noted.add(id)
  return [t('agent.suffix', { tool: PLAN_TOOL })]
}

/** Reads a finished call. Whatever goes wrong here stays here: the tool's result is left as it came. */
async function afterCall($: Host, m: Memory, tool: string, input: Record<string, unknown>, ran: ToolCallResult, agentId: string | undefined) {
  if (isMirror(tool)) {
    if (ran.deny === undefined && !ran.isError) await applyMirror($, m, tool, input, ran.result, agentId)
    return []
  }
  return agentId === undefined ? notesAfter(m, ran) : agentNote(m, agentId, ran)
}

export const register: Register = (on, options) => {
  const m = createMemory(forcedBy(options.language))
  // Nothing is seen before a session settles the language: this is what the tests of the drawings read.
  setLanguage(m.forced ?? 'fr')

  on('session.start', async ($, e, next) => {
    const host = hostOf($)
    await guard(host, m, 'session start', () => startSession(host, m, e))
    return next(e)
  })

  // The transcript's path, for the cache's length: the only place the engine names it.
  on('classic.SessionStart', ($, e, next) => {
    m.heat.transcript = e.transcript_path || m.heat.transcript
    return next(e)
  })

  on('classic.Stop', ($, e, next) => {
    m.heat.transcript = e.transcript_path || m.heat.transcript
    return next(e)
  })

  on('session.compact', ($, e, next) => onCompact(hostOf($), m, e, next))

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') clearHearth(m)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const host = hostOf($)
    await guard(host, m, 'limits', () => writeLimits(host, e.rateLimits))
    if (e.cost) await guard(host, m, 'cost', () => writeCost(host, e.cost!.usd))
    return next(e)
  })

  on('command.run', { command: 'pixeldesk' }, ($, e) => runCommand(hostOf($), m, e.args))

  on('agent.spawn', async ($, e, next) => {
    const host = hostOf($)
    const started = await next(e)
    if (started.agentId && (e.resume !== undefined || e.workflow !== undefined)) m.noted.add(started.agentId)
    if (started.agentId) await guard(host, m, 'agent spawn', () => arrive(host, m, started.agentId!, { description: e.description, type: e.subagentType }))
    return started
  })

  on('tool.call', async ($, e, next) => {
    const host = hostOf($)
    const tool = String(e.tool)
    const input = e as Record<string, unknown>
    if (tool === PLAN_TOOL) {
      if (e.agentId !== undefined) m.noted.add(e.agentId)
      return answerPlan(host, m, input, e.agentId)
    }
    if (tool === MOVE_TOOL) return answerMove(host, m, e.agentId)
    if (e.agentId === undefined && isMirror(tool)) m.turn = { ...m.turn, planSeen: true }
    if (e.agentId !== undefined) await guard(host, m, 'agent action', () => act(host, m, e.agentId!, tool, input))
    else await guard(host, m, 'turn call', () => noteCall(host, m, tool, input))
    const ran = await next(e)
    const notes = (await guard(host, m, 'tool result', () => afterCall(host, m, tool, input, ran, e.agentId))) ?? []
    return notes.length && ran.deny === undefined ? { ...ran, context: [...(ran.context ?? []), ...notes] } : ran
  })

  on('prompt.submit', async ($, e, next) => {
    const host = hostOf($)
    const agentId = (e as { agentId?: string }).agentId
    if (agentId !== undefined) return next(e)
    newTurn(m)
    await guard(host, m, 'news', () => entered(host, m, e.origin.kind, e.text, e.isMeta === true))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const host = hostOf($)
    if (!isForkTurn(m, e.text, e.turnId) && e.agentId === undefined) await guard(host, m, 'turn start', () => openTurn(host, m))
    return next(e)
  })

  on('session.receive', async ($, e, next) => {
    const host = hostOf($)
    const delivery = await next(e)
    if (e.agentId === undefined && delivery.consumed === undefined) await guard(host, m, 'news', () => received(host, m, e.origin.kind, e.text))
    return delivery
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (e.traits.includes('teammate') || e.traits.includes('bare')) return composed
    return { sections: [...composed.sections, { id: 'pixeldesk:plan', text: t('prompt.section', { tool: PLAN_TOOL }), scope: 'session' as const }] }
  })

  on('turn.step', async function* ($, e, next) {
    const host = hostOf($)
    const main = e.agentId === undefined && !m.heat.forkTurns.has(e.turnId)
    const sentAt = main ? await stepLeaves(host, m) : 0
    const step = yield* next(e)
    if (main) await guard(host, m, 'cache', () => stepBack(host, m, sentAt, step.usage))
    await guard(host, m, 'turn step', async () => {
      const spent = step.usage ? sumOf(step.usage) : 0
      if (e.agentId === undefined) m.mainTokens += spent
      else {
        const h = await known(host, m, e.agentId)
        if (h) {
          h.liveTokens += spent
          await publish(host, m)
        }
      }
    })
    return step
  })

  on('turn.complete', async ($, e, next) => {
    const host = hostOf($)
    if (m.heat.forkTurns.delete(e.turnId)) return next(e)
    await guard(host, m, 'turn end', async () => {
      if (e.agentId !== undefined) {
        await endTurn(host, m, e.agentId, { isAborted: e.isAborted, reason: e.reason, spent: e.usage ? sumOf(e.usage) : null })
        return m.wake()
      }
      await closeTurn(host, m, e.isAborted || e.reason === 'error' || e.reason === 'refusal')
      return afterTurn(host, m)
    })
    return next(e)
  })

  // Each zone has its hook, and the tree's own `onPress` does nothing.
  on('ui.press', { plugin: 'pixeldesk', element: 'settings-button-0' }, ($, e) => pressSettings(hostOf($), m, e.element))
  on('ui.press', { plugin: 'pixeldesk', element: 'settings-plan-0' }, ($, e) => pressSettings(hostOf($), m, e.element))
  on('ui.press', { plugin: 'pixeldesk', element: 'settings-each-0' }, ($, e) => pressSettings(hostOf($), m, e.element))

  on('ui.press', { plugin: 'pixeldesk', element: /^(?:briefing|hearth|theme)-/ }, ($, e) => pressGesture(hostOf($), m, e))

  on('ui.render', { component: 'Pane', requestId: 'pixeldesk' }, ($, e) => drawPane(hostOf($), m, e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const host = hostOf($)
    // A band that cannot be drawn hides the mod: nothing goes out to the model until it can.
    try {
      const drawn = await drawBand(host, m, e, () => next(e))
      m.heat.blind = false
      return drawn
    } catch (err) {
      m.heat.blind = true
      throw err
    }
  })
}
