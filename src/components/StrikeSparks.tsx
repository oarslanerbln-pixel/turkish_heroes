import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, InstancedMesh, MeshBasicMaterial, Object3D, Vector3 } from 'three'
import { useQuality } from '../perf/quality'
import type { QualityTier } from '../perf/quality'
import { newBattleWatch, simDelta, world } from '../sim/world'
import { strikeByVolley } from './volleyPlan'

// Yönetmenden (2) sonra: o karenin vuruş olayından düşenlerin konumunu okur.
// Ok yağmurundan (3) sonra: izlenen okun saplanma olayını da.
const VISUAL_PRIORITY = 4

/** Düşen başına kıvılcım; ucuz kademe daha az çizer. */
const PER_KILL: Record<QualityTier, number> = { high: 14, medium: 9, low: 5 }
/** Ok kamerasında saplanan okun kıvılcımı, düşen başınakinin oranı: vuruştan küçük. */
const ARROW_SHARE = 0.6
const ARROW_SPEED = 0.6
/** Havuz: 38 kişilik dalganın tamamı bir vuruşta düşse de yeter. */
const POOL = 540
const LIFE = 0.8
const GRAVITY = 14

interface Spark {
  age: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

/**
 * Vuruşta düşen her süvariden fışkıran altın kıvılcımlar. Oyun hissi
 * rehberinin "başarı görünür olmalı" maddesi: kaç düşmanın düştüğü sayıdan
 * önce gözle okunur. Parlak renk bloom eşiğinin üstünde, kendiliğinden parlar.
 */
export function StrikeSparks() {
  const ref = useRef<InstancedMesh>(null)
  const perKill = useQuality((s) => PER_KILL[s.tier])
  const geometry = useMemo(() => new BoxGeometry(0.06, 0.06, 0.34), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ffd27a',
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  const sparks = useMemo<Spark[]>(
    () => Array.from({ length: POOL }, () => ({ age: LIFE, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })),
    [],
  )
  const cursor = useRef(0)
  const newBattle = useMemo(newBattleWatch, [])
  const dummy = useMemo(() => new Object3D(), [])
  const ahead = useMemo(() => new Vector3(), [])

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return

    if (newBattle()) for (const s of sparks) s.age = LIFE

    const burst = (x: number, z: number, count: number, speed: number) => {
      for (let j = 0; j < count; j++) {
        const s = sparks[cursor.current]
        cursor.current = (cursor.current + 1) % POOL
        const a = Math.random() * Math.PI * 2
        const out = (1.5 + Math.random() * 2.5) * speed
        s.age = 0
        s.x = x
        s.y = 1.2 + Math.random() * 0.6
        s.z = z
        s.vx = Math.cos(a) * out
        s.vz = Math.sin(a) * out
        s.vy = (3 + Math.random() * 5) * speed
      }
    }
    for (const ev of world.events) {
      // Metehan'da düşenler okla düşer: kıvılcım vuruşta değil, ok saplanınca.
      if (ev.type === 'strike' && !strikeByVolley(world)) for (const k of ev.victims) burst(k.x, k.z, perKill, 1)
      else if (ev.type === 'volleyHit') burst(ev.x, ev.z, perKill, 1)
      else if (ev.type === 'arrowLanded') burst(ev.x, ev.z, Math.round(perKill * ARROW_SHARE), ARROW_SPEED)
    }

    // Hitstop'ta sıfır: kıvılcımlar doğdukları yerde asılı kalır, donma bitince saçılır.
    const dt = simDelta(delta)
    let live = 0
    for (const s of sparks) {
      if (s.age >= LIFE) continue
      s.age += dt
      s.vy -= GRAVITY * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.z += s.vz * dt
      if (s.y < 0.05) {
        // Yere çarpınca sönümlenerek seker.
        s.y = 0.05
        s.vy *= -0.3
        s.vx *= 0.6
        s.vz *= 0.6
      }
      dummy.position.set(s.x, s.y, s.z)
      ahead.set(s.x + s.vx, s.y + s.vy, s.z + s.vz)
      dummy.lookAt(ahead)
      dummy.scale.setScalar(Math.max(0, 1 - s.age / LIFE))
      dummy.updateMatrix()
      mesh.setMatrixAt(live++, dummy.matrix)
    }
    mesh.count = live
    mesh.instanceMatrix.needsUpdate = true
  }, VISUAL_PRIORITY)

  return <instancedMesh ref={ref} args={[geometry, material, POOL]} frustumCulled={false} />
}
