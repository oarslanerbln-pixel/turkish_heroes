import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, Object3D, Vector3 } from 'three'
import { useQuality } from '../perf/quality'
import type { QualityTier } from '../perf/quality'
import { play } from '../audio/sfx'
import type { BattleState } from '../mechanics/corps'
import { wingHarass, type WingState } from '../mechanics/wings'
import { newBattleWatch, simDelta, world } from '../sim/world'
import { terrainHeight } from './world/terrainShape'
import { ARROW_FLIGHT, ARROW_POOL, arrowPose, arrows } from './arrowPool'

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
/** Ok vızıltısı en fazla bu sıklıkta çalar (sn). */
const VOLLEY_SOUND_INTERVAL = 0.7
/** Kol okları tek noktadan değil atlıların arasından kalksın: kol merkezi çevresinde saçılma. */
const WING_SPREAD = 5

export function ArrowVolley() {
  const ref = useRef<InstancedMesh>(null)
  const rate = useQuality((s) => RATE[s.tier])
  const geometry = useMemo(() => new BoxGeometry(0.07, 0.07, 1.1), [])
  // Açık kamış rengi: koyu ok kahverengi toprakta kayboluyordu.
  const material = useMemo(() => new MeshBasicMaterial({ color: '#f3e6c4', toneMapped: false }), [])
  const dummy = useMemo(() => new Object3D(), [])
  const vel = useMemo(() => new Vector3(), [])
  const budget = useRef(0)
  const soundTimer = useRef(0)
  const next = useRef(0)
  const newBattle = useMemo(newBattleWatch, [])

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = simDelta(delta)
    const b = world.battle

    if (newBattle()) {
      for (const a of arrows) a.age = ARROW_FLIGHT
      budget.current = 0
    }

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
          const slot = next.current
          const a = arrows[slot]
          next.current = (slot + 1) % ARROW_POOL
          a.age = 0
          a.t0 = world.animTime
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
          world.events.push({
            type: 'arrowReleased',
            slot,
            origin: { x: a.sx, z: a.sz },
            target: { x: a.tx, z: a.tz },
            t0: a.t0,
          })
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
      if (a.age >= ARROW_FLIGHT) continue
      a.age += dt
      arrowPose(a, dummy.position, vel)
      dummy.lookAt(vel.add(dummy.position))
      dummy.updateMatrix()
      mesh.setMatrixAt(n++, dummy.matrix)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }, VISUAL_PRIORITY)

  return (
    <instancedMesh ref={ref} args={[geometry, material, ARROW_POOL]} frustumCulled={false} />
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
