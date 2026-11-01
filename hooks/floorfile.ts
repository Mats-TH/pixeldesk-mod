import type { Host } from './host'

import { paneOpen } from './agents'
import { floorIds, floorRooms, parseSession, subOf } from './desks'
import type { DeskExport, FloorRoom, SessionLink } from './desks'
import { deskPath, guard, listed, onDisk, readText, stateDir } from './disk'
import { slashed } from './lines'
import type { Memory } from './memory'
import { isOpen } from './plan'
import { zoomAgain } from './room'
import { readFloorRooms, readSub, writeFloorRooms, writeSub } from './state'

const LINKS_MS = 60_000
const MAX_DEPTH = 3

const isExport = (v: unknown): v is DeskExport => {
  const e = v as Partial<DeskExport> | null
  return typeof e === 'object' && e !== null && typeof e.sessionId === 'string' && typeof e.cwd === 'string' && typeof e.updatedAt === 'number'
}

/** Anything can sit in a file another process is writing: what does not read is left for the next pass. */
async function parsedFile(path: string, read: (path: string) => Promise<string | undefined>) {
  const text = await read(path)
  if (text === undefined) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** The session files under a folder, at most three folders down. */
async function sessionFiles($: Host, dir: string, depth: number): Promise<string[]> {
  const found: string[] = []
  for (const entry of await listed($, dir)) {
    const path = `${dir}/${entry.name}`
    if (entry.kind === 'file' && /^local_.*\.json$/.test(entry.name)) found.push(path)
    else if (entry.kind === 'dir' && depth < MAX_DEPTH) found.push(...(await sessionFiles($, path, depth + 1)))
  }
  return found
}

/** What the desktop app knows of who spawned whom. Only Windows has it where the mod can look. */
async function readLinks($: Host) {
  const local = await $.env.localAppData()
  if (!local) return []
  const root = `${slashed(local).replace(/\/+$/, '')}/Claude-Data`
  const links: SessionLink[] = []
  for (const entry of await listed($, root)) {
    if (entry.kind !== 'dir') continue
    for (const path of await sessionFiles($, `${root}/${entry.name}/claude-code-sessions`, 0)) {
      const link = parseSession(await parsedFile(path, p => readText($, p)))
      if (link) links.push(link)
    }
  }
  return links
}

/** At the first pass, then at most once a minute. A failure keeps the links known so far. */
async function linksNow($: Host, m: Memory, now: number) {
  if (m.linksAt && now - m.linksAt < LINKS_MS) return m.links
  m.linksAt = now
  m.links = (await guard($, m, 'session links', () => readLinks($))) ?? m.links
  return m.links
}

async function readExports($: Host, m: Memory, links: readonly SessionLink[]) {
  const ids = floorIds(m.sessionId, links)
  const names = ids ? ids.map(id => deskPath(m, id)) : (await listed($, stateDir(m))).filter(e => /^desk-.+\.json$/.test(e.name)).map(e => `${stateDir(m)}/${e.name}`)
  const files = await Promise.all(names.map(path => parsedFile(path, p => readText($, p))))
  return files.filter(isExport)
}

/** Reads the floor, unless the pane is closed and a plan holds the band: then nobody would see it. */
export async function readFloor($: Host, m: Memory) {
  if (!onDisk(m)) return
  if (isOpen(m.plan) && m.change.phase !== 'waiting' && !(await paneOpen($))) return
  const now = await $.clock.now()
  const links = await linksNow($, m, now)
  // Links that do not hold this conversation say nothing of it: what was known stays.
  const sub = subOf(m.sessionId, links)
  if (sub !== null && sub !== (await readSub($))) await writeSub($, sub)
  const rooms: FloorRoom[] = floorRooms(m.sessionId, links, await readExports($, m, links), now)
  const before = (await readFloorRooms($)) ?? []
  m.floorBefore = before.length
  m.floorPair = zoomAgain(m.floorPair)
  if (JSON.stringify(before) !== JSON.stringify(rooms)) await writeFloorRooms($, rooms)
}
