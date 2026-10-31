import { describe, expect, test } from 'claude-code/testing'

import { connectorOf, toolWords } from './connectors'
import { callTool, spawn, start, world } from './test-kit'

/** What one call of an agent reads as on its record. */
async function phrase($: any, on: any, tool: string, input: Record<string, unknown>) {
  const w = world(on)
  await start($)
  await spawn($, w, 'a1')
  await callTool($, tool, input, 'a1')
  return w.state.agents[0].steps[0].live as string
}

const CASES: [string, Record<string, unknown>, string][] = [
  ['Read', { file_path: 'C:\\repo\\src\\a.ts' }, 'Lecture de a.ts'],
  ['Read', { file_path: '/repo/src/b.ts' }, 'Lecture de b.ts'],
  ['Read', {}, 'Lecture de un fichier'],
  ['Write', { file_path: 'x/c.md' }, 'Écriture de c.md'],
  ['Edit', { file_path: 'x/d.md' }, 'Modification de d.md'],
  ['MultiEdit', { file_path: 'x/e.md' }, 'Modification de e.md'],
  ['NotebookEdit', { notebook_path: 'x/f.ipynb' }, 'Modification de f.ipynb'],
  ['Grep', { pattern: 'needle' }, 'Recherche de « needle » dans les fichiers'],
  ['Glob', { pattern: '**/*.ts' }, 'Recherche de « **/*.ts » dans les fichiers'],
  ['Grep', {}, 'Recherche dans les fichiers'],
  ['Bash', { description: 'Run the tests', command: 'npm test' }, 'Exécution : Run the tests'],
  ['PowerShell', { command: 'Get-Date' }, 'Exécution : Get-Date'],
  ['Bash', {}, 'Exécution : une commande'],
  ['WebSearch', { query: 'pixel art' }, 'Recherche web : pixel art'],
  ['WebFetch', { url: 'https://example.com/a/b?c=d' }, 'Ouverture de example.com'],
  ['WebFetch', { url: 'not an address' }, 'Ouverture de une page web'],
  ['Skill', { skill: 'pdf' }, 'Compétence pdf'],
  ['Skill', {}, 'Utilise une compétence'],
  ['Agent', { description: 'Find it' }, 'Lancement d’un sous-agent : Find it'],
  ['Task', {}, 'Lancement d’un sous-agent'],
  ['SendMessage', {}, 'Envoi d’un message'],
  ['TodoWrite', { todos: [] }, 'Mise à jour de sa liste de tâches'],
  ['ToolSearch', {}, 'Chargement d’outils'],
  ['Mystery', {}, 'Utilise Mystery'],
]

describe('actions in plain words', () => {
  for (const [tool, input, expected] of CASES) {
    test(`${tool} ${JSON.stringify(input)}`, async ($, on) => {
      expect(await phrase($, on, tool, input)).toBe(expected)
    })
  }

  test('a search pattern is cut at 40', async ($, on) => {
    expect(await phrase($, on, 'Grep', { pattern: 'p'.repeat(60) })).toBe(`Recherche de « ${'p'.repeat(39)}… » dans les fichiers`)
  })

  test('a command is cut at 80', async ($, on) => {
    expect(await phrase($, on, 'Bash', { command: 'c'.repeat(100) })).toBe(`Exécution : ${'c'.repeat(79)}…`)
  })

  test('values come on one line', async ($, on) => {
    expect(await phrase($, on, 'Bash', { description: 'two\n   lines' })).toBe('Exécution : two lines')
  })
})

describe('connectors, as agents use them', () => {
  const RANDOM = 'a1b2c3d4-0000-4111-8222-333344445555'

  test('a tool of a connector, by its label', async ($, on) => {
    expect(await phrase($, on, 'mcp__claude_ai_Slack__slack_search_public', {})).toBe('Slack : search public')
  })

  test('a plugin\'s server loses its prefix', async ($, on) => {
    expect(await phrase($, on, 'mcp__plugin_demo_fireflies__fireflies_search', {})).toBe('Fireflies : search')
  })

  test('a random server named by its tool', async ($, on) => {
    expect(await phrase($, on, `mcp__${RANDOM}__notion-search`, {})).toBe('Notion : search')
  })

  test('an unknown tool says connector, never the raw id', async ($, on) => {
    const said = await phrase($, on, `mcp__${RANDOM}__doSomethingNew`, {})
    expect(said).toBe('Connecteur : do something new')
    expect(said).not.toContain('a1b2c3d4')
  })

  test('the first tool recognised names the server for the session', async ($, on) => {
    const w = world(on)
    await start($)
    await spawn($, w, 'a1')
    await callTool($, `mcp__${RANDOM}__list_landing_pages`, {}, 'a1')
    await callTool($, `mcp__${RANDOM}__list_posts`, {}, 'a1')
    expect(w.state.agents[0].steps.map((s: any) => s.live)).toEqual(['Kit : list landing pages', 'Kit : list posts'])
  })
})

const label = (tool: string, server = 'abcdef01-2345-4678-9abc-def012345678') => connectorOf(`mcp__${server}__${tool}`, new Map()).label
const named = (server: string) => connectorOf(`mcp__${server}__tool`, new Map()).label

describe('servers with a readable name', () => {
  const TABLE: [string, string][] = [
    ['apify', 'Apify'], ['attio', 'Attio'], ['claude_browser', 'Browser'], ['calendly', 'Calendly'], ['chat-relay', 'Chat Relay'],
    ['claude-in-chrome', 'Chrome'], ['circle', 'Circle'], ['circle-community', 'Circle'], ['composio', 'Composio'], ['figma', 'Figma'],
    ['firecrawl', 'Firecrawl'], ['fireflies', 'Fireflies'], ['github', 'GitHub'], ['gmail', 'Gmail'], ['google-calendar', 'Google Calendar'],
    ['google-drive', 'Google Drive'], ['google-workspace', 'Google Workspace'], ['briefing', 'Briefing'], ['higgsfield', 'Higgsfield'], ['hubspot', 'HubSpot'],
    ['kit', 'Kit'], ['linear', 'Linear'], ['make', 'Make'], ['notion', 'Notion'], ['pandadoc', 'PandaDoc'], ['pipedrive', 'Pipedrive'], ['posthog', 'PostHog'],
    ['reddit', 'Reddit'], ['shopify', 'Shopify'], ['slack', 'Slack'], ['stripe', 'Stripe'], ['supabase', 'Supabase'], ['vercel', 'Vercel'], ['vidiq', 'vidIQ'], ['youtube', 'YouTube'],
  ]

  test('the whole table', () => {
    for (const [server, name] of TABLE) expect(named(server)).toBe(name)
  })

  test('prefixes go, the case does not matter', () => {
    expect(named('plugin_foo_GitHub')).toBe('GitHub')
    expect(named('claude_ai_HubSpot')).toBe('HubSpot')
    expect(named('plugin_foo_google-drive')).toBe('Google Drive')
  })

  test('an unknown name in title case, word by word', () => {
    expect(named('my-cool_server')).toBe('My Cool Server')
  })

  test('a cleaning that leaves nothing keeps the original', () => {
    expect(named('claude_ai_')).toBe('Claude Ai')
  })
})

describe('servers with a random id', () => {
  test('hex and dashes after eight hex characters, in any case', () => {
    expect(label('slack_x', 'ABCDEF01-2345')).toBe('Slack')
    expect(named('abcdef01-xyz')).toBe('Abcdef01 Xyz')
    expect(named('abcdefg1-2345')).toBe('Abcdefg1 2345')
  })

  const TOOLS: [string, string][] = [
    ['find_person_email', 'AnyMailFinder'], ['find_company_emails', 'AnyMailFinder'], ['find_decision_maker_emails', 'AnyMailFinder'], ['verify_email', 'AnyMailFinder'], ['report_bad_email', 'AnyMailFinder'],
    ['get-apify-run', 'Apify'], ['get-key-value-store', 'Apify'], ['list-actors', 'Apify'], ['get-actor-run', 'Apify'], ['read-dataset', 'Apify'],
    ['semantic-search-notes', 'Attio'], ['get-call-recording', 'Attio'], ['add-list-entry-values', 'Attio'], ['create-record', 'Attio'], ['search-records', 'Attio'], ['list-workspace-members', 'Attio'], ['list-workspace-teams', 'Attio'], ['list-attribute-definitions', 'Attio'], ['run-basic-report', 'Attio'],
    ['get_calendly_user', 'Calendly'], ['users-get', 'Calendly'], ['event_types-list', 'Calendly'], ['routing_forms-list', 'Calendly'],
    ['get_access_group', 'Circle'], ['advanced_search', 'Circle'], ['list_spaces', 'Circle'], ['get_space', 'Circle'], ['list_paywall_prices', 'Circle'], ['add_community_member', 'Circle'],
    ['composio_run', 'Composio'],
    ['weave_run_model', 'Figma'], ['get_code_connect_map', 'Figma'], ['create_shader', 'Figma'], ['use_figma', 'Figma'], ['get_figjam', 'Figma'],
    ['fireflies_search', 'Fireflies'],
    ['get_message', 'Gmail'], ['reply', 'Gmail'], ['forward', 'Gmail'], ['update_message_labels', 'Gmail'],
    ['list_calendars', 'Google Calendar'], ['suggest_time', 'Google Calendar'],
    ['read_file_content', 'Google Drive'], ['trash_file', 'Google Drive'],
    ['get_values', 'Google Sheets'], ['append_values', 'Google Sheets'],
    ['ads_studio_make', 'Higgsfield'], ['ai_influencer_make', 'Higgsfield'], ['scene_builder_3d_make', 'Higgsfield'], ['shorts_studio_make', 'Higgsfield'], ['tiktok_post', 'Higgsfield'],
    ['list_landing_pages', 'Kit'], ['add_subscriber', 'Kit'], ['create_broadcast', 'Kit'],
    ['app-module_get', 'Make'], ['app-modules_list', 'Make'], ['data-store-records_get', 'Make'], ['scenarios_run', 'Make'], ['hook-get-url_run', 'Make'], ['connection-test_run', 'Make'],
    ['ads_get_report', 'Meta Ads'],
    ['notion-search', 'Notion'],
    ['slack_post', 'Slack'],
    ['execute_sql', 'Supabase'], ['list_tables', 'Supabase'],
    ['get_deployment', 'Vercel'], ['edge_config_get', 'Vercel'], ['kms_sign', 'Vercel'], ['create_sandboxes_v2', 'Vercel'], ['list_drains', 'Vercel'], ['get_drain', 'Vercel'], ['toolbar_read', 'Vercel'],
    ['enrich-business', 'Vibe Prospecting'], ['match-prospects', 'Vibe Prospecting'],
    ['vidiq_search', 'vidIQ'],
    ['getChannelStatistics', 'YouTube'], ['searchVideos', 'YouTube'],
  ]

  test('one tool of every family', () => {
    for (const [tool, name] of TOOLS) expect([tool, label(tool)]).toEqual([tool, name])
  })

  test('the case does not matter, YouTube aside', () => {
    expect(label('EXECUTE_SQL')).toBe('Supabase')
    expect(label('SLACK_POST')).toBe('Slack')
    expect(label('searchvideos')).toBe('Connecteur')
  })

  test('Higgsfield comes before Meta Ads', () => {
    expect(label('ads_studio_run')).toBe('Higgsfield')
    expect(label('ads_run')).toBe('Meta Ads')
  })

  test('families and exact lists come before what a name holds', () => {
    expect(label('slack_broadcast')).toBe('Slack')
    expect(label('fireflies_sequence')).toBe('Fireflies')
    expect(label('search_design_system')).toBe('Figma')
  })

  test('among contents, the order of the table', () => {
    expect(label('sequence_paywall')).toBe('Kit')
    expect(label('paywall-actor-x')).toBe('Circle')
    expect(label('get-actor-records')).toBe('Apify')
    expect(label('get-deployment-records')).toBe('Attio')
    expect(label('deployment_shader')).toBe('Vercel')
  })

  test('the name sticks, an unknown tool keeps it', () => {
    const seen = new Map<string, string>()
    const server = 'abcdef01-2345'
    expect(connectorOf(`mcp__${server}__list_spaces`, seen).label).toBe('Circle')
    expect(connectorOf(`mcp__${server}__list_posts`, seen).label).toBe('Circle')
    expect(connectorOf(`mcp__${server}__slack_x`, seen).label).toBe('Circle')
  })

  test('what follows the server is the tool, double underscores included', () => {
    expect(connectorOf('mcp__github__get__repo', new Map()).tool).toBe('get__repo')
  })
})

describe('the words of a tool', () => {
  test('cut on dashes, underscores, spaces and case changes, in lowercase', () => {
    expect(toolWords('doSomething_new-now it', 'Other')).toBe('do something new now it')
  })

  test('the first word goes if it repeats the label', () => {
    expect(toolWords('slack_search_public', 'Slack')).toBe('search public')
    expect(toolWords('google_get', 'Google Calendar')).toBe('get')
    expect(toolWords('search_slack', 'Slack')).toBe('search slack')
  })
})
