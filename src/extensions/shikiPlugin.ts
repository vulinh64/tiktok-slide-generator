import { findChildren } from '@tiptap/core'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { HighlighterCore } from 'shiki'
import { tokenizeCode } from './shikiTokenize'

const shikiPluginKey = new PluginKey('shiki')

function getDecorations(
  doc: ProsemirrorNode,
  name: string,
  highlighter: HighlighterCore | null,
) {
  if (!highlighter) return DecorationSet.create(doc, [])

  const decorations: Decoration[] = []

  findChildren(doc, (node) => node.type.name === name).forEach((block) => {
    let from = block.pos + 1
    const language = block.node.attrs.language
    const code = block.node.textContent

    if (!code) return

    try {
      const styledTokens = tokenizeCode(highlighter, code, language || '')

      for (const token of styledTokens) {
        const to = from + token.length

        if (token.cls || token.style) {
          const attrs: Record<string, string> = {}
          if (token.cls) attrs.class = token.cls
          if (token.style) attrs.style = token.style
          decorations.push(Decoration.inline(from, to, attrs))
        }

        from = to
      }
    } catch {
      // Language not supported
    }
  })

  return DecorationSet.create(doc, decorations)
}

export function createShikiPlugin({
  name,
  highlighter,
}: {
  name: string
  highlighter: HighlighterCore | null
}) {
  let currentHighlighter = highlighter

  const plugin = new Plugin<DecorationSet>({
    key: shikiPluginKey,

    state: {
      init(_, { doc }) {
        return getDecorations(doc, name, currentHighlighter)
      },
      apply(transaction, prev, oldState, newState) {
        const newHL: HighlighterCore | undefined = transaction.getMeta('shikiHighlighter')

        if (newHL) currentHighlighter = newHL

        if (newHL) {
          return getDecorations(transaction.doc, name, currentHighlighter)
        }

        if (!transaction.docChanged) {
          return prev.map(transaction.mapping, transaction.doc)
        }

        const oldNodeName = oldState.selection.$head.parent.type.name
        const newNodeName = newState.selection.$head.parent.type.name
        const oldNodes = findChildren(oldState.doc, (n) => n.type.name === name)
        const newNodes = findChildren(newState.doc, (n) => n.type.name === name)

        if (
          [oldNodeName, newNodeName].includes(name) ||
          newNodes.length !== oldNodes.length ||
          transaction.steps.some((step) => {
            const s = step as any
            return (
              s.from !== undefined &&
              s.to !== undefined &&
              oldNodes.some(
                (node) => node.pos >= s.from && node.pos + node.node.nodeSize <= s.to,
              )
            )
          })
        ) {
          return getDecorations(transaction.doc, name, currentHighlighter)
        }

        return prev.map(transaction.mapping, transaction.doc)
      },
    },

    props: {
      decorations(state) {
        return plugin.getState(state) ?? DecorationSet.empty
      },
    },
  })

  return plugin
}
