# CAIO — Changelog

All notable changes to this project are documented here.

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
