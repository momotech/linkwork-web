<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2, CheckCircle2, XCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const status = ref<'processing' | 'success' | 'error'>('processing')
const errorMessage = ref('')

onMounted(async () => {
  const code = route.query.code as string
  const state = route.query.state as string

  if (!code) {
    status.value = 'error'
    errorMessage.value = 'Missing authorization code'
    return
  }

  // state 中携带了 scopeType（read / write）
  const scopeType = (state === 'read' || state === 'write') ? state : 'write'

  try {
    // Exchange code for token
    const redirectUri = window.location.origin + route.path

    // Call API（Cookie 自动携带 JWT）
    const res = await fetch('/api/v1/auth/gitlab/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, redirectUri, scopeType })
    })

    const json = await res.json()
    if (json.code !== 0) throw new Error(json.msg || 'Authorization failed')

    status.value = 'success'

    // Notify opener if exists
    if (window.opener) {
        window.opener.postMessage({ type: 'gitlab-auth-success' }, window.location.origin)
    }

    // Auto close or redirect after delay
    setTimeout(() => {
        // If opened in popup, close it
        if (window.opener) {
            window.close()
        } else {
            router.push('/')
        }
    }, 2000)

  } catch (e: any) {
    status.value = 'error'
    errorMessage.value = e.message || 'Authorization failed'
  }
})
</script>

<template>
  <div class="h-screen w-full flex flex-col items-center justify-center bg-background p-4">
    <div class="max-w-md w-full p-8 rounded-xl border border-border bg-card shadow-lg flex flex-col items-center text-center space-y-4">

      <!-- Processing -->
      <div v-if="status === 'processing'" class="flex flex-col items-center space-y-4">
        <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 class="h-6 w-6 text-primary animate-spin" />
        </div>
        <div class="space-y-1">
            <h3 class="font-semibold text-lg">Connecting to GitLab...</h3>
            <p class="text-sm text-muted-foreground">Exchanging authorization code for secure token.</p>
        </div>
      </div>

      <!-- Success -->
      <div v-if="status === 'success'" class="flex flex-col items-center space-y-4">
        <div class="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 class="h-6 w-6 text-emerald-600" />
        </div>
        <div class="space-y-1">
            <h3 class="font-semibold text-lg">Connected Successfully</h3>
            <p class="text-sm text-muted-foreground">Your GitLab account has been linked.</p>
        </div>
      </div>

      <!-- Error -->
      <div v-if="status === 'error'" class="flex flex-col items-center space-y-4">
        <div class="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
            <XCircle class="h-6 w-6 text-red-600" />
        </div>
        <div class="space-y-1">
            <h3 class="font-semibold text-lg">Connection Failed</h3>
            <p class="text-sm text-muted-foreground">{{ errorMessage }}</p>
        </div>
        <Button variant="outline" @click="router.push('/')">Return to Dashboard</Button>
      </div>

    </div>
  </div>
</template>
