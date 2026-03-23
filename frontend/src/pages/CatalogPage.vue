<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { useAgentsStore } from '@/stores/agents'
import { useChatStore } from '@/stores/chat'
import AgentCard from '@/components/AgentCard.vue'
import { useToast } from '@/composables/useToast'
import type { Agent } from '@/types'

const router = useRouter()
const agentsStore = useAgentsStore()
const chatStore = useChatStore()
const toast = useToast()

const searchQuery = ref('')
const creatingChat = ref(false)
const activeTag = ref('Все')
const tags = ['Все', 'QA', 'Development', 'Product', 'Design', 'Data']

const tagKeywords: Record<string, string[]> = {
  'QA': ['qa', 'testing', 'review'],
  'Development': ['dev', 'code', 'architecture', 'devops', 'ci-cd', 'infrastructure'],
  'Product': ['pm', 'planning', 'product'],
  'Design': ['design', 'ux', 'ui', 'accessibility'],
  'Data': ['data', 'sql', 'analytics'],
}

const filteredAgents = computed(() => {
  let result = agentsStore.agents
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(
      (a) => a.name.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
    )
  }
  if (activeTag.value !== 'Все') {
    const keywords = tagKeywords[activeTag.value] || []
    result = result.filter((a) =>
      a.tags?.some((t: string) => keywords.includes(t.toLowerCase()))
    )
  }
  return result
})

async function handleOpenChat(agent: Agent) {
  if (creatingChat.value) return

  // Warn if agent needs Pencil but it's not available
  if (agentsStore.agentRequiresPencil(agent) && !agentsStore.integrations.pencil) {
    toast.error('Для работы этого агента необходимо установить Pencil на сервере')
    return
  }

  creatingChat.value = true
  try {
    const session = await chatStore.createSession(agent.id)
    router.push(`/chats/${session.id}`)
  } catch {
    toast.error('Не удалось создать чат')
  } finally {
    creatingChat.value = false
  }
}

onMounted(() => {
  agentsStore.fetchAgents()
  agentsStore.fetchIntegrations()
})
</script>

<template>
  <div class="p-10">
    <div class="flex items-start justify-between mb-2">
      <div>
        <h1 class="font-heading text-[32px] font-medium tracking-[-1px] text-text-primary">
          Каталог агентов
        </h1>
        <p class="text-sm text-text-secondary mt-1">
          Выберите AI-агента для решения вашей задачи
        </p>
      </div>
      <div class="relative">
        <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Поиск агентов..."
          class="w-[280px] pl-10 pr-4 py-2.5 border border-border bg-bg-input rounded-lg text-sm outline-none focus:border-text-secondary transition-colors"
        />
      </div>
    </div>
    <div class="flex gap-2 mt-6 mb-8">
      <button
        v-for="tag in tags"
        :key="tag"
        class="font-heading text-sm px-4 py-2 rounded-lg transition-colors"
        :class="activeTag === tag
          ? 'bg-text-primary text-bg-main'
          : 'border border-border text-text-secondary hover:border-text-secondary'"
        @click="activeTag = tag"
      >
        {{ tag }}
      </button>
    </div>
    <div v-if="agentsStore.loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="n in 6" :key="n" class="border border-border rounded-xl p-6 flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-full bg-bg-subtle animate-pulse shrink-0" />
          <div class="flex-1">
            <div class="h-5 w-32 bg-bg-subtle rounded animate-pulse" />
            <div class="h-3 w-20 bg-bg-subtle rounded animate-pulse mt-2" />
          </div>
        </div>
        <div class="h-4 w-full bg-bg-subtle rounded animate-pulse" />
        <div class="h-4 w-3/4 bg-bg-subtle rounded animate-pulse" />
        <div class="flex items-center justify-between mt-auto">
          <div class="h-6 w-16 bg-bg-subtle rounded animate-pulse" />
          <div class="h-9 w-28 bg-bg-subtle rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <AgentCard
        v-for="agent in filteredAgents"
        :key="agent.id"
        :agent="agent"
        @open-chat="handleOpenChat"
      />
    </div>
    <div v-if="!agentsStore.loading && filteredAgents.length === 0" class="text-sm text-text-secondary mt-4">
      Агенты не найдены
    </div>
  </div>
</template>
