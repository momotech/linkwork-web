<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import MarkdownRenderer from './MarkdownRenderer.vue'
import {
  Download, Loader2, ZoomIn, ZoomOut, RotateCcw, FileCode, Image as ImageIcon,
  File, RefreshCw, FileVideo, FileAudio, FileSpreadsheet
} from 'lucide-vue-next'

interface Artifact {
  name: string
  url: string
}

interface Props {
  open: boolean
  artifact: Artifact | null
}

const props = defineProps<Props>()
const emit = defineEmits(['update:open'])

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const TEXT_EXTS = new Set([
  'py', 'java', 'js', 'ts', 'jsx', 'tsx', 'vue', 'css', 'scss', 'less', 'html',
  'md', 'txt', 'sql', 'sh', 'bash', 'zsh', 'yaml', 'yml', 'json', 'xml',
  'toml', 'ini', 'cfg', 'conf', 'env', 'dockerfile', 'makefile',
  'go', 'rs', 'rb', 'php', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt',
  'r', 'lua', 'pl', 'ex', 'exs', 'erl', 'hs', 'ml', 'scala', 'clj',
  'gradle', 'properties', 'log', 'csv', 'gitignore'
])
const MARKDOWN_EXTS = new Set(['md', 'markdown'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'mov'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'])
const PDF_EXTS = new Set(['pdf'])
const SPREADSHEET_EXTS = new Set(['csv', 'tsv'])

const getFileExt = (name: string): string => {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

const fileExt = computed(() => props.artifact ? getFileExt(props.artifact.name) : '')

const previewMode = computed<'image' | 'text' | 'markdown' | 'pdf' | 'video' | 'audio' | 'csv' | 'unsupported'>(() => {
  if (!fileExt.value) return 'unsupported'
  if (IMAGE_EXTS.has(fileExt.value)) return 'image'
  if (PDF_EXTS.has(fileExt.value)) return 'pdf'
  if (VIDEO_EXTS.has(fileExt.value)) return 'video'
  if (AUDIO_EXTS.has(fileExt.value)) return 'audio'
  if (SPREADSHEET_EXTS.has(fileExt.value)) return 'csv'
  if (MARKDOWN_EXTS.has(fileExt.value)) return 'markdown'
  if (TEXT_EXTS.has(fileExt.value)) return 'text'
  return 'unsupported'
})

const previewModeLabel = computed(() => {
  const labels: Record<string, string> = {
    image: '图片预览', text: '文本预览', pdf: 'PDF 预览',
    markdown: 'Markdown 预览', video: '视频预览', audio: '音频预览', csv: '表格预览',
    unsupported: '暂不支持预览'
  }
  return labels[previewMode.value]
})
const normalizedArtifactUrl = computed(() => normalizePreviewUrl(props.artifact?.url || ''))

const textContent = ref('')
const csvRows = ref<string[][]>([])
const pdfPreviewUrl = ref('')
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const MAX_PREVIEW_LEN = 500000
const MAX_CSV_ROWS = 500

const imageScale = ref(1)
const imageScaleLabel = computed(() => `${Math.round(imageScale.value * 100)}%`)
const zoomIn = () => { imageScale.value = Math.min(imageScale.value + 0.25, 3) }
const zoomOut = () => { imageScale.value = Math.max(imageScale.value - 0.25, 0.25) }
const resetZoom = () => { imageScale.value = 1 }

const normalizePreviewUrl = (url: string): string => {
  const trimmed = String(url || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  return `/${trimmed}`
}

const buildPdfPreviewUrl = (url: string): string => {
  const normalized = normalizePreviewUrl(url)
  if (!normalized) return ''
  try {
    const isAbsolute = /^https?:\/\//i.test(normalized) || normalized.startsWith('//')
    const parsed = new URL(normalized, window.location.origin)
    if (!parsed.searchParams.has('inline')) {
      parsed.searchParams.set('inline', 'true')
    }
    return isAbsolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    if (normalized.includes('inline=')) return normalized
    return normalized.includes('?') ? `${normalized}&inline=true` : `${normalized}?inline=true`
  }
}

const downloadArtifact = () => {
  const downloadUrl = normalizePreviewUrl(props.artifact?.url || '')
  const artifactName = props.artifact?.name || 'artifact'
  if (!downloadUrl) return
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = artifactName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const revokePdfPreviewUrl = () => {
  if (pdfPreviewUrl.value) {
    URL.revokeObjectURL(pdfPreviewUrl.value)
    pdfPreviewUrl.value = ''
  }
}

const reloadPreview = () => {
  const url = normalizePreviewUrl(props.artifact?.url || '')
  if (url) {
    if (previewMode.value === 'pdf') {
      loadPdfContent(url)
      return
    }
    loadTextContent(url)
  }
}

const parseCsv = (text: string): string[][] => {
  const lines = text.split('\n').filter(l => l.trim())
  return lines.slice(0, MAX_CSV_ROWS).map(line => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue }
      current += ch
    }
    cells.push(current.trim())
    return cells
  })
}

const loadTextContent = async (url: string) => {
  isLoading.value = true
  loadError.value = null
  textContent.value = ''
  csvRows.value = []
  revokePdfPreviewUrl()

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const text = await response.text()

    if (previewMode.value === 'csv') {
      csvRows.value = parseCsv(text)
    } else if (text.length > MAX_PREVIEW_LEN) {
      textContent.value = text.slice(0, MAX_PREVIEW_LEN) + `\n\n... (内容过长，已截断，共 ${text.length} 字符)`
    } else {
      textContent.value = text
    }
  } catch (err: any) {
    loadError.value = err.message || '加载文件内容失败'
  } finally {
    isLoading.value = false
  }
}

const loadPdfContent = async (url: string) => {
  isLoading.value = true
  loadError.value = null
  revokePdfPreviewUrl()
  textContent.value = ''
  csvRows.value = []

  try {
    const response = await fetch(buildPdfPreviewUrl(url))
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const blob = await response.blob()
    if (blob.size === 0) {
      throw new Error('PDF 文件为空')
    }
    pdfPreviewUrl.value = URL.createObjectURL(blob)
  } catch (err: any) {
    loadError.value = err.message || '加载 PDF 失败'
  } finally {
    isLoading.value = false
  }
}

watch(() => [props.open, props.artifact], ([open, artifact]) => {
  if (!open) {
    revokePdfPreviewUrl()
    return
  }

  if (open && artifact) {
    imageScale.value = 1
    textContent.value = ''
    csvRows.value = []
    revokePdfPreviewUrl()
    loadError.value = null

    const mode = previewMode.value
    const normalizedUrl = normalizePreviewUrl((artifact as Artifact).url || '')
    if (mode === 'pdf' && normalizedUrl) {
      loadPdfContent(normalizedUrl)
      return
    }
    if ((mode === 'text' || mode === 'markdown' || mode === 'csv') && normalizedUrl) {
      loadTextContent(normalizedUrl)
    }
  }
}, { immediate: true })

onBeforeUnmount(() => {
  revokePdfPreviewUrl()
})

const langLabel = computed(() => {
  const map: Record<string, string> = {
    py: 'Python', java: 'Java', js: 'JavaScript', ts: 'TypeScript',
    jsx: 'JSX', tsx: 'TSX', vue: 'Vue', css: 'CSS', scss: 'SCSS',
    html: 'HTML', md: 'Markdown', txt: 'Text', sql: 'SQL',
    sh: 'Shell', bash: 'Bash', yaml: 'YAML', yml: 'YAML',
    json: 'JSON', xml: 'XML', go: 'Go', rs: 'Rust', rb: 'Ruby',
    php: 'PHP', c: 'C', cpp: 'C++', swift: 'Swift', kt: 'Kotlin',
    toml: 'TOML', ini: 'INI', log: 'Log', csv: 'CSV', tsv: 'TSV',
    pdf: 'PDF', mp4: 'MP4', webm: 'WebM', mp3: 'MP3', wav: 'WAV'
  }
  return map[fileExt.value] || fileExt.value.toUpperCase() || 'FILE'
})

const previewIcon = computed(() => {
  if (previewMode.value === 'image') return ImageIcon
  if (previewMode.value === 'video') return FileVideo
  if (previewMode.value === 'audio') return FileAudio
  if (previewMode.value === 'csv') return FileSpreadsheet
  if (previewMode.value === 'text' || previewMode.value === 'markdown') return FileCode
  return File
})
</script>

<template>
  <Dialog :open="open" @update:open="val => emit('update:open', val)">
    <DialogContent
      overlay-class="bg-background/60 backdrop-blur-[1px]"
      class="w-[min(94vw,1080px)] max-w-none h-[min(90vh,760px)] p-0 gap-0 overflow-hidden border-border/70 bg-background shadow-2xl flex flex-col"
    >
      <DialogHeader class="border-b border-border/60 bg-muted/[0.35] px-5 py-4 shrink-0">
        <div class="flex items-start justify-between gap-3 pr-8">
          <div class="flex min-w-0 items-start gap-3">
            <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/25 shrink-0">
              <component :is="previewIcon" class="h-5 w-5 text-primary" />
            </div>
            <div class="min-w-0 text-left">
              <DialogTitle class="truncate text-base font-semibold">{{ artifact?.name || '文件预览' }}</DialogTitle>
              <DialogDescription class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" class="h-5 px-2 text-[10px] font-mono tracking-wide">{{ langLabel }}</Badge>
                <span>{{ previewModeLabel }}</span>
                <span v-if="(previewMode === 'text' || previewMode === 'markdown') && textContent" class="font-mono">
                  {{ textContent.length.toLocaleString() }} chars
                </span>
                <span v-if="previewMode === 'csv' && csvRows.length > 0" class="font-mono">
                  {{ csvRows.length }} 行 × {{ csvRows[0]?.length || 0 }} 列
                </span>
              </DialogDescription>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <template v-if="previewMode === 'image'">
              <Button variant="outline" size="icon" class="h-8 w-8" @click="zoomOut" title="缩小">
                <ZoomOut class="h-4 w-4" />
              </Button>
              <span class="w-12 text-center text-[11px] font-mono text-muted-foreground">{{ imageScaleLabel }}</span>
              <Button variant="outline" size="icon" class="h-8 w-8" @click="zoomIn" title="放大">
                <ZoomIn class="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" class="h-8 w-8" @click="resetZoom" title="重置缩放">
                <RotateCcw class="h-4 w-4" />
              </Button>
            </template>
            <Button
              v-if="previewMode === 'text' || previewMode === 'markdown' || previewMode === 'csv' || previewMode === 'pdf'"
              variant="outline"
              size="sm"
              class="h-8 px-2.5 text-xs"
              :disabled="isLoading"
              @click="reloadPreview"
            >
              <RefreshCw class="h-3.5 w-3.5 mr-1" :class="isLoading ? 'animate-spin' : ''" />
              刷新
            </Button>
            <Button variant="default" size="sm" class="h-8 px-3 text-xs" @click="downloadArtifact">
              <Download class="h-3.5 w-3.5 mr-1" />
              下载
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div class="flex-1 min-h-0 bg-muted/[0.12]">
        <!-- Image -->
        <div v-if="previewMode === 'image'" class="h-full overflow-auto p-4">
          <div class="flex min-h-full items-center justify-center rounded-xl border border-border/60 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.5)_1px,transparent_0)] bg-[size:12px_12px] p-6">
            <img
              :src="normalizedArtifactUrl"
              :alt="artifact?.name"
              class="max-h-[68vh] max-w-full rounded-md border border-border/50 bg-background shadow-xl transition-transform duration-200"
              :style="{ transform: `scale(${imageScale})`, transformOrigin: 'center center' }"
              @dblclick="resetZoom"
            />
          </div>
        </div>

        <!-- PDF -->
        <div v-else-if="previewMode === 'pdf'" class="h-full p-4">
          <div v-if="isLoading" class="h-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-muted-foreground">
            <Loader2 class="h-5 w-5 animate-spin" />
            <span class="text-sm">正在加载 PDF...</span>
          </div>
          <div v-else-if="loadError" class="h-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/50 bg-background/95 px-6 text-center">
            <File class="h-8 w-8 text-destructive" />
            <p class="text-sm text-destructive">{{ loadError }}</p>
            <Button variant="outline" size="sm" class="h-8" @click="reloadPreview">
              <RefreshCw class="h-3.5 w-3.5 mr-1.5" />
              重试加载
            </Button>
          </div>
          <iframe
            v-else
            :src="pdfPreviewUrl"
            class="w-full h-full rounded-xl border border-border/60 bg-background"
            frameborder="0"
          />
        </div>

        <!-- Video -->
        <div v-else-if="previewMode === 'video'" class="h-full flex items-center justify-center p-4">
          <video
            :src="normalizedArtifactUrl"
            controls
            class="max-h-full max-w-full rounded-xl border border-border/60 shadow-xl bg-black"
          >
            浏览器不支持该视频格式
          </video>
        </div>

        <!-- Audio -->
        <div v-else-if="previewMode === 'audio'" class="h-full flex flex-col items-center justify-center gap-6 p-6">
          <div class="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/25">
            <FileAudio class="h-10 w-10 text-primary" />
          </div>
          <p class="text-sm font-medium text-foreground">{{ artifact?.name }}</p>
          <audio :src="normalizedArtifactUrl" controls class="w-full max-w-md" />
        </div>

        <!-- CSV / TSV Table -->
        <div v-else-if="previewMode === 'csv'" class="h-full p-4">
          <div v-if="isLoading" class="h-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-muted-foreground">
            <Loader2 class="h-5 w-5 animate-spin" />
            <span class="text-sm">正在加载...</span>
          </div>
          <div v-else-if="loadError" class="h-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/50 bg-background/95 px-6 text-center">
            <File class="h-8 w-8 text-destructive" />
            <p class="text-sm text-destructive">{{ loadError }}</p>
            <Button variant="outline" size="sm" class="h-8" @click="reloadPreview">
              <RefreshCw class="h-3.5 w-3.5 mr-1.5" />
              重试加载
            </Button>
          </div>
          <div v-else class="h-full overflow-auto rounded-xl border border-border/60 bg-background">
            <table class="w-full text-xs border-collapse">
              <thead v-if="csvRows.length > 0" class="sticky top-0 z-10 bg-muted/50">
                <tr>
                  <th v-for="(cell, ci) in csvRows[0]" :key="ci" class="text-left px-3 py-2 border-b border-r border-border/40 font-medium whitespace-nowrap">{{ cell }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in csvRows.slice(1)" :key="ri" class="hover:bg-muted/20">
                  <td v-for="(cell, ci) in row" :key="ci" class="px-3 py-1.5 border-b border-r border-border/30 whitespace-nowrap max-w-[300px] truncate">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Markdown -->
        <div v-else-if="previewMode === 'markdown'" class="h-full p-4">
          <div v-if="isLoading" class="h-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-muted-foreground">
            <Loader2 class="h-5 w-5 animate-spin" />
            <span class="text-sm">正在加载 Markdown...</span>
          </div>
          <div v-else-if="loadError" class="h-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/50 bg-background/95 px-6 text-center">
            <File class="h-8 w-8 text-destructive" />
            <p class="text-sm text-destructive">{{ loadError }}</p>
            <Button variant="outline" size="sm" class="h-8" @click="reloadPreview">
              <RefreshCw class="h-3.5 w-3.5 mr-1.5" />
              重试加载
            </Button>
          </div>
          <div v-else class="h-full overflow-auto rounded-xl border border-border/60 bg-background p-4">
            <MarkdownRenderer :content="textContent" />
          </div>
        </div>

        <!-- Text / Code -->
        <div v-else-if="previewMode === 'text'" class="h-full p-4">
          <div v-if="isLoading" class="h-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background text-muted-foreground">
            <Loader2 class="h-5 w-5 animate-spin" />
            <span class="text-sm">正在加载文件内容...</span>
          </div>
          <div v-else-if="loadError" class="h-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/50 bg-background/95 px-6 text-center">
            <File class="h-8 w-8 text-destructive" />
            <p class="text-sm text-destructive">{{ loadError }}</p>
            <Button variant="outline" size="sm" class="h-8" @click="reloadPreview">
              <RefreshCw class="h-3.5 w-3.5 mr-1.5" />
              重试加载
            </Button>
          </div>
          <div v-else class="h-full overflow-auto rounded-xl border border-border/60 bg-background shadow-inner">
            <div class="flex min-w-max">
              <div class="sticky left-0 select-none text-right pr-3 pl-3 py-4 text-[11px] leading-6 font-mono text-muted-foreground bg-background border-r border-border/60">
                <div v-for="(_, idx) in textContent.split('\n')" :key="idx">{{ idx + 1 }}</div>
              </div>
              <pre class="px-4 py-4 text-[12px] leading-6 font-mono text-foreground whitespace-pre flex-1">{{ textContent }}</pre>
            </div>
          </div>
        </div>

        <!-- Unsupported -->
        <div v-else class="h-full flex flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
          <div class="h-14 w-14 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-center">
            <File class="h-7 w-7 text-muted-foreground/70" />
          </div>
          <div>
            <p class="text-sm font-medium text-foreground">该文件类型暂不支持在线预览</p>
            <p class="mt-1 text-xs text-muted-foreground">你可以直接下载并在本地打开。</p>
          </div>
          <Button variant="default" size="sm" class="h-8 px-3 text-xs" @click="downloadArtifact">
            <Download class="h-3.5 w-3.5 mr-1.5" />
            下载文件
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
