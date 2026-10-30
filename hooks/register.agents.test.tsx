import { describe, expect, test } from 'claude-code/testing'

import { DESK_FILE, callTool, endTurn, everyText, hasKey, mountPane, sendPlan, spawn, start, step, steps, usage, world } from './test-kit'
import type { World } from './test-kit'

const SUFFIX = "PixelDesk : ton bureau montre ton avancement à l'utilisateur. Avant tout autre outil, liste tes étapes avec mcp__pixeldesk__plan, chacune pending, in_progress ou completed. Renvoie la liste complète à chaque étape commencée ou finie, et marque la dernière completed avant ta réponse finale. Inutile pour un travail d'une ligne."

const agent = (w: World, id: string) => w.state.agents?.find((a: any) => a.id === id)
const ids = (w: World) => (w.state.agents ?? []).map((a: any) => a.id)
const listed = (id: string, status: string, description = '') => ({ id, description, type: 'general-purpose', status })

describe('an agent arrives', () => {
  test('a record is made from what the spawn says', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { description: 'Check the build', type: 'code-reviewer' })
    expect(agent(w, 'a1')).toMatchObject({ id: 'a1', description: 'Check the build', type: 'code-reviewer', phase: 'working', startedAt: w.clock.now(), endedAt: 0, count: 0, tokens: 0, liveTokens: 0 })
  })

  test('a record holds its known fields and nothing else', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await sendPlan($, [step('Own', 'pending')], undefined, 'a1')
    await callTool($, 'Bash', { command: 'ls' }, 'a1')
    const keys = Object.keys(agent(w, 'a1')).sort()
    expect(keys).toEqual(['count', 'description', 'endedAt', 'hue', 'id', 'liveTokens', 'phase', 'plan', 'seat', 'startedAt', 'steps', 'tokens', 'type'])
    expect(Object.keys(agent(w, 'a1').steps[0])).toEqual(['live'])
  })

  test('an empty description and type are filled in', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { description: '', type: '' })
    expect(agent(w, 'a1')).toMatchObject({ description: 'Sous-agent', type: 'subagent' })
  })

  test('a spawn with no agent id leaves no record', async ($, on) => {
    const w = world(on)
    await start($)
    w.nextAgent = ''
    await spawn($, w, '')
    expect(ids(w)).toEqual([])
  })

  test('the note goes at the end of the prompt, after a blank line', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { prompt: 'Find the bug.' })
    expect(w.spawned[0].prompt).toBe(`Find the bug.\n\n${SUFFIX}`)
  })

  test('a resumed agent keeps its prompt', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { prompt: 'Carry on.', resume: 'x' })
    expect(w.spawned[0].prompt).toBe('Carry on.')
  })

  test('an agent of a workflow keeps its prompt', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { prompt: 'Step three.', workflow: { id: 'w' } })
    expect(w.spawned[0].prompt).toBe('Step three.')
  })

  test('a record seen first by its calls is completed by the spawn', async ($, on) => {
    const w = world(on, { agents: [listed('a1', 'running')] })
    await start($)
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await spawn($, w, 'a1', { description: 'Real job', type: 'code-reviewer' })
    expect(agent(w, 'a1')).toMatchObject({ description: 'Real job', type: 'code-reviewer', count: 1 })
    expect(ids(w)).toEqual(['a1'])
  })

  test('a call of an unknown agent adopts it from the list', async ($, on) => {
    const w = world(on, { agents: [listed('a1', 'running', 'From the list')] })
    await start($)
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    expect(agent(w, 'a1')).toMatchObject({ description: 'From the list', type: 'general-purpose', phase: 'working', count: 1 })
  })

  test('so does a step of the model', async ($, on) => {
    const w = world(on, { agents: [listed('a1', 'running', 'By its steps')] })
    const spend = steps(on)
    await start($)
    await spend($, usage(10), 'a1')
    expect(agent(w, 'a1')).toMatchObject({ description: 'By its steps', liveTokens: 10 })
  })

  test('an id the list does not name is not adopted, nor looked for again', async ($, on) => {
    const w = world(on)
    await start($)
    await callTool($, 'Read', { file_path: 'a.ts' }, 'ghost')
    const asked = w.agentLists
    await callTool($, 'Read', { file_path: 'b.ts' }, 'ghost')
    expect(ids(w)).toEqual([])
    expect(w.agentLists).toBe(asked)
  })

  test('each agent gets the next outfit, skipping the ones in use', async ($, on) => {
    const w = world(on)
    await start($)
    for (const id of ['a', 'b', 'c']) await spawn($, w, id)
    expect(w.state.agents.map((a: any) => a.hue)).toEqual([1, 2, 3])
    await endTurn($, { agentId: 'b' })
    await spawn($, w, 'd')
    expect(agent(w, 'd').hue).toBe(4)
  })

  test('when all five are worn, simply the next', async ($, on) => {
    const w = world(on)
    await start($)
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) await spawn($, w, id)
    expect(w.state.agents.map((a: any) => a.hue)).toEqual([1, 2, 3, 4, 5, 1, 2, 3])
  })

  test('the first agent opens the pane, even one the person closed', async ($, on) => {
    const w = world(on)
    await start($, 'terminal')
    expect(w.opened).toEqual([])
    await spawn($, w, 'a1')
    expect(w.opened).toHaveLength(1)
    await spawn($, w, 'a2')
    expect(w.opened).toHaveLength(1)
    await endTurn($, { agentId: 'a1' })
    await endTurn($, { agentId: 'a2' })
    await spawn($, w, 'a3')
    expect(w.opened).toHaveLength(2)
  })

  test('the mod writes no status line', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await endTurn($, { agentId: 'a1' })
    expect(w.statuses.filter(text => text !== undefined)).toEqual([])
  })

  test('each change is published as a copy', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const before = w.state.agents
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    expect(before[0].count).toBe(0)
    expect(w.state.agents[0].count).toBe(1)
  })
})

describe('an agent at work', () => {
  test('each call counts, and keeps the 200 latest actions', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    for (let i = 0; i < 205; i += 1) await callTool($, 'Read', { file_path: `f${i}.ts` }, 'a1')
    const a = agent(w, 'a1')
    expect(a.count).toBe(205)
    expect(a.steps).toHaveLength(200)
    expect(a.steps[0].live).toBe('Lecture de f5.ts')
    expect(a.steps[199].live).toBe('Lecture de f204.ts')
  })

  test('a finished agent that calls again is back at work', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1', reason: 'error' })
    expect(agent(w, 'a1')).toMatchObject({ phase: 'failed', errored: true })
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    expect(agent(w, 'a1')).toMatchObject({ phase: 'working', endedAt: 0 })
    expect(agent(w, 'a1').errored).toBeUndefined()
  })

  test('the list is read every 2 s while someone works, and not after', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const before = w.agentLists
    await w.clock.advance(6000)
    expect(w.agentLists).toBe(before + 3)
    await endTurn($, { agentId: 'a1' })
    const after = w.agentLists
    await w.clock.advance(6000)
    expect(w.agentLists).toBe(after)
  })

  for (const [status, phase] of [['completed', 'done'], ['idle', 'done'], ['failed', 'failed']] as const) {
    test(`${status} in the list means ${phase}`, async ($, on) => {
      const w = world(on)
      await start($)
      await spawn($, w, 'a1')
      w.agents = [listed('a1', status)]
      await w.clock.advance(2000)
      expect(agent(w, 'a1').phase).toBe(phase)
      expect(agent(w, 'a1').endedAt).toBe(w.clock.now())
      expect(agent(w, 'a1').errored).toBe(phase === 'failed' ? true : undefined)
    })
  }

  test('killed in the list means gone', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    w.agents = [listed('a1', 'killed')]
    await w.clock.advance(2000)
    expect(ids(w)).toEqual([])
  })

  test('only an agent at work can change', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await spawn($, w, 'a2')
    await endTurn($, { agentId: 'a1' })
    const endedAt = agent(w, 'a1').endedAt
    w.agents = [listed('a1', 'failed'), listed('a2', 'running')]
    await w.clock.advance(2000)
    expect(agent(w, 'a1')).toMatchObject({ phase: 'done', endedAt })
  })

  test('an empty description is completed from the list', async ($, on) => {
    const kept = { id: 'a1', description: '', type: 't', phase: 'working', startedAt: 1, endedAt: 0, count: 0, steps: [], tokens: 0, liveTokens: 0, seat: 0, hue: 0 }
    const w = world(on, { held: { agents: [kept] }, agents: [listed('a1', 'running', 'Found in the list')] })
    await start($)
    await w.clock.advance(2000)
    expect(agent(w, 'a1').description).toBe('Found in the list')
  })
})

describe('an agent ends', () => {
  test('a plain end is done', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await w.clock.advance(1000)
    await endTurn($, { agentId: 'a1' })
    expect(agent(w, 'a1')).toMatchObject({ phase: 'done', endedAt: w.clock.now() })
  })

  test('an unknown agent is ignored', async ($, on) => {
    const w = world(on)
    await start($)
    await endTurn($, { agentId: 'ghost' })
    expect(ids(w)).toEqual([])
  })

  for (const reason of ['error', 'refusal']) {
    test(`a ${reason} keeps the desk, stopped`, async ($, on) => {
      const w = world(on)
      await start($)
      await spawn($, w, 'a1')
      await endTurn($, { agentId: 'a1', reason })
      expect(agent(w, 'a1')).toMatchObject({ phase: 'failed', errored: true })
      const ui = await mountPane($)
      expect(await hasKey(ui, 'desk-a1')).toBe(true)
    })
  }

  test('an aborted turn leaves the room, even with an error', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'error' })
    expect(ids(w)).toEqual([])
  })

  test('leaving clears the state, the desk, the count and the file, not the tokens', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spawn($, w, 'a1')
    await spawn($, w, 'a2')
    await spend($, usage(100), 'a1')
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'aborted' })
    await w.clock.advance(5000)
    const ui = await mountPane($)
    expect(await hasKey(ui, 'desk-a1')).toBe(false)
    expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Pièce avec 1 agent. 1 au travail. Manager au repos.')
    const file = w.json(DESK_FILE)
    expect(file.desks).toHaveLength(1)
    expect(file.tokens).toBe(100)
  })

  test('a call in flight does not bring it back; a new spawn does', async ($, on) => {
    const w = world(on, { agents: [listed('a1', 'running')] })
    await start($)
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'aborted' })
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    expect(ids(w)).toEqual([])
    await spawn($, w, 'a1', { description: 'Again' })
    expect(agent(w, 'a1')).toMatchObject({ phase: 'working', description: 'Again' })
  })

  test('the sum of the turn replaces what the steps counted', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spawn($, w, 'a1')
    await spend($, usage(10), 'a1')
    await spend($, usage(10), 'a1')
    await endTurn($, { agentId: 'a1', usage: usage(15) })
    expect(agent(w, 'a1')).toMatchObject({ tokens: 15, liveTokens: 0 })
  })

  test('with no sum the steps become the turn', async ($, on) => {
    const w = world(on)
    const spend = steps(on)
    await start($)
    await spawn($, w, 'a1')
    await spend($, usage(10, 5), 'a1')
    await endTurn($, { agentId: 'a1' })
    expect(agent(w, 'a1')).toMatchObject({ tokens: 15, liveTokens: 0 })
  })

  test('past 16 the finished desks leave, with no line for it', async ($, on) => {
    const w = world(on)
    await start($)
    for (let i = 0; i < 17; i += 1) await spawn($, w, `a${i}`)
    for (let i = 0; i < 3; i += 1) await endTurn($, { agentId: `a${i}` })
    await w.clock.advance(5000)
    expect(w.json(DESK_FILE).desks).toHaveLength(14)
    const ui = await mountPane($)
    for (let i = 0; i < 3; i += 1) expect(await hasKey(ui, `desk-a${i}`)).toBe(false)
    expect(await hasKey(ui, 'desk-a16')).toBe(true)
    expect(await everyText(ui)).not.toMatch(/\+\d+/)
  })

  test('sixteen desks all stay, finished ones too', async ($, on) => {
    const w = world(on)
    await start($)
    for (let i = 0; i < 16; i += 1) await spawn($, w, `a${i}`)
    await endTurn($, { agentId: 'a0' })
    const ui = await mountPane($)
    expect(await hasKey(ui, 'desk-a0')).toBe(true)
  })
})

describe('plain summaries', () => {
  test('an agent gets a sentence while the pane is open, in the state', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await w.clock.settle()
    expect(w.summaries).toHaveLength(1)
    expect(w.summaries[0].prompt).toContain('Mission : Write the tests')
    expect(w.summaries[0].prompt).toContain('- Lecture de a.ts')
    expect(w.state.summaries).toEqual({ a1: 'A plain sentence.' })
  })

  test('a closed pane asks the model for nothing', async ($, on) => {
    const w = world(on)
    await start($, 'terminal')
    await spawn($, w, 'a1')
    w.panes.clear()
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await w.clock.settle()
    expect(w.summaries).toEqual([])
  })

  test('a failure to tell counts as closed', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    w.refuse.add('ui.panes')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await w.clock.settle()
    expect(w.summaries).toEqual([])
  })

  test('the mark goes on first: two quick actions make one summary', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await callTool($, 'Read', { file_path: 'b.ts' }, 'a1')
    await w.clock.settle()
    expect(w.summaries).toHaveLength(1)
    await w.clock.advance(45_000)
    await callTool($, 'Read', { file_path: 'c.ts' }, 'a1')
    await w.clock.settle()
    expect(w.summaries).toHaveLength(2)
  })

  test('the mark goes with the agent', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await w.clock.settle()
    await endTurn($, { agentId: 'a1', isAborted: true, reason: 'aborted' })
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'b.ts' }, 'a1')
    await w.clock.settle()
    expect(w.summaries).toHaveLength(2)
  })

  test('a failure keeps the sentence of the action, with no message', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    w.refuse.add('model.complete')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await w.clock.settle()
    expect(w.state.summaries).toBeUndefined()
    expect(w.toasts).toEqual([])
    const ui = await mountPane($, 'terminal')
    expect((await ui.find({ type: 'Text', text: /Lecture de a\.ts/ }))?.text).toBe('● Write the tests : Lecture de a.ts')
  })
})
