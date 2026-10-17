'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Float, OrbitControls } from '@react-three/drei'
import { Suspense, useRef } from 'react'
import type { Group } from 'three'

function Installation() {
  const group = useRef<Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.12
  })
  return (
    <group ref={group} rotation={[0, -0.35, 0]}>
      <Float speed={1.2} rotationIntensity={0.18} floatIntensity={0.35}>
        <mesh position={[-0.82, 0.45, 0]} rotation={[0, 0.2, -0.08]}>
          <boxGeometry args={[0.95, 1.25, 0.08]} />
          <meshStandardMaterial color="#b96a43" roughness={0.7} />
        </mesh>
        <mesh position={[-0.82, 0.45, 0.06]} rotation={[0, 0.2, -0.08]}>
          <planeGeometry args={[0.75, 1.05]} />
          <meshStandardMaterial color="#f1d9bd" roughness={0.95} />
        </mesh>
      </Float>
      <Float speed={1.4} rotationIntensity={0.24} floatIntensity={0.45}>
        <mesh position={[0.55, 0.7, 0.15]} rotation={[0.12, -0.24, 0.14]}>
          <torusGeometry args={[0.52, 0.16, 20, 48]} />
          <meshStandardMaterial color="#1c2830" metalness={0.35} roughness={0.32} />
        </mesh>
      </Float>
      <mesh position={[0, -0.45, 0]}>
        <cylinderGeometry args={[1.2, 1.45, 0.18, 48]} />
        <meshStandardMaterial color="#d79765" roughness={0.8} />
      </mesh>
    </group>
  )
}

export function GalleryInstallation() {
  return (
    <div className="installation-canvas" aria-label="Interactive abstract gallery installation">
      <Canvas camera={{ position: [0, 0.3, 4.4], fov: 35 }} dpr={[1, 1.5]} fallback={<div className="installation-fallback">A living collection of forms, light and memory.</div>}>
        <Suspense fallback={null}>
          <ambientLight intensity={1.8} />
          <directionalLight position={[2, 4, 3]} intensity={3} color="#fff1dc" />
          <Installation />
          <ContactShadows position={[0, -0.56, 0]} opacity={0.28} scale={5} blur={2.5} />
          <Environment preset="studio" />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} minPolarAngle={1.1} maxPolarAngle={2} />
        </Suspense>
      </Canvas>
    </div>
  )
}

