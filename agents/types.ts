export interface AgentContext {
  company: {
    id: string
    name: string
    slug: string
    description: string
    ideaPrompt: string
    strategy: string | null
    landingPageUrl: string | null
    githubContext?: string | null
  }
  recentLogs: Array<{
    eventType: string
    summary: string
    agentType: string | null
    createdAt: Date
  }>
  taskId?: string
  userId: string
}

export interface AgentResult {
  success: boolean
  summary: string
  data?: Record<string, unknown>
  toolCallsMade: number
  tokensUsed?: number
  error?: string
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}
