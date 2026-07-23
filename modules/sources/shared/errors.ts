// Error → message, following the `cause` chain.
//
// Wrapper libraries put the useful text in `cause`, not `message`: a failing
// upsert surfaced only as "Failed query: insert into jobs …" with the entire
// SQL and every parameter, while the actual Postgres reason sat one level down
// in `cause` and was discarded. A recorded failure that cannot explain itself
// costs far more than the few extra characters this adds.

const MAX_DEPTH = 4
// Drizzle's message embeds the whole statement + params (17 KB in the wild).
// Keep enough to identify the query, drop the rest.
const MAX_PART_CHARS = 300

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error) ?? String(error)
  } catch {
    return String(error)
  }
}

function clip(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > MAX_PART_CHARS
    ? `${collapsed.slice(0, MAX_PART_CHARS - 1)}…`
    : collapsed
}

export function describeError(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; depth < MAX_DEPTH && current !== null && current !== undefined; depth++) {
    const part = clip(messageOf(current))
    // A wrapper that merely repeats its cause adds nothing.
    if (part !== '' && !parts.includes(part)) parts.push(part)
    current = current instanceof Error ? current.cause : undefined
  }
  return parts.length === 0 ? 'unknown error' : parts.join(' ← caused by: ')
}
