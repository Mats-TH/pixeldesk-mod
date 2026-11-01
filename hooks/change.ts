import type { RenderSurface } from 'claude-code'
import type { Host } from './host'

import type { Briefing, BriefingPhase } from '../types'
import { compactNow } from './compaction'
import { guard, log, readText, toast } from './disk'
import { saveHearth } from './briefing-disk'
import { openConversation, openFile } from './briefing-open'
import type { Opening } from './briefing-open'
import { writeBriefingFile } from './briefing-write'
import type { Written } from './briefing-write'
import { ashOf, coolsAtOf, stokedBy, workNow } from './heat'
import { t } from './i18n'
import type { TextKey } from './i18n'
import type { Memory } from './memory'
import { readBriefing, writeBriefing } from './state'

const SETTLE_MS = 1000
const URGENT_PERCENT = 85
const SNOOZE_TOKENS = 100_000
const ERROR_MAX = 160

const isBusy = (phase: BriefingPhase) => phase === 'writing' || phase === 'ready' || phase === 'failed'

/** What the drawings read. Written only when something moved. */
async function show($: Host, m: Memory, phase: BriefingPhase, waiting = { agents: 0, chats: 0 }) {
  const c = m.change
  c.phase = phase
  const value: Briefing = { phase, waitingAgents: waiting.agents, waitingChats: waiting.chats, step: c.step, file: c.file, urgent: m.heat.percent > URGENT_PERCENT, words: c.words, error: c.error, note: c.note, asked: c.wanted }
  if (c.opening) value.opening = true
  const text = JSON.stringify(value)
  if (text === c.shown) return
  c.shown = text
  await writeBriefing($, value)
}

const clearOut = (m: Memory) => Object.assign(m.change, { wanted: false, auto: false, forced: false, step: 0, file: null, text: '', words: 0, error: '', note: '' })

/** Someone asked: the writing starts as soon as the turn and the work allow it. */
export async function askChange($: Host, m: Memory, auto = false) {
  const c = m.change
  if (isBusy(c.phase)) return false
  clearOut(m)
  c.wanted = true
  c.auto = auto
  return true
}

const OPENED: Record<Opening, TextKey> = { resumed: 'briefing.started', pasted: 'briefing.pressEnter', failed: 'briefing.startFailed', 'no-folder': 'briefing.noFolder' }

/** Opens the conversation, one at a time: `claude -p` takes a while, and a second click must not start a second one. */
async function opening($: Host, m: Memory, file: string) {
  const c = m.change
  if (c.opening) return
  c.opening = true
  // It takes some seconds: the click must show at once.
  c.note = t('briefing.opening')
  await show($, m, c.phase)
  let opened: Opening = 'failed'
  try {
    opened = await openConversation($, m, file)
    c.note = t(OPENED[opened])
  } finally {
    c.opening = false
  }
  toast($, m, c.note)
  // The work goes on over there: no button left to start a second one, and no cache to keep here.
  if (opened === 'resumed' || opened === 'pasted') return closeChange($, m)
  await show($, m, c.phase)
}

async function succeeded($: Host, m: Memory, done: Extract<Written, { ok: true }>) {
  const c = m.change
  Object.assign(c, { file: done.file, text: done.text, words: done.words })
  await stokedBy($, m, done.sentAt)
  await show($, m, 'ready')
  await log($, m, `briefing: ${done.file}, ${done.words} words`)
  // The conversation only opens alone when nobody had to ask.
  if (c.auto) await opening($, m, done.file)
  else toast($, m, t('briefing.readyToast'))
}

async function fell($: Host, m: Memory, done: Extract<Written, { ok: false }>) {
  const c = m.change
  Object.assign(c, { file: done.draft, text: done.text, error: done.error.slice(0, ERROR_MAX), note: done.draft ? t('briefing.draftNote') : '' })
  await show($, m, 'failed')
  await log($, m, `briefing failed at step ${done.failedStep + 1}: ${done.error}`)
  toast($, m, t('briefing.failedToast'))
}

/** The writing runs on its own: the relaunches stop for it, and its end wakes the mod. */
async function write($: Host, m: Memory) {
  const c = m.change
  const forced = c.forced
  const stop = new AbortController()
  c.stop = stop
  c.wanted = false
  await show($, m, 'writing')
  const written = await writeBriefingFile($, m, forced, stop.signal, async step => {
    c.step = step
    await show($, m, 'writing')
  })
  // Closed on the way: it was already put away, and neither its end nor its failure has anything to say.
  if (stop.signal.aborted) return
  c.stop = null
  await guard($, m, 'briefing', () => (written.ok ? succeeded($, m, written) : fell($, m, written)))
  m.wake()
}

/** The turn is over, the requests are back, and the engine has had a moment to settle. */
async function isFree($: Host, m: Memory) {
  const h = m.heat
  return !m.chatTurn.working && h.requests === 0 && !h.compacting && (await $.clock.now()) >= h.endedAt + SETTLE_MS
}

/** Nothing under way that a compaction would land on. */
export async function canCompact($: Host, m: Memory) {
  return !isBusy(m.change.phase) && (await isFree($, m))
}

async function isCold($: Host, m: Memory) {
  const cools = coolsAtOf(m.heat)
  return cools === null || cools <= (await $.clock.now())
}

const compactsNext = (m: Memory) => m.compactBefore === 'always' || m.heat.compactions < m.compactBefore

/** The full ash, with nobody asking: the setting decides, at most once for each end of turn. */
async function followAsh($: Host, m: Memory, work: { agents: number; chats: number }) {
  const { heat: h, change: c } = m
  if (m.briefingMode === 'manual') return show($, m, 'offered')
  if (c.acted) return undefined
  if (work.agents + work.chats > 0) return show($, m, 'waiting', work)
  if (!(await isFree($, m))) return undefined
  // A cold cache would be paid in full: that decision is left to the person.
  if (await isCold($, m)) return show($, m, 'offered')
  c.acted = true
  if (c.phase !== 'idle') await show($, m, 'idle')
  if (compactsNext(m)) {
    void compactNow($, m).then(() => m.wake())
    return undefined
  }
  await log($, m, `change of conversation at ${h.percent} %`)
  await askChange($, m, true)
  m.wake()
  return undefined
}

/** Every pass: what the state of the turn, the work and the ash ask for. No model call goes out unseen. */
export async function settleChange($: Host, m: Memory) {
  const { heat: h, change: c } = m
  if (isBusy(c.phase) || h.blind) return
  const work = await workNow($, m)
  if (c.wanted) {
    if ((c.forced || work.agents + work.chats === 0) && (await isFree($, m))) {
      void write($, m)
      return
    }
    await show($, m, 'waiting', work)
    return
  }
  if (ashOf(h.percent) !== 'full') {
    if (c.snooze) {
      c.snooze = 0
      await guard($, m, 'hearth file', () => saveHearth($, m))
    }
    await show($, m, 'idle')
    return
  }
  if (h.tokens < c.snooze) return
  await followAsh($, m, work)
}

/** No more offers until the context has grown by this much, or fallen back under the mark. */
async function snooze($: Host, m: Memory) {
  m.change.snooze = m.heat.tokens + SNOOZE_TOKENS
  await guard($, m, 'hearth file', () => saveHearth($, m))
}

/** Annuler: nothing is written, and the question does not come straight back. */
export async function cancelChange($: Host, m: Memory) {
  if (isBusy(m.change.phase)) return
  clearOut(m)
  m.change.acted = true
  await snooze($, m)
  await show($, m, 'idle')
}

/** Changer maintenant: the work stays where it is, and the briefing says it carries on in this conversation. */
export function forceChange(m: Memory) {
  const c = m.change
  c.forced = true
  c.wanted = true
}

/** Fermer: the panel goes, a writing under way stops for good, and the relaunches start again at the end of the next turn. */
export async function closeChange($: Host, m: Memory) {
  m.change.stop?.abort()
  m.change.stop = null
  clearOut(m)
  m.heat.stop = 'briefing'
  await snooze($, m)
  await show($, m, 'idle')
}

/** The text of the buttons: the one in memory, else what the disk kept through a reload. */
async function currentText($: Host, m: Memory) {
  const c = m.change
  if (c.text || !c.file) return c.text
  c.text = (await readText($, c.file)) ?? ''
  return c.text
}

async function say($: Host, m: Memory, note: string) {
  m.change.note = note
  await show($, m, m.change.phase)
}

export async function copyBriefing($: Host, m: Memory, surface: RenderSurface) {
  const text = await currentText($, m)
  if (!text) return say($, m, t('briefing.nothing'))
  const { isCopied } = await $.ui.copy({ text, surface })
  return say($, m, t(isCopied ? 'briefing.copied' : 'briefing.copyFailed'))
}

/** Nouvelle conversation: the person's own click, once the briefing is ready. */
export function startConversation($: Host, m: Memory) {
  const { phase, file } = m.change
  if (phase !== 'ready' || !file) return say($, m, t('briefing.nothing'))
  return opening($, m, file)
}

export async function openBriefing($: Host, m: Memory) {
  const { file } = m.change
  if (!file) return say($, m, t('briefing.nothing'))
  if (!(await openFile($, m, file))) return say($, m, t('briefing.openFailed', { file }))
  return undefined
}

/** Réessayer: only from a failure, and never over a turn. */
export async function retryChange($: Host, m: Memory) {
  if (m.change.phase !== 'failed') return
  const { forced } = m.change
  await show($, m, 'idle')
  await askChange($, m)
  m.change.forced = forced
}

/** A reload keeps what is on screen. A briefing caught halfway is dropped: only a request still waiting goes on. */
export async function restoreChange($: Host, m: Memory) {
  const held = await readBriefing($)
  if (!held) return
  const c = m.change
  Object.assign(c, { step: held.step, file: held.file, words: held.words, error: held.error, note: held.note, wanted: held.phase === 'waiting' && held.asked })
  await show($, m, held.phase === 'writing' ? 'idle' : held.phase)
}
