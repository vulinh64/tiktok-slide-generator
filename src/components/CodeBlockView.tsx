import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import './CodeBlockView.css'

const LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'python', label: 'Python' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'bash', label: 'Bash' },
  { value: 'markdown', label: 'Markdown' },
]

export function CodeBlockView({ node, updateAttributes, extension }: NodeViewProps) {
  const language = node.attrs.language || ''

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <select
        className="code-block-lang-select"
        contentEditable={false}
        value={language}
        onChange={(e) => updateAttributes({ language: e.target.value })}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <pre data-language={language || extension.options.defaultLanguage || undefined}>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
