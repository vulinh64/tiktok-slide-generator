# src

Source root for the TikTok slide generator: a React + TypeScript + Vite single-page app. Users build multi-page "slide decks" in a Tiptap rich-text editor, configure deck-level presentation (font, canvas size, background image) plus per-page presentation (font scale, margin scale, dark mode, custom CSS), and export individual slides or whole decks to PNG via `html-to-image`. A dev-time Vite middleware plugin (`server/`) persists decks to the user's home directory.

## Files

### main.tsx
- **Purpose:** Vite/React entry point.
- **Notes:** Mounts `<App />` into `#root` in `StrictMode`; imports `index.css`.

### App.tsx
- **Purpose:** Top-level component; owns deck/page state and routes between the Home dashboard and the editor screen.
- **Notes:** Wires `useSlideEditor`, `usePages`, `useSlides`, `useSessionState`; handles `handleExport` / `handleExportAll` (single PNG and ZIP of PNGs); `handleExportAll` renders pages sequentially as `0000.png`, `0001.png`, etc. with a shared ZIP timestamp; `handleExportRaw` flushes the deck to disk and downloads `/api/slides/:id/export` (raw deck zip); `handleHomeImport` POSTs a user-picked zip to `/api/slides/import`, refreshes the list, and auto-opens the new deck. Owns deck-level state (title, slide CSS, canvas size, global font family, code font) and per-page meta; applies per-page meta plus the deck-level font to the live canvas during bulk export; persists deck on `beforeunload` via `navigator.sendBeacon`. Code-font choice is propagated as a `--code-font` CSS variable on `#slide-canvas`; default `jetbrains` leaves the variable unset so the CSS fallback in `components/Editor.css` applies. The two-row sticky header puts back/title + Save/Export/BG/Manage Images actions on the primary row and all per-deck/per-page setting controls on the secondary row (wraps as needed). The `skipNonExportedNodes` filter strips UI-only nodes (ProseMirror separator image, code-block language `<select>`) from PNGs.

### App.css
- **Purpose:** Layout/shell styles for App (toolbar bar, page list rail, canvas container, export overlay, modals).
- **Notes:** Paired with `App.tsx`. Component-specific styles live next to their components in `components/*.css`.

### index.css
- **Purpose:** Global reset + `@font-face` declarations for the bundled JetBrains Mono family.
- **Notes:** Loaded once from `main.tsx`. Font files referenced live in `assets/`.

## Subdirectories

- **assets/** - JetBrains Mono webfont files (woff2) loaded via `@font-face` in `index.css`, plus a few currently-unreferenced images (`hero.png`, `react.svg`, `vite.svg`).
- **components/** - React UI for the editor: Home dashboard, Tiptap editor surface + toolbar, page sidebar, Tiptap node views (image, code block), and supporting modals/toasts.
- **extensions/** - ProseMirror plugin and Shiki tokenizer that add syntax-highlighted decorations to Tiptap's built-in `CodeBlock` node (consumed by `useSlideEditor`).
- **hooks/** - Custom React hooks owning runtime state: Tiptap editor setup, the multi-page slide model, the deck REST client, and a `sessionStorage`-backed `useState`.
- **server/** - Dev-time Vite middleware plugin (`slidesPlugin`) serving a `/api/slides` JSON REST API that persists decks, images, and backgrounds under `~/.notes/<deckId>/`.
- **utils/** - Framework-agnostic types, defaults, and preset lists for canvas dimensions (`canvas-size.ts`) plus page metadata/font choices (`page-meta.ts`).

Each subdirectory has its own `description.md` with per-file details.
