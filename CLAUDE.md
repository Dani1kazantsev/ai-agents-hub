# CLAUDE.md — AI Agent Hub

## Project Overview

AI agent marketplace platform. Web platform where teams discover and use AI agents with access to company tools (Jira, GitLab, DB, Docs).

## Architecture

- **Frontend**: Vue 3, Vite, Tailwind CSS, Pinia for state
- **Backend**: FastAPI (Python 3.12), SQLAlchemy, Alembic
- **LLM**: Claude Code CLI (subprocess per user, stream-json protocol)
- **Integrations**: MCP protocol — each service (Jira, GitLab, DB, Docs) is a separate MCP server
- **DB**: PostgreSQL (main), Redis (cache + queues)

## Key Directories

- `frontend/src/pages/` — Vue pages
- `frontend/src/components/` — Vue components
- `frontend/src/stores/` — Pinia stores
- `agents/` — YAML agent configs (name, prompt, tools, permissions)
- `docs/` — Architecture docs, API specs
- `design/` — UI/UX designs in .pen format

## Conventions

- Language: TypeScript (frontend), Python (backend, MCP servers)
- Frontend: Vue 3 Composition API, functional style
- API: REST for CRUD, WebSocket for chat streaming
- Agent configs: YAML files in `agents/` directory
- Commits: conventional commits (feat:, fix:, docs:, etc.)
- Branch naming: `feature/`, `fix/`, `docs/` prefixes
- All user-facing text in Russian

## Agent Config Schema

```yaml
name: string           # Display name
description: string    # What the agent does
model: string          # claude-sonnet-4-6 | claude-opus-4-6 | claude-haiku-4-5
system_prompt: string  # Agent instructions
tools: list[string]    # Available MCP tools (service:action format)
max_tokens_per_session: int
allowed_roles: list[string]  # Who can use this agent
```

## MCP Tool Naming

Tools follow `service:action` format:
- `jira:search_issues`, `jira:create_issue`, `jira:update_issue`
- `gitlab:get_repo`, `gitlab:read_file`, `gitlab:list_mrs`, `gitlab:create_mr`
- `db:read_query`, `db:describe_table`, `db:list_tables`
- `docs:get_project`, `docs:get_team`, `docs:search_docs`

## Security Rules

- DB access is READ-ONLY by default
- Write operations (Jira create, GitLab MR) require user confirmation in UI
- Agent sessions are logged for audit
- Token budgets per team/user enforced at API gateway level

## Testing

- Frontend: Vitest
- Backend: pytest + httpx (async)
- MCP servers: pytest with mocked external APIs

## Common Commands

```bash
# Frontend dev
cd frontend && npx vite --port 3000 --host

# Backend dev (separate repo)
cd ../ai-agents-hub-back && uvicorn app.main:app --reload

# Run tests
cd frontend && npm test
```
