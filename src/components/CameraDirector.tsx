import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { isPlaying, newBattleWatch, world } from '../sim/world'
import { useGameStore } from '../store/gameStore'
import { arrows } from './arrowPool'
import {
  ARROW_SLOWMO,
  arrowChasePose,
  arrowDone,
  arrowHolding,
  arrowTracked,
  arrowWeight,
  beginArrow,
  createArrowShot,
  endArrow,
  findRelease,
  trackArrow,
} from './arrowShot'
import {
  applyBlend,
  createShotState,
  openingPose,
  planOpening,
  resetShot,
  shotDone,
  shotWeight,
  skipShot,
  startShot,
  type OpeningPath,
  type Pose,
} from './cameraShots'
import { TACTICAL_OFFSET, followLook, tacticalTarget } from './tacticalCamera'
import { nearFadeEye, nearFadeStrength } from './world/nearFade'
import { SHOT_POSE, SHOT_POSES } from '../shot'

// Görsellerden (3) sonra, sarsıntıdan (6) ve çizimden (10) önce.
const CAMERA_PRIORITY = 5

/**
 * Açılış: ordugahın ardından, alçaktan ufka. Ordugah ön planı çerçeveler,
 * oyuncu ortada, düşman ordusu gökyüzüne karşı. Oyuncuya göre. Savaş
 * açılışının uçuşu da bu kareden kalkar.
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
 * Baideng kuşatması: vinç çekimi. Oyuncuyla Gaozu'nun ortasına yüksekten
 * bakar; dört renkli atlılar kadrajın kenarlarından içeri kapanır.
 */
const CRANE_OFFSET = new Vector3(0, 28, 22)

const pose = (): Pose => ({ pos: new Vector3(), look: new Vector3() })

/**
 * Kamera yönetmeni (MIMARI.md G1). Her kare üç katmanı üst üste koyar:
 * taktik kadraj (tacticalCamera), sinematik çekim (cameraShots) ve çekim
 * kesildiğinde son çizilen duruştan geçiş. Kameranın tek yazarı budur;
 * sarsıntı (6) bunun üstüne eklenir ve her kare baştan yazıldığı için birikmez.
 *
 * Daha önce kamera [0,18,26]'da sabitti ve OrbitControls hep orijine bakıyordu;
 * oyuncu 29 birimlik arenanın karşı tarafına kaçtığında kendini göremiyordu —
 * kiting oyunun çekirdeği olduğu için bu oyunu oynanamaz kılıyordu.
 */
export function CameraDirector() {
  const target = useMemo(() => new Vector3(), [])
  /**
   * Yumuşatılan bakış noktası. Kameranın kendi konumundan lerp'lemek yerine
   * ayrı tutuluyor: sarsıntı her kare kameraya kaydırma ekliyor ve lerp bunu
   * geri sarmak yerine içine alırdı. Bu vektör sarsıntıyı hiç görmez.
   */
  const smooth = useMemo(() => new Vector3(), [])
  const started = useMemo(() => ({ value: false }), [])
  const shot = useMemo(() => createShotState(pose()), [])
  const arrowShot = useMemo(createArrowShot, [])
  /** Oyuncu çekim sırasında dokundu ya da tuşa bastı: çekim atlanır. */
  const skip = useMemo(() => ({ value: false }), [])
  const cine = useMemo(pose, [])
  /** Bu karenin duruşu; bir sonraki karede kesilen çekimin geçiş başlangıcı. */
  const out = useMemo(pose, [])
  const opening = useMemo<OpeningPath>(() => ({ start: pose(), reveal: pose(), dir: new Vector3() }), [])
  const newBattle = useMemo(newBattleWatch, [])

  useEffect(() => {
    const onPointer = () => {
      skip.value = true
    }
    // Basılı tutulan tuşun tekrarı yeni bir istek değil.
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) skip.value = true
    }
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [skip])

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1)
    const reducedMotion = useGameStore.getState().reducedMotion

    // Yeni savaşta eski savaşın çekimi sürmesin; kamera yeni yerine süzülmeden otursun.
    if (newBattle()) {
      resetShot(shot)
      started.value = false
    }
    if (reducedMotion) resetShot(shot)

    tacticalTarget(world.player, world.facing, target)
    followLook(smooth, target, dt, !started.value)
    started.value = true

    // Çekim girdiyi kilitlemez; oyuncu yeni bir dokunuşla geri alır. Çekimden
    // önceki dokunuş sayılmaz (SAVAŞA GİR'in kendisi açılışı atlamasın).
    if (skip.value) {
      skip.value = false
      if (isPlaying()) skipShot(shot, out)
    }

    // Çekim isteği yalnızca oyun sürerken tüketilir: menüde kamera taktik kalır.
    // Hareketi azaltta çekim oynamaz: kamera süzülmek yerine taktik kadraja keser.
    if (world.cameraCue && isPlaying()) {
      if (!reducedMotion) {
        if (world.cameraCue === 'opening') {
          // Uçuş menü karesinden başlar; cephe savaşın ilk dizilişinden okunur.
          opening.start.pos.set(world.player.x, 0, world.player.z).add(INTRO_OFFSET)
          opening.start.look.set(world.player.x, 0, world.player.z).add(INTRO_LOOK)
          planOpening(opening, world.player, world.enemies)
        }
        startShot(shot, world.cameraCue, out)
      }
      world.cameraCue = null
    }

    // Ok kamerası süren çekimi kesmez; istenen ok o sırada kalkarsa istek düşer.
    if (world.arrowCue) {
      const cue = world.arrowCue
      cue.wait -= dt
      const release =
        isPlaying() && !reducedMotion && !shot.cue ? findRelease(world.events, cue.corps) : undefined
      if (release) {
        beginArrow(arrowShot, release, arrows[release.slot])
        startShot(shot, 'arrow', out)
        world.arrowCue = null
      } else if (reducedMotion || cue.wait <= 0) {
        world.arrowCue = null
      }
    }

    out.pos.copy(smooth).add(TACTICAL_OFFSET)
    out.look.copy(smooth)

    let weight = 0
    if (world.mode === 'menu') {
      // Menüde kamera açılış çekiminin ilk karesinde bekler: menünün arka
      // planı seçilen savaşın kendisi. SAVAŞA GİR'e basınca çekim bu kareden
      // (ağırlık 1) başlar; menüden savaşa kesme olmadan geçilir.
      weight = 1
      resetShot(shot)
      out.pos.set(world.player.x, 0, world.player.z).add(INTRO_OFFSET)
      out.look.set(world.player.x, 0, world.player.z).add(INTRO_LOOK)
    } else if (shot.cue === 'arrow') {
      shot.t += dt
      const arrow = arrows[arrowShot.slot]
      trackArrow(arrowShot, arrow, shot.t)
      // Ok kaybolursa (yuva başka oka geçti) kamera son duruşunda bekler.
      if (arrowTracked(arrowShot, arrow)) arrowChasePose(arrow, arrowShot.side, world.battle?.layout.pass ?? false, cine)
      weight = arrowWeight(arrowShot, shot.t)
      if (arrowHolding(arrowShot, shot.t)) world.slowmo = Math.max(world.slowmo, ARROW_SLOWMO)
      out.pos.lerp(cine.pos, weight)
      out.look.lerp(cine.look, weight)
      if (arrowDone(arrowShot, shot.t)) shot.cue = null
    } else if (shot.cue) {
      // Gerçek zaman: gün batımının ağır çekimi çekimi uzatmasın.
      shot.t += dt
      weight = shotWeight(shot.cue, shot.t)
      const ring = world.baideng?.ring
      if (shot.cue === 'intro') {
        cine.pos.set(world.player.x, 0, world.player.z).add(INTRO_OFFSET)
        cine.look.set(world.player.x, 0, world.player.z).add(INTRO_LOOK)
      } else if (shot.cue === 'opening') {
        openingPose(opening, shot.t, cine)
      } else if (shot.cue === 'encircle' && ring) {
        cine.look.set((smooth.x + ring.center.x) / 2, 0, (smooth.z + ring.center.z) / 2)
        cine.pos.copy(cine.look).add(CRANE_OFFSET)
      } else {
        cine.pos.copy(smooth).add(DUSK_OFFSET)
        cine.look.copy(smooth).add(DUSK_LOOK)
      }
      out.pos.lerp(cine.pos, weight)
      out.look.lerp(cine.look, weight)
      if (shotDone(shot.cue, shot.t)) shot.cue = null
    }
    if (shot.cue !== 'arrow') endArrow(arrowShot, arrows)
    // Açılış sürerken sinema şeritleri iner, savaş arayüzü bekler (HUD).
    const cinematic = shot.cue === 'opening'
    if (cinematic !== useGameStore.getState().cinematic) useGameStore.setState({ cinematic })
    applyBlend(shot, dt, out)
    // Sinematik kadrajda ordugah ön planı çerçeveler; taktikte HUD'un arkasında incelir.
    nearFadeStrength.value = 1 - weight

    camera.position.copy(out.pos)
    let look = out.look
    if (SHOT_POSE && world.mode !== 'menu') {
      // Sanat açısı (çekim kipi): sabit poz, ön plan incelmez.
      const { offset, look: at } = SHOT_POSES[SHOT_POSE]
      camera.position.set(world.player.x + offset[0], offset[1], world.player.z + offset[2])
      look = cine.look.set(world.player.x + at[0], at[1], world.player.z + at[2])
      nearFadeStrength.value = 0
    }

    nearFadeEye.value.copy(camera.position)
    camera.lookAt(look)
  }, CAMERA_PRIORITY)

  return null
}
