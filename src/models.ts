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

// ---------------- snacks (replace eggs) ----------------
export function makeSnack(kind: 's' | 'm' | 'b', gold: boolean): THREE.Group {
  const g = new THREE.Group();
  const goldM = () => new THREE.MeshStandardMaterial({ color: 0xffcf33, metalness: 0.6, roughness: 0.25, emissive: 0x6b4a00, emissiveIntensity: 0.4 });
  if (kind === 's') { // a big strawberry
    const body = mesh(new THREE.SphereGeometry(0.38, 16, 12), gold ? goldM() : toon(0xff3b55)); body.scale.set(1, 1.15, 1); body.position.y = 0.42; g.add(body);
    const tip = mesh(new THREE.ConeGeometry(0.3, 0.35, 14), gold ? goldM() : toon(0xff3b55)); tip.rotation.x = Math.PI; tip.position.y = 0.16; g.add(tip);
    for (let i = 0; i < 14; i++) { const a = i * 2.4, y = 0.25 + (i % 4) * 0.12, r = 0.36 - Math.abs(y - 0.45) * 0.4; const sd = mesh(new THREE.SphereGeometry(0.03, 5, 4), toon(0xfff3a0), false); sd.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.add(sd); }
    for (let i = 0; i < 5; i++) { const l = mesh(new THREE.ConeGeometry(0.09, 0.3, 4), toon(0x3fae46), false); l.rotation.z = Math.PI / 2.3; l.rotation.y = i * 1.26; l.position.set(Math.cos(i * 1.26) * 0.12, 0.84, -Math.sin(i * 1.26) * 0.12); g.add(l); }
  } else if (kind === 'm') { // a honey pot
    const pot = mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.75, 18), gold ? goldM() : toon(0xffb020)); pot.position.y = 0.38; g.add(pot);
    const band = mesh(new THREE.TorusGeometry(0.46, 0.05, 6, 20), toon(0x8a5a30), false); band.rotation.x = Math.PI / 2; band.position.y = 0.55; g.add(band);
    const lid = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 18), toon(0xc98a4f)); lid.position.y = 0.8; g.add(lid);
    const knob = mesh(new THREE.SphereGeometry(0.1, 8, 6), toon(0xc98a4f), false); knob.position.y = 0.9; g.add(knob);
    const drip = mesh(new THREE.SphereGeometry(0.1, 8, 6), toon(0xffd23f), false); drip.scale.set(1, 1.6, 1); drip.position.set(0.3, 0.6, 0.3); g.add(drip);
  } else { // a giant watermelon
    const m = mesh(new THREE.SphereGeometry(1.25, 24, 18), gold ? goldM() : toon(0x2e9e44)); m.scale.set(1, 0.88, 1.15); m.position.y = 1.1; g.add(m);
    for (let i = 0; i < 6; i++) { const s = mesh(new THREE.TorusGeometry(1.24, 0.07, 6, 30, Math.PI), toon(gold ? 0xfff0a0 : 0x1b6b2c), false); s.rotation.set(0, (i * Math.PI) / 6, 0); s.scale.set(1, 0.88, 1.15); s.position.y = 1.1; g.add(s); }
    const stem = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 6), toon(0x7a4a26), false); stem.position.y = 2.2; g.add(stem);
  }
  return g;
}

// ---------------- camp animals (extra types) ----------------
export function makeAnimal(type: string, gold = false): THREE.Group {
  if (type === 'bunny' || type === 'turtle' || type === 'fox' || type === 'chick') return makePet(type as PetType, gold);
  if (type === 'arcticfox') { const f = makePet('fox', gold); f.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshToonMaterial; if (mm?.color?.getHex() === 0xff8a3d) { (o as THREE.Mesh).material = toon(0xf4f8ff); } }); return f; }
  if (type === 'penguin') return makePenguin();
  if (type === 'owl') return makeOwl();
  const g = new THREE.Group();
  if (type === 'hen') { const h = makeHen(0.55, 0xffffff); h.bang.visible = false; g.add(h.root); return g; }
  const bearish = type === 'bear' || type === 'polarbear';
  const col = gold ? 0xffcf33 : ({ bear: 0x9a6232, polarbear: 0xf4f8ff, raccoon: 0x8d959e, yak: 0x6b4a32, leopard: 0xdfe3e8 } as Record<string, number>)[type] ?? 0xd9a066;
  const m = toon(col);
  const body = mesh(new THREE.SphereGeometry(0.45, 16, 12), m); body.position.y = type === 'deer' ? 0.75 : 0.48; body.scale.set(1, 0.95, type === 'deer' ? 1.35 : 1.1); g.add(body);
  const head = new THREE.Group(); head.position.set(0, type === 'deer' ? 1.3 : 0.92, type === 'deer' ? 0.5 : 0.25); g.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), m));
  eyes(head, 0.06, 0.24, 0.12, 0.07);
  const snout = mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(type === 'raccoon' || type === 'polarbear' || type === 'leopard' ? 0xeeeeee : type === 'yak' ? 0x3a2a20 : 0xf0d0a0)); snout.scale.set(1, 0.8, 1); snout.position.set(0, -0.08, 0.27); head.add(snout);
  const nose = mesh(new THREE.SphereGeometry(0.05, 8, 6), toon(0x222222), false); nose.position.set(0, -0.04, 0.4); head.add(nose);
  if (type === 'yak') { body.scale.set(1.35, 1.15, 1.6); body.position.y = 0.7; head.position.set(0, 0.95, 0.75); for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 10, Math.PI), toon(0xf2e6d0)); h.position.set(s * 0.28, 0.2, 0); h.rotation.set(0, s * 0.4, s * 0.6); head.add(h); } const fringe = mesh(new THREE.ConeGeometry(0.62, 0.5, 12, 1, true), toon(0x4f3424)); fringe.position.set(0, 0.42, 0); fringe.scale.set(1.1, 1, 1.5); g.add(fringe); }
  if (type === 'leopard') { body.scale.set(0.95, 0.85, 1.45); for (let i = 0; i < 9; i++) { const sp = mesh(new THREE.SphereGeometry(0.06, 6, 4), toon(0x4a4f58), false); sp.position.set(Math.sin(i * 2.1) * 0.38, 0.6 + Math.cos(i * 1.3) * 0.12, -0.45 + i * 0.1); g.add(sp); } const tl = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.9, 8), m); tl.rotation.x = 1.0; tl.position.set(0, 0.75, -0.8); g.add(tl); for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.08, 8, 6), m); e.position.set(s * 0.2, 0.24, -0.02); head.add(e); } }
  if (bearish) for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.11, 10, 8), m); e.position.set(s * 0.22, 0.24, -0.02); head.add(e); }
  if (type === 'raccoon') {
    const mask = mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 14), toon(0x2b2b38), false); mask.scale.set(1.6, 0.6, 1); mask.position.set(0, 0.06, 0.24); head.add(mask);
    for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.1, 0.22, 4), m); e.position.set(s * 0.18, 0.28, -0.04); head.add(e); }
    for (let i = 0; i < 4; i++) { const t = mesh(new THREE.SphereGeometry(0.13 - i * 0.012, 10, 8), toon(i % 2 ? 0x2b2b38 : 0xb8c0c8)); t.position.set(0, 0.5 + i * 0.05, -0.5 - i * 0.16); g.add(t); }
  }
  if (type === 'deer') {
    const am = gold ? new THREE.MeshStandardMaterial({ color: 0xffcf33, metalness: 0.6, roughness: 0.25, emissive: 0x6b4a00, emissiveIntensity: 0.4 }) : toon(0xffe9a8);
    for (const s of [-1, 1]) { const a = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.45, 6), am); a.position.set(s * 0.14, 0.42, -0.05); a.rotation.z = -s * 0.4; head.add(a); const b = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 6), am); b.position.set(s * 0.24, 0.55, -0.02); b.rotation.z = s * 0.5; head.add(b); }
    for (let i = 0; i < 5; i++) { const sp = mesh(new THREE.SphereGeometry(0.05, 6, 4), toon(0xffffff), false); sp.position.set((i % 2 ? 0.2 : -0.2) * (i / 4), 1.05, 0.2 - i * 0.2); g.add(sp); }
  }
  for (const [x, z] of [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]]) { const l = mesh(new THREE.CylinderGeometry(0.07, 0.08, type === 'deer' ? 0.6 : 0.25, 8), m); l.position.set(x, type === 'deer' ? 0.3 : 0.12, z * (type === 'deer' ? 1.4 : 1)); g.add(l); }
  if (gold) { const sp = textSprite('✦', { size: 80, color: '#fff7b0', scale: 0.5 }); sp.position.set(0.4, 1.6, 0); g.add(sp); }
  return g;
}

// ---------------- building pieces ----------------
const tex = (draw: (x: CanvasRenderingContext2D) => void) => { const c = document.createElement('canvas'); c.width = c.height = 32; draw(c.getContext('2d')!); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };
const noisy = (base: string, dots: string[], n = 60) => tex((x) => { x.fillStyle = base; x.fillRect(0, 0, 32, 32); for (let i = 0; i < n; i++) { x.fillStyle = dots[i % dots.length]; x.fillRect((Math.random() * 8 | 0) * 4, (Math.random() * 8 | 0) * 4, 4, 4); } });
const lamT = (t: THREE.Texture, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => new THREE.MeshLambertMaterial({ map: t, ...extra });
let BM: Record<string, THREE.Material | THREE.Material[]> | null = null;
export function blockMaterial(id: string): THREE.Material | THREE.Material[] {
  if (!BM) {
    const grassTop = lamT(noisy('#6fd65a', ['#5cc24a', '#86e66b'])), dirt = lamT(noisy('#a8703f', ['#8f5c31', '#bd8550'])), grassSide = lamT(tex((x) => { x.fillStyle = '#a8703f'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#8f5c31'; for (let i = 0; i < 30; i++) x.fillRect((Math.random() * 8 | 0) * 4, (Math.random() * 8 | 0) * 4, 4, 4); x.fillStyle = '#6fd65a'; x.fillRect(0, 0, 32, 8); for (let i = 0; i < 8; i++) x.fillRect(i * 4, 8, 4, (Math.random() * 3 | 0) * 4); }));
    const wood = lamT(tex((x) => { x.fillStyle = '#c98a4f'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#a8703f'; for (let y = 0; y < 32; y += 8) x.fillRect(0, y, 32, 2); x.fillRect(12, 0, 2, 8); x.fillRect(26, 8, 2, 8); x.fillRect(6, 16, 2, 8); x.fillRect(20, 24, 2, 8); }));
    const stone = lamT(noisy('#a9b0b8', ['#8d959e', '#c3c9d0'], 50));
    const brick = lamT(tex((x) => { x.fillStyle = '#d9583b'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#f2e6d0'; for (let y = 0; y < 32; y += 8) { x.fillRect(0, y, 32, 1.5); for (let k = (y / 8) % 2 ? 0 : 8; k < 32; k += 16) x.fillRect(k, y, 1.5, 8); } }));
    BM = { grass: [grassSide, grassSide, grassTop, dirt, grassSide, grassSide], wood, stone, brick, glass: new THREE.MeshLambertMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.45 }), snow: lamT(noisy('#f4fbff', ['#e3f1fb', '#ffffff'], 40)), ice: new THREE.MeshLambertMaterial({ map: noisy('#9fdcff', ['#bfeaff', '#7fc9f5'], 30), transparent: true, opacity: 0.8 }) };
  }
  return BM[id];
}
export const blockGeo = new THREE.BoxGeometry(1, 1, 1);
export function makeSpecial(id: string): THREE.Group {
  const g = new THREE.Group();
  if (id === 'flower') { const bush = mesh(new THREE.SphereGeometry(0.32, 10, 8), toon(0x3fae46)); bush.scale.y = 0.7; bush.position.y = 0.2; g.add(bush); for (let i = 0; i < 6; i++) { const f = mesh(new THREE.SphereGeometry(0.09, 8, 6), toon([0xff5d8f, 0xffd23f, 0xffffff, 0xb46bff][i % 4]), false); const a = i * 1.05; f.position.set(Math.cos(a) * 0.22, 0.34 + (i % 2) * 0.06, Math.sin(a) * 0.22); g.add(f); } }
  if (id === 'pond') { const w = mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x3ab0ff, roughness: 0.1 }), false); w.position.y = 0.04; g.add(w); const rim = mesh(new THREE.TorusGeometry(0.48, 0.06, 6, 20), toon(0xa9b0b8), false); rim.rotation.x = Math.PI / 2; rim.position.y = 0.06; g.add(rim); const lily = mesh(new THREE.CircleGeometry(0.12, 10), toon(0x3fae46), false); lily.rotation.x = -Math.PI / 2; lily.position.set(0.15, 0.08, 0.1); g.add(lily); }
  if (id === 'birdhouse') { const p = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), toon(0x8a5a30)); p.position.y = 0.6; g.add(p); const h = mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), toon(0x5bd6ff)); h.position.y = 1.4; g.add(h); const r = mesh(new THREE.ConeGeometry(0.42, 0.3, 4), toon(0xe0533d)); r.rotation.y = Math.PI / 4; r.position.y = 1.78; g.add(r); const hole = mesh(new THREE.CircleGeometry(0.08, 10), toon(0x222222), false); hole.position.set(0, 1.42, 0.23); g.add(hole); }
  if (id === 'swing') { for (const s of [-1, 1]) { const l = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), toon(0xc98a4f)); l.position.set(s * 0.42, 0.8, 0); l.rotation.z = s * 0.1; g.add(l); } const top = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), toon(0xc98a4f)); top.rotation.z = Math.PI / 2; top.position.y = 1.6; g.add(top); const seat = new THREE.Group(); seat.position.y = 1.6; seat.name = 'seat'; g.add(seat); for (const s of [-1, 1]) { const r = mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.1, 4), toon(0xffffff), false); r.position.set(s * 0.18, -0.55, 0); seat.add(r); } const b = mesh(new THREE.BoxGeometry(0.45, 0.06, 0.25), toon(0xff5d8f)); b.position.y = -1.1; seat.add(b); }
  if (id === 'snowman') { for (const [r, y] of [[0.42, 0.4], [0.3, 1.0], [0.22, 1.45]] as const) { const b = mesh(new THREE.SphereGeometry(r, 14, 10), toon(0xf7fbff)); b.position.y = y; g.add(b); } const nose = mesh(new THREE.ConeGeometry(0.05, 0.25, 8), toon(0xff8a1f)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.45, 0.3); g.add(nose); for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.035, 6, 4), toon(0x222222), false); e.position.set(s * 0.08, 1.53, 0.19); g.add(e); const arm = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), toon(0x7a4a26)); arm.position.set(s * 0.45, 1.05, 0); arm.rotation.z = s * 1.0; g.add(arm); } const hat = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12), toon(0x2b2b38)); hat.position.y = 1.75; g.add(hat); const scarf = mesh(new THREE.TorusGeometry(0.24, 0.05, 6, 14), toon(0xe0533d), false); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.25; g.add(scarf); }
  if (id === 'igloo') { const d = mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xf4fbff)); g.add(d); for (let i = 1; i < 4; i++) { const r = mesh(new THREE.TorusGeometry(0.5 * Math.cos(i * 0.38), 0.012, 4, 24), toon(0xcfe3f2), false); r.rotation.x = Math.PI / 2; r.position.y = 0.5 * Math.sin(i * 0.38); g.add(r); } const door = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 12, 1, false, 0, Math.PI), toon(0xf4fbff)); door.rotation.set(Math.PI / 2, 0, Math.PI / 2); door.position.set(0, 0.05, 0.48); g.add(door); const hole = mesh(new THREE.CircleGeometry(0.13, 12, 0, Math.PI), toon(0x2a3a4a), false); hole.position.set(0, 0.02, 0.64); g.add(hole); }
  if (id === 'hay') { const h = mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), toon(0xffd97a)); h.position.y = 0.18; g.add(h); for (let i = 0; i < 6; i++) { const st = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4), toon(0xe8c56a), false); st.position.set((Math.random() - 0.5) * 0.8, 0.38, (Math.random() - 0.5) * 0.8); st.rotation.set(Math.random(), 0, 1.3); g.add(st); } }
  return g;
}
export function makePantry(): THREE.Group {
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(3.2, 1, 1.6), toon(0xc98a4f)); base.position.y = 0.5; g.add(base);
  for (const x of [-1.5, 1.5]) { const p = mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), toon(0x8a5a30)); p.position.set(x, 1.2, -0.7); g.add(p); }
  const roof = mesh(new THREE.BoxGeometry(3.6, 0.15, 2), toon(0xe0533d)); roof.position.set(0, 2.45, -0.2); roof.rotation.x = 0.15; g.add(roof);
  for (let i = 0; i < 5; i++) { const s = mesh(new THREE.BoxGeometry(3.6 / 5, 0.16, 2.02), toon(0xffffff)); s.position.set(-1.44 + i * 0.72, 2.46, -0.2); s.rotation.x = 0.15; if (i % 2) g.add(s); }
  const sign = textSprite('🧺 PANTRY', { size: 44, bg: '#8a5a30', scale: 0.6 }); sign.position.set(0, 3, 0); g.add(sign);
  return g;
}


// ---------------- snow mountain ----------------
const goldMat = () => new THREE.MeshStandardMaterial({ color: 0xffcf33, metalness: 0.6, roughness: 0.25, emissive: 0x6b4a00, emissiveIntensity: 0.4 });
export function makeSnowSnack(kind: 's' | 'm' | 'b', gold: boolean): THREE.Group {
  const g = new THREE.Group();
  if (kind === 's') { // gingerbread cookie (a chunky star)
    const shape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.2 : 0.42; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); } shape.closePath();
    const c = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), gold ? goldMat() : toon(0xc8813f)); c.position.set(0, 0.45, -0.07); g.add(c);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + Math.PI / 2; const d = mesh(new THREE.SphereGeometry(0.045, 6, 4), toon(0xffffff), false); d.position.set(Math.cos(a) * 0.26, 0.45 + Math.sin(a) * 0.26, 0.12); g.add(d); }
    for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.04, 6, 4), toon(0x3a1d0a), false); e.position.set(s * 0.07, 0.5, 0.13); g.add(e); }
  } else if (kind === 'm') { // a mug of cocoa with marshmallows
    const mug = mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.6, 18), gold ? goldMat() : toon(0xe0533d)); mug.position.y = 0.3; g.add(mug);
    const top = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 18), toon(0x6b3a1e), false); top.position.y = 0.58; g.add(top);
    const handle = mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12), gold ? goldMat() : toon(0xe0533d)); handle.position.set(0.4, 0.32, 0); g.add(handle);
    for (let i = 0; i < 3; i++) { const mm = mesh(new THREE.BoxGeometry(0.13, 0.1, 0.13), toon(0xfff4f8), false); mm.position.set(Math.cos(i * 2) * 0.15, 0.63, Math.sin(i * 2) * 0.15); mm.rotation.y = i; g.add(mm); }
    const band = mesh(new THREE.TorusGeometry(0.37, 0.03, 6, 20), toon(0xffffff), false); band.rotation.x = Math.PI / 2; band.position.y = 0.3; g.add(band);
  } else { // a giant layered cake
    const layers = [[1.3, 0.7, 0xfff0f6], [1.0, 0.6, 0xff9ac4], [0.7, 0.5, 0xfff0f6]] as const; let y = 0;
    for (const [r, h, c] of layers) { const l = mesh(new THREE.CylinderGeometry(r, r, h, 24), gold ? goldMat() : toon(c)); l.position.y = y + h / 2; g.add(l); const icing = mesh(new THREE.TorusGeometry(r, 0.08, 6, 24), toon(0xffffff), false); icing.rotation.x = Math.PI / 2; icing.position.y = y + h; g.add(icing); y += h; }
    for (let i = 0; i < 5; i++) { const a = i * 1.26; const cnd = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), toon([0x5bd6ff, 0xffd23f, 0x7dff8a][i % 3]), false); cnd.position.set(Math.cos(a) * 0.4, y + 0.17, Math.sin(a) * 0.4); g.add(cnd); const fl = mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffb020 }), false); fl.scale.y = 1.6; fl.position.set(Math.cos(a) * 0.4, y + 0.42, Math.sin(a) * 0.4); g.add(fl); }
    const cherry = mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(0xe0233d)); cherry.position.y = y + 0.15; g.add(cherry);
  }
  return g;
}
export interface RamMesh { root: THREE.Group; head: THREE.Group; legs: THREE.Mesh[]; bang: THREE.Sprite; stars: THREE.Sprite }
export function makeRam(size: number): RamMesh {
  const root = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(size); root.add(inner);
  const wool = toon(0xf7f4ee), face = toon(0x3d3a44), horn = toon(0xd9b98a);
  const body = new THREE.Group(); body.position.y = 0.75; inner.add(body);
  for (let i = 0; i < 9; i++) { const p = mesh(sph(0.33), wool); p.position.set(Math.cos(i * 2.1) * 0.25, Math.sin(i * 1.7) * 0.12, -0.35 + (i / 8) * 0.7); body.add(p); }
  const head = new THREE.Group(); head.position.set(0, 0.95, 0.55); inner.add(head);
  const hd = mesh(sph(0.24), face); hd.scale.set(0.9, 1, 1.15); head.add(hd);
  const tuft = mesh(sph(0.16), wool); tuft.position.set(0, 0.18, -0.02); head.add(tuft);
  eyes(head, 0.05, 0.2, 0.1, 0.06);
  for (const s of [-1, 1]) { const brow = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), toon(0x111111), false); brow.position.set(s * 0.1, 0.13, 0.25); brow.rotation.z = s * 0.4; head.add(brow);
    const h = mesh(new THREE.TorusGeometry(0.15, 0.06, 8, 14, Math.PI * 1.5), horn); h.position.set(s * 0.22, 0.08, -0.05); h.rotation.set(0, s * Math.PI / 2, 0); head.add(h); }
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]]) { const l = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6), face); l.position.set(x, 0.25, z); inner.add(l); legs.push(l); }
  const bang = textSprite('!', { size: 90, color: '#ff4d3d', scale: 0.9 }); bang.position.y = 2.1 * size; bang.visible = false; root.add(bang);
  const stars = textSprite('★ ★', { size: 60, color: '#fff36b', scale: 0.6 }); stars.position.y = 1.7 * size; stars.visible = false; root.add(stars);
  return { root, head, legs, bang, stars };
}
export function makeSled(): { root: THREE.Group; seat: THREE.Object3D } {
  const root = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(1.5, 0.15, 3), toon(0xe0533d)); deck.position.y = 0.55; root.add(deck);
  for (let i = 0; i < 4; i++) { const sl = mesh(new THREE.BoxGeometry(1.52, 0.02, 0.12), toon(0xffffff), false); sl.position.set(0, 0.64, -1.1 + i * 0.7); root.add(sl); }
  for (const s of [-1, 1]) {
    const run = mesh(new THREE.BoxGeometry(0.1, 0.1, 3.2), toon(0x5a6a7a)); run.position.set(s * 0.65, 0.1, 0); root.add(run);
    const curl = mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 12, Math.PI), toon(0x5a6a7a)); curl.rotation.set(0, Math.PI / 2, 0); curl.position.set(s * 0.65, 0.45, -1.6); root.add(curl);
    for (const z of [-0.9, 0.9]) { const p = mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), toon(0x5a6a7a)); p.position.set(s * 0.65, 0.33, z); root.add(p); }
  }
  const rope = mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 12, Math.PI), toon(0xf2e6d0), false); rope.position.set(0, 0.6, -1.7); rope.rotation.x = -Math.PI / 2; root.add(rope);
  const seat = new THREE.Object3D(); seat.position.set(0, 0.62, -0.3); root.add(seat);
  const sign = textSprite('🛷 SLED', { size: 44, scale: 0.8 }); sign.position.set(0, 2.4, 0); root.add(sign);
  return { root, seat };
}
export function makePortal(color: number, label: string): { root: THREE.Group; swirl: THREE.Mesh; lock: THREE.Sprite } {
  const root = new THREE.Group();
  for (const s of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.8, 4.2, 0.8), toon(0xa9b0b8)); p.position.set(s * 2.2, 2.1, 0); root.add(p); }
  const arch = mesh(new THREE.TorusGeometry(2.2, 0.4, 8, 20, Math.PI), toon(0xa9b0b8)); arch.position.y = 4.1; root.add(arch);
  const swirl = mesh(new THREE.CircleGeometry(1.9, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }), false); swirl.position.y = 2.6; root.add(swirl);
  const sign = textSprite(label, { size: 50, bg: 'rgba(10,30,50,.65)', scale: 0.9 }); sign.position.set(0, 7, 0); root.add(sign);
  const lock = textSprite('🔒', { size: 90, scale: 1.2 }); lock.position.set(0, 2.6, 0.2); root.add(lock);
  return { root, swirl, lock };
}
export function makeSnowWall(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const m = toon(0xf4fbff), shade = toon(0xd6e9f7);
  const nx = Math.max(1, Math.round(w / 0.9)), ny = Math.max(1, Math.round(h / 0.6)), nz = Math.max(1, Math.round(d / 0.9));
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) { const b = mesh(new THREE.BoxGeometry(w / nx * 0.97, h / ny * 0.95, d / nz * 0.97), (x + y + z) % 3 ? m : shade); b.position.set(-w / 2 + (x + 0.5) * w / nx, (y + 0.5) * h / ny, -d / 2 + (z + 0.5) * d / nz); g.add(b); }
  return g;
}
function makePenguin(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(sph(0.38), toon(0x22304a)); body.scale.set(1, 1.35, 0.95); body.position.y = 0.55; g.add(body);
  const belly = mesh(sph(0.3), toon(0xffffff)); belly.scale.set(0.9, 1.3, 0.6); belly.position.set(0, 0.5, 0.18); g.add(belly);
  const head = new THREE.Group(); head.position.set(0, 1.05, 0.05); g.add(head); head.add(mesh(sph(0.24), toon(0x22304a)));
  eyes(head, 0.04, 0.19, 0.09, 0.06);
  const beak = mesh(new THREE.ConeGeometry(0.06, 0.18, 8), toon(0xffb020)); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.04, 0.27); head.add(beak);
  for (const s of [-1, 1]) { const w = mesh(sph(0.15), toon(0x22304a)); w.scale.set(0.25, 1.2, 0.6); w.position.set(s * 0.38, 0.6, 0); w.rotation.z = s * 0.3; g.add(w); const f = mesh(new THREE.BoxGeometry(0.14, 0.05, 0.22), toon(0xffb020)); f.position.set(s * 0.13, 0.03, 0.12); g.add(f); }
  const scarf = mesh(new THREE.TorusGeometry(0.25, 0.06, 6, 16), toon(0xe0533d), false); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.88; g.add(scarf);
  return g;
}
function makeOwl(): THREE.Group {
  const g = new THREE.Group(), w = toon(0xf7f9fc), sp = toon(0x9aa3ad);
  const body = mesh(sph(0.4), w); body.scale.set(1, 1.2, 0.95); body.position.y = 0.5; g.add(body);
  for (let i = 0; i < 6; i++) { const d = mesh(new THREE.SphereGeometry(0.04, 6, 4), sp, false); d.position.set((i % 3 - 1) * 0.15, 0.35 + Math.floor(i / 3) * 0.15, 0.36); g.add(d); }
  const head = new THREE.Group(); head.position.set(0, 1.0, 0.02); g.add(head); head.add(mesh(sph(0.3), w));
  for (const s of [-1, 1]) { const ring = mesh(new THREE.CircleGeometry(0.12, 14), toon(0xffe9a8), false); ring.position.set(s * 0.12, 0.03, 0.27); head.add(ring); const t = mesh(new THREE.ConeGeometry(0.07, 0.16, 4), w); t.position.set(s * 0.18, 0.28, 0); head.add(t); const wg = mesh(sph(0.18), w); wg.scale.set(0.3, 1, 0.8); wg.position.set(s * 0.4, 0.55, 0); g.add(wg); }
  eyes(head, 0.03, 0.29, 0.12, 0.065);
  const beak = mesh(new THREE.ConeGeometry(0.05, 0.12, 6), toon(0x3a3a3a)); beak.rotation.x = Math.PI; beak.position.set(0, -0.07, 0.3); head.add(beak);
  return g;
}
