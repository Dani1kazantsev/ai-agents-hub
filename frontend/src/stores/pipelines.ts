import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { api } from '@/lib/api'

export interface StepDesc {
  agent: string
  label: string
  description: string
}

export interface PipelineTemplate {
  id: string
  title: string
  description: string
  human_loop: boolean
  agents: string[]
  steps: StepDesc[]
}

export interface StepResult {
  step: number
  agent: string
  output: string
  status: 'pending' | 'running' | 'done' | 'error'
  streamContent: string
}

export interface PipelineRun {
  runId: string
  templateId: string
  status: 'idle' | 'running' | 'completed' | 'error'
  steps: StepResult[]
  ws: WebSocket | null
  pollTimer: ReturnType<typeof setInterval> | null
}

export const usePipelinesStore = defineStore('pipelines', () => {
  const templates = ref<PipelineTemplate[]>([])
  const runs = reactive<Record<string, PipelineRun>>({})
  const loading = ref(false)

  async function fetchTemplates() {
    loading.value = true
    try {
      templates.value = await api.get<PipelineTemplate[]>('/pipelines/templates')
    } catch {
      // ignore
    } finally {
      loading.value = false
    }
  }

  function startAutoRun(templateId: string, runId: string) {
    const template = templates.value.find(t => t.id === templateId)
    if (!template) return

    runs[templateId] = {
      runId,
      templateId,
      status: 'running',
      steps: template.steps.map((s, i) => ({
        step: i,
        agent: s.label,
        output: '',
        status: 'pending',
        streamContent: '',
      })),
      ws: null,
      pollTimer: null,
    }

    connectWs(templateId, runId)
  }

  function connectWs(templateId: string, runId: string) {
    const run = runs[templateId]
    if (!run) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = localStorage.getItem('token')
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/pipelines/ws/${runId}?token=${token}`)

    run.ws = ws

    ws.onopen = () => ws.send(JSON.stringify({ type: 'start' }))

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'step_start') {
        const step = run.steps[data.step]
        if (step) {
          step.status = 'running'
          step.agent = data.agent_name || step.agent
        }
      } else if (data.type === 'step_stream') {
        const step = run.steps[data.step]
        if (step) step.streamContent += data.content
      } else if (data.type === 'step_done') {
        const step = run.steps[data.step]
        if (step) {
          step.status = 'done'
          step.output = step.streamContent || data.output_preview
        }
      } else if (data.type === 'step_error') {
        const step = run.steps[data.step]
        if (step) {
          step.status = 'error'
          step.output = data.content
        }
      } else if (data.type === 'pipeline_done') {
        run.status = 'completed'
        stopPolling(templateId)
      } else if (data.type === 'pipeline_cancelled') {
        run.status = 'error'
        stopPolling(templateId)
      } else if (data.type === 'error') {
        run.status = 'error'
        stopPolling(templateId)
      }
    }

    ws.onclose = () => {
      run.ws = null
      // Don't mark as error — pipeline may still be running on backend
      // Start polling to track progress
      if (run.status === 'running') {
        startPolling(templateId)
      }
    }
  }

  function startPolling(templateId: string) {
    const run = runs[templateId]
    if (!run || run.pollTimer) return

    run.pollTimer = setInterval(async () => {
      try {
        const data = await api.get<any>(`/pipelines/runs/${run.runId}`)
        // Update steps from server state
        if (data.results && Array.isArray(data.results)) {
          for (const r of data.results) {
            const step = run.steps[r.step]
            if (step && step.status !== 'done') {
              step.status = r.status || 'done'
              step.output = r.output || ''
              step.streamContent = r.output || ''
              step.agent = r.agent || step.agent
            }
          }
        }
        // Mark current running step
        if (data.status === 'running' && data.current_step > 0) {
          const currentIdx = data.current_step - 1
          const step = run.steps[currentIdx]
          if (step && step.status === 'pending') {
            step.status = 'running'
          }
        }
        // Terminal states
        if (data.status === 'completed') {
          run.status = 'completed'
          stopPolling(templateId)
        } else if (data.status === 'error' || data.status === 'cancelled') {
          run.status = 'error'
          stopPolling(templateId)
        }
      } catch {
        // Run not found — it was cleaned up
        run.status = 'error'
        stopPolling(templateId)
      }
    }, 3000)
  }

  function stopPolling(templateId: string) {
    const run = runs[templateId]
    if (!run?.pollTimer) return
    clearInterval(run.pollTimer)
    run.pollTimer = null
  }

  /** Sync run state from server (called when returning to the page) */
  async function syncActiveRuns() {
    try {
      const serverRuns = await api.get<any[]>('/pipelines/runs')
      for (const sr of serverRuns) {
        // Find which template this run belongs to
        const templateId = sr.template_id
        const existingRun = runs[templateId]

        if (existingRun && existingRun.runId === sr.id) {
          // Already tracking — just update if no WS
          if (!existingRun.ws && existingRun.status === 'running') {
            startPolling(templateId)
          }
          continue
        }

        if (sr.status === 'running' || sr.status === 'pending') {
          // Server has an active run we're not tracking — restore it
          const template = templates.value.find(t => t.id === templateId)
          if (!template) continue

          runs[templateId] = {
            runId: sr.id,
            templateId,
            status: 'running',
            steps: template.steps.map((s, i) => {
              const serverResult = sr.results?.find((r: any) => r.step === i)
              return {
                step: i,
                agent: serverResult?.agent || s.label,
                output: serverResult?.output || '',
                status: serverResult ? (serverResult.status || 'done') : (i < sr.current_step - 1 ? 'done' : i === sr.current_step - 1 ? 'running' : 'pending'),
                streamContent: serverResult?.output || '',
              }
            }),
            ws: null,
            pollTimer: null,
          }
          startPolling(templateId)
        } else if (sr.status === 'completed' || sr.status === 'error' || sr.status === 'cancelled') {
          // Finished run — show results
          const template = templates.value.find(t => t.id === templateId)
          if (!template) continue

          runs[templateId] = {
            runId: sr.id,
            templateId,
            status: sr.status === 'completed' ? 'completed' : 'error',
            steps: template.steps.map((s, i) => {
              const serverResult = sr.results?.find((r: any) => r.step === i)
              return {
                step: i,
                agent: serverResult?.agent || s.label,
                output: serverResult?.output || '',
                status: serverResult?.status || (serverResult ? 'done' : 'error'),
                streamContent: serverResult?.output || '',
              }
            }),
            ws: null,
            pollTimer: null,
          }
        }
      }
    } catch {
      // ignore
    }
  }

  function getRunStatus(templateId: string): string | null {
    const run = runs[templateId]
    if (!run) return null
    if (run.status === 'completed') return 'completed'
    if (run.status === 'error') return 'error'
    const currentStep = run.steps.find(s => s.status === 'running')
    if (currentStep) {
      const idx = run.steps.indexOf(currentStep)
      return `Шаг ${idx + 1}/${run.steps.length}`
    }
    return null
  }

  async function cancelRun(templateId: string) {
    const run = runs[templateId]
    if (!run) return
    await api.post(`/pipelines/runs/${run.runId}/cancel`, {})
    run.ws?.close()
    run.ws = null
    stopPolling(templateId)
    run.status = 'error'
    for (const step of run.steps) {
      if (step.status === 'running' || step.status === 'pending') {
        step.status = 'error'
      }
    }
  }

  async function clearRun(templateId: string) {
    const run = runs[templateId]
    if (!run) return
    run.ws?.close()
    stopPolling(templateId)
    try { await api.delete(`/pipelines/runs/${run.runId}`) } catch { /* ignore */ }
    delete runs[templateId]
  }

  async function deleteTemplate(templateId: string) {
    await api.delete(`/pipelines/templates/${templateId}`)
    templates.value = templates.value.filter(t => t.id !== templateId)
    if (runs[templateId]) {
      runs[templateId].ws?.close()
      stopPolling(templateId)
      delete runs[templateId]
    }
  }

  const catalog = ref<(PipelineTemplate & { in_workspace?: boolean })[]>([])
  const catalogLoading = ref(false)

  async function fetchCatalog() {
    catalogLoading.value = true
    try {
      catalog.value = await api.get<(PipelineTemplate & { in_workspace?: boolean })[]>('/pipelines/templates?all=true')
    } catch {
      // ignore
    } finally {
      catalogLoading.value = false
    }
  }

  async function addToWorkspace(templateId: string) {
    await api.post(`/pipelines/templates/${templateId}/add`, {})
    // Refresh
    const tpl = catalog.value.find(t => t.id === templateId)
    if (tpl) {
      tpl.in_workspace = true
      if (!templates.value.find(t => t.id === templateId)) {
        templates.value.push(tpl)
      }
    }
  }

  async function removeFromWorkspace(templateId: string) {
    await api.delete(`/pipelines/templates/${templateId}/remove`)
    templates.value = templates.value.filter(t => t.id !== templateId)
    const tpl = catalog.value.find(t => t.id === templateId)
    if (tpl) tpl.in_workspace = false
  }

  return {
    templates,
    runs,
    loading,
    catalog,
    catalogLoading,
    fetchTemplates,
    fetchCatalog,
    addToWorkspace,
    removeFromWorkspace,
    startAutoRun,
    syncActiveRuns,
    getRunStatus,
    cancelRun,
    clearRun,
    deleteTemplate,
  }
})
