import type { EngineInterface } from 'claude-code'

import { guard, log, reason } from './disk'
import { setLanguage } from './i18n'
import type { Language } from './i18n'
import type { Memory } from './memory'
import { readLanguage, writeLanguage } from './state'

const CULTURE_KEY = 'systemCulture'
const CULTURE_TIMEOUT = 3000
const CULTURE_COMMAND = ['powershell', '-NoProfile', '-NonInteractive', '-Command', '[System.Globalization.CultureInfo]::CurrentUICulture.Name']

/** What a setting, a locale or a culture means, or null when it names neither language. */
export function recognize(value: unknown): Language | null {
  if (typeof value !== 'string') return null
  const word = value.trim().toLowerCase()
  if (word.startsWith('fr')) return 'fr'
  if (word.startsWith('en') || word === 'anglais') return 'en'
  return null
}

/** The `language` option: only `fr` and `en` are orders, `auto` and the rest leave the choice open. */
export const forcedBy = (option: unknown): Language | null => (option === 'fr' || option === 'en' ? option : null)

async function fromLocale($: EngineInterface) {
  const readers = [() => $.env.get('LC_ALL'), () => $.env.get('LC_MESSAGES'), () => $.env.get('LANG'), async () => (await $.env.get('LANGUAGE'))?.split(':')[0]]
  for (const read of readers) {
    const found = recognize(await read())
    if (found) return found
  }
  return null
}

/** Asked of PowerShell once on a machine: a failure is not kept, so the next session asks again. */
async function systemCulture($: EngineInterface) {
  const kept = await $.store.get(CULTURE_KEY)
  if (typeof kept === 'string' && kept) return kept
  const { exitCode, stdout } = await $.process.run(CULTURE_COMMAND, { timeoutMs: CULTURE_TIMEOUT })
  const culture = stdout.trim()
  if (exitCode !== 0 || !culture) return null
  await $.store.set(CULTURE_KEY, culture)
  return culture
}

/** Each step of the chain falls through to the next, whatever goes wrong in it. */
async function step($: EngineInterface, m: Memory, name: string, work: () => Promise<Language | null>) {
  try {
    return await work()
  } catch (err) {
    await log($, m, `language, ${name}: ${reason(err)}`)
    return null
  }
}

async function chain($: EngineInterface, m: Memory): Promise<Language> {
  const setting = await step($, m, 'settings', async () => recognize(await $.settings.read({ key: 'language' })))
  if (setting) return setting
  const locale = await step($, m, 'locale', () => fromLocale($))
  if (locale) return locale
  // The engine names no platform: a home on a drive letter is Windows.
  if (/^[A-Za-z]:/.test(m.home)) {
    const culture = await step($, m, 'culture', async () => recognize(await systemCulture($)))
    if (culture) return culture
  }
  return 'en'
}

/** Settles the session's language: the option, else what the host still holds, else the chain. */
export async function settleLanguage($: EngineInterface, m: Memory) {
  const held = await guard($, m, 'language, state', () => readLanguage($))
  const language = m.forced ?? recognize(held) ?? (await chain($, m))
  setLanguage(language)
  await guard($, m, 'language, state', () => writeLanguage($, language))
}
