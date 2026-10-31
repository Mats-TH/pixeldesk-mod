import { describe, expect, test } from 'claude-code/testing'

import { ENGLISH, NOON, altOf, callTool, cardIn, command, endTurn, hasKey, kids, mountBand, mountPane, receive, sendPlan, spawn, start, step, submit, textsOf, world } from './test-kit'
import { en, getLanguage, plural, setLanguage, t } from './i18n'
import { AT_REST, formatTokens, roomSvg } from './room'
import { roleOf } from './desks'
import { gauge } from './limits'
import { bandSvg } from './band'
import { OPTION_TEXT } from './card'
import { textWidth, wrap } from './pixel/font'

const TOOL = 'mcp__pixeldesk__plan'

function inEnglish<T>(work: () => T) {
  const before = getLanguage()
  setLanguage('en')
  try {
    return work()
  } finally {
    setLanguage(before)
  }
}

describe('a session in English', () => {
  test('the command', async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($)
    expect((await command($)).text).toBe('PixelDesk is open. Cards appear when Claude starts a subagent.')
    expect((await command($, 'hide')).text).toBe('PixelDesk panel hidden. The bar stays visible and tracking continues. Bring it back with /pixeldesk show.')
    expect((await command($, 'show')).text).toBe('PixelDesk panel is back on screen.')
    expect((await command($, 'nope')).text).toBe('Unknown option. Use /pixeldesk, /pixeldesk hide, /pixeldesk show, /pixeldesk departure, /pixeldesk warm or /pixeldesk refresh.')
    await spawn($, w, 'a1')
    expect((await command($)).text).toBe('PixelDesk is open.')
  })

  test('the tool: its description, schema and answers', async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($)
    const schema = w.tools[0].inputSchema.properties
    expect(schema.title.description).toBe('A short name for this job, just a few words.')
    expect(schema.steps.description).toBe('All the steps, in order.')
    expect(schema.steps.items.required).toEqual(['text', 'status'])
    expect((await sendPlan($, [step('One', 'completed'), step('Two', 'pending')], 'Job')).result).toBe('Plan saved: 1 of 2 steps done.')
    expect((await sendPlan($, 'no')).result).toBe('Plan not saved: steps must be a list of { text, status }.')
    expect((await sendPlan($, [step('', 'pending')])).result).toBe('Plan not saved: every step needs a text.')
    expect((await sendPlan($, [step('Two', 'done')])).result).toBe('Plan not saved: "Two" needs a status: pending, in_progress or completed.')
  })

  test('the default title and the toasts', async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($)
    await sendPlan($, [step('One', 'pending'), step('Two', 'pending')])
    expect(w.state.plan.title).toBe('Plan')
    await sendPlan($, [step('One', 'completed'), step('Two', 'pending')])
    await sendPlan($, [step('One', 'completed'), step('Two', 'completed')])
    expect(w.toasts).toEqual(['Done: One', 'All 2 steps are done.'])
  })

  test('the notes to the model', async ($, on) => {
    world(on, { env: ENGLISH })
    await start($)
    await submit($)
    expect((await callTool($, 'Read', { file_path: 'a.ts' })).context).toEqual([`PixelDesk: this task has no plan yet. Call ${TOOL} now with all its steps in order so the user can follow along.`])
    await sendPlan($, [step('One', 'in_progress')])
    await submit($)
    expect((await callTool($, 'Read', { file_path: 'a.ts' })).context).toEqual([`PixelDesk: the plan has not moved this turn. For a new task, call ${TOOL} with its steps. If you are carrying on the previous one, send the updated list.`])
  })

  test('the note to the agents, the prompt section, the summary', async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($)
    await spawn($, w, 'a1', { description: 'Fix it', prompt: 'Go.' })
    expect(w.spawned[0].prompt).toContain(`Go.\n\nPixelDesk: your desk shows the user how far along you are. Start by listing your steps with ${TOOL}`)
    const { sections } = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] })
    expect(sections[0]!.text).toContain(`Keep your progress in the ${TOOL} tool`)
    await callTool($, 'Read', { file_path: 'a.ts' }, 'a1')
    await w.clock.settle()
    expect(w.summaries[0].system).toContain('in English')
    expect(w.summaries[0].prompt).toContain('Task: Fix it')
    expect(w.summaries[0].prompt).toContain('Latest actions:')
    expect(w.summaries[0].prompt).toContain('- Reading a.ts')
  })

  test('the band on the desktop', async ($, on) => {
    world(on, { env: ENGLISH, limits: [{ kind: 'seven_day', percentUsed: 12, resetsAt: new Date(2026, 9, 30, 9, 30).toISOString() }] })
    await start($)
    await sendPlan($, [step('One', 'completed'), step('Two', 'in_progress')], 'Job')
    const ui = await mountBand($)
    expect(await altOf(ui)).toBe('Job: Tasks 1/2, 50%. Now: Two. 5 H -- --:--, 7 D 12% Fri 9:30am')
  })

  test('the band in the terminal, the weekly gauge under its English key', async ($, on) => {
    world(on, { env: ENGLISH, limits: [{ kind: 'seven_day', percentUsed: 12, resetsAt: new Date(2026, 9, 30, 9, 0).toISOString() }] })
    await start($, 'terminal')
    await sendPlan($, [step('One', 'completed'), step('Two', 'pending')], 'Job')
    const ui = await mountBand($, 'terminal')
    const texts = await textsOf(ui)
    expect(texts).toContain('Tasks 1/2')
    expect(texts).toContain('50%')
    expect(texts).toContain('Next: Two')
    expect(await hasKey(ui, 'gauge-7 D')).toBe(true)
    expect(await hasKey(ui, 'gauge-7 J')).toBe(false)
    expect(texts).toContain('Fri 9am')
  })

  test('rest and all done in the terminal', async ($, on) => {
    world(on, { env: ENGLISH })
    await start($, 'terminal')
    const ui = await mountBand($, 'terminal')
    expect(await textsOf(ui)).toContain('Idle')
    await sendPlan($, [step('One', 'completed')], 'Job')
    expect(await textsOf(ui)).toContain('All steps are done')
  })

  test('the overview', async ($, on) => {
    const kid = JSON.stringify({ sessionId: 'kid', title: '', agents: 1, working: 1, summary: '', updatedAt: NOON, cwd: 'C:/work/app', desks: [], steps: [], tokens: 0 })
    const w = world(on, { env: ENGLISH, files: { '/Users/test/.claude/pixeldesk/state/desk-kid.json': kid } })
    await start($)
    await w.clock.advance(5000)
    await receive($)
    const ui = await mountBand($)
    expect(await altOf(ui)).toContain('Overview: 1 of 1 conversation working, 1 agent. 1 new message.')
  })

  test('the pane on the desktop: the room and a card', async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($)
    await spawn($, w, 'a1', { description: 'Check the pages', type: 'general-purpose' })
    await spawn($, w, 'a2', { description: 'Review it' })
    await endTurn($, { agentId: 'a2' })
    await sendPlan($, [step('Read', 'in_progress'), step('Tell', 'pending')], undefined, 'a1')
    const ui = await mountPane($)
    expect(await altOf(ui)).toBe('Room with 2 agents. 1 working · 1 done. Manager at rest.')
    const card = cardIn(await ui.find({ key: 'desk-a1' })).svg.props.alt
    expect(card).toContain('Tester. Check the pages. Starting.')
    expect(card).toContain('0 of 2 steps')
    expect(card).toContain('Now: Read')
    expect(card).toMatch(/Working$/)
    expect(cardIn(await ui.find({ key: 'desk-a2' })).svg.props.alt).toMatch(/^Reviewer\./)
  })

  test('the pane in words', async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($, 'terminal')
    const ui = await mountPane($, 'terminal')
    expect(await textsOf(ui)).toContain('○ Manager: At rest')
    expect(await textsOf(ui)).toContain('No agents')
    expect(await textsOf(ui)).toContain('Office')
    await spawn($, w, 'a1', { description: 'Work' })
    expect(await textsOf(ui)).toContain('● Work: Starting')
    await callTool($, 'Bash', { description: 'Run it' }, 'a1')
    await w.clock.settle()
    expect(w.state.agents[0].steps[0].live).toBe('Running: Run it')
  })

  test('a bubble of the plan', async ($, on) => {
    world(on, { env: ENGLISH })
    await start($)
    await sendPlan($, [step('One', 'pending', { who: 'Claude' }), step('Two', 'pending')])
    const ui = await mountPane($)
    const alt = async (i: number) => kids(kids(await ui.find({ key: `reveal-${i}` }))[1])[0].props.alt
    expect(await alt(0)).toBe('One. Claude, Main chat')
    expect(await alt(1)).toBe('Two. Not assigned yet')
  })

  test('the floor', async ($, on) => {
    const kid = JSON.stringify({ sessionId: 'kid', title: '', agents: 0, working: 0, summary: '', updatedAt: NOON, cwd: 'C:/work/app', desks: [], steps: [], tokens: 0 })
    const w = world(on, { env: ENGLISH, files: { '/Users/test/.claude/pixeldesk/state/desk-kid.json': kid } })
    await start($)
    await w.clock.advance(5000)
    const ui = await mountPane($)
    expect(await altOf(ui)).toBe('Floor with 2 conversations')
    expect(cardIn(await ui.find({ key: 'room-kid' })).svg.props.alt).toContain('No step in progress')
  })

  test('a post in the desk file', async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($)
    await spawn($, w, 'a1', { description: 'Rework', type: 'general-purpose' })
    await w.clock.advance(5000)
    expect(w.json('/Users/test/.claude/pixeldesk/state/desk-session-1.json').desks[0].title).toBe('Developer')
  })

  test('actions and connectors', async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($)
    await spawn($, w, 'a1')
    await callTool($, 'Grep', { pattern: 'x' }, 'a1')
    await callTool($, 'mcp__a1b2c3d4-0000-1111-2222-333344445555__doSomethingNew', {}, 'a1')
    expect(w.state.agents[0].steps.map((s: any) => s.live)).toEqual(['Searching files for "x"', 'Connector: do something new'])
  })
})

describe('numbers and dates follow the language', () => {
  test('the counter\'s decimal sign', () => {
    expect(formatTokens(12_400)).toBe('12,4k')
    expect(inEnglish(() => formatTokens(12_400))).toBe('12.4k')
  })

  test('the day and hour of the weekly gauge', () => {
    const now = new Date(2026, 9, 27, 12).getTime()
    const at = (hour: number, minute = 0) => [{ kind: 'seven_day', percentUsed: 1, resetsAt: new Date(2026, 9, 30, hour, minute).toISOString() }]
    expect(gauge(at(9), 'seven_day', now).at).toBe('ven 9h')
    expect(gauge(at(9, 30), 'seven_day', now).at).toBe('ven 9h30')
    expect(inEnglish(() => gauge(at(9), 'seven_day', now).at)).toBe('Fri 9am')
    expect(inEnglish(() => gauge(at(9, 30), 'seven_day', now).at)).toBe('Fri 9:30am')
    expect(inEnglish(() => gauge(at(15), 'seven_day', now).at)).toBe('Fri 3pm')
    expect(inEnglish(() => gauge(at(0), 'seven_day', now).at)).toBe('Fri 12am')
  })

  test('the plate of the band: a space in French only', () => {
    const now = new Date(2026, 9, 27, 12).getTime()
    const gauges = () => [gauge([], 'five_hour', now), gauge([], 'seven_day', now)] as [ReturnType<typeof gauge>, ReturnType<typeof gauge>]
    const drawn = () => bandSvg({ title: 'Plate', steps: [{ text: 'One', status: 'completed' }, { text: 'Two', status: 'pending' }], gauges: gauges(), width: 800, night: false })
    expect(t('band.percentPlate', { n: 50 })).toBe('50 %')
    expect(inEnglish(() => t('band.percentPlate', { n: 50 }))).toBe('50%')
    expect(inEnglish(drawn)).not.toBe(drawn())
  })

  test('posts are recognised from English words', () => {
    const CASES: [string, string][] = [
      ['Research the market', 'Researcher'],
      ['Find the bug', 'Researcher'],
      ['Plan the release', 'Analyst'],
      ['Review the code', 'Reviewer'],
      ['Verify the build', 'Tester'],
      ['Check the links', 'Tester'],
      ['Design the page', 'Designer'],
      ['Write the docs', 'Writer'],
      ['Analyze the logs', 'Analyst'],
      ['Audit the bundle', 'Analyst'],
      ['Compare the prices', 'Analyst'],
      ['Fix the crash', 'Developer'],
    ]
    inEnglish(() => {
      for (const [description, role] of CASES) expect(roleOf('general-purpose', description)).toBe(role)
    })
  })

  test('the board of the room speaks the language', () => {
    const input = { sessionId: 's', desks: [], manager: AT_REST, previous: 0, steps: [], tokens: 0, width: 496, height: 462 }
    expect(inEnglish(() => roomSvg(input))).not.toBe(roomSvg(input))
  })

  test('the settings texts fit the pixel font, in both languages', () => {
    const check = () => {
      expect(textWidth(t('settings.title'), 20) <= 222, t('settings.title')).toBe(true)
      expect(textWidth(t('settings.departure'), 16) <= 222, t('settings.departure')).toBe(true)
      for (const name of [t('settings.plan.name'), t('settings.each.name')]) expect(textWidth(name, 18) <= OPTION_TEXT, name).toBe(true)
      for (const line of [t('settings.plan.line'), t('settings.each.line')]) {
        const rows = wrap(line, 16, OPTION_TEXT, 2)
        expect(rows.join(' '), 'two rows of 182 px hold it whole').toBe(line)
        for (const row of rows) expect(textWidth(row, 16) <= OPTION_TEXT, row).toBe(true)
      }
    }
    check()
    inEnglish(check)
  })

  test('plurals on the total in English', () => {
    inEnglish(() => {
      expect(plural('card.steps', 0, { done: 0, total: 0 })).toBe('0 of 0 steps')
      expect(en['card.agentsDone.other']).toBe('{n} of {total} agents done')
    })
  })
})

describe('the home on another system', () => {
  test('English on a Mac, through the whole loop', async ($, on) => {
    const w = world(on, { env: { HOME: '/Users/test', LANG: 'en_GB.UTF-8' } })
    await start($, 'terminal')
    await sendPlan($, [step('One', 'pending')], 'Job')
    expect(w.file('/Users/test/.claude/pixeldesk/state/plan-session-1.json')).toContain('"title": "Job"')
  })
})

describe('the Manager in English', () => {
  test('the list, the alternative and the cards', { timeoutMs: 30000 }, async ($, on) => {
    const w = world(on, { env: ENGLISH })
    await start($, 'terminal')
    const list = await mountPane($, 'terminal')
    expect(await textsOf(list)).toContain('○ Manager: At rest')
    await $.turn.start({ text: '', turnId: 't' })
    expect(await textsOf(list)).toContain('● Manager: Thinking about what comes next')
    await endTurn($)
    await w.clock.advance(12 * 60_000)
    const ui = await mountPane($)
    expect(await altOf(ui)).toBe('Room with 0 agents. No agents. Manager at rest.')
    const rest = cardIn(await ui.find({ key: 'desk-manager' })).svg.props.alt
    for (const part of ['Manager', 'No task in progress', 'Waiting for your next request.', 'Last worked 12 min ago', 'At rest']) expect(rest).toContain(part)
    await $.turn.start({ text: '', turnId: 't2' })
    await ui.redraw()
    const busy = cardIn(await ui.find({ key: 'desk-manager' })).svg.props.alt
    for (const part of ['Manager', 'No plan', 'Thinking about what comes next', '1 min · 0 actions', 'Working']) expect(busy).toContain(part)
    expect(await altOf(ui)).toBe('Room with 0 agents. No agents. Manager working.')
  })
})
