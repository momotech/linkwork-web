<script setup lang="ts">
import { computed } from 'vue'
import { 
  Folder, FileCode, ChevronRight, ChevronDown, 
  FileText, FileJson, FileType, FileDiff
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'

// 定义接口，确保递归引用时类型安全
export interface FileNode {
  name: string
  type: 'file' | 'directory'
  children?: FileNode[]
  content?: string
  size?: string
}

const props = defineProps<{
  node: FileNode
  level: number
  expandedFolders: Set<string>
  selectedFile: FileNode | null
}>()

const emit = defineEmits(['toggle', 'select'])

const isOpen = computed(() => props.expandedFolders.has(props.node.name))

const getFileIcon = (name: string) => {
  if (name.endsWith('.py')) return FileCode
  if (name.endsWith('.md')) return FileText
  if (name.endsWith('.json')) return FileJson
  if (name.endsWith('.diff') || name.endsWith('.patch')) return FileDiff
  return FileType
}
</script>

<template>
  <div class="select-none">
    <!-- Row Item -->
    <div 
      :class="cn(
        'flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer transition-all text-xs font-bold group',
        selectedFile?.name === node.name ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-primary/10 text-muted-foreground hover:text-foreground'
      )"
      :style="{ paddingLeft: (level * 12 + 8) + 'px' }"
      @click="node.type === 'directory' ? emit('toggle', node) : emit('select', node)"
    >
      <!-- Directory Icon -->
      <template v-if="node.type === 'directory'">
        <ChevronDown v-if="isOpen" class="h-3 w-3 shrink-0 transition-transform opacity-60" />
        <ChevronRight v-else class="h-3 w-3 shrink-0 transition-transform opacity-60" />
        <Folder 
          class="h-3.5 w-3.5 shrink-0 transition-colors" 
          :class="selectedFile?.name === node.name ? 'text-primary-foreground' : 'text-blue-500 fill-blue-500/20'" 
        />
      </template>
      
      <!-- File Icon -->
      <template v-else>
        <component 
          :is="getFileIcon(node.name)" 
          class="h-3.5 w-3.5 shrink-0 transition-colors" 
          :class="[
            selectedFile?.name === node.name ? 'text-primary-foreground' : '',
            node.name.endsWith('.py') && selectedFile?.name !== node.name ? 'text-blue-400' : '',
            node.name.endsWith('.md') && selectedFile?.name !== node.name ? 'text-orange-400' : '',
            node.name.endsWith('.json') && selectedFile?.name !== node.name ? 'text-yellow-400' : '',
            !node.name.includes('.') && selectedFile?.name !== node.name ? 'text-zinc-400' : ''
          ]" 
        />
      </template>
      
      <span class="truncate tracking-tight">{{ node.name }}</span>
    </div>
    
    <!-- Recursive Children -->
    <div v-if="node.type === 'directory' && isOpen" class="mt-0.5">
      <FileTreeItem 
        v-for="child in node.children" 
        :key="child.name"
        :node="child"
        :level="level + 1"
        :expanded-folders="expandedFolders"
        :selected-file="selectedFile"
        @toggle="(n) => emit('toggle', n)"
        @select="(f) => emit('select', f)"
      />
    </div>
  </div>
</template>