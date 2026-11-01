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
async function arm($: Host, m: Memory) {
  const h = m.heat
  h.alarm?.cancel()
  h.alarm = null
  const now = await $.clock.now()
  const at = nextMoment(m, now)
  if (at !== Infinity) h.alarm = $.clock.after(at - now, () => m.wake())
}

/** One pass of everything that follows the cache and the context. One at a time: a wake meanwhile asks for another. */
export async function pulse($: Host, m: Memory) {
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
    await guard($, m, 'briefing', () => settleChange($, m))
    await guard($, m, 'hearth', () => publishHearth($, m))
  } while (h.again)
  h.pulsing = false
  await guard($, m, 'alarm', () => arm($, m))
}

/** What the end of a turn of the main conversation sets going. */
export async function afterTurn($: Host, m: Memory) {
  await turnEnded($, m)
  void guard($, m, 'cache length', () => readLength($, m))
  m.wake()
}

/** Everything a start needs. What the host still holds comes first, then what the last run saved. */
export async function startHearth($: Host, m: Memory, first: boolean) {
  m.wake = () => void pulse($, m)
  if (first) {
    const held = await guard($, m, 'hearth', () => restoreHeat($, m))
    await guard($, m, 'hearth file', () => restoreHearth($, m))
    if (held) await guard($, m, 'briefing', () => restoreChange($, m))
  }
  void guard($, m, 'cache length', () => readLength($, m))
  m.wake()
}

export function clearHearth(m: Memory) {
  clearHeat(m)
  m.wake()
}

/** The tool of the model: it asks, and the writing waits for the end of the turn. An agent gets no say. */
export async function answerMove($: Host, m: Memory, agentId: string | undefined) {
  if (agentId !== undefined) return { result: t('briefing.toolAgent') }
  await askChange($, m)
  m.wake()
  return { result: t('briefing.toolOk') }
}

/** `/pixeldesk move`: the same request as the button. */
export async function runMove($: Host, m: Memory) {
  if (!(await askChange($, m))) return { text: t('briefing.busy') }
  await pulse($, m)
  return { text: t(m.change.phase === 'writing' ? 'briefing.running' : 'briefing.queued') }
}

/** `/pixeldesk compact`: the compaction of the automatic mode, now, and it counts as one. */
export async function runCompact($: Host, m: Memory) {
  if (!(await canCompact($, m))) return { text: t('briefing.compactBusy') }
  void compactNow($, m).then(done => {
    if (!done) toast($, m, t('briefing.compactFailed'))
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
export async function runFire($: Host, m: Memory, value: string | undefined) {
  if (value === undefined) return { text: m.fire ? t('fire.isOn', { state: stateWords(m, await $.clock.now()) }) : t('fire.isOff') }
  if (value !== 'on' && value !== 'off') return { text: t('fire.usage') }
  if (value === 'on') Object.assign(m.heat, { stop: null, failures: 0, retryAt: 0 })
  await setFire($, m, value === 'on')
  return { text: t(value === 'on' ? 'fire.turnedOn' : 'fire.turnedOff') }
}

type Press = { element: string; surface: RenderSurface }

/** Runs a gesture by the key of its Button. The engine follows `$` only through plain calls, hence no table. */
async function runGesture($: Host, m: Memory, name: string, surface: RenderSurface) {
  switch (name) {
    case 'briefing-change': return askChange($, m)
    case 'briefing-cancel': return cancelChange($, m)
    case 'briefing-now': return forceChange(m)
    case 'briefing-close': return closeChange($, m)
    case 'briefing-copy': return copyBriefing($, m, surface)
    case 'briefing-start': return startConversation($, m)
    case 'briefing-open': return openBriefing($, m)
    case 'briefing-retry': return retryChange($, m)
    case 'hearth-fire-on': return setFire($, m, true)
    case 'hearth-fire-off': return setFire($, m, false)
    case 'hearth-mode-auto': return setBriefingMode($, m, 'auto')
    case 'hearth-mode-manual': return setBriefingMode($, m, 'manual')
    case 'hearth-compact-0': return setCompactBefore($, m, 0)
    case 'hearth-compact-1': return setCompactBefore($, m, 1)
    case 'hearth-compact-2': return setCompactBefore($, m, 2)
    case 'hearth-compact-3': return setCompactBefore($, m, 3)
    case 'hearth-compact-always': return setCompactBefore($, m, 'always')
    case 'theme-cosy': return setTheme($, m, 'cosy')
    case 'theme-japonais': return setTheme($, m, 'japonais')
    case 'theme-nature': return setTheme($, m, 'nature')
    case 'theme-futuriste': return setTheme($, m, 'futuriste')
    case 'theme-geek': return setTheme($, m, 'geek')
    case 'theme-base': return setTheme($, m, 'base')
    default: return undefined
  }
}

/** A press on a gesture: the Button's own `onPress` does nothing, since the drawing changes under it. */
export async function pressGesture($: Host, m: Memory, e: Press) {
  await guard($, m, 'press', () => runGesture($, m, e.element, e.surface))
  m.wake()
  return { element: e.element }
}
