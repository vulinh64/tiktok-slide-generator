# tiktok-slider

A small React + TypeScript + Vite app for authoring multi-page "slide decks" suitable for TikTok-style image carousels. Pages are edited in a Tiptap rich-text editor with per-page styling (font, dark mode, custom CSS) and a configurable canvas size, then exported to PNG — one slide at a time or a whole deck as a ZIP.

## Run in dev

```sh
npm install
npm run dev
```

The dev server includes a Vite middleware plugin that persists decks, page images, and backgrounds under `~/.notes/<deckId>/` so your work survives reloads.

## Other scripts

- `npm run build` — type-check and build for production (`tsc -b && vite build`)
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## More

See [AGENTS.md](AGENTS.md) for project orientation, stack details, and links to per-directory `description.md` files.
