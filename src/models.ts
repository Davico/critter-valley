import * as THREE from 'three';
import { mesh, toon, textSprite } from './world';

const sph = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
function eyes(g: THREE.Group, y: number, z: number, sep: number, r: number) {
  for (const s of [-1, 1]) {
    const w = mesh(sph(r, 12, 10), toon(0xffffff), false); w.position.set(s * sep, y, z); g.add(w);
    const p = mesh(sph(r * 0.55, 10, 8), toon(0x1d1d1d), false); p.position.set(s * sep, y, z + r * 0.6); g.add(p);
    const sh = mesh(sph(r * 0.18, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), false); sh.position.set(s * sep + r * 0.15, y + r * 0.2, z + r * 0.95); g.add(sh);
  }
}

// ---------------- hero: a little armadillo that can curl into a ball ----------------
export interface HeroMesh { root: THREE.Group; walk: THREE.Group; ball: THREE.Group; spin: THREE.Group; legs: THREE.Mesh[]; hold: THREE.Object3D }
export function makeHero(): HeroMesh {
  const root = new THREE.Group(), walk = new THREE.Group(), ball = new THREE.Group();
  const shell = toon(0xc98a4f), skin = toon(0xf0c48e), band = toon(0x9a6232);
  const body = mesh(sph(0.55), shell); body.scale.set(1, 0.9, 1.15); body.position.y = 0.75; walk.add(body);
  for (const z of [-0.32, 0, 0.32]) { const b = mesh(new THREE.TorusGeometry(0.53, 0.05, 6, 20, Math.PI), band, false); b.position.set(0, 0.75, z); b.scale.set(1.04, 0.92, 1); walk.add(b); }
  const belly = mesh(sph(0.42), skin); belly.scale.set(0.9, 0.7, 1); belly.position.set(0, 0.55, 0.12); walk.add(belly);
  const head = new THREE.Group(); head.position.set(0, 1.05, 0.62); walk.add(head);
  const hd = mesh(sph(0.32), skin); hd.scale.set(1, 0.95, 1.05); head.add(hd);
  const snout = mesh(new THREE.ConeGeometry(0.16, 0.45, 12), skin); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.06, 0.38); head.add(snout);
  const nose = mesh(sph(0.07), toon(0x5a3418), false); nose.position.set(0, -0.06, 0.6); head.add(nose);
  for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.1, 0.3, 8), skin); e.position.set(s * 0.2, 0.3, -0.05); e.rotation.z = -s * 0.4; head.add(e); }
  eyes(head, 0.08, 0.22, 0.13, 0.085);
  const mask = mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 16), toon(0x2b2b38), false); mask.scale.set(1.5, 0.55, 1); mask.position.set(0, 0.08, 0.24); head.add(mask);
  const tail = mesh(new THREE.ConeGeometry(0.1, 0.5, 8), shell); tail.rotation.x = -Math.PI / 2 - 0.4; tail.position.set(0, 0.6, -0.75); walk.add(tail);
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]]) { const l = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.4, 8), skin); l.position.set(x, 0.2, z); walk.add(l); legs.push(l); }
  const hold = new THREE.Object3D(); hold.position.set(0, 1.85, 0.1); walk.add(hold);
  // ball form: the shell spins, the little face peeks out in front and stays upright
  const spin = new THREE.Group(); spin.position.y = 0.72; ball.add(spin);
  spin.add(mesh(sph(0.64, 22, 16), shell));
  for (let i = 0; i < 4; i++) { const r = mesh(new THREE.TorusGeometry(0.64, 0.055, 6, 26), band, false); r.rotation.y = Math.PI / 2; r.rotation.x = (i * Math.PI) / 4; spin.add(r); }
  const peek = new THREE.Group(); peek.position.set(0, 0.78, 0.5); ball.add(peek);
  const ph = mesh(sph(0.22), skin); ph.scale.set(1, 0.9, 0.8); peek.add(ph);
  const ps = mesh(new THREE.ConeGeometry(0.1, 0.26, 10), skin); ps.rotation.x = Math.PI / 2; ps.position.set(0, -0.04, 0.24); peek.add(ps);
  eyes(peek, 0.06, 0.13, 0.09, 0.06);
  const pm = mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 14), toon(0x2b2b38), false); pm.scale.set(1.5, 0.55, 1); pm.position.set(0, 0.06, 0.15); peek.add(pm);
  ball.visible = false;
  root.add(walk, ball);
  return { root, walk, ball, spin, legs, hold };
}

// ---------------- hen guardian ----------------
export interface HenMesh { root: THREE.Group; wings: THREE.Mesh[]; head: THREE.Group; brows: THREE.Mesh[]; legs: THREE.Mesh[]; bang: THREE.Sprite }
export function makeHen(size: number, color: number): HenMesh {
  const root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(size); root.add(g);
  const bodyM = toon(color);
  const body = mesh(sph(0.6), bodyM); body.scale.set(0.95, 0.85, 1.1); body.position.y = 0.95; g.add(body);
  const tail = mesh(new THREE.ConeGeometry(0.3, 0.6, 8), bodyM); tail.position.set(0, 1.25, -0.6); tail.rotation.x = -0.9; g.add(tail);
  const head = new THREE.Group(); head.position.set(0, 1.6, 0.45); g.add(head);
  head.add(mesh(sph(0.33), bodyM));
  for (const [x, y, r] of [[0, 0.36, 0.1], [0, 0.3, 0.12], [0, 0.28, 0.09]]) { const c = mesh(sph(r, 8, 6), toon(0xe63946), false); c.position.set(x, y, 0.05 - r); head.add(c); }
  const comb2 = mesh(sph(0.11, 8, 6), toon(0xe63946), false); comb2.position.set(0, 0.36, -0.12); head.add(comb2);
  const beak = mesh(new THREE.ConeGeometry(0.1, 0.28, 8), toon(0xffa62b)); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.38); head.add(beak);
  const wat = mesh(sph(0.07, 8, 6), toon(0xe63946), false); wat.position.set(0, -0.16, 0.3); head.add(wat);
  eyes(head, 0.1, 0.24, 0.13, 0.08);
  const brows: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), toon(0x222222), false); b.position.set(s * 0.13, 0.22, 0.3); b.rotation.z = s * 0.45; b.visible = false; head.add(b); brows.push(b); }
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const w = mesh(sph(0.42), bodyM); w.scale.set(0.25, 0.65, 0.95); w.position.set(s * 0.55, 1.0, -0.05); g.add(w); wings.push(w); }
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const l = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), toon(0xffa62b)); l.position.set(s * 0.22, 0.25, 0.05); g.add(l); legs.push(l); const f = mesh(new THREE.BoxGeometry(0.2, 0.04, 0.25), toon(0xffa62b), false); f.position.set(0, -0.25, 0.08); l.add(f); }
  const bang = textSprite('!', { size: 90, color: '#ff3b3b', scale: 0.9 }); bang.position.set(0, 2.5 * size, 0); bang.visible = false; root.add(bang);
  return { root, wings, head, brows, legs, bang };
}

// ---------------- eggs ----------------
const eggGeo = (() => { const pts: THREE.Vector2[] = []; for (let i = 0; i <= 20; i++) { const t = i / 20, a = t * Math.PI; pts.push(new THREE.Vector2(Math.sin(a) * (0.5 + 0.12 * Math.cos(a)) * 0.78, -Math.cos(a) * 0.62)); } return new THREE.LatheGeometry(pts, 20); })();
export const EGG_R = { s: 0.38, m: 0.6, b: 1.25 };
export function makeEgg(kind: 's' | 'm' | 'b', gold: boolean): THREE.Group {
  const g = new THREE.Group(), sc = EGG_R[kind] / 0.5;
  const shellCol = gold ? 0xffcf33 : kind === 's' ? 0xfff6dc : kind === 'm' ? 0xd8f0ff : 0xffe1ef;
  const mat = gold ? new THREE.MeshStandardMaterial({ color: shellCol, metalness: 0.6, roughness: 0.25, emissive: 0x6b4a00, emissiveIntensity: 0.4 }) : toon(shellCol);
  const e = mesh(eggGeo, mat); e.scale.setScalar(sc); e.position.y = 0.62 * sc; g.add(e);
  const spot = kind === 's' ? 0xffa0b8 : kind === 'm' ? 0x3d9dff : 0xb46bff;
  for (let i = 0; i < 7; i++) { const a = i * 2.4, y = 0.3 + (i % 3) * 0.28; const r = Math.sin(Math.acos((y - 0.62) / 0.62 * 0.9)) * 0.42; const s = mesh(sph(0.07 + (i % 2) * 0.03, 8, 6), toon(gold ? 0xfff3b0 : spot), false); s.position.set(Math.cos(a) * r * sc, y * sc, Math.sin(a) * r * sc); g.add(s); }
  return g;
}

// ---------------- pets ----------------
export type PetType = 'chick' | 'bunny' | 'turtle' | 'fox';
export function makePet(type: PetType, gold: boolean): THREE.Group {
  const g = new THREE.Group();
  const col = gold ? 0xffcf33 : { chick: 0xffde4a, bunny: 0xfafafa, turtle: 0x7ed957, fox: 0xff8a3d }[type];
  const m = gold ? new THREE.MeshStandardMaterial({ color: col, metalness: 0.55, roughness: 0.3, emissive: 0x5a3d00, emissiveIntensity: 0.35 }) : toon(col);
  if (type === 'turtle') {
    const shell = mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold ? m : toon(0x3f9a4a)); shell.position.y = 0.25; g.add(shell);
    for (let i = 0; i < 5; i++) { const p = mesh(new THREE.CircleGeometry(0.12, 6), toon(gold ? 0xfff0a0 : 0x2f7a38), false); const a = i * 1.26; p.position.set(Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3); p.lookAt(p.position.clone().multiplyScalar(3)); g.add(p); }
    const head = mesh(sph(0.2), m); head.position.set(0, 0.35, 0.55); g.add(head);
    eyes(head as unknown as THREE.Group, 0.06, 0.14, 0.08, 0.06);
    for (const [x, z] of [[-0.3, 0.25], [0.3, 0.25], [-0.3, -0.25], [0.3, -0.25]]) { const l = mesh(sph(0.12), m); l.position.set(x, 0.12, z); g.add(l); }
  } else {
    const body = mesh(sph(0.42), m); body.position.y = 0.45; body.scale.set(1, 0.95, type === 'fox' ? 1.2 : 1); g.add(body);
    const head = new THREE.Group(); head.position.set(0, 0.85, type === 'fox' ? 0.3 : 0.1); g.add(head);
    head.add(mesh(sph(type === 'chick' ? 0.001 : 0.3), m));
    if (type === 'chick') { head.position.set(0, 0.55, 0.1); const b = mesh(new THREE.ConeGeometry(0.08, 0.2, 8), toon(0xff8c1a)); b.rotation.x = Math.PI / 2; b.position.set(0, 0, 0.45); head.add(b); eyes(head, 0.12, 0.32, 0.14, 0.08);
      for (const s of [-1, 1]) { const w = mesh(sph(0.18), m); w.scale.set(0.3, 0.6, 0.8); w.position.set(s * 0.42, 0.45, 0); g.add(w); }
      const tuft = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), m); tuft.position.set(0, 0.93, 0.05); g.add(tuft); }
    if (type === 'bunny') { eyes(head, 0.05, 0.24, 0.12, 0.07); for (const s of [-1, 1]) { const e = mesh(sph(0.1), m); e.scale.set(0.6, 2.6, 0.5); e.position.set(s * 0.13, 0.45, -0.05); e.rotation.z = -s * 0.15; head.add(e); const ins = mesh(sph(0.06), toon(0xffa6c9), false); ins.scale.set(0.5, 3.2, 0.3); ins.position.set(s * 0.13, 0.45, 0); head.add(ins); }
      const n = mesh(sph(0.05), toon(0xff7aa8), false); n.position.set(0, -0.03, 0.3); head.add(n); const tl = mesh(sph(0.13), m); tl.position.set(0, 0.4, -0.42); g.add(tl); }
    if (type === 'fox') { eyes(head, 0.06, 0.22, 0.12, 0.07); const sn = mesh(new THREE.ConeGeometry(0.13, 0.3, 10), toon(gold ? 0xfff0a0 : 0xffffff)); sn.rotation.x = Math.PI / 2; sn.position.set(0, -0.08, 0.32); head.add(sn); const no = mesh(sph(0.05), toon(0x222222), false); no.position.set(0, -0.08, 0.48); head.add(no);
      for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.12, 0.3, 4), m); e.position.set(s * 0.17, 0.3, -0.02); head.add(e); }
      const tl = mesh(new THREE.ConeGeometry(0.18, 0.7, 10), m); tl.rotation.x = -Math.PI / 2 - 0.5; tl.position.set(0, 0.6, -0.65); g.add(tl); const tip = mesh(sph(0.1), toon(0xffffff)); tip.position.set(0, 0.78, -0.95); g.add(tip); }
    for (const s of [-1, 1]) { const l = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 6), type === 'chick' ? toon(0xff8c1a) : m); l.position.set(s * 0.18, 0.08, 0.05); g.add(l); }
  }
  if (gold) { const sp = textSprite('✦', { size: 80, color: '#fff7b0', scale: 0.5 }); sp.position.set(0.4, 1.2, 0); g.add(sp); }
  return g;
}

// ---------------- props ----------------
export function makeCart(): { root: THREE.Group; wheels: THREE.Mesh[]; seat: THREE.Object3D } {
  const root = new THREE.Group(), wood = toon(0xc98a4f), dark = toon(0x7a4a26);
  const base = mesh(new THREE.BoxGeometry(2.2, 0.2, 3), wood); base.position.y = 0.7; root.add(base);
  for (const [w, h, d, x, z] of [[0.15, 0.7, 3, -1.05, 0], [0.15, 0.7, 3, 1.05, 0], [2.2, 0.7, 0.15, 0, -1.45], [2.2, 0.7, 0.15, 0, 1.45]] as number[][]) { const s = mesh(new THREE.BoxGeometry(w, h, d), wood); s.position.set(x, 1.1, z); root.add(s); }
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [[-1.2, 1], [1.2, 1], [-1.2, -1], [1.2, -1]]) { const w = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 14), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, z); root.add(w); wheels.push(w); const hub = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 8), toon(0xffd23f), false); hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); root.add(hub); }
  const handle = mesh(new THREE.BoxGeometry(2.0, 0.12, 0.12), dark); handle.position.set(0, 1.5, 2.05); root.add(handle);
  for (const s of [-1, 1]) { const a = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), dark); a.position.set(s * 0.95, 1.4, 1.75); a.rotation.x = 0.3; root.add(a); }
  const seat = new THREE.Object3D(); seat.position.set(0, 0.8, 0); root.add(seat);
  const sign = textSprite('🛒 CART', { size: 44, scale: 0.8 }); sign.position.set(0, 2.4, 0); root.add(sign);
  return { root, wheels, seat };
}

export function makeNest(size: number): THREE.Group {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(1.2 * size, 0.35 * size, 8, 20), toon(0xb8894a)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3 * size; g.add(ring);
  const bed = mesh(new THREE.CylinderGeometry(1.15 * size, 1.0 * size, 0.25 * size, 18), toon(0xe8c77a)); bed.position.y = 0.15 * size; g.add(bed);
  for (let i = 0; i < 14; i++) { const st = mesh(new THREE.CylinderGeometry(0.03 * size, 0.03 * size, 0.9 * size, 4), toon(0x9a6b35), false); const a = i * 0.45; st.position.set(Math.cos(a) * 1.25 * size, 0.42 * size, Math.sin(a) * 1.25 * size); st.rotation.set(Math.random(), a, 1.2); g.add(st); }
  return g;
}

export function makeIncubator(): { root: THREE.Group; ring: THREE.Mesh; label: THREE.Sprite | null } {
  const root = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.4, 20), toon(0xf4e3c1)); base.position.y = 0.2; root.add(base);
  const straw = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 20), toon(0xffd97a), false); straw.position.y = 0.45; root.add(straw);
  const ring = mesh(new THREE.TorusGeometry(1.55, 0.09, 6, 40, 0.001), new THREE.MeshBasicMaterial({ color: 0x7dff8a }), false); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.45; root.add(ring);
  return { root, ring, label: null };
}

export function makeTreadmill(): { root: THREE.Group; belt: THREE.Texture } {
  const root = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d')!; x.fillStyle = '#2b3442'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(20, i * 16 + 2); x.lineTo(44, i * 16 + 2); x.lineTo(32, i * 16 + 12); x.fill(); }
  const belt = new THREE.CanvasTexture(c); belt.wrapS = belt.wrapT = THREE.RepeatWrapping; belt.repeat.set(1, 3);
  const base = mesh(new THREE.BoxGeometry(2.6, 0.5, 5), toon(0x566273)); base.position.y = 0.25; root.add(base);
  const top = mesh(new THREE.PlaneGeometry(2.2, 4.6), new THREE.MeshLambertMaterial({ map: belt }), false); top.rotation.x = -Math.PI / 2; top.position.y = 0.51; root.add(top);
  for (const s of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(0.12, 0.12, 2.4), toon(0xdfe6ee)); r.position.set(s * 1.25, 1.3, -1.1); root.add(r); const p = mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), toon(0xdfe6ee)); p.position.set(s * 1.25, 0.8, -2.2); root.add(p); }
  const panel = mesh(new THREE.BoxGeometry(2.6, 0.9, 0.2), toon(0x2b3442)); panel.position.set(0, 1.7, -2.35); panel.rotation.x = -0.3; root.add(panel);
  return { root, belt };
}

export function makePad(color: number): THREE.Group {
  const g = new THREE.Group();
  const d = mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.15, 24), toon(color)); d.position.y = 0.08; g.add(d);
  const r = mesh(new THREE.TorusGeometry(1.1, 0.07, 6, 30), toon(0xffffff), false); r.rotation.x = Math.PI / 2; r.position.y = 0.17; g.add(r);
  return g;
}
