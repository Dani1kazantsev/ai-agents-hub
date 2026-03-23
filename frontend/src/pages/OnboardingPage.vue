<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { api } from '@/lib/api'
import {
  Zap, ArrowRight, ArrowLeft, Loader2, Check, ShieldCheck,
  ExternalLink, Sparkles, Play, Users, SkipForward, Plus, X,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

// Steps: 0=claude-auth, 1=describe, 2=loading, 3=select, 4=done
const step = ref(0)

// --- Step 0: Claude Auth ---
const claudeStatus = ref<'checking' | 'not_connected' | 'connecting' | 'waiting_url' | 'connected'>('checking')
const authUrl = ref('')
const terminalOutput = ref<string[]>([])
const ws = ref<WebSocket | null>(null)

async function checkClaudeStatus() {
  claudeStatus.value = 'checking'
  await auth.checkClaudeAuth()
  claudeStatus.value = auth.claudeAuthenticated ? 'connected' : 'not_connected'
  // Auto-advance if already connected
  if (auth.claudeAuthenticated) {
    step.value = 1
  }
}

function startClaudeAuth() {
  claudeStatus.value = 'connecting'
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
      claudeStatus.value = 'waiting_url'
    } else if (data.type === 'done') {
      if (data.success) {
        claudeStatus.value = 'connected'
        auth.claudeAuthenticated = true
        toast.success(t('claudeAuth.connectSuccess'))
        setTimeout(() => { step.value = 1 }, 800)
      } else {
        claudeStatus.value = 'not_connected'
        toast.error(t('claudeAuth.connectError'))
      }
    } else if (data.type === 'error') {
      claudeStatus.value = 'not_connected'
      toast.error(data.content || t('claudeAuth.connectionError'))
    }
  }

  socket.onclose = () => {
    if (claudeStatus.value === 'connecting') {
      claudeStatus.value = 'not_connected'
    }
  }

  ws.value = socket
}

// --- Step 1: Describe tasks ---
const userDescription = ref('')

// --- Step 2-3: Suggestions ---
interface StepDesc {
  agent: string
  label: string
  description: string
}

interface ExistingPipeline {
  id: string
  slug: string
  title: string
  description: string
  human_loop: boolean
  agents: string[]
  steps: StepDesc[]
}

interface SuggestedPipeline {
  title: string
  description: string
  human_loop: boolean
  agents: string[]
  steps_description: StepDesc[]
}

const suggestedExisting = ref<ExistingPipeline[]>([])
const suggestedNew = ref<SuggestedPipeline[]>([])
const otherExisting = ref<ExistingPipeline[]>([])
const selectedExisting = ref<Set<string>>(new Set())
const selectedNew = ref<Set<number>>(new Set())
const selectedOther = ref<Set<string>>(new Set())
const suggesting = ref(false)
const completing = ref(false)

async function submitDescription() {
  if (!userDescription.value.trim()) {
    toast.error(t('onboarding.describeError'))
    return
  }
  step.value = 2
  suggesting.value = true

  try {
    const result = await api.post<{ existing: ExistingPipeline[]; suggested: SuggestedPipeline[]; other: ExistingPipeline[] }>(
      '/onboarding/suggest',
      { description: userDescription.value }
    )
    suggestedExisting.value = result.existing
    suggestedNew.value = result.suggested
    otherExisting.value = result.other

    // Pre-select AI picks (both matched existing and new custom)
    selectedExisting.value = new Set(result.existing.map(e => e.id))
    selectedNew.value = new Set(result.suggested.map((_, i) => i))
    selectedOther.value = new Set()

    step.value = 3
  } catch {
    toast.error(t('onboarding.analyzeError'))
    step.value = 1
  } finally {
    suggesting.value = false
  }
}

function toggleExisting(id: string) {
  if (selectedExisting.value.has(id)) {
    selectedExisting.value.delete(id)
  } else {
    selectedExisting.value.add(id)
  }
  // Trigger reactivity
  selectedExisting.value = new Set(selectedExisting.value)
}

function toggleNew(idx: number) {
  if (selectedNew.value.has(idx)) {
    selectedNew.value.delete(idx)
  } else {
    selectedNew.value.add(idx)
  }
  selectedNew.value = new Set(selectedNew.value)
}

function toggleOther(id: string) {
  if (selectedOther.value.has(id)) {
    selectedOther.value.delete(id)
  } else {
    selectedOther.value.add(id)
  }
  selectedOther.value = new Set(selectedOther.value)
}

const totalSelected = computed(() => selectedExisting.value.size + selectedNew.value.size + selectedOther.value.size)

async function completeOnboarding() {
  completing.value = true
  try {
    const selectedSuggested = suggestedNew.value
      .filter((_, i) => selectedNew.value.has(i))

    const allExistingIds = [...Array.from(selectedExisting.value), ...Array.from(selectedOther.value)]
    await api.post('/onboarding/complete', {
      selected_existing: allExistingIds,
      selected_suggested: selectedSuggested,
    })

    // Refresh user data
    await auth.fetchUser()
    step.value = 4

    setTimeout(() => {
      router.push('/pipelines')
    }, 2000)
  } catch {
    toast.error(t('onboarding.saveError'))
  } finally {
    completing.value = false
  }
}

async function skipOnboarding() {
  try {
    await api.post('/onboarding/skip', {})
    await auth.fetchUser()
    router.push('/catalog')
  } catch {
    toast.error(t('common.error'))
  }
}

const stepLabels = computed(() => t('onboarding.steps') as unknown as string[])

function getStepStatus(idx: number) {
  if (step.value > idx || (step.value === idx && idx === 3)) return 'active'
  if (step.value === idx) return 'current'
  return 'pending'
}

onUnmounted(() => {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
})

checkClaudeStatus()
</script>

<template>
  <div class="min-h-screen bg-bg-subtle flex flex-col">

    <!-- Background decoration -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-brand/5 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-brand/5 rounded-full blur-3xl"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/3 rounded-full blur-3xl"></div>
    </div>

    <!-- Header -->
    <header class="relative z-10 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
          <Zap :size="16" class="text-white" />
        </div>
        <span class="font-heading font-semibold text-text-primary">Agent Hub</span>
      </div>
      <button @click="skipOnboarding"
              class="text-sm text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1">
        <SkipForward :size="14" />
        {{ $t('common.skip') }}
      </button>
    </header>

    <!-- Progress bar -->
    <div class="relative z-10 px-6 mb-8" v-if="step < 4">
      <div class="max-w-2xl mx-auto">
        <div class="flex items-center justify-between mb-2">
          <div v-for="(label, idx) in stepLabels" :key="idx"
               class="flex items-center gap-1.5 text-xs"
               :class="step >= idx ? 'text-brand font-medium' : 'text-text-muted'">
            <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                 :class="step > idx ? 'bg-brand text-white' : step === idx ? 'bg-brand/20 text-brand border border-brand' : 'bg-bg-main text-text-muted border border-border'">
              <Check v-if="step > idx" :size="12" />
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span class="hidden sm:inline">{{ label }}</span>
          </div>
        </div>
        <div class="h-1 bg-border rounded-full overflow-hidden">
          <div class="h-full bg-brand rounded-full transition-all duration-500"
               :style="{ width: `${Math.min(((step + 1) / 4) * 100, 100)}%` }"></div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="relative z-10 flex-1 flex items-start justify-center px-6 pb-12">
      <div class="w-full max-w-2xl">

        <!-- Step 0: Claude Auth -->
        <div v-if="step === 0" class="space-y-6">
          <div class="text-center">
            <div class="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck class="w-8 h-8 text-brand" />
            </div>
            <h1 class="font-heading text-2xl font-bold text-text-primary">
              {{ $t('onboarding.welcome') }}
            </h1>
            <p class="text-text-secondary mt-2 max-w-md mx-auto">
              {{ $t('onboarding.connectDescription') }}
            </p>
          </div>

          <!-- Checking -->
          <div v-if="claudeStatus === 'checking'"
               class="bg-bg-main rounded-xl p-8 text-center border border-border">
            <Loader2 class="w-8 h-8 animate-spin text-brand mx-auto mb-3" />
            <p class="text-sm text-text-secondary">{{ $t('claudeAuth.checking') }}</p>
          </div>

          <!-- Not connected -->
          <div v-else-if="claudeStatus === 'not_connected'"
               class="bg-bg-main rounded-xl p-8 border border-border">
            <div class="mb-6">
              <h3 class="font-medium text-text-primary mb-2">{{ $t('onboarding.howItWorks') }}</h3>
              <ol class="text-sm text-text-secondary space-y-2 list-decimal list-inside">
                <li>{{ $t('onboarding.onboardingStep1') }}</li>
                <li>{{ $t('onboarding.onboardingStep2') }}</li>
                <li>{{ $t('onboarding.onboardingStep3') }}</li>
                <li>{{ $t('onboarding.onboardingStep4') }}</li>
              </ol>
            </div>
            <button @click="startClaudeAuth"
                    class="w-full px-4 py-3 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#4A75E6] transition-colors">
              {{ $t('onboarding.connectClaude') }}
            </button>
          </div>

          <!-- Connecting / Waiting URL -->
          <div v-else-if="claudeStatus === 'connecting' || claudeStatus === 'waiting_url'"
               class="bg-bg-main rounded-xl p-8 border border-border">
            <div v-if="authUrl" class="mb-6">
              <p class="text-sm text-text-primary font-medium mb-2">
                {{ $t('onboarding.followLink') }}
              </p>
              <a :href="authUrl" target="_blank" rel="noopener noreferrer"
                 class="flex items-center gap-2 px-4 py-3 bg-brand/10 border border-brand/30 rounded-lg text-brand text-sm hover:bg-brand/20 transition-colors break-all">
                <ExternalLink class="w-4 h-4 shrink-0" />
                {{ authUrl }}
              </a>
              <p class="text-xs text-text-muted mt-2">
                {{ $t('onboarding.returnHelp') }}
              </p>
            </div>
            <div v-else class="text-center mb-4">
              <Loader2 class="w-6 h-6 animate-spin text-brand mx-auto mb-2" />
              <p class="text-sm text-text-secondary">{{ $t('onboarding.starting') }}</p>
            </div>
            <div v-if="terminalOutput.length > 0"
                 class="bg-bg-subtle rounded-lg border border-border p-3 max-h-32 overflow-y-auto">
              <div class="text-xs font-mono text-text-muted space-y-0.5">
                <p v-for="(line, i) in terminalOutput" :key="i">{{ line }}</p>
              </div>
            </div>
          </div>

          <!-- Connected -->
          <div v-else-if="claudeStatus === 'connected'"
               class="bg-bg-main rounded-xl p-8 border border-border text-center">
            <Check class="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p class="font-medium text-text-primary">{{ $t('onboarding.connected') }}</p>
            <p class="text-sm text-text-secondary mt-1">{{ $t('onboarding.settingUp') }}</p>
          </div>
        </div>

        <!-- Step 1: Describe tasks -->
        <div v-else-if="step === 1" class="space-y-6">
          <div class="text-center">
            <div class="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles class="w-8 h-8 text-brand" />
            </div>
            <h1 class="font-heading text-2xl font-bold text-text-primary">
              {{ $t('onboarding.describeTasks') }}
            </h1>
            <p class="text-text-secondary mt-2 max-w-md mx-auto">
              {{ $t('onboarding.describeHelp') }}
            </p>
          </div>

          <div class="bg-bg-main rounded-xl border border-border p-6">
            <textarea
              v-model="userDescription"
              rows="6"
              class="w-full px-4 py-3 rounded-lg border border-border bg-bg-input text-text-primary text-sm placeholder-text-muted outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand resize-none"
              :placeholder="$t('onboarding.describePlaceholder')"
            ></textarea>

            <div class="mt-4 flex items-center gap-3">
              <p class="text-xs text-text-muted flex-1">
                {{ $t('onboarding.describeHint') }}
              </p>
              <button @click="submitDescription"
                      :disabled="!userDescription.trim()"
                      class="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#4A75E6] transition-colors disabled:opacity-40 flex items-center gap-2">
                {{ $t('onboarding.suggestButton') }}
                <ArrowRight :size="16" />
              </button>
            </div>
          </div>

          <!-- Examples -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button v-for="example in [
              $t('onboarding.example1'),
              $t('onboarding.example2'),
              $t('onboarding.example3'),
              $t('onboarding.example4'),
            ]" :key="example"
              @click="userDescription = example"
              class="text-left px-4 py-3 rounded-lg border border-border bg-bg-main text-xs text-text-secondary hover:border-brand/50 hover:text-text-primary transition-colors">
              {{ example }}
            </button>
          </div>
        </div>

        <!-- Step 2: Loading -->
        <div v-else-if="step === 2" class="text-center py-16">
          <div class="w-20 h-20 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-6">
            <Loader2 class="w-10 h-10 animate-spin text-brand" />
          </div>
          <h2 class="font-heading text-xl font-bold text-text-primary mb-2">
            {{ $t('onboarding.analyzing') }}
          </h2>
          <p class="text-text-secondary text-sm max-w-sm mx-auto">
            {{ $t('onboarding.analyzingHelp') }}
          </p>
          <div class="mt-8 max-w-xs mx-auto">
            <div class="h-1 bg-border rounded-full overflow-hidden">
              <div class="h-full bg-brand rounded-full animate-pulse" style="width: 60%"></div>
            </div>
          </div>
        </div>

        <!-- Step 3: Select pipelines -->
        <div v-else-if="step === 3" class="space-y-6">
          <div class="text-center">
            <h1 class="font-heading text-2xl font-bold text-text-primary">
              {{ $t('onboarding.pipelinesReady') }}
            </h1>
            <p class="text-text-secondary mt-2">
              {{ $t('onboarding.selectHelp') }}
            </p>
          </div>

          <!-- Matched existing -->
          <div v-if="suggestedExisting.length > 0">
            <h3 class="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <Play :size="14" class="text-brand" />
              {{ $t('onboarding.matchingCatalog') }}
            </h3>
            <div class="space-y-2">
              <button v-for="pipeline in suggestedExisting" :key="pipeline.id"
                      @click="toggleExisting(pipeline.id)"
                      class="w-full text-left px-4 py-3.5 rounded-xl border transition-all"
                      :class="selectedExisting.has(pipeline.id)
                        ? 'border-brand bg-brand/5'
                        : 'border-border bg-bg-main hover:border-border'">
                <div class="flex items-start gap-3">
                  <div class="w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                       :class="selectedExisting.has(pipeline.id) ? 'border-brand bg-brand' : 'border-border'">
                    <Check v-if="selectedExisting.has(pipeline.id)" :size="12" class="text-white" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="font-medium text-sm text-text-primary">{{ pipeline.title }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            :class="pipeline.human_loop
                              ? 'bg-brand/10 text-brand'
                              : 'bg-green-500/10 text-green-600'">
                        {{ pipeline.human_loop ? $t('pipelines.chatWithTL') : $t('pipelines.auto') }}
                      </span>
                    </div>
                    <p class="text-xs text-text-secondary">{{ pipeline.description }}</p>
                    <div v-if="pipeline.steps && pipeline.steps.length > 0" class="mt-2 flex flex-wrap gap-1">
                      <span v-for="(s, i) in pipeline.steps" :key="i"
                            class="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted border border-border">
                        {{ s.label }}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Suggested new -->
          <div v-if="suggestedNew.length > 0">
            <h3 class="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <Sparkles :size="14" class="text-brand" />
              {{ $t('onboarding.newPipelines') }}
            </h3>
            <div class="space-y-2">
              <button v-for="(pipeline, idx) in suggestedNew" :key="idx"
                      @click="toggleNew(idx)"
                      class="w-full text-left px-4 py-3.5 rounded-xl border transition-all"
                      :class="selectedNew.has(idx)
                        ? 'border-brand bg-brand/5'
                        : 'border-border bg-bg-main hover:border-border'">
                <div class="flex items-start gap-3">
                  <div class="w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                       :class="selectedNew.has(idx) ? 'border-brand bg-brand' : 'border-border'">
                    <Check v-if="selectedNew.has(idx)" :size="12" class="text-white" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="font-medium text-sm text-text-primary">{{ pipeline.title }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 font-medium">
                        {{ $t('common.new') }}
                      </span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            :class="pipeline.human_loop
                              ? 'bg-brand/10 text-brand'
                              : 'bg-green-500/10 text-green-600'">
                        {{ pipeline.human_loop ? $t('pipelines.chatWithTL') : $t('pipelines.auto') }}
                      </span>
                    </div>
                    <p class="text-xs text-text-secondary">{{ pipeline.description }}</p>
                    <div v-if="pipeline.steps_description && pipeline.steps_description.length > 0" class="mt-2 flex flex-wrap gap-1">
                      <span v-for="(s, i) in pipeline.steps_description" :key="i"
                            class="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted border border-border">
                        {{ s.label }}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Other existing (not matched by AI) -->
          <div v-if="otherExisting.length > 0">
            <h3 class="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
              <Plus :size="14" />
              {{ $t('onboarding.alsoSuggest') }}
            </h3>
            <div class="space-y-2">
              <button v-for="pipeline in otherExisting" :key="pipeline.id"
                      @click="toggleOther(pipeline.id)"
                      class="w-full text-left px-4 py-3 rounded-xl border transition-all"
                      :class="selectedOther.has(pipeline.id)
                        ? 'border-brand bg-brand/5'
                        : 'border-border bg-bg-main/60 hover:border-border'">
                <div class="flex items-start gap-3">
                  <div class="w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                       :class="selectedOther.has(pipeline.id) ? 'border-brand bg-brand' : 'border-border'">
                    <Check v-if="selectedOther.has(pipeline.id)" :size="12" class="text-white" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="text-sm text-text-secondary">{{ pipeline.title }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            :class="pipeline.human_loop
                              ? 'bg-brand/10 text-brand'
                              : 'bg-green-500/10 text-green-600'">
                        {{ pipeline.human_loop ? $t('pipelines.chatWithTL') : $t('pipelines.auto') }}
                      </span>
                    </div>
                    <p class="text-xs text-text-muted">{{ pipeline.description }}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- No suggestions -->
          <div v-if="suggestedExisting.length === 0 && suggestedNew.length === 0 && otherExisting.length === 0"
               class="text-center py-8 text-text-secondary text-sm">
            {{ $t('onboarding.noSuggestions') }}
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-2">
            <button @click="step = 1"
                    class="px-4 py-2.5 border border-border rounded-lg text-sm text-text-secondary hover:bg-bg-main transition-colors flex items-center gap-2">
              <ArrowLeft :size="16" />
              {{ $t('common.back') }}
            </button>
            <div class="flex-1"></div>
            <p class="text-xs text-text-muted">
              {{ $t('onboarding.selected', { count: totalSelected }) }}
            </p>
            <button @click="completeOnboarding"
                    :disabled="completing"
                    class="px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-[#4A75E6] transition-colors disabled:opacity-50 flex items-center gap-2">
              <Loader2 v-if="completing" :size="16" class="animate-spin" />
              {{ $t('onboarding.addAndStart') }}
              <ArrowRight v-if="!completing" :size="16" />
            </button>
          </div>
        </div>

        <!-- Step 4: Done -->
        <div v-else-if="step === 4" class="text-center py-16">
          <div class="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <Check class="w-10 h-10 text-green-500" />
          </div>
          <h2 class="font-heading text-2xl font-bold text-text-primary mb-2">
            {{ $t('onboarding.allDone') }}
          </h2>
          <p class="text-text-secondary text-sm max-w-sm mx-auto">
            {{ $t('onboarding.allDoneText') }}
          </p>
        </div>

      </div>
    </div>

  </div>
</template>
