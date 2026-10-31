import type { RoomTheme } from '../types'
import type { FloorRoom, KidState } from './desks'
import { seedOf } from './draw'
import type { Box } from './draw'
import { getLanguage, plural, t } from './i18n'
import { mix } from './pixel/canvas'
import { textWidth } from './pixel/font'
import { WORLD } from './pixel/pack'
import type { MapRoom, MapView } from './pixel/pack'
import { packOf } from './pixel/themes'
import { AT_REST, FLIGHT_MS, MAX_SVG, MOTION, SHADE, formatTokens, letterDefs, line } from './room'
import type { RoomInput } from './room'

/** `news`: what the conversation that leads shows; absent, an empty tray. */
export type FloorInput = { rooms: FloorRoom[]; previous: number; width: number; height: number; news?: MapView['news']; theme?: RoomTheme }

// A world shows this many conversations: the one that leads, then those at work first.
const MOST = 11
const TITLE = 16
const LINES: Record<KidState, RoomInput['steps'][number]['status']> = { working: 'in_progress', done: 'completed', failed: 'pending', idle: 'pending' }
const CREAM = '#F4E4C1'
const INK = '#1B1730'
const MARGIN = 3000

/** What the world has room for, in order. A conversation past that stays on the list of the one that leads. */
export function shownRooms(rooms: readonly FloorRoom[]) {
  if (rooms.length <= MOST) return [...rooms]
  const [chief, ...others] = rooms
  const busy = (r: FloorRoom) => (r.working || r.manager?.working ? 0 : 1)
  return [chief!, ...others.map((r, i) => ({ r, i })).sort((a, b) => busy(a.r) - busy(b.r) || a.i - b.i).slice(0, MOST - 1).map(o => o.r)]
}

/** How the world sits in a pane: whole, at the largest scale that fits, what is left over painted the world's colour. */
export const fitted = (width: number, height: number) => {
  const k = Math.min(width / WORLD.w, height / WORLD.h)
  return { k, x: (width - WORLD.w * k) / 2, y: (height - WORLD.h * k) / 2 }
}

/** Where each conversation falls in a pane, the one that leads first. */
export function floorBoxes(n: number, width: number, height: number, theme?: RoomTheme): Box[] {
  const f = fitted(width, height)
  return packOf(theme).map.places(Math.min(n, MOST)).map(b => ({ x: Math.round(f.x + b.x * f.k), y: Math.round(f.y + b.y * f.k), w: Math.round(b.w * f.k), h: Math.round(b.h * f.k) }))
}

// A conversation at rest: no agent at work, and its manager between two turns.
const isDim = (r: FloorRoom, i: number) => i > 0 && r.working === 0 && !r.manager?.working
const isFresh = (p: FloorInput, i: number) => i >= p.previous && p.previous !== p.rooms.length
const fadeIn = '<animate attributeName="opacity" from="0" to="1" begin=".75s" dur=".3s" fill="freeze"/>'
const zoomOf = (p: FloorInput) => (p.previous !== p.rooms.length && p.previous > 0 ? `<animate attributeName="viewBox" from="${WORLD.w * 0.1} ${WORLD.h * 0.1} ${WORLD.w * 0.8} ${WORLD.h * 0.8}" to="0 0 ${WORLD.w} ${WORLD.h}" dur=".8s" fill="freeze"/>` : '')
const open = (p: FloorInput) => `<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}" height="${p.height}" viewBox="0 0 ${WORLD.w} ${WORLD.h}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">`

/** What a conversation's line says under its name. */
function metaOf(r: FloorRoom, i: number) {
  // The manager counts as an agent of the conversation that leads.
  const agents = i ? r.agents : r.agents + 1
  const count = agents ? plural('overview.agents', agents, { n: agents }) : t('band.idle')
  if (i === 0) return t('floor.meta', { count, summary: r.summary || t('floor.coordinates') })
  return agents ? t('floor.working', { count }) : r.manager?.working ? t('manager.working') : count
}

function mapRoom(r: FloorRoom, i: number): MapRoom {
  const manager = r.manager ?? AT_REST
  const people = [...(manager.working ? [{ hue: 0, state: 'working' as const }] : []), ...r.desks.map(d => ({ hue: d.hue, state: d.state }))]
  return { id: r.id, seed: seedOf(r.id), title: r.title, meta: metaOf(r, i), rest: isDim(r, i), chief: i === 0, people, working: r.working + (manager.working ? 1 : 0) }
}

function viewOf(p: FloorInput, detail: number): MapView {
  const rooms = shownRooms(p.rooms)
  return { rooms: rooms.map(mapRoom), list: rooms.slice(1).map(kid => ({ text: kid.title, status: LINES[kid.state ?? 'idle'] })), news: p.news ?? { shown: 0, flying: false }, detail, flightS: FLIGHT_MS / 1000 }
}

/** The count of the conversations a world has no place for, over its lower right corner. */
function moreSign(n: number) {
  if (n <= MOST) return { body: '', words: '' }
  const words = t('floor.more', { n: n - MOST })
  const w = Math.ceil(textWidth(words, TITLE)) + 14
  return { words, body: `<rect x="${WORLD.w - w - 8}" y="${WORLD.h - 30}" width="${w}" height="22" fill="${INK}" fill-opacity=".72"/>${line(words, WORLD.w - w - 1, WORLD.h - 31, TITLE, CREAM)}` }
}

function draw(p: FloorInput, detail: number) {
  const pack = packOf(p.theme)
  const made = pack.map.draw(viewOf(p, detail))
  const more = moreSign(p.rooms.length)
  const rooms = made.rooms.map((svg, i) => (isFresh(p, i) ? `<g opacity="0">${fadeIn}${svg}</g>` : svg))
  return `${open(p)}
<style>${MOTION}${made.style ?? ''}</style>
${zoomOf(p)}<defs>${made.defs}${letterDefs(made.words + more.words)}</defs>
<rect x="${-MARGIN}" y="${-MARGIN}" width="${WORLD.w + 2 * MARGIN}" height="${WORLD.h + 2 * MARGIN}" fill="${pack.map.back}"/>${made.back}${rooms.join('\n')}${made.front}${more.body}
</svg>`
}

/** The counts of the floor, for a plain image over its drawing: each at its place, fading in with it and dimmed with it. */
export function floorCountSvg(p: FloorInput): string {
  const rooms = shownRooms(p.rooms)
  const spots = packOf(p.theme).map.counts(rooms.length)
  let values = ''
  const body = rooms.map((r, i) => {
    const s = spots[i]!
    const value = formatTokens(r.tokens)
    values += value
    const ink = isDim(r, i) ? mix(s.ink, SHADE.ink, SHADE.alpha) : s.ink
    const fresh = isFresh(p, i)
    return `<g${fresh ? ' opacity="0"' : ''}>${fresh ? fadeIn : ''}${line(value, Math.round(s.x - textWidth(value, s.size) / 2), s.y, s.size, ink)}</g>`
  })
  return `${open(p)}${zoomOf(p)}<defs>${letterDefs(values)}</defs>${body.join('')}</svg>`
}

let lastKey = ''
let lastSvg = ''

/** Same input, same string: an unchanged source never reloads the drawing. The counts are not part of it. */
export function floorSvg(p: FloorInput): string {
  const key = JSON.stringify([getLanguage(), { ...p, rooms: p.rooms.map(r => ({ ...r, tokens: 0 })) }])
  if (key !== lastKey) {
    lastKey = key
    // A full world gives up its detail step by step; names and places always stay.
    lastSvg = [1, 2, 3, 4, 5, 6, 7].reduce((svg, detail) => (svg.length > MAX_SVG ? draw(p, detail) : svg), draw(p, 0))
  }
  return lastSvg
}
