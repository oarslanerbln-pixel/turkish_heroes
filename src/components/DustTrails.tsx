import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, InstancedMesh, MeshLambertMaterial, Object3D, PlaneGeometry } from 'three'
import { useQuality } from '../perf/quality'
import type { QualityTier } from '../perf/quality'
import { ENEMY_CAPACITY } from '../mechanics/scenario'
import type { Vec2 } from '../mechanics/types'
import { isPlaying, newBattleWatch, simDelta, world } from '../sim/world'
import { WIND_DIR, WIND_DRIFT_CALM, WIND_DRIFT_GUST, windGust } from './world/wind'

// Bozkır tozu: dörtnala kalkan süvarilerin ardında toz bulutu, sert esintide
// yerde kayan toz perdesi. Hareketi ve rüzgârı sahnede anlatır: hamleye kalkan
// birlik tozundan okunur. Havuzlu, tek örneklenmiş mesh; yumuşak kenarlı
// düzlemler (köşeli çokyüzlüler toz değil taş gibi okunuyordu — ekran
// görüntüsüyle görüldü). Bulutlar kameraya bakar, perdeler yere yatar. Işığı
// alan malzeme: gün batımında toz da kızarır. Düşük kademede yok, çimen gibi.

const VISUAL_PRIORITY = 3

/** Tam dörtnalda süvari başına saniyede toz bulutu. */
const TRAIL_RATE: Record<QualityTier, number> = { high: 10, medium: 6, low: 0 }
/** Tam esintide saniyede kalkan toz perdesi. */
const WISP_RATE: Record<QualityTier, number> = { high: 4, medium: 2, low: 0 }
/** Kalabalık bir hamlede taşarsa en eski bulut yeniden kullanılır. */
const POOL = 512

/** Bu hızın altında at tırısta, toz kalkmaz; tam dörtnalda en yoğun. */
const DUST_MIN_SPEED = 1.5
const DUST_FULL_SPEED = 6
/** Bulutun doğduğu yer: toynaklar, gövdenin bu kadar gerisinde. */
const HOOF_BACK = 0.9
const TRAIL_LIFE = 1
const TRAIL_SIZE = 1.1
/** Oyuncunun tozu biraz daha iri: gözün izlediği süvari o. */
const PLAYER_SIZE = 1.4
/** Toz perdesi bu esintinin üstünde kalkar. */
const WISP_FROM_GUST = 0.45
const WISP_LIFE = 3
/**
 * Perdelerin doğduğu disk: görüş alanının ortası (kamera oyuncunun arkasından
 * ileri, −z'ye bakıyor) biraz rüzgârın üst tarafına kaydırılmış, ki perdeler
 * görüş alanına doğru sürüklensin. Oyuncu merkezli diskte yarısı kameranın
 * altında, görünmeyen yerde doğuyordu.
 */
const WISP_RADIUS = 14
const WISP_AHEAD = 6
const WISP_UPWIND = 5
/** Tekmelenen tozun hızı rüzgârın hızına bu oranla (1/sn) yaklaşır. */
const DRAG = 2.5
/** Perdenin yere yattığı yön: uzun kenarı rüzgâr boyunca. */
const WIND_YAW = Math.atan2(WIND_DIR.x, WIND_DIR.z)

interface Puff {
  age: number
  life: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  /** Perde: yere yatık ve rüzgâr boyunca uzun. Değilse kameraya bakan bulut. */
  ground: boolean
}

export function DustTrails() {
  const trailRate = useQuality((s) => TRAIL_RATE[s.tier])
  if (trailRate === 0) return null
  return <DustPool />
}

function DustPool() {
  const ref = useRef<InstancedMesh>(null)
  const trailRate = useQuality((s) => TRAIL_RATE[s.tier])
  const wispRate = useQuality((s) => WISP_RATE[s.tier])
  const geometry = useMemo(() => new PlaneGeometry(1, 1), [])
  const material = useMemo(
    () =>
      new MeshLambertMaterial({
        color: '#d2b283',
        alphaMap: softDisc(),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    [],
  )
  const puffs = useMemo<Puff[]>(
    () =>
      Array.from({ length: POOL }, () => ({
        age: 1,
        life: 1,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0,
        ground: false,
      })),
    [],
  )
  // Süvari başına biriken toz: 0 oyuncu, i + 1 düşman. Rastgele başlasın ki
  // aynı hızdaki süvariler aynı karede toz kaldırmasın.
  const budgets = useMemo(
    () => Float32Array.from({ length: ENEMY_CAPACITY + 1 }, () => Math.random()),
    [],
  )
  const wispBudget = useRef(0)
  const next = useRef(0)
  const newBattle = useMemo(newBattleWatch, [])
  const dummy = useMemo(() => new Object3D(), [])

  useFrame(({ clock, camera }, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = simDelta(delta)
    if (newBattle()) for (const p of puffs) p.age = p.life
    const gust = windGust(clock.elapsedTime, world.player.x, world.player.z)
    const drift = WIND_DRIFT_CALM + WIND_DRIFT_GUST * gust
    const windX = WIND_DIR.x * drift
    const windZ = WIND_DIR.z * drift

    const spawn = (): Puff => {
      const p = puffs[next.current]
      next.current = (next.current + 1) % POOL
      p.age = 0
      return p
    }

    const trail = (k: number, pos: Vec2, vel: Vec2, size: number) => {
      const speed = Math.hypot(vel.x, vel.z)
      const gait = Math.min(1, (speed - DUST_MIN_SPEED) / (DUST_FULL_SPEED - DUST_MIN_SPEED))
      if (gait <= 0) return
      budgets[k] += trailRate * gait * dt
      const dx = vel.x / speed
      const dz = vel.z / speed
      while (budgets[k] >= 1) {
        budgets[k] -= 1
        const p = spawn()
        const side = (Math.random() - 0.5) * 0.8
        p.life = TRAIL_LIFE * (0.8 + 0.4 * Math.random())
        p.x = pos.x - dx * HOOF_BACK + dz * side
        p.z = pos.z - dz * HOOF_BACK - dx * side
        p.y = 0.3
        // Toynaktan geriye ve yukarı tekmelenir, sonra rüzgâra kapılır.
        p.vx = -dx * speed * 0.25
        p.vz = -dz * speed * 0.25
        p.vy = 0.4 + 0.3 * Math.random()
        p.size = size * (0.7 + 0.6 * Math.random())
        p.ground = false
      }
    }

    if (isPlaying() && dt > 0) {
      trail(0, world.player, world.playerVel, PLAYER_SIZE)
      const n = Math.min(world.enemies.length, ENEMY_CAPACITY)
      for (let i = 0; i < n; i++) {
        const e = world.enemies[i]
        if (e.alive) trail(i + 1, e.pos, e.vel, TRAIL_SIZE)
      }

      // Toz perdesi: yalnızca sert esintide, oyuncunun çevresinde yerden kalkar.
      const strength = (gust - WISP_FROM_GUST) / (1 - WISP_FROM_GUST)
      if (strength > 0) {
        wispBudget.current += wispRate * strength * dt
        while (wispBudget.current >= 1) {
          wispBudget.current -= 1
          const p = spawn()
          const a = Math.random() * Math.PI * 2
          const r = WISP_RADIUS * Math.sqrt(Math.random())
          p.life = WISP_LIFE * (0.8 + 0.4 * Math.random())
          p.x = world.player.x - WIND_DIR.x * WISP_UPWIND + Math.cos(a) * r
          p.z = world.player.z - WISP_AHEAD - WIND_DIR.z * WISP_UPWIND + Math.sin(a) * r
          p.y = 0.15
          p.vx = windX * 1.5
          p.vz = windZ * 1.5
          p.vy = 0
          p.size = 2.5 + 1.5 * Math.random()
          p.ground = true
        }
      }
    }

    const relax = 1 - Math.exp(-DRAG * dt)
    let live = 0
    for (const p of puffs) {
      if (p.age >= p.life) continue
      p.age += dt
      const u = Math.min(1, p.age / p.life)
      p.vx += (windX - p.vx) * relax
      p.vz += (windZ - p.vz) * relax
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      // Hızla kabarır, yavaşça dağılır: tepe ömrün dörtte birinde.
      const s = p.size * Math.sin(Math.PI * Math.sqrt(u))
      dummy.position.set(p.x, p.y, p.z)
      if (p.ground) {
        dummy.rotation.set(-Math.PI / 2, WIND_YAW, 0, 'YXZ')
        dummy.scale.set(s * 0.8, s * 2.4, 1)
      } else {
        dummy.quaternion.copy(camera.quaternion)
        dummy.scale.set(s, s * 0.8, 1)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(live++, dummy.matrix)
    }
    mesh.count = live
    mesh.instanceMatrix.needsUpdate = true
  }, VISUAL_PRIORITY)

  return <instancedMesh ref={ref} args={[geometry, material, POOL]} frustumCulled={false} />
}

/** Ortası dolu, kenarı sıfıra inen yuvarlak alfa dokusu (alphaMap yeşil kanalı okur). */
function softDisc(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, '#fff')
  grad.addColorStop(0.4, '#999')
  grad.addColorStop(1, '#000')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}
