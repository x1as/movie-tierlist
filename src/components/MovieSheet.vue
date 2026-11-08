<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import Poster from './Poster.vue'
import { ALL_TIERS, GENRES, KINDS, TIERS, type TierKey } from '../data/meta'
import { BY_ID } from '../data/movies'
import { move, placed } from '../lib/store'

const props = defineProps<{ id: string }>()
const emit = defineEmits<{ close: [] }>()
const m = computed(() => BY_ID[props.id])
const cur = computed(() => placed.value.get(props.id) ?? null)
const set = (t: TierKey | null) => { move(props.id, t); emit('close') }
const wikiUrl = computed(() => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(m.value.wiki.replace(/ /g, '_')))

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') return emit('close')
  const k = e.key.toUpperCase()
  if ((ALL_TIERS as string[]).includes(k)) set(k as TierKey)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" :aria-label="m.title">
      <div class="art"><Poster :id="id" big /></div>
      <div class="info">
        <button class="x" aria-label="Закрыть" @click="emit('close')">✕</button>
        <h3>{{ m.title }}</h3>
        <p class="meta">{{ m.year }} · {{ KINDS[m.kind] }}</p>
        <div class="tags">
          <span v-for="g in m.genres" :key="g">{{ GENRES[g] }}</span>
        </div>
        <p class="src">{{ m.mine ? '★ Из списка Xias' : '✦ Рекомендация по вкусу Xias' }}</p>
        <div class="pick">
          <button v-for="k in ALL_TIERS" :key="k" :data-tier="k" :class="{ on: cur === k }" @click="set(k)">
            <b>{{ TIERS[k].label }}</b><small>{{ TIERS[k].note }}</small>
          </button>
        </div>
        <div class="row">
          <button v-if="cur" class="ghost" @click="set(null)">Вернуть в коробку</button>
          <a class="ghost" :href="wikiUrl" target="_blank" rel="noopener">Википедия ↗</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sheet {
  display: grid; grid-template-columns: 200px 1fr; gap: 22px;
  width: min(640px, 100%);
  background: var(--panel); border: 1px solid var(--line); border-radius: 20px;
  padding: 20px; box-shadow: var(--shadow-lg);
  animation: pop 0.2s ease;
}
.info { position: relative; min-width: 0; }
.x { position: absolute; top: -6px; right: -6px; background: none; border: 0; color: var(--muted); font-size: 18px; cursor: pointer; padding: 6px; }
h3 { margin: 0 28px 4px 0; font: 700 24px/1.15 var(--font-display); }
.meta { margin: 0 0 10px; color: var(--muted); font-weight: 600; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tags span { font-size: 12px; font-weight: 700; padding: 4px 9px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line); }
.src { font: 600 19px var(--font-hand); color: var(--accent); margin: 12px 0; }
.pick { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.pick button {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 4px; border-radius: 10px; cursor: pointer;
  border: 2px solid transparent;
  background: var(--tc); color: #24170f;
}
.pick button b { font: 700 20px/1 var(--font-display); }
.pick button small { font-size: 11px; font-weight: 700; opacity: 0.8; }
.pick button.on { border-color: var(--text); box-shadow: 0 0 0 3px var(--bg); }
.pick [data-tier='S'] { --tc: var(--t-s); }
.pick [data-tier='A'] { --tc: var(--t-a); }
.pick [data-tier='B'] { --tc: var(--t-b); }
.pick [data-tier='C'] { --tc: var(--t-c); }
.pick [data-tier='D'] { --tc: var(--t-d); }
.pick [data-tier='X'] { --tc: var(--t-x); color: var(--text); }
.row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
@media (max-width: 560px) {
  .sheet { grid-template-columns: 110px 1fr; gap: 14px; padding: 14px; }
  h3 { font-size: 19px; }
  .pick { grid-column: 1 / -1; }
}
</style>
