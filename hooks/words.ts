import { connectorOf, toolWords } from './connectors'
import { t } from './i18n'
import { cut, flat } from './lines'

const SEARCH_MAX = 40
const COMMAND_MAX = 80

/** A value of a tool's input, on one line; anything but a string reads as empty. */
const said = (value: unknown) => (typeof value === 'string' ? flat(value) : '')

const fileOf = (path: unknown) => said(path).split(/[\\/]/).filter(Boolean).pop() || t('step.aFile')

function hostOf(address: string) {
  try {
    return new URL(address).host || t('step.aPage')
  } catch {
    return t('step.aPage')
  }
}

function search(input: Record<string, unknown>) {
  const pattern = cut(said(input.pattern), SEARCH_MAX)
  return pattern ? t('step.search', { pattern }) : t('step.searchAny')
}

function command(input: Record<string, unknown>) {
  const label = said(input.description) || cut(said(input.command), COMMAND_MAX) || t('step.aCommand')
  return t('step.run', { label })
}

function connector(name: string, seen: Map<string, string>) {
  const { label, tool } = connectorOf(name, seen)
  const words = toolWords(tool, label)
  return words ? t('step.connector', { name: label, words }) : label
}

/** One tool call of an agent, as a sentence anyone can read. */
export function actionPhrase(tool: string, input: Record<string, unknown>, seen: Map<string, string>) {
  if (tool.startsWith('mcp__')) return connector(tool, seen)
  switch (tool) {
    case 'Read':
      return t('step.read', { name: fileOf(input.file_path) })
    case 'Write':
      return t('step.write', { name: fileOf(input.file_path) })
    case 'Edit':
    case 'MultiEdit':
      return t('step.edit', { name: fileOf(input.file_path) })
    case 'NotebookEdit':
      return t('step.edit', { name: fileOf(input.notebook_path) })
    case 'Grep':
    case 'Glob':
      return search(input)
    case 'Bash':
    case 'PowerShell':
      return command(input)
    case 'WebSearch':
      return t('step.webSearch', { query: said(input.query) })
    case 'WebFetch':
      return t('step.fetch', { host: hostOf(said(input.url)) })
    case 'Skill': {
      const name = said(input.skill)
      return name ? t('step.skill', { name }) : t('step.skillAny')
    }
    case 'Agent':
    case 'Task': {
      const description = said(input.description)
      return description ? t('step.agent', { description }) : t('step.agentAny')
    }
    case 'SendMessage':
      return t('step.send')
    case 'TodoWrite':
      return t('step.todo')
    case 'ToolSearch':
      return t('step.loadTools')
    default:
      return t('step.other', { tool })
  }
}
