<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { FileNodeItem } from '@/api/fileManager'

interface MentionToken {
  nodeId: string
  fileId?: string
  name: string
}

const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  'mentions-change': [mentions: MentionToken[]]
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const savedRange = ref<Range | null>(null)
const syncingFromDom = ref(false)
const selectedMentionNode = ref<HTMLElement | null>(null)

const normalizeText = (value: string) => value.replace(/\u00a0/g, ' ').replace(/\r/g, '')

const getPromptText = () => {
  const editor = editorRef.value
  if (!editor) return props.modelValue || ''
  const text = normalizeText(editor.innerText || '')
  return text.endsWith('\n') ? text.slice(0, -1) : text
}

const collectMentions = (): MentionToken[] => {
  const editor = editorRef.value
  if (!editor) return []
  const mentions: MentionToken[] = []
  editor.querySelectorAll<HTMLElement>('span[data-mention="true"]').forEach((el) => {
    const nodeId = el.dataset.nodeId
    if (!nodeId) return
    mentions.push({
      nodeId,
      fileId: el.dataset.fileId || undefined,
      name: el.dataset.name || el.textContent?.replace(/^@/, '') || ''
    })
  })
  return mentions
}

const getMentionFileIds = () => {
  const ids = collectMentions()
    .map(item => item.fileId)
    .filter((id): id is string => Boolean(id))
  return Array.from(new Set(ids))
}

const syncFromDom = () => {
  if (selectedMentionNode.value && !selectedMentionNode.value.isConnected) {
    selectedMentionNode.value = null
  }
  syncingFromDom.value = true
  emit('update:modelValue', getPromptText())
  emit('mentions-change', collectMentions())
  syncingFromDom.value = false
}

const setPlainText = (value: string) => {
  const editor = editorRef.value
  if (!editor) return
  clearMentionSelection()
  if (!value) {
    editor.innerHTML = ''
    return
  }
  editor.innerText = value
}

const clearMentionSelection = () => {
  if (!selectedMentionNode.value) return
  selectedMentionNode.value.classList.remove('mention-chip-selected')
  selectedMentionNode.value = null
}

const selectMentionNode = (node: HTMLElement) => {
  if (selectedMentionNode.value === node) return
  clearMentionSelection()
  node.classList.add('mention-chip-selected')
  selectedMentionNode.value = node
}

const captureSelection = () => {
  const editor = editorRef.value
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return
  savedRange.value = range.cloneRange()
}

const restoreSelection = () => {
  const editor = editorRef.value
  const selection = window.getSelection()
  if (!editor || !selection) return null

  let range: Range | null = null
  const saved = savedRange.value
  if (
    saved &&
    saved.startContainer.isConnected &&
    saved.endContainer.isConnected &&
    editor.contains(saved.startContainer) &&
    editor.contains(saved.endContainer)
  ) {
    range = saved.cloneRange()
  } else {
    range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
  }

  selection.removeAllRanges()
  selection.addRange(range)
  savedRange.value = range.cloneRange()
  return range
}

const focus = () => {
  if (props.disabled) return
  editorRef.value?.focus()
}

const createMentionNode = (file: FileNodeItem) => {
  const chip = document.createElement('span')
  chip.dataset.mention = 'true'
  chip.dataset.nodeId = file.nodeId
  chip.dataset.name = file.name
  if (file.fileId) chip.dataset.fileId = file.fileId
  chip.className = 'mention-chip'
  chip.contentEditable = 'false'

  const label = document.createElement('span')
  label.className = 'mention-chip-label'
  label.textContent = `@${file.name}`

  const removeButton = document.createElement('button')
  removeButton.type = 'button'
  removeButton.className = 'mention-chip-remove'
  removeButton.contentEditable = 'false'
  removeButton.tabIndex = -1
  removeButton.setAttribute('aria-label', `移除引用 ${file.name}`)

  chip.appendChild(label)
  chip.appendChild(removeButton)
  return chip
}

const insertMentionsAtCaret = (files: FileNodeItem[]) => {
  if (props.disabled || files.length === 0) return 0
  const editor = editorRef.value
  if (!editor) return 0

  focus()
  const range = restoreSelection()
  if (!range) return 0

  const fragment = document.createDocumentFragment()
  let tailNode: Node | null = null
  files.forEach((file) => {
    const chip = createMentionNode(file)
    const space = document.createTextNode(' ')
    fragment.appendChild(chip)
    fragment.appendChild(space)
    tailNode = space
  })

  range.deleteContents()
  range.insertNode(fragment)

  if (tailNode) {
    const next = document.createRange()
    next.setStartAfter(tailNode)
    next.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(next)
    savedRange.value = next.cloneRange()
  }

  syncFromDom()
  return files.length
}

const getAdjacentMentionNode = (direction: 'backward' | 'forward') => {
  const editor = editorRef.value
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!range.collapsed || !editor.contains(range.startContainer)) return null

  const pickMention = (node: Node | null): HTMLElement | null => {
    if (!node) return null
    if (node instanceof HTMLElement && node.dataset.mention === 'true') return node
    return null
  }

  const { startContainer, startOffset } = range

  if (direction === 'backward') {
    if (startContainer.nodeType === Node.TEXT_NODE) {
      if (startOffset > 0) return null
      return pickMention(startContainer.previousSibling)
    }
    return pickMention((startContainer as Element).childNodes[startOffset - 1] || null)
  }

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = startContainer as Text
    if (startOffset < textNode.data.length) return null
    return pickMention(textNode.nextSibling)
  }
  return pickMention((startContainer as Element).childNodes[startOffset] || null)
}

const removeMentionNode = (node: HTMLElement) => {
  const parent = node.parentNode
  if (!parent) return
  if (selectedMentionNode.value === node) {
    selectedMentionNode.value = null
  }
  const index = Array.prototype.indexOf.call(parent.childNodes, node) as number

  node.remove()
  const range = document.createRange()
  range.setStart(parent, Math.min(index, parent.childNodes.length))
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  savedRange.value = range.cloneRange()
  syncFromDom()
}

const onInput = () => {
  clearMentionSelection()
  syncFromDom()
  nextTick(captureSelection)
}

const onKeydown = (event: KeyboardEvent) => {
  if ((event.key === 'Backspace' || event.key === 'Delete') && selectedMentionNode.value) {
    event.preventDefault()
    removeMentionNode(selectedMentionNode.value)
    return
  }

  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    emit('submit')
    return
  }

  if (event.key === 'Backspace') {
    const mention = getAdjacentMentionNode('backward')
    if (mention) {
      event.preventDefault()
      removeMentionNode(mention)
    }
    return
  }

  if (event.key === 'Delete') {
    const mention = getAdjacentMentionNode('forward')
    if (mention) {
      event.preventDefault()
      removeMentionNode(mention)
    }
  }
}

const onPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') || ''
  if (!text) return

  const range = restoreSelection()
  if (!range) return
  const node = document.createTextNode(text)
  range.deleteContents()
  range.insertNode(node)

  const next = document.createRange()
  next.setStartAfter(node)
  next.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(next)
  savedRange.value = next.cloneRange()
  syncFromDom()
}

const onClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target) return

  const removeButton = target.closest('.mention-chip-remove') as HTMLElement | null
  if (removeButton) {
    event.preventDefault()
    const mention = removeButton.closest('span[data-mention="true"]') as HTMLElement | null
    if (mention) {
      removeMentionNode(mention)
    }
    return
  }

  const mention = target.closest('span[data-mention="true"]') as HTMLElement | null
  if (mention) {
    event.preventDefault()
    selectMentionNode(mention)
    return
  }

  clearMentionSelection()
}

watch(
  () => props.modelValue,
  (value) => {
    if (syncingFromDom.value) return
    if (!editorRef.value) return
    const next = value || ''
    if (getPromptText() === next) return
    setPlainText(next)
    emit('mentions-change', collectMentions())
  }
)

onMounted(() => {
  setPlainText(props.modelValue || '')
  emit('mentions-change', collectMentions())
})

defineExpose({
  captureSelection,
  focus,
  getMentionFileIds,
  getPromptText,
  insertMentionsAtCaret
})
</script>

<template>
  <div
    ref="editorRef"
    class="prompt-editor min-h-[100px] w-full rounded-md border-none bg-transparent px-4 py-3 text-base placeholder:text-muted-foreground/40 placeholder:text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    :class="{ 'pointer-events-none opacity-60': disabled }"
    :contenteditable="!disabled"
    :data-placeholder="placeholder || '描述任务目标... (Shift + Enter 换行)'"
    @input="onInput"
    @keydown="onKeydown"
    @keyup="captureSelection"
    @mouseup="captureSelection"
    @blur="captureSelection"
    @click="onClick"
    @paste="onPaste"
  />
</template>

<style>
.prompt-editor {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-y: auto;
  resize: none;
}

.prompt-editor:empty::before {
  content: attr(data-placeholder);
  color: hsl(var(--muted-foreground) / 0.6);
  pointer-events: none;
}

.prompt-editor .mention-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0 2px;
  padding: 1px 6px;
  border-radius: 9999px;
  border: 1px solid rgba(37, 99, 235, 0.32);
  background: rgba(37, 99, 235, 0.14);
  color: rgb(29, 78, 216);
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  vertical-align: baseline;
  cursor: pointer;
}

.prompt-editor .mention-chip-selected {
  border-color: rgba(37, 99, 235, 0.56);
  background: rgba(37, 99, 235, 0.2);
}

.prompt-editor .mention-chip-remove {
  display: none;
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 9999px;
  padding: 0;
  color: rgb(29, 78, 216);
  background: transparent;
  cursor: pointer;
}

.prompt-editor .mention-chip-remove::before {
  content: '×';
  font-size: 12px;
  line-height: 14px;
}

.prompt-editor .mention-chip-selected .mention-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.prompt-editor .mention-chip-remove:hover {
  background: rgba(37, 99, 235, 0.18);
}
</style>
