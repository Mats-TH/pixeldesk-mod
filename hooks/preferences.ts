import type { EngineInterface } from 'claude-code'

import type { CompactBefore, Departure, BriefingMode, SettingsView } from '../types'
import { sweep } from './agents'
import { departureOf } from './desks'
import { guard, log, onDisk, reason, settingsPath } from './disk'
import { PANE } from './memory'
import type { Memory } from './memory'
import { readSettings, writeSettings } from './state'

type SettingsFile = Record<string, unknown>

const isObject = (v: unknown): v is SettingsFile => typeof v === 'object' && v !== null && !Array.isArray(v)

/** What the file holds. No file, or valid JSON of another shape: the defaults. Unreadable or broken: undefined, and nothing changes. */
async function readFile($: EngineInterface, m: Memory): Promise<SettingsFile | undefined> {
  const path = settingsPath(m)
  let text: string
  try {
    text = await $.fs.read(path)
  } catch {
    return (await $.fs.exists(path).catch(() => true)) ? undefined : {}
  }
  try {
    const json: unknown = JSON.parse(text)
    return isObject(json) ? json : {}
  } catch {
    return undefined
  }
}

/** One setting changes and every other key stays. A failure goes to the log: the change still holds here, until the next read. */
async function save($: EngineInterface, m: Memory, change: (settings: SettingsFile) => SettingsFile) {
  if (!onDisk(m)) return
  try {
    const settings = change((await readFile($, m)) ?? {})
    await $.fs.write(settingsPath(m), `${JSON.stringify(settings, null, 2)}\n`)
  } catch (err) {
    await log($, m, `settings file: ${reason(err)}`)
  }
}

/** What the settings say of the cache and the briefing. Anything else in the file is the default. */
const fireSetting = (settings: SettingsFile) => settings.fire !== false
const modeOf = (settings: SettingsFile): BriefingMode => (settings.briefingMode === 'manual' ? 'manual' : 'auto')
const compactOf = (value: unknown): CompactBefore => (value === 0 || value === 1 || value === 2 || value === 3 || value === 'always' ? value : 2)

const viewOf = (m: Memory, open: boolean): SettingsView => ({ open, departure: m.departure, fire: m.fire, briefingMode: m.briefingMode, compactBefore: m.compactBefore })

function closePane($: EngineInterface, m: Memory) {
  return guard($, m, 'close pane', () => $.ui.close({ id: PANE }))
}

async function isOpen($: EngineInterface) {
  return (await readSettings($))?.open ?? false
}

async function applyHearth($: EngineInterface, m: Memory, fire: boolean, briefingMode: BriefingMode, compactBefore: CompactBefore) {
  m.fire = fire
  m.briefingMode = briefingMode
  m.compactBefore = compactBefore
  await writeSettings($, viewOf(m, await isOpen($)))
  m.wake()
}

async function applyDeparture($: EngineInterface, m: Memory, departure: Departure) {
  m.departure = departure
  await writeSettings($, viewOf(m, await isOpen($)))
  await sweep($, m)
}

/** The panel's choice, or the command's: for every conversation, and at once for the desks already due. */
export async function setDeparture($: EngineInterface, m: Memory, departure: Departure) {
  await save($, m, settings => ({ ...settings, departure }))
  await applyDeparture($, m, departure)
}

/** Hiding is about the pane alone: the band and the tracking go on. */
export async function setHidden($: EngineInterface, m: Memory, hidden: boolean) {
  await save($, m, ({ hidden: _old, ...others }) => (hidden ? { ...others, hidden } : others))
  m.hidden = hidden
  if (hidden) await closePane($, m)
}

/** The relaunches, on or off, for every conversation. */
export async function setFire($: EngineInterface, m: Memory, fire: boolean) {
  await save($, m, settings => ({ ...settings, fire }))
  await applyHearth($, m, fire, m.briefingMode, m.compactBefore)
}

/** How a conversation changes, for every conversation. */
export async function setBriefingMode($: EngineInterface, m: Memory, briefingMode: BriefingMode) {
  await save($, m, settings => ({ ...settings, briefingMode }))
  await applyHearth($, m, m.fire, briefingMode, m.compactBefore)
}

/** How many compactions before a change, for every conversation. */
export async function setCompactBefore($: EngineInterface, m: Memory, compactBefore: CompactBefore) {
  await save($, m, settings => ({ ...settings, compactBefore }))
  await applyHearth($, m, m.fire, m.briefingMode, compactBefore)
}

/** One read for every setting. A conversation that sees the mod come back waits for the next agents to reopen its pane. */
export async function followSettings($: EngineInterface, m: Memory) {
  if (!onDisk(m)) return
  const settings = await readFile($, m)
  if (!settings) return
  const hidden = settings.hidden === true
  if (hidden !== m.hidden) {
    m.hidden = hidden
    if (hidden) await closePane($, m)
  }
  const departure = departureOf(settings)
  if (departure !== m.departure) await applyDeparture($, m, departure)
  const [fire, mode, before] = [fireSetting(settings), modeOf(settings), compactOf(settings.compactBefore)]
  if (fire !== m.fire || mode !== m.briefingMode || before !== m.compactBefore) await applyHearth($, m, fire, mode, before)
}

/** Each start closes the settings panel: its state never reaches the disk. */
export function closeSettings($: EngineInterface, m: Memory) {
  return writeSettings($, viewOf(m, false))
}

/** The button: the only way to close the panel it opens. */
export async function toggleSettings($: EngineInterface, m: Memory) {
  await writeSettings($, viewOf(m, !(await isOpen($))))
}

/** A press in the settings: the row of the button or of an option, whichever line of it the pointer fell on. */
export async function pressSettings($: EngineInterface, m: Memory, element: string) {
  await guard($, m, 'settings press', () => {
    if (element.startsWith('settings-button')) return toggleSettings($, m)
    return setDeparture($, m, element.startsWith('settings-plan') ? 'plan' : 'each')
  })
  return { element }
}
