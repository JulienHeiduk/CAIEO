import { AgentType } from '@/lib/generated/prisma'
import { BaseAgent } from './base-agent'
import { ToolDefinition } from './types'
import { prisma } from '@/lib/prisma'

export class HackerNewsAgent extends BaseAgent {
  protected agentType = AgentType.HACKERNEWS_POST
  protected systemPrompt = `You are a Hacker News community expert.
Craft compelling "Show HN" posts or insightful comments that resonate with the HN community.
HN values technical depth, authenticity, and genuine value — avoid marketing speak.`

  protected tools: ToolDefinition[] = [
    {
      name: 'draft_show_hn',
      description: 'Draft a Show HN post',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Show HN: [title]' },
          url: { type: 'string', description: 'URL to share (landing page or demo)' },
          text: { type: 'string', description: 'Post body text' },
        },
        required: ['title', 'text'],
      },
    },
    {
      name: 'submit_hn_post',
      description: 'Submit the post to Hacker News',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['title', 'text'],
      },
    },
  ]

  protected async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    if (toolName === 'draft_show_hn') {
      return { success: true }
    }

    if (toolName === 'submit_hn_post') {
      if (this.context.taskId) {
        await prisma.task.update({
          where: { id: this.context.taskId },
          data: {
            result: JSON.parse(JSON.stringify({
              title: toolInput.title,
              url: toolInput.url,
              text: toolInput.text,
              status: 'drafted',
              note: 'Configure HN credentials to enable posting',
            })),
          },
        })
      }
      return { success: true, status: 'saved_as_draft' }
    }

    throw new Error(`Unknown tool: ${toolName}`)
  }
}
