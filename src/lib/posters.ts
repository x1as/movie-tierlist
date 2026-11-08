import map from '../data/posters.json'

const files = map as Record<string, string>
export const posterUrl = (id: string) => (files[id] ? `${import.meta.env.BASE_URL}posters/${files[id]}` : '')
