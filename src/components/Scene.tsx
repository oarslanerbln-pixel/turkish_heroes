import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Stats } from '@react-three/drei'
import { Arena } from './Arena'
import { MetehanPlaceholder } from '../characters/metehan/MetehanPlaceholder'
import { EnemySwarm } from './EnemySwarm'
import { GameDirector } from './GameDirector'
import { StrikeEffect } from './StrikeEffect'
import { HilalEnergyHUD } from './HilalEnergyHUD'
import { useStrikeInput } from '../hooks/useStrikeInput'

export function Scene() {
  useStrikeInput()

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d0500' }}>
      <Canvas
        shadows
        camera={{ position: [0, 18, 26], fov: 55 }}
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
        <EnemySwarm />
        <StrikeEffect />
        <GameDirector />
        <OrbitControls makeDefault target={[0, 0, 0]} />
      </Canvas>
      <HilalEnergyHUD />
    </div>
  )
}
