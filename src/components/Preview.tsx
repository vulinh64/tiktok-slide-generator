import { useMemo } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { generateHTML } from '@tiptap/react'
import { all, createLowlight } from 'lowlight'
import { toHtml } from 'hast-util-to-html'
import './Editor.css'
import './CodeBlockView.css'

const lowlight = createLowlight(all)

interface PreviewProps {
  editor: TiptapEditor | null
}

function highlightCode(html: string): string {
  // Find all <pre><code class="language-xxx">...</code></pre> and highlight them
  return html.replace(
    /<pre><code(?: class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match, lang: string | undefined, code: string) => {
      // Decode HTML entities back to text for highlighting
      const decoded = code
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

      let highlighted: string
      try {
        const tree = lang && lang !== 'plaintext'
          ? lowlight.highlight(lang, decoded)
          : lowlight.highlightAuto(decoded)
        highlighted = toHtml(tree)
      } catch {
        highlighted = code
      }

      const langAttr = lang ? ` data-language="${lang}"` : ''
      return `<div class="code-block-wrapper"><pre${langAttr}><code>${highlighted}</code></pre></div>`
    },
  )
}

export function Preview({ editor }: PreviewProps) {
  const html = useMemo(() => {
    if (!editor) return ''
    const raw = editor.getHTML()
    return highlightCode(raw)
  }, [editor, editor?.getHTML()])

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
