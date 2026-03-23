<script setup lang="ts">
import { LayoutGrid, Plug, GitBranch, Brain, Zap, ExternalLink } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const features = [
  { icon: LayoutGrid, titleKey: 'landing.feature1Title', textKey: 'landing.feature1Text' },
  { icon: Plug, titleKey: 'landing.feature2Title', textKey: 'landing.feature2Text' },
  { icon: GitBranch, titleKey: 'landing.feature3Title', textKey: 'landing.feature3Text' },
  { icon: Brain, titleKey: 'landing.feature4Title', textKey: 'landing.feature4Text' },
]

const integrations = ['Jira', 'GitLab', 'PostgreSQL', 'Figma', 'Claude']
</script>

<template>
  <div class="min-h-screen bg-bg-subtle">
    <!-- Hero -->
    <header class="pt-16 pb-20 px-6">
      <div class="max-w-[1100px] mx-auto text-center">
        <div class="flex items-center justify-center mb-8">
          <div class="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center">
            <Zap :size="28" class="text-white" />
          </div>
        </div>

        <h1 class="font-heading text-4xl sm:text-5xl font-bold text-text-primary leading-tight max-w-[700px] mx-auto">
          {{ t('landing.hero') }}
        </h1>

        <p class="mt-5 text-lg text-text-secondary max-w-[600px] mx-auto leading-relaxed">
          {{ t('landing.subtitle') }}
        </p>

        <div class="mt-10 flex items-center justify-center gap-4 flex-col sm:flex-row">
          <router-link
            to="/login"
            class="px-8 py-3 rounded-xl bg-brand text-white text-sm font-medium font-heading transition-opacity hover:opacity-90 inline-flex items-center gap-2"
          >
            {{ t('landing.getStarted') }}
          </router-link>
          <a
            href="https://github.com/kodland/ai-agents-hub"
            target="_blank"
            rel="noopener noreferrer"
            class="px-8 py-3 rounded-xl border border-border text-text-primary text-sm font-medium font-heading transition-colors hover:bg-bg-main inline-flex items-center gap-2"
          >
            {{ t('landing.viewGithub') }}
            <ExternalLink :size="14" />
          </a>
        </div>
      </div>
    </header>

    <!-- Features Grid -->
    <section class="py-16 px-6">
      <div class="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div
          v-for="feature in features"
          :key="feature.titleKey"
          class="bg-bg-main border border-border rounded-2xl p-7 transition-shadow hover:shadow-sm"
        >
          <div class="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center mb-4">
            <component :is="feature.icon" :size="22" class="text-brand" />
          </div>
          <h3 class="font-heading text-lg font-semibold text-text-primary mb-2">
            {{ t(feature.titleKey) }}
          </h3>
          <p class="text-sm text-text-secondary leading-relaxed">
            {{ t(feature.textKey) }}
          </p>
        </div>
      </div>
    </section>

    <!-- Integrations Bar -->
    <section class="py-16 px-6">
      <div class="max-w-[1100px] mx-auto text-center">
        <p class="text-sm font-medium text-text-muted uppercase tracking-wider mb-8">
          {{ t('landing.integrationsTitle') }}
        </p>
        <div class="flex items-center justify-center gap-8 sm:gap-12 flex-wrap">
          <span
            v-for="tool in integrations"
            :key="tool"
            class="font-heading text-lg sm:text-xl font-semibold text-text-secondary/60"
          >
            {{ tool }}
          </span>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 px-6 border-t border-border">
      <div class="max-w-[1100px] mx-auto text-center">
        <p class="text-sm text-text-muted">
          {{ t('landing.poweredBy') }}
        </p>
        <a
          href="https://github.com/kodland/ai-agents-hub"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-brand hover:underline mt-2 inline-block"
        >
          GitHub
        </a>
      </div>
    </footer>
  </div>
</template>
