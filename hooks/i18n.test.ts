import { describe, expect, test } from 'claude-code/testing'

import { en, fr, getLanguage, plural, setLanguage, t } from './i18n'
import type { TextKey } from './i18n'

/** Runs in a language, then leaves the module as the other tests of this file expect it. */
function inLanguage<T>(language: 'fr' | 'en', work: () => T) {
  const before = getLanguage()
  setLanguage(language)
  try {
    return work()
  } finally {
    setLanguage(before)
  }
}

const slots = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()

const COMMAND_FR: [TextKey, string][] = [
  ['cmd.opened', 'PixelDesk ouvert.'],
  ['cmd.openedEmpty', 'PixelDesk ouvert. Les cartes apparaissent quand Claude lance un sous-agent.'],
  ['cmd.hidden', 'Panneau PixelDesk masqué. La barre reste visible et le suivi continue. Réaffiche-le avec /pixeldesk show.'],
  ['cmd.shown', 'Panneau PixelDesk de nouveau affiché.'],
  ['cmd.usage', 'Option inconnue. Utilise /pixeldesk, /pixeldesk hide, /pixeldesk show, /pixeldesk departure, /pixeldesk warm ou /pixeldesk refresh.'],
]

const COMMAND_EN: [TextKey, string][] = [
  ['cmd.opened', 'PixelDesk is open.'],
  ['cmd.openedEmpty', 'PixelDesk is open. Cards appear when Claude starts a subagent.'],
  ['cmd.hidden', 'PixelDesk panel hidden. The bar stays visible and tracking continues. Bring it back with /pixeldesk show.'],
  ['cmd.shown', 'PixelDesk panel is back on screen.'],
  ['cmd.usage', 'Unknown option. Use /pixeldesk, /pixeldesk hide, /pixeldesk show, /pixeldesk departure, /pixeldesk warm or /pixeldesk refresh.'],
]

describe('the two dictionaries', () => {
  test('have exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort())
  })

  test('a text has the same slots in both', () => {
    const skewed = (Object.keys(fr) as (keyof typeof fr)[]).filter(key => JSON.stringify(slots(fr[key])) !== JSON.stringify(slots(en[key])))
    // Two languages may round a week's hour differently; every other text says the same things.
    expect(skewed.filter(key => !['gauge.week', 'gauge.weekMinutes'].includes(key))).toEqual([])
  })

  test('neither holds an em dash or an en dash', () => {
    for (const dictionary of [fr, en]) for (const text of Object.values(dictionary)) expect(text).not.toMatch(/[—–]/)
  })

  test('the brand lives in one place and is the same in both', () => {
    expect(fr.brand).toBe('PixelDesk')
    expect(en.brand).toBe('PixelDesk')
  })

  test('the only command a text names is /pixeldesk', () => {
    for (const dictionary of [fr, en]) {
      const named = Object.values(dictionary).flatMap(text => [...text.matchAll(/(?<![\w/])\/([a-z]+)/g)].map(match => match[1]))
      expect([...new Set(named)]).toEqual(['pixeldesk'])
    }
  })

  test('no text speaks of the mod being off', () => {
    // The relaunches may be off: that is a setting of the mod, as the design says it.
    for (const [key, text] of Object.entries(fr)) if (key !== 'hearth.card.warmOff') expect(text).not.toMatch(/désactiv/i)
    for (const text of Object.values(en)) expect(text).not.toMatch(/turned off|disabled/i)
  })

  test('the exact texts of the command', () => {
    inLanguage('fr', () => {
      for (const [key, text] of COMMAND_FR) expect(t(key)).toBe(text)
    })
    inLanguage('en', () => {
      for (const [key, text] of COMMAND_EN) expect(t(key)).toBe(text)
    })
  })

  test('the texts for the model name the tool in full', () => {
    for (const language of ['fr', 'en'] as const) {
      inLanguage(language, () => {
        for (const key of ['agent.suffix', 'prompt.section', 'nudge.new', 'nudge.continue', 'nudge.stale'] as const) {
          expect(t(key, { tool: 'mcp__pixeldesk__plan' })).toContain('mcp__pixeldesk__plan')
        }
      })
    }
  })
})

describe('translating', () => {
  test('a value goes in by its name, and the brand needs no value', () => {
    inLanguage('fr', () => expect(t('band.now', { text: 'Tester' })).toBe('En cours : Tester'))
    inLanguage('en', () => expect(t('band.now', { text: 'Test' })).toBe('Now: Test'))
    inLanguage('en', () => expect(t('cmd.shown')).toBe('PixelDesk panel is back on screen.'))
  })

  test('a brace followed by a space stays as written', () => {
    inLanguage('en', () => expect(t('plan.err.list')).toBe('Plan not saved: steps must be a list of { text, status }.'))
    inLanguage('fr', () => expect(t('plan.err.list')).toBe('Plan non enregistré : envoie steps sous forme de liste de { text, status }.'))
  })

  test('the language can be read back', () => {
    inLanguage('en', () => expect(getLanguage()).toBe('en'))
    inLanguage('fr', () => expect(getLanguage()).toBe('fr'))
  })
})

describe('plurals', () => {
  test('French: one for 0 and 1', () => {
    inLanguage('fr', () => {
      expect(plural('pane.done', 0, { n: 0 })).toBe('0 fini')
      expect(plural('pane.done', 1, { n: 1 })).toBe('1 fini')
      expect(plural('pane.done', 2, { n: 2 })).toBe('2 finis')
    })
  })

  test('English: one for 1 alone', () => {
    inLanguage('en', () => {
      expect(plural('overview.news', 0, { n: 0 })).toBe('0 new messages')
      expect(plural('overview.news', 1, { n: 1 })).toBe('1 new message')
      expect(plural('overview.news', 2, { n: 2 })).toBe('2 new messages')
    })
  })

  test('the room reads in the singular with one agent', () => {
    inLanguage('fr', () => expect(plural('pane.roomAlt', 1, { n: 1, summary: 'x', manager: 'y' })).toBe('Pièce avec 1 agent. x. y.'))
    inLanguage('en', () => expect(plural('pane.roomAlt', 1, { n: 1, summary: 'x', manager: 'y' })).toBe('Room with 1 agent. x. y.'))
  })

  test('every plural comes as a pair', () => {
    // Two names that only look like plurals: a connector nobody knows and a tool nobody knows.
    const keys = Object.keys(fr).filter(key => key !== 'connector.other' && key !== 'step.other')
    for (const key of keys.filter(k => k.endsWith('.one'))) expect(keys.includes(key.replace(/\.one$/, '.other'))).toBe(true)
    for (const key of keys.filter(k => k.endsWith('.other'))) expect(keys.includes(key.replace(/\.other$/, '.one'))).toBe(true)
  })
})
