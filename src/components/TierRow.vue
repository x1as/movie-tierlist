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
/* Ряд тира: часть единого стеклянного листа. Неоновая буква и тонкая светящаяся кромка слева. */
.tier {
  position: relative;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 8px;
  padding: 6px 10px 6px 0;
  flex: 1 0 var(--basis, auto);
  min-height: 0;
  contain: layout style;
}
.tier + .tier { border-top: 1px solid var(--line); }
.tier::before {
  content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--tc);
  box-shadow: 0 0 14px var(--tc), 0 0 2px var(--tc);
}
.tier::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(90deg, color-mix(in oklab, var(--tc) 9%, transparent), transparent 22%);
  transition: background 0.2s;
}
.tier:has(.drag-ghost)::after { background: linear-gradient(90deg, color-mix(in oklab, var(--tc) 22%, transparent), color-mix(in oklab, var(--tc) 5%, transparent) 60%); }
.tier-label { display: grid; place-items: center; position: relative; z-index: 1; }
.tier-label b {
  font: 700 26px/1 var(--font-display);
  color: var(--tc);
  text-shadow: 0 0 18px color-mix(in oklab, var(--tc) 55%, transparent);
}
.tier[data-tier='S'] { --tc: var(--t-s); --basis: var(--basis-S); }
.tier[data-tier='A'] { --tc: var(--t-a); --basis: var(--basis-A); }
.tier[data-tier='B'] { --tc: var(--t-b); --basis: var(--basis-B); }
.tier[data-tier='C'] { --tc: var(--t-c); --basis: var(--basis-C); }
.tier[data-tier='D'] { --tc: var(--t-d); --basis: var(--basis-D); }
.tier-drop {
  position: relative; z-index: 1;
  display: flex; flex-wrap: wrap; gap: 6px;
  align-content: flex-start;
  min-height: 100%;
}
.tier-drop :deep(.poster) { cursor: grab; }
@media (hover: hover) {
  .tier-drop :deep(.poster:hover) { transform: translateY(-2px); }
  .tier-drop :deep(.poster:hover .art) { box-shadow: 0 0 0 1.5px var(--tc), 0 0 18px -4px var(--tc), 0 10px 20px -10px rgba(0, 0, 0, 0.9); }
}
/* карточка из каталога над тиром — сразу в размере тира и без подписи */
.tier-drop :deep(.poster.labeled) { width: var(--card-w); padding: 0; background: none; box-shadow: none; }
.tier-drop :deep(.poster.labeled .label) { display: none; }
.tier-drop :deep(.drag-ghost) { opacity: 1; }
.tier-drop :deep(.drag-ghost .art) { opacity: 0.3; box-shadow: 0 0 0 1.5px var(--tc), 0 0 16px -2px var(--tc); }

@media (max-width: 900px) {
  .tier { flex-basis: auto; min-height: calc(var(--card-w) * 1.5 + 12px); }
}
@media (max-width: 560px) {
  .tier { grid-template-columns: 40px minmax(0, 1fr); gap: 4px; padding: 5px 6px 5px 0; }
  .tier-label b { font-size: 20px; }
  .tier-drop { gap: 4px; }
}
</style>
