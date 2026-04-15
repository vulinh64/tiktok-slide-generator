import { useState, useCallback, useRef, useEffect } from 'react'
import { Editor } from './components/Editor'
import { Preview } from './components/Preview'
import { Toolbar } from './components/Toolbar'
import { PageList } from './components/PageList'
import { Home } from './components/Home'
import { useSlideEditor } from './hooks/useSlideEditor'
import { useSessionState } from './hooks/useSessionState'
import { useSlides } from './hooks/useSlides'
import { usePages } from './hooks/usePages'
import { htmlToMarkdown, markdownToHtml, parseFrontMatter, FONT_OPTIONS } from './utils/page-meta'
import { SaveToast, useSaveToast } from './components/SaveToast'
import './App.css'

function App() {
  const [screen, setScreen] = useState<'home' | 'editor'>('home')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [canvasZoom, setCanvasZoom] = useSessionState('slide-canvas-zoom', 50)
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null)
  const [currentDeckTitle, setCurrentDeckTitle] = useState('')
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const { editor, setDeckId } = useSlideEditor()
  const { decks, loading, refresh, saveDeck, loadDeck, deleteDeck } = useSlides()
  const {
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
    markAllClean,
  } = usePages(editor)

  const { message: toastMessage, showToast } = useSaveToast()

  const fontScale = pageMeta.fontScale
  const marginScale = pageMeta.marginScale
  const dark = pageMeta.dark
  const fontFamily = pageMeta.fontFamily
  const setFontScale = useCallback((v: number) => updatePageMeta({ fontScale: v }), [updatePageMeta])
  const setMarginScale = useCallback((v: number) => updatePageMeta({ marginScale: v }), [updatePageMeta])
  const setDark = useCallback((v: boolean) => updatePageMeta({ dark: v }), [updatePageMeta])
  const setFontFamily = useCallback((v: string) => updatePageMeta({ fontFamily: v }), [updatePageMeta])

  // Refs for the beforeunload handler and persistCurrentDeck
  const currentDeckIdRef = useRef(currentDeckId)
  const currentDeckTitleRef = useRef(currentDeckTitle)

  useEffect(() => { currentDeckIdRef.current = currentDeckId; setDeckId(currentDeckId) }, [currentDeckId, setDeckId])
  useEffect(() => { currentDeckTitleRef.current = currentDeckTitle }, [currentDeckTitle])

  // Persist current deck to disk (fire-and-forget)
  const persistCurrentDeck = useCallback(async () => {
    if (!editor || !currentDeckIdRef.current) return
    const allHtml = getAllPages()
    const metas = getAllMetas()
    const mdPages = allHtml.map((html, i) => htmlToMarkdown(html, metas[i]))
    await saveDeck(
      currentDeckTitleRef.current || 'Untitled',
      mdPages,
      currentDeckIdRef.current,
    )
  }, [editor, getAllPages, getAllMetas, saveDeck])

  // Persist on browser close / hard refresh
  useEffect(() => {
    const onBeforeUnload = () => {
      if (!currentDeckIdRef.current) return
      const allHtml = getAllPages()
      const metas = getAllMetas()
      const mdPages = allHtml.map((html, i) => htmlToMarkdown(html, metas[i]))
      // Use sendBeacon for reliability during unload
      navigator.sendBeacon(
        '/api/slides',
        new Blob(
          [JSON.stringify({
            id: currentDeckIdRef.current,
            title: currentDeckTitleRef.current || 'Untitled',
            pages: mdPages,
          })],
          { type: 'application/json' },
        ),
      )
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [getAllPages, getAllMetas])

  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'done'>('idle')

  const handleExport = useCallback(async () => {
    const { toPng } = await import('html-to-image')
    const canvas = document.getElementById('slide-canvas')
    if (!canvas) return

    try {
      const dataUrl = await toPng(canvas, {
        width: 960,
        height: 1600,
        pixelRatio: 2,
        backgroundColor: dark ? '#1a1a2e' : '#ffffff',
      })
      const link = document.createElement('a')
      const pageNum = String(activePage).padStart(4, '0')
      link.download = `${currentDeckTitle || 'slide'}-${pageNum}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
    }
  }, [dark, currentDeckTitle, activePage])

  const handleExportAll = useCallback(async () => {
    if (!editor) return
    setExportState('exporting')

    const originalPage = activePage

    try {
      const { toPng } = await import('html-to-image')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const allPages = getAllPages()
      const allMetas = getAllMetas()
      const canvas = document.getElementById('slide-canvas') as HTMLElement
      if (!canvas) throw new Error('Canvas not found')

      // Save original canvas styles to restore later
      const origStyle = {
        fontSize: canvas.style.fontSize,
        fontFamily: canvas.style.fontFamily,
        className: canvas.className,
      }

      for (let i = 0; i < allPages.length; i++) {
        const meta = allMetas[i]
        const isDark = meta.dark ?? true
        const fs = meta.fontScale ?? 100
        const ms = meta.marginScale ?? 100
        const ff = FONT_OPTIONS.find((f) => f.value === meta.fontFamily)?.css ?? FONT_OPTIONS[0].css

        // Apply this page's metadata directly to the canvas DOM
        canvas.className = `slide-canvas ${isDark ? 'dark' : ''}`
        canvas.style.fontSize = `${(18 * fs) / 100}px`
        canvas.style.fontFamily = ff
        canvas.style.setProperty('--slide-padding-x', `${(48 * ms) / 100}px`)

        // Set the content
        editor.commands.setContent(allPages[i])

        // Wait for DOM to settle
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

        const dataUrl = await toPng(canvas, {
          width: 960,
          height: 1600,
          pixelRatio: 2,
          backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
        })

        const base64 = dataUrl.split(',')[1]
        zip.file(`${String(i).padStart(4, '0')}.png`, base64, { base64: true })
      }

      // Restore original state
      canvas.className = origStyle.className
      canvas.style.fontSize = origStyle.fontSize
      canvas.style.fontFamily = origStyle.fontFamily

      // Restore original page
      switchPage(originalPage)

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `${currentDeckTitle || 'slides'}.zip`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)

      setExportState('done')
    } catch (err) {
      console.error('Export all failed:', err)
      setExportState('idle')
      switchPage(originalPage)
    }
  }, [editor, activePage, switchPage, getAllPages, getAllMetas, currentDeckTitle])

  // Wrap page switching to auto-persist dirty pages to disk
  const handlePageSwitch = useCallback(
    (index: number) => {
      const wasDirty = isPageDirty(activePage)
      switchPage(index)
      if (wasDirty) {
        persistCurrentDeck()
        markAllClean()
        showToast(`Page ${activePage + 1} saved`)
      }
    },
    [switchPage, persistCurrentDeck, isPageDirty, activePage, markAllClean, showToast],
  )

  const handleAddPage = useCallback(() => {
    addPage()
    persistCurrentDeck()
    markAllClean()
    showToast('Page added and saved')
  }, [addPage, persistCurrentDeck, markAllClean, showToast])

  const handleDeletePage = useCallback(
    (index: number) => {
      deletePage(index)
      persistCurrentDeck()
      markAllClean()
      showToast('Page deleted and saved')
    },
    [deletePage, persistCurrentDeck, markAllClean, showToast],
  )

  const handleRename = useCallback(() => {
    const name = window.prompt('Slideshow name:', currentDeckTitle || '')
    if (name !== null) {
      setCurrentDeckTitle(name)
      // Renaming always persists; title changed + flush any dirty pages
      setTimeout(() => {
        persistCurrentDeck()
        markAllClean()
        showToast('Renamed and saved')
      }, 0)
    }
  }, [currentDeckTitle, persistCurrentDeck, markAllClean, showToast])

  const handleBgUpload = useCallback(() => {
    if (!currentDeckId) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const buf = await file.arrayBuffer()
      await fetch(`/api/slides/${currentDeckId}/bg`, {
        method: 'POST',
        body: buf,
      })
      setBgUrl(`/api/slides/${currentDeckId}/bg?t=${Date.now()}`)
    }
    input.click()
  }, [currentDeckId])

  const handleBgRemove = useCallback(async () => {
    if (!currentDeckId) return
    await fetch(`/api/slides/${currentDeckId}/bg`, { method: 'DELETE' })
    setBgUrl(null)
  }, [currentDeckId])

  // Home screen: open existing deck
  const handleHomeOpen = useCallback(
    async (id: string) => {
      if (!editor) return
      const deck = await loadDeck(id)
      const parsed = deck.pages.map((md) => parseFrontMatter(md))
      const htmlPages = parsed.map((p) => markdownToHtml(p.content))
      const metas = parsed.map((p) => p.meta)
      loadPages(htmlPages, metas)
      setCurrentDeckId(deck.id)
      setCurrentDeckTitle(deck.title)
      setBgUrl(deck.hasBg ? `/api/slides/${deck.id}/bg?t=${Date.now()}` : null)
      setMode('edit')
      setScreen('editor')
    },
    [editor, loadDeck, loadPages],
  )

  // Home screen: create new deck
  const handleHomeCreate = useCallback(async () => {
    if (!editor) return
    const defaultHtml = '<h1>New Slide</h1><p>Start writing...</p>'
    loadPages([defaultHtml])
    const mdPages = [htmlToMarkdown(defaultHtml)]
    const id = await saveDeck('Untitled', mdPages)
    setCurrentDeckId(id)
    setCurrentDeckTitle('')
    setBgUrl(null)
    setMode('edit')
    setScreen('editor')
  }, [editor, loadPages, saveDeck])

  // Home screen: delete a deck
  const handleHomeDelete = useCallback(
    async (id: string) => {
      await deleteDeck(id)
    },
    [deleteDeck],
  )

  const handleManualSave = useCallback(() => {
    persistCurrentDeck()
    markAllClean()
    showToast('Saved')
  }, [persistCurrentDeck, markAllClean, showToast])

  // Go back to home from editor
  const handleBackToHome = useCallback(async () => {
    await persistCurrentDeck()
    setCurrentDeckId(null)
    setCurrentDeckTitle('')
    setBgUrl(null)
    await refresh()
    setScreen('home')
  }, [persistCurrentDeck, refresh])

  if (screen === 'home') {
    return (
      <Home
        decks={decks}
        loading={loading}
        onOpen={handleHomeOpen}
        onCreate={handleHomeCreate}
        onDelete={handleHomeDelete}
      />
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <button className="back-btn" onClick={handleBackToHome} title="Back to home">
            &larr;
          </button>
          <h1 className="app-title" onClick={handleRename} title="Click to rename">
            {currentDeckTitle || 'Untitled'}
          </h1>
        </div>
        <div className="app-actions">
          <button
            className={`mode-btn ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
          <button
            className={`mode-btn ${mode === 'preview' ? 'active' : ''}`}
            onClick={() => setMode('preview')}
          >
            Preview
          </button>
          <button
            className={`mode-btn dark-toggle ${dark ? 'active' : ''}`}
            onClick={() => setDark(!dark)}
          >
            {dark ? 'Dark' : 'Light'}
          </button>
          <select
            className="font-scale-select"
            value={fontScale}
            onChange={(e) => setFontScale(Number(e.target.value))}
          >
            <option value={100}>Font 100%</option>
            <option value={150}>Font 150%</option>
            <option value={200}>Font 200%</option>
            <option value={250}>Font 250%</option>
            <option value={300}>Font 300%</option>
            <option value={400}>Font 400%</option>
          </select>
          <select
            className="font-scale-select"
            value={marginScale}
            onChange={(e) => setMarginScale(Number(e.target.value))}
          >
            <option value={100}>Margin Default</option>
            <option value={150}>Margin 150%</option>
            <option value={200}>Margin 200%</option>
            <option value={250}>Margin 250%</option>
            <option value={300}>Margin 300%</option>
          </select>
          <select
            className="font-scale-select"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            className="font-scale-select"
            value={canvasZoom}
            onChange={(e) => setCanvasZoom(Number(e.target.value))}
          >
            <option value={10}>Zoom 10%</option>
            <option value={25}>Zoom 25%</option>
            <option value={35}>Zoom 35%</option>
            <option value={50}>Zoom 50%</option>
            <option value={70}>Zoom 70%</option>
            <option value={100}>Zoom 100%</option>
          </select>
          <button className="mode-btn" onClick={handleManualSave}>
            Save
          </button>
          <button className="export-btn" onClick={handleExport}>
            Export PNG
          </button>
          <button className="export-btn" onClick={handleExportAll}>
            Export All
          </button>
          <button className="mode-btn" onClick={handleBgUpload}>
            BG Image
          </button>
          {bgUrl && (
            <button className="mode-btn" onClick={handleBgRemove}>
              Remove BG
            </button>
          )}
        </div>
      </header>

      <div className="page-list-float">
        <PageList
          pages={pages}
          activePage={activePage}
          getPreview={getPreview}
          onPageSelect={handlePageSwitch}
          onAddPage={handleAddPage}
          onDeletePage={handleDeletePage}
        />
      </div>
      <main className="app-main">
        {mode === 'edit' && editor && <Toolbar editor={editor} deckId={currentDeckId} />}
        <div
          className="canvas-zoom-container"
          style={{
            width: `${960 * canvasZoom / 100}px`,
            height: `${1600 * canvasZoom / 100}px`,
          }}
        >
          <div
            className="canvas-wrapper"
            style={{
              transform: `scale(${canvasZoom / 100})`,
            }}
          >
            <div
              id="slide-canvas"
              className={`slide-canvas ${dark ? 'dark' : ''}`}
              style={{
                fontSize: `${(18 * fontScale) / 100}px`,
                fontFamily: FONT_OPTIONS.find((f) => f.value === fontFamily)?.css,
                '--slide-padding-x': `${(48 * marginScale) / 100}px`,
                ...(bgUrl ? {
                  backgroundImage: `url(${bgUrl})`,
                  backgroundSize: '960px 1600px',
                } : {}),
              } as React.CSSProperties}
            >
              {mode === 'edit' ? (
                <Editor editor={editor} />
              ) : (
                <Preview editor={editor} />
              )}
            </div>
          </div>
        </div>
      </main>

      <SaveToast message={toastMessage} />

      {exportState !== 'idle' && (
        <div className="export-overlay">
          <div className="export-overlay-card">
            {exportState === 'exporting' ? (
              <>
                <div className="export-spinner" />
                <p className="export-overlay-text">Your slideshow is being exported...</p>
              </>
            ) : (
              <>
                <div className="export-check">&#10003;</div>
                <p className="export-overlay-text">Your slideshow has been successfully exported.</p>
                <button className="export-btn" onClick={() => setExportState('idle')}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
