<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Check, Loader, Terminal } from 'lucide-vue-next'
import { api } from '@/lib/api'

interface StepResult {
  step: number
  agent: string
  detail: string
  status: 'pending' | 'running' | 'done' | 'error'
  elapsed: string
  bg: string
}

const { t } = useI18n()
const route = useRoute()

const pipelineTitle = ref('Pipeline')
const pipelineStatus = ref<'running' | 'completed' | 'error'>('running')
const startedAgo = ref('')
const steps = ref<StepResult[]>([])
const logs = ref<{ time: string; text: string; color: string }[]>([])
let ws: WebSocket | null = null
let startTime = Date.now()
let timerInterval: ReturnType<typeof setInterval> | null = null

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function updateAgo() {
  const mins = Math.floor((Date.now() - startTime) / 60000)
  startedAgo.value = mins < 1 ? t('pipelineRun.lessThanMinute') : t('pipelineRun.minutesAgo', { n: mins })
}

function statusBadge() {
  if (pipelineStatus.value === 'running') return { text: t('pipelineRun.running'), color: '#F59E0B', bg: '#FFFBEB' }
  if (pipelineStatus.value === 'completed') return { text: t('pipelineRun.completed'), color: '#10B981', bg: '#F0FDF4' }
  return { text: t('pipelineRun.error'), color: '#EF4444', bg: '#FEF2F2' }
}

function addLog(text: string, color: string = '#7A7A7A') {
  const now = new Date()
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  logs.value.push({ time, text, color })
}

function connectWs(runId: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = localStorage.getItem('token')
  ws = new WebSocket(`${protocol}//${window.location.host}/api/pipelines/ws/${runId}?token=${token}`)

  ws.onopen = () => {
    ws!.send(JSON.stringify({ type: 'start' }))
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)

    if (data.type === 'step_start') {
      const step = steps.value[data.step]
      if (step) {
        step.status = 'running'
        step.agent = data.agent_name || step.agent
        step.bg = '#FFFBEB'
        addLog(`${step.agent} — ${t('pipelines.running')}`, '#F59E0B')
      }
    } else if (data.type === 'step_stream') {
      addLog(`${steps.value[data.step]?.agent || 'Agent'} → ${data.content}`)
    } else if (data.type === 'step_tool_use') {
      const name = data.tool_name || 'tool'
      addLog(`${steps.value[data.step]?.agent || 'Agent'} → ${name}(${JSON.stringify(data.tool_input || {})})`)
    } else if (data.type === 'step_done') {
      const step = steps.value[data.step]
      if (step) {
        step.status = 'done'
        step.detail = data.output_preview || t('pipelineRun.completed')
        step.bg = '#F0FDF4'
        step.elapsed = formatElapsed(Date.now() - startTime)
        addLog(`${step.agent} — ${t('pipelines.stepDone')}`, '#10B981')
      }
    } else if (data.type === 'step_error') {
      const step = steps.value[data.step]
      if (step) {
        step.status = 'error'
        step.detail = data.content || t('pipelineRun.error')
        addLog(`${step.agent} — ${t('pipelineRun.error')}: ${data.content}`, '#EF4444')
      }
    } else if (data.type === 'pipeline_done') {
      pipelineStatus.value = 'completed'
      addLog(t('pipelineRun.pipelineCompleted'), '#10B981')
    } else if (data.type === 'error') {
      pipelineStatus.value = 'error'
      addLog(`${t('pipelineRun.error')}: ${data.content}`, '#EF4444')
    }
  }

  ws.onclose = () => {
    if (pipelineStatus.value === 'running') pipelineStatus.value = 'error'
    ws = null
  }
}

onMounted(async () => {
  const runId = route.params.id as string
  startTime = Date.now()
  timerInterval = setInterval(updateAgo, 10000)
  updateAgo()

  try {
    const data = await api.get<any>(`/pipelines/runs/${runId}`)
    pipelineTitle.value = data.title || 'Pipeline'
    steps.value = (data.steps || []).map((s: any, i: number) => ({
      step: i,
      agent: s.agent_name || t('pipelines.step', { n: i + 1 }),
      detail: s.detail || t('pipelineRun.waitingPrev'),
      status: s.status || 'pending',
      elapsed: '',
      bg: '',
    }))
  } catch {
    // fallback: try to load from template
  }

  connectWs(runId)
})

onUnmounted(() => {
  ws?.close()
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<template>
  <div class="p-10 max-w-[1200px] flex flex-col gap-8 h-full">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-heading text-[32px] font-medium text-text-primary tracking-tight">
          {{ pipelineTitle }}
        </h1>
        <p class="text-sm text-text-secondary mt-1">{{ $t('pipelineRun.startedAgo', { time: startedAgo }) }}</p>
      </div>
      <div
        class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] font-medium"
        :style="{ backgroundColor: statusBadge().bg, color: statusBadge().color }"
      >
        <span
          v-if="pipelineStatus === 'running'"
          class="w-2 h-2 rounded-full animate-pulse"
          :style="{ backgroundColor: statusBadge().color }"
        />
        {{ statusBadge().text }}
      </div>
    </div>

    <!-- Steps -->
    <div class="flex flex-col border border-border rounded-xl overflow-hidden">
      <div
        v-for="(step, i) in steps"
        :key="i"
        class="flex items-center gap-4 px-6 py-5 border-b border-border last:border-b-0 transition-colors"
        :style="{ backgroundColor: step.bg || 'transparent' }"
      >
        <!-- Status icon -->
        <div v-if="step.status === 'done'" class="w-7 h-7 rounded-full bg-[#10B981] flex items-center justify-center shrink-0">
          <Check :size="14" class="text-white" />
        </div>
        <div v-else-if="step.status === 'running'" class="w-7 h-7 rounded-full border-2 border-[#F59E0B] flex items-center justify-center shrink-0">
          <Loader :size="14" class="text-[#F59E0B] animate-spin" />
        </div>
        <div v-else class="w-7 h-7 rounded-full border-2 border-border flex items-center justify-center shrink-0">
          <span class="text-xs font-medium text-text-muted">{{ i + 1 }}</span>
        </div>

        <!-- Info -->
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <span class="font-heading text-sm font-semibold text-text-primary">
            {{ $t('pipelines.step', { n: i + 1 }) }}: {{ step.agent }}
          </span>
          <span
            class="text-[13px] truncate"
            :class="step.status === 'pending' ? 'text-text-muted' : step.status === 'running' ? 'text-[#F59E0B]' : 'text-text-secondary'"
          >
            {{ step.detail }}
          </span>
        </div>

        <!-- Time -->
        <span
          v-if="step.elapsed"
          class="text-xs font-medium shrink-0"
          :style="{ color: step.status === 'done' ? '#10B981' : step.status === 'running' ? '#F59E0B' : '' }"
        >
          {{ step.elapsed }}
        </span>
      </div>

      <div v-if="steps.length === 0" class="px-6 py-8 text-sm text-text-muted text-center">
        {{ $t('pipelineRun.loadingSteps') }}
      </div>
    </div>

    <!-- Log panel -->
    <div class="border border-border rounded-xl bg-bg-subtle p-5 flex flex-col gap-3 flex-1 min-h-[200px] overflow-auto">
      <div class="flex items-center gap-2 text-text-secondary">
        <Terminal :size="14" />
        <span class="font-heading text-[13px] font-medium">{{ $t('pipelineRun.executionLog') }}</span>
      </div>
      <div class="flex flex-col gap-1 font-mono text-xs leading-relaxed">
        <div
          v-for="(log, i) in logs"
          :key="i"
          :style="{ color: log.color }"
        >
          <span class="text-text-muted">[{{ log.time }}]</span> {{ log.text }}
        </div>
        <div v-if="logs.length === 0" class="text-text-muted">
          {{ $t('pipelineRun.waitingEvents') }}
        </div>
      </div>
    </div>
  </div>
</template>
