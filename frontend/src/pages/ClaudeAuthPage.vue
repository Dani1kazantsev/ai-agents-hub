<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { CheckCircle, ExternalLink, Loader2, LogOut, ShieldCheck } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const status = ref<'checking' | 'not_connected' | 'connecting' | 'waiting_url' | 'connected'>('checking')
const authUrl = ref('')
const terminalOutput = ref<string[]>([])
const ws = ref<WebSocket | null>(null)

async function checkStatus() {
  status.value = 'checking'
  await auth.checkClaudeAuth()
  status.value = auth.claudeAuthenticated ? 'connected' : 'not_connected'
}

function startAuth() {
  status.value = 'connecting'
  terminalOutput.value = []
  authUrl.value = ''

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = localStorage.getItem('token')
  const socket = new WebSocket(`${protocol}//${window.location.host}/api/claude-auth/terminal?token=${token}`)

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data)

    if (data.type === 'output') {
      terminalOutput.value.push(data.data)
    } else if (data.type === 'auth_url') {
      authUrl.value = data.url
      status.value = 'waiting_url'
    } else if (data.type === 'done') {
      if (data.success) {
        status.value = 'connected'
        auth.claudeAuthenticated = true
        toast.success('Claude аккаунт подключен!')
      } else {
        status.value = 'not_connected'
        toast.error('Не удалось подключить аккаунт')
      }
    } else if (data.type === 'error') {
      status.value = 'not_connected'
      toast.error(data.content || 'Ошибка подключения')
    }
  }

  socket.onclose = () => {
    if (status.value === 'connecting') {
      status.value = 'not_connected'
    }
  }

  ws.value = socket
}

async function disconnect() {
  try {
    const res = await fetch('/api/claude-auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    })
    if (res.ok) {
      auth.claudeAuthenticated = false
      status.value = 'not_connected'
      toast.success('Claude аккаунт отключен')
    }
  } catch {
    toast.error('Ошибка при отключении')
  }
}

onUnmounted(() => {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
})

checkStatus()
</script>

<template>
  <div class="flex-1 flex items-center justify-center p-6">
    <div class="w-full max-w-lg">

      <!-- Header -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 rounded-2xl bg-[#5988FF]/10 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck class="w-8 h-8 text-[#5988FF]" />
        </div>
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Claude аккаунт</h1>
        <p class="text-sm text-[var(--color-text-secondary)] mt-2">
          Подключите ваш Claude Team аккаунт для работы с агентами
        </p>
      </div>

      <!-- Checking -->
      <div v-if="status === 'checking'"
           class="bg-[var(--color-bg-subtle)] rounded-xl p-8 text-center border border-[var(--color-border)]">
        <Loader2 class="w-8 h-8 animate-spin text-[#5988FF] mx-auto mb-3" />
        <p class="text-sm text-[var(--color-text-secondary)]">Проверка статуса...</p>
      </div>

      <!-- Connected -->
      <div v-else-if="status === 'connected'"
           class="bg-[var(--color-bg-subtle)] rounded-xl p-8 border border-[var(--color-border)]">
        <div class="flex items-center gap-3 mb-6">
          <CheckCircle class="w-6 h-6 text-green-500 shrink-0" />
          <div>
            <p class="font-medium text-[var(--color-text-primary)]">Аккаунт подключен</p>
            <p class="text-sm text-[var(--color-text-secondary)]">Ваш Claude Team аккаунт активен</p>
          </div>
        </div>

        <div class="flex gap-3">
          <button @click="router.push('/catalog')"
                  class="flex-1 px-4 py-2.5 bg-[#5988FF] text-white rounded-lg text-sm font-medium hover:bg-[#4A75E6] transition-colors">
            Перейти в каталог
          </button>
          <button @click="disconnect"
                  class="px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors flex items-center gap-2">
            <LogOut class="w-4 h-4" />
            Отключить
          </button>
        </div>
      </div>

      <!-- Not Connected -->
      <div v-else-if="status === 'not_connected'"
           class="bg-[var(--color-bg-subtle)] rounded-xl p-8 border border-[var(--color-border)]">
        <div class="mb-6">
          <h3 class="font-medium text-[var(--color-text-primary)] mb-2">Как это работает</h3>
          <ol class="text-sm text-[var(--color-text-secondary)] space-y-2 list-decimal list-inside">
            <li>Нажмите "Подключить" — откроется процесс авторизации</li>
            <li>Вы получите ссылку для входа в Claude</li>
            <li>Перейдите по ссылке и войдите в свой Team аккаунт</li>
            <li>После авторизации — можете работать с агентами</li>
          </ol>
        </div>

        <button @click="startAuth"
                class="w-full px-4 py-2.5 bg-[#5988FF] text-white rounded-lg text-sm font-medium hover:bg-[#4A75E6] transition-colors">
          Подключить Claude аккаунт
        </button>
      </div>

      <!-- Connecting / Waiting URL -->
      <div v-else
           class="bg-[var(--color-bg-subtle)] rounded-xl p-8 border border-[var(--color-border)]">

        <!-- Auth URL -->
        <div v-if="authUrl" class="mb-6">
          <p class="text-sm text-[var(--color-text-primary)] font-medium mb-2">
            Перейдите по ссылке для авторизации:
          </p>
          <a :href="authUrl" target="_blank" rel="noopener noreferrer"
             class="flex items-center gap-2 px-4 py-3 bg-[#5988FF]/10 border border-[#5988FF]/30 rounded-lg text-[#5988FF] text-sm hover:bg-[#5988FF]/20 transition-colors break-all">
            <ExternalLink class="w-4 h-4 shrink-0" />
            {{ authUrl }}
          </a>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">
            После авторизации в браузере, вернитесь сюда — статус обновится автоматически
          </p>
        </div>

        <!-- Loading state -->
        <div v-else class="text-center mb-4">
          <Loader2 class="w-6 h-6 animate-spin text-[#5988FF] mx-auto mb-2" />
          <p class="text-sm text-[var(--color-text-secondary)]">Запуск авторизации...</p>
        </div>

        <!-- Terminal output -->
        <div v-if="terminalOutput.length > 0"
             class="bg-[var(--color-bg-main)] rounded-lg border border-[var(--color-border)] p-3 max-h-48 overflow-y-auto">
          <p class="text-xs font-mono text-[var(--color-text-muted)] mb-1">Вывод терминала:</p>
          <div class="text-xs font-mono text-[var(--color-text-secondary)] space-y-0.5">
            <p v-for="(line, i) in terminalOutput" :key="i">{{ line }}</p>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
