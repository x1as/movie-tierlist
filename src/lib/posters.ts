import map from '../data/posters.json'

const files = map as Record<string, string>
export const posterUrl = (id: string) => (files[id] ? `${import.meta.env.BASE_URL}posters/${files[id]}` : '')

// какие постеры браузер уже загрузил — их можно рисовать без ленивой загрузки
export const seen = new Set<string>()
export const markSeen = (src: string) => { seen.add(src) }
