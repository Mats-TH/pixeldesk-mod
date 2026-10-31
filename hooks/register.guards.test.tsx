import { describe, expect, test } from 'claude-code/testing'

import { callTool, command, endTurn, mountBand, mountPane, receive, sendPlan, spawn, start, step, submit, world } from './test-kit'
import type { World } from './test-kit'

/** The slash commands a text names: never a path, a closing tag or a fraction. */
const commandsIn = (text: string) => [...text.matchAll(/(?<![\w<./:])\/([a-z][\w-]*)(?![\w/-])/g)].map(match => match[1])

/** The servers of the tools a text names. */
const serversIn = (text: string) => [...text.matchAll(/mcp__([a-z-]+)__/g)].map(match => match[1])

/** A text may name the mod and nothing but the mod. */
function namesOnlyItself(text: string) {
  expect(commandsIn(text).filter(name => name !== 'pixeldesk')).toEqual([])
  expect(serversIn(text).filter(name => name !== 'pixeldesk')).toEqual([])
}

/** A whole session, through everything that reads, writes or says something. */
async function fullSession($: any, w: World) {
  await start($)
  await submit($)
  await callTool($, 'Read', { file_path: 'a.ts' })
  await sendPlan($, [step('One', 'in_progress'), step('Two', 'pending')], 'Job')
  await sendPlan($, [step('One', 'completed'), step('Two', 'completed')], 'Job')
  await spawn($, w, 'a1')
  await callTool($, 'Read', { file_path: 'b.ts' }, 'a1')
  await sendPlan($, [step('Own', 'in_progress')], undefined, 'a1')
  await receive($)
  await endTurn($, { agentId: 'a1' })
  await endTurn($)
  await command($, 'hide')
  await command($, 'show')
  await command($, 'unknown')
  await w.clock.advance(70_000)
}

describe('what the mod touches and says', () => {
  test('every path read or written stays in its own folder', async ($, on) => {
    const w = world(on)
    await fullSession($, w)
    const paths = [...w.reads, ...w.writes, ...w.lists]
    expect(paths.length).toBeGreaterThan(0)
    // The transcripts are read for the cache's length, and nothing else leaves the mod's folder.
    expect(paths.filter(path => !path.includes('/.claude/pixeldesk/') && !path.includes('/.claude/projects'))).toEqual([])
    expect(w.writes.filter(path => !path.includes('/.claude/pixeldesk/'))).toEqual([])
  })

  test('with a known language the mod runs no command at all', async ($, on) => {
    const w = world(on)
    await fullSession($, w)
    expect(w.runs).toEqual([])
  })

  test('all it says, saves or draws names only its own command and tool', async ($, on) => {
    const w = world(on)
    await fullSession($, w)
    const said = JSON.stringify([w.commands, w.tools, w.spawned, w.toasts, w.opened, w.state])
    expect(said).toContain('mcp__pixeldesk__plan')
    namesOnlyItself(said)
    expect(w.files.size).toBeGreaterThan(0)
    for (const text of w.files.values()) namesOnlyItself(text)
    for (const surface of ['desktop', 'terminal'] as const) {
      const band = await mountBand($, surface)
      const pane = await mountPane($, surface)
      namesOnlyItself(JSON.stringify(await band.drawn()))
      namesOnlyItself(JSON.stringify(await pane.drawn()))
      await band.unmount()
      await pane.unmount()
    }
  })

  test('every drawing of the pane has a description: the desktop does not show one without', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1', { description: 'Check the room' })
    const ui = await mountPane($)
    const drawings = await ui.findAll({ type: 'Svg' })
    expect(drawings.length).toBeGreaterThan(2)
    expect((await ui.find({ key: 'live-manager' }))?.props.flexDirection, 'a small drawing sits flush on its cells').toBe('column')
    expect(drawings.filter((drawing: any) => !String(drawing.props?.alt ?? '').trim()).map((drawing: any) => drawing.props?.source?.slice(0, 120) ?? drawing)).toEqual([])
  })

  test('the pane and the prompt section carry its name', async ($, on) => {
    const w = world(on)
    await start($)
    expect(w.opened[0].id).toBe('pixeldesk')
    const { sections } = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] })
    expect(sections[0]!.id).toBe('pixeldesk:plan')
  })

  test('no state or answer speaks of the mod being off', async ($, on) => {
    const w = world(on)
    await fullSession($, w)
    expect(Object.keys(w.state)).not.toContain('off')
    expect(JSON.stringify(w.state)).not.toMatch(/désactiv/i)
  })
})
