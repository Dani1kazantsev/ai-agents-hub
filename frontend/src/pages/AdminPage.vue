<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, TrendingUp, Pencil, Trash2, Bug, Code, Clipboard, Palette,
  Database, Shield, Server, Smartphone, X, Save, ToggleLeft, ToggleRight,
  RefreshCw, Users,
} from 'lucide-vue-next'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()

interface AdminStats {
  total_sessions: number
  total_tokens: number
  active_agents: number
  total_agents: number
  active_users: number
  token_budget: number
}

interface AdminAgent {
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
  session_count: number
  total_tokens: number
  created_at: string
}

const stats = ref<AdminStats>({
  total_sessions: 0,
  total_tokens: 0,
  active_agents: 0,
  total_agents: 0,
  active_users: 0,
  token_budget: 5_000_000,
})

interface ClaudeUserUsage {
  user_id: string
  username: string
  email: string
  claude_authenticated: boolean
  total_sessions: number
  total_messages: number
  first_session: string | null
  last_computed: string | null
  live_today: boolean
  today: { messages: number; sessions: number; tokens: number }
  week: { messages: number; sessions: number; tokens: number }
  models: Record<string, { input_tokens: number; output_tokens: number; cache_read: number; cache_create: number; total: number }>
  daily_activity: { date: string; messages: number; tokens: number }[]
}

const agents = ref<AdminAgent[]>([])
const claudeUsage = ref<ClaudeUserUsage[]>([])
const usageLoading = ref(false)
const usagePeriod = ref<'today' | 'week'>('today')
const loading = ref(true)
let usageInterval: ReturnType<typeof setInterval> | null = null

const agentIcons: Record<string, { icon: any; color: string }> = {
  bug: { icon: Bug, color: '#10B981' },
  code: { icon: Code, color: '#6366F1' },
  clipboard: { icon: Clipboard, color: '#F59E0B' },
  palette: { icon: Palette, color: '#EC4899' },
  database: { icon: Database, color: '#5988FF' },
  shield: { icon: Shield, color: '#0EA5E9' },
  server: { icon: Server, color: '#0EA5E9' },
  smartphone: { icon: Smartphone, color: '#8B5CF6' },
}

function getAgentIcon(agent: AdminAgent) {
  return agentIcons[agent.icon || ''] || agentIcons.code
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'K'
  return String(n)
}

// --- Edit dialog ---
interface AgentForm {
  id?: string
  name: string
  description: string
  model: string
  system_prompt: string
  tools: string
  allowed_roles: string
  max_tokens_per_session: number
  icon: string
  color: string
  tags: string
  is_active: boolean
}

const editDialog = ref<AgentForm | null>(null)
const isNewAgent = ref(false)
const deleteConfirm = ref<string | null>(null)

function openCreateDialog() {
  isNewAgent.value = true
  editDialog.value = {
    name: '',
    description: '',
    model: 'claude-sonnet-4-6',
    system_prompt: '',
    tools: '',
    allowed_roles: 'dev, pm, lead',
    max_tokens_per_session: 50000,
    icon: 'code',
    color: '#6366F1',
    tags: '',
    is_active: true,
  }
}

function openEditDialog(agent: AdminAgent) {
  isNewAgent.value = false
  editDialog.value = {
    id: agent.id,
    name: agent.name,
    description: agent.description || '',
    model: agent.model,
    system_prompt: agent.system_prompt || '',
    tools: (agent.tools || []).join(', '),
    allowed_roles: (agent.allowed_roles || []).join(', '),
    max_tokens_per_session: agent.max_tokens_per_session,
    icon: agent.icon || 'code',
    color: agent.color || '#6366F1',
    tags: (agent.tags || []).join(', '),
    is_active: agent.is_active,
  }
}

function parseList(s: string): string[] {
  return s.split(',').map(v => v.trim()).filter(Boolean)
}

async function saveAgent() {
  if (!editDialog.value) return
  const form = editDialog.value
  const payload = {
    name: form.name,
    description: form.description || null,
    model: form.model,
    system_prompt: form.system_prompt || null,
    tools: parseList(form.tools),
    allowed_roles: parseList(form.allowed_roles),
    max_tokens_per_session: form.max_tokens_per_session,
    icon: form.icon || null,
    color: form.color || null,
    tags: parseList(form.tags),
    is_active: form.is_active,
  }

  try {
    if (isNewAgent.value) {
      await api.post('/agents', payload)
    } else {
      await api.put(`/agents/${form.id}`, payload)
    }
    editDialog.value = null
    await loadData()
  } catch (e) {
    console.error('Failed to save agent:', e)
  }
}

async function toggleActive(agent: AdminAgent) {
  try {
    await api.put(`/agents/${agent.id}`, { is_active: !agent.is_active })
    toast.success(agent.is_active ? 'Агент деактивирован' : 'Агент активирован')
    await loadData()
  } catch {
    toast.error('Не удалось изменить статус агента')
  }
}

async function deleteAgent(id: string) {
  try {
    await api.delete(`/agents/${id}`)
    deleteConfirm.value = null
    toast.success('Агент удалён')
    await loadData()
  } catch {
    toast.error('Не удалось удалить агента')
  }
}

async function loadData() {
  loading.value = true
  try {
    const [s, a] = await Promise.all([
      api.get<AdminStats>('/admin/stats'),
      api.get<AdminAgent[]>('/admin/agents'),
    ])
    stats.value = s
    agents.value = a
  } catch {
    // try loading agents from public API
    try {
      const resp = await api.get<{ items: AdminAgent[]; total: number }>('/agents')
      agents.value = resp.items
    } catch {
      // empty state
    }
  } finally {
    loading.value = false
  }
}

async function loadUsage() {
  usageLoading.value = true
  try {
    claudeUsage.value = await api.get<ClaudeUserUsage[]>('/admin/claude-usage')
  } catch {
    // ignore
  } finally {
    usageLoading.value = false
  }
}

// Compute totals from Claude usage for the metrics cards
function getTotalClaudeTokens(): number {
  return claudeUsage.value.reduce((sum, u) => {
    return sum + Object.values(u.models).reduce((s, m) => s + m.total, 0)
  }, 0)
}

function getTotalClaudeMessages(): number {
  return claudeUsage.value.reduce((sum, u) => sum + u.total_messages, 0)
}

onMounted(() => {
  loadData()
  loadUsage()
  usageInterval = setInterval(loadUsage, 30_000)
})

onUnmounted(() => {
  if (usageInterval) clearInterval(usageInterval)
})
</script>

<template>
  <div class="p-10 max-w-[1200px]">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="font-heading text-[32px] font-medium text-text-primary tracking-tight">Админка</h1>
        <p class="text-sm text-text-secondary mt-1">Управление агентами, аналитика и бюджеты</p>
      </div>
      <button
        class="flex items-center gap-2 bg-brand text-white text-[13px] font-medium font-heading px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        @click="router.push('/admin/agents/new')"
      >
        <Plus :size="16" />
        Создать агента
      </button>
    </div>

    <!-- Metrics -->
    <div class="grid grid-cols-4 gap-5 mb-8">
      <div class="border border-border rounded-xl p-6">
        <p class="text-[13px] text-text-secondary">Всего сессий</p>
        <p class="font-heading text-4xl font-semibold text-text-primary tracking-tight mt-1">
          {{ stats.total_sessions.toLocaleString() }}
        </p>
      </div>

      <div class="border border-border rounded-xl p-6">
        <p class="text-[13px] text-text-secondary">Токенов (Claude CLI)</p>
        <p class="font-heading text-4xl font-semibold text-text-primary tracking-tight mt-1">
          {{ formatTokens(getTotalClaudeTokens()) }}
        </p>
        <p class="text-xs text-text-secondary mt-1">{{ getTotalClaudeMessages().toLocaleString() }} сообщений всего</p>
      </div>

      <div class="border border-border rounded-xl p-6">
        <p class="text-[13px] text-text-secondary">Активных агентов</p>
        <p class="font-heading text-4xl font-semibold text-text-primary tracking-tight mt-1">
          {{ stats.active_agents }}
        </p>
        <p class="text-xs text-text-secondary mt-1">из {{ stats.total_agents }} всего</p>
      </div>

      <div class="border border-border rounded-xl p-6">
        <p class="text-[13px] text-text-secondary">Активных пользователей</p>
        <p class="font-heading text-4xl font-semibold text-text-primary tracking-tight mt-1">
          {{ stats.active_users }}
        </p>
      </div>
    </div>

    <!-- Claude Usage Stats -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <Users :size="20" class="text-text-secondary" />
          <h2 class="font-heading text-lg font-semibold text-text-primary">Claude Usage</h2>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex border border-border rounded-lg overflow-hidden text-xs font-medium">
            <button
              class="px-3 py-1.5 transition-colors cursor-pointer"
              :class="usagePeriod === 'today' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-bg-subtle'"
              @click="usagePeriod = 'today'"
            >Сегодня</button>
            <button
              class="px-3 py-1.5 transition-colors border-l border-border cursor-pointer"
              :class="usagePeriod === 'week' ? 'bg-brand text-white' : 'text-text-secondary hover:bg-bg-subtle'"
              @click="usagePeriod = 'week'"
            >Неделя</button>
          </div>
          <span
            v-if="claudeUsage.some(u => u.live_today)"
            class="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style="background-color: #10B98120; color: #10B981"
            title="Данные за сегодня получены из session-файлов в реальном времени"
          >LIVE</span>
          <button
            class="text-text-muted hover:text-text-primary transition-colors p-1 cursor-pointer"
            title="Обновить"
            @click="loadUsage"
          >
            <RefreshCw :size="16" :class="{ 'animate-spin': usageLoading }" />
          </button>
        </div>
      </div>

      <div class="border border-border rounded-xl overflow-hidden">
        <div class="flex items-center bg-bg-subtle px-5 py-3">
          <div class="w-[200px] text-xs font-semibold font-heading text-text-secondary">Пользователь</div>
          <div class="w-[80px] text-xs font-semibold font-heading text-text-secondary">Claude</div>
          <div class="w-[120px] text-xs font-semibold font-heading text-text-secondary">Токенов</div>
          <div class="w-[100px] text-xs font-semibold font-heading text-text-secondary">Сообщений</div>
          <div class="w-[100px] text-xs font-semibold font-heading text-text-secondary">Сессий</div>
          <div class="flex-1 text-xs font-semibold font-heading text-text-secondary">Модели</div>
        </div>

        <template v-if="usageLoading && claudeUsage.length === 0">
          <div v-for="n in 3" :key="n" class="flex items-center px-5 py-3.5 border-t border-border">
            <div class="w-[200px]"><div class="h-4 w-28 bg-bg-subtle rounded animate-pulse" /></div>
            <div class="w-[80px]"><div class="h-4 w-12 bg-bg-subtle rounded animate-pulse" /></div>
            <div class="w-[120px]"><div class="h-4 w-16 bg-bg-subtle rounded animate-pulse" /></div>
            <div class="w-[100px]"><div class="h-4 w-10 bg-bg-subtle rounded animate-pulse" /></div>
            <div class="w-[100px]"><div class="h-4 w-10 bg-bg-subtle rounded animate-pulse" /></div>
            <div class="flex-1"><div class="h-4 w-32 bg-bg-subtle rounded animate-pulse" /></div>
          </div>
        </template>

        <div
          v-for="u in claudeUsage"
          :key="u.user_id"
          class="flex items-center px-5 py-3.5 border-t border-border"
        >
          <div class="w-[200px]">
            <p class="text-sm font-medium text-text-primary truncate">{{ u.username }}</p>
            <p class="text-[11px] text-text-muted truncate">{{ u.email }}</p>
          </div>
          <div class="w-[80px]">
            <span
              class="text-[10px] font-medium px-1.5 py-0.5 rounded"
              :style="{
                backgroundColor: u.claude_authenticated ? '#10B98120' : '#EF444420',
                color: u.claude_authenticated ? '#10B981' : '#EF4444',
              }"
            >
              {{ u.claude_authenticated ? 'Подключен' : 'Нет' }}
            </span>
          </div>
          <div class="w-[120px] text-sm text-text-primary font-mono">
            {{ formatTokens(u[usagePeriod].tokens) }}
          </div>
          <div class="w-[100px] text-sm text-text-secondary">
            {{ u[usagePeriod].messages.toLocaleString() }}
          </div>
          <div class="w-[100px] text-sm text-text-secondary">
            {{ u[usagePeriod].sessions }}
          </div>
          <div class="flex-1 flex flex-wrap gap-1">
            <span
              v-for="(modelData, modelName) in u.models"
              :key="modelName"
              class="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style="background-color: #5988FF15; color: #5988FF"
              :title="`Input: ${formatTokens(modelData.input_tokens)}, Output: ${formatTokens(modelData.output_tokens)}`"
            >
              {{ modelName }}: {{ formatTokens(modelData.total) }}
            </span>
          </div>
        </div>

        <div v-if="claudeUsage.length === 0 && !usageLoading" class="px-5 py-8 text-center text-sm text-text-secondary border-t border-border">
          Нет данных. Пользователям необходимо подключить Claude аккаунт.
        </div>
      </div>
    </div>

    <!-- Agents Table -->
    <div class="border border-border rounded-xl overflow-hidden">
      <div class="flex items-center bg-bg-subtle px-5 py-3.5">
        <div class="w-[240px] text-xs font-semibold font-heading text-text-secondary">Агент</div>
        <div class="w-[120px] text-xs font-semibold font-heading text-text-secondary">Модель</div>
        <div class="w-[100px] text-xs font-semibold font-heading text-text-secondary">Сессий</div>
        <div class="flex-1 text-xs font-semibold font-heading text-text-secondary">Токенов</div>
        <div class="w-[100px] text-xs font-semibold font-heading text-text-secondary">Статус</div>
        <div class="w-[120px] text-xs font-semibold font-heading text-text-secondary">Действия</div>
      </div>

      <div
        v-for="agent in agents"
        :key="agent.id"
        class="flex items-center px-5 py-3.5 border-b border-border last:border-b-0"
      >
        <div class="w-[240px] flex items-center gap-2.5">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center"
            :style="{ backgroundColor: getAgentIcon(agent).color + '20' }"
          >
            <component :is="getAgentIcon(agent).icon" :size="14" :style="{ color: getAgentIcon(agent).color }" />
          </div>
          <span class="text-sm font-medium text-text-primary">{{ agent.name }}</span>
        </div>
        <div class="w-[120px] text-[13px] text-text-secondary">{{ agent.model?.replace('claude-', '') }}</div>
        <div class="w-[100px] text-[13px] text-text-primary">{{ agent.session_count ?? '—' }}</div>
        <div class="flex-1 text-[13px] text-text-primary">{{ agent.total_tokens ? formatTokens(agent.total_tokens) : '—' }}</div>
        <div class="w-[100px]">
          <button
            class="text-[11px] font-medium px-2 py-0.5 rounded cursor-pointer"
            :style="{ backgroundColor: agent.is_active ? '#10B98120' : '#EF444420', color: agent.is_active ? '#10B981' : '#EF4444' }"
            @click="toggleActive(agent)"
          >
            {{ agent.is_active ? 'Активен' : 'Неактивен' }}
          </button>
        </div>
        <div class="w-[120px] flex items-center gap-2">
          <button
            class="text-text-secondary hover:text-text-primary transition-colors"
            @click="router.push(`/admin/agents/${agent.id}`)"
          >
            <Pencil :size="16" />
          </button>
          <button
            class="text-text-muted hover:text-[#EF4444] transition-colors"
            @click="deleteConfirm = agent.id"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>

      <template v-if="loading">
        <div v-for="n in 4" :key="n" class="flex items-center px-5 py-3.5 border-b border-border last:border-b-0">
          <div class="w-[240px] flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-bg-subtle animate-pulse" />
            <div class="h-4 w-28 bg-bg-subtle rounded animate-pulse" />
          </div>
          <div class="w-[120px]"><div class="h-4 w-16 bg-bg-subtle rounded animate-pulse" /></div>
          <div class="w-[100px]"><div class="h-4 w-8 bg-bg-subtle rounded animate-pulse" /></div>
          <div class="flex-1"><div class="h-4 w-12 bg-bg-subtle rounded animate-pulse" /></div>
          <div class="w-[100px]"><div class="h-5 w-16 bg-bg-subtle rounded animate-pulse" /></div>
          <div class="w-[120px] flex gap-2">
            <div class="h-5 w-5 bg-bg-subtle rounded animate-pulse" />
            <div class="h-5 w-5 bg-bg-subtle rounded animate-pulse" />
          </div>
        </div>
      </template>

      <div v-if="agents.length === 0 && !loading" class="px-5 py-8 text-center text-sm text-text-secondary">
        Нет агентов
      </div>
    </div>

    <!-- Edit/Create Dialog -->
    <div
      v-if="editDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="editDialog = null"
    >
      <div class="bg-bg-card border border-border rounded-xl p-6 w-[600px] max-h-[85vh] overflow-auto">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-heading text-lg font-semibold text-text-primary">
            {{ isNewAgent ? 'Создать агента' : 'Редактировать агента' }}
          </h3>
          <button class="text-text-secondary hover:text-text-primary" @click="editDialog = null">
            <X :size="18" />
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-medium text-text-secondary mb-1 block">Название</label>
            <input
              v-model="editDialog.name"
              class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary"
            />
          </div>

          <div>
            <label class="text-xs font-medium text-text-secondary mb-1 block">Описание</label>
            <input
              v-model="editDialog.description"
              class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-medium text-text-secondary mb-1 block">Модель</label>
              <select
                v-model="editDialog.model"
                class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none"
              >
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="claude-opus-4-6">Claude Opus 4.6</option>
                <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-text-secondary mb-1 block">Макс токенов/сессия</label>
              <input
                v-model.number="editDialog.max_tokens_per_session"
                type="number"
                class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label class="text-xs font-medium text-text-secondary mb-1 block">System prompt</label>
            <textarea
              v-model="editDialog.system_prompt"
              rows="4"
              class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none resize-none font-mono text-xs"
            />
          </div>

          <div>
            <label class="text-xs font-medium text-text-secondary mb-1 block">Tools (через запятую)</label>
            <input
              v-model="editDialog.tools"
              placeholder="jira:search_issues, gitlab:read_file"
              class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none"
            />
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="text-xs font-medium text-text-secondary mb-1 block">Иконка</label>
              <select
                v-model="editDialog.icon"
                class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none"
              >
                <option value="code">Code</option>
                <option value="bug">Bug</option>
                <option value="clipboard">Clipboard</option>
                <option value="palette">Palette</option>
                <option value="database">Database</option>
                <option value="shield">Shield</option>
                <option value="server">Server</option>
                <option value="smartphone">Smartphone</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-text-secondary mb-1 block">Цвет</label>
              <input
                v-model="editDialog.color"
                type="color"
                class="w-full h-[38px] border border-border bg-bg-input rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label class="text-xs font-medium text-text-secondary mb-1 block">Теги</label>
              <input
                v-model="editDialog.tags"
                placeholder="dev, backend"
                class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none"
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button @click="editDialog.is_active = !editDialog.is_active">
              <component
                :is="editDialog.is_active ? ToggleRight : ToggleLeft"
                :size="28"
                :class="editDialog.is_active ? 'text-[#10B981]' : 'text-text-muted'"
              />
            </button>
            <span class="text-sm text-text-primary">{{ editDialog.is_active ? 'Активен' : 'Неактивен' }}</span>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            class="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors"
            @click="editDialog = null"
          >
            Отмена
          </button>
          <button
            class="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:opacity-90 transition-opacity font-heading font-medium"
            @click="saveAgent"
          >
            <Save :size="14" />
            {{ isNewAgent ? 'Создать' : 'Сохранить' }}
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
        <h3 class="font-heading text-lg font-semibold text-text-primary mb-2">Удалить агента?</h3>
        <p class="text-sm text-text-secondary mb-6">Это действие необратимо. Все сессии с этим агентом будут сохранены, но агент станет недоступен.</p>
        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors"
            @click="deleteConfirm = null"
          >
            Отмена
          </button>
          <button
            class="px-4 py-2 text-sm bg-[#EF4444] text-white rounded-lg hover:opacity-90 transition-opacity font-heading font-medium"
            @click="deleteAgent(deleteConfirm!)"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
