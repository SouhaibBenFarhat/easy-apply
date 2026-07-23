// Email bodies are hostile to a token budget: marketing mail pads its preview
// with hundreds of invisible characters, and every link is a ~1,500-char
// tracking URL that tokenizes at roughly one token per 2–3 chars. One real
// Instaffo digest was 10k chars of which ~200 were content — and the model,
// required to echo an applyUrl, spent minutes hand-copying a tracking URL token
// by token. Sanitizing swaps each URL for a short [LINK-n] tag the model can
// cite in a couple of tokens; the harness expands the tag back to the real URL
// after extraction. The anchor-on-a-real-link rule gets STRONGER, not weaker: a
// cited tag provably exists in the email, while a raw URL might be dreamt up.

// Zero-width/format characters marketing emails pad previews with: the
// combining grapheme joiner (alternated, since a combining char can't sit in a
// character class), soft hyphen, zero-width spaces/joiners, directional marks,
// word joiner, BOM.
const INVISIBLE_RE = /\u034f|[\u00ad\u200b-\u200f\u2060\ufeff]/g

// A URL up to the next whitespace/delimiter. ')' stops it because
// stripHtmlKeepingLinks renders anchors as "label (url)"; ']' so a URL can
// never swallow a neighbouring tag.
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g

export interface SanitizedEmail {
  text: string
  // Tag ("LINK-1") → the original URL it replaced.
  links: Record<string, string>
}

export function sanitizeEmailForPrompt(input: string): SanitizedEmail {
  const links: Record<string, string> = {}
  const tagByUrl = new Map<string, string>()
  const tagged = input.replace(INVISIBLE_RE, '').replace(URL_RE, (url) => {
    let tag = tagByUrl.get(url)
    if (tag === undefined) {
      tag = `LINK-${tagByUrl.size + 1}`
      tagByUrl.set(url, tag)
      links[tag] = url
    }
    return `[${tag}]`
  })
  // Stripping invisibles leaves large whitespace runs — collapse them but keep
  // the line structure (one listing per block helps the model).
  const text = tagged
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
  return { text, links }
}

// What the model cites back: "[LINK-3]", bare "LINK-3", odd casing or stray
// spaces tolerated — small local models are sloppy with brackets.
const TAG_RE = /^\[?\s*(link-\d+)\s*\]?$/i

export function expandLinkTag(value: string, links: Record<string, string>): string | null {
  const tag = TAG_RE.exec(value.trim())?.[1]
  if (tag === undefined) return null
  return links[tag.toUpperCase()] ?? null
}
