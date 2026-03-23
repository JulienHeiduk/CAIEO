import { AgentType } from '@/lib/generated/prisma'
import { BaseAgent } from './base-agent'
import { ToolDefinition } from './types'
import { prisma } from '@/lib/prisma'

export class GrowthAgent extends BaseAgent {
  protected agentType = AgentType.GROWTH_MARKETING
  protected systemPrompt = `You are a growth marketing expert.
You help startups grow through content strategy, SEO, competitor analysis, and outreach.
Use the provided tools to produce actionable growth marketing assets.`

  protected tools: ToolDefinition[] = [
    {
      name: 'research_competitors',
      description: 'Identify and analyze top competitors',
      input_schema: {
        type: 'object',
        properties: {
          competitors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                website: { type: 'string' },
                strengths: { type: 'string' },
                weaknesses: { type: 'string' },
              },
            },
            description: 'List of competitors with analysis',
          },
        },
        required: ['competitors'],
      },
    },
    {
      name: 'generate_seo_keywords',
      description: 'Generate target SEO keywords',
      input_schema: {
        type: 'object',
        properties: {
          primaryKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'High-priority keywords to target',
          },
          longTailKeywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Long-tail keyword opportunities',
          },
        },
        required: ['primaryKeywords', 'longTailKeywords'],
      },
    },
    {
      name: 'draft_cold_email',
      description: 'Draft a cold outreach email',
      input_schema: {
        type: 'object',
        properties: {
          targetAudience: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          callToAction: { type: 'string' },
        },
        required: ['targetAudience', 'subject', 'body', 'callToAction'],
      },
    },
  ]

  private savedResult: Record<string, unknown> = {}

  protected async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    // GrowthAgent stores results in memory and persists to task result
    this.savedResult[toolName] = toolInput

    if (this.context.taskId) {
      await prisma.task.update({
        where: { id: this.context.taskId },
        data: { result: JSON.parse(JSON.stringify(this.savedResult)) },
      })
    }

    return { success: true, saved: true }
  }

  protected extractResultData(
    toolCalls: Array<{ name: string; input: unknown; result: unknown }>
  ): Record<string, unknown> {
    return this.savedResult
  }
}
