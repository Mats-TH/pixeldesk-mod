import type { PlanLine } from '../types'
import { plain } from './desks'
import type { Departure, FloorRoom } from './desks'
import { decides, getLanguage, plural, t } from './i18n'
import type { TextKey } from './i18n'
import { canvas, paths } from './pixel/canvas'
import { fit, textWidth, wrap } from './pixel/font'
import { TENUES, crab, person } from './pixel/sprites'
import type { DeskState, Tenue } from './pixel/sprites'
import { letterDefs, line, progressOf, railCells, railDots, railPaths } from './room'

/** All a card says. `hue` null: no portrait. `chip` null: no state chip. `dots` set: no plan known, three dots. */
export type Card = {
  title: string
  task: string
  text: string
  label: string
  cells: string[]
  dots: DeskState | null
  step: string
  meta: string
  chip: DeskState | 'rest' | null
  hue: number | null
}
/** The manager's card. `title`: the name of the plan. `text` and `meta`: what the chat does, and for how long. */
export type CardManager = { working: boolean; title: string; text: string; meta: string; plan: readonly PlanLine[] }
export type CardAgent = { role: string; task: string; text: string; meta: string; state: DeskState; hue: number; plan: readonly PlanLine[] }
export type CardDrawing = { source: string; width: number; height: number }
/** An agent of the room, as a step can name it. */
export type StepAgent = { role: string; hue: number; state: DeskState }
/** All the bubble of a plan line says. `who`: an agent, `claude` for the main chat, null when nobody has it yet. */
export type StepCard = { title: string; detail: string; who: StepAgent | 'claude' | null }

const INK = '#1B1730'
const WOOD_DARK = '#3B2318'
const WOOD = '#8A5A3A'
const PLATE_EDGE = '#4A2C2A'
const PLATE = '#F4E4C1'
const BROWN = '#7B4D35'
const PURPLE = '#6E5A9E'
const SCREW = '#C9A24A'
const CHIP_TEXT = '#FFF6DE'
const GOLD = '#FFC857'
const WON = '#8CC265'
const STOP = '#E4633A'

const MEDALS: Record<Tenue, string> = { Corail: '#EB8A6B', Turquoise: '#5FB6AB', Violet: '#9F90E0', Rose: '#DF7E9E', Bleu: '#6F9DD6', Or: '#E8B864' }
const STATES: Record<DeskState | 'rest', { label: string; line: string; chip: string; light: string }> = {
  working: { get label() { return t('state.working') }, line: SCREW, chip: '#2A2036', light: '#7FE0C8' },
  done: { get label() { return t('state.done') }, line: '#6FAE5C', chip: '#3E7A4C', light: '#BFF5E6' },
  failed: { get label() { return t('state.failed') }, line: '#B8452A', chip: '#B8452A', light: CHIP_TEXT },
  rest: { get label() { return t('state.rest') }, line: SCREW, chip: '#544B70', light: SCREW },
}

// The card of the design: 272 wide, a frame of 7 around the plate, 14 of padding inside it.
const WIDE = 272
const SHADOW = 4
const FRAME = 7
const LEFT = 21
const INNER = 230
const GAP = 12
const MEDAL_W = 44
const MEDAL_H = 52
const AFTER_MEDAL = 10
const TITLE = 30
const BIG = 20
const BIG_LINE = 22
const SMALL = 16
const SMALL_LINE = 18
const BAR_H = 14
const CHIP_H = 20
// What a line gives up when a pane is short: task, text and step lines, widest first.
const ROOMY = [2, 4, 2] as const
const TIGHT = [1, 2, 1] as const

function agentStep(c: CardAgent) {
  const live = c.plan.find(st => st.status === 'in_progress')
  const next = c.plan.find(st => st.status === 'pending')
  if (c.state === 'done') return !c.plan.length || !next ? t('band.doneShort') : t('card.workDone')
  const where = (live ?? next)?.text
  if (c.state === 'failed') return !c.plan.length ? t('card.stoppedNoPlan') : where ? t('card.stoppedAt', { text: where }) : t('state.failed')
  if (!c.plan.length) return t('card.noPlanYet')
  return live ? t('band.now', { text: live.text }) : next ? t('band.next', { text: next.text }) : t('band.doneShort')
}

/** The card of a desk. */
export function agentCard(c: CardAgent): Card {
  const p = progressOf(c.plan)
  const cells = railCells({ state: c.state, ...p })
  const label = p.total ? plural('card.steps', decides(p.done, p.total), { done: p.done, total: p.total }) : t(c.state === 'done' ? 'card.noPlan' : 'card.unknownTime')
  return { title: c.role, task: c.task, text: c.text, label, cells, dots: cells.length ? null : c.state, step: agentStep(c), meta: c.meta, chip: c.state, hue: c.hue }
}

/** The manager's card: at work, as an agent's with the plan of the chat; at rest, no block of progress. */
export function managerCard(m: CardManager): Card {
  if (m.working) return agentCard({ role: t('role.manager'), task: m.title || t('manager.noPlan'), text: m.text, meta: m.meta, state: 'working', hue: 0, plan: m.plan })
  return { title: t('role.manager'), task: t('manager.noTask'), text: t('manager.waiting'), label: '', cells: [], dots: null, step: '', meta: m.meta, chip: 'rest', hue: 0 }
}

/** The card of a room of the floor plan: one box per agent, no portrait and no chip. `minutes` 0: no time known. */
export function roomCard(r: FloorRoom, minutes: number): Card {
  const count = (state: DeskState) => r.desks.filter(d => d.state === state).length
  const n = r.desks.length
  const live = r.steps.find(st => st.status === 'in_progress')
  const [finished, stopped] = [count('done'), count('failed')]
  const working = count('working')
  const step = n ? `${plural('card.agentsWorking', working, { n: working })}${stopped ? ` · ${plural('card.agentsStopped', stopped, { n: stopped })}` : ''}` : ''
  return {
    title: r.title,
    task: live ? t('card.roomStep', { text: live.text }) : t('card.roomNoStep'),
    text: r.summary || (r.manager?.working ? t('state.working') : t('band.idle')),
    label: n ? plural('card.agentsDone', decides(finished, n), { n: finished, total: n }) : '',
    cells: r.desks.map(d => (d.state === 'done' ? WON : d.state === 'failed' ? STOP : GOLD)),
    dots: null,
    step,
    meta: n ? `${plural('overview.agents', n, { n })}${minutes ? ` · ${t('card.minutes', { n: minutes })}` : ''}` : r.manager?.working ? t('manager.working') : t('band.idle'),
    chip: null,
    hue: null,
  }
}

/**
 * What the bubble of a step says. `who` is read against the posts on the desks, the latest agent at work first: a post
 * nobody holds yet reads as not attributed. The state shown is the agent's, whatever became of the step.
 * The Manager is the main chat, as a plan written before that post became its own may say.
 */
export function stepCard(st: { text: string; detail?: string; who?: string }, agents: readonly StepAgent[]): StepCard {
  const said = plain(st.who ?? '')
  const holders = agents.filter(a => plain(a.role) === said)
  const agent = holders.filter(a => a.state === 'working').pop() ?? holders[holders.length - 1] ?? null
  return { title: st.text, detail: st.detail ?? '', who: said === 'claude' || said === 'manager' ? 'claude' : agent }
}

const isStep = (c: Card | StepCard): c is StepCard => 'who' in c

/** The card in words, for a reader that cannot see it. */
export function cardAlt(c: Card | StepCard) {
  if (isStep(c)) {
    const who = c.who === 'claude' ? `Claude, ${t('card.mainChat')}` : c.who ? `${c.who.role}, ${STATES[c.who.state].label}` : t('card.unassigned')
    return [c.title, c.detail, who].filter(Boolean).join('. ')
  }
  return [c.title, c.task, c.text, c.label, c.step, c.meta, c.chip ? STATES[c.chip].label : ''].filter(Boolean).join('. ')
}

function layout(c: Card, [taskLines, textLines, stepLines]: readonly [number, number, number]) {
  const chip = c.chip ? STATES[c.chip] : null
  const textW = c.hue === null ? INNER : INNER - MEDAL_W - AFTER_MEDAL
  const task = wrap(c.task, BIG, textW, taskLines)
  const text = wrap(c.text, BIG, INNER, textLines)
  const step = wrap(c.step, SMALL, INNER, stepLines)
  const headH = Math.max(c.hue === null ? 0 : MEDAL_H, TITLE + task.length * BIG_LINE)
  const barH = c.cells.length || c.dots ? SMALL_LINE + 4 + BAR_H + 4 + step.length * SMALL_LINE + GAP : 0
  const footH = chip ? CHIP_H : SMALL_LINE
  const plate = 14 + headH + GAP + 2 + GAP + text.length * BIG_LINE + GAP + barH + footH + 14
  return { chip, textW, task, text, step, headH, barH, footH, plate, height: FRAME * 2 + plate }
}

const box = (x: number, y: number, w: number, h: number, fill: string, r = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${r ? ` rx="${r}"` : ''} fill="${fill}"/>`

function screw(x: number, y: number) {
  return `${box(x, y, 6, 6, SCREW)}${box(x, y, 2, 2, PLATE)}${box(x + 4, y + 4, 2, 2, BROWN)}`
}

// Jersey 10 sits low in its line: this much above the box brings it where the design has it.
const textTop = (y: number, size: number, lineH: number) => Math.round(y + (lineH - size * 1.06) / 2)

function draw(c: Card, l: ReturnType<typeof layout>, width: number, height: number) {
  const h = l.height
  const parts: string[] = []
  const words: string[] = []
  const write = (s: string, x: number, y: number, size: number, lineH: number, fill: string) => {
    if (s) words.push(line(s, x, textTop(y, size, lineH), size, fill))
  }
  // The shadow, then the frame and the plate.
  parts.push(box(SHADOW, SHADOW, WIDE, h, '#0F0A1A', 4).replace('/>', ' fill-opacity=".38"/>'))
  parts.push(box(0, 0, WIDE, h, WOOD_DARK, 4), box(2, 2, WIDE - 4, h - 4, WOOD, 2))
  parts.push(box(FRAME, FRAME, WIDE - FRAME * 2, l.plate, PLATE_EDGE, 2), box(FRAME + 2, FRAME + 2, WIDE - FRAME * 2 - 4, l.plate - 4, PLATE))
  let y = LEFT
  // The head: the portrait, then the post and the task.
  const textX = c.hue === null ? LEFT : LEFT + MEDAL_W + AFTER_MEDAL
  if (c.hue !== null) {
    const tenue = TENUES[c.hue % TENUES.length]!
    const medalY = y + Math.floor((l.headH - MEDAL_H) / 2)
    parts.push(box(LEFT, medalY, MEDAL_W, MEDAL_H, WOOD_DARK, 2), box(LEFT + 2, medalY + 2, MEDAL_W - 4, MEDAL_H - 4, MEDALS[tenue]))
    parts.push(`<g transform="translate(${LEFT + 6} ${medalY + 6}) scale(2)">${paths(person(tenue))}</g>`)
  }
  write(fit(c.title, TITLE, l.textW), textX, y, TITLE, TITLE, INK)
  l.task.forEach((row, i) => write(row, textX, y + TITLE + i * BIG_LINE, BIG, BIG_LINE, BROWN))
  y += l.headH + GAP
  parts.push(box(LEFT, y, INNER, 2, c.chip ? STATES[c.chip].line : SCREW))
  y += 2 + GAP
  l.text.forEach((row, i) => write(row, LEFT, y + i * BIG_LINE, BIG, BIG_LINE, PLATE_EDGE))
  y += l.text.length * BIG_LINE + GAP
  if (l.barH) {
    write(fit(c.label, SMALL, INNER), LEFT, y, SMALL, SMALL_LINE, PLATE_EDGE)
    y += SMALL_LINE + 4
    parts.push(box(LEFT, y, INNER, BAR_H, INK, 2))
    if (c.cells.length) parts.push(railPaths(c.cells, LEFT + 2, y + 2, INNER - 4, BAR_H - 4))
    else if (c.dots) parts.push(railDots(c.dots, LEFT + (INNER - 20) / 2, y + 5))
    y += BAR_H + 4
    l.step.forEach((row, i) => write(row, LEFT, y + i * SMALL_LINE, SMALL, SMALL_LINE, BROWN))
    y += l.step.length * SMALL_LINE + GAP
  }
  // The foot: the time and the count, then the state chip against the right edge.
  let metaW = INNER
  if (l.chip) {
    const chipW = 6 + 6 + 5 + Math.ceil(textWidth(l.chip.label, SMALL)) + 6
    const chipX = LEFT + INNER - chipW
    metaW = INNER - chipW - 8
    parts.push(box(chipX, y, chipW, CHIP_H, l.chip.chip, 2), box(chipX + 6, y + 7, 6, 6, l.chip.light))
    write(l.chip.label, chipX + 17, y + 2, SMALL, 16, CHIP_TEXT)
  }
  write(fit(c.meta, SMALL, metaW), LEFT, y, SMALL, l.footH, PURPLE)
  // The four screws of the plate, over all the rest.
  const [screwL, screwR, screwB] = [FRAME + 4, WIDE - FRAME - 10, FRAME + l.plate - 10]
  parts.push(screw(screwL, FRAME + 4), screw(screwR, FRAME + 4), screw(screwL, screwB), screw(screwR, screwB))
  const shown = `${fit(c.title, TITLE, l.textW)}${l.task.join('')}${l.text.join('')}${c.label}${l.step.join('')}${c.meta}${l.chip?.label ?? ''}`
  const moving = c.dots === 'working' ? '<style>.td0,.td1,.td2{animation:td 1.2s steps(1) infinite}.td1{animation-delay:.3s}.td2{animation-delay:.6s}@keyframes td{0%,30%{opacity:1}31%,100%{opacity:.25}}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>' : ''
  const fullW = WIDE + SHADOW
  const fullH = h + SHADOW
  // At these sizes the font's grid falls between pixels: only the words are smoothed, as in the design.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${fullW} ${fullH}" shape-rendering="crispEdges">${moving}<defs>${letterDefs(shown)}</defs>${parts.join('')}<g shape-rendering="geometricPrecision">${words.join('')}</g></svg>`
}

// The bubble of the design: 220 wide, a frame of 5 around the plate, the words 12 inside it.
const BUBBLE_W = 220
const BUBBLE_FRAME = 5
const BUBBLE_LEFT = 17
const BUBBLE_INNER = 186
const BUBBLE_TOP = 15
const BUBBLE_GAP = 6
const BUBBLE_BOTTOM = 10
const STEP_LINES = [2, 4] as const
const STEP_TIGHT = [1, 2] as const
const MEDAL = 28
const LIGHTS: Record<DeskState, string> = { working: '#2A9D8F', done: '#4E8F5A', failed: '#B8452A' }
const SEPARATOR = '#D8C49E'
const CRAB_BACK = '#3A3355'

function stepLayout(c: StepCard, [titleLines, detailLines]: readonly [number, number]) {
  const title = wrap(c.title, BIG, BUBBLE_INNER, titleLines)
  const detail = c.detail ? wrap(c.detail, SMALL, BUBBLE_INNER, detailLines) : []
  const whoH = c.who ? MEDAL : SMALL_LINE
  const body = title.length * BIG_LINE + (detail.length ? BUBBLE_GAP + detail.length * SMALL_LINE : 0) + BUBBLE_GAP + 2 + BUBBLE_GAP + whoH
  const plate = 10 + body + BUBBLE_BOTTOM
  return { title, detail, whoH, plate, height: BUBBLE_FRAME * 2 + plate }
}

function drawStep(c: StepCard, l: ReturnType<typeof stepLayout>, width: number, height: number) {
  const h = l.height
  const parts: string[] = []
  const words: string[] = []
  const write = (s: string, x: number, y: number, size: number, lineH: number, fill: string) => {
    if (s) words.push(line(s, x, textTop(y, size, lineH), size, fill))
  }
  parts.push(box(SHADOW, SHADOW, BUBBLE_W, h, '#0F0A1A', 4).replace('/>', ' fill-opacity=".38"/>'))
  parts.push(box(0, 0, BUBBLE_W, h, WOOD_DARK, 4), box(2, 2, BUBBLE_W - 4, h - 4, WOOD, 2))
  parts.push(box(BUBBLE_FRAME, BUBBLE_FRAME, BUBBLE_W - BUBBLE_FRAME * 2, l.plate, PLATE_EDGE, 2), box(BUBBLE_FRAME + 2, BUBBLE_FRAME + 2, BUBBLE_W - BUBBLE_FRAME * 2 - 4, l.plate - 4, PLATE))
  let y = BUBBLE_TOP
  l.title.forEach((row, i) => write(row, BUBBLE_LEFT, y + i * BIG_LINE, BIG, BIG_LINE, INK))
  y += l.title.length * BIG_LINE
  if (l.detail.length) {
    y += BUBBLE_GAP
    l.detail.forEach((row, i) => write(row, BUBBLE_LEFT, y + i * SMALL_LINE, SMALL, SMALL_LINE, PLATE_EDGE))
    y += l.detail.length * SMALL_LINE
  }
  y += BUBBLE_GAP
  parts.push(box(BUBBLE_LEFT, y, BUBBLE_INNER, 2, SEPARATOR))
  y += 2 + BUBBLE_GAP
  if (!c.who) write(t('card.unassigned'), BUBBLE_LEFT, y, SMALL, SMALL_LINE, PURPLE)
  else {
    // The portrait is the one thing cut to its frame: a nested drawing keeps the bust.
    const claude = c.who === 'claude'
    const tenue = claude ? null : TENUES[(c.who as StepAgent).hue % TENUES.length]!
    parts.push(box(BUBBLE_LEFT, y, MEDAL, MEDAL, WOOD_DARK, 2), box(BUBBLE_LEFT + 2, y + 2, MEDAL - 4, MEDAL - 4, tenue ? MEDALS[tenue] : CRAB_BACK))
    const face = tenue ? paths(person(tenue), 2) : `<g transform="translate(2 6)">${paths(crab())}</g>`
    parts.push(`<svg x="${BUBBLE_LEFT + 2}" y="${y + 2}" width="${MEDAL - 4}" height="${MEDAL - 4}" viewBox="${tenue ? '4 1 24 24' : '0 0 24 24'}">${face}</svg>`)
    const state = claude ? t('card.mainChat') : STATES[(c.who as StepAgent).state].label
    const stateW = Math.ceil(textWidth(state, SMALL))
    const stateX = BUBBLE_LEFT + BUBBLE_INNER - stateW
    if (!claude) parts.push(box(stateX - 10, y + 11, 6, 6, LIGHTS[(c.who as StepAgent).state]))
    const textY = y + (MEDAL - SMALL_LINE) / 2
    const postX = BUBBLE_LEFT + MEDAL + BUBBLE_GAP
    write(fit(claude ? 'Claude' : (c.who as StepAgent).role, SMALL, stateX - (claude ? 0 : 10) - 6 - postX), postX, textY, SMALL, SMALL_LINE, INK)
    write(state, stateX, textY, SMALL, SMALL_LINE, PURPLE)
  }
  const shown = `${l.title.join('')}${l.detail.join('')}${c.who === 'claude' ? `Claude${t('card.mainChat')}` : c.who ? `${c.who.role}${STATES[c.who.state].label}` : t('card.unassigned')}`
  const [fullW, fullH] = [BUBBLE_W + SHADOW, h + SHADOW]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${fullW} ${fullH}" shape-rendering="crispEdges"><defs>${letterDefs(shown)}</defs>${parts.join('')}<g shape-rendering="geometricPrecision">${words.join('')}</g></svg>`
}

const drawings = new Map<string, CardDrawing>()

/** Fits a card in `maxW` by `maxH`: it first loses lines, then the whole card shrinks. */
function fitted(fullW: number, roomyH: number, tightH: number, maxW: number, maxH: number) {
  const tight = roomyH + SHADOW > maxH
  const fullH = (tight ? tightH : roomyH) + SHADOW
  const k = Math.min(1, maxW / fullW, maxH / fullH)
  return { tight, width: Math.floor(fullW * k), height: Math.floor(fullH * k) }
}

/** The card, or the bubble of a plan line, as a drawing at most `maxW` by `maxH`. */
export function cardSvg(c: Card | StepCard, maxW: number, maxH: number): CardDrawing {
  const key = JSON.stringify([getLanguage(), c, maxW, maxH])
  const known = drawings.get(key)
  if (known) return known
  let drawing: CardDrawing
  if (isStep(c)) {
    const [roomy, tight] = [stepLayout(c, STEP_LINES), stepLayout(c, STEP_TIGHT)]
    const size = fitted(BUBBLE_W + SHADOW, roomy.height, tight.height, maxW, maxH)
    drawing = { source: drawStep(c, size.tight ? tight : roomy, size.width, size.height), width: size.width, height: size.height }
  } else {
    const [roomy, tight] = [layout(c, ROOMY), layout(c, TIGHT)]
    const size = fitted(WIDE + SHADOW, roomy.height, tight.height, maxW, maxH)
    drawing = { source: draw(c, size.tight ? tight : roomy, size.width, size.height), width: size.width, height: size.height }
  }
  // Cards change one at a time: an old one goes with the rest once the room has moved on.
  if (drawings.size >= 64) drawings.clear()
  drawings.set(key, drawing)
  return drawing
}

// ---------- The settings button and its panel: in true pixels, whatever the scale of the room ----------

const CELL_W = 8
const CELL_H = 21
type Area = { x: number; y: number; w: number; h: number }
const GEAR: Area = { x: 10, y: 10, w: 32, h: 32 }
// The panel of the design, 256 by 242, and its option lines.
const PANEL_X = 8
const PANEL_Y = 46
const PANEL_W = 256
const PANEL_H = 242
const OPTION_X = 17
const OPTION_W = 222
const OPTION_H = 72
// How wide the sentence of an option may run: what stands right of its tick box.
export const OPTION_TEXT = 182
const OPTION_Y: Record<Departure, number> = { plan: 75, each: 153 }
const OPTIONS: Record<Departure, { name: TextKey; line: TextKey }> = {
  plan: { name: 'settings.plan.name', line: 'settings.plan.line' },
  each: { name: 'settings.each.name', line: 'settings.each.line' },
}
const GEAR_ROWS = ['.FFFFFFFFFFFFFF.', 'FLLLLLLLLLLLLLLF', 'FLCEEEEEEEEEECDF', 'FLEEEEEEEEEEEEDF', 'FLEEEEEMMEEEEEDF', 'FLEEEMEMMEMEEEDF', 'FLEEEEMMMMEEEEDF', 'FLEEMMMEEMMMEEDF', 'FLEEMMMEEMMMEEDF', 'FLEEEEMMMMEEEEDF', 'FLEEEMEMMEMEEEDF', 'FLEEEEEMMEEEEEDF', 'FLEEEEEEEEEEEEDF', 'FLCEEEEEEEEEECDF', 'FLDDDDDDDDDDDDDF', '.FFFFFFFFFFFFFF.']
// Pressed in: the light edge goes dark, and the dark edge goes to the fill.
const GEAR_PRESSED = GEAR_ROWS.map((row, i) => (i === 1 ? 'FFFFFFFFFFFFFFFF' : i === 14 ? 'FDDDDDDDDDDDDDDF' : i ? row.replace('FL', 'FF').replace(/DF$/, 'EF') : row))
const GEAR_LOOKS = {
  normal: { rows: GEAR_ROWS, ink: { F: WOOD_DARK, L: '#C99A68', C: SCREW, E: '#A97A4E', D: WOOD, M: PLATE } },
  hover: { rows: GEAR_ROWS, ink: { F: WOOD_DARK, L: '#D4A878', C: GOLD, E: '#B98A5B', D: '#986843', M: GOLD } },
  open: { rows: GEAR_PRESSED, ink: { F: WOOD_DARK, C: SCREW, E: '#6B4030', D: WOOD, M: GOLD } },
} as const
export type GearLook = keyof typeof GEAR_LOOKS
const CREAM_LIGHT = '#FFF6DE'
const OPTION_LOOKS = {
  on: { back: '#FFDF8F', edge: SCREW, line: PLATE_EDGE },
  off: { back: CREAM_LIGHT, edge: '#D8C49E', line: PURPLE },
  lit: { back: '#FFF2C4', edge: SCREW, line: PURPLE },
} as const

/** The button in `width` by `height`, from (dx, dy): a look of its own, as the room's drawing never changes for it. */
export function gearSvg(look: GearLook, dx: number, dy: number, width: number, height: number) {
  const c = canvas(16, 16)
  c.sprite(GEAR_LOOKS[look].rows, GEAR_LOOKS[look].ink, 0, 0)
  return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><g transform="translate(${dx} ${dy})">${paths(c, 2)}</g></svg>`, width, height }
}

/** Where the button and the panel fall in a pane. The panel only shrinks to stay whole; `k` is its scale. */
export function settingsPlace(width: number, height: number) {
  const k = Math.floor(Math.min(1, (width - PANEL_X) / (PANEL_W + SHADOW), (height - PANEL_Y) / (PANEL_H + SHADOW)) * 1000) / 1000
  const option = (id: Departure): Area => ({ x: PANEL_X + OPTION_X * k, y: PANEL_Y + OPTION_Y[id] * k, w: OPTION_W * k, h: OPTION_H * k })
  return { k, button: GEAR, panel: { x: PANEL_X, y: PANEL_Y, w: (PANEL_W + SHADOW) * k, h: (PANEL_H + SHADOW) * k }, options: { plan: option('plan'), each: option('each') } }
}
export type SettingsPlace = ReturnType<typeof settingsPlace>

/** The cells a click zone takes: rounded, so two zones side by side never share one. */
export function zoneCells(b: Area) {
  const [left, top] = [Math.round(b.x / CELL_W), Math.round(b.y / CELL_H)]
  return { left, top, cols: Math.max(1, Math.round((b.x + b.w) / CELL_W) - left), rows: Math.max(1, Math.round((b.y + b.h) / CELL_H) - top) }
}

/** The whole cells that hold a drawing, and where it starts in them. */
export function drawnCells(b: Area) {
  const [left, top] = [Math.floor(b.x / CELL_W), Math.floor(b.y / CELL_H)]
  const [dx, dy] = [b.x - left * CELL_W, b.y - top * CELL_H]
  const [cols, rows] = [Math.ceil((dx + b.w) / CELL_W), Math.ceil((dy + b.h) / CELL_H)]
  return { left, top, dx, dy, cols, rows, width: cols * CELL_W, height: rows * CELL_H }
}

/** One option line, from the top left corner of its box. */
function optionParts(id: Departure, look: keyof typeof OPTION_LOOKS, chosen: boolean) {
  const ink = OPTION_LOOKS[look]
  const name = t(OPTIONS[id].name)
  const lines = wrap(t(OPTIONS[id].line), SMALL, OPTION_TEXT, 2)
  const parts = [box(0, 0, OPTION_W, OPTION_H, ink.edge, 2), box(2, 2, OPTION_W - 4, OPTION_H - 4, ink.back), box(10, 12, 12, 12, INK), box(12, 14, 8, 8, chosen ? GOLD : CREAM_LIGHT)]
  if (chosen) parts.push(box(14, 16, 4, 4, INK))
  const words = [line(name, 30, textTop(8, 18, 20), 18, INK), ...lines.map((row, i) => line(row, 30, textTop(28 + i * SMALL_LINE, SMALL, SMALL_LINE), SMALL, ink.line))]
  return { parts, words, shown: `${name}${lines.join('')}` }
}

const optionGroup = (o: ReturnType<typeof optionParts>, x: number, y: number) => `<g transform="translate(${x} ${y})">${o.parts.join('')}<g shape-rendering="geometricPrecision">${o.words.join('')}</g></g>`

/** A drawing placed at `b` on whole cells, for a Box. */
function placed(b: Area, k: number, defs: string, body: string) {
  const at = drawnCells(b)
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${at.width}" height="${at.height}" viewBox="0 0 ${at.width} ${at.height}" shape-rendering="crispEdges"><defs>${defs}</defs><g transform="translate(${Math.round(at.dx * 100) / 100} ${Math.round(at.dy * 100) / 100})${k < 1 ? ` scale(${k})` : ''}">${body}</g></svg>`
  return { ...at, source }
}

/** The panel, with the chosen option in gold and its box ticked. */
export function settingsSvg(choice: Departure, place: SettingsPlace) {
  const [plan, each] = [optionParts('plan', choice === 'plan' ? 'on' : 'off', choice === 'plan'), optionParts('each', choice === 'each' ? 'on' : 'off', choice === 'each')]
  const [title, sub] = [t('settings.title'), t('settings.departure')]
  const frame = [
    box(SHADOW, SHADOW, PANEL_W, PANEL_H, '#0F0A1A', 4).replace('/>', ' fill-opacity=".38"/>'),
    box(0, 0, PANEL_W, PANEL_H, WOOD_DARK, 4),
    box(2, 2, PANEL_W - 4, PANEL_H - 4, WOOD, 2),
    box(5, 5, PANEL_W - 10, PANEL_H - 10, PLATE_EDGE, 2),
    box(7, 7, PANEL_W - 14, PANEL_H - 14, PLATE),
    box(OPTION_X, 43, OPTION_W, 2, SCREW),
  ]
  const words = line(title, OPTION_X, textTop(15, BIG, BIG_LINE), BIG, INK) + line(sub, OPTION_X, textTop(51, SMALL, SMALL_LINE), SMALL, PLATE_EDGE)
  const body = `${frame.join('')}<g shape-rendering="geometricPrecision">${words}</g>${optionGroup(plan, OPTION_X, OPTION_Y.plan)}${optionGroup(each, OPTION_X, OPTION_Y.each)}`
  const said = (id: Departure) => (choice === id ? t('settings.chosen', { name: t(OPTIONS[id].name) }) : t(OPTIONS[id].name))
  const alt = t('settings.alt', { title, departure: sub, plan: said('plan'), each: said('each') })
  return { ...placed({ x: PANEL_X, y: PANEL_Y, w: (PANEL_W + SHADOW) * place.k, h: (PANEL_H + SHADOW) * place.k }, place.k, letterDefs(`${title}${sub}${plan.shown}${each.shown}`), body), alt }
}

/** An option under the pointer, as a drawing that lies over the panel. */
export function optionSvg(id: Departure, place: SettingsPlace) {
  const lit = optionParts(id, 'lit', false)
  return placed(place.options[id], place.k, letterDefs(lit.shown), optionGroup(lit, 0, 0))
}

/**
 * Where the bubble of a line opens, in cells of the pane: against the left of the board, level with its line,
 * and never higher than `under`, the row below the screen. It stays whole, whatever the pane.
 */
export function bubblePlace(boardLeft: number, row: number, under: number, card: { cols: number; rows: number }, pane: { cols: number; rows: number }) {
  const top = Math.max(under, Math.round(row - card.rows / 2))
  return { left: Math.max(0, Math.min(boardLeft - card.cols, pane.cols - card.cols)), top: Math.max(0, Math.min(top, pane.rows - card.rows)) }
}

export type CardZone = { left: number; top: number; width: number; height: number }

/**
 * Where a card opens, in cells of the pane: against its zone, towards the middle of the pane. When
 * it does not fit on that side it is held at the top of the pane, over the zone: it is never cut.
 */
export function cardPlace(zone: CardZone, card: { cols: number; rows: number }, pane: { cols: number; rows: number }) {
  const right = zone.left + zone.width / 2 > pane.cols / 2
  const low = zone.top + zone.height / 2 > pane.rows / 2
  const below = zone.top + zone.height
  const left = right ? zone.left + zone.width - card.cols : zone.left
  const top = low ? zone.top - card.rows : below + card.rows <= pane.rows ? below : 0
  return { left: Math.max(0, Math.min(left, pane.cols - card.cols)), top: Math.max(0, top) }
}
