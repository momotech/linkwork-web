<script setup lang="ts">
import { ref } from 'vue'
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UploadCloud, X, File, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { ConflictInfo, ConflictPolicy, FileItem, SpaceType } from '@/api/fileManager'

const props = defineProps<{
  open: boolean
  spaceType: SpaceType
  workstationId?: string
  parentId?: string | null
}>()

const emit = defineEmits(['update:open', 'upload'])

const fileInputRef = ref<HTMLInputElement>()
const isOverDropZone = ref(false)
let dragCounter = 0

interface UploadFile {
  name: string
  size: string
  progress: number
  status: 'uploading' | 'success' | 'error' | 'conflict'
  fileItem?: FileItem
  error?: string
  file?: File
  previewUrl?: string
  isImage: boolean
  conflictInfo?: ConflictInfo
}

const files = ref<UploadFile[]>([])

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 判断是否为图片文件
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

// 创建本地预览 URL
function createPreviewUrl(file: File): string | undefined {
  if (isImageFile(file)) {
    return URL.createObjectURL(file)
  }
  return undefined
}

const doUpload = (file: File, conflictPolicy?: ConflictPolicy): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('spaceType', props.spaceType)
  if (props.workstationId) {
    formData.append('workstationId', props.workstationId)
  }
  if (props.parentId) {
    formData.append('parentId', props.parentId)
  }
  if (conflictPolicy) {
    formData.append('conflictPolicy', conflictPolicy)
  }

  const fileIndex = files.value.findIndex(f => f.file === file)

  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && fileIndex >= 0 && files.value[fileIndex]) {
        files.value[fileIndex].progress = Math.round((e.loaded / e.total) * 100)
      }
    }
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText))
      } catch {
        reject(new Error(`上传失败: ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.open('POST', '/api/v1/files/upload')
    xhr.send(formData)
  })
}

const uploadFile = async (fileIndex: number, file: File) => {
  try {
    const response = await doUpload(file)

    if (!files.value[fileIndex]) return

    if (response.code === 40901) {
      files.value[fileIndex].status = 'conflict'
      files.value[fileIndex].progress = 100
      files.value[fileIndex].conflictInfo = response.data as ConflictInfo
      return
    }

    if (response.code === 0) {
      files.value[fileIndex].status = 'success'
      files.value[fileIndex].progress = 100
      files.value[fileIndex].fileItem = response.data as FileItem
    } else {
      throw new Error(response.msg || '上传失败')
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error, '上传失败')
    if (files.value[fileIndex]) {
      files.value[fileIndex].status = 'error'
      files.value[fileIndex].error = message
    }
    toast.error(`${file.name} 上传失败: ${message}`)
  }
}

const resolveConflict = async (index: number, policy: ConflictPolicy) => {
  const entry = files.value[index]
  if (!entry?.file) return

  entry.status = 'uploading'
  entry.progress = 0
  entry.conflictInfo = undefined

  try {
    const response = await doUpload(entry.file, policy)
    if (!files.value[index]) return

    if (response.code === 0) {
      files.value[index].status = 'success'
      files.value[index].progress = 100
      files.value[index].fileItem = response.data as FileItem
      toast.success(policy === 'OVERWRITE' ? `${entry.name} 已覆盖` : `${entry.name} 已重命名上传`)
    } else {
      throw new Error(response.msg || '上传失败')
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error, '上传失败')
    if (files.value[index]) {
      files.value[index].status = 'error'
      files.value[index].error = message
    }
    toast.error(`${entry.name} 上传失败: ${message}`)
  }
}

const skipConflict = (index: number) => {
  removeFile(index)
}

const processFiles = (fileList: File[]) => {
  fileList.forEach(file => {
    // 检查文件大小 (100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error(`${file.name} 超过 100MB 限制`)
      return
    }

    const fileObj: UploadFile = {
      name: file.name,
      size: formatSize(file.size),
      progress: 0,
      status: 'uploading',
      file: file,
      isImage: isImageFile(file),
      previewUrl: createPreviewUrl(file)
    }
    files.value.push(fileObj)
    
    // 获取索引以便在回调中更新
    const fileIndex = files.value.length - 1
    
    // 开始上传
    uploadFile(fileIndex, file)
  })
}

const onDropZoneDragEnter = (e: DragEvent) => {
  e.preventDefault()
  dragCounter++
  isOverDropZone.value = true
}
const onDropZoneDragOver = (e: DragEvent) => {
  e.preventDefault()
}
const onDropZoneDragLeave = () => {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isOverDropZone.value = false
  }
}
const onDropZoneDrop = (e: DragEvent) => {
  e.preventDefault()
  dragCounter = 0
  isOverDropZone.value = false
  if (e.dataTransfer?.files) {
    processFiles(Array.from(e.dataTransfer.files))
  }
}

const onFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) {
    processFiles(Array.from(input.files))
  }
}

const removeFile = (index: number) => {
  // 释放 blob URL 避免内存泄漏
  const file = files.value[index]
  if (file.previewUrl) {
    URL.revokeObjectURL(file.previewUrl)
  }
  files.value.splice(index, 1)
}

const handleUpload = () => {
  const successFiles = files.value
    .filter(f => f.status === 'success' && f.fileItem)
    .map(f => f.fileItem!)
  
  // 释放所有预览 URL
  files.value.forEach(f => {
    if (f.previewUrl) {
      URL.revokeObjectURL(f.previewUrl)
    }
  })
  
  emit('upload', successFiles)
  emit('update:open', false)
  files.value = [] 
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const isUploading = () => files.value.some(f => f.status === 'uploading')
const hasConflict = () => files.value.some(f => f.status === 'conflict')
const hasSuccess = () => files.value.some(f => f.status === 'success')

defineExpose({ processFiles })
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>上传附件</DialogTitle>
        <DialogDescription>
          支持拖拽上传代码、日志或数据文件。
        </DialogDescription>
      </DialogHeader>
      
      <div 
        class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer group"
        :class="isOverDropZone ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'"
        @click="triggerFileInput"
        @dragenter="onDropZoneDragEnter"
        @dragover="onDropZoneDragOver"
        @dragleave="onDropZoneDragLeave"
        @drop="onDropZoneDrop"
      >
        <input 
          type="file" 
          ref="fileInputRef" 
          class="hidden" 
          multiple 
          @change="onFileSelect"
        />
        <div class="flex flex-col items-center gap-2">
          <div class="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UploadCloud class="h-6 w-6 text-muted-foreground" :class="{ 'text-primary': isOverDropZone }" />
          </div>
          <p class="text-sm font-medium">
            <span class="text-primary">点击上传</span> 或拖拽文件到此处
          </p>
          <p class="text-xs text-muted-foreground">支持单个文件最大 100MB</p>
        </div>
      </div>

      <ScrollArea class="h-[200px] w-full rounded-md border p-4" v-if="files.length > 0">
        <div class="space-y-4">
          <div v-for="(file, index) in files" :key="index" class="group animate-in slide-in-from-left-2 duration-300">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border">
                <img 
                  v-if="file.isImage && file.previewUrl" 
                  :src="file.previewUrl" 
                  :alt="file.name"
                  class="h-full w-full object-cover"
                  @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
                />
                <File v-if="!file.isImage || !file.previewUrl" class="h-4 w-4 text-muted-foreground" />
              </div>
              <div class="flex-1 min-w-0 space-y-1">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium truncate text-foreground">{{ file.name }}</p>
                  <button @click.stop="removeFile(index)" class="opacity-0 group-hover:opacity-100 transition-opacity">
                    <X class="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <Progress :model-value="file.progress" class="h-1.5 flex-1" :class="{'bg-green-100': file.status === 'success', 'bg-amber-100': file.status === 'conflict'}" />
                  <span class="text-[10px] text-muted-foreground w-8 text-right font-mono">{{ Math.round(file.progress) }}%</span>
                </div>
              </div>
              <div class="shrink-0">
                <CheckCircle2 v-if="file.status === 'success'" class="h-4 w-4 text-green-500" />
                <AlertCircle v-else-if="file.status === 'error'" class="h-4 w-4 text-red-500" :title="file.error" />
                <AlertCircle v-else-if="file.status === 'conflict'" class="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <div v-if="file.status === 'conflict'" class="mt-1.5 pl-[52px] flex items-center gap-2">
              <span class="text-xs text-amber-600">同名文件已存在</span>
              <Button size="sm" variant="outline" class="h-6 text-xs px-2" @click.stop="resolveConflict(index, 'OVERWRITE')">覆盖</Button>
              <Button size="sm" variant="outline" class="h-6 text-xs px-2" @click.stop="resolveConflict(index, 'RENAME')">重命名</Button>
              <Button size="sm" variant="ghost" class="h-6 text-xs px-2 text-muted-foreground" @click.stop="skipConflict(index)">跳过</Button>
            </div>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">取消</Button>
        <Button @click="handleUpload" :disabled="files.length === 0 || isUploading() || hasConflict() || !hasSuccess()">
          确认添加
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>