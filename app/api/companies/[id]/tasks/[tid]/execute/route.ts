import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tasks } from '@trigger.dev/sdk/v3'
import { executeTaskJob } from '@/jobs/execute-task'
import { TaskStatus } from '@/lib/generated/prisma'

type RouteContext = { params: Promise<{ id: string; tid: string }> }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id, tid } = await params
    const user = await requireUser()

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

    if (task.status !== TaskStatus.APPROVED) {
      return Response.json(
        { error: `Task must be APPROVED before execution (current: ${task.status})` },
        { status: 400 }
      )
    }

    // Trigger execution job
    const handle = await tasks.trigger<typeof executeTaskJob>('execute-task', { taskId: tid })

    return Response.json({ success: true, triggerId: handle.id })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST execute error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
