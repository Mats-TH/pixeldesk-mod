import { describe, expect, test } from 'claude-code/testing'

import { DESK_FILE, ENGLISH, FRENCH, HOME, NOON, altOf, callTool, cardIn, endTurn, hasKey, kids, mountPane, sendPlan, sourceOf, spawn, start, startTurn, step, submit, textsOf, world } from './test-kit'
import { managerBox, viewOf } from './room'

const CELL_H = 21
const ZOOM = 'attributeName="viewBox"'
const managerAlt = async (ui: any) => cardIn(await ui.find({ key: 'desk-manager' })).svg.props.alt as string
const beat = (w: any) => w.clock.advance(5000)

describe('the turn of the conversation', () => {
  test('a turn puts the Manager to work, its end rests him, open plan included', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    await sendPlan($, [step('One', 'in_progress'), step('Two', 'pending')], 'Job')
    expect(await sourceOf(ui, 'live-manager'), 'before his first turn').toContain('href="#desk-rest"')
    await w.clock.advance(1000)
    await startTurn($)
    expect(w.state.chat).toEqual({ working: true, since: NOON + 1000, ended: 0, count: 0, now: '' })
    expect(await sourceOf(ui, 'live-manager')).toContain('href="#desk-working"')
    expect(await sourceOf(ui, 'room-labels'), 'his rail: one box per step').toContain('href="#rw0-2l"')
    await w.clock.advance(1000)
    await endTurn($)
    expect(w.state.chat).toMatchObject({ working: false, ended: NOON + 2000, now: '' })
    expect(await sourceOf(ui, 'live-manager')).toContain('href="#desk-rest"')
    expect(w.state.plan.steps, 'the plan stays on the board').toHaveLength(2)
  })

  for (const end of [{ isAborted: true, reason: 'aborted' }, { reason: 'error' }, { reason: 'refusal' }]) {
    test(`${JSON.stringify(end)} rests him too`, async ($, on) => {
      const w = world(on)
      await start($)
      const ui = await mountPane($)
      await startTurn($)
      await endTurn($, end)
      expect(w.state.chat.working).toBe(false)
      expect(await sourceOf(ui, 'live-manager')).toContain('href="#desk-rest"')
      await beat(w)
      expect(w.json(DESK_FILE).chat).toBe('failed')
    })
  }

  test('a prompt with no turn leaves him at rest and the file with no chat', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    await submit($)
    expect(await sourceOf(ui, 'live-manager')).toContain('href="#desk-rest"')
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBeUndefined()
  })

  test('a prompt typed during a turn changes nothing', async ($, on) => {
    const w = world(on)
    await start($)
    await startTurn($)
    const before = w.state.chat
    await w.clock.advance(1000)
    await submit($)
    expect(w.state.chat).toEqual(before)
  })

  test('an agent never changes the Manager', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    await spawn($, w, 'a1')
    await startTurn($, 'a1')
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    expect(await sourceOf(ui, 'live-manager'), 'an agent at work').toContain('href="#desk-rest"')
    await endTurn($, { agentId: 'a1' })
    expect(w.state.chat).toBeUndefined()
    await startTurn($)
    await spawn($, w, 'a2')
    await endTurn($, { agentId: 'a2' })
    expect(w.state.chat.working, 'the end of an agent').toBe(true)
    expect(w.state.agents.map((a: any) => a.id), 'he is not one of them').toEqual(['a1', 'a2'])
    expect(w.state.seen.shown).toBe(2)
  })

  test('the calls of a turn count, the mirrors too, the plan tool not; out of a turn nothing moves', async ($, on) => {
    const w = world(on)
    await start($)
    await callTool($, 'Read', { file_path: 'before.ts' })
    expect(w.state.chat).toBeUndefined()
    await startTurn($)
    await callTool($, 'Read', { file_path: 'src/a.ts' })
    expect(w.state.chat).toMatchObject({ count: 1, now: 'Lecture de a.ts' })
    await callTool($, 'TodoWrite', { todos: [] })
    expect(w.state.chat).toMatchObject({ count: 2, now: 'Mise à jour de sa liste de tâches' })
    await sendPlan($, [step('One', 'in_progress')])
    expect(w.state.chat.count).toBe(2)
    await endTurn($)
    await callTool($, 'Read', { file_path: 'after.ts' })
    expect(w.state.chat).toMatchObject({ count: 2, now: '' })
  })

  test('a failure of the count goes to the log, and the tool answers all the same', async ($, on) => {
    const w = world(on)
    await start($)
    await startTurn($)
    w.refuseState.add('chat')
    w.answers.Read = () => ({ result: 'the file' })
    expect((await callTool($, 'Read', { file_path: 'a.ts' })).result).toBe('the file')
    expect(w.log()).toContain('turn call')
  })

  test('a turn survives a reload: the file goes back to working, and the turn ends as usual', async ($, on) => {
    const w = world(on, { held: { chat: { working: true, since: NOON - 60_000, ended: 0, count: 3, now: 'x' } } })
    await start($)
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBe('working')
    await endTurn($)
    await beat(w)
    expect(w.json(DESK_FILE).chat).toBe('done')
    expect(w.state.chat.working).toBe(false)
  })
})

describe('the Manager in the room', () => {
  test('rest and work never replay the zoom: two sources, the count intact, a real arrival zooms', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    const count = await sourceOf(ui, 'room-count')
    const seen = w.state.seen
    const sources = new Set<string>()
    const back = await sourceOf(ui)
    for (let i = 0; i < 4; i += 1) {
      await startTurn($)
      sources.add(await sourceOf(ui, 'live-manager'))
      expect(await sourceOf(ui), 'the room under him').toBe(back)
      await endTurn($)
      sources.add(await sourceOf(ui, 'live-manager'))
      expect(await sourceOf(ui)).toBe(back)
    }
    expect(sources.size).toBe(2)
    expect(back.includes(ZOOM)).toBe(false)
    expect(await sourceOf(ui, 'room-count')).toBe(count)
    expect(w.state.seen).toEqual(seen)
    await spawn($, w, 'a1')
    expect(await sourceOf(ui)).toContain(ZOOM)
  })

  test('time and tools leave the room as it is during a turn', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountPane($)
    await startTurn($)
    const source = await sourceOf(ui)
    await callTool($, 'Read', { file_path: 'a.ts' })
    await w.clock.advance(180_000)
    await ui.redraw()
    expect(await sourceOf(ui)).toBe(source)
  })

  test('his card says what the conversation does, in a zone of his own', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'completed'), step('Two', 'in_progress', { detail: 'Writes the second part.' })], 'The job')
    await startTurn($)
    await callTool($, 'Read', { file_path: 'a.ts' })
    await w.clock.advance(4 * 60_000)
    const ui = await mountPane($)
    const zone = await ui.find({ key: 'desk-manager' })
    expect(zone.props.position).toBe('absolute')
    expect(cardIn(zone).box).toMatchObject({ props: { display: 'none' }, hover: { display: 'flex' } })
    const alt = await managerAlt(ui)
    for (const part of ['Manager', 'The job', 'Writes the second part.', '1 étape sur 2', 'En cours : Two', '4 min · 1 action', 'Au travail']) expect(alt).toContain(part)
  })

  test('with no detail the card takes the tool, else the plain word', async ($, on) => {
    world(on)
    await start($)
    await startTurn($)
    const ui = await mountPane($)
    expect(await managerAlt(ui)).toContain('Réfléchit à la suite')
    expect(await managerAlt(ui)).toContain('Sans plan')
    await callTool($, 'Read', { file_path: 'a.ts' })
    expect(await managerAlt(ui)).toContain('Lecture de a.ts')
  })

  test('at rest the card says so, with no progress, then with the last work', { timeoutMs: 30000 }, async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress')], 'The job')
    const ui = await mountPane($)
    expect(await managerAlt(ui)).toBe('Manager. Aucune tâche en cours. Attend ta prochaine demande.. Au repos')
    await startTurn($)
    await endTurn($)
    await w.clock.advance(12 * 60_000)
    await ui.redraw()
    expect(await managerAlt(ui)).toContain('Dernier travail il y a 12 min')
  })

  test('his zone follows the crop of a short pane', async ($, on) => {
    world(on)
    await start($)
    const ui = await mountPane($, 'desktop', { bodyColumns: 90, scroll: { offset: 0, bodyRows: 12 } })
    const [width, height] = [92 * 8, 12 * CELL_H]
    const room = viewOf(0)
    const crop = Math.max(0, (room.h * width) / room.w - height) / 2
    expect(crop > 0, 'the pane is short').toBe(true)
    expect((await ui.find({ key: 'desk-manager' })).props.top).toBe(Math.round((managerBox(0, width, height).y - crop) / CELL_H))
    expect((await ui.drawn()).props.height).toBe(12)
  })

  test('the alternative of the room ends on the Manager', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await spawn($, w, 'a2')
    await endTurn($, { agentId: 'a2' })
    const ui = await mountPane($)
    expect(await altOf(ui)).toBe('Pièce avec 2 agents. 1 au travail · 1 fini. Manager au repos.')
    await startTurn($)
    expect(await altOf(ui)).toBe('Pièce avec 2 agents. 1 au travail · 1 fini. Manager au travail.')
  })

  test('the list of the terminal names him, right after the header', async ($, on) => {
    world(on)
    await start($, 'terminal')
    const ui = await mountPane($, 'terminal')
    expect((await textsOf(ui))[2]).toBe('○ Manager : Au repos')
    await startTurn($)
    expect((await textsOf(ui))[2]).toBe('● Manager : Réfléchit à la suite')
    await callTool($, 'Read', { file_path: 'a.ts' })
    expect((await textsOf(ui))[2]).toBe('● Manager : Lecture de a.ts')
    expect(kids(await ui.find({ key: 'row-manager' }))[0].props.wrap).toBe('truncate-end')
  })

  test('on a phone his line opens the list, and his zone holds no card', async ($, on) => {
    const w = world(on)
    await start($, 'mobile')
    await spawn($, w, 'a1', { description: 'First' })
    const ui = await mountPane($, 'mobile')
    expect((await textsOf(ui)).slice(0, 2)).toEqual(['○ Manager : Au repos', '● First : Démarrage'])
    expect(kids(await ui.find({ key: 'desk-manager' }))).toEqual([])
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
  })

  test('no room holds a sentence, and the plate says Manager in both languages', async ($, on) => {
    world(on, { env: ENGLISH })
    await start($)
    const ui = await mountPane($)
    expect(await sourceOf(ui, 'room-labels')).toContain('href="#M"')
    expect(await sourceOf(ui)).not.toContain('waiting')
    expect(await sourceOf(ui, 'room-labels')).not.toContain('waiting')
  })
})

describe('outfits', () => {
  test('no agent wears Corail, and sharing starts at the sixth', async ($, on) => {
    const w = world(on)
    await start($)
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) await spawn($, w, id)
    expect(w.state.agents.map((a: any) => a.hue)).toEqual([1, 2, 3, 4, 5, 1, 2])
  })

  test('a free outfit comes before a worn one', async ($, on) => {
    const w = world(on)
    await start($)
    for (const id of ['a', 'b', 'c', 'd', 'e']) await spawn($, w, id)
    await endTurn($, { agentId: 'a' })
    await spawn($, w, 'f')
    expect(w.state.agents.find((a: any) => a.id === 'f').hue).toBe(1)
  })

  test('an agent saved in Corail changes colour, and the counter follows the highest', async ($, on) => {
    const saved = { id: 'old', description: 'x', type: 't', phase: 'working', startedAt: 1, endedAt: 0, count: 0, steps: [], tokens: 0, liveTokens: 0, seat: 0, hue: 0 }
    const w = world(on, { held: { agents: [saved, { ...saved, id: 'older', seat: 1, hue: 3 }] } })
    await start($)
    expect(w.state.agents.map((a: any) => a.hue)).toEqual([1, 3])
    await spawn($, w, 'next')
    expect(w.state.agents[2].hue).toBe(4)
  })
})

describe('the desk file', () => {
  test('it carries the Manager, at work and at rest', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('A', 'completed'), step('B', 'in_progress'), step('C', 'pending'), step('D', 'pending')])
    await startTurn($)
    await beat(w)
    expect(w.json(DESK_FILE).manager).toEqual({ working: true, done: 1, total: 4, live: true })
    await endTurn($)
    await beat(w)
    expect(w.json(DESK_FILE).manager.working).toBe(false)
  })

  test('the summary speaks of the conversation, never of its tools', async ($, on) => {
    const w = world(on)
    await start($)
    await beat(w)
    expect(w.json(DESK_FILE).summary, 'at rest').toBe('')
    await startTurn($)
    await callTool($, 'Read', { file_path: 'a.ts' })
    await beat(w)
    expect(w.json(DESK_FILE).summary, 'a word of its own').toBe('Travaille')
    await sendPlan($, [step('The step', 'in_progress')])
    await beat(w)
    expect(w.json(DESK_FILE).summary, 'the step in progress').toBe('The step')
    await spawn($, w, 'a1')
    await callTool($, 'Read', { file_path: 'b.ts' }, 'a1')
    await beat(w)
    expect(w.json(DESK_FILE).summary, 'an agent at work comes first').toBe('A plain sentence.')
    await endTurn($, { agentId: 'a1' })
    await endTurn($)
    await beat(w)
    expect(w.json(DESK_FILE).summary, 'at rest again').toBe('')
  })

  test('the word of the summary follows the language of the conversation', async ($, on) => {
    const w = world(on, { env: { USERPROFILE: HOME, LANG: 'en_US.UTF-8' } })
    await start($)
    await startTurn($)
    await beat(w)
    expect(w.json(DESK_FILE).summary).toBe('Working')
  })

  test('a French session keeps its own word', async ($, on) => {
    const w = world(on, { env: FRENCH })
    await start($)
    expect(await hasKey(await mountPane($), 'desk-manager')).toBe(true)
    expect(w.state.settings).toEqual({ open: false, departure: 'plan', fire: true, briefingMode: 'auto', compactBefore: 2 })
  })
})
