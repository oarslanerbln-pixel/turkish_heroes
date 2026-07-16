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

  /** Disiplinliyken (formasyon korunurken) hız. */
  baseSpeed: 2.4,
  /** Disiplin tamamen bozulduğunda hız. */
  chaseSpeed: 5.4,

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
 */
export function stepEnemies(
  enemies: Enemy[],
  playerPos: Vec2,
  deltaTime: number,
  isPlayerRetreating: boolean,
): void {
  for (const e of enemies) {
    if (!e.alive) continue

    stepDiscipline(e, isPlayerRetreating, deltaTime)

    const speed = lerp(ENEMY_CONFIG.chaseSpeed, ENEMY_CONFIG.baseSpeed, e.discipline)
    const desired = seek(e, playerPos, speed)
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
}

function stepDiscipline(e: Enemy, isPlayerRetreating: boolean, deltaTime: number): void {
  if (isPlayerRetreating) {
    e.discipline = Math.max(0, e.discipline - ENEMY_CONFIG.disciplineDecay * deltaTime)
  } else {
    e.discipline = Math.min(1, e.discipline + ENEMY_CONFIG.disciplineRecovery * deltaTime)
  }
}

/**
 * Hedef mesafeye göre yönelme vektörü.
 * Disiplinli düşman standoff mesafesinde durmak ister (fazla yaklaştıysa geri
 * çekilir); disiplini kırılan düşman doğrudan oyuncunun üstüne gider.
 */
function seek(e: Enemy, playerPos: Vec2, speed: number): Vec2 {
  const dx = playerPos.x - e.pos.x
  const dz = playerPos.z - e.pos.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.001) return { x: 0, z: 0 }

  const standoff = ENEMY_CONFIG.standoffDistance * e.discipline
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
