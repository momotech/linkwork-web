<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Loader2, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw,
  Terminal,
  Package,
  Timer,
  Download
} from 'lucide-vue-next'
import { useAIRoles } from '@/composables/useAIRoles'

const props = defineProps<{
  open: boolean
  roleId: string
  roleName: string
}>()

const emit = defineEmits(['update:open', 'view-log'])

const { getBuildRecords } = useAIRoles()

const isLoading = ref(false)
const records = ref<any[]>([])
const pagination = ref({ page: 1, pageSize: 20, total: 0 })

const loadRecords = async () => {
  isLoading.value = true
  try {
    const data = await getBuildRecords(props.roleId, pagination.value.page, pagination.value.pageSize)
    records.value = data.items || []
    pagination.value = { ...pagination.value, ...data.pagination }
  } catch (e) {
    console.error('Failed to load build records', e)
  } finally {
    isLoading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen && props.roleId) {
    loadRecords()
  }
})

const getStatusConfig = (status: string) => {
  const configs: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
    SUCCESS: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-500/20', label: '成功' },
    FAILED: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-500/10 border-red-500/20', label: '失败' },
    BUILDING: { icon: Loader2, color: 'text-blue-600', bgColor: 'bg-blue-500/10 border-blue-500/20', label: '构建中' },
    PENDING: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-500/10 border-yellow-500/20', label: '等待中' },
    CANCELLED: { icon: XCircle, color: 'text-gray-500', bgColor: 'bg-gray-500/10 border-gray-500/20', label: '已取消' }
  }
  return configs[status] || configs.PENDING
}

const formatDuration = (ms: number | null) => {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

const formatTime = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const handleViewLog = (buildNo: string) => {
  emit('view-log', buildNo)
}

const handleDownloadLog = (logUrl: string, buildNo: string) => {
  // 创建隐藏的 a 标签下载文件
  const link = document.createElement('a')
  link.href = logUrl
  link.download = `${buildNo}.txt`
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 是否显示下载按钮（构建完成且有日志 URL）
const canDownloadLog = (record: any) => {
  return record.logUrl && ['SUCCESS', 'FAILED', 'CANCELLED'].includes(record.status)
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[700px] gap-0 p-0 overflow-hidden bg-background border-border max-h-[80vh]">
      <DialogHeader class="p-6 pb-4 border-b border-border/50 shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <History class="h-5 w-5 text-primary" />
            </div>
            <div class="space-y-1">
              <DialogTitle class="text-lg font-semibold tracking-tight">构建历史</DialogTitle>
              <p class="text-xs text-muted-foreground">{{ roleName }}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" @click="loadRecords" :disabled="isLoading">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
          </Button>
        </div>
      </DialogHeader>

      <ScrollArea class="flex-1 max-h-[calc(80vh-120px)]">
        <div class="p-6 space-y-3">
          <!-- Loading State -->
          <div v-if="isLoading && records.length === 0" class="flex justify-center py-12">
            <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
          </div>

          <!-- Empty State -->
          <div v-else-if="records.length === 0" class="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div class="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Package class="h-6 w-6 text-muted-foreground opacity-50" />
            </div>
            <div class="space-y-1">
              <p class="text-sm font-medium">暂无构建记录</p>
              <p class="text-xs text-muted-foreground max-w-[200px]">构建岗位后将在此显示历史记录</p>
            </div>
          </div>

          <!-- Record List -->
          <div v-else class="space-y-3">
            <div 
              v-for="record in records" 
              :key="record.id"
              class="group relative flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-all duration-200"
            >
              <!-- Status Icon -->
              <div 
                class="h-10 w-10 rounded-lg flex items-center justify-center border shrink-0"
                :class="getStatusConfig(record.status).bgColor"
              >
                <component 
                  :is="getStatusConfig(record.status).icon" 
                  class="h-5 w-5"
                  :class="[
                    getStatusConfig(record.status).color,
                    record.status === 'BUILDING' ? 'animate-spin' : ''
                  ]"
                />
              </div>

              <!-- Main Info -->
              <div class="flex flex-col min-w-0 flex-1 gap-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-foreground truncate font-mono">
                    {{ record.buildNo?.substring(0, 8) || record.id }}
                  </span>
                  <Badge 
                    variant="outline" 
                    class="text-[10px] px-1.5 py-0 h-5 border"
                    :class="getStatusConfig(record.status).bgColor"
                  >
                    {{ getStatusConfig(record.status).label }}
                  </Badge>
                </div>
                
                <div class="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <Clock class="h-3 w-3" />
                    {{ formatTime(record.createdAt) }}
                  </span>
                  <span v-if="record.durationMs" class="flex items-center gap-1">
                    <Timer class="h-3 w-3" />
                    {{ formatDuration(record.durationMs) }}
                  </span>
                  <span v-if="record.imageTag" class="font-mono text-[10px] bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                    {{ record.imageTag }}
                  </span>
                </div>

                <!-- Error Message -->
                <p v-if="record.errorMessage" class="text-xs text-red-500 truncate mt-1">
                  {{ record.errorMessage }}
                </p>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm"
                  class="h-8 gap-1.5 text-xs"
                  @click="handleViewLog(record.buildNo)"
                >
                  <Terminal class="h-3.5 w-3.5" />
                  日志
                </Button>
                <Button 
                  v-if="canDownloadLog(record)"
                  variant="ghost" 
                  size="sm"
                  class="h-8 gap-1.5 text-xs"
                  @click="handleDownloadLog(record.logUrl, record.buildNo)"
                >
                  <Download class="h-3.5 w-3.5" />
                  下载
                </Button>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="pagination.total > pagination.pageSize" class="flex justify-center pt-4">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span>共 {{ pagination.total }} 条记录</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
