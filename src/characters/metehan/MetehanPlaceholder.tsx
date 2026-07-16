import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'

// Metehan'ın gerçek 3D modeli gelene kadar placeholder geometri
export function MetehanPlaceholder() {
  const bodyRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (bodyRef.current) {
      bodyRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Gövde */}
      <mesh ref={bodyRef} position={[0, 1.2, 0]} castShadow>
        <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
        <meshStandardMaterial color="#8b4a00" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Baş */}
      <mesh position={[0, 2.3, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#c8a47a" roughness={0.8} />
      </mesh>
    </group>
  )
}
