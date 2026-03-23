import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
    })

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const agentType = searchParams.get('agentType')
    const take = 20

    const logs = await prisma.activityLog.findMany({
      where: {
        companyId: id,
        ...(agentType ? { agentType: agentType as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = logs.length > take
    const items = hasMore ? logs.slice(0, take) : logs
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return Response.json({ logs: items, nextCursor })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
