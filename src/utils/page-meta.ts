export interface PageMeta {
  fontScale: number
  marginScale: number
  dark: boolean
  fontFamily: string
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

export function htmlToMarkdown(html: string, meta?: PageMeta): string {
  if (!meta) return html
  const lines: string[] = []
  if (meta.fontScale !== DEFAULT_META.fontScale) lines.push(`fontScale: ${meta.fontScale}`)
  if (meta.marginScale !== DEFAULT_META.marginScale) lines.push(`marginScale: ${meta.marginScale}`)
  if (meta.dark !== DEFAULT_META.dark) lines.push(`dark: ${meta.dark}`)
  if (meta.fontFamily !== DEFAULT_META.fontFamily) lines.push(`fontFamily: ${meta.fontFamily}`)
  if (lines.length === 0) return html
  return ['---', ...lines, '---', ''].join('\n') + html
}

/** Strips front matter, returns content + parsed meta */
export function parseFrontMatter(md: string): { content: string; meta: PageMeta } {
  const meta = { ...DEFAULT_META }
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!fmMatch) return { content: md, meta }

  const body = fmMatch[1]
  for (const line of body.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (!kv) continue
    if (kv[1] === 'fontScale') meta.fontScale = Number(kv[2]) || 100
    if (kv[1] === 'marginScale') meta.marginScale = Number(kv[2]) || 100
    if (kv[1] === 'dark') meta.dark = kv[2].trim() === 'true'
    if (kv[1] === 'fontFamily') meta.fontFamily = kv[2].trim()
  }
  const content = md.slice(fmMatch[0].length)
  return { content, meta }
}

export function markdownToHtml(md: string): string {
  const { content } = parseFrontMatter(md)
  return content
}
