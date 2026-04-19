import { useState, useCallback, useEffect } from 'react'
import type { PageMeta } from '../utils/page-meta'

export interface SerializedPage {
  meta: Partial<PageMeta>
  html: string
}

export interface SlideDeck {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface SlideDeckFull extends SlideDeck {
  pages: SerializedPage[]
  customCss?: string
  hasBg?: boolean
}

export function useSlides() {
  const [decks, setDecks] = useState<SlideDeck[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/slides')
      const data = await res.json()
      setDecks(data)
    } catch (err) {
      console.error('Failed to list slides:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveDeck = useCallback(
    async (
      title: string,
      pages: SerializedPage[],
      existingId?: string,
      customCss?: string,
    ): Promise<string> => {
      const res = await fetch('/api/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existingId, title, pages, customCss }),
      })
      const data = await res.json()
      await refresh()
      return data.id
    },
    [refresh],
  )

  const loadDeck = useCallback(async (id: string): Promise<SlideDeckFull> => {
    const res = await fetch(`/api/slides/${id}`)
    return res.json()
  }, [])

  const deleteDeck = useCallback(
    async (id: string) => {
      await fetch(`/api/slides/${id}`, { method: 'DELETE' })
      await refresh()
    },
    [refresh],
  )

  return { decks, loading, refresh, saveDeck, loadDeck, deleteDeck }
}
