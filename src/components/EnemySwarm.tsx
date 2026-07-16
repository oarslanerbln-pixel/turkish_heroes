import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import { stepEnemies } from '../mechanics/enemySim'
import { MAX_WAVE_ENEMIES, waveConfig } from '../mechanics/waves'
import { isPlaying, world } from '../sim/world'

// Simülasyon sırası: oyuncu (0) → düşmanlar (1) → yönetmen (2).
const ENEMY_PRIORITY = 1

// Disiplinli (düzenli) → dağılmış (öfkeli takip) renk geçişi.
const DISCIPLINED_COLOR = new Color('#4a5568')
const BROKEN_COLOR = new Color('#c53030')

export function EnemySwarm() {
  const meshRef = useRef<InstancedMesh>(null)
  // Matris/renk yazarken kullanılan tek seferlik yardımcılar.
  const dummy = useMemo(() => new Object3D(), [])
  const color = useMemo(() => new Color(), [])

  // Renk buffer'ı ilk karede yazılmazsa örnekler siyah görünür.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < MAX_WAVE_ENEMIES; i++) {
      mesh.setColorAt(i, DISCIPLINED_COLOR)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const mesh = meshRef.current
    if (!mesh) return

    // Sonuç ekranında sürü donar, ama çizim world'ü izlemeye devam eder:
    // yeniden başlatıldığında yeni pozisyonlar ilk karede görünür.
    if (isPlaying()) {
      stepEnemies(
        world.enemies,
        world.player,
        dt,
        world.isRetreating,
        waveConfig(world.waveIndex).disciplineRecoveryMult,
      )
    }

    // Dalgalar arasında düşman sayısı değişir; kapasiteyi (MAX_WAVE_ENEMIES)
    // değil, o anki dalganın gerçek uzunluğunu çiziyoruz. Aksi halde bir
    // önceki (daha kalabalık) dalganın son matrisleri sahnede asılı kalırdı.
    mesh.count = world.enemies.length

    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i]

      if (!e.alive) {
        // Ölen düşmanı sahneden çıkarmanın en ucuz yolu: sıfır ölçek.
        dummy.scale.setScalar(0)
        dummy.position.set(0, -100, 0)
        dummy.rotation.y = 0
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        continue
      }

      dummy.scale.setScalar(1)
      dummy.position.set(e.pos.x, 0.9, e.pos.z)
      // Gittiği yöne baksın; duruyorsa mevcut açıyı koru.
      if (Math.abs(e.vel.x) + Math.abs(e.vel.z) > 0.01) {
        dummy.rotation.y = Math.atan2(e.vel.x, e.vel.z)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      color.copy(DISCIPLINED_COLOR).lerp(BROKEN_COLOR, 1 - e.discipline)
      mesh.setColorAt(i, color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, ENEMY_PRIORITY)

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_WAVE_ENEMIES]}
      castShadow
      receiveShadow
      // Örnekler her kare hareket ettiği için otomatik frustum culling
      // yanlış sonuç verir; sürü zaten hep sahnede.
      frustumCulled={false}
    >
      <capsuleGeometry args={[0.32, 0.9, 6, 12]} />
      <meshStandardMaterial roughness={0.7} metalness={0.2} />
    </instancedMesh>
  )
}
