# AI Agent Hub

AI agent marketplace platform. Teams discover and use AI agents with access to company tools (Jira, GitLab, DB, Docs).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 + Vite + Tailwind CSS v4 + Pinia + Vue Router |
| Backend | FastAPI + async SQLAlchemy 2.0 + asyncpg |
| LLM | Claude Code CLI (per-user subprocess, stream-json) |
| Integrations | MCP servers (Jira, GitLab, DB, Docs, Figma, Pencil) |
| Auth | OAuth2 / JWT HS256 |
| Database | PostgreSQL 16 |

## Project Structure

```
ai-agents-hub/
├── frontend/              # Vue 3 application
│   └── src/
│       ├── pages/         # Vue Router pages
│       ├── components/    # Vue components
│       ├── stores/        # Pinia stores
│       ├── composables/   # Vue composables
│       └── lib/           # API client
├── agents/                # Agent YAML configs
├── docs/                  # Architecture docs, navigation flow
└── design/                # UI/UX designs (.pen files)
```

## Pages

- **Login** — OAuth2 auth
- **Catalog** — browse and search agents by role
- **Chat** — streaming chat with markdown, tool_use/tool_result blocks, actions
- **My Chats** — session history
- **Pipelines** — agent chains (human_loop + auto modes)
- **Admin** — agent CRUD, Claude Usage (live stats from session files), user management
- **Claude Auth** — per-user Claude CLI authentication

## Development

```bash
cd frontend && npm install && npx vite --port 3000 --host
```

Backend repo: `ai-agents-hub-back`

## License

MIT
