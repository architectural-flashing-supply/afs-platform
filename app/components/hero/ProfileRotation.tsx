'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface ProfileRotationProps {
  className?: string;
}

interface Point2D {
  x: number;
  y: number;
}

// Z-flashing centerline (top leg / web / bottom leg) — a recognizable
// two-bend profile shape, built into a solid via offsetPolyline below the
// same way ProfileViewer3D (components/studio/ProfileViewer3D.tsx) turns a
// bend-sequence centerline into a ribbon outline for ExtrudeGeometry.
const CENTERLINE: Point2D[] = [
  { x: -1.4, y: 0.9 },
  { x: 0, y: 0.9 },
  { x: 0, y: -0.9 },
  { x: 1.4, y: -0.9 },
];
const THICKNESS = 0.08;
const EXTRUDE_DEPTH = 4.2;

// mirrors afs-crimson (DESIGN_TOKENS.md #C0001A) — a WebGL material color
// can't consume Tailwind classes or CSS custom properties, same documented
// exception as ProfileViewer3D/CANVAS_COLORS (DESIGN_TOKENS.md §10).
const AFS_CRIMSON = '#C0001A';
const METAL_COLOR = '#B8C4CC';

const LOOP_SECONDS = 8;
const BEND_LINE_SLIDE_DISTANCE = 0.5;
const STATIC_ROTATION_Y = Math.PI * 0.15;

function segNormal(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function offsetPolyline(points: Point2D[], offset: number): Point2D[] {
  return points.map((p, i) => {
    let n: Point2D;
    if (i === 0) {
      n = segNormal(points[0], points[1] ?? points[0]);
    } else if (i === points.length - 1) {
      n = segNormal(points[i - 1], points[i]);
    } else {
      const n1 = segNormal(points[i - 1], points[i]);
      const n2 = segNormal(points[i], points[i + 1]);
      const nx = n1.x + n2.x;
      const ny = n1.y + n2.y;
      const len = Math.hypot(nx, ny) || 1;
      n = { x: nx / len, y: ny / len };
    }
    return { x: p.x + n.x * offset, y: p.y + n.y * offset };
  });
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Continuous across the whole 8s loop so t=8 lands exactly back on t=0 (mod
// 2*PI) with no jump: a full 360 in the first 4s, held through the
// unfold/bend-line showcase (4.0-6.0s), then another full turn on the way
// back to the loop start.
function computeRotationY(t: number): number {
  const FULL = Math.PI * 2;
  if (t < 4.0) return (t / 4.0) * FULL;
  if (t < 6.0) return FULL;
  return FULL + ((t - 6.0) / 2.0) * FULL;
}

function computeUnfoldScaleX(t: number): number {
  if (t >= 3.5 && t < 5.0) return 1 + easeInOutCubic((t - 3.5) / 1.5) * 2;
  if (t >= 5.0 && t < 5.5) return 3;
  if (t >= 5.5 && t < 6.0) return 3 - easeInOutCubic((t - 5.5) / 0.5) * 2;
  return 1;
}

function computeBendLineProgress(t: number): number {
  if (t >= 4.0 && t < 4.5) return easeInOutCubic((t - 4.0) / 0.5);
  if (t >= 4.5 && t < 5.5) return 1;
  if (t >= 5.5 && t < 6.0) return 1 - easeInOutCubic((t - 5.5) / 0.5);
  return 0;
}

interface BendLine {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  restPosition: THREE.Vector3;
  outNormal: THREE.Vector3;
}

interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshGroup: THREE.Group;
  bendLines: BendLine[];
  envTexture: THREE.Texture;
  disposables: { geometry: THREE.BufferGeometry; material: THREE.Material }[];
}

function buildScene(renderer: THREE.WebGLRenderer, width: number, height: number): SceneHandles {
  const scene = new THREE.Scene();

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const envTexture = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
  scene.environment = envTexture;
  roomEnvironment.dispose();
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0.6, 8.5);
  camera.lookAt(0, 0, 0);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 5, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.radius = 6; // soft-edged shadow without the deprecated renderer-level PCFSoftShadowMap flag
  keyLight.shadow.camera.left = -6;
  keyLight.shadow.camera.right = 6;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -6;
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const disposables: SceneHandles['disposables'] = [];

  const outer = offsetPolyline(CENTERLINE, THICKNESS / 2);
  const inner = offsetPolyline(CENTERLINE, -THICKNESS / 2).slice().reverse();
  const outline = [...outer, ...inner];
  const shape = new THREE.Shape();
  outline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
  shape.closePath();

  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const centerShift = new THREE.Vector3(
    -(Math.min(...xs) + Math.max(...xs)) / 2,
    -(Math.min(...ys) + Math.max(...ys)) / 2,
    -EXTRUDE_DEPTH / 2
  );

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: EXTRUDE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.01,
    bevelSegments: 3,
  });
  geometry.translate(centerShift.x, centerShift.y, centerShift.z);

  // Procedural brushed-metal appearance (metalness/roughness + the PMREM
  // room environment above for reflections) rather than hero-profile.png —
  // that asset is a photographic reference shot, not an equirectangular
  // environment map, so sampling it as a material texture would look flat
  // rather than improve realism.
  const material = new THREE.MeshStandardMaterial({
    color: METAL_COLOR,
    metalness: 0.85,
    roughness: 0.42,
    envMapIntensity: 1.1,
  });
  disposables.push({ geometry, material });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const meshGroup = new THREE.Group();
  meshGroup.add(mesh);

  const shadowGeometry = new THREE.PlaneGeometry(24, 24);
  const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.28 });
  disposables.push({ geometry: shadowGeometry, material: shadowMaterial });
  const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.3;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const bendLines: BendLine[] = [];
  for (let i = 1; i < CENTERLINE.length - 1; i++) {
    const prev = CENTERLINE[i - 1];
    const curr = CENTERLINE[i];
    const next = CENTERLINE[i + 1];
    const n1 = segNormal(prev, curr);
    const n2 = segNormal(curr, next);
    const nx = n1.x + n2.x;
    const ny = n1.y + n2.y;
    const nlen = Math.hypot(nx, ny) || 1;
    const outNormal = new THREE.Vector3(nx / nlen, ny / nlen, 0);

    const barGeometry = new THREE.BoxGeometry(0.05, 0.05, EXTRUDE_DEPTH * 0.94);
    const barMaterial = new THREE.MeshBasicMaterial({ color: AFS_CRIMSON, transparent: true, opacity: 0 });
    disposables.push({ geometry: barGeometry, material: barMaterial });
    const bar = new THREE.Mesh(barGeometry, barMaterial);
    const restPosition = new THREE.Vector3(curr.x + centerShift.x, curr.y + centerShift.y, 0);
    bar.position.copy(restPosition);
    meshGroup.add(bar);
    bendLines.push({ mesh: bar, material: barMaterial, restPosition, outNormal });
  }

  scene.add(meshGroup);

  return { renderer, scene, camera, meshGroup, bendLines, envTexture, disposables };
}

export default function ProfileRotation({ className }: ProfileRotationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const handles = buildScene(renderer, width, height);

    let frameId: number | null = null;
    let startTime: number | null = null;

    const renderStaticFrame = () => {
      handles.meshGroup.rotation.y = STATIC_ROTATION_Y;
      handles.meshGroup.scale.x = 1;
      handles.bendLines.forEach(({ mesh, material, restPosition }) => {
        mesh.position.copy(restPosition);
        material.opacity = 0;
      });
      handles.renderer.render(handles.scene, handles.camera);
    };

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      if (startTime === null) startTime = now;
      const t = ((now - startTime) / 1000) % LOOP_SECONDS;

      handles.meshGroup.rotation.y = computeRotationY(t);
      handles.meshGroup.scale.x = computeUnfoldScaleX(t);

      const progress = computeBendLineProgress(t);
      const slide = BEND_LINE_SLIDE_DISTANCE * (1 - progress);
      handles.bendLines.forEach(({ mesh, material, restPosition, outNormal }) => {
        mesh.position.set(
          restPosition.x + outNormal.x * slide,
          restPosition.y + outNormal.y * slide,
          restPosition.z
        );
        material.opacity = progress;
      });

      handles.renderer.render(handles.scene, handles.camera);
    };

    const startLoop = () => {
      if (frameId !== null) return;
      startTime = null;
      frameId = requestAnimationFrame(animate);
    };

    const stopLoopStatic = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      renderStaticFrame();
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      stopLoopStatic();
    } else {
      startLoop();
    }
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) stopLoopStatic();
      else startLoop();
    };
    motionQuery.addEventListener('change', handleMotionChange);

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      handles.camera.aspect = w / h;
      handles.camera.updateProjectionMatrix();
      handles.renderer.setSize(w, h);
      handles.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (motionQuery.matches) renderStaticFrame();
    });
    resizeObserver.observe(container);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      if (frameId !== null) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      handles.disposables.forEach(({ geometry, material }) => {
        geometry.dispose();
        material.dispose();
      });
      handles.envTexture.dispose();
      handles.renderer.dispose();
      container.removeChild(handles.renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className={`h-full w-full ${className ?? ''}`} />;
}
