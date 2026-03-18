<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table'
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  PlayCircle, Eye, CheckCircle2, Zap, Clock, Loader2, 
  Search, Plus, Terminal, ShieldAlert, Ban, Laptop, Server,
  FileCheck2, X, ExternalLink, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-vue-next'
import { useMission } from '@/composables/useMission'
import { toast } from 'vue-sonner'
import { cn } from '@/lib/utils'
import { validateRuntimeProfile } from '@/types/runtime-mode'
import MissionReportDialog from '@/components/business/MissionReportDialog.vue'

const router = useRouter()
const route = useRoute()
const { isRunning, startMission, loadMission, abortMission, taskApi } = useMission()

// 报告弹窗控制
const showReport = ref(false)
const selectedTask = ref<any>(null)

const openReport = (task: any) => {
  selectedTask.value = task
  showReport.value = true
}

// ===== 真实 API 数据 =====
const tasks = ref<any[]>([])
const isLoadingTasks = ref(false)
const searchQuery = ref('')
const statusFilter = ref<string>('all')
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const totalPages = ref(0)
const autoOpenedMissionId = ref<string | null>(null)
const openingMissionId = ref<string | null>(null)

// 状态映射：后端大写 -> 前端小写
const mapStatus = (status: string): string => {
  const map: Record<string, string> = {
    'PENDING': 'pending',
    'RUNNING': 'running',
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'ABORTED': 'aborted',
    'CANCELLED': 'aborted',
  }
  return map[status?.toUpperCase()] || status?.toLowerCase() || 'pending'
}

// 格式化时间为相对时间
const formatRelativeTime = (dateStr: string): string => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return '刚刚'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} 天前`
  return date.toLocaleDateString('zh-CN')
}

// 格式化 token 数量
const formatTokens = (tokens: number | undefined): string => {
  if (tokens === undefined || tokens === null) return '-'
  if (tokens >= 1000) return (tokens / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return tokens.toLocaleString()
}

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const firstNumber = (candidates: unknown[]): number | undefined => {
  for (const candidate of candidates) {
    const parsed = toFiniteNumber(candidate)
    if (parsed !== undefined) return parsed
  }
  return undefined
}

const formatDurationFromMs = (durationMs: number): string => {
  const safeMs = Math.max(0, Math.floor(durationMs))
  if (safeMs === 0) return '0s'

  const seconds = Math.floor(safeMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  return `${minutes}m ${remainSeconds}s`
}

const isZeroDurationLabel = (value: string): boolean => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  if (!normalized) return true
  if (['0', '0s', '0ms', '0m0s', '0h0m0s'].includes(normalized)) return true
  if (/^0+(\.0+)?s$/.test(normalized)) return true
  if (/^0+(\.0+)?ms$/.test(normalized)) return true
  return false
}

const toDurationLabel = (durationValue: unknown, durationMsValue: unknown): string | undefined => {
  if (typeof durationValue === 'string') {
    const trimmed = durationValue.trim()
    if (trimmed) {
      // 兼容后端偶发把 durationMs 作为字符串直接返回的场景。
      if (/^\d+$/.test(trimmed)) {
        return formatDurationFromMs(Number(trimmed))
      }
      return trimmed
    }
  } else if (typeof durationValue === 'number' && Number.isFinite(durationValue)) {
    return formatDurationFromMs(durationValue)
  }

  const parsedMs = toFiniteNumber(durationMsValue)
  if (parsedMs !== undefined) {
    return formatDurationFromMs(parsedMs)
  }
  return undefined
}

const resolveTaskTokens = (item: any): number | undefined => {
  const usageTokens = firstNumber([
    item?.usage?.tokensUsed,
    item?.usage?.tokens_used,
    item?.usage?.tokenUsed,
    item?.usage?.token_used,
  ])
  const topLevelTokens = firstNumber([
    item?.tokensUsed,
    item?.tokens_used,
    item?.tokenUsed,
    item?.token_used,
  ])
  const reportTokens = firstNumber([
    item?.report?.tokens,
    item?.report?.tokensUsed,
    item?.report?.tokens_used,
  ])

  const primary = usageTokens ?? topLevelTokens
  if (primary !== undefined) {
    if (primary === 0 && reportTokens !== undefined && reportTokens > 0) {
      return reportTokens
    }
    return primary
  }
  return reportTokens
}

const resolveTaskDuration = (item: any): string => {
  const usageDuration = toDurationLabel(item?.usage?.duration, item?.usage?.durationMs ?? item?.usage?.duration_ms)
  const reportDuration = toDurationLabel(item?.report?.duration, item?.report?.durationMs ?? item?.report?.duration_ms)
  const topDuration = toDurationLabel(item?.duration, item?.durationMs ?? item?.duration_ms)

  const ordered = [usageDuration, reportDuration, topDuration]
  const nonZero = ordered.find((value): value is string => Boolean(value && !isZeroDurationLabel(value)))
  if (nonZero) return nonZero

  const fallback = ordered.find((value): value is string => Boolean(value))
  if (fallback) return fallback
  return '0s'
}

const mapTaskItem = (item: any) => {
  try {
    const runtime = validateRuntimeProfile(item, `Task#${item.taskNo || item.id || 'unknown'}`)
    return {
      id: item.taskNo || item.id,
      name: item.prompt || '未命名任务',
      image: item.image || '-',
      runtimeMode: runtime.runtimeMode,
      zzMode: runtime.zzMode,
      runnerImage: runtime.runnerImage,
      runtimeError: undefined,
      status: mapStatus(item.status),
      duration: resolveTaskDuration(item),
      tokens: resolveTaskTokens(item),
      createdAt: item.createdAt,
      roleName: item.roleName || '-',
      creator: item.creator || '-',
      selectedModel: item.selectedModel || '-',
      report: item.report || null,
    }
  } catch (runtimeErr: any) {
    return {
      id: item.taskNo || item.id,
      name: item.prompt || '未命名任务',
      image: item.image || '-',
      runtimeError: runtimeErr?.message || 'runtime profile invalid',
      status: mapStatus(item.status),
      duration: resolveTaskDuration(item),
      tokens: resolveTaskTokens(item),
      createdAt: item.createdAt,
      roleName: item.roleName || '-',
      creator: item.creator || '-',
      selectedModel: item.selectedModel || '-',
      report: item.report || null,
    }
  }
}

const openMissionFromQuery = async () => {
  const missionId = String(route.query.missionId || '').trim()
  if (
    !missionId ||
    autoOpenedMissionId.value === missionId ||
    openingMissionId.value === missionId
  ) {
    return
  }
  openingMissionId.value = missionId
  try {
    let target = tasks.value.find((item) => String(item.id) === missionId)
    if (!target) {
      const task = await taskApi.get(missionId)
      if (task) {
        target = mapTaskItem(task)
      }
    }
    if (!target) {
      toast.error(`未找到任务 ${missionId}`)
      return
    }
    autoOpenedMissionId.value = missionId
    startMission(
      {
        prompt: target.name,
        image: target.image,
        runtimeMode: target.runtimeMode,
        zzMode: target.zzMode,
        runnerImage: target.runnerImage,
      },
      target.id
    )
  } catch (err: any) {
    console.error('Deep Link 打开任务失败:', err)
    toast.error(`打开任务失败: ${err?.message || missionId}`)
  } finally {
    openingMissionId.value = null
  }
}

// 加载任务列表
const fetchTasks = async () => {
  isLoadingTasks.value = true
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
    }
    if (statusFilter.value && statusFilter.value !== 'all') {
      params.status = statusFilter.value.toUpperCase()
    }
    const result = await taskApi.list(params)
    tasks.value = (result.items || []).map((item: any) => mapTaskItem(item))
    totalItems.value = result.pagination?.total || tasks.value.length
    totalPages.value = result.pagination?.totalPages || 1
    void openMissionFromQuery()
  } catch (err: any) {
    console.error('获取任务列表失败:', err)
    toast.error('获取任务列表失败: ' + (err.message || '未知错误'))
    tasks.value = []
  } finally {
    isLoadingTasks.value = false
  }
}

// 搜索过滤（前端过滤已加载的数据）
const filteredTasks = computed(() => {
  if (!searchQuery.value.trim()) return tasks.value
  const q = searchQuery.value.toLowerCase()
  return tasks.value.filter(t =>
    t.id?.toLowerCase().includes(q) ||
    t.name?.toLowerCase().includes(q) ||
    t.image?.toLowerCase().includes(q) ||
    t.roleName?.toLowerCase().includes(q)
  )
})

// 翻页
const goPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  fetchTasks()
}

// 切换状态筛选时重新加载
watch(statusFilter, () => {
  currentPage.value = 1
  fetchTasks()
})

watch(
  () => route.query.missionId,
  () => {
    autoOpenedMissionId.value = null
    void openMissionFromQuery()
  }
)

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'running': return 'running'
    case 'completed': return 'success'
    case 'failed': return 'failed'
    case 'aborted': return 'failed'
    case 'pending_auth': return 'failed'
    default: return 'pending'
  }
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    'running': '运行中',
    'completed': '已完成',
    'failed': '执行失败',
    'aborted': '已终止',
    'pending': '等待中',
    'pending_auth': '等待授权',
  }
  return map[status] || status
}

const getRuntimeLabel = (task: any) => {
  if (task.runtimeError) return '配置异常'
  if (task.runtimeMode === 'SIDECAR') return 'Sidecar / SSH'
  if (task.runtimeMode === 'ALONE') return 'Alone / Local'
  return '-'
}

const getRuntimeClass = (task: any) => {
  if (task.runtimeError) return 'bg-red-500/10 text-red-600 border-red-500/20'
  if (task.runtimeMode === 'SIDECAR') return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  if (task.runtimeMode === 'ALONE') return 'bg-zinc-500/10 text-zinc-700 border-zinc-500/20'
  return 'bg-muted text-muted-foreground border-border'
}

// 镜像图标映射
const getImageIcon = (image: string) => {
  if (!image) return Terminal
  if (image.includes('node')) return Server
  if (image.includes('ubuntu') || image.includes('linux') || image.includes('rocky')) return Terminal
  if (image.includes('postgres') || image.includes('db') || image.includes('mysql')) return Laptop
  if (image.includes('python')) return Terminal
  return Terminal
}

// 查看任务详情 (Deep Linking)
const viewTask = (task: any) => {
  router.push({ query: { ...route.query, missionId: task.id } })
  startMission({
    prompt: task.name,
    image: task.image,
    runtimeMode: task.runtimeMode,
    zzMode: task.zzMode,
    runnerImage: task.runnerImage
  }, task.id)
}

const createMission = () => {
  router.push('/')
}

const handleAbort = async (task: any) => {
  try {
    await taskApi.abort(task.id)
    toast.success(`任务 ${task.id} 已终止`)
    fetchTasks()
  } catch (err: any) {
    toast.error('终止任务失败: ' + (err.message || '未知错误'))
  }
}

const handleAuth = (task: any) => {
  toast.warning(`正在对任务 ${task.id} 进行授权...`)
}

// 初始化
onMounted(() => {
  fetchTasks()
  if (route.query.missionId) {
    const id = route.query.missionId as string
    toast.info(`检测到 Deep Link，自动打开任务: ${id}`)
  }
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto py-8 px-4">
    <!-- Control Bar -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-1">
        <div class="relative w-full max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" type="search" placeholder="搜索任务 ID、名称或镜像..." class="pl-10 bg-background border-border/50 focus-visible:ring-primary/20" />
        </div>
        <Select v-model="statusFilter">
          <SelectTrigger class="w-[140px] bg-background border-border/50">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="PENDING">等待中</SelectItem>
            <SelectItem value="RUNNING">运行中</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="FAILED">执行失败</SelectItem>
            <SelectItem value="ABORTED">已终止</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="fetchTasks" :disabled="isLoadingTasks" title="刷新">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoadingTasks }" />
        </Button>
        <Button @click="createMission" class="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 font-bold">
          <Plus class="mr-2 h-4 w-4" />
          指派新任务
        </Button>
      </div>
    </div>

    <!-- Mission Table -->
    <Card class="overflow-hidden border-border/50 shadow-md bg-card/50 backdrop-blur">
      <CardHeader class="bg-muted/30 border-b border-border/50 pb-4">
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="text-2xl font-bold tracking-tight">任务监控看板</CardTitle>
            <CardDescription class="text-sm text-muted-foreground mt-1">实时监控 AI 员工舰队的运行状态与资源消耗</CardDescription>
          </div>
          <div class="text-xs text-muted-foreground font-mono">
            共 {{ totalItems }} 条任务
          </div>
        </div>
      </CardHeader>
      <CardContent class="p-0 overflow-x-auto">
        <Table class="min-w-[1320px]">
          <TableHeader>
            <TableRow class="hover:bg-transparent border-border/50">
              <TableHead class="w-[180px] pl-6 font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">任务 ID</TableHead>
              <TableHead class="font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">任务描述</TableHead>
              <TableHead class="w-[132px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">执行状态</TableHead>
              <TableHead class="font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">运行镜像</TableHead>
              <TableHead class="w-[140px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">运行模式</TableHead>
              <TableHead class="w-[108px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">消耗 Token</TableHead>
              <TableHead class="w-[88px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">耗时</TableHead>
              <TableHead class="w-[96px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">创建人</TableHead>
              <TableHead class="w-[112px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">创建时间</TableHead>
              <TableHead class="text-right pr-6 font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <!-- 加载状态 -->
            <TableRow v-if="isLoadingTasks">
              <TableCell colspan="10" class="text-center py-16">
                <div class="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 class="h-6 w-6 animate-spin text-primary" />
                  <span class="text-sm">加载任务列表...</span>
                </div>
              </TableCell>
            </TableRow>

            <!-- 无数据 -->
            <TableRow v-else-if="filteredTasks.length === 0">
              <TableCell colspan="10" class="text-center py-16">
                <div class="flex flex-col items-center gap-3 text-muted-foreground">
                  <Terminal class="h-8 w-8 opacity-30" />
                  <span class="text-sm">{{ searchQuery ? '未找到匹配的任务' : '暂无任务记录' }}</span>
                  <Button v-if="!searchQuery" variant="outline" size="sm" @click="createMission" class="mt-2">
                    <Plus class="mr-2 h-3.5 w-3.5" /> 指派第一个任务
                  </Button>
                </div>
              </TableCell>
            </TableRow>

            <!-- 任务列表 -->
            <TableRow 
              v-else
              v-for="task in filteredTasks" 
              :key="task.id" 
              class="group transition-colors cursor-pointer border-border/50"
              :class="{
                'bg-primary/5 hover:bg-primary/10': task.status === 'running',
                'hover:bg-muted/50': task.status !== 'running'
              }"
              @click="viewTask(task)"
            >
              <TableCell class="font-mono text-xs pl-6 font-bold text-muted-foreground whitespace-nowrap">
                {{ task.id }}
              </TableCell>
              <TableCell class="font-bold text-foreground max-w-[300px]">
                <div class="truncate" :title="task.name">{{ task.name }}</div>
              </TableCell>
              <TableCell class="w-[130px]">
                <Badge :variant="getStatusVariant(task.status)" class="h-6 px-2.5 whitespace-nowrap">
                  <template v-if="task.status === 'running'">
                    <span class="relative flex h-2 w-2 mr-1.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                    </span>
                  </template>
                  <CheckCircle2 v-else-if="task.status === 'completed'" class="h-3 w-3 mr-1.5" />
                  <Ban v-else-if="task.status === 'failed' || task.status === 'aborted'" class="h-3 w-3 mr-1.5" />
                  <ShieldAlert v-else-if="task.status === 'pending_auth'" class="h-3 w-3 mr-1.5" />
                  <Clock v-else class="h-3 w-3 mr-1.5" />
                  {{ getStatusLabel(task.status) }}
                </Badge>
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                  <component :is="getImageIcon(task.image)" class="h-4 w-4 text-primary/60" />
                  <span class="font-mono text-xs truncate max-w-[160px]" :title="task.image">{{ task.image }}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" class="text-[10px] font-bold" :class="getRuntimeClass(task)" :title="task.runtimeError || task.runnerImage || ''">
                  {{ getRuntimeLabel(task) }}
                </Badge>
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-1.5 font-mono text-xs font-bold text-primary">
                  <Zap class="h-3 w-3" />
                  {{ formatTokens(task.tokens) }}
                </div>
              </TableCell>
              <TableCell class="text-sm font-mono font-bold text-muted-foreground whitespace-nowrap">{{ task.duration || '-' }}</TableCell>
              <TableCell class="text-muted-foreground text-xs font-medium whitespace-nowrap">{{ task.creator || '-' }}</TableCell>
              <TableCell class="text-muted-foreground text-xs font-medium whitespace-nowrap">{{ formatRelativeTime(task.createdAt) }}</TableCell>
              <TableCell class="text-right pr-6" @click.stop>
                <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <template v-if="task.status === 'pending_auth'">
                    <Button size="sm" class="h-8 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white" @click="handleAuth(task)">
                      <ShieldAlert class="mr-1.5 h-3.5 w-3.5" />
                      立即授权
                    </Button>
                  </template>
                  <template v-else>
                    <Button v-if="task.status === 'completed' && task.report" variant="ghost" size="icon" class="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" @click="openReport(task)" title="查看执行报告">
                      <FileCheck2 class="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" @click="viewTask(task)" title="查看全息卷宗">
                      <Eye class="h-4 w-4" />
                    </Button>
                    <Button v-if="task.status === 'running' || task.status === 'pending'" variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="终止任务" @click="handleAbort(task)">
                      <Ban class="h-4 w-4" />
                    </Button>
                  </template>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- 分页 -->
        <div v-if="totalPages > 1" class="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-muted/10">
          <div class="text-xs text-muted-foreground">
            第 {{ currentPage }} / {{ totalPages }} 页，共 {{ totalItems }} 条
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)" class="h-8 w-8 p-0">
              <ChevronLeft class="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)" class="h-8 w-8 p-0">
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>

  <!-- Mission Completion Report Dialog -->
  <MissionReportDialog 
    v-model:open="showReport"
    :mission-id="selectedTask?.id || ''"
    :report="selectedTask?.report"
  />
</template>
