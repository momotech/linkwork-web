<script setup lang="ts">
import { ref } from 'vue'
import {
  ResizableHandle, ResizablePanel, ResizablePanelGroup
} from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Folder, FileCode, Download, ExternalLink,
  FileText, FileJson, FileType, Search, Check, Copy, FolderGit2, FileDiff
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'vue-sonner'
import FileTreeItem, { type FileNode } from './FileTreeItem.vue'
import CodeContainer from './CodeContainer.vue'

const mockFiles: FileNode[] = [
  {
    name: 'src',
    type: 'directory',
    children: [
      {
        name: 'assets',
        type: 'directory',
        children: [
          { name: 'logo.png', type: 'file', content: '[Binary Image Data]', size: '45KB' },
          { name: 'theme.css', type: 'file', content: `:root {\n  --primary: #6366f1;\n  --bg: #000;\n}`, size: '2KB' }
        ]
      },
      { name: 'main.py', type: 'file', content: `import os
import time

def main():
    print("LinkWork Agent starting...")
    # Initialize core systems
    time.sleep(1)
    print("Initialization complete.")

if __name__ == "__main__":
    main()`, size: '1.2KB' },
      { name: 'utils.py', type: 'file', content: `def format_bytes(size):
    """Format bytes to human readable string"""
    power = 2**10
    n = 0
    power_labels = {0 : '', 1: 'K', 2: 'M', 3: 'G'}
    while size > power:
        size /= power
        n += 1
    return f"{size:.2f} {power_labels[n]}B"`, size: '0.8KB' },
      {
        name: 'core',
        type: 'directory',
        children: [
          { name: 'agent.py', type: 'file', content: `class AIWorkerAgent:
    def __init__(self):
        self.model = "claude-3.5"
        self.memory = []

    def execute(self, task):
        self.memory.append(task)
        return f"Executing {task}"`, size: '2.4KB' }
        ]
      }
    ]
  },
  {
    name: 'patches',
    type: 'directory',
    children: [
      { name: 'fix-login.diff', type: 'file', content: `diff --git a/src/auth.py b/src/auth.py
index 83c5a9..20a1c4 100644
--- a/src/auth.py
+++ b/src/auth.py
@@ -12,7 +12,7 @@ def login(user, password):
-    if user.password == password:
+    if check_password_hash(user.password, password):
         return True
     return False`, size: '0.4KB' }
    ]
  },
  { name: 'requirements.txt', type: 'file', content: `anthropic>=0.40.0
requests>=2.31.0
pydantic>=2.5.0
httpx>=0.26.0`, size: '0.1KB' },
  { name: 'README.md', type: 'file', content: `# LinkWork Agent Project

This workspace contains the source code for the AI employee execution environment.

## Setup
1. Install dependencies
2. Run main.py`, size: '0.5KB' },
  { name: 'config.json', type: 'file', content: `{
  "version": "1.0.0",
  "environment": "production",
  "debug": false,
  "features": ["auth", "logging"]
}`, size: '0.2KB' }
]

const selectedFile = ref<FileNode | null>(mockFiles[0].children![1]) // Default to main.py
const expandedFolders = ref<Set<string>>(new Set(['src', 'core', 'patches']))

const toggleFolder = (node: FileNode) => {
  if (expandedFolders.value.has(node.name)) {
    expandedFolders.value.delete(node.name)
  } else {
    expandedFolders.value.add(node.name)
  }
}

const selectFile = (file: FileNode) => {
  if (file.type === 'file') {
    selectedFile.value = file
  }
}

const getFileIcon = (name: string) => {
  if (name.endsWith('.py')) return FileCode
  if (name.endsWith('.md')) return FileText
  if (name.endsWith('.json')) return FileJson
  if (name.endsWith('.diff')) return FileDiff
  return FileType
}

const getLanguage = (name: string) => {
  if (name.endsWith('.py')) return 'python'
  if (name.endsWith('.md')) return 'markdown'
  if (name.endsWith('.json')) return 'json'
  if (name.endsWith('.diff')) return 'diff'
  if (name.endsWith('.css')) return 'css'
  if (name.endsWith('.js')) return 'javascript'
  if (name.endsWith('.ts')) return 'typescript'
  if (name.endsWith('.vue')) return 'vue'
  return 'text'
}

const copied = ref(false)
const copyContent = () => {
  if (selectedFile.value?.content) {
    navigator.clipboard.writeText(selectedFile.value.content)
    copied.value = true
    toast.success('代码已复制')
    setTimeout(() => copied.value = false, 2000)
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 w-full bg-background overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1 w-full bg-background">
      <!-- Left: File Tree (25% Initial) -->
      <ResizablePanel :default-size="25" :min-size="20">
        <div class="flex flex-col h-full border-r border-border/50 bg-background overflow-hidden">
          <!-- Search Header -->
          <div class="p-2 border-b border-border/50 bg-muted/10 shrink-0">
            <div class="relative">
              <Search class="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="搜索文件..." class="pl-7 h-7 text-[10px] bg-background border-border/50 font-bold uppercase tracking-wider" />
            </div>
          </div>
          <!-- Tree Area -->
          <div class="flex-1 min-h-0 bg-muted/5 overflow-hidden">
            <ScrollArea class="h-full w-full">
              <div class="p-1 space-y-0.5">
                <FileTreeItem
                    v-for="node in mockFiles"
                    :key="node.name"
                    :node="node"
                    :level="0"
                    :expanded-folders="expandedFolders"
                    :selected-file="selectedFile"
                    @toggle="toggleFolder"
                    @select="selectFile"
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle with-handle class="bg-border/50" />

      <!-- Right: Preview Area -->
      <ResizablePanel :default-size="75">
        <div class="flex flex-col h-full bg-background overflow-hidden">
          <header v-if="selectedFile" class="h-9 border-b border-border/50 bg-muted/10 flex items-center justify-between px-4 shrink-0">
            <div class="flex items-center gap-2">
              <component :is="getFileIcon(selectedFile.name)" class="h-3.5 w-3.5 text-primary/60" />
              <span class="text-xs font-mono font-bold text-foreground">{{ selectedFile.name }}</span>
              <Badge variant="outline" class="text-[9px] h-3.5 px-1 font-mono text-muted-foreground border-muted-foreground/20">{{ selectedFile.size }}</Badge>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground hover:text-foreground" @click="copyContent">
                <Check v-if="copied" class="h-3.5 w-3.5 text-emerald-500" />
                <Copy v-else class="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground hover:text-foreground">
                <Download class="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          <div v-if="selectedFile" class="flex-1 min-h-0 bg-background flex flex-col p-2 overflow-hidden">
            <div class="flex-1 min-h-0">
              <CodeContainer
                  v-if="selectedFile.content && selectedFile.content !== '[Binary Image Data]'"
                  :code="selectedFile.content"
                  :lang="getLanguage(selectedFile.name)"
                  class="h-full"
              />
              <div v-else-if="selectedFile.content === '[Binary Image Data]'" class="h-full flex items-center justify-center bg-muted/5 rounded-lg border border-border/50 border-dashed">
                <div class="text-center space-y-4">
                  <div class="h-16 w-16 mx-auto rounded-xl bg-background border border-border/50 shadow-sm flex items-center justify-center">
                    <FileType class="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">二进制文件无法预览</p>
                  <Button size="sm" variant="outline" class="h-7 text-[10px]">
                    <Download class="h-3 w-3 mr-1.5" />
                    下载文件
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-30 select-none bg-background">
            <div class="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center border border-dashed border-border/50">
              <FolderGit2 class="h-8 w-8" />
            </div>
            <p class="text-[10px] font-bold uppercase tracking-[0.2em]">选择一个文件进行预览</p>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
