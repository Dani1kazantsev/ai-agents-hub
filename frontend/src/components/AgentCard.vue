<script setup lang="ts">
import { computed } from 'vue'
import { Bot, AlertTriangle } from 'lucide-vue-next'
import { useAgentsStore } from '@/stores/agents'
import { useI18n } from 'vue-i18n'
import type { Agent } from '@/types'

const { t } = useI18n()

const props = defineProps<{ agent: Agent }>()
const emit = defineEmits<{ 'open-chat': [agent: Agent] }>()
const agentsStore = useAgentsStore()

const agentColor = computed(() => props.agent.color || '#5988FF')
const bgColor = computed(() => `${agentColor.value}15`)
const pencilUnavailable = computed(() =>
  agentsStore.agentRequiresPencil(props.agent) && !agentsStore.integrations.pencil
)
</script>

<template>
  <div class="border border-border rounded-xl p-6 flex flex-col gap-4 bg-bg-card">
    <div class="flex items-start gap-3">
      <div
        class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        :style="{ backgroundColor: bgColor }"
      >
        <Bot :size="20" :style="{ color: agentColor }" />
      </div>
      <div class="min-w-0">
        <h3 class="font-heading text-base font-medium text-text-primary truncate">{{ agent.name }}</h3>
        <p class="text-xs text-text-secondary mt-0.5">{{ agent.model }}</p>
      </div>
    </div>
    <p class="text-sm text-text-secondary leading-relaxed line-clamp-3 flex-1">
      {{ agent.description }}
    </p>
    <!-- Pencil not installed warning -->
    <div v-if="pencilUnavailable" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <AlertTriangle :size="14" class="text-amber-500 shrink-0" />
      <span class="text-xs text-amber-600 dark:text-amber-400">{{ $t('catalog.requiresPencil') }}</span>
    </div>
    <div class="flex items-center justify-between mt-auto">
      <span
        v-if="agent.tags?.length"
        class="text-xs px-2 py-1 rounded-md bg-bg-subtle text-text-secondary border border-border"
      >
        {{ agent.tags[0] }}
      </span>
      <span v-else />
      <button
        class="font-heading text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
        @click="emit('open-chat', agent)"
      >
        {{ $t('catalog.openChat') }} &rarr;
      </button>
    </div>
  </div>
</template>
