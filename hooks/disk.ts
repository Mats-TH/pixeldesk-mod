import type { EngineInterface } from 'claude-code'

import { cut, slashed } from './lines'
import type { Memory } from './memory'

// The log is rewritten whole on each line: the file stays well under what a read may take.
const LOG_KEEP = 256 * 1024
const TOAST_MAX = 140

/** The home folder, with forward slashes and no slash at the end; empty when the environment does not say. */
export async function readHome($: EngineInterface) {
  try {
    const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || ''
    return slashed(home).replace(/\/+$/, '')
  } catch {
    return ''
  }
}

const root = (m: Memory) => `${m.home}/.claude/pixeldesk`

export const settingsPath = (m: Memory) => `${root(m)}/settings.json`
export const stateDir = (m: Memory) => `${root(m)}/state`
export const planPath = (m: Memory) => `${stateDir(m)}/plan-${m.sessionId}.json`
export const deskPath = (m: Memory, id: string) => `${stateDir(m)}/desk-${id}.json`
export const hearthPath = (m: Memory) => `${stateDir(m)}/hearth-${m.sessionId}.json`
export const handoffsDir = (m: Memory) => `${root(m)}/handoffs`
const logPath = (m: Memory) => `${root(m)}/logs/pixeldesk.log`

/** Without a home or a session id nothing goes near the disk: the mod carries on in memory. */
export const onDisk = (m: Memory) => m.home !== '' && m.sessionId !== ''

export const reason = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** One line in the log; the failure of a log line is nobody's problem. Lines are written one after the other. */
export function log($: EngineInterface, m: Memory, message: string) {
  if (!onDisk(m)) return Promise.resolve()
  m.logs = m.logs.then(async () => {
    try {
      const path = logPath(m)
      const before = await $.fs.read(path).catch(() => '')
      const at = new Date(await $.clock.now()).toISOString()
      await $.fs.write(path, `${before}${at} ${message}\n`.slice(-LOG_KEEP))
    } catch {
      // Nowhere left to say it.
    }
  })
  return m.logs
}

/** A line on screen, held to what a toast shows; its failure goes to the log. */
export function toast($: EngineInterface, m: Memory, text: string) {
  try {
    $.ui.toast(cut(text, TOAST_MAX))
  } catch (err) {
    void log($, m, `toast: ${reason(err)}`)
  }
}

/** Runs what must not break the conversation: a failure becomes a line in the log. */
export async function guard<T>($: EngineInterface, m: Memory, what: string, work: () => Promise<T> | T): Promise<T | undefined> {
  try {
    return await work()
  } catch (err) {
    await log($, m, `${what}: ${reason(err)}`)
    return undefined
  }
}

/** A file's text, or undefined when it cannot be read. */
export function readText($: EngineInterface, path: string) {
  return $.fs.read(path).catch(() => undefined)
}

/** A folder's entries. A folder that is not there is empty; any other failure is the caller's. */
export async function listed($: EngineInterface, path: string) {
  try {
    return await $.fs.list(path)
  } catch (err) {
    if (await $.fs.exists(path).catch(() => false)) throw err
    return []
  }
}
