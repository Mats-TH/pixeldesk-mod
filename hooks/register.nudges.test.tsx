import { describe, expect, test } from 'claude-code/testing'

import { callTool, sendPlan, spawn, start, step, submit, world } from './test-kit'

const TOOL = 'mcp__pixeldesk__plan'
const NEW = `PixelDesk : cette tâche n'a pas encore de plan. Appelle ${TOOL} maintenant avec toutes ses étapes dans l'ordre, pour que l'utilisateur suive l'avancement.`
const CONTINUE = `PixelDesk : le plan n'a pas bougé pendant ce tour. Pour une nouvelle tâche, appelle ${TOOL} avec ses étapes. Si tu poursuis la précédente, envoie la liste à jour.`
const STALE = `PixelDesk : le plan n'a pas bougé depuis un moment. Si une étape est finie, envoie la liste complète à ${TOOL} maintenant.`

const read = ($: any, agentId?: string) => callTool($, 'Read', { file_path: 'a.ts' }, agentId)

describe('notes to the model', () => {
  test('the first call of a turn with no plan gets the note, by the tool\'s full name', async ($, on) => {
    world(on)
    await start($)
    await submit($)
    expect((await read($)).context).toEqual([NEW])
  })

  test('once a turn', async ($, on) => {
    world(on)
    await start($)
    await submit($)
    await read($)
    expect((await read($)).context).toBeUndefined()
  })

  test('with a live plan it asks to carry on', async ($, on) => {
    world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress')])
    await submit($)
    expect((await read($)).context).toEqual([CONTINUE])
  })

  test('a finished plan is not live', async ($, on) => {
    world(on)
    await start($)
    await sendPlan($, [step('One', 'completed')])
    await submit($)
    expect((await read($)).context).toEqual([NEW])
  })

  test('an empty plan is not live', async ($, on) => {
    world(on)
    await start($)
    await sendPlan($, [])
    await submit($)
    expect((await read($)).context).toEqual([NEW])
  })

  test('once a plan came in, no such note', async ($, on) => {
    world(on)
    await start($)
    await submit($)
    await sendPlan($, [step('One', 'in_progress')])
    expect((await read($)).context).toBeUndefined()
  })

  test('a call of a list tool counts as a plan', async ($, on) => {
    world(on)
    await start($)
    await submit($)
    await callTool($, 'TodoWrite', { todos: [{ content: 'One', status: 'pending' }] })
    expect((await read($)).context).toBeUndefined()
  })

  test('so does a plan call that failed', async ($, on) => {
    world(on)
    await start($)
    await submit($)
    await sendPlan($, 'not a list')
    expect((await read($)).context).toBeUndefined()
  })

  test('the list tools themselves get no note', async ($, on) => {
    world(on)
    await start($)
    await submit($)
    const ran = await callTool($, 'TodoWrite', { todos: [] })
    expect(ran.context).toBeUndefined()
  })

  test('eight calls after the last update, one reminder until the next', async ($, on) => {
    world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress')])
    const notes: unknown[][] = []
    for (let i = 0; i < 9; i += 1) notes.push((await read($)).context ?? [])
    expect(notes.slice(0, 7).every(list => list.length === 0)).toBe(true)
    expect(notes[7]).toEqual([STALE])
    expect(notes[8]).toEqual([])
    await sendPlan($, [step('One', 'in_progress'), step('Two', 'pending')])
    const again: unknown[][] = []
    for (let i = 0; i < 8; i += 1) again.push((await read($)).context ?? [])
    expect(again[7]).toEqual([STALE])
  })

  test('a finished plan calls for no reminder', async ($, on) => {
    world(on)
    await start($)
    await sendPlan($, [step('One', 'completed')])
    await submit($)
    await sendPlan($, [step('One', 'completed')])
    for (let i = 0; i < 9; i += 1) expect((await read($)).context).toBeUndefined()
  })

  test('each prompt starts every count over', async ($, on) => {
    world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress')])
    for (let i = 0; i < 7; i += 1) await read($)
    await submit($)
    expect((await read($)).context).toEqual([CONTINUE])
    for (let i = 0; i < 6; i += 1) expect((await read($)).context).toBeUndefined()
    expect((await read($)).context).toEqual([STALE])
  })

  test('a refused result gets no note', async ($, on) => {
    const w = world(on)
    w.answers.Read = () => ({ deny: 'no' })
    await start($)
    await submit($)
    const ran = await read($)
    expect(ran.context).toBeUndefined()
    expect(ran.deny).toBe('no')
  })

  test('a note joins the context, it does not replace it', async ($, on) => {
    const w = world(on)
    w.answers.Read = () => ({ result: {}, context: ['already here'] })
    await start($)
    await submit($)
    expect((await read($)).context).toEqual(['already here', NEW])
  })

  test('no reminder goes to an agent: it has its one note and no more', async ($, on) => {
    const w = world(on)
    await start($)
    await submit($)
    await spawn($, w, 'a1')
    expect((await read($, 'a1')).context).toHaveLength(1)
    expect((await read($, 'a1')).context).toBeUndefined()
    expect((await read($)).context).toEqual([NEW])
  })

  test('the plan of an agent does not calm the main conversation', async ($, on) => {
    const w = world(on)
    await start($)
    await submit($)
    await spawn($, w, 'a1')
    await sendPlan($, [step('Own', 'pending')], undefined, 'a1')
    expect((await read($)).context).toEqual([NEW])
  })

  test('nor does its TodoWrite', async ($, on) => {
    const w = world(on)
    await start($)
    await submit($)
    await spawn($, w, 'a1')
    await callTool($, 'TodoWrite', { todos: [{ content: 'Own', status: 'pending' }] }, 'a1')
    expect((await read($)).context).toEqual([NEW])
  })
})

describe('the system prompt', () => {
  const compose = ($: any, traits: string[] = []) => $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits })

  test('a section of its own, kept for the session', async ($, on) => {
    world(on)
    await start($)
    const { sections } = await compose($)
    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ id: 'pixeldesk:plan', scope: 'session' })
    expect(sections[0].text).toContain(`Suis ton travail avec l'outil ${TOOL}`)
  })

  for (const trait of ['teammate', 'bare']) {
    test(`not for a ${trait} prompt`, async ($, on) => {
      world(on)
      await start($)
      expect((await compose($, [trait])).sections).toEqual([])
    })
  }

  test('the section names no tool but its own', async ($, on) => {
    world(on)
    await start($)
    const { sections } = await compose($)
    expect([...new Set(sections[0].text.match(/mcp__\w+/g))]).toEqual([TOOL])
  })
})
