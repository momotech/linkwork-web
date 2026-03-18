import { ref, onMounted, onUnmounted } from 'vue'
import { get } from '@/utils/http'

/**
 * MCP Server 健康状态
 */
export interface McpHealthStatus {
  id: string
  name: string
  type: string   // 'http' | 'sse'
  status: 'online' | 'degraded' | 'offline' | 'unknown'
  latencyMs: number | null
  lastHealthAt: string | null
  consecutiveFailures: number
  healthMessage: string | null
}

interface HealthResponse {
  items: McpHealthStatus[]
  checkedAt?: string
}

const MCP_POLL_INTERVAL = 30_000 // 30s

/**
 * MCP 健康状态轮询 composable
 *
 * - 30s 间隔轮询 GET /api/v1/mcp-servers/health
 * - 返回 healthMap: Record<id, McpHealthStatus>
 * - onMounted 开始轮询，onUnmounted 停止
 * - 页面不可见时暂停，可见时恢复
 * - 提供 fetchHealth() 方法供手动刷新
 */
export function useMcpHealth() {
  const healthMap = ref<Record<string, McpHealthStatus>>({})
  const isHealthLoading = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  const fetchHealth = async () => {
    isHealthLoading.value = true
    try {
      const resp = await get<HealthResponse>('/api/v1/mcp-servers/health')
      if (resp.code === 0 && resp.data?.items) {
        const map: Record<string, McpHealthStatus> = {}
        for (const item of resp.data.items) {
          map[item.id] = item
        }
        healthMap.value = map
      }
    } catch {
      // silently ignore — health polling failure should not disrupt UI
    } finally {
      isHealthLoading.value = false
    }
  }

  /** Schedule next poll using setTimeout (safer than setInterval for async) */
  const scheduleNext = () => {
    if (destroyed) return
    timer = setTimeout(async () => {
      await fetchHealth()
      scheduleNext()
    }, MCP_POLL_INTERVAL)
  }

  const startPolling = () => {
    stopPolling()
    fetchHealth().then(() => {
      if (!destroyed) scheduleNext()
    })
  }

  const stopPolling = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** Page Visibility API — pause when tab hidden, resume when visible */
  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopPolling()
    } else {
      startPolling()
    }
  }

  onMounted(() => {
    destroyed = false
    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    destroyed = true
    stopPolling()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return { healthMap, isHealthLoading, fetchHealth }
}
