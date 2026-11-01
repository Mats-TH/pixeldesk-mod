import { describe, expect, test } from 'claude-code/testing'

import { FIVE, BRIEFING_TEXT, MANUAL, NOTES, STATE_FILE, answers, claudeRun, hearthWorld, linksOpened, press, saved } from './test-hearth'
import { CWD, SESSION, SETTINGS_FILE, altOf, command, endTurn, mountBand, spawn, start, startTurn, textsOf, usage } from './test-kit'

const UUID = /^[0-9a-f-]{36}$/

describe('the ash', () => {
  for (const [percent, ash] of [[0, 'none'], [1, 'small'], [24, 'small'], [25, 'medium'], [50, 'large'], [79, 'large'], [80, 'full']] as const) {
    test(`${percent} % reads ${ash}`, async ($, on) => {
      const { w, fill } = hearthWorld(on, { files: MANUAL })
      fill(percent)
      await start($)
      await w.clock.settle()
      expect(w.state.hearth).toMatchObject({ ash, contextPercent: percent })
    })
  }

  test('without a percent it is worked out from the tokens', async ($, on) => {
    const { w } = hearthWorld(on, { files: MANUAL })
    w.context = { tokens: 300_000, window: 1_000_000 }
    await start($)
    await w.clock.settle()
    expect(w.state.hearth.contextPercent).toBe(30)
  })

  test('below the mark nothing happens at the end of a turn', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on)
    fill(79)
    await start($)
    await reply($)
    await w.clock.advance(2000)
    expect(h.compacts).toEqual([])
    expect(w.state.briefing.phase).toBe('idle')
  })
})

describe('auto: compact under the cursor, change past it', () => {
  test('under the cursor it compacts at the end of the turn, with the briefing brief and notes first', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on)
    h.messages = [{ role: 'user', text: 'Fais le mod, on garde la cheminée à gauche.', toolUses: [] }, { role: 'assistant', text: '', toolUses: [{ tool: 'Edit', input: { file_path: 'C:/work/app/a.ts' } }] }]
    fill(80)
    await start($)
    await reply($)
    expect(h.compacts, 'never inside the turn').toEqual([])
    await w.clock.advance(1000)
    expect(h.compacts).toHaveLength(1)
    expect(h.compacts[0].instructions).toContain(`~/.claude/pixeldesk/briefings/notes-${SESSION}.md`)
    expect(w.state.hearth).toMatchObject({ compactions: 1, keeper: 'broom', keeperRun: 1, coolsAt: null })
    expect(w.json(STATE_FILE).compactions).toBe(1)
    const notes = w.file(NOTES)!
    expect(notes).toContain('Compactage 1')
    expect(notes).toContain('C:/work/app/a.ts')
    expect(notes).toContain('Fais le mod, on garde la cheminée à gauche.')
    expect(notes).toContain('### Décisions')
    expect(w.runs).toEqual([])
  })

  test('at most once for an end of turn: a context still full does not loop', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on)
    fill(90)
    await start($)
    await reply($)
    await w.clock.advance(60_000)
    expect(h.compacts).toHaveLength(1)
  })

  test('compactions by Claude Code count too, and move the next step on', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on)
    await start($)
    h.messages = [{ role: 'user', text: 'Une demande', toolUses: [] }]
    await $.session.compact({ trigger: 'auto', messages: h.messages })
    await $.session.compact({ trigger: 'manual', messages: h.messages })
    await w.clock.advance(1)
    expect(w.state.hearth.compactions).toBe(2)
    expect(w.file(NOTES)).toContain('Compactage 2')
    fill(85)
    await reply($)
    await w.clock.advance(1000)
    expect(h.compacts, 'the two of before, and no third').toHaveLength(2)
    expect(h.forks.some(prompt => prompt.includes('document de reprise'))).toBe(true)
  })

  test('a refused compaction counts for nothing', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on)
    h.compactAnswer = { skip: 'not now' }
    fill(90)
    await start($)
    await reply($)
    await w.clock.advance(1000)
    expect(w.state.hearth.compactions).toBe(0)
    expect(w.log()).toContain('compaction skipped: not now')
  })

  test('/pixeldesk compact compacts at once, under the mark, and it counts', async ($, on) => {
    const { w, h, fill } = hearthWorld(on)
    h.messages = [{ role: 'user', text: 'Une demande', toolUses: [] }]
    fill(30)
    await start($)
    expect((await command($, 'compact')).text).toBe('Compactage lancé.')
    await w.clock.advance(1)
    expect(h.compacts).toHaveLength(1)
    expect(h.compacts[0].instructions).toContain('notes-')
    expect(w.state.hearth.compactions).toBe(1)
    expect(w.file(NOTES)).toContain('Compactage 1')
    expect(w.toasts).toContain('Conversation compactée, les notes sont enregistrées.')
  })

  test('/pixeldesk compact never lands on a turn', async ($, on) => {
    const { w, h } = hearthWorld(on)
    await start($)
    await startTurn($)
    expect((await command($, 'compact')).text).toContain('Pas maintenant')
    await w.clock.advance(1)
    expect(h.compacts).toEqual([])
  })

  test('/pixeldesk compact says so when it is refused', async ($, on) => {
    const { w, h } = hearthWorld(on)
    h.compactAnswer = { skip: 'not now' }
    await start($)
    await command($, 'compact')
    await w.clock.advance(1)
    expect(w.state.hearth.compactions).toBe(0)
    expect(w.toasts).toContain('Le compactage n’a pas abouti. La raison est dans le journal de PixelDesk.')
  })

  test('a compaction count outlives a restart', async ($, on) => {
    const { w } = hearthWorld(on, { files: { [STATE_FILE]: JSON.stringify({ compactions: 2, snooze: 0 }) } })
    await start($)
    await w.clock.settle()
    expect(w.state.hearth.compactions).toBe(2)
  })

  test('compactBefore 0: the first full ash changes conversation, with no gesture', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on, { files: { [SETTINGS_FILE]: JSON.stringify({ compactBefore: 0 }) } })
    w.answerRun = () => ({ value: { exitCode: 0, stdout: 'ready', stderr: '' } })
    fill(80)
    await start($, 'desktop', CWD)
    await reply($)
    await w.clock.advance(1000)
    expect(h.compacts).toEqual([])
    expect(w.state.briefing.phase, 'the row closes once the conversation is open').toBe('idle')
    expect(saved(w)).toHaveLength(1)
    const run = claudeRun(w)
    const id = run.argv[4]
    expect(run.argv.slice(0, 2)).toEqual(['claude', '-p'])
    expect(run.argv[2]).toContain(w.files.get(saved(w)[0]) ?? '')
    expect(run.argv[2]).not.toContain('.md')
    expect(run.argv[3]).toBe('--session-id')
    expect(id).toMatch(UUID)
    expect(run.argv[5], 'no tool, and no tool allowed: the = stays').toBe('--tools=')
    expect(run.argv).toHaveLength(6)
    expect(run.init.cwd, 'the exact folder, worktree included').toBe(h.cwd)
    expect(linksOpened(w)).toEqual([`claude://resume?session=${id}`])
    expect(w.runs.at(-1).argv.slice(0, 2)).toEqual(['rundll32', 'url.dll,FileProtocolHandler'])
    expect(w.toasts.at(-1)).toBe('Nouvelle conversation ouverte, la passation est déjà lue.')
  })

  test('always compacts, whatever the count', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on, { files: { [SETTINGS_FILE]: JSON.stringify({ compactBefore: 'always' }), [STATE_FILE]: JSON.stringify({ compactions: 9 }) } })
    fill(85)
    await start($)
    await reply($)
    await w.clock.advance(1000)
    expect(h.compacts).toHaveLength(1)
    expect(w.state.hearth.compactTarget).toBe('always')
  })

  test('a cold cache is never paid for without a gesture: the choice is offered', async ($, on) => {
    const { w, h, fill } = hearthWorld(on)
    fill(90)
    await start($)
    await w.clock.advance(FIVE)
    expect(h.compacts).toEqual([])
    expect(h.forks).toEqual([])
    expect(w.state.briefing.phase).toBe('offered')
  })

  test('agents hold it back, and it goes alone when the last one ends', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on)
    fill(82)
    await start($)
    await spawn($, w, 'a1')
    await reply($)
    await w.clock.advance(2000)
    expect(h.compacts).toEqual([])
    expect(w.state.briefing).toMatchObject({ phase: 'waiting', waitingAgents: 1, waitingChats: 0, asked: false })
    await endTurn($, { agentId: 'a1' })
    await w.clock.advance(1000)
    expect(h.compacts).toHaveLength(1)
  })
})

describe('the two settings are independent', () => {
  for (const fire of [true, false]) {
    for (const briefingMode of ['auto', 'manual'] as const) {
      test(`fire ${fire}, ${briefingMode}: fire rules the relaunches, the mode rules the rest`, async ($, on) => {
        const { w, h, reply, fill } = hearthWorld(on, { files: { [SETTINGS_FILE]: JSON.stringify({ fire, briefingMode }) } })
        fill(10)
        await start($)
        await reply($)
        await w.clock.advance(FIVE - 45_000)
        expect(h.forks).toHaveLength(fire ? 1 : 0)
        fill(85)
        await reply($)
        await w.clock.advance(1000)
        expect(h.compacts).toHaveLength(briefingMode === 'auto' ? 1 : 0)
        expect(w.state.briefing.phase).toBe(briefingMode === 'auto' ? 'idle' : 'offered')
      })

      test(`fire ${fire}, ${briefingMode}: the change of conversation follows the mode alone`, async ($, on) => {
        const { w, h, reply, fill } = hearthWorld(on, { files: { [SETTINGS_FILE]: JSON.stringify({ fire, briefingMode, compactBefore: 0 }) } })
        w.answerRun = () => ({ value: { exitCode: 0, stdout: '', stderr: '' } })
        fill(85)
        await start($)
        await reply($)
        await w.clock.advance(1000)
        expect(h.compacts).toEqual([])
        expect(claudeRun(w) !== undefined).toBe(briefingMode === 'auto')
        expect(saved(w)).toHaveLength(briefingMode === 'auto' ? 1 : 0)
      })
    }
  }
})

/** The keys of a band's presses, one for each button: a drawn button goes on for a second row of cells. */
const pressKeys = async (ui: any) => (await ui.findAll({ type: 'Button' })).map((b: any) => b.props.key).filter((key: string) => !/-\d$/.test(key))

describe('manual: the button', () => {
  test('nothing moves until the click: Changer on a full ash, gone when the ash falls', async ($, on) => {
    const { w, h, reply, fill } = hearthWorld(on, { files: MANUAL })
    fill(81)
    await start($)
    await reply($)
    await w.clock.advance(5000)
    expect(w.state.briefing.phase).toBe('offered')
    expect(h.forks).toEqual([])
    expect(h.compacts).toEqual([])
    const ui = await mountBand($)
    expect(await textsOf(ui), 'on the desktop, the row is an image').not.toContain('Contexte à 81 %. PixelDesk conseille de changer de conversation.')
    expect(await altOf(ui, 'briefing-row')).toBe('Grosse conversation. Déménager ?. Déménager. Fermer')
    expect(await pressKeys(ui)).toEqual(['briefing-change', 'briefing-cancel'])
    const terminal = await mountBand($, 'terminal')
    expect(await textsOf(terminal)).toContain('Contexte à 81 %. PixelDesk conseille de changer de conversation.')
    expect(await pressKeys(terminal)).toEqual(['briefing-change', 'briefing-cancel'])
    fill(30)
    await w.clock.advance(5000)
    expect(w.state.briefing.phase).toBe('idle')
  })

  test('a ready briefing waits for the person: a toast, and the conversation opens at the click', async ($, on) => {
    const { w, reply, fill } = hearthWorld(on, { files: MANUAL })
    w.answerRun = () => ({ value: { exitCode: 0, stdout: '', stderr: '' } })
    fill(81)
    await start($)
    await reply($)
    await w.clock.advance(1000)
    await press($, 'briefing-change')
    await w.clock.settle()
    expect(w.state.briefing.phase).toBe('ready')
    expect(w.toasts).toContain('Passation prête. Clique sur Nouvelle conversation.')
    expect(w.runs, 'nothing opens on its own').toEqual([])
    await press($, 'briefing-start')
    expect(claudeRun(w).argv[1]).toBe('-p')
  })

  test('the buttons of a ready briefing, on both surfaces', async ($, on) => {
    const { w, reply, fill } = hearthWorld(on, { files: MANUAL })
    fill(81)
    await start($)
    await reply($)
    await w.clock.advance(1000)
    await press($, 'briefing-change')
    await w.clock.settle()
    for (const surface of ['desktop', 'terminal']) {
      const ui = await mountBand($, surface)
      expect(await pressKeys(ui)).toEqual(['briefing-start', 'briefing-copy', 'briefing-open', 'briefing-close'])
      await ui.unmount()
    }
  })

  test('Annuler leaves it for 100 000 tokens more, and an emptied context resets that', async ($, on) => {
    const { w, reply, fill } = hearthWorld(on, { files: MANUAL })
    fill(81, 810_000)
    await start($)
    await reply($)
    await w.clock.advance(1000)
    await press($, 'briefing-cancel')
    await w.clock.settle()
    expect(w.state.briefing.phase).toBe('idle')
    expect(w.json(STATE_FILE).snooze).toBe(910_000)
    fill(85, 850_000)
    await w.clock.advance(5000)
    expect(w.state.briefing.phase).toBe('idle')
    fill(92, 920_000)
    await w.clock.advance(5000)
    expect(w.state.briefing.phase).toBe('offered')
  })

  test('a click during a turn writes at its end, never over it', async ($, on) => {
    const { w, h, spend, fill } = hearthWorld(on, { files: MANUAL })
    fill(81)
    await start($)
    await startTurn($)
    await spend($, usage(5))
    await press($, 'briefing-change')
    await w.clock.settle()
    expect(w.state.briefing).toMatchObject({ phase: 'waiting', waitingAgents: 0, asked: true })
    expect(h.forks).toEqual([])
    await endTurn($)
    await w.clock.advance(1000)
    expect(w.state.briefing.phase).toBe('ready')
  })
  test('Fermer during the writing stops it for good: nothing saved, and the row stays away', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    let answer = (_: unknown) => {}
    t.h.fork = (prompt: string) => (prompt.includes('Answer only') ? answers.pong() : new Promise(resolve => (answer = resolve)))
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    await command($, 'move')
    await t.w.clock.settle()
    expect(t.w.state.briefing.phase).toBe('writing')
    await press($, 'briefing-close')
    expect(t.w.state.briefing.phase).toBe('idle')
    const toasts = t.w.toasts.length
    answer(answers.reply(BRIEFING_TEXT))
    await t.w.clock.settle()
    await t.w.clock.advance(2000)
    expect(t.w.state.briefing).toMatchObject({ phase: 'idle', file: null })
    expect(saved(t.w)).toEqual([])
    expect(t.w.toasts).toHaveLength(toasts)
  })
})
