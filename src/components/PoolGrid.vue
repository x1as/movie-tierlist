<script setup lang="ts">
// Сетка каталога. Отдельный компонент: тиры при переносе не трогают его разметку и стили.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type Sortable from 'sortablejs'
import Poster from './Poster.vue'
import { makeSortable } from '../lib/dnd'

defineProps<{ ids: string[] }>()
const grid = ref<HTMLElement | null>(null)
let s: Sortable | null = null
onMounted(() => { s = makeSortable(grid.value!, 'pool') })
onBeforeUnmount(() => s?.destroy())
</script>

<template>
  <div ref="grid" class="pool-grid" data-list="pool">
    <Poster v-for="id in ids" :key="id" :id="id" label />
  </div>
</template>

<style scoped>
.pool-grid {
  display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); grid-auto-rows: max-content;
  gap: 12px; align-content: start;
  padding: 2px 14px 18px 16px;
  min-height: 160px;
  contain: layout style;
}
.pool-grid :deep(.poster) {
  width: 100%; cursor: grab;
  content-visibility: auto; contain-intrinsic-size: auto 120px auto 250px;
}
@media (hover: hover) { .pool-grid :deep(.poster:hover) { transform: translateY(-3px); } }
/* постер из тира, пока его несут над каталогом */
.pool-grid :deep(.drag-ghost) { opacity: 0.4; }
</style>
