import { ASH_TOP, STOVE_DEPOSIT, ash, fire, fireFrames, flue, spriteBody, stove } from '../hearth'
import type { Hearth } from '../pack'

/** The cast iron stove, its flue at its top left. */
export const ironStove: Hearth = {
  w: 96,
  feet: 122,
  body: () => `${spriteBody(flue())}${spriteBody(stove())}`,
  flames: (level, frame) => spriteBody(fire(level, frame)),
  frames: fireFrames,
  ash: (level, frame) => spriteBody(ash(level, frame)),
  ashTop: ASH_TOP,
  fireArea: { x: 11, y: 33, w: 26, h: 31 },
  deposit: STOVE_DEPOSIT,
}
