import { useState, useCallback, useRef, useEffect } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { DEFAULT_META } from '../utils/page-meta'
import type { PageMeta } from '../utils/page-meta'

const DEFAULT_PAGE = '<h1>New Page</h1><p>Start writing...</p>'

export function usePages(editor: TiptapEditor | null) {
  const [pages, setPages] = useState<string[]>([DEFAULT_PAGE])
  const [activePage, setActivePage] = useState(0)
  const [pageMeta, setPageMeta] = useState<PageMeta>({ ...DEFAULT_META })
  const suppressSave = useRef(false)
  // Ref always holds the latest pages so closures never read stale state
  const pagesRef = useRef(pages)
  const activePageRef = useRef(activePage)
  const metaRef = useRef<PageMeta[]>([{ ...DEFAULT_META }])
  const dirtyRef = useRef<boolean[]>([false])

  // Keep refs in sync
  useEffect(() => { pagesRef.current = pages }, [pages])
  useEffect(() => { activePageRef.current = activePage }, [activePage])

  // Save current editor content back into the pages array on every edit
  useEffect(() => {
    if (!editor) return
    const onUpdate = () => {
      if (suppressSave.current) return
      const idx = activePageRef.current
      const html = editor.getHTML()
      pagesRef.current[idx] = html
      dirtyRef.current[idx] = true
      setPages([...pagesRef.current])
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor])

  const switchPage = useCallback(
    (index: number) => {
      if (!editor || index === activePageRef.current) return
      // Save current page directly into ref
      pagesRef.current[activePageRef.current] = editor.getHTML()
      // Load target page from ref
      suppressSave.current = true
      editor.commands.setContent(pagesRef.current[index] || DEFAULT_PAGE)
      suppressSave.current = false
      setActivePage(index)
      setPages([...pagesRef.current])
      // Switch meta
      setPageMeta({ ...DEFAULT_META, ...metaRef.current[index] })
    },
    [editor],
  )

  const addPage = useCallback(() => {
    if (!editor) return
    // Save current page
    pagesRef.current[activePageRef.current] = editor.getHTML()
    pagesRef.current.push(DEFAULT_PAGE)
    dirtyRef.current.push(false)
    metaRef.current.push({ ...DEFAULT_META })
    const newIndex = pagesRef.current.length - 1
    // Switch to new page
    suppressSave.current = true
    editor.commands.setContent(DEFAULT_PAGE)
    suppressSave.current = false
    setActivePage(newIndex)
    setPages([...pagesRef.current])
    setPageMeta({ ...DEFAULT_META })
  }, [editor])

  const deletePage = useCallback(
    (index: number) => {
      if (pagesRef.current.length <= 1) return
      // Save current editor state before modifying
      pagesRef.current[activePageRef.current] = editor?.getHTML() || pagesRef.current[activePageRef.current]
      // Remove the page
      pagesRef.current.splice(index, 1)
      dirtyRef.current.splice(index, 1)
      metaRef.current.splice(index, 1)
      // Figure out which page to show
      let newActive = activePageRef.current
      if (index === activePageRef.current) {
        newActive = Math.min(index, pagesRef.current.length - 1)
      } else if (index < activePageRef.current) {
        newActive = activePageRef.current - 1
      }
      // Load the new active page
      if (editor) {
        suppressSave.current = true
        editor.commands.setContent(pagesRef.current[newActive] || DEFAULT_PAGE)
        suppressSave.current = false
      }
      setActivePage(newActive)
      setPages([...pagesRef.current])
      setPageMeta({ ...DEFAULT_META, ...metaRef.current[newActive] })
    },
    [editor],
  )

  const getPreview = useCallback(
    (index: number): string => {
      const html = pagesRef.current[index] || ''
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return text || '(empty)'
    },
    [],
  )

  const loadPages = useCallback(
    (htmlPages: string[], metas?: PageMeta[]) => {
      if (!editor) return
      const p = htmlPages.length > 0 ? htmlPages : [DEFAULT_PAGE]
      pagesRef.current = [...p]
      dirtyRef.current = p.map(() => false)
      metaRef.current = p.map((_, i) => ({ ...DEFAULT_META, ...metas?.[i] }))
      suppressSave.current = true
      editor.commands.setContent(p[0])
      suppressSave.current = false
      setActivePage(0)
      setPages([...p])
      setPageMeta({ ...metaRef.current[0] })
    },
    [editor],
  )

  const getAllPages = useCallback((): string[] => {
    if (!editor) return [...pagesRef.current]
    const result = [...pagesRef.current]
    result[activePageRef.current] = editor.getHTML()
    return result
  }, [editor])

  const getAllMetas = useCallback((): PageMeta[] => {
    return [...metaRef.current]
  }, [])

  const updatePageMeta = useCallback((meta: Partial<PageMeta>) => {
    const idx = activePageRef.current
    metaRef.current[idx] = { ...metaRef.current[idx], ...meta }
    dirtyRef.current[idx] = true
    setPageMeta({ ...metaRef.current[idx] })
  }, [])

  const isPageDirty = useCallback((index: number): boolean => {
    return dirtyRef.current[index] ?? false
  }, [])

  const hasDirtyPages = useCallback((): boolean => {
    return dirtyRef.current.some(Boolean)
  }, [])

  const markAllClean = useCallback(() => {
    dirtyRef.current = dirtyRef.current.map(() => false)
  }, [])

  return {
    pages,
    activePage,
    pageMeta,
    switchPage,
    addPage,
    deletePage,
    getPreview,
    loadPages,
    getAllPages,
    getAllMetas,
    updatePageMeta,
    isPageDirty,
    hasDirtyPages,
    markAllClean,
  }
}
