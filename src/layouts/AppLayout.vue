<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Toaster } from '@/components/ui/sonner'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Menu, Home, Box, Settings, Activity, ChevronDown, Bot, Zap, Server, Wrench, FileText, ShieldCheck, Layers, Briefcase, LogOut, Info, Clock3, Sparkles, Monitor, GraduationCap } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { useUser } from '@/composables/useUser'
import { useMission } from '@/composables/useMission'
import { useApproval } from '@/composables/useApproval'
import { useOnboarding } from '@/composables/useOnboarding'
import { get } from '@/utils/http'
import MissionDrawer from '@/components/business/MissionDrawer.vue'
import ThemeCustomizer from '@/components/ThemeCustomizer.vue'
import GitLabAuthDialog from '@/components/business/GitLabAuthDialog.vue'

const route = useRoute()
const router = useRouter()
const isSidebarOpen = ref(false)
const isGitLabAuthOpen = ref(false)
type WorkMode = 'developer' | 'regular'
const WORK_MODE_STORAGE_KEY = 'linkwork.work-mode'
const workMode = ref<WorkMode>('regular')
const isModeSwitching = ref(false)
let modeApplyTimer: number | null = null
let modeFxTimer: number | null = null
const { isDrawerOpen, isRunning, history, profile, loadMission, fetchHistory, closeDrawer } = useMission()
const { pendingApprovals } = useApproval()
const { logout } = useAuth()
const { user, currentUserName, currentUserAvatar, fetchUser } = useUser()
const {
  shouldShowWelcomeGuide,
  completeWelcomeGuide,
  skipWelcomeGuide,
  resetGuides,
} = useOnboarding()
const k8sAccess = ref(false)
async function checkK8sAccess() {
  try {
    const res = await get<boolean>('/api/v1/k8s-monitor/access-check')
    k8sAccess.value = res.code === 0 && res.data === true
  } catch {
    k8sAccess.value = false
  }
}

const displayUserName = computed(() => currentUserName.value?.trim() || user.value?.workId || '未登录用户')
const userAvatarUrl = computed(() => currentUserAvatar.value?.trim() || '')
const userAvatarFallback = computed(() => {
  const name = displayUserName.value.trim()
  if (!name) return 'U'

  // 英文名取首字母大写；其余取最后一个字
  if (/^[A-Za-z][A-Za-z\s.'-]*$/.test(name)) {
    const firstLetter = name.match(/[A-Za-z]/)?.[0]
    return firstLetter ? firstLetter.toUpperCase() : 'U'
  }

  const chars = Array.from(name)
  return chars[chars.length - 1] || 'U'
})

const isTaskRunning = (task: any) => {
  if (task?.status === 'running') return true
  if (!profile.value || profile.value.id !== task?.id) return false
  return profile.value.status === 'running' || profile.value.status === 'pending' || isRunning.value
}

const hasActiveTask = computed(() => {
  if (history.value.some(task => task.status === 'running' || task.status === 'pending')) {
    return true
  }
  const currentStatus = profile.value?.status
  return currentStatus === 'running' || currentStatus === 'pending' || isRunning.value
})

const isDeveloperMode = computed(() => workMode.value === 'developer')

const menuItems = [
  { name: '指挥中心', nonDeveloperName: '智能体', icon: Home, path: '/' },
  { name: 'AI 岗位', icon: Briefcase, path: '/roles' },
  { name: '任务看板', nonDeveloperName: '历史任务', icon: Activity, path: '/fleet', hasBadge: true },
  { name: '审批中心', icon: ShieldCheck, path: '/approvals', hasApprovalBadge: true, developerOnly: true },
  { name: 'Cron调度', icon: Clock3, path: '/cron-jobs', developerOnly: true },
]

const supplyChainItems = [
  { name: 'MCP 工厂', icon: Server, path: '/mcp' },
  { name: 'Skills 工厂', icon: Wrench, path: '/skills' },
  { name: '记忆空间', icon: FileText, path: '/files' },
]

const visibleMenuItems = computed(() => {
  return menuItems
    .filter(item => isDeveloperMode.value || !item.developerOnly)
    .map(item => ({
      ...item,
      name: !isDeveloperMode.value ? (item.nonDeveloperName || item.name) : item.name
    }))
})

const visibleHistory = computed(() => history.value.slice(0, 20))

const pageTitle = computed(() => {
  if (!isDeveloperMode.value && route.path === '/') return '智能体'
  if (!isDeveloperMode.value && route.path.startsWith('/fleet')) return '历史任务'
  return String(route.meta.title || '仪表盘')
})

const setWorkMode = (mode: WorkMode) => {
  if (workMode.value === mode) return
  if (modeApplyTimer !== null) window.clearTimeout(modeApplyTimer)
  if (modeFxTimer !== null) window.clearTimeout(modeFxTimer)
  isModeSwitching.value = true
  modeApplyTimer = window.setTimeout(() => {
    workMode.value = mode
    localStorage.setItem(WORK_MODE_STORAGE_KEY, mode)
    modeApplyTimer = null
  }, 120)
  modeFxTimer = window.setTimeout(() => {
    isModeSwitching.value = false
    modeFxTimer = null
  }, 620)
}

const loadWorkMode = () => {
  const stored = localStorage.getItem(WORK_MODE_STORAGE_KEY)
  if (stored === 'developer' || stored === 'regular') {
    workMode.value = stored
  }
}

const isPathVisibleForRegularMode = (path: string) => {
  return path === '/' || path.startsWith('/roles') || path.startsWith('/fleet')
}

const navigateTo = (path: string) => {
  router.push(path)
  isSidebarOpen.value = false
  closeDrawer({ disconnect: true })
}

const openTask = (task: any) => {
  loadMission(task)
}

const handleMissionDrawerClose = () => {
  closeDrawer({ disconnect: true })
  if (!route.query?.missionId) return

  const nextQuery = { ...route.query }
  delete (nextQuery as Record<string, unknown>).missionId

  router.replace({
    path: route.path,
    query: nextQuery,
    hash: route.hash
  }).catch(() => {})
}

const getHistoryStatusDotClass = (status: string) => {
  switch (status) {
    case 'running':
      return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
    case 'completed':
      return 'bg-emerald-600'
    case 'failed':
      return 'bg-red-500'
    case 'aborted':
      return 'bg-amber-500'
    case 'pending':
      return 'bg-zinc-400'
    default:
      return 'bg-zinc-400'
  }
}

let historyRefreshTimer: number | null = null

const openGitLabAuthDialogFromEvent = () => {
  isGitLabAuthOpen.value = true
}

type WelcomeGuideStep = {
  id: string
  title: string
  description: string
  target?: string
  routePath?: string
  cta?: string
}

const showWelcomeGuide = ref(false)
const welcomeGuideStep = ref(0)
const welcomeGuideSteps: WelcomeGuideStep[] = [
  {
    id: 'home-nav',
    title: '先认识工作区入口',
    description: '先从左侧主导航开始：这里是任务发起入口，也是你后续最常用的页面。',
    target: 'nav-home',
    routePath: '/',
    cta: '前往任务工作台'
  },
  {
    id: 'task-input',
    title: '输入任务目标',
    description: '在输入区描述你的需求目标，可多行输入（Shift + Enter 换行）。',
    target: 'home-console',
    routePath: '/',
    cta: '回到首页输入区'
  },
  {
    id: 'model-role',
    title: '选择模型和岗位',
    description: '模型决定能力上限，岗位决定执行策略。建议先选岗位再执行。',
    target: 'home-model-role',
    routePath: '/',
    cta: '定位模型和岗位'
  },
  {
    id: 'start-task',
    title: '启动任务执行',
    description: '点击“开启执行”后，任务会进入运行流并持续回传状态与日志。',
    target: 'home-run-task',
    routePath: '/',
    cta: '定位执行按钮'
  },
  {
    id: 'task-board',
    title: '到任务看板看进度',
    description: '任务发起后，去历史任务查看状态、耗时、Tokens 和最终产出。',
    target: 'nav-fleet',
    routePath: '/fleet',
    cta: '前往任务看板'
  },
  {
    id: 'role-guide',
    title: '进入岗位专项引导',
    description: '下一步会进入 AI 岗位页面，触发“新建岗位 + 挂载 MCP/Skills”的细化教程。',
    target: 'nav-roles',
    routePath: '/roles',
    cta: '前往 AI 岗位'
  },
]

const currentWelcomeGuide = computed(() => welcomeGuideSteps[welcomeGuideStep.value])
const isWelcomeGuideFirst = computed(() => welcomeGuideStep.value === 0)
const isWelcomeGuideLast = computed(() => welcomeGuideStep.value >= welcomeGuideSteps.length - 1)
const welcomeGuideTargetRect = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const welcomeGuideCardHeight = 270
const welcomeGuideCardWidth = 360

const getMenuGuideTarget = (path: string) => {
  if (path === '/') return 'nav-home'
  if (path === '/roles') return 'nav-roles'
  if (path === '/fleet') return 'nav-fleet'
  return undefined
}

const isGuideStepRouteMatched = (step: WelcomeGuideStep) => {
  if (!step.routePath) return true
  return route.path === step.routePath || route.path.startsWith(`${step.routePath}/`)
}

const resolveWelcomeGuideTarget = () => {
  const target = currentWelcomeGuide.value?.target
  if (!showWelcomeGuide.value || !target) {
    welcomeGuideTargetRect.value = null
    return
  }

  const el = document.querySelector<HTMLElement>(`[data-guide-target="${target}"]`)
  if (!el) {
    welcomeGuideTargetRect.value = null
    return
  }

  const rect = el.getBoundingClientRect()
  const spotlightGap = 8
  welcomeGuideTargetRect.value = {
    top: Math.max(6, rect.top - spotlightGap),
    left: Math.max(6, rect.left - spotlightGap),
    width: Math.max(24, rect.width + spotlightGap * 2),
    height: Math.max(24, rect.height + spotlightGap * 2)
  }
}

const focusWelcomeGuideStep = async () => {
  if (!showWelcomeGuide.value) return
  const step = currentWelcomeGuide.value
  if (!step) return

  if (!isGuideStepRouteMatched(step) && step.routePath) {
    await router.push(step.routePath)
  }

  await nextTick()
  window.setTimeout(() => {
    resolveWelcomeGuideTarget()
  }, 80)
}

const welcomeGuideSpotlightStyle = computed(() => {
  const rect = welcomeGuideTargetRect.value
  if (!rect) return {}
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
})

const welcomeGuideCardStyle = computed(() => {
  const rect = welcomeGuideTargetRect.value
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
  if (top + welcomeGuideCardHeight > window.innerHeight - padding) {
    top = rect.top - welcomeGuideCardHeight - gap
  }
  top = Math.max(padding, Math.min(top, window.innerHeight - welcomeGuideCardHeight - padding))

  let left = rect.left
  if (left + welcomeGuideCardWidth > window.innerWidth - padding) {
    left = window.innerWidth - welcomeGuideCardWidth - padding
  }
  left = Math.max(padding, left)

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'none'
  }
})

const openWelcomeGuide = () => {
  welcomeGuideStep.value = 0
  showWelcomeGuide.value = true
  void focusWelcomeGuideStep()
}

const closeWelcomeGuide = () => {
  showWelcomeGuide.value = false
  welcomeGuideTargetRect.value = null
}

const skipCurrentWelcomeGuide = () => {
  skipWelcomeGuide()
  closeWelcomeGuide()
}

const nextWelcomeGuideStep = async () => {
  if (!isWelcomeGuideLast.value) {
    welcomeGuideStep.value += 1
    await focusWelcomeGuideStep()
    return
  }

  completeWelcomeGuide()
  closeWelcomeGuide()
}

const prevWelcomeGuideStep = async () => {
  if (welcomeGuideStep.value === 0) return
  welcomeGuideStep.value -= 1
  await focusWelcomeGuideStep()
}

const jumpToCurrentWelcomeStep = async () => {
  await focusWelcomeGuideStep()
}

watch(isDeveloperMode, (enabled) => {
  if (!enabled && !isPathVisibleForRegularMode(route.path)) {
    window.setTimeout(() => {
      if (!isDeveloperMode.value && !isPathVisibleForRegularMode(route.path)) {
        navigateTo('/')
      }
    }, 160)
  }
})

onMounted(() => {
  loadWorkMode()
  fetchHistory()
  if (!user.value) {
    void fetchUser()
  }
  if (shouldShowWelcomeGuide()) {
    openWelcomeGuide()
  }
  checkK8sAccess()
  historyRefreshTimer = window.setInterval(() => {
    fetchHistory()
  }, 8000)

  window.addEventListener('open-gitlab-auth-dialog', openGitLabAuthDialogFromEvent)
  window.addEventListener('resize', resolveWelcomeGuideTarget)
  window.addEventListener('scroll', resolveWelcomeGuideTarget, true)
})

onBeforeUnmount(() => {
  if (historyRefreshTimer !== null) {
    window.clearInterval(historyRefreshTimer)
    historyRefreshTimer = null
  }
  if (modeApplyTimer !== null) {
    window.clearTimeout(modeApplyTimer)
    modeApplyTimer = null
  }
  if (modeFxTimer !== null) {
    window.clearTimeout(modeFxTimer)
    modeFxTimer = null
  }

  window.removeEventListener('open-gitlab-auth-dialog', openGitLabAuthDialogFromEvent)
  window.removeEventListener('resize', resolveWelcomeGuideTarget)
  window.removeEventListener('scroll', resolveWelcomeGuideTarget, true)
})

watch(
  () => [showWelcomeGuide.value, welcomeGuideStep.value, route.path],
  () => {
    if (!showWelcomeGuide.value) return
    void focusWelcomeGuideStep()
  }
)

</script>

<template>
  <div class="flex h-screen bg-background text-foreground font-sans overflow-hidden">
    <Toaster position="top-center" rich-colors />
    
    <!-- 侧边栏 -->
    <aside class="hidden md:flex w-64 flex-col border-r bg-card/50 backdrop-blur-sm shrink-0 z-20">
      <div class="h-16 flex items-center gap-3 px-6 border-b border-border/50">
        <!-- [优化] 方案 A+: 极客 Logo 图标 -->
        <div class="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Bot class="h-6 w-6 text-primary-foreground" />
        </div>
        <div class="flex flex-col">
          <span class="font-mono font-bold text-lg tracking-wider uppercase leading-none">LinkWork</span>
          <span class="font-mono font-medium text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-1">Agent</span>
        </div>
      </div>
      <ScrollArea class="flex-1">
        <nav class="p-4 space-y-6">
          <div class="space-y-2">
            <h4 class="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">主控面板</h4>
            <TransitionGroup name="menu-item" tag="div" class="space-y-2">
              <Button
                v-for="item in visibleMenuItems"
                :key="item.path"
                :variant="route.path === item.path || (item.path !== '/' && route.path.startsWith(item.path)) ? 'secondary' : 'ghost'"
                class="w-full justify-start gap-3 relative group px-3"
                :data-guide-target="getMenuGuideTarget(item.path)"
                @click="navigateTo(item.path)"
              >
                <component :is="item.icon" class="h-4 w-4 transition-colors group-hover:text-primary" />
                <span class="font-bold text-sm">{{ item.name }}</span>
                <Badge v-if="item.hasBadge && hasActiveTask" variant="running" class="ml-auto h-5 px-1.5 min-w-[20px] justify-center text-[10px]">1</Badge>
                <Badge v-if="item.hasApprovalBadge && pendingApprovals.length > 0" class="ml-auto h-5 px-1.5 min-w-[20px] justify-center text-[10px] bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">{{ pendingApprovals.length }}</Badge>
              </Button>
            </TransitionGroup>
          </div>

          <Transition name="mode-section">
            <div v-if="isDeveloperMode" class="space-y-2">
              <h4 class="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">神经中枢</h4>
              <Button v-for="item in supplyChainItems" :key="item.path" :variant="route.path === item.path ? 'secondary' : 'ghost'" class="w-full justify-start gap-3 group" @click="navigateTo(item.path)">
                <component :is="item.icon" class="h-4 w-4 transition-colors group-hover:text-primary" />
                <span class="font-bold text-sm">{{ item.name }}</span>
              </Button>
            </div>
          </Transition>

          <!-- K8s Monitor (权限控制) -->
          <Transition name="mode-section">
            <div v-if="isDeveloperMode && k8sAccess" class="space-y-2">
              <h4 class="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">运维工具</h4>
              <Button :variant="route.path === '/k8s-monitor' ? 'secondary' : 'ghost'" class="w-full justify-start gap-3 group" @click="navigateTo('/k8s-monitor')">
                <Monitor class="h-4 w-4 transition-colors group-hover:text-primary" />
                <span class="font-bold text-sm">K8s 集群监控</span>
              </Button>
              <Button :variant="route.path === '/reports' ? 'secondary' : 'ghost'" class="w-full justify-start gap-3 group" @click="navigateTo('/reports')">
                <FileText class="h-4 w-4 transition-colors group-hover:text-primary" />
                <span class="font-bold text-sm">报表导出</span>
              </Button>
            </div>
          </Transition>

          <!-- Task History Section -->
          <Transition name="mode-section">
            <div v-if="isDeveloperMode && visibleHistory.length > 0" class="space-y-2">
              <h4 class="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center justify-between">
                任务记录
                <span class="bg-muted px-1.5 rounded text-[9px]">{{ visibleHistory.length }}</span>
              </h4>
              <div class="flex flex-col gap-1">
                <Button 
                  v-for="task in visibleHistory" 
                  :key="task.id" 
                  variant="ghost" 
                  class="w-full justify-start items-start gap-3 h-auto py-2 px-3 relative group hover:bg-muted/50 text-left"
                  @click="openTask(task)"
                >
                  <div class="relative flex items-center justify-center h-4 w-4 shrink-0 mt-0.5">
                    <div class="h-2 w-2 rounded-full" :class="getHistoryStatusDotClass(isTaskRunning(task) ? 'running' : task.status)"></div>
                    <div v-if="isTaskRunning(task)" class="absolute h-full w-full rounded-full bg-green-500/30 animate-ping"></div>
                  </div>
                  <div class="flex flex-col flex-1 min-w-0 text-left">
                    <span class="font-medium text-xs truncate w-full leading-tight">{{ task.prompt || '(无任务描述)' }}</span>
                    <span class="text-[9px] text-muted-foreground font-mono truncate">{{ task.id }}</span>
                  </div>
                </Button>
              </div>
            </div>
          </Transition>
        </nav>
      </ScrollArea>
      <div class="p-4 border-t border-border/50">
        <span class="text-[10px] text-muted-foreground flex items-center gap-1">
          <Info class="h-3 w-3 shrink-0" /> 如有问题，请前往
          <a href="https://github.com/momotech/LinkWork/issues" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary/80 hover:underline transition-colors cursor-pointer font-medium">Issues</a>
        </span>
      </div>
    </aside>

    <!-- 移动端 Sidebar (Sheet) -->
    <Sheet v-model:open="isSidebarOpen">
      <SheetContent side="left" class="w-64 p-0 bg-card border-r-border">
        <!-- ...移动端菜单... -->
      </SheetContent>
    </Sheet>

    <GitLabAuthDialog v-model:open="isGitLabAuthOpen" />

    <!-- 主体区域 -->
    <div class="flex-1 flex flex-col min-w-0 relative">
      <header class="h-16 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="icon" class="md:hidden" @click="isSidebarOpen = true"><Menu class="h-5 w-5" /></Button>
          <h1 class="font-semibold text-lg">{{ pageTitle }}</h1>
        </div>
        <div class="flex items-center gap-3">
          <div
            class="hidden lg:flex items-center gap-2 rounded-full border px-2.5 py-1 transition-all duration-500 ease-out"
            :class="[
              isDeveloperMode ? 'border-primary/40 bg-primary/5' : 'border-border/80 bg-muted/30',
              isModeSwitching ? 'scale-[1.05] shadow-xl shadow-primary/20 ring-2 ring-primary/15' : ''
            ]"
          >
            <span class="text-[11px] font-medium text-muted-foreground">开发者模式</span>
            <Switch :model-value="isDeveloperMode" @update:model-value="(value) => setWorkMode(value ? 'developer' : 'regular')" />
          </div>
          <ThemeCustomizer />
          
          <!-- 配置中心 -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="rounded-full text-muted-foreground hover:text-foreground">
                <Settings class="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuLabel>配置中心</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="navigateTo('/security')" class="cursor-pointer">
                <ShieldCheck class="h-4 w-4 mr-2" />
                安全机制
              </DropdownMenuItem>
              <DropdownMenuItem @click="navigateTo('/user-soul')" class="cursor-pointer">
                <Sparkles class="h-4 w-4 mr-2" />
                用户 Soul
              </DropdownMenuItem>
              <DropdownMenuItem @click="isGitLabAuthOpen = true" class="cursor-pointer">
                <div class="h-4 w-4 mr-2 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36 1.5-8 1.5C8.43 8 5.64 7.97 3 8.5c0 0-1 0-3 1.5-.28 1.15-.28 2.35 0 3.5A5.403 5.403 0 0 0 4 17c-2.9 3.5-2.9 6.1-2.9 8.2"/></svg>
                </div>
                GitLab 授权
              </DropdownMenuItem>
              <DropdownMenuItem @click="openWelcomeGuide" class="cursor-pointer">
                <GraduationCap class="h-4 w-4 mr-2" />
                新手引导
              </DropdownMenuItem>
              <DropdownMenuItem @click="resetGuides(); openWelcomeGuide()" class="cursor-pointer">
                <Sparkles class="h-4 w-4 mr-2" />
                重置引导
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

            <!-- 用户下拉菜单 -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="rounded-full h-9 w-9">
                <Avatar class="h-8 w-8 cursor-pointer">
                  <AvatarImage v-if="userAvatarUrl" :src="userAvatarUrl" :alt="displayUserName" />
                  <AvatarFallback class="text-[11px] font-semibold leading-none">{{ userAvatarFallback }}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-48">
              <DropdownMenuLabel class="space-y-0.5">
                <div>我的账户</div>
                <div class="text-xs font-normal text-muted-foreground truncate">{{ displayUserName }}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="logout()" class="cursor-pointer text-red-500 focus:text-red-500">
                <LogOut class="h-4 w-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div class="flex-1 flex overflow-hidden relative min-h-0">
        <main
          class="flex-1 min-h-0 transition-all duration-300"
          :class="route.path === '/' || route.path.startsWith('/skills/') ? 'overflow-hidden p-0' : 'overflow-auto p-6'"
        >
          <router-view :key="route.path" />
        </main>

        <aside 
          class="absolute inset-0 bg-background border-l border-border shadow-none transform transition-transform duration-300 ease-in-out z-30 flex flex-col"
          :class="isDrawerOpen ? 'translate-x-0' : 'translate-x-full'"
        >
          <MissionDrawer @close="handleMissionDrawerClose" />
        </aside>
      </div>
    </div>

    <template v-if="showWelcomeGuide">
      <div class="fixed inset-0 z-[80] bg-zinc-950/70 backdrop-blur-[1px]" />
      <div
        v-if="welcomeGuideTargetRect"
        class="fixed z-[82] rounded-xl border-[3px] border-primary shadow-[0_0_0_2px_rgba(var(--glow-rgb),0.55),0_0_0_9999px_rgba(0,0,0,0.68)] transition-all duration-300 pointer-events-none"
        :style="welcomeGuideSpotlightStyle"
      />

      <div
        class="fixed z-[83] w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl border-2 border-primary/55 bg-background p-4 shadow-[0_24px_80px_rgba(var(--glow-rgb),0.45)] ring-2 ring-primary/35 backdrop-blur-md"
        :style="welcomeGuideCardStyle"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">新手引导</p>
            <h3 class="mt-1 text-base font-bold text-foreground">{{ currentWelcomeGuide.title }}</h3>
          </div>
          <Badge variant="outline" class="text-[11px] border-primary/45 bg-primary/10 text-primary">
            {{ welcomeGuideStep + 1 }} / {{ welcomeGuideSteps.length }}
          </Badge>
        </div>

        <p class="mt-3 text-sm leading-relaxed text-foreground/85">
          {{ currentWelcomeGuide.description }}
        </p>

        <Button
          v-if="currentWelcomeGuide.cta"
          variant="outline"
          size="sm"
          class="mt-3 h-8 text-xs border-primary/35 text-primary hover:bg-primary/10"
          @click="jumpToCurrentWelcomeStep"
        >
          {{ currentWelcomeGuide.cta }}
        </Button>

        <div class="mt-4 flex gap-1.5">
          <div
            v-for="(_, idx) in welcomeGuideSteps"
            :key="idx"
            class="h-1.5 flex-1 rounded-full transition-colors"
            :class="idx <= welcomeGuideStep ? 'bg-primary' : 'bg-muted'"
          />
        </div>

        <div class="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" @click="skipCurrentWelcomeGuide">跳过</Button>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="isWelcomeGuideFirst" @click="prevWelcomeGuideStep">
              上一步
            </Button>
            <Button size="sm" class="shadow-lg shadow-primary/25" @click="nextWelcomeGuideStep">
              {{ isWelcomeGuideLast ? '完成' : '下一步' }}
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mode-section-enter-active,
.mode-section-leave-active {
  overflow: hidden;
  transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), max-height 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}

.mode-section-enter-from,
.mode-section-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.mode-section-enter-to,
.mode-section-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 700px;
}

.menu-item-enter-active,
.menu-item-leave-active,
.menu-item-move {
  transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.menu-item-enter-from,
.menu-item-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
