import type { SourceInfo } from '@data'
import type { FeedFilters, SourceId, WorkMode } from '@sources/shared'
import {
  Badge,
  Button,
  Input,
  Label,
  ListMenu,
  ListMenuItem,
  ListMenuSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@ui-kit'
import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'

export interface FilterBarProps {
  filters: FeedFilters
  sources: SourceInfo[]
  onChange: (filters: FeedFilters) => void
}

const SEARCH_DEBOUNCE_MS = 250

type WorkModeTab = 'all' | 'onsite' | 'hybrid' | 'remote'

const WORK_MODE_TABS: Array<{ value: WorkModeTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
]

function workModeTab(workModes: WorkMode[] | undefined): WorkModeTab {
  if (workModes === undefined || workModes.length !== 1) return 'all'
  const mode = workModes[0]
  return mode === undefined || mode === 'unknown' ? 'all' : mode
}

export function FilterBar({ filters, sources, onChange }: FilterBarProps): ReactElement {
  const propSearch = filters.search ?? ''
  const [search, setSearch] = useState(propSearch)

  // Debounce plumbing: refs keep the effect's deps down to the typed text, so
  // the timer restarts on keystrokes only — not on unrelated filter changes.
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Adopt external search changes (reset-filters) without fighting the user:
  // only overwrite the draft when the prop moved to something we didn't emit.
  const lastEmitted = useRef(propSearch)
  useEffect(() => {
    if (propSearch !== lastEmitted.current) {
      lastEmitted.current = propSearch
      setSearch(propSearch)
    }
  }, [propSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim() === '' ? undefined : search
      if ((next ?? '') === (filtersRef.current.search ?? '')) return
      lastEmitted.current = next ?? ''
      onChangeRef.current({ ...filtersRef.current, search: next })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const activeSources = filters.sources ?? sources.map((info) => info.sourceId)
  const toggleSource = (sourceId: SourceId): void => {
    const next = activeSources.includes(sourceId)
      ? activeSources.filter((id) => id !== sourceId)
      : [...activeSources, sourceId]
    // Selecting every source is the same as not filtering at all.
    onChange({ ...filters, sources: next.length === sources.length ? undefined : next })
  }

  return (
    <div className="glass sticky top-0 z-10 flex shrink-0 flex-col gap-2 p-2">
      <Tabs
        value={workModeTab(filters.workModes)}
        onValueChange={(value) => {
          onChange({
            ...filters,
            workModes: value === 'all' ? undefined : [value as WorkMode],
          })
        }}
      >
        <TabsList aria-label="Work mode" className="w-full">
          {WORK_MODE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-3">
        <Input
          type="search"
          placeholder="Search title or company…"
          aria-label="Search jobs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-8 min-w-0 flex-1"
        />
        <span className="flex shrink-0 items-center gap-1.5">
          <Switch
            id="filter-has-salary"
            checked={filters.hasSalary === true}
            onCheckedChange={(checked) => {
              onChange({ ...filters, hasSalary: checked ? true : undefined })
            }}
          />
          <Label htmlFor="filter-has-salary" className="text-xs text-foreground-muted">
            Salary
          </Label>
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              Sources
              {filters.sources !== undefined ? (
                <Badge variant="copper">{filters.sources.length}</Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <ListMenu aria-label="Sources">
              {sources.map((info) => (
                <span
                  key={info.sourceId}
                  className="flex items-center justify-between gap-3 rounded-sm px-3 py-2"
                >
                  <Label
                    htmlFor={`filter-source-${info.sourceId}`}
                    className="min-w-0 flex-1 truncate text-sm"
                  >
                    {info.displayName}
                  </Label>
                  <Switch
                    id={`filter-source-${info.sourceId}`}
                    checked={activeSources.includes(info.sourceId)}
                    onCheckedChange={() => toggleSource(info.sourceId)}
                  />
                </span>
              ))}
              <ListMenuSeparator />
              <ListMenuItem
                disabled={filters.sources === undefined}
                onClick={() => onChange({ ...filters, sources: undefined })}
              >
                All sources
              </ListMenuItem>
            </ListMenu>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
