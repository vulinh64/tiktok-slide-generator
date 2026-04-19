import { useEffect, useState } from 'react'
import './CssModal.css'

interface CssModalProps {
  open: boolean
  title: string
  hint?: string
  value: string
  onApply: (css: string) => void
  onClose: () => void
}

export function CssModal({ open, title, hint, value, onApply, onClose }: CssModalProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  if (!open) return null

  const apply = () => {
    onApply(draft)
    onClose()
  }

  return (
    <div className="css-modal-overlay" onClick={onClose}>
      <div className="css-modal" onClick={(e) => e.stopPropagation()}>
        <div className="css-modal-header">
          <span>{title}</span>
          <button className="toolbar-btn" onClick={onClose}>&times;</button>
        </div>
        {hint && <p className="css-modal-hint">{hint}</p>}
        <textarea
          className="css-modal-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
        />
        <div className="css-modal-actions">
          <button className="toolbar-btn" onClick={onClose}>Cancel</button>
          <button className="toolbar-btn active" onClick={apply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
