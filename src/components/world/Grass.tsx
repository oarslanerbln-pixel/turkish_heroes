import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { useQuality } from '../../perf/quality'
import type { QualityTier } from '../../perf/quality'
import { mulberry32, terrainHeight } from './terrainShape'

/** Kademe başına çimen öbeği. Düşükte hiç yok: en ucuz kademe oynanışa odaklanır. */
const TUFTS: Record<QualityTier, number> = { high: 8000, medium: 3500, low: 0 }

/** Arena içindeki pay: seyrek tutuluyor ki hilal önizlemesi okunur kalsın. */
const INSIDE_SHARE = 0.35

/**
 * Rüzgârda dalgalanan kuru bozkır otu.
 * Kademe değişince yeni sayıyla baştan kurulur (key), bu yüzden kademe düşünce
 * köşe maliyeti de gerçekten düşer.
 */
export function Grass() {
  const count = useQuality((s) => TUFTS[s.tier])
  if (count === 0) return null
  return <GrassField key={count} count={count} />
}

function GrassField({ count }: { count: number }) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(buildTuft, [])
  const material = useMemo(windMaterial, [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rand = mulberry32(209)
    const dummy = new Object3D()
    const tint = new Color()

    for (let i = 0; i < count; i++) {
      const inside = i < count * INSIDE_SHARE
      // Alan başına eşit yoğunluk için yarıçapın karekökü.
      const r = inside ? 28 * Math.sqrt(rand()) : 30 + 45 * Math.sqrt(rand())
      const a = rand() * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const s = inside ? 0.6 + rand() * 0.4 : 0.8 + rand() * 0.7
      dummy.position.set(x, terrainHeight(x, z), z)
      dummy.rotation.set(0, rand() * Math.PI, 0)
      dummy.scale.set(s, s * (0.8 + rand() * 0.6), s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, tint.setScalar(0.8 + rand() * 0.35))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [count])

  useFrame(({ clock }) => {
    material.userData.uTime.value = clock.elapsedTime
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />
}

/** Üç sapın 60°'lik açılarla dizildiği tek öbek: 3 üçgen, 9 köşe. */
function buildTuft(): BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const base = new Color('#7a6334')
  const tip = new Color('#dcc07c')

  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI
    const cx = Math.cos(a) * 0.05
    const cz = Math.sin(a) * 0.05
    const lean = 0.08 * (b - 1)
    positions.push(-cx, 0, -cz, cx, 0, cz, lean, 0.5 + b * 0.06, lean * 0.5)
    colors.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b)
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  g.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  // Normaller sapın yüzüne değil yukarı bakıyor: ot zeminle aynı ışığı alır.
  // Sapın kendi normaliyle güneşe ters düşen saplar koyu çizikler gibi
  // görünüyordu (ekran görüntüsüyle teşhis edildi).
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  g.setAttribute('normal', new BufferAttribute(normals, 3))
  return g
}

/**
 * Rüzgâr köşe gölgelendiricide: sapın ucu (y) ne kadar yüksekse o kadar
 * salınır, kök yerinde kalır. Faz her öbeğin konumundan: dalga alan boyunca
 * yürüyor gibi görünür. CPU'da kare başına iş yok.
 */
function windMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide })
  const uTime = { value: 0 }
  material.userData.uTime = uTime
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'float phase = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;',
          'transformed.x += sin(uTime * 1.6 + phase) * 0.16 * position.y;',
          'transformed.z += cos(uTime * 1.2 + phase * 1.3) * 0.07 * position.y;',
        ].join('\n'),
      )
  }
  return material
}
