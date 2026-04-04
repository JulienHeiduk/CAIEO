import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCycleTasks } from '@/lib/repo-engine'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const session = await prisma.repoSession.findFirst({
      where: { id, userId: user.id },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({})) as { userContext?: string; contextFiles?: string[]; taskCount?: number }
    const userContext = body.userContext?.trim() || null
    const contextFiles = body.contextFiles?.filter(Boolean) ?? []
    const taskCount = Math.min(Math.max(Number(body.taskCount) || 5, 1), 20)

    const updatedSession = await prisma.repoSession.update({
      where: { id },
      data: {
        contextStatus: 'SCANNING',
        currentCycle: session.currentCycle + 1,
      },
    })

    // Fire in background
    generateCycleTasks(id, userContext ?? undefined, contextFiles, taskCount).catch(console.error)

    return Response.json({ ok: true, currentCycle: updatedSession.currentCycle })
  } catch (err) {
    console.error('POST /api/repo-engine/[id]/generate error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
