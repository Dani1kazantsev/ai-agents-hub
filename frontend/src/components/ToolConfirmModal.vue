<script setup lang="ts">
import { computed } from 'vue'
import { ShieldAlert, GitPullRequest, X, Check } from 'lucide-vue-next'

const props = defineProps<{
  toolName: string
  toolInput: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'approve'): void
  (e: 'deny'): void
}>()

const formattedParams = computed(() => {
  try {
    return JSON.stringify(props.toolInput, null, 2)
  } catch {
    return String(props.toolInput)
  }
})
</script>

<template>
  <div
    class="fixed inset-0 bg-black/25 flex items-center justify-center z-50"
    @click.self="emit('deny')"
  >
    <div class="bg-bg-card border border-border rounded-2xl w-[480px] overflow-hidden shadow-xl">
      <!-- Header -->
      <div class="flex items-center gap-4 px-6 py-5 border-b border-border">
        <div class="w-10 h-10 rounded-xl bg-[#FFFBEB] flex items-center justify-center shrink-0">
          <ShieldAlert :size="20" class="text-[#F59E0B]" />
        </div>
        <div class="flex flex-col gap-0.5">
          <h3 class="font-heading text-lg font-semibold text-text-primary">Подтверждение действия</h3>
          <p class="text-[13px] text-text-secondary">Агент запрашивает выполнение write-операции</p>
        </div>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 flex flex-col gap-4">
        <div class="bg-bg-subtle border border-border rounded-lg p-4 flex flex-col gap-2">
          <span class="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Инструмент</span>
          <div class="flex items-center gap-2">
            <GitPullRequest :size="16" class="text-[#6366F1]" />
            <span class="font-heading text-[15px] font-semibold text-text-primary">{{ toolName }}</span>
          </div>

          <span class="text-[11px] font-medium text-text-secondary uppercase tracking-wider mt-2">Параметры</span>
          <div class="bg-bg-card border border-border rounded-md p-3">
            <pre class="text-xs font-mono text-text-primary leading-relaxed whitespace-pre-wrap break-all">{{ formattedParams }}</pre>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
        <button
          class="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium font-heading text-text-secondary border border-border rounded-lg hover:bg-bg-subtle transition-colors"
          @click="emit('deny')"
        >
          <X :size="14" />
          Отклонить
        </button>
        <button
          class="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium font-heading bg-[#10B981] text-white rounded-lg hover:opacity-90 transition-opacity"
          @click="emit('approve')"
        >
          <Check :size="14" />
          Подтвердить
        </button>
      </div>
    </div>
  </div>
</template>
