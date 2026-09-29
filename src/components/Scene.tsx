import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, Stats } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Terrain } from './world/Terrain'
import { Stones } from './world/Stones'
import { Grass } from './world/Grass'
import { StrikeSparks } from './StrikeSparks'
import { MetehanPlaceholder } from '../characters/metehan/MetehanPlaceholder'
import { CameraShake } from './CameraShake'
import { CrescentPreview } from './CrescentPreview'
import { FollowCamera } from './FollowCamera'
import { EnemySwarm } from './EnemySwarm'
import { GameDirector } from './GameDirector'
import { StrikeEffect } from './StrikeEffect'
import { HilalEnergyHUD } from './HilalEnergyHUD'
import { useStrikeInput } from '../hooks/useStrikeInput'
import { TouchJoystick } from './TouchJoystick'
import { useGameStore } from '../store/gameStore'
import { PERF_OVERLAY, QUALITY, SESSION_MULTISAMPLING, useQuality } from '../perf/quality'

// Bozkırın uzakta kaybolduğu sıcak, tozlu pus. Kamera 45° aşağı baktığı için
// gökyüzü hiç görünmüyor; derinliği hava perspektifi veriyor: arena net, ekranın
// üstündeki tepeler bu renge doğru soluyor. Gökyüzü kubbesi yerine bilinçli
// tercih — görünmeyecek bir şeye çizim çağrısı harcanmaz.
const HAZE_COLOR = '#8e7254'

export function Scene() {
  useStrikeInput()
  const tier = useQuality((s) => s.tier)
  const adaptive = useQuality((s) => !s.locked)
  const step = useQuality((s) => s.step)
  // Menülerde (başlangıç, sonuç) sahne yarı saydam bir katmanın arkasında donuk
  // duruyor; saniyede 60 kez yeniden çizmek yalnızca pil ve ısı harcıyordu.
  // 'demand' modunda R3F yalnızca gerektiğinde (ör. boyut değişince) çizer.
  const playing = useGameStore((s) => s.started && s.outcome === 'playing')
  const preset = QUALITY[tier]

  // Efekt listesi kademe değişmedikçe aynı nesne kalsın: EffectComposer,
  // çocukları her değiştiğinde efekt pasolarını baştan kuruyor.
  const effects = useMemo(
    () => (
      <>
        {preset.bloom && (
          <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.2} intensity={0.7} mipmapBlur />
        )}
        <Vignette offset={0.3} darkness={0.6} />
        {preset.noise && <Noise opacity={0.03} blendFunction={BlendFunction.OVERLAY} />}
      </>
    ),
    [preset.bloom, preset.noise],
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0d0500' }}>
      <Canvas
        shadows
        dpr={[1, preset.maxDpr]}
        frameloop={playing ? 'always' : 'demand'}
        camera={{ position: [0, 18, 26], fov: 55 }}
        gl={{
          // Kenar yumuşatmayı EffectComposer'ın MSAA'sı yapıyor. Canvas'ın kendi
          // MSAA'sı yalnızca son tam ekran üçgenine uygulanıyordu: bedeli
          // ödenip hiçbir kenara faydası olmayan bir tampon.
          antialias: false,
          stencil: false,
          powerPreference: 'high-performance',
          // Not: burada eskiden ACES ton eşlemesi vardı. EffectComposer
          // renderer'ın ton eşlemesini kapatıyor ve ölçüldüğünde (ACES açık /
          // kapalı) çıktı piksel parlaklığı birebir aynıydı — ayar hiç etki
          // etmiyordu, yalnızca pencere boyutu değişince açılıp kapanıyordu.
          // Gerçek ACES istenirse efekt zincirine <ToneMapping> eklenmeli; bu
          // görünümü değiştirir, bilinçli bir sanat kararı olarak yapılmalı.
        }}
        onCreated={({ gl }) => {
          if (import.meta.env.DEV) Object.assign(globalThis, { __gl: gl })
        }}
      >
        {/*
          Işıklandırma tamamen yerel. Daha önce drei'nin <Environment preset="sunset" />
          bileşeni vardı; harici bir CDN'den 1.4 MB HDR indiriyordu ve indirme
          tamamlanana kadar R3F'in Suspense sınırında askıda kalıp sahneyi bomboş
          bırakıyordu (konsola hata da düşmüyordu). Offline çalışması gereken bir
          PWA'da harici varlığa bağımlılık zaten kabul edilemezdi.
        */}
        <Suspense fallback={null}>
          {/* FPS paneli: geliştirmede ve ?perf ile — gerçek cihazda ölçmek için. */}
          {PERF_OVERLAY && <Stats className="perf-stats" />}
          {/*
            FPS'i izleyip kademeyi bir basamak indirir/kaldırır (~2,5 sn'lik
            pencereler). Menüde kare çizilmediği için ölçüm de yapılmaz.
          */}
          {adaptive && (
            <PerformanceMonitor onIncline={() => step(1)} onDecline={() => step(-1)} />
          )}
          {/* Arena (kameradan 20–40 birim) net kalır; ekranın üst kenarındaki
              tepeler (~65 birim) pusa doğru soluklaşır. */}
          <color attach="background" args={[HAZE_COLOR]} />
          <fog attach="fog" args={[HAZE_COLOR, 45, 125]} />
          {/* Ortam ışığı düşük: gölgeler ve süvari siluetleri zeminden ayrılsın. */}
          <ambientLight intensity={0.25} />
          {/* Gökyüzü/toprak ayrımı — bozkır hissini ucuza veriyor. */}
          <hemisphereLight args={['#ffe2b8', '#4b3622', 0.6]} />
          {/*
            Alçak, sıcak güneş: uzun gölgeler. key: gölge haritası boyutu
            değişince ışık yeniden kurulur — three mevcut haritayı yeniden
            boyutlamıyor; eski ışık (ve haritası) R3F tarafından dispose edilir.
          */}
          <directionalLight
            key={preset.shadowMapSize}
            position={[18, 22, 12]}
            intensity={2.2}
            color="#ffd9a0"
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
          <Terrain />
          <Stones />
          <Grass />
          <MetehanPlaceholder />
          <EnemySwarm />
          <GameDirector />
          {/* Görseller yönetmenden sonra: o karenin yönünü/sayımını kullanırlar. */}
          <CrescentPreview />
          <StrikeEffect />
          <StrikeSparks />
          {/* Kamera oyuncuyu izler; OrbitControls kaldırıldı, ikisi çakışıyordu. */}
          <FollowCamera />
          <CameraShake />
          {/*
            Sırayı önceliklerle sabitlediğimiz için çizimi kendimiz tetikliyoruz
            (bkz. eski Renderer.tsx'in notu) — EffectComposer bunu renderPriority
            ile aynı şekilde devralıyor, aynı zamanda son çıktıyı efekt zincirinden
            geçiriyor. multisampling varsayılanı 8'di; bkz. perf/quality.ts.

            DPR değişince composer tamponları da küçülüyor: kademe değişimi
            Canvas'ı yeniden render ediyor, R3F bu sırada boyutu yeniden
            yazıyor ve EffectComposer boyut değişiminde tamponlarını kuruyor
            (ölçüldü: 1266×585 → 844×390). Elle senkron gerekmiyor.
          */}
          <EffectComposer renderPriority={10} multisampling={SESSION_MULTISAMPLING}>
            {effects}
          </EffectComposer>
        </Suspense>
      </Canvas>
      <HilalEnergyHUD />
      <TouchJoystick />
    </div>
  )
}
