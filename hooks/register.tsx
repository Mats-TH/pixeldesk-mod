import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import { act, arrive, endTurn, known, publish } from './agents'
import { closeTurn, noteCall, openTurn } from './chat'
import { guard } from './disk'
import { setLanguage, t } from './i18n'
import { forcedBy } from './language'
import { PLAN_TOOL, createMemory } from './memory'
import type { Memory } from './memory'
import { entered, received } from './news'
import { pressSettings } from './preferences'
import { answerPlan, applyMirror, isMirror, newTurn, noteFor } from './planning'
import { runCommand, startSession } from './session'
import { writeLimits } from './state'
import { sumOf } from './tokens'
import { drawBand } from './view-band'
import { drawPane } from './view-pane'
import { PRESS_ZONES, ZONE_ROWS } from './view-settings'

export { desk } from './agents'

/** What a call of the main conversation may add for the model, once the tool has answered. */
function notesAfter(m: Memory, ran: ToolCallResult) {
  m.turn = { ...m.turn, calls: m.turn.calls + 1 }
  return typeof ran === 'object' && ran !== null && ran.deny === undefined ? noteFor(m) : []
}

/** Reads a finished call. Whatever goes wrong here stays here: the tool's result is left as it came. */
async function afterCall($: EngineInterface, m: Memory, tool: string, input: Record<string, unknown>, ran: ToolCallResult, agentId: string | undefined) {
  if (isMirror(tool)) {
    if (ran.deny === undefined && !ran.isError) await applyMirror($, m, tool, input, ran.result, agentId)
    return []
  }
  return agentId === undefined ? notesAfter(m, ran) : []
}

export const register: Register = (on, options) => {
  const m = createMemory(forcedBy(options.language))
  // Nothing is seen before a session settles the language: this is what the tests of the drawings read.
  setLanguage(m.forced ?? 'fr')

  on('session.start', async ($, e, next) => {
    await guard($, m, 'session start', () => startSession($, m, e))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await guard($, m, 'limits', () => writeLimits($, e.rateLimits))
    return next(e)
  })

  on('command.run', { command: 'pixeldesk' }, ($, e) => runCommand($, m, e.args))

  on('agent.spawn', async ($, e, next) => {
    const fixed = e.resume !== undefined || e.workflow !== undefined
    const started = await next(fixed ? e : { ...e, prompt: `${e.prompt}\n\n${t('agent.suffix', { tool: PLAN_TOOL })}` })
    if (started.agentId) await guard($, m, 'agent spawn', () => arrive($, m, started.agentId!, { description: e.description, type: e.subagentType }))
    return started
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const input = e as Record<string, unknown>
    if (tool === PLAN_TOOL) return answerPlan($, m, input, e.agentId)
    if (e.agentId === undefined && isMirror(tool)) m.turn = { ...m.turn, planSeen: true }
    if (e.agentId !== undefined) await guard($, m, 'agent action', () => act($, m, e.agentId!, tool, input))
    else await guard($, m, 'turn call', () => noteCall($, m, tool, input))
    const ran = await next(e)
    const notes = (await guard($, m, 'tool result', () => afterCall($, m, tool, input, ran, e.agentId))) ?? []
    return notes.length && ran.deny === undefined ? { ...ran, context: [...(ran.context ?? []), ...notes] } : ran
  })

  on('prompt.submit', async ($, e, next) => {
    const agentId = (e as { agentId?: string }).agentId
    if (agentId !== undefined) return next(e)
    newTurn(m)
    await guard($, m, 'news', () => entered($, m, e.origin.kind, e.text, e.isMeta === true))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await guard($, m, 'turn start', () => openTurn($, m))
    return next(e)
  })

  on('session.receive', async ($, e, next) => {
    const delivery = await next(e)
    if (e.agentId === undefined && delivery.consumed === undefined) await guard($, m, 'news', () => received($, m, e.origin.kind, e.text))
    return delivery
  })

  on('prompt.compose', async (_$, e, next) => {
    const composed = await next(e)
    if (e.traits.includes('teammate') || e.traits.includes('bare')) return composed
    return { sections: [...composed.sections, { id: 'pixeldesk:plan', text: t('prompt.section', { tool: PLAN_TOOL }), scope: 'session' as const }] }
  })

  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    await guard($, m, 'turn step', async () => {
      const spent = step.usage ? sumOf(step.usage) : 0
      if (e.agentId === undefined) m.mainTokens += spent
      else {
        const h = await known($, m, e.agentId)
        if (h) {
          h.liveTokens += spent
          await publish($, m)
        }
      }
    })
    return step
  })

  on('turn.complete', async ($, e, next) => {
    await guard($, m, 'turn end', async () => {
      if (e.agentId !== undefined) return endTurn($, m, e.agentId, { isAborted: e.isAborted, reason: e.reason, spent: e.usage ? sumOf(e.usage) : null })
      return closeTurn($, m, e.isAborted || e.reason === 'error' || e.reason === 'refusal')
    })
    return next(e)
  })

  // The pane may draw any row of a zone: each has its hook, and the tree's own `onPress` does nothing.
  for (const zone of PRESS_ZONES) {
    for (let row = 0; row < ZONE_ROWS; row += 1) {
      on('ui.press', { plugin: 'pixeldesk', element: `${zone}-${row}` }, ($, e) => pressSettings($, m, e.element))
    }
  }

  on('ui.render', { component: 'Pane', requestId: 'pixeldesk' }, ($, e) => drawPane($, m, e))

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => drawBand($, m, e, () => next(e)))
}
