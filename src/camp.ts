import * as THREE from 'three';
import { BOXES, groundAt, terrainH, textSprite, toon, mesh, type Box } from './world';
import { blockGeo, blockMaterial, makeAnimal, makePantry, makeSpecial } from './models';
import { S, save, pantry, addPantry } from './save';
import { FOOD_ICON, type Food } from './snacks';
import { burst, card, floatText, hint, hud, say } from './fx';
import { sfx } from './audio';

const V3 = THREE.Vector3;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
function angleLerp(a: number, b: number, t: number) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }

// ---------------- palette ----------------
export interface Tool { id: string; icon: string; name: string; cost: number; block: boolean; biome?: string }
export const PALETTE: Tool[] = [
  { id: 'grass', icon: '🟩', name: 'Grass', cost: 0, block: true },
  { id: 'wood', icon: '🟫', name: 'Wood', cost: 0, block: true },
  { id: 'stone', icon: '🪨', name: 'Stone', cost: 0, block: true },
  { id: 'brick', icon: '🧱', name: 'Brick', cost: 0, block: true },
  { id: 'flower', icon: '🌸', name: 'Flowers', cost: 0, block: false },
  { id: 'hay', icon: '🌾', name: 'Hay', cost: 25, block: false },
  { id: 'pond', icon: '💧', name: 'Pond', cost: 30, block: false },
  { id: 'birdhouse', icon: '🏠', name: 'Birdhouse', cost: 40, block: false },
  { id: 'swing', icon: '🎠', name: 'Swing', cost: 60, block: false },
  { id: 'snow', icon: '⬜', name: 'Snow', cost: 0, block: true, biome: 'snow' },
  { id: 'ice', icon: '🧊', name: 'Ice', cost: 0, block: true, biome: 'snow' },
  { id: 'snowman', icon: '⛄', name: 'Snowman', cost: 30, block: false, biome: 'snow' },
  { id: 'igloo', icon: '🛖', name: 'Igloo', cost: 50, block: false, biome: 'snow' },
  { id: 'erase', icon: '⛏️', name: 'Remove', cost: 0, block: false },
];
const TOOL: Record<string, Tool> = Object.fromEntries(PALETTE.map((t) => [t.id, t]));
export { FOOD_ICON };
export const toolLocked = (t: Tool) => (!!t.biome && !S.visited.includes(t.biome)) || (S.area !== 'valley' && !t.block && t.id !== 'erase');

// ---------------- animals ----------------
export interface AnimalDef { type: string; name: string; icon: string; food: Food; needs: { id: string; n: number }[]; power: string; biome: 'valley' | 'snow'; ride?: { speed: number; jump: number; seat: number } }
export const ANIMALS: AnimalDef[] = [
  { type: 'hen', name: 'Hen', icon: '🐔', food: 'strawberry', needs: [], power: '+2 🪙 for every snack', biome: 'valley' },
  { type: 'bunny', name: 'Bunny', icon: '🐰', food: 'strawberry', needs: [{ id: 'flower', n: 3 }], power: 'Jump higher', biome: 'valley' },
  { type: 'turtle', name: 'Turtle', icon: '🐢', food: 'strawberry', needs: [{ id: 'pond', n: 1 }], power: 'Blocks one hit', biome: 'valley' },
  { type: 'fox', name: 'Fox', icon: '🦊', food: 'honey', needs: [{ id: 'hay', n: 1 }], power: 'Run 10% faster', biome: 'valley' },
  { type: 'bear', name: 'Bear', icon: '🐻', food: 'honey', needs: [{ id: 'swing', n: 1 }], power: 'Bigger gifts', biome: 'valley' },
  { type: 'raccoon', name: 'Raccoon', icon: '🦝', food: 'melon', needs: [{ id: 'blocks', n: 12 }], power: 'Carry snacks with no slowdown', biome: 'valley' },
  { type: 'deer', name: 'Golden Deer', icon: '🦌', food: 'gold', needs: [{ id: 'birdhouse', n: 1 }, { id: 'flower', n: 5 }], power: 'RIDE it! Fast with a big jump', biome: 'valley', ride: { speed: 1.55, jump: 12, seat: 0.95 } },
  { type: 'penguin', name: 'Penguin', icon: '🐧', food: 'cookie', needs: [{ id: 'ice', n: 6 }], power: 'No slipping on ice', biome: 'snow' },
  { type: 'arcticfox', name: 'Snow Fox', icon: '🦊', food: 'cookie', needs: [{ id: 'snowman', n: 1 }], power: 'Snowball grows 2× faster', biome: 'snow' },
  { type: 'owl', name: 'Snowy Owl', icon: '🦉', food: 'cocoa', needs: [{ id: 'birdhouse', n: 1 }, { id: 'snow', n: 6 }], power: 'Hold JUMP to glide', biome: 'snow' },
  { type: 'yak', name: 'Yak', icon: '🐂', food: 'cocoa', needs: [{ id: 'hay', n: 2 }], power: 'RIDE it! Steady on ice', biome: 'snow', ride: { speed: 1.35, jump: 9.5, seat: 1.1 } },
  { type: 'polarbear', name: 'Polar Cub', icon: '🐻‍❄️', food: 'cake', needs: [{ id: 'igloo', n: 1 }], power: 'Rams can’t knock you over', biome: 'snow' },
  { type: 'leopard', name: 'Snow Leopard', icon: '🐆', food: 'gold', needs: [{ id: 'igloo', n: 1 }, { id: 'snowman', n: 1 }, { id: 'ice', n: 10 }], power: 'Faster AND higher jump', biome: 'snow' },
];
const DEF: Record<string, AnimalDef> = Object.fromEntries(ANIMALS.map((a) => [a.type, a]));
const rec = (t: string) => (S.animals[t] ??= { visits: 0, friend: false });
export const buddyIs = (t: string) => S.buddy === t;
export const VISITS_TO_FRIEND = 3;

// ---------------- build zone ----------------
export const ZONE = { x0: -17, x1: 12, z0: 5, z1: 24, ymax: 7 };
const PANTRY = { x: -10, z: 8.5 };
const inPantry = (ix: number, iz: number) => ix >= PANTRY.x - 2 && ix <= PANTRY.x + 1 && iz >= 7 && iz <= 9;
let area = 'valley';
const WILD = { x0: -39, x1: 38, z0: -171, z1: 28 };
const inZone = (ix: number, iz: number) => area === 'valley'
  ? ix >= ZONE.x0 && ix <= ZONE.x1 && iz >= ZONE.z0 && iz <= ZONE.z1 && !inPantry(ix, iz)
  : ix >= WILD.x0 && ix <= WILD.x1 && iz >= WILD.z0 && iz <= WILD.z1 && !(Math.abs(ix + 10) < 3 && Math.abs(iz - 10) < 2) && !(Math.abs(ix - 27) < 2 && Math.abs(iz - 14) < 4);
/** the voxel layer a block on bare ground sits in */
const groundIy = (ix: number, iz: number) => Math.round(terrainH(ix + 0.5, iz + 0.5));
const savedList = () => (area === 'valley' ? S.build : (S.builds[area] ??= []));

interface Voxel { id: string; obj: THREE.Object3D; box: Box | null }
const vox = new Map<string, Voxel>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
export function count(id: string) { let n = 0; for (const v of vox.values()) if (id === 'blocks' ? TOOL[v.id]?.block : v.id === id) n++; return n; }
export function countCamp(id: string) { return S.build.filter((b) => (id === 'blocks' ? TOOL[b[3]]?.block : b[3] === id)).length; }
const needMet = (d: AnimalDef) => d.needs.every((n) => countCamp(n.id) >= n.n);

let scene: THREE.Scene;
let Pref: { pos: THREE.Vector3 };
let ghost: THREE.Group, ghostMat: THREE.MeshBasicMaterial;
export const build = { on: false, tool: 0 };
export const ride = { on: false, type: '' };
let campFull = true;
export const rideDef = () => ANIMALS.find((a) => a.type === ride.type)?.ride ?? null;
export const buddyCritter = () => critters.find((c) => c.state === 'home' && c.def.type === S.buddy) ?? null;

function addVoxel(ix: number, iy: number, iz: number, id: string) {
  const t = TOOL[id]; let obj: THREE.Object3D, box: Box | null = null;
  if (t.block) {
    const m = new THREE.Mesh(blockGeo, blockMaterial(id)); m.castShadow = m.receiveShadow = true; obj = m;
    m.position.set(ix + 0.5, iy + 0.5, iz + 0.5);
    box = { x0: ix, x1: ix + 1, z0: iz, z1: iz + 1, y0: iy, top: iy + 1, kind: 'solid' }; BOXES.push(box);
  } else { obj = makeSpecial(id); obj.position.set(ix + 0.5, iy, iz + 0.5); obj.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2; }
  scene.add(obj); vox.set(key(ix, iy, iz), { id, obj, box });
}
function removeVoxel(k: string) { const v = vox.get(k)!; scene.remove(v.obj); if (v.box) BOXES.splice(BOXES.indexOf(v.box), 1); vox.delete(k); }
function persist() { const list = [...vox.entries()].map(([k, v]) => { const [x, y, z] = k.split(',').map(Number); return [x, y, z, v.id] as [number, number, number, string]; }); if (area === 'valley') S.build = list; else S.builds[area] = list; save(); }

/** Place the current tool at a voxel. Returns true on success. */
export function place(ix: number, iy: number, iz: number, id = PALETTE[build.tool].id): boolean {
  const t = TOOL[id];
  if (id === 'erase') return erase(ix, iy, iz);
  const gy = groundIy(ix, iz);
  if (!inZone(ix, iz) || iy < gy || iy > gy + ZONE.ymax || vox.has(key(ix, iy, iz))) { sfx.no(); return false; }
  if (!t.block && area !== 'valley') { sfx.no(); say(`${t.icon} goes in your camp in the valley — that's where animals visit!`); return false; }
  if (!t.block) { const below = vox.get(key(ix, iy - 1, iz)); if (iy > gy && !(below && TOOL[below.id].block)) { sfx.no(); return false; } }
  else { const p = Pref.pos; if (p.x + 0.45 > ix && p.x - 0.45 < ix + 1 && p.z + 0.45 > iz && p.z - 0.45 < iz + 1 && p.y < iy + 1 && p.y + 1.6 > iy) { sfx.no(); return false; } }
  if (vox.size >= 400) { say('Your camp is full of blocks!'); return false; }
  if (toolLocked(t)) { sfx.no(); say(`${t.icon} ${t.name} comes from Snow Mountain — visit it first!`); return false; }
  if (t.cost > S.coins) { sfx.no(); say(`${t.icon} ${t.name} costs ${t.cost} 🪙 — animals give coins as gifts!`); return false; }
  S.coins -= t.cost; addVoxel(ix, iy, iz, id); sfx.place();
  if (t.cost) { burst(new V3(ix + 0.5, iy + 0.6, iz + 0.5), [0xffd23f, 0xffffff, 0x7dff8a], 14, 3, 5); floatText(new V3(ix + 0.5, iy + 1.8, iz + 0.5), `-${t.cost} 🪙`, '#ffe14a', 0.6); }
  persist(); return true;
}
export function erase(ix: number, iy: number, iz: number): boolean {
  const k = key(ix, iy, iz), v = vox.get(k); if (!v) return false;
  if (vox.has(key(ix, iy + 1, iz)) && !TOOL[vox.get(key(ix, iy + 1, iz))!.id].block) erase(ix, iy + 1, iz); // things standing on top come off too
  S.coins += TOOL[v.id].cost; removeVoxel(k); sfx.drop(); burst(new V3(ix + 0.5, iy + 0.5, iz + 0.5), [0xa8703f, 0x6fd65a, 0xffffff], 8, 2, 3); persist(); return true;
}

// ---------------- raycast: which voxel does the pointer point at? ----------------
export function pick(ray: THREE.Ray): { place: [number, number, number] | null; hit: [number, number, number] | null } {
  const p = ray.origin.clone(), d = ray.direction.clone().multiplyScalar(0.08); let prev: [number, number, number] | null = null;
  for (let i = 0; i < 600; i++) {
    p.add(d);
    const c: [number, number, number] = [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)];
    if (vox.has(key(...c))) return { place: prev && (prev[0] !== c[0] || prev[1] !== c[1] || prev[2] !== c[2]) ? prev : null, hit: c };
    if (p.y <= terrainH(p.x, p.z)) return { place: [c[0], groundIy(c[0], c[2]), c[2]], hit: null };
    prev = c;
  }
  return { place: null, hit: null };
}
export function pointerAct(ray: THREE.Ray, forceErase = false) {
  const r = pick(ray), t = PALETTE[build.tool];
  if (t.id === 'erase' || forceErase) { if (r.hit) erase(...r.hit); return; }
  if (r.place) place(...r.place);
}
export function hover(ray: THREE.Ray | null) {
  if (!ray || !build.on) { ghost.visible = false; return; }
  const r = pick(ray), er = PALETTE[build.tool].id === 'erase', c = er ? r.hit : r.place;
  if (!c) { ghost.visible = false; return; }
  ghost.visible = true; ghost.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
  ghostMat.color.set(er ? 0xff5050 : inZone(c[0], c[2]) ? 0xffffff : 0xff5050);
}
/** Keyboard building: the cell in front of the hero. */
export function frontCell(face: number): [number, number, number] {
  const p = Pref.pos, ix = Math.floor(p.x + Math.sin(face) * 1.4), iz = Math.floor(p.z + Math.cos(face) * 1.4);
  const gy = groundIy(ix, iz); let iy = gy; while (vox.has(key(ix, iy, iz)) && iy <= gy + ZONE.ymax) iy++;
  return [ix, iy, iz];
}
export function setBuild(on: boolean) { build.on = on; if (!on) ghost.visible = false; if (on && area === 'valley') hint('build', 'Click/tap to place. ⛏️ removes. Animals visit if you build what they like!', true); if (on && area !== 'valley') hint('build-wild', 'Build walls to stop the rams — they bonk and get dizzy! Or build stairs and bridges. Animal items go in your camp.', true); }

// ---------------- visitors & friends ----------------
interface Critter { def: AnimalDef; m: THREE.Group; pos: THREE.Vector3; target: THREE.Vector3; state: 'in' | 'eat' | 'stay' | 'out' | 'home'; t: number; hop: number; coins: number; shown: number; label: THREE.Sprite | null; bubble: THREE.Sprite | null }
const critters: Critter[] = [];
interface Gift { m: THREE.Group; pos: THREE.Vector3; coins: number; t: number }
const gifts: Gift[] = [];
let visitT = 3;

function spotFor(d: AnimalDef): THREE.Vector3 {
  const n = d.needs.find((x) => x.id !== 'blocks');
  if (n) { const list = [...vox.entries()].filter(([, v]) => v.id === n.id); if (list.length) { const [x, , z] = list[Math.floor(Math.random() * list.length)][0].split(',').map(Number); const a = rnd(0, 6.28); return new V3(x + 0.5 + Math.cos(a) * 1.3, 0, z + 0.5 + Math.sin(a) * 1.3); } }
  return new V3(rnd(-12, 8), 0, rnd(12, 22));
}
function spawnCritter(d: AnimalDef, state: Critter['state'], at: THREE.Vector3) {
  const m = makeAnimal(d.type); if (d.type === 'bear') m.scale.setScalar(1.25); m.position.copy(at); scene.add(m);
  const c: Critter = { def: d, m, pos: at.clone(), target: state === 'in' ? new V3(PANTRY.x, 0, PANTRY.z + 2) : spotFor(d), state, t: 0, hop: Math.random() * 6, coins: 0, shown: -1, label: null, bubble: null };
  critters.push(c); return c;
}
function bubble(c: Critter, text: string | null) { if (c.bubble) c.m.remove(c.bubble); c.bubble = null; if (text) { c.bubble = textSprite(text, { size: 56, scale: 0.6 / c.m.scale.x, bg: 'rgba(255,255,255,.9)', color: '#333' }); c.bubble.position.y = 2.1; c.m.add(c.bubble); } }
function dropGift(at: THREE.Vector3, coins: number) {
  const g = new THREE.Group(); const b = mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), toon(0xff5d8f)); b.position.y = 0.25; g.add(b);
  const r1 = mesh(new THREE.BoxGeometry(0.62, 0.52, 0.12), toon(0xffe14a), false); r1.position.y = 0.25; g.add(r1); const r2 = r1.clone(); r2.rotation.y = Math.PI / 2; g.add(r2);
  const bow = mesh(new THREE.TorusGeometry(0.12, 0.05, 6, 10), toon(0xffe14a), false); bow.position.y = 0.56; g.add(bow);
  g.position.copy(at); scene.add(g); gifts.push({ m: g, pos: at.clone(), coins, t: 0 });
  burst(at.clone().add(new V3(0, 0.6, 0)), [0xff5d8f, 0xffe14a, 0xffffff], 12, 2, 4);
}
export function friendsCount() { return ANIMALS.filter((a) => S.animals[a.type]?.friend).length; }

function trySpawnVisitor() {
  if (!campFull || critters.filter((c) => c.state !== 'home').length >= 2) return;
  const busy = new Set(critters.map((c) => c.def.type));
  const cand = ANIMALS.filter((d) => !rec(d.type).friend && !busy.has(d.type) && pantry(d.food) > 0 && needMet(d));
  if (!cand.length) return;
  const d = cand[Math.floor(Math.random() * cand.length)];
  addPantry(d.food, -1); save();
  spawnCritter(d, 'in', new V3(rnd(-3, 3), 0, -3)); sfx.cluck();
  say(`${d.icon} A ${d.name} is coming to visit!`, 3); hint('visit', `Visitors eat from your 🧺 Pantry and leave a 🎁 gift. ${VISITS_TO_FRIEND} visits = a new friend!`, true);
}

export function updateCamp(dt: number, P: { pos: THREE.Vector3; vel: THREE.Vector3; face: number }, act: boolean, time: number) {
  visitT -= dt; if (visitT <= 0) { visitT = 5; trySpawnVisitor(); }
  let near: Critter | null = null, nd = 2.6;
  for (const c of critters) {
    c.t += dt;
    const follow = c.state === 'home' && S.buddy === c.def.type;
    if (follow && ride.on) { c.pos.copy(P.pos); c.target.copy(P.pos); c.m.position.copy(P.pos); c.m.rotation.y = P.face; c.hop += dt * Math.hypot(P.vel.x, P.vel.z) * 1.5; c.m.position.y += Math.abs(Math.sin(c.hop)) * 0.15; near = c; nd = 0; continue; }
    if (follow) { const back = new V3(Math.sin(P.face), 0, Math.cos(P.face)).multiplyScalar(-2.2); c.target.set(P.pos.x + back.x + 0.8, 0, P.pos.z + back.z); if (flat(c.pos, P.pos) > 25) c.pos.copy(c.target); }
    const dist = flat(c.pos, c.target);
    if (c.state === 'in' && dist < 0.4) { c.state = 'eat'; c.t = 0; bubble(c, `😋 ${FOOD_ICON[c.def.food]}`); sfx.coin(); }
    else if (c.state === 'eat' && c.t > 1.6) { c.state = 'stay'; c.t = 0; c.target = spotFor(c.def); bubble(c, null); }
    else if (c.state === 'stay') {
      if (c.t > 12 && dist < 0.5) {
        const r = rec(c.def.type); r.visits++;
        dropGift(c.pos.clone().add(new V3(0.9, 0, 0)), Math.round((10 + r.visits * 5) * (buddyIs('bear') ? 1.5 : 1)));
        if (r.visits >= VISITS_TO_FRIEND) { r.friend = true; c.state = 'home'; c.target = spotFor(c.def); bubble(c, '💛'); setTimeout(() => bubble(c, null), 2500); sfx.hatch(); hud.shake = 0.15; burst(c.pos.clone().add(new V3(0, 1, 0)), [0xffd23f, 0xff6b6b, 0x5bd6ff, 0x7dff8a, 0xffffff], 40, 5, 9); card(`${c.def.icon} ${c.def.name.toUpperCase()} MOVED IN!`, `New friend · power: ${c.def.power}`, c.def.type === 'deer'); hint('friend', 'Walk to a friend and press E / ✋ to take it along as your buddy!', true); if (!S.buddy) S.buddy = c.def.type; }
        else { c.state = 'out'; c.target = new V3(rnd(-3, 3), 0, -4); bubble(c, `👋 ${'●'.repeat(r.visits)}${'○'.repeat(VISITS_TO_FRIEND - r.visits)}`); }
        save();
      } else if (c.t > 3 && dist < 0.3) { const a = rnd(0, 6.28); c.target.set(c.pos.x + Math.cos(a) * 1.5, 0, c.pos.z + Math.sin(a) * 1.5); }
    } else if (c.state === 'out' && dist < 0.4) { scene.remove(c.m); critters.splice(critters.indexOf(c), 1); continue; }
    else if (c.state === 'home' && !follow && campFull) {
      c.coins += 0.15 * (buddyIs('bear') ? 1.5 : 1) * dt;
      if (dist < 0.3 && c.t > 3) { c.t = 0; c.target = Math.random() < 0.5 ? spotFor(c.def) : new V3(c.pos.x + rnd(-2, 2), 0, c.pos.z + rnd(-2, 2)); }
    }
    // move
    const dx = c.target.x - c.pos.x, dz = c.target.z - c.pos.z, d = Math.hypot(dx, dz);
    const sp = follow ? Math.max(4, Math.hypot(P.vel.x, P.vel.z) + 1.5) : c.state === 'eat' ? 0 : 2.4;
    if (d > 0.2 && sp > 0) { const st = Math.min(d, sp * dt); c.pos.x += (dx / d) * st; c.pos.z += (dz / d) * st; c.m.rotation.y = angleLerp(c.m.rotation.y, Math.atan2(dx, dz), Math.min(1, 8 * dt)); c.hop += dt * 12; }
    else if (c.state === 'stay' && c.def.type === 'bear') { const sw = [...vox.values()].find((v) => v.id === 'swing'); if (sw) (sw.obj.getObjectByName('seat') as THREE.Object3D).rotation.x = Math.sin(time * 3) * 0.6; }
    c.pos.y = groundAt(c.pos.x, c.pos.z, c.pos.y + 1).g;
    c.m.position.set(c.pos.x, c.pos.y + Math.abs(Math.sin(c.hop)) * 0.25, c.pos.z);
    // coins from friends
    const coins = Math.floor(c.coins);
    if (coins !== c.shown) { c.shown = coins; if (c.label) c.m.remove(c.label); c.label = null; if (coins > 0) { c.label = textSprite(`🪙 ${coins}`, { size: 50, scale: 0.55 / c.m.scale.x, color: '#ffe14a' }); c.label.position.y = 1.7; c.m.add(c.label); } }
    if (coins > 0 && flat(c.pos, P.pos) < 2.4) { S.coins += coins; c.coins -= coins; floatText(c.pos.clone().add(new V3(0, 2, 0)), `+${coins} 🪙`); sfx.coin(); }
    if (c.state === 'home') { const dd = flat(c.pos, P.pos); if (dd < nd) { nd = dd; near = c; } }
  }
  for (let i = gifts.length - 1; i >= 0; i--) {
    const g = gifts[i]; g.t += dt; g.m.rotation.y += dt; g.m.position.y = g.pos.y + Math.abs(Math.sin(g.t * 3)) * 0.15;
    if (flat(g.pos, P.pos) < 1.6) { S.coins += g.coins; scene.remove(g.m); gifts.splice(i, 1); sfx.buy(); floatText(g.pos.clone().add(new V3(0, 1.6, 0)), `🎁 +${g.coins} 🪙`, '#ffe14a', 0.9); burst(g.pos.clone().add(new V3(0, 0.5, 0)), [0xffe14a, 0xffffff], 16, 3, 5); hint('coins', 'Coins buy 🌾 💧 🏠 🎠 in build mode (B / 🧱). Each one brings a new animal — see the 📖 book!', true); save(); }
  }
  if (near && !build.on && !hud.prompt) {
    const isB = S.buddy === near.def.type, rd = near.def.ride;
    if (isB && rd) {
      hud.prompt = ride.on ? `Hop off ${near.def.name}` : `Ride ${near.def.icon} ${near.def.name}!`;
      if (act) { ride.on = !ride.on; ride.type = near.def.type; sfx.jump(); if (ride.on) hint('ride', `Riding! ${near.def.name}s are fast. Press E / ✋ again to hop off.`, true); }
    } else {
      hud.prompt = isB ? `${near.def.icon} ${near.def.name} is your buddy` : `Take ${near.def.icon} ${near.def.name} along (${near.def.power})`;
      if (act && !isB) { S.buddy = near.def.type; ride.on = false; sfx.buy(); floatText(near.pos.clone().add(new V3(0, 2.2, 0)), 'BUDDY!', '#7dff8a'); save(); }
    }
  }
  if (ride.on && !critters.some((c) => c.state === 'home' && c.def.type === S.buddy)) ride.on = false;
}

// ---------------- the book ----------------
export function bookData() {
  return ANIMALS.map((d) => {
    const r = S.animals[d.type] ?? { visits: 0, friend: false };
    return { ...d, visits: r.visits, friend: r.friend, buddy: S.buddy === d.type, locked: !S.visited.includes(d.biome), foodHave: pantry(d.food), needs: d.needs.map((n) => ({ icon: n.id === 'blocks' ? '🧱' : TOOL[n.id].icon, n: n.n, have: countCamp(n.id) })) };
  });
}

// ---------------- setup ----------------
export function initCamp(sc: THREE.Scene, P: { pos: THREE.Vector3 }, full: boolean) {
  scene = sc; Pref = P; campFull = full;
  vox.clear(); critters.length = 0; gifts.length = 0; ride.on = false; build.on = false; area = S.area;
  ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  ghost = new THREE.Group(); ghost.add(new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), ghostMat)); ghost.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03)), new THREE.LineBasicMaterial({ color: 0xffffff })));
  ghost.visible = false; scene.add(ghost);
  for (const [x, y, z, id] of savedList()) if (TOOL[id] && !vox.has(key(x, y, z))) addVoxel(x, y, z, id);
  if (!full) { const d = ANIMALS.find((a) => a.type === S.buddy); if (d && S.animals[d.type]?.friend) spawnCritter(d, 'home', P.pos.clone().add(new V3(1.5, 0, 2))); return; }
  const pan = makePantry(); pan.position.set(PANTRY.x, 0, PANTRY.z); scene.add(pan);
  BOXES.push({ x0: PANTRY.x - 1.6, x1: PANTRY.x + 1.6, z0: PANTRY.z - 0.8, z1: PANTRY.z + 0.8, y0: -1, top: 1 });
  // build-zone corner markers
  for (const [x, z] of [[ZONE.x0, ZONE.z0], [ZONE.x1 + 1, ZONE.z0], [ZONE.x0, ZONE.z1 + 1], [ZONE.x1 + 1, ZONE.z1 + 1]]) { const p = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), toon(0xffd23f)); p.position.set(x, 0.45, z); scene.add(p); }
  for (const d of ANIMALS) if (S.animals[d.type]?.friend) spawnCritter(d, 'home', new V3(rnd(-12, 8), 0, rnd(12, 22)));
}
export const pantryPos = new V3(PANTRY.x, 1.2, PANTRY.z);
export const campState = { critters, gifts, vox };
