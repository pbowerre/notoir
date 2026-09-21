import { useState, useEffect, useCallback, useRef } from 'react'
import type { Note, Folder, Tag, AppView, User } from './types'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { TasksPanel } from './components/TasksPanel'
import { JournalPanel } from './components/JournalPanel'
import { KnowledgeGraph } from './components/KnowledgeGraph'
import { SettingsPanel } from './components/SettingsPanel'
import { Onboarding } from './components/Onboarding'

function App() {
  const [activeUser, setActiveUser] = useState<User | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<AppView>('notes')
  const [activeFolderId, setActiveFolderId] = useState<string | null | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Note[]>([])
  const [isReady, setIsReady] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Initial load ─────────────────────────────────────────────
  const loadWorkspace = useCallback(async () => {
    if (!window.ipcRenderer) return
    try {
      const user = await window.ipcRenderer.invoke('get-active-user')
      setActiveUser(user)
      if (user) {
        const [loadedNotes, loadedFolders, loadedTags] = await Promise.all([
          window.ipcRenderer.invoke('get-notes'),
          window.ipcRenderer.invoke('get-folders'),
          window.ipcRenderer.invoke('get-tags'),
        ])
        setNotes(loadedNotes)
        setFolders(loadedFolders)
        setTags(loadedTags)
        if (loadedNotes.length > 0) setActiveNoteId(loadedNotes[0].id)
      }
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setIsReady(true)
    }
  }, [])

  useEffect(() => {
    loadWorkspace()

    let listener: any = null;

    // Listen for file associations
    if (window.ipcRenderer) {
      listener = async (_: any, filePath: string) => {
        const confirm = window.confirm(`Notoir opened a file: ${filePath}\n\nWould you like to import it into your workspace?`)
        if (confirm) {
          try {
            const result = await window.ipcRenderer.invoke('import-file', filePath)
            if (result.success) {
               await loadWorkspace() // reload everything to show the new note
               setActiveNoteId(result.note.id)
            } else {
               alert('Failed to import file.')
            }
          } catch (e) {
            console.error('Failed to auto-import file:', e)
            alert('Error occurred while importing file.')
          }
        }
      }
      window.ipcRenderer.on('open-external-file', listener)
    }
    
    return () => {
      if (window.ipcRenderer && listener) {
        window.ipcRenderer.off('open-external-file', listener)
      }
    }
  }, [loadWorkspace])

  // ── Reload notes helper ──────────────────────────────────────
  const reloadNotes = useCallback(async () => {
    if (!window.ipcRenderer) return
    const n = await window.ipcRenderer.invoke('get-notes')
    setNotes(n)
  }, [])

  const reloadTags = useCallback(async () => {
    if (!window.ipcRenderer) return
    const t = await window.ipcRenderer.invoke('get-tags')
    setTags(t)
  }, [])

  // ── Search ───────────────────────────────────────────────────
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!query.trim()) { setSearchResults([]); return }
    searchTimerRef.current = setTimeout(async () => {
      const results = await window.ipcRenderer.invoke('search-notes', query)
      setSearchResults(results)
    }, 300)
  }

  const displayedNotes = searchQuery ? searchResults : notes

  // ── Note CRUD ────────────────────────────────────────────────
  const handleCreateNote = async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'New Note',
      content: '',
      folderId: typeof activeFolderId === 'string' ? activeFolderId : null,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setNotes(prev => [newNote, ...prev])
    setActiveNoteId(newNote.id)
    setActiveView('notes')
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('save-note', newNote)
      await reloadNotes() // To pick up the generated filePath
    }
  }

  const handleUpdateNote = async (updatedNote: Note) => {
    const newNotes = notes.map(n => n.id === updatedNote.id ? updatedNote : n)
    newNotes.sort((a, b) => b.updatedAt - a.updatedAt)
    setNotes(newNotes)
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('save-note', updatedNote)
      // Re-fetch to get updated filePath if title changed
      await reloadNotes()
    }
  }

  const handleDeleteNote = async (id: string, filePath?: string) => {
    const newNotes = notes.filter(n => n.id !== id)
    setNotes(newNotes)
    if (activeNoteId === id) {
      setActiveNoteId(newNotes.length > 0 ? newNotes[0].id : null)
    }
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('delete-note', id, filePath)
    }
  }

  const handleSetNoteTags = async (noteId: string, tagIds: string[]) => {
    await window.ipcRenderer.invoke('set-note-tags', noteId, tagIds)
    const updatedTags = tags.filter(t => tagIds.includes(t.id))
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, tags: updatedTags } : n))
    reloadTags()
  }

  // ── Folder CRUD ──────────────────────────────────────────────
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name,
      parentId,
      createdAt: Date.now()
    }
    setFolders(prev => [...prev, folder])
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('save-folder', folder)
    }
  }

  const handleDeleteFolder = async (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id))
    if (activeFolderId === id) setActiveFolderId(undefined)
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('delete-folder', id)
      await reloadNotes()
    }
  }

  // ── Graph note select ────────────────────────────────────────
  const handleGraphSelectNote = (id: string) => {
    setActiveNoteId(id)
    setActiveView('notes')
  }

  if (!isReady) return null

  // Require Onboarding if no active user
  if (!activeUser) {
    return (
      <>
        <div className="titlebar-drag-region">
          <div className="titlebar-content" />
        </div>
        <Onboarding onComplete={loadWorkspace} />
      </>
    )
  }

  const activeNote = notes.find(n => n.id === activeNoteId)

  return (
    <>
      <div className="titlebar-drag-region">
        <div className="titlebar-content" />
      </div>

      <div className="app-container">
        <Sidebar
          notes={displayedNotes}
          folders={folders}
          tags={tags}
          activeNoteId={activeNoteId}
          activeView={activeView}
          activeFolderId={activeFolderId}
          onSelectNote={(id) => { setActiveNoteId(id); setActiveView('notes') }}
          onCreateNote={handleCreateNote}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onSetView={setActiveView}
          onSetFolder={setActiveFolderId}
          onSearch={handleSearch}
          searchQuery={searchQuery}
        />

        <main className="main-content">
          {activeView === 'notes' && (
            activeNote ? (
              <Editor
                note={activeNote}
                allTags={tags}
                folders={folders}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={(id) => handleDeleteNote(id, activeNote.filePath || undefined)}
                onSetNoteTags={handleSetNoteTags}
              />
            ) : (
              <EmptyState onCreateNote={handleCreateNote} />
            )
          )}

          {activeView === 'tasks' && <TasksPanel />}
          {activeView === 'journal' && <JournalPanel />}
          {activeView === 'graph' && (
            <KnowledgeGraph
              onSelectNote={handleGraphSelectNote}
              onSetView={() => setActiveView('notes')}
            />
          )}
          {activeView === 'settings' && <SettingsPanel onUserDeleted={() => {
            setActiveUser(null)
            setNotes([])
            setFolders([])
            setTags([])
          }} />}
        </main>
      </div>
    </>
  )
}

function EmptyState({ onCreateNote }: { onCreateNote: () => void }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px'
    }}>
      <div style={{ fontSize: '52px' }}>✦</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        Welcome to Notoir
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.6 }}>
        Create your first note, organise with folders and tags, track tasks, keep a daily journal, and explore your knowledge graph.
      </div>
      <button
        onClick={onCreateNote}
        style={{
          marginTop: '8px', padding: '10px 24px',
          backgroundColor: 'var(--accent-color)', color: '#fff',
          borderRadius: '8px', fontSize: '14px', fontWeight: 600,
          cursor: 'pointer', transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Create your first note
      </button>
    </div>
  )
}

export default App
