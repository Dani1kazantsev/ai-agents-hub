<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, MessageSquare, LayoutGrid, Trash2, X } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const chatStore = useChatStore()
const toast = useToast()
const loading = ref(true)
const deletingIds = ref<Set<string>>(new Set())
const deleteConfirm = ref<string | null>(null)

async function confirmDelete(sessionId: string) {
  deleteConfirm.value = sessionId
}

async function deleteChat() {
  const sessionId = deleteConfirm.value
  if (!sessionId) return
  deleteConfirm.value = null
  deletingIds.value.add(sessionId)
  try {
    await chatStore.deleteSession(sessionId)
    toast.success(t('chats.chatDeleted'))
  } catch {
    toast.error(t('chats.chatDeleteError'))
  } finally {
    deletingIds.value.delete(sessionId)
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: t('chats.statusActive'),
    inactive: t('chats.statusInactive'),
    closed: t('chats.statusClosed'),
    error: t('chats.statusError'),
  }
  return map[status] || status
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    active: 'text-green-600 bg-green-50 dark:bg-green-500/10',
    inactive: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    closed: 'text-text-secondary bg-bg-subtle',
    error: 'text-red-600 bg-red-50 dark:bg-red-500/10',
  }
  return map[status] || 'text-text-secondary bg-bg-subtle'
}

onMounted(async () => {
  loading.value = true
  try {
    await chatStore.fetchSessions()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="p-10">
    <div class="flex items-start justify-between mb-8">
      <div>
        <h1 class="font-heading text-[32px] font-medium tracking-[-1px] text-text-primary">
          {{ $t('chats.title') }}
        </h1>
        <p class="text-sm text-text-secondary mt-1">{{ $t('chats.subtitle') }}</p>
      </div>
      <button
        class="font-heading flex items-center gap-2 bg-brand text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        @click="router.push('/catalog')"
      >
        <Plus :size="18" />
        {{ $t('chats.newChat') }}
      </button>
    </div>
    <div class="border border-border rounded-xl overflow-hidden">
      <div class="grid grid-cols-[1fr_2fr_180px_120px_56px] bg-bg-subtle text-xs font-medium text-text-secondary uppercase tracking-wider">
        <div class="px-5 py-3">{{ $t('common.agent') }}</div>
        <div class="px-5 py-3">{{ $t('chats.lastMessage') }}</div>
        <div class="px-5 py-3">{{ $t('chats.date') }}</div>
        <div class="px-5 py-3">{{ $t('common.status') }}</div>
        <div class="px-5 py-3"></div>
      </div>
      <!-- Loading skeleton -->
      <template v-if="loading">
        <div v-for="n in 4" :key="n" class="grid grid-cols-[1fr_2fr_180px_120px_56px] border-t border-border">
          <div class="px-5 py-4"><div class="h-4 w-24 bg-bg-subtle rounded animate-pulse" /></div>
          <div class="px-5 py-4"><div class="h-4 w-48 bg-bg-subtle rounded animate-pulse" /></div>
          <div class="px-5 py-4"><div class="h-4 w-28 bg-bg-subtle rounded animate-pulse" /></div>
          <div class="px-5 py-4"><div class="h-5 w-16 bg-bg-subtle rounded animate-pulse" /></div>
          <div class="px-5 py-4"></div>
        </div>
      </template>

      <div v-else-if="chatStore.sessions.length === 0" class="px-5 py-16 flex flex-col items-center gap-4">
        <div class="w-[72px] h-[72px] rounded-full bg-bg-subtle border border-border flex items-center justify-center">
          <MessageSquare :size="32" class="text-text-muted" />
        </div>
        <h3 class="font-heading text-xl font-semibold text-text-primary">{{ $t('chats.noChats') }}</h3>
        <p class="text-sm text-text-secondary text-center leading-relaxed max-w-[320px]" v-html="$t('chats.noChatsText').replace('\n', '<br />')">
        </p>
        <button
          class="flex items-center gap-2 bg-brand text-white text-[13px] font-medium font-heading px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity mt-2"
          @click="router.push('/catalog')"
        >
          <LayoutGrid :size="16" />
          {{ $t('chats.goToCatalog') }}
        </button>
      </div>
      <div
        v-for="session in chatStore.sessions"
        v-show="!loading"
        :key="session.id"
        class="grid grid-cols-[1fr_2fr_180px_120px_56px] border-t border-border hover:bg-bg-subtle cursor-pointer transition-colors"
        @click="router.push(`/chats/${session.id}`)"
      >
        <div class="px-5 py-4 text-sm font-medium text-text-primary truncate">
          {{ session.agent_name || $t('common.agent') }}
        </div>
        <div class="px-5 py-4 text-sm text-text-secondary truncate">
          {{ session.messages.length ? session.messages[session.messages.length - 1].content : '...' }}
        </div>
        <div class="px-5 py-4 text-sm text-text-secondary">
          {{ formatDate(session.updated_at) }}
        </div>
        <div class="px-5 py-4">
          <span class="text-xs px-2 py-1 rounded-md" :class="statusColor(session.status)">
            {{ statusLabel(session.status) }}
          </span>
        </div>
        <div class="px-3 py-4 flex items-center justify-center">
          <button
            class="text-text-muted hover:text-red-500 transition-colors p-1 rounded cursor-pointer"
            :title="$t('chats.deleteChat')"
            :disabled="deletingIds.has(session.id)"
            @click.stop="confirmDelete(session.id)"
          >
            <Trash2 :size="16" :class="{ 'animate-pulse': deletingIds.has(session.id) }" />
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div
      v-if="deleteConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="deleteConfirm = null"
    >
      <div class="bg-bg-card border border-border rounded-xl p-6 w-[400px]">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-heading text-lg font-semibold text-text-primary">{{ $t('chats.deleteChatConfirm') }}</h3>
          <button class="text-text-secondary hover:text-text-primary cursor-pointer" @click="deleteConfirm = null">
            <X :size="18" />
          </button>
        </div>
        <p class="text-sm text-text-secondary mb-6">{{ $t('chats.deleteChatText') }}</p>
        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors cursor-pointer"
            @click="deleteConfirm = null"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            class="px-4 py-2 text-sm bg-[#EF4444] text-white rounded-lg hover:opacity-90 transition-opacity font-heading font-medium cursor-pointer"
            @click="deleteChat()"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
