<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { CheckCircle, ExternalLink, Loader2, LogOut, ShieldCheck } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const status = ref<'checking' | 'not_connected' | 'connecting' | 'waiting_url' | 'connected'>('checking')
const authUrl = ref('')
const terminalOutput = ref<string[]>([])
const ws = ref<WebSocket | null>(null)
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)
const authCode = ref('')
const submittingCode = ref(false)

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
      // Poll auth status every 3s — user may complete auth in browser
      startPolling()
    } else if (data.type === 'done') {
      if (data.success) {
        status.value = 'connected'
        auth.claudeAuthenticated = true
        toast.success(t('claudeAuth.connectSuccess'))
      } else {
        status.value = 'not_connected'
        toast.error(t('claudeAuth.connectError'))
      }
    } else if (data.type === 'error') {
      status.value = 'not_connected'
      toast.error(data.content || t('claudeAuth.connectionError'))
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
      toast.success(t('claudeAuth.disconnected'))
    }
  } catch {
    toast.error(t('claudeAuth.disconnectError'))
  }
}

function submitCode() {
  if (!authCode.value.trim() || !ws.value) return
  submittingCode.value = true
  ws.value.send(JSON.stringify({ type: 'input', data: authCode.value.trim() + '\n' }))
  authCode.value = ''
}

function startPolling() {
  if (pollTimer.value) return
  pollTimer.value = setInterval(async () => {
    await auth.checkClaudeAuth()
    if (auth.claudeAuthenticated) {
      status.value = 'connected'
      toast.success(t('claudeAuth.connectSuccess'))
      stopPolling()
      if (ws.value) { ws.value.close(); ws.value = null }
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

onUnmounted(() => {
  stopPolling()
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
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">{{ $t('claudeAuth.title') }}</h1>
        <p class="text-sm text-[var(--color-text-secondary)] mt-2">
          {{ $t('claudeAuth.subtitle') }}
        </p>
      </div>

      <!-- Checking -->
      <div v-if="status === 'checking'"
           class="bg-[var(--color-bg-subtle)] rounded-xl p-8 text-center border border-[var(--color-border)]">
        <Loader2 class="w-8 h-8 animate-spin text-[#5988FF] mx-auto mb-3" />
        <p class="text-sm text-[var(--color-text-secondary)]">{{ $t('claudeAuth.checking') }}</p>
      </div>

      <!-- Connected -->
      <div v-else-if="status === 'connected'"
           class="bg-[var(--color-bg-subtle)] rounded-xl p-8 border border-[var(--color-border)]">
        <div class="flex items-center gap-3 mb-6">
          <CheckCircle class="w-6 h-6 text-green-500 shrink-0" />
          <div>
            <p class="font-medium text-[var(--color-text-primary)]">{{ $t('claudeAuth.accountConnected') }}</p>
            <p class="text-sm text-[var(--color-text-secondary)]">{{ $t('claudeAuth.accountActive') }}</p>
          </div>
        </div>

        <div class="flex gap-3">
          <button @click="router.push('/catalog')"
                  class="flex-1 px-4 py-2.5 bg-[#5988FF] text-white rounded-lg text-sm font-medium hover:bg-[#4A75E6] transition-colors">
            {{ $t('claudeAuth.goToCatalog') }}
          </button>
          <button @click="disconnect"
                  class="px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors flex items-center gap-2">
            <LogOut class="w-4 h-4" />
            {{ $t('claudeAuth.disconnect') }}
          </button>
        </div>
      </div>

      <!-- Not Connected -->
      <div v-else-if="status === 'not_connected'"
           class="bg-[var(--color-bg-subtle)] rounded-xl p-8 border border-[var(--color-border)]">
        <div class="mb-6">
          <h3 class="font-medium text-[var(--color-text-primary)] mb-2">{{ $t('claudeAuth.howItWorks') }}</h3>
          <ol class="text-sm text-[var(--color-text-secondary)] space-y-2 list-decimal list-inside">
            <li>{{ $t('claudeAuth.step1') }}</li>
            <li>{{ $t('claudeAuth.step2') }}</li>
            <li>{{ $t('claudeAuth.step3') }}</li>
            <li>{{ $t('claudeAuth.step4') }}</li>
          </ol>
        </div>

        <button @click="startAuth"
                class="w-full px-4 py-2.5 bg-[#5988FF] text-white rounded-lg text-sm font-medium hover:bg-[#4A75E6] transition-colors">
          {{ $t('claudeAuth.connectButton') }}
        </button>
      </div>

      <!-- Connecting / Waiting URL -->
      <div v-else
           class="bg-[var(--color-bg-subtle)] rounded-xl p-8 border border-[var(--color-border)]">

        <!-- Auth URL -->
        <div v-if="authUrl" class="mb-6">
          <p class="text-sm text-[var(--color-text-primary)] font-medium mb-2">
            {{ $t('claudeAuth.followLink') }}
          </p>
          <a :href="authUrl" target="_blank" rel="noopener noreferrer"
             class="flex items-center gap-2 px-4 py-3 bg-[#5988FF]/10 border border-[#5988FF]/30 rounded-lg text-[#5988FF] text-sm hover:bg-[#5988FF]/20 transition-colors break-all">
            <ExternalLink class="w-4 h-4 shrink-0" />
            {{ authUrl }}
          </a>
          <p class="text-xs text-[var(--color-text-muted)] mt-2">
            {{ $t('claudeAuth.returnHere') }}
          </p>

          <!-- Auth code input -->
          <div class="mt-4 p-4 bg-[var(--color-bg-main)] border border-[var(--color-border)] rounded-lg">
            <p class="text-sm text-[var(--color-text-primary)] font-medium mb-2">
              {{ $t('claudeAuth.pasteCode') }}
            </p>
            <div class="flex gap-2">
              <input
                v-model="authCode"
                type="text"
                :placeholder="$t('claudeAuth.codePlaceholder')"
                class="flex-1 px-3 py-2 border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] rounded-lg text-sm font-mono outline-none focus:border-[#5988FF] transition-colors"
                @keydown.enter="submitCode"
              />
              <button
                @click="submitCode"
                :disabled="!authCode.trim() || submittingCode"
                class="px-4 py-2 bg-[#5988FF] text-white rounded-lg text-sm font-medium hover:bg-[#4A75E6] transition-colors disabled:opacity-50"
              >
                {{ $t('claudeAuth.submitCode') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div v-else class="text-center mb-4">
          <Loader2 class="w-6 h-6 animate-spin text-[#5988FF] mx-auto mb-2" />
          <p class="text-sm text-[var(--color-text-secondary)]">{{ $t('claudeAuth.starting') }}</p>
        </div>

        <!-- Terminal output -->
        <div v-if="terminalOutput.length > 0"
             class="bg-[var(--color-bg-main)] rounded-lg border border-[var(--color-border)] p-3 max-h-48 overflow-y-auto">
          <p class="text-xs font-mono text-[var(--color-text-muted)] mb-1">{{ $t('claudeAuth.terminalOutput') }}</p>
          <div class="text-xs font-mono text-[var(--color-text-secondary)] space-y-0.5">
            <p v-for="(line, i) in terminalOutput" :key="i">{{ line }}</p>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
