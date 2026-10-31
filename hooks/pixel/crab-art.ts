import { canvas } from './canvas'
import type { Canvas } from './canvas'

/**
 * The mascot, one series for all themes. Each image comes with where it stands from the crab's place, the corner of a
 * zone of 20 by 14 cells: `dx` and `dy` line its feet up with those of the walk. The gestures that need the top of a
 * desk are left out: the crab lives under the desks. The `mini` sets are his walk on a floor, seen from afar, 12 by 8.
 */
export type CrabImage = { c: Canvas; dx: number; dy: number }

const INK = '#2A2036'
const P = { c: '#D97757', L: '#EE9A7C', s: '#B85A3C', e: '#1B1730', C: '#F4E4C1', Q: '#D8C49E', A: '#A8B0C8', R: '#E4505F', T: '#563E30', G: '#946C50', Y: '#FFC857' }
const FACE = ['...cccccccccccc...', '..cLLLLLLLLLLLLc..', '..cLccccccccccsc..', '..cccccccccccccc..', '..cccccccccccccs..', '..cccccccccccccc..', '...ccLccccLccs....', '...ccccccccccss...', '...cccccccccss....']
const DOS = ['...cccccccccccc...', '..cLLLLLLLLLLLLc..', '..cLccccccccccsc..', '..cccccLLLLccccc..', '..ccsccccccccscs..', '..cccsssssssccss..', '...ccccccccccs....', '...ccccccccccss...', '...cccccccccss....']
const PROFIL = ['...cccccccccccc...', '..cLLLLLLLLLLLLc..', '..sLcccccccccccc..', '..sccccccccccccc..', '..sccccccccccccc..', '..sccccccccccccc..', '...sccccccLcccc...', '...sscccccccccc...', '....sscccccccc....']
const GAUCHE = {
  bas: [0, 4, ['.c', 'cc', 'ccs']],
  tic: [0, 3, ['.c', 'cc', 'ccs']],
  plie: [1, 5, ['c', 'cs']],
  haut: [0, -4, ['cc.c', 'cccc', '.cc.', '.cc.', '.cc.', '.cc.']],
  mi: [0, 0, ['c.c', 'ccc', '.cc', '.cc', '.cc', 'cc.', 'cc.']],
} as const
const DROITE = {
  bas: [14, 4, ['..s', '..ss', 'ccss']],
  tic: [14, 3, ['..s', '..ss', 'ccss']],
  haut: [14, -4, ['c.cs', 'cccs', '.cs.', '.cs.', '.cs.', '.cs.']],
  hautD: [14, -4, ['...c.cs', '...cccs', '..ccs..', '.ccs...', '.ccs...', '.cs....']],
  mi: [15, 0, ['c.s', 'ccs', 'cs.', 'cs.', 'cs.', '.ss', 'sss']],
  avant: [14, 3, ['..c.c', '..ccc', '.ccs.', 'cccs.', 'ccs..']],
  ouvert: [14, 2, ['...ccc', '..cc..', '..c...', '..cc.', 'ccccc', 'cccss']],
  ferme: [14, 3, ['..cc.', '.cccc', 'ccccs', 'ccs..']],
} as const
type Spots = readonly (readonly [number, number])[]
const YEUX = {
  ouvert: [[4, 3], [4, 4], [12, 3], [12, 4]],
  mi: [[3, 4], [4, 4], [11, 4], [12, 4]],
  ferme: [[3, 4], [4, 4], [5, 4], [11, 4], [12, 4], [13, 4]],
  joie: [[3, 4], [4, 3], [5, 4], [11, 4], [12, 3], [13, 4]],
  grand: [[3, 2], [4, 2], [3, 3], [4, 3], [3, 4], [4, 4], [11, 2], [12, 2], [11, 3], [12, 3], [11, 4], [12, 4]],
  profil: [[10, 3], [10, 4], [13, 3], [13, 4]],
  profilFerme: [[9, 4], [10, 4], [11, 4], [13, 4], [14, 4]],
} as const satisfies Record<string, Spots>
const BOUCHE = {
  petit: [[8, 6], [9, 6]],
  moyen: [[7, 6], [8, 6], [9, 6], [10, 6], [7, 7], [8, 7], [9, 7], [10, 7]],
  grand: [[6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7]],
} as const satisfies Record<string, Spots>
const ETINCELLE = ['C.C', '.C.', 'C.C']
const PAPIER = ['CCCCCCC', 'CAAAAAC', 'CCCCCCC', 'CAAAAAC', 'CCCCCCC', 'QQQQQQQ']
const SOULIER = ['......TTT.', '.....TGGT.', '..TTTGGGGT', 'TTGGGGGGTT', 'TTTTTTTTTT']
const COUCHE = ['...cccccccccc...', '..cLLLLLLLLLLc..', '.cLccccccccccsc.', 'cccccccccccccsss', 'ccccccccccccccss', '.ccccccLLccccss.', '..cc.cccccc.cc..']
const GONFLE = ['...cccccccccc...', '..cLLLLLLLLLLc..', '.cLccccccccccsc.', '.cccccccccccccs.', 'cccccccccccccsss', 'ccccccccccccccss', '.ccccccLLccccss.', '..cc.cccccc.cc..']
const GRAND_Z = ['CCCCC', '...C.', '..C..', '.C...', 'CCCCC']
const PETIT_Z = ['CCCC', '..C.', '.C..', 'CCCC']
const MINI_FACE = ['..cccccc..', '.cLLLLLLc.', '.cecccces.', 'cccccccccs', '.cccccccs.']
const MINI_DOS = ['..cccccc..', '.cLLLLLLc.', '.cccLLccs.', 'cscccccscs', '.cccccccs.']
const MINI_PROFIL = ['..cccccc..', '.sLLLLLLc.', '.sccceces.', 'sccccccccc', '.ssccccc..']
const MINI_PAS = ['.c..c..c..', '...c..c.c.']
const MINI_PAS_PROFIL = ['..c..c....', '....c...c.']

const contour = (c: Canvas) => {
  const ring: [number, number][] = []
  for (let y = 0; y < c.h; y += 1) for (let x = 0; x < c.w; x += 1) if (!c.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => c.get(x + a!, y + b!))) ring.push([x, y])
  for (const [x, y] of ring) c.set(x, y, INK)
}
const pts = (c: Canvas, l: Spots, x: number, y: number, p: string) => {
  for (const [a, b] of l) c.set(x + a, y + b, p)
}

/** The legs: A and B in turn, a and b in profile, S apart, F folded, N straight. */
type Pattes = 'N' | 'A' | 'B' | 'a' | 'b' | 'S' | 'F'
function pattes(c: Canvas, x: number, sol: number, dy: number, m: Pattes) {
  const y0 = sol - 1 + dy
  const jambe = (px: number, lev = 0, dx = 0) => {
    for (let j = y0; j <= sol - lev; j += 1) c.set(x + px + (j === sol - lev ? dx : 0), j, j === sol - lev ? P.s : P.c)
  }
  if (m === 'N') for (const px of [4, 6, 11, 13]) jambe(px)
  if (m === 'A') { jambe(4); jambe(11); jambe(6, 1); jambe(13, 1) }
  if (m === 'B') { jambe(6); jambe(13); jambe(4, 1); jambe(11, 1) }
  if (m === 'a') { jambe(4, 0, -1); jambe(6, 1); jambe(11, 0, -1); jambe(13, 1) }
  if (m === 'b') { jambe(4, 1); jambe(6, 0, 1); jambe(11, 1); jambe(13, 0, 1) }
  if (m === 'S') { jambe(3, 0, -1); jambe(6); jambe(11); jambe(14, 0, 1) }
  if (m === 'F') { c.set(x + 2, sol, P.s); c.set(x + 15, sol, P.s) }
}

type Mark = (c: Canvas, x: number, y: number) => void
type Pose = { w?: number; h?: number; x?: number; pied?: number; dy?: number; art?: readonly string[]; yeux?: keyof typeof YEUX | null; ex?: number; ey?: number; pg?: keyof typeof GAUCHE; pd?: keyof typeof DROITE; pat?: Pattes; bouche?: keyof typeof BOUCHE; avant?: Mark; apres?: Mark; fin?: Mark; sq?: number }

/** A whole crab. `w`, `h`: its zone; `x`: the margin; `pied`: the line of the floor; `dy`: the body that rises or sits. */
function crabe(o: Pose) {
  const { w = 20, h = 14, x = 1, pied = h - 2, dy = 0, art = FACE, yeux = 'ouvert', ex = 0, ey = 0, pg = 'bas', pd = 'bas', pat = 'N', bouche, avant, apres, fin, sq = 0 } = o
  const c = canvas(w, h)
  const y = pied - 10 + dy
  avant?.(c, x, y)
  pattes(c, x, pied, dy, pat)
  c.sprite(sq ? art.filter((_, i) => i !== 5) : art, P, x, y + sq)
  const [gx, gy, gr] = GAUCHE[pg]
  const [dx, dy2, dr] = DROITE[pd]
  c.sprite(gr, P, x + gx, y + gy + sq)
  c.sprite(dr, P, x + dx, y + dy2 + sq)
  if (yeux) pts(c, YEUX[yeux], x + ex, y + ey + sq, P.e)
  if (bouche) {
    const my = y + sq - (sq ? 1 : 0)
    pts(c, BOUCHE[bouche], x, my, P.e)
    if (bouche === 'grand') pts(c, [[7, 7], [8, 7], [9, 7]], x, my, P.s)
  }
  apres?.(c, x, y)
  contour(c)
  fin?.(c, x, y)
  return c
}

const miroir = (c: Canvas) => {
  const m = canvas(c.w, c.h)
  for (let y = 0; y < c.h; y += 1) for (let x = 0; x < c.w; x += 1) m.set(c.w - 1 - x, y, c.get(x, y))
  return m
}

// The sleeper's closed eyes, and open.
const ZFERME = [[3, 3], [4, 3], [10, 3], [11, 3]] as const
const OUVERTS = [[3, 2], [3, 3], [10, 2], [10, 3]] as const

function dort(haut: boolean, yeux: Spots, z?: readonly [readonly string[], number, number]) {
  const c = canvas(22, 16)
  const y = haut ? 7 : 8
  c.sprite(haut ? GONFLE : COUCHE, P, 3, y)
  pts(c, yeux, 3, y + (haut ? 1 : 0), P.e)
  contour(c)
  if (z) c.sprite(z[0], P, z[1], z[2])
  return c
}

const FB: readonly Pattes[] = ['A', 'N', 'B', 'N']
const PROFILS: readonly Pattes[] = ['a', 'N', 'b', 'N']
const lift = (i: number) => (i % 2 ? -1 : 0)
const droite = (i: number) => crabe({ x: 0, art: PROFIL, yeux: 'profil', pg: 'plie', pd: i === 1 ? 'ferme' : 'avant', pat: PROFILS[i]!, dy: lift(i) })
const dos = (i: number) => crabe({ art: DOS, yeux: null, pg: i === 1 ? 'tic' : 'bas', pd: i === 3 ? 'tic' : 'bas', pat: FB[i]!, dy: lift(i) })
const face = (i: number) => crabe({ pg: i === 1 ? 'tic' : 'bas', pd: i === 3 ? 'tic' : 'bas', pat: FB[i]!, dy: lift(i) })

const assis = (o: Pose = {}) => crabe({ h: 18, dy: 2, pat: 'F', ...o })
const salue = (o: Pose) => crabe({ w: 24, h: 18, x: 2, ...o })
// The people sit behind their desks: the shoe comes out from under it.
const pied = (o: Pose, s = 0) => crabe({ w: 34, h: 20, art: PROFIL, yeux: 'profil', pg: 'plie', avant: c => c.sprite(SOULIER, P, 20, 14 - s), ...o })
const papier = (o: Pose) => crabe({ w: 24, h: 28, x: 2, ...o })
const feuille = (x: number, y: number): Mark => c => c.sprite(PAPIER, P, x, y)
const lueur = (l: Spots): Mark => (c, x, y) => {
  pts(c, [[15, 2], [15, 3], [15, 4], [15, 5], [14, 6]], x, y, P.L)
  pts(c, l, x, y, P.Y)
}
const feu = (o: Pose) => miroir(crabe({ w: 24, x: 3, art: PROFIL, yeux: 'profilFerme', dy: 2, pat: 'F', pg: 'plie', pd: 'avant', ...o }))
const pince = (o: Pose) => crabe({ w: 26, art: PROFIL, yeux: 'profil', pg: 'plie', ...o })
const sursaut = (o: Pose) => crabe({ w: 24, h: 24, x: 2, ...o })
const excl = (x: number, y: number): Mark => c => {
  c.rect(x, y, 2, 4, P.R)
  c.rect(x, y + 5, 2, 2, P.R)
}
const eclat = (x: number, y: number): Mark => c => c.sprite(ETINCELLE, P, x, y)
const mini = (art: readonly string[], pas: string) => {
  const c = canvas(12, 8)
  c.sprite(art, P, 1, 1)
  c.sprite([pas], P, 1, 6)
  contour(c)
  return c
}

const at =(c: Canvas, dx: number, dy: number): CrabImage => ({ c, dx, dy })
const series = (l: readonly Canvas[], dx: number, dy: number) => l.map(c => at(c, dx, dy))
const fourOf = (draw: (i: number) => Canvas) => series([0, 1, 2, 3].map(draw), 0, 0)

function drawAll() {
  const reveil = crabe({ w: 22, h: 16, x: 2, pied: 14, sq: 1, pat: 'S' })
  const profil = MINI_PAS_PROFIL.map(pas => mini(MINI_PROFIL, pas))
  return {
    miniDroite: series(profil, 0, 0),
    miniGauche: series(profil.map(miroir), 0, 0),
    miniDos: series(MINI_PAS.map(pas => mini(MINI_DOS, pas)), 0, 0),
    miniFace: series(MINI_PAS.map(pas => mini(MINI_FACE, pas)), 0, 0),
    droite: fourOf(droite),
    dos: fourOf(dos),
    face: fourOf(face),
    assis: series([assis(), assis({ sq: 1, pg: 'tic', pd: 'tic' })], 0, -4),
    regarde: series([assis({ ex: -1, pg: 'tic' }), assis({ ex: 2, pd: 'tic' }), assis({ ey: -1 })], 0, -4),
    cligne: series([assis({ yeux: 'mi' }), assis({ yeux: 'ferme' })], 0, -4),
    etire: series([crabe({ h: 18, dy: 1, sq: 1, yeux: 'ferme', pat: 'S' }), crabe({ h: 18, pg: 'mi', pd: 'mi', yeux: 'ferme' }), crabe({ h: 18, dy: -1, pg: 'haut', pd: 'haut', yeux: 'ferme', bouche: 'petit' }), crabe({ h: 18, pg: 'mi', pd: 'mi', yeux: 'mi' })], 0, -4),
    baille: series([assis({ yeux: 'mi', bouche: 'petit' }), assis({ yeux: 'ferme', bouche: 'moyen', dy: 1, pg: 'tic', pd: 'tic' }), assis({ yeux: 'ferme', bouche: 'grand', dy: 1, pg: 'mi', pd: 'mi' })], 0, -4),
    sommeil: series([dort(false, ZFERME, [PETIT_Z, 15, 3]), dort(true, ZFERME, [PETIT_Z, 16, 1]), dort(false, ZFERME, [GRAND_Z, 16, 0]), dort(true, ZFERME)], 0, 0),
    reveil: series([dort(false, OUVERTS), dort(true, OUVERTS), reveil], 0, 0),
    bond: series([crabe({ dy: 1, sq: 1, yeux: 'mi', pat: 'S' }), crabe({ dy: -1, pat: 'S', pg: 'tic', pd: 'tic', yeux: 'joie' }), crabe({ dy: 1, sq: 1, pat: 'S', pg: 'plie' })], 0, 0),
    salue: series([salue({ pd: 'mi' }), salue({ pd: 'haut', yeux: 'joie', bouche: 'petit' }), salue({ pd: 'hautD', yeux: 'joie', bouche: 'petit', dy: -1 })], -1, -4),
    pied: series([pied({ pd: 'avant' }), pied({ pd: 'ferme', x: 3, fin: eclat(21, 9) }), pied({ pd: 'avant', x: 2, dy: -1 }, 2), pied({ pd: 'bas', x: 14, pied: 15, dy: 2, pat: 'F' })], 0, -6),
    papier: series([papier({ ey: -1, apres: feuille(11, 1) }), papier({ ey: -1, dy: 1, sq: 1, pat: 'S', apres: feuille(8, 7) }), papier({ pied: 19, pg: 'haut', pd: 'haut', pat: 'S', yeux: 'grand', apres: feuille(9, 3) }), papier({ pg: 'haut', pd: 'haut', yeux: 'joie', bouche: 'petit', apres: feuille(9, 12) })], -1, -14),
    feu: series([feu({ apres: lueur([[18, 3], [18, 4], [16, 3]]) }), feu({ sq: 1, apres: lueur([[18, 5], [16, 4], [17, 5]]) }), feu({ apres: lueur([[18, 4], [16, 3], [16, 4]]) })], -2, 0),
    pince: series([pince({ pd: 'ouvert' }), pince({ pd: 'ferme', x: 3, dy: -1, fin: eclat(23, 3) }), pince({ pd: 'ferme', pat: 'a' })], 0, 0),
    sursaut: series([sursaut({ yeux: 'grand', dy: 1, sq: 1, pat: 'S', pg: 'tic', pd: 'tic', apres: excl(11, 5) }), sursaut({ pied: 15, yeux: 'grand', pg: 'haut', pd: 'haut', pat: 'S', bouche: 'petit' }), sursaut({ pied: 18, yeux: 'grand', pg: 'mi', pd: 'mi' }), sursaut({ dy: 1, sq: 1, pat: 'S', yeux: 'mi' })], -1, -10),
  }
}

export type CrabSet = keyof ReturnType<typeof drawAll>
let made: ReturnType<typeof drawAll> | null = null

/** One image of a set, drawn once for all. */
export const crabImage = (set: CrabSet, i: number): CrabImage => (made ??= drawAll())[set][i]!
