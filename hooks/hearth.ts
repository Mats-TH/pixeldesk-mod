import type { EngineInterface, RenderSurface } from 'claude-code'

import { readLength } from './cachelength'
import { askChange, canCompact, cancelChange, closeChange, copyHandoff, forceChange, openHandoff, restoreChange, retryChange, settleChange, startConversation } from './change'
import { compactNow } from './compaction'
import { guard, toast } from './disk'
import { restoreHearth } from './handoff-disk'
import { clearHeat, coolsAtOf, fireMoments, heatPass, publishHearth, readContext, relaunchMoment, restoreHeat, turnEnded } from './heat'
import { plural, t } from './i18n'
import type { TextKey } from './i18n'
import type { Memory } from './memory'
import { setCompactBefore, setHandoffMode, setWarm } from './preferences'

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
async function arm($: EngineInterface, m: Memory) {
  const h = m.heat
  h.alarm?.cancel()
  h.alarm = null
  const now = await $.clock.now()
  const at = nextMoment(m, now)
  if (at !== Infinity) h.alarm = $.clock.after(at - now, () => m.wake())
}

/** One pass of everything that follows the cache and the context. One at a time: a wake meanwhile asks for another. */
export async function pulse($: EngineInterface, m: Memory) {
  const h = m.heat
  if (h.pulsing) {
    h.again = true
    return
  }
  h.pulsing = true
  do {
    h.again = false
    await guard($, m, 'context', () => readContext($, m))
    await guard($, m, 'cache', () => heatPass($, m))
    await guard($, m, 'handoff', () => settleChange($, m))
    await guard($, m, 'hearth', () => publishHearth($, m))
  } while (h.again)
  h.pulsing = false
  await guard($, m, 'alarm', () => arm($, m))
}

/** What the end of a turn of the main conversation sets going. */
export async function afterTurn($: EngineInterface, m: Memory) {
  await turnEnded($, m)
  void guard($, m, 'cache length', () => readLength($, m))
  m.wake()
}

/** Everything a start needs. What the host still holds comes first, then what the last run saved. */
export async function startHearth($: EngineInterface, m: Memory, first: boolean) {
  m.wake = () => void pulse($, m)
  if (first) {
    const held = await guard($, m, 'hearth', () => restoreHeat($, m))
    await guard($, m, 'hearth file', () => restoreHearth($, m))
    if (held) await guard($, m, 'handoff', () => restoreChange($, m))
  }
  void guard($, m, 'cache length', () => readLength($, m))
  m.wake()
}

export function clearHearth(m: Memory) {
  clearHeat(m)
  m.wake()
}

/** The tool of the model: it asks, and the writing waits for the end of the turn. An agent gets no say. */
export async function answerRefresh($: EngineInterface, m: Memory, agentId: string | undefined) {
  if (agentId !== undefined) return { result: t('handoff.toolAgent') }
  await askChange($, m)
  m.wake()
  return { result: t('handoff.toolOk') }
}

/** `/pixeldesk refresh`: the same request as the button. */
export async function runRefresh($: EngineInterface, m: Memory) {
  if (!(await askChange($, m))) return { text: t('handoff.busy') }
  await pulse($, m)
  return { text: t(m.change.phase === 'writing' ? 'handoff.running' : 'handoff.queued') }
}

/** `/pixeldesk compact`: the compaction of the automatic mode, now, and it counts as one. */
export async function runCompact($: EngineInterface, m: Memory) {
  if (!(await canCompact($, m))) return { text: t('handoff.compactBusy') }
  void compactNow($, m).then(done => {
    if (!done) toast($, m, t('handoff.compactFailed'))
    m.wake()
  })
  return { text: t('handoff.compactStarted') }
}

const clockWord = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const STOP_WORDS: Record<string, TextKey> = { cap: 'warm.stoppedCap', cold: 'warm.stoppedCold', nothing: 'warm.stoppedNothing', handoff: 'warm.stoppedHandoff' }

function stateWords(m: Memory, now: number) {
  const h = m.heat
  const cools = coolsAtOf(h)
  const time = cools !== null && cools > now ? t('warm.left', { time: clockWord(cools - now) }) : t('warm.cold')
  const count = plural('warm.count', h.relaunches, { n: h.relaunches })
  if (!h.known) return `${time} ${t('warm.lengthUnknown')}`
  if (!h.stop) return `${time} ${count}`
  return `${time} ${count} ${h.stop === 'failed' ? t('warm.stoppedFailed', { error: h.error }) : t(STOP_WORDS[h.stop]!)}`
}

/** `/pixeldesk warm`: says where the relaunches stand, or turns them on or off. */
export async function runWarm($: EngineInterface, m: Memory, value: string | undefined) {
  if (value === undefined) return { text: m.warm ? t('warm.isOn', { state: stateWords(m, await $.clock.now()) }) : t('warm.isOff') }
  if (value !== 'on' && value !== 'off') return { text: t('warm.usage') }
  if (value === 'on') Object.assign(m.heat, { stop: null, failures: 0, retryAt: 0 })
  await setWarm($, m, value === 'on')
  return { text: t(value === 'on' ? 'warm.turnedOn' : 'warm.turnedOff') }
}

type Press = { element: string; surface: RenderSurface }

/** Runs a gesture by the key of its Button. The engine follows `$` only through plain calls, hence no table. */
async function runGesture($: EngineInterface, m: Memory, name: string, surface: RenderSurface) {
  switch (name) {
    case 'handoff-change': return askChange($, m)
    case 'handoff-cancel': return cancelChange($, m)
    case 'handoff-now': return forceChange(m)
    case 'handoff-close': return closeChange($, m)
    case 'handoff-copy': return copyHandoff($, m, surface)
    case 'handoff-start': return startConversation($, m)
    case 'handoff-open': return openHandoff($, m)
    case 'handoff-retry': return retryChange($, m)
    case 'hearth-warm-on': return setWarm($, m, true)
    case 'hearth-warm-off': return setWarm($, m, false)
    case 'hearth-mode-auto': return setHandoffMode($, m, 'auto')
    case 'hearth-mode-manual': return setHandoffMode($, m, 'manual')
    case 'hearth-compact-0': return setCompactBefore($, m, 0)
    case 'hearth-compact-1': return setCompactBefore($, m, 1)
    case 'hearth-compact-2': return setCompactBefore($, m, 2)
    case 'hearth-compact-3': return setCompactBefore($, m, 3)
    case 'hearth-compact-always': return setCompactBefore($, m, 'always')
    default: return undefined
  }
}

// A key that ends with a digit of its own: the row of a click zone comes after it.
const WITH_DIGIT = /^hearth-compact-\d$/

/** The gesture of a key. A click zone of several rows adds `-<row>` to it. */
export const gestureOf = (element: string) => (WITH_DIGIT.test(element) ? element : element.replace(/-\d$/, ''))

/** A press on a gesture: the Button's own `onPress` does nothing, since the drawing changes under it. */
export async function pressGesture($: EngineInterface, m: Memory, e: Press) {
  await guard($, m, 'press', () => runGesture($, m, gestureOf(e.element), e.surface))
  m.wake()
  return { element: e.element }
}
