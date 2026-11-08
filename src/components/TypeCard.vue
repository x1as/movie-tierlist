<script setup lang="ts">
import type { Profile } from '../lib/analysis'

defineProps<{ p: Profile; who: string; tone?: 'a' | 'b' }>()
</script>

<template>
  <div class="type" :class="tone">
    <p class="who">{{ who }}</p>
    <div class="code">
      <span v-for="a in p.ax" :key="a.axis.key">{{ a.letter }}</span>
    </div>
    <h3>{{ p.type?.name }}</h3>
    <p class="txt">{{ p.type?.text }}</p>
    <p class="legend">
      <template v-for="(a, i) in p.ax" :key="a.axis.key">
        <b>{{ a.letter }}</b> {{ a.leftPct >= 50 ? a.axis.left.name : a.axis.right.name }}<template v-if="i < p.ax.length - 1"> · </template>
      </template>
    </p>
  </div>
</template>

<style scoped>
.type {
  --c: var(--accent);
  position: relative;
  background:
    radial-gradient(140% 90% at 0% 0%, color-mix(in oklab, var(--c) 22%, transparent), transparent 60%),
    var(--panel);
  border: 2px solid var(--ink);
  box-shadow: var(--hard-lg);
  border-radius: 12px;
  padding: 22px;
  overflow: hidden;
}
.type.b { --c: var(--sage); }
.who { margin: 0; font: 600 13px var(--font-body); letter-spacing: 0.02em; color: var(--c); }
.code { display: flex; gap: 6px; margin: 6px 0 10px; }
.code span {
  width: 44px; height: 52px; display: grid; place-items: center;
  font: 700 30px var(--font-display);
  border-radius: 10px;
  background: var(--c); border: 2px solid var(--ink);
  color: var(--ink); box-shadow: 2px 2px 0 var(--ink);
}
h3 { margin: 0 0 6px; font: 700 26px/1.15 var(--font-display); }
.txt { margin: 0 0 10px; color: var(--text-2); line-height: 1.5; }
.legend { margin: 0; font-size: 12px; color: var(--muted); }
.legend b { color: var(--c); }
</style>
