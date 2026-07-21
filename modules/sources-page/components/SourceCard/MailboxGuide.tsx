import { Button } from '@ui-kit'
import { ExternalLink } from 'lucide-react'
import type { ReactElement } from 'react'

const APP_PASSWORDS_URL = 'https://myaccount.google.com/apppasswords'
// Route through Google's account chooser so a user signed into several Google
// accounts gets a "pick an account" screen first, instead of always landing on
// their primary account.
const APP_PASSWORDS_CHOOSER_URL = `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(
  APP_PASSWORDS_URL,
)}`

// Guided connect for the mail inbox: one click to Google App Passwords (via the
// account picker), then three plain steps, so the user never hunts for where to
// get the code. The anchor is intercepted by the window guards (PLAN.md §4.9)
// and handed to shell.openExternal, like every other external link.
export function MailboxGuide(): ReactElement {
  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground-muted">
        Pulls LinkedIn / Indeed / StepStone / Xing job alerts from your inbox into the feed.
      </p>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-foreground-subtle">
        <li>Turn on 2-Step Verification on the Google account you want (if it isn't already).</li>
        <li>
          Open App Passwords, <strong>pick that account</strong>, name it "EasyApply", and copy the
          16-character code.
        </li>
        <li>Paste that code and its Gmail address below, then Add account.</li>
      </ol>
      <Button asChild variant="secondary" size="sm">
        <a href={APP_PASSWORDS_CHOOSER_URL} target="_blank" rel="noreferrer">
          <ExternalLink />
          Open Google App Passwords
        </a>
      </Button>
    </div>
  )
}
