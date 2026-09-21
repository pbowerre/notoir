import { ipcMain, dialog, shell } from 'electron'
import { getActiveUserId, setActiveUserId } from '../store'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { databaseManager } from '../persistence/DatabaseManager'
import type { DatabaseProvider, StorageMode, UserRecord, NoteRecord } from '../persistence/types'
import { generateAI } from './aiService'
import { setupFileWatcher, syncNoteToFile, deleteNoteFile, deleteUserDirectory } from './fileManager'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

export async function setupIpcHandlers() {
  // Bootstrap the active database provider (no-op on first launch)
  await databaseManager.bootstrap()

  // Restore the file-watcher for the previously active user (if any)
  const initialUserId = getActiveUserId()
  if (initialUserId && databaseManager.isConnected()) {
    try {
      const user = await databaseManager.getProvider().users.findById(initialUserId)
      if (user) await setupFileWatcher(initialUserId, user.username)
    } catch (err: any) {
      console.error('[IPC] Failed to restore file watcher:', err.message)
    }
  }

  // ── Storage configuration ─────────────────────────────────────────────────

  /**
   * Returns the current storage configuration visible to the renderer.
   * The raw connection string is never returned.
   */
  ipcMain.handle('storage:get-config', async () => {
    const storageMode = databaseManager.getStorageMode()
    const databaseProvider = databaseManager.getDatabaseProvider()
    const connected = databaseManager.isConnected()
    return { storageMode, databaseProvider, connected }
  })

  /**
   * Tests a developer connection string without persisting anything.
   * Used by the settings "Test Connection" button.
   */
  ipcMain.handle(
    'storage:test-connection',
    async (_, provider: DatabaseProvider, connectionString: string) => {
      return databaseManager.testConnectionOnly(provider, connectionString)
    },
  )

  /**
   * Configures storage for first-time onboarding.
   * For developer mode: tests the connection before accepting it.
   * Activates the provider and persists the configuration on success.
   */
  ipcMain.handle(
    'storage:configure',
    async (
      _,
      storageMode: StorageMode,
      databaseProvider?: DatabaseProvider,
      connectionString?: string,
    ) => {
      return databaseManager.testAndConfigure(storageMode, databaseProvider, connectionString)
    },
  )

  /**
   * Switches the active developer database.
   * The previous database is disconnected only after the new connection succeeds.
   * The remote database and its data are never modified.
   */
  ipcMain.handle(
    'storage:change-database',
    async (_, provider: DatabaseProvider, connectionString: string) => {
      return databaseManager.changeDatabase(provider, connectionString)
    },
  )

  /**
   * Disconnects the current developer database.
   * Does NOT drop, truncate, or modify the remote database in any way.
   */
  ipcMain.handle('storage:disconnect', async () => {
    await databaseManager.disconnect()
    setActiveUserId(null)
    return { success: true }
  })

  // ── User identity ─────────────────────────────────────────────────────────

  ipcMain.handle('get-active-user', async () => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return null
    return databaseManager.getProvider().users.findById(userId)
  })

  ipcMain.handle(
    'create-user',
    async (_, username: string, storageMode: StorageMode, databaseProvider?: DatabaseProvider) => {
      if (!databaseManager.isConnected()) return null

      const provider = databaseManager.getProvider()
      const { getDeviceId } = await import('../store')
      const localDeviceId = getDeviceId()
      
      // Check if user already exists
      const existingUser = await provider.users.findByUsername(username)
      if (existingUser) {
        // Device handshake check
        if (existingUser.deviceId && existingUser.deviceId !== localDeviceId) {
          throw new Error('Username already taken. This nickname is registered on another device.')
        }

        // Update user's storage mode if it changed (e.g. they connected a different way)
        if (existingUser.storageMode !== storageMode || existingUser.databaseProvider !== databaseProvider) {
          await provider.users.update(existingUser.id, { storageMode, databaseProvider })
          existingUser.storageMode = storageMode
          existingUser.databaseProvider = databaseProvider
        }
        setActiveUserId(existingUser.id)
        await setupFileWatcher(existingUser.id, username)
        return existingUser
      }

      const id = uuidv4()
      const now = Date.now()
      const userRecord: UserRecord = {
        id,
        username,
        deviceId: localDeviceId,
        storageMode,
        databaseProvider,
        createdAt: now,
        updatedAt: now,
      }
      const user = await provider.users.create(userRecord)
      setActiveUserId(id)
      await setupFileWatcher(id, username)
      return user
    },
  )

  ipcMain.handle('delete-user', async () => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }

    const user = await databaseManager.getProvider().users.findById(userId)

    // Remove all application data from the provider
    await databaseManager.getProvider().users.deleteAllData(userId)

    // Remove local filesystem directory
    if (user) {
      await deleteUserDirectory(user.username)
    }

    // Clear local state
    setActiveUserId(null)

    return { success: true }
  })

  // ── Notes ─────────────────────────────────────────────────────────────────

  ipcMain.handle('get-notes', async (_, folderId?: string | null) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return []
    return databaseManager.getProvider().notes.findByUserId(userId, folderId)
  })

  ipcMain.handle('save-note', async (_, note: NoteRecord) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }

    const user = await databaseManager.getProvider().users.findById(userId)
    const newFilePath = await syncNoteToFile(userId, user?.username ?? 'Unknown', note)
    note.filePath = newFilePath

    await databaseManager.getProvider().notes.upsert(userId, note)
    return { success: true }
  })

  ipcMain.handle('delete-note', async (_, noteId: string, filePath?: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }

    if (!filePath) {
      const note = await databaseManager.getProvider().notes.findById(userId, noteId)
      filePath = note?.filePath ?? undefined
    }

    await databaseManager.getProvider().notes.delete(userId, noteId)

    if (filePath) await deleteNoteFile(filePath)
    return { success: true }
  })

  ipcMain.handle('search-notes', async (_, query: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return []
    return databaseManager.getProvider().notes.search(userId, query)
  })

  // ── Folders ───────────────────────────────────────────────────────────────

  ipcMain.handle('get-folders', async () => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return []
    return databaseManager.getProvider().folders.findByUserId(userId)
  })

  ipcMain.handle('save-folder', async (_, folder: any) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().folders.upsert(userId, folder)
    return { success: true }
  })

  ipcMain.handle('delete-folder', async (_, id: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().folders.delete(userId, id)
    return { success: true }
  })

  // ── Tags ──────────────────────────────────────────────────────────────────

  ipcMain.handle('get-tags', async () => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return []
    return databaseManager.getProvider().tags.findByUserId(userId)
  })

  ipcMain.handle('save-tag', async (_, tag: any) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().tags.upsert(userId, tag)
    return { success: true }
  })

  ipcMain.handle('delete-tag', async (_, id: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().tags.delete(userId, id)
    return { success: true }
  })

  ipcMain.handle('set-note-tags', async (_, noteId: string, tagIds: string[]) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().notes.updateTags(userId, noteId, tagIds)
    return { success: true }
  })

  // ── Tasks ─────────────────────────────────────────────────────────────────

  ipcMain.handle('get-tasks', async () => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return []
    return databaseManager.getProvider().tasks.findByUserId(userId)
  })

  ipcMain.handle('save-task', async (_, task: any) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().tasks.upsert(userId, task)
    return { success: true }
  })

  ipcMain.handle('delete-task', async (_, id: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().tasks.delete(userId, id)
    return { success: true }
  })

  ipcMain.handle('toggle-task', async (_, id: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return null
    return databaseManager.getProvider().tasks.toggle(userId, id)
  })

  // ── Journals ──────────────────────────────────────────────────────────────

  ipcMain.handle('get-journal', async (_, date: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return null
    return databaseManager.getProvider().journals.findByDate(userId, date)
  })

  ipcMain.handle('save-journal', async (_, journal: any) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().journals.upsert(userId, journal)
    return { success: true }
  })

  // ── Settings ──────────────────────────────────────────────────────────────

  ipcMain.handle('get-settings', async () => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return {}
    return databaseManager.getProvider().settings.getAll(userId)
  })

  ipcMain.handle('save-setting', async (_, key: string, value: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }
    await databaseManager.getProvider().settings.set(userId, key, value)
    return { success: true }
  })

  // ── AI ────────────────────────────────────────────────────────────────────

  ipcMain.handle('ai-generate', async (_, prompt: string, action: string) => {
    return generateAI(prompt, action)
  })

  // ── Knowledge graph ───────────────────────────────────────────────────────

  ipcMain.handle('get-graph-data', async () => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { nodes: [], edges: [] }
    return databaseManager.getProvider().getGraphData(userId)
  })

  // ── Native file operations ────────────────────────────────────────────────

  ipcMain.handle(
    'export-note',
    async (_, noteTitle: string, noteContent: string, format: string) => {
      const safeTitle = (noteTitle || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-')
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export Note',
        defaultPath: `${safeTitle}${format}`,
        filters: [{ name: 'Text Documents', extensions: ['md', 'txt'] }],
      })
      if (!canceled && filePath) {
        await fs.writeFile(filePath, noteContent, 'utf-8')
        return { success: true, filePath }
      }
      return { success: false }
    },
  )

  ipcMain.handle('import-file', async (_, providedPath?: string) => {
    const userId = getActiveUserId()
    if (!userId || !databaseManager.isConnected()) return { success: false }

    const user = await databaseManager.getProvider().users.findById(userId)
    if (!user) return { success: false }

    let filePaths: string[] = []
    
    if (providedPath) {
      filePaths = [providedPath]
    } else {
      const { canceled, filePaths: selectedPaths } = await dialog.showOpenDialog({
        title: 'Import Note',
        properties: ['openFile'],
        filters: [{ name: 'Text Documents', extensions: ['md', 'txt'] }],
      })
      if (canceled) return { success: false }
      filePaths = selectedPaths
    }

    if (filePaths.length > 0) {
      const filePath = filePaths[0]
      const content = await fs.readFile(filePath, 'utf-8')
      const title = path.basename(filePath, path.extname(filePath))
      const now = Date.now()

      const newNote: NoteRecord = {
        id: uuidv4(),
        userId,
        title,
        content,
        folderId: null,
        tags: [],
        filePath: null,
        fileFormat: path.extname(filePath),
        createdAt: now,
        updatedAt: now,
      }

      const newFilePath = await syncNoteToFile(userId, user.username, newNote)
      const noteToSave = { ...newNote, filePath: newFilePath }
      await databaseManager.getProvider().notes.upsert(userId, noteToSave)

      return { success: true, note: noteToSave }
    }
    return { success: false }
  })

  ipcMain.handle('open-external', async (_, filePath: string) => {
    if (filePath) await shell.openPath(filePath)
  })
}
