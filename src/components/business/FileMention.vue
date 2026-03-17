<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-vue-next'
import { fileManagerApi, type FileMentionItem } from '@/api/fileManager'

const props = defineProps<{
  workstationId: string
  placeholder?: string
}>()

const emit = defineEmits<{
  keydown: [event: KeyboardEvent]
}>()

const modelValue = defineModel<string>({ default: '' })
const selectedFiles = defineModel<FileMentionItem[]>('selectedFiles', { default: () => [] })

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showMention = ref(false)
const mentionStartPos = ref(-1)
const highlightIndex = ref(0)
const isComposing = ref(false)
const keyword = ref('')
const mentionList = ref<FileMentionItem[]>([])
let mentionRequestId = 0

const canSearch = computed(() => Boolean(props.workstationId))

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, idx)
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

const formatCreatedAt = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

const syncSelectedFiles = () => {
  const text = textareaRef.value?.value || modelValue.value || ''
  selectedFiles.value = selectedFiles.value.filter(file => text.includes(`@${file.fileName}`))
}

const refreshMentionList = async () => {
  if (!canSearch.value || !showMention.value) {
    mentionList.value = []
    return
  }

  const requestId = ++mentionRequestId
  const result = await fileManagerApi.getMentionFiles(props.workstationId, keyword.value || undefined)
  if (requestId !== mentionRequestId) return

  mentionList.value = result
  if (highlightIndex.value >= mentionList.value.length) {
    highlightIndex.value = 0
  }
}

const closeMention = () => {
  showMention.value = false
  keyword.value = ''
  highlightIndex.value = 0
}

const selectFile = (item: FileMentionItem) => {
  const textarea = textareaRef.value
  if (!textarea) return

  const current = modelValue.value || ''
  const start = mentionStartPos.value
  const end = textarea.selectionStart
  const replaced = `${current.slice(0, start)}@${item.fileName} ${current.slice(end)}`
  modelValue.value = replaced

  if (!selectedFiles.value.some(file => file.fileId === item.fileId)) {
    selectedFiles.value = [...selectedFiles.value, item]
  }

  closeMention()

  requestAnimationFrame(() => {
    const pos = start + item.fileName.length + 2
    textarea.focus()
    textarea.setSelectionRange(pos, pos)
  })
}

const onInput = (event: Event) => {
  if (isComposing.value) return

  syncSelectedFiles()

  const textarea = event.target as HTMLTextAreaElement
  const pos = textarea.selectionStart
  const text = textarea.value

  if (pos > 0 && text[pos - 1] === '@' && (pos === 1 || /[\s\n]/.test(text[pos - 2]))) {
    mentionStartPos.value = pos - 1
    keyword.value = ''
    showMention.value = true
    refreshMentionList()
    return
  }

  if (!showMention.value || mentionStartPos.value < 0) return

  const fragment = text.slice(mentionStartPos.value + 1, pos)
  if (fragment.includes(' ') || fragment.includes('\n')) {
    closeMention()
    return
  }

  keyword.value = fragment
}

const onKeydown = (event: KeyboardEvent) => {
  emit('keydown', event)
  if (!showMention.value) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (mentionList.value.length > 0) {
      highlightIndex.value = (highlightIndex.value + 1) % mentionList.value.length
    }
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (mentionList.value.length > 0) {
      highlightIndex.value = (highlightIndex.value - 1 + mentionList.value.length) % mentionList.value.length
    }
  }

  if (event.key === 'Enter') {
    if (mentionList.value.length > 0) {
      event.preventDefault()
      selectFile(mentionList.value[highlightIndex.value])
    }
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMention()
  }
}

watchDebounced(keyword, refreshMentionList, { debounce: 300, maxWait: 1000 })

watch(
  () => props.workstationId,
  () => {
    if (!props.workstationId) {
      closeMention()
      mentionList.value = []
    }
  }
)
</script>

<template>
  <div class="relative">
    <textarea
      ref="textareaRef"
      v-model="modelValue"
      class="flex min-h-[100px] w-full rounded-md border-none bg-transparent px-4 py-3 text-base placeholder:text-muted-foreground/40 placeholder:text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      :placeholder="placeholder || '描述任务目标... (Shift + Enter 换行)'"
      @input="onInput"
      @keydown="onKeydown"
      @compositionstart="isComposing = true"
      @compositionend="isComposing = false"
    />

    <div v-if="showMention" class="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
      <Command>
        <CommandList>
          <CommandEmpty>未找到文件</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="(item, index) in mentionList"
              :key="item.fileId"
              :value="item.fileName"
              @select="selectFile(item)"
              :class="index === highlightIndex ? 'bg-accent' : ''"
            >
              <div class="flex w-full items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 truncate">
                  <FileText class="h-4 w-4 shrink-0" />
                  <span class="truncate">{{ item.fileName }}</span>
                  </div>
                  <div class="mt-0.5 text-[11px] text-muted-foreground truncate">
                    {{ (item.fileType || '-').toUpperCase() }} · {{ formatFileSize(item.fileSize) }} · {{ formatCreatedAt(item.createdAt) }}
                  </div>
                </div>
                <Badge variant="outline" class="text-[10px]">{{ item.spaceType }}</Badge>
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  </div>
</template>
