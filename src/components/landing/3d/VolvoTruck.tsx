'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useTheme } from '@/contexts/ThemeContext'

interface VolvoTruckProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  [key: string]: unknown
}

const MODEL_PATH = '/models/Volvo-opt.glb'
const DRACO_DECODER_PATH = '/draco/gltf/'

export function VolvoTruck({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  ...props
}: VolvoTruckProps) {
  const { primary } = useTheme()
  const { scene } = useGLTF(MODEL_PATH, DRACO_DECODER_PATH)

  const { model, ownedMaterials } = useMemo(() => {
    const clonedScene = scene.clone(true)
    const clonedMaterials: THREE.Material[] = []

    clonedScene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return

      // ContactShadows fornece a sombra de solo sem ativar shadow maps globais.
      object.castShadow = false
      object.receiveShadow = false

      const sourceMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material]

      const mappedMaterials = sourceMaterials.map((material) => {
        if (material.name !== 'paint') return material

        const paintMaterial = material.clone()
        if (paintMaterial instanceof THREE.MeshStandardMaterial) {
          paintMaterial.color.set(primary)
        }
        clonedMaterials.push(paintMaterial)
        return paintMaterial
      })

      object.material = Array.isArray(object.material)
        ? mappedMaterials
        : mappedMaterials[0]
    })

    return { model: clonedScene, ownedMaterials: clonedMaterials }
  }, [primary, scene])

  useEffect(() => {
    return () => ownedMaterials.forEach((material) => material.dispose())
  }, [ownedMaterials])

  return (
    <group {...props} position={position} rotation={rotation} dispose={null}>
      <primitive object={model} scale={scale} />
    </group>
  )
}

useGLTF.preload(MODEL_PATH, DRACO_DECODER_PATH)
