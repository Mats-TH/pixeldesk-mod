import { describe, expect, test } from 'claude-code/testing'

import { getLanguage, setLanguage } from './i18n'
import { countdown, soberGauges } from './limits'
import { BENEATH, ENGLISH, NOON, SETTINGS_FILE, command, hasKey, kids, mountBand, sendPlan, spawn, start, step, world } from './test-kit'
import { SOBER_BREAK, soberLayout, soberLines, soberStretches } from './view-sober'

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

  test('orange up to what is used, then the track, the mark where the pace is', () => {
    expect(soberStretches(gauge(40, 55))).toEqual([{ ink: 'orange', share: 40 }, { ink: 'track', share: 15 }, { ink: 'mark' }, { ink: 'track', share: 45 }])
  })

  test('past the pace the orange stops at the mark and the rest is red', () => {
    expect(soberStretches(gauge(71, 55))).toEqual([{ ink: 'orange', share: 55 }, { ink: 'mark' }, { ink: 'red', share: 16 }, { ink: 'track', share: 29 }])
  })

  test('with no mark it is all orange, and no hairline', () => {
    expect(soberStretches(gauge(30, null))).toEqual([{ ink: 'orange', share: 30 }, { ink: 'track', share: 70 }])
  })

  test('an empty stretch is left out: nothing used, everything used, right on the pace', () => {
    expect(soberStretches(gauge(0, 20))).toEqual([{ ink: 'track', share: 20 }, { ink: 'mark' }, { ink: 'track', share: 80 }])
    expect(soberStretches(gauge(100, 60))).toEqual([{ ink: 'orange', share: 60 }, { ink: 'mark' }, { ink: 'red', share: 40 }])
    expect(soberStretches(gauge(50, 50))).toEqual([{ ink: 'orange', share: 50 }, { ink: 'mark' }, { ink: 'track', share: 50 }])
  })
})

describe('how the card lays out', () => {
  const gauges = soberGauges([WEEK, FABLE, FIVE], NOON)

  test('one line with room, the name over its values with less, the reset on a third line, then nothing fits', () => {
    expect(soberLines(gauges, 30)).toBe(1)
    expect(soberLines(gauges, 20)).toBe(2)
    expect(soberLines(gauges, 12)).toBe(3)
    expect(soberLines(gauges, 8)).toBe(null)
  })

  test('side by side while every column holds its text', () => {
    expect(soberLayout(gauges, 100)).toEqual({ stacked: false, lines: 1 })
    expect(soberLayout(gauges, 60)).toEqual({ stacked: false, lines: 3 })
    expect(soberLayout(gauges, SOBER_BREAK)).toEqual({ stacked: false, lines: 3 })
  })

  test('under the break, one above the other, each on the whole width', () => {
    expect(SOBER_BREAK).toBe(48)
    expect(soberLayout(gauges, SOBER_BREAK - 1)).toEqual({ stacked: true, lines: 1 })
    expect(soberLayout(gauges, 30)).toEqual({ stacked: true, lines: 2 })
  })

  test('a name too long for its column stacks the gauges above the break too', () => {
    const long = soberGauges([WEEK, { kind: 'seven_day_a_very_long_model_name', percentUsed: 5, resetsAt: at(FRIDAY) }, FIVE], NOON)
    expect(soberLayout(long, 60)).toEqual({ stacked: true, lines: 1 })
    expect(soberLayout(long, 120)).toEqual({ stacked: false, lines: 2 })
  })

  test('a single gauge has the whole card', () => {
    expect(soberLayout(soberGauges([WEEK], NOON), 60)).toEqual({ stacked: false, lines: 1 })
  })
})

describe('/pixeldesk theme Sobre and Pixel', () => {
  const NAMES = 'cosy, japonais, nature, futuriste, geek, base'

  test('pixel art is the default, and the command says so with the room theme', async ($, on) => {
    const w = world(on)
    await start($)
    expect((await command($, 'theme')).text).toBe(`Thème : Pixel (Cosy). Change-le avec /pixeldesk theme suivi de Pixel, Sobre ou d’un thème de pièce : ${NAMES}.`)
    expect('look' in w.state).toBe(false)
    const ui = await mountBand($)
    expect(await hasKey(ui, 'idle-band')).toBe(true)
    expect(await hasKey(ui, 'sober-band')).toBe(false)
  })

  test('Sobre writes the setting, closes the pane and answers; the room theme stays', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"theme":"nature"}' } })
    await start($)
    const answer = await command($, 'theme Sobre')
    expect(answer.text).toBe('Thème réglé sur Sobre : une simple carte des limites, sans pixel art.')
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'nature', look: 'sober' })
    expect(w.state.look).toBe('sober')
    expect(w.closed).toEqual(['pixeldesk'])
    expect((await command($, 'theme')).text).toBe(`Thème : Sobre. Change-le avec /pixeldesk theme suivi de Pixel, Sobre ou d’un thème de pièce : ${NAMES}.`)
  })

  for (const word of ['sobre', 'Sobre', 'SOBRE', 'sober', 'Sober']) {
    test(`${word} is the sober theme, whatever its case or its language`, async ($, on) => {
      const w = world(on)
      await start($)
      await command($, `theme ${word}`)
      expect(w.json(SETTINGS_FILE)).toEqual({ look: 'sober' })
      expect(w.state.look).toBe('sober')
    })
  }

  for (const word of ['pixel', 'Pixel', 'PIXEL']) {
    test(`${word} brings the pixel art back with the room theme last chosen`, async ($, on) => {
      const w = world(on, { files: { [SETTINGS_FILE]: '{"theme":"nature","look":"sober"}' } })
      await start($)
      expect(w.opened, 'no pane at the start').toHaveLength(0)
      const answer = await command($, `theme ${word}`)
      expect(answer.text).toBe('Thème réglé sur Pixel (Nature).')
      expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'nature' })
      expect(w.state.look).toBe('pixel')
      expect(w.state.settings.theme).toBe('nature')
      expect(w.opened).toHaveLength(1)
    })
  }

  test('Pixel in pixel art changes nothing', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"theme":"geek"}' } })
    await start($)
    expect((await command($, 'theme Pixel')).text).toBe('Thème réglé sur Pixel (Geek et jeu).')
    expect(w.file(SETTINGS_FILE)).toBe('{"theme":"geek"}')
    expect(w.opened).toHaveLength(1)
    expect('look' in w.state).toBe(false)
  })

  test('a room theme from the sober theme sets it and brings the pixel art back', async ($, on) => {
    const w = world(on, { files: { [SETTINGS_FILE]: '{"theme":"nature","look":"sober"}' } })
    await start($)
    const answer = await command($, 'theme Geek')
    expect(answer.text).toBe('Thème réglé sur Geek et jeu.')
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'geek' })
    expect(w.state.look).toBe('pixel')
    expect(w.state.settings.theme).toBe('geek')
    expect(w.opened).toHaveLength(1)
    const ui = await mountBand($)
    expect(await hasKey(ui, 'sober-band')).toBe(false)
  })

  test('a room theme in pixel art works as before', async ($, on) => {
    const w = world(on)
    await start($)
    expect((await command($, 'theme nature')).text).toBe('Thème réglé sur Nature.')
    expect(w.json(SETTINGS_FILE)).toEqual({ theme: 'nature' })
    expect('look' in w.state).toBe(false)
  })

  test('an unknown value changes nothing and lists the choices', async ($, on) => {
    const w = world(on)
    await start($)
    expect((await command($, 'theme dark')).text).toBe(`Thème inconnu. Choisis parmi Pixel, Sobre ou un thème de pièce : ${NAMES}.`)
    expect(w.file(SETTINGS_FILE)).toBeUndefined()
  })

  test('look is no command any more', async ($, on) => {
    const w = world(on)
    await start($)
    expect((await command($, 'look sober')).text).toContain('Option inconnue')
    expect(w.file(SETTINGS_FILE)).toBeUndefined()
  })

  test('in English', async ($, on) => {
    world(on, { env: ENGLISH })
    await start($)
    expect((await command($, 'theme Sober')).text).toBe('The theme is now Sober: one plain card of limits, with no pixel art.')
    expect((await command($, 'theme')).text).toBe(`Theme: Sober. Change it with /pixeldesk theme and Pixel, Sober or a room theme: ${NAMES}.`)
    expect((await command($)).text).toBe('Sober theme: the panel stays closed. Go back to pixel art with /pixeldesk theme Pixel.')
    expect((await command($, 'theme Pixel')).text).toBe('The theme is now Pixel (Cosy).')
    expect((await command($, 'theme dark')).text).toBe(`Unknown theme. Choose from Pixel, Sober or a room theme: ${NAMES}.`)
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
    expect((await command($)).text).toBe('Thème Sobre : le panneau reste fermé. Reviens au pixel art avec /pixeldesk theme Pixel.')
    expect((await command($, 'show')).text).toBe('Thème Sobre : le panneau reste fermé. Reviens au pixel art avec /pixeldesk theme Pixel.')
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
    expect(columns.map((c: any) => allText(kids(c)[0]))).toEqual(['5 h 96 % · 2h00 · 14:00', 'Fable hebdo 18 % · 2j 21h00 · ven 9h', 'Hebdo 42 % · 2j 21h00 · ven 9h'])
    // The app keeps no key on a Text or an Svg: they are told by their type.
    for (const column of columns) expect(kids(column).map((el: any) => (el.type === 'Box' ? el.props.key : el.type))).toEqual(['Text', 'bar'])
  })

  test('nothing has a width of its own: the columns share the card evenly and each stretch of a bar grows by its share', async ($, on) => {
    world(on, { ...SOBER, limits: [WEEK] })
    await start($)
    const ui = await mountBand($)
    const column = await ui.find({ key: 'sober-seven_day' })
    expect(column.props).toMatchObject({ flexDirection: 'column', flexGrow: 1, width: 0 })
    const bar = kids(column)[1]
    expect(bar.props).toMatchObject({ flexDirection: 'row', alignItems: 'center' })
    expect(bar.props.width).toBeUndefined()
    const stretches = kids(bar).filter((el: any) => el.type === 'Box')
    // Tuesday noon, a week that ends Friday at nine: 99 of 168 hours are spent, so the pace stands at 58.9 %.
    expect(stretches.map((el: any) => [el.props.key, el.props.backgroundColor])).toEqual([['orange-0', '#D97757'], ['track-1', '#87867F4D'], ['mark', '#87867F'], ['track-3', '#87867F4D']])
    expect(stretches[0].props).toMatchObject({ flexGrow: 42, width: 0 })
    expect(Math.round(stretches[1].props.flexGrow + stretches[3].props.flexGrow)).toBe(58)
    expect(stretches[2].props.flexGrow).toBeUndefined()
    for (const el of kids(bar).filter((el: any) => el.type === 'Svg')) expect(el.props).toMatchObject({ width: 2, height: 4, alt: 'Hebdo : 42 %' })
  })

  test('what is used is round at both ends, straight where orange meets red, and the track ends round too', async ($, on) => {
    world(on, { ...SOBER, limits: [FIVE] })
    await start($)
    const ui = await mountBand($)
    // Two hours left of five: the pace stands at 60 %, and 96 % is used.
    const bar = kids(await ui.find({ key: 'sober-five_hour' }))[1]
    expect(kids(bar).map((el: any) => (el.type === 'Box' ? el.props.key : el.type))).toEqual(['Svg', 'orange-0', 'mark', 'red-2', 'Svg', 'track-3', 'Svg'])
    const [head, used, tail] = kids(bar).filter((el: any) => el.type === 'Svg').map((el: any) => el.props.source)
    const caps = { start: head, used, end: tail }
    expect(caps.start).toContain('<path d="M2 0A2 2 0 0 0 2 4Z" fill="#D97757"/>')
    expect(caps.used).toContain('<rect width="2" height="4" fill="#87867F4D"/><path d="M0 0A2 2 0 0 1 0 4Z" fill="#CF4A4A"/>')
    expect(caps.end).toContain('<path d="M0 0A2 2 0 0 1 0 4Z" fill="#87867F4D"/>')
    for (const source of Object.values(caps)) expect(source).not.toMatch(/animate|<style|@keyframes/)
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
    for (const svg of await ui.findAll({ type: 'Svg' })) expect(svg.props.width, 'only the ends of a bar are drawn').toBe(2)
  })

  test('with less room the columns break their text the same way, and nothing is cut', async ($, on) => {
    world(on, { ...SOBER, limits: [FIVE, WEEK, FABLE] })
    await start($)
    const ui = await mountBand($, 'desktop', { bodyColumns: 60 })
    const card = await ui.find({ key: 'sober-band' })
    expect(card.props.flexDirection).toBe('row')
    expect(kids(card).map((c: any) => kids(c).map((el: any) => (el.type === 'Text' ? allText(el) : el.props.key)))).toEqual([
      ['5 h', '96 % · 2h00', '14:00', 'bar'],
      ['Fable hebdo', '18 % · 2j 21h00', 'ven 9h', 'bar'],
      ['Hebdo', '42 % · 2j 21h00', 'ven 9h', 'bar'],
    ])
    for (const text of await ui.findAll({ type: 'Text' })) if (text.props.wrap) expect(text.props.wrap).toBe('wrap')
  })

  test('under the break the gauges stand one above the other, each on the whole width', async ($, on) => {
    world(on, { ...SOBER, limits: [FIVE, WEEK, FABLE] })
    await start($)
    const ui = await mountBand($, 'desktop', { bodyColumns: 45 })
    const card = await ui.find({ key: 'sober-band' })
    expect(card.props).toMatchObject({ flexDirection: 'column', borderStyle: 'round' })
    const stacked = kids(card)
    expect(stacked.map((c: any) => kids(c).map((el: any) => (el.type === 'Text' ? allText(el) : el.props.key)))).toEqual([
      ['5 h 96 % · 2h00 · 14:00', 'bar'],
      ['Fable hebdo 18 % · 2j 21h00 · ven 9h', 'bar'],
      ['Hebdo 42 % · 2j 21h00 · ven 9h', 'bar'],
    ])
    for (const gauge of stacked) {
      expect(gauge.props.width).toBeUndefined()
      expect(gauge.props.flexGrow).toBeUndefined()
    }
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
