'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, RoundedBox, Sparkles } from '@react-three/drei'
import { useReducedMotion } from 'framer-motion'
import { useRef } from 'react'
import type { Group } from 'three'

const skin = '#d9a47f'
const hair = '#251712'
const jacket = '#a94735'
const jacketShade = '#783328'
const gold = '#e6b968'

function Segment({
  start,
  end,
  radius,
  color,
}: {
  start: [number, number, number]
  end: [number, number, number]
  radius: number
  color: string
}) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const length = Math.hypot(dx, dy)

  return (
    <mesh
      position={[(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2]}
      rotation={[0, 0, Math.atan2(dy, dx) - Math.PI / 2]}
      castShadow
    >
      <capsuleGeometry args={[radius, Math.max(0.01, length - radius * 2), 8, 16]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  )
}

function HostHead() {
  return (
    <group position={[0, 1.66, 0]}>
      <mesh scale={[0.82, 1, 0.78]} castShadow>
        <sphereGeometry args={[0.26, 36, 32]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.02, -0.08]} scale={[1.03, 1.06, 0.74]}>
        <sphereGeometry args={[0.27, 32, 24]} />
        <meshStandardMaterial color={hair} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.06, 0.025]}>
        <sphereGeometry args={[0.27, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
        <meshStandardMaterial color={hair} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.31, -0.03]} scale={[0.72, 0.82, 0.75]} castShadow>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color={hair} roughness={0.82} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0.245 * side, -0.045, 0.005]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color={skin} roughness={0.7} />
          </mesh>
          <mesh position={[0.255 * side, -0.12, 0.025]}>
            <torusGeometry args={[0.035, 0.008, 10, 22]} />
            <meshStandardMaterial color={gold} roughness={0.28} metalness={0.65} />
          </mesh>
          <group position={[0.092 * side, 0.025, 0.202]}>
            <mesh scale={[1, 1.12, 0.55]}>
              <sphereGeometry args={[0.045, 18, 18]} />
              <meshStandardMaterial color="#fff4e8" roughness={0.35} />
            </mesh>
            <mesh position={[0, -0.002, 0.022]}>
              <sphereGeometry args={[0.023, 16, 16]} />
              <meshStandardMaterial color="#241813" roughness={0.3} />
            </mesh>
            <mesh position={[0.007, 0.01, 0.036]}>
              <sphereGeometry args={[0.006, 8, 8]} />
              <meshBasicMaterial color="#fff" />
            </mesh>
          </group>
        </group>
      ))}
      <mesh position={[0, 0.11, 0.211]}>
        <sphereGeometry args={[0.025, 14, 14]} />
        <meshStandardMaterial color="#a5382c" roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.09, 0.198]} rotation={[0.1, 0, Math.PI]}>
        <torusGeometry args={[0.052, 0.012, 10, 24, Math.PI]} />
        <meshStandardMaterial color="#8f4135" roughness={0.5} />
      </mesh>
    </group>
  )
}

function NamasteHost({ compact }: { compact: boolean }) {
  const root = useRef<Group>(null)
  const reduceMotion = useReducedMotion()

  useFrame(({ clock }) => {
    if (!root.current) return
    const time = clock.elapsedTime
    root.current.rotation.y = reduceMotion ? 0 : Math.sin(time * 0.45) * 0.045
    root.current.position.y = -0.94 + (reduceMotion ? 0 : Math.sin(time * 1.5) * 0.018)
  })

  const patches: { position: [number, number, number]; size: [number, number, number]; color: string }[] = [
    { position: [-0.19, 1.12, 0.178], size: [0.055, 0.22, 0.018], color: '#e9b65f' },
    { position: [-0.13, 0.91, 0.178], size: [0.09, 0.045, 0.02], color: '#32a28a' },
    { position: [0.14, 1.1, 0.178], size: [0.07, 0.055, 0.02], color: '#55a4aa' },
    { position: [0.18, 0.95, 0.178], size: [0.045, 0.14, 0.02], color: '#e8b05f' },
    { position: [-0.14, 1.25, 0.178], size: [0.055, 0.045, 0.02], color: '#e6c6a4' },
    { position: [0.11, 0.82, 0.178], size: [0.07, 0.04, 0.02], color: '#ce6c50' },
  ]

  return (
    <group ref={root} position={[0, -0.94, 0]} scale={compact ? 0.78 : 1}>
      <mesh position={[-0.11, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.085, 0.42, 8, 18]} />
        <meshStandardMaterial color="#29232a" roughness={0.68} />
      </mesh>
      <mesh position={[0.11, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.085, 0.42, 8, 18]} />
        <meshStandardMaterial color="#29232a" roughness={0.68} />
      </mesh>
      <RoundedBox args={[0.16, 0.085, 0.26]} radius={0.035} smoothness={3} position={[-0.11, 0.15, 0.045]}>
        <meshStandardMaterial color="#38251a" roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[0.16, 0.085, 0.26]} radius={0.035} smoothness={3} position={[0.11, 0.15, 0.045]}>
        <meshStandardMaterial color="#38251a" roughness={0.55} />
      </RoundedBox>

      <RoundedBox args={[0.58, 0.68, 0.34]} radius={0.12} smoothness={4} position={[0, 1.04, 0]} castShadow>
        <meshStandardMaterial color={jacket} roughness={0.62} />
      </RoundedBox>
      <mesh position={[0, 1.42, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.17, 20]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {patches.map((patch, index) => (
        <RoundedBox
          key={index}
          args={patch.size}
          radius={0.008}
          smoothness={2}
          position={patch.position}
        >
          <meshStandardMaterial color={patch.color} roughness={0.5} metalness={0.08} />
        </RoundedBox>
      ))}
      <mesh position={[0, 0.98, 0.178]}>
        <boxGeometry args={[0.035, 0.46, 0.018]} />
        <meshStandardMaterial color="#e6c49c" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.09, 0.195]}>
        <sphereGeometry args={[0.023, 12, 12]} />
        <meshStandardMaterial color={gold} roughness={0.3} metalness={0.65} />
      </mesh>

      <Segment start={[-0.27, 1.27, 0.02]} end={[-0.16, 1.39, 0.13]} radius={0.09} color={jacketShade} />
      <Segment start={[-0.16, 1.39, 0.13]} end={[-0.035, 1.49, 0.27]} radius={0.063} color={skin} />
      <Segment start={[0.27, 1.27, 0.02]} end={[0.16, 1.39, 0.13]} radius={0.09} color={jacketShade} />
      <Segment start={[0.16, 1.39, 0.13]} end={[0.035, 1.49, 0.27]} radius={0.063} color={skin} />
      <mesh position={[-0.035, 1.49, 0.27]} scale={[0.82, 1.05, 0.82]}>
        <sphereGeometry args={[0.065, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0.035, 1.49, 0.27]} scale={[0.82, 1.05, 0.82]}>
        <sphereGeometry args={[0.065, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <RoundedBox args={[0.064, 0.18, 0.055]} radius={0.026} smoothness={4} position={[-0.026, 1.56, 0.31]} rotation={[0, 0, -0.08]}>
        <meshStandardMaterial color={skin} roughness={0.68} />
      </RoundedBox>
      <RoundedBox args={[0.064, 0.18, 0.055]} radius={0.026} smoothness={4} position={[0.026, 1.56, 0.31]} rotation={[0, 0, 0.08]}>
        <meshStandardMaterial color={skin} roughness={0.68} />
      </RoundedBox>
      <mesh position={[0, 1.43, 0.345]}>
        <sphereGeometry args={[0.012, 10, 10]} />
        <meshStandardMaterial color="#a86951" roughness={0.75} />
      </mesh>
      <HostHead />
    </group>
  )
}

export function WelcomeHost3d({ compact = false }: { compact?: boolean }) {
  const reduceMotion = useReducedMotion()

  return (
    <Canvas
      camera={{ position: [0, compact ? 0.18 : 0.12, compact ? 3.8 : 4.1], fov: compact ? 40 : 35 }}
      dpr={compact ? [1, 1.25] : [1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#fff2dc', '#8e5637', 0.8]} />
      <directionalLight position={[2.8, 4, 3]} intensity={2.2} color="#fff0d4" castShadow />
      <directionalLight position={[-3, 1.8, -2]} intensity={0.75} color="#ed996c" />
      <directionalLight position={[0, 1.5, -3]} intensity={0.8} color="#ffd078" />
      <NamasteHost compact={compact} />
      {!compact && <ContactShadows position={[0, -0.92, 0]} scale={3.5} blur={2.4} opacity={0.42} far={1.4} color="#4d2a18" />}
      <Sparkles
        count={compact ? 8 : 44}
        scale={compact ? [1.35, 1.6, 1] : [3.8, 3.2, 2]}
        position={[0, 0.3, -0.15]}
        size={compact ? 1.5 : 3.4}
        speed={reduceMotion ? 0 : compact ? 0.2 : 0.32}
        opacity={0.75}
        color={gold}
      />
    </Canvas>
  )
}
