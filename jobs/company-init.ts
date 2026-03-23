import { task } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import { CompanyInitAgent } from '@/agents/company-init-agent'
import { AgentContext } from '@/agents/types'

export const companyInitTask = task({
  id: 'company-init',
  run: async (payload: { companyId: string; userId: string }) => {
    const { companyId, userId } = payload

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) throw new Error(`Company ${companyId} not found`)

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
      recentLogs: [],
      userId,
    }

    const agent = new CompanyInitAgent(context)
    const result = await agent.run()

    return result
  },
})
