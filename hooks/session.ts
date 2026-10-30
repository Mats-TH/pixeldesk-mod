import type { EngineInterface, SessionStartInput } from 'claude-code'

import type { Departure } from '../types'
import { openPane, restoreAgents } from './agents'
import { restoreChat } from './chat'
import { readFloor } from './floorfile'
import { readOwnDesk, writeDesk } from './deskfile'
import { guard, readHome } from './disk'
import { closeSettings, followSettings, setDeparture, setHidden } from './preferences'
import { t } from './i18n'
import type { TextKey } from './i18n'
import { settleLanguage } from './language'
import { slashed } from './lines'
import type { Memory } from './memory'
import { restoreNews } from './news'
import { restorePlan } from './planning'
import { writeLimits, writeMinute } from './state'
import { restoreTokens, showTokens } from './tokens'

const TICK_MS = 5000
const MINUTE_MS = 60_000
const SETTINGS_MS = 3000
const ROLES: readonly TextKey[] = ['role.researcher', 'role.reviewer', 'role.tester', 'role.designer', 'role.writer', 'role.analyst', 'role.developer']

/** The tool as the model reads it, in the language of the session. */
function planSpec() {
  const text = (description: string) => ({ type: 'string', description })
  const step = {
    type: 'object',
    properties: {
      text: text(t('tool.text')),
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
      detail: text(t('tool.detail')),
      who: text(t('tool.who', { roles: ROLES.map(role => t(role)).join(', ') })),
    },
    required: ['text', 'status'],
  }
  const inputSchema = {
    type: 'object',
    properties: { title: text(t('tool.title')), steps: { type: 'array', description: t('tool.steps'), items: step } },
    required: ['steps'],
  }
  return { name: 'plan', description: t('tool.description'), inputSchema, isDeferred: false }
}

async function registerAll($: EngineInterface, m: Memory) {
  await guard($, m, 'command', () => $.command.register({ name: 'pixeldesk', description: t('cmd.description'), argumentHint: '[hide|show|departure plan|each]', immediate: true }))
  await guard($, m, 'plan tool', () => $.tool.register(planSpec()))
}

/** The five-second beat. One at a time: a slow disk does not stack passes up. */
async function tick($: EngineInterface, m: Memory) {
  if (m.ticking) return
  m.ticking = true
  await guard($, m, 'tokens', () => showTokens($, m))
  await guard($, m, 'desk file', () => writeDesk($, m))
  await guard($, m, 'floor', () => readFloor($, m))
  m.ticking = false
}

function startTimers($: EngineInterface, m: Memory) {
  let minute = 0
  $.clock.every(TICK_MS, () => void tick($, m))
  $.clock.every(SETTINGS_MS, () => void guard($, m, 'settings', () => followSettings($, m)))
  $.clock.every(MINUTE_MS, () => {
    minute += 1
    void guard($, m, 'minute', () => writeMinute($, minute))
  })
}

async function readLimits($: EngineInterface, m: Memory) {
  await guard($, m, 'limits', async () => {
    const { rateLimits } = await $.session.usage()
    if (rateLimits.length) await writeLimits($, rateLimits)
  })
}

/** What a reload or a restart left: the host's copy of the agents, the plan, and, the first time, the saved counts. */
async function restore($: EngineInterface, m: Memory, first: boolean) {
  await guard($, m, 'turn', () => restoreChat($, m))
  await guard($, m, 'agents', () => restoreAgents($, m))
  await guard($, m, 'plan', () => restorePlan($, m))
  if (!first) return
  const saved = (await guard($, m, 'desk file', () => readOwnDesk($, m))) ?? {}
  await guard($, m, 'tokens', () => restoreTokens($, m, saved.tokens))
  await guard($, m, 'news', () => restoreNews($, m, saved.news))
}

/** Everything `session.start` sets up. A repeat of it, on a resume or a compaction, doubles nothing. */
export async function startSession($: EngineInterface, m: Memory, e: SessionStartInput) {
  const first = !m.started
  m.started = true
  m.home = await readHome($)
  m.sessionId = await $.session.id().catch(() => '')
  m.cwd = slashed(e.cwd ?? '')
  if (first) await settleLanguage($, m)
  await registerAll($, m)
  await guard($, m, 'settings', () => followSettings($, m))
  await guard($, m, 'settings', () => closeSettings($, m))
  await guard($, m, 'status', () => $.ui.status(undefined))
  await restore($, m, first)
  if (!first) return
  // The terminal keeps its room for the prompt: there the pane opens on demand or for the first agent.
  if (e.surface !== 'terminal' && !m.hidden) await openPane($, m)
  await readLimits($, m)
  startTimers($, m)
}

const OPTION_NAMES: Record<Departure, TextKey> = { plan: 'settings.plan.name', each: 'settings.each.name' }

/** `/pixeldesk departure`: says how desks leave, or changes it. */
async function runDeparture($: EngineInterface, m: Memory, value: string | undefined) {
  if (value === undefined) return { text: t('cmd.departure.current', { name: t(OPTION_NAMES[m.departure]), value: m.departure }) }
  if (value !== 'plan' && value !== 'each') return { text: t('cmd.departure.usage') }
  await setDeparture($, m, value)
  return { text: t('cmd.departure.set', { name: t(OPTION_NAMES[value]), value }) }
}

/** `/pixeldesk`, with `hide`, `show`, `departure` or nothing. */
export async function runCommand($: EngineInterface, m: Memory, args: string) {
  const word = args.trim().toLowerCase()
  const [head, value, extra] = word.split(/\s+/)
  if (head === 'departure' && extra === undefined) return runDeparture($, m, value)
  if (word === 'hide') {
    await setHidden($, m, true)
    return { text: t('cmd.hidden') }
  }
  if (word === 'show') {
    await setHidden($, m, false)
    await openPane($, m)
    return { text: t('cmd.shown') }
  }
  if (word) return { text: t('cmd.usage') }
  if (m.hidden) await setHidden($, m, false)
  await openPane($, m)
  return { text: t(m.agents.length ? 'cmd.opened' : 'cmd.openedEmpty') }
}
