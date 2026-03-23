import { AgentType } from '@/lib/generated/prisma'
import { BaseAgent } from './base-agent'
import { AgentContext, ToolDefinition } from './types'
import { prisma } from '@/lib/prisma'

export class CompanyInitAgent extends BaseAgent {
  protected agentType = AgentType.COMPANY_INIT
  protected systemPrompt = `You are an expert startup strategist and branding consultant.
Your job is to analyze a startup idea and produce:
1. A compelling company name (if not already set)
2. A clear, concise description (1-2 sentences)
3. A detailed growth strategy (3-5 paragraphs covering target market, differentiation, go-to-market, and growth tactics)

Use the provided tools to save your outputs.`

  protected tools: ToolDefinition[] = [
    {
      name: 'set_company_name',
      description: 'Set the company name',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The company name' },
        },
        required: ['name'],
      },
    },
    {
      name: 'set_company_strategy',
      description: 'Set the company description and growth strategy',
      input_schema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'One-sentence company description' },
          strategy: {
            type: 'string',
            description: 'Full growth strategy (3-5 paragraphs)',
          },
        },
        required: ['description', 'strategy'],
      },
    },
  ]

  protected buildInitialPrompt(): string {
    return `Analyze this startup idea and define the company:

Idea: ${this.context.company.ideaPrompt}

Please:
1. Create a compelling company name using set_company_name
2. Write a description and full growth strategy using set_company_strategy`
  }

  protected async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    if (toolName === 'set_company_name') {
      const name = toolInput.name as string
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Check slug uniqueness
      const existing = await prisma.company.findUnique({ where: { slug } })
      const finalSlug = existing ? `${slug}-${Date.now()}` : slug

      await prisma.company.update({
        where: { id: this.context.company.id },
        data: { name, slug: finalSlug },
      })
      return { success: true, name, slug: finalSlug }
    }

    if (toolName === 'set_company_strategy') {
      await prisma.company.update({
        where: { id: this.context.company.id },
        data: {
          description: toolInput.description as string,
          strategy: toolInput.strategy as string,
          status: 'ACTIVE',
        },
      })
      return { success: true }
    }

    throw new Error(`Unknown tool: ${toolName}`)
  }
}
