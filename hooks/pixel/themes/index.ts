import type { RoomTheme } from '../../../types'
import type { Themed } from '../pack'
import { base } from './base'
import { baseMap } from './base-map'
import { cosy } from './cosy'
import { cosyMap } from './cosy-map'
import { futuriste } from './futuriste'
import { futuristeMap } from './futuriste-map'
import { geek } from './geek'
import { geekMap } from './geek-map'
import { japonais } from './japonais'
import { japonaisMap } from './japonais-map'
import { nature } from './nature'
import { natureMap } from './nature-map'

const PACKS: Record<RoomTheme, Themed> = {
  cosy: { ...cosy, map: cosyMap },
  japonais: { ...japonais, map: japonaisMap },
  nature: { ...nature, map: natureMap },
  futuriste: { ...futuriste, map: futuristeMap },
  geek: { ...geek, map: geekMap },
  base: { ...base, map: baseMap },
}

/** A room's theme. Cosy stands in for one a newer version saved. */
export const packOf = (theme: RoomTheme | undefined): Themed => PACKS[theme ?? 'cosy'] ?? PACKS.cosy
