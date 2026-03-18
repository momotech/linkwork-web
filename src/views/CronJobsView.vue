<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { cronJobsApi, type CronJobItem, type CronJobPayload, type CronJobRunItem, type CronScheduleType } from '@/api/cronJobs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import ModelProviderIcon from '@/components/business/ModelProviderIcon.vue'
import {
  AlarmClock, Bot, Brain, CheckCircle2, Clock, Code, Cog, Globe, XCircle, Search, RefreshCw, Loader2, Play, Pause, Pencil,
  Server, ShieldCheck, Terminal, Trash2, History, TriangleAlert, Sparkles, CalendarClock, TimerReset, MoreHorizontal
} from 'lucide-vue-next'

interface RoleOption {
  id: number
  name: string
  icon?: string
  category?: string
  status?: string
}

const roleIconMap: Record<string, any> = {
  server: Server, shield: ShieldCheck, code: Code, globe: Globe,
  terminal: Terminal, bot: Bot, brain: Brain, cog: Cog,
}
const getRoleIcon = (iconId?: string) => roleIconMap[iconId || ''] || Server

interface ModelOption {
  id: string
  label: string
  brand: string
}

const fallbackModels: ModelOption[] = [
  { id: 'claude-opus-4', label: 'claude-opus-4', brand: 'claude' },
  { id: 'gpt-5', label: 'gpt-5', brand: 'openai' },
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', brand: 'google' },
  { id: 'deepseek-v3', label: 'deepseek-v3', brand: 'deepseek' },
  { id: 'kimi-k2-5-thinking', label: 'kimi-k2-5-thinking', brand: 'kimi' },
]

const modelRegistryApi = import.meta.env.VITE_MODEL_REGISTRY_URL || '/api/v1/models'

const inferModelBrand = (modelId: string): string => {
  const normalized = modelId.toLowerCase()
  if (normalized.includes('claude')) return 'claude'
  if (normalized.includes('gpt') || normalized.includes('openai') || normalized.includes('chatgpt') || /^o[134]/.test(normalized)) return 'openai'
  if (normalized.includes('deepseek')) return 'deepseek'
  if (normalized.includes('gemini') || normalized.includes('google')) return 'google'
  if (normalized.includes('kimi') || normalized.includes('moonshot')) return 'kimi'
  return 'custom'
}

const scheduleTypeMeta: Array<{ value: CronScheduleType; title: string; desc: string }> = [
  { value: 'cron', title: 'Cron 表达式', desc: '适合固定时间点/复杂周期' },
  { value: 'every', title: '固定间隔', desc: '按分钟/小时/天周期执行' },
  { value: 'at', title: '一次执行', desc: '在指定时间仅执行一次' },
]

const cronPresets: Array<{ label: string; expr: string; hint: string }> = [
  { label: '每30分钟', expr: '0 */30 * * * ?', hint: '每小时的 00/30 分触发' },
  { label: '每天09:00', expr: '0 0 9 * * ?', hint: '每日上午 09:00' },
  { label: '工作日09:30', expr: '0 30 9 ? * MON-FRI', hint: '周一到周五上午 09:30' },
]

const modelOptions = ref<ModelOption[]>(fallbackModels)

const jobs = ref<CronJobItem[]>([])
const roles = ref<RoleOption[]>([])
const loading = ref(false)
const submitting = ref(false)

const statusFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const scheduleFilter = ref<'all' | CronScheduleType>('all')
const roleFilter = ref('all')
const searchQuery = ref('')

const showJobDialog = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingJobId = ref<number | null>(null)

const showRunsDialog = ref(false)
const runsLoading = ref(false)
const runRows = ref<CronJobRunItem[]>([])
const selectedJob = ref<CronJobItem | null>(null)

const actionLoadingMap = reactive<Record<string, boolean>>({})
const previewLoading = ref(false)
const previewTimes = ref<string[]>([])
const previewError = ref('')
let previewTimer: number | null = null

const form = reactive({
  jobName: '',
  roleId: '',
  modelId: fallbackModels[0].id,
  scheduleType: 'cron' as CronScheduleType,
  cronExpr: '0 */30 * * * ?',
  everyValue: 30,
  everyUnit: 'minute' as 'minute' | 'hour' | 'day',
  intervalMs: 1800000,
  runAt: '',
  taskContent: '',
})

const stats = computed(() => {
  const enabled = jobs.value.filter((item) => item.enabled).length
  const success = jobs.value.filter((item) => item.lastRunStatus === 'COMPLETED').length
  const failed = jobs.value.filter((item) => item.lastRunStatus === 'FAILED' || item.lastRunStatus === 'ABORTED').length
  return {
    enabled,
    success,
    failed,
    total: jobs.value.length,
  }
})

const filteredJobs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return jobs.value.filter((item) => {
    if (statusFilter.value === 'enabled' && !item.enabled) return false
    if (statusFilter.value === 'disabled' && item.enabled) return false
    if (scheduleFilter.value !== 'all' && item.scheduleType !== scheduleFilter.value) return false
    if (roleFilter.value !== 'all' && String(item.roleId) !== roleFilter.value) return false
    if (!query) return true
    return [
      String(item.id),
      item.jobName || '',
      item.roleName || '',
      item.cronExpr || '',
      item.taskContent || '',
    ].some((value) => value.toLowerCase().includes(query))
  })
})

const canSubmit = computed(() => {
  return !!(form.jobName.trim() && form.roleId && form.modelId.trim() && form.taskContent.trim())
})

const displayModelOptions = computed<ModelOption[]>(() => {
  const current = form.modelId.trim()
  if (!current || modelOptions.value.some((item) => item.id === current)) {
    return modelOptions.value
  }
  return [{ id: current, label: `${current}（自定义）`, brand: 'custom' }, ...modelOptions.value]
})

const selectedModelBrand = computed(() => {
  const selectedId = form.modelId.trim()
  return displayModelOptions.value.find((item) => item.id === selectedId)?.brand || 'custom'
})

const formatEveryRule = (intervalMs?: number) => {
  if (!intervalMs || intervalMs < 60000) return '-'
  if (intervalMs % 86400000 === 0) return `每 ${intervalMs / 86400000} 天`
  if (intervalMs % 3600000 === 0) return `每 ${intervalMs / 3600000} 小时`
  if (intervalMs % 60000 === 0) return `每 ${intervalMs / 60000} 分钟`
  return `每 ${intervalMs} 毫秒`
}

const formatCronRule = (cronExpr?: string) => {
  const expr = cronExpr?.trim()
  if (!expr) return '-'
  if (expr === '0 */30 * * * ?') return '每 30 分钟'
  if (expr === '0 0 9 * * ?') return '每天 09:00'
  if (expr === '0 30 9 ? * MON-FRI') return '工作日 09:30'
  return '自定义 Cron 规则'
}

const getRuleText = (item: CronJobItem) => {
  if (item.scheduleType === 'cron') return formatCronRule(item.cronExpr)
  if (item.scheduleType === 'every') return formatEveryRule(item.intervalMs)
  if (!item.runAt) return '-'
  return `一次性 ${formatTime(item.runAt)}`
}

const getRuleSubText = (item: CronJobItem) => {
  if (item.scheduleType === 'cron') return item.cronExpr || '-'
  if (item.scheduleType === 'every') return item.intervalMs != null ? `intervalMs=${item.intervalMs}` : '-'
  return item.runAt || '-'
}

const formatTime = (value?: string): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getRunStatusClass = (status?: string) => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    case 'FAILED':
      return 'bg-red-500/10 text-red-600 border-red-500/20'
    case 'RUNNING':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
    case 'ABORTED':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

const deriveEveryForm = (intervalMs?: number) => {
  const fallback = { everyValue: 30, everyUnit: 'minute' as const, intervalMs: 1800000 }
  if (!intervalMs || intervalMs < 60000) return fallback
  if (intervalMs % 86400000 === 0) {
    return { everyValue: intervalMs / 86400000, everyUnit: 'day' as const, intervalMs }
  }
  if (intervalMs % 3600000 === 0) {
    return { everyValue: intervalMs / 3600000, everyUnit: 'hour' as const, intervalMs }
  }
  if (intervalMs % 60000 === 0) {
    return { everyValue: intervalMs / 60000, everyUnit: 'minute' as const, intervalMs }
  }
  return { everyValue: Math.max(1, Math.round(intervalMs / 60000)), everyUnit: 'minute' as const, intervalMs }
}

const calcIntervalMs = () => {
  const value = Number(form.everyValue || 0)
  const safeValue = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1
  const factor = form.everyUnit === 'day' ? 86400000 : form.everyUnit === 'hour' ? 3600000 : 60000
  return safeValue * factor
}

const syncIntervalMs = () => {
  form.intervalMs = calcIntervalMs()
  return form.intervalMs
}

const normalizeRunAt = (value: string) => {
  const raw = value.trim()
  if (!raw) return ''
  return raw.length === 16 ? `${raw}:00` : raw
}

const setCronPreset = (expr: string) => {
  form.scheduleType = 'cron'
  form.cronExpr = expr
}

const setRunAtOffsetHours = (hours: number) => {
  const date = new Date(Date.now() + hours * 3600000)
  const pad = (num: number) => String(num).padStart(2, '0')
  form.runAt = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  form.scheduleType = 'at'
}

const toDatetimeLocal = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    const pad = (num: number) => String(num).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return value.length >= 16 ? value.slice(0, 16) : value
}

const formatPreviewTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

const validateForm = () => {
  if (!canSubmit.value) return '请填写完整的任务信息'
  if (roles.value.length === 0) return '无可用岗位，请先创建或启用岗位'
  if (form.taskContent.trim().length > 10000) return '任务指令长度不能超过10000字符'
  if (form.scheduleType === 'cron' && !form.cronExpr.trim()) return '请填写 Cron 表达式'
  if (form.scheduleType === 'every') {
    const intervalMs = calcIntervalMs()
    if (intervalMs < 60000) return '间隔最小为 1 分钟'
  }
  if (form.scheduleType === 'at') {
    const runAt = normalizeRunAt(form.runAt)
    if (!runAt) return '请填写执行时间'
    if (new Date(runAt).getTime() <= Date.now()) return '执行时间必须晚于当前时间'
  }
  return ''
}

const refreshPreview = async () => {
  previewError.value = ''
  previewTimes.value = []
  if (form.scheduleType === 'cron' && !form.cronExpr.trim()) return
  if (form.scheduleType === 'every' && calcIntervalMs() < 60000) return
  if (form.scheduleType === 'at' && !form.runAt.trim()) return
  previewLoading.value = true
  try {
    previewTimes.value = await cronJobsApi.preview({
      scheduleType: form.scheduleType,
      cronExpr: form.scheduleType === 'cron' ? form.cronExpr.trim() : undefined,
      intervalMs: form.scheduleType === 'every' ? syncIntervalMs() : undefined,
      runAt: form.scheduleType === 'at' ? normalizeRunAt(form.runAt) : undefined,
      limit: 5,
    })
  } catch (error: any) {
    previewError.value = error?.message || '预览触发时间失败'
  } finally {
    previewLoading.value = false
  }
}

const loadRoles = async () => {
  try {
    const response = await fetch('/api/v1/roles?page=1&pageSize=200&scope=all&status=active', { credentials: 'include' })
    const result = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '岗位列表加载失败')
    roles.value = (result.data?.items || []).map((item: any) => ({
      id: Number(item.id),
      name: item.name as string,
      icon: item.icon as string | undefined,
      category: item.category as string | undefined,
      status: item.status as string | undefined,
    }))
    if (roles.value.length === 0) {
      toast.warning('无可用岗位，请先创建或启用岗位')
    }
  } catch (error: any) {
    toast.error(error?.message || '岗位列表加载失败')
  }
}

const loadModels = async () => {
  try {
    const response = await fetch(modelRegistryApi, { method: 'GET' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    const modelIds: string[] = (Array.isArray(result?.data) ? result.data : [])
      .map((item: any) => (typeof item?.id === 'string' ? item.id.trim() : ''))
      .filter((id: string) => id.length > 0)
    const ids = Array.from(new Set(modelIds))
    if (ids.length === 0) {
      throw new Error('empty model list')
    }

    modelOptions.value = ids.map((id: string) => ({
      id,
      label: id,
      brand: inferModelBrand(id),
    }))
  } catch (error) {
    console.error('Cron 模型列表加载失败:', error)
    modelOptions.value = fallbackModels
    toast.warning('Cron 模型列表加载失败，已回退默认模型')
  } finally {
    const current = form.modelId.trim()
    if (!current || !modelOptions.value.some((item) => item.id === current)) {
      form.modelId = modelOptions.value[0]?.id || fallbackModels[0].id
    }
  }
}

const loadJobs = async () => {
  loading.value = true
  try {
    const data = await cronJobsApi.list(1, 100)
    jobs.value = data.items
  } catch (error: any) {
    toast.error(error?.message || 'Cron 调度列表加载失败')
  } finally {
    loading.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([loadModels(), loadRoles(), loadJobs()])
}

const resetForm = () => {
  form.jobName = ''
  form.roleId = ''
  form.modelId = modelOptions.value[0]?.id || fallbackModels[0].id
  form.scheduleType = 'cron'
  form.cronExpr = '0 */30 * * * ?'
  form.everyValue = 30
  form.everyUnit = 'minute'
  form.intervalMs = 1800000
  form.runAt = ''
  form.taskContent = ''
  previewTimes.value = []
  previewError.value = ''
}

const fillFormFromJob = (item: CronJobItem) => {
  form.jobName = item.jobName || ''
  form.roleId = String(item.roleId || '')
  form.modelId = item.modelId || modelOptions.value[0]?.id || fallbackModels[0].id
  form.scheduleType = item.scheduleType || 'cron'
  form.cronExpr = item.cronExpr || '0 */30 * * * ?'
  const every = deriveEveryForm(item.intervalMs)
  form.everyValue = every.everyValue
  form.everyUnit = every.everyUnit
  form.intervalMs = every.intervalMs
  form.runAt = toDatetimeLocal(item.runAt)
  form.taskContent = item.taskContent || ''
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  editingJobId.value = null
  resetForm()
  showJobDialog.value = true
}

const openEditDialog = (item: CronJobItem) => {
  dialogMode.value = 'edit'
  editingJobId.value = item.id
  fillFormFromJob(item)
  showJobDialog.value = true
}

const buildPayload = (): CronJobPayload => {
  const payload: CronJobPayload = {
    jobName: form.jobName.trim(),
    roleId: Number(form.roleId),
    modelId: form.modelId.trim(),
    scheduleType: form.scheduleType,
    taskContent: form.taskContent.trim(),
  }

  if (form.scheduleType === 'cron') payload.cronExpr = form.cronExpr.trim()
  if (form.scheduleType === 'every') payload.intervalMs = syncIntervalMs()
  if (form.scheduleType === 'at') payload.runAt = normalizeRunAt(form.runAt)

  return payload
}

const submitForm = async () => {
  const errorMessage = validateForm()
  if (errorMessage) {
    toast.error(errorMessage)
    return
  }
  submitting.value = true
  try {
    const payload = buildPayload()
    if (dialogMode.value === 'create') {
      await cronJobsApi.create(payload)
      toast.success('Cron 调度任务创建成功')
    } else if (editingJobId.value) {
      await cronJobsApi.update(editingJobId.value, payload)
      toast.success('Cron 调度任务更新成功')
    }
    showJobDialog.value = false
    await loadJobs()
  } catch (error: any) {
    toast.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

const withActionLoading = async (key: string, action: () => Promise<void>) => {
  if (actionLoadingMap[key]) return
  actionLoadingMap[key] = true
  try {
    await action()
  } finally {
    actionLoadingMap[key] = false
  }
}

const toggleJob = async (item: CronJobItem) => {
  await withActionLoading(`toggle-${item.id}`, async () => {
    await cronJobsApi.toggle(item.id, !item.enabled)
    toast.success(item.enabled ? '任务已禁用' : '任务已启用')
    await loadJobs()
  })
}

const triggerJob = async (item: CronJobItem) => {
  await withActionLoading(`trigger-${item.id}`, async () => {
    const run = await cronJobsApi.trigger(item.id)
    toast.success(`触发成功，runId=${run.id}`)
    await loadJobs()
  })
}

const deleteJob = async (item: CronJobItem) => {
  if (!window.confirm(`确认删除任务「${item.jobName}」吗？`)) return
  await withActionLoading(`delete-${item.id}`, async () => {
    await cronJobsApi.remove(item.id)
    toast.success('任务已删除')
    await loadJobs()
  })
}

const openRunsDialog = async (item: CronJobItem) => {
  selectedJob.value = item
  runRows.value = []
  showRunsDialog.value = true
  runsLoading.value = true
  try {
    const data = await cronJobsApi.listRuns(item.id, 1, 20)
    runRows.value = data.items || []
  } catch (error: any) {
    toast.error(error?.message || '加载运行记录失败')
  } finally {
    runsLoading.value = false
  }
}

watch(
  () => form.scheduleType,
  (scheduleType) => {
    if (scheduleType === 'cron') {
      if (!form.cronExpr.trim()) {
        form.cronExpr = '0 */30 * * * ?'
      }
      form.intervalMs = 1800000
      form.runAt = ''
    } else if (scheduleType === 'every') {
      form.cronExpr = ''
      form.runAt = ''
      syncIntervalMs()
    } else {
      form.cronExpr = ''
      form.intervalMs = 1800000
    }
  }
)

watch(
  () => [showJobDialog.value, form.scheduleType, form.cronExpr, form.everyValue, form.everyUnit, form.runAt],
  ([open]) => {
    if (!open) return
    if (previewTimer) {
      window.clearTimeout(previewTimer)
    }
    previewTimer = window.setTimeout(() => {
      refreshPreview()
    }, 280)
  },
  { deep: true }
)

onMounted(async () => {
  await refreshAll()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto py-8 px-4">
    <div class="grid gap-4 md:grid-cols-4">
      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-xs font-bold text-muted-foreground uppercase tracking-wider">启用任务</CardTitle>
          <Clock class="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-mono font-bold text-orange-600">{{ stats.enabled }}</div>
          <CardDescription class="text-xs mt-1 font-medium text-orange-600/60">处于调度中</CardDescription>
        </CardContent>
      </Card>

      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-xs font-bold text-muted-foreground uppercase tracking-wider">最近成功</CardTitle>
          <CheckCircle2 class="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-mono font-bold text-emerald-600">{{ stats.success }}</div>
          <CardDescription class="text-xs mt-1 font-medium text-emerald-600/60">最近状态为成功</CardDescription>
        </CardContent>
      </Card>

      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-xs font-bold text-muted-foreground uppercase tracking-wider">最近失败</CardTitle>
          <XCircle class="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-mono font-bold text-red-600">{{ stats.failed }}</div>
          <CardDescription class="text-xs mt-1 font-medium text-red-600/60">最近状态为失败/终止</CardDescription>
        </CardContent>
      </Card>

      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-xs font-bold text-muted-foreground uppercase tracking-wider">总计</CardTitle>
          <AlarmClock class="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-mono font-bold">{{ stats.total }}</div>
          <CardDescription class="text-xs mt-1 font-medium text-muted-foreground">全部调度任务</CardDescription>
        </CardContent>
      </Card>
    </div>

    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-1">
        <div class="relative w-full max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" type="search" placeholder="搜索任务ID、任务名、岗位、规则..." class="pl-10 bg-background border-border/50" />
        </div>
        <Select v-model="statusFilter">
          <SelectTrigger class="w-[140px] bg-background border-border/50">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="enabled">启用中</SelectItem>
            <SelectItem value="disabled">已禁用</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="scheduleFilter">
          <SelectTrigger class="w-[140px] bg-background border-border/50">
            <SelectValue placeholder="调度类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="cron">cron</SelectItem>
            <SelectItem value="every">every</SelectItem>
            <SelectItem value="at">at</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="roleFilter">
          <SelectTrigger class="w-[180px] bg-background border-border/50">
            <SelectValue placeholder="岗位筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部岗位</SelectItem>
            <SelectItem v-for="role in roles" :key="role.id" :value="String(role.id)">
              {{ role.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="refreshAll" :disabled="loading" title="刷新">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </Button>
        <Button @click="openCreateDialog">创建任务</Button>
      </div>
    </div>

    <Card class="overflow-hidden border-border/50 shadow-md bg-card/50 backdrop-blur">
      <CardHeader class="bg-muted/30 border-b border-border/50 pb-4">
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="text-2xl font-bold flex items-center gap-2 tracking-tight">
              <AlarmClock class="h-6 w-6 text-primary" />
              Cron调度中心
            </CardTitle>
            <CardDescription class="text-sm text-muted-foreground mt-1">管理自动调度任务，统一查看触发、执行与处置状态</CardDescription>
          </div>
          <div class="text-xs text-muted-foreground font-mono">共 {{ filteredJobs.length }} 条记录</div>
        </div>
      </CardHeader>
      <CardContent class="p-0 overflow-x-auto">
        <Table class="min-w-[880px]">
          <TableHeader>
            <TableRow class="hover:bg-transparent border-border/50">
              <TableHead class="w-[280px] pl-6 font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">任务名称</TableHead>
              <TableHead class="w-[140px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">执行岗位</TableHead>
              <TableHead class="font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">调度规则</TableHead>
              <TableHead class="w-[120px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">状态</TableHead>
              <TableHead class="w-[120px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">下次触发</TableHead>
              <TableHead class="w-[140px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">最近执行</TableHead>
              <TableHead class="w-[96px] text-center font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="7" class="text-center py-16">
                <div class="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 class="h-6 w-6 animate-spin text-primary" />
                  <span class="text-sm">加载 Cron 调度列表...</span>
                </div>
              </TableCell>
            </TableRow>

            <TableRow v-else-if="filteredJobs.length === 0">
              <TableCell colspan="7" class="text-center py-16">
                <div class="flex flex-col items-center gap-3 text-muted-foreground">
                  <AlarmClock class="h-8 w-8 opacity-30" />
                  <span class="text-sm">{{ searchQuery ? '未找到匹配任务' : '暂无 Cron 调度任务' }}</span>
                  <p class="text-xs text-muted-foreground/60">点击右上角「创建任务」开始配置自动调度</p>
                </div>
              </TableCell>
            </TableRow>

            <TableRow
              v-else
              v-for="item in filteredJobs"
              :key="item.id"
              class="group transition-colors border-border/50 hover:bg-muted/40"
              :class="{ 'bg-orange-500/5': item.enabled }"
            >
              <TableCell class="font-medium text-sm pl-6">
                <div class="font-semibold truncate max-w-[260px]" :title="item.jobName">{{ item.jobName }}</div>
                <div class="text-[11px] text-muted-foreground font-mono">#{{ item.id }}</div>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ item.roleName || `角色 ${item.roleId}` }}</TableCell>
              <TableCell class="max-w-[260px]">
                <div class="text-sm font-medium truncate" :title="getRuleText(item)">{{ getRuleText(item) }}</div>
                <div class="font-mono text-[11px] text-muted-foreground truncate" :title="getRuleSubText(item)">{{ getRuleSubText(item) }}</div>
              </TableCell>
              <TableCell class="whitespace-nowrap">
                <Badge
                  variant="outline"
                  class="whitespace-nowrap"
                  :class="item.enabled
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/40'"
                >
                  {{ item.enabled ? '启用中' : '已禁用' }}
                </Badge>
              </TableCell>
              <TableCell class="text-xs text-muted-foreground whitespace-nowrap">{{ formatTime(item.nextFireTime) }}</TableCell>
              <TableCell>
                <Badge variant="outline" :class="getRunStatusClass(item.lastRunStatus)">
                  {{ item.lastRunStatus || '暂无' }}
                </Badge>
              </TableCell>
              <TableCell class="text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="h-8 w-8" title="更多操作">
                      <MoreHorizontal class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-32">
                    <DropdownMenuItem :disabled="actionLoadingMap[`trigger-${item.id}`]" @click="triggerJob(item)">
                      <Loader2 v-if="actionLoadingMap[`trigger-${item.id}`]" class="h-3.5 w-3.5 animate-spin mr-2" />
                      <Play v-else class="h-3.5 w-3.5 mr-2" />
                      触发
                    </DropdownMenuItem>
                    <DropdownMenuItem :disabled="actionLoadingMap[`toggle-${item.id}`]" @click="toggleJob(item)">
                      <Loader2 v-if="actionLoadingMap[`toggle-${item.id}`]" class="h-3.5 w-3.5 animate-spin mr-2" />
                      <Pause v-else-if="item.enabled" class="h-3.5 w-3.5 mr-2" />
                      <Play v-else class="h-3.5 w-3.5 mr-2" />
                      {{ item.enabled ? '禁用' : '启用' }}
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="openEditDialog(item)">
                      <Pencil class="h-3.5 w-3.5 mr-2" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="openRunsDialog(item)">
                      <History class="h-3.5 w-3.5 mr-2" />
                      记录
                    </DropdownMenuItem>
                    <DropdownMenuItem :disabled="actionLoadingMap[`delete-${item.id}`]" class="text-red-600 focus:text-red-600" @click="deleteJob(item)">
                      <Loader2 v-if="actionLoadingMap[`delete-${item.id}`]" class="h-3.5 w-3.5 animate-spin mr-2" />
                      <Trash2 v-else class="h-3.5 w-3.5 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog v-model:open="showJobDialog">
      <DialogContent class="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{{ dialogMode === 'create' ? '创建Cron' : '编辑Cron' }}</DialogTitle>
          <DialogDescription>配置调度规则与执行上下文，保存后立即生效</DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-2 max-h-[70vh] overflow-y-auto px-1">
          <div class="grid gap-2">
            <Label>任务名称 *</Label>
            <Input
              v-model="form.jobName"
              class="border-primary bg-primary/[0.02] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <Label>执行岗位 *</Label>
              <Select v-model="form.roleId">
                <SelectTrigger><SelectValue placeholder="选择岗位" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="role in roles" :key="role.id" :value="String(role.id)">
                    <span class="flex items-center gap-2">
                      <component :is="getRoleIcon(role.icon)" class="h-4 w-4 shrink-0 text-primary" />
                      {{ role.name }}<span v-if="role.category" class="text-xs text-muted-foreground"> · {{ role.category }}</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="roles.length === 0" class="text-xs text-amber-600">无可用岗位，请先创建或启用岗位</p>
            </div>
            <div class="grid gap-2">
              <Label>模型 *</Label>
              <div class="flex items-center gap-1.5 rounded-xl border border-border/50 bg-muted/50 p-1 shadow-inner">
                <Select v-model="form.modelId">
                  <SelectTrigger class="h-8 w-full rounded-none border-none bg-transparent px-2 text-[11px] font-bold shadow-none transition-colors hover:text-primary focus:ring-0 focus-visible:ring-0">
                    <div class="flex items-center gap-2">
                      <ModelProviderIcon :brand="selectedModelBrand" icon-class="h-3.5 w-3.5" />
                      <SelectValue placeholder="选择模型" />
                    </div>
                  </SelectTrigger>
                  <SelectContent class="border-border/50 bg-background/95 backdrop-blur-md">
                    <SelectItem
                      v-for="item in displayModelOptions"
                      :key="item.id"
                      :value="item.id"
                      hide-indicator
                      class="cursor-pointer py-2.5 text-[11px] font-bold focus:bg-primary/10 focus:text-primary"
                    >
                      <div class="flex items-center gap-2.5">
                        <ModelProviderIcon :brand="item.brand" icon-class="h-3.5 w-3.5" />
                        <span>{{ item.label }}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div class="grid gap-2">
            <Label>调度类型 *</Label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                v-for="item in scheduleTypeMeta"
                :key="item.value"
                type="button"
                class="rounded-md border p-3 text-left transition-colors"
                :class="form.scheduleType === item.value ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'"
                @click="form.scheduleType = item.value"
              >
                <div class="text-sm font-semibold">{{ item.title }}</div>
                <div class="text-xs text-muted-foreground mt-1">{{ item.desc }}</div>
              </button>
            </div>
          </div>
          <div v-if="form.scheduleType === 'cron'" class="grid gap-2">
            <Label>Cron 表达式 *</Label>
            <Input v-model="form.cronExpr" />
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="preset in cronPresets"
                :key="preset.expr"
                type="button"
                class="px-2.5 py-1.5 rounded border text-xs bg-muted/20 hover:bg-muted/40"
                :title="preset.hint"
                @click="setCronPreset(preset.expr)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>
          <div v-if="form.scheduleType === 'every'" class="grid gap-2">
            <Label>执行间隔 *</Label>
            <div class="grid grid-cols-2 gap-3">
              <Input v-model.number="form.everyValue" type="number" min="1" />
              <Select v-model="form.everyUnit">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minute">分钟</SelectItem>
                  <SelectItem value="hour">小时</SelectItem>
                  <SelectItem value="day">天</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p class="text-xs text-muted-foreground">提交时换算为 intervalMs={{ calcIntervalMs() }}</p>
            <p class="text-xs text-primary">计划频率：{{ formatEveryRule(calcIntervalMs()) }}</p>
          </div>
          <div v-if="form.scheduleType === 'at'" class="grid gap-2">
            <Label>执行时间 *</Label>
            <Input v-model="form.runAt" type="datetime-local" />
            <div class="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" @click="setRunAtOffsetHours(1)">
                <TimerReset class="h-3.5 w-3.5 mr-1" />
                1小时后
              </Button>
              <Button type="button" variant="outline" size="sm" @click="setRunAtOffsetHours(24)">
                <CalendarClock class="h-3.5 w-3.5 mr-1" />
                24小时后
              </Button>
            </div>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 p-3">
            <div class="flex items-center justify-between">
              <Label class="text-sm font-medium flex items-center gap-2">
                <Sparkles class="h-4 w-4 text-primary" />
                执行时间预览（未来 5 次）
              </Label>
              <Loader2 v-if="previewLoading" class="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
            <p v-if="previewError" class="text-xs text-amber-600 mt-2 flex items-start gap-1">
              <TriangleAlert class="h-3.5 w-3.5 mt-0.5" />
              {{ previewError }}
            </p>
            <ul v-else-if="previewTimes.length" class="mt-2 text-xs text-muted-foreground space-y-1">
              <li v-for="item in previewTimes" :key="item" class="font-mono">{{ formatPreviewTime(item) }}</li>
            </ul>
            <p v-else class="mt-2 text-xs text-muted-foreground">完善调度字段后自动展示预览</p>
          </div>
          <div class="grid gap-2">
            <Label>任务指令 *</Label>
            <Textarea
              v-model="form.taskContent"
              rows="5"
              class="min-h-[132px] resize-y border-primary bg-primary/5 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showJobDialog = false">取消</Button>
          <Button :disabled="submitting" @click="submitForm">
            <Loader2 v-if="submitting" class="h-4 w-4 animate-spin mr-2" />
            {{ dialogMode === 'create' ? '创建' : '保存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showRunsDialog">
      <DialogContent class="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>运行记录 - {{ selectedJob?.jobName || '-' }}</DialogTitle>
          <DialogDescription>最近 20 条执行记录</DialogDescription>
        </DialogHeader>
        <div v-if="runsLoading" class="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 class="h-5 w-5 animate-spin mr-2" />
          加载运行记录...
        </div>
        <div v-else-if="runRows.length === 0" class="text-center py-10 text-muted-foreground">
          暂无运行记录
        </div>
        <div v-else class="max-h-[420px] overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>触发类型</TableHead>
                <TableHead>任务号</TableHead>
                <TableHead>开始时间</TableHead>
                <TableHead>结束时间</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead>错误信息</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="run in runRows" :key="run.id">
                <TableCell class="font-mono text-xs">#{{ run.id }}</TableCell>
                <TableCell><Badge variant="outline" :class="getRunStatusClass(run.status)">{{ run.status }}</Badge></TableCell>
                <TableCell>{{ run.triggerType || '-' }}</TableCell>
                <TableCell class="font-mono text-xs">
                  <RouterLink
                    v-if="run.taskNo"
                    :to="{ name: 'fleet', query: { missionId: run.taskNo } }"
                    class="text-primary hover:underline"
                  >
                    {{ run.taskNo }}
                  </RouterLink>
                  <span v-else>-</span>
                </TableCell>
                <TableCell>{{ formatTime(run.startedAt || run.createdAt) }}</TableCell>
                <TableCell>{{ formatTime(run.finishedAt) }}</TableCell>
                <TableCell>{{ run.durationMs != null ? `${run.durationMs}ms` : '-' }}</TableCell>
                <TableCell class="max-w-[280px] truncate text-xs text-muted-foreground" :title="run.errorMessage || '-'">
                  {{ run.errorMessage || '-' }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
