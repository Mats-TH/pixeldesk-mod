import type { Host } from './host'

import { isMail, isOwner, isPeer } from './desks'
import { guard } from './disk'
import type { Memory } from './memory'
import { FLIGHT_MS } from './room'
import { readNews, writeNews } from './state'

// Past this many envelopes in the air, a burst lands at once.
const MAX_FLYING = 3

function showNews($: Host, m: Memory) {
  return writeNews($, m.news)
}

/** One envelope at a time, for as long as some are still on their way. */
export function fly($: Host, m: Memory) {
  if (m.flight || m.news.shown >= m.news.count) return
  m.flight = $.clock.after(FLIGHT_MS, () => {
    m.flight = null
    const shown = Math.max(m.news.shown + 1, m.news.count - MAX_FLYING)
    m.news = { ...m.news, shown: Math.min(shown, m.news.count) }
    void guard($, m, 'news', () => showNews($, m))
    fly($, m)
  })
}

async function add($: Host, m: Memory) {
  m.news = { ...m.news, count: m.news.count + 1 }
  await showNews($, m)
  fly($, m)
}

/** The person wrote: the count is over, and no envelope lands after that. */
async function clear($: Host, m: Memory) {
  m.flight?.cancel()
  m.flight = null
  m.arrivals = []
  if (m.news.count || m.news.shown) {
    m.news = { count: 0, shown: 0 }
    await showNews($, m)
  }
}

/** A delivery for the main conversation. It counts now if it reads as mail, and is awaited at the prompt. */
export async function received($: Host, m: Memory, kind: string, text: string) {
  if (!isPeer(kind)) return
  const mail = isMail(kind, text)
  m.arrivals.push(mail)
  if (mail) await add($, m)
}

/** A prompt of the main conversation: what the arrival saw is checked against what it became. */
export async function entered($: Host, m: Memory, kind: string, text: string, isMeta: boolean) {
  if (isOwner(kind) && !isMeta) return clear($, m)
  if (!isPeer(kind)) return undefined
  const counted = m.arrivals.shift() ?? false
  const mail = isMail(kind, text)
  if (mail && !counted) return add($, m)
  if (!mail && counted) {
    // The engine framed it as a hand-back on its way in: it was never mail.
    const count = Math.max(0, m.news.count - 1)
    m.news = { count, shown: Math.min(m.news.shown, count) }
    return showNews($, m)
  }
  return undefined
}

/** After a restart the count comes from the file; after a hot reload the host still holds it, envelope included. */
export async function restoreNews($: Host, m: Memory, saved: unknown) {
  const held = await readNews($)
  if (held?.count) m.news = held
  else if (typeof saved === 'number' && saved > 0) {
    m.news = { count: saved, shown: saved }
    await showNews($, m)
  }
  fly($, m)
}
