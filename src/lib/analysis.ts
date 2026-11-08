import { GENRES, KINDS, RANKED, TIERS, type TierKey } from '../data/meta'
import { BY_ID, type Movie, type Kind } from '../data/movies'
import type { Tiers } from './codec'

export interface Pole { l: string; name: string; test: (m: Movie) => boolean }
export interface Axis { key: string; title: string; left: Pole; right: Pole }

const has = (...g: string[]) => (m: Movie) => m.genres.some((x) => g.includes(x))
const ANIM: Kind[] = ['t', 'ts', 'a']

export const AXES: Axis[] = [
  {
    key: 'era', title: 'Эпоха',
    left: { l: 'N', name: 'Ностальгия', test: (m) => m.year < 2010 },
    right: { l: 'F', name: 'Свежесть', test: (m) => m.year >= 2010 },
  },
  {
    key: 'format', title: 'Формат',
    left: { l: 'A', name: 'Анимация', test: (m) => ANIM.includes(m.kind) },
    right: { l: 'L', name: 'Живое кино', test: (m) => !ANIM.includes(m.kind) },
  },
  {
    key: 'drive', title: 'Двигатель',
    left: { l: 'X', name: 'Адреналин', test: has('act', 'hero', 'mar', 'spo', 'adv') },
    right: { l: 'D', name: 'Глубина', test: has('dra', 'rom', 'doc') },
  },
  {
    key: 'tone', title: 'Тон',
    left: { l: 'J', name: 'Свет', test: has('com', 'fam') },
    right: { l: 'S', name: 'Тень', test: has('hor', 'thr', 'cri', 'mys') },
  },
]

export const TYPES: Record<string, { name: string; text: string }> = {
  NAXJ: { name: 'Ребёнок Jetix', text: 'Утро субботы, хлопья и мультсериалы про героев. Детство для тебя не прошло, оно просто стало коллекцией.' },
  NAXS: { name: 'Страж субботнего утра', text: 'Любишь старую анимацию, но с зубами: злодеи должны быть страшными, а ставки настоящими.' },
  NADJ: { name: 'Хранитель кассет Disney', text: 'Классика ренессанса Disney и тёплые мультфильмы, на которых можно плакать без стыда.' },
  NADS: { name: 'Сказочник с тенью', text: 'Старые мультфильмы, в которых есть смерть, тоска и мрачная красота. Тим Бёртон бы понял.' },
  NLXJ: { name: 'Герой видеопроката', text: 'Нулевые, Джеки Чан, Уилл Смит и попкорн. Кино должно быть громким, смешным и пересматриваемым.' },
  NLXS: { name: 'Ночной сеанс на VHS', text: 'Старые боевики и хорроры, после которых страшно выключать свет. Чем жёстче, тем лучше.' },
  NLDJ: { name: 'Тёплый романтик', text: 'Форрест Гамп, День сурка, Титаник. Ценишь кино, которое греет и остаётся с тобой.' },
  NLDS: { name: 'Детектив старой школы', text: 'Нуар, загадки, психологизм нулевых. Хочешь, чтобы фильм тебя обманул и ты этому радовался.' },
  FAXJ: { name: 'Мультивселенский паук', text: 'Современная анимация на скорости: Паутина вселенных, яркий экшн и шутки на бегу.' },
  FAXS: { name: 'Заклинатель проклятий', text: 'Современное аниме и мультсериалы с жёсткими боями. Магическая битва вместо мультиков.' },
  FADJ: { name: 'Дикий робот', text: 'Свежая анимация, которая говорит о важном. Плачешь на мультфильмах и не оправдываешься.' },
  FADS: { name: 'Поэт аниме-заката', text: 'Синкай, меланхолия и тёмная красота. Тебе нужна анимация, которая болит.' },
  FLXJ: { name: 'Блокбастер-гедонист', text: 'Marvel, экшн и кино-аттракционы. Главное — зал, звук и удовольствие.' },
  FLXS: { name: 'Неудержимый', text: 'Современный экшн с мрачным привкусом: Джон Уик, ограбления, перестрелки и холодная месть.' },
  FLDJ: { name: 'Ценитель уютного кино', text: 'Свежие драмы и комедии с душой. Любишь, когда после титров хочется кому-то позвонить.' },
  FLDS: { name: 'Архитектор снов', text: 'Нолан, слои реальности, триллеры, которые надо разбирать. Кино как головоломка.' },
}

export type ScoreMap = Map<string, number>

export function scores(t: Tiers): ScoreMap {
  const m: ScoreMap = new Map()
  for (const k of RANKED) for (const id of t[k]) m.set(id, TIERS[k].score)
  return m
}

const smooth = (sum: number, n: number, k = 2) => (sum + 3 * k) / (n + k)

function groupAvg(sc: ScoreMap, test: (m: Movie) => boolean) {
  let sum = 0, n = 0
  for (const [id, s] of sc) if (test(BY_ID[id])) { sum += s; n++ }
  return { n, avg: n ? sum / n : 0, smooth: smooth(sum, n) }
}

export interface AxisResult { axis: Axis; leftPct: number; letter: string; nL: number; nR: number }

export function axes(sc: ScoreMap): AxisResult[] {
  return AXES.map((axis) => {
    const L = groupAvg(sc, axis.left.test)
    const R = groupAvg(sc, axis.right.test)
    let leftPct = 50 + (L.smooth - R.smooth) * 24
    if (!L.n && !R.n) leftPct = 50
    // Объём тоже говорит о вкусе: если одной стороны почти нет в рейтинге — сдвигаем
    const vol = L.n + R.n ? (L.n - R.n) / (L.n + R.n) : 0
    leftPct += vol * 8
    leftPct = Math.max(4, Math.min(96, Math.round(leftPct)))
    return { axis, leftPct, letter: leftPct >= 50 ? axis.left.l : axis.right.l, nL: L.n, nR: R.n }
  })
}

export interface GroupStat { key: string; label: string; n: number; avg: number; smooth: number; best: string[]; loved: number }

function groupStats(sc: ScoreMap, t: Tiers, groups: Record<string, string>, test: (m: Movie, key: string) => boolean): GroupStat[] {
  const order = RANKED.flatMap((k) => t[k])
  return Object.entries(groups)
    .map(([key, label]) => {
      const ids = order.filter((id) => test(BY_ID[id], key))
      const sum = ids.reduce((a, id) => a + sc.get(id)!, 0)
      return {
        key, label, n: ids.length,
        avg: ids.length ? sum / ids.length : 0,
        smooth: smooth(sum, ids.length, 3),
        best: ids.slice(0, 4),
        loved: ids.filter((id) => sc.get(id)! >= 4).length,
      }
    })
    .filter((g) => g.n > 0)
    .sort((a, b) => b.smooth - a.smooth || b.n - a.n)
}

const decadeOf = (y: number) => (y < 1990 ? 1980 : Math.floor(y / 10) * 10)
const DECADES: Record<string, string> = { 1980: 'до 90-х', 1990: '90-е', 2000: '2000-е', 2010: '2010-е', 2020: '2020-е' }

export function profile(t: Tiers) {
  const sc = scores(t)
  const ax = axes(sc)
  const code = ax.map((a) => a.letter).join('')
  const genres = groupStats(sc, t, GENRES, (m, k) => m.genres.includes(k))
  const kinds = groupStats(sc, t, KINDS as Record<string, string>, (m, k) => m.kind === k)
  const decades = groupStats(sc, t, DECADES, (m, k) => decadeOf(m.year) === +k)
  const dist = Object.fromEntries((['S', 'A', 'B', 'C', 'D', 'X'] as TierKey[]).map((k) => [k, t[k].length])) as Record<TierKey, number>
  const mine = groupAvg(sc, (m) => m.mine)
  const recs = groupAvg(sc, (m) => !m.mine)
  return { sc, ax, code, type: TYPES[code], genres, kinds, decades, dist, mine, recs, ranked: sc.size }
}

export type Profile = ReturnType<typeof profile>

export function compare(a: Tiers, b: Tiers) {
  const pa = profile(a), pb = profile(b)
  const common = [...pa.sc.keys()].filter((id) => pb.sc.has(id))
  const diffs = common.map((id) => ({ id, a: pa.sc.get(id)!, b: pb.sc.get(id)!, d: pa.sc.get(id)! - pb.sc.get(id)! }))
  const mean = diffs.length ? diffs.reduce((s, x) => s + Math.abs(x.d), 0) / diffs.length : 0
  // Отношение совпадений по жанровому профилю — на случай малого пересечения
  const axisGap = pa.ax.reduce((s, x, i) => s + Math.abs(x.leftPct - pb.ax[i].leftPct), 0) / (pa.ax.length * 100)
  const filmMatch = 100 - (mean / 4) * 100
  const w = Math.min(1, diffs.length / 25)
  const match = diffs.length ? Math.round(filmMatch * w + (100 - axisGap * 100) * (1 - w)) : Math.round(100 - axisGap * 100)
  const exact = diffs.filter((x) => x.d === 0).length
  const bothLove = diffs.filter((x) => x.a >= 4 && x.b >= 4).sort((x, y) => y.a + y.b - (x.a + x.b))
  const fights = diffs.filter((x) => Math.abs(x.d) >= 2).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
  const seenB = (id: string) => pb.sc.has(id)
  const seenA = (id: string) => pa.sc.has(id)
  const forB = [...a.S, ...a.A].filter((id) => !seenB(id))
  const forA = [...b.S, ...b.A].filter((id) => !seenA(id))
  const genreKeys = new Set([...pa.genres, ...pb.genres].filter((g) => g.n >= 1).map((g) => g.key))
  const genres = [...genreKeys]
    .map((key) => {
      const ga = pa.genres.find((g) => g.key === key)
      const gb = pb.genres.find((g) => g.key === key)
      return { key, label: GENRES[key], a: ga?.avg ?? 0, b: gb?.avg ?? 0, na: ga?.n ?? 0, nb: gb?.n ?? 0 }
    })
    .filter((g) => g.na && g.nb)
    .sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))
  return { pa, pb, common: diffs.length, exact, match, bothLove, fights, forA, forB, genres }
}

export function matchTitle(p: number) {
  if (p >= 88) return 'Кино-близнецы'
  if (p >= 76) return 'Родственные души'
  if (p >= 64) return 'Смотрим вместе, спорим на титрах'
  if (p >= 50) return 'Разные залы одного кинотеатра'
  return 'Противоположности притягиваются'
}
