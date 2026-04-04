'use client'

import { useState, useEffect, useRef } from 'react'
import { Task } from '@/lib/generated/prisma'
import { TaskCard } from './TaskCard'
import { toast } from 'sonner'
import { Loader2, RefreshCw, CheckCheck } from 'lucide-react'

interface TaskListProps {
  companyId: string
  initialTasks: Task[]
}

const btnGold = {
  background: 'var(--caio-gold)',
  color: '#0F0F1A',
  border: 'none',
  borderRadius: 5,
  padding: '7px 16px',
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.05em',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
} as const

const btnGhost = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'var(--caio-text-secondary)',
  borderRadius: 5,
  padding: '7px 14px',
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 11,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
} as const

const sectionLabel = {
  fontFamily: 'var(--font-jetbrains)',
  fontSize: 9,
  color: 'var(--caio-text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: 10,
}

export function TaskList({ companyId, initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [generating, setGenerating] = useState(false)
  const [batchApproving, setBatchApproving] = useState(false)

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING_REVIEW')
  const executingTasks = tasks.filter((t) => t.status === 'EXECUTING')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const updateTask = (updated: Task) =>
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))

  const refreshTasks = async () => {
    const res = await fetch(`/api/companies/${companyId}/tasks`)
    const data = await res.json()
    if (data.tasks) setTasks(data.tasks)
  }

  // Auto-poll every 3s while any task is executing
  useEffect(() => {
    if (executingTasks.length > 0) {
      pollingRef.current = setInterval(refreshTasks, 3000)
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [executingTasks.length])

  const handleGenerateTasks = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/tasks`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to generate tasks'); return }
      toast.success(`Generated ${data.tasksGenerated} tasks`)
      const listRes = await fetch(`/api/companies/${companyId}/tasks`)
      const listData = await listRes.json()
      if (listData.tasks) setTasks(listData.tasks)
    } catch {
      toast.error('Network error')
    } finally {
      setGenerating(false)
    }
  }

  const handleBatchApprove = async () => {
    setBatchApproving(true)
    try {
      await Promise.all(
        pendingTasks.map((task) =>
          fetch(`/api/companies/${companyId}/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
          })
        )
      )
      setTasks((prev) =>
        prev.map((t) =>
          t.status === 'PENDING_REVIEW'
            ? { ...t, status: 'APPROVED' as Task['status'], approvedAt: new Date() }
            : t
        )
      )
      toast.success(`Approved ${pendingTasks.length} tasks`)
    } catch {
      toast.error('Failed to approve some tasks')
    } finally {
      setBatchApproving(false)
    }
  }

  const tasksByStatus = {
    PENDING_REVIEW: tasks.filter((t) => t.status === 'PENDING_REVIEW'),
    APPROVED:       tasks.filter((t) => t.status === 'APPROVED'),
    EXECUTING:      tasks.filter((t) => t.status === 'EXECUTING'),
    COMPLETED:      tasks.filter((t) => t.status === 'COMPLETED'),
    REJECTED:       tasks.filter((t) => t.status === 'REJECTED'),
    FAILED:         tasks.filter((t) => t.status === 'FAILED'),
  }

  const history = [...tasksByStatus.EXECUTING, ...tasksByStatus.COMPLETED, ...tasksByStatus.FAILED, ...tasksByStatus.REJECTED]

  // Empty state
  if (tasks.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[300px] rounded-xl gap-5"
        style={{ border: '1px dashed rgba(255,255,255,0.1)' }}
      >
        <div className="text-center">
          <div className="font-heading text-2xl mb-2" style={{ color: 'var(--caio-text)' }}>No tasks yet</div>
          <p className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)', lineHeight: 1.7 }}>
            Generate your first batch of 5 tasks.<br />Review and approve each one before the AI executes.
          </p>
        </div>
        <button onClick={handleGenerateTasks} disabled={generating} style={btnGold}>
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Generate 5 Tasks
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Executing banner */}
      {executingTasks.length > 0 && (
        <div
          className="flex items-center gap-3 rounded-lg px-4 py-3"
          style={{ background: 'rgba(200,169,110,0.06)', border: '1px solid rgba(200,169,110,0.2)', borderLeft: '3px solid var(--caio-gold)' }}
        >
          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: 'var(--caio-gold)' }} />
          <span className="font-mono text-xs" style={{ color: 'var(--caio-gold)' }}>
            AI is working on {executingTasks.length} task{executingTasks.length > 1 ? 's' : ''}... checking for updates every 3s
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="font-mono text-xs" style={{ color: 'var(--caio-text-muted)' }}>
          {pendingTasks.length} awaiting review
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {pendingTasks.length > 1 && (
            <button onClick={handleBatchApprove} disabled={batchApproving} style={{ ...btnGhost, borderColor: 'rgba(110,200,169,0.3)', color: '#6EC8A9' }}>
              {batchApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
              Approve All
            </button>
          )}
          <button onClick={handleGenerateTasks} disabled={generating} style={btnGold}>
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {generating ? 'Generating...' : '+ 5 Tasks'}
          </button>
        </div>
      </div>

      {/* Pending */}
      {tasksByStatus.PENDING_REVIEW.length > 0 && (
        <section>
          <div style={sectionLabel}>⚑ Pending Review ({tasksByStatus.PENDING_REVIEW.length})</div>
          {tasksByStatus.PENDING_REVIEW.map((task) => (
            <TaskCard key={task.id} task={task} companyId={companyId} onUpdate={updateTask} />
          ))}
        </section>
      )}

      {/* Approved */}
      {tasksByStatus.APPROVED.length > 0 && (
        <section>
          <div style={sectionLabel}>✓ Approved — ready to run ({tasksByStatus.APPROVED.length})</div>
          {tasksByStatus.APPROVED.map((task) => (
            <TaskCard key={task.id} task={task} companyId={companyId} onUpdate={updateTask} />
          ))}
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <div style={sectionLabel}>◎ History ({history.length})</div>
          {history.map((task) => (
            <TaskCard key={task.id} task={task} companyId={companyId} onUpdate={updateTask} />
          ))}
        </section>
      )}
    </div>
  )
}
