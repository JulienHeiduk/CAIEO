import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
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
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    return Response.json({ session })
  } catch (err) {
    console.error('GET /api/repo-engine/[id] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
