<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: Record<string, string>
  placeholder?: { key?: string; value?: string }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>]
}>()

interface KVPair {
  key: string
  value: string
}

const pairs = ref<KVPair[]>([])

const syncFromModel = () => {
  const entries = Object.entries(props.modelValue || {})
  pairs.value = entries.length > 0
    ? entries.map(([key, value]) => ({ key, value }))
    : [{ key: '', value: '' }]
}

watch(() => props.modelValue, syncFromModel, { immediate: true, deep: true })

const emitUpdate = () => {
  const result: Record<string, string> = {}
  for (const p of pairs.value) {
    const k = p.key.trim()
    if (k) result[k] = p.value
  }
  emit('update:modelValue', result)
}

const addPair = () => {
  pairs.value.push({ key: '', value: '' })
}

const removePair = (index: number) => {
  pairs.value.splice(index, 1)
  if (pairs.value.length === 0) pairs.value.push({ key: '', value: '' })
  emitUpdate()
}

const keyPlaceholder = computed(() => props.placeholder?.key || 'Key')
const valuePlaceholder = computed(() => props.placeholder?.value || 'Value')
</script>

<template>
  <div class="space-y-2">
    <div v-for="(pair, index) in pairs" :key="index" class="flex items-center gap-2">
      <Input
        v-model="pair.key"
        :placeholder="keyPlaceholder"
        class="flex-1 bg-muted/30 border-border/50 font-mono text-xs h-8"
        @input="emitUpdate"
      />
      <Input
        v-model="pair.value"
        :placeholder="valuePlaceholder"
        class="flex-1 bg-muted/30 border-border/50 font-mono text-xs h-8"
        @input="emitUpdate"
      />
      <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" @click="removePair(index)">
        <Trash2 class="h-3.5 w-3.5" />
      </Button>
    </div>
    <Button variant="outline" size="sm" class="h-7 text-xs gap-1" @click="addPair">
      <Plus class="h-3 w-3" /> 添加
    </Button>
  </div>
</template>
