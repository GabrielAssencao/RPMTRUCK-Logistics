'use client'

import { useGLTF } from '@react-three/drei'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useTheme } from '@/contexts/ThemeContext'

interface VolvoTruckProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  [key: string]: unknown
}

export function VolvoTruck({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  ...props
}: VolvoTruckProps) {
  const group = useRef<THREE.Group>(null)
  const { primary } = useTheme()

  const modelPath = '/models/Volvo.glb'
  const { nodes, materials } = useGLTF(modelPath) as any

  // ── CORREÇÃO: atualiza APENAS a cor, sem recriar o material ──────────────────
  // Antes: `materials.paint.color = new THREE.Color(primary)` funcionava,
  // mas quando o componente re-renderizava por mudança de tema (isLight),
  // o material era recriado do zero e perdia o estado.
  // Agora: usamos uma ref para garantir que só atualizamos quando primary muda.
  const lastPrimary = useRef<string>('')

  useEffect(() => {
    if (!materials?.paint) return
    if (lastPrimary.current === primary) return  // evita update desnecessário

    lastPrimary.current = primary

    // Cria a cor uma vez e reatribui
    const color = new THREE.Color(primary)
    materials.paint.color.set(color)
    materials.paint.needsUpdate = true
  }, [primary, materials])

  const s = typeof scale === 'number' ? scale * 2.5 : scale

  return (
    <group ref={group} {...props} position={position} rotation={rotation} dispose={null}>
      <group rotation={[-Math.PI / 2, 0, 0]} scale={s}>
        <group rotation={[Math.PI / 2, 0, 0]}>

          {/* black_matte */}
          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003}>
            <mesh castShadow receiveShadow geometry={nodes.Object_6?.geometry}  material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_7?.geometry}  material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_8?.geometry}  material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_9?.geometry}  material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_10?.geometry} material={materials.black_matte} />
            <mesh castShadow receiveShadow geometry={nodes.Object_11?.geometry} material={materials.black_matte} />
          </group>

          {/* chrome */}
          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003}>
            <mesh castShadow receiveShadow geometry={nodes.Object_13?.geometry} material={materials.chrome} />
            <mesh castShadow receiveShadow geometry={nodes.Object_14?.geometry} material={materials.chrome} />
          </group>

          {/* paint — cor dinâmica */}
          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003}>
            <mesh castShadow receiveShadow geometry={nodes.Object_16?.geometry} material={materials.paint} />
            <mesh castShadow receiveShadow geometry={nodes.Object_17?.geometry} material={materials.paint} />
            <mesh castShadow receiveShadow geometry={nodes.Object_18?.geometry} material={materials.paint} />
          </group>

          {/* chrome 2 */}
          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003}>
            <mesh castShadow receiveShadow geometry={nodes.Object_20?.geometry} material={materials.chrome} />
            <mesh castShadow receiveShadow geometry={nodes.Object_21?.geometry} material={materials.chrome} />
          </group>

          {/* restante */}
          <mesh castShadow receiveShadow geometry={nodes.Object_4?.geometry}  material={materials['Plane.035__0']} position={[0, 0, -0.102]} scale={[0.606, 0.477, 1.148]} />
          <mesh castShadow receiveShadow geometry={nodes.Object_23?.geometry} material={materials.black_paint}        position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_25?.geometry} material={materials.glass}              position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_27?.geometry} material={materials.lights}             position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_29?.geometry} material={materials.glass}              position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_31?.geometry} material={materials.tire}               position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_33?.geometry} material={materials.black_matte}        position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_35?.geometry} material={materials['black_matte.002']} position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_37?.geometry} material={materials.red_glass}          position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_39?.geometry} material={materials['black_matte.003']} position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_41?.geometry} material={materials['black_matte.002']} position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_43?.geometry} material={materials.glass}              position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_45?.geometry} material={materials.red_glass}          position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_47?.geometry} material={materials.black_paint}        position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />
          <mesh castShadow receiveShadow geometry={nodes.Object_49?.geometry} material={materials['black_matte.001']} position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.003} />

        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/Volvo.glb')
