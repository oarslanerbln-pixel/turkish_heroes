import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MeshStandardMaterial } from 'three'
import { isPlaying, world } from '../../sim/world'
import { buildHorseGeometry, buildRiderGeometry } from '../riderGeometry'
import { applyUnitShading } from '../../components/world/unitShading'
import {
  CONTACT_SHADOW_ORDER,
  CONTACT_SHADOW_SCALE,
  contactShadowGeometry,
  contactShadowMaterial,
} from '../../components/world/contactShadow'
import { hoofbeat } from '../../audio/ambience'

// Metehan'ın gerçek 3D modeli gelene kadar ilkel şekillerden süvari
// (bkz. riderGeometry). Yalnız çizer: konumu yönetmenin adımı (öncelik -1) yazar.
const PLAYER_PRIORITY = 0

/** Dörtnal: düşmanlarla aynı ritim, kahraman biraz daha belirgin zıplar. */
const GALLOP_RATE = 9
const GALLOP_BOB = 0.12
const GALLOP_PITCH = 0.07
/** Bunun altındaki adımda (dönüş, yavaşlama) nal sesi çalmaz. */
const HOOF_MIN_GAIT = 0.25
/** Bundan yavaşken (sınıra yaslanmış, duruyor) yönünü korur (birim/sn). */
const TURN_MIN_SPEED = 0.1

export function MetehanPlaceholder() {
  const groupRef = useRef<Group>(null)
  const bodyRef = useRef<Group>(null)
  const strideRef = useRef(0)
  const horse = useMemo(() => buildHorseGeometry('hero'), [])
  const rider = useMemo(() => buildRiderGeometry('hero'), [])
  const [horseMaterial, riderMaterial] = useMemo(() => {
    const h = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
    const r = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 })
    applyUnitShading(h)
    applyUnitShading(r)
    return [h, r]
  }, [])

  useFrame(() => {
    if (!isPlaying()) {
      // Menüde de doğru yerde dursun (başlangıç ekranının arkasında görünüyor).
      groupRef.current?.position.set(world.player.x, 0, world.player.z)
      return
    }

    const group = groupRef.current
    const body = bodyRef.current
    if (!group || !body) return
    group.position.set(world.player.x, 0, world.player.z)
    // Hareket varken gidiş yönüne dön.
    const speed = Math.hypot(world.playerVel.x, world.playerVel.z)
    if (speed > TURN_MIN_SPEED) {
      group.rotation.y = Math.atan2(world.playerVel.x, world.playerVel.z)
    }
    // Dörtnal yalnızca gövdede; zemin halkası yerinde kalsın.
    const gait = Math.min(1, speed / 3)
    const phase = world.animTime * GALLOP_RATE
    body.position.y = Math.abs(Math.sin(phase)) * GALLOP_BOB * gait
    body.rotation.x = Math.sin(phase) * GALLOP_PITCH * gait
    // Nal sesi görünen adımla aynı ritimde: her dörtnal döngüsünde bir adım.
    const stride = Math.floor(phase / (Math.PI * 2))
    if (stride !== strideRef.current) {
      strideRef.current = stride
      if (gait > HOOF_MIN_GAIT) hoofbeat(gait)
    }
  }, PLAYER_PRIORITY)

  return (
    <group ref={groupRef}>
      {/* Görsel temel ölçümü yalnız binici ve atı sayar, zemin halkasını değil (bkz. ArtProbe). */}
      <group ref={bodyRef} userData={{ unit: 'player' }}>
        <mesh geometry={horse} material={horseMaterial} castShadow />
        <mesh geometry={rider} material={riderMaterial} castShadow />
      </group>
      {/* Temas gölgesi gövdeyle zıplamaz, yerde kalır. */}
      <mesh
        geometry={contactShadowGeometry()}
        material={contactShadowMaterial()}
        scale={CONTACT_SHADOW_SCALE}
        renderOrder={CONTACT_SHADOW_ORDER}
      />
      {/* Zemin halkası: kahraman kalabalığın içinde tek bakışta bulunsun. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.95, 1.15, 40]} />
        <meshBasicMaterial color="#2a9d8f" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  )
}
