export interface User {
  id: string
  email: string
  username: string
  first_name: string | null
  last_name: string | null
  role: string
  groups: string[]
  token_budget: number
  tokens_used: number
  onboarding_completed: boolean
}

export interface Agent {
  id: string
  name: string
  description: string | null
  model: string
  system_prompt: string | null
  tools: string[]
  allowed_roles: string[]
  max_tokens_per_session: number
  icon: string | null
  color: string | null
  tags: string[]
  is_active: boolean
  memory_enabled: boolean
  memory_scope: string
  created_at: string
}

export interface ChatSession {
  id: string
  user_id: string
  agent_id: string
  agent_name: string | null
  status: string
  total_tokens: number
  created_at: string
  updated_at: string
  messages: ChatMessage[]
}

export interface ToolCall {
  tool_name: string
  tool_input: Record<string, unknown>
}

export interface ToolResult {
  tool_name: string
  content: string
}

export interface ChatAction {
  label: string
  action: string
  icon: string
}

export interface ChatFile {
  filename: string
  url: string
  size: number
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: ToolCall[]
  tool_results?: ToolResult[]
  images?: string[]
  files?: ChatFile[]
  tokens_used: number
  created_at: string
}

export interface MemoryEntry {
  id: string
  agent_id: string
  user_id: string | null
  scope: string
  key: string
  content: string
  tags: string[]
  source: string | null
  token_count: number
  created_at: string
  updated_at: string
}

export interface ContextStats {
  input_tokens: number
  output_tokens: number
  context_limit: number
  usage_percent: number
}

export interface SubagentRun {
  id: string
  agent_id: string
  agent_name?: string
  task: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed'
  result: string | null
  depth: number
  created_at: string
  completed_at: string | null
}
