<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Loader2, Trash2, Plus, AlertCircle, CalendarClock, GitBranch } from 'lucide-vue-next'
import { useGitLabAuth } from '@/composables/useGitLabAuth'
import { toast } from 'vue-sonner'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits(['update:open'])

const { users, isLoading, loadUsers, getAuthUrl, deleteUser } = useGitLabAuth()

const handleMessage = async (event: MessageEvent) => {
  if (event.origin === window.location.origin && event.data?.type === 'gitlab-auth-success') {
    toast.success('GitLab account connected successfully')
    await loadUsers()
    window.dispatchEvent(new CustomEvent('gitlab-auth-authorized'))
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadUsers()
  }
})

onMounted(() => {
  window.addEventListener('message', handleMessage)
  if (props.open) {
    loadUsers()
  }
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
})

const handleConnect = async (scopeType: 'read' | 'write') => {
  try {
    const url = await getAuthUrl(scopeType)
    // Open in popup to preserve state
    const width = 600
    const height = 700
    const left = (window.screen.width - width) / 2
    const top = (window.screen.height - height) / 2
    window.open(url, 'GitLabAuth', `width=${width},height=${height},left=${left},top=${top}`)
    toast.info('Please authorize in the popup window...')
  } catch (e) {
    toast.error('Failed to get auth URL')
  }
}

const handleDelete = async (id: string) => {
  await deleteUser(id)
  await loadUsers()
  toast.success('GitLab account disconnected')
}

// Helper to get scope display label
const getScopeLabel = (scope: string | null | undefined) => {
  if (scope && scope.includes('api')) {
    return { text: '读写', variant: 'default' as const }
  }
  if (scope && scope.includes('read_repository')) {
    return { text: '只读', variant: 'secondary' as const }
  }
  return { text: '读写', variant: 'default' as const }
}

// Helper to present token lifecycle in a user-facing way
const formatExpiry = (dateStr: string, status?: string) => {
  const date = new Date(dateStr)
  const diffMs = date.getTime() - Date.now()
  const isExpired = status === 'expired' || diffMs <= 0

  if (isExpired) {
    return {
      text: '已过期',
      variant: 'secondary' as const,
      isExpired: true
    }
  }

  // Active GitLab OAuth bindings are auto-refreshed by backend, so we show long-term status.
  return {
    text: '长期',
    variant: 'default' as const,
    isExpired: false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[700px] gap-0 p-0 overflow-hidden bg-background border-border">
      <DialogHeader class="p-6 pb-4 border-b border-border/50">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
            <GitBranch class="h-5 w-5 text-orange-600" />
          </div>
          <div class="space-y-1">
            <DialogTitle class="text-lg font-semibold tracking-tight">GitLab 授权</DialogTitle>
          </div>
        </div>
      </DialogHeader>

      <div class="p-6 space-y-4">
        <!-- Loading State -->
        <div v-if="isLoading && users.length === 0" class="flex justify-center py-8">
          <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <!-- Empty State -->
        <div v-else-if="users.length === 0" class="flex flex-col items-center justify-center py-8 text-center space-y-3">
          <div class="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <GitBranch class="h-6 w-6 text-muted-foreground opacity-50" />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-medium">暂无已连接账号</p>
            <p class="text-xs text-muted-foreground max-w-[200px]">连接 GitLab 账号以访问代码仓库。</p>
          </div>
        </div>

        <!-- User List -->
        <div v-else class="space-y-3">
          <div
            v-for="user in users"
            :key="user.id"
            class="group relative flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-all duration-200"
          >
            <!-- 1. Avatar -->
            <Avatar class="h-10 w-10 border border-border/50 shadow-sm shrink-0">
              <AvatarImage :src="user.avatarUrl" />
              <AvatarFallback class="bg-primary/5 text-primary text-xs font-bold">{{ user.username.substring(0, 2).toUpperCase() }}</AvatarFallback>
            </Avatar>

            <!-- 2. Main Info -->
            <div class="flex flex-col min-w-0 flex-1 gap-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-foreground truncate">{{ user.name }}</span>
                <Badge
                  :variant="getScopeLabel(user.scope).variant"
                  class="text-[10px] px-1.5 py-0 h-4 font-medium"
                >
                  {{ getScopeLabel(user.scope).text }}
                </Badge>
                <span v-if="user.status === 'active'" class="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                  <div class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                  Active
                </span>
              </div>

              <div class="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span class="font-medium text-foreground/80">@{{ user.username }}</span>
                <span class="text-border/60 hidden sm:inline">•</span>
                <span class="font-mono text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground/80 border border-border/30">
                  {{ user.tokenAlias }}
                </span>
              </div>
            </div>

            <!-- 3. Status & Actions -->
            <div class="flex items-center gap-3 shrink-0">
              <!-- Expiry Badge -->
              <div class="flex flex-col items-end" v-if="user.expiresAt">
                <div
                  class="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border"
                  :class="formatExpiry(user.expiresAt, user.status).isExpired
                    ? 'bg-red-500/10 text-red-600 border-red-500/20'
                    : formatExpiry(user.expiresAt, user.status).variant === 'default'
                      ? 'bg-muted/50 text-muted-foreground border-transparent'
                      : 'bg-orange-500/10 text-orange-600 border-orange-500/20'"
                >
                  <CalendarClock class="h-3 w-3" />
                  {{ formatExpiry(user.expiresAt, user.status).text }}
                </div>
              </div>

              <!-- Delete Action -->
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-100/50 rounded-lg transition-colors"
                @click="handleDelete(user.id)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3">
        <Button variant="outline" @click="handleConnect('read')" class="gap-2">
          <GitBranch class="h-4 w-4" />
          只读权限 (Read-Only)
        </Button>
        <Button @click="handleConnect('write')" class="gap-2 bg-[#FC6D26] hover:bg-[#E24329] text-white border-none shadow-sm">
          <GitBranch class="h-4 w-4" />
          读写权限 (Full Access)
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
