import * as THREE from 'three';
import { BOXES, groundAt, pushOut, removeBox, setTerrain, surfaceAt, terrainH, textSprite, toon, mesh, type Box, type Surface } from './world';
import { makeCart, makeHen, makeHero, makeNest, makePad, makePantry, makePortal, makeRam, makeSled, makeTreadmill, type HenMesh, type RamMesh } from './models';
import { sfx } from './audio';
import { S, save, addPantry } from './save';
import { burst, floatText, hint, hud, say, card, shock, updateFx, setFxScene } from './fx';
import { buddyIs, build, initCamp, pantryPos, updateCamp, friendsCount, ride, rideDef, buddyCritter } from './camp';
import { BIOMES, type Biome } from './biomes';
import { BUMPS, roadDist } from './biomes/meadow';
import { walls } from './biomes/snow';
import type { NestDef } from './biomes/types';
import { SNACKS, SNACK_R, FOOD_ICON, type Size } from './snacks';

export interface Input { x: number; y: number; jump: boolean; jumpHeld?: boolean; roll: boolean; act: boolean }
const V3 = THREE.Vector3;
const G = 26;
const TIERS = [1, 2, 3.5, 6], TIER_COST = [0, 60, 250, 800];
const TREAD = { x: 16, z: 12 };
export const SNOW_UNLOCK = 3;

// ---------------- entities ----------------
interface Snack { def: NestDef; size: Size; gold: boolean; nest: number; slot: number; state: 'nest' | 'held' | 'cart' | 'loose' | 'fly' | 'gone'; pos: THREE.Vector3; vel: THREE.Vector3; m: THREE.Group; t: number; from?: THREE.Vector3 }
interface Guard {
  kind: 'hen' | 'ram'; nest: number; size: number; speed: number; home: THREE.Vector3; pos: THREE.Vector3; yaw: number;
  state: 'idle' | 'chase' | 'back' | 'aim' | 'charge' | 'stun' | 'rest'; t: number; cd: number; flapT: number; stompT: number; wanderT: number; wander: THREE.Vector3;
  hen?: HenMesh; ram?: RamMesh; root: THREE.Group; bangT: number; walkPh: number; startle: number; dir: THREE.Vector3;
}

let scene: THREE.Scene, camera: THREE.PerspectiveCamera, onArea: (b: Biome) => void = () => {};
let biome: Biome = BIOMES.valley, decoUpdate: (t: number, f: THREE.Vector3) => void = () => {};
const snacks: Snack[] = [], guards: Guard[] = [];
const respawns: { nest: number; slot: number; t: number }[] = [];
const hero = makeHero(); hero.root.userData.keep = true;
const peek = hero.ball.children[1] as THREE.Group;
const snowShell = mesh(new THREE.SphereGeometry(0.66, 20, 14), toon(0xf7fbff)); snowShell.visible = false; hero.spin.add(snowShell);
const P = { pos: new V3(0, 0, 7), vel: new V3(), face: Math.PI, grounded: true, rolling: false, dizzy: 0, carry: null as Snack | null, shield: false, safe: new V3(0, 0, 7), safeT: 0, onTread: false, coyote: 0, jumpBuf: 0, squash: 0, walkPh: 0, pushing: false, wasRoll: false, snow: 0, surface: 'grass' as Surface, sled: false };
const cart = { pos: new V3(), vel: new V3(), yaw: Math.PI, grounded: true, air: 0, held: false, idle: 0, snack: null as Snack | null, on: false, ...makeCart() };
const sled = { pos: new V3(), speed: 0, yaw: Math.PI, vy: 0, grounded: true, snack: null as Snack | null, on: false, park: new V3(), idle: 0, backT: 0, ...makeSled() };
let tread: ReturnType<typeof makeTreadmill> | null = null, treadPad: THREE.Group | null = null, treadLabel: THREE.Sprite | null = null;
let portal: { root: THREE.Group; swirl: THREE.Mesh; lock: THREE.Sprite; to: Biome['id']; at: THREE.Vector3 } | null = null;
let dropAt = new V3();
let padLatch = '', portalLatch = true;
let camYaw = 0, dragT = 0, shake = 0, time = 0;
const dizzyStars = textSprite('★ ★', { size: 60, color: '#fff36b', scale: 0.5 });

// ---------------- helpers ----------------
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
function angleLerp(a: number, b: number, t: number) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
function slotPos(n: number, slot: number): THREE.Vector3 {
  const N = biome.nests[n], sz = SNACKS[N.snack].size === 'b' ? 2 : 1, a = (slot / N.count) * Math.PI * 2, r = N.count > 1 ? 0.65 * sz : 0;
  return new V3(N.x + Math.cos(a) * r, terrainH(N.x, N.z) + 0.2 * sz, N.z + Math.sin(a) * r);
}
function gradAt(x: number, z: number, y: number) { const e = 0.3; return { gx: (groundAt(x + e, z, y).g - groundAt(x - e, z, y).g) / (2 * e), gz: (groundAt(x, z + e, y).g - groundAt(x, z - e, y).g) / (2 * e) }; }
const atHome = (x: number, z: number) => biome.isHome(x, z);
const inValley = () => biome.id === 'valley';
const isWater = (x: number, z: number) => !!biome.water && biome.water.isWater(x, z) && !biome.water.onBridge(x, z);

// ---------------- area loading ----------------
function spawnSnack(n: number, slot: number) {
  const N = biome.nests[n], size = SNACKS[N.snack].size, gold = Math.random() < (size === 'b' ? 0.2 : 0.1);
  const e: Snack = { def: N, size, gold, nest: n, slot, state: 'nest', pos: slotPos(n, slot), vel: new V3(), m: SNACKS[N.snack].make(gold), t: 0 };
  e.m.position.copy(e.pos); e.m.rotation.y = Math.random() * 6; scene.add(e.m); snacks.push(e);
  if (gold) { const sp = textSprite('✨ GOLDEN', { size: 46, color: '#fff3a0', scale: 0.6 }); sp.position.set(0, SNACK_R[size] * 2.6 + 0.5, 0); e.m.add(sp); }
}
function spawnGuard(N: NestDef, n: number) {
  const { kind, size, speed } = N.guard;
  const home = new V3(N.x + 1.2 * size, 0, N.z - 2.4 * size); home.y = terrainH(home.x, home.z);
  let root: THREE.Group, hen: HenMesh | undefined, ram: RamMesh | undefined;
  if (kind === 'hen') { hen = makeHen(size, size > 2 ? 0xa0673a : size > 1.1 ? 0xfff3e6 : 0xffffff); root = hen.root; } else { ram = makeRam(size); root = ram.root; }
  scene.add(root);
  guards.push({ kind, nest: n, size, speed, home, pos: home.clone(), yaw: 0, state: 'idle', t: 0, cd: 0, flapT: 0, stompT: 1.5, wanderT: 0, wander: home.clone(), hen, ram, root, bangT: 0, walkPh: 0, startle: 0, dir: new V3() });
}
export function loadArea(id: Biome['id'], arriving = false) {
  for (const o of [...scene.children]) if (!o.userData.keep) { scene.remove(o); o.traverse((c) => { const g = (c as THREE.Mesh).geometry; if (g && g.attributes?.position?.count > 5000) g.dispose(); }); }
  BOXES.length = 0; snacks.length = 0; guards.length = 0; respawns.length = 0;
  biome = BIOMES[id]; S.area = id; setTerrain(biome.terrain, biome.surface);
  decoUpdate = biome.build(scene);
  scene.add(hero.root);
  biome.nests.forEach((N, n) => {
    const big = SNACKS[N.snack].size === 'b';
    const nest = makeNest(big ? 2 : 1); nest.position.set(N.x, terrainH(N.x, N.z), N.z); scene.add(nest);
    for (let i = 0; i < N.count; i++) spawnSnack(n, i);
    spawnGuard(N, n);
    const lbl = textSprite(N.label, { size: 44, scale: 0.9, bg: 'rgba(0,0,0,.45)' }); lbl.position.set(N.x, terrainH(N.x, N.z) + (big ? 6 : 3.4), N.z); scene.add(lbl);
  });
  // vehicles
  cart.on = biome.vehicle === 'cart'; sled.on = biome.vehicle === 'sled'; cart.snack = sled.snack = null; P.sled = false; cart.held = false;
  const [vx, vz, vyaw] = biome.vehicleAt;
  if (cart.on) { cart.pos.set(vx, terrainH(vx, vz), vz); cart.vel.set(0, 0, 0); cart.yaw = vyaw; scene.add(cart.root); }
  if (sled.on) { sled.park.set(vx, terrainH(vx, vz), vz); sled.pos.copy(sled.park); sled.speed = 0; sled.yaw = vyaw; scene.add(sled.root); }
  // home
  tread = treadPad = treadLabel = null;
  if (inValley()) {
    tread = makeTreadmill(); tread.root.position.set(TREAD.x, 0, TREAD.z); scene.add(tread.root);
    const ts = textSprite('🏃 TRAINING', { size: 52, scale: 1, bg: '#e0621e' }); ts.position.set(TREAD.x, 3.2, TREAD.z - 2.4); scene.add(ts);
    treadPad = makePad(0xe0621e); treadPad.position.set(TREAD.x + 4, 0, TREAD.z + 3); scene.add(treadPad);
    refreshPadLabels();
    initCamp(scene, P, true); dropAt = pantryPos.clone();
  } else {
    const stall = makePantry(); stall.position.set(-10, 0, 10); scene.add(stall);
    BOXES.push({ x0: -11.6, x1: -8.4, z0: 9.2, z1: 10.8, y0: -1, top: 1 });
    dropAt = new V3(-10, 1.2, 10);
    initCamp(scene, P, false);
  }
  // portal
  const [px, pz] = biome.portal, to: Biome['id'] = inValley() ? 'snow' : 'valley';
  const pm = makePortal(to === 'snow' ? 0x9fdcff : 0x7dff8a, to === 'snow' ? '❄️ SNOW MOUNTAIN' : '🌼 BACK TO THE VALLEY');
  pm.root.position.set(px, terrainH(px, pz), pz); pm.root.rotation.y = -Math.PI / 2; scene.add(pm.root);
  portal = { ...pm, to, at: new V3(px, 0, pz) };
  for (const s of [-1, 1]) BOXES.push({ x0: px - 0.4, x1: px + 0.4, z0: pz + s * 2.2 - 0.4, z1: pz + s * 2.2 + 0.4, y0: -1, top: 4.2 });
  // player
  const [sx, sz, sf] = biome.spawn;
  if (arriving) { P.pos.set(px - 3.5, 0, pz); P.face = -Math.PI / 2; }
  else { P.pos.set(sx, 0, sz); P.face = sf; }
  P.pos.y = groundAt(P.pos.x, P.pos.z, 50).g; P.vel.set(0, 0, 0); P.carry = null; P.snow = 0; P.safe.copy(P.pos); P.dizzy = 0; portalLatch = true;
  camYaw = P.face + Math.PI; camera.position.set(P.pos.x + Math.sin(camYaw) * 9.5, P.pos.y + 6, P.pos.z + Math.cos(camYaw) * 9.5);
  S.area = id;
  if (!S.visited.includes(id)) { S.visited.push(id); if (id === 'snow') card('❄️ SNOW MOUNTAIN!', 'New snacks, new friends — and new blocks for your camp', false); }
  save();
  onArea(biome);
  if (!inValley() && arriving) { const b = buddyCritter(); say(b ? `${b.def.icon} ${b.def.name} came along! Your other friends and the treadmill wait at home in the valley.` : 'Your friends and the treadmill wait at home in the valley. Tip: pick a buddy (E near a friend) to bring one along!', 5); }
  else hint(`start-${id}`, biome.startTip, true);
}
export function init(sc: THREE.Scene, cam: THREE.PerspectiveCamera, areaCb: (b: Biome) => void) {
  scene = sc; camera = cam; setFxScene(sc); onArea = areaCb;
  hero.root.add(dizzyStars); dizzyStars.position.y = 2.1; dizzyStars.visible = false;
  loadArea(S.area === 'snow' ? 'snow' : 'valley');
}
function refreshPadLabels() {
  if (!treadPad) return; if (treadLabel) scene.remove(treadLabel);
  const t = S.tier + 1 < TIERS.length ? `⚡ Faster treadmill: ${TIER_COST[S.tier + 1]} 🪙` : '⚡ Treadmill MAX';
  treadLabel = textSprite(t, { size: 44, scale: 0.6, bg: 'rgba(0,0,0,.55)' }); treadLabel.position.set(TREAD.x + 4, 2.2, TREAD.z + 3); scene.add(treadLabel);
}

// ---------------- snacks ----------------
function popSnack(e: Snack, dir: THREE.Vector3, power = 4) {
  e.state = 'loose'; e.t = 0; e.vel.set(dir.x * power + rnd(-1, 1), 6, dir.z * power + rnd(-1, 1));
  if (P.carry === e) P.carry = null; if (cart.snack === e) cart.snack = null; if (sled.snack === e) sled.snack = null;
  e.m.visible = true; sfx.drop();
}
function backToNest(e: Snack) {
  burst(e.pos.clone().add(new V3(0, 0.5, 0)), [0xffffff, 0xdddddd], 10, 3, 3, true);
  e.state = 'nest'; e.pos.copy(slotPos(e.nest, e.slot)); e.vel.set(0, 0, 0); e.m.visible = true; e.m.rotation.set(0, e.m.rotation.y, 0);
  if (P.carry === e) P.carry = null; if (cart.snack === e) cart.snack = null; if (sled.snack === e) sled.snack = null;
}
function deliver(e: Snack) {
  e.state = 'fly'; e.t = 0; e.from = e.pos.clone(); e.m.visible = true;
  if (P.carry === e) P.carry = null; if (cart.snack === e) cart.snack = null; if (sled.snack === e) { sled.snack = null; sled.backT = 3; }
  respawns.push({ nest: e.nest, slot: e.slot, t: 10 });
}
function arrive(e: Snack) {
  e.state = 'gone'; scene.remove(e.m);
  const f = e.gold ? 'gold' : e.def.snack; addPantry(f, 1); S.delivered++;
  if (buddyIs('hen')) S.coins += 2;
  sfx.place(); burst(dropAt.clone().add(new V3(0, 0.6, 0)), [0xffd23f, 0xffffff, 0x7dff8a], 18, 3, 5);
  floatText(dropAt.clone().add(new V3(0, 2.2, 0)), `+1 ${FOOD_ICON[f]}`, '#7dff8a', 1);
  hint('placed', inValley() ? 'Yum! Snacks go to your 🧺 Pantry. Animals come to eat them — wait and see!' : 'Sent home to your 🧺 Pantry! Animals in your camp will love it.');
  save();
}
function updateSnacks(dt: number) {
  for (let i = snacks.length - 1; i >= 0; i--) if (snacks[i].state === 'gone') snacks.splice(i, 1);
  for (const e of snacks) {
    if (e.state === 'nest') { e.m.position.copy(e.pos); e.m.rotation.z = Math.sin(time * 2 + e.slot) * 0.05; continue; }
    if (e.state === 'held') {
      if (P.rolling) e.m.visible = false; else { e.m.visible = true; hero.hold.getWorldPosition(e.pos); e.pos.y -= SNACK_R[e.size] * 0.6; e.m.position.copy(e.pos); e.m.rotation.set(Math.sin(time * 9) * 0.08 * (P.vel.length() > 1 ? 1 : 0), P.face, 0); }
      continue;
    }
    if (e.state === 'cart') {
      const inCart = cart.snack === e, seat = inCart ? cart.seat : sled.seat, root = inCart ? cart.root : sled.root;
      seat.getWorldPosition(e.pos); e.pos.y -= inCart ? 0.6 : 0.1;
      e.m.position.copy(e.pos); e.m.rotation.set(root.rotation.x, root.rotation.y, root.rotation.z); continue;
    }
    if (e.state === 'fly') {
      e.t = Math.min(1, e.t + dt * 1.6); const k = e.t; e.pos.lerpVectors(e.from!, dropAt, k); e.pos.y += Math.sin(k * Math.PI) * 4; e.m.position.copy(e.pos); e.m.scale.setScalar(1 - k * 0.5); e.m.rotation.y += dt * 8;
      if (e.t >= 1) arrive(e); continue;
    }
    if (e.state === 'loose') {
      e.t += dt; const r = SNACK_R[e.size];
      e.vel.y -= G * dt; e.pos.addScaledVector(e.vel, dt);
      const p = { x: e.pos.x, z: e.pos.z }; const hit = pushOut(p, e.pos.y, r * 0.8, r * 2); if (hit) { const vn = e.vel.x * hit.nx + e.vel.z * hit.nz; if (vn < 0) { e.vel.x -= 1.5 * vn * hit.nx; e.vel.z -= 1.5 * vn * hit.nz; } } e.pos.x = p.x; e.pos.z = p.z;
      const gnd = groundAt(e.pos.x, e.pos.z, e.pos.y + 0.3);
      if (e.pos.y <= gnd.g) {
        e.pos.y = gnd.g; e.vel.y = Math.abs(e.vel.y) > 2.5 ? -e.vel.y * 0.3 : 0;
        const gr = gradAt(e.pos.x, e.pos.z, e.pos.y + 0.3); e.vel.x += -gr.gx * G * 0.35 * dt; e.vel.z += -gr.gz * G * 0.35 * dt;
        const fr = surfaceAt(e.pos.x, e.pos.z, gnd.box) === 'ice' ? 0.3 : 2.2; e.vel.x *= 1 - Math.min(1, fr * dt); e.vel.z *= 1 - Math.min(1, fr * dt);
      }
      const B = biome.bounds; e.pos.x = Math.max(B.x0, Math.min(B.x1, e.pos.x)); e.pos.z = Math.max(B.z0, Math.min(B.z1, e.pos.z));
      e.m.position.copy(e.pos); e.m.rotation.x += Math.hypot(e.vel.x, e.vel.z) * dt / r;
      if (biome.water && e.pos.y < biome.water.y - 0.4) { burst(new V3(e.pos.x, biome.water.y, e.pos.z), [0xbfe9ff, 0xffffff], 12, 3, 6); sfx.splash(); backToNest(e); }
      else if (e.t > 12 && flat(e.pos, P.pos) > 6) backToNest(e);
      else if (atHome(e.pos.x, e.pos.z) && e.size !== 'b' && e.t > 0.6) deliver(e);
    }
  }
  for (let i = respawns.length - 1; i >= 0; i--) { const r = respawns[i]; r.t -= dt; if (r.t <= 0) { respawns.splice(i, 1); if (!snacks.some((e) => e.nest === r.nest && e.slot === r.slot && e.state !== 'gone' && e.state !== 'fly')) spawnSnack(r.nest, r.slot); } }
  // vehicles scoop up the giant snack
  const veh = cart.on ? cart : sled.on ? sled : null;
  if (veh && !veh.snack && (!sled.on || P.sled)) for (const e of snacks) if (e.size === 'b' && (e.state === 'nest' || (e.state === 'loose' && e.t > 0.5)) && flat(e.pos, veh.pos) < (sled.on ? 4.2 : 2.4)) {
    veh.snack = e; e.state = 'cart'; sfx.grab(); floatText(e.pos.clone().add(new V3(0, 3, 0)), sled.on ? 'On the sled!' : 'Into the cart!', '#7dff8a');
    hint(sled.on ? 'sledgo' : 'cartgo', sled.on ? 'Now ride DOWN! Steer around the trees — crash and the cake falls off!' : 'Turn around and push the cart HOME! Slow down on the bumps!', true); break;
  }
  // pick up
  if (P.dizzy <= 0 && !P.carry && !P.sled) {
    for (const e of snacks) {
      if (e.state !== 'nest' && e.state !== 'loose') continue;
      const d = flat(e.pos, P.pos), reach = SNACK_R[e.size] + 0.9 + P.snow * 0.6;
      if (d > reach || Math.abs(e.pos.y - P.pos.y) > 2.5) continue;
      if (e.state === 'loose' && e.t < 0.5) continue;
      if (e.size === 'b') { hint('heavy', sled.on ? 'Too heavy to carry! Sit on the 🛷 sled next to it.' : 'Too heavy to carry! Bring the 🛒 cart from the farm gate.', true); continue; }
      P.carry = e; e.state = 'held'; sfx.grab(); hint('run', 'RUN HOME!  Hold SHIFT / 🌀 to roll faster!');
      break;
    }
  }
  if (P.carry && atHome(P.pos.x, P.pos.z)) deliver(P.carry);
  if (cart.on && cart.snack && atHome(cart.pos.x, cart.pos.z + 0.5)) deliver(cart.snack);
  if (sled.on && sled.snack && atHome(sled.pos.x, sled.pos.z)) deliver(sled.snack);
}

// ---------------- player ----------------
function smashWall(b: Box) {
  const w = walls.find((x) => x.box === b); removeBox(b); if (w) w.obj.visible = false;
  const c = new V3((b.x0 + b.x1) / 2, 1.2, (b.z0 + b.z1) / 2);
  burst(c, [0xffffff, 0xe3f1fb, 0xcfe3f2], 40, 6, 8, true); sfx.stomp(); shake = 0.35; P.snow = Math.max(0, P.snow - 0.3);
  floatText(c.clone().add(new V3(0, 2, 0)), 'SMASH!', '#ffffff', 1.1); hint('smash', 'SMASH! Grab the cocoa and roll home!', true);
}
function knock(from: THREE.Vector3, power: number, popPower = 3) {
  const away = new V3(P.pos.x - from.x, 0, P.pos.z - from.z).normalize();
  if (ride.on) { ride.on = false; floatText(P.pos.clone().add(new V3(0, 2.4, 0)), 'Whoa!', '#ffffff'); }
  if (P.sled) { P.sled = false; if (sled.snack) popSnack(sled.snack, away, 2); sled.speed = 0; }
  P.vel.set(away.x * power, 7, away.z * power); P.grounded = false; P.dizzy = 0.9;
  if (P.carry) popSnack(P.carry, away, popPower);
}
function updatePlayer(dt: number, inp: Input) {
  const rd = ride.on ? rideDef() : null;
  const lvlSpd = 0.22 * S.lvl, fast = buddyIs('fox') ? 1.1 : buddyIs('leopard') ? 1.15 : 1;
  P.rolling = inp.roll && P.dizzy <= 0 && !P.onTread && !rd;
  if (P.rolling && !P.wasRoll) sfx.roll();
  if (!P.rolling && P.wasRoll && P.snow > 0.08) { burst(P.pos.clone().add(new V3(0, 0.8, 0)), [0xffffff, 0xe3f1fb], 14 + P.snow * 20, 3, 4, true); sfx.drop(); P.snow = 0; }
  P.wasRoll = P.rolling;
  const carryMul = P.carry && !buddyIs('raccoon') && !rd ? (P.carry.size === 's' ? 0.92 : 0.8) : 1;
  let max = P.rolling ? (9.6 + lvlSpd * 1.3) * (P.carry ? 0.95 : 1) * fast : (6.0 + lvlSpd) * carryMul * fast;
  if (rd) max = (6.0 + lvlSpd) * rd.speed;
  if (P.pushing) max *= 0.85;
  const fwd = new V3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), right = new V3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  const wish = fwd.multiplyScalar(inp.y).add(right.multiplyScalar(inp.x)); if (wish.length() > 1) wish.normalize();
  if (P.dizzy > 0) { P.dizzy -= dt; wish.set(0, 0, 0); }
  const here = groundAt(P.pos.x, P.pos.z, P.pos.y);
  P.surface = surfaceAt(P.pos.x, P.pos.z, here.box);
  const slip = P.surface === 'ice' && !buddyIs('penguin') && !(rd && ride.type === 'yak');
  // treadmill
  P.onTread = !!tread && P.grounded && Math.abs(P.pos.x - TREAD.x) < 1.2 && Math.abs(P.pos.z - TREAD.z) < 2.3 && wish.length() > 0.2 && !P.carry && !rd;
  hud.onTread = P.onTread;
  if (P.onTread && tread) {
    P.pos.x += (TREAD.x - P.pos.x) * Math.min(1, 8 * dt); P.pos.z += (TREAD.z - P.pos.z) * Math.min(1, 8 * dt); P.vel.x = P.vel.z = 0; P.face = Math.PI; P.walkPh += dt * 22;
    tread.belt.offset.y -= dt * 3 * TIERS[S.tier];
    S.xp += dt * TIERS[S.tier]; const need = 5 + S.lvl * 1.5; hud.treadXp = S.xp / need;
    if (S.xp >= need && S.lvl < 40) { S.xp = 0; S.lvl++; sfx.level(); floatText(P.pos.clone().add(new V3(0, 2.6, 0)), `SPEED ${S.lvl}!`, '#7dff8a', 1); save(); }
    hint('tread', 'Keep running to train your speed!');
  } else {
    const hv = new THREE.Vector2(P.vel.x, P.vel.z);
    if (!P.rolling) {
      const acc = P.grounded ? (slip ? 3 : 45) : 14, tx = wish.x * max, tz = wish.z * max, dx = tx - hv.x, dz = tz - hv.y, dl = Math.hypot(dx, dz), stepA = acc * dt;
      if (dl <= stepA) hv.set(tx, tz); else { hv.x += (dx / dl) * stepA; hv.y += (dz / dl) * stepA; }
      if (slip) hint('slip', 'Wheee — ice is slippery! Steer early.');
    } else {
      const acc = P.grounded ? (slip ? 9 : 18) : 6; hv.x += wish.x * acc * dt; hv.y += wish.z * acc * dt;
      if (P.grounded) {
        const gr = gradAt(P.pos.x, P.pos.z, P.pos.y); const along = gr.gx * hv.x + gr.gz * hv.y; const k = along > 0 ? 0.25 : 0.9;
        hv.x += -gr.gx * G * k * dt; hv.y += -gr.gz * G * k * dt;
        if (wish.length() < 0.1) hv.multiplyScalar(1 - Math.min(1, (slip ? 0.15 : 1.6) * dt));
      }
      const sp = hv.length(), cap = max * (P.grounded ? 1.5 : 1.6); if (sp > max && wish.length() > 0.1) { const over = hv.clone().normalize(); if (over.x * wish.x + over.y * wish.z > 0) hv.addScaledVector(new THREE.Vector2(wish.x, wish.z), -acc * dt); }
      if (sp > cap) hv.multiplyScalar(cap / sp);
      const bd = biome.boost?.(P.pos.x, P.pos.z);
      if (P.grounded && bd && hv.x * bd[0] + hv.y * bd[1] > 0) { const s = Math.max(14, hv.length()); hv.set(hv.x * 0.3 + bd[0] * s * 0.95, hv.y * 0.3 + bd[1] * s * 0.95); if (Math.random() < 0.4) burst(P.pos.clone().add(new V3(0, 0.3, 0)), [0xffe066, 0xffffff], 2, 2, 2); }
      // the snowball grows while rolling on snow
      if (P.grounded && P.surface === 'snow' && sp > 2.5) { const before = P.snow; P.snow = Math.min(1, P.snow + sp * dt * 0.03 * (buddyIs('arcticfox') ? 2 : 1)); if (before < 0.55 && P.snow >= 0.55) { sfx.level(); floatText(P.pos.clone().add(new V3(0, 3, 0)), 'BIG SNOWBALL!', '#ffffff', 0.9); } }
    }
    P.vel.x = hv.x; P.vel.z = hv.y;
    const p = { x: P.pos.x + P.vel.x * dt, z: P.pos.z + P.vel.z * dt };
    const hit = pushOut(p, P.pos.y, 0.45 + (P.rolling ? P.snow * 0.7 : 0));
    if (hit) {
      const vn = P.vel.x * hit.nx + P.vel.z * hit.nz;
      if (hit.box.kind === 'snowwall' && P.rolling && P.snow >= 0.55 && -vn > 4) smashWall(hit.box);
      else if (vn < 0) {
        if (hit.box.kind === 'snowwall') hint('wallsmall', P.rolling ? 'Your snowball is too small! Roll more on the snow.' : 'Roll into a BIG snowball to smash the wall!', true);
        const k = P.rolling ? 1.35 : 1; P.vel.x -= k * vn * hit.nx; P.vel.z -= k * vn * hit.nz;
        if (P.rolling && -vn > 6) { shake = 0.25; sfx.drop(); if (P.carry && -vn > 8 && !atHome(P.pos.x, P.pos.z)) { popSnack(P.carry, new V3(hit.nx, 0, hit.nz), 3); say('BONK! The snack flew out of your shell!'); } }
      }
    }
    const B = biome.bounds; P.pos.x = Math.max(B.x0 + 0.5, Math.min(B.x1 - 0.5, p.x)); P.pos.z = Math.max(B.z0 + 0.5, Math.min(B.z1 - 0.5, p.z));
  }
  // vertical
  if (inp.jump) P.jumpBuf = 0.13; else P.jumpBuf -= dt;
  P.coyote = P.grounded ? 0.1 : P.coyote - dt;
  const { g, box } = groundAt(P.pos.x, P.pos.z, P.pos.y);
  const jumpV = rd ? rd.jump : buddyIs('bunny') ? 11.5 : buddyIs('leopard') ? 11 : 9.5;
  if (P.jumpBuf > 0 && P.coyote > 0 && P.dizzy <= 0) {
    P.vel.y = Math.max(P.vel.y, 0) + jumpV; P.grounded = false; P.coyote = 0; P.jumpBuf = 0; sfx.jump(); P.squash = -0.15;
  } else if (P.grounded) {
    const follow = (g - P.pos.y) / dt;
    if (follow < P.vel.y - G * dt * 1.6 && P.pos.y - g > 0.05) P.grounded = false;
    else { P.vel.y = Math.max(-20, Math.min(20, follow)); P.pos.y = g; }
  }
  if (!P.grounded) {
    P.vel.y -= G * dt;
    if (buddyIs('owl') && inp.jumpHeld && P.vel.y < -2.5) { P.vel.y = -2.5; hint('glide', 'Hold JUMP to glide with your owl friend!'); }
    P.pos.y += P.vel.y * dt;
    const g2 = groundAt(P.pos.x, P.pos.z, P.pos.y);
    if (P.pos.y <= g2.g) {
      const impact = -P.vel.y; P.pos.y = g2.g; P.grounded = true;
      if (g2.box?.kind === 'mushroom') { P.vel.y = 16; P.grounded = false; sfx.bounce(); P.squash = 0.35; burst(P.pos.clone(), [0xff4d6d, 0xffffff], 8, 3, 4, true); hint('mush', 'Mushrooms bounce you up high!'); }
      else { P.vel.y = 0; if (impact > 10) { P.squash = Math.min(0.4, impact / 40); burst(P.pos.clone(), [0xd9c7a0, 0xffffff], 6, 2.5, 2, true); } }
    }
  } else if (box?.kind === 'mushroom') { P.vel.y = 16; P.grounded = false; sfx.bounce(); P.squash = 0.35; }
  // water
  if (biome.water && P.pos.y < biome.water.y - 0.5 && isWater(P.pos.x, P.pos.z)) {
    burst(new V3(P.pos.x, biome.water.y, P.pos.z), [0xbfe9ff, 0xffffff, 0x3ab0ff], 22, 4, 9); sfx.splash();
    if (P.carry) backToNest(P.carry);
    P.pos.copy(P.safe); P.vel.set(0, 0, 0); P.grounded = true; P.dizzy = 0.4; ride.on = false;
    say('SPLASH! Roll fast and JUMP at the end of the ramp!');
  }
  P.safeT -= dt;
  if (P.grounded && P.safeT <= 0 && !(biome.water && (biome.water.isWater(P.pos.x, P.pos.z) || biome.water.isWater(P.pos.x, P.pos.z + 8) || biome.water.isWater(P.pos.x, P.pos.z - 8)))) { P.safe.copy(P.pos); P.safeT = 0.3; }
  const tip = biome.tips?.(P.pos.x, P.pos.z, !!P.carry); if (tip) hint(tip[0], tip[1]);
  if (buddyIs('turtle') && atHome(P.pos.x, P.pos.z)) P.shield = true;
}

// ---------------- cart (valley) ----------------
function updateCart(dt: number) {
  const d = flat(P.pos, cart.pos), hv = new THREE.Vector2(P.vel.x, P.vel.z);
  P.pushing = false;
  const moving = hv.length() > 0.6;
  if (cart.held && (P.dizzy > 0 || d > 3.6 || !P.grounded && P.vel.y > 3 || ride.on)) cart.held = false;
  if (!cart.held && d < 2.7 && moving && P.dizzy <= 0 && P.grounded && !ride.on) { const to = new THREE.Vector2(cart.pos.x - P.pos.x, cart.pos.z - P.pos.z).normalize(); if (to.dot(hv.clone().normalize()) > -0.2) cart.held = true; }
  if (cart.held) {
    cart.idle = moving ? 0 : cart.idle + dt; if (cart.idle > 0.8) cart.held = false;
    if (moving) {
      P.pushing = true;
      const dir = hv.clone().normalize(), tx = P.pos.x + dir.x * 2.3, tz = P.pos.z + dir.y * 2.3, cap = hv.length() * 1.8 + 3;
      let vx = hv.x + (tx - cart.pos.x) * 6, vz = hv.y + (tz - cart.pos.z) * 6; const l = Math.hypot(vx, vz); if (l > cap) { vx *= cap / l; vz *= cap / l; }
      cart.vel.x = vx; cart.vel.z = vz;
      hint('cart', 'Push the cart into the giant melon, then push it home!');
    }
  }
  if (!P.pushing) { const k = Math.min(1, (cart.grounded ? 2.5 : 0.2) * dt); cart.vel.x *= 1 - k; cart.vel.z *= 1 - k; }
  const nx = cart.pos.x + cart.vel.x * dt, nz = cart.pos.z + cart.vel.z * dt;
  const gN = groundAt(nx, nz, cart.pos.y).g;
  if (gN < -0.35 && !biome.water?.onBridge(nx, nz)) { cart.vel.x = cart.vel.z = 0; }
  else {
    const p = { x: nx, z: nz }; const hit = pushOut(p, cart.pos.y, 1.3, 1.5);
    if (hit) { const vn = cart.vel.x * hit.nx + cart.vel.z * hit.nz; if (vn < 0) { cart.vel.x -= vn * hit.nx; cart.vel.z -= vn * hit.nz; } }
    const B = biome.bounds; cart.pos.x = Math.max(B.x0 + 1.5, Math.min(B.x1 - 1.5, p.x)); cart.pos.z = Math.max(B.z0 + 1.5, Math.min(B.z1 - 1.5, p.z));
  }
  if (d < 2.0) { const to = new V3(P.pos.x - cart.pos.x, 0, P.pos.z - cart.pos.z).normalize(); P.pos.x = cart.pos.x + to.x * 2.0; P.pos.z = cart.pos.z + to.z * 2.0; }
  const g = groundAt(cart.pos.x, cart.pos.z, cart.pos.y + 0.3).g, csp = Math.hypot(cart.vel.x, cart.vel.z);
  if (cart.grounded) {
    if (cart.pos.y - g < 0.1 + csp * dt * 0.8) { cart.vel.y = (g - cart.pos.y) / dt; cart.pos.y = g; } else cart.grounded = false;
    for (const bz of BUMPS) if ((cart.pos.z - bz) * (cart.pos.z - cart.vel.z * dt - bz) <= 0 && roadDist(cart.pos.x, cart.pos.z) < 4.5 && (P.pushing ? Math.hypot(P.vel.x, P.vel.z) : csp) > 6.2) { cart.vel.y = csp * 0.6; cart.grounded = false; cart.pos.y += 0.05; }
  }
  if (!cart.grounded) {
    cart.air += dt; cart.vel.y -= G * dt; cart.pos.y += cart.vel.y * dt;
    if (cart.pos.y <= g) { const impact = -cart.vel.y, air = cart.air; cart.air = 0; cart.pos.y = g; cart.vel.y = 0; cart.grounded = true; sfx.drop(); burst(cart.pos.clone(), [0xd9c7a0], 6, 2, 2, true);
      if (impact > 3.5 && air > 0.2 && cart.snack) { popSnack(cart.snack, new V3(cart.vel.x, 0, cart.vel.z).normalize(), 2.5); say('Whoops! Too fast over the bump — scoop the melon up again!'); } }
  }
  const sp = Math.hypot(cart.vel.x, cart.vel.z);
  if (P.pushing) cart.yaw = angleLerp(cart.yaw, Math.atan2(-P.vel.x, -P.vel.z), Math.min(1, 8 * dt)); else if (sp > 0.3) cart.yaw = angleLerp(cart.yaw, Math.atan2(-cart.vel.x, -cart.vel.z), Math.min(1, 6 * dt));
  const gr = gradAt(cart.pos.x, cart.pos.z, cart.pos.y + 0.3);
  cart.root.position.copy(cart.pos); cart.root.rotation.set(0, cart.yaw, 0);
  const fx = -Math.sin(cart.yaw), fz = -Math.cos(cart.yaw);
  cart.root.rotateX(Math.atan(gr.gx * fx + gr.gz * fz));
  cart.wheels.forEach((w) => (w.rotation.x += (sp * dt) / 0.45));
}

// ---------------- sled (snow) ----------------
function updateSled(dt: number, inp: Input) {
  const d = flat(P.pos, sled.pos);
  if (!P.sled) {
    if (d < 2.4 && P.dizzy <= 0 && !ride.on && !P.carry) { hud.prompt = 'Sit on the sled'; if (inp.act) { P.sled = true; P.rolling = false; P.vel.set(0, 0, 0); sled.speed = Math.max(sled.speed, 3); sfx.grab(); hint('sled', 'Steer with ← → (joystick). Push ↑ on flat ground, ↓ to brake, JUMP to hop off.', true); } }
  } else if (inp.jump || P.dizzy > 0) { P.sled = false; P.vel.set(Math.sin(sled.yaw) * sled.speed * 0.5, 6, Math.cos(sled.yaw) * sled.speed * 0.5); P.grounded = false; }
  const fx = Math.sin(sled.yaw), fz = Math.cos(sled.yaw);
  const gnd = groundAt(sled.pos.x, sled.pos.z, sled.pos.y + 0.3), surf = surfaceAt(sled.pos.x, sled.pos.z, gnd.box);
  if (P.sled) {
    sled.yaw -= inp.x * 1.9 * dt * (0.6 + Math.min(1, Math.abs(sled.speed) / 8));
    if (inp.y > 0.2 && sled.speed < 7) sled.speed += 5 * inp.y * dt;
    if (inp.y < -0.2) sled.speed = Math.max(0, sled.speed - 9 * dt);
  }
  if (sled.grounded) {
    const gr = gradAt(sled.pos.x, sled.pos.z, sled.pos.y + 0.3);
    sled.speed += -(gr.gx * fx + gr.gz * fz) * G * 0.8 * dt;              // gravity along the runners
    const fr = surf === 'ice' ? 0.2 : surf === 'snow' ? 0.9 : 5; sled.speed -= Math.sign(sled.speed) * Math.min(Math.abs(sled.speed), fr * dt);
    if (!P.sled) sled.speed *= 1 - Math.min(1, 1.5 * dt);
  }
  sled.speed = Math.max(-3, Math.min(24, sled.speed));
  const p = { x: sled.pos.x + fx * sled.speed * dt, z: sled.pos.z + fz * sled.speed * dt };
  const hit = pushOut(p, sled.pos.y, 1.0, 1.4);
  if (hit) {
    const along = fx * hit.nx + fz * hit.nz, vn = along * sled.speed;
    if (-vn > 7) { // crash!
      sfx.stomp(); shake = 0.35; burst(sled.pos.clone().add(new V3(0, 1, 0)), [0xffffff, 0xe3f1fb], 24, 4, 5, true);
      if (sled.snack) { popSnack(sled.snack, new V3(hit.nx, 0, hit.nz), 2); say('CRASH! The cake fell off — ride the sled into it again!'); }
      if (P.sled) { P.sled = false; P.vel.set(hit.nx * 4, 6, hit.nz * 4); P.grounded = false; P.dizzy = 0.6; }
      sled.speed = 0;
    } else if (vn < 0) { const tx = fx - hit.nx * along, tz = fz - hit.nz * along; sled.yaw = Math.atan2(tx, tz); sled.speed *= 0.8; }
  }
  const B = biome.bounds; sled.pos.x = Math.max(B.x0 + 1, Math.min(B.x1 - 1, p.x)); sled.pos.z = Math.max(B.z0 + 1, Math.min(B.z1 - 1, p.z));
  const g = groundAt(sled.pos.x, sled.pos.z, sled.pos.y + 0.3).g;
  if (sled.grounded) { if (sled.pos.y - g < 0.15 + Math.abs(sled.speed) * dt * 0.6) { sled.vy = (g - sled.pos.y) / dt; sled.pos.y = g; } else sled.grounded = false; }
  if (!sled.grounded) { sled.vy -= G * dt; sled.pos.y += sled.vy * dt; if (sled.pos.y <= g) { sled.pos.y = g; sled.vy = 0; sled.grounded = true; burst(sled.pos.clone(), [0xffffff], 6, 2, 2, true); } }
  const gr = gradAt(sled.pos.x, sled.pos.z, sled.pos.y + 0.3);
  sled.root.position.copy(sled.pos); sled.root.rotation.set(0, sled.yaw + Math.PI, 0); sled.root.rotateX(-Math.atan(gr.gx * fx + gr.gz * fz));
  if (P.sled) {
    P.pos.copy(sled.pos).add(new V3(0, 0.62, 0)); P.vel.set(fx * sled.speed, 0, fz * sled.speed); P.face = sled.yaw; P.grounded = true;
    if (Math.abs(sled.speed) > 4 && Math.random() < 0.5) burst(sled.pos.clone().add(new V3(-fx * 1.5, 0.1, -fz * 1.5)), [0xffffff], 1, 1.5, 1.5, true);
  }
  if (sled.backT > 0) { sled.backT -= dt; if (sled.backT <= 0) parkSled(); }
  sled.idle = P.sled ? 0 : sled.idle + dt; if (sled.idle > 25 && flat(sled.pos, sled.park) > 6 && flat(P.pos, sled.pos) > 10) parkSled();
}
function parkSled() { burst(sled.pos.clone().add(new V3(0, 1, 0)), [0xffffff], 14, 3, 4, true); if (P.sled) P.sled = false; sled.pos.copy(sled.park); sled.speed = 0; sled.yaw = biome.vehicleAt[2]; sled.idle = 0; if (sled.snack) backToNest(sled.snack); }

// ---------------- guardians ----------------
function updateGuards(dt: number) {
  for (const h of guards) {
    const stolen = (P.carry && P.carry.nest === h.nest) || (cart.snack && cart.snack.nest === h.nest) || (sled.snack && sled.snack.nest === h.nest);
    if (h.kind === 'hen') updateHen(h, dt, !!stolen); else updateRam(h, dt, !!stolen);
  }
}
function moveGuard(h: Guard, target: THREE.Vector3, speed: number, dt: number, stop: number): { moving: boolean; blocked: boolean } {
  const dx = target.x - h.pos.x, dz = target.z - h.pos.z, dist = Math.hypot(dx, dz);
  if (dist <= stop) return { moving: false, blocked: false };
  const st = Math.min(speed * dt, dist - stop), ux = dx / dist, uz = dz / dist;
  for (const [cx, cz] of [[h.pos.x + ux * st, h.pos.z + uz * st], [h.pos.x + ux * st, h.pos.z], [h.pos.x, h.pos.z + uz * st]]) {
    const gg = groundAt(cx, cz, h.pos.y).g; if (biome.water && gg < -0.35 && biome.water.isWater(cx, cz) && !biome.water.onBridge(cx, cz)) continue;
    if (biome.noGo(cx, cz)) continue;
    const p = { x: cx, z: cz }; const hit = pushOut(p, h.pos.y, 0.5 * h.size, 1.5 * h.size); h.pos.x = p.x; h.pos.z = p.z;
    h.yaw = angleLerp(h.yaw, Math.atan2(ux, uz), Math.min(1, 10 * dt));
    return { moving: true, blocked: !!hit };
  }
  return { moving: false, blocked: true };
}
function updateHen(h: Guard, dt: number, stolen: boolean) {
  const m = h.hen!, dP = flat(h.pos, P.pos);
  if (stolen && h.state !== 'chase') { h.state = 'chase'; h.bangT = 1.2; h.startle = h.size > 2 ? 2.2 : 1.3; if (h.size > 2) say('Mama Hen is waking up... GO GO GO!'); sfx.cluck(); shake = 0.15; }
  h.startle -= dt;
  if (h.state === 'chase' && (!stolen || dP > 60)) h.state = 'back';
  let target: THREE.Vector3 = h.state === 'chase' ? P.pos : h.state === 'back' ? h.home : h.wander;
  if (h.state === 'idle') { h.wanderT -= dt; if (h.wanderT <= 0 || flat(h.pos, h.wander) < 0.3) { h.wanderT = rnd(1.5, 4); const a = rnd(0, 6.28), r = rnd(0, 2.5 * h.size); h.wander.set(h.home.x + Math.cos(a) * r, 0, h.home.z + Math.sin(a) * r); } }
  if (biome.route) target = biome.route(h.pos, target);
  const speed = h.state === 'chase' ? (h.startle > 0 ? 0 : h.speed) : h.state === 'back' ? h.speed * 0.6 : 1.2;
  const { moving } = moveGuard(h, target, speed, dt, h.state === 'chase' ? 0.8 * h.size : 0.05);
  h.pos.y = groundAt(h.pos.x, h.pos.z, h.pos.y).g;
  if (h.state === 'back' && flat(h.pos, h.home) < 0.6) h.state = 'idle';
  h.cd -= dt; h.flapT -= dt; h.bangT -= dt;
  if (h.state === 'chase' && h.startle <= 0 && h.cd <= 0 && dP < 1.0 * h.size + 0.8 && Math.abs(P.pos.y - h.pos.y) < 1.5 * h.size && P.dizzy <= 0) {
    h.cd = 1.3; h.flapT = 0.5; sfx.flap(); sfx.cluck(); shake = 0.2;
    burst(P.pos.clone().add(new V3(0, 1, 0)), [0xffffff, 0xf2e6d0], 12, 3, 4);
    if (P.shield) { P.shield = false; const away = new V3(P.pos.x - h.pos.x, 0, P.pos.z - h.pos.z).normalize(); P.vel.x = away.x * 5; P.vel.z = away.z * 5; floatText(P.pos.clone().add(new V3(0, 2.4, 0)), '🐢 BLOCKED!', '#7dff8a'); }
    else { const had = !!P.carry; knock(h.pos, h.size > 2 ? 13 : 10); if (had) hint('hit', 'The hen knocked the snack out! Grab it again — or roll to escape faster!', true); }
  }
  if (h.size > 2 && h.state === 'chase' && cart.snack && flat(h.pos, cart.pos) < 2.7 && h.cd <= 0) { h.cd = 1.3; h.flapT = 0.5; sfx.flap(); popSnack(cart.snack, new V3(cart.pos.x - h.pos.x, 0, cart.pos.z - h.pos.z).normalize(), 3); say('Mama Hen knocked the melon out of the cart!'); }
  if (h.size > 2 && h.state === 'chase') stomp(h, dt);
  m.root.position.copy(h.pos); m.root.rotation.y = h.yaw;
  h.walkPh += dt * (moving ? speed * 3 : 0);
  m.legs.forEach((l, i) => (l.rotation.x = Math.sin(h.walkPh + i * Math.PI) * 0.6 * (moving ? 1 : 0)));
  const flap = h.flapT > 0 ? Math.sin(time * 40) * 1.2 : h.state === 'chase' ? Math.sin(time * 18) * 0.5 : 0;
  m.wings[0].rotation.z = 0.2 + flap; m.wings[1].rotation.z = -0.2 - flap;
  m.head.rotation.x = h.state === 'idle' && !moving ? Math.max(0, Math.sin(time * 3 + h.nest)) * 0.7 : 0;
  m.brows.forEach((b) => (b.visible = h.state === 'chase'));
  m.bang.visible = h.bangT > 0; m.root.position.y += moving ? Math.abs(Math.sin(h.walkPh)) * 0.08 * h.size : 0;
}
function stomp(h: Guard, dt: number) {
  h.stompT -= dt; if (h.stompT > 0) return;
  h.stompT = 1.8; sfx.stomp(); shake = 0.35; shock(h.pos, 9);
  const dP = flat(h.pos, P.pos);
  if (P.grounded && !P.sled && dP < 9) { const away = new V3(P.pos.x - h.pos.x, 0, P.pos.z - h.pos.z).normalize(); P.vel.y = 5; P.grounded = false; P.vel.x += away.x * 3; P.vel.z += away.z * 3; }
  if (cart.on) { const dc = flat(h.pos, cart.pos); if (dc < 9 && cart.grounded) { cart.vel.y = 3; cart.grounded = false; if (dc < 4 && cart.snack) { popSnack(cart.snack, new V3(cart.pos.x - h.pos.x, 0, cart.pos.z - h.pos.z).normalize(), 2); say('The STOMP shook the melon out! Stay ahead of Mama Hen!'); } } }
}
/** Rams: aim (paw the ground, "!"), then CHARGE in a straight line. Dodge sideways — a ram that hits a tree or a wall gets dizzy. */
function updateRam(h: Guard, dt: number, stolen: boolean) {
  const m = h.ram!, tgt = P.sled ? sled.pos : P.pos, dP = flat(h.pos, tgt);
  h.t += dt; h.cd -= dt;
  let moving = false, speed = 0;
  if (stolen && (h.state === 'idle' || h.state === 'back')) { h.state = 'aim'; h.t = h.size > 2 ? -1.6 : 0; sfx.cluck(); if (h.size > 2) say('The BIG RAM is waking up... SLED AWAY!'); }
  if (!stolen && (h.state === 'aim' || h.state === 'rest' || h.state === 'charge')) h.state = 'back';
  if ((h.state === 'aim' || h.state === 'rest') && dP > 45) h.state = 'back';
  switch (h.state) {
    case 'idle': { h.wanderT -= dt; if (h.wanderT <= 0 || flat(h.pos, h.wander) < 0.3) { h.wanderT = rnd(2, 4); const a = rnd(0, 6.28), r = rnd(0, 2.5 * h.size); h.wander.set(h.home.x + Math.cos(a) * r, 0, h.home.z + Math.sin(a) * r); } speed = 1.2; moving = moveGuard(h, h.wander, speed, dt, 0.05).moving; break; }
    case 'back': { speed = 4; moving = moveGuard(h, h.home, speed, dt, 0.05).moving; if (flat(h.pos, h.home) < 0.6) h.state = 'idle'; break; }
    case 'aim': {
      if (dP > 14) { speed = 5; moving = moveGuard(h, tgt, speed, dt, 1).moving; h.t = 0; break; }
      h.yaw = angleLerp(h.yaw, Math.atan2(tgt.x - h.pos.x, tgt.z - h.pos.z), Math.min(1, 8 * dt));
      if (Math.random() < dt * 12) burst(h.pos.clone().add(new V3(0, 0.1, 0)), [0xffffff, 0xd9e9f7], 2, 1.5, 2, true);
      if (h.t > (h.size > 2 ? 1.0 : 0.75)) { h.state = 'charge'; h.t = 0; h.dir.set(Math.sin(h.yaw), 0, Math.cos(h.yaw)); sfx.stomp(); }
      break;
    }
    case 'charge': {
      speed = h.speed; const tgtP = h.pos.clone().addScaledVector(h.dir, 3);
      const r = moveGuard(h, tgtP, speed, dt, 0); moving = r.moving;
      if (Math.random() < 0.6) burst(h.pos.clone().add(new V3(0, 0.2, 0)), [0xffffff], 1, 1.5, 2, true);
      if (r.blocked) { h.state = 'stun'; h.t = 0; sfx.drop(); shake = 0.2; burst(h.pos.clone().add(new V3(0, 1.2 * h.size, 0)), [0xfff36b, 0xffffff], 10, 3, 4); hint('ramstun', 'Ha! The ram bonked into something and got dizzy. Dodge sideways when it charges!', true); break; }
      if (h.t > 1.6) { h.state = 'rest'; h.t = 0; }
      if (dP < 0.9 * h.size + 0.7 && Math.abs(P.pos.y - h.pos.y) < 1.6 * h.size && P.dizzy <= 0 && h.cd <= 0) {
        h.cd = 1; h.state = 'rest'; h.t = 0; sfx.flap(); shake = 0.3; burst(P.pos.clone().add(new V3(0, 1, 0)), [0xffffff, 0xf7f4ee], 14, 3, 4);
        if (P.rolling && P.snow > 0.5) { h.state = 'stun'; floatText(P.pos.clone().add(new V3(0, 2.6, 0)), 'SNOWBALL BONK!', '#ffffff'); P.snow -= 0.2; }
        else if (buddyIs('polarbear')) { floatText(P.pos.clone().add(new V3(0, 2.4, 0)), '🐻‍❄️ HUG BLOCK!', '#7dff8a'); P.vel.x += h.dir.x * 4; P.vel.z += h.dir.z * 4; }
        else if (P.shield) { P.shield = false; floatText(P.pos.clone().add(new V3(0, 2.4, 0)), '🐢 BLOCKED!', '#7dff8a'); }
        else { const had = !!P.carry || !!sled.snack; knock(h.pos, h.size > 2 ? 14 : 11, 4); if (had) hint('ramhit', 'BOING! Rams charge in a straight line — step aside when you see the "!"', true); }
      }
      break;
    }
    case 'stun': { m.stars.visible = true; m.stars.position.x = Math.sin(time * 8) * 0.3; if (h.t > 2.2) { h.state = stolen ? 'aim' : 'back'; h.t = 0; } break; }
    case 'rest': { if (h.t > 0.6) { h.state = 'aim'; h.t = 0; } break; }
    case 'chase': h.state = 'aim'; break;
  }
  if (h.state !== 'stun') m.stars.visible = false;
  m.bang.visible = h.state === 'aim' && dP <= 14;
  if (h.size > 2 && (h.state === 'aim' || h.state === 'charge' || h.state === 'rest')) stomp(h, dt);
  h.pos.y = groundAt(h.pos.x, h.pos.z, h.pos.y + 0.5).g;
  m.root.position.copy(h.pos); m.root.rotation.y = h.yaw;
  h.walkPh += dt * (moving ? speed * 2.4 : 0);
  m.legs.forEach((l, i) => (l.rotation.x = Math.sin(h.walkPh + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7 * (moving ? 1 : 0)));
  m.head.rotation.x = h.state === 'charge' ? 0.5 : h.state === 'aim' ? 0.25 + Math.sin(time * 14) * 0.1 : 0;
  m.root.rotation.z = h.state === 'stun' ? Math.sin(time * 10) * 0.12 : 0;
}

// ---------------- treadmill pad + portal ----------------
function updatePads() {
  if (!treadPad) return;
  const onT = flat(P.pos, treadPad.position) < 1.3, latch = onT ? 'T' : '';
  if (latch && latch !== padLatch) {
    if (S.tier + 1 >= TIERS.length) say('Your treadmill is already the fastest!');
    else if (S.coins >= TIER_COST[S.tier + 1]) { S.coins -= TIER_COST[S.tier + 1]; S.tier++; sfx.buy(); say(`Treadmill upgraded! Training ×${TIERS[S.tier]}`); save(); refreshPadLabels(); burst(treadPad.position.clone().add(new V3(0, 1, 0)), [0xffd23f, 0xff6b6b, 0x7dff8a], 24, 4, 7); }
    else { sfx.no(); say(`You need ${TIER_COST[S.tier + 1]} 🪙 — animals give coins as gifts!`); }
  }
  padLatch = latch;
}
export const portalOpen = () => !portal || portal.to !== 'snow' || friendsCount() >= SNOW_UNLOCK;
let travelT = 0;
function updatePortal(dt: number) {
  if (!portal) return;
  const open = portalOpen();
  portal.lock.visible = !open; portal.swirl.rotation.z += dt * 2; (portal.swirl.material as THREE.MeshBasicMaterial).opacity = open ? 0.55 + 0.25 * Math.sin(time * 4) : 0.25;
  const d = flat(P.pos, portal.at), near = d < 2.2;
  if (near && !portalLatch && !P.carry && !P.sled) {
    if (!open) { say(`🔒 Make ${SNOW_UNLOCK} animal friends to open the way to Snow Mountain! (${friendsCount()}/${SNOW_UNLOCK})`, 3.5); sfx.no(); }
    else { travelT = 0.01; sfx.level(); burst(P.pos.clone().add(new V3(0, 1, 0)), [0xffffff, 0x9fdcff, 0x7dff8a], 30, 4, 6); }
  }
  if (near && P.carry && !portalLatch) say('Bring your snack home first!');
  portalLatch = near;
  if (!open && d < 9) hint('portal-locked', `This magic gate leads to SNOW MOUNTAIN. Make ${SNOW_UNLOCK} animal friends to open it!`);
  if (open && d < 9 && portal.to === 'snow') hint('portal-open', 'The gate is OPEN! Walk in to visit Snow Mountain ❄️', true);
  if (travelT > 0) { travelT += dt; if (travelT > 0.35) { travelT = 0; loadArea(portal.to, true); } }
}

// ---------------- hero animation + camera ----------------
function animateHero(dt: number) {
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (sp > 0.4 && !P.onTread && P.dizzy <= 0 && !P.sled) P.face = angleLerp(P.face, Math.atan2(P.vel.x, P.vel.z), Math.min(1, (P.rolling ? 6 : 14) * dt));
  const rd = ride.on ? rideDef() : null;
  hero.root.position.copy(P.pos); if (rd) hero.root.position.y += rd.seat; hero.root.rotation.y = P.face;
  hero.walk.visible = !P.rolling; hero.ball.visible = P.rolling;
  const R = 0.64 * (1 + P.snow * 1.1); snowShell.visible = P.rolling && P.snow > 0.02; snowShell.scale.setScalar(R / 0.66); hero.ball.position.y = R - 0.64; peek.position.z = 0.5 + (R - 0.64);
  if (P.rolling) { hero.spin.rotation.x += (sp * dt) / R; if (P.grounded && sp > 3 && Math.random() < sp * dt * 1.5) burst(P.pos.clone().add(new V3(rnd(-0.3, 0.3), 0.1, rnd(-0.3, 0.3))), P.surface === 'grass' ? [0xe9dcc0, 0xffffff] : [0xffffff, 0xe3f1fb], 2, 1.2, 1.5, true); }
  else {
    const still = P.sled || !!rd; if (!P.onTread) P.walkPh += dt * sp * 2.2;
    hero.legs.forEach((l, i) => (l.rotation.x = still ? -1.2 : Math.sin(P.walkPh + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * (sp > 0.4 || P.onTread ? 0.8 : 0)));
    hero.walk.position.y = !still && (sp > 0.4 || P.onTread) ? Math.abs(Math.sin(P.walkPh)) * 0.08 : 0; hero.walk.rotation.z = P.dizzy > 0 ? Math.sin(time * 20) * 0.2 : 0;
  }
  P.squash += (0 - P.squash) * Math.min(1, 10 * dt);
  hero.root.scale.set(1 + P.squash * 0.6, 1 - P.squash, 1 + P.squash * 0.6);
  dizzyStars.visible = P.dizzy > 0; dizzyStars.position.set(Math.sin(time * 8) * 0.3, 2.1, Math.cos(time * 8) * 0.3);
}
export function rotateCamera(dx: number) { camYaw -= dx * 0.006; dragT = 1.2; }
let camD = 9.5, camH = 4.6;
function updateCamera(dt: number) {
  const sp = Math.hypot(P.vel.x, P.vel.z);
  dragT -= dt;
  if (!build.on && dragT <= 0 && sp > 2 && !P.onTread) {
    const want = Math.atan2(-P.vel.x, -P.vel.z); const d = ((want - camYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(d) < (P.sled ? 3.2 : 2.3)) camYaw += d * Math.min(1, (P.sled ? 3 : 1.6) * dt * Math.min(1, sp / 6));
  }
  const wantD = build.on ? 12 : P.sled ? 11 : 9.5 + P.snow * 2, wantH = build.on ? 9 : P.sled ? 5.5 : 4.6 + P.snow;
  camD += (wantD - camD) * Math.min(1, 4 * dt); camH += (wantH - camH) * Math.min(1, 4 * dt);
  const tgt = new V3(P.pos.x, P.pos.y + 1.3, P.pos.z);
  const want = new V3(tgt.x + Math.sin(camYaw) * camD, tgt.y + camH, tgt.z + Math.cos(camYaw) * camD);
  want.y = Math.max(want.y, terrainH(want.x, want.z) + 1.2);
  camera.position.lerp(want, 1 - Math.exp(-8 * dt));
  if (shake > 0) { shake -= dt; camera.position.add(new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(shake * 0.8)); }
  camera.lookAt(tgt);
}
export function sunTarget() { return P.pos; }

// ---------------- main update ----------------
let saveT = 0;
export function update(dt: number, inp: Input) {
  time += dt;
  hud.prompt = '';
  if (!P.sled) updatePlayer(dt, inp);
  if (cart.on) updateCart(dt);
  if (sled.on) updateSled(dt, inp);
  updateSnacks(dt);
  updateGuards(dt);
  updateCamp(dt, P, inp.act && !build.on && !P.sled, time);
  updatePads();
  updatePortal(dt);
  if (hud.shake > 0) { shake = Math.max(shake, hud.shake); hud.shake = 0; }
  animateHero(dt);
  updateCamera(dt);
  decoUpdate(time, camera.position);
  updateFx(dt);
  saveT -= dt; if (saveT <= 0) { saveT = 3; save(); }
}
export const state = { P, cart, sled, guards, snacks, S: () => S, camYaw: () => camYaw, biome: () => biome, loadArea, buddy: buddyCritter };
export { S };
