'use client'

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, RoundedBox, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { Group } from 'three'

const skin = '#e8b98f'
const skinShade = '#d9a274'
const kurta = '#c8634b'
const kurtaDeep = '#a94f3c'
const navy = '#17293c'
const hair = '#2b1d18'
const cream = '#f8f1e4'
const gold = '#e0a35f'

const WALK = 1.9

type Bone = React.RefObject<Group | null>

function Arm({ side, shoulder, elbow, hand }: { side: 1 | -1; shoulder: Bone; elbow: Bone; hand: Bone }) {
  return (
    <group position={[0.255 * side, 1.32, 0]}>
      <mesh>
        <sphereGeometry args={[0.098, 24, 24]} />
        <meshStandardMaterial color={kurta} roughness={0.55} />
      </mesh>
      <group ref={shoulder} rotation={[0, 0, 0.1 * side]}>
        <mesh position={[0, -0.17, 0]}>
          <capsuleGeometry args={[0.072, 0.24, 6, 16]} />
          <meshStandardMaterial color={kurta} roughness={0.55} />
        </mesh>
        <group ref={elbow} position={[0, -0.35, 0]} rotation={[-0.25, 0, 0]}>
          <mesh position={[0, -0.13, 0]}>
            <capsuleGeometry args={[0.06, 0.2, 6, 16]} />
            <meshStandardMaterial color={skin} roughness={0.72} />
          </mesh>
          <group ref={hand} position={[0, -0.29, 0]}>
            <mesh scale={[1, 1.15, 0.7]}>
              <sphereGeometry args={[0.072, 18, 18]} />
              <meshStandardMaterial color={skin} roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.05, 0.03]} rotation={[0.5, 0, 0]}>
              <capsuleGeometry args={[0.022, 0.05, 4, 10]} />
              <meshStandardMaterial color={skin} roughness={0.72} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

function Leg({ side, hip, knee }: { side: 1 | -1; hip: Bone; knee: Bone }) {
  return (
    <group position={[0.125 * side, 0.86, 0]}>
      <group ref={hip}>
        <mesh position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.092, 0.26, 6, 16]} />
          <meshStandardMaterial color={navy} roughness={0.7} />
        </mesh>
        <group ref={knee} position={[0, -0.4, 0]}>
          <mesh position={[0, -0.17, 0]}>
            <capsuleGeometry args={[0.075, 0.24, 6, 16]} />
            <meshStandardMaterial color={navy} roughness={0.7} />
          </mesh>
          <RoundedBox args={[0.16, 0.085, 0.27]} radius={0.035} smoothness={3} position={[0, -0.365, 0.055]}>
            <meshStandardMaterial color="#3a2a22" roughness={0.55} />
          </RoundedBox>
        </group>
      </group>
    </group>
  )
}

function Head() {
  return (
    <group position={[0, 1.63, 0]}>
      <mesh scale={[1, 1.04, 0.98]}>
        <sphereGeometry args={[0.255, 40, 40]} />
        <meshStandardMaterial color={skin} roughness={0.75} />
      </mesh>
      <mesh position={[0, -0.06, 0.02]} scale={[0.92, 0.72, 0.95]}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshStandardMaterial color={skin} roughness={0.75} />
      </mesh>

      {/* hair: scalp cap, fringe and back mass — all clear of the face */}
      <mesh position={[0, 0.02, -0.012]}>
        <sphereGeometry args={[0.283, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.35]} />
        <meshStandardMaterial color={hair} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.155, 0.155]} scale={[1.4, 0.38, 0.6]}>
        <sphereGeometry args={[0.085, 24, 24]} />
        <meshStandardMaterial color={hair} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.03, -0.105]} scale={[1.02, 1.06, 0.72]}>
        <sphereGeometry args={[0.255, 32, 32]} />
        <meshStandardMaterial color={hair} roughness={0.85} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`side${s}`} position={[0.235 * s, -0.03, 0.03]} scale={[0.45, 1.15, 0.75]}>
          <sphereGeometry args={[0.1, 18, 18]} />
          <meshStandardMaterial color={hair} roughness={0.85} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`ear${s}`} position={[0.245 * s, -0.02, 0.01]} scale={[0.45, 1, 0.7]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={skinShade} roughness={0.75} />
        </mesh>
      ))}

      {[-1, 1].map((s) => (
        <group key={`eye${s}`} position={[0.095 * s, 0.005, 0.208]}>
          <mesh scale={[1, 1.12, 0.5]}>
            <sphereGeometry args={[0.048, 20, 20]} />
            <meshStandardMaterial color={cream} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.003, 0.026]}>
            <sphereGeometry args={[0.025, 18, 18]} />
            <meshStandardMaterial color="#1b1512" roughness={0.25} />
          </mesh>
          <mesh position={[0.008, 0.012, 0.042]}>
            <sphereGeometry args={[0.0075, 10, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`brow${s}`} position={[0.097 * s, 0.082, 0.212]} rotation={[-0.15, 0, -0.22 * s]}>
          <boxGeometry args={[0.075, 0.016, 0.018]} />
          <meshStandardMaterial color={hair} roughness={0.85} />
        </mesh>
      ))}

      <mesh position={[0, -0.038, 0.245]} scale={[0.7, 0.95, 0.75]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color={skinShade} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.108, 0.198]} rotation={[0.32, 0, Math.PI]}>
        <torusGeometry args={[0.058, 0.015, 12, 28, Math.PI]} />
        <meshStandardMaterial color="#9c4535" roughness={0.55} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`cheek${s}`} position={[0.135 * s, -0.058, 0.175]} scale={[1, 0.7, 0.4]}>
          <sphereGeometry args={[0.043, 16, 16]} />
          <meshStandardMaterial color="#e08f7c" roughness={0.85} transparent opacity={0.65} />
        </mesh>
      ))}
      <mesh position={[0, 0.115, 0.232]} scale={[0.5, 0.5, 0.3]}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshStandardMaterial color={gold} roughness={0.35} metalness={0.5} />
      </mesh>
    </group>
  )
}

function Boy() {
  const root = useRef<Group>(null)
  const torso = useRef<Group>(null)
  const neck = useRef<Group>(null)
  const shoulderL = useRef<Group>(null)
  const shoulderR = useRef<Group>(null)
  const elbowL = useRef<Group>(null)
  const elbowR = useRef<Group>(null)
  const handL = useRef<Group>(null)
  const handR = useRef<Group>(null)
  const hipL = useRef<Group>(null)
  const hipR = useRef<Group>(null)
  const kneeL = useRef<Group>(null)
  const kneeR = useRef<Group>(null)

  const kurtaProfile = useMemo(() => [
    [0.001, 0.55], [0.315, 0.55], [0.312, 0.62], [0.296, 0.74], [0.276, 0.88],
    [0.258, 1.0], [0.262, 1.1], [0.275, 1.2], [0.262, 1.29], [0.215, 1.37], [0.1, 1.41], [0.001, 1.42],
  ].map(([x, y]) => new THREE.Vector2(x, y)), [])

  useFrame(({ clock, pointer }, delta) => {
    const t = clock.elapsedTime
    const walking = t < WALK
    const gait = t * 8.4
    const blend = walking ? 1 : Math.max(0, 1 - (t - WALK) / 0.7)
    const idle = Math.max(0, t - WALK)
    const ease = Math.min(1, delta * 6)

    if (root.current) {
      root.current.rotation.y += (pointer.x * 0.45 - root.current.rotation.y) * ease
      root.current.rotation.x = -pointer.y * 0.1
      root.current.position.y = walking ? Math.abs(Math.sin(gait * 0.5)) * 0.05 : Math.sin(idle * 1.5) * 0.016
    }
    if (hipL.current) hipL.current.rotation.x = Math.sin(gait) * 0.6 * blend
    if (hipR.current) hipR.current.rotation.x = Math.sin(gait + Math.PI) * 0.6 * blend
    if (kneeL.current) kneeL.current.rotation.x = Math.max(0, -Math.sin(gait + 1.1)) * 0.9 * blend
    if (kneeR.current) kneeR.current.rotation.x = Math.max(0, -Math.sin(gait + Math.PI + 1.1)) * 0.9 * blend

    if (shoulderL.current) {
      shoulderL.current.rotation.x = Math.sin(gait + Math.PI) * 0.5 * blend - 0.05 * (1 - blend)
      shoulderL.current.rotation.z = 0.1 + 0.05 * Math.sin(idle * 1.4) * (1 - blend)
    }
    if (elbowL.current) elbowL.current.rotation.x = -0.28 - Math.max(0, Math.sin(gait + Math.PI)) * 0.32 * blend
    if (handL.current) handL.current.rotation.z = walking ? 0 : Math.sin(idle * 1.4) * 0.08

    if (shoulderR.current) {
      const raise = walking ? 0 : Math.min(1, idle / 0.45)
      shoulderR.current.rotation.x = walking ? Math.sin(gait) * 0.5 : -0.05
      shoulderR.current.rotation.z = 0.1 - 2.3 * raise
    }
    if (elbowR.current) elbowR.current.rotation.x = walking ? -0.28 - Math.max(0, Math.sin(gait)) * 0.32 * blend : -0.45 + Math.sin(idle * 6.5) * 0.4
    if (handR.current) handR.current.rotation.z = walking ? 0 : Math.sin(idle * 6.5) * 0.4

    if (torso.current) {
      torso.current.rotation.y = Math.sin(gait * 0.5) * 0.1 * blend + Math.sin(idle * 0.9) * 0.05 * (1 - blend)
      torso.current.rotation.x = 0.09 * blend + 0.015 * (1 - blend)
    }
    if (neck.current) {
      neck.current.rotation.y = walking ? -Math.sin(gait * 0.5) * 0.09 : Math.sin(idle * 0.8) * 0.15 + pointer.x * 0.14
      neck.current.rotation.z = Math.sin(gait * 0.5) * 0.04 * blend + Math.sin(idle * 1.3) * 0.045 * (1 - blend)
      neck.current.rotation.x = walking ? -0.05 : -0.02 + Math.sin(idle * 1.1) * 0.05
    }
  })

  return (
    <group ref={root}>
      <group ref={torso}>
        <group ref={neck}>
          <Head />
          <mesh position={[0, 1.42, 0]}>
            <cylinderGeometry args={[0.072, 0.095, 0.17, 20]} />
            <meshStandardMaterial color={skinShade} roughness={0.75} />
          </mesh>
        </group>

        <mesh>
          <latheGeometry args={[kurtaProfile, 48]} />
          <meshStandardMaterial color={kurta} roughness={0.58} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.385, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.108, 0.028, 12, 30]} />
          <meshStandardMaterial color={cream} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.06, 0.268]}>
          <boxGeometry args={[0.07, 0.56, 0.02]} />
          <meshStandardMaterial color={cream} roughness={0.75} />
        </mesh>
        {[1.26, 1.1, 0.94].map((y) => (
          <mesh key={`btn${y}`} position={[0, y, 0.283]}>
            <sphereGeometry args={[0.016, 12, 12]} />
            <meshStandardMaterial color={gold} roughness={0.3} metalness={0.55} />
          </mesh>
        ))}
        <mesh position={[-0.155, 1.06, 0.19]} rotation={[0.1, 0.3, 0.24]}>
          <boxGeometry args={[0.125, 0.74, 0.02]} />
          <meshStandardMaterial color={kurtaDeep} roughness={0.68} />
        </mesh>

        <Arm side={-1} shoulder={shoulderL} elbow={elbowL} hand={handL} />
        <Arm side={1} shoulder={shoulderR} elbow={elbowR} hand={handR} />
      </group>

      <Leg side={-1} hip={hipL} knee={kneeL} />
      <Leg side={1} hip={hipR} knee={kneeR} />

      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 56]} />
        <meshStandardMaterial color="#d9b78f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.8, 56]} />
        <meshStandardMaterial color="#b8865c" roughness={0.95} />
      </mesh>
    </group>
  )
}

export function ContactBoy3d() {
  return (
    <Canvas camera={{ position: [0, 0.05, 3.9], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#fff3e0', '#c98b5e', 0.7]} />
      <directionalLight position={[2.6, 4, 3]} intensity={2.1} color="#fff1d8" />
      <directionalLight position={[-3.4, 1.6, -2.2]} intensity={0.8} color="#7fa8d8" />
      <directionalLight position={[0, 1.4, -3.2]} intensity={0.9} color="#ffb877" />
      <group position={[0, -0.92, 0]}>
        <Boy />
        <ContactShadows position={[0, 0.018, 0]} scale={4.2} blur={2.8} opacity={0.4} far={1.6} color="#6b3f1e" />
      </group>
      <Sparkles count={34} scale={[3.4, 2.6, 2]} position={[0, 0.2, 0]} size={4.2} speed={0.35} opacity={0.85} color={gold} />
    </Canvas>
  )
}
