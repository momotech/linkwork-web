import { ref } from 'vue'
import { createGlobalState } from '@vueuse/core'

type OnboardingStatus = 'completed' | 'skipped' | null

const STORAGE_VERSION = 'v1'
const WELCOME_STATUS_KEY = `linkwork.onboarding.welcome.${STORAGE_VERSION}`
const ROLE_STATUS_KEY = `linkwork.onboarding.roles.${STORAGE_VERSION}`

const readStatus = (key: string): OnboardingStatus => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key)
  if (raw === 'completed' || raw === 'skipped') return raw
  return null
}

const writeStatus = (key: string, status: Exclude<OnboardingStatus, null>) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, status)
}

const clearStatus = (key: string) => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}

export const useOnboarding = createGlobalState(() => {
  const welcomeStatus = ref<OnboardingStatus>(readStatus(WELCOME_STATUS_KEY))
  const roleStatus = ref<OnboardingStatus>(readStatus(ROLE_STATUS_KEY))

  const shouldShowWelcomeGuide = () => welcomeStatus.value === null
  const shouldShowRoleGuide = () => roleStatus.value === null

  const completeWelcomeGuide = () => {
    welcomeStatus.value = 'completed'
    writeStatus(WELCOME_STATUS_KEY, 'completed')
  }

  const skipWelcomeGuide = () => {
    welcomeStatus.value = 'skipped'
    writeStatus(WELCOME_STATUS_KEY, 'skipped')
  }

  const completeRoleGuide = () => {
    roleStatus.value = 'completed'
    writeStatus(ROLE_STATUS_KEY, 'completed')
  }

  const skipRoleGuide = () => {
    roleStatus.value = 'skipped'
    writeStatus(ROLE_STATUS_KEY, 'skipped')
  }

  const resetGuides = () => {
    welcomeStatus.value = null
    roleStatus.value = null
    clearStatus(WELCOME_STATUS_KEY)
    clearStatus(ROLE_STATUS_KEY)
  }

  return {
    welcomeStatus,
    roleStatus,
    shouldShowWelcomeGuide,
    shouldShowRoleGuide,
    completeWelcomeGuide,
    skipWelcomeGuide,
    completeRoleGuide,
    skipRoleGuide,
    resetGuides,
  }
})
