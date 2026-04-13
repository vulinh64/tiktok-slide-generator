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
import { htmlToMarkdown, markdownToHtml, parseFrontMatter } from './utils/markdown'
import './App.css'

function App() {
  const [screen, setScreen] = useState<'home' | 'editor'>('home')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [canvasZoom, setCanvasZoom] = useSessionState('slide-canvas-zoom', 50)
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null)
  const [currentDeckTitle, setCurrentDeckTitle] = useState('')
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
  } = usePages(editor)

  const fontScale = pageMeta.fontScale
  const marginScale = pageMeta.marginScale
  const dark = pageMeta.dark
  const codeTheme = pageMeta.codeTheme
  const setFontScale = useCallback((v: number) => updatePageMeta({ fontScale: v }), [updatePageMeta])
  const setMarginScale = useCallback((v: number) => updatePageMeta({ marginScale: v }), [updatePageMeta])
  const setDark = useCallback((v: boolean) => updatePageMeta({ dark: v }), [updatePageMeta])
  const setCodeTheme = useCallback((v: string) => updatePageMeta({ codeTheme: v }), [updatePageMeta])

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

  // Wrap page switching to auto-persist to disk
  const handlePageSwitch = useCallback(
    (index: number) => {
      switchPage(index)
      // Fire-and-forget persist after switching
      persistCurrentDeck()
    },
    [switchPage, persistCurrentDeck],
  )

  const handleAddPage = useCallback(() => {
    addPage()
    // Fire-and-forget persist after adding
    persistCurrentDeck()
  }, [addPage, persistCurrentDeck])

  const handleDeletePage = useCallback(
    (index: number) => {
      deletePage(index)
      // Fire-and-forget persist after deleting
      persistCurrentDeck()
    },
    [deletePage, persistCurrentDeck],
  )

  const handleRename = useCallback(() => {
    const name = window.prompt('Slideshow name:', currentDeckTitle || '')
    if (name !== null) {
      setCurrentDeckTitle(name)
    }
  }, [currentDeckTitle])

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

  // Go back to home from editor
  const handleBackToHome = useCallback(async () => {
    await persistCurrentDeck()
    setCurrentDeckId(null)
    setCurrentDeckTitle('')
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
            value={codeTheme}
            onChange={(e) => setCodeTheme(e.target.value)}
          >
            <option value="catppuccin">Catppuccin</option>
            <option value="github-dark">GitHub Dark</option>
            <option value="vscode-dark">VS Code Dark</option>
            <option value="dracula">Dracula</option>
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
          <button className="export-btn" onClick={handleExport}>
            Export PNG
          </button>
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
              data-code-theme={codeTheme}
              style={{
                fontSize: `${(18 * fontScale) / 100}px`,
                '--slide-padding-x': `${(48 * marginScale) / 100}px`,
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
    </div>
  )
}

export default App
