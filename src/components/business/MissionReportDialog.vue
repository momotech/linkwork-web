<script setup lang="ts">
import { ref } from 'vue'
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  FileCheck2, ShieldCheck, GitBranch, Download, Terminal, FileCode, Eye, Image as ImageIcon 
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import ArtifactPreviewDialog from './ArtifactPreviewDialog.vue'

interface Props {
  open: boolean
  missionId: string
  report?: {
    summary: string
    tokens: number | string
    duration: string
    completion: number | string
    audit: string
    artifacts?: Array<{ name: string, url?: string, path?: string }>
    branch: string
    commit: string
    mergeRequestUrl?: string
  }
}

const props = defineProps<Props>()
const emit = defineEmits(['update:open'])

// 产物预览状态
const previewOpen = ref(false)
const previewArtifact = ref<{ name: string, url: string } | null>(null)

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const TEXT_EXTS = new Set([
  'py', 'java', 'js', 'ts', 'jsx', 'tsx', 'vue', 'css', 'scss', 'less', 'html',
  'md', 'txt', 'sql', 'sh', 'bash', 'yaml', 'yml', 'json', 'xml',
  'toml', 'ini', 'go', 'rs', 'rb', 'php', 'c', 'cpp', 'log', 'csv'
])

const getFileExt = (name: string): string => {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

const isPreviewable = (name: string): boolean => {
  const ext = getFileExt(name)
  return IMAGE_EXTS.has(ext) || TEXT_EXTS.has(ext)
}

const isImageFile = (name: string): boolean => {
  return IMAGE_EXTS.has(getFileExt(name))
}

const handleArtifactClick = (artifact: { name: string, url?: string, path?: string }) => {
  if (!artifact.url) return
  if (isPreviewable(artifact.name)) {
    previewArtifact.value = { name: artifact.name, url: artifact.url }
    previewOpen.value = true
  } else {
    window.open(artifact.url, '_blank')
  }
}

const handleClose = () => {
  emit('update:open', false)
}

const openMergeRequest = () => {
  if (props.report?.mergeRequestUrl) {
    window.open(props.report.mergeRequestUrl, '_blank')
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="val => emit('update:open', val)">
    <DialogContent class="sm:max-w-[600px] border-border bg-background shadow-2xl p-0 overflow-hidden">
      <DialogHeader class="p-6 pb-0">
        <div class="flex items-center gap-4">
          <div class="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <FileCheck2 class="h-7 w-7 text-emerald-500" />
          </div>
          <div class="space-y-1 text-left">
            <DialogTitle class="text-xl font-bold tracking-tight">任务执行报告</DialogTitle>
            <DialogDescription class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <span class="bg-muted px-1.5 py-0.5 rounded text-foreground font-bold">ID: {{ missionId }}</span>
              <span>•</span>
              <span>已验证并归档</span>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div v-if="report" class="p-6 space-y-6">
        <!-- Summary Section -->
        <div class="bg-muted/30 border border-border/50 rounded-lg p-4 relative group">
          <div class="absolute -top-2 -left-2 bg-background border border-border/50 px-2 py-0.5 rounded text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
            任务总结
          </div>
          <p class="text-sm text-foreground/90 leading-relaxed italic">
            "{{ report.summary }}"
          </p>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-3 gap-3">
          <div v-for="(val, label) in { 
            'Tokens 消耗': typeof report.tokens === 'number' ? report.tokens.toLocaleString() : report.tokens, 
            '累计时长': report.duration, 
            '完成度': report.completion + '%' 
          }" :key="label" class="bg-muted/20 border border-border/50 rounded-md p-3 text-center space-y-1">
            <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">{{ label }}</span>
            <div class="text-lg font-mono font-bold text-primary">{{ val }}</div>
          </div>
        </div>

        <!-- Detail Sections -->
        <div class="space-y-4">
          <div class="flex items-center justify-between py-2 border-b border-border/30">
            <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck class="h-4 w-4 text-emerald-500" /> 安全审计
            </span>
            <div class="flex items-center gap-2">
              <Badge variant="success" class="font-mono text-[10px] font-bold">
                PASSED
              </Badge>
            </div>
          </div>

          <div class="flex items-center justify-between py-2 border-b border-border/30">
            <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <GitBranch class="h-4 w-4 text-blue-500" /> 产物分支 / COMMIT
            </span>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2 font-mono text-[11px] font-bold">
                <span class="text-foreground">{{ report.branch }}</span>
                <span class="text-muted-foreground/40">/</span>
                <span class="text-muted-foreground">{{ report.commit }}</span>
              </div>
              <div class="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  :disabled="!report.mergeRequestUrl"
                  class="h-7 px-3 text-[10px] gap-1.5 font-bold border-primary/30 bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 tracking-widest" 
                  @click="openMergeRequest"
                >
                  <GitBranch class="h-3 w-3" /> MERGE
                </Button>
              </div>
            </div>
          </div>

          <div v-if="report.artifacts?.length" class="space-y-3 pb-6">
            <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
               产物清单 (Artifacts)
            </span>
            <div class="flex flex-wrap gap-2">
              <div v-for="art in report.artifacts" :key="art.name"
                class="flex items-center gap-2 bg-muted/50 border border-border/50 px-3 py-2 rounded-md transition-all shadow-sm"
                :class="art.url ? 'hover:bg-muted hover:border-primary/30 cursor-pointer group' : ''"
                @click="handleArtifactClick(art)"
              >
                <ImageIcon v-if="isImageFile(art.name)" class="h-4 w-4 text-blue-500/70" />
                <FileCode v-else class="h-4 w-4 text-primary/60" />
                <span class="text-xs font-bold">{{ art.path || art.name }}</span>
                <Eye v-if="art.url && isPreviewable(art.name)" class="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <Download v-else-if="art.url" class="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Artifact Preview Dialog -->
  <ArtifactPreviewDialog
    v-model:open="previewOpen"
    :artifact="previewArtifact"
  />
</template>
