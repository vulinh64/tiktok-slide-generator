import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const NOTES_DIR = path.join(os.homedir(), '.notes')
const INFO_FILE = 'info.json'
const ROOT_INDEX = path.join(NOTES_DIR, INFO_FILE)

// yyyyMMdd-HHmmss
function formatTimestamp(date: Date = new Date()): string {
  const y = date.getFullYear()
  const M = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const H = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}${M}${d}-${H}${m}${s}`
}

function parseTimestamp(ts: string): string {
  const match = ts.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/)
  if (!match) return ts
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`
}

function isValidDirName(name: string): boolean {
  return /^\d{8}-\d{6}$/.test(name)
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function readBodyRaw(req: import('http').IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Detect MIME type from magic bytes
function detectMime(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
  if (buf[0] === 0x3c && buf.subarray(0, 256).toString('utf-8').includes('<svg')) return 'image/svg+xml'
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x00 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return 'image/avif'
  return 'application/octet-stream'
}

// Check if a bg file exists in a deck directory
function hasBgFile(deckDir: string): boolean {
  return fs.existsSync(path.join(deckDir, 'bg'))
}

// Find next available img-XXXX name in a deck directory
function nextImageName(deckDir: string): string {
  const existing = fs.readdirSync(deckDir)
    .filter((f) => /^img-\d{4}$/.test(f))
    .map((f) => parseInt(f.slice(4), 10))
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
  return `img-${String(next).padStart(4, '0')}`
}

interface ImageEntry {
  name: string
  mime: string
  size: number
  width: number
  addedAt: string
}

// URL-safe image name: letters, digits, dot, underscore, hyphen
const IMG_NAME_RE = /^[a-zA-Z0-9._-]+$/
function isValidImageName(name: string): boolean {
  return IMG_NAME_RE.test(name) && name.length > 0 && name.length <= 100 && !name.includes('..')
}

interface DeckInfo {
  name: string
  customCss?: string
  imgs: ImageEntry[]
  createdAt: string
  updatedAt: string
}

interface RootIndexEntry {
  id: string
  name: string
}

type RootIndex = RootIndexEntry[]

const DEFAULT_INFO: DeckInfo = {
  name: 'Untitled',
  imgs: [],
  createdAt: '',
  updatedAt: '',
}

// post.json schema
const POST_FILE = 'post.json'
const POST_VERSION = 1

interface SerializedPage {
  meta: Record<string, unknown>
  html: string
}

interface PostFile {
  version: number
  pages: SerializedPage[]
}

function postPath(deckDir: string): string {
  return path.join(deckDir, POST_FILE)
}

function readPost(deckDir: string): PostFile {
  const p = postPath(deckDir)
  if (fs.existsSync(p)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as PostFile
      if (Array.isArray(parsed.pages)) return parsed
    } catch { /* fall through to migration */ }
  }
  return migrateLoosePages(deckDir)
}

function writePost(deckDir: string, pages: SerializedPage[]) {
  const p = postPath(deckDir)
  const tmp = `${p}.tmp`
  const payload: PostFile = { version: POST_VERSION, pages }
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

// One-shot migration from NNNN.data + YAML-ish front matter → post.json,
// then deletes the loose files. If no .data files are found, returns empty.
function migrateLoosePages(deckDir: string): PostFile {
  if (!fs.existsSync(deckDir)) return { version: POST_VERSION, pages: [] }
  const dataFiles = fs.readdirSync(deckDir)
    .filter((f) => /^\d{4}\.data$/.test(f))
    .sort()
  const pages: SerializedPage[] = dataFiles.map((f) => {
    const raw = fs.readFileSync(path.join(deckDir, f), 'utf-8')
    return parseLegacyPage(raw)
  })
  if (pages.length > 0) {
    writePost(deckDir, pages)
    for (const f of dataFiles) fs.unlinkSync(path.join(deckDir, f))
  }
  return { version: POST_VERSION, pages }
}

// Legacy format: optional YAML-ish front matter (--- ... ---) then HTML body.
// Mirrors the client's old parseFrontMatter so migration preserves meta.
function parseLegacyPage(md: string): SerializedPage {
  const meta: Record<string, unknown> = {}
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!fm) return { meta, html: md }
  const lines = fm[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const block = line.match(/^(\w+):\s*\|\s*$/)
    if (block) {
      const key = block[1]
      const collected: string[] = []
      let indent = ''
      let j = i + 1
      for (; j < lines.length; j++) {
        const l = lines[j]
        if (/^\w+:/.test(l)) break
        if (!indent && l.trim()) {
          const m = l.match(/^(\s+)/)
          indent = m ? m[1] : ''
        }
        collected.push(l.startsWith(indent) ? l.slice(indent.length) : l)
      }
      meta[key] = collected.join('\n').replace(/\n+$/, '')
      i = j - 1
      continue
    }
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (!kv) continue
    const [, k, v] = kv
    if (k === 'fontScale' || k === 'marginScale') meta[k] = Number(v) || undefined
    else if (k === 'dark') meta[k] = v.trim() === 'true'
    else meta[k] = v.trim()
  }
  return { meta, html: md.slice(fm[0].length) }
}

function readDeckInfo(deckDir: string): DeckInfo {
  const infoPath = path.join(deckDir, INFO_FILE)
  if (fs.existsSync(infoPath)) {
    try {
      return { ...DEFAULT_INFO, ...JSON.parse(fs.readFileSync(infoPath, 'utf-8')) }
    } catch { /* ignore */ }
  }
  return { ...DEFAULT_INFO }
}

function writeDeckInfo(deckDir: string, info: DeckInfo) {
  fs.writeFileSync(path.join(deckDir, INFO_FILE), JSON.stringify(info, null, 2), 'utf-8')
}

function writeRootIndex(entries: RootIndex) {
  fs.writeFileSync(ROOT_INDEX, JSON.stringify(entries, null, 2), 'utf-8')
}

// Full rebuild — only used when root info.json is missing or corrupt
function rebuildRootIndex(): RootIndex {
  ensureDir(NOTES_DIR)
  const dirs = fs.readdirSync(NOTES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isValidDirName(d.name))
    .sort((a, b) => b.name.localeCompare(a.name))

  const entries: RootIndex = dirs.map((entry) => {
    const deckDir = path.join(NOTES_DIR, entry.name)
    const info = readDeckInfo(deckDir)
    return {
      id: entry.name,
      name: info.name,
    }
  })

  writeRootIndex(entries)
  return entries
}

// Read root index (rebuild if missing or corrupt)
function readRootIndex(): RootIndex {
  if (fs.existsSync(ROOT_INDEX)) {
    try {
      return JSON.parse(fs.readFileSync(ROOT_INDEX, 'utf-8'))
    } catch { /* ignore */ }
  }
  return rebuildRootIndex()
}

// Upsert a single entry into the root index, keep sorted by id descending
function upsertRootIndex(entry: RootIndexEntry) {
  let entries = readRootIndex()
  entries = entries.filter((d) => d.id !== entry.id)
  entries.push(entry)
  entries.sort((a, b) => b.id.localeCompare(a.id))
  writeRootIndex(entries)
}

// Remove a single entry from the root index
function removeFromRootIndex(id: string) {
  let entries = readRootIndex()
  entries = entries.filter((d) => d.id !== id)
  writeRootIndex(entries)
}

export function slidesPlugin(): Plugin {
  return {
    name: 'slides-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlPath = req.url?.split('?')[0]
        if (!urlPath?.startsWith('/api/slides')) return next()

        res.setHeader('Content-Type', 'application/json')
        ensureDir(NOTES_DIR)

        try {
          // LIST all slide decks: GET /api/slides
          if (urlPath === '/api/slides' && req.method === 'GET') {
            const entries = readRootIndex()

            const decks = entries.map((entry) => {
              const deckDir = path.join(NOTES_DIR, entry.id)
              const info = readDeckInfo(deckDir)
              return {
                id: entry.id,
                title: entry.name,
                createdAt: info.createdAt || parseTimestamp(entry.id),
                updatedAt: info.updatedAt,
              }
            })

            res.end(JSON.stringify(decks))
            return
          }

          // SAVE a slide deck: POST /api/slides
          if (urlPath === '/api/slides' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req))
            const id = body.id || formatTimestamp()
            const deckDir = path.join(NOTES_DIR, id)
            ensureDir(deckDir)

            const pages: SerializedPage[] = Array.isArray(body.pages) ? body.pages : []
            writePost(deckDir, pages)

            // Read existing info to preserve createdAt on updates
            const existingInfo = fs.existsSync(path.join(deckDir, INFO_FILE))
              ? readDeckInfo(deckDir)
              : null
            const now = parseTimestamp(formatTimestamp())

            // Scan pages for image widths (from data-width attributes in HTML img tags)
            const widthMap = new Map<string, number>()
            const allContent = pages.map((p) => p.html || '').join('\n')
            const imgWidthRe = /data-width="(\d+)"[^>]*(?:src|style)[^>]*\/api\/slides\/[\w-]+\/images\/([a-zA-Z0-9._-]+)/g
            const imgWidthRe2 = /\/api\/slides\/[\w-]+\/images\/([a-zA-Z0-9._-]+)[^>]*data-width="(\d+)"/g
            let wm
            while ((wm = imgWidthRe.exec(allContent)) !== null) {
              widthMap.set(wm[2], Number(wm[1]))
            }
            while ((wm = imgWidthRe2.exec(allContent)) !== null) {
              widthMap.set(wm[1], Number(wm[2]))
            }

            const existingImgs: ImageEntry[] = existingInfo?.imgs || []
            for (const img of existingImgs) {
              if (widthMap.has(img.name)) {
                img.width = widthMap.get(img.name)!
              }
            }

            const info: DeckInfo = {
              name: body.title || 'Untitled',
              imgs: existingImgs,
              createdAt: existingInfo?.createdAt || parseTimestamp(id),
              updatedAt: now,
            }
            const incomingCss = typeof body.customCss === 'string' ? body.customCss : undefined
            if (incomingCss !== undefined) {
              if (incomingCss.trim()) info.customCss = incomingCss
              // empty/whitespace drops the field entirely
            } else if (existingInfo?.customCss) {
              info.customCss = existingInfo.customCss
            }
            writeDeckInfo(deckDir, info)

            upsertRootIndex({
              id,
              name: info.name,
            })

            res.end(JSON.stringify({ id, ...info, title: info.name }))
            return
          }

          // GET a single deck: GET /api/slides/:id
          const getMatch = urlPath.match(/^\/api\/slides\/([\w-]+)$/)
          if (getMatch && req.method === 'GET') {
            const id = getMatch[1]
            const deckDir = path.join(NOTES_DIR, id)
            if (!fs.existsSync(deckDir)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Not found' }))
              return
            }

            const info = readDeckInfo(deckDir)
            const post = readPost(deckDir)

            res.end(JSON.stringify({
              id,
              title: info.name,
              customCss: info.customCss ?? '',
              imgs: info.imgs || [],
              hasBg: hasBgFile(deckDir),
              createdAt: info.createdAt || parseTimestamp(id),
              updatedAt: info.updatedAt,
              pages: post.pages,
            }))
            return
          }

          // DELETE a deck: DELETE /api/slides/:id
          const delMatch = urlPath.match(/^\/api\/slides\/([\w-]+)$/)
          if (delMatch && req.method === 'DELETE') {
            const id = delMatch[1]
            const deckDir = path.join(NOTES_DIR, id)
            if (fs.existsSync(deckDir)) {
              fs.rmSync(deckDir, { recursive: true, force: true })
            }
            removeFromRootIndex(id)
            res.end(JSON.stringify({ ok: true }))
            return
          }

          // UPLOAD image: POST /api/slides/:id/images
          const imgUpMatch = urlPath.match(/^\/api\/slides\/([\w-]+)\/images$/)
          if (imgUpMatch && req.method === 'POST') {
            const id = imgUpMatch[1]
            const deckDir = path.join(NOTES_DIR, id)
            if (!fs.existsSync(deckDir)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Deck not found' }))
              return
            }
            const buf = await readBodyRaw(req)
            const name = nextImageName(deckDir)
            const mime = detectMime(buf)
            fs.writeFileSync(path.join(deckDir, name), buf)

            // Record in info.json
            const info = readDeckInfo(deckDir)
            info.imgs = info.imgs || []
            info.imgs.push({
              name,
              mime,
              size: buf.length,
              width: 100,
              addedAt: parseTimestamp(formatTimestamp()),
            })
            writeDeckInfo(deckDir, info)

            const url = `/api/slides/${id}/images/${name}`
            res.end(JSON.stringify({ name, url, mime, size: buf.length }))
            return
          }

          // LIST images: GET /api/slides/:id/images
          const imgListMatch = urlPath.match(/^\/api\/slides\/([\w-]+)\/images$/)
          if (imgListMatch && req.method === 'GET') {
            const id = imgListMatch[1]
            const deckDir = path.join(NOTES_DIR, id)
            if (!fs.existsSync(deckDir)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Deck not found' }))
              return
            }
            const info = readDeckInfo(deckDir)
            res.end(JSON.stringify(info.imgs || []))
            return
          }

          // RENAME image (renames file on disk + updates info.json;
          // caller is responsible for updating URL refs in their pages):
          // PATCH /api/slides/:id/images/:name  body: { name: newName }
          const imgPatchMatch = urlPath.match(/^\/api\/slides\/([\w-]+)\/images\/([a-zA-Z0-9._-]+)$/)
          if (imgPatchMatch && req.method === 'PATCH') {
            const id = imgPatchMatch[1]
            const imgName = imgPatchMatch[2]
            const deckDir = path.join(NOTES_DIR, id)
            if (!fs.existsSync(deckDir)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Deck not found' }))
              return
            }
            const body = JSON.parse(await readBody(req)) as { name?: string }
            const newName = (body.name || '').trim()
            if (!isValidImageName(newName)) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid name. Use letters, digits, dot, underscore, hyphen.' }))
              return
            }
            const info = readDeckInfo(deckDir)
            info.imgs = info.imgs || []
            const entry = info.imgs.find((e) => e.name === imgName)
            if (!entry) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Image not found' }))
              return
            }
            if (newName === imgName) {
              res.end(JSON.stringify(entry))
              return
            }
            const oldPath = path.join(deckDir, imgName)
            const newPath = path.join(deckDir, newName)
            if (fs.existsSync(newPath)) {
              res.statusCode = 409
              res.end(JSON.stringify({ error: 'Name already in use' }))
              return
            }
            fs.renameSync(oldPath, newPath)
            entry.name = newName
            writeDeckInfo(deckDir, info)
            res.end(JSON.stringify(entry))
            return
          }

          // DELETE image: DELETE /api/slides/:id/images/:name
          const imgDelMatch = urlPath.match(/^\/api\/slides\/([\w-]+)\/images\/([a-zA-Z0-9._-]+)$/)
          if (imgDelMatch && req.method === 'DELETE') {
            const id = imgDelMatch[1]
            const imgName = imgDelMatch[2]
            const deckDir = path.join(NOTES_DIR, id)
            if (!fs.existsSync(deckDir)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Deck not found' }))
              return
            }
            const imgPath = path.join(deckDir, imgName)
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath)
            const info = readDeckInfo(deckDir)
            info.imgs = (info.imgs || []).filter((e) => e.name !== imgName)
            writeDeckInfo(deckDir, info)
            res.end(JSON.stringify({ ok: true }))
            return
          }

          // SERVE image: GET /api/slides/:id/images/:name
          const imgGetMatch = urlPath.match(/^\/api\/slides\/([\w-]+)\/images\/([a-zA-Z0-9._-]+)$/)
          if (imgGetMatch && req.method === 'GET') {
            const id = imgGetMatch[1]
            const imgName = imgGetMatch[2]
            const imgPath = path.join(NOTES_DIR, id, imgName)
            if (!fs.existsSync(imgPath)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Image not found' }))
              return
            }
            const buf = fs.readFileSync(imgPath)
            const mime = detectMime(buf)
            res.setHeader('Content-Type', mime)
            res.setHeader('Content-Length', buf.length)
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
            res.end(buf)
            return
          }

          // UPLOAD background: POST /api/slides/:id/bg
          const bgUpMatch = urlPath.match(/^\/api\/slides\/([\w-]+)\/bg$/)
          if (bgUpMatch && req.method === 'POST') {
            const id = bgUpMatch[1]
            const deckDir = path.join(NOTES_DIR, id)
            if (!fs.existsSync(deckDir)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Deck not found' }))
              return
            }
            const buf = await readBodyRaw(req)
            const mime = detectMime(buf)
            if (!['image/png', 'image/jpeg'].includes(mime)) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Only PNG and JPEG are supported' }))
              return
            }
            fs.writeFileSync(path.join(deckDir, 'bg'), buf)
            res.end(JSON.stringify({ ok: true }))
            return
          }

          // SERVE background: GET /api/slides/:id/bg
          const bgGetMatch = urlPath.match(/^\/api\/slides\/([\w-]+)\/bg$/)
          if (bgGetMatch && req.method === 'GET') {
            const id = bgGetMatch[1]
            const bgPath = path.join(NOTES_DIR, id, 'bg')
            if (!fs.existsSync(bgPath)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'No background' }))
              return
            }
            const buf = fs.readFileSync(bgPath)
            const mime = detectMime(buf)
            res.setHeader('Content-Type', mime)
            res.setHeader('Content-Length', buf.length)
            res.setHeader('Cache-Control', 'no-cache')
            res.end(buf)
            return
          }

          // DELETE background: DELETE /api/slides/:id/bg
          const bgDelMatch = urlPath.match(/^\/api\/slides\/([\w-]+)\/bg$/)
          if (bgDelMatch && req.method === 'DELETE') {
            const id = bgDelMatch[1]
            const bgPath = path.join(NOTES_DIR, id, 'bg')
            if (fs.existsSync(bgPath)) {
              fs.unlinkSync(bgPath)
            }
            res.end(JSON.stringify({ ok: true }))
            return
          }

          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Not found' }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}
