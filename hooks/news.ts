import type { Host } from './host'

import { isMail, isOwner, isPeer } from './desks'
import { guard } from './disk'
import type { Memory } from './memory'
import { FLIGHT_MS } from './room'
import { readNews, writeNews } from './state'

// Past this many envelopes in the air, a burst lands at once.
const MAX_FLYING = 3

function showNews(host: Host, m: Memory) {
  return writeNews(host, m.news)
}

/** One envelope at a time, for as long as some are still on their way. */
export function fly(host: Host, m: Memory) {
  if (m.flight || m.news.shown >= m.news.count) return
  m.flight = host.clock.after(FLIGHT_MS, () => {
    m.flight = null
    const shown = Math.max(m.news.shown + 1, m.news.count - MAX_FLYING)
    m.news = { ...m.news, shown: Math.min(shown, m.news.count) }
    void guard(host, m, 'news', () => showNews(host, m))
    fly(host, m)
  })
}

async function add(host: Host, m: Memory) {
  m.news = { ...m.news, count: m.news.count + 1 }
  await showNews(host, m)
  fly(host, m)
}

/** The person wrote: the count is over, and no envelope lands after that. */
async function clear(host: Host, m: Memory) {
  m.flight?.cancel()
  m.flight = null
  m.arrivals = []
  if (m.news.count || m.news.shown) {
    m.news = { count: 0, shown: 0 }
    await showNews(host, m)
  }
}

/** A delivery for the main conversation. It counts now if it reads as mail, and is awaited at the prompt. */
export async function received(host: Host, m: Memory, kind: string, text: string) {
  if (!isPeer(kind)) return
  const mail = isMail(kind, text)
  m.arrivals.push(mail)
  if (mail) await add(host, m)
}

/** A prompt of the main conversation: what the arrival saw is checked against what it became. */
export async function entered(host: Host, m: Memory, kind: string, text: string, isMeta: boolean) {
  if (isOwner(kind) && !isMeta) return clear(host, m)
  if (!isPeer(kind)) return undefined
  const counted = m.arrivals.shift() ?? false
  const mail = isMail(kind, text)
  if (mail && !counted) return add(host, m)
  if (!mail && counted) {
    // The engine framed it as a hand-back on its way in: it was never mail.
    const count = Math.max(0, m.news.count - 1)
    m.news = { count, shown: Math.min(m.news.shown, count) }
    return showNews(host, m)
  }
  return undefined
}

/** After a restart the count comes from the file; after a hot reload the host still holds it, envelope included. */
export async function restoreNews(host: Host, m: Memory, saved: unknown) {
  const held = await readNews(host)
  if (held?.count) m.news = held
  else if (typeof saved === 'number' && saved > 0) {
    m.news = { count: saved, shown: saved }
    await showNews(host, m)
  }
  fly(host, m)
}
