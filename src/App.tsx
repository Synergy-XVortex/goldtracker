import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import { AuthProvider } from './features/auth/AuthProvider'
import { ThemeProvider } from './features/theme/ThemeProvider'
import {
  CACHE_MAX_AGE_MS,
  CACHE_VERSION,
  queryClient,
  queryPersister,
} from './lib/queryPersistence'

export function App() {
  return (
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: CACHE_MAX_AGE_MS,
          buster: CACHE_VERSION,
        }}
      >
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  )
}
