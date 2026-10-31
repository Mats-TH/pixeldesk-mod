import { describe, expect, test } from 'claude-code/testing'

import { altOf, BENEATH, callTool, command, endTurn, everyText, hasKey, LOG_FILE, mountBand, mountPane, NOON, PLAN_FILE, receive, sendPlan, SETTINGS_FILE, spawn, start, startTurn, step, submit, textsOf, world } from './test-kit'

const SHOWN = 'Panneau PixelDesk de nouveau affiché.'
const HIDDEN = 'Panneau PixelDesk masqué. La barre reste visible et le suivi continue. Réaffiche-le avec /pixeldesk show.'

const KID_FILE = '/Users/test/.claude/pixeldesk/state/desk-kid.json'
const KID = JSON.stringify({ sessionId: 'kid', title: '', agents: 0, working: 0, summary: '', updatedAt: NOON, cwd: 'C:/work/app', desks: [], steps: [], tokens: 0 })

describe('/pixeldesk hide', () => {
  test('writes the setting, closes the pane, and answers, with nothing in the state', async ($, on) => {
    const w = world(on)
    await start($)
    const answer = await command($, 'hide')
    expect(w.file(SETTINGS_FILE)).toBe('{\n  "hidden": true\n}\n')
    expect(w.closed).toEqual(['pixeldesk'])
    expect(answer.text).toBe(HIDDEN)
    expect('hidden' in w.state).toBe(false)
  })

  test('keeps the other keys of the settings', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"theme":"night","count":3}' } })
    await start($)
    await command($, 'hide')
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'night', count: 3, hidden: true })
  })

  test('a broken file is replaced by a new object', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{not json' } })
    await start($)
    await command($, 'hide')
    expect(w.json(SETTINGS_FILE)).toEqual({ hidden: true })
  })

  for (const shape of ['[1,2]', 'null', '12', '"hidden"']) {
    test(`${shape} is no object: not hidden, and replaced on write`, async ($, on) => {
      const w = world(on, { files: { [SETTINGS_FILE]: shape } })
      await start($)
      expect(w.opened).toHaveLength(1)
      await command($, 'hide')
      expect(w.json(SETTINGS_FILE)).toEqual({ hidden: true })
    })
  }

  test('a write that fails goes to the log and still holds here', async ($, on) => {
    const w = world(on)
    await start($)
    w.refuseWrite = /settings\.json/
    const answer = await command($, 'hide')
    expect(answer.text).toBe(HIDDEN)
    expect(w.closed).toHaveLength(1)
    await spawn($, w, 'a1')
    expect(w.opened, 'held here: no pane for the agent').toHaveLength(1)
    expect(w.file(LOG_FILE)).toContain('settings file')
  })

  test('the next read gives the file its say again', async ($, on) => {
    const w = world(on)
    await start($)
    w.refuseWrite = /settings\.json/
    await command($, 'hide')
    await w.clock.advance(3000)
    await spawn($, w, 'a1')
    expect(w.opened).toHaveLength(2)
  })
})

describe('with no disk', () => {
  test('hide and show hold in this conversation, in memory', async ($, on) => {
    const w = world(on, { env: { LANG: 'fr_FR' } })
    await start($)
    expect((await command($, 'hide')).text).toBe(HIDDEN)
    expect(w.closed).toHaveLength(1)
    await spawn($, w, 'a1')
    expect(w.opened).toHaveLength(1)
    expect((await command($, 'show')).text).toBe(SHOWN)
    expect(w.opened).toHaveLength(2)
    expect(w.writes).toEqual([])
  })
})

describe('/pixeldesk show', () => {
  test('lifts the setting and opens the pane here', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"theme":"night","hidden":true}' } })
    await start($)
    expect(w.opened).toEqual([])
    const answer = await command($, 'show')
    expect(w.json(SETTINGS_FILE).hidden ?? false).toBe(false)
    expect(w.json(SETTINGS_FILE).theme).toBe('night')
    expect(w.opened).toHaveLength(1)
    expect(answer.text).toBe(SHOWN)
  })

  test('a write that fails still shows it here', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    w.refuseWrite = /settings\.json/
    const answer = await command($, 'show')
    expect(answer.text).toBe(SHOWN)
    expect(w.opened).toHaveLength(1)
  })
})

describe('/pixeldesk', () => {
  test('opens the pane and says so when it is empty', async ($, on) => {
    const w = world(on)
    await start($, 'terminal')
    const answer = await command($)
    expect(w.opened).toHaveLength(1)
    expect(answer.text).toBe('PixelDesk ouvert. Les cartes apparaissent quand Claude lance un sous-agent.')
  })

  test('and with agents', async ($, on) => {
    const w = world(on)
    await start($, 'terminal')
    await spawn($, w, 'a1')
    expect((await command($)).text).toBe('PixelDesk ouvert.')
  })

  test('lifts a hidden mod first', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    await command($)
    expect(w.json(SETTINGS_FILE).hidden ?? false).toBe(false)
    expect(w.opened).toHaveLength(1)
  })

  test('without touching the file when nothing was hidden', async ($, on) => {
    const w = world(on)
    await start($)
    await command($)
    expect(w.file(SETTINGS_FILE)).toBeUndefined()
  })

  for (const word of ['HIDE', '  Hide  ', ' hide']) {
    test(`"${word}" reads as hide`, async ($, on) => {
      const w = world(on)
      await start($)
      await command($, word)
      expect(w.json(SETTINGS_FILE).hidden).toBe(true)
    })
  }

  test('another word changes nothing and answers the usage', async ($, on) => {
    const w = world(on)
    await start($)
    const opens = w.opened.length
    const answer = await command($, 'off')
    expect(answer.text).toBe('Option inconnue. Utilise /pixeldesk, /pixeldesk hide, /pixeldesk show, /pixeldesk departure, /pixeldesk warm, /pixeldesk refresh ou /pixeldesk compact.')
    expect(w.file(SETTINGS_FILE)).toBeUndefined()
    expect(w.opened).toHaveLength(opens)
    expect(w.closed).toEqual([])
  })
})

describe('hidden, every conversation', () => {
  test('a conversation that sees the setting arrive closes its pane, its band stays', async ($, on) => {
    const w = world(on)
    await start($)
    const band = await mountBand($)
    expect(await hasKey(band, 'idle-band')).toBe(true)
    w.files.set(SETTINGS_FILE, '{"hidden":true}')
    await w.clock.advance(3000)
    expect(w.closed).toEqual(['pixeldesk'])
    expect(await hasKey(band, 'idle-band')).toBe(true)
  })

  test('one that sees it go opens nothing, and its band never left', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    const band = await mountBand($)
    w.files.set(SETTINGS_FILE, '{}')
    await w.clock.advance(3000)
    expect(await hasKey(band, 'idle-band')).toBe(true)
    expect(w.opened).toEqual([])
  })

  test('the next wave of agents brings the pane back', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    w.files.set(SETTINGS_FILE, '{}')
    await w.clock.advance(3000)
    await spawn($, w, 'a1')
    expect(w.opened).toHaveLength(1)
  })

  test('a read that fails changes nothing', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    w.refuseRead = /settings\.json/
    await w.clock.advance(3000)
    await spawn($, w, 'a1')
    expect(w.opened).toEqual([])
  })

  test('a file that went away reads as not hidden', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    w.files.delete(SETTINGS_FILE)
    await w.clock.advance(3000)
    await spawn($, w, 'a1')
    expect(w.opened).toHaveLength(1)
  })

  for (const surface of ['desktop', 'terminal', 'mobile'] as const) {
    test(`hidden, the band keeps its case on ${surface}`, async ($, on) => {
      const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}', [KID_FILE]: KID } })
      await start($, surface)
      const band = await mountBand($, surface)
      expect(await hasKey(band, 'idle-band'), 'at rest').toBe(true)
      await w.clock.advance(5000)
      expect(await hasKey(band, 'overview-band'), 'overview').toBe(true)
      await sendPlan($, [step('A task', 'in_progress')], 'Open plan')
      expect(await hasKey(band, 'plan-band'), 'plan').toBe(true)
      expect(await everyText(band)).toContain('Open plan')
    })

    test(`hidden, a pane open by another way draws as usual on ${surface}`, async ($, on) => {
      const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
      await start($, surface)
      await spawn($, w, 'a1', { description: 'First' })
      const pane = await mountPane($, surface)
      expect(await textsOf(pane)).not.toContain(BENEATH)
      expect(await hasKey(pane, surface === 'terminal' ? 'row-manager' : 'room')).toBe(true)
    })
  }

  test('at rest the band gives way to a survey alone, not to hiding', async ($, on) => {
    world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    expect(await hasKey(await mountBand($), 'idle-band')).toBe(true)
    expect(await textsOf(await mountBand($, 'desktop', { hasSurvey: true }))).toEqual([BENEATH])
  })

  test('the news count in the band, hidden included', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}', [KID_FILE]: KID } })
    await start($)
    await w.clock.advance(5000)
    await receive($)
    expect(await altOf(await mountBand($))).toContain('1 nouvelle')
  })

  test('the turn and the departures go on, hidden', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    await startTurn($)
    expect(w.state.chat.working).toBe(true)
    await spawn($, w, 'a1')
    await endTurn($, { agentId: 'a1' })
    await w.clock.advance(30_000)
    expect(w.state.agents).toEqual([])
  })

  test('no pane opens for agents either', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    await spawn($, w, 'a1')
    expect(w.opened).toEqual([])
  })

  test('not even if the file was hidden after the start', async ($, on) => {
    const w = world(on)
    await start($, 'terminal')
    w.files.set(SETTINGS_FILE, '{"hidden":true}')
    await w.clock.advance(3000)
    await spawn($, w, 'a1')
    expect(w.opened).toEqual([])
  })

  test('tracking goes on: tool, file, toasts, notes, prompts, cards', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"hidden":true}' } })
    await start($)
    await submit($)
    const note = await callTool($, 'Read', { file_path: 'a.ts' })
    expect(note.context?.[0]).toContain('mcp__pixeldesk__plan')
    await sendPlan($, [step('One', 'in_progress'), step('Two', 'pending')], 'Still')
    expect(w.json(PLAN_FILE).title).toBe('Still')
    await sendPlan($, [step('One', 'completed'), step('Two', 'in_progress')])
    expect(w.toasts).toEqual(['Fait : One'])
    const started = await spawn($, w, 'a1')
    expect(started.agentId).toBe('a1')
    expect(w.spawned[0].prompt).toContain('mcp__pixeldesk__plan')
    await callTool($, 'Read', { file_path: 'b.ts' }, 'a1')
    expect(w.state.agents[0].count).toBe(1)
    await w.clock.advance(5000)
    expect(w.files.has('/Users/test/.claude/pixeldesk/state/desk-session-1.json')).toBe(true)
  })

  test('the pane holds no hide button', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    for (const surface of ['desktop', 'terminal'] as const) {
      const ui = await mountPane($, surface)
      for (const button of await ui.findAll({ type: 'Button' })) expect(button.props.key).toMatch(/^settings-/)
      expect(await hasKey(ui, 'hide')).toBe(false)
      await ui.unmount()
    }
  })
})
