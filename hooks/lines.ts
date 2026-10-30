/** On one line: a run of white space becomes a space, and none is left around. */
export const flat = (s: string) => s.replace(/\s+/g, ' ').trim()

/** At most `max` characters, the last an ellipsis when something was cut. */
export const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

/** Paths from an event or the environment, always with forward slashes. */
export const slashed = (path: string) => path.replace(/\\/g, '/')
