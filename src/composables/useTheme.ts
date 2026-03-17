import { watch } from 'vue'
import { useStorage } from '@vueuse/core'

export const themes = [
  { name: 'blue', label: '工业蓝', color: 'bg-blue-600' },
  { name: 'green', label: '森林绿', color: 'bg-green-600' },
  { name: 'neutral', label: '中性灰', color: 'bg-zinc-700' },
  { name: 'orange', label: '日落橙', color: 'bg-orange-500' },
  { name: 'red', label: '烈焰红', color: 'bg-red-600' },
  { name: 'rose', label: '玫瑰粉', color: 'bg-rose-500' },
  { name: 'violet', label: '赛博紫', color: 'bg-violet-600' },
  { name: 'yellow', label: '明亮黄', color: 'bg-yellow-500' },
] as const

export type ThemeName = typeof themes[number]['name']

export function useTheme() {
  // 持久化主题状态，默认为 'blue'
  const theme = useStorage<ThemeName>('linkwork-theme', 'blue')
  const radius = useStorage('linkwork-radius', 0.65)

  // 监听主题变化并应用到 html 标签
  watch(theme, (val) => {
    if (val === 'blue') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', val)
    }
  }, { immediate: true })

  // 监听圆角变化
  watch(radius, (val) => {
    document.documentElement.style.setProperty('--radius', `${val}rem`)
  }, { immediate: true })

  const setTheme = (name: ThemeName) => {
    theme.value = name
  }

  const setRadius = (val: number) => {
    radius.value = val
  }

  return {
    theme,
    radius,
    themes,
    setTheme,
    setRadius
  }
}
