import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group, Mesh, MeshBasicMaterial } from 'three'
import { BATTLE_CONFIG, CORPS, corpsDiscipline } from '../mechanics/corps'
import { world } from '../sim/world'
import { CHARGE_COLOR } from './palette'

// Birlik başına, askerlerin üstünde süzülen ince düzen çubuğu (tasarım
// belgesi: "dünyaya bağlı düzen çubuğu; taciz edilen birliğin çubuğu parlar").
// Oyuncunun asıl kararı "hangi birliğe yüklenmeli" — cevabı sahnede, birliğin
// kendisinin üstünde durmalı, köşedeki bir listede değil. Gündüz tabanı (0,6)
// çubukta çentikle gösterilir: taciz nereye kadar işler, görünsün.

// Kameraya bakan görsel: kameradan (5) ve sarsıntıdan (6) sonra, çizimden (10)
// önce. Öncelik 3'te bir önceki karenin yönünü kopyalıyordu; dönen bir
// çekimde titrerdi.
const CAMERA_FACING_PRIORITY = 7

const BAR_WIDTH = 3.4
const BAR_HEIGHT = 0.2
const BAR_Y = 3.4

const STEADY = new Color('#f1d17a')
const WORN = new Color('#ff5a1a')
/** Taciz altında çubuk bu renge doğru parlar. */
const HARASSED = new Color('#fff3c4')

export function CorpsBanners() {
  const groups = useRef<(Group | null)[]>([])
  const fills = useRef<(Mesh | null)[]>([])
  const emperorRing = useRef<Mesh>(null)

  useFrame(({ camera, clock }) => {
    const b = world.battle
    for (let ci = 0; ci < CORPS.length; ci++) {
      const group = groups.current[ci]
      const fill = fills.current[ci]
      if (!group || !fill) continue
      const c = b?.corps[ci]
      if (!b || !c || c.alive === 0 || c.status === 'fleeing') {
        group.visible = false
        continue
      }

      // Birliğin askerlerinin ortası: dönüşte ve hamlede çubuk birliği izler.
      let x = 0
      let z = 0
      let n = 0
      for (const e of world.enemies) {
        if (!e.alive || e.corps !== ci) continue
        x += e.pos.x
        z += e.pos.z
        n++
      }
      group.visible = n > 0
      if (n === 0) continue
      group.position.set(x / n, BAR_Y, z / n)
      group.quaternion.copy(camera.quaternion)

      // Doluluk düzen; dönüşte düzen çöktüğü için disiplin üzerinden değil,
      // birliğin kalıcı düzeni üzerinden — oyuncu yatırımını görsün. Geçitte
      // sıkışma da gösterilir: çubuğun çökmesi "şimdi kuşat" demek.
      const v = Math.max(0.001, b.layout.pass ? corpsDiscipline(c) : c.cohesion)
      fill.scale.x = v
      fill.position.x = (-BAR_WIDTH / 2) * (1 - v)
      const material = fill.material as MeshBasicMaterial
      material.color.copy(WORN).lerp(STEADY, (v - 0.3) / 0.7)
      if (c.harass > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 10)
        material.color.lerp(HARASSED, c.harass * 0.6 * pulse)
      }
    }

    // İmparator korumasız: altında nabız gibi atan kırmızı halka.
    const ring = emperorRing.current
    if (ring) {
      const emperor = b?.emperorExposed ? world.enemies.find((e) => e.emperor && e.alive) : undefined
      ring.visible = !!emperor
      if (emperor) {
        ring.position.set(emperor.pos.x, 0.06, emperor.pos.z)
        ring.scale.setScalar(1 + 0.15 * Math.sin(clock.elapsedTime * 6))
      }
    }
  }, CAMERA_FACING_PRIORITY)

  return (
    <>
      {CORPS.map((_, ci) => (
        <group
          key={ci}
          ref={(g) => {
            groups.current[ci] = g
          }}
          visible={false}
        >
          {/* Zemin: koyu, yarı saydam. Çubuklar süvarilerin önünde okunmalı. */}
          <mesh renderOrder={10}>
            <planeGeometry args={[BAR_WIDTH + 0.12, BAR_HEIGHT + 0.12]} />
            <meshBasicMaterial color="#120802" transparent opacity={0.6} depthTest={false} fog={false} />
          </mesh>
          <mesh
            renderOrder={11}
            ref={(m) => {
              fills.current[ci] = m
            }}
          >
            <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
            <meshBasicMaterial color={STEADY} depthTest={false} fog={false} toneMapped={false} />
          </mesh>
          {/* Gündüz tabanı çentiği. */}
          <mesh
            renderOrder={12}
            position={[-BAR_WIDTH / 2 + BAR_WIDTH * BATTLE_CONFIG.dayFloor, 0, 0]}
          >
            <planeGeometry args={[0.05, BAR_HEIGHT + 0.16]} />
            <meshBasicMaterial color="#fff3c4" transparent opacity={0.7} depthTest={false} fog={false} />
          </mesh>
        </group>
      ))}
      <mesh ref={emperorRing} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={5}>
        <ringGeometry args={[1.1, 1.45, 40]} />
        <meshBasicMaterial color={CHARGE_COLOR} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  )
}
