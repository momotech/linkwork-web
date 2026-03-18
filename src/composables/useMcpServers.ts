import { ref } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { get } from '@/utils/http'

/**
 * MCP Server 简要信息（用于岗位配置选择列表）
 */
export interface McpServerOption {
  id: string
  name: string
  description: string
  type: string
  status: string
}

/**
 * 全局 MCP Server 列表
 *
 * - 调用 GET /api/v1/mcp-servers/available 获取真实数据
 * - createGlobalState 保证全局单例，多组件共享同一份数据
 * - 提供 fetchMcpServers() 手动刷新
 */
export const useMcpServers = createGlobalState(() => {
  const mcpServers = ref<McpServerOption[]>([])
  const isMcpLoading = ref(false)
  const mcpError = ref<string | null>(null)

  const fetchMcpServers = async () => {
    isMcpLoading.value = true
    mcpError.value = null
    try {
      const resp = await get<McpServerOption[]>('/api/v1/mcp-servers/available')
      if (resp.code === 0 && Array.isArray(resp.data)) {
        mcpServers.value = resp.data.map(item => ({
          id: String(item.id),
          name: item.name || '',
          description: item.description || `${item.type?.toUpperCase() || 'MCP'} 服务`,
          type: item.type || 'unknown',
          status: item.status || 'unknown',
        }))
      } else {
        mcpError.value = resp.msg || '获取 MCP 列表失败'
      }
    } catch (e: any) {
      mcpError.value = e.message || '网络错误'
    } finally {
      isMcpLoading.value = false
    }
  }

  return { mcpServers, isMcpLoading, mcpError, fetchMcpServers }
})
