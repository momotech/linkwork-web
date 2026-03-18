<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
  AlertTriangle,
  Bot,
  Code2,
  Brain,
  ChevronDown,
  ChevronRight,
  Code,
  Cog,
  Copy,
  Download,
  Eye,
  Edit3,
  File,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  Globe,
  HardDrive,
  Loader2,
  MoreHorizontal,
  MoveRight,
  RefreshCw,
  Search,
  Sheet,
  Archive,
  SlidersHorizontal,
  Server,
  ShieldCheck,
  Terminal,
  Trash2
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import FilePickerDialog from '@/components/business/FilePickerDialog.vue'
import { useRoute } from 'vue-router'
import ArtifactPreviewDialog from '@/components/business/ArtifactPreviewDialog.vue'
import {
  fileManagerApi,
  FileConflictError,
  type ConflictInfo,
  type ConflictPolicy,
  type FileItem,
  type FileNodeItem,
  type FileTransferParams,
  type SpaceType
} from '@/api/fileManager'

interface RoleItem {
  id: string
  name: string
  icon?: string
}

interface SpaceItem {
  key: string
  label: string
  spaceType: SpaceType
  workstationId?: string
  icon?: string
}

interface TreeRow {
  node: FileNodeItem
  depth: number
}

const route = useRoute()

const roles = ref<RoleItem[]>([])
const activeSpace = ref<SpaceItem>({
  key: 'USER',
  label: '我的空间',
  spaceType: 'USER'
})

const rootNodes = ref<FileNodeItem[]>([])
const childrenMap = ref<Map<string, FileNodeItem[]>>(new Map())
const expandedNodeIds = ref<Set<string>>(new Set())
const loadingNodeIds = ref<Set<string>>(new Set())
const loading = ref(false)
const syncingSpace = ref(false)
const searchKeyword = ref('')
const columnFilters = ref({
  name: '',
  modified: '',
  size: 'ALL',
  kind: ''
})

const isUploadOpen = ref(false)
const uploadDialogRef = ref<InstanceType<typeof FilePickerDialog> | null>(null)
const uploadParentId = ref<string | null>(null)
const uploadParentName = ref<string | undefined>(undefined)
const isDragOver = ref(false)
const pendingDropFiles = ref<File[]>([])
let viewDragCounter = 0

const isNewFolderOpen = ref(false)
const newFolderName = ref('')
const newFolderParentId = ref<string | null>(null)
const newFolderSubmitting = ref(false)

const isRenameOpen = ref(false)
const renamingNode = ref<FileNodeItem | null>(null)
const renameValue = ref('')
const renameSubmitting = ref(false)

const deletingNode = ref<FileNodeItem | null>(null)
const isDeleteOpen = ref(false)

const transferFile = ref<FileNodeItem | null>(null)
const isTransferOpen = ref(false)
const transferMode = ref<'copy' | 'move'>('copy')
const transferTarget = ref<FileTransferParams>({
  targetSpaceType: 'USER',
  targetWorkstationId: undefined
})
const transferSubmitting = ref(false)
const transferSelectedParentId = ref<string | null>(null)
const transferDirRoots = ref<FileNodeItem[]>([])
const transferDirChildren = ref<Map<string, FileNodeItem[]>>(new Map())
const transferDirExpanded = ref<Set<string>>(new Set())
const transferDirLoading = ref<Set<string>>(new Set())

const isConflictOpen = ref(false)
const conflictInfo = ref<ConflictInfo | null>(null)
const conflictMessage = ref('')
const pendingConflictResolve = ref<((policy: ConflictPolicy | null) => void) | null>(null)
const highlightedNodeId = ref<string | null>(null)
const lastHandledRouteKey = ref('')
const previewOpen = ref(false)
const previewArtifact = ref<{ name: string; url: string } | null>(null)

const onViewDragEnter = (e: DragEvent) => {
  e.preventDefault()
  viewDragCounter++
  isDragOver.value = true
}
const onViewDragOver = (e: DragEvent) => {
  e.preventDefault()
}
const onViewDragLeave = () => {
  viewDragCounter--
  if (viewDragCounter <= 0) {
    viewDragCounter = 0
    isDragOver.value = false
  }
}
const onViewDrop = (e: DragEvent) => {
  e.preventDefault()
  viewDragCounter = 0
  isDragOver.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    pendingDropFiles.value = Array.from(e.dataTransfer.files)
    uploadParentId.value = null
    isUploadOpen.value = true
  }
}

watch(isUploadOpen, (open) => {
  if (open && pendingDropFiles.value.length > 0) {
    const droppedFiles = pendingDropFiles.value
    pendingDropFiles.value = []
    nextTick(() => {
      uploadDialogRef.value?.processFiles(droppedFiles)
    })
  }
})

const showConflictDialog = (info: ConflictInfo, msg: string): Promise<ConflictPolicy | null> => {
  conflictInfo.value = info
  conflictMessage.value = msg
  isConflictOpen.value = true
  return new Promise<ConflictPolicy | null>((resolve) => {
    pendingConflictResolve.value = resolve
  })
}

const resolveConflict = (policy: ConflictPolicy | null) => {
  isConflictOpen.value = false
  if (pendingConflictResolve.value) {
    pendingConflictResolve.value(policy)
    pendingConflictResolve.value = null
  }
}

const roleIconMap = {
  server: Server,
  shield: ShieldCheck,
  code: Code,
  globe: Globe,
  terminal: Terminal,
  bot: Bot,
  brain: Brain,
  cog: Cog
} as const

const userSpace = computed<SpaceItem>(() => ({
  key: 'USER',
  label: '我的空间',
  spaceType: 'USER',
  icon: 'hard-drive'
}))

const workstationSpaces = computed<SpaceItem[]>(() =>
  roles.value.map(role => ({
    key: `WORKSTATION:${role.id}`,
    label: role.name,
    spaceType: 'WORKSTATION' as const,
    workstationId: role.id,
    icon: role.icon
  }))
)

const getRouteQueryValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : ''
  }
  return typeof value === 'string' ? value.trim() : ''
}

const collectLoadedNodeMap = () => {
  const nodeMap = new Map<string, FileNodeItem>()
  const walk = (nodes: FileNodeItem[]) => {
    for (const node of nodes) {
      nodeMap.set(node.nodeId, node)
      if (node.entryType === 'DIR') {
        const children = childrenMap.value.get(node.nodeId)
        if (children) walk(children)
      }
    }
  }
  walk(rootNodes.value)
  return nodeMap
}

const revealNode = async (targetNodeId: string) => {
  if (!targetNodeId) return false

  const visitedDirIds = new Set<string>()
  const dirQueue: string[] = rootNodes.value.filter(node => node.entryType === 'DIR').map(node => node.nodeId)

  let nodeMap = collectLoadedNodeMap()
  while (!nodeMap.has(targetNodeId) && dirQueue.length > 0) {
    const dirId = dirQueue.shift()!
    if (visitedDirIds.has(dirId)) continue
    visitedDirIds.add(dirId)

    if (!childrenMap.value.has(dirId)) {
      await loadChildren(dirId)
    }

    const children = childrenMap.value.get(dirId) || []
    for (const child of children) {
      if (child.entryType === 'DIR' && !visitedDirIds.has(child.nodeId)) {
        dirQueue.push(child.nodeId)
      }
    }
    nodeMap = collectLoadedNodeMap()
  }

  const targetNode = nodeMap.get(targetNodeId)
  if (!targetNode) return false

  const nextExpanded = new Set(expandedNodeIds.value)
  let parentId = targetNode.parentId
  while (parentId) {
    nextExpanded.add(parentId)
    if (!childrenMap.value.has(parentId)) {
      await loadChildren(parentId)
    }
    parentId = collectLoadedNodeMap().get(parentId)?.parentId || null
  }
  expandedNodeIds.value = nextExpanded
  highlightedNodeId.value = targetNodeId

  await nextTick()
  document.getElementById(`file-node-${targetNodeId}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  })
  return true
}

const applyRouteDeepLink = async (force = false) => {
  const spaceType = getRouteQueryValue(route.query.spaceType).toUpperCase()
  const workstationId = getRouteQueryValue(route.query.workstationId)
  const nodeId = getRouteQueryValue(route.query.nodeId)

  if (!spaceType) return false
  const routeKey = `${spaceType}|${workstationId}|${nodeId}`
  if (!force && routeKey === lastHandledRouteKey.value) {
    return true
  }
  lastHandledRouteKey.value = routeKey

  let targetSpace: SpaceItem | null = null
  if (spaceType === 'USER') {
    targetSpace = userSpace.value
  } else if (spaceType === 'WORKSTATION') {
    if (!workstationId) return false
    targetSpace = workstationSpaces.value.find(space => space.workstationId === workstationId) || {
      key: `WORKSTATION:${workstationId}`,
      label: `岗位空间 ${workstationId}`,
      spaceType: 'WORKSTATION',
      workstationId
    }
  } else {
    return false
  }

  const spaceChanged = activeSpace.value.key !== targetSpace.key
  if (spaceChanged) {
    activeSpace.value = targetSpace
    searchKeyword.value = ''
    resetColumnFilters()
  }

  await fetchTree()

  highlightedNodeId.value = null
  if (nodeId) {
    const found = await revealNode(nodeId)
    if (!found) {
      toast.error('未找到目标产出目录')
    }
  }

  return true
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback
}

const getSpaceIcon = (icon?: string) => {
  if (icon === 'hard-drive') return HardDrive
  if (!icon) return Server
  return roleIconMap[icon as keyof typeof roleIconMap] || Server
}

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
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

const getNodeIcon = (node: FileNodeItem) => {
  if (node.entryType === 'DIR') return Folder
  const ext = getExt(node.name)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return FileImage
  if (['xls', 'xlsx', 'csv'].includes(ext)) return Sheet
  if (['go', 'py', 'js', 'ts', 'tsx', 'java', 'sh', 'sql', 'html', 'css', 'vue', 'json', 'yml', 'yaml', 'xml'].includes(ext)) return Code2
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive
  if (['md', 'markdown', 'pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return FileText
  return File
}

const totalCount = computed(() => {
  let count = rootNodes.value.length
  for (const children of childrenMap.value.values()) {
    count += children.length
  }
  return count
})

const treeRows = computed<TreeRow[]>(() => {
  const rows: TreeRow[] = []
  const walk = (nodes: FileNodeItem[], depth: number) => {
    for (const node of nodes) {
      rows.push({ node, depth })
      if (node.entryType === 'DIR' && expandedNodeIds.value.has(node.nodeId)) {
        const children = childrenMap.value.get(node.nodeId) || []
        walk(children, depth + 1)
      }
    }
  }
  walk(rootNodes.value, 0)
  return rows
})

const displayedTreeRows = computed<TreeRow[]>(() => {
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

const filteredTreeRows = computed<TreeRow[]>(() => {
  const nameFilter = columnFilters.value.name.trim().toLowerCase()
  const modifiedFilter = columnFilters.value.modified.trim().toLowerCase()
  const sizeFilter = columnFilters.value.size
  const kindFilter = columnFilters.value.kind

  return displayedTreeRows.value.filter((row) => {
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

const fetchTree = async () => {
  if (activeSpace.value.spaceType === 'WORKSTATION' && !activeSpace.value.workstationId) {
    rootNodes.value = []
    childrenMap.value = new Map()
    return
  }

  loading.value = true
  try {
    rootNodes.value = await fileManagerApi.listTree(
      activeSpace.value.spaceType,
      activeSpace.value.spaceType === 'WORKSTATION' ? activeSpace.value.workstationId : undefined
    )
    childrenMap.value = new Map()
    expandedNodeIds.value = new Set()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, '获取文件树失败'))
  } finally {
    loading.value = false
  }
}

const loadChildren = async (nodeId: string) => {
  if (childrenMap.value.has(nodeId)) return
  loadingNodeIds.value = new Set([...loadingNodeIds.value, nodeId])
  try {
    const children = await fileManagerApi.listTree(
      activeSpace.value.spaceType,
      activeSpace.value.spaceType === 'WORKSTATION' ? activeSpace.value.workstationId : undefined,
      nodeId
    )
    childrenMap.value = new Map([...childrenMap.value, [nodeId, children]])
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, '加载子目录失败'))
  } finally {
    const next = new Set(loadingNodeIds.value)
    next.delete(nodeId)
    loadingNodeIds.value = next
  }
}

const toggleDirectory = async (node: FileNodeItem) => {
  if (node.entryType !== 'DIR') return
  const next = new Set(expandedNodeIds.value)
  if (next.has(node.nodeId)) {
    next.delete(node.nodeId)
  } else {
    next.add(node.nodeId)
    await loadChildren(node.nodeId)
  }
  expandedNodeIds.value = next
}

const refreshNode = async (parentId: string | null) => {
  if (parentId) {
    const next = new Map(childrenMap.value)
    next.delete(parentId)
    childrenMap.value = next
    await loadChildren(parentId)
  } else {
    await fetchTree()
  }
}

const selectSpace = async (space: SpaceItem) => {
  activeSpace.value = space
  searchKeyword.value = ''
  resetColumnFilters()
  highlightedNodeId.value = null
  await fetchTree()
}

const handleSyncSpace = async () => {
  if (syncingSpace.value) return
  syncingSpace.value = true
  try {
    const result = await fileManagerApi.syncSpace(
      activeSpace.value.spaceType,
      activeSpace.value.spaceType === 'WORKSTATION' ? activeSpace.value.workstationId : undefined
    )
    await fetchTree()
    toast.success(`同步完成：扫描 ${result.scannedCount}，回填 ${result.syncedCount}，跳过 ${result.skippedCount}`)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, '同步失败'))
  } finally {
    syncingSpace.value = false
  }
}

const fetchRoles = async () => {
  const response = await fetch('/api/v1/roles', { credentials: 'include' })
  const result = await response.json()
  if (result.code !== 0) throw new Error(result.msg || '获取岗位列表失败')
  roles.value = (result.data?.items || result.data || []).map(
    (item: { id: string | number; name: string; icon?: string }) => ({
      id: String(item.id),
      name: item.name,
      icon: item.icon
    })
  )
}

const openUploadDialog = (parentId?: string | null, parentName?: string) => {
  uploadParentId.value = parentId ?? null
  uploadParentName.value = parentName
  isUploadOpen.value = true
}

const handleUploadComplete = async () => {
  isUploadOpen.value = false
  toast.success('文件上传成功')
  await refreshNode(uploadParentId.value)
}

const openNewFolderDialog = (parentId?: string | null) => {
  newFolderParentId.value = parentId ?? null
  newFolderName.value = ''
  isNewFolderOpen.value = true
}

const handleCreateFolder = async () => {
  const name = newFolderName.value.trim()
  if (!name) {
    toast.error('请输入目录名称')
    return
  }
  newFolderSubmitting.value = true
  try {
    await fileManagerApi.createFolder({
      name,
      spaceType: activeSpace.value.spaceType,
      workstationId: activeSpace.value.spaceType === 'WORKSTATION' ? activeSpace.value.workstationId : undefined,
      parentId: newFolderParentId.value
    })
    toast.success('目录创建成功')
    isNewFolderOpen.value = false
    await refreshNode(newFolderParentId.value)
  } catch (error: unknown) {
    if (error instanceof FileConflictError) {
      toast.error('同名目录已存在')
    } else {
      toast.error(getErrorMessage(error, '创建目录失败'))
    }
  } finally {
    newFolderSubmitting.value = false
  }
}

const openRenameDialog = (node: FileNodeItem) => {
  renamingNode.value = node
  renameValue.value = node.name
  isRenameOpen.value = true
}

const handleRename = async () => {
  if (!renamingNode.value) return
  const name = renameValue.value.trim()
  if (!name) {
    toast.error('请输入名称')
    return
  }
  renameSubmitting.value = true
  try {
    await fileManagerApi.renameNode(renamingNode.value.nodeId, name)
    toast.success('重命名成功')
    isRenameOpen.value = false
    await refreshNode(renamingNode.value.parentId)
  } catch (error: unknown) {
    if (error instanceof FileConflictError) {
      toast.error('同名节点已存在')
    } else {
      toast.error(getErrorMessage(error, '重命名失败'))
    }
  } finally {
    renameSubmitting.value = false
  }
}

const openDeleteDialog = (node: FileNodeItem) => {
  deletingNode.value = node
  isDeleteOpen.value = true
}

const handleDelete = async () => {
  if (!deletingNode.value) return
  try {
    if (deletingNode.value.entryType === 'FILE' && deletingNode.value.fileId) {
      await fileManagerApi.deleteFile(deletingNode.value.fileId)
    } else {
      await fileManagerApi.deleteNode(deletingNode.value.nodeId)
    }
    toast.success('已删除')
    isDeleteOpen.value = false
    const parentId = deletingNode.value.parentId
    deletingNode.value = null
    await refreshNode(parentId)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, '删除失败'))
  }
}

const handleDownload = (fileId: string) => {
  const url = fileManagerApi.getDownloadUrl(fileId)
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const handlePreview = (node: FileNodeItem) => {
  if (node.entryType !== 'FILE' || !node.fileId) {
    toast.error('当前节点暂不支持预览')
    return
  }
  previewArtifact.value = {
    name: node.name,
    url: fileManagerApi.getPreviewUrl(node.fileId)
  }
  previewOpen.value = true
}

const loadTransferDirs = async (spaceType: SpaceType, workstationId?: string, parentId?: string | null) => {
  const key = parentId || '__root__'
  if (parentId) {
    if (transferDirChildren.value.has(parentId)) return
    transferDirLoading.value = new Set([...transferDirLoading.value, parentId])
  }
  try {
    const nodes = await fileManagerApi.listTree(spaceType, workstationId, parentId || undefined)
    const dirs = nodes.filter(n => n.entryType === 'DIR')
    if (parentId) {
      transferDirChildren.value = new Map([...transferDirChildren.value, [parentId, dirs]])
    } else {
      transferDirRoots.value = dirs
    }
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, '加载目录结构失败'))
  } finally {
    if (parentId) {
      const next = new Set(transferDirLoading.value)
      next.delete(parentId)
      transferDirLoading.value = next
    }
  }
}

const toggleTransferDir = async (nodeId: string) => {
  const next = new Set(transferDirExpanded.value)
  if (next.has(nodeId)) {
    next.delete(nodeId)
  } else {
    next.add(nodeId)
    await loadTransferDirs(
      transferTarget.value.targetSpaceType,
      transferTarget.value.targetSpaceType === 'WORKSTATION' ? transferTarget.value.targetWorkstationId : undefined,
      nodeId
    )
  }
  transferDirExpanded.value = next
}

const selectTransferParent = (nodeId: string | null) => {
  transferSelectedParentId.value = nodeId
}

interface TransferDirRow {
  node: FileNodeItem
  depth: number
}

const transferDirRows = computed<TransferDirRow[]>(() => {
  const rows: TransferDirRow[] = []
  const walk = (nodes: FileNodeItem[], depth: number) => {
    for (const node of nodes) {
      rows.push({ node, depth })
      if (transferDirExpanded.value.has(node.nodeId)) {
        const children = transferDirChildren.value.get(node.nodeId) || []
        walk(children, depth + 1)
      }
    }
  }
  walk(transferDirRoots.value, 0)
  return rows
})

const resetTransferDirPicker = async () => {
  transferSelectedParentId.value = null
  transferDirRoots.value = []
  transferDirChildren.value = new Map()
  transferDirExpanded.value = new Set()
  transferDirLoading.value = new Set()
  await loadTransferDirs(
    transferTarget.value.targetSpaceType,
    transferTarget.value.targetSpaceType === 'WORKSTATION' ? transferTarget.value.targetWorkstationId : undefined
  )
}

const openTransferDialog = async (node: FileNodeItem, mode: 'copy' | 'move') => {
  transferFile.value = node
  transferMode.value = mode
  if (activeSpace.value.spaceType === 'WORKSTATION' && activeSpace.value.workstationId) {
    transferTarget.value = {
      targetSpaceType: 'WORKSTATION',
      targetWorkstationId: activeSpace.value.workstationId
    }
  } else {
    transferTarget.value = { targetSpaceType: 'USER', targetWorkstationId: undefined }
  }
  isTransferOpen.value = true
  await resetTransferDirPicker()
}

const executeTransferWithPolicy = async (
  fileId: string,
  params: FileTransferParams,
  mode: 'copy' | 'move'
): Promise<void> => {
  const action = mode === 'copy' ? fileManagerApi.copyFile : fileManagerApi.moveFile
  try {
    await action(fileId, params)
    toast.success(mode === 'copy' ? '文件复制成功' : '文件移动成功')
  } catch (error: unknown) {
    if (error instanceof FileConflictError) {
      const policy = await showConflictDialog(error.conflict, error.message)
      if (!policy) return
      await action(fileId, { ...params, conflictPolicy: policy })
      toast.success(policy === 'OVERWRITE' ? '文件已覆盖' : '文件已重命名保存')
    } else {
      throw error
    }
  }
}

const executeTransfer = async () => {
  if (transferSubmitting.value) return
  if (!transferFile.value || !transferFile.value.fileId) return
  if (transferTarget.value.targetSpaceType === 'WORKSTATION' && !transferTarget.value.targetWorkstationId) {
    toast.error('请选择目标岗位')
    return
  }

  transferSubmitting.value = true
  try {
    const params: FileTransferParams = {
      targetSpaceType: transferTarget.value.targetSpaceType,
      targetWorkstationId:
        transferTarget.value.targetSpaceType === 'WORKSTATION'
          ? transferTarget.value.targetWorkstationId
          : undefined,
      targetParentId: transferSelectedParentId.value
    }
    await executeTransferWithPolicy(transferFile.value.fileId, params, transferMode.value)
    isTransferOpen.value = false
    const parentId = transferFile.value.parentId
    transferFile.value = null
    await refreshNode(parentId)
    if (transferSelectedParentId.value) {
      await refreshNode(transferSelectedParentId.value)
    }
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, transferMode.value === 'copy' ? '复制失败' : '移动失败'))
  } finally {
    transferSubmitting.value = false
  }
}

watch(() => transferTarget.value.targetSpaceType, async () => {
  if (isTransferOpen.value) {
    await resetTransferDirPicker()
  }
})

watch(() => transferTarget.value.targetWorkstationId, async () => {
  if (isTransferOpen.value && transferTarget.value.targetSpaceType === 'WORKSTATION') {
    await resetTransferDirPicker()
  }
})

watch(() => route.query, async () => {
  await applyRouteDeepLink()
})

onMounted(async () => {
  try {
    await fetchRoles()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, '获取岗位失败'))
  }
  const handled = await applyRouteDeepLink(true)
  if (!handled) {
    await fetchTree()
  }
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="grid grid-cols-[260px_minmax(0,1fr)] gap-4 flex-1 min-h-0">
      <aside class="rounded-lg border bg-card min-h-0 flex flex-col">
        <div class="px-4 py-3 border-b">
          <h2 class="font-semibold text-sm">空间列表</h2>
        </div>
        <div class="px-2 py-2 overflow-y-auto min-h-0">
          <div class="px-2 pb-2">
            <p class="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">我的空间</p>
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2 border"
              :class="activeSpace.key === userSpace.key ? 'bg-secondary text-secondary-foreground font-bold border-border/60' : 'hover:bg-muted border-transparent'"
              @click="selectSpace(userSpace)"
            >
              <component :is="getSpaceIcon(userSpace.icon)" class="h-4 w-4 shrink-0 transition-colors" :class="activeSpace.key === userSpace.key ? 'text-primary' : ''" />
              <span class="truncate">{{ userSpace.label }}</span>
            </button>
          </div>

          <div class="h-px bg-border my-3" />

          <div class="px-2 pt-1">
            <p class="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">岗位空间</p>
            <div class="space-y-1">
              <button
                v-for="space in workstationSpaces"
                :key="space.key"
                type="button"
                class="w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2 border"
                :class="activeSpace.key === space.key ? 'bg-secondary text-secondary-foreground font-bold border-border/60' : 'hover:bg-muted border-transparent'"
                @click="selectSpace(space)"
              >
                <component :is="getSpaceIcon(space.icon)" class="h-4 w-4 shrink-0 transition-colors" :class="activeSpace.key === space.key ? 'text-primary' : ''" />
                <span class="truncate">{{ space.label }}</span>
              </button>
              <p v-if="workstationSpaces.length === 0" class="text-[10px] text-muted-foreground px-1 py-2">暂无岗位</p>
            </div>
          </div>
        </div>
      </aside>

      <section
        class="rounded-lg border bg-card flex flex-col min-h-0 relative"
        @dragenter="onViewDragEnter"
        @dragover="onViewDragOver"
        @dragleave="onViewDragLeave"
        @drop="onViewDrop"
      >
        <div v-if="isDragOver" class="absolute inset-0 z-20 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div class="text-primary font-semibold text-lg">释放文件以上传</div>
        </div>
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <div class="font-semibold truncate">{{ activeSpace.label }}</div>
          <div class="text-xs text-muted-foreground">共 {{ totalCount }} 个节点</div>
        </div>

        <div class="p-4 border-b flex items-center gap-3">
          <Button variant="outline" size="sm" @click="openNewFolderDialog(null)">
            <FolderPlus class="mr-1.5 h-4 w-4" />
            新建目录
          </Button>
          <Button variant="outline" size="sm" :disabled="syncingSpace" @click="handleSyncSpace">
            <Loader2 v-if="syncingSpace" class="mr-1.5 h-4 w-4 animate-spin" />
            <RefreshCw v-else class="mr-1.5 h-4 w-4" />
            {{ syncingSpace ? '同步中...' : '同步' }}
          </Button>
          <div class="relative w-[280px]">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="searchKeyword"
              placeholder="搜索文件或目录"
              class="h-9 pl-9 pr-9"
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
          <div class="flex-1" />
          <Button class="bg-primary text-primary-foreground hover:bg-primary/90" @click="openUploadDialog(null)">
            上传文件
          </Button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto">
          <div class="grid grid-cols-[56%_18%_10%_10%_6%] px-4 py-2 text-xs text-muted-foreground border-b bg-muted/10 sticky top-0 z-10">
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
            <span class="text-center">操作</span>
          </div>

          <div v-if="loading" class="px-4 py-8 text-center text-muted-foreground">加载中...</div>

          <template v-else>
            <div
              v-for="row in filteredTreeRows"
              :key="row.node.nodeId"
              :id="`file-node-${row.node.nodeId}`"
              class="grid grid-cols-[56%_18%_10%_10%_6%] items-center h-11 px-4 border-b hover:bg-muted/30 transition-colors"
              :class="[
                isSearchMatched(row.node) ? 'bg-primary/5' : '',
                highlightedNodeId === row.node.nodeId ? 'bg-emerald-50/80 dark:bg-emerald-950/30' : ''
              ]"
            >
              <div class="min-w-0 flex items-center gap-2" :style="{ paddingLeft: `${row.depth * 20}px` }">
                <template v-if="row.node.entryType === 'DIR'">
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center -ml-1 hover:text-primary"
                    @click="toggleDirectory(row.node)"
                  >
                    <Loader2
                      v-if="loadingNodeIds.has(row.node.nodeId)"
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                    <ChevronDown
                      v-else-if="expandedNodeIds.has(row.node.nodeId)"
                      class="h-4 w-4 transition-transform duration-150 ease-in-out"
                    />
                    <ChevronRight
                      v-else
                      class="h-4 w-4 transition-transform duration-150 ease-in-out"
                    />
                  </button>
                </template>
                <template v-else>
                  <span class="inline-flex h-8 w-8 -ml-1" />
                </template>
                <component
                  :is="getNodeIcon(row.node)"
                  class="h-4 w-4 shrink-0"
                  :class="row.node.entryType === 'DIR' ? 'text-blue-500' : 'text-muted-foreground'"
                />
                <span class="truncate" :class="{ 'font-medium': row.node.entryType === 'DIR' }">{{ row.node.name }}</span>
              </div>

              <span class="text-xs text-muted-foreground">{{ formatModifiedAt(row.node.updatedAt) }}</span>
              <span class="text-xs text-muted-foreground">{{ row.node.entryType === 'FILE' ? formatFileSize(row.node.fileSize) : '-' }}</span>
              <span class="text-xs text-muted-foreground">
                {{ getFileKind(row.node) }}<template v-if="searchKeyword.trim()"> · L{{ row.depth + 1 }}</template>
              </span>

              <div class="flex items-center justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button size="icon" variant="ghost" class="h-8 w-8">
                      <MoreHorizontal class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <template v-if="row.node.entryType === 'DIR'">
                      <DropdownMenuItem @click="openNewFolderDialog(row.node.nodeId)">
                        <FolderPlus class="mr-2 h-4 w-4" />
                        新建子目录
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="openUploadDialog(row.node.nodeId, row.node.name)">
                        <File class="mr-2 h-4 w-4" />
                        上传到此目录
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem @click="openRenameDialog(row.node)">
                        <Edit3 class="mr-2 h-4 w-4" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-destructive" @click="openDeleteDialog(row.node)">
                        <Trash2 class="mr-2 h-4 w-4" />
                        删除目录
                      </DropdownMenuItem>
                    </template>
                    <template v-else>
                      <DropdownMenuItem v-if="row.node.fileId" @click="handlePreview(row.node)">
                        <Eye class="mr-2 h-4 w-4" />
                        预览
                      </DropdownMenuItem>
                      <DropdownMenuItem v-if="row.node.fileId" @click="handleDownload(row.node.fileId)">
                        <Download class="mr-2 h-4 w-4" />
                        下载
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="openRenameDialog(row.node)">
                        <Edit3 class="mr-2 h-4 w-4" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem v-if="row.node.fileId" @click="openTransferDialog(row.node, 'copy')">
                        <Copy class="mr-2 h-4 w-4" />
                        复制到...
                      </DropdownMenuItem>
                      <DropdownMenuItem v-if="row.node.fileId" @click="openTransferDialog(row.node, 'move')">
                        <MoveRight class="mr-2 h-4 w-4" />
                        移动到...
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-destructive" @click="openDeleteDialog(row.node)">
                        <Trash2 class="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </template>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div v-if="filteredTreeRows.length === 0" class="px-4 py-8 text-center text-muted-foreground border-b">
              {{ searchKeyword.trim() || columnFilters.name || columnFilters.modified || columnFilters.size !== 'ALL' || columnFilters.kind
                ? '未找到匹配文件'
                : '暂无文件，点击"上传文件"或"新建目录"开始' }}
            </div>
          </template>
        </div>
      </section>
    </div>

    <!-- 新建目录对话框 -->
    <Dialog v-model:open="isNewFolderOpen">
      <DialogContent class="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>新建目录</DialogTitle>
          <DialogDescription>在当前空间创建一个新目录</DialogDescription>
        </DialogHeader>
        <div class="py-2">
          <Input
            v-model="newFolderName"
            placeholder="输入目录名称"
            @keydown.enter="handleCreateFolder"
            autofocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isNewFolderOpen = false">取消</Button>
          <Button :disabled="newFolderSubmitting || !newFolderName.trim()" @click="handleCreateFolder">
            {{ newFolderSubmitting ? '创建中...' : '创建' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 重命名对话框 -->
    <Dialog v-model:open="isRenameOpen">
      <DialogContent class="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>重命名</DialogTitle>
          <DialogDescription>
            {{ renamingNode?.entryType === 'DIR' ? '修改目录名称' : '修改文件名称' }}
          </DialogDescription>
        </DialogHeader>
        <div class="py-2">
          <Input
            v-model="renameValue"
            placeholder="输入新名称"
            @keydown.enter="handleRename"
            autofocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isRenameOpen = false">取消</Button>
          <Button :disabled="renameSubmitting || !renameValue.trim()" @click="handleRename">
            {{ renameSubmitting ? '保存中...' : '保存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 删除确认 -->
    <Dialog v-model:open="isDeleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ deletingNode?.entryType === 'DIR' ? '删除目录' : '删除文件' }}</DialogTitle>
          <DialogDescription>
            <template v-if="deletingNode?.entryType === 'DIR'">
              确定删除目录 "{{ deletingNode?.name }}" 及其所有子内容吗？此操作不可撤销。
            </template>
            <template v-else>
              确定删除文件 "{{ deletingNode?.name }}" 吗？此操作不可撤销。
            </template>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isDeleteOpen = false">取消</Button>
          <Button variant="destructive" @click="handleDelete">确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 复制/移动对话框 -->
    <Dialog v-model:open="isTransferOpen">
      <DialogContent class="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{{ transferMode === 'copy' ? '复制文件' : '移动文件' }}</DialogTitle>
          <DialogDescription>
            目标文件：{{ transferFile?.name || '-' }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <div>
            <div class="mb-2 text-xs text-muted-foreground">目标空间</div>
            <Select v-model="transferTarget.targetSpaceType">
              <SelectTrigger><SelectValue placeholder="选择目标空间" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">我的空间</SelectItem>
                <SelectItem value="WORKSTATION">岗位空间</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="transferTarget.targetSpaceType === 'WORKSTATION'">
            <div class="mb-2 text-xs text-muted-foreground">目标岗位</div>
            <Select v-model="transferTarget.targetWorkstationId">
              <SelectTrigger><SelectValue placeholder="选择岗位" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div class="mb-2 text-xs text-muted-foreground">目标目录</div>
            <div class="rounded-md border max-h-48 overflow-auto">
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                :class="transferSelectedParentId === null ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'"
                @click="selectTransferParent(null)"
              >
                <Folder class="h-4 w-4 text-muted-foreground" />
                / 根目录
              </button>
              <template v-for="row in transferDirRows" :key="row.node.nodeId">
                <div
                  class="flex items-center text-sm transition-colors"
                  :class="transferSelectedParentId === row.node.nodeId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'"
                >
                  <button
                    v-if="row.node.hasChildren"
                    type="button"
                    class="shrink-0 p-1.5 hover:text-primary"
                    :style="{ marginLeft: `${row.depth * 16 + 8}px` }"
                    @click.stop="toggleTransferDir(row.node.nodeId)"
                  >
                    <Loader2 v-if="transferDirLoading.has(row.node.nodeId)" class="h-3.5 w-3.5 animate-spin" />
                    <ChevronDown v-else-if="transferDirExpanded.has(row.node.nodeId)" class="h-3.5 w-3.5" />
                    <ChevronRight v-else class="h-3.5 w-3.5" />
                  </button>
                  <span v-else class="shrink-0 w-[26px]" :style="{ marginLeft: `${row.depth * 16 + 8}px` }" />
                  <button
                    type="button"
                    class="flex-1 text-left px-1.5 py-2 flex items-center gap-2"
                    @click="selectTransferParent(row.node.nodeId)"
                  >
                    <Folder class="h-4 w-4 text-blue-500 shrink-0" />
                    <span class="truncate">{{ row.node.name }}</span>
                  </button>
                </div>
              </template>
              <div v-if="transferDirRoots.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
                该空间暂无子目录
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isTransferOpen = false">取消</Button>
          <Button :disabled="transferSubmitting" @click="executeTransfer">
            {{ transferSubmitting ? '处理中...' : transferMode === 'copy' ? '确认复制' : '确认移动' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 上传对话框 -->
    <FilePickerDialog
      ref="uploadDialogRef"
      v-model:open="isUploadOpen"
      mode="upload"
      :lock-space="true"
      :initial-space-type="activeSpace.spaceType"
      :initial-workstation-id="activeSpace.spaceType === 'WORKSTATION' ? activeSpace.workstationId : undefined"
      :current-role-id="activeSpace.spaceType === 'WORKSTATION' ? activeSpace.workstationId : undefined"
      :current-role-name="activeSpace.spaceType === 'WORKSTATION' ? activeSpace.label : undefined"
      :initial-parent-id="uploadParentId"
      :initial-parent-name="uploadParentName"
      @upload="handleUploadComplete"
    />

    <ArtifactPreviewDialog
      v-model:open="previewOpen"
      :artifact="previewArtifact"
    />

    <!-- 同名冲突对话框 -->
    <Dialog :open="isConflictOpen" @update:open="(v: boolean) => { if (!v) resolveConflict(null) }">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <AlertTriangle class="h-5 w-5 text-amber-500" />
            文件同名冲突
          </DialogTitle>
          <DialogDescription>{{ conflictMessage }}</DialogDescription>
        </DialogHeader>

        <div v-if="conflictInfo?.existingNode" class="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
          <div class="flex items-center gap-2">
            <File class="h-4 w-4 text-muted-foreground shrink-0" />
            <span class="font-medium truncate">{{ conflictInfo.existingNode.name }}</span>
          </div>
          <div v-if="conflictInfo.existingNode.fileSize" class="text-xs text-muted-foreground pl-6">
            大小: {{ formatFileSize(conflictInfo.existingNode.fileSize) }}
          </div>
          <div v-if="conflictInfo.existingNode.updatedAt" class="text-xs text-muted-foreground pl-6">
            更新: {{ conflictInfo.existingNode.updatedAt }}
          </div>
        </div>

        <DialogFooter class="flex-col sm:flex-row gap-2">
          <Button variant="outline" @click="resolveConflict(null)">取消</Button>
          <Button variant="outline" @click="resolveConflict('RENAME')">保留两者（重命名）</Button>
          <Button variant="destructive" @click="resolveConflict('OVERWRITE')">覆盖</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
