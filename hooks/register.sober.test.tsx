import { describe, expect, test } from 'claude-code/testing'

import { getLanguage, setLanguage } from './i18n'
import { countdown, soberGauges } from './limits'
import { BENEATH, ENGLISH, NOON, SETTINGS_FILE, command, hasKey, kids, mountBand, sendPlan, spawn, start, step, world } from './test-kit'
import { soberBar, soberLines } from './view-sober'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const at = (ms: number) => new Date(ms).toISOString()

function inEnglish<T>(work: () => T) {
  const before = getLanguage()
  setLanguage('en')
  try {
    return work()
  } finally {
    setLanguage(before)
  }
}

/** A Friday at nine for the weeks, two in the afternoon for the five hours: the noon of the kit is a Tuesday. */
const FRIDAY = new Date(2026, 9, 30, 9, 0).getTime()
const TWO = new Date(2026, 9, 27, 14, 0).getTime()
const WEEK = { kind: 'seven_day', percentUsed: 42, resetsAt: at(FRIDAY) }
const FABLE = { kind: 'seven_day_fable', percentUsed: 18.4, resetsAt: at(FRIDAY) }
const FIVE = { kind: 'five_hour', percentUsed: 96, resetsAt: at(TWO) }

const allText = (el: any): string => (typeof el === 'string' ? el : (el?.children ?? []).map(allText).join(''))
const SOBER = { files: { [SETTINGS_FILE]: '{"look":"sober"}' } }

describe('the time left', () => {
  test('days, hours and minutes, as short as each reads', () => {
    expect(countdown(3 * DAY + 4 * HOUR + 32 * MINUTE)).toBe('3j 4h32')
    expect(countdown(4 * HOUR + 32 * MINUTE)).toBe('4h32')
    expect(countdown(32 * MINUTE)).toBe('32min')
  })

  test('the minutes keep two digits under an hour count, and a day with no hour says so', () => {
    expect(countdown(4 * HOUR + 5 * MINUTE)).toBe('4h05')
    expect(countdown(2 * DAY + 3 * MINUTE)).toBe('2j 0h03')
    expect(countdown(5 * MINUTE)).toBe('5min')
  })

  test('a started minute counts whole, and the last one never reads zero', () => {
    expect(countdown(59 * MINUTE + 1)).toBe('1h00')
    expect(countdown(1)).toBe('1min')
    expect(countdown(0)).toBe('1min')
  })

  test('English counts its days with a d', () => {
    expect(inEnglish(() => countdown(3 * DAY + 4 * HOUR + 32 * MINUTE))).toBe('3d 4h32')
    expect(inEnglish(() => countdown(4 * HOUR + 32 * MINUTE))).toBe('4h32')
    expect(inEnglish(() => countdown(32 * MINUTE))).toBe('32min')
  })
})

describe('which gauges', () => {
  test('one for each window the account sends: the five hours, the week of a model, the week of all', () => {
    const gauges = soberGauges([FIVE, FABLE, WEEK], NOON)
    expect(gauges.map(g => g.label)).toEqual(['5 h', 'Fable hebdo', 'Hebdo'])
    expect(gauges.map(g => g.percent)).toEqual(['96 %', '18 %', '42 %'])
    expect(gauges.map(g => g.left)).toEqual(['2h00', '2j 21h00', '2j 21h00'])
    expect(gauges.map(g => g.at)).toEqual(['14:00', 'ven 9h', 'ven 9h'])
  })

  test('the order holds whatever order the engine sends them in, and with one missing', () => {
    const kinds = (list: (typeof WEEK)[]) => soberGauges(list, NOON).map(g => g.kind)
    const all = ['five_hour', 'seven_day_fable', 'seven_day']
    for (const sent of [[WEEK, FABLE, FIVE], [FABLE, WEEK, FIVE], [WEEK, FIVE, FABLE], [FIVE, WEEK, FABLE]]) expect(kinds(sent)).toEqual(all)
    expect(kinds([WEEK, FIVE])).toEqual(['five_hour', 'seven_day'])
    expect(kinds([WEEK, FABLE])).toEqual(['seven_day_fable', 'seven_day'])
    expect(kinds([FABLE, FIVE])).toEqual(['five_hour', 'seven_day_fable'])
  })

  test('a window the account does not have has no gauge', () => {
    expect(soberGauges([WEEK], NOON).map(g => g.kind)).toEqual(['seven_day'])
    expect(soberGauges([WEEK, FIVE], NOON).map(g => g.kind)).toEqual(['five_hour', 'seven_day'])
    expect(soberGauges([], NOON)).toEqual([])
  })

  test('any other week of its own shows under its name, whatever the engine calls it', () => {
    const [gauge] = soberGauges([{ kind: 'seven_day_opus_plan', percentUsed: 7, resetsAt: at(FRIDAY) }], NOON)
    expect(gauge?.label).toBe('Opus plan hebdo')
    expect(inEnglish(() => soberGauges([FABLE, WEEK], NOON).map(g => g.label))).toEqual(['Fable weekly', 'Weekly'])
  })

  test('what is no such window stays out: a spend limit, a kind named twice, a window past its reset', () => {
    const spend = { kind: 'spend_limit', percentUsed: 120 }
    const twice = { kind: 'seven_day', percentUsed: 99, resetsAt: at(FRIDAY) }
    const past = { kind: 'five_hour', percentUsed: 80, resetsAt: at(NOON - HOUR) }
    const gauges = soberGauges([spend, WEEK, twice, past], NOON)
    expect(gauges.map(g => [g.kind, g.used])).toEqual([['seven_day', 42]])
  })

  test('the mark is the time spent in the window, and unknown without a reset', () => {
    const [five] = soberGauges([{ kind: 'five_hour', percentUsed: 10, resetsAt: at(NOON + 2.5 * HOUR) }], NOON)
    expect(five?.mark).toBe(50)
    const [week] = soberGauges([{ kind: 'seven_day_fable', percentUsed: 10, resetsAt: at(NOON + 84 * HOUR) }], NOON)
    expect(week?.mark).toBe(50)
    const [bare] = soberGauges([{ kind: 'seven_day', percentUsed: 104.6 }], NOON)
    expect(bare).toMatchObject({ used: 100, mark: null, percent: '105 %', left: '', at: '' })
  })

  test('English writes its percent closed up and its week on a twelve-hour clock', () => {
    const [week] = inEnglish(() => soberGauges([WEEK], NOON))
    expect(week).toMatchObject({ label: 'Weekly', percent: '42%', left: '2d 21h00', at: 'Fri 9am' })
  })
})

describe('the bar', () => {
  const gauge = (used: number, mark: number | null) => ({ kind: 'seven_day', label: 'Hebdo', used, mark, percent: '', left: '', at: '' })

  test('orange up to what is used, under the pace', () => {
    const source = soberBar(gauge(40, 55), 200)
    expect(source).toContain('<rect y="2" width="80" height="4" fill="#D97757"/>')
    expect(source).not.toContain('#CF4A4A')
    expect(source).toContain('<rect x="110" y="0" width="1" height="8" fill="#87867F"/>')
  })

  test('past the pace the orange stops at the mark and the rest is red', () => {
    const source = soberBar(gauge(71, 55), 200)
    expect(source).toContain('<rect y="2" width="110" height="4" fill="#D97757"/>')
    expect(source).toContain('<rect x="110" y="2" width="32" height="4" fill="#CF4A4A"/>')
  })

  test('with no mark it is all orange, and no hairline', () => {
    const source = soberBar(gauge(30, null), 200)
    expect(source).toContain('width="60" height="4" fill="#D97757"')
    expect(source).not.toContain('height="8" fill="#87867F"')
    expect(source).not.toContain('#CF4A4A')
  })

  test('what is used is round at both ends and straight where orange meets red; the track and the mark stay as they are', () => {
    const source = soberBar(gauge(71, 55), 200)
    expect(source).toContain('<clipPath id="used"><rect y="2" width="142" height="4" rx="2"/></clipPath>')
    expect(source).toContain('<g clip-path="url(#used)"><rect y="2" width="110" height="4" fill="#D97757"/><rect x="110" y="2" width="32" height="4" fill="#CF4A4A"/></g>')
    expect(source).toContain('<rect y="2" width="200" height="4" rx="2" fill="#87867F" fill-opacity="0.3"/>')
    expect(soberBar(gauge(40, 55), 200)).toContain('<clipPath id="used"><rect y="2" width="80" height="4" rx="2"/></clipPath>')
  })

  test('it never moves: no animation in its drawing', () => {
    expect(soberBar(gauge(71, 55), 200)).not.toMatch(/animate|<style|@keyframes/)
  })
})

describe('how many lines', () => {
  const gauges = soberGauges([WEEK, FABLE, FIVE], NOON)

  test('one line with room, the name over its values with less, the reset on a third line when narrow', () => {
    expect(soberLines(gauges, 30)).toBe(1)
    expect(soberLines(gauges, 20)).toBe(2)
    expect(soberLines(gauges, 12)).toBe(3)
  })
})

describe('/pixeldesk look', () => {
  test('pixel art is the default, and the command says so', async ($, on) => {
    const w = world(on)
    await start($)
    expect((await command($, 'look')).text).toBe('Apparence : Pixel. Change-la avec /pixeldesk look pixel ou /pixeldesk look sober.')
    expect('look' in w.state).toBe(false)
    const ui = await mountBand($)
    expect(await hasKey(ui, 'idle-band')).toBe(true)
    expect(await hasKey(ui, 'sober-band')).toBe(false)
  })

  test('sober writes the setting, closes the pane and answers', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"theme":"nature"}' } })
    await start($)
    const answer = await command($, 'look sober')
    expect(answer.text).toBe('Apparence réglée sur Sobre.')
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'nature', look: 'sober' })
    expect(w.state.look).toBe('sober')
    expect(w.closed).toEqual(['pixeldesk'])
  })

  test('back to pixel the key leaves the file and the pane opens again', async ($, on) => {
    const w = world(on, SOBER)
    await start($)
    expect(w.opened, 'no pane at the start').toHaveLength(0)
    const answer = await command($, 'look pixel')
    expect(answer.text).toBe('Apparence réglée sur Pixel.')
    expect(w.json(SETTINGS_FILE)).toEqual({})
    expect(w.state.look).toBe('pixel')
    expect(w.opened).toHaveLength(1)
  })

  test('an unknown value changes nothing', async ($, on) => {
    const w = world(on)
    await start($)
    expect((await command($, 'look dark')).text).toBe('Valeur inconnue. Utilise /pixeldesk look pixel ou /pixeldesk look sober.')
    expect(w.file(SETTINGS_FILE)).toBeUndefined()
  })

  test('in English', async ($, on) => {
    world(on, { env: ENGLISH })
    await start($)
    expect((await command($, 'look sober')).text).toBe('The look is now Sober.')
    expect((await command($, 'look')).text).toBe('Look: Sober. Change it with /pixeldesk look pixel or /pixeldesk look sober.')
  })

  test('the setting of another conversation is followed within three seconds', async ($, on) => {
    const w = world(on)
    await start($)
    const ui = await mountBand($)
    w.files.set('/Users/test/.claude/pixeldesk/settings.json', '{"look":"sober"}')
    await w.clock.advance(3000)
    expect(await hasKey(ui, 'sober-band')).toBe(true)
    expect(w.closed).toEqual(['pixeldesk'])
  })
})

describe('the sober look', () => {
  test('no pane: not at the start, not for an agent, not on demand', async ($, on) => {
    const w = world(on, SOBER)
    await start($)
    await spawn($, w, 'a1')
    expect(w.opened).toHaveLength(0)
    expect((await command($)).text).toBe('Apparence sobre : le panneau reste fermé. Reviens au pixel art avec /pixeldesk look pixel.')
    expect((await command($, 'show')).text).toBe('Apparence sobre : le panneau reste fermé. Reviens au pixel art avec /pixeldesk look pixel.')
    expect(w.opened).toHaveLength(0)
  })

  test('the card: a column for each limit, its text over its bar, in the colours of the theme', async ($, on) => {
    world(on, { ...SOBER, limits: [FIVE, WEEK, FABLE] })
    await start($)
    const ui = await mountBand($)
    const card = await ui.find({ key: 'sober-band' })
    expect(card.props).toMatchObject({ flexDirection: 'row', borderStyle: 'round', borderColor: 'promptBorder' })
    const columns = kids(card)
    expect(columns.map((c: any) => c.props.key)).toEqual(['sober-five_hour', 'sober-seven_day_fable', 'sober-seven_day'])
    expect(new Set(columns.map((c: any) => c.props.width)).size, 'columns of one width').toBe(1)
    expect(columns.map((c: any) => allText(kids(c)[0]))).toEqual(['5 h 96 % · 2h00 · 14:00', 'Fable hebdo 18 % · 2j 21h00 · ven 9h', 'Hebdo 42 % · 2j 21h00 · ven 9h'])
    for (const column of columns) {
      const drawn = kids(column)
      expect(drawn.map((el: any) => el.type)).toEqual(['Text', 'Svg'])
      expect(drawn[1].props).toMatchObject({ height: 8, width: column.props.width * 8 })
      expect(drawn[1].props.isInteractive).toBeUndefined()
    }
    expect(kids(columns[2])[1].props.alt).toBe('Hebdo : 42 %')
  })

  test('nothing else is drawn: no plan, no world, no pixel band', async ($, on) => {
    world(on, { ...SOBER, limits: [WEEK] })
    await start($)
    await sendPlan($, [step('Poser les questions', 'in_progress')], 'Mode sobre')
    const ui = await mountBand($)
    for (const key of ['plan-band', 'idle-band', 'overview-band']) expect(await hasKey(ui, key), key).toBe(false)
    const text = JSON.stringify(await ui.drawn())
    expect(text).not.toContain('Poser les questions')
    expect(text).not.toContain('Mode sobre')
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(1)
  })

  test('a narrow card breaks every column the same way', async ($, on) => {
    world(on, { ...SOBER, limits: [FIVE, WEEK, FABLE] })
    await start($)
    const ui = await mountBand($, 'desktop', { bodyColumns: 45 })
    const columns = kids(await ui.find({ key: 'sober-band' }))
    expect(columns.map((c: any) => kids(c).map((el: any) => (el.type === 'Text' ? allText(el) : el.type)))).toEqual([
      ['5 h', '96 % · 2h00', '14:00', 'Svg'],
      ['Fable hebdo', '18 % · 2j 21h00', 'ven 9h', 'Svg'],
      ['Hebdo', '42 % · 2j 21h00', 'ven 9h', 'Svg'],
    ])
  })

  test('before the first reading the card says it waits', async ($, on) => {
    world(on, SOBER)
    await start($)
    const ui = await mountBand($)
    expect(allText(await ui.find({ key: 'sober-band' }))).toBe('Limites en attente')
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
  })

  test('each minute moves the time left', { timeoutMs: 30000 }, async ($, on) => {
    const w = world(on, { ...SOBER, limits: [WEEK] })
    await start($)
    const ui = await mountBand($)
    expect(allText(await ui.find({ key: 'sober-seven_day' }))).toContain('2j 21h00')
    await w.clock.advance(MINUTE)
    expect(allText(await ui.find({ key: 'sober-seven_day' }))).toContain('2j 20h59')
  })

  test("another mod's drawing stays above the card, and a survey takes the place", async ($, on) => {
    world(on, { ...SOBER, limits: [WEEK] })
    await start($)
    const ui = await mountBand($)
    expect(kids(await ui.drawn())[0].children).toEqual([BENEATH])
    expect(await hasKey(ui, 'sober-band')).toBe(true)
    const survey = await mountBand($, 'desktop', { hasSurvey: true })
    expect(await hasKey(survey, 'sober-band')).toBe(false)
  })

  test('on the terminal a row for each limit, in cells', async ($, on) => {
    world(on, { ...SOBER, limits: [WEEK, FIVE] })
    await start($, 'terminal')
    const ui = await mountBand($, 'terminal')
    const rows = kids(await ui.find({ key: 'sober-band' }))
    expect(rows.map((r: any) => r.props.key)).toEqual(['sober-five_hour', 'sober-seven_day'])
    expect(allText(kids(rows[1])[0])).toBe('Hebdo')
    expect(allText(kids(rows[1])[3])).toBe('2j 21h00 · ven 9h')
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(0)
  })

  test('in English', async ($, on) => {
    world(on, { ...SOBER, env: ENGLISH, limits: [WEEK, FABLE] })
    await start($)
    const ui = await mountBand($)
    const columns = kids(await ui.find({ key: 'sober-band' }))
    expect(columns.map((c: any) => allText(kids(c)[0]))).toEqual(['Fable weekly 18% · 2d 21h00 · Fri 9am', 'Weekly 42% · 2d 21h00 · Fri 9am'])
  })
})
