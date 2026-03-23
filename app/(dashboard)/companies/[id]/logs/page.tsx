import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ActivityFeed } from '@/components/logs/ActivityFeed'
import Link from 'next/link'

export default async function LogsPage({
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

  const logs = await prisma.activityLog.findMany({
    where: { companyId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

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

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <span className="font-mono text-xs" style={{ color: 'var(--caio-text-dim)' }}>◎</span>
        <h1 className="font-heading text-2xl" style={{ color: 'var(--caio-text)', fontWeight: 700 }}>
          {company.name}
          <span style={{ color: 'var(--caio-text-muted)', fontWeight: 400 }}> — Activity Log</span>
        </h1>
      </div>
      <p className="font-mono text-xs mb-6" style={{ color: 'var(--caio-text-dim)' }}>
        Full history of AI actions and events.
      </p>

      {/* Terminal header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-t-md"
        style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="rounded-full inline-block" style={{ width: 8, height: 8, background: '#C86E6E' }} />
        <span className="rounded-full inline-block" style={{ width: 8, height: 8, background: '#C8A96E' }} />
        <span className="rounded-full inline-block" style={{ width: 8, height: 8, background: '#6EC8A9' }} />
        <span className="font-mono text-[9px] ml-2" style={{ color: 'var(--caio-text-dim)' }}>
          {company.name}.log
        </span>
      </div>
      <div
        className="rounded-b-md p-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none' }}
      >
        <ActivityFeed logs={logs} />
      </div>
    </div>
  )
}
