/** A colour, "#rrggbb", or "#rrggbb|0.3" with an opacity. */
export type Paint = string

export type Canvas = {
  w: number
  h: number
  set: (x: number, y: number, c: Paint | null) => void
  get: (x: number, y: number) => Paint | null
  rect: (x: number, y: number, w: number, h: number, c: Paint) => void
  sprite: (rows: readonly string[], palette: Record<string, Paint>, ox: number, oy: number) => void
}

export function canvas(w: number, h: number): Canvas {
  const cells = new Array<Paint | null>(w * h).fill(null)
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h
  const c: Canvas = {
    w,
    h,
    set: (x, y, paint) => {
      if (inside(x, y)) cells[y * w + x] = paint
    },
    get: (x, y) => (inside(x, y) ? (cells[y * w + x] ?? null) : null),
    rect: (x, y, rw, rh, paint) => {
      for (let j = 0; j < rh; j += 1) for (let i = 0; i < rw; i += 1) c.set(x + i, y + j, paint)
    },
    sprite: (rows, palette, ox, oy) => {
      rows.forEach((row, j) => [...row].forEach((ch, i) => {
        const paint = palette[ch]
        if (paint) c.set(ox + i, oy + j, paint)
      }))
    },
  }
  return c
}

/**
 * The canvas as one path per colour: runs of a row merge, then the same run on the rows below.
 * `s` is the size of a pixel; a drawing that repeats is lighter at 1, inside a group that scales it.
 */
export function paths(c: Canvas, s = 1): string {
  type Run = { x: number; y: number; w: number; h: number }
  const byColor = new Map<Paint, Run[]>()
  let above = new Map<string, Run>()
  for (let y = 0; y < c.h; y += 1) {
    const row = new Map<string, Run>()
    let x = 0
    while (x < c.w) {
      const paint = c.get(x, y)
      if (!paint) {
        x += 1
        continue
      }
      let end = x
      while (end < c.w && c.get(end, y) === paint) end += 1
      const key = `${x} ${end} ${paint}`
      const same = above.get(key)
      if (same) {
        same.h += 1
        row.set(key, same)
      } else {
        const run = { x, y, w: end - x, h: 1 }
        const runs = byColor.get(paint)
        if (runs) runs.push(run)
        else byColor.set(paint, [run])
        row.set(key, run)
      }
      x = end
    }
    above = row
  }
  return [...byColor].map(([paint, runs]) => {
    const [fill, opacity] = paint.split('|')
    const d = runs.map(r => `M${r.x * s} ${r.y * s}h${r.w * s}v${r.h * s}h-${r.w * s}`).join('')
    return `<path fill="${fill}"${opacity ? ` fill-opacity="${opacity}"` : ''} d="${d}"/>`
  }).join('')
}

/** Steady grain in [0, 1): a small integer hash of two whole coordinates, the same on every redraw. */
export function noise(x: number, y: number) {
  let bits = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77)
  bits = Math.imul(bits ^ (bits >>> 15), 0x2c1b3c6d)
  bits = Math.imul(bits ^ (bits >>> 12), 0x297a2d39)
  return ((bits ^ (bits >>> 15)) >>> 0) / 2 ** 32
}

const CHANNELS = [16, 8, 0]

/** Walks each of the three channels from one #rrggbb to the other. `ratio` 0 stays on `from`, 1 lands on `to`. */
export function mix(from: string, to: string, ratio: number): string {
  const [start, end] = [parseInt(from.slice(1, 7), 16), parseInt(to.slice(1, 7), 16)]
  const packed = CHANNELS.reduce((sum, shift) => {
    const [low, high] = [(start >> shift) & 0xff, (end >> shift) & 0xff]
    return sum + (Math.round(low + (high - low) * ratio) << shift)
  }, 0)
  return `#${packed.toString(16).padStart(6, '0')}`
}
