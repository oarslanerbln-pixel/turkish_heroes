// Düşman sürüsü simülasyonu.
//
// Mekaniğin özü disiplin değişkeninde ve iki şeyi birden yönetir:
//   1. Disiplinliyken düşman mesafesini korur — hat tutar, üstüne yürümez.
//   2. Disiplin düştükçe hem hücuma geçer hem de ayrık durma güdüsü zayıflar.
// Sonuç: yalnızca peşine düşürülen düşman yığılır. Sahte çekilmenin düşmanı
// kuşatılabilir hale getirmesi bu şekilde ortaya çıkar.

import type { Enemy, Vec2 } from './types'

export const ENEMY_CONFIG = {
  count: 48,
  spawnRadius: 22,

  /** Disiplinliyken (formasyon korunurken) hız — temkinli ilerleyiş. */
  baseSpeed: 2.4,
  /**
   * Disiplin tamamen bozulduğunda hız. Oyuncunun hızından (6) bilerek YÜKSEK:
   * çılgına dönen takipçi kaçandan hızlıdır. Oyunun gerilimi buna dayanıyor —
   * düşmanı ne kadar çok bozarsan o kadar hızlı üstüne gelir, yani kazandıran
   * taktik aynı zamanda öldüren taktiktir.
   *
   * Çok düşük olamaz: 6.15'te kaçan oyuncuya kimse yetişemiyor, küme yayın
   * 13 birimlik menziline hiç girmiyor ve oyun bitirilemiyor (60sn'de 1 düşman
   * kalıyor). Yani yüksek hız sadece tehlike için değil, vurabilmek için de şart.
   *
   * Değer headless taramayla seçildi (geniş/orta/dar çember çizen üç bot):
   *   6.8 → %55 / ölür / ölür       (orta oyun hiç vuruş yapamıyor, uçurum)
   *   6.6 → %82 / ölür / ölür
   *   6.5 → %90 / kıl payı kazanır / ölür   ← seçilen gradyan
   * İnsan botlardan kötü başlayacağı için affedici taraf tercih edildi.
   */
  chaseSpeed: 6.5,

  /** Disiplin 1'ken korunan mesafe; 0'ken sıfıra iner (hücum). */
  standoffDistance: 9,
  /** Hedef mesafeye bu kadar yaklaşınca yavaşlar — hat titremesin. */
  standoffEasing: 2,

  /** Bu mesafedeki komşulardan itilme uygulanır. */
  separationRadius: 1.6,
  /** Disiplin 1'ken ayrık durma kuvveti. */
  separationForce: 14,
  /** Disiplin 0'ken ayrık durma kuvveti — küme bu yüzden sıkışır. */
  separationForceBroken: 2.5,

  /** Takip edildiğinde disiplinin saniyede düşme hızı. */
  disciplineDecay: 0.3,
  /** Takip bırakıldığında disiplinin saniyede toparlanma hızı. */
  disciplineRecovery: 0.22,

  /** Hız değişiminin yumuşatılması (yüksek = daha çevik). */
  steerLerp: 4,
  /** Arena sınırı — düşmanlar buranın dışına çıkamaz. */
  arenaRadius: 29,
  /** Bozguna uğrayanın kaçış hızı: kimse yetişemesin, sahne çabuk boşalsın. */
  routSpeed: 9,
} as const

export function createEnemies(count: number = ENEMY_CONFIG.count): Enemy[] {
  const enemies: Enemy[] = []

  for (let i = 0; i < count; i++) {
    // Karşı safta, yay şeklinde bir başlangıç dizilişi.
    const t = count === 1 ? 0.5 : i / (count - 1)
    const angle = Math.PI * (0.25 + t * 0.5)
    const radius = ENEMY_CONFIG.spawnRadius - (i % 4) * 1.8

    enemies.push({
      id: i,
      pos: {
        x: Math.cos(angle) * radius,
        z: -Math.abs(Math.sin(angle)) * radius,
      },
      vel: { x: 0, z: 0 },
      alive: true,
      discipline: 1,
    })
  }

  return enemies
}

/**
 * Sürüyü bir kare ilerletir.
 * @param isPlayerRetreating Oyuncu kümeden uzaklaşıyorsa disiplin hızla düşer.
 * @param disciplineRecoveryMult Dalga eskalasyonu için: baskı bırakılınca
 *   disiplinin toparlanma hızına çarpan. Varsayılan 1 (tek dalgalı eski davranış).
 */
export function stepEnemies(
  enemies: Enemy[],
  playerPos: Vec2,
  deltaTime: number,
  isPlayerRetreating: boolean,
  disciplineRecoveryMult = 1,
): void {
  for (const e of enemies) {
    // Baideng'in komuta grubu kendi kuralıyla yürür (baideng.ts stepCommand).
    if (!e.alive || e.emperor || e.guard) continue
    if (e.routed) {
      stepRout(e, enemies, playerPos, deltaTime)
      continue
    }

    stepDiscipline(e, isPlayerRetreating, deltaTime, disciplineRecoveryMult)

    const speed = lerp(ENEMY_CONFIG.chaseSpeed, ENEMY_CONFIG.baseSpeed, e.discipline)
    const standoff = ENEMY_CONFIG.standoffDistance * e.discipline
    steerToward(e, enemies, playerPos, speed, standoff, deltaTime)
  }
}

/**
 * Tek düşmanı bir hedef noktaya yönlendirip bir kare ilerletir: yaklaşma,
 * komşulardan ayrılma, yumuşak dönüş ve arena sınırı.
 *
 * Hedef oyuncu olabileceği gibi bir düzen yuvası da olabilir; birlik
 * düzeninde savaşan senaryolar aynı hareket modelini bu yolla kullanır.
 * @param standoff Hedefe bu mesafede durulur (0 = tam üstüne git).
 */
export function steerToward(
  e: Enemy,
  enemies: readonly Enemy[],
  target: Vec2,
  speed: number,
  standoff: number,
  deltaTime: number,
): void {
  const desired = seek(e, target, speed, standoff)
  applySeparation(e, enemies, desired)
  // Normalize etmek yerine sınırla: hattını tutan düşmanın "durma" isteği
  // (sıfıra yakın vektör) hıza yükseltilmesin.
  clampMagnitude(desired, speed)

  // Ani yön değişimi yerine mevcut hızdan hedefe yumuşak geçiş.
  const t = Math.min(1, ENEMY_CONFIG.steerLerp * deltaTime)
  e.vel.x = lerp(e.vel.x, desired.x, t)
  e.vel.z = lerp(e.vel.z, desired.z, t)

  e.pos.x += e.vel.x * deltaTime
  e.pos.z += e.vel.z * deltaTime

  confineToArena(e)
}

/** Kaçış hedefi — her askere yeni nesne ayrılmasın. */
const routTarget: Vec2 = { x: 0, z: 0 }

/**
 * Bozgun: oyuncudan uzağa ve dışarı doğru, sınıra kadar. Dışa doğru bileşen
 * kaçışın her durumda sınırda bitmesini garanti eder (oyuncunun çevresinde
 * dönüp durmasın). Sınıra varan savaş alanını terk etmiş sayılır.
 */
function stepRout(e: Enemy, enemies: readonly Enemy[], player: Vec2, deltaTime: number): void {
  e.discipline = 0
  const ax = e.pos.x - player.x
  const az = e.pos.z - player.z
  const al = Math.hypot(ax, az) || 1
  const r = Math.hypot(e.pos.x, e.pos.z) || 1
  const dx = ax / al + e.pos.x / r
  const dz = az / al + e.pos.z / r
  const dl = Math.hypot(dx, dz) || 1
  routTarget.x = e.pos.x + (dx / dl) * 10
  routTarget.z = e.pos.z + (dz / dl) * 10
  steerToward(e, enemies, routTarget, ENEMY_CONFIG.routSpeed, 0, deltaTime)
  if (Math.hypot(e.pos.x, e.pos.z) >= ENEMY_CONFIG.arenaRadius - 0.3) {
    e.alive = false
    e.fled = true
  }
}

function stepDiscipline(
  e: Enemy,
  isPlayerRetreating: boolean,
  deltaTime: number,
  recoveryMult: number,
): void {
  if (isPlayerRetreating) {
    // Decay dalgayla ölçeklenmiyor: bu, oyuncunun kaçış becerisini temsil
    // ediyor, düşmanın disiplinini değil — sabit kalmalı.
    e.discipline = Math.max(0, e.discipline - ENEMY_CONFIG.disciplineDecay * deltaTime)
  } else {
    e.discipline = Math.min(
      1,
      e.discipline + ENEMY_CONFIG.disciplineRecovery * recoveryMult * deltaTime,
    )
  }
}

/**
 * Hedef mesafeye göre yönelme vektörü.
 * Standoff mesafesinde durmak ister (fazla yaklaştıysa geri çekilir). Oyuncuyu
 * izleyen sürüde standoff disiplinle ölçeklenir: disiplini kırılan düşman
 * doğrudan oyuncunun üstüne gider.
 */
function seek(e: Enemy, target: Vec2, speed: number, standoff: number): Vec2 {
  const dx = target.x - e.pos.x
  const dz = target.z - e.pos.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.001) return { x: 0, z: 0 }

  const gap = dist - standoff

  // Hedef mesafeye yaklaştıkça yavaşla; tam üstündeyse dur.
  const urgency = Math.min(1, Math.abs(gap) / ENEMY_CONFIG.standoffEasing)
  const dir = Math.sign(gap) * urgency * speed

  return { x: (dx / dist) * dir, z: (dz / dist) * dir }
}

/**
 * Komşulardan itilmeyi `desired` üzerine ekler.
 * Kuvvet disiplinle ölçeklenir: düzen bozuldukça birbirlerine sokulurlar.
 */
function applySeparation(e: Enemy, enemies: readonly Enemy[], desired: Vec2): void {
  const force = lerp(
    ENEMY_CONFIG.separationForceBroken,
    ENEMY_CONFIG.separationForce,
    e.discipline,
  )

  for (const other of enemies) {
    if (other === e || !other.alive) continue

    const dx = e.pos.x - other.pos.x
    const dz = e.pos.z - other.pos.z
    const distSq = dx * dx + dz * dz

    if (distSq >= ENEMY_CONFIG.separationRadius ** 2) continue

    // Üst üste binen iki düşman NaN üretmesin diye taban değer.
    const dist = Math.max(0.001, Math.sqrt(distSq))
    const push = force / dist

    desired.x += (dx / dist) * push
    desired.z += (dz / dist) * push
  }
}

function confineToArena(e: Enemy): void {
  const dist = Math.hypot(e.pos.x, e.pos.z)
  if (dist <= ENEMY_CONFIG.arenaRadius || dist === 0) return

  const scale = ENEMY_CONFIG.arenaRadius / dist
  e.pos.x *= scale
  e.pos.z *= scale
}

function clampMagnitude(v: Vec2, max: number): void {
  const len = Math.hypot(v.x, v.z)
  if (len <= max || len < 0.0001) return
  v.x = (v.x / len) * max
  v.z = (v.z / len) * max
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
