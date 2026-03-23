<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutGrid, MessageSquare, GitBranch, Settings, Zap, LogOut, Sun, Moon, ShieldCheck, Brain } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isDark = ref(false)

const navItems = [
  { label: 'Каталог', icon: LayoutGrid, path: '/catalog' },
  { label: 'Мои чаты', icon: MessageSquare, path: '/chats' },
  { label: 'Пайплайны', icon: GitBranch, path: '/pipelines' },
  { label: 'Админка', icon: Settings, path: '/admin' },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
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
      <div class="text-[10px] font-medium text-text-muted uppercase tracking-wider px-3 mb-1">Инструменты</div>
      <router-link
        v-if="route.path.match(/\/agents\/([^/]+)\/memory/)"
        :to="route.path"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-bg-subtle text-text-primary font-medium"
      >
        <Brain :size="20" class="text-purple-500" />
        <span class="font-heading">Память</span>
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
        <span class="font-heading">Claude аккаунт</span>
        <span v-if="auth.claudeAuthenticated"
              class="ml-auto w-2 h-2 rounded-full bg-green-500" />
      </router-link>
      <button
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-bg-subtle transition-colors w-full"
        @click="toggleTheme"
      >
        <component :is="isDark ? Sun : Moon" :size="20" />
        <span class="font-heading">{{ isDark ? 'Светлая тема' : 'Тёмная тема' }}</span>
      </button>
      <button
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-bg-subtle transition-colors w-full"
        @click="handleLogout"
      >
        <LogOut :size="20" />
        <span class="font-heading">Выйти</span>
      </button>
    </div>
  </aside>
</template>
