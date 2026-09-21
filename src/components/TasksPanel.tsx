import { useState, useEffect } from 'react'
import type { Task } from '../types'

type Filter = 'all' | 'active' | 'done'

export function TasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const t = await window.ipcRenderer.invoke('get-tasks')
      setTasks(t)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    const task: Task = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      done: 0,
      dueDate: newDueDate || null,
      noteId: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await window.ipcRenderer.invoke('save-task', task)
    setNewTitle('')
    setNewDueDate('')
    loadTasks()
  }

  const handleToggle = async (id: string) => {
    await window.ipcRenderer.invoke('toggle-task', id)
    loadTasks()
  }

  const handleDelete = async (id: string) => {
    await window.ipcRenderer.invoke('delete-task', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.done === 1 : t.done === 0
  )

  const completedCount = tasks.filter(t => t.done === 1).length
  const totalCount = tasks.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const isOverdue = (task: Task) =>
    task.dueDate && task.done === 0 && new Date(task.dueDate) < new Date()

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', paddingTop: '40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0, marginBottom: '8px' }}>
          Tasks
        </h1>
        {totalCount > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {completedCount} of {totalCount} completed
            </div>
            <div style={{ height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '999px',
                background: 'linear-gradient(90deg, var(--accent-color), #a78bfa)',
                width: `${progress}%`, transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Add task */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '24px',
        backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '10px', padding: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{
            flex: 1, backgroundColor: 'transparent', border: 'none',
            color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
          }}
        />
        <input
          type="date"
          value={newDueDate}
          onChange={e => setNewDueDate(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)', borderRadius: '6px', fontSize: '12px',
            padding: '4px 8px', cursor: 'pointer'
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            backgroundColor: 'var(--accent-color)', color: '#fff',
            padding: '6px 14px', borderRadius: '6px', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Add
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {(['all', 'active', 'done'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
              backgroundColor: filter === f ? 'var(--accent-color)' : 'var(--bg-tertiary)',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
              border: 'none', textTransform: 'capitalize'
            }}
          >
            {f}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '20px 0' }}>Loading...</div>}

        {!loading && filtered.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            flex: 1, color: 'var(--text-muted)', gap: '8px', paddingTop: '60px'
          }}>
            <div style={{ fontSize: '40px' }}>✅</div>
            <div style={{ fontSize: '14px' }}>
              {filter === 'done' ? 'No completed tasks yet' : filter === 'active' ? 'All tasks done!' : 'No tasks yet. Add one above.'}
            </div>
          </div>
        )}

        {filtered.map(task => (
          <div
            key={task.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 14px', borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: `1px solid ${isOverdue(task) ? '#ff4d4f44' : 'var(--border-color)'}`,
              transition: 'all 0.15s',
              opacity: task.done === 1 ? 0.6 : 1,
            }}
          >
            <button
              onClick={() => handleToggle(task.id)}
              style={{
                width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${task.done === 1 ? 'var(--accent-color)' : 'var(--border-color)'}`,
                backgroundColor: task.done === 1 ? 'var(--accent-color)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: '#fff', transition: 'all 0.15s',
              }}
            >
              {task.done === 1 ? '✓' : ''}
            </button>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '14px', color: 'var(--text-primary)',
                textDecoration: task.done === 1 ? 'line-through' : 'none',
                transition: 'all 0.15s',
              }}>
                {task.title}
              </div>
              {task.dueDate && (
                <div style={{ fontSize: '11px', marginTop: '2px', color: isOverdue(task) ? '#ff4d4f' : 'var(--text-muted)' }}>
                  {isOverdue(task) ? '⚠ Overdue · ' : '📅 '}
                  {new Date(task.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>

            <button
              onClick={() => handleDelete(task.id)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '14px', opacity: 0.5, padding: '2px',
                transition: 'opacity 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
              title="Delete task"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
