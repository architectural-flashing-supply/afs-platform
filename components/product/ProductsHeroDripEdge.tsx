'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { previewShapeFor } from '@/lib/data/product-preview-shapes';

/**
 * A full-length stick of the real T Style Drip Edge, turning on a vertical
 * axis so its length swings toward the viewer and away: because it is long,
 * the perspective shows true depth.
 *
 * The cross-section is the product's own traced geometry (`previewShapeFor`),
 * plus its open end hem, swept 10 ft down the length and given real sheet
 * thickness with mitred bends. Lit with an image-based environment so
 * stainless reads as polished metal. Transparent canvas: no panel, no text.
 *
 * Motion: spins continuously, forever, with no controls. Reduced motion: static pose. Fully disposed on unmount.
 */
const PRODUCT_ID = 't-style-drip-edge';
const LENGTH_IN = 120; // a real 10 ft stick
const THICKNESS_IN = 0.07;
const TURN_SECONDS = 30;
const REST_ANGLE = -0.7;

type Pt = [number, number];

function buildProfile(): Pt[] | null {
  const shape = previewShapeFor(PRODUCT_ID);
  if (!shape) return null;
  // Work in the trace's own y-down space, flip to y-up at the end.
  const down: Pt[] = shape.points.map((p) => [p.x, p.y]);
  const hem = shape.hemEnd;
  if (hem && down.length >= 2) {
    const e = down[down.length - 1];
    const prev = down[down.length - 2];
    let dx = e[0] - prev[0];
    let dy = e[1] - prev[1];
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    // looking along travel toward the free end, right = (-ty, tx); 'left' is the opposite side
    const sign = hem.foldSide === 'left' ? -1 : 1;
    const lx = -dy * sign;
    const ly = dx * sign;
    const r = (hem.gapIn + THICKNESS_IN) / 2;
    const cx = e[0] + lx * r;
    const cy = e[1] + ly * r;
    for (let i = 1; i <= 8; i++) {
      const a = (Math.PI * i) / 8;
      down.push([cx + r * (-lx * Math.cos(a) + dx * Math.sin(a)), cy + r * (-ly * Math.cos(a) + dy * Math.sin(a))]);
    }
    const t = down[down.length - 1];
    down.push([t[0] - dx * hem.lengthIn, t[1] - dy * hem.lengthIn]);
  }
  return down.map((p) => [p[0], -p[1]] as Pt);
}
/** Closed ribbon (sheet metal with thickness) swept along z, mitred at bends. */
function ribbonGeometry(pts: ReadonlyArray<Pt>, t: number, len: number) {
  const n = pts.length;
  const dirs: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dy) || 1;
    dirs.push([dx / l, dy / l]);
  }
  const A: Pt[] = [];
  const B: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const n0 = i > 0 ? [-dirs[i - 1][1], dirs[i - 1][0]] : [-dirs[0][1], dirs[0][0]];
    const n1 = i < n - 1 ? [-dirs[i][1], dirs[i][0]] : n0;
    let mx = n0[0] + n1[0];
    let my = n0[1] + n1[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const k = Math.min(1 / Math.max(mx * n1[0] + my * n1[1], 0.35), 2.5);
    const off = (t / 2) * k;
    A.push([pts[i][0] + mx * off, pts[i][1] + my * off]);
    B.push([pts[i][0] - mx * off, pts[i][1] - my * off]);
  }
  const pos: number[] = [];
  const z0 = -len / 2;
  const z1 = len / 2;
  const quad = (p: number[], q: number[], r: number[], s: number[]) => {
    pos.push(...p, ...q, ...r, ...p, ...r, ...s);
  };
  for (let i = 0; i < n - 1; i++) {
    quad([A[i][0], A[i][1], z0], [A[i + 1][0], A[i + 1][1], z0], [A[i + 1][0], A[i + 1][1], z1], [A[i][0], A[i][1], z1]);
    quad([B[i][0], B[i][1], z0], [B[i + 1][0], B[i + 1][1], z0], [B[i + 1][0], B[i + 1][1], z1], [B[i][0], B[i][1], z1]);
    for (const z of [z0, z1]) {
      quad([A[i][0], A[i][1], z], [A[i + 1][0], A[i + 1][1], z], [B[i + 1][0], B[i + 1][1], z], [B[i][0], B[i][1], z]);
    }
  }
  for (const i of [0, n - 1]) {
    quad([A[i][0], A[i][1], z0], [B[i][0], B[i][1], z0], [B[i][0], B[i][1], z1], [A[i][0], A[i][1], z1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export default function ProductsHeroDripEdge() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const profile = buildProfile();
    if (!host || !profile) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // no WebGL: nothing is drawn
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 400);
    camera.position.set(0, 7, 72);
    camera.lookAt(0, 0, 0);

    const xs = profile.map((p) => p[0]);
    const ys = profile.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xe3e7ec,
      metalness: 1,
      roughness: 0.15,
      envMapIntensity: 1.35,
      side: THREE.DoubleSide,
    });
    const geom = ribbonGeometry(profile, THICKNESS_IN, LENGTH_IN);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(-cx, -cy, 0);
    const group = new THREE.Group();
    group.add(mesh);
    group.rotation.x = 0.28;
    scene.add(group);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = performance.now();
    let angle = REST_ANGLE;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 100);
      last = now;
      if (!reduced) angle += (2 * Math.PI * dt) / (TURN_SECONDS * 1000); // spins forever
      group.rotation.y = angle;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      geom.dispose();
      mat.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="absolute inset-y-0 right-0 hidden w-full pointer-events-none md:block md:w-[72%] lg:w-[62%]"
    />
  );
}
