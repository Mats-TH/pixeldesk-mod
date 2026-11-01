import type { Host } from './host'

import type { AgentPhase } from '../types'
import { t } from './i18n'

export const SUMMARY_MS = 45_000
const RECENT = 12

export type SummaryMark = { at: number; count: number }
type Source = { description: string; phase: AgentPhase; count: number; steps: readonly { live: string }[] }

export function dueForSummary(agent: Source, mark: SummaryMark, now: number, paneOpen: boolean) {
  if (!paneOpen || agent.count === mark.count) return false
  if (agent.phase !== 'working') return true
  return now - mark.at >= SUMMARY_MS
}

export function summaryPrompt(agent: Source) {
  const recent = agent.steps.slice(-RECENT).map(st => `- ${st.live}`).join('\n')
  return `${t('summary.mission', { description: agent.description })}\n${t('summary.recent')}\n${recent}`
}

/** A sentence for the card, or null: a failed summary leaves the rule line in place. */
export async function summarize($: Host, agent: Source): Promise<string | null> {
  try {
    const r = await $.model.complete({ model: 'haiku', system: t('summary.system'), prompt: summaryPrompt(agent), maxTokens: 120 })
    const text = r.isAnswered ? r.text.trim() : ''
    return text || null
  } catch {
    return null
  }
}
