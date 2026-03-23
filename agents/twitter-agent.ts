import { AgentType } from '@/lib/generated/prisma'
import { BaseAgent } from './base-agent'
import { ToolDefinition } from './types'
import { prisma } from '@/lib/prisma'

export class TwitterAgent extends BaseAgent {
  protected agentType = AgentType.TWITTER_POST
  protected systemPrompt = `You are a social media expert specializing in Twitter/X.
Write engaging, concise tweets that drive engagement for startups.
Follow Twitter best practices: hooks, clarity, appropriate hashtags (2-3 max).`

  protected tools: ToolDefinition[] = [
    {
      name: 'draft_tweet',
      description: 'Draft a tweet (max 280 characters)',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Tweet text, max 280 characters' },
          rationale: { type: 'string', description: 'Why this tweet will perform well' },
        },
        required: ['text', 'rationale'],
      },
    },
    {
      name: 'publish_tweet',
      description: 'Publish the tweet via Twitter API',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Final tweet text to publish' },
        },
        required: ['text'],
      },
    },
  ]

  private draftedTweet = ''

  protected async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    if (toolName === 'draft_tweet') {
      this.draftedTweet = toolInput.text as string
      return { success: true, characterCount: this.draftedTweet.length }
    }

    if (toolName === 'publish_tweet') {
      // TODO: Implement Twitter API v2 OAuth2 PKCE publishing
      // For now, save as drafted result
      if (this.context.taskId) {
        await prisma.task.update({
          where: { id: this.context.taskId },
          data: {
            result: JSON.parse(JSON.stringify({
              tweet: toolInput.text,
              status: 'drafted',
              note: 'Configure Twitter API credentials to enable publishing',
            })),
          },
        })
      }
      return { success: true, status: 'saved_as_draft' }
    }

    throw new Error(`Unknown tool: ${toolName}`)
  }
}
