import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { useKeyboard } from '../../hooks/useKeyboard'
import { useTouchControls } from '../../hooks/useTouchControls'
import { isPlaying, world } from '../../sim/world'
import { HILAL_CONFIG } from '../../mechanics/hilalSystem'
import { ENEMY_CONFIG } from '../../mechanics/enemySim'

// Metehan'ın gerçek 3D modeli gelene kadar placeholder geometri.
// Simülasyon sırası: oyuncu (0) → düşmanlar (1) → yönetmen (2).
const PLAYER_PRIORITY = 0

export function MetehanPlaceholder() {
  const groupRef = useRef<Group>(null)
  const keys = useKeyboard()
  const touch = useTouchControls()

  useFrame((_, delta) => {
    // Sekme arka plandayken delta şişer ve karakter ışınlanır.
    const dt = Math.min(delta, 0.1)

    if (!isPlaying()) {
      world.playerVel.x = 0
      world.playerVel.z = 0
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

    // Hız, klavye niyetinden değil gerçekleşen yer değiştirmeden türetilir:
    // arena sınırına yaslanıp tuşa basılı tutan oyuncu "kaçıyor" sayılmasın.
    world.playerVel.x = (world.player.x - prevX) / dt
    world.playerVel.z = (world.player.z - prevZ) / dt

    if (!groupRef.current) return
    groupRef.current.position.set(world.player.x, 0, world.player.z)
    // Hareket varken gidiş yönüne dön.
    if (len > 0) {
      groupRef.current.rotation.y = Math.atan2(dx, dz)
    }
  }, PLAYER_PRIORITY)

  return (
    <group ref={groupRef}>
      {/* Gövde */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
        <meshStandardMaterial color="#8b4a00" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Baş */}
      <mesh position={[0, 2.3, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#c8a47a" roughness={0.8} />
      </mesh>
      {/* Yön göstergesi — karakterin baktığı taraf */}
      <mesh position={[0, 1.2, 0.45]} castShadow>
        <boxGeometry args={[0.12, 0.12, 0.5]} />
        <meshStandardMaterial color="#ffd700" roughness={0.4} metalness={0.6} />
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
