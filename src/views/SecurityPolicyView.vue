<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Shield, ShieldCheck, ShieldAlert, Plus, Edit2, Trash2, Save,
  Lock, FileWarning, Terminal, Globe, Database, AlertTriangle,
  Loader2, RefreshCw, ChevronRight
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { securityPolicyApi } from '@/composables/useApproval'

// ===== 状态 =====
const policies = ref<any[]>([])
const isLoading = ref(false)

// 弹窗控制
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const editingPolicy = ref<any>(null)

// 新策略表单
const newPolicy = ref({
  name: '',
  description: '',
  rulesText: ''
})

// 编辑策略表单
const editForm = ref({
  name: '',
  description: '',
  rulesText: ''
})

// 新规则弹窗
const showAddRuleDialog = ref(false)
const addRuleToPolicyId = ref<number | null>(null)
const newRule = ref({ name: '', type: 'command' })

// ===== API 调用 =====
const fetchPolicies = async () => {
  isLoading.value = true
  try {
    const data = await securityPolicyApi.list()
    policies.value = data || []
  } catch (err: any) {
    console.error('获取策略列表失败:', err)
    toast.error('获取策略列表失败: ' + (err.message || '未知错误'))
  } finally {
    isLoading.value = false
  }
}

const getPolicyIcon = (type: string) => {
  switch (type) {
    case 'system': return ShieldCheck
    case 'custom': return Shield
    default: return Shield
  }
}

const getRuleIcon = (type: string) => {
  switch (type) {
    case 'command': return Terminal
    case 'file': return FileWarning
    case 'network': return Globe
    case 'sql': return Database
    default: return Lock
  }
}

const getRuleTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    'command': '命令',
    'file': '文件',
    'network': '网络',
    'sql': '数据库'
  }
  return map[type] || type
}

const getRuleTypeBadgeClass = (type: string) => {
  const map: Record<string, string> = {
    'command': 'bg-red-500/10 text-red-500 border-red-500/20',
    'file': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'network': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'sql': 'bg-purple-500/10 text-purple-500 border-purple-500/20'
  }
  return map[type] || 'bg-muted text-muted-foreground'
}

// ===== 操作 =====
const handleTogglePolicy = async (policy: any) => {
  if (policy.type === 'system' && policy.enabled) {
    toast.error('系统策略不能禁用')
    return
  }
  try {
    await securityPolicyApi.toggle(policy.id)
    toast.success(policy.enabled ? '策略已禁用' : '策略已启用')
    await fetchPolicies()
  } catch (err: any) {
    toast.error(err.message || '操作失败')
  }
}

const handleToggleRule = async (policy: any, ruleIndex: number) => {
  if (policy.type === 'system') {
    toast.error('系统策略的规则不可修改')
    return
  }
  const updatedRules = [...policy.rules]
  updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], enabled: !updatedRules[ruleIndex].enabled }
  try {
    await securityPolicyApi.update(policy.id, { rules: updatedRules })
    await fetchPolicies()
  } catch (err: any) {
    toast.error(err.message || '操作失败')
  }
}

const openEditDialog = (policy: any) => {
  if (policy.type === 'system') {
    toast.error('系统策略不可编辑')
    return
  }
  editingPolicy.value = policy
  editForm.value = {
    name: policy.name,
    description: policy.description || '',
    rulesText: ''
  }
  showEditDialog.value = true
}

const saveEditPolicy = async () => {
  if (!editingPolicy.value) return
  try {
    const updates: any = {
      name: editForm.value.name,
      description: editForm.value.description
    }
    await securityPolicyApi.update(editingPolicy.value.id, updates)
    toast.success('策略更新成功')
    showEditDialog.value = false
    await fetchPolicies()
  } catch (err: any) {
    toast.error(err.message || '更新失败')
  }
}

const deletePolicy = async (policy: any) => {
  if (policy.type === 'system') {
    toast.error('系统策略不可删除')
    return
  }
  try {
    await securityPolicyApi.remove(policy.id)
    toast.success('策略已删除')
    await fetchPolicies()
  } catch (err: any) {
    toast.error(err.message || '删除失败')
  }
}

const saveNewPolicy = async () => {
  if (!newPolicy.value.name.trim()) {
    toast.error('请输入策略名称')
    return
  }
  try {
    const rules = newPolicy.value.rulesText
      .split('\n')
      .filter(r => r.trim())
      .map(r => ({ name: r.trim(), type: 'command', enabled: true }))

    await securityPolicyApi.create({
      name: newPolicy.value.name,
      description: newPolicy.value.description,
      rules
    })
    toast.success('策略创建成功')
    newPolicy.value = { name: '', description: '', rulesText: '' }
    showAddDialog.value = false
    await fetchPolicies()
  } catch (err: any) {
    toast.error(err.message || '创建失败')
  }
}

// 添加规则到现有策略
const openAddRuleDialog = (policyId: number) => {
  addRuleToPolicyId.value = policyId
  newRule.value = { name: '', type: 'command' }
  showAddRuleDialog.value = true
}

const saveNewRule = async () => {
  if (!newRule.value.name.trim()) {
    toast.error('请输入规则名称')
    return
  }
  const policy = policies.value.find(p => p.id === addRuleToPolicyId.value)
  if (!policy) return

  const updatedRules = [...(policy.rules || []), { name: newRule.value.name, type: newRule.value.type, enabled: true }]
  try {
    await securityPolicyApi.update(policy.id, { rules: updatedRules })
    toast.success('规则添加成功')
    showAddRuleDialog.value = false
    await fetchPolicies()
  } catch (err: any) {
    toast.error(err.message || '添加规则失败')
  }
}

const deleteRule = async (policy: any, ruleIndex: number) => {
  if (policy.type === 'system') {
    toast.error('系统策略的规则不可删除')
    return
  }
  const updatedRules = policy.rules.filter((_: any, i: number) => i !== ruleIndex)
  try {
    await securityPolicyApi.update(policy.id, { rules: updatedRules })
    toast.success('规则已删除')
    await fetchPolicies()
  } catch (err: any) {
    toast.error(err.message || '删除规则失败')
  }
}

// ===== 统计 =====
const enabledPolicies = () => policies.value.filter(p => p.enabled).length
const totalRules = () => policies.value.reduce((sum, p) => sum + (p.rules?.length || 0), 0)
const enabledRules = () => policies.value.reduce((sum, p) => 
  sum + (p.rules?.filter((r: any) => r.enabled)?.length || 0), 0)

onMounted(() => {
  fetchPolicies()
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl mx-auto py-8 px-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="p-3 rounded-2xl bg-primary/10 text-primary shadow-inner">
          <ShieldCheck class="h-6 w-6" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">安全策略中心</h1>
          <p class="text-sm text-muted-foreground">管理 AI Agent 执行环境的安全边界与访问控制规则</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="fetchPolicies" :disabled="isLoading" title="刷新">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
        </Button>
        <Button @click="showAddDialog = true" class="gap-2 bg-primary shadow-lg shadow-primary/20 font-bold">
          <Plus class="h-4 w-4" /> 新增策略
        </Button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid gap-4 md:grid-cols-3">
      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardContent class="pt-6 flex items-center gap-4">
          <div class="p-2.5 rounded-xl bg-emerald-500/10">
            <ShieldCheck class="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <div class="text-2xl font-mono font-bold">{{ enabledPolicies() }}<span class="text-sm text-muted-foreground font-normal ml-1">/ {{ policies.length }}</span></div>
            <p class="text-xs text-muted-foreground font-medium">活跃策略</p>
          </div>
        </CardContent>
      </Card>
      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardContent class="pt-6 flex items-center gap-4">
          <div class="p-2.5 rounded-xl bg-blue-500/10">
            <Lock class="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <div class="text-2xl font-mono font-bold">{{ enabledRules() }}<span class="text-sm text-muted-foreground font-normal ml-1">/ {{ totalRules() }}</span></div>
            <p class="text-xs text-muted-foreground font-medium">生效规则</p>
          </div>
        </CardContent>
      </Card>
      <Card class="bg-card/50 backdrop-blur border-border/50 shadow-sm">
        <CardContent class="pt-6 flex items-center gap-4">
          <div class="p-2.5 rounded-xl bg-orange-500/10">
            <AlertTriangle class="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <div class="text-2xl font-mono font-bold">{{ policies.filter(p => p.type === 'system').length }}</div>
            <p class="text-xs text-muted-foreground font-medium">系统内置策略</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Loader2 class="h-6 w-6 animate-spin text-primary mr-3" />
      <span class="text-sm text-muted-foreground">加载安全策略...</span>
    </div>

    <!-- Policy List -->
    <div v-else class="space-y-4">
      <Card
        v-for="policy in policies"
        :key="policy.id"
        class="border-border/50 transition-all overflow-hidden"
        :class="policy.enabled ? 'bg-card/50 hover:bg-card/70' : 'bg-muted/20 opacity-60'"
      >
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div
                class="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                :class="policy.type === 'system' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'"
              >
                <component :is="getPolicyIcon(policy.type)" class="h-5 w-5" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <CardTitle class="text-base">{{ policy.name }}</CardTitle>
                  <Badge
                    v-if="policy.type === 'system'"
                    variant="outline"
                    class="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase tracking-widest"
                  >
                    系统内置
                  </Badge>
                  <Badge
                    v-else
                    variant="outline"
                    class="text-[9px] bg-blue-500/10 text-blue-500 border-blue-500/20 uppercase tracking-widest"
                  >
                    自定义
                  </Badge>
                  <Badge
                    v-if="!policy.enabled"
                    variant="outline"
                    class="text-[9px] bg-muted text-muted-foreground uppercase tracking-widest"
                  >
                    已禁用
                  </Badge>
                </div>
                <CardDescription class="text-xs mt-1">{{ policy.description }}</CardDescription>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <Switch
                :model-value="policy.enabled"
                @update:model-value="handleTogglePolicy(policy)"
                :disabled="policy.type === 'system' && policy.enabled"
              />
              <Button
                v-if="policy.type !== 'system'"
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-muted-foreground hover:text-primary"
                @click="openEditDialog(policy)"
                title="编辑策略"
              >
                <Edit2 class="h-3.5 w-3.5" />
              </Button>
              <Button
                v-if="policy.type !== 'system'"
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-muted-foreground hover:text-destructive"
                @click="deletePolicy(policy)"
                title="删除策略"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          <!-- Rules -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                安全规则 ({{ policy.rules?.filter((r: any) => r.enabled)?.length || 0 }}/{{ policy.rules?.length || 0 }})
              </p>
              <Button
                v-if="policy.type !== 'system'"
                variant="ghost"
                size="sm"
                class="h-6 text-xs text-muted-foreground hover:text-primary px-2"
                @click="openAddRuleDialog(policy.id)"
              >
                <Plus class="h-3 w-3 mr-1" /> 添加规则
              </Button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div
                v-for="(rule, idx) in policy.rules"
                :key="idx"
                class="flex items-center justify-between p-3 rounded-lg border transition-all group/rule"
                :class="rule.enabled ? 'bg-muted/30 border-border/30' : 'bg-muted/10 border-border/20 opacity-50'"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <component :is="getRuleIcon(rule.type)" class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span class="text-xs font-medium truncate">{{ rule.name }}</span>
                  <Badge variant="outline" :class="getRuleTypeBadgeClass(rule.type)" class="text-[9px] shrink-0">
                    {{ getRuleTypeLabel(rule.type) }}
                  </Badge>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <Button
                    v-if="policy.type !== 'system'"
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover/rule:opacity-100 transition-opacity"
                    @click="deleteRule(policy, idx)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </Button>
                  <Switch
                    :model-value="rule.enabled"
                    @update:model-value="handleToggleRule(policy, idx)"
                    :disabled="policy.type === 'system'"
                    class="scale-75"
                  />
                </div>
              </div>
            </div>
            <div v-if="!policy.rules || policy.rules.length === 0" class="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
              暂无安全规则
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Empty State -->
      <div v-if="policies.length === 0 && !isLoading" class="text-center py-16">
        <Shield class="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p class="text-sm text-muted-foreground">暂无安全策略</p>
        <Button variant="outline" size="sm" class="mt-4" @click="showAddDialog = true">
          <Plus class="h-3.5 w-3.5 mr-2" /> 创建第一个策略
        </Button>
      </div>
    </div>

    <!-- Add Policy Dialog -->
    <Dialog v-model:open="showAddDialog">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Plus class="h-5 w-5 text-primary" />
            新增安全策略
          </DialogTitle>
          <DialogDescription>创建自定义安全策略来限制 Agent 的执行行为</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">策略名称</Label>
            <Input v-model="newPolicy.name" placeholder="如：生产环境保护策略" class="bg-background" />
          </div>
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">策略描述</Label>
            <Input v-model="newPolicy.description" placeholder="简要描述此策略的用途" class="bg-background" />
          </div>
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">初始规则（每行一条，可选）</Label>
            <Textarea
              v-model="newPolicy.rulesText"
              placeholder="禁止执行 rm 命令&#10;禁止访问 /root 目录&#10;限制网络访问"
              rows="4"
              class="bg-background font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddDialog = false">取消</Button>
          <Button @click="saveNewPolicy" class="gap-1.5">
            <Save class="h-3.5 w-3.5" /> 创建策略
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Policy Dialog -->
    <Dialog v-model:open="showEditDialog">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Edit2 class="h-5 w-5 text-primary" />
            编辑安全策略
          </DialogTitle>
          <DialogDescription>修改策略名称和描述</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">策略名称</Label>
            <Input v-model="editForm.name" placeholder="策略名称" class="bg-background" />
          </div>
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">策略描述</Label>
            <Input v-model="editForm.description" placeholder="策略描述" class="bg-background" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEditDialog = false">取消</Button>
          <Button @click="saveEditPolicy" class="gap-1.5">
            <Save class="h-3.5 w-3.5" /> 保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add Rule Dialog -->
    <Dialog v-model:open="showAddRuleDialog">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Plus class="h-5 w-5 text-primary" />
            添加安全规则
          </DialogTitle>
          <DialogDescription>为策略添加新的安全约束规则</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">规则名称</Label>
            <Input v-model="newRule.name" placeholder="如：禁止执行 sudo 命令" class="bg-background" />
          </div>
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wider text-muted-foreground">规则类型</Label>
            <Select v-model="newRule.type">
              <SelectTrigger class="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="command">命令限制</SelectItem>
                <SelectItem value="file">文件访问</SelectItem>
                <SelectItem value="network">网络控制</SelectItem>
                <SelectItem value="sql">数据库保护</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddRuleDialog = false">取消</Button>
          <Button @click="saveNewRule" class="gap-1.5">
            <Plus class="h-3.5 w-3.5" /> 添加规则
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
