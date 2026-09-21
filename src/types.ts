export type StorageMode = 'managed' | 'developer'
export type DatabaseProvider = 'mongodb' | 'postgresql'

export interface StorageConfig {
  storageMode: StorageMode | null
  databaseProvider: DatabaseProvider | null
  connected: boolean
}

export interface User {
  id: string
  username: string
  storageMode: StorageMode
  databaseProvider?: DatabaseProvider
  createdAt: number
  updatedAt: number
}

export interface Note {
  id: string
  title: string
  content: string
  folderId?: string | null
  tags?: Tag[]
  filePath?: string | null
  fileFormat?: string
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: number
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Task {
  id: string
  title: string
  done: number // 0 | 1
  dueDate: string | null
  noteId: string | null
  createdAt: number
  updatedAt: number
}

export interface Journal {
  id: string
  date: string // YYYY-MM-DD
  content: string
  mood: string | null
  createdAt: number
}

export interface GraphNode {
  id: string
  title: string
  folderId?: string | null
  connectionCount: number
}

export interface GraphEdge {
  source: string
  target: string
  type: 'tag' | 'wikilink'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type AppView = 'notes' | 'tasks' | 'journal' | 'graph' | 'settings'
