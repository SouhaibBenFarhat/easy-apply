import type { RemoteScope, SearchProfile } from '@data'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@ui-kit'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { clampRadius, parseKeywords } from './profile-form'

export interface SearchProfileCardProps {
  profile: SearchProfile
  saving: boolean
  onSave: (profile: SearchProfile) => void
}

const SCOPE_ROWS: ReadonlyArray<{ scope: RemoteScope; label: string; description: string }> = [
  { scope: 'germany', label: 'Germany', description: 'Remote roles hiring within Germany' },
  { scope: 'europe', label: 'Europe', description: 'Remote roles open across Europe' },
  { scope: 'worldwide', label: 'Worldwide', description: 'Fully location-independent roles' },
]

export function SearchProfileCard({
  profile,
  saving,
  onSave,
}: SearchProfileCardProps): ReactElement {
  const [city, setCity] = useState(profile.city)
  const [radius, setRadius] = useState(String(profile.radiusKm))
  const [keywords, setKeywords] = useState(profile.keywords.join(', '))
  const [scopes, setScopes] = useState<RemoteScope[]>(profile.remoteScopes)

  // Re-seed whenever the persisted profile (re)loads — cache hydration or a
  // background settings refetch after a save.
  useEffect(() => {
    setCity(profile.city)
    setRadius(String(profile.radiusKm))
    setKeywords(profile.keywords.join(', '))
    setScopes(profile.remoteScopes)
  }, [profile])

  const toggleScope = (scope: RemoteScope, enabled: boolean): void => {
    setScopes((current) => {
      const next = new Set(current)
      if (enabled) next.add(scope)
      else next.delete(scope)
      // Keep canonical order regardless of toggle sequence.
      return SCOPE_ROWS.map((row) => row.scope).filter((candidate) => next.has(candidate))
    })
  }

  const save = (): void => {
    onSave({
      city: city.trim(),
      radiusKm: clampRadius(radius),
      keywords: parseKeywords(keywords),
      remoteScopes: scopes,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Search profile</CardTitle>
        <CardDescription>What every job source searches for.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-city">City</Label>
            <Input
              id="profile-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-radius">Radius (km)</Label>
            <Input
              id="profile-radius"
              type="number"
              min={0}
              max={200}
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-keywords">Keywords</Label>
          <Input
            id="profile-keywords"
            value={keywords}
            placeholder="software, react, typescript"
            onChange={(event) => setKeywords(event.target.value)}
          />
          <p className="text-xs text-foreground-muted">Comma-separated, up to 10.</p>
        </div>
        <div className="space-y-3">
          <span className="label-caps block">Remote scopes</span>
          {SCOPE_ROWS.map(({ scope, label, description }) => (
            <div key={scope} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor={`profile-scope-${scope}`}>{label}</Label>
                <p className="text-xs text-foreground-muted">{description}</p>
              </div>
              <Switch
                id={`profile-scope-${scope}`}
                checked={scopes.includes(scope)}
                onCheckedChange={(checked) => toggleScope(scope, checked)}
              />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button disabled={saving} onClick={save}>
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}
