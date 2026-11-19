import * as THREE from 'three';
import { BASE_Z, BOUNDS, BUMPS, roadDist, NESTS, RIVER_MID, WATER_Y, buildWorld, groundAt, isRiver, onBridge, pushOut, terrainH, textSprite, toon, mesh, type WorldDeco } from './world';
import { EGG_R, makeCart, makeEgg, makeHen, makeHero, makeIncubator, makeNest, makePad, makePet, makeTreadmill, type HenMesh, type PetType } from './models';
import { sfx } from './audio';

export interface Input { x: number; y: number; jump: boolean; roll: boolean; act: boolean }
type Kind = 's' | 'm' | 'b';
const V3 = THREE.Vector3;
const G = 26;
const KG: Record<Kind, [number, number]> = { s: [1, 3], m: [5, 12], b: [30, 60] };
const HATCH_T: Record<Kind, number> = { s: 12, m: 22, b: 35 };
const PET_BASE: Record<PetType, number> = { chick: 0.5, bunny: 1, turtle: 2, fox: 3.5 };
const PET_NAME: Record<PetType, string> = { chick: 'Chick', bunny: 'Bunny', turtle: 'Turtle', fox: 'Fox' };
const PET_POWER: Record<PetType, string> = { chick: '+25% coins', bunny: 'Higher jump', turtle: 'Blocks one hen hit', fox: '+10% speed' };
const TIERS = [1, 2, 3.5, 6], TIER_COST = [0, 60, 250, 800], PEN_COST = 100;
const PEN_POS = [[-9, 14], [-3, 14], [3, 14], [9, 14]];
const TREAD = { x: 16, z: 12 };

// ---------------- save ----------------
interface PetSave { type: PetType; kg: number; gold: boolean; egg: Kind }
interface Save { coins: number; lvl: number; xp: number; tier: number; pens: number; pets: PetSave[]; buddy: number; hints: string[] }
const KEY = 'nestproto_v1';
const fresh = (): Save => ({ coins: 0, lvl: 0, xp: 0, tier: 0, pens: 3, pets: [], buddy: -1, hints: [] });
export let S: Save = (() => { try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); } })();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }
export function resetSave() { try { localStorage.removeItem(KEY); } catch { /* */ } location.reload(); }

// ---------------- entities ----------------
interface Egg { kind: Kind; kg: number; gold: boolean; nest: number; slot: number; state: 'nest' | 'held' | 'cart' | 'loose' | 'pen' | 'gone'; pos: THREE.Vector3; vel: THREE.Vector3; m: THREE.Group; t: number; from?: THREE.Vector3; to?: THREE.Vector3 }
interface Hen { nest: number; size: number; speed: number; home: THREE.Vector3; pos: THREE.Vector3; yaw: number; state: 'idle' | 'chase' | 'back'; cd: number; flapT: number; stompT: number; wanderT: number; wander: THREE.Vector3; m: HenMesh; bangT: number; walkPh: number; startle: number }
interface Pet { s: PetSave; idx: number; m: THREE.Group; pos: THREE.Vector3; target: THREE.Vector3; coins: number; label: THREE.Sprite | null; shown: number; tWander: number; hop: number }
interface Pen { pos: THREE.Vector3; egg: Egg | null; t: number; need: number; root: THREE.Group; label: THREE.Sprite | null; shown: number; lock: THREE.Group | null }

let scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: WorldDeco;
const eggs: Egg[] = [], hens: Hen[] = [], pets: Pet[] = [], pens: Pen[] = [];
const respawns: { nest: number; slot: number; t: number }[] = [];
const hero = makeHero();
const P = { pos: new V3(0, 0, 7), vel: new V3(), face: Math.PI, grounded: true, rolling: false, dizzy: 0, carry: null as Egg | null, shield: false, safe: new V3(0, 0, 7), safeT: 0, onTread: false, coyote: 0, jumpBuf: 0, squash: 0, walkPh: 0, pushing: false, wasRoll: false };
const cart = { pos: new V3(7, 0, -4), vel: new V3(), yaw: Math.PI, grounded: true, air: 0, held: false, idle: 0, egg: null as Egg | null, ...makeCart() };
let tread: ReturnType<typeof makeTreadmill>, treadPad: THREE.Group, penPad: THREE.Group, treadLabel: THREE.Sprite, penLabel: THREE.Sprite;
let padLatch = '';
let camYaw = 0, dragT = 0, shake = 0, time = 0;
const dizzyStars = textSprite('★ ★', { size: 60, color: '#fff36b', scale: 0.5 });

// hud state read by main.ts
export const hud = { hint: '', hintT: 0, prompt: '', card: null as null | { title: string; sub: string; gold: boolean; t: number }, float: [] as { text: string; t: number }[], treadXp: 0, onTread: false };
function hint(key: string, text: string, force = false) { if (!force && S.hints.includes(key)) return; if (!S.hints.includes(key)) S.hints.push(key); hud.hint = text; hud.hintT = 4.5; }
function say(text: string, t = 2.6) { hud.hint = text; hud.hintT = t; }

// ---------------- particles & floating text ----------------
interface Part { m: THREE.Mesh; v: THREE.Vector3; t: number; spin: number }
const parts: Part[] = [];
const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.05), sphGeo = new THREE.SphereGeometry(0.12, 6, 4);
function burst(at: THREE.Vector3, colors: number[], n: number, speed = 5, up = 6, sphere = false) {
  for (let i = 0; i < n && parts.length < 260; i++) {
    const m = new THREE.Mesh(sphere ? sphGeo : partGeo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
    m.position.copy(at); scene.add(m);
    const a = Math.random() * Math.PI * 2, r = Math.random() * speed;
    parts.push({ m, v: new V3(Math.cos(a) * r, up * (0.4 + Math.random() * 0.8), Math.sin(a) * r), t: 0.8 + Math.random() * 0.6, spin: Math.random() * 10 });
  }
}
const floats: { s: THREE.Sprite; t: number }[] = [];
function floatText(at: THREE.Vector3, text: string, color = '#ffe14a', scale = 0.8) { const s = textSprite(text, { size: 64, color, scale }); s.position.copy(at); scene.add(s); floats.push({ s, t: 1.3 }); }
const rings: { m: THREE.Mesh; t: number; max: number }[] = [];
function shock(at: THREE.Vector3, max: number) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.copy(at).add(new V3(0, 0.15, 0)); scene.add(m); rings.push({ m, t: 0, max }); }

// ---------------- helpers ----------------
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
function angleLerp(a: number, b: number, t: number) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
function slotPos(n: number, slot: number): THREE.Vector3 {
  const N = NESTS[n], sz = N.kind === 'b' ? 2 : 1, a = (slot / N.count) * Math.PI * 2, r = N.count > 1 ? 0.65 * sz : 0;
  const x = N.x + Math.cos(a) * r, z = N.z + Math.sin(a) * r; return new V3(x, terrainH(N.x, N.z) + 0.28 * sz, z);
}
function gradAt(x: number, z: number, y: number) { const e = 0.3; return { gx: (groundAt(x + e, z, y).g - groundAt(x - e, z, y).g) / (2 * e), gz: (groundAt(x, z + e, y).g - groundAt(x, z - e, y).g) / (2 * e) }; }
const buddyPet = () => (S.buddy >= 0 && S.buddy < S.pets.length ? S.pets[S.buddy] : null);
const buddyIs = (t: PetType) => buddyPet()?.type === t;
const inFarm = (z: number) => z > BASE_Z + 0.5;

// ---------------- setup ----------------
function spawnEgg(n: number, slot: number) {
  const N = NESTS[n], kind = N.kind, gold = Math.random() < 0.08;
  const e: Egg = { kind, kg: Math.round(rnd(KG[kind][0], KG[kind][1]) * 10) / 10, gold, nest: n, slot, state: 'nest', pos: slotPos(n, slot), vel: new V3(), m: makeEgg(kind, gold), t: 0 };
  e.m.position.copy(e.pos); e.m.rotation.y = Math.random() * 6; scene.add(e.m); eggs.push(e);
  if (gold) { const sp = textSprite('✨ GOLD', { size: 46, color: '#fff3a0', scale: 0.6 }); sp.position.set(0, EGG_R[kind] * 2.6 + 0.4, 0); e.m.add(sp); }
}
function makePetObj(s: PetSave, idx: number, at: THREE.Vector3) {
  const m = makePet(s.type, s.gold); const sc = 0.85 + Math.min(0.6, s.kg / (s.egg === 'b' ? 90 : s.egg === 'm' ? 20 : 5) * 0.5); m.scale.setScalar(sc * (s.egg === 'b' ? 1.35 : 1));
  m.position.copy(at); scene.add(m);
  const p: Pet = { s, idx, m, pos: at.clone(), target: at.clone(), coins: 0, label: null, shown: -1, tWander: 0, hop: Math.random() * 6 };
  pets.push(p); return p;
}
export function petRate(s: PetSave) { const ref = s.egg === 's' ? 2 : s.egg === 'm' ? 8 : 45; return Math.round(PET_BASE[s.type] * (s.kg / ref) * (s.gold ? 3 : 1) * (s.egg === 'b' ? 2.5 : 1) * 10) / 10; }

export function init(sc: THREE.Scene, cam: THREE.PerspectiveCamera) {
  scene = sc; camera = cam;
  world = buildWorld(scene);
  scene.add(hero.root);
  NESTS.forEach((N, n) => {
    const nest = makeNest(N.kind === 'b' ? 2 : 1); nest.position.set(N.x, terrainH(N.x, N.z), N.z); scene.add(nest);
    for (let i = 0; i < N.count; i++) spawnEgg(n, i);
    const home = new V3(N.x + 1.2 * N.henSize, 0, N.z - 2.4 * N.henSize); home.y = terrainH(home.x, home.z);
    const hm = makeHen(N.henSize, N.kind === 'b' ? 0xa0673a : N.kind === 'm' ? 0xfff3e6 : 0xffffff); scene.add(hm.root);
    hens.push({ nest: n, size: N.henSize, speed: N.henSpeed, home, pos: home.clone(), yaw: 0, state: 'idle', cd: 0, flapT: 0, stompT: 1.5, wanderT: 0, wander: home.clone(), m: hm, bangT: 0, walkPh: 0, startle: 0 });
    const lbl = textSprite(N.kind === 'b' ? '🥚 GIANT EGGS · use the 🛒' : N.kind === 'm' ? '🥚 BIG EGGS' : '🥚 SMALL EGGS', { size: 44, scale: 0.9, bg: 'rgba(0,0,0,.45)' }); lbl.position.set(N.x, terrainH(N.x, N.z) + (N.kind === 'b' ? 6 : 3.4), N.z); scene.add(lbl);
  });
  cart.pos.y = terrainH(cart.pos.x, cart.pos.z); scene.add(cart.root);
  // farm: incubators, treadmill, pads
  PEN_POS.forEach(([x, z], i) => {
    const inc = makeIncubator(); inc.root.position.set(x, 0, z); scene.add(inc.root);
    const pen: Pen = { pos: new V3(x, 0, z), egg: null, t: 0, need: 1, root: inc.root, label: null, shown: -1, lock: null };
    if (i >= S.pens) { const l = new THREE.Group(); const s = textSprite('🔒', { size: 80, scale: 1 }); s.position.y = 1.3; l.add(s); inc.root.add(l); pen.lock = l; }
    pens.push(pen);
  });
  penPad = makePad(0x3d9dff); penPad.position.set(9, 0, 18.5); scene.add(penPad);
  tread = makeTreadmill(); tread.root.position.set(TREAD.x, 0, TREAD.z); scene.add(tread.root);
  const ts = textSprite('🏃 TRAINING', { size: 52, scale: 1, bg: '#e0621e' }); ts.position.set(TREAD.x, 3.2, TREAD.z - 2.4); scene.add(ts);
  treadPad = makePad(0xe0621e); treadPad.position.set(TREAD.x + 4, 0, TREAD.z + 3); scene.add(treadPad);
  refreshPadLabels();
  S.pets.forEach((s, i) => makePetObj(s, i, new V3(rnd(-14, 10), 0, rnd(17, 24))));
  hero.root.add(dizzyStars); dizzyStars.position.y = 2.1; dizzyStars.visible = false;
  hint('start', 'Grab an egg from a nest!  (WASD / joystick)');
}
function refreshPadLabels() {
  if (treadLabel) scene.remove(treadLabel); if (penLabel) scene.remove(penLabel);
  const t = S.tier + 1 < TIERS.length ? `⚡ Faster treadmill: ${TIER_COST[S.tier + 1]} 🪙` : '⚡ Treadmill MAX';
  treadLabel = textSprite(t, { size: 44, scale: 0.6, bg: 'rgba(0,0,0,.55)' }); treadLabel.position.set(TREAD.x + 4, 2.2, TREAD.z + 3); scene.add(treadLabel);
  penLabel = textSprite(S.pens < 4 ? `🥚 New incubator: ${PEN_COST} 🪙` : '🥚 All incubators open', { size: 44, scale: 0.6, bg: 'rgba(0,0,0,.55)' }); penLabel.position.set(9, 2.2, 18.5); scene.add(penLabel);
}

// ---------------- eggs ----------------
function popEgg(e: Egg, dir: THREE.Vector3, power = 4) {
  (window as any).__pop = (new Error().stack || '').split('\n')[2];
  e.state = 'loose'; e.t = 0; e.vel.set(dir.x * power + rnd(-1, 1), 6, dir.z * power + rnd(-1, 1));
  if (P.carry === e) P.carry = null; if (cart.egg === e) cart.egg = null;
  e.m.visible = true; sfx.drop();
}
function backToNest(e: Egg) {
  (window as any).__back = (new Error().stack || '').split('\n')[2];
  burst(e.pos.clone().add(new V3(0, 0.5, 0)), [0xffffff, 0xdddddd], 10, 3, 3, true);
  e.state = 'nest'; e.pos.copy(slotPos(e.nest, e.slot)); e.vel.set(0, 0, 0); e.m.visible = true; e.m.rotation.set(0, e.m.rotation.y, 0);
  if (P.carry === e) P.carry = null; if (cart.egg === e) cart.egg = null;
}
function deposit(e: Egg): boolean {
  const pen = pens.find((p, i) => i < S.pens && !p.egg);
  if (!pen) { say('All incubators are full! Wait for a hatch or buy one more.'); return false; }
  e.state = 'pen'; e.t = 0; e.from = e.pos.clone(); e.to = pen.pos.clone().add(new V3(0, 0.5, 0)); e.m.visible = true;
  pen.egg = e; pen.t = 0; pen.need = HATCH_T[e.kind] * (e.gold ? 1.3 : 1);
  if (P.carry === e) P.carry = null; if (cart.egg === e) cart.egg = null;
  respawns.push({ nest: e.nest, slot: e.slot, t: 14 });
  sfx.place(); floatText(e.to.clone().add(new V3(0, 2, 0)), 'Incubating!', '#7dff8a'); hint('placed', 'Nice! The egg will hatch soon. Get another one!');
  return true;
}
function updateEggs(dt: number) {
  for (const e of eggs) {
    if (e.state === 'nest') { e.m.position.copy(e.pos); e.m.rotation.z = Math.sin(time * 2 + e.slot) * 0.05; continue; }
    if (e.state === 'held') {
      if (P.rolling) e.m.visible = false; else { e.m.visible = true; hero.hold.getWorldPosition(e.pos); e.pos.y -= EGG_R[e.kind] * 0.2; e.m.position.copy(e.pos); e.m.rotation.set(Math.sin(time * 9) * 0.08 * (P.vel.length() > 1 ? 1 : 0), P.face, 0); }
      continue;
    }
    if (e.state === 'cart') { cart.seat.getWorldPosition(e.pos); e.m.position.copy(e.pos); e.m.rotation.set(cart.root.rotation.x, cart.yaw, cart.root.rotation.z + Math.sin(time * 6) * 0.04 * Math.min(1, Math.hypot(cart.vel.x, cart.vel.z))); continue; }
    if (e.state === 'pen') {
      if (e.t < 1) { e.t = Math.min(1, e.t + dt * 2); const k = e.t; e.pos.lerpVectors(e.from, e.to, k); e.pos.y += Math.sin(k * Math.PI) * 3; }
      else { const pen = pens.find((p) => p.egg === e); const near = pen ? pen.t / pen.need : 0; e.m.rotation.z = near > 0.75 ? Math.sin(time * 30) * 0.12 * (near - 0.75) * 4 : 0; }
      e.m.position.copy(e.pos); continue;
    }
    if (e.state === 'loose') {
      e.t += dt; const r = EGG_R[e.kind];
      e.vel.y -= G * dt; e.pos.addScaledVector(e.vel, dt);
      const p = { x: e.pos.x, z: e.pos.z }; const hit = pushOut(p, e.pos.y, r * 0.8, r * 2); if (hit) { const vn = e.vel.x * hit.nx + e.vel.z * hit.nz; if (vn < 0) { e.vel.x -= 1.5 * vn * hit.nx; e.vel.z -= 1.5 * vn * hit.nz; } } e.pos.x = p.x; e.pos.z = p.z;
      const { g } = groundAt(e.pos.x, e.pos.z, e.pos.y + 0.3);
      if (e.pos.y <= g) {
        e.pos.y = g; e.vel.y = Math.abs(e.vel.y) > 2.5 ? -e.vel.y * 0.3 : 0;
        const gr = gradAt(e.pos.x, e.pos.z, e.pos.y + 0.3); e.vel.x += -gr.gx * G * 0.35 * dt; e.vel.z += -gr.gz * G * 0.35 * dt;
        e.vel.x *= 1 - Math.min(1, 2.2 * dt); e.vel.z *= 1 - Math.min(1, 2.2 * dt);
      }
      e.pos.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, e.pos.x)); e.pos.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, e.pos.z));
      e.m.position.copy(e.pos); e.m.rotation.x += Math.hypot(e.vel.x, e.vel.z) * dt / r;
      if (e.pos.y < WATER_Y - 0.4) { burst(new V3(e.pos.x, WATER_Y, e.pos.z), [0xbfe9ff, 0xffffff], 12, 3, 6); sfx.splash(); backToNest(e); }
      else if (e.t > 12 && flat(e.pos, P.pos) > 6) backToNest(e);
      else if (e.pos.z > -1.5 && e.kind !== 'b' && e.t > 0.6) deposit(e);
    }
  }
  for (let i = respawns.length - 1; i >= 0; i--) { const r = respawns[i]; r.t -= dt; if (r.t <= 0) { respawns.splice(i, 1); if (!eggs.some((e) => e.nest === r.nest && e.slot === r.slot && (e.state === 'nest' || e.state === 'loose' || e.state === 'held' || e.state === 'cart'))) spawnEgg(r.nest, r.slot); } }
  // the cart scoops up a giant egg when pushed into it
  if (!cart.egg) for (const e of eggs) if (e.kind === 'b' && (e.state === 'nest' || (e.state === 'loose' && e.t > 0.5)) && flat(e.pos, cart.pos) < 2.4) { cart.egg = e; e.state = 'cart'; sfx.grab(); floatText(e.pos.clone().add(new V3(0, 3, 0)), 'Into the cart!', '#7dff8a'); hint('cartgo', 'Turn around and push the cart HOME! Slow down on the bumps!', true); break; }
  // pick up / load
  if (P.dizzy <= 0 && !P.carry) {
    for (const e of eggs) {
      if (e.state !== 'nest' && e.state !== 'loose') continue;
      const d = flat(e.pos, P.pos), reach = EGG_R[e.kind] + 0.9;
      if (d > reach || Math.abs(e.pos.y - P.pos.y) > 2.5) continue;
      if (e.state === 'loose' && e.t < 0.5) continue;
      if (e.kind === 'b') {
        if (!cart.egg && flat(cart.pos, e.pos) < 5) { cart.egg = e; e.state = 'cart'; sfx.grab(); floatText(e.pos.clone().add(new V3(0, 3, 0)), 'Into the cart!', '#7dff8a'); hint('cartgo', 'Push the cart home! Careful on the bumps!', true); }
        else hint('heavy', 'Too heavy to carry! Bring the 🛒 cart from the farm gate.', true);
        continue;
      }
      P.carry = e; e.state = 'held'; sfx.grab(); hint('run', 'RUN HOME!  Hold SHIFT / 🌀 to roll faster!');
      break;
    }
  }
  // drop off at the farm
  if (P.carry && P.pos.z > -1.5) deposit(P.carry);
  if (cart.egg && cart.pos.z > -2) deposit(cart.egg);
}

// ---------------- player ----------------
function updatePlayer(dt: number, inp: Input) {
  const lvlSpd = 0.22 * S.lvl, fox = buddyIs('fox') ? 1.1 : 1;
  P.rolling = inp.roll && P.dizzy <= 0 && !P.onTread;
  if (P.rolling && !P.wasRoll) sfx.roll(); P.wasRoll = P.rolling;
  const carryMul = P.carry ? (P.carry.kind === 's' ? 0.92 : 0.8) : 1;
  let max = P.rolling ? (9.6 + lvlSpd * 1.3) * (P.carry ? 0.95 : 1) * fox : (6.0 + lvlSpd) * carryMul * fox;
  if (P.pushing) max *= 0.85;
  const fwd = new V3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), right = new V3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  const wish = fwd.multiplyScalar(inp.y).add(right.multiplyScalar(inp.x)); if (wish.length() > 1) wish.normalize();
  if (P.dizzy > 0) { P.dizzy -= dt; wish.set(0, 0, 0); }
  // treadmill
  P.onTread = P.grounded && Math.abs(P.pos.x - TREAD.x) < 1.2 && Math.abs(P.pos.z - TREAD.z) < 2.3 && wish.length() > 0.2 && !P.carry;
  hud.onTread = P.onTread;
  if (P.onTread) {
    P.pos.x += (TREAD.x - P.pos.x) * Math.min(1, 8 * dt); P.pos.z += (TREAD.z - P.pos.z) * Math.min(1, 8 * dt); P.vel.x = P.vel.z = 0; P.face = Math.PI; P.walkPh += dt * 22;
    tread.belt.offset.y -= dt * 3 * TIERS[S.tier];
    S.xp += dt * TIERS[S.tier]; const need = 5 + S.lvl * 1.5; hud.treadXp = S.xp / need;
    if (S.xp >= need && S.lvl < 40) { S.xp = 0; S.lvl++; sfx.level(); floatText(P.pos.clone().add(new V3(0, 2.6, 0)), `SPEED ${S.lvl}!`, '#7dff8a', 1); save(); }
    hint('tread', 'Keep running to train your speed!');
  } else {
    // horizontal movement
    const hv = new THREE.Vector2(P.vel.x, P.vel.z);
    if (!P.rolling) {
      const acc = P.grounded ? 45 : 14, tx = wish.x * max, tz = wish.z * max, dx = tx - hv.x, dz = tz - hv.y, dl = Math.hypot(dx, dz), stepA = acc * dt;
      if (dl <= stepA) hv.set(tx, tz); else { hv.x += (dx / dl) * stepA; hv.y += (dz / dl) * stepA; }
    } else {
      const acc = P.grounded ? 18 : 6; hv.x += wish.x * acc * dt; hv.y += wish.z * acc * dt;
      if (P.grounded) {
        const gr = gradAt(P.pos.x, P.pos.z, P.pos.y); const along = gr.gx * hv.x + gr.gz * hv.y; const k = along > 0 ? 0.25 : 0.9;
        hv.x += -gr.gx * G * k * dt; hv.y += -gr.gz * G * k * dt;
        if (wish.length() < 0.1) hv.multiplyScalar(1 - Math.min(1, 1.6 * dt));
      }
      const sp = hv.length(), cap = max * (P.grounded ? 1.5 : 1.6); if (sp > max && wish.length() > 0.1) { const over = hv.clone().normalize(); const wDot = over.x * wish.x + over.y * wish.z; if (wDot > 0) hv.addScaledVector(new THREE.Vector2(wish.x, wish.z), -acc * dt); }
      if (sp > cap) hv.multiplyScalar(cap / sp);
      // boost strip at the bottom of the ramp
      if (P.grounded && P.pos.x > -5 && P.pos.x < 1 && P.pos.z < -79 && P.pos.z > -83.5 && hv.y < 0) { const s = Math.max(14, hv.length()); hv.set(hv.x * 0.3, -Math.sqrt(Math.max(0, s * s - hv.x * hv.x * 0.09))); if (Math.random() < 0.4) burst(P.pos.clone().add(new V3(0, 0.3, 0)), [0xffe066, 0xffffff], 2, 2, 2); }
    }
    P.vel.x = hv.x; P.vel.z = hv.y;
    const p = { x: P.pos.x + P.vel.x * dt, z: P.pos.z + P.vel.z * dt };
    const hit = pushOut(p, P.pos.y, 0.45);
    if (hit) { const vn = P.vel.x * hit.nx + P.vel.z * hit.nz; if (vn < 0) { const k = P.rolling ? 1.35 : 1; P.vel.x -= k * vn * hit.nx; P.vel.z -= k * vn * hit.nz; if (P.rolling && -vn > 6) { shake = 0.25; sfx.drop(); if (P.carry && -vn > 8 && P.pos.z < -6) { popEgg(P.carry, new V3(-hit.nx, 0, -hit.nz).negate(), 3); say('BONK! The egg flew out of your shell!'); } } } }
    P.pos.x = Math.max(BOUNDS.x0 + 0.5, Math.min(BOUNDS.x1 - 0.5, p.x)); P.pos.z = Math.max(BOUNDS.z0 + 0.5, Math.min(BOUNDS.z1 - 0.5, p.z));
  }
  // vertical
  if (inp.jump) P.jumpBuf = 0.13; else P.jumpBuf -= dt;
  P.coyote = P.grounded ? 0.1 : P.coyote - dt;
  const { g, box } = groundAt(P.pos.x, P.pos.z, P.pos.y);
  if (P.jumpBuf > 0 && P.coyote > 0 && P.dizzy <= 0) {
    P.vel.y = Math.max(P.vel.y, 0) + (buddyIs('bunny') ? 11.5 : 9.5); P.grounded = false; P.coyote = 0; P.jumpBuf = 0; sfx.jump(); P.squash = -0.15;
  } else if (P.grounded) {
    const follow = (g - P.pos.y) / dt;
    if (follow < P.vel.y - G * dt * 1.6 && P.pos.y - g > 0.05) P.grounded = false; // ground falls away faster than gravity: we are flying
    else { P.vel.y = Math.max(-20, Math.min(20, follow)); P.pos.y = g; }
  }
  if (!P.grounded) {
    P.vel.y -= G * dt; P.pos.y += P.vel.y * dt;
    const g2 = groundAt(P.pos.x, P.pos.z, P.pos.y);
    if (P.pos.y <= g2.g) {
      const impact = -P.vel.y; P.pos.y = g2.g; P.grounded = true;
      if (g2.box?.kind === 'mushroom') { P.vel.y = 16; P.grounded = false; sfx.bounce(); P.squash = 0.35; burst(P.pos.clone(), [0xff4d6d, 0xffffff], 8, 3, 4, true); hint('mush', 'Mushrooms bounce you up high!'); }
      else { P.vel.y = 0; if (impact > 10) { P.squash = Math.min(0.4, impact / 40); burst(P.pos.clone(), [0xd9c7a0, 0xffffff], 6, 2.5, 2, true); } }
    }
  } else if (box?.kind === 'mushroom') { P.vel.y = 16; P.grounded = false; sfx.bounce(); P.squash = 0.35; }
  // river
  if (P.pos.y < WATER_Y - 0.5 && isRiver(P.pos.z) && !onBridge(P.pos.x, P.pos.z)) {
    burst(new V3(P.pos.x, WATER_Y, P.pos.z), [0xbfe9ff, 0xffffff, 0x3ab0ff], 22, 4, 9); sfx.splash();
    if (P.carry) backToNest(P.carry);
    P.pos.copy(P.safe); P.vel.set(0, 0, 0); P.grounded = true; P.dizzy = 0.4;
    say('SPLASH! Roll fast and JUMP at the end of the ramp!');
  }
  P.safeT -= dt;
  if (P.grounded && P.safeT <= 0 && !isRiver(P.pos.z) && Math.abs(P.pos.z - RIVER_MID) > 8) { P.safe.copy(P.pos); P.safeT = 0.3; }
  if (P.pos.z < -70 && P.pos.z > -84 && P.pos.x > -10 && P.pos.x < 6) hint('ramp', 'ROLL (SHIFT / 🌀) over the yellow arrows, then JUMP at the top!');
  if (inFarm(P.pos.z)) { if (buddyIs('turtle') && !P.shield) { P.shield = true; } }
  if (!P.carry && !inFarm(P.pos.z) && P.pos.z < -120) hint('giant', 'Giant eggs are too heavy — bring the cart over the bridge!');
}

// ---------------- cart ----------------
function updateCart(dt: number) {
  const d = flat(P.pos, cart.pos), hv = new THREE.Vector2(P.vel.x, P.vel.z);
  P.pushing = false;
  const moving = hv.length() > 0.6;
  if (cart.held && (P.dizzy > 0 || d > 3.6 || !P.grounded && P.vel.y > 3)) cart.held = false;
  if (!cart.held && d < 2.7 && moving && P.dizzy <= 0 && P.grounded) { const to = new THREE.Vector2(cart.pos.x - P.pos.x, cart.pos.z - P.pos.z).normalize(); if (to.dot(hv.clone().normalize()) > -0.2) cart.held = true; }
  if (cart.held) {
    cart.idle = moving ? 0 : cart.idle + dt; if (cart.idle > 0.8) cart.held = false;
    if (moving) {
      P.pushing = true;
      // you hold the handle: the cart swings in front of you, like a shopping cart
      const dir = hv.clone().normalize(), tx = P.pos.x + dir.x * 2.3, tz = P.pos.z + dir.y * 2.3, cap = hv.length() * 1.8 + 3;
      let vx = hv.x + (tx - cart.pos.x) * 6, vz = hv.y + (tz - cart.pos.z) * 6; const l = Math.hypot(vx, vz); if (l > cap) { vx *= cap / l; vz *= cap / l; }
      cart.vel.x = vx; cart.vel.z = vz;
      hint('cart', 'Push the cart into a giant egg, then push it home!');
    }
  }
  if (!P.pushing) { const k = Math.min(1, (cart.grounded ? 2.5 : 0.2) * dt); cart.vel.x *= 1 - k; cart.vel.z *= 1 - k; }
  const nx = cart.pos.x + cart.vel.x * dt, nz = cart.pos.z + cart.vel.z * dt;
  const gN = groundAt(nx, nz, cart.pos.y).g;
  if (gN < -0.35 && !onBridge(nx, nz)) { cart.vel.x = cart.vel.z = 0; } // never roll into the river
  else {
    const p = { x: nx, z: nz }; const hit = pushOut(p, cart.pos.y, 1.3, 1.5);
    if (hit) { const vn = cart.vel.x * hit.nx + cart.vel.z * hit.nz; if (vn < 0) { cart.vel.x -= vn * hit.nx; cart.vel.z -= vn * hit.nz; } }
    cart.pos.x = Math.max(BOUNDS.x0 + 1.5, Math.min(BOUNDS.x1 - 1.5, p.x)); cart.pos.z = Math.max(BOUNDS.z0 + 1.5, Math.min(BOUNDS.z1 - 1.5, p.z));
  }
  // keep the hero behind the handle, not inside the cart
  if (d < 2.0) { const to = new V3(P.pos.x - cart.pos.x, 0, P.pos.z - cart.pos.z).normalize(); P.pos.x = cart.pos.x + to.x * 2.0; P.pos.z = cart.pos.z + to.z * 2.0; }
  // vertical: the same "follow the ground unless it drops away" rule as the hero
  const g = groundAt(cart.pos.x, cart.pos.z, cart.pos.y + 0.3).g, csp = Math.hypot(cart.vel.x, cart.vel.z);
  if (cart.grounded) {
    if (cart.pos.y - g < 0.1 + csp * dt * 0.8) { cart.vel.y = (g - cart.pos.y) / dt; cart.pos.y = g; } else cart.grounded = false;
    // speed bumps on the road: too fast and the cart hops
    for (const bz of BUMPS) if ((cart.pos.z - bz) * (cart.pos.z - cart.vel.z * dt - bz) <= 0 && roadDist(cart.pos.x, cart.pos.z) < 4.5 && (P.pushing ? Math.hypot(P.vel.x, P.vel.z) : csp) > 6.2) { cart.vel.y = csp * 0.6; cart.grounded = false; cart.pos.y += 0.05; }
  }
  if (!cart.grounded) {
    cart.air += dt; cart.vel.y -= G * dt; cart.pos.y += cart.vel.y * dt;
    if (cart.pos.y <= g) { const impact = -cart.vel.y, air = cart.air; cart.air = 0; cart.pos.y = g; cart.vel.y = 0; cart.grounded = true; sfx.drop(); burst(cart.pos.clone(), [0xd9c7a0], 6, 2, 2, true);
      if (impact > 3.5 && air > 0.2 && cart.egg) { popEgg(cart.egg, new V3(cart.vel.x, 0, cart.vel.z).normalize(), 2.5); say('Whoops! Too fast over the bump — scoop the egg up again!'); } }
  }
  const sp = Math.hypot(cart.vel.x, cart.vel.z);
  if (P.pushing) cart.yaw = angleLerp(cart.yaw, Math.atan2(-P.vel.x, -P.vel.z), Math.min(1, 8 * dt)); else if (sp > 0.3) cart.yaw = angleLerp(cart.yaw, Math.atan2(-cart.vel.x, -cart.vel.z), Math.min(1, 6 * dt));
  const gr = gradAt(cart.pos.x, cart.pos.z, cart.pos.y + 0.3);
  cart.root.position.copy(cart.pos); cart.root.rotation.set(0, cart.yaw, 0);
  const fx = -Math.sin(cart.yaw), fz = -Math.cos(cart.yaw);
  cart.root.rotateX(Math.atan(gr.gx * fx + gr.gz * fz) * 1);
  cart.wheels.forEach((w) => (w.rotation.x += (sp * dt) / 0.45));
}

// ---------------- hens ----------------
function updateHens(dt: number) {
  for (const h of hens) {
    const stolen = (P.carry && P.carry.nest === h.nest) || (cart.egg && cart.egg.nest === h.nest);
    const dP = flat(h.pos, P.pos);
    if (stolen && h.state !== 'chase') { h.state = 'chase'; h.bangT = 1.2; h.startle = h.size > 2 ? 2.2 : 1.3; if (h.size > 2) say('Mama Hen is waking up... GO GO GO!'); sfx.cluck(); shake = 0.15; }
    h.startle -= dt;
    if (h.state === 'chase') {
      if (!stolen || dP > 60) h.state = 'back';
    }
    let target: THREE.Vector3 = h.state === 'chase' ? P.pos : h.state === 'back' ? h.home : h.wander;
    if (h.state === 'idle') { h.wanderT -= dt; if (h.wanderT <= 0 || flat(h.pos, h.wander) < 0.3) { h.wanderT = rnd(1.5, 4); const a = rnd(0, 6.28), r = rnd(0, 2.5 * h.size); h.wander.set(h.home.x + Math.cos(a) * r, 0, h.home.z + Math.sin(a) * r); } }
    // crossing the river: hens use the bridge
    const hs = h.pos.z > RIVER_MID, ts = target.z > RIVER_MID;
    if (hs !== ts) { const nearEnd = new V3(31, 0, hs ? -89.5 : -109.5), farEnd = new V3(31, 0, hs ? -110 : -89); target = onBridge(h.pos.x, h.pos.z) || flat(h.pos, nearEnd) < 1.5 ? farEnd : nearEnd; }
    const speed = h.state === 'chase' ? (h.startle > 0 ? 0 : h.speed) : h.state === 'back' ? h.speed * 0.6 : 1.2;
    const dx = target.x - h.pos.x, dz = target.z - h.pos.z, dist = Math.hypot(dx, dz), stop = h.state === 'chase' ? 0.8 * h.size : 0.05;
    let moving = false;
    if (dist > stop) {
      const st = Math.min(speed * dt, dist - stop), ux = dx / dist, uz = dz / dist;
      for (const [cx, cz] of [[h.pos.x + ux * st, h.pos.z + uz * st], [h.pos.x + ux * st, h.pos.z], [h.pos.x, h.pos.z + uz * st]]) {
        const gg = groundAt(cx, cz, h.pos.y).g; if (gg < -0.35 && !onBridge(cx, cz)) continue;
        if (cz > -3) continue;
        const p = { x: cx, z: cz }; pushOut(p, h.pos.y, 0.5 * h.size, 1.5 * h.size); h.pos.x = p.x; h.pos.z = p.z; moving = true; break;
      }
      h.yaw = angleLerp(h.yaw, Math.atan2(ux, uz), Math.min(1, 10 * dt));
    }
    h.pos.y = groundAt(h.pos.x, h.pos.z, h.pos.y).g;
    if (h.state === 'back' && dist < 0.6) h.state = 'idle';
    // attacks
    h.cd -= dt; h.flapT -= dt; h.bangT -= dt;
    if (h.state === 'chase' && h.startle <= 0 && h.cd <= 0 && dP < 1.0 * h.size + 0.8 && Math.abs(P.pos.y - h.pos.y) < 1.5 * h.size && P.dizzy <= 0) {
      h.cd = 1.3; h.flapT = 0.5; sfx.flap(); sfx.cluck(); shake = 0.2;
      const away = new V3(P.pos.x - h.pos.x, 0, P.pos.z - h.pos.z).normalize();
      burst(P.pos.clone().add(new V3(0, 1, 0)), [0xffffff, 0xf2e6d0], 12, 3, 4);
      if (P.shield) { P.shield = false; P.vel.x = away.x * 5; P.vel.z = away.z * 5; floatText(P.pos.clone().add(new V3(0, 2.4, 0)), '🐢 BLOCKED!', '#7dff8a'); }
      else {
        P.vel.set(away.x * (h.size > 2 ? 13 : 10), 7, away.z * (h.size > 2 ? 13 : 10)); P.grounded = false; P.dizzy = 0.9;
        if (P.carry) { popEgg(P.carry, away, 3); hint('hit', 'The hen knocked the egg out! Grab it again — or roll to escape faster!', true); }
      }
    }
    if (h.size > 2 && h.state === 'chase' && cart.egg && flat(h.pos, cart.pos) < 2.7 && h.cd <= 0) { h.cd = 1.3; h.flapT = 0.5; sfx.flap(); popEgg(cart.egg, new V3(cart.pos.x - h.pos.x, 0, cart.pos.z - h.pos.z).normalize(), 3); say('Mama Hen knocked the egg out of the cart!'); }
    if (h.size > 2 && h.state === 'chase') {
      h.stompT -= dt;
      if (h.stompT <= 0) {
        h.stompT = 1.8; sfx.stomp(); shake = 0.35; shock(h.pos, 9);
        if (P.grounded && dP < 9) { const away = new V3(P.pos.x - h.pos.x, 0, P.pos.z - h.pos.z).normalize(); P.vel.y = 5; P.grounded = false; P.vel.x += away.x * 3; P.vel.z += away.z * 3; }
        const dc = flat(h.pos, cart.pos); if (dc < 9 && cart.grounded) { cart.vel.y = 3; cart.grounded = false; if (dc < 4 && cart.egg) { popEgg(cart.egg, new V3(cart.pos.x - h.pos.x, 0, cart.pos.z - h.pos.z).normalize(), 2); say('The STOMP shook the egg out! Stay ahead of Mama Hen!'); } }
      }
    }
    // animation
    const m = h.m; m.root.position.copy(h.pos); m.root.rotation.y = h.yaw;
    h.walkPh += dt * (moving ? speed * 3 : 0);
    m.legs.forEach((l, i) => (l.rotation.x = Math.sin(h.walkPh + i * Math.PI) * 0.6 * (moving ? 1 : 0)));
    const flap = h.flapT > 0 ? Math.sin(time * 40) * 1.2 : h.state === 'chase' ? Math.sin(time * 18) * 0.5 : 0;
    m.wings[0].rotation.z = 0.2 + flap; m.wings[1].rotation.z = -0.2 - flap;
    m.head.rotation.x = h.state === 'idle' && !moving ? Math.max(0, Math.sin(time * 3 + h.nest)) * 0.7 : 0;
    m.brows.forEach((b) => (b.visible = h.state === 'chase'));
    m.bang.visible = h.bangT > 0; m.root.position.y += moving ? Math.abs(Math.sin(h.walkPh)) * 0.08 * h.size : 0;
  }
}

// ---------------- farm: incubators, pets, pads ----------------
function updateFarm(dt: number, inp: Input) {
  pens.forEach((pen) => {
    if (pen.egg && pen.egg.t >= 1) {
      pen.t += dt; const left = Math.max(0, Math.ceil(pen.need - pen.t));
      if (left !== pen.shown) { pen.shown = left; if (pen.label) pen.root.remove(pen.label); pen.label = textSprite(`🥚 ${left}s`, { size: 50, scale: 0.7, bg: 'rgba(0,0,0,.5)' }); pen.label.position.y = 3.2; pen.root.add(pen.label); }
      if (pen.t >= pen.need) hatch(pen);
    }
  });
  // pets
  const chick = buddyIs('chick') ? 1.25 : 1;
  for (const p of pets) {
    const follow = S.buddy === p.idx;
    p.coins += petRate(p.s) * chick * dt;
    if (follow) {
      const back = new V3(Math.sin(P.face), 0, Math.cos(P.face)).multiplyScalar(-2.2);
      p.target.set(P.pos.x + back.x + 0.8, 0, P.pos.z + back.z);
      if (flat(p.pos, P.pos) > 25) p.pos.copy(p.target);
    } else {
      p.tWander -= dt; if (p.tWander <= 0) { p.tWander = rnd(2, 5); p.target.set(rnd(-16, 12), 0, rnd(17, 25)); }
    }
    const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z, d = Math.hypot(dx, dz);
    const sp = follow ? Math.max(4, Math.hypot(P.vel.x, P.vel.z) + 1.5) : 1.6;
    if (d > 0.2) { const st = Math.min(d, sp * dt); p.pos.x += (dx / d) * st; p.pos.z += (dz / d) * st; p.m.rotation.y = angleLerp(p.m.rotation.y, Math.atan2(dx, dz), Math.min(1, 8 * dt)); p.hop += dt * 12; }
    p.pos.y = groundAt(p.pos.x, p.pos.z, p.pos.y + 1).g;
    p.m.position.set(p.pos.x, p.pos.y + Math.abs(Math.sin(p.hop)) * 0.25, p.pos.z);
    const c = Math.floor(p.coins);
    if (c !== p.shown && (c - p.shown >= 1 || c < p.shown)) { p.shown = c; if (p.label) p.m.remove(p.label); if (c > 0) { p.label = textSprite(`🪙 ${c}`, { size: 50, scale: 0.55 / p.m.scale.x, color: '#ffe14a' }); p.label.position.y = 1.6; p.m.add(p.label); } else p.label = null; }
    if (c > 0 && flat(p.pos, P.pos) < 2.4) { S.coins += c; p.coins -= c; p.shown = -1; floatText(p.pos.clone().add(new V3(0, 2, 0)), `+${c} 🪙`); sfx.coin(); hint('coins', 'Pets make coins! Walk near them to collect. Spend coins on the orange pad.'); }
  }
  // buddy toggle
  hud.prompt = '';
  if (inFarm(P.pos.z)) {
    let near: Pet | null = null, nd = 2.6;
    for (const p of pets) { const d = flat(p.pos, P.pos); if (d < nd) { nd = d; near = p; } }
    if (near) {
      const isB = S.buddy === near.idx;
      hud.prompt = isB ? `${PET_NAME[near.s.type]} is your buddy` : `Take ${PET_NAME[near.s.type]} as buddy (${PET_POWER[near.s.type]})`;
      if (inp.act && !isB) { S.buddy = near.idx; P.shield = near.s.type === 'turtle'; sfx.buy(); floatText(near.pos.clone().add(new V3(0, 2.2, 0)), 'BUDDY!', '#7dff8a'); save(); }
    }
  }
  // pads
  const onT = flat(P.pos, treadPad.position) < 1.3, onP = flat(P.pos, penPad.position) < 1.3;
  const latch = onT ? 'T' : onP ? 'P' : '';
  if (latch && latch !== padLatch) {
    if (latch === 'T') { if (S.tier + 1 >= TIERS.length) say('Your treadmill is already the fastest!'); else if (S.coins >= TIER_COST[S.tier + 1]) { S.coins -= TIER_COST[S.tier + 1]; S.tier++; sfx.buy(); say(`Treadmill upgraded! Training ×${TIERS[S.tier]}`); save(); refreshPadLabels(); burst(treadPad.position.clone().add(new V3(0, 1, 0)), [0xffd23f, 0xff6b6b, 0x7dff8a], 24, 4, 7); } else { sfx.no(); say(`You need ${TIER_COST[S.tier + 1]} 🪙 — collect coins from your pets!`); } }
    if (latch === 'P') { if (S.pens >= 4) say('All incubators are open!'); else if (S.coins >= PEN_COST) { S.coins -= PEN_COST; S.pens++; const pen = pens[S.pens - 1]; if (pen.lock) { pen.root.remove(pen.lock); pen.lock = null; } sfx.buy(); say('New incubator!'); save(); refreshPadLabels(); } else { sfx.no(); say(`You need ${PEN_COST} 🪙 for a new incubator.`); } }
  }
  padLatch = latch;
  if (onT || onP) hint('pads', 'Step on a pad to buy an upgrade.');
}
function hatch(pen: Pen) {
  const e = pen.egg!; pen.egg = null; pen.t = 0; if (pen.label) { pen.root.remove(pen.label); pen.label = null; } pen.shown = -1;
  scene.remove(e.m); e.state = 'gone';
  const r = Math.random(); let type: PetType;
  if (e.kind === 's') type = r < 0.72 ? 'chick' : 'bunny'; else if (e.kind === 'm') type = r < 0.5 ? 'bunny' : r < 0.9 ? 'turtle' : 'fox'; else type = r < 0.35 ? 'turtle' : 'fox';
  const s: PetSave = { type, kg: e.kg, gold: e.gold, egg: e.kind }; S.pets.push(s); const idx = S.pets.length - 1;
  if (S.buddy < 0) S.buddy = idx;
  makePetObj(s, idx, pen.pos.clone().add(new V3(0, 0.5, 1.6)));
  sfx.hatch(); shake = 0.15;
  burst(pen.pos.clone().add(new V3(0, 1.2, 0)), [0xffd23f, 0xff6b6b, 0x5bd6ff, 0x7dff8a, 0xffffff], 40, 5, 9);
  hud.card = { title: `${e.gold ? '✨ GOLDEN ' : ''}${PET_NAME[type].toUpperCase()}!`, sub: `${e.kg} kg  ·  +${petRate(s)} 🪙/sec  ·  ${PET_POWER[type]}`, gold: e.gold, t: 3.8 };
  hint('hatch', 'Your pet makes coins! Walk near it to collect. Press E / ✋ near a pet to take it as your buddy.', true);
  save();
}

// ---------------- hero animation + camera ----------------
function animateHero(dt: number) {
  const sp = Math.hypot(P.vel.x, P.vel.z);
  if (sp > 0.4 && !P.onTread && P.dizzy <= 0) P.face = angleLerp(P.face, Math.atan2(P.vel.x, P.vel.z), Math.min(1, (P.rolling ? 6 : 14) * dt));
  hero.root.position.copy(P.pos); hero.root.rotation.y = P.face;
  hero.walk.visible = !P.rolling; hero.ball.visible = P.rolling;
  if (P.rolling) { hero.spin.rotation.x += (sp * dt) / 0.64; if (P.grounded && sp > 3 && Math.random() < sp * dt * 1.5) burst(P.pos.clone().add(new V3(rnd(-0.3, 0.3), 0.1, rnd(-0.3, 0.3))), [0xe9dcc0, 0xffffff], 2, 1.2, 1.5, true); }
  else { if (!P.onTread) P.walkPh += dt * sp * 2.2; hero.legs.forEach((l, i) => (l.rotation.x = Math.sin(P.walkPh + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * (sp > 0.4 || P.onTread ? 0.8 : 0))); hero.walk.position.y = sp > 0.4 || P.onTread ? Math.abs(Math.sin(P.walkPh)) * 0.08 : 0; hero.walk.rotation.z = P.dizzy > 0 ? Math.sin(time * 20) * 0.2 : 0; }
  P.squash += (0 - P.squash) * Math.min(1, 10 * dt);
  hero.root.scale.set(1 + P.squash * 0.6, 1 - P.squash, 1 + P.squash * 0.6);
  dizzyStars.visible = P.dizzy > 0; dizzyStars.position.set(Math.sin(time * 8) * 0.3, 2.1, Math.cos(time * 8) * 0.3);
}
export function rotateCamera(dx: number) { camYaw -= dx * 0.006; dragT = 1.2; }
function updateCamera(dt: number) {
  const sp = Math.hypot(P.vel.x, P.vel.z);
  dragT -= dt;
  if (dragT <= 0 && sp > 2 && !P.onTread) {
    const want = Math.atan2(-P.vel.x, -P.vel.z); let d = ((want - camYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(d) < 2.3) camYaw += d * Math.min(1, 1.6 * dt * Math.min(1, sp / 6));
  }
  const D = 9.5, Hh = 4.6, tgt = new V3(P.pos.x, P.pos.y + 1.3, P.pos.z);
  const want = new V3(tgt.x + Math.sin(camYaw) * D, tgt.y + Hh, tgt.z + Math.cos(camYaw) * D);
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
  updatePlayer(dt, inp);
  updateCart(dt);
  updateEggs(dt);
  updateHens(dt);
  updateFarm(dt, inp);
  animateHero(dt);
  updateCamera(dt);
  world.update(time);
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t -= dt; p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt; (p.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, p.t * 2); if (p.t <= 0) { scene.remove(p.m); (p.m.material as THREE.Material).dispose(); parts.splice(i, 1); } }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t -= dt; f.s.position.y += dt * 1.4; f.s.material.opacity = Math.min(1, f.t * 2); if (f.t <= 0) { scene.remove(f.s); floats.splice(i, 1); } }
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const s = 1 + r.t * r.max * 1.5; r.m.scale.set(s, s, s); (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - r.t * 1.4); if (r.t > 0.6) { scene.remove(r.m); rings.splice(i, 1); } }
  if (hud.hintT > 0) hud.hintT -= dt;
  if (hud.card) { hud.card.t -= dt; if (hud.card.t <= 0) hud.card = null; }
  saveT -= dt; if (saveT <= 0) { saveT = 3; save(); }
}
export const state = { P, cart, hens, eggs, pets, S: () => S, camYaw: () => camYaw };
