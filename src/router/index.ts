import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import HomeView from '@/views/HomeView.vue'
import FleetView from '@/views/FleetView.vue'
import CommunityView from '@/views/CommunityView.vue'
import SettingsView from '@/views/SettingsView.vue'
import ApprovalView from '@/views/ApprovalView.vue'
import MCPServersView from '@/views/supply-chain/MCPServersView.vue'
import SkillFactoryView from '@/views/supply-chain/SkillFactoryView.vue'
import SkillEditorView from '@/views/supply-chain/SkillEditorView.vue'
import ImageAssemblyView from '@/views/supply-chain/ImageAssemblyView.vue'
import AIRolesView from '@/views/AIRolesView.vue'
import AIRoleDetailView from '@/views/AIRoleDetailView.vue'
import SecurityPolicyView from '@/views/SecurityPolicyView.vue'
import FileManagerView from '@/views/files/FileManagerView.vue'
import CronJobsView from '@/views/CronJobsView.vue'
import K8sMonitorView from '@/views/K8sMonitorView.vue'
import ReportExportView from '@/views/ops/ReportExportView.vue'
import UserSoulView from '@/views/UserSoulView.vue'
import LoginView from '@/views/LoginView.vue'
import GitLabCallbackView from '@/views/auth/GitLabCallbackView.vue'
import MobileTaskView from '@/views/mobile/MobileTaskView.vue'
import ShareTaskDetailView from '@/views/share/ShareTaskDetailView.vue'
import { useAuth } from '@/composables/useAuth'
import { useUser } from '@/composables/useUser'
import { get } from '@/utils/http'

async function hasK8sAccess(): Promise<boolean> {
  try {
    const res = await get<boolean>('/api/v1/k8s-monitor/access-check')
    return res.code === 0 && res.data === true
  } catch {
    return false
  }
}

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/presentation/agent-factory',
      name: 'presentation-agent-factory',
      component: () => import('@/views/presentation/TransformationDeckView.vue'),
      meta: { title: '架构变革演示', public: true }
    },
    {
      path: '/auth/callback/gitlab',
      name: 'gitlab-callback',
      component: GitLabCallbackView,
      meta: { title: 'GitLab Authorization', public: true }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: '登录', public: true }
    },
    {
      path: '/m/task/:taskId',
      name: 'mobile-task',
      component: MobileTaskView,
      meta: { title: '任务结果' }
    },
    {
      path: '/share/task/:taskId',
      name: 'share-task',
      component: ShareTaskDetailView,
      meta: { title: '任务分享详情', public: true }
    },
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: HomeView,
          meta: { title: '指挥中心' }
        },
        {
          path: 'fleet',
          name: 'fleet',
          component: FleetView,
          meta: { title: '任务看板' }
        },
        {
          path: 'approvals',
          name: 'approvals',
          component: ApprovalView,
          meta: { title: '审批中心' }
        },
        {
          path: 'community',
          name: 'community',
          component: CommunityView,
          meta: { title: 'Agent 社区' }
        },
        {
          path: 'mcp',
          name: 'mcp',
          component: MCPServersView,
          meta: { title: 'MCP 服务管理' }
        },
        {
          path: 'skills',
          name: 'skills',
          component: SkillFactoryView,
          meta: { title: 'Skills 工厂' }
        },
        {
          path: 'skills/:name',
          name: 'skill-editor',
          component: SkillEditorView,
          meta: { title: 'Skill 编辑器' }
        },
        {
          path: 'assembly',
          name: 'assembly',
          component: ImageAssemblyView,
          meta: { title: '镜像装配' }
        },
        {
          path: 'roles',
          name: 'roles',
          component: AIRolesView,
          meta: { title: 'AI 岗位' }
        },
        {
          path: 'roles/:id',
          name: 'role-detail',
          component: AIRoleDetailView,
          meta: { title: '岗位全息视图' }
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView,
          meta: { title: '系统设置' }
        },
        {
          path: 'security',
          name: 'security',
          component: SecurityPolicyView,
          meta: { title: '安全机制' }
        },
        {
          path: 'user-soul',
          name: 'user-soul',
          component: UserSoulView,
          meta: { title: '用户 Soul' }
        },
        {
          path: 'files',
          name: 'files',
          component: FileManagerView,
          meta: { title: '记忆空间' }
        },
        {
          path: 'cron-jobs',
          name: 'cron-jobs',
          component: CronJobsView,
          meta: { title: 'Cron调度' }
        },
        {
          path: 'k8s-monitor',
          name: 'k8s-monitor',
          component: K8sMonitorView,
          meta: { title: 'K8s 集群监控', requiresK8sAccess: true }
        },
        {
          path: 'reports',
          name: 'reports',
          component: ReportExportView,
          meta: { title: '报表导出', requiresK8sAccess: true }
        }
      ]
    }
  ]
})

router.beforeEach(async (to, _from, next) => {
  if (to.meta.public) {
    next()
    return
  }

  const { checkAuth } = useAuth()
  const isLoggedIn = await checkAuth()

  if (!isLoggedIn) {
    next({ name: 'login' })
    return
  }

  const { user, fetchUser } = useUser()
  if (!user.value) {
    await fetchUser()
  }

  if (to.meta.requiresK8sAccess) {
    const allowed = await hasK8sAccess()
    if (!allowed) {
      next({ name: 'home' })
      return
    }
  }

  next()
})

export default router
