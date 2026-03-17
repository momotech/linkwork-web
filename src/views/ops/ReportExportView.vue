<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { reportsApi, type ReportExportType, type ReportExportFieldOption } from '@/api/reports'
import { Download, Loader2, ListFilter } from 'lucide-vue-next'

const exportType = ref<ReportExportType>('task')
const startTime = ref(defaultStartTime())
const endTime = ref(defaultEndTime())
const includeEventStream = ref(false)
const fieldOptions = ref<ReportExportFieldOption[]>([])
const selectedFields = ref<string[]>([])
const fieldsLoading = ref(false)
const exporting = ref(false)

const allSelected = computed(() =>
  fieldOptions.value.length > 0 && selectedFields.value.length === fieldOptions.value.length
)

const hasAnySelected = computed(() => selectedFields.value.length > 0)

const selectedSummary = computed(() =>
  `${selectedFields.value.length} / ${fieldOptions.value.length} 已选择`
)

function pad2(num: number): string {
  return String(num).padStart(2, '0')
}

function toDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function defaultStartTime(): string {
  const now = new Date()
  now.setHours(now.getHours() - 24)
  return toDateTimeLocalValue(now)
}

function defaultEndTime(): string {
  return toDateTimeLocalValue(new Date())
}

async function loadFieldOptions() {
  fieldsLoading.value = true
  try {
    const result = await reportsApi.listFields(exportType.value)
    fieldOptions.value = result.fields
    selectedFields.value = result.fields.map(field => field.field)
  } catch (error: any) {
    toast.error(error?.message || '获取字段列表失败')
    fieldOptions.value = []
    selectedFields.value = []
  } finally {
    fieldsLoading.value = false
  }
}

function selectAllFields() {
  selectedFields.value = fieldOptions.value.map(field => field.field)
}

function handleExportTypeChange(value: unknown) {
  if (value === 'task' || value === 'role') {
    exportType.value = value
  }
}

function clearAllFields() {
  selectedFields.value = []
}

function toggleField(field: string, checked: boolean) {
  if (checked) {
    if (!selectedFields.value.includes(field)) {
      selectedFields.value = [...selectedFields.value, field]
    }
    return
  }

  selectedFields.value = selectedFields.value.filter(item => item !== field)
}

function onFieldCheckedChange(field: string, checked: boolean | 'indeterminate') {
  toggleField(field, checked === true)
}

async function handleExport() {
  if (!startTime.value || !endTime.value) {
    toast.error('请选择导出时间范围')
    return
  }
  if (selectedFields.value.length === 0) {
    toast.error('请至少选择一个导出字段')
    return
  }

  exporting.value = true
  try {
    const fileName = await reportsApi.exportCsv({
      type: exportType.value,
      startTime: startTime.value,
      endTime: endTime.value,
      fields: selectedFields.value,
      includeEventStream: exportType.value === 'task' ? includeEventStream.value : false,
    })
    toast.success(`导出成功：${fileName}`)
  } catch (error: any) {
    toast.error(error?.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

watch(exportType, (value) => {
  if (value !== 'task') {
    includeEventStream.value = false
  }
  void loadFieldOptions()
})

onMounted(() => {
  void loadFieldOptions()
})
</script>

<template>
  <div class="space-y-6">
    <Card class="border-border/60">
      <CardHeader>
        <CardTitle class="text-lg flex items-center gap-2">
          <Download class="h-5 w-5 text-primary" />
          报表导出
        </CardTitle>
        <CardDescription>
          支持按时间范围导出任务执行记录或岗位数据，字段可自定义选择。
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="space-y-2">
            <Label>导出类型</Label>
            <Select :model-value="exportType" @update:model-value="handleExportTypeChange">
              <SelectTrigger>
                <SelectValue placeholder="请选择导出类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">任务执行记录</SelectItem>
                <SelectItem value="role">岗位数据</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>开始时间</Label>
            <Input v-model="startTime" type="datetime-local" step="1" />
          </div>

          <div class="space-y-2">
            <Label>结束时间</Label>
            <Input v-model="endTime" type="datetime-local" step="1" />
          </div>
        </div>

        <div
          v-if="exportType === 'task'"
          class="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
        >
          <div class="space-y-1">
            <p class="text-sm font-medium">附带消息流</p>
            <p class="text-xs text-muted-foreground">
              导出任务对应的 Redis 消息总线全量事件（追加 eventStream 列）。
            </p>
          </div>
          <Switch v-model="includeEventStream" />
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ListFilter class="h-4 w-4 text-muted-foreground" />
              <span class="font-medium text-sm">导出字段</span>
              <span class="text-xs text-muted-foreground">{{ selectedSummary }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" :disabled="fieldOptions.length === 0" @click="clearAllFields">
                清空
              </Button>
              <Button variant="outline" size="sm" :disabled="fieldOptions.length === 0 || allSelected" @click="selectAllFields">
                全选
              </Button>
            </div>
          </div>

          <div class="rounded-lg border border-border/60">
            <ScrollArea class="h-64">
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
                <label
                  v-for="field in fieldOptions"
                  :key="field.field"
                  class="flex items-start gap-2 rounded-md border border-border/50 bg-background px-2.5 py-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Checkbox
                    :checked="selectedFields.includes(field.field)"
                    class="mt-0.5"
                    @update:checked="(checked: boolean | 'indeterminate') => onFieldCheckedChange(field.field, checked)"
                  />
                  <div class="min-w-0">
                    <p class="text-xs font-medium leading-tight truncate">{{ field.label }}</p>
                    <p class="text-[11px] text-muted-foreground mt-0.5 truncate">{{ field.field }} · {{ field.javaType }}</p>
                  </div>
                </label>

                <div
                  v-if="fieldsLoading"
                  class="col-span-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-6"
                >
                  <Loader2 class="h-4 w-4 animate-spin" />
                  字段加载中...
                </div>

                <div
                  v-if="!fieldsLoading && fieldOptions.length === 0"
                  class="col-span-full text-sm text-muted-foreground py-6 text-center"
                >
                  暂无可导出字段
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <div class="flex justify-end">
          <Button :disabled="exporting || fieldsLoading || !hasAnySelected" class="min-w-32" @click="handleExport">
            <Loader2 v-if="exporting" class="h-4 w-4 mr-2 animate-spin" />
            <Download v-else class="h-4 w-4 mr-2" />
            {{ exporting ? '导出中...' : '导出 CSV' }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
