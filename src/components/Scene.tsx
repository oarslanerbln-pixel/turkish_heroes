import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Stats } from '@react-three/drei'
import { Arena } from './Arena'
import { MetehanPlaceholder } from '../characters/metehan/MetehanPlaceholder'
import { HilalEnergyHUD } from './HilalEnergyHUD'

export function Scene() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d0500' }}>
      <Canvas
        shadows
        camera={{ position: [0, 8, 16], fov: 60 }}
        gl={{ antialias: true }}
      >
        <Stats />
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Environment preset="sunset" />
        <Arena />
        <MetehanPlaceholder />
        <OrbitControls makeDefault />
      </Canvas>
      <HilalEnergyHUD />
    </div>
  )
}
