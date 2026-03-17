<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  X, Clock, Cpu, Terminal, Code2, FileDiff, ShieldCheck, AlertTriangle, Check, Copy, User, Loader2, ArrowLeft, Ban,
  GitBranch, ServerCog, Box, Calendar, Activity, Lock, Coins, BarChart3, FolderGit2, Briefcase,
  FileCheck2, Download, ExternalLink, Zap, Rocket, Shield, Plug, Wrench, CircleCheckBig, Timer, ListTodo, ChevronRight, ChevronDown, ChevronUp,
  Globe, Share2,
  Eye, Image as ImageIcon, FileCode, FileText, Folder, FolderOpen
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'
import { cn } from '@/lib/utils'
import { useMission } from '@/composables/useMission'
import { approvalApi, useApproval } from '@/composables/useApproval'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import WorkspaceExplorer from './WorkspaceExplorer.vue'
import CodeContainer from './CodeContainer.vue'
import MissionReportDialog from './MissionReportDialog.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ArtifactPreviewDialog from './ArtifactPreviewDialog.vue'

const props = withDefaults(defineProps<{
  isSharedView?: boolean
}>(), {
  isSharedView: false
})
const emit = defineEmits(['close'])
const router = useRouter()

const { isRunning, progress, stream, profile, missionId, loadMission, abortMission } = useMission()
const { fetchApprovals } = useApproval()
const activeTab = ref('execution')
const showReport = ref(false)
const streamEndRef = ref<HTMLElement | null>(null)
const isAborting = ref(false)
const isCreatingShareLink = ref(false)
let streamAutoScrollTimer: ReturnType<typeof setTimeout> | null = null

const clearStreamAutoScrollTimer = () => {
  if (!streamAutoScrollTimer) return
  clearTimeout(streamAutoScrollTimer)
  streamAutoScrollTimer = null
}

const scheduleScrollToStreamBottom = () => {
  clearStreamAutoScrollTimer()
  const running = isRunning.value || profile.value?.status === 'running' || profile.value?.status === 'pending'
  const behavior: ScrollBehavior = running ? 'smooth' : 'auto'
  const delay = running ? 64 : 160

  // 合并短时间内连续到达的历史事件，避免每条消息都触发滚动动画。
  streamAutoScrollTimer = setTimeout(() => {
    streamAutoScrollTimer = null
    nextTick(() => {
      streamEndRef.value?.scrollIntoView({ behavior, block: 'end' })
    })
  }, delay)
}

const canAbortMission = computed(() => {
  const status = profile.value?.status
  return status === 'running' || status === 'pending'
})

const handleAbortMission = async () => {
  if (props.isSharedView) return
  if (!canAbortMission.value || isAborting.value) return

  const confirmed = window.confirm('确认要终止当前任务吗？该操作不可撤销。')
  if (!confirmed) return

  isAborting.value = true
  try {
    await abortMission()
    toast.success('任务终止命令已下发')
  } catch (err: any) {
    toast.error(err?.message || '终止任务失败')
  } finally {
    isAborting.value = false
  }
}

const handleShareTaskLink = async () => {
  if (props.isSharedView) return
  const taskNo = String(missionId.value || '').trim()
  if (!taskNo || isCreatingShareLink.value) return

  isCreatingShareLink.value = true
  try {
    const res = await fetch(`/api/v1/tasks/${encodeURIComponent(taskNo)}/share-link`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expireHours: 24 })
    })
    const result = await res.json()
    if (!res.ok || result?.code !== 0 || !result?.data?.shareUrl) {
      throw new Error(result?.msg || `HTTP ${res.status}`)
    }

    const shareUrl = String(result.data.shareUrl)
    await navigator.clipboard.writeText(shareUrl)
    toast.success('分享链接已复制（24h 有效）')
  } catch (err: any) {
    toast.error(err?.message || '生成分享链接失败')
  } finally {
    isCreatingShareLink.value = false
  }
}

const runtimeBadgeClass = computed(() => {
  if (profile.value?.runtimeError) return 'bg-red-500/10 text-red-600 border-red-500/20'
  if (profile.value?.runtimeMode === 'SIDECAR') return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  if (profile.value?.runtimeMode === 'ALONE') return 'bg-zinc-500/10 text-zinc-700 border-zinc-500/20'
  return 'bg-red-500/10 text-red-600 border-red-500/20'
})

const runtimeLabel = computed(() => {
  if (profile.value?.runtimeError) return '配置异常'
  if (profile.value?.runtimeMode === 'SIDECAR') return '双容器'
  if (profile.value?.runtimeMode === 'ALONE') return '单容器'
  return '配置异常'
})

const DISPLAY_TIME_ZONE = 'Asia/Shanghai'

const normalizeTimestampInput = (value?: string | null): string => {
  if (!value) return ''
  let normalized = String(value).trim()
  if (!normalized) return ''

  // 兼容后端 TaskResponse 的历史格式：LocalDateTime 被序列化为 "...Z"（并非真正 UTC）。
  // 该格式固定到秒级，这里按东八区本地时间解释，避免重复 +8 小时。
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(normalized)) {
    normalized = normalized.replace(/Z$/, '+08:00')
    return normalized
  }

  // JS Date 对纳秒精度兼容较差，统一截断到毫秒精度。
  normalized = normalized.replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:?\d{2}$|$)/, '$1')

  // 无时区标记时按东八区处理，避免直接按浏览器时区解释导致偏差。
  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T/.test(normalized)) {
    normalized = `${normalized}+08:00`
  }

  return normalized
}

const parseTimestamp = (value?: string | null): Date | null => {
  const normalized = normalizeTimestampInput(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const formatEventTimestamp = (value?: string | null): string => {
  const parsed = parseTimestamp(value)
  if (!parsed) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: DISPLAY_TIME_ZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(parsed)
}

const formatMetaTimestamp = (value?: string | null): string => {
  const parsed = parseTimestamp(value)
  if (!parsed) return value || '-'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: DISPLAY_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(parsed).replace(/\//g, '-')
}

const formattedMetaCreatedAt = computed(() => formatMetaTimestamp(profile.value?.createdAt))
const displayRoleName = computed(() => profile.value?.roleName || '-')
const displayModelName = computed(() => profile.value?.selectedModel || '-')

const normalizeTokenCount = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const displayTokensUsed = computed(() => {
  const usageTokens = normalizeTokenCount(profile.value?.usage?.tokens_used)
  const reportTokens = normalizeTokenCount(profile.value?.report?.tokens)

  if (usageTokens !== undefined) {
    if (usageTokens === 0 && reportTokens !== undefined && reportTokens > 0) {
      return reportTokens
    }
    return usageTokens
  }
  return reportTokens ?? 0
})

type TaskRepoRow = {
  url: string
  branch: string
}

const taskRepoRows = computed<TaskRepoRow[]>(() => {
  const rows: TaskRepoRow[] = []
  const seen = new Set<string>()

  const pushRow = (url?: string | null, branch?: string | null) => {
    const normalizedUrl = String(url || '').trim()
    if (!normalizedUrl) return
    const normalizedBranch = String(branch || '').trim() || 'main'
    const dedupeKey = `${normalizedUrl}@@${normalizedBranch}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    rows.push({ url: normalizedUrl, branch: normalizedBranch })
  }

  const list = profile.value?.gitRepos
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      pushRow((item as any).url, (item as any).branch)
    }
  }

  if (rows.length === 0) {
    pushRow(profile.value?.repo, profile.value?.branch)
  }

  return rows
})

// 审批状态跟踪（用于交互卡片按钮状态）
const approvalStates = ref<Map<string, { status: string, loading: boolean }>>(new Map())

const getApprovalState = (approvalNo: string) => {
  if (!approvalNo) return { status: 'pending', loading: false }
  if (!approvalStates.value.has(approvalNo)) {
    approvalStates.value.set(approvalNo, { status: 'pending', loading: false })
  }
  return approvalStates.value.get(approvalNo)!
}

const handleApproval = async (approvalNo: string, decision: 'approved' | 'rejected') => {
  if (props.isSharedView) return
  if (!approvalNo) return
  const state = getApprovalState(approvalNo)
  if (state.loading || state.status !== 'pending') return

  approvalStates.value.set(approvalNo, { status: 'pending', loading: true })
  try {
    await approvalApi.decide(approvalNo, decision)
    approvalStates.value.set(approvalNo, { status: decision, loading: false })
    toast.success(decision === 'approved' ? '已批准' : '已拒绝')
    fetchApprovals()
  } catch (err: any) {
    approvalStates.value.set(approvalNo, { status: 'pending', loading: false })
    toast.error(err.message || '审批操作失败')
  }
}

// 监听 stream 变化，自动滚动到底部 + 处理审批事件
watch(
  () => stream.value.length,
  () => {
    scheduleScrollToStreamBottom()
    // 审批事件处理：刷新侧边栏 badge + 同步审批卡片状态
    const lastEvent = stream.value[stream.value.length - 1]
    if (!props.isSharedView && lastEvent?.event_type === 'USER_CONFIRM_REQUEST') {
      fetchApprovals()
    }
    if (lastEvent?.event_type === 'USER_CONFIRM_RESOLVED' && lastEvent.data?.approval_no) {
      approvalStates.value.set(lastEvent.data.approval_no, {
        status: lastEvent.data.decision || 'resolved',
        loading: false
      })
      if (!props.isSharedView) {
        fetchApprovals()
      }
    }
  }
)

/**
 * 协议映射助手 (Protocol Mapping Helpers)
 * 将 EventEnvelope 映射至原有的 UI 展示 Slot
 *
 * 事件类型分类：
 * - 会话级: SESSION_START, SESSION_END
 * - 任务级: TASK_ASSIGNED, TASK_COMPLETED, TASK_FAILED
 * - 工具级: TOOL_CALL, TOOL_RESULT, TOOL_ERROR
 * - 安全级: SECURITY_ALLOW, SECURITY_DENY
 * - 系统级: CONFIG_LOADED, SECURITY_LOADED, SKILLS_LOADED, MCP_LOADED, ERROR
 * - 思考级: THINKING
 * - AI 响应级: ASSISTANT_TEXT
 * - Worker 生命周期: WORKER_IDLE_TIMEOUT, WORKER_STOP
 * - 工作目录级: WORKSPACE_INITIALIZED, WORKSPACE_PREPARED, WORKSPACE_ARCHIVED, WORKSPACE_CLEANED
 */
// 系统初始化事件类型集合 (这些事件会被折叠为一个摘要卡片)
const SYSTEM_INIT_TYPES = new Set([
  'TASK_CREATED', 'TASK_STARTED', 'TASK_ASSIGNED', 'TASK_OUTPUT_ESTIMATED', 'SESSION_START', 'CONFIG_LOADED',
  'SECURITY_LOADED', 'SKILLS_LOADED', 'MCP_LOADED',
  'WORKSPACE_INITIALIZED', 'WORKSPACE_PREPARED'
])

// 系统结束事件类型集合 (这些事件会被折叠为一个完成摘要卡片)
const SYSTEM_END_TYPES = new Set(['SESSION_END', 'TASK_COMPLETED', 'WORKER_STOP', 'WORKER_IDLE_TIMEOUT'])

// 文件操作工具集合 (TOOL_RESULT 在 TOOL_CALL 之后折叠)
const FILE_OP_TOOLS = new Set(['Write', 'Read', 'StrReplace', 'Edit'])
const SKILL_EVENT_TYPES = new Set(['SKILL_SELECTED', 'SKILL_REFERENCED', 'SKILL_USAGE_SUMMARY'])
const ASYNC_TOOL_NAMES = new Set(['websearch', 'webfetch', 'skill'])
const TASK_CONTROL_TOOL_NAMES = new Set(['taskoutput', 'taskstop'])
const TASK_AGENT_TOOL_NAMES = new Set(['task'])
const IMPLICIT_SKILL_NAMES = new Set(['default'])
const TERMINAL_TOOL_NAMES = new Set(['bash', 'shell', 'zz'])
const TERMINAL_COLLAPSE_TOTAL_LINES = 2
const terminalExpandedByIndex = ref<Record<number, boolean>>({})
const ASK_USER_TOOL_NAMES = new Set(['askuserquestion'])
const GIT_WORKFLOW_EVENT_TYPES = new Set([
  'GIT_PRE_START',
  'GIT_PRE_DONE',
  'GIT_PRE_FAILED',
  'GIT_POST_START',
  'GIT_POST_DONE',
  'GIT_POST_FAILED'
])

const normalizeToolName = (name: unknown): string => String(name || '').trim().toLowerCase()
const toPositiveInt = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}
const formatGitRepoCount = (data: any): string => {
  const repos = toPositiveInt(data?.repos)
  return repos > 0 ? `（${repos} 个仓库）` : ''
}
const getEventTypeLabel = (event: any): string => {
  const type = String(event?.event_type || '')
  if (type.startsWith('GIT_PRE_')) return 'Git 预处理'
  if (type.startsWith('GIT_POST_')) return 'Git 回写'
  return type
}
const isAsyncToolEvent = (event: any): boolean => {
  if (!event || !['TOOL_CALL', 'TOOL_RESULT', 'TOOL_ERROR'].includes(event.event_type)) return false
  if (event?.data?.source === 'mcp') return false
  return ASYNC_TOOL_NAMES.has(normalizeToolName(event?.data?.tool_name))
}

const toStringList = (value: unknown): string[] => {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) {
    return value
      .map(v => String(v ?? '').trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try {
        return toStringList(JSON.parse(raw))
      } catch {
        // fallback to split by separators
      }
    }
    return raw
      .split(/[,\n;|]/)
      .map(item => item.trim())
      .filter(Boolean)
  }
  return value
    .toString()
    .split(/[,\n;|]/)
    .map(v => String(v ?? '').trim())
    .filter(Boolean)
}

const sanitizeSkillNames = (value: unknown): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of toStringList(value)) {
    const name = raw.trim()
    if (!name) continue
    if (IMPLICIT_SKILL_NAMES.has(name.toLowerCase())) continue
    const dedupeKey = name.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    result.push(name)
  }
  return result
}

const getReferencedSkillNamesFromEvent = (data: any): string[] => {
  if (!data || typeof data !== 'object') return []
  const collected: string[] = []
  collected.push(...sanitizeSkillNames(data.referenced_skills))
  collected.push(...sanitizeSkillNames(data.referencedSkills))
  collected.push(...sanitizeSkillNames(data.used_skills))
  collected.push(...sanitizeSkillNames(data.usedSkills))
  collected.push(...sanitizeSkillNames(data.hit_skills))
  collected.push(...sanitizeSkillNames(data.hitSkills))

  const directName = String(data.skill_name || data.skillName || '').trim()
  if (directName) collected.push(directName)

  const summaryName = String(data.summary?.skill_name || data.summary?.skillName || '').trim()
  if (summaryName) collected.push(summaryName)

  const filePath = String(data.file_path || data.filePath || '').trim().replace(/\\/g, '/')
  if (filePath) {
    const match = filePath.match(/\/\.claude\/skills\/([^/]+)\//)
    if (match?.[1]) collected.push(match[1])
  }

  return sanitizeSkillNames(collected)
}

const resolveReferencedSkillCount = (data: any, names: string[]): number => {
  const countCandidates = [
    data?.referenced_skills_count,
    data?.referencedSkillsCount,
    data?.referenced_count,
    data?.referencedCount,
    data?.used_skills_count,
    data?.usedSkillsCount,
    data?.summary?.referenced_skills_count,
    data?.summary?.referencedSkillsCount
  ]
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value >= 0)

  const explicitCount = countCandidates.length > 0 ? Math.max(...countCandidates) : 0
  return Math.max(names.length, explicitCount)
}

const formatDurationLabel = (value: unknown): string => {
  const ms = Number(value)
  if (!Number.isFinite(ms) || ms <= 0) return ''
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

const truncateText = (value: unknown, max = 160): string => {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > max ? `${text.slice(0, max)}...` : text
}

const formatToolResultPreview = (value: unknown, max = 220): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.length > max ? `${value.slice(0, max)}...` : value
  if (typeof value === 'object') {
    try {
      const serialized = JSON.stringify(value)
      return serialized.length > max ? `${serialized.slice(0, max)}...` : serialized
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const formatCommandPreview = (value: unknown, max = 96): string => {
  if (value === null || value === undefined) return ''
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized
}

const getTaskToolPayload = (data: any): Record<string, any> => {
  const raw = data?.response ?? data?.result ?? data?.tool_response
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  const parsed = safeParseInput(raw)
  return parsed || {}
}

const getTaskToolCallText = (toolName: string, input: Record<string, any> | null): string | null => {
  const normalized = normalizeToolName(toolName)
  if (!TASK_CONTROL_TOOL_NAMES.has(normalized)) return null

  const taskId = input?.task_id || input?.taskId || input?.id || ''
  if (normalized === 'taskoutput') {
    return taskId ? `查询任务输出: ${taskId}` : '查询任务输出'
  }
  if (normalized === 'taskstop') {
    return taskId ? `停止任务: ${taskId}` : '停止任务'
  }
  return null
}

const getTaskToolResultText = (data: any): string | null => {
  const toolName = String(data?.tool_name || '')
  const normalized = normalizeToolName(toolName)
  if (!TASK_CONTROL_TOOL_NAMES.has(normalized)) return null

  const payload = getTaskToolPayload(data)
  if (normalized === 'taskoutput') {
    const task = (payload?.task && typeof payload.task === 'object') ? payload.task : {}
    const taskId = task?.task_id || task?.taskId || task?.id || payload?.task_id || payload?.taskId || ''
    const status = task?.status || payload?.status || ''
    const retrievalStatus = payload?.retrieval_status || payload?.retrievalStatus || ''
    const taskType = task?.task_type || task?.taskType || payload?.task_type || ''
    const command = formatCommandPreview(task?.description || task?.command || payload?.description || payload?.command)

    const details: string[] = []
    if (status) details.push(`状态=${status}`)
    if (retrievalStatus) details.push(`拉取=${retrievalStatus}`)
    if (taskType) details.push(`类型=${taskType}`)

    const head = taskId ? `任务输出: ${taskId}` : '任务输出查询完成'
    return `${head}${details.length ? `（${details.join('，')}）` : ''}${command ? `，命令: ${command}` : ''}`
  }

  if (normalized === 'taskstop') {
    const taskId = payload?.task_id || payload?.taskId || data?.task_id || data?.taskId || ''
    const status = payload?.status || data?.status || ''
    const msg = String(payload?.message || data?.message || '').split('(')[0].trim()
    const head = taskId ? `任务已停止: ${taskId}` : '任务停止完成'
    const details = status ? `（${status}）` : ''
    return `${head}${details}${msg ? `，${msg}` : ''}`
  }

  return null
}

const getAgentTaskResultText = (data: any): string | null => {
  const normalized = normalizeToolName(data?.tool_name)
  if (!TASK_AGENT_TOOL_NAMES.has(normalized)) return null

  const payload = getTaskToolPayload(data)
  const source = Object.keys(payload || {}).length > 0 ? payload : (data || {})
  const status = String(source?.status || data?.status || '').trim().toLowerCase()
  const duration = formatDurationLabel(
    source?.totalDurationMs
    || source?.total_duration_ms
    || source?.duration_ms
    || data?.totalDurationMs
    || data?.total_duration_ms
    || data?.duration_ms
  )
  const totalTokens = Number(
    source?.totalTokens
    || source?.total_tokens
    || source?.usage?.output_tokens
    || source?.usage?.total_tokens
    || data?.totalTokens
    || data?.total_tokens
    || data?.usage?.output_tokens
    || data?.usage?.total_tokens
    || 0
  )
  const toolUseCount = Number(
    source?.totalToolUseCount
    || source?.total_tool_use_count
    || data?.totalToolUseCount
    || data?.total_tool_use_count
    || 0
  )
  const agentId = String(source?.agentId || source?.agent_id || data?.agentId || data?.agent_id || '').trim()
  const hasError = Boolean(
    source?.error
    || source?.error_message
    || source?.errorMessage
    || data?.error
    || data?.error_message
    || data?.errorMessage
  )

  const details: string[] = []
  if (status) details.push(`状态=${status}`)
  if (duration) details.push(`耗时=${duration}`)
  if (totalTokens > 0) details.push(`Tokens=${totalTokens}`)
  if (toolUseCount > 0) details.push(`工具调用=${toolUseCount}`)
  if (agentId) details.push(`Agent=${agentId}`)

  const successStatuses = new Set(['completed', 'success', 'succeeded', 'done'])
  const failedStatuses = new Set(['failed', 'error', 'cancelled', 'canceled', 'aborted', 'timeout', 'timed_out'])
  const runningStatuses = new Set(['running', 'pending', 'queued', 'in_progress'])
  const head = hasError || failedStatuses.has(status)
    ? 'Task 执行失败'
    : successStatuses.has(status)
      ? 'Task 执行完成'
      : runningStatuses.has(status)
        ? 'Task 执行中'
        : 'Task 执行结果'
  return `${head}${details.length ? `（${details.join('，')}）` : ''}`
}

const isAskUserToolEvent = (event: any): boolean => {
  if (!event || !['TOOL_CALL', 'TOOL_RESULT'].includes(event.event_type)) return false
  const data = event?.data || {}
  if (ASK_USER_TOOL_NAMES.has(normalizeToolName(data.tool_name))) return true

  if (event.event_type === 'TOOL_CALL') {
    const input = safeParseInput(data.tool_input)
    return Boolean(Array.isArray(input?.questions) || input?.question)
  }

  const payload = getTaskToolPayload(data)
  return Boolean(Array.isArray(payload?.questions) || payload?.question)
}

const getAskUserCardModel = (event: any) => {
  const data = event?.data || {}
  const type = event?.event_type
  const payload = type === 'TOOL_CALL'
    ? (safeParseInput(data.tool_input) || {})
    : getTaskToolPayload(data)

  const rawQuestions = Array.isArray(payload?.questions)
    ? payload.questions
    : (payload?.question
      ? [{ question: payload.question, header: payload.header, options: payload.options, id: payload.id }]
      : [])

  const answers = (payload?.answers && typeof payload.answers === 'object') ? payload.answers : {}
  const questions = rawQuestions.map((item: any, index: number) => {
    const id = item?.id || `q_${index + 1}`
    const answerRaw = answers[id] ?? item?.answer
    const answer = Array.isArray(answerRaw)
      ? answerRaw.map((entry: any) => String(entry || '')).filter(Boolean).join(' / ')
      : (answerRaw ? String(answerRaw) : '')

    const options = Array.isArray(item?.options)
      ? item.options.map((opt: any) => {
          if (typeof opt === 'string') return { label: opt, description: '' }
          return {
            label: String(opt?.label || ''),
            description: String(opt?.description || '')
          }
        }).filter((opt: any) => opt.label)
      : []

    return {
      id,
      header: String(item?.header || `问题 ${index + 1}`),
      question: String(item?.question || ''),
      options,
      multiSelect: Boolean(item?.multiSelect),
      answer
    }
  })

  const answeredCount = questions.filter((q: any) => Boolean(q.answer)).length
  const summary = answeredCount > 0
    ? `已回答 ${answeredCount}/${questions.length || 0}`
    : (type === 'TOOL_CALL' ? '等待用户回答' : '尚未作答')

  return {
    title: '用户提问',
    summary,
    questions
  }
}

const sanitizeAssistantText = (raw: string): string => {
  if (!raw) return ''
  let text = raw
  text = text.replace(/^Base directory for this skill:\s*(.+)$/gmi, (_line, path) => {
    const cleanPath = String(path || '').trim().replace(/\\/g, '/')
    const skillName = cleanPath.split('/').filter(Boolean).pop() || 'unknown-skill'
    return `Skill 目录已加载: ${skillName}`
  })
  return text
}

const resolveSkillMode = (event: any): string => {
  const modeFromEvent = String(event?.data?.mode || '').trim()
  if (modeFromEvent) return modeFromEvent
  // 兼容旧版 SKILL_USAGE_SUMMARY（无 mode 字段），回看最近一次 SKILL_SELECTED
  for (let i = stream.value.length - 1; i >= 0; i -= 1) {
    const item = stream.value[i]
    if (item?.event_type !== 'SKILL_SELECTED') continue
    const mode = String(item?.data?.mode || '').trim()
    if (mode) return mode
  }
  return 'none'
}

const getSkillCardModel = (event: any) => {
  const type = event?.event_type
  const data = event?.data || {}
  const mode = resolveSkillMode(event)
  const isClaudeNative = mode === 'claude_native'
  const loadedFromStream = Array.from(new Set(
    stream.value
      .filter((e: any) => e?.event_type === 'SKILLS_LOADED')
      .flatMap((e: any) => sanitizeSkillNames(e?.data?.skills || e?.data?.skills_names))
  ))
  const observedSkillCalls = Array.from(new Set(
    stream.value
      .filter((e: any) => e?.event_type === 'TOOL_CALL' && normalizeToolName(e?.data?.tool_name) === 'skill')
      .map((e: any) => {
        const input = safeParseInput(e?.data?.tool_input)
        return String(input?.commandName || input?.name || input?.skill_name || '').trim()
      })
      .filter(Boolean)
  ))
    .filter((name) => !IMPLICIT_SKILL_NAMES.has(name.toLowerCase()))
  const observedReferenced = Array.from(new Set(
    stream.value
      .filter((e: any) => e?.event_type === 'SKILL_REFERENCED')
      .flatMap((e: any) => getReferencedSkillNamesFromEvent(e?.data || {}))
  ))
  const loaded = sanitizeSkillNames(data.loaded_skills)
  const loadedSkills = loaded.length > 0 ? loaded : loadedFromStream
  const selectedRaw = sanitizeSkillNames(data.selected_skills)
  const selected = isClaudeNative ? [] : selectedRaw
  const required = sanitizeSkillNames(data.required_skills)
  const suggested = sanitizeSkillNames(data.suggested_skills)
  const referencedRaw = getReferencedSkillNamesFromEvent(data)
  const referencedByEvents = referencedRaw.length > 0
    ? referencedRaw
    : (observedReferenced.length > 0 ? observedReferenced : observedSkillCalls)
  const referenced = referencedByEvents.length > 0
    ? referencedByEvents
    : (isClaudeNative ? loadedSkills : [])
  const referencedCount = resolveReferencedSkillCount(data, referenced)
  const missingSelectedRaw = sanitizeSkillNames(data.missing_selected_skills)
  const missingSelected = isClaudeNative ? [] : missingSelectedRaw
  const missingRequiredRaw = sanitizeSkillNames(data.missing_required_skills)
  const missingRequired = isClaudeNative ? [] : missingRequiredRaw
  const inferredReferenced = Array.from(new Set([...observedReferenced, ...observedSkillCalls]))
  const precisionHint = referencedRaw.length === 0 && inferredReferenced.length > 0
    ? '观测到 Skill 已被引用，但汇总统计仍为 0（可能为事件统计时机差异）'
    : ''

  if (type === 'SKILL_SELECTED') {
    const modeSubtitle = mode === 'claude_native'
      ? ''
      : mode === 'none'
        ? (observedSkillCalls.length > 0 ? '本轮未强制选择 Skill（执行中有手动调用）' : '本轮未强制选择 Skill')
        : `选择模式: ${mode}`
    return {
      title: 'Skill 选择结果',
      subtitle: modeSubtitle,
      loadedCount: loadedSkills.length,
      loaded: loadedSkills,
      selected,
      required,
      suggested,
      referenced: [],
      missing: [],
      precisionHint: ''
    }
  }

  if (type === 'SKILL_USAGE_SUMMARY') {
    const missingTotal = missingSelected.length + missingRequired.length
    return {
      title: 'Skill 使用总结',
      subtitle: isClaudeNative
        ? `引用 ${referencedCount} 个`
        : `引用 ${referencedCount} 个，缺失 ${missingTotal} 个`,
      loadedCount: undefined,
      loaded: loadedSkills,
      selected,
      required: [],
      suggested: [],
      referenced,
      missing: [...missingSelected, ...missingRequired],
      precisionHint
    }
  }

  return {
    title: 'Skill 事件',
    subtitle: '',
    loadedCount: undefined,
    loaded: loadedSkills,
    selected,
    required,
    suggested,
    referenced,
    missing: [...missingSelected, ...missingRequired],
    precisionHint
  }
}

const getAsyncToolCardModel = (item: any) => {
  const callData = item?.event?.data || {}
  const outcomeEvent = item?.asyncOutcome?.event
  const outcomeData = outcomeEvent?.data || {}
  const toolName = callData.tool_name || 'Tool'
  const input = safeParseInput(callData.tool_input)

  let request = ''
  if (normalizeToolName(toolName) === 'websearch') request = input?.query || ''
  else if (normalizeToolName(toolName) === 'webfetch') request = input?.url || input?.uri || ''
  else if (normalizeToolName(toolName) === 'skill') request = input?.commandName || input?.name || input?.skill_name || ''

  const status: 'running' | 'success' | 'error' = !item?.asyncOutcome
    ? 'running'
    : item.asyncOutcome.status

  let summary = '等待工具返回...'
  if (status === 'error') {
    summary = truncateText(outcomeData.error || outcomeData.error_message || '工具调用失败', 220)
  } else if (status === 'success') {
    const raw = outcomeData.response ?? outcomeData.tool_response ?? outcomeData.result
    const parsed = typeof raw === 'string' ? safeParseInput(raw) : (raw || {})
    if (normalizeToolName(toolName) === 'skill') {
      const commandName = parsed?.commandName || parsed?.name || request
      summary = commandName ? `Skill 已执行: ${commandName}` : 'Skill 已执行'
    } else if (normalizeToolName(toolName) === 'websearch') {
      const results = Array.isArray(parsed?.results) ? parsed.results : []
      if (results.length > 0) {
        summary = `返回 ${results.length} 条结果`
      } else {
        summary = truncateText(raw, 220) || '搜索已完成'
      }
    } else if (normalizeToolName(toolName) === 'webfetch') {
      summary = truncateText(parsed?.content || raw, 220) || '抓取已完成'
    } else {
      summary = truncateText(raw, 220) || '工具执行完成'
    }
  }

  const durationMs = Number(outcomeData.duration_ms || 0)
  const durationSeconds = Number(outcomeData.durationSeconds || 0)

  return {
    toolName,
    request,
    status,
    summary,
    durationLabel: durationMs > 0
      ? `${durationMs}ms`
      : durationSeconds > 0
        ? `${durationSeconds.toFixed(1)}s`
        : ''
  }
}

// 判断事件是否为文件操作工具 (TASK-FE-273)
const isFileOpTool = (event: any): boolean => {
  return FILE_OP_TOOLS.has(event?.data?.tool_name)
}

// 获取文件操作完成文案 (TASK-FE-273)
const getFileOpCompletionText = (item: any): string => {
  const toolName = item.event?.data?.tool_name
  if (toolName === 'Write') {
    // 检查 response.type 是否为 create
    const resultData = item.toolResult?.data || {}
    const resp = resultData.response || resultData.tool_response || resultData.result
    const parsed = typeof resp === 'object' ? resp : safeParseInput(resp)
    if (parsed?.type === 'create') return '创建完成'
    return '写入完成'
  }
  if (toolName === 'Read') return '读取完成'
  if (toolName === 'StrReplace' || toolName === 'Edit') return '编辑完成'
  return '操作完成'
}

// 提取文件操作的完整路径 (TASK-FE-273)
const getFileOpFullPath = (event: any): string => {
  const input = safeParseInput(event?.data?.tool_input)
  return input?.file_path || input?.path || ''
}

// 判断是否为"任务完成"事件 (TOOL_RESULT + event=task_complete)
const isTaskCompleteEvent = (event: any) => {
  return event.event_type === 'TOOL_RESULT' && event.data?.event === 'task_complete'
}

const getDisplayType = (event: any): 'thinking' | 'terminal' | 'code' | 'diff' | 'ai-response' | 'error' | 'todo' | 'security' | 'system-init' | 'system-end' | 'approval' | 'artifacts' | 'mcp' | 'skill' | 'tool-async' | 'ask-user' => {
  const type = event.event_type
  const data = event.data || {}

  if (SKILL_EVENT_TYPES.has(type)) return 'skill'
  if (isAsyncToolEvent(event)) return 'tool-async'
  if (isAskUserToolEvent(event)) return 'ask-user'

  // 产出物事件 -> 产物卡片
  if (type === 'TASK_OUTPUT_READY' || type === 'TASK_OUTPUT_PATHLIST_READY') return 'artifacts'

  // 审批交互事件 -> 审批卡片
  if (type === 'USER_CONFIRM_REQUEST' || type === 'USER_CONFIRM_RESOLVED') return 'approval'

  // GitLab 授权预检提示
  if (type === 'GITLAB_AUTH_STATUS') {
    return data.level === 'error' ? 'error' : 'thinking'
  }

  // 系统初始化事件 -> 折叠为摘要卡片
  if (SYSTEM_INIT_TYPES.has(type)) return 'system-init'

  // 系统结束事件 -> 折叠为完成卡片
  if (SYSTEM_END_TYPES.has(type)) return 'system-end'
  if (isTaskCompleteEvent(event)) return 'system-end'

  // AI 响应 -> 特殊样式
  if (type === 'ASSISTANT_TEXT') return 'ai-response'

  // 思考过程 -> thinking
  if (type === 'THINKING') return 'thinking'

  // 错误类事件 -> error
  if (['ERROR', 'TOOL_ERROR', 'TASK_FAILED', 'SECURITY_DENY'].includes(type)) return 'error'
  if (GIT_WORKFLOW_EVENT_TYPES.has(type) && type.endsWith('_FAILED')) return 'error'

  // 安全审核通过 -> security 样式
  if (type === 'SECURITY_ALLOW') return 'security'

  // ZZ_RESULT (执行器调度结果) -> terminal 样式展示命令
  if (type === 'ZZ_RESULT') return 'terminal'

  // TodoWrite 工具 -> todo 样式
  if ((type === 'TOOL_CALL' || type === 'TOOL_RESULT') && data.tool_name === 'TodoWrite') return 'todo'

  // TOOL_CALL 需要根据工具类型判断
  if (type === 'TOOL_CALL') {
    const toolName = data.tool_name || ''
    if (data.source === 'mcp') return 'mcp'
    if (toolName === 'Bash' || toolName === 'Shell' || toolName === 'zz') return 'terminal'
    if (toolName === 'Write' || toolName === 'Read') return 'code'
    if (toolName === 'StrReplace' || toolName === 'Edit') return 'diff'
    return 'thinking'
  }

  // 工具结果需要根据工具类型判断
  if (type === 'TOOL_RESULT') {
    if (data.event === 'task_start') return 'thinking'
    if (data.source === 'mcp') return 'mcp'
    if (data.tool_name === 'Bash' || data.tool_name === 'Shell' || data.tool_name === 'zz') return 'terminal'
    // Write/Read/StrReplace/Edit 的 TOOL_RESULT 展示为简洁的完成确认文本 (TASK-FE-272)
    if (FILE_OP_TOOLS.has(data.tool_name)) return 'thinking'
    return 'thinking'
  }

  // 其他事件都归类为 thinking (系统消息)
  return 'thinking'
}

/**
 * 安全解析 tool_input / tool_response
 * 兼容: 标准 JSON / Python 风格字符串 (单引号 dict) / 已是对象
 * 解析失败时返回 null 而非抛异常
 */
const safeParseInput = (raw: any): Record<string, any> | null => {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw !== 'string') return null

  // 1) 先尝试标准 JSON
  try { return JSON.parse(raw) } catch { /* continue */ }

  // 2) Python 风格单引号 → 双引号（安全替换：只替换不在双引号内的单引号）
  try {
    // 先把已经存在的双引号转义保护起来
    // 然后把单引号替换为双引号
    // 但要注意值内部可能含有单引号，所以用正则更精准地匹配 key-value 对
    const cleaned = raw
      .replace(/'/g, '"')        // 单引号 → 双引号
      .replace(/True/g, 'true')  // Python True
      .replace(/False/g, 'false') // Python False
      .replace(/None/g, 'null')  // Python None
    return JSON.parse(cleaned)
  } catch { /* continue */ }

  // 3) 正则提取 file_path / path / command 等常见字段（最后手段）
  const extracted: Record<string, string> = {}
  const patterns: [string, RegExp][] = [
    ['file_path', /['"]?file_path['"]?\s*[:=]\s*['"]([^'"]+)['"]/],
    ['path', /['"]?path['"]?\s*[:=]\s*['"]([^'"]+)['"]/],
    ['command', /['"]?command['"]?\s*[:=]\s*['"]([^'"]+)['"]/],
    ['description', /['"]?description['"]?\s*[:=]\s*['"]([^'"]+)['"]/],
    ['pattern', /['"]?pattern['"]?\s*[:=]\s*['"]([^'"]+)['"]/],
    ['glob_pattern', /['"]?glob_pattern['"]?\s*[:=]\s*['"]([^'"]+)['"]/],
  ]
  for (const [key, re] of patterns) {
    const m = raw.match(re)
    if (m) extracted[key] = m[1]
  }
  return Object.keys(extracted).length > 0 ? extracted : null
}

const getDisplayContent = (event: any) => {
  const data = event.data || {}
  const type = event.event_type

  // ============ 会话级事件 ============
  if (type === 'SESSION_START') {
    return data.message || `Agent 会话已启动 (Worker: ${data.worker_name || 'default'})`
  }
  if (type === 'SESSION_END') {
    const duration = data.duration_ms ? `耗时 ${(data.duration_ms / 1000).toFixed(1)}s` : ''
    const exitCode = data.exit_code !== undefined ? `退出码: ${data.exit_code}` : ''
    return data.message || `Agent 会话已结束 ${duration} ${exitCode}`.trim()
  }

  // ============ 任务级事件 ============
  if (type === 'TASK_ASSIGNED') return `任务已分配: ${data.task_content || ''}`
  if (type === 'TASK_OUTPUT_ESTIMATED') {
    const outputs = Array.isArray(data.estimated_output) ? data.estimated_output : []
    if (outputs.length === 0) {
      return '已完成任务产物预估'
    }
    return `产物预估: ${outputs.join('、')}`
  }
  if (type === 'TASK_COMPLETED') {
    const duration = data.duration_ms ? ` (耗时 ${(data.duration_ms / 1000).toFixed(1)}s)` : ''
    return `任务执行完成${duration}`
  }
  if (type === 'TASK_REPORT_READY') {
    const artifacts = Array.isArray(data.report?.artifacts) ? data.report.artifacts : []
    const artifactText = artifacts.length > 0 ? `，产物 ${artifacts.length} 个` : ''
    return `执行报告已生成${artifactText}，可点击查看报告`
  }
  if (type === 'TASK_FAILED') return `任务执行失败: ${data.error_message || '未知错误'}`
  if (type === 'TASK_OUTPUT_READY') {
    const artifacts = Array.isArray(data.artifacts) ? data.artifacts : []
    return artifacts.length > 0 ? `产出物已就绪 (${artifacts.length} 个文件)` : '产出目录已就绪'
  }
  if (type === 'TASK_OUTPUT_PATHLIST_READY') {
    const pathList = Array.isArray(data.path_list) ? data.path_list : []
    const deliverables = pathList.filter((p: any) => p?.category !== 'intermediate')
    return deliverables.length > 0 ? `工作区变更就绪 (${deliverables.length} 个文件)` : '工作区变更已同步'
  }
  if (type === 'GITLAB_AUTH_STATUS') return data.message || '检测授权状态：执行中'
  if (type === 'TASK_TERMINATE_ENQUEUED') return data.message || '终止请求已提交，等待执行器确认'
  if (type === 'TASK_ABORT_ACK') return data.message || '执行器已收到终止请求，正在中断任务...'
  if (type === 'TASK_ABORTED') return data.message || '任务已终止（执行器已确认）'
  if (type === 'GIT_PRE_START') return `Git 预处理开始${formatGitRepoCount(data)}`
  if (type === 'GIT_PRE_DONE') return `Git 预处理完成${formatGitRepoCount(data)}`
  if (type === 'GIT_PRE_FAILED') return `Git 预处理失败: ${data.error_message || '未知错误'}`
  if (type === 'GIT_POST_START') return `Git 回写开始${formatGitRepoCount(data)}`
  if (type === 'GIT_POST_DONE') return `Git 回写完成${formatGitRepoCount(data)}`
  if (type === 'GIT_POST_FAILED') return `Git 回写失败: ${data.error_message || '未知错误'}`

  // ============ 工具级事件 ============
  if (type === 'TOOL_CALL') {
    if (data.event === 'task_start') return `开始执行任务: ${data.task || ''}`
    const toolName = data.tool_name || ''
    const input = safeParseInput(data.tool_input)
    const taskToolCallText = getTaskToolCallText(toolName, input)
    if (taskToolCallText) return taskToolCallText
    if (isAskUserToolEvent(event)) {
      const model = getAskUserCardModel(event)
      return `${model.title}: ${model.summary}`
    }

    if (isAsyncToolEvent(event)) {
      if (normalizeToolName(toolName) === 'websearch') return `WebSearch：${input?.query || '执行检索'}`
      if (normalizeToolName(toolName) === 'webfetch') return `WebFetch：${input?.url || input?.uri || '抓取页面'}`
      if (normalizeToolName(toolName) === 'skill') return `Skill：${input?.commandName || input?.name || input?.skill_name || '执行'}`
      return `调用工具: ${toolName}`
    }

    // MCP 工具调用：显示服务名 + 工具名 + 参数摘要
    if (data.source === 'mcp') {
      const server = data.mcp_server || ''
      const tool = data.mcp_tool || toolName
      const inputStr = input ? Object.entries(input).map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v)}`).join(', ') : ''
      return `🔌 MCP: ${server} → ${tool}${inputStr ? '\n' + inputStr : ''}`
    }

    // 特殊处理 Bash/Shell 工具：提取 command 和 description
    if (toolName === 'Bash' || toolName === 'Shell' || toolName === 'zz') {
      const cmd = input?.command || ''
      const desc = input?.description || ''
      if (cmd) return desc ? `${desc}\n$ ${cmd}` : `$ ${cmd}`
    }

    // 特殊处理 Write 工具：显示文件路径
    if (toolName === 'Write') {
      const filePath = input?.file_path || input?.path || ''
      if (filePath) {
        const fileName = filePath.split('/').pop() || filePath
        return `📝 创建文件: ${fileName}\n${filePath}`
      }
      return `📝 创建文件`
    }

    // 特殊处理 Read 工具：显示文件路径
    if (toolName === 'Read') {
      const filePath = input?.file_path || input?.path || ''
      if (filePath) {
        const fileName = filePath.split('/').pop() || filePath
        return `📖 读取文件: ${fileName}\n${filePath}`
      }
      return `📖 读取文件`
    }

    // 特殊处理 StrReplace/Edit 工具：显示文件路径
    if (toolName === 'StrReplace' || toolName === 'Edit') {
      const filePath = input?.file_path || input?.path || ''
      if (filePath) {
        const fileName = filePath.split('/').pop() || filePath
        return `✏️ 编辑文件: ${fileName}\n${filePath}`
      }
      return `✏️ 编辑文件`
    }

    // 特殊处理 Glob/Grep/SemanticSearch 工具
    if (toolName === 'Glob') {
      return `🔍 搜索文件: ${input?.pattern || input?.glob_pattern || ''}`
    }
    if (toolName === 'Grep') {
      return `🔎 搜索内容: ${input?.pattern || ''}`
    }

    // 兜底：仅显示工具名，不暴露原始 JSON
    if (toolName) return `调用工具: ${toolName}`
    return data.task || data.message || 'AI 正在思考...'
  }
  if (type === 'TOOL_RESULT') {
    if (data.event === 'task_complete') {
      const cost = data.total_cost_usd ? ` (费用: $${data.total_cost_usd.toFixed(4)})` : ''
      return `任务执行完毕${cost}`
    }
    if (data.event === 'task_start') return `开始执行任务: ${data.task || ''}`
    const taskToolResultText = getTaskToolResultText(data)
    if (taskToolResultText) return taskToolResultText
    const agentTaskResultText = getAgentTaskResultText(data)
    if (agentTaskResultText) return agentTaskResultText
    if (isAskUserToolEvent(event)) {
      const model = getAskUserCardModel(event)
      return `${model.title}: ${model.summary}`
    }

    if (isAsyncToolEvent(event)) {
      const duration = data.duration_ms ? ` (${data.duration_ms}ms)` : ''
      return `${data.tool_name || '工具'} 已完成${duration}`
    }

    // MCP 工具结果
    if (data.source === 'mcp') {
      const server = data.mcp_server || ''
      const tool = data.mcp_tool || data.tool_name || ''
      const resp = data.response || data.tool_response || ''
      const respStr = typeof resp === 'string' ? resp.slice(0, 200) : JSON.stringify(resp).slice(0, 200)
      return `✅ MCP: ${server} → ${tool}\n${respStr}`
    }

    if (data.tool_name === 'Bash' || data.tool_name === 'Shell') {
      // momo-worker 格式: data.response = { stdout, stderr, ... }
      // 旧格式: data.tool_response / data.result (字符串)
      const resp = data.response
      let output = ''
      if (resp && typeof resp === 'object') {
        output = resp.stdout || ''
        if (resp.stderr) output += (output ? '\n' : '') + resp.stderr
      } else {
        output = data.tool_response || data.result || ''
      }
      return `${data.tool_name}\n${output || '(无输出)'}`
    }
    // Write/Read/StrReplace/Edit TOOL_RESULT: 简洁的完成确认卡片 (TASK-FE-272)
    if (data.tool_name === 'Write' || data.tool_name === 'Read') {
      const rawResp = data.response || data.tool_response || data.result || ''
      const parsed = safeParseInput(rawResp)
      let filePath = ''
      if (parsed) {
        filePath = parsed.filePath || parsed.file_path || ''
      }
      // 也尝试从 TOOL_CALL 的 input 中提取 filePath 补充
      if (!filePath) {
        const callInput = safeParseInput(data.tool_input)
        filePath = callInput?.file_path || callInput?.path || ''
      }
      const fileName = filePath ? (filePath.split('/').pop() || filePath) : ''
      if (data.tool_name === 'Write') {
        return fileName ? `✅ 文件写入完成: ${fileName}` : '✅ 文件写入完成'
      }
      return fileName ? `✅ 文件已读取: ${fileName}` : '✅ 文件已读取'
    }
    if (data.tool_name === 'StrReplace' || data.tool_name === 'Edit') {
      const rawResp = data.response || data.tool_response || data.result || ''
      const parsed = safeParseInput(rawResp)
      let filePath = ''
      if (parsed) {
        filePath = parsed.filePath || parsed.file_path || ''
      }
      if (!filePath) {
        const callInput = safeParseInput(data.tool_input)
        filePath = callInput?.file_path || callInput?.path || ''
      }
      const fileName = filePath ? (filePath.split('/').pop() || filePath) : ''
      return fileName ? `✅ 文件已编辑: ${fileName}` : '✅ 文件已编辑'
    }
    const duration = data.duration_ms ? ` (${data.duration_ms}ms)` : ''
    const resultText = data.result || data.tool_response || data.response || ''
    const displayResult = formatToolResultPreview(resultText)
    return `${data.tool_name || '工具'} 执行完成${duration}${displayResult ? `: ${displayResult}` : ''}`
  }
  if (type === 'TOOL_ERROR') {
    if (isAsyncToolEvent(event)) {
      return `${data.tool_name || '工具'} 调用失败: ${data.error || data.error_message || '未知错误'}`
    }
    const toolName = data.tool_name ? `[${data.tool_name}] ` : ''
    return `${toolName}${data.error || data.error_message || '未知错误'}`
  }

  // ============ 安全级事件 ============
  if (type === 'SECURITY_ALLOW') {
    // 简洁展示：安全审核通过 + 工具名
    return `✓ 安全审核通过: ${data.tool_name || '未知工具'}`
  }
  if (type === 'ZZ_RESULT') {
    const cmd = data.command || ''
    return cmd ? `$ ${cmd}` : '$ (命令已提交至执行器)'
  }
  if (type === 'SECURITY_DENY') {
    return `✗ 安全检查拒绝: ${data.reason || '操作被拒绝'} (规则: ${data.rule_id || '-'})`
  }

  // ============ 系统级事件 ============
  if (type === 'CONFIG_LOADED') return `配置已加载: ${data.config_path || 'config.json'}`
  if (type === 'SECURITY_LOADED') return `安全规则已加载: ${data.rules_count || 0} 条`
  if (type === 'SKILLS_LOADED') {
    const skills = sanitizeSkillNames(data.skills || [])
    return `Skills 已加载 (${skills.length}): ${skills.join(', ') || '无'}`
  }
  if (type === 'MCP_LOADED') {
    const servers = data.servers || []
    return `MCP 服务已加载 (${servers.length}): ${servers.join(', ') || '无'}`
  }
  if (type === 'SKILL_SELECTED') {
    const selected = sanitizeSkillNames(data.selected_skills)
    return `Skill 选择完成: ${selected.length > 0 ? selected.join(', ') : '未选择'}`
  }
  if (type === 'SKILL_REFERENCED') {
    const referenced = getReferencedSkillNamesFromEvent(data)
    return `Skill 引用: ${referenced.length > 0 ? referenced.join(', ') : '无'}`
  }
  if (type === 'SKILL_USAGE_SUMMARY') {
    const referencedRaw = getReferencedSkillNamesFromEvent(data)
    const referenced = referencedRaw.length > 0
      ? referencedRaw
      : Array.from(new Set(
          stream.value
            .filter((e: any) => e?.event_type === 'SKILL_REFERENCED')
            .flatMap((e: any) => getReferencedSkillNamesFromEvent(e?.data || {}))
        ))
    const mode = resolveSkillMode(event)
    const loaded = sanitizeSkillNames(data.loaded_skills)
    const referencedForCount = referenced.length > 0 ? referenced : (mode === 'claude_native' ? loaded : [])
    const referencedCount = resolveReferencedSkillCount(data, referencedForCount)
    if (mode === 'claude_native') return `Skill 使用汇总: 引用 ${referencedCount}`
    const missing = [...sanitizeSkillNames(data.missing_selected_skills), ...sanitizeSkillNames(data.missing_required_skills)]
    return `Skill 使用汇总: 引用 ${referencedCount}，缺失 ${missing.length}`
  }
  if (type === 'ERROR') {
    return `系统错误 [${data.error_type || 'UNKNOWN'}]: ${data.message || data.stack_trace || '未知错误'}`
  }

  // ============ 思考级事件 ============
  if (type === 'THINKING') return data.thinking || 'AI 正在思考...'

  // ============ AI 响应级事件 ============
  if (type === 'ASSISTANT_TEXT') return sanitizeAssistantText(data.text || '')

  // ============ Worker 生命周期事件 ============
  if (type === 'WORKER_IDLE_TIMEOUT') return `Worker 空闲超时 (${data.idle_seconds || 0}s)`
  if (type === 'WORKER_STOP') return `Worker 停止: ${data.reason || '正常退出'}`

  // ============ 工作目录级事件 ============
  if (type === 'WORKSPACE_INITIALIZED') return `工作目录已初始化: ${data.workspace_root || ''}`
  if (type === 'WORKSPACE_PREPARED') return `任务目录准备完成: ${data.path || ''}`
  if (type === 'WORKSPACE_ARCHIVED') return `任务目录归档完成: ${data.status || 'done'}`
  if (type === 'WORKSPACE_CLEANED') return `残留目录清理完成: ${data.count || 0} 个`

  // ============ 后端写入的事件类型 ============
  if (type === 'TASK_CREATED') return `任务已创建: ${data.task_no || event.task_no || ''}`
  if (type === 'TASK_STARTED') return '任务开始执行'

  // ============ 兜底 ============
  return data.message || (Object.keys(data).length > 0 ? JSON.stringify(data) : '...')
}

// 解析 TodoWrite 数据
const parseTodoData = (event: any) => {
  const data = event.data || {}
  const type = event.event_type

  try {
    if (type === 'TOOL_CALL') {
      // TOOL_CALL 时 tool_input 可能是字符串或对象
      let input = data.tool_input
      if (typeof input === 'string') {
        // 尝试解析 JSON 字符串
        input = JSON.parse(input.replace(/'/g, '"'))
      }
      return {
        type: 'call',
        todos: input?.todos || []
      }
    } else if (type === 'TOOL_RESULT') {
      // TOOL_RESULT 时可能有 newTodos 或 result
      // momo-worker 格式: data.response.newTodos
      let result = data.response || data.tool_response || data.result
      if (typeof result === 'string') {
        result = JSON.parse(result.replace(/'/g, '"'))
      }
      return {
        type: 'result',
        oldTodos: result?.oldTodos || [],
        newTodos: result?.newTodos || result?.todos || []
      }
    }
  } catch (e) {
    // 解析失败时返回原始数据
  }

  return {
    type: type === 'TOOL_CALL' ? 'call' : 'result',
    todos: [],
    raw: JSON.stringify(data)
  }
}

// 获取 Todo 状态文本
const getTodoStatusText = (status: string) => {
  switch (status) {
    case 'completed': return '完成'
    case 'in_progress': return '进行中'
    case 'pending': return '待处理'
    case 'cancelled': return '已取消'
    default: return status
  }
}

/**
 * 从系统初始化事件组中提取摘要信息
 * 返回结构化数据供模板渲染
 */
const extractInitSummary = (group: any[]) => {
  let taskNo = ''
  let timestamp = ''
  let taskContent = ''
  const skills: string[] = []
  const mcpServers: string[] = []
  let securityRules = 0
  let configPath = ''
  let workspacePath = ''

  for (const evt of group) {
    const d = evt.data || {}
    const t = evt.event_type

    if (!taskNo) {
      taskNo = d.task_no || d.task_id || evt.task_no || evt.task_id || ''
    }
    if (!timestamp && evt.timestamp) {
      timestamp = formatEventTimestamp(evt.timestamp)
    }
    if (t === 'TASK_ASSIGNED') taskContent = d.task_content || ''
    if (t === 'CONFIG_LOADED') configPath = d.config_path || 'config.json'
    if (t === 'SECURITY_LOADED') securityRules = d.rules_count || 0
    if (t === 'SKILLS_LOADED') skills.push(...sanitizeSkillNames(d.skills || []))
    if (t === 'MCP_LOADED') {
      const s = d.servers
      if (Array.isArray(s)) mcpServers.push(...s)
      else if (s && typeof s === 'object') mcpServers.push(...Object.keys(s))
    }
    if (t === 'WORKSPACE_INITIALIZED') workspacePath = d.workspace_root || ''
    if (t === 'WORKSPACE_PREPARED') workspacePath = workspacePath || d.path || ''
  }

  return { taskNo, timestamp, taskContent, skills: sanitizeSkillNames(skills), mcpServers, securityRules, configPath, workspacePath, count: group.length }
}

/**
 * 从系统结束事件组中提取完成摘要
 */
const extractEndSummary = (group: any[]) => {
  let timestamp = ''
  let durationMs = 0
  let costUsd = 0
  let exitCode: number | undefined

  for (const evt of group) {
    const d = evt.data || {}
    const t = evt.event_type
    if (!timestamp && evt.timestamp) {
      timestamp = formatEventTimestamp(evt.timestamp)
    }
    if (isTaskCompleteEvent(evt)) {
      costUsd = d.total_cost_usd || 0
    }
    if (t === 'SESSION_END') {
      durationMs = d.duration_ms || 0
      exitCode = d.exit_code
    }
  }

  const durationStr = durationMs > 0
    ? durationMs >= 60000
      ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
      : `${(durationMs / 1000).toFixed(1)}s`
    : ''

  return { timestamp, durationStr, costUsd, exitCode, count: group.length }
}

/**
 * 合并连续的 Todo 事件 + 系统初始化/结束事件
 * - TOOL_CALL (TodoWrite) 总是隐藏，只显示对应的 TOOL_RESULT
 * - 连续的 TOOL_RESULT (TodoWrite) 只保留最后一个
 * - 连续的系统初始化事件折叠为一个摘要节点
 * - 连续的系统结束事件折叠为一个完成摘要节点
 */
const isCompletionEvent = (event: any): boolean => {
  const type = event?.event_type
  if (['TASK_COMPLETED', 'TASK_FAILED', 'TASK_ABORTED', 'SESSION_END', 'WORKER_STOP', 'WORKER_IDLE_TIMEOUT'].includes(type)) {
    return true
  }
  return type === 'TOOL_RESULT' && event?.data?.event === 'task_complete'
}

const isExecutionFinished = computed(() => {
  const status = profile.value?.status
  if (status && ['completed', 'failed', 'aborted'].includes(status)) {
    return true
  }
  return stream.value.some(isCompletionEvent)
})

const showRunningIndicator = computed(() => {
  const inRunningState = isRunning.value || profile.value?.status === 'running' || profile.value?.status === 'pending'
  return inRunningState && !isExecutionFinished.value
})

const processedStream = computed(() => {
  const result: Array<{
    event: any; isTodoMerged: boolean;
    toolResult?: any;
    asyncOutcome?: { status: 'success' | 'error'; event: any };
    initGroup?: any[]; initSummary?: ReturnType<typeof extractInitSummary>;
    endGroup?: any[]; endSummary?: ReturnType<typeof extractEndSummary>;
  }> = []
  const hasSkillUsageSummary = stream.value.some((evt: any) => evt?.event_type === 'SKILL_USAGE_SUMMARY')

  let i = 0
  while (i < stream.value.length) {
    const currentEvent = stream.value[i]

    // ---- 系统初始化事件折叠 ----
    if (getDisplayType(currentEvent) === 'system-init') {
      const group: any[] = []
      while (i < stream.value.length && getDisplayType(stream.value[i]) === 'system-init') {
        group.push(stream.value[i])
        i++
      }
      result.push({
        event: group[0],
        isTodoMerged: false,
        initGroup: group,
        initSummary: extractInitSummary(group)
      })
      for (let j = 1; j < group.length; j++) {
        result.push({ event: group[j], isTodoMerged: true })
      }
      continue
    }

    // ---- 系统结束事件折叠 ----
    if (getDisplayType(currentEvent) === 'system-end') {
      const group: any[] = []
      while (i < stream.value.length && getDisplayType(stream.value[i]) === 'system-end') {
        group.push(stream.value[i])
        i++
      }
      result.push({
        event: group[0],
        isTodoMerged: false,
        endGroup: group,
        endSummary: extractEndSummary(group)
      })
      for (let j = 1; j < group.length; j++) {
        result.push({ event: group[j], isTodoMerged: true })
      }
      continue
    }

    // ---- Todo 事件全部隐藏（已由右侧悬浮面板展示）----
    let shouldHide = false

    // ---- 异步工具回填（WebSearch/WebFetch/Skill）----
    if (isAsyncToolEvent(currentEvent) && currentEvent.event_type !== 'TOOL_CALL') {
      const currentTool = normalizeToolName(currentEvent.data?.tool_name)
      for (let j = 0; j < result.length; j++) {
        const prevItem = result[j]
        if (prevItem.isTodoMerged || prevItem.asyncOutcome) continue
        if (prevItem.event?.event_type !== 'TOOL_CALL') continue
        if (!isAsyncToolEvent(prevItem.event)) continue
        if (normalizeToolName(prevItem.event?.data?.tool_name) !== currentTool) continue

        prevItem.asyncOutcome = {
          status: currentEvent.event_type === 'TOOL_ERROR' ? 'error' : 'success',
          event: currentEvent
        }
        shouldHide = true
        break
      }
    }

    // ---- Todo 事件全部隐藏（已由右侧悬浮面板展示）----
    const currentIsTodo = getDisplayType(currentEvent) === 'todo'
    const currentIsTodoAllow = currentEvent.event_type === 'SECURITY_ALLOW' && currentEvent.data?.tool_name === 'TodoWrite'
    if (currentIsTodo || currentIsTodoAllow) {
      shouldHide = true
    }

    // ---- SECURITY_ALLOW 默认隐藏 ----
    // SECURITY_ALLOW 对用户价值不大，默认隐藏（SECURITY_DENY 归类为 error 不受影响）
    if (currentEvent.event_type === 'SECURITY_ALLOW' && !shouldHide) {
      shouldHide = true
    }

    // ---- TOOL_RESULT (Write/Read/StrReplace/Edit) 隐藏并合并到前一个 TOOL_CALL 卡片 (TASK-FE-273) ----
    if (currentEvent.event_type === 'TOOL_RESULT' && FILE_OP_TOOLS.has(currentEvent.data?.tool_name) && !shouldHide) {
      // 向前查找最近的可见 TOOL_CALL item，tool_name 匹配
      for (let j = result.length - 1; j >= Math.max(0, result.length - 10); j--) {
        const prevItem = result[j]
        if (prevItem.isTodoMerged) continue
        if (prevItem.event.event_type === 'TOOL_CALL' && prevItem.event.data?.tool_name === currentEvent.data?.tool_name) {
          prevItem.toolResult = currentEvent
          break
        }
      }
      shouldHide = true
    }

    // ---- 终止事件去重 ----
    // 当"终止请求已提交"后紧邻"任务已终止"时，只保留后者
    const nextEvent = stream.value[i + 1]
    if (currentEvent.event_type === 'TASK_TERMINATE_ENQUEUED'
      && (nextEvent?.event_type === 'TASK_ABORT_ACK' || nextEvent?.event_type === 'TASK_ABORTED')) {
      shouldHide = true
    }

    // ---- ASSISTANT_TEXT 去重 ----
    // 当 ASSISTANT_TEXT 紧跟 TOOL_RESULT/TOOL_CALL 且内容是工具输出的重复时，隐藏
    if (currentEvent.event_type === 'ASSISTANT_TEXT' && result.length > 0) {
      const prevVisible = result.filter(r => !r.isTodoMerged).pop()
      const text = (currentEvent.data?.text || (currentEvent as any).text || '').trim()
      const stripped = text.replace(/^```[\w]*\n?/gm, '').replace(/```\s*$/gm, '').trim()

      if (stripped && prevVisible) {
        // 收集最近的 TOOL_RESULT 和 TOOL_CALL 数据用于对比
        // 向前搜索最近的 TOOL_RESULT（可能被隐藏了）和 TOOL_CALL
        let recentToolResult: any = null
        let recentToolCall: any = null
        for (let j = result.length - 1; j >= 0 && j >= result.length - 5; j--) {
          const evt = result[j].event
          if (!recentToolResult && evt.event_type === 'TOOL_RESULT') recentToolResult = evt
          if (!recentToolCall && evt.event_type === 'TOOL_CALL') recentToolCall = evt
          if (recentToolResult && recentToolCall) break
        }

        // 从 TOOL_RESULT 提取可比较的输出内容
        const outputParts: string[] = []
        if (recentToolResult) {
          const prevData = recentToolResult.data || {}
          const resp = prevData.response
          if (resp && typeof resp === 'object') {
            // Bash/Shell 格式: { stdout, stderr }
            if (resp.stdout) outputParts.push(resp.stdout)
            if (resp.stderr) outputParts.push(resp.stderr)
            // Write/Read 格式: { content, filePath }
            if (resp.content) outputParts.push(resp.content)
            if (resp.filePath) outputParts.push(resp.filePath)
          }
          if (prevData.tool_response) outputParts.push(typeof prevData.tool_response === 'string' ? prevData.tool_response : '')
          if (prevData.result) outputParts.push(typeof prevData.result === 'string' ? prevData.result : '')
        }

        // 从 TOOL_CALL 提取文件路径（Write/Read 等工具）
        if (recentToolCall) {
          const callInput = safeParseInput(recentToolCall.data?.tool_input)
          if (callInput) {
            const fp = callInput.file_path || callInput.path || ''
            if (fp) outputParts.push(fp)
          }
        }

        // 逐项检查：如果 ASSISTANT_TEXT 的文本包含了任何工具输出内容，则视为重复
        const validOutputs = outputParts.filter(o => typeof o === 'string' && o.trim().length > 0).map(o => o.trim())
        for (const output of validOutputs) {
          if (output.includes(stripped) || stripped.includes(output)) {
            shouldHide = true
            break
          }
        }
      }
    }

    // ---- USER_CONFIRM_RESOLVED 去重 ----
    // 当同一审批的 REQUEST 已在流中展示时，隐藏 RESOLVED（REQUEST 卡片已通过 approvalStates 展示结果）
    if (currentEvent.event_type === 'USER_CONFIRM_RESOLVED') {
      const resolvedNo = currentEvent.data?.approval_no
      if (resolvedNo) {
        const hasRequest = stream.value.some(
          (e: any) => e.event_type === 'USER_CONFIRM_REQUEST' && e.data?.approval_no === resolvedNo
        )
        if (hasRequest) shouldHide = true
      }
    }

    // ---- Skill 引用事件降噪 ----
    if (currentEvent.event_type === 'SKILL_REFERENCED') {
      if (hasSkillUsageSummary) {
        const currentReferenced = getReferencedSkillNamesFromEvent(currentEvent?.data || {})
        if (currentReferenced.length === 0) {
          shouldHide = true
        }
      } else {
        const prevVisible = [...result].reverse().find((item) => !item.isTodoMerged)?.event
        if (prevVisible?.event_type === 'SKILL_REFERENCED') {
          const currentSignature = JSON.stringify({
            loaded: sanitizeSkillNames(currentEvent?.data?.loaded_skills),
            referenced: getReferencedSkillNamesFromEvent(currentEvent?.data || {})
          })
          const prevSignature = JSON.stringify({
            loaded: sanitizeSkillNames(prevVisible?.data?.loaded_skills),
            referenced: getReferencedSkillNamesFromEvent(prevVisible?.data || {})
          })
          if (currentSignature === prevSignature) {
            shouldHide = true
          }
        }
      }
    }

    result.push({
      event: currentEvent,
      isTodoMerged: shouldHide
    })
    i++
  }

  return result
})

const showStartupLoading = computed(() => {
  if (isExecutionFinished.value) return false

  const status = profile.value?.status
  const hasVisibleEvent = processedStream.value.some((item) => !item.isTodoMerged)
  if (hasVisibleEvent) return false

  if (status === 'pending') return true
  // 兼容任务刚创建、状态尚未回填前的短暂 running 态
  return status === 'running' && stream.value.length === 0
})

const getTerminalLines = (event: any): string[] => {
  const content = getDisplayContent(event)
  return String(content || '').split('\n')
}

const hasTerminalOutcome = (index: number): boolean => {
  const current = processedStream.value[index]
  if (!current || current.isTodoMerged) return false
  const currentEvent = current.event
  if (currentEvent?.event_type !== 'TOOL_CALL') return false

  const currentTool = normalizeToolName(currentEvent?.data?.tool_name)
  if (!TERMINAL_TOOL_NAMES.has(currentTool)) return false

  for (let i = index + 1; i < processedStream.value.length; i++) {
    const nextEvent = processedStream.value[i]?.event
    if (!nextEvent) continue
    const nextType = nextEvent.event_type
    const nextTool = normalizeToolName(nextEvent?.data?.tool_name)

    if (nextType === 'TOOL_CALL' && TERMINAL_TOOL_NAMES.has(nextTool)) {
      return false
    }

    if ((nextType === 'TOOL_RESULT' || nextType === 'TOOL_ERROR') && nextTool === currentTool) {
      return true
    }
  }
  return false
}

const isTerminalAutoCollapsible = (item: any, index: number): boolean => {
  if (getDisplayType(item?.event) !== 'terminal') return false
  if (getTerminalLines(item.event).length <= TERMINAL_COLLAPSE_TOTAL_LINES) return false
  const eventType = item?.event?.event_type

  // TOOL_CALL 保持“执行完成后再折叠”的语义，避免运行中命令被过早折叠
  if (eventType === 'TOOL_CALL') {
    return hasTerminalOutcome(index)
  }

  // ZZ_RESULT / TOOL_RESULT 视为已落定消息，长内容直接折叠
  if (eventType === 'ZZ_RESULT' || eventType === 'TOOL_RESULT') {
    return true
  }

  return false
}

const isTerminalCollapsed = (item: any, index: number): boolean => {
  if (!isTerminalAutoCollapsible(item, index)) return false
  return !terminalExpandedByIndex.value[index]
}

const toggleTerminalCollapse = (index: number) => {
  terminalExpandedByIndex.value[index] = !terminalExpandedByIndex.value[index]
}

const getTerminalBodyLines = (item: any, index: number): string[] => {
  const bodyLines = getTerminalLines(item?.event).slice(1)
  if (!isTerminalCollapsed(item, index)) return bodyLines
  return bodyLines.slice(0, Math.max(TERMINAL_COLLAPSE_TOTAL_LINES - 1, 0))
}

const getTerminalHiddenLineCount = (item: any, index: number): number => {
  const bodyLines = getTerminalLines(item?.event).slice(1)
  if (!isTerminalCollapsed(item, index)) return 0
  const visibleBodyLines = Math.max(TERMINAL_COLLAPSE_TOTAL_LINES - 1, 0)
  return Math.max(bodyLines.length - visibleBodyLines, 0)
}

// 检测 markdown 内容是否包含表格
const hasMarkdownTable = (content: string): boolean => {
  return /\|[^\n]+\|\n\|[-:\s|]+\|/m.test(content || '')
}

// 计算节点状态
const getNodeStatus = (event: any): 'completed' | 'running' | 'error' | 'pending' => {
  const type = event.event_type
  if (['TOOL_ERROR', 'TASK_FAILED', 'ERROR', 'SECURITY_DENY'].includes(type)) return 'error'
  return 'completed'
}

const getTimelineStatus = (item: { event: any; asyncOutcome?: { status: 'success' | 'error'; event: any } }): 'completed' | 'running' | 'error' | 'pending' => {
  if (item?.event?.event_type === 'TOOL_CALL' && isAsyncToolEvent(item.event)) {
    if (!item.asyncOutcome) return 'running'
    return item.asyncOutcome.status === 'error' ? 'error' : 'completed'
  }
  return getNodeStatus(item.event)
}

// 节点状态样式 (Timeline Dots) - 跟随全局 theme 主色
const nodeStatusClass = computed(() => (status: string) => {
  switch (status) {
    case 'completed': return 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]'
    case 'running': return 'bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.5)]'
    case 'pending': return 'bg-muted-foreground/30'
    case 'error': return 'bg-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.5)]'
    default: return 'bg-muted-foreground/30'
  }
})

// Todo 悬浮面板状态
const isTodoPanelOpen = ref(true)

const extractTodosFromEvent = (event: any): any[] => {
  if (!event || event?.data?.tool_name !== 'TodoWrite') return []
  const parsed = parseTodoData(event)
  if (parsed.type === 'result') return parsed.newTodos || []
  if (parsed.type === 'call') return parsed.todos || []
  return []
}

const latestTodoSnapshot = computed(() => {
  for (let i = stream.value.length - 1; i >= 0; i -= 1) {
    const evt = stream.value[i]
    if (!(evt?.event_type === 'TOOL_RESULT' || evt?.event_type === 'TOOL_CALL')) continue
    if (evt?.data?.tool_name !== 'TodoWrite') continue
    const todos = extractTodosFromEvent(evt)
    if (todos.length > 0) {
      return { detected: true, todos }
    }
  }
  return { detected: false, todos: [] as any[] }
})

// 从 stream 中提取最新的 todo 列表
const latestTodos = computed(() => latestTodoSnapshot.value.todos)

const planProgressState = computed(() => {
  const todos = latestTodoSnapshot.value.todos
  const detected = latestTodoSnapshot.value.detected
  if (!detected || todos.length === 0) {
    return {
      detected: false,
      total: 0,
      completed: 0,
      inProgress: 0,
      allCompleted: false,
      percent: 0
    }
  }

  const total = todos.length
  const completed = todos.filter((todo: any) => todo?.status === 'completed').length
  const inProgress = todos.filter((todo: any) => todo?.status === 'in_progress').length
  const allCompleted = completed >= total

  let percent = Math.round((completed / total) * 90)
  if (!allCompleted && inProgress > 0) {
    // 存在进行中节点时给半档前进反馈，避免长时间停在同一进度。
    percent = Math.round(((completed + 0.5) / total) * 90)
  }
  percent = Math.min(90, Math.max(5, percent))
  if (allCompleted) {
    percent = 90
  }

  return { detected, total, completed, inProgress, allCompleted, percent }
})

const planTailProgress = ref(90)
let planTailTimer: ReturnType<typeof setInterval> | null = null

const stopPlanTailAnimation = (resetToStart = true) => {
  if (planTailTimer) {
    clearInterval(planTailTimer)
    planTailTimer = null
  }
  if (resetToStart) {
    planTailProgress.value = 90
  }
}

const startPlanTailAnimation = () => {
  if (planTailProgress.value < 90) {
    planTailProgress.value = 90
  }
  if (planTailProgress.value >= 100) {
    return
  }
  if (planTailTimer) return
  planTailTimer = setInterval(() => {
    planTailProgress.value += 1
    if (planTailProgress.value >= 100) {
      planTailProgress.value = 100
      stopPlanTailAnimation(false)
    }
  }, 220)
}

watch(
  () => ({
    missionId: missionId.value,
    running: showRunningIndicator.value,
    planDetected: planProgressState.value.detected,
    planCompleted: planProgressState.value.detected && planProgressState.value.allCompleted
  }),
  ({ running, planDetected, planCompleted }, previous) => {
    if (!previous || previous.missionId !== missionId.value) {
      stopPlanTailAnimation(true)
    }
    if (running && planCompleted) {
      startPlanTailAnimation()
      return
    }
    // 离开 plan 完成态时重置，以便下一次进入时从 90 开始冲刺。
    stopPlanTailAnimation(!planDetected || !running)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearStreamAutoScrollTimer()
  stopPlanTailAnimation()
})

const displayProgress = computed(() => {
  if (isExecutionFinished.value) return 100

  // Plan 模式：按 todo 节点推进；全部完成但任务未结束时做 90~100 收尾动画。
  if (planProgressState.value.detected) {
    if (planProgressState.value.allCompleted) {
      return Math.round(planTailProgress.value)
    }
    return planProgressState.value.percent
  }

  // 未识别是否 Plan（含非 Plan 模式）：展示脉冲态，进度只作弱提示。
  return Math.max(5, Math.min(95, Math.round(progress.value || 0)))
})

const showProgressPulse = computed(() => {
  if (isExecutionFinished.value) return false
  if (!planProgressState.value.detected) {
    return true
  }
  if (planProgressState.value.allCompleted) {
    return showRunningIndicator.value && planTailProgress.value >= 100
  }
  return false
})

const copied = ref(false)
const artifactPreviewOpen = ref(false)
const artifactPreviewTarget = ref<{ name: string, url: string } | null>(null)
const outputArtifactsDialogOpen = ref(false)
interface OutputArtifactItem {
  id: string
  name: string
  url: string
  objectName?: string
  relativePath: string
  size?: number
  category?: 'deliverable' | 'intermediate'
}

interface OutputArtifactTreeNode {
  id: string
  type: 'folder' | 'file'
  label: string
  path: string
  children?: OutputArtifactTreeNode[]
  fileCount?: number
  artifact?: OutputArtifactItem
}

const outputArtifactsDialogPayload = ref<{
  artifacts: OutputArtifactItem[]
  workspaceSpaceType?: string
  workspaceWorkstationId?: string
  workspaceNodeId?: string
} | null>(null)

const artifactTreeExpanded = ref<string[]>([])
const selectedArtifactIds = ref(new Set<string>())
const isBatchDownloading = ref(false)

const updateArtifactTreeExpanded = (value: string[]) => {
  artifactTreeExpanded.value = Array.isArray(value) ? value : []
}

const toggleArtifactSelect = (id: string) => {
  const next = new Set(selectedArtifactIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedArtifactIds.value = next
}

const handleArtifactCheckboxUpdate = (id: string, checked: boolean | 'indeterminate') => {
  const isChecked = checked === true
  const next = new Set(selectedArtifactIds.value)
  if (isChecked) next.add(id)
  else next.delete(id)
  selectedArtifactIds.value = next
}

const handleArtifactRowSelect = (artifact: OutputArtifactItem, event: MouseEvent) => {
  if (event.defaultPrevented) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, [role="checkbox"], [data-row-no-toggle="true"]')) {
    return
  }
  toggleArtifactSelect(artifact.id)
}

const outputArtifactFlatRows = computed<OutputArtifactItem[]>(() => {
  const rows = [...(outputArtifactsDialogPayload.value?.artifacts || [])]
  return rows.sort((a, b) => (a.relativePath || a.name).localeCompare((b.relativePath || b.name), 'zh-CN'))
})

const selectAllArtifacts = () => {
  selectedArtifactIds.value = new Set(outputArtifactFlatRows.value.map((item) => item.id))
}

const clearArtifactSelection = () => {
  selectedArtifactIds.value = new Set()
}

const handleToggleSelectAll = (checked: boolean | 'indeterminate') => {
  if (checked === false) clearArtifactSelection()
  else selectAllArtifacts()
}

const isAllArtifactsSelected = computed(() => {
  const artifacts = outputArtifactsDialogPayload.value?.artifacts || []
  return artifacts.length > 0 && selectedArtifactIds.value.size === artifacts.length
})

const isSomeArtifactsSelected = computed(() => {
  const size = selectedArtifactIds.value.size
  const total = (outputArtifactsDialogPayload.value?.artifacts || []).length
  return size > 0 && size < total
})

const selectedArtifacts = computed(() => {
  const artifacts = outputArtifactsDialogPayload.value?.artifacts || []
  return artifacts.filter(a => selectedArtifactIds.value.has(a.id))
})

const resolveArtifactObjectName = (artifact: OutputArtifactItem): string => {
  const fromField = normalizeArtifactPath(artifact.objectName || '')
  if (fromField) return fromField
  const fromUrl = normalizeArtifactPath(extractArtifactPathFromUrl(artifact.url || ''))
  if (fromUrl) return fromUrl
  return ''
}

const handleBatchDownload = async () => {
  if (isBatchDownloading.value) return

  const items = selectedArtifacts.value
  await downloadArtifacts(items)
}

const handleDownloadAllArtifacts = async () => {
  if (isBatchDownloading.value) return
  const allArtifacts = outputArtifactsDialogPayload.value?.artifacts || []
  await downloadArtifacts(allArtifacts)
}

const downloadArtifacts = async (artifacts: OutputArtifactItem[]) => {
  const items = artifacts
  if (items.length === 0) {
    toast.error('暂无可下载文件')
    return
  }

  if (items.length === 1) {
    handleArtifactDownload(items[0])
    return
  }

  const payloadItems = items
    .map((item) => {
      const objectName = resolveArtifactObjectName(item)
      if (!objectName) return null
      return {
        object: objectName,
        name: item.relativePath || item.name
      }
    })
    .filter((item): item is { object: string, name: string } => Boolean(item))

  if (payloadItems.length === 0) {
    toast.error('当前文件暂不支持打包下载')
    return
  }

  const fileName = `task-artifacts-${missionId.value || Date.now()}.zip`

  try {
    isBatchDownloading.value = true
    const response = await fetch('/api/v1/task-outputs/archive', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        items: payloadItems
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
    toast.success(`已打包下载 ${payloadItems.length} 个文件`)
  } catch (error: any) {
    toast.error(error?.message || '打包下载失败')
  } finally {
    isBatchDownloading.value = false
  }
}

const outputArtifactStats = computed(() => {
  const artifacts = outputArtifactsDialogPayload.value?.artifacts || []
  const totalFiles = artifacts.length
  const totalSize = artifacts.reduce((sum, a) => sum + (a.size || 0), 0)
  const dirs = new Set<string>()
  for (const a of artifacts) {
    const parts = a.relativePath.split('/').filter(Boolean)
    if (parts.length > 1) {
      let current = ''
      for (let i = 0; i < parts.length - 1; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i]
        dirs.add(current)
      }
    }
  }
  return { totalFiles, totalSize, totalDirs: dirs.size }
})
const copyCode = (code: string) => {
  navigator.clipboard.writeText(code)
  copied.value = true
  toast.success('代码已复制')
  setTimeout(() => copied.value = false, 2000)
}

// 产物预览辅助函数
const ARTIFACT_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const ARTIFACT_TEXT_EXTS = new Set([
  'py', 'java', 'js', 'ts', 'jsx', 'tsx', 'vue', 'css', 'scss', 'less', 'html',
  'md', 'txt', 'sql', 'sh', 'bash', 'yaml', 'yml', 'json', 'xml',
  'toml', 'ini', 'go', 'rs', 'rb', 'php', 'c', 'cpp', 'log', 'csv'
])

const getArtifactFileExt = (name: string): string => {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

const isArtifactPreviewable = (name: string): boolean => {
  const ext = getArtifactFileExt(name)
  return ARTIFACT_IMAGE_EXTS.has(ext) || ARTIFACT_TEXT_EXTS.has(ext)
}

const isArtifactImage = (name: string): boolean => {
  return ARTIFACT_IMAGE_EXTS.has(getArtifactFileExt(name))
}

const getArtifactIcon = (name: string) => {
  const ext = getArtifactFileExt(name)
  if (ARTIFACT_IMAGE_EXTS.has(ext)) return ImageIcon
  if (['md', 'markdown', 'txt', 'pdf', 'doc', 'docx', 'rtf'].includes(ext)) return FileText
  if (ARTIFACT_TEXT_EXTS.has(ext)) return FileCode
  return FileText
}

const getArtifactIconColor = (name: string): string => {
  const ext = getArtifactFileExt(name)
  if (ARTIFACT_IMAGE_EXTS.has(ext)) return 'text-blue-400'
  if (['md', 'markdown'].includes(ext)) return 'text-orange-400'
  if (['json', 'yml', 'yaml'].includes(ext)) return 'text-yellow-500'
  if (['py'].includes(ext)) return 'text-blue-400'
  if (['go', 'java', 'ts', 'tsx', 'js', 'vue'].includes(ext)) return 'text-emerald-500'
  return 'text-muted-foreground'
}

const normalizeArtifactPath = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  let normalized = String(value).trim()
  if (!normalized) return ''
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // ignore decode error, fallback to raw text
  }
  normalized = normalized
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  return normalized
}

const joinArtifactPath = (...parts: Array<string | undefined | null>): string => {
  const normalizedParts = parts
    .map((part) => normalizeArtifactPath(part || ''))
    .filter(Boolean)
  return normalizedParts.join('/')
}

const buildTaskOutputProxyUrl = (objectName: string): string => {
  const normalizedObject = normalizeArtifactPath(objectName)
  if (!normalizedObject) return ''
  return `/api/v1/task-outputs/file?object=${encodeURIComponent(normalizedObject)}`
}

const resolveArtifactBasePathFromStream = (event: any): string => {
  const currentData = event?.data || {}
  const directBase = normalizeArtifactPath(currentData.oss_path_resolved || currentData.oss_path || '')
  if (directBase) return directBase

  const currentTaskId = String(event?.task_id || currentData.task_id || missionId.value || '').trim()
  for (let i = stream.value.length - 1; i >= 0; i -= 1) {
    const item = stream.value[i]
    if (!item) continue
    const data = item?.data || {}
    const eventTaskId = String((item as any)?.task_id || data?.task_id || '').trim()
    if (currentTaskId && eventTaskId && eventTaskId !== currentTaskId) continue
    const candidate = normalizeArtifactPath(data.oss_path_resolved || data.oss_path || '')
    if (candidate) return candidate
  }
  return ''
}

const normalizeArtifactUrlForUi = (url: string): string => {
  const trimmed = String(url || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  return `/${trimmed}`
}

const extractArtifactPathFromUrl = (url: string): string => {
  if (!url) return ''
  try {
    const parsed = new URL(url, 'http://localhost')
    const keys = ['object', 'key', 'path', 'file', 'filename']
    for (const key of keys) {
      const value = parsed.searchParams.get(key)
      const normalized = normalizeArtifactPath(value)
      if (normalized) return normalized
    }
    return normalizeArtifactPath(parsed.pathname)
  } catch {
    return ''
  }
}

const stripArtifactPrefix = (path: string, basePath: string): string => {
  const normalizedPath = normalizeArtifactPath(path)
  const normalizedBase = normalizeArtifactPath(basePath)
  if (!normalizedPath) return ''
  if (!normalizedBase) return normalizedPath
  if (normalizedPath === normalizedBase) return ''
  if (normalizedPath.startsWith(`${normalizedBase}/`)) {
    return normalizedPath.slice(normalizedBase.length + 1)
  }
  return normalizedPath
}

const resolveArtifactRelativePath = (artifact: any, basePath = ''): string => {
  const fallbackName = normalizeArtifactPath(artifact?.name) || '未命名文件'
  const candidates = [
    artifact?.relative_path,
    artifact?.relativePath,
    artifact?.path,
    artifact?.file_path,
    artifact?.filePath,
    artifact?.object_name,
    artifact?.objectName,
    artifact?.object,
    artifact?.oss_path,
    artifact?.ossPath
  ]
  for (const candidate of candidates) {
    const normalized = stripArtifactPrefix(String(candidate || ''), basePath)
    if (normalized) return normalized
  }

  const url = String(artifact?.download_url || artifact?.oss_url || artifact?.url || '')
  const pathFromUrl = stripArtifactPrefix(extractArtifactPathFromUrl(url), basePath)
  if (pathFromUrl) return pathFromUrl
  return fallbackName
}

const resolveArtifactObjectCandidate = (artifact: any, basePath = '', relativePath = ''): string => {
  const objectCandidates = [
    artifact?.object_name,
    artifact?.objectName,
    artifact?.object,
    artifact?.oss_path,
    artifact?.ossPath,
    artifact?.file_path,
    artifact?.filePath
  ]

  for (const candidate of objectCandidates) {
    const normalized = normalizeArtifactPath(candidate || '')
    if (!normalized) continue
    if (basePath && relativePath && normalized === normalizeArtifactPath(relativePath)) {
      continue
    }
    return normalized
  }

  const fromUrl = extractArtifactPathFromUrl(String(artifact?.download_url || artifact?.oss_url || artifact?.url || ''))
  if (fromUrl) return fromUrl

  const fallbackObject = joinArtifactPath(basePath, relativePath)
  if (fallbackObject) return fallbackObject
  return normalizeArtifactPath(relativePath)
}

const resolveArtifactObjectFromFields = (artifact: any): string => {
  const objectCandidates = [
    artifact?.object_name,
    artifact?.objectName,
    artifact?.object,
    artifact?.oss_path,
    artifact?.ossPath,
    artifact?.file_path,
    artifact?.filePath
  ]
  for (const candidate of objectCandidates) {
    const normalized = normalizeArtifactPath(candidate || '')
    if (normalized) return normalized
  }
  return extractArtifactPathFromUrl(String(artifact?.download_url || artifact?.oss_url || artifact?.url || ''))
}

const normalizeArtifactDisplayPath = (path: string): string => {
  let normalized = normalizeArtifactPath(path || '')
  if (!normalized) return ''

  normalized = normalized
    .replace(/^workspace\//i, '')
    .replace(/^workstation\/[^/]+\/[^/]+\//i, '')
    .replace(/^workstation\/[^/]+\//i, '')
    .replace(/^system\/[^/]+\/logs\/[^/]+\/TSK-[^/]+\//i, '')
    .replace(/^logs\/[^/]+\/TSK-[^/]+\//i, '')

  return normalized
}

const collectTaskOutputReadyArtifacts = (event: any): OutputArtifactItem[] => {
  const currentData = event?.data || {}
  const currentTaskId = String(event?.task_id || currentData.task_id || missionId.value || '').trim()
  const related: OutputArtifactItem[] = []

  for (let i = stream.value.length - 1; i >= 0; i -= 1) {
    const item = stream.value[i]
    if (!item || item.event_type !== 'TASK_OUTPUT_READY') continue
    const data = item?.data || {}
    const eventTaskId = String((item as any)?.task_id || data?.task_id || '').trim()
    if (currentTaskId && eventTaskId && eventTaskId !== currentTaskId) continue
    const basePath = normalizeArtifactPath(data.oss_path_resolved || data.oss_path || '')
    const artifacts = mapOutputArtifacts(data.artifacts, basePath)
    if (artifacts.length > 0) {
      related.push(...artifacts)
    }
  }
  return related
}

const mapPathlistToArtifacts = (pathList: any[], basePath = '', relatedArtifacts: OutputArtifactItem[] = []): OutputArtifactItem[] => {
  if (!Array.isArray(pathList)) return []
  return pathList.map((item: any, index: number) => {
    const rawRelativePath = normalizeArtifactPath(item?.relative_path || item?.path || '')
    const relativePath = normalizeArtifactDisplayPath(rawRelativePath)
    const explicitObjectName = resolveArtifactObjectFromFields(item)
    const baseName = (relativePath || rawRelativePath).split('/').filter(Boolean).slice(-1)[0] || ''
    const matchedArtifact = relatedArtifacts.find((artifact) => {
      const artifactRelativePath = normalizeArtifactDisplayPath(artifact.relativePath || '')
      if (artifactRelativePath && artifactRelativePath === relativePath) return true
      return baseName && artifact.name === baseName
    })
    const objectName = matchedArtifact?.objectName || explicitObjectName
    const rawUrl = normalizeArtifactUrlForUi(String(item?.download_url || item?.oss_url || item?.url || ''))
    const url = rawUrl || matchedArtifact?.url || buildTaskOutputProxyUrl(objectName)
    const segments = (relativePath || rawRelativePath).split('/').filter(Boolean)
    const finalName = segments[segments.length - 1] || `未命名文件-${index + 1}`
    const displayRelativePath = relativePath || finalName
    return {
      id: `${displayRelativePath}-${index}`,
      name: finalName,
      url,
      objectName,
      relativePath: displayRelativePath,
      size: typeof item?.size === 'number' ? item.size : undefined,
      category: item?.category === 'intermediate' ? 'intermediate' : 'deliverable'
    }
  })
}

const mapOutputArtifacts = (value: any, basePath = ''): OutputArtifactItem[] => {
  if (!Array.isArray(value)) return []
  return value.map((artifact: any, index: number) => {
    const rawRelativePath = resolveArtifactRelativePath(artifact, basePath)
    const relativePath = normalizeArtifactDisplayPath(rawRelativePath)
    const objectName = resolveArtifactObjectCandidate(artifact, basePath, relativePath)
    const rawUrl = normalizeArtifactUrlForUi(String(artifact?.download_url || artifact?.oss_url || artifact?.url || ''))
    const url = rawUrl || buildTaskOutputProxyUrl(objectName)
    const segments = (relativePath || rawRelativePath).split('/').filter(Boolean)
    const finalName = segments[segments.length - 1] || String(artifact?.name || `未命名文件-${index + 1}`)
    const displayRelativePath = relativePath || finalName
    return {
      id: `${displayRelativePath}-${index}`,
      name: finalName,
      url,
      objectName,
      relativePath: displayRelativePath,
      size: typeof artifact?.size === 'number' ? artifact.size : undefined
    }
  })
}

const resolveEventArtifacts = (event: any): OutputArtifactItem[] => {
  const data = event?.data || {}
  const basePath = resolveArtifactBasePathFromStream(event)
  const enrichedArtifacts = mapOutputArtifacts(data.artifacts, basePath)
  if (enrichedArtifacts.length > 0) {
    return enrichedArtifacts
  }
  if (Array.isArray(data.path_list) && data.path_list.length > 0) {
    const relatedArtifacts = collectTaskOutputReadyArtifacts(event)
    return mapPathlistToArtifacts(data.path_list, basePath, relatedArtifacts)
  }
  return []
}

const formatFileSize = (bytes?: number): string => {
  if (bytes == null || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatArtifactDisplayPath = (artifact: OutputArtifactItem): string => {
  const normalizedPath = normalizeArtifactPath(artifact.relativePath || artifact.name || '')
  if (!normalizedPath) return `/${artifact.name}`
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const canOpenWorkspaceOutput = computed(() => {
  const payload = outputArtifactsDialogPayload.value
  if (!payload) return false
  return payload.workspaceSpaceType === 'WORKSTATION'
    && Boolean(payload.workspaceWorkstationId)
    && Boolean(payload.workspaceNodeId)
})

const outputArtifactTreeNodes = computed<OutputArtifactTreeNode[]>(() => {
  const artifacts = outputArtifactsDialogPayload.value?.artifacts || []
  if (artifacts.length === 0) return []

  type ArtifactFolderNode = {
    label: string
    path: string
    folders: Map<string, ArtifactFolderNode>
    files: OutputArtifactItem[]
    fileCount: number
  }

  const root: ArtifactFolderNode = {
    label: '',
    path: '',
    folders: new Map(),
    files: [],
    fileCount: 0
  }

  for (const artifact of artifacts) {
    const normalizedPath = normalizeArtifactPath(artifact.relativePath || artifact.name)
    const segments = normalizedPath.split('/').filter(Boolean)
    const fileName = segments.pop() || artifact.name

    let cursor = root
    const ancestors: ArtifactFolderNode[] = [root]
    let currentPath = ''
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      if (!cursor.folders.has(segment)) {
        cursor.folders.set(segment, {
          label: segment,
          path: currentPath,
          folders: new Map(),
          files: [],
          fileCount: 0
        })
      }
      cursor = cursor.folders.get(segment)!
      ancestors.push(cursor)
    }

    cursor.files.push({
      ...artifact,
      name: fileName,
      relativePath: normalizedPath || artifact.relativePath || artifact.name
    })
    for (const folder of ancestors) {
      folder.fileCount += 1
    }
  }

  const toViewNodes = (node: ArtifactFolderNode): OutputArtifactTreeNode[] => {
    const folders = Array.from(node.folders.values())
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
      .map((folder) => ({
        id: `folder:${folder.path}`,
        type: 'folder' as const,
        label: folder.label,
        path: folder.path,
        fileCount: folder.fileCount,
        children: toViewNodes(folder)
      }))

    const files = [...node.files]
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      .map((file) => ({
        id: `file:${file.id}`,
        type: 'file' as const,
        label: file.name,
        path: normalizeArtifactPath(file.relativePath || file.name),
        artifact: file
      }))

    return [...folders, ...files]
  }

  return toViewNodes(root)
})

const collectFileArtifactsFromNode = (node: OutputArtifactTreeNode): OutputArtifactItem[] => {
  if (node.type === 'file') {
    return node.artifact ? [node.artifact] : []
  }
  const children = node.children || []
  return children.flatMap((child) => collectFileArtifactsFromNode(child))
}

const getFolderSelectionState = (node: OutputArtifactTreeNode): boolean | 'indeterminate' => {
  if (node.type !== 'folder') return false
  const files = collectFileArtifactsFromNode(node)
  if (files.length === 0) return false
  const selectedCount = files.filter((file) => selectedArtifactIds.value.has(file.id)).length
  if (selectedCount <= 0) return false
  if (selectedCount >= files.length) return true
  return 'indeterminate'
}

const toggleFolderSelection = (node: OutputArtifactTreeNode, checked: boolean | 'indeterminate') => {
  if (node.type !== 'folder') return
  const files = collectFileArtifactsFromNode(node)
  const next = new Set(selectedArtifactIds.value)
  if (checked !== false) {
    files.forEach((file) => next.add(file.id))
  } else {
    files.forEach((file) => next.delete(file.id))
  }
  selectedArtifactIds.value = next
}

const buildArtifactDefaultExpanded = (nodes: OutputArtifactTreeNode[], maxLevel = 1): string[] => {
  const expanded: string[] = []
  const walk = (items: OutputArtifactTreeNode[], level: number) => {
    for (const node of items) {
      if (node.type !== 'folder') continue
      if (level <= maxLevel) {
        expanded.push(node.id)
      }
      if (node.children && node.children.length > 0) {
        walk(node.children, level + 1)
      }
    }
  }
  walk(nodes, 0)
  return expanded
}

const getArtifactTreeGuideLevels = (level: number): number[] => {
  const safeLevel = Math.max(0, Math.min(level, 8))
  return Array.from({ length: safeLevel }, (_, index) => index)
}

const getArtifactTypeBuckets = (event: any): Array<{ type: string, count: number }> => {
  const artifacts = resolveEventArtifacts(event)
  const counter = new Map<string, number>()
  for (const artifact of artifacts) {
    const ext = getArtifactFileExt(artifact.name)
    const type = ext ? ext.toUpperCase() : '无后缀'
    counter.set(type, (counter.get(type) || 0) + 1)
  }
  return Array.from(counter.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
}

const getArtifactTypeCountText = (event: any): string => {
  const buckets = getArtifactTypeBuckets(event)
  if (buckets.length === 0) return '无'
  return buckets.map(bucket => `${bucket.type} × ${bucket.count}`).join('，')
}

const getArtifactTotalCount = (event: any): number => {
  return resolveEventArtifacts(event).length
}

const handleArtifactPreview = (artifact: { name: string, url?: string }) => {
  const target = artifact as OutputArtifactItem
  const previewUrl = normalizeArtifactUrlForUi(String(target.url || '')) || buildTaskOutputProxyUrl(resolveArtifactObjectName(target))
  if (!previewUrl) {
    toast.error('当前文件暂不可预览或下载')
    return
  }
  artifactPreviewTarget.value = { name: artifact.name, url: previewUrl }
  artifactPreviewOpen.value = true
}

const handleOpenWorkspaceOutput = async (payload?: {
  workspaceSpaceType?: string
  workspaceWorkstationId?: string
  workspaceNodeId?: string
}) => {
  const spaceType = payload?.workspaceSpaceType
  const workstationId = payload?.workspaceWorkstationId
  const nodeId = payload?.workspaceNodeId

  if (spaceType !== 'WORKSTATION' || !workstationId || !nodeId) {
    toast.error('当前事件未包含可跳转的产出目录信息')
    return
  }

  outputArtifactsDialogOpen.value = false
  artifactPreviewOpen.value = false
  await nextTick()
  await router.push({
    name: 'files',
    query: {
      spaceType,
      workstationId,
      nodeId
    }
  })
  emit('close')
}

const openOutputArtifactsDialog = (event: any) => {
  const data = event?.data || {}
  const artifacts = resolveEventArtifacts(event)
  outputArtifactsDialogPayload.value = {
    artifacts,
    workspaceSpaceType: data.workspace_space_type,
    workspaceWorkstationId: data.workspace_workstation_id,
    workspaceNodeId: data.workspace_node_id
  }
  selectedArtifactIds.value = new Set()
  artifactTreeExpanded.value = []

  outputArtifactsDialogOpen.value = true
}

const handleArtifactDownload = (artifact: { name: string, url?: string }) => {
  const target = artifact as OutputArtifactItem
  const downloadUrl = normalizeArtifactUrlForUi(String(target.url || '')) || buildTaskOutputProxyUrl(resolveArtifactObjectName(target))
  if (!downloadUrl) {
    toast.error('当前文件暂不可下载')
    return
  }
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = artifact.name
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 导出执行日志（原始 JSON）
const exportLogs = () => {
  if (stream.value.length === 0) {
    toast.error('暂无日志可导出')
    return
  }

  // 直接导出原始消息
  const content = JSON.stringify(stream.value, null, 2)

  // 创建 Blob 并下载
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `task-logs-${missionId.value}-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success(`已导出 ${stream.value.length} 条日志`)
}

// 复制日志到剪贴板 (JSON 格式)
const copyLogsToClipboard = () => {
  if (stream.value.length === 0) {
    toast.error('暂无日志可复制')
    return
  }

  const json = JSON.stringify(stream.value, null, 2)
  navigator.clipboard.writeText(json)
  toast.success(`已复制 ${stream.value.length} 条日志到剪贴板 (JSON)`)
}

// 计算 Token 百分比
const tokenPercentage = computed(() => {
  if (!profile.value?.usage) return 0
  return Math.min(100, (displayTokensUsed.value / profile.value.usage.tokens_limit) * 100)
})

// ESC 关闭支持
onKeyStroke('Escape', (e) => {
  e.preventDefault()
  emit('close')
})
</script>

<template>
  <div class="flex flex-col h-full bg-background overflow-hidden border-l shadow-2xl">
    <!-- Header -->
    <header class="h-16 border-b bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" class="-ml-2 hover:bg-muted" @click="emit('close')" title="返回 (Esc)">
          <ArrowLeft class="h-5 w-5 text-muted-foreground" />
        </Button>
        <div>
          <h1 class="font-bold text-lg flex items-center gap-2 text-foreground">
            任务执行详情
          </h1>
          <p class="text-xs text-muted-foreground font-mono">ID: {{ missionId }}</p>
          <p class="text-[11px] text-muted-foreground flex items-center gap-3">
            <span class="truncate max-w-[220px]" :title="displayRoleName">岗位: {{ displayRoleName }}</span>
            <span class="truncate max-w-[220px] font-mono" :title="displayModelName">模型: {{ displayModelName }}</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-6">
        <!-- 实时监控指标 (TASK-FE-050) -->
        <div class="flex items-center gap-4">
          <!-- Token Usage -->
          <div class="flex items-center gap-2.5 bg-muted/30 px-2.5 py-1 rounded border border-border/50 shadow-inner">
            <Coins class="h-3.5 w-3.5 text-primary/80" />
            <div class="flex flex-col leading-tight">
              <span class="text-[8px] font-bold text-muted-foreground uppercase">Tokens</span>
              <span class="font-mono text-[10px] font-bold text-foreground">
                {{ displayTokensUsed.toLocaleString() }}
              </span>
            </div>
            <div class="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-border/30">
              <div class="h-full bg-primary shadow-[0_0_8px_rgba(var(--glow-rgb),0.4)] transition-all duration-500" :style="{ width: tokenPercentage + '%' }"></div>
            </div>
          </div>

          <!-- Overall Progress -->
          <div class="flex items-center gap-2.5 bg-primary/5 px-2.5 py-1 rounded border border-primary/20">
            <BarChart3 class="h-3.5 w-3.5 text-primary" />
            <div class="flex flex-col leading-tight">
              <span class="text-[8px] font-bold text-primary uppercase">Progress</span>
              <span class="font-mono text-[10px] font-bold text-primary">
                {{ displayProgress }}%
              </span>
            </div>
            <div class="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-border/30">
              <div
                class="h-full bg-primary shadow-[0_0_8px_rgba(var(--glow-rgb),0.5)] transition-all duration-500"
                :class="showProgressPulse ? 'animate-pulse' : ''"
                :style="{ width: displayProgress + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 text-xs font-mono font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/50">
          <Clock class="h-3.5 w-3.5" /> {{ profile?.usage?.duration || '0s' }}
        </div>

        <Separator orientation="vertical" class="h-4" />

        <!-- [优化] 强强调状态标签 (Header) - 综合 isRunning 和 profile.status 判断 -->
        <div class="relative flex items-center">
          <Badge
            :variant="showRunningIndicator ? 'running' : profile?.status === 'completed' ? 'success' : profile?.status === 'failed' ? 'failed' : 'outline'"
            class="px-3 py-1 shadow-sm"
          >
            <template v-if="showRunningIndicator">
              <Loader2 class="h-3 w-3 animate-spin mr-1.5" />
              正在运行
            </template>
            <template v-else-if="profile?.status === 'completed'">
              <Check class="h-3 w-3 mr-1.5" />
              任务已完成
            </template>
            <template v-else-if="profile?.status === 'failed'">
              <X class="h-3 w-3 mr-1.5" />
              任务失败
            </template>
            <template v-else>
              <Activity class="h-3 w-3 mr-1.5" />
              {{ profile?.status === 'aborted' ? '已终止' : '未知状态' }}
            </template>
          </Badge>
          <!-- 运行中的扩散动画 -->
          <span v-if="showRunningIndicator" class="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20"></span>
        </div>

        <Button
          v-if="!props.isSharedView"
          variant="outline"
          size="sm"
          class="h-8 px-3 text-xs font-bold"
          :disabled="isCreatingShareLink"
          @click="handleShareTaskLink"
        >
          <Loader2 v-if="isCreatingShareLink" class="h-3.5 w-3.5 animate-spin" />
          <Share2 v-else class="h-3.5 w-3.5" />
          {{ isCreatingShareLink ? '生成中...' : '分享链接' }}
        </Button>

        <Button
          v-if="!props.isSharedView && canAbortMission"
          variant="destructive"
          size="sm"
          class="h-8 px-3 text-xs font-bold"
          :disabled="isAborting"
          @click="handleAbortMission"
        >
          <Loader2 v-if="isAborting" class="h-3.5 w-3.5 animate-spin" />
          <Ban v-else class="h-3.5 w-3.5" />
          {{ isAborting ? '终止中...' : '终止任务' }}
        </Button>

        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" @click="emit('close')">
          <X class="h-5 w-5" />
        </Button>
      </div>
    </header>

    <!-- Main Layout -->
    <div class="flex-1 flex min-h-0 overflow-hidden">
      <!-- Left: Mission Profile Sidebar (Fixed Width - TASK-FE-046) -->
      <aside class="w-[400px] border-r bg-muted/10 flex flex-col shrink-0 min-h-0">
        <ScrollArea class="h-full">
          <div class="p-6 flex flex-col gap-6" v-if="profile">

            <!-- 1. Prompt (Goal) -->
            <div class="space-y-2">
              <h3 class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Activity class="h-3.5 w-3.5 text-primary" /> 任务目标
              </h3>
              <p
                class="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words bg-background/50 p-3 rounded-md border border-border/50 shadow-sm font-medium line-clamp-5 hover:line-clamp-none focus:line-clamp-none cursor-default"
                :title="profile.prompt || ''"
                tabindex="0"
              >
                {{ profile.prompt || '-' }}
              </p>
            </div>

            <Separator />

            <!-- 2. Runtime Environment (Compacted - TASK-FE-046) -->
            <div class="space-y-3">
              <h3 class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Box class="h-3.5 w-3.5 text-primary" /> 运行环境
              </h3>

              <div class="space-y-2.5">
                <div class="flex items-center gap-2 text-[11px] font-medium text-foreground bg-background p-2 rounded border border-border/50 shadow-sm">
                  <Terminal class="h-3 w-3 text-primary/60 shrink-0" />
                  <span class="truncate font-mono font-bold" :title="profile.image">{{ profile.image }}</span>
                  <Separator orientation="vertical" class="h-3 mx-1" />
                  <span class="text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                    <Cpu class="h-3 w-3 text-blue-500/60" /> 1C / <ServerCog class="h-3 w-3 text-blue-500/60" /> 2Gi
                  </span>
                </div>

                <div class="space-y-1.5 rounded border border-border/50 bg-background p-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] text-muted-foreground font-medium">部署模式</span>
                    <Badge variant="outline" class="text-[10px] font-bold" :class="runtimeBadgeClass">
                      {{ runtimeLabel }}
                    </Badge>
                  </div>
                  <div v-if="profile.runtimeError" class="text-[10px] text-red-600">
                    {{ profile.runtimeError }}
                  </div>
                </div>

                <div v-if="taskRepoRows.length > 0" class="flex flex-col gap-1.5">
                  <span class="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">代码仓库</span>
                  <div class="bg-background border border-border/50 rounded-md overflow-hidden shadow-sm">
                    <div class="flex border-b border-border/50 text-[10px] bg-muted/20">
                      <div class="w-2/3 p-2 font-bold text-muted-foreground border-r border-border/50 flex items-center gap-1.5">
                        <FolderGit2 class="h-3 w-3 text-orange-500/70 shrink-0" />
                        <span>仓库</span>
                      </div>
                      <div class="w-1/3 p-2 font-bold text-muted-foreground flex items-center gap-1.5">
                        <GitBranch class="h-3 w-3 shrink-0" />
                        <span>分支</span>
                      </div>
                    </div>
                    <div
                      v-for="(repo, idx) in taskRepoRows"
                      :key="`${repo.url}-${repo.branch}-${idx}`"
                      class="flex border-b last:border-0 border-border/50 text-[10px] hover:bg-muted/30 transition-colors"
                    >
                      <div class="w-2/3 p-2 font-mono font-medium text-foreground truncate border-r border-border/50" :title="repo.url">
                        {{ repo.url }}
                      </div>
                      <div class="w-1/3 p-2 font-mono font-semibold text-foreground truncate" :title="repo.branch">
                        {{ repo.branch }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <!-- 3. Associated Attributes (TASK-FE-031) -->
            <div class="space-y-4">
              <h3 class="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Zap class="h-4 w-4 text-primary" /> 关联资源
              </h3>

              <div class="grid gap-4">
                <div v-if="profile.mcp?.length" class="flex flex-col gap-1.5">
                  <span class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">MCP 服务</span>
                  <div class="flex flex-wrap gap-1.5">
                    <Badge v-for="m in profile.mcp" :key="m" variant="outline" class="text-[11px] font-semibold bg-blue-500/5 text-blue-600 border-blue-200/50 px-2 py-0.5">
                      {{ m }}
                    </Badge>
                  </div>
                </div>

                <div v-if="profile.skills?.length" class="flex flex-col gap-1.5">
                  <span class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">启用技能</span>
                  <div class="flex flex-wrap gap-1.5">
                    <Badge v-for="s in profile.skills" :key="s" variant="outline" class="text-[11px] font-semibold bg-amber-500/5 text-amber-600 border-amber-200/50 px-2 py-0.5">
                      {{ s }}
                    </Badge>
                  </div>
                </div>

                <div v-if="profile.tools?.length" class="flex flex-col gap-1.5">
                  <span class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">可用工具</span>
                  <div class="flex flex-wrap gap-1.5">
                    <Badge v-for="t in profile.tools" :key="t" variant="outline" class="text-[10px] bg-zinc-500/5 text-zinc-600 border-zinc-200/50 px-1.5 py-0">
                      {{ t }}
                    </Badge>
                  </div>
                </div>

                <div v-if="!profile.mcp?.length && !profile.skills?.length && !profile.tools?.length" class="text-[10px] text-muted-foreground italic px-2">
                  无关联外部资源
                </div>
              </div>
            </div>

            <Separator />

            <!-- 6. Environment Variables -->
            <div class="space-y-2">
              <h3 class="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Terminal class="h-4 w-4 text-primary" /> 环境变量
              </h3>
              <div v-if="profile.env && Object.keys(profile.env).length > 0" class="bg-background border border-border/50 rounded-md overflow-hidden shadow-sm">
                <div v-for="(val, key) in profile.env" :key="key" class="flex border-b last:border-0 border-border/50 text-[10px] hover:bg-muted/30 transition-colors">
                  <div class="w-1/3 bg-muted/20 p-2 font-mono font-bold text-muted-foreground truncate border-r border-border/50" :title="String(key)">{{ key }}</div>
                  <div class="w-2/3 p-2 font-mono font-medium text-foreground truncate" :title="String(val)">{{ val }}</div>
                </div>
              </div>
              <div v-else class="text-[10px] text-muted-foreground italic px-2">无自定义环境变量</div>
            </div>

            <Separator />

            <!-- 7. Estimated Output (TASK-FE-056) -->
            <div class="space-y-3">
              <h3 class="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <FileDiff class="h-4 w-4 text-primary" /> 预估产出内容
              </h3>
              <div class="flex flex-wrap gap-2 px-1">
                <Badge
                  v-for="output in (profile.estimatedOutput || ['Code'])"
                  :key="output"
                  variant="outline"
                  class="bg-background border-border text-foreground font-bold text-[10px] px-2 py-0.5 shadow-sm uppercase tracking-wider"
                >
                  {{ output }}
                </Badge>
              </div>
            </div>

            <Separator />

            <!-- 8. Meta Info (TASK-FE-047) -->
            <div class="space-y-4 pb-8">
              <h3 class="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck class="h-4 w-4 text-primary" /> 元数据
              </h3>

              <div class="space-y-3">
                <div class="flex justify-between items-center text-sm">
                  <span class="text-muted-foreground font-medium flex items-center gap-1 uppercase tracking-tighter text-[11px]"><Briefcase class="h-3 w-3" /> 岗位</span>
                  <span class="font-normal text-foreground text-xs truncate max-w-[180px] text-right" :title="displayRoleName">{{ displayRoleName }}</span>
                </div>

                <div class="flex justify-between items-center text-sm">
                  <span class="text-muted-foreground font-medium flex items-center gap-1 uppercase tracking-tighter text-[11px]"><Rocket class="h-3 w-3" /> 运行模型</span>
                  <span class="font-mono font-normal text-foreground text-[11px] truncate max-w-[180px] text-right" :title="displayModelName">{{ displayModelName }}</span>
                </div>

                <div class="flex justify-between items-center text-sm">
                  <span class="text-muted-foreground font-medium flex items-center gap-1 uppercase tracking-tighter text-[11px]"><User class="h-3 w-3" /> 执行者</span>
                  <span class="font-normal text-foreground text-xs">{{ profile.creator }}</span>
                </div>

                <div class="flex justify-between items-center text-sm">
                  <span class="text-muted-foreground font-bold flex items-center gap-1 uppercase tracking-tighter text-[11px]"><Calendar class="h-3 w-3" /> 启动于</span>
                  <span class="font-mono font-normal text-foreground tracking-tighter text-[11px]">{{ formattedMetaCreatedAt }}</span>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>
      </aside>

      <!-- Right: Content Tabs (Execution & Workspace) - Percentage Based (TASK-FE-044) -->
      <main class="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
        <Tabs v-model="activeTab" class="h-full flex flex-col">
          <div class="h-10 border-b bg-muted/5 flex items-center px-6 shrink-0 justify-between">
            <TabsList class="bg-transparent gap-10 h-full p-0 flex items-center justify-start">
              <TabsTrigger
                value="execution"
                class="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground data-[state=active]:text-foreground transition-all !flex !flex-row !items-center !gap-2"
              >
                <Activity class="h-4 w-4 shrink-0" />
                <span>执行流</span>
                <Badge v-if="stream.length > 0" variant="secondary" class="ml-1 text-[9px] px-1.5 py-0">
                  {{ stream.length }}
                </Badge>
              </TabsTrigger>
              <!-- 工作空间 Tab 暂时隐藏 -->
              <!--
              <TabsTrigger
                value="workspace"
                class="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground data-[state=active]:text-foreground transition-all !flex !flex-row !items-center !gap-2"
              >
                <FolderGit2 class="h-4 w-4 shrink-0" />
                <span>工作空间 (Files)</span>
              </TabsTrigger>
              -->
            </TabsList>

            <!-- 日志导出操作 -->
            <div class="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                @click="copyLogsToClipboard"
                :disabled="stream.length === 0"
              >
                <Copy class="h-3.5 w-3.5 mr-1" />
                复制 JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-7 px-2 text-xs"
                @click="exportLogs"
                :disabled="stream.length === 0"
              >
                <Download class="h-3.5 w-3.5 mr-1" />
                导出日志
              </Button>
            </div>
          </div>

          <TabsContent value="execution" class="flex-1 min-h-0 mt-0 overflow-hidden">
            <div class="h-full overflow-y-auto bg-muted/5 relative">
              <!-- Todo 悬浮面板 -->
              <div
                v-if="latestTodos.length > 0"
                class="sticky top-3 float-right mr-4 mt-3 z-20 transition-all duration-300"
                :class="isTodoPanelOpen ? 'w-64' : 'w-auto'"
              >
                <div
                  class="bg-background/95 backdrop-blur-md border border-border/60 rounded-lg shadow-lg overflow-hidden"
                >
                  <!-- 面板头部 -->
                  <button
                    class="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-muted/30 transition-colors"
                    @click="isTodoPanelOpen = !isTodoPanelOpen"
                  >
                    <ListTodo class="h-3.5 w-3.5 text-primary shrink-0" />
                    <span v-if="isTodoPanelOpen" class="flex-1 text-left">任务计划</span>
                    <Badge variant="secondary" class="text-[9px] px-1.5 py-0 shrink-0">
                      {{ latestTodos.filter((t: any) => t.status === 'completed').length }}/{{ latestTodos.length }}
                    </Badge>
                    <ChevronRight
                      class="h-3 w-3 text-muted-foreground transition-transform shrink-0"
                      :class="isTodoPanelOpen ? 'rotate-90' : ''"
                    />
                  </button>
                  <!-- 面板内容 -->
                  <div v-if="isTodoPanelOpen" class="px-3 pb-3 space-y-1">
                    <div
                      v-for="(todo, idx) in latestTodos"
                      :key="idx"
                      class="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px]"
                      :class="{
                        'bg-primary/5': todo.status === 'in_progress',
                        'opacity-60': todo.status === 'completed'
                      }"
                    >
                      <div class="shrink-0 w-4 h-4 flex items-center justify-center relative">
                        <div v-if="todo.status === 'completed'" class="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check class="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                        <template v-else-if="todo.status === 'in_progress'">
                          <span class="absolute w-5 h-5 rounded-full bg-primary/30 animate-ping"></span>
                          <div class="relative w-3 h-3 rounded-full bg-primary"></div>
                        </template>
                        <div v-else class="w-4 h-4 rounded-full border-2 border-muted-foreground/40"></div>
                      </div>
                      <span
                        class="flex-1 leading-tight"
                        :class="{
                          'line-through text-muted-foreground': todo.status === 'completed',
                          'text-primary font-medium': todo.status === 'in_progress',
                          'text-foreground/80': todo.status === 'pending'
                        }"
                      >{{ todo.content }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="p-8 h-full">
                <div
                  v-if="showStartupLoading"
                  class="h-full min-h-[320px] flex items-center justify-center"
                >
                  <div class="w-full max-w-lg rounded-xl border border-primary/20 bg-primary/5 px-6 py-7 shadow-sm">
                    <div class="flex items-center gap-3">
                      <div class="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <Loader2 class="h-4 w-4 text-primary animate-spin" />
                      </div>
                      <div class="space-y-0.5">
                        <p class="text-sm font-semibold text-foreground">任务正在启动中</p>
                        <p class="text-xs text-muted-foreground">系统正在预估产出并初始化执行环境，请稍候...</p>
                      </div>
                    </div>
                    <div class="mt-4">
                      <Progress :model-value="35" class="h-1.5 bg-primary/15 [&>div]:animate-pulse" />
                    </div>
                  </div>
                </div>
                <!-- 时间轴系统 -->
                <div v-else class="relative min-h-full">

                  <!-- 轴线 -->
                  <div class="absolute left-4 top-0 bottom-0 w-[2px] bg-primary/20"></div>

                  <!-- 时间轴节点流 -->
                  <div class="space-y-8">
                    <template v-for="(item, index) in processedStream" :key="index">
                    <div
                      v-if="!item.isTodoMerged"
                      class="relative pl-12"
                      :class="showRunningIndicator ? 'animate-in slide-in-from-top-2 duration-500' : ''"
                    >
                      <!-- 节点圆点 -->
                      <div class="absolute left-4 top-1.5 -translate-x-1/2 bg-background p-1 z-10 rounded-full flex items-center justify-center">
                        <span
                          class="w-2.5 h-2.5 rounded-full transition-colors duration-300 ring-2 ring-background"
                          :class="nodeStatusClass(getTimelineStatus(item))"
                        />
                      </div>

                      <!-- Type: System Init (系统初始化摘要卡片) -->
                      <div v-if="getDisplayType(item.event) === 'system-init' && item.initSummary">
                        <div class="bg-muted/30 border border-border/60 rounded-lg px-4 py-3">
                          <!-- 标题行 -->
                          <div class="flex items-center justify-between mb-2.5">
                            <div class="flex items-center gap-2">
                              <Rocket class="h-3.5 w-3.5 text-primary" />
                              <span class="text-xs font-bold text-foreground">系统就绪</span>
                              <span v-if="item.initSummary.taskNo" class="text-[10px] font-mono text-muted-foreground">
                                {{ item.initSummary.taskNo }}
                              </span>
                            </div>
                            <span class="text-[10px] text-muted-foreground font-mono">
                              {{ item.initSummary.timestamp }}
                            </span>
                          </div>
                          <!-- 任务内容 -->
                          <div v-if="item.initSummary.taskContent" class="text-xs text-foreground mb-2.5 bg-background/50 px-3 py-2 rounded border border-border/50">
                            任务已分配: {{ item.initSummary.taskContent }}
                          </div>
                          <!-- 摘要指标行 -->
                          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
                            <div v-if="item.initSummary.securityRules > 0" class="flex items-center gap-1.5 text-muted-foreground">
                              <Shield class="h-3 w-3 text-emerald-500/80" />
                              <span>安全规则 <span class="font-mono font-semibold text-foreground">{{ item.initSummary.securityRules }}</span></span>
                            </div>
                            <div v-if="item.initSummary.skills.length > 0" class="flex items-center gap-1.5 text-muted-foreground">
                              <Wrench class="h-3 w-3 text-amber-500/80" />
                              <span>Skills <span class="font-mono font-semibold text-foreground">{{ item.initSummary.skills.join(', ') }}</span></span>
                            </div>
                            <div v-if="item.initSummary.mcpServers.length > 0" class="flex items-center gap-1.5 text-muted-foreground">
                              <Plug class="h-3 w-3 text-blue-500/80" />
                              <span>MCP <span class="font-mono font-semibold text-foreground">{{ item.initSummary.mcpServers.join(', ') }}</span></span>
                            </div>
                            <div v-if="item.initSummary.configPath" class="flex items-center gap-1.5 text-muted-foreground">
                              <ServerCog class="h-3 w-3 text-muted-foreground/60" />
                              <span class="font-mono">{{ item.initSummary.configPath }}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Type: System End (任务完成摘要卡片) -->
                      <div v-else-if="getDisplayType(item.event) === 'system-end' && item.endSummary">
                        <div class="bg-emerald-500/5 border border-emerald-500/30 rounded-lg px-4 py-3">
                          <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                              <CircleCheckBig class="h-4 w-4 text-emerald-500" />
                              <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">任务执行完成</span>
                            </div>
                            <span class="text-[10px] text-muted-foreground font-mono">
                              {{ item.endSummary.timestamp }}
                            </span>
                          </div>
                          <div v-if="item.endSummary.durationStr || item.endSummary.costUsd" class="flex items-center gap-4 mt-2 text-[11px]">
                            <div v-if="item.endSummary.durationStr" class="flex items-center gap-1.5 text-muted-foreground">
                              <Timer class="h-3 w-3 text-emerald-500/70" />
                              <span>耗时 <span class="font-mono font-semibold text-foreground">{{ item.endSummary.durationStr }}</span></span>
                            </div>
                            <div v-if="item.endSummary.costUsd > 0" class="flex items-center gap-1.5 text-muted-foreground">
                              <Coins class="h-3 w-3 text-amber-500/70" />
                              <span>费用 <span class="font-mono font-semibold text-foreground">${{ item.endSummary.costUsd.toFixed(4) }}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Type: Skill (Skill 选择/使用摘要) -->
                      <div v-else-if="getDisplayType(item.event) === 'skill'">
                        <div class="flex items-center gap-2 mb-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-amber-500/10 text-amber-700 border-amber-300/60">
                            {{ item.event.event_type }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div class="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 rounded-lg px-3 py-3 space-y-2">
                          <div class="flex items-center justify-between gap-2">
                            <div class="text-xs font-bold text-amber-700 dark:text-amber-300">
                              {{ getSkillCardModel(item.event).title }}
                            </div>
                            <Badge v-if="getSkillCardModel(item.event).loadedCount !== undefined" variant="secondary" class="text-[9px] px-1.5 py-0">
                              已加载 {{ getSkillCardModel(item.event).loadedCount }}
                            </Badge>
                          </div>
                          <p v-if="getSkillCardModel(item.event).subtitle" class="text-[11px] text-muted-foreground leading-relaxed">
                            {{ getSkillCardModel(item.event).subtitle }}
                          </p>
                          <div class="space-y-1 text-[11px]">
                            <div v-if="getSkillCardModel(item.event).loaded.length > 0" class="text-foreground/90">
                              已加载：<span class="font-mono">{{ getSkillCardModel(item.event).loaded.join(', ') }}</span>
                            </div>
                            <div v-if="getSkillCardModel(item.event).selected.length > 0" class="text-foreground/90">
                              已选：<span class="font-mono">{{ getSkillCardModel(item.event).selected.join(', ') }}</span>
                            </div>
                            <div v-if="getSkillCardModel(item.event).required.length > 0" class="text-foreground/90">
                              必选：<span class="font-mono">{{ getSkillCardModel(item.event).required.join(', ') }}</span>
                            </div>
                            <div v-if="getSkillCardModel(item.event).suggested.length > 0" class="text-foreground/90">
                              建议：<span class="font-mono">{{ getSkillCardModel(item.event).suggested.join(', ') }}</span>
                            </div>
                            <div v-if="getSkillCardModel(item.event).referenced.length > 0" class="text-foreground/90">
                              已引用：<span class="font-mono">{{ getSkillCardModel(item.event).referenced.join(', ') }}</span>
                            </div>
                            <div v-if="getSkillCardModel(item.event).missing.length > 0" class="text-red-600 dark:text-red-400">
                              缺失：<span class="font-mono">{{ getSkillCardModel(item.event).missing.join(', ') }}</span>
                            </div>
                            <div v-if="getSkillCardModel(item.event).precisionHint" class="text-amber-700 dark:text-amber-300">
                              {{ getSkillCardModel(item.event).precisionHint }}
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Type: Async Tool (WebSearch/WebFetch/Skill) -->
                      <div v-else-if="getDisplayType(item.event) === 'tool-async'">
                        <div class="flex items-center gap-2 mb-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-sky-500/10 text-sky-700 border-sky-300/60 dark:text-sky-300 dark:border-sky-700/50">
                            {{ item.event.data?.tool_name || 'TOOL' }}
                          </Badge>
                          <Badge
                            variant="secondary"
                            class="text-[9px] px-1.5 py-0"
                            :class="{
                              'bg-amber-100 text-amber-700 border border-amber-200': getAsyncToolCardModel(item).status === 'running',
                              'bg-emerald-100 text-emerald-700 border border-emerald-200': getAsyncToolCardModel(item).status === 'success',
                              'bg-red-100 text-red-700 border border-red-200': getAsyncToolCardModel(item).status === 'error'
                            }"
                          >
                            {{ getAsyncToolCardModel(item).status === 'running' ? '执行中' : (getAsyncToolCardModel(item).status === 'success' ? '已完成' : '失败') }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div class="bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/50 rounded-lg px-3 py-3 space-y-2">
                          <div class="text-xs font-semibold text-sky-700 dark:text-sky-300">
                            {{ getAsyncToolCardModel(item).toolName }}
                          </div>
                          <div v-if="getAsyncToolCardModel(item).request" class="text-[11px] text-muted-foreground font-mono break-all">
                            {{ getAsyncToolCardModel(item).request }}
                          </div>
                          <div class="text-[11px] text-foreground/90 leading-relaxed break-all">
                            {{ getAsyncToolCardModel(item).summary }}
                          </div>
                          <div v-if="getAsyncToolCardModel(item).durationLabel" class="text-[10px] text-muted-foreground font-mono">
                            耗时 {{ getAsyncToolCardModel(item).durationLabel }}
                          </div>
                        </div>
                      </div>

                      <!-- Type: Ask User (AskUserQuestion) -->
                      <div v-else-if="getDisplayType(item.event) === 'ask-user'">
                        <div class="flex items-center gap-2 mb-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-violet-500/10 text-violet-700 border-violet-300/60 dark:text-violet-300 dark:border-violet-700/50">
                            {{ item.event.data?.tool_name || 'AskUserQuestion' }}
                          </Badge>
                          <Badge variant="secondary" class="text-[9px] px-1.5 py-0">
                            {{ item.event.event_type === 'TOOL_CALL' ? '发起提问' : '提问结果' }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div class="bg-violet-50/70 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/50 rounded-lg px-3 py-3 space-y-3">
                          <div class="text-xs font-semibold text-violet-700 dark:text-violet-300">
                            {{ getAskUserCardModel(item.event).title }} · {{ getAskUserCardModel(item.event).summary }}
                          </div>
                          <div
                            v-for="question in getAskUserCardModel(item.event).questions"
                            :key="question.id"
                            class="rounded-md border border-violet-200/60 dark:border-violet-800/40 bg-background/70 px-3 py-2 space-y-2"
                          >
                            <div class="text-[11px] font-semibold text-foreground">
                              {{ question.header }}
                            </div>
                            <p class="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                              {{ question.question || '（无问题文案）' }}
                            </p>
                            <div v-if="question.options.length > 0" class="flex flex-wrap gap-1.5">
                              <div
                                v-for="(option, index) in question.options"
                                :key="`${question.id}-${index}`"
                                class="inline-flex items-center gap-1 rounded-full border border-violet-200/70 dark:border-violet-800/50 px-2 py-0.5 text-[10px] text-violet-700 dark:text-violet-300"
                                :title="option.description"
                              >
                                <span>{{ option.label }}</span>
                                <span v-if="option.description" class="text-violet-500/80">· {{ option.description }}</span>
                              </div>
                            </div>
                            <div class="text-[10px] text-muted-foreground">
                              回答：<span class="font-medium text-foreground/85">{{ question.answer || '未作答' }}</span>
                              <span v-if="question.multiSelect" class="ml-2 text-[10px]">（可多选）</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Type: Thinking (对话/思考) -->
                      <div v-else-if="getDisplayType(item.event) === 'thinking'">
                        <div class="flex items-center gap-2 mb-1">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-muted/30 text-muted-foreground border-muted-foreground/20">
                            {{ getEventTypeLabel(item.event) }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <p class="text-foreground leading-relaxed mb-2 font-medium whitespace-pre-wrap break-words">{{ getDisplayContent(item.event) }}</p>
                        <!-- View Report Button (TASK-FE-036) -->
                        <div v-if="getDisplayContent(item.event).includes('报告已生成')" class="mt-4 animate-in fade-in slide-in-from-top-2 duration-700 delay-500">
                          <Button
                            size="sm"
                            class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20"
                            @click="showReport = true"
                          >
                            <FileCheck2 class="mr-2 h-4 w-4" />
                            查看执行报告
                          </Button>
                        </div>
                      </div>

                      <!-- Type: Terminal (去容器化终端) -->
                      <div v-else-if="getDisplayType(item.event) === 'terminal'">
                        <div class="flex items-center gap-2 mb-1">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-muted/30 text-muted-foreground border-muted-foreground/20">
                            {{ item.event.event_type }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div class="font-mono text-sm text-foreground font-bold mb-2 flex items-center gap-2 min-w-0">
                          <div class="flex items-center gap-2 min-w-0">
                            <Terminal class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span class="text-primary/80 shrink-0">$</span>
                            <span class="truncate">{{ getTerminalLines(item.event)[0] }}</span>
                            <button
                              v-if="isTerminalAutoCollapsible(item, index)"
                              type="button"
                              class="h-5 w-5 shrink-0 inline-flex items-center justify-center rounded border border-border/60 bg-background/70 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                              @click.stop="toggleTerminalCollapse(index)"
                            >
                              <ChevronDown v-if="isTerminalCollapsed(item, index)" class="h-3.5 w-3.5" />
                              <ChevronUp v-else class="h-3.5 w-3.5" />
                            </button>
                            <Check v-if="getNodeStatus(item.event) === 'completed'" class="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <X v-if="getNodeStatus(item.event) === 'error'" class="h-3.5 w-3.5 text-red-500 shrink-0" />
                          </div>
                        </div>
                        <div
                          v-if="getTerminalBodyLines(item, index).length > 0"
                          class="font-mono text-sm text-muted-foreground pl-6 border-l-2 border-muted/30 ml-[7px]"
                        >
                          <div v-for="(line, i) in getTerminalBodyLines(item, index)" :key="i" class="min-h-[1.25rem] break-all whitespace-pre-wrap py-0.5">
                            {{ line }}
                          </div>
                          <div
                            v-if="getTerminalHiddenLineCount(item, index) > 0"
                            class="text-xs text-muted-foreground/80 pt-1"
                          >
                            还有 {{ getTerminalHiddenLineCount(item, index) }} 行...
                          </div>
                        </div>
                      </div>

                      <!-- Type: Code (文件操作 TOOL_CALL: Write/Read) -->
                      <div v-else-if="getDisplayType(item.event) === 'code'">
                        <div class="flex items-center gap-2 mb-1">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-muted/30 text-muted-foreground border-muted-foreground/20">
                            {{ item.event.event_type }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <!-- 文件操作卡片（TOOL_CALL + 递进状态）(TASK-FE-273) -->
                        <div v-if="item.event.event_type === 'TOOL_CALL' && isFileOpTool(item.event)"
                             class="bg-muted/20 border border-border/50 rounded-lg p-3 my-2">
                          <div class="text-sm text-foreground font-medium">
                            {{ String(getDisplayContent(item.event)).split('\n')[0] }}
                          </div>
                          <div v-if="getFileOpFullPath(item.event)" class="text-xs text-muted-foreground font-mono mt-1 truncate" :title="getFileOpFullPath(item.event)">
                            {{ getFileOpFullPath(item.event) }}
                          </div>
                          <div v-if="item.toolResult"
                               class="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CircleCheckBig class="h-3.5 w-3.5" />
                            <span>{{ getFileOpCompletionText(item) }}</span>
                          </div>
                        </div>
                        <!-- 非文件操作的 code（保持原逻辑用 CodeContainer） -->
                        <CodeContainer
                          v-else
                          :code="typeof getDisplayContent(item.event) === 'object' ? (getDisplayContent(item.event)?.code || '') : String(getDisplayContent(item.event))"
                          :lang="typeof getDisplayContent(item.event) === 'object' ? (getDisplayContent(item.event)?.lang || 'text') : 'text'"
                          class="my-4"
                        />
                      </div>

                      <!-- Type: Diff (StrReplace/Edit TOOL_CALL) -->
                      <div v-else-if="getDisplayType(item.event) === 'diff'">
                        <div class="flex items-center gap-2 mb-1">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-muted/30 text-muted-foreground border-muted-foreground/20">
                            {{ item.event.event_type }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <!-- 文件编辑操作卡片（TOOL_CALL + 递进状态）(TASK-FE-273) -->
                        <div v-if="item.event.event_type === 'TOOL_CALL' && isFileOpTool(item.event)"
                             class="bg-muted/20 border border-border/50 rounded-lg p-3 my-2">
                          <div class="text-sm text-foreground font-medium">
                            {{ String(getDisplayContent(item.event)).split('\n')[0] }}
                          </div>
                          <div v-if="getFileOpFullPath(item.event)" class="text-xs text-muted-foreground font-mono mt-1 truncate" :title="getFileOpFullPath(item.event)">
                            {{ getFileOpFullPath(item.event) }}
                          </div>
                          <div v-if="item.toolResult"
                               class="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CircleCheckBig class="h-3.5 w-3.5" />
                            <span>{{ getFileOpCompletionText(item) }}</span>
                          </div>
                        </div>
                        <!-- 非文件操作的 diff（保持原逻辑用 CodeContainer） -->
                        <CodeContainer
                          v-else
                          :code="getDisplayContent(item.event)"
                          lang="diff"
                          class="my-4"
                        />
                      </div>

                      <!-- Type: AI Response (AI 文本回复) -->
                      <div v-else-if="getDisplayType(item.event) === 'ai-response'">
                        <div class="flex items-center gap-2 mb-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                            {{ item.event.event_type }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div
                          class="rounded-lg px-4 py-3 text-sm bg-muted/30 border border-border/50"
                        >
                          <MarkdownRenderer :content="getDisplayContent(item.event)" />
                        </div>
                      </div>

                      <!-- Type: Approval (审批交互卡片) -->
                      <div v-else-if="getDisplayType(item.event) === 'approval'">
                        <div class="flex items-center gap-2 mb-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-200/50">
                            {{ item.event.event_type }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div class="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50 rounded-lg p-4">
                          <div class="flex items-start gap-3">
                            <Shield class="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                            <div class="flex-1 space-y-2">
                              <div class="text-sm font-bold text-amber-700 dark:text-amber-300">
                                {{ item.event.event_type === 'USER_CONFIRM_RESOLVED' ? '审批已处理' : '需要人工审批' }}
                              </div>
                              <div v-if="item.event.data?.command" class="font-mono text-xs bg-background/80 rounded p-2 border border-border/50">
                                $ {{ item.event.data.command }}
                              </div>
                              <div v-if="item.event.data?.reason" class="text-xs text-muted-foreground">
                                {{ item.event.data.reason }}
                              </div>
                              <div v-if="item.event.data?.risk_level" class="flex items-center gap-1.5">
                                <Badge variant="outline" class="text-[9px] px-1.5 py-0"
                                  :class="{
                                    'bg-yellow-100 text-yellow-700 border-yellow-300': item.event.data.risk_level === 'medium',
                                    'bg-red-100 text-red-700 border-red-300': item.event.data.risk_level === 'high' || item.event.data.risk_level === 'critical',
                                    'bg-green-100 text-green-700 border-green-300': item.event.data.risk_level === 'low',
                                  }">
                                  {{ ({ low: '低风险', medium: '中风险', high: '高风险', critical: '极高风险' } as Record<string, string>)[item.event.data.risk_level] || item.event.data.risk_level }}
                                </Badge>
                              </div>
                              <!-- USER_CONFIRM_REQUEST: 操作按钮 -->
                              <div v-if="item.event.event_type === 'USER_CONFIRM_REQUEST'" class="flex items-center gap-2 pt-1">
                                <template v-if="props.isSharedView">
                                  <Badge class="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                                    待处理
                                  </Badge>
                                </template>
                                <template v-else-if="getApprovalState(item.event.data?.approval_no).status === 'pending'">
                                  <Button
                                    size="sm"
                                    class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                                    :disabled="getApprovalState(item.event.data?.approval_no).loading"
                                    @click="handleApproval(item.event.data?.approval_no, 'approved')"
                                  >
                                    <Check class="h-3 w-3 mr-1" /> 批准
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    class="text-xs h-7"
                                    :disabled="getApprovalState(item.event.data?.approval_no).loading"
                                    @click="handleApproval(item.event.data?.approval_no, 'rejected')"
                                  >
                                    <X class="h-3 w-3 mr-1" /> 拒绝
                                  </Button>
                                  <Loader2 v-if="getApprovalState(item.event.data?.approval_no).loading" class="h-4 w-4 animate-spin text-muted-foreground" />
                                </template>
                                <Badge v-else-if="getApprovalState(item.event.data?.approval_no).status === 'approved'" class="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  <Check class="h-3 w-3 mr-1" /> 已批准
                                </Badge>
                                <Badge v-else class="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400">
                                  <X class="h-3 w-3 mr-1" /> 已拒绝
                                </Badge>
                              </div>
                              <!-- USER_CONFIRM_RESOLVED: 结果展示 -->
                              <div v-if="item.event.event_type === 'USER_CONFIRM_RESOLVED'" class="flex items-center gap-2 pt-1">
                                <Badge v-if="item.event.data?.decision === 'approved'" class="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  <Check class="h-3 w-3 mr-1" /> 已批准
                                </Badge>
                                <Badge v-else class="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400">
                                  <X class="h-3 w-3 mr-1" /> 已拒绝
                                </Badge>
                                <span v-if="item.event.data?.operator" class="text-[10px] text-muted-foreground">
                                  by {{ item.event.data.operator }}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Type: Artifacts (产出物卡片) -->
                      <div v-else-if="getDisplayType(item.event) === 'artifacts'">
                        <div class="flex items-center gap-2 mb-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            {{ item.event.event_type === 'TASK_OUTPUT_PATHLIST_READY' ? '工作区变更' : '产出物' }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/50 rounded-lg p-4">
                          <div class="flex items-center gap-2 mb-3">
                            <FileCheck2 class="h-4 w-4 text-emerald-500" />
                            <span class="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                              {{ item.event.event_type === 'TASK_OUTPUT_PATHLIST_READY' ? '工作区变更就绪' : '产出物就绪' }}
                            </span>
                            <Badge variant="secondary" class="text-[9px] px-1.5 py-0">
                              {{ getArtifactTotalCount(item.event) }} 个文件
                            </Badge>
                          </div>
                          <div v-if="getArtifactTotalCount(item.event) > 0" class="space-y-3">
                            <div class="flex flex-wrap gap-1.5">
                              <Badge
                                v-for="bucket in getArtifactTypeBuckets(item.event).slice(0, 5)"
                                :key="bucket.type"
                                variant="outline"
                                class="text-[10px] bg-background/70 border-emerald-300/70 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                              >
                                {{ bucket.type }} · {{ bucket.count }}
                              </Badge>
                              <Badge
                                v-if="getArtifactTypeBuckets(item.event).length > 5"
                                variant="outline"
                                class="text-[10px] bg-background/70 border-emerald-300/70 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                              >
                                +{{ getArtifactTypeBuckets(item.event).length - 5 }} 种
                              </Badge>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              class="h-8 text-xs"
                              @click.stop="openOutputArtifactsDialog(item.event)"
                            >
                              查看产出物
                              <ChevronRight class="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div v-else class="text-xs text-muted-foreground">
                            当前暂无可展示文件，请稍后刷新任务详情。
                          </div>
                        </div>
                      </div>

                      <!-- Type: Error (错误事件) -->
                      <div v-else-if="getDisplayType(item.event) === 'error'">
                        <div class="flex items-center gap-2 mb-1">
                          <Badge variant="destructive" class="text-[9px] font-mono px-1.5 py-0">
                            {{ getEventTypeLabel(item.event) }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div class="bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 rounded-lg p-3">
                          <div class="flex items-start gap-2">
                            <AlertTriangle class="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <p class="text-red-700 dark:text-red-300 text-sm font-medium">{{ getDisplayContent(item.event) }}</p>
                          </div>
                        </div>
                      </div>

                      <!-- Type: Security (安全审核通过) -->
                      <div v-else-if="getDisplayType(item.event) === 'security'">
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-200/50">
                            {{ item.event.event_type }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                          <ShieldCheck class="h-3.5 w-3.5 text-emerald-500" />
                          <span class="text-xs text-emerald-600 font-medium">{{ getDisplayContent(item.event) }}</span>
                        </div>
                      </div>

                      <!-- Type: Todo (TodoWrite 工具) -->
                      <!-- MCP 工具调用 -->
                      <div v-else-if="getDisplayType(item.event) === 'mcp'">
                        <div class="flex items-center gap-2 mb-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30">
                            MCP
                          </Badge>
                          <Badge variant="secondary" class="text-[9px] px-1.5 py-0">
                            {{ item.event.data?.mcp_server || '' }}
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>
                        <div class="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 rounded-lg px-3 py-2">
                          <div class="flex items-center gap-1.5 mb-1">
                            <Globe class="h-3.5 w-3.5 text-teal-500" />
                            <span class="text-xs font-medium text-teal-700 dark:text-teal-300">{{ item.event.data?.mcp_tool || item.event.data?.tool_name || '' }}</span>
                          </div>
                          <pre class="text-[11px] text-muted-foreground whitespace-pre-wrap break-all font-mono leading-relaxed max-h-[200px] overflow-y-auto">{{ getDisplayContent(item.event) }}</pre>
                        </div>
                      </div>

                      <div v-else-if="getDisplayType(item.event) === 'todo'">
                        <div class="flex items-center gap-2 mb-2">
                          <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 bg-primary/5 text-primary border-primary/30">
                            {{ item.event.event_type }}
                          </Badge>
                          <Badge variant="secondary" class="text-[9px] px-1.5 py-0">
                            TodoWrite
                          </Badge>
                          <span class="text-[10px] text-muted-foreground font-mono">{{ formatEventTimestamp(item.event.timestamp) }}</span>
                        </div>

                        <!-- Todo 列表展示 -->
                        <div class="bg-muted/30 border border-border rounded-lg p-3">
                          <template v-if="parseTodoData(item.event).type === 'call'">
                            <div class="text-xs text-primary font-medium mb-2">更新任务列表</div>
                            <div class="space-y-1.5">
                              <div
                                v-for="(todo, idx) in parseTodoData(item.event).todos"
                                :key="idx"
                                class="flex items-center gap-2.5 bg-background/80 rounded-md px-2.5 py-2 text-sm border border-border/50"
                              >
                                <!-- 状态图标 -->
                                <div class="shrink-0 w-5 h-5 flex items-center justify-center relative">
                                  <!-- 已完成：实心圆 + 对勾 -->
                                  <div v-if="todo.status === 'completed'" class="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                    <Check class="w-3 h-3 text-primary-foreground" />
                                  </div>
                                  <!-- 进行中：闪烁实心圆 + 扩散环效果 -->
                                  <template v-else-if="todo.status === 'in_progress'">
                                    <span class="absolute w-6 h-6 rounded-full bg-blue-500/40 animate-ping"></span>
                                    <span class="absolute w-5 h-5 rounded-full bg-primary/60 animate-pulse"></span>
                                    <div class="relative w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_16px_6px_rgba(59,130,246,0.6)]"></div>
                                  </template>
                                  <!-- 待处理：空心圆 -->
                                  <div v-else-if="todo.status === 'pending'" class="w-5 h-5 rounded-full border-2 border-muted-foreground/50"></div>
                                  <!-- 已取消：圆圈里 X -->
                                  <div v-else-if="todo.status === 'cancelled'" class="w-5 h-5 rounded-full border-2 border-destructive flex items-center justify-center">
                                    <X class="w-3 h-3 text-destructive" />
                                  </div>
                                  <!-- 默认：空心圆 -->
                                  <div v-else class="w-5 h-5 rounded-full border-2 border-muted-foreground/30"></div>
                                </div>
                                <span
                                  class="flex-1"
                                  :class="{
                                    'text-foreground': todo.status === 'completed' || todo.status === 'in_progress',
                                    'text-muted-foreground': todo.status === 'pending',
                                    'text-muted-foreground line-through': todo.status === 'cancelled'
                                  }"
                                >{{ todo.content }}</span>
                                <Badge
                                  variant="outline"
                                  class="text-[9px] px-1.5 py-0 shrink-0"
                                  :class="{
                                    'border-primary/50 text-primary bg-primary/5': todo.status === 'completed',
                                    'border-primary/50 text-primary bg-primary/10 animate-pulse': todo.status === 'in_progress',
                                    'border-muted-foreground/30 text-muted-foreground': todo.status === 'pending',
                                    'border-destructive/50 text-destructive': todo.status === 'cancelled'
                                  }"
                                >
                                  {{ getTodoStatusText(todo.status) }}
                                </Badge>
                              </div>
                            </div>
                          </template>

                          <template v-else>
                            <div class="text-xs text-primary font-medium mb-2">任务列表已更新</div>
                            <div class="space-y-1.5">
                              <div
                                v-for="(todo, idx) in parseTodoData(item.event).newTodos"
                                :key="idx"
                                class="flex items-center gap-2.5 bg-background/80 rounded-md px-2.5 py-2 text-sm border border-border/50"
                              >
                                <!-- 状态图标 -->
                                <div class="shrink-0 w-5 h-5 flex items-center justify-center relative">
                                  <!-- 已完成：实心圆 + 对勾 -->
                                  <div v-if="todo.status === 'completed'" class="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                    <Check class="w-3 h-3 text-primary-foreground" />
                                  </div>
                                  <!-- 进行中：闪烁实心圆 + 扩散环效果 -->
                                  <template v-else-if="todo.status === 'in_progress'">
                                    <span class="absolute w-6 h-6 rounded-full bg-blue-500/40 animate-ping"></span>
                                    <span class="absolute w-5 h-5 rounded-full bg-primary/60 animate-pulse"></span>
                                    <div class="relative w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_16px_6px_rgba(59,130,246,0.6)]"></div>
                                  </template>
                                  <!-- 待处理：空心圆 -->
                                  <div v-else-if="todo.status === 'pending'" class="w-5 h-5 rounded-full border-2 border-muted-foreground/50"></div>
                                  <!-- 已取消：圆圈里 X -->
                                  <div v-else-if="todo.status === 'cancelled'" class="w-5 h-5 rounded-full border-2 border-destructive flex items-center justify-center">
                                    <X class="w-3 h-3 text-destructive" />
                                  </div>
                                  <!-- 默认：空心圆 -->
                                  <div v-else class="w-5 h-5 rounded-full border-2 border-muted-foreground/30"></div>
                                </div>
                                <span
                                  class="flex-1"
                                  :class="{
                                    'text-foreground': todo.status === 'completed' || todo.status === 'in_progress',
                                    'text-muted-foreground': todo.status === 'pending',
                                    'text-muted-foreground line-through': todo.status === 'cancelled'
                                  }"
                                >{{ todo.content }}</span>
                                <Badge
                                  variant="outline"
                                  class="text-[9px] px-1.5 py-0 shrink-0"
                                  :class="{
                                    'border-primary/50 text-primary bg-primary/5': todo.status === 'completed',
                                    'border-primary/50 text-primary bg-primary/10 animate-pulse': todo.status === 'in_progress',
                                    'border-muted-foreground/30 text-muted-foreground': todo.status === 'pending',
                                    'border-destructive/50 text-destructive': todo.status === 'cancelled'
                                  }"
                                >
                                  {{ getTodoStatusText(todo.status) }}
                                </Badge>
                              </div>
                            </div>
                            <!-- 如果解析失败显示原始数据 -->
                            <div v-if="parseTodoData(item.event).raw && parseTodoData(item.event).newTodos.length === 0" class="text-xs text-muted-foreground font-mono mt-2 break-all">
                              {{ parseTodoData(item.event).raw }}
                            </div>
                          </template>
                        </div>
                      </div>

                    </div>
                    </template>

                    <div
                      v-if="showRunningIndicator"
                      class="relative pl-12"
                    >
                      <div class="absolute left-4 top-1.5 -translate-x-1/2 bg-background p-1 z-10 rounded-full flex items-center justify-center">
                        <Loader2 class="h-3.5 w-3.5 text-primary animate-spin" />
                      </div>
                      <div class="flex items-center gap-2 text-xs text-primary font-medium">
                        <span>任务执行中，持续输出中...</span>
                        <span class="text-[10px] text-muted-foreground font-mono">{{ profile?.usage?.duration || '0s' }}</span>
                      </div>
                    </div>

                    <!-- 底部锚点，用于自动滚动 -->
                    <div ref="streamEndRef" class="h-1"></div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="workspace" class="flex-1 min-h-0 !mt-0 overflow-hidden">
            <WorkspaceExplorer />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  </div>

  <Dialog v-model:open="outputArtifactsDialogOpen">
    <DialogContent class="w-[min(92vw,860px)] max-w-none h-[80vh] min-h-[520px] max-h-[760px] p-0 gap-0 overflow-hidden border-border/70 shadow-2xl flex flex-col">
      <DialogHeader class="border-b border-border/60 bg-muted/[0.35] px-6 py-3.5 shrink-0">
        <div class="flex items-center justify-between gap-4 pr-8">
          <div class="space-y-0.5 text-left">
            <DialogTitle class="text-sm font-semibold tracking-tight">任务产出文件</DialogTitle>
            <DialogDescription class="mt-1 text-xs leading-7 text-muted-foreground">
              <span v-if="outputArtifactStats.totalFiles > 0">
                共 {{ outputArtifactStats.totalFiles }} 个文件
                <span v-if="outputArtifactStats.totalDirs > 0">，{{ outputArtifactStats.totalDirs }} 个目录</span>
                <span v-if="outputArtifactStats.totalSize > 0">，总计 {{ formatFileSize(outputArtifactStats.totalSize) }}</span>
              </span>
              <span v-else>暂无可展示文件</span>
            </DialogDescription>
          </div>
          <div class="flex items-center gap-2">
            <Button
              v-if="outputArtifactStats.totalFiles > 0"
              variant="secondary"
              size="sm"
              class="shrink-0"
              :disabled="isBatchDownloading"
              @click="handleDownloadAllArtifacts"
            >
              <Loader2 v-if="isBatchDownloading" class="h-3 w-3 mr-1 animate-spin" />
              <Download v-else class="h-3 w-3 mr-1" />
              {{ outputArtifactStats.totalFiles > 1 ? '下载全部 ZIP' : '下载文件' }}
            </Button>
            <Button
              v-if="canOpenWorkspaceOutput"
              variant="outline"
              size="sm"
              class="h-7 shrink-0 text-[11px] px-2.5"
              @click="handleOpenWorkspaceOutput(outputArtifactsDialogPayload || undefined)"
            >
              <FolderOpen class="h-3 w-3 mr-1" />
              打开产出空间
              <ExternalLink class="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div class="flex-1 min-h-0 bg-muted/[0.24] p-3">
        <div class="h-full min-h-0 overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm flex flex-col">
          <div v-if="selectedArtifactIds.size > 0" class="flex items-center gap-3 px-4 py-2.5 border-b bg-primary/[0.04] shrink-0">
            <span class="text-xs text-muted-foreground">已选 <strong class="text-foreground">{{ selectedArtifactIds.size }}</strong> 个文件</span>
            <Button variant="outline" size="sm" class="h-7 text-[11px] px-2.5" :disabled="isBatchDownloading" @click="handleBatchDownload">
              <Loader2 v-if="isBatchDownloading" class="h-3 w-3 mr-1 animate-spin" />
              <Download v-else class="h-3 w-3 mr-1" />
              {{ isBatchDownloading ? '打包下载中...' : '批量下载（ZIP）' }}
            </Button>
            <Button variant="ghost" size="sm" class="h-7 text-[11px] px-2 ml-auto" @click="clearArtifactSelection">取消选择</Button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto">
            <template v-if="outputArtifactFlatRows.length > 0">
              <div class="sticky top-0 z-10 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="grid grid-cols-[30px_minmax(0,1fr)_88px_96px] items-stretch bg-muted/10 text-[11px] text-muted-foreground">
                  <div class="flex items-center justify-center border-r border-border/60 px-1.5 py-2">
                    <Checkbox
                      :checked="isAllArtifactsSelected ? true : (isSomeArtifactsSelected ? 'indeterminate' : false)"
                      class="h-3.5 w-3.5 rounded-[2px] border-border"
                      @update:checked="handleToggleSelectAll"
                    >
                      <Check class="h-3 w-3" />
                    </Checkbox>
                  </div>
                  <span class="flex items-center justify-center px-2">名称</span>
                  <span class="flex items-center border-l border-border/60 px-3">大小</span>
                  <span class="flex items-center justify-center border-l border-border/60 px-2">操作</span>
                </div>
              </div>
              <div
                v-for="artifact in outputArtifactFlatRows"
                :key="artifact.id"
                class="group grid grid-cols-[30px_minmax(0,1fr)_88px_96px] items-stretch border-b border-border/35 transition-colors"
                :class="selectedArtifactIds.has(artifact.id) ? 'bg-primary/10' : 'bg-background/80 hover:bg-muted/30'"
                @click="handleArtifactRowSelect(artifact, $event)"
              >
                <div class="flex items-center justify-center border-r border-border/50 px-1.5">
                  <Checkbox
                    :checked="selectedArtifactIds.has(artifact.id)"
                    class="h-3.5 w-3.5 rounded-[2px] border-border"
                    @update:checked="handleArtifactCheckboxUpdate(artifact.id, $event)"
                  >
                    <Check class="h-3 w-3" />
                  </Checkbox>
                </div>

                <div class="min-w-0 flex items-center px-2 py-1.5">
                  <component
                    :is="getArtifactIcon(artifact.name)"
                    class="h-4 w-4 shrink-0"
                    :class="getArtifactIconColor(artifact.name)"
                  />
                  <span
                    class="ml-1 truncate text-sm font-mono cursor-pointer hover:text-primary hover:underline"
                    @click.stop="artifact.url ? handleArtifactPreview(artifact) : undefined"
                  >
                    {{ formatArtifactDisplayPath(artifact) }}
                  </span>
                </div>

                <span class="flex items-center border-l border-border/50 px-3 text-xs text-muted-foreground tabular-nums">
                  {{ artifact.size != null ? formatFileSize(artifact.size) : '' }}
                </span>

                <div class="flex items-center justify-center gap-1 border-l border-border/50 px-2">
                  <Button
                    v-if="artifact.url"
                    size="icon"
                    variant="ghost"
                    class="h-8 w-8 rounded-md border border-border/50 bg-background/70 text-muted-foreground transition-colors hover:border-border hover:text-foreground hover:bg-muted/60"
                    title="预览"
                    @click.stop="handleArtifactPreview(artifact)"
                  >
                    <Eye class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    v-if="artifact.url"
                    size="icon"
                    variant="ghost"
                    class="h-8 w-8 rounded-md border border-border/50 bg-background/70 text-muted-foreground transition-colors hover:border-border hover:text-foreground hover:bg-muted/60"
                    title="下载"
                    @click.stop="handleArtifactDownload(artifact)"
                  >
                    <Download class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </template>

            <div
              v-else
              class="px-4 py-10 text-center text-sm text-muted-foreground"
            >
              暂无可展示文件
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Mission Completion Report Dialog (TASK-FE-032) -->
  <MissionReportDialog
    v-model:open="showReport"
    :mission-id="missionId"
    :report="profile?.report"
  />

  <!-- Artifact Preview Dialog -->
  <ArtifactPreviewDialog
    v-model:open="artifactPreviewOpen"
    :artifact="artifactPreviewTarget"
  />
</template>
