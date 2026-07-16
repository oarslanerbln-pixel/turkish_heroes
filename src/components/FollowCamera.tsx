import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { world } from '../sim/world'

// Görsellerden (3) sonra, sarsıntıdan (6) ve çizimden (10) önce.
const CAMERA_PRIORITY = 5

/** Kameranın bakış noktasına göre duruşu: yukarıdan ve geriden. */
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
 * Bakış noktası bir karede bu kadar sıçrarsa yumuşatma yapılmaz, ışınlanır.
 * Yeniden başlatmada oyuncu arenanın öbür ucuna döner; kamera oraya süzülerek
 * gitseydi oyun saniyelerce izlenir halde beklerdi.
 */
const SNAP_DISTANCE = 25

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
  /**
   * Yumuşatılan bakış noktası. Kameranın kendi konumundan lerp'lemek yerine
   * ayrı tutuluyor: CameraShake her kare kameraya rastgele kaydırma ekliyor ve
   * lerp bunu geri sarmak yerine içine alırdı — sönmeyen bir rastgele yürüyüş
   * olurdu. Bu vektör sarsıntıyı hiç görmez.
   */
  const smooth = useMemo(() => new Vector3(), [])
  const başlatıldı = useMemo(() => ({ value: false }), [])

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1)

    // facing = atan2(dx, dz) düzeninde; birim vektörü (sin, cos).
    desired.set(
      world.player.x + Math.sin(world.facing) * CLUSTER_BIAS,
      0,
      world.player.z + Math.cos(world.facing) * CLUSTER_BIAS,
    )

    const sıçradı = smooth.distanceTo(desired) > SNAP_DISTANCE
    if (!başlatıldı.value || sıçradı) {
      smooth.copy(desired)
      başlatıldı.value = true
    } else {
      // Kare hızından bağımsız yumuşatma: 20 fps'te de 144'te de aynı his.
      smooth.lerp(desired, 1 - Math.exp(-LERP_SPEED * dt))
    }

    camera.position.copy(smooth).add(OFFSET)
    camera.lookAt(smooth)
  }, CAMERA_PRIORITY)

  return null
}
