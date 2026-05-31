# src/utils

Shared, framework-agnostic types and constants used to describe slide canvas dimensions, page presentation metadata, and font choices. These modules hold no React/Tiptap dependencies and act as the single source of truth for defaults and preset lists referenced by hooks, the top-level `App`, and the dev-server slides plugin.

## Files

### canvas-size.ts
- **Purpose:** Defines the canvas dimension model and the built-in size presets used by the slide editor and exporter.
- **Exports:** `CanvasSize` (interface), `CanvasPreset` (interface), `CANVAS_PRESETS` (TikTok / A4 / HD / Full HD), `DEFAULT_CANVAS_SIZE`, `CUSTOM_PRESET_VALUE` (`'custom'`), `matchPreset(size)`.
- **Notes:** Consumed by `src/App.tsx`, `src/hooks/useSlides.ts`, and `src/server/slidesPlugin.ts`. `DEFAULT_CANVAS_SIZE` is derived from the first entry of `CANVAS_PRESETS` (TikTok 960x1600), so reordering the array changes the app default. `matchPreset` returns `CUSTOM_PRESET_VALUE` when no preset matches exactly.

### page-meta.ts
- **Purpose:** Per-page presentation metadata (scaling, dark mode, optional custom CSS) plus deck-level font defaults/options.
- **Exports:** `PageMeta` (interface with `fontScale`, `marginScale`, `dark`, optional `customCss`), `DEFAULT_FONT_FAMILY`, `FONT_OPTIONS` (value/label/css triples for Segoe UI Emoji, Inter, JetBrains Mono, Consolas), `DEFAULT_META`.
- **Notes:** Consumed by `src/App.tsx`, `src/hooks/usePages.ts`, and `src/hooks/useSlides.ts`. `fontScale` and `marginScale` are percentages (100 = baseline). `FONT_OPTIONS[].css` is the literal `font-family` stack written into rendered slides; the `value` field is persisted at deck level as `fontFamily`. Page metadata does not carry normal-text or code font choices.
