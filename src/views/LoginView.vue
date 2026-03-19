<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bot, Loader2, Eye, EyeOff } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { login, isLoading } = useAuth()

const password = ref('')
const userId = ref('')
const userName = ref('')
const showPassword = ref(false)
const errorMsg = ref('')
const showAdvanced = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  if (!password.value) {
    errorMsg.value = '请输入密码'
    return
  }

  const result = await login(
    password.value,
    userId.value || undefined,
    userName.value || undefined
  )

  if (result.success) {
    router.replace({ name: 'home' })
  } else {
    errorMsg.value = result.message || '登录失败'
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
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
          <CardDescription class="text-zinc-400 mt-2">AI 员工管理平台</CardDescription>
        </div>
      </CardHeader>

      <CardContent class="space-y-4 pb-8">
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div class="space-y-2">
            <Label for="password" class="text-zinc-300">密码</Label>
            <div class="relative">
              <Input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入访问密码"
                class="bg-zinc-800/50 border-zinc-600 text-zinc-100 placeholder:text-zinc-500 pr-10"
                autofocus
                @keyup.enter="handleLogin"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            class="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? '收起' : '自定义身份（可选）' }}
          </button>

          <template v-if="showAdvanced">
            <div class="space-y-2">
              <Label for="userId" class="text-zinc-300">用户 ID</Label>
              <Input
                id="userId"
                v-model="userId"
                placeholder="留空使用默认"
                class="bg-zinc-800/50 border-zinc-600 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
            <div class="space-y-2">
              <Label for="userName" class="text-zinc-300">用户名</Label>
              <Input
                id="userName"
                v-model="userName"
                placeholder="留空使用默认"
                class="bg-zinc-800/50 border-zinc-600 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </template>

          <div v-if="errorMsg" class="text-sm text-red-400 text-center py-1">
            {{ errorMsg }}
          </div>

          <Button
            type="submit"
            :disabled="isLoading"
            class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
            {{ isLoading ? '登录中...' : '登录' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
