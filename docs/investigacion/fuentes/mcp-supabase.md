# mcp-supabase
Query: Supabase MCP server read only project scoped security production warning
Retrieved: 2026-09-19T01:54:10.729593+00:00

## https://github.com/supabase/supabase/blob/24e8333c54374b94645d77c2170c089c249a7173/apps/docs/content/guides/ai-tools/mcp.mdx
ID: doc:https://github.com/supabase/supabase/blob/24e8333c54374b94645d77c2170c089c249a7173/apps/docs/content/guides/ai-tools/mcp.mdx
## Manual authentication
### CI environment
1. Production projects can contain sensitive data. Before connecting one, scope the server to that project, enable read-only mode, restrict the available feature groups, and review the security risks.

### Manual OAuth app
1. Production projects can contain sensitive data. Before connecting one, scope the server to that project, enable read-only mode, restrict the available feature groups, and review the security risks.

## Security risks
### Prompt injection
Approve in advance only the project-scoped, read-only tools that the routine needs.

### Recommendations
- **Protect production data**: Connect to a production project only when the task requires production evidence. Use project scoping, read-only mode, restricted feature groups, and the narrowest data query that can answer the question. Do not include secrets or unrelated personal data in prompts or reports.
- **Project scoping**: Scope your MCP server to a specific project, limiting access to only that project's resources. This prevents LLMs from accessing data from other projects in your Supabase account.

### Debugging

- `query_logs` - Run a read-only SQL query against project logs to filter, aggregate, or join across log fields. See Query logs with SQL.
- `get_advisors` - Get security and performance advisors

### Development

- `get_project_url` - Get the API URL for a project
- `get_publishable_keys` - Get publishable and legacy anon API keys for a project
- `generate_typescript_types` - Generate TypeScript types from schema

### Edge Functions

- `list_edge_functions` - List all Edge Functions
- `get_edge_function` - Get a specific Edge Function
- `deploy_edge_function` - Deploy an Edge Function

### Account management

Disabled when using project-scoped mode (`project_ref` parameter).

- `list_projects` / `get_project` - List or get project details
- `create_project` / `pause_project` / `restore_project` - Manage projects
- `list_organizations` / `get_organization` - Organization management
- `get_cost` / `confirm_cost` - Cost information

### Docs

- `search_docs` - Search Supabase documentation

### Branching (experimental)

Requires a paid plan.

- `create_branch` / `list_branches` / `delete_branch` - Branch management
- `merge_branch` / `reset_branch` / `rebase_branch` - Branch operations
… (19 more lines)

## https://github.com/njrini99-code/helmv3/blob/8023d0e79bec43aa7e0719862f9c1952162cb1cf/docs/AGENT_LIFECYCLE.md
ID: doc:https://github.com/njrini99-code/helmv3/blob/8023d0e79bec43aa7e0719862f9c1952162cb1cf/docs/AGENT_LIFECYCLE.md
# The agent lifecycle in this repo, and what auditing it found
## Part 2 — The stack, and where everything comes from
### Where data and services come from
- **MCP** — `.mcp.json` declares exactly one server: `supabase`. It must
stay project-scoped and read-only; `apply_migration` and `execute_sql`
hit production directly with `service_role`, which is why a guard
matches those tool names.

## Part 11 — Supabase and Vercel: the tool rules
### Supabase — production is not a place you experiment
MCP warning is always-on rather than path-scoped: an MCP call opens no

- Production MCP access stays **project-scoped and read-only**. Schema
changes belong in a reviewed migration.

### TypeScript is strict, and then some

`strict: true` plus **`noUncheckedIndexedAccess: true`**. That second one
is why `arr[0]` types as `T | undefined` and why the repo convention is
guard-then-assert with `!` and a one-line comment naming the invariant —
never a silent `?? fallback`. Target `es2018`, module `esnext`.

`tsconfig.json` deliberately does **not** include `.next/types/**`. Those
globs match zero files in CI but break `npm run typecheck` locally
(measured: exit 2 with, exit 0 without). `npm run build` re-injects them,
so `scripts/strip-next-tsconfig-injection.mjs` runs as `postbuild` and
removes them again — but only after proving the diff is exactly the known
build artifact, so a deliberate tsconfig edit survives.

### Where data and services come from

- **Supabase** — one project, ref `qmnssrrolpinvwjjnufo`, committed in
  `supabase/.temp/project-ref`. **Production is a single shared database**
  serving golf, baseball and lifting. There is no staging copy.
- **MCP** — `.mcp.json` declares exactly one server: `supabase`. It must
  stay project-scoped and read-only; `apply_migration` and `execute_sql`
  hit production directly with `service_role`, which is why a guard
  matches those tool names.
- **Env** — five files: `.env`, `.env.local`, `.env.example` (412 lines,
  the documentation of what exists), and two `.local` overlays.
  `.worktreeinclude` deliberately **excludes** all of them, so a live
  production secret is not copied into every parallel worktree.
- **Sentry, Vercel, Stripe, Inngest** — all via env, none checked in.

### Claude Code plugins

Five enabled at project scope: `claude-security`, `security-guidance`,
`sentry`, `superpowers`, `vercel`. Fifteen more at user scope. Plugins
installed at project scope also load in worktrees of the same repo.

### Build and deploy

`vercel.json`:
… (19 more lines)

## https://github.com/bytebase/dbhub/blob/c457729960d566226d43af06a0807e0287c6eb92/docs/blog/postgres-mcp-server-review-supabase-mcp.mdx
ID: doc:https://github.com/bytebase/dbhub/blob/c457729960d566226d43af06a0807e0287c6eb92/docs/blog/postgres-mcp-server-review-supabase-mcp.mdx
## Installation

## Security

## Summary
### The Good
- **Better security defaults**: While prompt injection attacks affect all database MCP servers, Supabase implements more security guardrails than most. OAuth authentication with project scoping prevents cross-project access. Read-only mode uses a dedicated `supabase_read_only_user` (not just query filtering).

### Should You Use It?
Follow the security best practices—use `read_only=true`, restrict to specific projects with `project_ref`, and limit feature groups to reduce attack surface.
