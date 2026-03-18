<script setup lang="ts">
import { computed } from 'vue'
import CodeContainer from './CodeContainer.vue'

interface Props {
  content: string
}

interface Block {
  type: 'text' | 'code' | 'table'
  content: string
  lang?: string
  tableData?: { headers: string[]; rows: string[][] }
}

const props = defineProps<Props>()

// 解析表格
const parseTable = (tableText: string): { headers: string[]; rows: string[][] } | null => {
  const lines = tableText.trim().split('\n')
  if (lines.length < 2) return null
  
  // 解析表头
  const headerLine = lines[0]
  if (!headerLine.includes('|')) return null
  
  const headers = headerLine
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell.length > 0)
  
  // 跳过分隔行 (|---|---|)
  const separatorIndex = lines.findIndex(line => /^\|?\s*[-:]+\s*\|/.test(line))
  if (separatorIndex === -1) return null
  
  // 解析数据行
  const rows: string[][] = []
  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || !line.includes('|')) continue
    
    const cells = line
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0)
    
    if (cells.length > 0) {
      rows.push(cells)
    }
  }
  
  return { headers, rows }
}

// 解析 markdown 内容为 blocks
const blocks = computed(() => {
  const text = props.content || ''
  const result: Block[] = []
  
  // 先处理代码块，避免表格正则匹配到代码块内容
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  const tableRegex = /(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/g
  
  // 标记代码块位置
  const codeBlocks: Array<{ start: number; end: number; lang: string; content: string }> = []
  let match
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({
      start: match.index,
      end: match.index + match[0].length,
      lang: match[1] || 'text',
      content: match[2].trim()
    })
  }
  
  // 检查位置是否在代码块内
  const isInCodeBlock = (pos: number) => {
    return codeBlocks.some(block => pos >= block.start && pos < block.end)
  }
  
  // 标记表格位置
  const tables: Array<{ start: number; end: number; data: { headers: string[]; rows: string[][] } }> = []
  while ((match = tableRegex.exec(text)) !== null) {
    if (!isInCodeBlock(match.index)) {
      const tableData = parseTable(match[0])
      if (tableData && tableData.headers.length > 0) {
        tables.push({
          start: match.index,
          end: match.index + match[0].length,
          data: tableData
        })
      }
    }
  }
  
  // 合并所有块并排序
  const allBlocks: Array<{ start: number; end: number; type: 'code' | 'table'; data: any }> = [
    ...codeBlocks.map(b => ({ start: b.start, end: b.end, type: 'code' as const, data: b })),
    ...tables.map(t => ({ start: t.start, end: t.end, type: 'table' as const, data: t }))
  ].sort((a, b) => a.start - b.start)
  
  let lastIndex = 0
  
  for (const block of allBlocks) {
    // 添加块之前的文本
    if (block.start > lastIndex) {
      const textBefore = text.slice(lastIndex, block.start)
      if (textBefore.trim()) {
        result.push({ type: 'text', content: textBefore })
      }
    }
    
    if (block.type === 'code') {
      result.push({
        type: 'code',
        lang: block.data.lang,
        content: block.data.content
      })
    } else {
      result.push({
        type: 'table',
        content: '',
        tableData: block.data.data
      })
    }
    
    lastIndex = block.end
  }
  
  // 添加最后的文本
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining.trim()) {
      result.push({ type: 'text', content: remaining })
    }
  }
  
  // 如果没有匹配到任何块，返回原始文本
  if (result.length === 0 && text.trim()) {
    result.push({ type: 'text', content: text })
  }
  
  return result
})

// 简单的 markdown 文本格式化（加粗、标题等）
const formatText = (text: string): string => {
  return text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 加粗: **text** 或 __text__
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/__([^_]+)__/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // 斜体: *text* 或 _text_
    .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
    .replace(/_([^_]+)_/g, '<em class="italic">$1</em>')
    // 行内代码: `code`
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-primary">$1</code>')
    // 标题: ## 或 ###
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-foreground mt-3 mb-1.5">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-foreground mt-3 mb-1.5">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-base font-bold text-foreground mt-3 mb-1.5">$1</h1>')
    // 列表项: - item 或 * item
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc list-inside">$1</li>')
    // 数字列表: 1. item
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal list-inside">$1</li>')
    // 换行
    .replace(/\n\n/g, '</p><p class="my-1">')
    .replace(/\n/g, '<br>')
}
</script>

<template>
  <div class="markdown-content space-y-2">
    <template v-for="(block, index) in blocks" :key="index">
      <!-- 代码块 -->
      <CodeContainer
        v-if="block.type === 'code'"
        :code="block.content"
        :lang="block.lang"
        class="my-2"
      />

      <!-- 表格 -->
      <div v-else-if="block.type === 'table'" class="my-2 overflow-x-auto max-w-full rounded-lg border border-border">
        <table class="text-xs border-collapse w-full">
          <thead>
            <tr class="bg-muted/50">
              <th
                v-for="(header, hIdx) in block.tableData?.headers"
                :key="hIdx"
                class="px-3 py-1.5 text-left font-semibold text-foreground border border-border whitespace-nowrap"
              >
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rIdx) in block.tableData?.rows"
              :key="rIdx"
              class="hover:bg-muted/30 transition-colors"
            >
              <td
                v-for="(cell, cIdx) in row"
                :key="cIdx"
                class="px-3 py-1.5 text-foreground/90 border border-border"
              >
                {{ cell }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 文本内容 -->
      <div
        v-else
        class="text-foreground/90 leading-normal text-sm"
        v-html="formatText(block.content)"
      />
    </template>
  </div>
</template>

<style scoped>
.markdown-content :deep(p) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-top: 0;
}

.markdown-content :deep(h1):first-child,
.markdown-content :deep(h2):first-child,
.markdown-content :deep(h3):first-child {
  margin-top: 0;
}

.markdown-content :deep(li) {
  color: hsl(var(--foreground) / 0.9);
}

.markdown-content :deep(strong) {
  font-weight: 600;
}

.markdown-content :deep(em) {
  font-style: italic;
}

/* 表格样式 */
.markdown-content table {
  border-radius: 0.5rem;
  overflow: hidden;
}

.markdown-content table th {
  background-color: hsl(var(--muted) / 0.5);
}

.markdown-content table tr:nth-child(even) {
  background-color: hsl(var(--muted) / 0.2);
}
</style>
