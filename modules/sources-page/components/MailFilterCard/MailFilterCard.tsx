import type { MailScanConfig } from '@data'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Switch,
} from '@ui-kit'
import { Plus, X } from 'lucide-react'
import { type ReactElement, useState } from 'react'

export interface MailFilterCardProps {
  config: MailScanConfig
  // One callback: the card computes the next config and hands it back. The
  // SourcesPage persists it via useSetAppSettings.
  onChange: (next: MailScanConfig) => void
}

function fold(value: string): string {
  return value.trim().toLowerCase()
}

// The inbox agent's first-sweep filters, editable. A domain toggled OFF is
// HARD-EXCLUDED — its emails are never scanned, so no new jobs come from it
// (already-found jobs stay in the feed). Keywords only include. Presentational:
// every edit is handed back through onChange.
export function MailFilterCard({ config, onChange }: MailFilterCardProps): ReactElement {
  const [domainDraft, setDomainDraft] = useState('')
  const [keywordDraft, setKeywordDraft] = useState('')

  const toggleDomain = (domain: string): void =>
    onChange({
      ...config,
      domains: config.domains.map((d) => (d.domain === domain ? { ...d, enabled: !d.enabled } : d)),
    })

  const removeDomain = (domain: string): void =>
    onChange({ ...config, domains: config.domains.filter((d) => d.domain !== domain) })

  const addDomain = (): void => {
    const domain = fold(domainDraft)
    setDomainDraft('')
    if (domain === '' || config.domains.some((d) => d.domain === domain)) return
    onChange({ ...config, domains: [...config.domains, { domain, enabled: true }] })
  }

  const removeKeyword = (keyword: string): void =>
    onChange({ ...config, keywords: config.keywords.filter((k) => k !== keyword) })

  const addKeyword = (): void => {
    const keyword = fold(keywordDraft)
    setKeywordDraft('')
    if (keyword === '' || config.keywords.includes(keyword)) return
    onChange({ ...config, keywords: [...config.keywords, keyword] })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email scan filters</CardTitle>
        <CardDescription>
          The inbox agent's first sweep. Turn a sender <strong>off</strong> to stop scanning it
          entirely — no new jobs from it (already-found jobs stay). Keywords flag job mail from any
          sender.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Domains — each a Switch (on = scanned, off = excluded) + remove. */}
        <div className="space-y-2">
          <span className="label-caps">Job-sender domains</span>
          {/* Recessed one step below the card (§visual-hierarchy): surface-content
              (0.16) under the surface-raised card, full-strength border = a
              clear inset well, not a flat block. */}
          <ul className="divide-y divide-border-subtle rounded-md border border-border bg-surface-content">
            {config.domains.map((entry) => (
              <li key={entry.domain} className="flex items-center gap-2 px-3 py-1.5">
                <Switch
                  checked={entry.enabled}
                  onCheckedChange={() => toggleDomain(entry.domain)}
                  aria-label={`Scan ${entry.domain}`}
                />
                <span
                  className={
                    entry.enabled ? 'text-sm' : 'text-sm text-foreground-subtle line-through'
                  }
                >
                  {entry.domain}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${entry.domain}`}
                  className="ml-auto"
                  onClick={() => removeDomain(entry.domain)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              addDomain()
            }}
          >
            <Input
              value={domainDraft}
              onChange={(event) => setDomainDraft(event.target.value)}
              placeholder="add a domain, e.g. join.com"
              aria-label="New domain"
            />
            <Button type="submit" variant="secondary" className="shrink-0">
              <Plus /> Add
            </Button>
          </form>
        </div>

        {/* Keywords — include-only chips. Recessed well matches the domain list
            (§visual-hierarchy); the chips lift OFF the well so they read as
            distinct, instead of merging into the same-tone card. */}
        <div className="space-y-2">
          <span className="label-caps">Subject keywords</span>
          <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-surface-content p-2">
            {config.keywords.length === 0 ? (
              <span className="text-xs text-foreground-muted">No keywords.</span>
            ) : (
              config.keywords.map((keyword) => (
                <Badge
                  key={keyword}
                  variant="default"
                  className="gap-1 bg-surface-hover text-foreground"
                >
                  {keyword}
                  <button
                    type="button"
                    aria-label={`Remove ${keyword}`}
                    className="text-foreground-subtle transition-colors hover:text-foreground"
                    onClick={() => removeKeyword(keyword)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              addKeyword()
            }}
          >
            <Input
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              placeholder="add a keyword, e.g. praktikum"
              aria-label="New keyword"
            />
            <Button type="submit" variant="secondary" className="shrink-0">
              <Plus /> Add
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
