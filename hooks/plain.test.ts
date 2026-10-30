import { expect, test } from 'claude-code/testing'

import { dueForSummary, summaryPrompt } from './plain'

const agent = { id: 'a', description: 'Audit du code', phase: 'working', count: 5, steps: [{ live: 'Lecture de band.ts' }] } as const

test('no summary with the pane closed', async () => {
  expect(dueForSummary(agent, { at: 0, count: 0 }, 100_000, false)).toBe(false)
})

test('at most one summary every 45 s', async () => {
  expect(dueForSummary(agent, { at: 90_000, count: 1 }, 100_000, true), 'too early').toBe(false)
  expect(dueForSummary(agent, { at: 50_000, count: 1 }, 100_000, true), 'late enough').toBe(true)
})

test('nothing new, no call', async () => {
  expect(dueForSummary(agent, { at: 0, count: 5 }, 100_000, true)).toBe(false)
})

test('one last summary when the agent ends', async () => {
  expect(dueForSummary({ ...agent, phase: 'done' }, { at: 95_000, count: 4 }, 100_000, true)).toBe(true)
})

test('the prompt carries the task and the latest actions', async () => {
  const prompt = summaryPrompt({ ...agent, steps: [...agent.steps] })
  expect(prompt).toContain('Audit du code')
  expect(prompt).toContain('Lecture de band.ts')
})
