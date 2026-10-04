import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor, Stats } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
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
import { CrossbowVolleys } from './CrossbowVolleys'
import { HunRing } from './HunRing'
import { DustTrails } from './DustTrails'
import { SteppeWind } from './SteppeWind'
import { DayCycle } from './DayCycle'
import { TuningPanel } from './TuningPanel'
import { MetehanPlaceholder } from '../characters/metehan/MetehanPlaceholder'
import { CameraShake } from './CameraShake'
import { CrescentPreview } from './CrescentPreview'
import { CameraDirector } from './CameraDirector'
import { EnemySwarm } from './EnemySwarm'
import { GameDirector } from './GameDirector'
import { EventFlush } from './EventFlush'
import { StrikeEffect } from './StrikeEffect'
import { HilalEnergyHUD } from './HilalEnergyHUD'
import { useStrikeInput } from '../hooks/useStrikeInput'
import { useAutoPause } from '../hooks/useAutoPause'
import { TouchJoystick } from './TouchJoystick'
import { CrashScreen } from './CrashScreen'
import { ShotDirector } from './ShotDirector'
import { ArtProbe } from './ArtProbe'
import { useGameStore } from '../store/gameStore'
import { PERF_OVERLAY, QUALITY, SESSION_MULTISAMPLING, useQuality } from '../perf/quality'
import { PLAYTEST } from '../playtest'
import { SHOT } from '../shot'

/** Canlı ayar paneli yalnızca oyun testi derlemesinde ?tune ile. */
const TUNING_ENABLED = PLAYTEST && new URLSearchParams(window.location.search).has('tune')

/**
 * Menüde sahne 'demand' modunda: yalnızca istenince çizilir. Komutan
 * değişince ya da savaştan menüye dönülünce arkadaki sahne yeni savaşın
 * açılış karesini göstersin diye bir kare iste; yoksa bitmiş savaşın son
 * karesi donuk kalır ve SAVAŞA GİR o kareden sert keser.
 */
function InvalidateOnFlow() {
  const invalidate = useThree((s) => s.invalidate)
  const commander = useGameStore((s) => s.commander)
  const inMenu = useGameStore((s) => s.mode === 'menu')
  useEffect(() => invalidate(), [commander, inMenu, invalidate])
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
  const playing = useGameStore((s) => s.mode === 'playing')
  const preset = QUALITY[tier]
  const commander = useGameStore((s) => s.commander)
  const [gpuLost, setGpuLost] = useState(false)

  // Efekt listesi kademe değişmedikçe aynı nesne kalsın: EffectComposer,
  // çocukları her değiştiğinde efekt pasolarını baştan kuruyor.
  const effects = useMemo(
    () => (
      <>
        {preset.bloom && (
          <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.2} intensity={0.7} mipmapBlur />
        )}
        {/* Işık yüksek dinamik aralıkta birikir; ekrana ACES eğrisiyle iner (STIL.md §Ton). */}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
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
        frameloop={SHOT !== null ? 'never' : playing ? 'always' : 'demand'}
        camera={{ position: [0, 18, 26], fov: 55 }}
        gl={{
          // Kenar yumuşatmayı EffectComposer'ın MSAA'sı yapıyor. Canvas'ın kendi
          // MSAA'sı yalnızca son tam ekran üçgenine uygulanıyordu: bedeli
          // ödenip hiçbir kenara faydası olmayan bir tampon.
          antialias: false,
          stencil: false,
          powerPreference: 'high-performance',
          // Ton eşleme burada değil, efekt zincirinde: EffectComposer
          // renderer'ınkini kapatıyor (bkz. effects).
        }}
        onCreated={({ gl, scene, invalidate }) => {
          if (import.meta.env.DEV) Object.assign(globalThis, { __gl: gl, __scene: scene })
          // Telefon GPU belleğini geri alınca bağlam kaybolur. three kaybı
          // kendisi karşılar (preventDefault) ve geri gelince kaynakları yeniden
          // yükler; bize düşen savaşı durdurmak, söylemek ve bir kare istemek.
          const canvas = gl.domElement
          canvas.addEventListener('webglcontextlost', () => {
            useGameStore.getState().pause(true)
            setGpuLost(true)
          })
          canvas.addEventListener('webglcontextrestored', () => {
            setGpuLost(false)
            invalidate()
          })
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
            Çekim kipinde kapalı: ara adımlar çizilmez, ölçülen FPS anlamsızdır.
          */}
          {adaptive && SHOT === null && (
            <PerformanceMonitor onIncline={() => step(1)} onDecline={() => step(-1)} />
          )}
          {/* Işık, sis ve gökyüzü: savaş saatine göre (Metehan'da hep öğle). */}
          <DayCycle />
          <InvalidateOnFlow />
          {SHOT !== null && <ShotDirector moment={SHOT} />}
          {SHOT !== null && <ArtProbe />}
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
          {/* Metehan'ın son dalgası Baideng: Han yaylımı ve dört renkli çember. */}
          {commander === 'metehan' && (
            <>
              <CrossbowVolleys />
              <HunRing />
            </>
          )}
          {/* Kamera oyuncuyu izler; OrbitControls kaldırıldı, ikisi çakışıyordu. */}
          <CameraDirector />
          <CameraShake />
          <EventFlush />
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
      {gpuLost && <CrashScreen kind="gpu" />}
    </div>
  )
}
