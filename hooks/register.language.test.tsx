import { describe, expect, test } from 'claude-code/testing'

import { HOME, mountBand, start, textsOf, world } from './test-kit'
import type { World, WorldOptions } from './test-kit'

const WINDOWS = { USERPROFILE: HOME }
const MAC = { HOME: '/Users/test' }

/** The language the session settled on, as the state and the command's description both tell it. */
function languageOf(w: World) {
  const said = w.commands[0]?.description.startsWith('Affiche') ? 'fr' : 'en'
  expect(w.state.language).toBe(said)
  return said
}

const settled = async ($: any, w: World) => {
  await start($)
  return languageOf(w)
}

const denies = () => ({ deny: 'refused' })

describe('the option', () => {
  for (const [option, other] of [['fr', 'en_US.UTF-8'], ['en', 'fr_FR.UTF-8']] as const) {
    test(`the option ${option} wins over settings and environment`, { options: { language: option } }, async ($, on) => {
      const w = world(on, { env: { ...WINDOWS, LANG: other }, settings: { language: option === 'fr' ? 'english' : 'french' } })
      expect(await settled($, w)).toBe(option)
      expect(w.settingsReads).toBe(0)
    })
  }

  test('auto moves on to the settings', { options: { language: 'auto' } }, async ($, on) => {
    const w = world(on, { env: { ...WINDOWS, LANG: 'en_US' }, settings: { language: 'fr' } })
    expect(await settled($, w)).toBe('fr')
  })

  test('a stored value out of the list counts as auto', { options: { language: 'de' } }, async ($, on) => {
    const w = world(on, { env: { ...WINDOWS, LANG: 'fr_FR' }, settings: { language: 'german' } })
    expect(await settled($, w)).toBe('fr')
  })

  test('an explicit option is in force before any event', { options: { language: 'en' } }, async ($, on) => {
    world(on)
    const ui = await mountBand($, 'terminal')
    expect(await textsOf(ui)).toContain('Idle')
  })

  test('nothing settled reads in French, for the kept modules', async ($, on) => {
    world(on, { env: { LANG: 'en_US' } })
    const ui = await mountBand($, 'terminal')
    expect(await textsOf(ui)).toContain('Au repos')
  })
})

describe('the Claude Code setting', () => {
  for (const value of ['fr', 'FR', '  fr-CA ', 'français', 'Francais', 'french', 'French (France)']) {
    test(`"${value}" reads as French`, async ($, on) => {
      const w = world(on, { env: { LANG: 'en_US' }, settings: { language: value } })
      expect(await settled($, w)).toBe('fr')
    })
  }

  for (const value of ['en', 'EN-gb', ' english ', 'anglais', 'Anglais']) {
    test(`"${value}" reads as English`, async ($, on) => {
      const w = world(on, { env: { LANG: 'fr_FR' }, settings: { language: value } })
      expect(await settled($, w)).toBe('en')
    })
  }

  for (const value of ['de', 'japanese', '', 42, true, null, ['fr'], { fr: 1 }]) {
    test(`${JSON.stringify(value)} moves on to the environment`, async ($, on) => {
      const w = world(on, { env: { LANG: 'fr_FR.UTF-8' }, settings: { language: value } })
      expect(await settled($, w)).toBe('fr')
    })
  }

  test('a read that is refused moves on, without a word', async ($, on) => {
    const w = world(on, { env: { LANG: 'fr_FR' }, settings: denies })
    expect(await settled($, w)).toBe('fr')
    expect(w.toasts).toEqual([])
  })
})

describe('the environment', () => {
  test('LC_ALL comes first', async ($, on) => {
    const w = world(on, { env: { LC_ALL: 'fr_FR', LC_MESSAGES: 'en_US', LANG: 'en_US', LANGUAGE: 'en' } })
    expect(await settled($, w)).toBe('fr')
  })

  test('then LC_MESSAGES', async ($, on) => {
    const w = world(on, { env: { LC_MESSAGES: 'fr_FR', LANG: 'en_US', LANGUAGE: 'en' } })
    expect(await settled($, w)).toBe('fr')
  })

  test('then LANG', async ($, on) => {
    const w = world(on, { env: { LANG: 'fr_FR', LANGUAGE: 'en' } })
    expect(await settled($, w)).toBe('fr')
  })

  test('then LANGUAGE', async ($, on) => {
    const w = world(on, { env: { LANGUAGE: 'fr' } })
    expect(await settled($, w)).toBe('fr')
  })

  for (const value of ['', 'C', 'POSIX', 'C.UTF-8', 'de_DE.UTF-8']) {
    test(`"${value}" says nothing: the next variable decides`, async ($, on) => {
      const w = world(on, { env: { LC_ALL: value, LC_MESSAGES: value, LANG: 'fr_FR.UTF-8' } })
      expect(await settled($, w)).toBe('fr')
    })
  }

  test('only the first of a LANGUAGE list counts', async ($, on) => {
    const w = world(on, { env: { LANGUAGE: 'fr:en' } })
    expect(await settled($, w)).toBe('fr')
  })

  test('a list led by another language says nothing', async ($, on) => {
    const w = world(on, { env: { LANGUAGE: 'de:fr' } })
    expect(await settled($, w)).toBe('en')
  })

  test('the charset gets in no one\'s way', async ($, on) => {
    const w = world(on, { env: { LANG: 'fr_CA.ISO-8859-1' } })
    expect(await settled($, w)).toBe('fr')
  })
})

describe('the culture of Windows', () => {
  const asked = (options: WorldOptions, on: any) => world(on, { env: WINDOWS, ...options })

  test('asked once of PowerShell, with no profile and within 3 s, then kept', async ($, on) => {
    const w = asked({ culture: 'fr-FR' }, on)
    expect(await settled($, w)).toBe('fr')
    expect(w.runs).toHaveLength(1)
    expect(w.runs[0].argv[0].toLowerCase()).toContain('powershell')
    expect(w.runs[0].argv).toContain('-NoProfile')
    expect(w.runs[0].init.timeoutMs).toBe(3000)
    expect(w.stored.systemCulture).toBe('fr-FR')
  })

  test('a kept culture is not asked again', async ($, on) => {
    const w = asked({ store: { systemCulture: 'fr-CH' }, culture: 'en-US' }, on)
    expect(await settled($, w)).toBe('fr')
    expect(w.runs).toEqual([])
  })

  test('the raw value is kept even when it names another language', async ($, on) => {
    const w = asked({ culture: 'de-DE' }, on)
    expect(await settled($, w)).toBe('en')
    expect(w.stored.systemCulture).toBe('de-DE')
  })

  test('an empty answer is not kept', async ($, on) => {
    const w = asked({ culture: '  ' }, on)
    expect(await settled($, w)).toBe('en')
    expect(w.storeWrites).toEqual([])
  })

  test('a failed command is not kept', async ($, on) => {
    const w = asked({ culture: () => ({ value: { exitCode: 1, stdout: 'fr-FR', stderr: '' } }) }, on)
    expect(await settled($, w)).toBe('en')
    expect(w.storeWrites).toEqual([])
  })

  test('a command that does not start falls through', async ($, on) => {
    const w = asked({ culture: denies }, on)
    expect(await settled($, w)).toBe('en')
    expect(w.toasts).toEqual([])
  })

  test('a culture that cannot be kept falls through', async ($, on) => {
    const w = asked({ culture: 'fr-FR', refuseStore: true }, on)
    expect(await settled($, w)).toBe('en')
  })

  test('a store that cannot be read falls through', async ($, on) => {
    const w = asked({ culture: 'fr-FR', refuseStoreRead: true }, on)
    expect(await settled($, w)).toBe('en')
    expect(w.commands).toHaveLength(1)
    expect(w.runs).toEqual([])
  })

  test('a repeated start does not run the chain again', async ($, on) => {
    const w = asked({ culture: 'fr-FR' }, on)
    await start($)
    await start($)
    expect(w.settingsReads).toBe(1)
    expect(w.runs).toHaveLength(1)
    expect(languageOf(w)).toBe('fr')
  })

  test('a home with no drive letter is not Windows: PowerShell is never asked', async ($, on) => {
    const w = world(on, { env: MAC, culture: 'fr-FR' })
    expect(await settled($, w)).toBe('en')
    expect(w.runs).toEqual([])
  })

  test('neither is a session with no home', async ($, on) => {
    const w = world(on, { env: {}, culture: 'fr-FR' })
    expect(await settled($, w)).toBe('en')
    expect(w.runs).toEqual([])
  })

  test('nothing known ends in English', async ($, on) => {
    const w = world(on, { env: MAC })
    expect(await settled($, w)).toBe('en')
  })
})

describe('a language already settled', () => {
  test('the host\'s language is taken back without the chain', async ($, on) => {
    const w = world(on, { env: { LANG: 'en_US' }, held: { language: 'fr' }, settings: { language: 'en' } })
    expect(await settled($, w)).toBe('fr')
    expect(w.settingsReads).toBe(0)
  })

  test('an explicit option takes over from it', { options: { language: 'en' } }, async ($, on) => {
    const w = world(on, { held: { language: 'fr' } })
    expect(await settled($, w)).toBe('en')
  })

  test('a held value that makes no sense runs the chain', async ($, on) => {
    const w = world(on, { env: { LANG: 'fr_FR' }, held: { language: 'de' } })
    expect(await settled($, w)).toBe('fr')
  })

  test('a drawing follows the state even if no session started on this load', async ($, on) => {
    world(on, { held: { language: 'en' } })
    const ui = await mountBand($, 'terminal')
    expect(await textsOf(ui)).toContain('Idle')
  })
})

describe('what the language reaches', () => {
  test('the command and the tool read in the settled language', async ($, on) => {
    const w = world(on, { env: { LANG: 'en_US' } })
    await start($)
    expect(w.commands[0].description).toBe('Shows PixelDesk: a task progress bar and a live card for each subagent')
    expect(w.tools[0].description).toContain('Stores the plan')
  })

  test('the who field cites the posts of the language', async ($, on) => {
    const w = world(on)
    await start($)
    const who = w.tools[0].inputSchema.properties.steps.items.properties.who.description
    expect(who).toContain('Chercheur, Relecteur, Testeur, Designer, Rédacteur, Analyste, Développeur')
  })

  test('and in English', async ($, on) => {
    const w = world(on, { env: { LANG: 'en_US' } })
    await start($)
    const who = w.tools[0].inputSchema.properties.steps.items.properties.who.description
    expect(who).toContain('Researcher, Reviewer, Tester, Designer, Writer, Analyst, Developer')
  })
})
