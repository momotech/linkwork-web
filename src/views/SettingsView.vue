<script setup lang="ts">
import { ref } from "vue"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CreditCard, Shield, User, Bell } from "lucide-vue-next"

const emailNotifications = ref(true)
const marketingEmails = ref(false)
</script>

<template>
  <div class="flex flex-col gap-8 max-w-5xl mx-auto py-8 px-4">
    <div class="space-y-1">
      <h1 class="text-3xl font-bold tracking-tight">系统设置</h1>
      <p class="text-muted-foreground">管理您的租户配额、安全策略与通知偏好</p>
    </div>

    <Tabs default-value="billing" class="w-full space-y-6">
      <TabsList class="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="billing">配额与计费</TabsTrigger>
        <TabsTrigger value="security">安全策略</TabsTrigger>
        <TabsTrigger value="notifications">通知偏好</TabsTrigger>
      </TabsList>

      <!-- 配额与计费 -->
      <TabsContent value="billing" class="space-y-6">
        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <CreditCard class="h-5 w-5 text-primary" />
              <CardTitle>资源配额 (Quota)</CardTitle>
            </div>
            <CardDescription>查看当前租户的计算资源消耗情况</CardDescription>
          </CardHeader>
          <CardContent class="space-y-8">
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="font-medium">GPU 计算时 (Compute Units)</span>
                <span class="text-muted-foreground">1,240 / 2,000 CU</span>
              </div>
              <Progress :model-value="62" class="h-2" />
            </div>
            
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="font-medium">存储空间 (Storage)</span>
                <span class="text-muted-foreground">45.2 GB / 100 GB</span>
              </div>
              <Progress :model-value="45" class="h-2" />
            </div>

            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="font-medium">API 调用次数 (Requests)</span>
                <span class="text-muted-foreground">8.5M / 10M</span>
              </div>
              <Progress :model-value="85" class="h-2 bg-secondary" indicator-class="bg-orange-500" />
            </div>
          </CardContent>
          <CardFooter class="border-t bg-muted/5 px-6 py-4">
            <Button>升级套餐</Button>
          </CardFooter>
        </Card>
      </TabsContent>

      <!-- 安全策略 -->
      <TabsContent value="security" class="space-y-6">
        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <Shield class="h-5 w-5 text-primary" />
              <CardTitle>访问控制 (Access Control)</CardTitle>
            </div>
            <CardDescription>管理 API 密钥与敏感操作权限</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between rounded-lg border p-4">
              <div class="space-y-0.5">
                <Label class="text-base">强制双因素认证 (2FA)</Label>
                <p class="text-sm text-muted-foreground">所有 Admin 角色登录时必须验证</p>
              </div>
              <Switch :model-value="true" disabled aria-label="Toggle 2FA" />
            </div>
            <div class="flex items-center justify-between rounded-lg border p-4">
              <div class="space-y-0.5">
                <Label class="text-base">API 密钥自动轮换</Label>
                <p class="text-sm text-muted-foreground">每 90 天自动重置一次 Key</p>
              </div>
              <Switch aria-label="Toggle Key Rotation" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- 通知偏好 -->
      <TabsContent value="notifications" class="space-y-6">
        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <Bell class="h-5 w-5 text-primary" />
              <CardTitle>消息通知</CardTitle>
            </div>
            <CardDescription>配置通过邮件或 Webhook 接收哪些消息</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center space-x-4">
              <Switch id="email-notif" v-model="emailNotifications" />
              <Label for="email-notif">接收任务运行报告邮件</Label>
            </div>
            <Separator />
            <div class="flex items-center space-x-4">
              <Switch id="marketing-notif" v-model="marketingEmails" />
              <Label for="marketing-notif">接收产品更新与活动推送</Label>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
