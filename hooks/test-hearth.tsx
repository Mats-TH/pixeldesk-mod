import { SESSION, SETTINGS_FILE, endTurn, mountBand, startTurn, steps, usage, world } from './test-kit'
import type { WorldOptions } from './test-kit'

/** The engine's calls only the cache and the briefing make, on top of the kit's world. Nothing here reaches a real process. */

type Loose = any

export const FIVE = 300_000
export const HOUR = 3_600_000
export const BRIEFINGS = '/Users/test/.claude/pixeldesk/briefings'
export const READ = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 0 }
export const REWRITE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 90_000 }
export const BRIEFING_TEXT = '# Passation : finir le mod\n\nReprends dans ~/app.\n\n## Prochaines étapes\n\n1. Tester.'

export const TRANSCRIPT = `/Users/test/.claude/projects/app/${SESSION}.jsonl`
export const lengthLine = (field: string) => JSON.stringify({ type: 'assistant', message: { usage: { cache_creation: { [field]: 500 } } } })
/** What a transcript too big to read comes to: a read that refuses it. */
export const TOO_BIG = { [TRANSCRIPT]: 'past 4 MiB' }

export const STATE_FILE = `/Users/test/.claude/pixeldesk/state/hearth-${SESSION}.json`
export const NOTES = `${BRIEFINGS}/notes-${SESSION}.md`
export const DRAFT = `${BRIEFINGS}/draft-${SESSION}.md`
export const MANUAL = { [SETTINGS_FILE]: JSON.stringify({ briefingMode: 'manual' }) }
export const HELD_HEARTH = (at: number) => ({ lengthMs: FIVE, coolsAt: at + FIVE, relaunches: 0, relaunchSince: at, failures: 0, relaunchStop: null, relaunchError: '', keeperRun: 0, contextPercent: 10, compactions: 0 })

export const claudeRun = (w: Loose) => w.runs.find((r: Loose) => r.argv[0] === 'claude')
export const linksOpened = (w: Loose) => w.runs.filter((r: Loose) => r.argv[0] !== 'claude').map((r: Loose) => r.argv.at(-1))
export const saved = (w: Loose) => [...w.files.keys()].filter((p: string) => /\/\d{4}-\d{2}-\d{2}-\d{4}-/.test(p) && w.files.get(p))

/** A click on a button of the row above the band, as the person makes it. */
export async function press($: Loose, key: string, surface = 'desktop') {
  const ui = await mountBand($, surface)
  const pressed = await ui.press({ key })
  await ui.unmount()
  return pressed
}

const answered = (text = 'ok', u: unknown = READ) => ({ value: { isAnswered: true, text, usage: u } })
const pong = () => answered()

export const answers = { pong, reply: answered, nothing: { value: { isAnswered: false, reason: 'nothing-to-fork' } }, overloaded: { value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: READ } } }

export function hearthWorld(on: Loose, options: WorldOptions = {}) {
  const w = world(on, { ...options, files: { [TRANSCRIPT]: lengthLine('ephemeral_5m_input_tokens'), ...options.files } })
  const h = {
    w,
    forks: [] as string[],
    compacts: [] as Loose[],
    copies: [] as string[],
    /** What the model answers a fork, by its prompt. */
    fork: (prompt: string): Loose => (prompt.includes('Answer only') ? answered() : answered(BRIEFING_TEXT)),
    messages: [] as Loose[],
    model: 'opus',
    cwd: 'C:\\work\\app\\.claude\\worktrees\\feature',
    copied: true,
    compactAnswer: null as Loose,
  }
  const spend = steps(on)
  on('model.fork', (_: Loose, e: Loose) => {
    h.forks.push(e.prompt)
    return h.fork(e.prompt)
  })
  on('session.model', () => ({ value: h.model }))
  on('session.cwd', () => (h.cwd ? { value: h.cwd } : { deny: 'no folder' }))
  on('session.messages', () => ({ value: h.messages }))
  on('session.compact', (_: Loose, e: Loose) => {
    h.compacts.push(e)
    return h.compactAnswer ?? { messages: [{ role: 'user', text: 'summary', toolUses: [] }], tokensBefore: 800_000, tokensAfter: 40_000 }
  })
  on('session.end', (_: Loose, e: Loose) => ({ sessionId: e.sessionId }))
  on('ui.copy', (_: Loose, e: Loose) => {
    h.copies.push(e.text)
    return { value: h.copied ? { isCopied: true } : { isCopied: false, reason: 'no-surface' } }
  })
  return {
    ...h,
    h,
    /** A whole turn of the main conversation: the request leaves now. */
    async reply($: Loose) {
      await startTurn($)
      await spend($, usage(10, 10, 100, 100))
      await endTurn($)
    },
    spend,
    fill(percent: number, tokens = percent * 10_000) {
      w.context = { percent, tokens, window: 1_000_000 }
    },
  }
}
