import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from '@/App.vue'
import { useAuthStore } from '@/stores/auth'
import '@/style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const auth = useAuthStore()

router.beforeEach(async (to) => {
  if (!auth.user && auth.token) {
    await auth.init()
  }
  if (!to.meta.public && !to.meta.onboarding && !auth.isAuthenticated) {
    return '/login'
  }
  if (to.path === '/login' && auth.isAuthenticated) {
    // Redirect to onboarding if not completed
    if (auth.user && !auth.user.onboarding_completed) {
      return '/onboarding'
    }
    return '/catalog'
  }
  // Redirect to onboarding for authenticated users who haven't completed it
  if (auth.isAuthenticated && auth.user && !auth.user.onboarding_completed
      && !to.meta.public && !to.meta.onboarding && to.path !== '/claude-auth') {
    return '/onboarding'
  }
})

app.mount('#app')
