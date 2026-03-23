import { AgentType } from '@/lib/generated/prisma'
import { BaseAgent } from './base-agent'
import { ToolDefinition } from './types'
import { prisma } from '@/lib/prisma'

export class RedditAgent extends BaseAgent {
  protected agentType = AgentType.REDDIT_POST
  protected systemPrompt = `You are a Reddit community expert.
Create authentic, valuable Reddit posts that contribute to relevant communities without being spammy.
Research the best subreddits and craft posts that genuinely help community members.`

  protected tools: ToolDefinition[] = [
    {
      name: 'choose_subreddit',
      description: 'Select the best subreddit to post in',
      input_schema: {
        type: 'object',
        properties: {
          subreddit: { type: 'string', description: 'Subreddit name (without r/)' },
          rationale: { type: 'string', description: 'Why this subreddit fits' },
        },
        required: ['subreddit', 'rationale'],
      },
    },
    {
      name: 'submit_reddit_post',
      description: 'Submit a post to Reddit',
      input_schema: {
        type: 'object',
        properties: {
          subreddit: { type: 'string' },
          title: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['subreddit', 'title', 'text'],
      },
    },
  ]

  protected async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    if (toolName === 'choose_subreddit') {
      return { success: true, subreddit: toolInput.subreddit }
    }

    if (toolName === 'submit_reddit_post') {
      if (this.context.taskId) {
        await prisma.task.update({
          where: { id: this.context.taskId },
          data: {
            result: JSON.parse(JSON.stringify({
              subreddit: toolInput.subreddit,
              title: toolInput.title,
              text: toolInput.text,
              status: 'drafted',
              note: 'Configure Reddit OAuth2 credentials to enable posting',
            })),
          },
        })
      }
      return { success: true, status: 'saved_as_draft' }
    }

    throw new Error(`Unknown tool: ${toolName}`)
  }
}
