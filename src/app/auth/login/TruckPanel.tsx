'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { VolvoTruck } from '@/components/landing/3d/VolvoTruck'
import { TruckEnvironment } from '@/components/landing/3d/TruckEnvironment'

function SlowTruck() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.18
    }
  })

  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      <VolvoTruck scale={1} />
    </group>
  )
}

function deterministicValue(index: number, axis: number) {
  const value = Math.sin((index + 1) * 12.9898 + axis * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function Particles({ color }: { color: string }) {
  const mesh = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const count = 40
    const values = new Float32Array(count * 3)

    for (let index = 0; index < count; index += 1) {
      values[index * 3] = (deterministicValue(index, 0) - 0.5) * 14
      values[index * 3 + 1] = (deterministicValue(index, 1) - 0.5) * 6
      values[index * 3 + 2] = (deterministicValue(index, 2) - 0.5) * 10
    }

    return values
  }, [])

  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.012
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.04} color={color} transparent opacity={0.5} sizeAttenuation />
    </points>
  )
}

export default function TruckPanel({ primary, isLight }: { primary: string; isLight: boolean }) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.5, 7], fov: 45 }}
      dpr={[1, 1.5]}
      style={{ width: '100%', height: '100%' }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <ambientLight intensity={isLight ? 1 : 0.4} />
      <directionalLight position={[8, 8, 5]} intensity={isLight ? 3 : 2.5} castShadow />
      <pointLight position={[-6, 3, 4]} color={primary} intensity={3} distance={15} />
      <TruckEnvironment primary={primary} isLight={isLight} />

      <Suspense fallback={null}>
        <SlowTruck />
        <Particles color={primary} />
        <ContactShadows
          position={[0, -1.8, 0]}
          opacity={isLight ? 0.15 : 0.5}
          scale={14}
          blur={2.5}
          color="#000"
        />
        <gridHelper args={[30, 30, primary, isLight ? '#d4d4d8' : '#111']} position={[0, -1.8, 0]} />
      </Suspense>
    </Canvas>
  )
}
