import { useState } from 'react'
import { 
  FileText, 
  CheckSquare, 
  Calendar, 
  Network, 
  Settings, 
  Folder as FolderIcon,
  FolderOpen,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  X,
  Check
} from 'lucide-react'
import type { Note, Folder, Tag, AppView } from '../types'
import { TagBadge } from './TagBadge'
import notoirLogo from '../assets/notoir.png'

interface SidebarProps {
  notes: Note[]
  folders: Folder[]
  tags: Tag[]
  activeNoteId: string | null
  activeView: AppView
  activeFolderId: string | null | undefined
  onSelectNote: (id: string) => void
  onCreateNote: () => void
  onCreateFolder: (name: string, parentId: string | null) => void
  onDeleteFolder: (id: string) => void
  onSetView: (view: AppView) => void
  onSetFolder: (id: string | null | undefined) => void
  onSearch: (query: string) => void
  searchQuery: string
}

export function Sidebar({
  notes, folders, tags,
  activeNoteId, activeView, activeFolderId,
  onSelectNote, onCreateNote, onCreateFolder, onDeleteFolder,
  onSetView, onSetFolder, onSearch, searchQuery
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null) // parentId or 'root'
  const [newFolderName, setNewFolderName] = useState('')

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleCreateFolder = (parentId: string | null) => {
    if (!newFolderName.trim()) { setCreatingFolder(null); return }
    onCreateFolder(newFolderName.trim(), parentId)
    setNewFolderName('')
    setCreatingFolder(null)
  }

  const navItem = (view: AppView, icon: React.ReactNode, label: string) => (
    <button
      key={view}
      onClick={() => onSetView(view)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '100%', padding: '8px 12px', borderRadius: '8px',
        fontSize: '13px', fontWeight: 500, textAlign: 'left',
        color: activeView === view ? 'var(--text-primary)' : 'var(--text-secondary)',
        backgroundColor: activeView === view ? 'var(--bg-tertiary)' : 'transparent',
        cursor: 'pointer', transition: 'all 0.2s ease',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: activeView === view ? 'var(--accent-color)' : 'currentColor' }}>{icon}</span>
      {label}
    </button>
  )

  const rootFolders = folders.filter(f => !f.parentId)
  const notesInView = activeFolderId === undefined
    ? notes
    : activeFolderId === null
      ? notes.filter(n => !n.folderId)
      : notes.filter(n => n.folderId === activeFolderId)

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={notoirLogo} alt="Notoir" style={{ width: '24px', height: '24px', borderRadius: '6px', objectFit: 'contain' }} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Notoir
          </span>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', pointerEvents: 'none' }}><Search size={14} /></span>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          style={{
            width: '100%', padding: '6px 8px 6px 28px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px', fontSize: '12px',
            color: 'var(--text-primary)', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '12px' }}>
        {navItem('notes', <FileText size={16} />, 'All Notes')}
        {navItem('tasks', <CheckSquare size={16} />, 'Tasks')}
        {navItem('journal', <Calendar size={16} />, 'Daily Journal')}
        {navItem('graph', <Network size={16} />, 'Knowledge Graph')}
        {navItem('settings', <Settings size={16} />, 'Settings')}
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border-color)', marginBottom: '12px' }} />

      {/* Notes list (only in notes view) */}
      {activeView === 'notes' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Folders */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Folders
              </span>
              <button
                onClick={() => { setCreatingFolder('root'); setNewFolderName('') }}
                title="New Folder"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              ><Plus size={14} /></button>
            </div>

            {/* All Notes item */}
            <button
              onClick={() => { onSetFolder(undefined); onSetView('notes') }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '5px 8px', borderRadius: '5px',
                fontSize: '12px', textAlign: 'left',
                color: activeFolderId === undefined && activeView === 'notes' ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: activeFolderId === undefined && activeView === 'notes' ? 'var(--bg-tertiary)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}><FileText size={14} /></span> All Notes
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{notes.length}</span>
            </button>

            {/* Uncategorized */}
            <button
              onClick={() => { onSetFolder(null); onSetView('notes') }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '5px 8px', borderRadius: '5px',
                fontSize: '12px', textAlign: 'left',
                color: activeFolderId === null && activeView === 'notes' ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: activeFolderId === null && activeView === 'notes' ? 'var(--bg-tertiary)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}><FolderIcon size={14} /></span> Uncategorized
            </button>

            {/* Folder tree */}
            {rootFolders.map(folder => (
              <FolderItem
                key={folder.id}
                folder={folder}
                folders={folders}
                notes={notes}
                activeFolderId={activeFolderId}
                expanded={expandedFolders.has(folder.id)}
                onToggle={() => toggleFolder(folder.id)}
                onSelectFolder={(id) => { onSetFolder(id); onSetView('notes') }}
                onDeleteFolder={onDeleteFolder}
                onCreateSubfolder={(parentId) => { setCreatingFolder(parentId); setNewFolderName('') }}
              />
            ))}

            {/* New folder input */}
            {creatingFolder !== null && (
              <div style={{ display: 'flex', gap: '4px', padding: '4px 8px' }}>
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateFolder(creatingFolder === 'root' ? null : creatingFolder)
                    if (e.key === 'Escape') setCreatingFolder(null)
                  }}
                  placeholder="Folder name..."
                  style={{
                    flex: 1, fontSize: '12px', padding: '3px 6px',
                    backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--accent-color)',
                    borderRadius: '4px', color: 'var(--text-primary)', outline: 'none'
                  }}
                />
                <button
                  onClick={() => handleCreateFolder(creatingFolder === 'root' ? null : creatingFolder)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', backgroundColor: 'var(--accent-color)', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                ><Check size={14} /></button>
              </div>
            )}
          </div>

          {/* Notes in current view */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Notes
              </span>
              <button
                onClick={onCreateNote}
                title="New Note"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              ><Plus size={14} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {(searchQuery ? notes : notesInView).map(note => (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    width: '100%', padding: '6px 8px', borderRadius: '6px',
                    textAlign: 'left', cursor: 'pointer',
                    color: activeNoteId === note.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    backgroundColor: activeNoteId === note.id ? 'var(--bg-tertiary)' : 'transparent',
                    transition: 'all 0.1s',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {note.title || 'Untitled Note'}
                  </span>
                  {note.tags && note.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '3px' }}>
                      {note.tags.slice(0, 2).map(tag => (
                        <TagBadge key={tag.id} tag={tag} small />
                      ))}
                    </div>
                  )}
                </button>
              ))}
              {notesInView.length === 0 && !searchQuery && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 8px' }}>
                  No notes here yet.
                </div>
              )}
            </div>
          </div>

          {/* Tags section */}
          {tags.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Tags
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {tags.map(tag => (
                  <TagBadge key={tag.id} tag={tag} small />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

// ─── FolderItem ───────────────────────────────────────────────
interface FolderItemProps {
  folder: Folder
  folders: Folder[]
  notes: Note[]
  activeFolderId: string | null | undefined
  expanded: boolean
  onToggle: () => void
  onSelectFolder: (id: string) => void
  onDeleteFolder: (id: string) => void
  onCreateSubfolder: (parentId: string) => void
}

function FolderItem({ folder, folders, notes, activeFolderId, expanded, onToggle, onSelectFolder, onDeleteFolder, onCreateSubfolder }: FolderItemProps) {
  const children = folders.filter(f => f.parentId === folder.id)
  const noteCount = notes.filter(n => n.folderId === folder.id).length

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '5px 8px', borderRadius: '5px', cursor: 'pointer',
          fontSize: '12px',
          color: activeFolderId === folder.id ? 'var(--text-primary)' : 'var(--text-secondary)',
          backgroundColor: activeFolderId === folder.id ? 'var(--bg-tertiary)' : 'transparent',
        }}
      >
        <button onClick={onToggle} style={{ background: 'none', border: 'none', padding: '0', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'pointer', width: '14px' }}>
          {children.length > 0 ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
        </button>
        <span onClick={() => onSelectFolder(folder.id)} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {expanded ? <FolderOpen size={14} color="var(--accent-color)" /> : <FolderIcon size={14} color="var(--text-muted)" />} {folder.name}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '2px' }}>{noteCount}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id) }}
          title="Delete folder"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.5, padding: '2px' }}
        ><X size={12} /></button>
      </div>
      {expanded && children.map(child => (
        <div key={child.id} style={{ paddingLeft: '14px' }}>
          <FolderItem
            folder={child} folders={folders} notes={notes}
            activeFolderId={activeFolderId}
            expanded={false} onToggle={() => {}} onSelectFolder={onSelectFolder}
            onDeleteFolder={onDeleteFolder} onCreateSubfolder={onCreateSubfolder}
          />
        </div>
      ))}
    </div>
  )
}
