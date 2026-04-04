import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string; tid: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id, tid } = await params
    const user = await requireUser()

    // Verify session ownership
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

    const body = await request.json() as {
      action: string
      editedTitle?: string
      editedDescription?: string
      userNote?: string
    }
    const { action, editedTitle, editedDescription, userNote } = body

    if (action === 'approve') {
      const updated = await prisma.repoTask.update({
        where: { id: tid },
        data: {
          status: 'APPROVED',
          editedTitle: editedTitle ?? null,
          editedDescription: editedDescription ?? null,
          userNote: userNote ?? null,
        },
      })
      return Response.json({ task: updated })
    }

    if (action === 'reject') {
      const updated = await prisma.repoTask.update({
        where: { id: tid },
        data: {
          status: 'REJECTED',
          userNote: userNote ?? null,
        },
      })
      return Response.json({ task: updated })
    }

    if (action === 'edit') {
      const updated = await prisma.repoTask.update({
        where: { id: tid },
        data: {
          editedTitle: editedTitle ?? null,
          editedDescription: editedDescription ?? null,
          userNote: userNote ?? null,
        },
      })
      return Response.json({ task: updated })
    }

    if (action === 'revert') {
      const revertable = ['COMPLETED', 'FAILED', 'REJECTED', 'APPROVED']
      if (!revertable.includes(task.status)) {
        return Response.json({ error: `Cannot revert a task with status ${task.status}` }, { status: 400 })
      }
      const updated = await prisma.repoTask.update({
        where: { id: tid },
        data: {
          status: 'PENDING',
          executionLog: null,
          diff: null,
          commitHash: null,
          editedTitle: null,
          editedDescription: null,
        },
      })
      return Response.json({ task: updated })
    }

    return Response.json({ error: 'Invalid action. Use approve, reject, edit, or revert.' }, { status: 400 })
  } catch (err) {
    console.error('PATCH /api/repo-engine/[id]/tasks/[tid] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
