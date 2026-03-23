# AI Agent Hub — Инструкция по деплою

## Обзор

Внутренняя платформа AI-агентов для компании. Сотрудники используют агентов с доступом к Jira, GitLab, БД и другим сервисам.

## Архитектура

```
┌─────────────────────────────────────────────────────┐
│                   Nginx (frontend)                   │
│                       :80                            │
│  /           → SPA (статика Vue 3)                   │
│  /api/*      → proxy_pass backend:8000               │
│  /sso/*      → proxy_pass AUTH_PROVIDER_URL (из env)      │
│  /health     → proxy_pass backend:8000               │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              Backend (FastAPI + Python 3.12)          │
│                    :8000                              │
│  REST API + WebSocket (чат стриминг)                 │
│  Claude CLI subprocess (per-user, Node.js 22)        │
│  MCP серверы: jira, gitlab, db, docs, figma    │
└──────┬──────────────┬───────────────────────────────┘
       │              │
  ┌────▼────┐   ┌─────▼─────┐
  │ Postgres │   │   Redis   │
  │  :5432   │   │   :6379   │
  └──────────┘   └───────────┘
```

4 контейнера: **frontend**, **backend**, **postgres**, **redis**.
PostgreSQL и Redis доступны только внутри docker network, наружу выходит только порт 80 (nginx).

## Репозитории

```
parent-dir/
├── ai-agent-hub/            # Frontend + docker-compose + env-файлы
│   ├── frontend/            # Vue 3 SPA
│   │   ├── Dockerfile
│   │   └── nginx.conf       # Шаблон (SSO_UPSTREAM подставляется из env)
│   ├── docker-compose.yml   # Весь стек
│   ├── .env.dev             # Переменные для dev-стенда
│   ├── .env.prod            # Переменные для prod-стенда
│   └── docs/deployment.md   # Этот файл
│
└── ai-agent-hub-back/       # Backend
    ├── Dockerfile           # Python 3.12 + Node.js 22 + Claude CLI
    ├── .env                 # Credentials: Jira, GitLab, Figma, SSO и т.д.
    ├── app/                 # FastAPI приложение
    ├── mcp-servers/         # Python MCP серверы (jira, gitlab, db, docs, figma)
    └── migrations/          # Alembic миграции БД
```

**Оба репозитория должны лежать рядом** — docker-compose ссылается на `../ai-agent-hub-back`.

---

## Конфигурация по стендам

Есть **два уровня** env-файлов:

### 1. Стендовый env (docker-compose переменные) → `ai-agent-hub/.env`

Определяет инфраструктурные параметры: БД, SSO, порты. Разный для dev/prod.

| Переменная | Dev | Prod | Описание |
|-----------|-----|------|----------|
| `POSTGRES_USER` | postgres | ai_agent_hub | Юзер PostgreSQL |
| `POSTGRES_PASSWORD` | postgres | сильный пароль | Пароль PostgreSQL |
| `POSTGRES_DB` | ai_agent_hub | ai_agent_hub | Имя БД |
| `AUTH_PROVIDER_URL` | https://your-auth-dev.example.com | https://your-auth.example.com | Эндпоинт SSO |
| `AUTH_HOST` | your-auth-dev.example.com | your-auth.example.com | Host-header для SSO proxy |
| `FRONTEND_PORT` | 80 | 80 | Порт nginx |

### 2. Backend env (credentials сервисов) → `ai-agent-hub-back/.env`

Определяет API-ключи и настройки приложения. **Одинаковый для всех стендов** (ключи к Jira/GitLab/Figma общие), кроме:

| Переменная | Dev | Prod | Описание |
|-----------|-----|------|----------|
| `AUTH_PROVIDER_URL` | your-auth-dev.example.com | your-auth.example.com | SSO для JWT валидации |
| `SSO_JWT_SECRET` | access_secret | **сильный секрет** | JWT подпись |
| `CORS_ORIGINS` | ["http://localhost:3000"] | ["https://ai-agent-hub.example.com"] | Разрешённые origins |
| `EXTERNAL_DATABASE_URL` | (dev БД) | (prod БД, read-only) | Внешняя БД для агента данных |
| `DEBUG` | true | false | SQL логирование |

`DATABASE_URL` и `REDIS_URL` в backend .env **не важны** — docker-compose переопределяет их на docker-имена (`postgres`, `redis`).

---

## Запуск

### Dev-стенд

```bash
# Клонировать оба репо рядом
git clone <frontend-repo> ai-agent-hub
git clone <backend-repo> ai-agent-hub-back

# Использовать dev env
cd ai-agent-hub
cp .env.dev .env

# Проверить backend .env (credentials уже заполнены)
cat ../ai-agent-hub-back/.env

# Запустить
docker compose up -d --build

# Проверить
curl http://localhost/health
# → {"status": "ok"}
```

### Prod-стенд

```bash
cd ai-agent-hub
cp .env.prod .env

# Обязательно заполнить:
# 1. POSTGRES_PASSWORD — сильный пароль
# 2. В ai-agent-hub-back/.env:
#    - SSO_JWT_SECRET — prod секрет
#    - AUTH_PROVIDER_URL=https://your-auth.example.com
#    - CORS_ORIGINS=["https://ai-agent-hub.example.com"]
#    - EXTERNAL_DATABASE_URL — prod read-only БД
#    - DEBUG=false

docker compose up -d --build
```

---

## Миграции БД

Таблицы создаются автоматически при старте backend (`create_all`). Для production рекомендуется Alembic:

```bash
docker compose exec backend alembic upgrade head
```

## Volumes

| Volume | Путь в контейнере | Описание | Backup нужен? |
|--------|-------------------|----------|---------------|
| `pgdata` | /var/lib/postgresql/data | Данные PostgreSQL | **Да** |
| `redisdata` | /data | Кэш Redis | Нет |
| `claude-configs` | /data/claude-configs | Per-user Claude CLI auth | Желательно* |

*При потере `claude-configs` пользователям нужно заново пройти аутентификацию Claude CLI через веб-интерфейс.

## MCP серверы

Запускаются **внутри** backend-контейнера как stdio subprocess (через Claude CLI). Отдельных контейнеров не требуют.

| Сервер | Количество tools | Внешний сервис |
|--------|-----------------|----------------|
| jira | 7 | Jira Cloud API |
| gitlab | 8 | GitLab API |
| db | 3 | PostgreSQL (READ-ONLY) |
| docs | 4 | Internal Docs API |
| figma | 5 | Figma API |

## Claude CLI

Backend использует `@anthropic-ai/claude-code` (npm) для работы с LLM:
- Установлен глобально в backend Dockerfile (Node.js 22)
- Per-user аутентификация: каждый сотрудник входит через Claude Team аккаунт в UI
- Credentials хранятся в volume `claude-configs`

## Сетевые требования

### Исходящий трафик (из backend)

| Назначение | URL | Зачем |
|-----------|-----|-------|
| Claude API | api.anthropic.com:443 | LLM запросы |
| Auth Provider | your-auth-dev.example.com:443 / your-auth.example.com:443 | Аутентификация |
| Jira | your-org.atlassian.net:443 | MCP jira |
| GitLab | gitlab.example.com:443 | MCP gitlab |
| Figma | api.figma.com:443 | MCP figma |

### Входящий трафик

Только **порт 80** (nginx frontend). PostgreSQL и Redis изолированы внутри docker network.

## Health Checks

| Сервис | Проверка | Интервал |
|--------|---------|----------|
| backend | `GET /health` → `{"status": "ok"}` | 10s |
| postgres | `pg_isready` | 5s |
| redis | `redis-cli ping` | 5s |
| frontend | nginx alive (контейнер запущен) | — |

## Обновление

```bash
cd ai-agent-hub
git pull && cd ../ai-agent-hub-back && git pull && cd ../ai-agent-hub

docker compose up -d --build

# Если есть новые миграции
docker compose exec backend alembic upgrade head
```

## Масштабирование

Рассчитано на ~50 пользователей. Backend — 1 инстанс (Claude CLI процессы stateful). Frontend (nginx) — можно горизонтально.
