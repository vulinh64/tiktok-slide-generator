export interface PageMeta {
  fontScale: number
  marginScale: number
  dark: boolean
  fontFamily: string
  customCss?: string
}

export const FONT_OPTIONS: { value: string; label: string; css: string }[] = [
  { value: 'segoe-ui-emoji', label: 'Segoe UI Emoji', css: "'Segoe UI Emoji', 'Segoe UI', system-ui, sans-serif" },
  { value: 'inter', label: 'Inter', css: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', css: "'JetBrains Mono', 'Consolas', monospace" },
  { value: 'consolas', label: 'Consolas', css: "'Consolas', 'JetBrains Mono', monospace" },
]

export const DEFAULT_META: PageMeta = {
  fontScale: 100,
  marginScale: 100,
  dark: true,
  fontFamily: 'segoe-ui-emoji',
}

