import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, type Mesh, MeshStandardMaterial, Object3D } from 'three'
import { MODE_FORMATION } from '../mechanics/corps'
import { ENEMY_CAPACITY } from '../mechanics/scenario'
import type { Enemy } from '../mechanics/types'
import { isPlaying, simDelta, world } from '../sim/world'
import { scenarioOf } from '../sim/scenarios'
import { buildHorseGeometry, buildRiderGeometry, buildStandardGeometry } from '../characters/riderGeometry'
import { CHARGE_COLOR as CHARGE } from './palette'
import { applyUnitShading, FLASH_TIME, flashAttribute } from './world/unitShading'
import {
  CONTACT_SHADOW_ORDER,
  contactShadowGeometry,
  contactShadowMaterial,
  placeContactShadow,
} from './world/contactShadow'
import { VOLLEY_DEATH_TIME, fallState, volley } from './volleyPlan'

// Simülasyon sırası: oyuncu (0) → düşmanlar (1) → yönetmen (2).
const ENEMY_PRIORITY = 1

// Disiplinli (düzenli) → dağılmış (öfkeli takip) renk geçişi. Oyuncunun
// kuşatılabilirliği okuduğu asıl sinyal bu: binicinin giysisi ve kalkanı taşır.
const DISCIPLINED_COLOR = new Color('#6b7d99')
const BROKEN_COLOR = new Color('#d04a3a')
// Bizans: imparatorluk moru → dağılınca soluk kızıl. Hamle kırmızısı ayrı ve
// daha doygun: "bu asker şimdi üstüne geliyor" düzen renginden ayırt edilsin.
const BYZANTINE_COLOR = new Color('#6a3a96')
const BYZANTINE_BROKEN = new Color('#b0605a')
const CHARGE_COLOR = new Color(CHARGE)
const EMPEROR_COLOR = new Color('#e8b923')
/**
 * Baideng: Gaozu'nun arbaletli muhafızları kara lake zırhlı. Sürünün iki
 * renginden (düzen mavisi, bozgun kızılı) ayrı: yaylımı onlar atar, onlar
 * düşmedikçe çember Gaozu'yu barışa zorlayamaz.
 */
const GUARD_COLOR = new Color('#26242b')
/** İmparator kalabalıkta seçilsin: biraz daha iri. */
const EMPEROR_SCALE = 1.25

/** Görsel temel ölçümü için (bkz. ArtProbe). */
const UNIT = { unit: 'enemy' }

/** Dörtnal: adım hızı (rad/sn), zıplama ve öne-arkaya yalpalama genliği. */
const GALLOP_RATE = 9
const GALLOP_BOB = 0.1
const GALLOP_PITCH = 0.06

/** Düşen süvari önce yana devrilir, sonra toprağa gömülür (saniye). */
const FALL_TIME = 0.35
const DEATH_TIME = 1.1

export function EnemySwarm() {
  const horseRef = useRef<InstancedMesh>(null)
  const riderRef = useRef<InstancedMesh>(null)
  const standardRef = useRef<Mesh>(null)
  const blobRef = useRef<InstancedMesh>(null)
  // Vuruş parlaması: at ve binici aynı değeri okur, sancak imparatorunkini.
  // Nitelik geometriyle aynı yerde kurulur: StrictMode useMemo'yu iki kez çağırır.
  const [horse, rider, flashes] = useMemo(() => {
    const h = buildHorseGeometry('enemy')
    const r = buildRiderGeometry('enemy')
    return [h, r, flashAttribute(ENEMY_CAPACITY, h, r)] as const
  }, [])
  const [standards, standardFlash] = useMemo(() => {
    const all = {
      romanos: buildStandardGeometry('romanos'),
      manuel: buildStandardGeometry('manuel'),
      gaozu: buildStandardGeometry('gaozu'),
    }
    return [all, flashAttribute(1, all.romanos, all.manuel, all.gaozu)] as const
  }, [])
  const horseMaterial = useMemo(() => {
    const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
    applyUnitShading(m, true)
    return m
  }, [])
  const riderMaterial = useMemo(() => {
    const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 })
    applyUnitShading(m, true)
    return m
  }, [])
  // Matris/renk yazarken kullanılan tek seferlik yardımcılar.
  const dummy = useMemo(() => new Object3D(), [])
  const blob = useMemo(() => new Object3D(), [])
  const color = useMemo(() => new Color(), [])
  // Yalnızca çizim durumu: her düşmanın son yönü ve ölümünden beri geçen süre.
  const headings = useMemo(() => new Float32Array(ENEMY_CAPACITY), [])
  const deathAge = useMemo(() => new Float32Array(ENEMY_CAPACITY), [])
  /** Parlamanın kalan süresi (sn) ve bir önceki karede sağ mıydı. */
  const flashLeft = useMemo(() => new Float32Array(ENEMY_CAPACITY), [])
  const wasAlive = useMemo(() => new Uint8Array(ENEMY_CAPACITY), [])
  const flashing = useRef(false)
  const lastWave = useRef<Enemy[] | null>(null)
  /** Yaylımdaki düşenin çizildiği yer (bkz. volleyPlan.fallState). */
  const fallAt = useMemo(() => ({ x: 0, z: 0 }), [])

  // Renk buffer'ı ilk karede yazılmazsa örnekler siyah görünür.
  useLayoutEffect(() => {
    const mesh = riderRef.current
    if (!mesh) return
    for (let i = 0; i < ENEMY_CAPACITY; i++) {
      mesh.setColorAt(i, DISCIPLINED_COLOR)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  useFrame((_, delta) => {
    const horseMesh = horseRef.current
    const riderMesh = riderRef.current
    const standard = standardRef.current
    const blobMesh = blobRef.current
    if (!horseMesh || !riderMesh || !standard || !blobMesh) return
    const dt = simDelta(delta)

    // Sonuç ekranında sürü donar, ama çizim world'ü izlemeye devam eder:
    // yeniden başlatıldığında yeni pozisyonlar ilk karede görünür.
    if (isPlaying()) scenarioOf(world).moveEnemies(world, dt)
    const battle = world.battle
    const calm = battle ? BYZANTINE_COLOR : DISCIPLINED_COLOR
    const broken = battle ? BYZANTINE_BROKEN : BROKEN_COLOR

    // Yeni dalga ya da yeniden başlatma: çizim durumu sıfırdan. Düşman -z'de
    // doğuyor ve oyuncuya (+z) bakıyor.
    if (lastWave.current !== world.enemies) {
      lastWave.current = world.enemies
      headings.fill(0)
      deathAge.fill(0)
      flashLeft.fill(0)
      wasAlive.fill(1)
    }

    // Dalgalar arasında düşman sayısı değişir; kapasiteyi (ENEMY_CAPACITY)
    // değil, o anki dalganın gerçek uzunluğunu çiziyoruz. Aksi halde bir
    // önceki (daha kalabalık) dalganın son matrisleri sahnede asılı kalırdı.
    const n = world.enemies.length
    horseMesh.count = n
    riderMesh.count = n
    blobMesh.count = n
    let anyFlash = false
    const time = world.animTime
    // Sancak imparatorla birlikte yürür, devrilir, kaybolur; imparator yoksa görünmez.
    standard.visible = false
    standard.geometry = battle ? (battle.layout.pass ? standards.manuel : standards.romanos) : standards.gaozu

    for (let i = 0; i < n; i++) {
      const e = world.enemies[i]
      // Metehan'da düşen okunu bekler: oku saplanana dek koşar, sonra orada devrilir.
      const shot = e.alive || e.fled ? 'none' : fallState(volley, world.enemies, i, fallAt)

      if (e.alive || shot === 'pending') {
        const speed = Math.hypot(e.vel.x, e.vel.z)
        // Duruyorsa kendi son yönünü korur.
        if (speed > 0.05) headings[i] = Math.atan2(e.vel.x, e.vel.z)
        const gait = Math.min(1, speed / 3)
        const phase = time * GALLOP_RATE + i * 1.7
        const x = e.alive ? e.pos.x : fallAt.x
        const z = e.alive ? e.pos.z : fallAt.z
        dummy.position.set(x, Math.abs(Math.sin(phase)) * GALLOP_BOB * gait, z)
        dummy.rotation.set(Math.sin(phase) * GALLOP_PITCH * gait, headings[i], 0)
        dummy.scale.setScalar(e.emperor ? EMPEROR_SCALE : 1)
        placeContactShadow(blob, x, 0, z, headings[i], dummy.scale.x)
      } else if (e.fled) {
        // Savaş alanını terk eden düşmedi: devrilme yok, sahneden çıkar.
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
        placeContactShadow(blob, 0, -100, 0, 0, 0)
      } else {
        // Düştüğü kare: parlama gerçek zamanla söner, hitstop'ta da.
        if (wasAlive[i]) flashLeft[i] = FLASH_TIME
        // dt hitstop'ta sıfır: vuruş anında dik durur, donma bitince devrilir.
        deathAge[i] += dt
        const age = deathAge[i]
        const end = shot === 'landed' ? VOLLEY_DEATH_TIME : DEATH_TIME
        if (age >= end) {
          // Sahneden çıkarmanın en ucuz yolu: sıfır ölçek.
          dummy.position.set(0, -100, 0)
          dummy.scale.setScalar(0)
          placeContactShadow(blob, 0, -100, 0, 0, 0)
        } else {
          const fall = Math.min(1, age / FALL_TIME)
          const sink = Math.max(0, (age - FALL_TIME) / (end - FALL_TIME))
          const side = i % 2 === 0 ? 1 : -1
          const x = shot === 'landed' ? fallAt.x : e.pos.x
          const z = shot === 'landed' ? fallAt.z : e.pos.z
          dummy.position.set(x, -sink * 1.2, z)
          dummy.rotation.set(0, headings[i], side * fall * fall * (Math.PI / 2))
          dummy.scale.setScalar(1)
          // Gömülen atlının lekesi onunla birlikte söner.
          placeContactShadow(blob, x, 0, z, headings[i], 1 - sink)
        }
      }
      // Yaylımda düşen oku saplanana dek ayakta çizilir; parlama saplandığı karede.
      wasAlive[i] = e.alive || shot === 'pending' ? 1 : 0
      blobMesh.setMatrixAt(i, blob.matrix)
      // İlk yarısı tam beyaz, ikinci yarısı söner.
      flashLeft[i] = Math.max(0, flashLeft[i] - delta)
      const flash = Math.min(1, (flashLeft[i] / FLASH_TIME) * 2)
      flashes.setX(i, flash)
      if (flash > 0) anyFlash = true

      dummy.updateMatrix()
      horseMesh.setMatrixAt(i, dummy.matrix)
      riderMesh.setMatrixAt(i, dummy.matrix)
      if (e.emperor) {
        standard.position.copy(dummy.position)
        standard.rotation.copy(dummy.rotation)
        standard.scale.copy(dummy.scale)
        standard.visible = true
        if (standardFlash.getX(0) !== flash) {
          standardFlash.setX(0, flash)
          standardFlash.needsUpdate = true
        }
      }

      if (e.emperor) color.copy(EMPEROR_COLOR)
      else if (e.guard) color.copy(GUARD_COLOR)
      else if (battle && battle.mode[i] !== MODE_FORMATION) color.copy(CHARGE_COLOR)
      else color.copy(calm).lerp(broken, 1 - e.discipline)
      riderMesh.setColorAt(i, color)
    }

    horseMesh.instanceMatrix.needsUpdate = true
    riderMesh.instanceMatrix.needsUpdate = true
    blobMesh.instanceMatrix.needsUpdate = true
    if (riderMesh.instanceColor) riderMesh.instanceColor.needsUpdate = true
    // Son parlamanın sıfırı da yüklensin, sonra boşta yükleme yok.
    if (anyFlash || flashing.current) flashes.needsUpdate = true
    flashing.current = anyFlash
  }, ENEMY_PRIORITY)

  return (
    <>
      {/*
        Örnekler her kare hareket ettiği için otomatik frustum culling yanlış
        sonuç verir; sürü zaten hep sahnede. Gölgeyi yalnızca düşürürler:
        almak binlerce piksel için ek gölge örneklemesi demek.
      */}
      <instancedMesh
        ref={horseRef}
        args={[horse, horseMaterial, ENEMY_CAPACITY]}
        castShadow
        frustumCulled={false}
        userData={UNIT}
      />
      <instancedMesh
        ref={riderRef}
        args={[rider, riderMaterial, ENEMY_CAPACITY]}
        castShadow
        frustumCulled={false}
        userData={UNIT}
      />
      <mesh ref={standardRef} material={horseMaterial} castShadow visible={false} userData={UNIT} />
      <instancedMesh
        ref={blobRef}
        args={[contactShadowGeometry(), contactShadowMaterial(), ENEMY_CAPACITY]}
        frustumCulled={false}
        renderOrder={CONTACT_SHADOW_ORDER}
      />
    </>
  )
}
