import type { Briefing, BriefingPhase, PlanStatus } from '../types'
import { AFTER_MEDAL, BIG, BIG_LINE, BROWN, CHIP_H, DEEP, GAP, GOLD, INK, INNER, LEFT, MEDAL_H, MEDAL_W, PLATE, PLATE_PAD, SCREW, SHADOW, SMALL, SMALL_LINE, TITLE, WIDE, WON, WOOD, WOOD_DARK, box, cardBack, cardDocument, cardHeight, cardScrews, chipParts, fitted, medalBack, textTop, writer } from './card'
import type { DrawnCard } from './card'
import { plural, t } from './i18n'
import type { TextKey } from './i18n'
import { canvas, paths } from './pixel/canvas'
import { caseEtape } from './pixel/decor'
import { SHARP, fit, textWidth, wrap } from './pixel/font'
import { envelope } from './pixel/hearth'
import type { EnvelopeState } from './pixel/hearth'
import { letterDefs, line, railPaths } from './room'

type Phase = Exclude<BriefingPhase, 'idle'>

/** A button of the row or the card. `label`: what it says to a reader, as much as there is. `drawn`: the words of its image. */
export type BriefingButton = { key: string; label: string; drawn: string; primary: boolean }
/** A button once placed, on one line from the left of its drawing. */
export type PlacedButton = BriefingButton & { x: number; w: number }
export type BriefingRow = { source: string; alt: string; width: number; height: number; buttons: PlacedButton[] }
/** The card of the briefing. `buttons`: where the card draws its own, in the pixels of its full size. */
export type BriefingCard = DrawnCard & { buttons: (PlacedButton & { y: number })[] }

const CHIP_DARK = '#2A2036'
const CHIP_SOFT = '#544B70'
const RED = '#B8452A'
const CREAM = '#FFF6DE'
const LIGHT_TEAL = '#7FE0C8'
const LIGHT_COLD = '#9DB4FF'
const HIGHLIGHT = '#FFDF8F'
const STEP_INK = '#3A2E33'
const STEP_DONE_INK = '#7A6A5E'
const RAIL_DONE = '#5FC9B8'

const STEP_KEYS: readonly TextKey[] = ['briefing.step1', 'briefing.step2', 'briefing.step3', 'briefing.step4', 'briefing.step5']
const STEP_H = 17
const STEP_GAP = 2
const STEP_LABEL_X = 18
const STEP_BOX_X = 2
const STEP_BOX_Y = 4
const STEP_PAD = 20
const LINE_ROWS = 3
const ENVELOPE_X = 8
const ENVELOPE_Y = 15

// The row of the design: 34 tall, the words at the size that stays sharp, the buttons against the right edge.
const ROW_H = 34
const ROW_PLATE = 4
const ROW_ICON_X = 10
const ROW_ICON_Y = 6
const ROW_TEXT_X = 46
const ROW_TEXT_Y = 7
const ROW_TEXT_LINE = 20
const ROW_RIGHT = 10
const ROW_GAP = 8
const ROW_MIN_TEXT = 40
const BUTTON_Y = 5
const BUTTON_H = 24
const BUTTON_PAD = 10
const BUTTON_LINE = 18
const BUTTON_TEXT_Y = 3
const CARD_BUTTON_GAP = 6
const GAUGE_W = 104
const GAUGE_H = 8
const GAUGE_Y = 13

const CHIPS: Record<Phase, { label: TextKey; chip: string; light: string }> = {
  offered: { label: 'briefing.chip.offered', chip: CHIP_SOFT, light: GOLD },
  waiting: { label: 'briefing.chip.waiting', chip: CHIP_SOFT, light: LIGHT_COLD },
  writing: { label: 'briefing.chip.writing', chip: CHIP_DARK, light: LIGHT_TEAL },
  ready: { label: 'briefing.chip.ready', chip: '#3E7A4C', light: LIGHT_TEAL },
  failed: { label: 'briefing.chip.failed', chip: RED, light: CREAM },
}

const ENVELOPES: Record<Phase, EnvelopeState> = { offered: 'discreet', waiting: 'waiting', writing: 'discreet', ready: 'bright', failed: 'discreet' }

const phaseOf = (view: Briefing): Phase => (view.phase === 'idle' ? 'offered' : view.phase)
const countOf = (view: Briefing) => view.waitingAgents + view.waitingChats

/** The work a briefing waits for, in words: "2 agents et 1 conversation". */
function jobs({ waitingAgents: agents, waitingChats: chats }: Briefing) {
  const said = [agents ? plural('briefing.jobs.agents', agents, { n: agents }) : '', chats ? plural('briefing.jobs.chats', chats, { n: chats }) : '']
  return said[0] && said[1] ? t('briefing.jobs.both', { agents: said[0], chats: said[1] }) : said[0] || said[1] || ''
}

const carryOn = (view: Briefing) => plural('briefing.carryOn', countOf(view), { jobs: jobs(view) })

const stepWord = (view: Briefing) => t(STEP_KEYS[view.step] ?? 'briefing.step1')

/** The one line of what goes on, in the row and under the steps of the card. Empty: the card says nothing more. */
function lineOf(view: Briefing, inRow: boolean) {
  if (view.phase === 'waiting') {
    if (!countOf(view)) return t('briefing.waitingTurn')
    if (view.urgent) return inRow ? t('briefing.row.urgent', { carryOn: carryOn(view) }) : carryOn(view)
    return t('briefing.after', { jobs: jobs(view) })
  }
  if (view.phase === 'ready') return view.note || t('briefing.row.ready')
  if (view.phase === 'failed') return [t('briefing.titleFailed', { error: view.error }), view.note].filter(Boolean).join(' ')
  if (!inRow) return ''
  return view.phase === 'writing' ? t('briefing.row.writing', { step: stepWord(view) }) : t('briefing.row.offer')
}

const said = (key: string, text: TextKey, primary = false): BriefingButton => ({ key, label: t(text), drawn: t(text), primary })

function nowButton(view: Briefing): BriefingButton {
  const n = countOf(view)
  return { key: 'briefing-now', label: plural('briefing.button.now', n, { n }), drawn: t('briefing.button.nowShort'), primary: view.urgent }
}

/** The buttons of a phase, on every surface. The keys are the gestures: a press goes by its key. */
export function briefingButtons(view: Briefing): BriefingButton[] {
  if (view.opening) return []
  const [copy, open, close] = [said('briefing-copy', 'briefing.button.copy'), said('briefing-open', 'briefing.button.open'), said('briefing-close', 'briefing.button.close')]
  if (view.phase === 'offered') return [said('briefing-change', 'briefing.button.move', true), said('briefing-cancel', 'briefing.button.close')]
  if (view.phase === 'waiting') return [nowButton(view), said('briefing-cancel', 'briefing.button.cancel')]
  if (view.phase === 'writing') return [close]
  if (view.phase === 'ready') return [said('briefing-start', 'briefing.button.start', true), copy, open, close]
  if (view.phase === 'failed') return [said('briefing-retry', 'briefing.button.retry', true), ...(view.file ? [copy, open] : []), close]
  return []
}

const buttonW = (b: BriefingButton) => Math.ceil(textWidth(b.drawn, SHARP)) + 1 + BUTTON_PAD * 2

/** A button from its top left corner: gold and dark when it is the one to press. */
function buttonBody(b: PlacedButton) {
  const [edge, back] = b.primary ? [WOOD_DARK, GOLD] : [SCREW, CREAM]
  return `${box(0, 0, b.w, BUTTON_H, edge)}${box(2, 2, b.w - 4, BUTTON_H - 4, back)}${line(b.drawn, BUTTON_PAD, textTop(BUTTON_TEXT_Y, SHARP, BUTTON_LINE), SHARP, INK)}`
}

const at = (x: number, y: number, body: string) => `<g transform="translate(${x} ${y})">${body}</g>`

/** The letter, 28 by 22, with its hourglass or its halo. */
const letter = (phase: Phase, x: number, y: number) => at(x, y, envelope(ENVELOPES[phase]).svg)

// ---------- The card ----------

type Row = { text: string; status: PlanStatus | 'failed' }

/** The five steps, as far as the phase went. */
function stepsOf(view: Briefing): Row[] {
  const reached = view.phase === 'ready' ? STEP_KEYS.length : view.phase === 'writing' || view.phase === 'failed' ? view.step : 0
  const live = view.phase === 'writing' ? 'in_progress' : view.phase === 'failed' ? 'failed' : 'pending'
  return STEP_KEYS.map((key, i) => ({ text: t(key), status: i < reached ? 'completed' : i === reached ? live : 'pending' }))
}

function stepBox(status: Row['status']) {
  if (status !== 'failed') return paths(caseEtape(status), 2)
  const c = canvas(5, 5)
  c.rect(0, 0, 5, 5, INK)
  c.rect(1, 1, 3, 3, RED)
  return paths(c, 2)
}

const STEP_WORDS: Record<Row['status'], string> = { completed: STEP_DONE_INK, in_progress: INK, pending: STEP_INK, failed: INK }

function taskOf(view: Briefing) {
  if (view.phase === 'waiting' && view.urgent) return t('briefing.card.urgent')
  if (view.phase === 'waiting') return t(countOf(view) ? 'briefing.card.waiting' : 'briefing.card.waitingTurn')
  if (view.phase === 'writing') return t('briefing.card.writing', { n: view.step + 1 })
  return t(view.phase === 'ready' ? 'briefing.card.ready' : view.phase === 'failed' ? 'briefing.card.failed' : 'briefing.card.offered')
}

function dividerOf(view: Briefing) {
  if (view.phase === 'ready') return WON
  return view.phase === 'failed' || (view.phase === 'waiting' && view.urgent) ? RED : SCREW
}

function chipOf(view: Briefing) {
  const look = CHIPS[phaseOf(view)]
  const urgent = view.phase === 'waiting' && view.urgent
  return { label: t(look.label), chip: urgent ? RED : look.chip, light: urgent ? CREAM : look.light }
}

function cardButtons(view: Briefing) {
  if (view.phase !== 'waiting') return []
  let x = LEFT
  return briefingButtons(view).map(b => {
    const placedOne = { ...b, x, w: buttonW(b) }
    x += placedOne.w + CARD_BUTTON_GAP
    return placedOne
  })
}

function layout(view: Briefing) {
  const textW = INNER - MEDAL_W - AFTER_MEDAL
  const task = fit(taskOf(view), BIG, textW)
  const rows = stepsOf(view)
  const words = wrap(lineOf(view, false), SMALL, INNER, LINE_ROWS)
  const buttons = cardButtons(view)
  const stepsH = rows.length * STEP_H + (rows.length - 1) * STEP_GAP
  const lineH = words.length ? words.length * SMALL_LINE + GAP : 0
  const buttonsH = buttons.length ? BUTTON_H + GAP : 0
  const plate = PLATE_PAD + MEDAL_H + GAP + 2 + GAP + stepsH + GAP + lineH + buttonsH + CHIP_H + PLATE_PAD
  return { task, rows, words, buttons, stepsH, plate, height: cardHeight(plate) }
}

function draw(view: Briefing, l: ReturnType<typeof layout>, width: number, height: number) {
  const parts = cardBack(l.plate)
  const words: string[] = []
  const write = writer(words)
  const textX = LEFT + MEDAL_W + AFTER_MEDAL
  const title = t('briefing.card.title')
  let y = LEFT
  parts.push(...medalBack(y), letter(phaseOf(view), LEFT + ENVELOPE_X, y + ENVELOPE_Y))
  write(title, textX, y, TITLE, TITLE, INK)
  write(l.task, textX, y + TITLE, BIG, BIG_LINE, BROWN)
  y += MEDAL_H + GAP
  parts.push(box(LEFT, y, INNER, 2, dividerOf(view)))
  y += 2 + GAP
  l.rows.forEach((row, i) => {
    const top = y + i * (STEP_H + STEP_GAP)
    if (row.status === 'in_progress') parts.push(box(LEFT, top, Math.ceil(textWidth(row.text, SMALL)) + STEP_PAD, STEP_H, HIGHLIGHT))
    parts.push(at(LEFT + STEP_BOX_X, top + STEP_BOX_Y, stepBox(row.status)))
    write(row.text, LEFT + STEP_LABEL_X, top, SMALL, STEP_H, STEP_WORDS[row.status])
  })
  y += l.stepsH + GAP
  const lineInk = view.phase === 'ready' ? INK : BROWN
  l.words.forEach((row, i) => write(row, LEFT, y + i * SMALL_LINE, SMALL, SMALL_LINE, lineInk))
  if (l.words.length) y += l.words.length * SMALL_LINE + GAP
  const inside = l.buttons.map(b => at(b.x, y, buttonBody(b)))
  if (l.buttons.length) y += BUTTON_H + GAP
  const chip = chipOf(view)
  parts.push(...chipParts(chip, y, write).parts, ...cardScrews(l.plate))
  const shown = `${title}${l.task}${l.rows.map(r => r.text).join('')}${l.words.join('')}${l.buttons.map(b => b.drawn).join('')}${chip.label}`
  return cardDocument(WIDE + SHADOW, l.height + SHADOW, width, height, shown, parts, [...words, ...inside])
}

/** The card of a briefing: where it stands, and its five steps. */
export function briefingCard(view: Briefing): BriefingCard {
  const l = layout(view)
  const lineWords = lineOf(view, false)
  const alt = [t('briefing.card.title'), l.task, ...l.rows.map(r => r.text), lineWords, chipOf(view).label].filter(Boolean).join('. ').replace(/\.\./g, '.')
  const top = LEFT + MEDAL_H + GAP + 2 + GAP + l.stepsH + GAP + (l.words.length ? l.words.length * SMALL_LINE + GAP : 0)
  return {
    alt,
    buttons: l.buttons.map(b => ({ ...b, y: top })),
    draw: (maxW, maxH) => {
      const size = fitted(WIDE + SHADOW, l.height, l.height, maxW, maxH)
      return { source: draw(view, l, size.width, size.height), width: size.width, height: size.height }
    },
  }
}

// ---------- The row above the band ----------

function gauge(view: Briefing, x: number) {
  const cells = STEP_KEYS.map((_, i) => (i < view.step ? RAIL_DONE : i === view.step ? GOLD : DEEP))
  return `${box(x, GAUGE_Y, GAUGE_W, GAUGE_H, INK)}${railPaths(cells, x + 2, GAUGE_Y + 2, GAUGE_W - 4, GAUGE_H - 4)}`
}

/** The buttons against the right edge, and where what stands left of them ends. */
function rowRight(view: Briefing, width: number) {
  let right = width - ROW_RIGHT
  const buttons = [...briefingButtons(view)].reverse().map(b => {
    const w = buttonW(b)
    right -= w
    const one = { ...b, x: right, w }
    right -= ROW_GAP
    return one
  })
  return { buttons: buttons.reverse(), right }
}

/** The row as one plain drawing. Its presses are `Button`s laid over it, at the places given back. */
export function briefingRow(view: Briefing, width: number): BriefingRow {
  const phase = phaseOf(view)
  const { buttons, right } = rowRight(view, width)
  const [gaugeX, textEnd] = view.phase === 'writing' ? [right - GAUGE_W, right - GAUGE_W - ROW_GAP] : [0, right]
  const room = textEnd - ROW_TEXT_X
  const words = lineOf(view, true)
  const shown = room >= ROW_MIN_TEXT ? fit(words, SHARP, room) : ''
  // No edge at the bottom: the row seems to come out from behind the band.
  const height = ROW_H
  const parts = [box(0, 0, width, height, WOOD_DARK), box(2, 2, width - 4, height - 2, WOOD), box(ROW_PLATE, ROW_PLATE, width - ROW_PLATE * 2, height - ROW_PLATE, PLATE)]
  if (shown) parts.push(letter(phase, ROW_ICON_X, ROW_ICON_Y))
  if (view.phase === 'writing' && shown) parts.push(gauge(view, gaugeX))
  const message = shown ? line(shown, ROW_TEXT_X, textTop(ROW_TEXT_Y, SHARP, ROW_TEXT_LINE), SHARP, INK) : ''
  const faces = buttons.map(b => at(b.x, BUTTON_Y, buttonBody(b))).join('')
  const letters = `${shown}${buttons.map(b => b.drawn).join('')}`
  // The app narrows a plain image to the body: stretched, it still fills the height kept for it, up to the band.
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges"><defs>${letterDefs(letters)}</defs>${parts.join('')}${faces}${message}</svg>`
  return { source, alt: [words, ...buttons.map(b => b.label)].join('. ').replace(/\.\./g, '.'), width, height, buttons }
}

export const rowArea = (b: PlacedButton) => ({ x: b.x, y: 0, w: b.w, h: ROW_H })
