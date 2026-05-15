"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type ProductKind =
  | "wine"
  | "events"
  | "cosmetics"
  | "agro"
  | "seeds"
  | "creamJar"
  | "perfume"
  | "creamTube"
  | "bracelet"
  | "ticket";

export type ProductInteractionState = "idle" | "opened" | "blocked";

type HeroThreeStageProps = {
  active: ProductKind;
  product: string;
  className?: string;
  state?: ProductInteractionState;
  onAction?: (state: ProductInteractionState) => void;
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

const tones: Record<ProductKind, Tone> = {
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
  seeds: {
    accent: "#84cc16",
    accentSoft: "#4d7c0f",
    body: "#65a30d",
    bodyDeep: "#14532d",
    label: "#f7fee7",
    metal: "#facc15",
  },
  bracelet: {
    accent: "#2dd4bf",
    accentSoft: "#0f766e",
    body: "#14b8a6",
    bodyDeep: "#042f2e",
    label: "#f0fdfa",
    metal: "#c4b5fd",
  },
  ticket: {
    accent: "#fb7185",
    accentSoft: "#be123c",
    body: "#e11d48",
    bodyDeep: "#4c0519",
    label: "#fff1f2",
    metal: "#fde68a",
  },
  creamJar: {
    accent: "#f0abfc",
    accentSoft: "#a21caf",
    body: "#f5d0fe",
    bodyDeep: "#701a75",
    label: "#fdf4ff",
    metal: "#e5e7eb",
  },
  perfume: {
    accent: "#38bdf8",
    accentSoft: "#0369a1",
    body: "#0ea5e9",
    bodyDeep: "#082f49",
    label: "#f0f9ff",
    metal: "#e5e7eb",
  },
  creamTube: {
    accent: "#67e8f9",
    accentSoft: "#0e7490",
    body: "#22d3ee",
    bodyDeep: "#164e63",
    label: "#ecfeff",
    metal: "#e5e7eb",
  },
};

export function HeroThreeStage({ active, product, className, state = "idle", onAction, onReady }: HeroThreeStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onActionRef = useRef(onAction);
  const stateRef = useRef<ProductInteractionState>(state);
  const shortProduct = product.length > 24 ? `${product.slice(0, 22)}...` : product;
  const tone = tones[active];

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.62, 6.1);
    camera.lookAt(0, 0.02, 0);

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
    mount.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const toneForScene = tones[active];
    scene.add(createLights(toneForScene));
    scene.add(createStageRings(toneForScene));
    scene.add(createTelemetryNodes(toneForScene));
    const productGroup = createProduct(active);
    const baseProductScale = productGroup.scale.x || 1;
    scene.add(productGroup);
    scene.add(createFloorGlow(toneForScene));

    let frameId = 0;
    let readySent = false;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    let targetRotationX = -0.04;
    let targetRotationY = 0;
    let targetZoom = 1;
    let zoom = 1;
    let openProgress = stateRef.current === "opened" ? 1 : 0;
    let blockedProgress = stateRef.current === "blocked" ? 1 : 0;
    let localState: ProductInteractionState = stateRef.current;
    let lastExternalState: ProductInteractionState = stateRef.current;
    let manualHoldUntil = 0;
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
      event.preventDefault();
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      downX = event.clientX;
      downY = event.clientY;
      manualHoldUntil = performance.now() + 2400;
      mount.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      event.preventDefault();
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      manualHoldUntil = performance.now() + 2800;
      targetRotationY += dx * 0.014;
      targetRotationX = clamp(targetRotationX + dy * 0.0045, -0.35, 0.24);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const clickDistance = Math.hypot(event.clientX - downX, event.clientY - downY);
      dragging = false;
      mount.releasePointerCapture?.(event.pointerId);
      if (clickDistance < 5) {
        localState = localState === "opened" ? "idle" : "opened";
        stateRef.current = localState;
        manualHoldUntil = performance.now() + 2600;
        onActionRef.current?.(localState);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetZoom = clamp(targetZoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.82, 1.28);
      manualHoldUntil = performance.now() + 2200;
    };

    mount.addEventListener("pointerdown", handlePointerDown);
    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    const render = () => {
      const elapsed = clock.getElapsedTime();
      const externalState = stateRef.current;
      if (externalState !== lastExternalState) {
        localState = externalState;
        lastExternalState = externalState;
      }
      const targetOpen = externalState === "opened" || localState === "opened" ? 1 : 0;
      const targetBlocked = externalState === "blocked" || localState === "blocked" ? 1 : 0;
      openProgress += (targetOpen - openProgress) * 0.09;
      blockedProgress += (targetBlocked - blockedProgress) * 0.12;
      zoom += (targetZoom - zoom) * 0.08;
      if (!dragging && performance.now() > manualHoldUntil) {
        const idleRotationY = Math.sin(elapsed * 0.42) * 0.16;
        const idleRotationX = -0.04 + Math.sin(elapsed * 0.38) * 0.028;
        targetRotationY += (idleRotationY - targetRotationY) * 0.018;
        targetRotationX += (idleRotationX - targetRotationX) * 0.03;
      }
      productGroup.rotation.y += (targetRotationY - productGroup.rotation.y) * 0.13;
      productGroup.rotation.x += (targetRotationX - productGroup.rotation.x) * 0.1;
      productGroup.position.y = Math.sin(elapsed * 0.82) * 0.045;
      productGroup.scale.setScalar(baseProductScale * zoom);
      applyProductInteraction(productGroup, active, openProgress, blockedProgress, elapsed);

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
      mount.removeEventListener("wheel", handleWheel);
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
  group.add(new THREE.AmbientLight(0xffffff, 0.72));

  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(3.4, 5.2, 4.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  group.add(key);

  const rim = new THREE.DirectionalLight("#dbeafe", 1.25);
  rim.position.set(-3.2, 2.6, -2.4);
  group.add(rim);

  const accent = new THREE.PointLight(tone.accent, 1.8, 7);
  accent.position.set(-2.8, 1.45, 3.4);
  group.add(accent);

  const violet = new THREE.PointLight("#a78bfa", 0.95, 7);
  violet.position.set(2.2, -0.35, 2.6);
  group.add(violet);

  return group;
}

function createProduct(active: ProductKind) {
  if (active === "wine") return createWineBottle();
  if (active === "events" || active === "bracelet") return createEventBracelet();
  if (active === "ticket") return createEventTicket();
  if (active === "creamJar") return createCreamJar();
  if (active === "perfume") return createPerfumeBottle();
  if (active === "creamTube") return createCreamTube();
  if (active === "cosmetics") return createCosmeticBottle();
  if (active === "seeds") return createSeedPacket();
  return createAgroPacket();
}

function createWineBottle() {
  const tone = tones.wine;
  const group = new THREE.Group();
  group.position.set(0, -0.2, 0);
  group.scale.setScalar(0.94);

  const profile = [
    new THREE.Vector2(0.28, -1.78),
    new THREE.Vector2(0.37, -1.74),
    new THREE.Vector2(0.43, -1.6),
    new THREE.Vector2(0.435, -0.8),
    new THREE.Vector2(0.43, 0.48),
    new THREE.Vector2(0.405, 0.64),
    new THREE.Vector2(0.33, 0.78),
    new THREE.Vector2(0.225, 0.94),
    new THREE.Vector2(0.165, 1.15),
    new THREE.Vector2(0.158, 1.68),
    new THREE.Vector2(0.18, 1.76),
    new THREE.Vector2(0.18, 1.82),
  ];
  const bottle = mesh(
    new THREE.LatheGeometry(profile, 144),
    new THREE.MeshPhysicalMaterial({
      map: darkWineGlassTexture(),
      color: "#ffffff",
      attenuationColor: "#120404",
      attenuationDistance: 0.82,
      clearcoat: 1,
      clearcoatRoughness: 0.055,
      ior: 1.45,
      metalness: 0.02,
      roughness: 0.14,
      thickness: 0.66,
      transmission: 0.035,
      transparent: true,
      opacity: 0.99,
    }),
  );
  group.add(bottle);

  const bottleBase = mesh(new THREE.CylinderGeometry(0.31, 0.39, 0.08, 96), new THREE.MeshPhysicalMaterial({ color: "#020202", clearcoat: 0.75, roughness: 0.18 }), [0, -1.76, 0]);
  bottleBase.name = "basePart";
  group.add(bottleBase);

  const punt = mesh(new THREE.TorusGeometry(0.31, 0.012, 10, 104), basic("#f8fafc", 0.18), [0, -1.78, 0], [Math.PI / 2, 0, 0], false);
  group.add(punt);

  const neck = mesh(
    new THREE.CylinderGeometry(0.158, 0.17, 0.82, 96),
    new THREE.MeshPhysicalMaterial({ map: darkWineGlassTexture(), color: "#ffffff", clearcoat: 1, clearcoatRoughness: 0.06, roughness: 0.14, transmission: 0.025, transparent: true, opacity: 0.99 }),
    [0, 1.38, 0],
  );
  neck.name = "neckPart";
  group.add(neck);

  const capsule = mesh(
    new THREE.CylinderGeometry(0.182, 0.176, 0.58, 96),
    new THREE.MeshStandardMaterial({ map: wineFoilTexture(), color: "#7f1d1d", roughness: 0.18, metalness: 0.24 }),
    [0, 1.55, 0],
  );
  capsule.name = "capPart";
  group.add(capsule);

  [1.18, 1.32, 1.48, 1.66, 1.81].forEach((y, index) => {
    group.add(mesh(
      new THREE.TorusGeometry(index === 4 ? 0.188 : 0.174, 0.005, 8, 96),
      basic(index === 4 ? "#fef3c7" : "#fecaca", index === 4 ? 0.34 : 0.18),
      [0, y, 0],
      [Math.PI / 2, 0, 0],
      false,
    ));
  });

  const cork = mesh(
    new THREE.CylinderGeometry(0.128, 0.132, 0.22, 64),
    new THREE.MeshStandardMaterial({ map: corkTexture(), color: "#b7791f", roughness: 0.54, metalness: 0.02 }),
    [0, 1.88, 0],
  );
  cork.name = "corkPart";
  group.add(cork);

  group.add(createPremiumWineLabel(tone));
  group.add(createPremiumNeckTamperSeal(tone));
  group.add(createGlassHighlightCurved(-0.43, -0.08, 0.438, 2.68, 0.07, 0.18));
  group.add(createGlassHighlightCurved(0.32, -0.18, 0.435, 2.1, 0.04, 0.12));
  group.add(createGlassHighlightCurved(0.08, -0.22, 0.438, 1.9, 0.024, 0.09));
  group.add(createSmallNfcDisc(tone.accent, [0.35, 1.28, 0.22], 0.08));

  return group;
}

function createEventBracelet() {
  const tone = tones.events;
  const group = new THREE.Group();
  group.position.set(0, -0.05, 0);
  group.rotation.set(0.18, 0.02, -0.06);
  group.scale.setScalar(1.02);
  group.add(createEventHand());

  const band = mesh(
    new THREE.TorusGeometry(0.95, 0.115, 28, 160),
    new THREE.MeshPhysicalMaterial({ color: "#0f766e", clearcoat: 0.42, metalness: 0.03, roughness: 0.38 }),
    [0, 0, 0],
    [0.1, 0, -0.12],
  );
  band.scale.set(1.72, 0.58, 0.18);
  band.name = "braceletBand";
  group.add(band);

  group.add(mesh(
    createRoundedBoxGeometry(1.18, 0.5, 0.14, 0.09),
    new THREE.MeshStandardMaterial({ color: "#06111f", emissive: tone.accentSoft, emissiveIntensity: 0.12, roughness: 0.24 }),
    [0.08, 0.02, 0.32],
    [0.02, 0.02, -0.09],
  ));
  group.add(createFlatCanvasPanel("VIP ACCESS", "NFC UID", tone.accent, [0.08, 0.02, 0.405], [0.74, 0.24, 1], [0.02, 0.02, -0.09]));
  group.add(createSmallNfcDisc(tone.accent, [0.74, 0.12, 0.42], 0.16));
  group.add(mesh(new THREE.BoxGeometry(0.12, 0.56, 0.12), new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.42, roughness: 0.18 }), [-0.72, 0, 0.28], [0.02, 0.02, -0.09]));
  group.add(createTapPhone(tone, [1.25, 0.34, 0.72], [-0.12, -0.35, -0.34]));

  [-0.9, -0.55, 0.62, 0.94].forEach((x) => {
    group.add(mesh(new THREE.SphereGeometry(0.065, 24, 16), new THREE.MeshStandardMaterial({ color: "#021a1a", roughness: 0.22 }), [x, -0.16, 0.34]));
  });

  return group;
}

function createEventHand() {
  const group = new THREE.Group();
  group.name = "handPart";
  group.position.set(-0.1, -0.28, -0.08);
  group.rotation.set(0.08, 0.08, -0.06);
  group.add(mesh(
    createRoundedBoxGeometry(2.8, 0.44, 0.42, 0.22),
    new THREE.MeshStandardMaterial({ color: "#b98262", roughness: 0.52, metalness: 0.01 }),
    [0, -0.08, -0.02],
    [0, 0, 0.02],
  ));
  group.add(mesh(
    createRoundedBoxGeometry(0.64, 0.56, 0.46, 0.18),
    new THREE.MeshStandardMaterial({ color: "#c79072", roughness: 0.5, metalness: 0.01 }),
    [1.05, 0.03, 0.03],
    [0, 0, -0.05],
  ));
  [-0.16, -0.02, 0.12, 0.26].forEach((y, index) => {
    group.add(mesh(
      createRoundedBoxGeometry(0.82 - index * 0.05, 0.08, 0.13, 0.04),
      new THREE.MeshStandardMaterial({ color: "#d09a78", roughness: 0.54, metalness: 0.01 }),
      [1.42, y, 0.18 + index * 0.025],
      [0.02, 0.05, -0.08],
    ));
  });
  return group;
}

function createTapPhone(tone: Tone, position: Vec3, rotation: Vec3) {
  const group = new THREE.Group();
  group.name = "tapDevice";
  group.position.set(...position);
  group.rotation.set(...rotation);
  group.add(mesh(
    createRoundedBoxGeometry(0.84, 1.48, 0.1, 0.12),
    new THREE.MeshStandardMaterial({ color: "#020617", roughness: 0.2, metalness: 0.12 }),
  ));
  group.add(mesh(
    createRoundedBoxGeometry(0.7, 1.18, 0.022, 0.08),
    new THREE.MeshBasicMaterial({ color: tone.accent, opacity: 0.2, transparent: true }),
    [0, 0, 0.065],
    [0, 0, 0],
    false,
  ));
  group.add(mesh(new THREE.CircleGeometry(0.12, 36), basic(tone.accent, 0.82), [0, 0.24, 0.08], [0, 0, 0], false));
  return group;
}

function createEventTicket() {
  const tone = tones.ticket;
  const group = new THREE.Group();
  group.position.set(0, -0.06, 0);
  group.rotation.set(0.08, -0.18, -0.08);
  group.scale.setScalar(1.06);

  const ticketBody = mesh(
    createRoundedBoxGeometry(1.9, 1.12, 0.12, 0.12),
    new THREE.MeshPhysicalMaterial({ color: tone.body, clearcoat: 0.8, metalness: 0.02, roughness: 0.22 }),
  );
  ticketBody.name = "ticketPart";
  group.add(ticketBody);
  group.add(mesh(new THREE.BoxGeometry(0.06, 1.05, 0.035), basic("#fff1f2", 0.28), [-0.56, 0, 0.08]));
  group.add(mesh(new THREE.BoxGeometry(0.06, 1.05, 0.035), basic("#fff1f2", 0.28), [0.56, 0, 0.08]));
  [-0.95, 0.95].forEach((x) => {
    group.add(mesh(new THREE.CircleGeometry(0.15, 40), basic("#020617", 0.72), [x, 0, 0.085], [0, 0, 0], false));
  });
  group.add(createFlatCanvasPanel("VIP PASS", "NFC GATE", tone.accent, [-0.05, 0.22, 0.095], [0.92, 0.36, 1]));
  group.add(mesh(new THREE.BoxGeometry(0.56, 0.12, 0.03), basic("#fde68a", 0.9), [-0.16, -0.3, 0.11]));
  group.add(mesh(new THREE.BoxGeometry(0.42, 0.07, 0.03), basic("#ffe4e6", 0.86), [-0.16, -0.48, 0.11]));
  group.add(createSmallNfcDisc(tone.accent, [0.63, 0.34, 0.12], 0.13));
  group.add(createTapPhone(tone, [1.22, 0.24, 0.42], [-0.08, -0.4, -0.22]));

  const qrGroup = new THREE.Group();
  qrGroup.position.set(0.58, -0.36, 0.12);
  [[0, 0], [0.09, 0], [0.18, 0.09], [0, 0.18], [0.18, 0.18], [0.09, 0.27], [0.27, 0]].forEach(([x, y]) => {
    qrGroup.add(mesh(new THREE.BoxGeometry(0.055, 0.055, 0.02), basic("#020617", 0.78), [x - 0.14, y - 0.14, 0], [0, 0, 0], false));
  });
  group.add(qrGroup);

  return group;
}

function createCosmeticBottle() {
  const tone = tones.cosmetics;
  const group = new THREE.Group();
  group.position.set(0, -0.14, 0);
  group.scale.setScalar(1.03);

  group.add(mesh(
    createRoundedBoxGeometry(1.05, 1.92, 0.58, 0.16),
    new THREE.MeshPhysicalMaterial({
      color: "#8b5cf6",
      clearcoat: 1,
      ior: 1.38,
      metalness: 0.04,
      opacity: 0.72,
      roughness: 0.08,
      thickness: 0.38,
      transmission: 0.16,
      transparent: true,
    }),
    [0, -0.14, 0],
  ));
  group.add(mesh(
    createRoundedBoxGeometry(0.92, 1.14, 0.54, 0.13),
    new THREE.MeshStandardMaterial({ color: "#4c1d95", opacity: 0.34, transparent: true, roughness: 0.28 }),
    [0, -0.48, 0.01],
  ));
  const pumpCap = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.34, 64), new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.68, roughness: 0.13 }), [0, 1.05, 0]);
  pumpCap.name = "capPart";
  group.add(pumpCap);
  group.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.28, 56), new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.42, roughness: 0.12 }), [0, 1.34, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.6, 0.15, 0.32), new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.24, roughness: 0.14 }), [0.12, 1.49, 0], [0, 0, -0.02]));
  group.add(mesh(new THREE.BoxGeometry(0.28, 0.07, 0.11), new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.48, roughness: 0.16 }), [0.48, 1.55, 0]));
  group.add(createFlatCanvasPanel("SERUM", "AUTHENTIC", tone.accent, [0, -0.36, 0.322], [0.8, 0.6, 1]));
  group.add(createFlatCanvasPanel("NFC", "SEAL", tone.accent, [0.02, 0.62, 0.342], [0.52, 0.22, 1]));
  group.add(createSmallNfcDisc(tone.accent, [0.44, 0.76, 0.35], 0.12));
  group.add(createGlassHighlight([-0.36, -0.12, 0.33], 1.58));

  return group;
}

function createCreamJar() {
  const tone = tones.creamJar;
  const group = new THREE.Group();
  group.position.set(0, -0.18, 0);
  group.scale.setScalar(1.04);

  const jarCap = mesh(
    new THREE.CylinderGeometry(0.66, 0.58, 0.52, 80),
    new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.46, roughness: 0.16 }),
    [0, 0.64, 0],
  );
  jarCap.name = "capPart";
  group.add(jarCap);
  group.add(mesh(
    new THREE.CylinderGeometry(0.58, 0.66, 1.18, 88),
    new THREE.MeshPhysicalMaterial({
      color: "#f5d0fe",
      clearcoat: 1,
      ior: 1.38,
      opacity: 0.76,
      roughness: 0.1,
      thickness: 0.36,
      transmission: 0.18,
      transparent: true,
    }),
    [0, -0.25, 0],
  ));
  group.add(mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.78, 80), basic("#fdf4ff", 0.46), [0, -0.42, 0], undefined, false));
  group.add(mesh(new THREE.TorusGeometry(0.61, 0.018, 10, 96), basic("#f0abfc", 0.54), [0, 0.34, 0], [Math.PI / 2, 0, 0], false));
  group.add(createFlatCanvasPanel("CREMA", "GARANTIA", tone.accent, [0, -0.25, 0.61], [0.78, 0.38, 1]));
  group.add(createSmallNfcDisc(tone.accent, [0.42, 0.7, 0.46], 0.12));
  group.add(createGlassHighlight([-0.33, -0.25, 0.56], 0.9));

  return group;
}

function createPerfumeBottle() {
  const tone = tones.perfume;
  const group = new THREE.Group();
  group.position.set(0, -0.16, 0);
  group.scale.setScalar(1.02);

  group.add(mesh(
    createRoundedBoxGeometry(0.98, 1.72, 0.52, 0.18),
    new THREE.MeshPhysicalMaterial({
      color: "#7dd3fc",
      clearcoat: 1,
      ior: 1.48,
      metalness: 0.02,
      opacity: 0.62,
      roughness: 0.06,
      thickness: 0.42,
      transmission: 0.32,
      transparent: true,
    }),
    [0, -0.35, 0],
  ));
  group.add(mesh(
    createRoundedBoxGeometry(0.82, 0.84, 0.44, 0.13),
    new THREE.MeshStandardMaterial({ color: "#0c4a6e", opacity: 0.32, transparent: true, roughness: 0.16 }),
    [0, -0.62, 0.01],
  ));
  group.add(mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.28, 56), new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.72, roughness: 0.12 }), [0, 0.68, 0]));
  const perfumeCap = mesh(new THREE.BoxGeometry(0.68, 0.42, 0.38), new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.36, roughness: 0.12 }), [0, 1.05, 0]);
  perfumeCap.name = "capPart";
  group.add(perfumeCap);
  group.add(mesh(new THREE.BoxGeometry(0.46, 0.08, 0.14), new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.58, roughness: 0.12 }), [0.38, 1.18, 0]));
  group.add(createFlatCanvasPanel("PARFUM", "LIMITED", tone.accent, [0, -0.35, 0.295], [0.72, 0.44, 1]));
  group.add(createSmallNfcDisc(tone.accent, [0.38, 0.38, 0.31], 0.12));
  group.add(createGlassHighlight([-0.33, -0.34, 0.31], 1.35));

  return group;
}

function createCreamTube() {
  const tone = tones.creamTube;
  const group = new THREE.Group();
  group.position.set(0, -0.2, 0);
  group.rotation.set(0.02, 0.16, -0.04);
  group.scale.setScalar(1.02);

  const profile = [
    new THREE.Vector2(0.38, -1.36),
    new THREE.Vector2(0.48, -1.16),
    new THREE.Vector2(0.5, 0.68),
    new THREE.Vector2(0.35, 1.08),
    new THREE.Vector2(0.22, 1.22),
  ];
  group.add(mesh(
    new THREE.LatheGeometry(profile, 84),
    new THREE.MeshPhysicalMaterial({ color: "#22d3ee", clearcoat: 0.7, roughness: 0.18, metalness: 0.02 }),
  ));
  const tubeCap = mesh(new THREE.CylinderGeometry(0.46, 0.42, 0.34, 72), new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.62, roughness: 0.14 }), [0, -1.52, 0]);
  tubeCap.name = "capPart";
  group.add(tubeCap);
  group.add(mesh(new THREE.TorusGeometry(0.45, 0.018, 10, 88), basic("#ecfeff", 0.42), [0, -1.34, 0], [Math.PI / 2, 0, 0], false));
  group.add(createBottleLabel("DERMO", "CREMA", tone.accent, -0.12, 0.512, 0.72, 0.54));
  group.add(createFlatCanvasPanel("NFC", "LOTE", tone.accent, [0.02, 0.64, 0.51], [0.48, 0.2, 1]));
  group.add(createGlassHighlightCurved(-0.42, -0.12, 0.49, 1.72, 0.06, 0.14));

  return group;
}

function createAgroPacket() {
  const tone = tones.agro;
  const group = new THREE.Group();
  group.position.set(0, -0.15, 0);
  group.rotation.set(0.04, -0.12, 0.03);
  group.scale.setScalar(1.04);

  group.add(mesh(createRoundedBoxGeometry(1.5, 2.25, 0.16, 0.1), new THREE.MeshPhysicalMaterial({ color: tone.body, clearcoat: 0.45, roughness: 0.32 })));
  const packetTop = mesh(new THREE.BoxGeometry(1.42, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: "#bef264", roughness: 0.38 }), [0, 1.02, 0.11]);
  packetTop.name = "capPart";
  group.add(packetTop);
  group.add(mesh(new THREE.BoxGeometry(0.08, 2.1, 0.045), basic("#ecfccb", 0.2), [-0.68, -0.02, 0.12]));
  group.add(mesh(new THREE.BoxGeometry(0.08, 2.1, 0.045), basic("#052e16", 0.2), [0.68, -0.02, 0.12]));
  group.add(mesh(new THREE.BoxGeometry(0.5, 0.035, 0.06), basic("#052e16", 0.42), [0, 1.14, 0.13]));
  group.add(createFlatCanvasPanel("SEMILLAS", "LOTE A12", "#bef264", [0, 0.56, 0.13], [1.1, 0.42, 1]));
  group.add(createFlatCanvasPanel("NFC", "TRAZA", "#bef264", [0, -0.05, 0.14], [0.86, 0.34, 1]));
  group.add(mesh(new THREE.CircleGeometry(0.28, 40), basic("#064e3b", 0.54), [0, -0.54, 0.17], [0, 0, 0], false));
  group.add(mesh(new THREE.BoxGeometry(1.38, 0.05, 0.055), basic("#fef08a", 0.78), [0, -0.95, 0.13]));
  [-0.42, -0.14, 0.18, 0.46].forEach((x, index) => {
    group.add(mesh(
      new THREE.SphereGeometry(0.12, 24, 14),
      new THREE.MeshStandardMaterial({ color: tone.metal, roughness: 0.38 }),
      [x, -0.58 + (index % 2) * 0.14, 0.16],
      [0, 0, index * 0.38],
    ));
  });
  group.add(createSmallNfcDisc(tone.accent, [0.56, 0.9, 0.19], 0.14));

  return group;
}

function createSeedPacket() {
  const group = createAgroPacket();
  group.rotation.z = -0.02;
  group.scale.setScalar(0.98);
  return group;
}

function createPremiumWineLabel(tone: Tone) {
  const group = new THREE.Group();
  const label = mesh(
    curvedPanelGeometry(0.88, 1.18, 0.444, 56, 3),
    new THREE.MeshStandardMaterial({ map: wineLabelTexture(tone.accent), roughness: 0.5, side: THREE.FrontSide }),
    [0, -0.5, 0],
    [0, 0, 0],
    false,
  );
  group.add(label);
  group.add(mesh(
    curvedPanelGeometry(0.92, 1.22, 0.439, 56, 3),
    basic("#020617", 0.18),
    [0, -0.5, 0],
    [0, 0, 0],
    false,
  ));
  return group;
}

function createPremiumNeckTamperSeal(tone: Tone) {
  const group = new THREE.Group();
  group.name = "tamperSeal";
  group.rotation.y = -0.36;
  group.add(mesh(
    curvedPanelGeometry(0.245, 1.18, 0.189, 24, 3),
    new THREE.MeshStandardMaterial({ map: tamperSealTexture(tone.accent), roughness: 0.42, side: THREE.FrontSide }),
    [0, 1.42, 0],
    [0, 0, 0],
    false,
  ));
  const cutLine = mesh(new THREE.BoxGeometry(0.012, 1.1, 0.014), basic(tone.accent, 0.86), [0, 1.42, 0.192], [0, 0, 0], false);
  cutLine.name = "cutLine";
  group.add(cutLine);
  const splitLeft = mesh(new THREE.BoxGeometry(0.082, 0.48, 0.018), basic("#f8fafc", 0.78), [-0.056, 1.54, 0.2], [0, 0, -0.08], false);
  splitLeft.name = "splitLeft";
  const splitRight = mesh(new THREE.BoxGeometry(0.082, 0.48, 0.018), basic(tone.accent, 0.64), [0.056, 1.32, 0.2], [0, 0, 0.08], false);
  splitRight.name = "splitRight";
  group.add(splitLeft);
  group.add(splitRight);
  return group;
}

function wineLabelTexture(accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const paper = ctx.createLinearGradient(0, 0, 0, canvas.height);
  paper.addColorStop(0, "#fbfaf4");
  paper.addColorStop(0.48, "#f3efe4");
  paper.addColorStop(1, "#e8dfcf");
  roundedRect(ctx, 34, 34, 832, 1132, 34, "#1f2937");
  roundedRect(ctx, 48, 48, 804, 1104, 26, "#f8f3e9");
  ctx.fillStyle = paper;
  ctx.fillRect(74, 74, 752, 1052);

  ctx.strokeStyle = "rgba(24, 24, 27, 0.44)";
  ctx.lineWidth = 4;
  ctx.strokeRect(96, 96, 708, 1008);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(166, 156);
  ctx.lineTo(734, 156);
  ctx.stroke();

  ctx.fillStyle = "#1f2937";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 52px Georgia, 'Times New Roman', serif";
  ctx.fillText("GRAN RESERVA", 450, 286, 680);
  ctx.font = "900 112px Georgia, 'Times New Roman', serif";
  ctx.fillText("MALBEC", 450, 426, 720);
  ctx.font = "600 31px Georgia, 'Times New Roman', serif";
  ctx.fillText("VALLE DE UCO, ARGENTINA", 450, 508, 620);
  ctx.font = "700 48px Georgia, 'Times New Roman', serif";
  ctx.fillText("2022", 450, 590, 420);

  ctx.strokeStyle = "rgba(31, 41, 55, 0.28)";
  ctx.lineWidth = 3;
  for (let index = 0; index < 13; index += 1) {
    const y = 714 + index * 20;
    ctx.beginPath();
    ctx.moveTo(162, y + 34);
    ctx.quadraticCurveTo(450, y - 58 - index * 1.5, 738, y + 34);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(31, 41, 55, 0.36)";
  ctx.lineWidth = 2;
  for (let index = 0; index < 15; index += 1) {
    const x = 180 + index * 38;
    ctx.beginPath();
    ctx.moveTo(450, 650);
    ctx.lineTo(x, 940);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(31, 41, 55, 0.32)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(142, 708);
  ctx.quadraticCurveTo(320, 590, 470, 704);
  ctx.quadraticCurveTo(585, 605, 762, 714);
  ctx.stroke();

  ctx.fillStyle = "rgba(31, 41, 55, 0.82)";
  ctx.font = "700 26px Arial, sans-serif";
  ctx.fillText("MZA-2026-0424", 450, 1038, 420);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function tamperSealTexture(accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 1400;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const paper = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  paper.addColorStop(0, "#fbfaf5");
  paper.addColorStop(0.55, "#f1eee5");
  paper.addColorStop(1, "#ffffff");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.1)";
  ctx.lineWidth = 4;
  for (let index = -12; index < 26; index += 1) {
    ctx.beginPath();
    ctx.moveTo(index * 34, 0);
    ctx.lineTo(index * 34 + 520, 1400);
    ctx.stroke();
  }
  ctx.fillStyle = "#7f1d1d";
  ctx.fillRect(0, 0, canvas.width, 230);
  ctx.fillStyle = "rgba(34, 211, 238, 0.5)";
  ctx.fillRect(202, 0, 16, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 58px Arial, sans-serif";
  ctx.fillText("NFC", 210, 650, 300);
  ctx.font = "800 42px Arial, sans-serif";
  ctx.fillText("424 DNA", 210, 724, 320);
  ctx.font = "800 34px Arial, sans-serif";
  ctx.fillText("TT SEAL", 210, 790, 320);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.32)";
  ctx.lineWidth = 6;
  ctx.strokeRect(94, 500, 232, 390);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function wineFoilTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const foil = ctx.createLinearGradient(0, 0, canvas.width, 0);
  foil.addColorStop(0, "#3f0707");
  foil.addColorStop(0.22, "#b91c1c");
  foil.addColorStop(0.46, "#7f1d1d");
  foil.addColorStop(0.7, "#e11d48");
  foil.addColorStop(1, "#450a0a");
  ctx.fillStyle = foil;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  for (let x = 24; x < canvas.width; x += 74) ctx.fillRect(x, 0, 10, canvas.height);
  ctx.fillStyle = "rgba(2, 6, 23, 0.36)";
  ctx.fillRect(0, 620, canvas.width, 36);
  ctx.fillStyle = "rgba(254, 243, 199, 0.42)";
  ctx.fillRect(0, 70, canvas.width, 18);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function darkWineGlassTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const base = ctx.createLinearGradient(0, 0, canvas.width, 0);
  base.addColorStop(0, "#050202");
  base.addColorStop(0.15, "#1d0505");
  base.addColorStop(0.28, "#060202");
  base.addColorStop(0.5, "#0b0303");
  base.addColorStop(0.68, "#2a0707");
  base.addColorStop(0.82, "#070202");
  base.addColorStop(1, "#010101");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const shoulder = ctx.createRadialGradient(360, 250, 20, 360, 250, 520);
  shoulder.addColorStop(0, "rgba(255, 255, 255, 0.16)");
  shoulder.addColorStop(0.22, "rgba(255, 255, 255, 0.055)");
  shoulder.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = shoulder;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.fillRect(132, 180, 24, 1040);
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(214, 270, 12, 960);
  ctx.fillStyle = "rgba(147, 197, 253, 0.18)";
  ctx.fillRect(600, 230, 11, 1000);
  ctx.fillStyle = "rgba(127, 29, 29, 0.36)";
  ctx.fillRect(442, 0, 62, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 10;
  texture.needsUpdate = true;
  return texture;
}

function corkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#b7791f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(76, 29, 0, 0.25)";
  for (let y = 16; y < canvas.height; y += 34) ctx.fillRect(0, y, canvas.width, 5);
  ctx.fillStyle = "rgba(255, 237, 213, 0.24)";
  for (let x = 10; x < canvas.width; x += 38) ctx.fillRect(x, 0, 4, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 6;
  texture.needsUpdate = true;
  return texture;
}

function createBottleLabel(title: string, subtitle: string, accent: string, y: number, radius: number, width: number, height: number) {
  const group = new THREE.Group();
  group.add(mesh(
    curvedPanelGeometry(width, height, radius, 44, 2),
    new THREE.MeshStandardMaterial({ map: labelTexture(title, subtitle, accent, "#f8fafc", "#172033"), roughness: 0.42, side: THREE.FrontSide }),
    [0, y, 0],
    [0, 0, 0],
    false,
  ));
  return group;
}

function createNeckTamperSeal(tone: Tone) {
  const group = new THREE.Group();
  group.name = "tamperSeal";
  group.add(mesh(
    curvedPanelGeometry(0.31, 1.2, 0.236, 22, 2),
    new THREE.MeshStandardMaterial({ map: labelTexture("NFC TT", "SEAL", tone.accent, "#ecfeff", "#06111f"), roughness: 0.34, side: THREE.FrontSide }),
    [0, 1.34, 0],
    [0, 0, 0],
    false,
  ));
  const cutLine = mesh(new THREE.BoxGeometry(0.02, 1.16, 0.014), basic(tone.accent, 0.86), [0, 1.34, 0.242], [0, 0, 0], false);
  cutLine.name = "cutLine";
  group.add(cutLine);
  group.add(mesh(new THREE.BoxGeometry(0.24, 0.045, 0.014), basic("#ffffff", 0.58), [0, 1.72, 0.244], [0, 0, 0], false));
  [-0.085, 0, 0.085].forEach((x) => {
    group.add(mesh(new THREE.BoxGeometry(0.01, 1.08, 0.016), basic("#0e7490", 0.48), [x, 1.34, 0.246], [0, 0, 0], false));
  });
  const splitLeft = mesh(new THREE.BoxGeometry(0.12, 0.38, 0.018), basic(tone.accent, 0.64), [-0.09, 1.42, 0.255], [0, 0, -0.12], false);
  splitLeft.name = "splitLeft";
  const splitRight = mesh(new THREE.BoxGeometry(0.12, 0.38, 0.018), basic("#f8fafc", 0.36), [0.09, 1.26, 0.255], [0, 0, 0.12], false);
  splitRight.name = "splitRight";
  group.add(splitLeft);
  group.add(splitRight);
  return group;
}

function createFlatCanvasPanel(title: string, subtitle: string, accent: string, position: Vec3, scale: Vec3, rotation: Vec3 = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.set(...rotation);
  group.scale.set(...scale);
  group.add(mesh(
    new THREE.PlaneGeometry(1, 0.48),
    new THREE.MeshStandardMaterial({ map: labelTexture(title, subtitle, accent, "#f8fafc", "#111827"), roughness: 0.38, side: THREE.DoubleSide }),
    [0, 0, 0],
    [0, 0, 0],
    false,
  ));
  return group;
}

function createSmallNfcDisc(accent: string, position: Vec3, radius = 0.18) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.add(mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshStandardMaterial({ color: "#06111f", emissive: accent, emissiveIntensity: 0.2, roughness: 0.24, side: THREE.DoubleSide }), [0, 0, 0], [0, 0, 0], false));
  group.add(mesh(new THREE.RingGeometry(radius * 0.68, radius * 0.92, 48), basic(accent, 0.92), [0, 0, 0.006], [0, 0, 0], false));
  return group;
}

function createGlassHighlight(position: Vec3, height: number) {
  return mesh(new THREE.BoxGeometry(0.06, height, 0.025), basic("#ffffff", 0.18), position, [0, 0, 0.08]);
}

function createGlassHighlightCurved(angle: number, y: number, radius: number, height: number, width: number, opacity = 0.16) {
  const material = basic("#ffffff", opacity);
  material.side = THREE.DoubleSide;
  return mesh(curvedPanelGeometry(width, height, radius, 5, 1, angle), material, [0, y, 0], [0, 0, 0], false);
}

function curvedPanelGeometry(width: number, height: number, radius: number, segmentsX = 32, segmentsY = 1, angleOffset = 0) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const angleSpan = width / radius;
  for (let yIndex = 0; yIndex <= segmentsY; yIndex++) {
    const v = yIndex / segmentsY;
    const y = (v - 0.5) * height;
    for (let xIndex = 0; xIndex <= segmentsX; xIndex++) {
      const u = xIndex / segmentsX;
      const angle = (u - 0.5) * angleSpan + angleOffset;
      positions.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
      uvs.push(u, v);
    }
  }
  const row = segmentsX + 1;
  for (let yIndex = 0; yIndex < segmentsY; yIndex++) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex++) {
      const a = yIndex * row + xIndex;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedBoxGeometry(width: number, height: number, depth: number, radius: number) {
  const x = width / 2;
  const y = height / 2;
  const r = Math.min(radius, x, y);
  const shape = new THREE.Shape();
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 8,
    bevelSize: Math.min(0.045, depth * 0.18),
    bevelThickness: Math.min(0.045, depth * 0.18),
    curveSegments: 14,
  });
  geometry.center();
  return geometry;
}

function labelTexture(title: string, subtitle: string, accent: string, paper = "#f8fafc", ink = "#0f172a") {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const draw = () => {
    roundedRect(ctx, 36, 36, 952, 440, 54, paper);
    roundedRect(ctx, 116, 80, 792, 34, 17, accent);
    ctx.fillStyle = ink;
    ctx.font = "900 68px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 512, 210, 780);
    ctx.font = "900 86px Arial, sans-serif";
    ctx.fillStyle = ink;
    ctx.fillText(subtitle, 512, 306, 720);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.18)";
    ctx.lineWidth = 5;
    for (let index = 0; index < 5; index += 1) {
      const y = 366 + index * 16;
      ctx.beginPath();
      ctx.moveTo(278, y);
      ctx.quadraticCurveTo(512, y - 34 - index * 3, 746, y);
      ctx.stroke();
    }
    roundedRect(ctx, 350, 438, 324, 18, 9, "rgba(15, 23, 42, 0.15)");
  };

  draw();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
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

function applyProductInteraction(root: THREE.Group, active: ProductKind, opened: number, blocked: number, elapsed: number) {
  const cutPulse = opened > 0.04 ? 1 : 0;
  const phonePulse = active === "bracelet" || active === "events" || active === "ticket"
    ? Math.max(opened, 0.42 + Math.sin(elapsed * 2.8) * 0.08)
    : opened;

  animateNamed(root, "corkPart", (item, base) => {
    item.position.set(
      base.position.x - opened * 0.34,
      base.position.y + opened * 1.05,
      base.position.z + opened * 0.18,
    );
    item.rotation.set(
      base.rotation.x + opened * 0.28,
      base.rotation.y + opened * 0.54,
      base.rotation.z - opened * 0.9,
    );
  });

  animateNamed(root, "capPart", (item, base) => {
    const capLift = active === "creamTube" ? -opened * 0.28 : opened * 0.42;
    item.position.set(
      base.position.x + (active === "seeds" || active === "agro" ? opened * 0.18 : 0),
      base.position.y + capLift,
      base.position.z + opened * 0.18,
    );
    item.rotation.set(
      base.rotation.x + opened * 0.24,
      base.rotation.y + opened * 0.35,
      base.rotation.z + opened * (active === "seeds" || active === "agro" ? -0.42 : 0.72),
    );
  });

  animateNamed(root, "tamperSeal", (item, base) => {
    item.position.set(base.position.x + opened * 0.03, base.position.y, base.position.z + opened * 0.02);
    item.rotation.set(base.rotation.x, base.rotation.y + opened * 0.1, base.rotation.z + opened * 0.08);
  });

  animateNamed(root, "splitLeft", (item, base) => {
    item.position.set(base.position.x - opened * 0.08, base.position.y + opened * 0.08, base.position.z + opened * 0.04);
    item.rotation.set(base.rotation.x + opened * 0.16, base.rotation.y, base.rotation.z - opened * 0.72);
    setOpacity(item, 0.64 + cutPulse * 0.24);
  });

  animateNamed(root, "splitRight", (item, base) => {
    item.position.set(base.position.x + opened * 0.08, base.position.y - opened * 0.08, base.position.z + opened * 0.04);
    item.rotation.set(base.rotation.x - opened * 0.16, base.rotation.y, base.rotation.z + opened * 0.72);
    setOpacity(item, 0.42 + cutPulse * 0.28);
  });

  animateNamed(root, "cutLine", (item, base) => {
    item.scale.set(base.scale.x * (1 + opened * 0.55), base.scale.y, base.scale.z);
    item.rotation.set(base.rotation.x, base.rotation.y, base.rotation.z + opened * 0.28);
    setOpacity(item, blocked > 0.02 ? 0.95 : 0.7 + opened * 0.25);
  });

  animateNamed(root, "tapDevice", (item, base) => {
    item.position.set(
      base.position.x - phonePulse * 0.36 + Math.sin(elapsed * 4) * 0.018,
      base.position.y + Math.sin(elapsed * 3.3) * 0.018,
      base.position.z + phonePulse * 0.12,
    );
    item.rotation.set(
      base.rotation.x,
      base.rotation.y + phonePulse * 0.14,
      base.rotation.z - phonePulse * 0.08,
    );
  });

  animateNamed(root, "braceletBand", (item, base) => {
    item.scale.set(base.scale.x * (1 + opened * 0.035), base.scale.y * (1 + opened * 0.035), base.scale.z);
  });

  animateNamed(root, "ticketPart", (item, base) => {
    item.rotation.set(base.rotation.x + opened * 0.08, base.rotation.y, base.rotation.z + opened * 0.18);
    item.position.set(base.position.x - opened * 0.06, base.position.y + opened * 0.03, base.position.z);
  });

  if (root.userData.baseRotationZ == null) root.userData.baseRotationZ = root.rotation.z;
  root.rotation.z = Number(root.userData.baseRotationZ) + Math.sin(elapsed * 28) * 0.035 * blocked;
}

type TransformBase = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
};

function getTransformBase(item: THREE.Object3D): TransformBase {
  if (!item.userData.baseTransform) {
    item.userData.baseTransform = {
      position: item.position.clone(),
      rotation: item.rotation.clone(),
      scale: item.scale.clone(),
    } satisfies TransformBase;
  }
  return item.userData.baseTransform as TransformBase;
}

function animateNamed(root: THREE.Object3D, name: string, update: (item: THREE.Object3D, base: TransformBase) => void) {
  const item = root.getObjectByName(name);
  if (!item) return;
  update(item, getTransformBase(item));
}

function setOpacity(item: THREE.Object3D, opacity: number) {
  if (!(item instanceof THREE.Mesh)) return;
  const materials = Array.isArray(item.material) ? item.material : [item.material];
  materials.forEach((material) => {
    material.transparent = true;
    material.opacity = clamp(opacity, 0, 1);
  });
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
