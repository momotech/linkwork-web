import { ref } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { type RuntimeMode, type ZzMode, validateRuntimeProfile } from '@/types/runtime-mode'
import { toast } from 'vue-sonner'

/**
 * 实时流消息包装协议 (Aligned with docs/front/api/api-websocket.md)
 */
export interface EventEnvelope {
  event_type: string
  timestamp: string
  session_id: string
  data: any
}

// 任务档案接口
export interface MissionProfile {
  id: string
  prompt: string
  image: string
  roleId?: number | string
  roleName?: string
  selectedModel?: string
  runtimeMode?: RuntimeMode
  zzMode?: ZzMode
  runnerImage?: string | null
  runtimeError?: string
  repo?: string
  branch?: string
  gitRepos?: Array<{ url: string, branch?: string }>
  env?: Record<string, string>
  mcp?: string[]
  skills?: string[]
  knowledge?: string[]
  tools?: string[]
  estimatedOutput?: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted'
  creator: string
  createdAt: string
  usage?: {
    tokens_used: number
    tokens_limit: number
    input_tokens?: number
    output_tokens?: number
    request_count?: number
    usage_percent?: number
    duration?: string
  }
  report?: {
    summary: string
    tokens: number
    duration: string
    completion: number
    audit: string
    artifacts: Array<{ name: string, url?: string, path?: string }>
    branch: string
    commit: string
    errors?: string[]
  }
}

// API 响应接口
interface ApiResponse<T> {
  code: number
  msg: string
  data: T
  traceId: string
  timestamp: string
}

// 任务创建请求接口（简化版：其他配置由后端根据岗位自动填充）
interface TaskCreateRequest {
  prompt: string        // 用户输入的任务指令
  roleId: number        // 执行岗位 ID
  modelId: string       // 选择的模型 ID
  fileIds?: string[]    // 用户上传的文档文件 ID 列表
}

// 状态映射：后端枚举 -> 前端状态
const mapTaskStatus = (status: string): MissionProfile['status'] => {
  const statusMap: Record<string, MissionProfile['status']> = {
    'PENDING': 'pending',
    'RUNNING': 'running',
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'ABORTED': 'aborted',
    'CANCELLED': 'aborted'
  }
  return statusMap[status?.toUpperCase()] || 'pending'
}

const normalizeMissionTimestampInput = (value?: string | null): string => {
  if (!value) return ''
  let normalized = String(value).trim()
  if (!normalized) return ''

  // 兼容后端历史格式：LocalDateTime 被序列化为 "yyyy-MM-ddTHH:mm:ssZ"（并非真正 UTC）。
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(normalized)) {
    return normalized.replace(/Z$/, '+08:00')
  }

  // JS Date 对纳秒精度兼容有限，统一截断到毫秒。
  normalized = normalized.replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:?\d{2}$|$)/, '$1')

  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T/.test(normalized)) {
    normalized = `${normalized}+08:00`
  }
  return normalized
}

const parseMissionTimestampMs = (value?: string | null): number => {
  const normalized = normalizeMissionTimestampInput(value)
  if (!normalized) return 0
  const parsed = new Date(normalized).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

const parseRuntimeProfile = (source: any, context: string) => {
  try {
    const runtime = validateRuntimeProfile({
      runtimeMode: source?.runtimeMode,
      zzMode: source?.zzMode,
      runnerImage: source?.runnerImage
    }, context)

    return {
      runtimeMode: runtime.runtimeMode,
      zzMode: runtime.zzMode,
      runnerImage: runtime.runnerImage,
      runtimeError: undefined
    }
  } catch (error: any) {
    return {
      runtimeMode: undefined,
      zzMode: undefined,
      runnerImage: undefined,
      runtimeError: error?.message || `${context} runtime profile invalid`
    }
  }
}

interface GitLabAuthRecord {
  id?: string
  username?: string
  scope?: string
  status?: string
  expiresAt?: string
}

const normalizeResourceNames = (input: any): string[] | undefined => {
  if (!Array.isArray(input) || input.length === 0) return undefined

  const names = input
    .map((item: any) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return String(item).trim()
      }
      if (item && typeof item === 'object') {
        const raw = item.name ?? item.displayName ?? item.label ?? item.id ?? item.value
        return raw == null ? '' : String(raw).trim()
      }
      return ''
    })
    .filter(Boolean)

  return names.length > 0 ? names : undefined
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

const isZeroDurationLabel = (value: string): boolean => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  if (!normalized) return true
  if (['0', '0s', '0ms', '0m0s', '0h0m0s'].includes(normalized)) return true
  if (/^0+(\.0+)?s$/.test(normalized)) return true
  if (/^0+(\.0+)?ms$/.test(normalized)) return true
  return false
}

const resolveTokensUsed = (source: any): number => {
  const usageTokens = firstNumber([
    source?.usage?.tokensUsed,
    source?.usage?.tokens_used,
    source?.usage?.tokenUsed,
    source?.usage?.token_used,
  ])
  const topLevelTokens = firstNumber([
    source?.tokensUsed,
    source?.tokens_used,
    source?.tokenUsed,
    source?.token_used,
  ])
  const reportTokens = firstNumber([
    source?.report?.tokens,
    source?.report?.tokensUsed,
    source?.report?.tokens_used,
  ])

  const primary = usageTokens ?? topLevelTokens
  if (primary !== undefined) {
    if (primary === 0 && reportTokens !== undefined && reportTokens > 0) {
      return reportTokens
    }
    return primary
  }
  return reportTokens ?? 0
}

const resolveDurationLabel = (source: any, fallback = '0s'): string => {
  const usageDuration = typeof source?.usage?.duration === 'string' ? source.usage.duration.trim() : ''
  const reportDuration = typeof source?.report?.duration === 'string' ? source.report.duration.trim() : ''
  const topDuration = typeof source?.duration === 'string' ? source.duration.trim() : ''
  const duration = [usageDuration, reportDuration, topDuration].find((item) => item && !isZeroDurationLabel(item))
    || usageDuration || reportDuration || topDuration
  return duration || fallback
}

const mapTaskProfileFromApi = (taskData: any, payload: any, taskId: string): MissionProfile => {
  const runtime = parseRuntimeProfile(taskData, `Task#${taskId}`)

  return {
    id: taskData.taskNo || taskData.id || taskId,
    prompt: taskData.prompt || payload?.prompt || '',
    image: taskData.image || payload?.image || '',
    roleId: taskData.roleId ?? payload?.roleId,
    roleName: taskData.roleName || payload?.roleName || '',
    selectedModel: taskData.selectedModel || payload?.modelId || taskData.modelId || '',
    ...runtime,
    repo: taskData.repo || payload?.gitRepo,
    branch: taskData.branch || taskData.branchName || payload?.gitBranch,
    gitRepos: Array.isArray(taskData.gitRepos)
      ? taskData.gitRepos
      : (Array.isArray(payload?.gitRepos) ? payload.gitRepos : undefined),
    env: taskData.env || payload?.env,
    mcp: normalizeResourceNames(taskData.mcp) || normalizeResourceNames(payload?.mcp),
    skills: normalizeResourceNames(taskData.skills) || normalizeResourceNames(payload?.skills),
    knowledge: taskData.knowledge || payload?.knowledge,
    tools: taskData.tools || payload?.tools,
    estimatedOutput: taskData.estimatedOutput || [],
    status: mapTaskStatus(taskData.status),
    creator: taskData.creator || taskData.roleName || '当前用户',
    createdAt: taskData.createdAt || new Date().toISOString(),
    usage: {
      tokens_used: resolveTokensUsed(taskData),
      tokens_limit: taskData.usage?.tokenLimit || taskData.usage?.tokens_limit || 100000,
      input_tokens: taskData.usage?.inputTokens || taskData.usage?.input_tokens || 0,
      output_tokens: taskData.usage?.outputTokens || taskData.usage?.output_tokens || 0,
      request_count: taskData.usage?.requestCount || taskData.usage?.request_count || 0,
      usage_percent: taskData.usage?.usagePercent || taskData.usage?.usage_percent || 0,
      duration: resolveDurationLabel(taskData, '0s')
    },
    report: taskData.report ? {
      summary: taskData.report.summary,
      tokens: toFiniteNumber(taskData.report.tokens) ?? 0,
      duration: taskData.report.duration,
      completion: taskData.report.completion,
      audit: taskData.report.audit,
      artifacts: taskData.report.artifacts || [],
      branch: taskData.report.branch,
      commit: taskData.report.commit
    } : undefined
  }
}

// 任务 API 服务
const taskApi = {
  // 创建任务
  async create(request: TaskCreateRequest): Promise<{ taskId: string, status: string }> {
    const response = await fetch('/api/v1/tasks', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${Date.now()}-${Math.random().toString(36).slice(2)}`
      },
      body: JSON.stringify(request)
    })
    const result: ApiResponse<{ taskId: string, status: string }> = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '创建任务失败')
    }
    return result.data
  },

  // 终止任务（优先新接口 /terminate，兼容旧接口 /abort）
  async abort(taskId: string): Promise<{ taskId: string, status: string }> {
    const endpoints = [
      `/api/v1/tasks/${taskId}/terminate`,
      `/api/v1/tasks/${taskId}/abort`
    ]

    let lastError: Error | null = null
    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const result: ApiResponse<{ taskId: string, status: string }> = await response.json()

      // 新接口 404 时自动回退到兼容接口
      if (response.status === 404 && endpoint.endsWith('/terminate')) {
        lastError = new Error(result.msg || '终止任务失败')
        continue
      }

      if (result.code !== 0) {
        throw new Error(result.msg || '终止任务失败')
      }
      return result.data
    }

    throw lastError || new Error('终止任务失败')
  },

  // 获取任务详情
  async get(taskId: string): Promise<MissionProfile> {
    const response = await fetch(`/api/v1/tasks/${taskId}`, { credentials: 'include' })
    const result: ApiResponse<any> = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '获取任务详情失败')
    }
    return result.data
  },

  // 获取任务列表
  async list(params?: { roleId?: string | number, status?: string, page?: number, pageSize?: number }): Promise<{ items: any[], pagination: any }> {
    const searchParams = new URLSearchParams()
    if (params?.roleId) searchParams.set('roleId', params.roleId.toString())
    if (params?.status) searchParams.set('status', params.status)
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())

    const url = `/api/v1/tasks${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const response = await fetch(url, { credentials: 'include' })
    const result: ApiResponse<{ items: any[], pagination: any }> = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || '获取任务列表失败')
    }
    return result.data
  }
}

export const useMission = createGlobalState(() => {
  const isRunning = ref(false)
  const isDrawerOpen = ref(false)
  const progress = ref(0)
  const missionId = ref('')
  const profile = ref<MissionProfile | null>(null)
  const stream = ref<EventEnvelope[]>([]) // 存储原始事件流
  const history = ref<MissionProfile[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const startTime = ref<number>(0) // 任务开始时间戳 (ms)
  const missionEndTime = ref<number>(0) // 任务终态时间戳 (ms)

  let socket: WebSocket | null = null
  let heartbeatTimer: any = null
  let durationTimer: any = null // 用时计时器
  const historyLimit = 20

  const ensureProfileUsage = () => {
    if (!profile.value) return null
    if (!profile.value.usage) {
      profile.value.usage = {
        tokens_used: 0,
        tokens_limit: 100000,
        input_tokens: 0,
        output_tokens: 0,
        request_count: 0,
        usage_percent: 0,
        duration: '0s'
      }
    }
    if (!profile.value.usage.duration) {
      profile.value.usage.duration = '0s'
    }
    return profile.value.usage
  }

  const isTerminalStatus = (status?: string | null): status is 'completed' | 'failed' | 'aborted' => {
    return status === 'completed' || status === 'failed' || status === 'aborted'
  }

  const normalizeMissionStatus = (rawStatus: unknown): MissionProfile['status'] | null => {
    if (typeof rawStatus !== 'string') return null
    const normalized = rawStatus.trim().toLowerCase()
    if (!normalized) return null

    if (normalized === 'completed' || normalized === 'failed' || normalized === 'aborted'
      || normalized === 'running' || normalized === 'pending') {
      return normalized
    }
    if (normalized === 'cancelled') return 'aborted'
    return null
  }

  const resolveMissionStartTimeMs = (
    payload: { startedAt?: string; createdAt?: string } | null | undefined,
    fallbackMs: number
  ): number => {
    const startedAtMs = parseMissionTimestampMs(payload?.startedAt)
    if (startedAtMs > 0) return startedAtMs

    const createdAtMs = parseMissionTimestampMs(payload?.createdAt)
    if (createdAtMs > 0) return createdAtMs

    return fallbackMs
  }

  const upsertHistoryItem = (incoming: MissionProfile, moveToTop = false) => {
    const index = history.value.findIndex(item => item.id === incoming.id)

    if (index >= 0) {
      const target = history.value[index]
      Object.assign(target, incoming)

      if (moveToTop && index > 0) {
        history.value.splice(index, 1)
        history.value.unshift(target)
      }
    } else {
      history.value.unshift(incoming)
    }

    if (history.value.length > historyLimit) {
      history.value = history.value.slice(0, historyLimit)
    }
  }

  const syncProfileToHistory = (moveToTop = false) => {
    if (!profile.value) return
    upsertHistoryItem(profile.value, moveToTop)
  }

  const pushGitLabAuthHint = (message: string, level: 'info' | 'success' | 'error' = 'info') => {
    stream.value.push({
      event_type: 'GITLAB_AUTH_STATUS',
      timestamp: new Date().toISOString(),
      session_id: missionId.value || `local-${Date.now()}`,
      data: {
        message: `检测授权状态：${message}`,
        level
      }
    })
  }

  const openGitLabAuthDialog = () => {
    window.dispatchEvent(new CustomEvent('open-gitlab-auth-dialog', {
      detail: { source: 'mission-gitlab-precheck' }
    }))
  }

  const apiGet = async <T>(url: string): Promise<T> => {
    const response = await fetch(url, { credentials: 'include' })

    if (response.status === 401) {
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const result: ApiResponse<T> = await response.json()
    if (result.code !== 0) {
      throw new Error(result.msg || `请求失败: ${url}`)
    }

    return result.data
  }

  const resolveAssociatedGitRepos = async (payload: any): Promise<any[]> => {
    const payloadRepos = Array.isArray(payload?.gitRepos) ? payload.gitRepos.filter(Boolean) : []
    if (payloadRepos.length > 0) {
      return payloadRepos
    }

    const roleIdRaw = payload?.roleId
    if (!roleIdRaw) {
      return []
    }

    const roleId = typeof roleIdRaw === 'number' ? roleIdRaw : Number(roleIdRaw)
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return []
    }

    const roleDetail = await apiGet<any>(`/api/v1/roles/${roleId}`)
    return Array.isArray(roleDetail?.gitRepos) ? roleDetail.gitRepos.filter(Boolean) : []
  }

  const hasGitLabReadWriteScope = (scope: string | undefined): boolean => {
    if (!scope || typeof scope !== 'string') {
      return false
    }

    const scopeTokens = scope
      .split(/\s+/)
      .map(token => token.trim().toLowerCase())
      .filter(Boolean)

    const hasApi = scopeTokens.includes('api')
    const hasRead = hasApi || scopeTokens.includes('read_repository')
    const hasWrite = hasApi || scopeTokens.includes('write_repository')

    return hasRead && hasWrite
  }

  const resolveGitLabAuthCheck = (records: GitLabAuthRecord[]) => {
    const now = Date.now()

    const resolveExpiryCandidates = (expiresAtRaw?: string) => {
      if (!expiresAtRaw) return []

      const raw = expiresAtRaw.trim()
      if (!raw) return []

      const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
      const candidates = [
        new Date(raw).getTime()
      ]

      // 后端 LocalDateTime 可能无时区信息；补一个 UTC 解析兜底，避免跨时区误判“已过期”。
      if (!hasTimezone) {
        candidates.push(new Date(`${raw}Z`).getTime())
      }

      return candidates.filter(value => !Number.isNaN(value))
    }

    const activeRecords = records.filter(record => {
      if (!record) return false

      const status = (record.status || '').toLowerCase().trim()
      if (status && status !== 'active') return false

      const expiryCandidates = resolveExpiryCandidates(record.expiresAt)
      if (expiryCandidates.length === 0) return true

      return expiryCandidates.some(expiresAt => expiresAt > now)
    })

    const matched = activeRecords.find(record => hasGitLabReadWriteScope(record.scope))

    if (!matched) {
      if (activeRecords.length === 0) {
        return { passed: false, reason: '未检测到可用的 GitLab 授权' }
      }
      return { passed: false, reason: '当前授权不包含 GitLab 读写权限' }
    }

    const scopeLabel = matched.scope || 'read_user api'
    return { passed: true, scopeLabel }
  }

  const ensureGitLabAuthIfNeeded = async (payload: any) => {
    const gitRepos = await resolveAssociatedGitRepos(payload)
    if (gitRepos.length === 0) {
      return
    }

    pushGitLabAuthHint(`已发现 ${gitRepos.length} 个关联仓库，开始校验读写权限...`)

    const records = await apiGet<GitLabAuthRecord[]>(`/api/v1/auth/gitlab/users?ts=${Date.now()}`)
    const checkResult = resolveGitLabAuthCheck(Array.isArray(records) ? records : [])

    if (!checkResult.passed) {
      const warningMessage = `GitLab 授权校验失败：${checkResult.reason}，任务仍会继续创建`
      pushGitLabAuthHint(`${checkResult.reason}，请先完成 GitLab 读写授权。`, 'error')
      toast.warning(warningMessage, {
        action: {
          label: '去授权',
          onClick: () => openGitLabAuthDialog()
        }
      })
      return
    }

    pushGitLabAuthHint('校验通过✅', 'success')
  }

  // 格式化用时
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const updateCurrentDurationFromStart = () => {
    if (!profile.value || startTime.value <= 0) return
    const usage = ensureProfileUsage()
    if (!usage) return
    const endTimeMs = missionEndTime.value > 0 ? missionEndTime.value : Date.now()
    usage.duration = formatDuration(Math.max(0, endTimeMs - startTime.value))
  }

  const freezeCurrentDuration = (timestamp?: string | null) => {
    if (missionEndTime.value > 0) {
      updateCurrentDurationFromStart()
      return
    }

    const parsedEndTime = parseMissionTimestampMs(timestamp)
    missionEndTime.value = parsedEndTime > 0 ? parsedEndTime : Date.now()
    updateCurrentDurationFromStart()
  }

  const promoteMissionToRunning = () => {
    const currentStatus = profile.value?.status
    if (!currentStatus || isTerminalStatus(currentStatus)) return

    if (currentStatus !== 'running') {
      setCurrentMissionStatus('running')
    }
    isRunning.value = true
    missionEndTime.value = 0
  }

  const settleMissionStatus = (status: 'completed' | 'failed' | 'aborted', timestamp?: string | null) => {
    isRunning.value = false
    setCurrentMissionStatus(status)
    freezeCurrentDuration(timestamp)
    stopDurationTimer()
  }

  const resolveTerminalStatusFromStream = (): 'completed' | 'failed' | 'aborted' | null => {
    for (let index = stream.value.length - 1; index >= 0; index -= 1) {
      const event = stream.value[index]
      const eventType = event?.event_type

      if (eventType === 'TASK_COMPLETED' || (eventType === 'TOOL_RESULT' && event?.data?.event === 'task_complete')) {
        return 'completed'
      }
      if (eventType === 'TASK_FAILED') {
        return 'failed'
      }
      if (eventType === 'TASK_ABORTED' || eventType === 'TASK_TERMINATED') {
        return 'aborted'
      }
      if (eventType === 'WORKSPACE_ARCHIVED') {
        const archivedStatus = normalizeMissionStatus(event?.data?.status)
        if (archivedStatus && isTerminalStatus(archivedStatus)) {
          return archivedStatus
        }
      }
      if (eventType === 'TASK_REPORT_READY') {
        return 'completed'
      }
    }
    return null
  }

  const resolveSessionEndStatus = (envelope: EventEnvelope): 'completed' | 'failed' | 'aborted' | null => {
    const explicitStatus = normalizeMissionStatus(
      envelope.data?.status ?? envelope.data?.task_status ?? envelope.data?.result_status
    )
    if (explicitStatus && isTerminalStatus(explicitStatus)) {
      return explicitStatus
    }

    const exitCodeRaw = envelope.data?.exit_code
    if (exitCodeRaw !== undefined && exitCodeRaw !== null && exitCodeRaw !== '') {
      const exitCode = Number(exitCodeRaw)
      if (!Number.isNaN(exitCode)) {
        return exitCode === 0 ? 'completed' : 'failed'
      }
    }

    return resolveTerminalStatusFromStream()
  }

  const hasCurrentMissionExecutionSignal = () => {
    return stream.value.some(event => ACTIVE_EXECUTION_EVENTS.has(event?.event_type))
  }

  const shouldPromotePendingToRunning = (taskId: string, status: MissionProfile['status']) => {
    if (status !== 'pending') return false
    if (!taskId) return false

    if (missionId.value && missionId.value === taskId && isRunning.value) {
      return true
    }

    if (profile.value?.id === taskId && (profile.value.status === 'running' || hasCurrentMissionExecutionSignal())) {
      return true
    }

    return false
  }

  // 启动用时计时器
  const startDurationTimer = () => {
    if (durationTimer) clearInterval(durationTimer)
    durationTimer = setInterval(() => {
      if (profile.value && isRunning.value && startTime.value > 0) {
        updateCurrentDurationFromStart()
      }
    }, 1000)
  }

  // 停止用时计时器
  const stopDurationTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }
  }

  const setCurrentMissionStatus = (status: MissionProfile['status']) => {
    if (profile.value) {
      profile.value.status = status
    }

    if (!missionId.value) return
    const historyIndex = history.value.findIndex(item => item.id === missionId.value)
    if (historyIndex >= 0) {
      history.value[historyIndex].status = status
    }
  }

  const refreshCurrentMissionProfile = async () => {
    const currentMissionId = missionId.value
    if (!currentMissionId) return

    try {
      const taskData = await taskApi.get(currentMissionId)
      if (missionId.value !== currentMissionId) return

      const mappedProfile = mapTaskProfileFromApi(taskData, profile.value || {}, currentMissionId)
      if (shouldPromotePendingToRunning(mappedProfile.id, mappedProfile.status)) {
        mappedProfile.status = 'running'
      }
      profile.value = mappedProfile
      startTime.value = resolveMissionStartTimeMs(
        { startedAt: (taskData as any)?.startedAt, createdAt: mappedProfile.createdAt },
        startTime.value || Date.now()
      )
      isRunning.value = mappedProfile.status === 'running' || mappedProfile.status === 'pending'
      if (isRunning.value) {
        missionEndTime.value = 0
        updateCurrentDurationFromStart()
      } else if (startTime.value > 0 && isTerminalStatus(mappedProfile.status)) {
        if (missionEndTime.value <= 0) {
          missionEndTime.value = Date.now()
        }
        updateCurrentDurationFromStart()
      }
      syncProfileToHistory()
    } catch (refreshErr) {
      console.warn('刷新任务终态失败，保留流式状态:', refreshErr)
    }
  }

  const ACTIVE_EXECUTION_EVENTS = new Set([
    'SESSION_START',
    'TASK_STARTED',
    'TASK_ASSIGNED',
    'THINKING',
    'TOOL_CALL',
    'TOOL_RESULT',
    'TOOL_ERROR',
    'ASSISTANT_TEXT',
    'TASK_OUTPUT_ESTIMATED',
    'TASK_OUTPUT_READY',
    'TASK_OUTPUT_PATHLIST_READY',
    'WORKSPACE_INITIALIZED',
    'WORKSPACE_PREPARED',
    'CONFIG_LOADED',
    'SECURITY_LOADED',
    'SKILLS_LOADED',
    'MCP_LOADED'
  ])

  const mapOutputArtifacts = (data: any): Array<{ name: string, url?: string, path?: string }> => {
    if (!data || typeof data !== 'object') return []

    if (Array.isArray(data.artifacts) && data.artifacts.length > 0) {
      return data.artifacts.map((artifact: any) => ({
        name: artifact.name || artifact.relative_path || artifact.path || '未命名文件',
        url: artifact.download_url || artifact.oss_url || artifact.url || '',
        path: artifact.relative_path || artifact.path || ''
      }))
    }

    if (Array.isArray(data.path_list) && data.path_list.length > 0) {
      return data.path_list
        .filter((item: any) => item?.action !== 'deleted')
        .map((item: any) => ({
          name: item.relative_path || item.path || '未命名文件',
          url: item.download_url || '',
          path: item.relative_path || item.path || ''
        }))
    }
    return []
  }

  const disconnectMissionStream = (preserveOnCloseHandler = false) => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (!socket) return

    if (!preserveOnCloseHandler) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
    }

    try {
      socket.close()
    } catch (err) {
      console.warn('关闭任务流连接失败:', err)
    } finally {
      socket = null
    }
  }

  // 处理收到的消息
  const handleMessage = (envelope: EventEnvelope) => {
    stream.value.push(envelope)

    if (ACTIVE_EXECUTION_EVENTS.has(envelope.event_type)) {
      promoteMissionToRunning()
    }

    // 根据事件类型更新状态
    switch (envelope.event_type) {
      case 'SESSION_START':
        isRunning.value = true
        setCurrentMissionStatus('running')
        progress.value = 5
        // 优先使用事件时间作为任务起点，确保中途进入也能回算总耗时。
        startTime.value = resolveMissionStartTimeMs(
          { startedAt: envelope.timestamp, createdAt: profile.value?.createdAt },
          Date.now()
        )
        missionEndTime.value = 0
        startDurationTimer()
        updateCurrentDurationFromStart()
        break
      case 'TASK_STARTED':
      case 'TASK_ASSIGNED':
        setCurrentMissionStatus('running')
        isRunning.value = true
        progress.value = Math.max(progress.value, 10)
        break
      case 'TASK_OUTPUT_ESTIMATED': {
        const estimatedOutput = envelope.data?.estimated_output
        if (profile.value && Array.isArray(estimatedOutput) && estimatedOutput.length > 0) {
          profile.value.estimatedOutput = estimatedOutput
        }
        break
      }
      case 'TOOL_CALL':
        if (envelope.data.event === 'task_start') {
          progress.value = Math.min(progress.value + 10, 90)
        }
        break
      case 'TASK_COMPLETED':
        progress.value = 100
        settleMissionStatus('completed', envelope.timestamp)
        void refreshCurrentMissionProfile()
        if (socket) socket.close()
        break
      case 'TASK_FAILED':
        settleMissionStatus('failed', envelope.timestamp)
        void refreshCurrentMissionProfile()
        if (socket) socket.close()
        break
      case 'TASK_ABORT_ACK':
        // 执行器已接单，保持 running 态直到 TASK_ABORTED 回流
        break
      case 'TASK_ABORTED':
      case 'TASK_TERMINATED':
        settleMissionStatus('aborted', envelope.timestamp)
        void refreshCurrentMissionProfile()
        if (socket) socket.close()
        break
      case 'TASK_REPORT_READY': {
        const report = envelope.data?.report
        if (profile.value && report && typeof report === 'object') {
          profile.value.report = {
            summary: report.summary || '任务执行完成',
            tokens: report.tokens ?? profile.value.usage?.tokens_used ?? 0,
            duration: report.duration || profile.value.usage?.duration || '0s',
            completion: report.completion ?? 100,
            audit: report.audit || 'A',
            artifacts: Array.isArray(report.artifacts) ? report.artifacts : [],
            branch: report.branch || '',
            commit: report.commit || ''
          }
        }
        break
      }
      case 'TASK_OUTPUT_READY':
      case 'TASK_OUTPUT_PATHLIST_READY': {
        const mappedArtifacts = mapOutputArtifacts(envelope.data)
        if (profile.value && mappedArtifacts.length > 0) {
          // 写入 report.artifacts（若 report 不存在则初始化）
          if (!profile.value.report) {
            profile.value.report = {
              summary: '',
              tokens: profile.value.usage?.tokens_used ?? 0,
              duration: profile.value.usage?.duration || '0s',
              completion: 0,
              audit: '',
              artifacts: mappedArtifacts,
              branch: '',
              commit: ''
            }
          } else {
            profile.value.report.artifacts = mappedArtifacts
          }
        }
        break
      }
      case 'TOOL_RESULT':
        if (envelope.data.event === 'task_complete') {
          progress.value = 100
          settleMissionStatus('completed', envelope.timestamp)
          void refreshCurrentMissionProfile()
        }
        break
      case 'SESSION_END': {
        const currentStatus = profile.value?.status
        const resolvedStatus = resolveSessionEndStatus(envelope)

        isRunning.value = false
        freezeCurrentDuration(envelope.timestamp)
        stopDurationTimer()

        if (currentStatus && ['running', 'pending'].includes(currentStatus) && resolvedStatus) {
          setCurrentMissionStatus(resolvedStatus)
        }
        void refreshCurrentMissionProfile()
        break
      }
      case 'WORKER_STOP':
      case 'WORKER_IDLE_TIMEOUT':
        if (profile.value && ['running', 'pending'].includes(profile.value.status)) {
          settleMissionStatus('failed', envelope.timestamp)
          void refreshCurrentMissionProfile()
        }
        break
    }

    // 模拟 Token 消耗增长
    if (profile.value && profile.value.usage && isRunning.value) {
      profile.value.usage.tokens_used += Math.floor(Math.random() * 200) + 50
    }

    // 侧栏任务记录与详情共用同一状态源，确保状态点实时刷新
    syncProfileToHistory()
  }

  // 建立 WebSocket 连接
  const connectWebSocket = (taskId: string) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.host
    const wsUrl = `${wsProtocol}//${wsHost}/api/v1/ws?taskId=${taskId}`
    console.log(`Connecting to WebSocket: ${wsUrl}`)

    socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      console.log('WebSocket 连接成功')
      // 设置心跳
      heartbeatTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: 'ping' }))
        }
      }, 20000)
    }

    socket.onmessage = (e) => {
      try {
        const envelope = JSON.parse(e.data) as EventEnvelope
        console.log('收到事件:', envelope)
        handleMessage(envelope)
      } catch (err) {
        console.error('解析 WebSocket 消息失败:', err)
      }
    }

    socket.onclose = () => {
      console.log('WebSocket 已断开')
      clearInterval(heartbeatTimer)
      const shouldKeepRunning = profile.value?.status === 'running' || profile.value?.status === 'pending'
      isRunning.value = shouldKeepRunning
      if (!shouldKeepRunning) {
        stopDurationTimer()
      }
    }

    socket.onerror = (err) => {
      console.error('WebSocket 错误:', err)
    }
  }

  // 启动任务并建立 WebSocket 连接
  const startMission = async (payload: any, overrideMissionId?: string) => {
    disconnectMissionStream()
    stopDurationTimer()

    isLoading.value = true
    error.value = null
    isDrawerOpen.value = true
    progress.value = 0
    stream.value = []
    startTime.value = Date.now() // 记录开始时间
    missionEndTime.value = 0

    if (!overrideMissionId) {
      missionId.value = ''
      isRunning.value = false
      profile.value = null
    }

    try {
      let taskId: string

      if (overrideMissionId) {
        // 如果传入了 overrideMissionId，直接使用（用于加载已有任务）
        taskId = overrideMissionId
      } else {
        // 调用后端 API 创建任务（简化参数：其他配置由后端根据岗位自动填充）
        console.log('Creating task via API...')

        await ensureGitLabAuthIfNeeded(payload)

        const createRequest: TaskCreateRequest = {
          prompt: payload.prompt,
          roleId: payload.roleId,
          modelId: payload.selectedModel || 'claude-opus-4-5',
          fileIds: payload.fileIds  // 用户上传的文档文件 ID 列表
        }

        const result = await taskApi.create(createRequest)
        taskId = result.taskId
        console.log('Task created:', result)
      }

      missionId.value = taskId
      isRunning.value = true

      // 先渲染本地占位数据，避免等待详情请求期间执行流不可见
      const fallbackRuntime = parseRuntimeProfile(payload, `Task#${taskId}`)
      const fallbackProfile: MissionProfile = {
        id: taskId,
        prompt: payload?.prompt || '',
        image: payload?.image || '',
        ...fallbackRuntime,
        repo: payload?.gitRepo,
        branch: payload?.gitBranch,
        env: payload?.env,
        mcp: payload?.mcp,
        skills: payload?.skills,
        knowledge: payload?.knowledge,
        tools: payload?.tools,
        estimatedOutput: [],
        status: 'running',
        creator: '当前用户',
        createdAt: new Date().toISOString(),
        usage: {
          tokens_used: 0,
          tokens_limit: 100000,
          input_tokens: 0,
          output_tokens: 0,
          request_count: 0,
          usage_percent: 0,
          duration: '0s'
        }
      }

      profile.value = fallbackProfile
      startTime.value = resolveMissionStartTimeMs(
        { startedAt: (payload as any)?.startedAt, createdAt: fallbackProfile.createdAt },
        Date.now()
      )
      missionEndTime.value = 0
      updateCurrentDurationFromStart()
      syncProfileToHistory(true)

      // 启动用时计时器并尽快连上 WS，以实时收到 TASK_OUTPUT_ESTIMATED
      startDurationTimer()
      connectWebSocket(taskId)

      // 详情异步补齐，不阻塞执行流首屏
      void (async () => {
        try {
          const taskData = await taskApi.get(taskId)
          if (missionId.value !== taskId) return

          const mappedProfile = mapTaskProfileFromApi(taskData, payload, taskId)
          profile.value = mappedProfile
          startTime.value = resolveMissionStartTimeMs(
            { startedAt: (taskData as any)?.startedAt, createdAt: mappedProfile.createdAt },
            startTime.value || Date.now()
          )
          if (mappedProfile.status === 'running' || mappedProfile.status === 'pending') {
            missionEndTime.value = 0
            updateCurrentDurationFromStart()
          }
          syncProfileToHistory(true)
        } catch (err) {
          console.warn('获取任务详情失败，保留本地占位数据:', err)
        }
      })()

    } catch (err: any) {
      console.error('启动任务失败:', err)
      error.value = err.message || '启动任务失败'
      toast.error(error.value || '启动任务失败')
      isRunning.value = false
    } finally {
      isLoading.value = false
    }
  }

  const loadMission = async (task: MissionProfile) => {
    // 关闭之前的连接
    disconnectMissionStream()
    stopDurationTimer()

    profile.value = task
    missionId.value = task.id
    isRunning.value = task.status === 'running' || task.status === 'pending'
    isDrawerOpen.value = true
    stream.value = [] // 清空之前的流数据
    startTime.value = isRunning.value
      ? resolveMissionStartTimeMs(
          { startedAt: (task as any)?.startedAt, createdAt: task.createdAt },
          Date.now()
        )
      : 0
    missionEndTime.value = 0

    // 建立 WebSocket 连接获取该任务的流数据
    connectWebSocket(task.id)
    
    // 如果任务正在运行，启动用时计时器
    if (isRunning.value) {
      updateCurrentDurationFromStart()
      startDurationTimer()
    }
  }

  const abortMission = async () => {
    if (!missionId.value) {
      throw new Error('任务 ID 为空，无法终止')
    }

    console.log('Aborting task:', missionId.value)
    await taskApi.abort(missionId.value)
    console.log('Task abort command enqueued, waiting stream event...')

    // 关键：不主动关闭 WebSocket / 不本地抢先改终态。
    // 由总线回流的 TASK_TERMINATE_ENQUEUED / TASK_ABORT_ACK / TASK_ABORTED 事件驱动 UI 收敛，
    // 确保执行流末尾可见终止消息。
  }

  const closeDrawer = (options?: { disconnect?: boolean }) => {
    isDrawerOpen.value = false
    if (options?.disconnect ?? true) {
      disconnectMissionStream()
      stopDurationTimer()
    }
  }

  // 从后端加载最近的任务列表到 history（补偿侧栏状态实时性）
  const fetchHistory = async () => {
    try {
      const data = await taskApi.list({ pageSize: historyLimit })
      const items = Array.isArray(data.items) ? data.items : []

      // 反向写入 + upsert，保持后端返回顺序并更新已有任务状态
      for (const item of [...items].reverse()) {
        const taskId = item.taskNo || item.id
        if (!taskId) continue

        const runtime = parseRuntimeProfile(item, `Task#${taskId}`)
        const mapped: MissionProfile = {
          id: taskId,
          prompt: item.prompt || '(无描述)',
          image: item.image || '-',
          ...runtime,
          repo: item.repo,
          branch: item.branch,
          env: item.env,
          mcp: item.mcp,
          skills: item.skills,
          knowledge: item.knowledge,
          status: (() => {
            const mappedStatus = mapTaskStatus(item.status)
            return shouldPromotePendingToRunning(taskId, mappedStatus) ? 'running' : mappedStatus
          })(),
          creator: item.creator || '-',
          createdAt: item.createdAt || '',
          usage: {
            tokens_used: resolveTokensUsed(item),
            tokens_limit: item.usage?.tokenLimit || 100000,
            input_tokens: item.usage?.inputTokens || 0,
            output_tokens: item.usage?.outputTokens || 0,
            request_count: item.usage?.requestCount || 0,
            usage_percent: item.usage?.usagePercent || 0,
            duration: resolveDurationLabel(item, '-')
          },
          report: item.report
        }

        upsertHistoryItem(mapped)
      }

      if (profile.value?.id) {
        syncProfileToHistory()
      }
    } catch (err) {
      console.error('加载任务历史失败:', err)
    }
  }

  return {
    isRunning,
    isDrawerOpen,
    isLoading,
    error,
    progress,
    missionId,
    profile,
    stream,
    history,
    startMission,
    loadMission,
    abortMission,
    closeDrawer,
    fetchHistory,
    handleMessage, // 导出以供其他组件调用
    taskApi // 导出 API 服务供其他组件使用
  }
})
