import type { SlideDeck } from '../hooks/useSlides'
import './Home.css'

interface HomeProps {
  decks: SlideDeck[]
  loading: boolean
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export function Home({ decks, loading, onOpen, onCreate, onDelete }: HomeProps) {
  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${title}"?`)) {
      onDelete(id)
    }
  }

  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-header">
          <h1 className="home-title">Slide Editor</h1>
          <p className="home-subtitle">Create and edit slideshows</p>
        </header>

        <button className="home-create-btn" onClick={onCreate}>
          + New Slideshow
        </button>

        <div className="home-deck-list">
          {loading && <p className="home-empty">Loading...</p>}
          {!loading && decks.length === 0 && (
            <p className="home-empty">No slideshows yet. Create one to get started.</p>
          )}
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="home-deck-card"
              onClick={() => onOpen(deck.id)}
            >
              <div className="home-deck-card-body">
                <h3 className="home-deck-title">{deck.title || 'Untitled'}</h3>
                <div className="home-deck-meta">
                  <span>{deck.pageCount} page{deck.pageCount !== 1 ? 's' : ''}</span>
                  <span className="home-deck-dot">&middot;</span>
                  <span>{deck.updatedAt || deck.createdAt || deck.id}</span>
                </div>
              </div>
              <button
                className="home-deck-delete"
                onClick={(e) => handleDelete(e, deck.id, deck.title)}
                title="Delete"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
