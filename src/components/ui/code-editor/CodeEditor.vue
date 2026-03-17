<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef, computed } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view'
import { EditorState, Compartment, EditorSelection } from '@codemirror/state'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap, openSearchPanel as openSearchPanelCommand } from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { indentOnInput, bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: string
  readonly?: boolean
}>(), {
  modelValue: '',
  language: 'markdown',
  readonly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': []
}>()

const editorRef = ref<HTMLElement>()
const view = shallowRef<EditorView>()
const languageCompartment = new Compartment()
const readonlyCompartment = new Compartment()
const themeCompartment = new Compartment()

// Detect system/page dark mode
const isDark = computed(() => {
  return document.documentElement.classList.contains('dark')
})

const getLanguageExtension = (lang: string) => {
  switch (lang) {
    case 'python': case 'py': return python()
    case 'javascript': case 'js': return javascript()
    case 'typescript': case 'ts': return javascript({ typescript: true })
    case 'json': return json()
    case 'markdown': case 'md': default: return markdown()
  }
}

// Light theme matching the app's design
const lightTheme = EditorView.theme({
  '&': { backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' },
  '.cm-gutters': { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', borderRight: '1px solid hsl(var(--border))' },
  '.cm-activeLineGutter': { backgroundColor: 'hsl(var(--accent))' },
  '.cm-activeLine': { backgroundColor: 'hsl(var(--accent) / 0.5)' },
  '.cm-cursor': { borderLeftColor: 'hsl(var(--foreground))' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'hsl(var(--accent))' },
}, { dark: false })

const getThemeExtensions = () => {
  if (isDark.value) {
    return [oneDark]
  }
  return [lightTheme, syntaxHighlighting(defaultHighlightStyle)]
}

const focusEditor = () => {
  view.value?.focus()
}

const selectAllContent = () => {
  if (!view.value) return
  const length = view.value.state.doc.length
  view.value.dispatch({
    selection: EditorSelection.range(0, length),
    scrollIntoView: true,
  })
  focusEditor()
}

const openSearchPanel = () => {
  if (!view.value) return
  openSearchPanelCommand(view.value)
  focusEditor()
}

defineExpose({
  focusEditor,
  selectAllContent,
  openSearchPanel,
})

onMounted(() => {
  if (!editorRef.value) return

  const editorKeymap = keymap.of([
    {
      key: 'Mod-s',
      run: () => { emit('save'); return true }
    },
    {
      key: 'Mod-a',
      run: () => {
        selectAllContent()
        return true
      }
    },
    {
      key: 'Mod-f',
      run: () => {
        openSearchPanel()
        return true
      },
    },
  ])

  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    search(),
    indentOnInput(),
    bracketMatching(),
    syntaxHighlighting(defaultHighlightStyle),
    keymap.of([...defaultKeymap, ...searchKeymap, indentWithTab]),
    editorKeymap,
    languageCompartment.of(getLanguageExtension(props.language)),
    readonlyCompartment.of(EditorState.readOnly.of(props.readonly)),
    themeCompartment.of(getThemeExtensions()),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString())
      }
    }),
    EditorView.theme({
      '&': { height: '100%', fontSize: '13px' },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      },
      '.cm-content': { padding: '8px 0' },
      '.cm-content, .cm-line': {
        cursor: 'text',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      },
    }),
  ]

  const state = EditorState.create({
    doc: props.modelValue,
    extensions,
  })

  view.value = new EditorView({
    state,
    parent: editorRef.value,
  })

  // Watch for dark mode changes via MutationObserver
  const observer = new MutationObserver(() => {
    if (!view.value) return
    view.value.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtensions())
    })
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onUnmounted(() => observer.disconnect())
})

// Watch for external content changes (e.g., loading a new file)
watch(() => props.modelValue, (newVal) => {
  if (!view.value) return
  const currentVal = view.value.state.doc.toString()
  if (newVal !== currentVal) {
    view.value.dispatch({
      changes: { from: 0, to: view.value.state.doc.length, insert: newVal }
    })
  }
})

// Watch for language changes using compartment reconfiguration
watch(() => props.language, (newLang) => {
  if (!view.value || !newLang) return
  view.value.dispatch({
    effects: languageCompartment.reconfigure(getLanguageExtension(newLang))
  })
})

// Watch for readonly changes
watch(() => props.readonly, (newVal) => {
  if (!view.value) return
  view.value.dispatch({
    effects: readonlyCompartment.reconfigure(EditorState.readOnly.of(newVal))
  })
})

onUnmounted(() => {
  view.value?.destroy()
})
</script>

<template>
  <div ref="editorRef" class="h-full w-full overflow-hidden border border-border/50 bg-background" />
</template>
