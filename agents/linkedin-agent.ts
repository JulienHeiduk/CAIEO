import { AgentType } from '@/lib/generated/prisma'
import { BaseAgent } from './base-agent'
import { ToolDefinition } from './types'
import { prisma } from '@/lib/prisma'

export class LinkedInAgent extends BaseAgent {
  protected agentType = AgentType.LINKEDIN_POST
  protected systemPrompt = `You are a LinkedIn content expert.
Write professional, insightful LinkedIn posts that build thought leadership for startups.
Best practices: start with a hook, tell a story, add value, end with a question or CTA.`

  protected tools: ToolDefinition[] = [
    {
      name: 'draft_post',
      description: 'Draft a LinkedIn post',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'LinkedIn post text (500-1500 chars ideal)' },
          rationale: { type: 'string', description: 'Why this post will resonate' },
        },
        required: ['text', 'rationale'],
      },
    },
    {
      name: 'publish_linkedin_post',
      description: 'Publish to LinkedIn via API',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Final post text' },
        },
        required: ['text'],
      },
    },
  ]

  protected async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    if (toolName === 'draft_post') {
      return { success: true, characterCount: (toolInput.text as string).length }
    }

    if (toolName === 'publish_linkedin_post') {
      if (this.context.taskId) {
        await prisma.task.update({
          where: { id: this.context.taskId },
          data: {
            result: JSON.parse(JSON.stringify({
              post: toolInput.text,
              status: 'drafted',
              note: 'Configure LinkedIn API credentials to enable publishing',
            })),
          },
        })
      }
      return { success: true, status: 'saved_as_draft' }
    }

    throw new Error(`Unknown tool: ${toolName}`)
  }
}
