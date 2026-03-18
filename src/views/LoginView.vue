<script setup lang="ts">
import { onMounted } from 'vue'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Bot } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { SSO_LOGIN_URL } from '@/utils/http'

const { login } = useAuth()

// 页面加载后自动跳转统一 SSO
onMounted(() => {
  const target = new URL(SSO_LOGIN_URL, window.location.origin)
  const samePath = target.origin === window.location.origin && target.pathname === window.location.pathname
  if (samePath) {
    return
  }

  // 短暂延迟让用户看到提示
  setTimeout(() => {
    login()
  }, 500)
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
    </div>

    <Card class="w-full max-w-md mx-4 relative bg-zinc-900/80 backdrop-blur-xl border-zinc-700/50">
      <CardHeader class="text-center space-y-4">
        <div class="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
          <Bot class="w-8 h-8 text-white" />
        </div>
        <div>
          <CardTitle class="text-2xl font-bold text-zinc-100">LinkWork</CardTitle>
          <CardDescription class="text-zinc-400 mt-2">正在跳转至统一登录页...</CardDescription>
        </div>
      </CardHeader>

      <CardContent class="flex flex-col items-center gap-4 pb-8">
        <Loader2 class="w-8 h-8 text-blue-500 animate-spin" />
        <p class="text-sm text-zinc-500">
          即将跳转至 SSO 单点登录
        </p>
      </CardContent>
    </Card>
  </div>
</template>
