<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useShiki } from '@/composables/useShiki'

interface Props {
  code: string
  lang?: string
  showLineNumbers?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  lang: 'text',
  showLineNumbers: true
})

const { highlight, isLoading, initHighlighter } = useShiki()
const highlightedHtml = ref('')
const copied = ref(false)

// 复制代码
const copyCode = () => {
  navigator.clipboard.writeText(props.code)
  copied.value = true
  toast.success('代码已复制')
  setTimeout(() => copied.value = false, 2000)
}

// 更新高亮
const updateHighlight = () => {
  highlightedHtml.value = highlight(props.code, props.lang || 'text')
}

// 监听代码和语言变化
watch([() => props.code, () => props.lang, isLoading], () => {
  updateHighlight()
}, { immediate: true })

// 确保高亮器已初始化
onMounted(async () => {
  await initHighlighter()
  updateHighlight()
})

// 计算行数
const lineCount = computed(() => props.code.split('\n').length)
</script>

<template>
  <div :class="cn('relative group rounded-lg border border-border/50 bg-background overflow-hidden shadow-sm', props.class)">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/50">
      <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{{ props.lang }}</span>
      <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-all" @click="copyCode">
        <Check v-if="copied" class="h-3 w-3 text-emerald-500" />
        <Copy v-else class="h-3 w-3" />
      </Button>
    </div>

    <!-- Code Content with Shiki -->
    <div class="overflow-auto max-h-[500px]">
      <div 
        class="shiki-container text-[13px] leading-relaxed"
        v-html="highlightedHtml"
      />
    </div>

    <!-- Footer -->
    <div class="px-3 py-1 bg-muted/20 border-t border-border/30 flex justify-between items-center">
      <span class="text-[9px] font-mono text-muted-foreground/50">{{ lineCount }} lines</span>
    </div>
  </div>
</template>

<style>
/* Shiki 双主题支持 */
.shiki-container .shiki {
  margin: 0;
  padding: 1rem;
  background: transparent !important;
  overflow-x: auto;
}

.shiki-container .shiki code {
  display: block;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.6;
}

/* 双主题：亮色模式显示 light 样式 */
html:not(.dark) .shiki-container .shiki,
html:not(.dark) .shiki-container .shiki span {
  color: var(--shiki-light) !important;
  background-color: transparent !important;
}

/* 双主题：暗色模式显示 dark 样式 */
html.dark .shiki-container .shiki,
html.dark .shiki-container .shiki span {
  color: var(--shiki-dark) !important;
  background-color: transparent !important;
}

/* 行号（如果需要，可以通过 Shiki transformer 添加） */
.shiki-container .line {
  display: inline-block;
  width: 100%;
}

.shiki-container .line:hover {
  background-color: hsl(var(--muted) / 0.3);
}
</style>
