import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { RepoEngineView } from '@/components/repo-engine/RepoEngineView'
import type { RepoSession, RepoTask } from '@/lib/generated/prisma'

type PageProps = { params: Promise<{ id: string }> }

type SessionWithTasks = RepoSession & { repoTasks: RepoTask[] }

export default async function RepoEngineSessionPage({ params }: PageProps) {
  const { id } = await params
  const user = await requireUser()

  const session = await prisma.repoSession.findFirst({
    where: { id, userId: user.id },
    include: {
      repoTasks: {
        orderBy: [{ cycle: 'asc' }, { number: 'asc' }],
      },
    },
  })

  if (!session) {
    notFound()
  }

  return <RepoEngineView session={session as SessionWithTasks} />
}
