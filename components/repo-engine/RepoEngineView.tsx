'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Markdown } from '@/components/ui/markdown'
import type { RepoSession, RepoTask } from '@/lib/generated/prisma'

type SessionWithTasks = RepoSession & {
  repoTasks: RepoTask[]
  reviewContent?: string | null
  reviewStatus?: string
  reviewCycle?: number | null
}

interface RepoEngineViewProps {
  session: SessionWithTasks
}

// Priority color
const priorityColor = (priority: string) => {
  if (priority === 'high') return '#C86E6E'
  if (priority === 'low') return '#6677AA'
  return '#C8A96E' // medium
}

// Status badge
const statusBadge = (status: string) => {
  const map: Record<string, { label: string; color: string }> = {
    PENDING:   { label: '⚑ pending',   color: 'var(--caio-gold)' },
    APPROVED:  { label: '✓ approved',  color: '#6EC8A9' },
    REJECTED:  { label: '✗ rejected',  color: '#C86E6E' },
    EXECUTING: { label: '⏳ running',  color: 'var(--caio-gold)' },
    COMPLETED: { label: '✓ done',      color: '#6EC8A9' },
    FAILED:    { label: '✗ failed',    color: '#C86E6E' },
  }
  return map[status] ?? { label: status.toLowerCase(), color: 'var(--caio-text-muted)' }
}

// Button style helper
const btnStyle = (color: string): React.CSSProperties => ({
  background: 'transparent',
  border: `1px solid ${color}55`,
  color,
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 11,
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'all 0.15s',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
})

// ─── Log Panel ────────────────────────────────────────────────────────────────

function LogPanel({ logs, live }: { logs: string[]; live: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!live) return
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length, live])

  const lineColor = (line: string) => {
    if (line.startsWith('✗') || line.startsWith('⚠')) return '#C86E6E'
    if (line.startsWith('✓') || line.startsWith('↺')) return '#6EC8A9'
    if (line.startsWith('→') || line.startsWith('  ↑')) return '#6E9EC8'
    if (line.startsWith('✎')) return 'var(--caio-text-muted)'
    return 'var(--caio-text-dim)'
  }

  return (
    <div
      className="mt-2 rounded overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.25)' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
      >
        {live && <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: 'var(--caio-gold)' }} />}
        <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-muted)', letterSpacing: '0.08em' }}>
          {live ? 'LIVE LOG' : 'EXECUTION LOG'}
        </span>
      </div>
      <div ref={containerRef} className="px-3 py-2 overflow-y-auto" style={{ maxHeight: 200 }}>
        {logs.map((line, i) => (
          <div key={i} className="font-mono text-[10px] leading-relaxed" style={{ color: lineColor(line) }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function RepoTaskCard({
  task,
  sessionId,
  onUpdate,
}: {
  task: RepoTask
  sessionId: string
  onUpdate: (t: RepoTask) => void
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(
    task.status === 'PENDING' || task.status === 'APPROVED' || task.status === 'EXECUTING'
  )
  const [editTitle, setEditTitle] = useState(task.editedTitle ?? task.title)
  const [editDescription, setEditDescription] = useState(task.editedDescription ?? task.description)
  const [userNote, setUserNote] = useState(task.userNote ?? '')

  const isPending = task.status === 'PENDING'
  const isApproved = task.status === 'APPROVED'
  const isExecuting = task.status === 'EXECUTING'
  const isCompleted = task.status === 'COMPLETED'
  const isFailed = task.status === 'FAILED'
  const isRejected = task.status === 'REJECTED'
  const isCommitted = !!task.commitHash
  const pColor = priorityColor(task.priority)
  const badge = statusBadge(task.status)

  const patch = async (action: string, extra?: Record<string, string | null>) => {
    setLoading(action)
    try {
      const res = await fetch(`/api/repo-engine/${sessionId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userNote, ...extra }),
      })
      const data = await res.json() as { task?: RepoTask; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Action failed'); return }
      if (data.task) onUpdate(data.task)
      if (action === 'approve') toast.success('Task approved')
      if (action === 'reject') toast.success('Task rejected')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(null)
    }
  }

  const handleExecute = async () => {
    setLoading('execute')
    try {
      const res = await fetch(`/api/repo-engine/${sessionId}/tasks/${task.id}/execute`, { method: 'POST' })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to execute'); return }
      onUpdate({ ...task, status: 'EXECUTING' })
      toast.success('Task executing...')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(null)
    }
  }

  const handleCommit = async () => {
    setLoading('commit')
    try {
      const res = await fetch(`/api/repo-engine/${sessionId}/tasks/${task.id}/commit`, { method: 'POST' })
      const data = await res.json() as { task?: RepoTask; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Commit failed'); return }
      if (data.task) onUpdate(data.task)

      // Auto-push after commit
      const pushRes = await fetch(`/api/repo-engine/${sessionId}/push`, { method: 'POST' })
      const pushData = await pushRes.json() as { ok: boolean; error?: string }
      if (pushData.ok) {
        toast.success('Task committed and pushed!')
      } else {
        toast.success('Task committed')
        toast.error(`Push failed: ${pushData.error ?? 'unknown error'}`)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(null)
    }
  }

  const handleRollback = async () => {
    setLoading('rollback')
    try {
      const res = await fetch(`/api/repo-engine/${sessionId}/tasks/${task.id}/rollback`, { method: 'POST' })
      const data = await res.json() as { task?: RepoTask; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Rollback failed'); return }
      if (data.task) onUpdate(data.task)
      toast.success('Changes rolled back')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(null)
    }
  }

  const logs = task.executionLog ? task.executionLog.split('\n').filter(Boolean) : []

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4,
    color: 'var(--caio-text)',
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 11,
    padding: '6px 10px',
    outline: 'none',
  }

  return (
    <div
      className="rounded-md mb-2 animate-slide-up"
      style={{
        borderTop: isPending ? '1px solid rgba(200,169,110,0.17)' : '1px solid rgba(255,255,255,0.06)',
        borderRight: isPending ? '1px solid rgba(200,169,110,0.17)' : '1px solid rgba(255,255,255,0.06)',
        borderBottom: isPending ? '1px solid rgba(200,169,110,0.17)' : '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${pColor}`,
        background: isPending ? 'rgba(200,169,110,0.03)' : 'rgba(255,255,255,0.02)',
        padding: '12px 14px',
      }}
    >
      <div className="flex justify-between gap-3">
        {/* Left: content */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-muted)' }}>
              #{task.number}
            </span>
            <span
              className="font-mono text-[9px] px-1.5 py-px rounded"
              style={{ color: pColor, background: `${pColor}15`, border: `1px solid ${pColor}30` }}
            >
              {task.priority}
            </span>
            <span
              className="font-mono text-[9px] px-1.5 py-px rounded"
              style={{ color: badge.color, background: 'rgba(255,255,255,0.05)' }}
            >
              {badge.label}
            </span>
            {isCommitted && (
              <span
                className="font-mono text-[9px] px-1.5 py-px rounded"
                style={{ color: '#6EC8A9', background: 'rgba(110,200,169,0.1)', border: '1px solid rgba(110,200,169,0.25)' }}
              >
                ✓ committed
              </span>
            )}
            {task.estimate && (
              <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-dim)' }}>
                ~{task.estimate}
              </span>
            )}
          </div>

          {/* Title / edit */}
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={inputStyle}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'none' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { patch('edit', { editedTitle: editTitle, editedDescription: editDescription }); setEditing(false) }}
                  style={btnStyle('#6EC8A9')}
                >
                  Save
                </button>
                <button onClick={() => setEditing(false)} style={btnStyle('#8899BB')}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h3
                className="text-sm font-semibold mb-1 cursor-pointer"
                style={{ color: 'var(--caio-text)' }}
                onClick={() => setExpanded(!expanded)}
              >
                {task.editedTitle ?? task.title}
              </h3>
              {expanded && (
                <p
                  className="font-mono text-[11px] mb-2 whitespace-pre-wrap"
                  style={{ color: 'var(--caio-text-secondary)', lineHeight: 1.6 }}
                >
                  {task.editedDescription ?? task.description}
                </p>
              )}
              {expanded && task.affectedFiles && (
                <p className="font-mono text-[10px] mb-2" style={{ color: 'var(--caio-text-dim)' }}>
                  Files: {task.affectedFiles}
                </p>
              )}
            </>
          )}

          {/* User note input for pending/approved */}
          {expanded && (isPending || isApproved) && !editing && (
            <input
              type="text"
              placeholder="Add a note for the AI (optional)"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              style={{ ...inputStyle, marginTop: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          )}

          {/* Execution log */}
          {expanded && (isExecuting || isCompleted || isFailed) && logs.length > 0 && (
            <LogPanel logs={logs} live={isExecuting} />
          )}

          {/* Diff */}
          {expanded && isCompleted && !isCommitted && task.diff && task.diff.length > 0 && (
            <div
              className="mt-2 p-3 rounded overflow-auto"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', maxHeight: 200 }}
            >
              <div className="font-mono text-[9px] mb-1" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                git diff
              </div>
              <pre className="font-mono text-[10px] whitespace-pre-wrap" style={{ color: 'var(--caio-text-secondary)' }}>
                {task.diff.slice(0, 2000)}{task.diff.length > 2000 ? '\n...(truncated)' : ''}
              </pre>
            </div>
          )}

          {/* Commit hash */}
          {isCommitted && task.commitHash && expanded && (
            <div className="mt-2 font-mono text-[10px]" style={{ color: 'var(--caio-text-dim)' }}>
              commit: {task.commitHash.slice(0, 12)}
            </div>
          )}

          {/* Rejected note */}
          {isRejected && task.userNote && expanded && (
            <p className="font-mono text-[10px] mt-2" style={{ color: '#C86E6E' }}>
              Note: {task.userNote}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
          {isPending && !editing && (
            <>
              <button onClick={() => setEditing(true)} style={btnStyle('#8899BB')} title="Edit">✎</button>
              <button
                onClick={() => patch('reject')}
                disabled={!!loading}
                style={btnStyle('#C86E6E')}
              >
                {loading === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : '✗'}
              </button>
              <button
                onClick={() => patch('approve', { editedTitle: editTitle, editedDescription: editDescription })}
                disabled={!!loading}
                style={btnStyle('#6EC8A9')}
              >
                {loading === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'}
              </button>
            </>
          )}

          {isApproved && (
            <>
              <button
                onClick={handleExecute}
                disabled={!!loading}
                style={{ ...btnStyle('#C8A96E'), fontWeight: 600 }}
              >
                {loading === 'execute' ? <Loader2 className="w-3 h-3 animate-spin" /> : '⚡ Execute'}
              </button>
              <button
                onClick={() => patch('revert')}
                disabled={!!loading}
                style={btnStyle('#8899BB')}
                title="Revert to pending"
              >
                {loading === 'revert' ? <Loader2 className="w-3 h-3 animate-spin" /> : '↺'}
              </button>
            </>
          )}

          {isExecuting && (
            <span
              className="font-mono text-[10px] px-2 py-1 rounded flex items-center gap-1"
              style={{ color: 'var(--caio-gold)', border: '1px solid rgba(200,169,110,0.25)' }}
            >
              <Loader2 className="w-3 h-3 animate-spin" /> running
            </span>
          )}

          {isCompleted && !isCommitted && (
            <>
              <button
                onClick={handleCommit}
                disabled={!!loading}
                style={{ ...btnStyle('#6EC8A9'), fontWeight: 600 }}
              >
                {loading === 'commit' ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Commit'}
              </button>
              <button
                onClick={handleRollback}
                disabled={!!loading}
                style={btnStyle('#C86E6E')}
              >
                {loading === 'rollback' ? <Loader2 className="w-3 h-3 animate-spin" /> : '↺ Rollback'}
              </button>
            </>
          )}

          {isRejected && (
            <button
              onClick={() => patch('revert')}
              disabled={!!loading}
              style={btnStyle('#8899BB')}
              title="Revert to pending"
            >
              {loading === 'revert' ? <Loader2 className="w-3 h-3 animate-spin" /> : '↺'}
            </button>
          )}

          {(isFailed) && (
            <button
              onClick={() => patch('revert')}
              disabled={!!loading}
              style={btnStyle('#8899BB')}
              title="Revert to pending"
            >
              {loading === 'revert' ? <Loader2 className="w-3 h-3 animate-spin" /> : '↺'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function RepoEngineView({ session: initialSession }: RepoEngineViewProps) {
  const [session, setSession] = useState(initialSession)
  const [tasks, setTasks] = useState<RepoTask[]>(initialSession.repoTasks)
  const [contextExpanded, setContextExpanded] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [reviewExpanded, setReviewExpanded] = useState(false)
  const [generateContext, setGenerateContext] = useState('')
  const [generateFiles, setGenerateFiles] = useState('')
  const [generateCount, setGenerateCount] = useState(5)
  const [showGenerateContext, setShowGenerateContext] = useState(false)

  const isScanning = session.contextStatus === 'SCANNING' || session.contextStatus === 'PENDING'
  const anyExecuting = tasks.some((t) => t.status === 'EXECUTING')
  const isReviewing = session.reviewStatus === 'RUNNING'
  const shouldPoll = isScanning || anyExecuting || isReviewing

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/repo-engine/${session.id}`)
      if (!res.ok) return
      const data = await res.json() as { session?: SessionWithTasks }
      if (data.session) {
        setSession(data.session)
        setTasks(data.session.repoTasks)
      }
    } catch {
      // ignore
    }
  }, [session.id])

  useEffect(() => {
    if (!shouldPoll) return
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [shouldPoll, poll])

  const handleRescan = async () => {
    setLoadingAction('scan')
    try {
      const res = await fetch(`/api/repo-engine/${session.id}/scan`, { method: 'POST' })
      if (!res.ok) { toast.error('Failed to start scan'); return }
      setSession((s) => ({ ...s, contextStatus: 'SCANNING' }))
      toast.success('Re-scanning repository...')
    } catch {
      toast.error('Network error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleGenerate = async () => {
    setLoadingAction('generate')
    try {
      const contextFiles = generateFiles.split(',').map((f) => f.trim()).filter(Boolean)
      const res = await fetch(`/api/repo-engine/${session.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userContext: generateContext, contextFiles, taskCount: generateCount }),
      })
      const data = await res.json() as { ok?: boolean; currentCycle?: number; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to generate tasks'); return }
      setSession((s) => ({ ...s, contextStatus: 'SCANNING', currentCycle: data.currentCycle ?? s.currentCycle }))
      setGenerateContext('')
      setGenerateFiles('')
      setShowGenerateContext(false)
      toast.success('Generating new cycle of tasks...')
    } catch {
      toast.error('Network error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleReview = async () => {
    setLoadingAction('review')
    try {
      const res = await fetch(`/api/repo-engine/${session.id}/review`, { method: 'POST' })
      if (!res.ok) { toast.error('Failed to start review'); return }
      setSession((s) => ({ ...s, reviewStatus: 'RUNNING' }))
      setReviewExpanded(true)
      toast.success('Code review running with Opus 4.6...')
    } catch {
      toast.error('Network error')
    } finally {
      setLoadingAction(null)
    }
  }

  const updateTask = (updated: RepoTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  const currentCycleTasks = tasks.filter((t) => t.cycle === session.currentCycle)
  const committedTasks = tasks.filter((t) => !!t.commitHash)

  const statusColor = session.contextStatus === 'READY' ? '#6EC8A9'
    : session.contextStatus === 'ERROR' ? '#C86E6E'
    : 'var(--caio-gold)'

  const statusLabel = {
    PENDING: 'Pending scan...',
    SCANNING: 'Scanning...',
    READY: 'Ready',
    ERROR: 'Error',
  }[session.contextStatus] ?? session.contextStatus

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>
            <span style={{ color: 'var(--caio-gold)' }}>⊕</span>{' '}
            {session.repoName}
          </h1>
          <p className="font-mono text-[10px] mt-1" style={{ color: 'var(--caio-text-dim)' }}>
            {session.repoPath}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span
              className="font-mono text-[9px] px-2 py-px rounded"
              style={{ color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}
            >
              {isScanning && <Loader2 className="w-2.5 h-2.5 animate-spin inline mr-1" />}
              {statusLabel}
            </span>
            <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-dim)' }}>
              Cycle {session.currentCycle}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGenerateContext((v) => !v)}
              disabled={!!loadingAction || isScanning}
              title="Add context for next cycle"
              style={{
                ...btnStyle('var(--caio-text-muted)'),
                fontSize: 10,
                opacity: isScanning || loadingAction ? 0.5 : 1,
              }}
            >
              {showGenerateContext ? '▲ context' : '▼ context'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={!!loadingAction || isScanning}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: isScanning || loadingAction ? 'rgba(200,169,110,0.1)' : 'var(--caio-gold)',
                color: isScanning || loadingAction ? 'var(--caio-gold)' : '#0F0F1A',
                border: isScanning || loadingAction ? '1px solid rgba(200,169,110,0.3)' : 'none',
                borderRadius: 5,
                padding: '7px 14px',
                fontFamily: 'var(--font-jetbrains)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                cursor: isScanning || loadingAction ? 'not-allowed' : 'pointer',
              }}
            >
              {loadingAction === 'generate' ? <Loader2 className="w-3 h-3 animate-spin" /> : '⟳'}
              Generate Next Cycle
            </button>
          </div>
          {showGenerateContext && (
            <div className="flex flex-col gap-2" style={{ width: 320 }}>
              <textarea
                value={generateContext}
                onChange={(e) => setGenerateContext(e.target.value)}
                placeholder="Optional: focus area, constraints, or instructions for this cycle…"
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 5,
                  color: 'var(--caio-text)',
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: 11,
                  padding: '8px 10px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <div className="flex gap-2">
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                    Context files (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={generateFiles}
                    onChange={(e) => setGenerateFiles(e.target.value)}
                    placeholder="e.g. REVIEW.md, SPEC.md"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 5,
                      color: 'var(--caio-text)',
                      fontFamily: 'var(--font-jetbrains)',
                      fontSize: 11,
                      padding: '7px 10px',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ width: 64 }}>
                  <label style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 9, color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                    Tasks
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={generateCount}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      if (!isNaN(n)) setGenerateCount(Math.min(20, Math.max(1, n)))
                    }}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 5,
                      color: 'var(--caio-text)',
                      fontFamily: 'var(--font-jetbrains)',
                      fontSize: 11,
                      padding: '7px 10px',
                      outline: 'none',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context panel */}
      <div
        className="rounded-md"
        style={{ border: '1px solid var(--caio-border)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer"
          style={{ borderBottom: contextExpanded ? '1px solid var(--caio-border)' : 'none' }}
          onClick={() => setContextExpanded(!contextExpanded)}
        >
          <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Project Context
            {isScanning && (
              <span className="ml-2">
                <Loader2 className="w-2.5 h-2.5 animate-spin inline" style={{ color: 'var(--caio-gold)' }} />
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleRescan() }}
              disabled={!!loadingAction || isScanning}
              style={{
                ...btnStyle('var(--caio-text-muted)'),
                fontSize: 10,
              }}
            >
              {loadingAction === 'scan' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '↺ Re-scan'}
            </button>
            <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-dim)' }}>
              {contextExpanded ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {contextExpanded && (
          <div className="p-4">
            {isScanning ? (
              <div className="flex items-center gap-2" style={{ color: 'var(--caio-text-muted)' }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--caio-gold)' }} />
                <span className="font-mono text-xs">Scanning repository...</span>
              </div>
            ) : session.contextSummary ? (
              <div className="prose-sm">
                <Markdown content={session.contextSummary} />
              </div>
            ) : (
              <p className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>
                No context summary yet. Click Re-scan to analyze the repository.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tasks panel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Cycle {session.currentCycle} — {currentCycleTasks.length} task{currentCycleTasks.length !== 1 ? 's' : ''}
          </span>
          {isScanning && (
            <span className="font-mono text-[10px] flex items-center gap-1" style={{ color: 'var(--caio-gold)' }}>
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Generating tasks...
            </span>
          )}
        </div>

        {currentCycleTasks.length === 0 && !isScanning ? (
          <div
            className="flex flex-col items-center justify-center py-12 rounded-md gap-3"
            style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
          >
            <p className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>
              No tasks yet. Click "Generate Next Cycle" to create 5 tasks.
            </p>
          </div>
        ) : (
          <div>
            {currentCycleTasks.map((task) => (
              <RepoTaskCard
                key={task.id}
                task={task}
                sessionId={session.id}
                onUpdate={updateTask}
              />
            ))}
          </div>
        )}

        {/* Previous cycles */}
        {(() => {
          const olderTasks = tasks.filter((t) => t.cycle < session.currentCycle && !!t.commitHash)
          if (olderTasks.length === 0) return null
          return (
            <details className="mt-4">
              <summary
                className="font-mono text-[10px] cursor-pointer"
                style={{ color: 'var(--caio-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                Previous cycles ({olderTasks.length} tasks)
              </summary>
              <div className="mt-2">
                {olderTasks.map((task) => (
                  <RepoTaskCard
                    key={task.id}
                    task={task}
                    sessionId={session.id}
                    onUpdate={updateTask}
                  />
                ))}
              </div>
            </details>
          )
        })()}
      </div>

      {/* Code Review panel */}
      <div
        className="rounded-md"
        style={{ border: '1px solid rgba(147,112,219,0.25)', background: 'rgba(147,112,219,0.04)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer"
          style={{ borderBottom: reviewExpanded ? '1px solid rgba(147,112,219,0.15)' : 'none' }}
          onClick={() => setReviewExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: '#9370DB', fontSize: 13 }}>◈</span>
            <span className="font-mono text-[10px]" style={{ color: '#9370DB', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Cycle Review
            </span>
            <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-dim)' }}>
              — Opus 4.6
            </span>
            {session.reviewCycle != null && session.reviewStatus === 'DONE' && (
              <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-dim)' }}>
                — last run on cycle {session.reviewCycle}
              </span>
            )}
            {isReviewing && (
              <span className="flex items-center gap-1 font-mono text-[9px]" style={{ color: '#9370DB' }}>
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> analyzing...
              </span>
            )}
            {session.reviewStatus === 'ERROR' && (
              <span className="font-mono text-[9px]" style={{ color: '#C86E6E' }}>✗ error</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleReview() }}
              disabled={!!loadingAction || isReviewing || isScanning}
              style={{
                ...btnStyle('#9370DB'),
                fontWeight: 600,
                opacity: (isReviewing || isScanning) ? 0.5 : 1,
                cursor: (isReviewing || isScanning) ? 'not-allowed' : 'pointer',
              }}
            >
              {isReviewing || loadingAction === 'review'
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Running...</>
                : session.reviewStatus === 'DONE' ? '↺ Re-run Review' : '▶ Run Review'}
            </button>
            <span className="font-mono text-[10px]" style={{ color: 'var(--caio-text-dim)' }}>
              {reviewExpanded ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {reviewExpanded && (
          <>
            {(isReviewing || session.reviewStatus === 'ERROR' || session.reviewStatus === 'DONE') && session.reviewLog && (
              <div
                className="mx-4 mt-3 mb-3 rounded overflow-hidden"
                style={{ border: '1px solid rgba(147,112,219,0.15)', background: 'rgba(0,0,0,0.2)' }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5"
                  style={{ borderBottom: '1px solid rgba(147,112,219,0.1)', background: 'rgba(147,112,219,0.05)' }}
                >
                  {isReviewing && <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: '#9370DB' }} />}
                  <span className="font-mono text-[9px]" style={{ color: '#9370DB', letterSpacing: '0.08em' }}>
                    {isReviewing ? 'LIVE LOG' : 'REVIEW LOG'}
                  </span>
                </div>
                <div className="px-3 py-2 overflow-y-auto" style={{ maxHeight: 160 }}>
                  {session.reviewLog.split('\n').filter(Boolean).map((line, i) => {
                    const color = line.startsWith('✗') ? '#C86E6E'
                      : line.startsWith('✓') ? '#6EC8A9'
                      : line.startsWith('→') ? '#6E9EC8'
                      : line.startsWith('✎') ? 'var(--caio-text-muted)'
                      : '#9370DB'
                    return (
                      <div key={i} className="font-mono text-[10px] leading-relaxed" style={{ color }}>
                        {line}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {session.reviewStatus === 'DONE' && session.reviewContent && (
              <div className="px-4 pb-4">
                <div className="prose-sm">
                  <Markdown content={session.reviewContent} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions bar */}
      {committedTasks.length > 0 && (
        <div
          className="flex items-center justify-between p-4 rounded-md"
          style={{ border: '1px solid rgba(110,200,169,0.15)', background: 'rgba(110,200,169,0.04)' }}
        >
          <p className="font-mono text-xs" style={{ color: '#6EC8A9' }}>
            ✓ {committedTasks.length} task{committedTasks.length !== 1 ? 's' : ''} committed &amp; pushed
          </p>
        </div>
      )}
    </div>
  )
}
