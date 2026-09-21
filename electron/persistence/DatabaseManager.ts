import { safeStorage } from 'electron'
import { store } from '../store'
import type { IDatabaseProvider, DatabaseProvider, StorageMode } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Credential helpers
// ─────────────────────────────────────────────────────────────────────────────

const CREDENTIAL_STORE_KEY = 'encryptedCredential'

function storeCredential(raw: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    // safeStorage unavailable on this platform — store obfuscated (base64 only).
    // This is a degraded fallback; in production environments safeStorage is
    // expected to be available (Windows DPAPI, macOS Keychain, Linux libsecret).
    console.warn('[DatabaseManager] safeStorage unavailable; falling back to base64 obfuscation.')
    store.set(CREDENTIAL_STORE_KEY, Buffer.from(raw).toString('base64'))
    return
  }
  const encrypted = safeStorage.encryptString(raw)
  store.set(CREDENTIAL_STORE_KEY, encrypted.toString('base64'))
}

function retrieveCredential(): string | null {
  const stored = store.get(CREDENTIAL_STORE_KEY) as string | undefined
  if (!stored) return null
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(stored, 'base64'))
    }
    // Degraded base64 fallback
    return Buffer.from(stored, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

function clearCredential(): void {
  store.delete(CREDENTIAL_STORE_KEY as any)
}

// ─────────────────────────────────────────────────────────────────────────────
// DatabaseManager singleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DatabaseManager is the single point of truth for which database provider
 * is currently active.  All application services obtain their provider
 * reference exclusively through `databaseManager.getProvider()`.
 *
 * Responsibilities:
 *  - Bootstrap the correct provider at startup based on persisted config.
 *  - Encrypt and store developer credentials via Electron's safeStorage API.
 *  - Expose `testAndConfigure()` for the onboarding flow.
 *  - Expose `disconnect()` and `switchProvider()` for the settings UI.
 */
class DatabaseManager {
  private activeProvider: IDatabaseProvider | null = null
  private ready = false

  // ── Startup ──────────────────────────────────────────────────────────────

  /**
   * Called once during application startup (`app.whenReady`).
   * Restores the previously saved storage configuration and connects.
   */
  async bootstrap(): Promise<void> {
    const storageMode = store.get('storageMode') as StorageMode | null
    if (!storageMode) {
      // First launch — onboarding has not been completed yet.
      this.ready = true
      return
    }

    try {
      if (storageMode === 'managed') {
        const { ManagedProvider } = await import('./providers/managed/ManagedProvider')
        this.activeProvider = new ManagedProvider()
      } else {
        const dbProvider = store.get('databaseProvider') as DatabaseProvider | null
        const connectionString = retrieveCredential()

        if (!dbProvider || !connectionString) {
          console.error('[DatabaseManager] Developer storage configured but credentials are missing.')
          this.ready = true
          return
        }

        this.activeProvider = await this.buildProvider(dbProvider, connectionString)
      }

      await this.activeProvider.connect()
      await this.activeProvider.initSchema()
      console.log('[DatabaseManager] Provider ready:', store.get('storageMode'))
    } catch (err: any) {
      console.error('[DatabaseManager] Bootstrap failed:', err.message)
      this.activeProvider = null
    } finally {
      this.ready = true
    }
  }

  // ── Provider access ───────────────────────────────────────────────────────

  isReady(): boolean {
    return this.ready
  }

  isConnected(): boolean {
    return this.activeProvider !== null
  }

  getProvider(): IDatabaseProvider {
    if (!this.activeProvider) {
      throw new Error('No active database provider. Please complete onboarding.')
    }
    return this.activeProvider
  }

  getStorageMode(): StorageMode | null {
    return (store.get('storageMode') as StorageMode | null) ?? null
  }

  getDatabaseProvider(): DatabaseProvider | null {
    return (store.get('databaseProvider') as DatabaseProvider | null) ?? null
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  /**
   * For the onboarding flow:
   *  1. Tests the connection before accepting it.
   *  2. On success, persists the configuration and activates the new provider.
   *  3. Initialises the Notoir database schema (idempotent).
   */
  async testAndConfigure(
    storageMode: StorageMode,
    databaseProvider?: DatabaseProvider,
    connectionString?: string,
  ): Promise<{ ok: boolean; message: string }> {
    // ── Managed ──────────────────────────────────────────────────────────
    if (storageMode === 'managed') {
      const { ManagedProvider } = await import('./providers/managed/ManagedProvider')
      const candidate = new ManagedProvider()
      try {
        await candidate.connect()
        const result = await candidate.testConnection()
        if (!result.ok) {
          await candidate.disconnect()
          return result
        }
        await this.activateProvider(candidate)
        store.set('storageMode', 'managed')
        store.delete('databaseProvider' as any)
        clearCredential()
        return result
      } catch (err: any) {
        await candidate.disconnect().catch(() => {})
        return { ok: false, message: err.message ?? 'Failed to connect to Notoir managed storage.' }
      }
    }

    // ── Developer ─────────────────────────────────────────────────────────
    if (!databaseProvider || !connectionString) {
      return { ok: false, message: 'Database provider and connection string are required.' }
    }

    try {
      const candidate = await this.buildProvider(databaseProvider, connectionString)
      await candidate.connect()
      const result = await candidate.testConnection()

      if (!result.ok) {
        await candidate.disconnect()
        return result
      }

      await candidate.initSchema()
      await this.activateProvider(candidate)

      // Persist (connection string encrypted via safeStorage)
      store.set('storageMode', 'developer')
      store.set('databaseProvider', databaseProvider)
      storeCredential(connectionString)

      return result
    } catch (err: any) {
      return { ok: false, message: err.message ?? 'Connection test failed.' }
    }
  }

  /**
   * Re-runs a connection test against an arbitrary connection string without
   * persisting any configuration.  Used by the settings "Test Connection" button.
   */
  async testConnectionOnly(
    databaseProvider: DatabaseProvider,
    connectionString: string,
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const candidate = await this.buildProvider(databaseProvider, connectionString)
      await candidate.connect()
      const result = await candidate.testConnection()
      await candidate.disconnect()
      return result
    } catch (err: any) {
      return { ok: false, message: err.message ?? 'Connection test failed.' }
    }
  }

  /**
   * Tests and switches to a new developer database.
   * The existing provider is disconnected only after the new one succeeds.
   */
  async changeDatabase(
    databaseProvider: DatabaseProvider,
    connectionString: string,
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const candidate = await this.buildProvider(databaseProvider, connectionString)
      await candidate.connect()
      const result = await candidate.testConnection()

      if (!result.ok) {
        await candidate.disconnect()
        return result
      }

      await candidate.initSchema()

      // Swap providers
      await this.activateProvider(candidate)
      store.set('storageMode', 'developer')
      store.set('databaseProvider', databaseProvider)
      storeCredential(connectionString)

      return result
    } catch (err: any) {
      return { ok: false, message: err.message ?? 'Failed to switch database.' }
    }
  }

  /**
   * Disconnects the current developer database.
   * The remote database and its data are NOT modified in any way.
   * Call this only after explicit user confirmation in the UI.
   */
  async disconnect(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.disconnect().catch(err => {
        console.warn('[DatabaseManager] Error during disconnect:', err.message)
      })
      this.activeProvider = null
    }
    store.delete('storageMode' as any)
    store.delete('databaseProvider' as any)
    clearCredential()
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async buildProvider(
    databaseProvider: DatabaseProvider,
    connectionString: string,
  ): Promise<IDatabaseProvider> {
    if (databaseProvider === 'postgresql') {
      const { PostgreSQLProvider } = await import('./providers/postgresql/PostgreSQLProvider')
      return new PostgreSQLProvider(connectionString)
    }
    const { MongoDBProvider } = await import('./providers/mongodb/MongoDBProvider')
    return new MongoDBProvider(connectionString)
  }

  private async activateProvider(newProvider: IDatabaseProvider): Promise<void> {
    if (this.activeProvider && this.activeProvider !== newProvider) {
      await this.activeProvider.disconnect().catch(() => {})
    }
    this.activeProvider = newProvider
  }
}

export const databaseManager = new DatabaseManager()
