import { expect, test } from 'claude-code/testing'

import { STALE_MS, floorIds, floorRooms, isMail, isOwner, keptRoom, parseSession, projectRoot, roleOf, LEAVE_MS, departureOf, leaveAhead, leavers, managerOf } from './desks'
import type { DeskExport, FloorRoom, SessionLink } from './desks'

const NOW = 1_000_000
const ex = (id: string, agents: number, cwd = 'C:/p/Shop'): DeskExport => ({
  sessionId: id,
  title: id,
  agents,
  working: agents,
  summary: 'Travaille',
  updatedAt: NOW,
  cwd,
  desks: [{ title: 'Tâche', state: 'working', hue: 1 }],
  steps: [{ text: 'Coder', status: 'in_progress' }],
  tokens: 1200,
})
const link = (cli: string, parent: string | null, archived = false): SessionLink => ({ cli, local: `local_${cli}`, title: `Titre ${cli}`, parent, archived })

test('a session file gives its link to the parent conversation', async () => {
  const s = parseSession({ sessionId: 'local_a', cliSessionId: 'a', title: 'A2', isArchived: false, spawnedFrom: { sessionId: 'local_m' } })
  expect(s).toEqual({ cli: 'a', local: 'local_a', title: 'A2', parent: 'local_m', archived: false })
  expect(parseSession({ title: 'sans identifiant' }), 'incomplete record').toBe(null)
})

test('a worktree belongs to its project', async () => {
  expect(projectRoot('C:\\p\\Shop\\.claude\\worktrees\\a2-923')).toBe('C:/p/Shop')
  expect(projectRoot('C:/p/Shop')).toBe('C:/p/Shop')
})

test('the floor shows the parent and its linked conversations, without the archived ones', async () => {
  const links = [link('m', null), link('a', 'local_m'), link('b', 'local_m', true), link('z', 'local_autre')]
  const rooms = floorRooms('m', links, [ex('a', 2)], NOW)
  expect(rooms.map(r => r.id)).toEqual(['m', 'a'])
  expect(rooms[1]!.title).toBe('Titre a')
  expect(rooms[1]!.agents).toBe(2)
})

test('no linked conversation, no floor', async () => {
  expect(floorRooms('m', [link('m', null)], [], NOW)).toEqual([])
})

test('a state that has not moved for 2 minutes counts as idle', async () => {
  const rooms = floorRooms('m', [link('m', null), link('a', 'local_m')], [{ ...ex('a', 3), updatedAt: NOW - 130_000 }], NOW)
  expect(rooms[1]!.working).toBe(0)
})

test('a fresh room gets its desks, its plan and its tokens', async () => {
  const room = floorRooms('m', [link('m', null), link('a', 'local_m')], [ex('a', 1)], NOW)[1]!
  expect(room.desks).toEqual([{ title: 'Tâche', state: 'working', hue: 1 }])
  expect(room.steps).toEqual([{ text: 'Coder', status: 'in_progress' }])
  expect(room.tokens).toBe(1200)
})

test('a stale state empties the room, but the screen keeps its tokens', async () => {
  const room = floorRooms('m', [link('m', null), link('a', 'local_m')], [{ ...ex('a', 3), updatedAt: NOW - 130_000 }], NOW)[1]!
  expect(room.desks).toEqual([])
  expect(room.steps).toEqual([])
  expect(room.tokens).toBe(1200)
})

test('with no file, everything is empty and the screen is at zero', async () => {
  const room = floorRooms('m', [link('m', null), link('a', 'local_m')], [], NOW)[1]!
  expect([room.desks, room.steps, room.tokens]).toEqual([[], [], 0])
})

test('the agent type gives its post before the description', async () => {
  expect(roleOf('Explore', 'Écrire les tests')).toBe('Chercheur')
  expect(roleOf('Plan', 'Audit du code'), 'there is one Manager: the main chat').toBe('Analyste')
  expect(roleOf('code-reviewer', 'Rédiger la doc')).toBe('Relecteur')
  expect(roleOf('superpowers:code-reviewer', ''), 'a plugin type').toBe('Relecteur')
  expect(roleOf('explore', ''), 'whatever the case').toBe('Chercheur')
})

test('the words of the description give the post, in table order', async () => {
  const roles: [string, string][] = [
    ['Cherche la limite', 'Chercheur'],
    ['Recherche des sources', 'Chercheur'],
    ['Trouve le fichier', 'Chercheur'],
    ['Plan d’étage', 'Analyste'],
    ['Organise les lots', 'Analyste'],
    ['Coordonne les agents', 'Analyste'],
    ['Revue sécurité', 'Relecteur'],
    ['Relis le texte', 'Relecteur'],
    ['Relecture finale', 'Relecteur'],
    ['Tests du panneau', 'Testeur'],
    ['Vérifie les boutons', 'Testeur'],
    ['VALIDE LE RENDU', 'Testeur'],
    ['Maquette Figma', 'Designer'],
    ['Design du tableau', 'Designer'],
    ['Dessin du crabe', 'Designer'],
    ['Rédige la note', 'Rédacteur'],
    ['Documentation', 'Rédacteur'],
    ['Corrige les textes', 'Rédacteur'],
    ['Notes de version', 'Rédacteur'],
    ['Audit du code', 'Analyste'],
    ['Analyse les coûts', 'Analyste'],
    ['Compare les pistes', 'Analyste'],
    ['Mesure le poids', 'Analyste'],
  ]
  for (const [description, role] of roles) expect(roleOf('general-purpose', description), description).toBe(role)
  expect(roleOf('general-purpose', 'Revue du plan'), 'the table reads top to bottom').toBe('Analyste')
})

test('with no hint it is a developer, even if a word holds one', async () => {
  expect(roleOf('general-purpose', 'Refonte de la barre')).toBe('Développeur')
  expect(roleOf('sous-agent', '')).toBe('Développeur')
  expect(roleOf('general-purpose', 'Attester du contexte'), 'test in the middle of a word').toBe('Développeur')
  expect(roleOf('general-purpose', 'Monter le docker'), 'doc at the start of another word').toBe('Développeur')
  expect(roleOf('general-purpose', 'Planche de tarifs à relier'), 'plan at the start of another word').toBe('Développeur')
})

test('an old file with no desks, plan or tokens stays readable', async () => {
  const old = { sessionId: 'a', title: '', agents: 1, working: 1, summary: 'Travaille', updatedAt: NOW, cwd: 'C:/p/Shop' } as DeskExport
  const room = floorRooms('m', [link('m', null), link('a', 'local_m')], [old], NOW)[1]!
  expect([room.desks, room.steps, room.tokens]).toEqual([[], [], 0])
  expect(room.since, 'no known start time').toBe(0)
})

test('a room kept from an older version gets its fields back', async () => {
  const old = { id: 'a', title: 'A', agents: 1, working: 1, summary: 'Travaille' } as FloorRoom
  expect(keptRoom(old)).toEqual({ ...old, desks: [], steps: [], tokens: 0, state: 'working' })
})

test('with no metadata, the floor groups the conversations of one project', async () => {
  const rooms = floorRooms('m', [], [ex('m', 1), ex('a', 1, 'C:/p/Shop/.claude/worktrees/a2'), ex('x', 1, 'C:/p/Autre')], NOW)
  expect(rooms.map(r => r.id)).toEqual(['m', 'a'])
})

test('news comes from another conversation, never from a subagent of this one', async () => {
  const session = 'Another Claude session sent a message:\n<cross-session-message from="local_a" from-name="A2 : relecture">\nFini.\n</cross-session-message>'
  expect(isMail('peer', session), 'a linked conversation').toBe(true)
  expect(isMail('peer-send-message', 'Fini.'), 'through SendMessage').toBe(true)
  expect(isMail('peer', 'Another Claude session sent a message:\n<agent-message from="a801">\n[Subagent hand-back] Le rapport.'), 'the hand-back of a subagent').toBe(false)
  expect(isMail('peer', '[Subagent hand-back] Le rapport.'), 'without its frame').toBe(false)
  expect(isMail('peer', '<agent-message from="a801">x'), 'another frame').toBe(false)
  for (const kind of ['task-notification', 'coordinator', 'scheduled-trigger', 'projects-relay', 'bridge', 'unclassified', 'composer']) expect(isMail(kind, 'x'), kind).toBe(false)
})

test('the person writes at the keyboard, remotely or from the app', async () => {
  for (const kind of ['composer', 'bridge', 'sdk']) expect(isOwner(kind), kind).toBe(true)
  for (const kind of ['peer', 'peer-send-message', 'task-notification', 'scheduled-trigger', 'plugin', 'auto-continuation', 'unclassified']) expect(isOwner(kind), kind).toBe(false)
})

const exported = (over: Partial<DeskExport>): DeskExport => ({ sessionId: 'kid', title: '', agents: 0, working: 0, summary: '', updatedAt: 1_000_000, cwd: '/p', desks: [], steps: [], tokens: 0, ...over })
const kidState = (over: Partial<DeskExport>, now = 1_000_000) => floorRooms('me', [{ cli: 'me', local: 'lme', title: 'M', parent: null, archived: false }, { cli: 'kid', local: 'lk', title: 'K', parent: 'lme', archived: false }], [exported(over)], now)[1]!.state

test('the state of a sub-conversation comes from its latest export', async () => {
  const late = 1_000_000 + STALE_MS + 1
  expect(kidState({ working: 2 }), 'its agents work').toBe('working')
  expect(kidState({ chat: 'working' }), 'its turn is under way').toBe('working')
  expect(kidState({ chat: 'done' }), 'its turn is over').toBe('done')
  expect(kidState({ chat: 'done' }, late), 'and stays so long after').toBe('done')
  expect(kidState({ chat: 'failed' }), 'its turn stopped').toBe('failed')
  expect(kidState({ chat: 'working' }, late), 'silent in the middle of a turn').toBe('failed')
  expect(kidState({ working: 1 }, late), 'silent with its agents').toBe('failed')
  expect(kidState({ steps: [{ text: 'A', status: 'completed' }] }), 'older version, finished plan').toBe('done')
  expect(kidState({}), 'nothing to say about it').toBe('idle')
})

test('a room kept by an older version still has a state', async () => {
  const room = keptRoom({ id: 'a', title: 'A', agents: 1, working: 1, summary: '', desks: [], steps: [], tokens: 0 })
  expect(room.state).toBe('working')
  expect(keptRoom({ ...room, working: 0, state: undefined }).state).toBe('idle')
})

test('the floor reads only linked conversations, and nothing with no sub-conversation', async () => {
  const me = { cli: 'me', local: 'lme', title: 'M', parent: null, archived: false }
  const kid = { cli: 'kid', local: 'lk', title: 'K', parent: 'lme', archived: false }
  expect(floorIds('me', []), 'no known link: the project decides').toBeNull()
  expect(floorIds('me', [me]), 'no child').toEqual([])
  expect(floorIds('autre', [me, kid]), 'missing from the links').toEqual([])
  expect(floorIds('me', [me, { ...kid, archived: true }]), 'archived').toEqual([])
  expect(floorIds('me', [me, kid])).toEqual(['me', 'kid'])
})

test('the Manager of another conversation reads from its file', async () => {
  const links = [link('m', null), link('a', 'local_m')]
  const file = (over: object) => ({ ...ex('a', 0), updatedAt: NOW, ...over })
  const room = (over: object, now = NOW) => floorRooms('m', links, [ex('m', 0), file(over)], now)[1]!
  expect(room({ manager: { working: true, done: 2, total: 5, live: true } }).manager, 'exported').toEqual({ working: true, done: 2, total: 5, live: true })
  expect(room({ chat: 'working', steps: [{ text: 'A', status: 'completed' }, { text: 'B', status: 'in_progress' }] }).manager, 'an old file: its turn and its plan').toEqual({ working: true, done: 1, total: 2, live: true })
  expect(room({ chat: 'done' }).manager?.working, 'turn over').toBe(false)
  expect(room({}).manager?.working, 'a file from before the turn').toBe(false)
  expect(room({ chat: 'working' }, NOW + 500_000).manager?.working, 'a silent file works no more').toBe(false)
  expect(room({ working: 3, agents: 3, chat: 'done' }).manager?.working, 'its subagents do not put it to work').toBe(false)
})

const seat = (phase: 'working' | 'done' | 'failed', endedAt = 0, id = 'a') => ({ id, phase, endedAt })
const ids = (list: { id: string }[]) => list.map(a => a.id)

test('end of plan: an open plan keeps finished desks, however long', async () => {
  const list = [seat('done', 1000), seat('working', 0, 'b')]
  expect(leavers(list, { mode: 'plan', now: 9_000_000, planOver: null })).toEqual([])
  expect(leavers([seat('done', 1000)], { mode: 'plan', now: 9_000_000, planOver: null })).toEqual([])
})

test('end of plan: all leave together, 30 s after 100%', async () => {
  const list = [seat('done', 1000, 'a'), seat('done', 5000, 'b')]
  expect(leavers(list, { mode: 'plan', now: 10_000 + LEAVE_MS - 1, planOver: 10_000 }), 'it stays a moment').toEqual([])
  expect(ids(leavers(list, { mode: 'plan', now: 10_000 + LEAVE_MS, planOver: 10_000 })), 'together').toEqual(['a', 'b'])
  expect(leavers([...list, seat('working', 0, 'c')], { mode: 'plan', now: 900_000, planOver: 10_000 }), 'unless an agent is still working').toEqual([])
  expect(leavers([seat('done', 50_000)], { mode: 'plan', now: 60_000, planOver: 10_000 }), 'the last one done counts too').toEqual([])
})

test('with no plan: all leave 30 s after the end of the last of the wave', async () => {
  const list = [seat('done', 1000, 'a'), seat('done', 5000, 'b')]
  expect(leavers([...list, seat('working', 0, 'c')], { mode: 'plan', now: 900_000, planOver: 0 }), 'the wave is running').toEqual([])
  expect(leavers(list, { mode: 'plan', now: 5000 + LEAVE_MS - 1, planOver: 0 })).toEqual([])
  expect(ids(leavers(list, { mode: 'plan', now: 5000 + LEAVE_MS, planOver: 0 }))).toEqual(['a', 'b'])
})

test('as they finish: each leaves 30 s after its end, whatever the plan does', async () => {
  const list = [seat('done', 1000, 'a'), seat('done', 5000, 'b'), seat('working', 0, 'c')]
  expect(ids(leavers(list, { mode: 'each', now: 1000 + LEAVE_MS, planOver: null }))).toEqual(['a'])
})

test('stopped on an error, a desk never leaves on its own', async () => {
  const list = [seat('failed', 1000)]
  for (const mode of ['plan', 'each'] as const) expect(leavers(list, { mode, now: 9_000_000, planOver: 0 }), mode).toEqual([])
})

test('the pass only runs while a finished desk has its departure ahead', async () => {
  expect(leaveAhead([seat('done')], 'plan', 0), 'no plan').toBe(true)
  expect(leaveAhead([seat('done')], 'plan', 5000), 'plan finished').toBe(true)
  expect(leaveAhead([seat('done')], 'plan', null), 'an open plan holds it: no pass').toBe(false)
  expect(leaveAhead([seat('done')], 'each', null), 'one by one').toBe(true)
  expect(leaveAhead([seat('failed')], 'each', 0), 'a stopped desk waits for the next plan').toBe(false)
  expect(leaveAhead([], 'plan', 0), 'empty room').toBe(false)
})

test('the preference is plan, unless each', async () => {
  expect(departureOf({ departure: 'each' })).toBe('each')
  expect(departureOf({ departure: 'plan' })).toBe('plan')
  for (const other of [{}, null, 'each', { departure: 'other' }, 3]) expect(departureOf(other), String(other)).toBe('plan')
})

test('managerOf gives the turn and the plan, and says nothing of agents', async () => {
  const steps = [{ status: 'completed' as const }, { status: 'in_progress' as const }, { status: 'pending' as const }, { status: 'pending' as const }]
  expect(managerOf('working', steps)).toEqual({ working: true, done: 1, total: 4, live: true })
  expect(managerOf('done', steps).working).toBe(false)
  expect(managerOf(undefined, [])).toEqual({ working: false, done: 0, total: 0, live: false })
})
