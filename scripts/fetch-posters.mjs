// Скачивает постеры с Википедии в public/posters и пишет src/data/posters.json (id -> файл).
// Запуск: node scripts/fetch-posters.mjs [--force]
// Порядок: en.wikipedia (точный заголовок) → ru.wikipedia, если в en логотип/нет картинки → поиск en.
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { MOVIES } from '../src/data/movies.ts'

const UA = 'LampTierlist/1.0 (https://github.com/x1as/movie-tierlist)'
const OUT = new URL('../public/posters/', import.meta.url)
const MAP = new URL('../src/data/posters.json', import.meta.url)
const force = process.argv.includes('--force')
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',')
const SIZE = 330

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function getJSON(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.ok) return r.json()
    await sleep(1500 * (i + 1))
  }
  throw new Error('fail ' + url)
}

// pilicense=any — иначе API отдаёт только свободные картинки, а постеры несвободные
const api = (params, lang = 'en') =>
  `https://${lang}.wikipedia.org/w/api.php?` +
  new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: String(SIZE), pilicense: 'any', redirects: '1', ...params })
const portrait = (t) => !!t && t.height / t.width > 1.15

function resolver(q) {
  const alias = {}
  for (const n of q.normalized || []) alias[n.from] = n.to
  for (const r of q.redirects || []) alias[r.from] = r.to
  const pages = Object.fromEntries((q.pages || []).map((p) => [p.title, p]))
  return (t) => { let x = t; for (let k = 0; k < 3 && alias[x]; k++) x = alias[x]; return pages[x] }
}

await mkdir(OUT, { recursive: true })
const map = existsSync(MAP) && !force ? JSON.parse(await readFile(MAP, 'utf8')) : {}
if (only) for (const id of only) delete map[id]
const todo = MOVIES.filter((m) => !map[m.id])
const thumb = {} // id -> {source,width,height}
const ruTitle = {}

// 1) en, пачками по 50
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50)
  const data = await getJSON(api({ titles: chunk.map((m) => m.wiki).join('|'), prop: 'pageimages|langlinks', lllang: 'ru', lllimit: 'max' }))
  const get = resolver(data.query || {})
  for (const m of chunk) {
    const p = get(m.wiki)
    if (p?.thumbnail?.source) thumb[m.id] = p.thumbnail
    const ll = p?.langlinks?.find((l) => l.lang === 'ru')
    if (ll) ruTitle[m.id] = ll.title
  }
}

// 2) ru, если в en не вертикальный постер
const needRu = todo.filter((m) => ruTitle[m.id] && !portrait(thumb[m.id]))
for (let i = 0; i < needRu.length; i += 50) {
  const chunk = needRu.slice(i, i + 50)
  const data = await getJSON(api({ titles: chunk.map((m) => ruTitle[m.id]).join('|') }, 'ru'))
  const get = resolver(data.query || {})
  for (const m of chunk) {
    const th = get(ruTitle[m.id])?.thumbnail
    if (th?.source && (portrait(th) || !thumb[m.id])) { thumb[m.id] = th; console.log('ru', m.id) }
  }
}

// 3) поиск для оставшихся
for (const m of todo.filter((m) => !thumb[m.id])) {
  const kindWord = { f: 'film', t: 'animated film', s: 'TV series', ts: 'animated series', a: 'anime', d: 'TV series' }[m.kind]
  const data = await getJSON(api({ generator: 'search', gsrsearch: `${m.wiki.replace(/\(.*\)/, '')} ${m.year} ${kindWord}`, gsrlimit: '3' }))
  const pages = (data.query?.pages || []).sort((a, b) => a.index - b.index)
  const p = pages.find((x) => x.thumbnail?.source)
  if (p) { thumb[m.id] = p.thumbnail; console.log('search', m.id, '->', p.title) }
  await sleep(150)
}

// 4) загрузка
let ok = 0
const missing = []
const landscape = []
for (const m of todo) {
  const t = thumb[m.id]
  if (!t) { missing.push(m.id); continue }
  if (!portrait(t)) landscape.push(m.id)
  const url = t.source
  const ext = (decodeURIComponent(url.split('?')[0]).match(/\.(jpe?g|png|webp|gif)$/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg')
  const file = `${m.id}.${ext}`
  try {
    let r
    for (let i = 0; i < 4; i++) {
      r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (r.ok) break
      await sleep(2000 * (i + 1))
    }
    if (!r.ok) throw new Error(String(r.status))
    await writeFile(new URL(file, OUT), Buffer.from(await r.arrayBuffer()))
    map[m.id] = file
    ok++
  } catch (e) {
    missing.push(m.id + ':' + e.message)
  }
  await sleep(60)
}

await writeFile(MAP, JSON.stringify(map))
console.log(`downloaded ${ok}, total ${Object.keys(map).length}/${MOVIES.length}`)
if (landscape.length) console.log('landscape:', landscape.join(', '))
if (missing.length) console.log('missing:', missing.join(', '))
