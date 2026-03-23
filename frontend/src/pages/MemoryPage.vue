<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, Brain, Search, Trash2, Save, X, Loader2, Database, FileText, Tag,
} from 'lucide-vue-next'
import { useMemoryStore } from '@/stores/memory'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const memoryStore = useMemoryStore()
const toast = useToast()

const agentId = ref('')
const searchQuery = ref('')
const editingEntry = ref<{ key: string; content: string; tags: string } | null>(null)
const saving = ref(false)

async function loadData() {
  await Promise.all([
    memoryStore.fetchEntries(agentId.value, searchQuery.value),
    memoryStore.fetchStats(agentId.value),
  ])
}

async function handleSearch() {
  await memoryStore.fetchEntries(agentId.value, searchQuery.value)
}

function openEntry(key: string) {
  const entry = memoryStore.entries.find(e => e.key === key)
  if (entry) {
    editingEntry.value = {
      key: entry.key,
      content: entry.content,
      tags: (entry.tags || []).join(', '),
    }
  }
}

async function saveEntry() {
  if (!editingEntry.value) return
  saving.value = true
  try {
    const tags = editingEntry.value.tags.split(',').map(t => t.trim()).filter(Boolean)
    await memoryStore.updateEntry(agentId.value, editingEntry.value.key, editingEntry.value.content, tags)
    toast.success(t('memory.entryUpdated'))
    editingEntry.value = null
    await loadData()
  } catch {
    toast.error(t('memory.saveError'))
  } finally {
    saving.value = false
  }
}

async function deleteEntry(key: string) {
  try {
    await memoryStore.deleteEntry(agentId.value, key)
    toast.success(t('memory.entryDeleted'))
    if (editingEntry.value?.key === key) editingEntry.value = null
    await memoryStore.fetchStats(agentId.value)
  } catch {
    toast.error(t('memory.deleteError'))
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function truncate(text: string, limit: number) {
  return text.length <= limit ? text : text.slice(0, limit) + '...'
}

onMounted(async () => {
  agentId.value = route.params.id as string
  await loadData()
})
</script>

<template>
  <div class="p-6 sm:p-10 max-w-[1200px]">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div class="flex items-center gap-3">
        <button
          class="text-text-secondary hover:text-text-primary transition-colors"
          @click="router.back()"
        >
          <ArrowLeft :size="20" />
        </button>
        <Brain :size="24" class="text-brand" />
        <div>
          <h1 class="font-heading text-2xl font-medium text-text-primary tracking-tight">
            {{ $t('memory.title') }}
          </h1>
          <p class="text-sm text-text-secondary mt-0.5">{{ $t('memory.subtitle') }}</p>
        </div>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-bg-subtle border border-border rounded-xl p-4">
        <div class="text-xs text-text-secondary mb-1">{{ $t('memory.entries') }}</div>
        <div class="text-2xl font-heading font-semibold text-text-primary">{{ memoryStore.stats.total_entries }}</div>
      </div>
      <div class="bg-bg-subtle border border-border rounded-xl p-4">
        <div class="text-xs text-text-secondary mb-1">{{ $t('memory.tokens') }}</div>
        <div class="text-2xl font-heading font-semibold text-text-primary">{{ memoryStore.stats.total_tokens.toLocaleString() }}</div>
      </div>
      <div class="bg-bg-subtle border border-border rounded-xl p-4">
        <div class="text-xs text-text-secondary mb-1">{{ $t('memory.keys') }}</div>
        <div class="text-2xl font-heading font-semibold text-text-primary">{{ memoryStore.stats.keys.length }}</div>
      </div>
    </div>

    <!-- Search -->
    <div class="flex items-center gap-3 mb-6">
      <div class="flex-1 relative">
        <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          v-model="searchQuery"
          :placeholder="$t('memory.searchPlaceholder')"
          class="w-full pl-10 pr-4 py-2.5 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors"
          @keydown.enter="handleSearch"
        />
      </div>
      <button
        class="px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        @click="handleSearch"
      >
        {{ $t('common.find') }}
      </button>
    </div>

    <div class="flex gap-6">
      <!-- Entries list -->
      <div class="flex-1">
        <div v-if="memoryStore.loading" class="flex flex-col gap-3">
          <div v-for="i in 5" :key="i" class="h-20 bg-bg-subtle rounded-lg animate-pulse" />
        </div>

        <div v-else-if="memoryStore.entries.length === 0" class="text-center py-12">
          <Database :size="48" class="mx-auto text-text-muted mb-4" />
          <p class="text-sm text-text-secondary">{{ $t('memory.noEntries') }}</p>
          <p class="text-xs text-text-muted mt-1">{{ $t('memory.noEntriesHelp') }}</p>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="entry in memoryStore.entries"
            :key="entry.id"
            class="border border-border rounded-xl p-4 hover:bg-bg-subtle cursor-pointer transition-colors group"
            :class="editingEntry?.key === entry.key ? 'ring-2 ring-brand bg-bg-subtle' : ''"
            @click="openEntry(entry.key)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <FileText :size="14" class="text-brand shrink-0" />
                  <span class="font-mono text-sm font-medium text-text-primary truncate">{{ entry.key }}</span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-full"
                    :class="entry.scope === 'shared' ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'"
                  >
                    {{ entry.scope === 'shared' ? $t('memory.scopeShared') : $t('memory.scopePersonal') }}
                  </span>
                </div>
                <p class="text-xs text-text-secondary line-clamp-2">{{ truncate(entry.content, 200) }}</p>
                <div class="flex items-center gap-3 mt-2">
                  <span class="text-[10px] text-text-muted">{{ formatDate(entry.updated_at) }}</span>
                  <span class="text-[10px] text-text-muted">{{ entry.token_count }} {{ $t('memory.tokens').toLowerCase() }}</span>
                  <div v-if="entry.tags && entry.tags.length" class="flex gap-1">
                    <span
                      v-for="tag in entry.tags.slice(0, 3)"
                      :key="tag"
                      class="text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand rounded"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
              <button
                class="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                @click.stop="deleteEntry(entry.key)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Editor panel -->
      <div v-if="editingEntry" class="w-[400px] shrink-0">
        <div class="border border-border rounded-xl p-5 sticky top-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-heading text-sm font-medium text-text-primary">{{ $t('memory.editing') }}</h3>
            <button
              class="p-1 rounded text-text-muted hover:text-text-primary"
              @click="editingEntry = null"
            >
              <X :size="16" />
            </button>
          </div>

          <div class="flex flex-col gap-4">
            <div>
              <label class="text-[11px] font-medium text-text-secondary mb-1 block">{{ $t('memory.key') }}</label>
              <div class="font-mono text-sm text-text-primary bg-bg-subtle rounded-lg px-3 py-2">
                {{ editingEntry.key }}
              </div>
            </div>

            <div>
              <label class="text-[11px] font-medium text-text-secondary mb-1 block">{{ $t('memory.content') }}</label>
              <textarea
                v-model="editingEntry.content"
                rows="12"
                class="w-full px-3 py-2 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors resize-none font-mono leading-relaxed"
              />
            </div>

            <div>
              <label class="text-[11px] font-medium text-text-secondary mb-1 block">{{ $t('memory.tagsComma') }}</label>
              <input
                v-model="editingEntry.tags"
                class="w-full px-3 py-2 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary"
                placeholder="jira, patterns"
              />
            </div>

            <button
              class="flex items-center justify-center gap-2 w-full py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              :disabled="saving"
              @click="saveEntry"
            >
              <Loader2 v-if="saving" :size="14" class="animate-spin" />
              <Save v-else :size="14" />
              {{ $t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
