import { ref, computed } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { redirectToSSO } from '@/utils/http'

/**
 * 认证状态管理（通用 SSO 模式）
 *
 * - Token 由后端通过 HttpOnly Cookie 管理，前端不直接操作 Token
 * - 登录状态通过调用 /api/v1/auth/me 判断
 * - 登录跳转到统一 SSO 登录页
 * - 登出调用后端接口获取登出 URL 并跳转
 */
export const useAuth = createGlobalState(() => {
  // 是否已验证过认证状态（避免重复调用 /auth/me）
  const isChecked = ref(false)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * 检查登录状态（调用 /api/v1/auth/me）
   * 成功 = 已登录（Cookie 中的 JWT 有效），失败 = 未登录
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
   * 跳转到统一 SSO 登录页
   */
  const login = () => {
    redirectToSSO()
  }

  /**
   * 登出：调用后端接口清除 Cookie，然后跳转后端返回的登出 URL
   */
  const logout = async () => {
    try {
      const res = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await res.json()
      
      // 清除本地状态
      isAuthenticated.value = false
      isChecked.value = false
      
      // 跳转后端提供的 SSO 登出页面
      if (data.data?.logoutUrl) {
        window.location.href = data.data.logoutUrl
      } else {
        redirectToSSO()
      }
    } catch {
      // 降级：直接跳 SSO 登录页
      isAuthenticated.value = false
      isChecked.value = false
      redirectToSSO()
    }
  }

  /**
   * 重置检查状态（强制下次重新验证）
   */
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
