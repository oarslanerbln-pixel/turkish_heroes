import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import {
  BoxGeometry,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
} from 'three'
import { WHISTLE } from '../mechanics/whistle'
import type { Vec2 } from '../mechanics/types'
import { useGameStore } from '../store/gameStore'
import { newBattleWatch, world } from '../sim/world'
import { READY_COLOR } from './palette'

// Islıklı ok (Metehan; kural whistle.ts'te). Burası yalnızca anlatır ve girdiyi alır:
//  - Girdi: yere görünmez bir düzlem. Fareyle tıklanan ya da parmakla dokunulan
//    nokta ıslığın hedefi olur (joystick ve düğmeler DOM'da, onlara dokunuş buraya gelmez).
//  - Hedef: ok havadayken yerde turkuaz halka daralır; yağmurun ne zaman ve
//    nereye ineceği okunur.
//  - Ok: oyuncudan hedefe yüksek bir yayla uçar.
//  - Yağmur: indiği an halkanın içine oklar saplanır, bir süre kalır, gömülür.

const VISUAL_PRIORITY = 3

const RAIN = 24
/** İnişten sonra halkanın yerde sönme süresi (sn): etkinin alanı okunsun. */
const RING_FADE = 0.6
/** Saplı okların toprakta kaldığı ve gömüldüğü süre (sn). */
const STICK = 1.6
const SINK = 0.4
/** Islıklı okun uçuş yayının tepesi (birim). */
const ARC_HEIGHT = 6
/** Girdi düzleminin kenarı: arenanın tamamını örter. */
const PLANE_SIZE = 90

interface Landing {
  x: number
  z: number
  t0: number
}

/** Ayçiçeği dağılımı: k. okun yağmur halkası içindeki yeri. */
function rainOffset(k: number, out: Vec2): Vec2 {
  const a = k * 2.39996
  const r = WHISTLE.radius * 0.9 * Math.sqrt((k + 0.5) / RAIN)
  out.x = Math.cos(a) * r
  out.z = Math.sin(a) * r
  return out
}

export function WhistleShot() {
  const ringRef = useRef<Mesh>(null)
  const arrowRef = useRef<Mesh>(null)
  const rainRef = useRef<InstancedMesh>(null)
  const flight = useRef<{ from: Vec2; to: Vec2 } | null>(null)
  const landing = useRef<Landing | null>(null)
  const newBattle = useMemo(newBattleWatch, [])
  const dummy = useMemo(() => new Object3D(), [])
  const offset = useMemo<Vec2>(() => ({ x: 0, z: 0 }), [])

  const ringGeometry = useMemo(
    () => new RingGeometry(WHISTLE.radius - 0.18, WHISTLE.radius, 48).rotateX(-Math.PI / 2),
    [],
  )
  const ringMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: READY_COLOR,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const arrowGeometry = useMemo(() => new BoxGeometry(0.08, 0.08, 1.1), [])
  const arrowMaterial = useMemo(() => new MeshBasicMaterial({ color: '#f4ead2', toneMapped: false }), [])
  // Açık renkli gövde: kahverengi bozkırda koyu ok seçilmiyordu.
  const rainGeometry = useMemo(() => new BoxGeometry(0.07, 0.07, 1), [])
  const rainMaterial = useMemo(() => new MeshBasicMaterial({ color: '#e6dcc2' }), [])
  const planeGeometry = useMemo(() => new PlaneGeometry(PLANE_SIZE, PLANE_SIZE).rotateX(-Math.PI / 2), [])
  const planeMaterial = useMemo(
    () => new MeshBasicMaterial({ visible: false, side: DoubleSide }),
    [],
  )

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    // Yalnız sol tık ya da dokunuş; sağ tık tarayıcının işi.
    if (e.nativeEvent.button !== 0) return
    useGameStore.getState().requestWhistle({ x: e.point.x, z: e.point.z })
  }

  useFrame(() => {
    const ring = ringRef.current
    const arrow = arrowRef.current
    const rain = rainRef.current
    if (!ring || !arrow || !rain) return
    const now = world.animTime

    if (newBattle()) {
      flight.current = null
      landing.current = null
    }
    for (const ev of world.events) {
      if (ev.type === 'whistleFired') flight.current = { from: ev.origin, to: ev.target }
      if (ev.type === 'whistleLanded') {
        flight.current = null
        landing.current = { x: ev.x, z: ev.z, t0: now }
      }
    }

    // Havadaki ok ve daralan halka.
    const f = flight.current
    const left = world.whistle.flight
    if (f && left > 0) {
      const p = 1 - left / WHISTLE.flightTime
      ring.visible = true
      ring.position.set(f.to.x, 0.05, f.to.z)
      ring.scale.setScalar(1.6 - 0.6 * p)
      ringMaterial.opacity = 0.35 + 0.5 * p

      const x = f.from.x + (f.to.x - f.from.x) * p
      const z = f.from.z + (f.to.z - f.from.z) * p
      const y = 1.6 + ARC_HEIGHT * 4 * p * (1 - p)
      // Teğet: yatay ilerleme ve yayın o andaki eğimi.
      const run = Math.hypot(f.to.x - f.from.x, f.to.z - f.from.z) || 1
      const rise = ARC_HEIGHT * 4 * (1 - 2 * p)
      arrow.visible = true
      arrow.position.set(x, y, z)
      arrow.lookAt(x + (f.to.x - f.from.x) / run, y + rise / run, z + (f.to.z - f.from.z) / run)
    } else {
      ring.visible = false
      arrow.visible = false
    }

    // Saplı yağmur; iniş anında halka tam boyda kalıp söner.
    const l = landing.current
    if (l && now - l.t0 < RING_FADE) {
      ring.visible = true
      ring.position.set(l.x, 0.05, l.z)
      ring.scale.setScalar(1)
      ringMaterial.opacity = 0.85 * (1 - (now - l.t0) / RING_FADE)
    }
    let count = 0
    if (l) {
      const age = now - l.t0
      if (age > STICK + SINK) landing.current = null
      else {
        const sink = Math.max(0, age - STICK) / SINK
        for (let k = 0; k < RAIN; k++) {
          rainOffset(k, offset)
          dummy.position.set(l.x + offset.x, 0.3 - 0.45 * sink, l.z + offset.z)
          dummy.rotation.set(-1.2 + 0.25 * Math.sin(k * 1.7), k * 0.9, 0)
          dummy.updateMatrix()
          rain.setMatrixAt(count++, dummy.matrix)
        }
      }
    }
    rain.count = count
    rain.instanceMatrix.needsUpdate = true
  }, VISUAL_PRIORITY)

  return (
    <>
      <mesh geometry={planeGeometry} material={planeMaterial} onPointerDown={onPointerDown} />
      <mesh ref={ringRef} geometry={ringGeometry} material={ringMaterial} visible={false} renderOrder={4} />
      <mesh ref={arrowRef} geometry={arrowGeometry} material={arrowMaterial} visible={false} />
      <instancedMesh ref={rainRef} args={[rainGeometry, rainMaterial, RAIN]} frustumCulled={false} />
    </>
  )
}
