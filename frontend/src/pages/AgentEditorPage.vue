<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Save, X, ChevronDown, Plus, Loader2,
  Bug, Code, Clipboard, Palette, Database, Shield, Server, Smartphone,
  GitBranch, Search, FileText, MessageSquare, ArrowRightLeft, Eye, Pen, Layout, Image, Settings2, Layers, Replace, Download, Compass,
} from 'lucide-vue-next'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

interface AgentForm {
  name: string
  description: string
  model: string
  category: string
  system_prompt: string
  tools: string[]
  allowed_roles: string
  max_tokens_per_session: number
  icon: string
  color: string
  tags: string
  is_active: boolean
  memory_enabled: boolean
  memory_scope: string
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const isEdit = ref(false)
const agentId = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)

const form = ref<AgentForm>({
  name: '',
  description: '',
  model: 'claude-sonnet-4-6',
  category: 'Development',
  system_prompt: '',
  tools: [],
  allowed_roles: '',
  max_tokens_per_session: 100000,
  icon: 'code',
  color: '#6366F1',
  tags: '',
  is_active: true,
  memory_enabled: true,
  memory_scope: 'personal',
})

const newTool = ref('')
const showToolPicker = ref(false)

// All available MCP tools grouped by service
const toolCatalog = computed(() => [
  {
    service: 'jira',
    label: 'Jira',
    icon: Clipboard,
    color: '#0052CC',
    tools: [
      { id: 'jira:search_issues', label: t('tools.jira.search_issues') },
      { id: 'jira:get_issue', label: t('tools.jira.get_issue') },
      { id: 'jira:create_issue', label: t('tools.jira.create_issue') },
      { id: 'jira:update_issue', label: t('tools.jira.update_issue') },
      { id: 'jira:add_comment', label: t('tools.jira.add_comment') },
      { id: 'jira:get_transitions', label: t('tools.jira.get_transitions') },
      { id: 'jira:transition_issue', label: t('tools.jira.transition_issue') },
    ],
  },
  {
    service: 'gitlab',
    label: 'GitLab',
    icon: GitBranch,
    color: '#FC6D26',
    tools: [
      { id: 'gitlab:read_file', label: t('tools.gitlab.read_file') },
      { id: 'gitlab:list_files', label: t('tools.gitlab.list_files') },
      { id: 'gitlab:list_mrs', label: t('tools.gitlab.list_mrs') },
      { id: 'gitlab:get_mr_diff', label: t('tools.gitlab.get_mr_diff') },
      { id: 'gitlab:add_mr_comment', label: t('tools.gitlab.add_mr_comment') },
      { id: 'gitlab:create_branch', label: t('tools.gitlab.create_branch') },
      { id: 'gitlab:commit_files', label: t('tools.gitlab.commit_files') },
      { id: 'gitlab:create_mr', label: t('tools.gitlab.create_mr') },
    ],
  },
  {
    service: 'db',
    label: 'База данных',
    icon: Database,
    color: '#336791',
    tools: [
      { id: 'db:read_query', label: t('tools.db.read_query') },
      { id: 'db:describe_table', label: t('tools.db.describe_table') },
      { id: 'db:list_tables', label: t('tools.db.list_tables') },
    ],
  },
  {
    service: 'docs',
    label: 'Docs',
    icon: Compass,
    color: '#10B981',
    tools: [
      { id: 'docs:get_context', label: t('tools.docs.get_context') },
      { id: 'docs:get_project', label: t('tools.docs.get_project') },
      { id: 'docs:get_team', label: t('tools.docs.get_team') },
      { id: 'docs:search_docs', label: t('tools.docs.search_docs') },
    ],
  },
  {
    service: 'figma',
    label: 'Figma',
    icon: Pen,
    color: '#A259FF',
    tools: [
      { id: 'figma:get_file', label: t('tools.figma.get_file') },
      { id: 'figma:get_file_nodes', label: t('tools.figma.get_file_nodes') },
      { id: 'figma:get_file_styles', label: t('tools.figma.get_file_styles') },
      { id: 'figma:get_file_components', label: t('tools.figma.get_file_components') },
      { id: 'figma:get_file_images', label: t('tools.figma.get_file_images') },
    ],
  },
  {
    service: 'pencil',
    label: 'Pencil',
    icon: Layout,
    color: '#FF6B6B',
    tools: [
      { id: 'pencil:get_editor_state', label: t('tools.pencil.get_editor_state') },
      { id: 'pencil:open_document', label: t('tools.pencil.open_document') },
      { id: 'pencil:get_guidelines', label: t('tools.pencil.get_guidelines') },
      { id: 'pencil:get_style_guide_tags', label: t('tools.pencil.get_style_guide_tags') },
      { id: 'pencil:get_style_guide', label: t('tools.pencil.get_style_guide') },
      { id: 'pencil:batch_get', label: t('tools.pencil.batch_get') },
      { id: 'pencil:batch_design', label: t('tools.pencil.batch_design') },
      { id: 'pencil:snapshot_layout', label: t('tools.pencil.snapshot_layout') },
      { id: 'pencil:get_screenshot', label: t('tools.pencil.get_screenshot') },
      { id: 'pencil:get_variables', label: t('tools.pencil.get_variables') },
      { id: 'pencil:set_variables', label: t('tools.pencil.set_variables') },
      { id: 'pencil:find_empty_space_on_canvas', label: t('tools.pencil.find_empty_space_on_canvas') },
      { id: 'pencil:search_all_unique_properties', label: t('tools.pencil.search_all_unique_properties') },
      { id: 'pencil:replace_all_matching_properties', label: t('tools.pencil.replace_all_matching_properties') },
      { id: 'pencil:export_nodes', label: t('tools.pencil.export_nodes') },
    ],
  },
])

function isToolSelected(toolId: string): boolean {
  return form.value.tools.includes(toolId)
}

function toggleTool(toolId: string) {
  const idx = form.value.tools.indexOf(toolId)
  if (idx >= 0) {
    form.value.tools.splice(idx, 1)
  } else {
    form.value.tools.push(toolId)
  }
}

function toggleServiceAll(service: typeof toolCatalog.value[0]) {
  const allSelected = service.tools.every(t => form.value.tools.includes(t.id))
  if (allSelected) {
    // Deselect all
    for (const t of service.tools) {
      const idx = form.value.tools.indexOf(t.id)
      if (idx >= 0) form.value.tools.splice(idx, 1)
    }
  } else {
    // Select all
    for (const t of service.tools) {
      if (!form.value.tools.includes(t.id)) form.value.tools.push(t.id)
    }
  }
}

function isServiceFullySelected(service: typeof toolCatalog.value[0]): boolean {
  return service.tools.every(t => form.value.tools.includes(t.id))
}

function isServicePartiallySelected(service: typeof toolCatalog.value[0]): boolean {
  return service.tools.some(t => form.value.tools.includes(t.id)) && !isServiceFullySelected(service)
}

function getServiceToolCount(service: typeof toolCatalog.value[0]): number {
  return service.tools.filter(t => form.value.tools.includes(t.id)).length
}

// Build a flat lookup for tool display info
const toolDisplayMap = computed(() => {
  const map: Record<string, { label: string; service: string; serviceLabel: string; color: string; icon: any }> = {}
  for (const group of toolCatalog.value) {
    for (const tool of group.tools) {
      map[tool.id] = { label: tool.label, service: group.service, serviceLabel: group.label, color: group.color, icon: group.icon }
    }
  }
  return map
})

function getToolDisplay(toolId: string) {
  return toolDisplayMap.value[toolId] || null
}

// Group selected tools by service for compact display
const selectedByService = computed(() => {
  const groups: { service: string; label: string; color: string; icon: any; tools: { id: string; label: string }[] }[] = []
  for (const group of toolCatalog.value) {
    const selected = group.tools.filter(t => form.value.tools.includes(t.id))
    if (selected.length > 0) {
      groups.push({ service: group.service, label: group.label, color: group.color, icon: group.icon, tools: selected })
    }
  }
  // Add unknown tools (custom ones not in catalog)
  const knownIds = new Set(toolCatalog.value.flatMap(g => g.tools.map(t => t.id)))
  const custom = form.value.tools.filter(t => !knownIds.has(t))
  if (custom.length > 0) {
    groups.push({ service: 'custom', label: t('agentEditor.customTools'), color: '#6B7280', icon: Settings2, tools: custom.map(id => ({ id, label: id })) })
  }
  return groups
})

const modelOptions = [
  { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6' },
  { value: 'claude-opus-4-6', label: 'claude-opus-4-6' },
  { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5' },
]

const categoryOptions = ['Development', 'QA', 'Management', 'Design', 'Data', 'DevOps']

// Icon picker
const iconOptions = [
  { key: 'code', icon: Code, label: 'Code' },
  { key: 'bug', icon: Bug, label: 'Bug' },
  { key: 'clipboard', icon: Clipboard, label: 'Clipboard' },
  { key: 'palette', icon: Palette, label: 'Palette' },
  { key: 'database', icon: Database, label: 'Database' },
  { key: 'shield', icon: Shield, label: 'Shield' },
  { key: 'server', icon: Server, label: 'Server' },
  { key: 'smartphone', icon: Smartphone, label: 'Mobile' },
]

const showIconPicker = ref(false)

const currentIcon = computed(() => {
  return iconOptions.find(o => o.key === form.value.icon) || iconOptions[0]
})

function selectIcon(key: string) {
  form.value.icon = key
  showIconPicker.value = false
}

// Color picker
const colorPresets = [
  '#6366F1', '#5988FF', '#3B82F6', '#0EA5E9',
  '#10B981', '#F59E0B', '#EC4899', '#8B5CF6',
  '#EF4444', '#F97316', '#14B8A6', '#6B7280',
]

const showColorPicker = ref(false)

function selectColor(c: string) {
  form.value.color = c
  showColorPicker.value = false
}

// Close pickers on outside click
function handleOutsideClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (showIconPicker.value && !target.closest('[data-picker="icon"]')) {
    showIconPicker.value = false
  }
  if (showColorPicker.value && !target.closest('[data-picker="color"]')) {
    showColorPicker.value = false
  }
}

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

function addTool() {
  const tool = newTool.value.trim()
  if (tool && !form.value.tools.includes(tool)) {
    form.value.tools.push(tool)
  }
  newTool.value = ''
}

function removeTool(index: number) {
  form.value.tools.splice(index, 1)
}

function handleToolKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addTool()
  }
}

async function save() {
  if (!form.value.name.trim()) {
    toast.error(t('agentEditor.nameRequired'))
    return
  }
  saving.value = true
  const payload = {
    name: form.value.name,
    description: form.value.description || null,
    model: form.value.model,
    system_prompt: form.value.system_prompt || null,
    tools: form.value.tools,
    allowed_roles: form.value.allowed_roles.split(',').map(s => s.trim()).filter(Boolean),
    max_tokens_per_session: form.value.max_tokens_per_session,
    icon: form.value.icon || null,
    color: form.value.color || null,
    tags: form.value.tags.split(',').map(s => s.trim()).filter(Boolean),
    is_active: form.value.is_active,
    memory_enabled: form.value.memory_enabled,
    memory_scope: form.value.memory_scope,
  }

  try {
    if (isEdit.value && agentId.value) {
      await api.put(`/agents/${agentId.value}`, payload)
      toast.success(t('agentEditor.agentUpdated'))
    } else {
      await api.post('/agents', payload)
      toast.success(t('agentEditor.agentCreated'))
    }
    router.push('/admin')
  } catch {
    toast.error(t('agentEditor.saveError'))
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push('/admin')
}

onMounted(async () => {
  const id = route.params.id as string | undefined
  if (id) {
    isEdit.value = true
    agentId.value = id
    loading.value = true
    try {
      const data = await api.get<any>(`/agents/${id}`)
      form.value = {
        name: data.name,
        description: data.description || '',
        model: data.model,
        category: data.tags?.[0] || 'Development',
        system_prompt: data.system_prompt || '',
        tools: data.tools || [],
        allowed_roles: (data.allowed_roles || []).join(', '),
        max_tokens_per_session: data.max_tokens_per_session,
        icon: data.icon || 'code',
        color: data.color || '#6366F1',
        tags: (data.tags || []).join(', '),
        is_active: data.is_active,
        memory_enabled: data.memory_enabled ?? true,
        memory_scope: data.memory_scope || 'personal',
      }
    } catch {
      toast.error(t('agentEditor.loadError'))
    } finally {
      loading.value = false
    }
  }
  document.addEventListener('click', handleOutsideClick)
})
</script>

<template>
  <div class="p-6 sm:p-10 max-w-[1200px]">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="font-heading text-2xl sm:text-[32px] font-medium text-text-primary tracking-tight">
          {{ isEdit ? $t('agentEditor.editTitle') : $t('agentEditor.createTitle') }}
        </h1>
        <p class="text-sm text-text-secondary mt-1">{{ $t('agentEditor.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
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
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="flex gap-8">
      <div class="flex-1 flex flex-col gap-5">
        <div class="h-12 bg-bg-subtle rounded-lg animate-pulse" />
        <div class="h-20 bg-bg-subtle rounded-lg animate-pulse" />
        <div class="h-12 bg-bg-subtle rounded-lg animate-pulse" />
        <div class="h-12 bg-bg-subtle rounded-lg animate-pulse" />
      </div>
      <div class="flex-1 flex flex-col gap-5">
        <div class="h-36 bg-bg-subtle rounded-lg animate-pulse" />
        <div class="h-12 bg-bg-subtle rounded-lg animate-pulse" />
        <div class="h-12 bg-bg-subtle rounded-lg animate-pulse" />
        <div class="h-12 bg-bg-subtle rounded-lg animate-pulse" />
      </div>
    </div>

    <!-- Two-column form -->
    <div v-else class="flex flex-col lg:flex-row gap-8">
      <!-- Left column -->
      <div class="flex-1 flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('agentEditor.agentName') }}</label>
          <input
            v-model="form.name"
            placeholder="Frontend Dev Agent"
            class="w-full px-4 py-3 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('common.description') }}</label>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Code review, рефакторинг фронтенда, помощь с Vue/React компонентами."
            class="w-full px-4 py-3 border border-border bg-transparent text-text-secondary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors resize-none leading-relaxed"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('common.model') }}</label>
          <div class="relative">
            <select
              v-model="form.model"
              class="w-full px-4 py-3 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none appearance-none cursor-pointer focus:border-text-secondary transition-colors"
            >
              <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <ChevronDown :size="16" class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('agentEditor.category') }}</label>
          <div class="relative">
            <select
              v-model="form.category"
              class="w-full px-4 py-3 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none appearance-none cursor-pointer focus:border-text-secondary transition-colors"
            >
              <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
            </select>
            <ChevronDown :size="16" class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          </div>
        </div>

        <!-- Icon & Color pickers -->
        <div class="flex gap-4">
          <!-- Icon picker -->
          <div class="flex-1 flex flex-col gap-1.5 relative" data-picker="icon">
            <label class="text-[13px] font-medium text-text-primary">{{ $t('common.icon') }}</label>
            <button
              class="w-full px-4 py-3 border border-border rounded-lg text-sm flex items-center gap-3 hover:border-text-secondary transition-colors"
              @click="showIconPicker = !showIconPicker"
            >
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center"
                :style="{ backgroundColor: form.color + '20' }"
              >
                <component :is="currentIcon.icon" :size="16" :style="{ color: form.color }" />
              </div>
              <span class="text-text-primary">{{ currentIcon.label }}</span>
              <ChevronDown :size="14" class="ml-auto text-text-muted" />
            </button>
            <div
              v-if="showIconPicker"
              class="absolute top-[72px] left-0 z-10 bg-bg-card border border-border rounded-xl shadow-lg p-3 w-full"
            >
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="opt in iconOptions"
                  :key="opt.key"
                  class="flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors"
                  :class="form.icon === opt.key ? 'bg-brand/10 ring-2 ring-brand' : 'hover:bg-bg-subtle'"
                  @click="selectIcon(opt.key)"
                >
                  <component :is="opt.icon" :size="20" :style="{ color: form.color }" />
                  <span class="text-[10px] text-text-secondary">{{ opt.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Color picker -->
          <div class="flex-1 flex flex-col gap-1.5 relative" data-picker="color">
            <label class="text-[13px] font-medium text-text-primary">{{ $t('common.color') }}</label>
            <button
              class="w-full px-4 py-3 border border-border rounded-lg text-sm flex items-center gap-3 hover:border-text-secondary transition-colors"
              @click="showColorPicker = !showColorPicker"
            >
              <div class="w-7 h-7 rounded-lg" :style="{ backgroundColor: form.color }" />
              <span class="text-text-primary font-mono text-xs">{{ form.color }}</span>
              <ChevronDown :size="14" class="ml-auto text-text-muted" />
            </button>
            <div
              v-if="showColorPicker"
              class="absolute top-[72px] left-0 z-10 bg-bg-card border border-border rounded-xl shadow-lg p-3 w-full"
            >
              <div class="grid grid-cols-6 gap-2 mb-3">
                <button
                  v-for="c in colorPresets"
                  :key="c"
                  class="w-8 h-8 rounded-lg transition-transform hover:scale-110"
                  :class="form.color === c ? 'ring-2 ring-offset-2 ring-brand' : ''"
                  :style="{ backgroundColor: c }"
                  @click="selectColor(c)"
                />
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model="form.color"
                  type="color"
                  class="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <input
                  v-model="form.color"
                  class="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs font-mono text-text-primary bg-transparent outline-none"
                  placeholder="#6366F1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="flex-1 flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('agentEditor.systemPrompt') }}</label>
          <textarea
            v-model="form.system_prompt"
            rows="6"
            placeholder="Ты — Frontend Dev Agent. Помогаешь с code review, рефакторингом и архитектурными решениями..."
            class="w-full px-4 py-3 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors resize-none leading-relaxed"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-[13px] font-medium text-text-primary">
              {{ $t('agentEditor.availableTools') }}
              <span v-if="form.tools.length > 0" class="text-text-muted font-normal">({{ form.tools.length }})</span>
            </label>
            <button
              class="text-[11px] text-brand hover:underline"
              @click="showToolPicker = !showToolPicker"
            >
              {{ showToolPicker ? $t('common.collapse') : $t('agentEditor.select') }}
            </button>
          </div>

          <!-- Selected tools preview — grouped by service -->
          <div v-if="form.tools.length > 0 && !showToolPicker" class="flex flex-col gap-2">
            <div
              v-for="group in selectedByService"
              :key="group.service"
              class="flex items-start gap-2"
            >
              <div
                class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                :style="{ backgroundColor: group.color + '15' }"
              >
                <component :is="group.icon" :size="13" :style="{ color: group.color }" />
              </div>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="tool in group.tools"
                  :key="tool.id"
                  class="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                  :style="{ backgroundColor: group.color + '12', color: group.color }"
                >
                  {{ tool.label }}
                  <button class="hover:text-[#EF4444] transition-colors" @click="removeTool(form.tools.indexOf(tool.id))">
                    <X :size="10" />
                  </button>
                </span>
              </div>
            </div>
          </div>

          <!-- Tool picker grid -->
          <div v-if="showToolPicker" class="border border-border rounded-xl overflow-hidden">
            <div
              v-for="group in toolCatalog"
              :key="group.service"
              class="border-b border-border last:border-b-0"
            >
              <!-- Service header -->
              <button
                class="flex items-center gap-3 w-full px-4 py-3 hover:bg-bg-subtle transition-colors text-left"
                @click="toggleServiceAll(group)"
              >
                <div
                  class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  :style="{ backgroundColor: group.color + '15' }"
                >
                  <component :is="group.icon" :size="15" :style="{ color: group.color }" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-[13px] font-medium text-text-primary">{{ group.label }}</div>
                  <div class="text-[10px] text-text-muted">{{ getServiceToolCount(group) }} / {{ group.tools.length }}</div>
                </div>
                <div
                  class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                  :class="isServiceFullySelected(group)
                    ? 'bg-brand border-brand'
                    : isServicePartiallySelected(group)
                      ? 'border-brand bg-brand/30'
                      : 'border-border'"
                >
                  <svg v-if="isServiceFullySelected(group)" width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div v-else-if="isServicePartiallySelected(group)" class="w-1.5 h-1.5 rounded-sm bg-white" />
                </div>
              </button>

              <!-- Individual tools -->
              <div v-if="getServiceToolCount(group) > 0 || isServicePartiallySelected(group) || isServiceFullySelected(group)" class="px-4 pb-2">
                <div class="flex flex-wrap gap-1.5 pl-10">
                  <button
                    v-for="tool in group.tools"
                    :key="tool.id"
                    class="px-2.5 py-1 rounded-md text-[11px] border transition-colors"
                    :class="isToolSelected(tool.id)
                      ? 'border-brand/40 bg-brand/10 text-brand font-medium'
                      : 'border-border text-text-secondary hover:border-text-secondary'"
                    @click.stop="toggleTool(tool.id)"
                  >
                    {{ tool.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Manual add (for custom tools) -->
          <div class="flex items-center gap-1 border border-border rounded-md px-2.5 py-1 w-fit">
            <input
              v-model="newTool"
              :placeholder="$t('agentEditor.customTool')"
              class="bg-transparent text-xs text-text-primary outline-none w-40"
              @keydown="handleToolKeydown"
            />
            <button v-if="newTool.trim()" class="text-text-muted hover:text-text-primary" @click="addTool">
              <Plus :size="12" />
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('agentEditor.accessRoles') }}</label>
          <div class="relative">
            <input
              v-model="form.allowed_roles"
              placeholder="developer, team_lead"
              class="w-full px-4 py-3 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors"
            />
            <ChevronDown :size="16" class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[13px] font-medium text-text-primary">{{ $t('agentEditor.tokenLimit') }}</label>
          <input
            v-model.number="form.max_tokens_per_session"
            type="number"
            placeholder="100000"
            class="w-full px-4 py-3 border border-border bg-transparent text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors"
          />
        </div>

        <!-- Memory settings -->
        <div class="border border-border rounded-xl p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
                  <path d="M12 2a8 8 0 0 0-8 8c0 4.4 3.6 8 8 8s8-3.6 8-8a8 8 0 0 0-8-8z"/>
                  <path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/>
                  <path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <span class="text-[13px] font-medium text-text-primary">{{ $t('agentEditor.agentMemory') }}</span>
            </div>
            <button
              class="relative w-10 h-5 rounded-full transition-colors"
              :class="form.memory_enabled ? 'bg-brand' : 'bg-border'"
              @click="form.memory_enabled = !form.memory_enabled"
            >
              <div
                class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                :class="form.memory_enabled ? 'translate-x-5' : 'translate-x-0.5'"
              />
            </button>
          </div>
          <p class="text-[11px] text-text-secondary leading-relaxed">
            {{ $t('agentEditor.memoryDescription') }}
          </p>
          <div v-if="form.memory_enabled" class="flex gap-3">
            <label
              class="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-xs transition-colors"
              :class="form.memory_scope === 'personal' ? 'border-brand bg-brand/5 text-brand' : 'border-border text-text-secondary'"
            >
              <input v-model="form.memory_scope" type="radio" value="personal" class="hidden" />
              {{ $t('common.personal') }}
            </label>
            <label
              class="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-xs transition-colors"
              :class="form.memory_scope === 'shared' ? 'border-brand bg-brand/5 text-brand' : 'border-border text-text-secondary'"
            >
              <input v-model="form.memory_scope" type="radio" value="shared" class="hidden" />
              {{ $t('common.shared') }}
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
