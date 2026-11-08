<script setup lang="ts">
import { computed, ref } from 'vue'
import { BY_ID } from '../data/movies'
import { posterUrl } from '../lib/posters'

const props = defineProps<{ id: string; badge?: string; big?: boolean }>()
const m = computed(() => BY_ID[props.id])
const src = computed(() => posterUrl(props.id))
const broken = ref(false)
// Тёплый оттенок-заглушка, стабильный для id
const hue = computed(() => [...props.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 50 + 10)
</script>

<template>
  <div class="poster" :class="{ big }" :title="`${m.title} (${m.year})`" :data-id="id">
    <img v-if="src && !broken" :src="src" :alt="m.title" :loading="big ? 'eager' : 'lazy'" draggable="false" @error="broken = true" />
    <div v-else class="fallback" :style="{ '--h': hue }">
      <span>{{ m.title }}</span>
      <small>{{ m.year }}</small>
    </div>
    <span v-if="!big" class="cap">{{ m.title }}</span>
    <span v-if="badge" class="badge" :data-tier="badge">{{ badge === 'X' ? '—' : badge }}</span>
  </div>
</template>

<style scoped>
.poster {
  position: relative;
  width: var(--card-w);
  aspect-ratio: 2 / 3;
  border-radius: 7px;
  overflow: hidden;
  background: var(--panel-2);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25), 0 6px 14px -6px rgba(0, 0, 0, 0.6);
  flex: none;
  user-select: none;
}
.poster.big { width: 100%; border-radius: 12px; }
img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.fallback {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; justify-content: flex-end; gap: 2px;
  padding: 6px;
  background:
    radial-gradient(120% 80% at 30% 0%, hsl(var(--h) 70% 55% / 0.55), transparent 60%),
    linear-gradient(160deg, hsl(var(--h) 45% 22%), hsl(calc(var(--h) + 10) 35% 12%));
  color: var(--text);
  font-size: 10px; line-height: 1.15; font-weight: 700;
  overflow: hidden;
}
.big .fallback { font-size: 18px; padding: 16px; }
.fallback small { opacity: 0.65; font-weight: 600; }
.cap {
  position: absolute; inset: auto 0 0 0;
  padding: 14px 4px 4px;
  font: 700 9.5px/1.15 var(--font-body);
  color: #fff;
  background: linear-gradient(transparent, rgba(10, 6, 3, 0.92));
  opacity: 0; transform: translateY(4px);
  transition: opacity 0.15s, transform 0.15s;
  pointer-events: none;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
@media (hover: hover) {
  .poster:hover .cap { opacity: 1; transform: none; }
}
.badge {
  position: absolute; top: 4px; left: 4px;
  min-width: 20px; height: 20px; padding: 0 5px;
  border-radius: 6px;
  display: grid; place-items: center;
  font: 800 12px/1 var(--font-body);
  color: #1d130d;
  background: var(--tier-color, var(--accent));
}
.badge[data-tier='S'] { --tier-color: var(--t-s); }
.badge[data-tier='A'] { --tier-color: var(--t-a); }
.badge[data-tier='B'] { --tier-color: var(--t-b); }
.badge[data-tier='C'] { --tier-color: var(--t-c); }
.badge[data-tier='D'] { --tier-color: var(--t-d); }
.badge[data-tier='X'] { --tier-color: var(--t-x); color: var(--text); }
</style>
