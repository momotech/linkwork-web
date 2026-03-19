/**
 * 统一 HTTP 客户端
 * 
 * - credentials: 'include' 自动携带 Cookie（JWT Token）
 * - 401 响应自动跳转登录页
 * - 统一错误处理和响应格式
 */

export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
  traceId?: string
  timestamp?: string
}

/**
 * 统一请求方法
 * 自动携带 Cookie、处理 401 跳转、解析响应
 */
export async function request<T = any>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    redirectToLogin()
    throw new Error('Unauthorized')
  }

  return res.json()
}

/**
 * GET 请求
 */
export async function get<T = any>(url: string): Promise<ApiResponse<T>> {
  return request<T>(url)
}

/**
 * POST 请求
 */
export async function post<T = any>(url: string, body?: any): Promise<ApiResponse<T>> {
  return request<T>(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * PUT 请求
 */
export async function put<T = any>(url: string, body?: any): Promise<ApiResponse<T>> {
  return request<T>(url, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * DELETE 请求
 */
export async function del<T = any>(url: string): Promise<ApiResponse<T>> {
  return request<T>(url, { method: 'DELETE' })
}

/**
 * 跳转到登录页
 */
export function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}
