import { AgentType } from '@/lib/generated/prisma'
import { BaseAgent } from './base-agent'
import { ToolDefinition } from './types'
import { prisma } from '@/lib/prisma'

export class KaggleAgent extends BaseAgent {
  protected agentType = AgentType.KAGGLE_POST
  protected systemPrompt = `You are a data science community expert.
Find relevant Kaggle datasets and contribute valuable discussions that showcase expertise
while building brand awareness for the company.`

  protected tools: ToolDefinition[] = [
    {
      name: 'find_relevant_dataset',
      description: 'Identify a relevant Kaggle dataset to engage with',
      input_schema: {
        type: 'object',
        properties: {
          datasetName: { type: 'string' },
          datasetUrl: { type: 'string' },
          relevanceRationale: { type: 'string' },
        },
        required: ['datasetName', 'relevanceRationale'],
      },
    },
    {
      name: 'post_kaggle_discussion',
      description: 'Post a discussion comment on a Kaggle dataset',
      input_schema: {
        type: 'object',
        properties: {
          datasetUrl: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['title', 'body'],
      },
    },
  ]

  protected async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    if (toolName === 'find_relevant_dataset') {
      return { success: true, dataset: toolInput.datasetName }
    }

    if (toolName === 'post_kaggle_discussion') {
      if (this.context.taskId) {
        await prisma.task.update({
          where: { id: this.context.taskId },
          data: {
            result: JSON.parse(JSON.stringify({
              title: toolInput.title,
              body: toolInput.body,
              status: 'drafted',
              note: 'Configure Kaggle API credentials to enable posting',
            })),
          },
        })
      }
      return { success: true, status: 'saved_as_draft' }
    }

    throw new Error(`Unknown tool: ${toolName}`)
  }
}
