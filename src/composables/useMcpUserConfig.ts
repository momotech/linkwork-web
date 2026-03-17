import { ref } from 'vue'
import { get, put, del } from '@/utils/http'

export interface McpUserConfig {
  id: number
  mcpServerId: number
  hasHeaders: boolean
  hasUrlParams: boolean
  createdAt: string
  updatedAt: string
}

export interface McpUserConfigDetail {
  headers: Record<string, string>
  urlParams: Record<string, string>
}

export function useMcpUserConfig() {
  const configs = ref<McpUserConfig[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchConfigs = async () => {
    isLoading.value = true
    error.value = null
    try {
      const resp = await get<McpUserConfig[]>('/api/v1/mcp-user-configs')
      if (resp.code === 0 && Array.isArray(resp.data)) {
        configs.value = resp.data
      } else {
        error.value = resp.msg || '获取凭证列表失败'
      }
    } catch (e: any) {
      error.value = e.message || '网络错误'
    } finally {
      isLoading.value = false
    }
  }

  const getConfigDetail = async (mcpServerId: number): Promise<McpUserConfigDetail | null> => {
    try {
      const resp = await get<any>(`/api/v1/mcp-user-configs/${mcpServerId}/detail`)
      if (resp.code === 0 && resp.data) {
        return {
          headers: resp.data.headers || {},
          urlParams: resp.data.urlParams || {},
        }
      }
      return null
    } catch {
      return null
    }
  }

  const saveConfig = async (
    mcpServerId: number,
    headers: Record<string, string>,
    urlParams: Record<string, string>,
  ) => {
    const resp = await put(`/api/v1/mcp-user-configs/${mcpServerId}`, { headers, urlParams })
    if (resp.code !== 0) throw new Error(resp.msg || '保存凭证失败')
    return resp.data
  }

  const deleteConfig = async (mcpServerId: number) => {
    const resp = await del(`/api/v1/mcp-user-configs/${mcpServerId}`)
    if (resp.code !== 0) throw new Error(resp.msg || '删除凭证失败')
  }

  const hasConfig = (mcpServerId: number | string): boolean => {
    const id = typeof mcpServerId === 'string' ? parseInt(mcpServerId) : mcpServerId
    return configs.value.some(c => c.mcpServerId === id)
  }

  return {
    configs,
    isLoading,
    error,
    fetchConfigs,
    getConfigDetail,
    saveConfig,
    deleteConfig,
    hasConfig,
  }
}
