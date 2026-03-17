export type SpaceType = 'USER' | 'WORKSTATION'
export type ParseStatus = 'NONE' | 'PARSING' | 'PARSED' | 'FAILED' | 'SKIP'
export type MemoryIndexStatus = 'NONE' | 'INDEXING' | 'INDEXED' | 'FAILED'

export interface FileItem {
  fileId: string
  fileName: string
  fileSize: number
  fileType: string
  contentType: string
  spaceType: SpaceType
  workstationId?: string
  parseStatus: ParseStatus
  memoryIndexStatus: MemoryIndexStatus
  createdAt: string
}

export interface FileMentionItem {
  fileId: string
  fileName: string
  fileType: string
  fileSize: number
  spaceType: SpaceType
  createdAt: string
}

export interface FileListParams {
  spaceType: SpaceType
  workstationId?: string
  fileType?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface FileListResult {
  items: FileItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type ConflictPolicy = 'REJECT' | 'OVERWRITE' | 'RENAME'

export interface FileTransferParams {
  targetSpaceType: SpaceType
  targetWorkstationId?: string
  targetParentId?: string | null
  conflictPolicy?: ConflictPolicy
  newName?: string
  /** @deprecated use conflictPolicy instead */
  overwrite?: boolean
}

export type EntryType = 'FILE' | 'DIR'

export interface FileNodeItem {
  nodeId: string
  parentId: string | null
  entryType: EntryType
  name: string
  spaceType: SpaceType
  workstationId?: string
  fileId?: string
  fileSize?: number
  fileType?: string
  parseStatus?: string
  memoryIndexStatus?: string
  createdAt: string
  updatedAt: string
  hasChildren: boolean
}

export interface CreateFolderParams {
  name: string
  spaceType: SpaceType
  workstationId?: string
  parentId?: string | null
}

export interface FileSpaceSyncResult {
  spaceType: SpaceType
  workstationId?: string
  scannedCount: number
  syncedCount: number
  skippedCount: number
}

export interface ConflictInfo {
  conflictType: string
  existingNode: {
    fileId: string
    name: string
    entryType: string
    fileSize?: number
    updatedAt?: string
  }
}

interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

export class FileConflictError extends Error {
  public readonly conflict: ConflictInfo

  constructor(msg: string, conflict: ConflictInfo) {
    super(msg)
    this.name = 'FileConflictError'
    this.conflict = conflict
  }
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const result: ApiResponse<T> = await response.json()

  if (result.code === 40901) {
    throw new FileConflictError(result.msg || '文件同名冲突', result.data as unknown as ConflictInfo)
  }

  if (!response.ok || result.code !== 0) {
    throw new Error(result.msg || `请求失败: ${response.status}`)
  }
  return result.data
}

export const fileManagerApi = {
  async uploadFile(
    file: File,
    spaceType: SpaceType,
    workstationId?: string,
    conflictPolicy?: ConflictPolicy,
    parentId?: string | null
  ): Promise<FileItem> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('spaceType', spaceType)
    if (workstationId) {
      formData.append('workstationId', workstationId)
    }
    if (conflictPolicy) {
      formData.append('conflictPolicy', conflictPolicy)
    }
    if (parentId) {
      formData.append('parentId', parentId)
    }

    const response = await fetch('/api/v1/files/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    return parseResponse<FileItem>(response)
  },

  async listFiles(params: FileListParams): Promise<FileListResult> {
    const searchParams = new URLSearchParams()
    searchParams.set('spaceType', params.spaceType)
    if (params.workstationId) searchParams.set('workstationId', params.workstationId)
    if (params.fileType) searchParams.set('fileType', params.fileType)
    if (params.keyword) searchParams.set('keyword', params.keyword)
    if (params.page) searchParams.set('page', String(params.page))
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))

    const response = await fetch(`/api/v1/files?${searchParams.toString()}`, {
      credentials: 'include'
    })

    return parseResponse<FileListResult>(response)
  },

  async getFileDetail(fileId: string): Promise<FileItem> {
    const response = await fetch(`/api/v1/files/${fileId}`, {
      credentials: 'include'
    })

    return parseResponse<FileItem>(response)
  },

  getDownloadUrl(fileId: string): string {
    return `/api/v1/files/${fileId}/download`
  },

  getPreviewUrl(fileId: string): string {
    return `/api/v1/files/${fileId}/download?inline=true`
  },

  async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`/api/v1/files/${fileId}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    await parseResponse<null>(response)
  },

  async reuploadFile(fileId: string, file: File): Promise<FileItem> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/v1/files/${fileId}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData
    })

    return parseResponse<FileItem>(response)
  },

  async copyFile(fileId: string, params: FileTransferParams): Promise<FileItem> {
    const response = await fetch(`/api/v1/files/${fileId}/copy`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    return parseResponse<FileItem>(response)
  },

  async moveFile(fileId: string, params: FileTransferParams): Promise<FileItem> {
    const response = await fetch(`/api/v1/files/${fileId}/move`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    return parseResponse<FileItem>(response)
  },

  async getMentionFiles(workstationId: string, keyword?: string): Promise<FileMentionItem[]> {
    const searchParams = new URLSearchParams()
    searchParams.set('workstationId', workstationId)
    if (keyword) searchParams.set('keyword', keyword)

    const response = await fetch(`/api/v1/files/mention?${searchParams.toString()}`, {
      credentials: 'include'
    })

    return parseResponse<FileMentionItem[]>(response)
  },

  async listTree(
    spaceType: SpaceType,
    workstationId?: string,
    parentId?: string | null
  ): Promise<FileNodeItem[]> {
    const searchParams = new URLSearchParams()
    searchParams.set('spaceType', spaceType)
    if (workstationId) searchParams.set('workstationId', workstationId)
    if (parentId) searchParams.set('parentId', parentId)

    const response = await fetch(`/api/v1/files/tree?${searchParams.toString()}`, {
      credentials: 'include'
    })

    return parseResponse<FileNodeItem[]>(response)
  },

  async createFolder(params: CreateFolderParams): Promise<FileNodeItem> {
    const response = await fetch('/api/v1/files/folders', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    return parseResponse<FileNodeItem>(response)
  },

  async renameNode(nodeId: string, name: string): Promise<void> {
    const response = await fetch(`/api/v1/files/nodes/${nodeId}/rename`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })

    await parseResponse<null>(response)
  },

  async deleteNode(nodeId: string): Promise<void> {
    const response = await fetch(`/api/v1/files/nodes/${nodeId}`, {
      method: 'DELETE',
      credentials: 'include'
    })

    await parseResponse<null>(response)
  },

  async syncSpace(spaceType: SpaceType, workstationId?: string): Promise<FileSpaceSyncResult> {
    const response = await fetch('/api/v1/files/sync', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spaceType,
        workstationId: spaceType === 'WORKSTATION' ? workstationId : undefined
      })
    })

    return parseResponse<FileSpaceSyncResult>(response)
  }
}
