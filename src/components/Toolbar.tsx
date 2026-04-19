import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import './Toolbar.css'

interface ToolbarProps {
  editor: TiptapEditor
  deckId?: string | null
  customCss?: string
  onChangeCustomCss?: (css: string) => void
}

async function uploadImage(deckId: string, file: File): Promise<string | null> {
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

export function Toolbar({ editor, deckId, customCss = '', onChangeCustomCss }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cssModalOpen, setCssModalOpen] = useState(false)
  const [cssDraft, setCssDraft] = useState(customCss)

  useEffect(() => {
    if (cssModalOpen) setCssDraft(customCss)
  }, [cssModalOpen, customCss])

  const saveCss = useCallback(() => {
    onChangeCustomCss?.(cssDraft)
    setCssModalOpen(false)
  }, [cssDraft, onChangeCustomCss])

  const addImage = useCallback(() => {
    if (!deckId) {
      const url = window.prompt('Enter image URL:')
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
      return
    }
    fileInputRef.current?.click()
  }, [editor, deckId])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !deckId) return
      const url = await uploadImage(deckId, file)
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [editor, deckId],
  )

  const setColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      editor.chain().focus().setColor(e.target.value).run()
    },
    [editor],
  )

  const setHighlight = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      editor.chain().focus().toggleHighlight({ color: e.target.value }).run()
    },
    [editor],
  )

  return (
    <div className="toolbar">
      {/* Text style */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <u>U</u>
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('code') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline Code"
        >
          {'</>'}
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Headings */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          title="Heading 1"
        >
          H1
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading 2"
        >
          H2
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          title="Heading 3"
        >
          H3
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Lists */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          &#8226; List
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          1. List
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          &ldquo; Quote
        </button>
        <button
          className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
        >
          {'{ } Code'}
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Alignment */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Align Left"
        >
          &#9776;
        </button>
        <button
          className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align Center"
        >
          &#9776;
        </button>
        <button
          className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align Right"
        >
          &#9776;
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Color & Highlight */}
      <div className="toolbar-group">
        <label className="toolbar-color" title="Text Color">
          A
          <input type="color" onChange={setColor} defaultValue="#000000" />
        </label>
        <label className="toolbar-color highlight" title="Highlight Color">
          H
          <input type="color" onChange={setHighlight} defaultValue="#fef08a" />
        </label>
        <button
          className="toolbar-btn"
          onClick={() => editor.chain().focus().unsetHighlight().run()}
          title="Clear Highlight"
        >
          H&#x0336;
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Extras */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={addImage} title="Insert Image">
          Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="toolbar-btn"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          &mdash; HR
        </button>
        <button
          className={`toolbar-btn ${customCss.trim() ? 'active' : ''}`}
          onClick={() => setCssModalOpen(true)}
          title="Custom CSS for this page"
        >
          CSS
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Undo/Redo */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          Undo
        </button>
        <button
          className="toolbar-btn"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          Redo
        </button>
      </div>

      {cssModalOpen && (
        <div className="css-modal-overlay" onClick={() => setCssModalOpen(false)}>
          <div className="css-modal" onClick={(e) => e.stopPropagation()}>
            <div className="css-modal-header">
              <span>Custom CSS (this page only)</span>
              <button className="toolbar-btn" onClick={() => setCssModalOpen(false)}>
                &times;
              </button>
            </div>
            <p className="css-modal-hint">
              Scoped to <code>#slide-canvas</code>. Write selectors as if you're inside the slide, e.g.{' '}
              <code>h1 {'{'} color: red; {'}'}</code>. Applies in Edit and Preview.
            </p>
            <textarea
              className="css-modal-textarea"
              value={cssDraft}
              onChange={(e) => setCssDraft(e.target.value)}
              placeholder="h1 { color: #ffcc00; }\np { letter-spacing: 0.05em; }"
              spellCheck={false}
            />
            <div className="css-modal-actions">
              <button className="toolbar-btn" onClick={() => setCssModalOpen(false)}>
                Cancel
              </button>
              <button className="toolbar-btn active" onClick={saveCss}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
