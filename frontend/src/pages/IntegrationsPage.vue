<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  TicketCheck, GitBranch, Database, Pen, FileText,
  X, Save, Check, AlertCircle, Loader2,
} from 'lucide-vue-next'
import { api } from '@/lib/api'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const toast = useToast()

interface IntegrationField {
  key: string
  label: string
  required: boolean
  type: string
}

interface Integration {
  name: string
  description: string
  fields: IntegrationField[]
  is_connected: boolean
  is_enabled: boolean
  values: Record<string, string>
  help_text: string
  help_url: string
}

const integrations = ref<Integration[]>([])
const loading = ref(true)
const selected = ref<Integration | null>(null)
const formValues = ref<Record<string, string>>({})
const formEnabled = ref(false)
const testStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const testError = ref('')
const saving = ref(false)

const serviceIcons: Record<string, any> = {
  jira: TicketCheck,
  gitlab: GitBranch,
  db: Database,
  figma: Pen,
  docs: FileText,
}

const serviceColors: Record<string, string> = {
  jira: '#0052CC',
  gitlab: '#FC6D26',
  db: '#5988FF',
  figma: '#A259FF',
  docs: '#10B981',
}

function getIcon(name: string) {
  return serviceIcons[name.toLowerCase()] || FileText
}

function getColor(name: string) {
  return serviceColors[name.toLowerCase()] || '#5988FF'
}

function openConfigure(integration: Integration) {
  selected.value = integration
  formValues.value = { ...integration.values }
  formEnabled.value = integration.is_enabled
  testStatus.value = 'idle'
  testError.value = ''
}

function closeConfigure() {
  selected.value = null
  formValues.value = {}
  testStatus.value = 'idle'
  testError.value = ''
}

async function testConnection() {
  if (!selected.value) return
  testStatus.value = 'testing'
  testError.value = ''
  try {
    const result = await api.post<{ success: boolean; error?: string }>(
      `/integrations/${selected.value.name}/test`,
      { credentials: formValues.value },
    )
    if (result.success) {
      testStatus.value = 'success'
      toast.success(t('integrations.testSuccess'))
    } else {
      testStatus.value = 'error'
      testError.value = result.error || t('integrations.testFailed')
      toast.error(testError.value)
    }
  } catch {
    testStatus.value = 'error'
    testError.value = t('integrations.testFailed')
    toast.error(t('integrations.testFailed'))
  }
}

async function saveIntegration() {
  if (!selected.value || saving.value) return
  saving.value = true
  try {
    await api.put(`/integrations/${selected.value.name}`, {
      credentials: formValues.value,
      is_enabled: formEnabled.value,
    })
    toast.success(t('integrations.saved'))
    closeConfigure()
    await loadIntegrations()
  } catch {
    toast.error(t('integrations.saveError'))
  } finally {
    saving.value = false
  }
}

async function loadIntegrations() {
  loading.value = true
  try {
    integrations.value = await api.get<Integration[]>('/integrations')
  } catch {
    toast.error(t('integrations.loadError'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadIntegrations()
})
</script>

<template>
  <div class="p-10 max-w-[1200px]">
    <div class="mb-8">
      <h1 class="font-heading text-[32px] font-medium text-text-primary tracking-tight">
        {{ $t('integrations.title') }}
      </h1>
      <p class="text-sm text-text-secondary mt-1">
        {{ $t('integrations.subtitle') }}
      </p>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div v-for="n in 4" :key="n" class="border border-border rounded-xl p-6 flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-lg bg-bg-subtle animate-pulse shrink-0" />
          <div class="flex-1">
            <div class="h-5 w-28 bg-bg-subtle rounded animate-pulse" />
            <div class="h-3 w-48 bg-bg-subtle rounded animate-pulse mt-2" />
          </div>
          <div class="h-6 w-24 bg-bg-subtle rounded-full animate-pulse" />
        </div>
        <div class="flex justify-end">
          <div class="h-9 w-28 bg-bg-subtle rounded-lg animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Integration cards -->
    <div v-else-if="integrations.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div
        v-for="integration in integrations"
        :key="integration.name"
        class="border border-border rounded-xl p-6 flex flex-col gap-4 bg-bg-main"
      >
        <div class="flex items-start gap-3">
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            :style="{ backgroundColor: getColor(integration.name) + '20' }"
          >
            <component
              :is="getIcon(integration.name)"
              :size="20"
              :style="{ color: getColor(integration.name) }"
            />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-heading text-base font-semibold text-text-primary capitalize">
              {{ integration.name }}
            </h3>
            <p class="text-sm text-text-secondary mt-0.5 line-clamp-2">
              {{ integration.description }}
            </p>
          </div>
          <span
            class="text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0"
            :style="{
              backgroundColor: integration.is_connected ? '#10B98120' : '#9CA3AF20',
              color: integration.is_connected ? '#10B981' : '#9CA3AF',
            }"
          >
            {{ integration.is_connected ? $t('integrations.connected') : $t('integrations.notConnected') }}
          </span>
        </div>
        <div class="flex justify-end">
          <button
            class="px-4 py-2 text-sm font-medium font-heading border border-border rounded-lg text-text-primary hover:bg-bg-subtle transition-colors"
            @click="openConfigure(integration)"
          >
            {{ $t('integrations.configure') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-16">
      <p class="text-sm text-text-secondary">{{ $t('integrations.noIntegrations') }}</p>
    </div>

    <!-- Configure modal -->
    <div
      v-if="selected"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="closeConfigure"
    >
      <div class="bg-bg-main border border-border rounded-xl p-6 w-[520px] max-h-[85vh] overflow-auto">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center"
              :style="{ backgroundColor: getColor(selected.name) + '20' }"
            >
              <component
                :is="getIcon(selected.name)"
                :size="18"
                :style="{ color: getColor(selected.name) }"
              />
            </div>
            <h3 class="font-heading text-lg font-semibold text-text-primary capitalize">
              {{ selected.name }}
            </h3>
          </div>
          <button class="text-text-secondary hover:text-text-primary transition-colors" @click="closeConfigure">
            <X :size="18" />
          </button>
        </div>

        <!-- Help text -->
        <div v-if="selected.help_text" class="mb-5 p-3 bg-bg-subtle rounded-lg text-sm text-text-secondary">
          <p>{{ selected.help_text }}</p>
          <a
            v-if="selected.help_url"
            :href="selected.help_url"
            target="_blank"
            rel="noopener"
            class="text-brand hover:underline mt-1 inline-block"
          >
            {{ $t('integrations.learnMore') }} &rarr;
          </a>
        </div>

        <div class="flex flex-col gap-4">
          <div v-for="field in selected.fields" :key="field.key">
            <label class="text-xs font-medium text-text-secondary mb-1 block">
              {{ field.label }}
              <span v-if="field.required" class="text-[#EF4444]">*</span>
            </label>
            <input
              v-model="formValues[field.key]"
              :type="field.type"
              :placeholder="field.type === 'url' ? 'https://...' : ''"
              class="w-full px-3 py-2 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            />
          </div>

          <div class="flex items-center justify-between py-2">
            <span class="text-sm text-text-primary">
              {{ formEnabled ? $t('integrations.enabled') : $t('integrations.disabled') }}
            </span>
            <button
              class="w-11 h-6 rounded-full transition-colors relative"
              :class="formEnabled ? 'bg-[#10B981]' : 'bg-border'"
              @click="formEnabled = !formEnabled"
            >
              <span
                class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                :class="formEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'"
              />
            </button>
          </div>
        </div>

        <div v-if="testStatus === 'success'" class="flex items-center gap-2 mt-4 text-sm text-[#10B981]">
          <Check :size="16" />
          {{ $t('integrations.testSuccess') }}
        </div>
        <div v-if="testStatus === 'error'" class="flex items-center gap-2 mt-4 text-sm text-[#EF4444]">
          <AlertCircle :size="16" />
          {{ testError }}
        </div>

        <div class="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button
            class="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg text-text-secondary hover:bg-bg-subtle transition-colors"
            :disabled="testStatus === 'testing'"
            @click="testConnection"
          >
            <Loader2 v-if="testStatus === 'testing'" :size="14" class="animate-spin" />
            {{ testStatus === 'testing' ? $t('integrations.testing') : $t('integrations.testConnection') }}
          </button>

          <div class="flex gap-3">
            <button
              class="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors"
              @click="closeConfigure"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              class="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:opacity-90 transition-opacity font-heading font-medium"
              :disabled="saving"
              @click="saveIntegration"
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
