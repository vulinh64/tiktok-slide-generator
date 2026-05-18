# src

Source root for the TikTok slide generator — a React + TypeScript + Vite single-page app. Users build multi-page "slide decks" in a Tiptap rich-text editor, configure per-page presentation (font, dark mode, custom CSS, canvas size, background image), and export individual slides or whole decks to PNG via `html-to-image`. A dev-time Vite middleware plugin (`server/`) persists decks to the user's home directory.

## Files

### main.tsx
- **Purpose:** Vite/React entry point.
- **Notes:** Mounts `<App />` into `#root` in `StrictMode`; imports `index.css`.

### App.tsx
- **Purpose:** Top-level component; owns deck/page state and routes between the Home dashboard and the editor screen.
- **Notes:** Wires `useSlideEditor`, `usePages`, `useSlides`, `useSessionState`; handles `handleExport` / `handleExportAll` (single PNG and ZIP of PNGs); applies per-page meta (font, margin, dark mode, custom CSS) to the live canvas during bulk export; persists deck on `beforeunload` via `navigator.sendBeacon`. The `skipNonExportedNodes` filter strips UI-only nodes (ProseMirror separator image, code-block language `<select>`) from PNGs.

### App.css
- **Purpose:** Layout/shell styles for App (toolbar bar, page list rail, canvas container, export overlay, modals).
- **Notes:** Paired with `App.tsx`. Component-specific styles live next to their components in `components/*.css`.

### index.css
- **Purpose:** Global reset + `@font-face` declarations for the bundled JetBrains Mono family.
- **Notes:** Loaded once from `main.tsx`. Font files referenced live in `assets/`.

## Subdirectories

- **assets/** — JetBrains Mono webfont files (woff2) loaded via `@font-face` in `index.css`, plus a few currently-unreferenced images (`hero.png`, `react.svg`, `vite.svg`).
- **components/** — React UI for the editor: Home dashboard, Tiptap editor surface + toolbar, page sidebar, Tiptap node views (image, code block), and supporting modals/toasts.
- **extensions/** — ProseMirror plugin and Shiki tokenizer that add syntax-highlighted decorations to Tiptap's built-in `CodeBlock` node (consumed by `useSlideEditor`).
- **hooks/** — Custom React hooks owning runtime state: Tiptap editor setup, the multi-page slide model, the deck REST client, and a `sessionStorage`-backed `useState`.
- **server/** — Dev-time Vite middleware plugin (`slidesPlugin`) serving a `/api/slides` JSON REST API that persists decks, images, and backgrounds under `~/.notes/<deckId>/`.
- **utils/** — Framework-agnostic types, defaults, and preset lists for canvas dimensions (`canvas-size.ts`) and per-page presentation metadata such as fonts, scaling, and dark mode (`page-meta.ts`).

Each subdirectory has its own `description.md` with per-file details.
