import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@/lib/generated/prisma'

type RouteContext = { params: Promise<{ id: string; tid: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id, tid } = await params
    const user = await requireUser()

    // Verify company ownership
    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
    })

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    const task = await prisma.task.findFirst({
      where: { id: tid, companyId: id },
    })

    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 })
    }

    const body = await request.json()
    const { action, editedTitle, editedDescription, userNote } = body

    if (action === 'approve') {
      const updated = await prisma.task.update({
        where: { id: tid },
        data: {
          status: TaskStatus.APPROVED,
          approvedAt: new Date(),
          editedTitle: editedTitle ?? null,
          editedDescription: editedDescription ?? null,
          userNote: userNote ?? null,
        },
      })
      return Response.json({ task: updated })
    }

    if (action === 'reject') {
      const updated = await prisma.task.update({
        where: { id: tid },
        data: {
          status: TaskStatus.REJECTED,
          userNote: userNote ?? null,
        },
      })
      return Response.json({ task: updated })
    }

    if (action === 'edit') {
      const updated = await prisma.task.update({
        where: { id: tid },
        data: {
          editedTitle: editedTitle ?? null,
          editedDescription: editedDescription ?? null,
          userNote: userNote ?? null,
        },
      })
      return Response.json({ task: updated })
    }

    return Response.json({ error: 'Invalid action. Use approve, reject, or edit.' }, { status: 400 })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
