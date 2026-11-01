import type { EngineInterface, PluginState, SessionMessage } from 'claude-code'

export type System = 'windows' | 'mac' | 'linux'

type Pixeldesk = PluginState['pixeldesk']
type Slot<K extends keyof Pixeldesk> = { get: () => Promise<Pixeldesk[K] | undefined>; set: (value: Pixeldesk[K]) => Promise<unknown> }
type Env = () => Promise<string | undefined>
type Ran = { exitCode: number; stdout: string }

/**
 * All the mod may ask of the engine. `hostOf` in `register.tsx` builds it from a hook's `$`, each call spelled out there,
 * so one file shows everything the mod reads, writes and runs. The commands it starts have their words in that file too.
 */
export type Host = {
  agent: Pick<EngineInterface['agent'], 'list'>
  clock: Pick<EngineInterface['clock'], 'after' | 'every' | 'now'>
  command: Pick<EngineInterface['command'], 'register'> & { compact: (brief: string) => Promise<unknown> }
  env: { userProfile: Env; home: Env; localAppData: Env; lcAll: Env; lcMessages: Env; lang: Env; language: Env }
  fs: Pick<EngineInterface['fs'], 'exists' | 'list' | 'write'> & { read: (path: string) => Promise<string> }
  model: Pick<EngineInterface['model'], 'complete' | 'fork'>
  process: { claude: (message: string, id: string, cwd: string, title: string) => Promise<Ran>; open: (system: System, target: string) => Promise<Ran>; systemCulture: () => Promise<Ran> }
  session: Pick<EngineInterface['session'], 'compact' | 'cwd' | 'id' | 'model' | 'usage'> & { messages: () => Promise<SessionMessage[]> }
  settings: { language: () => Promise<unknown> }
  store: Pick<EngineInterface['store'], 'get' | 'set'>
  tool: Pick<EngineInterface['tool'], 'register'>
  ui: Pick<EngineInterface['ui'], 'close' | 'copy' | 'open' | 'panes' | 'resolve' | 'status' | 'toast'>
  values: { [K in keyof Pixeldesk]: Slot<K> }
}
