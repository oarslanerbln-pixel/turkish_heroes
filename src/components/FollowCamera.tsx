import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { isPlaying, newBattleWatch, world, type CameraCue } from '../sim/world'
import { useGameStore } from '../store/gameStore'
import { shotDone, shotWeight } from './cameraShots'
import { nearFadeEye, nearFadeStrength } from './world/nearFade'
import { SHOT_POSE, SHOT_POSES } from '../shot'

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
 * Açılış: ordugahın ardından, alçaktan ufka. Ordugah ön planı çerçeveler,
 * oyuncu ortada, düşman ordusu gökyüzüne karşı. Oyuncuya göre.
 */
const INTRO_OFFSET = new Vector3(6, 5.5, 14)
const INTRO_LOOK = new Vector3(-6, 2, -36)

/**
 * Gün batımı: kamera alçalıp ufka kalkar — batan güneş ordunun ardında.
 * Bakış noktasına göre; oyuncu kadrajın altında kalır.
 */
const DUSK_OFFSET = new Vector3(0, 9, 24)
const DUSK_LOOK = new Vector3(0, 4, -6)

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
  const shot = useMemo(() => ({ cue: null as CameraCue | null, t: 0 }), [])
  const cinePos = useMemo(() => new Vector3(), [])
  const cineLook = useMemo(() => new Vector3(), [])
  const look = useMemo(() => new Vector3(), [])
  const newBattle = useMemo(newBattleWatch, [])

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1)

    // Yeni savaşta eski savaşın çekimi sürmesin; kamera yeni yerine süzülmeden otursun.
    if (newBattle()) {
      shot.cue = null
      başlatıldı.value = false
    }

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

    // Çekim isteği yalnızca oyun sürerken tüketilir: menüde kamera taktik kalır.
    // Hareketi azaltta çekim oynamaz: kamera süzülmek yerine taktik kadraja keser.
    if (world.cameraCue && isPlaying()) {
      if (!useGameStore.getState().reducedMotion) {
        shot.cue = world.cameraCue
        shot.t = 0
      }
      world.cameraCue = null
    }

    camera.position.copy(smooth).add(OFFSET)
    look.copy(smooth)

    let weight = 0
    if (world.mode === 'menu') {
      // Menüde kamera açılış çekiminin ilk karesinde bekler: menünün arka
      // planı seçilen savaşın kendisi. SAVAŞA GİR'e basınca çekim bu kareden
      // (ağırlık 1) başlar; menüden savaşa kesme olmadan geçilir.
      weight = 1
      shot.cue = null
      cinePos.set(world.player.x, 0, world.player.z).add(INTRO_OFFSET)
      cineLook.set(world.player.x, 0, world.player.z).add(INTRO_LOOK)
      camera.position.copy(cinePos)
      look.copy(cineLook)
    } else if (shot.cue) {
      // Gerçek zaman: gün batımının ağır çekimi çekimi uzatmasın.
      shot.t += dt
      weight = shotWeight(shot.cue, shot.t)
      if (shot.cue === 'intro') {
        cinePos.set(world.player.x, 0, world.player.z).add(INTRO_OFFSET)
        cineLook.set(world.player.x, 0, world.player.z).add(INTRO_LOOK)
      } else {
        cinePos.copy(smooth).add(DUSK_OFFSET)
        cineLook.copy(smooth).add(DUSK_LOOK)
      }
      camera.position.lerp(cinePos, weight)
      look.lerp(cineLook, weight)
      if (shotDone(shot.cue, shot.t)) shot.cue = null
    }
    // Sinematik kadrajda ordugah ön planı çerçeveler; taktikte HUD'un arkasında incelir.
    nearFadeStrength.value = 1 - weight

    if (SHOT_POSE && world.mode !== 'menu') {
      // Sanat açısı (çekim kipi): sabit poz, ön plan incelmez.
      const { offset, look: at } = SHOT_POSES[SHOT_POSE]
      camera.position.set(world.player.x + offset[0], offset[1], world.player.z + offset[2])
      look.set(world.player.x + at[0], at[1], world.player.z + at[2])
      nearFadeStrength.value = 0
    }

    nearFadeEye.value.copy(camera.position)
    camera.lookAt(look)
  }, CAMERA_PRIORITY)

  return null
}
