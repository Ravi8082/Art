'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float, OrbitControls, Sparkles } from '@react-three/drei'
import { Suspense, useRef } from 'react'
import type { Group } from 'three'

function FloatingSculpture() {
  const group = useRef<Group>(null)

  useFrame((state) => {
    if (!group.current) return
    group.current.rotation.y = state.clock.elapsedTime * 0.12
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.08
  })

  return (
    <group ref={group}>
      <Float speed={1.25} rotationIntensity={0.35} floatIntensity={0.55}>
        <mesh position={[-0.82, 0.28, 0.15]} rotation={[0.08, 0.24, -0.14]}>
          <boxGeometry args={[0.72, 1.2, 0.12]} />
          <meshStandardMaterial color="#c8634b" roughness={0.58} metalness={0.08} />
        </mesh>
        <mesh position={[-0.82, 0.28, 0.24]} rotation={[0.08, 0.24, -0.14]}>
          <planeGeometry args={[0.56, 0.92]} />
          <meshStandardMaterial color="#f5d9bc" roughness={0.96} />
        </mesh>
      </Float>

      <Float speed={1.45} rotationIntensity={0.55} floatIntensity={0.7}>
        <mesh position={[0.42, 0.62, 0.12]} rotation={[0.22, -0.18, 0.16]}>
          <torusGeometry args={[0.62, 0.13, 24, 72]} />
          <meshStandardMaterial color="#172a3c" roughness={0.26} metalness={0.48} />
        </mesh>
      </Float>

      <Float speed={1.1} rotationIntensity={0.3} floatIntensity={0.42}>
        <mesh position={[0.86, -0.25, -0.05]} rotation={[0.34, 0.42, -0.2]}>
          <icosahedronGeometry args={[0.35, 1]} />
          <meshStandardMaterial color="#d79765" roughness={0.7} metalness={0.12} />
        </mesh>
      </Float>

      <mesh position={[0, -0.68, 0]}>
        <cylinderGeometry args={[1.38, 1.62, 0.16, 64]} />
        <meshStandardMaterial color="#b96a43" roughness={0.8} />
      </mesh>
    </group>
  )
}

export function HaatHero3D() {
  return (
    <div className="hero-3d" aria-label="Animated abstract sculpture inspired by contemporary Indian art">
      <Canvas camera={{ position: [0, 0.15, 4.65], fov: 34 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <ambientLight intensity={1.9} />
          <directionalLight position={[3, 4, 4]} intensity={3.2} color="#fff0dc" />
          <pointLight position={[-3, 1, 2]} intensity={1.4} color="#c8634b" />
          <FloatingSculpture />
          <Sparkles count={34} scale={[4.2, 3, 2]} size={1.5} speed={0.18} color="#f3c8b6" opacity={0.45} />
          <Environment preset="studio" />
          <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
        </Suspense>
      </Canvas>
      <span className="hero-3d-label">A living collection / 01</span>
    </div>
  )
}

export default HaatHero3D
