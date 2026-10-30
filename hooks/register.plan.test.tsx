import { describe, expect, test } from 'claude-code/testing'

import { DESK_FILE, LOG_FILE, NOON, PLAN_FILE, callTool, mountBand, mountPane, planTool, sendPlan, spawn, start, step, textsOf, world } from './test-kit'
import type { World } from './test-kit'

const SAVED = (done: number, total: number) => `Plan enregistré : ${done} sur ${total} étapes faites.`
const ERR_LIST = 'Plan non enregistré : envoie steps sous forme de liste de { text, status }.'
const ERR_TEXT = "Plan non enregistré : chaque étape a besoin d'un texte."
const ERR_STATUS = (text: string) => `Plan non enregistré : « ${text} » a besoin d'un statut parmi pending, in_progress ou completed.`
const ISO = new Date(NOON).toISOString()

const answerOf = (ran: any) => ran.result
const statuses = (w: World) => w.json(PLAN_FILE).steps.map((st: any) => st.status)

describe('the plan tool, main conversation', () => {
  test('the schema asks for detail and who, and requires text and status alone', async ($, on) => {
    const w = world(on)
    await start($)
    const schema = w.tools[0].inputSchema
    expect(schema.required).toEqual(['steps'])
    expect(schema.properties.title).toEqual({ type: 'string', description: 'Un nom court pour ce travail, en quelques mots.' })
    expect(schema.properties.steps).toMatchObject({ type: 'array', description: 'Toutes les étapes, dans l\'ordre.' })
    const item = schema.properties.steps.items
    expect(item.required).toEqual(['text', 'status'])
    expect(item.properties.status.enum).toEqual(['pending', 'in_progress', 'completed'])
    expect(item.properties.text.description).toBe("L'étape en quelques mots simples.")
    expect(item.properties.detail.description).toBe("Ce que fait cette étape, en une phrase simple. L'utilisateur la lit au survol. À remplir pour chaque étape.")
    expect(item.properties.who.description).toBe('Qui s\'en charge : "Claude" si tu le fais toi-même, sinon le poste de l\'agent responsable, tel que son bureau l\'affiche (Chercheur, Relecteur, Testeur, Designer, Rédacteur, Analyste, Développeur). À remplir dès que tu le sais.')
  })

  test('replaces the list, writes the file, publishes, and answers alone', async ($, on) => {
    const w = world(on)
    await start($)
    const ran = await sendPlan($, [step('One', 'completed'), step('Two', 'in_progress'), step('Three', 'pending')], 'Job')
    expect(answerOf(ran)).toBe(SAVED(1, 3))
    expect(w.calls).toEqual([])
    expect(w.state.plan).toEqual({ title: 'Job', steps: [{ text: 'One', status: 'completed' }, { text: 'Two', status: 'in_progress' }, { text: 'Three', status: 'pending' }] })
  })

  test('the file: two spaces, a final new line, its fields', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'completed', { detail: 'Why', who: 'Claude' })], 'Job')
    const text = w.file(PLAN_FILE)!
    expect(text.endsWith('}\n')).toBe(true)
    expect(text).toContain('\n  "title": "Job",')
    expect(JSON.parse(text)).toEqual({ title: 'Job', updatedAt: ISO, steps: [{ text: 'One', status: 'completed', doneAt: ISO, detail: 'Why', who: 'Claude' }] })
  })

  test('the statuses stay in the order received', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('C', 'pending'), step('A', 'completed'), step('B', 'in_progress')])
    expect(statuses(w)).toEqual(['pending', 'completed', 'in_progress'])
  })

  test('a done step has its hour, and keeps it', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'completed'), step('Two', 'pending')])
    await w.clock.advance(60_000)
    await sendPlan($, [step('One', 'completed'), step('Two', 'completed')])
    const [one, two] = w.json(PLAN_FILE).steps
    expect(one.doneAt).toBe(ISO)
    expect(two.doneAt).toBe(new Date(NOON + 60_000).toISOString())
  })

  test('the plan is dated', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'pending')])
    await w.clock.advance(1000)
    await sendPlan($, [step('One', 'in_progress')])
    expect(w.json(PLAN_FILE).updatedAt).toBe(new Date(NOON + 1000).toISOString())
  })

  test('the title on one line, with no spaces around', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'pending')], '  Two\n  lines ')
    expect(w.state.plan.title).toBe('Two lines')
  })

  test('a new plan with no title takes the default, one under way keeps its own', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'pending')])
    expect(w.state.plan.title).toBe('Plan')
    await sendPlan($, [step('One', 'in_progress')], 'Named')
    await sendPlan($, [step('One', 'completed'), step('Two', 'pending')])
    expect(w.state.plan.title).toBe('Named')
  })

  test('a text on one line', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('  a\n  b\t c ', 'pending')])
    expect(w.state.plan.steps[0].text).toBe('a b c')
  })

  test('detail and who on one line, cut at 240 with an ellipsis', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'pending', { detail: ` ${'d'.repeat(300)}`, who: 'A\n  B' })])
    const [one] = w.state.plan.steps
    expect(one.detail).toHaveLength(240)
    expect(one.detail.endsWith('…')).toBe(true)
    expect(one.who).toBe('A B')
  })

  for (const value of ['', '   ', 12, null, ['x'], { a: 1 }]) {
    test(`${JSON.stringify(value)} as a note is left out`, async ($, on) => {
      const w = world(on)
      await start($)
      await sendPlan($, [step('One', 'pending', { detail: value, who: value })])
      expect(w.json(PLAN_FILE).steps[0]).toEqual({ text: 'One', status: 'pending' })
    })
  }

  test('a step sent back bare keeps what it was told', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress', { detail: 'Why', who: 'Testeur' }), step('Two', 'pending')])
    await sendPlan($, [step('One', 'completed'), step('Two', 'in_progress')])
    expect(w.state.plan.steps[0]).toEqual({ text: 'One', status: 'completed', detail: 'Why', who: 'Testeur' })
  })

  test('each old step serves once', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('Same', 'pending', { detail: 'First' }), step('Same', 'pending', { detail: 'Second' })])
    await sendPlan($, [step('Same', 'pending'), step('Same', 'pending'), step('Same', 'pending')])
    expect(w.state.plan.steps.map((st: any) => st.detail)).toEqual(['First', 'Second', undefined])
  })

  test('work after a finished plan is a new plan', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'completed', { detail: 'Old' })], 'Old job')
    await sendPlan($, [step('One', 'pending')])
    expect(w.state.plan.title).toBe('Plan')
    expect(w.state.plan.steps[0].detail).toBeUndefined()
  })

  for (const value of [undefined, 'one', 12, { text: 'x' }, null]) {
    test(`steps as ${JSON.stringify(value)}: nothing is saved`, async ($, on) => {
      const w = world(on)
      await start($)
      const ran = await callTool($, planTool, { steps: value })
      expect(answerOf(ran)).toBe(ERR_LIST)
      expect(w.file(PLAN_FILE)).toBeUndefined()
    })
  }

  for (const item of [{ status: 'pending' }, { text: '  \n ', status: 'pending' }, { text: 12, status: 'pending' }, 'One', null]) {
    test(`${JSON.stringify(item)} has no text: nothing is saved`, async ($, on) => {
      const w = world(on)
      await start($)
      await sendPlan($, [step('Kept', 'pending')])
      const ran = await sendPlan($, [step('Good', 'pending'), item])
      expect(answerOf(ran)).toBe(ERR_TEXT)
      expect(w.state.plan.steps[0].text).toBe('Kept')
    })
  }

  test('a bad status: nothing is saved, the text cut at 40', async ($, on) => {
    const w = world(on)
    await start($)
    const long = 'x'.repeat(50)
    expect(answerOf(await sendPlan($, [step('One', 'done')]))).toBe(ERR_STATUS('One'))
    const cut = answerOf(await sendPlan($, [step(long, 'nope')]))
    expect(cut).toBe(ERR_STATUS(`${'x'.repeat(39)}…`))
    expect(w.file(PLAN_FILE)).toBeUndefined()
  })

  test('an inner failure answers and goes to the log', async ($, on) => {
    const w = world(on)
    await start($)
    w.refuseState.add('plan')
    const ran = await sendPlan($, [step('One', 'pending')])
    expect(answerOf(ran)).toBe('Plan non enregistré : une erreur est survenue. Continue sans.')
    expect(w.file(LOG_FILE)).toContain('plan tool')
  })

  test('a file that cannot be written leaves the plan in memory', async ($, on) => {
    const w = world(on)
    await start($)
    w.refuseWrite = /plan-/
    const ran = await sendPlan($, [step('One', 'pending')], 'Kept')
    expect(answerOf(ran)).toBe(SAVED(0, 1))
    expect(w.state.plan.title).toBe('Kept')
    expect(w.file(LOG_FILE)).toContain('plan file')
  })

  test('an empty list is accepted, and the band rests', async ($, on) => {
    world(on)
    await start($)
    expect(answerOf(await sendPlan($, []))).toBe(SAVED(0, 0))
    const ui = await mountBand($)
    expect(await ui.find({ key: 'idle-band' })).toBeDefined()
  })
})

describe('the plan on disk', () => {
  const file = (body: unknown) => ({ [PLAN_FILE]: JSON.stringify(body) })

  test('it is read back at the start, its notes too', async ($, on) => {
    const w = world(on, { files: file({ title: 'Saved', updatedAt: ISO, steps: [{ text: 'One', status: 'in_progress', detail: 'Why', who: 'Claude' }] }) })
    await start($)
    expect(w.state.plan).toEqual({ title: 'Saved', steps: [{ text: 'One', status: 'in_progress', detail: 'Why', who: 'Claude' }] })
  })

  test('steps out of shape are left out', async ($, on) => {
    const w = world(on, { files: file({ title: 'Saved', steps: [{ text: 'Good', status: 'pending' }, { text: '', status: 'pending' }, { text: 'Bad', status: 'nope' }, { status: 'pending' }, 'x', null] }) })
    await start($)
    expect(w.state.plan.steps).toEqual([{ text: 'Good', status: 'pending' }])
  })

  test('notes of another type are left out', async ($, on) => {
    const w = world(on, { files: file({ title: 'Saved', steps: [{ text: 'One', status: 'pending', detail: 3, who: {} }] }) })
    await start($)
    expect(w.state.plan.steps).toEqual([{ text: 'One', status: 'pending' }])
  })

  test('a file with no title takes the default, an old one loads with no notes', async ($, on) => {
    const w = world(on, { files: file({ steps: [{ text: 'One', status: 'pending' }] }) })
    await start($)
    expect(w.state.plan.title).toBe('Plan')
  })

  test('a broken file goes to the log and the session carries on', async ($, on) => {
    const w = world(on, { files: { [PLAN_FILE]: '{nope' } })
    await start($)
    expect(w.state.plan).toBeUndefined()
    expect(w.file(LOG_FILE)).toContain('plan file')
    expect(answerOf(await sendPlan($, [step('One', 'pending')]))).toBe(SAVED(0, 1))
  })

  test('a plan read back all done counts as finished', async ($, on) => {
    const w = world(on, { files: file({ title: 'Old', steps: [{ text: 'One', status: 'completed' }] }) })
    await start($)
    await sendPlan($, [step('Two', 'pending')])
    expect(w.state.plan.title).toBe('Plan')
    expect(w.toasts).toEqual([])
  })

  test('the file carries no id of a mirrored step', async ($, on) => {
    const w = world(on)
    w.answers.TaskCreate = () => ({ result: { task: { id: 't1' } } })
    await start($)
    await callTool($, 'TaskCreate', { subject: 'One' })
    expect(w.json(PLAN_FILE).steps).toEqual([{ text: 'One', status: 'pending' }])
  })
})

describe('toasts', () => {
  test('the done steps of a brand new plan say nothing', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'completed'), step('Two', 'pending')])
    expect(w.toasts).toEqual([])
  })

  test('a step just done says so, several joined by a comma', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'pending'), step('Two', 'pending'), step('Three', 'pending'), step('Four', 'pending')])
    await sendPlan($, [step('One', 'completed'), step('Two', 'pending'), step('Three', 'pending'), step('Four', 'pending')])
    await sendPlan($, [step('One', 'completed'), step('Two', 'completed'), step('Three', 'completed'), step('Four', 'pending')])
    expect(w.toasts).toEqual(['Fait : One', 'Fait : Two, Three'])
  })

  test('the last one speaks for all', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress'), step('Two', 'pending')])
    await sendPlan($, [step('One', 'completed'), step('Two', 'completed')])
    expect(w.toasts).toEqual(['Les 2 étapes sont faites.'])
  })

  test('and in the singular', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'in_progress')])
    await sendPlan($, [step('One', 'completed')])
    expect(w.toasts).toEqual(['L’étape est faite.'])
  })

  test('cut at 140, and a failure bothers no one', async ($, on) => {
    const w = world(on)
    await start($)
    const long = 'y'.repeat(200)
    await sendPlan($, [step(long, 'pending'), step('Two', 'pending')])
    await sendPlan($, [step(long, 'completed'), step('Two', 'pending')])
    expect(w.toasts[0]).toHaveLength(140)
    expect(w.toasts[0]!.endsWith('…')).toBe(true)
    w.refuseToast = true
    const ran = await sendPlan($, [step(long, 'completed'), step('Two', 'completed')])
    expect(answerOf(ran)).toBe(SAVED(2, 2))
  })

  test('a finished plan stays at 100 % until the next', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'completed')], 'Done job')
    await w.clock.advance(60 * 60_000)
    const ui = await mountBand($)
    expect((await ui.find({ key: 'plan-band' }))).toBeDefined()
    expect((await ui.find({ type: 'Svg' }))?.props.alt).toContain('Done job : Tâches 1/1, 100%.')
  })
})

describe('the plan tool, an agent', () => {
  test('stays on its desk: no file, no toast, no band, the same answer', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    const ran = await sendPlan($, [step('Own', 'completed'), step('Next', 'pending')], 'Theirs', 'a1')
    expect(answerOf(ran)).toBe(SAVED(1, 2))
    expect(w.file(PLAN_FILE)).toBeUndefined()
    expect(w.state.plan).toBeUndefined()
    expect(w.toasts).toEqual([])
    expect(w.state.agents[0].plan).toHaveLength(2)
    await sendPlan($, [step('Own', 'completed'), step('Next', 'completed')], undefined, 'a1')
    expect(w.toasts).toEqual([])
  })

  test('its card has its post, its count and its step; its rail goes to the file', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { description: 'Vérifier les pages' })
    await sendPlan($, [step('Lire', 'completed'), step('Comparer', 'in_progress'), step('Conclure', 'pending')], undefined, 'a1')
    const ui = await mountPane($)
    const zone = await ui.find({ key: 'desk-a1' })
    const alt = JSON.stringify(zone)
    expect(alt).toContain('Testeur')
    expect(alt).toContain('1 étape sur 3')
    expect(alt).toContain('En cours : Comparer')
    await w.clock.advance(5000)
    expect(w.json(DESK_FILE).desks[0]).toMatchObject({ done: 1, total: 3, live: true })
  })

  test('an invalid plan gets the same words', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    expect(answerOf(await sendPlan($, 'nope', undefined, 'a1'))).toBe(ERR_LIST)
    expect(answerOf(await sendPlan($, [step('', 'pending')], undefined, 'a1'))).toBe(ERR_TEXT)
    expect(answerOf(await sendPlan($, [step('One', 'x')], undefined, 'a1'))).toBe(ERR_STATUS('One'))
    expect(w.state.agents[0].plan).toBeUndefined()
  })

  test('a later plan of the main conversation takes nothing from it', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await sendPlan($, [step('Own', 'pending')], undefined, 'a1')
    await sendPlan($, [step('Main', 'pending')])
    expect(w.state.agents[0].plan[0].text).toBe('Own')
  })

  test('it can carry detail and who, kept on its record', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await sendPlan($, [step('Own', 'in_progress', { detail: 'Why', who: 'Testeur' })], undefined, 'a1')
    await sendPlan($, [step('Own', 'completed')], undefined, 'a1')
    expect(w.state.agents[0].plan[0]).toMatchObject({ text: 'Own', status: 'completed', detail: 'Why', who: 'Testeur' })
  })

  test('a plan from an unknown agent adopts it', async ($, on) => {
    const w = world(on, { agents: [{ id: 'a9', description: 'Listed', type: 't', status: 'running' }] })
    await start($)
    await sendPlan($, [step('Own', 'pending')], undefined, 'a9')
    expect(w.state.agents[0]).toMatchObject({ id: 'a9', description: 'Listed' })
    expect(w.state.agents[0].plan).toHaveLength(1)
  })
})

describe('the list tools', () => {
  const todos = (...items: [string, string][]) => ({ todos: items.map(([content, status]) => ({ content, status })) })

  test('TodoWrite feeds the plan of the main conversation', async ($, on) => {
    const w = world(on)
    await start($)
    await callTool($, 'TodoWrite', todos(['One', 'in_progress'], ['', 'pending'], ['  ', 'pending'], ['Two', 'weird']))
    expect(w.state.plan).toEqual({ title: 'Plan', steps: [{ text: 'One', status: 'in_progress' }, { text: 'Two', status: 'pending' }] })
    expect(w.file(PLAN_FILE)).toBeDefined()
  })

  test('it also speaks in toasts', async ($, on) => {
    const w = world(on)
    await start($)
    await callTool($, 'TodoWrite', todos(['One', 'in_progress'], ['Two', 'pending']))
    await callTool($, 'TodoWrite', todos(['One', 'completed'], ['Two', 'in_progress']))
    expect(w.toasts).toEqual(['Fait : One'])
  })

  test('called by an agent it stays on the desk, each its own', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await spawn($, w, 'a2')
    await callTool($, 'TodoWrite', todos(['First', 'pending']), 'a1')
    await callTool($, 'TodoWrite', todos(['Second', 'pending']), 'a2')
    expect(w.state.agents.map((a: any) => a.plan[0].text)).toEqual(['First', 'Second'])
    expect(w.state.plan).toBeUndefined()
    expect(w.file(PLAN_FILE)).toBeUndefined()
    expect(w.toasts).toEqual([])
  })

  test('TaskCreate adds a pending step, known by the id of the result', async ($, on) => {
    const w = world(on)
    w.answers.TaskCreate = () => ({ result: { task: { id: 't1' } } })
    await start($)
    await callTool($, 'TaskCreate', { subject: 'Build' })
    await callTool($, 'TaskUpdate', { taskId: 't1', status: 'in_progress' })
    expect(w.state.plan.steps).toEqual([{ text: 'Build', status: 'in_progress' }])
  })

  test('with no subject nothing changes', async ($, on) => {
    const w = world(on)
    await start($)
    await callTool($, 'TaskCreate', {})
    expect(w.state.plan).toBeUndefined()
  })

  test('TaskUpdate changes the text, and deleted takes the step out', async ($, on) => {
    const w = world(on)
    let id = 0
    w.answers.TaskCreate = () => ({ result: { task: { id: `t${(id += 1)}` } } })
    await start($)
    await callTool($, 'TaskCreate', { subject: 'One' })
    await callTool($, 'TaskCreate', { subject: 'Two' })
    await callTool($, 'TaskUpdate', { taskId: 't1', subject: 'First' })
    await callTool($, 'TaskUpdate', { taskId: 't2', status: 'deleted' })
    expect(w.state.plan.steps).toEqual([{ text: 'First', status: 'pending' }])
  })

  test('an unknown id with a subject adds the step, with no subject nothing changes', async ($, on) => {
    const w = world(on)
    await start($)
    await callTool($, 'TaskUpdate', { taskId: 'x' })
    expect(w.state.plan).toBeUndefined()
    await callTool($, 'TaskUpdate', { taskId: 'x', subject: 'Late', status: 'in_progress' })
    expect(w.state.plan.steps).toEqual([{ text: 'Late', status: 'in_progress' }])
  })

  test('what comes after a finished list starts a new one', async ($, on) => {
    const w = world(on)
    w.answers.TaskCreate = () => ({ result: { task: { id: 't1' } } })
    await start($)
    await callTool($, 'TaskCreate', { subject: 'One' })
    await callTool($, 'TaskUpdate', { taskId: 't1', status: 'completed' })
    w.answers.TaskCreate = () => ({ result: { task: { id: 't2' } } })
    await callTool($, 'TaskCreate', { subject: 'Two' })
    expect(w.state.plan.steps).toEqual([{ text: 'Two', status: 'pending' }])
  })

  test('a refused call or an error changes nothing', async ($, on) => {
    const w = world(on)
    await start($)
    w.answers.TodoWrite = () => ({ result: {}, isError: true })
    await callTool($, 'TodoWrite', todos(['One', 'pending']))
    w.answers.TodoWrite = () => ({ deny: 'no' })
    await callTool($, 'TodoWrite', todos(['Two', 'pending']))
    expect(w.state.plan).toBeUndefined()
  })

  test('they run as usual: the result comes back untouched', async ($, on) => {
    const w = world(on)
    w.answers.TodoWrite = () => ({ result: { ok: true } })
    await start($)
    const ran = await callTool($, 'TodoWrite', todos(['One', 'pending']))
    expect(w.calls).toHaveLength(1)
    expect(ran.result).toEqual({ ok: true })
    expect(ran.context).toBeUndefined()
  })

  test('TaskCreate and TaskUpdate of an agent keep to its desk', async ($, on) => {
    const w = world(on)
    w.answers.TaskCreate = () => ({ result: { task: { id: 't1' } } })
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'TaskCreate', { subject: 'Own' }, 'a1')
    await callTool($, 'TaskUpdate', { taskId: 't1', status: 'completed' }, 'a1')
    expect(w.state.agents[0].plan[0]).toMatchObject({ text: 'Own', status: 'completed' })
    expect(w.state.plan).toBeUndefined()
    expect(w.toasts).toEqual([])
    const ui = await mountBand($, 'terminal')
    expect(await textsOf(ui)).not.toContain('Own')
  })
})
