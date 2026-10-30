import type { EngineInterface } from 'claude-code'

import type { Departure } from '../types'
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

function closePane($: EngineInterface, m: Memory) {
  return guard($, m, 'close pane', () => $.ui.close({ id: PANE }))
}

async function isOpen($: EngineInterface) {
  return (await readSettings($))?.open ?? false
}

async function applyDeparture($: EngineInterface, m: Memory, departure: Departure) {
  m.departure = departure
  await writeSettings($, { open: await isOpen($), departure })
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

/** One read for both settings. A conversation that sees the mod come back waits for the next agents to reopen its pane. */
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
}

/** Each start closes the settings panel: its state never reaches the disk. */
export function closeSettings($: EngineInterface, m: Memory) {
  return writeSettings($, { open: false, departure: m.departure })
}

/** The button: the only way to close the panel it opens. */
export async function toggleSettings($: EngineInterface, m: Memory) {
  await writeSettings($, { open: !(await isOpen($)), departure: m.departure })
}

/** A press in the settings: the row of the button or of an option, whichever line of it the pointer fell on. */
export async function pressSettings($: EngineInterface, m: Memory, element: string) {
  await guard($, m, 'settings press', () => {
    if (element.startsWith('settings-button')) return toggleSettings($, m)
    return setDeparture($, m, element.startsWith('settings-plan') ? 'plan' : 'each')
  })
  return { element }
}
