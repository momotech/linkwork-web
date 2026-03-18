<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { Switch } from '@/components/ui/switch'
import {
  Settings2, Server, Zap, GitBranch, Variable, Box,
  Plus, Trash2, Bot, Brain, Cog, Code, Globe, Terminal, ShieldCheck,
  Briefcase, LayoutPanelLeft, Palette, Lock, Check
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  AVAILABLE_IMAGES,
  type DeployMode
} from '@/composables/useAIRoles'
import { useMcpServers } from '@/composables/useMcpServers'
import { useSkills } from '@/composables/useSkills'
import { type RuntimeMode, parseRuntimeMode } from '@/types/runtime-mode'

// Props & Emits
export interface RoleData {
  id?: string
  name: string
  description: string
  prompt?: string
  category: string
  icon?: string
  image: string
  mcpModules: Array<{ id: string; name: string; desc: string }>
  skills: Array<{ id: string; name: string; version?: string; desc: string }>
  gitRepos?: Array<{ url: string; branch: string }>
  envVars?: Array<{ key: string; value: string }>
  deployMode?: DeployMode
  runtimeMode?: RuntimeMode
  zzMode?: 'ssh' | 'local'
  runnerImage?: string | null
  isPublic?: boolean
  maxEmployees?: number
}

const props = withDefaults(defineProps<{
  open: boolean
  roleData?: RoleData
  title?: string
  mode?: 'create' | 'edit'
  initialCategory?: string
  guideActive?: boolean
  guideStep?: string
  guideCardVisible?: boolean
  guideTitle?: string
  guideDescription?: string
  guideProgress?: string
  guideIsFirst?: boolean
  guideIsLast?: boolean
}>(), {
  title: '岗位配置',
  mode: 'edit',
  guideActive: false,
  guideStep: '',
  guideCardVisible: false,
  guideTitle: '',
  guideDescription: '',
  guideProgress: '',
  guideIsFirst: false,
  guideIsLast: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': [data: any]
  'guide-prev': []
  'guide-next': []
  'guide-skip': []
}>()

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

// 分类选项
const categoryOptions = [
  { id: 'devops', label: '系统运维' },
  { id: 'security', label: '安全攻防' },
  { id: 'developer', label: '代码开发' },
  { id: 'research', label: '科学研究' },
  { id: 'product', label: '产品' },
  { id: 'design', label: '设计' },
  { id: 'internal', label: '内部系统' },
]

// 可选资源列表
const { mcpServers: availableMcpServices, fetchMcpServers } = useMcpServers()
const { availableSkills: availableSkillsList, fetchAvailableSkills } = useSkills()
const availableRunnerImages = AVAILABLE_IMAGES
const DEFAULT_IMAGE = 'ubuntu:22.04'
const DEFAULT_DEPLOY_MODE: DeployMode = 'K8S'
const DEFAULT_RUNTIME_MODE: RuntimeMode = 'ALONE'
const DEFAULT_CREATE_CATEGORY = 'devops'
const CATEGORY_IDS = new Set(categoryOptions.map((item) => item.id))

const resolveCreateCategory = (category?: string) => {
  if (category && CATEGORY_IDS.has(category)) {
    return category
  }
  return DEFAULT_CREATE_CATEGORY
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

interface RoleForm {
  name: string
  description: string
  prompt: string
  category: string
  icon: string
  image: string
  deployMode: DeployMode
  runtimeMode: RuntimeMode
  runnerImage: string
  mcpServices: string[]
  skills: string[]
  gitRepos: Array<{ url: string; branch: string }>
  envVars: Array<{ key: string; value: string }>
  envVarsJson: string
  isPublic: boolean
  maxEmployees: number
}

// 表单数据
const form = ref<RoleForm>({
  name: '',
  description: '',
  prompt: '',
  category: resolveCreateCategory(props.initialCategory),
  icon: 'server',
  image: DEFAULT_IMAGE,
  deployMode: DEFAULT_DEPLOY_MODE,
  runtimeMode: DEFAULT_RUNTIME_MODE,
  runnerImage: '',
  mcpServices: [] as string[],
  skills: [] as string[],
  gitRepos: [] as { url: string; branch: string }[],
  envVars: [] as { key: string; value: string }[],
  envVarsJson: '{}',
  isPublic: false,
  maxEmployees: 1,
})

// 当前激活的资源 Tab
const activeResourceTab = ref('mcp')

const showRunnerImage = computed(() => form.value.deployMode === 'K8S' && form.value.runtimeMode === 'SIDECAR')
const forcedGuideResourceTab = computed(() => {
  if (!props.guideActive) return null
  if (props.guideStep === 'mount-mcp') return 'mcp'
  if (props.guideStep === 'mount-skills') return 'skills'
  return null
})
const isGuideStep = (steps: string[]) => {
  return props.guideActive && !!props.guideStep && steps.includes(props.guideStep)
}

// 资源配置 Tabs
const resourceTabs = computed(() => {
  const tabs = [
    { id: 'mcp', label: 'MCP', icon: Server, count: form.value.mcpServices.length, color: 'text-primary bg-primary' },
    { id: 'skills', label: 'Skills', icon: Zap, count: form.value.skills.length, color: 'text-primary bg-primary' },
    { id: 'git', label: 'Git仓库', icon: GitBranch, count: form.value.gitRepos.length, color: 'text-primary bg-primary' },
    { id: 'env', label: '环境变量', icon: Variable, count: (form.value.envVarsJson.match(/:/g) || []).length, color: 'text-primary bg-primary' },
  ]

  if (showRunnerImage.value) {
    tabs.unshift({ id: 'runner-image', label: 'Runner 镜像', icon: Box, count: 1, color: 'text-primary bg-primary' })
  }

  return tabs
})

// 监听 roleData 变化，初始化表单
watch(() => [props.roleData, props.open], () => {
  // Dialog 打开时加载真实 MCP 列表和 Skills 列表
  if (props.open && availableMcpServices.value.length === 0) {
    fetchMcpServers()
  }
  if (props.open && availableSkillsList.value.length === 0) {
    fetchAvailableSkills()
  }

  if (props.mode === 'edit' && props.roleData) {
    const newData = props.roleData
    const deployMode: DeployMode = newData.deployMode === 'COMPOSE' ? 'COMPOSE' : 'K8S'
    const runtimeFromApi = parseRuntimeMode(newData.runtimeMode) || DEFAULT_RUNTIME_MODE
    const normalizedRuntimeMode: RuntimeMode = deployMode === 'COMPOSE' ? 'ALONE' : runtimeFromApi

    form.value = {
      name: newData.name || '',
      description: newData.description || '',
      prompt: newData.prompt || '',
      category: newData.category || 'devops',
      icon: newData.icon || 'server',
      image: newData.image || DEFAULT_IMAGE,
      deployMode,
      runtimeMode: normalizedRuntimeMode,
      runnerImage: normalizedRuntimeMode === 'SIDECAR'
        ? (newData.runnerImage || DEFAULT_IMAGE)
        : '',
      mcpServices: newData.mcpModules?.map(m => m.id) || [],
      skills: newData.skills?.map(s => s.id) || [],
      gitRepos: newData.gitRepos ? newData.gitRepos.map(g => ({ url: g.url, branch: g.branch })) : [],
      envVars: newData.envVars ? [...newData.envVars] : [],
      envVarsJson: JSON.stringify(
        (newData.envVars || []).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}),
        null,
        2
      ),
      isPublic: normalizeBoolean(newData.isPublic),
      maxEmployees: newData.maxEmployees ?? 1,
    }
  } else if (props.mode === 'create' && props.open) {
    // Reset form for create mode
    form.value = {
      name: '',
      description: '',
      prompt: '',
      category: resolveCreateCategory(props.initialCategory),
      icon: 'server',
      image: DEFAULT_IMAGE,
      deployMode: DEFAULT_DEPLOY_MODE,
      runtimeMode: DEFAULT_RUNTIME_MODE,
      runnerImage: '',
      mcpServices: [],
      skills: [],
      gitRepos: [],
      envVars: [],
      envVarsJson: '{\n  "LOG_LEVEL": "debug"\n}',
      isPublic: false,
      maxEmployees: 1,
    }
  }

  activeResourceTab.value = showRunnerImage.value ? 'runner-image' : 'mcp'
}, { immediate: true, deep: true })

watch(() => form.value.deployMode, (deployMode) => {
  if (deployMode === 'COMPOSE') {
    form.value.runtimeMode = 'ALONE'
    form.value.runnerImage = ''
  }
})

watch(() => form.value.runtimeMode, (runtimeMode) => {
  if (runtimeMode === 'ALONE') {
    form.value.runnerImage = ''
    if (activeResourceTab.value === 'runner-image') {
      activeResourceTab.value = 'mcp'
    }
    return
  }

  const currentRunner = form.value.runnerImage?.trim()
  if (!currentRunner) {
    form.value.runnerImage = DEFAULT_IMAGE
  }
})

watch(showRunnerImage, (show) => {
  if (forcedGuideResourceTab.value) return
  if (!show && activeResourceTab.value === 'runner-image') {
    activeResourceTab.value = 'mcp'
  }
  if (show && activeResourceTab.value === 'mcp') {
    activeResourceTab.value = 'runner-image'
  }
})

watch(forcedGuideResourceTab, (tab) => {
  if (!tab) return
  activeResourceTab.value = tab
}, { immediate: true })

// 资源切换函数
const toggleMcpService = (serviceId: string) => {
  const index = form.value.mcpServices.indexOf(serviceId)
  if (index > -1) {
    form.value.mcpServices.splice(index, 1)
  } else {
    form.value.mcpServices.push(serviceId)
  }
}

const toggleSkill = (skillId: string) => {
  const index = form.value.skills.indexOf(skillId)
  if (index > -1) {
    form.value.skills.splice(index, 1)
  } else {
    form.value.skills.push(skillId)
  }
}

const addGitRepo = () => {
  form.value.gitRepos.push({ url: '', branch: 'master' })
}

const removeGitRepo = (index: number) => {
  form.value.gitRepos.splice(index, 1)
}

// 环境变量操作
// const addEnvVar = () => { ... } // Removed
// const removeEnvVar = (index: number) => { ... } // Removed

// 保存配置
const saveConfig = () => {
  if (!form.value.name.trim()) {
    toast.error('请输入岗位名称')
    return
  }
  if (!form.value.description.trim()) {
    toast.error('请输入岗位描述')
    return
  }
  const normalizedPrompt = form.value.prompt.trim()
  if (!normalizedPrompt) {
    toast.error('请输入岗位自定义 Prompt')
    return
  }

  // Parse Env Vars JSON
  let parsedEnvVars = []
  try {
    const json = JSON.parse(form.value.envVarsJson)
    parsedEnvVars = Object.entries(json).map(([key, value]) => ({ key, value: String(value) }))
  } catch (e) {
    toast.error('环境变量 JSON 格式错误')
    return
  }

  const deployMode = form.value.deployMode
  const runtimeMode: RuntimeMode = deployMode === 'COMPOSE' ? 'ALONE' : form.value.runtimeMode
  const resolvedRunnerImage = runtimeMode === 'SIDECAR'
    ? (form.value.runnerImage || DEFAULT_IMAGE).trim()
    : null

  // 构建更新数据
  const updateData = {
    ...form.value,
    prompt: normalizedPrompt,
    image: DEFAULT_IMAGE,
    deployMode,
    runtimeMode,
    zzMode: runtimeMode === 'SIDECAR' ? 'ssh' : 'local',
    runnerImage: resolvedRunnerImage,
    envVars: parsedEnvVars,
    // 将 ID 数组转换回完整对象
    mcpModules: form.value.mcpServices.map(id => {
      const svc = availableMcpServices.value.find(s => s.id === id)
      return { id, name: svc?.name || id, desc: svc?.description || '' }
    }),
    skills: form.value.skills.map(id => {
      const skill = availableSkillsList.value.find(s => String(s.id) === id)
      return { id, name: skill?.name || id, desc: skill?.description || '' }
    }),
    gitRepos: form.value.gitRepos.filter(r => r.url.trim()),
  }

  emit('saved', updateData)
  emit('update:open', false)
  toast.success('岗位配置已保存')
}

// 关闭弹窗
const closeDialog = () => {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[700px] h-[80vh] overflow-hidden flex flex-col" data-role-guide-target="role-dialog-root">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Settings2 v-if="mode === 'edit'" class="h-5 w-5 text-primary" />
          <Plus v-else class="h-5 w-5 text-primary" />
          {{ title }}
        </DialogTitle>
        <DialogDescription>
          {{ mode === 'edit' ? '编辑岗位的基本信息和关联资源' : '配置 AI 岗位的基本信息和关联资源' }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="guideCardVisible"
        class="rounded-xl border-2 border-primary/55 bg-background p-3 shadow-[0_16px_50px_rgba(var(--glow-rgb),0.30)] ring-2 ring-primary/30"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">岗位引导</p>
            <h4 class="mt-1 text-sm font-bold text-foreground">{{ guideTitle }}</h4>
          </div>
          <Badge variant="outline" class="text-[10px] border-primary/45 bg-primary/10 text-primary">
            {{ guideProgress }}
          </Badge>
        </div>
        <p class="mt-2 text-xs leading-relaxed text-foreground/85">
          {{ guideDescription }}
        </p>
        <div class="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" class="h-8 px-2 text-xs" @click="emit('guide-skip')">跳过</Button>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" class="h-8 px-2 text-xs" :disabled="guideIsFirst" @click="emit('guide-prev')">
              上一步
            </Button>
            <Button size="sm" class="h-8 px-2 text-xs shadow-lg shadow-primary/25" @click="emit('guide-next')">
              {{ guideIsLast ? '完成' : '下一步' }}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea class="flex-1 pr-4 -mr-4">
        <div class="space-y-6 py-4 px-1">
          <!-- 基本信息 -->
          <div
            class="space-y-4 rounded-xl transition-all"
            :class="isGuideStep(['basic-info']) ? 'ring-2 ring-primary/35 bg-primary/5 p-3' : ''"
            data-role-guide-target="role-basic-info"
          >
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-bold flex items-center gap-2">
                <div class="h-1.5 w-1.5 rounded-full bg-primary"></div>
                基本信息
              </h4>
              <div class="flex items-center space-x-2">
                <Label for="is-public" class="text-sm font-medium">是否公开</Label>
                <Badge
                  variant="outline"
                  class="h-6 px-2 text-[10px] font-semibold border"
                  :class="form.isPublic ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-zinc-500/10 text-zinc-700 border-zinc-500/30'"
                >
                  {{ form.isPublic ? '公开' : '私有' }}
                </Badge>
                <Switch id="is-public" v-model="form.isPublic" />
              </div>
            </div>

            <div class="space-y-2">
              <Label>岗位图标</Label>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="opt in iconOptions"
                  :key="opt.id"
                  variant="outline"
                  size="sm"
                  class="h-10 w-10 p-0"
                  :class="form.icon === opt.id ? 'border-primary bg-primary/10 text-primary' : ''"
                  @click="form.icon = opt.id"
                >
                  <component :is="opt.icon" class="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>岗位名称 <span class="text-red-500">*</span></Label>
                <Input v-model="form.name" placeholder="如：全栈运维专家" class="focus-visible:ring-offset-0" />
              </div>
              <div class="space-y-2">
                <Label>岗位类别</Label>
                <Select v-model="form.category">
                  <SelectTrigger class="focus:ring-offset-0">
                    <SelectValue placeholder="选择类别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="cat in categoryOptions" :key="cat.id" :value="cat.id">
                      {{ cat.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>最大员工数 (Max Employees)</Label>
                <Input type="number" v-model.number="form.maxEmployees" disabled class="bg-muted focus-visible:ring-offset-0" />
              </div>
            </div>

            <div
              class="grid grid-cols-2 gap-4 rounded-lg transition-all"
              :class="isGuideStep(['deploy-runtime']) ? 'ring-2 ring-primary/35 bg-primary/5 p-3' : ''"
              data-role-guide-target="role-deploy-runtime"
            >
              <div class="space-y-2">
                <Label>部署模式</Label>
                <Select v-model="form.deployMode">
                  <SelectTrigger class="focus:ring-offset-0">
                    <SelectValue placeholder="选择部署模式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K8S">K8S（在线构建部署）</SelectItem>
                    <SelectItem value="COMPOSE">自定义 Compose（导出 YAML）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div v-if="form.deployMode === 'K8S'" class="space-y-2">
                <Label>运行模式</Label>
                <Select v-model="form.runtimeMode">
                  <SelectTrigger class="focus:ring-offset-0">
                    <SelectValue placeholder="选择运行模式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIDECAR">SIDECAR（双容器）</SelectItem>
                    <SelectItem value="ALONE">ALONE（单容器）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p v-if="form.deployMode === 'COMPOSE'" class="text-xs text-muted-foreground rounded-md border border-dashed p-2 bg-muted/20">
              Compose 模式将按 ALONE 生成 docker-compose.yml，供你自定义挂载后手动部署。
            </p>

            <div class="space-y-2">
              <Label>岗位描述 <span class="text-red-500">*</span></Label>
              <Textarea v-model="form.description" placeholder="描述该岗位的职责和能力..." rows="2" class="focus-visible:ring-offset-0" />
            </div>

            <div class="space-y-2">
              <Label>自定义 Prompt <span class="text-red-500">*</span></Label>
              <Textarea
                v-model="form.prompt"
                placeholder="定义该岗位的系统提示词，例如：你是一个专业的运维工程师，擅长处理 K8s 集群问题..."
                rows="4"
                class="font-mono text-sm focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <!-- 资源配置 Tabs -->
          <div
            class="space-y-4 rounded-xl transition-all"
            :class="isGuideStep(['mount-mcp', 'mount-skills']) ? 'ring-2 ring-primary/35 bg-primary/5 p-3' : ''"
            data-role-guide-target="role-resource-tabs"
          >
            <h4 class="text-sm font-bold flex items-center gap-2">
              <div class="h-1.5 w-1.5 rounded-full bg-primary"></div>
              关联资源
            </h4>

            <!-- Tab 导航 -->
            <div class="flex gap-1 p-1 bg-muted/30 rounded-lg overflow-x-auto">
              <button
                v-for="tab in resourceTabs"
                :key="tab.id"
                @click="activeResourceTab = tab.id"
                class="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0"
                :class="activeResourceTab === tab.id 
                  ? `bg-background shadow-sm ${tab.color.split(' ')[0]}` 
                  : 'text-muted-foreground hover:text-foreground'"
              >
                <component :is="tab.icon" class="h-3.5 w-3.5" />
                {{ tab.label }}
                <Badge 
                  v-if="tab.count > 0" 
                  class="h-5 min-w-5 px-1.5 text-[10px] text-white"
                  :class="tab.color.split(' ')[1]"
                >
                  {{ tab.count }}
                </Badge>
              </button>
            </div>

            <!-- Tab 内容 -->
            <div class="border rounded-lg p-4 bg-background/50 shrink-0 min-h-[200px]">
              <!-- Runner 镜像 -->
              <div v-show="activeResourceTab === 'runner-image'" class="space-y-3">
                <div class="grid grid-cols-1 gap-2">
                  <div
                    v-for="img in availableRunnerImages"
                    :key="img.id"
                    @click="form.runnerImage = img.id"
                    class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50"
                    :class="form.runnerImage === img.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30'"
                  >
                    <div
                      class="h-4 w-4 shrink-0 rounded-sm border border-primary flex items-center justify-center transition-colors"
                      :class="form.runnerImage === img.id ? 'bg-primary text-primary-foreground' : 'bg-transparent'"
                    >
                      <Check v-if="form.runnerImage === img.id" class="h-3 w-3" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{{ img.name }}</p>
                      <p class="text-xs text-muted-foreground truncate">{{ img.description }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- MCP 服务 -->
              <div v-show="activeResourceTab === 'mcp'">
                <div v-if="availableMcpServices.length === 0" class="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Server class="h-8 w-8 mb-2 opacity-40" />
                  <p class="text-sm">暂无 MCP 服务</p>
                  <p class="text-xs mt-1">请先在「供应链 → MCP」中添加</p>
                </div>
                <div v-else class="grid grid-cols-2 gap-2">
                <div
                  v-for="svc in availableMcpServices"
                  :key="svc.id"
                  @click="toggleMcpService(svc.id)"
                  class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50"
                  :class="form.mcpServices.includes(svc.id) ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30'"
                >
                  <div
                    class="h-4 w-4 shrink-0 rounded-sm border border-primary flex items-center justify-center transition-colors"
                    :class="form.mcpServices.includes(svc.id) ? 'bg-primary text-primary-foreground' : 'bg-transparent'"
                  >
                    <Check v-if="form.mcpServices.includes(svc.id)" class="h-3 w-3" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ svc.name }}</p>
                    <p class="text-xs text-muted-foreground truncate">{{ svc.description }}</p>
                  </div>
                </div>
              </div>
              </div>

              <!-- Skills -->
              <div v-show="activeResourceTab === 'skills'">
                <div v-if="availableSkillsList.length === 0" class="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Zap class="h-8 w-8 mb-2 opacity-40" />
                  <p class="text-sm">暂无 Skills</p>
                  <p class="text-xs mt-1">请先在「供应链 → Skills 工厂」中创建</p>
                </div>
                <div v-else class="grid grid-cols-2 gap-2">
                <div
                  v-for="skill in availableSkillsList"
                  :key="String(skill.id)"
                  @click="toggleSkill(String(skill.id))"
                  class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50"
                  :class="form.skills.includes(String(skill.id)) ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30'"
                >
                  <div
                    class="h-4 w-4 shrink-0 rounded-sm border border-primary flex items-center justify-center transition-colors"
                    :class="form.skills.includes(String(skill.id)) ? 'bg-primary text-primary-foreground' : 'bg-transparent'"
                  >
                    <Check v-if="form.skills.includes(String(skill.id))" class="h-3 w-3" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ skill.displayName || skill.name }}</p>
                    <p class="text-xs text-muted-foreground truncate">{{ skill.description }}</p>
                  </div>
                </div>
              </div>
              </div>

              <!-- 代码仓库 -->
              <div v-show="activeResourceTab === 'git'" class="space-y-3">
                <div class="flex justify-end">
                  <Button variant="outline" size="sm" class="h-7 text-xs" @click="addGitRepo">
                    <Plus class="h-3 w-3 mr-1" /> 添加仓库
                  </Button>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(repo, index) in form.gitRepos"
                    :key="index"
                    class="flex items-center gap-2"
                  >
                    <Input
                      v-model="repo.url"
                      placeholder="仓库地址，如 git.example.com/org/repo"
                      class="flex-[3] h-9 font-mono text-sm"
                    />
                    <Input
                      v-model="repo.branch"
                      placeholder="分支"
                      class="flex-1 h-9 font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-9 w-9 text-muted-foreground hover:text-red-500"
                      @click="removeGitRepo(index)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                  <p v-if="form.gitRepos.length === 0" class="text-xs text-muted-foreground italic py-8 text-center border border-dashed rounded-lg bg-muted/20">
                    暂无关联仓库，点击上方"添加仓库"按钮新增
                  </p>
                </div>
              </div>

              <!-- 环境变量 -->
              <div v-show="activeResourceTab === 'env'" class="space-y-3 flex flex-col">
                <div class="flex-1">
                  <Label class="mb-2 block text-xs text-muted-foreground">环境变量配置 (JSON)</Label>
                  <Textarea
                    v-model="form.envVarsJson"
                    placeholder='{ "KEY": "VALUE" }'
                    class="font-mono text-xs min-h-[250px] bg-muted/30 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="pt-4 border-t">
        <Button variant="outline" @click="closeDialog">取消</Button>
        <Button
          @click="saveConfig"
          class="gap-2 transition-all"
          :class="isGuideStep(['save-role']) ? 'ring-2 ring-primary/50 ring-offset-2' : ''"
          data-role-guide-target="role-save-button"
        >
          {{ mode === 'edit' ? '保存配置' : '创建岗位' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
