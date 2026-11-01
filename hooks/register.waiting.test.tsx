import { describe, expect, test } from 'claude-code/testing'

import { DRAFT, FIVE, BRIEFINGS, BRIEFING_TEXT, HELD_HEARTH, MANUAL, NOTES, answers, hearthWorld, press, saved } from './test-hearth'
import { NOON, SESSION, SETTINGS_FILE, callTool, command, endTurn, mountBand, sendPlan, spawn, start, step } from './test-kit'

describe('waiting for the work', () => {
  const asked = async ($: any, t: ReturnType<typeof hearthWorld>, percent = 50) => {
    t.fill(percent)
    await start($)
    await t.reply($)
    await spawn($, t.w, 'a1', { description: 'Write the tests' })
    await t.w.clock.advance(1000)
    await command($, 'move')
  }

  test('Déménager writes nothing while an agent works, and starts alone when it ends', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await asked($, t)
    expect(t.w.state.briefing).toMatchObject({ phase: 'waiting', waitingAgents: 1, urgent: false })
    expect(t.h.forks.some(prompt => prompt.includes('document de reprise'))).toBe(false)
    await endTurn($, { agentId: 'a1' })
    await t.w.clock.advance(1000)
    expect(t.w.state.briefing.phase).toBe('ready')
    expect(t.w.runs).toEqual([])
    const text = t.w.file(saved(t.w)[0])!
    expect(text).toContain(BRIEFING_TEXT)
    expect(text).toContain('## Travaux en cours')
    expect(text).not.toContain('continuent dans l’ancienne conversation')
  })

  test('the fire stays lit through the wait', { timeoutMs: 30000 }, async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await asked($, t)
    await t.w.clock.advance(FIVE)
    expect(t.forks.filter(prompt => prompt.includes('Answer only')).length).toBeGreaterThan(0)
  })

  test('Changer maintenant keeps the list and says the work carries on over there', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await asked($, t, 86)
    await t.w.clock.advance(5000)
    expect(t.w.state.briefing).toMatchObject({ phase: 'waiting', urgent: true })
    const ui = await mountBand($, 'terminal')
    const now = (await ui.findAll({ type: 'Button' })).find((b: any) => b.props.key === 'briefing-now')
    expect(now.props).toMatchObject({ label: 'Changer maintenant (1 en cours)', variant: 'primary' })
    await press($, 'briefing-now')
    await t.w.clock.settle()
    expect(t.w.state.briefing.phase).toBe('ready')
    const text = t.w.file(saved(t.w)[0])!
    expect(text).toContain('Write the tests')
    expect(text).toContain('Ces travaux continuent dans l’ancienne conversation')
  })

  test('the plan and the agents always reach the document, by the mod and not the model', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await start($)
    await sendPlan($, [step('Finir', 'in_progress'), step('Livrer', 'pending'), step('Lire', 'completed')], 'Le mod')
    await asked($, t)
    await press($, 'briefing-now')
    await t.w.clock.settle()
    const text = t.w.file(saved(t.w)[0])!
    expect(text).toContain('- en cours : Finir')
    expect(text).toContain('- à faire : Livrer')
    expect(text).toContain('- fait : Lire')
    expect(text).toMatch(/### Agents\n- .*Write the tests/)
  })

  test('Annuler ends the wait, and nothing is written', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await asked($, t)
    await press($, 'briefing-cancel')
    await endTurn($, { agentId: 'a1' })
    await t.w.clock.advance(5000)
    expect(t.w.state.briefing.phase).toBe('idle')
    expect(saved(t.w)).toEqual([])
  })

  test('a reload goes on waiting for what somebody asked, and drops what was half written', async ($, on) => {
    const base = { phase: 'waiting', waitingAgents: 0, waitingChats: 0, step: 0, file: null, urgent: false, words: 0, error: '', note: '', asked: true }
    const hearth = HELD_HEARTH(NOON)
    const { w } = hearthWorld(on, { held: { briefing: { ...base, phase: 'writing', step: 3 }, hearth } })
    await start($)
    await w.clock.advance(1000)
    expect(w.state.briefing.phase).toBe('idle')
  })

  test('a wait of the ash alone is not a request: a reload does not turn it into a call', async ($, on) => {
    const held = { phase: 'waiting', waitingAgents: 1, waitingChats: 0, step: 0, file: null, urgent: false, words: 0, error: '', note: '', asked: false }
    const hearth = HELD_HEARTH(NOON)
    const { w, h } = hearthWorld(on, { held: { briefing: held, hearth } })
    await start($)
    await w.clock.advance(2000)
    expect(h.forks).toEqual([])
    expect(w.state.briefing.phase).toBe('idle')
  })
})

describe('the document', () => {
  test('notes of the compactions reach the model, and the draft is saved before it is called', async ($, on) => {
    const t = hearthWorld(on, { files: { ...MANUAL, [NOTES]: '## Compactage 1\n- une décision ancienne' } })
    t.h.fork = () => {
      expect(t.w.file(DRAFT)).toContain('Brouillon de passation')
      return answers.reply(BRIEFING_TEXT)
    }
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    await command($, 'move')
    await t.w.clock.settle()
    expect(t.h.forks.at(-1)).toContain('une décision ancienne')
    expect(t.w.file(DRAFT)).toContain('une décision ancienne')
  })

  test('secrets of a known shape never reach the disk', async ($, on) => {
    const secret = 'sk-abcdefghijklmnopqrstuvwx'
    const t = hearthWorld(on, { files: MANUAL })
    t.h.messages = [{ role: 'user', text: `ma clé ${secret}`, toolUses: [] }]
    t.h.fork = () => answers.reply(`# Passation : test\n\nclé ${secret} et AKIAIOSFODNN7EXAMPLE`)
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    await command($, 'move')
    await t.w.clock.settle()
    const text = t.w.file(saved(t.w)[0])!
    expect(text).toContain('<secret retiré>')
    expect(text).not.toContain(secret)
    expect(text).not.toContain('AKIAIOSFODNN7EXAMPLE')
    expect(t.w.file(DRAFT)).not.toContain(secret)
  })

  test('the file is named from the date and the title', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    t.h.fork = () => answers.reply('# Passation : Construire le mod Déménager\n\ntexte')
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    await command($, 'move')
    await t.w.clock.settle()
    expect(saved(t.w)).toEqual([`${BRIEFINGS}/2026-10-27-1200-construire-le-mod-demenager.md`])
    expect(t.w.state.briefing.file).toContain('/2026-10-27-1200-construire-le-mod-demenager.md')
  })

  test('the 20 latest stay, the others lose their text', async ($, on) => {
    const old = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`${BRIEFINGS}/2026-01-${String(i + 1).padStart(2, '0')}-1000-old.md`, `old ${i}`]))
    const t = hearthWorld(on, { files: { ...MANUAL, ...old } })
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    await command($, 'move')
    await t.w.clock.settle()
    expect(saved(t.w)).toHaveLength(20)
    expect(t.w.file(`${BRIEFINGS}/2026-01-01-1000-old.md`)).toBe('')
    expect(t.w.file(`${BRIEFINGS}/2026-01-02-1000-old.md`)).toBe('')
    expect(t.w.file(`${BRIEFINGS}/2026-01-03-1000-old.md`)).toBe('old 2')
  })

  test('a failed model keeps the draft, the buttons, and no relaunch goes out', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    t.h.fork = prompt => (prompt.includes('Answer only') ? answers.pong() : answers.overloaded)
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    await command($, 'move')
    await t.w.clock.settle()
    expect(t.w.state.briefing).toMatchObject({ phase: 'failed', error: 'l’appel au modèle a échoué (529)', file: expect.stringContaining(`/briefings/draft-${SESSION}.md`) })
    expect(t.w.toasts).toContain('La passation n’a pas abouti. Un brouillon reste disponible.')
    const count = t.forks.length
    await t.w.clock.advance(FIVE)
    expect(t.forks, 'the conversation is on its way out').toHaveLength(count)
    t.h.fork = () => answers.reply(BRIEFING_TEXT)
    await press($, 'briefing-retry')
    await t.w.clock.settle()
    expect(t.w.state.briefing.phase).toBe('ready')
  })

  test('a briefing stokes the clock from when it left, and Fermer lets the relaunches back after the next turn', { timeoutMs: 30000 }, async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await start($)
    await t.reply($)
    await t.w.clock.advance(60_000)
    await command($, 'move')
    await t.w.clock.settle()
    expect(t.w.state.hearth.coolsAt).toBe(NOON + 60_000 + FIVE)
    await press($, 'briefing-close')
    await t.w.clock.settle()
    expect(t.w.state.briefing).toMatchObject({ phase: 'idle', file: null })
    const count = t.forks.length
    await t.w.clock.advance(FIVE)
    expect(t.forks, 'nothing until the next turn').toHaveLength(count)
    await t.reply($)
    await t.w.clock.advance(FIVE - 45_000)
    expect(t.forks).toHaveLength(count + 1)
  })

  test('with relaunches off the tool works all the same', async ($, on) => {
    const t = hearthWorld(on, { files: { [SETTINGS_FILE]: JSON.stringify({ fire: false, briefingMode: 'manual' }) } })
    await start($)
    await t.reply($)
    await t.w.clock.advance(1000)
    await callTool($, 'mcp__pixeldesk__move')
    await t.w.clock.settle()
    expect(t.w.state.briefing.phase).toBe('ready')
  })

  test('the tool asks for it in the main conversation, and refuses an agent', async ($, on) => {
    const t = hearthWorld(on, { files: MANUAL })
    await start($)
    await t.reply($)
    await spawn($, t.w, 'a1')
    const agent = await callTool($, 'mcp__pixeldesk__move', {}, 'a1')
    expect(agent.result).toBe('Le déménagement n’est disponible que dans la conversation principale. Continue sans.')
    expect(t.w.state.briefing.phase).toBe('idle')
    const main = await callTool($, 'mcp__pixeldesk__move')
    expect(main.result).toBe('La passation démarre à la fin de ce tour. Préviens l’utilisateur en une ligne, puis termine ton tour.')
    await t.w.clock.settle()
    expect(t.w.state.briefing).toMatchObject({ phase: 'waiting', asked: true })
  })
})
