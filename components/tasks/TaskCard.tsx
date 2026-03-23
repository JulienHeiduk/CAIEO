'use client'

import { useState } from 'react'
import { Task } from '@/lib/generated/prisma'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface TaskCardProps {
  task: Task
  companyId: string
  onUpdate: (task: Task) => void
}

// Maps agent type to CAIO department color (left border)
const agentDeptColor: Record<string, string> = {
  COMPANY_INIT:     '#C8A96E', // strategy — gold
  LANDING_PAGE:     '#6EC8A9', // dev — green
  API_SCAFFOLD:     '#6EC8A9', // dev — green
  LINKEDIN_POST:    '#6E9EC8', // outreach — blue
  TWITTER_POST:     '#6E9EC8',
  REDDIT_POST:      '#6E9EC8',
  HACKERNEWS_POST:  '#6E9EC8',
  KAGGLE_POST:      '#C86E6E', // ops — red
  GROWTH_MARKETING: '#A96EC8', // marketing — purple
}

const agentLabel: Record<string, string> = {
  COMPANY_INIT:     'strategy',
  LANDING_PAGE:     'engineering',
  API_SCAFFOLD:     'engineering',
  LINKEDIN_POST:    'outreach',
  TWITTER_POST:     'outreach',
  REDDIT_POST:      'outreach',
  HACKERNEWS_POST:  'outreach',
  KAGGLE_POST:      'ops & data',
  GROWTH_MARKETING: 'marketing',
}

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'approval',
  APPROVED:       'approved',
  REJECTED:       'rejected',
  EXECUTING:      'executing',
  COMPLETED:      'completed',
  FAILED:         'failed',
}

export function TaskCard({ task, companyId, onUpdate }: TaskCardProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(task.status === 'PENDING_REVIEW')
  const [editTitle, setEditTitle] = useState(task.editedTitle ?? task.title)
  const [editDescription, setEditDescription] = useState(task.editedDescription ?? task.description)
  const [userNote, setUserNote] = useState(task.userNote ?? '')

  const isPending  = task.status === 'PENDING_REVIEW'
  const isApproved = task.status === 'APPROVED'
  const isActed    = task.status === 'APPROVED' || task.status === 'REJECTED'

  const deptColor = agentDeptColor[task.agentType] ?? '#8899BB'
  const dept      = agentLabel[task.agentType] ?? task.agentType.toLowerCase().replace(/_/g, ' ')

  const patchTask = async (action: string, extra?: Record<string, string>) => {
    setLoading(action)
    try {
      const res = await fetch(`/api/companies/${companyId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userNote, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Action failed'); return }
      onUpdate(data.task)
      if (action === 'approve') toast.success('Task approved')
      if (action === 'reject')  toast.success('Task rejected')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(null)
    }
  }

  const handleSaveEdit = async () => {
    await patchTask('edit', { editedTitle: editTitle, editedDescription: editDescription })
    setEditing(false)
  }

  const handleApprove = () =>
    patchTask('approve', {
      editedTitle:       editTitle !== task.title ? editTitle : '',
      editedDescription: editDescription !== task.description ? editDescription : '',
    })

  const handleExecute = async () => {
    setLoading('execute')
    try {
      const res = await fetch(`/api/companies/${companyId}/tasks/${task.id}/execute`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to execute'); return }
      onUpdate({ ...task, status: 'EXECUTING' as Task['status'] })
      toast.success('Task queued for execution')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(null)
    }
  }

  const btnStyle = (color: string) => ({
    background: 'transparent',
    border: `1px solid ${color}55`,
    color,
    fontFamily: 'var(--font-jetbrains)',
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  return (
    <div
      className="rounded-md mb-2 animate-slide-up"
      style={{
        border: isPending ? `1px solid rgba(200,169,110,0.17)` : '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${deptColor}`,
        background: isPending ? 'rgba(200,169,110,0.03)' : 'rgba(255,255,255,0.02)',
        padding: '12px 14px',
      }}
    >
      <div className="flex justify-between gap-3">
        {/* Left: content */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className="font-mono text-[9px]"
              style={{ color: deptColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              {dept}
            </span>
            <span
              className="font-mono text-[9px] px-1.5 py-px rounded"
              style={{
                color: 'var(--caio-text-dim)',
                background: 'rgba(255,255,255,0.06)',
              }}
            >
              p{task.priority}
            </span>
            {isPending && (
              <span
                className="font-mono text-[9px] px-1.5 py-px rounded"
                style={{
                  color: 'var(--caio-gold)',
                  background: 'rgba(200,169,110,0.1)',
                }}
              >
                ⚑ approval
              </span>
            )}
            {!isPending && (
              <span
                className="font-mono text-[9px] px-1.5 py-px rounded"
                style={{
                  color: task.status === 'COMPLETED' ? '#6EC8A9'
                       : task.status === 'REJECTED'  ? '#C86E6E'
                       : task.status === 'FAILED'    ? '#C86E6E'
                       : 'var(--caio-text-muted)',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                {statusLabel[task.status] ?? task.status.toLowerCase()}
              </span>
            )}
          </div>

          {/* Title / edit */}
          {editing ? (
            <div className="flex flex-col gap-2">
              <Input
                value={editTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--caio-text)',
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: 12,
                }}
              />
              <Textarea
                value={editDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditDescription(e.target.value)}
                rows={3}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--caio-text)',
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: 11,
                  resize: 'none',
                }}
              />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} style={btnStyle('#6EC8A9')}>Save</button>
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
            </>
          )}

          {/* Note input */}
          {expanded && isPending && !editing && (
            <Input
              placeholder="Add a note for the AI (optional)"
              value={userNote}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserNote(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--caio-text-secondary)',
                fontFamily: 'var(--font-jetbrains)',
                fontSize: 11,
                marginTop: 6,
              }}
            />
          )}

          {/* Result */}
          {task.status === 'COMPLETED' && task.result && expanded && (
            <div
              className="mt-3 p-3 rounded font-mono text-[10px]"
              style={{ background: 'rgba(110,200,169,0.06)', border: '1px solid rgba(110,200,169,0.15)', color: '#6EC8A9' }}
            >
              <pre className="whitespace-pre-wrap overflow-auto max-h-28">
                {JSON.stringify(task.result, null, 2)}
              </pre>
            </div>
          )}

          {task.errorMessage && expanded && (
            <p className="font-mono text-[10px] mt-2" style={{ color: '#C86E6E' }}>
              ✗ {task.errorMessage}
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
          {isPending && !editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                style={btnStyle('#8899BB')}
                title="Edit"
              >
                ✎
              </button>
              <button
                onClick={() => patchTask('reject')}
                disabled={!!loading}
                style={btnStyle('#C86E6E')}
              >
                {loading === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : '✗'}
              </button>
              <button
                onClick={handleApprove}
                disabled={!!loading}
                style={btnStyle('#6EC8A9')}
              >
                {loading === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'}
              </button>
            </>
          )}

          {isApproved && (
            <button
              onClick={handleExecute}
              disabled={!!loading}
              style={{
                ...btnStyle('#C8A96E'),
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {loading === 'execute'
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : '⚡ Run'}
            </button>
          )}

          {isActed && task.status !== 'APPROVED' && (
            <span
              className="font-mono text-[10px] px-2 py-1 rounded"
              style={{
                color: task.status === 'REJECTED' ? '#C86E6E' : '#6EC8A9',
                border: `1px solid ${task.status === 'REJECTED' ? '#C86E6E44' : '#6EC8A944'}`,
              }}
            >
              {task.status === 'REJECTED' ? '✗' : '✓'}
            </span>
          )}

          {(task.status === 'EXECUTING' || task.status === 'COMPLETED') && (
            <span
              className="font-mono text-[10px] px-2 py-1 rounded"
              style={{ color: 'var(--caio-gold)', border: '1px solid rgba(200,169,110,0.25)' }}
            >
              ⚡
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
