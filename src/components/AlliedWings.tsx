import { useEffect, useMemo, useRef } from 'react'
import { terrainHeight } from './world/terrainShape'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import type { BattleState } from '../mechanics/corps'
import { WING_CONFIG, type WingState } from '../mechanics/wings'
import { simDelta, world } from '../sim/world'
import { buildHorseGeometry, buildRiderGeometry } from '../characters/riderGeometry'
import { applyNearFade } from './world/nearFade'

// Selçuklu kolları sahada: her kol bir avuç atlı okçu.
//
// Simülasyon kolu tek nokta olarak yürütüyor (wings.ts); süvariler o noktanın
// çevresinde emre göre dizilir ve yerlerine yumuşakça akar — emir değişince
// düzenin nasıl çözülüp yeniden kurulduğu görünsün:
//   - PUSU: iki sıra, düşmana dönük, kıpırtısız.
//   - TACİZ: dönen halka — atlı okçunun "dolaşarak ok atma"sı.
//   - HÜCUM: uçları öne çıkmış hilal, hedef birliğe dönük; kol yerine
//     vardıkça birliğin yanına gömülür.

const VISUAL_PRIORITY = 3
const RIDERS = WING_CONFIG.riders
const COUNT = RIDERS * 2

/** Süvarinin yerine akma hızı (1/sn) ve yön dönüş hızı. */
const FOLLOW_RATE = 3
const TURN_RATE = 6
/** Bunun üstünde hareket eden süvari gittiği yöne bakar (birim/sn). */
const MOVING = 0.6

/** Pusu: iki sıra. */
const AMBUSH_COLS = RIDERS / 2
const AMBUSH_GAP = 1.5
const AMBUSH_ROW = 1.8
/** Taciz halkası: yarıçap ve dönüş hızı (rad/sn). */
const RING_RADIUS = 3.2
const RING_SPEED = 0.9
/** Hücum hilali: süvari aralığı, uçların öne çıkması, birliğe gömülme. */
const CHARGE_GAP = 1.4
const CHARGE_HORN = 0.3
const CHARGE_PUSH = 2.5

/** Ordugah kameraya yakın: pusudaki kol da onunla aynı mesafede incelir (bkz. Camp). */
const FADE_NEAR = 20
const FADE_FAR = 23

/** Dörtnal — EnemySwarm ile aynı. */
const GALLOP_RATE = 9
const GALLOP_BOB = 0.1
const GALLOP_PITCH = 0.06

interface Slot {
  x: number
  z: number
  /** Dururken bakacağı yön (rotation.y). */
  facing: number
}

/** Yerel (yana, öne) ofseti kolun bakış yönüne çevirip ekler. */
function place(w: WingState, facing: number, side: number, forward: number, out: Slot): void {
  const cos = Math.cos(facing)
  const sin = Math.sin(facing)
  out.x = w.pos.x + side * cos + forward * sin
  out.z = w.pos.z - side * sin + forward * cos
  out.facing = facing
}

function slotFor(b: BattleState, w: WingState, i: number, time: number, out: Slot): void {
  if (w.order === 'harass') {
    const angle = w.side * time * RING_SPEED + (i / RIDERS) * Math.PI * 2
    out.x = w.pos.x + Math.cos(angle) * RING_RADIUS
    out.z = w.pos.z + Math.sin(angle) * RING_RADIUS
    // Halkada teğet yönü: yürüdüğü yöne bakar (hareket yönü zaten bunu verir).
    out.facing = Math.atan2(-Math.sin(angle) * w.side, Math.cos(angle) * w.side)
    return
  }
  if (w.order === 'charge') {
    const target = w.target >= 0 ? b.corps[w.target].anchor : null
    // Hedef yoksa kolun iç yanına (ordunun olduğu tarafa) döner.
    const facing = target
      ? Math.atan2(target.x - w.pos.x, target.z - w.pos.z)
      : Math.atan2(-w.side, 0)
    const k = i - (RIDERS - 1) / 2
    place(w, facing, k * CHARGE_GAP, Math.abs(k) * CHARGE_HORN + w.presence * CHARGE_PUSH, out)
    return
  }
  // Pusu: ordunun geldiği yöne (−z) bakan iki sıra.
  const col = i % AMBUSH_COLS
  const row = Math.floor(i / AMBUSH_COLS)
  place(w, Math.PI, (col - (AMBUSH_COLS - 1) / 2) * AMBUSH_GAP, -row * AMBUSH_ROW, out)
}

/** En kısa yoldan açı yaklaştırma. */
function turnToward(from: number, to: number, t: number): number {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + d * t
}

export function AlliedWings() {
  const horseRef = useRef<InstancedMesh>(null)
  const riderRef = useRef<InstancedMesh>(null)
  const horse = useMemo(buildHorseGeometry, [])
  const rider = useMemo(() => buildRiderGeometry('ally'), [])
  const [horseMaterial, riderMaterial] = useMemo(() => {
    const h = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
    const r = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 })
    applyNearFade(h, FADE_NEAR, FADE_FAR)
    applyNearFade(r, FADE_NEAR, FADE_FAR)
    return [h, r]
  }, [])
  useEffect(
    () => () => {
      horse.dispose()
      rider.dispose()
      horseMaterial.dispose()
      riderMaterial.dispose()
    },
    [horse, rider, horseMaterial, riderMaterial],
  )

  // Yalnızca çizim durumu: süvarinin konumu, yönü ve hızı.
  const pos = useMemo(() => new Float32Array(COUNT * 2), [])
  const heading = useMemo(() => new Float32Array(COUNT), [])
  const speed = useMemo(() => new Float32Array(COUNT), [])
  const dummy = useMemo(() => new Object3D(), [])
  const slot = useMemo<Slot>(() => ({ x: 0, z: 0, facing: 0 }), [])
  const lastBattle = useRef<BattleState | null>(null)
  const clock = useRef(0)

  useFrame(({ clock: frameClock }, delta) => {
    const horseMesh = horseRef.current
    const riderMesh = riderRef.current
    if (!horseMesh || !riderMesh) return
    const b = world.battle
    if (!b) {
      horseMesh.count = 0
      riderMesh.count = 0
      lastBattle.current = null
      return
    }
    horseMesh.count = COUNT
    riderMesh.count = COUNT

    const dt = simDelta(delta)
    clock.current += dt
    // Yeni savaş: süvariler yerlerinde başlar, ordugahtan kayarak gelmesin.
    const snap = lastBattle.current !== b
    if (snap) {
      lastBattle.current = b
      clock.current = 0
    }
    const follow = 1 - Math.exp(-FOLLOW_RATE * dt)
    const turn = 1 - Math.exp(-TURN_RATE * dt)
    const time = frameClock.elapsedTime

    for (let n = 0; n < COUNT; n++) {
      const w = b.wings[n < RIDERS ? 0 : 1]
      const i = n % RIDERS
      slotFor(b, w, i, clock.current, slot)

      let x = pos[n * 2]
      let z = pos[n * 2 + 1]
      if (snap) {
        x = slot.x
        z = slot.z
        heading[n] = slot.facing
        speed[n] = 0
      } else {
        const nx = x + (slot.x - x) * follow
        const nz = z + (slot.z - z) * follow
        const moved = Math.hypot(nx - x, nz - z)
        // dt sıfırken (mola, hitstop) hız korunur: at donar, yürüyüşü değil.
        if (dt > 0) speed[n] = moved / dt
        const face = speed[n] > MOVING ? Math.atan2(nx - x, nz - z) : slot.facing
        heading[n] = turnToward(heading[n], face, turn)
        x = nx
        z = nz
      }
      pos[n * 2] = x
      pos[n * 2 + 1] = z

      const gait = Math.min(1, speed[n] / 3)
      const phase = time * GALLOP_RATE + n * 1.3
      // Geçitte kollar yamaçta: süvari duvarın üstünde durur.
      const ground = b.layout.pass ? terrainHeight(x, z, true) : 0
      dummy.position.set(x, ground + Math.abs(Math.sin(phase)) * GALLOP_BOB * gait, z)
      dummy.rotation.set(Math.sin(phase) * GALLOP_PITCH * gait, heading[n], 0)
      dummy.updateMatrix()
      horseMesh.setMatrixAt(n, dummy.matrix)
      riderMesh.setMatrixAt(n, dummy.matrix)
    }
    horseMesh.instanceMatrix.needsUpdate = true
    riderMesh.instanceMatrix.needsUpdate = true
  }, VISUAL_PRIORITY)

  return (
    <>
      {/* Her kare hareket ediyorlar: otomatik frustum culling yanıltır (bkz. EnemySwarm). */}
      <instancedMesh
        ref={horseRef}
        args={[horse, horseMaterial, COUNT]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={riderRef}
        args={[rider, riderMaterial, COUNT]}
        castShadow
        frustumCulled={false}
      />
    </>
  )
}
