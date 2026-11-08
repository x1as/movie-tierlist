<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Sortable from 'sortablejs'
import Poster from './Poster.vue'
import QuickRate from './QuickRate.vue'
import { ALL_TIERS, GENRES, KINDS, TIERS, type TierKey } from '../data/meta'
import { BY_ID, type Kind } from '../data/movies'
import { move, placed, poolIds, state, undo, canUndo } from '../lib/store'

const emit = defineEmits<{ open: [id: string] }>()

// ── фильтры пула ──
const q = ref('')
const kind = ref<Kind | ''>('')
const genre = ref('')
const source = ref<'all' | 'mine' | 'recs'>('all')
const pool = computed(() => {
  const s = q.value.trim().toLowerCase()
  return poolIds.value.filter((id) => {
    const m = BY_ID[id]
    if (kind.value && m.kind !== kind.value) return false
    if (genre.value && !m.genres.includes(genre.value)) return false
    if (source.value === 'mine' && !m.mine) return false
    if (source.value === 'recs' && m.mine) return false
    if (s && !m.title.toLowerCase().includes(s) && !m.wiki.toLowerCase().includes(s) && String(m.year) !== s) return false
    return true
  })
})
const total = computed(() => placed.value.size)

// ── drag & drop: Sortable двигает DOM, мы откатываем и меняем state, Vue перерисовывает ──
const lists: HTMLElement[] = []
const addList = (el: unknown) => { if (el && !lists.includes(el as HTMLElement)) lists.push(el as HTMLElement) }
const sortables: Sortable[] = []
let next: Node | null = null
let lastDrag = 0

onMounted(() => {
  for (const el of lists) {
    const isPool = el.dataset.list === 'pool'
    sortables.push(
      Sortable.create(el, {
        group: 'tiers',
        sort: !isPool,
        animation: 160,
        draggable: '.poster',
        delay: 160,
        delayOnTouchOnly: true,
        ghostClass: 'drag-ghost',
        chosenClass: 'drag-chosen',
        forceFallback: false,
        onStart: (e) => { next = e.item.nextSibling },
        onEnd: (e) => {
          lastDrag = Date.now()
          const id = e.item.dataset.id!
          const to = (e.to as HTMLElement).dataset.list!
          const from = (e.from as HTMLElement).dataset.list!
          const idx = e.newDraggableIndex ?? e.newIndex ?? 0
          e.item.remove()
          e.from.insertBefore(e.item, next)
          if (to === 'pool') { if (from !== 'pool') move(id, null) }
          else move(id, to as TierKey, idx)
        },
      }),
    )
  }
})
onBeforeUnmount(() => sortables.forEach((s) => s.destroy()))

function onClick(ev: MouseEvent) {
  if (Date.now() - lastDrag < 250) return
  const el = (ev.target as HTMLElement).closest('.poster') as HTMLElement | null
  if (el?.dataset.id) emit('open', el.dataset.id)
}

// ── быстрые клавиши: навёл на постер и нажал S/A/B/C/D/X или 1–6, 0/Backspace — в пул ──
const hovered = ref<string | null>(null)
function onOver(ev: MouseEvent) {
  const el = (ev.target as HTMLElement).closest('.poster') as HTMLElement | null
  hovered.value = el?.dataset.id ?? null
}
const KEYMAP: Record<string, TierKey | null> = {
  s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', x: 'X',
  ы: 'S', ф: 'A', и: 'B', с: 'C', в: 'D', ч: 'X',
  '1': 'S', '2': 'A', '3': 'B', '4': 'C', '5': 'D', '6': 'X', '0': null, backspace: null,
}
function onKey(e: KeyboardEvent) {
  if (quick.value) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() in { z: 1, я: 1 } && !(e.target as HTMLElement)?.closest?.('input, textarea')) {
    e.preventDefault()
    return undo()
  }
  if (!hovered.value || e.ctrlKey || e.metaKey || e.altKey) return
  if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return
  const k = e.key.toLowerCase()
  if (!(k in KEYMAP)) return
  e.preventDefault()
  const id = hovered.value
  const t = KEYMAP[k]
  if (placed.value.get(id) === t) return
  move(id, t)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ── быстрая раскладка по одному ──
const quick = ref<string[] | null>(null)
const startQuick = () => { if (pool.value.length) quick.value = [...pool.value] }

// ── тирлист картинкой ──
const capture = ref<HTMLElement | null>(null)
const shooting = ref(false)
async function saveImage() {
  if (!capture.value || shooting.value) return
  shooting.value = true
  try {
    const el = capture.value
    el.classList.add('shot')
    const imgs = [...el.querySelectorAll('img')]
    imgs.forEach((i) => (i.loading = 'eager'))
    await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 4000))])
    const { toPng } = await import('html-to-image')
    const url = await toPng(el, {
      pixelRatio: 2,
      backgroundColor: '#1a120d',
      filter: (n) => !(n instanceof HTMLElement && n.dataset.noshot !== undefined),
    })
    const a = document.createElement('a')
    a.href = url
    a.download = `tierlist-${(state.name || 'my').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.png`
    a.click()
  } catch (e) {
    alert('Не получилось сохранить картинку: ' + (e as Error).message)
  } finally {
    capture.value?.classList.remove('shot')
    shooting.value = false
  }
}
</script>

<template>
  <section class="board" @click="onClick" @mouseover="onOver" @mouseleave="hovered = null">
    <div class="tiers">
      <div class="toolbar">
        <input v-model="state.name" class="name" maxlength="40" placeholder="Чей это тирлист? Впиши имя" />
        <button class="btn quick-btn" :disabled="!pool.length" @click="startQuick">
          ⚡ Быстрая раскладка <small>{{ pool.length }}</small>
        </button>
        <button class="ghost" :disabled="!canUndo" title="Ctrl+Z" @click="undo">↶ Отменить</button>
        <button class="ghost" :disabled="shooting || !total" @click="saveImage">{{ shooting ? 'Рисую…' : '🖼 Картинкой' }}</button>
      </div>
      <div ref="capture" class="capture">
        <div class="shot-title">
          <b>{{ state.name ? `Тирлист: ${state.name}` : 'Мой тирлист' }}</b>
          <span>Ламповый тирлист · x1as.github.io/movie-tierlist</span>
        </div>
        <div v-for="k in ALL_TIERS" :key="k" class="tier" :data-tier="k">
          <div class="tier-label">
            <b>{{ TIERS[k].label }}</b>
            <span>{{ TIERS[k].note }}</span>
            <i v-if="state.tiers[k].length">{{ state.tiers[k].length }}</i>
          </div>
          <div :ref="addList" class="tier-drop" :data-list="k">
            <Poster v-for="id in state.tiers[k]" :key="id" :id="id" />
            <span v-if="!state.tiers[k].length" class="drop-hint" data-noshot>перетащи сюда</span>
          </div>
        </div>
      </div>
      <p class="hint">
        Перетаскивай постеры или жми на них. На компьютере быстрее: наведи и нажми <kbd>S</kbd> <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd>,
        <kbd>X</kbd> — не смотрел, <kbd>0</kbd> — вернуть в коробку, <kbd>Ctrl</kbd>+<kbd>Z</kbd> — отменить. Много фильмов удобнее раскладывать через «⚡ Быстрая раскладка»: она берёт то, что сейчас отфильтровано в коробке.
      </p>
    </div>

    <aside class="pool">
      <div class="pool-head">
        <h2>Коробка с кассетами <small>{{ poolIds.length }} из {{ poolIds.length + total }}</small></h2>
        <input v-model="q" class="search" type="search" placeholder="Найти фильм…" />
        <div class="chips">
          <button :class="{ on: source === 'all' }" @click="source = 'all'">Все</button>
          <button :class="{ on: source === 'mine' }" @click="source = 'mine'">Из списка Xias</button>
          <button :class="{ on: source === 'recs' }" @click="source = 'recs'">Рекомендации</button>
        </div>
        <div class="selects">
          <select v-model="kind">
            <option value="">Любой формат</option>
            <option v-for="(l, k) in KINDS" :key="k" :value="k">{{ l }}</option>
          </select>
          <select v-model="genre">
            <option value="">Любой жанр</option>
            <option v-for="(l, k) in GENRES" :key="k" :value="k">{{ l }}</option>
          </select>
        </div>
      </div>
      <div :ref="addList" class="pool-grid" data-list="pool">
        <Poster v-for="id in pool" :key="id" :id="id" />
      </div>
      <p v-if="!pool.length" class="empty">{{ poolIds.length ? 'Под фильтр ничего не подходит' : 'Коробка пуста — всё разложено 🎞' }}</p>
    </aside>
    <Teleport to="body"><QuickRate v-if="quick" :ids="quick" @close="quick = null" /></Teleport>
  </section>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 20px;
  align-items: start;
}
.tiers { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.name {
  flex: 1 1 220px; min-width: 0;
  background: transparent; color: var(--text);
  border: 0; border-bottom: 2px dashed var(--line);
  padding: 6px 2px; font: 700 22px var(--font-display);
}
.name:focus { outline: none; border-bottom-color: var(--accent); }
.name::placeholder { color: var(--muted); opacity: 0.7; }
.quick-btn small { background: rgba(36, 23, 15, 0.18); border-radius: 99px; padding: 1px 7px; font-size: 12px; }
.toolbar .ghost:disabled { opacity: 0.45; cursor: default; }
.capture { display: flex; flex-direction: column; gap: 8px; }
.shot-title { display: none; }
.capture.shot { padding: 22px; width: 1100px; background: #1a120d; }
.capture.shot .shot-title { display: flex; justify-content: space-between; align-items: baseline; padding: 0 4px 6px; }
.shot-title b { font: 700 30px var(--font-display); white-space: nowrap; }
.shot-title span { white-space: nowrap; }
.shot-title span { font: 600 20px var(--font-hand); color: var(--accent); }
.tier-label i { font: 800 11px var(--font-body); font-style: normal; opacity: 0.65; margin-top: 2px; }
.drop-hint { align-self: center; margin: auto; color: var(--muted); font: 600 18px var(--font-hand); opacity: 0.45; pointer-events: none; }
.tier {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  min-height: calc(var(--card-w) * 1.5 + 16px);
}
.tier-label {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  background: var(--tc);
  color: #24170f;
  text-align: center;
  padding: 8px 6px;
}
.tier-label b { font: 700 34px/1 var(--font-display); }
.tier-label span { font: 600 17px/1 var(--font-hand); opacity: 0.85; }
.tier[data-tier='S'] { --tc: var(--t-s); }
.tier[data-tier='A'] { --tc: var(--t-a); }
.tier[data-tier='B'] { --tc: var(--t-b); }
.tier[data-tier='C'] { --tc: var(--t-c); }
.tier[data-tier='D'] { --tc: var(--t-d); }
.tier[data-tier='X'] { --tc: var(--t-x); }
.tier[data-tier='X'] .tier-label { color: var(--text); }
.tier-drop {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 8px;
  align-content: flex-start;
  min-height: 100%;
}
.tier-drop :deep(.poster), .pool-grid :deep(.poster) { cursor: grab; transition: transform 0.15s ease; }
.tier-drop :deep(.poster:hover), .pool-grid :deep(.poster:hover) { transform: translateY(-2px) rotate(-0.6deg); }
.hint { color: var(--muted); font-size: 13px; margin: 6px 4px 0; line-height: 1.6; }
kbd {
  font: 700 11px/1 var(--font-body);
  padding: 3px 6px; border-radius: 5px;
  background: var(--panel-2); border: 1px solid var(--line); border-bottom-width: 2px;
  color: var(--text);
}

.pool {
  position: sticky; top: 76px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  display: flex; flex-direction: column;
  max-height: calc(100vh - 92px);
  overflow: hidden;
}
.pool-head { padding: 14px 14px 10px; border-bottom: 1px dashed var(--line); display: flex; flex-direction: column; gap: 8px; }
.pool-head h2 { margin: 0; font: 600 20px/1.2 var(--font-display); }
.pool-head h2 small { font: 600 12px var(--font-body); color: var(--muted); margin-left: 6px; }
.search, select {
  width: 100%;
  background: var(--bg-2); color: var(--text);
  border: 1px solid var(--line); border-radius: 10px;
  padding: 8px 10px; font: 600 14px var(--font-body);
  min-width: 0;
}
.search:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 0; }
.selects { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chips button {
  border: 1px solid var(--line); background: transparent; color: var(--muted);
  border-radius: 999px; padding: 5px 11px; font: 700 12px var(--font-body); cursor: pointer;
}
.chips button.on { background: var(--accent); color: #24170f; border-color: var(--accent); }
.pool-grid {
  --card-w: 62px;
  display: flex; flex-wrap: wrap; gap: 6px; align-content: flex-start;
  padding: 12px 14px 16px;
  overflow-y: auto;
  min-height: 120px;
  flex: 1;
}
.empty { color: var(--muted); text-align: center; padding: 0 16px 20px; margin: 0; }

@media (max-width: 1000px) {
  .board { grid-template-columns: 1fr; }
  .pool { position: static; max-height: none; }
  .pool-grid { max-height: 62vh; }
}
@media (max-width: 560px) {
  .toolbar { display: grid; grid-template-columns: 1fr 1fr; }
  .toolbar .name, .toolbar .quick-btn { grid-column: 1 / -1; }
  .toolbar button { justify-content: center; }
  .tier { grid-template-columns: 58px minmax(0, 1fr); }
  .tier-label b { font-size: 26px; }
  .tier-label span { font-size: 13px; }
  .tier-drop { gap: 4px; padding: 6px; }
  .pool-grid { --card-w: 54px; gap: 5px; padding: 10px; }
}
</style>
