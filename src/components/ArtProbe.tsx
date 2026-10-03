import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, type InstancedBufferAttribute, type Material, type Mesh, MeshBasicMaterial, type Object3D } from 'three'

/** `userData.unit` ile işaretli birim grupları (EnemySwarm, AlliedWings, MetehanPlaceholder). */
export type UnitGroup = 'enemy' | 'ally' | 'player'

/**
 * - normal: oyunun karesi
 * - hide: birimler gizli; birimin ardındaki zemin
 * - grup adı: o grubun birimleri düz macenta, geri kalan her şey siyah (maske)
 */
export type ProbeMode = 'normal' | 'hide' | UnitGroup

export interface ProbeFrame {
  /** Canvas'ın kendisi (HUD'suz), PNG veri adresi. */
  png: string
  calls: number
  /** Gölge pasosu dahil, karedeki tüm çizimler. */
  triangles: number
}

const MASK = new MeshBasicMaterial({ color: '#ff00ff', fog: false, toneMapped: false })
const BLACK = new MeshBasicMaterial({ color: '#000000', fog: false })
const BLACK_BACKGROUND = new Color('#000000')

function unitOf(o: Object3D): UnitGroup | undefined {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.userData.unit) return p.userData.unit as UnitGroup
}

/**
 * Görsel temel ölçümü (STIL.md, §10.8): çekim kipinde, karenin üç hâlini
 * çizer. Test birim–zemin parlaklık farkını maskelenen piksellerde ölçer;
 * maske birimin rengine bakmaz, yalnız nerede olduğuna. Simülasyon ilerlemez:
 * kare aynı anda (delta 0) yeniden çizilir.
 */
export function ArtProbe() {
  const get = useThree((s) => s.get)

  useEffect(() => {
    const materials = new Map<Mesh, Material | Material[]>()
    const tints = new Map<Mesh, InstancedBufferAttribute | null>()
    const hidden: Object3D[] = []
    let background: unknown = null

    const restore = () => {
      for (const [mesh, material] of materials) mesh.material = material
      for (const [mesh, tint] of tints) (mesh as Mesh & { instanceColor: InstancedBufferAttribute | null }).instanceColor = tint
      for (const o of hidden) o.visible = true
      materials.clear()
      tints.clear()
      hidden.length = 0
      if (background !== null) get().scene.background = background as Color
      background = null
    }

    const probe = (mode: ProbeMode): ProbeFrame => {
      restore()
      const { scene, gl, advance, clock } = get()
      if (mode === 'hide') {
        scene.traverse((o) => {
          if (o.userData.unit && o.visible) {
            o.visible = false
            hidden.push(o)
          }
        })
      } else if (mode !== 'normal') {
        background = scene.background
        scene.background = BLACK_BACKGROUND
        scene.traverse((o) => {
          const kind = o as Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean }
          const masked = unitOf(o) === mode
          // Nokta, çizgi ve derinlik yazmayan yüzeyler (hilal önizlemesi, toz,
          // gökyüzü): oyunda birimi örtmüyorlar, maskede de örtmesinler.
          const material = (o as Mesh).material as Material | undefined
          const veil = kind.isMesh && !masked && material && (material.transparent || !material.depthWrite)
          if ((kind.isPoints || kind.isLine || veil) && o.visible) {
            o.visible = false
            hidden.push(o)
          }
          if (!kind.isMesh || veil) return
          const mesh = o as Mesh & { instanceColor?: InstancedBufferAttribute | null }
          materials.set(mesh, mesh.material)
          mesh.material = masked ? MASK : BLACK
          // Örnek rengi maskeyi boyamasın: macenta her birimde aynı kalsın.
          if (masked && mesh.instanceColor !== undefined) {
            tints.set(mesh, mesh.instanceColor)
            mesh.instanceColor = null
          }
        })
      }
      gl.info.autoReset = false
      gl.info.reset()
      if (mode === 'normal' || mode === 'hide') advance(clock.elapsedTime)
      // Maske kare döngüsünden geçmez: görseller malzemelerini her kare
      // yazıyor (renk, saydamlık) ve paylaşılan maske malzemesini boyardı.
      // Efekt zinciri de gerekmez; maske yalnız birimin yerini söyler.
      else gl.render(scene, get().camera)
      const frame = { calls: gl.info.render.calls, triangles: gl.info.render.triangles }
      gl.info.autoReset = true
      // Aynı görevde: çizim tamponu henüz ekrana bileşmedi.
      return { png: gl.domElement.toDataURL('image/png'), ...frame }
    }

    Object.assign(window, { __artProbe: probe })
    return () => {
      restore()
      delete (window as { __artProbe?: unknown }).__artProbe
    }
  }, [get])

  return null
}
