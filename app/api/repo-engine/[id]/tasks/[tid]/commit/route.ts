import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { commitRepoTask } from '@/lib/repo-engine'

type RouteContext = { params: Promise<{ id: string; tid: string }> }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id, tid } = await params
    const user = await requireUser()

    const session = await prisma.repoSession.findFirst({
      where: { id, userId: user.id },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    const task = await prisma.repoTask.findFirst({
      where: { id: tid, sessionId: id },
    })

    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.status !== 'COMPLETED') {
      return Response.json({ error: `Task must be COMPLETED to commit (current: ${task.status})` }, { status: 400 })
    }

    if (task.commitHash) {
      return Response.json({ error: 'Task already committed' }, { status: 400 })
    }

    await commitRepoTask(tid)

    const updated = await prisma.repoTask.findUniqueOrThrow({ where: { id: tid } })
    return Response.json({ task: updated })
  } catch (err) {
    console.error('POST /api/repo-engine/[id]/tasks/[tid]/commit error:', err)
    return Response.json({ error: String((err as Error).message) }, { status: 500 })
  }
}
