import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { TaskList } from '@/components/tasks/TaskList'
import Link from 'next/link'

export default async function TasksPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()

  const company = await prisma.company.findFirst({
    where: { id, userId: user.id },
  })

  if (!company) notFound()

  const tasks = await prisma.task.findMany({
    where: { companyId: id },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  const pending = tasks.filter((t) => t.status === 'PENDING_REVIEW').length

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <div className="mb-6">
        <Link
          href={`/companies/${id}`}
          className="font-mono text-xs"
          style={{ color: 'var(--caio-text-dim)', textDecoration: 'none' }}
        >
          ← back
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl mb-1" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>
            {company.name}
            <span style={{ color: 'var(--caio-text-muted)', fontWeight: 400 }}> — Tasks</span>
          </h1>
          <p className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>
            Review and approve tasks before AI executes them.
          </p>
        </div>
        {pending > 0 && (
          <span
            className="font-mono text-[10px] px-3 py-1 rounded"
            style={{
              color: 'var(--caio-gold)',
              background: 'rgba(200,169,110,0.08)',
              border: '1px solid rgba(200,169,110,0.25)',
            }}
          >
            ⚑ {pending} awaiting approval
          </span>
        )}
      </div>

      <TaskList companyId={id} initialTasks={tasks} />
    </div>
  )
}
