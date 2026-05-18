# AGENTS.md

Orientation guide for AI agents working in this repo. Read this first, then drill into the per-directory `description.md` files linked below.

## What this project is

**tiktok-slider** — a React + TypeScript + Vite single-page app for authoring multi-page "slide decks" suitable for TikTok-style image carousels.

- **Editor:** Tiptap (ProseMirror) rich-text editor with custom node views (image, code block) and a Shiki-powered syntax-highlighting plugin.
- **Pages:** A deck is an ordered list of pages. Each page has its own HTML content plus metadata (font, font scale, margin scale, dark mode, custom CSS).
- **Canvas:** Pages render into a fixed-size `#slide-canvas` element with configurable dimensions (preset or custom) and optional background image.
- **Export:** Single page → PNG via `html-to-image`. Whole deck → ZIP of PNGs via `html-to-image` + `jszip`. Whole deck → raw `.zip` of the on-disk deck dir (metadata + images + bg) via `GET /api/slides/:id/export`, importable back through `POST /api/slides/import`. UI-only nodes (the code-block language `<select>`, ProseMirror separator image) are filtered out of PNGs at export time.
- **Persistence:** A dev-time Vite middleware plugin (`src/server/slidesPlugin.ts`) exposes `/api/slides` REST endpoints that store decks, page images, and backgrounds under `~/.notes/<deckId>/`.

## Stack

- React 19 + TypeScript + Vite 8
- Tiptap 2 (`@tiptap/react`, `@tiptap/starter-kit`, extensions for image, placeholder, text-align, text-style, color, highlight, underline)
- Shiki 4 for syntax highlighting
- `html-to-image` for canvas → PNG; `jszip` for bulk export
- Persistence: dev-only Vite middleware writing to `~/.notes/`

## Scripts

- `npm run dev` — Vite dev server (includes the slides middleware plugin)
- `npm run build` — `tsc -b && vite build`
- `npm run lint` — ESLint
- `npm run preview` — preview the production build

## Where things live

Each directory under `src/` has a `description.md` with per-file details. Start at the root description, then jump to whichever subfolder is relevant.

- [src/description.md](src/description.md) — root files (`main.tsx`, `App.tsx`, `App.css`, `index.css`) and an index of subfolders
  - [src/assets/description.md](src/assets/description.md) — fonts (JetBrains Mono) and static images
  - [src/components/description.md](src/components/description.md) — React UI: Home, Editor, Toolbar, PageList, node views, modals, toasts
  - [src/extensions/description.md](src/extensions/description.md) — Tiptap/ProseMirror customizations (Shiki code-block highlighting)
  - [src/hooks/description.md](src/hooks/description.md) — custom hooks (`useSlideEditor`, `usePages`, `useSlides`, `useSessionState`)
  - [src/server/description.md](src/server/description.md) — Vite middleware plugin serving `/api/slides`
  - [src/utils/description.md](src/utils/description.md) — framework-agnostic types & presets (`canvas-size`, `page-meta`)

## Conventions for agents

- Keep changes scoped — this project favors small, targeted edits over refactors.
- When a `description.md` is wrong or stale, update it alongside the code change.
- Don't add comments that just restate the code; only document the non-obvious "why".
- Don't introduce backwards-compatibility shims or feature flags; edit the code directly.
- For UI/export changes, verify behavior in a browser — type checks alone don't catch rendering regressions.
