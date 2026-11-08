import type { Kind } from './movies'

export type TierKey = 'S' | 'A' | 'B' | 'C' | 'D' | 'X'
export const RANKED: TierKey[] = ['S', 'A', 'B', 'C', 'D']
// «Не смотрел» — это всё, что осталось в каталоге, отдельного тира нет
export const ALL_TIERS: TierKey[] = [...RANKED]

export const TIERS: Record<TierKey, { label: string; note: string; score: number }> = {
  S: { label: 'S', note: 'шедевр', score: 5 },
  A: { label: 'A', note: 'обожаю', score: 4 },
  B: { label: 'B', note: 'хорошо', score: 3 },
  C: { label: 'C', note: 'норм', score: 2 },
  D: { label: 'D', note: 'мимо', score: 1 },
  X: { label: '—', note: 'не смотрел', score: 0 },
}

export const GENRES: Record<string, string> = {
  act: 'Экшн',
  hero: 'Супергерои',
  com: 'Комедия',
  sci: 'Фантастика',
  fan: 'Фэнтези',
  adv: 'Приключения',
  dra: 'Драма',
  rom: 'Романтика',
  cri: 'Криминал',
  thr: 'Триллер',
  mys: 'Мистика и детектив',
  hor: 'Ужасы',
  mar: 'Боевые искусства',
  spo: 'Спорт',
  fam: 'Семейное',
  doc: 'Док и выживание',
}

export const KINDS: Record<Kind, string> = {
  f: 'Фильм',
  s: 'Сериал',
  t: 'Мультфильм',
  ts: 'Мультсериал',
  a: 'Аниме',
  d: 'Док / шоу',
}
