'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'GENERATING' | 'REVIEW' | 'EXECUTING' | 'DONE' | 'ERROR' | 'CANCELLED'

interface BootstrapSession {
  id: string
  idea: string
  repoName: string
  visibility: string
  localPath: string
  currentStep: number
  stepStatus: StepStatus
  stepError: string | null
  description: string | null
  repoUrl: string | null
  repoFullName: string | null
  clonedPath: string | null
  readmeContent: string | null
  changelogContent: string | null
  tasksContent: string | null
}

// ─── Step config ─────────────────────────────────────────────────────────────

const STEP_TITLES = [
  'Repository',
  'Clone',
  'README',
  'Changelog',
  'Tasks',
  'Commit',
]

const STEP_DESCRIPTIONS = [
  'Review AI-generated repository name and description',
  'Review the local destination path before cloning',
  'Review and edit the generated README.md',
  'Review and edit the generated CHANGELOG.md',
  'Review and edit the generated TASKS.md',
  'Final review — confirm commit and push to GitHub',
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    padding: '2rem',
    maxWidth: '900px',
    margin: '0 auto',
  } as React.CSSProperties,

  title: {
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--caio-text)',
    marginBottom: 4,
  } as React.CSSProperties,

  subtitle: {
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 11,
    color: 'var(--caio-text-muted)',
    letterSpacing: '0.05em',
    marginBottom: 32,
  } as React.CSSProperties,

  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--caio-border)',
    borderRadius: 8,
    padding: '28px 32px',
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--caio-text-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  } as React.CSSProperties,

  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--caio-border)',
    borderRadius: 5,
    padding: '9px 12px',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 12,
    color: 'var(--caio-text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--caio-border)',
    borderRadius: 5,
    padding: '9px 12px',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 11,
    color: 'var(--caio-text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    minHeight: 180,
    lineHeight: 1.6,
  } as React.CSSProperties,

  select: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--caio-border)',
    borderRadius: 5,
    padding: '9px 12px',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 12,
    color: 'var(--caio-text)',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  goldBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--caio-gold)',
    color: '#0F0F1A',
    border: 'none',
    borderRadius: 5,
    padding: '9px 20px',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    cursor: 'pointer',
  } as React.CSSProperties,

  ghostBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--caio-text-secondary)',
    border: '1px solid var(--caio-border)',
    borderRadius: 5,
    padding: '9px 20px',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
    cursor: 'pointer',
  } as React.CSSProperties,

  disabledBtn: {
    opacity: 0.45,
    cursor: 'not-allowed',
  } as React.CSSProperties,

  fieldRow: {
    marginBottom: 18,
  } as React.CSSProperties,
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function StepBar({ current, status }: { current: number; status: StepStatus }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {STEP_TITLES.map((title, i) => {
        const step = i + 1
        const isDone = step < current || (step === current && status === 'DONE')
        const isCurrent = step === current && status !== 'DONE'
        const isError = step === current && status === 'ERROR'

        const circleColor = isError
          ? 'var(--caio-red)'
          : isDone
            ? 'var(--caio-green)'
            : isCurrent
              ? 'var(--caio-gold)'
              : 'var(--caio-border)'

        const textColor = isError
          ? 'var(--caio-red)'
          : isDone
            ? 'var(--caio-green)'
            : isCurrent
              ? 'var(--caio-gold)'
              : 'var(--caio-text-dim)'

        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: step < 6 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `2px solid ${circleColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: isCurrent || isDone || isError ? circleColor : 'var(--caio-text-dim)',
                  background: isCurrent ? 'rgba(200,169,110,0.1)' : isDone ? 'rgba(110,200,169,0.1)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                {isDone ? '✓' : isError ? '✗' : step}
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: 9,
                  color: textColor,
                  marginTop: 4,
                  letterSpacing: '0.05em',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </span>
            </div>
            {step < 6 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: isDone ? 'var(--caio-green)' : 'var(--caio-border)',
                  marginBottom: 18,
                  transition: 'background 0.2s',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0' }}>
      <div
        style={{
          width: 14,
          height: 14,
          border: '2px solid rgba(200,169,110,0.2)',
          borderTop: '2px solid var(--caio-gold)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--caio-text-muted)' }}>
        {label}
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Input form ───────────────────────────────────────────────────────────────

function BootstrapForm({ onStart }: { onStart: (id: string) => void }) {
  const [idea, setIdea] = useState('')
  const [repoName, setRepoName] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [localPath, setLocalPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!idea.trim()) { setError('Please describe your project idea.'); return }
    if (!localPath.trim()) { setError('Please provide a local path for cloning.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/github-bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, repoName: repoName || undefined, visibility, localPath }),
      })
      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok || !data.id) throw new Error(data.error ?? 'Failed to start bootstrap')
      onStart(data.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.card}>
      <h2 style={{ ...s.title, marginBottom: 6 }}>Bootstrap a GitHub Project</h2>
      <p style={s.subtitle}>
        Describe your idea — CAIO will generate the repo, README, CHANGELOG, and TASKS.md.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={s.fieldRow}>
          <label style={s.label}>Project Idea *</label>
          <textarea
            style={{ ...s.textarea, minHeight: 80 }}
            placeholder="e.g. A CLI tool that converts Markdown files to PDFs using a custom template engine"
            value={idea}
            onChange={e => setIdea(e.target.value)}
            disabled={loading}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
          <div>
            <label style={s.label}>Repo Name (optional)</label>
            <input
              style={s.input}
              placeholder="auto-generated if empty"
              value={repoName}
              onChange={e => setRepoName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label style={s.label}>Visibility</label>
            <select
              style={{ ...s.select, width: '100%' }}
              value={visibility}
              onChange={e => setVisibility(e.target.value)}
              disabled={loading}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>
        </div>

        <div style={s.fieldRow}>
          <label style={s.label}>Local Path *</label>
          <input
            style={s.input}
            placeholder={`C:\\Users\\...\\projects`}
            value={localPath}
            onChange={e => setLocalPath(e.target.value)}
            disabled={loading}
          />
          <p style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 10, color: 'var(--caio-text-dim)', marginTop: 5 }}>
            Parent directory — the repo folder will be created inside it.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(200,110,110,0.1)',
            border: '1px solid rgba(200,110,110,0.3)',
            borderRadius: 5,
            padding: '10px 14px',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            color: 'var(--caio-red)',
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{ ...s.goldBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
        >
          {loading ? '⟳ Starting…' : '⌥ Bootstrap Project'}
        </button>
      </form>
    </div>
  )
}

// ─── Step content viewers/editors ────────────────────────────────────────────

function Step1Content({
  session,
  onApprove,
  onCancel,
  loading,
}: {
  session: BootstrapSession
  onApprove: (content: { repoName: string; description: string; visibility: string }) => void
  onCancel: () => void
  loading: boolean
}) {
  const [repoName, setRepoName] = useState(session.repoName ?? '')
  const [description, setDescription] = useState(session.description ?? '')
  const [visibility, setVisibility] = useState(session.visibility ?? 'private')

  // Sync when session updates
  const prevRepoName = useRef(session.repoName)
  const prevDesc = useRef(session.description)
  useEffect(() => {
    if (session.repoName !== prevRepoName.current) {
      setRepoName(session.repoName ?? '')
      prevRepoName.current = session.repoName
    }
    if (session.description !== prevDesc.current) {
      setDescription(session.description ?? '')
      prevDesc.current = session.description
    }
  }, [session.repoName, session.description])

  return (
    <div>
      <div style={s.fieldRow}>
        <label style={s.label}>Repository Name</label>
        <input
          style={s.input}
          value={repoName}
          onChange={e => setRepoName(e.target.value)}
          disabled={loading}
        />
      </div>
      <div style={s.fieldRow}>
        <label style={s.label}>Description</label>
        <input
          style={s.input}
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
        />
      </div>
      <div style={{ ...s.fieldRow, marginBottom: 24 }}>
        <label style={s.label}>Visibility</label>
        <select
          style={s.select}
          value={visibility}
          onChange={e => setVisibility(e.target.value)}
          disabled={loading}
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          style={{ ...s.goldBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
          onClick={() => onApprove({ repoName, description, visibility })}
        >
          ✅ Approve & Create Repo
        </button>
        <button
          style={{ ...s.ghostBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
          onClick={onCancel}
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  )
}

function Step2Content({
  session,
  onApprove,
  onCancel,
  loading,
}: {
  session: BootstrapSession
  onApprove: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--caio-border)',
            borderRadius: 5,
            padding: '14px 16px',
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <span style={s.label}>GitHub Repo</span>
            <a
              href={session.repoUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--caio-blue)', textDecoration: 'none' }}
            >
              {session.repoUrl ?? '…'}
            </a>
          </div>
          <div>
            <span style={s.label}>Will clone to</span>
            <code style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--caio-text)' }}>
              {session.localPath}/{session.repoName}
            </code>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          style={{ ...s.goldBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
          onClick={onApprove}
        >
          ✅ Approve & Clone
        </button>
        <button
          style={{ ...s.ghostBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
          onClick={onCancel}
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  )
}

function TextEditorStep({
  label,
  value,
  onChange,
  onApprove,
  onCancel,
  loading,
  approveLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onApprove: () => void
  onCancel: () => void
  loading: boolean
  approveLabel: string
}) {
  const [preview, setPreview] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={s.label}>{label}</span>
        <button
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 10,
            color: 'var(--caio-text-muted)',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
          onClick={() => setPreview(p => !p)}
        >
          {preview ? '✎ EDIT' : '◎ PREVIEW'}
        </button>
      </div>

      {preview ? (
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--caio-border)',
            borderRadius: 5,
            padding: '14px 16px',
            minHeight: 180,
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 11,
            color: 'var(--caio-text)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            marginBottom: 16,
            overflowY: 'auto',
            maxHeight: 400,
          }}
        >
          {value || <span style={{ color: 'var(--caio-text-dim)' }}>(empty)</span>}
        </div>
      ) : (
        <textarea
          style={{ ...s.textarea, marginBottom: 16 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={loading}
        />
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          style={{ ...s.goldBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
          onClick={onApprove}
        >
          ✅ {approveLabel}
        </button>
        <button
          style={{ ...s.ghostBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
          onClick={onCancel}
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  )
}

function Step6Content({
  session,
  onApprove,
  onCancel,
  loading,
}: {
  session: BootstrapSession
  onApprove: () => void
  onCancel: () => void
  loading: boolean
}) {
  const commitMsg = `feat: initialisation du projet — ${session.repoName}\n\nGénéré automatiquement par Chief AI Officer.\n\n- README.md avec description et roadmap\n- CHANGELOG.md (Keep a Changelog)\n- TASKS.md avec 5 tâches initiales`

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <span style={s.label}>Files to commit</span>
        {['README.md', 'CHANGELOG.md', 'TASKS.md'].map(f => (
          <div
            key={f}
            style={{
              fontFamily: 'var(--font-jetbrains)',
              fontSize: 11,
              color: 'var(--caio-green)',
              padding: '3px 0',
            }}
          >
            + {f}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <span style={s.label}>Commit message</span>
        <pre
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--caio-border)',
            borderRadius: 5,
            padding: '12px 14px',
            fontFamily: 'var(--font-jetbrains)',
            fontSize: 10,
            color: 'var(--caio-text)',
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}
        >
          {commitMsg}
        </pre>
      </div>

      <div style={{ marginBottom: 20 }}>
        <span style={s.label}>Push to</span>
        <a
          href={session.repoUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--caio-blue)', textDecoration: 'none' }}
        >
          {session.repoUrl ?? '…'}
        </a>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          style={{ ...s.goldBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
          onClick={onApprove}
        >
          ✅ Commit & Push
        </button>
        <button
          style={{ ...s.ghostBtn, ...(loading ? s.disabledBtn : {}) }}
          disabled={loading}
          onClick={onCancel}
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Done state ───────────────────────────────────────────────────────────────

function DoneCard({ session, onReset }: { session: BootstrapSession; onReset: () => void }) {
  return (
    <div style={{
      ...s.card,
      borderColor: 'rgba(110,200,169,0.3)',
      background: 'rgba(110,200,169,0.05)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <h2 style={{ ...s.title, color: 'var(--caio-green)', marginBottom: 8 }}>Project bootstrapped!</h2>
      <p style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--caio-text-muted)', marginBottom: 20 }}>
        {session.repoName} has been created, cloned, and pushed.
      </p>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <a
          href={session.repoUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...s.goldBtn,
            textDecoration: 'none',
            background: 'rgba(110,200,169,0.15)',
            color: 'var(--caio-green)',
          }}
        >
          ⌥ View on GitHub
        </a>
        <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--caio-text-muted)', display: 'flex', alignItems: 'center' }}>
          📁 {session.clonedPath}
        </div>
      </div>

      <button style={s.ghostBtn} onClick={onReset}>
        + Bootstrap Another Project
      </button>
    </div>
  )
}

// ─── Cancelled state ──────────────────────────────────────────────────────────

function CancelledCard({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ ...s.card, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 10, color: 'var(--caio-text-dim)' }}>✗</div>
      <p style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 12, color: 'var(--caio-text-muted)', marginBottom: 20 }}>
        Bootstrap cancelled.
      </p>
      <button style={s.ghostBtn} onClick={onReset}>
        Start Over
      </button>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

function WizardView({ sessionId, onReset }: { sessionId: string; onReset: () => void }) {
  const [session, setSession] = useState<BootstrapSession | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Editable content state (local edits before approval)
  const [readmeEdit, setReadmeEdit] = useState('')
  const [changelogEdit, setChangelogEdit] = useState('')
  const [tasksEdit, setTasksEdit] = useState('')

  // Polling
  useEffect(() => {
    if (!sessionId) return
    if (
      session &&
      (session.stepStatus === 'REVIEW' ||
        session.stepStatus === 'DONE' ||
        session.stepStatus === 'ERROR' ||
        session.stepStatus === 'CANCELLED')
    ) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/github-bootstrap/${sessionId}`)
        const data = await res.json() as BootstrapSession
        setSession(data)
      } catch {
        // ignore transient errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionId, session])

  // Initial load
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/github-bootstrap/${sessionId}`)
      .then(r => r.json())
      .then((data: BootstrapSession) => {
        setSession(data)
        setReadmeEdit(data.readmeContent ?? '')
        setChangelogEdit(data.changelogContent ?? '')
        setTasksEdit(data.tasksContent ?? '')
      })
      .catch(console.error)
  }, [sessionId])

  // Sync editable fields when session content arrives
  useEffect(() => {
    if (!session) return
    if (session.readmeContent && !readmeEdit) setReadmeEdit(session.readmeContent)
    if (session.changelogContent && !changelogEdit) setChangelogEdit(session.changelogContent)
    if (session.tasksContent && !tasksEdit) setTasksEdit(session.tasksContent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.readmeContent, session?.changelogContent, session?.tasksContent])

  async function approve(content?: Record<string, string>) {
    if (!session) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/github-bootstrap/${session.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', content }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!data.ok) throw new Error(data.error ?? 'Action failed')
      // Immediately update local state to EXECUTING so spinner shows
      setSession(s => s ? { ...s, stepStatus: 'EXECUTING' } : s)
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  async function cancel() {
    if (!session) return
    setActionLoading(true)
    try {
      await fetch(`/api/github-bootstrap/${session.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      setSession(s => s ? { ...s, stepStatus: 'CANCELLED' } : s)
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  if (!session) {
    return <Spinner label="Loading session…" />
  }

  const { currentStep, stepStatus } = session
  const isWorking = stepStatus === 'GENERATING' || stepStatus === 'EXECUTING' || actionLoading

  if (stepStatus === 'DONE') {
    return (
      <>
        <StepBar current={currentStep} status={stepStatus} />
        <DoneCard session={session} onReset={onReset} />
      </>
    )
  }

  if (stepStatus === 'CANCELLED') {
    return <CancelledCard onReset={onReset} />
  }

  const stepTitle = STEP_TITLES[currentStep - 1] ?? `Step ${currentStep}`
  const stepDesc = STEP_DESCRIPTIONS[currentStep - 1] ?? ''

  return (
    <>
      <StepBar current={currentStep} status={stepStatus} />

      <div style={s.card}>
        {/* Step header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains)',
                fontSize: 10,
                color: 'var(--caio-gold)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              STEP {currentStep} / 6
            </span>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains)',
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 3,
                background:
                  stepStatus === 'ERROR'
                    ? 'rgba(200,110,110,0.15)'
                    : stepStatus === 'REVIEW'
                      ? 'rgba(200,169,110,0.15)'
                      : 'rgba(255,255,255,0.06)',
                color:
                  stepStatus === 'ERROR'
                    ? 'var(--caio-red)'
                    : stepStatus === 'REVIEW'
                      ? 'var(--caio-gold)'
                      : 'var(--caio-text-muted)',
              }}
            >
              {stepStatus}
            </span>
          </div>
          <h2 style={{ ...s.title, marginBottom: 4 }}>{stepTitle}</h2>
          <p style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 11, color: 'var(--caio-text-muted)' }}>
            {stepDesc}
          </p>
        </div>

        {/* Content */}
        {isWorking && (
          <Spinner
            label={
              stepStatus === 'GENERATING'
                ? 'AI is generating…'
                : stepStatus === 'EXECUTING'
                  ? `Executing step ${currentStep}…`
                  : 'Processing…'
            }
          />
        )}

        {stepStatus === 'ERROR' && (
          <div
            style={{
              background: 'rgba(200,110,110,0.08)',
              border: '1px solid rgba(200,110,110,0.25)',
              borderRadius: 5,
              padding: '12px 14px',
              fontFamily: 'var(--font-jetbrains)',
              fontSize: 11,
              color: 'var(--caio-red)',
              marginBottom: 16,
            }}
          >
            <strong>Error:</strong> {session.stepError ?? 'Unknown error'}
          </div>
        )}

        {(stepStatus === 'REVIEW' || stepStatus === 'ERROR') && !isWorking && (
          <>
            {currentStep === 1 && (
              <Step1Content
                session={session}
                onApprove={(content) => approve(content)}
                onCancel={cancel}
                loading={actionLoading}
              />
            )}
            {currentStep === 2 && (
              <Step2Content
                session={session}
                onApprove={() => approve()}
                onCancel={cancel}
                loading={actionLoading}
              />
            )}
            {currentStep === 3 && (
              <TextEditorStep
                label="README.md"
                value={readmeEdit}
                onChange={setReadmeEdit}
                onApprove={() => approve({ readmeContent: readmeEdit })}
                onCancel={cancel}
                loading={actionLoading}
                approveLabel="Approve README"
              />
            )}
            {currentStep === 4 && (
              <TextEditorStep
                label="CHANGELOG.md"
                value={changelogEdit}
                onChange={setChangelogEdit}
                onApprove={() => approve({ changelogContent: changelogEdit })}
                onCancel={cancel}
                loading={actionLoading}
                approveLabel="Approve CHANGELOG"
              />
            )}
            {currentStep === 5 && (
              <TextEditorStep
                label="TASKS.md"
                value={tasksEdit}
                onChange={setTasksEdit}
                onApprove={() => approve({ tasksContent: tasksEdit })}
                onCancel={cancel}
                loading={actionLoading}
                approveLabel="Approve Tasks"
              />
            )}
            {currentStep === 6 && (
              <Step6Content
                session={session}
                onApprove={() => approve()}
                onCancel={cancel}
                loading={actionLoading}
              />
            )}

            {/* Error retry / cancel */}
            {stepStatus === 'ERROR' && (
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button
                  style={{ ...s.goldBtn, ...(actionLoading ? s.disabledBtn : {}) }}
                  disabled={actionLoading}
                  onClick={() => approve()}
                >
                  ↺ Retry
                </button>
                <button
                  style={{ ...s.ghostBtn, ...(actionLoading ? s.disabledBtn : {}) }}
                  disabled={actionLoading}
                  onClick={cancel}
                >
                  ❌ Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function BootstrapWizard() {
  const [mode, setMode] = useState<'form' | 'wizard'>('form')
  const [sessionId, setSessionId] = useState<string | null>(null)

  function handleStart(id: string) {
    setSessionId(id)
    setMode('wizard')
  }

  function handleReset() {
    setSessionId(null)
    setMode('form')
  }

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ ...s.title, fontSize: 26, marginBottom: 4 }}>
          <span style={{ color: 'var(--caio-gold)' }}>⌥</span> Bootstrap Repo
        </h1>
        <p style={s.subtitle}>
          6-step wizard — idea → GitHub repo → clone → README → CHANGELOG → TASKS.md → push
        </p>
      </div>

      {mode === 'form' && <BootstrapForm onStart={handleStart} />}
      {mode === 'wizard' && sessionId && (
        <WizardView sessionId={sessionId} onReset={handleReset} />
      )}
    </div>
  )
}
