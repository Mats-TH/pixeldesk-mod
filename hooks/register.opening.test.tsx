import { describe, expect, test } from 'claude-code/testing'

import type { Briefing } from '../types'
import { briefingButtons } from './card-briefing'
import { FIVE, BRIEFING_TEXT, MANUAL, STATE_FILE, answers, claudeRun, hearthWorld, linksOpened, press, saved } from './test-hearth'
import { ENGLISH, HOME, SESSION, SETTINGS_FILE, command, mountBand, mountPane, start } from './test-kit'

describe('the new conversation', () => {
  const ready = async ($: any, t: ReturnType<typeof hearthWorld>) => {
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    await command($, 'move')
    await t.w.clock.settle()
  }
  const NEW = /^claude:\/\/code\/new\?q=(.*)&folder=(.*)$/

  test('claude missing: a link that waits for Enter, in the exact folder, and a toast', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    t.w.answerRun = e => (e.argv[0] === 'claude' ? { deny: 'not found' } : { value: { exitCode: 0, stdout: '', stderr: '' } })
    await ready($, t)
    await press($, 'briefing-start')
    const [link] = linksOpened(t.w) as [string]
    const [, q, folder] = link.match(NEW)!
    expect(decodeURIComponent(folder!)).toBe(t.h.cwd)
    expect(decodeURIComponent(q!)).toContain('Voici la passation')
    expect(decodeURIComponent(q!)).toContain('Prochaines étapes')
    expect(t.w.toasts.at(-1)).toBe('Nouvelle conversation ouverte. Appuie sur Entrée pour la lancer.')
  })

  test('the message holds the briefing, asks for no tool and allows none', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await ready($, t)
    await press($, 'briefing-start')
    const run = claudeRun(t.w)
    expect(run.argv[2]).toContain('Voici la passation')
    expect(run.argv[2]).toContain(t.w.file(saved(t.w)[0]))
    expect(run.argv[2]).not.toContain('Read')
    expect(run.argv.join(' ')).not.toContain('allowedTools')
    expect(run.argv.join(' ')).not.toContain('--tools')
    expect(run.argv).toHaveLength(6)
  })

  test('the new conversation takes the title of the briefing', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await ready($, t)
    t.w.files.set(saved(t.w)[0], '# Passation : finir la validation\n\nReprends ici.')
    await press($, 'briefing-start')
    expect(claudeRun(t.w).argv[5]).toBe('--name=finir la validation')
  })

  test('a briefing without a title still names the conversation', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await ready($, t)
    t.w.files.set(saved(t.w)[0], 'Reprends ici.')
    await press($, 'briefing-start')
    expect(claudeRun(t.w).argv[5]).toBe('--name=PixelDesk')
  })

  test('a first message that never ends is cut off by the time limit, and the link takes over', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    t.w.answerRun = e => (e.argv[0] === 'claude' ? { deny: 'timed out' } : { value: { exitCode: 0, stdout: '', stderr: '' } })
    await ready($, t)
    await press($, 'briefing-start')
    expect(claudeRun(t.w).init.timeoutMs).toBe(180_000)
    expect(linksOpened(t.w)[0]).toMatch(NEW)
    expect(t.w.state.briefing.phase).toBe('idle')
  })

  test('a very long briefing is cut, and the message names the file of the rest', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    t.w.answerRun = e => (e.argv[0] === 'claude' ? { deny: 'not found' } : { value: { exitCode: 0, stdout: '', stderr: '' } })
    await ready($, t)
    const file = saved(t.w)[0]
    t.w.files.set(file, 'x'.repeat(40_000))
    await press($, 'briefing-start')
    const message = claudeRun(t.w).argv[2]
    expect(message.length < 30_000).toBe(true)
    expect(message).toContain('La suite de cette passation est dans')
    const [, q] = (linksOpened(t.w)[0] as string).match(NEW)!
    expect(decodeURIComponent(q!).length < 15_000).toBe(true)
  })

  test('a briefing that cannot be read opens nothing', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await ready($, t)
    t.w.files.delete(saved(t.w)[0])
    await press($, 'briefing-start')
    expect(claudeRun(t.w)).toBeUndefined()
    expect(linksOpened(t.w)).toEqual([])
  })

  test('the click shows at once: the row says so while claude runs', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await ready($, t)
    const held = t.w.answerRun
    const seen: { note: string; opening?: boolean }[] = []
    t.w.answerRun = e => {
      seen.push(t.w.state.briefing)
      return held!(e)
    }
    await press($, 'briefing-start')
    expect(seen[0]).toMatchObject({ note: 'Création de la nouvelle conversation en cours…', opening: true })
    expect(briefingButtons(seen[0] as Briefing), 'no button while it is created').toEqual([])
    expect(t.w.state.briefing.opening).toBeUndefined()
  })

  test('while it opens the button is gone: a second click cannot start a second one', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    let release = (_: unknown) => {}
    t.w.answerRun = e => (e.argv[0] === 'claude' ? new Promise(resolve => (release = resolve)) as any : { value: { exitCode: 0, stdout: '', stderr: '' } })
    await ready($, t)
    const ui = await mountBand($)
    const first = ui.press({ key: 'briefing-start' })
    await t.w.clock.settle()
    expect(await ui.findAll({ key: 'briefing-start' })).toEqual([])
    release({ value: { exitCode: 0, stdout: '', stderr: '' } })
    await first
    expect(t.w.runs.filter((r: any) => r.argv[0] === 'claude')).toHaveLength(1)
  })

  test('once it is open the row closes, and this conversation is no longer kept fire', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await ready($, t)
    await press($, 'briefing-start')
    expect(t.w.state.briefing.phase).toBe('idle')
    expect(t.w.state.hearth.relaunchStop).toBe('briefing')
    expect(await (await mountBand($)).findAll({ key: 'briefing-start' })).toEqual([])
  })

  test('claude that fails falls back the same way', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    t.w.answerRun = e => ({ value: { exitCode: e.argv[0] === 'claude' ? 1 : 0, stdout: '', stderr: '' } })
    await ready($, t)
    await press($, 'briefing-start')
    expect(linksOpened(t.w)[0]).toMatch(NEW)
  })

  test('an unknown folder opens nothing and leaves Copier', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    t.h.cwd = ''
    await start($, 'desktop', '')
    await t.reply($)
    await t.w.clock.advance(1000)
    await command($, 'move')
    await t.w.clock.settle()
    await press($, 'briefing-start')
    expect(t.w.runs).toEqual([])
    expect(t.w.state.briefing.note).toBe('Le dossier de la session est inconnu : rien n’est ouvert. Utilise Copier.')
  })

  test('on a Mac: open, and never rundll32', async ($, on) => {
    const t = hearthWorld(on, { env: { HOME: '/Users/test', LANG: 'fr_FR' }, files: MANUAL })
    t.h.cwd = '/Users/test/app'
    t.w.answerRun = () => ({ value: { exitCode: 0, stdout: '', stderr: '' } })
    await ready($, t)
    await press($, 'briefing-start')
    const id = claudeRun(t.w).argv[4]
    expect(t.w.runs.at(-1).argv).toEqual(['open', `claude://resume?session=${id}`])
  })

  test('on Linux: straight to the link', async ($, on) => {
    const t = hearthWorld(on, { env: { HOME: '/home/test', LANG: 'fr_FR' }, files: { [`/home/test/.claude/pixeldesk/settings.json`]: JSON.stringify({ briefingMode: 'manual' }) } })
    t.h.cwd = '/home/test/app'
    t.w.answerRun = () => ({ value: { exitCode: 0, stdout: '', stderr: '' } })
    await ready($, t)
    await press($, 'briefing-start')
    expect(claudeRun(t.w)).toBeUndefined()
    expect(t.w.runs.at(-1).argv[0]).toBe('xdg-open')
    expect(t.w.runs.at(-1).argv[1]).toMatch(NEW)
  })

  test('Copier uses the surface of the click, and says when it could not', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await ready($, t)
    await press($, 'briefing-copy', 'terminal')
    expect(t.h.copies[0]).toContain(BRIEFING_TEXT)
    expect(t.w.state.briefing.note).toBe('Copié. Colle-le dans une nouvelle conversation.')
    t.h.copied = false
    await press($, 'briefing-copy')
    expect(t.w.state.briefing.note).toBe('La copie a échoué. Utilise plutôt Ouvrir.')
    expect(t.w.runs, 'no command for a clipboard').toEqual([])
  })

  test('Ouvrir hands the file to the system, in its own spelling', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    t.w.answerRun = () => ({ value: { exitCode: 0, stdout: '', stderr: '' } })
    await ready($, t)
    await press($, 'briefing-open')
    expect(t.w.runs.at(-1).argv[0]).toBe('rundll32')
    expect(t.w.runs.at(-1).argv[2]).toContain('\\.claude\\pixeldesk\\briefings\\')
  })
})

describe('the gestures and the drawings', () => {
  test('settings from the panel: every value saved, other keys kept', async ($, on) => {
    const { w } = hearthWorld(on, { files: { [SETTINGS_FILE]: JSON.stringify({ theme: 'night' }) } })
    await start($)
    const pane = await mountPane($)
    await pane.press({ key: 'settings-button-0' })
    for (const key of ['hearth-mode-manual', 'hearth-fire-off', 'hearth-mode-auto', 'hearth-compact-always', 'hearth-compact-1']) await pane.press({ key })
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'night', briefingMode: 'auto', fire: false, compactBefore: 1 })
    expect(w.state.settings).toMatchObject({ fire: false, briefingMode: 'auto', compactBefore: 1 })
  })

  test('the open panel holds them, and the band stays as it was', async ($, on) => {
    const { w } = hearthWorld(on)
    await start($)
    const closed = await mountBand($)
    const before = (await closed.find({ type: 'Svg' })).props.source
    await closed.unmount()
    const pane = await mountPane($)
    await pane.press({ key: 'settings-button-0' })
    expect(w.state.settings.open).toBe(true)
    const ui = await mountBand($)
    expect(await ui.findAll({ type: 'Button' })).toEqual([])
    const keys = (await pane.findAll({ type: 'Button' })).map((b: any) => b.props.key)
    for (const key of ['hearth-fire-off', 'hearth-mode-auto', 'hearth-mode-manual', 'hearth-compact-0', 'hearth-compact-1', 'hearth-compact-2', 'hearth-compact-3', 'hearth-compact-always']) expect(keys).toContain(key)
    expect((await ui.find({ type: 'Svg' })).props.source).toBe(before)
  })

  test('in English: the briefing speaks it, and the prompt asks for it', async ($, on) => {
    const t = hearthWorld(on, { env: ENGLISH, files: MANUAL })
    t.h.fork = prompt => (prompt.includes('Answer only') ? answers.pong() : answers.reply('# Briefing: the mod\n\nhello'))
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    expect((await command($, 'move')).text).toContain('Writing the briefing')
    await t.w.clock.settle()
    expect(t.h.forks.at(-1)).toContain('Write in English')
    expect(t.w.file(saved(t.w)[0])).toContain('## Work in progress')
    expect(saved(t.w)[0]).toContain('-the-mod.md')
  })

  test('the room and the floor stay plain images, whatever the hearth does', async ($, on) => {
    const { w, reply } = hearthWorld(on, { env: { USERPROFILE: HOME, LANG: 'fr_FR' } })
    await start($)
    await reply($)
    await w.clock.advance(FIVE)
    const pane = await mountPane($)
    const svgs = await pane.findAll({ type: 'Svg' })
    expect(svgs[0].props.isInteractive, 'the room itself').toBeUndefined()
    // The manager, the fire, the crab and the decor: each small drawing is one iframe of its own, and they stop there.
    const frames = svgs.filter((svg: any) => svg.props.isInteractive)
    expect(frames.length).toBeLessThanOrEqual(6)
    // The crab alone has the whole floor, and the wall stays out of his frame.
    const share = (svg: any) => (svg.props.alt === 'Le crabe' ? 0.8 : 0.5)
    for (const svg of frames) expect(svg.props.width * svg.props.height, 'no frame the size of the room').toBeLessThan(share(svg) * svgs[0].props.width * svgs[0].props.height)
  })

  test('/clear starts the count over', async ($, on) => {
    const { w, fill } = hearthWorld(on, { files: { ...MANUAL, [STATE_FILE]: JSON.stringify({ compactions: 3 }) } })
    fill(50)
    await start($)
    await w.clock.settle()
    expect(w.state.hearth.compactions).toBe(3)
    fill(0)
    await $.session.end({ reason: 'clear', sessionId: SESSION, resume: { id: SESSION } })
    await w.clock.settle()
    expect(w.state.hearth).toMatchObject({ compactions: 0, contextPercent: 0, coolsAt: null })
  })
})
