<script setup lang="ts">
import { ref } from 'vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ChevronsUpDown, Check } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<{
  options: { value: string, label: string }[]
  modelValue: string[]
  placeholder?: string
}>()

const emit = defineEmits(['update:modelValue'])

const open = ref(false)

const handleSelect = (optionValue: string) => {
  const newSelection = [...props.modelValue]
  if (newSelection.includes(optionValue)) {
    newSelection.splice(newSelection.indexOf(optionValue), 1)
  } else {
    newSelection.push(optionValue)
  }
  emit('update:modelValue', newSelection)
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        class="w-full justify-between h-9 bg-background border-border/50 text-xs font-mono"
      >
        <span class="truncate">
          {{ modelValue.length > 0 ? `${modelValue.length} 已选择` : placeholder || '请选择...' }}
        </span>
        <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-full p-0">
      <Command>
        <CommandInput placeholder="搜索..." />
        <CommandEmpty>无结果.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="option in options"
              :key="option.value"
              :value="option.value"
              @select="() => handleSelect(option.value)"
            >
              <Checkbox
                :checked="modelValue.includes(option.value)"
                class="mr-2"
              />
              <span class="font-mono text-xs">{{ option.label }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>