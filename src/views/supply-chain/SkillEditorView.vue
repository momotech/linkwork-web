<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Save, RefreshCcw, History, GitCommit, RotateCcw,
  FileText, FileCode, FolderOpen, Loader2, AlertCircle, Clock, User,
  ChevronRight, ChevronDown, Folder, FileJson, FileType, Search
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useSkills, type SkillDetail, type SkillFile, type FileContent, type CommitRecord } from '@/composables/useSkills'

// Lazy load CodeEditor to reduce initial bundle
const CodeEditor = defineAsyncComponent(() =>
  import('@/components/ui/code-editor/CodeEditor.vue')
)
import { defineAsyncComponent } from 'vue'

const route = useRoute()
const router = useRouter()
const skillName = route.params.name as string

const { getSkillDetail, getFileContent, saveFile, getHistory, revertSkill } = useSkills()

// State
const skillDetail = ref<SkillDetail | null>(null)
const isLoadingDetail = ref(false)
const selectedFilePath = ref<string | null>(null)
const fileContent = ref('')
const lastCommitId = ref('')
const isLoadingFile = ref(false)
const isSaving = ref(false)
const isDirty = ref(false)
const editorLanguage = ref('markdown')

// History
const showHistory = ref(false)
const commits = ref<CommitRecord[]>([])
const isLoadingHistory = ref(false)

// Commit message dialog
const showCommitDialog = ref(false)
const commitMessage = ref('')

// Revert confirmation
const showRevertDialog = ref(false)
const revertTarget = ref<CommitRecord | null>(null)

// File tree
const expandedFolders = ref<Set<string>>(new Set())
const codeEditorRef = ref<{ openSearchPanel?: () => void } | null>(null)

// Build file tree from flat paths
interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

interface TreeRow {
  node: TreeNode
  depth: number
}

const fileTree = computed<TreeNode[]>(() => {
  if (!skillDetail.value?.files) return []

  const root: TreeNode[] = []
  const nodesByPath = new Map<string, TreeNode>()

  const pushIfMissing = (target: TreeNode[], node: TreeNode) => {
    if (!target.some(item => item.path === node.path)) {
      target.push(node)
    }
  }

  const ensureDirectory = (dirPath: string): TreeNode => {
    const existing = nodesByPath.get(dirPath)
    if (existing) return existing

    const parts = dirPath.split('/')
    const dirNode: TreeNode = {
      name: parts[parts.length - 1],
      path: dirPath,
      type: 'directory',
      children: [],
    }
    nodesByPath.set(dirPath, dirNode)
    expandedFolders.value.add(dirPath)

    if (parts.length === 1) {
      pushIfMissing(root, dirNode)
      return dirNode
    }

    const parentPath = parts.slice(0, -1).join('/')
    const parentDir = ensureDirectory(parentPath)
    pushIfMissing(parentDir.children!, dirNode)
    return dirNode
  }

  const sortedFiles = [...skillDetail.value.files].sort((a, b) => {
    const aDepth = a.path.split('/').length
    const bDepth = b.path.split('/').length
    if (aDepth !== bDepth) return aDepth - bDepth
    return a.path.localeCompare(b.path)
  })

  for (const file of sortedFiles) {
    const normalizedPath = file.path.replace(/^\/+|\/+$/g, '')
    if (!normalizedPath) continue

    if (file.type === 'tree') {
      ensureDirectory(normalizedPath)
      continue
    }

    if (nodesByPath.has(normalizedPath)) {
      continue
    }

    const parts = normalizedPath.split('/')
    const fileNode: TreeNode = {
      name: parts[parts.length - 1],
      path: normalizedPath,
      type: 'file',
    }
    nodesByPath.set(normalizedPath, fileNode)

    if (parts.length === 1) {
      pushIfMissing(root, fileNode)
      continue
    }

    const parentDir = ensureDirectory(parts.slice(0, -1).join('/'))
    pushIfMissing(parentDir.children!, fileNode)
  }

  // Sort: directories first, then files, alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach(n => { if (n.children) sortNodes(n.children) })
  }
  sortNodes(root)
  return root
})

const visibleTreeRows = computed<TreeRow[]>(() => {
  const rows: TreeRow[] = []

  const walk = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      rows.push({ node, depth })
      if (node.type === 'directory' && expandedFolders.value.has(node.path) && node.children?.length) {
        walk(node.children, depth + 1)
      }
    }
  }

  walk(fileTree.value, 0)
  return rows
})

// Get file icon based on extension
const getFileIcon = (name: string) => {
  if (name.endsWith('.py')) return FileCode
  if (name.endsWith('.md')) return FileText
  if (name.endsWith('.json')) return FileJson
  return FileType
}

// Get language from file path
const getLanguageFromPath = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    'md': 'markdown', 'py': 'python', 'js': 'javascript', 'ts': 'typescript',
    'json': 'json', 'sh': 'markdown', 'yaml': 'markdown', 'yml': 'markdown',
    'toml': 'markdown', 'txt': 'markdown',
  }
  return map[ext] || 'markdown'
}

// Load skill detail
const loadSkillDetail = async () => {
  isLoadingDetail.value = true
  try {
    skillDetail.value = await getSkillDetail(skillName)
  } catch (e: any) {
    toast.error(e.message || '加载 Skill 详情失败')
  } finally {
    isLoadingDetail.value = false
  }
}

// Load file content
const loadFileContent = async (path: string) => {
  if (isDirty.value) {
    const confirmed = window.confirm('当前文件有未保存的更改，确定切换文件吗？')
    if (!confirmed) return
  }

  selectedFilePath.value = path
  isLoadingFile.value = true
  isDirty.value = false
  editorLanguage.value = getLanguageFromPath(path)

  try {
    const data = await getFileContent(skillName, path)
    fileContent.value = data.content
    lastCommitId.value = data.commitId
  } catch (e: any) {
    toast.error(e.message || '加载文件内容失败')
    fileContent.value = ''
    lastCommitId.value = ''
  } finally {
    isLoadingFile.value = false
  }
}

// Handle editor content change
const handleContentChange = (newContent: string) => {
  fileContent.value = newContent
  isDirty.value = true
}

// Handle save (Ctrl+S or button click)
const handleSave = () => {
  if (!selectedFilePath.value || !isDirty.value) return
  commitMessage.value = `Update ${selectedFilePath.value}`
  showCommitDialog.value = true
}

const openEditorSearch = () => {
  if (!selectedFilePath.value) return
  codeEditorRef.value?.openSearchPanel?.()
}

const handleEditorSearchShortcut = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
  if (event.key.toLowerCase() !== 'f') return
  if (!selectedFilePath.value) return
  event.preventDefault()
  openEditorSearch()
}

// Execute save with commit message
const executeSave = async () => {
  if (!selectedFilePath.value) return
  showCommitDialog.value = false
  isSaving.value = true

  try {
    const result = await saveFile(
      skillName,
      selectedFilePath.value,
      fileContent.value,
      commitMessage.value || `Update ${selectedFilePath.value}`,
      lastCommitId.value,
    )
    lastCommitId.value = result.commitId
    isDirty.value = false
    toast.success('文件已保存并提交')
    // 自动刷新历史记录
    if (showHistory.value) {
      loadHistory()
    }
  } catch (e: any) {
    if (e.message === 'CONFLICT') {
      toast.error('文件已被他人修改，请刷新后重试', {
        duration: 8000,
        action: {
          label: '刷新文件',
          onClick: () => selectedFilePath.value && loadFileContent(selectedFilePath.value),
        },
      })
    } else {
      toast.error(e.message || '保存失败')
    }
  } finally {
    isSaving.value = false
  }
}

// Load history
const loadHistory = async () => {
  isLoadingHistory.value = true
  try {
    const data = await getHistory(skillName)
    commits.value = data
  } catch (e: any) {
    toast.error(e.message || '加载提交历史失败')
  } finally {
    isLoadingHistory.value = false
  }
}

// Toggle history panel
const toggleHistory = () => {
  showHistory.value = !showHistory.value
  if (showHistory.value && commits.value.length === 0) {
    loadHistory()
  }
}

// Revert to a specific commit
const confirmRevert = (commit: CommitRecord) => {
  revertTarget.value = commit
  showRevertDialog.value = true
}

const executeRevert = async () => {
  if (!revertTarget.value) return
  showRevertDialog.value = false

  try {
    await revertSkill(skillName, revertTarget.value.sha)
    toast.success(`已回退到 ${revertTarget.value.sha.slice(0, 7)}`)
    // Reload skill detail and current file
    await loadSkillDetail()
    if (selectedFilePath.value) {
      await loadFileContent(selectedFilePath.value)
    }
    await loadHistory()
  } catch (e: any) {
    toast.error(e.message || '回退失败')
  }
}

// Toggle folder
const toggleFolder = (path: string) => {
  if (expandedFolders.value.has(path)) {
    expandedFolders.value.delete(path)
  } else {
    expandedFolders.value.add(path)
  }
}

// Handle file tree click
const handleFileClick = (node: TreeNode) => {
  if (node.type === 'directory') {
    toggleFolder(node.path)
  } else {
    loadFileContent(node.path)
  }
}

// Format date
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadSkillDetail()
  window.addEventListener('keydown', handleEditorSearchShortcut)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEditorSearchShortcut)
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0 bg-background/80 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" class="rounded-full h-8 w-8" @click="router.push('/skills')">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-bold tracking-tight">{{ skillName }}</h1>
          <Badge v-if="skillDetail?.status" :variant="skillDetail?.status === 'ready' ? 'success' : 'pending'" class="text-[9px] h-5 uppercase tracking-widest">
            {{ skillDetail?.status }}
          </Badge>
          <!-- commit hash hidden from user -->
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Badge v-if="isDirty" variant="pending" class="text-[10px] h-5">未保存</Badge>
        <Button
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 text-xs font-bold"
          @click="toggleHistory"
          :class="showHistory ? 'bg-muted' : ''"
        >
          <History class="h-3.5 w-3.5" /> 历史
        </Button>
        <Button
          size="sm"
          class="h-8 gap-1.5 text-xs font-bold"
          :disabled="!isDirty || isSaving"
          @click="handleSave"
        >
          <Save v-if="!isSaving" class="h-3.5 w-3.5" />
          <Loader2 v-else class="h-3.5 w-3.5 animate-spin" />
          保存
        </Button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex flex-1 min-h-0 relative">
      <!-- Left Panel: File Tree -->
      <aside class="w-56 border-r border-border/50 flex flex-col shrink-0 bg-muted/10">
        <div class="p-3 border-b border-border/50">
          <h3 class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <FolderOpen class="h-3 w-3" /> 文件目录
          </h3>
        </div>
        <ScrollArea class="flex-1">
          <div v-if="isLoadingDetail" class="flex items-center justify-center py-8">
            <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <div v-else-if="fileTree.length === 0" class="flex flex-col items-center justify-center py-8 text-center px-4">
            <FolderOpen class="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p class="text-[10px] text-muted-foreground">暂无文件</p>
          </div>
          <div v-else class="py-1">
            <div
              v-for="row in visibleTreeRows"
              :key="row.node.path"
              class="flex items-center gap-2 py-1 pr-3 cursor-pointer transition-all text-xs font-medium group select-none"
              :style="{ paddingLeft: `${12 + row.depth * 16}px` }"
              :class="selectedFilePath === row.node.path ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'"
              @click="handleFileClick(row.node)"
            >
              <template v-if="row.node.type === 'directory'">
                <ChevronDown v-if="expandedFolders.has(row.node.path)" class="h-3 w-3 shrink-0 opacity-60" />
                <ChevronRight v-else class="h-3 w-3 shrink-0 opacity-60" />
                <Folder class="h-3.5 w-3.5 shrink-0 text-blue-500 fill-blue-500/20" />
              </template>
              <template v-else>
                <span class="h-3 w-3 shrink-0"></span>
                <component :is="getFileIcon(row.node.name)" class="h-3.5 w-3.5 shrink-0" :class="{
                  'text-primary-foreground': selectedFilePath === row.node.path,
                  'text-orange-400': row.node.name.endsWith('.md') && selectedFilePath !== row.node.path,
                  'text-blue-400': row.node.name.endsWith('.py') && selectedFilePath !== row.node.path,
                  'text-yellow-400': row.node.name.endsWith('.json') && selectedFilePath !== row.node.path,
                }" />
              </template>
              <span class="truncate">{{ row.node.name }}</span>
            </div>
          </div>
        </ScrollArea>
      </aside>

      <!-- Right Panel: Editor -->
      <main class="flex-1 flex flex-col min-w-0">
        <!-- Editor Tab Bar -->
        <div v-if="selectedFilePath" class="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/10 shrink-0">
          <component :is="getFileIcon(selectedFilePath)" class="h-3.5 w-3.5 text-muted-foreground" />
          <span class="text-xs font-mono text-muted-foreground">{{ selectedFilePath }}</span>
          <span v-if="isDirty" class="h-2 w-2 rounded-full bg-orange-500" title="未保存"></span>
          <Button
            variant="ghost"
            size="sm"
            class="ml-auto h-7 gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
            @click="openEditorSearch"
          >
            <Search class="h-3.5 w-3.5" />
            搜索
            <span class="text-[10px] text-muted-foreground/80">Ctrl/Cmd+F</span>
          </Button>
        </div>

        <!-- Editor Content -->
        <div class="flex-1 min-h-0">
          <div v-if="!selectedFilePath" class="flex flex-col items-center justify-center h-full text-center gap-3">
            <FileText class="h-12 w-12 text-muted-foreground/20" />
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground font-medium">选择一个文件开始编辑</p>
              <p class="text-xs text-muted-foreground/60">从左侧文件树中选择文件，内容将显示在此处</p>
            </div>
          </div>
          <div v-else-if="isLoadingFile" class="flex items-center justify-center h-full">
            <Loader2 class="h-5 w-5 animate-spin text-primary" />
          </div>
          <CodeEditor
            ref="codeEditorRef"
            v-else
            :model-value="fileContent"
            :language="editorLanguage"
            @update:model-value="handleContentChange"
            @save="handleSave"
          />
        </div>
      </main>

      <!-- History Panel (overlay, not squeezing editor) -->
      <aside
        v-if="showHistory"
        class="absolute right-0 top-0 bottom-0 w-72 border-l border-border/50 flex flex-col shrink-0 bg-background shadow-xl z-10 animate-in slide-in-from-right duration-200"
      >
        <div class="p-3 border-b border-border/50 flex items-center justify-between">
          <h3 class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <History class="h-3 w-3" /> 提交历史
          </h3>
          <Button variant="ghost" size="icon" class="h-6 w-6" @click="loadHistory" :disabled="isLoadingHistory">
            <RefreshCcw class="h-3 w-3" :class="isLoadingHistory ? 'animate-spin' : ''" />
          </Button>
        </div>
        <ScrollArea class="flex-1">
          <div v-if="isLoadingHistory" class="flex items-center justify-center py-8">
            <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <div v-else-if="commits.length === 0" class="flex flex-col items-center justify-center py-8 text-center px-4">
            <GitCommit class="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p class="text-[10px] text-muted-foreground">暂无提交记录</p>
          </div>
          <div v-else class="divide-y divide-border/30">
            <div
              v-for="commit in commits"
              :key="commit.sha"
              class="p-3 hover:bg-muted/30 transition-colors group"
            >
              <div class="flex items-start gap-2">
                <div class="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <GitCommit class="h-3 w-3 text-primary" />
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                  <p class="text-xs font-medium leading-snug line-clamp-2">{{ commit.message }}</p>
                  <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span class="font-mono bg-muted px-1 rounded">{{ commit.sha.slice(0, 7) }}</span>
                    <span class="flex items-center gap-0.5">
                      <User class="h-2.5 w-2.5" /> {{ commit.authorName }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 text-[9px] text-muted-foreground/70">
                    <Clock class="h-2.5 w-2.5" />
                    {{ formatDate(commit.createdAt) }}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 text-[10px] font-bold text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                    @click="confirmRevert(commit)"
                  >
                    <RotateCcw class="h-3 w-3 mr-1" /> 回退到此版本
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </div>

    <!-- Commit Message Dialog -->
    <Dialog v-model:open="showCommitDialog">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <GitCommit class="h-5 w-5 text-primary" /> 提交文件更改
          </DialogTitle>
          <DialogDescription>
            为本次更改添加提交说明（可选）
          </DialogDescription>
        </DialogHeader>
        <div class="py-4">
          <Input
            v-model="commitMessage"
            placeholder="描述你的更改..."
            class="font-mono text-sm"
            @keydown.enter="executeSave"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="showCommitDialog = false">取消</Button>
          <Button size="sm" @click="executeSave" :disabled="isSaving" class="gap-1.5">
            <Save class="h-3.5 w-3.5" /> 提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Revert Confirmation Dialog -->
    <Dialog v-model:open="showRevertDialog">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-orange-500">
            <RotateCcw class="h-5 w-5" /> 确认回退
          </DialogTitle>
          <DialogDescription>
            确定要将 <strong>{{ skillName }}</strong> 回退到以下版本吗？此操作会创建一个新的提交来恢复内容。
          </DialogDescription>
        </DialogHeader>
        <div v-if="revertTarget" class="py-4 space-y-2">
          <div class="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1">
            <p class="text-sm font-medium">{{ revertTarget.message }}</p>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span class="font-mono">{{ revertTarget.sha.slice(0, 7) }}</span>
              <span>{{ revertTarget.authorName }}</span>
              <span>{{ formatDate(revertTarget.createdAt) }}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="showRevertDialog = false">取消</Button>
          <Button variant="destructive" size="sm" @click="executeRevert" class="gap-1.5">
            <RotateCcw class="h-3.5 w-3.5" /> 确认回退
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
