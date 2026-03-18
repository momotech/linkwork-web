import { ref } from 'vue'
import { createGlobalState } from '@vueuse/core'

// ─── Interfaces ───────────────────────────────────────────────

export interface Skill {
  id: string
  name: string
  displayName: string
  description: string
  status: string
  isPublic?: boolean
  creatorId?: string
  creatorName?: string
  branchName: string
  latestCommit: string
  lastSyncedAt: string
}

export interface SkillFile {
  path: string
  type: string
}

export interface SkillDetail extends Skill {
  files: SkillFile[]
}

export interface FileContent {
  content: string
  commitId: string
  lastModified: string
}

export interface CommitRecord {
  sha: string
  message: string
  authorName: string
  createdAt: string
}

// ─── Composable ───────────────────────────────────────────────

export const useSkills = createGlobalState(() => {
  const skills = ref<Skill[]>([])
  const availableSkills = ref<Skill[]>([])
  const isLoading = ref(false)
  const isSyncing = ref(false)

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

  const normalizeSkill = (skill: any): Skill => ({
    ...skill,
    isPublic: normalizeBoolean(skill?.isPublic),
  })

  const encodeSkillFilePath = (path: string) => {
    return path
      .split('/')
      .filter(segment => segment.length > 0)
      .map(segment => encodeURIComponent(segment))
      .join('/')
  }

  // ── Auth Fetch Helper ─────────────────────────────────────

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }
    const res = await fetch(url, { ...options, headers, credentials: 'include' })

    if (res.status === 401) {
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    // DELETE may return 204 with no body
    if (res.status === 204) return null

    // Handle 409 Conflict before parsing JSON
    if (res.status === 409) {
      throw new Error('CONFLICT')
    }

    const raw = await res.text()
    const tryParseJson = () => {
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }

    const json = tryParseJson()
    if (!json) {
      const isHtml = raw.trimStart().startsWith('<')
      if (isHtml) {
        throw new Error(`接口返回 HTML（HTTP ${res.status}），请检查网关路由或登录态`)
      }
      throw new Error(`接口返回非 JSON 响应（HTTP ${res.status}）`)
    }

    if (json.code !== 0) throw new Error(json.msg || 'API Error')
    return json.data
  }

  // ── API Functions ─────────────────────────────────────────

  /**
   * Fetch skills list for Skill Factory
   * GET /api/v1/skills
   */
  const fetchSkills = async () => {
    isLoading.value = true
    try {
      const data = await authFetch('/api/v1/skills?page=1&pageSize=200')
      const list = Array.isArray(data) ? data : (data?.items || [])
      skills.value = list.map(normalizeSkill)
      return skills.value
    } catch (e) {
      console.error('Failed to fetch skills', e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch available skills list for role configuration
   * GET /api/v1/skills/available
   */
  const fetchAvailableSkills = async () => {
    try {
      const data = await authFetch('/api/v1/skills/available')
      const list = Array.isArray(data) ? data : (data?.items || [])
      availableSkills.value = list.map(normalizeSkill)
      return availableSkills.value
    } catch (e) {
      console.error('Failed to fetch available skills', e)
      throw e
    }
  }

  /**
   * Sync skills from Git
   * POST /api/v1/skills/sync
   */
  const syncSkills = async (): Promise<number> => {
    isSyncing.value = true
    try {
      const data = await authFetch('/api/v1/skills/sync', { method: 'POST' })
      // Refresh the list after sync
      await fetchSkills()
      await fetchAvailableSkills()
      return data?.synced ?? 0
    } catch (e) {
      console.error('Failed to sync skills', e)
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Get skill detail including file tree
   * GET /api/v1/skills/{name}
   */
  const getSkillDetail = async (name: string): Promise<SkillDetail> => {
    return await authFetch(`/api/v1/skills/${encodeURIComponent(name)}`)
  }

  /**
   * Get file content for a skill
   * GET /api/v1/skills/{name}/files/{path}
   * NOTE: path is URL-encoded to handle nested paths like "scripts/analyze.py"
   */
  const getFileContent = async (name: string, path: string): Promise<FileContent> => {
    const encodedPath = encodeSkillFilePath(path)
    return await authFetch(
      `/api/v1/skills/${encodeURIComponent(name)}/files/${encodedPath}`
    )
  }

  /**
   * Save (update) a file in a skill
   * PUT /api/v1/skills/{name}/files/{path}
   * Throws Error('CONFLICT') on 409 status (optimistic locking conflict)
   */
  const saveFile = async (
    name: string,
    path: string,
    content: string,
    commitMessage: string,
    lastCommitId: string,
  ): Promise<{ commitId: string }> => {
    const encodedPath = encodeSkillFilePath(path)
    return await authFetch(
      `/api/v1/skills/${encodeURIComponent(name)}/files/${encodedPath}`,
      {
        method: 'PUT',
        body: JSON.stringify({ content, commitMessage, lastCommitId }),
      },
    )
  }

  /**
   * Create a new skill
   * POST /api/v1/skills
   */
  const createSkill = async (
    name: string,
    description: string,
    isPublic = false,
  ): Promise<{ id: string; name: string; branchName: string }> => {
    return await authFetch('/api/v1/skills', {
      method: 'POST',
      body: JSON.stringify({ name, description, isPublic }),
    })
  }

  /**
   * Update skill metadata
   * PUT /api/v1/skills/{name}
   */
  const updateSkillMeta = async (
    name: string,
    payload: { description?: string; isPublic?: boolean },
  ): Promise<{ name: string }> => {
    return await authFetch(`/api/v1/skills/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  /**
   * Delete a skill
   * DELETE /api/v1/skills/{name}
   */
  const deleteSkill = async (name: string): Promise<void> => {
    await authFetch(`/api/v1/skills/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
    // Remove from local state
    skills.value = skills.value.filter(s => s.name !== name)
  }

  /**
   * Get commit history for a skill
   * GET /api/v1/skills/{name}/history
   */
  const getHistory = async (name: string): Promise<CommitRecord[]> => {
    const data = await authFetch(
      `/api/v1/skills/${encodeURIComponent(name)}/history`,
    )
    return Array.isArray(data) ? data : (data?.commits || [])
  }

  /**
   * Revert a skill to a specific commit
   * POST /api/v1/skills/{name}/revert
   */
  const revertSkill = async (name: string, commitSha: string): Promise<void> => {
    await authFetch(
      `/api/v1/skills/${encodeURIComponent(name)}/revert`,
      {
        method: 'POST',
        body: JSON.stringify({ commitSha }),
      },
    )
  }

  return {
    // Reactive state
    skills,
    isLoading,
    isSyncing,
    // API functions
    fetchSkills,
    syncSkills,
    getSkillDetail,
    getFileContent,
    saveFile,
    createSkill,
    deleteSkill,
    updateSkillMeta,
    getHistory,
    revertSkill,
    availableSkills,
    fetchAvailableSkills,
  }
})
