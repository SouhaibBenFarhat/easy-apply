import { cn } from '@ui-kit'
import DOMPurify from 'dompurify'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

// PLAN.md §4.9 — description HTML policy. Allowlist, not blocklist: formatting
// tags only; img/picture/iframe/svg/style/script simply aren't in the list, so
// descriptions render text-only with no remote content. Anchors keep href and
// nothing else (target/rel/onclick all stripped by ALLOWED_ATTR): clicks
// bubble up to the main process's window-open/will-navigate guards, which
// route http(s) URLs through shell.openExternal — DOMPurify is the belt,
// the guards are the suspenders.
const ALLOWED_TAGS = [
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'h1',
  'h2',
  'h3',
  'h4',
  'code',
  'pre',
  'blockquote',
  'a',
]
const ALLOWED_ATTR = ['href']

export function sanitizeDescription(html: string): string {
  // ALLOW_DATA_ATTR defaults to true; descriptions have no use for data-* and
  // the allowlist stance is "nothing we didn't ask for".
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false })
}

export interface SanitizedDescriptionProps {
  html: string
  className?: string
}

// Prose-ish typography via descendant utilities: source HTML carries no
// classes, so the wrapper styles every allowed tag. Headings are deliberately
// flattened toward body size — job boards abuse h1/h2 for shouting.
const PROSE_CLASSES = cn(
  'max-w-none text-sm leading-relaxed text-foreground',
  '[&_p]:mb-3 [&_p:last-child]:mb-0',
  '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:mb-1',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_strong]:font-semibold [&_b]:font-semibold',
  '[&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h4]:text-sm',
  '[&_h1]:mt-4 [&_h2]:mt-4 [&_h3]:mt-3 [&_h4]:mt-3',
  '[&_h1]:mb-2 [&_h2]:mb-2 [&_h3]:mb-1.5 [&_h4]:mb-1.5',
  '[&_code]:font-mono [&_code]:text-xs',
  '[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-surface [&_pre]:p-3',
  '[&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border',
  '[&_blockquote]:pl-3 [&_blockquote]:text-foreground-muted',
)

export function SanitizedDescription({ html, className }: SanitizedDescriptionProps): ReactElement {
  const sanitized = useMemo(() => sanitizeDescription(html), [html])
  return (
    <div
      className={cn(PROSE_CLASSES, className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized just above via the §4.9 DOMPurify allowlist
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
