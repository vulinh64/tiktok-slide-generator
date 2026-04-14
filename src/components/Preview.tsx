import { useMemo, useState, useEffect } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import type { Highlighter } from 'shiki'
import { codeToHighlightedHtml } from '../extensions/shikiTokenize'
import './Editor.css'
import './CodeBlockView.css'

let shikiInstance: Highlighter | null = null
let shikiReady: Promise<Highlighter> | null = null

function getShiki(): Promise<Highlighter> {
  if (!shikiReady) {
    shikiReady = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['dark-plus'],
        langs: [
          'javascript', 'typescript', 'jsx', 'tsx',
          'java', 'kotlin', 'scala',
          'python', 'ruby', 'php', 'perl',
          'go', 'rust', 'c', 'cpp', 'csharp', 'swift', 'dart',
          'html', 'css', 'scss', 'json', 'yaml', 'toml', 'xml',
          'sql', 'graphql',
          'bash', 'shell', 'powershell',
          'markdown', 'dockerfile', 'diff',
          'lua', 'r', 'elixir', 'haskell', 'zig',
        ],
      }),
    ).then((h) => {
      shikiInstance = h
      return h
    })
  }
  return shikiReady
}
getShiki()

interface PreviewProps {
  editor: TiptapEditor | null
}

function highlightCode(html: string): string {
  if (!shikiInstance) return html

  return html.replace(
    /<pre><code(?: class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match, lang: string | undefined, code: string) => {
      const decoded = code
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

      let highlighted: string
      try {
        highlighted = codeToHighlightedHtml(shikiInstance!, decoded, lang || '')
      } catch {
        highlighted = code
      }

      const langAttr = lang ? ` data-language="${lang}"` : ''
      return `<div class="code-block-wrapper"><pre${langAttr}><code>${highlighted}</code></pre></div>`
    },
  )
}

export function Preview({ editor }: PreviewProps) {
  const [shikiLoaded, setShikiLoaded] = useState(!!shikiInstance)

  useEffect(() => {
    if (!shikiInstance) {
      getShiki().then(() => setShikiLoaded(true))
    }
  }, [])

  const html = useMemo(() => {
    if (!editor) return ''
    const raw = editor.getHTML()
    return highlightCode(raw)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor?.getHTML(), shikiLoaded])

  if (!editor) return null

  return (
    <div className="editor-container">
      <div
        className="tiptap"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
