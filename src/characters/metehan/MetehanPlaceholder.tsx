import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { useKeyboard } from '../../hooks/useKeyboard'
import { useTouchControls } from '../../hooks/useTouchControls'
import { isPlaying, simDelta, world } from '../../sim/world'
import { HILAL_CONFIG } from '../../mechanics/hilalSystem'
import { ENEMY_CONFIG } from '../../mechanics/enemySim'
import { buildHorseGeometry, buildRiderGeometry } from '../riderGeometry'

// Metehan'ın gerçek 3D modeli gelene kadar ilkel şekillerden süvari
// (bkz. riderGeometry). Simülasyon sırası: oyuncu (0) → düşmanlar (1) → yönetmen (2).
const PLAYER_PRIORITY = 0

/** Dörtnal: düşmanlarla aynı ritim, kahraman biraz daha belirgin zıplar. */
const GALLOP_RATE = 9
const GALLOP_BOB = 0.12
const GALLOP_PITCH = 0.07

export function MetehanPlaceholder() {
  const groupRef = useRef<Group>(null)
  const bodyRef = useRef<Group>(null)
  const keys = useKeyboard()
  const touch = useTouchControls()
  const horse = useMemo(buildHorseGeometry, [])
  const rider = useMemo(() => buildRiderGeometry('hero'), [])

  useFrame(({ clock }, delta) => {
    // Sekme arka plandayken delta şişer ve karakter ışınlanır; hitstop'ta sıfır.
    const dt = simDelta(delta)

    if (!isPlaying()) {
      world.playerVel.x = 0
      world.playerVel.z = 0
      // Menüde de doğru yerde dursun (başlangıç ekranının arkasında görünüyor).
      groupRef.current?.position.set(world.player.x, 0, world.player.z)
      return
    }

    let dx = 0
    let dz = 0
    if (keys.current.has('KeyW') || keys.current.has('ArrowUp')) dz -= 1
    if (keys.current.has('KeyS') || keys.current.has('ArrowDown')) dz += 1
    if (keys.current.has('KeyA') || keys.current.has('ArrowLeft')) dx -= 1
    if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) dx += 1

    // Klavye boştaysa dokunmatik joystick'e bak — iki kaynak birbirini
    // otomatik ezer, ayrı bir "cihaz modu" seçimi gerekmez.
    const usingTouch = dx === 0 && dz === 0 && (touch.x !== 0 || touch.z !== 0)
    if (usingTouch) {
      dx = touch.x
      dz = touch.z
    }

    const len = Math.hypot(dx, dz)
    if (len > 0) {
      if (usingTouch) {
        // Analog: kısmi itiş kısmi hız versin. touch.x/z zaten joystick
        // yarıçapına göre 0–1 normalize; sadece 1'i geçmesin yeter.
        const clampedLen = Math.min(len, 1)
        dx = (dx / len) * clampedLen * HILAL_CONFIG.retreatSpeed
        dz = (dz / len) * clampedLen * HILAL_CONFIG.retreatSpeed
      } else {
        // Klavye dijitaldir, ara değer yok — çapraz hareket hızlı olmasın.
        dx = (dx / len) * HILAL_CONFIG.retreatSpeed
        dz = (dz / len) * HILAL_CONFIG.retreatSpeed
      }
    }

    const prevX = world.player.x
    const prevZ = world.player.z

    world.player.x += dx * dt
    world.player.z += dz * dt
    confinePlayerToArena()

    // Hitstop'ta dt sıfır: hız bölmesi NaN üretmesin, donmuş oyuncu "duruyor".
    if (dt > 0) {
      // Hız, klavye niyetinden değil gerçekleşen yer değiştirmeden türetilir:
      // arena sınırına yaslanıp tuşa basılı tutan oyuncu "kaçıyor" sayılmasın.
      world.playerVel.x = (world.player.x - prevX) / dt
      world.playerVel.z = (world.player.z - prevZ) / dt
    }

    const group = groupRef.current
    const body = bodyRef.current
    if (!group || !body) return
    group.position.set(world.player.x, 0, world.player.z)
    // Hareket varken gidiş yönüne dön.
    if (len > 0) {
      group.rotation.y = Math.atan2(dx, dz)
    }
    // Dörtnal yalnızca gövdede; zemin halkası yerinde kalsın.
    const gait = Math.min(1, Math.hypot(world.playerVel.x, world.playerVel.z) / 3)
    const phase = clock.elapsedTime * GALLOP_RATE
    body.position.y = Math.abs(Math.sin(phase)) * GALLOP_BOB * gait
    body.rotation.x = Math.sin(phase) * GALLOP_PITCH * gait
  }, PLAYER_PRIORITY)

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        <mesh geometry={horse} castShadow>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
        <mesh geometry={rider} castShadow>
          <meshStandardMaterial vertexColors roughness={0.55} metalness={0.15} />
        </mesh>
      </group>
      {/* Zemin halkası: kahraman kalabalığın içinde tek bakışta bulunsun. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.95, 1.15, 40]} />
        <meshBasicMaterial color="#2a9d8f" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  )
}

function confinePlayerToArena() {
  const dist = Math.hypot(world.player.x, world.player.z)
  if (dist <= ENEMY_CONFIG.arenaRadius || dist === 0) return

  const scale = ENEMY_CONFIG.arenaRadius / dist
  world.player.x *= scale
  world.player.z *= scale
}
