import type { EngineInterface } from 'claude-code'

import { log, reason } from './disk'
import { t } from './i18n'
import type { Memory } from './memory'

// How far a link may carry the sentence. The briefing itself never rides in an address.
const LINK_TEXT_MAX = 14_336
const FIRST_READ_MS = 180_000

type System = 'windows' | 'mac' | 'linux'

/** How the new conversation opened: read and resumed, waiting for Enter, not at all, or nowhere to open it. */
export type Opening = 'resumed' | 'pasted' | 'failed' | 'no-folder'

const systemOf = (home: string): System => (/^[A-Za-z]:/.test(home) ? 'windows' : home.startsWith('/Users/') ? 'mac' : 'linux')

/** A path as the system spells it. */
const native = (path: string, system: System) => (system === 'windows' ? path.replace(/\//g, '\\') : path)

const OPENERS: Record<System, readonly string[]> = {
  windows: ['rundll32', 'url.dll,FileProtocolHandler'],
  mac: ['open'],
  linux: ['xdg-open'],
}

/** Hands a link or a file to the system. Windows says 0 whatever came of it. */
async function opened($: EngineInterface, m: Memory, system: System, target: string) {
  try {
    return (await $.process.run([...OPENERS[system], target])).exitCode === 0
  } catch (err) {
    await log($, m, `open: ${reason(err)}`)
    return false
  }
}

/** The folder the session runs in now, a worktree's included; empty when nothing says. */
async function sessionFolder($: EngineInterface, m: Memory, system: System) {
  const here = await $.session.cwd().catch(() => '')
  return here || native(m.cwd, system)
}

/**
 * Starts the conversation before showing it: its first message is sent, and only the Read tool is open to it.
 * The `=` of `--allowedTools=Read` stays: apart, the flag swallows the message.
 */
async function startedHeadless($: EngineInterface, m: Memory, id: string, message: string, cwd: string) {
  try {
    const { exitCode } = await $.process.run(['claude', '-p', message, '--session-id', id, '--allowedTools=Read'], { cwd, timeoutMs: FIRST_READ_MS })
    if (exitCode !== 0) await log($, m, `claude -p ended with ${exitCode}`)
    return exitCode === 0
  } catch (err) {
    await log($, m, `claude -p: ${reason(err)}`)
    return false
  }
}

/** A new conversation in the session's exact folder, with the briefing read; else one that waits for Enter. */
export async function openConversation($: EngineInterface, m: Memory, file: string): Promise<Opening> {
  const system = systemOf(m.home)
  const folder = await sessionFolder($, m, system)
  if (!folder) return 'no-folder'
  const path = native(file, system)
  if (system !== 'linux') {
    const id = crypto.randomUUID()
    if ((await startedHeadless($, m, id, t('briefing.message', { file: path }), folder)) && (await opened($, m, system, `claude://resume?session=${id}`))) return 'resumed'
  }
  const sentence = t('briefing.pasted', { file: path }).slice(0, LINK_TEXT_MAX)
  const link = `claude://code/new?q=${encodeURIComponent(sentence)}&folder=${encodeURIComponent(folder)}`
  return (await opened($, m, system, link)) ? 'pasted' : 'failed'
}

/** The file, in whatever the system opens it with. */
export function openFile($: EngineInterface, m: Memory, file: string) {
  const system = systemOf(m.home)
  return opened($, m, system, native(file, system))
}
