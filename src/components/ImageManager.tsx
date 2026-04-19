import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import './ImageManager.css'

interface ImageEntry {
  name: string
  mime: string
  size: number
  addedAt: string
}

interface ImageManagerProps {
  editor: TiptapEditor
  deckId: string | null
  open: boolean
  onClose: () => void
  onImageRenamed?: (oldName: string, newName: string) => void
}

const VALID_NAME_RE = /^[a-zA-Z0-9._-]+$/

export function ImageManager({ editor, deckId, open, onClose, onImageRenamed }: ImageManagerProps) {
  const [images, setImages] = useState<ImageEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchImages = useCallback(async () => {
    if (!deckId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/slides/${deckId}/images`)
      if (res.ok) setImages(await res.json())
    } finally {
      setLoading(false)
    }
  }, [deckId])

  useEffect(() => {
    if (open) fetchImages()
  }, [open, fetchImages])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFilesChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!deckId) return
      const files = Array.from(e.target.files ?? [])
      e.target.value = ''
      if (files.length === 0) return

      setUploading(true)
      setUploadProgress({ done: 0, total: files.length })
      try {
        // Sequential so the server's nextImageName() doesn't race on identical ids
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const buf = await file.arrayBuffer()
          const res = await fetch(`/api/slides/${deckId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: buf,
          })
          if (res.ok) {
            const data = await res.json()
            setImages((prev) => [
              ...prev,
              { name: data.name, mime: data.mime, size: data.size, addedAt: '' },
            ])
          }
          setUploadProgress({ done: i + 1, total: files.length })
        }
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
    [deckId],
  )

  const insert = useCallback(
    (name: string) => {
      if (!deckId) return
      editor.chain().focus().setImage({ src: `/api/slides/${deckId}/images/${name}` }).run()
      onClose()
    },
    [editor, deckId, onClose],
  )

  const startRename = useCallback((img: ImageEntry) => {
    setEditingName(img.name)
    setEditDraft(img.name)
  }, [])

  const deleteImage = useCallback(
    async (img: ImageEntry) => {
      if (!deckId) return
      const ok = window.confirm(
        `Delete "${img.name}"?\n\nAny slide that references this image will show a broken image.`,
      )
      if (!ok) return
      try {
        await fetch(`/api/slides/${deckId}/images/${img.name}`, { method: 'DELETE' })
        setImages((prev) => prev.filter((i) => i.name !== img.name))
      } catch {
        // leave state alone on failure
      }
    },
    [deckId],
  )

  const commitRename = useCallback(async () => {
    if (!editingName || !deckId) return
    const target = editingName
    const newName = editDraft.trim()
    setEditingName(null)
    if (!newName || newName === target) return
    if (!VALID_NAME_RE.test(newName)) {
      window.alert('Invalid name. Use letters, digits, dot, underscore, hyphen.')
      return
    }
    try {
      const res = await fetch(`/api/slides/${deckId}/images/${target}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Rename failed' }))
        window.alert(error || 'Rename failed')
        return
      }
      setImages((prev) =>
        prev.map((i) => (i.name === target ? { ...i, name: newName } : i)),
      )
      onImageRenamed?.(target, newName)
    } catch {
      // leave state alone on failure; user can retry
    }
  }, [deckId, editingName, editDraft, onImageRenamed])

  if (!open) return null

  return (
    <div className="image-manager-overlay" onClick={onClose}>
      <div className="image-manager" onClick={(e) => e.stopPropagation()}>
        <div className="image-manager-header">
          <span>Images</span>
          <div className="image-manager-header-actions">
            <button
              className="toolbar-btn active"
              onClick={handleUploadClick}
              disabled={!deckId || uploading}
            >
              {uploading && uploadProgress
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
                : 'Upload...'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              style={{ display: 'none' }}
              onChange={handleFilesChange}
            />
            <button className="toolbar-btn" onClick={onClose}>&times;</button>
          </div>
        </div>
        <p className="image-manager-hint">
          Click an image to insert it at the cursor. Click its name to rename the file on disk (existing slides are updated automatically). Size is set per-page on the inserted image.
        </p>
        {loading && <div className="image-manager-empty">Loading...</div>}
        {!loading && images.length === 0 && (
          <div className="image-manager-empty">No images uploaded yet.</div>
        )}
        <div className="image-manager-grid">
          {images.map((img) => (
            <div key={img.name} className="image-manager-card">
              <button
                className="image-manager-delete"
                onClick={() => deleteImage(img)}
                title="Delete image"
              >
                &times;
              </button>
              <button
                className="image-manager-thumb"
                onClick={() => insert(img.name)}
                title="Click to insert at cursor"
              >
                <img src={`/api/slides/${deckId}/images/${img.name}`} alt={img.name} />
              </button>
              <div className="image-manager-meta">
                {editingName === img.name ? (
                  <input
                    className="image-manager-input"
                    value={editDraft}
                    autoFocus
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setEditingName(null)
                    }}
                  />
                ) : (
                  <button
                    className="image-manager-label"
                    onClick={() => startRename(img)}
                    title="Click to rename file"
                  >
                    {img.name}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
