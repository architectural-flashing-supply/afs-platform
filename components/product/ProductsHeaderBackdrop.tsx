'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * A short length of polished stainless flashing, turning slowly on the page
 * (no box) at the right of the Products header.
 *
 * Cross-section traced from Reid's photo of the real piece (inches, x right,
 * y up). Read from the photo, in order from the left:
 *   1. a rolled (closed) bead hem on the top edge of a tall back wall,
 *   2. the wall, leaning outward to the left,
 *   3. a sharp bend into a wide flat floor,
 *   4. a stiffening jog: the floor steps DOWN about a quarter inch,
 *   5. a short lower floor plane, and
 *   6. a short upturned flange on the right edge finished with a small bead.
 * The photo has no scale, so the absolute inch values are estimates taken from
 * proportions; the topology and relative proportions follow the photo.
 *
 * The strip is a closed ribbon with real sheet thickness and mitred bends,
 * lit by an image-based environment so stainless reads as mirror polish.
 * Decoration only: hidden from assistive tech, no interaction, one fixed pose
 * under prefers-reduced-motion, fully disposed on unmount.
 */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

const WALL_TOP: [number, number] = [-1.5, 6.5];
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  // rolled bead hem at the top of the wall (curls outward, then down)
  ...arc(WALL_TOP[0] - 0.22, WALL_TOP[1], 0.22, Math.PI * 1.15, 0, 9),
  [0, 0], // bend into the floor
  [2.65, 0], // end of the upper floor plane
  [3.15, -0.25], // jog down
  [4.95, -0.25], // lower floor plane
  // short upturned flange with a small bead (curls inward)
  [4.98, 0.3],
  ...arc(4.88, 0.3, 0.1, 0, Math.PI, 5),
];
const THICKNESS = 0.07;
const LENGTH = 5;
const TURN_SECONDS = 30; // matches PRODUCT_ROTATION_SECONDS in ProductProfilePreview3D

/** Closed ribbon (sheet metal with thickness) swept along z, mitred at bends. */
function ribbonGeometry(pts: ReadonlyArray<readonly [number, number]>, t: number, len: number) {
  const n = pts.length;
  const dirs: Array<[number, number]> = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dy) || 1;
    dirs.push([dx / l, dy / l]);
  }
  const A: Array<[number, number]> = [];
  const B: Array<[number, number]> = [];
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
    // end caps
    for (const z of [z0, z1]) {
      quad([A[i][0], A[i][1], z], [A[i + 1][0], A[i + 1][1], z], [B[i + 1][0], B[i + 1][1], z], [B[i][0], B[i][1], z]);
    }
  }
  // tip faces (the two raw ends of the strip)
  for (const i of [0, n - 1]) {
    quad([A[i][0], A[i][1], z0], [B[i][0], B[i][1], z0], [B[i][0], B[i][1], z1], [A[i][0], A[i][1], z1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export default function ProductsHeaderBackdrop() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // no WebGL: nothing is drawn
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 2.2, 21);
    camera.lookAt(0, 0, 0);

    const xs = PROFILE.map((p) => p[0]);
    const ys = PROFILE.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xdfe4ea,
      metalness: 1,
      roughness: 0.18,
      envMapIntensity: 1.3,
      side: THREE.DoubleSide,
    });
    const geom = ribbonGeometry(PROFILE, THICKNESS, LENGTH);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(-cx, -cy, 0);
    const group = new THREE.Group();
    group.add(mesh);
    group.rotation.x = 0.3;
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
    let angle = -0.75;
    // Same behaviour as the product 3D preview: ONE slow turn, then stop.
    // The viewer can then drag it to turn it by hand.
    let remaining = reduced ? 0 : 2 * Math.PI;
    let dragging = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      remaining = 0; // taking over by hand ends the automatic turn
      host.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      angle += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
    };
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 100);
      last = now;
      if (remaining > 0) {
        const step = Math.min(remaining, (2 * Math.PI * dt) / (TURN_SECONDS * 1000));
        angle += step;
        remaining -= step;
      }
      group.rotation.y = angle;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
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
      className="absolute right-0 top-0 hidden cursor-grab touch-pan-y active:cursor-grabbing h-[19rem] w-[22rem] md:block lg:right-6 lg:w-[30rem] xl:w-[34rem]"
    />
  );
}
