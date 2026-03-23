import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/lib/api'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const claudeAuthenticated = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  function logout() {
    token.value = null
    user.value = null
    claudeAuthenticated.value = false
    localStorage.removeItem('token')
  }

  async function loginWithCredentials(username: string, password: string) {
    const params = new URLSearchParams({ username, password })
    const res = await fetch('/auth-provider/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!res.ok) throw new Error('Login failed')
    const data = await res.json()
    setToken(data.access_token)
    await fetchUser()
  }

  async function fetchUser() {
    try {
      user.value = await api.get<User>('/auth/me')
    } catch {
      logout()
      throw new Error('Failed to fetch user')
    }
  }

  async function checkClaudeAuth() {
    try {
      const result = await api.get<{ authenticated: boolean }>('/claude-auth/status')
      claudeAuthenticated.value = result.authenticated
    } catch {
      claudeAuthenticated.value = false
    }
  }

  async function init() {
    if (token.value) {
      try {
        await fetchUser()
        await checkClaudeAuth()
      } catch {
        // token invalid, already logged out in fetchUser
      }
    }
  }

  return {
    user, token, isAuthenticated, claudeAuthenticated,
    setToken, logout, loginWithCredentials, fetchUser, checkClaudeAuth, init,
  }
})
