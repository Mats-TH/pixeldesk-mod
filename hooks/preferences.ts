import type { Host } from './host'

import type { CompactBefore, Departure, BriefingMode, RoomTheme, SettingsView } from '../types'
import { sweep } from './agents'
import { departureOf } from './desks'
import { ROOM_THEMES } from './card'
import { guard, log, onDisk, reason, settingsPath } from './disk'
import { PANE } from './memory'
import type { Memory } from './memory'
import { readSettings, writeSettings } from './state'

type SettingsFile = Record<string, unknown>

const isObject = (v: unknown): v is SettingsFile => typeof v === 'object' && v !== null && !Array.isArray(v)

/** What the file holds. No file, or valid JSON of another shape: the defaults. Unreadable or broken: undefined, and nothing changes. */
async function readFile(host: Host, m: Memory): Promise<SettingsFile | undefined> {
  const path = settingsPath(m)
  let text: string
  try {
    text = await host.fs.read(path)
  } catch {
    return (await host.fs.exists(path).catch(() => true)) ? undefined : {}
  }
  try {
    const json: unknown = JSON.parse(text)
    return isObject(json) ? json : {}
  } catch {
    return undefined
  }
}

export { ROOM_THEMES }

/** One setting changes and every other key stays. A failure goes to the log: the change still holds here, until the next read. */
async function save(host: Host, m: Memory, change: (settings: SettingsFile) => SettingsFile) {
  if (!onDisk(m)) return
  try {
    const settings = change((await readFile(host, m)) ?? {})
    await host.fs.write(settingsPath(m), `${JSON.stringify(settings, null, 2)}\n`)
  } catch (err) {
    await log(host, m, `settings file: ${reason(err)}`)
  }
}

/** What the settings say of the cache and the briefing. Anything else in the file is the default. */
const fireSetting = (settings: SettingsFile) => settings.fire !== false
const modeOf = (settings: SettingsFile): BriefingMode => (settings.briefingMode === 'manual' ? 'manual' : 'auto')
const compactOf = (value: unknown): CompactBefore => (value === 0 || value === 1 || value === 2 || value === 3 || value === 'always' ? value : 2)

export const isTheme = (value: unknown): value is RoomTheme => ROOM_THEMES.includes(value as RoomTheme)
const themeOf = (settings: SettingsFile): RoomTheme => (isTheme(settings.theme) ? settings.theme : 'cosy')

const viewOf = (m: Memory, open: boolean): SettingsView => ({ open, departure: m.departure, fire: m.fire, briefingMode: m.briefingMode, compactBefore: m.compactBefore, theme: m.theme })

function closePane(host: Host, m: Memory) {
  return guard(host, m, 'close pane', () => host.ui.close({ id: PANE }))
}

async function isOpen(host: Host) {
  return (await readSettings(host))?.open ?? false
}

async function applyHearth(host: Host, m: Memory, fire: boolean, briefingMode: BriefingMode, compactBefore: CompactBefore) {
  m.fire = fire
  m.briefingMode = briefingMode
  m.compactBefore = compactBefore
  await writeSettings(host, viewOf(m, await isOpen(host)))
  m.wake()
}

async function applyTheme(host: Host, m: Memory, theme: RoomTheme) {
  m.theme = theme
  await writeSettings(host, viewOf(m, await isOpen(host)))
}

async function applyDeparture(host: Host, m: Memory, departure: Departure) {
  m.departure = departure
  await writeSettings(host, viewOf(m, await isOpen(host)))
  await sweep(host, m)
}

/** The panel's choice, or the command's: for every conversation, and at once for the desks already due. */
export async function setDeparture(host: Host, m: Memory, departure: Departure) {
  await save(host, m, settings => ({ ...settings, departure }))
  await applyDeparture(host, m, departure)
}

/** The world of the rooms, for every conversation, at any time. */
export async function setTheme(host: Host, m: Memory, theme: RoomTheme) {
  await save(host, m, settings => ({ ...settings, theme }))
  await applyTheme(host, m, theme)
}

/** Hiding is about the pane alone: the band and the tracking go on. */
export async function setHidden(host: Host, m: Memory, hidden: boolean) {
  await save(host, m, ({ hidden: _old, ...others }) => (hidden ? { ...others, hidden } : others))
  m.hidden = hidden
  if (hidden) await closePane(host, m)
}

/** The relaunches, on or off, for every conversation. */
export async function setFire(host: Host, m: Memory, fire: boolean) {
  await save(host, m, settings => ({ ...settings, fire }))
  await applyHearth(host, m, fire, m.briefingMode, m.compactBefore)
}

/** How a conversation changes, for every conversation. */
export async function setBriefingMode(host: Host, m: Memory, briefingMode: BriefingMode) {
  await save(host, m, settings => ({ ...settings, briefingMode }))
  await applyHearth(host, m, m.fire, briefingMode, m.compactBefore)
}

/** How many compactions before a change, for every conversation. */
export async function setCompactBefore(host: Host, m: Memory, compactBefore: CompactBefore) {
  await save(host, m, settings => ({ ...settings, compactBefore }))
  await applyHearth(host, m, m.fire, m.briefingMode, compactBefore)
}

/** One read for every setting. A conversation that sees the mod come back waits for the next agents to reopen its pane. */
export async function followSettings(host: Host, m: Memory) {
  if (!onDisk(m)) return
  const settings = await readFile(host, m)
  if (!settings) return
  const hidden = settings.hidden === true
  if (hidden !== m.hidden) {
    m.hidden = hidden
    if (hidden) await closePane(host, m)
  }
  const departure = departureOf(settings)
  if (departure !== m.departure) await applyDeparture(host, m, departure)
  const theme = themeOf(settings)
  if (theme !== m.theme) await applyTheme(host, m, theme)
  const [fire, mode, before] = [fireSetting(settings), modeOf(settings), compactOf(settings.compactBefore)]
  if (fire !== m.fire || mode !== m.briefingMode || before !== m.compactBefore) await applyHearth(host, m, fire, mode, before)
}

/** Each start closes the settings panel: its state never reaches the disk. */
export function closeSettings(host: Host, m: Memory) {
  return writeSettings(host, viewOf(m, false))
}

/** The button: the only way to close the panel it opens. */
export async function toggleSettings(host: Host, m: Memory) {
  await writeSettings(host, viewOf(m, !(await isOpen(host))))
}

/** A press in the settings: the row of the button or of an option, whichever line of it the pointer fell on. */
export async function pressSettings(host: Host, m: Memory, element: string) {
  await guard(host, m, 'settings press', () => {
    if (element.startsWith('settings-button')) return toggleSettings(host, m)
    return setDeparture(host, m, element.startsWith('settings-plan') ? 'plan' : 'each')
  })
  return { element }
}
