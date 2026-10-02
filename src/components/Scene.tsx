import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor, Stats } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Terrain } from './world/Terrain'
import { Stones } from './world/Stones'
import { Grass } from './world/Grass'
import { StrikeSparks } from './StrikeSparks'
import { Camp } from './world/Camp'
import { Blockade } from './world/Blockade'
import { CorpsBanners } from './CorpsBanners'
import { AlliedWings } from './AlliedWings'
import { ChargeWarnings } from './ChargeWarnings'
import { ArrowVolley } from './ArrowVolley'
import { DustTrails } from './DustTrails'
import { SteppeWind } from './SteppeWind'
import { DayCycle } from './DayCycle'
import { TuningPanel } from './TuningPanel'
import { MetehanPlaceholder } from '../characters/metehan/MetehanPlaceholder'
import { CameraShake } from './CameraShake'
import { CrescentPreview } from './CrescentPreview'
import { FollowCamera } from './FollowCamera'
import { EnemySwarm } from './EnemySwarm'
import { GameDirector } from './GameDirector'
import { StrikeEffect } from './StrikeEffect'
import { HilalEnergyHUD } from './HilalEnergyHUD'
import { useStrikeInput } from '../hooks/useStrikeInput'
import { useAutoPause } from '../hooks/useAutoPause'
import { TouchJoystick } from './TouchJoystick'
import { useGameStore } from '../store/gameStore'
import { PERF_OVERLAY, QUALITY, SESSION_MULTISAMPLING, useQuality } from '../perf/quality'
import { PLAYTEST } from '../playtest'

/** Canlı ayar paneli yalnızca oyun testi derlemesinde ?tune ile. */
const TUNING_ENABLED = PLAYTEST && new URLSearchParams(window.location.search).has('tune')

/**
 * Menüde sahne 'demand' modunda: yalnızca istenince çizilir. Başlangıç
 * ekranında komutan değişince arkadaki sahne (ordu, ordugah) yeni savaşı
 * göstersin diye bir kare iste.
 */
function InvalidateOnCommander() {
  const invalidate = useThree((s) => s.invalidate)
  const commander = useGameStore((s) => s.commander)
  useEffect(() => invalidate(), [commander, invalidate])
  return null
}

export function Scene() {
  useStrikeInput()
  useAutoPause()
  const tier = useQuality((s) => s.tier)
  const adaptive = useQuality((s) => !s.locked)
  const step = useQuality((s) => s.step)
  // Menülerde (başlangıç, mola, sonuç) sahne yarı saydam bir katmanın arkasında donuk
  // duruyor; saniyede 60 kez yeniden çizmek yalnızca pil ve ısı harcıyordu.
  // 'demand' modunda R3F yalnızca gerektiğinde (ör. boyut değişince) çizer.
  const playing = useGameStore((s) => s.started && s.outcome === 'playing' && !s.paused)
  const preset = QUALITY[tier]
  const commander = useGameStore((s) => s.commander)

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
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#14060a' }}>
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
        onCreated={({ gl, scene }) => {
          if (import.meta.env.DEV) Object.assign(globalThis, { __gl: gl, __scene: scene })
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
          {/* Işık, sis ve gökyüzü: savaş saatine göre (Metehan'da hep öğle). */}
          <DayCycle />
          <InvalidateOnCommander />
          <Terrain />
          <Stones />
          <Grass />
          <SteppeWind />
          {commander === 'alp-arslan' && <Camp />}
          {commander === 'kilicarslan' && <Blockade />}
          <MetehanPlaceholder />
          <EnemySwarm />
          <GameDirector />
          {/* Görseller yönetmenden sonra: o karenin yönünü/sayımını kullanırlar. */}
          <CrescentPreview />
          <StrikeEffect />
          <StrikeSparks />
          <DustTrails />
          {commander !== 'metehan' && (
            <>
              <CorpsBanners />
              <AlliedWings />
              <ChargeWarnings />
              <ArrowVolley />
            </>
          )}
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
      {TUNING_ENABLED && commander === 'alp-arslan' && (
        <div className="hud">
          <TuningPanel />
        </div>
      )}
      <TouchJoystick />
    </div>
  )
}
