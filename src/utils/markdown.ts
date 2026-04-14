import TurndownService from 'turndown'
import { marked } from 'marked'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
})

// Preserve highlight marks
turndown.addRule('highlight', {
  filter: 'mark',
  replacement(content, node) {
    const el = node as HTMLElement
    const color = el.style?.backgroundColor
    if (color) {
      return `==${content}==`
    }
    return `==${content}==`
  },
})

// Preserve underline
turndown.addRule('underline', {
  filter: 'u',
  replacement(content) {
    return `<u>${content}</u>`
  },
})

// Preserve image width in alt text: ![alt|150%](src)
turndown.addRule('imageWithWidth', {
  filter: 'img',
  replacement(_content, node) {
    const el = node as HTMLElement
    const src = el.getAttribute('src') || ''
    const alt = el.getAttribute('alt') || ''
    const width = el.getAttribute('data-width') || '100'
    const altText = width !== '100' ? `${alt}|${width}%` : alt
    return `![${altText}](${src})`
  },
})

// Handle code blocks with language
turndown.addRule('codeBlock', {
  filter: (node) => {
    return node.nodeName === 'PRE' && !!node.querySelector('code')
  },
  replacement(_content, node) {
    const code = (node as HTMLElement).querySelector('code')
    if (!code) return _content
    const lang = code.className?.match(/language-(\S+)/)?.[1] || ''
    const text = code.textContent || ''
    return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`
  },
})

export interface PageMeta {
  fontScale: number
  marginScale: number
  dark: boolean
  codeTheme: string
  fontFamily: string
}

export const FONT_OPTIONS: { value: string; label: string; css: string }[] = [
  { value: 'segoe-ui-emoji', label: 'Segoe UI Emoji', css: "'Segoe UI Emoji', 'Segoe UI', system-ui, sans-serif" },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', css: "'JetBrains Mono', 'Consolas', monospace" },
]

export const DEFAULT_META: PageMeta = {
  fontScale: 100,
  marginScale: 100,
  dark: true,
  codeTheme: 'catppuccin',
  fontFamily: 'segoe-ui-emoji',
}

export function htmlToMarkdown(html: string, meta?: PageMeta): string {
  const md = turndown.turndown(html)
  if (!meta) return md
  const lines: string[] = []
  if (meta.fontScale !== DEFAULT_META.fontScale) lines.push(`fontScale: ${meta.fontScale}`)
  if (meta.marginScale !== DEFAULT_META.marginScale) lines.push(`marginScale: ${meta.marginScale}`)
  if (meta.dark !== DEFAULT_META.dark) lines.push(`dark: ${meta.dark}`)
  if (meta.codeTheme !== DEFAULT_META.codeTheme) lines.push(`codeTheme: ${meta.codeTheme}`)
  if (meta.fontFamily !== DEFAULT_META.fontFamily) lines.push(`fontFamily: ${meta.fontFamily}`)
  if (lines.length === 0) return md
  return ['---', ...lines, '---', ''].join('\n') + md
}

/** Strips front matter from markdown, returns content + parsed meta */
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
    if (kv[1] === 'codeTheme') meta.codeTheme = kv[2].trim()
    if (kv[1] === 'fontFamily') meta.fontFamily = kv[2].trim()
  }
  const content = md.slice(fmMatch[0].length)
  return { content, meta }
}

export function markdownToHtml(md: string): string {
  // Strip front matter before converting
  const { content } = parseFrontMatter(md)
  let html = marked.parse(content, { async: false }) as string
  // Parse ![alt|150%](src) → <img with data-width and style>
  html = html.replace(
    /<img\s+src="([^"]*?)"\s+alt="([^"]*?)\|(\d+)%"[^>]*>/g,
    (_match, src, alt, width) => {
      return `<img src="${src}" alt="${alt}" data-width="${width}" style="width: ${width}%">`
    },
  )
  return html
}
