import { describe, expect, test } from 'claude-code/testing'

import { HOME, NOON, SETTINGS_FILE, callTool, command, endTurn, mountBand, mountPane, sendPlan, spawn, start, step, world } from './test-kit'

/** Whatever a surface shows of a tree: the words of a list as much as the alternatives of a drawing. */
const shown = async (ui: any) => JSON.stringify(await ui.drawn(), (key, value) => (key === 'source' ? undefined : value))

const LOCAL = 'C:\\Users\\test\\AppData\\Local'
const DATA = '/Users/test/AppData/Local/Claude-Data/profile/claude-code-sessions'
const session = (id: string, cli: string, title: string, parent?: string) => JSON.stringify({ sessionId: id, cliSessionId: cli, title, ...(parent ? { spawnedFrom: { sessionId: parent } } : {}) })
const kidDesk = JSON.stringify({ sessionId: 'kid', title: '', agents: 2, working: 2, summary: 'Busy', updatedAt: NOON, cwd: 'C:/work/app', desks: [], steps: [], tokens: 0 })

const LINKED = {
  env: { USERPROFILE: HOME, LANG: 'fr_FR', LOCALAPPDATA: LOCAL },
  files: {
    [`${DATA}/local_me.json`]: session('me', 'session-1', 'Chef'),
    [`${DATA}/local_kid.json`]: session('kidl', 'kid', 'Enfant', 'me'),
    '/Users/test/.claude/pixeldesk/state/desk-kid.json': kidDesk,
  },
}

for (const surface of ['vscode', 'mobile'] as const) {
  test(`${surface} takes every tree the mod draws`, async ($, on) => {
    const w = world(on, LINKED)
    await start($, surface)
    await spawn($, w, 'a1')
    await sendPlan($, [step('Une', 'in_progress')], 'Le travail')
    const [band, pane] = [await mountBand($, surface), await mountPane($, surface)]
    expect(await band.find({ key: 'plan-band' })).toBeDefined()
    expect(await pane.find({ key: 'room' })).toBeDefined()
    await w.clock.advance(5000)
    expect(await pane.find({ key: 'floor' })).toBeDefined()
    await sendPlan($, [step('Une', 'completed')], 'Le travail')
    expect(await band.find({ key: 'overview-band' })).toBeDefined()
  })
}

for (const surface of ['desktop', 'terminal'] as const) {
  describe(`a session on ${surface}`, () => {
    test('two agents arrive, work and finish', async ($, on) => {
      const w = world(on)
      await start($, surface)
      const ui = await mountPane($, surface)
      await spawn($, w, 'a1', { description: 'Lire le code' })
      await spawn($, w, 'a2', { description: 'Corriger le code' })
      w.refuse.add('model.complete')
      await callTool($, 'Read', { file_path: 'src/a.ts' }, 'a1')
      await w.clock.settle()
      expect(await shown(ui)).toContain('Lecture de a.ts')
      expect(await shown(ui)).toContain('2 au travail')
      await endTurn($, { agentId: 'a1' })
      expect(await shown(ui)).toContain('1 au travail · 1 fini')
      w.agents = [{ id: 'a2', description: 'Corriger le code', type: 'general-purpose', status: 'completed' }]
      await w.clock.advance(2000)
      expect(await shown(ui)).toContain('2 finis')
      expect(w.statuses.filter(text => text !== undefined)).toEqual([])
    })

    test('the plan tool draws the progress', async ($, on) => {
      world(on)
      await start($, surface)
      const ui = await mountBand($, surface)
      await sendPlan($, [step('Une', 'completed'), step('Deux', 'in_progress'), step('Trois', 'pending'), step('Quatre', 'pending')], 'Le travail')
      const drawn = await shown(ui)
      expect(drawn).toContain('Le travail')
      expect(drawn).toContain('Tâches 1/4')
      expect(drawn).toContain('25%')
      expect(drawn).toContain('En cours : Deux')
    })

    test('hidden, then shown again', async ($, on) => {
      const w = world(on)
      await start($, surface)
      const [band, pane] = [await mountBand($, surface), await mountPane($, surface)]
      await command($, 'hide')
      expect(w.closed).toEqual(['pixeldesk'])
      expect(await shown(band)).toContain('Au repos')
      await command($, 'show')
      expect(w.opened[w.opened.length - 1].id).toBe('pixeldesk')
      expect(await shown(band)).toContain('Au repos')
      expect(await shown(pane)).toContain('Aucun agent')
      expect(w.json(SETTINGS_FILE).hidden ?? false).toBe(false)
    })

    test('a conversation that leads others shows them', async ($, on) => {
      const w = world(on, LINKED)
      await start($, surface)
      await w.clock.advance(5000)
      const pane = await mountPane($, surface)
      expect(await shown(pane)).toContain('Enfant')
      expect(await shown(pane)).toContain('Busy')
      const band = await mountBand($, surface)
      expect(await band.find({ key: 'overview-band' })).toBeDefined()
      expect(await shown(band)).toContain('1 conversation sur 1 au travail, 2 agents')
    })

    test('with no child the room stays', async ($, on) => {
      const w = world(on)
      await start($, surface)
      await w.clock.advance(5000)
      const pane = await mountPane($, surface)
      expect(await shown(pane)).toContain('Aucun agent')
      const band = await mountBand($, surface)
      expect(await band.find({ key: 'idle-band' })).toBeDefined()
    })

    test('the gauges show the windows read', async ($, on) => {
      const windows = [{ kind: 'five_hour', percentUsed: 42, resetsAt: new Date(2026, 9, 27, 14).toISOString() }]
      world(on, { limits: windows })
      await start($, surface)
      const band = await mountBand($, surface)
      const drawn = await shown(band)
      expect(drawn).toContain('42%')
      expect(drawn).toContain('14:00')
      expect(drawn).toContain('--')
    })
  })
}
