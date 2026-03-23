<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Zap, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.loginWithCredentials(username.value, password.value)
    if (auth.user && !auth.user.onboarding_completed) {
      router.push('/onboarding')
    } else {
      router.push('/catalog')
    }
  } catch (e: any) {
    error.value = 'Неверный логин или пароль'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-bg-subtle">
    <div class="w-full max-w-[400px] px-6">
      <div class="flex flex-col items-center mb-8">
        <div class="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mb-4">
          <Zap :size="24" class="text-white" />
        </div>
        <h1 class="font-heading text-2xl font-semibold text-text-primary">Agent Hub</h1>
        <p class="text-sm text-text-secondary mt-1">Войдите в свой аккаунт</p>
      </div>

      <form @submit.prevent="handleSubmit" class="bg-bg-main rounded-2xl border border-border p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-text-primary mb-1.5">Логин</label>
          <input
            v-model="username"
            type="text"
            required
            autocomplete="username"
            class="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg-input text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
            placeholder="username"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1.5">Пароль</label>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg-input text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
            placeholder="password"
          />
        </div>

        <div v-if="error" class="text-sm text-brand font-medium">{{ error }}</div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-medium font-heading transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Loader2 v-if="loading" :size="16" class="animate-spin" />
          Войти
        </button>
      </form>
    </div>
  </div>
</template>
