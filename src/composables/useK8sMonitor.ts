import { ref } from 'vue'
import { get, request } from '@/utils/http'

export interface ClusterOverview {
  namespace: string
  totalPods: number
  runningPods: number
  pendingPods: number
  failedPods: number
  succeededPods: number
  totalCpuMillicores: number
  usedCpuMillicores: number
  cpuUsagePercent: number | null
  totalMemoryBytes: number
  usedMemoryBytes: number
  memoryUsagePercent: number | null
  podGroupCount: number
  nodeCount: number
}

export interface ClusterNodeInfo {
  name: string
  status: string
  roles: string[]
  kubeletVersion: string
  cpuCapacity: number
  cpuAllocatable: number
  cpuUsage: number
  cpuUsagePercent: number | null
  memCapacity: number
  memAllocatable: number
  memUsage: number
  memUsagePercent: number | null
  podCount: number
  podCapacity: number
}

export interface ContainerInfo {
  name: string
  ready: boolean
  state: string
  reason: string | null
  exitCode: number | null
  restartCount: number
  resourceUsage: ResourceUsage | null
}

export interface ResourceUsage {
  cpuUsage: string | null
  memoryUsage: string | null
  cpuMillicores: number
  memoryBytes: number
}

export interface ClusterPodInfo {
  name: string
  namespace: string
  phase: string
  nodeName: string | null
  podGroupName: string | null
  podGroupPhase: string | null
  serviceId: string | null
  userId: string | null
  containers: ContainerInfo[]
  restartCount: number
  startTime: string | null
  age: string
  images: string[]
  resourceUsage: ResourceUsage | null
}

export interface PodGroupInfo {
  name: string
  phase: string
  minMember: number | null
  running: number
  succeeded: number
  failed: number
  pending: number
}

export interface ClusterEvent {
  type: string
  reason: string
  message: string
  objectKind: string | null
  objectName: string | null
  namespace: string | null
  firstTimestamp: string | null
  lastTimestamp: string | null
  count: number | null
}

export interface PodLogResponse {
  podName: string
  namespace: string
  containerName: string | null
  logs: string
  tailLines: number
}

const BASE = '/api/v1/k8s-monitor'

export function useK8sMonitor() {
  const currentNamespace = ref('ai-worker')
  const namespaces = ref<string[]>([])
  const overview = ref<ClusterOverview | null>(null)
  const nodes = ref<ClusterNodeInfo[]>([])
  const pods = ref<ClusterPodInfo[]>([])
  const podGroups = ref<PodGroupInfo[]>([])
  const events = ref<ClusterEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasAccess = ref<boolean | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let destroyed = false
  let abortCtrl: AbortController | null = null

  function getSignal(): AbortSignal {
    abortCtrl = new AbortController()
    return abortCtrl.signal
  }

  async function safeFetch<T>(url: string, signal?: AbortSignal) {
    const res = await fetch(url, { credentials: 'include', signal })
    if (res.status === 401) throw new Error('Unauthorized')
    return (await res.json()) as { code: number; data: T }
  }

  async function checkAccess(): Promise<boolean> {
    try {
      const res = await get<boolean>(`${BASE}/access-check`)
      hasAccess.value = res.code === 0 && res.data === true
      return hasAccess.value
    } catch {
      hasAccess.value = false
      return false
    }
  }

  async function fetchNamespaces() {
    try {
      const res = await get<string[]>(`${BASE}/namespaces`)
      if (!destroyed && res.code === 0) namespaces.value = res.data
    } catch (e: any) {
      if (!destroyed) error.value = e.message
    }
  }

  async function refresh() {
    if (destroyed) return
    loading.value = true
    error.value = null
    const ns = currentNamespace.value
    const signal = getSignal()
    try {
      const [ovRes, ndRes, pdRes, pgRes] = await Promise.all([
        safeFetch<ClusterOverview>(`${BASE}/overview?namespace=${ns}`, signal),
        safeFetch<ClusterNodeInfo[]>(`${BASE}/nodes`, signal),
        safeFetch<ClusterPodInfo[]>(`${BASE}/pods?namespace=${ns}`, signal),
        safeFetch<PodGroupInfo[]>(`${BASE}/podgroups?namespace=${ns}`, signal),
      ])
      if (destroyed) return
      if (ovRes.code === 0) overview.value = ovRes.data
      if (ndRes.code === 0) nodes.value = ndRes.data
      if (pdRes.code === 0) pods.value = pdRes.data
      if (pgRes.code === 0) podGroups.value = pgRes.data
    } catch (e: any) {
      if (destroyed || e.name === 'AbortError') return
      error.value = e.message
    } finally {
      if (!destroyed) loading.value = false
    }
  }

  async function fetchEvents() {
    const ns = currentNamespace.value
    try {
      const res = await get<ClusterEvent[]>(`${BASE}/events?namespace=${ns}&limit=30`)
      if (!destroyed && res.code === 0) events.value = res.data
    } catch (e: any) {
      if (!destroyed) error.value = e.message
    }
  }

  function setNamespace(ns: string) {
    currentNamespace.value = ns
    refresh()
  }

  async function fetchPodLogs(podName: string, container: string, tailLines: number): Promise<PodLogResponse | null> {
    const ns = currentNamespace.value
    let url = `${BASE}/pods/${podName}/logs?namespace=${ns}&tailLines=${tailLines}`
    if (container) url += `&container=${container}`
    const res = await get<PodLogResponse>(url)
    return res.code === 0 ? res.data : null
  }

  async function fetchPodEvents(podName: string): Promise<ClusterEvent[]> {
    const ns = currentNamespace.value
    const res = await get<ClusterEvent[]>(`${BASE}/pods/${podName}/events?namespace=${ns}`)
    return res.code === 0 ? res.data : []
  }

  async function deletePod(podName: string): Promise<boolean> {
    const ns = currentNamespace.value
    const res = await request<string>(`${BASE}/pods/${podName}?namespace=${ns}`, { method: 'DELETE' })
    if (res.code === 0) {
      await refresh()
      return true
    }
    return false
  }

  function startPolling(intervalMs = 30000) {
    stopPolling()
    pollTimer = setInterval(refresh, intervalMs)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function destroy() {
    destroyed = true
    stopPolling()
    if (abortCtrl) {
      abortCtrl.abort()
      abortCtrl = null
    }
  }

  return {
    currentNamespace, namespaces, overview, nodes, pods, podGroups, events,
    loading, error, hasAccess,
    checkAccess, fetchNamespaces, setNamespace, refresh, fetchEvents,
    fetchPodLogs, fetchPodEvents, deletePod, startPolling, stopPolling, destroy,
  }
}
