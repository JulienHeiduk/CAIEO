import { task } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { AgentContext } from '@/agents/types'
import {
  GrowthAgent,
  LandingPageAgent,
  TwitterAgent,
  LinkedInAgent,
  RedditAgent,
  HackerNewsAgent,
  KaggleAgent,
} from '@/agents'
import { AgentType, TaskStatus } from '@/lib/generated/prisma'

export const executeTaskJob = task({
  id: 'execute-task',
  run: async (payload: { taskId: string }) => {
    const { taskId } = payload

    const taskRecord = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        company: {
          include: {
            activityLogs: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
      },
    })

    if (!taskRecord) throw new Error(`Task ${taskId} not found`)

    // HUMAN-IN-THE-LOOP: Abort if not approved
    if (taskRecord.status !== TaskStatus.APPROVED) {
      throw new Error(
        `Task ${taskId} is not approved (status: ${taskRecord.status}). Aborting.`
      )
    }

    // Mark as executing
    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.EXECUTING, executedAt: new Date() },
    })

    const company = taskRecord.company

    const context: AgentContext = {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        description: company.description,
        ideaPrompt: company.ideaPrompt,
        strategy: company.strategy,
        landingPageUrl: company.landingPageUrl,
      },
      recentLogs: company.activityLogs.map((log: any) => ({
        eventType: log.eventType,
        summary: log.summary,
        agentType: log.agentType,
        createdAt: log.createdAt,
      })),
      taskId,
      userId: company.userId,
    }

    // Route to correct agent
    const AgentClass = getAgentClass(taskRecord.agentType)
    if (!AgentClass) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.FAILED, errorMessage: `No agent for type ${taskRecord.agentType}` },
      })
      throw new Error(`No agent for type: ${taskRecord.agentType}`)
    }

    const agent = new AgentClass(context)
    const result = await agent.run()

    // Update task status
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
        result: result.data ? JSON.parse(JSON.stringify(result.data)) : undefined,
        errorMessage: result.error ?? null,
      },
    })

    return result
  },
})

function getAgentClass(agentType: AgentType) {
  switch (agentType) {
    case AgentType.GROWTH_MARKETING:
      return GrowthAgent
    case AgentType.LANDING_PAGE:
      return LandingPageAgent
    case AgentType.TWITTER_POST:
      return TwitterAgent
    case AgentType.LINKEDIN_POST:
      return LinkedInAgent
    case AgentType.REDDIT_POST:
      return RedditAgent
    case AgentType.HACKERNEWS_POST:
      return HackerNewsAgent
    case AgentType.KAGGLE_POST:
      return KaggleAgent
    default:
      return null
  }
}
