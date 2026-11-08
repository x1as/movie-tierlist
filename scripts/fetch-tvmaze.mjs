// Вертикальные постеры сериалов с TVmaze (без ключа). Википедия для сериалов часто отдаёт логотип.
// Запуск: node scripts/fetch-tvmaze.mjs id1,id2,...   (без аргументов — все сериалы с не вертикальной картинкой)
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { MOVIES, BY_ID } from '../src/data/movies.ts'

const UA = 'LampTierlist/1.0 (https://github.com/x1as/movie-tierlist)'
const OUT = new URL('../public/posters/', import.meta.url)
const MAP = new URL('../src/data/posters.json', import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const map = JSON.parse(await readFile(MAP, 'utf8'))

// Подсказки для поиска, где заголовок статьи не совпадает с названием шоу
const QUERY = {
  manvswild: 'Man vs. Wild', edstafford: 'Naked and Marooned with Ed Stafford', mythbusters: 'MythBusters',
  ben10: 'Ben 10', tmnt03: 'Teenage Mutant Ninja Turtles', tmnt12: 'Teenage Mutant Ninja Turtles',
  spidertas: 'Spider-Man', xmentas: 'X-Men', ducktales17: 'DuckTales', ducktales87: 'DuckTales',
  kick: 'Kick Buttowski', moneyheist: 'Money Heist', dbz: 'Dragon Ball Z', onepiece: 'One Piece',
  hxh: 'Hunter x Hunter', mha: 'My Hero Academia', demonslayer: 'Demon Slayer',
  aot: 'Attack on Titan', deathnote: 'Death Note', bleach: 'Bleach', opm: 'One Punch Man',
  chainsaw: 'Chainsaw Man', kuroko: "Kuroko's Basketball", digimon: 'Digimon Adventure', alone: 'Alone',
  grandtour: 'The Grand Tour', topgear: 'Top Gear', planetearth: 'Planet Earth', blueplanet2: 'Blue Planet II',
  goosebumps: 'Goosebumps', legends: "DC's Legends of Tomorrow", teenwolf: 'Teen Wolf', flash: 'The Flash',
  sherlockbbc: 'Sherlock', doctorwho: 'Doctor Who', witcher: 'The Witcher', vikings: 'Vikings',
  euphoria: 'Euphoria', suits: 'Suits', berlin: 'Berlin', elite: 'Elite', friends: 'Friends', scrubs: 'Scrubs',
  himym: 'How I Met Your Mother', b99: 'Brooklyn Nine-Nine', prspd: 'Power Rangers S.P.D.',
  prjf: 'Power Rangers Jungle Fury', mmpr: 'Mighty Morphin Power Rangers', prmf: 'Power Rangers Mystic Force',
  ldr: 'Love, Death & Robots', woq: 'World of Quest', geted: 'Get Ed', tinyworld: 'Tiny World',
  runningwild: 'Running Wild with Bear Grylls', whatif: 'What If...?', xmen97: "X-Men '97",
  adventuretime: 'Adventure Time', ttitans: 'Teen Titans', ironmanaa: 'Iron Man: Armored Adventures', chipdale: "Chip 'n Dale Rescue Rangers",
}

let ids = process.argv[2]?.split(',')
if (!ids) {
  ids = MOVIES.filter((m) => ['s', 'ts', 'd', 'a'].includes(m.kind)).map((m) => m.id)
}

const year = (s) => (s ? +s.slice(0, 4) : 0)
const fails = []
for (const id of ids) {
  const m = BY_ID[id]
  if (!m) continue
  const q = QUERY[id] || m.wiki.replace(/\s*\(.*\)\s*/, '')
  let res
  try {
    const r = await fetch('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(q), { headers: { 'User-Agent': UA } })
    if (r.status === 429) { await sleep(5000); ids.push(id); continue }
    res = await r.json()
  } catch { fails.push(id); continue }
  await sleep(600)
  const withImg = res.filter((x) => x.show?.image?.medium)
  const best = withImg.find((x) => Math.abs(year(x.show.premiered) - m.year) <= 1) || (QUERY[id] ? withImg[0] : null)
  if (!best) { fails.push(id); continue }
  const url = best.show.image.original || best.show.image.medium
  const medium = best.show.image.medium
  const img = await fetch(medium || url, { headers: { 'User-Agent': UA } })
  if (!img.ok) { fails.push(id); continue }
  const file = `${id}.jpg`
  if (map[id] && map[id] !== file) await unlink(new URL(map[id], OUT)).catch(() => {})
  await writeFile(new URL(file, OUT), Buffer.from(await img.arrayBuffer()))
  map[id] = file
  console.log('ok', id, '->', best.show.name, best.show.premiered)
}
await writeFile(MAP, JSON.stringify(map))
console.log('fails:', fails.join(', '))
