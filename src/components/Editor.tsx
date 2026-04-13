import { EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import './Editor.css'

interface EditorProps {
  editor: TiptapEditor | null
}

export function Editor({ editor }: EditorProps) {
  if (!editor) return null

  return (
    <div className="editor-container">
      <EditorContent editor={editor} />
    </div>
  )
}
