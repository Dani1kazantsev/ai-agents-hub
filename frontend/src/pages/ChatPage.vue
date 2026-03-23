<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Send, Bot, ArrowLeft, Wrench, ChevronDown, ChevronRight,
  Check, Loader2, Plus, MessageSquare, GitBranch, GitPullRequest,
  Copy, CheckCheck, Paperclip, X, FileText, Image, Download,
  Brain, Users, Square,
} from 'lucide-vue-next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '@/stores/chat'
import { useAgentsStore } from '@/stores/agents'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import ToolConfirmModal from '@/components/ToolConfirmModal.vue'

const { t } = useI18n()
const route = useRoute()
const chatStore = useChatStore()
const agentsStore = useAgentsStore()
const authStore = useAuthStore()

const input = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const attachedFiles = ref<{ file: File; preview?: string }[]>([])

// Track which tool blocks are expanded (by message index)
const expandedTools = reactive<Record<number, boolean>>({})
// Track which tool results are fully shown (by "msgIdx-toolIdx" key)
const expandedResults = reactive<Record<string, boolean>>({})

const actionIconMap: Record<string, any> = {
  'create': Plus,
  'comment': MessageSquare,
  'branch': GitBranch,
  'mr': GitPullRequest,
  'merge': GitPullRequest,
}

function getActionIcon(action: string): any {
  for (const [key, icon] of Object.entries(actionIconMap)) {
    if (action.toLowerCase().includes(key)) return icon
  }
  return Check
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function openFileDialog() {
  fileInputRef.value?.click()
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files) return
  for (const file of Array.from(target.files)) {
    const entry: { file: File; preview?: string } = { file }
    if (file.type.startsWith('image/')) {
      entry.preview = URL.createObjectURL(file)
    }
    attachedFiles.value.push(entry)
  }
  target.value = ''
}

function removeFile(index: number) {
  const entry = attachedFiles.value[index]
  if (entry.preview) URL.revokeObjectURL(entry.preview)
  attachedFiles.value.splice(index, 1)
}

async function uploadFiles(): Promise<string[]> {
  if (attachedFiles.value.length === 0) return []
  const sessionId = chatStore.currentSession?.id || ''
  const paths: string[] = []
  for (const entry of attachedFiles.value) {
    const formData = new FormData()
    formData.append('file', entry.file)
    const result = await api.upload<{ path: string }>(`/chat/sessions/${sessionId}/upload`, formData)
    paths.push(result.path)
  }
  return paths
}

async function handleSend() {
  const content = input.value.trim()
  if (!content && attachedFiles.value.length === 0) return

  let message = content
  if (attachedFiles.value.length > 0) {
    try {
      const paths = await uploadFiles()
      const fileRefs = paths.map(p => `[${t('chat.attachedFile', { path: p })}]`).join('\n')
      message = fileRefs + (content ? '\n\n' + content : '')
      // Clean up previews
      attachedFiles.value.forEach(e => { if (e.preview) URL.revokeObjectURL(e.preview) })
      attachedFiles.value = []
    } catch {
      return
    }
  }

  chatStore.sendMessage(message)
  input.value = ''
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
  scrollToBottom()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      const named = new File([file], `paste-${Date.now()}.png`, { type: file.type })
      attachedFiles.value.push({
        file: named,
        preview: URL.createObjectURL(named),
      })
    }
  }
}

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

function toggleTools(msgIdx: number) {
  expandedTools[msgIdx] = !expandedTools[msgIdx]
}

function toggleResult(key: string) {
  expandedResults[key] = !expandedResults[key]
}

// Track copied state for code blocks
const copiedBlocks = reactive<Record<string, boolean>>({})

function renderMarkdown(text: string): string {
  if (!text) return ''
  const html = marked.parse(text, { async: false, breaks: true, gfm: true }) as string
  return DOMPurify.sanitize(html)
}

async function copyCode(code: string, blockId: string) {
  await navigator.clipboard.writeText(code)
  copiedBlocks[blockId] = true
  setTimeout(() => { copiedBlocks[blockId] = false }, 2000)
}

function openImage(url: string) {
  window.open(url, '_blank')
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  return text.slice(0, limit) + '...'
}

function formatToolInput(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input, null, 2)
  } catch {
    return String(input)
  }
}

function hasTools(msg: any): boolean {
  return (msg.tool_calls && msg.tool_calls.length > 0) || (msg.tool_results && msg.tool_results.length > 0)
}

const lastAssistantIdx = computed(() => {
  for (let i = chatStore.messages.length - 1; i >= 0; i--) {
    if (chatStore.messages[i].role === 'assistant') return i
  }
  return -1
})

const contextBarColor = computed(() => {
  const pct = chatStore.contextStats.usage_percent
  if (pct > 90) return '#EF4444'
  if (pct > 70) return '#F59E0B'
  return '#10B981'
})

function isMemoryTool(name: string) {
  return name.startsWith('mcp__memory__') || name.startsWith('memory:') || name.startsWith('memory__')
}

function isOrchestratorTool(name: string) {
  return name.startsWith('mcp__orchestrator__') || name.startsWith('orchestrator:') || name.startsWith('orchestrator__')
}

function getToolIcon(name: string) {
  if (isMemoryTool(name)) return Brain
  if (isOrchestratorTool(name)) return Users
  return Wrench
}

function getToolLabel(name: string) {
  if (isMemoryTool(name)) return t('chat.memoryTool')
  if (isOrchestratorTool(name)) return t('chat.orchestratorTool')
  return name
}

watch(() => chatStore.messages.length, scrollToBottom)
watch(() => chatStore.activeTools.length, scrollToBottom)
watch(() => chatStore.isThinking, scrollToBottom)

onMounted(async () => {
  const sessionId = route.params.id as string
  try {
    const session = await api.get<any>(`/chat/sessions/${sessionId}`)
    chatStore.currentSession = session
    chatStore.messages = session.messages || []
    if (session.agent_id) {
      agentsStore.fetchAgent(session.agent_id)
    }
  } catch {
    // session will be loaded via WebSocket
  }
  chatStore.connectWebSocket(sessionId)
})

onUnmounted(() => {
  chatStore.disconnect()
})
</script>

<template>
  <div class="flex flex-col h-screen">
    <!-- Header -->
    <div class="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
      <router-link to="/chats" class="text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft :size="20" />
      </router-link>
      <div class="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
        <Bot :size="18" class="text-brand" />
      </div>
      <div class="flex-1">
        <h2 class="font-heading text-sm font-medium text-text-primary">
          {{ agentsStore.selectedAgent?.name || $t('common.agent') }}
        </h2>
        <p class="text-xs text-text-secondary">{{ agentsStore.selectedAgent?.model || '' }}</p>
      </div>

      <!-- Context usage bar -->
      <div v-if="chatStore.contextStats.usage_percent > 0" class="flex items-center gap-2">
        <div class="w-24 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{ width: Math.min(chatStore.contextStats.usage_percent, 100) + '%', backgroundColor: contextBarColor }"
          />
        </div>
        <span class="text-[10px] font-mono" :style="{ color: contextBarColor }">
          {{ chatStore.contextStats.usage_percent }}%
        </span>
      </div>

      <!-- Memory link -->
      <router-link
        v-if="agentsStore.selectedAgent?.id"
        :to="`/agents/${agentsStore.selectedAgent.id}/memory`"
        class="p-2 rounded-lg text-text-secondary hover:text-purple-500 hover:bg-purple-500/10 transition-colors"
        :title="$t('chat.agentMemory')"
      >
        <Brain :size="18" />
      </router-link>
    </div>

    <!-- Context compaction toast -->
    <div
      v-if="chatStore.contextCompacted"
      class="mx-6 mt-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2"
    >
      <Brain :size="16" />
      {{ $t('chat.contextCompacted') }}
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-auto px-12 py-6 flex flex-col gap-5">
      <div v-if="chatStore.messages.length === 0" class="flex-1 flex items-center justify-center">
        <p class="text-sm text-text-muted">{{ $t('chat.startDialog') }}</p>
      </div>

      <div
        v-for="(msg, msgIdx) in chatStore.messages"
        :key="msg.id || msg.created_at"
        class="flex flex-col"
        :class="msg.role === 'user' ? 'items-end' : 'items-start'"
      >
        <!-- Assistant message -->
        <div v-if="msg.role === 'assistant'" class="flex gap-3 max-w-[580px]">
          <div class="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-1">
            <Bot :size="16" class="text-brand" />
          </div>
          <div class="flex flex-col gap-0">
            <!-- Text content with markdown -->
            <div
              v-if="msg.content"
              class="bg-bg-subtle rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-text-primary leading-relaxed prose-chat"
              v-html="renderMarkdown(msg.content)"
            />

            <!-- Inline images (screenshots from pencil etc.) -->
            <div v-if="msg.images && msg.images.length > 0" class="flex flex-col gap-2 mt-2">
              <div
                v-for="(imgUrl, imgIdx) in msg.images"
                :key="imgIdx"
                class="rounded-xl overflow-hidden border border-border max-w-[520px]"
              >
                <img
                  :src="imgUrl"
                  :alt="$t('chat.designPreview')"
                  class="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                  @click="openImage(imgUrl)"
                />
              </div>
            </div>

            <!-- Downloadable files -->
            <div v-if="msg.files && msg.files.length > 0" class="flex flex-col gap-2 mt-2">
              <div
                v-for="(file, fIdx) in msg.files"
                :key="fIdx"
                class="flex items-center gap-3 bg-bg-subtle border border-border rounded-xl px-4 py-3 max-w-[400px]"
              >
                <div class="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                  <FileText :size="18" class="text-brand" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-text-primary truncate">{{ file.filename }}</div>
                  <div class="text-xs text-text-secondary">{{ formatFileSize(file.size) }}</div>
                </div>
                <button
                  class="p-2 rounded-lg hover:bg-brand/10 text-brand transition-colors shrink-0"
                  :title="$t('common.download')"
                  @click="downloadFile(file.url, file.filename)"
                >
                  <Download :size="18" />
                </button>
              </div>
            </div>

            <!-- Tool usage block -->
            <div
              v-if="hasTools(msg)"
              class="bg-bg-subtle rounded-lg p-3 mt-2 text-xs text-text-secondary"
            >
              <button
                class="flex items-center gap-1.5 font-medium text-text-primary w-full text-left"
                @click="toggleTools(msgIdx)"
              >
                <Wrench :size="12" />
                <span>{{ $t('chat.toolsUsed', { count: msg.tool_calls?.length || 0 }) }}</span>
                <component
                  :is="expandedTools[msgIdx] ? ChevronDown : ChevronRight"
                  :size="12"
                  class="ml-auto"
                />
              </button>

              <div v-if="expandedTools[msgIdx]" class="mt-2 flex flex-col gap-2">
                <div
                  v-for="(tool, toolIdx) in (msg.tool_calls || [])"
                  :key="toolIdx"
                  class="border border-border rounded-md p-2 bg-bg-card"
                >
                  <div class="font-mono text-[11px] font-medium text-text-primary">{{ tool.tool_name }}</div>

                  <!-- Tool input -->
                  <div class="mt-1 text-[11px] text-text-secondary">
                    <span class="font-medium">{{ $t('chat.params') }}</span>
                    <pre class="mt-0.5 whitespace-pre-wrap break-all font-mono text-[10px] bg-bg-subtle rounded p-1.5">{{ formatToolInput(tool.tool_input) }}</pre>
                  </div>

                  <!-- Tool result (if available) -->
                  <div
                    v-if="msg.tool_results && msg.tool_results[toolIdx]"
                    class="mt-1.5 text-[11px] text-text-secondary"
                  >
                    <span class="font-medium">{{ $t('chat.result') }}</span>
                    <pre class="mt-0.5 whitespace-pre-wrap break-all font-mono text-[10px] bg-bg-subtle rounded p-1.5">{{
                      expandedResults[`${msgIdx}-${toolIdx}`]
                        ? msg.tool_results[toolIdx].content
                        : truncate(msg.tool_results[toolIdx].content, 500)
                    }}</pre>
                    <button
                      v-if="msg.tool_results[toolIdx].content.length > 500"
                      class="text-brand hover:underline mt-0.5"
                      @click="toggleResult(`${msgIdx}-${toolIdx}`)"
                    >
                      {{ expandedResults[`${msgIdx}-${toolIdx}`] ? $t('chat.collapseTool') : $t('chat.showFull') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action buttons (only after last assistant message, when not streaming) -->
            <div
              v-if="msgIdx === lastAssistantIdx && !chatStore.isStreaming && chatStore.actions.length > 0"
              class="flex flex-wrap gap-2 mt-3"
            >
              <button
                v-for="act in chatStore.actions"
                :key="act.action"
                class="border border-border rounded-full px-4 py-2 text-sm text-text-primary hover:bg-bg-subtle flex items-center gap-2 transition-colors"
                @click="chatStore.executeAction(act.action)"
              >
                <component :is="getActionIcon(act.action)" :size="14" />
                {{ act.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- User message -->
        <div v-else class="max-w-[520px]">
          <div class="bg-user-bubble text-user-bubble-text rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
            {{ msg.content }}
          </div>
        </div>
      </div>

      <!-- Thinking indicator -->
      <div v-if="chatStore.isThinking" class="flex gap-3 items-start">
        <div class="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <Bot :size="16" class="text-brand" />
        </div>
        <div class="bg-bg-subtle rounded-2xl rounded-tl-sm px-4 py-3">
          <div class="flex gap-1.5 items-center h-5">
            <div class="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce" style="animation-delay: 0ms" />
            <div class="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce" style="animation-delay: 150ms" />
            <div class="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce" style="animation-delay: 300ms" />
          </div>
        </div>
      </div>

      <!-- Active tool execution indicator -->
      <div v-if="chatStore.activeTools.length > 0" class="flex items-center gap-2 text-xs text-text-secondary">
        <Loader2 :size="14" class="animate-spin text-brand" />
        <component :is="getToolIcon(chatStore.activeTools[chatStore.activeTools.length - 1].tool_name)" :size="12" />
        {{ getToolLabel(chatStore.activeTools[chatStore.activeTools.length - 1].tool_name) }}...
      </div>

      <!-- Streaming indicator (only when no active tools) -->
      <div v-else-if="chatStore.isStreaming" class="flex items-center gap-2 text-xs text-text-secondary">
        <div class="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
        {{ $t('chat.typing') }}
      </div>
    </div>

    <!-- Subagent runs panel -->
    <div v-if="chatStore.subagentRuns.length > 0" class="px-12 py-3 border-t border-border shrink-0">
      <div class="text-xs font-medium text-text-primary mb-2 flex items-center gap-1.5">
        <Users :size="14" class="text-brand" />
        {{ $t('chat.subagents', { count: chatStore.subagentRuns.length }) }}
      </div>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="run in chatStore.subagentRuns"
          :key="run.id"
          class="flex items-center gap-3 bg-bg-subtle rounded-lg px-3 py-2 text-xs"
        >
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <Loader2 v-if="run.status === 'running'" :size="12" class="animate-spin text-brand shrink-0" />
            <Check v-else-if="run.status === 'completed'" :size="12" class="text-green-500 shrink-0" />
            <X v-else :size="12" class="text-red-500 shrink-0" />
            <span class="font-medium text-text-primary truncate">{{ run.agent_name || $t('common.agent') }}</span>
            <span class="text-text-muted truncate">{{ run.task.slice(0, 80) }}</span>
          </div>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
            :class="{
              'bg-blue-500/10 text-blue-500': run.status === 'running',
              'bg-green-500/10 text-green-500': run.status === 'completed',
              'bg-red-500/10 text-red-500': run.status === 'failed' || run.status === 'killed',
              'bg-gray-500/10 text-gray-500': run.status === 'pending',
            }"
          >
            {{ run.status }}
          </span>
          <button
            v-if="run.status === 'running'"
            class="p-1 rounded text-text-muted hover:text-red-500 transition-colors shrink-0"
            :title="$t('chat.cancelSubagent')"
            @click="chatStore.killSubagent(run.id)"
          >
            <Square :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- Claude auth warning -->
    <div v-if="!authStore.claudeAuthenticated"
         class="px-12 py-3 bg-amber-500/10 border-t border-amber-500/30 shrink-0">
      <div class="flex items-center gap-3 text-sm">
        <span class="text-amber-600 dark:text-amber-400">{{ $t('chat.claudeNotConnected') }}</span>
        <router-link to="/claude-auth" class="text-[#5988FF] hover:underline font-medium">{{ $t('chat.connect') }}</router-link>
      </div>
    </div>

    <!-- Input area -->
    <div class="px-12 py-4 border-t border-border shrink-0">
      <!-- Attached files preview -->
      <div v-if="attachedFiles.length > 0" class="flex flex-wrap gap-2 mb-3">
        <div
          v-for="(entry, idx) in attachedFiles"
          :key="idx"
          class="relative group"
        >
          <!-- Image preview -->
          <div v-if="entry.preview" class="w-16 h-16 rounded-lg overflow-hidden border border-border">
            <img :src="entry.preview" :alt="entry.file.name" class="w-full h-full object-cover" />
          </div>
          <!-- File preview -->
          <div v-else class="flex items-center gap-2 bg-bg-subtle border border-border rounded-lg px-3 py-2 text-xs text-text-secondary">
            <FileText :size="14" />
            <span class="max-w-[120px] truncate">{{ entry.file.name }}</span>
          </div>
          <!-- Remove button -->
          <button
            class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            @click="removeFile(idx)"
          >
            <X :size="10" />
          </button>
        </div>
      </div>

      <div class="flex gap-3 items-end">
        <input
          ref="fileInputRef"
          type="file"
          multiple
          accept="image/*,.txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.css,.js,.ts,.py,.sql,.log,.pdf"
          class="hidden"
          @change="handleFileSelect"
        />
        <button
          class="p-3 border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors shrink-0"
          :title="$t('chat.attachFile')"
          @click="openFileDialog"
        >
          <Paperclip :size="18" />
        </button>
        <textarea
          ref="textareaRef"
          v-model="input"
          rows="1"
          :placeholder="$t('chat.placeholder')"
          class="flex-1 px-4 py-3 border border-border bg-bg-input text-text-primary rounded-lg text-sm outline-none focus:border-text-secondary transition-colors resize-none leading-relaxed"
          @keydown="handleKeydown"
          @input="autoResize"
          @paste="handlePaste"
        />
        <button
          class="bg-brand text-white px-5 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-heading text-sm font-medium shrink-0"
          @click="handleSend"
        >
          <Send :size="16" />
          {{ $t('chat.send') }}
        </button>
      </div>
    </div>

    <!-- Tool Confirmation Modal -->
    <ToolConfirmModal
      v-if="chatStore.pendingConfirm"
      :tool-name="chatStore.pendingConfirm.tool_name"
      :tool-input="chatStore.pendingConfirm.tool_input"
      @approve="chatStore.approveToolConfirm()"
      @deny="chatStore.denyToolConfirm()"
    />
  </div>
</template>

<style scoped>
/* Markdown prose styles for chat messages */
.prose-chat :deep(p) {
  margin: 0.25em 0;
}
.prose-chat :deep(p:first-child) {
  margin-top: 0;
}
.prose-chat :deep(p:last-child) {
  margin-bottom: 0;
}
.prose-chat :deep(ul),
.prose-chat :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.prose-chat :deep(li) {
  margin: 0.15em 0;
}
.prose-chat :deep(h1),
.prose-chat :deep(h2),
.prose-chat :deep(h3) {
  font-weight: 600;
  margin: 0.75em 0 0.25em;
}
.prose-chat :deep(h1) { font-size: 1.15em; }
.prose-chat :deep(h2) { font-size: 1.05em; }
.prose-chat :deep(h3) { font-size: 1em; }

/* Inline code */
.prose-chat :deep(code) {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.1em 0.35em;
  font-size: 0.85em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* Code blocks */
.prose-chat :deep(pre) {
  background: var(--color-bg-main);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75em 1em;
  margin: 0.5em 0;
  overflow-x: auto;
  position: relative;
}
.prose-chat :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.82em;
  line-height: 1.6;
  white-space: pre;
}

/* Blockquote */
.prose-chat :deep(blockquote) {
  border-left: 3px solid var(--color-brand);
  padding-left: 0.75em;
  margin: 0.5em 0;
  color: var(--color-text-secondary);
}

/* Table */
.prose-chat :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
  font-size: 0.85em;
}
.prose-chat :deep(th),
.prose-chat :deep(td) {
  border: 1px solid var(--color-border);
  padding: 0.4em 0.6em;
  text-align: left;
}
.prose-chat :deep(th) {
  background: var(--color-bg-input);
  font-weight: 600;
}

/* Strong, em */
.prose-chat :deep(strong) {
  font-weight: 600;
}

/* Links */
.prose-chat :deep(a) {
  color: var(--color-brand);
  text-decoration: underline;
}

/* HR */
.prose-chat :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 0.75em 0;
}
</style>
