import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { play } from '../audio/sfx'
import { useQuality, type QualityTier } from '../perf/quality'
import { newBattleWatch, simDelta, world } from '../sim/world'
import { buildHorseGeometry, buildRiderGeometry } from '../characters/riderGeometry'
import { arrowPose } from './arrowPool'
import {
  MAX_ARCHERS,
  VOLLEY_ARROWS,
  VOLLEY_FLIGHT,
  VOLLEY_RELEASE,
  archerPose,
  isKeyVolley,
  planVolley,
  resetVolley,
  stepVolley,
  volleyArrowVisible,
  volleyFade,
  volley,
  type ArcherPose,
} from './volleyPlan'

// Görsellerle (3): yönetmenin (2) vuruş olayını o karede okur. Sürü (1) düşeni
// bir sonraki karede görür; vuruş karesinde düşen zaten ayakta çizildi.
const VOLLEY_PRIORITY = 3

/** Yaylımdaki okçu; kademe başına. */
const ARCHERS: Record<QualityTier, number> = { high: 14, medium: 10, low: 7 }

/** Mete'nin atlıları: Baideng çemberinin dört donu (HunRing), karışık. */
const COATS = ['#bdb6aa', '#7d8792', '#1c1a18', '#8f3a22'].map((c) => new Color(c))

const GALLOP_RATE = 9
const GALLOP_BOB = 0.1
const GALLOP_PITCH = 0.06
/** Bırakışta gövde geriye yaslanır (rad). */
const RECOIL_PITCH = 0.12

/**
 * Hilal yaylımı (Metehan): VUR'da düşmanın ardında beliren okçular ve okları.
 * Kurallar ve zamanlama volleyPlan.ts'te; burası çizer, ses ve olayları yayar.
 */
export function HilalVolley() {
  const horseRef = useRef<InstancedMesh>(null)
  const riderRef = useRef<InstancedMesh>(null)
  const arrowRef = useRef<InstancedMesh>(null)
  const archers = useQuality((s) => ARCHERS[s.tier])
  const horse = useMemo(() => buildHorseGeometry('tint'), [])
  const rider = useMemo(() => buildRiderGeometry('ally'), [])
  // Belirip silinmek için saydam; tüm okçular aynı anda belirir, tek opaklık yeter.
  const horseMaterial = useMemo(
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, transparent: true }),
    [],
  )
  const riderMaterial = useMemo(
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1, transparent: true }),
    [],
  )
  const arrowGeometry = useMemo(() => new BoxGeometry(0.07, 0.07, 1.1), [])
  // Ok yağmurunun kamışı (ArrowVolley): koyu toprakta seçilsin.
  const arrowMaterial = useMemo(() => new MeshBasicMaterial({ color: '#f3e6c4', toneMapped: false }), [])
  const dummy = useMemo(() => new Object3D(), [])
  const vel = useMemo(() => new Vector3(), [])
  const pose = useMemo<ArcherPose>(() => ({ x: 0, z: 0, heading: 0, gait: 0, recoil: 0 }), [])
  const released = useRef(false)
  const hit = useRef(false)
  const newBattle = useMemo(newBattleWatch, [])

  useLayoutEffect(() => {
    const mesh = horseRef.current
    if (!mesh) return
    for (let k = 0; k < MAX_ARCHERS; k++) mesh.setColorAt(k, COATS[(k * 3) % COATS.length])
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useFrame((_, delta) => {
    const horseMesh = horseRef.current
    const riderMesh = riderRef.current
    const arrowMesh = arrowRef.current
    if (!horseMesh || !riderMesh || !arrowMesh) return
    if (newBattle()) resetVolley(volley)

    for (const ev of world.events) {
      if (ev.type !== 'strike' || !planVolley(volley, ev, world.enemies, archers)) continue
      released.current = false
      hit.current = false
      // Önemli yaylımda kamera iner (CameraDirector); oyun sürmüyorsa yönetmen düşürür.
      volley.cue = isKeyVolley(volley.count, world.enemies)
    }

    const dt = simDelta(delta)
    let landed = 0
    stepVolley(volley, dt, (shot) => {
      if (shot.enemy < 0) return
      landed++
      world.events.push({ type: 'volleyHit', x: shot.arrow.tx, z: shot.arrow.tz })
    })
    if (volley.active && !released.current && volley.t >= VOLLEY_RELEASE) {
      released.current = true
      play('volley', 1)
    }
    if (landed > 0 && !hit.current) {
      hit.current = true
      play('volleyHit', Math.min(1, landed / 6))
    }

    const fade = volleyFade(volley)
    horseMaterial.opacity = fade
    riderMaterial.opacity = fade
    // Saydam yüzeyler derinlik yazmazsa atlılar birbirinin içinden görünür;
    // tam görünürken opak gibi çizilsin.
    horseMaterial.depthWrite = riderMaterial.depthWrite = fade >= 1
    const n = fade > 0 ? volley.archers : 0
    const time = world.animTime
    for (let k = 0; k < n; k++) {
      archerPose(volley, k, pose)
      const phase = time * GALLOP_RATE + k * 1.3
      dummy.position.set(pose.x, Math.abs(Math.sin(phase)) * GALLOP_BOB * pose.gait, pose.z)
      dummy.rotation.set(Math.sin(phase) * GALLOP_PITCH * pose.gait - pose.recoil * RECOIL_PITCH, pose.heading, 0)
      dummy.updateMatrix()
      horseMesh.setMatrixAt(k, dummy.matrix)
      riderMesh.setMatrixAt(k, dummy.matrix)
    }
    horseMesh.count = n
    riderMesh.count = n
    horseMesh.instanceMatrix.needsUpdate = true
    riderMesh.instanceMatrix.needsUpdate = true

    let m = 0
    for (let s = 0; s < volley.shotCount; s++) {
      const shot = volley.shots[s]
      if (!volleyArrowVisible(volley, shot)) continue
      arrowPose(shot.arrow, dummy.position, vel, VOLLEY_FLIGHT)
      dummy.lookAt(vel.add(dummy.position))
      dummy.updateMatrix()
      arrowMesh.setMatrixAt(m++, dummy.matrix)
    }
    arrowMesh.count = m
    arrowMesh.instanceMatrix.needsUpdate = true
  }, VOLLEY_PRIORITY)

  return (
    <>
      <instancedMesh ref={horseRef} args={[horse, horseMaterial, MAX_ARCHERS]} castShadow frustumCulled={false} />
      <instancedMesh ref={riderRef} args={[rider, riderMaterial, MAX_ARCHERS]} castShadow frustumCulled={false} />
      <instancedMesh ref={arrowRef} args={[arrowGeometry, arrowMaterial, VOLLEY_ARROWS]} frustumCulled={false} />
    </>
  )
}
