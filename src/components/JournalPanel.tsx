import { useState, useEffect, useCallback, useRef } from 'react'
import type { Journal } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MOODS = [
  { emoji: '😄', label: 'Great' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😤', label: 'Stressed' },
]

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function JournalPanel() {
  const [date, setDate] = useState(toDateStr(new Date()))
  const [journal, setJournal] = useState<Journal | null>(null)
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadJournal(date)
  }, [date])

  const loadJournal = async (d: string) => {
    const j = await window.ipcRenderer.invoke('get-journal', d) as Journal | null
    setJournal(j)
    setContent(j?.content ?? '')
    setMood(j?.mood ?? null)
    setIsEditing(!j)
  }

  const saveJournal = useCallback(async (c: string, m: string | null) => {
    setSaving(true)
    try {
      const entry: Journal = {
        id: journal?.id ?? crypto.randomUUID(),
        date,
        content: c,
        mood: m,
        createdAt: journal?.createdAt ?? Date.now()
      }
      await window.ipcRenderer.invoke('save-journal', entry)
      setJournal(entry)
    } finally {
      setSaving(false)
    }
  }, [date, journal])

  const handleContentChange = (val: string) => {
    setContent(val)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveJournal(val, mood), 1500)
  }

  const handleMoodChange = (emoji: string) => {
    const newMood = mood === emoji ? null : emoji
    setMood(newMood)
    saveJournal(content, newMood)
  }

  const goDay = (delta: number) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(toDateStr(d))
  }

  const isToday = date === toDateStr(new Date())

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', paddingTop: '40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <button
            onClick={() => goDay(-1)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', padding: '4px', borderRadius: '4px' }}
          >‹</button>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0, lineHeight: 1.1 }}>
              {isToday ? 'Today' : formatDisplayDate(date)}
            </h1>
            {isToday && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {formatDisplayDate(date)}
              </div>
            )}
          </div>

          <button
            onClick={() => goDay(1)}
            disabled={isToday}
            style={{ background: 'none', border: 'none', color: isToday ? 'var(--bg-tertiary)' : 'var(--text-secondary)', cursor: isToday ? 'default' : 'pointer', fontSize: '18px', padding: '4px', borderRadius: '4px' }}
          >›</button>

          <input
            type="date"
            value={date}
            max={toDateStr(new Date())}
            onChange={e => setDate(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', borderRadius: '6px', fontSize: '12px',
              padding: '4px 8px', cursor: 'pointer'
            }}
          />

          {!isToday && (
            <button
              onClick={() => setDate(toDateStr(new Date()))}
              style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
                backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                cursor: 'pointer', border: '1px solid var(--border-color)',
              }}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Mood picker */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
          How are you feeling?
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {MOODS.map(m => (
            <button
              key={m.emoji}
              onClick={() => handleMoodChange(m.emoji)}
              title={m.label}
              style={{
                width: '44px', height: '44px', borderRadius: '10px',
                fontSize: '22px', cursor: 'pointer',
                backgroundColor: mood === m.emoji ? 'var(--accent-color)22' : 'var(--bg-secondary)',
                border: `2px solid ${mood === m.emoji ? 'var(--accent-color)' : 'var(--border-color)'}`,
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: mood === m.emoji ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {m.emoji}
            </button>
          ))}
          {mood && (
            <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--text-muted)', marginLeft: '4px' }}>
              {MOODS.find(m => m.emoji === mood)?.label}
            </span>
          )}
        </div>
      </div>

      {/* Save indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsEditing(true)}
            style={{
              fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
              backgroundColor: isEditing ? 'var(--accent-color)' : 'var(--bg-tertiary)',
              color: isEditing ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', border: '1px solid var(--border-color)',
            }}
          >
            ✏️ Edit
          </button>
          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', border: '1px solid var(--border-color)' }}
            >
              👁 Preview
            </button>
          )}
        </div>
        {saving && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saving...</span>
        )}
        {!saving && journal && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>✓ Auto-saved</span>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isEditing ? (
          <textarea
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            placeholder={`Write your thoughts for ${formatDisplayDate(date)}...\n\nUse Markdown for formatting.`}
            style={{
              flex: 1, backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)', borderRadius: '10px',
              color: 'var(--text-primary)', fontSize: '15px',
              fontFamily: 'var(--font-family-mono)', lineHeight: 1.7,
              resize: 'none', outline: 'none', padding: '20px',
            }}
          />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            {content ? (
              <div className="markdown-preview" style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>
                No entry for this day yet. Click Edit to write.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
