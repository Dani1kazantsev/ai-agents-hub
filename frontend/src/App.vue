<script setup lang="ts">
import { useRoute } from 'vue-router'
import Sidebar from '@/components/Sidebar.vue'
import ToastContainer from '@/components/ToastContainer.vue'

const route = useRoute()
</script>

<template>
  <div v-if="route.path === '/login' || route.path === '/onboarding'" class="h-screen w-screen">
    <router-view />
  </div>
  <div v-else class="flex h-screen w-screen overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
  <ToastContainer />
</template>
