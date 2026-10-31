import { describe, expect, test } from 'claude-code/testing'

import { HOME, SESSION, SETTINGS_FILE, hasKey, mountPane, sendPlan, sourceOf, spawn, start, step, textsOf, world } from './test-kit'
import { TREE_ROOM, treeChars } from './view-shared'

const STATE = '/Users/test/.claude/pixeldesk/state'
const DATA = '/Users/test/AppData/Local/Claude-Data/profile/claude-code-sessions'
const LOCAL = 'C:\\Users\\test\\AppData\\Local'
// What the client refuses, in silence: the pane then says its plugin has not drawn.
const REFUSED = 262_144
const WIDE = { bodyColumns: 187, scroll: { offset: 0, bodyRows: 63 } }
const THEMES = ['cosy', 'japonais', 'nature', 'futuriste', 'geek', 'base']

const planOf = (n: number) => Array.from({ length: n }, (_, i) => step(`Étape numéro ${i + 1} du plan`, i ? 'pending' : 'in_progress', { detail: 'Lire les notes des sessions voisines, le code et les thèmes.', who: 'Claude' }))
const inTheme = (theme: string) => ({ files: { [SETTINGS_FILE]: JSON.stringify({ theme }) } })
const session = (id: string, cli: string, title: string, parent?: string) => JSON.stringify({ sessionId: id, cliSessionId: cli, title, ...(parent ? { spawnedFrom: { sessionId: parent } } : {}) })
const desk = (id: string) => JSON.stringify({ sessionId: id, title: '', agents: 1, working: 1, summary: 'Busy', updatedAt: Date.UTC(2030, 0, 1), cwd: 'C:/work/app', desks: [{ title: 'Testeur', state: 'working', hue: 1 }], steps: [], tokens: 12000, chat: 'working' })

describe('the weight of a drawing', () => {
  test('the measure is the client\'s: the source and the words of a drawing, the strings of a box', async () => {
    expect(treeChars({ type: 'Svg', props: { source: 'abcd', alt: 'xy', width: 10 } })).toBe(6)
    expect(treeChars({ type: 'Box', props: { key: 'k', width: 1 }, hover: { display: 'flex' }, children: ['abc', { type: 'Text', props: {}, children: ['de'] }] })).toBe('key'.length + 1 + 'width'.length + 'display'.length + 4 + 5)
    expect(TREE_ROOM).toBeLessThan(REFUSED)
  })

  for (const theme of THEMES) {
    test(`${theme}: a long plan and agents never send a room the client would refuse`, { timeoutMs: 30000 }, async ($, on) => {
      const w = world(on, inTheme(theme))
      await start($)
      const ui = await mountPane($, 'desktop', WIDE)
      await sendPlan($, planOf(14), 'Un long plan')
      for (const id of ['a', 'b', 'c']) await spawn($, w, id)
      await ui.redraw()
      expect(treeChars(await ui.drawn())).toBeLessThan(REFUSED)
      expect(await hasKey(ui, 'room'), 'the room stays').toBe(true)
    })

    test(`${theme}: a full floor with its settings open stays under the limit`, { timeoutMs: 30000 }, async ($, on) => {
      const files: Record<string, string> = { [SETTINGS_FILE]: JSON.stringify({ theme }), [`${DATA}/local_me.json`]: session('me', SESSION, 'Chef') }
      for (let i = 0; i < 10; i += 1) {
        files[`${DATA}/local_${i}.json`] = session(`l${i}`, `k${i}`, `Conversation ${i}`, 'me')
        files[`${STATE}/desk-k${i}.json`] = desk(`k${i}`)
      }
      const w = world(on, { env: { USERPROFILE: HOME, LANG: 'fr_FR', LOCALAPPDATA: LOCAL }, files })
      await start($)
      await w.clock.advance(5000)
      const ui = await mountPane($, 'desktop', WIDE)
      await ui.press({ key: 'settings-button-0' })
      await ui.redraw()
      expect(await hasKey(ui, 'settings-panel')).toBe(true)
      expect(treeChars(await ui.drawn())).toBeLessThan(REFUSED)
    })
  }

  test('a plan that fits loses nothing: the crab walks and every line has its bubble', async ($, on) => {
    world(on, inTheme('nature'))
    await start($)
    const ui = await mountPane($, 'desktop', WIDE)
    await sendPlan($, planOf(4), 'Court')
    expect(await hasKey(ui, 'reveal-3')).toBe(true)
    expect(await hasKey(ui, 'desk-manager')).toBe(true)
    expect((await sourceOf(ui, 'live-crab')).length).toBeGreaterThan(20_000)
  })

  test('the crab gives up his walk first, and the bubbles of the plan stay while they can', async ($, on) => {
    const w = world(on, inTheme('nature'))
    await start($)
    const ui = await mountPane($, 'desktop', WIDE)
    await sendPlan($, planOf(6), 'Moyen')
    await spawn($, w, 'a')
    await ui.redraw()
    expect((await sourceOf(ui, 'live-crab')).length, 'asleep in his basket').toBeLessThan(10_000)
    expect(await hasKey(ui, 'reveal-5')).toBe(true)
  })

  test('the limit never takes the pane away: what cannot be drawn reads as the list', async ($, on) => {
    const w = world(on, inTheme('nature'))
    await start($)
    const ui = await mountPane($, 'desktop', WIDE)
    for (let i = 0; i < 30; i += 1) await spawn($, w, `a${i}`)
    await ui.redraw()
    const whole = treeChars(await ui.drawn())
    expect(whole).toBeLessThan(REFUSED)
    if (!(await hasKey(ui, 'room'))) expect((await textsOf(ui)).length).toBeGreaterThan(0)
  })
})
