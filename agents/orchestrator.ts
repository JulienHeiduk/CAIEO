import { AgentType, RunStatus } from '@/lib/generated/prisma'
import { anthropic, MODEL } from '@/lib/claude'
import { prisma } from '@/lib/prisma'
import { AgentContext } from './types'
import Anthropic from '@anthropic-ai/sdk'

interface CreateTaskInput {
  title: string
  description: string
  agentType: AgentType
  priority: number
}

export class OrchestratorAgent {
  private context: AgentContext

  constructor(context: AgentContext) {
    this.context = context
  }

  async generateDailyTasks(): Promise<number> {
    const recentActivity = this.context.recentLogs
      .slice(0, 20)
      .map((l) => `[${l.agentType ?? 'SYSTEM'}] ${l.summary}`)
      .join('\n')

    const systemPrompt = `You are the Chief of Staff for ${this.context.company.name}.
Your job is to propose up to 5 high-impact tasks for today using the create_task tool.
Vary tasks between: marketing (social posts), product (landing page, content), and growth (SEO, outreach).
Avoid repeating recent activity listed below.
Each task must have a clear title, detailed description, appropriate agentType, and priority (1-5, 5=highest).

## Company Info
Name: ${this.context.company.name}
Description: ${this.context.company.description}
Idea: ${this.context.company.ideaPrompt}
Strategy: ${this.context.company.strategy ?? 'Not yet defined'}

## Recent Activity (avoid repeating)
${recentActivity || 'No recent activity — this is day one!'}`

    const tools: Anthropic.Tool[] = [
      {
        name: 'create_task',
        description: 'Create a task for the company. Call this up to 5 times.',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short, action-oriented task title' },
            description: {
              type: 'string',
              description: 'Detailed description of what the agent should do',
            },
            agentType: {
              type: 'string',
              enum: [
                'LANDING_PAGE',
                'LINKEDIN_POST',
                'TWITTER_POST',
                'REDDIT_POST',
                'HACKERNEWS_POST',
                'KAGGLE_POST',
                'GROWTH_MARKETING',
                'API_SCAFFOLD',
              ],
              description: 'Which agent will execute this task',
            },
            priority: {
              type: 'number',
              description: 'Priority 1-5 (5 = highest)',
              minimum: 1,
              maximum: 5,
            },
          },
          required: ['title', 'description', 'agentType', 'priority'],
        },
      },
    ]

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content:
          'Generate up to 5 high-impact tasks for today. Use the create_task tool for each task.',
      },
    ]

    const tasksCreated: CreateTaskInput[] = []

    let continueLoop = true
    while (continueLoop && tasksCreated.length < 5) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages,
      })

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content })

        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of response.content) {
          if (block.type === 'tool_use' && block.name === 'create_task') {
            const input = block.input as CreateTaskInput
            tasksCreated.push(input)

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ success: true, taskNumber: tasksCreated.length }),
            })

            if (tasksCreated.length >= 5) break
          }
        }

        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults })
        }
      } else {
        continueLoop = false
      }
    }

    // Persist tasks to DB
    if (tasksCreated.length > 0) {
      await prisma.task.createMany({
        data: tasksCreated.map((t) => ({
          companyId: this.context.company.id,
          title: t.title,
          description: t.description,
          agentType: t.agentType,
          priority: t.priority,
          scheduledFor: new Date(),
        })),
      })

      await prisma.activityLog.create({
        data: {
          companyId: this.context.company.id,
          agentType: AgentType.COMPANY_INIT,
          eventType: 'TASKS_GENERATED',
          summary: `Generated ${tasksCreated.length} tasks for review`,
          detail: { tasks: tasksCreated.map((t) => t.title) },
        },
      })
    }

    return tasksCreated.length
  }
}
