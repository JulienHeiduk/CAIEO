import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeRepoTask } from '@/lib/repo-engine'

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

    if (task.status !== 'APPROVED') {
      return Response.json({ error: `Task must be APPROVED (current: ${task.status})` }, { status: 400 })
    }

    // Mark as EXECUTING immediately
    await prisma.repoTask.update({
      where: { id: tid },
      data: { status: 'EXECUTING' },
    })

    // Fire in background
    executeRepoTask(tid).catch(console.error)

    return Response.json({ success: true })
  } catch (err) {
    console.error('POST /api/repo-engine/[id]/tasks/[tid]/execute error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
