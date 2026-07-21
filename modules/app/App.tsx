import { createQueryClient, setupPersistence } from '@data'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { createAppRouter } from './router'
import { ThemeManager } from './ThemeManager'

export function App(): ReactElement {
  // useState initializers: exactly one client + router per mounted app,
  // stable across re-renders, fresh per test mount.
  const [client] = useState(() => {
    const queryClient = createQueryClient()
    setupPersistence(queryClient)
    return queryClient
  })
  const [router] = useState(() => createAppRouter())

  return (
    <QueryClientProvider client={client}>
      <ThemeManager />
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
