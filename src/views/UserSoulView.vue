<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { toast } from "vue-sonner"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sparkles, PenLine, Save, RotateCcw, Plus, Trash2 } from "lucide-vue-next"
import { useUser } from "@/composables/useUser"

interface SoulPreset {
  id: string
  name: string
  description: string
  content: string
  isCustom?: boolean
  createdAt?: string
}

interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

interface SoulPayload {
  content: string
  presetId?: string
  version: number
  updatedAt?: string
}

const builtinPresets: SoulPreset[] = [
  {
    id: "pragmatic-partner",
    name: "务实搭档",
    description: "先给可执行结论，再补关键风险与备选方案。",
    content: `你是我的务实协作搭档。\n先给结论，再给行动步骤。\n遇到不确定事项必须明确假设，不要模糊表达。\n优先帮助我快速推进任务，而不是泛泛解释。`
  },
  {
    id: "strict-architect",
    name: "严谨架构师",
    description: "重视边界、约束和可维护性，避免拍脑袋改动。",
    content: `你是一个严谨的系统架构师。\n回答时优先说明边界条件与技术约束。\n所有方案都需要指出收益、代价和回滚策略。\n拒绝吞异常和不透明实现。`
  },
  {
    id: "delivery-driver",
    name: "交付推进官",
    description: "面向上线结果，强调闭环、验收和发布时间线。",
    content: `你是我的交付推进官。\n沟通围绕“下一步做什么、谁来做、何时完成”。\n每次变更都要给出验证方式与发布步骤。\n默认追求可落地、可验证、可回滚。`
  }
]

const { currentUserId } = useUser()

const customPresets = ref<SoulPreset[]>([])
const selectedPresetId = ref<string>(builtinPresets[0].id)
const soulContent = ref<string>(builtinPresets[0].content)
const updatedAt = ref<string>("")
const soulVersion = ref<number>(0)
const isSaving = ref(false)

const isCreatingPreset = ref(false)
const newPresetName = ref("")
const newPresetDescription = ref("")

const userScope = computed(() => currentUserId.value || "anonymous")
const customPresetStorageKey = computed(() => `linkwork:user-soul-presets:${userScope.value}`)
const allPresets = computed(() => [...builtinPresets, ...customPresets.value])

const canSave = computed(() => soulContent.value.trim().length > 0)
const canCreatePreset = computed(() => newPresetName.value.trim().length > 0 && soulContent.value.trim().length > 0)

const formattedUpdatedAt = computed(() => {
  if (!updatedAt.value) return "未保存"
  const date = new Date(updatedAt.value)
  if (Number.isNaN(date.getTime())) return "未保存"
  return date.toLocaleString("zh-CN", { hour12: false })
})

const loadCustomPresets = () => {
  const raw = localStorage.getItem(customPresetStorageKey.value)
  if (!raw) {
    customPresets.value = []
    return
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      customPresets.value = []
      return
    }
    customPresets.value = parsed
      .filter((item): item is SoulPreset => {
        return item && typeof item.id === "string" && typeof item.name === "string" && typeof item.content === "string"
      })
      .map((item) => ({
        id: item.id,
        name: item.name.trim() || "未命名模板",
        description: typeof item.description === "string" ? item.description : "",
        content: item.content,
        isCustom: true,
        createdAt: item.createdAt
      }))
  } catch {
    customPresets.value = []
  }
}

const persistCustomPresets = () => {
  localStorage.setItem(customPresetStorageKey.value, JSON.stringify(customPresets.value))
}

const resetSoulToDefault = () => {
  selectedPresetId.value = builtinPresets[0].id
  soulContent.value = builtinPresets[0].content
  updatedAt.value = ""
  soulVersion.value = 0
}

const parseResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  const payload = await response.json().catch(() => null)
  if (!payload || typeof payload !== "object") {
    throw new Error("服务返回异常，请稍后重试")
  }
  return payload as ApiResponse<T>
}

const loadSoul = async () => {
  if (!currentUserId.value) {
    resetSoulToDefault()
    return
  }
  try {
    const response = await fetch("/api/v1/users/me/soul", {
      method: "GET",
      credentials: "include"
    })
    if (!response.ok) {
      resetSoulToDefault()
      return
    }
    const payload = await parseResponse<SoulPayload>(response)
    if (payload.code !== 0 || !payload.data) {
      resetSoulToDefault()
      return
    }

    const remote = payload.data
    const presetExists = allPresets.value.some((item) => item.id === remote.presetId)
    selectedPresetId.value = presetExists ? (remote.presetId as string) : builtinPresets[0].id
    soulContent.value = typeof remote.content === "string" && remote.content.trim()
      ? remote.content
      : builtinPresets[0].content
    updatedAt.value = typeof remote.updatedAt === "string" ? remote.updatedAt : ""
    soulVersion.value = typeof remote.version === "number" ? remote.version : 0
  } catch {
    resetSoulToDefault()
  }
}

const loadAll = async () => {
  loadCustomPresets()
  await loadSoul()
}

const applyPreset = (preset: SoulPreset) => {
  selectedPresetId.value = preset.id
  soulContent.value = preset.content
}

const restorePreset = () => {
  const currentPreset = allPresets.value.find((item) => item.id === selectedPresetId.value) || builtinPresets[0]
  soulContent.value = currentPreset.content
  toast.success("已恢复到模板内容")
}

const saveSoul = async () => {
  if (!canSave.value) {
    toast.error("Soul 内容不能为空")
    return
  }
  if (!currentUserId.value) {
    toast.error("请先登录后再保存 Soul")
    return
  }
  isSaving.value = true
  try {
    const response = await fetch("/api/v1/users/me/soul", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        presetId: selectedPresetId.value,
        content: soulContent.value.trim(),
        version: soulVersion.value
      })
    })
    const payload = await parseResponse<SoulPayload>(response)
    if (!response.ok || payload.code !== 0 || !payload.data) {
      throw new Error(payload.msg || "保存失败，请稍后重试")
    }

    selectedPresetId.value = payload.data.presetId || selectedPresetId.value
    updatedAt.value = payload.data.updatedAt || ""
    soulVersion.value = typeof payload.data.version === "number" ? payload.data.version : soulVersion.value
    toast.success("用户 Soul 已保存")
  } catch (error: any) {
    toast.error(error?.message || "保存失败，请稍后重试")
  } finally {
    isSaving.value = false
  }
}

const createCustomPreset = () => {
  if (!canCreatePreset.value) {
    toast.error("模板名和 Soul 内容不能为空")
    return
  }

  const newPreset: SoulPreset = {
    id: `custom-${Date.now()}`,
    name: newPresetName.value.trim(),
    description: newPresetDescription.value.trim(),
    content: soulContent.value.trim(),
    isCustom: true,
    createdAt: new Date().toISOString()
  }

  customPresets.value = [newPreset, ...customPresets.value]
  persistCustomPresets()
  selectedPresetId.value = newPreset.id
  isCreatingPreset.value = false
  newPresetName.value = ""
  newPresetDescription.value = ""
  toast.success("已保存为自定义模板")
}

const removeCustomPreset = (presetId: string) => {
  customPresets.value = customPresets.value.filter((item) => item.id !== presetId)
  persistCustomPresets()
  if (selectedPresetId.value === presetId) {
    selectedPresetId.value = builtinPresets[0].id
  }
  toast.success("已删除自定义模板")
}

const cancelCreatePreset = () => {
  isCreatingPreset.value = false
  newPresetName.value = ""
  newPresetDescription.value = ""
}

watch(userScope, () => {
  void loadAll()
}, { immediate: true })
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
    <div class="space-y-1">
      <h1 class="text-3xl font-bold tracking-tight">用户 Soul</h1>
      <p class="text-sm text-muted-foreground">选择模板后可自由编辑，并支持保存为你的自定义模板。</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader class="pb-3">
          <CardTitle class="flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-primary" />
            模板库
          </CardTitle>
          <CardDescription>官方模板 + 你的自定义模板</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div
            v-for="preset in allPresets"
            :key="preset.id"
            class="cursor-pointer rounded-lg border p-3 transition-colors"
            :class="selectedPresetId === preset.id ? 'border-primary bg-primary/5' : 'hover:border-primary/40'"
            @click="applyPreset(preset)"
          >
            <div class="mb-1 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ preset.name }}</span>
                <Badge v-if="preset.isCustom" variant="outline" class="text-[10px]">自定义</Badge>
                <Badge v-if="selectedPresetId === preset.id" variant="secondary" class="text-[10px]">当前</Badge>
              </div>
              <Button
                v-if="preset.isCustom"
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-muted-foreground hover:text-destructive"
                @click.stop="removeCustomPreset(preset.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </div>
            <p class="text-xs leading-relaxed text-muted-foreground">{{ preset.description || "无模板说明" }}</p>
          </div>

          <div class="rounded-lg border border-dashed p-3">
            <div v-if="!isCreatingPreset" class="flex items-center justify-between">
              <p class="text-xs text-muted-foreground">将当前编辑内容保存为个人模板</p>
              <Button variant="outline" size="sm" class="h-7 text-xs" @click="isCreatingPreset = true">
                <Plus class="mr-1 h-3.5 w-3.5" />
                新增模板
              </Button>
            </div>

            <div v-else class="space-y-2">
              <Input v-model="newPresetName" placeholder="模板名称（必填）" />
              <Input v-model="newPresetDescription" placeholder="模板说明（可选）" />
              <div class="flex justify-end gap-2">
                <Button variant="ghost" size="sm" @click="cancelCreatePreset">取消</Button>
                <Button size="sm" :disabled="!canCreatePreset" @click="createCustomPreset">保存模板</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <PenLine class="h-4 w-4 text-primary" />
            Soul 编辑器
          </CardTitle>
          <CardDescription>最后保存时间：{{ formattedUpdatedAt }}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            v-model="soulContent"
            :rows="16"
            placeholder="在这里输入你的用户 Soul..."
            class="min-h-[320px] leading-relaxed"
          />
        </CardContent>
        <CardFooter class="flex items-center justify-end gap-2">
          <Button variant="outline" @click="restorePreset">
            <RotateCcw class="mr-1 h-4 w-4" />
            恢复模板
          </Button>
          <Button :disabled="!canSave || isSaving" @click="saveSoul">
            <Save class="mr-1 h-4 w-4" />
            {{ isSaving ? "保存中..." : "保存 Soul" }}
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
