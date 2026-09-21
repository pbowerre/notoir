import Store from 'electron-store'
import type { StorageMode, DatabaseProvider } from './persistence/types'

interface AppConfig {
  activeUserId: string | null
  onboardingCompleted: boolean
  storageMode: StorageMode | null
  databaseProvider: DatabaseProvider | null
  /** Base64-encoded encrypted connection string (via safeStorage). */
  encryptedCredential: string | null
  deviceId: string
}

import { randomUUID } from 'crypto'

export const store = new Store<AppConfig>({
  defaults: {
    activeUserId: null,
    onboardingCompleted: false,
    storageMode: null,
    databaseProvider: null,
    encryptedCredential: null,
    deviceId: randomUUID(),
  },
})

export function getDeviceId(): string {
  return store.get('deviceId')
}

export function getActiveUserId(): string | null {
  return store.get('activeUserId')
}

export function setActiveUserId(userId: string | null) {
  store.set('activeUserId', userId)
  if (userId) {
    store.set('onboardingCompleted', true)
  }
}
