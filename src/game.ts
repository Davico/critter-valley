import * as THREE from 'three';
import { BASE_Z, BOUNDS, BUMPS, roadDist, NESTS, RIVER_MID, WATER_Y, buildWorld, groundAt, isRiver, onBridge, pushOut, terrainH, textSprite, type WorldDeco } from './world';
import { EGG_R, makeCart, makeHen, makeHero, makeNest, makePad, makeSnack, makeTreadmill, type HenMesh } from './models';
import { sfx } from './audio';
import { S, save } from './save';
import { burst, floatText, hint, hud, say, shock, updateFx, setFxScene } from './fx';
import { buddyIs, build, initCamp, pantryPos, updateCamp, FOOD_ICON } from './camp';

export interface Input { x: number; y: number; jump: boolean; roll: boolean; act: boolean }
type Kind = 's' | 'm' | 'b';
const V3 = THREE.Vector3;
const G = 26;
const TIERS = [1, 2, 3.5, 6], TIER_COST = [0, 60, 250, 800];
const TREAD = { x: 16, z: 12 };
const SNACK_NAME: Record<Kind, string> = { s: 'STRAWBERRIES', m: 'HONEY', b: 'GIANT MELON · use the 🛒' };

// ---------------- entities ----------------
interface Snack { kind: Kind; gold: boolean; nest: number; slot: number; state: 'nest' | 'held' | 'cart' | 'loose' | 'fly' | 'gone'; pos: THREE.Vector3; vel: THREE.Vector3; m: THREE.Group; t: number; from?: THREE.Vector3 }
interface Hen { nest: number; size: number; speed: number; home: THREE.Vector3; pos: THREE.Vector3; yaw: number; state: 'idle' | 'chase' | 'back'; cd: number; flapT: number; stompT: number; wanderT: number; wander: THREE.Vector3; m: HenMesh; bangT: number; walkPh: number; startle: number }

let scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: WorldDeco;
const snacks: Snack[] = [], hens: Hen[] = [];
const respawns: { nest: number; slot: number; t: number }[] = [];
const hero = makeHero();
const P = { pos: new V3(0, 0, 7), vel: new V3(), face: Math.PI, grounded: true, rolling: false, dizzy: 0, carry: null as Snack | null, shield: false, safe: new V3(0, 0, 7), safeT: 0, onTread: false, coyote: 0, jumpBuf: 0, squash: 0, walkPh: 0, pushing: false, wasRoll: false };
const cart = { pos: new V3(7, 0, -4), vel: new V3(), yaw: Math.PI, grounded: true, air: 0, held: false, idle: 0, snack: null as Snack | null, ...makeCart() };
let tread: ReturnType<typeof makeTreadmill>, treadPad: THREE.Group, treadLabel: THREE.Sprite;
let padLatch = '';
let camYaw = 0, dragT = 0, shake = 0, time = 0;
const dizzyStars = textSprite('★ ★', { size: 60, color: '#fff36b', scale: 0.5 });

// ---------------- helpers ----------------
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
function angleLerp(a: number, b: number, t: number) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
function slotPos(n: number, slot: number): THREE.Vector3 {
  const N = NESTS[n], sz = N.kind === 'b' ? 2 : 1, a = (slot / N.count) * Math.PI * 2, r = N.count > 1 ? 0.65 * sz : 0;
  const x = N.x + Math.cos(a) * r, z = N.z + Math.sin(a) * r; return new V3(x, terrainH(N.x, N.z) + 0.2 * sz, z);
}
function gradAt(x: number, z: number, y: number) { const e = 0.3; return { gx: (groundAt(x + e, z, y).g - groundAt(x - e, z, y).g) / (2 * e), gz: (groundAt(x, z + e, y).g - groundAt(x, z - e, y).g) / (2 * e) }; }
const inFarm = (z: number) => z > BASE_Z + 0.5;

// ---------------- setup ----------------
function spawnSnack(n: number, slot: number) {
  const N = NESTS[n], kind = N.kind, gold = Math.random() < (kind === 'b' ? 0.2 : 0.1);
  const e: Snack = { kind, gold, nest: n, slot, state: 'nest', pos: slotPos(n, slot), vel: new V3(), m: makeSnack(kind, gold), t: 0 };
  e.m.position.copy(e.pos); e.m.rotation.y = Math.random() * 6; scene.add(e.m); snacks.push(e);
  if (gold) { const sp = textSprite('✨ GOLDEN', { size: 46, color: '#fff3a0', scale: 0.6 }); sp.position.set(0, EGG_R[kind] * 2.6 + 0.5, 0); e.m.add(sp); }
}

export function init(sc: THREE.Scene, cam: THREE.PerspectiveCamera) {
  scene = sc; camera = cam; setFxScene(sc);
  world = buildWorld(scene);
  scene.add(hero.root);
  NESTS.forEach((N, n) => {
    const nest = makeNest(N.kind === 'b' ? 2 : 1); nest.position.set(N.x, terrainH(N.x, N.z), N.z); scene.add(nest);
    for (let i = 0; i < N.count; i++) spawnSnack(n, i);
    const home = new V3(N.x + 1.2 * N.henSize, 0, N.z - 2.4 * N.henSize); home.y = terrainH(home.x, home.z);
    const hm = makeHen(N.henSize, N.kind === 'b' ? 0xa0673a : N.kind === 'm' ? 0xfff3e6 : 0xffffff); scene.add(hm.root);
    hens.push({ nest: n, size: N.henSize, speed: N.henSpeed, home, pos: home.clone(), yaw: 0, state: 'idle', cd: 0, flapT: 0, stompT: 1.5, wanderT: 0, wander: home.clone(), m: hm, bangT: 0, walkPh: 0, startle: 0 });
    const lbl = textSprite(`${FOOD_ICON[N.kind]} ${SNACK_NAME[N.kind]}`, { size: 44, scale: 0.9, bg: 'rgba(0,0,0,.45)' }); lbl.position.set(N.x, terrainH(N.x, N.z) + (N.kind === 'b' ? 6 : 3.4), N.z); scene.add(lbl);
  });
  cart.pos.y = terrainH(cart.pos.x, cart.pos.z); scene.add(cart.root);
  tread = makeTreadmill(); tread.root.position.set(TREAD.x, 0, TREAD.z); scene.add(tread.root);
  const ts = textSprite('🏃 TRAINING', { size: 52, scale: 1, bg: '#e0621e' }); ts.position.set(TREAD.x, 3.2, TREAD.z - 2.4); scene.add(ts);
  treadPad = makePad(0xe0621e); treadPad.position.set(TREAD.x + 4, 0, TREAD.z + 3); scene.add(treadPad);
  refreshPadLabels();
  initCamp(scene, P);
  hero.root.add(dizzyStars); dizzyStars.position.y = 2.1; dizzyStars.visible = false;
  hint('start', 'Grab a 🍓 from the grumpy hen and bring it home!  (WASD / joystick)');
}
function refreshPadLabels() {
  if (treadLabel) scene.remove(treadLabel);
  const t = S.tier + 1 < TIERS.length ? `⚡ Faster treadmill: ${TIER_COST[S.tier + 1]} 🪙` : '⚡ Treadmill MAX';
  treadLabel = textSprite(t, { size: 44, scale: 0.6, bg: 'rgba(0,0,0,.55)' }); treadLabel.position.set(TREAD.x + 4, 2.2, TREAD.z + 3); scene.add(treadLabel);
}

// ---------------- snacks ----------------
function popSnack(e: Snack, dir: THREE.Vector3, power = 4) {
  e.state = 'loose'; e.t = 0; e.vel.set(dir.x * power + rnd(-1, 1), 6, dir.z * power + rnd(-1, 1));
  if (P.carry === e) P.carry = null; if (cart.snack === e) cart.snack = null;
  e.m.visible = true; sfx.drop();
}
function backToNest(e: Snack) {
  burst(e.pos.clone().add(new V3(0, 0.5, 0)), [0xffffff, 0xdddddd], 10, 3, 3, true);
  e.state = 'nest'; e.pos.copy(slotPos(e.nest, e.slot)); e.vel.set(0, 0, 0); e.m.visible = true; e.m.rotation.set(0, e.m.rotation.y, 0);
  if (P.carry === e) P.carry = null; if (cart.snack === e) cart.snack = null;
}
function deliver(e: Snack) {
  e.state = 'fly'; e.t = 0; e.from = e.pos.clone(); e.m.visible = true;
  if (P.carry === e) P.carry = null; if (cart.snack === e) cart.snack = null;
  respawns.push({ nest: e.nest, slot: e.slot, t: 10 });
}
function arrive(e: Snack) {
  e.state = 'gone'; scene.remove(e.m);
  const f = e.gold ? 'gold' : e.kind; S.pantry[f]++; S.delivered++;
  if (buddyIs('hen')) S.coins += 2;
  sfx.place(); burst(pantryPos.clone().add(new V3(0, 0.6, 0)), [0xffd23f, 0xffffff, 0x7dff8a], 18, 3, 5);
  floatText(pantryPos.clone().add(new V3(0, 2.2, 0)), `+1 ${FOOD_ICON[f]}`, '#7dff8a', 1);
  hint('placed', 'Yum! Snacks go to your 🧺 Pantry. Animals come to eat them — wait and see!');
  save();
}
function updateSnacks(dt: number) {
  for (let i = snacks.length - 1; i >= 0; i--) if (snacks[i].state === 'gone') snacks.splice(i, 1);
  for (const e of snacks) {
    if (e.state === 'nest') { e.m.position.copy(e.pos); e.m.rotation.z = Math.sin(time * 2 + e.slot) * 0.05; continue; }
    if (e.state === 'held') {
      if (P.rolling) e.m.visible = false; else { e.m.visible = true; hero.hold.getWorldPosition(e.pos); e.pos.y -= EGG_R[e.kind] * 0.6; e.m.position.copy(e.pos); e.m.rotation.set(Math.sin(time * 9) * 0.08 * (P.vel.length() > 1 ? 1 : 0), P.face, 0); }
      continue;
    }
    if (e.state === 'cart') { cart.seat.getWorldPosition(e.pos); e.pos.y -= 0.6; e.m.position.copy(e.pos); e.m.rotation.set(cart.root.rotation.x, cart.yaw, cart.root.rotation.z + Math.sin(time * 6) * 0.04 * Math.min(1, Math.hypot(cart.vel.x, cart.vel.z))); continue; }
    if (e.state === 'fly') {
      e.t = Math.min(1, e.t + dt * 1.6); const k = e.t; e.pos.lerpVectors(e.from!, pantryPos, k); e.pos.y += Math.sin(k * Math.PI) * 4; e.m.position.copy(e.pos); e.m.scale.setScalar(1 - k * 0.5); e.m.rotation.y += dt * 8;
      if (e.t >= 1) arrive(e); continue;
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
      else if (e.pos.z > -1.5 && e.kind !== 'b' && e.t > 0.6) deliver(e);
    }
  }
  for (let i = respawns.length - 1; i >= 0; i--) { const r = respawns[i]; r.t -= dt; if (r.t <= 0) { respawns.splice(i, 1); if (!snacks.some((e) => e.nest === r.nest && e.slot === r.slot && (e.state === 'nest' || e.state === 'loose' || e.state === 'held' || e.state === 'cart'))) spawnSnack(r.nest, r.slot); } }
  // the cart scoops up the giant melon when pushed into it
  if (!cart.snack) for (const e of snacks) if (e.kind === 'b' && (e.state === 'nest' || (e.state === 'loose' && e.t > 0.5)) && flat(e.pos, cart.pos) < 2.4) { cart.snack = e; e.state = 'cart'; sfx.grab(); floatText(e.pos.clone().add(new V3(0, 3, 0)), 'Into the cart!', '#7dff8a'); hint('cartgo', 'Turn around and push the cart HOME! Slow down on the bumps!', true); break; }
  // pick up
  if (P.dizzy <= 0 && !P.carry) {
    for (const e of snacks) {
      if (e.state !== 'nest' && e.state !== 'loose') continue;
      const d = flat(e.pos, P.pos), reach = EGG_R[e.kind] + 0.9;
      if (d > reach || Math.abs(e.pos.y - P.pos.y) > 2.5) continue;
      if (e.state === 'loose' && e.t < 0.5) continue;
      if (e.kind === 'b') {
        if (!cart.snack && flat(cart.pos, e.pos) < 5) { cart.snack = e; e.state = 'cart'; sfx.grab(); floatText(e.pos.clone().add(new V3(0, 3, 0)), 'Into the cart!', '#7dff8a'); hint('cartgo', 'Push the cart home! Careful on the bumps!', true); }
        else hint('heavy', 'Too heavy to carry! Bring the 🛒 cart from the farm gate.', true);
        continue;
      }
      P.carry = e; e.state = 'held'; sfx.grab(); hint('run', 'RUN HOME!  Hold SHIFT / 🌀 to roll faster!');
      break;
    }
  }
  if (P.carry && P.pos.z > -1.5) deliver(P.carry);
  if (cart.snack && cart.pos.z > -2) deliver(cart.snack);
}

// ---------------- player ----------------
function updatePlayer(dt: number, inp: Input) {
  const lvlSpd = 0.22 * S.lvl, fox = buddyIs('fox') ? 1.1 : buddyIs('deer') ? 1.12 : 1;
  P.rolling = inp.roll && P.dizzy <= 0 && !P.onTread;
  if (P.rolling && !P.wasRoll) sfx.roll(); P.wasRoll = P.rolling;
  const carryMul = P.carry && !buddyIs('raccoon') ? (P.carry.kind === 's' ? 0.92 : 0.8) : 1;
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
    if (hit) { const vn = P.vel.x * hit.nx + P.vel.z * hit.nz; if (vn < 0) { const k = P.rolling ? 1.35 : 1; P.vel.x -= k * vn * hit.nx; P.vel.z -= k * vn * hit.nz; if (P.rolling && -vn > 6) { shake = 0.25; sfx.drop(); if (P.carry && -vn > 8 && P.pos.z < -6) { popSnack(P.carry, new V3(-hit.nx, 0, -hit.nz).negate(), 3); say('BONK! The snack flew out of your shell!'); } } } }
    P.pos.x = Math.max(BOUNDS.x0 + 0.5, Math.min(BOUNDS.x1 - 0.5, p.x)); P.pos.z = Math.max(BOUNDS.z0 + 0.5, Math.min(BOUNDS.z1 - 0.5, p.z));
  }
  // vertical
  if (inp.jump) P.jumpBuf = 0.13; else P.jumpBuf -= dt;
  P.coyote = P.grounded ? 0.1 : P.coyote - dt;
  const { g, box } = groundAt(P.pos.x, P.pos.z, P.pos.y);
  if (P.jumpBuf > 0 && P.coyote > 0 && P.dizzy <= 0) {
    P.vel.y = Math.max(P.vel.y, 0) + (buddyIs('bunny') ? 11.5 : buddyIs('deer') ? 11 : 9.5); P.grounded = false; P.coyote = 0; P.jumpBuf = 0; sfx.jump(); P.squash = -0.15;
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
  if (!P.carry && !inFarm(P.pos.z) && P.pos.z < -120) hint('giant', 'The giant melon is too heavy — bring the 🛒 cart over the bridge!');
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
      hint('cart', 'Push the cart into the giant melon, then push it home!');
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
      if (impact > 3.5 && air > 0.2 && cart.snack) { popSnack(cart.snack, new V3(cart.vel.x, 0, cart.vel.z).normalize(), 2.5); say('Whoops! Too fast over the bump — scoop the melon up again!'); } }
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
    const stolen = (P.carry && P.carry.nest === h.nest) || (cart.snack && cart.snack.nest === h.nest);
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
        if (P.carry) { popSnack(P.carry, away, 3); hint('hit', 'The hen knocked the snack out! Grab it again — or roll to escape faster!', true); }
      }
    }
    if (h.size > 2 && h.state === 'chase' && cart.snack && flat(h.pos, cart.pos) < 2.7 && h.cd <= 0) { h.cd = 1.3; h.flapT = 0.5; sfx.flap(); popSnack(cart.snack, new V3(cart.pos.x - h.pos.x, 0, cart.pos.z - h.pos.z).normalize(), 3); say('Mama Hen knocked the melon out of the cart!'); }
    if (h.size > 2 && h.state === 'chase') {
      h.stompT -= dt;
      if (h.stompT <= 0) {
        h.stompT = 1.8; sfx.stomp(); shake = 0.35; shock(h.pos, 9);
        if (P.grounded && dP < 9) { const away = new V3(P.pos.x - h.pos.x, 0, P.pos.z - h.pos.z).normalize(); P.vel.y = 5; P.grounded = false; P.vel.x += away.x * 3; P.vel.z += away.z * 3; }
        const dc = flat(h.pos, cart.pos); if (dc < 9 && cart.grounded) { cart.vel.y = 3; cart.grounded = false; if (dc < 4 && cart.snack) { popSnack(cart.snack, new V3(cart.pos.x - h.pos.x, 0, cart.pos.z - h.pos.z).normalize(), 2); say('The STOMP shook the melon out! Stay ahead of Mama Hen!'); } }
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

// ---------------- treadmill pad ----------------
function updatePads() {
  const onT = flat(P.pos, treadPad.position) < 1.3, latch = onT ? 'T' : '';
  if (latch && latch !== padLatch) {
    if (S.tier + 1 >= TIERS.length) say('Your treadmill is already the fastest!');
    else if (S.coins >= TIER_COST[S.tier + 1]) { S.coins -= TIER_COST[S.tier + 1]; S.tier++; sfx.buy(); say(`Treadmill upgraded! Training ×${TIERS[S.tier]}`); save(); refreshPadLabels(); burst(treadPad.position.clone().add(new V3(0, 1, 0)), [0xffd23f, 0xff6b6b, 0x7dff8a], 24, 4, 7); }
    else { sfx.no(); say(`You need ${TIER_COST[S.tier + 1]} 🪙 — animals give coins as gifts!`); }
  }
  padLatch = latch;
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
let camD = 9.5, camH = 4.6;
function updateCamera(dt: number) {
  const sp = Math.hypot(P.vel.x, P.vel.z);
  dragT -= dt;
  if (!build.on && dragT <= 0 && sp > 2 && !P.onTread) {
    const want = Math.atan2(-P.vel.x, -P.vel.z); const d = ((want - camYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(d) < 2.3) camYaw += d * Math.min(1, 1.6 * dt * Math.min(1, sp / 6));
  }
  camD += ((build.on ? 12 : 9.5) - camD) * Math.min(1, 4 * dt); camH += ((build.on ? 9 : 4.6) - camH) * Math.min(1, 4 * dt);
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
  updatePlayer(dt, inp);
  updateCart(dt);
  updateSnacks(dt);
  updateHens(dt);
  updateCamp(dt, P, inp.act && !build.on, time);
  updatePads();
  if (inFarm(P.pos.z) && buddyIs('turtle')) P.shield = true;
  if (hud.shake > 0) { shake = Math.max(shake, hud.shake); hud.shake = 0; }
  animateHero(dt);
  updateCamera(dt);
  world.update(time);
  updateFx(dt);
  saveT -= dt; if (saveT <= 0) { saveT = 3; save(); }
}
export const state = { P, cart, hens, snacks, S: () => S, camYaw: () => camYaw };
export { S };
