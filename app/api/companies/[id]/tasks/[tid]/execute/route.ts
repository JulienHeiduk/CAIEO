import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@/lib/generated/prisma'
import { runTask } from '@/lib/task-runner'

type RouteContext = { params: Promise<{ id: string; tid: string }> }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id, tid } = await params
    const user = await requireUser()

    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
    })
    if (!company) return Response.json({ error: 'Company not found' }, { status: 404 })

    const task = await prisma.task.findFirst({ where: { id: tid, companyId: id } })
    if (!task) return Response.json({ error: 'Task not found' }, { status: 404 })
    if (task.status !== TaskStatus.APPROVED) {
      return Response.json({ error: `Task must be APPROVED (current: ${task.status})` }, { status: 400 })
    }

    // Mark as EXECUTING immediately
    await prisma.task.update({ where: { id: tid }, data: { status: TaskStatus.EXECUTING } })

    // Run agent in background
    runTask({ company, task: { ...task, status: TaskStatus.EXECUTING } }).catch(console.error)

    return Response.json({ success: true })
  } catch (err) {
    console.error('POST execute error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
