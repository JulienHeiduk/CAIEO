'use client'

import { useState } from 'react'
import { Task } from '@/lib/generated/prisma'
import { TaskCard } from './TaskCard'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCheck, RefreshCw } from 'lucide-react'

interface TaskListProps {
  companyId: string
  initialTasks: Task[]
}

export function TaskList({ companyId, initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [generating, setGenerating] = useState(false)
  const [batchApproving, setBatchApproving] = useState(false)

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING_REVIEW')

  const updateTask = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  const handleGenerateTasks = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/tasks`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to generate tasks')
        return
      }
      toast.success(`Generated ${data.tasksGenerated} new tasks`)
      // Refresh task list
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
    APPROVED: tasks.filter((t) => t.status === 'APPROVED'),
    EXECUTING: tasks.filter((t) => t.status === 'EXECUTING'),
    COMPLETED: tasks.filter((t) => t.status === 'COMPLETED'),
    REJECTED: tasks.filter((t) => t.status === 'REJECTED'),
    FAILED: tasks.filter((t) => t.status === 'FAILED'),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">
          {pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''} awaiting review
        </p>
        <div className="flex gap-2">
          {pendingTasks.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchApprove}
              disabled={batchApproving}
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Approve All
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateTasks}
            disabled={generating}
            className="border-slate-700 text-slate-300"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            Generate Tasks
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-700 rounded-xl">
          <p className="text-slate-400 mb-4">No tasks yet. Generate your daily task plan.</p>
          <Button
            onClick={handleGenerateTasks}
            disabled={generating}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Generate Tasks
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {tasksByStatus.PENDING_REVIEW.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                Pending Review ({tasksByStatus.PENDING_REVIEW.length})
              </h2>
              <div className="space-y-3">
                {tasksByStatus.PENDING_REVIEW.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    companyId={companyId}
                    onUpdate={updateTask}
                  />
                ))}
              </div>
            </section>
          )}

          {tasksByStatus.APPROVED.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                Approved ({tasksByStatus.APPROVED.length})
              </h2>
              <div className="space-y-3">
                {tasksByStatus.APPROVED.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    companyId={companyId}
                    onUpdate={updateTask}
                  />
                ))}
              </div>
            </section>
          )}

          {(tasksByStatus.EXECUTING.length > 0 || tasksByStatus.COMPLETED.length > 0 || tasksByStatus.FAILED.length > 0) && (
            <section>
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                History
              </h2>
              <div className="space-y-3">
                {[...tasksByStatus.EXECUTING, ...tasksByStatus.COMPLETED, ...tasksByStatus.FAILED, ...tasksByStatus.REJECTED].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    companyId={companyId}
                    onUpdate={updateTask}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
