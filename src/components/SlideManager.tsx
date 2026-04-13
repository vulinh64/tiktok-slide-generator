import { useState, useCallback } from 'react'
import type { SlideDeck } from '../hooks/useSlides'
import './SlideManager.css'

interface SlideManagerProps {
  decks: SlideDeck[]
  loading: boolean
  currentDeckId: string | null
  onSave: (title: string) => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
}

export function SlideManager({
  decks,
  loading,
  currentDeckId,
  onSave,
  onLoad,
  onDelete,
  onNew,
}: SlideManagerProps) {
  const [open, setOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')

  const handleSave = useCallback(() => {
    const title = saveTitle.trim() || `Slide ${new Date().toLocaleString()}`
    onSave(title)
    setSaveTitle('')
  }, [saveTitle, onSave])

  const handleDelete = useCallback(
    (id: string, title: string) => {
      if (window.confirm(`Delete "${title}"?`)) {
        onDelete(id)
      }
    },
    [onDelete],
  )

  const formatDate = (ts: string) => ts || ''

  return (
    <div className="slide-manager">
      <button
        className="mode-btn slide-manager-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        Slides
      </button>

      {open && (
        <div className="slide-manager-panel">
          <div className="sm-header">
            <h3>Slide Decks</h3>
            <button className="sm-close" onClick={() => setOpen(false)}>
              &times;
            </button>
          </div>

          {/* Save current */}
          <div className="sm-save">
            <input
              type="text"
              placeholder="Slide title..."
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button onClick={handleSave}>
              {currentDeckId ? 'Update' : 'Save'}
            </button>
          </div>

          <button className="sm-new-btn" onClick={onNew}>
            + New Slide
          </button>

          {/* Deck list */}
          <div className="sm-list">
            {loading && <p className="sm-empty">Loading...</p>}
            {!loading && decks.length === 0 && (
              <p className="sm-empty">No saved slides yet.</p>
            )}
            {decks.map((deck) => (
              <div
                key={deck.id}
                className={`sm-deck ${deck.id === currentDeckId ? 'active' : ''}`}
              >
                <div className="sm-deck-info" onClick={() => onLoad(deck.id)}>
                  <span className="sm-deck-title">{deck.title}</span>
                  <span className="sm-deck-meta">
                    {deck.pageCount} page{deck.pageCount !== 1 ? 's' : ''}
                    {' \u00b7 '}
                    {formatDate(deck.updatedAt || deck.createdAt)}
                  </span>
                </div>
                <button
                  className="sm-deck-delete"
                  onClick={() => handleDelete(deck.id, deck.title)}
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
