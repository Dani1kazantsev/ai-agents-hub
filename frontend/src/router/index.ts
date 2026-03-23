import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '@/pages/LoginPage.vue'
import CatalogPage from '@/pages/CatalogPage.vue'
import ChatsPage from '@/pages/ChatsPage.vue'
import ChatPage from '@/pages/ChatPage.vue'
import PipelinesPage from '@/pages/PipelinesPage.vue'
import PipelineEditorPage from '@/pages/PipelineEditorPage.vue'
import PipelineRunPage from '@/pages/PipelineRunPage.vue'
import AdminPage from '@/pages/AdminPage.vue'
import AgentEditorPage from '@/pages/AgentEditorPage.vue'
import ClaudeAuthPage from '@/pages/ClaudeAuthPage.vue'
import OnboardingPage from '@/pages/OnboardingPage.vue'
import MemoryPage from '@/pages/MemoryPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/onboarding', component: OnboardingPage, meta: { onboarding: true } },
    { path: '/', redirect: '/catalog' },
    { path: '/claude-auth', component: ClaudeAuthPage },
    { path: '/catalog', component: CatalogPage },
    { path: '/chats', component: ChatsPage },
    { path: '/chats/:id', component: ChatPage },
    { path: '/pipelines', component: PipelinesPage },
    { path: '/pipelines/new', component: PipelineEditorPage },
    { path: '/pipelines/:id/edit', component: PipelineEditorPage },
    { path: '/pipelines/run/:id', component: PipelineRunPage },
    { path: '/admin', component: AdminPage },
    { path: '/admin/agents/new', component: AgentEditorPage },
    { path: '/admin/agents/:id', component: AgentEditorPage },
    { path: '/agents/:id/memory', component: MemoryPage },
  ],
})

export default router
