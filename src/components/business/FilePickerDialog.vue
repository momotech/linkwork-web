<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  ChevronDown, ChevronRight, File, Folder, FolderOpen, HardDrive, Loader2, Server, Search,
  UploadCloud, X, CheckCircle2, AlertCircle, Check, FileText, FileImage, Code2, Sheet, Archive, SlidersHorizontal
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  fileManagerApi,
  type FileNodeItem,
  type FileItem,
  type SpaceType,
  type ConflictPolicy,
  type ConflictInfo
} from '@/api/fileManager'

type PickerMode = 'select' | 'upload'

interface SpaceOption {
  key: string
  label: string
  spaceType: SpaceType
  workstationId?: string
}

const props = defineProps<{
  open: boolean
  mode: PickerMode
  currentRoleId?: string
  currentRoleName?: string
  initialSpaceType?: SpaceType
  initialWorkstationId?: string
  initialParentId?: string | null
  initialParentName?: string
  lockSpace?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [files: FileNodeItem[]]
  upload: [files: FileItem[]]
}>()

const buildSpaceKey = (spaceType: SpaceType, workstationId?: string) => {
  return spaceType === 'WORKSTATION' ? `WS:${workstationId || ''}` : 'USER'
}

// --- Spaces ---
const activeSpaceKey = ref('USER')

const spaces = computed<SpaceOption[]>(() => {
  if (props.lockSpace && props.initialSpaceType) {
    const workstationId = props.initialSpaceType === 'WORKSTATION'
      ? (props.initialWorkstationId || props.currentRoleId)
      : undefined
    return [{
      key: buildSpaceKey(props.initialSpaceType, workstationId),
      label: props.initialSpaceType === 'USER' ? '我的空间' : (props.currentRoleName || '当前岗位'),
      spaceType: props.initialSpaceType,
      workstationId
    }]
  }
  const list: SpaceOption[] = [
    { key: 'USER', label: '我的空间', spaceType: 'USER' }
  ]
  if (props.currentRoleId) {
    list.push({
      key: `WS:${props.currentRoleId}`,
      label: props.currentRoleName || '当前岗位',
      spaceType: 'WORKSTATION',
      workstationId: props.currentRoleId
    })
  }
  return list
})

const activeSpace = computed(() =>
  spaces.value.find(s => s.key === activeSpaceKey.value) || spaces.value[0]
)

const dialogTitle = computed(() => props.mode === 'select' ? '选择文件' : '上传文件')
const dialogDesc = computed(() =>
  props.mode === 'select'
    ? '勾选需要引用的文件，支持跨空间多选'
    : '选择目标目录后上传文件'
)

// --- Per-space tree cache (prevents reload flicker on switch) ---
interface SpaceTreeCache {
  rootNodes: FileNodeItem[]
  childrenMap: Map<string, FileNodeItem[]>
  expandedIds: Set<string>
}

const treeCacheMap = ref<Map<string, SpaceTreeCache>>(new Map())
const loadingIds = ref<Set<string>>(new Set())
const treeLoading = ref(false)

const currentCache = computed<SpaceTreeCache>(() => {
  const key = activeSpaceKey.value
  if (!treeCacheMap.value.has(key)) {
    treeCacheMap.value.set(key, {
      rootNodes: [],
      childrenMap: new Map(),
      expandedIds: new Set()
    })
  }
  return treeCacheMap.value.get(key)!
})

// --- Select mode: cross-space selection ---
const selectedNodesMap = ref<Map<string, FileNodeItem>>(new Map())

const selectedCount = computed(() => selectedNodesMap.value.size)

const toggleSelect = (node: FileNodeItem) => {
  if (node.entryType !== 'FILE') return
  const next = new Map(selectedNodesMap.value)
  if (next.has(node.nodeId)) {
    next.delete(node.nodeId)
  } else {
    next.set(node.nodeId, node)
  }
  selectedNodesMap.value = next
}

const isNodeSelected = (nodeId: string) => selectedNodesMap.value.has(nodeId)

// --- Upload mode: directory selection ---
const selectedUploadDirId = ref<string | null>(null)

const selectUploadDir = (node: FileNodeItem) => {
  if (node.entryType !== 'DIR') return
  selectedUploadDirId.value =
    selectedUploadDirId.value === node.nodeId ? null : node.nodeId
}

const selectedUploadDirName = computed(() => {
  if (!selectedUploadDirId.value) return '根目录'
  const cache = currentCache.value
  const findName = (nodes: FileNodeItem[]): string | null => {
    for (const n of nodes) {
      if (n.nodeId === selectedUploadDirId.value) return n.name
      if (n.entryType === 'DIR') {
        const children = cache.childrenMap.get(n.nodeId)
        if (children) {
          const found = findName(children)
          if (found) return found
        }
      }
    }
    return null
  }
  return findName(cache.rootNodes) || props.initialParentName || '根目录'
})

// --- Tree rows ---
interface TreeRow { node: FileNodeItem; depth: number }

const treeRows = computed<TreeRow[]>(() => {
  const cache = currentCache.value
  const rows: TreeRow[] = []
  const walk = (nodes: FileNodeItem[], depth: number) => {
    for (const n of nodes) {
      rows.push({ node: n, depth })
      if (n.entryType === 'DIR' && cache.expandedIds.has(n.nodeId)) {
        walk(cache.childrenMap.get(n.nodeId) || [], depth + 1)
      }
    }
  }
  walk(cache.rootNodes, 0)
  return rows
})

const searchKeyword = ref('')
const columnFilters = ref({
  name: '',
  modified: '',
  size: 'ALL',
  kind: ''
})

const searchedTreeRows = computed<TreeRow[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return treeRows.value
  const rowMap = new Map<string, TreeRow>(treeRows.value.map((row) => [row.node.nodeId, row]))
  const includeNodeIds = new Set<string>()

  for (const row of treeRows.value) {
    if (!row.node.name.toLowerCase().includes(keyword)) continue
    let currentId: string | null = row.node.nodeId
    while (currentId) {
      if (includeNodeIds.has(currentId)) break
      includeNodeIds.add(currentId)
      const parentId: string | null = rowMap.get(currentId)?.node.parentId || null
      currentId = parentId
    }
  }
  return treeRows.value.filter((row) => includeNodeIds.has(row.node.nodeId))
})

const displayedTreeRows = computed<TreeRow[]>(() => {
  const nameFilter = columnFilters.value.name.trim().toLowerCase()
  const modifiedFilter = columnFilters.value.modified.trim().toLowerCase()
  const sizeFilter = columnFilters.value.size
  const kindFilter = columnFilters.value.kind

  return searchedTreeRows.value.filter((row) => {
    const node = row.node
    if (nameFilter && !node.name.toLowerCase().includes(nameFilter)) return false

    if (modifiedFilter) {
      const modifiedText = formatModifiedAt(node.updatedAt).toLowerCase()
      if (!modifiedText.includes(modifiedFilter)) return false
    }

    if (sizeFilter !== 'ALL') {
      if (node.entryType !== 'FILE') return false
      const size = node.fileSize || 0
      if (sizeFilter === 'EMPTY' && size !== 0) return false
      if (sizeFilter === 'SMALL' && !(size > 0 && size < 1024 * 1024)) return false
      if (sizeFilter === 'MEDIUM' && !(size >= 1024 * 1024 && size <= 10 * 1024 * 1024)) return false
      if (sizeFilter === 'LARGE' && !(size > 10 * 1024 * 1024)) return false
    }

    if (kindFilter && getFileKind(node) !== kindFilter) return false
    return true
  })
})

const isSearchMatched = (node: FileNodeItem) => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return false
  return node.name.toLowerCase().includes(keyword)
}

const hasNameFilter = computed(() => columnFilters.value.name.trim().length > 0)
const hasModifiedFilter = computed(() => columnFilters.value.modified.trim().length > 0)
const hasSizeFilter = computed(() => columnFilters.value.size !== 'ALL')
const hasKindFilter = computed(() => columnFilters.value.kind.length > 0)

const kindFilterOptions = computed(() => {
  const options = Array.from(new Set(treeRows.value.map((row) => getFileKind(row.node))))
  return options.sort((a, b) => a.localeCompare(b))
})

const resetColumnFilters = () => {
  columnFilters.value = {
    name: '',
    modified: '',
    size: 'ALL',
    kind: ''
  }
}

// --- Tree loading ---
const fetchTree = async (spaceKey?: string) => {
  const key = spaceKey || activeSpaceKey.value
  const sp = spaces.value.find(s => s.key === key) || spaces.value[0]

  if (treeCacheMap.value.has(key) && treeCacheMap.value.get(key)!.rootNodes.length > 0) {
    return
  }

  treeLoading.value = true
  try {
    const nodes = await fileManagerApi.listTree(
      sp.spaceType,
      sp.spaceType === 'WORKSTATION' ? sp.workstationId : undefined
    )
    treeCacheMap.value.set(key, {
      rootNodes: nodes,
      childrenMap: new Map(),
      expandedIds: new Set()
    })
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : '加载文件树失败')
  } finally {
    treeLoading.value = false
  }
}

const loadChildren = async (nodeId: string) => {
  const cache = currentCache.value
  if (cache.childrenMap.has(nodeId)) return
  const sp = activeSpace.value
  loadingIds.value = new Set([...loadingIds.value, nodeId])
  try {
    const children = await fileManagerApi.listTree(
      sp.spaceType,
      sp.spaceType === 'WORKSTATION' ? sp.workstationId : undefined,
      nodeId
    )
    cache.childrenMap.set(nodeId, children)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : '加载子目录失败')
  } finally {
    const next = new Set(loadingIds.value)
    next.delete(nodeId)
    loadingIds.value = next
  }
}

const toggleDir = async (node: FileNodeItem) => {
  if (node.entryType !== 'DIR') return
  const cache = currentCache.value
  const next = new Set(cache.expandedIds)
  if (next.has(node.nodeId)) {
    next.delete(node.nodeId)
  } else {
    next.add(node.nodeId)
    await loadChildren(node.nodeId)
  }
  cache.expandedIds = next
}

const switchSpace = async (key: string) => {
  if (key === activeSpaceKey.value) return
  activeSpaceKey.value = key
  searchKeyword.value = ''
  resetColumnFilters()
  await fetchTree(key)
}

const refreshCurrentTree = async () => {
  const key = activeSpaceKey.value
  treeCacheMap.value.delete(key)
  await fetchTree(key)
}

// --- Select confirm ---
const confirmSelect = () => {
  emit('select', Array.from(selectedNodesMap.value.values()))
  emit('update:open', false)
}

// --- Upload mode ---
interface UploadEntry {
  name: string
  size: string
  progress: number
  status: 'uploading' | 'success' | 'error' | 'conflict'
  fileItem?: FileItem
  error?: string
  file?: globalThis.File
  isImage: boolean
  previewUrl?: string
  conflictInfo?: ConflictInfo
}

const uploadFiles = ref<UploadEntry[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const isOverDropZone = ref(false)
let dragCounter = 0

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const doUpload = (file: globalThis.File, conflictPolicy?: ConflictPolicy): Promise<any> => {
  const sp = activeSpace.value
  const formData = new FormData()
  formData.append('file', file)
  formData.append('spaceType', sp.spaceType)
  if (sp.workstationId) formData.append('workstationId', sp.workstationId)
  if (selectedUploadDirId.value) formData.append('parentId', selectedUploadDirId.value)
  if (conflictPolicy) formData.append('conflictPolicy', conflictPolicy)

  const idx = uploadFiles.value.findIndex(f => f.file === file)
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && idx >= 0 && uploadFiles.value[idx]) {
        uploadFiles.value[idx].progress = Math.round((e.loaded / e.total) * 100)
      }
    }
    xhr.onload = () => {
      try { resolve(JSON.parse(xhr.responseText)) }
      catch { reject(new Error(`上传失败: ${xhr.status}`)) }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.open('POST', '/api/v1/files/upload')
    xhr.send(formData)
  })
}

const uploadSingle = async (idx: number, file: globalThis.File) => {
  try {
    const resp = await doUpload(file)
    if (!uploadFiles.value[idx]) return
    if (resp.code === 40901) {
      uploadFiles.value[idx].status = 'conflict'
      uploadFiles.value[idx].progress = 100
      uploadFiles.value[idx].conflictInfo = resp.data as ConflictInfo
      return
    }
    if (resp.code === 0) {
      uploadFiles.value[idx].status = 'success'
      uploadFiles.value[idx].progress = 100
      uploadFiles.value[idx].fileItem = resp.data as FileItem
    } else {
      throw new Error(resp.msg || '上传失败')
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '上传失败'
    if (uploadFiles.value[idx]) {
      uploadFiles.value[idx].status = 'error'
      uploadFiles.value[idx].error = msg
    }
    toast.error(`${file.name}: ${msg}`)
  }
}

const processFiles = (fileList: globalThis.File[]) => {
  fileList.forEach(file => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error(`${file.name} 超过 100MB 限制`)
      return
    }
    const entry: UploadEntry = {
      name: file.name,
      size: formatSize(file.size),
      progress: 0,
      status: 'uploading',
      file,
      isImage: file.type.startsWith('image/'),
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }
    uploadFiles.value.push(entry)
    uploadSingle(uploadFiles.value.length - 1, file)
  })
}

const resolveConflict = async (idx: number, policy: ConflictPolicy) => {
  const entry = uploadFiles.value[idx]
  if (!entry?.file) return
  entry.status = 'uploading'
  entry.progress = 0
  entry.conflictInfo = undefined
  try {
    const resp = await doUpload(entry.file, policy)
    if (!uploadFiles.value[idx]) return
    if (resp.code === 0) {
      uploadFiles.value[idx].status = 'success'
      uploadFiles.value[idx].progress = 100
      uploadFiles.value[idx].fileItem = resp.data as FileItem
      toast.success(policy === 'OVERWRITE' ? `${entry.name} 已覆盖` : `${entry.name} 已重命名上传`)
    } else { throw new Error(resp.msg || '上传失败') }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '上传失败'
    if (uploadFiles.value[idx]) { uploadFiles.value[idx].status = 'error'; uploadFiles.value[idx].error = msg }
    toast.error(`${entry.name}: ${msg}`)
  }
}

const removeUploadFile = (idx: number) => {
  const f = uploadFiles.value[idx]
  if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
  uploadFiles.value.splice(idx, 1)
}

const confirmUpload = () => {
  const items = uploadFiles.value
    .filter(f => f.status === 'success' && f.fileItem)
    .map(f => f.fileItem!)
  uploadFiles.value.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
  emit('upload', items)
  emit('update:open', false)
  uploadFiles.value = []
}

const isUploading = () => uploadFiles.value.some(f => f.status === 'uploading')
const hasConflict = () => uploadFiles.value.some(f => f.status === 'conflict')
const hasSuccess = () => uploadFiles.value.some(f => f.status === 'success')

const onDropEnter = (e: DragEvent) => { e.preventDefault(); dragCounter++; isOverDropZone.value = true }
const onDropOver = (e: DragEvent) => { e.preventDefault() }
const onDropLeave = () => { dragCounter--; if (dragCounter <= 0) { dragCounter = 0; isOverDropZone.value = false } }
const onDrop = (e: DragEvent) => {
  e.preventDefault(); dragCounter = 0; isOverDropZone.value = false
  if (e.dataTransfer?.files) processFiles(Array.from(e.dataTransfer.files))
}
const onFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) processFiles(Array.from(input.files))
  input.value = ''
}

const revokeAllPreviews = () => {
  uploadFiles.value.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
}

watch(() => props.open, async (open) => {
  if (open) {
    revokeAllPreviews()
    selectedNodesMap.value = new Map()
    selectedUploadDirId.value = props.initialParentId ?? null
    uploadFiles.value = []
    treeCacheMap.value = new Map()
    if (props.initialSpaceType) {
      activeSpaceKey.value = buildSpaceKey(
        props.initialSpaceType,
        props.initialSpaceType === 'WORKSTATION'
          ? (props.initialWorkstationId || props.currentRoleId)
          : undefined
      )
    } else {
      activeSpaceKey.value = 'USER'
    }
    searchKeyword.value = ''
    await fetchTree()
  } else {
    revokeAllPreviews()
    uploadFiles.value = []
  }
})

defineExpose({ processFiles })

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const formatModifiedAt = (timestamp?: string) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '-'
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

const getExt = (name: string) => {
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return ''
  return name.slice(idx + 1).toLowerCase()
}

const getFileKind = (node: FileNodeItem) => {
  if (node.entryType === 'DIR') return '文件夹'
  if (node.fileType && node.fileType.trim()) return node.fileType.trim().toUpperCase()
  const ext = getExt(node.name)
  return ext ? ext.toUpperCase() : '文件'
}

const getNodeIcon = (name: string, entryType: 'DIR' | 'FILE') => {
  if (entryType === 'DIR') return Folder
  const ext = getExt(name)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return FileImage
  if (['xls', 'xlsx', 'csv'].includes(ext)) return Sheet
  if (['go', 'py', 'js', 'ts', 'tsx', 'java', 'sh', 'sql', 'html', 'css', 'vue', 'json', 'yml', 'yaml', 'xml'].includes(ext)) return Code2
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive
  if (['md', 'markdown', 'pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return FileText
  return File
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="w-[min(92vw,980px)] max-w-none h-[min(78vh,660px)] p-0 gap-0 overflow-hidden flex flex-col">
      <DialogHeader class="h-16 px-4 py-0 shrink-0 border-b flex flex-col justify-center">
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription>{{ dialogDesc }}</DialogDescription>
      </DialogHeader>

      <div class="flex flex-1 min-h-0 flex-col bg-background">
        <div class="h-10 shrink-0 border-b px-4 bg-muted/20 flex items-center gap-3">
          <div class="min-w-0 flex items-center gap-3">
            <Tabs :model-value="activeSpaceKey" @update:model-value="(value) => switchSpace(String(value))">
              <TabsList class="h-8 bg-transparent p-0 gap-1">
                <TabsTrigger
                  v-for="sp in spaces"
                  :key="sp.key"
                  :value="sp.key"
                  class="min-w-[140px] h-7 justify-center gap-2 rounded-md border text-xs font-medium transition-colors"
                  :class="activeSpaceKey === sp.key
                    ? 'bg-secondary text-secondary-foreground font-bold border-border/60'
                    : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'"
                >
                  <HardDrive v-if="sp.spaceType === 'USER'" class="h-3.5 w-3.5 shrink-0 transition-colors" :class="activeSpaceKey === sp.key ? 'text-primary' : ''" />
                  <Server v-else class="h-3.5 w-3.5 shrink-0 transition-colors" :class="activeSpaceKey === sp.key ? 'text-primary' : ''" />
                  <span class="truncate">{{ sp.label }}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div v-if="mode === 'select'" class="relative w-[300px] max-w-[40vw] ml-1 shrink-0">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="searchKeyword"
                placeholder="搜索文件名..."
                class="h-8 pl-9 pr-9 text-sm"
              />
              <button
                v-if="searchKeyword.trim()"
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                @click="searchKeyword = ''"
              >
                清空
              </button>
            </div>
          </div>
        </div>

        <div v-if="mode === 'upload'" class="shrink-0 mt-3 px-4">
          <div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>上传到</span>
            <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/5 border border-primary/20 text-primary text-xs font-medium">
              <Folder class="h-3 w-3 shrink-0" />
              <span class="truncate max-w-[240px]">{{ selectedUploadDirName }}</span>
            </div>
          </div>
          <div
            class="border-2 border-dashed rounded-lg min-h-[104px] px-4 py-4 text-center cursor-pointer transition-colors duration-150 flex items-center justify-center"
            :class="isOverDropZone ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'"
            @click="fileInputRef?.click()"
            @dragenter="onDropEnter"
            @dragover="onDropOver"
            @dragleave="onDropLeave"
            @drop="onDrop"
          >
            <input ref="fileInputRef" type="file" class="hidden" multiple @change="onFileSelect" />
            <div class="flex items-center justify-center gap-3">
              <UploadCloud class="h-5 w-5 text-muted-foreground" :class="{ 'text-primary': isOverDropZone }" />
              <p class="text-xs"><span class="text-primary font-medium">点击上传</span> 或拖拽文件到此处</p>
            </div>
          </div>

          <div v-if="uploadFiles.length > 0" class="mt-2 max-h-[120px] overflow-y-scroll stable-scroll space-y-1.5 pr-1">
            <div v-for="(uf, idx) in uploadFiles" :key="idx" class="group">
              <div class="flex items-center gap-2">
                <div class="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  <img v-if="uf.isImage && uf.previewUrl" :src="uf.previewUrl" class="h-full w-full object-cover" />
                  <File v-else class="h-3 w-3 text-muted-foreground" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-medium truncate">{{ uf.name }}</p>
                  <Progress :model-value="uf.progress" class="h-1 mt-0.5" />
                </div>
                <CheckCircle2 v-if="uf.status === 'success'" class="h-3.5 w-3.5 text-green-500 shrink-0" />
                <AlertCircle v-else-if="uf.status === 'error'" class="h-3.5 w-3.5 text-red-500 shrink-0" />
                <AlertCircle v-else-if="uf.status === 'conflict'" class="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <button @click.stop="removeUploadFile(idx)" class="opacity-0 group-hover:opacity-100 transition-opacity">
                  <X class="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <div v-if="uf.status === 'conflict'" class="mt-1 pl-8 flex items-center gap-1.5">
                <span class="text-[10px] text-amber-600">同名冲突</span>
                <Button size="sm" variant="outline" class="h-5 text-[10px] px-1.5" @click.stop="resolveConflict(idx, 'OVERWRITE')">覆盖</Button>
                <Button size="sm" variant="outline" class="h-5 text-[10px] px-1.5" @click.stop="resolveConflict(idx, 'RENAME')">重命名</Button>
                <Button size="sm" variant="ghost" class="h-5 text-[10px] px-1.5 text-muted-foreground" @click.stop="removeUploadFile(idx)">跳过</Button>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-3 flex-1 min-h-0 overflow-y-scroll stable-scroll">
          <div class="grid grid-cols-[56%_22%_10%_12%] px-4 py-2 text-xs text-muted-foreground border-b bg-muted/10 sticky top-0 z-10">
            <div class="inline-flex items-center gap-0.5 pl-[30px]">
              <span>名称</span>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-4 w-4 p-0">
                    <SlidersHorizontal class="h-3 w-3" :class="hasNameFilter ? 'text-primary' : 'text-muted-foreground/70'" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="w-56">
                  <DropdownMenuLabel>名称筛选</DropdownMenuLabel>
                  <div class="px-2 pb-2">
                    <Input v-model="columnFilters.name" placeholder="输入名称关键词" class="h-8 text-xs" />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="columnFilters.name = ''">清空</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div class="inline-flex items-center gap-0.5">
              <span>修改日期</span>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-4 w-4 p-0">
                    <SlidersHorizontal class="h-3 w-3" :class="hasModifiedFilter ? 'text-primary' : 'text-muted-foreground/70'" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="w-56">
                  <DropdownMenuLabel>修改日期筛选</DropdownMenuLabel>
                  <div class="px-2 pb-2">
                    <Input v-model="columnFilters.modified" placeholder="输入日期关键词" class="h-8 text-xs" />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="columnFilters.modified = ''">清空</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div class="inline-flex items-center gap-0.5">
              <span>大小</span>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-4 w-4 p-0">
                    <SlidersHorizontal class="h-3 w-3" :class="hasSizeFilter ? 'text-primary' : 'text-muted-foreground/70'" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="w-44">
                  <DropdownMenuLabel>大小筛选</DropdownMenuLabel>
                  <DropdownMenuRadioGroup v-model="columnFilters.size">
                    <DropdownMenuRadioItem value="ALL">全部大小</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="EMPTY">0 B</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="SMALL">&lt; 1MB</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="MEDIUM">1MB - 10MB</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="LARGE">&gt; 10MB</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div class="inline-flex items-center gap-0.5">
              <span>种类</span>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-4 w-4 p-0">
                    <SlidersHorizontal class="h-3 w-3" :class="hasKindFilter ? 'text-primary' : 'text-muted-foreground/70'" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="w-44">
                  <DropdownMenuLabel>种类筛选</DropdownMenuLabel>
                  <DropdownMenuRadioGroup v-model="columnFilters.kind">
                    <DropdownMenuRadioItem value="">全部种类</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      v-for="kind in kindFilterOptions"
                      :key="`kind-${kind}`"
                      :value="kind"
                    >
                      {{ kind }}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div v-if="treeLoading" class="flex items-center justify-center h-full text-muted-foreground text-xs gap-2">
            <Loader2 class="h-4 w-4 animate-spin" /> 加载中...
          </div>

          <div v-else-if="displayedTreeRows.length === 0" class="flex items-center justify-center h-[180px] text-muted-foreground text-xs">
            {{ searchKeyword.trim() || columnFilters.name || columnFilters.modified || columnFilters.size !== 'ALL' || columnFilters.kind
              ? '未找到匹配文件'
              : (mode === 'upload' ? '该空间暂无文件，可直接上传' : '该空间暂无文件') }}
          </div>

          <div v-else class="divide-y">
            <div
              v-for="row in displayedTreeRows"
              :key="row.node.nodeId"
              class="grid grid-cols-[56%_22%_10%_12%] h-11 items-center px-4 text-sm transition-colors duration-100"
              :class="[
                row.node.entryType === 'FILE' && mode === 'select' ? 'cursor-pointer hover:bg-muted/30' : '',
                row.node.entryType === 'DIR' && mode === 'upload' ? 'cursor-pointer hover:bg-muted/30' : '',
                row.node.entryType === 'DIR' && mode === 'upload' && selectedUploadDirId === row.node.nodeId ? 'bg-primary/8 text-primary' : '',
                isSearchMatched(row.node) ? 'bg-primary/5' : ''
              ]"
              @click="
                mode === 'select' && row.node.entryType === 'FILE' ? toggleSelect(row.node) :
                mode === 'upload' && row.node.entryType === 'DIR' ? selectUploadDir(row.node) :
                undefined
              "
            >
              <div class="min-w-0 flex items-center gap-2" :style="{ paddingLeft: `${row.depth * 14}px` }">
                <template v-if="row.node.entryType === 'DIR'">
                  <button type="button" class="inline-flex h-8 w-8 items-center justify-center -ml-1 hover:text-primary" @click.stop="toggleDir(row.node)">
                    <Loader2 v-if="loadingIds.has(row.node.nodeId)" class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <ChevronDown v-else-if="currentCache.expandedIds.has(row.node.nodeId)" class="h-3.5 w-3.5 transition-transform duration-150 ease-in-out" />
                    <ChevronRight v-else class="h-3.5 w-3.5 transition-transform duration-150 ease-in-out" />
                  </button>
                </template>
                <template v-else>
                  <div v-if="mode === 'select'" class="shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors duration-100"
                    :class="isNodeSelected(row.node.nodeId) ? 'bg-primary border-primary' : 'border-muted-foreground/30 hover:border-primary/50'"
                  >
                    <Check v-if="isNodeSelected(row.node.nodeId)" class="h-3 w-3 text-primary-foreground" />
                  </div>
                  <span v-else class="inline-flex h-8 w-8 -ml-1" />
                </template>
                <component
                  :is="row.node.entryType === 'DIR' ? (currentCache.expandedIds.has(row.node.nodeId) ? FolderOpen : Folder) : getNodeIcon(row.node.name, row.node.entryType)"
                  class="h-4 w-4 shrink-0"
                  :class="row.node.entryType === 'DIR' ? 'text-blue-500' : 'text-muted-foreground'"
                />
                <span class="truncate" :class="{ 'font-medium': row.node.entryType === 'DIR' }">{{ row.node.name }}</span>
                <Check
                  v-if="mode === 'upload' && row.node.entryType === 'DIR' && selectedUploadDirId === row.node.nodeId"
                  class="h-3.5 w-3.5 text-primary shrink-0"
                />
              </div>
              <span class="text-xs text-muted-foreground">{{ formatModifiedAt(row.node.updatedAt) }}</span>
              <span class="text-xs text-muted-foreground">{{ row.node.entryType === 'DIR' ? '-' : formatFileSize(row.node.fileSize) }}</span>
              <span class="text-xs text-muted-foreground">{{ getFileKind(row.node) }}</span>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="h-11 px-4 border-t shrink-0 flex items-center">
        <div class="w-full flex items-center justify-between gap-3">
          <div class="min-h-8">
            <div
              v-if="mode === 'select'"
              class="inline-flex h-8 items-center rounded-md border px-3 text-xs"
              :class="selectedCount > 0 ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border text-muted-foreground'"
            >
              已选 {{ selectedCount }} 个文件
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" class="h-8" @click="$emit('update:open', false)">取消</Button>
            <template v-if="mode === 'select'">
              <Button size="sm" class="h-8" :disabled="selectedCount === 0" @click="confirmSelect">
                确认选择
              </Button>
            </template>
            <template v-else>
              <Button size="sm" class="h-8" :disabled="uploadFiles.length === 0 || isUploading() || hasConflict() || !hasSuccess()" @click="confirmUpload">
                确认添加
              </Button>
            </template>
          </div>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.stable-scroll {
  scrollbar-gutter: stable;
}
</style>
