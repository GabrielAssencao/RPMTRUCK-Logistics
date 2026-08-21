'use client'

import { Environment, Lightformer } from '@react-three/drei'

interface TruckEnvironmentProps {
  primary: string
  isLight: boolean
}

export function TruckEnvironment({ primary, isLight }: TruckEnvironmentProps) {
  return (
    <Environment resolution={128} environmentIntensity={isLight ? 0.8 : 1.15}>
      <Lightformer
        form="rect"
        color="white"
        intensity={5}
        position={[6, 6, 5]}
        scale={[10, 6, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        color="white"
        intensity={3}
        position={[-6, 2, 4]}
        scale={[7, 4, 1]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        color={primary}
        intensity={1.5}
        position={[0, 4, -6]}
        scale={[8, 3, 1]}
        target={[0, 0, 0]}
      />
    </Environment>
  )
}
