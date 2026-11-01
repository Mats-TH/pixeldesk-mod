import { describe, expect, test } from 'claude-code/testing'

import { scrubbed } from './briefing-gather'

describe('secrets', () => {
  const CASES = ['sk-abcdefghijklmnop1234', 'sk_live_abcdefghij1234', 'ghp_abcdefghijklmnopqrst1234', 'github_pat_abcdefghijklmnopqrst1234', 'xoxb-1234567890-abc', 'AIzaabcdefghijklmnopqrstuvwxyz123456', 'AKIAIOSFODNN7EXAMPLE']

  for (const shape of CASES) {
    test(`${shape.slice(0, 5)} goes`, () => {
      expect(scrubbed(`avant ${shape} après`)).toBe('avant <secret retiré> après')
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
