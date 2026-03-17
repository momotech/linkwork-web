import { ref, shallowRef } from 'vue'
import { createHighlighter, type Highlighter } from 'shiki'

// 全局单例
let highlighterPromise: Promise<Highlighter> | null = null
const highlighter = shallowRef<Highlighter | null>(null)
const isLoading = ref(true)

// 初始加载的核心语言（最常用，控制首包大小）
const CORE_LANGS = [
  'python', 'java', 'javascript', 'typescript', 'shell', 'json', 'yaml', 'sql'
]

// 按需加载的扩展语言
const EXTENDED_LANGS = [
  'go', 'rust', 'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin', 'scala',
  'bash', 'powershell', 'xml', 'html', 'css', 'scss',
  'markdown', 'dockerfile', 'vue', 'jsx', 'tsx', 'diff'
]

// 所有支持的语言
const SUPPORTED_LANGS = [...CORE_LANGS, ...EXTENDED_LANGS, 'text']

// 已加载的语言集合
const loadedLangs = new Set<string>(CORE_LANGS)

// 初始化高亮器（仅加载核心语言）
const initHighlighter = async () => {
  if (highlighterPromise) return highlighterPromise
  
  highlighterPromise = createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: CORE_LANGS
  })
  
  try {
    highlighter.value = await highlighterPromise
    isLoading.value = false
  } catch (e) {
    console.error('Failed to initialize Shiki:', e)
    isLoading.value = false
  }
  
  return highlighterPromise
}

// 按需加载语言
const loadLang = async (lang: string) => {
  if (loadedLangs.has(lang) || !highlighter.value) return
  if (!EXTENDED_LANGS.includes(lang)) return
  
  try {
    await highlighter.value.loadLanguage(lang as any)
    loadedLangs.add(lang)
  } catch (e) {
    console.warn(`Failed to load language "${lang}":`, e)
  }
}

// 高亮代码（同步版本，未加载的语言使用 text 兜底）
const highlight = (code: string, lang: string): string => {
  if (!highlighter.value) {
    return escapeHtml(code)
  }
  
  const normalizedLang = normalizeLang(lang)
  
  // 如果语言未加载，异步加载并用 text 兜底
  const effectiveLang = loadedLangs.has(normalizedLang) ? normalizedLang : 'text'
  if (!loadedLangs.has(normalizedLang) && EXTENDED_LANGS.includes(normalizedLang)) {
    // 触发异步加载，下次调用时生效
    loadLang(normalizedLang)
  }
  
  try {
    return highlighter.value.codeToHtml(code, {
      lang: effectiveLang,
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      defaultColor: false
    })
  } catch (e) {
    console.warn(`Shiki highlight failed for lang "${lang}":`, e)
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  }
}

// 高亮代码（异步版本，确保语言已加载）
const highlightAsync = async (code: string, lang: string): Promise<string> => {
  if (!highlighter.value) {
    await initHighlighter()
  }
  
  const normalizedLang = normalizeLang(lang)
  
  // 确保语言已加载
  if (!loadedLangs.has(normalizedLang)) {
    await loadLang(normalizedLang)
  }
  
  return highlight(code, normalizedLang)
}

// 规范化语言名称
const normalizeLang = (lang: string): string => {
  const langMap: Record<string, string> = {
    'py': 'python',
    'js': 'javascript',
    'ts': 'typescript',
    'sh': 'shell',
    'zsh': 'shell',
    'yml': 'yaml',
    'htm': 'html',
    'c++': 'cpp',
    'c#': 'csharp',
    'golang': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'kt': 'kotlin'
  }
  
  const normalized = lang.toLowerCase().trim()
  return langMap[normalized] || (SUPPORTED_LANGS.includes(normalized) ? normalized : 'text')
}

// HTML 转义
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function useShiki() {
  // 自动初始化
  if (!highlighterPromise) {
    initHighlighter()
  }
  
  return {
    highlighter,
    isLoading,
    highlight,
    highlightAsync,
    initHighlighter
  }
}
