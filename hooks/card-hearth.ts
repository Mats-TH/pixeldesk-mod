import type { Fire, Hearth, WarmStop } from '../types'
import { AFTER_MEDAL, BAR_H, BIG, BIG_LINE, CHIP_H, GAP, GOLD, INK, INNER, LEFT, MEDAL_H, MEDAL_W, PLATE_EDGE, BROWN, DEEP, PLATE_PAD, PURPLE, SCREW, SHADOW, SMALL, SMALL_LINE, STOP, TITLE, WIDE, box, cardBack, cardDocument, cardHeight, cardScrews, chipParts, fitted, medalBack, writer } from './card'
import type { DrawnCard } from './card'
import { plural, t } from './i18n'
import type { TextKey } from './i18n'
import { canvas, paths } from './pixel/canvas'
import { wrap } from './pixel/font'
import { railPaths } from './room'

const CARD_STEP_MS = 5000

/** All the card reads. `now`: the moment it is drawn, which is all the second it knows of. */
export type HearthCardView = { hearth: Hearth; warm: boolean; now: number }

const CELLS = 5
const PARAGRAPH = 8
const TEXT_LINES = 5
const ASH_LINES = 3
const TIME_LINES = 5
const KEPT_LINES = 3
const COLD_LINE = PURPLE
const CHIP_HOT = '#2A2036'
const CHIP_COLD = '#544B70'
const LIGHT_COLD = '#9DB4FF'

const ICON_INK: Record<string, string> = { o: '#2A2036', e: STOP, y: GOLD, c: '#FFF6DE', w: '#8A5A3A', b: '#6B4030', l: '#C99A68', t: '#6A6E8C', u: '#565A78', v: '#A8B0C8' }
const ICON_W = 16
const ICON_H = 22
const ICON_X = 6
const ICON_Y = 4
const LOGS = ['..ooooooooooooo.', '.owbbbbbbbbbbbo.', '.olwbbbbbbbbllo.', '..ooooooooooooo.']
const ICONS = {
  high: ['.......oo.......', '......oeeo......', '......oeeo..o...', '.....oeeeeo.oo..', '....oeeyyeeoeeo.', '...oeeyyyeeeeeo.', '...oeyyyyyeeeo..', '..oeeyycyyyeeeo.', '..oeyycccyyyeeo.', '..oeycccccyyeeo.', '...oeyccccyyeo..', '....oeyccyyeo...', '.....oooooooo...', ...LOGS],
  low: ['.......oo.......', '......oeeo......', '.....oeyeeo.....', '....oeyyyeo.....', '.....oooooo.....', ...LOGS],
  cold: ['..ooooooooooooo.', '.otuuuuuuuuuuuo.', '.ovtuuuuuuuuvvo.', '..ooooooooooooo.'],
} as const
// The logs of every icon rest on the same two rows from the bottom of its grid.
const ICON_FLOOR = 20
const ICON_OF: Record<Fire, keyof typeof ICONS> = { full: 'high', medium: 'high', low: 'low', embers: 'low', out: 'cold' }

const STOPPED: Record<Exclude<WarmStop, 'failed'>, TextKey> = { cap: 'warm.stoppedCap', cold: 'warm.stoppedCold', nothing: 'warm.stoppedNothing', handoff: 'warm.stoppedHandoff' }

function fireIcon(fire: Fire) {
  const rows = ICONS[ICON_OF[fire]]
  const c = canvas(ICON_W, ICON_H)
  c.sprite(rows, ICON_INK, 0, ICON_FLOOR - rows.length)
  return paths(c, 2)
}

const clock = (ms: number) => {
  // The pane redraws every 5 s: the card says no more than that.
  const seconds = Math.ceil(ms / CARD_STEP_MS) * (CARD_STEP_MS / 1000)
  return t('hearth.card.cools', { m: Math.floor(seconds / 60), s: String(seconds % 60).padStart(2, '0') })
}

/** Where the time stands at `now`. With no known length `coolsAt` is a mere bound: no time is said, and no share of it. */
function timeOf({ hearth: h, now }: HearthCardView) {
  const left = h.coolsAt === null ? 0 : Math.max(0, h.coolsAt - now)
  const known = h.lengthMs > 0
  const shown = h.coolsAt === null ? t('hearth.card.cold') : !known ? t('warm.lengthUnknown') : left ? clock(left) : t('hearth.card.cold')
  return { left, hot: left > 0, known, shown }
}

function stopWords(h: Hearth, stop: WarmStop) {
  return stop === 'failed' ? t('warm.stoppedFailed', { error: h.warmError }) : t(STOPPED[stop])
}

/** The line under the bar of time: why the relaunches stopped, or how many there were. */
function keptLine(v: HearthCardView, hot: boolean, known: boolean) {
  const h = v.hearth
  if (!v.warm) return hot ? t('hearth.card.warmOff') : ''
  if (h.warmStop) return stopWords(h, h.warmStop)
  if (!hot || !known) return ''
  const n = h.relaunches
  return h.relaunchCap === null ? plural('hearth.card.kept', n, { n }) : plural('hearth.card.keptCap', n, { n, cap: h.relaunchCap })
}

const compactionWords = ({ compactions: n, compactTarget: target }: Hearth) => (target === 'always' ? t('hearth.card.compactionsOpen', { n }) : t('hearth.card.compactions', { n, target }))

function timeCells(v: HearthCardView, left: number, known: boolean) {
  const full = known ? Math.min(CELLS, Math.ceil((CELLS * left) / v.hearth.lengthMs)) : 0
  return Array.from({ length: CELLS }, (_, i) => (i < full ? (v.warm ? STOP : GOLD) : DEEP))
}

function layout(v: HearthCardView, withAsh: boolean) {
  const time = timeOf(v)
  const title = wrap(t('hearth.card.title'), TITLE, INNER - MEDAL_W - AFTER_MEDAL, 2)
  const text = wrap(t('hearth.card.text'), BIG, INNER, TEXT_LINES)
  const ash = withAsh ? wrap(t('hearth.card.ash'), BIG, INNER, ASH_LINES) : []
  const said = wrap(time.shown, SMALL, INNER, TIME_LINES)
  const kept = wrap(keptLine(v, time.hot, time.known), SMALL, INNER, KEPT_LINES)
  const headH = Math.max(MEDAL_H, title.length * TITLE)
  const textH = text.length * BIG_LINE + (ash.length ? PARAGRAPH + ash.length * BIG_LINE : 0)
  const timeH = said.length * SMALL_LINE + 4 + BAR_H + (kept.length ? 4 + kept.length * SMALL_LINE : 0)
  const fillH = SMALL_LINE + 4 + BAR_H + 4 + SMALL_LINE
  const plate = PLATE_PAD + headH + GAP + 2 + GAP + textH + GAP + timeH + GAP + fillH + GAP + CHIP_H + PLATE_PAD
  const fill = t('hearth.card.fill', { percent: Math.round(v.hearth.contextPercent) })
  const chip = time.hot ? { label: t('hearth.card.hot'), chip: CHIP_HOT, light: v.warm ? STOP : GOLD } : { label: t('hearth.card.coldChip'), chip: CHIP_COLD, light: LIGHT_COLD }
  return { time, title, text, ash, said, kept, headH, fill, compactions: compactionWords(v.hearth), chip, plate, height: cardHeight(plate) }
}

function draw(v: HearthCardView, l: ReturnType<typeof layout>, width: number, height: number) {
  const parts = cardBack(l.plate)
  const words: string[] = []
  const write = writer(words)
  const textX = LEFT + MEDAL_W + AFTER_MEDAL
  let y = LEFT
  const medalY = y + Math.floor((l.headH - MEDAL_H) / 2)
  parts.push(...medalBack(medalY), `<g transform="translate(${LEFT + ICON_X} ${medalY + ICON_Y})">${fireIcon(l.time.hot ? v.hearth.fire : 'out')}</g>`)
  l.title.forEach((row, i) => write(row, textX, y + i * TITLE, TITLE, TITLE, INK))
  y += l.headH + GAP
  parts.push(box(LEFT, y, INNER, 2, l.time.hot ? SCREW : COLD_LINE))
  y += 2 + GAP
  l.text.forEach((row, i) => write(row, LEFT, y + i * BIG_LINE, BIG, BIG_LINE, PLATE_EDGE))
  y += l.text.length * BIG_LINE
  if (l.ash.length) y += PARAGRAPH
  l.ash.forEach((row, i) => write(row, LEFT, y + i * BIG_LINE, BIG, BIG_LINE, PLATE_EDGE))
  y += l.ash.length * BIG_LINE + GAP
  l.said.forEach((row, i) => write(row, LEFT, y + i * SMALL_LINE, SMALL, SMALL_LINE, PLATE_EDGE))
  y += l.said.length * SMALL_LINE + 4
  parts.push(box(LEFT, y, INNER, BAR_H, INK, 2), railPaths(timeCells(v, l.time.left, l.time.known), LEFT + 2, y + 2, INNER - 4, BAR_H - 4))
  y += BAR_H
  if (l.kept.length) y += 4
  l.kept.forEach((row, i) => write(row, LEFT, y + i * SMALL_LINE, SMALL, SMALL_LINE, BROWN))
  y += l.kept.length * SMALL_LINE + GAP
  write(l.fill, LEFT, y, SMALL, SMALL_LINE, PLATE_EDGE)
  y += SMALL_LINE + 4
  const room = INNER - 4
  const level = Math.ceil((room * Math.min(100, Math.max(0, v.hearth.contextPercent))) / 100)
  parts.push(box(LEFT, y, INNER, BAR_H, INK), box(LEFT + 2, y + 2, room, BAR_H - 4, DEEP), box(LEFT + 2, y + 2, level, BAR_H - 4, STOP))
  y += BAR_H + 4
  write(l.compactions, LEFT, y, SMALL, SMALL_LINE, BROWN)
  y += SMALL_LINE + GAP
  parts.push(...chipParts(l.chip, y, write).parts, ...cardScrews(l.plate))
  const shown = `${l.title.join('')}${l.text.join('')}${l.ash.join('')}${l.said.join('')}${l.kept.join('')}${l.fill}${l.compactions}${l.chip.label}`
  return cardDocument(WIDE + SHADOW, l.height + SHADOW, width, height, shown, parts, words)
}

/** The card of the hearth: what the cache is, how long it stays, and what became of the conversation. */
export function hearthCard(v: HearthCardView): DrawnCard {
  const roomy = layout(v, true)
  const alt = [t('hearth.card.title'), t('hearth.card.text'), t('hearth.card.ash'), roomy.time.shown, keptLine(v, roomy.time.hot, roomy.time.known), roomy.fill, roomy.compactions, roomy.chip.label].filter(Boolean).join('. ').replace(/\.\./g, '.')
  return {
    alt,
    draw: (maxW, maxH) => {
      const tight = layout(v, false)
      const size = fitted(WIDE + SHADOW, roomy.height, tight.height, maxW, maxH)
      return { source: draw(v, size.tight ? tight : roomy, size.width, size.height), width: size.width, height: size.height }
    },
  }
}
