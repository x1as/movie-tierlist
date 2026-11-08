<script setup lang="ts">
import { computed, ref } from 'vue'
import { BY_ID } from '../data/movies'
import { GENRES, GENRE_COLORS } from '../data/meta'
import { posterUrl, seen, markSeen } from '../lib/posters'

// label — показать подпись под постером (в каталоге)
const props = defineProps<{ id: string; badge?: string; big?: boolean; label?: boolean; eager?: boolean }>()
const m = computed(() => BY_ID[props.id])
const src = computed(() => posterUrl(props.id))
const broken = ref(false)
// уже виденную картинку грузим сразу: после переноса постер не мигает пустым кадром
const loading = computed(() => (props.big || props.eager || seen.has(src.value) ? 'eager' : 'lazy'))
const g0 = computed(() => m.value.genres[0])
const gc = computed(() => GENRE_COLORS[g0.value] ?? '#8b5cff')
const hue = computed(() => ([...props.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 6) * 50 + 260)
</script>

<template>
  <div class="poster" :class="{ big, labeled: label }" :style="label ? { '--gc': gc } : undefined" :title="`${m.title} (${m.year})`" :data-id="id">
    <div class="art">
      <img v-if="src && !broken" :src="src" :alt="m.title" :loading="loading" decoding="auto" draggable="false" @load="markSeen(src)" @error="broken = true" />
      <div v-else class="fallback" :style="{ '--h': hue }">
        <span>{{ m.title }}</span>
      </div>
      <span v-if="!big && !label" class="cap">{{ m.title }}</span>
      <span v-if="badge" class="badge" :data-tier="badge">{{ badge }}</span>
    </div>
    <div v-if="label" class="label">
      <b>{{ m.title }}</b>
      <span class="meta"><i>{{ GENRES[g0] }}</i><small>{{ m.year }}</small></span>
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

/* карточка каталога: обёртка в цвете основного жанра */
.labeled {
  border-radius: 18px; padding: 5px 5px 0;
  background:
    radial-gradient(120% 70% at 50% 0%, color-mix(in oklab, var(--gc) 45%, transparent), transparent 70%),
    linear-gradient(170deg, color-mix(in oklab, var(--gc) 32%, #120e22), color-mix(in oklab, var(--gc) 10%, #0b0818) 70%);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--gc) 45%, transparent), inset 0 1px 0 color-mix(in oklab, var(--gc) 60%, white 10%);
  transition: transform 0.16s cubic-bezier(.2,.8,.2,1), box-shadow 0.2s;
}
.labeled:hover { box-shadow: inset 0 0 0 1.5px var(--gc), 0 0 26px -6px var(--gc); }
.labeled .art { border-radius: 13px; box-shadow: 0 8px 18px -10px rgba(0, 0, 0, 0.9); }
.label { padding: 8px 4px 9px; min-width: 0; }
.label b {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  font: 700 13px/1.2 var(--font-body); color: #fff; letter-spacing: -0.01em;
  min-height: 2.4em;
}
.label .meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 6px; }
.label .meta i {
  font: 600 10.5px/1 var(--font-body); font-style: normal;
  color: var(--gc); background: color-mix(in oklab, var(--gc) 16%, transparent);
  padding: 4px 7px; border-radius: 99px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.label .meta small { font: 600 11px var(--font-body); color: rgba(255, 255, 255, 0.55); font-variant-numeric: tabular-nums; flex: none; }
</style>
