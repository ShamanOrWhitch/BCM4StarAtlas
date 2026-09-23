import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three/addons/controls/OrbitControls.js";
import { SYSTEMS, FACTION_TONE, cssMarker, type Marker, type StarSystem } from "@/data/systems";
import { latLngToVec3 } from "@/lib/latlng";
import { useCartograph } from "./store";

const RADIUS = 1.6;
const _tmp = new THREE.Vector3();
const _look = new THREE.Vector3();
const _dest = new THREE.Vector3();
const _shipLook = new THREE.Vector3();
const _orbit = new THREE.Vector3();

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,240,200,0.7)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function markerPos(marker: Marker, target: THREE.Vector3) {
  if (marker.orbit) {
    return target.set(marker.orbit[0], marker.orbit[1], marker.orbit[2]);
  }
  return latLngToVec3(marker.lat, marker.lng, RADIUS + 0.04, target);
}

function Atmosphere({ color }: { color: string }) {
  const mat = useMemo(() => {
    const c = new THREE.Color(color);
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: { uColor: { value: c } },
      vertexShader: `
        varying vec3 vN;
        void main() {
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vN;
        uniform vec3 uColor;
        void main() {
          float f = pow(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 2.4);
          gl_FragColor = vec4(uColor, clamp(f * 0.62, 0.0, 0.7));
        }
      `,
    });
  }, [color]);

  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <mesh scale={1.09}>
      <sphereGeometry args={[RADIUS, 48, 48]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

function PlanetBody({ system }: { system: StarSystem }) {
  const map = useTexture(system.texture);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  return (
    <mesh>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshStandardMaterial map={map} roughness={0.86} metalness={0.08} />
    </mesh>
  );
}

function CloudLayer({ url }: { url: string }) {
  const map = useTexture(url);
  map.colorSpace = THREE.SRGBColorSpace;
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += Math.min(d, 0.1) * 0.012;
  });
  return (
    <mesh ref={ref} scale={1.012}>
      <sphereGeometry args={[RADIUS, 48, 48]} />
      <meshStandardMaterial map={map} transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}

function MarkerNode({
  marker,
  systemId,
  onPick,
}: {
  marker: Marker;
  systemId: string;
  onPick: (id: string) => void;
}) {
  const selected = useCartograph((s) => s.markerId === marker.id);
  const glow = useMemo(() => glowTexture(), []);
  useEffect(() => () => glow.dispose(), [glow]);
  const pos = useMemo(() => latLngToVec3(marker.lat, marker.lng, RADIUS + 0.04), [marker]);
  const faction = (SYSTEMS.find((s) => s.id === systemId) ?? SYSTEMS[0]).faction;
  const color = selected ? "#f2e6c2" : FACTION_TONE[faction];
  const pulse = useRef(0);
  const sprite = useRef<THREE.Sprite>(null);

  useFrame((_, d) => {
    pulse.current += d;
    if (sprite.current) {
      const s = (selected ? 0.22 : 0.14) + Math.sin(pulse.current * 2.4) * 0.03;
      sprite.current.scale.setScalar(s);
    }
  });

  return (
    <group position={pos}>
      <sprite
        ref={sprite}
        onClick={(e) => {
          e.stopPropagation();
          onPick(marker.id);
        }}
      >
        <spriteMaterial
          map={glow}
          color={color}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onPick(marker.id);
        }}
      >
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function CssStation({
  marker,
  color,
  onPick,
}: {
  marker: Marker;
  color: string;
  onPick: (id: string) => void;
}) {
  const selected = useCartograph((s) => {
    const id = s.markerId;
    if (!id) return false;
    if (id === marker.id) return true;
    const sys = SYSTEMS.find((x) => x.id === s.systemId);
    const m = sys?.markers.find((x) => x.id === id);
    return m?.placement === "hab" || (m?.placement === "orbit" && m.id !== marker.id && Boolean(m.orbit));
  });
  const group = useRef<THREE.Group>(null);
  const pos = marker.orbit ?? [2.38, 0.78, 1.12];

  useFrame((_, d) => {
    if (group.current) group.current.rotation.y += Math.min(d, 0.1) * 0.18;
  });

  const metal = selected ? "#f2e6c2" : color;

  return (
    <group
      position={pos}
      scale={1.55}
      onClick={(e) => {
        e.stopPropagation();
        onPick(marker.id);
      }}
    >
      <mesh>
        <sphereGeometry args={[0.95, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.08 : 0.04} depthWrite={false} />
      </mesh>
      <group ref={group}>
        <mesh rotation={[Math.PI / 2, 0, 0.2]}>
          <torusGeometry args={[0.42, 0.038, 10, 48]} />
          <meshStandardMaterial color={metal} metalness={0.72} roughness={0.28} emissive={metal} emissiveIntensity={0.22} />
        </mesh>
        <mesh rotation={[0.4, 0, Math.PI / 2]}>
          <torusGeometry args={[0.28, 0.022, 8, 32]} />
          <meshStandardMaterial color={metal} metalness={0.65} roughness={0.32} emissive={metal} emissiveIntensity={0.15} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.11, 0.13, 0.32, 8]} />
          <meshStandardMaterial color="#d8dee6" metalness={0.55} roughness={0.35} />
        </mesh>
        {([0, 60, 120, 180, 240, 300] as const).map((deg) => {
          const a = (deg * Math.PI) / 180;
          return (
            <mesh key={deg} position={[Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42]}>
              <boxGeometry args={[0.12, 0.07, 0.16]} />
              <meshStandardMaterial color="#cfd6de" metalness={0.5} roughness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.28, 0]}>
          <coneGeometry args={[0.03, 0.18, 6]} />
          <meshStandardMaterial color={metal} emissive={metal} emissiveIntensity={0.4} />
        </mesh>
      </group>
      <pointLight color={color} intensity={selected ? 1.4 : 0.7} distance={3.2} />
    </group>
  );
}

function FocusRig({
  planet,
  marker,
}: {
  planet: RefObject<THREE.Group | null>;
  marker: Marker | null;
}) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const nonce = useCartograph((s) => s.focusNonce);

  useFrame((_, raw) => {
    const d = Math.min(raw, 0.1);
    if (!marker || !planet.current || !controls || nonce === 0) return;
    if (marker.placement === "surface") {
      latLngToVec3(marker.lat, marker.lng, RADIUS, _tmp);
      planet.current.localToWorld(_tmp);
      _dest.copy(_tmp).normalize().multiplyScalar(4.05);
      camera.position.lerp(_dest, 1 - Math.exp(-d * 2.4));
      _look.copy(_tmp).multiplyScalar(0.12);
      controls.target.lerp(_look, 1 - Math.exp(-d * 2.4));
    } else {
      markerPos(marker, _orbit);
      _dest.copy(_orbit).add(_tmp.set(1.55, 0.55, 2.35));
      camera.position.lerp(_dest, 1 - Math.exp(-d * 2.2));
      controls.target.lerp(_orbit, 1 - Math.exp(-d * 2.2));
    }
    controls.update();
  });
  return null;
}

function Spin({
  planet,
  children,
}: {
  planet: RefObject<THREE.Group | null>;
  children: React.ReactNode;
}) {
  const auto = useCartograph((s) => s.autoRotate);
  const interacting = useCartograph((s) => s.interacting);
  const markerId = useCartograph((s) => s.markerId);

  useFrame((_, raw) => {
    const d = Math.min(raw, 0.1);
    if (!planet.current) return;
    if (auto && !interacting && !markerId) planet.current.rotation.y += d * 0.08;
  });

  return <group ref={planet}>{children}</group>;
}

function Ship({
  kind,
  radius,
  speed,
  tilt,
  phase,
}: {
  kind: "jet" | "bike" | "chi" | "bomb";
  radius: number;
  speed: number;
  tilt: number;
  phase: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const color =
    kind === "jet" ? "#9eb6c4" : kind === "chi" ? "#c4a35a" : kind === "bomb" ? "#7fae8c" : "#c45c4a";

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed + phase;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    const y = Math.sin(t * 1.7) * 0.35;
    ref.current.position.set(x, y, z);
    _shipLook.set(-Math.sin(t) * radius, y + 0.08, Math.cos(t) * radius);
    ref.current.lookAt(_shipLook);
    ref.current.rotation.z += tilt * 0.002;
  });

  return (
    <group ref={ref}>
      <mesh rotation={kind === "chi" ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
        {kind === "bike" ? (
          <boxGeometry args={[0.18, 0.03, 0.05]} />
        ) : kind === "chi" ? (
          <coneGeometry args={[0.045, 0.16, 4]} />
        ) : kind === "bomb" ? (
          <capsuleGeometry args={[0.05, 0.14, 4, 8]} />
        ) : (
          <boxGeometry args={[0.22, 0.045, 0.08]} />
        )}
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[0.03, 0.03, 0.04]} />
        <meshBasicMaterial color="#f2e6c2" />
      </mesh>
    </group>
  );
}

function Fleet() {
  return (
    <group>
      <Ship kind="jet" radius={3.15} speed={0.18} tilt={0.2} phase={0.2} />
      <Ship kind="jet" radius={3.35} speed={-0.14} tilt={-0.15} phase={2.1} />
      <Ship kind="bike" radius={2.55} speed={0.32} tilt={0.4} phase={1.1} />
      <Ship kind="chi" radius={3.55} speed={0.09} tilt={0.05} phase={4.2} />
      <Ship kind="bomb" radius={3.4} speed={-0.11} tilt={-0.25} phase={3.3} />
    </group>
  );
}

function SceneInner() {
  const systemId = useCartograph((s) => s.systemId);
  const markerId = useCartograph((s) => s.markerId);
  const selectMarker = useCartograph((s) => s.selectMarker);
  const setInteracting = useCartograph((s) => s.setInteracting);
  const setAutoRotate = useCartograph((s) => s.setAutoRotate);
  const system = SYSTEMS.find((s) => s.id === systemId) ?? SYSTEMS[0];
  const marker = system.markers.find((m) => m.id === markerId) ?? null;
  const station = cssMarker(system);
  const planet = useRef<THREE.Group>(null);
  const resume = useRef<number | null>(null);
  const surface = system.markers.filter((m) => m.placement === "surface");

  return (
    <>
      <color attach="background" args={["#07090e"]} />
      <hemisphereLight args={["#b9c6d4", "#1a120c", 0.55]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[6, 3.4, 4]} intensity={1.55} color={system.sun} />
      <directionalLight position={[-5, -2, -3]} intensity={0.18} color="#6e7c9a" />
      <Stars radius={80} depth={40} count={2800} factor={2.4} saturation={0} fade speed={0.4} />
      <Spin planet={planet}>
        <Suspense fallback={null}>
          <PlanetBody key={system.texture} system={system} />
          {system.clouds ? <CloudLayer key={system.clouds} url={system.clouds} /> : null}
        </Suspense>
        {surface.map((m) => (
          <MarkerNode key={m.id} marker={m} systemId={system.id} onPick={selectMarker} />
        ))}
      </Spin>
      <Atmosphere color={system.atmosphere} />
      {station ? (
        <CssStation
          key={station.id}
          marker={station}
          color={FACTION_TONE[system.faction]}
          onPick={selectMarker}
        />
      ) : null}
      <Fleet />
      <FocusRig planet={planet} marker={marker} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.6}
        maxDistance={10}
        rotateSpeed={0.72}
        zoomSpeed={0.85}
        onStart={() => {
          setInteracting(true);
          if (resume.current) window.clearTimeout(resume.current);
        }}
        onEnd={() => {
          setInteracting(false);
          if (resume.current) window.clearTimeout(resume.current);
          resume.current = window.setTimeout(() => {
            if (!useCartograph.getState().markerId) setAutoRotate(true);
          }, 2600);
        }}
      />
    </>
  );
}

export function GlobeCanvas() {
  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ position: [1.55, 1.05, 5.7], fov: 42, near: 0.1, far: 200 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => useCartograph.getState().selectMarker(null)}
    >
      <SceneInner />
    </Canvas>
  );
}
