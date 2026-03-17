import { ref, computed } from 'vue'
import { createGlobalState } from '@vueuse/core'

/**
 * 用户信息（来自 JWT，通过 /api/v1/auth/me 获取）
 */
export interface UserInfo {
  userId: string
  name: string
  email?: string
  workId?: string
  avatarUrl?: string
  permissions?: string[]
}

/**
 * 当前登录用户信息管理
 * 用户信息来自后端 /auth/me 接口（从 JWT payload 解析，不查数据库）
 */
export const useUser = createGlobalState(() => {
  const user = ref<UserInfo | null>(null)
  const isLoading = ref(false)

  /**
   * 获取当前用户信息
   */
  const fetchUser = async (): Promise<UserInfo | null> => {
    isLoading.value = true
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.code === 0 && data.data) {
          user.value = data.data
          return data.data
        }
      }
      user.value = null
      return null
    } catch {
      user.value = null
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 清除用户信息
   */
  const clearUser = () => {
    user.value = null
  }

  const currentUserId = computed(() => user.value?.userId)
  const currentUserName = computed(() => user.value?.name)
  const currentUserAvatar = computed(() => user.value?.avatarUrl)

  return {
    user,
    isLoading,
    currentUserId,
    currentUserName,
    currentUserAvatar,
    fetchUser,
    clearUser
  }
})
