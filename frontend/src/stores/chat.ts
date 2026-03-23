import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { ChatSession, ChatMessage, ToolCall, ChatAction, ContextStats, SubagentRun } from '@/types'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const currentSession = ref<ChatSession | null>(null)
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const isThinking = ref(false)
  const wsConnection = ref<WebSocket | null>(null)
  const actions = ref<ChatAction[]>([])
  const activeTools = ref<ToolCall[]>([])
  const pendingConfirm = ref<{ tool_name: string; tool_input: Record<string, unknown>; confirm_id: string } | null>(null)
  const contextStats = ref<ContextStats>({ input_tokens: 0, output_tokens: 0, context_limit: 200000, usage_percent: 0 })
  const subagentRuns = ref<SubagentRun[]>([])
  const contextCompacted = ref(false)

  async function fetchSessions() {
    const response = await api.get<{ items: ChatSession[]; total: number }>('/chat/sessions')
    sessions.value = response.items
  }

  async function createSession(agentId: string): Promise<ChatSession> {
    const session = await api.post<ChatSession>('/chat/sessions', { agent_id: agentId })
    currentSession.value = session
    messages.value = []
    actions.value = []
    activeTools.value = []
    return session
  }

  function getOrCreateAssistantMessage(sessionId: string): ChatMessage {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant' && !last.id) {
      return last
    }
    const msg: ChatMessage = {
      id: '',
      session_id: sessionId,
      role: 'assistant',
      content: '',
      tool_calls: [],
      tool_results: [],
      tokens_used: 0,
      created_at: new Date().toISOString(),
    }
    messages.value.push(msg)
    return msg
  }

  async function deleteSession(sessionId: string) {
    await api.delete(`/chat/sessions/${sessionId}`)
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
  }

  function connectWebSocket(sessionId: string) {
    disconnect()
    subagentRuns.value = []
    contextStats.value = { input_tokens: 0, output_tokens: 0, context_limit: 200000, usage_percent: 0 }
    contextCompacted.value = false
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = localStorage.getItem('token')
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/chat/ws/${sessionId}?token=${token}`)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'stream') {
        isThinking.value = false
        isStreaming.value = true
        actions.value = []
        const msg = getOrCreateAssistantMessage(sessionId)
        msg.content += data.content
      } else if (data.type === 'tool_use') {
        isThinking.value = false
        isStreaming.value = true
        actions.value = []
        const toolCall: ToolCall = {
          tool_name: data.tool_name,
          tool_input: data.tool_input || {},
        }
        activeTools.value.push(toolCall)
        const msg = getOrCreateAssistantMessage(sessionId)
        if (!msg.tool_calls) msg.tool_calls = []
        msg.tool_calls.push(toolCall)
      } else if (data.type === 'tool_result') {
        activeTools.value = activeTools.value.filter(t => t.tool_name !== data.tool_name)
        const msg = getOrCreateAssistantMessage(sessionId)
        if (!msg.tool_results) msg.tool_results = []
        msg.tool_results.push({
          tool_name: data.tool_name,
          content: data.content || '',
        })
      } else if (data.type === 'image') {
        const msg = getOrCreateAssistantMessage(sessionId)
        if (!msg.images) msg.images = []
        msg.images.push(data.url)
      } else if (data.type === 'tool_confirm') {
        pendingConfirm.value = {
          tool_name: data.tool_name,
          tool_input: data.tool_input || {},
          confirm_id: data.confirm_id || '',
        }
      } else if (data.type === 'done') {
        isThinking.value = false
        isStreaming.value = false
        activeTools.value = []
        // Mark all running subagents as completed
        for (const run of subagentRuns.value) {
          if (run.status === 'running') {
            run.status = 'completed'
            run.completed_at = new Date().toISOString()
          }
        }
        if (data.actions && Array.isArray(data.actions)) {
          actions.value = data.actions
        }
        const last = messages.value[messages.value.length - 1]
        if (last && last.role === 'assistant' && !last.id) {
          last.id = data.message_id || self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)
          last.tokens_used = data.tokens_used || 0
        }
        // Attach files from done event
        if (data.files && Array.isArray(data.files) && data.files.length > 0) {
          const msg = messages.value[messages.value.length - 1]
          if (msg && msg.role === 'assistant') {
            if (!msg.files) msg.files = []
            msg.files.push(...data.files)
          }
        }
      } else if (data.type === 'context_stats') {
        contextStats.value = {
          input_tokens: data.input_tokens,
          output_tokens: data.output_tokens,
          context_limit: data.context_limit,
          usage_percent: data.usage_percent,
        }
      } else if (data.type === 'context_compacted') {
        contextCompacted.value = true
        setTimeout(() => { contextCompacted.value = false }, 5000)
      } else if (data.type === 'subagent_spawned') {
        subagentRuns.value.push({
          id: data.run_id,
          agent_id: data.agent_id || '',
          agent_name: data.agent_name,
          task: data.task,
          status: 'running',
          result: null,
          depth: data.depth || 1,
          created_at: new Date().toISOString(),
          completed_at: null,
        })
      } else if (data.type === 'subagent_completed') {
        const run = subagentRuns.value.find(r => r.id === data.run_id)
        if (run) {
          run.status = data.status || 'completed'
          run.result = data.result || null
          run.completed_at = new Date().toISOString()
        }
      } else if (data.type === 'error') {
        isThinking.value = false
        isStreaming.value = false
        activeTools.value = []
      }
    }

    ws.onclose = () => {
      isThinking.value = false
      isStreaming.value = false
      activeTools.value = []
      wsConnection.value = null
    }

    wsConnection.value = ws

    // If last message is from user (no assistant reply yet), show thinking indicator
    if (messages.value.length > 0) {
      const last = messages.value[messages.value.length - 1]
      if (last.role === 'user') {
        isThinking.value = true
      }
    }
  }

  function sendMessage(content: string) {
    if (!wsConnection.value || wsConnection.value.readyState !== WebSocket.OPEN) return
    const sessionId = currentSession.value?.id || ''
    actions.value = []
    isThinking.value = true
    messages.value.push({
      id: self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36),
      session_id: sessionId,
      role: 'user',
      content,
      tokens_used: 0,
      created_at: new Date().toISOString(),
    })
    wsConnection.value.send(JSON.stringify({ type: 'message', content }))
  }

  function executeAction(action: string) {
    if (!wsConnection.value || wsConnection.value.readyState !== WebSocket.OPEN) return
    wsConnection.value.send(JSON.stringify({ type: 'action', action }))
    actions.value = []
    isThinking.value = true
  }

  function approveToolConfirm() {
    if (!wsConnection.value || !pendingConfirm.value) return
    wsConnection.value.send(JSON.stringify({ type: 'tool_confirm_response', confirm_id: pendingConfirm.value.confirm_id, approved: true }))
    pendingConfirm.value = null
  }

  function denyToolConfirm() {
    if (!wsConnection.value || !pendingConfirm.value) return
    wsConnection.value.send(JSON.stringify({ type: 'tool_confirm_response', confirm_id: pendingConfirm.value.confirm_id, approved: false }))
    pendingConfirm.value = null
  }

  function disconnect() {
    if (wsConnection.value) {
      wsConnection.value.close()
      wsConnection.value = null
    }
    isThinking.value = false
    isStreaming.value = false
    activeTools.value = []
  }

  function killSubagent(runId: string) {
    if (!wsConnection.value || wsConnection.value.readyState !== WebSocket.OPEN) return
    wsConnection.value.send(JSON.stringify({ type: 'kill_subagent', run_id: runId }))
    const run = subagentRuns.value.find(r => r.id === runId)
    if (run) run.status = 'killed'
  }

  return {
    sessions,
    currentSession,
    messages,
    isStreaming,
    isThinking,
    wsConnection,
    actions,
    activeTools,
    pendingConfirm,
    contextStats,
    subagentRuns,
    contextCompacted,
    fetchSessions,
    createSession,
    deleteSession,
    connectWebSocket,
    sendMessage,
    executeAction,
    approveToolConfirm,
    denyToolConfirm,
    disconnect,
    killSubagent,
  }
})
