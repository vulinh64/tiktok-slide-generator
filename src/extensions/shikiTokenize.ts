import type { HighlighterCore, ThemedToken } from 'shiki'

const SHIKI_THEME = 'github-dark-default'

interface StyledToken {
  cls: string
  style: string
  length: number
}

function fontStyleToCSS(fontStyle: number | undefined): string {
  if (!fontStyle) return ''
  const parts: string[] = []
  if (fontStyle & 1) parts.push('font-style: italic')
  if (fontStyle & 2) parts.push('font-weight: bold')
  if (fontStyle & 4) parts.push('text-decoration: underline')
  return parts.join('; ')
}

function tokenToStyle(token: ThemedToken): string {
  return [
    token.color ? `color: ${token.color}` : '',
    fontStyleToCSS(token.fontStyle),
  ].filter(Boolean).join('; ')
}

export function tokenizeCode(
  highlighter: HighlighterCore,
  code: string,
  language: string,
): StyledToken[] {
  const langs = highlighter.getLoadedLanguages()
  const lang = language && langs.includes(language) ? language : 'text'

  const result = highlighter.codeToTokens(code, {
    lang,
    theme: SHIKI_THEME,
  })

  const tokens: StyledToken[] = []

  for (let lineIdx = 0; lineIdx < result.tokens.length; lineIdx++) {
    const line = result.tokens[lineIdx]

    for (const token of line) {
      if (token.content.length > 0) {
        tokens.push({
          cls: '',
          style: tokenToStyle(token),
          length: token.content.length,
        })
      }
    }

    if (lineIdx < result.tokens.length - 1) {
      tokens.push({ cls: '', style: '', length: 1 })
    }
  }

  return tokens
}
