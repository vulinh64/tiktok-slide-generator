# src/components

UI building blocks for the slide editor: the home/dashboard screen, the Tiptap editor surface and its toolbar, the page sidebar, Tiptap node views (image, code block), and supporting modals/toasts. Each `.tsx` is paired with a same-named `.css`. Top-level wiring lives in `src/App.tsx`; Tiptap setup (which mounts the node views below) lives in `src/hooks/useSlideEditor.ts`.

## Files

### Editor.tsx (+ Editor.css)
- **Purpose:** thin wrapper that renders Tiptap's `EditorContent` for a given editor instance.
- **Exports:** `Editor`
- **Notes:** Receives the Tiptap editor from `useSlideEditor`; returns `null` if no editor.

### Toolbar.tsx (+ Toolbar.css)
- **Purpose:** formatting toolbar for the active page (text styles, headings, lists, alignment, color/highlight, image insert, HR, undo/redo).
- **Exports:** `Toolbar`
- **Notes:** Uploads/inserts a single image via `POST /api/slides/:deckId/images`; falls back to URL prompt when no `deckId`. The Page CSS modal now opens from the `Page` menu in `App.tsx`; the deck image manager opens from the `Images` menu.

### PageList.tsx (+ PageList.css)
- **Purpose:** left-rail list of pages in the current deck with add/select/delete and truncated text previews.
- **Exports:** `PageList`
- **Notes:** Refuses to delete the last remaining page; confirms via `window.confirm`.

### Home.tsx (+ Home.css)
- **Purpose:** landing screen listing existing decks with "New Slideshow", "Import .zip", and per-card delete.
- **Exports:** `Home`
- **Notes:** Consumes `SlideDeck` from `src/hooks/useSlides`. The Import button opens a file picker (`.zip`) and hands the chosen `File` to `onImport`, which the parent POSTs to `/api/slides/import`.

### CssModal.tsx (+ CssModal.css)
- **Purpose:** modal textarea editor for custom CSS (used for both per-page and per-deck CSS).
- **Exports:** `CssModal`
- **Notes:** Keeps a local `draft` and only fires `onApply` on Apply. Title/hint are passed in by the caller so the same component serves both scopes.

### ImageManager.tsx (+ ImageManager.css)
- **Purpose:** modal grid of all images uploaded to the current deck - click to insert, click name to rename, x to delete; supports multi-file upload.
- **Exports:** `ImageManager`
- **Notes:** Opened from the `Images` menu in `App.tsx`. Talks to `/api/slides/:deckId/images` (GET/POST/PATCH/DELETE). Uploads sequentially to avoid name collisions on the server. Calls `onImageRenamed` so the parent can update existing slide HTML referencing the old name. Validates names against `/^[a-zA-Z0-9._-]+$/`.

### ImageView.tsx (+ ImageView.css)
- **Purpose:** Tiptap `NodeView` for the image node - renders the `<img>` and a hover popover with a percent-width input (25-400%).
- **Exports:** `ImageView`
- **Notes:** Registered in `useSlideEditor.ts` via `ReactNodeViewRenderer`. `width` is stored as a number percentage on the node; `data-drag-handle` enables Tiptap drag-and-drop.

### CodeBlockView.tsx (+ CodeBlockView.css)
- **Purpose:** Tiptap `NodeView` for `codeBlock` - wraps `<pre><code>` and adds a language `<select>` that writes back via `updateAttributes`.
- **Exports:** `CodeBlockView`, plus a local `LANGUAGES` list of highlight.js-compatible languages.
- **Notes:** Registered in `useSlideEditor.ts`; the `language` attr also drives the `data-language` attribute used by syntax highlighting.

### SaveToast.tsx (+ SaveToast.css)
- **Purpose:** transient bottom-corner status toast (used for save confirmations).
- **Exports:** `SaveToast` component and `useSaveToast` hook (returns `{ message, showToast }`; auto-clears after 2s).

### SlideManager.tsx (+ SlideManager.css)
- **Purpose:** older popover panel for saving/loading/deleting decks from within the editor.
- **Exports:** `SlideManager`
- **Notes:** Not currently imported anywhere - superseded by `Home.tsx`. Safe to treat as legacy unless re-wired.

### Home.css / ImageManager.css / SaveToast.css / SlideManager.css / CssModal.css
- Style sheets for the matching components above; no standalone TS counterparts beyond what's listed.
