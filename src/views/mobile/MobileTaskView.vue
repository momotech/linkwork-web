<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Copy, ExternalLink, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const error = ref('')
const task = ref<any>(null)

const taskId = computed(() => String(route.params.taskId || '').trim())
const shareToken = computed(() => String(route.query.token || '').trim())
const isShareGuest = computed(() => Boolean(shareToken.value))

const statusMeta = computed(() => {
  const status = String(task.value?.status || '').toLowerCase()
  if (status === 'completed') return { icon: '✅', text: '完成', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' }
  if (status === 'failed') return { icon: '❌', text: '失败', cls: 'bg-red-500/10 text-red-600 border-red-500/20' }
  if (status === 'aborted') return { icon: '⛔', text: '终止', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' }
  if (status === 'running') return { icon: '🏃', text: '执行中', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' }
  return { icon: '⏳', text: '等待执行', cls: 'bg-zinc-500/10 text-zinc-700 border-zinc-500/20' }
})

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const tokensText = computed(() => {
  const usageTokens = toFiniteNumber(task.value?.usage?.tokensUsed ?? task.value?.usage?.tokens_used)
  const reportTokens = toFiniteNumber(task.value?.report?.tokens)
  const value = usageTokens === 0 && reportTokens !== undefined && reportTokens > 0
    ? reportTokens
    : (usageTokens ?? reportTokens)
  if (value === undefined) return '-'
  return value.toLocaleString()
})

const durationText = computed(() => {
  const usageDuration = String(task.value?.usage?.duration || '').trim()
  const reportDuration = String(task.value?.report?.duration || '').trim()
  if (usageDuration && usageDuration !== '0s') return usageDuration
  if (reportDuration && reportDuration !== '0s') return reportDuration
  return usageDuration || reportDuration || '-'
})

const outputAttrs = computed(() => {
  const raw: string[] = []
  const estimated = task.value?.estimatedOutput
  if (Array.isArray(estimated)) {
    raw.push(...estimated)
  } else if (Array.isArray(task.value?.report?.artifacts)) {
    for (const artifact of task.value.report.artifacts) {
      const name = String(artifact?.name || '').toLowerCase()
      if (!name) continue
      if (name.includes('git') || name.includes('pull-request')) raw.push('git')
      else if (name.includes('.pdf')) raw.push('pdf')
      else if (name.includes('.docx')) raw.push('word')
      else if (name.includes('.xlsx')) raw.push('excel')
      else if (name.includes('.ppt')) raw.push('ppt')
      else if (name.includes('.md')) raw.push('markdown')
      else if (name.includes('.json')) raw.push('json')
      else if (name.includes('.csv')) raw.push('csv')
    }
  }

  const mapped = raw.map((item) => {
    const value = String(item).toLowerCase()
    if (value === 'git_branch' || value === 'pull_request') return 'git'
    if (value.endsWith('_file')) return value.slice(0, -5)
    return value
  }).filter(Boolean)

  return Array.from(new Set(mapped))
})

const isCronText = computed(() => {
  return String(task.value?.source || '').toUpperCase() === 'CRON' ? '是' : '否'
})

const fetchTask = async () => {
  if (!taskId.value) {
    error.value = '任务ID为空'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const detailUrl = isShareGuest.value
      ? `/api/v1/public/tasks/${encodeURIComponent(taskId.value)}/share-detail?token=${encodeURIComponent(shareToken.value)}`
      : `/api/v1/tasks/${encodeURIComponent(taskId.value)}`
    const res = await fetch(detailUrl, isShareGuest.value ? {} : { credentials: 'include' })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const result = await res.json()
    if (result.code !== 0 || !result.data) {
      throw new Error(result.msg || '获取任务详情失败')
    }
    task.value = result.data
  } catch (err: any) {
    error.value = err?.message || '获取任务详情失败'
  } finally {
    loading.value = false
  }
}

const copyTaskId = async () => {
  if (!taskId.value) return
  try {
    await navigator.clipboard.writeText(taskId.value)
    toast.success('任务ID已复制')
  } catch {
    toast.error('复制失败')
  }
}

const goWebDetail = () => {
  if (isShareGuest.value) return
  router.push({ name: 'fleet', query: { missionId: taskId.value } })
}

const goBackHome = () => {
  if (isShareGuest.value) {
    if (window.history.length > 1) {
      router.back()
      return
    }
  }
  router.push({ name: 'home' })
}

watch(() => [route.params.taskId, route.query.token], fetchTask)
onMounted(fetchTask)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-5">
    <div class="mx-auto w-full max-w-md space-y-4">
      <div class="flex items-center justify-between">
        <Button variant="ghost" size="sm" class="h-8 px-2" @click="goBackHome">
          <ArrowLeft class="h-4 w-4 mr-1" /> 返回
        </Button>
        <Button variant="outline" size="sm" class="h-8 px-2" @click="copyTaskId">
          <Copy class="h-3.5 w-3.5 mr-1" /> 复制ID
        </Button>
      </div>

      <Card class="border-zinc-200/80 shadow-sm">
        <CardHeader class="space-y-3 pb-3">
          <div class="flex items-center justify-between gap-3">
            <CardTitle class="text-base leading-6">任务执行结果</CardTitle>
            <Badge :class="statusMeta.cls" class="border">
              {{ statusMeta.icon }} {{ statusMeta.text }}
            </Badge>
          </div>
          <p v-if="isShareGuest" class="text-xs text-amber-600">访客模式：仅可查看当前任务</p>
          <p class="text-sm text-zinc-700 break-all">{{ task?.prompt || '未命名任务' }}</p>
          <p class="text-xs text-zinc-500 font-mono break-all">{{ taskId }}</p>
        </CardHeader>
        <CardContent class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p class="text-[11px] text-zinc-500">消耗 Tokens</p>
              <p class="text-sm font-semibold text-zinc-900">{{ tokensText }}</p>
            </div>
            <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p class="text-[11px] text-zinc-500">执行总时长</p>
              <p class="text-sm font-semibold text-zinc-900">{{ durationText }}</p>
            </div>
          </div>

          <div class="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p class="text-[11px] text-zinc-500 mb-1">任务产出属性</p>
            <p class="text-sm text-zinc-900">
              <template v-if="outputAttrs.length">
                {{ outputAttrs.join('、') }}
              </template>
              <template v-else>-</template>
            </p>
          </div>

          <div class="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p class="text-[11px] text-zinc-500 mb-1">是否定时任务</p>
            <p class="text-sm text-zinc-900">{{ isCronText }}</p>
          </div>

          <Button v-if="!isShareGuest" class="w-full h-10" @click="goWebDetail">
            <ExternalLink class="h-4 w-4 mr-1.5" /> 打开 Web 详情
          </Button>
        </CardContent>
      </Card>

      <div v-if="loading" class="flex items-center justify-center gap-2 py-6 text-zinc-500">
        <Loader2 class="h-4 w-4 animate-spin" /> 加载中...
      </div>
      <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
        {{ error }}
      </div>
    </div>
  </div>
</template>
