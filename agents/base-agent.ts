import Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODEL } from '@/lib/claude'
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
    let success = false
    let resultData: Record<string, unknown> = {}
    let errorMessage: string | undefined

    try {
      const messages: Anthropic.MessageParam[] = []

      // Initial user turn
      messages.push({
        role: 'user',
        content: this.buildInitialPrompt(),
      })

      let continueLoop = true

      while (continueLoop) {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: this.buildSystemPrompt(),
          tools: this.tools as Anthropic.Tool[],
          messages,
        })

        totalTokens += response.usage.input_tokens + response.usage.output_tokens

        if (response.stop_reason === 'tool_use') {
          // Add assistant message with tool use
          messages.push({ role: 'assistant', content: response.content })

          // Process each tool use block
          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              const toolInput = block.input as Record<string, unknown>
              let toolResult: unknown
              try {
                toolResult = await this.executeTool(block.name, toolInput)
                toolCallsMade.push({ name: block.name, input: toolInput, result: toolResult })
              } catch (err) {
                toolResult = { error: (err as Error).message }
                toolCallsMade.push({ name: block.name, input: toolInput, result: toolResult })
              }
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(toolResult),
              })
            }
          }

          messages.push({ role: 'user', content: toolResults })
        } else {
          // stop_reason === 'end_turn' or 'max_tokens'
          continueLoop = false

          // Extract final text
          for (const block of response.content) {
            if (block.type === 'text') {
              finalSummary = block.text
              break
            }
          }
          resultData = this.extractResultData(toolCallsMade)
          success = true
        }
      }

      // Update AgentRun as COMPLETED
      await prisma.agentRun.update({
        where: { id: agentRunRecord.id },
        data: {
          status: RunStatus.COMPLETED,
          outputPayload: JSON.parse(JSON.stringify({ summary: finalSummary, data: resultData })),
          toolCalls: JSON.parse(JSON.stringify(toolCallsMade)),
          tokensUsed: totalTokens,
          durationMs: Date.now() - startedAt,
          completedAt: new Date(),
        },
      })

      // Write ActivityLog
      await prisma.activityLog.create({
        data: {
          companyId: this.context.company.id,
          agentType: this.agentType,
          taskId: this.context.taskId ?? null,
          eventType: 'AGENT_COMPLETED',
          summary: finalSummary || `${this.agentType} completed successfully`,
          detail: JSON.parse(JSON.stringify({ toolCallsMade: toolCallsMade.length, tokensUsed: totalTokens, data: resultData })),
        },
      })

      return {
        success: true,
        summary: finalSummary,
        data: resultData,
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
          eventType: 'AGENT_FAILED',
          summary: `${this.agentType} failed: ${errorMessage}`,
          detail: { error: errorMessage },
        },
      })

      return {
        success: false,
        summary: `Agent failed: ${errorMessage}`,
        toolCallsMade: toolCallsMade.length,
        tokensUsed: totalTokens,
        error: errorMessage,
      }
    }
  }

  private buildSystemPrompt(): string {
    const recentActivity = this.context.recentLogs
      .slice(0, 20)
      .map((l) => `[${l.agentType ?? 'SYSTEM'}] ${l.summary}`)
      .join('\n')

    return `${this.systemPrompt}

## Company Context
Name: ${this.context.company.name}
Description: ${this.context.company.description}
Idea: ${this.context.company.ideaPrompt}
Strategy: ${this.context.company.strategy ?? 'Not yet defined'}
Landing Page: ${this.context.company.landingPageUrl ?? 'Not deployed'}

## Recent Activity (last 20 actions)
${recentActivity || 'No recent activity'}`
  }

  protected buildInitialPrompt(): string {
    return 'Please proceed with your assigned task for this company.'
  }

  protected extractResultData(
    toolCalls: Array<{ name: string; input: unknown; result: unknown }>
  ): Record<string, unknown> {
    return { toolCalls: toolCalls.map((tc) => ({ name: tc.name, result: tc.result })) }
  }
}
