import { useState, useEffect, useCallback } from 'react'
import type { Tag, StorageConfig, DatabaseProvider } from '../types'
import { TagBadge } from './TagBadge'

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#0ea5e9',
]

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', icon: '🤖' },
  { id: 'anthropic', label: 'Anthropic (Claude)', icon: '🧠' },
  { id: 'ollama', label: 'Ollama (Local)', icon: '🦙' },
]

interface SettingsPanelProps {
  onUserDeleted?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Change Database inline panel
// ─────────────────────────────────────────────────────────────────────────────
interface ChangeDatabasePanelProps {
  onSuccess: () => void
  onCancel: () => void
}

function ChangeDatabasePanel({ onSuccess, onCancel }: ChangeDatabasePanelProps) {
  const [provider, setProvider] = useState<DatabaseProvider>('mongodb')
  const [connectionString, setConnectionString] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const placeholder =
    provider === 'mongodb'
      ? 'mongodb+srv://user:password@cluster.mongodb.net/notoir'
      : 'postgresql://user:password@host:5432/dbname'

  const handleTest = async () => {
    if (!connectionString.trim()) return
    setTestStatus('testing')
    setTestMessage('')
    try {
      const result = await window.ipcRenderer.invoke('storage:test-connection', provider, connectionString.trim())
      setTestStatus(result.ok ? 'success' : 'error')
      setTestMessage(result.message)
    } catch (err: any) {
      setTestStatus('error')
      setTestMessage(err.message ?? 'Connection test failed.')
    }
  }

  const handleSave = async () => {
    if (testStatus !== 'success') return
    setSaving(true)
    try {
      const result = await window.ipcRenderer.invoke('storage:change-database', provider, connectionString.trim())
      if (result.ok) {
        onSuccess()
      } else {
        setTestStatus('error')
        setTestMessage(result.message)
      }
    } catch (err: any) {
      setTestStatus('error')
      setTestMessage(err.message ?? 'Failed to switch database.')
    } finally {
      setSaving(false)
    }
  }

  const feedbackColor = testStatus === 'success' ? '#22c55e' : '#f43f5e'

  return (
    <div style={{
      marginTop: '16px',
      padding: '18px',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
        Connect a new database
      </div>

      {/* Provider */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['mongodb', 'postgresql'] as DatabaseProvider[]).map(p => (
          <button
            key={p}
            type="button"
            id={`settings-provider-${p}`}
            onClick={() => { setProvider(p); setTestStatus('idle') }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: `1.5px solid ${provider === p ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: provider === p ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
              color: provider === p ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {p === 'mongodb' ? '🍃 MongoDB' : '🐘 PostgreSQL'}
          </button>
        ))}
      </div>

      {/* Connection string */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          id="settings-change-connection"
          type="text"
          value={connectionString}
          onChange={e => { setConnectionString(e.target.value); setTestStatus('idle') }}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontFamily: 'var(--font-family-mono)',
            outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
        />
        <button
          id="settings-test-connection"
          type="button"
          onClick={handleTest}
          disabled={!connectionString.trim() || testStatus === 'testing'}
          style={{
            flexShrink: 0,
            padding: '9px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {testStatus === 'testing' ? '⏳' : 'Test'}
        </button>
      </div>

      {testStatus !== 'idle' && testStatus !== 'testing' && (
        <div style={{
          padding: '9px 12px',
          borderRadius: '8px',
          background: testStatus === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(244,63,94,0.08)',
          border: `1px solid ${testStatus === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(244,63,94,0.2)'}`,
          fontSize: '12px',
          color: feedbackColor,
        }}>
          {testStatus === 'success' ? '✓ ' : '✕ '}{testMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          id="settings-save-database"
          type="button"
          onClick={handleSave}
          disabled={testStatus !== 'success' || saving}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: '8px',
            background: testStatus === 'success' ? 'var(--accent-color)' : 'var(--bg-tertiary)',
            color: testStatus === 'success' ? '#fff' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: testStatus === 'success' ? 'pointer' : 'not-allowed',
            border: 'none',
            transition: 'all 0.15s',
          }}
        >
          {saving ? 'Switching…' : 'Switch Database'}
        </button>
        <button
          id="settings-cancel-change"
          type="button"
          onClick={onCancel}
          style={{
            padding: '9px 14px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            border: '1px solid var(--border-color)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage & Database section
// ─────────────────────────────────────────────────────────────────────────────
interface StorageSectionProps {
  username: string
  onStorageChange: () => void
}

function StorageSection({ username, onStorageChange }: StorageSectionProps) {
  const [config, setConfig] = useState<StorageConfig | null>(null)
  const [showChangePanel, setShowChangePanel] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const loadConfig = useCallback(async () => {
    const c = await window.ipcRenderer.invoke('storage:get-config')
    setConfig(c)
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  if (!config) return null

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      'Disconnect your database?\n\n' +
      'This removes the database connection from Notoir. ' +
      'Your remote database and its data will NOT be deleted. ' +
      'You can reconnect at any time.',
    )
    if (!confirmed) return
    setDisconnecting(true)
    await window.ipcRenderer.invoke('storage:disconnect')
    onStorageChange()
  }

  const statusDot = (connected: boolean) => (
    <span style={{
      display: 'inline-block',
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      background: connected ? '#22c55e' : '#f43f5e',
      marginRight: '6px',
      boxShadow: connected ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
    }} />
  )

  // ── Managed ──────────────────────────────────────────────────────────────
  if (config.storageMode === 'managed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{
          padding: '18px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                Notoir Managed Storage
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {statusDot(config.connected)}
                {config.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '99px',
              background: 'rgba(34,197,94,0.1)',
              color: '#22c55e',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              Managed
            </span>
          </div>
          <div style={{
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '13px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}>
            Your Notoir data is securely stored using Notoir's managed infrastructure.
            Account: <strong style={{ color: 'var(--text-secondary)' }}>{username}</strong>
          </div>
        </div>
      </div>
    )
  }

  // ── Developer ─────────────────────────────────────────────────────────────
  const providerLabel = config.databaseProvider === 'postgresql' ? 'PostgreSQL' : 'MongoDB'
  const providerIcon = config.databaseProvider === 'postgresql' ? '🐘' : '🍃'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{
        padding: '18px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
              Developer Database
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {statusDot(config.connected)}
              {config.connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '99px',
            background: 'rgba(99,102,241,0.1)',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {providerIcon} {providerLabel}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '13px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Connection</span>
            <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', letterSpacing: '0.1em' }}>
              ••••••••••••••••
            </span>
          </div>
          <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.6 }}>
            Your Notoir activity is stored exclusively in your connected database.
          </p>
        </div>
      </div>

      {/* Actions */}
      {!showChangePanel && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            id="storage-change-database"
            type="button"
            onClick={() => setShowChangePanel(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Change Database
          </button>
          <button
            id="storage-disconnect"
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(244,63,94,0.3)',
              background: 'rgba(244,63,94,0.05)',
              color: '#f43f5e',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      )}

      {showChangePanel && (
        <ChangeDatabasePanel
          onSuccess={() => {
            setShowChangePanel(false)
            loadConfig()
          }}
          onCancel={() => setShowChangePanel(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main settings panel
// ─────────────────────────────────────────────────────────────────────────────
export function SettingsPanel({ onUserDeleted }: SettingsPanelProps = {}) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [tags, setTags] = useState<Tag[]>([])
  const [username, setUsername] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [s, t, user] = await Promise.all([
      window.ipcRenderer.invoke('get-settings'),
      window.ipcRenderer.invoke('get-tags'),
      window.ipcRenderer.invoke('get-active-user'),
    ])
    setSettings(s)
    setTags(t)
    if (user?.username) setUsername(user.username)
  }

  const saveSetting = async (key: string, value: string) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    await window.ipcRenderer.invoke('save-setting', key, value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    const tag: Tag = { id: crypto.randomUUID(), name: newTagName.trim(), color: newTagColor }
    await window.ipcRenderer.invoke('save-tag', tag)
    setNewTagName('')
    setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)])
    setTags(prev => [...prev, tag])
  }

  const handleDeleteTag = async (id: string) => {
    await window.ipcRenderer.invoke('delete-tag', id)
    setTags(prev => prev.filter(t => t.id !== id))
  }

  const field = (label: string, key: string, placeholder: string, type: 'text' | 'password' = 'password') => (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type={type}
        value={settings[key] ?? ''}
        onChange={e => saveSetting(key, e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '8px 12px', backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)', borderRadius: '7px',
          color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
          fontFamily: 'var(--font-family-mono)',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-color)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
      />
    </div>
  )

  const activeProvider = settings['ai_provider'] ?? 'openai'

  const sectionTitle = (label: string, color?: string) => (
    <h2 style={{
      fontSize: '14px',
      fontWeight: 600,
      color: color ?? 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: '16px',
    }}>
      {label}
    </h2>
  )

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingTop: '40px', paddingBottom: '60px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
          Settings
        </h1>
        {saved && (
          <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 500, alignSelf: 'center' }}>✓ Saved</span>
        )}
      </div>

      {/* Storage & Database */}
      <section style={{ marginBottom: '36px' }}>
        {sectionTitle('Storage & Database')}
        <StorageSection username={username} onStorageChange={() => onUserDeleted?.()} />
      </section>

      {/* AI Provider */}
      <section style={{ marginBottom: '36px' }}>
        {sectionTitle('AI Provider')}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              id={`ai-provider-${p.id}`}
              onClick={() => saveSetting('ai_provider', p.id)}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: activeProvider === p.id ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: activeProvider === p.id ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${activeProvider === p.id ? 'var(--accent-color)' : 'var(--border-color)'}`,
              }}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          {activeProvider === 'openai' && field('OpenAI API Key', 'openai_api_key', 'sk-...')}
          {activeProvider === 'anthropic' && field('Anthropic API Key', 'anthropic_api_key', 'sk-ant-...')}
          {activeProvider === 'ollama' && field('Ollama Endpoint', 'ollama_endpoint', 'http://localhost:11434', 'text')}

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            {activeProvider === 'openai' && '🔑 Get your key at platform.openai.com. Model used: gpt-4o-mini.'}
            {activeProvider === 'anthropic' && '🔑 Get your key at console.anthropic.com. Model used: claude-3-haiku.'}
            {activeProvider === 'ollama' && '🦙 Ollama runs locally — no API key needed. Ensure Ollama is running with a model loaded (e.g. ollama run llama3.2).'}
          </div>
        </div>
      </section>

      {/* Tags */}
      <section style={{ marginBottom: '36px' }}>
        {sectionTitle('Tags')}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="New tag name..."
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
            style={{
              flex: 1, padding: '7px 12px', backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)', borderRadius: '7px',
              color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            {TAG_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewTagColor(c)}
                style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  backgroundColor: c, border: newTagColor === c ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'pointer', transition: 'transform 0.1s',
                  transform: newTagColor === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
          <button
            onClick={handleCreateTag}
            style={{
              padding: '7px 14px', backgroundColor: 'var(--accent-color)', color: '#fff',
              borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Create
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {tags.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No tags yet. Create your first one above.
            </div>
          )}
          {tags.map(tag => (
            <TagBadge key={tag.id} tag={tag} onRemove={() => handleDeleteTag(tag.id)} />
          ))}
        </div>
      </section>

      {/* Danger Zone */}
      <section style={{ marginBottom: '36px' }}>
        {sectionTitle('Danger Zone', '#f43f5e')}
        <div style={{ padding: '16px', backgroundColor: 'rgba(244, 63, 94, 0.05)', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Permanently delete your profile and all associated notes, tasks, journals, and stored local files.
            This action cannot be undone.
          </p>
          <button
            id="settings-delete-profile"
            onClick={async () => {
              const confirmed = window.confirm(
                'Delete your Notoir profile?\n\n' +
                'This will permanently delete your profile and all associated application data. ' +
                'If you are using a developer database, the remote database itself will NOT be dropped — ' +
                'only your Notoir data within it will be removed.\n\n' +
                'This action cannot be undone.',
              )
              if (confirmed && onUserDeleted) {
                await window.ipcRenderer.invoke('delete-user')
                onUserDeleted()
              }
            }}
            style={{
              padding: '8px 16px', backgroundColor: '#f43f5e', color: '#fff',
              borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: 'none', transition: 'background-color 0.15s',
            }}
          >
            Delete Profile
          </button>
        </div>
      </section>

      {/* About */}
      <section>
        {sectionTitle('About')}
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <div>✦ <strong style={{ color: 'var(--text-primary)' }}>Notoir</strong> — A premium note-taking app</div>
          <div>⚙ Built with Electron + React + Provider-Agnostic Persistence</div>
          <div>🔒 Credentials secured via OS-native encryption</div>
        </div>
      </section>
    </div>
  )
}
