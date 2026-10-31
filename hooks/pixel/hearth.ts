import { canvas, paths } from './canvas'
import type { Paint } from './canvas'
import { WOOD as W } from './sprites'

export type Point = { x: number; y: number }
/** One fixed drawing: `w`, `h` and `anchor` in cells, 2 pixels of the room each, as `svg` is sized. */
export type Sprite = { svg: string; w: number; h: number; anchor: Point }

export type FireLevel = 'full' | 'medium' | 'low' | 'embers' | 'out'
export type AshLevel = 'none' | 'small' | 'medium' | 'large' | 'full'
export type KeeperPose = 'carry' | 'drop' | 'walk' | 'broom' | 'sweep'
export type EnvelopeState = 'discreet' | 'waiting' | 'bright'

export const FIRE_LEVELS: readonly FireLevel[] = ['full', 'medium', 'low', 'embers', 'out']
export const ASH_LEVELS: readonly AshLevel[] = ['none', 'small', 'medium', 'large', 'full']
export const KEEPER_POSES: readonly KeeperPose[] = ['carry', 'drop', 'walk', 'broom', 'sweep']
export const ENVELOPE_STATES: readonly EnvelopeState[] = ['discreet', 'waiting', 'bright']

/** Every paint of the hearth, from the components of the design file. */
export const HEARTH_PALETTE: Record<string, Paint> = {
  o: '#2A2036', r: '#6A6E8C', l: '#565A78', m: '#484C66', d: '#3F4258', h: '#A8B0C8', n: '#1B1730', g: '#9DB4FF',
  b: W[1], w: W[2], W: W[3], a: W[4], t: W[5], k: '#C98B3C', K: '#C9A24A', L: '#D8C49E', c: '#FFF6DE', f: '#F9F1DE',
  R: '#B8452A', e: '#E4633A', y: '#FFC857', A: '#A59A90', C: '#D6CFC4', G: '#8A8078', H: '#7A6A5E',
  B: '#C75A4E', P: '#D9786A', D: '#A84640', s: '#F0C8A0', S: '#CD9D81', E: '#1F1A2E', j: '#EB8A6B', q: '#6F5036',
  u: '#3F6C8C', U: '#2C5068', v: '#5A8CAE', 1: '#1B1730|0.28', 2: '#FFC857|0.22', 3: '#FFF6DE|0.5', 4: '#FFC857|0.45',
}

type Layer = readonly [x: number, y: number, rows: readonly string[]]

/** The stove, the flue, the fire and the ash stack on this grid, as in the design; the flue stands at its top left. */
const STOVE = { w: 48, h: 68 }
/** The middle of the stove's feet on the floor. Its shadow, and a full ash heap, reach below. */
const BASE: Point = { x: 24, y: 61 }
/** Where the ash grid starts on the stove's. */
export const ASH_TOP = 48
const WINDOW: Point = { x: 16, y: 33 }
const FLOOR: Point = { x: 11, y: 61 }

/** Where the keeper's log lands on the stove, in the stove's grid. */
export const STOVE_DEPOSIT: Point = { x: 30, y: 50 }
/** The keeper's feet on the floor, in the keeper's grid. */
export const KEEPER_FEET: Point = { x: 20, y: 29 }
/** The tip of the log the keeper holds out: put it on `STOVE_DEPOSIT`. */
const LOG_TIP: Point = { x: 0, y: 22 }
/** The middle of the letter's lower edge, in every state. */
const LETTER: Point = { x: 7, y: 9 }

function sprite(w: number, h: number, anchor: Point, layers: readonly Layer[]): Sprite {
  const c = canvas(w, h)
  for (const [x, y, rows] of layers) c.sprite(rows, HEARTH_PALETTE, x, y)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${paths(c)}</svg>`
  return { svg, w, h, anchor }
}

/** A sprite's paths, for a drawing that lays it on a grid of its own. */
export const spriteBody = (s: Sprite) => s.svg.slice(s.svg.indexOf('>') + 1, -'</svg>'.length)

/** Past the last image the sequence starts over, so a clock can drive it. */
const image = <T>(images: readonly T[], frame: number) => images[Math.abs(Math.trunc(frame)) % images.length]!

const BODY = ['.oooooooooooooooooooooooooooooo', '.orhhhhhhrrrrrrrrrrrrrrrrrrrrro', '.orrrrrrrrrrrrrrrrrrrrrrrrrrrro', '.ommmmmmmmmmmmmmmmmmmmmmmmmmmmo', '.oooooooooooooooooooooooooooooo', '...ollmmmmmmmmmmmmmmmmmmmmddo', '...ollmoooooooooooooooooomddo', '...ollmonnnnnnnnnnnnnnnnomddo', '...ollmonggggnnnnnnnnnnnomddo', '...olrronggnnnnnnnnnnnnnomddo', '...olrronnnnnnnnnnnnnnnnomddo', '...ollmonnnnnnnnnnnnnnnnomddo', '...ollmonnnnnnnnnnnnnnnnokydo', '...ollmonnnnnnnnnnnnnnnnokydo', '...ollmonnnnnnnnnnnnnnnnokydo', '...ollmonnnnnnnnnnnnnnnnokydo', '...ollmonnnnnnnnnnnnnnnnokydo', '...ollmonnnnnnnnnnnnnnnnomddo', '...olrronnnnrrrrrrrrnnnnomddo', '...olrronhhlllllllllhhhnomddo', '...ollmonhhrrrrrrrrrhhhnomddo', '...ollmorrrrrrrrrrrrrrrromddo', '...ollmoooooooooooooooooomddo', '...oddddddddddddddddddddddddo', '...oddddddddddddddddddddddddo', '...oooooooooooooooooooooooooo', '......odddo..........odddo', '......odddo..........odddo', '......ooooo..........ooooo', 'oooooooooooooooooooooooooooooooo', 'otttttttttttttttttttttttttttttto', 'oWWWWWWWwWWWWWWWWwWWWWWWWwWWWWWo', 'oWWWWWWWwWWWWWWWWwWWWWWWWwWWWWWo', 'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo', 'oooooooooooooooooooooooooooooooo', '.11..........................11', '.11..........................11', '.11..........................11']

const PIPE = ['ooo', 'hho', 'rroooooooooooooooooooooo', 'rrorrrrrrororrrrrrrrrrrroo', 'rrollllllorollllllllllllldo', 'rrommmmmmorommmmmmmmmmmmmmo', 'rroddddddoroddddddddddddddo', 'rroooooooooooooooooooommmmo', 'rro..................orlmdo', 'ooo..................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................oooooo', '.....................ollllo', '.....................oooooo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo', '.....................orlmdo']

/** What shows through the window, from `WINDOW`, over the cold stove. */
const FLAMES: Record<FireLevel, readonly (readonly string[])[]> = {
  full: [
    ['wwwwwRwRwwRwwwww', 'wlllweweRwewRwww', 'wwweweReeweRewww', 'wwReRyeyeRyeewww', 'wweyeyeyyeyeyRww', 'wReyeyyyyeyyyeww', 'weyyycycyycyyeRw', 'weycycyccycycyew', 'wyycyccccycccyew', 'wycccccccccccyyw', 'wyccccccccccccyw', 'wcccccccccccccyw', 'wttWWWWWWWWWtttw', 'wttwwwwwwwwwtttw', 'eeeeeeeeeeeeeeee'],
    ['wwwwRwRwRwwRwwww', 'wllleweweRwewwww', 'wwRweReweewewRww', 'wweRyeyRyeRyweww', 'wweeyeyeyyeyReww', 'wwyeyyyeyyeyeyww', 'wRyycycycyyceyww', 'weyycycyccycyyRw', 'wecycccyccycycew', 'wyccccccccccycew', 'wyccccccccccccyw', 'wyccccccccccccyw', 'wttWWWWWWWWWtttw', 'wttwwwwwwwwwtttw', 'eeeeeeeeeeeeeeee'],
    ['wwwRwwRwwRwwRwww', 'wlllwweRweRwewww', 'wwweRweeweewewww', 'wwwyeRyeRyewyRww', 'wRRyeeyyeyyRyeww', 'weeyyeyyeyyeyeRw', 'weecyycyycyecyew', 'wyycyyccyccycyew', 'wyyccyccyccycyyw', 'wyyccccccccyccyw', 'wcccccccccccccyw', 'wccccccccccccccw', 'wttWWWWWWWWWtttw', 'wttwwwwwwwwwtttw', 'eeeeeeeeeeeeeeee'],
  ],
  medium: [
    ['bbbbbbbbbbbbbbbb', 'blllbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbRbRbRbbRbbbb', 'bbbRebeRebRebbbb', 'bbbeeReeeReebbbb', 'bbReyeyeyeeyRbbb', 'bbeyyeyyyeyyeRbb', 'bbeyyyyyyyyyeebb', 'bbyycycycyycyebb', 'bttWWWWWWWWWtttb', 'bttwwwwwwwwwtttb', 'bbbbbbbbbbbbbbbb'],
    ['bbbbbbbbbbbbbbbb', 'blllbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbRbRbRbbbbbb', 'bbbbRebeRebRbbbb', 'bbbReeReeeReRbbb', 'bbbeeyeyeyeeeRbb', 'bbReyyeyyyeyeebb', 'bbeyyyyyyyyyyebb', 'bbeyycycycyyyybb', 'bttWWWWWWWWWtttb', 'bttwwwwwwwwwtttb', 'bbbbbbbbbbbbbbbb'],
    ['bbbbbbbbbbbbbbbb', 'blllbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbRbbRbRbbbbb', 'bbbRbeRbeRebRbbb', 'bbReReeReeeRebbb', 'bbeeeyeeyeyeebbb', 'bbeyeyyeyyyeyRbb', 'bbyyyyyyyyyyyebb', 'bbyyycyycycyyebb', 'bttWWWWWWWWWtttb', 'bttwwwwwwwwwtttb', 'bbbbbbbbbbbbbbbb'],
  ],
  low: [
    ['', '.llln', '.nn', '', '', '', '', '', '......R', '.....ReR...R', '....Reee..ReR', '....eeyewweee', '.ttWWWWWWWWWttt', '.ttwwwwwwwwwttt', 'bbbbbbbbbbbbbbbb'],
    ['', '.llln', '.nn', '', '', '', '', '', '.....R', '....ReR...R.R', '...ReeeR..eRe', '...eeyeewweee', '.ttWWWWWWWWWttt', '.ttwwwwwwwwwttt', 'bbbbbbbbbbbbbbbb'],
  ],
  embers: [
    ['', '.llln', '.nn', '', '', '', '', '', '', '', '', '....bbbbbbbb', '.RReywwwwewwRRR', '.RRbbbeybbbbeRR', 'bbbbbbbbbbbbbbbb'],
    ['', '.llln', '.nn', '', '', '', '', '', '', '', '', '....bbbbbbbb', '.RRwwwweywwwReR', '.RRbeybbbbebRRR', 'bbbbbbbbbbbbbbbb'],
  ],
  out: [
    [],
    ['', '.n...g', '.n.g'],
  ],
}

/** The floor before the stove, between its two ends of shadow: lit by a fire that burns, shaded otherwise. */
const SHADE = '1'.repeat(26)
const FLOOR_ROW: Record<FireLevel, string> = { full: '2'.repeat(26), medium: `11111${'2'.repeat(16)}11111`, low: SHADE, embers: SHADE, out: SHADE }

const HEAPS: Record<AshLevel, readonly Layer[]> = {
  none: [[0, 0, []]],
  small: [[17, 8, ['.....ooooo', '...ooCCeCCoo', '.ooCCAeGAACCoo', 'oCCAAGAAAAAACCo', '.ooooooooooooo']]],
  medium: [[13, 6, ['........ooooooo', '......ooCCCeCCCoo', '....ooCCAeAAyAACCoo', '...oCCAAAAAAAGAAHCCo', '.ooCAAAAAAAGAAAAAHHCoo', 'oCCAAAAAAGAAAAAAHHAHCCo', '.ooooooooooooooooooooo']]],
  large: [[8, 4, ['............ooooooooo', '..........ooCCCCeCCCCoo', '........ooCCAGeAAyAAACCoo', '......ooCCAGAAAAAAAeAAGCCoo', '....ooCCAGAAAAAAAAAAGHHAHCCoo', '...oCCAGAAAAAAAAAAGAAHAHHAHCCo', '.ooCAGAAAAAAAAAAGAAAAAHHAHHGHCoo', 'oCCGAAAAAAAAAAGAAAAAAHHAHGAHHACCo', '.ooooooooooooooooooooooooooooooo']]],
  full: [
    [1, 0, ['.......................3', '........................3', '........................3', '....................3..3', '.....................3', '...................ooooooooo', '................oooCCCCeCCCCooo', '..............ooCCCAAeAAyAAACCCoo', '............ooCCGAAyAAAAAAeGHHACCoo', '...........oCCGAAAAAAAAAAGAAHAHHACCo', '.........ooCGAAAAAAAAAAGAAAAAHHAHHGCoo', '........oCCAAAAAAAAAAGAAAAAAHHAHGAHHCCo', '.......oCAAAAAAAAAAGAAAAAAAAHAGHAHHAHHCo', '......oCAAAAAAAAAGAAAAAAAAAAGHHAHHAHHAHCo', '.....oCAAAAAAAAGAAAAAAAAAAGAHHAHHAHHAGHACo', '....oCAAAAAAAGAAAAAAAAAAGAAAHAHHAHHGHHAHHCo', '..ooCAAAAAAGAAAAAAAAAAGAAAAAAHHAHGAHHAHHAHCoo', '.oCCAAAAAGAAAAAAAAAAGAAAAAAAHHAGHAHHAHHAHHGCCo', '11ooooooooooooooooooooooooooooooooooooooooooo1', '1111111111111111111111111111111111111111111111']],
    [1, 0, ['.......................3', '......................3', '.....................3', '......................3...3', '.........................3', '...................ooooooooo', '................oooCCCeCCCCCooo', '..............ooCCCAAAAyAeAACCCoo', '............ooCCGAAAeAAAAAAGHHACCoo', '...........oCCGAAAAAAAAAAGAyHAHHACCo', '.........ooCGAAAAAAAAAAGAAAAAHHAHHGCoo', '........oCCAAAAAAAAAAGAAAAAAHHAHGAHHCCo', '.......oCAAAAAAAAAAGAAAAAAAAHAGHAHHAHHCo', '......oCAAAAAAAAAGAAAAAAAAAAGHHAHHAHHAHCo', '.....oCAAAAAAAAGAAAAAAAAAAGAHHAHHAHHAGHACo', '....oCAAAAAAAGAAAAAAAAAAGAAAHAHHAHHGHHAHHCo', '..ooCAAAAAAGAAAAAAAAAAGAAAAAAHHAHGAHHAHHAHCoo', '.oCCAAAAAGAAAAAAAAAAGAAAAAAAHHAGHAHHAHHAHHGCCo', '11ooooooooooooooooooooooooooooooooooooooooooo1', '1111111111111111111111111111111111111111111111']],
  ],
}

const POSES: Record<KeeperPose, readonly [Layer, Layer]> = {
  carry: [
    [3, 0, ['...............oooo', '...............offo', '.............oooooooo', '............oBBBBBBBBo', '...........oBPPBBBBBBBo', '..........oBPBBBBBBBBDBo', '..........oDDDDDDDDDDDDo', '..........oDDDDDDDDDDDDo', '..........ossssssssssSSo', '..........oEfsssEfsssSSo', '..........oEfsssEfsssSSo', '..........ossssssssssSSo', '...........ojsssjsssSSo', '............oqqqqqsSSo', '.............ooqqSSoo', '............oyyuuuuyko', '...........oyyKuuuuKyko', 'oooooooooooooooouuuuykko', 'ottaaaaaaaassyyyvuuuoyko', 'owtWWWwWWwWssyyyvuuuosSo', 'ottwwwwwwwwooooouuuUooo', 'oooooooooooooouuuuuUo', '.............ouuuuuUo', '............ouuuouuUo', '...........ouuuo.ouuUo', '...........ouuo...ouUo', '..........obbbo...obbo', '..........obwbbo..obbbo', '...........oooo....ooo', '..........11111111111111', '..........11111111111111', '..........11111111111111']],
    [3, 1, ['...............oooo', '...............offo', '.............oooooooo', '............oBBBBBBBBo', '...........oBPPBBBBBBBo', '..........oBPBBBBBBBBDBo', '..........oDDDDDDDDDDDDo', '..........oDDDDDDDDDDDDo', '..........ossssssssssSSo', '..........oEfsssEfsssSSo', '..........oEfsssEfsssSSo', '..........ossssssssssSSo', '...........ojsssjsssSSo', '............oqqqqqsSSo', '.............ooqqSSoo', '............oyyuuuuyko', '...........oyyKuuuuKyko', 'oooooooooooooooouuuuykko', 'ottaaaaaaaassyyyvuuuoyko', 'owtWWWwWWwWssyyyvuuuosSo', 'ottwwwwwwwwooooouuuUooo', 'oooooooooooooouuuuuUo', '.............ouuuuuUo', '.............ouuoouUo', '.............ouuoouUo', '.............obboobbo', '............obwboobbbo', '.............ooo..ooo', '..........11111111111111', '..........11111111111111', '..........11111111111111']],
  ],
  drop: [
    [0, 6, ['................oooo', '................offo', '..............oooooooo', '.............oBBBBBBBBo', '............oBPPBBBBBBBo', '...........oBPBBBBBBBBDBo', '...........oDDDDDDDDDDDDo', '...........oDDDDDDDDDDDDo', '...........ossssssssssSSo', '...........oEfsssEfsssSSo', '...........oEfsssEfsssSSo', '...........ossssssssssSSo', '............ojsssjsssSSo', '.............oqqqqqsSSo', 'ooooooooooooooooqqSSoo', 'ottaaaaaaassyyyyuuuuyko', 'owtWWWwWWwssyyyyuuuuuyko', 'ottwwwwwwwoooooouuuuuuyko', 'ooooooooooooooouuuuuuuUo', '..............ouuuuuuuUo', '................ouuuuuuuUo', '...............obwbooouuuUo', '...............oooo..obbbbo', '.............11111111ooooo1', '.............11111111111111', '.............11111111111111']],
    [2, 6, ['..............oooo', '..............offo', '............oooooooo', '...........oBBBBBBBBo', '..........oBPPBBBBBBBo', '.........oBPBBBBBBBBDBo', '.........oDDDDDDDDDDDDo', '.........oDDDDDDDDDDDDo', '.........ossssssssssSSo', '...y.....oEfsssEfsssSSo', '.........oEfsssEfsssSSo', '.........ossssssssssSSo', '..y.......ojsssjsssSSo', '...........oqqqqqsSSo', 'y...ooooooooooqqSSoo', '....osssyyyyyyuuuuyko', '....osssyyyyyyuuuuuyko', '....oooooooooouuuuuuyko', '...........oouuuuuuuUo', '............ouuuuuuuUo', '..............ouuuuuuuUo', '.............obwbooouuuUo', '.............oooo..obbbbo', '...........11111111ooooo1', '...........11111111111111', '...........11111111111111']],
  ],
  walk: [
    [3, 0, ['.....oooo', '.....offo', '...oooooooo', '..oBBBBBBBBo', '.oBBBBBBBPPBo', 'oBDBBBBBBBBPBo', 'oDDDDDDDDDDDDo', 'oDDDDDDDDDDDDo', 'oSSsssssssssso', 'oSSsssfEsssfEo', 'oSSsssfEsssfEo', 'oSSsssssssssso', '.oSSsssjsssjo', '..oSSsqqqqqo', '...ooSSqqoo', '..okyuuuuyyo', '.okyKuuuuKyyo', 'okkyuuuuuuyyyo', 'okyouuuvuuoyyo', 'oSsouuuvuuosso', '.oooUuuuuUooo', '...oUuuuuuo', '...oUuuuuuo', '...oUuuouuuo', '..oUuuo.ouuuo', '..oUuo...ouuo', '..obbo...obbbo', '.obbbo..obbwbo', '..ooo....oooo', '11111111111111', '11111111111111', '11111111111111']],
    [3, 1, ['.....oooo', '.....offo', '...oooooooo', '..oBBBBBBBBo', '.oBBBBBBBPPBo', 'oBDBBBBBBBBPBo', 'oDDDDDDDDDDDDo', 'oDDDDDDDDDDDDo', 'oSSsssssssssso', 'oSSsssfEsssfEo', 'oSSsssfEsssfEo', 'oSSsssssssssso', '.oSSsssjsssjo', '..oSSsqqqqqo', '...ooSSqqoo', '..okyuuuuyyo', '.okyKuuuuKyyo', 'okkyuuuuuuyyyo', 'okyouuuvuuoyyo', 'oSsouuuvuuosso', '.oooUuuuuUooo', '...oUuuuuuo', '...oUuuuuuo', '...oUuoouuo', '...oUuoouuo', '...obboobbo', '..obbboobwbo', '...ooo..ooo', '11111111111111', '11111111111111', '11111111111111']],
  ],
  broom: [
    [9, 0, ['.........oooo', '.........offo', '.......oooooooo', '......oBBBBBBBBo', '.....oBPPBBBBBBBo', '..oooBPBBBBBBBBDBo', '..otoDDDDDDDDDDDDo', '..otoDDDDDDDDDDDDo', '..otossssssssssSSo', '..otoEfsssEfsssSSo', '..otoEfsssEfsssSSo', '..otossssssssssSSo', '..otoojsssjsssSSo', '..oto.oqqqqqsSSo', '..oWo..ooqqSSoo', '..oWo.oyyuuuuyko', '..oWooyyKuuuuKyko', '..oWoyyyuuuuuuykko', '..oWoyyouuvuuuoyko', '..oWsssouuvuuuosSo', '..oWsssoUuuuuUooo', '..oWo..ouuuuuUo', '..oWo..ouuuuuUo', '..oWo.ouuuouuUo', '..oWoouuuo.ouuUo', 'ooooooouo...ouUo', 'oyyyyyobo...obbo', 'oKKKKKobbo..obbbo', 'oKKKKKooo....ooo', 'ooooooo11111111111', '....11111111111111', '....11111111111111']],
    [9, 1, ['.........oooo', '.........offo', '.......oooooooo', '......oBBBBBBBBo', '.....oBPPBBBBBBBo', '..oooBPBBBBBBBBDBo', '..otoDDDDDDDDDDDDo', '..otoDDDDDDDDDDDDo', '..otossssssssssSSo', '..otoEfsssEfsssSSo', '..otoEfsssEfsssSSo', '..otossssssssssSSo', '..otoojsssjsssSSo', '..oto.oqqqqqsSSo', '..oWo..ooqqSSoo', '..oWo.oyyuuuuyko', '..oWooyyKuuuuKyko', '..oWoyyyuuuuuuykko', '..oWoyyouuvuuuoyko', '..oWsssouuvuuuosSo', '..oWsssoUuuuuUooo', '..oWo..ouuuuuUo', '..oWo..ouuuuuUo', '..oWo..ouuoouUo', '..oWo..ouuoouUo', 'oooooooobboobbo', 'oyyyyyobwboobbbo', 'oKKKKKoooo..ooo', 'oKKKKKo11111111111', 'ooooooo11111111111', '....11111111111111']],
  ],
  sweep: [
    [0, 0, ['..................oooo', '..................offo', '................oooooooo', '...............oBBBBBBBBo', '..............oBPPBBBBBBBo', '.............oBPBBBBBBBBDBo', '.............oDDDDDDDDDDDDo', '.............oDDDDDDDDDDDDo', '.............ossssssssssSSo', '.............oEfsssEfsssSSo', '.............oEfsssEfsssSSo', '.............ossssssssssSSo', '..............ojsssjsssSSo', '...............oqqqqqsSSo', '................ooqqSSoo', '...............oyyuuuuyko', '..............oyyKuuuuKyko', '.............oooouuuuuuykko', '.............sssouuvuuuoyko', '...........oosssouuvuuuosSo', '...........oWWoooUuuuuUooo', '.........oooWoo.ouuuuuUo', '...C....ooWWoo..ouuuuuUo', '.C.....ooWWoo..ouuuouuUo', '......ooWooo..ouuuo.ouuUo', '.ooooooooo....ouuo...ouUo', '.oyyyyyyo....obbbo...obbo', 'CoKKKKKKo....obwbbo..obbbo', '.oKKKKKKo.....oooo....ooo', '.oooooooo....11111111111111', '.............11111111111111', '.............11111111111111']],
    [0, 1, ['..................oooo', '..................offo', '................oooooooo', '...............oBBBBBBBBo', '..............oBPPBBBBBBBo', '.............oBPBBBBBBBBDBo', '.............oDDDDDDDDDDDDo', '.............oDDDDDDDDDDDDo', '.............ossssssssssSSo', '.............oEfsssEfsssSSo', '.............oEfsssEfsssSSo', '.............ossssssssssSSo', '..............ojsssjsssSSo', '...............oqqqqqsSSo', '................ooqqSSoo', '...............oyyuuuuyko', '..............oooKuuuuKyko', '.............sssouuuuuuykko', '.............sssouuvuuuoyko', '............ooWoouuvuuuosSo', '............oWoooUuuuuUooo', '.....C.....ooWo.ouuuuuUo', '..........ooWoo.ouuuuuUo', '...C......oWWo..ouuoouUo', 'C....ooooooooo..ouuoouUo', '.....oyyyyyyo...obboobbo', '..C..oKKKKKKo..obwboobbbo', '.....oKKKKKKo...ooo..ooo', '.....oooooooo11111111111111', '.............11111111111111', '.............11111111111111']],
  ],
}

const LETTERS: Record<EnvelopeState, Layer> = {
  discreet: [2, 2, ['.nnnnnnnn', 'nLccccccLn', 'ncLccccLcn', 'nccLeeLccn', 'nccceecccn', 'nccccccccn', '.nnnnnnnn']],
  waiting: [2, 0, ['.......nnnnn', '.......ncycn', '.nnnnnnnnyn', 'nLccccccncn', 'ncLccccnyyyn', 'nccLeeLnnnnn', 'nccceecccn', 'nccccccccn', '.nnnnnnnn']],
  bright: [0, 0, ['.c44444444444', '4444444444444c', '444nnnnnnnn444', '44nLccccccLn44', '44ncLccccLcn44', '44nccLeeLccn44', '44nccceecccn44', '44nccccccccn44', '444nnnnnnnn444', '444444444444c4', '.444444444444']],
}

export const fireFrames = (level: FireLevel) => FLAMES[level].length
export const ashFrames = (level: AshLevel) => HEAPS[level].length
export const keeperFrames = (pose: KeeperPose) => POSES[pose].length

/** The cold stove and its shadow: its anchor is `BASE`, and `fire` lays over it, grid on grid. */
export const stove = () => sprite(STOVE.w, STOVE.h, BASE, [[8, 26, BODY]])

/** The flue, top left of the stove's grid; its anchor is the stove's base, so that the two meet. */
export const flue = () => sprite(27, 26, BASE, [[0, 0, PIPE]])

/** What a fire changes on the stove: the window, the log basket, and the floor. Same grid and anchor as `stove`. */
export function fire(level: FireLevel, frame: number) {
  const row = FLOOR_ROW[level]
  return sprite(STOVE.w, STOVE.h, BASE, [[WINDOW.x, WINDOW.y, image(FLAMES[level], frame)], [FLOOR.x, FLOOR.y, [row, row, row]]])
}

/** The ash before the stove, drawn over it; its anchor is the stove's base. */
export const ash = (level: AshLevel, frame: number) => sprite(48, 20, { x: BASE.x, y: BASE.y - ASH_TOP }, [image(HEAPS[level], frame)])

/** The keeper, facing left; its anchor is where the log lands, the same in every pose. */
export const keeper = (pose: KeeperPose, frame: number) => sprite(30, 32, LOG_TIP, [image(POSES[pose], frame)])

/** The handover letter. */
export const envelope = (state: EnvelopeState) => sprite(14, 11, LETTER, [LETTERS[state]])
