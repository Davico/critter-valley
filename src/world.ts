import * as THREE from 'three';

// ---------- the active area's terrain (set by the area loader) ----------
export type Surface = 'grass' | 'snow' | 'ice';
let terrainFn: (x: number, z: number) => number = () => 0;
let surfaceFn: (x: number, z: number) => Surface = () => 'grass';
export function setTerrain(t: (x: number, z: number) => number, s: (x: number, z: number) => Surface) { terrainFn = t; surfaceFn = s; }
export const terrainH = (x: number, z: number) => terrainFn(x, z);
export const STEP = 0.7;            // max step up without jumping
export function smooth(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
export function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

// ---------- colliders ----------
export interface Box { x0: number; x1: number; z0: number; z1: number; y0: number; top: number; kind?: 'solid' | 'bridge' | 'ramp' | 'mushroom' | 'snowwall' | 'ice'; ramp?: { zFrom: number; zTo: number; h0: number; h1: number }; obj?: THREE.Object3D }
export const BOXES: Box[] = [];
export function addBox(b: Box) { BOXES.push(b); return b; }
export function removeBox(b: Box) { const i = BOXES.indexOf(b); if (i >= 0) BOXES.splice(i, 1); }

export function boxTop(b: Box, x: number, z: number) {
  if (!b.ramp) return b.top;
  const r = b.ramp, t = Math.min(1, Math.max(0, (z - r.zFrom) / (r.zTo - r.zFrom)));
  return r.h0 + (r.h1 - r.h0) * t;
}
/** Highest walkable surface under (x,z) that a body with feet at feetY can stand on. */
export function groundAt(x: number, z: number, feetY: number): { g: number; box: Box | null } {
  let g = terrainH(x, z), box: Box | null = null;
  for (const b of BOXES) {
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    const t = boxTop(b, x, z);
    if (t <= feetY + STEP && t > g) { g = t; box = b; }
  }
  return { g, box };
}
export function surfaceAt(x: number, z: number, box: Box | null): Surface { return box ? (box.kind === 'ice' ? 'ice' : 'grass') : surfaceFn(x, z); }
/** Pushes a circle (radius r, feet at feetY, height hgt) out of boxes it cannot step onto. Returns the push normal and the box, or null. */
export function pushOut(p: { x: number; z: number }, feetY: number, r: number, hgt = 1.6): { nx: number; nz: number; box: Box } | null {
  let hit: { nx: number; nz: number; box: Box } | null = null;
  for (const b of BOXES) {
    if (p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r) continue;
    const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
    const t = boxTop(b, cx, cz);
    if (t <= feetY + STEP || feetY + hgt < b.y0) continue;
    let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d < 1e-4) { // centre inside: push out along the shallowest side
      const opts = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
      dx = opts[1]; dz = opts[2]; d = 0;
      p.x += dx * (opts[0] + r); p.z += dz * (opts[0] + r);
    } else if (d < r) { p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d); dx /= d; dz /= d; }
    else continue;
    hit = { nx: dx, nz: dz, box: b };
  }
  return hit;
}

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 170, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (c: number, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...extra });
export const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
export function mesh(g: THREE.BufferGeometry, m: THREE.Material, shadow = true) { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o; }

// ---------- text sprites ----------
export function textSprite(text: string, opts: { size?: number; color?: string; bg?: string; scale?: number } = {}) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d')!, fs = opts.size ?? 64;
  ctx.font = `800 ${fs}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + fs, h = fs * 1.6;
  c.width = w; c.height = h;
  ctx.font = `800 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (opts.bg) { ctx.fillStyle = opts.bg; const r = h / 2; ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, r); ctx.fill(); }
  ctx.lineWidth = fs / 6; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineJoin = 'round'; if (!opts.bg) ctx.strokeText(text, w / 2, h / 2 + 2);
  ctx.fillStyle = opts.color ?? '#fff'; ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  const sc = opts.scale ?? 1; s.scale.set((w / h) * sc, sc, 1); return s;
}

// ---------- shared builders ----------
export interface Bounds { x0: number; x1: number; z0: number; z1: number }
/** A vertex-coloured heightfield mesh for the active terrain. */
export function terrainMesh(scene: THREE.Object3D, B: Bounds, color: (x: number, z: number, h: number, out: THREE.Color) => void, density = 1.6) {
  const W = B.x1 - B.x0 + 30, D = B.z1 - B.z0 + 30, cx = (B.x1 + B.x0) / 2, cz = (B.z1 + B.z0) / 2;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W * density), Math.round(D * density)); geo.rotateX(-Math.PI / 2); geo.translate(cx, 0, cz);
  const pos = geo.attributes.position as THREE.BufferAttribute, cols: number[] = [], tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z); pos.setY(i, h); color(x, z, h, tmp); cols.push(tmp.r, tmp.g, tmp.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); ground.receiveShadow = true; scene.add(ground);
  return ground;
}
export function rock(scene: THREE.Object3D, x: number, z: number, s: number, col = 0xa9b0b8) {
  const g0 = terrainH(x, z); const r = mesh(new THREE.DodecahedronGeometry(s, 0), toon(col)); r.position.set(x, g0 + s * 0.5, z); r.rotation.set(Math.random(), Math.random(), 0); scene.add(r);
  addBox({ x0: x - s * 0.8, x1: x + s * 0.8, z0: z - s * 0.8, z1: z + s * 0.8, y0: g0 - 1, top: g0 + s * 1.2 });
}
/** Instanced trees: round leafy ('leaf') or snowy pines ('pine'). Trees inside the bounds get colliders. */
export function forest(scene: THREE.Object3D, list: [number, number, number][], B: Bounds, style: 'leaf' | 'pine') {
  const trunks: THREE.Matrix4[] = [], crowns: THREE.Matrix4[] = [], tops: THREE.Matrix4[] = [], cols: THREE.Color[] = [], q = new THREE.Quaternion();
  for (const [x, z, s] of list) {
    const g0 = terrainH(x, z), rq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g0 + 1 * s, z), q, new THREE.Vector3(s, s, s)));
    if (style === 'leaf') { crowns.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g0 + 2.7 * s, z), rq, new THREE.Vector3(s * 1.25, s * 1.15, s * 1.25))); cols.push(new THREE.Color().setHSL(0.28 + Math.random() * 0.07, 0.6, 0.38 + Math.random() * 0.12)); }
    else { for (let k = 0; k < 3; k++) { crowns.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g0 + (2 + k * 1.2) * s, z), rq, new THREE.Vector3(s * (1.5 - k * 0.38), s, s * (1.5 - k * 0.38)))); cols.push(new THREE.Color().setHSL(0.38 + Math.random() * 0.04, 0.45, 0.26 + Math.random() * 0.08)); tops.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g0 + (2.35 + k * 1.2) * s, z), rq, new THREE.Vector3(s * (1.2 - k * 0.32), s * 0.55, s * (1.2 - k * 0.32)))); } }
    if (x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1) addBox({ x0: x - 0.4 * s, x1: x + 0.4 * s, z0: z - 0.4 * s, z1: z + 0.4 * s, y0: g0 - 1, top: g0 + 4 * s });
  }
  const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 7), toon(0x8a5a30), trunks.length);
  trunks.forEach((m, i) => trunkI.setMatrixAt(i, m)); trunkI.castShadow = true; scene.add(trunkI);
  const cg = style === 'leaf' ? new THREE.IcosahedronGeometry(1.6, 0) : new THREE.ConeGeometry(1.2, 1.8, 8);
  const crownI = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), crowns.length);
  crowns.forEach((m, i) => { crownI.setMatrixAt(i, m); crownI.setColorAt(i, cols[i]); }); crownI.castShadow = true; scene.add(crownI);
  if (tops.length) { const topI = new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 1.8, 8), new THREE.MeshLambertMaterial({ color: 0xf4fbff, flatShading: true }), tops.length); tops.forEach((m, i) => topI.setMatrixAt(i, m)); scene.add(topI); }
}
export function clouds(scene: THREE.Object3D, B: Bounds, color = 0xffffff) {
  const list: THREE.Group[] = [];
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) { const p = mesh(new THREE.SphereGeometry(2 + Math.random() * 1.6, 10, 8), toon(color), false); p.position.set(k * 2.4 - 3.6, Math.random() * 0.8, Math.random() * 1.2); g.add(p); }
    g.position.set(B.x0 - 40 + Math.random() * 160, 26 + Math.random() * 12, B.z0 - 20 + Math.random() * (B.z1 - B.z0 + 30)); scene.add(g); list.push(g);
  }
  return (_t: number) => list.forEach((c, i) => { c.position.x += 0.01 + i * 0.0006; if (c.position.x > 120) c.position.x = -120; });
}
