<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  initialEnv: Record<string, string>
}>()

const emit = defineEmits(['update:open', 'save'])

const envList = ref<{ key: string; value: string }[]>([])

watch(() => props.open, (val) => {
  if (val) {
    envList.value = Object.entries(props.initialEnv).map(([key, value]) => ({ key, value }))
    if (envList.value.length === 0) {
      envList.value.push({ key: '', value: '' })
    }
  }
})

const addRow = () => {
  envList.value.push({ key: '', value: '' })
}

const removeRow = (index: number) => {
  envList.value.splice(index, 1)
}

const handleSave = () => {
  const envMap: Record<string, string> = {}
  envList.value.forEach(item => {
    if (item.key.trim()) {
      envMap[item.key.trim()] = item.value.trim()
    }
  })
  emit('save', envMap)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>配置环境变量</DialogTitle>
        <DialogDescription>
          设置容器运行时所需的 key-value 环境变量。
        </DialogDescription>
      </DialogHeader>
      
      <div class="space-y-3 py-4">
        <div v-for="(item, index) in envList" :key="index" class="flex items-center gap-2">
          <Input v-model="item.key" placeholder="KEY (e.g. API_KEY)" class="font-mono text-xs" />
          <span class="text-muted-foreground">=</span>
          <Input v-model="item.value" placeholder="VALUE" class="font-mono text-xs" />
          <Button variant="ghost" size="icon" class="text-muted-foreground hover:text-destructive shrink-0" @click="removeRow(index)">
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" class="w-full border-dashed" @click="addRow">
          <Plus class="h-3.5 w-3.5 mr-2" /> 添加变量
        </Button>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">取消</Button>
        <Button @click="handleSave">保存配置</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>