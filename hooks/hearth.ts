import type { RenderSurface } from 'claude-code'
import type { Host } from './host'

import { readLength } from './cachelength'
import { askChange, canCompact, cancelChange, closeChange, copyBriefing, forceChange, openBriefing, restoreChange, retryChange, settleChange, startConversation } from './change'
import { compactNow } from './compaction'
import { guard, toast } from './disk'
import { restoreHearth } from './briefing-disk'
import { clearHeat, coolsAtOf, fireMoments, heatPass, publishHearth, readContext, relaunchMoment, restoreHeat, turnEnded } from './heat'
import { plural, t } from './i18n'
import type { TextKey } from './i18n'
import type { Memory } from './memory'
import { setTheme, setCompactBefore, setBriefingMode, setFire } from './preferences'

const SETTLE_MS = 1000

/** The next thing that happens on its own, past `now`. */
function nextMoment(m: Memory, now: number) {
  const h = m.heat
  const cools = coolsAtOf(h)
  const settled = h.endedAt + SETTLE_MS
  const times = [...fireMoments(h), cools, relaunchMoment(h), h.keeper ? h.keeperUntil : null, settled]
  return Math.min(...times.filter((at): at is number => at !== null && at > now), Infinity)
}

/** One alarm, for the next moment: a long wait costs nothing, and a machine that slept wakes on a cold cache. */
async function arm(host: Host, m: Memory) {
  const h = m.heat
  h.alarm?.cancel()
  h.alarm = null
  const now = await host.clock.now()
  const at = nextMoment(m, now)
  if (at !== Infinity) h.alarm = host.clock.after(at - now, () => m.wake())
}

/** One pass of everything that follows the cache and the context. One at a time: a wake meanwhile asks for another. */
export async function pulse(host: Host, m: Memory) {
  const h = m.heat
  if (h.pulsing) {
    h.again = true
    return
  }
  h.pulsing = true
  do {
    h.again = false
    await guard(host, m, 'context', () => readContext(host, m))
    await guard(host, m, 'cache', () => heatPass(host, m))
    await guard(host, m, 'briefing', () => settleChange(host, m))
    await guard(host, m, 'hearth', () => publishHearth(host, m))
  } while (h.again)
  h.pulsing = false
  await guard(host, m, 'alarm', () => arm(host, m))
}

/** What the end of a turn of the main conversation sets going. */
export async function afterTurn(host: Host, m: Memory) {
  await turnEnded(host, m)
  void guard(host, m, 'cache length', () => readLength(host, m))
  m.wake()
}

/** Everything a start needs. What the host still holds comes first, then what the last run saved. */
export async function startHearth(host: Host, m: Memory, first: boolean) {
  m.wake = () => void pulse(host, m)
  if (first) {
    const held = await guard(host, m, 'hearth', () => restoreHeat(host, m))
    await guard(host, m, 'hearth file', () => restoreHearth(host, m))
    if (held) await guard(host, m, 'briefing', () => restoreChange(host, m))
  }
  void guard(host, m, 'cache length', () => readLength(host, m))
  m.wake()
}

export function clearHearth(m: Memory) {
  clearHeat(m)
  m.wake()
}

/** The tool of the model: it asks, and the writing waits for the end of the turn. An agent gets no say. */
export async function answerMove(host: Host, m: Memory, agentId: string | undefined) {
  if (agentId !== undefined) return { result: t('briefing.toolAgent') }
  await askChange(host, m)
  m.wake()
  return { result: t('briefing.toolOk') }
}

/** `/pixeldesk move`: the same request as the button. */
export async function runMove(host: Host, m: Memory) {
  if (!(await askChange(host, m))) return { text: t('briefing.busy') }
  await pulse(host, m)
  return { text: t(m.change.phase === 'writing' ? 'briefing.running' : 'briefing.queued') }
}

/** `/pixeldesk compact`: the compaction of the automatic mode, now, and it counts as one. */
export async function runCompact(host: Host, m: Memory) {
  if (!(await canCompact(host, m))) return { text: t('briefing.compactBusy') }
  void compactNow(host, m).then(done => {
    if (!done) toast(host, m, t('briefing.compactFailed'))
    m.wake()
  })
  return { text: t('briefing.compactStarted') }
}

const clockWord = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const STOP_WORDS: Record<string, TextKey> = { cap: 'fire.stoppedCap', cold: 'fire.stoppedCold', nothing: 'fire.stoppedNothing', briefing: 'fire.stoppedBriefing' }

function stateWords(m: Memory, now: number) {
  const h = m.heat
  const cools = coolsAtOf(h)
  const time = cools !== null && cools > now ? t('fire.left', { time: clockWord(cools - now) }) : t('fire.cold')
  const count = plural('fire.count', h.relaunches, { n: h.relaunches })
  if (!h.known) return `${time} ${t('fire.lengthUnknown')}`
  if (!h.stop) return `${time} ${count}`
  return `${time} ${count} ${h.stop === 'failed' ? t('fire.stoppedFailed', { error: h.error }) : t(STOP_WORDS[h.stop]!)}`
}

/** `/pixeldesk fire`: says where the relaunches stand, or turns them on or off. */
export async function runFire(host: Host, m: Memory, value: string | undefined) {
  if (value === undefined) return { text: m.fire ? t('fire.isOn', { state: stateWords(m, await host.clock.now()) }) : t('fire.isOff') }
  if (value !== 'on' && value !== 'off') return { text: t('fire.usage') }
  if (value === 'on') Object.assign(m.heat, { stop: null, failures: 0, retryAt: 0 })
  await setFire(host, m, value === 'on')
  return { text: t(value === 'on' ? 'fire.turnedOn' : 'fire.turnedOff') }
}

type Press = { element: string; surface: RenderSurface }

/** Runs a gesture by the key of its Button. The engine follows `$` only through plain calls, hence no table. */
async function runGesture(host: Host, m: Memory, name: string, surface: RenderSurface) {
  switch (name) {
    case 'briefing-change': return askChange(host, m)
    case 'briefing-cancel': return cancelChange(host, m)
    case 'briefing-now': return forceChange(m)
    case 'briefing-close': return closeChange(host, m)
    case 'briefing-copy': return copyBriefing(host, m, surface)
    case 'briefing-start': return startConversation(host, m)
    case 'briefing-open': return openBriefing(host, m)
    case 'briefing-retry': return retryChange(host, m)
    case 'hearth-fire-on': return setFire(host, m, true)
    case 'hearth-fire-off': return setFire(host, m, false)
    case 'hearth-mode-auto': return setBriefingMode(host, m, 'auto')
    case 'hearth-mode-manual': return setBriefingMode(host, m, 'manual')
    case 'hearth-compact-0': return setCompactBefore(host, m, 0)
    case 'hearth-compact-1': return setCompactBefore(host, m, 1)
    case 'hearth-compact-2': return setCompactBefore(host, m, 2)
    case 'hearth-compact-3': return setCompactBefore(host, m, 3)
    case 'hearth-compact-always': return setCompactBefore(host, m, 'always')
    case 'theme-cosy': return setTheme(host, m, 'cosy')
    case 'theme-japonais': return setTheme(host, m, 'japonais')
    case 'theme-nature': return setTheme(host, m, 'nature')
    case 'theme-futuriste': return setTheme(host, m, 'futuriste')
    case 'theme-geek': return setTheme(host, m, 'geek')
    case 'theme-base': return setTheme(host, m, 'base')
    default: return undefined
  }
}

/** A press on a gesture: the Button's own `onPress` does nothing, since the drawing changes under it. */
export async function pressGesture(host: Host, m: Memory, e: Press) {
  await guard(host, m, 'press', () => runGesture(host, m, e.element, e.surface))
  m.wake()
  return { element: e.element }
}
