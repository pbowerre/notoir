import mongoose from 'mongoose'
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

// ─────────────────────────────────────────────────────────────────────────────
// Schema definitions
// ─────────────────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  deviceId: { type: String, required: true },
  storageMode: { type: String, required: true, default: 'developer' },
  databaseProvider: { type: String, default: null },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
})

const NoteSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  folderId: { type: String, default: null },
  tags: [{ type: String }],
  filePath: { type: String, default: null },
  fileFormat: { type: String, default: '.md' },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
})
NoteSchema.index({ userId: 1, updatedAt: -1 })
NoteSchema.index({ userId: 1, folderId: 1 })

const FolderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  parentId: { type: String, default: null },
  createdAt: { type: Number, required: true },
})

const TagSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  color: { type: String, required: true, default: '#6366f1' },
})
TagSchema.index({ userId: 1, name: 1 }, { unique: true })

const TaskSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  done: { type: Number, required: true, default: 0 },
  dueDate: { type: String, default: null },
  noteId: { type: String, default: null },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
})
TaskSchema.index({ userId: 1, done: 1, createdAt: -1 })

const JournalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  content: { type: String, default: '' },
  mood: { type: String, default: null },
  createdAt: { type: Number, required: true },
})
JournalSchema.index({ userId: 1, date: 1 }, { unique: true })

const SettingSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
})
SettingSchema.index({ userId: 1, key: 1 }, { unique: true })

// ─────────────────────────────────────────────────────────────────────────────
// Repository implementations
// ─────────────────────────────────────────────────────────────────────────────

class MongoUserRepository implements IUserRepository {
  constructor(
    private readonly User: mongoose.Model<any>,
    private readonly conn: mongoose.Connection,
  ) {}

  async create(user: UserRecord): Promise<UserRecord> {
    const doc = new this.User(user)
    await doc.save()
    return user
  }

  async findById(id: string): Promise<UserRecord | null> {
    return await this.User.findOne({ id }).lean() as UserRecord | null
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    return await this.User.findOne({ username }).lean() as UserRecord | null
  }

  async update(id: string, data: Partial<UserRecord>): Promise<void> {
    await this.User.findOneAndUpdate({ id }, { $set: data })
  }

  async delete(id: string): Promise<void> {
    await this.User.deleteOne({ id })
  }

  async deleteAllData(userId: string): Promise<void> {
    await Promise.all([
      this.conn.model('Note').deleteMany({ userId }),
      this.conn.model('Folder').deleteMany({ userId }),
      this.conn.model('Tag').deleteMany({ userId }),
      this.conn.model('Task').deleteMany({ userId }),
      this.conn.model('Journal').deleteMany({ userId }),
      this.conn.model('Setting').deleteMany({ userId }),
      this.User.deleteOne({ id: userId }),
    ])
  }
}

class MongoNoteRepository implements INoteRepository {
  constructor(
    private readonly Note: mongoose.Model<any>,
    private readonly Tag: mongoose.Model<any>,
  ) {}

  private async attachTags(note: any): Promise<NoteWithTags> {
    const tagIds: string[] = note.tags ?? []
    const tags = tagIds.length > 0
      ? await this.Tag.find({ id: { $in: tagIds } }).lean() as TagRecord[]
      : []
    return { ...note, tags } as NoteWithTags
  }

  async findByUserId(userId: string, folderId?: string | null): Promise<NoteWithTags[]> {
    const query: any = { userId }
    if (folderId === null) query.folderId = null
    else if (folderId !== undefined) query.folderId = folderId
    const notes = await this.Note.find(query).sort({ updatedAt: -1 }).lean()
    return Promise.all(notes.map(n => this.attachTags(n)))
  }

  async findById(userId: string, id: string): Promise<NoteRecord | null> {
    return await this.Note.findOne({ id, userId }).lean() as NoteRecord | null
  }

  async findByFilePath(userId: string, filePath: string): Promise<NoteRecord | null> {
    return await this.Note.findOne({ userId, filePath }).lean() as NoteRecord | null
  }

  async upsert(userId: string, note: NoteRecord): Promise<void> {
    const tagIds = (note.tags ?? []).map((t: any) => typeof t === 'string' ? t : t.id)
    await this.Note.findOneAndUpdate(
      { id: note.id, userId },
      {
        $set: {
          title: note.title,
          content: note.content,
          folderId: note.folderId,
          tags: tagIds,
          filePath: note.filePath,
          fileFormat: note.fileFormat,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
      },
      { upsert: true, new: true },
    )
  }

  async updateContent(userId: string, id: string, content: string): Promise<void> {
    await this.Note.findOneAndUpdate(
      { id, userId },
      { $set: { content, updatedAt: Date.now() } },
    )
  }

  async updateTags(userId: string, id: string, tagIds: string[]): Promise<void> {
    await this.Note.findOneAndUpdate({ id, userId }, { $set: { tags: tagIds } })
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.Note.deleteOne({ id, userId })
  }

  async search(userId: string, query: string): Promise<NoteWithTags[]> {
    const notes = await this.Note.find({
      userId,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean()
    return Promise.all(notes.map(n => this.attachTags(n)))
  }
}

class MongoFolderRepository implements IFolderRepository {
  constructor(private readonly Folder: mongoose.Model<any>) {}

  async findByUserId(userId: string): Promise<FolderRecord[]> {
    return await this.Folder.find({ userId }).sort({ name: 1 }).lean() as FolderRecord[]
  }

  async upsert(userId: string, folder: FolderRecord): Promise<void> {
    await this.Folder.findOneAndUpdate(
      { id: folder.id, userId },
      { $set: { name: folder.name, parentId: folder.parentId, createdAt: folder.createdAt } },
      { upsert: true },
    )
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.Folder.deleteOne({ id, userId })
  }
}

class MongoTagRepository implements ITagRepository {
  constructor(private readonly Tag: mongoose.Model<any>) {}

  async findByUserId(userId: string): Promise<TagRecord[]> {
    return await this.Tag.find({ userId }).sort({ name: 1 }).lean() as TagRecord[]
  }

  async findByIds(ids: string[]): Promise<TagRecord[]> {
    if (ids.length === 0) return []
    return await this.Tag.find({ id: { $in: ids } }).lean() as TagRecord[]
  }

  async upsert(userId: string, tag: TagRecord): Promise<void> {
    await this.Tag.findOneAndUpdate(
      { id: tag.id, userId },
      { $set: { name: tag.name, color: tag.color } },
      { upsert: true },
    )
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.Tag.deleteOne({ id, userId })
  }
}

class MongoTaskRepository implements ITaskRepository {
  constructor(private readonly Task: mongoose.Model<any>) {}

  async findByUserId(userId: string): Promise<TaskRecord[]> {
    return await this.Task.find({ userId }).sort({ done: 1, createdAt: -1 }).lean() as TaskRecord[]
  }

  async upsert(userId: string, task: TaskRecord): Promise<void> {
    await this.Task.findOneAndUpdate(
      { id: task.id, userId },
      {
        $set: {
          title: task.title,
          done: task.done,
          dueDate: task.dueDate,
          noteId: task.noteId,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        },
      },
      { upsert: true },
    )
  }

  async toggle(userId: string, id: string): Promise<TaskRecord | null> {
    const task = await this.Task.findOne({ id, userId })
    if (!task) return null
    task.done = task.done === 0 ? 1 : 0
    task.updatedAt = Date.now()
    await task.save()
    return task.toObject() as TaskRecord
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.Task.deleteOne({ id, userId })
  }
}

class MongoJournalRepository implements IJournalRepository {
  constructor(private readonly Journal: mongoose.Model<any>) {}

  async findByDate(userId: string, date: string): Promise<JournalRecord | null> {
    return await this.Journal.findOne({ userId, date }).lean() as JournalRecord | null
  }

  async upsert(userId: string, journal: JournalRecord): Promise<void> {
    await this.Journal.findOneAndUpdate(
      { date: journal.date, userId },
      {
        $set: {
          id: journal.id,
          content: journal.content,
          mood: journal.mood,
          createdAt: journal.createdAt,
        },
      },
      { upsert: true },
    )
  }
}

class MongoSettingRepository implements ISettingRepository {
  constructor(private readonly Setting: mongoose.Model<any>) {}

  async get(userId: string, key: string): Promise<string | null> {
    const s = await this.Setting.findOne({ userId, key }).lean() as any
    return s ? s.value : null
  }

  async getAll(userId: string): Promise<Record<string, string>> {
    const settings = await this.Setting.find({ userId }).lean() as any[]
    return Object.fromEntries(settings.map(s => [s.key, s.value]))
  }

  async set(userId: string, key: string, value: string): Promise<void> {
    await this.Setting.findOneAndUpdate(
      { userId, key },
      { $set: { value } },
      { upsert: true },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export class MongoDBProvider implements IDatabaseProvider {
  private conn: mongoose.Connection | null = null
  private readonly connectionString: string

  // Repositories — set after connect()
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
    this.conn = mongoose.createConnection(this.connectionString)
    await this.conn.asPromise()

    // Register models on this specific connection (not the global singleton)
    const User = this.conn.model('User', UserSchema)
    const Note = this.conn.model('Note', NoteSchema)
    const Folder = this.conn.model('Folder', FolderSchema)
    const Tag = this.conn.model('Tag', TagSchema)
    const Task = this.conn.model('Task', TaskSchema)
    const Journal = this.conn.model('Journal', JournalSchema)
    const Setting = this.conn.model('Setting', SettingSchema)

    this.users = new MongoUserRepository(User, this.conn)
    this.notes = new MongoNoteRepository(Note, Tag)
    this.folders = new MongoFolderRepository(Folder)
    this.tags = new MongoTagRepository(Tag)
    this.tasks = new MongoTaskRepository(Task)
    this.journals = new MongoJournalRepository(Journal)
    this.settings = new MongoSettingRepository(Setting)
  }

  async disconnect(): Promise<void> {
    if (this.conn) {
      await this.conn.close()
      this.conn = null
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      if (!this.conn) throw new Error('Not connected')
      await this.conn.db?.command({ ping: 1 })
      return { ok: true, message: 'Connected to MongoDB successfully.' }
    } catch (err: any) {
      return { ok: false, message: err.message ?? 'MongoDB connection test failed.' }
    }
  }

  async initSchema(): Promise<void> {
    // Mongoose / MongoDB creates collections and indexes automatically on first use.
    // Explicitly syncing indexes ensures they exist without manual migrations.
    if (!this.conn) return
    await Promise.all(
      this.conn.modelNames().map(name => this.conn!.model(name).syncIndexes()),
    )
  }

  async getGraphData(userId: string): Promise<GraphData> {
    const Note = this.conn!.model('Note')
    const notes = await Note.find({ userId }, { id: 1, title: 1, folderId: 1, content: 1, tags: 1 }).lean() as any[]

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
    const titleMap = new Map(notes.map(n => [(n.title ?? '').toLowerCase(), n.id]))

    for (const note of notes) {
      if (!note.content) continue
      const matches = (note.content as string).matchAll(/\[\[([^\]]+)\]\]/g)
      for (const match of matches) {
        const targetId = titleMap.get(match[1].toLowerCase())
        if (targetId && targetId !== note.id) {
          wikiEdges.push({ source: note.id, target: targetId, type: 'wikilink' })
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
      nodes: notes.map(n => ({
        id: n.id,
        title: n.title,
        folderId: n.folderId,
        connectionCount: connectionCount.get(n.id) ?? 0,
      })),
      edges: allEdges,
    }
  }
}
