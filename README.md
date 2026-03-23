<p align="center">
  <h1 align="center">AI Agent Hub</h1>
  <p align="center">
    <strong>Your AI team that actually does work.</strong><br/>
    Connect Jira, GitLab, databases, Figma — and let agents handle QA, code review, task management, and more.
  </p>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#integrations">Integrations</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#screenshots">Screenshots</a>
</p>

---

## Why?

Hiring junior developers is expensive and slow. AI Agent Hub gives your team **AI agents that work with your actual tools** — not just chat about them.

- **QA Agent** finds bugs, generates test checklists from Jira tasks, reviews MR diffs
- **PM Agent** creates Jira tasks, decomposes epics, writes sprint reports
- **Dev Agents** (Frontend, Backend, Mobile) review code, suggest fixes, create MRs
- **Data Agent** runs SQL queries and builds reports
- **Designer Agent** works with Figma files and design systems

All agents work through a **chat interface** — just describe what you need in plain language.

## Quickstart

### What you need
- [Docker](https://docs.docker.com/get-docker/) installed
- A [Claude](https://claude.ai) Team or Enterprise account (each team member uses their own)

### Run in 2 minutes

```bash
git clone https://github.com/Dani1kazantsev/ai-agents-hub.git
cd ai-agents-hub
docker compose up
```

Open **http://localhost:3000**:
1. **Register** your account (first user becomes admin)
2. **Connect** your Claude account
3. Go to **Integrations** → connect Jira, GitLab, or any other tool
4. **Start chatting** with agents

No `.env` editing needed — all integrations are configured through the web UI.

## Features

### Agent Catalog
Browse ready-to-use agents by role — QA, Frontend, Backend, PM, Designer, DevOps, Data. Each agent comes pre-configured with the right tools and permissions.

### Chat with Streaming
Talk to agents in real-time. See what they're doing — Jira searches, code reads, SQL queries — as it happens. Markdown, file attachments, image previews.

### Pipelines
Chain agents for complex workflows:
- **Task Development**: PM analyzes → Designer reviews → Dev implements → QA tests
- **MR Review**: Code review → QA checklist → auto-comment
- **Epic Decomposition**: Break epics into tasks with story points

Two modes: **Chat with Team Lead** (human-in-the-loop) or **Auto-execution** (fully automated).

### Integrations Settings
Connect your tools from the admin panel — no config files, no terminal:
- Enter API credentials → **Test Connection** → **Save**
- Supports: Jira, GitLab, PostgreSQL, Figma, project docs
- Credentials stored securely in the database

### Agent Memory
Agents remember context between sessions — decisions, patterns, project knowledge. Personal or team-shared memory.

### Sub-agent Orchestration
Agents delegate tasks to each other. A Team Lead agent can assign code review to Dev, testing to QA, and design check to Designer — in one conversation.

### Admin Panel
- Create and configure agents (no code needed)
- Real-time usage stats per user
- Token budgets and limits
- Agent activation/deactivation

### Multi-language
Full English and Russian support with one-click switcher.

## Integrations

Connect tools through the web UI (**Admin → Integrations**):

| Integration | What agents can do |
|-------------|-------------------|
| **Jira** | Search/create/update issues, manage transitions, add comments |
| **GitLab** | Read code, review MRs, create branches, commit files |
| **Database** | Run read-only SQL queries, explore table schemas |
| **Figma** | Read design files, extract styles and components |
| **Docs** | Access project documentation from GitLab repos |

### Adding custom integrations

For developers who want to add new tool integrations — see the [MCP Servers guide](https://github.com/Dani1kazantsev/ai-agents-hub-back/blob/main/mcp-servers/README.md) in the backend repo.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Web UI (Vue 3)                      │
│      Catalog · Chat · Pipelines · Admin          │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────┐
│              Backend (FastAPI)                    │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │   Claude Code CLI (per-user process)      │   │
│  └────────────────┬─────────────────────────┘   │
│                   │                              │
│  ┌────────────────┴─────────────────────────┐   │
│  │        Tool Integrations (MCP)            │   │
│  │   Jira · GitLab · DB · Figma · Docs      │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────┘
                       │
            PostgreSQL + Redis
```

**Key decisions:**
- Each user authenticates with their **own Claude account** — no shared API keys
- Tool integrations use the [MCP protocol](https://modelcontextprotocol.io/) — modular and extensible
- Credentials stored in the database, configurable from the UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Vite, Tailwind CSS, Pinia, vue-i18n |
| Backend | FastAPI, SQLAlchemy, asyncpg |
| AI | Claude Code CLI (per-user subprocess) |
| Integrations | MCP protocol (Python FastMCP servers) |
| Auth | Email/password (bcrypt + JWT) |
| Database | PostgreSQL 16, Redis 7 |
| Deploy | Docker Compose |

## Screenshots

> Coming soon — contribute screenshots by opening a PR!

## Development

Backend repo: [ai-agents-hub-back](https://github.com/Dani1kazantsev/ai-agents-hub-back)

```bash
# Frontend
cd frontend && npm install && npx vite --port 3000

# Backend (separate repo)
cd ai-agents-hub-back
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT
