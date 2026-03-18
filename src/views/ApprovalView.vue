<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Clock, 
  Terminal, ExternalLink, RefreshCw, Loader2, AlertTriangle,
  ChevronLeft, ChevronRight, Search, MessageSquare
} from 'lucide-vue-next'
import { useApproval, type ApprovalItem } from '@/composables/useApproval'
import { toast } from 'vue-sonner'

const { 
  approvals, stats, isLoading, 
  fetchApprovals, approve, reject 
} = useApproval()

const statusFilter = ref('all')
const searchQuery = ref('')

// 决策弹窗
const showDecisionDialog = ref(false)
const decisionType = ref<'approved' | 'rejected'>('approved')
const decisionTarget = ref<ApprovalItem | null>(null)
const decisionComment = ref('')

// 筛选
const filteredApprovals = () => {
  let list = approvals.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(a =>
      a.id?.toLowerCase().includes(q) ||
      a.taskNo?.toLowerCase().includes(q) ||
      a.taskTitle?.toLowerCase().includes(q) ||
      a.action?.toLowerCase().includes(q)
    )
  }
  return list
}

// 打开决策弹窗
const openDecision = (item: ApprovalItem, type: 'approved' | 'rejected') => {
  decisionTarget.value = item
  decisionType.value = type
  decisionComment.value = ''
  showDecisionDialog.value = true
}

// 提交决策
const submitDecision = async () => {
  if (!decisionTarget.value) return
  try {
    if (decisionType.value === 'approved') {
      await approve(decisionTarget.value.id, decisionComment.value)
      toast.success(`审批 ${decisionTarget.value.id} 已批准`)
    } else {
      await reject(decisionTarget.value.id, decisionComment.value)
      toast.info(`审批 ${decisionTarget.value.id} 已拒绝`)
    }
    showDecisionDialog.value = false
  } catch (err: any) {
    toast.error(err.message || '操作失败')
  }
}

// 快速批准（不需要备注）
const quickApprove = async (item: ApprovalItem) => {
  try {
    await approve(item.id)
    toast.success(`审批 ${item.id} 已批准`)
  } catch (err: any) {
    toast.error(err.message || '操作失败')
  }
}

// 风险等级颜色（兼容历史数据 0/1/2/3）
const normalizeRiskLevel = (level: string | number | undefined | null): string => {
  if (level === undefined || level === null || level === '') return 'medium'
  const raw = String(level).trim().toLowerCase()
  if (['low', 'medium', 'high', 'critical'].includes(raw)) return raw

  const numeric = Number(raw)
  if (Number.isNaN(numeric)) return 'medium'

  const numericMap: Record<number, string> = {
    0: 'low',
    1: 'medium',
    2: 'high',
    3: 'critical',
  }
  return numericMap[numeric] || 'medium'
}

const getRiskBadgeClass = (level: string | number | undefined | null) => {
  const map: Record<string, string> = {
    'low': 'bg-green-500/10 text-green-600 border-green-500/20',
    'medium': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    'high': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    'critical': 'bg-red-500/10 text-red-600 border-red-500/20',
  }
  return map[normalizeRiskLevel(level)] || 'bg-muted text-muted-foreground'
}

const getRiskLabel = (level: string | number | undefined | null) => {
  const map: Record<string, string> = {
    'low': '低风险', 'medium': '中风险', 'high': '高风险', 'critical': '极高风险'
  }
  return map[normalizeRiskLevel(level)]
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    'pending': '待审批', 'approved': '已批准', 'rejected': '已拒绝', 'expired': '已过期'
  }
  return map[status] || status
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'approved': return 'success'
    case 'rejected': return 'failed'
    case 'expired': return 'failed'
    default: return 'pending'
  }
}

const formatTime = (dateStr: string): string => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const getArchiveTime = (item: ApprovalItem): string => {
  if (item.status === 'pending') return '-'
  return formatTime(item.decidedAt || item.createdAt)
}

const getOperatorName = (item: ApprovalItem): string => {
  if (item.status === 'pending') return '待处理'
  return item.operatorName || '-'
}

watch(statusFilter, () => {
  fetchApprovals(statusFilter.value === 'all' ? undefined : statusFilter.value)
})

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchApprovals()
  // 每 15 秒自动刷新，及时发现新审批请求
  pollTimer = setInterval(() => {
    fetchApprovals(statusFilter.value === 'all' ? undefined : statusFilter.value)
  }, 15000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto py-8 px-4">
    <!-- Stats Row -->
    <div class="grid gap-4 md:grid-cols-4">
      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-xs font-bold text-muted-foreground uppercase tracking-wider">待审批</CardTitle>
          <Clock class="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-mono font-bold text-orange-600">{{ stats.pending }}</div>
          <CardDescription class="text-xs mt-1 font-medium text-orange-600/60">需要人工干预</CardDescription>
        </CardContent>
      </Card>
      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-xs font-bold text-muted-foreground uppercase tracking-wider">已批准</CardTitle>
          <CheckCircle2 class="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-mono font-bold text-emerald-600">{{ stats.approved }}</div>
          <CardDescription class="text-xs mt-1 font-medium text-emerald-600/60">安全放行</CardDescription>
        </CardContent>
      </Card>
      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-xs font-bold text-muted-foreground uppercase tracking-wider">已拒绝</CardTitle>
          <XCircle class="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-mono font-bold text-red-600">{{ stats.rejected }}</div>
          <CardDescription class="text-xs mt-1 font-medium text-red-600/60">拦截高危操作</CardDescription>
        </CardContent>
      </Card>
      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-xs font-bold text-muted-foreground uppercase tracking-wider">总计</CardTitle>
          <ShieldCheck class="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-mono font-bold">{{ stats.total }}</div>
          <CardDescription class="text-xs mt-1 font-medium text-muted-foreground">全部审批记录</CardDescription>
        </CardContent>
      </Card>
    </div>

    <!-- Control Bar -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-1">
        <div class="relative w-full max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" type="search" placeholder="搜索审批 ID、任务、操作指令..." class="pl-10 bg-background border-border/50" />
        </div>
        <Select v-model="statusFilter">
          <SelectTrigger class="w-[140px] bg-background border-border/50">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待审批</SelectItem>
            <SelectItem value="approved">已批准</SelectItem>
            <SelectItem value="rejected">已拒绝</SelectItem>
            <SelectItem value="expired">已过期</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" size="icon" @click="fetchApprovals(statusFilter === 'all' ? undefined : statusFilter)" :disabled="isLoading" title="刷新">
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
      </Button>
    </div>

    <!-- Approval Table -->
    <Card class="overflow-hidden border-border/50 shadow-md bg-card/50 backdrop-blur">
      <CardHeader class="bg-muted/30 border-b border-border/50 pb-4">
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="text-2xl font-bold flex items-center gap-2 tracking-tight">
              <ShieldCheck class="h-6 w-6 text-primary" />
              审批流中心
            </CardTitle>
            <CardDescription class="text-sm text-muted-foreground mt-1">管理 Agent 触发的敏感操作授权请求</CardDescription>
          </div>
          <div class="text-xs text-muted-foreground font-mono">
            共 {{ stats.total }} 条记录
          </div>
        </div>
      </CardHeader>
      <CardContent class="p-0 overflow-x-auto">
        <Table class="min-w-[1160px]">
          <TableHeader>
            <TableRow class="hover:bg-transparent border-border/50">
              <TableHead class="w-[140px] pl-6 font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">审批 ID</TableHead>
              <TableHead class="font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">关联任务</TableHead>
              <TableHead class="font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">操作指令</TableHead>
              <TableHead class="font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">风险</TableHead>
              <TableHead class="w-[100px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">状态</TableHead>
              <TableHead class="w-[112px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">请求时间</TableHead>
              <TableHead class="w-[112px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">归档时间</TableHead>
              <TableHead class="w-[96px] font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">操作人</TableHead>
              <TableHead class="w-[180px] text-center font-bold uppercase text-xs tracking-widest text-muted-foreground whitespace-nowrap">处置</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <!-- 加载 -->
            <TableRow v-if="isLoading">
              <TableCell colspan="9" class="text-center py-16">
                <div class="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 class="h-6 w-6 animate-spin text-primary" />
                  <span class="text-sm">加载审批列表...</span>
                </div>
              </TableCell>
            </TableRow>

            <!-- 空状态 -->
            <TableRow v-else-if="filteredApprovals().length === 0">
              <TableCell colspan="9" class="text-center py-16">
                <div class="flex flex-col items-center gap-3 text-muted-foreground">
                  <ShieldCheck class="h-8 w-8 opacity-30" />
                  <span class="text-sm">{{ searchQuery ? '未找到匹配的审批记录' : '暂无审批请求' }}</span>
                  <p class="text-xs text-muted-foreground/60">当 AI Agent 执行高危操作时，将自动生成审批请求</p>
                </div>
              </TableCell>
            </TableRow>

            <!-- 审批列表 -->
            <TableRow 
              v-else
              v-for="item in filteredApprovals()" 
              :key="item.id" 
              class="group transition-colors border-border/50"
              :class="{ 
                'bg-orange-500/5': item.status === 'pending',
                'hover:bg-muted/50': item.status !== 'pending'
              }"
            >
              <TableCell class="font-mono text-xs pl-6 font-bold text-muted-foreground whitespace-nowrap">
                {{ item.id }}
              </TableCell>
              <TableCell>
                <div class="flex flex-col">
                  <span class="font-bold text-foreground text-sm truncate max-w-[200px]" :title="item.taskTitle">
                    {{ item.taskTitle || '未关联任务' }}
                  </span>
                  <span v-if="item.taskNo" class="text-xs text-muted-foreground font-mono">{{ item.taskNo }}</span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-col gap-1.5 py-1 max-w-[280px]">
                  <p v-if="item.description" class="text-xs text-muted-foreground truncate" :title="item.description">{{ item.description }}</p>
                  <div class="font-mono text-xs bg-muted/50 p-2 rounded border border-border/50 flex items-center gap-2">
                    <Terminal class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span class="text-foreground font-bold truncate" :title="item.action">{{ item.action }}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" :class="getRiskBadgeClass(item.riskLevel)" class="text-[9px] uppercase tracking-widest font-bold whitespace-nowrap">
                  {{ getRiskLabel(item.riskLevel) }}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  :variant="getStatusVariant(item.status)"
                  class="h-6 px-2.5 font-bold tracking-wider whitespace-nowrap"
                >
                  {{ getStatusLabel(item.status) }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground text-xs font-medium whitespace-nowrap">{{ formatTime(item.createdAt) }}</TableCell>
              <TableCell class="text-muted-foreground text-xs font-medium whitespace-nowrap">{{ getArchiveTime(item) }}</TableCell>
              <TableCell class="text-muted-foreground text-xs font-medium whitespace-nowrap">{{ getOperatorName(item) }}</TableCell>
              <TableCell class="text-center">
                <div v-if="item.status === 'pending'" class="flex justify-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    class="h-8 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                    @click="openDecision(item, 'rejected')"
                  >
                    拒绝
                  </Button>
                  <Button 
                    size="sm" 
                    class="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30"
                    @click="quickApprove(item)"
                  >
                    批准
                  </Button>
                </div>
                <div v-else class="flex items-center justify-center gap-2">
                  <Badge variant="outline" class="opacity-50 uppercase tracking-widest text-[9px] whitespace-nowrap">已归档</Badge>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Decision Dialog -->
    <Dialog v-model:open="showDecisionDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <component :is="decisionType === 'approved' ? CheckCircle2 : XCircle" 
              :class="decisionType === 'approved' ? 'text-emerald-500' : 'text-red-500'"
              class="h-5 w-5" 
            />
            {{ decisionType === 'approved' ? '批准确认' : '拒绝确认' }}
          </DialogTitle>
          <DialogDescription>
            {{ decisionType === 'approved' ? '确认放行此敏感操作' : '拒绝此操作并阻断 Agent 执行' }}
          </DialogDescription>
        </DialogHeader>
        <div class="py-4 space-y-4" v-if="decisionTarget">
          <div class="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
            <div class="text-xs text-muted-foreground">操作指令</div>
            <div class="font-mono text-sm font-bold">{{ decisionTarget.action }}</div>
          </div>
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">审批备注（可选）</Label>
            <Textarea v-model="decisionComment" placeholder="输入审批意见..." rows="3" class="bg-background" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDecisionDialog = false">取消</Button>
          <Button 
            @click="submitDecision"
            :class="decisionType === 'approved' 
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'"
          >
            {{ decisionType === 'approved' ? '确认批准' : '确认拒绝' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
