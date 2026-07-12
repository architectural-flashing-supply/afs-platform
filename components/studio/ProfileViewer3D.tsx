'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface ProfileBend {
  leftLeg: number;
  rightLeg: number;
  angle: number;
  radius: number;
}

export interface ProfileViewer3DProps {
  bends: ProfileBend[];
  blankWidth: number;
  material: string;
  gauge: string;
  thicknessMm: number;
  profileName?: string;
  className?: string;
}

interface Point2D {
  x: number;
  y: number;
}

type CameraPreset = 'default' | 'top' | 'side' | 'end';

const EXTRUDE_DEPTH_MM = 304.8; // one linear foot
const DIM_LINE_OFFSET_MM = 15;
const INITIAL_CAMERA_POSITION = new THREE.Vector3(200, 150, 300);
const CAMERA_PRESETS: Record<CameraPreset, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  default: { position: INITIAL_CAMERA_POSITION.clone(), target: new THREE.Vector3(0, 0, 0) },
  top: { position: new THREE.Vector3(0, 400, 0.01), target: new THREE.Vector3(0, 0, 0) },
  side: { position: new THREE.Vector3(400, 0, 0), target: new THREE.Vector3(0, 0, 0) },
  end: { position: new THREE.Vector3(0, 0, 400), target: new THREE.Vector3(0, 0, 0) },
};

interface MaterialAppearance {
  color: string;
  metalness: number;
  roughness: number;
}

const MATERIAL_APPEARANCE: { test: RegExp; appearance: MaterialAppearance }[] = [
  { test: /galvani[sz]ed|galvalume/i, appearance: { color: '#B8C4CC', metalness: 0.8, roughness: 0.3 } },
  { test: /copper/i, appearance: { color: '#B87333', metalness: 0.9, roughness: 0.2 } },
  { test: /aluminu?m/i, appearance: { color: '#C0C0C0', metalness: 0.7, roughness: 0.35 } },
  { test: /stainless/i, appearance: { color: '#D4D4D4', metalness: 0.95, roughness: 0.15 } },
  { test: /zinc/i, appearance: { color: '#8B9BAE', metalness: 0.75, roughness: 0.4 } },
  { test: /kynar|painted/i, appearance: { color: '#8B9BAE', metalness: 0.3, roughness: 0.7 } },
  { test: /vintage/i, appearance: { color: '#7A6B5A', metalness: 0.4, roughness: 0.8 } },
];
const DEFAULT_APPEARANCE: MaterialAppearance = { color: '#B8C4CC', metalness: 0.8, roughness: 0.3 };

function getMaterialAppearance(material: string): MaterialAppearance {
  const match = MATERIAL_APPEARANCE.find((m) => m.test.test(material));
  return match ? match.appearance : DEFAULT_APPEARANCE;
}

function formatInches(value: number): string {
  const whole = Math.floor(value);
  const sixteenths = Math.round((value - whole) * 16);
  if (sixteenths === 0) return `${whole}"`;
  if (sixteenths === 16) return `${whole + 1}"`;
  const divisor = gcd(sixteenths, 16);
  const num = sixteenths / divisor;
  const den = 16 / divisor;
  return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
}
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function mmToIn(mm: number): number {
  return mm / 25.4;
}

/**
 * Same "turtle graphics" reconstruction used by FlashDraft's Load from
 * Library and the Command Center's BendSequenceDiagram: walk each leg,
 * turn by the supplementary bend angle, repeat. An approximation of the
 * true folded shape (no explicit direction/connectivity metadata exists
 * in a bend-sequence record), not an exact CAD trace.
 */
function buildProfilePoints(bends: ProfileBend[]): Point2D[] {
  const points: Point2D[] = [{ x: 0, y: 0 }];
  let heading = 0;
  let current: Point2D = { x: 0, y: 0 };
  for (const bend of bends) {
    const legLen = bend.leftLeg || 0;
    current = {
      x: current.x + Math.cos((heading * Math.PI) / 180) * legLen,
      y: current.y + Math.sin((heading * Math.PI) / 180) * legLen,
    };
    points.push(current);
    heading += 180 - (bend.angle || 180);
  }
  if (bends.length > 0) {
    const last = bends[bends.length - 1];
    const legLen = last.rightLeg || 0;
    current = {
      x: current.x + Math.cos((heading * Math.PI) / 180) * legLen,
      y: current.y + Math.sin((heading * Math.PI) / 180) * legLen,
    };
    points.push(current);
  }
  return points;
}

/**
 * Buffers a polyline into a thin closed ribbon (outer edge + inner edge)
 * representing the sheet-metal thickness, so ExtrudeGeometry produces a
 * realistic folded-metal solid rather than a solid filled wedge. Interior
 * vertices use an averaged (miter-ish) normal — a reasonable approximation
 * for a visual preview, not millimeter-precise CAD miter geometry.
 */
function buildRibbonOutline(points: Point2D[], thickness: number): Point2D[] {
  const half = thickness / 2;
  const outer: Point2D[] = [];
  const inner: Point2D[] = [];

  const segNormal = (a: Point2D, b: Point2D): Point2D => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  };

  for (let i = 0; i < points.length; i++) {
    let nx: number;
    let ny: number;
    if (i === 0) {
      const n = segNormal(points[0], points[1] ?? points[0]);
      nx = n.x;
      ny = n.y;
    } else if (i === points.length - 1) {
      const n = segNormal(points[i - 1], points[i]);
      nx = n.x;
      ny = n.y;
    } else {
      const n1 = segNormal(points[i - 1], points[i]);
      const n2 = segNormal(points[i], points[i + 1]);
      nx = n1.x + n2.x;
      ny = n1.y + n2.y;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
    }
    outer.push({ x: points[i].x + nx * half, y: points[i].y + ny * half });
    inner.push({ x: points[i].x - nx * half, y: points[i].y - ny * half });
  }

  return [...outer, ...inner.reverse()];
}

function bendAngleLabel(bend: ProfileBend): string {
  return `${Math.round(bend.angle)}°`;
}

export default function ProfileViewer3D({
  bends,
  blankWidth,
  material,
  gauge,
  thicknessMm,
  profileName,
  className,
}: ProfileViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const cameraAnimRef = useRef<{ from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; start: number } | null>(null);

  const [dimensionsOn, setDimensionsOn] = useState(true);
  const [hintVisible, setHintVisible] = useState(true);

  const animateCameraTo = useCallback((preset: CameraPreset) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const target = CAMERA_PRESETS[preset];
    cameraAnimRef.current = {
      from: camera.position.clone(),
      to: target.position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target.target.clone(),
      start: performance.now(),
    };
  }, []);

  // --- One-time scene setup ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1A1A1E');
    sceneRef.current = scene;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
    camera.position.copy(INITIAL_CAMERA_POSITION);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(5, 10, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.6);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 4;
    controlsRef.current = controls;

    const autoRotateTimer = setTimeout(() => {
      controls.autoRotate = false;
    }, 3000);
    const hintTimer = setTimeout(() => setHintVisible(false), 5000);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      const anim = cameraAnimRef.current;
      if (anim) {
        const elapsed = performance.now() - anim.start;
        const t = Math.min(1, elapsed / 500);
        const eased = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(anim.from, anim.to, eased);
        controls.target.lerpVectors(anim.fromTarget, anim.toTarget, eased);
        if (t >= 1) cameraAnimRef.current = null;
      }

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      clearTimeout(autoRotateTimer);
      clearTimeout(hintTimer);
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Rebuild geometry + annotations whenever the profile changes ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (meshGroupRef.current) {
      scene.remove(meshGroupRef.current);
      meshGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    if (labelGroupRef.current) {
      scene.remove(labelGroupRef.current);
    }

    const meshGroup = new THREE.Group();
    const labelGroup = new THREE.Group();

    const points = buildProfilePoints(bends);
    if (points.length >= 2) {
      const outline = buildRibbonOutline(points, thicknessMm || 0.6);
      const shape = new THREE.Shape();
      outline.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x, p.y);
        else shape.lineTo(p.x, p.y);
      });
      shape.closePath();

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: EXTRUDE_DEPTH_MM,
        bevelEnabled: true,
        bevelThickness: 0.5,
        bevelSize: 0.3,
        bevelSegments: 2,
        curveSegments: 8,
      });
      geometry.center();

      const appearance = getMaterialAppearance(material);
      const meshMaterial = new THREE.MeshStandardMaterial({
        color: appearance.color,
        metalness: appearance.metalness,
        roughness: appearance.roughness,
      });
      const mesh = new THREE.Mesh(geometry, meshMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshGroup.add(mesh);

      if (dimensionsOn) {
        const centerOffset = geometry.boundingBox
          ? new THREE.Vector3().addVectors(geometry.boundingBox.min, geometry.boundingBox.max).multiplyScalar(0.5)
          : new THREE.Vector3();
        // geometry.center() already recenters the mesh itself, but our 2D
        // `points` are still in original (un-centered) profile space — use
        // the same shift so labels land on the visible, centered mesh.
        const shiftX = -(Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2;
        const shiftY = -(Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2;

        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i];
          const b = points[i + 1];
          const midX = (a.x + b.x) / 2 + shiftX;
          const midY = (a.y + b.y) / 2 + shiftY;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(midX, midY, 0),
            new THREE.Vector3(midX + nx * DIM_LINE_OFFSET_MM, midY + ny * DIM_LINE_OFFSET_MM, 0),
          ]);
          const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xc0001a }));
          labelGroup.add(line);

          const div = document.createElement('div');
          div.className =
            'font-data text-[11px] text-afs-ink-900 bg-white px-0.5 py-0.5 border border-afs-chrome-dim rounded-sm text-center leading-tight';
          const legLenMm = Math.hypot(dx, dy);
          div.innerHTML = `${formatInches(mmToIn(legLenMm))}<br/><span style="font-size:9px;opacity:0.7">${legLenMm.toFixed(0)}mm</span>`;
          const label = new CSS2DObject(div);
          label.position.set(midX + nx * DIM_LINE_OFFSET_MM, midY + ny * DIM_LINE_OFFSET_MM, 0);
          labelGroup.add(label);
        }

        bends.forEach((bend, i) => {
          const vertex = points[i + 1];
          if (!vertex) return;
          const div = document.createElement('div');
          div.className = 'font-data text-[11px] font-bold text-afs-crimson bg-white px-0.5 py-0.5 border border-afs-crimson rounded-sm';
          div.textContent = bendAngleLabel(bend);
          const label = new CSS2DObject(div);
          label.position.set(vertex.x + shiftX, vertex.y + shiftY, EXTRUDE_DEPTH_MM / 2);
          labelGroup.add(label);
        });

        const blankDiv = document.createElement('div');
        blankDiv.className =
          'font-data text-[11px] text-afs-ink-900 bg-white px-0.5 py-0.5 border border-afs-chrome-dim rounded-sm text-center';
        blankDiv.innerHTML = `Blank Width: ${formatInches(mmToIn(blankWidth))} <span style="opacity:0.7">(${blankWidth.toFixed(0)}mm)</span>`;
        const blankLabel = new CSS2DObject(blankDiv);
        const minY = Math.min(...points.map((p) => p.y)) + shiftY;
        blankLabel.position.set(0, minY - DIM_LINE_OFFSET_MM * 2, EXTRUDE_DEPTH_MM / 2);
        labelGroup.add(blankLabel);
      }
    }

    scene.add(meshGroup);
    scene.add(labelGroup);
    meshGroupRef.current = meshGroup;
    labelGroupRef.current = labelGroup;
  }, [bends, blankWidth, material, thicknessMm, dimensionsOn]);

  return (
    <div className={`relative ${className ?? ''}`} style={{ minHeight: 500 }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
        <div className="flex gap-1 bg-afs-bg-raised/90 border border-afs-chrome-dim rounded p-1">
          <button
            type="button"
            onClick={() => animateCameraTo('default')}
            className="font-label text-xs px-2 py-1 rounded text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white transition-colors"
          >
            Reset View
          </button>
          <button
            type="button"
            onClick={() => animateCameraTo('top')}
            className="font-label text-xs px-2 py-1 rounded text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white transition-colors"
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => animateCameraTo('side')}
            className="font-label text-xs px-2 py-1 rounded text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white transition-colors"
          >
            Side
          </button>
          <button
            type="button"
            onClick={() => animateCameraTo('end')}
            className="font-label text-xs px-2 py-1 rounded text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white transition-colors"
          >
            End
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDimensionsOn((d) => !d)}
          className={`font-label text-xs px-3 py-1.5 rounded border transition-colors ${
            dimensionsOn
              ? 'bg-afs-crimson text-white border-afs-crimson'
              : 'bg-afs-bg-raised/90 text-afs-chrome-mid border-afs-chrome-dim hover:text-white'
          }`}
        >
          Dimensions {dimensionsOn ? 'On' : 'Off'}
        </button>
      </div>

      {/* Bottom-left info */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        <div className="bg-afs-bg-raised/90 border border-afs-chrome-dim rounded px-3 py-2">
          {profileName && <p className="font-heading text-sm text-afs-chrome-high">{profileName}</p>}
          <p className="font-data text-xs text-afs-chrome-mid">
            {material} · {gauge}
          </p>
        </div>
        <p
          className={`font-label text-xs text-afs-chrome-dim transition-opacity duration-700 ${
            hintVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Rotate • Zoom • Pan
        </p>
      </div>
    </div>
  );
}
