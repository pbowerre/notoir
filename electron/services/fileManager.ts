import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { watch, FSWatcher } from 'chokidar'
import { databaseManager } from '../persistence/DatabaseManager'
import { v4 as uuidv4 } from 'uuid'
import type { NoteRecord } from '../persistence/types'

let watcher: FSWatcher | null = null

export function getUserDirectory(username: string): string {
  const documents = app.getPath('documents')
  return path.join(documents, 'Notoir', username)
}

export async function ensureUserDirectories(username: string): Promise<string> {
  const baseDir = getUserDirectory(username)
  await fs.mkdir(path.join(baseDir, 'Notes'), { recursive: true })
  await fs.mkdir(path.join(baseDir, 'Journals'), { recursive: true })
  await fs.mkdir(path.join(baseDir, 'Exports'), { recursive: true })
  return baseDir
}

export async function setupFileWatcher(userId: string, username: string): Promise<void> {
  if (watcher) {
    await watcher.close()
  }

  const baseDir = await ensureUserDirectories(username)
  const notesDir = path.join(baseDir, 'Notes')

  watcher = watch(notesDir, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  })

  watcher.on('change', async (filePath) => {
    if (!filePath.endsWith('.md') && !filePath.endsWith('.txt')) return
    if (!databaseManager.isConnected()) return

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const notes = databaseManager.getProvider().notes

      const note = await notes.findByFilePath(userId, filePath)

      if (note) {
        if (note.content !== content) {
          console.log(`[FileWatcher] External change detected: ${note.title}`)
          await notes.updateContent(userId, note.id, content)
        }
      } else {
        // A new file was dropped directly into the Notes directory
        console.log(`[FileWatcher] New unmanaged file: ${filePath}`)
        const now = Date.now()
        const newNote: NoteRecord = {
          id: uuidv4(),
          userId,
          title: path.basename(filePath, path.extname(filePath)),
          content,
          folderId: null,
          tags: [],
          filePath,
          fileFormat: path.extname(filePath),
          createdAt: now,
          updatedAt: now,
        }
        await notes.upsert(userId, newNote)
      }
    } catch (err: any) {
      console.error('[FileWatcher] Error processing file change:', err.message)
    }
  })
}

export async function syncNoteToFile(
  _userId: string,
  username: string,
  note: NoteRecord | any,
): Promise<string | null> {
  try {
    const baseDir = await ensureUserDirectories(username)
    const notesDir = path.join(baseDir, 'Notes')

    const safeTitle = (note.title || 'Untitled Note').replace(/[/\\?%*:|"<>]/g, '-')
    const format = note.fileFormat || '.md'

    let filePath = note.filePath as string | null
    if (!filePath) {
      filePath = path.join(notesDir, `${safeTitle}${format}`)
      let counter = 1
      while (true) {
        try {
          await fs.access(filePath)
          filePath = path.join(notesDir, `${safeTitle} (${counter})${format}`)
          counter++
        } catch {
          break
        }
      }
    } else {
      const currentDir = path.dirname(filePath)
      const expectedName = `${safeTitle}${format}`
      if (currentDir === notesDir && path.basename(filePath) !== expectedName) {
        const newPath = path.join(notesDir, expectedName)
        try {
          await fs.rename(filePath, newPath)
          filePath = newPath
        } catch (err: any) {
          console.warn('[FileManager] Failed to rename note file:', err.message)
        }
      }
    }

    await fs.writeFile(filePath, note.content || '', 'utf-8')
    return filePath
  } catch (err: any) {
    console.error('[FileManager] Failed to sync note to file:', err.message)
    return note.filePath ?? null
  }
}

export async function deleteNoteFile(filePath: string | null): Promise<void> {
  if (!filePath) return
  try {
    await fs.unlink(filePath)
  } catch (err: any) {
    console.error('[FileManager] Failed to delete note file:', err.message)
  }
}

export async function deleteUserDirectory(username: string): Promise<void> {
  try {
    const dir = getUserDirectory(username)
    await fs.rm(dir, { recursive: true, force: true })
    if (watcher) await watcher.close()
  } catch (err: any) {
    console.error('[FileManager] Failed to delete user directory:', err.message)
  }
}
