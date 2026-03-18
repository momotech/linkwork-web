<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { 
  Search, Settings2, Box, Server, GitBranch, Cpu, Clock, CheckCircle2, 
  Plus, Trash2, ChevronRight, Layers, Save, Info, ArrowLeft, Loader2, Zap, Monitor, HardDrive, Package, Activity, Terminal,
  Cpu as CpuIcon, Network, Briefcase, MousePointer2, Keyboard, Headphones, Lightbulb
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

// View Management
const currentView = ref<'list' | 'editor'>('list')

// Resource Categories
const activeCategory = ref<'image' | 'git' | 'env' | 'mcp' | 'skills'>('image')
const searchQuery = ref('')

// State Management
const assemblyForm = ref({
  id: '',
  name: '',
  image: 'ubuntu-22.04-python3.10',
  gitRepos: [] as Array<{ id: string, branch: string }>,
  env: {} as Record<string, string>,
  mcp: [] as string[],
  skills: [] as string[]
})

// Saved Assemblies Mock Data
const savedAssemblies = ref([
  { id: 'asm-01', name: '数据科学深度套件', image: 'ubuntu-22.04-python3.10', updated: '2026-01-28', status: 'ready', mcp: ['github_mcp'], skills: ['log_analyzer'] },
  { id: 'asm-02', name: '自动化审计基座', image: 'kali-linux-rolling', updated: '2026-01-27', status: 'stable', mcp: ['aws_mcp'], skills: ['sec_scanner'] },
  { id: 'asm-03', name: '全栈开发环境 V2', image: 'node-20-alpine', updated: '2026-01-25', status: 'ready', mcp: [], skills: [] }
])

// Environment Editor
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
  assemblyForm.value.env = newEnv
}

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

type ResourceItem = {
  id: string
  name: string
  description: string
  updated: string
  status: string
  icon: any
  branches?: string[]
}

const currentItems = computed((): ResourceItem[] => {
  let list: ResourceItem[] = []
  if (activeCategory.value === 'mcp') list = mcpList
  else if (activeCategory.value === 'skills') list = skillList
  else if (activeCategory.value === 'image') list = imageList
  else if (activeCategory.value === 'git') list = gitList

  if (!searchQuery.value) return list
  return list.filter(item =>
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const selectionCounts = computed(() => ({
  image: assemblyForm.value.image ? 1 : 0,
  git: assemblyForm.value.gitRepos.length,
  env: envPairs.value.filter(p => p.key.trim()).length,
  mcp: assemblyForm.value.mcp.length,
  skills: assemblyForm.value.skills.length
}))

// Visual Effects: Workstation Logic
const isHoveringWorkstation = ref(false)
const getSelectedImageName = computed(() => {
  return imageList.find(img => img.id === assemblyForm.value.image)?.name || 'NO_SIGNAL'
})

// Suck Animation Logic
const workstationRef = ref<HTMLElement | null>(null)
const flyingParticles = ref<Array<{ id: number, x: number, y: number, tx: number, ty: number, icon: any }>>([])

const triggerSuckAnimation = (e: MouseEvent, icon: any, category: string) => {
  if (!workstationRef.value) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const stationRect = workstationRef.value.getBoundingClientRect()
  
  // Calculate target based on equipment position on the desk
  let tx = stationRect.left + stationRect.width / 2
  let ty = stationRect.top + stationRect.height / 2

  if (category === 'image') { tx -= 0; ty -= 100 } // Monitor
  else if (category === 'mcp') { tx -= 180; ty += 50 } // Server Rack
  else if (category === 'skills') { tx += 180; ty += 50 } // Toolbox

  const particle = {
    id: Date.now(),
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    tx, ty, icon
  }

  flyingParticles.value.push(particle)
  setTimeout(() => {
    flyingParticles.value = flyingParticles.value.filter(p => p.id !== particle.id)
  }, 800)
}

const toggleSelection = (id: string, e: MouseEvent, item: any) => {
  if (!isSelected(id)) {
    triggerSuckAnimation(e, item.icon, activeCategory.value)
  }

  if (activeCategory.value === 'image') {
    assemblyForm.value.image = id
    return
  }

  let target: string[] = []
  if (activeCategory.value === 'mcp') target = assemblyForm.value.mcp
  else if (activeCategory.value === 'skills') target = assemblyForm.value.skills
  else if (activeCategory.value === 'git') {
    const idx = assemblyForm.value.gitRepos.findIndex(r => r.id === id)
    if (idx > -1) assemblyForm.value.gitRepos.splice(idx, 1)
    else {
      const repo = gitList.find(r => r.id === id)
      assemblyForm.value.gitRepos.push({ id, branch: repo?.branches[0] || 'main' })
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
  if (activeCategory.value === 'image') return assemblyForm.value.image === id
  if (activeCategory.value === 'mcp') return assemblyForm.value.mcp.includes(id)
  if (activeCategory.value === 'skills') return assemblyForm.value.skills.includes(id)
  if (activeCategory.value === 'git') return assemblyForm.value.gitRepos.some(r => r.id === id)
  return false
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'online': case 'ready': case 'stable': case 'active':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    case 'maintenance': case 'updating':
      return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
    case 'expired': case 'archived':
      return 'text-red-500 bg-red-500/10 border-red-500/20'
    default:
      return 'text-muted-foreground bg-muted border-border'
  }
}

// Navigation Actions
const createNewAssembly = () => {
  assemblyForm.value = {
    id: `ASM-${Date.now().toString().slice(-6)}`,
    name: '新建装配方案',
    image: 'ubuntu-22.04-python3.10',
    gitRepos: [],
    env: {},
    mcp: [],
    skills: []
  }
  envPairs.value = [{ key: '', value: '' }]
  currentView.value = 'editor'
}

const editAssembly = (item: any) => {
  assemblyForm.value = { ...item, gitRepos: [], env: {} }
  currentView.value = 'editor'
}

const isSaving = ref(false)
const saveAssembly = () => {
  isSaving.value = true
  setTimeout(() => {
    isSaving.value = false
    currentView.value = 'list'
    toast.success('装配方案已成功存入工位仓库')
  }, 1500)
}

</script>

<template>
  <div class="flex flex-col gap-6 max-w-7xl mx-auto py-8 px-4 h-full overflow-hidden relative">
    
    <!-- Flying Particles Layer (Suck Animation) -->
    <Teleport to="body">
      <div v-for="p in flyingParticles" :key="p.id" 
        class="fixed z-[9999] pointer-events-none transition-all duration-[800ms] ease-in-out-back"
        :style="{ 
          left: `${p.x}px`, 
          top: `${p.y}px`,
          transform: `translate(-50%, -50%) scale(${0.5})`,
          opacity: 0,
          '--target-x': `${p.tx}px`,
          '--target-y': `${p.ty}px`
        }"
        style="animation: suckFly 0.8s forwards;"
      >
        <div class="h-10 w-10 rounded-xl bg-primary shadow-[0_0_20px_rgba(var(--glow-rgb),0.6)] flex items-center justify-center text-primary-foreground">
          <component :is="p.icon" class="h-6 w-6" />
        </div>
      </div>
    </Teleport>

    <!-- Header Section -->
    <div class="flex items-center justify-between shrink-0">
      <div class="flex items-center gap-4">
        <div class="p-3 rounded-2xl bg-primary/10 text-primary shadow-inner">
          <Layers class="h-6 w-6" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">AI 装配工位</h1>
          <p class="text-sm text-muted-foreground uppercase tracking-widest opacity-60">AI Technician Workstation</p>
        </div>
      </div>
      
      <div v-if="currentView === 'list'">
        <Button @click="createNewAssembly" class="gap-2 bg-primary shadow-lg shadow-primary/20 font-bold h-10 px-6">
          <Plus class="h-4 w-4" /> 新建装配方案
        </Button>
      </div>
      <div v-else class="flex items-center gap-3 animate-in fade-in slide-in-from-right-2">
        <Button variant="ghost" @click="currentView = 'list'" class="h-10 px-4 font-bold text-muted-foreground">
          <ArrowLeft class="h-4 w-4 mr-2" /> 返回列表
        </Button>
        <Button @click="saveAssembly" :disabled="isSaving" class="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 font-bold h-10 px-6 min-w-[140px]">
          <Loader2 v-if="isSaving" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" /> 
          {{ isSaving ? '同步中...' : '提交装配' }}
        </Button>
      </div>
    </div>

    <!-- View 1: Assembly List -->
    <div v-if="currentView === 'list'" class="flex-1 min-h-0 animate-in fade-in zoom-in-95 duration-500">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card 
          v-for="asm in savedAssemblies" 
          :key="asm.id"
          class="group border-border/50 bg-card/30 hover:bg-card hover:border-primary/20 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
          @click="editAssembly(asm)"
        >
          <div class="p-6 space-y-4">
            <div class="flex justify-between items-start">
              <div class="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Monitor class="h-6 w-6" />
              </div>
              <Badge variant="outline" :class="getStatusColor(asm.status)">{{ asm.status }}</Badge>
            </div>
            <div>
              <h3 class="font-bold text-lg group-hover:text-primary transition-colors">{{ asm.name }}</h3>
              <p class="text-xs text-muted-foreground font-mono">ID: {{ asm.id }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Badge variant="secondary" class="bg-muted/50 text-[10px]">{{ asm.image }}</Badge>
              <Badge v-if="asm.mcp.length" variant="secondary" class="bg-blue-500/10 text-blue-600 border-blue-200/50 text-[10px]">MCP: {{ asm.mcp.length }}</Badge>
              <Badge v-if="asm.skills.length" variant="secondary" class="bg-purple-500/10 text-purple-600 border-purple-200/50 text-[10px]">Skills: {{ asm.skills.length }}</Badge>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-border/20 text-[10px] text-muted-foreground font-mono">
              <span class="flex items-center gap-1"><Clock class="h-3 w-3" /> {{ asm.updated }}</span>
              <span class="opacity-0 group-hover:opacity-100 transition-opacity text-primary font-bold">进入工位 →</span>
            </div>
          </div>
        </Card>

        <!-- Create New Card -->
        <div 
          @click="createNewAssembly"
          class="group border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center p-8 gap-4 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
        >
          <div class="h-14 w-14 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground group-hover:scale-110 group-hover:text-primary transition-all">
            <Plus class="h-8 w-8" />
          </div>
          <div class="text-center">
            <p class="font-bold text-sm">创建新工位配置</p>
            <p class="text-xs text-muted-foreground italic">New AI Workstation</p>
          </div>
        </div>
      </div>
    </div>

    <!-- View 2: Workstation Assembly (Desk Feel) -->
    <div v-else class="flex-1 flex gap-6 min-h-0 animate-in slide-in-from-bottom-4 duration-700">
      
      <!-- Left: Inventory Selector -->
      <aside class="w-72 flex flex-col gap-4 shrink-0 overflow-hidden">
        <div class="flex-1 flex flex-col rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden shadow-sm">
          <div class="p-4 border-b border-border/50 space-y-4 bg-muted/10">
            <h4 class="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Package class="h-3 w-3" /> 组件库
            </h4>
            <nav class="grid grid-cols-3 gap-2">
              <button 
                v-for="cat in [
                  { id: 'image', icon: Monitor, label: '系统' },
                  { id: 'git', icon: GitBranch, label: '源码' },
                  { id: 'env', icon: Terminal, label: '配置' },
                  { id: 'mcp', icon: Server, label: '服务' },
                  { id: 'skills', icon: Cpu, label: 'Skills' }
                ]"
                :key="cat.id"
                @click="activeCategory = cat.id as any"
                class="flex flex-col items-center justify-center p-2 rounded-lg transition-all group border border-transparent"
                :class="activeCategory === cat.id ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'"
              >
                <component :is="cat.icon" class="h-4 w-4 mb-1" />
                <span class="text-[9px] font-bold">{{ cat.label }}</span>
              </button>
            </nav>
          </div>

          <ScrollArea class="flex-1">
            <div class="p-3 space-y-2">
              <div 
                v-for="item in currentItems" 
                :key="item.id"
                @click="toggleSelection(item.id, $event, item)"
                class="group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer overflow-hidden"
                :class="isSelected(item.id) ? 'bg-primary/10 border-primary shadow-sm' : 'bg-background/40 border-border/50 hover:border-primary/20'"
              >
                <div class="h-8 w-8 rounded-lg flex items-center justify-center border bg-muted/20" :class="isSelected(item.id) ? 'text-primary border-primary/30' : 'text-muted-foreground'">
                  <component :is="item.icon" class="h-4 w-4" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold truncate">{{ item.name }}</p>
                  <p class="text-[9px] text-muted-foreground truncate opacity-60">{{ item.description }}</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <!-- System Stats Overlay -->
        <div class="p-4 rounded-2xl bg-zinc-900 text-zinc-100 border-t-4 border-primary shadow-2xl font-mono">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-black text-zinc-500 uppercase flex items-center gap-2">
              <Activity class="h-3 w-3 text-primary" /> WORKSTATION_STATUS
            </span>
            <div class="flex gap-1">
              <div v-for="i in 3" :key="i" class="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
            </div>
          </div>
          <div class="space-y-1 text-[10px]">
            <div class="flex justify-between"><span class="text-zinc-500">POWER:</span> <span class="text-emerald-400">OPTIMAL</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">UPTIME:</span> <span>102:44:12</span></div>
            <div class="flex justify-between"><span class="text-zinc-500">LOAD:</span> <span class="text-primary font-bold">STABLE</span></div>
          </div>
        </div>
      </aside>

      <!-- Center: The Assembly Desk (Workstation View) -->
      <main 
        class="flex-1 flex flex-col rounded-[3rem] border-8 border-zinc-800 bg-zinc-900/40 relative overflow-hidden group/station shadow-[0_0_100px_rgba(0,0,0,0.5)]"
        :class="{ 'border-primary/20': isHoveringWorkstation }"
      >
        <!-- Desk Surface Background -->
        <div class="absolute inset-0 bg-zinc-950/60 pointer-events-none"></div>
        <div class="absolute inset-0 opacity-[0.05] pointer-events-none" style="background-image: linear-gradient(0deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent); background-size: 50px 50px;"></div>

        <!-- AI Technician Desk Environment -->
        <div 
          ref="workstationRef"
          class="flex-1 relative flex items-center justify-center p-12 overflow-hidden"
          @mouseenter="isHoveringWorkstation = true"
          @mouseleave="isHoveringWorkstation = false"
        >
          <!-- The Desk Layout -->
          <div class="relative w-full h-full flex items-center justify-center">
            
            <!-- 1. Main Monitor (Image/OS) -->
            <div class="absolute top-[10%] w-80 h-56 transition-all duration-500 group/monitor" :class="{ 'scale-105 -translate-y-2': isHoveringWorkstation }">
              <!-- Monitor Stand -->
              <div class="absolute bottom-[-20px] left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-800 rounded-b-lg skew-x-[20deg]"></div>
              <div class="absolute bottom-[-20px] left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-800 rounded-b-lg -skew-x-[20deg]"></div>
              
              <!-- Monitor Frame -->
              <div class="relative w-full h-full bg-zinc-950 rounded-xl border-8 border-zinc-800 shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
                <div class="h-6 bg-zinc-900 flex items-center px-4 justify-between border-b border-zinc-800">
                  <div class="flex gap-1">
                    <div class="h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
                    <div class="h-1.5 w-1.5 rounded-full bg-zinc-700"></div>
                  </div>
                  <span class="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">OS_INTERFACE</span>
                </div>
                <div class="flex-1 bg-zinc-900 p-4 flex flex-col items-center justify-center gap-2">
                  <div class="relative">
                    <Monitor class="h-12 w-12 text-primary/40 animate-pulse" />
                    <div v-if="assemblyForm.image" class="absolute inset-0 flex items-center justify-center">
                      <div class="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--glow-rgb),1)]"></div>
                    </div>
                  </div>
                  <div class="text-center">
                    <p class="text-[10px] font-black text-zinc-100 tracking-tight uppercase leading-none">{{ getSelectedImageName }}</p>
                    <p class="text-[7px] text-zinc-500 font-mono mt-1 italic tracking-tighter">SIGNAL_CONNECTED</p>
                  </div>
                </div>
                <!-- Scanline effect -->
                <div class="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                  <div class="w-full h-1 bg-white/10 animate-scan"></div>
                </div>
              </div>
            </div>

            <!-- 2. Server Rack (MCP Servers) -->
            <div class="absolute left-[-20px] top-[40%] w-44 h-64 bg-zinc-900 rounded-2xl border-4 border-zinc-800 shadow-2xl flex flex-col p-4 gap-3 group/rack transition-all" :class="{ '-translate-x-2': isHoveringWorkstation }">
              <div class="flex items-center gap-2 mb-1">
                <Server class="h-4 w-4 text-blue-500" />
                <span class="text-[9px] font-black text-zinc-500 uppercase tracking-widest">MCP_RACK</span>
              </div>
              <div v-for="i in 5" :key="i" class="h-8 rounded-lg bg-zinc-950 border border-zinc-800/50 flex items-center px-3 gap-2 relative overflow-hidden">
                <div class="h-1.5 w-1.5 rounded-full" :class="assemblyForm.mcp.length >= i ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]' : 'bg-zinc-800'"></div>
                <div class="flex-1 h-0.5 bg-zinc-800 rounded-full">
                  <div v-if="assemblyForm.mcp.length >= i" class="h-full bg-blue-500/40" style="width: 100%"></div>
                </div>
                <span class="text-[7px] font-mono text-zinc-600">SLOT_{{ i }}</span>
              </div>
              <div class="mt-auto flex justify-center gap-1">
                <div v-for="i in 3" :key="i" class="h-1 w-1 rounded-full bg-zinc-800"></div>
              </div>
            </div>

            <!-- 3. Tool Bay (Skills/Techniques) -->
            <div class="absolute right-[-20px] top-[40%] w-48 h-56 bg-zinc-900 rounded-2xl border-4 border-zinc-800 shadow-2xl p-5 flex flex-col gap-4 group/tools transition-all" :class="{ 'translate-x-2': isHoveringWorkstation }">
              <div class="flex items-center gap-2">
                <CpuIcon class="h-4 w-4 text-purple-500" />
                <span class="text-[9px] font-black text-zinc-500 uppercase tracking-widest">TECH_BAY</span>
              </div>
              <div class="flex-1 grid grid-cols-2 gap-2">
                <div v-for="i in 4" :key="i" class="rounded-xl border-2 border-dashed border-zinc-800 flex items-center justify-center transition-colors overflow-hidden" :class="{ 'border-purple-500/30 bg-purple-500/5': assemblyForm.skills.length >= i }">
                  <Zap v-if="assemblyForm.skills.length >= i" class="h-5 w-5 text-purple-500 animate-pulse" />
                  <div v-else class="h-2 w-2 rounded-full bg-zinc-800"></div>
                </div>
              </div>
              <div class="text-[8px] font-mono text-zinc-600 text-center tracking-tighter">MODULE_SLOTS: 04/04</div>
            </div>

            <!-- Peripheral Decor: Keyboard/Mouse -->
            <div class="absolute bottom-[10%] left-[20%] w-32 h-12 bg-zinc-800/40 rounded-xl border border-zinc-700/50 flex items-center justify-center opacity-40">
              <Keyboard class="h-5 w-5 text-zinc-500" />
            </div>
            <div class="absolute bottom-[10%] right-[25%] w-10 h-14 bg-zinc-800/40 rounded-full border border-zinc-700/50 flex items-center justify-center opacity-40">
              <MousePointer2 class="h-5 w-5 text-zinc-500 rotate-[20deg]" />
            </div>
          </div>
        </div>

        <!-- Annotation Labels -->
        <div class="absolute top-1/4 right-12 w-32 space-y-1.5 group pointer-events-none">
          <div class="h-px bg-primary/20 w-full scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-700"></div>
          <p class="text-[8px] font-black text-primary uppercase text-right tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity duration-500">Live Workspace</p>
          <p class="text-[7px] text-muted-foreground text-right leading-tight opacity-0 group-hover:opacity-100 transition-opacity duration-700">Components are actively synced to the physical workstation core.</p>
        </div>
      </main>

      <!-- Right: Detailed Configuration Panel -->
      <aside class="w-80 flex flex-col gap-4 shrink-0">
        <div class="flex-1 rounded-2xl border border-border bg-card/30 backdrop-blur-sm p-6 space-y-6 overflow-hidden flex flex-col">
          <div class="space-y-4">
            <h4 class="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
              <Settings2 class="h-4 w-4 text-primary" /> 工位配置详情
            </h4>
            
            <div class="space-y-2">
              <Label class="text-[10px] font-bold text-muted-foreground uppercase">方案代号</Label>
              <Input v-model="assemblyForm.name" placeholder="请输入方案名称..." class="h-10 text-sm font-bold bg-background/50 border-border/50 focus-visible:ring-primary/20" />
            </div>

            <div class="space-y-2">
              <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">当前正在装配: {{ activeCategory.toUpperCase() }}</Label>
              <div class="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 relative overflow-hidden group/progress">
                <p class="text-[10px] text-muted-foreground leading-relaxed relative z-10">
                  选择左侧资源，将其注入到工位对应的物理设备中。
                </p>
                <div v-if="selectionCounts[activeCategory as keyof typeof selectionCounts] > 0" class="flex flex-wrap gap-1.5 relative z-10">
                  <Badge variant="outline" class="text-[8px] font-black bg-primary text-primary-foreground border-none px-2 py-0.5 rounded-sm">
                    READY ({{ selectionCounts[activeCategory as keyof typeof selectionCounts] }})
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <Separator class="bg-border/50" />

          <!-- Multi-Git Branch Selector if Git is active -->
          <div v-if="activeCategory === 'git'" class="space-y-4">
            <h5 class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <GitBranch class="h-3 w-3 text-orange-500" /> Git 仓库同步
            </h5>
            <ScrollArea class="max-h-[200px]">
              <div class="space-y-3 pr-2">
                <div v-for="repo in assemblyForm.gitRepos" :key="repo.id" class="p-3 rounded-lg border border-border/50 bg-background/40 space-y-2 hover:border-primary/30 transition-colors group/repo">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black truncate group-hover/repo:text-primary transition-colors">{{ gitList.find(r => r.id === repo.id)?.name }}</span>
                  </div>
                  <Select v-model="repo.branch">
                    <SelectTrigger class="h-7 text-[9px] font-mono bg-background/50 border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="br in gitList.find(r => r.id === repo.id)?.branches" :key="br" :value="br" class="text-[9px] font-mono">
                        {{ br }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ScrollArea>
          </div>

          <!-- Environment Summary if Env is active -->
          <div v-if="activeCategory === 'env'" class="space-y-4 flex-1 flex flex-col overflow-hidden">
            <div class="flex items-center justify-between shrink-0">
              <h5 class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Terminal class="h-3 w-3 text-primary" /> 环境配置
              </h5>
              <Button variant="ghost" size="sm" class="h-6 text-[9px] font-bold text-primary hover:bg-primary/10" @click="addEnvPair">
                <Plus class="h-3 w-3 mr-1" /> 新增
              </Button>
            </div>
            <ScrollArea class="flex-1">
              <div class="space-y-2 pr-3">
                <div v-for="(pair, idx) in envPairs" :key="idx" class="flex gap-2 group animate-in fade-in duration-300">
                  <Input v-model="pair.key" @input="syncEnv" placeholder="KEY" class="h-8 text-[9px] font-mono flex-1 bg-background/50 border-zinc-800 focus:border-primary/40 transition-colors" />
                  <Input v-model="pair.value" @input="syncEnv" placeholder="VALUE" class="h-8 text-[9px] font-mono flex-1 bg-background/50 border-zinc-800 focus:border-primary/40 transition-colors" />
                  <Button variant="ghost" size="icon" class="h-8 w-8 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 shrink-0" @click="removeEnvPair(idx)">
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>

          <div v-if="activeCategory !== 'git' && activeCategory !== 'env'" class="mt-auto p-5 rounded-xl bg-muted/20 border-2 border-dashed border-border/50 text-center space-y-2">
            <Lightbulb class="h-5 w-5 text-primary/40 mx-auto" />
            <p class="text-[10px] text-muted-foreground italic font-medium leading-relaxed">
              您的选择将实时同步到工位的物理设备中，请确认连接状态。
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
@keyframes suckFly {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
  100% { left: var(--target-x); top: var(--target-y); transform: translate(-50%, -50%) scale(0); opacity: 0; }
}

@keyframes scan {
  from { transform: translateY(-100%); }
  to { transform: translateY(100%); }
}
.animate-scan {
  animation: scan 2s linear infinite;
}

.ease-in-out-back {
  transition-timing-function: cubic-bezier(0.68, -0.6, 0.32, 1.6);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--primary) / 0.2);
  border-radius: 10px;
}
</style>
