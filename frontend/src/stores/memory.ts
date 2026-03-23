import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { MemoryEntry } from '@/types'

interface MemoryStats {
  total_entries: number
  total_tokens: number
  keys: string[]
}

export const useMemoryStore = defineStore('memory', () => {
  const entries = ref<MemoryEntry[]>([])
  const stats = ref<MemoryStats>({ total_entries: 0, total_tokens: 0, keys: [] })
  const loading = ref(false)
  const selectedEntry = ref<MemoryEntry | null>(null)

  async function fetchEntries(agentId: string, search: string = '') {
    loading.value = true
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      entries.value = await api.get<MemoryEntry[]>(`/memory/${agentId}${params}`)
    } catch {
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchStats(agentId: string) {
    try {
      stats.value = await api.get<MemoryStats>(`/memory/${agentId}/stats`)
    } catch {
      stats.value = { total_entries: 0, total_tokens: 0, keys: [] }
    }
  }

  async function getEntry(agentId: string, key: string) {
    try {
      selectedEntry.value = await api.get<MemoryEntry>(`/memory/${agentId}/${encodeURIComponent(key)}`)
    } catch {
      selectedEntry.value = null
    }
  }

  async function updateEntry(agentId: string, key: string, content: string, tags: string[] = []) {
    await api.put(`/memory/${agentId}/${encodeURIComponent(key)}`, { content, tags })
  }

  async function deleteEntry(agentId: string, key: string) {
    await api.delete(`/memory/${agentId}/${encodeURIComponent(key)}`)
    entries.value = entries.value.filter(e => e.key !== key)
  }

  return {
    entries,
    stats,
    loading,
    selectedEntry,
    fetchEntries,
    fetchStats,
    getEntry,
    updateEntry,
    deleteEntry,
  }
})
