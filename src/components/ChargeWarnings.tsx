import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { MODE_CHARGE, MODE_TELEGRAPH } from '../mechanics/corps'
import { ENEMY_CAPACITY } from '../mechanics/scenario'
import { world } from '../sim/world'
import { CHARGE_COLOR } from './palette'

// Hamle uyarısı: uyarıdaki askerden oyuncuya uzanan kırmızı zemin kaması
// (tasarım belgesi: "askerler kırmızıya döner, yerde bir koni belirir").
// Kırmızı binici "kim geliyor"u, kama "nereden, nereye"yi söyler — oyuncu
// kaçış yönünü bakar bakmaz seçebilsin. Hamle sürerken soluklaşarak kalır.
// Tek örneklenmiş mesh: uyarıdaki asker sayısı kadar örnek, tek çizim çağrısı.

const VISUAL_PRIORITY = 3

/** Kamanın en uzun hali (birim) — hamlenin menzili kabaca bu kadar. */
const MAX_LENGTH = 9
const BASE_WIDTH = 1.5

/** XZ düzleminde, tabanı z = 0'da, ucu z = 1'de üçgen; boyu ölçekle verilir. */
function buildWedge(): BufferGeometry {
  const g = new BufferGeometry()
  const w = BASE_WIDTH / 2
  g.setAttribute(
    'position',
    new Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0, 0, 1], 3),
  )
  g.setIndex([0, 2, 1])
  g.computeVertexNormals()
  return g
}

export function ChargeWarnings() {
  const meshRef = useRef<InstancedMesh>(null)
  const geometry = useMemo(buildWedge, [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: CHARGE_COLOR,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    const b = world.battle
    if (!mesh) return
    let n = 0
    if (b) {
      for (let i = 0; i < world.enemies.length; i++) {
        const e = world.enemies[i]
        const mode = b.mode[i]
        if (!e.alive || (mode !== MODE_TELEGRAPH && mode !== MODE_CHARGE)) continue
        const dx = world.player.x - e.pos.x
        const dz = world.player.z - e.pos.z
        const len = Math.min(MAX_LENGTH, Math.hypot(dx, dz))
        dummy.position.set(e.pos.x, 0.05, e.pos.z)
        dummy.rotation.set(0, Math.atan2(dx, dz), 0)
        // Hamlede kama kısalır: tehdit artık kamada değil, binicide.
        dummy.scale.set(1, 1, mode === MODE_TELEGRAPH ? len : len * 0.4)
        dummy.updateMatrix()
        mesh.setMatrixAt(n++, dummy.matrix)
      }
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    // Uyarı nabız gibi atar; tek malzeme olduğu için hepsi aynı ritimde.
    material.opacity = 0.3 + 0.2 * Math.sin(clock.elapsedTime * 18)
  }, VISUAL_PRIORITY)

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, ENEMY_CAPACITY]}
      frustumCulled={false}
      renderOrder={4}
    />
  )
}
