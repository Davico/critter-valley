import * as THREE from 'three';

// ---------- layout constants (Y up, the meadow runs toward -Z, the farm is at +Z) ----------
export const RIVER_Z0 = -104, RIVER_Z1 = -95, RIVER_MID = -99.5;
export const WATER_Y = -1.0;
export const BOUNDS = { x0: -42, x1: 42, z0: -176, z1: 26 };
export const BASE_Z = 2;            // z > BASE_Z is the farm
export const STEP = 0.7;            // max step up without jumping
export const BRIDGE = { x0: 28, x1: 34, z0: -108.5, z1: -90.5, top: 0.2 };

export const NESTS = [
  { x: -14, z: -34, kind: 's' as const, count: 3, henSize: 1, henSpeed: 6.6 },
  { x: 17, z: -70, kind: 'm' as const, count: 2, henSize: 1.3, henSpeed: 7.0 },
  { x: 0, z: -150, kind: 'b' as const, count: 1, henSize: 2.5, henSpeed: 3.8 },
];

export const BUMPS = [-118, -128, -137];
const ROAD: [number, number][] = [[4, 0], [10, -30], [30, -60], [31, -90], [31, -110], [20, -130], [3, -146]];

function smooth(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function roadDist(x: number, z: number) { let d = 1e9; for (let i = 0; i < ROAD.length - 1; i++) d = Math.min(d, segDist(x, z, ROAD[i][0], ROAD[i][1], ROAD[i + 1][0], ROAD[i + 1][1])); return d; }

export function terrainH(x: number, z: number): number {
  let h = 0.9 * Math.sin(x * 0.08 + 1) * Math.cos(z * 0.06) + 0.55 * Math.sin((x - z) * 0.05) + 0.3 * Math.cos(x * 0.21 + z * 0.17);
  h += 3.2 * Math.exp(-((x + 2) ** 2 + (z + 55) ** 2) / 70);                // the mushroom hill
  h += 1.6 * Math.exp(-((x - 22) ** 2 + (z + 125) ** 2) / 60);
  h *= 1 - smooth(-8, 1, z);                                                // flat farm
  const rd = roadDist(x, z); h *= 0.25 + 0.75 * smooth(2.5, 6, rd);         // smoother cart road
  if (z < -110 && z > -142) { for (const bz of BUMPS) h += 0.45 * Math.exp(-((z - bz) ** 2) / 0.6) * (1 - smooth(3, 5, rd)); } // bumps on the road
  for (const n of NESTS) { const d = Math.hypot(x - n.x, z - n.z), target = n.kind === 'b' ? 2.2 : 0.3; const k = 1 - smooth(5, 11, d); h = h * (1 - k) + target * k; }
  // the river: a channel across the whole meadow
  const out = z > RIVER_Z1 ? z - RIVER_Z1 : z < RIVER_Z0 ? RIVER_Z0 - z : 0;
  const bank = smooth(0, 3, out); h = h * bank + -3.2 * (1 - bank);
  if (out > 0 && out < 3) h = Math.max(h, -3.2);
  return h;
}

// ---------- colliders ----------
export interface Box { x0: number; x1: number; z0: number; z1: number; y0: number; top: number; kind?: 'solid' | 'bridge' | 'ramp' | 'mushroom'; ramp?: { zFrom: number; zTo: number; h0: number; h1: number } }
export const BOXES: Box[] = [];

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
/** Pushes a circle (radius r, feet at feetY, height hgt) out of boxes it cannot step onto. Returns the push normal or null. */
export function pushOut(p: { x: number; z: number }, feetY: number, r: number, hgt = 1.6): { nx: number; nz: number } | null {
  let hit: { nx: number; nz: number } | null = null;
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
    hit = { nx: dx, nz: dz };
  }
  return hit;
}
export const isRiver = (z: number) => z > RIVER_Z0 - 0.5 && z < RIVER_Z1 + 0.5;
export function onBridge(x: number, z: number) { return x > BRIDGE.x0 && x < BRIDGE.x1 && z > BRIDGE.z0 && z < BRIDGE.z1; }

function addBox(b: Box) { BOXES.push(b); return b; }

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

// ---------- world building ----------
export interface WorldDeco { update(t: number): void; ramp: Box; }
export function buildWorld(scene: THREE.Scene): WorldDeco {
  const boost: THREE.Mesh[] = [];
  // terrain
  const W = BOUNDS.x1 - BOUNDS.x0 + 30, D = BOUNDS.z1 - BOUNDS.z0 + 30, cz = (BOUNDS.z1 + BOUNDS.z0) / 2;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W * 1.6), Math.round(D * 1.6)); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, cz);
  const pos = geo.attributes.position as THREE.BufferAttribute, cols: number[] = [];
  const cGrass = new THREE.Color('#5fcf52'), cGrass2 = new THREE.Color('#8be05c'), cDirt = new THREE.Color('#d9b071'), cSand = new THREE.Color('#f0d99a'), cBed = new THREE.Color('#5f8fa8'), cFarm = new THREE.Color('#79d65e'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z); pos.setY(i, h);
    const n = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6) * Math.sin((x + z) * 0.31);
    tmp.copy(cGrass).lerp(cGrass2, n * 0.8);
    if (z > BASE_Z) tmp.lerp(cFarm, 0.5);
    const rd = roadDist(x, z); if (rd < 2.6) tmp.lerp(cDirt, 1 - smooth(1.6, 2.6, rd));
    if (h < -0.2) tmp.lerp(cSand, Math.min(1, -h * 1.2)); if (h < -1.4) tmp.copy(cBed);
    cols.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); ground.receiveShadow = true; scene.add(ground);

  // water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, RIVER_Z1 - RIVER_Z0 + 6), new THREE.MeshStandardMaterial({ color: '#3ab0ff', transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, WATER_Y, RIVER_MID); scene.add(water);
  const foam: THREE.Mesh[] = [];
  for (let i = 0; i < 26; i++) { const f = mesh(new THREE.CircleGeometry(0.4 + Math.random() * 0.5, 10), new THREE.MeshBasicMaterial({ color: '#e9f8ff', transparent: true, opacity: 0.7 }), false); f.rotation.x = -Math.PI / 2; f.position.set(BOUNDS.x0 + Math.random() * 84, WATER_Y + 0.02, RIVER_Z0 + 1 + Math.random() * 7); scene.add(f); foam.push(f); }

  // ramp to jump the river: a long slope and a steeper kicker at the end
  const ramp = addBox({ x0: -5, x1: 1, z0: -92.4, z1: -80, y0: -4, top: 2.4, kind: 'ramp', ramp: { zFrom: -80, zTo: -92.4, h0: 0, h1: 2.4 } });
  addBox({ x0: -5, x1: 1, z0: -94.4, z1: -92.4, y0: -4, top: 3.4, kind: 'ramp', ramp: { zFrom: -92.4, zTo: -94.4, h0: 2.4, h1: 3.4 } });
  {
    const board = (z0: number, z1: number, h0: number, h1: number, col: number) => { const len = Math.abs(z1 - z0), dh = h1 - h0, g = new THREE.BoxGeometry(6, 0.4, Math.hypot(len, dh)); const r = mesh(g, toon(col)); r.position.set(-2, (h0 + h1) / 2 - 0.2, (z0 + z1) / 2); r.rotation.x = Math.atan2(dh, len); scene.add(r); };
    board(-80, -92.4, 0, 2.4, 0xc98a4f); board(-92.4, -94.4, 2.4, 3.4, 0xe0621e);
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.ConeGeometry(0.7, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0xffe066 }), false); c.rotation.set(-Math.PI / 2, 0, 0); c.scale.set(1, 1, 0.15); const z = -79.6 - i * 1.1; c.position.set(-2, groundAt(-2, z, 5).g + 0.12, z); scene.add(c); boost.push(c); }
    const leg = mesh(new THREE.BoxGeometry(6, 3.8, 0.6), toon(0x8a5a30)); leg.position.set(-2, 1.4, -94.1); scene.add(leg);
    const arrow = textSprite('🌀 ROLL + JUMP!', { size: 56, color: '#fff36b', scale: 1.4 }); arrow.position.set(-2, 4.5, -84); scene.add(arrow);
  }
  // bridge + rails
  addBox({ x0: BRIDGE.x0, x1: BRIDGE.x1, z0: BRIDGE.z0, z1: BRIDGE.z1, y0: -4, top: BRIDGE.top, kind: 'bridge' });
  addBox({ x0: BRIDGE.x0 - 0.3, x1: BRIDGE.x0, z0: BRIDGE.z0, z1: BRIDGE.z1, y0: -4, top: 1.4 });
  addBox({ x0: BRIDGE.x1, x1: BRIDGE.x1 + 0.3, z0: BRIDGE.z0, z1: BRIDGE.z1, y0: -4, top: 1.4 });
  {
    const deck = mesh(new THREE.BoxGeometry(6, 0.3, 18), toon(0xb07a45)); deck.position.set(31, BRIDGE.top - 0.15, RIVER_MID); scene.add(deck);
    for (let i = 0; i < 18; i++) { const pl = mesh(new THREE.BoxGeometry(6.1, 0.06, 0.08), toon(0x7a4a26), false); pl.position.set(31, BRIDGE.top + 0.01, BRIDGE.z0 + 0.5 + i); scene.add(pl); }
    for (const x of [BRIDGE.x0 - 0.15, BRIDGE.x1 + 0.15]) {
      const rail = mesh(new THREE.BoxGeometry(0.25, 0.2, 18), toon(0x7a4a26)); rail.position.set(x, 1.3, RIVER_MID); scene.add(rail);
      for (let i = 0; i < 6; i++) { const p = mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), toon(0x7a4a26)); p.position.set(x, 0.5, BRIDGE.z0 + 0.5 + i * 3.4); scene.add(p); }
    }
    const s = textSprite('🛒 CART BRIDGE', { size: 48, scale: 1.1 }); s.position.set(31, 3, -89); scene.add(s);
  }

  for (const bz of BUMPS) { const t = (bz + 110) / -20; const x = bz > -130 ? 31 - (bz + 110) / -20 * 11 : 20 - (bz + 130) / -16 * 17; const sg = textSprite('🐢 SLOW!', { size: 44, color: '#fff', bg: '#e0621e', scale: 0.8 }); sg.position.set(x + 4, terrainH(x + 4, bz) + 2.2, bz); scene.add(sg); const post = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), toon(0x7a4a26)); post.position.set(x + 4, terrainH(x + 4, bz) + 0.9, bz); scene.add(post); void t; }
  // farm fence with a gate in the middle
  const fenceMat = toon(0xf4e3c1);
  const fence = (x0: number, x1: number, z0: number, z1: number) => {
    addBox({ x0, x1, z0, z1, y0: -2, top: 1.2 });
    const len = Math.max(x1 - x0, z1 - z0), along = x1 - x0 > z1 - z0;
    const rail = mesh(new THREE.BoxGeometry(along ? len : 0.15, 0.18, along ? 0.15 : len), fenceMat); rail.position.set((x0 + x1) / 2, 0.95, (z0 + z1) / 2); scene.add(rail);
    const rail2 = rail.clone(); rail2.position.y = 0.5; scene.add(rail2);
    for (let i = 0; i <= len; i += 2.5) { const p = mesh(new THREE.BoxGeometry(0.25, 1.3, 0.25), fenceMat); p.position.set(along ? x0 + i : (x0 + x1) / 2, 0.6, along ? (z0 + z1) / 2 : z0 + i); scene.add(p); }
  };
  fence(BOUNDS.x0, -6, 1.8, 2.2); fence(6, BOUNDS.x1, 1.8, 2.2);
  const gate = textSprite('🏠 MY FARM', { size: 60, color: '#fff', bg: '#2e9e44', scale: 1.0 }); gate.position.set(0, 4.4, 2); scene.add(gate);
  for (const x of [-6.3, 6.3]) { const p = mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), toon(0x7a4a26)); p.position.set(x, 2.1, 2); scene.add(p); }

  // farm house
  { const body = mesh(new THREE.BoxGeometry(7, 4, 6), toon(0xfff1d6)); body.position.set(-22, 2, 20); scene.add(body);
    const roof = mesh(new THREE.ConeGeometry(5.6, 3, 4), toon(0xe0533d)); roof.position.set(-22, 5.5, 20); roof.rotation.y = Math.PI / 4; scene.add(roof);
    const door = mesh(new THREE.BoxGeometry(1.4, 2.2, 0.1), toon(0x8a5a30), false); door.position.set(-22, 1.1, 16.95); scene.add(door);
    addBox({ x0: -25.5, x1: -18.5, z0: 17, z1: 23, y0: -1, top: 4 }); }

  // mushrooms (bounce pads)
  const mush = (x: number, z: number, s = 1) => {
    const g0 = terrainH(x, z), top = g0 + 1.0 * s;
    addBox({ x0: x - 0.9 * s, x1: x + 0.9 * s, z0: z - 0.9 * s, z1: z + 0.9 * s, y0: g0 - 1, top, kind: 'mushroom' });
    const stem = mesh(new THREE.CylinderGeometry(0.35 * s, 0.45 * s, 0.9 * s, 10), toon(0xf6ead2)); stem.position.set(x, g0 + 0.45 * s, z); scene.add(stem);
    const cap = mesh(new THREE.SphereGeometry(1.0 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xff4d6d)); cap.position.set(x, g0 + 0.8 * s, z); cap.scale.y = 0.6; scene.add(cap);
    for (let i = 0; i < 5; i++) { const d = mesh(new THREE.SphereGeometry(0.14 * s, 8, 6), toon(0xffffff), false); const a = i * 1.26, rr = 0.55 * s; d.position.set(x + Math.cos(a) * rr, g0 + 0.8 * s + 0.42 * s, z + Math.sin(a) * rr); scene.add(d); }
  };
  mush(-6, -50); mush(2, -47); mush(-2, -60, 1.2); mush(10, -62); mush(24, -66); mush(-20, -120); mush(14, -142);

  // rocks
  const rock = (x: number, z: number, s: number) => { const g0 = terrainH(x, z); const r = mesh(new THREE.DodecahedronGeometry(s, 0), toon(0xa9b0b8)); r.position.set(x, g0 + s * 0.5, z); r.rotation.set(Math.random(), Math.random(), 0); scene.add(r); addBox({ x0: x - s * 0.8, x1: x + s * 0.8, z0: z - s * 0.8, z1: z + s * 0.8, y0: g0 - 1, top: g0 + s * 1.2 }); };
  rock(17, -18, 1.2); rock(-24, -48, 1.6); rock(26, -40, 1.4); rock(-12, -82, 1.3); rock(14, -88, 1.1); rock(-28, -130, 1.8); rock(18, -160, 1.5);

  // trees (instanced) around the edges and in clumps
  const trunks: THREE.Matrix4[] = [], crowns: THREE.Matrix4[] = [], crownCols: THREE.Color[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3();
  const tree = (x: number, z: number, s: number) => {
    const g0 = terrainH(x, z);
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g0 + 1 * s, z), q, s3.set(s, s, s)));
    crowns.push(new THREE.Matrix4().compose(new THREE.Vector3(x, g0 + 2.7 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)), s3.set(s * 1.25, s * 1.15, s * 1.25)));
    crownCols.push(new THREE.Color().setHSL(0.28 + Math.random() * 0.07, 0.6, 0.38 + Math.random() * 0.12));
    if (x > BOUNDS.x0 && x < BOUNDS.x1 && z > BOUNDS.z0 && z < BOUNDS.z1) addBox({ x0: x - 0.4 * s, x1: x + 0.4 * s, z0: z - 0.4 * s, z1: z + 0.4 * s, y0: g0 - 1, top: g0 + 4 * s });
  };
  for (let z = BOUNDS.z0 - 10; z < BOUNDS.z1 + 10; z += 5) { tree(BOUNDS.x0 - 3 - Math.random() * 6, z, 1.2 + Math.random() * 0.6); tree(BOUNDS.x1 + 3 + Math.random() * 6, z, 1.2 + Math.random() * 0.6); }
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 5) { tree(x, BOUNDS.z0 - 4 - Math.random() * 5, 1.4); tree(x + 2, BOUNDS.z1 + 4 + Math.random() * 3, 1.3); }
  for (const [x, z] of [[-34, -20], [-31, -64], [35, -100], [-36, -112], [36, -20], [-33, -160], [32, -150], [-16, -6], [24, -10], [-30, -88], [12, -112]]) tree(x, z, 1.3 + Math.random() * 0.5);
  const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 7), toon(0x8a5a30), trunks.length);
  trunks.forEach((m, i) => trunkI.setMatrixAt(i, m)); trunkI.castShadow = true; scene.add(trunkI);
  const crownI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), crowns.length);
  crowns.forEach((m, i) => { crownI.setMatrixAt(i, m); crownI.setColorAt(i, crownCols[i]); }); crownI.castShadow = true; scene.add(crownI);

  // flowers and grass tufts (instanced)
  const N = 900, fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshLambertMaterial(), N), tu = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.32, 4), lam(0x46b84a), N);
  const pal = ['#ff5d8f', '#ffd23f', '#ffffff', '#b46bff', '#ff8a1f'];
  for (let i = 0; i < N; i++) {
    const x = BOUNDS.x0 + Math.random() * 84, z = BOUNDS.z0 + Math.random() * 200, h = terrainH(x, z);
    const ok = h > -0.3 && roadDist(x, z) > 2.8;
    m4.compose(new THREE.Vector3(x, ok ? h + 0.25 : -50, z), q, s3.set(1, 1, 1)); fl.setMatrixAt(i, m4); fl.setColorAt(i, new THREE.Color(pal[i % 5]));
    const x2 = x + 1.3, z2 = z + 0.7, h2 = terrainH(x2, z2);
    m4.compose(new THREE.Vector3(x2, h2 > -0.3 ? h2 + 0.2 : -50, z2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0.15)), s3.set(1, 1 + Math.random(), 1)); tu.setMatrixAt(i, m4);
  }
  scene.add(fl, tu);

  // clouds
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) { const p = mesh(new THREE.SphereGeometry(2 + Math.random() * 1.6, 10, 8), toon(0xffffff), false); p.position.set(k * 2.4 - 3.6, Math.random() * 0.8, Math.random() * 1.2); g.add(p); }
    g.position.set(BOUNDS.x0 - 40 + Math.random() * 160, 26 + Math.random() * 12, BOUNDS.z0 - 20 + Math.random() * 230); scene.add(g); clouds.push(g);
  }
  return {
    ramp,
    update(t: number) {
      water.position.y = WATER_Y + Math.sin(t * 1.4) * 0.05;
      foam.forEach((f, i) => { f.position.x += 0.04; if (f.position.x > BOUNDS.x1 + 10) f.position.x = BOUNDS.x0 - 10; (f.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.3 * Math.sin(t * 2 + i); });
      boost.forEach((b, i) => ((b.material as THREE.MeshBasicMaterial).color.setHSL(0.14, 1, 0.5 + 0.3 * Math.sin(t * 8 - i))));
      clouds.forEach((c, i) => { c.position.x += 0.01 + i * 0.0006; if (c.position.x > 120) c.position.x = -120; });
    },
  };
}
