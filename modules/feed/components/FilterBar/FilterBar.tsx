import type { SourceInfo } from '@data'
import type { FeedFilters, JobOrigin, SourceId, WorkMode } from '@sources/shared'
import {
  Button,
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
import { Settings2 } from 'lucide-react'
import type { ReactElement } from 'react'

export interface FilterBarProps {
  filters: FeedFilters
  sources: SourceInfo[]
  onChange: (filters: FeedFilters) => void
}

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

// Segmented origin filter: All / Inbox (agent) / APIs.
const ORIGIN_OPTIONS: Array<{ value: 'all' | JobOrigin; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'agent', label: 'Inbox' },
  { value: 'api', label: 'APIs' },
]

export function FilterBar({ filters, sources, onChange }: FilterBarProps): ReactElement {
  const activeSources = filters.sources ?? sources.map((info) => info.sourceId)
  const toggleSource = (sourceId: SourceId): void => {
    const next = activeSources.includes(sourceId)
      ? activeSources.filter((id) => id !== sourceId)
      : [...activeSources, sourceId]
    // Selecting every source is the same as not filtering at all.
    onChange({ ...filters, sources: next.length === sources.length ? undefined : next })
  }
  const activeOrigin: 'all' | JobOrigin = filters.origin ?? 'all'
  const filtersActive =
    filters.hasSalary === true || filters.sources !== undefined || filters.origin !== undefined

  return (
    // The job-list sidebar's header (§sidebars): work-mode tabs + a gear that
    // opens the salary / source controls. `surface-hover` chrome + full border.
    // px-3 matches the job cards' 12px gutter so header and list share one
    // left/right grid line.
    <div className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-border bg-surface-hover px-3 py-2">
      <Tabs
        value={workModeTab(filters.workModes)}
        onValueChange={(value) => {
          onChange({
            ...filters,
            workModes: value === 'all' ? undefined : [value as WorkMode],
          })
        }}
        className="min-w-0 flex-1"
      >
        <TabsList aria-label="Work mode" className="w-full">
          {WORK_MODE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Filters" className="relative shrink-0">
            <Settings2 />
            {filtersActive ? (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-info" aria-hidden />
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-2 p-2">
          <div className="space-y-1.5 px-1 py-1">
            <Label className="text-sm">Found via</Label>
            <div className="flex gap-1">
              {ORIGIN_OPTIONS.map((option) => {
                const active = activeOrigin === option.value
                return (
                  <Button
                    key={option.value}
                    variant={active ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-pressed={active}
                    className="flex-1"
                    onClick={() =>
                      onChange({
                        ...filters,
                        origin: option.value === 'all' ? undefined : option.value,
                      })
                    }
                  >
                    {option.label}
                  </Button>
                )
              })}
            </div>
          </div>
          <ListMenuSeparator />
          <div className="flex items-center justify-between gap-3 px-1 py-1">
            <Label htmlFor="filter-has-salary" className="text-sm">
              Has salary
            </Label>
            <Switch
              id="filter-has-salary"
              checked={filters.hasSalary === true}
              onCheckedChange={(checked) => {
                onChange({ ...filters, hasSalary: checked ? true : undefined })
              }}
            />
          </div>
          <ListMenuSeparator />
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
  )
}
