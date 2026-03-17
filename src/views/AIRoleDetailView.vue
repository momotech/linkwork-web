<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Server, Activity, Cpu, Zap, HardDrive,
  Clock, ShieldCheck, Code, Globe, Terminal, Box,
  Settings2, History, Play, Square, RefreshCcw, ExternalLink, MoreHorizontal,
  CheckCircle2, XCircle, Loader2, AlertCircle, FileText, ChevronRight, Hammer, Lock, Users,
  Bot, Brain, Cog
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAIRoles } from '@/composables/useAIRoles'
import { useSkills } from '@/composables/useSkills'
import { useMcpServers } from '@/composables/useMcpServers'
import { useMission } from '@/composables/useMission'
import { validateRuntimeProfile } from '@/types/runtime-mode'
import RoleConfigDialog from '@/components/business/RoleConfigDialog.vue'
import BuildHistoryDialog from '@/components/business/BuildHistoryDialog.vue'
import BuildLogDialog from '@/components/business/BuildLogDialog.vue'

const route = useRoute()
const router = useRouter()
const roleId = route.params.id as string
const { loadMission, isDrawerOpen, taskApi } = useMission()
const { buildRole, generateCompose, getRole, updateRole, currentBuildId, getLatestBuildRecord } = useAIRoles()
const { mcpServers, fetchMcpServers } = useMcpServers()
const { availableSkills, fetchAvailableSkills } = useSkills()

// 岗位配置弹窗状态
const showConfigDialog = ref(false)

// 构建历史和日志弹窗状态
const showBuildHistoryDialog = ref(false)
const showBuildLogDialog = ref(false)
const selectedBuildNo = ref<string | null>(null)

const getIconComponent = (iconId: string) => {
  switch (iconId) {
    case 'server': return Server
    case 'shield': return ShieldCheck
    case 'code': return Code
    case 'globe': return Globe
    case 'terminal': return Terminal
    case 'bot': return Bot
    case 'brain': return Brain
    case 'cog': return Cog
    default: return Server
  }
}

const normalizeBoolean = (value: unknown, defaultValue = false) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'public', 'yes', 'y'].includes(normalized)) return true
    if (['false', '0', 'private', 'no', 'n', ''].includes(normalized)) return false
  }
  return defaultValue
}

const normalizeRoleStatus = (value: unknown) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['active', 'maintenance', 'disabled'].includes(normalized)) return normalized
  }
  return 'active'
}

// Detail Data for the selected Role
const roleDetail = ref<any>({
  id: roleId,
  name: '',
  description: '',
  prompt: '',
  avatarIcon: Server,
  icon: 'server',
  status: 'active',
  deployMode: 'K8S',
  category: 'devops',
  image: '',
  runtimeMode: undefined,
  zzMode: undefined,
  runnerImage: null,
  runtimeError: '',
  mcpModules: [],
  skills: [],
  gitRepos: [],
  envVars: [],
  isPublic: false,
  maxEmployees: 1
})

onMounted(async () => {
  // 先加载 MCP / Skills 列表（全局单例，有缓存）。
  // 注意：资源接口失败不能阻断岗位详情主数据加载。
  const preloadTasks: Promise<unknown>[] = []
  if (mcpServers.value.length === 0) {
    preloadTasks.push(
      fetchMcpServers().catch((error) => {
        console.warn('Failed to preload MCP servers for role detail', error)
      })
    )
  }
  if (availableSkills.value.length === 0) {
    preloadTasks.push(
      fetchAvailableSkills().catch((error) => {
        console.warn('Failed to preload skills for role detail', error)
      })
    )
  }
  if (preloadTasks.length > 0) {
    await Promise.allSettled(preloadTasks)
  }

  if (roleId) {
    try {
      const data = await getRole(roleId)
      const runtime = (() => {
        try {
          return validateRuntimeProfile(data, `Role#${roleId}`)
        } catch (err: any) {
          return {
            runtimeMode: undefined,
            zzMode: undefined,
            runnerImage: null,
            runtimeError: err?.message || `Role#${roleId} runtime profile invalid`
          }
        }
      })()

      // Transform data - 后端直接返回展开的 mcpModules/skills 等字段
      roleDetail.value = {
        id: data.id,
        name: data.name,
        description: data.description,
        prompt: data.prompt,
        avatarIcon: getIconComponent(data.icon),
        icon: data.icon,
        status: normalizeRoleStatus(data.status),
        deployMode: data.deployMode === 'COMPOSE' ? 'COMPOSE' : 'K8S',
        category: data.category,
        image: data.image,
        runtimeMode: runtime.runtimeMode,
        zzMode: runtime.zzMode,
        runnerImage: runtime.runnerImage,
        runtimeError: (runtime as any).runtimeError || '',
        isPublic: normalizeBoolean(data.isPublic),
        maxEmployees: data.maxEmployees,
        // 后端返回的是已展开的资源对象，直接使用或映射到本地定义
        mcpModules: (data.mcpModules || []).map((m: any) => 
          mcpServers.value.find(s => s.id === m.id) || { id: m.id, name: m.name || m.id, desc: m.desc || 'MCP Service' }
        ),
        skills: (data.skills || []).map((s: any) => 
          availableSkills.value.find(sk => String(sk.id) === String(s.id)) || { id: s.id, name: s.name || s.id, desc: s.desc || 'Skill' }
        ),
        gitRepos: data.gitRepos || [],
        envVars: data.envVars || []
      }
    } catch (e) {
      toast.error('获取岗位详情失败')
    }
  }
  // 加载任务执行记录
  loadTaskHistory()
})

// 当任务抽屉关闭时，自动刷新列表（任务状态可能已变化）
watch(isDrawerOpen, (open) => {
  if (!open) loadTaskHistory()
})

// 任务执行记录列表（真实接口数据）
const taskHistory = ref<any[]>([])
const taskLoading = ref(false)
const taskPagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 0 })

// 加载任务执行记录
const loadTaskHistory = async () => {
  if (!roleId) return
  taskLoading.value = true
  try {
    const data = await taskApi.list({
      roleId,
      page: taskPagination.value.page,
      pageSize: taskPagination.value.pageSize
    })
    // 映射后端字段到前端展示格式
    taskHistory.value = (data.items || []).map((item: any) => {
      let runtimeMode: string | undefined
      let zzMode: string | undefined
      let runnerImage: string | null | undefined
      let runtimeError = ''
      try {
        const runtime = validateRuntimeProfile(item, `Task#${item.taskNo || 'unknown'}`)
        runtimeMode = runtime.runtimeMode
        zzMode = runtime.zzMode
        runnerImage = runtime.runnerImage
      } catch (err: any) {
        runtimeError = err?.message || 'runtime profile invalid'
      }

      return {
        id: item.taskNo,
        prompt: item.prompt || '(无描述)',
        status: item.status?.toLowerCase() || 'pending',
        progress: item.status === 'RUNNING' ? 50 : item.status === 'COMPLETED' ? 100 : 0,
        startTime: item.createdAt || '',
        duration: item.usage?.duration || '-',
        tokensUsed: item.usage?.tokensUsed || 0,
        image: item.image,
        runtimeMode,
        zzMode,
        runnerImage,
        runtimeError,
        creator: item.creator
      }
    })
    taskPagination.value = {
      ...taskPagination.value,
      total: data.pagination?.total || 0,
      totalPages: data.pagination?.totalPages || 0
    }
  } catch (e) {
    console.error('加载任务记录失败', e)
  } finally {
    taskLoading.value = false
  }
}

// 刷新任务记录
const refreshTaskHistory = () => {
  taskPagination.value.page = 1
  loadTaskHistory()
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running': return Loader2
    case 'completed': return CheckCircle2
    case 'failed': return XCircle
    case 'pending': return Clock
    default: return AlertCircle
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'running': return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    case 'completed': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    case 'failed': return 'text-red-500 bg-red-500/10 border-red-500/20'
    case 'pending': return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
    default: return 'text-muted-foreground bg-muted border-border'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'running': return '执行中'
    case 'completed': return '已完成'
    case 'failed': return '失败'
    case 'pending': return '等待中'
    default: return '未知'
  }
}

const getRuntimeModeClass = (mode: string | undefined, runtimeError?: string) => {
  if (runtimeError) return 'bg-red-500/10 text-red-600 border-red-500/20'
  if (mode === 'SIDECAR') return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  if (mode === 'ALONE') return 'bg-zinc-500/10 text-zinc-700 border-zinc-500/20'
  return 'bg-red-500/10 text-red-600 border-red-500/20'
}

const getRuntimeModeLabel = (mode: string | undefined, runtimeError?: string) => {
  if (runtimeError) return '配置异常'
  if (mode === 'SIDECAR') return 'SIDECAR'
  if (mode === 'ALONE') return 'ALONE'
  return '配置异常'
}

const getRuntimeTopology = (mode: string | undefined) => {
  if (mode === 'SIDECAR') return '双容器 (Agent + Runner)'
  if (mode === 'ALONE') return '单容器 (Agent + Executor + Runner)'
  return '模式未知'
}

const openTaskDetail = (task: any) => {
  loadMission({
    id: task.id,
    prompt: task.prompt,
    status: task.status,
    image: task.image || roleDetail.value.image,
    runtimeMode: task.runtimeMode,
    zzMode: task.zzMode,
    runnerImage: task.runnerImage,
    runtimeError: task.runtimeError,
    creator: task.creator || 'system',
    createdAt: task.startTime,
    usage: {
      tokens_used: task.tokensUsed,
      tokens_limit: 100000,
      duration: task.duration
    }
  })
}

const handleScale = () => {
  toast.promise(new Promise(resolve => setTimeout(resolve, 2000)), {
    loading: '正在调度新资源...',
    success: 'Pod 扩容指令已下达',
    error: '资源调度失败'
  })
}

const triggerComposeDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const handleBuild = async () => {
  const isCompose = roleDetail.value.deployMode === 'COMPOSE'
  const toastId = toast.loading(isCompose ? '正在生成 Compose 配置...' : '正在触发构建流程...')

  try {
    if (isCompose) {
      const result = await generateCompose(roleDetail.value)
      triggerComposeDownload(result.blob, result.fileName)
      toast.success('Compose YAML 已生成并开始下载', { id: toastId })
      return
    }

    await buildRole(roleDetail.value)
    toast.success('构建指令已下达，查看日志了解详情', { id: toastId })
    // 自动打开构建日志弹窗
    showBuildLogDialog.value = true
  } catch (e: any) {
    toast.error(e.message || (isCompose ? '生成 Compose 失败' : '构建失败'), { id: toastId })
  }
}

// 从构建历史中查看日志
const handleViewBuildLog = (buildNo: string) => {
  selectedBuildNo.value = buildNo
  showBuildHistoryDialog.value = false
  showBuildLogDialog.value = true
}

/**
 * 检测列表关联是否发生变更（新增/删除/顺序变化都算）
 * 通用于 MCP 和 Skills 变更检测
 */
const isListChanged = (oldList: any[], newList: any[]): boolean => {
  const oldIds = (oldList || []).map((m: any) => String(m.id))
  const newIds = (newList || []).map((m: any) => String(m.id))
  if (oldIds.length !== newIds.length) return true
  return oldIds.some((id: string, i: number) => id !== newIds[i])
}

// 保存岗位配置
const handleConfigSaved = async (data: any) => {
  // 保存前快照当前 MCP 和 Skills 列表，用于变更检测
  const previousMcpModules = [...(roleDetail.value.mcpModules || [])]
  const previousSkills = [...(roleDetail.value.skills || [])]

  try {
    // 调用后端 API 更新
    await updateRole(roleId, data)
    
    // 更新本地 roleDetail 数据
    roleDetail.value = {
      ...roleDetail.value,
      name: data.name,
      description: data.description,
      prompt: data.prompt,
      avatarIcon: getIconComponent(data.icon),
      icon: data.icon,
      image: data.image,
      deployMode: data.deployMode === 'COMPOSE' ? 'COMPOSE' : 'K8S',
      runtimeMode: data.runtimeMode,
      zzMode: data.zzMode,
      runnerImage: data.runnerImage,
      runtimeError: '',
      mcpModules: data.mcpModules,
      skills: data.skills,
      gitRepos: data.gitRepos,
      envVars: data.envVars,
      isPublic: normalizeBoolean(data.isPublic),
      status: normalizeRoleStatus(data.status ?? roleDetail.value.status),
      maxEmployees: data.maxEmployees
    }
    toast.success('岗位配置已更新')

    // MCP / Skills 变更检测：任一关联发生变化时提示需要重新构建
    const mcpChanged = isListChanged(previousMcpModules, data.mcpModules)
    const skillsChanged = isListChanged(previousSkills, data.skills)

    if (mcpChanged || skillsChanged) {
      // 检查该岗位是否曾经构建过，未构建过的不需要提示
      try {
        const latestBuild = await getLatestBuildRecord(roleId)
        if (latestBuild) {
          const changedParts = [
            mcpChanged ? 'MCP' : '',
            skillsChanged ? 'Skills' : ''
          ].filter(Boolean).join(' 和 ')

          toast.info(`${changedParts} 配置已变更，需要重新构建镜像才能生效`, {
            duration: 8000,
            action: {
              label: '去构建',
              onClick: () => handleBuild()
            }
          })
        }
      } catch {
        // 获取构建记录失败（可能从未构建过），静默跳过
      }
    }
  } catch (e) {
    console.error(e)
    toast.error('更新失败')
  }
}

// 统计数据
const stats = computed(() => ({
  total: taskHistory.value.length,
  running: taskHistory.value.filter(t => t.status === 'running').length,
  completed: taskHistory.value.filter(t => t.status === 'completed').length,
  failed: taskHistory.value.filter(t => t.status === 'failed').length
}))
</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto h-full overflow-hidden">
    <!-- Header Navigation -->
    <div class="flex items-center justify-between shrink-0">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="router.back()" class="rounded-full">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
            <component :is="roleDetail.avatarIcon" class="h-6 w-6" />
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-black tracking-tight">{{ roleDetail.name }}</h1>
              <Badge
                variant="outline"
                class="h-6 px-2.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                :class="getRuntimeModeClass(roleDetail.runtimeMode, roleDetail.runtimeError)"
                :title="roleDetail.runtimeError || roleDetail.runnerImage || ''"
              >
                运行模式 {{ getRuntimeModeLabel(roleDetail.runtimeMode, roleDetail.runtimeError) }}
              </Badge>
            </div>
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Role Profile // {{ roleId }}</p>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <Button variant="outline" size="sm" class="h-9 gap-2 font-bold border-border/60 hover:bg-muted/60" @click="showConfigDialog = true">
          <Settings2 class="h-4 w-4" /> 岗位配置
        </Button>

        <div class="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
          <Button
            @click="handleBuild"
            size="sm"
            class="h-8 gap-2 rounded-md bg-primary px-3 font-bold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
          >
            <Hammer class="h-4 w-4" /> {{ roleDetail.deployMode === 'COMPOSE' ? '导出 Compose' : '构建' }}
          </Button>

          <template v-if="roleDetail.deployMode !== 'COMPOSE'">
            <div class="mx-0.5 h-5 w-px bg-border/60"></div>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
              @click="showBuildHistoryDialog = true"
              title="构建历史"
            >
              <History class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
              @click="showBuildLogDialog = true"
              title="构建日志"
            >
              <Terminal class="h-4 w-4" />
            </Button>
          </template>
        </div>
      </div>
    </div>

    <div class="flex-1 flex gap-6 min-h-0">
      <!-- Left Column: Profile & Resources -->
      <aside class="w-80 flex flex-col gap-6 shrink-0">
        <!-- Identity Card -->
        <Card class="bg-card/30 border-border/50 backdrop-blur-sm overflow-hidden relative">
          <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
          <CardContent class="p-6 space-y-6 relative z-10">
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <Badge variant="outline" class="text-[10px] font-bold uppercase tracking-widest">{{ roleDetail.category }}</Badge>
                <div class="flex gap-2">
                  <Badge v-if="roleDetail.isPublic" class="bg-blue-500/20 text-blue-500 border-none text-[10px] px-2 font-bold">PUBLIC</Badge>
                  <Badge class="bg-emerald-500/20 text-emerald-500 border-none text-[10px] px-2 font-bold">ACTIVE</Badge>
                </div>
              </div>
              <p class="text-xs text-muted-foreground leading-relaxed font-medium">{{ roleDetail.description }}</p>
              
              <!-- Meta Info -->
              <div class="flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
                <div class="flex items-center gap-1.5">
                  <Users class="h-3.5 w-3.5" />
                  <span>Max: {{ roleDetail.maxEmployees }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Lock class="h-3.5 w-3.5" />
                  <span>{{ roleDetail.isPublic ? 'Public' : 'Private' }}</span>
                </div>
              </div>
            </div>

            <Separator class="bg-border/20" />

            <!-- System Prompt -->
            <div class="space-y-2">
              <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText class="h-3 w-3" />
                系统提示词
              </h4>
              <div 
                class="group relative p-3 rounded-lg bg-muted/20 border border-border/30 cursor-pointer hover:border-primary/30 transition-colors"
                :title="roleDetail.prompt"
              >
                <p class="text-[11px] text-muted-foreground leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                  {{ roleDetail.prompt || '暂未配置' }}
                </p>
                <div class="absolute bottom-1 right-2 text-[9px] text-muted-foreground/50 group-hover:hidden">
                  悬停展开
                </div>
              </div>
            </div>

            <!-- Core Specs -->
            <div class="space-y-2">
              <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Box class="h-3 w-3" />
                基础镜像
              </h4>
              <div class="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30 overflow-hidden">
                <div class="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <HardDrive class="h-3.5 w-3.5 text-primary" />
                </div>
                <span class="text-[11px] font-medium font-mono truncate" :title="roleDetail.image">{{ roleDetail.image || '未配置' }}</span>
              </div>
            </div>

            <!-- Runtime Mode -->
            <div class="space-y-2">
              <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Cpu class="h-3 w-3" />
                运行模式
              </h4>
              <div class="space-y-2 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                <Badge
                  variant="outline"
                  class="text-[10px] font-bold"
                  :class="getRuntimeModeClass(roleDetail.runtimeMode, roleDetail.runtimeError)"
                  :title="roleDetail.runtimeError || roleDetail.runnerImage || ''"
                >
                  {{ getRuntimeModeLabel(roleDetail.runtimeMode, roleDetail.runtimeError) }}
                </Badge>

                <div class="text-[10px] text-muted-foreground">
                  拓扑: {{ getRuntimeTopology(roleDetail.runtimeMode) }}
                </div>
                <div v-if="roleDetail.runtimeMode === 'SIDECAR'" class="text-[10px] text-muted-foreground truncate" :title="roleDetail.runnerImage || ''">
                  Runner: {{ roleDetail.runnerImage || '-' }}
                </div>
                <div v-if="roleDetail.runtimeError" class="text-[10px] text-red-600">
                  {{ roleDetail.runtimeError }}
                </div>
              </div>
            </div>

            <!-- Git Repos -->
            <div v-if="roleDetail.gitRepos?.length" class="space-y-2">
              <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Code class="h-3 w-3" />
                代码仓库
                <Badge variant="outline" class="ml-auto text-[9px] px-1.5 py-0">{{ roleDetail.gitRepos.length }}</Badge>
              </h4>
              <div class="space-y-1.5">
                <div 
                  v-for="(repo, idx) in roleDetail.gitRepos" 
                  :key="idx" 
                  class="p-2 rounded-lg border border-border/30 bg-muted/10 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all group"
                  :title="repo.url"
                >
                  <div class="flex items-center gap-2">
                    <div class="h-6 w-6 rounded bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Globe class="h-3 w-3 text-orange-500" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[10px] font-medium truncate group-hover:text-orange-500 transition-colors">{{ repo.url?.split('/').pop() || repo.url }}</p>
                      <p class="text-[9px] text-muted-foreground/70 font-mono flex items-center gap-1">
                        <span class="truncate max-w-[120px]">{{ repo.url }}</span>
                        <span class="text-orange-500/70">@{{ repo.branch }}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- MCP Modules -->
            <div class="space-y-2">
              <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Server class="h-3 w-3" />
                MCP 服务
                <Badge v-if="roleDetail.mcpModules?.length" variant="outline" class="ml-auto text-[9px] px-1.5 py-0">{{ roleDetail.mcpModules.length }}</Badge>
              </h4>
              <div v-if="roleDetail.mcpModules?.length" class="space-y-1.5">
                <div 
                  v-for="m in roleDetail.mcpModules" 
                  :key="m.id" 
                  class="p-2 rounded-lg border border-border/30 bg-muted/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
                >
                  <div class="flex items-start gap-2">
                    <div class="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Server class="h-3 w-3 text-blue-500" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[11px] font-semibold group-hover:text-blue-500 transition-colors truncate">{{ m.name }}</p>
                      <p class="text-[9px] text-muted-foreground/70 line-clamp-2" :title="m.desc">{{ m.desc }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="p-3 rounded-lg bg-muted/10 border border-dashed border-border/30 text-center">
                <p class="text-[10px] text-muted-foreground/50">暂未配置 MCP 服务</p>
              </div>
            </div>

            <!-- Skills -->
            <div class="space-y-2">
              <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Zap class="h-3 w-3" />
                Skills 插件
                <Badge v-if="roleDetail.skills?.length" variant="outline" class="ml-auto text-[9px] px-1.5 py-0">{{ roleDetail.skills.length }}</Badge>
              </h4>
              <div v-if="roleDetail.skills?.length" class="space-y-1.5">
                <div 
                  v-for="s in roleDetail.skills" 
                  :key="s.name" 
                  class="p-2 rounded-lg border border-border/30 bg-muted/10 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
                >
                  <div class="flex items-start gap-2">
                    <div class="h-6 w-6 rounded bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap class="h-3 w-3 text-purple-500" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-[11px] font-semibold group-hover:text-purple-500 transition-colors truncate">{{ s.name }}</p>
                        <Badge variant="outline" class="text-[8px] px-1 py-0 border-purple-500/20 text-purple-500 shrink-0">{{ s.version }}</Badge>
                      </div>
                      <p class="text-[9px] text-muted-foreground/70 line-clamp-1" :title="s.desc">{{ s.desc }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="p-3 rounded-lg bg-muted/10 border border-dashed border-border/30 text-center">
                <p class="text-[10px] text-muted-foreground/50">暂未配置 Skills 插件</p>
              </div>
            </div>

            <!-- Environment Variables -->
            <div v-if="roleDetail.envVars?.length" class="space-y-2">
              <h4 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Terminal class="h-3 w-3" />
                环境变量
                <Badge variant="outline" class="ml-auto text-[9px] px-1.5 py-0">{{ roleDetail.envVars.length }}</Badge>
              </h4>
              <div class="space-y-1">
                <div 
                  v-for="(env, idx) in roleDetail.envVars" 
                  :key="idx" 
                  class="flex items-center gap-2 p-1.5 rounded bg-muted/20 font-mono text-[10px]"
                >
                  <span class="text-cyan-500 font-medium">{{ env.key }}</span>
                  <span class="text-muted-foreground/50">=</span>
                  <span class="text-muted-foreground truncate flex-1" :title="env.value">{{ env.value }}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>

      <!-- Right Column: Task Execution History -->
      <main class="flex-1 flex flex-col gap-6 min-w-0">
        <!-- Stats Overview -->
        <div class="grid grid-cols-4 gap-4 shrink-0">
          <Card class="bg-card/30 border-border/50">
            <CardContent class="p-4 flex items-center gap-4">
              <div class="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Activity class="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p class="text-2xl font-black">{{ stats.total }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">总任务数</p>
              </div>
            </CardContent>
          </Card>
          <Card class="bg-card/30 border-border/50">
            <CardContent class="p-4 flex items-center gap-4">
              <div class="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Loader2 class="h-5 w-5 text-blue-500 animate-spin" />
              </div>
              <div>
                <p class="text-2xl font-black text-blue-500">{{ stats.running }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">执行中</p>
              </div>
            </CardContent>
          </Card>
          <Card class="bg-card/30 border-border/50">
            <CardContent class="p-4 flex items-center gap-4">
              <div class="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 class="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p class="text-2xl font-black text-emerald-500">{{ stats.completed }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">已完成</p>
              </div>
            </CardContent>
          </Card>
          <Card class="bg-card/30 border-border/50">
            <CardContent class="p-4 flex items-center gap-4">
              <div class="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle class="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p class="text-2xl font-black text-red-500">{{ stats.failed }}</p>
                <p class="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">失败</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- Task List -->
        <Card class="flex-1 bg-card/30 border-border/50 backdrop-blur-sm flex flex-col overflow-hidden">
          <header class="p-4 border-b border-border/50 flex items-center justify-between bg-muted/10 shrink-0">
            <div class="flex items-center gap-3">
              <History class="h-5 w-5 text-primary" />
              <h3 class="text-sm font-bold uppercase tracking-wider">任务执行记录</h3>
              <Badge variant="outline" class="text-[10px] font-mono">{{ taskPagination.total }} 条</Badge>
            </div>
            <Button variant="ghost" size="sm" class="h-8 text-xs font-bold" @click="refreshTaskHistory" :disabled="taskLoading">
              <RefreshCcw class="h-3.5 w-3.5 mr-1.5" :class="taskLoading ? 'animate-spin' : ''" /> 刷新
            </Button>
          </header>

          <ScrollArea class="flex-1">
            <!-- Loading State -->
            <div v-if="taskLoading && taskHistory.length === 0" class="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Loader2 class="h-6 w-6 text-primary animate-spin" />
              <p class="text-sm text-muted-foreground">加载任务记录...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="!taskLoading && taskHistory.length === 0" class="flex flex-col items-center justify-center py-16 text-center gap-3">
              <History class="h-8 w-8 text-muted-foreground/30" />
              <div class="space-y-1">
                <p class="text-sm text-muted-foreground font-medium">暂无任务记录</p>
                <p class="text-xs text-muted-foreground/60">在首页向该岗位发送任务后，执行记录将显示在此处</p>
              </div>
            </div>

            <!-- Task List -->
            <div v-else class="divide-y divide-border/30">
              <div
                v-for="task in taskHistory"
                :key="task.id"
                @click="openTaskDetail(task)"
                class="p-4 hover:bg-muted/30 cursor-pointer transition-colors group"
              >
                <div class="flex items-start gap-4">
                  <!-- Status Icon -->
                  <div
                    class="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border"
                    :class="getStatusColor(task.status)"
                  >
                    <component
                      :is="getStatusIcon(task.status)"
                      class="h-5 w-5"
                      :class="task.status === 'running' ? 'animate-spin' : ''"
                    />
                  </div>

                  <!-- Task Info -->
                  <div class="flex-1 min-w-0 space-y-2">
                    <div class="flex items-center justify-between gap-4">
                      <p class="text-sm font-bold truncate group-hover:text-primary transition-colors">
                        {{ task.prompt }}
                      </p>
                      <Badge
                        variant="outline"
                        class="shrink-0 text-[10px] font-bold"
                        :class="getStatusColor(task.status)"
                      >
                        {{ getStatusLabel(task.status) }}
                      </Badge>
                    </div>

                    <!-- Progress Bar for Running Tasks -->
                    <div v-if="task.status === 'running'" class="space-y-1">
                      <Progress :value="task.progress" class="h-1.5" />
                      <p class="text-[10px] text-muted-foreground">进度: {{ task.progress }}%</p>
                    </div>

                    <!-- Meta Info -->
                    <div class="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span class="font-mono">{{ task.id }}</span>
                      <Badge
                        variant="outline"
                        class="text-[9px] font-bold"
                        :class="getRuntimeModeClass(task.runtimeMode, task.runtimeError)"
                        :title="task.runtimeError || task.runnerImage || ''"
                      >
                        {{ getRuntimeModeLabel(task.runtimeMode, task.runtimeError) }}
                      </Badge>
                      <span class="flex items-center gap-1">
                        <Clock class="h-3 w-3" />
                        {{ task.startTime }}
                      </span>
                      <span v-if="task.duration && task.duration !== '-'" class="flex items-center gap-1">
                        <Activity class="h-3 w-3" />
                        {{ task.duration }}
                      </span>
                      <span v-if="task.tokensUsed > 0" class="flex items-center gap-1">
                        <Cpu class="h-3 w-3" />
                        {{ task.tokensUsed.toLocaleString() }} tokens
                      </span>
                    </div>
                  </div>

                  <!-- Arrow -->
                  <ChevronRight class="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </div>
              </div>
            </div>
          </ScrollArea>
        </Card>
      </main>
    </div>

    <!-- 岗位配置弹窗 -->
    <RoleConfigDialog
      :open="showConfigDialog"
      :role-data="roleDetail"
      @update:open="showConfigDialog = $event"
      @saved="handleConfigSaved"
    />

    <!-- 构建历史弹窗 -->
    <BuildHistoryDialog
      :open="showBuildHistoryDialog"
      :role-id="roleId"
      :role-name="roleDetail.name"
      @update:open="showBuildHistoryDialog = $event"
      @view-log="handleViewBuildLog"
    />

    <!-- 构建日志弹窗 -->
    <BuildLogDialog
      :open="showBuildLogDialog"
      :build-id="selectedBuildNo ?? currentBuildId ?? null"
      :build-no="selectedBuildNo ?? undefined"
      @update:open="val => { showBuildLogDialog = val; if (!val) selectedBuildNo = null; }"
    />
  </div>
</template>

<style scoped>
@keyframes scan {
  from { transform: translateY(-100%); }
  to { transform: translateY(100%); }
}
.animate-scan {
  animation: scan 3s linear infinite;
}
</style>
