# src/hooks

Custom React hooks that own the app's runtime state: the Tiptap editor instance, the multi-page slide model, the persisted deck list fetched from the API, and a small sessionStorage-backed primitive. Everything here is wired together inside `App.tsx`; components further down the tree only consume types (e.g. `SlideDeck`) or the values App passes via props.

## Files

### useSessionState.ts
- **Purpose:** `useState` replacement that mirrors the value to `sessionStorage` under a given key.
- **Returns:** `[value, setValue]` tuple, generic over `T`.
- **Notes:** Reads once on init (JSON-parsed); writes are wrapped in try/catch so quota errors are swallowed. Used in `App.tsx` for ephemeral UI state that should survive a reload within the same tab.

### useSlideEditor.ts
- **Purpose:** Creates and configures the single shared Tiptap `Editor` instance used to edit the active slide page.
- **Returns:** `{ editor, setDeckId }` — the Tiptap editor and a setter for the current deck id (needed for image uploads).
- **Notes:** Loads Shiki at module load time and injects the highlighter into the code-block plugin once ready. Registers a custom ProseMirror plugin that intercepts image drop/paste and POSTs to `/api/slides/:deckId/images`. Extends the `Image` node with a `width` attribute and renders it via `ImageView`; code blocks render via `CodeBlockView`. StarterKit's History extension is left at its default config, so Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z drive undo/redo for every doc change (text, marks, headings, alignment, lists, image insert/delete). Undoing an image insert only removes the node from the page — the uploaded file stays on the server and can be re-inserted from the Images modal. Consumed only by `App.tsx`, which passes `editor` down to `usePages`, the toolbar, and `EditorContent`.

### useSlides.ts
- **Purpose:** Client for the `/api/slides` REST endpoints — lists, saves, loads, and deletes slide decks.
- **Returns:** `{ decks, loading, refresh, saveDeck, loadDeck, deleteDeck }`.
- **Notes:** Auto-calls `refresh()` on mount. `saveDeck` takes title, pages, optional existing id, optional `customCss`, optional `canvasSize`, and optional `codeFont` (`'jetbrains' | 'consolas'`); returns the saved deck id and refreshes the list. Also exports `SerializedPage`, `SlideDeck`, `SlideDeckFull`, and `CodeFont` types — `SlideDeck` is re-imported as a type by `Home.tsx` and `SlideManager.tsx`; `CodeFont` is consumed by `App.tsx`. Consumed by `App.tsx`.

### usePages.ts
- **Purpose:** Owns the in-memory array of slide pages (HTML strings + per-page `PageMeta`) and syncs it with the Tiptap editor.
- **Returns:** `pages`, `activePage`, `pageMeta`, plus `switchPage`, `addPage`, `deletePage`, `getPreview`, `loadPages`, `getAllPages`, `getAllMetas`, `updatePageMeta`, `isPageDirty`, `hasDirtyPages`, `markAllClean`, `replaceUrlInPages`.
- **Notes:** Takes the Tiptap editor as its only argument and listens to its `update` event to write the current page HTML back into the array. Uses refs (`pagesRef`, `activePageRef`, `metaRef`, `dirtyRef`) so callbacks never read stale state, and a `suppressSave` flag to avoid feedback loops when `setContent` is called during page switching/loading. Tracks per-page dirty state for partial-save optimizations. `replaceUrlInPages` rewrites image URLs across every page (used after image upload renames). Consumed by `App.tsx`.
