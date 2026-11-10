import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { del, get, set } from 'idb-keyval'

/**
 * Query results are kept in IndexedDB so the last prices and portfolio stay
 * readable offline. The service worker already caches the app itself.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Show cached data immediately, refresh it when the network is there.
      networkMode: 'offlineFirst',
      // Kept long enough to survive a few days offline.
      gcTime: 7 * 24 * 60 * 60 * 1000,
    },
  },
})

const STORAGE_KEY = 'goldtracker.query-cache'

export const queryPersister = createAsyncStoragePersister({
  key: STORAGE_KEY,
  storage: {
    getItem: async (key) => (await get<string>(key)) ?? null,
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
})

/** Bump when the shape of cached data changes, so old caches are dropped. */
export const CACHE_VERSION = 'v1'
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Removes private data from memory and from the device, e.g. on sign-out. */
export async function clearCachedData(): Promise<void> {
  queryClient.clear()
  await queryPersister.removeClient()
}
