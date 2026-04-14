/**
 * Shared Shiki tokenization with Java heuristics.
 * Used by both the ProseMirror plugin (decorations) and Preview (HTML).
 */
import type { HighlighterCore, ThemedToken } from 'shiki'

const SHIKI_THEME = 'dark-plus'

/** PascalCase: starts with uppercase, has at least one lowercase */
const RE_PASCAL = /^[A-Z][a-zA-Z0-9]*$/
/** UPPER_SNAKE_CASE: all uppercase/digits/underscores, at least 2 chars */
const RE_UPPER_SNAKE = /^[A-Z][A-Z0-9_]+$/

/** Java hard reserved keywords + literals */
const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
  'true', 'false', 'null',
  'record',
])

/** Java operators */
const JAVA_OPERATORS = new Set(['+', '-', '*', '/', '%', '<', '=', '>', '?', ':', '!', '&', '|', '^', '~'])

const HEURISTIC_COLORS: Record<string, string> = {
  type: '#4EC9B0',
  constant: '#FFC66D',
  keyword: '#499DC5',
  invocation: '#D4D4D4',
  operator: '#D4D4D4',
}

interface TokenClassResult {
  cls: string
  colorOverride?: string
}

function scopeToClass(token: ThemedToken): TokenClassResult {
  const expl = token.explanation
  if (!expl?.length) return { cls: '' }

  const scopes = expl[expl.length - 1].scopes
  if (!scopes?.length) return { cls: '' }

  const deepest = scopes[scopes.length - 1].scopeName

  if (deepest.startsWith('keyword') || deepest.startsWith('storage.modifier')) return { cls: 'token keyword', colorOverride: 'keyword' }
  if (deepest.startsWith('storage.type.function.arrow')) return { cls: 'token operator', colorOverride: 'operator' }
  if (deepest.startsWith('storage.type')) return { cls: 'token class-name' }
  if (deepest.startsWith('entity.name.function')) return { cls: 'token function' }
  if (deepest.startsWith('entity.name.type') || deepest.startsWith('entity.name.class')) return { cls: 'token class-name' }
  if (deepest.startsWith('entity.name.namespace') || deepest.startsWith('entity.name.scope-resolution')) return { cls: 'token namespace' }
  if (deepest.startsWith('entity.name.tag')) return { cls: 'token tag' }
  if (deepest.startsWith('entity.other.attribute')) return { cls: 'token attr-name' }
  if (deepest.startsWith('variable.other.constant')) return { cls: 'token constant' }
  if (deepest.startsWith('constant.numeric')) return { cls: 'token number' }
  if (deepest.startsWith('constant.language')) return { cls: 'token constant' }
  if (deepest.startsWith('constant.character.escape')) return { cls: 'token escape' }
  if (deepest.startsWith('constant')) return { cls: 'token constant' }
  if (deepest.startsWith('string')) return { cls: 'token string' }
  if (deepest.startsWith('comment')) return { cls: 'token comment' }
  if (deepest.startsWith('punctuation.definition.annotation') || deepest.startsWith('storage.type.annotation')) return { cls: 'token annotation', colorOverride: 'type' }
  if (deepest.startsWith('punctuation')) return { cls: 'token punctuation' }
  if (deepest.startsWith('support.function')) return { cls: 'token function' }
  if (deepest.startsWith('support.class') || deepest.startsWith('support.type')) return { cls: 'token class-name' }
  if (deepest.startsWith('entity.other.inherited-class')) return { cls: 'token class-name' }

  const text = token.content.trim()
  if (
    deepest.startsWith('variable.other.object') ||
    deepest.startsWith('variable.other.property') ||
    deepest.startsWith('variable.other.definition') ||
    deepest.startsWith('variable.parameter') ||
    deepest.startsWith('variable')
  ) {
    if (RE_UPPER_SNAKE.test(text)) return { cls: 'token constant', colorOverride: 'constant' }
    if (RE_PASCAL.test(text)) return { cls: 'token class-name', colorOverride: 'type' }
    if (deepest.startsWith('variable.other.definition')) return { cls: 'token variable definition' }
    if (deepest.startsWith('variable.other.object.property') || deepest.startsWith('variable.other.property')) return { cls: 'token property' }
    if (deepest.startsWith('variable.other.object')) return { cls: 'token variable object' }
    if (deepest.startsWith('variable.parameter')) return { cls: 'token parameter' }
    return { cls: 'token variable' }
  }

  if (deepest.startsWith('meta.import')) return { cls: 'token import' }

  return { cls: '' }
}

function fontStyleToCSS(fontStyle: number | undefined): string {
  if (!fontStyle) return ''
  const parts: string[] = []
  if (fontStyle & 1) parts.push('font-style: italic')
  if (fontStyle & 2) parts.push('font-weight: bold')
  if (fontStyle & 4) parts.push('text-decoration: underline')
  return parts.join('; ')
}

interface StyledToken {
  cls: string
  style: string
  length: number
}

/**
 * Tokenize code with Shiki + Java heuristics.
 * Returns an array of styled tokens per line (flat list, with line breaks implicit).
 */
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
    includeExplanation: true,
  })

  const tokens: StyledToken[] = []

  function pushToken(cls: string, style: string, length: number) {
    if (length > 0) tokens.push({ cls, style, length })
  }

  function classifyBlobPart(part: string, defaultColor: string): { cls: string; style: string } {
    const trimmed = part.trim()
    if (JAVA_KEYWORDS.has(part)) return { cls: 'token keyword', style: `color: ${HEURISTIC_COLORS.keyword}` }
    if (/^[+\-*/%<=>?:!&|^~]+$/.test(part)) return { cls: 'token operator', style: `color: ${HEURISTIC_COLORS.operator}` }
    if (RE_UPPER_SNAKE.test(part)) return { cls: 'token constant', style: `color: ${HEURISTIC_COLORS.constant}; font-weight: bold; font-style: italic` }
    if (RE_PASCAL.test(part)) return { cls: 'token class-name', style: `color: ${HEURISTIC_COLORS.type}` }
    if (part === '@') return { cls: 'token annotation', style: `color: ${HEURISTIC_COLORS.type}` }
    if (/^[{()}\[\];.,]$/.test(part)) return { cls: 'token punctuation', style: `color: ${defaultColor}` }
    if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed)) return { cls: 'token variable', style: `color: #9CDCFE` }
    return { cls: '', style: '' }
  }

  for (let lineIdx = 0; lineIdx < result.tokens.length; lineIdx++) {
    const line = result.tokens[lineIdx]

    // Java import line detection
    let isImportLine = false
    if (lang === 'java' && line.length >= 1 && line[0].content.trim() === 'import') {
      isImportLine = true
    }

    for (let tokIdx = 0; tokIdx < line.length; tokIdx++) {
      const token = line[tokIdx]

      // --- Import path splitting ---
      if (isImportLine && tokIdx > 0 && /[a-zA-Z]/.test(token.content)) {
        const parts = token.content.split(/([.;])/)
        const identParts = parts.filter((p) => p && p !== '.' && p !== ';' && p.trim())
        const lastIdent = identParts.length > 0 ? identParts[identParts.length - 1].trim() : ''

        for (const part of parts) {
          if (!part) continue
          const trimmed = part.trim()
          if (part === '.' || part === ';') {
            pushToken('token punctuation', `color: ${token.color || '#D4D4D4'}`, part.length)
          } else if (trimmed && JAVA_KEYWORDS.has(trimmed)) {
            pushToken('token keyword', `color: ${HEURISTIC_COLORS.keyword}`, part.length)
          } else if (trimmed === lastIdent) {
            if (RE_UPPER_SNAKE.test(trimmed)) {
              pushToken('token constant', `color: ${HEURISTIC_COLORS.constant}; font-weight: bold; font-style: italic`, part.length)
            } else if (RE_PASCAL.test(trimmed)) {
              pushToken('token class-name import', `color: ${HEURISTIC_COLORS.type}`, part.length)
            } else {
              pushToken('token function static-import', `color: ${HEURISTIC_COLORS.invocation}; font-style: italic`, part.length)
            }
          } else if (trimmed) {
            pushToken('token class-name import', `color: ${HEURISTIC_COLORS.type}`, part.length)
          } else {
            pushToken('', '', part.length)
          }
        }
        continue
      }

      // --- Java blob splitter ---
      if (lang === 'java' && token.content.length > 1) {
        const blobParts = token.content.match(/[a-zA-Z_]\w*|[+\-*/%<=>?:!&|^~]+|[{()}\[\];.,@]|\s+|./g)
        const needsSplit = blobParts && blobParts.length > 1 && blobParts.some(
          (w) => JAVA_KEYWORDS.has(w) || JAVA_OPERATORS.has(w) || /^[+\-*/%<=>?:!&|^~]+$/.test(w),
        )
        if (needsSplit) {
          for (const part of blobParts) {
            if (!part) continue
            const { cls, style } = classifyBlobPart(part, token.color || '#D4D4D4')
            pushToken(cls, style, part.length)
          }
          continue
        }
      }

      // --- Normal token classification ---
      let { cls, colorOverride } = scopeToClass(token)

      // @interface: @ is part of keyword
      if (lang === 'java' && cls === 'token annotation' && token.content.includes('@')) {
        let nextIdx = tokIdx + 1
        while (nextIdx < line.length && !line[nextIdx].content.trim()) nextIdx++
        if (nextIdx < line.length && line[nextIdx].content.trim() === 'interface') {
          cls = 'token keyword'
          colorOverride = 'keyword'
        }
      }

      // Java hard keywords always win
      if (lang === 'java' && JAVA_KEYWORDS.has(token.content.trim())) {
        cls = 'token keyword'
        colorOverride = 'keyword'
      }

      // Classify function tokens
      if (cls === 'token function') {
        let prevIdx = tokIdx - 1
        while (prevIdx >= 0 && !line[prevIdx].content.trim()) prevIdx--
        const prevTok = prevIdx >= 0 ? line[prevIdx] : null
        const prevScope = prevTok?.explanation?.[prevTok.explanation.length - 1]?.scopes
        const prevDeepest = prevScope?.[prevScope.length - 1]?.scopeName ?? ''
        const isDot = prevDeepest.startsWith('punctuation.separator.period')
        const isNew = prevTok?.content.trim() === 'new'

        if (isDot) {
          let objIdx = prevIdx - 1
          while (objIdx >= 0 && !line[objIdx].content.trim()) objIdx--
          const objTok = objIdx >= 0 ? line[objIdx] : null
          if (objTok && RE_PASCAL.test(objTok.content.trim())) {
            cls = 'token function invocation static'
          } else {
            cls = 'token function invocation'
          }
          colorOverride = 'invocation'
        } else if (isNew) {
          cls = 'token function invocation constructor'
        } else if (prevDeepest.startsWith('storage.type') || prevDeepest.startsWith('storage.modifier')) {
          cls = 'token function definition'
        } else {
          cls = 'token function invocation'
          colorOverride = 'invocation'
        }
      }

      const color = colorOverride ? HEURISTIC_COLORS[colorOverride] : token.color
      const colorCSS = color ? `color: ${color}` : ''
      let fontCSS = fontStyleToCSS(token.fontStyle)
      if (cls === 'token function invocation static' && !fontCSS.includes('italic')) {
        fontCSS = fontCSS ? fontCSS + '; font-style: italic' : 'font-style: italic'
      }
      if (cls === 'token constant' && colorOverride === 'constant') {
        fontCSS = 'font-weight: bold; font-style: italic'
      }
      const style = [colorCSS, fontCSS].filter(Boolean).join('; ')

      pushToken(cls, style, token.content.length)
    }

    // Newline between lines (except last) — length 1 for the \n character
    if (lineIdx < result.tokens.length - 1) {
      tokens.push({ cls: '', style: '', length: 1 })
    }
  }

  return tokens
}

/**
 * Convert code to highlighted HTML using Shiki + Java heuristics.
 */
export function codeToHighlightedHtml(
  highlighter: HighlighterCore,
  code: string,
  language: string,
): string {
  const langs = highlighter.getLoadedLanguages()
  const lang = language && langs.includes(language) ? language : 'text'

  const result = highlighter.codeToTokens(code, {
    lang,
    theme: SHIKI_THEME,
    includeExplanation: true,
  })

  const htmlParts: string[] = []

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function pushSpan(text: string, cls: string, style: string) {
    const escaped = escapeHtml(text)
    if (cls || style) {
      const attrs = [cls ? `class="${cls}"` : '', style ? `style="${style}"` : ''].filter(Boolean).join(' ')
      htmlParts.push(`<span ${attrs}>${escaped}</span>`)
    } else {
      htmlParts.push(escaped)
    }
  }

  function classifyBlobPart(part: string, defaultColor: string): { cls: string; style: string } {
    if (JAVA_KEYWORDS.has(part)) return { cls: 'token keyword', style: `color: ${HEURISTIC_COLORS.keyword}` }
    if (/^[+\-*/%<=>?:!&|^~]+$/.test(part)) return { cls: 'token operator', style: `color: ${HEURISTIC_COLORS.operator}` }
    if (RE_UPPER_SNAKE.test(part)) return { cls: 'token constant', style: `color: ${HEURISTIC_COLORS.constant}; font-weight: bold; font-style: italic` }
    if (RE_PASCAL.test(part)) return { cls: 'token class-name', style: `color: ${HEURISTIC_COLORS.type}` }
    if (part === '@') return { cls: 'token annotation', style: `color: ${HEURISTIC_COLORS.type}` }
    if (/^[{()}\[\];.,]$/.test(part)) return { cls: 'token punctuation', style: `color: ${defaultColor}` }
    if (/^[a-z][a-zA-Z0-9]*$/.test(part.trim())) return { cls: 'token variable', style: `color: #9CDCFE` }
    return { cls: '', style: '' }
  }

  for (let lineIdx = 0; lineIdx < result.tokens.length; lineIdx++) {
    const line = result.tokens[lineIdx]

    let isImportLine = false
    if (lang === 'java' && line.length >= 1 && line[0].content.trim() === 'import') {
      isImportLine = true
    }

    for (let tokIdx = 0; tokIdx < line.length; tokIdx++) {
      const token = line[tokIdx]

      // --- Import path splitting ---
      if (isImportLine && tokIdx > 0 && /[a-zA-Z]/.test(token.content)) {
        const parts = token.content.split(/([.;])/)
        const identParts = parts.filter((p) => p && p !== '.' && p !== ';' && p.trim())
        const lastIdent = identParts.length > 0 ? identParts[identParts.length - 1].trim() : ''

        for (const part of parts) {
          if (!part) continue
          const trimmed = part.trim()
          if (part === '.' || part === ';') {
            pushSpan(part, 'token punctuation', `color: ${token.color || '#D4D4D4'}`)
          } else if (trimmed && JAVA_KEYWORDS.has(trimmed)) {
            pushSpan(part, 'token keyword', `color: ${HEURISTIC_COLORS.keyword}`)
          } else if (trimmed === lastIdent) {
            if (RE_UPPER_SNAKE.test(trimmed)) {
              pushSpan(part, 'token constant', `color: ${HEURISTIC_COLORS.constant}; font-weight: bold; font-style: italic`)
            } else if (RE_PASCAL.test(trimmed)) {
              pushSpan(part, 'token class-name import', `color: ${HEURISTIC_COLORS.type}`)
            } else {
              pushSpan(part, 'token function static-import', `color: ${HEURISTIC_COLORS.invocation}; font-style: italic`)
            }
          } else if (trimmed) {
            pushSpan(part, 'token class-name import', `color: ${HEURISTIC_COLORS.type}`)
          } else {
            pushSpan(part, '', '')
          }
        }
        continue
      }

      // --- Java blob splitter ---
      if (lang === 'java' && token.content.length > 1) {
        const blobParts = token.content.match(/[a-zA-Z_]\w*|[+\-*/%<=>?:!&|^~]+|[{()}\[\];.,@]|\s+|./g)
        const needsSplit = blobParts && blobParts.length > 1 && blobParts.some(
          (w) => JAVA_KEYWORDS.has(w) || JAVA_OPERATORS.has(w) || /^[+\-*/%<=>?:!&|^~]+$/.test(w),
        )
        if (needsSplit) {
          for (const part of blobParts) {
            if (!part) continue
            const { cls, style } = classifyBlobPart(part, token.color || '#D4D4D4')
            pushSpan(part, cls, style)
          }
          continue
        }
      }

      // --- Normal token classification ---
      let { cls, colorOverride } = scopeToClass(token)

      if (lang === 'java' && cls === 'token annotation' && token.content.includes('@')) {
        let nextIdx = tokIdx + 1
        while (nextIdx < line.length && !line[nextIdx].content.trim()) nextIdx++
        if (nextIdx < line.length && line[nextIdx].content.trim() === 'interface') {
          cls = 'token keyword'
          colorOverride = 'keyword'
        }
      }

      if (lang === 'java' && JAVA_KEYWORDS.has(token.content.trim())) {
        cls = 'token keyword'
        colorOverride = 'keyword'
      }

      if (cls === 'token function') {
        let prevIdx = tokIdx - 1
        while (prevIdx >= 0 && !line[prevIdx].content.trim()) prevIdx--
        const prevTok = prevIdx >= 0 ? line[prevIdx] : null
        const prevScope = prevTok?.explanation?.[prevTok.explanation.length - 1]?.scopes
        const prevDeepest = prevScope?.[prevScope.length - 1]?.scopeName ?? ''
        const isDot = prevDeepest.startsWith('punctuation.separator.period')
        const isNew = prevTok?.content.trim() === 'new'

        if (isDot) {
          let objIdx = prevIdx - 1
          while (objIdx >= 0 && !line[objIdx].content.trim()) objIdx--
          const objTok = objIdx >= 0 ? line[objIdx] : null
          if (objTok && RE_PASCAL.test(objTok.content.trim())) {
            cls = 'token function invocation static'
          } else {
            cls = 'token function invocation'
          }
          colorOverride = 'invocation'
        } else if (isNew) {
          cls = 'token function invocation constructor'
        } else if (prevDeepest.startsWith('storage.type') || prevDeepest.startsWith('storage.modifier')) {
          cls = 'token function definition'
        } else {
          cls = 'token function invocation'
          colorOverride = 'invocation'
        }
      }

      const color = colorOverride ? HEURISTIC_COLORS[colorOverride] : token.color
      const colorCSS = color ? `color: ${color}` : ''
      let fontCSS = fontStyleToCSS(token.fontStyle)
      if (cls === 'token function invocation static' && !fontCSS.includes('italic')) {
        fontCSS = fontCSS ? fontCSS + '; font-style: italic' : 'font-style: italic'
      }
      if (cls === 'token constant' && colorOverride === 'constant') {
        fontCSS = 'font-weight: bold; font-style: italic'
      }
      const style = [colorCSS, fontCSS].filter(Boolean).join('; ')

      pushSpan(token.content, cls, style)
    }

    if (lineIdx < result.tokens.length - 1) {
      htmlParts.push('\n')
    }
  }

  return htmlParts.join('')
}
