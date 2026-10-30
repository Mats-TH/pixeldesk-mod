import { t } from './i18n'

// Most servers read well in title case: these are the ones that spell or name themselves otherwise.
const SPELLED: Readonly<Record<string, string>> = {
  claude_browser: 'Browser',
  'claude-in-chrome': 'Chrome',
  'circle-community': 'Circle',
  github: 'GitHub',
  hubspot: 'HubSpot',
  pandadoc: 'PandaDoc',
  posthog: 'PostHog',
  vidiq: 'vidIQ',
  youtube: 'YouTube',
}

// Whole tool names, lowercased. An exact name is the surest sign, so these are asked first.
const EXACT: readonly [label: string, names: readonly string[]][] = [
  ['AnyMailFinder', ['find_person_email', 'find_person_emails', 'find_company_email', 'find_company_emails', 'find_decision_maker_email', 'find_decision_maker_emails', 'find_decision_makers_email', 'find_decision_makers_emails', 'verify_email', 'report_bad_email']],
  ['Attio', ['run-basic-report']],
  ['Figma', ['create_design_system_rules', 'get_design_context', 'get_figjam', 'get_figma_skill', 'get_motion_context', 'get_variable_defs', 'search_design_system', 'send_code_to_figma', 'use_figma']],
  ['Gmail', ['apply_sensitive_message_label', 'apply_sensitive_thread_label', 'create_draft', 'create_label', 'delete_draft', 'delete_label', 'forward', 'get_draft', 'get_message', 'get_thread', 'label_message', 'label_thread', 'list_drafts', 'list_labels', 'mark_message_spam', 'mark_thread_spam', 'reply', 'search_threads', 'trash_message', 'trash_thread', 'unlabel_message', 'unlabel_thread', 'unmark_message_spam', 'unmark_thread_spam', 'untrash_message', 'untrash_thread', 'update_draft', 'update_label', 'update_message_labels']],
  ['Google Calendar', ['list_calendars', 'respond_to_event', 'search_events', 'suggest_time']],
  ['Google Drive', ['copy_file', 'download_file_content', 'get_file_metadata', 'get_file_permissions', 'list_recent_files', 'read_file_content', 'search_files', 'share_file', 'trash_file']],
  ['Google Sheets', ['append_values', 'batch_clear_values', 'copy_sheet_to_another_spreadsheet', 'get_spreadsheet', 'get_values', 'insert_dimension', 'update_formulas', 'update_spreadsheet', 'update_values']],
  ['Supabase', ['apply_migration', 'create_edge_function_secret', 'deploy_edge_function', 'execute_sql', 'generate_typescript_types', 'get_advisors', 'get_edge_function', 'get_project_url', 'get_publishable_keys', 'list_edge_functions', 'list_extensions', 'list_migrations', 'list_tables']],
  ['Vibe Prospecting', ['enrich-business', 'enrich-prospects', 'fetch-businesses-events', 'fetch-entities', 'fetch-entities-statistics', 'fetch-prospects-events', 'match-business', 'match-prospects']],
]

// The one list where the case counts.
const YOUTUBE: readonly string[] = ['getChannelStatistics', 'getChannelTopVideos', 'getTranscripts', 'getTrendingVideos', 'getVideoCategories', 'getVideoComments', 'getVideoDetails', 'searchVideos']

// The prefix of a family of tools. Higgsfield comes before Meta Ads: one of its families starts `ads_` too.
const FAMILIES: readonly [label: string, prefix: RegExp][] = [
  ['Composio', /^composio_/],
  ['Figma', /^weave_/],
  ['Fireflies', /^fireflies_/],
  ['Higgsfield', /^(?:ads_studio|ai_influencer|scene_builder_3d|shorts_studio|tiktok)_/],
  ['Meta Ads', /^ads_/],
  ['Notion', /^notion-/],
  ['Slack', /^slack_/],
  ['vidIQ', /^vidiq_/],
  ['Attio', /^semantic-search-/],
  ['Calendly', /^(?:availability|event_types|locations|meetings|organizations|routing_forms|scheduling_links|shares|users)-/],
  ['Make', /^(?:app-modules?|connections|credential-requests|data-store-records|data-stores?|data-structures?|executions|hooks|scenarios?)_/],
  ['Make', /^(?:connection|hook|scenario)-[a-z-]+_/],
]

// What a name holds, last: the first that matches wins, so the order is the table's.
const CONTENT: readonly [label: string, words: RegExp][] = [
  ['Kit', /broadcast|creator_profile|email_stats|email_template|growth_stats|landing_page|sequence|snippet|subscriber/],
  ['Circle', /access_group|advanced_search|community_member|course_lesson|course_section|filter_kit|flagged_content|gamification|live_room|member_tag|paywall|post_summary|space_group|space_member|tagged_member|(?:^|_)spaces?(?:_|$)/],
  ['Apify', /apify|key-value-store|(?:^|-)(?:actors?|dataset)(?:-|$)/],
  ['Attio', /call-recording|-list-entry-|-records?(?:-|$)|-workspace-members$|-workspace-teams$|attribute-definitions$/],
  ['Vercel', /deployment|edge_config|kms_|named_sandbox|project_domain|rolling_release|sandboxes|toolbar_|vercel|_drains?$/],
  ['Figma', /code_connect|generative_plugin|shader/],
  ['Calendly', /calendly/],
]

const RANDOM_SERVER = /^[0-9a-f]{8}-[0-9a-f-]+$/i
const SERVER_PREFIX = /^(?:plugin_[^_]+_|claude_ai_)/i

/** The connector a tool of a server with a random id belongs to, by the name of the tool alone. */
function fromTool(tool: string) {
  if (YOUTUBE.includes(tool)) return 'YouTube'
  const name = tool.toLowerCase()
  return (
    EXACT.find(([, names]) => names.includes(name))?.[0] ??
    FAMILIES.find(([, prefix]) => prefix.test(name))?.[0] ??
    CONTENT.find(([, words]) => words.test(name))?.[0] ??
    null
  )
}

/** A word in title case. One shouted in capitals is brought down first. */
const titled = (word: string) => {
  const quiet = word === word.toUpperCase() ? word.toLowerCase() : word
  return quiet.charAt(0).toUpperCase() + quiet.slice(1)
}

/** A readable server: its own words in title case, unless it spells itself otherwise. */
function fromServer(server: string) {
  const clean = server.replace(SERVER_PREFIX, '') || server
  return SPELLED[clean.toLowerCase()] ?? (clean.split(/[-_\s]+/).filter(Boolean).map(titled).join(' ') || server)
}

/** The tool's own words, in lowercase, without the name of the connector it repeats. */
export function toolWords(tool: string, label: string) {
  const words = tool.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[-_\s]+/).filter(Boolean).map(word => word.toLowerCase())
  return (words[0] === label.split(' ')[0]!.toLowerCase() ? words.slice(1) : words).join(' ')
}

/**
 * The name to show for an MCP tool. `seen` keeps, for the session, what a random server turned out to be:
 * the first tool recognised names it, and the tools that say nothing keep that name.
 */
export function connectorOf(name: string, seen: Map<string, string>) {
  const [, server = '', ...rest] = name.split('__')
  const tool = rest.join('__')
  if (!RANDOM_SERVER.test(server)) return { label: fromServer(server), tool }
  const label = seen.get(server) ?? fromTool(tool)
  if (!label) return { label: t('connector.other'), tool }
  seen.set(server, label)
  return { label, tool }
}
