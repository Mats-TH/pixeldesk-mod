import type { FloorRoom, KidState } from './desks'
import { getLanguage, plural, t } from './i18n'
import { fit, textWidth } from './pixel/font'
import { AT_REST, MAX_SVG, MOTION, PAIR_W, SHADE, cellFrame, letterDefs, line, roomCount, roomScene, svgOpen } from './room'
import type { Chief, RoomInput } from './room'

/** `news`: what the room of the conversation that leads shows; absent, an empty tray. */
export type FloorInput = { rooms: FloorRoom[]; previous: number; width: number; height: number; news?: Chief }

const COLS = 3
const GAP = 4
const TITLE = 16
// The width of the room a regular cell shows: every room is drawn at the scale that gives.
const CELL_W = 430
const LINES: Record<KidState, RoomInput['steps'][number]['status']> = { working: 'in_progress', done: 'completed', failed: 'pending', idle: 'pending' }
const CREAM = '#F4E4C1'
const GOLD = '#FFC857'

/** Where each room falls, the first one on two cells. */
export function floorBoxes(n: number, width: number, height: number) {
  if (n === 2) {
    const h = Math.round((height - GAP) / 2)
    return [{ x: 0, y: 0, w: width, h }, { x: 0, y: h + GAP, w: width, h }]
  }
  const rows = Math.ceil((n + 1) / COLS)
  const cellW = (width - GAP * (COLS - 1)) / COLS
  const cellH = (height - GAP * (rows - 1)) / rows
  let cell = 0
  return Array.from({ length: n }, (_, i) => {
    const span = i === 0 ? 2 : 1
    const col = cell % COLS
    const row = Math.floor(cell / COLS)
    cell += span
    return { x: Math.round(col * (cellW + GAP)), y: Math.round(row * (cellH + GAP)), w: Math.round(cellW * span + GAP * (span - 1)), h: Math.round(cellH) }
  })
}

/** Each room as a cell of the floor shows it. */
function cellsOf(p: FloorInput) {
  const boxes = floorBoxes(p.rooms.length, p.width, p.height)
  const k = boxes[Math.min(1, boxes.length - 1)]!.w / (p.rooms.length === 2 ? PAIR_W : CELL_W)
  const scenes = p.rooms.map((r, i) => {
    const b = boxes[i]!
    // The first room is the chief's: the news, and on the board the conversations it leads.
    const steps = i ? r.steps : p.rooms.slice(1).map(kid => ({ text: kid.title, status: LINES[kid.state ?? 'idle'] }))
    const chief = i ? {} : { chief: p.news ?? { shown: 0, flying: false } }
    const input: RoomInput = { sessionId: r.id, desks: r.desks, manager: r.manager ?? AT_REST, previous: r.desks.length, steps, tokens: r.tokens, width: b.w, height: b.h, ...chief }
    return { input, base: Math.round(b.w / k), frame: cellFrame(input, Math.round(b.w / k)) }
  })
  return { boxes, scenes }
}

// A room at rest: no agent at work, and its manager between two turns.
const isDim = (r: FloorRoom, i: number) => i > 0 && r.working === 0 && !r.manager?.working
const isFresh = (p: FloorInput, i: number) => i >= p.previous && p.previous !== p.rooms.length
const fadeIn = '<animate attributeName="opacity" from="0" to="1" begin=".75s" dur=".3s" fill="freeze"/>'
const cellAt = (b: { x: number; y: number; w: number; h: number }, w: number, h: number) => `<svg x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">`
const zoomOf = (p: FloorInput) => (p.previous !== p.rooms.length && p.previous > 0 ? `<animate attributeName="viewBox" from="0 0 ${Math.round(p.width * 0.8)} ${Math.round(p.height * 0.8)}" to="0 0 ${p.width} ${p.height}" dur=".8s" fill="freeze"/>` : '')

function draw(p: FloorInput, detail: number) {
  const { boxes, scenes } = cellsOf(p)
  // A name stops before the screen: nothing covers the screen or the board.
  const titles = p.rooms.map((r, i) => fit(r.title, TITLE, Math.max(40, scenes[i]!.frame.teleLeft - 24)))
  const metas = p.rooms.map((r, i) => {
    // The manager counts as an agent of the chief's room.
    const agents = i ? r.agents : r.agents + 1
    const count = agents ? plural('overview.agents', agents, { n: agents }) : t('band.idle')
    // The wide room has the space to say what it is doing.
    if (i === 0) return fit(t('floor.meta', { count, summary: r.summary || t('floor.coordinates') }), TITLE, boxes[0]!.w - 30)
    return agents ? t('floor.working', { count }) : r.manager?.working ? t('manager.working') : count
  })
  const defs = new Map<string, string>()
  let letters = titles.join('') + metas.join('')
  const body = p.rooms.map((r, i) => {
    const b = boxes[i]!
    const dim = isDim(r, i)
    const fresh = isFresh(p, i)
    const plateW = Math.ceil(textWidth(titles[i]!, TITLE) + 14)
    const metaW = Math.ceil(textWidth(metas[i]!, TITLE) + 10)
    const { input, base, frame } = scenes[i]!
    const scene = roomScene(input, { base, plate: { w: (plateW + 5) / frame.k, h: 30 / frame.k }, detail })
    for (const [id, svg] of scene.defs) if (!defs.has(id)) defs.set(id, svg)
    letters += scene.letters
    const shade = dim ? `<rect width="${scene.w}" height="${scene.h}" fill="${SHADE.ink}" fill-opacity=".56"/>` : ''
    const room = `${cellAt(b, scene.w, scene.h)}${scene.body}${shade}</svg>`
    const plate = `<rect x="${b.x + 5}" y="${b.y + 5}" width="${plateW}" height="22" fill="#4A2C2A"/><rect x="${b.x + 7}" y="${b.y + 7}" width="${plateW - 4}" height="18" fill="${dim ? '#4F4560' : '#7A4A32'}"/>`
    const meta = `<rect x="${b.x + 6}" y="${b.y + b.h - 24}" width="${metaW}" height="18" fill="#1B1730" fill-opacity=".72"/>`
    return `<g${fresh ? ' opacity="0"' : ''}>${fresh ? fadeIn : ''}${room}${plate}${line(titles[i]!, b.x + 12, b.y + 6, TITLE, CREAM)}${meta}${line(metas[i]!, b.x + 11, b.y + b.h - 25, TITLE, dim ? '#C9BEDB' : GOLD)}</g>`
  })
  return `${svgOpen(p.width, p.height, `0 0 ${p.width} ${p.height}`)}
<style>${MOTION}</style>
${zoomOf(p)}<defs>${[...defs.values()].join('')}${letterDefs(letters)}</defs>
<rect width="${p.width}" height="${p.height}" fill="#1B1730"/>${body.join('\n')}
</svg>`
}

/** The counts of the floor, for a plain image over its drawing: each in its own cell, fading in with it and dimmed with it. */
export function floorCountSvg(p: FloorInput): string {
  const { boxes, scenes } = cellsOf(p)
  let values = ''
  const body = p.rooms.map((r, i) => {
    const { input, base } = scenes[i]!
    const s = roomCount(input, { base, dim: isDim(r, i) })
    values += s.value
    const fresh = isFresh(p, i)
    return `<g${fresh ? ' opacity="0"' : ''}>${fresh ? fadeIn : ''}${cellAt(boxes[i]!, s.w, s.h)}${s.body}</svg></g>`
  })
  return `${svgOpen(p.width, p.height, `0 0 ${p.width} ${p.height}`)}${zoomOf(p)}<defs>${letterDefs(values)}</defs>${body.join('')}</svg>`
}

let lastKey = ''
let lastSvg = ''

/** Same input, same string: an unchanged source never reloads the drawing. The counts are not part of it. */
export function floorSvg(p: FloorInput): string {
  const key = JSON.stringify([getLanguage(), { ...p, rooms: p.rooms.map(r => ({ ...r, tokens: 0 })) }])
  if (key !== lastKey) {
    lastKey = key
    // A full floor gives up its furniture first; the screens and the boards always stay.
    lastSvg = [1, 2, 3, 4, 5, 6, 7].reduce((svg, detail) => (svg.length > MAX_SVG ? draw(p, detail) : svg), draw(p, 0))
  }
  return lastSvg
}
