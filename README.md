<p align="center">
  <h1 align="center">AI Agent Hub</h1>
  <p align="center">
    Self-hosted AI agent platform for teams.<br/>
    Give your agents access to Jira, GitLab, databases, Figma — and let them work.
  </p>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#mcp-servers">MCP Servers</a> &bull;
  <a href="#screenshots">Screenshots</a> &bull;
  <a href="https://github.com/Dani1kazantsev/ai-agents-hub-back">Backend Repo</a>
</p>

---

## What is this?

AI Agent Hub is a **self-hosted web platform** where your team can discover, configure, and use AI agents that have real access to your company tools — Jira, GitLab, databases, Figma, and more.

Each agent runs as a **Claude Code CLI subprocess** with [MCP](https://modelcontextprotocol.io/) tool integrations. Agents can search Jira, read code from GitLab, query your database, create MRs — all through a chat interface with streaming, tool confirmations, and full audit logging.

**Not another chatbot wrapper.** This is an agent orchestration platform:
- Agents have **persistent memory** between sessions
- **Pipelines** chain multiple agents together (human-in-the-loop or fully automated)
- **Sub-agent delegation** — agents can spawn other agents
- **Admin panel** with per-user token budgets and real-time Claude usage stats

## Quickstart

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) + Claude Team/Enterprise account (each user authenticates with their own account)

### 3 steps to run

```bash
# 1. Clone
git clone https://github.com/Dani1kazantsev/ai-agents-hub.git
cd ai-agents-hub

# 2. Configure (optional — works without integrations too)
cp .env.example .env
# Edit .env to add Jira/GitLab/Figma tokens if needed

# 3. Run
docker compose up
```

Open **http://localhost:3000** — register your account (first user = admin), connect your Claude account, and start chatting with agents.

### Local development (without Docker)

```bash
# Backend (separate repo)
git clone https://github.com/Dani1kazantsev/ai-agents-hub-back.git
cd ai-agents-hub-back
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload  # http://localhost:8000

# Frontend
cd ../ai-agents-hub/frontend
npm install
npx vite --port 3000 --host   # http://localhost:3000
```

## Features

### Agent Catalog
Browse agents by role — QA, Frontend, Backend, PM, Designer, DevOps, Data. Each agent has a system prompt, tool permissions, and token budget.

### Streaming Chat
Real-time chat with Claude. See tool calls as they happen — Jira searches, GitLab file reads, SQL queries — with expand/collapse for results. Markdown rendering, file attachments, image previews.

### Pipelines
Chain agents together for complex workflows:
- **Human-in-the-loop**: AI Team Lead orchestrates agents and talks to you between steps
- **Auto-execution**: Pipeline runs start-to-finish without intervention
- Templates: Task Development, MR Review, QA Checklist, Epic Decomposition, Sprint Report, and more

### Agent Memory
Agents remember context between sessions. Knowledge is stored in PostgreSQL via MCP server — not in filesystem. Personal or shared memory scopes.

### Sub-agent Orchestration
Agents can spawn other agents via MCP tools. A Team Lead agent can delegate code review to Backend Dev, testing to QA, and design review to Designer — all within one conversation.

### Admin Panel
- Create/edit agents with YAML-like configuration
- Real-time Claude CLI usage stats per user
- Token budgets per user
- Agent activation/deactivation

### i18n
Full English and Russian language support with locale switcher.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│           Vue 3 + Vite + Tailwind CSS           │
│         Pinia stores + WebSocket chat            │
└──────────────────────┬──────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────┴──────────────────────────┐
│                    Backend                       │
│              FastAPI + SQLAlchemy                 │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │       Claude Process Manager             │    │
│  │  (per-user CLI subprocess + stream-json) │    │
│  └────────────────┬────────────────────────┘    │
│                   │ stdio                        │
│  ┌────────────────┴────────────────────────┐    │
│  │           MCP Servers                    │    │
│  │  ┌──────┐ ┌──────┐ ┌────┐ ┌──────┐     │    │
│  │  │ Jira │ │GitLab│ │ DB │ │Figma │ ... │    │
│  │  └──────┘ └──────┘ └────┘ └──────┘     │    │
│  └─────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │   PostgreSQL + Redis    │
          └─────────────────────────┘
```

### Key design decisions

- **Claude Code CLI** (not Anthropic SDK) — each user authenticates with their own Claude Team account. No shared API key, no proxy needed.
- **MCP protocol** — each integration is a standalone Python server (FastMCP, stdio transport). Easy to add new ones.
- **Per-user isolation** — each user gets their own `CLAUDE_CONFIG_DIR` with auth tokens and MCP config.

## MCP Servers

Built-in MCP servers in the [backend repo](https://github.com/Dani1kazantsev/ai-agents-hub-back):

| Server | Tools | Description |
|--------|-------|-------------|
| **Jira** | 7 | Search, get, create, update issues; comments; transitions |
| **GitLab** | 8 | Read files, list MRs, diffs, comments, create branches/MRs |
| **DB** | 3 | Read-only SQL queries, table schema, list tables |
| **Docs** | 4 | Project context, architecture docs from GitLab repo |
| **Figma** | 5 | Files, nodes, styles, components, images |
| **Pencil** | 15 | Design operations (requires Pencil app) |
| **Memory** | 4 | Agent memory CRUD (PostgreSQL-backed) |
| **Orchestrator** | 4 | Sub-agent spawning and management |

### Adding your own MCP server

1. Create `mcp-servers/your-service/server.py`:
```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("your-service")

@mcp.tool()
async def your_tool(param: str) -> str:
    """Tool description for the agent."""
    # your logic here
    return result

if __name__ == "__main__":
    mcp.run()
```

2. Add env vars to `.env` and reference them in your server
3. Register the service in `app/services/claude_process.py`
4. Add `your-service:your_tool` to agent YAML configs

## Agent Configuration

Agents are defined as YAML files in `agents/`:

```yaml
name: QA Agent
description: Test cases, bug reports, MR reviews, automated testing
model: claude-sonnet-4-6
system_prompt: |
  You are a Senior QA Engineer...
tools:
  - jira:search_issues
  - jira:get_issue
  - gitlab:list_mrs
  - gitlab:get_mr_diff
  - docs:get_context
allowed_roles: [qa, dev, pm, lead]
max_tokens_per_session: 100000
icon: bug
color: "#10B981"
tags: [qa, testing, review]
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Vite, Tailwind CSS v4, Pinia, Vue Router, vue-i18n |
| Backend | FastAPI, async SQLAlchemy 2.0, asyncpg, Alembic |
| LLM | Claude Code CLI (per-user subprocess, stream-json protocol) |
| MCP | Python FastMCP servers (stdio transport) |
| Auth | Built-in email/password (bcrypt + JWT) or external OAuth2 |
| Database | PostgreSQL 16, Redis 7 |
| Deploy | Docker Compose |

## Screenshots

> Coming soon — contribute screenshots by opening a PR!

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT
