import 'server-only'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { prisma } from '@/lib/prisma'
import { AgentType, RunStatus } from '@/lib/generated/prisma'
import { AgentContext, AgentResult, ToolDefinition } from './types'

export abstract class BaseAgent {
  protected context: AgentContext
  protected abstract agentType: AgentType
  protected abstract systemPrompt: string
  protected abstract tools: ToolDefinition[]

  constructor(context: AgentContext) {
    this.context = context
  }

  protected abstract executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown>

  protected buildInitialPrompt(): string {
    return 'Please proceed with your assigned task for this company.'
  }

  private buildFullPrompt(): string {
    const recentActivity = this.context.recentLogs
      .slice(0, 20)
      .map((l) => `[${l.agentType ?? 'SYSTEM'}] ${l.summary}`)
      .join('\n')

    const companyContext = `## Company Context
Name: ${this.context.company.name}
Description: ${this.context.company.description}
Idea: ${this.context.company.ideaPrompt}
Strategy: ${this.context.company.strategy ?? 'Not yet defined'}
Landing Page: ${this.context.company.landingPageUrl ?? 'Not deployed'}

## Recent Activity
${recentActivity || 'No recent activity'}

---

${this.systemPrompt}

${this.buildInitialPrompt()}`

    return companyContext
  }

  private buildToolsDescription(): string {
    if (!this.tools.length) return ''
    const toolsJson = JSON.stringify(this.tools, null, 2)
    return `\n\nYou have access to the following tools. To use a tool, output EXACTLY this JSON block (and nothing else on those lines):\n<tool_call>\n{"name": "<tool_name>", "input": {<parameters>}}\n</tool_call>\n\nAvailable tools:\n${toolsJson}\n\nAfter each tool call I will respond with the result. Use the tools as needed, then provide your final summary.`
  }

  async run(): Promise<AgentResult> {
    const startedAt = Date.now()
    const agentRunRecord = await prisma.agentRun.create({
      data: {
        companyId: this.context.company.id,
        taskId: this.context.taskId ?? null,
        agentType: this.agentType,
        inputPayload: JSON.parse(JSON.stringify({ context: this.context })),
        status: RunStatus.RUNNING,
      },
    })

    const toolCallsMade: Array<{ name: string; input: unknown; result: unknown }> = []
    let totalTokens = 0
    let finalSummary = ''
    let errorMessage: string | undefined

    try {
      const fullPrompt = this.buildFullPrompt() + this.buildToolsDescription()
      let assistantText = ''

      for await (const message of query({
        prompt: fullPrompt,
        options: {
          permissionMode: 'bypassPermissions',
        },
      })) {
        if (message.type === 'assistant') {
          for (const block of message.message?.content ?? []) {
            if ('text' in block) {
              assistantText += block.text
            }
          }
        }
        if (message.type === 'result') {
          finalSummary = (message as { result?: string }).result ?? assistantText
        }
      }

      // Parse and execute any tool calls from the response
      const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
      let match
      while ((match = toolCallRegex.exec(assistantText)) !== null) {
        try {
          const parsed = JSON.parse(match[1])
          const result = await this.executeTool(parsed.name, parsed.input ?? {})
          toolCallsMade.push({ name: parsed.name, input: parsed.input, result })
        } catch (err) {
          toolCallsMade.push({ name: 'unknown', input: match[1], result: { error: (err as Error).message } })
        }
      }

      await prisma.agentRun.update({
        where: { id: agentRunRecord.id },
        data: {
          status: RunStatus.COMPLETED,
          outputPayload: JSON.parse(JSON.stringify({ summary: finalSummary })),
          toolCalls: JSON.parse(JSON.stringify(toolCallsMade)),
          tokensUsed: totalTokens,
          durationMs: Date.now() - startedAt,
          completedAt: new Date(),
        },
      })

      await prisma.activityLog.create({
        data: {
          companyId: this.context.company.id,
          agentType: this.agentType,
          taskId: this.context.taskId ?? null,
          eventType: 'AGENT_COMPLETED',
          summary: finalSummary || `${this.agentType} completed`,
          detail: JSON.parse(JSON.stringify({ toolCallsMade: toolCallsMade.length, data: toolCallsMade })),
        },
      })

      return {
        success: true,
        summary: finalSummary,
        toolCallsMade: toolCallsMade.length,
        tokensUsed: totalTokens,
      }
    } catch (err) {
      errorMessage = (err as Error).message

      await prisma.agentRun.update({
        where: { id: agentRunRecord.id },
        data: {
          status: RunStatus.FAILED,
          errorMessage,
          toolCalls: JSON.parse(JSON.stringify(toolCallsMade)),
          durationMs: Date.now() - startedAt,
          completedAt: new Date(),
        },
      })

      await prisma.activityLog.create({
        data: {
          companyId: this.context.company.id,
          agentType: this.agentType,
          taskId: this.context.taskId ?? null,
          eventType: 'AGENT_FAILED',
          summary: `${this.agentType} failed: ${errorMessage}`,
          detail: { error: errorMessage },
        },
      })

      return {
        success: false,
        summary: `Agent failed: ${errorMessage}`,
        toolCallsMade: toolCallsMade.length,
        error: errorMessage,
      }
    }
  }
}
