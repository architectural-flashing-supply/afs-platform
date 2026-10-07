'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * A short length of polished stainless flashing, turning slowly in its own
 * contained box at the right of the Products header.
 *
 * The cross-section replicates a real fabricated piece: a small return lip at
 * the top, a tall angled face, a stepped floor with two bends, and a short
 * return flange. It is built from thin boxes along the profile path and lit
 * with an image-based environment (RoomEnvironment) so the stainless reads as
 * mirror-polished. The box is its own element, so it never turns behind the
 * category buttons or the search field. Decoration only: hidden from assistive
 * tech, no interaction, one fixed pose under prefers-reduced-motion, and torn
 * down completely on unmount.
 */
// Profile path in inches (x right, y up).
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.75, 4.6],
  [0, 4.6],
  [1.6, 0.6],
  [3.4, 0.6],
  [4.0, 1.25],
  [5.6, 1.25],
  [5.9, 2.1],
];
const THICKNESS = 0.09;
const LENGTH = 5; // shorter than the real piece: roughly one profile-width
const TURN_SECONDS = 24;

export default function ProductsHeaderBackdrop() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // no WebGL: the box simply stays empty
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 1.5, 17);
    camera.lookAt(0, 0, 0);

    const xs = PROFILE.map((p) => p[0]);
    const ys = PROFILE.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xd7dce2,
      metalness: 1,
      roughness: 0.16,
      envMapIntensity: 1.25,
    });

    const group = new THREE.Group();
    const geoms: THREE.BufferGeometry[] = [];
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [ax, ay] = PROFILE[i];
      const [bx, by] = PROFILE[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      // Slight overshoot closes the corner at each bend.
      const g = new THREE.BoxGeometry(len + THICKNESS, THICKNESS, LENGTH);
      geoms.push(g);
      const m = new THREE.Mesh(g, mat);
      m.position.set((ax + bx) / 2 - cx, (ay + by) / 2 - cy, 0);
      m.rotation.z = Math.atan2(dy, dx);
      group.add(m);
    }
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
    let angle = -0.7;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 100);
      last = now;
      if (!reduced) angle += (2 * Math.PI * dt) / (TURN_SECONDS * 1000);
      group.rotation.y = angle;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      geoms.forEach((g) => g.dispose());
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
      className="pointer-events-none absolute right-4 top-8 hidden h-44 w-64 overflow-hidden rounded-lg border border-afs-chrome-mid bg-afs-navy-950 sm:block lg:right-6"
    />
  );
}
