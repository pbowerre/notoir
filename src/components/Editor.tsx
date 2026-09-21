import { useState, useEffect, useRef } from 'react'
import type { Note, Tag, Folder } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { TagBadge } from './TagBadge'

interface EditorProps {
  note: Note
  allTags: Tag[]
  folders: Folder[]
  onUpdateNote: (note: Note) => void
  onDeleteNote: (id: string) => void
  onSetNoteTags: (noteId: string, tagIds: string[]) => void
}

const AI_ACTIONS = [
  { id: 'summarize', label: 'Summarize', icon: '📋' },
  { id: 'expand',    label: 'Expand',    icon: '✨' },
  { id: 'improve',   label: 'Improve',   icon: '✏️' },
  { id: 'title',     label: 'Gen Title', icon: '🏷️' },
]

export function Editor({ note, allTags, folders, onUpdateNote, onDeleteNote, onSetNoteTags }: EditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(note.folderId)
  const [noteTags, setNoteTags] = useState<Tag[]>(note.tags ?? [])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiAction, setAiAction] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [showAiDropdown, setShowAiDropdown] = useState(false)
  const tagDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    setSelectedFolderId(note.folderId)
    setNoteTags(note.tags ?? [])
    setIsEditing(false)
    setAiResult(null)
  }, [note.id])

  // Close tag dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSave = () => {
    const updated = { ...note, title, content, folderId: selectedFolderId ?? null, updatedAt: Date.now() }
    onUpdateNote(updated)
    const tagIds = noteTags.map(t => t.id)
    onSetNoteTags(note.id, tagIds)
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (confirm('Delete this note?')) onDeleteNote(note.id)
  }

  const toggleTag = (tag: Tag) => {
    const has = noteTags.some(t => t.id === tag.id)
    const next = has ? noteTags.filter(t => t.id !== tag.id) : [...noteTags, tag]
    setNoteTags(next)
  }

  const handleAiAction = async (action: string) => {
    setShowAiDropdown(false)
    setAiLoading(true)
    setAiAction(action)
    setAiResult(null)
    try {
      const result = await window.ipcRenderer.invoke('ai-generate', content || title, action)
      if (action === 'title') {
        setTitle(result.trim())
      } else {
        setAiResult(result)
      }
    } catch (err: any) {
      setAiResult(`⚠️ ${err.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const applyAiResult = () => {
    if (!aiResult) return
    if (aiAction === 'summarize') {
      setContent(prev => `${aiResult}\n\n---\n\n${prev}`)
    } else {
      setContent(aiResult)
    }
    setAiResult(null)
  }

  const dateStr = new Date(note.updatedAt).toLocaleString()

  const buttonBase: React.CSSProperties = {
    padding: '5px 10px', borderRadius: '5px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
    transition: 'all 0.15s',
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Folder selector */}
          {isEditing && (
            <select
              value={selectedFolderId ?? ''}
              onChange={e => setSelectedFolderId(e.target.value || null)}
              style={{
                backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)', borderRadius: '5px', fontSize: '12px',
                padding: '4px 8px', cursor: 'pointer',
              }}
            >
              <option value="">No folder</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}

          {/* Tag selector */}
          {isEditing && (
            <div style={{ position: 'relative' }} ref={tagDropdownRef}>
              <button
                onClick={() => setShowTagDropdown(p => !p)}
                style={{ ...buttonBase, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
              >
                🏷️ Tags
              </button>
              {showTagDropdown && (
                <div style={{
                  position: 'absolute', top: '110%', left: 0, zIndex: 100,
                  backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', padding: '8px', minWidth: '160px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                  {allTags.length === 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px' }}>No tags yet. Create in Settings.</span>
                  )}
                  {allTags.map(tag => (
                    <label key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '3px 4px', borderRadius: '4px' }}>
                      <input
                        type="checkbox"
                        checked={noteTags.some(t => t.id === tag.id)}
                        onChange={() => toggleTag(tag)}
                        style={{ accentColor: tag.color }}
                      />
                      <TagBadge tag={tag} small />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* AI button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAiDropdown(p => !p)}
              disabled={aiLoading}
              style={{
                ...buttonBase,
                backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                opacity: aiLoading ? 0.6 : 1,
              }}
            >
              {aiLoading ? '⏳' : '✦'} AI
            </button>
            {showAiDropdown && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 100,
                backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '8px', padding: '6px', minWidth: '150px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '2px'
              }}>
                {AI_ACTIONS.map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleAiAction(a.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '7px 10px', borderRadius: '5px', fontSize: '12px',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                      backgroundColor: 'transparent', textAlign: 'left', width: '100%',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>{a.icon}</span> {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isEditing ? (
            <button
              onClick={handleSave}
              style={{ ...buttonBase, backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none' }}
            >
              Save
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              style={{ ...buttonBase, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            >
              Edit
            </button>
          )}
          <button
            onClick={handleDelete}
            style={{ ...buttonBase, backgroundColor: 'transparent', color: '#ff4d4f', border: '1px solid #ff4d4f33' }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tags display (read mode) */}
      {!isEditing && noteTags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {noteTags.map(tag => <TagBadge key={tag.id} tag={tag} />)}
        </div>
      )}

      {/* AI Result Banner */}
      {aiResult && (
        <div style={{
          backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--accent-color)44',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
          fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ✦ AI Result — {aiAction}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={applyAiResult}
                style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: 'var(--accent-color)', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
              >Apply</button>
              <button
                onClick={() => setAiResult(null)}
                style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
              >Dismiss</button>
            </div>
          </div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{aiResult}</p>
        </div>
      )}

      {/* Editor / Preview */}
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note Title"
            style={{
              fontSize: '36px', fontWeight: 700, letterSpacing: '-0.02em',
              backgroundColor: 'transparent', border: 'none',
              color: 'var(--text-primary)', outline: 'none', width: '100%'
            }}
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Start typing... (supports Markdown and [[wiki-links]])"
            style={{
              flex: 1, backgroundColor: 'transparent', border: 'none',
              color: 'var(--text-primary)', fontSize: '15px',
              fontFamily: 'var(--font-family-mono)', lineHeight: 1.7,
              resize: 'none', outline: 'none', paddingBottom: '40px'
            }}
          />
        </div>
      ) : (
        <div style={{ overflowY: 'auto', paddingBottom: '80px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '8px', color: 'var(--text-primary)' }}>
            {note.title || 'Untitled'}
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '32px' }}>
            Last modified {dateStr}
          </div>

          <div className="markdown-preview" style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({node, inline, className, children, ...props}: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      {...props}
                      children={String(children).replace(/\n$/, '')}
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ borderRadius: '8px', padding: '16px', margin: '20px 0', fontSize: '13px' }}
                    />
                  ) : (
                    <code {...props} className={className} style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-family-mono)', fontSize: '0.88em', color: 'var(--text-primary)' }}>
                      {children}
                    </code>
                  )
                },
                h1: ({node, ...props}) => <h1 style={{ fontSize: '28px', fontWeight: 700, marginTop: '32px', marginBottom: '16px', color: 'var(--text-primary)' }} {...props} />,
                h2: ({node, ...props}) => <h2 style={{ fontSize: '22px', fontWeight: 600, marginTop: '28px', marginBottom: '12px', color: 'var(--text-primary)' }} {...props} />,
                h3: ({node, ...props}) => <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '20px', marginBottom: '10px', color: 'var(--text-primary)' }} {...props} />,
                p: ({node, ...props}) => <p style={{ marginBottom: '16px' }} {...props} />,
                ul: ({node, ...props}) => <ul style={{ marginBottom: '16px', paddingLeft: '24px' }} {...props} />,
                ol: ({node, ...props}) => <ol style={{ marginBottom: '16px', paddingLeft: '24px' }} {...props} />,
                li: ({node, ...props}) => <li style={{ marginBottom: '6px' }} {...props} />,
                blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '3px solid var(--accent-color)', paddingLeft: '16px', marginLeft: 0, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '20px' }} {...props} />,
                a: ({node, ...props}) => <a style={{ color: 'var(--accent-color)', textDecoration: 'underline' }} {...props} />,
                hr: ({node, ...props}) => <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '28px 0' }} {...props} />,
              }}
            >
              {note.content || '*Empty note — click Edit to start writing.*'}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
