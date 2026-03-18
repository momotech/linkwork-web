<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Terminal, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Copy,
  Download,
  Wifi,
  WifiOff
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps<{
  open: boolean
  buildId: string | null
  buildNo?: string
}>()

const emit = defineEmits(['update:open'])

interface LogEntry {
  id: string
  timestamp: string
  eventType: string
  message: string
  data?: any
}

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g
const LOG_LEVEL_PATTERN = /\[(ERROR|WARN|INFO|DEBUG)\]/i

const logs = ref<LogEntry[]>([])
const isConnected = ref(false)
const isConnecting = ref(false)
const isCompleted = ref(false)
const finalStatus = ref<'success' | 'failed' | null>(null)
const scrollAreaRef = ref<HTMLElement | null>(null)
const logEndRef = ref<HTMLElement | null>(null)

let eventSource: EventSource | null = null

const connect = () => {
  if (!props.buildId || eventSource) return

  isConnecting.value = true
  isCompleted.value = false
  finalStatus.value = null
  
  // 使用 SSE 端点直接接收 build.sh 的日志输出
  const sseUrl = `/api/v1/build-logs/${props.buildId}/stream`
  
  eventSource = new EventSource(sseUrl)
  
  eventSource.onopen = () => {
    isConnected.value = true
    isConnecting.value = false
    addSystemLog('已连接到构建日志流...')
  }
  
  // 处理日志事件
  eventSource.addEventListener('log', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      handleLogEvent(data)
    } catch (e) {
      console.error('Failed to parse SSE log message', e)
    }
  })
  
  // 处理构建完成事件
  eventSource.addEventListener('complete', (event: MessageEvent) => {
    isCompleted.value = true

    let message = '构建已完成'
    let success: boolean | null = null
    try {
      const payload = JSON.parse(event.data || '{}')
      if (typeof payload.message === 'string' && payload.message.trim()) {
        message = payload.message
      }
      if (typeof payload.success === 'boolean') {
        success = payload.success
      }
    } catch {
      // ignore parse failure and use fallback message
    }

    if (success === true) {
      finalStatus.value = 'success'
    } else if (success === false) {
      finalStatus.value = 'failed'
    } else if (message.includes('失败')) {
      finalStatus.value = 'failed'
    } else if (message.includes('成功')) {
      finalStatus.value = 'success'
    }

    addSystemLog(message)
    disconnect()
  })
  
  eventSource.onerror = (error) => {
    console.error('SSE error', error)
    isConnecting.value = false
    if (eventSource?.readyState === EventSource.CLOSED) {
      isConnected.value = false
      addSystemLog('连接已关闭')
    }
  }
}

const disconnect = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
    isConnected.value = false
  }
}

const stripAnsi = (message: string): string => {
  if (!message) return ''
  return message.replace(ANSI_ESCAPE_PATTERN, '')
}

const normalizeLogLevel = (level: string | undefined, message: string): string => {
  const levelFromMessage = message.match(LOG_LEVEL_PATTERN)?.[1]?.toLowerCase()
  if (levelFromMessage) return levelFromMessage

  const raw = (level || '').toLowerCase()
  if (['error', 'warn', 'info', 'debug'].includes(raw)) {
    return raw
  }
  return 'info'
}

const handleLogEvent = (data: { timestamp: number, level: string, message: string }) => {
  const cleanMessage = stripAnsi(data.message || '')
  const normalizedLevel = normalizeLogLevel(data.level, cleanMessage)

  const entry: LogEntry = {
    id: `${data.timestamp}-${Math.random()}`,
    timestamp: new Date(data.timestamp).toISOString(),
    eventType: `BUILD_LOG`,
    message: cleanMessage,
    data: { step: normalizedLevel }
  }
  
  logs.value.push(entry)
  scrollToBottom()
}

const formatEventMessage = (event: any): string => {
  const type = event.eventType
  const data = event.data || {}
  
  switch (type) {
    case 'BUILD_STARTED':
      return `Starting build for role: ${data.role_name || data.roleName || 'Unknown'}`
    case 'BUILD_PROGRESS':
      return data.message || `[${data.step || 'progress'}] Building...`
    case 'BUILD_LOG':
      // Docker 实时日志，直接显示消息内容
      return data.message || ''
    case 'BUILD_COMPLETED':
      return `Build completed successfully! Image: ${data.image_tag || data.imageTag || '-'}`
    case 'BUILD_FAILED':
      return `Build failed: ${data.error_message || data.errorMessage || 'Unknown error'}`
    case 'BUILD_PUSHING':
      return `Pushing image to registry: ${data.image_tag || data.imageTag || '-'}`
    case 'BUILD_PUSHED':
      return `Image pushed successfully: ${data.image_tag || data.imageTag || '-'}`
    default:
      return data.message || `Event: ${type}`
  }
}

// 根据日志级别和事件类型获取日志级别
const getLogLevel = (entry: LogEntry): string => {
  const data = entry.data || {}
  if (entry.eventType === 'BUILD_LOG') {
    return data.step || 'info'  // step 字段存储日志级别
  }
  return 'info'
}

const addSystemLog = (message: string) => {
  logs.value.push({
    id: `sys-${Date.now()}`,
    timestamp: new Date().toISOString(),
    eventType: 'SYSTEM',
    message
  })
  scrollToBottom()
}

// 节流标记：高频日志涌入时避免反复触发滚动
let scrollTimer: ReturnType<typeof setTimeout> | null = null

const scrollToBottom = () => {
  // 合并短时间内的多次调用，只执行最后一次
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    nextTick(() => {
      // 优先使用底部锚点 scrollIntoView（最可靠）
      if (logEndRef.value) {
        logEndRef.value.scrollIntoView({ behavior: 'smooth', block: 'end' })
        return
      }
      // 降级方案：直接操作滚动容器
      if (scrollAreaRef.value) {
        const el = (scrollAreaRef.value as any).$el || scrollAreaRef.value
        const scrollContainer = el.querySelector?.('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }
      }
    })
  }, 50) // 50ms 节流
}

const getEventColor = (type: string, data?: any): string => {
  // BUILD_LOG 根据日志级别着色
  if (type === 'BUILD_LOG' && data?.step) {
    const levelColors: Record<string, string> = {
      error: 'text-red-400',
      warn: 'text-yellow-400',
      info: 'text-gray-300',
      debug: 'text-gray-500'
    }
    return levelColors[data.step] || 'text-gray-400'
  }
  
  const colors: Record<string, string> = {
    BUILD_STARTED: 'text-blue-400',
    BUILD_PROGRESS: 'text-cyan-400',
    BUILD_LOG: 'text-gray-300',
    BUILD_COMPLETED: 'text-emerald-400',
    BUILD_FAILED: 'text-red-400',
    BUILD_PUSHING: 'text-yellow-400',
    BUILD_PUSHED: 'text-emerald-400',
    SYSTEM: 'text-purple-400'
  }
  return colors[type] || 'text-gray-400'
}

const formatTimestamp = (ts: string): string => {
  try {
    const date = new Date(ts)
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false
    })
  } catch {
    return '--:--:--'
  }
}

const copyLogs = () => {
  const text = logs.value.map(l => `[${formatTimestamp(l.timestamp)}] ${l.eventType}: ${l.message}`).join('\n')
  navigator.clipboard.writeText(text)
  toast.success('日志已复制到剪贴板')
}

const clearLogs = () => {
  logs.value = []
}

watch(() => props.open, (isOpen) => {
  if (isOpen && props.buildId) {
    logs.value = []
    connect()
  } else {
    disconnect()
  }
})

watch(() => props.buildId, (newId, oldId) => {
  if (newId !== oldId && props.open) {
    disconnect()
    logs.value = []
    if (newId) {
      connect()
    }
  }
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[800px] gap-0 p-0 overflow-hidden bg-[#1e1e1e] border-border max-h-[80vh]">
      <DialogHeader class="p-4 pb-3 border-b border-border/50 shrink-0 bg-[#252526]">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Terminal class="h-4 w-4 text-emerald-500" />
            </div>
            <div class="space-y-0.5">
              <DialogTitle class="text-base font-semibold tracking-tight text-gray-100">构建日志</DialogTitle>
              <p class="text-xs text-gray-500 font-mono">{{ buildNo || buildId?.substring(0, 8) || '-' }}</p>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <!-- Connection Status -->
            <Badge 
              variant="outline" 
              class="text-[10px] gap-1 px-2 py-0.5 border-0"
              :class="isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'"
            >
              <component :is="isConnected ? Wifi : WifiOff" class="h-3 w-3" />
              {{ isConnected ? 'Connected' : 'Disconnected' }}
            </Badge>
            
            <Button variant="ghost" size="icon" class="h-8 w-8 text-gray-400 hover:text-gray-100" @click="copyLogs">
              <Copy class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" class="h-8 w-8 text-gray-400 hover:text-gray-100" @click="clearLogs">
              <RefreshCw class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogHeader>

      <ScrollArea ref="scrollAreaRef" class="flex-1 max-h-[calc(80vh-80px)]">
        <div class="p-4 font-mono text-sm space-y-1 min-h-[300px]">
          <!-- Connecting State -->
          <div v-if="isConnecting" class="flex items-center gap-2 text-gray-500">
            <Loader2 class="h-4 w-4 animate-spin" />
            <span>Connecting to build stream...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="logs.length === 0 && !isConnecting" class="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <Terminal class="h-8 w-8 text-gray-600" />
            <div class="space-y-1">
              <p class="text-sm text-gray-400">等待构建事件...</p>
              <p class="text-xs text-gray-600">构建开始后日志将在此显示</p>
            </div>
          </div>

          <!-- Log Entries -->
          <div v-for="log in logs" :key="log.id" class="flex gap-2 leading-relaxed">
            <span class="text-gray-600 shrink-0">{{ formatTimestamp(log.timestamp) }}</span>
            <span 
              v-if="log.eventType !== 'BUILD_LOG'"
              class="shrink-0 min-w-[120px]"
              :class="getEventColor(log.eventType, log.data)"
            >
              [{{ log.eventType }}]
            </span>
            <span 
              v-else
              class="shrink-0 min-w-[50px]"
              :class="getEventColor(log.eventType, log.data)"
            >
              [{{ log.data?.step?.toUpperCase() || 'LOG' }}]
            </span>
            <span 
              class="break-all whitespace-pre-wrap"
              :class="getEventColor(log.eventType, log.data)"
            >{{ log.message }}</span>
          </div>

          <!-- Build Status Indicators -->
          <div v-if="isCompleted && finalStatus === 'success'" class="flex items-center gap-2 pt-4 text-emerald-400">
            <CheckCircle2 class="h-5 w-5" />
            <span class="font-semibold">构建成功</span>
          </div>
          
          <div v-if="isCompleted && finalStatus === 'failed'" class="flex items-center gap-2 pt-4 text-red-400">
            <XCircle class="h-5 w-5" />
            <span class="font-semibold">构建失败</span>
          </div>

          <!-- 底部锚点，用于自动滚动到最新日志 -->
          <div ref="logEndRef" class="h-1"></div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
