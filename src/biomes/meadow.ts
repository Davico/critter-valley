import * as THREE from 'three';
import { addBox, clouds, forest, groundAt, mesh, rock, segDist, smooth, terrainH, terrainMesh, textSprite, toon, lam } from '../world';
import type { Biome, NestDef } from './types';

// the meadow runs toward -Z, the farm (camp) is at +Z
export const RIVER_Z0 = -104, RIVER_Z1 = -95, RIVER_MID = -99.5;
export const WATER_Y = -1.0;
const BOUNDS = { x0: -42, x1: 42, z0: -176, z1: 26 };
export const BASE_Z = 2;            // z > BASE_Z is the farm
const BRIDGE = { x0: 28, x1: 34, z0: -108.5, z1: -90.5, top: 0.2 };
const NESTS: NestDef[] = [
  { x: -14, z: -34, snack: 'strawberry', count: 3, guard: { kind: 'hen', size: 1, speed: 6.6 }, label: '🍓 STRAWBERRIES' },
  { x: 17, z: -70, snack: 'honey', count: 2, guard: { kind: 'hen', size: 1.3, speed: 7.0 }, label: '🍯 HONEY' },
  { x: 0, z: -150, snack: 'melon', count: 1, guard: { kind: 'hen', size: 2.5, speed: 3.8 }, label: '🍉 GIANT MELON · use the 🛒' },
];
export const BUMPS = [-118, -128, -137];
const ROAD: [number, number][] = [[4, 0], [10, -30], [30, -60], [31, -90], [31, -110], [20, -130], [3, -146]];
export function roadDist(x: number, z: number) { let d = 1e9; for (let i = 0; i < ROAD.length - 1; i++) d = Math.min(d, segDist(x, z, ROAD[i][0], ROAD[i][1], ROAD[i + 1][0], ROAD[i + 1][1])); return d; }
export const PORTAL = { x: 18, z: 22 };

function terrain(x: number, z: number): number {
  let h = 0.9 * Math.sin(x * 0.08 + 1) * Math.cos(z * 0.06) + 0.55 * Math.sin((x - z) * 0.05) + 0.3 * Math.cos(x * 0.21 + z * 0.17);
  h += 3.2 * Math.exp(-((x + 2) ** 2 + (z + 55) ** 2) / 70);                // the mushroom hill
  h += 1.6 * Math.exp(-((x - 22) ** 2 + (z + 125) ** 2) / 60);
  h *= 1 - smooth(-8, 1, z);                                                // flat farm
  const rd = roadDist(x, z); h *= 0.25 + 0.75 * smooth(2.5, 6, rd);         // smoother cart road
  if (z < -110 && z > -142) { for (const bz of BUMPS) h += 0.45 * Math.exp(-((z - bz) ** 2) / 0.6) * (1 - smooth(3, 5, rd)); }
  for (const n of NESTS) { const d = Math.hypot(x - n.x, z - n.z), target = n.snack === 'melon' ? 2.2 : 0.3; const k = 1 - smooth(5, 11, d); h = h * (1 - k) + target * k; }
  const out = z > RIVER_Z1 ? z - RIVER_Z1 : z < RIVER_Z0 ? RIVER_Z0 - z : 0;
  const bank = smooth(0, 3, out); h = h * bank + -3.2 * (1 - bank);
  if (out > 0 && out < 3) h = Math.max(h, -3.2);
  return h;
}
const isRiver = (z: number) => z > RIVER_Z0 - 0.5 && z < RIVER_Z1 + 0.5;
const onBridge = (x: number, z: number) => x > BRIDGE.x0 && x < BRIDGE.x1 && z > BRIDGE.z0 && z < BRIDGE.z1;

function build(scene: THREE.Object3D) {
  const boost: THREE.Mesh[] = [];
  const cGrass = new THREE.Color('#5fcf52'), cGrass2 = new THREE.Color('#8be05c'), cDirt = new THREE.Color('#d9b071'), cSand = new THREE.Color('#f0d99a'), cBed = new THREE.Color('#5f8fa8'), cFarm = new THREE.Color('#79d65e');
  terrainMesh(scene, BOUNDS, (x, z, h, tmp) => {
    const n = 0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6) * Math.sin((x + z) * 0.31);
    tmp.copy(cGrass).lerp(cGrass2, n * 0.8);
    if (z > BASE_Z) tmp.lerp(cFarm, 0.5);
    const rd = roadDist(x, z); if (rd < 2.6) tmp.lerp(cDirt, 1 - smooth(1.6, 2.6, rd));
    if (h < -0.2) tmp.lerp(cSand, Math.min(1, -h * 1.2)); if (h < -1.4) tmp.copy(cBed);
  });
  const W = BOUNDS.x1 - BOUNDS.x0 + 30;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, RIVER_Z1 - RIVER_Z0 + 6), new THREE.MeshStandardMaterial({ color: '#3ab0ff', transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, WATER_Y, RIVER_MID); scene.add(water);
  const foam: THREE.Mesh[] = [];
  for (let i = 0; i < 26; i++) { const f = mesh(new THREE.CircleGeometry(0.4 + Math.random() * 0.5, 10), new THREE.MeshBasicMaterial({ color: '#e9f8ff', transparent: true, opacity: 0.7 }), false); f.rotation.x = -Math.PI / 2; f.position.set(BOUNDS.x0 + Math.random() * 84, WATER_Y + 0.02, RIVER_Z0 + 1 + Math.random() * 7); scene.add(f); foam.push(f); }
  // ramp to jump the river: a long slope and a steeper kicker at the end
  addBox({ x0: -5, x1: 1, z0: -92.4, z1: -80, y0: -4, top: 2.4, kind: 'ramp', ramp: { zFrom: -80, zTo: -92.4, h0: 0, h1: 2.4 } });
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
  for (const bz of BUMPS) { const x = bz > -130 ? 31 - (bz + 110) / -20 * 11 : 20 - (bz + 130) / -16 * 17; const sg = textSprite('🐢 SLOW!', { size: 44, color: '#fff', bg: '#e0621e', scale: 0.8 }); sg.position.set(x + 4, terrainH(x + 4, bz) + 2.2, bz); scene.add(sg); const post = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), toon(0x7a4a26)); post.position.set(x + 4, terrainH(x + 4, bz) + 0.9, bz); scene.add(post); }
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
  for (const [x, z, s] of [[17, -18, 1.2], [-24, -48, 1.6], [26, -40, 1.4], [-12, -82, 1.3], [14, -88, 1.1], [-28, -130, 1.8], [18, -160, 1.5]]) rock(scene, x, z, s);
  const trees: [number, number, number][] = [];
  for (let z = BOUNDS.z0 - 10; z < BOUNDS.z1 + 10; z += 5) { trees.push([BOUNDS.x0 - 3 - Math.random() * 6, z, 1.2 + Math.random() * 0.6], [BOUNDS.x1 + 3 + Math.random() * 6, z, 1.2 + Math.random() * 0.6]); }
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 5) trees.push([x, BOUNDS.z0 - 4 - Math.random() * 5, 1.4], [x + 2, BOUNDS.z1 + 4 + Math.random() * 3, 1.3]);
  for (const [x, z] of [[-34, -20], [-31, -64], [35, -100], [-36, -112], [36, -20], [-33, -160], [32, -150], [-16, -6], [24, -10], [-30, -88], [12, -112]]) trees.push([x, z, 1.3 + Math.random() * 0.5]);
  forest(scene, trees, BOUNDS, 'leaf');
  // flowers and grass tufts (instanced)
  const N = 900, fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshLambertMaterial(), N), tu = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.32, 4), lam(0x46b84a), N);
  const pal = ['#ff5d8f', '#ffd23f', '#ffffff', '#b46bff', '#ff8a1f'], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const x = BOUNDS.x0 + Math.random() * 84, z = BOUNDS.z0 + Math.random() * 200, h = terrainH(x, z);
    const ok = h > -0.3 && roadDist(x, z) > 2.8;
    m4.compose(new THREE.Vector3(x, ok ? h + 0.25 : -50, z), q, s3.set(1, 1, 1)); fl.setMatrixAt(i, m4); fl.setColorAt(i, new THREE.Color(pal[i % 5]));
    const x2 = x + 1.3, z2 = z + 0.7, h2 = terrainH(x2, z2);
    m4.compose(new THREE.Vector3(x2, h2 > -0.3 ? h2 + 0.2 : -50, z2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0.15)), s3.set(1, 1 + Math.random(), 1)); tu.setMatrixAt(i, m4);
  }
  scene.add(fl, tu);
  const cl = clouds(scene, BOUNDS);
  return (t: number, _f: THREE.Vector3) => {
    water.position.y = WATER_Y + Math.sin(t * 1.4) * 0.05;
    foam.forEach((f, i) => { f.position.x += 0.04; if (f.position.x > BOUNDS.x1 + 10) f.position.x = BOUNDS.x0 - 10; (f.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.3 * Math.sin(t * 2 + i); });
    boost.forEach((b, i) => ((b.material as THREE.MeshBasicMaterial).color.setHSL(0.14, 1, 0.5 + 0.3 * Math.sin(t * 8 - i))));
    cl(t);
  };
}

export const meadow: Biome = {
  id: 'valley', name: 'Sunny Meadow', bounds: BOUNDS, spawn: [0, 7, Math.PI],
  sky: ['#3d9ef9', '#bfeaff'], fog: '#bfeaff', fogNear: 70, fogFar: 190,
  terrain, surface: () => 'grass',
  isHome: (_x, z) => z > -1.5,
  noGo: (_x, z) => z > -3,
  nests: NESTS, vehicle: 'cart', vehicleAt: [7, -4, Math.PI],
  water: { y: WATER_Y, isWater: (_x, z) => isRiver(z), onBridge },
  route(from, to) {
    const hs = from.z > RIVER_MID, ts = to.z > RIVER_MID;
    if (hs === ts) return to;
    const nearEnd = new THREE.Vector3(31, 0, hs ? -89.5 : -109.5), farEnd = new THREE.Vector3(31, 0, hs ? -110 : -89);
    return onBridge(from.x, from.z) || Math.hypot(from.x - nearEnd.x, from.z - nearEnd.z) < 1.5 ? farEnd : nearEnd;
  },
  boost: (x, z) => (x > -5 && x < 1 && z < -79 && z > -83.5 ? [0, -1] : null),
  tips(x, z, carrying) {
    if (z < -70 && z > -84 && x > -10 && x < 6) return ['ramp', 'ROLL (SHIFT / 🌀) over the yellow arrows, then JUMP at the top!'];
    if (!carrying && z < -120) return ['giant', 'The giant melon is too heavy — bring the 🛒 cart over the bridge!'];
    return null;
  },
  portal: [PORTAL.x, PORTAL.z],
  startTip: 'Grab a 🍓 from the grumpy hen and bring it home!  (WASD / joystick)',
  build,
};
