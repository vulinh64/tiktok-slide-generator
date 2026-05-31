# src/server

Dev-time Vite middleware plugin that persists slide decks (and their images, backgrounds, custom CSS, canvas size, deck font, and code font) under `~/.notes/`. It exposes a JSON REST API mounted on the Vite dev server at `/api/slides`. There is no production server here; wiring lives in the root `vite.config.ts` via `plugins: [react(), slidesPlugin()]`.

## Files

### slidesPlugin.ts
- **Purpose:** Exports `slidesPlugin()`, a Vite `Plugin` whose `configureServer` installs a connect middleware that handles every `/api/slides*` request (list/save/get/delete decks, upload/list/rename/delete/serve images, upload/serve/delete a single background image per deck).
- **Endpoints / API:**
  - `GET    /api/slides` - list all decks: `[{ id, title, createdAt, updatedAt }]` (sourced from root `info.json` index, rebuilt by directory scan if missing/corrupt).
  - `POST   /api/slides` - create or update a deck. Body: `{ id?, title, pages: SerializedPage[], customCss?, canvasSize?: {width,height}, codeFont?: 'jetbrains' | 'consolas', fontFamily?: 'segoe-ui-emoji' | 'inter' | 'jetbrains-mono' | 'consolas' }`. If `id` omitted, generates a `yyyyMMdd-HHmmss` id. Preserves `createdAt` and existing `imgs` on update; scans pages' HTML for `data-width="..."` next to `/api/slides/.../images/<name>` URLs to sync per-image `width` into `info.json`. Empty/whitespace `customCss` drops the field; omitted keeps existing. `fontFamily` and `codeFont` are only persisted when non-default (`'segoe-ui-emoji'` / `'jetbrains'` are represented as field absence); invalid values fall back to existing/default. Page metadata is sanitized before writing. Returns `{ id, ...info, title }`.
  - `GET    /api/slides/:id` - full deck payload: `{ id, title, customCss, canvasSize, fontFamily, codeFont, imgs, hasBg, createdAt, updatedAt, pages }`. Returns 404 if deck dir missing.
  - `DELETE /api/slides/:id` - `rm -rf` the deck directory and remove it from the root index. Returns `{ ok: true }`.
  - `POST   /api/slides/:id/images` - upload raw image bytes (request body is the binary). MIME is sniffed from magic bytes (png/jpeg/gif/webp/svg/avif). Saves to next available `img-XXXX` (zero-padded 4 digits) and appends an `ImageEntry` to `info.json` with default `width: 100`. Returns `{ name, url, mime, size }`.
  - `GET    /api/slides/:id/images` - return `info.imgs` array.
  - `PATCH  /api/slides/:id/images/:name` - rename an image. Body: `{ name: newName }`. Validates name via `^[a-zA-Z0-9._-]+$` (no `..`, length 1-100). Renames file on disk and updates `info.imgs`. 409 if target name exists; 404 if image not found. Caller is responsible for updating URL refs in pages.
  - `DELETE /api/slides/:id/images/:name` - delete file and entry from `info.imgs`.
  - `GET    /api/slides/:id/images/:name` - serve raw image bytes with sniffed `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`.
  - `POST   /api/slides/:id/bg` - upload background (single file, fixed name `bg`). Only `image/png` and `image/jpeg` are accepted; rejects others with 400.
  - `GET    /api/slides/:id/bg` - serve background bytes with `Cache-Control: no-cache`.
  - `DELETE /api/slides/:id/bg` - remove background file.
  - `GET    /api/slides/:id/export` - download the deck as a zip. Layout: `post.json`, `info.json`, `bg` at root; image files under `images/img-NNNN`. Only known files are included; unknown files in the deck dir are dropped. Sets `Content-Disposition: attachment; filename="<safeName>-<id>.zip"`.
  - `POST   /api/slides/import` - import a deck zip (body is the raw zip bytes). Generates a fresh `yyyyMMdd-HHmmss` id (bumps by 1s on collision), rewrites `/api/slides/<oldId>/images/` refs in page HTML and any string `customCss` to the new id, then writes a new deck dir. Entries are whitelisted: only `post.json`, `info.json`, `bg`, and `images/img-NNNN` are restored (defends against path traversal and stray files). Page metadata is sanitized to `fontScale`, `marginScale`, `dark`, and `customCss`; page-level font keys are dropped. `info.json` is shape-validated per-field (non-string `name` -> `Untitled`, malformed `canvasSize` is dropped, etc.); `info.imgs` is rebuilt by joining files actually present in the zip with metadata from `info.imgs`: orphan entries (listed but no file) are dropped, orphan files (in zip but unlisted) get synthesized defaults (MIME sniffed, `width: 100`). Returns `{ id, title }`. 400 on invalid zip / missing `post.json`.
- **Notes:**
  - Internal types: `SerializedPage = { meta: Record<string, unknown>, html: string }`, `PostFile = { version: 1, pages: SerializedPage[] }`, `DeckInfo = { name, customCss?, canvasSize?, fontFamily?, codeFont?: 'jetbrains' | 'consolas', imgs: ImageEntry[], createdAt, updatedAt }`, `ImageEntry = { name, mime, size, width, addedAt }`, `RootIndexEntry = { id, name }`.
  - `sanitizePages` strips page metadata down to supported per-page fields before reading/writing `post.json`: `fontScale`, `marginScale`, `dark`, and `customCss`.
  - Page storage migrates legacy `NNNN.data` files (optional `---` YAML-ish front matter + HTML body) into a single `post.json` on first read via `migrateLoosePages`, then deletes the loose files. Writes go through `writePost` which writes `post.json.tmp` and renames atomically.
  - Root index `~/.notes/info.json` is upserted on save and on delete; full rebuild only happens when it's missing or fails to parse.
  - Deck id format and validity: `yyyyMMdd-HHmmss` (regex `^\d{8}-\d{6}$`), used as the directory name; `parseTimestamp` reformats it to `yyyy-MM-dd HH:mm:ss` for `createdAt` fallback.
  - Frontend callers: anywhere in `src/` that fetches `/api/slides...`; the deck list/editor UI uses these endpoints for load/save, the Tiptap image extension uploads via `POST .../images`, and exported HTML img tags reference `/api/slides/:id/images/:name` URLs directly.

## Storage layout

Everything lives under `~/.notes/` (Node `os.homedir()` join `.notes`):

```text
~/.notes/
  info.json                 # RootIndex: [{ id, name }, ...], sorted by id desc
  <yyyyMMdd-HHmmss>/        # one directory per deck, name == deck id
    info.json               # DeckInfo (name, customCss?, canvasSize?, fontFamily?, codeFont?, imgs[], createdAt, updatedAt)
    post.json               # { version: 1, pages: SerializedPage[] }
    img-0001, img-0002, ... # raw image bytes, no extension; MIME stored in info.imgs
    bg                      # optional background image bytes (png or jpeg only)
    NNNN.data               # legacy per-page files; auto-migrated into post.json then deleted
```
