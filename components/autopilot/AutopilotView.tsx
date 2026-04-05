'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AutopilotRun {
  id: string
  currentStep: number
  stepStatus: string
  stepError: string | null
  emailSubject: string | null
  ideaRaw: string | null
  isValidSoftware: boolean | null
  validationNote: string | null
  companyId: string | null
  companyName: string | null
  tasksGenerated: number | null
  tasksCompleted: number
  tasksTotal: number
  currentTaskId: string | null
  stopRequested: boolean
  logs: string[]
  triggerType: string
  createdAt: string
}

interface Company {
  id: string
  name: string
  status: string
}

const STEPS = [
  { num: 1, label: 'Gmail Fetch' },
  { num: 2, label: 'Validate' },
  { num: 3, label: 'Create Company' },
  { num: 4, label: 'Bootstrap Repo' },
  { num: 5, label: 'Generate Tasks' },
  { num: 6, label: 'Execute Tasks' },
]

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--caio-border)',
  background: 'rgba(255,255,255,0.02)',
  borderRadius: 12,
  padding: 24,
}

const goldBtnStyle: React.CSSProperties = {
  background: 'var(--caio-gold)',
  color: '#0F0F1A',
  border: 'none',
  borderRadius: 6,
  padding: '10px 20px',
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--caio-border)',
  color: 'var(--caio-text-secondary)',
  borderRadius: 6,
  padding: '10px 20px',
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const stopBtnStyle: React.CSSProperties = {
  background: '#C86E6E',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '10px 20px',
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

// ─── Step Bar Component ─────────────────────────────────────────────────────

function StepBar({ run }: { run: AutopilotRun }) {
  const startStep = run.triggerType === 'DAILY_CYCLE' ? 5 : 1
  const steps = STEPS.filter((s) => s.num >= startStep)

  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, i) => {
        let color = 'rgba(255,255,255,0.15)'
        let textColor = 'var(--caio-text-dim)'

        if (step.num < run.currentStep) {
          color = '#6EC8A9'
          textColor = '#6EC8A9'
        } else if (step.num === run.currentStep) {
          if (run.stepStatus === 'RUNNING') {
            color = 'var(--caio-gold)'
            textColor = 'var(--caio-gold)'
          } else if (run.stepStatus === 'FAILED') {
            color = '#C86E6E'
            textColor = '#C86E6E'
          } else if (run.stepStatus === 'STOPPED') {
            color = '#C8A96E'
            textColor = '#C8A96E'
          } else if (run.stepStatus === 'COMPLETED') {
            color = '#6EC8A9'
            textColor = '#6EC8A9'
          }
        }

        const isActive = step.num === run.currentStep && run.stepStatus === 'RUNNING'

        return (
          <div key={step.num} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold ${isActive ? 'animate-pulse' : ''}`}
                style={{ border: `2px solid ${color}`, color: textColor }}
              >
                {step.num < run.currentStep ? '✓' : step.num === 6 && run.currentStep === 6 ? `${run.tasksCompleted}/${run.tasksTotal}` : step.num}
              </div>
              <span className="font-mono text-[9px]" style={{ color: textColor }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-8 h-px mb-4"
                style={{ background: step.num < run.currentStep ? '#6EC8A9' : 'rgba(255,255,255,0.1)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Log Panel ──────────────────────────────────────────────────────────────

function LogPanel({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  if (logs.length === 0) return null

  return (
    <div
      className="rounded-md p-3 mt-4 max-h-60 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <p className="font-mono text-[9px] mb-2" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Live Log
      </p>
      {logs.map((line, i) => (
        <p key={i} className="font-mono text-[10px] leading-relaxed" style={{ color: 'var(--caio-text-dim)' }}>
          {line}
        </p>
      ))}
      <div ref={endRef} />
    </div>
  )
}

// ─── Step Detail ────────────────────────────────────────────────────────────

function StepDetail({ run, onRetry, retrying }: { run: AutopilotRun; onRetry?: () => void; retrying?: boolean }) {
  if (run.stepStatus === 'FAILED') {
    return (
      <div className="rounded-md p-4 mt-4" style={{ background: 'rgba(200,110,110,0.1)', border: '1px solid rgba(200,110,110,0.3)' }}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold" style={{ color: '#C86E6E' }}>Pipeline Failed</p>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="font-mono text-[10px] font-bold px-3 py-1 rounded"
              style={{ background: 'var(--caio-gold)', color: '#0F0F1A', border: 'none', cursor: retrying ? 'not-allowed' : 'pointer', opacity: retrying ? 0.5 : 1 }}
            >
              {retrying ? '...' : '↻ Retry'}
            </button>
          )}
        </div>
        <p className="font-mono text-[11px] mt-1" style={{ color: 'var(--caio-text-dim)' }}>{run.stepError}</p>
        {run.validationNote && !run.isValidSoftware && (
          <p className="font-mono text-[11px] mt-2" style={{ color: '#C86E6E' }}>
            Reason: {run.validationNote}
          </p>
        )}
      </div>
    )
  }

  if (run.stepStatus === 'STOPPED') {
    return (
      <div className="rounded-md p-4 mt-4" style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)' }}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold" style={{ color: 'var(--caio-gold)' }}>Pipeline Stopped</p>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={retrying}
              className="font-mono text-[10px] font-bold px-3 py-1 rounded"
              style={{ background: 'var(--caio-gold)', color: '#0F0F1A', border: 'none', cursor: retrying ? 'not-allowed' : 'pointer', opacity: retrying ? 0.5 : 1 }}
            >
              {retrying ? '...' : '↻ Resume'}
            </button>
          )}
        </div>
        <p className="font-mono text-[11px] mt-1" style={{ color: 'var(--caio-text-dim)' }}>
          Completed {run.tasksCompleted}/{run.tasksTotal} tasks before stopping.
        </p>
      </div>
    )
  }

  if (run.stepStatus === 'COMPLETED') {
    return (
      <div className="rounded-md p-4 mt-4" style={{ background: 'rgba(110,200,169,0.1)', border: '1px solid rgba(110,200,169,0.3)' }}>
        <p className="font-mono text-xs font-bold" style={{ color: '#6EC8A9' }}>Pipeline Completed</p>
        {run.companyName && (
          <p className="font-mono text-[11px] mt-1" style={{ color: 'var(--caio-text-dim)' }}>
            Company: <a href={`/companies/${run.companyId}`} style={{ color: 'var(--caio-gold)', textDecoration: 'underline' }}>{run.companyName}</a>
          </p>
        )}
        <p className="font-mono text-[11px] mt-1" style={{ color: 'var(--caio-text-dim)' }}>
          {run.tasksCompleted}/{run.tasksTotal} tasks executed
        </p>
      </div>
    )
  }

  // Running state — show current step info
  return (
    <div className="mt-4 space-y-2">
      {run.emailSubject && (
        <p className="font-mono text-[11px]" style={{ color: 'var(--caio-text-dim)' }}>
          Email: <span style={{ color: 'var(--caio-text)' }}>{run.emailSubject}</span>
        </p>
      )}
      {run.ideaRaw && run.currentStep >= 2 && (
        <p className="font-mono text-[11px]" style={{ color: 'var(--caio-text-dim)' }}>
          Idea: <span style={{ color: 'var(--caio-text)' }}>{run.ideaRaw.slice(0, 150)}{run.ideaRaw.length > 150 ? '...' : ''}</span>
        </p>
      )}
      {run.isValidSoftware !== null && run.currentStep >= 3 && (
        <p className="font-mono text-[11px]" style={{ color: run.isValidSoftware ? '#6EC8A9' : '#C86E6E' }}>
          {run.isValidSoftware ? '✓ Software idea' : '✗ Hardware idea'} — {run.validationNote}
        </p>
      )}
      {run.companyName && run.currentStep >= 4 && (
        <p className="font-mono text-[11px]" style={{ color: 'var(--caio-text-dim)' }}>
          Company: <span style={{ color: 'var(--caio-gold)' }}>{run.companyName}</span>
        </p>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AutopilotView({ initialRuns, companies }: { initialRuns: AutopilotRun[]; companies: Company[] }) {
  const router = useRouter()
  const [runs, setRuns] = useState<AutopilotRun[]>(initialRuns)
  const [activeRunId, setActiveRunId] = useState<string | null>(
    initialRuns.find((r) => r.stepStatus === 'RUNNING')?.id ?? null
  )
  const [activeRun, setActiveRun] = useState<AutopilotRun | null>(
    initialRuns.find((r) => r.stepStatus === 'RUNNING') ?? null
  )
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [dailyCompanyId, setDailyCompanyId] = useState(companies[0]?.id ?? '')
  const [manualIdea, setManualIdea] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  // Poll active run
  useEffect(() => {
    if (!activeRunId) return
    if (activeRun && !['RUNNING'].includes(activeRun.stepStatus)) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/autopilot/${activeRunId}`)
        if (res.ok) {
          const data = await res.json()
          setActiveRun(data)
          if (['COMPLETED', 'FAILED', 'STOPPED'].includes(data.stepStatus)) {
            router.refresh()
          }
        }
      } catch { /* ignore */ }
    }, 2000)

    return () => clearInterval(interval)
  }, [activeRunId, activeRun?.stepStatus, router])

  const startPipeline = async (idea?: string) => {
    setStarting(true)
    try {
      const body = idea ? { idea } : {}
      const res = await fetch('/api/autopilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        toast.error('Failed to start autopilot')
        return
      }
      const data = await res.json()
      setActiveRunId(data.id)
      setActiveRun({
        id: data.id, currentStep: idea ? 2 : 1, stepStatus: 'RUNNING', stepError: null,
        emailSubject: null, ideaRaw: idea ?? null, isValidSoftware: null, validationNote: null,
        companyId: null, companyName: null, tasksGenerated: null,
        tasksCompleted: 0, tasksTotal: 0, currentTaskId: null,
        stopRequested: false, logs: [], triggerType: 'MANUAL', createdAt: new Date().toISOString(),
      })
      toast.success(idea ? 'Autopilot started — validating idea...' : 'Autopilot started — fetching idea from Gmail...')
      if (idea) setManualIdea('')
    } catch {
      toast.error('Network error')
    } finally {
      setStarting(false)
    }
  }

  const startDailyCycle = async () => {
    if (!dailyCompanyId) return
    setStarting(true)
    try {
      const res = await fetch('/api/autopilot/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: dailyCompanyId }),
      })
      if (!res.ok) {
        toast.error('Failed to start daily cycle')
        return
      }
      const data = await res.json()
      const comp = companies.find((c) => c.id === dailyCompanyId)
      setActiveRunId(data.id)
      setActiveRun({
        id: data.id, currentStep: 5, stepStatus: 'RUNNING', stepError: null,
        emailSubject: null, ideaRaw: null, isValidSoftware: true, validationNote: null,
        companyId: dailyCompanyId, companyName: comp?.name ?? null, tasksGenerated: null,
        tasksCompleted: 0, tasksTotal: 0, currentTaskId: null,
        stopRequested: false, logs: [], triggerType: 'DAILY_CYCLE', createdAt: new Date().toISOString(),
      })
      toast.success(`Daily cycle started for ${comp?.name}`)
    } catch {
      toast.error('Network error')
    } finally {
      setStarting(false)
    }
  }

  const stopPipeline = async () => {
    if (!activeRunId) return
    setStopping(true)
    try {
      await fetch(`/api/autopilot/${activeRunId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      toast.success('Stop requested — will halt after current task')
    } catch {
      toast.error('Failed to stop')
    } finally {
      setStopping(false)
    }
  }

  const retryRun = async () => {
    if (!activeRunId) return
    setRetrying(true)
    try {
      const res = await fetch(`/api/autopilot/${activeRunId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })
      if (res.ok) {
        setActiveRun((prev) => prev ? { ...prev, stepStatus: 'RUNNING', stepError: null, stopRequested: false } : null)
        toast.success('Retrying from failed step...')
      } else {
        toast.error('Failed to retry')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setRetrying(false)
    }
  }

  const deleteRun = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/autopilot/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRuns((prev) => prev.filter((r) => r.id !== id))
        if (activeRunId === id) { setActiveRunId(null); setActiveRun(null) }
        toast.success('Run deleted')
      } else {
        toast.error('Failed to delete run')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setDeletingId(null)
    }
  }

  const isRunning = activeRun?.stepStatus === 'RUNNING'

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>
            <span style={{ color: 'var(--caio-gold)' }}>⚡</span> Autopilot
          </h1>
          <p className="font-mono text-xs mt-2" style={{ color: 'var(--caio-text-muted)', letterSpacing: '0.03em' }}>
            Autonomous company creation from Gmail ideas
          </p>
        </div>
      </div>

      {/* Controls */}
      <div style={cardStyle} className="mb-6">
        {/* Manual idea input */}
        <div className="mb-4">
          <label className="font-mono text-[10px] block mb-2" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Startup Idea
          </label>
          <textarea
            value={manualIdea}
            onChange={(e) => setManualIdea(e.target.value)}
            placeholder="Describe your startup idea... or use the Gmail button below to fetch it automatically"
            rows={3}
            disabled={isRunning}
            className="w-full font-mono text-xs rounded-md px-3 py-2 resize-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--caio-border)',
              color: 'var(--caio-text)',
              outline: 'none',
              opacity: isRunning ? 0.5 : 1,
            }}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Launch from manual idea */}
          <button
            onClick={() => startPipeline(manualIdea)}
            disabled={starting || isRunning || manualIdea.trim().length < 10}
            style={{ ...goldBtnStyle, opacity: starting || isRunning || manualIdea.trim().length < 10 ? 0.5 : 1, cursor: starting || isRunning || manualIdea.trim().length < 10 ? 'not-allowed' : 'pointer' }}
          >
            {starting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Launch Autopilot
          </button>

          {/* Gmail pipeline */}
          <button
            onClick={() => startPipeline()}
            disabled={starting || isRunning}
            style={{ ...ghostBtnStyle, opacity: starting || isRunning ? 0.5 : 1, cursor: starting || isRunning ? 'not-allowed' : 'pointer' }}
          >
            Fetch from Gmail
          </button>

          {/* Daily cycle */}
          {companies.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={dailyCompanyId}
                onChange={(e) => setDailyCompanyId(e.target.value)}
                className="font-mono text-[11px] rounded-md px-2 py-2"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--caio-border)',
                  color: 'var(--caio-text)',
                  outline: 'none',
                }}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={startDailyCycle}
                disabled={starting || isRunning || !dailyCompanyId}
                style={{ ...ghostBtnStyle, opacity: starting || isRunning ? 0.5 : 1, cursor: starting || isRunning ? 'not-allowed' : 'pointer' }}
              >
                Run Daily Cycle
              </button>
            </div>
          )}

          {/* Stop */}
          {isRunning && (
            <button
              onClick={stopPipeline}
              disabled={stopping}
              style={stopBtnStyle}
            >
              {stopping ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Active Run */}
      {activeRun && (
        <div style={cardStyle} className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-xs font-semibold" style={{ color: 'var(--caio-gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {activeRun.triggerType === 'DAILY_CYCLE' ? 'Daily Cycle' : 'Full Pipeline'}
            </h2>
            <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-dim)' }}>
              {new Date(activeRun.createdAt).toLocaleString()}
            </span>
          </div>

          <StepBar run={activeRun} />
          <StepDetail run={activeRun} onRetry={retryRun} retrying={retrying} />
          <LogPanel logs={activeRun.logs} />
        </div>
      )}

      {/* Past Runs */}
      {runs.length > 0 && (
        <div>
          <h2 className="font-mono text-xs font-semibold mb-4" style={{ color: 'var(--caio-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            History ({runs.length})
          </h2>
          <div className="flex flex-col gap-2">
            {runs
              .filter((r) => r.id !== activeRunId)
              .map((run) => {
                const statusColor = run.stepStatus === 'COMPLETED' ? '#6EC8A9' : run.stepStatus === 'FAILED' ? '#C86E6E' : run.stepStatus === 'STOPPED' ? '#C8A96E' : 'var(--caio-text-dim)'
                return (
                  <div
                    key={run.id}
                    className="rounded-md px-4 py-3 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ border: '1px solid var(--caio-border)', background: 'rgba(255,255,255,0.02)' }}
                    onClick={() => { setActiveRunId(run.id); setActiveRun(run) }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="font-mono text-[9px] px-1.5 py-px rounded"
                          style={{ color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}
                        >
                          {run.stepStatus}
                        </span>
                        <span className="font-mono text-xs" style={{ color: 'var(--caio-text)' }}>
                          {run.companyName ?? run.ideaRaw?.slice(0, 50) ?? run.triggerType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px]" style={{ color: 'var(--caio-text-dim)' }}>
                          {new Date(run.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteRun(run.id) }}
                          disabled={deletingId === run.id}
                          className="font-mono text-[9px] px-1.5 py-px rounded hover:opacity-80 transition-opacity"
                          style={{ color: '#C86E6E', background: 'rgba(200,110,110,0.1)', border: '1px solid rgba(200,110,110,0.2)', cursor: deletingId === run.id ? 'not-allowed' : 'pointer', opacity: deletingId === run.id ? 0.5 : 1 }}
                        >
                          {deletingId === run.id ? '...' : '✕'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
