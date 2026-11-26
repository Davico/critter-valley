import * as THREE from 'three';
import { addBox, clouds, forest, mesh, rock, smooth, terrainH, terrainMesh, textSprite, toon, type Box } from '../world';
import { makeSnowWall } from '../models';
import type { Biome, NestDef } from './types';

// Snow Mountain: home at +Z, a frozen lake, a snow fort, then the mountain with the giant cake on top.
const BOUNDS = { x0: -40, x1: 40, z0: -172, z1: 30 };
export const LAKE = { z0: -60, z1: -38 };
export const FORT = { x: 16, z: -84, half: 5 };
export const TOP_Z = -140;
const NESTS: NestDef[] = [
  { x: -16, z: -20, snack: 'cookie', count: 3, guard: { kind: 'ram', size: 0.9, speed: 13 }, label: '🍪 COOKIES' },
  { x: FORT.x, z: FORT.z, snack: 'cocoa', count: 2, guard: { kind: 'ram', size: 1.2, speed: 14 }, label: '☕ COCOA · inside the snow fort' },
  { x: 0, z: -147, snack: 'cake', count: 1, guard: { kind: 'ram', size: 2.1, speed: 9 }, label: '🎂 GIANT CAKE · ride the 🛷 down!' },
];
const lakeEdge = (x: number) => 2.2 * Math.sin(x * 0.15) + 1.3 * Math.cos(x * 0.31 + 1);
const onLake = (x: number, z: number) => z < LAKE.z1 + lakeEdge(x) && z > LAKE.z0 - lakeEdge(x + 7);

function terrain(x: number, z: number): number {
  let h = 0.45 * Math.sin(x * 0.11 + 2) * Math.cos(z * 0.09) + 0.3 * Math.sin((x + z) * 0.07);
  h *= 1 - smooth(-4, 6, z);                                         // flat home
  h += 18 * smooth(-96, TOP_Z, z);                                   // the mountain
  if (z < -96 && z > TOP_Z + 2) h += 0.55 * Math.sin(x * 0.35) * Math.sin(z * 0.45) * smooth(-96, -104, z); // moguls on the slope
  h += 2.5 * Math.exp(-((x + 30) ** 2 + (z + 110) ** 2) / 120) + 3 * Math.exp(-((x - 32) ** 2 + (z + 118) ** 2) / 140);
  for (const n of NESTS) { const d = Math.hypot(x - n.x, z - n.z), k = 1 - smooth(4, 9, d); const target = n.snack === 'cake' ? 18 : 0.2; h = h * (1 - k) + target * k; }
  if (onLake(x, z)) h = -0.35; else { const d = Math.min(Math.abs(z - (LAKE.z1 + lakeEdge(x))), Math.abs(z - (LAKE.z0 - lakeEdge(x + 7)))); if (z < LAKE.z1 + 6 && z > LAKE.z0 - 6) h = Math.max(-0.35, h * smooth(0, 3, d) - 0.35 * (1 - smooth(0, 3, d))); }
  return h;
}

export interface SnowWall { box: Box; obj: THREE.Object3D }
export const walls: SnowWall[] = [];

function build(scene: THREE.Object3D) {
  walls.length = 0;
  const cSnow = new THREE.Color('#f7fbff'), cShade = new THREE.Color('#bcd3ec'), cIce = new THREE.Color('#6cc4f5'), cIce2 = new THREE.Color('#a6e2ff'), cRock = new THREE.Color('#b9c4cf');
  terrainMesh(scene, BOUNDS, (x, z, h, tmp) => {
    const n = 0.5 + 0.5 * Math.sin(x * 0.5) * Math.cos(z * 0.43);
    if (onLake(x, z)) { tmp.copy(cIce).lerp(cIce2, 0.5 + 0.5 * Math.sin(x * 0.9 + z * 0.4)); return; }
    tmp.copy(cSnow).lerp(cShade, Math.pow(n, 1.6) * 0.85);
    const slope = Math.abs(terrainH(x, z - 1) - terrainH(x, z + 1)); if (slope > 1.1) tmp.lerp(cRock, Math.min(0.6, (slope - 1.1) * 0.8));
  }, 1.4);
  // ice cracks and sparkles on the lake
  for (let i = 0; i < 40; i++) { const x = BOUNDS.x0 + Math.random() * 80, z = LAKE.z0 + 3 + Math.random() * 16; if (!onLake(x, z)) continue; const c = mesh(new THREE.PlaneGeometry(0.06, 1 + Math.random() * 2.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }), false); c.rotation.set(-Math.PI / 2, 0, Math.random() * 3); c.position.set(x, -0.33, z); scene.add(c); }
  const lakeSign = textSprite('🧊 SLIPPERY ICE!', { size: 50, bg: '#2f8fd8', scale: 0.9 }); lakeSign.position.set(-6, 3, LAKE.z1 + 6); scene.add(lakeSign);
  // home fence with a gate, the home basket sign
  const fenceMat = toon(0xc98a4f);
  for (const [x0, x1] of [[BOUNDS.x0, -6], [6, BOUNDS.x1]]) { addBox({ x0, x1, z0: 3.8, z1: 4.2, y0: -2, top: 1.2 }); const rail = mesh(new THREE.BoxGeometry(x1 - x0, 0.18, 0.15), fenceMat); rail.position.set((x0 + x1) / 2, 0.95, 4); scene.add(rail); const r2 = rail.clone(); r2.position.y = 0.5; scene.add(r2); for (let x = x0; x <= x1; x += 2.5) { const p = mesh(new THREE.BoxGeometry(0.25, 1.3, 0.25), fenceMat); p.position.set(x, 0.6, 4); scene.add(p); const cap = mesh(new THREE.SphereGeometry(0.2, 8, 6), toon(0xffffff), false); cap.position.set(x, 1.3, 4); scene.add(cap); } }
  const gate = textSprite('🏠 HOME', { size: 60, color: '#fff', bg: '#2e9e44', scale: 1.0 }); gate.position.set(0, 4.4, 4); scene.add(gate);
  for (const x of [-6.3, 6.3]) { const p = mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), toon(0x7a4a26)); p.position.set(x, 2.1, 4); scene.add(p); }
  // the snow fort: a ring of snow walls around the cocoa nest
  const H = 2.6, T = 1.1, F = FORT;
  const seg = (x0: number, x1: number, z0: number, z1: number) => { const g = makeSnowWall(x1 - x0, H, z1 - z0); g.position.set((x0 + x1) / 2, terrainH((x0 + x1) / 2, (z0 + z1) / 2) - 0.2, (z0 + z1) / 2); scene.add(g); const box = addBox({ x0, x1, z0, z1, y0: -2, top: H, kind: 'snowwall', obj: g }); walls.push({ box, obj: g }); };
  for (let i = 0; i < 4; i++) { const a = F.x - F.half + i * 2.5; seg(a, a + 2.5, F.z - F.half - T, F.z - F.half); seg(a, a + 2.5, F.z + F.half, F.z + F.half + T); }
  for (let i = 0; i < 4; i++) { const a = F.z - F.half + i * 2.5; seg(F.x - F.half - T, F.x - F.half, a, a + 2.5); seg(F.x + F.half, F.x + F.half + T, a, a + 2.5); }
  const fs = textSprite('❄️ Roll a BIG snowball to smash in!', { size: 46, bg: 'rgba(10,30,50,.6)', scale: 0.9 }); fs.position.set(F.x, 5.2, F.z + F.half + 3); scene.add(fs);
  const roll = textSprite('🌀 Roll on snow = bigger snowball', { size: 44, bg: 'rgba(10,30,50,.6)', scale: 0.8 }); roll.position.set(-4, 3, -70); scene.add(roll);
  // the top: flags and a sign for the sled run
  const top = textSprite('🛷 SLED RUN ↓', { size: 54, bg: '#e0533d', scale: 1.0 }); top.position.set(7, terrainH(7, -141) + 4, -141); scene.add(top);
  for (const [x, z] of [[-6, -98], [6, -110], [-5, -122], [7, -132]]) { const g0 = terrainH(x, z); const pole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 6), toon(0x2b3442)); pole.position.set(x, g0 + 1, z); scene.add(pole); const flag = mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshLambertMaterial({ color: 0xe0533d, side: THREE.DoubleSide }), false); flag.position.set(x + 0.4, g0 + 1.75, z); scene.add(flag); }
  // rocks, pines, snow drifts
  for (const [x, z, s] of [[24, -18, 1.3], [-28, -30, 1.6], [30, -72, 1.4], [-22, -88, 1.5], [-16, -126, 1.3], [20, -136, 1.4], [-30, -150, 1.8]]) rock(scene, x, z, s, 0x9aa6b2);
  const trees: [number, number, number][] = [];
  for (let z = BOUNDS.z0 - 10; z < BOUNDS.z1 + 10; z += 4.5) trees.push([BOUNDS.x0 - 2 - Math.random() * 6, z, 1.2 + Math.random() * 0.6], [BOUNDS.x1 + 2 + Math.random() * 6, z, 1.2 + Math.random() * 0.6]);
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 4.5) trees.push([x, BOUNDS.z0 - 3 - Math.random() * 4, 1.4], [x + 2, BOUNDS.z1 + 4 + Math.random() * 3, 1.3]);
  for (const [x, z] of [[-30, -8], [28, -6], [-12, -70], [32, -90], [-34, -96], [-14, -104], [12, -100], [2, -114], [-20, -118], [18, -122], [-8, -130], [26, -128], [-24, -140], [14, -150], [-14, -160], [24, -162], [-32, -60], [34, -30]]) trees.push([x, z, 1.1 + Math.random() * 0.5]);
  forest(scene, trees, BOUNDS, 'pine');
  for (let i = 0; i < 40; i++) { const x = BOUNDS.x0 + Math.random() * 80, z = BOUNDS.z0 + Math.random() * 190; if (onLake(x, z) || z > 4) continue; const d = mesh(new THREE.SphereGeometry(0.6 + Math.random() * 0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xf7fbff)); d.scale.y = 0.35; d.position.set(x, terrainH(x, z) - 0.05, z); scene.add(d); }
  const cl = clouds(scene, BOUNDS, 0xf2f6fb);
  // falling snow around the camera focus
  const N = 700, flakes = new Float32Array(N * 3); for (let i = 0; i < N; i++) { flakes[i * 3] = (Math.random() - 0.5) * 60; flakes[i * 3 + 1] = Math.random() * 25; flakes[i * 3 + 2] = (Math.random() - 0.5) * 60; }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  const pts = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.9, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
  return (t: number, f: THREE.Vector3) => {
    cl(t);
    pts.position.set(f.x, f.y - 5, f.z);
    const a = fg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) { let y = a.getY(i) - 0.035; if (y < 0) y += 25; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t + i) * 0.004); }
    a.needsUpdate = true;
  };
}

export const snow: Biome = {
  id: 'snow', name: 'Snow Mountain', bounds: BOUNDS, spawn: [0, 16, Math.PI],
  sky: ['#7fb8f0', '#eef6ff'], fog: '#eef6ff', fogNear: 55, fogFar: 170,
  terrain, surface: (x, z) => (onLake(x, z) ? 'ice' : 'snow'),
  isHome: (_x, z) => z > 4.5,
  noGo: (_x, z) => z > 2,
  nests: NESTS, vehicle: 'sled', vehicleAt: [0, -143, 0],
  tips(x, z, carrying) {
    if (z < LAKE.z1 + 4 && z > LAKE.z0 - 2) return ['ice', 'Ice is slippery! Steer early — or ROLL across fast.'];
    if (!carrying && Math.hypot(x - FORT.x, z - FORT.z) < 16) return ['fort', 'ROLL on the snow to grow a BIG snowball, then smash the fort wall!'];
    if (!carrying && z < TOP_Z + 4) return ['sled', 'Sit on the 🛷 sled (E / ✋) next to the cake, then ride DOWN the mountain!'];
    return null;
  },
  startTip: 'Brrr! Grab a 🍪 cookie from the grumpy ram — watch out, rams CHARGE!',
  portal: [0, 26],
  build,
};
