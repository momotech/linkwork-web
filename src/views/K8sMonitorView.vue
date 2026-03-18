<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { toast } from 'vue-sonner'
import { useK8sMonitor, type ClusterPodInfo, type PodLogResponse } from '@/composables/useK8sMonitor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RefreshCw, Loader2, Search, Server, Cpu, MemoryStick, Box, Layers,
  ChevronDown, ChevronRight, FileText, Trash2, AlertTriangle, CheckCircle2, XCircle, Clock
} from 'lucide-vue-next'

const {
  currentNamespace, namespaces, overview, nodes, pods, podGroups, events,
  loading, error,
  fetchNamespaces, setNamespace, refresh, fetchEvents, fetchPodLogs, deletePod, startPolling, stopPolling, destroy,
} = useK8sMonitor()

const searchText = ref('')
const statusFilter = ref('__all__')
const nodeFilter = ref('')
const expandedPod = ref<string | null>(null)
const logData = ref<PodLogResponse | null>(null)
const logLoading = ref(false)
const logContainer = ref('')
const logLines = ref(200)
const deleteConfirm = ref<string | null>(null)
const showEvents = ref(false)
const eventsLoading = ref(false)
const logScrollRef = ref<InstanceType<typeof ScrollArea> | null>(null)

const filteredPods = computed(() => {
  let list = pods.value
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.podGroupName && p.podGroupName.toLowerCase().includes(q)) ||
      (p.serviceId && p.serviceId.toLowerCase().includes(q))
    )
  }
  if (statusFilter.value && statusFilter.value !== '__all__') {
    list = list.filter(p => p.phase === statusFilter.value)
  }
  if (nodeFilter.value) {
    list = list.filter(p => p.nodeName === nodeFilter.value)
  }
  return list
})

const uniqueNodes = computed(() => {
  const set = new Set(pods.value.map(p => p.nodeName).filter(Boolean))
  return Array.from(set).sort()
})

function handleNamespaceChange(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    setNamespace(value)
  }
}

function phaseBadgeVariant(phase: string) {
  switch (phase) {
    case 'Running': return 'default'
    case 'Succeeded': return 'secondary'
    case 'Pending': return 'outline'
    case 'Failed': return 'destructive'
    default: return 'outline'
  }
}

function phaseColor(phase: string) {
  switch (phase) {
    case 'Running': return 'text-green-500'
    case 'Succeeded': return 'text-blue-500'
    case 'Pending': return 'text-yellow-500'
    case 'Failed': return 'text-red-500'
    default: return 'text-muted-foreground'
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' Gi'
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' Mi'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' Ki'
  return bytes + ' B'
}

function formatCpu(m: number): string {
  if (m >= 1000) return (m / 1000).toFixed(1) + ' cores'
  return m + 'm'
}

async function togglePodDetail(pod: ClusterPodInfo) {
  if (expandedPod.value === pod.name) {
    expandedPod.value = null
    logData.value = null
    return
  }
  expandedPod.value = pod.name
  logData.value = null
  logContainer.value = pod.containers.length > 0 ? pod.containers[0].name : ''
}

async function loadLogs() {
  if (!expandedPod.value) return
  logLoading.value = true
  try {
    logData.value = await fetchPodLogs(expandedPod.value, logContainer.value, logLines.value)
    scrollLogToBottom()
  } catch (e: any) {
    toast.error('获取日志失败: ' + e.message)
  } finally {
    logLoading.value = false
  }
}

function scrollLogToBottom() {
  setTimeout(() => {
    const el = document.getElementById('log-scroll-area')
    if (el) {
      const viewport = el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
      if (viewport) viewport.scrollTop = viewport.scrollHeight
    }
  }, 50)
}

async function toggleEvents() {
  if (showEvents.value) {
    showEvents.value = false
    return
  }
  eventsLoading.value = true
  await fetchEvents()
  eventsLoading.value = false
  showEvents.value = true
}

async function confirmDelete() {
  if (!deleteConfirm.value) return
  const name = deleteConfirm.value
  deleteConfirm.value = null
  try {
    await deletePod(name)
    toast.success(`Pod ${name} 已删除`)
  } catch (e: any) {
    toast.error('删除失败: ' + e.message)
  }
}

onBeforeRouteLeave(() => {
  destroy()
})

onBeforeUnmount(() => {
  destroy()
})

onMounted(() => {
  fetchNamespaces()
  refresh().then(() => {
    startPolling(30000)
  })
})

watch(logContainer, () => {
  if (expandedPod.value) loadLogs()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <Select :model-value="currentNamespace" @update:model-value="handleNamespaceChange">
          <SelectTrigger class="w-48">
            <SelectValue placeholder="选择命名空间" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="ns in namespaces" :key="ns" :value="ns">{{ ns }}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" :disabled="loading" @click="refresh">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <RefreshCw v-else class="h-4 w-4" />
        </Button>
      </div>

      <div v-if="error" class="text-sm text-red-500 flex items-center gap-1">
        <AlertTriangle class="h-4 w-4" /> {{ error }}
      </div>
    </div>

    <!-- Overview Cards -->
    <div v-if="overview" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2"><Server class="h-4 w-4" /> 节点</CardTitle></CardHeader>
        <CardContent><div class="text-2xl font-bold">{{ overview.nodeCount }}</div></CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2"><Box class="h-4 w-4" /> Pod</CardTitle></CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ overview.totalPods }}</div>
          <div class="text-xs text-muted-foreground mt-1">
            <span class="text-green-500">{{ overview.runningPods }} 运行</span>
            <span v-if="overview.pendingPods" class="text-yellow-500 ml-2">{{ overview.pendingPods }} 等待</span>
            <span v-if="overview.failedPods" class="text-red-500 ml-2">{{ overview.failedPods }} 失败</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2"><Cpu class="h-4 w-4" /> CPU</CardTitle></CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ overview.cpuUsagePercent != null ? overview.cpuUsagePercent + '%' : 'N/A' }}</div>
          <div class="text-xs text-muted-foreground mt-1">{{ formatCpu(overview.usedCpuMillicores) }} / {{ formatCpu(overview.totalCpuMillicores) }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2"><CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2"><MemoryStick class="h-4 w-4" /> 内存</CardTitle></CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ overview.memoryUsagePercent != null ? overview.memoryUsagePercent + '%' : 'N/A' }}</div>
          <div class="text-xs text-muted-foreground mt-1">{{ formatBytes(overview.usedMemoryBytes) }} / {{ formatBytes(overview.totalMemoryBytes) }}</div>
        </CardContent>
      </Card>
    </div>

    <!-- Nodes -->
    <Card v-if="nodes.length > 0">
      <CardHeader><CardTitle class="text-base flex items-center gap-2"><Server class="h-4 w-4" /> 节点状态</CardTitle></CardHeader>
      <CardContent>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="node in nodes" :key="node.name"
               class="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
               :class="nodeFilter === node.name ? 'border-primary bg-primary/5' : ''"
               @click="nodeFilter = nodeFilter === node.name ? '' : node.name">
            <div class="flex items-center justify-between mb-2">
              <span class="font-mono text-sm font-medium truncate">{{ node.name }}</span>
              <Badge :variant="node.status === 'Ready' ? 'default' : 'destructive'" class="text-[10px]">{{ node.status }}</Badge>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>CPU: <span class="text-foreground">{{ node.cpuUsagePercent ?? 0 }}%</span></div>
              <div>MEM: <span class="text-foreground">{{ node.memUsagePercent ?? 0 }}%</span></div>
              <div>Pods: <span class="text-foreground">{{ node.podCount }}/{{ node.podCapacity }}</span></div>
              <div>{{ node.kubeletVersion }}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Pods Table -->
    <Card>
      <CardHeader>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle class="text-base flex items-center gap-2"><Layers class="h-4 w-4" /> Pods ({{ filteredPods.length }})</CardTitle>
          <div class="flex items-center gap-2 flex-wrap">
            <div class="relative">
              <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input v-model="searchText" placeholder="搜索 Pod / PodGroup / ServiceId" class="pl-9 w-64 h-9 text-sm" />
            </div>
            <Select v-model="statusFilter">
              <SelectTrigger class="w-28 h-9"><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部</SelectItem>
                <SelectItem value="Running">Running</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
                <SelectItem value="Succeeded">Succeeded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-8"></TableHead>
              <TableHead>Pod</TableHead>
              <TableHead>PodGroup</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>节点</TableHead>
              <TableHead>重启</TableHead>
              <TableHead>资源</TableHead>
              <TableHead>Age</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="pod in filteredPods" :key="pod.name">
              <TableRow class="cursor-pointer hover:bg-muted/30" @click="togglePodDetail(pod)">
                <TableCell class="px-2">
                  <ChevronDown v-if="expandedPod === pod.name" class="h-4 w-4 text-muted-foreground" />
                  <ChevronRight v-else class="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell>
                  <div class="font-mono text-xs max-w-[280px] truncate" :title="pod.name">{{ pod.name }}</div>
                  <div v-if="pod.serviceId" class="text-[10px] text-muted-foreground">svc: {{ pod.serviceId }}</div>
                </TableCell>
                <TableCell>
                  <div v-if="pod.podGroupName" class="flex items-center gap-1.5">
                    <span class="font-mono text-xs truncate max-w-[140px]">{{ pod.podGroupName }}</span>
                    <span class="h-2 w-2 rounded-full shrink-0"
                          :class="pod.podGroupPhase === 'Running' ? 'bg-green-500' : pod.podGroupPhase === 'Pending' ? 'bg-yellow-500' : 'bg-zinc-400'"></span>
                  </div>
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell><Badge :variant="phaseBadgeVariant(pod.phase)" class="text-[10px]">{{ pod.phase }}</Badge></TableCell>
                <TableCell class="text-xs font-mono">{{ pod.nodeName || '—' }}</TableCell>
                <TableCell>
                  <span :class="pod.restartCount > 0 ? 'text-amber-500 font-medium' : 'text-muted-foreground'" class="text-xs">{{ pod.restartCount }}</span>
                </TableCell>
                <TableCell>
                  <div v-if="pod.resourceUsage" class="text-xs">
                    <span class="text-muted-foreground">CPU:</span> {{ pod.resourceUsage.cpuUsage }}
                    <span class="text-muted-foreground ml-1">MEM:</span> {{ pod.resourceUsage.memoryUsage }}
                  </div>
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">{{ pod.age }}</TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-1" @click.stop>
                    <Button variant="ghost" size="icon" class="h-7 w-7" @click="expandedPod = pod.name; loadLogs()" title="查看日志">
                      <FileText class="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" class="h-7 w-7 text-red-500 hover:text-red-600" @click="deleteConfirm = pod.name" title="删除 Pod">
                      <Trash2 class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>

              <!-- Expanded Detail + Logs -->
              <TableRow v-if="expandedPod === pod.name" class="bg-muted/20">
                <TableCell :colspan="9" class="p-4">
                  <div class="space-y-4">
                    <!-- Containers -->
                    <div>
                      <h4 class="text-xs font-bold text-muted-foreground uppercase mb-2">容器</h4>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div v-for="c in pod.containers" :key="c.name" class="border rounded p-2 text-xs">
                          <div class="flex items-center justify-between">
                            <span class="font-mono font-medium">{{ c.name }}</span>
                            <Badge :variant="c.state === 'running' ? 'default' : c.state === 'terminated' ? 'destructive' : 'outline'" class="text-[10px]">
                              {{ c.state }}
                            </Badge>
                          </div>
                          <div v-if="c.reason" class="text-muted-foreground mt-1">{{ c.reason }}</div>
                          <div class="text-muted-foreground mt-1">Restarts: {{ c.restartCount }}</div>
                        </div>
                      </div>
                    </div>

                    <!-- Logs -->
                    <div>
                      <div class="flex items-center gap-3 mb-2">
                        <h4 class="text-xs font-bold text-muted-foreground uppercase">日志</h4>
                        <Select v-model="logContainer" v-if="pod.containers.length > 1">
                          <SelectTrigger class="w-40 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="c in pod.containers" :key="c.name" :value="c.name">{{ c.name }}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select v-model="logLines">
                          <SelectTrigger class="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem :value="100">100行</SelectItem>
                            <SelectItem :value="200">200行</SelectItem>
                            <SelectItem :value="500">500行</SelectItem>
                            <SelectItem :value="1000">1000行</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" class="h-7 text-xs" :disabled="logLoading" @click="loadLogs">
                          <Loader2 v-if="logLoading" class="h-3 w-3 mr-1 animate-spin" />
                          加载日志
                        </Button>
                      </div>
                      <ScrollArea v-if="logData" id="log-scroll-area" class="h-64 w-full rounded border bg-zinc-950">
                        <pre class="p-3 text-[11px] leading-relaxed text-green-400 font-mono whitespace-pre-wrap break-all">{{ logData.logs || '(无日志)' }}</pre>
                      </ScrollArea>
                      <div v-else class="text-xs text-muted-foreground">点击"加载日志"查看容器输出</div>
                    </div>

                    <!-- Images -->
                    <div v-if="pod.images.length > 0">
                      <h4 class="text-xs font-bold text-muted-foreground uppercase mb-1">镜像</h4>
                      <div v-for="img in pod.images" :key="img" class="text-[11px] font-mono text-muted-foreground truncate">{{ img }}</div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </template>

            <TableRow v-if="filteredPods.length === 0 && !loading">
              <TableCell :colspan="9" class="text-center py-8 text-muted-foreground">
                {{ pods.length === 0 ? '该命名空间下没有 Pod' : '没有匹配的 Pod' }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- Events (按需加载) -->
    <div>
      <Button variant="outline" class="gap-2" :disabled="eventsLoading" @click="toggleEvents">
        <Loader2 v-if="eventsLoading" class="h-4 w-4 animate-spin" />
        <AlertTriangle v-else class="h-4 w-4" />
        {{ showEvents ? '收起事件' : '查看最近事件' }}
      </Button>
    </div>
    <Card v-if="showEvents && events.length > 0">
      <CardHeader><CardTitle class="text-base flex items-center gap-2"><AlertTriangle class="h-4 w-4" /> 最近事件 ({{ events.length }})</CardTitle></CardHeader>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-20">类型</TableHead>
              <TableHead class="w-28">原因</TableHead>
              <TableHead>对象</TableHead>
              <TableHead>消息</TableHead>
              <TableHead class="w-16">次数</TableHead>
              <TableHead class="w-36">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(ev, idx) in events" :key="idx">
              <TableCell>
                <Badge :variant="ev.type === 'Warning' ? 'destructive' : 'secondary'" class="text-[10px]">{{ ev.type }}</Badge>
              </TableCell>
              <TableCell class="text-xs font-medium">{{ ev.reason }}</TableCell>
              <TableCell class="text-xs font-mono">{{ ev.objectKind }}/{{ ev.objectName }}</TableCell>
              <TableCell class="text-xs text-muted-foreground max-w-[400px] truncate" :title="ev.message">{{ ev.message }}</TableCell>
              <TableCell class="text-xs text-center">{{ ev.count }}</TableCell>
              <TableCell class="text-xs text-muted-foreground">{{ ev.lastTimestamp?.replace('T', ' ').substring(0, 19) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    <div v-if="showEvents && events.length === 0 && !eventsLoading" class="text-sm text-muted-foreground">
      暂无事件
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="!!deleteConfirm" @update:open="deleteConfirm = null">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除 Pod</DialogTitle>
          <DialogDescription>
            确定要删除 Pod <span class="font-mono font-bold">{{ deleteConfirm }}</span> 吗？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteConfirm = null">取消</Button>
          <Button variant="destructive" @click="confirmDelete">删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
