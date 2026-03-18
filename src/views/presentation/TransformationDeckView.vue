<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, ArrowDown, Bot, Box, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Cpu, Database, FileText, GitBranch, Layers, Monitor, Server, ShieldCheck, Sparkles, Users, Wrench, Activity, Zap, Eye, Lock, RefreshCw, Package } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const router = useRouter()

const slides = [
  { id: 'cover', label: '封面', title: '从 Agent 应用到 Agent 工厂' },
  { id: 'problem', label: '问题定义', title: 'Agent 的难题不只是 prompt' },
  { id: 'traditional', label: '传统路线', title: '为什么越做越像手工作坊' },
  { id: 'compare', label: '行业对比', title: '编排 vs 装配与治理' },
  { id: 'contrast', label: '对照总图', title: '作坊 vs 工厂，一图看懂' },
  { id: 'three-layer', label: '三层架构', title: '工厂化的是能力装配过程' },
  { id: 'infra', label: '企业基建', title: '可控、可管、可复用' },
  { id: 'amplify', label: '放大智能', title: '不替代模型，放大交付能力' },
  { id: 'hiring', label: '雇佣流程', title: '业务线拿到的是 AI 员工' },
  { id: 'role-build', label: '岗位装配', title: '一个 AI 岗位怎么装出来' },
  { id: 'value', label: '价值收束', title: '从项目制走向资产化' },
  { id: 'closing', label: '结尾', title: '企业级Agent工厂' },
] as const

const projectStats = [
  { label: '架构与协同', value: '15 天', detail: '架构设计、资源协调、各端范式定义' },
  { label: 'MVP 交付', value: '25 天', detail: '纯 vibe coding 交付 MVP 并上线' },
  { label: '运行模式', value: '2 模式', detail: '双容器隔离 / 单容器直连' },
]

const problemDimensions = [
  {
    title: '智能能力维度',
    accent: 'border-orange-200/70 bg-orange-500/8 dark:border-orange-500/20',
    accentText: 'text-orange-700 dark:text-orange-300',
    icon: Sparkles,
    points: [
      '基座模型的推理与规划能力',
      '行业数据 + 微调 + few-shot 构建领域理解',
      '领域评测验证智能水平',
    ],
  },
  {
    title: '工程系统维度',
    accent: 'border-cyan-200/70 bg-cyan-500/8 dark:border-cyan-500/20',
    accentText: 'text-cyan-700 dark:text-cyan-300',
    icon: Server,
    points: [
      '上下文工程与长期记忆管理',
      '工具标准化接入与权限隔离',
      '执行环境安全、审批与审计',
      '全程观测与任务卷宗',
      '专家经验的资产化与复用',
    ],
  },
]

const traditionalPains = [
  { title: '重复搭建', desc: '每个场景都重新拼 prompt、tool、memory、权限，没有统一底座。', icon: RefreshCw },
  { title: '知识散落', desc: '领域知识和策略散在具体 agent 代码里，换场景无法复用。', icon: Database },
  { title: '安全后补', desc: '安全、审批、审计往往在出事后才临时拼装，不是默认能力。', icon: ShieldCheck },
  { title: '经验锁死', desc: '专家经验沉在少数人脑子里和业务代码中，无法跨团队流转。', icon: Users },
  { title: '换场景从零开始', desc: '换一个团队、换一个业务，几乎要从头再来一遍。', icon: Wrench },
]

const platformCompare = [
  {
    name: 'LangChain / 手搓 Workflow',
    position: 'SDK / 编排层',
    desc: '提供编排原语和工具调用链路，开发者在其上自己搭建完整系统。',
    icon: GitBranch,
    color: 'border-slate-200/70 bg-slate-500/8 dark:border-slate-500/20',
  },
  {
    name: 'Dify / Coze',
    position: '低门槛应用搭建平台',
    desc: '提供可视化编排和快速上线能力，适合轻量场景和个人用户。',
    icon: Box,
    color: 'border-purple-200/70 bg-purple-500/8 dark:border-purple-500/20',
  },
  {
    name: '企业级Agent工厂',
    position: '执行底座 + 治理系统 + 资产工厂',
    desc: '提供安全执行环境、策略治理、全程观测和岗位资产化，面向企业规模化交付。',
    icon: Cpu,
    color: 'border-primary/30 bg-primary/8',
    highlight: true,
  },
]

const contrastRows = [
  { dim: '安全边界', left: '每个项目临时拼装沙箱、权限与审计', right: 'zz 统一提供安全通道、策略引擎、审批链路', icon: ShieldCheck },
  { dim: '工具接入', left: 'API、脚本、环境变量全部揉在一起', right: 'MCP 标准化原子工具，独立演进', icon: Server },
  { dim: '上下文 / 记忆', left: '长任务靠人肉续上下文，历史知识丢弃', right: '文件工作区 + Memory Plugin 按需挂载', icon: Database },
  { dim: '观测与审批', left: '只看最终输出，无法定位出错层级', right: '全程直播、旁路审批、任务卷宗可回放', icon: Monitor },
  { dim: '专家经验', left: 'Prompt 和 Skill 锁在少数人和业务代码里', right: 'Skill 沉淀 SOP，岗位封装完整能力包', icon: Sparkles },
  { dim: '复用方式', left: '换团队、换场景，几乎从头再来', right: '岗位资产可被业务线直接雇佣', icon: Users },
  { dim: '交付速度', left: '每做一个 Agent 都要重搭一遍基础设施', right: '底座通用化，业务只需组装资产、定义目标', icon: Activity },
  { dim: '最终交付物', left: '一个个项目制黑盒 Agent', right: '可规模化装配和复用的 AI 员工', icon: Briefcase },
]

const threeLayerData = [
  {
    name: '认知引擎层',
    subtitle: '决定 Agent 懂不懂业务',
    color: 'bg-orange-500/10 border-orange-200/70 dark:border-orange-500/20',
    textColor: 'text-orange-700 dark:text-orange-300',
    items: ['基座模型', '行业数据', '微调 / fine-tune', 'few-shot 样本', '领域评测'],
  },
  {
    name: '工业装配层',
    subtitle: '决定 Agent 能不能稳定干活',
    color: 'bg-cyan-500/10 border-cyan-200/70 dark:border-cyan-500/20',
    textColor: 'text-cyan-700 dark:text-cyan-300',
    items: ['上下文工程', 'Memory Plugin', 'MCP 工具', 'Skill 技能包', 'Runtime 安全', '审批 / 观测'],
  },
  {
    name: '岗位资产层',
    subtitle: '决定 Agent 能不能规模化交付',
    color: 'bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-500/20',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    items: ['Prompt 边界', 'Skill SOP', '工具连接', '长期知识', '岗位模板', 'AI 员工'],
  },
]

const infraCapabilities = [
  { title: '工具接入治理', desc: 'MCP 标准化原子工具，统一接入、授权、版本管理，避免工具混战。', icon: Server },
  { title: '执行边界管控', desc: 'zz 安全通道 + 策略引擎，命令级"允许/禁止/需审批"，大模型逃不出边界。', icon: Lock },
  { title: '审批与审计', desc: '高风险操作暂停等待人工确认，命令执行前后留下结构化审计记录。', icon: ShieldCheck },
  { title: '任务卷宗与回放', desc: '消息流、工具调用、命令输出、产出文件形成完整卷宗，可追溯可回放。', icon: FileText },
  { title: '资产版本化', desc: '岗位、Skill、Prompt 可版本管理、可灰度发布、可回滚，像管代码一样管 AI 资产。', icon: Package },
]

const hiringFlowSteps = [
  { step: '01', title: '提出目标', desc: '业务方描述任务目标和验收口径', icon: Briefcase },
  { step: '02', title: '选择岗位', desc: '从岗位资产库选择预装好的 AI 员工', icon: Users },
  { step: '03', title: '派发任务', desc: '后端编排、队列投递、容器调度', icon: Zap },
  { step: '04', title: '安全执行', desc: 'Agent 在 zz 安全壳层内工作', icon: ShieldCheck },
  { step: '05', title: '过程可观测', desc: '实时直播、旁路审批、可介入', icon: Eye },
  { step: '06', title: '结果回写资产', desc: '经验沉淀回岗位和 Skill', icon: RefreshCw },
]

const roleComponents = [
  { label: 'Prompt', detail: '定义任务边界与岗位人格', icon: Sparkles },
  { label: 'Skill', detail: '固化专家 SOP 与处理顺序', icon: GitBranch },
  { label: 'MCP', detail: '连接原子工具与系统接口', icon: Server },
  { label: 'Memory Plugin', detail: '按需挂载长期知识源', icon: Database },
  { label: 'Runtime / Security', detail: '可信执行环境与策略边界', icon: ShieldCheck },
  { label: 'Observability', detail: '全程观测、审批与任务卷宗', icon: Monitor },
]

const valuePoints = [
  { title: '共性复杂度沉到底座', desc: '安全、审批、观测、工具接入不再由每个 Agent 团队重复建设。' },
  { title: '领域能力装配成岗位', desc: '专家经验从代码和人脑中提取出来，变成可复用的数字资产。' },
  { title: '交付更快', desc: '业务方从"写 Agent"变成"选岗位、定目标、验结果"。' },
  { title: '治理更稳', desc: '执行边界、审批链路、审计卷宗都是系统默认能力。' },
  { title: '组织资产持续累积', desc: '每次任务执行的经验回写到岗位和 Skill，越用越强。' },
]

const closingPillars = [
  { label: '模型能力', icon: Sparkles },
  { label: '领域数据', icon: Database },
  { label: '工具连接', icon: Server },
  { label: '专家流程', icon: GitBranch },
  { label: '治理边界', icon: ShieldCheck },
  { label: 'AI 员工', icon: Users },
]

const scrollerRef = ref<HTMLElement | null>(null)
const sectionRefs = ref<HTMLElement[]>([])
const activeSlideIndex = ref(0)
let observer: IntersectionObserver | null = null

const currentSlide = computed(() => slides[activeSlideIndex.value] ?? slides[0])
const progress = computed(() => ((activeSlideIndex.value + 1) / slides.length) * 100)
const canPrev = computed(() => activeSlideIndex.value > 0)
const canNext = computed(() => activeSlideIndex.value < slides.length - 1)

const setSectionRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el instanceof HTMLElement) {
    sectionRefs.value[index] = el
  }
}

const scrollToSlide = (index: number, behavior: ScrollBehavior = 'smooth') => {
  const target = sectionRefs.value[index]
  if (!target) return
  target.scrollIntoView({ behavior, block: 'start' })
}

const goPrev = () => { if (canPrev.value) scrollToSlide(activeSlideIndex.value - 1) }
const goNext = () => { if (canNext.value) scrollToSlide(activeSlideIndex.value + 1) }

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); goNext(); return }
  if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); goPrev(); return }
  if (event.key === 'Home') { event.preventDefault(); scrollToSlide(0); return }
  if (event.key === 'End') { event.preventDefault(); scrollToSlide(slides.length - 1) }
}

const initObserver = () => {
  if (!scrollerRef.value) return
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (!visible.length) return
      const idx = sectionRefs.value.findIndex((s) => s === visible[0].target)
      if (idx >= 0) activeSlideIndex.value = idx
    },
    { root: scrollerRef.value, threshold: [0.35, 0.55, 0.75] }
  )
  sectionRefs.value.forEach((s) => observer?.observe(s))
}

onMounted(async () => { await nextTick(); initObserver(); window.addEventListener('keydown', handleKeydown) })
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('keydown', handleKeydown) })
</script>

<template>
  <div class="h-screen overflow-hidden bg-background">
    <div class="relative h-screen overflow-hidden bg-background text-foreground">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.84_0.08_255_/_0.22),transparent_34%),radial-gradient(circle_at_85%_12%,oklch(0.78_0.12_70_/_0.20),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.90))] dark:bg-[radial-gradient(circle_at_top_left,oklch(0.42_0.12_255_/_0.20),transparent_28%),radial-gradient(circle_at_85%_12%,oklch(0.56_0.16_70_/_0.14),transparent_24%),linear-gradient(180deg,rgba(9,9,11,0.96),rgba(17,24,39,0.95))]" />
      <div class="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:44px_44px] opacity-60 dark:opacity-20" />
      <div class="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_66%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_64%)]" />

      <!-- ========== Top bar ========== -->
      <div class="pointer-events-none absolute inset-x-0 top-0 z-30 px-5 py-4">
        <div class="pointer-events-auto flex w-full items-center justify-between gap-4 rounded-full border border-border/70 bg-background/82 px-4 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/72">
          <div class="flex min-w-0 items-center gap-3">
            <Badge variant="outline" class="h-8 rounded-full border-primary/30 bg-primary/5 px-3 font-mono text-[10px] uppercase tracking-[0.26em] text-primary">AI员工工厂</Badge>
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold">{{ currentSlide.title }}</p>
              <p class="truncate text-[11px] text-muted-foreground">可滚动、可键盘翻页的架构演示站</p>
            </div>
          </div>
          <div class="min-w-[220px] max-w-[280px] flex-1">
            <div class="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{{ activeSlideIndex + 1 }} / {{ slides.length }}</span>
              <span>章节进度</span>
            </div>
            <Progress :model-value="progress" class="h-2 bg-muted/70" />
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="router.push('/')">返回主站</Button>
            <Button variant="ghost" size="icon" :disabled="!canPrev" class="rounded-full" @click="goPrev"><ChevronLeft class="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" :disabled="!canNext" class="rounded-full" @click="goNext"><ChevronRight class="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <!-- ========== Main grid ========== -->
      <div class="relative z-10 grid h-screen w-full grid-cols-1 gap-0 px-5 xl:grid-cols-[minmax(0,1fr)_200px] xl:gap-4">
        <div ref="scrollerRef" class="h-screen overflow-y-auto scroll-smooth snap-y snap-mandatory">

          <!-- ===== 0 / 封面 ===== -->
          <section :ref="(el) => setSectionRef(el, 0)" class="deck-section">
            <div class="deck-shell">
              <div class="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
                <div class="space-y-5">
                  <Badge variant="outline" class="rounded-full border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.26em] text-primary">企业级AI员工 / Agent工厂</Badge>
                  <div class="space-y-4">
                    <h1 class="max-w-5xl text-4xl font-black tracking-tight text-zinc-950 md:text-[3.4rem] md:leading-[1.08] dark:text-white">从 Agent 应用到 Agent 工厂</h1>
                    <p class="max-w-3xl text-base leading-7 text-zinc-600 md:text-lg md:leading-8 dark:text-zinc-300">
                      <span class="font-semibold text-foreground">Agent 工厂</span>如何把模型能力、领域数据、工具、记忆和专家流程，装配成可雇佣的 AI 员工。
                    </p>
                  </div>
                  <div class="rounded-2xl border border-primary/20 bg-primary/8 px-5 py-4">
                    <p class="text-base font-bold leading-relaxed">模型负责变聪明，工厂负责能上岗。</p>
                    <p class="mt-1 text-sm text-muted-foreground">模型与数据决定智能上限，Agent 工厂决定这些能力能否被稳定装配、治理和规模化交付。</p>
                  </div>
                  <div class="grid gap-4 md:grid-cols-3">
                    <Card v-for="stat in projectStats" :key="stat.label" class="border-border/70 bg-white/72 backdrop-blur dark:bg-zinc-950/62">
                      <CardHeader class="pb-3">
                        <CardDescription class="font-mono text-[10px] uppercase tracking-[0.24em]">{{ stat.label }}</CardDescription>
                        <CardTitle class="text-2xl font-black">{{ stat.value }}</CardTitle>
                      </CardHeader>
                      <CardContent class="text-sm text-muted-foreground">{{ stat.detail }}</CardContent>
                    </Card>
                  </div>
                </div>
                <Card class="border-border/70 bg-white/75 backdrop-blur dark:bg-zinc-950/65">
                  <CardHeader>
                    <CardDescription class="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">核心主张</CardDescription>
                    <CardTitle class="text-xl">这不是一页营销稿</CardTitle>
                  </CardHeader>
                  <CardContent class="space-y-3">
                    <div class="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                      <p class="font-semibold text-foreground">行业数据、微调、few-shot 很重要</p>
                      <p class="mt-1">它们决定 Agent 的智能上限。但"变聪明"只是第一步——能否稳定干活、安全执行、规模化交付，需要工程系统兜住。</p>
                    </div>
                    <div class="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                      <p class="font-semibold text-foreground">Agent 工厂解决的是"后半段"</p>
                      <p class="mt-1">把已有的模型能力和领域知识，装配成可治理、可观测、可复用的 AI 员工。</p>
                    </div>
                    <Separator />
                    <div class="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                      <div>
                        <p class="font-semibold">继续往下看</p>
                        <p class="text-sm text-muted-foreground">先把问题讲清楚，再看我们怎么解。</p>
                      </div>
                      <Button size="sm" class="rounded-full" @click="goNext">开始 <ChevronRight class="ml-1 h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <!-- ===== 1 / 先把问题讲对 ===== -->
          <section :ref="(el) => setSectionRef(el, 1)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">01 / 问题定义</p>
                <h2 class="deck-title">Agent 的问题，从来不只是一句 prompt</h2>
                <p class="deck-summary">Agent 要真正在企业里干活，必须同时解决两件事：让它懂业务（智能能力），让它稳定干活（工程系统）。只做一边，都不成立。</p>
              </div>
              <div class="grid gap-5 lg:grid-cols-2">
                <div v-for="dim in problemDimensions" :key="dim.title" class="rounded-[28px] border p-5" :class="dim.accent">
                  <div class="mb-4 flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-background/80">
                      <component :is="dim.icon" class="h-5 w-5" :class="dim.accentText" />
                    </div>
                    <h3 class="text-xl font-black" :class="dim.accentText">{{ dim.title }}</h3>
                  </div>
                  <div class="space-y-2.5">
                    <div v-for="point in dim.points" :key="point" class="rounded-2xl border border-current/10 bg-white/60 px-4 py-3 text-sm leading-6 dark:bg-black/15">{{ point }}</div>
                  </div>
                </div>
              </div>
              <Card class="mt-5 border-primary/20 bg-primary/8">
                <CardContent class="p-5">
                  <p class="text-base font-bold">核心判断：Agent 的难点是"智能能力"和"工程系统"同时成立。</p>
                  <p class="mt-2 text-sm leading-7 text-muted-foreground">模型和数据负责"变聪明"，工厂负责"能干活、干得稳、干得久"。两者缺一不可。</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 2 / 传统路线的问题 ===== -->
          <section :ref="(el) => setSectionRef(el, 2)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">02 / 传统路线</p>
                <h2 class="deck-title">为什么传统 Agent 项目越做越像手工作坊</h2>
                <p class="deck-summary">不是团队能力不够，是每个项目都在重复发明基础设施。领域智能和工程系统纠缠在一起，越做越重。</p>
              </div>
              <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Card v-for="pain in traditionalPains" :key="pain.title" class="border-border/70 bg-white/72 backdrop-blur dark:bg-zinc-950/64">
                  <CardContent class="flex items-start gap-3 p-4">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                      <component :is="pain.icon" class="h-4 w-4" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold">{{ pain.title }}</p>
                      <p class="mt-1 text-sm leading-6 text-muted-foreground">{{ pain.desc }}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Card class="mt-5 border-border/70 bg-zinc-950 text-white dark:bg-black">
                <CardContent class="p-5">
                  <p class="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan-300">根因</p>
                  <h3 class="mt-2 text-2xl font-black">领域智能和工程系统没有分层</h3>
                  <p class="mt-3 text-sm leading-7 text-zinc-300">团队同时背着"让 Agent 更聪明"和"让 Agent 安全稳定运行"两座大山。真正该做的，是把后者沉到底座，让业务团队只聚焦前者。</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 3 / 行业对比 ===== -->
          <section :ref="(el) => setSectionRef(el, 3)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">03 / 行业对比</p>
                <h2 class="deck-title">编排 ≠ 装配，搭建 ≠ 治理</h2>
                <p class="deck-summary">大多数平台解决的是 Agent 的编排和快速搭建。Agent 工厂解决的是能力的标准化装配、安全治理和规模化交付。</p>
              </div>
              <div class="grid gap-4 lg:grid-cols-3">
                <Card v-for="p in platformCompare" :key="p.name" class="border backdrop-blur" :class="[p.color, p.highlight ? 'ring-2 ring-primary/30' : 'bg-white/72 dark:bg-zinc-950/64']">
                  <CardHeader>
                    <div class="flex h-12 w-12 items-center justify-center rounded-2xl" :class="p.highlight ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'">
                      <component :is="p.icon" class="h-6 w-6" />
                    </div>
                    <CardTitle class="mt-4 text-lg">{{ p.name }}</CardTitle>
                    <Badge :variant="p.highlight ? 'default' : 'secondary'" class="mt-2 w-fit rounded-full text-xs">{{ p.position }}</Badge>
                  </CardHeader>
                  <CardContent class="text-sm leading-6 text-muted-foreground">{{ p.desc }}</CardContent>
                </Card>
              </div>
              <Card class="mt-5 border-border/70 bg-white/72 backdrop-blur dark:bg-zinc-950/64">
                <CardContent class="p-5">
                  <div class="grid gap-4 lg:grid-cols-2">
                    <div class="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">前者</p>
                      <p class="mt-2 text-lg font-black">更像搭积木</p>
                      <p class="mt-1 text-sm leading-6 text-muted-foreground">提供编排原语或低代码画布，开发者/用户自己决定怎么搭。</p>
                    </div>
                    <div class="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                      <p class="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">后者</p>
                      <p class="mt-2 text-lg font-black">更像建工厂</p>
                      <p class="mt-1 text-sm leading-6 text-muted-foreground">提供标准化生产线：安全执行、策略治理、资产沉淀、规模化交付。</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 4 / 对照总图 ===== -->
          <section :ref="(el) => setSectionRef(el, 4)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-3 max-w-5xl">
                <p class="deck-kicker">04 / 对照总图</p>
                <h2 class="deck-title">作坊 vs 工厂，一图看懂差距</h2>
                <p class="deck-summary" style="margin-top:0.6rem">左边是每个项目组各自为战的现状，右边是把基础设施和专家经验沉到底座后的结果——复杂度从业务团队身上被拿走。</p>
              </div>
              <div class="contrast-map">
                <div class="contrast-header">
                  <div class="contrast-cell-dim" style="border-bottom:none;background:transparent;justify-content:center"><ArrowRight class="h-5 w-5 text-primary" /></div>
                  <div class="contrast-header-col">
                    <div class="contrast-icon-circle contrast-icon-left"><Wrench class="h-4 w-4" /></div>
                    <div><p class="text-sm font-bold text-red-600 dark:text-red-400">手工作坊</p><p class="text-xs text-muted-foreground">每个项目组各自为战</p></div>
                  </div>
                  <div class="contrast-header-col">
                    <div class="contrast-icon-circle contrast-icon-right"><Cpu class="h-4 w-4" /></div>
                    <div><p class="text-sm font-bold text-emerald-600 dark:text-emerald-400">工业化装配</p><p class="text-xs text-muted-foreground">底座 + 资产 + 岗位</p></div>
                  </div>
                </div>
                <div class="contrast-body">
                  <div v-for="(row, idx) in contrastRows" :key="row.dim" class="contrast-row" :class="idx % 2 === 0 ? 'contrast-row-even' : ''">
                    <div class="contrast-cell-dim"><component :is="row.icon" class="h-4 w-4 shrink-0 text-primary" /><span class="text-sm font-semibold">{{ row.dim }}</span></div>
                    <div class="contrast-cell-left"><span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" /><span class="text-sm leading-relaxed text-muted-foreground">{{ row.left }}</span></div>
                    <div class="contrast-cell-right"><span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" /><span class="text-sm leading-relaxed">{{ row.right }}</span></div>
                  </div>
                </div>
                <div class="contrast-footer">
                  <div class="contrast-footer-dim"><p class="text-[10px] font-semibold uppercase tracking-widest text-primary">复杂度下沉</p><ArrowRight class="h-4 w-4 text-primary" /></div>
                  <div class="contrast-footer-col"><p class="text-base font-black text-red-600/80 dark:text-red-400/80">"项目制黑盒 Agent"</p><p class="text-xs text-muted-foreground">做一个丢一个，经验无法流转</p></div>
                  <div class="contrast-footer-col"><p class="text-base font-black text-emerald-600/80 dark:text-emerald-400/80">"可规模化装配的 AI 员工"</p><p class="text-xs text-muted-foreground">岗位即资产，雇佣即交付</p></div>
                </div>
              </div>
            </div>
          </section>

          <!-- ===== 5 / 三层架构总图 ===== -->
          <section :ref="(el) => setSectionRef(el, 5)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">05 / 三层架构</p>
                <h2 class="deck-title">工厂化的不是模型本身，而是能力装配过程</h2>
                <p class="deck-summary">从底层认知引擎到顶层岗位资产，三层分工明确：模型负责"变聪明"，工厂负责"装得稳"，岗位负责"交得出"。</p>
              </div>
              <div class="three-layer-stack">
                <div v-for="(layer, idx) in threeLayerData" :key="layer.name" class="three-layer-row" :class="layer.color">
                  <div class="three-layer-label">
                    <p class="text-lg font-black" :class="layer.textColor">{{ layer.name }}</p>
                    <p class="mt-0.5 text-xs text-muted-foreground">{{ layer.subtitle }}</p>
                  </div>
                  <div class="three-layer-items">
                    <div v-for="item in layer.items" :key="item" class="three-layer-chip">{{ item }}</div>
                  </div>
                  <div v-if="idx < threeLayerData.length - 1" class="three-layer-arrow"><ArrowDown class="h-4 w-4 text-primary" /></div>
                </div>
              </div>
              <Card class="mt-4 border-primary/20 bg-primary/8">
                <CardContent class="p-4">
                  <p class="text-sm font-bold">Agent 工厂的价值区间：中间的"工业装配层" + 上面的"岗位资产层"。</p>
                  <p class="mt-1 text-sm text-muted-foreground">认知引擎层留给模型和数据团队，工厂只做装配、治理和交付。</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 6 / 企业基础设施 ===== -->
          <section :ref="(el) => setSectionRef(el, 6)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">06 / 企业基建</p>
                <h2 class="deck-title">可控、可管、可复用</h2>
                <p class="deck-summary">企业真正需要的，不只是"Agent 能跑"，而是整套执行过程可控、工具接入可管、专家经验可复用。这是基础设施级的能力。</p>
              </div>
              <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Card v-for="cap in infraCapabilities" :key="cap.title" class="border-border/70 bg-white/72 backdrop-blur dark:bg-zinc-950/64">
                  <CardContent class="p-4">
                    <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><component :is="cap.icon" class="h-5 w-5" /></div>
                    <p class="text-sm font-bold">{{ cap.title }}</p>
                    <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ cap.desc }}</p>
                  </CardContent>
                </Card>
              </div>
              <Card class="mt-4 border-border/70 bg-zinc-950 text-white dark:bg-black">
                <CardContent class="p-5">
                  <p class="text-sm font-bold text-cyan-300">关键结论</p>
                  <p class="mt-2 text-sm leading-7 text-zinc-300">大模型即使"发疯"，也只能在命令级、策略级、审批级的多层边界内活动。Agent 的自治权必须被系统兜住，而不是靠人盯着。</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 7 / 不替代模型 ===== -->
          <section :ref="(el) => setSectionRef(el, 7)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">07 / 放大智能</p>
                <h2 class="deck-title">不替代领域智能，放大它的交付能力</h2>
                <p class="deck-summary">Agent 工厂不负责凭空制造行业理解，它负责把已有的模型能力和领域知识装成稳定的工作系统。</p>
              </div>
              <div class="grid gap-5 lg:grid-cols-2">
                <Card class="border-orange-200/70 bg-orange-500/8 backdrop-blur dark:border-orange-500/20">
                  <CardHeader>
                    <CardDescription class="font-mono text-[10px] uppercase tracking-[0.28em] text-orange-700 dark:text-orange-300">依然重要</CardDescription>
                    <CardTitle class="text-xl">模型和数据是智能根基</CardTitle>
                  </CardHeader>
                  <CardContent class="space-y-2">
                    <div class="rounded-2xl border border-orange-200/60 bg-white/50 px-4 py-3 text-sm leading-6 dark:bg-black/10">行业数据仍然是模型变聪明的根本途径</div>
                    <div class="rounded-2xl border border-orange-200/60 bg-white/50 px-4 py-3 text-sm leading-6 dark:bg-black/10">微调和 few-shot 仍然决定领域理解深度</div>
                    <div class="rounded-2xl border border-orange-200/60 bg-white/50 px-4 py-3 text-sm leading-6 dark:bg-black/10">领域评测仍然是衡量智能水平的标尺</div>
                  </CardContent>
                </Card>
                <Card class="border-cyan-200/70 bg-cyan-500/8 backdrop-blur dark:border-cyan-500/20">
                  <CardHeader>
                    <CardDescription class="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300">工厂价值</CardDescription>
                    <CardTitle class="text-xl">把能力变成可交付的系统</CardTitle>
                  </CardHeader>
                  <CardContent class="space-y-2">
                    <div class="rounded-2xl border border-cyan-200/60 bg-white/50 px-4 py-3 text-sm leading-6 dark:bg-black/10">把散落的 prompt/tool/memory 装配成标准化岗位</div>
                    <div class="rounded-2xl border border-cyan-200/60 bg-white/50 px-4 py-3 text-sm leading-6 dark:bg-black/10">用安全执行、审批审计、全程观测保障稳定运行</div>
                    <div class="rounded-2xl border border-cyan-200/60 bg-white/50 px-4 py-3 text-sm leading-6 dark:bg-black/10">让专家经验沉淀为可版本化、可复用的组织资产</div>
                  </CardContent>
                </Card>
              </div>
              <Card class="mt-4 border-primary/20 bg-primary/8">
                <CardContent class="p-5">
                  <p class="text-base font-bold">一句话：模型越聪明，工厂越重要——因为越强的能力，越需要可靠的装配与治理。</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 8 / 雇佣 AI 员工流程 ===== -->
          <section :ref="(el) => setSectionRef(el, 8)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">08 / 雇佣流程</p>
                <h2 class="deck-title">业务线拿到的，不是 Agent，是可雇佣的 AI 员工</h2>
                <p class="deck-summary">业务方不需要写 prompt、选 tool、调 memory。他们只需要描述目标、选择岗位、验收结果——就像雇一个新员工。</p>
              </div>
              <div class="hiring-flow">
                <template v-for="(s, idx) in hiringFlowSteps" :key="s.step">
                  <div class="hiring-step">
                    <div class="hiring-step-icon" :class="idx === hiringFlowSteps.length - 1 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'">
                      <component :is="s.icon" class="h-5 w-5" />
                    </div>
                    <Badge class="hiring-step-badge rounded-full bg-muted/50 text-[10px] font-bold">{{ s.step }}</Badge>
                    <p class="mt-2 text-sm font-bold">{{ s.title }}</p>
                    <p class="mt-1 text-xs leading-5 text-muted-foreground">{{ s.desc }}</p>
                  </div>
                  <div v-if="idx < hiringFlowSteps.length - 1" class="hiring-arrow">
                    <ArrowRight class="h-4 w-4 text-primary/50" />
                  </div>
                </template>
              </div>
              <Card class="mt-5 border-border/70 bg-zinc-950 text-white dark:bg-black">
                <CardContent class="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">核心转变</p>
                    <h3 class="mt-2 text-2xl font-black">从"开发 Agent"到"雇佣 AI 员工"</h3>
                    <p class="mt-3 text-sm leading-7 text-zinc-300">业务方不再关心底层模型、tool 调用和 memory 策略。他们关心的是：我雇的这个 AI 员工，能不能按时、安全、高质量地把活干完。</p>
                  </div>
                  <div class="space-y-3">
                    <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-zinc-200">目标驱动 -> 描述要什么，而不是怎么做</div>
                    <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-zinc-200">过程可控 -> 实时看到执行、随时可介入</div>
                    <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-zinc-200">经验沉淀 -> 每次执行的经验回写到岗位资产</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 9 / 一个岗位怎么装出来 ===== -->
          <section :ref="(el) => setSectionRef(el, 9)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">09 / 岗位装配</p>
                <h2 class="deck-title">一个 AI 岗位 = 边界 + 方法论 + 工具 + 知识</h2>
                <p class="deck-summary">岗位不是一个 prompt 文件，而是一套完整的能力包：从任务边界到专家流程，从工具连接到长期知识，再加上可信执行和过程介入。</p>
              </div>
              <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Card v-for="comp in roleComponents" :key="comp.label" class="border-border/70 bg-white/72 backdrop-blur dark:bg-zinc-950/64">
                  <CardContent class="p-4">
                    <div class="mb-3 flex items-center gap-3">
                      <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><component :is="comp.icon" class="h-4 w-4" /></div>
                      <p class="font-mono text-xs font-bold uppercase tracking-wider text-primary">{{ comp.label }}</p>
                    </div>
                    <p class="text-sm leading-6 text-muted-foreground">{{ comp.detail }}</p>
                  </CardContent>
                </Card>
              </div>
              <Card class="mt-4 border-primary/20 bg-primary/8">
                <CardContent class="p-5">
                  <p class="text-base font-bold">一个岗位拿到的不是零散配置，而是一套可审核、可升级、可复制的完整能力包。</p>
                  <p class="mt-2 text-sm text-muted-foreground">业务方不需要理解底层实现，只需要知道：这个岗位能干什么活、干到什么标准、需要什么授权。</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 10 / 价值收束 ===== -->
          <section :ref="(el) => setSectionRef(el, 10)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">10 / 价值收束</p>
                <h2 class="deck-title">从项目制 Agent，走向资产化 AI 员工</h2>
                <p class="deck-summary">当共性复杂度沉到底座，领域能力装配成岗位，企业就拥有了一条可持续运转的 AI 员工生产线。</p>
              </div>
              <div class="grid gap-3 lg:grid-cols-2">
                <Card v-for="(vp, idx) in valuePoints" :key="vp.title" class="border-border/70 backdrop-blur" :class="idx === valuePoints.length - 1 ? 'border-primary/20 bg-primary/8 lg:col-span-2' : 'bg-white/72 dark:bg-zinc-950/64'">
                  <CardContent class="flex items-start gap-4 p-4">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">{{ String(idx + 1).padStart(2, '0') }}</div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold">{{ vp.title }}</p>
                      <p class="mt-1 text-sm leading-6 text-muted-foreground">{{ vp.desc }}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Card class="mt-4 border-border/70 bg-zinc-950 text-white dark:bg-black">
                <CardContent class="p-5">
                  <div class="grid gap-4 lg:grid-cols-2">
                    <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-400">过去</p>
                      <p class="mt-2 text-lg font-black">每做一个 Agent 都重搭一遍</p>
                      <p class="mt-1 text-sm leading-6 text-zinc-300">安全、工具、记忆、观测，全部从零开始。</p>
                    </div>
                    <div class="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                      <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">现在</p>
                      <p class="mt-2 text-lg font-black">选岗位、挂资产、定目标</p>
                      <p class="mt-1 text-sm leading-6 text-cyan-50/90">底座兜住共性，业务只做领域装配。</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- ===== 11 / 结尾 ===== -->
          <section :ref="(el) => setSectionRef(el, 11)" class="deck-section">
            <div class="deck-shell">
              <div class="mb-5 max-w-5xl">
                <p class="deck-kicker">11 / 结尾</p>
                <h2 class="deck-title">企业级Agent工厂，不只是一个 Agent 平台</h2>
                <p class="deck-summary">它把模型能力、领域数据、工具连接、专家流程和治理边界，组装成一条可持续运转的 AI 员工生产线。</p>
              </div>
              <div class="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <div v-for="pillar in closingPillars" :key="pillar.label" class="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-background/80 p-4 text-center">
                  <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><component :is="pillar.icon" class="h-5 w-5" /></div>
                  <p class="text-sm font-bold">{{ pillar.label }}</p>
                </div>
              </div>
              <Card class="mt-5 border-border/70 bg-white/78 backdrop-blur dark:bg-zinc-950/66">
                <CardContent class="grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">最终收束</p>
                    <h3 class="mt-3 text-3xl font-black leading-tight">
                      模型负责变聪明，
                      <br class="hidden md:block" />
                      工厂负责能上岗。
                    </h3>
                    <p class="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                      当认知引擎不断进化，企业更需要一座工厂，把这些能力稳定地装配成可雇佣、可治理、可规模化复用的 AI 员工。
                    </p>
                  </div>
                  <div class="space-y-3">
                    <div class="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm font-semibold">交付速度更快</div>
                    <div class="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm font-semibold">治理边界更清晰</div>
                    <div class="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm font-semibold">组织资产可规模化复制</div>
                    <Button class="w-full rounded-full" size="lg" @click="scrollToSlide(0)">回到封面 <ChevronLeft class="ml-1 h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

        </div>

        <!-- ========== Sidebar ========== -->
        <aside class="pointer-events-none relative z-20 hidden h-screen items-center justify-end xl:flex">
          <div class="pointer-events-auto flex max-h-[calc(100vh-5rem)] w-[200px] flex-col gap-1 overflow-y-auto rounded-[24px] border border-border/70 bg-background/78 p-2.5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/70">
            <div class="px-2 pb-1">
              <p class="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">目录</p>
              <p class="mt-1 text-sm font-semibold">演示章节</p>
            </div>
            <Button
              v-for="(slide, index) in slides"
              :key="slide.id"
              variant="ghost"
              class="h-auto items-center justify-between rounded-xl px-2 py-1.5 text-left"
              :class="activeSlideIndex === index ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'"
              @click="scrollToSlide(index)"
            >
              <div class="flex min-w-0 items-center gap-2">
                <span class="font-mono text-[10px] tracking-[0.16em] opacity-60">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="truncate text-sm font-semibold">{{ slide.label }}</span>
              </div>
              <Badge v-if="activeSlideIndex === index" variant="secondary" class="shrink-0 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px]">当前</Badge>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.deck-section {
  position: relative;
  min-height: 100vh;
  scroll-snap-align: start;
  display: flex;
  align-items: stretch;
  padding: 5.5rem 0 2.5rem;
}
.deck-shell {
  width: 100%;
  margin: 0;
  padding: 0 0.25rem 0 0;
}
.deck-kicker {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.deck-title {
  margin-top: 0.75rem;
  font-size: clamp(1.9rem, 3.4vw, 3.4rem);
  line-height: 1.22;
  font-weight: 900;
  letter-spacing: -0.01em;
}
.deck-summary {
  margin-top: 0.85rem;
  font-size: clamp(1rem, 1.35vw, 1.16rem);
  line-height: 1.75;
  color: hsl(var(--muted-foreground));
}

/* ---- Contrast Map ---- */
.contrast-map {
  border: 1px solid hsl(var(--border) / 0.7);
  border-radius: 1.25rem;
  background: hsl(var(--background) / 0.78);
  backdrop-filter: blur(16px);
  overflow: hidden;
}
.contrast-header {
  display: grid;
  grid-template-columns: 140px 1fr 1fr;
  align-items: center;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  background: hsl(var(--muted) / 0.25);
}
.contrast-header-col {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 1rem;
}
.contrast-icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
}
.contrast-icon-left { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.contrast-icon-right { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.contrast-body { display: flex; flex-direction: column; }
.contrast-row {
  display: grid;
  grid-template-columns: 140px 1fr 1fr;
  gap: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.3);
}
.contrast-row:last-child { border-bottom: none; }
.contrast-row-even { background: hsl(var(--muted) / 0.1); }
.contrast-cell-dim {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-right: 1px solid hsl(var(--border) / 0.3);
  background: hsl(var(--muted) / 0.18);
}
.contrast-cell-left,
.contrast-cell-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
}
.contrast-cell-left { border-right: 1px solid hsl(var(--border) / 0.3); }
.contrast-footer {
  display: grid;
  grid-template-columns: 140px 1fr 1fr;
  align-items: center;
  border-top: 1px solid hsl(var(--border) / 0.5);
  background: hsl(var(--muted) / 0.18);
}
.contrast-footer-dim {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.6rem 0.5rem;
  border-right: 1px solid hsl(var(--border) / 0.3);
}
.contrast-footer-col { padding: 0.6rem 1rem; }

/* ---- Three-Layer Stack ---- */
.three-layer-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid hsl(var(--border) / 0.7);
  border-radius: 1.25rem;
  overflow: hidden;
}
.three-layer-row {
  position: relative;
  display: grid;
  grid-template-columns: 200px 1fr;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid hsl(var(--border) / 0.3);
}
.three-layer-row:last-child { border-bottom: none; }
.three-layer-label { min-width: 0; }
.three-layer-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.three-layer-chip {
  padding: 0.35rem 0.85rem;
  border-radius: 1rem;
  border: 1px solid hsl(var(--border) / 0.4);
  background: hsl(var(--background) / 0.7);
  font-size: 0.8rem;
  font-weight: 600;
}
.three-layer-arrow {
  position: absolute;
  left: 50%;
  bottom: -0.75rem;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border) / 0.5);
}

/* ---- Hiring Flow ---- */
.hiring-flow {
  display: grid;
  grid-template-columns: repeat(11, auto);
  align-items: start;
  gap: 0;
  overflow-x: auto;
}
.hiring-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 0.5rem;
  min-width: 120px;
}
.hiring-step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
}
.hiring-step-badge { margin-top: 0.75rem; }
.hiring-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 1.75rem;
}
</style>
