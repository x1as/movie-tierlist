<script setup lang="ts">
// Один тир. Отдельный компонент: при переносе перерисовывается только он, а не вся доска.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type Sortable from 'sortablejs'
import Poster from './Poster.vue'
import { TIERS, type TierKey } from '../data/meta'
import { makeSortable } from '../lib/dnd'

const props = defineProps<{ k: TierKey; ids: string[] }>()
const drop = ref<HTMLElement | null>(null)
let s: Sortable | null = null
onMounted(() => { s = makeSortable(drop.value!, props.k) })
onBeforeUnmount(() => s?.destroy())
</script>

<template>
  <div class="tier" :data-tier="k">
    <div class="tier-label" :title="TIERS[k].note"><b>{{ TIERS[k].label }}</b></div>
    <div ref="drop" class="tier-drop" :data-list="k">
      <Poster v-for="id in ids" :key="id" :id="id" eager />
    </div>
  </div>
</template>

<style scoped>
.tier {
  position: relative;
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 10px;
  padding: 8px;
  border-radius: 22px;
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--line), 0 18px 40px -26px rgba(0, 0, 0, 0.9);
  flex: 1 0 var(--basis, auto);
  min-height: 0;
  transition: box-shadow 0.18s;
  contain: layout style;
}
.tier::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(90deg, color-mix(in oklab, var(--tc) 16%, transparent), transparent 40%);
}
/* подсветка ряда, над которым сейчас карточка */
.tier:has(.drag-ghost) { box-shadow: inset 0 0 0 1.5px var(--tc), 0 0 34px -8px var(--tc); }
.tier-label {
  position: relative;
  display: grid; place-items: center;
  border-radius: 16px;
  background: var(--tg);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    inset 0 -10px 18px rgba(0, 0, 0, 0.22),
    0 0 0 1px rgba(255, 255, 255, 0.12),
    0 10px 30px -8px var(--tc),
    0 0 40px -10px var(--tc);
  overflow: hidden;
}
.tier-label::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(115deg, rgba(255, 255, 255, 0.45) 0 18%, transparent 18% 100%);
  mix-blend-mode: soft-light;
}
.tier-label b {
  position: relative;
  font: 800 40px/1 var(--font-display);
  color: var(--on-tier);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35), 0 3px 0 rgba(0, 0, 0, 0.18);
}
.tier[data-tier='S'] { --tc: var(--t-s); --tg: var(--g-s); --basis: var(--basis-S); }
.tier[data-tier='A'] { --tc: var(--t-a); --tg: var(--g-a); --basis: var(--basis-A); }
.tier[data-tier='B'] { --tc: var(--t-b); --tg: var(--g-b); --basis: var(--basis-B); }
.tier[data-tier='C'] { --tc: var(--t-c); --tg: var(--g-c); --basis: var(--basis-C); }
.tier[data-tier='D'] { --tc: var(--t-d); --tg: var(--g-d); --basis: var(--basis-D); }
.tier-drop {
  position: relative;
  display: flex; flex-wrap: wrap; gap: 6px;
  align-content: flex-start;
  min-height: 100%;
  border-radius: 14px;
}
.tier-drop :deep(.poster) { cursor: grab; }
@media (hover: hover) {
  .tier-drop :deep(.poster:hover) { transform: translateY(-3px); }
  .tier-drop :deep(.poster:hover .art) {
    box-shadow: 0 0 0 1.5px var(--accent), 0 0 22px -4px var(--accent-glow), 0 12px 22px -10px rgba(0, 0, 0, 0.9);
  }
}
/* карточка из каталога, пока её несут над тиром: сразу в размере тира и без подписи */
.tier-drop :deep(.poster.labeled) { width: var(--card-w); padding: 0; background: none; box-shadow: none; }
.tier-drop :deep(.poster.labeled .label) { display: none; }
.tier-drop :deep(.drag-ghost) { opacity: 1; }
.tier-drop :deep(.drag-ghost .art) { opacity: 0.35; box-shadow: 0 0 0 2px var(--tc), 0 0 18px -2px var(--tc); }

@media (max-width: 900px) {
  .tier { flex-basis: auto; min-height: calc(var(--card-w) * 1.5 + 16px); }
}
@media (max-width: 560px) {
  .tier { grid-template-columns: 50px minmax(0, 1fr); gap: 6px; padding: 6px; border-radius: 18px; }
  .tier-label { border-radius: 12px; }
  .tier-label b { font-size: 26px; }
  .tier-drop { gap: 4px; }
}
</style>
