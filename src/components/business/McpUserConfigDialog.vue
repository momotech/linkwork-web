<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Key, Loader2, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import KeyValueEditor from '@/components/business/KeyValueEditor.vue'
import { useMcpUserConfig } from '@/composables/useMcpUserConfig'

const props = defineProps<{
  open: boolean
  server: { id: string; name: string; type?: string } | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const { getConfigDetail, saveConfig, deleteConfig } = useMcpUserConfig()

const headers = ref<Record<string, string>>({})
const urlParams = ref<Record<string, string>>({})
const isLoading = ref(false)
const isSaving = ref(false)

watch(() => [props.open, props.server] as const, async ([open, server]) => {
  if (!open || !server) return
  isLoading.value = true
  try {
    const detail = await getConfigDetail(parseInt(server.id))
    headers.value = detail?.headers || {}
    urlParams.value = detail?.urlParams || {}
  } catch {
    headers.value = {}
    urlParams.value = {}
  } finally {
    isLoading.value = false
  }
}, { immediate: true })

const handleSave = async () => {
  if (!props.server) return
  isSaving.value = true
  try {
    await saveConfig(parseInt(props.server.id), headers.value, urlParams.value)
    toast.success('凭证保存成功')
    emit('update:open', false)
    emit('saved')
  } catch (e: any) {
    toast.error(e.message || '保存失败')
  } finally {
    isSaving.value = false
  }
}

const handleDelete = async () => {
  if (!props.server) return
  if (!confirm('确认删除该 MCP 的个人凭证？')) return
  isSaving.value = true
  try {
    await deleteConfig(parseInt(props.server.id))
    toast.success('凭证已删除')
    emit('update:open', false)
    emit('saved')
  } catch (e: any) {
    toast.error(e.message || '删除失败')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[540px] border-border bg-background shadow-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div class="flex items-center gap-3 mb-2">
          <div class="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Key class="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <DialogTitle class="text-xl font-bold tracking-tight">我的 MCP 凭证</DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground">
              为
              <Badge variant="outline" class="text-[10px] px-1.5 py-0 mx-1">{{ server?.name || '...' }}</Badge>
              配置个人凭证
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <Loader2 class="h-5 w-5 animate-spin text-primary" />
        <span class="ml-2 text-sm text-muted-foreground">加载中...</span>
      </div>

      <div v-else class="grid gap-5 py-4">
        <div class="grid gap-2">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">请求头 (Headers)</Label>
          <p class="text-[11px] text-muted-foreground/60">这些 Header 将在 Gateway 代理时自动附加到对该 MCP 的请求中</p>
          <KeyValueEditor v-model="headers" :placeholder="{ key: 'Header Name', value: 'Header Value' }" />
        </div>

        <div class="grid gap-2">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">URL 参数 (Query Params)</Label>
          <p class="text-[11px] text-muted-foreground/60">这些参数将附加到目标 MCP 的 URL 上</p>
          <KeyValueEditor v-model="urlParams" :placeholder="{ key: 'Param Name', value: 'Param Value' }" />
        </div>
      </div>

      <DialogFooter class="border-t border-border/50 pt-4 flex justify-between">
        <Button variant="ghost" size="sm" class="text-xs text-destructive hover:text-destructive gap-1" @click="handleDelete" :disabled="isSaving">
          <Trash2 class="h-3.5 w-3.5" /> 删除凭证
        </Button>
        <div class="flex gap-2">
          <Button variant="outline" class="font-bold text-xs" @click="emit('update:open', false)">取消</Button>
          <Button class="font-bold text-xs bg-primary shadow-lg shadow-primary/20" @click="handleSave" :disabled="isSaving">
            <Loader2 v-if="isSaving" class="h-4 w-4 mr-1 animate-spin" />
            保存凭证
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
