import type { Host, System } from './host'

import { log, readText, reason } from './disk'
import { t } from './i18n'
import type { Memory } from './memory'

// How far each way may carry the briefing: a command line stops near 32,000 characters, and a link earlier.
const MESSAGE_TEXT_MAX = 28_000
const LINK_TEXT_MAX = 14_336
const TITLE_MAX = 80
const BRAND = 'PixelDesk'

/** How the new conversation opened: read and resumed, waiting for Enter, not at all, or nowhere to open it. */
export type Opening = 'resumed' | 'pasted' | 'failed' | 'no-folder'

const systemOf = (home: string): System => (/^[A-Za-z]:/.test(home) ? 'windows' : home.startsWith('/Users/') ? 'mac' : 'linux')

/** A path as the system spells it. */
const native = (path: string, system: System) => (system === 'windows' ? path.replace(/\//g, '\\') : path)

/** The briefing as a message can carry it. Past `max`, the message says where the rest lies, and that is all. */
const carried = (text: string, max: number, path: string) => (text.length <= max ? text : `${text.slice(0, max)}\n\n${t('briefing.cut', { file: path })}`)

/** The name of the new conversation: the briefing's own title, without its label. */
const titleOf = (text: string) => (/^#\s+(.+)$/m.exec(text)?.[1] ?? '').replace(/^[^:]*:\s*/, '').trim().slice(0, TITLE_MAX) || BRAND

/** Hands a link or a file to the system. Windows says 0 whatever came of it. */
async function opened($: Host, m: Memory, system: System, target: string) {
  try {
    return (await $.process.open(system, target)).exitCode === 0
  } catch (err) {
    await log($, m, `open: ${reason(err)}`)
    return false
  }
}

/** The folder the session runs in now, a worktree's included; empty when nothing says. */
async function sessionFolder($: Host, m: Memory, system: System) {
  const here = await $.session.cwd().catch(() => '')
  return here || native(m.cwd, system)
}

/**
 * Starts the conversation before showing it: its first message carries the briefing and its title, and opens no tool.
 */
async function startedHeadless($: Host, m: Memory, id: string, message: string, cwd: string, title: string) {
  try {
    const { exitCode } = await $.process.claude(message, id, cwd, title)
    if (exitCode !== 0) await log($, m, `claude -p ended with ${exitCode}`)
    return exitCode === 0
  } catch (err) {
    await log($, m, `claude -p: ${reason(err)}`)
    return false
  }
}

/** A new conversation in the session's exact folder, with the briefing read; else one that waits for Enter. */
export async function openConversation($: Host, m: Memory, file: string): Promise<Opening> {
  const system = systemOf(m.home)
  const folder = await sessionFolder($, m, system)
  if (!folder) return 'no-folder'
  const path = native(file, system)
  const text = await readText($, file)
  if (text === undefined) return 'failed'
  if (system !== 'linux') {
    const id = crypto.randomUUID()
    if ((await startedHeadless($, m, id, t('briefing.message', { text: carried(text, MESSAGE_TEXT_MAX, path) }), folder, titleOf(text))) && (await opened($, m, system, `claude://resume?session=${id}`))) return 'resumed'
  }
  const sentence = t('briefing.pasted', { text: carried(text, LINK_TEXT_MAX, path) })
  const link = `claude://code/new?q=${encodeURIComponent(sentence)}&folder=${encodeURIComponent(folder)}`
  return (await opened($, m, system, link)) ? 'pasted' : 'failed'
}

/** The file, in whatever the system opens it with. */
export function openFile($: Host, m: Memory, file: string) {
  const system = systemOf(m.home)
  return opened($, m, system, native(file, system))
}
