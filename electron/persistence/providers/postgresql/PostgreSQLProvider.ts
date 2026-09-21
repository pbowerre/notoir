import { Pool, PoolClient } from 'pg'
import type {
  IDatabaseProvider,
  IUserRepository,
  INoteRepository,
  IFolderRepository,
  ITagRepository,
  ITaskRepository,
  IJournalRepository,
  ISettingRepository,
  UserRecord,
  NoteRecord,
  NoteWithTags,
  FolderRecord,
  TagRecord,
  TaskRecord,
  JournalRecord,
  GraphData,
} from '../../types'

// All Notoir tables live inside the `notoir` schema so they are cleanly
// isolated from any other application sharing the same PostgreSQL database.
const SCHEMA = 'notoir'

// ─────────────────────────────────────────────────────────────────────────────
// Repository implementations
// ─────────────────────────────────────────────────────────────────────────────

class PgUserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  async create(user: UserRecord): Promise<UserRecord> {
    await this.pool.query(
      `INSERT INTO ${SCHEMA}.users
         (id, username, device_id, storage_mode, database_provider, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.username, user.deviceId, user.storageMode, user.databaseProvider ?? null, user.createdAt, user.updatedAt],
    )
    return user
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.users WHERE id = $1`, [id],
    )
    if (rows.length === 0) return null
    return this.map(rows[0])
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.users WHERE username = $1`, [username],
    )
    if (rows.length === 0) return null
    return this.map(rows[0])
  }

  async update(id: string, data: Partial<UserRecord>): Promise<void> {
    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    if (data.username !== undefined) { sets.push(`username = $${i++}`); vals.push(data.username) }
    if (data.storageMode !== undefined) { sets.push(`storage_mode = $${i++}`); vals.push(data.storageMode) }
    if (data.databaseProvider !== undefined) { sets.push(`database_provider = $${i++}`); vals.push(data.databaseProvider) }
    if (data.updatedAt !== undefined) { sets.push(`updated_at = $${i++}`); vals.push(data.updatedAt) }
    if (sets.length === 0) return
    vals.push(id)
    await this.pool.query(
      `UPDATE ${SCHEMA}.users SET ${sets.join(', ')} WHERE id = $${i}`, vals,
    )
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${SCHEMA}.users WHERE id = $1`, [id])
  }

  async deleteAllData(userId: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${SCHEMA}.notes    WHERE user_id = $1`, [userId])
    await this.pool.query(`DELETE FROM ${SCHEMA}.folders  WHERE user_id = $1`, [userId])
    await this.pool.query(`DELETE FROM ${SCHEMA}.tags     WHERE user_id = $1`, [userId])
    await this.pool.query(`DELETE FROM ${SCHEMA}.tasks    WHERE user_id = $1`, [userId])
    await this.pool.query(`DELETE FROM ${SCHEMA}.journals WHERE user_id = $1`, [userId])
    await this.pool.query(`DELETE FROM ${SCHEMA}.settings WHERE user_id = $1`, [userId])
    await this.pool.query(`DELETE FROM ${SCHEMA}.users    WHERE id      = $1`, [userId])
  }

  private map(row: any): UserRecord {
    return {
      id: row.id,
      username: row.username,
      deviceId: row.device_id,
      storageMode: row.storage_mode,
      databaseProvider: row.database_provider ?? undefined,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }
  }
}

class PgNoteRepository implements INoteRepository {
  constructor(private readonly pool: Pool) {}

  private async resolveTags(pool: Pool, tagIds: string[]): Promise<TagRecord[]> {
    if (tagIds.length === 0) return []
    const { rows } = await pool.query(
      `SELECT * FROM ${SCHEMA}.tags WHERE id = ANY($1::text[])`, [tagIds],
    )
    return rows.map(r => ({ id: r.id, userId: r.user_id, name: r.name, color: r.color }))
  }

  private map(row: any): NoteRecord {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      folderId: row.folder_id ?? null,
      tags: row.tags ?? [],
      filePath: row.file_path ?? null,
      fileFormat: row.file_format ?? '.md',
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }
  }

  async findByUserId(userId: string, folderId?: string | null): Promise<NoteWithTags[]> {
    let sql = `SELECT * FROM ${SCHEMA}.notes WHERE user_id = $1`
    const params: any[] = [userId]
    if (folderId === null) {
      sql += ' AND folder_id IS NULL'
    } else if (folderId !== undefined) {
      sql += ' AND folder_id = $2'
      params.push(folderId)
    }
    sql += ' ORDER BY updated_at DESC'
    const { rows } = await this.pool.query(sql, params)
    const notes = rows.map(r => this.map(r))
    return Promise.all(
      notes.map(async n => ({ ...n, tags: await this.resolveTags(this.pool, n.tags as unknown as string[]) })),
    )
  }

  async findById(userId: string, id: string): Promise<NoteRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.notes WHERE id = $1 AND user_id = $2`, [id, userId],
    )
    return rows.length > 0 ? this.map(rows[0]) : null
  }

  async findByFilePath(userId: string, filePath: string): Promise<NoteRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.notes WHERE user_id = $1 AND file_path = $2`, [userId, filePath],
    )
    return rows.length > 0 ? this.map(rows[0]) : null
  }

  async upsert(userId: string, note: NoteRecord): Promise<void> {
    const tagIds = (note.tags ?? []).map((t: any) => typeof t === 'string' ? t : t.id)
    await this.pool.query(
      `INSERT INTO ${SCHEMA}.notes
         (id, user_id, title, content, folder_id, tags, file_path, file_format, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         title       = EXCLUDED.title,
         content     = EXCLUDED.content,
         folder_id   = EXCLUDED.folder_id,
         tags        = EXCLUDED.tags,
         file_path   = EXCLUDED.file_path,
         file_format = EXCLUDED.file_format,
         updated_at  = EXCLUDED.updated_at`,
      [note.id, userId, note.title, note.content, note.folderId, tagIds,
       note.filePath, note.fileFormat ?? '.md', note.createdAt, note.updatedAt],
    )
  }

  async updateContent(userId: string, id: string, content: string): Promise<void> {
    await this.pool.query(
      `UPDATE ${SCHEMA}.notes SET content = $1, updated_at = $2 WHERE id = $3 AND user_id = $4`,
      [content, Date.now(), id, userId],
    )
  }

  async updateTags(userId: string, id: string, tagIds: string[]): Promise<void> {
    await this.pool.query(
      `UPDATE ${SCHEMA}.notes SET tags = $1 WHERE id = $2 AND user_id = $3`,
      [tagIds, id, userId],
    )
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${SCHEMA}.notes WHERE id = $1 AND user_id = $2`, [id, userId],
    )
  }

  async search(userId: string, query: string): Promise<NoteWithTags[]> {
    const pattern = `%${query}%`
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.notes
       WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
       ORDER BY updated_at DESC LIMIT 50`,
      [userId, pattern],
    )
    const notes = rows.map(r => this.map(r))
    return Promise.all(
      notes.map(async n => ({ ...n, tags: await this.resolveTags(this.pool, n.tags as unknown as string[]) })),
    )
  }
}

class PgFolderRepository implements IFolderRepository {
  constructor(private readonly pool: Pool) {}

  async findByUserId(userId: string): Promise<FolderRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.folders WHERE user_id = $1 ORDER BY name`, [userId],
    )
    return rows.map(r => ({
      id: r.id, userId: r.user_id, name: r.name,
      parentId: r.parent_id ?? null, createdAt: Number(r.created_at),
    }))
  }

  async upsert(userId: string, folder: FolderRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${SCHEMA}.folders (id, user_id, name, parent_id, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id`,
      [folder.id, userId, folder.name, folder.parentId, folder.createdAt],
    )
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${SCHEMA}.folders WHERE id = $1 AND user_id = $2`, [id, userId],
    )
  }
}

class PgTagRepository implements ITagRepository {
  constructor(private readonly pool: Pool) {}

  async findByUserId(userId: string): Promise<TagRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.tags WHERE user_id = $1 ORDER BY name`, [userId],
    )
    return rows.map(r => ({ id: r.id, userId: r.user_id, name: r.name, color: r.color }))
  }

  async findByIds(ids: string[]): Promise<TagRecord[]> {
    if (ids.length === 0) return []
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.tags WHERE id = ANY($1::text[])`, [ids],
    )
    return rows.map(r => ({ id: r.id, userId: r.user_id, name: r.name, color: r.color }))
  }

  async upsert(userId: string, tag: TagRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${SCHEMA}.tags (id, user_id, name, color)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color`,
      [tag.id, userId, tag.name, tag.color],
    )
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${SCHEMA}.tags WHERE id = $1 AND user_id = $2`, [id, userId],
    )
  }
}

class PgTaskRepository implements ITaskRepository {
  constructor(private readonly pool: Pool) {}

  async findByUserId(userId: string): Promise<TaskRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.tasks WHERE user_id = $1 ORDER BY done ASC, created_at DESC`,
      [userId],
    )
    return rows.map(r => ({
      id: r.id, userId: r.user_id, title: r.title, done: Number(r.done),
      dueDate: r.due_date ?? null, noteId: r.note_id ?? null,
      createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
    }))
  }

  async upsert(userId: string, task: TaskRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${SCHEMA}.tasks (id, user_id, title, done, due_date, note_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, done = EXCLUDED.done,
         due_date = EXCLUDED.due_date, note_id = EXCLUDED.note_id, updated_at = EXCLUDED.updated_at`,
      [task.id, userId, task.title, task.done, task.dueDate, task.noteId, task.createdAt, task.updatedAt],
    )
  }

  async toggle(userId: string, id: string): Promise<TaskRecord | null> {
    const { rows } = await this.pool.query(
      `UPDATE ${SCHEMA}.tasks
       SET done = CASE WHEN done = 0 THEN 1 ELSE 0 END, updated_at = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [Date.now(), id, userId],
    )
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id, userId: r.user_id, title: r.title, done: Number(r.done),
      dueDate: r.due_date ?? null, noteId: r.note_id ?? null,
      createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${SCHEMA}.tasks WHERE id = $1 AND user_id = $2`, [id, userId],
    )
  }
}

class PgJournalRepository implements IJournalRepository {
  constructor(private readonly pool: Pool) {}

  async findByDate(userId: string, date: string): Promise<JournalRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${SCHEMA}.journals WHERE user_id = $1 AND date = $2`, [userId, date],
    )
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id, userId: r.user_id, date: r.date, content: r.content,
      mood: r.mood ?? null, createdAt: Number(r.created_at),
    }
  }

  async upsert(userId: string, journal: JournalRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${SCHEMA}.journals (id, user_id, date, content, mood, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, date) DO UPDATE SET
         id = EXCLUDED.id, content = EXCLUDED.content, mood = EXCLUDED.mood`,
      [journal.id, userId, journal.date, journal.content, journal.mood, journal.createdAt],
    )
  }
}

class PgSettingRepository implements ISettingRepository {
  constructor(private readonly pool: Pool) {}

  async get(userId: string, key: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      `SELECT value FROM ${SCHEMA}.settings WHERE user_id = $1 AND key = $2`, [userId, key],
    )
    return rows.length > 0 ? rows[0].value : null
  }

  async getAll(userId: string): Promise<Record<string, string>> {
    const { rows } = await this.pool.query(
      `SELECT key, value FROM ${SCHEMA}.settings WHERE user_id = $1`, [userId],
    )
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  }

  async set(userId: string, key: string, value: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${SCHEMA}.settings (user_id, key, value) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [userId, key, value],
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export class PostgreSQLProvider implements IDatabaseProvider {
  private pool: Pool | null = null
  private readonly connectionString: string

  users!: IUserRepository
  notes!: INoteRepository
  folders!: IFolderRepository
  tags!: ITagRepository
  tasks!: ITaskRepository
  journals!: IJournalRepository
  settings!: ISettingRepository

  constructor(connectionString: string) {
    this.connectionString = connectionString
  }

  async connect(): Promise<void> {
    this.pool = new Pool({ connectionString: this.connectionString })
    // Verify we can obtain a client immediately
    const client: PoolClient = await this.pool.connect()
    client.release()

    this.users    = new PgUserRepository(this.pool)
    this.notes    = new PgNoteRepository(this.pool)
    this.folders  = new PgFolderRepository(this.pool)
    this.tags     = new PgTagRepository(this.pool)
    this.tasks    = new PgTaskRepository(this.pool)
    this.journals = new PgJournalRepository(this.pool)
    this.settings = new PgSettingRepository(this.pool)
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      if (!this.pool) throw new Error('Not connected')
      await this.pool.query('SELECT 1')
      return { ok: true, message: 'Connected to PostgreSQL successfully.' }
    } catch (err: any) {
      return { ok: false, message: err.message ?? 'PostgreSQL connection test failed.' }
    }
  }

  async initSchema(): Promise<void> {
    if (!this.pool) return
    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.users (
        id              TEXT PRIMARY KEY,
        username        TEXT NOT NULL,
        device_id       TEXT NOT NULL,
        storage_mode    TEXT NOT NULL DEFAULT 'developer',
        database_provider TEXT,
        created_at      BIGINT NOT NULL,
        updated_at      BIGINT NOT NULL
      )`)
    
    // Add device_id column if it doesn't exist (for existing tables)
    await this.pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = '${SCHEMA}' AND table_name = 'users' AND column_name = 'device_id'
        ) THEN
          ALTER TABLE ${SCHEMA}.users ADD COLUMN device_id TEXT NOT NULL DEFAULT '';
        END IF;
      END $$;
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.notes (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        title       TEXT DEFAULT '',
        content     TEXT DEFAULT '',
        folder_id   TEXT,
        tags        TEXT[] DEFAULT '{}',
        file_path   TEXT,
        file_format TEXT DEFAULT '.md',
        created_at  BIGINT NOT NULL,
        updated_at  BIGINT NOT NULL
      )`)
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS notes_user_id_idx ON ${SCHEMA}.notes(user_id)`)
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON ${SCHEMA}.notes(user_id, updated_at DESC)`)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.folders (
        id        TEXT PRIMARY KEY,
        user_id   TEXT NOT NULL,
        name      TEXT NOT NULL,
        parent_id TEXT,
        created_at BIGINT NOT NULL
      )`)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.tags (
        id      TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name    TEXT NOT NULL,
        color   TEXT NOT NULL DEFAULT '#6366f1',
        UNIQUE(user_id, name)
      )`)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.tasks (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        title      TEXT NOT NULL,
        done       INTEGER NOT NULL DEFAULT 0,
        due_date   TEXT,
        note_id    TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.journals (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        date       TEXT NOT NULL,
        content    TEXT DEFAULT '',
        mood       TEXT,
        created_at BIGINT NOT NULL,
        UNIQUE(user_id, date)
      )`)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA}.settings (
        user_id TEXT NOT NULL,
        key     TEXT NOT NULL,
        value   TEXT NOT NULL,
        PRIMARY KEY(user_id, key)
      )`)
  }

  async getGraphData(userId: string): Promise<GraphData> {
    if (!this.pool) return { nodes: [], edges: [] }

    const { rows: notes } = await this.pool.query(
      `SELECT id, title, folder_id, content, tags FROM ${SCHEMA}.notes WHERE user_id = $1`,
      [userId],
    )

    const tagEdges: GraphData['edges'] = []
    const tagToNotes = new Map<string, string[]>()

    for (const note of notes) {
      for (const tagId of note.tags ?? []) {
        const arr = tagToNotes.get(tagId) ?? []
        arr.push(note.id)
        tagToNotes.set(tagId, arr)
      }
    }

    for (const noteIds of tagToNotes.values()) {
      if (noteIds.length > 1) {
        for (let i = 0; i < noteIds.length; i++) {
          for (let j = i + 1; j < noteIds.length; j++) {
            tagEdges.push({ source: noteIds[i], target: noteIds[j], type: 'tag' })
          }
        }
      }
    }

    const wikiEdges: GraphData['edges'] = []
    const titleMap = new Map(notes.map((n: any) => [(n.title ?? '').toLowerCase(), n.id]))

    for (const note of notes) {
      if (!note.content) continue
      const matches = (note.content as string).matchAll(/\[\[([^\]]+)\]\]/g)
      for (const match of matches) {
        const targetId = titleMap.get(match[1].toLowerCase())
        if (targetId && targetId !== note.id) {
          wikiEdges.push({ source: note.id, target: targetId as string, type: 'wikilink' })
        }
      }
    }

    const allEdges = [...tagEdges, ...wikiEdges]
    const connectionCount = new Map<string, number>()
    for (const edge of allEdges) {
      connectionCount.set(edge.source, (connectionCount.get(edge.source) ?? 0) + 1)
      connectionCount.set(edge.target, (connectionCount.get(edge.target) ?? 0) + 1)
    }

    return {
      nodes: notes.map((n: any) => ({
        id: n.id,
        title: n.title,
        folderId: n.folder_id ?? null,
        connectionCount: connectionCount.get(n.id) ?? 0,
      })),
      edges: allEdges,
    }
  }
}
