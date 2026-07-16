import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { world } from '../sim/world'

// Görsellerden (3) sonra, sarsıntıdan (6) ve çizimden (10) önce.
const CAMERA_PRIORITY = 5

/** Kameranın oyuncuya göre duruşu: yukarıdan ve geriden. */
const OFFSET = new Vector3(0, 20, 20)

/**
 * Bakış noktası oyuncudan kümeye doğru bu kadar kaydırılır.
 * Oyuncu tam ortada durmaz; kaçtığı yönün arkası yerine üstüne geldiği düşman
 * daha çok görünür — hilalin menzilini kestirebilmek için gereken bilgi bu.
 */
const CLUSTER_BIAS = 5

/** Takip yumuşaklığı. Yüksek = kamera daha sıkı yapışır. */
const LERP_SPEED = 3.5

/**
 * Kamerayı oyuncuya kilitler.
 *
 * Daha önce kamera [0,18,26]'da sabitti ve OrbitControls hep orijine bakıyordu;
 * oyuncu 29 birimlik arenanın karşı tarafına kaçtığında kendini göremiyordu —
 * kiting oyunun çekirdeği olduğu için bu oyunu oynanamaz kılıyordu.
 *
 * Kamera dönmez, sadece kayar: WASD dünya eksenlerine göre çalıştığı için
 * kameranın dönmesi kontrolleri anlaşılmaz hale getirirdi.
 */
export function FollowCamera() {
  const desired = useMemo(() => new Vector3(), [])
  const target = useMemo(() => new Vector3(), [])
  /**
   * Yumuşatılan taban konum. Kameranın kendi pozisyonundan lerp'lemek yerine
   * ayrı tutuluyor: CameraShake her kare kameraya rastgele bir kaydırma
   * ekliyor ve lerp bunu geri sarmak yerine içine alırdı — sonuç, sönmeyen bir
   * rastgele yürüyüş olurdu. Taban sarsıntıyı hiç görmez.
   */
  const base = useMemo(() => new Vector3(), [])
  const başlatıldı = useMemo(() => ({ value: false }), [])

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1)

    // facing = atan2(dx, dz) düzeninde; birim vektörü (sin, cos).
    target.set(
      world.player.x + Math.sin(world.facing) * CLUSTER_BIAS,
      0,
      world.player.z + Math.cos(world.facing) * CLUSTER_BIAS,
    )

    desired.copy(target).add(OFFSET)

    if (!başlatıldı.value) {
      // İlk karede kayarak gelmesin, doğru yerde başlasın.
      base.copy(desired)
      başlatıldı.value = true
    } else {
      // Kare hızından bağımsız yumuşatma: 20 fps'te de 144'te de aynı his.
      base.lerp(desired, 1 - Math.exp(-LERP_SPEED * dt))
    }

    camera.position.copy(base)
    camera.lookAt(target)
  }, CAMERA_PRIORITY)

  return null
}
