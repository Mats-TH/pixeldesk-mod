import { describe, expect, test } from 'claude-code/testing'

import type { Fire, Handoff, Hearth } from '../types'
import { cardAlt, cardSvg, optionSvg, settingsPlace, settingsSvg, stepSvg, zoneCells } from './card'
import { handoffButtons, handoffCard, handoffRow } from './card-handoff'
import { hearthCard } from './card-hearth'
import type { HearthCardView } from './card-hearth'
import { dictionaries, setLanguage, t } from './i18n'
import { GLYPHS } from './pixel/font-data'
import { textWidth, wrap } from './pixel/font'

const NOW = 1_000_000
const hearth = (over: Partial<Hearth> = {}): Hearth => ({ fire: 'full', ash: 'full', coolsAt: NOW + 222_000, relaunches: 4, relaunchCap: 30, active: false, contextPercent: 82, compactions: 1, compactTarget: 2, keeper: null, keeperRun: 0, warmStop: null, warmError: '', lengthMs: 300_000, warmSince: 0, failures: 0, ...over })
const view = (over: Partial<Hearth> = {}, warm = true): HearthCardView => ({ hearth: hearth(over), warm, now: NOW })
const handoff = (over: Partial<Handoff> = {}): Handoff => ({ phase: 'offered', waitingAgents: 0, waitingChats: 0, step: 0, file: null, urgent: false, words: 0, error: '', note: '', asked: false, ...over })
const full = (c: { draw: (w: number, h: number) => { source: string; width: number; height: number } }) => c.draw(4096, 4096)
const count = (s: string, what: RegExp) => (s.match(what) ?? []).length
const inEnglish = (run: () => void) => {
  setLanguage('en')
  try {
    run()
  } finally {
    setLanguage('fr')
  }
}

describe('the card of the hearth', () => {
  test('warm, at the size of the design, with its time, its relaunches and its fill', () => {
    const card = hearthCard(view())
    const drawn = full(card)
    expect([drawn.width, drawn.height], '272 by 440 and the shadow').toEqual([276, 444])
    for (const said of ['Cache de la conversation', 'Refroidit dans 3 min 45', 'Gardé au chaud : 4 relances sur 30', 'Conversation remplie à 82 %', 'Compactages : 1 sur 2', 'Chaud']) expect(cardAlt(card)).toContain(said)
    expect(drawn.source, 'four cells of time, and the fill').toContain('#E4633A')
    expect(drawn.source.includes('script'), 'nothing to run').toBe(false)
  })

  test('the time is the moment of the drawing, and nothing in it ticks', () => {
    expect(cardAlt(hearthCard({ ...view(), now: NOW + 100_000 }))).toContain('Refroidit dans 2 min 05')
    expect(full(hearthCard(view())).source).not.toMatch(/<animate|@keyframes/)
  })

  test('relaunches off: the design\'s gold, and its line', () => {
    const drawn = hearthCard(view({ coolsAt: NOW + 72_000, fire: 'low' }, false))
    expect(cardAlt(drawn)).toContain('Refroidit dans 1 min 15')
    expect(cardAlt(drawn)).toContain('Relance désactivée dans les réglages')
    expect(full(drawn).source).toContain('#FFC857')
  })

  test('cold: 4 px shorter, no line of relaunches, the violet of the design', () => {
    const card = hearthCard(view({ coolsAt: NOW - 1, fire: 'out' }))
    const drawn = full(card)
    expect(drawn.height, '436 and the shadow').toBe(440)
    expect(cardAlt(card)).toContain('Cache refroidi. Le prochain message le réécrit.')
    expect(cardAlt(card)).toContain('Froid')
    expect(cardAlt(card)).not.toContain('relance')
    expect(drawn.source).toContain('#9DB4FF')
  })

  test('no clock yet: cold', () => {
    expect(cardAlt(hearthCard(view({ coolsAt: null, lengthMs: 0, fire: 'out' })))).toContain('Froid')
  })

  test('an unknown length says so, and no time: `coolsAt` is a mere bound', () => {
    const card = hearthCard(view({ lengthMs: 0 }))
    expect(cardAlt(card)).toContain(t('warm.lengthUnknown'))
    expect(cardAlt(card)).not.toContain('Refroidit')
    expect(cardAlt(card)).not.toContain('Gardé au chaud')
    expect(cardAlt(hearthCard(view({ lengthMs: 0, coolsAt: NOW - 1 })))).toContain(t('warm.lengthUnknown'))
  })

  test('what stopped the relaunches shows, with its error', () => {
    expect(cardAlt(hearthCard(view({ warmStop: 'failed', warmError: 'overloaded' })))).toContain('Arrêtée après 3 échecs (overloaded)')
    expect(cardAlt(hearthCard(view({ warmStop: 'failed', warmError: 'overloaded', coolsAt: NOW - 1, fire: 'out' }))), 'cold as well').toContain('overloaded')
    expect(cardAlt(hearthCard(view({ warmStop: 'cap' })))).toContain(t('warm.stoppedCap'))
    expect(full(hearthCard(view({ warmStop: 'handoff' }))).height, 'the card grows with the words').toBeGreaterThan(444)
  })

  test('an active session has no cap, and `always` no target', () => {
    const card = hearthCard(view({ relaunchCap: null, compactTarget: 'always', compactions: 3 }))
    expect(cardAlt(card)).toContain('Gardé au chaud : 4 relances.')
    expect(cardAlt(card)).toContain('Compactages : 3.')
  })

  test('each fire has its icon', () => {
    const sources = (['full', 'low', 'out'] as Fire[]).map(fire => full(hearthCard(view({ fire }))).source)
    expect(new Set(sources).size).toBe(3)
    expect(full(hearthCard(view({ fire: 'medium' }))).source).toBe(sources[0])
    expect(full(hearthCard(view({ fire: 'embers' }))).source).toBe(sources[1])
  })

  test('a short pane loses the second paragraph first, then the card shrinks', () => {
    const card = hearthCard(view())
    expect(card.draw(276, 420).height, 'the tight card, at its own size').toBe(392)
    expect(card.draw(276, 420).source).not.toBe(full(card).source)
    expect(card.draw(200, 300).width <= 200).toBe(true)
    expect(card.draw(200, 300).height <= 300).toBe(true)
  })
})

describe('the card of the handoff', () => {
  test('the heights of the design, state by state', () => {
    const height = (over: Partial<Handoff>) => full(handoffCard(handoff(over))).height - 4
    expect(height({})).toBe(245)
    expect(height({ phase: 'waiting', waitingAgents: 2, waitingChats: 1 })).toBe(329)
    expect(height({ phase: 'waiting', waitingAgents: 2, waitingChats: 1, urgent: true })).toBe(311)
    expect(height({ phase: 'writing', step: 2 })).toBe(245)
    expect(height({ phase: 'ready', step: 4 })).toBe(275)
  })

  test('each state says its words', () => {
    const alt = (over: Partial<Handoff>) => cardAlt(handoffCard(handoff(over)))
    expect(alt({})).toContain('Grosse conversation')
    expect(alt({})).toContain('Proposée')
    expect(alt({ phase: 'waiting', waitingAgents: 2, waitingChats: 1 })).toContain('Passation après 2 agents et 1 conversation')
    expect(alt({ phase: 'waiting', waitingAgents: 1 })).toContain('Passation après 1 agent.')
    expect(alt({ phase: 'waiting', waitingChats: 2, urgent: true })).toContain('2 conversations continuent ici')
    expect(alt({ phase: 'waiting', waitingAgents: 1, urgent: true })).toContain('1 agent continue ici')
    expect(alt({ phase: 'waiting' })).toContain('Attend la fin du tour')
    expect(alt({ phase: 'writing', step: 2 })).toContain('Étape 3 sur 5')
    expect(alt({ phase: 'ready', step: 4 })).toContain('Fichier enregistré')
    expect(alt({ phase: 'failed', error: 'panne' })).toContain('panne')
    for (const step of ['Relire la conversation', 'Relever les fichiers', 'Lister les agents en cours', 'Rédiger', 'Enregistrer']) expect(alt({})).toContain(step)
  })

  test('the steps go by: green behind, gold on the one at work, red where it fell', () => {
    const source = (over: Partial<Handoff>) => full(handoffCard(handoff(over))).source
    expect(count(source({}), /#4E8F5A/g)).toBe(0)
    expect(count(source({ phase: 'writing', step: 2 }), /#4E8F5A/g)).toBe(2)
    expect(source({ phase: 'writing', step: 2 })).toContain('#FFDF8F')
    expect(count(source({ phase: 'ready', step: 4 }), /#4E8F5A/g)).toBe(5)
    expect(source({ phase: 'failed', step: 1 })).toContain('#B8452A')
  })

  test('urgent: the button to press is gold, and its place is given', () => {
    const card = handoffCard(handoff({ phase: 'waiting', waitingAgents: 2, waitingChats: 1, urgent: true }))
    expect(card.buttons.map(b => [b.key, b.primary])).toEqual([['handoff-now', true], ['handoff-cancel', false]])
    expect(card.buttons[0]).toMatchObject({ x: 21, y: 234, w: 154 })
    expect(handoffCard(handoff()).buttons).toEqual([])
  })
})

describe('the row', () => {
  const WIDE = 750

  test('34 tall, a plain drawing, the buttons of the design against the right edge', () => {
    const row = handoffRow(handoff({ phase: 'ready', step: 4 }), WIDE)
    expect(row.height).toBe(34)
    expect(row.buttons.map(b => [b.key, b.x, b.w])).toEqual([['handoff-start', 355, 167], ['handoff-copy', 530, 63], ['handoff-open', 601, 62], ['handoff-close', 671, 69]])
    expect(row.alt.length > 0).toBe(true)
    expect(row.source).not.toMatch(/<animate|@keyframes|script/)
  })

  test('the keys of each phase, the urgent one primary', () => {
    const keys = (over: Partial<Handoff>) => handoffButtons(handoff(over)).map(b => b.key)
    expect(keys({})).toEqual(['handoff-change', 'handoff-cancel'])
    expect(keys({ phase: 'waiting' })).toEqual(['handoff-now', 'handoff-cancel'])
    expect(keys({ phase: 'writing' })).toEqual(['handoff-close'])
    expect(keys({ phase: 'ready' })).toEqual(['handoff-start', 'handoff-copy', 'handoff-open', 'handoff-close'])
    expect(keys({ phase: 'failed' })).toEqual(['handoff-retry', 'handoff-close'])
    expect(keys({ phase: 'failed', file: '/a.md' })).toEqual(['handoff-retry', 'handoff-copy', 'handoff-open', 'handoff-close'])
    expect(handoffButtons(handoff({ phase: 'waiting', urgent: true }))[0]!.primary).toBe(true)
    expect(handoffButtons(handoff({ phase: 'waiting' }))[0]!.primary).toBe(false)
  })

  test('a button says its count to a reader, and draws the design\'s words', () => {
    const now = handoffButtons(handoff({ phase: 'waiting', waitingAgents: 2, waitingChats: 1 }))[0]!
    expect([now.label, now.drawn]).toEqual(['Changer maintenant (3 en cours)', 'Changer maintenant'])
  })

  test('a word of the mod replaces the line of a ready handoff', () => {
    expect(handoffRow(handoff({ phase: 'ready', note: 'Copié.' }), WIDE).alt).toContain('Copié.')
  })

  test('the gauge shows only while it writes', () => {
    expect(handoffRow(handoff({ phase: 'writing', step: 3 }), WIDE).source).toContain('#5FC9B8')
    expect(handoffRow(handoff(), WIDE).source).not.toContain('#5FC9B8')
  })

  test('at the narrowest band the buttons stay whole, and the words give way', () => {
    const row = handoffRow(handoff({ phase: 'ready', step: 4 }), 420)
    expect(row.buttons[0]!.x > 0).toBe(true)
    expect(row.alt).toContain('Passation prête')
    expect(row.source).not.toContain('#1B1730"/><path')
  })

  test('narrowed by the app, the row still fills the height kept for it', () => {
    expect(handoffRow(handoff(), WIDE).source).toContain('preserveAspectRatio="none"')
  })
})

describe('the panel', () => {
  const place = settingsPlace(780, 760)
  const choices = { departure: 'plan', warm: true, handoffMode: 'auto', compactBefore: 2 } as const

  test('296 by 542 with the cursor, 470 without', () => {
    expect(settingsSvg(choices, place).width >= 300).toBe(true)
    const manual = settingsSvg({ ...choices, handoffMode: 'manual' }, settingsPlace(780, 760, 'manual'))
    expect(manual.alt).toContain('Manuel, choisi')
    expect(manual.alt).not.toContain('Compacte')
    expect(manual.rows < settingsSvg(choices, place).rows).toBe(true)
  })

  test('every step of the cursor says its sentence', () => {
    for (const compactBefore of [0, 1, 2, 3, 'always'] as const) {
      expect(settingsSvg({ ...choices, compactBefore }, place).alt).toContain(t(compactBefore === 'always' ? 'hearth.cursor.always' : `hearth.cursor.${compactBefore}`))
    }
  })

  test('the steps do not share a cell, and none overlaps the options around it', () => {
    for (const [w, h] of [[780, 760], [496, 462]] as const) {
      const at = settingsPlace(w, h)
      const cells = at.steps.map(zoneCells)
      cells.forEach((c, i) => {
        if (i) expect(c.left >= cells[i - 1]!.left + cells[i - 1]!.cols, `${w}: ${i}`).toBe(true)
      })
      expect(zoneCells(at.options.auto).top + zoneCells(at.options.auto).rows <= cells[0]!.top).toBe(true)
      expect(cells[0]!.top + cells[0]!.rows <= zoneCells(at.options.manual).top).toBe(true)
    }
  })

  test('a step lit, and an option kept ticked under the pointer', () => {
    expect(stepSvg(1, place).source).toContain('#FFDF8F')
    expect(optionSvg('warm', place, true).source).toContain('#FFC857')
    expect(optionSvg('manual', place).source).toContain('#FFF2C4')
  })
})

describe('the words', () => {
  const both = (run: () => void) => {
    run()
    inEnglish(run)
  }

  test('every visible text has its letters in the font', () => {
    const prefixes = /^(handoff\.(row|card|chip|jobs|after|carryOn|step|button)|hearth\.|warm\.(stopped|lengthUnknown))/
    for (const dictionary of Object.values(dictionaries)) {
      for (const [key, text] of Object.entries(dictionary)) {
        if (!prefixes.test(key)) continue
        for (const ch of text.replace(/\{\w+\}/g, '')) expect(ch === ' ' || !!GLYPHS[ch], `${key}: ${ch}`).toBe(true)
      }
    }
  })

  test('the panel holds its lines as the design has them, in both languages', () => {
    both(() => {
      const lines = (key: Parameters<typeof t>[0]) => wrap(t(key), 16, 222, 9).length
      expect(lines('settings.plan.line')).toBe(2)
      expect(lines('settings.each.line')).toBe(1)
      expect(lines('hearth.warm.line')).toBe(2)
      expect(lines('hearth.auto.line')).toBe(1)
      expect(lines('hearth.manual.line')).toBe(1)
      for (const key of ['hearth.warm.name', 'hearth.auto.name', 'hearth.manual.name'] as const) expect(textWidth(t(key), 18) <= 222, t(key)).toBe(true)
      for (const key of ['hearth.cursor', 'hearth.cursor.0', 'hearth.cursor.1', 'hearth.cursor.2', 'hearth.cursor.3', 'hearth.cursor.always'] as const) expect(textWidth(t(key), 16) <= 262, t(key)).toBe(true)
      expect(textWidth(t('hearth.always'), 16) <= 86).toBe(true)
    })
  })

  test('the heads of the cards hold on their lines', () => {
    both(() => {
      for (const key of ['handoff.card.offered', 'handoff.card.waiting', 'handoff.card.waitingTurn', 'handoff.card.urgent', 'handoff.card.ready', 'handoff.card.failed'] as const) expect(textWidth(t(key), 20) <= 176, t(key)).toBe(true)
      expect(wrap(t('hearth.card.title'), 30, 176, 9).length <= 2).toBe(true)
      for (const key of ['hearth.card.warmOff', 'hearth.card.cold'] as const) expect(wrap(t(key), 16, 230, 9).length <= 2, t(key)).toBe(true)
    })
  })

  test('the design\'s card in French keeps its lines', () => {
    expect(wrap(t('hearth.card.text'), 20, 230, 9)).toEqual(['Tant que le feu brûle, Claude', 'relit la conversation sans la', "réécrire. C'est plus rapide et ça", 'consomme moins.'])
    expect(wrap(t('hearth.card.ash'), 20, 230, 9).length).toBe(2)
    expect(wrap(t('hearth.card.cold'), 16, 230, 9).length).toBe(2)
  })
})

test('a card that draws itself goes through cardSvg', () => {
  const card = hearthCard(view())
  expect(cardSvg(card, 276, 444)).toEqual(card.draw(276, 444))
})
