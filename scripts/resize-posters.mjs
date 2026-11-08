// Ужимает постеры до 300px по ширине в JPEG q78 и обновляет posters.json.
import sharp from 'sharp'
import { readdir, readFile, writeFile, unlink, rename } from 'node:fs/promises'

const DIR = new URL('../public/posters/', import.meta.url)
const MAP = new URL('../src/data/posters.json', import.meta.url)
const map = JSON.parse(await readFile(MAP, 'utf8'))
let before = 0, after = 0
for (const [id, file] of Object.entries(map)) {
  const src = new URL(file, DIR)
  const buf = await readFile(src)
  before += buf.length
  const out = await sharp(buf).flatten({ background: '#2a1e16' }).resize({ width: 300, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()
  after += out.length
  const name = `${id}.jpg`
  if (file !== name) await unlink(src)
  await writeFile(new URL(name, DIR), out)
  map[id] = name
}
await writeFile(MAP, JSON.stringify(map))
console.log(`${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB`)
