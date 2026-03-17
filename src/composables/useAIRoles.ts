import { ref } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { useUser } from '@/composables/useUser'
import { type RuntimeMode, type ZzMode, parseRuntimeMode, validateRuntimeProfile } from '@/types/runtime-mode'

export type DeployMode = 'K8S' | 'COMPOSE'

export interface Role {
  id: string
  name: string
  description: string
  category: string
  icon: string
  image: string
  prompt?: string
  status: string
  deployMode?: DeployMode
  runtimeMode?: RuntimeMode
  zzMode?: ZzMode
  runnerImage?: string | null
  runtimeError?: string
  isPublic?: boolean
  maxEmployees?: number
  isMine: boolean
  isFavorite: boolean
  mcpModules?: any[]
  skills?: any[]
  gitRepos?: any[]
  envVars?: any[]
  resourceCount?: {
    mcp: number
    skills: number
  }
}

export const AVAILABLE_IMAGES = [
  { id: 'ubuntu:22.04', name: 'ubuntu:22.04', description: 'Standard Ubuntu 22.04 Base' },
  { id: 'ubuntu-22.04-ops-pro', name: 'Ubuntu 22.04 Ops Pro', description: 'Optimized for DevOps' },
  { id: 'ubuntu-22.04-python3.10', name: 'Ubuntu 22.04 Python 3.10', description: 'Python Dev Environment' },
]

// MCP 服务列表已迁移到 useMcpServers.ts，从真实 API 加载

export const AVAILABLE_SKILLS = [
  { id: 'log-analyzer', name: 'LogAnalyzer', description: '日志分析', version: 'v1.2' },
  { id: 'kube-optim', name: 'KubeOptim', description: 'K8s 优化', version: 'v0.8' },
  { id: 'sql-optimizer', name: 'SqlOptimizer', description: 'SQL 优化', version: 'v1.0' },
  { id: 'code-audit', name: 'CodeAudit', description: '代码审计', version: 'v2.0' },
  { id: 'vuln-scanner', name: 'VulnerabilityScanner', description: '漏洞扫描', version: 'v1.5' },
  { id: 'arch-design', name: 'ArchDesign', description: '架构设计', version: 'v1.0' },
]

export const useAIRoles = createGlobalState(() => {
  const roles = ref<Role[]>([])
  const isLoading = ref(false)
  const { currentUserId } = useUser()

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

  const normalizeRoleStatus = (value: unknown): string => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['active', 'maintenance', 'disabled'].includes(normalized)) return normalized
    }
    return 'active'
  }

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

  const DEFAULT_IMAGE = 'ubuntu:22.04'

  const normalizeDeployMode = (rawDeployMode: unknown): DeployMode => {
    if (typeof rawDeployMode === 'string' && rawDeployMode.trim().toUpperCase() === 'COMPOSE') {
      return 'COMPOSE'
    }
    return 'K8S'
  }

  const resolveRoleRuntimeConfig = (roleData: any) => {
    const deployMode = normalizeDeployMode(roleData?.deployMode)
    const runtimeMode = deployMode === 'COMPOSE'
      ? 'ALONE'
      : (parseRuntimeMode(roleData?.runtimeMode) || 'ALONE')

    const runnerFromInput = typeof roleData?.runnerImage === 'string' ? roleData.runnerImage.trim() : ''
    const imageFallback = typeof roleData?.image === 'string' ? roleData.image.trim() : ''

    return {
      deployMode,
      runtimeMode,
      runnerImage: runtimeMode === 'SIDECAR'
        ? (runnerFromInput || imageFallback || DEFAULT_IMAGE)
        : null
    }
  }

  const attachRuntimeProfile = (source: any, context: string) => {
    try {
      const runtime = validateRuntimeProfile({
        runtimeMode: source.runtimeMode,
        zzMode: source.zzMode,
        runnerImage: source.runnerImage
      }, context)
      return {
        ...source,
        runtimeMode: runtime.runtimeMode,
        zzMode: runtime.zzMode,
        runnerImage: runtime.runnerImage,
        runtimeError: undefined
      }
    } catch (error: any) {
      return {
        ...source,
        runtimeError: error?.message || `${context} runtime profile invalid`
      }
    }
  }

  const loadRoles = async (params: any = {}) => {
    isLoading.value = true
    try {
      const query = new URLSearchParams(params).toString()
      const data = await authFetch(`/api/v1/roles?${query}`)
      roles.value = (data.items || []).map((item: any) => {
        const normalizedRole = {
          ...item,
          status: normalizeRoleStatus(item?.status),
          isPublic: normalizeBoolean(item?.isPublic),
        }
        return attachRuntimeProfile(normalizedRole, `Role#${item?.id || "unknown"}`)
      })
      return data
    } catch (e) {
      console.error('Failed to load roles', e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const getRole = async (id: string) => {
    const data = await authFetch(`/api/v1/roles/${id}`)
    const normalizedRole = {
      ...data,
      status: normalizeRoleStatus(data?.status),
      isPublic: normalizeBoolean(data?.isPublic),
    }
    return attachRuntimeProfile(normalizedRole, `Role#${id}`)
  }

  const createRole = async (roleData: any) => {
    const runtime = resolveRoleRuntimeConfig(roleData)
    const normalizedPrompt = typeof roleData.prompt === 'string' ? roleData.prompt.trim() : ''
    if (!normalizedPrompt) {
      throw new Error('岗位自定义 Prompt 不能为空')
    }

    // 转换前端数据结构到后端 Entity 结构
    const payload = {
      name: roleData.name,
      description: roleData.description,
      category: roleData.category,
      icon: roleData.icon,
      image: roleData.image || DEFAULT_IMAGE,
      prompt: normalizedPrompt,
      isPublic: normalizeBoolean(roleData.isPublic),
      maxEmployees: Number.isFinite(Number(roleData.maxEmployees)) && Number(roleData.maxEmployees) > 0
        ? Number(roleData.maxEmployees)
        : 1,
      configJson: {
        deployMode: runtime.deployMode,
        runtimeMode: runtime.runtimeMode,
        runnerImage: runtime.runnerImage,
        mcp: roleData.mcpModules?.map((m: any) => m.id),
        skills: roleData.skills?.map((s: any) => s.id),
        gitRepos: roleData.gitRepos,
        env: roleData.envVars
      }
    }
    return await authFetch('/api/v1/roles', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  const updateRole = async (id: string, roleData: any) => {
    const runtime = resolveRoleRuntimeConfig(roleData)
    const normalizedPrompt = typeof roleData.prompt === 'string' ? roleData.prompt.trim() : ''
    if (!normalizedPrompt) {
      throw new Error('岗位自定义 Prompt 不能为空')
    }

    const payload = {
      name: roleData.name,
      description: roleData.description,
      category: roleData.category,
      icon: roleData.icon,
      image: roleData.image || DEFAULT_IMAGE,
      prompt: normalizedPrompt,
      isPublic: normalizeBoolean(roleData.isPublic),
      maxEmployees: Number.isFinite(Number(roleData.maxEmployees)) && Number(roleData.maxEmployees) > 0
        ? Number(roleData.maxEmployees)
        : 1,
      configJson: {
        deployMode: runtime.deployMode,
        runtimeMode: runtime.runtimeMode,
        runnerImage: runtime.runnerImage,
        mcp: roleData.mcpModules?.map((m: any) => m.id),
        skills: roleData.skills?.map((s: any) => s.id),
        gitRepos: roleData.gitRepos,
        env: roleData.envVars
      }
    }
    const result = await authFetch(`/api/v1/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })

    const target = roles.value.find(r => r.id === id)
    if (target) {
      target.name = payload.name
      target.description = payload.description
      target.category = payload.category
      target.icon = payload.icon
      target.image = payload.image
      target.status = normalizeRoleStatus(roleData.status ?? target.status)
      target.isPublic = payload.isPublic
      target.maxEmployees = payload.maxEmployees
      target.deployMode = payload.configJson.deployMode
      target.runtimeMode = payload.configJson.runtimeMode
      target.runnerImage = payload.configJson.runnerImage
    }
    return result
  }

  const deleteRole = async (id: string) => {
    await authFetch(`/api/v1/roles/${id}`, { method: 'DELETE' })
    roles.value = roles.value.filter(r => r.id !== id)
  }

  const toggleFavorite = async (id: string, favorite: boolean) => {
    await authFetch(`/api/v1/roles/${id}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ favorite })
    })
    const role = roles.value.find(r => r.id === id)
    if (role) role.isFavorite = favorite
  }

  // 当前构建 ID（用于日志查看）
  const currentBuildId = ref<string | null>(null)

  /**
   * 生成 UUID
   */
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  const buildRole = async (roleData: any) => {
    const userId = currentUserId.value || 'user-unknown'

    const runtime = validateRuntimeProfile({
      runtimeMode: roleData.runtimeMode,
      zzMode: roleData.zzMode,
      runnerImage: roleData.runnerImage
    }, `Role#${roleData.id || 'unknown'}`)

    // 生成 buildId
    const buildId = generateUUID()
    currentBuildId.value = buildId

    const buildEnvVars = createBuildEnvVars(roleData)

    const payload = {
      serviceId: roleData.id,
      userId: userId,
      deployMode: 'K8S',
      podMode: runtime.runtimeMode,
      buildEnvVars: buildEnvVars,
      runnerBaseImage: runtime.runtimeMode === 'SIDECAR' ? runtime.runnerImage : undefined,
      description: roleData.description,
      podCount: roleData.maxEmployees || 1,
      // 构建追踪字段
      buildId: buildId,
      roleId: parseInt(roleData.id) || null,
      roleName: roleData.name
    }

    return await authFetch('/api/v1/schedule/build', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  const createBuildEnvVars = (roleData: any) => {
    const buildEnvVars: Record<string, any> = {
      LINKWORK_ROLE_ID: roleData.id || '',
      LINKWORK_ROLE_NAME: roleData.name || '',
    }

    if (roleData.mcpModules) buildEnvVars['MCP_CONFIG'] = roleData.mcpModules
    if (roleData.skills) buildEnvVars['SKILLS_CONFIG'] = roleData.skills
    if (roleData.gitRepos) buildEnvVars['GIT_REPOS'] = roleData.gitRepos

    if (roleData.envVars) {
      roleData.envVars.forEach((v: {key: string, value: string}) => {
        if (v.key) buildEnvVars[v.key] = String(v.value)
      })
    }

    return buildEnvVars
  }

  const generateCompose = async (roleData: any) => {
    const userId = currentUserId.value || 'user-unknown'
    const buildId = generateUUID()

    const payload = {
      serviceId: roleData.id,
      userId,
      deployMode: 'COMPOSE',
      buildEnvVars: createBuildEnvVars(roleData),
      description: roleData.description,
      buildId,
      roleId: parseInt(roleData.id) || null,
      roleName: roleData.name
    }

    const res = await fetch('/api/v1/schedule/compose/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    })

    if (res.status === 401) {
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    if (!res.ok) {
      try {
        const body = await res.json()
        throw new Error(body?.msg || '生成 Compose 失败')
      } catch {
        throw new Error('生成 Compose 失败')
      }
    }

    const blob = await res.blob()
    const contentDisposition = res.headers.get('content-disposition') || ''
    const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/)

    return {
      blob,
      fileName: fileNameMatch?.[1] || `docker-compose-${roleData.id || 'role'}.yaml`,
      builtImage: res.headers.get('X-Built-Image') || '',
      buildDurationMs: Number(res.headers.get('X-Build-Duration-Ms') || 0)
    }
  }

  /**
   * 获取岗位构建历史
   */
  const getBuildRecords = async (roleId: string, page: number = 1, pageSize: number = 20) => {
    return await authFetch(`/api/v1/build-records?roleId=${roleId}&page=${page}&pageSize=${pageSize}`)
  }

  /**
   * 获取单条构建记录
   */
  const getBuildRecord = async (buildNo: string) => {
    return await authFetch(`/api/v1/build-records/${buildNo}`)
  }

  /**
   * 获取岗位最新构建记录
   */
  const getLatestBuildRecord = async (roleId: string) => {
    return await authFetch(`/api/v1/build-records/role/${roleId}/latest`)
  }

  return {
    roles,
    isLoading,
    currentBuildId,
    loadRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole,
    toggleFavorite,
    buildRole,
    generateCompose,
    getBuildRecords,
    getBuildRecord,
    getLatestBuildRecord
  }
})
