import type { RenderResult } from '@testing-library/react'
import { render as rtlRender } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

// Providers accumulate here as the app grows: QueryClientProvider (PR 10),
// router + TooltipProvider (PR 11). Feature tests always use this render.
function Providers({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>
}

export function render(ui: ReactElement): RenderResult {
  return rtlRender(ui, { wrapper: Providers })
}
