<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Wrench, Plus, Search, Code2, Play, Globe, Cpu, Zap, 
  ChevronRight, ArrowUpRight, History, MoreVertical, Star, Upload, Edit3,
  RefreshCcw, Loader2, Trash2, Lock
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useSkills, type Skill } from '@/composables/useSkills'

const router = useRouter()
const { skills, isLoading, isSyncing, fetchSkills, syncSkills, createSkill, updateSkillMeta } = useSkills()

// Search
const searchQuery = ref('')
const filteredSkills = computed(() => {
  if (!searchQuery.value.trim()) return skills.value
  const q = searchQuery.value.toLowerCase()
  return skills.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.displayName?.toLowerCase().includes(q) ||
    s.description?.toLowerCase().includes(q)
  )
})

// Create dialog
const showCreateDialog = ref(false)
const newSkillName = ref('')
const newSkillDesc = ref('')
const newSkillPublic = ref(false)
const isCreating = ref(false)

// Edit dialog (metadata)
const isEditDialogOpen = ref(false)
const editingSkill = ref<Skill | null>(null)

const normalizeBoolean = (value: unknown, defaultValue = false): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'public', 'yes', 'y'].includes(normalized)) return true
    if (['false', '0', 'private', 'no', 'n', ''].includes(normalized)) return false
  }
  return defaultValue
}

const handleCreate = async () => {
  const name = newSkillName.value.trim()
  if (!name) {
    toast.error('请输入 Skill 名称')
    return
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    toast.error('名称只能包含英文字母、数字、连字符和下划线，且以字母开头')
    return
  }

  isCreating.value = true
  try {
    await createSkill(name, newSkillDesc.value.trim(), newSkillPublic.value)
    toast.success(`Skill "${name}" 已创建`)
    showCreateDialog.value = false
    newSkillName.value = ''
    newSkillDesc.value = ''
    newSkillPublic.value = false
    await fetchSkills()
  } catch (e: any) {
    toast.error(e.message || '创建失败')
  } finally {
    isCreating.value = false
  }
}

const handleSync = async () => {
  try {
    const synced = await syncSkills()
    toast.success(`同步完成，更新了 ${synced} 个 Skills`)
  } catch (e: any) {
    toast.error(e.message || '同步失败')
  }
}

const openEdit = (skill: Skill) => {
  editingSkill.value = { ...skill, isPublic: normalizeBoolean(skill.isPublic) }
  isEditDialogOpen.value = true
}

const saveEdit = async () => {
  if (!editingSkill.value) return
  try {
    await updateSkillMeta(editingSkill.value.name, {
      description: editingSkill.value.description || '',
      isPublic: normalizeBoolean(editingSkill.value.isPublic),
    })
    toast.success('Skills 元数据已更新')
    isEditDialogOpen.value = false
    await fetchSkills()
  } catch (e: any) {
    toast.error(e.message || '更新失败')
  }
}

const openEditor = (skill: Skill) => {
  router.push(`/skills/${skill.name}`)
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'ready':
    case 'published': return 'success'
    case 'disabled':
    case 'draft': return 'pending'
    default: return 'pending'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'ready': return 'published'
    case 'disabled': return 'draft'
    default: return status || 'draft'
  }
}

onMounted(() => {
  if (skills.value.length === 0) {
    fetchSkills()
  }
})
</script>

<template>
  <div class="flex flex-col gap-8 max-w-7xl mx-auto py-8 px-4 animate-in fade-in duration-700">
    <div class="flex flex-col md:flex-row gap-4 justify-between items-end">
      <div class="space-y-1">
        <h1 class="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wrench class="h-6 w-6 text-primary" />
          </div>
          Skills 工厂 (Skill Factory)
        </h1>
        <p class="text-muted-foreground">定义、开发并发布 Agent 的原子能力，构建企业级专属 Skills 仓库</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative w-64">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="搜索 Skills 名称..." class="pl-10 h-10 bg-background" />
        </div>
        <Button variant="outline" class="h-10 font-bold" @click="handleSync" :disabled="isSyncing">
          <RefreshCcw class="mr-2 h-4 w-4" :class="isSyncing ? 'animate-spin' : ''" />
          {{ isSyncing ? '同步中...' : '同步' }}
        </Button>
        <Button @click="showCreateDialog = true" class="h-10 font-bold shadow-lg shadow-primary/20 bg-primary">
          <Plus class="mr-2 h-4 w-4" /> 创建新 Skill
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && skills.length === 0" class="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
      <p class="text-sm text-muted-foreground">加载 Skills 列表...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading && skills.length === 0" class="flex flex-col items-center justify-center py-24 gap-4">
      <Wrench class="h-12 w-12 text-muted-foreground/20" />
      <div class="text-center space-y-1">
        <p class="text-lg font-medium text-muted-foreground">暂无 Skills</p>
        <p class="text-sm text-muted-foreground/60">点击「创建新 Skill」开始，或点击「同步 Git」从仓库拉取</p>
      </div>
    </div>

    <!-- Skills Grid: 保持原始 4 列布局 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <Card v-for="skill in filteredSkills" :key="skill.id" class="group hover:border-primary/30 transition-all shadow-md bg-card/50 backdrop-blur">
        <CardHeader class="pb-3">
          <div class="flex justify-between items-start">
            <div class="h-10 w-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Code2 class="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div class="flex flex-col items-end gap-1">
              <Badge :variant="getStatusVariant(skill.status)" class="text-[9px] h-4 tracking-widest uppercase">
                {{ getStatusLabel(skill.status) }}
              </Badge>
              <Badge
                variant="outline"
                class="text-[10px] h-5 px-2 tracking-wide font-semibold gap-1 border"
                :class="normalizeBoolean(skill.isPublic)
                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                  : 'bg-zinc-500/10 text-zinc-700 border-zinc-500/30'"
              >
                <Globe v-if="normalizeBoolean(skill.isPublic)" class="h-3 w-3" />
                <Lock v-else class="h-3 w-3" />
                {{ normalizeBoolean(skill.isPublic) ? '公开' : '私有' }}
              </Badge>
            </div>
          </div>
          <div class="mt-4 space-y-1">
            <CardTitle class="text-lg font-bold group-hover:text-primary transition-colors">
              {{ skill.displayName || skill.name }}
            </CardTitle>
            <CardDescription class="line-clamp-2 text-xs h-8 leading-relaxed">{{ skill.description || '暂无描述' }}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
            <span class="flex items-center gap-1"><Zap class="h-3 w-3 text-orange-500" /> Skill</span>
          </div>
        </CardContent>
        <CardFooter class="border-t border-border/50 p-3 grid grid-cols-2 gap-2 bg-muted/10">
          <Button variant="outline" size="sm" class="h-8 text-[10px] font-bold border-border/50" @click="openEdit(skill)">
            <Edit3 class="mr-1.5 h-3.5 w-3.5" /> 编辑元数据
          </Button>
          <Button size="sm" class="h-8 text-xs font-bold shadow-md shadow-primary/10" @click="openEditor(skill)">
            编辑实现 <ArrowUpRight class="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </CardFooter>
      </Card>
    </div>

    <!-- Create Skill Dialog -->
    <Dialog v-model:open="showCreateDialog">
      <DialogContent class="sm:max-w-[540px] border-border bg-background shadow-2xl">
        <DialogHeader>
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Plus class="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle class="text-xl font-bold tracking-tight">创建新 Skill (New Skill)</DialogTitle>
              <DialogDescription class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">将在 Git 仓库中创建对应分支</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="grid gap-6 py-4">
          <div class="grid gap-2">
            <Label for="new-skill-name" class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Skill 名称</Label>
            <Input
              id="new-skill-name"
              v-model="newSkillName"
              placeholder="如: LogAnalyzer"
              class="bg-muted/30 border-border/50 focus-visible:ring-primary/20"
              @keydown.enter="handleCreate"
            />
            <p class="text-[10px] text-muted-foreground">英文字母开头，可含字母、数字、连字符、下划线</p>
          </div>
          <div class="grid gap-2">
            <Label for="new-skill-desc" class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">描述</Label>
            <Textarea
              id="new-skill-desc"
              v-model="newSkillDesc"
              placeholder="简要描述这个 Skill 的能力..."
              class="min-h-[100px] bg-muted/30 border-border/50 focus-visible:ring-primary/20 resize-none"
            />
          </div>
          <div class="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <div class="space-y-0.5">
              <Label for="new-skill-public" class="text-[11px] font-bold uppercase tracking-widest">是否公开</Label>
              <p class="text-[10px] text-muted-foreground">公开后其他用户可见并可用于岗位配置</p>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="text-[11px] font-semibold"
                :class="newSkillPublic ? 'text-emerald-600' : 'text-zinc-600'"
              >
                {{ newSkillPublic ? '公开' : '私有' }}
              </span>
              <Switch id="new-skill-public" v-model="newSkillPublic" />
            </div>
          </div>
        </div>

        <DialogFooter class="border-t border-border/50 pt-4">
          <Button variant="outline" class="font-bold text-xs" @click="showCreateDialog = false">取消</Button>
          <Button class="font-bold text-xs bg-primary shadow-lg shadow-primary/20" @click="handleCreate" :disabled="isCreating">
            {{ isCreating ? '创建中...' : '创建 Skill' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Skill Dialog -->
    <Dialog v-model:open="isEditDialogOpen">
      <DialogContent class="sm:max-w-[540px] border-border bg-background shadow-2xl">
        <DialogHeader>
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Wrench class="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle class="text-xl font-bold tracking-tight">编辑 Skill 元数据 (Edit Skill)</DialogTitle>
              <DialogDescription class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">ID: {{ editingSkill?.id }} • 能力定义</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div v-if="editingSkill" class="grid gap-6 py-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <Label for="skill-name" class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Skill 名称</Label>
              <Input id="skill-name" v-model="editingSkill.name" disabled class="bg-muted/30 border-border/50 focus-visible:ring-primary/20" />
            </div>
          </div>
          
          <div class="grid gap-2">
            <Label for="skill-desc" class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Skill 描述</Label>
            <Textarea id="skill-desc" v-model="editingSkill.description" class="min-h-[100px] bg-muted/30 border-border/50 focus-visible:ring-primary/20 resize-none" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">当前状态</Label>
              <Badge :variant="getStatusVariant(editingSkill.status)" class="w-fit h-9 px-4 font-bold tracking-widest uppercase border-border/50">
                {{ getStatusLabel(editingSkill.status) }}
              </Badge>
            </div>
            <div class="grid gap-2">
              <Label for="skill-public" class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">是否公开</Label>
              <div class="h-9 flex items-center gap-2">
                <Badge
                  variant="outline"
                  class="h-6 px-2 text-[10px] font-semibold border"
                  :class="normalizeBoolean(editingSkill.isPublic)
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                    : 'bg-zinc-500/10 text-zinc-700 border-zinc-500/30'"
                >
                  <Globe v-if="normalizeBoolean(editingSkill.isPublic)" class="h-3 w-3 mr-1" />
                  <Lock v-else class="h-3 w-3 mr-1" />
                  {{ normalizeBoolean(editingSkill.isPublic) ? '公开' : '私有' }}
                </Badge>
                <Switch id="skill-public" v-model="editingSkill.isPublic" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="border-t border-border/50 pt-4">
          <Button variant="outline" class="font-bold text-xs" @click="isEditDialogOpen = false">取消</Button>
          <Button class="font-bold text-xs bg-primary shadow-lg shadow-primary/20" @click="saveEdit">
            保存元数据更改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
