export type RuntimeMode = 'SIDECAR' | 'ALONE'
export type ZzMode = 'ssh' | 'local'

export interface RuntimeProfile {
  runtimeMode: RuntimeMode
  zzMode: ZzMode
  runnerImage: string | null
}

const DEFAULT_SIDECAR_RUNNER_IMAGE = 'ubuntu:22.04'

const ZZ_MODE_BY_RUNTIME: Record<RuntimeMode, ZzMode> = {
  SIDECAR: 'ssh',
  ALONE: 'local'
}

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const parseRuntimeMode = (value: unknown): RuntimeMode | null => {
  const normalized = normalizeString(value)?.toUpperCase()
  if (normalized === 'SIDECAR' || normalized === 'ALONE') {
    return normalized
  }
  return null
}

export const parseZzMode = (value: unknown): ZzMode | null => {
  const normalized = normalizeString(value)?.toLowerCase()
  if (normalized === 'ssh' || normalized === 'local') {
    return normalized
  }
  return null
}

export const validateRuntimeProfile = (
  source: { runtimeMode?: unknown; zzMode?: unknown; runnerImage?: unknown; image?: unknown },
  context: string
): RuntimeProfile => {
  const runtimeMode = parseRuntimeMode(source.runtimeMode)
  if (!runtimeMode) {
    throw new Error(`${context} missing runtimeMode, expected SIDECAR or ALONE`)
  }

  const expectedZzMode = ZZ_MODE_BY_RUNTIME[runtimeMode]
  // 历史数据可能缺失/错填 zzMode，前端统一按 runtimeMode 推导，避免误报配置异常。
  const parsedZzMode = parseZzMode(source.zzMode)
  const zzMode = parsedZzMode === expectedZzMode ? parsedZzMode : expectedZzMode

  const explicitRunnerImage = normalizeString(source.runnerImage)
  const imageFallback = normalizeString(source.image)
  const runnerImage = runtimeMode === 'SIDECAR'
    ? (explicitRunnerImage || imageFallback || DEFAULT_SIDECAR_RUNNER_IMAGE)
    : null

  return {
    runtimeMode,
    zzMode,
    runnerImage
  }
}
