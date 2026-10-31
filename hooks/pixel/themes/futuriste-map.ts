import { t } from '../../i18n'
import { canvas, mix, noise, paths } from '../canvas'
import type { Canvas } from '../canvas'
import { fit, textWidth } from '../font'
import { once, pattern, pick, PX, WORLD } from '../pack'
import type { MapPack, MapRoom, MapView } from '../pack'
import { TENUES, person } from '../sprites'
import type { DeskState } from '../sprites'
import { line, use } from '../text'
import { bureau, chaise, droneLivreur, navette, tableau, tele, vaisseau, voiture } from './futuriste-art'

const COQUE = ['#F4F8FC', '#D4DEEA', '#A8B6CA', '#7A88A4', '#525E7E', '#343C5A', '#1E2440'] as const
const ACIER = ['#0C0E1C', '#161A2E', '#222842', '#323A5A', '#4A5478', '#6E7A9E'] as const
const CYAN = ['#0E3A4C', '#14606E', '#1E9AA6', '#3CD0D8', '#8CF4F0', '#DCFFFC'] as const
const MAGENTA = ['#4A1250', '#84207C', '#C43A9E', '#F06AC0', '#FFB0E0', '#FFE4F4'] as const
const AMBRE = '#FFC857'
const NUIT = '#0A202F'
const CLAIR = '#E4F8FF'
const PAPIER = '#0A2230'
const VOILE = '#0A0818'

/** The city from the air at night: a tile of 120 by 120 cells. `nue`: its streets alone. */
function tuile(nue: boolean) {
  const S = 120
  const c = canvas(S, S)
  c.rect(0, 0, S, S, '#0A0A1E')
  const cols = [0, 34, 62, 92], lignes = [0, 28, 66, 90]
  const larg = [31, 25, 27, 25], haut = [25, 35, 21, 27]
  lignes.forEach((y0, r) => cols.forEach((x0, q) => {
    const [bw, bh] = [larg[q]!, haut[r]!], s = q * 5 + r * 3
    c.rect(x0 + 2, y0 + 2, bw, bh, '#14142C')
    if (!nue) for (let i = 0; i < 3; i += 1) {
      const w = 6 + Math.floor(noise(i, s) * 8), h = 6 + Math.floor(noise(i, s + 1) * 8)
      const x = x0 + 3 + (i % 2) * Math.floor(bw / 2) + Math.floor(noise(i, s + 2) * 3), y = y0 + 3 + (i >> 1) * Math.floor(bh / 2) + Math.floor(noise(i, s + 3) * 3)
      if (x + w >= x0 + bw || y + h >= y0 + bh) continue
      c.rect(x + 1, y + h, w, 2, '#0C0C20')
      c.rect(x, y, w, h, i % 3 ? '#1C1A3C' : '#221F48')
      c.rect(x, y, w, 1, '#2C2858')
      if (noise(i, s + 5) > 0.55) c.set(x + Math.floor(w / 2), y + Math.floor(h / 2), i % 2 ? '#3CD0D8' : '#E8A04A')
      if (noise(i, s + 6) > 0.8) c.rect(x, y + h - 1, w, 1, i % 2 ? '#84207C' : '#14606E')
    }
  }))
  for (const y of lignes) for (let x = 3; x < S; x += 15) c.rect(x, y, 2, 1, x % 3 ? '#7A4A20' : '#5A3418')
  for (const x of cols) for (let y = 4; y < S; y += 15) c.rect(x, y, 1, 2, y % 3 ? '#7A4A20' : '#5A3418')
  return c
}
const ville = once(() => tuile(false))
const villeNue = once(() => tuile(true))

/** What breaks the repeat: an avenue of light across the city, and banks of cloud. */
const axe = once(() => {
  const [W, H] = [390, 380]
  const c = canvas(W, H)
  for (let y = 0; y < H; y += 4) {
    const x = Math.round(70 + y * 0.42 + 26 * Math.sin(y * 0.016))
    c.rect(x - 4, y, 9, 4, '#2A1250')
    c.rect(x - 3, y, 1, 4, MAGENTA[1])
    c.rect(x + 3, y, 1, 4, CYAN[1])
    if (y % 12 === 0) c.set(x, y, MAGENTA[3])
  }
  for (const [x0, y0, l] of [[210, 40, 150], [20, 170, 120], [240, 300, 130]] as const) for (let j = 0; j < 7; j += 1) c.rect(x0 + j * 9, y0 + j, l - j * 16, 1, '#B8B0E8|0.07')
  return c
})

type Look = { d1: string; d2: string; pl: string; r1: string; r2: string; w1: string; w2: string; band: string; h: readonly [string, string, string, string]; lamp: string; mark: string; glow: boolean }
const ACTIF: Look = { d1: '#1C1E34', d2: '#22253E', pl: '#14152A', r1: COQUE[1], r2: COQUE[3], w1: COQUE[3], w2: COQUE[5], band: CYAN[3], h: [ACIER[4], ACIER[3], ACIER[2], ACIER[1]], lamp: CYAN[4], mark: CYAN[1], glow: true }
const REPOS: Look = { d1: '#15162A', d2: '#191B30', pl: '#101120', r1: '#5A607C', r2: '#3E4460', w1: '#2E3450', w2: '#1E2238', band: '#2A3048', h: ['#2A2E46', '#222640', '#1A1E34', '#141628'], lamp: '#3A4260', mark: '#20243C', glow: false }

/** Whether (u, v) falls on a deck of shape `f`: 0 a disc, 1 a hexagon, 2 an octagon. */
function dedans(f: number, u: number, v: number) {
  const [a, b] = [Math.abs(u), Math.abs(v)]
  if (f === 1) return b < 0.9 && a + b * 0.62 < 1
  if (f === 2) return a < 1 && b < 0.92 && a + b < 1.42
  return u * u + v * v < 1
}

/** A platform: its deck, the lit edge, the tapering hull, the beam that holds it up. */
function pose(c: Canvas, cx: number, cy: number, rx: number, ry: number, f: number, ep: number, H: number, P: Look) {
  if (P.glow) for (let i = 0; i < 16; i += 1) {
    const hw = Math.round(rx * 0.16 + i * 0.5)
    c.rect(cx - hw, cy + ep + H + i, hw * 2, 1, `${CYAN[4]}|${(0.2 - i * 0.012).toFixed(3)}`)
  }
  for (let i = H; i > 0; i -= 1) {
    const q = i / H, s = 1 - 0.82 * q, yc = cy + ep + q * H + (1 - s) * ry, [a, b] = [rx * s, ry * s]
    for (let y = Math.floor(yc - b); y <= yc + b; y += 1) for (let x = Math.floor(cx - a); x <= cx + a; x += 1) {
      if (!dedans(f, (x - cx) / a, (y - yc) / b)) continue
      const u = (x - cx) / a
      c.set(x, y, P.h[u < -0.55 ? 0 : u < 0.1 ? 1 : u < 0.6 ? 2 : 3])
    }
    if (i % 6 === 3) for (let x = Math.round(cx - a); x < cx + a; x += 1) if (c.get(x, Math.round(yc + b - 1))) c.set(x, Math.round(yc + b - 1), P.band)
  }
  for (let i = ep; i > 0; i -= 1) for (let y = Math.floor(cy + i - ry); y <= cy + i + ry; y += 1) for (let x = cx - rx; x <= cx + rx; x += 1) {
    if (!dedans(f, (x - cx) / rx, (y - cy - i) / ry)) continue
    c.set(x, y, i === Math.ceil(ep / 2) ? P.band : i < ep / 2 ? P.w1 : P.w2)
  }
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) for (let x = cx - rx; x <= cx + rx; x += 1) {
    const [u, v] = [(x - cx) / rx, (y - cy) / ry]
    if (!dedans(f, u, v)) continue
    if (!dedans(f, u / 0.95, v / 0.92)) {
      c.set(x, y, v < 0.1 ? P.r1 : P.r2)
      continue
    }
    if (dedans(f, u / 0.76, v / 0.74) && !dedans(f, u / 0.72, v / 0.7) && (x + y * 3) % 7 < 4) {
      c.set(x, y, P.mark)
      continue
    }
    c.set(x, y, y % 5 === 0 ? P.pl : y % 10 < 5 ? P.d1 : P.d2)
  }
  for (let i = -5; i <= 5; i += 1) {
    const x = cx + Math.round(i * rx * 0.17)
    for (let y = cy - ry; y < cy; y += 1) if (c.get(x, y)) {
      c.rect(x, y + 1, 1, 1, P.lamp)
      break
    }
  }
}

/** An ordinary platform, 100 by 76 cells. A mast, a bubble or a tank tells the shapes apart. */
function plateforme(f: number, repos: boolean) {
  const c = canvas(100, 76)
  const P = repos ? REPOS : ACTIF
  pose(c, 50, 26, 48, 21, f, 4, 18, P)
  if (f === 0) {
    c.rect(88, 2, 2, 20, P.h[1])
    c.rect(88, 2, 1, 20, P.h[0])
    c.rect(86, 6, 6, 1, P.band)
    c.set(88, 1, repos ? '#3A4260' : '#FF5A6E')
  }
  if (f === 1) {
    c.rect(6, 12, 7, 12, P.h[1])
    c.rect(6, 12, 1, 12, P.h[0])
    c.rect(7, 10, 5, 2, P.w1)
    c.rect(8, 15, 3, 1, P.band)
    c.rect(8, 18, 3, 1, P.band)
  }
  if (f === 2) {
    c.rect(86, 8, 8, 14, P.h[2])
    c.rect(86, 8, 8, 1, P.h[0])
    for (let y = 11; y < 21; y += 3) c.rect(87, y, 6, 1, P.band)
  }
  return c
}

/** The platform of the one that leads, 190 by 132 cells, with a second deck and a mast. */
const plateformeChef = once(() => {
  const c = canvas(190, 132)
  pose(c, 95, 50, 93, 42, 1, 6, 28, { ...ACTIF, band: MAGENTA[3], mark: CYAN[2] })
  pose(c, 95, 24, 54, 16, 1, 4, 3, { ...ACTIF, band: CYAN[3], glow: false })
  c.rect(93, 0, 3, 14, ACIER[3])
  c.rect(93, 0, 1, 14, ACIER[5])
  c.rect(89, 4, 11, 1, CYAN[4])
  c.set(94, 0, '#FF5A6E')
  return c
})

/** The landing pad of the news: the drone sets down there, the rack keeps the pile. 34 by 26 cells. */
const casier = once(() => {
  const c = canvas(34, 26)
  c.rect(1, 22, 32, 4, `${VOILE}|0.42`)
  c.rect(2, 8, 30, 15, ACIER[3])
  c.rect(2, 8, 30, 1, ACIER[5])
  c.rect(2, 8, 1, 15, ACIER[5])
  c.rect(31, 8, 1, 15, ACIER[0])
  c.rect(2, 22, 30, 1, CYAN[3])
  for (const y of [11, 16]) {
    c.rect(5, y, 24, 3, ACIER[0])
    c.rect(5, y, 24, 1, ACIER[1])
  }
  c.rect(7, 4, 20, 4, '#FFF6DE')
  c.rect(7, 4, 20, 1, '#D8C49E')
  c.rect(15, 5, 4, 2, '#E4633A')
  c.rect(10, 2, 14, 2, CYAN[4])
  c.rect(12, 0, 10, 2, `${CYAN[4]}|0.4`)
  return c
})

const enveloppe = once(() => {
  const c = canvas(10, 7)
  c.rect(0, 0, 10, 7, '#FFF6DE')
  c.rect(0, 6, 10, 1, '#D8C49E')
  c.rect(4, 2, 2, 2, '#E4633A')
  return c
})

type Place = { x: number; y: number; k: number }
type Box = { x: number; y: number; w: number; h: number }
type Edges = readonly [number, number, number, number]

/** Where the block of the one that leads stands, and the hub its bridges leave from. */
const tete = (n: number) => (n === 2 ? { x: 53, y: 308, k: 1.25, hx: 290, hy: 470 } : { x: 200, y: 214, k: 1, hx: 390, hy: 372 })

/** The others on a ring around it, at the same steps whatever they do: no platform stands ahead of another. */
function anneau(n: number): Place[] {
  // Alone, the other rises to the upper right and grows, like the one that leads.
  if (n === 2) return [{ x: 590, y: 135, k: 1.5 }]
  const autres = n - 1
  const k = autres > 7 ? 0.85 : 1
  const dep = autres === 2 || autres === 4 ? -Math.PI * 0.75 : -Math.PI / 2
  return Array.from({ length: autres }, (_, i) => {
    const a = dep + (i * Math.PI * 2) / autres
    // The keel of the lowest platform stays on the world.
    return { x: Math.round(390 + Math.cos(a) * 290), y: Math.min(Math.round(372 + Math.sin(a) * 286), Math.round(WORLD.h - 110 * k)), k }
  })
}

// A platform counts down to its status plate: its keel may run on over the block of the one that leads.
const zone = (p: Place): Box => {
  const x = Math.round(p.x - 100 * p.k), y = Math.round(p.y - 50 * p.k)
  return { x, y, w: Math.round(p.x + 100 * p.k) - x, h: Math.round(p.y + 78 * p.k) - y }
}

const compteTete = (n: number) => {
  const h = tete(n)
  return { x: Math.round(h.x + 148 * h.k), y: Math.round(h.y + 58 * h.k), size: 20 * h.k, ink: CLAIR }
}

/** The block of the one that leads, cut back wherever a neighbour reaches in, by the least it can lose. */
function zoneTete(n: number): Box {
  const h = tete(n), spot = compteTete(n)
  let box: Edges = [h.x, Math.round(h.y + 12 * h.k), Math.round(h.x + 380 * h.k), Math.round(h.y + 296 * h.k)]
  const area = (e: Edges) => (e[2] - e[0]) * (e[3] - e[1])
  for (const o of anneau(n).map(zone)) {
    const [l, t, r, b] = box
    if (o.x >= r || o.x + o.w <= l || o.y >= b || o.y + o.h <= t) continue
    const cuts: Edges[] = [[l, t, Math.min(r, o.x), b], [Math.max(l, o.x + o.w), t, r, b], [l, t, r, Math.min(b, o.y)], [l, Math.max(t, o.y + o.h), r, b]]
    box = cuts.filter(e => spot.x >= e[0] && spot.x <= e[2] && spot.y >= e[1] && spot.y <= e[3]).reduce((best, e) => (area(e) > area(best) ? e : best))
  }
  return { x: box[0], y: box[1], w: box[2] - box[0], h: box[3] - box[1] }
}

/** The bridges of light, on the world's cells: two lines and rungs, or a few dashes to a platform at rest. */
function ponts(n: number, repos: readonly boolean[], barreaux: boolean) {
  const c = canvas(WORLD.w / PX, WORLD.h / PX)
  const h = tete(n)
  const [cx, cy, rx, ry] = [(h.x + 190 * h.k) / PX, (h.y + 130 * h.k) / PX, 93 * h.k, 44 * h.k]
  const [x0, y0] = [Math.round(h.hx / PX), Math.round(h.hy / PX)]
  anneau(n).forEach((p, i) => {
    const [x1, y1] = [Math.round(p.x / PX), Math.round((p.y + 52 * p.k) / PX)]
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    const [dx, dy] = [(x1 - x0) / steps, (y1 - y0) / steps]
    const flat = Math.abs(dx) > Math.abs(dy)
    const [nx, ny] = flat ? [0, 1] : [1, 0]
    for (let j = 0; j <= steps; j += 1) {
      const [x, y] = [Math.round(x0 + dx * j), Math.round(y0 + dy * j)]
      // Under the deck nothing shows: leave it out of the weight.
      if (dedans(1, (x - cx) / rx, (y - cy) / ry)) continue
      if (repos[i]) {
        if (j % 6 < 3) c.set(x, y, '#2A3048')
        continue
      }
      c.set(x - nx * 2, y - ny * 2, CYAN[3])
      c.set(x + nx * 2, y + ny * 2, CYAN[2])
      if (barreaux && j % 8 < 2) for (const k of [-1, 0, 1]) c.set(x + nx * k, y + ny * k, CYAN[4])
    }
  })
  return c
}

/** At these sizes a sprite stays a sprite; past that, a crowd shrinks until each one has a desk. */
function rangees(n: number, w: number, h: number, top: number) {
  for (const s of [top, 1, 0.7, 0.6, 0.45, 0.36, 0.25, 0.18]) {
    if (s > top) continue
    const cols = Math.floor(w / (60 * s)), rows = Math.max(1, Math.floor(h / (45 * s)))
    if (cols * rows >= n) return { s, cols, rows }
  }
  return { s: 0.18, cols: Math.floor(w / 10.8), rows: Math.max(1, Math.floor(h / 8.1)) }
}

type Gens = { hue: number | null; state: DeskState | 'rest' }

/** One sprite each per use: `need` only keeps what this floor draws. */
function postes(gens: readonly Gens[], cx: number, y: number, w: number, h: number, top: number, need: (id: string, draw: () => string) => void) {
  const { s, cols, rows } = rangees(gens.length, w, h, top)
  return gens.map((g, i) => {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, gens.length - row * cols)
    const [px, py] = [cx - (inRow * 60 * s) / 2 + (i % cols) * 60 * s, y + h - (rows - row) * 45 * s]
    const desk = `b${g.state}`
    need(desk, () => `<g id="${desk}">${paths(bureau(g.state))}</g>`)
    let body = use(desk)
    if (g.hue !== null) {
      const tenue = TENUES[g.hue % TENUES.length]!
      need('ch', () => `<g id="ch">${paths(chaise())}</g>`)
      need(tenue, () => `<g id="${tenue}">${paths(person(tenue))}</g>`)
      body = `${use('ch')}${use(tenue, 22, -2)}${body}`
    }
    return `<g transform="translate(${r2(px)} ${r2(py)})${s === 1 ? '' : ` scale(${s})`}">${body}</g>`
  }).join('')
}

const r2 = (n: number) => Math.round(n * 100) / 100
const plate = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${r2(x)}" y="${y}" width="${r2(w)}" height="${h}" fill="${fill}"/>`

// The plates of the state stay as wide at rest: the tokens stand on their image, where nothing knows their width.
const ETAT = { x: 31, w: 138, text: 96, count: 52 }

/** The board of the one that leads, standing on the same line however long its list. Pixels of its block. */
function tableauDe(list: MapView['list'], need: (id: string, draw: () => string) => void) {
  const lines = list.map(l => fit(l.text, 14, 132))
  const h = Math.max(90, 47 + 17 * lines.length)
  const id = `tb${h}`
  need(id, () => `<g id="${id}">${paths(tableau(172, h))}</g>`)
  const top = 278 - (h + 8)
  const title = t('room.conversations')
  const body = lines.map((text, i) => {
    const y = top + 37 + 17 * i
    const status = list[i]!.status
    const box = status === 'in_progress'
      ? plate(220, y + 6, 6, 6, AMBRE)
      : status === 'completed'
        ? `${plate(220, y + 6, 6, 6, CYAN[2])}${plate(222, y + 8, 2, 2, CYAN[5])}`
        : plate(220, y + 6, 6, 6, PAPIER)
    return `${plate(218, y + 4, 10, 10, CYAN[4])}${box}${line(text, 234, y, 14, status === 'pending' ? '#7FB0C0' : status === 'completed' ? '#A8D8E0' : '#FFFFFF')}`
  }).join('')
  return { svg: `<g transform="translate(200 ${top})">${use(id)}</g>${line(title, 216, top + 14, 16, CLAIR)}${body}`, words: `${title}${lines.join('')}` }
}

function dessinTete(r: MapRoom, v: MapView, n: number, need: (id: string, draw: () => string) => void) {
  const h = tete(n)
  need('chef', () => `<g id="chef" transform="scale(${PX})">${paths(plateformeChef())}</g>`)
  need('ecr', () => `<g id="ecr" transform="scale(1.8)">${paths(tele())}</g>`)
  need('cas', () => `<g id="cas" transform="scale(${PX})">${paths(casier())}</g>`)
  const title = fit(r.title, 14, 150)
  const meta = fit(r.meta, 12, 160)
  const label = t('room.tokens')
  const [tw, mw] = [textWidth(title, 14) + 16, textWidth(meta, 12) + 16]
  // The boss has his desk at work and at rest.
  const gens: Gens[] = r.people[0]?.hue === 0 ? r.people : [{ hue: 0, state: 'rest' }, ...r.people]
  const panel = tableauDe(v.list, need)
  const shown = String(v.news.shown)
  const cw = textWidth(shown, 14) + 15
  const counter = v.news.shown ? `${plate(160, 182, cw, 20, '#1B1730')}${plate(162, 184, cw - 4, 16, '#B8452A')}${line(shown, 167, 181, 14, '#FFF6DE')}` : ''
  const svg = `<g transform="translate(${h.x} ${h.y})${h.k === 1 ? '' : ` scale(${h.k})`}">`
    + `<g transform="translate(0 30)">${use('chef')}</g>`
    + `<g transform="translate(116 48)">${use('ecr')}</g>${line(label, 148 - textWidth(label, 9) / 2, 78, 9, '#B4C9C5')}`
    + postes(gens, 129, 120, 150, 67.5, 1.5, need)
    + panel.svg
    + `<g transform="translate(110 188)">${use('cas')}</g>${counter}`
    + `${plate(131 - tw / 2, 12, tw, 22, NUIT)}${plate(131 - tw / 2, 12, tw, 2, CYAN[3])}${line(title, 139 - tw / 2, 12, 14, CLAIR)}`
    + `${plate(20, 266, mw, 20, NUIT)}${line(meta, 28, 267, 12, AMBRE)}</g>`
  return { svg, words: `${title}${meta}${label}${panel.words}${shown}` }
}

function dessinAutre(r: MapRoom, p: Place, detail: number, need: (id: string, draw: () => string) => void) {
  const f = detail < 5 ? pick(r.seed, 3, 3) : 2
  const id = `${r.rest ? 'pr' : 'pf'}${f}`
  need(id, () => `<g id="${id}" transform="scale(${PX})">${paths(plateforme(f, r.rest))}</g>`)
  const title = fit(r.title, 14, 170)
  const meta = fit(r.meta, 12, ETAT.text)
  const tw = textWidth(title, 14) + 16
  const gens: Gens[] = r.people.length ? r.people.map(o => ({ hue: o.hue, state: o.state })) : r.rest ? [{ hue: null, state: 'rest' }, { hue: null, state: 'rest' }] : []
  const seats = postes(gens, 100, 45, 180, 50, 1, need)
  const [plaque, ligne, nom, etat] = r.rest ? ['#102736', '#3E4460', '#8088A8', '#8088A8'] : [NUIT, CYAN[3], CLAIR, CYAN[4]]
  const svg = `<g transform="translate(${p.x - 100 * p.k} ${p.y - 50 * p.k})${p.k === 1 ? '' : ` scale(${p.k})`}">`
    + `<g transform="translate(0 20)">${use(id)}</g>`
    + (r.rest ? `<g opacity=".6">${seats}</g>` : seats)
    + `${plate(100 - tw / 2, 20, tw, 22, plaque)}${plate(100 - tw / 2, 20, tw, 2, ligne)}${line(title, 108 - tw / 2, 20, 14, nom)}`
    + `${plate(ETAT.x, 104, ETAT.w, 20, plaque)}${line(meta, r2(ETAT.x + 8 + (ETAT.text - textWidth(meta, 12)) / 2), 105, 12, etat)}</g>`
  return { svg, words: `${title}${meta}` }
}

/** The drone: parked beside the rack, or down from the sky with the news, once. */
function drone(v: MapView, n: number, need: (id: string, draw: () => string) => void) {
  const h = tete(n)
  if (!v.news.flying && v.detail > 1) return ''
  need('dr', () => `<g id="dr" transform="scale(1.2)">${paths(droneLivreur(0))}</g>`)
  if (!v.news.flying) return `<g transform="translate(${n === 2 ? '96 470' : '232 392'})">${use('dr')}</g>`
  need('env', () => `<g id="env" transform="scale(${PX})">${paths(enveloppe())}</g>`)
  const [x, y] = [Math.round(h.x + 144 * h.k - 29), Math.round(h.y + 188 * h.k - 66)]
  const hold = 0.55, gone = 0.72
  const fall = `<animateTransform attributeName="transform" type="translate" values="0 ${-y - 80};0 0;0 0;0 ${-y - 80}" keyTimes="0;${hold};${gone};1" dur="${v.flightS}s" fill="freeze"/>`
  const drop = `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${hold};${(hold + gone) / 2};1" dur="${v.flightS}s" fill="freeze"/>`
  return `<g class="ev" transform="translate(${x} ${y})"><g>${fall}${use('dr')}<g transform="translate(14 48)">${drop}${use('env')}</g></g></g>`
}

function vehicules(n: number, need: (id: string, draw: () => string) => void) {
  const zones = anneau(n).map(zone)
  const at = (id: string, art: Canvas, x: number, y: number, s: number) => {
    if (zones.some(z => x < z.x + z.w && x + art.w * s > z.x && y < z.y + z.h && y + art.h * s > z.y)) return ''
    need(id, () => `<g id="${id}">${paths(art)}</g>`)
    return `<g transform="translate(${x} ${y}) scale(${s})">${use(id)}</g>`
  }
  if (n === 2) return `${at('vs', vaisseau(0), 70, 70, 1.6)}${at('vo', voiture(0), 600, 430, 1.4)}${at('nv', navette(0), 110, 690, 1.2)}`
  return `${at('nv', navette(0), 560, 70, 1.2)}${at('vo', voiture(0), 60, 330, 1.4)}${at('vo', voiture(1), 640, 690, 1.4)}`
}

export const futuristeMap: MapPack = {
  back: mix('#0A0A1E', VOILE, 0.3),
  places(n) {
    return [zoneTete(n), ...anneau(n).map(zone)]
  },
  counts(n) {
    return [compteTete(n), ...anneau(n).map(p => ({ x: Math.round(p.x + ETAT.count * p.k), y: Math.round(p.y + 55 * p.k), size: 12 * p.k, ink: AMBRE }))]
  },
  draw(v) {
    const n = v.rooms.length
    const used = new Map<string, string>()
    const need = (id: string, draw: () => string) => {
      if (!used.has(id)) used.set(id, draw())
    }
    const places = anneau(n)
    const made = v.rooms.map((r, i) => (i ? dessinAutre(r, places[i - 1]!, v.detail, need) : dessinTete(r, v, n, need)))
    // Past the limit the world gives up, in order: vehicles, parked drone, avenue, rungs, the platforms' shapes, the buildings.
    const decor = v.detail < 1 ? vehicules(n, need) : ''
    const avenue = v.detail < 3 ? `<g transform="scale(${PX})">${paths(axe())}</g>` : ''
    const liens = paths(ponts(n, v.rooms.slice(1).map(r => r.rest), v.detail < 4))
    const back = `<rect width="${WORLD.w}" height="${WORLD.h}" fill="url(#ville)"/>${avenue}<rect width="${WORLD.w}" height="${WORLD.h}" fill="${VOILE}" fill-opacity=".3"/>${decor}<g transform="scale(${PX})">${liens}</g>`
    const front = drone(v, n, need)
    return { defs: `${pattern('ville', v.detail < 6 ? ville() : villeNue())}${[...used.values()].join('')}`, back, rooms: made.map(m => m.svg), front, words: made.map(m => m.words).join('') }
  },
  walk(n) {
    const h = tete(n)
    const c = { x: h.x + 190 * h.k, y: h.y + 130 * h.k }
    const [rx, ry] = [93 * h.k * PX, 44 * h.k * PX]
    const rim = (a: number) => ({ x: Math.round(c.x + rx * Math.cos(a)), y: Math.round(c.y + ry * Math.sin(a)) })
    const stops = anneau(n).map(p => {
      const end = { x: p.x, y: p.y + 52 * p.k }
      const [dx, dy] = [end.x - c.x, end.y - c.y]
      const long = Math.hypot(dx, dy) || 1
      // The bridge ends under the desks: the crab turns back at the edge of the platform.
      const edge = 1 / Math.hypot(dx / long / (100 * p.k), dy / long / (58 * p.k)) + 8
      return { a: Math.atan2(dy / ry, dx / rx), near: { x: Math.round(end.x - (dx / long) * edge), y: Math.round(end.y - (dy / long) * edge) } }
    }).sort((u, v) => u.a - v.a)
    const STEP = Math.PI / 12
    // Round the rim of the great platform, so it never crosses its desks, and out along each bridge.
    return stops.flatMap((o, i) => {
      const next = stops[(i + 1) % stops.length]!
      const gap = i === stops.length - 1 ? next.a + 2 * Math.PI - o.a : next.a - o.a
      const arc = Array.from({ length: Math.max(1, Math.ceil(gap / STEP)) }, (_, k) => rim(o.a + (k * gap) / Math.max(1, Math.ceil(gap / STEP))))
      return [rim(o.a), o.near, ...arc]
    })
  },
}
