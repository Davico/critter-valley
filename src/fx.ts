import * as THREE from 'three';
import { textSprite } from './world';
import { S } from './save';

const V3 = THREE.Vector3;
let scene: THREE.Scene;
export function setFxScene(s: THREE.Scene) { scene = s; }

export const hud = { hint: '', hintT: 0, prompt: '', card: null as null | { title: string; sub: string; gold: boolean; t: number }, treadXp: 0, onTread: false, shake: 0 };
export function hint(key: string, text: string, force = false) { if (!force && S.hints.includes(key)) return; if (!S.hints.includes(key)) S.hints.push(key); hud.hint = text; hud.hintT = 5; }
export function say(text: string, t = 2.6) { hud.hint = text; hud.hintT = t; }
export function card(title: string, sub: string, gold = false) { hud.card = { title, sub, gold, t: 3.8 }; }

interface Part { m: THREE.Mesh; v: THREE.Vector3; t: number; spin: number }
const parts: Part[] = [];
const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.05), sphGeo = new THREE.SphereGeometry(0.12, 6, 4);
export function burst(at: THREE.Vector3, colors: number[], n: number, speed = 5, up = 6, sphere = false) {
  for (let i = 0; i < n && parts.length < 260; i++) {
    const m = new THREE.Mesh(sphere ? sphGeo : partGeo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
    m.position.copy(at); scene.add(m);
    const a = Math.random() * Math.PI * 2, r = Math.random() * speed;
    parts.push({ m, v: new V3(Math.cos(a) * r, up * (0.4 + Math.random() * 0.8), Math.sin(a) * r), t: 0.8 + Math.random() * 0.6, spin: Math.random() * 10 });
  }
}
const floats: { s: THREE.Sprite; t: number }[] = [];
export function floatText(at: THREE.Vector3, text: string, color = '#ffe14a', scale = 0.8) { const s = textSprite(text, { size: 64, color, scale }); s.position.copy(at); scene.add(s); floats.push({ s, t: 1.3 }); }
const rings: { m: THREE.Mesh; t: number; max: number }[] = [];
export function shock(at: THREE.Vector3, max: number) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.copy(at).add(new V3(0, 0.15, 0)); scene.add(m); rings.push({ m, t: 0, max }); }

export function updateFx(dt: number) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t -= dt; p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt; (p.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, p.t * 2); if (p.t <= 0) { scene.remove(p.m); (p.m.material as THREE.Material).dispose(); parts.splice(i, 1); } }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t -= dt; f.s.position.y += dt * 1.4; f.s.material.opacity = Math.min(1, f.t * 2); if (f.t <= 0) { scene.remove(f.s); floats.splice(i, 1); } }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const s = 1 + r.t * r.max * 1.5; r.m.scale.set(s, s, s); (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - r.t * 1.4); if (r.t > 0.6) { scene.remove(r.m); rings.splice(i, 1); } }
  if (hud.hintT > 0) hud.hintT -= dt;
  if (hud.card) { hud.card.t -= dt; if (hud.card.t <= 0) hud.card = null; }
}
