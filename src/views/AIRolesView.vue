<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search, Users, Briefcase, Plus, Activity, Clock, Cpu, Zap,
  ChevronRight, MoreHorizontal, ShieldCheck, Code, Globe, Terminal,
  LayoutDashboard, Server, HardDrive, Monitor, Star, Heart,
  Bot, Wrench, FileCode, Shield, Brain, Cog, GitBranch, Variable, Trash2, Lock
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import RoleConfigDialog from '@/components/business/RoleConfigDialog.vue'
import { useAIRoles } from '@/composables/useAIRoles'
import { useOnboarding } from '@/composables/useOnboarding'

const router = useRouter()
const searchQuery = ref('')
const activeCategory = ref('all')
const showCreateDialog = ref(false)
const showRoleGuide = ref(false)
const roleGuideStepIndex = ref(0)

const { roles, isLoading, loadRoles, createRole, updateRole, deleteRole, toggleFavorite } = useAIRoles()
const {
  shouldShowRoleGuide,
  completeRoleGuide,
  skipRoleGuide,
} = useOnboarding()

type RoleGuideStepId =
  | 'roles-overview'
  | 'open-create'
  | 'basic-info'
  | 'deploy-runtime'
  | 'mount-mcp'
  | 'mount-skills'
  | 'save-role'

type RoleGuideStep = {
  id: RoleGuideStepId
  title: string
  description: string
  target?: string
  cta?: string
  requiresDialog?: boolean
}

const roleGuideSteps: RoleGuideStep[] = [
  {
    id: 'roles-overview',
    title: '岗位中心总览',
    description: '这里可以筛选、搜索岗位并进入详情，后续你创建的岗位会优先出现在“我的岗位”。',
    target: 'roles-grid',
    cta: '定位岗位列表'
  },
  {
    id: 'open-create',
    title: '开始新建岗位',
    description: '点击右上角“新增 AI 岗位”，打开岗位配置弹窗。',
    target: 'roles-create-button',
    cta: '定位新增按钮'
  },
  {
    id: 'basic-info',
    title: '填写基础信息',
    description: '先补齐岗位名称、类别、描述和 Prompt，定义岗位角色与边界。',
    target: 'role-basic-info',
    cta: '定位基础信息区',
    requiresDialog: true
  },
  {
    id: 'deploy-runtime',
    title: '配置部署与运行模式',
    description: '根据场景选择 K8S/Compose，以及 ALONE/SIDECAR 运行模式。',
    target: 'role-deploy-runtime',
    cta: '定位部署配置区',
    requiresDialog: true
  },
  {
    id: 'mount-mcp',
    title: '挂载 MCP 资源',
    description: '切到 MCP 页签，勾选该岗位要使用的 MCP 服务。',
    target: 'role-resource-tabs',
    cta: '定位资源挂载区',
    requiresDialog: true
  },
  {
    id: 'mount-skills',
    title: '挂载 Skills',
    description: '切到 Skills 页签，选择要赋予岗位的技能能力集。',
    target: 'role-resource-tabs',
    cta: '定位资源挂载区',
    requiresDialog: true
  },
  {
    id: 'save-role',
    title: '保存并完成创建',
    description: '确认配置后点击“创建岗位”，系统会自动回到列表并刷新数据。',
    target: 'role-save-button',
    cta: '定位创建按钮',
    requiresDialog: true
  },
]

const currentRoleGuide = computed(() => roleGuideSteps[roleGuideStepIndex.value] || roleGuideSteps[0])
const isRoleGuideFirst = computed(() => roleGuideStepIndex.value === 0)
const isRoleGuideLast = computed(() => roleGuideStepIndex.value >= roleGuideSteps.length - 1)
const roleGuideProgress = computed(() => `${roleGuideStepIndex.value + 1} / ${roleGuideSteps.length}`)
const isRoleGuideDialogStep = computed(() => !!currentRoleGuide.value?.requiresDialog)
const isCreateStep = computed(() => showRoleGuide.value && currentRoleGuide.value?.id === 'open-create')
const shouldShowOpenDialogHint = computed(
  () => showRoleGuide.value && isRoleGuideDialogStep.value && !showCreateDialog.value
)
const roleGuideTargetRect = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const roleGuideCardHeight = 286
const roleGuideCardWidth = 380

const resolveRoleGuideTarget = () => {
  const target = currentRoleGuide.value?.target
  if (!showRoleGuide.value || !target) {
    roleGuideTargetRect.value = null
    return
  }

  const el = document.querySelector<HTMLElement>(`[data-role-guide-target="${target}"]`)
  if (!el) {
    roleGuideTargetRect.value = null
    return
  }

  const rect = el.getBoundingClientRect()
  const spotlightGap = 8
  roleGuideTargetRect.value = {
    top: Math.max(6, rect.top - spotlightGap),
    left: Math.max(6, rect.left - spotlightGap),
    width: Math.max(24, rect.width + spotlightGap * 2),
    height: Math.max(24, rect.height + spotlightGap * 2)
  }
}

const focusRoleGuideStep = async () => {
  if (!showRoleGuide.value) return
  await nextTick()
  window.setTimeout(() => {
    resolveRoleGuideTarget()
  }, isRoleGuideDialogStep.value ? 180 : 90)
}

const roleGuideSpotlightStyle = computed(() => {
  const rect = roleGuideTargetRect.value
  if (!rect) return {}
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
})

const roleGuideCardStyle = computed(() => {
  const rect = roleGuideTargetRect.value
  if (!rect) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)'
    }
  }

  const gap = 14
  const padding = 16
  let top = rect.top + rect.height + gap
  if (top + roleGuideCardHeight > window.innerHeight - padding) {
    top = rect.top - roleGuideCardHeight - gap
  }
  top = Math.max(padding, Math.min(top, window.innerHeight - roleGuideCardHeight - padding))

  let left = rect.left
  if (left + roleGuideCardWidth > window.innerWidth - padding) {
    left = window.innerWidth - roleGuideCardWidth - padding
  }
  left = Math.max(padding, left)

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'none'
  }
})

const syncRoleGuideStepContext = () => {
  if (!showRoleGuide.value) return
  if (isRoleGuideDialogStep.value && !showCreateDialog.value) {
    showCreateDialog.value = true
  }
  void focusRoleGuideStep()
}

const openRoleGuide = (stepIndex = 0) => {
  roleGuideStepIndex.value = Math.min(Math.max(stepIndex, 0), roleGuideSteps.length - 1)
  showRoleGuide.value = true
  syncRoleGuideStepContext()
}

const skipCurrentRoleGuide = () => {
  skipRoleGuide()
  showRoleGuide.value = false
  roleGuideTargetRect.value = null
}

const nextRoleGuideStep = async () => {
  if (currentRoleGuide.value.id === 'open-create' && !showCreateDialog.value) {
    showCreateDialog.value = true
  }

  if (!isRoleGuideLast.value) {
    roleGuideStepIndex.value += 1
    await focusRoleGuideStep()
    syncRoleGuideStepContext()
    return
  }

  completeRoleGuide()
  showRoleGuide.value = false
  roleGuideTargetRect.value = null
  toast.success('岗位引导已完成')
}

const prevRoleGuideStep = async () => {
  if (roleGuideStepIndex.value === 0) return
  roleGuideStepIndex.value -= 1
  await focusRoleGuideStep()
  syncRoleGuideStepContext()
}

const jumpToCurrentRoleStep = async () => {
  if (isRoleGuideDialogStep.value && !showCreateDialog.value) {
    showCreateDialog.value = true
  }
  await focusRoleGuideStep()
}

const handleCreateDialogOpenChange = (open: boolean) => {
  showCreateDialog.value = open
}

// Load roles on mount
onMounted(() => {
  loadRoles()
  if (shouldShowRoleGuide()) {
    window.setTimeout(() => {
      openRoleGuide()
    }, 240)
  }
  window.addEventListener('resize', resolveRoleGuideTarget)
  window.addEventListener('scroll', resolveRoleGuideTarget, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resolveRoleGuideTarget)
  window.removeEventListener('scroll', resolveRoleGuideTarget, true)
})

watch(
  () => [showRoleGuide.value, roleGuideStepIndex.value, showCreateDialog.value],
  () => {
    if (!showRoleGuide.value) return
    void focusRoleGuideStep()
  }
)

// 图标选项
const iconOptions = [
  { id: 'server', icon: Server, label: '服务器' },
  { id: 'shield', icon: ShieldCheck, label: '安全' },
  { id: 'code', icon: Code, label: '代码' },
  { id: 'globe', icon: Globe, label: '全球' },
  { id: 'terminal', icon: Terminal, label: '终端' },
  { id: 'bot', icon: Bot, label: '机器人' },
  { id: 'brain', icon: Brain, label: '智能' },
  { id: 'cog', icon: Cog, label: '设置' },
]

// Mock Data for AI Roles - REMOVED
// const aiRoles = ref([...]) - Replaced by useAIRoles

const categories = [
  { id: 'all', label: '全部岗位' },
  { id: 'mine', label: '我的岗位' },
  { id: 'favorite', label: '已收藏' },
  { id: 'devops', label: '运维岗' },
  { id: 'security', label: '安全岗' },
  { id: 'developer', label: '开发岗' },
  { id: 'research', label: '研究岗' }
]

const createPrefillCategory = computed(() => {
  const fromFilter = activeCategory.value
  if (['devops', 'security', 'developer', 'research'].includes(fromFilter)) {
    return fromFilter
  }
  return undefined
})

const filteredRoles = computed(() => {
  return roles.value.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                         role.description.toLowerCase().includes(searchQuery.value.toLowerCase())

    let matchesCategory = false
    if (activeCategory.value === 'all') {
      matchesCategory = true
    } else if (activeCategory.value === 'mine') {
      matchesCategory = role.isMine
    } else if (activeCategory.value === 'favorite') {
      matchesCategory = role.isFavorite
    } else {
      matchesCategory = role.category === activeCategory.value
    }

    return matchesSearch && matchesCategory
  })
})

const normalizeStatus = (status: string) => {
  const normalized = status?.trim().toLowerCase()
  if (['active', 'maintenance', 'disabled'].includes(normalized)) return normalized
  return 'active'
}

const getStatusColor = (status: string) => {
  const normalized = normalizeStatus(status)
  switch (normalized) {
    case 'active': return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30'
    case 'maintenance': return 'text-amber-600 bg-amber-500/10 border-amber-500/30'
    case 'disabled': return 'text-zinc-600 bg-zinc-500/10 border-zinc-500/30'
    default: return 'text-muted-foreground bg-muted border-border'
  }
}

const getStatusLabel = (status: string) => {
  const normalized = normalizeStatus(status)
  switch (normalized) {
    case 'active': return '运行中'
    case 'maintenance': return '维护中'
    case 'disabled': return '已停用'
    default: return '未知状态'
  }
}

const getRuntimeModeLabel = (role: any) => {
  if (role.runtimeError) return 'MODE ERROR'
  if (role.runtimeMode === 'SIDECAR') return 'SIDECAR'
  if (role.runtimeMode === 'ALONE') return 'ALONE'
  return 'MODE ERROR'
}

const getRuntimeModeClass = (role: any) => {
  if (role.runtimeError) return 'bg-red-500/10 text-red-600 border-red-500/20'
  if (role.runtimeMode === 'SIDECAR') return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  if (role.runtimeMode === 'ALONE') return 'bg-zinc-500/10 text-zinc-700 border-zinc-500/20'
  return 'bg-red-500/10 text-red-600 border-red-500/20'
}

const handleToggleFavorite = async (event: Event, roleId: string) => {
  event.stopPropagation()
  const role = roles.value.find(r => r.id === roleId)
  if (role) {
    const newStatus = !role.isFavorite
    await toggleFavorite(roleId, newStatus)
    toast.success(newStatus ? '已添加到收藏' : '已取消收藏')
  }
}

const goToDetails = (roleId: string) => {
  router.push(`/roles/${roleId}`)
}

const getIconComponent = (iconId: string) => {
  const option = iconOptions.find(o => o.id === iconId)
  return option?.icon || Server
}

const openCreateDialog = () => {
  showCreateDialog.value = true
}

const handleCreateRole = async (data: any) => {
  try {
    await createRole(data)
    showCreateDialog.value = false
    toast.success('AI 岗位创建成功')
    
    // Refresh list
    await loadRoles()
    
    // 切换到"我的岗位"分类
    activeCategory.value = 'mine'

    if (showRoleGuide.value) {
      completeRoleGuide()
      showRoleGuide.value = false
    }
  } catch (e) {
    toast.error('创建失败')
  }
}
</script>

<template>
  <div class="relative flex flex-col gap-6 max-w-7xl mx-auto h-full overflow-hidden">
    <!-- Header Area -->
    <div class="flex items-center justify-between shrink-0">
      <div class="flex items-center gap-4">
        <div class="p-3 rounded-2xl bg-primary/10 text-primary shadow-inner">
          <Briefcase class="h-6 w-6" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">AI 岗位</h1>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" class="h-10 px-4 text-xs" @click="openRoleGuide(0)">
          岗位引导
        </Button>
        <Button
          @click="openCreateDialog"
          class="gap-2 bg-primary shadow-lg shadow-primary/20 font-bold h-10 px-6 transition-all"
          :class="isCreateStep ? 'ring-2 ring-primary/50 ring-offset-2' : ''"
          data-role-guide-target="roles-create-button"
        >
          <Plus class="h-4 w-4" /> 新增 AI 岗位
        </Button>
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div class="flex items-center justify-between shrink-0 bg-muted/20 p-2 rounded-xl border border-border/50">
      <div class="flex gap-1">
        <Button 
          v-for="cat in categories" 
          :key="cat.id"
          variant="ghost" 
          size="sm"
          class="h-8 px-4 text-xs font-bold transition-all"
          :class="activeCategory === cat.id ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'"
          @click="activeCategory = cat.id"
        >
          {{ cat.label }}
        </Button>
      </div>
      <div class="relative w-72">
        <Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/40" />
        <Input v-model="searchQuery" placeholder="搜索岗位或职责..." class="h-9 pl-9 text-xs bg-background/50 border border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary" />
      </div>
    </div>

    <!-- Roles Grid -->
    <ScrollArea class="flex-1 -mx-2 px-2">
      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8 rounded-xl transition-all"
        data-role-guide-target="roles-grid"
      >
        <Card 
          v-for="role in filteredRoles" 
          :key="role.id"
          class="group relative border-border/50 bg-card/30 hover:bg-card hover:border-primary/20 hover:shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden h-full min-h-[360px]"
          @click="goToDetails(role.id)"
        >
          <!-- Industrial Background Pattern -->
          <div class="absolute inset-0 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity" style="background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 16px 16px;"></div>
          
          <CardContent class="p-6 relative z-10 h-full flex flex-col gap-5">
            <!-- Role Header: Badge & Status & Favorite -->
            <div class="flex justify-between items-start">
              <div class="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-inner">
                <component :is="getIconComponent(role.icon)" class="h-7 w-7" />
              </div>
              <div class="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 rounded-full"
                  :class="role.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-yellow-500'"
                  @click="handleToggleFavorite($event, role.id)"
                >
                  <Star class="h-4 w-4" :class="role.isFavorite ? 'fill-current' : ''" />
                </Button>
                <Badge variant="outline" :class="['text-[10px] font-bold px-2 py-0.5 border', getStatusColor(role.status)]">
                  {{ getStatusLabel(role.status) }}
                </Badge>
              </div>
            </div>

            <!-- Role Info -->
            <div class="space-y-1.5 min-h-[88px]">
              <h3 class="text-base font-bold tracking-tight group-hover:text-primary transition-colors role-name-ellipsis">{{ role.name }}</h3>
              <p class="text-[11px] text-muted-foreground role-desc-two-lines">{{ role.description }}</p>
              <div class="flex items-center gap-1.5 flex-nowrap">
                <Badge
                  variant="outline"
                  class="text-[9px] font-bold uppercase tracking-wide w-fit"
                  :class="getRuntimeModeClass(role)"
                  :title="role.runtimeError || role.runnerImage || ''"
                >
                  {{ getRuntimeModeLabel(role) }}
                </Badge>
                <Badge
                  variant="outline"
                  class="text-[9px] font-bold tracking-wide gap-1 rounded-full px-2.5 border"
                  :class="role.isPublic ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-zinc-500/10 text-zinc-700 border-zinc-500/30'"
                >
                  <Globe v-if="role.isPublic" class="h-3 w-3" />
                  <Lock v-else class="h-3 w-3" />
                  {{ role.isPublic ? '公开' : '私有' }}
                </Badge>
              </div>
            </div>

            <!-- Components Section -->
            <div class="flex flex-wrap content-start gap-2 pt-3 border-t border-border/30 min-h-[44px]">
              <!-- MCP 服务 -->
              <div v-if="role.resourceCount?.mcp" class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Server class="h-3 w-3 text-blue-500" />
                <span class="text-[10px] font-medium text-blue-600">MCP</span>
                <Badge variant="outline" class="h-4 min-w-4 px-1 text-[9px] border-blue-500/30 text-blue-500">{{ role.resourceCount.mcp }}</Badge>
              </div>

              <!-- Skills 技能 -->
              <div v-if="role.resourceCount?.skills" class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20">
                <Zap class="h-3 w-3 text-purple-500" />
                <span class="text-[10px] font-medium text-purple-600">Skills</span>
                <Badge variant="outline" class="h-4 min-w-4 px-1 text-[9px] border-purple-500/30 text-purple-500">{{ role.resourceCount.skills }}</Badge>
              </div>

              <!-- 无资源时显示提示 -->
              <div v-if="!role.resourceCount?.mcp && !role.resourceCount?.skills" class="text-[10px] text-muted-foreground/50 italic">
                暂无关联资源
              </div>
            </div>

            <!-- Footer Action -->
            <div class="flex items-center justify-between pt-3 mt-auto text-[10px] font-medium text-muted-foreground/60">
              <div class="flex items-center gap-1.5 font-mono">
                <div class="h-1.5 w-1.5 rounded-full bg-primary/60"></div>
                #{{ role.id }}
              </div>
              <div class="flex items-center gap-1 group-hover:text-primary transition-colors group-hover:translate-x-0.5 duration-300">
                查看详情 <ChevronRight class="h-3 w-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Create New Card -->
        <div
          @click="openCreateDialog"
          class="group border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center p-8 gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer min-h-[360px]"
        >
          <div class="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-inner">
            <Plus class="h-8 w-8" />
          </div>
          <div class="text-center">
            <p class="font-black text-sm uppercase tracking-widest">新增 AI 岗位</p>
            <p class="text-xs text-muted-foreground italic mt-1 font-medium">Provision New Role</p>
          </div>
        </div>
      </div>
    </ScrollArea>

    <template v-if="showRoleGuide && !isRoleGuideDialogStep">
      <div class="fixed inset-0 z-[80] bg-zinc-950/70 backdrop-blur-[1px]" />
      <div
        v-if="roleGuideTargetRect"
        class="fixed z-[82] rounded-xl border-[3px] border-primary shadow-[0_0_0_2px_rgba(var(--glow-rgb),0.55),0_0_0_9999px_rgba(0,0,0,0.68)] transition-all duration-300 pointer-events-none"
        :style="roleGuideSpotlightStyle"
      />

      <div
        class="fixed z-[83] w-[380px] max-w-[calc(100vw-1.5rem)] rounded-2xl border-2 border-primary/55 bg-background p-4 shadow-[0_24px_80px_rgba(var(--glow-rgb),0.45)] ring-2 ring-primary/35 backdrop-blur-md"
        :style="roleGuideCardStyle"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">岗位引导</p>
            <h3 class="mt-1 text-base font-bold text-foreground">{{ currentRoleGuide.title }}</h3>
          </div>
          <Badge variant="outline" class="text-[11px] border-primary/45 bg-primary/10 text-primary">
            {{ roleGuideProgress }}
          </Badge>
        </div>

        <p class="mt-3 text-sm leading-relaxed text-foreground/85">
          {{ currentRoleGuide.description }}
        </p>

        <Button
          v-if="currentRoleGuide.cta"
          variant="outline"
          size="sm"
          class="mt-3 h-8 text-xs border-primary/35 text-primary hover:bg-primary/10"
          @click="jumpToCurrentRoleStep"
        >
          {{ currentRoleGuide.cta }}
        </Button>

        <div
          v-if="shouldShowOpenDialogHint"
          class="mt-3 rounded-lg border border-dashed border-primary/45 bg-primary/10 px-3 py-2 text-xs text-primary"
        >
          当前步骤需要新建岗位弹窗，点击下方按钮重新打开。
        </div>

        <Button
          v-if="shouldShowOpenDialogHint"
          variant="outline"
          size="sm"
          class="mt-2 h-8 text-xs border-primary/35 text-primary hover:bg-primary/10"
          @click="openCreateDialog"
        >
          打开新建岗位弹窗
        </Button>

        <div class="mt-4 flex gap-1.5">
          <div
            v-for="(_, index) in roleGuideSteps"
            :key="index"
            class="h-1.5 flex-1 rounded-full transition-colors"
            :class="index <= roleGuideStepIndex ? 'bg-primary' : 'bg-muted'"
          />
        </div>

        <div class="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" @click="skipCurrentRoleGuide">跳过</Button>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="isRoleGuideFirst" @click="prevRoleGuideStep">
              上一步
            </Button>
            <Button size="sm" class="shadow-lg shadow-primary/25" @click="nextRoleGuideStep">
              {{ isRoleGuideLast ? '完成' : '下一步' }}
            </Button>
          </div>
        </div>
      </div>
    </template>

    <!-- Create Role Dialog -->
    <RoleConfigDialog
      :open="showCreateDialog"
      title="新建 AI 岗位"
      mode="create"
      :initial-category="createPrefillCategory"
      :guide-active="showRoleGuide && isRoleGuideDialogStep"
      :guide-step="currentRoleGuide.id"
      :guide-card-visible="showRoleGuide && isRoleGuideDialogStep"
      :guide-title="currentRoleGuide.title"
      :guide-description="currentRoleGuide.description"
      :guide-progress="roleGuideProgress"
      :guide-is-first="isRoleGuideFirst"
      :guide-is-last="isRoleGuideLast"
      @update:open="handleCreateDialogOpenChange"
      @saved="handleCreateRole"
      @guide-prev="prevRoleGuideStep"
      @guide-next="nextRoleGuideStep"
      @guide-skip="skipCurrentRoleGuide"
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

.role-name-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-desc-two-lines {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.1rem;
  min-height: 2.2rem;
  max-height: 2.2rem;
}
</style>
