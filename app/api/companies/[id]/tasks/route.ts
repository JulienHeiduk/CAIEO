import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OrchestratorAgent } from '@/agents/orchestrator'
import { AgentContext } from '@/agents/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
    })

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    const tasks = await prisma.task.findMany({
      where: { companyId: id },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })

    return Response.json({ tasks })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await requireUser()

    const company = await prisma.company.findFirst({
      where: { id, userId: user.id },
      include: {
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 })
    }

    const context: AgentContext = {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        description: company.description,
        ideaPrompt: company.ideaPrompt,
        strategy: company.strategy,
        landingPageUrl: company.landingPageUrl,
        githubRepoUrl: company.githubRepoUrl,
      },
      recentLogs: company.activityLogs.map((log: any) => ({
        eventType: log.eventType,
        summary: log.summary,
        agentType: log.agentType,
        createdAt: log.createdAt,
      })),
      userId: user.id,
    }

    const orchestrator = new OrchestratorAgent(context)
    console.log('[orchestrator] generating tasks for', company.name)
    const taskCount = await orchestrator.generateDailyTasks()
    console.log('[orchestrator] generated', taskCount, 'tasks')

    return Response.json({ tasksGenerated: taskCount })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/companies/[id]/tasks error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
