<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Search, Settings2, SlidersHorizontal, ShieldCheck, Box, Terminal, FileCode, Server,
  ArrowUp, Sparkles, Database, Cpu, TrendingUp, Paperclip, Globe,
  GitBranch, Clock, BarChart3, CheckCircle2, Loader2, Mic, ChevronRight, Activity, Calendar,
  Plus, Trash2, ChevronDown, Bot, FileJson, Copy, Check, Users, Briefcase, ChevronLeft, AtSign
} from 'lucide-vue-next'
import { useMission } from '@/composables/useMission'
import { useUser } from '@/composables/useUser'
import { toast } from 'vue-sonner'
import EnvVarDialog from '@/components/business/EnvVarDialog.vue'
import CodeContainer from '@/components/business/CodeContainer.vue'
import FilePickerDialog from '@/components/business/FilePickerDialog.vue'
import PromptEditor from '@/components/business/PromptEditor.vue'
import ModelProviderIcon from '@/components/business/ModelProviderIcon.vue'
import type { FileItem, FileNodeItem } from '@/api/fileManager'

const isAdvancedOpen = ref(false)
const isFilePickerOpen = ref(false)
const filePickerMode = ref<'select' | 'upload'>('select')
const isEnvOpen = ref(false)
const isSidecarDialogOpen = ref(false)
const { startMission } = useMission()
const { user, fetchUser } = useUser()

// AI Model & Resource Management (TASK-FE-059/071/076/089/091/092)
const modelMode = ref<'simple' | 'advanced' | 'sidecar'>('simple')
type ModelBrand = 'claude' | 'openai' | 'google' | 'deepseek' | 'kimi' | 'doubao' | 'glm' | 'qwen' | 'unknown'

interface ModelOption {
  id: string
  name: string
  brand: ModelBrand
  enabled: boolean
}

const selectedModel = ref('')
const modelList = ref<ModelOption[]>([])
const selectedModelOption = computed(() => modelList.value.find(m => m.id === selectedModel.value))

const fallbackModels: ModelOption[] = [
  { id: 'claude-opus-4', name: 'claude-opus-4', brand: 'claude', enabled: true },
  { id: 'gpt-5', name: 'gpt-5', brand: 'openai', enabled: true },
  { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', brand: 'google', enabled: true },
  { id: 'deepseek-v3', name: 'deepseek-v3', brand: 'deepseek', enabled: true },
  { id: 'kimi-k2-5-thinking', name: 'kimi-k2-5-thinking', brand: 'kimi', enabled: true }
]

const modelRegistryApi = '/api/v1/models'

const splitCsv = (raw: unknown): string[] =>
  String(raw ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

const normalizeIdentity = (raw: unknown): string =>
  String(raw ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '')
    .replace(/['"`._-]/g, '')
    .toLowerCase()

const defaultAllModelAccessList: string[] = []

const modelAllAccessWhitelist = new Set(
  [...defaultAllModelAccessList, ...splitCsv(import.meta.env.VITE_MODEL_ALL_ACCESS_WHITELIST)]
    .map(normalizeIdentity)
)

const configuredModelAllowList = splitCsv(import.meta.env.VITE_MODEL_DEFAULT_ALLOW_LIST)
const normalizeModelId = (raw: unknown): string =>
  String(raw ?? '')
    .trim()
    .toLowerCase()
const modelAllowList = new Set(configuredModelAllowList.map(normalizeModelId).filter(Boolean))

const matchAllAccessWhitelist = (identity: string): boolean => {
  if (!identity) return false
  if (modelAllAccessWhitelist.has(identity)) return true
  for (const allowed of modelAllAccessWhitelist) {
    if (!allowed) continue
    if (identity.includes(allowed) || allowed.includes(identity)) {
      return true
    }
  }
  return false
}

const isModelAllAccessUser = computed(() => {
  const current = user.value as Record<string, unknown> | null
  if (!current) return false
  const explicitCandidates = [current.userId, current.workId, current.email, current.name]
  const dynamicCandidates = Object.values(current).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  const normalizedCandidates = Array.from(
    new Set([...explicitCandidates, ...dynamicCandidates].map(normalizeIdentity).filter(Boolean))
  )
  return normalizedCandidates.some(matchAllAccessWhitelist)
})

const applyModelVisibility = (models: ModelOption[]): ModelOption[] => {
  if (isModelAllAccessUser.value) {
    return models.map(model => ({
      ...model,
      enabled: true
    }))
  }

  if (modelAllowList.size === 0) {
    return models
  }

  const filtered = models.filter(model => modelAllowList.has(normalizeModelId(model.id)))
  return filtered.length > 0 ? filtered : models
}

const inferModelBrand = (modelId: string): ModelBrand => {
  const normalized = modelId.toLowerCase()
  if (normalized.includes('claude')) return 'claude'
  if (normalized.includes('gpt') || normalized.includes('openai') || normalized.includes('chatgpt') || /^o[134]/.test(normalized)) return 'openai'
  if (normalized.includes('deepseek')) return 'deepseek'
  if (normalized.includes('gemini') || normalized.includes('google')) return 'google'
  if (normalized.includes('kimi') || normalized.includes('moonshot')) return 'kimi'
  if (normalized.includes('doubao')) return 'doubao'
  if (normalized.includes('glm') || normalized.includes('zhipu') || normalized.includes('chatglm')) return 'glm'
  if (normalized.includes('qwen') || normalized.includes('tongyi') || normalized.includes('qwq') || normalized.includes('qvq')) return 'qwen'
  return 'unknown'
}

const parseModelEnabled = (rawStatus: unknown): boolean => {
  if (rawStatus === null || rawStatus === undefined || rawStatus === '') return true
  if (typeof rawStatus === 'number') return rawStatus === 1
  const normalized = String(rawStatus).trim().toLowerCase()
  if (!normalized) return true
  if (normalized === '1' || normalized === 'true' || normalized === 'enabled' || normalized === 'available' || normalized === 'online' || normalized === 'active') {
    return true
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'disabled' || normalized === 'unavailable' || normalized === 'offline' || normalized === 'inactive') {
    return false
  }
  return true
}

const fetchModels = async () => {
  try {
    const response = await fetch(modelRegistryApi, { method: 'GET' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const result = await response.json()
    const rawModels: any[] = Array.isArray(result?.data) ? result.data : []
    const modelMap = new Map<string, ModelOption>()

    for (const item of rawModels) {
      const modelId = typeof item === 'string'
        ? item.trim()
        : String(item?.id ?? item?.code ?? item?.model ?? item?.name ?? '').trim()
      if (!modelId) continue

      const enabled = parseModelEnabled(item?.status)
      const existing = modelMap.get(modelId)
      if (existing) {
        // 同一模型出现多条记录时，只要有一条可用就认为可用。
        existing.enabled = existing.enabled || enabled
        continue
      }

      modelMap.set(modelId, {
        id: modelId,
        name: modelId,
        brand: inferModelBrand(modelId),
        enabled
      })
    }

    if (modelMap.size === 0) {
      throw new Error('empty model list')
    }

    modelList.value = applyModelVisibility(Array.from(modelMap.values()))
  } catch (error) {
    console.error('获取模型列表失败:', error)
    modelList.value = fallbackModels
    toast.warning('模型列表加载失败，已切换到默认模型')
  } finally {
    const selectableModels = modelList.value.filter(m => m.enabled)
    if (!selectedModel.value || !selectableModels.some(m => m.id === selectedModel.value)) {
      selectedModel.value = selectableModels[0]?.id || ''
    }
  }
}
const activeCategory = ref<'mcp' | 'skills' | 'knowledge' | 'image' | 'git' | 'env' | null>(null)
const searchQuery = ref('')

// 岗位选择
const isRolePanelOpen = ref(false)
const selectedRole = ref<string | null>(null)
const roleSearchQuery = ref('')
const roleCurrentPage = ref(1)
const rolePageSize = 6
const isLoadingRoles = ref(false)

// 岗位类型定义
interface RoleItem {
  id: string
  name: string
  description: string
  category: string
  favoriteCount: number
  icon: typeof Server
  color: string
}

// 岗位列表（从后端获取）
const roleList = ref<RoleItem[]>([])
const hotRoleList = ref<RoleItem[]>([])
const isLoadingHotRoles = ref(false)

// 图标和颜色映射
const categoryIconMap: Record<string, typeof Server> = {
  devops: Server,
  security: ShieldCheck,
  developer: FileCode,
  research: Cpu,
  default: Bot
}

const categoryColorMap: Record<string, string> = {
  devops: 'bg-blue-500/10 text-blue-600',
  security: 'bg-red-500/10 text-red-600',
  developer: 'bg-orange-500/10 text-orange-600',
  research: 'bg-purple-500/10 text-purple-600',
  default: 'bg-cyan-500/10 text-cyan-600'
}

const HOT_ROLE_LIMIT = 4

const resolveFavoriteCount = (item: any): number => {
  const raw = item?.favoriteCount ?? item?.favoritesCount ?? item?.favorite_count ?? 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

const mapRoleItem = (item: any): RoleItem => ({
  id: String(item.id),
  name: item.name,
  description: item.description || '',
  category: item.category || 'default',
  favoriteCount: resolveFavoriteCount(item),
  icon: categoryIconMap[item.category] || categoryIconMap.default,
  color: categoryColorMap[item.category] || categoryColorMap.default
})

const getRoleItemsFromResponse = (result: any): any[] => {
  if (Array.isArray(result?.data?.items)) {
    return result.data.items
  }
  if (Array.isArray(result?.data)) {
    return result.data
  }
  return []
}

// 获取岗位列表
const fetchRoles = async () => {
  isLoadingRoles.value = true
  try {
    const response = await fetch('/api/v1/roles?pageSize=100&scope=all', { credentials: 'include' })
    const result = await response.json()
    
    if (result.code === 0 && result.data?.items) {
      roleList.value = result.data.items.map((item: any) => mapRoleItem(item))
      
      // 默认选中"通用助手"岗位
      if (!selectedRole.value && roleList.value.length > 0) {
        const defaultRole = roleList.value.find(r => r.name === '通用助手') || roleList.value[0]
        selectRole(defaultRole.id)
      }
    }
  } catch (error) {
    console.error('获取岗位列表失败:', error)
    // 使用默认数据作为 fallback
    roleList.value = [
      { id: '1', name: 'DevOps 工程师', description: '负责 CI/CD 流水线、容器编排', category: 'devops', favoriteCount: 0, icon: Server, color: 'bg-blue-500/10 text-blue-600' },
      { id: '2', name: '安全工程师', description: '漏洞扫描、渗透测试与安全审计', category: 'security', favoriteCount: 0, icon: ShieldCheck, color: 'bg-red-500/10 text-red-600' }
    ]
  } finally {
    isLoadingRoles.value = false
  }
}

// 获取热门岗位（按收藏数降序，最多 4 个）
const fetchHotRoles = async () => {
  isLoadingHotRoles.value = true
  try {
    const response = await fetch(`/api/v1/roles/hot?limit=${HOT_ROLE_LIMIT}`, { credentials: 'include' })
    const result = await response.json()
    const hotItems = getRoleItemsFromResponse(result)

    if (result.code === 0 && hotItems.length > 0) {
      hotRoleList.value = hotItems.map((item: any) => mapRoleItem(item)).slice(0, HOT_ROLE_LIMIT)
      return
    }

    // /hot 接口不可用时，退化为真实岗位列表接口排序（仍保持真实数据来源）
    const fallbackResponse = await fetch('/api/v1/roles?pageSize=100&scope=all', { credentials: 'include' })
    const fallbackResult = await fallbackResponse.json()
    const fallbackItems = getRoleItemsFromResponse(fallbackResult)
    if (fallbackResult.code === 0 && fallbackItems.length > 0) {
      hotRoleList.value = fallbackItems
        .map((item: any) => mapRoleItem(item))
        .sort((a, b) => b.favoriteCount - a.favoriteCount)
        .slice(0, HOT_ROLE_LIMIT)
      return
    }

    throw new Error('invalid hot role response')
  } catch (error) {
    console.error('获取热门岗位失败:', error)
    hotRoleList.value = []
  } finally {
    isLoadingHotRoles.value = false
  }
}

// 页面加载时获取岗位
onMounted(async () => {
  fetchRoles()
  fetchHotRoles()
  // Always refresh user identity to ensure whitelist matching is based on latest login user.
  await fetchUser()
  fetchModels()
})

watch(
  () => `${user.value?.userId || ''}|${user.value?.workId || ''}|${user.value?.email || ''}|${user.value?.name || ''}`,
  (nextIdentityKey, prevIdentityKey) => {
    if (nextIdentityKey && nextIdentityKey !== prevIdentityKey) {
      fetchModels()
    }
  }
)

// 过滤后的岗位列表
const filteredRoleList = computed(() => {
  if (!roleSearchQuery.value.trim()) return roleList.value
  const query = roleSearchQuery.value.toLowerCase()
  return roleList.value.filter(role =>
    role.name.toLowerCase().includes(query) ||
    role.description.toLowerCase().includes(query)
  )
})

// 分页后的岗位列表
const paginatedRoleList = computed(() => {
  const start = (roleCurrentPage.value - 1) * rolePageSize
  return filteredRoleList.value.slice(start, start + rolePageSize)
})

// 总页数
const roleTotalPages = computed(() => {
  return Math.ceil(filteredRoleList.value.length / rolePageSize)
})

// 搜索时重置页码
const onRoleSearch = () => {
  roleCurrentPage.value = 1
}

const toggleRolePanel = () => {
  isRolePanelOpen.value = !isRolePanelOpen.value
}

const selectRole = (roleId: string | number) => {
  selectedRole.value = String(roleId)
  // 将 roleId 同步到表单（如果是数字则直接使用，否则尝试转换）
  form.value.roleId = typeof roleId === 'number' ? roleId : (parseInt(roleId) || null)
  // 选择后延迟收起面板，让用户看到选中效果
  setTimeout(() => {
    isRolePanelOpen.value = false
  }, 600)
}

const getSelectedRoleName = computed(() => {
  if (!selectedRole.value) return '选择岗位'
  const role = roleList.value.find(r => r.id === selectedRole.value)
  return role?.name || '选择岗位'
})

const toggleMode = (mode: 'simple' | 'advanced' | 'sidecar') => {
  modelMode.value = mode
  if (mode === 'advanced' || mode === 'sidecar') {
    isAdvancedOpen.value = true
    activeCategory.value = 'image'
  } else {
    isAdvancedOpen.value = false
    activeCategory.value = null
  }
}

// Sidecar YAML Generation (TASK-FE-092)
const sidecarYaml = ref('')
const generateSidecarYaml = () => {
  const taskId = Math.random().toString(36).substring(2, 10)
  const envList = Object.entries(form.value.env).map(([k, v]) => `        - name: ${k}\n          value: "${v}"`).join('\n')
  
  // 提取镜像信息
  const selectedImage = imageList.find(img => img.id === form.value.image)
  const agentImage = "ai-worker-agent:latest"
  const runnerImage = selectedImage ? selectedImage.name : "runner-default:latest"

  sidecarYaml.value = `apiVersion: v1
kind: Pod
metadata:
  name: task-${taskId}
  namespace: default
  labels:
    app: ai-worker-task
    task-id: ${taskId}
    user-id: user-admin
    pod-mode: sidecar
    runner-type: ${form.value.image}
  annotations:
    volcano.sh/queue-name: default
    scheduling.volcano.sh/group-name: task-${taskId}
    max-runtime-seconds: "${form.value.timeout}"
spec:
  schedulerName: volcano
  priorityClassName: ${form.value.priority}
  restartPolicy: Never
  terminationGracePeriodSeconds: 30
  
  initContainers:
    - name: workspace-init    # 工作目录初始化
      image: alpine
      command: ["sh", "-c", "mkdir -p /workspace"]
    - name: ssh-init          # SSH 密钥生成（Sidecar 专用）
      image: alpine
      command: ["sh", "-c", "ssh-keygen -A"]
    - name: user-init         # 用户创建
      image: alpine
    - name: credential-init   # 凭证注入（可选）
      image: alpine
  
  containers:
    - name: agent             # Agent+Executor 容器
      image: ${agentImage}
      env:
        - name: TASK_ID
          value: "${taskId}"
        - name: ZZ_MODE
          value: "ssh"
        - name: SSH_PORT
          value: "2222"
${envList ? envList : '        # No custom env vars'}
      volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: ssh-keys
          mountPath: /etc/ssh
      resources:
        requests:
          cpu: "500m"
          memory: "1Gi"
        limits:
          cpu: "1000m"
          memory: "2Gi"
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "echo 'Stopping agent'"]
    
    - name: runner            # Runner 容器
      image: ${runnerImage}
      ports:
        - containerPort: 2222
      volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: ssh-config
          mountPath: /root/.ssh
        - name: secrets
          mountPath: /etc/secrets
      resources:
        requests:
          cpu: "1"
          memory: "2Gi"
        limits:
          cpu: "2"
          memory: "4Gi"
      readinessProbe:
        tcpSocket:
          port: 2222
  
  volumes:
    - name: workspace         # 共享工作目录
      emptyDir: {}
    - name: ssh-keys          # SSH 私钥（Memory）
      emptyDir:
        medium: Memory
    - name: ssh-config        # SSH 配置（Memory）
      emptyDir:
        medium: Memory
    - name: secrets           # 凭证 Secret
      secret:
        secretName: task-secrets-${taskId}
`
  isSidecarDialogOpen.value = true
}

const downloadYaml = () => {
  const blob = new Blob([sidecarYaml.value], { type: 'text/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sidecar-deployment-${Date.now()}.yaml`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success('YAML 文件已开始下载')
}

const copySuccess = ref(false)
const copyYaml = () => {
  navigator.clipboard.writeText(sidecarYaml.value)
  copySuccess.value = true
  toast.success('YAML 已复制到剪切板')
  setTimeout(() => copySuccess.value = false, 2000)
}

// 环境变量动态编辑 (TASK-FE-076)
const envPairs = ref<Array<{ key: string, value: string }>>([
  { key: '', value: '' }
])

const addEnvPair = () => {
  envPairs.value.push({ key: '', value: '' })
}

const removeEnvPair = (index: number) => {
  envPairs.value.splice(index, 1)
  if (envPairs.value.length === 0) addEnvPair()
  syncEnv()
}

const syncEnv = () => {
  const newEnv: Record<string, string> = {}
  envPairs.value.forEach(p => {
    if (p.key.trim()) newEnv[p.key.trim()] = p.value
  })
  form.value.env = newEnv
}

// Git Validation State
const isGitValidating = ref(false)
const isGitValid = ref(false)
const promptEditorRef = ref<{
  captureSelection: () => void
  insertMentionsAtCaret: (files: FileNodeItem[]) => number
  getMentionFileIds: () => string[]
  getPromptText: () => string
} | null>(null)
const mentionCount = ref(0)

// 状态管理
const form = ref({
  prompt: '',
  roleId: null as number | null,
  selectedModel: '',
  image: 'ubuntu-22.04-python3.10',
  gitRepos: [] as Array<{ id: string, branch: string }>,
  gitRepo: '', // Legacy support
  gitBranch: 'main', // Legacy support
  timeout: 60,
  priority: 'P1',
  env: {} as Record<string, string>,
  mcp: [] as string[],
  skills: [] as string[],
  knowledge: [] as string[],
  tools: [] as string[],
  files: [] as FileItem[]
})

watch(selectedModel, (value) => {
  form.value.selectedModel = value
})

// 资源选中计数计算 (TASK-FE-071/076)
const selectionCounts = computed(() => ({
  image: form.value.image ? 1 : 0,
  git: form.value.gitRepos.length,
  env: envPairs.value.filter(p => p.key.trim()).length,
  mcp: form.value.mcp.length,
  skills: form.value.skills.length,
  knowledge: form.value.knowledge.length
}))

// Mock Data
const imageList = [
  { id: 'ubuntu-22.04-python3.10', name: 'Python 3.10 Stack', description: 'Ubuntu 22.04 预装常用数据分析与 AI 依赖', updated: '2026-01-20', status: 'stable', icon: Box },
  { id: 'node-20-alpine', name: 'Node.js 20 Lts', description: '轻量化 Alpine 镜像，适用于前端与中台服务', updated: '2026-01-24', status: 'stable', icon: Box },
  { id: 'kali-linux-rolling', name: 'Kali Rolling', description: '渗透测试专用镜像，集成核心安全工具链', updated: '2026-01-25', status: 'stable', icon: Box }
]

const gitList = [
  { id: 'repo_linkwork_core', name: 'linkwork-core', description: '核心 Agent 执行器框架', updated: '2026-01-27', status: 'active', icon: GitBranch, branches: ['main', 'develop', 'feat/workflow'] },
  { id: 'repo_linkwork_web', name: 'linkwork-web', description: '全息指挥中心前端工程', updated: '2026-01-26', status: 'active', icon: GitBranch, branches: ['main', 'fix/layout'] },
  { id: 'repo_docs', name: 'linkwork-docs', description: '产品架构与技术规范文档库', updated: '2026-01-25', status: 'archived', icon: GitBranch, branches: ['master'] }
]

const mcpList = [
  { id: 'github_mcp', name: 'GitHub Connector', description: '用于管理仓库、Issue 和 PR 的核心组件', updated: '2026-01-25 14:20', status: 'online', icon: Server },
  { id: 'aws_mcp', name: 'AWS CloudWatch', description: '实时监控与日志审计集成', updated: '2026-01-20 09:15', status: 'online', icon: Server },
  { id: 'postgres_mcp', name: 'Postgres Expert', description: '复杂 SQL 执行与索引优化器', updated: '2026-01-22 18:30', status: 'maintenance', icon: Server }
]

const skillList = [
  { id: 'log_analyzer', name: 'LogAnalyzer v1.2', description: '多源日志聚合与根因分析', updated: '2026-01-26 10:00', status: 'ready', icon: Cpu },
  { id: 'sql_optimizer', name: 'SqlOptimizer v0.8', description: '查询性能瓶颈检测与重构建议', updated: '2026-01-18 11:45', status: 'ready', icon: Cpu },
  { id: 'sec_scanner', name: 'Vulnerability Scanner', description: '自动化安全漏洞扫描与评估', updated: '2026-01-24 16:20', status: 'updating', icon: Cpu }
]

const kbList = [
  { id: 'kb_devops', name: '运维故障知识库', description: '沉淀 500+ 生产环境故障排查手册', updated: '2026-01-23 22:10', status: 'indexed', icon: Database },
  { id: 'kb_api', name: 'API 标准文档', description: '全量微服务接口定义与契约规范', updated: '2026-01-25 08:40', status: 'indexed', icon: Database },
  { id: 'kb_legal', name: '法律合规指南', description: '跨境电商与数据安全法律参考', updated: '2026-01-15 13:00', status: 'expired', icon: Database }
]

// Resource item type
type ResourceItem = {
  id: string
  name: string
  description: string
  updated: string
  status: string
  icon: typeof Box
  branches?: string[]
}

// Mock Options
const currentItems = computed((): ResourceItem[] => {
  let list: ResourceItem[] = []
  if (activeCategory.value === 'mcp') list = mcpList
  else if (activeCategory.value === 'skills') list = skillList
  else if (activeCategory.value === 'knowledge') list = kbList
  else if (activeCategory.value === 'image') list = imageList
  else if (activeCategory.value === 'git') list = gitList

  if (!searchQuery.value) return list
  return list.filter(item =>
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const toggleSelection = (id: string) => {
  if (activeCategory.value === 'image') {
    form.value.image = id
    return
  }

  let target: string[] = []
  if (activeCategory.value === 'mcp') target = form.value.mcp
  else if (activeCategory.value === 'skills') target = form.value.skills
  else if (activeCategory.value === 'knowledge') target = form.value.knowledge
  else if (activeCategory.value === 'git') {
    const idx = form.value.gitRepos.findIndex(r => r.id === id)
    if (idx > -1) form.value.gitRepos.splice(idx, 1)
    else {
      const repo = gitList.find(r => r.id === id)
      form.value.gitRepos.push({ id, branch: repo?.branches[0] || 'main' })
    }
    return
  } else {
    return
  }

  const index = target.indexOf(id)
  if (index > -1) target.splice(index, 1)
  else target.push(id)
}

const isSelected = (id: string) => {
  if (activeCategory.value === 'image') return form.value.image === id
  if (activeCategory.value === 'mcp') return form.value.mcp.includes(id)
  if (activeCategory.value === 'skills') return form.value.skills.includes(id)
  if (activeCategory.value === 'knowledge') return form.value.knowledge.includes(id)
  if (activeCategory.value === 'git') return form.value.gitRepos.some(r => r.id === id)
  return false
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'online':
    case 'ready':
    case 'indexed':
    case 'stable':
    case 'active':
    case 'secure':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    case 'maintenance':
    case 'updating':
      return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
    case 'expired':
    case 'archived':
      return 'text-red-500 bg-red-500/10 border-red-500/20'
    default:
      return 'text-muted-foreground bg-muted border-border'
  }
}

const checkGitRepo = () => {
  if (!form.value.gitRepo) {
    isGitValid.value = false
    return
  }
  isGitValidating.value = true
  setTimeout(() => {
    isGitValidating.value = false
    isGitValid.value = true
    toast.success('Git 仓库验证通过')
  }, 1000)
}

const fillTemplate = (type: string, prompt?: string) => {
  if (prompt) {
    form.value.prompt = prompt
    toast.success('模板已填入')
    return
  }
  switch (type) {
    case 'logs':
      form.value.prompt = '分析 /var/log/nginx/access.log 中 500 错误的分布情况'
      form.value.image = 'ubuntu-22.04-python3.10'
      break
    case 'code':
      form.value.prompt = '审查 src/ 目录下的所有 Python 文件，检查 SQL 注入风险'
      form.value.gitRepo = 'https://github.com/example/demo'
      checkGitRepo()
      break
    case 'security':
      form.value.prompt = '对 http://localhost:8080 进行 OWASP ZAP 扫描'
      form.value.image = 'kali-linux-rolling'
      break
  }
  toast.success('高级模板已加载')
}

const openFilePicker = (mode: 'select' | 'upload') => {
  if (mode === 'select') {
    promptEditorRef.value?.captureSelection()
  }
  filePickerMode.value = mode
  isFilePickerOpen.value = true
}

const handleFileSelect = (nodes: FileNodeItem[]) => {
  const inserted = promptEditorRef.value?.insertMentionsAtCaret(nodes) || 0
  if (inserted > 0) {
    toast.success(`已引用 ${inserted} 个文件`)
  }
}

const handleUpload = (uploadedFiles: FileItem[]) => {
  form.value.files = [...form.value.files, ...uploadedFiles]
  toast.success(`已添加 ${uploadedFiles.length} 个文件`)
}

const handleEnvSave = (env: Record<string, string>) => {
  form.value.env = env
  envPairs.value = Object.entries(env).map(([key, value]) => ({ key, value }))
  if (envPairs.value.length === 0) addEnvPair()
  toast.success('环境变量已保存')
}

const isSubmitting = ref(false)

const onSubmit = () => {
  if (isSubmitting.value) return
  const promptText = promptEditorRef.value?.getPromptText() ?? form.value.prompt
  if (!promptText.trim()) {
    toast.error('请输入任务指令')
    return
  }
  if (!selectedModel.value) {
    toast.error('当前暂无可用模型，请稍后重试')
    return
  }
  form.value.selectedModel = selectedModel.value
  isSubmitting.value = true
  form.value.prompt = promptText
  const uploadedFileIds = form.value.files.map((file) => file.fileId)
  const mentionFileIds = promptEditorRef.value?.getMentionFileIds() ?? []
  const fileIds = Array.from(new Set([...uploadedFileIds, ...mentionFileIds]))
  startMission({ ...form.value, fileIds })
  setTimeout(() => { isSubmitting.value = false }, 1500)
}

const handleMentionsChange = (mentions: Array<{ nodeId: string }>) => {
  mentionCount.value = mentions.length
}

</script>

<template>
  <div class="flex flex-col items-center h-full min-h-0 px-[5%] md:px-[10%] gap-3 overflow-y-auto overflow-x-hidden relative pt-[clamp(7.5rem,22vh,30vh)] md:pt-[clamp(8.5rem,24vh,32vh)] pb-6 md:pb-8">

    <!-- Hero Section Container (Fixed area to prevent jump) (TASK-FE-071/076/083/086/088) -->
    <div
      class="w-full max-w-3xl shrink-0 h-[120px] flex flex-col items-center justify-center pointer-events-none mb-1"
    >
      <div class="space-y-4 animate-in fade-in zoom-in-95 duration-700 pointer-events-auto">
        <div class="text-center space-y-4 group">
          <div class="relative inline-block">
            <div class="absolute inset-x-0 bottom-2 h-4 bg-primary/40 blur-2xl rounded-full animate-pulse-slow"></div>
            <h1 class="relative text-4xl md:text-6xl font-mono font-bold tracking-[0.2em] uppercase bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent pb-2 drop-shadow-[0_0_10px_rgba(var(--glow-rgb),0.3)] animate-glow">
              LinkWork
            </h1>
          </div>
          <p class="text-base md:text-lg text-muted-foreground font-light max-w-2xl mx-auto tracking-wide">
            LinkWork，你的协同工作伙伴。
          </p>
        </div>
      </div>
    </div>

    <!-- AI Console Container -->
    <div class="w-full max-w-3xl min-h-0 shrink-0 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div
        class="relative bg-background rounded-2xl border border-border/50 transition-all duration-300 focus-within:border-primary hover:border-primary/20 flex flex-col min-h-0 overflow-hidden"
        data-guide-target="home-console"
      >
        
        <div class="flex flex-col p-2">
          <PromptEditor
            ref="promptEditorRef"
            v-model="form.prompt"
            placeholder="描述任务目标... (Shift + Enter 换行)"
            @submit="onSubmit"
            @mentions-change="handleMentionsChange"
          />

          <div v-if="form.files.length > 0" class="px-4 pb-1 flex flex-wrap gap-1.5">
            <Badge
              v-for="(file, idx) in form.files"
              :key="file.fileId || idx"
              variant="secondary"
              class="gap-1 pl-2 pr-1 py-0.5 bg-muted/50 border-border/50 text-[11px]"
            >
              <FileCode class="h-3 w-3" />
              {{ file.fileName }}
              <button type="button" class="ml-0.5 hover:text-destructive text-muted-foreground" @click="form.files.splice(idx, 1)">×</button>
            </Badge>
          </div>

          <!-- Toolbar -->
          <div class="flex items-center justify-between px-2 pb-2">
            <div class="flex items-center gap-2" data-guide-target="home-model-role">
              <!-- Model Selector (TASK-FE-089) -->
              <div class="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1 border border-border/50 shadow-inner">
                <!-- Model Selector (Select) -->
                <Select v-model="selectedModel">
                  <SelectTrigger class="h-8 w-[200px] border-none bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-[11px] font-bold hover:text-primary transition-colors gap-2 data-[state=open]:bg-transparent whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <ModelProviderIcon :brand="selectedModelOption?.brand || 'unknown'" icon-class="h-4 w-4" />
                      <SelectValue placeholder="选择模型" />
                    </div>
                  </SelectTrigger>
                  <SelectContent align="start" class="-translate-x-[5px] w-[calc(var(--reka-select-trigger-width)+10px)] min-w-[calc(var(--reka-select-trigger-width)+10px)] bg-background/95 backdrop-blur-md border-border/50 shadow-xl py-1">
                    <SelectItem
                      v-for="m in modelList"
                      :key="m.id"
                      :value="m.id"
                      :disabled="!m.enabled"
                      hide-indicator
                      class="h-9 py-0 leading-none text-[11px] font-bold focus:bg-primary/10 focus:text-primary cursor-pointer disabled:cursor-not-allowed"
                    >
                      <div class="flex items-center justify-between gap-3 w-full">
                        <div class="flex items-center gap-2.5">
                          <ModelProviderIcon :brand="m.brand" icon-class="h-4 w-4" />
                          <span :class="m.enabled ? '' : 'text-muted-foreground/80'">{{ m.name }}</span>
                        </div>
                        <span v-if="!m.enabled" class="text-[10px] font-medium text-muted-foreground">不可用</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Role Selector Button -->
              <div class="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1 border border-border/50 shadow-inner">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 px-3 gap-2 text-[11px] font-bold rounded-lg transition-all hover:bg-background/50 hover:text-primary"
                  :class="{ 'bg-primary/10 text-primary': isRolePanelOpen || selectedRole }"
                  @click="toggleRolePanel"
                >
                  <Briefcase class="h-3.5 w-3.5" :class="selectedRole ? 'text-primary' : 'text-primary/60'" />
                  <span class="max-w-[80px] truncate">{{ getSelectedRoleName }}</span>
                  <ChevronDown class="h-3 w-3 opacity-50 transition-transform" :class="{ 'rotate-180': isRolePanelOpen }" />
                </Button>
              </div>

              <!-- Category Icons Expander (TASK-FE-066/071/076/092) -->
              <div v-if="modelMode !== 'simple'" class="flex items-center gap-1 animate-in slide-in-from-left-2 duration-300">
                <ChevronRight class="h-4 w-4 text-muted-foreground/40" />
                <TooltipProvider>
                  <div class="flex items-center gap-1.5 bg-muted/30 rounded-xl p-1 border border-border/40 shadow-inner">
                    <Tooltip v-for="cat in [
                      { id: 'image', icon: Box, label: '运行镜像', countKey: 'image' },
                      { id: 'git', icon: GitBranch, label: '代码仓库', countKey: 'git' },
                      { id: 'env', icon: Settings2, label: '环境变量', countKey: 'env' },
                      { id: 'mcp', icon: Server, label: 'MCP 服务', countKey: 'mcp' },
                      { id: 'skills', icon: Cpu, label: 'Skills', countKey: 'skills' },
                      { id: 'knowledge', icon: Database, label: '知识库', countKey: 'knowledge' }
                    ]" :key="cat.id">
                      <TooltipTrigger as-child>
                        <div class="relative">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            class="h-9 w-9 rounded-lg transition-all border border-transparent"
                            :class="activeCategory === cat.id ? 'bg-primary text-primary-foreground shadow-lg border-primary ring-2 ring-primary/20' : 'text-muted-foreground hover:bg-background/80 hover:border-border/50 hover:shadow-sm'"
                            @click="activeCategory = activeCategory === cat.id ? null : (cat.id as any)"
                          >
                            <component :is="cat.icon" class="h-4.5 w-4.5" />
                          </Button>
                          <!-- Selection Count Badge (TASK-FE-071/076) -->
                          <div v-if="selectionCounts[cat.countKey as keyof typeof selectionCounts] > 0" 
                            class="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-background shadow-[0_0_10px_rgba(var(--glow-rgb),0.4)] animate-in zoom-in duration-300 pointer-events-none z-10"
                          >
                            {{ selectionCounts[cat.countKey as keyof typeof selectionCounts] }}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{{ cat.label }} 配置</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>

              <div class="w-px h-4 bg-border/50 mx-1" />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-9 w-9 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                      @click="openFilePicker('select')"
                      @mousedown="promptEditorRef?.captureSelection()"
                      :class="{ 'bg-primary/10 text-primary border border-primary/20': mentionCount > 0 }"
                    >
                      <AtSign class="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>引用文件</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      class="h-9 w-9 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                      @click="openFilePicker('upload')"
                      :class="{ 'bg-primary/10 text-primary border border-primary/20': form.files.length > 0 }"
                    >
                      <Paperclip class="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>上传附件文件</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <Button
              data-guide-target="home-run-task"
              @click="modelMode === 'sidecar' ? generateSidecarYaml() : onSubmit()" 
              size="sm" 
              class="h-8 px-4 rounded-lg font-bold transition-all active:scale-95 flex items-center bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105"
            >
              <template v-if="modelMode === 'sidecar'">
                Sidecar 导出
              </template>
              <template v-else>
                开启执行 <ArrowUp class="h-4 w-4" />
              </template>
            </Button>
          </div>
        </div>

        <!-- Role Selection Panel -->
        <div class="grid transition-[grid-template-rows,opacity] duration-700 ease-in-out" :class="isRolePanelOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'">
          <div class="overflow-hidden min-h-0">
            <div class="border-t border-border/50 bg-muted/20 p-4">
              <div class="space-y-3 max-h-[50vh] overflow-y-auto">
                <!-- 标题和搜索框 -->
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-2 text-xs font-bold text-foreground/80 uppercase tracking-wider">
                    <Briefcase class="h-4 w-4 text-primary" />
                    选择 AI 岗位
                  </div>
                  <div class="relative w-48">
                    <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      v-model="roleSearchQuery"
                      placeholder="搜索岗位..."
                      class="h-7 pl-8 pr-3 text-xs bg-background/60 border border-border/50 focus:border-primary/60 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/30 focus-visible:ring-offset-0 transition-colors"
                      @input="roleCurrentPage = 1"
                    />
                  </div>
                </div>

                <!-- 岗位列表：固定2行高度，防止不满一行时容器缩小 -->
                <div class="grid grid-cols-2 md:grid-cols-3 grid-rows-2 gap-3">
                  <div
                    v-for="role in paginatedRoleList"
                    :key="role.id"
                    @click="selectRole(role.id)"
                    :class="[
                      'group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300',
                      selectedRole === role.id
                        ? 'bg-primary/10 border-primary/50 shadow-[0_0_15px_rgba(var(--glow-rgb),0.1)]'
                        : 'bg-background/60 border-border/50 hover:border-primary/30 hover:bg-background/80'
                    ]"
                  >
                    <div
                      :class="[
                        'h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-300',
                        selectedRole === role.id
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : role.color
                      ]"
                    >
                      <component :is="role.icon" class="h-5 w-5" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold tracking-tight">{{ role.name }}</span>
                        <div v-if="selectedRole === role.id" class="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <Check class="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      </div>
                      <p class="text-[10px] text-muted-foreground role-panel-desc-truncate">{{ role.description }}</p>
                    </div>
                  </div>
                </div>

                <!-- 分页控件 -->
                <div v-if="roleTotalPages > 1" class="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    :disabled="roleCurrentPage <= 1"
                    @click="roleCurrentPage--"
                    class="h-7 w-7 p-0"
                  >
                    <ChevronLeft class="h-4 w-4" />
                  </Button>
                  <span class="text-xs text-muted-foreground">
                    {{ roleCurrentPage }} / {{ roleTotalPages }}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    :disabled="roleCurrentPage >= roleTotalPages"
                    @click="roleCurrentPage++"
                    class="h-7 w-7 p-0"
                  >
                    <ChevronRight class="h-4 w-4" />
                  </Button>
                </div>

                <!-- 加载状态 -->
                <div v-if="isLoadingRoles" class="text-center py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 class="h-4 w-4 animate-spin" />
                  加载岗位中...
                </div>

                <!-- 无结果提示 -->
                <div v-else-if="filteredRoleList.length === 0" class="text-center py-4 text-sm text-muted-foreground">
                  未找到匹配的岗位
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Advanced Settings Panel (TASK-FE-076/082) -->
        <div class="grid transition-[grid-template-rows,opacity] duration-700 ease-in-out" :class="isAdvancedOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'">
          <div class="overflow-hidden min-h-0">
            <div class="border-t border-border/50 bg-muted/20 rounded-b-2xl">
              <div class="max-h-[50vh] overflow-y-auto">
              
              <!-- Dynamic Resource Selection List (TASK-FE-066/071/076/082/085) -->
              <div v-if="activeCategory" class="h-[320px] flex flex-col bg-background/40 animate-in slide-in-from-top-2 duration-1000 ease-in-out">
                <div class="p-6 pb-4 flex items-center justify-between shrink-0">
                  <div class="space-y-1">
                    <h4 class="text-xs font-bold text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                      <component :is="
                        activeCategory === 'mcp' ? Server : 
                        activeCategory === 'skills' ? Cpu : 
                        activeCategory === 'knowledge' ? Database :
                        activeCategory === 'image' ? Box :
                        activeCategory === 'git' ? GitBranch : Settings2
                      " class="h-4 w-4 text-primary" />
                      {{ 
                        activeCategory === 'mcp' ? '配置 MCP 服务' : 
                        activeCategory === 'skills' ? 'Skills 插件' : 
                        activeCategory === 'knowledge' ? '配置知识库' :
                        activeCategory === 'image' ? '配置运行镜像' :
                        activeCategory === 'git' ? '配置代码仓库' : '配置环境变量'
                      }}
                    </h4>
                    <p class="text-[10px] text-muted-foreground uppercase tracking-widest font-medium opacity-60">
                      {{ 
                        activeCategory === 'image' ? (modelMode === 'sidecar' ? '选择 Sidecar 基础运行镜像' : '选择一个基础运行环境') :
                        activeCategory === 'env' ? `已配置 ${selectionCounts.env} 个环境变量` :
                        `已选择 ${
                          activeCategory === 'git' ? form.gitRepos.length :
                          (activeCategory === 'mcp' ? form.mcp : activeCategory === 'skills' ? form.skills : form.knowledge).length
                        } / ${currentItems.length} 项可用资源`
                      }}
                    </p>
                  </div>
                  <div v-if="activeCategory !== 'env'" class="relative w-64">
                    <Search class="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/40" />
                    <Input v-model="searchQuery" placeholder="搜索资源名称或描述..." class="h-9 pl-9 text-xs bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/20" />
                  </div>
                  <div v-else>
                    <Button variant="outline" size="sm" class="h-8 gap-1.5 text-[10px] font-bold border-primary/30 bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all" @click="addEnvPair">
                      <Plus class="h-3.5 w-3.5" /> 新增变量
                    </Button>
                  </div>
                </div>
                
                <div class="flex-1 overflow-hidden px-6 pb-6">
                  <!-- Environment Editor (TASK-FE-076) -->
                  <div v-if="activeCategory === 'env'" class="h-full space-y-2 overflow-y-auto pr-2 custom-scrollbar content-start">
                    <div v-for="(pair, idx) in envPairs" :key="idx" class="flex items-center gap-2 group animate-in fade-in slide-in-from-left-2 duration-300">
                      <div class="grid grid-cols-2 gap-2 flex-1">
                        <Input v-model="pair.key" @input="syncEnv" placeholder="变量名 (e.g. API_KEY)" class="h-9 text-xs font-mono bg-background border-border/50 focus-visible:ring-primary/20" />
                        <Input v-model="pair.value" @input="syncEnv" placeholder="变量值" class="h-9 text-xs font-mono bg-background border-border/50 focus-visible:ring-primary/20" />
                      </div>
                      <Button variant="ghost" size="sm" class="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" @click="removeEnvPair(idx)">
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </div>
                    <div v-if="envPairs.length === 0" class="py-12 text-center text-xs text-muted-foreground italic">
                      点击上方按钮新增环境变量
                    </div>
                  </div>

                  <!-- Resource List -->
                  <div v-else class="h-full grid gap-2 overflow-y-auto pr-2 custom-scrollbar content-start">
                    <div 
                      v-for="item in currentItems" 
                      :key="item.id"
                      @click="toggleSelection(item.id)"
                      :class="[
                        'group flex items-center gap-4 p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden',
                        isSelected(item.id) 
                          ? 'bg-primary/5 border-primary/40 shadow-[0_0_15px_rgba(var(--glow-rgb),0.05)]' 
                          : 'bg-background/40 border-border/50 hover:border-primary/30 hover:bg-background/80'
                      ]"
                    >
                      <div v-if="isSelected(item.id)" class="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                      <div :class="[
                        'h-10 w-10 rounded-lg flex items-center justify-center border transition-all duration-300',
                        isSelected(item.id) 
                          ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105' 
                          : 'bg-muted/30 text-muted-foreground border-border/50 group-hover:border-primary/40 group-hover:text-primary'
                      ]">
                        <component :is="item.icon" class="h-5 w-5" />
                      </div>
                      
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-sm font-bold tracking-tight">{{ item.name }}</span>
                          <Badge variant="outline" :class="['text-[9px] font-mono font-bold uppercase px-1.5 py-0 border-opacity-50', getStatusColor(item.status)]">
                            {{ item.status }}
                          </Badge>
                        </div>
                        <p class="text-xs text-muted-foreground line-clamp-1 font-medium opacity-70">{{ item.description }}</p>
                      </div>
                      
                      <div class="text-right space-y-2 shrink-0">
                        <div v-if="activeCategory === 'git' && isSelected(item.id)" class="flex items-center gap-2" @click.stop>
                          <Select v-model="form.gitRepos.find(r => r.id === item.id)!.branch">
                            <SelectTrigger class="h-7 min-w-[100px] text-[10px] font-mono bg-background border-primary/30 py-0 px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem v-for="br in item.branches" :key="br" :value="br" class="text-[10px] font-mono">
                                {{ br }}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div v-else class="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground/60 font-mono tracking-tighter">
                          <Clock class="h-3 w-3" /> {{ item.updated }}
                        </div>
                        <div class="flex justify-end">
                          <div v-if="isSelected(item.id)" class="h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-sm animate-in zoom-in duration-300">
                            <CheckCircle2 class="h-3 w-3 text-primary-foreground" />
                          </div>
                          <div v-else class="h-5 w-5 rounded-full border border-border/30 group-hover:border-primary/40 transition-colors" />
                        </div>
                      </div>
                    </div>
                    <div v-if="currentItems.length === 0" class="py-12 text-center space-y-3">
                      <div class="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto">
                        <Search class="h-6 w-6 text-muted-foreground/20" />
                      </div>
                      <p class="text-xs text-muted-foreground font-medium">未找到匹配的资源</p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="!activeCategory" class="h-[320px] flex items-center justify-center flex-col space-y-4 bg-background/20">
                <div class="h-16 w-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto animate-pulse-slow">
                  <SlidersHorizontal v-if="modelMode !== 'sidecar'" class="h-8 w-8 text-primary/40" />
                  <FileJson v-else class="h-8 w-8 text-primary/40" />
                </div>
                <div class="space-y-1 text-center">
                  <p class="text-sm font-bold text-foreground">
                    {{ modelMode === 'sidecar' ? 'Sidecar 部署预览模式' : '进阶资源调度模式已开启' }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ modelMode === 'sidecar' ? '配置参数后点击右侧按钮导出 K8s Pod YML' : '请通过上方的图标栏分配镜像、仓库、环境变量及核心能力' }}
                  </p>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Community Recommendations (Hidden when Advanced/Role panel is open) (TASK-FE-088) -->
      <div v-if="!isAdvancedOpen && !isRolePanelOpen" class="shrink-0">
        <div class="px-4 space-y-4 pt-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-bold text-foreground/80">
                <Sparkles class="h-4 w-4 text-orange-500" /> 热门岗位
              </div>
              <router-link to="/roles">
                <Button variant="link" size="sm" class="text-xs text-muted-foreground hover:text-primary">查看全部</Button>
              </router-link>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card 
                v-for="role in hotRoleList"
                :key="role.id" 
                class="group relative p-4 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 border-border/50 bg-card/30 shadow-sm"
                @click="selectRole(role.id)"
              >
                <Badge
                  variant="secondary"
                  class="absolute right-3 top-3 h-5 px-1.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                >
                  <TrendingUp class="h-3 w-3 mr-1 text-emerald-600" />
                  {{ role.favoriteCount }}
                </Badge>
                <div class="space-y-3">
                  <div class="flex items-center">
                    <div :class="['p-2 rounded-lg', role.color]"><component :is="role.icon" class="h-4 w-4" /></div>
                  </div>
                  <div>
                    <div class="font-bold text-sm group-hover:text-primary transition-colors">{{ role.name }}</div>
                    <div class="text-[10px] text-muted-foreground line-clamp-1">点击即刻部署执行</div>
                  </div>
                </div>
              </Card>
            </div>
            <div v-if="isLoadingHotRoles" class="text-xs text-muted-foreground px-1">热门岗位加载中...</div>
            <div v-else-if="hotRoleList.length === 0" class="text-xs text-muted-foreground px-1">暂无热门岗位</div>
          </div>
        </div>
      </div>

    <!-- Quick Start Templates (Bottom) - 面板展开时隐藏 -->
    <div v-if="!isRolePanelOpen && !isAdvancedOpen" class="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 opacity-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-forwards delay-300">
      <Card 
        v-for="(t, i) in [
          { id: 'logs', icon: Terminal, title: '日志深度分析', desc: '解析系统日志并输出异常分布', color: 'text-blue-500' },
          { id: 'code', icon: FileCode, title: '静态代码审计', desc: '扫描 Git 仓库中的安全漏洞', color: 'text-orange-500' },
          { id: 'security', icon: Server, title: '自动化渗透测试', desc: '对指定 URL 进行全方位 扫描', color: 'text-purple-500' }
        ]"
        :key="t.id"
        class="group cursor-pointer border-border/50 bg-card/30 hover:bg-card hover:border-primary/20 hover:shadow-xl transition-all duration-300"
        @click="fillTemplate(t.id)"
      >
        <CardContent class="p-6 flex items-center gap-4">
          <div class="h-12 w-12 rounded-2xl bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
            <component :is="t.icon" class="h-6 w-6" :class="t.color" />
          </div>
          <div>
            <h4 class="font-bold text-lg group-hover:text-primary transition-colors">{{ t.title }}</h4>
            <p class="text-sm text-muted-foreground">{{ t.desc }}</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <FilePickerDialog
      v-model:open="isFilePickerOpen"
      :mode="filePickerMode"
      :current-role-id="selectedRole || undefined"
      :current-role-name="getSelectedRoleName !== '选择岗位' ? getSelectedRoleName : undefined"
      @select="handleFileSelect"
      @upload="handleUpload"
    />
    <EnvVarDialog v-model:open="isEnvOpen" :initial-env="form.env" @save="handleEnvSave" />

    <!-- Sidecar YAML Preview Dialog (TASK-FE-096) -->
    <Dialog v-model:open="isSidecarDialogOpen">
      <DialogContent class="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl">
        <DialogHeader class="p-6 pb-2 shrink-0">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <DialogTitle class="text-lg font-bold tracking-tight">
                Sidecar 部署配置
              </DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground">
                Kubernetes Pod YAML 预览
              </DialogDescription>
            </div>
            <Button @click="downloadYaml" variant="outline" size="sm" class="h-8 px-4 font-bold text-[11px] tracking-wider uppercase">
              下载 YAML
            </Button>
          </div>
        </DialogHeader>

        <div class="flex-1 overflow-hidden p-6 pt-2">
          <div class="h-full rounded-xl border border-border bg-muted/30 overflow-hidden relative group">
            <ScrollArea class="h-full w-full">
              <div class="p-4">
                <CodeContainer :code="sidecarYaml" language="yaml" class="my-0 bg-transparent border-none p-0" />
              </div>
            </ScrollArea>
            
            <div class="absolute right-4 top-4">
              <Button @click="copyYaml" variant="secondary" size="sm" class="h-7 px-3 text-[10px] font-bold shadow-sm">
                {{ copySuccess ? '已复制' : '复制代码' }}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter class="p-6 pt-2 bg-muted/10 border-t border-border/50">
          <div class="flex items-center justify-between w-full">
            <p class="text-[10px] text-muted-foreground italic">
              * 复制配置内容后可直接用于集群部署
            </p>
            <div class="flex gap-3">
              <Button variant="ghost" @click="isSidecarDialogOpen = false" class="text-xs font-bold px-4">
                关闭
              </Button>
              <Button @click="copyYaml" class="text-xs font-bold px-6 bg-primary shadow-lg shadow-primary/20">
                复制内容
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.role-panel-desc-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
