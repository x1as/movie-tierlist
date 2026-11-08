<script setup lang="ts">
import { computed, ref } from 'vue'
import { BY_ID } from '../data/movies'
import { posterUrl } from '../lib/posters'

// label — показать подпись под постером (в каталоге)
const props = defineProps<{ id: string; badge?: string; big?: boolean; label?: boolean }>()
const m = computed(() => BY_ID[props.id])
const src = computed(() => posterUrl(props.id))
const broken = ref(false)
const hue = computed(() => ([...props.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 6) * 50 + 260)
</script>

<template>
  <div class="poster" :class="{ big, labeled: label }" :title="`${m.title} (${m.year})`" :data-id="id">
    <div class="art">
      <img v-if="src && !broken" :src="src" :alt="m.title" :loading="big ? 'eager' : 'lazy'" decoding="async" draggable="false" @error="broken = true" />
      <div v-else class="fallback" :style="{ '--h': hue }">
        <span>{{ m.title }}</span>
      </div>
      <span v-if="!big && !label" class="cap">{{ m.title }}</span>
      <span v-if="badge" class="badge" :data-tier="badge">{{ badge }}</span>
    </div>
    <div v-if="label" class="label">
      <b>{{ m.title }}</b>
      <small>{{ m.year }}</small>
    </div>
  </div>
</template>

<style scoped>
.poster {
  position: relative;
  width: var(--card-w);
  flex: none;
  user-select: none;
  contain: layout paint style;
  border-radius: 12px;
  transition: transform 0.16s cubic-bezier(.2,.8,.2,1);
}
.poster.big { width: 100%; }
.art {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 10px;
  overflow: hidden;
  background: #1a1430;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 18px -10px rgba(0, 0, 0, 0.8);
  transition: box-shadow 0.16s;
}
.big .art { border-radius: 18px; }
img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.fallback {
  width: 100%; height: 100%;
  display: flex; align-items: flex-end;
  padding: 7px;
  background:
    radial-gradient(120% 90% at 20% 0%, hsl(var(--h) 90% 60% / 0.55), transparent 60%),
    linear-gradient(160deg, hsl(var(--h) 60% 22%), #0e0a1c);
  color: #fff;
  font: 700 10px/1.15 var(--font-body);
}
.big .fallback { font-size: 18px; padding: 16px; }
.cap {
  position: absolute; inset: auto 0 0 0;
  padding: 16px 5px 5px;
  font: 600 9.5px/1.15 var(--font-body);
  color: #fff;
  background: linear-gradient(transparent, rgba(8, 5, 18, 0.95));
  opacity: 0; transform: translateY(4px);
  transition: opacity 0.15s, transform 0.15s;
  pointer-events: none;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
@media (hover: hover) { .poster:hover .cap { opacity: 1; transform: none; } }
.badge {
  position: absolute; top: 5px; left: 5px;
  min-width: 22px; height: 22px; padding: 0 6px;
  border-radius: 8px;
  display: grid; place-items: center;
  font: 800 12px/1 var(--font-display);
  color: var(--on-tier);
  background: var(--tc, var(--accent));
  box-shadow: 0 0 12px var(--tc, var(--accent));
}
.badge[data-tier='S'] { --tc: var(--t-s); }
.badge[data-tier='A'] { --tc: var(--t-a); }
.badge[data-tier='B'] { --tc: var(--t-b); }
.badge[data-tier='C'] { --tc: var(--t-c); }
.badge[data-tier='D'] { --tc: var(--t-d); }

/* подпись в каталоге: лёгкая стеклянная обёртка с коротким названием */
.labeled { border-radius: 14px; padding: 4px 4px 0; background: rgba(255, 255, 255, 0.04); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07); }
.labeled .art { border-radius: 10px; }
.label { padding: 6px 3px 7px; min-width: 0; }
.label b {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  font: 600 11.5px/1.2 var(--font-body); color: var(--text);
  min-height: 2.4em;
}
.label small { display: block; margin-top: 2px; font: 500 10.5px var(--font-body); color: var(--muted); font-variant-numeric: tabular-nums; }
</style>
