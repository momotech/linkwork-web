import { ref, computed } from 'vue'
import { createGlobalState } from '@vueuse/core'

export interface ApprovalItem {
  id: string
  taskNo: string
  taskTitle: string
  action: string
  description: string
  riskLevel: string
  status: string
  decision: string | null
  comment: string | null
  operatorName: string | null
  expiredAt: string | null
  decidedAt: string | null
  creatorName: string | null
  createdAt: string
}

interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

/**
 * 审批 API
 */
export const approvalApi = {
  /** 获取审批列表 */
  async list(params?: { status?: string, page?: number, pageSize?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.status && params.status !== 'all') searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())

    const url = `/api/v1/approvals${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    const result: ApiResponse<{ items: ApprovalItem[], pagination: any }> = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '获取审批列表失败')
    return result.data
  },

  /** 获取审批统计 */
  async stats() {
    const response = await fetch('/api/v1/approvals/stats', { credentials: 'include' })
    const result: ApiResponse<{ pending: number, approved: number, rejected: number, total: number }> = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '获取审批统计失败')
    return result.data
  },

  /** 提交审批决策 */
  async decide(approvalNo: string, decision: 'approved' | 'rejected', comment?: string) {
    const response = await fetch(`/api/v1/approvals/${approvalNo}/decision`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comment: comment || '' })
    })
    const result: ApiResponse<ApprovalItem> = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '审批决策失败')
    return result.data
  }
}

/**
 * 安全策略 API
 */
export const securityPolicyApi = {
  /** 获取策略列表 */
  async list() {
    const response = await fetch('/api/v1/security/policies', { credentials: 'include' })
    const result: ApiResponse<any[]> = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '获取策略列表失败')
    return result.data
  },

  /** 创建策略 */
  async create(data: { name: string, description: string, rules: any[] }) {
    const response = await fetch('/api/v1/security/policies', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result: ApiResponse<any> = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '创建策略失败')
    return result.data
  },

  /** 更新策略 */
  async update(id: number, data: any) {
    const response = await fetch(`/api/v1/security/policies/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const result: ApiResponse<any> = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '更新策略失败')
    return result.data
  },

  /** 切换启用/禁用 */
  async toggle(id: number) {
    const response = await fetch(`/api/v1/security/policies/${id}/toggle`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    })
    const result: ApiResponse<any> = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '切换策略状态失败')
    return result.data
  },

  /** 删除策略 */
  async remove(id: number) {
    const response = await fetch(`/api/v1/security/policies/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    const result: ApiResponse<any> = await response.json()
    if (result.code !== 0) throw new Error(result.msg || '删除策略失败')
    return result.data
  }
}

/**
 * 全局审批状态（用于侧边栏 Badge 等）
 */
export const useApproval = createGlobalState(() => {
  const approvals = ref<ApprovalItem[]>([])
  const stats = ref<{ pending: number, approved: number, rejected: number, total: number }>({
    pending: 0, approved: 0, rejected: 0, total: 0
  })
  const isLoading = ref(false)

  const pendingApprovals = computed(() => approvals.value.filter(a => a.status === 'pending'))
  const approvedCount = computed(() => stats.value.approved)
  const rejectedCount = computed(() => stats.value.rejected)

  /** 加载审批列表和统计 */
  const fetchApprovals = async (status?: string) => {
    isLoading.value = true
    try {
      const [listResult, statsResult] = await Promise.all([
        approvalApi.list({ status, pageSize: 50 }),
        approvalApi.stats()
      ])
      approvals.value = listResult.items || []
      stats.value = statsResult
    } catch (err) {
      console.error('获取审批数据失败:', err)
    } finally {
      isLoading.value = false
    }
  }

  /** 批准 */
  const approve = async (approvalNo: string, comment?: string) => {
    await approvalApi.decide(approvalNo, 'approved', comment)
    await fetchApprovals()
  }

  /** 拒绝 */
  const reject = async (approvalNo: string, comment?: string) => {
    await approvalApi.decide(approvalNo, 'rejected', comment)
    await fetchApprovals()
  }

  return {
    approvals,
    stats,
    isLoading,
    pendingApprovals,
    approvedCount,
    rejectedCount,
    fetchApprovals,
    approve,
    reject
  }
})
