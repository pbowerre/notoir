import { useState, useCallback } from 'react'
import notoirLogo from '../assets/notoir.png'
import type { StorageMode, DatabaseProvider } from '../types'

type Step =
  | 'mode-select'
  | 'personal-nickname'
  | 'developer-setup'

interface ConnectionTestState {
  status: 'idle' | 'testing' | 'success' | 'error'
  message: string
}

interface OnboardingProps {
  onComplete: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared style tokens
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  wrap: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(ellipse at 60% 40%, rgba(99,102,241,0.08) 0%, transparent 65%), var(--bg-primary)',
    padding: '24px',
    color: 'var(--text-primary)',
  },
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '18px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
    padding: '40px',
    width: '100%',
    maxWidth: '480px',
  },
  logo: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'block',
    margin: '0 auto 24px',
  },
  h1: {
    fontSize: '26px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    textAlign: 'center' as const,
    margin: '0 0 8px',
    color: 'var(--text-primary)',
  },
  sub: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    textAlign: 'center' as const,
    margin: '0 0 32px',
    lineHeight: 1.6,
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  primaryBtn: {
    display: 'block',
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    background: 'var(--accent-color)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.2s, transform 0.1s',
    marginTop: '8px',
  },
  ghostBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '8px 0',
    display: 'block',
    textAlign: 'center' as const,
    width: '100%',
    marginTop: '12px',
    transition: 'color 0.15s',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Mode selection
// ─────────────────────────────────────────────────────────────────────────────
function ModeSelect({ onSelect }: { onSelect: (mode: StorageMode) => void }) {
  const [hovered, setHovered] = useState<StorageMode | null>(null)

  const card = (
    mode: StorageMode,
    icon: string,
    title: string,
    badge: string,
    body: string,
  ) => {
    const isHov = hovered === mode
    return (
      <button
        id={`onboarding-mode-${mode}`}
        key={mode}
        onClick={() => onSelect(mode)}
        onMouseEnter={() => setHovered(mode)}
        onMouseLeave={() => setHovered(null)}
        style={{
          flex: 1,
          textAlign: 'left',
          padding: '22px 20px',
          borderRadius: '14px',
          border: `1.5px solid ${isHov ? 'var(--accent-color)' : 'var(--border-color)'}`,
          background: isHov ? 'rgba(99,102,241,0.06)' : 'var(--bg-primary)',
          cursor: 'pointer',
          transition: 'all 0.18s',
          boxShadow: isHov ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '26px' }}>{icon}</div>
        <div>
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}>
            {title}
          </div>
          <div style={{
            display: 'inline-block',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            padding: '2px 8px',
            borderRadius: '99px',
            background: mode === 'managed' ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)',
            color: mode === 'managed' ? '#22c55e' : 'var(--accent-color)',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}>
            {badge}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {body}
          </div>
        </div>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: isHov ? 'var(--accent-color)' : 'var(--text-muted)',
          transition: 'color 0.18s',
          letterSpacing: '0.02em',
        }}>
          Select →
        </div>
      </button>
    )
  }

  return (
    <div style={S.wrap}>
      <div style={{ ...S.card, maxWidth: '540px' }}>
        <img src={notoirLogo} alt="Notoir" style={S.logo} />
        <h1 style={S.h1}>Welcome to Notoir</h1>
        <p style={S.sub}>
          Before we begin, choose how you want to store your Notoir data.
        </p>

        <div style={{ display: 'flex', gap: '14px' }}>
          {card(
            'managed',
            '✦',
            "I'm a Personal User",
            'Managed',
            "Use Notoir's built-in storage. No setup needed — we handle the infrastructure.",
          )}
          {card(
            'developer',
            '⌗',
            "I'm a Developer",
            'Bring Your Own DB',
            'Connect your own MongoDB or PostgreSQL database. Your Notoir data stays on your infrastructure.',
          )}
        </div>

        <p style={{
          marginTop: '20px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          You can change your storage configuration later in Settings.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2a — Personal user: just a nickname
// ─────────────────────────────────────────────────────────────────────────────
function PersonalSetup({
  onBack,
  onComplete,
}: {
  onBack: () => void
  onComplete: () => void
}) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    setError('')
    try {
      const configResult = await window.ipcRenderer.invoke('storage:configure', 'managed')
      if (!configResult.ok) {
        setError(configResult.message)
        setLoading(false)
        return
      }
      await window.ipcRenderer.invoke('create-user', username.trim(), 'managed')
      onComplete()
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <img src={notoirLogo} alt="Notoir" style={S.logo} />
        <h1 style={S.h1}>Create your profile</h1>
        <p style={S.sub}>
          Your notes and activity will be securely stored using Notoir's managed
          infrastructure.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={S.label} htmlFor="personal-nickname">Your nickname</label>
            <input
              id="personal-nickname"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. Alice"
              required
              autoFocus
              style={S.input}
              onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.2)',
              fontSize: '13px',
              color: '#f43f5e',
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            id="personal-continue"
            type="submit"
            disabled={!username.trim() || loading}
            style={{
              ...S.primaryBtn,
              opacity: (!username.trim() || loading) ? 0.55 : 1,
              cursor: (!username.trim() || loading) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Setting up…' : 'Continue'}
          </button>
        </form>

        <button id="personal-back" onClick={onBack} style={S.ghostBtn}>
          ← Back
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2b — Developer: nickname + provider + connection test
// ─────────────────────────────────────────────────────────────────────────────
function DeveloperSetup({
  onBack,
  onComplete,
}: {
  onBack: () => void
  onComplete: () => void
}) {
  const [username, setUsername] = useState('')
  const [provider, setProvider] = useState<DatabaseProvider>('mongodb')
  const [connectionString, setConnectionString] = useState('')
  const [testState, setTestState] = useState<ConnectionTestState>({ status: 'idle', message: '' })
  const [loading, setLoading] = useState(false)

  const placeholder =
    provider === 'mongodb'
      ? 'mongodb+srv://user:password@cluster.mongodb.net/notoir'
      : 'postgresql://user:password@host:5432/dbname'

  const handleTestConnection = useCallback(async () => {
    if (!connectionString.trim()) return
    setTestState({ status: 'testing', message: '' })
    try {
      const result = await window.ipcRenderer.invoke(
        'storage:test-connection',
        provider,
        connectionString.trim(),
      )
      setTestState({ status: result.ok ? 'success' : 'error', message: result.message })
    } catch (err: any) {
      setTestState({ status: 'error', message: err.message ?? 'Connection test failed.' })
    }
  }, [provider, connectionString])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !connectionString.trim()) return
    if (testState.status !== 'success') {
      setTestState({ status: 'error', message: 'Please test the connection before continuing.' })
      return
    }

    setLoading(true)
    try {
      const configResult = await window.ipcRenderer.invoke(
        'storage:configure',
        'developer',
        provider,
        connectionString.trim(),
      )
      if (!configResult.ok) {
        setTestState({ status: 'error', message: configResult.message })
        setLoading(false)
        return
      }
      await window.ipcRenderer.invoke('create-user', username.trim(), 'developer', provider)
      onComplete()
    } catch (err: any) {
      setTestState({ status: 'error', message: err.message ?? 'Setup failed. Please try again.' })
      setLoading(false)
    }
  }

  const testFeedbackColor =
    testState.status === 'success' ? '#22c55e' :
    testState.status === 'error' ? '#f43f5e' : 'var(--text-muted)'

  const testFeedbackBg =
    testState.status === 'success' ? 'rgba(34,197,94,0.08)' :
    testState.status === 'error' ? 'rgba(244,63,94,0.08)' : 'transparent'

  const testFeedbackBorder =
    testState.status === 'success' ? '1px solid rgba(34,197,94,0.2)' :
    testState.status === 'error' ? '1px solid rgba(244,63,94,0.2)' : 'none'

  return (
    <div style={S.wrap}>
      <div style={{ ...S.card, maxWidth: '520px' }}>
        <img src={notoirLogo} alt="Notoir" style={S.logo} />
        <h1 style={S.h1}>Connect your database</h1>
        <p style={S.sub}>
          Your Notoir activity will be stored entirely in your own database.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Nickname */}
          <div>
            <label style={S.label} htmlFor="dev-nickname">Your nickname</label>
            <input
              id="dev-nickname"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. Alice"
              required
              autoFocus
              style={S.input}
              onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
            />
          </div>

          {/* Provider selection */}
          <div>
            <label style={S.label}>Database provider</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['mongodb', 'postgresql'] as DatabaseProvider[]).map(p => (
                <button
                  key={p}
                  type="button"
                  id={`dev-provider-${p}`}
                  onClick={() => {
                    setProvider(p)
                    setTestState({ status: 'idle', message: '' })
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1.5px solid ${provider === p ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: provider === p ? 'rgba(99,102,241,0.08)' : 'var(--bg-primary)',
                    color: provider === p ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                  }}
                >
                  <span>{p === 'mongodb' ? '🍃' : '🐘'}</span>
                  {p === 'mongodb' ? 'MongoDB' : 'PostgreSQL'}
                </button>
              ))}
            </div>
          </div>

          {/* Connection string + test */}
          <div>
            <label style={S.label} htmlFor="dev-connection">Connection string</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                id="dev-connection"
                type="text"
                value={connectionString}
                onChange={e => {
                  setConnectionString(e.target.value)
                  setTestState({ status: 'idle', message: '' })
                }}
                placeholder={placeholder}
                style={{ ...S.input, fontFamily: 'var(--font-family-mono)', fontSize: '12.5px' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
              />
              <button
                id="dev-test-connection"
                type="button"
                onClick={handleTestConnection}
                disabled={!connectionString.trim() || testState.status === 'testing'}
                style={{
                  flexShrink: 0,
                  padding: '11px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: !connectionString.trim() || testState.status === 'testing'
                    ? 'not-allowed' : 'pointer',
                  opacity: !connectionString.trim() ? 0.5 : 1,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {testState.status === 'testing' ? '⏳ Testing…' : 'Test'}
              </button>
            </div>

            {/* Test feedback */}
            {testState.status !== 'idle' && testState.status !== 'testing' && (
              <div style={{
                marginTop: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: testFeedbackBg,
                border: testFeedbackBorder,
                fontSize: '13px',
                color: testFeedbackColor,
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                {testState.status === 'success' ? '✓' : '✕'}
                {testState.message}
              </div>
            )}

            <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {provider === 'mongodb'
                ? 'Supports local MongoDB, MongoDB Atlas, or any compatible endpoint.'
                : 'Supports local PostgreSQL, Supabase, Neon, or any compatible PostgreSQL endpoint.'}
            </p>
          </div>

          <button
            id="dev-complete-setup"
            type="submit"
            disabled={!username.trim() || testState.status !== 'success' || loading}
            style={{
              ...S.primaryBtn,
              opacity: (!username.trim() || testState.status !== 'success' || loading) ? 0.45 : 1,
              cursor: (!username.trim() || testState.status !== 'success' || loading)
                ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Finalising setup…' : 'Complete Setup'}
          </button>
        </form>

        <button id="dev-back" onClick={onBack} style={S.ghostBtn}>
          ← Back
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Onboarding orchestrator
// ─────────────────────────────────────────────────────────────────────────────
export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('mode-select')

  const handleModeSelect = (selectedMode: StorageMode) => {
    setStep(selectedMode === 'managed' ? 'personal-nickname' : 'developer-setup')
  }

  if (step === 'mode-select') {
    return <ModeSelect onSelect={handleModeSelect} />
  }
  if (step === 'personal-nickname') {
    return <PersonalSetup onBack={() => setStep('mode-select')} onComplete={onComplete} />
  }
  return <DeveloperSetup onBack={() => setStep('mode-select')} onComplete={onComplete} />
}
