// ─────────────────────────────────────────────────────────────────────────────
// Storage configuration
// ─────────────────────────────────────────────────────────────────────────────

export type StorageMode = 'managed' | 'developer'
export type DatabaseProvider = 'mongodb' | 'postgresql'

export interface StorageConfig {
  storageMode: StorageMode
  databaseProvider?: DatabaseProvider
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain records (wire format used between main and persistence layers)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string
  username: string
  deviceId: string
  storageMode: StorageMode
  databaseProvider?: DatabaseProvider
  createdAt: number
  updatedAt: number
}

export interface NoteRecord {
  id: string
  userId: string
  title: string
  content: string
  folderId: string | null
  tags: string[] // tag IDs stored at rest
  filePath: string | null
  fileFormat: string
  createdAt: number
  updatedAt: number
}

/** A note with tag IDs resolved to full TagRecord objects. */
export interface NoteWithTags extends Omit<NoteRecord, 'tags'> {
  tags: TagRecord[]
}

export interface FolderRecord {
  id: string
  userId: string
  name: string
  parentId: string | null
  createdAt: number
}

export interface TagRecord {
  id: string
  userId: string
  name: string
  color: string
}

export interface TaskRecord {
  id: string
  userId: string
  title: string
  done: number // 0 | 1
  dueDate: string | null
  noteId: string | null
  createdAt: number
  updatedAt: number
}

export interface JournalRecord {
  id: string
  userId: string
  date: string // YYYY-MM-DD
  content: string
  mood: string | null
  createdAt: number
}

export interface GraphData {
  nodes: Array<{
    id: string
    title: string
    folderId: string | null | undefined
    connectionCount: number
  }>
  edges: Array<{ source: string; target: string; type: string }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository interfaces — implemented by each database provider
// ─────────────────────────────────────────────────────────────────────────────

export interface IUserRepository {
  create(user: UserRecord): Promise<UserRecord>
  findById(id: string): Promise<UserRecord | null>
  findByUsername(username: string): Promise<UserRecord | null>
  update(id: string, data: Partial<UserRecord>): Promise<void>
  delete(id: string): Promise<void>
  /** Deletes all application data owned by a user (notes, folders, tags, etc.)
   *  but does NOT drop the underlying database/schema. */
  deleteAllData(userId: string): Promise<void>
}

export interface INoteRepository {
  findByUserId(userId: string, folderId?: string | null): Promise<NoteWithTags[]>
  findById(userId: string, id: string): Promise<NoteRecord | null>
  findByFilePath(userId: string, filePath: string): Promise<NoteRecord | null>
  upsert(userId: string, note: NoteRecord): Promise<void>
  updateContent(userId: string, id: string, content: string): Promise<void>
  updateTags(userId: string, id: string, tagIds: string[]): Promise<void>
  delete(userId: string, id: string): Promise<void>
  search(userId: string, query: string): Promise<NoteWithTags[]>
}

export interface IFolderRepository {
  findByUserId(userId: string): Promise<FolderRecord[]>
  upsert(userId: string, folder: FolderRecord): Promise<void>
  delete(userId: string, id: string): Promise<void>
}

export interface ITagRepository {
  findByUserId(userId: string): Promise<TagRecord[]>
  findByIds(ids: string[]): Promise<TagRecord[]>
  upsert(userId: string, tag: TagRecord): Promise<void>
  delete(userId: string, id: string): Promise<void>
}

export interface ITaskRepository {
  findByUserId(userId: string): Promise<TaskRecord[]>
  upsert(userId: string, task: TaskRecord): Promise<void>
  toggle(userId: string, id: string): Promise<TaskRecord | null>
  delete(userId: string, id: string): Promise<void>
}

export interface IJournalRepository {
  findByDate(userId: string, date: string): Promise<JournalRecord | null>
  upsert(userId: string, journal: JournalRecord): Promise<void>
}

export interface ISettingRepository {
  get(userId: string, key: string): Promise<string | null>
  getAll(userId: string): Promise<Record<string, string>>
  set(userId: string, key: string, value: string): Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level provider contract
// ─────────────────────────────────────────────────────────────────────────────

export interface IDatabaseProvider {
  /** Establish the database connection. */
  connect(): Promise<void>
  /** Gracefully close the database connection. */
  disconnect(): Promise<void>
  /** Verify reachability and basic write permissions. */
  testConnection(): Promise<{ ok: boolean; message: string }>
  /** Create / verify required Notoir database structures (collections, tables,
   *  indexes, constraints).  Must be idempotent. */
  initSchema(): Promise<void>

  // Repositories
  users: IUserRepository
  notes: INoteRepository
  folders: IFolderRepository
  tags: ITagRepository
  tasks: ITaskRepository
  journals: IJournalRepository
  settings: ISettingRepository

  /** Compute the knowledge-graph data for a user. */
  getGraphData(userId: string): Promise<GraphData>
}
