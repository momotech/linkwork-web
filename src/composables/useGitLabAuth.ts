import { ref } from 'vue'
import { createGlobalState } from '@vueuse/core'

export interface GitLabUser {
  id: string
  gitlabId: number
  username: string
  name: string
  avatarUrl: string
  tokenAlias: string
  expiresAt: string
  scope: string
  status: 'active' | 'expired'
}

export const useGitLabAuth = createGlobalState(() => {
  const users = ref<GitLabUser[]>([])
  const isLoading = ref(false)

  // Helper for authorized fetch (Cookie 自动携带 JWT)
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

  const loadUsers = async () => {
    isLoading.value = true
    try {
      users.value = await authFetch('/api/v1/auth/gitlab/users')
    } catch (e) {
      console.error('Failed to load GitLab users', e)
    } finally {
      isLoading.value = false
    }
  }

  const getAuthUrl = async (scopeType: 'read' | 'write' = 'write') => {
    const data = await authFetch(`/api/v1/auth/gitlab/url?scopeType=${scopeType}`)
    return data.url
  }

  const deleteUser = async (id: string) => {
    isLoading.value = true
    try {
      await authFetch(`/api/v1/auth/gitlab/users/${id}`, { method: 'DELETE' })
      users.value = users.value.filter(u => u.id !== id)
    } catch (e) {
      console.error('Failed to delete user', e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  return {
    users,
    isLoading,
    loadUsers,
    getAuthUrl,
    deleteUser
  }
})
