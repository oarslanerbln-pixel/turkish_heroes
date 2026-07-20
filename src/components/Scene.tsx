import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { ACESFilmicToneMapping } from 'three'
import { Arena } from './Arena'
import { MetehanPlaceholder } from '../characters/metehan/MetehanPlaceholder'
import { CameraShake } from './CameraShake'
import { CrescentPreview } from './CrescentPreview'
import { FollowCamera } from './FollowCamera'
import { EnemySwarm } from './EnemySwarm'
import { GameDirector } from './GameDirector'
import { StrikeEffect } from './StrikeEffect'
import { HilalEnergyHUD } from './HilalEnergyHUD'
import { useStrikeInput } from '../hooks/useStrikeInput'
import { TouchJoystick } from '../hooks/useTouchControls'

// Bozkırın ufukta kaybolduğu sıcak pus. Gerçek bir gökyüzü/sis parçacık
// sistemi yerine bilinçli tercih: fog + düz arkaplan rengi aynı işi görüyor,
// ekstra geometri veya draw call gerektirmiyor (bkz. PLAN.md §4 — mobil
// bütçesi). Renk zeminle (#3d2b1a) ve sınır halkasıyla (#8b4a00) uyumlu.
const HAZE_COLOR = '#3a2211'

export function Scene() {
  useStrikeInput()

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d0500' }}>
      <Canvas
        shadows
        camera={{ position: [0, 18, 26], fov: 55 }}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        {/*
          Işıklandırma tamamen yerel. Daha önce drei'nin <Environment preset="sunset" />
          bileşeni vardı; harici bir CDN'den 1.4 MB HDR indiriyordu ve indirme
          tamamlanana kadar R3F'in Suspense sınırında askıda kalıp sahneyi bomboş
          bırakıyordu (konsola hata da düşmüyordu). Offline çalışması gereken bir
          PWA'da harici varlığa bağımlılık zaten kabul edilemezdi.
        */}
        <Suspense fallback={null}>
          <Stats />
          {/* Sahnede geometri olmayan yönlerde (ufkun üstü) bu renk görünür —
              sisle aynı renk, yoksa ufukta düz arkaplandan sise sert bir geçiş olurdu. */}
          <color attach="background" args={[HAZE_COLOR]} />
          <fog attach="fog" args={[HAZE_COLOR, 40, 95]} />
          <ambientLight intensity={0.45} />
          {/* Gökyüzü/toprak ayrımı — bozkır hissini ucuza veriyor. */}
          <hemisphereLight args={['#ffd9a0', '#3d2b1a', 0.7]} />
          {/* Alçak, sıcak güneş: uzun gölgeler. */}
          <directionalLight
            position={[18, 22, 12]}
            intensity={2.2}
            color="#ffd9a0"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-35}
            shadow-camera-right={35}
            shadow-camera-top={35}
            shadow-camera-bottom={-35}
            shadow-camera-far={80}
          />
          {/* Karşı yönden soğuk dolgu — siluetler tamamen kararmasın. */}
          <directionalLight position={[-14, 10, -16]} intensity={0.5} color="#6a7fa8" />
          <Arena />
          <MetehanPlaceholder />
          <EnemySwarm />
          <GameDirector />
          {/* Görseller yönetmenden sonra: o karenin yönünü/sayımını kullanırlar. */}
          <CrescentPreview />
          <StrikeEffect />
          {/* Kamera oyuncuyu izler; OrbitControls kaldırıldı, ikisi çakışıyordu. */}
          <FollowCamera />
          <CameraShake />
          {/*
            Sırayı önceliklerle sabitlediğimiz için çizimi kendimiz tetikliyoruz
            (bkz. eski Renderer.tsx'in notu) — EffectComposer bunu renderPriority
            ile aynı şekilde devralıyor, aynı zamanda son çıktıyı efekt zincirinden
            geçiriyor. Işık pasoları hafif tutuldu (mipmapBlur bloom, tek noise
            pasosu) — mobil bütçesini zorlamasın diye.
          */}
          <EffectComposer renderPriority={10}>
            <Bloom
              luminanceThreshold={0.55}
              luminanceSmoothing={0.2}
              intensity={0.7}
              mipmapBlur
            />
            <Vignette offset={0.3} darkness={0.6} />
            <Noise opacity={0.03} blendFunction={BlendFunction.OVERLAY} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      <HilalEnergyHUD />
      <TouchJoystick />
    </div>
  )
}
