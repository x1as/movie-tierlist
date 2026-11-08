// Неоновый 3D-фон: бесконечная сетка-пол, парящие каркасные многогранники, звёздная пыль, bloom.
// Рендер на GPU в отдельном слое — не влияет на вёрстку и перетаскивание.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const NEON = [0xff2bd6, 0x22e4ff, 0x8b5cff, 0xb6ff3b, 0xff7a1a]

export function startScene(canvas: HTMLCanvasElement) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  const dpr = Math.min(window.devicePixelRatio, 1.25)
  renderer.setPixelRatio(dpr)
  renderer.setClearColor(0x000000)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x020108, 0.05)
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120)
  camera.position.set(0, 2.2, 9)

  // ── сетка-пол ──
  const grid = new THREE.Group()
  const lines = (color: number, step: number, size: number, opacity: number) => {
    const pts: number[] = []
    for (let i = -size; i <= size; i += step) {
      pts.push(-size, 0, i, size, 0, i)
      pts.push(i, 0, -size, i, 0, size)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }))
  }
  grid.add(lines(0x6b45d9, 1, 60, 0.32))
  const major = lines(0xff2bd6, 5, 60, 0.75)
  major.position.y = 0.002
  grid.add(major)
  grid.position.y = -2.4
  scene.add(grid)

  // ── зарево за горизонтом: мягкая неоновая туманность из градиентной текстуры ──
  const glowTex = (stops: [number, string][]) => {
    const c = document.createElement('canvas')
    c.width = 512; c.height = 256
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(256, 256, 0, 256, 256, 256)
    for (const [o, col] of stops) r.addColorStop(o, col)
    g.fillStyle = r
    g.fillRect(0, 0, 512, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const glow = (tex: THREE.Texture, w: number, h: number, pos: [number, number, number], opacity: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    )
    m.position.set(...pos)
    scene.add(m)
    return m
  }
  const pinkGlow = glowTex([[0, 'rgba(255,60,200,1)'], [0.35, 'rgba(160,60,255,.55)'], [0.7, 'rgba(60,20,140,.18)'], [1, 'rgba(0,0,0,0)']])
  const cyanGlow = glowTex([[0, 'rgba(40,230,255,.9)'], [0.4, 'rgba(60,90,255,.35)'], [1, 'rgba(0,0,0,0)']])
  const horizon = glow(pinkGlow, 150, 34, [0, -2.4 + 17, -50], 0.75)
  glow(cyanGlow, 70, 26, [-34, -2.4 + 13, -52], 0.4)
  glow(pinkGlow, 60, 24, [38, -2.4 + 12, -54], 0.3)
  // тонкая линия горизонта
  const line = new THREE.Mesh(new THREE.PlaneGeometry(160, 0.08), new THREE.MeshBasicMaterial({ color: 0xffb6f0, fog: false }))
  line.position.set(0, -2.38, -49.5)
  scene.add(line)

  // ── многогранники ──
  type Shape = { mesh: THREE.Object3D; spin: THREE.Vector3; base: THREE.Vector3; phase: number }
  const shapes: Shape[] = []
  const makeShape = (geo: THREE.BufferGeometry, color: number, pos: [number, number, number], scale: number) => {
    const g = new THREE.Group()
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }))
    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.025, depthWrite: false }))
    g.add(fill, edges)
    g.scale.setScalar(scale)
    g.position.set(...pos)
    scene.add(g)
    shapes.push({ mesh: g, spin: new THREE.Vector3(Math.random() * 0.3 + 0.1, Math.random() * 0.4 + 0.15, Math.random() * 0.2), base: g.position.clone(), phase: Math.random() * 6 })
  }
  makeShape(new THREE.IcosahedronGeometry(1, 1), NEON[0], [-6.5, 2.2, -6], 2.1)
  makeShape(new THREE.OctahedronGeometry(1, 0), NEON[1], [6.8, 3.4, -8], 1.9)
  makeShape(new THREE.TorusGeometry(1, 0.32, 10, 28), NEON[2], [2.8, 4.8, -14], 2.6)
  makeShape(new THREE.DodecahedronGeometry(1, 0), NEON[3], [-3.2, 5.6, -18], 2.2)
  makeShape(new THREE.TetrahedronGeometry(1, 0), NEON[4], [9.5, 0.6, -4], 1.1)
  makeShape(new THREE.BoxGeometry(1, 1, 1), NEON[1], [-10, 0.4, -10], 1.4)
  makeShape(new THREE.TorusKnotGeometry(0.8, 0.22, 80, 8), NEON[0], [12, 5.5, -20], 1.8)

  // ── звёздная пыль ──
  const N = 900
  const sp = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    sp[i * 3] = (Math.random() - 0.5) * 90
    sp[i * 3 + 1] = Math.random() * 30 - 2
    sp[i * 3 + 2] = -Math.random() * 60 + 8
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfc8ff, size: 0.06, transparent: true, opacity: 0.8 }))
  scene.add(stars)

  // ── bloom ──
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.32, 0.12)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  function resize() {
    const w = window.innerWidth, h = window.innerHeight
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.resolution.set(w * 0.5, h * 0.5)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  // параллакс
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  const onMove = (e: PointerEvent) => { mouse.tx = e.clientX / window.innerWidth - 0.5; mouse.ty = e.clientY / window.innerHeight - 0.5 }
  window.addEventListener('pointermove', onMove, { passive: true })

  const clock = new THREE.Clock()
  let raf = 0
  let running = true
  function frame() {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const t = clock.getElapsedTime()
    grid.position.z = (t * 0.9) % 5
    for (const s of shapes) {
      s.mesh.rotation.x = t * s.spin.x
      s.mesh.rotation.y = t * s.spin.y
      s.mesh.rotation.z = t * s.spin.z
      s.mesh.position.y = s.base.y + Math.sin(t * 0.6 + s.phase) * 0.35
    }
    stars.rotation.y = t * 0.006
    ;(horizon.material as THREE.MeshBasicMaterial).opacity = 0.68 + Math.sin(t * 0.5) * 0.08
    mouse.x += (mouse.tx - mouse.x) * 0.04
    mouse.y += (mouse.ty - mouse.y) * 0.04
    camera.position.x = mouse.x * 1.6
    camera.position.y = 2.2 - mouse.y * 0.8
    camera.lookAt(0, 1.2, -10)
    composer.render()
  }
  if (import.meta.env.DEV) (window as any).__shot = () => { composer.render(); return canvas.toDataURL('image/jpeg', 0.7) }
  if (reduce) composer.render()
  else frame()

  const onVis = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf) }
    else if (!reduce && !running && !held) { running = true; frame() }
  }
  document.addEventListener('visibilitychange', onVis)
  // пауза, когда сцену всё равно не видно (открыта колода карточек)
  let held = false
  const onHold = (e: Event) => {
    held = !!(e as CustomEvent).detail
    if (held) { running = false; cancelAnimationFrame(raf) }
    else if (!reduce && !running && !document.hidden) { running = true; frame() }
  }
  window.addEventListener('kt-scene-hold', onHold)

  return () => {
    running = false
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('kt-scene-hold', onHold)
    renderer.dispose()
  }
}
