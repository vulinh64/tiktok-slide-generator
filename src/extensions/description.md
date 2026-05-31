# src/extensions

Tiptap / ProseMirror extension code that augments the slide editor with syntax highlighting. These are not full Tiptap nodes/marks of their own; instead they provide a ProseMirror `Plugin` (decoration-based highlighter) and a Shiki tokenization helper that the consuming hook attaches to Tiptap's built-in `CodeBlock` node via `addProseMirrorPlugins`.

## Files

### shikiPlugin.ts
- **Purpose:** Builds a ProseMirror `Plugin` that decorates `code_block` nodes with Shiki-derived inline styles.
- **Extends:** Plain `Plugin` from `@tiptap/pm/state` (not a Tiptap `Node`/`Mark`/`Extension`); attached to the `CodeBlock` node through `addProseMirrorPlugins` in `src/hooks/useSlideEditor.ts`.
- **Notes:**
  - Exposes `createShikiPlugin({ name, highlighter })` — `name` is the node type to scan (passed as `this.name` from the Tiptap extension), `highlighter` may start as `null` and be swapped in later via a transaction meta key `'shikiHighlighter'`.
  - Maintains a `DecorationSet` in plugin state; recomputes decorations when the highlighter is injected, when code-block count changes, when the selection enters/leaves a code block, or when a step touches a code block; otherwise just maps the existing set.
  - Decorations are `Decoration.inline` with `class` and `style` attrs produced by `tokenizeCode`.

### shikiTokenize.ts
- **Purpose:** Converts a code string into a flat list of styled tokens (`{ cls, style, length }`) consumed by `shikiPlugin` to build inline decorations.
- **Extends:** Nothing Tiptap-specific; pure helper around Shiki's `HighlighterCore.codeToTokens`.
- **Notes:**
  - Hard-codes theme `'github-dark-default'` and falls back to language `'text'` if the requested language isn't loaded by the highlighter.
  - Uses Shiki's default token colors and font styles directly; there are no language-specific post-processing heuristics.
  - Newlines are emitted as zero-class tokens of length 1 so cumulative offsets line up with `block.pos + 1` in `shikiPlugin`.
  - Only exported symbol: `tokenizeCode`.
