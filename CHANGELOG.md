# CAIO — Changelog

All notable changes to this project are documented here.

---

## [0.9.0] — 2026-04-05

### Autopilot — Autonomous Company Creator

Full autonomous pipeline that creates a startup from an idea (manual input or Gmail "Idea of the Day").

**Pipeline steps (6 steps):**
1. **Gmail Fetch** — searches for the latest "Idea of the Day" email and extracts the idea (or skip with manual input)
2. **Validate** — AI classifies the idea as software or hardware; rejects hardware ideas
3. **Create Company** — runs CompanyInitAgent with TechnicalStack.md and structured startup launch plan template
4. **Bootstrap Repo** — creates GitHub repo, clones locally, generates README/CHANGELOG/TASKS.md, commits and pushes (non-blocking if no GitHub token)
5. **Generate Tasks** — OrchestratorAgent generates 5 tasks, auto-approved
6. **Execute Tasks** — tasks run one by one with 3-second delay; stoppable between tasks

**Features:**
- New `/autopilot` page with step bar (6 steps), live log, and stop button
- Manual idea textarea: type any startup idea and launch directly (skips Gmail step)
- "Fetch from Gmail" button starts the full pipeline from Gmail
- "Run Daily Cycle" button generates + executes 5 new tasks for any existing company
- Stop button halts execution between tasks (cooperative stop)
- Pipeline history with status badges
- Structured startup launch plan injected into company strategy (Product Vision, Technical Architecture, Go-to-Market, Growth Engine, Daily Operations)
- Automatic GitHub repo bootstrap with AI-generated README.md, CHANGELOG.md, TASKS.md

**Architecture:**
- `AutopilotRun` Prisma model tracks pipeline state across 6 steps (+ `repoUrl`, `repoLocalPath` fields)
- `lib/autopilot.ts` — core pipeline logic (fetch, validate, create, bootstrap repo, generate, execute)
- `lib/task-runner.ts` — extracted shared task runner (was inline in execute route)
- API: `POST/GET /api/autopilot`, `GET/PATCH /api/autopilot/[id]`, `POST /api/autopilot/daily`
- Sidebar: added Autopilot link

### Changed

- **All AI models upgraded to Opus 4.6** — every `query()` call now uses `claude-opus-4-6` explicitly (lib/repo-engine, lib/github-bootstrap, agents/base-agent, agents/orchestrator, task execution route)

---

## [0.8.4] — 2026-04-04

### Added

- **Delete session**: Added a delete button on each active session card in the Task Engine. Clicking it shows a confirm/cancel prompt; confirmed deletions remove the session and all its tasks (cascade) from the database.
  - New API: `DELETE /api/repo-engine/[id]`
  - New component: `DeleteSessionButton`

---

## [0.8.3] — 2026-04-04

### Chore

- **Repo cleanup**: Moved specs (`SPEC_bootstrap_repo.md`, `SPEC_taskengine_repo.md`, `TechnicalStack.md`) to `docs/`.
- **Dead files removed**: Deleted `chief-ai-officer.jsx` (unused prototype), `proxy.ts` (no-op middleware), `REVIEW.md` (wrong project), default Next.js SVGs, and legacy `screenshots/` directory.
- **Trigger.dev removed**: Deleted disconnected `jobs/` directory and `trigger.config.ts`; uninstalled `@trigger.dev/sdk` and `@trigger.dev/nextjs` dependencies.
- **Gitignore**: Added `.claude/settings.local.json` (machine-specific) to `.gitignore`.

---

## [0.8.2] — 2026-04-04

### Improved

- **README**: Replaced default Next.js boilerplate with a comprehensive project README covering features, architecture, tech stack, getting started, agents, and project structure.
- **Screenshots**: Added automated screenshots of the dashboard, task engine, bootstrap wizard, and integrations pages (`public/screenshots/`).

---

## [0.8.1] — 2026-03-25

### Fixed

- **Task generation**: Existing pending tasks are no longer wiped when the AI returns 0 tasks (e.g. due to JSON parse failure). The replace only happens if valid tasks were parsed; otherwise the session is set to `ERROR` and the old tasks are preserved.
- **JSON parsing**: Replaced fragile greedy regex with a proper balanced-brace extractor that handles string escaping, preamble/postamble text, and markdown code blocks — reliably finds any `{"tasks": [...]}` object in the AI response regardless of surrounding content.

---

## [0.8.0] — 2026-03-24

### Cycle Review (Opus 4.6)

A code review step powered by Claude Opus 4.6 is now available between development cycles in the Task Engine.

**What it does**
- Analyzes the full repo: directory tree, SPEC.md, README, CHANGELOG, committed tasks, source files
- Reviews implementation quality, feature completeness, code quality, test coverage, and next-cycle readiness
- Outputs a structured markdown report with concrete, file-specific findings

**How to use**
- Click **▶ Run Review** in the purple "Cycle Review" panel at the bottom of the session view
- Review runs in the background; the panel polls and displays results when ready
- Re-run at any time with **↺ Re-run Review**

**Architecture**
- New `reviewContent`, `reviewStatus`, `reviewCycle` fields on `RepoSession` (migration `20260324220959_add_cycle_review`)
- `runCycleReview(sessionId)` in `lib/repo-engine.ts` — uses `claude-opus-4-6` via `generateText(prompt, model)`
- API: `POST /api/repo-engine/[id]/review`
- Polling extended to include `reviewStatus === 'RUNNING'`

---

## [0.7.0] — 2026-03-24

### AI Task Engine on Existing Repo

New module for AI-driven development on any existing local git repository.

**Workflow (infinite cycle)**
1. Point the engine at a local git repo path (must be a valid git repository)
2. AI scans the repo: directory tree, SPEC.md, README.md, CHANGELOG.md, TASKS.md, package.json, source files
3. AI generates a structured context summary (stack, state, spec, changelog, points of attention)
4. AI generates exactly 5 actionable tasks for the current development cycle
5. User reviews each task: approve ✓ / reject ✗ / edit ✏️
6. Approved tasks execute via Claude AI agent (bypassPermissions) with live log streaming
7. User validates result: commit ✓ or rollback ↺
8. CHANGELOG.md in the target repo is updated on each commit (Keep a Changelog format)
9. Push to GitHub when ready
10. Generate next cycle — the loop is infinite

**Architecture**
- New Prisma models: `RepoSession` + `RepoTask` (with `onDelete: Cascade`)
- Server-only `lib/repo-engine.ts` — scanRepo, generateCycleTasks, executeRepoTask, commitRepoTask, rollbackRepoTask, pushRepoSession
- Git operations via `execSync` (validate repo, git add -A, git commit, git diff, git push, git checkout --)
- Background fire-and-forget pattern: client polls every 2s during SCANNING/EXECUTING states
- API routes: `POST /api/repo-engine`, `GET /api/repo-engine/[id]`, and sub-routes for scan, generate, task CRUD, execute, commit, rollback, push
- Client: `RepoEngineView` with context panel (collapsible, markdown rendered) + task cards with diff preview

**UI**
- New routes: `/repo-engine` (session list + new session form) and `/repo-engine/[id]` (full session view)
- Task cards: border-left color by priority (high=red, medium=gold, low=blue), live log panel, git diff preview
- Sidebar nav: `⊕ Task Engine` link added
- Dashboard: Task Engine option added to header buttons and card grid

---

## [0.6.0] — 2026-03-24

### GitHub Project Bootstrapper

New 6-step wizard that creates and initializes a complete GitHub repository from a plain-language idea.

**Workflow**
1. AI generates repository name and description → user reviews and edits
2. Creates GitHub repo via API → user confirms clone destination
3. Clones repo locally → AI generates README.md → user reviews/edits
4. User approves README → CHANGELOG.md generated from template → user reviews/edits
5. User approves CHANGELOG → AI generates TASKS.md (exactly 5 tasks) → user reviews/edits
6. User approves TASKS.md → git commit + push → done

**Architecture**
- State machine: `currentStep` (1–6) + `stepStatus` (GENERATING | REVIEW | EXECUTING | DONE | ERROR | CANCELLED)
- Background async pattern: approve sets EXECUTING, background function runs, client polls every 2s
- New `GitHubBootstrap` Prisma model with full session state
- Server-only `lib/github-bootstrap.ts` — AI generation, git operations, GitHub API calls
- API: `POST /api/github-bootstrap`, `GET /api/github-bootstrap/[id]`, `POST /api/github-bootstrap/[id]/execute`
- Client: `BootstrapWizard` component with step progress bar, editable textareas, preview toggle

**UI**
- New route: `/github/bootstrap`
- Sidebar nav link: ⌥ Bootstrap Repo
- Dashboard header secondary button + empty state button + grid card
- Step progress bar with gold current step, green completed, red error
- All AI-generated content (README, TASKS.md) editable before approval, with markdown preview toggle
- Error display with retry option

**Files added**
- `lib/github-bootstrap.ts`
- `app/api/github-bootstrap/route.ts`
- `app/api/github-bootstrap/[id]/route.ts`
- `app/api/github-bootstrap/[id]/execute/route.ts`
- `app/(dashboard)/github/bootstrap/page.tsx`
- `components/github-bootstrap/BootstrapWizard.tsx`

---

## [0.5.2] — 2026-03-23

### Live execution log in task cards

Tasks now show a real-time log panel while the AI agent is running, and keep it visible after completion or failure.

**What the log shows**
- `Agent started — {type}` on launch
- `→ Write / Edit / Bash / Read …` for every tool call the agent makes
- `✎ Generating… (N chars)` progress updates every ~400 chars of text output
- `✓ Agent finished (Xs)` when the model completes
- `Deploying to Vercel…` / `🚀 Deployed → https://…` for landing page tasks
- `↑ path/to/file` for each file pushed to GitHub
- `✗ Failed: …` on error

**Behaviour**
- Log panel auto-scrolls to the bottom as new lines arrive
- Shows "LIVE LOG" with a spinner while executing, "EXECUTION LOG" when done
- Card auto-expands when a task starts executing so the log is immediately visible
- Logs are persisted in `task.result.logs` — survive page refresh

---

## [0.5.1] — 2026-03-23

### Revert task to pending review

Tasks in the history (completed, failed, rejected, or approved) can now be sent back to the approval queue.

- `↺` revert button added to all history task cards
- On click: status resets to `PENDING_REVIEW`, result, error message, and execution timestamps are cleared
- Edited title/description and user notes are preserved
- API: new `revert` action on `PATCH /api/companies/:id/tasks/:tid`

---

## [0.5.0] — 2026-03-23

### Integrations settings page

API tokens can now be entered directly in the app — no `.env.local` editing required.

**New page: `/settings` (Integrations)**
- Accessible via the "Integrations" link at the bottom of the sidebar
- Vercel section: API token + optional Team ID — with configured/not-configured status indicator
- GitHub section: Personal Access Token — with status indicator
- Tokens are shown masked (`••••••••1234`) and never sent to the client in plain text
- Show/hide toggle on each token field
- Leaving a field empty on save keeps the existing value
- Clearing a token removes it

**Storage**
- New `UserSettings` model in the database (Prisma migration `20260323_add_user_settings`)
- Tokens encrypted at rest using AES-256-GCM (`lib/encryption.ts`)
- Generated a valid `ENCRYPTION_KEY` in `.env.local`

**Token resolution order**
- DB settings take priority over env vars — so the UI always wins
- Falls back to `VERCEL_TOKEN` / `GITHUB_TOKEN` env vars if not set in UI
- `lib/settings.ts` — new shared helper: `getUserTokens()`, `saveUserTokens()`, `maskToken()`

**Task execution**
- Execute route now loads tokens via `getUserTokens()` before deploying or pushing

---

## [0.4.0] — 2026-03-23

### Real deployments for task outputs

Tasks no longer just produce text — they now build and deploy real things.

**Landing page deployment (Vercel)**
- `LANDING_PAGE` tasks now prompt Claude to generate a complete, self-contained HTML page
- After generation, the HTML is automatically deployed to Vercel via the REST API
- The live URL is saved to `company.landingPageUrl` and shown as a clickable link in the task card
- Requires `VERCEL_TOKEN` in `.env.local` (optional — gracefully skipped if absent)
- Optional `VERCEL_TEAM_ID` support for team accounts

**Code push to GitHub**
- `API_SCAFFOLD` tasks now push generated code files directly to the company's linked GitHub repo
- Files are parsed from the model output using `=== FILE: path ===` delimiters
- Uses `GITHUB_TOKEN` in `.env.local` (optional — gracefully skipped if absent)
- Pushed file paths are shown in the task card result

**Type-specific prompts**
- Each agent type now receives a tailored prompt instead of a generic one:
  - `LANDING_PAGE` — asks for production-ready single-file HTML, no fences
  - `API_SCAFFOLD` — asks for structured file output with `=== FILE ===` blocks
  - `LINKEDIN_POST` — 150–300 words, professional tone, hashtags
  - `TWITTER_POST` — under 280 characters, punchy
  - `REDDIT_POST` — subreddit suggestion + genuine community-style post
  - `HACKERNEWS_POST` — Show HN / Ask HN format, technical and honest
  - `GROWTH_MARKETING` — structured plan with channels, KPIs, tactics
  - `KAGGLE_POST` — community post or competition strategy

**New utilities**
- `lib/vercel.ts` — uploads file blobs and creates Vercel deployments via API
- `lib/github.ts` — added `pushFileToGithub()` to create or update files in a repo

**Task card UI**
- Completed tasks now show a "deployed →" banner with a live link (green)
- Pushed GitHub files listed under "pushed to github →" (blue)
- Text output still shown below

---

## [0.3.0] — 2026-03-23

### Task system — generate, review, execute

Full task management workflow added.

**Task generation**
- Generate 5 tasks per batch via the orchestrator agent (Claude Code SDK)
- Tasks are created in `PENDING_REVIEW` status for human approval
- Orchestrator uses company description, strategy, GitHub context, and recent activity logs to pick relevant tasks

**Task review UI (`TaskList`, `TaskCard`)**
- Tasks grouped by status: Pending Review → Approved → History
- Per-task: edit title/description before approving, add a note for the AI, approve ✓ or reject ✗
- "Approve All" batch button when multiple tasks are pending
- Department color coding by agent type (strategy/gold, engineering/green, outreach/blue, marketing/purple, ops/red)

**Task execution**
- Approved tasks can be run individually with the ⚡ Run button
- Execution runs via Claude Code SDK (`query()`) in the background
- Status transitions: `APPROVED` → `EXECUTING` → `COMPLETED` / `FAILED`
- Auto-polling every 3 seconds while any task is executing
- Executing banner shown while AI is working
- Spinner on the task card while running; "✓ done" badge when complete

**Task output**
- Output stored as JSON in the task `result` field
- Rendered as formatted markdown in the task card (collapsible)
- Error message displayed if the task fails

---

## [0.2.0] — 2026-03-23

### GitHub repository context

**Company → GitHub repo linking**
- Optional GitHub repo URL field in the company creation form
- `GithubRepoSection` component: shows repo metadata, edit/remove controls
- Repo context (README, file tree, description, language, topics) fetched on link and stored as `githubContext` on the company

**AI context enrichment**
- Company init agent and orchestrator receive the GitHub context in their prompts
- Enables strategy and task generation that reflects the actual codebase

---

## [0.1.0] — 2026-03-23

### Foundation

**Authentication**
- Removed Clerk entirely — no login required
- Anonymous local user (`admin@caio.local`) auto-created via `lib/auth.ts`
- `proxy.ts` replaces `middleware.ts` (Next.js 16 convention) — simple pass-through

**Database**
- Switched from PostgreSQL/Supabase to SQLite for local development
- Prisma 7 with `@prisma/adapter-better-sqlite3` adapter
- Database URL configured in `prisma.config.ts` (not `schema.prisma` — Prisma 7 breaking change)

**AI agents**
- Replaced raw Anthropic API with Claude Code SDK (`@anthropic-ai/claude-agent-sdk`)
- Uses existing Claude Code CLI session — no separate API key needed
- `ANTHROPIC_API_KEY` must be absent or unset (Claude Code SDK uses CLI credentials)

**Company management**
- Create companies with name, description, idea prompt
- Strategy generated automatically on creation via `CompanyInitAgent`
- Strategy displayed with proper markdown rendering (via `react-markdown`)
- Delete company with cascade (tasks, activity logs, agent runs)

**UI**
- Landing page with single "Get Started →" CTA
- Dashboard: company list, create form, company detail page
- CAIO design system: dark theme, JetBrains Mono font, gold/green/blue accent colors
- `Markdown` component with CAIO-styled headings, bold, tables, lists
