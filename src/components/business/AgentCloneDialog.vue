<script setup lang="ts">
import { ref, watch, type PropType } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CopyPlus, Sparkles } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  agent: {
    name: string
    description: string
    prompt: string
  } | null
}>()

const emit = defineEmits(['update:open', 'clone'])

const name = ref('')
const description = ref('')

watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    name.value = `${newAgent.name} (副本)`
    description.value = newAgent.description
  }
})

const handleClone = () => {
  emit('clone', { 
    name: name.value, 
    description: description.value,
    prompt: props.agent?.prompt
  })
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <CopyPlus class="h-5 w-5 text-primary" /> 克隆 Agent 模板
        </DialogTitle>
        <DialogDescription>
          基于 “{{ agent?.name }}” 创建一个新的 Agent，你可以自定义其名称和描述。
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="clone-name">新 Agent 名称</Label>
          <Input id="clone-name" v-model="name" />
        </div>
        <div class="space-y-2">
          <Label for="clone-desc">Agent 描述</Label>
          <Textarea id="clone-desc" v-model="description" class="min-h-[80px]" />
        </div>
         <div class="space-y-2">
          <Label class="flex items-center gap-2 text-muted-foreground"><Sparkles class="h-4 w-4" /> 预设 Prompt (不可修改)</Label>
          <p class="text-xs font-mono p-3 bg-muted/50 rounded-md border text-muted-foreground h-20 overflow-y-auto">
            {{ agent?.prompt }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">取消</Button>
        <Button @click="handleClone">创建并使用</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>