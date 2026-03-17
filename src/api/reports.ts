import { get } from '@/utils/http'

export type ReportExportType = 'task' | 'role'

export interface ReportExportFieldOption {
  field: string
  column: string
  label: string
  javaType: string
}

export interface ReportExportFieldResponse {
  type: ReportExportType
  fields: ReportExportFieldOption[]
}

export interface ReportExportPayload {
  type: ReportExportType
  startTime: string
  endTime: string
  fields: string[]
  includeEventStream?: boolean
}

interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

function parseAttachmentFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] || null
}

async function resolveErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const result = await response.json() as ApiResponse<unknown>
      return result.msg || `导出失败 (${response.status})`
    } catch {
      return `导出失败 (${response.status})`
    }
  }

  try {
    const text = await response.text()
    return text || `导出失败 (${response.status})`
  } catch {
    return `导出失败 (${response.status})`
  }
}

export const reportsApi = {
  async listFields(type: ReportExportType): Promise<ReportExportFieldResponse> {
    const res = await get<ReportExportFieldResponse>(`/api/v1/reports/export/fields?type=${type}`)
    if (res.code !== 0) {
      throw new Error(res.msg || '获取可导出字段失败')
    }
    return res.data
  },

  async exportCsv(payload: ReportExportPayload): Promise<string> {
    const response = await fetch('/api/v1/reports/export', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(await resolveErrorMessage(response))
    }

    const blob = await response.blob()
    const fileName = parseAttachmentFileName(response.headers.get('content-disposition'))
      || `${payload.type}-report.csv`
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(blobUrl)

    return fileName
  },
}
