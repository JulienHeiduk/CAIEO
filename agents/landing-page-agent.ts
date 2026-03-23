import { AgentType } from '@/lib/generated/prisma'
import { BaseAgent } from './base-agent'
import { ToolDefinition } from './types'
import { prisma } from '@/lib/prisma'

export class LandingPageAgent extends BaseAgent {
  protected agentType = AgentType.LANDING_PAGE
  protected systemPrompt = `You are an expert web designer and copywriter.
Create beautiful, conversion-optimized landing pages as complete HTML files with inline CSS and no external dependencies.
The page should be mobile-responsive, fast-loading, and compelling.`

  protected tools: ToolDefinition[] = [
    {
      name: 'generate_html_page',
      description: 'Generate the complete HTML landing page',
      input_schema: {
        type: 'object',
        properties: {
          html: {
            type: 'string',
            description: 'Complete HTML page with inline CSS, mobile-responsive',
          },
          title: { type: 'string', description: 'Page title' },
        },
        required: ['html', 'title'],
      },
    },
  ]

  private generatedHtml = ''
  private pageTitle = ''

  protected async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<unknown> {
    if (toolName === 'generate_html_page') {
      this.generatedHtml = toolInput.html as string
      this.pageTitle = toolInput.title as string

      // Save HTML to task result (actual deployment requires Vercel API key)
      if (this.context.taskId) {
        await prisma.task.update({
          where: { id: this.context.taskId },
          data: {
            result: JSON.parse(JSON.stringify({
              html: this.generatedHtml,
              title: this.pageTitle,
              note: 'HTML generated. Configure Vercel API token to deploy.',
            })),
          },
        })
      }

      return { success: true, title: this.pageTitle, htmlLength: this.generatedHtml.length }
    }

    throw new Error(`Unknown tool: ${toolName}`)
  }

  protected extractResultData(
    toolCalls: Array<{ name: string; input: unknown; result: unknown }>
  ): Record<string, unknown> {
    return { html: this.generatedHtml, title: this.pageTitle }
  }
}
