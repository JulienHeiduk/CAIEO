import { schedules } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { OrchestratorAgent } from '@/agents/orchestrator'
import { AgentContext } from '@/agents/types'
import { CompanyStatus } from '@/lib/generated/prisma'

export const dailyTasksJob = schedules.task({
  id: 'daily-tasks',
  cron: '0 8 * * *', // 08:00 UTC daily
  run: async () => {
    const activeCompanies = await prisma.company.findMany({
      where: { status: CompanyStatus.ACTIVE },
      include: {
        user: true,
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    const results = []

    for (const company of activeCompanies) {
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
        userId: company.userId,
      }

      try {
        const orchestrator = new OrchestratorAgent(context)
        const taskCount = await orchestrator.generateDailyTasks()
        results.push({ companyId: company.id, tasksGenerated: taskCount })
      } catch (err) {
        results.push({ companyId: company.id, error: (err as Error).message })
      }
    }

    return { processed: activeCompanies.length, results }
  },
})
