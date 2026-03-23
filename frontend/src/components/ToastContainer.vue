<script setup lang="ts">
import { CheckCircle, XCircle } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 translate-x-8"
        leave-to-class="opacity-0 translate-x-8"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[280px] max-w-[400px]"
          :class="toast.type === 'error'
            ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
            : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'"
        >
          <CheckCircle v-if="toast.type === 'success'" :size="18" />
          <XCircle v-else :size="18" />
          <span class="text-sm font-medium">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
