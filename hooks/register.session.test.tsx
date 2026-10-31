import { describe, expect, test } from 'claude-code/testing'

import { CWD, DESK_FILE, HOME, LOG_FILE, NOON, PLAN_FILE, callTool, endTurn, mountPane, sendPlan, spawn, start, step, world } from './test-kit'

const SURFACES = ['desktop', 'mobile', 'vscode', null] as const

describe('starting a session', () => {
  test('the home comes from USERPROFILE, with forward slashes and no end slash', async ($, on) => {
    const w = world(on, { env: { USERPROFILE: 'C:\\Users\\test\\', HOME: '/ignored', LANG: 'fr_FR' } })
    await start($)
    await sendPlan($, [step('One', 'pending')])
    expect(w.file(PLAN_FILE)).toBeDefined()
  })

  test('then from HOME', async ($, on) => {
    const w = world(on, { env: { HOME: '/Users/test', LANG: 'fr_FR' } })
    await start($)
    await sendPlan($, [step('One', 'pending')])
    expect(w.file(PLAN_FILE)).toBeDefined()
  })

  test('with no home nothing touches the disk, and the plan still draws', async ($, on) => {
    const w = world(on, { env: { LANG: 'fr_FR' } })
    await start($)
    await sendPlan($, [step('One', 'pending')], 'In memory')
    await w.clock.advance(5000)
    expect(w.reads).toEqual([])
    expect(w.writes).toEqual([])
    expect(w.state.plan.title).toBe('In memory')
  })

  test('with no session id neither', async ($, on) => {
    const w = world(on, { session: null })
    await start($)
    await sendPlan($, [step('One', 'pending')])
    await w.clock.advance(5000)
    expect(w.writes).toEqual([])
    expect(w.commands).toHaveLength(1)
  })

  test('the command and the tool are registered, the tool not deferred', async ($, on) => {
    const w = world(on)
    await start($)
    expect(w.commands).toEqual([{ name: 'pixeldesk', description: 'Affiche PixelDesk : la barre de progression des tâches et une carte en direct par sous-agent', argumentHint: '[hide|show|departure plan|each|fire on|off|theme <name>|move|compact]', immediate: true }])
    expect(w.tools[0].name).toBe('plan')
    expect(w.tools[0].isDeferred).toBe(false)
  })

  test('they are registered again at each start', async ($, on) => {
    const w = world(on)
    await start($)
    await start($)
    expect(w.commands).toHaveLength(2)
    expect(w.tools.map((tool: any) => tool.name)).toEqual(['plan', 'move', 'plan', 'move'])
  })

  test('a tool that cannot register goes to the log', async ($, on) => {
    const w = world(on)
    w.refuse.add('tool.register')
    await start($)
    expect(w.log()).toContain('plan tool')
  })

  test('the settings are read before the pane opens: a hidden mod stays closed', async ($, on) => {
    const w = world(on, { files: { '/Users/test/.claude/pixeldesk/settings.json': '{"hidden":true}' } })
    await start($)
    expect(w.opened).toEqual([])
  })

  for (const surface of SURFACES) {
    test(`the pane opens at the start on ${surface}, before any agent`, async ($, on) => {
      const w = world(on)
      await start($, surface)
      expect(w.opened).toEqual([{ id: 'pixeldesk', title: 'PixelDesk' }])
    })
  }

  test('also in a session that is not interactive', async ($, on) => {
    const w = world(on)
    await $.session.start({ cwd: CWD, surface: null, isInteractive: false })
    expect(w.opened).toHaveLength(1)
  })

  test('a pane that cannot open goes to the log', async ($, on) => {
    const w = world(on)
    w.refuseOpen = true
    await start($)
    expect(w.log()).toContain('open pane')
  })

  test('in a terminal the pane stays closed', async ($, on) => {
    const w = world(on)
    await start($, 'terminal')
    expect(w.opened).toEqual([])
  })

  test('the limits are read once at the start', async ($, on) => {
    const windows = [{ kind: 'five_hour', percentUsed: 12, resetsAt: new Date(2026, 9, 27, 14).toISOString() }]
    const w = world(on, { limits: windows })
    await start($)
    expect(w.state.limits).toEqual(windows)
  })

  test('a failed read leaves the gauges empty', async ($, on) => {
    const w = world(on)
    w.refuse.add('session.usage')
    await start($)
    expect(w.state.limits).toBeUndefined()
    expect(w.commands).toHaveLength(1)
  })

  test('the start always goes through, even on broken state files', async ($, on) => {
    const w = world(on, { files: { [PLAN_FILE]: '{oops', [DESK_FILE]: 'nope', '/Users/test/.claude/pixeldesk/settings.json': '[1' } })
    const answer = await start($)
    expect(answer).toEqual({ cwd: CWD })
    expect(w.commands).toHaveLength(1)
  })

  test('even if everything under it fails', async ($, on) => {
    const w = world(on)
    w.refuseState.add('language')
    w.refuseState.add('hidden')
    w.refuseState.add('plan')
    w.refuseState.add('seen')
    w.refuseOpen = true
    expect(await start($)).toEqual({ cwd: CWD })
  })

  test('a repeated start doubles no timer', async ($, on) => {
    const w = world(on)
    await start($)
    await start($)
    await sendPlan($, [step('One', 'pending')])
    await w.clock.advance(5000)
    const beats = w.writes.filter(path => path === DESK_FILE).length
    await w.clock.advance(5000)
    expect(w.writes.filter(path => path === DESK_FILE).length).toBe(beats)
  })

  test('nothing polls the agents or shimmers when nothing is at work', async ($, on) => {
    const w = world(on)
    await start($)
    await w.clock.advance(20_000)
    expect(w.agentLists).toBe(0)
    expect(w.state.shimmer).toBeUndefined()
  })

  test('the minute counter moves every 60 s', async ($, on) => {
    const w = world(on)
    await start($)
    await w.clock.advance(60_000)
    expect(w.state.minute).toBe(1)
    await w.clock.advance(60_000)
    expect(w.state.minute).toBe(2)
  })
})

describe('reloads and older versions', () => {
  test('the agents the host kept come back', async ($, on) => {
    const kept = { id: 'a1', description: 'Old job', type: 'general-purpose', phase: 'working', startedAt: 1, endedAt: 0, count: 2, steps: [{ live: 'Lecture' }], tokens: 0, liveTokens: 0, seat: 0, hue: 3 }
    const w = world(on, { held: { agents: [kept] } })
    await start($)
    expect(w.state.agents).toHaveLength(1)
    await spawn($, w, 'a2')
    expect(w.state.agents.map((a: any) => a.id)).toEqual(['a1', 'a2'])
    expect(w.state.agents[1].seat).toBe(1)
  })

  test('a stopped agent with no error mark leaves, and its tokens stay', async ($, on) => {
    const gone = { id: 'a1', description: 'x', type: 't', phase: 'failed', startedAt: 1, endedAt: 2, count: 0, steps: [], tokens: 500, liveTokens: 0, seat: 0, hue: 0 }
    const real = { ...gone, id: 'a2', errored: true, tokens: 0, seat: 1 }
    const done = { ...gone, id: 'a3', phase: 'done', endedAt: NOON - 5000, tokens: 0, seat: 2 }
    const w = world(on, { held: { agents: [gone, real, done] } })
    await start($)
    expect(w.state.agents.map((a: any) => a.id)).toEqual(['a2', 'a3'])
    await w.clock.advance(5000)
    expect(w.json(DESK_FILE).tokens).toBe(500)
  })

  test('a record with no outfit takes its seat\'s, and the next agent the one after', async ($, on) => {
    const old = { id: 'a1', description: 'x', type: 't', phase: 'working', startedAt: 1, endedAt: 0, count: 0, steps: [], tokens: 0, liveTokens: 0, seat: 7 }
    const w = world(on, { held: { agents: [old] } })
    await start($)
    expect(w.state.agents[0].hue).toBe(1)
    await spawn($, w, 'a2')
    expect(w.state.agents[1].hue).toBe(2)
  })

  test('an old record draws all the same, its post worked out', async ($, on) => {
    const old = { id: 'a1', description: 'Vérifier le build', type: 'general-purpose', phase: 'working', startedAt: 0, endedAt: 0, count: 0, steps: [], tokens: 0, liveTokens: 0, seat: 0 }
    const w = world(on, { held: { agents: [old] } })
    await start($)
    const ui = await mountPane($)
    const alt = (await ui.findAll({ type: 'Svg' })).map((svg: any) => String(svg.props.alt)).find((text: string) => text.startsWith('Testeur') && text !== 'Testeur')
    expect(alt).toContain('Durée inconnue')
    expect(w.state.agents[0].id).toBe('a1')
  })

  test('a hot reload gets the news back as they were, and an envelope flies again', async ($, on) => {
    const w = world(on, { held: { news: { count: 2, shown: 1 } } })
    await start($)
    expect(w.state.news).toEqual({ count: 2, shown: 1 })
    await w.clock.advance(2400)
    expect(w.state.news).toEqual({ count: 2, shown: 2 })
  })

  test('a plan outside its own folder is not taken', async ($, on) => {
    const stray = '/Users/test/.claude/elsewhere/plan-session-1.json'
    const w = world(on, { files: { [stray]: '{"title":"Stray","steps":[{"text":"Stray step","status":"pending"}]}' } })
    await start($)
    expect(w.state.plan).toBeUndefined()
    expect(w.reads).not.toContain(stray)
  })
})

describe('Windows and Mac', () => {
  test('the plan is written under the home, with forward slashes', async ($, on) => {
    const w = world(on, { env: { USERPROFILE: HOME, LANG: 'fr_FR' } })
    await start($)
    await sendPlan($, [step('One', 'pending')])
    expect(w.writes).toContain('/Users/test/.claude/pixeldesk/state/plan-session-1.json')
  })

  test('no command runs when the language is known', async ($, on) => {
    const w = world(on)
    await start($)
    await sendPlan($, [step('One', 'pending')])
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1' })
    await w.clock.advance(70_000)
    expect(w.runs).toEqual([])
  })

  test('on a Mac the home comes from HOME and the floor groups by project', async ($, on) => {
    const other = JSON.stringify({ sessionId: 'kid', title: '', agents: 0, working: 0, summary: '', updatedAt: 0, cwd: '/work/app', desks: [], steps: [], tokens: 0 })
    const w = world(on, { env: { HOME: '/Users/test', LANG: 'fr_FR' }, files: { '/Users/test/.claude/pixeldesk/state/desk-kid.json': other } })
    await start($, 'desktop', '/work/app')
    await w.clock.advance(5000)
    expect(w.lists).toContain('/Users/test/.claude/pixeldesk/state')
    expect(w.state.floor.map((r: any) => r.id)).toEqual(['session-1', 'kid'])
  })

  test('a path read in an event has forward slashes', async ($, on) => {
    const w = world(on)
    await start($, 'desktop', 'C:\\work\\app')
    await w.clock.advance(5000)
    expect(w.json(DESK_FILE).cwd).toBe('C:/work/app')
  })
})

describe('the log and the robustness', () => {
  test('one line: an ISO date, a space, the message in English', async ($, on) => {
    const w = world(on)
    await start($)
    w.refuseOpen = true
    await spawn($, w, 'a1')
    expect(w.log()).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z open pane: .+\n$/)
  })

  test('lines add up', async ($, on) => {
    const w = world(on)
    await start($)
    w.refuseOpen = true
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1' })
    await spawn($, w, 'a2')
    expect(w.log().trim().split('\n')).toHaveLength(2)
  })

  test('a log that cannot be written bothers no one', async ($, on) => {
    const w = world(on)
    w.refuseWrite = /pixeldesk\.log/
    w.refuseOpen = true
    await start($)
    expect(w.commands).toHaveLength(1)
    expect(w.file(LOG_FILE)).toBeUndefined()
  })

  test('an agent list that fails while polling stays quiet', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    w.refuse.add('agent.list')
    await w.clock.advance(2000)
    expect(w.state.agents[0].phase).toBe('working')
  })

  test('a failure of the mod leaves a result as it came', async ($, on) => {
    const w = world(on)
    w.answers.Read = () => ({ result: { file: 'text' } })
    await start($)
    w.refuse.add('agent.list')
    const ran = await callTool($, 'Read', { file_path: 'a.ts' }, 'stranger')
    expect(ran.result).toEqual({ file: 'text' })
  })

  for (const shape of ['null', '42', '"text"', '[]', '{"steps":"no"}', '{"tokens":"many","news":"lots"}']) {
    test(`${shape} in every file breaks nothing`, async ($, on) => {
      const w = world(on, { files: { [PLAN_FILE]: shape, [DESK_FILE]: shape, '/Users/test/.claude/pixeldesk/settings.json': shape } })
      expect(await start($)).toEqual({ cwd: CWD })
      expect(w.state.plan?.steps ?? []).toEqual([])
      expect(w.state.tokens).toBeUndefined()
    })
  }

  test('tokens saved as words leave the count at zero', async ($, on) => {
    const w = world(on, { files: { [DESK_FILE]: '{"tokens":"many"}' } })
    await start($)
    expect(w.state.tokens).toBeUndefined()
  })
})
