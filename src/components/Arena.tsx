import { useRef } from 'react'
import { Mesh } from 'three'

export function Arena() {
  const groundRef = useRef<Mesh>(null)

  return (
    <group>
      {/* Zemin */}
      <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#3d2b1a" roughness={0.9} />
      </mesh>

      {/* Görsel sınır çizgisi — arena alanını belirtir */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[28, 30, 64]} />
        <meshStandardMaterial color="#8b4a00" roughness={0.8} />
      </mesh>
    </group>
  )
}
