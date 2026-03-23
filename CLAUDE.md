# CLAUDE.md — AI Agent Hub

## Project Overview

AI agent marketplace platform. Teams discover and use AI agents with access to company tools (Jira, GitLab, DB, Docs, Figma).

## Architecture

- **Frontend**: Vue 3, Vite, Tailwind CSS v4, Pinia, Vue Router, vue-i18n
- **Backend**: FastAPI (Python 3.12), async SQLAlchemy 2.0, asyncpg, Alembic (separate repo: ai-agents-hub-back)
- **LLM**: Claude Code CLI (per-user subprocess, stream-json protocol)
- **Integrations**: MCP protocol — each service is a standalone Python server, configured via Admin UI or .env
- **DB**: PostgreSQL 16, Redis 7
- **Deploy**: Docker Compose (backend image on Docker Hub)

## Key Directories

- `frontend/src/pages/` — Vue pages (LoginPage, CatalogPage, ChatPage, etc.)
- `frontend/src/components/` — Sidebar, AgentCard, ToolConfirmModal, ToastContainer
- `frontend/src/stores/` — Pinia stores (auth, chat, agents, pipelines, memory)
- `frontend/src/i18n/` — Locale files (en.ts, ru.ts) — all UI strings are i18n
- `agents/` — YAML agent configs (name, prompt, tools, permissions)
- `docs/` — Architecture docs, navigation flow

## Conventions

- Language: TypeScript (frontend), Python (backend)
- Frontend: Vue 3 Composition API (`<script setup>`), functional style
- All user-facing text through vue-i18n `$t()` / `t()` — NO hardcoded strings
- API: REST for CRUD, WebSocket for chat streaming
- Agent configs: YAML files in `agents/` directory
- Commits: conventional commits (feat:, fix:, docs:, etc.)

## MCP Tool Naming

Tools follow `service:action` format:
- `jira:search_issues`, `jira:create_issue`, `jira:update_issue`
- `gitlab:read_file`, `gitlab:list_mrs`, `gitlab:create_mr`
- `db:read_query`, `db:describe_table`, `db:list_tables`
- `docs:get_project`, `docs:get_team`, `docs:search_docs`

## Integration Credentials

Credentials are stored in DB (IntegrationConfig model), managed via Admin → Integrations UI.
Fallback to .env settings if DB has no entry for a service.
MCP server registry: `mcp-servers/registry.json` (declarative — no code changes to add servers).

## Common Commands

```bash
# Frontend dev
cd frontend && npx vite --port 3000 --host

# Backend dev (separate repo: ai-agents-hub-back)
uvicorn app.main:app --reload

# Docker (production)
docker compose up
```
