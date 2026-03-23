<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutGrid, MessageSquare, GitBranch, Settings, Zap, LogOut, Sun, Moon, ShieldCheck, Brain, Globe } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isDark = ref(false)

const navItems = computed(() => [
  { label: t('sidebar.catalog'), icon: LayoutGrid, path: '/catalog' },
  { label: t('sidebar.myChats'), icon: MessageSquare, path: '/chats' },
  { label: t('sidebar.pipelines'), icon: GitBranch, path: '/pipelines' },
  { label: t('sidebar.admin'), icon: Settings, path: '/admin' },
])

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function toggleLocale() {
  const newLocale = locale.value === 'ru' ? 'en' : 'ru'
  setLocale(newLocale)
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}

onMounted(() => {
  const saved = localStorage.getItem('theme')
  isDark.value = saved === 'dark'
  document.documentElement.classList.toggle('dark', isDark.value)
})
</script>

<template>
  <aside class="w-[240px] shrink-0 h-screen border-r border-border flex flex-col bg-bg-main">
    <div class="flex items-center gap-2.5 px-5 py-5">
      <div class="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
        <Zap :size="16" class="text-white" />
      </div>
      <span class="font-heading text-lg font-semibold text-text-primary">Agent Hub</span>
    </div>
    <nav class="flex flex-col gap-0.5 px-2 pt-6 flex-1">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
        :class="isActive(item.path)
          ? 'bg-bg-subtle text-text-primary font-medium'
          : 'text-text-secondary font-normal hover:bg-bg-subtle'"
      >
        <component
          :is="item.icon"
          :size="20"
          :class="isActive(item.path) ? 'text-brand' : 'text-text-secondary'"
        />
        <span class="font-heading">{{ item.label }}</span>
      </router-link>
    </nav>

    <!-- Memory link (visible when viewing agent-related pages) -->
    <div v-if="route.path.includes('/agents/') || route.path.includes('/chats/')" class="px-2 mt-2">
      <div class="text-[10px] font-medium text-text-muted uppercase tracking-wider px-3 mb-1">{{ $t('sidebar.tools') }}</div>
      <router-link
        v-if="route.path.match(/\/agents\/([^/]+)\/memory/)"
        :to="route.path"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-bg-subtle text-text-primary font-medium"
      >
        <Brain :size="20" class="text-purple-500" />
        <span class="font-heading">{{ $t('sidebar.memory') }}</span>
      </router-link>
    </div>

    <!-- Bottom actions -->
    <div class="px-2 pb-4 flex flex-col gap-1">
      <router-link
        to="/claude-auth"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
        :class="isActive('/claude-auth')
          ? 'bg-bg-subtle text-text-primary font-medium'
          : 'text-text-secondary font-normal hover:bg-bg-subtle'"
      >
        <ShieldCheck
          :size="20"
          :class="[
            auth.claudeAuthenticated ? 'text-green-500' : 'text-text-secondary',
            isActive('/claude-auth') ? 'text-brand' : '',
          ]"
        />
        <span class="font-heading">{{ $t('sidebar.claudeAccount') }}</span>
        <span v-if="auth.claudeAuthenticated"
              class="ml-auto w-2 h-2 rounded-full bg-green-500" />
      </router-link>
      <button
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-bg-subtle transition-colors w-full"
        @click="toggleTheme"
      >
        <component :is="isDark ? Sun : Moon" :size="20" />
        <span class="font-heading">{{ isDark ? $t('sidebar.lightTheme') : $t('sidebar.darkTheme') }}</span>
      </button>
      <button
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-bg-subtle transition-colors w-full"
        @click="toggleLocale"
      >
        <Globe :size="20" />
        <span class="font-heading">{{ locale === 'ru' ? 'EN' : 'RU' }}</span>
      </button>
      <button
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-bg-subtle transition-colors w-full"
        @click="handleLogout"
      >
        <LogOut :size="20" />
        <span class="font-heading">{{ $t('auth.logout') }}</span>
      </button>
    </div>
  </aside>
</template>
