import { useEffect, useMemo } from 'react'
import { BufferAttribute, Color, PlaneGeometry } from 'three'
import { useQuality } from '../../perf/quality'
import type { QualityTier } from '../../perf/quality'
import { terrainColor, terrainHeight } from './terrainShape'

/** Kenar uzunluğu: kameranın gördüğü en uzak nokta ~65 birim, tepeler 110'a kadar. */
const SIZE = 300

/**
 * Izgara çözünürlüğü kademeye bağlı. Yüksekte 2 birimlik hücreler (~45 bin
 * üçgen) tepelerde low-poly yüzeyleri belirginleştirir; düşükte ~4 birim
 * (~10 bin üçgen). Arena düz olduğu için oynanan alan her kademede aynı görünür.
 */
const SEGMENTS: Record<QualityTier, number> = { high: 150, medium: 110, low: 70 }

/**
 * Bozkır zemini: tek mesh, köşe renkleri, düz gölgeleme.
 * Doku dosyası yok — renk ve yükseklik terrainShape'teki gürültüden geliyor;
 * PWA çevrimdışı çalışsın, indirilecek varlık olmasın.
 */
export function Terrain() {
  const segments = useQuality((s) => SEGMENTS[s.tier])

  const geometry = useMemo(() => {
    const g = new PlaneGeometry(SIZE, SIZE, segments, segments)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, terrainHeight(x, z))
      terrainColor(x, z, c)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [segments])

  // Kademe değişince eski ızgara GPU belleğinde kalmasın.
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
    </mesh>
  )
}
