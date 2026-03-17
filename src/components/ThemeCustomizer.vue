<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useColorMode } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Paintbrush, Check, Moon, Sun, Monitor, Palette } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const { theme, themes, setTheme } = useTheme()
const mode = useColorMode({ emitAuto: true })

// 当前主题信息
const currentTheme = computed(() => themes.find(t => t.name === theme.value) || themes[0])

// 模式显示文本
const modeLabel = computed(() => {
  switch (mode.value) {
    case 'light': return '浅色'
    case 'dark': return '深色'
    default: return '跟随系统'
  }
})
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="ghost" size="sm" class="h-9 gap-2 px-3">
        <div 
          class="h-4 w-4 rounded-full border-2 border-background shadow-sm" 
          :class="currentTheme.color"
        />
        <span class="text-xs font-medium hidden sm:inline">{{ currentTheme.label }}</span>
        <Palette class="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-72" align="end">
      <div class="space-y-4">
        <!-- Header with current theme preview -->
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-semibold">主题设置</h4>
            <p class="text-[11px] text-muted-foreground mt-0.5">当前: {{ currentTheme.label }} · {{ modeLabel }}</p>
          </div>
          <div 
            class="h-8 w-8 rounded-lg shadow-inner flex items-center justify-center"
            :class="currentTheme.color"
          >
            <Paintbrush class="h-4 w-4 text-white" />
          </div>
        </div>
        
        <!-- Color Picker Grid -->
        <div class="space-y-2">
          <Label class="text-[11px] text-muted-foreground">主色调</Label>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="t in themes"
              :key="t.name"
              class="group relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all hover:bg-accent/50"
              :class="theme === t.name ? 'border-primary bg-accent/30' : 'border-transparent hover:border-border'"
              @click="setTheme(t.name)"
            >
              <div 
                class="h-7 w-7 rounded-full shadow-sm flex items-center justify-center transition-transform group-hover:scale-110"
                :class="t.color"
              >
                <Check v-if="theme === t.name" class="h-3.5 w-3.5 text-white" />
              </div>
              <span class="text-[9px] font-medium text-center leading-tight" :class="theme === t.name ? 'text-foreground' : 'text-muted-foreground'">
                {{ t.label }}
              </span>
            </button>
          </div>
        </div>

        <!-- Mode Picker -->
        <div class="space-y-2">
          <Label class="text-[11px] text-muted-foreground">显示模式</Label>
          <div class="grid grid-cols-3 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              class="h-9 text-xs font-medium"
              :class="mode === 'light' ? 'border-primary bg-primary/10 text-primary' : ''"
              @click="mode = 'light'"
            >
              <Sun class="mr-1.5 h-3.5 w-3.5" />
              浅色
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-9 text-xs font-medium"
              :class="mode === 'dark' ? 'border-primary bg-primary/10 text-primary' : ''"
              @click="mode = 'dark'"
            >
              <Moon class="mr-1.5 h-3.5 w-3.5" />
              深色
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-9 text-xs font-medium"
              :class="mode === 'auto' ? 'border-primary bg-primary/10 text-primary' : ''"
              @click="mode = 'auto'"
            >
              <Monitor class="mr-1.5 h-3.5 w-3.5" />
              系统
            </Button>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>