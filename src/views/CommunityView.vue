<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from 'vue-router'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Star, Flame, Award, Download, CopyPlus } from "lucide-vue-next"
import AgentCloneDialog from '@/components/business/AgentCloneDialog.vue'
import { toast } from 'vue-sonner'

const router = useRouter()

const agents = [
  {
    name: "代码审查专家",
    prompt: "Review the code in the 'src/' directory for potential security vulnerabilities and logical flaws.",
    description: "深度扫描 PR，识别安全漏洞和逻辑缺陷。",
    author: "官方",
    rating: 4.9,
    downloads: "12k",
    stats: [80, 90, 70, 60, 85, 75],
    tags: ["编程", "安全"]
  },
  {
    name: "数据分析助理",
    prompt: "Analyze the provided CSV/Excel files and generate a trend report.",
    description: "自动处理 CSV/Excel，生成可视化趋势报告。",
    author: "官方",
    rating: 4.8,
    downloads: "8.5k",
    stats: [95, 70, 60, 80, 65, 90],
    tags: ["办公", "数据"]
  },
  {
    name: "日志侦探",
    prompt: "Analyze cluster logs to identify the root cause of recent anomalies.",
    description: "从海量集群日志中精准定位异常根因。",
    author: "官方",
    rating: 4.7,
    downloads: "25k",
    stats: [70, 95, 85, 50, 90, 60],
    tags: ["运维", "故障排除"]
  }
]

const isCloneOpen = ref(false)
const selectedAgent = ref(null)

const openCloneDialog = (agent: any) => {
  selectedAgent.value = agent
  isCloneOpen.value = true
}

const handleClone = (clonedData: any) => {
  toast.success(`已克隆 Agent: "${clonedData.name}"`, {
    description: "正在跳转到指挥中心..."
  })
  // Redirect to home and pass prompt via query
  router.push({
    path: '/',
    query: { prompt: clonedData.prompt }
  })
}

const getRadarPoints = (stats: number[], radius: number) => {
  const center = 60
  return stats.map((val, i) => {
    const angle = (i * 60 - 90) * (Math.PI / 180)
    const r = (val / 100) * radius
    return (center + r * Math.cos(angle)).toFixed(2) + "," + (center + r * Math.sin(angle)).toFixed(2)
  }).join(" ")
}
</script>

<template>
  <div class="flex flex-col gap-8 max-w-7xl mx-auto py-8 px-4">
    <div class="flex flex-col md:flex-row gap-4 justify-between items-center">
      <div class="space-y-1 text-center md:text-left">
        <h1 class="text-3xl font-bold tracking-tight">Agent 社区</h1>
        <p class="text-muted-foreground">探索并克隆由官方和社区成员构建的精选模板</p>
      </div>
      <div class="relative w-full md:w-96">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="搜索 Agent 模板..." class="pl-10" />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card class="bg-orange-50/50 border-orange-200/50">
        <CardHeader class="pb-2">
          <div class="flex items-center gap-2 text-orange-600">
            <Flame class="h-5 w-5" />
            <span class="font-bold">热门飙升</span>
          </div>
        </CardHeader>
        <CardContent class="text-sm text-orange-700/80">本周下载量增长最快的 Agent</CardContent>
      </Card>
      <Card class="bg-blue-50/50 border-blue-200/50">
        <CardHeader class="pb-2">
          <div class="flex items-center gap-2 text-blue-600">
            <Award class="h-5 w-5" />
            <span class="font-bold">官方推荐</span>
          </div>
        </CardHeader>
        <CardContent class="text-sm text-blue-700/80">由专业团队打磨的高可靠模板</CardContent>
      </Card>
      <Card class="bg-purple-50/50 border-purple-200/50">
        <CardHeader class="pb-2">
          <div class="flex items-center gap-2 text-purple-600">
            <Star class="h-5 w-5" />
            <span class="font-bold">本月最佳</span>
          </div>
        </CardHeader>
        <CardContent class="text-sm text-purple-700/80">基于用户评分与任务成功率评选</CardContent>
      </Card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card v-for="agent in agents" :key="agent.name" class="overflow-hidden hover:shadow-lg transition-all border-primary/5 group">
        <CardHeader class="flex flex-row items-start gap-4 pb-4">
          <div class="flex-1 space-y-1">
            <div class="flex items-center gap-2">
              <CardTitle class="text-lg group-hover:text-primary transition-colors">{{ agent.name }}</CardTitle>
              <Badge variant="secondary" class="text-[10px] h-5">官方</Badge>
            </div>
            <CardDescription class="line-clamp-2 text-xs">{{ agent.description }}</CardDescription>
          </div>
          
          <div class="shrink-0">
            <svg width="100" height="100" viewBox="0 0 120 120" class="overflow-visible">
              <polygon :points="getRadarPoints([100,100,100,100,100,100], 48)" fill="none" stroke="currentColor" stroke-width="0.5" class="text-muted/30" />
              <polygon :points="getRadarPoints([100,100,100,100,100,100], 24)" fill="none" stroke="currentColor" stroke-width="0.5" class="text-muted/20" />
              <polygon :points="getRadarPoints(agent.stats, 48)" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="2" class="text-primary" />
            </svg>
          </div>
        </CardHeader>
        
        <CardContent>
          <div class="flex flex-wrap gap-2">
            <Badge v-for="tag in agent.tags" :key="tag" variant="outline" class="text-[10px]">{{ tag }}</Badge>
          </div>
        </CardContent>

        <CardFooter class="border-t bg-muted/5 p-4 flex items-center justify-between">
          <div class="flex items-center gap-4 text-xs text-muted-foreground">
            <div class="flex items-center gap-1"><Star class="h-3 w-3 text-yellow-500 fill-yellow-500" />{{ agent.rating }}</div>
            <div class="flex items-center gap-1"><Download class="h-3 w-3" />{{ agent.downloads }}</div>
          </div>
          <Button size="sm" class="h-8" @click="openCloneDialog(agent)">
            <CopyPlus class="mr-1.5 h-3.5 w-3.5" /> 克隆使用
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
  <AgentCloneDialog v-model:open="isCloneOpen" :agent="selectedAgent" @clone="handleClone" />
</template>