"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Vertical = "wine" | "events" | "cosmetics" | "agro";

type HeroThreeStageProps = {
  active: Vertical;
  product: string;
  className?: string;
  onReady?: () => void;
};

type Tone = {
  accent: string;
  accentSoft: string;
  body: string;
  bodyDeep: string;
  label: string;
  metal: string;
};

const tones: Record<Vertical, Tone> = {
  wine: {
    accent: "#22d3ee",
    accentSoft: "#0e7490",
    body: "#991b1b",
    bodyDeep: "#3f0707",
    label: "#f8fafc",
    metal: "#f59e0b",
  },
  events: {
    accent: "#2dd4bf",
    accentSoft: "#0f766e",
    body: "#14b8a6",
    bodyDeep: "#042f2e",
    label: "#f0fdfa",
    metal: "#c4b5fd",
  },
  cosmetics: {
    accent: "#a78bfa",
    accentSoft: "#6d28d9",
    body: "#7c3aed",
    bodyDeep: "#1e1b4b",
    label: "#f5f3ff",
    metal: "#e5e7eb",
  },
  agro: {
    accent: "#84cc16",
    accentSoft: "#4d7c0f",
    body: "#65a30d",
    bodyDeep: "#14532d",
    label: "#f7fee7",
    metal: "#facc15",
  },
};

export function HeroThreeStage({ active, product, className, onReady }: HeroThreeStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const shortProduct = product.length > 24 ? `${product.slice(0, 22)}...` : product;
  const tone = tones[active];

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.85, 5.25);
    camera.lookAt(0, -0.06, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.dataset.qa = "hero-three-canvas";
    mount.appendChild(renderer.domElement);

    const toneForScene = tones[active];
    scene.add(createLights(toneForScene));
    scene.add(createStageRings(toneForScene));
    scene.add(createTelemetryNodes(toneForScene));
    const productGroup = createProduct(active);
    scene.add(productGroup);
    scene.add(createFloorGlow(toneForScene));

    let frameId = 0;
    let readySent = false;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let targetRotationX = -0.04;
    let targetRotationY = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const handlePointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      mount.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      targetRotationY = clamp(targetRotationY + dx * 0.006, -0.58, 0.58);
      targetRotationX = clamp(targetRotationX + dy * 0.004, -0.25, 0.18);
    };

    const handlePointerUp = (event: PointerEvent) => {
      dragging = false;
      mount.releasePointerCapture?.(event.pointerId);
    };

    mount.addEventListener("pointerdown", handlePointerDown);
    mount.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    const render = () => {
      const elapsed = clock.getElapsedTime();
      if (!dragging) {
        targetRotationY = Math.sin(elapsed * 0.52) * 0.18;
        targetRotationX = -0.04 + Math.sin(elapsed * 0.38) * 0.028;
      }
      productGroup.rotation.y += (targetRotationY - productGroup.rotation.y) * 0.08;
      productGroup.rotation.x += (targetRotationX - productGroup.rotation.x) * 0.08;
      productGroup.position.y = Math.sin(elapsed * 0.82) * 0.045;

      renderer.render(scene, camera);
      if (!readySent) {
        readySent = true;
        onReadyRef.current?.();
      }
      frameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", handlePointerDown);
      mount.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [active]);

  return (
    <div className={`hero-three-stage${className ? ` ${className}` : ""}`}>
      <div ref={mountRef} className="hero-three-stage-canvas" />
      <div className="hero-three-stage-label">
        <span style={{ backgroundColor: tone.accent }} />
        <strong>{shortProduct}</strong>
      </div>
    </div>
  );
}

function createLights(tone: Tone) {
  const group = new THREE.Group();
  group.add(new THREE.AmbientLight(0xffffff, 1.25));

  const key = new THREE.DirectionalLight(0xffffff, 2.15);
  key.position.set(3.4, 4.2, 4.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  group.add(key);

  const accent = new THREE.PointLight(tone.accent, 2.2, 7);
  accent.position.set(-2.8, 1.7, 3.4);
  group.add(accent);

  const violet = new THREE.PointLight("#a78bfa", 1.1, 7);
  violet.position.set(2.2, -0.4, 2.6);
  group.add(violet);

  return group;
}

function createProduct(active: Vertical) {
  if (active === "wine") return createWineBottle();
  if (active === "events") return createEventBracelet();
  if (active === "cosmetics") return createCosmeticBottle();
  return createAgroPacket();
}

function createWineBottle() {
  const tone = tones.wine;
  const group = new THREE.Group();
  group.position.set(0, -0.1, 0);
  group.scale.setScalar(1.08);

  group.add(mesh(
    new THREE.CylinderGeometry(0.58, 0.72, 2.28, 56),
    new THREE.MeshPhysicalMaterial({ color: tone.body, clearcoat: 0.5, metalness: 0.04, roughness: 0.28 }),
    [0, -0.23, 0],
  ));
  group.add(mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 1.08, 48),
    new THREE.MeshPhysicalMaterial({ color: tone.bodyDeep, clearcoat: 0.42, roughness: 0.22 }),
    [0, 1.02, 0],
  ));
  group.add(mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.32, 48),
    new THREE.MeshStandardMaterial({ color: tone.metal, roughness: 0.34, metalness: 0.08 }),
    [0, 1.65, 0],
  ));
  group.add(mesh(
    new THREE.SphereGeometry(0.28, 32, 18),
    new THREE.MeshBasicMaterial({ color: "#fde68a", transparent: true, opacity: 0.5 }),
    [-0.14, 0.58, 0.62],
    [0.04, 0, 0.03],
  ));
  group.add(createProductLabel(tone.label, tone.accent, [0, -0.25, 0.72], [1.05, 0.72, 1]));
  group.add(createSecurityBand(tone.accent, [0, 0.48, 0.86], [0.02, 0, -0.18], "#ecfeff"));
  group.add(createGlassHighlight([-0.32, 0.1, 0.64], 1.9));

  return group;
}

function createEventBracelet() {
  const tone = tones.events;
  const group = new THREE.Group();
  group.position.set(0, -0.04, 0);
  group.rotation.set(0.18, 0.04, -0.12);
  group.scale.setScalar(1.08);

  const band = mesh(
    new THREE.TorusGeometry(0.82, 0.16, 32, 112),
    new THREE.MeshPhysicalMaterial({ color: tone.body, clearcoat: 0.8, metalness: 0.05, roughness: 0.22 }),
    [0, 0, 0],
    [0.12, 0, -0.14],
  );
  band.scale.set(1.55, 0.72, 0.22);
  group.add(band);

  group.add(mesh(
    new THREE.BoxGeometry(0.92, 0.52, 0.18),
    new THREE.MeshStandardMaterial({ color: "#062020", emissive: tone.accentSoft, emissiveIntensity: 0.18, roughness: 0.28 }),
    [0.1, 0.03, 0.33],
    [0.02, 0.02, -0.09],
  ));
  group.add(mesh(new THREE.BoxGeometry(0.58, 0.2, 0.04), basic(tone.label, 0.9), [0.1, 0.03, 0.43], [0.02, 0.02, -0.09]));
  group.add(createSecurityBand(tone.accent, [0, 0.55, 0.68], [0, 0, -0.12], "#ecfeff"));

  [-0.9, -0.55, 0.62, 0.94].forEach((x) => {
    group.add(mesh(new THREE.SphereGeometry(0.08, 24, 16), new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.2 }), [x, -0.18, 0.35]));
  });

  return group;
}

function createCosmeticBottle() {
  const tone = tones.cosmetics;
  const group = new THREE.Group();
  group.position.set(0, -0.14, 0);
  group.scale.setScalar(1.05);

  group.add(mesh(
    new THREE.BoxGeometry(1.12, 2.05, 0.74),
    new THREE.MeshPhysicalMaterial({ color: tone.body, clearcoat: 0.9, metalness: 0.05, opacity: 0.72, roughness: 0.14, transparent: true }),
    [0, -0.1, 0],
  ));
  group.add(mesh(new THREE.BoxGeometry(0.56, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: tone.metal, metalness: 0.45, roughness: 0.18 }), [0, 1.16, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.84, 0.22, 0.55), new THREE.MeshStandardMaterial({ color: "#fafafa", metalness: 0.2, roughness: 0.18 }), [0, 1.48, 0]));
  group.add(createProductLabel("#ede9fe", tone.accent, [0, -0.27, 0.44], [0.84, 0.62, 1]));
  group.add(createSecurityBand(tone.accent, [0, 0.48, 0.63], [0, 0, -0.16], "#f5f3ff"));
  group.add(createGlassHighlight([-0.34, -0.08, 0.42], 1.65));

  return group;
}

function createAgroPacket() {
  const tone = tones.agro;
  const group = new THREE.Group();
  group.position.set(0, -0.15, 0);
  group.rotation.set(0.04, -0.2, 0.04);
  group.scale.setScalar(1.04);

  group.add(mesh(new THREE.BoxGeometry(1.45, 2.3, 0.18), new THREE.MeshPhysicalMaterial({ color: tone.body, clearcoat: 0.35, roughness: 0.3 })));
  group.add(mesh(new THREE.BoxGeometry(1.22, 0.42, 0.035), basic(tone.label), [0, 0.78, 0.11]));
  group.add(mesh(new THREE.BoxGeometry(1.05, 0.4, 0.035), basic(tone.bodyDeep, 0.58), [0, 0.02, 0.12]));
  [-0.42, -0.14, 0.18, 0.46].forEach((x, index) => {
    group.add(mesh(
      new THREE.SphereGeometry(0.12, 24, 14),
      new THREE.MeshStandardMaterial({ color: tone.metal, roughness: 0.38 }),
      [x, -0.58 + (index % 2) * 0.14, 0.16],
      [0, 0, index * 0.38],
    ));
  });
  group.add(createSecurityBand(tone.accent, [0.02, 0.32, 0.28], [0, 0, -0.14], "#f7fee7"));

  return group;
}

function createProductLabel(color: string, accent: string, position: Vec3, scale: Vec3) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.scale.set(...scale);
  group.add(mesh(new THREE.BoxGeometry(1, 0.72, 0.055), new THREE.MeshStandardMaterial({ color, roughness: 0.24 })));
  group.add(mesh(new THREE.BoxGeometry(0.72, 0.08, 0.025), basic(accent, 0.72), [0, 0.21, 0.035]));
  group.add(mesh(new THREE.BoxGeometry(0.58, 0.11, 0.025), basic("#0f172a", 0.86), [0, -0.05, 0.036]));
  group.add(mesh(new THREE.BoxGeometry(0.42, 0.07, 0.025), basic("#1e293b", 0.56), [0, -0.22, 0.036]));
  return group;
}

function createSecurityBand(accent: string, position: Vec3, rotation: Vec3, labelTint: string) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.set(...rotation);
  group.add(mesh(new THREE.BoxGeometry(1.9, 0.42, 0.1), new THREE.MeshStandardMaterial({ color: "#06111f", emissive: accent, emissiveIntensity: 0.2, roughness: 0.2 })));
  group.add(mesh(new THREE.BoxGeometry(0.78, 0.31, 0.035), basic("#071827"), [-0.43, 0, 0.065]));
  group.add(mesh(new THREE.BoxGeometry(0.72, 0.31, 0.035), basic("#0f172a"), [0.47, 0, 0.066]));
  group.add(mesh(new THREE.BoxGeometry(0.035, 0.35, 0.025), basic(accent, 0.82), [0, 0, 0.08]));
  group.add(mesh(new THREE.BoxGeometry(0.42, 0.045, 0.02), basic(labelTint, 0.9), [-0.43, 0.08, 0.09]));
  group.add(mesh(new THREE.BoxGeometry(0.38, 0.045, 0.02), basic(labelTint, 0.9), [0.47, 0.08, 0.09]));
  group.add(mesh(new THREE.BoxGeometry(0.27, 0.035, 0.02), basic(accent, 0.88), [0.47, -0.09, 0.09]));
  return group;
}

function createGlassHighlight(position: Vec3, height: number) {
  return mesh(new THREE.BoxGeometry(0.06, height, 0.025), basic("#ffffff", 0.18), position, [0, 0, 0.08]);
}

function createStageRings(tone: Tone) {
  const group = new THREE.Group();
  group.position.set(0, -1.42, 0);
  group.rotation.x = -Math.PI / 2;
  [1.05, 1.45, 1.9].forEach((radius, index) => {
    group.add(mesh(
      new THREE.TorusGeometry(radius, 0.006, 8, 128),
      basic(tone.accent, 0.28 - index * 0.05),
      [0, 0, 0],
      [0, 0, index * 0.32],
      false,
    ));
  });
  return group;
}

function createTelemetryNodes(tone: Tone) {
  const group = new THREE.Group();
  const nodes: Vec3[] = [
    [-1.55, -0.52, 0.52],
    [1.48, -0.42, 0.48],
    [-1.18, 0.62, 0.25],
    [1.18, 0.7, 0.18],
  ];
  nodes.forEach((position, index) => {
    group.add(mesh(
      new THREE.SphereGeometry(index < 2 ? 0.065 : 0.048, 24, 14),
      basic(index % 2 === 0 ? tone.accent : tone.accentSoft, 0.8),
      position,
      undefined,
      false,
    ));
  });
  return group;
}

function createFloorGlow(tone: Tone) {
  return mesh(
    new THREE.CircleGeometry(2.2, 96),
    basic(tone.accentSoft, 0.08),
    [0, -1.45, 0],
    [-Math.PI / 2, 0, 0],
    false,
  );
}

type Vec3 = [number, number, number];

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3 = [0, 0, 0],
  rotation: Vec3 = [0, 0, 0],
  shadow = true,
) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = shadow;
  item.receiveShadow = shadow;
  return item;
}

function basic(color: string, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    depthWrite: opacity >= 1,
    opacity,
    transparent: opacity < 1,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((item) => {
    if (!(item instanceof THREE.Mesh)) return;
    item.geometry.dispose();
    if (Array.isArray(item.material)) {
      item.material.forEach((material) => material.dispose());
    } else {
      item.material.dispose();
    }
  });
}
