# Agent Configuration Guide

## Overview

Agents in AI Agent Hub are defined as YAML configuration files. No code is required to create a new agent — just define its behavior, tools, and permissions.

## Config Location

All agent configs live in the `agents/` directory:

```
agents/
├── qa-agent.yaml
├── dev-agent.yaml
├── pm-agent.yaml
├── designer-agent.yaml
└── custom/           # User-created agents
```

## Config Schema

```yaml
# Required fields
name: string              # Display name in catalog
description: string       # Short description (shown on card)
model: string             # LLM model ID

# Agent behavior
system_prompt: string     # System instructions for the agent
temperature: float        # 0.0-1.0, default 0.3
max_tokens_per_session: int  # Token budget per chat session

# Tools and integrations
tools: list[string]       # Available MCP tools (service:action)

# Access control
allowed_roles: list[string]  # Roles that can use this agent
requires_project_context: bool  # Whether agent needs a project selected

# UI
icon: string              # Icon name or emoji
color: string             # Card accent color (hex)
tags: list[string]        # Catalog filter tags
```

## Example Agents

### QA Agent

```yaml
name: "QA Agent"
description: "Test case generation, bug reports, MR review from QA perspective"
model: claude-sonnet-4-6
temperature: 0.2
max_tokens_per_session: 100000

system_prompt: |
  You are a senior QA engineer at the company. Your responsibilities:
  - Review merge requests for potential bugs and edge cases
  - Generate test cases based on requirements
  - Write bug reports in a structured format
  - Suggest improvements to test coverage

  Always reference specific Jira tickets and GitLab MRs when relevant.
  Respond in Russian unless the user writes in English.

tools:
  - jira:search_issues
  - jira:get_issue
  - jira:create_issue
  - jira:add_comment
  - gitlab:get_repo
  - gitlab:read_file
  - gitlab:list_mrs
  - gitlab:get_mr_diff
  - gitlab:add_comment
  - docs:get_project
  - db:read_query

allowed_roles: [qa, dev, pm, lead]
requires_project_context: true
icon: "bug"
color: "#10B981"
tags: [qa, testing, review]
```

### Dev Agent

```yaml
name: "Dev Agent"
description: "Code review, refactoring suggestions, architecture advice"
model: claude-sonnet-4-6
temperature: 0.3
max_tokens_per_session: 150000

system_prompt: |
  You are a senior software engineer at the company. Your responsibilities:
  - Review code for quality, performance, and security
  - Suggest refactoring and architectural improvements
  - Help debug issues using logs and code context
  - Write code snippets and implementation plans

  Follow the project's coding conventions. Reference specific files and line numbers.
  Respond in Russian unless the user writes in English.

tools:
  - gitlab:get_repo
  - gitlab:read_file
  - gitlab:list_mrs
  - gitlab:get_mr_diff
  - gitlab:add_comment
  - jira:search_issues
  - jira:get_issue
  - db:read_query
  - db:describe_table
  - docs:get_project
  - docs:get_context

allowed_roles: [dev, lead, qa]
requires_project_context: true
icon: "code"
color: "#6366F1"
tags: [dev, code-review, architecture]
```

### PM Agent

```yaml
name: "PM Agent"
description: "Sprint planning, ticket management, status reports, analytics"
model: claude-sonnet-4-6
temperature: 0.4
max_tokens_per_session: 80000

system_prompt: |
  You are a product manager at the company. Your responsibilities:
  - Help with sprint planning and backlog grooming
  - Generate status reports from Jira data
  - Analyze project metrics and velocity
  - Draft requirements and user stories

  Use data from Jira and docs to back up your analysis.
  Respond in Russian unless the user writes in English.

tools:
  - jira:search_issues
  - jira:get_issue
  - jira:create_issue
  - jira:update_issue
  - jira:get_board
  - docs:get_project
  - docs:get_team
  - db:read_query

allowed_roles: [pm, lead, dev]
requires_project_context: true
icon: "clipboard"
color: "#F59E0B"
tags: [pm, planning, analytics]
```

### Designer Agent

```yaml
name: "Designer Agent"
description: "UI/UX feedback, design system compliance, accessibility audit"
model: claude-sonnet-4-6
temperature: 0.5
max_tokens_per_session: 80000

system_prompt: |
  You are a senior UI/UX designer at the company. Your responsibilities:
  - Review designs and implementations for UX issues
  - Check compliance with the design system
  - Audit accessibility (WCAG 2.1 AA)
  - Suggest UX improvements based on best practices

  Be specific with feedback — reference components, colors, spacing.
  Respond in Russian unless the user writes in English.

tools:
  - gitlab:read_file
  - gitlab:list_mrs
  - gitlab:get_mr_diff
  - jira:search_issues
  - jira:get_issue
  - docs:get_project

allowed_roles: [designer, dev, pm, lead]
requires_project_context: false
icon: "palette"
color: "#EC4899"
tags: [design, ux, accessibility]
```

## Creating a New Agent

1. Create a YAML file in `agents/` directory
2. Define all required fields (name, description, model, system_prompt, tools)
3. Set appropriate permissions (allowed_roles)
4. Agent appears in catalog automatically after backend restart
5. (Future) Admin UI for creating agents without touching files

## Pipeline Integration

Agents can be chained in pipelines. Each step receives the output of the previous step:

```yaml
# pipelines/mr-review.yaml
name: "Full MR Review"
description: "Complete merge request review: QA + Dev + PM"
steps:
  - agent: qa-agent
    input: "Review MR {{mr_url}} for bugs and test coverage"
  - agent: dev-agent
    input: "Review MR {{mr_url}} for code quality. Previous QA feedback: {{prev_output}}"
  - agent: pm-agent
    input: "Create Jira tickets for issues found: {{prev_output}}"
```
