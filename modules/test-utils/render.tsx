import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RenderHookOptions, RenderHookResult, RenderResult } from '@testing-library/react'
import { render as rtlRender, renderHook as rtlRenderHook } from '@testing-library/react'
import { TooltipProvider } from '@ui-kit'
import type { ReactElement, ReactNode } from 'react'

// Deterministic client for tests: no retries (IpcResult failures surface as
// error states immediately), nothing ever goes stale or gets collected
// mid-test.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Providers accumulate here as the app grows: QueryClientProvider (PR 10),
// TooltipProvider (PR 11). No router here — shell components are router-free
// by design, and @app tests mount the real router via <App />. Feature tests
// always use this render. Pass { client } to assert on / seed the query cache
// from the test.
export interface AppRenderOptions {
  client?: QueryClient
}

export function render(ui: ReactElement, options: AppRenderOptions = {}): RenderResult {
  const client = options.client ?? createTestQueryClient()
  function Providers({ children }: { children: ReactNode }): ReactElement {
    return (
      <QueryClientProvider client={client}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    )
  }
  return rtlRender(ui, { wrapper: Providers })
}

export interface AppRenderHookOptions<Props> extends RenderHookOptions<Props> {
  client?: QueryClient
}

// Same providers for hook tests; shadows RTL's renderHook in the barrel the
// way render does. A caller-supplied wrapper nests inside the providers.
export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options: AppRenderHookOptions<Props> = {},
): RenderHookResult<Result, Props> {
  const { client, wrapper: InnerWrapper, ...rest } = options
  const queryClient = client ?? createTestQueryClient()
  function Providers({ children }: { children: ReactNode }): ReactElement {
    const inner = InnerWrapper === undefined ? children : <InnerWrapper>{children}</InnerWrapper>
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{inner}</TooltipProvider>
      </QueryClientProvider>
    )
  }
  return rtlRenderHook(callback, { ...rest, wrapper: Providers })
}
