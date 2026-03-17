<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Server, Plus, Search, RefreshCw, Trash2, Edit3, Zap,
  CheckCircle2, AlertCircle, Loader2, Wifi, WifiOff, Radio, Globe, Lock,
  ScanSearch, ChevronDown, ChevronRight, Wrench, FileText, Network, Building2, Cloud, Key
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { post } from '@/utils/http'
import { useMcpHealth, type McpHealthStatus } from '@/composables/useMcpHealth'
import McpUserConfigDialog from '@/components/business/McpUserConfigDialog.vue'

// ---------- Health polling ----------
const { healthMap, fetchHealth } = useMcpHealth()

// ---------- Server list ----------
const servers = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const isGuideDialogOpen = ref(false)

// ---------- Dialog state ----------
const isEditDialogOpen = ref(false)
const isCreateDialogOpen = ref(false)
const editingServer = ref<any>(null)

const emptyForm = () => ({
  name: '',
  endpoint: '',
  description: '',
  visibility: 'private' as 'public' | 'private',
  type: 'http' as 'http' | 'sse',
  networkZone: 'external' as 'internal' | 'office' | 'external',
  url: '',
  headers: '{}',
  healthCheckUrl: '',
  version: '',
  tags: '',
})
const newServer = ref(emptyForm())

// ---------- API helper (Cookie JWT) ----------
const authFetch = async (url: string, options: RequestInit = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  const res = await fetch(url, { ...options, headers, credentials: 'include' })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.msg || 'API Error')
  return json.data
}

// ---------- Load servers ----------
const loadServers = async () => {
  isLoading.value = true
  try {
    const params = new URLSearchParams()
    if (searchQuery.value) params.append('keyword', searchQuery.value)
    const data = await authFetch(`/api/v1/mcp-servers?${params}`)
    servers.value = (data.items || []).map((item: any) => ({
      ...item,
      visibility: normalizeVisibility(item?.visibility),
      status: normalizeStatus(item?.status),
    }))
  } catch (e: any) {
    toast.error(e.message || '加载失败')
  } finally {
    isLoading.value = false
  }
}

// ---------- Refresh all (list + health) ----------
const refreshAll = async () => {
  await Promise.all([loadServers(), fetchHealth()])
}

// ---------- Health helpers ----------
const getHealth = (serverId: string): McpHealthStatus | null => {
  return healthMap.value[serverId] ?? null
}

// ---------- Status Badge config ----------
const statusConfig: Record<string, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  online:   { label: '在线',   classes: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
  degraded: { label: '降级',   classes: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',   icon: AlertCircle },
  offline:  { label: '离线',   classes: 'bg-red-500/10 text-red-600 border-red-500/30',            icon: WifiOff },
  unknown:  { label: '未知',   classes: 'bg-muted text-muted-foreground',                          icon: Radio },
}

const normalizeStatus = (value: unknown): 'online' | 'degraded' | 'offline' | 'unknown' => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['online', 'healthy', 'up', 'ok'].includes(normalized)) return 'online'
    if (['degraded', 'warn', 'warning'].includes(normalized)) return 'degraded'
    if (['offline', 'down', 'error', 'failed'].includes(normalized)) return 'offline'
    if (['unknown', '', 'null'].includes(normalized)) return 'unknown'
  }
  return 'unknown'
}

const getStatusConfig = (status: unknown) => statusConfig[normalizeStatus(status)] || statusConfig.unknown

// ---------- Type Badge config ----------
const typeConfig: Record<string, { label: string; classes: string; icon: typeof Globe }> = {
  http: { label: 'HTTP', classes: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Globe },
  sse:  { label: 'SSE',  classes: 'bg-purple-500/10 text-purple-600 border-purple-500/30', icon: Wifi },
}
const getTypeConfig = (type: string) => typeConfig[type] || typeConfig.http

const networkZoneConfig: Record<string, { label: string; classes: string; icon: typeof Network }> = {
  internal: { label: '内网', classes: 'bg-teal-500/10 text-teal-600 border-teal-500/30', icon: Network },
  office:   { label: '办公网', classes: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Building2 },
  external: { label: '外网', classes: 'bg-sky-500/10 text-sky-600 border-sky-500/30', icon: Cloud },
}
const getNetworkZoneConfig = (zone: string) => networkZoneConfig[zone] || networkZoneConfig.external

const normalizeVisibility = (value: unknown): 'public' | 'private' => {
  if (typeof value === 'boolean') return value ? 'public' : 'private'
  if (typeof value === 'number') return value === 1 ? 'public' : 'private'
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['public', 'true', '1', 'yes', 'y'].includes(normalized)) return 'public'
    if (['private', 'false', '0', 'no', 'n', ''].includes(normalized)) return 'private'
  }
  return 'private'
}

const visibilityConfig: Record<string, { label: string; classes: string }> = {
  public: { label: '公开', classes: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/35' },
  private: { label: '私有', classes: 'bg-zinc-500/10 text-zinc-700 border-zinc-500/35' },
}
const getVisibilityConfig = (visibility: unknown) => visibilityConfig[normalizeVisibility(visibility)] || visibilityConfig.private

const getVisibilityOptionClass = (target: 'public' | 'private', current: unknown) => {
  const normalized = normalizeVisibility(current)
  const selected = normalized === target
  if (target === 'public') {
    return selected
      ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-700 shadow-sm'
      : 'border-border/60 bg-background text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-700'
  }
  return selected
    ? 'border-zinc-500/45 bg-zinc-500/15 text-zinc-700 shadow-sm'
    : 'border-border/60 bg-background text-muted-foreground hover:border-zinc-500/35 hover:text-zinc-700'
}

const canManageServer = (server: any): boolean => server?.canManage !== false

const maskGenericValue = (raw: string): string => {
  const value = String(raw || '').trim()
  if (!value) return '***'
  if (value.length <= 8) return '***'
  return `${value.slice(0, 3)}***${value.slice(-2)}`
}

const maskUrlForDisplay = (rawUrl: unknown): string => {
  const value = String(rawUrl || '').trim()
  if (!value) return '-'
  try {
    const parsed = new URL(value)
    const port = parsed.port ? `:${parsed.port}` : ''
    return `${parsed.protocol}//${parsed.hostname}${port}/***`
  } catch {
    return maskGenericValue(value)
  }
}

const getDisplayUrl = (server: any): string => {
  if (server?.displayUrl) return server.displayUrl
  return maskUrlForDisplay(server?.url || server?.endpoint)
}

// ---------- Parse helpers ----------
const parseHeaders = (raw: string): Record<string, string> | null => {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '{}') return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

const parseTags = (raw: string): string[] | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.split(',').map(t => t.trim()).filter(Boolean)
}

// ---------- Create ----------
const createServer = async () => {
  if (!newServer.value.name.trim()) { toast.error('请输入服务名称'); return }
  if (!newServer.value.url.trim()) { toast.error('请输入服务 URL'); return }

  const body: Record<string, any> = {
    name: newServer.value.name,
    endpoint: newServer.value.url,
    description: newServer.value.description,
    visibility: normalizeVisibility(newServer.value.visibility),
    type: newServer.value.type,
    url: newServer.value.url,
    networkZone: newServer.value.networkZone,
    healthCheckUrl: newServer.value.healthCheckUrl.trim(),
    version: newServer.value.version.trim(),
  }
  const headers = parseHeaders(newServer.value.headers)
  if (headers) body.headers = headers
  const tags = parseTags(newServer.value.tags)
  body.tags = tags || []

  try {
    const created = await authFetch('/api/v1/mcp-servers', { method: 'POST', body: JSON.stringify(body) })
    toast.success('MCP 服务创建成功')
    isCreateDialogOpen.value = false
    newServer.value = emptyForm()
    await refreshAll()
    // 创建成功后自动触发一次连接测试
    if (created?.id) {
      testConnection(created)
    }
  } catch (e: any) {
    toast.error(e.message || '创建失败')
  }
}

// ---------- Edit ----------
const openEdit = (server: any) => {
  if (!canManageServer(server)) {
    toast.error('公开 MCP 仅创建者可编辑')
    return
  }
  editingServer.value = {
    ...server,
    visibility: normalizeVisibility(server.visibility),
    type: server.type || 'http',
    networkZone: server.networkZone || 'external',
    url: server.url || server.endpoint || '',
    headers: server.headers ? JSON.stringify(server.headers, null, 2) : '{}',
    healthCheckUrl: server.healthCheckUrl || '',
    version: server.version || '',
    tags: Array.isArray(server.tags) ? server.tags.join(', ') : (server.tags || ''),
  }
  isEditDialogOpen.value = true
}

const saveEdit = async () => {
  if (!editingServer.value) return
  const s = editingServer.value

  const body: Record<string, any> = {
    name: s.name,
    endpoint: s.url || s.endpoint,
    description: s.description,
    visibility: normalizeVisibility(s.visibility),
    type: s.type,
    url: s.url,
    networkZone: s.networkZone || 'external',
    healthCheckUrl: s.healthCheckUrl?.trim() || '',
    version: s.version?.trim() || '',
  }
  const headers = parseHeaders(s.headers)
  if (headers) body.headers = headers
  const tags = parseTags(s.tags)
  body.tags = tags || []

  try {
    await authFetch(`/api/v1/mcp-servers/${s.id}`, { method: 'PUT', body: JSON.stringify(body) })
    toast.success('MCP 服务配置已更新')
    isEditDialogOpen.value = false
    await refreshAll()
  } catch (e: any) {
    toast.error(e.message || '更新失败')
  }
}

// ---------- Delete ----------
const deleteServer = async (server: any) => {
  if (!canManageServer(server)) {
    toast.error('公开 MCP 仅创建者可删除')
    return
  }
  if (!confirm(`确定要删除 ${server.name} 吗？`)) return
  try {
    await authFetch(`/api/v1/mcp-servers/${server.id}`, { method: 'DELETE' })
    toast.success('删除成功')
    await refreshAll()
  } catch (e: any) {
    toast.error(e.message || '删除失败')
  }
}

// ---------- Test Connection ----------
const testingMap = ref<Record<string, boolean>>({})

const testConnection = async (server: any) => {
  if (!canManageServer(server)) {
    toast.error('公开 MCP 仅创建者可测试连接')
    return
  }
  if (testingMap.value[server.id]) return // 并发控制：同一服务只允许一个请求
  testingMap.value[server.id] = true
  try {
    const resp = await post(`/api/v1/mcp-servers/${server.id}/test`)
    if (resp.code !== 0) throw new Error(resp.msg || 'API Error')
    const { status, message } = resp.data as { status: string; latencyMs: number; message: string; probeUrl: string }
    if (status === 'online') {
      toast.success(`✅ 连接成功 — ${message}`)
    } else if (status === 'degraded') {
      toast.warning(`⚠️ 连接降级 — ${message}`)
    } else {
      toast.error(`❌ 连接失败 — ${message}`)
    }
  } catch (e: any) {
    toast.error(`❌ 连接失败 — ${e.message || '未知错误'}`)
  } finally {
    testingMap.value[server.id] = false
    await fetchHealth()
  }
}

// ---------- Row Expand ----------
const expandedRows = ref<Set<string>>(new Set())

const toggleExpand = (serverId: string) => {
  if (expandedRows.value.has(serverId)) {
    expandedRows.value.delete(serverId)
  } else {
    expandedRows.value.add(serverId)
  }
  // Trigger reactivity
  expandedRows.value = new Set(expandedRows.value)
}

// ---------- Tool types ----------
interface ToolInputProperty {
  type?: string
  description?: string
}

interface ToolInputSchema {
  type?: string
  properties?: Record<string, ToolInputProperty>
  required?: string[]
}

interface McpTool {
  name: string
  description?: string
  inputSchema?: ToolInputSchema
}

// ---------- Discover Tools ----------
const discoveringMap = reactive<Record<string, boolean>>({})

const getServerTools = (server: any): McpTool[] => {
  const cfg = server.configJson
  if (cfg && Array.isArray(cfg.tools)) return cfg.tools
  return []
}

const discoverTools = async (server: any) => {
  if (!canManageServer(server)) {
    toast.error('公开 MCP 仅创建者可发现工具')
    return
  }
  if (discoveringMap[server.id]) return
  discoveringMap[server.id] = true
  try {
    const resp = await post(`/api/v1/mcp-servers/${server.id}/discover`)
    if (resp.code !== 0) throw new Error(resp.msg || 'API Error')
    const data = resp.data as { success: boolean; tools?: McpTool[] | null; error?: string | null }
    if (data.success && data.tools) {
      toast.success(`✅ 发现 ${data.tools.length} 个工具`)
      // Update local server data with discovered tools
      const idx = servers.value.findIndex((s: any) => s.id === server.id)
      if (idx !== -1) {
        if (!servers.value[idx].configJson) servers.value[idx].configJson = {}
        servers.value[idx].configJson.tools = data.tools
        servers.value[idx].configJson.lastDiscoveredAt = new Date().toISOString()
      }
      // Make sure the row is expanded
      if (!expandedRows.value.has(server.id)) {
        expandedRows.value.add(server.id)
        expandedRows.value = new Set(expandedRows.value)
      }
    } else {
      toast.error(`❌ 工具发现失败 — ${data.error || '未知错误'}`)
    }
  } catch (e: any) {
    toast.error(`❌ 工具发现失败 — ${e.message || '未知错误'}`)
  } finally {
    discoveringMap[server.id] = false
  }
}

// ---------- Tool display helpers ----------
const formatToolParams = (tool: McpTool): string[] => {
  const schema = tool.inputSchema
  if (!schema?.properties) return []
  const required = schema.required || []
  return Object.entries(schema.properties).map(([name, prop]) => {
    const type = prop.type || 'any'
    const isRequired = required.includes(name)
    return `${name} (${type}${isRequired ? ', 必填' : ''})`
  })
}

const formatLastDiscovered = (server: any): string | null => {
  const ts = server.configJson?.lastDiscoveredAt
  if (!ts) return null
  try {
    const d = new Date(ts)
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

// ---------- User Config (Credential) Dialog ----------
const isCredentialDialogOpen = ref(false)
const credentialServer = ref<{ id: string; name: string; type?: string } | null>(null)

const openCredentialDialog = (server: any) => {
  credentialServer.value = { id: server.id, name: server.name, type: server.type }
  isCredentialDialogOpen.value = true
}

const registerServer = () => {
  newServer.value = emptyForm()
  isCreateDialogOpen.value = true
}

const mcpInitializeExample = `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "demo-mcp",
      "version": "1.0.0"
    }
  }
}`

const mcpToolsListExample = `{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "search_docs",
        "description": "Search product docs",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": { "type": "string", "description": "search keyword" }
          },
          "required": ["query"]
        }
      }
    ]
  }
}`

const mcpSseExample = `event: message
data: {
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "search_docs",
        "description": "Search product docs",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": { "type": "string" }
          },
          "required": ["query"]
        }
      }
    ]
  }
}`

onMounted(() => {
  loadServers()
})
</script>

<template>
  <div class="flex flex-col gap-8 max-w-7xl mx-auto py-8 px-4 animate-in fade-in duration-700">
    <!-- Header -->
    <div class="flex flex-col md:flex-row gap-4 justify-between items-end">
      <div class="space-y-1">
        <h1 class="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Server class="h-6 w-6 text-primary" />
          </div>
          MCP 服务管理
        </h1>
        <p class="text-muted-foreground">注册并监控模型上下文协议 (Model Context Protocol) 服务，扩展 Agent 的认知边界</p>
      </div>
      <div class="flex items-end gap-3">
        <div class="relative w-64">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" @keyup.enter="loadServers" placeholder="搜索服务名称..." class="pl-10 h-10 bg-background" />
        </div>
        <Button variant="outline" size="icon" class="h-10 w-10" @click="refreshAll" :disabled="isLoading">
          <RefreshCw class="h-4 w-4" :class="isLoading ? 'animate-spin' : ''" />
        </Button>
        <div class="flex flex-col items-center gap-1">
          <span class="text-[10px] text-muted-foreground/80 leading-none">接入指南</span>
          <Button variant="outline" size="icon" class="h-10 w-10" @click="isGuideDialogOpen = true" title="打开 MCP 接入指南">
            <FileText class="h-4 w-4" />
          </Button>
        </div>
        <Button @click="registerServer" class="h-10 font-bold shadow-lg shadow-primary/20">
          <Plus class="mr-2 h-4 w-4" /> 注册新服务
        </Button>
      </div>
    </div>

    <!-- Table Card -->
    <Card class="border-border/50 shadow-md">
      <CardContent class="p-0 overflow-x-auto">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <Loader2 class="h-6 w-6 animate-spin text-primary" />
          <span class="ml-2 text-sm text-muted-foreground">加载中...</span>
        </div>

        <!-- Empty -->
        <div v-else-if="servers.length === 0" class="flex flex-col items-center justify-center py-16 gap-4">
          <div class="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
            <Server class="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div class="text-center">
            <p class="text-sm font-medium text-muted-foreground">暂无 MCP 服务</p>
            <p class="text-xs text-muted-foreground/60 mt-1">点击"注册新服务"开始添加</p>
          </div>
          <Button @click="registerServer" variant="outline" size="sm" class="mt-2">
            <Plus class="h-4 w-4 mr-1" /> 注册新服务
          </Button>
        </div>

        <!-- Data Table -->
        <Table v-else class="min-w-[1160px]">
          <TableHeader>
            <TableRow class="hover:bg-transparent bg-muted/20">
              <TableHead class="w-[160px] pl-6 font-bold uppercase text-[10px] tracking-widest whitespace-nowrap">服务名称</TableHead>
              <TableHead class="w-[80px] font-bold uppercase text-[10px] tracking-widest whitespace-nowrap">类型</TableHead>
              <TableHead class="w-[80px] font-bold uppercase text-[10px] tracking-widest whitespace-nowrap">网段</TableHead>
              <TableHead class="w-[90px] font-bold uppercase text-[10px] tracking-widest whitespace-nowrap">可见性</TableHead>
              <TableHead class="w-[240px] font-bold uppercase text-[10px] tracking-widest whitespace-nowrap">URL</TableHead>
              <TableHead class="w-[140px] font-bold uppercase text-[10px] tracking-widest whitespace-nowrap">健康状态</TableHead>
              <TableHead class="font-bold uppercase text-[10px] tracking-widest whitespace-nowrap">描述</TableHead>
              <TableHead class="w-[120px] text-right pr-6 font-bold uppercase text-[10px] tracking-widest whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="server in servers" :key="server.id">
              <TableRow class="group transition-colors border-border/50 cursor-pointer" @click="toggleExpand(server.id)">
                <!-- Expand indicator + Name -->
                <TableCell class="pl-6 font-bold">
                  <div class="flex items-center gap-2">
                    <component
                      :is="expandedRows.has(server.id) ? ChevronDown : ChevronRight"
                      class="h-4 w-4 text-muted-foreground shrink-0 transition-transform"
                    />
                    {{ server.name }}
                  </div>
                </TableCell>

                <!-- Type Badge -->
                <TableCell>
                  <Badge
                    variant="outline"
                    :class="getTypeConfig(server.type || 'http').classes"
                    class="gap-1 whitespace-nowrap text-[10px]"
                  >
                    <component :is="getTypeConfig(server.type || 'http').icon" class="h-3 w-3" />
                    {{ getTypeConfig(server.type || 'http').label }}
                  </Badge>
                </TableCell>

                <!-- Network Zone -->
                <TableCell>
                  <Badge
                    variant="outline"
                    :class="getNetworkZoneConfig(server.networkZone || 'external').classes"
                    class="gap-1 whitespace-nowrap text-[10px]"
                  >
                    <component :is="getNetworkZoneConfig(server.networkZone || 'external').icon" class="h-3 w-3" />
                    {{ getNetworkZoneConfig(server.networkZone || 'external').label }}
                  </Badge>
                </TableCell>

                <!-- Visibility -->
                <TableCell>
                  <Badge
                    variant="outline"
                    :class="getVisibilityConfig(server.visibility).classes"
                    class="whitespace-nowrap text-[10px] gap-1 border font-semibold rounded-full px-2.5"
                  >
                    <Globe v-if="normalizeVisibility(server.visibility) === 'public'" class="h-3 w-3" />
                    <Lock v-else class="h-3 w-3" />
                    {{ getVisibilityConfig(server.visibility).label }}
                  </Badge>
                </TableCell>

                <!-- URL -->
                <TableCell
                  class="font-mono text-[11px] text-muted-foreground max-w-[220px] truncate"
                  :title="getDisplayUrl(server)"
                >
                  {{ getDisplayUrl(server) }}
                </TableCell>

                <!-- Health Status -->
                <TableCell>
                  <div class="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      :class="getStatusConfig(getHealth(server.id)?.status || server.status || 'unknown').classes"
                      class="gap-1 whitespace-nowrap rounded-full px-2.5 border"
                    >
                      <component :is="getStatusConfig(getHealth(server.id)?.status || server.status || 'unknown').icon" class="h-3 w-3" />
                      {{ getStatusConfig(getHealth(server.id)?.status || server.status || 'unknown').label }}
                    </Badge>
                    <!-- Latency display for online/degraded -->
                    <span
                      v-if="getHealth(server.id)?.latencyMs != null && ['online', 'degraded'].includes(getHealth(server.id)?.status || '')"
                      class="text-[10px] font-mono text-muted-foreground"
                    >
                      {{ getHealth(server.id)!.latencyMs }}ms
                    </span>
                  </div>
                </TableCell>

                <!-- Description -->
                <TableCell class="text-xs text-muted-foreground max-w-[200px] truncate" :title="server.description">
                  {{ server.description || '-' }}
                </TableCell>

                <!-- Actions -->
                <TableCell class="text-right pr-6" @click.stop>
                  <div
                    v-if="canManageServer(server)"
                    class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-primary" @click="openEdit(server)" title="编辑配置">
                      <Edit3 class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-muted-foreground hover:text-violet-600 hover:bg-violet-500/10"
                      :disabled="discoveringMap[server.id]"
                      title="发现工具"
                      @click="discoverTools(server)"
                    >
                      <Loader2 v-if="discoveringMap[server.id]" class="h-4 w-4 animate-spin" />
                      <ScanSearch v-else class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                      :disabled="testingMap[server.id]"
                      title="测试连接"
                      @click="testConnection(server)"
                    >
                      <Loader2 v-if="testingMap[server.id]" class="h-4 w-4 animate-spin" />
                      <Zap v-else class="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                      title="我的凭证"
                      @click="openCredentialDialog(server)"
                    >
                      <Key class="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" title="移除服务" @click="deleteServer(server)">
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                  <span v-else class="text-[10px] text-muted-foreground">仅创建者可管理</span>
                </TableCell>
              </TableRow>

              <!-- Expanded Tools Area -->
              <TableRow v-if="expandedRows.has(server.id)" class="hover:bg-transparent border-border/30">
                <TableCell :colspan="8" class="p-0">
                  <div class="bg-muted/10 px-6 py-4 border-t border-border/20">
                    <!-- Header: Tool count + Discover button -->
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center gap-2 text-sm font-medium">
                        <Wrench class="h-4 w-4 text-muted-foreground" />
                        <span>工具列表</span>
                        <Badge v-if="getServerTools(server).length > 0" variant="secondary" class="text-[10px] px-1.5 py-0">
                          {{ getServerTools(server).length }}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-7 text-xs gap-1.5"
                        :disabled="discoveringMap[server.id] || !canManageServer(server)"
                        @click.stop="discoverTools(server)"
                      >
                        <Loader2 v-if="discoveringMap[server.id]" class="h-3.5 w-3.5 animate-spin" />
                        <ScanSearch v-else class="h-3.5 w-3.5" />
                        发现工具
                      </Button>
                    </div>

                    <!-- Tool cards -->
                    <div v-if="getServerTools(server).length > 0" class="grid gap-2">
                      <div
                        v-for="tool in getServerTools(server)"
                        :key="tool.name"
                        class="border border-border/30 rounded-lg p-3 bg-background/50"
                      >
                        <div class="flex items-start gap-2">
                          <span class="text-sm">🛠</span>
                          <div class="flex-1 min-w-0">
                            <div class="font-mono font-bold text-sm">{{ tool.name }}</div>
                            <div v-if="tool.description" class="text-xs text-muted-foreground mt-0.5">
                              {{ tool.description }}
                            </div>
                            <div v-if="formatToolParams(tool).length > 0" class="text-[11px] text-muted-foreground/80 mt-1.5">
                              <span class="font-medium text-muted-foreground">参数:</span>
                              {{ formatToolParams(tool).join(', ') }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Empty state -->
                    <div v-else class="flex flex-col items-center justify-center py-8 gap-3">
                      <div class="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
                        <ScanSearch class="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <div class="text-center">
                        <p class="text-sm text-muted-foreground">暂未发现工具</p>
                        <p class="text-xs text-muted-foreground/60 mt-0.5">点击「发现工具」获取该服务暴露的工具列表</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        class="mt-1 h-7 text-xs gap-1.5"
                        :disabled="discoveringMap[server.id] || !canManageServer(server)"
                        @click.stop="discoverTools(server)"
                      >
                        <Loader2 v-if="discoveringMap[server.id]" class="h-3.5 w-3.5 animate-spin" />
                        <ScanSearch v-else class="h-3.5 w-3.5" />
                        发现工具
                      </Button>
                    </div>

                    <!-- Last discovered timestamp -->
                    <div v-if="formatLastDiscovered(server)" class="text-[10px] text-muted-foreground/50 mt-3 text-right">
                      上次发现: {{ formatLastDiscovered(server) }}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- ==================== Guide Dialog ==================== -->
    <Dialog v-model:open="isGuideDialogOpen">
      <DialogContent class="sm:max-w-[760px] border-border bg-background shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <FileText class="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle class="text-xl font-bold tracking-tight">MCP 接入指南</DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground">
                平台兼容协议示例：initialize → notifications/initialized → tools/list
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <div class="grid md:grid-cols-2 gap-3">
            <div class="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p class="text-xs font-semibold">支持协议类型</p>
              <p class="text-xs text-muted-foreground mt-1">1) application/json（推荐）</p>
              <p class="text-xs text-muted-foreground">2) text/event-stream（SSE）</p>
            </div>
            <div class="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p class="text-xs font-semibold">注册必填字段</p>
              <p class="text-xs text-muted-foreground mt-1">name / type / url</p>
              <p class="text-xs text-muted-foreground">可选: headers / healthCheckUrl / tags</p>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold">initialize 返回示例（JSON-RPC）</p>
            <pre class="text-[11px] leading-5 font-mono bg-background border border-border/60 rounded-md p-3 whitespace-pre-wrap break-words overflow-x-hidden">{{ mcpInitializeExample }}</pre>
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold">tools/list 返回示例（JSON-RPC）</p>
            <pre class="text-[11px] leading-5 font-mono bg-background border border-border/60 rounded-md p-3 whitespace-pre-wrap break-words overflow-x-hidden">{{ mcpToolsListExample }}</pre>
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold">SSE 返回示例（text/event-stream）</p>
            <pre class="text-[11px] leading-5 font-mono bg-background border border-border/60 rounded-md p-3 whitespace-pre-wrap break-words overflow-x-hidden">{{ mcpSseExample }}</pre>
          </div>

          <div class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
            <p class="text-xs font-semibold text-emerald-700">最小验收清单</p>
            <p class="text-xs text-emerald-800/90">- 测试连接返回 online / degraded（非 offline）</p>
            <p class="text-xs text-emerald-800/90">- 点击“发现工具”后可展示 tools 列表</p>
            <p class="text-xs text-emerald-800/90">- 每个工具至少包含 name，建议附带 inputSchema</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- ==================== Create Dialog ==================== -->
    <Dialog v-model:open="isCreateDialogOpen">
      <DialogContent class="sm:max-w-[540px] border-border bg-background shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Plus class="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle class="text-xl font-bold tracking-tight">注册 MCP 服务</DialogTitle>
              <DialogDescription class="text-xs text-muted-foreground">配置新的 Model Context Protocol 服务节点</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <!-- Name -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">服务名称 <span class="text-red-500">*</span></Label>
            <Input v-model="newServer.name" placeholder="如: jira, github-mcp" class="bg-muted/30 border-border/50" />
          </div>

          <!-- Type -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">协议类型 <span class="text-red-500">*</span></Label>
            <Select v-model="newServer.type">
              <SelectTrigger class="bg-muted/30 border-border/50">
                <SelectValue placeholder="选择协议类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP — 远程 HTTP 服务</SelectItem>
                <SelectItem value="sse">SSE — Server-Sent Events</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Network Zone -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">网段标记 <span class="text-red-500">*</span></Label>
            <Select v-model="newServer.networkZone">
              <SelectTrigger class="bg-muted/30 border-border/50">
                <SelectValue placeholder="选择 MCP 所在网段" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">内网 — 服务器内网 (10.x)</SelectItem>
                <SelectItem value="office">办公网 — 公司办公网络 (172.18.x)</SelectItem>
                <SelectItem value="external">外网 — 外部互联网</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[10px] text-muted-foreground/60">Gateway 将根据网段自动选择对应的 DNS 解析</p>
          </div>

          <!-- Visibility -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">可见性</Label>
            <div class="rounded-xl border border-border/60 bg-muted/15 p-2.5 space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="h-10 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  :class="getVisibilityOptionClass('private', newServer.visibility)"
                  @click="newServer.visibility = 'private'"
                >
                  <Lock class="h-3.5 w-3.5" />
                  私有
                </button>
                <button
                  type="button"
                  class="h-10 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  :class="getVisibilityOptionClass('public', newServer.visibility)"
                  @click="newServer.visibility = 'public'"
                >
                  <Globe class="h-3.5 w-3.5" />
                  公开
                </button>
              </div>
              <p class="text-[11px] text-muted-foreground">
                当前：<span class="font-semibold">{{ normalizeVisibility(newServer.visibility) === 'public' ? '公开' : '私有' }}</span>
                ，公开后其他用户可发现此 MCP。
              </p>
            </div>
          </div>

          <!-- URL -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">服务 URL <span class="text-red-500">*</span></Label>
            <Input v-model="newServer.url" placeholder="如: https://jira-mcp.company.com/api" class="bg-muted/30 border-border/50 font-mono text-sm" />
          </div>

          <!-- Headers (JSON) -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">请求头 (JSON)</Label>
            <Textarea
              v-model="newServer.headers"
              placeholder='{ "Authorization": "Bearer xxx" }'
              rows="3"
              class="bg-muted/30 border-border/50 font-mono text-xs"
            />
            <p class="text-[10px] text-muted-foreground/60">JSON 格式键值对，可使用 ${'{'}ENV_VAR{'}'} 占位符</p>
          </div>

          <!-- Health Check URL -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">健康检查 URL <span class="text-muted-foreground/50">（可选）</span></Label>
            <Input v-model="newServer.healthCheckUrl" placeholder="如: https://jira-mcp.company.com/health" class="bg-muted/30 border-border/50 font-mono text-sm" />
            <p class="text-[10px] text-muted-foreground/60">留空则使用服务 URL 进行探活</p>
          </div>

          <!-- Description -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">服务描述</Label>
            <Textarea v-model="newServer.description" placeholder="描述该 MCP 服务的用途和能力..." rows="2" class="bg-muted/30 border-border/50" />
          </div>

          <!-- Version -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">版本号 <span class="text-muted-foreground/50">（可选）</span></Label>
            <Input v-model="newServer.version" placeholder="如: 1.0.0" class="bg-muted/30 border-border/50" />
          </div>

          <!-- Tags -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">标签 <span class="text-muted-foreground/50">（可选）</span></Label>
            <Input v-model="newServer.tags" placeholder="逗号分隔，如: project-management, devops" class="bg-muted/30 border-border/50" />
          </div>
        </div>

        <DialogFooter class="border-t border-border/50 pt-4">
          <Button variant="outline" class="font-bold text-xs" @click="isCreateDialogOpen = false">取消</Button>
          <Button class="font-bold text-xs bg-primary shadow-lg shadow-primary/20" @click="createServer">
            <Plus class="h-4 w-4 mr-1" /> 创建服务
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ==================== User Config (Credential) Dialog ==================== -->
    <McpUserConfigDialog
      :open="isCredentialDialogOpen"
      :server="credentialServer"
      @update:open="isCredentialDialogOpen = $event"
      @saved="refreshAll"
    />

    <!-- ==================== Edit Dialog ==================== -->
    <Dialog v-model:open="isEditDialogOpen">
      <DialogContent class="sm:max-w-[540px] border-border bg-background shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div class="flex items-center gap-3 mb-2">
            <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Server class="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle class="text-xl font-bold tracking-tight">编辑 MCP 服务</DialogTitle>
              <DialogDescription class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">ID: {{ editingServer?.id }} • 节点配置</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div v-if="editingServer" class="grid gap-4 py-4">
          <!-- Name -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">服务名称</Label>
            <Input v-model="editingServer.name" class="bg-muted/30 border-border/50" />
          </div>

          <!-- Type -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">协议类型</Label>
            <Select v-model="editingServer.type">
              <SelectTrigger class="bg-muted/30 border-border/50">
                <SelectValue placeholder="选择协议类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP — 远程 HTTP 服务</SelectItem>
                <SelectItem value="sse">SSE — Server-Sent Events</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Network Zone -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">网段标记</Label>
            <Select v-model="editingServer.networkZone">
              <SelectTrigger class="bg-muted/30 border-border/50">
                <SelectValue placeholder="选择 MCP 所在网段" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">内网 — 服务器内网 (10.x)</SelectItem>
                <SelectItem value="office">办公网 — 公司办公网络 (172.18.x)</SelectItem>
                <SelectItem value="external">外网 — 外部互联网</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Visibility -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">可见性</Label>
            <div class="rounded-xl border border-border/60 bg-muted/15 p-2.5 space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="h-10 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  :class="getVisibilityOptionClass('private', editingServer.visibility)"
                  @click="editingServer.visibility = 'private'"
                >
                  <Lock class="h-3.5 w-3.5" />
                  私有
                </button>
                <button
                  type="button"
                  class="h-10 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  :class="getVisibilityOptionClass('public', editingServer.visibility)"
                  @click="editingServer.visibility = 'public'"
                >
                  <Globe class="h-3.5 w-3.5" />
                  公开
                </button>
              </div>
              <p class="text-[11px] text-muted-foreground">
                当前：<span class="font-semibold">{{ normalizeVisibility(editingServer.visibility) === 'public' ? '公开' : '私有' }}</span>
                ，公开后其他用户可发现此 MCP。
              </p>
            </div>
          </div>

          <!-- URL -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">服务 URL</Label>
            <Input v-model="editingServer.url" class="bg-muted/30 border-border/50 font-mono text-sm" />
          </div>

          <!-- Headers (JSON) -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">请求头 (JSON)</Label>
            <Textarea
              v-model="editingServer.headers"
              rows="3"
              class="bg-muted/30 border-border/50 font-mono text-xs"
            />
          </div>

          <!-- Health Check URL -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">健康检查 URL</Label>
            <Input v-model="editingServer.healthCheckUrl" class="bg-muted/30 border-border/50 font-mono text-sm" />
          </div>

          <!-- Description -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">服务描述</Label>
            <Textarea v-model="editingServer.description" rows="2" class="bg-muted/30 border-border/50" />
          </div>

          <!-- Version -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">版本号</Label>
            <Input v-model="editingServer.version" class="bg-muted/30 border-border/50" />
          </div>

          <!-- Tags -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">标签</Label>
            <Input v-model="editingServer.tags" placeholder="逗号分隔" class="bg-muted/30 border-border/50" />
          </div>

          <!-- Current Health (read-only) -->
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">当前健康状态</Label>
            <div class="h-10 flex items-center px-3 bg-muted/20 rounded-md border border-border/50 text-xs font-mono font-bold gap-2">
              <Badge
                variant="outline"
                :class="getStatusConfig(getHealth(editingServer.id)?.status || editingServer.status || 'unknown').classes"
                class="gap-1 rounded-full px-2.5 border"
              >
                <component :is="getStatusConfig(getHealth(editingServer.id)?.status || editingServer.status || 'unknown').icon" class="h-3 w-3" />
                {{ getStatusConfig(getHealth(editingServer.id)?.status || editingServer.status || 'unknown').label }}
              </Badge>
              <span
                v-if="getHealth(editingServer.id)?.latencyMs != null"
                class="text-muted-foreground"
              >
                {{ getHealth(editingServer.id)!.latencyMs }}ms
              </span>
              <span
                v-if="getHealth(editingServer.id)?.healthMessage"
                class="text-muted-foreground/60 truncate"
              >
                — {{ getHealth(editingServer.id)!.healthMessage }}
              </span>
              <Button
                variant="ghost"
                size="sm"
                class="ml-auto h-7 px-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 gap-1"
                :disabled="testingMap[editingServer.id]"
                @click="testConnection(editingServer)"
              >
                <Loader2 v-if="testingMap[editingServer.id]" class="h-3 w-3 animate-spin" />
                <Zap v-else class="h-3 w-3" />
                测试连接
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter class="border-t border-border/50 pt-4">
          <Button variant="outline" class="font-bold text-xs" @click="isEditDialogOpen = false">取消</Button>
          <Button class="font-bold text-xs bg-primary shadow-lg shadow-primary/20" @click="saveEdit">
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
