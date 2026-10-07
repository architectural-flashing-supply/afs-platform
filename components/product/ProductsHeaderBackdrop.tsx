'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { previewShapeFor } from '@/lib/data/product-preview-shapes';

/**
 * A long length of flashing, rendered as a ghost behind the Products header.
 *
 * Quiet by design: a darker gunmetal grey (~34% opacity), set toward the right so it never turns behind the headline text, no interaction, no text, hidden
 * from assistive tech, and still under prefers-reduced-motion (one fixed pose).
 * The section is the Zee, drawn from its own traced rendering, so the backdrop
 * is a real AFS profile and not decoration that looks like a different product.
 *
 * It renders into a transparent canvas, so the page background shows through,
 * and is torn down completely on unmount (no leaked GL context).
 */
const PROFILE_ID = 'trims-zee';
const LENGTH = 26; // world units; the section is ~3 across, so this reads as "long"
const SECTION_SCALE = 1.1;
const TURN_SECONDS = 70;

export default function ProductsHeaderBackdrop() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const shape = previewShapeFor(PROFILE_ID);
    if (!host || !shape) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // no WebGL: the header simply has no backdrop
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    camera.position.set(0, 0, 30);

    const pts = shape.points;
    const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
    const cy = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
    const faceMat = new THREE.MeshBasicMaterial({
      color: 0x4a525c,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2f353d, transparent: true, opacity: 0.55 });

    const group = new THREE.Group();
    const geoms: THREE.BufferGeometry[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const ax = (a.x - cx) * SECTION_SCALE;
      const ay = -(a.y - cy) * SECTION_SCALE;
      const bx = (b.x - cx) * SECTION_SCALE;
      const by = -(b.y - cy) * SECTION_SCALE;
      const g = new THREE.BufferGeometry();
      const z0 = -LENGTH / 2;
      const z1 = LENGTH / 2;
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1], 3)
      );
      geoms.push(g);
      group.add(new THREE.Mesh(g, faceMat));
      const e = new THREE.EdgesGeometry(g);
      geoms.push(e);
      group.add(new THREE.LineSegments(e, lineMat));
    }
    group.rotation.x = 0.35;
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
    let angle = 0.9;
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
      faceMat.dispose();
      lineMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 -right-[6%] w-full sm:w-[52%]"
    />
  );
}
