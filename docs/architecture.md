# Architecture — AI Agent Hub

## System Overview

```
User (Browser)
     │
     ▼
┌─────────────────────────────────────────┐
│          Frontend (Next.js 14)           │
│  Catalog │ Chat │ Pipelines │ Admin      │
└──────────────────┬──────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────┐
│          API Gateway (FastAPI)           │
│  Auth │ Rate Limit │ Token Budget │ Log  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Agent Orchestrator (LangGraph)   │
│                                          │
│  Manages agent lifecycle:                │
│  - Load config (YAML)                    │
│  - Initialize tools (MCP clients)        │
│  - Run conversation loop                 │
│  - Chain agents in pipelines             │
│                                          │
│  ┌──────┐ ┌──────┐ ┌─────┐ ┌────────┐  │
│  │  QA  │ │ Dev  │ │ PM  │ │Designer│  │
│  └──┬───┘ └──┬───┘ └──┬──┘ └───┬────┘  │
└─────┼────────┼────────┼────────┼────────┘
      │        │        │        │
┌─────▼────────▼────────▼────────▼────────┐
│          Tool Layer (MCP Protocol)       │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ MCP-Jira │ │MCP-GitLab│ │ MCP-DB  │ │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │             │            │       │
│  ┌────▼─────────────▼────────────▼────┐ │
│  │        MCP-Docs              │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
      │             │            │
      ▼             ▼            ▼
   Jira API    GitLab API   PostgreSQL
```

## Core Components

### 1. Frontend (Next.js)

**Pages:**
- `/` — Dashboard with recent chats and recommended agents
- `/catalog` — Agent catalog with search, filters, and cards
- `/chat/:id` — Chat interface with an agent
- `/pipelines` — Pipeline builder and execution
- `/admin` — Agent management, analytics, budgets

**Key decisions:**
- App Router for server components and streaming
- Zustand for client state (no Redux overhead)
- WebSocket connection for real-time chat streaming
- Optimistic UI updates for smooth UX

### 2. Backend API (FastAPI)

**Modules:**
- `api/auth` — SSO integration, JWT tokens, role management
- `api/agents` — CRUD for agent configs, catalog endpoints
- `api/chat` — Chat session management, WebSocket handler
- `api/pipelines` — Pipeline definitions and execution
- `api/admin` — Analytics, budgets, permissions

**Key decisions:**
- Async handlers for non-blocking I/O
- WebSocket for chat streaming (not SSE — need bidirectional)
- Celery for long-running agent tasks
- Alembic for DB migrations

### 3. Agent Orchestrator (LangGraph)

Manages the execution of AI agents:

```python
# Simplified flow
1. Load agent YAML config
2. Initialize MCP tool clients based on config
3. Build LangGraph state machine:
   - User message → LLM call → Tool calls → LLM response
4. Stream tokens back via WebSocket
5. Save conversation to DB
```

**Pipeline mode:**
```python
# Sequential agent chain
1. User triggers pipeline (e.g., "Review this MR")
2. QA Agent analyzes code → produces report
3. Dev Agent suggests fixes based on report
4. PM Agent creates Jira tickets for remaining issues
5. Results aggregated and sent to user
```

### 4. MCP Servers

Each integration is an independent MCP server process:

#### mcp-jira
- `search_issues(jql)` — Search with JQL
- `get_issue(key)` — Get issue details
- `create_issue(project, type, summary, description)` — Create issue
- `update_issue(key, fields)` — Update fields
- `get_board(board_id)` — Get board with issues
- `add_comment(key, body)` — Add comment

#### mcp-gitlab
- `list_projects()` — List accessible projects
- `get_repo(project_id)` — Repo metadata
- `read_file(project_id, path, ref)` — Read file content
- `list_mrs(project_id, state)` — List merge requests
- `get_mr_diff(project_id, mr_iid)` — Get MR diff
- `create_mr(project_id, source, target, title)` — Create MR
- `add_comment(project_id, mr_iid, body)` — Comment on MR

#### mcp-db
- `list_tables()` — List available tables
- `describe_table(name)` — Get schema
- `read_query(sql)` — Execute SELECT query (read-only enforced)

#### mcp-docs
- `get_project(slug)` — Project info and team
- `get_team(project_slug)` — Team members and roles
- `get_context(project_slug)` — Aggregated project context
- `search_docs(query)` — Search internal documentation

## Data Model

### Core Tables

```sql
-- Agent definitions
agents (
  id UUID PK,
  name VARCHAR,
  description TEXT,
  model VARCHAR,
  system_prompt TEXT,
  tools JSONB,
  allowed_roles JSONB,
  max_tokens_per_session INT,
  is_active BOOLEAN,
  created_by UUID FK -> users,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Chat sessions
chat_sessions (
  id UUID PK,
  user_id UUID FK -> users,
  agent_id UUID FK -> agents,
  project_context JSONB,  -- selected project, board, repo
  status VARCHAR,          -- active, completed, error
  total_tokens INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Chat messages
chat_messages (
  id UUID PK,
  session_id UUID FK -> chat_sessions,
  role VARCHAR,            -- user, assistant, tool
  content TEXT,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_used INT,
  created_at TIMESTAMP
)

-- Pipeline definitions
pipelines (
  id UUID PK,
  name VARCHAR,
  description TEXT,
  steps JSONB,             -- ordered list of {agent_id, input_mapping}
  created_by UUID FK -> users,
  created_at TIMESTAMP
)

-- Pipeline executions
pipeline_runs (
  id UUID PK,
  pipeline_id UUID FK -> pipelines,
  user_id UUID FK -> users,
  status VARCHAR,
  steps_completed INT,
  results JSONB,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)

-- Users (synced from SSO)
users (
  id UUID PK,
  email VARCHAR UNIQUE,
  name VARCHAR,
  role VARCHAR,
  team VARCHAR,
  token_budget INT,
  tokens_used INT,
  created_at TIMESTAMP
)
```

## Security

### Authentication Flow
1. User opens Agent Hub → redirected to SSO
2. SSO returns JWT with user info and roles
3. Backend validates JWT on every request
4. Agent tools inherit user's permissions (e.g., Jira access)

### Authorization Layers
- **UI level**: Pages/features gated by role
- **API level**: Endpoint-level role checks
- **Agent level**: `allowed_roles` in agent config
- **Tool level**: Read-only by default, write ops require confirmation
- **Data level**: MCP servers use user's credentials for external APIs

### Audit
- All LLM requests logged (prompt + response + tools used)
- Token usage tracked per user/team/session
- Write operations (Jira create, GitLab MR) logged with approval status

## Deployment

```
Docker Compose (dev) / Kubernetes (prod)
├── frontend (Next.js container)
├── backend (FastAPI container)
├── mcp-jira (Python container)
├── mcp-gitlab (Python container)
├── mcp-db (Python container)
├── mcp-docs (Python container)
├── postgres (database)
├── redis (cache + broker)
└── celery-worker (background tasks)
```

## Performance Considerations

- LLM streaming via WebSocket for instant feedback
- Redis caching for agent configs and frequent Jira/GitLab queries
- Connection pooling for PostgreSQL (asyncpg)
- Celery for pipeline execution (non-blocking)
- CDN for frontend static assets in production
