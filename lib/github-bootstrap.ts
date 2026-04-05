import 'server-only'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import path from 'path'
import { prisma } from './prisma'
import { getUserTokens } from './settings'
import { query } from '@anthropic-ai/claude-agent-sdk'

// ─── AI text generation helper ───────────────────────────────────────────────

async function generateText(prompt: string): Promise<string> {
  let output = ''
  for await (const message of query({
    prompt,
    options: { permissionMode: 'bypassPermissions', model: 'claude-opus-4-6' },
  })) {
    if (message.type === 'assistant') {
      for (const block of message.message?.content ?? []) {
        if ('text' in block && block.text) {
          output += block.text
        }
      }
    }
  }
  return output.trim()
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function setError(id: string, msg: string) {
  await prisma.gitHubBootstrap.update({
    where: { id },
    data: { stepStatus: 'ERROR', stepError: msg },
  })
}

// ─── Step 1: generate repo metadata ──────────────────────────────────────────

export async function startBootstrap(id: string): Promise<void> {
  try {
    const session = await prisma.gitHubBootstrap.findUniqueOrThrow({ where: { id } })

    const raw = await generateText(
      `You are a senior software architect. Given the following project idea, generate a short GitHub repository name and a one-sentence description.

Project idea: "${session.idea}"

Rules:
- repo_name: lowercase, hyphens only, max 50 chars, no spaces
- description: one sentence, max 120 chars, plain text (no quotes)

Respond with ONLY valid JSON in this exact format:
{"repo_name": "...", "description": "..."}`
    )

    let repoName = session.repoName
    let description = ''

    try {
      // Extract JSON from the response (handle potential markdown fences)
      const jsonMatch = raw.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { repo_name?: string; description?: string }
        if (!session.repoName && parsed.repo_name) {
          repoName = parsed.repo_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50)
        }
        description = parsed.description ?? ''
      }
    } catch {
      // fallback: use raw as description
      description = raw.slice(0, 120)
    }

    await prisma.gitHubBootstrap.update({
      where: { id },
      data: {
        repoName,
        description,
        currentStep: 1,
        stepStatus: 'REVIEW',
        stepError: null,
      },
    })
  } catch (err) {
    await setError(id, (err as Error).message)
  }
}

// ─── Step execution ───────────────────────────────────────────────────────────

type ApprovedContent = {
  repoName?: string
  description?: string
  readmeContent?: string
  changelogContent?: string
  tasksContent?: string
}

export async function executeStep(id: string, approvedContent?: ApprovedContent): Promise<void> {
  try {
    const session = await prisma.gitHubBootstrap.findUniqueOrThrow({ where: { id } })
    const tokens = await getUserTokens()
    const githubToken = tokens.githubToken

    switch (session.currentStep) {
      case 1: {
        // Create GitHub repo
        if (!githubToken) throw new Error('GitHub token not configured. Go to Settings → Integrations.')

        const repoName = approvedContent?.repoName ?? session.repoName
        const description = approvedContent?.description ?? session.description ?? ''
        const isPrivate = session.visibility !== 'public'

        const resp = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: repoName,
            description,
            private: isPrivate,
            auto_init: false,
          }),
        })

        const data = await resp.json() as { html_url?: string; full_name?: string; message?: string }

        if (!resp.ok) {
          if (resp.status === 403 || (data.message ?? '').toLowerCase().includes('not accessible')) {
            throw new Error(
              'Token missing "repo" scope. Go to github.com/settings/tokens → generate a classic token → check the "repo" scope. Fine-grained tokens cannot create repositories.'
            )
          }
          if (resp.status === 422) {
            throw new Error(`Repository name "${repoName}" already exists on GitHub. Change the repo name and try again.`)
          }
          throw new Error(`GitHub: ${data.message ?? resp.statusText}`)
        }

        await prisma.gitHubBootstrap.update({
          where: { id },
          data: {
            repoName,
            description,
            repoUrl: data.html_url ?? null,
            repoFullName: data.full_name ?? null,
            currentStep: 2,
            stepStatus: 'REVIEW',
            stepError: null,
          },
        })
        break
      }

      case 2: {
        // Clone repo + generate README
        if (!githubToken) throw new Error('GitHub token not configured.')
        const fullName = session.repoFullName
        if (!fullName) throw new Error('Repository full name not set.')

        const repoName = session.repoName
        const localPath = session.localPath
        const clonedPath = path.join(localPath, repoName)

        const cloneUrl = `https://oauth2:${githubToken}@github.com/${fullName}.git`
        execSync(`git clone "${cloneUrl}" "${clonedPath}"`, {
          stdio: 'pipe',
          timeout: 60000,
        })

        // Generate README with AI
        const readmeContent = await generateText(
          `You are a technical writer. Generate a complete README.md for the following project.

Project name: ${repoName}
Description: ${session.description ?? ''}
Original idea: ${session.idea}

Use this exact template structure (fill in all sections with relevant content):

# ${repoName}

{short description}

## Objective

{structured reformulation of the idea}

## Technical Stack

{suggested stack based on the idea}

## Getting Started

> This project was initialized automatically by Chief AI Officer.

### Prerequisites

- To be defined

### Installation

\`\`\`bash
git clone https://github.com/${fullName}.git
cd ${repoName}
\`\`\`

## Roadmap

See [TASKS.md](./TASKS.md)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md)

## License

MIT

Output ONLY the raw markdown. Do not wrap in code fences.`
        )

        await prisma.gitHubBootstrap.update({
          where: { id },
          data: {
            clonedPath,
            readmeContent,
            currentStep: 3,
            stepStatus: 'REVIEW',
            stepError: null,
          },
        })
        break
      }

      case 3: {
        // Write README + generate CHANGELOG
        const clonedPath = session.clonedPath
        if (!clonedPath) throw new Error('Cloned path not set.')

        const readmeContent = approvedContent?.readmeContent ?? session.readmeContent ?? ''
        writeFileSync(path.join(clonedPath, 'README.md'), readmeContent, 'utf-8')

        // Generate CHANGELOG as template (no AI)
        const today = new Date().toISOString().split('T')[0]
        const changelogContent = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Project initialized from idea: "${session.idea}"
- README.md auto-generated by Chief AI Officer
- TASKS.md with 5 initial tasks

---

## [0.1.0] — ${today}

### Added
- Initial project bootstrap
`

        await prisma.gitHubBootstrap.update({
          where: { id },
          data: {
            readmeContent,
            changelogContent,
            currentStep: 4,
            stepStatus: 'REVIEW',
            stepError: null,
          },
        })
        break
      }

      case 4: {
        // Write CHANGELOG + generate TASKS.md
        const clonedPath = session.clonedPath
        if (!clonedPath) throw new Error('Cloned path not set.')

        const changelogContent = approvedContent?.changelogContent ?? session.changelogContent ?? ''
        writeFileSync(path.join(clonedPath, 'CHANGELOG.md'), changelogContent, 'utf-8')

        // Generate TASKS.md with AI
        const tasksContent = await generateText(
          `You are a senior project manager and software architect. Generate exactly 5 initial tasks for this project.

Project name: ${session.repoName}
Description: ${session.description ?? ''}
Original idea: ${session.idea}

Task rules:
- Task 1: always related to technical setup (dependencies, file structure, config)
- Task 2: always related to the minimal core feature (the heart of the idea)
- Task 3: secondary feature or key integration
- Task 4: tests or validation (unit tests, smoke test, or manual validation)
- Task 5: documentation or polish (complete README, add examples)

Use this exact markdown format:

# Tasks

## Convention

- [ ] To do
- [x] Done
- [~] In progress

---

### Task 1 — {Short title}

**Priority**: {high | medium | low}
**Estimate**: {estimated duration}

{Description of what needs to be done, why, and acceptance criteria}

---

### Task 2 — {Short title}
...

Output ONLY the raw markdown. Do not wrap in code fences.`
        )

        await prisma.gitHubBootstrap.update({
          where: { id },
          data: {
            changelogContent,
            tasksContent,
            currentStep: 5,
            stepStatus: 'REVIEW',
            stepError: null,
          },
        })
        break
      }

      case 5: {
        // Write TASKS.md + advance to step 6 (commit preview)
        const clonedPath = session.clonedPath
        if (!clonedPath) throw new Error('Cloned path not set.')

        const tasksContent = approvedContent?.tasksContent ?? session.tasksContent ?? ''
        writeFileSync(path.join(clonedPath, 'TASKS.md'), tasksContent, 'utf-8')

        await prisma.gitHubBootstrap.update({
          where: { id },
          data: {
            tasksContent,
            currentStep: 6,
            stepStatus: 'REVIEW',
            stepError: null,
          },
        })
        break
      }

      case 6: {
        // Git commit + push
        const clonedPath = session.clonedPath
        if (!clonedPath) throw new Error('Cloned path not set.')
        if (!githubToken) throw new Error('GitHub token not configured.')
        const fullName = session.repoFullName
        if (!fullName) throw new Error('Repository full name not set.')

        const commitMessage = `feat: initialisation du projet — ${session.repoName}

Généré automatiquement par Chief AI Officer.

- README.md avec description et roadmap
- CHANGELOG.md (Keep a Changelog)
- TASKS.md avec 5 tâches initiales`

        execSync('git add README.md CHANGELOG.md TASKS.md', {
          cwd: clonedPath,
          stdio: 'pipe',
          timeout: 60000,
        })

        execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
          cwd: clonedPath,
          stdio: 'pipe',
          timeout: 60000,
        })

        const pushUrl = `https://oauth2:${githubToken}@github.com/${fullName}.git`
        execSync(`git push "${pushUrl}" HEAD:main`, {
          cwd: clonedPath,
          stdio: 'pipe',
          timeout: 60000,
        })

        await prisma.gitHubBootstrap.update({
          where: { id },
          data: {
            currentStep: 6,
            stepStatus: 'DONE',
            stepError: null,
          },
        })
        break
      }

      default:
        throw new Error(`Unknown step: ${session.currentStep}`)
    }
  } catch (err) {
    await setError(id, (err as Error).message)
  }
}
