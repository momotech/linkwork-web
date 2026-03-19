import { ref, computed } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { redirectToLogin } from '@/utils/http'

export const useAuth = createGlobalState(() => {
  const isChecked = ref(false)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * 检查登录状态（调用 /api/v1/auth/me）
   */
  const checkAuth = async (): Promise<boolean> => {
    if (isChecked.value) {
      return isAuthenticated.value
    }

    isLoading.value = true
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        isAuthenticated.value = data.code === 0
      } else {
        isAuthenticated.value = false
      }
    } catch {
      isAuthenticated.value = false
    } finally {
      isLoading.value = false
      isChecked.value = true
    }

    return isAuthenticated.value
  }

  /**
   * 密码登录
   */
  const login = async (password: string, userId?: string, userName?: string): Promise<{ success: boolean; message?: string }> => {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, userId, userName }),
      })
      const data = await res.json()
      if (data.code === 0) {
        isAuthenticated.value = true
        isChecked.value = true
        return { success: true }
      }
      error.value = data.msg || '密码错误'
      return { success: false, message: data.msg || '密码错误' }
    } catch (e: any) {
      error.value = '网络错误，请重试'
      return { success: false, message: '网络错误，请重试' }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 登出
   */
  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch {
      // ignore
    }
    isAuthenticated.value = false
    isChecked.value = false
    redirectToLogin()
  }

  const resetCheck = () => {
    isChecked.value = false
    isAuthenticated.value = false
  }

  return {
    isAuthenticated: computed(() => isAuthenticated.value),
    isLoading,
    error,
    checkAuth,
    login,
    logout,
    resetCheck
  }
})
