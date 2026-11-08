import { ref } from 'vue'

export const SECRET = 'xias-mirror'
const parse = () => location.hash.replace(/^#\/?/, '').split('/')[0] || ''
export const route = ref(parse())
window.addEventListener('hashchange', () => {
  route.value = parse()
  window.scrollTo({ top: 0 })
})
export const go = (r: string) => (location.hash = '#/' + r)
