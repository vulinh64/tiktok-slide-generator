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

function padPage(n: number): string {
  return String(n).padStart(4, '0')
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

interface DeckInfo {
  name: string
  pageCount: number
  imgs: ImageEntry[]
  createdAt: string
  updatedAt: string
}

interface RootIndexEntry {
  id: string
  name: string
  pageCount: number
  createdAt: string
  updatedAt: string
}

interface RootIndex {
  decks: RootIndexEntry[]
}

const DEFAULT_INFO: DeckInfo = {
  name: 'Untitled',
  pageCount: 0,
  imgs: [],
  createdAt: '',
  updatedAt: '',
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

function writeRootIndex(index: RootIndex) {
  fs.writeFileSync(ROOT_INDEX, JSON.stringify(index, null, 2), 'utf-8')
}

// Full rebuild — only used when root info.json is missing or corrupt
function rebuildRootIndex(): RootIndex {
  ensureDir(NOTES_DIR)
  const entries = fs.readdirSync(NOTES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isValidDirName(d.name))
    .sort((a, b) => b.name.localeCompare(a.name))

  const decks: RootIndexEntry[] = entries.map((entry) => {
    const deckDir = path.join(NOTES_DIR, entry.name)
    const info = readDeckInfo(deckDir)
    const pageCount = fs.readdirSync(deckDir).filter((f) => f.endsWith('.md')).length
    return {
      id: entry.name,
      name: info.name,
      pageCount,
      createdAt: info.createdAt || parseTimestamp(entry.name),
      updatedAt: info.updatedAt,
    }
  })

  const index: RootIndex = { decks }
  writeRootIndex(index)
  return index
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
  const index = readRootIndex()
  // Remove existing entry with same id
  index.decks = index.decks.filter((d) => d.id !== entry.id)
  // Insert and sort descending by id
  index.decks.push(entry)
  index.decks.sort((a, b) => b.id.localeCompare(a.id))
  writeRootIndex(index)
}

// Remove a single entry from the root index
function removeFromRootIndex(id: string) {
  const index = readRootIndex()
  index.decks = index.decks.filter((d) => d.id !== id)
  writeRootIndex(index)
}

export function slidesPlugin(): Plugin {
  return {
    name: 'slides-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/slides')) return next()

        res.setHeader('Content-Type', 'application/json')
        ensureDir(NOTES_DIR)

        try {
          // LIST all slide decks: GET /api/slides
          if (req.url === '/api/slides' && req.method === 'GET') {
            const index = readRootIndex()

            // Enrich with full settings from each deck's info.json
            const decks = index.decks.map((entry) => ({
              id: entry.id,
              title: entry.name,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
              pageCount: entry.pageCount,
            }))

            res.end(JSON.stringify(decks))
            return
          }

          // SAVE a slide deck: POST /api/slides
          if (req.url === '/api/slides' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req))
            const id = body.id || formatTimestamp()
            const deckDir = path.join(NOTES_DIR, id)
            ensureDir(deckDir)

            // Remove old .md files
            if (fs.existsSync(deckDir)) {
              fs.readdirSync(deckDir)
                .filter((f) => f.endsWith('.md'))
                .forEach((f) => fs.unlinkSync(path.join(deckDir, f)))
            }

            // Write pages
            const pages: string[] = body.pages || []
            pages.forEach((content: string, i: number) => {
              fs.writeFileSync(path.join(deckDir, `${padPage(i)}.md`), content, 'utf-8')
            })

            // Read existing info to preserve createdAt on updates
            const existingInfo = fs.existsSync(path.join(deckDir, INFO_FILE))
              ? readDeckInfo(deckDir)
              : null
            const now = parseTimestamp(formatTimestamp())

            // Scan pages for image widths (from data-width attributes in HTML img tags)
            const widthMap = new Map<string, number>()
            const allContent = pages.join('\n')
            const imgWidthRe = /data-width="(\d+)"[^>]*(?:src|style)[^>]*\/api\/slides\/[\w-]+\/images\/(img-\d{4})/g
            const imgWidthRe2 = /\/api\/slides\/[\w-]+\/images\/(img-\d{4})[^>]*data-width="(\d+)"/g
            let wm
            while ((wm = imgWidthRe.exec(allContent)) !== null) {
              widthMap.set(wm[2], Number(wm[1]))
            }
            while ((wm = imgWidthRe2.exec(allContent)) !== null) {
              widthMap.set(wm[1], Number(wm[2]))
            }

            // Preserve existing imgs and update widths
            const existingImgs: ImageEntry[] = existingInfo?.imgs || []
            for (const img of existingImgs) {
              if (widthMap.has(img.name)) {
                img.width = widthMap.get(img.name)!
              }
            }

            const info: DeckInfo = {
              name: body.title || 'Untitled',
              pageCount: pages.length,
              imgs: existingImgs,
              createdAt: existingInfo?.createdAt || parseTimestamp(id),
              updatedAt: now,
            }
            writeDeckInfo(deckDir, info)

            // Upsert into root index
            upsertRootIndex({
              id,
              name: info.name,
              pageCount: info.pageCount,
              createdAt: info.createdAt,
              updatedAt: info.updatedAt,
            })

            res.end(JSON.stringify({ id, ...info, title: info.name }))
            return
          }

          // GET a single deck: GET /api/slides/:id
          const getMatch = req.url.match(/^\/api\/slides\/([\w-]+)$/)
          if (getMatch && req.method === 'GET') {
            const id = getMatch[1]
            const deckDir = path.join(NOTES_DIR, id)
            if (!fs.existsSync(deckDir)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Not found' }))
              return
            }

            const info = readDeckInfo(deckDir)
            const mdFiles = fs.readdirSync(deckDir)
              .filter((f) => f.endsWith('.md'))
              .sort()
            const pages = mdFiles.map((f) => fs.readFileSync(path.join(deckDir, f), 'utf-8'))

            res.end(JSON.stringify({
              id,
              title: info.name,
              imgs: info.imgs || [],
              createdAt: info.createdAt || parseTimestamp(id),
              updatedAt: info.updatedAt,
              pageCount: pages.length,
              pages,
            }))
            return
          }

          // DELETE a deck: DELETE /api/slides/:id
          const delMatch = req.url.match(/^\/api\/slides\/([\w-]+)$/)
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
          const imgUpMatch = req.url.match(/^\/api\/slides\/([\w-]+)\/images$/)
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

          // SERVE image: GET /api/slides/:id/images/:name
          const imgGetMatch = req.url.match(/^\/api\/slides\/([\w-]+)\/images\/(img-\d{4})$/)
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
