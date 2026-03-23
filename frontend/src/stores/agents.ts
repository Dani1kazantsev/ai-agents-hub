import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { Agent } from '@/types'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref<Agent[]>([])
  const loading = ref(false)
  const selectedAgent = ref<Agent | null>(null)
  const integrations = ref<Record<string, boolean>>({})

  async function fetchAgents(search?: string, tags?: string[]) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (tags?.length) params.set('tags', tags.join(','))
      const query = params.toString()
      const response = await api.get<{ items: Agent[]; total: number }>(`/agents${query ? `?${query}` : ''}`)
      agents.value = response.items
    } finally {
      loading.value = false
    }
  }

  async function fetchAgent(id: string) {
    selectedAgent.value = await api.get<Agent>(`/agents/${id}`)
  }

  async function fetchIntegrations() {
    try {
      integrations.value = await api.get<Record<string, boolean>>('/agents/integrations/status')
    } catch {
      // ignore
    }
  }

  function agentRequiresPencil(agent: Agent): boolean {
    return agent.tools?.some(t => t.startsWith('pencil:')) ?? false
  }

  return { agents, loading, selectedAgent, integrations, fetchAgents, fetchAgent, fetchIntegrations, agentRequiresPencil }
})
