import { useRef, useCallback, useEffect } from 'react'
import { useEditor, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlock from '@tiptap/extension-code-block'
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { createShikiPlugin } from '../extensions/shikiPlugin'
import { CodeBlockView } from '../components/CodeBlockView'
import { ImageView } from '../components/ImageView'

const SHIKI_LANGS = [
  'javascript', 'typescript', 'jsx', 'tsx',
  'java', 'kotlin', 'scala',
  'python', 'ruby', 'php', 'perl',
  'go', 'rust', 'c', 'cpp', 'csharp', 'swift', 'dart',
  'html', 'css', 'scss', 'json', 'yaml', 'toml', 'xml',
  'sql', 'graphql',
  'bash', 'shell', 'powershell',
  'markdown', 'dockerfile', 'diff',
  'lua', 'r', 'elixir', 'haskell', 'zig',
]

// Lazy-init: start loading Shiki immediately at module level
let shikiPromise: Promise<any> | null = null
function loadShiki() {
  if (!shikiPromise) {
    shikiPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['dark-plus'],
        langs: SHIKI_LANGS,
      }),
    )
  }
  return shikiPromise
}
loadShiki() // Kick off immediately

const initialContent = `
<h1>Your Slide Title</h1>
<p>Start typing your content here. This editor supports <strong>bold</strong>, <em>italic</em>, <u>underline</u>, and more.</p>
<h2>Features</h2>
<ul>
  <li>Rich text editing</li>
  <li>Code blocks with syntax highlighting</li>
  <li>Text alignment</li>
  <li>Colors and highlights</li>
</ul>
<blockquote>This is a blockquote — great for callouts.</blockquote>
<pre><code class="language-javascript">const greeting = "Hello, World!";
console.log(greeting);</code></pre>
`

async function uploadImageFile(deckId: string, file: File): Promise<string | null> {
  const buf = await file.arrayBuffer()
  const res = await fetch(`/api/slides/${deckId}/images`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: buf,
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.url as string
}

function createImageDropPastePlugin(deckIdRef: React.RefObject<string | null>) {
  return Extension.create({
    name: 'imageDropPaste',
    addProseMirrorPlugins() {
      const editor = this.editor
      return [
        new Plugin({
          props: {
            handleDrop(view, event) {
              const files = event.dataTransfer?.files
              if (!files?.length || !deckIdRef.current) return false
              const imageFiles = Array.from(files).filter((f) => f.type === 'image/png' || f.type === 'image/jpeg')
              if (!imageFiles.length) return false

              event.preventDefault()
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })

              imageFiles.forEach(async (file) => {
                const url = await uploadImageFile(deckIdRef.current!, file)
                if (url) {
                  const { schema } = view.state
                  const node = schema.nodes.image.create({ src: url })
                  const insertPos = pos?.pos ?? view.state.selection.from
                  const tr = view.state.tr.insert(insertPos, node)
                  view.dispatch(tr)
                }
              })
              return true
            },
            handlePaste(view, event) {
              const files = event.clipboardData?.files
              if (!files?.length || !deckIdRef.current) return false
              const imageFiles = Array.from(files).filter((f) => f.type === 'image/png' || f.type === 'image/jpeg')
              if (!imageFiles.length) return false

              event.preventDefault()

              imageFiles.forEach(async (file) => {
                const url = await uploadImageFile(deckIdRef.current!, file)
                if (url) {
                  editor.chain().focus().setImage({ src: url }).run()
                }
              })
              return true
            },
          },
        }),
      ]
    },
  })
}

export function useSlideEditor() {
  const deckIdRef = useRef<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: 100,
              parseHTML: (element) => {
                const w = element.getAttribute('data-width')
                return w ? Number(w) : 100
              },
              renderHTML: (attributes) => {
                return {
                  'data-width': attributes.width,
                  style: `width: ${attributes.width}%`,
                }
              },
            },
          }
        },
        addNodeView() {
          return ReactNodeViewRenderer(ImageView)
        },
      }).configure({
        inline: true,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your slide content...',
      }),
      CodeBlock.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView)
        },
        addProseMirrorPlugins() {
          return [
            ...(this.parent?.() || []),
            createShikiPlugin({
              name: this.name,
              highlighter: null, // Loaded async below
            }),
          ]
        },
      }),
      createImageDropPastePlugin(deckIdRef),
    ],
    content: initialContent,
  })

  // Once Shiki is loaded, inject the highlighter into the plugin
  useEffect(() => {
    if (!editor) return
    loadShiki().then((highlighter) => {
      if (editor.isDestroyed) return
      editor.view.dispatch(
        editor.state.tr.setMeta('shikiHighlighter', highlighter),
      )
    })
  }, [editor])

  const setDeckId = useCallback((id: string | null) => {
    deckIdRef.current = id
  }, [])

  return { editor, setDeckId }
}
