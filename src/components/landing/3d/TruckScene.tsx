'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, PerformanceMonitor } from '@react-three/drei'
import { Suspense, useRef, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { VolvoTruck } from './VolvoTruck'
import { TruckEnvironment } from './TruckEnvironment'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

interface AnimState {
  truckX: number
  truckY: number
  truckZ: number
  truckRotX: number
  truckRotY: number
  truckRotZ: number
  truckScale: number
  particlesSpeed: number
  gridY: number
  cameraZoom: number
  pointLightIntensity: number
}

function AutoTruck({ animStateRef }: { animStateRef: React.MutableRefObject<AnimState> }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!groupRef.current) return
    const s = animStateRef.current

    groupRef.current.position.set(s.truckX, s.truckY, s.truckZ)
    groupRef.current.rotation.set(s.truckRotX, s.truckRotY, s.truckRotZ)
    groupRef.current.scale.setScalar(s.truckScale)
  })

  return (
    <group ref={groupRef}>
      <VolvoTruck scale={1} />
    </group>
  )
}

interface CubeItem {
  radius: number
  angle: number
  y: number
  depth: number
  scale: number
  speed: number
  phase: number
  geometryIndex: number
  color: string
  alpha: number
  visible: boolean
  broken: boolean
  breakTime?: number
}

interface Fragment {
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: string
  scale: number
  rotation: THREE.Euler
  rotationVelocity: THREE.Vector3
  lifespan: number
  maxLifespan: number
}

function deterministicValue(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function createOrbitData(geometryCount: number, palette: string[]): CubeItem[] {
  return Array.from({ length: 8 }, (_, index) => ({
    radius: 2.5 + (index % 4) * 0.7,
    angle: (index / 8) * Math.PI * 2,
    y: 1.4 + (deterministicValue(index, 0) - 0.5) * 3.2,
    depth: (deterministicValue(index, 1) - 0.5) * 7,
    scale: 0.5 + deterministicValue(index, 2) * 0.9,
    speed: 0.35 + deterministicValue(index, 3),
    phase: deterministicValue(index, 4) * Math.PI * 2,
    geometryIndex: index % geometryCount,
    color: palette[index % palette.length],
    alpha: 0.8,
    visible: true,
    broken: false,
  }))
}

function GeometricField({ animStateRef, color, isLight }: { animStateRef: React.MutableRefObject<AnimState>; color: string; isLight: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const meshesRef = useRef<THREE.Mesh[]>([])
  const fragmentsRef = useRef<Fragment[]>([])
  const fragmentMeshesRef = useRef<THREE.Mesh[]>([])

  const geometrySet = useMemo(
    () => [
      new THREE.BoxGeometry(0.38, 0.38, 0.38),
      new THREE.OctahedronGeometry(0.32),
      new THREE.TetrahedronGeometry(0.3),
    ],
    []
  )

  // Base sizes for each geometry type for collision calculation
  const geometrySizes = useMemo(
    () => [0.27, 0.23, 0.21], // Effective collision radius for each geometry
    []
  )

  const palette = useMemo(
    () => {
      const white = isLight ? '#f8fafc' : '#e5e7eb'
      return [color, white, color, white, color, white]
    },
    [color, isLight]
  )

  const renderedOrbitData = useMemo(
    () => createOrbitData(geometrySet.length, palette),
    [geometrySet, palette]
  )
  const orbitData = useRef<CubeItem[]>(renderedOrbitData.map((item) => ({ ...item })))

  useEffect(() => {
    orbitData.current = renderedOrbitData.map((item) => ({ ...item }))
  }, [renderedOrbitData])

  const createFragments = (position: THREE.Vector3, color: string, scale: number) => {
    const fragmentCount = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < fragmentCount; i++) {
      const angle = (i / fragmentCount) * Math.PI * 2
      const speed = 0.8 + Math.random() * 0.6
      const elevationAngle = (Math.random() - 0.5) * Math.PI * 0.6
      
      const velocity = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevationAngle) * speed,
        Math.sin(elevationAngle) * speed + 0.3,
        Math.sin(angle) * Math.cos(elevationAngle) * speed
      )

      fragmentsRef.current.push({
        position: position.clone(),
        velocity,
        color,
        scale: scale * (0.3 + Math.random() * 0.4),
        rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotationVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        ),
        lifespan: 0,
        maxLifespan: 0.8 + Math.random() * 0.5,
      })
    }
  }

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const t = state.clock.elapsedTime
    const truckX = animStateRef.current.truckX
    const truckY = animStateRef.current.truckY
    const truckZ = animStateRef.current.truckZ

    groupRef.current.rotation.y += delta * (0.08 + animStateRef.current.particlesSpeed * 0.5)
    groupRef.current.rotation.z = Math.sin(t * 0.7) * 0.12

    // Update main cubes
    meshesRef.current.forEach((mesh, index) => {
      const item = orbitData.current[index]
      if (!item || item.broken) return

      // More cinematic orbit path with layered sine waves
      const breath = 1 + Math.sin(t * item.speed + item.phase) * 0.32
      const cinematicRadius = item.radius + Math.sin(t * (0.9 + item.speed * 0.35) + item.phase) * 0.7
      const driftX = Math.sin(t * 1.1 + item.phase) * 0.9 + Math.sin(t * 0.3 + item.phase) * 0.4
      const driftY = Math.cos(t * 1.4 + item.phase) * 0.8 + Math.sin(t * 0.5 + item.phase) * 0.3
      const orbitAngle = item.angle + t * (0.42 + item.speed * 0.09) + Math.sin(t * 0.6 + item.phase) * 0.2
      const orbitX = Math.cos(orbitAngle) * cinematicRadius + driftX
      const orbitZ = Math.sin(orbitAngle) * cinematicRadius + Math.sin(t * 0.9 + item.phase) * 0.8
      const finalX = orbitX + truckX
      const finalY = item.y + driftY + truckY
      const finalZ = orbitZ + item.depth + truckZ

      const distanceToTruck = Math.hypot(finalX - truckX, finalY - truckY, finalZ - truckZ)
      const outOfBounds = Math.abs(finalX) > 12 || Math.abs(finalZ) > 12 || Math.abs(finalY) > 8

      // Collision detection with geometry-aware radius
      // Calculate effective collision radius based on geometry type and scale
      const baseGeometrySize = geometrySizes[item.geometryIndex] || 0.25
      const effectiveCollisionRadius = baseGeometrySize * item.scale + 0.45
      
      if (distanceToTruck < effectiveCollisionRadius && !item.broken) {
        item.broken = true
        item.breakTime = t
        mesh.visible = false
        createFragments(new THREE.Vector3(finalX, finalY, finalZ), item.color, item.scale)
        return
      }

      if (outOfBounds || item.broken) {
        item.visible = false
        mesh.visible = false
        return
      }

      item.visible = true
      mesh.visible = true
      mesh.position.set(finalX, finalY, finalZ)
      mesh.rotation.x += delta * 0.5
      mesh.rotation.y += delta * 0.8
      mesh.scale.setScalar(item.scale * breath)

    })

    // Update fragments with gravity and fade
    fragmentsRef.current = fragmentsRef.current.filter((frag) => {
      frag.lifespan += delta
      const progress = frag.lifespan / frag.maxLifespan

      if (progress >= 1) return false

      // Apply gravity
      frag.velocity.y -= 9.8 * delta * 0.3
      frag.position.addScaledVector(frag.velocity, delta)

      // Apply rotation
      frag.rotation.x += frag.rotationVelocity.x * delta
      frag.rotation.y += frag.rotationVelocity.y * delta
      frag.rotation.z += frag.rotationVelocity.z * delta

      return true
    })

    // Render fragments
    fragmentMeshesRef.current.forEach((mesh, index) => {
      if (index >= fragmentsRef.current.length) {
        mesh.visible = false
        return
      }

      const frag = fragmentsRef.current[index]
      const progress = frag.lifespan / frag.maxLifespan

      mesh.visible = true
      mesh.position.copy(frag.position)
      mesh.rotation.set(frag.rotation.x, frag.rotation.y, frag.rotation.z)
      mesh.scale.setScalar(frag.scale * (1 - progress * 0.5))

      const material = mesh.material as THREE.MeshStandardMaterial
      if (material) {
        material.opacity = frag.maxLifespan > 0 ? (1 - progress) * 0.9 : 0
      }
    })
  })

  return (
    <group ref={groupRef}>
      {/* Main cubes */}
      {renderedOrbitData.map((item, index) => (
        <mesh
          key={`cube-${index}`}
          visible={item.visible}
          ref={(node) => {
            if (node) meshesRef.current[index] = node
          }}
          geometry={geometrySet[item.geometryIndex]}
        >
          <meshStandardMaterial
            color={item.color}
            emissive={item.color}
            emissiveIntensity={isLight ? 0.25 : 0.5}
            metalness={0.18}
            roughness={0.55}
            transparent
            opacity={item.alpha}
          />
        </mesh>
      ))}

      {/* Fragment pieces from broken cubes */}
      {Array.from({ length: 24 }).map((_, index) => (
        <mesh
          key={`fragment-${index}`}
          visible={false}
          ref={(node) => {
            if (node) fragmentMeshesRef.current[index] = node
          }}
          geometry={geometrySet[0]}
        >
          <meshStandardMaterial
            color="#fff"
            emissive="#fff"
            emissiveIntensity={isLight ? 0.15 : 0.3}
            metalness={0.25}
            roughness={0.6}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  )
}

function SceneHelpers({
  animStateRef,
  primary,
  isLight,
}: {
  animStateRef: React.MutableRefObject<AnimState>
  primary: string
  isLight: boolean
}) {
  const gridRef = useRef<THREE.GridHelper>(null)
  const pointLightRef = useRef<THREE.PointLight>(null)
  const cameraStateRef = useRef({ z: Number.NaN, lookAtY: Number.NaN })

  useFrame((state) => {
    const s = animStateRef.current

    // Atualiza a câmera somente quando os valores controlados pelo scroll mudam.
    const cameraZ = 8 / s.cameraZoom
    const lookAtY = s.truckY + 1.2
    const previousCameraState = cameraStateRef.current

    if (
      !Number.isFinite(previousCameraState.z) ||
      Math.abs(previousCameraState.z - cameraZ) > 0.0001 ||
      Math.abs(previousCameraState.lookAtY - lookAtY) > 0.0001
    ) {
      state.camera.position.z = cameraZ
      state.camera.lookAt(0, lookAtY, 0)
      previousCameraState.z = cameraZ
      previousCameraState.lookAtY = lookAtY
    }

    // Update grid helper position
    if (gridRef.current) {
      gridRef.current.position.y = s.gridY
    }

    // Update point light intensity
    if (pointLightRef.current) {
      pointLightRef.current.intensity = isLight
        ? s.pointLightIntensity * 0.15
        : s.pointLightIntensity
    }
  })

  return (
    <>
      <ambientLight intensity={isLight ? 0.65 : 0.04} />
      <directionalLight position={[8, 8, 5]} intensity={isLight ? 1.4 : 0.15} />
      <pointLight ref={pointLightRef} position={[3, 1, 4]} color={primary} distance={15} decay={1.5} />
      <spotLight position={[-5, 5, -5]} color={primary} intensity={isLight ? 0 : 10} angle={0.6} penumbra={1} distance={18} />

      <ContactShadows
        position={[0, -2.2, 0]}
        opacity={isLight ? 0.2 : 0.8}
        scale={18}
        blur={2.5}
        resolution={256}
        color="#000"
      />
      <gridHelper
        ref={gridRef}
        args={[40, 40, primary, isLight ? '#d4d4d8' : '#111']}
        position={[0, -2.2, 0]}
      />
    </>
  )
}

export default function TruckScene({ children }: { children?: React.ReactNode }) {
  const theme = useTheme()
  const { isLight, primary } = theme
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [isSceneAnimating, setIsSceneAnimating] = useState(true)
  const [maxSceneDpr, setMaxSceneDpr] = useState(1.25)

  // Initial animation parameters
  const animStateRef = useRef<AnimState>({
    truckX: 2,
    truckY: -1,
    truckZ: 0,
    truckRotX: 0,
    truckRotY: 0.5,
    truckRotZ: 0,
    truckScale: 1,
    particlesSpeed: 0.015,
    gridY: -2.2,
    cameraZoom: 1,
    pointLightIntensity: 20,
  })

  const containerRef = useRef<HTMLDivElement>(null)

  const sceneBackdrop = isLight
    ? `radial-gradient(circle at 50% 32%, ${primary}20 0%, rgba(255,255,255,0.68) 18%, rgba(255,255,255,0.42) 32%, rgba(255,255,255,0.12) 52%, rgba(255,255,255,0.04) 72%, transparent 100%), linear-gradient(90deg, rgba(255,255,255,0.06) 0%, ${primary}08 22%, rgba(255,255,255,0.04) 52%, ${primary}08 100%)`
    : `radial-gradient(circle at 50% 32%, ${primary}18 0%, rgba(10,10,10,0.68) 18%, rgba(10,10,10,0.5) 32%, rgba(10,10,10,0.16) 52%, rgba(10,10,10,0.03) 74%, transparent 100%), linear-gradient(90deg, rgba(255,255,255,0.01) 0%, ${primary}08 22%, rgba(10,10,10,0.08) 52%, ${primary}08 100%)`

  useGSAP(() => {
    if (!containerRef.current) return

    if (prefersReducedMotion) {
      gsap.set([
        '#hero-title-main',
        '#hero-subtitle',
        '.hero-button',
        '#card-wrapper-1',
        '#card-wrapper-2',
        '#card-wrapper-3',
        '#tech-banner-text',
        '#main-content-start',
      ], {
        opacity: 1,
        y: 0,
        scale: 1,
      })
      gsap.set('#tech-banner-line', {
        opacity: 1,
        width: 'min(70vw, 760px)',
      })

      return
    }

    gsap.fromTo('#hero-title-main',
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power4.out', delay: 0.3 }
    )
    gsap.fromTo('#hero-subtitle',
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.6 }
    )
    gsap.fromTo('.hero-button',
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 0.8, stagger: 0.15, ease: 'back.out(1.2)', delay: 0.9 }
    )

    const transitionSection = containerRef.current.querySelector<HTMLElement>('#trigger-transition')
    if (!transitionSection) return

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        endTrigger: transitionSection,
        end: 'bottom bottom',
        scrub: 0.35,
        invalidateOnRefresh: true,
        onEnter: () => setIsSceneAnimating(true),
        onEnterBack: () => setIsSceneAnimating(true),
        onLeave: () => setIsSceneAnimating(false),
        onLeaveBack: () => setIsSceneAnimating(true),
      }
    })

    // Sequential animation beats on scroll with a softer cinematic pace
    tl.to(animStateRef.current, {
      truckX: 0,
      truckY: -1,
      truckRotY: -0.3,
      truckRotX: 0,
      duration: 1,
      ease: 'sine.inOut'
    }, 0)

    tl.to('#card-wrapper-1', {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power2.out'
    }, 0.2)
    tl.to('#card-wrapper-1', {
      opacity: 0,
      y: -40,
      duration: 0.6,
      ease: 'power2.in'
    }, 1.8)

    tl.to(animStateRef.current, {
      truckX: -2.2,
      truckY: -1.5,
      truckRotY: -Math.PI * 0.6,
      duration: 1,
      ease: 'sine.inOut'
    }, 1.45)

    tl.to('#card-wrapper-2', {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power2.out'
    }, 1.5)
    tl.to('#card-wrapper-2', {
      opacity: 0,
      y: -40,
      duration: 0.6,
      ease: 'power2.in'
    }, 3.1)

    tl.to(animStateRef.current, {
      truckX: 0,
      truckY: -1.5,
      truckRotY: -Math.PI * 2.1,
      truckRotX: 0.24,
      duration: 1,
      ease: 'sine.inOut'
    }, 2.7)

    tl.to('#card-wrapper-3', {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power2.out'
    }, 2.8)
    tl.to('#card-wrapper-3', {
      opacity: 0,
      y: -40,
      duration: 0.6,
      ease: 'power2.in'
    }, 4.45)

    // Alinha o caminhão à estrada antes da arrancada final.
    tl.to(animStateRef.current, {
      truckX: 0.55,
      truckY: -1.5,
      truckZ: -1.2,
      truckRotX: 0,
      truckRotY: -Math.PI * 2.04,
      truckRotZ: 0,
      truckScale: 0.92,
      cameraZoom: 1.08,
      duration: 0.45,
      ease: 'power2.out'
    }, 4.15)

    // Acelera em perspectiva até o horizonte, em vez de cair para fora da cena.
    tl.to(animStateRef.current, {
      truckX: 0,
      truckY: -1.08,
      truckZ: -18,
      truckRotY: -Math.PI * 2,
      truckScale: 0.18,
      gridY: -4.8,
      cameraZoom: 0.92,
      pointLightIntensity: 2,
      duration: 0.75,
      ease: 'power3.in'
    }, 4.4)

    tl.to(animStateRef.current, {
      truckZ: -28,
      truckScale: 0.01,
      pointLightIntensity: 0,
      duration: 0.25,
      ease: 'power2.in'
    }, 5.15)

    tl.to(animStateRef.current, {
      particlesSpeed: 0.2,
      duration: 0.55,
      ease: 'power2.in'
    }, 4.3)
    tl.to(animStateRef.current, {
      particlesSpeed: 0.012,
      duration: 0.4,
      ease: 'power2.out'
    }, 5.0)

    tl.fromTo('#truck-departure-glow',
      { opacity: 0, scale: 0.72 },
      { opacity: isLight ? 0.28 : 0.55, scale: 1.08, duration: 0.35, ease: 'power2.out' },
      4.3
    )
    tl.to('#truck-departure-glow', {
      opacity: 0,
      scale: 1.35,
      duration: 0.45,
      ease: 'power2.in'
    }, 4.8)

    tl.to('#tech-banner-text', {
      opacity: 1,
      scale: 1,
      letterSpacing: '0.18em',
      duration: 0.4,
      ease: 'back.out(1.5)'
    }, 4.25)
    tl.fromTo('#tech-banner-line',
      { opacity: 0, width: 0 },
      { opacity: 0.75, width: 'min(70vw, 760px)', duration: 0.45, ease: 'power3.out' },
      4.25
    )
    tl.to('#tech-banner-text', {
      opacity: 0,
      y: -60,
      duration: 0.3,
      ease: 'power2.in'
    }, 5.05)
    tl.to('#tech-banner-line', {
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in'
    }, 5.1)

    tl.fromTo('#main-content-start',
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' },
      4.85
    )
    tl.to('#truck-scene-layer', {
      autoAlpha: 0,
      duration: 0.35,
      ease: 'power2.inOut'
    }, 5.05)
  }, { scope: containerRef, dependencies: [primary, isLight, prefersReducedMotion] })

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-x-hidden"
    >
      {/* 3D Canvas fixed in background */}
      <div
        id="truck-scene-layer"
        className="fixed inset-0 z-0 overflow-hidden transition-colors duration-500 pointer-events-none"
        style={{
          backgroundImage: sceneBackdrop,
          backgroundColor: isLight ? '#f4f4f5' : '#080808',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: isLight
              ? 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.08), rgba(255,255,255,0.02))'
              : 'linear-gradient(135deg, rgba(255,255,255,0.008), rgba(255,255,255,0.02), rgba(255,255,255,0.005))',
          }}
        />
        <div
          id="truck-departure-glow"
          aria-hidden="true"
          className="absolute inset-0 opacity-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 28% 22% at 50% 48%, ${primary}70 0%, ${primary}20 34%, transparent 72%)`,
            willChange: 'opacity, transform',
          }}
        />
        <Canvas
          frameloop={prefersReducedMotion || !isSceneAnimating ? 'never' : 'always'}
          camera={{ position: [0, 1, 8], fov: 45 }}
          dpr={[0.9, maxSceneDpr]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setMaxSceneDpr((current) => Math.max(0.9, current - 0.15))}
            onIncline={() => setMaxSceneDpr((current) => Math.min(1.25, current + 0.1))}
            onFallback={() => setMaxSceneDpr(0.9)}
          >
            <TruckEnvironment primary={primary} isLight={isLight} />

            <Suspense fallback={null}>
              <AutoTruck animStateRef={animStateRef} />
              <GeometricField animStateRef={animStateRef} color={primary} isLight={isLight} />
              <SceneHelpers animStateRef={animStateRef} primary={primary} isLight={isLight} />
            </Suspense>
          </PerformanceMonitor>
        </Canvas>
      </div>

      {/* HTML content scrollable over the 3D scene */}
      <div className="relative z-10 w-full">
        
        {/* Section 0: Hero */}
        <section
          id="hero-section"
          className="w-full h-screen flex flex-col justify-center px-6 md:px-20 relative select-none"
        >
          <div className="max-w-[42rem] z-10">
            <h1
              id="hero-title-main"
              className="font-black text-5xl md:text-8xl leading-none mb-6 text-foreground"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
              }}
            >
              POTÊNCIA<br />
              <span style={{ color: primary }}>&amp; CONTROLE</span><br />
              <span style={{ fontSize: 'clamp(28px, 4.5vw, 56px)' }}>NA SUA FROTA</span>
            </h1>

            <p
              id="hero-subtitle"
              className="text-base md:text-xl mb-10 max-w-md font-light text-foreground-muted"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Acelere a gestão da sua frota com nossa plataforma completa de alta performance.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => router.push('/auth/solicitar-acesso')}
                className="hero-button inline-flex items-center justify-center px-8 py-4 text-sm font-bold uppercase tracking-widest transition-all duration-300 hover:opacity-90 hover:scale-105 cursor-pointer"
                style={{
                  backgroundColor: primary,
                  color: isLight ? '#000' : '#fff',
                  fontFamily: 'Rajdhani, sans-serif',
                  clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
                }}
              >
                Solicitar Acesso →
              </button>

              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="hero-button inline-flex items-center justify-center px-8 py-4 text-sm font-bold uppercase tracking-widest border transition-all duration-300 hover:scale-105 cursor-pointer"
                style={{
                  borderColor: primary,
                  color: primary,
                  backgroundColor: 'transparent',
                  fontFamily: 'Rajdhani, sans-serif',
                  clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = primary
                  e.currentTarget.style.color = isLight ? '#000' : '#fff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = primary
                }}
              >
                Fazer Login
              </button>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
          >
            <span style={{
              color: 'rgba(255,255,255,0.2)',
              fontSize: 10,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              fontFamily: 'JetBrains Mono, monospace',
            }}>scroll</span>
            <div style={{
              width: 1,
              height: 48,
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)',
              animation: 'pulse 2s infinite',
            }} />
          </div>
        </section>

        {/* Section 1: FloatCard 1 */}
        <section
          id="trigger-card-1"
          className="w-full min-h-[62vh] flex items-center justify-end px-6 md:px-20 relative pointer-events-none"
        >
          <div id="card-wrapper-1" className="opacity-0 translate-y-[50px] pointer-events-auto">
            <FloatCard title="Gestão Precisa" desc="Controle cada gota de combustível e quilômetro rodado da frota." side="right" primary={primary} isLight={isLight} />
          </div>
        </section>

        {/* Section 2: FloatCard 2 */}
        <section
          id="trigger-card-2"
          className="w-full min-h-[62vh] flex items-center justify-start px-6 md:px-20 relative pointer-events-none"
        >
          <div id="card-wrapper-2" className="opacity-0 translate-y-[50px] pointer-events-auto">
            <FloatCard title="Manutenção Inteligente" desc="Evite falhas no meio da estrada com histórico e alertas de revisão." side="left" primary={primary} isLight={isLight} />
          </div>
        </section>

        {/* Section 3: FloatCard 3 */}
        <section
          id="trigger-card-3"
          className="w-full min-h-[62vh] flex items-center justify-end px-6 md:px-20 relative pointer-events-none"
        >
          <div id="card-wrapper-3" className="opacity-0 translate-y-[50px] pointer-events-auto">
            <FloatCard title="Rotas Otimizadas" desc="Integração com pedágios para reduzir custos em até 30% por viagem." side="right" primary={primary} isLight={isLight} />
          </div>
        </section>

        {/* Section 4: Zoom/Transition Spacer */}
        <section
          id="trigger-transition"
          className="w-full min-h-[46vh] relative flex flex-col items-center justify-center pointer-events-none"
        >
          <h2
            id="tech-banner-text"
            className="opacity-0 scale-50 font-black text-5xl md:text-8xl text-center select-none tracking-normal"
            style={{
              color: primary,
              fontFamily: 'Rajdhani, sans-serif',
              textShadow: `0 0 40px color-mix(in srgb, ${primary} 50%, transparent)`
            }}
          >
            EFICIÊNCIA ABSOLUTA
          </h2>
          <div
            id="tech-banner-line"
            aria-hidden="true"
            className="mt-6 h-px w-0 opacity-0"
            style={{
              background: `linear-gradient(90deg, transparent, ${primary}, transparent)`,
              boxShadow: `0 0 18px ${primary}80`,
            }}
          />
        </section>

        {/* CONTEÚDO ESTÁTICO DE MÓDULOS (CTA, Planos, Ticker, etc.) */}
        <div
          id="main-content-start"
          className="relative z-10 w-full bg-background text-foreground transition-colors duration-500"
          style={{ opacity: 0, transform: 'translateY(80px)' }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

function FloatCard({
  title,
  desc,
  side,
  primary,
  isLight,
}: {
  title: string
  desc: string
  side: 'left' | 'right'
  primary: string
  isLight: boolean
}) {
  return (
    <div
      className="max-w-xs p-6 backdrop-blur-md shadow-2xl"
      style={{
        borderLeft:  side === 'right' ? `4px solid ${primary}` : undefined,
        borderRight: side === 'left'  ? `4px solid ${primary}` : undefined,
        borderRadius: side === 'right' ? '0 16px 16px 0' : '16px 0 0 16px',
        backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(10,10,10,0.9)',
        pointerEvents: 'auto',
      }}
    >
      <h3
        className="font-bold text-2xl mb-2"
        style={{ color: primary, fontFamily: 'Rajdhani, sans-serif' }}
      >
        {title}
      </h3>
      <p
        className="text-sm font-medium"
        style={{ color: isLight ? '#555' : '#aaa', fontFamily: 'Outfit, sans-serif' }}
      >
        {desc}
      </p>
    </div>
  )
}
