'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, useGLTF } from '@react-three/drei'
import { Suspense, useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'

// ─── Caminhão com rotação lenta e suave ────────────────────────────────────────
function SlowTruck({ primary }: { primary: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const { nodes, materials } = useGLTF('/models/Volvo.glb') as any

  // 🎯 CLONAMOS a cor e o material para NÃO alterar o caminhão da Landing Page
  const paintMaterial = useMemo(() => {
    if (materials?.paint) {
      const mat = materials.paint.clone()
      mat.color = new THREE.Color(primary)
      return mat
    }
    return null
  }, [materials, primary])

  // Rotação lenta e contínua
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.18
    }
  })

  if (!nodes) return null

  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]} scale={2.5}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003}>
            <mesh castShadow receiveShadow geometry={nodes.Object_6?.geometry}  material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_7?.geometry}  material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_8?.geometry}  material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_9?.geometry}  material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_10?.geometry} material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_11?.geometry} material={materials.black_matte} />
          </group>
          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003}>
            <mesh castShadow receiveShadow geometry={nodes.Object_13?.geometry} material={materials.chrome} />
            <mesh castShadow receiveShadow geometry={nodes.Object_14?.geometry} material={materials.chrome} />
          </group>
          
          {/* Aplica a cor clonada exclusiva desta tela */}
          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003}>
            <mesh castShadow receiveShadow geometry={nodes.Object_16?.geometry} material={paintMaterial || materials.paint} />
            <mesh castShadow receiveShadow geometry={nodes.Object_17?.geometry} material={paintMaterial || materials.paint} />
            <mesh castShadow receiveShadow geometry={nodes.Object_18?.geometry} material={paintMaterial || materials.paint} />
          </group>

          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003}>
            <mesh castShadow receiveShadow geometry={nodes.Object_20?.geometry} material={materials.chrome} />
            <mesh castShadow receiveShadow geometry={nodes.Object_21?.geometry} material={materials.chrome} />
          </group>
          <mesh castShadow receiveShadow geometry={nodes.Object_4?.geometry}  material={materials['Plane.035__0']} position={[0, 0, -0.102]} scale={[0.606, 0.477, 1.148]} />
          <mesh castShadow receiveShadow geometry={nodes.Object_23?.geometry} material={materials.black_paint}        position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_25?.geometry} material={materials.glass}              position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_27?.geometry} material={materials.lights}             position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_29?.geometry} material={materials.glass}              position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_31?.geometry} material={materials.tire}               position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_33?.geometry} material={materials.black_matte}        position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_37?.geometry} material={materials.red_glass}          position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_43?.geometry} material={materials.glass}              position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_45?.geometry} material={materials.red_glass}          position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_47?.geometry} material={materials.black_paint}        position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
        </group>
      </group>
    </group>
  )
}

// ─── Partículas flutuantes ─────────────────────────────────────────────────────
function Particles({ color }: { color: string }) {
  const mesh = useRef<THREE.Points>(null)
  const count = 40
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 14
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return arr
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

// ─── Canvas principal ──────────────────────────────────────────────────────────
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

      <Environment preset="city" />

      <Suspense fallback={null}>
        <SlowTruck primary={primary} />
        <Particles color={primary} />
        <ContactShadows position={[0, -1.8, 0]} opacity={isLight ? 0.15 : 0.5} scale={14} blur={2.5} color="#000" />
        <gridHelper args={[30, 30, primary, isLight ? '#d4d4d8' : '#111']} position={[0, -1.8, 0]} />
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload('/models/Volvo.glb')