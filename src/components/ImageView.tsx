import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState, useCallback } from 'react'
import './ImageView.css'

function clamp(v: number): number {
  return Math.max(25, Math.min(400, Math.round(v)))
}

export function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, title, width } = node.attrs
  const committed = width || 100
  const [showControls, setShowControls] = useState(false)
  const [inputValue, setInputValue] = useState(String(committed))

  const commit = useCallback((val: string) => {
    const n = parseInt(val, 10)
    if (!isNaN(n)) {
      const clamped = clamp(n)
      setInputValue(String(clamped))
      updateAttributes({ width: clamped })
    } else {
      setInputValue(String(committed))
    }
  }, [committed, updateAttributes])

  const handleMouseEnter = useCallback(() => {
    setInputValue(String(committed))
    setShowControls(true)
  }, [committed])

  const handleMouseLeave = useCallback(() => {
    setShowControls(false)
  }, [])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit(inputValue)
    }
  }, [commit, inputValue])

  const handleInputBlur = useCallback(() => {
    commit(inputValue)
  }, [commit, inputValue])

  return (
    <NodeViewWrapper
      className={`image-view-wrapper ${selected ? 'selected' : ''}`}
      data-drag-handle
    >
      <div
        className="image-view-inner"
        style={{ width: `${committed}%` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img src={src} alt={alt || ''} title={title || undefined} draggable={false} />
        {showControls && (
          <div className="image-view-controls" contentEditable={false}>
            <input
              type="text"
              className="image-view-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
            />
            <span className="image-view-pct-sign">%</span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
