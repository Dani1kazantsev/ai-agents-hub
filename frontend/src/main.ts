import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import i18n from '@/i18n'
import App from '@/App.vue'
import { useAuthStore } from '@/stores/auth'
import '@/style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)
app.use(router)

const auth = useAuthStore()

router.beforeEach(async (to) => {
  // Try to restore session from cached token
  if (!auth.user && auth.token) {
    await auth.init()
  }

  // Public pages (landing, login) — always accessible
  if (to.meta.public || to.meta.onboarding) {
    // Authenticated user on landing → catalog
    if (to.path === '/' && auth.isAuthenticated) {
      return '/catalog'
    }
    // Authenticated user on login → catalog or onboarding
    if (to.path === '/login' && auth.isAuthenticated) {
      return auth.user && !auth.user.onboarding_completed ? '/onboarding' : '/catalog'
    }
    return
  }

  // Protected pages — require auth
  if (!auth.isAuthenticated) {
    return '/login'
  }

  // Onboarding guard
  if (auth.user && !auth.user.onboarding_completed && to.path !== '/claude-auth') {
    return '/onboarding'
  }
})

app.mount('#app')
