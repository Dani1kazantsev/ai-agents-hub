<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus, Play, ArrowRight, Bug, Code, Clipboard, Palette, Database,
  Loader, Server, Smartphone, CheckCircle, XCircle, X, Users, MessageSquare,
  Pencil, Trash2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { usePipelinesStore } from '@/stores/pipelines'
import type { PipelineTemplate } from '@/stores/pipelines'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const store = usePipelinesStore()

const agentIconMap: Record<string, { icon: any; color: string }> = {
  'qa-agent': { icon: Bug, color: '#10B981' },
  'backend-dev': { icon: Code, color: '#6366F1' },
  'frontend-dev': { icon: Code, color: '#3B82F6' },
  'pm-agent': { icon: Clipboard, color: '#F59E0B' },
  'designer-agent': { icon: Palette, color: '#EC4899' },
  'data-agent': { icon: Database, color: '#5988FF' },
  'devops-agent': { icon: Server, color: '#0EA5E9' },
  'mobile-dev': { icon: Smartphone, color: '#8B5CF6' },
  'automation': { icon: Server, color: '#6B7280' },
  'user': { icon: Users, color: '#F59E0B' },
  'dev': { icon: Code, color: '#6366F1' },
}

function getStepIcon(agent: string) {
  return agentIconMap[agent] || { icon: Code, color: '#6366F1' }
}

const inputDialog = ref<{ templateId: string; input: string; humanLoop: boolean } | null>(null)
const deleteConfirm = ref<string | null>(null)
const deleting = ref(false)

async function deleteTemplate(templateId: string) {
  deleting.value = true
  try {
    await store.deleteTemplate(templateId)
    toast.success(t('pipelines.pipelineDeleted'))
  } catch {
    toast.error(t('pipelines.pipelineDeleteError'))
  } finally {
    deleting.value = false
    deleteConfirm.value = null
  }
}

onMounted(async () => {
  if (store.templates.length === 0) {
    await store.fetchTemplates()
  }
  // Restore state of any active/completed runs from server
  store.syncActiveRuns()
})

function openRunDialog(template: PipelineTemplate) {
  inputDialog.value = { templateId: template.id, input: '', humanLoop: template.human_loop }
}

async function startRun() {
  if (!inputDialog.value) return
  const { templateId, input, humanLoop } = inputDialog.value
  inputDialog.value = null

  try {
    const resp = await api.post<any>(`/pipelines/run/${templateId}`, { input })

    if (resp.mode === 'human_loop') {
      toast.success(t('pipelines.chatCreated'))
      router.push(`/chats/${resp.session_id}`)
      return
    }

    // Auto mode — store manages WS
    store.startAutoRun(templateId, resp.run_id)
  } catch {
    toast.error(t('pipelines.runError'))
  }
}

async function cancelRun(templateId: string) {
  try {
    await store.cancelRun(templateId)
    toast.success(t('pipelines.cancelled'))
  } catch {
    toast.error(t('pipelines.cancelError'))
  }
}

async function restartRun(template: PipelineTemplate) {
  await store.clearRun(template.id)
  openRunDialog(template)
}
</script>

<template>
  <div class="p-10 max-w-[1200px]">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
      <div>
        <h1 class="font-heading text-[32px] font-medium text-text-primary tracking-tight">{{ $t('pipelines.title') }}</h1>
        <p class="text-sm text-text-secondary mt-1">{{ $t('pipelines.subtitle') }}</p>
      </div>
      <button
        class="flex items-center gap-2 bg-brand text-white text-[13px] font-medium font-heading px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        @click="router.push('/pipelines/new')"
      >
        <Plus :size="16" />
        {{ $t('pipelines.createPipeline') }}
      </button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="store.loading" class="flex flex-col gap-5">
      <div v-for="n in 4" :key="n" class="border border-border rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="h-5 w-48 bg-bg-subtle rounded animate-pulse" />
            <div class="h-3 w-72 bg-bg-subtle rounded animate-pulse mt-2" />
          </div>
          <div class="h-9 w-28 bg-bg-subtle rounded-lg animate-pulse" />
        </div>
        <div class="flex items-center gap-2">
          <div class="h-8 w-28 bg-bg-subtle rounded-lg animate-pulse" />
          <div class="h-8 w-28 bg-bg-subtle rounded-lg animate-pulse" />
          <div class="h-8 w-28 bg-bg-subtle rounded-lg animate-pulse" />
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col gap-5">
      <div
        v-for="template in store.templates"
        :key="template.id"
        class="border border-border rounded-xl p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-heading text-lg font-semibold text-text-primary">{{ template.title }}</h2>
                <span
                  v-if="template.human_loop"
                  class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style="background-color: #5988FF20; color: #5988FF"
                >
                  <MessageSquare :size="10" />
                  {{ $t('pipelines.chatWithTL') }}
                </span>
                <span
                  v-else
                  class="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style="background-color: #10B98120; color: #10B981"
                >
                  {{ $t('pipelines.auto') }}
                </span>
              </div>
              <p class="text-[13px] text-text-secondary mt-1">{{ template.description }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Edit / Delete -->
            <button
              class="p-2 text-text-muted hover:text-text-primary hover:bg-bg-subtle rounded-lg transition-colors"
              :title="$t('common.edit')"
              @click="router.push(`/pipelines/${template.id}/edit`)"
            >
              <Pencil :size="15" />
            </button>
            <button
              class="p-2 text-text-muted hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors"
              :title="$t('common.delete')"
              @click="deleteConfirm = template.id"
            >
              <Trash2 :size="15" />
            </button>

          <!-- Status / Run button -->
          <div v-if="store.runs[template.id]?.status === 'running'" class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 text-[#10B981] text-xs font-medium px-3 py-1.5 rounded-lg" style="background-color: #10B98120">
              <Loader :size="14" class="animate-spin" />
              {{ store.getRunStatus(template.id) }}
            </div>
            <button
              class="flex items-center gap-1.5 text-[#EF4444] text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
              style="background-color: #EF444420"
              @click="cancelRun(template.id)"
            >
              <X :size="14" />
              {{ $t('common.cancel') }}
            </button>
          </div>
          <div v-else-if="store.runs[template.id]?.status === 'completed'" class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 text-[#10B981] text-xs font-medium px-3 py-1.5 rounded-lg" style="background-color: #10B98120">
              <CheckCircle :size="14" />
              {{ $t('pipelines.done') }}
            </div>
            <button
              class="flex items-center gap-1.5 text-text-secondary text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-bg-subtle transition-colors"
              @click="restartRun(template)"
            >
              <Play :size="12" />
              {{ $t('pipelines.restart') }}
            </button>
          </div>
          <div v-else-if="store.runs[template.id]?.status === 'error'" class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 text-[#EF4444] text-xs font-medium px-3 py-1.5 rounded-lg" style="background-color: #EF444420">
              <XCircle :size="14" />
              {{ $t('common.error') }}
            </div>
            <button
              class="flex items-center gap-1.5 text-text-secondary text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-bg-subtle transition-colors"
              @click="restartRun(template)"
            >
              <Play :size="12" />
              {{ $t('pipelines.restart') }}
            </button>
          </div>
          <button
            v-else
            class="flex items-center gap-2 bg-bg-subtle border border-border text-text-primary text-[13px] font-medium font-heading px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            @click="openRunDialog(template)"
          >
            {{ template.human_loop ? $t('pipelines.startChat') : $t('pipelines.run') }}
            <component :is="template.human_loop ? MessageSquare : Play" :size="14" />
          </button>
        </div>
        </div>

        <!-- Steps visualization -->
        <div class="flex flex-wrap items-center gap-0">
          <template v-for="(step, i) in template.steps" :key="i">
            <div
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium"
              :style="{
                backgroundColor: getStepIcon(step.agent).color + '15',
                color: getStepIcon(step.agent).color,
                border: store.runs[template.id]?.steps[i]?.status === 'running'
                  ? `2px solid ${getStepIcon(step.agent).color}`
                  : '2px solid transparent',
              }"
              :title="step.description"
            >
              <component :is="getStepIcon(step.agent).icon" :size="14" />
              {{ step.label }}
              <Loader v-if="store.runs[template.id]?.steps[i]?.status === 'running'" :size="10" class="animate-spin" />
              <CheckCircle v-else-if="store.runs[template.id]?.steps[i]?.status === 'done'" :size="10" />
            </div>
            <ArrowRight v-if="i < template.steps.length - 1" :size="16" class="text-text-muted mx-0.5 shrink-0" />
          </template>
        </div>

        <!-- Expanded results (auto-mode only) -->
        <div
          v-if="store.runs[template.id] && store.runs[template.id].status !== 'idle'"
          class="mt-4 flex flex-col gap-3"
        >
          <div
            v-for="(stepResult, i) in store.runs[template.id].steps"
            :key="i"
            class="border border-border rounded-lg p-3"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-medium text-text-primary">{{ $t('pipelines.step', { n: i + 1 }) }}: {{ stepResult.agent }}</span>
              <span
                v-if="stepResult.status === 'done'"
                class="text-[10px] px-1.5 py-0.5 rounded"
                style="background-color: #10B98120; color: #10B981"
              >{{ $t('pipelines.stepDone') }}</span>
              <span
                v-else-if="stepResult.status === 'running'"
                class="text-[10px] px-1.5 py-0.5 rounded"
                style="background-color: #5988FF20; color: #5988FF"
              >{{ $t('pipelines.running') }}</span>
              <span
                v-else-if="stepResult.status === 'error'"
                class="text-[10px] px-1.5 py-0.5 rounded"
                style="background-color: #EF444420; color: #EF4444"
              >{{ $t('pipelines.stepError') }}</span>
            </div>
            <div
              v-if="stepResult.streamContent || stepResult.output"
              class="text-xs text-text-secondary whitespace-pre-wrap max-h-[200px] overflow-auto font-mono"
            >
              {{ stepResult.streamContent || stepResult.output }}
            </div>
            <div v-else-if="stepResult.status === 'pending'" class="text-xs text-text-muted">
              {{ $t('pipelines.waiting') }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="store.templates.length === 0" class="text-center py-12">
        <p class="text-sm text-text-secondary mb-4">{{ $t('pipelines.noPipelines') }}</p>
        <button
          class="inline-flex items-center gap-2 bg-brand text-white text-[13px] font-medium font-heading px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          @click="router.push('/pipelines/new')"
        >
          <Plus :size="16" />
          {{ $t('pipelines.addPipeline') }}
        </button>
      </div>
    </div>

    <!-- Input dialog -->
    <div
      v-if="inputDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="inputDialog = null"
    >
      <div class="bg-bg-card border border-border rounded-xl p-6 w-[500px]">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-heading text-lg font-semibold text-text-primary">
            {{ inputDialog.humanLoop ? $t('pipelines.startChatWithTL') : $t('pipelines.runPipelineTitle') }}
          </h3>
          <button class="text-text-secondary hover:text-text-primary" @click="inputDialog = null">
            <X :size="18" />
          </button>
        </div>
        <p v-if="inputDialog.humanLoop" class="text-[13px] text-text-secondary mb-3">
          {{ $t('pipelines.chatDescription') }}
        </p>
        <textarea
          v-model="inputDialog.input"
          rows="4"
          :placeholder="inputDialog.humanLoop
            ? $t('pipelines.chatPlaceholder')
            : $t('pipelines.inputPlaceholder')"
          class="w-full px-4 py-3 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors resize-none"
        />
        <div class="flex justify-end gap-3 mt-4">
          <button
            class="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors"
            @click="inputDialog = null"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            class="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:opacity-90 transition-opacity font-heading font-medium"
            @click="startRun"
          >
            <component :is="inputDialog.humanLoop ? MessageSquare : Play" :size="14" />
            {{ inputDialog.humanLoop ? $t('pipelines.startChat') : $t('pipelines.run') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation dialog -->
    <div
      v-if="deleteConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="deleteConfirm = null"
    >
      <div class="bg-bg-card border border-border rounded-xl p-6 w-[400px]">
        <h3 class="font-heading text-lg font-semibold text-text-primary mb-2">{{ $t('pipelines.deletePipeline') }}</h3>
        <p class="text-[13px] text-text-secondary mb-5">{{ $t('pipelines.deletePipelineText') }}</p>
        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors"
            :disabled="deleting"
            @click="deleteConfirm = null"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            class="flex items-center gap-2 px-4 py-2 text-sm bg-[#EF4444] text-white rounded-lg hover:opacity-90 transition-opacity font-heading font-medium disabled:opacity-50"
            :disabled="deleting"
            @click="deleteTemplate(deleteConfirm!)"
          >
            <Loader v-if="deleting" :size="14" class="animate-spin" />
            <Trash2 v-else :size="14" />
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
