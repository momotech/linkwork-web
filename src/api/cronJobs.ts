export type CronScheduleType = 'cron' | 'every' | 'at'
export type CronNotifyMode = 'none' | 'dingtalk'

export interface CronJobPayload {
  jobName: string
  roleId: number
  modelId: string
  scheduleType: CronScheduleType
  cronExpr?: string
  intervalMs?: number
  runAt?: string
  timezone?: string
  taskContent: string
  deleteAfterRun?: boolean
  maxRetry?: number
  notifyMode?: CronNotifyMode
}

export interface CronJobItem {
  id: number
  jobName: string
  roleId: number
  roleName: string
  modelId: string
  scheduleType: CronScheduleType
  cronExpr?: string
  intervalMs?: number
  runAt?: string
  timezone: string
  taskContent: string
  enabled: boolean
  deleteAfterRun: boolean
  maxRetry: number
  consecutiveFailures: number
  nextFireTime?: string
  notifyMode: CronNotifyMode
  notifyTarget?: string
  totalRuns: number
  lastRunTime?: string
  lastRunStatus?: string
  createdAt: string
  updatedAt: string
}

export interface CronJobRunItem {
  id: number
  cronJobId: number
  taskNo?: string
  status: string
  triggerType: string
  plannedFireTime?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  errorMessage?: string
  createdAt: string
}

interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CronJobListResult {
  items: CronJobItem[]
  pagination: Pagination
}

export interface CronJobRunListResult {
  items: CronJobRunItem[]
  pagination: Pagination
}

export interface CronSchedulePreviewPayload {
  scheduleType: CronScheduleType
  cronExpr?: string
  intervalMs?: number
  runAt?: string
  timezone?: string
  limit?: number
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const result: ApiResponse<T> = await response.json()
  if (!response.ok || result.code !== 0) {
    throw new Error(result.msg || `请求失败: ${response.status}`)
  }
  return result.data
}

export const cronJobsApi = {
  async create(payload: CronJobPayload): Promise<CronJobItem> {
    const response = await fetch('/api/v1/cron-jobs', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse<CronJobItem>(response)
  },

  async update(id: number, payload: CronJobPayload): Promise<CronJobItem> {
    const response = await fetch(`/api/v1/cron-jobs/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return parseResponse<CronJobItem>(response)
  },

  async list(page = 1, pageSize = 20): Promise<CronJobListResult> {
    const response = await fetch(`/api/v1/cron-jobs?scope=mine&page=${page}&pageSize=${pageSize}`, {
      credentials: 'include',
    })
    return parseResponse<CronJobListResult>(response)
  },

  async toggle(id: number, enabled: boolean): Promise<CronJobItem> {
    const response = await fetch(`/api/v1/cron-jobs/${id}/toggle`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    return parseResponse<CronJobItem>(response)
  },

  async trigger(id: number): Promise<CronJobRunItem> {
    const response = await fetch(`/api/v1/cron-jobs/${id}/trigger`, {
      method: 'POST',
      credentials: 'include',
    })
    return parseResponse<CronJobRunItem>(response)
  },

  async remove(id: number): Promise<void> {
    const response = await fetch(`/api/v1/cron-jobs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await parseResponse<void>(response)
  },

  async listRuns(id: number, page = 1, pageSize = 20): Promise<CronJobRunListResult> {
    const response = await fetch(`/api/v1/cron-jobs/${id}/runs?page=${page}&pageSize=${pageSize}`, {
      credentials: 'include',
    })
    return parseResponse<CronJobRunListResult>(response)
  },

  async preview(payload: CronSchedulePreviewPayload): Promise<string[]> {
    const response = await fetch('/api/v1/cron-jobs/preview', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await parseResponse<{ nextFireTimes?: string[] }>(response)
    return data.nextFireTimes || []
  },
}
