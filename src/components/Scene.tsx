import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { Arena } from './Arena'
import { MetehanPlaceholder } from '../characters/metehan/MetehanPlaceholder'
import { CameraShake } from './CameraShake'
import { CrescentPreview } from './CrescentPreview'
import { FollowCamera } from './FollowCamera'
import { EnemySwarm } from './EnemySwarm'
import { GameDirector } from './GameDirector'
import { Renderer } from './Renderer'
import { StrikeEffect } from './StrikeEffect'
import { HilalEnergyHUD } from './HilalEnergyHUD'
import { useStrikeInput } from '../hooks/useStrikeInput'
import { TouchJoystick } from '../hooks/useTouchControls'

export function Scene() {
  useStrikeInput()

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d0500' }}>
      <Canvas
        shadows
        camera={{ position: [0, 18, 26], fov: 55 }}
        gl={{ antialias: true }}
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
          {/* Sırayı önceliklerle sabitlediğimiz için çizim bize kalıyor. */}
          <Renderer />
        </Suspense>
      </Canvas>
      <HilalEnergyHUD />
      <TouchJoystick />
    </div>
  )
}
