import type { SessionMessage } from 'claude-code'

import { t } from './i18n'
import { flat, slashed } from './lines'

const MAX_FILES = 30
const MAX_LINKS = 20
const MAX_ASKS = 25
const ASK_CHARS = 300
const MAX_DECISIONS = 30
const FILE_FIELDS = ['file_path', 'notebook_path', 'path'] as const
const SHELLS: readonly string[] = ['Bash', 'PowerShell']
const OUT_OF_TREE = ['/.claude/projects/', '/tool-results/', '/appdata/local/temp/']
const HOME_PATH = /(?:[A-Za-z]:[\\/]Users[\\/]|\/Users\/|\/home\/|~\/)[^\s"'`|;<>]+/g
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\/|~\/)/
const LINK = /https?:\/\/[^\s<>"'`)\]}]+/g
const LOCAL_HOST = /^https?:\/\/(?:localhost|127\.0\.0\.1|example\.com)\b/
const DECISION = /\b(?:d[ée]cid|on garde|on part sur|on choisit|retenu|choisi|decided|decision|we(?:'ll| will) (?:go with|use|keep)|chosen|settled on)/i

// Known shapes of a secret, longest prefixes first. The text says "retiré", never what it was.
const SECRETS: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abp]-[A-Za-z0-9-]{10,}/g,
  /\bAIza[A-Za-z0-9_-]{30,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
]
const BEARER = /\bBearer ([A-Za-z0-9._~+/=-]{20,})/g

export type Found = { files: string[]; skills: string[]; links: string[]; asks: string[]; decisions: string[] }

/** Secrets of a known shape go, before anything is saved or copied. */
export function scrubbed(text: string) {
  const gone = t('handoff.secret')
  return SECRETS.reduce((clean, shape) => clean.replace(shape, gone), text).replace(BEARER, `Bearer ${gone}`)
}

/** A path as the list keeps it: home spelled out, forward slashes, no final dot; empty for what is not the project's. */
function kept(raw: string, home: string) {
  const path = slashed(raw).replace(/^~\//, `${home}/`).replace(/\.+$/, '')
  const lower = path.toLowerCase()
  const outside = OUT_OF_TREE.some(part => lower.includes(part)) || lower.startsWith('/tmp') || lower.startsWith('/private/tmp')
  return outside ? '' : path
}

function scoreFiles(messages: readonly SessionMessage[], home: string) {
  const scores = new Map<string, number>()
  const add = (raw: string, points: number) => {
    const path = kept(raw, home)
    if (path) scores.set(path, (scores.get(path) ?? 0) + points)
  }
  for (const use of messages.flatMap(message => message.toolUses)) {
    const input = (use.input ?? {}) as Record<string, unknown>
    for (const field of FILE_FIELDS) {
      const value = input[field]
      if (typeof value === 'string' && ABSOLUTE.test(value)) add(value, use.tool === 'Read' ? 2 : 3)
    }
    if (SHELLS.includes(use.tool) && typeof input.command === 'string') for (const [path] of input.command.matchAll(HOME_PATH)) add(path, 1)
  }
  return [...scores].sort((a, b) => b[1] - a[1]).map(([path]) => path)
}

function toolsOf(messages: readonly SessionMessage[]) {
  const names = new Set<string>()
  for (const use of messages.flatMap(message => message.toolUses)) {
    const skill = (use.input as { skill?: unknown } | undefined)?.skill
    if (use.tool === 'Skill' && typeof skill === 'string') names.add(`/${skill}`)
    const server = use.tool.match(/^mcp__([^_]+(?:_[^_]+)*?)__/)?.[1]
    if (server) names.add(`MCP ${server}`)
  }
  return [...names]
}

function linksOf(messages: readonly SessionMessage[]) {
  const links = messages.flatMap(message => [...message.text.matchAll(LINK)].map(([link]) => link.replace(/[.,;:!?]+$/, '')))
  return [...new Set(links.filter(link => !LOCAL_HOST.test(link)))].slice(-MAX_LINKS)
}

const asksOf = (messages: readonly SessionMessage[]) =>
  messages.filter(message => message.role === 'user' && message.text.trim() && !message.text.trimStart().startsWith('<')).map(message => flat(message.text).slice(0, ASK_CHARS)).slice(-MAX_ASKS)

/** The sentences that read as a decision. No model here: a compaction may start in the middle of a turn. */
function decisionsOf(messages: readonly SessionMessage[]) {
  const lines = messages.flatMap(message => message.text.split(/\n|(?<=[.!?])\s+/)).map(flat).filter(line => DECISION.test(line) && line.length > 12)
  return [...new Set(lines)].map(line => line.slice(0, ASK_CHARS)).slice(-MAX_DECISIONS)
}

/** All that can be read off a conversation without a model. The files are not yet checked against the disk. */
export const gather = (messages: readonly SessionMessage[], home: string): Found => ({
  files: scoreFiles(messages, home),
  skills: toolsOf(messages),
  links: linksOf(messages),
  asks: asksOf(messages),
  decisions: decisionsOf(messages),
})

export const MOST_FILES = MAX_FILES

/** The home folder as `~`, for what is read rather than opened. */
export const tilde = (path: string, home: string) => (home && path.startsWith(home) ? `~${path.slice(home.length)}` : path)

const listOr = (items: readonly string[]) => (items.length ? items.join(', ') : t('handoff.none'))

/** What a request to the model shows of the conversation. */
export const promptValues = (found: Found) => ({ files: listOr(found.files), skills: listOr(found.skills), links: listOr(found.links) })

/** Takes a code block off a reply that came wrapped in one. */
export function unwrapped(reply: string) {
  const text = reply.trim()
  return text.match(/^```[^\n]*\n([\s\S]*)\n```$/)?.[1]?.trim() ?? text
}

/** The name a handoff is saved under, from its title. */
export function slugOf(text: string) {
  const title = text.match(/^# (?:Passation :|Handoff:)(.*)$/m)?.[1] ?? ''
  const slug = title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '')
  return slug || 'session'
}

/** The local time, as a file name spells it. */
export function stampOf(now: number) {
  const d = new Date(now)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`
}

export const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean).length
