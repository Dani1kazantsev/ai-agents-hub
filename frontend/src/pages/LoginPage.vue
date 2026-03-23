<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Zap, Loader2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const isRegister = ref(false)
const email = ref('')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    if (isRegister.value) {
      await auth.register(email.value, username.value, password.value)
    } else {
      await auth.loginWithCredentials(username.value, password.value)
    }
    if (auth.user && !auth.user.onboarding_completed) {
      router.push('/onboarding')
    } else {
      router.push('/catalog')
    }
  } catch (e: any) {
    error.value = isRegister.value
      ? t('auth.registerError')
      : t('auth.invalidCredentials')
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  isRegister.value = !isRegister.value
  error.value = ''
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
        <p class="text-sm text-text-secondary mt-1">
          {{ isRegister ? $t('auth.registerTitle') : $t('auth.loginTitle') }}
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="bg-bg-main rounded-2xl border border-border p-6 space-y-4">
        <div v-if="isRegister">
          <label class="block text-sm font-medium text-text-primary mb-1.5">{{ $t('auth.email') }}</label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg-input text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-text-primary mb-1.5">
            {{ isRegister ? $t('auth.username') : $t('auth.username') }}
          </label>
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
          <label class="block text-sm font-medium text-text-primary mb-1.5">{{ $t('auth.password') }}</label>
          <input
            v-model="password"
            type="password"
            required
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            class="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg-input text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
            placeholder="password"
          />
        </div>

        <div v-if="error" class="text-sm text-red-500 font-medium">{{ error }}</div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-medium font-heading transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Loader2 v-if="loading" :size="16" class="animate-spin" />
          {{ isRegister ? $t('auth.register') : $t('auth.login') }}
        </button>

        <p class="text-center text-sm text-text-secondary">
          {{ isRegister ? $t('auth.hasAccount') : $t('auth.noAccount') }}
          <button type="button" @click="toggleMode" class="text-brand hover:underline ml-1">
            {{ isRegister ? $t('auth.login') : $t('auth.register') }}
          </button>
        </p>
      </form>
    </div>
  </div>
</template>
