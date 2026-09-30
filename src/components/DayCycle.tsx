import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, Vector3 } from 'three'
import { BATTLE_CONFIG } from '../mechanics/corps'
import { world } from '../sim/world'
import { useQuality, QUALITY } from '../perf/quality'

// Sahnenin ışığı ve havası; Alp Arslan savaşında gün saatine göre değişir.
//
// Üç anahtar an var: öğle (tasarım belgesindeki #ffd9a0), gün batımı
// (#ff7a3d) ve gece (#6a7fa8). Gün batımı oyunun kilit anı: ışığın turuncuya
// dönüp gölgelerin uzaması, "şimdi dönüyorlar" duyurusundan önce hissettirir.
// Metehan'da savaş saati yok; sahne hep öğlede kalır, önceki görünümle aynı.

interface Keyframe {
  sun: Color
  sunIntensity: number
  sunPos: Vector3
  haze: Color
  sky: Color
  ground: Color
  hemi: number
  ambient: number
}

const NOON: Keyframe = {
  sun: new Color('#ffd9a0'),
  sunIntensity: 2.2,
  sunPos: new Vector3(18, 22, 12),
  haze: new Color('#8e7254'),
  sky: new Color('#ffe2b8'),
  ground: new Color('#4b3622'),
  hemi: 0.6,
  ambient: 0.25,
}

// Alçak batı güneşi: uzun gölgeler, sıcak kontrast.
const SUNSET: Keyframe = {
  sun: new Color('#ff7a3d'),
  sunIntensity: 2.0,
  sunPos: new Vector3(30, 9, -4),
  haze: new Color('#8a5238'),
  sky: new Color('#ffb07a'),
  ground: new Color('#3b2418'),
  hemi: 0.5,
  ambient: 0.22,
}

// Ay ışığı: soğuk, zayıf; siluetler seçilsin diye tamamen karanlık değil.
const NIGHT: Keyframe = {
  sun: new Color('#8fa3d0'),
  sunIntensity: 0.9,
  sunPos: new Vector3(-12, 20, 10),
  haze: new Color('#232a40'),
  sky: new Color('#4a5a88'),
  ground: new Color('#1a1a24'),
  hemi: 0.4,
  ambient: 0.2,
}

/** Gün batımı geçişi, dayLength'ten bu kadar önce başlar (sn). */
const GOLDEN_HOUR = 22
/** Gün batımından geceye geçiş süresi (sn). */
const DUSK_TO_NIGHT = 40

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function DayCycle() {
  const preset = QUALITY[useQuality((s) => s.tier)]
  const scene = useThree((s) => s.scene)
  const sunRef = useRef<DirectionalLight>(null)
  const hemiRef = useRef<HemisphereLight>(null)
  const ambientRef = useRef<AmbientLight>(null)
  const lastTime = useRef(-1)

  useFrame(() => {
    const time = world.battle?.time ?? 0
    // Saat ilerlemediyse (menü, Metehan) hiçbir şey yazma.
    if (time === lastTime.current) return
    lastTime.current = time

    const { dayLength } = BATTLE_CONFIG
    const toSunset = smoothstep(dayLength - GOLDEN_HOUR, dayLength, time)
    const toNight = smoothstep(dayLength, dayLength + DUSK_TO_NIGHT, time)

    const sun = sunRef.current
    const hemi = hemiRef.current
    const ambient = ambientRef.current
    if (!sun || !hemi || !ambient) return

    sun.color.copy(NOON.sun).lerp(SUNSET.sun, toSunset).lerp(NIGHT.sun, toNight)
    sun.intensity = mix(mix(NOON.sunIntensity, SUNSET.sunIntensity, toSunset), NIGHT.sunIntensity, toNight)
    sun.position.copy(NOON.sunPos).lerp(SUNSET.sunPos, toSunset).lerp(NIGHT.sunPos, toNight)

    hemi.color.copy(NOON.sky).lerp(SUNSET.sky, toSunset).lerp(NIGHT.sky, toNight)
    hemi.groundColor.copy(NOON.ground).lerp(SUNSET.ground, toSunset).lerp(NIGHT.ground, toNight)
    hemi.intensity = mix(mix(NOON.hemi, SUNSET.hemi, toSunset), NIGHT.hemi, toNight)
    ambient.intensity = mix(mix(NOON.ambient, SUNSET.ambient, toSunset), NIGHT.ambient, toNight)

    const haze = scene.background instanceof Color ? scene.background : null
    haze?.copy(NOON.haze).lerp(SUNSET.haze, toSunset).lerp(NIGHT.haze, toNight)
    if (scene.fog instanceof Fog && haze) scene.fog.color.copy(haze)
  })

  return (
    <>
      {/* Arena (kameradan 20–40 birim) net kalır; ekranın üst kenarındaki
          tepeler (~65 birim) pusa doğru soluklaşır. */}
      <color attach="background" args={[NOON.haze]} />
      <fog attach="fog" args={[NOON.haze, 45, 125]} />
      {/* Ortam ışığı düşük: gölgeler ve süvari siluetleri zeminden ayrılsın. */}
      <ambientLight ref={ambientRef} intensity={NOON.ambient} />
      {/* Gökyüzü/toprak ayrımı — bozkır hissini ucuza veriyor. */}
      <hemisphereLight ref={hemiRef} args={[NOON.sky, NOON.ground, NOON.hemi]} />
      {/*
        Alçak, sıcak güneş: uzun gölgeler. key: gölge haritası boyutu
        değişince ışık yeniden kurulur — three mevcut haritayı yeniden
        boyutlamıyor; eski ışık (ve haritası) R3F tarafından dispose edilir.
        Yeniden kurulan ışık bir sonraki karede gün saatine döner.
      */}
      <directionalLight
        key={preset.shadowMapSize}
        ref={(light) => {
          sunRef.current = light
          lastTime.current = -1
        }}
        position={NOON.sunPos}
        intensity={NOON.sunIntensity}
        color={NOON.sun}
        castShadow
        shadow-mapSize={[preset.shadowMapSize, preset.shadowMapSize]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-far={80}
        // Düz gölgeli (flatShading) arazide gölge lekesi olmasın.
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* Karşı yönden soğuk dolgu — siluetler tamamen kararmasın. */}
      <directionalLight position={[-14, 10, -16]} intensity={0.5} color="#6a7fa8" />
    </>
  )
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
