import type { DrawnPlan, PlanStatus, PlanStep } from '../types'
import { t } from './i18n'
import { cut, flat } from './lines'
import type { Plan } from './memory'

const NOTE_MAX = 240
const QUOTE_MAX = 40
const STATUSES: readonly unknown[] = ['pending', 'in_progress', 'completed']

const isStatus = (status: unknown): status is PlanStatus => STATUSES.includes(status)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export const allDone = (steps: readonly PlanStep[]) => steps.length > 0 && steps.every(st => st.status === 'completed')

/** A plan with work left. */
export const isOpen = (plan: Plan | null) => !!plan && plan.steps.length > 0 && !allDone(plan.steps)

const noteOf = (value: unknown) => (typeof value === 'string' ? cut(flat(value), NOTE_MAX) : '')

/** `detail` and `who` when they say something. */
function notes(raw: Record<string, unknown>) {
  const [detail, who] = [noteOf(raw.detail), noteOf(raw.who)]
  return { ...(detail ? { detail } : {}), ...(who ? { who } : {}) }
}

/** The steps a call sent, or why it was turned down. */
export function readSteps(raw: unknown): { steps: PlanStep[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: t('plan.err.list') }
  const steps: PlanStep[] = []
  for (const item of raw) {
    const step = isRecord(item) ? item : {}
    const text = typeof step.text === 'string' ? flat(step.text) : ''
    if (!text) return { error: t('plan.err.text') }
    if (!isStatus(step.status)) return { error: t('plan.err.status', { text: cut(text, QUOTE_MAX) }) }
    steps.push({ text, status: step.status, ...notes(step) })
  }
  return { steps }
}

/**
 * The list as it stands after a call. A step said again keeps what it was told: it is known by its id if it has one,
 * else by its text, and each old step serves once. `finished` holds the steps that have just been done.
 */
export function reconcile(old: readonly PlanStep[], sent: readonly PlanStep[], at: string) {
  const free = [...old]
  const finished: string[] = []
  const steps = sent.map(st => {
    const i = free.findIndex(was => (st.id ? was.id === st.id : was.text === st.text))
    const was = i < 0 ? undefined : free.splice(i, 1)[0]
    const done = st.status === 'completed'
    if (done && was?.status !== 'completed') finished.push(st.text)
    const [id, detail, who] = [st.id ?? was?.id, st.detail ?? was?.detail, st.who ?? was?.who]
    const doneAt = was?.doneAt ?? at
    return { ...(id ? { id } : {}), text: st.text, status: st.status, ...(done ? { doneAt } : {}), ...(detail ? { detail } : {}), ...(who ? { who } : {}) }
  })
  return { steps, finished }
}

/** A list with work left, sent after a plan that was all done, starts over. */
export const startsOver = (old: readonly PlanStep[], sent: readonly PlanStep[]) => !old.length || (allDone(old) && !allDone(sent))

/** The list `TodoWrite` sends. A line with no words is dropped, a status it cannot read is pending. */
export function todoSteps(raw: unknown): PlanStep[] {
  const list = Array.isArray(raw) ? raw : []
  return list.flatMap((item): PlanStep[] => {
    const step = isRecord(item) ? item : {}
    const text = typeof step.content === 'string' ? flat(step.content) : ''
    return text ? [{ text, status: isStatus(step.status) ? step.status : 'pending' }] : []
  })
}

/** After `TaskCreate`: a list all done is over, so the new step opens another. Null: nothing to add. */
export function taskAdded(steps: readonly PlanStep[], subject: unknown, id: unknown): PlanStep[] | null {
  const text = typeof subject === 'string' ? flat(subject) : ''
  if (!text) return null
  const step: PlanStep = { ...(typeof id === 'string' && id ? { id } : {}), text, status: 'pending' }
  return [...(allDone(steps) ? [] : steps), step]
}

/** After `TaskUpdate`. A step it does not know comes in if it names a subject. Null: nothing changes. */
export function taskChanged(steps: readonly PlanStep[], input: Record<string, unknown>): PlanStep[] | null {
  const id = typeof input.taskId === 'string' ? input.taskId : ''
  const found = steps.findIndex(st => st.id === id)
  if (found < 0) {
    const added = taskAdded(steps, input.subject, id)
    return added && isStatus(input.status) ? [...added.slice(0, -1), { ...added[added.length - 1]!, status: input.status }] : added
  }
  if (input.status === 'deleted') return steps.filter((_, i) => i !== found)
  const subject = typeof input.subject === 'string' ? flat(input.subject) : ''
  return steps.map((st, i) => (i === found ? { ...st, ...(subject ? { text: subject } : {}), ...(isStatus(input.status) ? { status: input.status } : {}) } : st))
}

/** What the band and the pane need of a plan. */
export function drawnPlan(plan: Plan): DrawnPlan {
  const steps = plan.steps.map(st => ({ text: st.text, status: st.status, ...(st.detail ? { detail: st.detail } : {}), ...(st.who ? { who: st.who } : {}) }))
  return { title: plan.title, steps }
}

/** What goes in the plan's file: never the id of a mirrored step. */
export function planFile(plan: Plan) {
  const steps = plan.steps.map(({ id: _id, ...st }) => st)
  return `${JSON.stringify({ title: plan.title, updatedAt: plan.updatedAt, steps }, null, 2)}\n`
}

/** A plan read back from its file, or null when the file does not hold one. Steps out of shape are left out. */
export function planFromFile(json: unknown): Plan | null {
  if (!isRecord(json) || !Array.isArray(json.steps)) return null
  const steps = json.steps.flatMap((item): PlanStep[] => {
    if (!isRecord(item) || typeof item.text !== 'string' || !item.text || !isStatus(item.status)) return []
    return [{ text: item.text, status: item.status, ...(typeof item.doneAt === 'string' ? { doneAt: item.doneAt } : {}), ...notes(item) }]
  })
  const title = typeof json.title === 'string' && json.title ? json.title : t('plan.defaultTitle')
  return { title, steps, updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : '' }
}
