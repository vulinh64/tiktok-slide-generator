import { useCallback } from 'react'
import './PageList.css'

interface PageListProps {
  pages: string[]
  activePage: number
  getPreview: (index: number) => string
  onPageSelect: (index: number) => void
  onAddPage: () => void
  onDeletePage: (index: number) => void
}

export function PageList({
  pages,
  activePage,
  getPreview,
  onPageSelect,
  onAddPage,
  onDeletePage,
}: PageListProps) {
  const handleDelete = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation()
      if (pages.length <= 1) return
      if (window.confirm(`Delete page ${index + 1}?`)) {
        onDeletePage(index)
      }
    },
    [pages.length, onDeletePage],
  )

  return (
    <div className="page-list">
      <div className="page-list-header">
        <span>Pages</span>
        <button className="page-list-add" onClick={onAddPage} title="Add page">
          +
        </button>
      </div>
      <div className="page-list-items">
        {pages.map((_, index) => {
          const preview = getPreview(index)
          const truncated = preview.length > 80 ? preview.slice(0, 80) + '...' : preview
          return (
            <div
              key={index}
              className={`page-list-item ${index === activePage ? 'active' : ''}`}
              onClick={() => onPageSelect(index)}
            >
              <span className="page-list-number">{index + 1}</span>
              <span className="page-list-preview">{truncated}</span>
              {pages.length > 1 && (
                <button
                  className="page-list-delete"
                  onClick={(e) => handleDelete(e, index)}
                  title="Delete page"
                >
                  &times;
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
