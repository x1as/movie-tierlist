<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { decode, encode } from '../lib/codec'
import { loadSnapshot, snapshot, state } from '../lib/store'

const props = defineProps<{ mode: 'export' | 'import' }>()
const emit = defineEmits<{ close: [] }>()
const tab = ref(props.mode)
const code = ref('')
const copied = ref(false)
const input = ref('')
const err = ref('')

async function refresh() { code.value = await encode(snapshot()) }
onMounted(refresh)

async function copy() {
  try { await navigator.clipboard.writeText(code.value) } catch {
    const ta = document.createElement('textarea'); ta.value = code.value; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1800)
}
function download() {
  const blob = new Blob([JSON.stringify(snapshot(), null, 1)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `tierlist-${(state.name || 'my').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
async function doImport() {
  err.value = ''
  try {
    const s = await decode(input.value)
    if (!confirm(`Заменить текущий тирлист на «${s.name || 'без имени'}»?`)) return
    loadSnapshot(s)
    emit('close')
  } catch (e: any) { err.value = e?.message || 'Не получилось прочитать' }
}
async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) input.value = await f.text()
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="modal">
      <button class="x" aria-label="Закрыть" @click="emit('close')">✕</button>
      <div class="tabs">
        <button :class="{ on: tab === 'export' }" @click="tab = 'export'">Выгрузить</button>
        <button :class="{ on: tab === 'import' }" @click="tab = 'import'">Загрузить</button>
      </div>

      <template v-if="tab === 'export'">
        <label class="lbl">Как тебя подписать
          <input v-model="state.name" maxlength="40" placeholder="Например, Лёша" @change="refresh" @blur="refresh" />
        </label>
        <p class="note">Скопируй код и отправь Xias — он сравнит ваши вкусы. Код же можно загрузить обратно на любом устройстве.</p>
        <textarea readonly :value="code" rows="5" @focus="($event.target as HTMLTextAreaElement).select()" />
        <div class="row">
          <button class="btn" @click="copy">{{ copied ? 'Скопировано ✓' : 'Скопировать код' }}</button>
          <button class="ghost" @click="download">Скачать .json</button>
        </div>
      </template>

      <template v-else>
        <p class="note">Вставь код <code>KT1.…</code> или содержимое .json — текущий тирлист заменится.</p>
        <textarea v-model="input" rows="6" placeholder="KT1.…" />
        <div class="row">
          <button class="btn" :disabled="!input.trim()" @click="doImport">Загрузить</button>
          <label class="ghost file">Выбрать файл<input type="file" accept=".json,.txt,application/json" @change="onFile" /></label>
        </div>
        <p v-if="err" class="err">{{ err }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: relative;
  width: min(520px, 100%);
  background: var(--surface-solid); border: 0; border-radius: 26px;
  padding: 22px; box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; gap: 12px;
  animation: pop 0.2s ease;
}
.x { position: absolute; top: 12px; right: 12px; background: none; border: 0; color: var(--muted); font-size: 18px; cursor: pointer; }
.tabs { display: flex; gap: 6px; }
.tabs button { background: none; border: 0; color: var(--muted); font: 700 22px var(--font-display); cursor: pointer; padding: 0 8px 4px 0; border-bottom: 2px solid transparent; }
.tabs button.on { color: var(--text); border-color: var(--accent); }
.lbl { display: flex; flex-direction: column; gap: 6px; font-weight: 700; font-size: 13px; color: var(--muted); }
input, textarea {
  width: 100%; background: var(--bg-2); color: var(--text);
  border: 1px solid var(--line); border-radius: 10px; padding: 10px; font: 600 14px var(--font-body);
}
textarea { font: 12px/1.4 ui-monospace, Consolas, monospace; resize: vertical; word-break: break-all; }
.note { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
.file { position: relative; overflow: hidden; }
.file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.err { color: var(--t-s); margin: 0; font-weight: 700; }
</style>
