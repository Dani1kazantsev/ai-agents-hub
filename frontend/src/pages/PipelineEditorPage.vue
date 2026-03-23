<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Save, Plus, ArrowRight, Clipboard, Bug, Code,
  Database, Palette, Server, Smartphone, ChevronDown, Trash2,
  Loader2, GripVertical, MessageSquare, Play, Check, Search,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { usePipelinesStore } from '@/stores/pipelines'

interface PipelineStep {
  agent_slug: string
  label: string
  input_template: string
}

interface PipelineForm {
  title: string
  description: string
  human_loop: boolean
  steps: PipelineStep[]
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const pipelineStore = usePipelinesStore()

// Tabs: 'create' or 'catalog' (only for new pipeline mode)
const activeTab = ref<'create' | 'catalog'>('create')
const addingId = ref<string | null>(null)

async function addFromCatalog(templateId: string) {
  addingId.value = templateId
  try {
    await pipelineStore.addToWorkspace(templateId)
    toast.success(t('pipelineEditor.pipelineAdded'))
  } catch {
    toast.error(t('pipelineEditor.addError'))
  } finally {
    addingId.value = null
  }
}

const isEdit = ref(false)
const pipelineId = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)

const form = ref<PipelineForm>({
  title: '',
  description: '',
  human_loop: true,
  steps: [],
})

const slugOptions = [
  { slug: 'pm-agent', name: 'PM Agent', icon: Clipboard, color: '#F59E0B', bg: '#FFFBEB' },
  { slug: 'qa-agent', name: 'QA Agent', icon: Bug, color: '#10B981', bg: '#ECFDF5' },
  { slug: 'backend-dev', name: 'Backend Dev', icon: Code, color: '#6366F1', bg: '#EEF2FF' },
  { slug: 'frontend-dev', name: 'Frontend Dev', icon: Code, color: '#3B82F6', bg: '#EFF6FF' },
  { slug: 'data-agent', name: 'Data Agent', icon: Database, color: '#5988FF', bg: '#EEF2FF' },
  { slug: 'designer-agent', name: 'Designer', icon: Palette, color: '#EC4899', bg: '#FDF2F8' },
  { slug: 'devops-agent', name: 'DevOps', icon: Server, color: '#0EA5E9', bg: '#F0F9FF' },
  { slug: 'mobile-dev', name: 'Mobile Dev', icon: Smartphone, color: '#8B5CF6', bg: '#F5F3FF' },
]

function getAgent(slug: string) {
  return slugOptions.find(a => a.slug === slug) || slugOptions[0]
}

function addStep() {
  form.value.steps.push({ agent_slug: 'pm-agent', label: '', input_template: '' })
}

function removeStep(index: number) {
  form.value.steps.splice(index, 1)
}

// Dropdown
const openDropdown = ref<number | null>(null)

function selectAgent(stepIndex: number, slug: string) {
  form.value.steps[stepIndex].agent_slug = slug
  openDropdown.value = null
}

function handleOutsideClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (openDropdown.value !== null && !target.closest('[data-step-card]')) {
    openDropdown.value = null
  }
}

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

// Drag-and-drop
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  dragOverIndex.value = index
}

function onDragLeave() {
  dragOverIndex.value = null
}

function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault()
  const fromIndex = dragIndex.value
  if (fromIndex === null || fromIndex === toIndex) {
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }
  const steps = form.value.steps
  const [moved] = steps.splice(fromIndex, 1)
  steps.splice(toIndex, 0, moved)
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

async function save() {
  if (!form.value.title.trim()) {
    toast.error(t('pipelineEditor.nameRequired'))
    return
  }
  if (form.value.steps.length === 0) {
    toast.error(t('pipelineEditor.stepsRequired'))
    return
  }
  saving.value = true
  try {
    if (isEdit.value && pipelineId.value) {
      await api.put(`/pipelines/templates/${pipelineId.value}`, form.value)
    } else {
      await api.post('/pipelines/templates', form.value)
    }
    toast.success(isEdit.value ? t('pipelineEditor.updated') : t('pipelineEditor.created'))
    router.push('/pipelines')
  } catch {
    toast.error(t('pipelineEditor.saveError'))
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push('/pipelines')
}

onMounted(async () => {
  const id = route.params.id as string | undefined
  if (id) {
    isEdit.value = true
    pipelineId.value = id
    loading.value = true
    try {
      const data = await api.get<any>(`/pipelines/templates/${id}`)
      form.value = {
        title: data.title,
        description: data.description,
        human_loop: data.human_loop ?? true,
        steps: (data.steps || []).map((s: any) => ({
          agent_slug: s.agent_slug || s.agent || 'pm-agent',
          label: s.label || '',
          input_template: s.input_template || s.description || '',
        })),
      }
    } catch {
      toast.error(t('pipelineEditor.saveError'))
    } finally {
      loading.value = false
    }
  } else {
    // New pipeline mode — load catalog for "from catalog" tab
    pipelineStore.fetchCatalog()
  }
  document.addEventListener('click', handleOutsideClick)
})
</script>

<template>
  <div class="p-6 sm:p-10 max-w-[1200px]">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="font-heading text-2xl sm:text-[32px] font-medium text-text-primary tracking-tight">
          {{ isEdit ? $t('pipelineEditor.editTitle') : $t('pipelineEditor.createTitle') }}
        </h1>
        <p class="text-sm text-text-secondary mt-1">
          {{ isEdit ? $t('pipelineEditor.editSubtitle') : $t('pipelineEditor.createSubtitle') }}
        </p>
      </div>
      <div v-if="activeTab === 'create' || isEdit" class="flex items-center gap-2 shrink-0">
        <button
          class="px-5 py-2.5 text-[13px] font-medium font-heading text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors"
          :disabled="saving"
          @click="cancel"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium font-heading bg-brand text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          <Loader2 v-if="saving" :size="16" class="animate-spin" />
          <Save v-else :size="16" />
          {{ $t('common.save') }}
        </button>
      </div>
      <div v-else>
        <button
          class="px-5 py-2.5 text-[13px] font-medium font-heading text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors"
          @click="cancel"
        >
          {{ $t('common.back') }}
        </button>
      </div>
    </div>

    <!-- Tabs (new mode only) -->
    <div v-if="!isEdit" class="flex gap-1 bg-bg-subtle p-1 rounded-lg mb-8 w-fit">
      <button
        class="px-4 py-2 text-[13px] font-medium rounded-md transition-colors"
        :class="activeTab === 'create'
          ? 'bg-bg-main text-text-primary shadow-sm'
          : 'text-text-secondary hover:text-text-primary'"
        @click="activeTab = 'create'"
      >
        {{ $t('pipelineEditor.fromScratch') }}
      </button>
      <button
        class="px-4 py-2 text-[13px] font-medium rounded-md transition-colors"
        :class="activeTab === 'catalog'
          ? 'bg-bg-main text-text-primary shadow-sm'
          : 'text-text-secondary hover:text-text-primary'"
        @click="activeTab = 'catalog'"
      >
        {{ $t('pipelineEditor.fromCatalog') }}
      </button>
    </div>

    <!-- Catalog tab -->
    <div v-if="!isEdit && activeTab === 'catalog'">
      <div v-if="pipelineStore.catalogLoading" class="flex flex-col gap-3">
        <div v-for="n in 4" :key="n" class="h-20 bg-bg-subtle rounded-xl animate-pulse" />
      </div>
      <div v-else class="flex flex-col gap-3">
        <div
          v-for="tpl in pipelineStore.catalog.filter(t => !t.in_workspace)"
          :key="tpl.id"
          class="flex items-center gap-4 p-4 border border-border rounded-xl"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="font-heading text-sm font-semibold text-text-primary">{{ tpl.title }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                :class="tpl.human_loop
                  ? 'bg-brand/10 text-brand'
                  : 'bg-[#10B981]/10 text-[#10B981]'"
              >
                {{ tpl.human_loop ? $t('pipelines.chatWithTL') : $t('pipelines.auto') }}
              </span>
            </div>
            <p class="text-xs text-text-secondary">{{ tpl.description }}</p>
            <div v-if="tpl.steps && tpl.steps.length > 0" class="mt-2 flex flex-wrap gap-1">
              <span v-for="(s, i) in tpl.steps" :key="i"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted border border-border">
                {{ s.label }}
              </span>
            </div>
          </div>
          <button
            class="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium bg-brand text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
            :disabled="addingId === tpl.id"
            @click="addFromCatalog(tpl.id)"
          >
            <Loader2 v-if="addingId === tpl.id" :size="14" class="animate-spin" />
            <Plus v-else :size="14" />
            {{ $t('pipelines.addPipeline') }}
          </button>
        </div>
        <div
          v-if="pipelineStore.catalog.filter(t => !t.in_workspace).length === 0"
          class="text-center py-12 text-sm text-text-secondary"
        >
          {{ $t('pipelineEditor.allAdded') }}
        </div>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="loading" class="flex flex-col gap-6">
      <div class="h-12 bg-bg-subtle rounded-lg animate-pulse" />
      <div class="h-12 bg-bg-subtle rounded-lg animate-pulse" />
      <div class="flex gap-4 mt-4">
        <div class="w-[220px] h-[140px] bg-bg-subtle rounded-xl animate-pulse" />
        <div class="w-[220px] h-[140px] bg-bg-subtle rounded-xl animate-pulse" />
      </div>
    </div>

    <template v-else>
      <!-- Form -->
      <div class="flex flex-col gap-6 mb-8">
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('pipelineEditor.pipelineName') }}</label>
          <input
            v-model="form.title"
            placeholder="Sprint Review Pipeline"
            class="w-full px-4 py-3 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('common.description') }}</label>
          <input
            v-model="form.description"
            placeholder="Sprint data collection and report generation"
            class="w-full px-4 py-3 border border-border bg-transparent text-text-secondary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors"
          />
        </div>

        <!-- Mode toggle -->
        <div class="flex flex-col gap-2">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('pipelineEditor.executionMode') }}</label>
          <div class="flex gap-3">
            <button
              type="button"
              class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border transition-colors"
              :class="form.human_loop
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-border text-text-secondary hover:bg-bg-subtle'"
              @click="form.human_loop = true"
            >
              <MessageSquare :size="14" />
              {{ $t('pipelineEditor.chatWithTeamLead') }}
            </button>
            <button
              type="button"
              class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border transition-colors"
              :class="!form.human_loop
                ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]'
                : 'border-border text-text-secondary hover:bg-bg-subtle'"
              @click="form.human_loop = false"
            >
              <Play :size="14" />
              {{ $t('pipelineEditor.autoExecution') }}
            </button>
          </div>
          <p class="text-xs text-text-muted">
            {{ form.human_loop
              ? $t('pipelineEditor.chatHelp')
              : $t('pipelineEditor.autoHelp')
            }}
          </p>
        </div>
      </div>

      <!-- Steps -->
      <div class="flex flex-col gap-4">
        <span class="text-[13px] font-medium text-text-primary">{{ $t('pipelineEditor.steps') }}</span>

        <div class="flex items-center gap-0 flex-wrap">
          <template v-for="(step, i) in form.steps" :key="i">
            <div
              data-step-card
              class="relative rounded-xl p-5 w-[220px] flex flex-col gap-2 shrink-0 cursor-grab active:cursor-grabbing transition-all"
              :class="[
                i === 0 ? 'border-2 border-brand' : 'border border-border',
                dragIndex === i ? 'opacity-40' : '',
                dragOverIndex === i ? 'ring-2 ring-brand ring-offset-2' : '',
              ]"
              draggable="true"
              @dragstart="onDragStart($event, i)"
              @dragover="onDragOver($event, i)"
              @dragleave="onDragLeave"
              @drop="onDrop($event, i)"
              @dragend="onDragEnd"
            >
              <!-- Drag handle -->
              <div class="absolute top-2 right-2 text-text-muted">
                <GripVertical :size="14" />
              </div>

              <!-- Agent selector -->
              <div class="flex items-center gap-2.5">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  :style="{ backgroundColor: getAgent(step.agent_slug).bg }"
                >
                  <component
                    :is="getAgent(step.agent_slug).icon"
                    :size="16"
                    :style="{ color: getAgent(step.agent_slug).color }"
                  />
                </div>
                <button
                  class="font-heading text-sm font-semibold text-text-primary flex items-center gap-1 truncate"
                  @click.stop="openDropdown = openDropdown === i ? null : i"
                >
                  {{ getAgent(step.agent_slug).name }}
                  <ChevronDown :size="14" class="text-text-muted shrink-0" />
                </button>
                <button
                  class="ml-auto text-text-muted hover:text-[#EF4444] transition-colors shrink-0"
                  @click.stop="removeStep(i)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>

              <!-- Dropdown -->
              <div
                v-if="openDropdown === i"
                class="absolute top-16 left-0 z-10 w-full bg-bg-card border border-border rounded-lg shadow-lg py-1"
              >
                <button
                  v-for="opt in slugOptions"
                  :key="opt.slug"
                  class="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-bg-subtle transition-colors"
                  @click.stop="selectAgent(i, opt.slug)"
                >
                  <component :is="opt.icon" :size="14" :style="{ color: opt.color }" />
                  {{ opt.name }}
                </button>
              </div>

              <!-- Label input -->
              <input
                v-model="step.label"
                :placeholder="$t('pipelineEditor.stepName')"
                class="text-[13px] text-text-primary bg-transparent outline-none w-full font-medium"
              />
              <!-- Description input -->
              <input
                v-model="step.input_template"
                :placeholder="$t('pipelineEditor.stepDescription')"
                class="text-xs text-text-secondary bg-transparent outline-none w-full leading-relaxed"
              />

              <!-- Badge -->
              <div class="mt-1">
                <span
                  class="text-[11px] font-medium px-2 py-0.5 rounded"
                  :style="{ backgroundColor: getAgent(step.agent_slug).bg, color: getAgent(step.agent_slug).color }"
                >
                  {{ $t('pipelines.step', { n: i + 1 }) }}
                </span>
              </div>
            </div>

            <!-- Arrow -->
            <div v-if="i < form.steps.length - 1" class="flex items-center justify-center w-12 shrink-0">
              <ArrowRight :size="20" class="text-text-muted" />
            </div>
          </template>

          <!-- Add step button -->
          <div v-if="form.steps.length > 0" class="flex items-center justify-center w-12 shrink-0">
            <ArrowRight :size="20" class="text-text-muted" />
          </div>
          <button
            class="w-12 h-12 border border-border rounded-xl flex items-center justify-center text-text-muted hover:border-text-secondary hover:text-text-secondary transition-colors shrink-0"
            @click="addStep"
          >
            <Plus :size="20" />
          </button>
        </div>

        <p v-if="form.steps.length === 0" class="text-sm text-text-muted">
          {{ $t('pipelineEditor.addStepsHelp') }}
        </p>

        <p v-if="form.steps.length > 1" class="text-xs text-text-muted">
          {{ $t('pipelineEditor.dragHelp') }}
        </p>
      </div>
    </template>
  </div>
</template>
