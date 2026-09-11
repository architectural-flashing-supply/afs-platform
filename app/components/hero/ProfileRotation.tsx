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

// ---------------------------------------------------------------------------
// REFERENCE MEASUREMENTS — public/images/hero-profile.png (hpc-002)
//
// Read via direct crops of the source PNG (PIL, see the hpc-002 build session
// for the crop commands): the cut end (near end of the piece, the clearest
// place to read the true cross-section) shows a 5-leg / 4-bend profile, not
// the previous file's invented 2-bend Z-shape:
//
//   Leg 1 — main pan (left, brightest face in the photo)........ 0.38 of W
//   Leg 2 — short leg folding INTO a shallow stiffening rib...... 0.08 of W
//   Leg 3 — short leg folding back OUT of the rib................ 0.08 of W
//   Leg 4 — second main pan (narrower, shadowed face)............ 0.30 of W
//   Leg 5 — standing edge flange, folded up ~100 degrees......... 0.16 of W
//                                                          total = 1.00 (W)
//
// Bend directions (turtle-walk turn at each of the 4 interior vertices,
// degrees): -20, +40, -55, +100. Net heading change from leg 1 to leg 4 is
// -35 degrees — a real dihedral fold between the two main pans (this is
// what reads as the photo's two distinctly lit faces), with the first two
// turns (-20, +40) riding on top of that fold as a shallow local zigzag —
// the stiffening rib visible in the photo as two closely-spaced parallel
// crease lines. The fourth turn (+100) is a sharper fold standing the far
// edge up into a narrow flange. No hem: the point the piece appears to
// taper to at the top of the
// photo is the two long edges of a constant-width profile converging in
// perspective as the piece recedes from the camera (it is shot end-on at a
// steep angle) — not a folded/hemmed leg. The model reproduces that same
// effect with camera perspective + a static tilt (see ROTATION_X_TILT/
// ROTATION_Z_TILT below) rather than by adding geometry that isn't there.
//
// Finish: bare galvanized/galvalume steel (mill scratches, cool blue-gray
// specular highlights, no flat painted color). Sampled directly from a
// pure-metal crop of the photo (x:150-750, y:500-1000, avoiding the baked-in
// transparency-checkerboard background pixels that surround the piece) —
// median RGB (150, 160, 175), i.e. #96A0AF — see BASE_METAL_COLOR below.
// ---------------------------------------------------------------------------

const LEG_RATIOS = [0.38, 0.08, 0.08, 0.3, 0.16] as const; // sums to 1.0 of DEVELOPED_WIDTH
const TURN_ANGLES_DEG = [-20, 40, -55, 100] as const; // one per interior vertex (LEG_RATIOS.length - 1)

const DEVELOPED_WIDTH = 2.8; // arbitrary model scale — matches the previous file's overall size so HeroSection's framing needs no change
const SHORTEST_LEG = Math.min(...LEG_RATIOS) * DEVELOPED_WIDTH;
// 24-gauge sheet is ~0.024in in reality — thin relative to any leg. Reid's
// complaint was literally "flashing is not a quarter inch thick", so this is
// set as thin as the spec allows: 0.6% of developed width, capped at 1/40 of
// the shortest leg (the rib legs), whichever is smaller.
const THICKNESS = Math.min(0.006 * DEVELOPED_WIDTH, SHORTEST_LEG / 40);
const BEND_RADIUS = THICKNESS * 1.5;
const EXTRUDE_DEPTH = DEVELOPED_WIDTH * 8;

// mirrors afs-crimson (DESIGN_TOKENS.md #C0001A) — a WebGL material color
// can't consume Tailwind classes or CSS custom properties, same documented
// exception as ProfileViewer3D/CANVAS_COLORS (DESIGN_TOKENS.md §10).
const AFS_CRIMSON = '#C0001A';
// Sampled median color from the reference photo's bare metal (see comment
// block above) — bare galvanized/galvalume steel, not a painted Kynar finish.
const BASE_METAL_COLOR = '#8D97A5';

const LOOP_SECONDS = 28;
const REVOLUTION_SECONDS = 14; // one full 360 degree turn — ~25.7 deg/sec, constant, never exceeded
const UNFOLD_START = 12;
const UNFOLD_END = 16;
const BEND_LINES_END = 18;
const BEND_FADE_OUT_END = 18.5;
const REFOLD_END = 20;
const BEND_COUNT = TURN_ANGLES_DEG.length;

// A static tilt (not animated) so the extrusion length axis recedes away
// from the camera at every point in the y-axis spin, echoing how the
// reference photo was shot end-on at a steep angle — this is what makes the
// far end read as "real length" via foreshortening rather than a short
// stub facing the camera flat-on.
const ROTATION_X_TILT = THREE.MathUtils.degToRad(14);
// 12 degrees rhymes with the site's Metal Edge skew (DESIGN_TOKENS.md's
// signature diagonal-cut motif) — a deliberate echo of the brand's one
// recurring geometric idea, not an arbitrary number.
const ROTATION_Z_TILT = THREE.MathUtils.degToRad(-12);
// The camera looks straight down world -Z, which is also the extrusion
// (length) axis before any y-rotation — at rotation.y = 0 the piece would
// point directly at the camera and read as a thin edge-on sliver. This base
// offset is added to the animated spin so the rest pose (t=0, where
// computeRotationY(t) is ~0) instead shows a three-quarter view with both
// the cross-section and the length's foreshortening visible, matching how
// the reference photo itself is framed.
const BASE_ROTATION_Y = THREE.MathUtils.degToRad(55);
const STATIC_ROTATION_Y = BASE_ROTATION_Y;

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

// Rounds each interior vertex of a sharp polyline into a short circular arc
// (4-6 points) of the given radius, tangent to both adjacent legs — bends
// read as radiused folds instead of knife-edge miters.
function filletPolyline(vertices: Point2D[], radius: number, arcPoints = 5): Point2D[] {
  if (radius <= 0 || vertices.length < 3) return vertices;
  const result: Point2D[] = [vertices[0]];
  for (let i = 1; i < vertices.length - 1; i++) {
    const prev = vertices[i - 1];
    const curr = vertices[i];
    const next = vertices[i + 1];
    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y);
    const lenNext = Math.hypot(toNext.x, toNext.y);
    if (lenPrev < 1e-6 || lenNext < 1e-6) {
      result.push(curr);
      continue;
    }
    const dirPrev = { x: toPrev.x / lenPrev, y: toPrev.y / lenPrev };
    const dirNext = { x: toNext.x / lenNext, y: toNext.y / lenNext };
    const dot = Math.min(1, Math.max(-1, dirPrev.x * dirNext.x + dirPrev.y * dirNext.y));
    const angleBetween = Math.acos(dot);
    if (angleBetween > Math.PI - 1e-4 || angleBetween < 1e-4) {
      result.push(curr);
      continue;
    }
    const half = angleBetween / 2;
    const maxTangent = Math.min(lenPrev, lenNext) * 0.49;
    const tangentLen = Math.min(radius / Math.tan(half), maxTangent);
    const actualRadius = tangentLen * Math.tan(half);
    const p1 = { x: curr.x + dirPrev.x * tangentLen, y: curr.y + dirPrev.y * tangentLen };
    const p2 = { x: curr.x + dirNext.x * tangentLen, y: curr.y + dirNext.y * tangentLen };
    const bis = { x: dirPrev.x + dirNext.x, y: dirPrev.y + dirNext.y };
    const bisLen = Math.hypot(bis.x, bis.y) || 1;
    const bisUnit = { x: bis.x / bisLen, y: bis.y / bisLen };
    const centerDist = actualRadius / Math.sin(half);
    const center = { x: curr.x + bisUnit.x * centerDist, y: curr.y + bisUnit.y * centerDist };
    const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
    const a2raw = Math.atan2(p2.y - center.y, p2.x - center.x);
    let delta = a2raw - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    result.push(p1);
    for (let s = 1; s < arcPoints - 1; s++) {
      const a = a1 + (delta * s) / (arcPoints - 1);
      result.push({ x: center.x + Math.cos(a) * actualRadius, y: center.y + Math.sin(a) * actualRadius });
    }
    result.push(p2);
  }
  result.push(vertices[vertices.length - 1]);
  return result;
}

// The folded (as-fabricated) centerline, walked leg-by-leg from the
// measurements above — sharp vertices, filleted later at render time.
function buildFoldedVertices(): Point2D[] {
  let x = 0;
  let y = 0;
  let heading = 0;
  const points: Point2D[] = [{ x, y }];
  const legLengths = LEG_RATIOS.map((r) => r * DEVELOPED_WIDTH);
  for (let i = 0; i < legLengths.length; i++) {
    x += Math.cos(heading) * legLengths[i];
    y += Math.sin(heading) * legLengths[i];
    points.push({ x, y });
    if (i < TURN_ANGLES_DEG.length) {
      heading += THREE.MathUtils.degToRad(TURN_ANGLES_DEG[i]);
    }
  }
  return points;
}

// The developed (flattened) blank — the same vertices laid out along a
// straight line at their true cumulative arc length, y = 0. This is what
// the 12-16s "shop drawing" unfold interpolates toward.
function buildFlatVertices(folded: Point2D[]): Point2D[] {
  let cumulative = 0;
  const flat: Point2D[] = [{ x: 0, y: 0 }];
  for (let i = 1; i < folded.length; i++) {
    cumulative += Math.hypot(folded[i].x - folded[i - 1].x, folded[i].y - folded[i - 1].y);
    flat.push({ x: cumulative, y: 0 });
  }
  return flat;
}

function lerpVertices(a: Point2D[], b: Point2D[], t: number): Point2D[] {
  return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));
}

// One revolution every REVOLUTION_SECONDS at a constant rate — trivially
// satisfies "nothing moves faster than that at any point", and since
// LOOP_SECONDS (28) is an exact multiple of REVOLUTION_SECONDS (14) the
// rotation lands back on its start angle with no jump at the loop point,
// continuing through the unfold/refold window rather than pausing for it.
function computeRotationY(t: number): number {
  return (t / REVOLUTION_SECONDS) * Math.PI * 2;
}

function computeUnfoldProgress(t: number): number {
  if (t < UNFOLD_START) return 0;
  if (t < UNFOLD_END) return easeInOutCubic((t - UNFOLD_START) / (UNFOLD_END - UNFOLD_START));
  if (t < BEND_LINES_END) return 1;
  if (t < REFOLD_END) return 1 - easeInOutCubic((t - BEND_LINES_END) / (REFOLD_END - BEND_LINES_END));
  return 0;
}

// Bend lines draw in one at a time across the 16-18s window (one per bend,
// staggered into equal slots), hold at full opacity until the refold begins
// at 18s, then fade out over the first half-second of the refold.
function computeBendOpacity(t: number, bendIndex: number): number {
  const slotWidth = (BEND_LINES_END - UNFOLD_END) / BEND_COUNT;
  const slotStart = UNFOLD_END + bendIndex * slotWidth;
  const slotEnd = slotStart + slotWidth;
  if (t < slotStart) return 0;
  if (t < slotEnd) return easeInOutCubic((t - slotStart) / slotWidth);
  if (t < BEND_LINES_END) return 1;
  if (t < BEND_FADE_OUT_END) return 1 - easeInOutCubic((t - BEND_LINES_END) / (BEND_FADE_OUT_END - BEND_LINES_END));
  return 0;
}

interface ProfileGeometryResult {
  geometry: THREE.ExtrudeGeometry;
  centerShift: THREE.Vector3;
}

function buildProfileGeometry(sharpVertices: Point2D[]): ProfileGeometryResult {
  const centerline = filletPolyline(sharpVertices, BEND_RADIUS);
  const outer = offsetPolyline(centerline, THICKNESS / 2);
  const inner = offsetPolyline(centerline, -THICKNESS / 2).slice().reverse();
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
    bevelEnabled: false,
    curveSegments: 1, // outline is already pre-sampled (straight legs + fillet arcs) — no extra curve subdivision needed
  });
  geometry.translate(centerShift.x, centerShift.y, centerShift.z);
  geometry.computeVertexNormals();

  return { geometry, centerShift };
}

// Procedural brushed-metal look: fine lengthwise streak noise used as both a
// roughness map (micro variation in the specular response) and a subtle
// normal map (small per-pixel jitter around a flat (128,128,255) base) — no
// external image, generated entirely in code per the anisotropic-brush
// requirement. A fixed seed keeps the look stable across remounts.
function createBrushedMetalMaps(): { roughnessMap: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const size = 256;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d') as CanvasRenderingContext2D;
  const roughImage = rctx.createImageData(size, size);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d') as CanvasRenderingContext2D;
  const normalImage = nctx.createImageData(size, size);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let y = 0; y < size; y++) {
    const rowJitter = rand();
    for (let x = 0; x < size; x++) {
      const streak = Math.sin(y * 0.9 + rowJitter * 40) * 0.5 + 0.5;
      const fine = rand() * 0.25;
      const v = Math.min(1, Math.max(0, streak * 0.5 + fine + 0.25));
      const idx = (y * size + x) * 4;
      const gray = Math.round(v * 255);
      roughImage.data[idx] = gray;
      roughImage.data[idx + 1] = gray;
      roughImage.data[idx + 2] = gray;
      roughImage.data[idx + 3] = 255;
      normalImage.data[idx] = 128 + Math.round((v - 0.5) * 20);
      normalImage.data[idx + 1] = 128;
      normalImage.data[idx + 2] = 255;
      normalImage.data[idx + 3] = 255;
    }
  }
  rctx.putImageData(roughImage, 0, 0);
  nctx.putImageData(normalImage, 0, 0);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 30);
  normalMap.repeat.set(2, 30);
  return { roughnessMap, normalMap };
}

interface BendLine {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshGroup: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  bendLines: BendLine[];
  envTexture: THREE.Texture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  foldedVertices: Point2D[];
  flatVertices: Point2D[];
  lastProgress: number;
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

  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
  camera.position.set(0, 1.1, 14);
  camera.lookAt(0, 0, 0);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(3, 5, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.radius = 6;
  keyLight.shadow.camera.left = -6;
  keyLight.shadow.camera.right = 6;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -6;
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // Rim light — separate from keyLight/ambient, positioned opposite the key
  // light so edges catch a cool highlight as the piece rotates through it.
  const rimLight = new THREE.DirectionalLight(0xdfe6f2, 0.6);
  rimLight.position.set(-5, 2, -6);
  scene.add(rimLight);

  const disposables: SceneHandles['disposables'] = [];

  const { roughnessMap, normalMap } = createBrushedMetalMaps();
  const material = new THREE.MeshPhysicalMaterial({
    color: BASE_METAL_COLOR,
    metalness: 0.9,
    roughness: 0.42,
    roughnessMap,
    normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    clearcoat: 0.1,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.55,
  });
  const foldedVertices = buildFoldedVertices();
  const flatVertices = buildFlatVertices(foldedVertices);
  const { geometry } = buildProfileGeometry(foldedVertices);
  disposables.push({ geometry, material });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const meshGroup = new THREE.Group();
  meshGroup.rotation.x = ROTATION_X_TILT;
  meshGroup.rotation.z = ROTATION_Z_TILT;
  meshGroup.add(mesh);

  const shadowGeometry = new THREE.PlaneGeometry(30, 30);
  const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.28 });
  disposables.push({ geometry: shadowGeometry, material: shadowMaterial });
  const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -2.2;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // Bend-line indicator bars, pinned to the flat (developed-blank) bend
  // positions — valid for the 16-18.5s window in which the geometry is at
  // or fading out of its fully flat pose (see computeBendOpacity).
  const { centerShift: flatCenterShift } = buildProfileGeometry(flatVertices);
  const bendLines: BendLine[] = [];
  for (let i = 1; i < flatVertices.length - 1; i++) {
    const v = flatVertices[i];
    const barGeometry = new THREE.BoxGeometry(0.05, 0.05, EXTRUDE_DEPTH * 0.96);
    const barMaterial = new THREE.MeshBasicMaterial({ color: AFS_CRIMSON, transparent: true, opacity: 0 });
    disposables.push({ geometry: barGeometry, material: barMaterial });
    const bar = new THREE.Mesh(barGeometry, barMaterial);
    bar.position.set(v.x + flatCenterShift.x, v.y + flatCenterShift.y, 0);
    meshGroup.add(bar);
    bendLines.push({ mesh: bar, material: barMaterial });
  }

  scene.add(meshGroup);

  return {
    renderer,
    scene,
    camera,
    meshGroup,
    mesh,
    material,
    bendLines,
    envTexture,
    roughnessMap,
    normalMap,
    foldedVertices,
    flatVertices,
    lastProgress: 0,
    disposables,
  };
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
    let currentGeometry = handles.mesh.geometry as THREE.ExtrudeGeometry;

    const applyProgress = (progress: number) => {
      if (Math.abs(progress - handles.lastProgress) < 1e-4 && handles.lastProgress !== -1) return;
      const interpolated = lerpVertices(handles.foldedVertices, handles.flatVertices, progress);
      const { geometry } = buildProfileGeometry(interpolated);
      handles.mesh.geometry = geometry;
      currentGeometry.dispose();
      currentGeometry = geometry;
      handles.lastProgress = progress;
    };

    let frameId: number | null = null;
    let startTime: number | null = null;

    const renderStaticFrame = () => {
      applyProgress(0);
      handles.meshGroup.rotation.y = STATIC_ROTATION_Y;
      handles.bendLines.forEach(({ material }) => {
        material.opacity = 0;
      });
      handles.renderer.render(handles.scene, handles.camera);
    };

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      if (startTime === null) startTime = now;
      const t = ((now - startTime) / 1000) % LOOP_SECONDS;

      handles.meshGroup.rotation.y = BASE_ROTATION_Y + computeRotationY(t);
      applyProgress(computeUnfoldProgress(t));

      handles.bendLines.forEach(({ material }, i) => {
        material.opacity = computeBendOpacity(t, i);
      });

      handles.renderer.render(handles.scene, handles.camera);
    };

    const startLoop = () => {
      if (frameId !== null) return;
      startTime = null;
      handles.lastProgress = -1;
      frameId = requestAnimationFrame(animate);
    };

    const stopLoopStatic = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      handles.lastProgress = -1;
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
      currentGeometry.dispose();
      handles.disposables.forEach(({ geometry, material }) => {
        if (geometry !== currentGeometry) geometry.dispose();
        material.dispose();
      });
      handles.roughnessMap.dispose();
      handles.normalMap.dispose();
      handles.envTexture.dispose();
      handles.renderer.dispose();
      container.removeChild(handles.renderer.domElement);
    };
  }, []);

  // Decorative — the same "SHOW US THE DETAIL. WE'LL FORM IT." message the
  // hero H1/copy already conveys in text, so hidden from assistive tech
  // rather than given a redundant label (same treatment as the hero/
  // shop-floor background videos' aria-hidden attribute).
  return <div ref={containerRef} aria-hidden="true" className={`h-full w-full ${className ?? ''}`} />;
}
