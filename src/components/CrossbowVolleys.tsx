import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
} from 'three'
import { BAIDENG } from '../mechanics/baideng'
import type { Vec2 } from '../mechanics/types'
import { newBattleWatch, world } from '../sim/world'
import { CHARGE_COLOR } from './palette'

// Baideng: Han arbaletlerinin yaylımı. Kural baideng.ts'te (halka, gecikme,
// isabet); burası yalnızca anlatır. Üç parça:
//  - Halka: yerde kırmızı çember ve içini dolduran disk. Disk dolunca oklar
//    düşer — oyuncu "ne zaman" sorusunu dolma hızından okur.
//  - Oklar: son yarım saniyede Gaozu'nun yönünden dik bir yayla iner,
//    toprağa saplanıp kalır, sonra gömülür.
//  - Parlama: düştüğü an halkanın yerinde kısa bir kızıl ışık.
// Halkanın kendisi world.baideng.volleys'ten okunur; saplı oklar ve parlama
// volleyLanded olayından doğar (yaylım düşünce durumdan silinir).

const VISUAL_PRIORITY = 3

/** Aynı anda en fazla bu kadar halka ve iz (yaylım arası 6 sn; bol pay). */
const SLOTS = 4
const BOLTS = 20
/** Okların düştüğü son an (sn): bu sürede havadan iner. */
const FALL = 0.5
/** Saplı okun toprakta kaldığı süre ve gömülme süresi (sn). */
const STICK = 1.4
const SINK = 0.4
const FLASH = 0.3
/** Okların indiği yayın yatay ve dikey açıklığı (birim). */
const FALL_RUN = 7
const FALL_RISE = 9

interface Impact {
  x: number
  z: number
  /** Ok yönü: Gaozu'dan halkaya (birim vektör). */
  dx: number
  dz: number
  t0: number
}

/** Aynı halkanın düşen ve saplanan okları aynı yerde olsun: konumdan türetilen tohum. */
function seed(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** Ayçiçeği dağılımı: k. okun halka içindeki yeri; halka boyunca eşit yoğun. */
function boltOffset(k: number, s: number, out: Vec2): Vec2 {
  const a = k * 2.39996 + s * Math.PI * 2
  const r = BAIDENG.volleyRadius * 0.92 * Math.sqrt((k + 0.5) / BOLTS)
  out.x = Math.cos(a) * r
  out.z = Math.sin(a) * r
  return out
}

/** Okların geldiği yön: Gaozu'dan halkaya. Gaozu yoksa -z'den. */
function incoming(x: number, z: number, out: Vec2): Vec2 {
  const emperor = world.enemies.find((e) => e.emperor && e.alive)
  const fx = emperor ? x - emperor.pos.x : 0
  const fz = emperor ? z - emperor.pos.z : 1
  const len = Math.hypot(fx, fz) || 1
  out.x = fx / len
  out.z = fz / len
  return out
}

export function CrossbowVolleys() {
  const ringRef = useRef<InstancedMesh>(null)
  const fillRef = useRef<InstancedMesh>(null)
  const flashRef = useRef<InstancedMesh>(null)
  const boltRef = useRef<InstancedMesh>(null)

  const ringGeometry = useMemo(
    () => new RingGeometry(BAIDENG.volleyRadius - 0.15, BAIDENG.volleyRadius, 48).rotateX(-Math.PI / 2),
    [],
  )
  const diskGeometry = useMemo(
    () => new CircleGeometry(BAIDENG.volleyRadius, 40).rotateX(-Math.PI / 2),
    [],
  )
  const boltGeometry = useMemo(() => new BoxGeometry(0.06, 0.06, 0.9), [])
  const ringMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: CHARGE_COLOR,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const fillMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: CHARGE_COLOR,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  // Toplamalı: örnek rengi siyaha indikçe parlama söner.
  const flashMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  // Açık kamış rengi (ArrowVolley ile aynı neden: koyu ok toprakta kaybolur).
  const boltMaterial = useMemo(() => new MeshBasicMaterial({ color: '#efe2c2', toneMapped: false }), [])

  const dummy = useMemo(() => new Object3D(), [])
  const color = useMemo(() => new Color(), [])
  const flashColor = useMemo(() => new Color(CHARGE_COLOR), [])
  const off = useMemo<Vec2>(() => ({ x: 0, z: 0 }), [])
  const dir = useMemo<Vec2>(() => ({ x: 0, z: 0 }), [])
  const impacts = useRef<Impact[]>([])
  const newBattle = useMemo(newBattleWatch, [])

  // Renk buffer'ı ilk karede yazılmazsa parlamanın örnek rengi hiç bağlanmaz.
  useLayoutEffect(() => {
    const mesh = flashRef.current
    if (!mesh) return
    for (let i = 0; i < SLOTS; i++) mesh.setColorAt(i, flashColor)
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [flashColor])

  useFrame(({ clock }) => {
    const ring = ringRef.current
    const fill = fillRef.current
    const flash = flashRef.current
    const bolts = boltRef.current
    if (!ring || !fill || !flash || !bolts) return
    const s = world.baideng
    const now = world.animTime

    if (newBattle() || !s) impacts.current.length = 0
    for (const ev of world.events) {
      if (ev.type !== 'volleyLanded') continue
      incoming(ev.x, ev.z, dir)
      impacts.current.push({ x: ev.x, z: ev.z, dx: dir.x, dz: dir.z, t0: now })
      if (impacts.current.length > SLOTS) impacts.current.shift()
    }
    impacts.current = impacts.current.filter((im) => now - im.t0 < STICK + SINK)

    let rings = 0
    let nb = 0
    if (s) {
      for (const v of s.volleys) {
        if (rings >= SLOTS) break
        const progress = 1 - v.left / BAIDENG.volleyTelegraph
        dummy.rotation.set(0, 0, 0)
        dummy.position.set(v.x, 0.06, v.z)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        ring.setMatrixAt(rings, dummy.matrix)
        dummy.position.y = 0.05
        dummy.scale.set(progress, 1, progress)
        dummy.updateMatrix()
        fill.setMatrixAt(rings, dummy.matrix)
        rings++

        // Son yarım saniye: oklar Gaozu'nun yönünden dik bir yayla iner.
        if (v.left > FALL) continue
        incoming(v.x, v.z, dir)
        const sd = seed(v.x, v.z)
        for (let k = 0; k < BOLTS; k++) {
          // Hepsi aynı karede değil: okların bir kısmı biraz geriden gelir.
          const p = Math.min(1, 1 - (v.left - (k % 3) * 0.04) / FALL)
          if (p <= 0) continue
          boltOffset(k, sd, off)
          const back = (1 - p) * FALL_RUN
          const up = (1 - p) * FALL_RISE
          dummy.position.set(v.x + off.x - dir.x * back, 0.3 + up, v.z + off.z - dir.z * back)
          // Ok uçuş yönüne bakar: yatayda dir, dikeyde dalış.
          dummy.rotation.set(0, 0, 0)
          dummy.lookAt(dummy.position.x + dir.x * FALL_RUN, dummy.position.y - FALL_RISE, dummy.position.z + dir.z * FALL_RUN)
          dummy.scale.setScalar(1)
          dummy.updateMatrix()
          bolts.setMatrixAt(nb++, dummy.matrix)
        }
      }
    }

    let flashes = 0
    for (const im of impacts.current) {
      const age = now - im.t0
      if (age < FLASH) {
        dummy.rotation.set(0, 0, 0)
        dummy.position.set(im.x, 0.07, im.z)
        dummy.scale.setScalar(1 + age * 0.6)
        dummy.updateMatrix()
        flash.setMatrixAt(flashes, dummy.matrix)
        flash.setColorAt(flashes, color.copy(flashColor).multiplyScalar(1 - age / FLASH))
        flashes++
      }
      // Saplı oklar: gelişteki eğimle yarı gömülü, sonra toprağa çekilir.
      const sink = Math.max(0, age - STICK) / SINK
      const sd = seed(im.x, im.z)
      for (let k = 0; k < BOLTS; k++) {
        boltOffset(k, sd, off)
        dummy.position.set(im.x + off.x - im.dx * 0.2, 0.25 - sink * 0.6, im.z + off.z - im.dz * 0.2)
        dummy.rotation.set(0, 0, 0)
        dummy.lookAt(dummy.position.x + im.dx * FALL_RUN, dummy.position.y - FALL_RISE, dummy.position.z + im.dz * FALL_RUN)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        bolts.setMatrixAt(nb++, dummy.matrix)
      }
    }

    ring.count = rings
    fill.count = rings
    flash.count = flashes
    bolts.count = nb
    ring.instanceMatrix.needsUpdate = true
    fill.instanceMatrix.needsUpdate = true
    flash.instanceMatrix.needsUpdate = true
    if (flash.instanceColor) flash.instanceColor.needsUpdate = true
    bolts.instanceMatrix.needsUpdate = true
    // Halka nabız gibi atar (hamle kamasıyla aynı dil).
    ringMaterial.opacity = 0.65 + 0.3 * Math.sin(clock.elapsedTime * 18)
  }, VISUAL_PRIORITY)

  return (
    <>
      <instancedMesh ref={ringRef} args={[ringGeometry, ringMaterial, SLOTS]} frustumCulled={false} renderOrder={4} />
      <instancedMesh ref={fillRef} args={[diskGeometry, fillMaterial, SLOTS]} frustumCulled={false} renderOrder={4} />
      <instancedMesh ref={flashRef} args={[diskGeometry, flashMaterial, SLOTS]} frustumCulled={false} renderOrder={5} />
      <instancedMesh
        ref={boltRef}
        args={[boltGeometry, boltMaterial, SLOTS * BOLTS * 2]}
        frustumCulled={false}
      />
    </>
  )
}
