import { describe, expect, test } from 'claude-code/testing'

import { lengthIn } from './cachelength'
import { compactNow } from './compaction'
import { gather, scrubbed, slugOf, stampOf, tilde, unwrapped } from './briefing-gather'
import { ashOf, fireOf, lengthProven } from './heat'
import { en, fr } from './i18n'
import { createMemory } from './memory'

const use = (tool: string, input: object) => ({ tool, input })
const said = (role: 'user' | 'assistant', text: string, toolUses: object[] = []) => ({ role, text, toolUses }) as any
const HOME = 'C:/Users/me'

describe('the fire and the ash', () => {
  test('the fire has five states, by the share left', () => {
    const at = (share: number) => fireOf(share * 1000, 1000)
    expect([at(1), at(0.61), at(0.6), at(0.31), at(0.3), at(0.11), at(0.1), at(0.01), at(0), at(-1)]).toEqual(['full', 'full', 'medium', 'medium', 'low', 'low', 'embers', 'embers', 'out', 'out'])
  })

  test('the ash has five levels', () => {
    expect([0, 0.9, 1, 24, 25, 49, 50, 79, 80, 100].map(ashOf)).toEqual(['none', 'none', 'small', 'small', 'medium', 'medium', 'large', 'large', 'full', 'full'])
  })
})

describe('the length a request proves', () => {
  const asked = (input: number, read: number, written: number) => ({ input_tokens: input, output_tokens: 5, cache_read_input_tokens: read, cache_creation_input_tokens: written })
  const MINUTE = 60_000

  test('read past five minutes: the hour, written within the hour: five minutes', () => {
    expect(lengthProven(6 * MINUTE, asked(10, 9000, 100))).toBe('1h')
    expect(lengthProven(90 * MINUTE, asked(10, 9000, 100))).toBe('1h')
    expect(lengthProven(6 * MINUTE, asked(10, 100, 9000))).toBe('5m')
  })

  test('nothing from a short gap, a long rewrite, half a cache, or no cache at all', () => {
    expect(lengthProven(5 * MINUTE, asked(10, 9000, 100))).toBeNull()
    expect(lengthProven(60 * MINUTE, asked(10, 100, 9000))).toBeNull()
    expect(lengthProven(6 * MINUTE, asked(10, 5000, 5000))).toBeNull()
    expect(lengthProven(6 * MINUTE, asked(9000, 0, 0))).toBeNull()
    expect(lengthProven(6 * MINUTE, asked(0, 0, 0))).toBeNull()
  })
})

describe('the length in a transcript', () => {
  const line = (created: object, more: object = {}) => JSON.stringify({ type: 'assistant', message: { usage: { cache_creation: created } }, ...more })

  test('the latest answer of the main loop decides', () => {
    expect(lengthIn([line({ ephemeral_5m_input_tokens: 3 }), line({ ephemeral_1h_input_tokens: 9 })].join('\n'))).toBe('1h')
    expect(lengthIn([line({ ephemeral_1h_input_tokens: 9 }), line({ ephemeral_5m_input_tokens: 3 })].join('\n'))).toBe('5m')
  })

  test('an agent, an empty line, a broken one and a line of zeros say nothing', () => {
    const lines = [line({ ephemeral_5m_input_tokens: 3 }), line({ ephemeral_1h_input_tokens: 9 }, { isSidechain: true }), '{"ephemeral_ broken', '', line({ ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 })]
    expect(lengthIn(lines.join('\n'))).toBe('5m')
    expect(lengthIn('')).toBeNull()
    expect(lengthIn('{"type":"user"}')).toBeNull()
  })
})

describe('what is read off a conversation', () => {
  test('files by score: a change before a read, a command last, what is not the project out', () => {
    const found = gather([said('assistant', '', [
      use('Read', { file_path: 'C:/work/read.ts' }),
      use('Edit', { file_path: 'C:/work/edit.ts' }),
      use('Bash', { command: 'cat C:/Users/me/notes.md && ls' }),
      use('Read', { file_path: 'relative.ts' }),
      use('Read', { file_path: 'C:/Users/me/AppData/Local/Temp/x.txt' }),
      use('Read', { file_path: '/tmp/y' }),
      use('Write', { file_path: '~/thing.md.' }),
    ])], HOME)
    expect(found.files).toEqual(['C:/work/edit.ts', 'C:/Users/me/thing.md', 'C:/work/read.ts', 'C:/Users/me/notes.md'])
  })

  test('skills and servers, once each', () => {
    const found = gather([said('assistant', '', [use('Skill', { skill: 'review' }), use('mcp__github__list', {}), use('mcp__github__get', {}), use('Read', {})])], HOME)
    expect(found.skills).toEqual(['/review', 'MCP github'])
  })

  test('links: no local one, no final mark, no double, the latest 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => `https://sample.org/${i}`).join(' ')
    const found = gather([said('user', `voir https://b.dev/x. et http://localhost:3000 et https://sample.org/a`), said('assistant', many)], HOME)
    expect(found.links).toHaveLength(20)
    expect(found.links.at(-1)).toBe('https://sample.org/24')
    expect(gather([said('user', 'voir https://b.dev/x. http://localhost:3000')], HOME).links).toEqual(['https://b.dev/x'])
  })

  test('requests: the latest 25, on one line, without the system tags', () => {
    const list = [said('user', '<system-reminder>x</system-reminder>'), ...Array.from({ length: 30 }, (_, i) => said('user', `ask\n${i} ${'x'.repeat(400)}`))]
    const { asks } = gather(list, HOME)
    expect(asks).toHaveLength(25)
    expect(asks[0]!.startsWith('ask 5 ')).toBe(true)
    expect(asks[0]!.length).toBe(300)
  })

  test('decisions: the sentences that read as one', () => {
    const { decisions } = gather([said('assistant', 'Je lis le fichier. On garde la cheminée à gauche. Fini.')], HOME)
    expect(decisions).toEqual(['On garde la cheminée à gauche.'])
  })
})

describe('secrets', () => {
  const CASES = ['sk-abcdefghijklmnop1234', 'sk_live_abcdefghij1234', 'ghp_abcdefghijklmnopqrst1234', 'github_pat_abcdefghijklmnopqrst1234', 'xoxb-1234567890-abc', 'AIzaabcdefghijklmnopqrstuvwxyz123456', 'AKIAIOSFODNN7EXAMPLE']

  for (const secret of CASES) {
    test(`${secret.slice(0, 5)} goes`, () => {
      expect(scrubbed(`avant ${secret} après`)).toBe('avant <secret retiré> après')
    })
  }

  test('a Bearer token goes and the word stays', () => {
    expect(scrubbed('Bearer abcdefghijklmnopqrstuvwxyz')).toBe('Bearer <secret retiré>')
  })

  test('a private key goes whole', () => {
    expect(scrubbed('-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----')).toBe('<secret retiré>')
  })

  test('ordinary words stay', () => {
    expect(scrubbed('sk-short et ghp_court')).toBe('sk-short et ghp_court')
  })
})

describe('names', () => {
  test('the slug comes from the title, without accents, 48 characters at most', () => {
    expect(slugOf('# Passation : Construire le mod Déménager\n')).toBe('construire-le-mod-demenager')
    expect(slugOf('# Briefing: Build it!\n')).toBe('build-it')
    expect(slugOf('no title')).toBe('session')
    expect(slugOf(`# Briefing: ${'a'.repeat(60)}`)).toHaveLength(48)
  })

  test('the stamp is local time', () => {
    expect(stampOf(new Date(2026, 9, 30, 18, 5).getTime())).toBe('2026-10-30-1805')
  })

  test('a code block around the whole reply goes', () => {
    expect(unwrapped('```markdown\n# Briefing: x\n```')).toBe('# Briefing: x')
    expect(unwrapped('  plain  ')).toBe('plain')
  })

  test('home reads as a tilde', () => {
    expect(tilde('C:/Users/me/x.md', HOME)).toBe('~/x.md')
    expect(tilde('D:/x.md', HOME)).toBe('D:/x.md')
  })
})

describe('the texts of the two features', () => {
  test('the prompts name their sections and keep the same holes', () => {
    expect(fr['briefing.prompt']).toContain('# Passation : ')
    expect(en['briefing.prompt']).toContain('# Briefing: ')
    for (const hole of ['{cwd}', '{files}', '{skills}', '{links}', '{notes}']) {
      expect(fr['briefing.prompt']).toContain(hole)
      expect(en['briefing.prompt']).toContain(hole)
    }
  })

  test('no toast is long enough to be cut', () => {
    const toasts = ['briefing.readyToast', 'briefing.failedToast', 'briefing.compactedToast', 'briefing.compactFailed', 'briefing.started', 'briefing.pressEnter', 'briefing.startFailed', 'briefing.noFolder'] as const
    for (const key of toasts) for (const dictionary of [fr, en]) expect(dictionary[key].length).toBeLessThanOrEqual(140)
  })
})

describe('compacting in a session the app runs', () => {
  const HEADLESS = '$.session.compact: not available in a headless (-p / SDK) session yet'

  function fakeEngine(refusal: string, runs: (m: ReturnType<typeof createMemory>) => void = () => undefined) {
    const m = createMemory('fr')
    const calls: { command: string; args: string }[] = []
    const engine: any = {
      session: {
        compact: async () => {
          throw new Error(refusal)
        },
        messages: async () => [],
      },
      command: {
        compact: async (brief: string) => {
          calls.push({ command: 'compact', args: brief })
          runs(m)
        },
      },
      clock: { now: async () => 0 },
      ui: { toast: () => undefined },
    }
    return { m, engine, calls }
  }

  test('the refused call goes through /compact, with the brief, and counts once', async () => {
    const { m, engine, calls } = fakeEngine(HEADLESS, memory => {
      memory.heat.compactions += 1
    })
    expect(await compactNow(engine, m)).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.command).toBe('compact')
    expect(calls[0]!.args).toContain('notes-')
    expect(m.heat.compactions).toBe(1)
    expect(m.heat.compacting).toBe(false)
  })

  test('a /compact that left the conversation as it was is a failure', async () => {
    const { m, engine } = fakeEngine(HEADLESS)
    expect(await compactNow(engine, m)).toBe(false)
    expect(m.heat.compactions).toBe(0)
  })

  test('any other refusal stays one: no command runs over a turn', async () => {
    const { m, engine, calls } = fakeEngine('a turn is running')
    expect(await compactNow(engine, m)).toBe(false)
    expect(calls).toEqual([])
  })
})
