import 'server-only'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { AgentType } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { AgentContext } from './types'

interface CreateTaskInput {
  title: string
  description: string
  agentType: AgentType
  priority: number
}

const VALID_AGENT_TYPES = [
  'LANDING_PAGE', 'LINKEDIN_POST', 'TWITTER_POST', 'REDDIT_POST',
  'HACKERNEWS_POST', 'KAGGLE_POST', 'GROWTH_MARKETING', 'API_SCAFFOLD',
]

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

    const prompt = `You are the Chief of Staff for ${this.context.company.name}.

## Company Info
Name: ${this.context.company.name}
Description: ${this.context.company.description}
Idea: ${this.context.company.ideaPrompt}
Strategy: ${this.context.company.strategy ?? 'Not yet defined'}

## Recent Activity (avoid repeating)
${recentActivity || 'No recent activity — this is day one!'}

## Your Task
Generate exactly 5 high-impact tasks for today. Vary them across marketing, product, and growth.
Each task must have an appropriate agentType from this list: ${VALID_AGENT_TYPES.join(', ')}.

Respond with ONLY a valid JSON array, no explanation, no markdown code blocks, just raw JSON:
[
  {"title": "...", "description": "...", "agentType": "LINKEDIN_POST", "priority": 5},
  ...
]`

    let fullText = ''

    for await (const message of query({
      prompt,
      options: { permissionMode: 'bypassPermissions' },
    })) {
      if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if ('text' in block) fullText += block.text
        }
      }
    }

    // Extract JSON array from response
    const jsonMatch = fullText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[orchestrator] No JSON array found in response:', fullText.slice(0, 200))
      return 0
    }

    let tasks: CreateTaskInput[] = []
    try {
      const parsed = JSON.parse(jsonMatch[0])
      tasks = parsed
        .filter((t: CreateTaskInput) => t.title && t.description && VALID_AGENT_TYPES.includes(t.agentType))
        .slice(0, 5)
    } catch (err) {
      console.error('[orchestrator] Failed to parse tasks JSON:', err)
      return 0
    }

    if (tasks.length === 0) return 0

    await prisma.task.createMany({
      data: tasks.map((t) => ({
        companyId: this.context.company.id,
        title: t.title,
        description: t.description,
        agentType: t.agentType,
        priority: t.priority ?? 3,
        scheduledFor: new Date(),
      })),
    })

    await prisma.activityLog.create({
      data: {
        companyId: this.context.company.id,
        agentType: AgentType.COMPANY_INIT,
        eventType: 'TASKS_GENERATED',
        summary: `Generated ${tasks.length} tasks for review`,
        detail: { tasks: tasks.map((t) => t.title) },
      },
    })

    return tasks.length
  }
}
