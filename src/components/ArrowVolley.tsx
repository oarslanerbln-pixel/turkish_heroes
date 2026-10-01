import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { useQuality } from '../perf/quality'
import type { QualityTier } from '../perf/quality'
import { play } from '../audio/sfx'
import type { BattleState } from '../mechanics/corps'
import { wingHarass, type WingState } from '../mechanics/wings'
import { simDelta, world } from '../sim/world'
import { terrainHeight } from './world/terrainShape'

// Ok yağmuru: taciz edilen birliğe okçularından yay çizen oklar.
// Taciz mekaniğin çekirdeği ama kendi başına görünmez bir sayı (düzen düşüşü);
// oklar onu sahnede anlatır: "şu an şu birliği vuruyorsun". Yoğunluk taciz
// şiddetini izler — yakın menzil sık yağmur, menzilin ucu seyrek.
// Şiddet oyuncudan ve kollardan toplanır; her ok kendi payının okçusundan
// kalkar: kolun vurduğu birliğe oklar oyuncudan değil, kolun atlılarından uçar.
// Havuzlu, tek örneklenmiş mesh; ok sayısı kademeyle ölçeklenir.

const VISUAL_PRIORITY = 3

/** Tam şiddette saniyede atılan ok; kademe başına. */
const RATE: Record<QualityTier, number> = { high: 14, medium: 9, low: 5 }
const POOL = 64
/** Okun havada kalma süresi (sn) ve yayın tepe yüksekliği. */
const FLIGHT = 0.75
const ARC = 3.2
/** Ok vızıltısı en fazla bu sıklıkta çalar (sn). */
const VOLLEY_SOUND_INTERVAL = 0.7
/** Kol okları tek noktadan değil atlıların arasından kalksın: kol merkezi çevresinde saçılma. */
const WING_SPREAD = 5

interface Arrow {
  age: number
  sx: number
  /** Atışın yapıldığı zemin yüksekliği: geçitte kollar yamaçta. */
  sy: number
  sz: number
  tx: number
  tz: number
}

export function ArrowVolley() {
  const ref = useRef<InstancedMesh>(null)
  const rate = useQuality((s) => RATE[s.tier])
  const geometry = useMemo(() => new BoxGeometry(0.07, 0.07, 1.1), [])
  // Açık kamış rengi: koyu ok kahverengi toprakta kayboluyordu.
  const material = useMemo(() => new MeshBasicMaterial({ color: '#f3e6c4', toneMapped: false }), [])
  const arrows = useMemo<Arrow[]>(
    () => Array.from({ length: POOL }, () => ({ age: FLIGHT, sx: 0, sy: 0, sz: 0, tx: 0, tz: 0 })),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])
  const budget = useRef(0)
  const soundTimer = useRef(0)
  const next = useRef(0)

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = simDelta(delta)
    const b = world.battle

    // Yeni oklar: taciz edilen her birliğe şiddetiyle orantılı.
    if (b && world.outcome === 'playing' && world.started && dt > 0) {
      let strongest = 0
      b.corps.forEach((c, ci) => {
        if (c.harass <= 0) return
        strongest = Math.max(strongest, c.harass)
        budget.current += rate * c.harass * dt
        // Şiddetin kollardan gelen payı; bu paydaki oklar kolun atlılarından kalkar.
        const fromWings = Math.min(c.harass, c.wingHarass)
        while (budget.current >= 1) {
          budget.current -= 1
          const target = pickSoldier(ci)
          if (!target) break
          const wing = Math.random() * c.harass < fromWings ? pickWing(b, ci) : null
          const a = arrows[next.current]
          next.current = (next.current + 1) % POOL
          a.age = 0
          if (wing) {
            a.sx = wing.pos.x + (Math.random() - 0.5) * WING_SPREAD
            a.sz = wing.pos.z + (Math.random() - 0.5) * WING_SPREAD
            a.sy = b.layout.pass ? terrainHeight(a.sx, a.sz, true) : 0
          } else {
            a.sx = world.player.x
            a.sz = world.player.z
            a.sy = 0
          }
          // Hedefin çevresine saçılsın: tek noktaya düşen oklar çizgi gibi görünür.
          a.tx = target.x + (Math.random() - 0.5) * 2.2
          a.tz = target.z + (Math.random() - 0.5) * 2.2
        }
      })
      soundTimer.current -= dt
      if (strongest > 0 && soundTimer.current <= 0) {
        play('volley', strongest)
        soundTimer.current = VOLLEY_SOUND_INTERVAL
      }
    }

    let n = 0
    for (const a of arrows) {
      if (a.age >= FLIGHT) continue
      a.age += dt
      const t = Math.min(1, a.age / FLIGHT)
      const x = a.sx + (a.tx - a.sx) * t
      const z = a.sz + (a.tz - a.sz) * t
      // Atış zemininden hedef zeminine (0) iner.
      const y = a.sy * (1 - t) + 1.6 + 4 * ARC * t * (1 - t) - 1.2 * t
      // Yay teğeti: ok uçuş yönüne baksın, tepede yatay, sonda aşağı.
      const vy = -a.sy + 4 * ARC * (1 - 2 * t) - 1.2
      dummy.position.set(x, y, z)
      dummy.lookAt(x + (a.tx - a.sx) / FLIGHT, y + vy / FLIGHT, z + (a.tz - a.sz) / FLIGHT)
      dummy.updateMatrix()
      mesh.setMatrixAt(n++, dummy.matrix)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }, VISUAL_PRIORITY)

  return (
    <instancedMesh ref={ref} args={[geometry, material, POOL]} frustumCulled={false} />
  )
}

/** Birliğin rastgele bir askeri (yoksa null). */
function pickSoldier(corps: number): { x: number; z: number } | null {
  let count = 0
  for (const e of world.enemies) if (e.alive && e.corps === corps) count++
  if (count === 0) return null
  let k = Math.floor(Math.random() * count)
  for (const e of world.enemies) {
    if (!e.alive || e.corps !== corps) continue
    if (k-- === 0) return e.pos
  }
  return null
}

/** Birliği vuran kollardan biri, vuruş payıyla orantılı (yoksa null). */
function pickWing(b: BattleState, corps: number): WingState | null {
  let total = 0
  for (const w of b.wings) if (w.target === corps) total += wingHarass(w)
  let k = Math.random() * total
  for (const w of b.wings) {
    if (w.target !== corps) continue
    k -= wingHarass(w)
    if (k < 0) return w
  }
  return null
}
