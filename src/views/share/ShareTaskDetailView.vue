<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import MissionDrawer from '@/components/business/MissionDrawer.vue'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-vue-next'
import { useMission, type MissionProfile } from '@/composables/useMission'

interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

const route = useRoute()
const router = useRouter()
const { loadMission, closeDrawer } = useMission()

const loading = ref(false)
const error = ref('')
const ready = ref(false)

const taskId = computed(() => String(route.params.taskId || '').trim())
const shareToken = computed(() => String(route.query.token || '').trim())

const mapTaskStatus = (status: unknown): MissionProfile['status'] => {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'RUNNING') return 'running'
  if (normalized === 'COMPLETED') return 'completed'
  if (normalized === 'FAILED') return 'failed'
  if (normalized === 'ABORTED' || normalized === 'CANCELLED') return 'aborted'
  return 'pending'
}

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const resolveTokensUsed = (data: any): number => {
  const usageTokens = toNumber(data?.usage?.tokensUsed ?? data?.usage?.tokens_used, Number.NaN)
  const reportTokens = toNumber(data?.report?.tokens, Number.NaN)

  if (Number.isFinite(usageTokens)) {
    if (usageTokens === 0 && Number.isFinite(reportTokens) && reportTokens > 0) {
      return reportTokens
    }
    return usageTokens
  }
  if (Number.isFinite(reportTokens)) return reportTokens
  return 0
}

const resolveDuration = (data: any): string => {
  const usageDuration = String(data?.usage?.duration || '').trim()
  const reportDuration = String(data?.report?.duration || '').trim()
  if (usageDuration && usageDuration !== '0s') return usageDuration
  if (reportDuration && reportDuration !== '0s') return reportDuration
  return usageDuration || reportDuration || '0s'
}

const mapSharedTask = (data: any): MissionProfile => {
  const taskNo = String(data?.taskNo || taskId.value || '').trim()
  return {
    id: taskNo,
    prompt: data?.prompt || '',
    image: data?.image || '',
    roleId: data?.roleId,
    roleName: data?.roleName || '',
    selectedModel: data?.selectedModel || '',
    runtimeMode: data?.runtimeMode,
    zzMode: data?.zzMode,
    runnerImage: data?.runnerImage,
    repo: data?.repo || '',
    branch: data?.branch || data?.branchName || '',
    mcp: Array.isArray(data?.mcp) ? data.mcp : [],
    skills: Array.isArray(data?.skills) ? data.skills : [],
    knowledge: Array.isArray(data?.knowledge) ? data.knowledge : [],
    env: data?.env && typeof data.env === 'object' ? data.env : undefined,
    estimatedOutput: Array.isArray(data?.estimatedOutput) ? data.estimatedOutput : [],
    status: mapTaskStatus(data?.status),
    creator: data?.creator || '分享访客',
    createdAt: data?.createdAt || '',
    usage: {
      tokens_used: resolveTokensUsed(data),
      tokens_limit: toNumber(data?.usage?.tokenLimit ?? data?.usage?.tokens_limit, 100000),
      input_tokens: toNumber(data?.usage?.inputTokens ?? data?.usage?.input_tokens),
      output_tokens: toNumber(data?.usage?.outputTokens ?? data?.usage?.output_tokens),
      request_count: toNumber(data?.usage?.requestCount ?? data?.usage?.request_count),
      usage_percent: toNumber(data?.usage?.usagePercent ?? data?.usage?.usage_percent),
      duration: resolveDuration(data)
    },
    report: data?.report ? {
      summary: data.report.summary || '',
      tokens: toNumber(data.report.tokens),
      duration: data.report.duration || '',
      completion: toNumber(data.report.completion),
      audit: data.report.audit || '',
      artifacts: Array.isArray(data.report.artifacts)
        ? data.report.artifacts.map((artifact: any) => ({
          name: artifact?.name || '-',
          url: artifact?.url || ''
        }))
        : [],
      branch: data.report.branch || '',
      commit: data.report.commit || ''
    } : undefined
  }
}

const bootstrapMission = async () => {
  ready.value = false
  error.value = ''

  if (!taskId.value) {
    error.value = '任务 ID 为空'
    closeDrawer({ disconnect: true })
    return
  }
  if (!shareToken.value) {
    error.value = '分享链接无效：缺少 token'
    closeDrawer({ disconnect: true })
    return
  }

  loading.value = true
  closeDrawer({ disconnect: true })

  try {
    const url = `/api/v1/public/tasks/${encodeURIComponent(taskId.value)}/share-detail?token=${encodeURIComponent(shareToken.value)}`
    const res = await fetch(url)
    const result: ApiResponse<any> = await res.json()
    if (!res.ok || result.code !== 0 || !result.data) {
      throw new Error(result.msg || `HTTP ${res.status}`)
    }

    await loadMission(mapSharedTask(result.data))
    ready.value = true
  } catch (err: any) {
    error.value = err?.message || '加载任务分享详情失败'
    closeDrawer({ disconnect: true })
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  closeDrawer({ disconnect: true })
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.replace('/')
}

watch(() => [route.params.taskId, route.query.token], () => {
  void bootstrapMission()
}, { immediate: true })

onBeforeUnmount(() => {
  closeDrawer({ disconnect: true })
})
</script>

<template>
  <div class="h-screen bg-background text-foreground">
    <Toaster position="top-center" rich-colors />

    <div v-if="loading" class="h-full flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 class="h-4 w-4 animate-spin" />
      正在加载任务分享详情...
    </div>

    <div v-else-if="error" class="h-full flex items-center justify-center px-4">
      <div class="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-5 space-y-4 text-center">
        <div class="flex items-center justify-center gap-2 text-red-600">
          <AlertCircle class="h-4 w-4" />
          <span class="text-sm font-medium">分享链接不可用</span>
        </div>
        <p class="text-sm text-red-700 break-all">{{ error }}</p>
        <Button variant="outline" class="mx-auto" @click="handleBack">
          <ArrowLeft class="h-4 w-4 mr-1.5" />
          返回
        </Button>
      </div>
    </div>

    <div v-else-if="ready" class="h-full">
      <MissionDrawer is-shared-view @close="handleBack" />
    </div>
  </div>
</template>
