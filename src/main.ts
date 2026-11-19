import * as THREE from 'three';
import { init, update, rotateCamera, sunTarget, state, S } from './game';
import { hud } from './fx';
import { resetSave } from './save';
import { PALETTE, FOOD_ICON, ANIMALS, VISITS_TO_FRIEND, build, setBuild, pointerAct, hover, place, erase, frontCell, bookData, friendsCount, campState } from './camp';
import { unlock } from './audio';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#8fd8ff');
scene.fog = new THREE.Fog('#bfeaff', 70, 190);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 6, 20);
scene.add(new THREE.HemisphereLight('#dff4ff', '#6fbf5a', 1.6));
const sun = new THREE.DirectionalLight('#fff4dc', 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera as THREE.OrthographicCamera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
// sky dome with a soft gradient
{
  const g = new THREE.SphereGeometry(300, 24, 12), m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {}, vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'varying vec3 p; void main(){ float h = clamp(normalize(p).y*1.4+0.15,0.0,1.0); gl_FragColor = vec4(mix(vec3(0.75,0.92,1.0), vec3(0.24,0.62,0.98), h),1.0); }' });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -1; scene.add(sky); (window as any).__sky = sky;
}
init(scene, camera);

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------- input ----------------
const keys = new Set<string>(); let jumpEdge = false, actEdge = false, rollTouch = false;
const stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 }; let lookId = -1, lookX = 0;
const taps = new Map<number, { x: number; y: number; t: number; m: number }>();
let lastMouse: [number, number] | null = null;
const raycaster = new THREE.Raycaster();
function rayAt(x: number, y: number) { raycaster.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return raycaster.ray; }
function keyEdge(k: string) {
  if (k === 'b') toggleBuild();
  else if (k === 'p' || k === 'tab') toggleBook();
  else if (k === 'escape') { if (bookOpen) toggleBook(); else if (build.on) toggleBuild(); }
  else if (build.on && /^[0-9]$/.test(k)) selectTool(k === '0' ? 9 : Number(k) - 1);
  else if (build.on && k === 'e') { const c = frontCell(state.P.face); place(...c); }
  else if (build.on && k === 'q') { const c = frontCell(state.P.face); if (c[1] > 0) erase(c[0], c[1] - 1, c[2]); }
}
addEventListener('keydown', (e) => { unlock(); const k = e.key.toLowerCase(); if (k === ' ' || k === 'arrowup' && false) e.preventDefault(); if ((k === ' ') && !keys.has(k)) jumpEdge = true; if (k === 'e' && !keys.has(k)) actEdge = true; if (!keys.has(k)) keyEdge(k); keys.add(k); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
let mouseDown = false, mx = 0;
let downX = 0, downY = 0, moved = 0;
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('mousedown', (e) => { mouseDown = true; mx = downX = e.clientX; downY = e.clientY; moved = 0; });
addEventListener('mouseup', (e) => { if (mouseDown && build.on && moved < 6 && e.target === renderer.domElement) pointerAct(rayAt(e.clientX, e.clientY), e.button === 2); mouseDown = false; });
addEventListener('mousemove', (e) => { if (mouseDown) { moved += Math.abs(e.clientX - mx); rotateCamera(e.clientX - mx); mx = e.clientX; } if (build.on) { lastMouse = [e.clientX, e.clientY]; } });
const stickEl = document.getElementById('stick')!, knob = document.getElementById('knob')!;
addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true });
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return; unlock(); taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), m: 0 });
  if (e.clientX < innerWidth * 0.45 && stick.id < 0) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; stickEl.style.display = 'block'; stickEl.style.left = e.clientX - 60 + 'px'; stickEl.style.top = e.clientY - 60 + 'px'; }
  else if (lookId < 0) { lookId = e.pointerId; lookX = e.clientX; }
});
addEventListener('pointermove', (e) => {
  const tp = taps.get(e.pointerId); if (tp) tp.m = Math.max(tp.m, Math.hypot(e.clientX - tp.x, e.clientY - tp.y));
  if (e.pointerId === stick.id) { let dx = (e.clientX - stick.ox) / 50, dy = (e.clientY - stick.oy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stick.x = dx; stick.y = -dy; knob.style.left = 36 + dx * 40 + 'px'; knob.style.top = 36 + dy * 40 + 'px'; }
  if (e.pointerId === lookId) { rotateCamera((e.clientX - lookX) * 1.4); lookX = e.clientX; }
});
const endPtr = (e: PointerEvent) => { const tp = taps.get(e.pointerId); taps.delete(e.pointerId); if (tp && e.type === 'pointerup' && build.on && tp.m < 12 && performance.now() - tp.t < 400) pointerAct(rayAt(e.clientX, e.clientY)); if (e.pointerId === stick.id) { stick.id = -1; stick.x = stick.y = 0; stickEl.style.display = 'none'; } if (e.pointerId === lookId) lookId = -1; };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
function btn(id: string, down: () => void, up: () => void) { const el = document.getElementById(id)!; el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); unlock(); el.classList.add('on'); down(); }); const u = () => { el.classList.remove('on'); up(); }; el.addEventListener('pointerup', u); el.addEventListener('pointerleave', u); el.addEventListener('pointercancel', u); }
btn('bJump', () => (jumpEdge = true), () => {}); btn('bRoll', () => (rollTouch = true), () => (rollTouch = false)); btn('bAct', () => (actEdge = true), () => {});
document.getElementById('reset')!.addEventListener('click', () => { if (confirm('Start over? Your camp, friends and coins will be lost.')) resetSave(); });
const start = document.getElementById('start')!;
let running = false;
start.addEventListener('pointerdown', () => { unlock(); start.remove(); running = true; });

// ---------------- HUD, palette, book ----------------
const $ = (id: string) => document.getElementById(id)!;
const elCoins = $('coins'), elSpeed = $('speed'), elCarry = $('carry'), elPantry = $('pantry'), elPets = $('pets'), elHint = $('hint'), elPrompt = $('prompt'), elCard = $('card'), elTread = $('tread'), elTreadBar = elTread.firstElementChild as HTMLElement;
const elPal = $('palette'), elBook = $('book');
PALETTE.forEach((t, i) => { const b = document.createElement('button'); b.innerHTML = `<span>${t.icon}</span><small>${t.cost ? t.cost + '🪙' : i === 9 ? '0' : i + 1}</small>`; b.title = t.name; b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); selectTool(i); }); elPal.appendChild(b); });
function selectTool(i: number) { build.tool = i; [...elPal.children].forEach((c, k) => c.classList.toggle('sel', k === i)); }
selectTool(0);
function toggleBuild() { setBuild(!build.on); document.body.classList.toggle('building', build.on); if (!build.on) hover(null); }
let bookOpen = false;
function toggleBook() {
  bookOpen = !bookOpen; elBook.style.display = bookOpen ? 'flex' : 'none'; if (!bookOpen) return;
  const rows = bookData().map((a) => `<div class="pg${a.friend ? ' fr' : ''}"><div class="ic">${a.friend || a.visits ? a.icon : '❔'}</div><b>${a.friend || a.visits ? a.name : '???'}</b>
    <div class="need"><span class="${a.foodHave ? 'ok' : ''}">${FOOD_ICON[a.food]}</span>${a.needs.map((n) => `<span class="${n.have >= n.n ? 'ok' : ''}">${n.icon}${n.n > 1 ? '×' + n.n : ''}</span>`).join('')}</div>
    <div class="dots">${a.friend ? (a.buddy ? '⭐ buddy' : '💛 friend') : '●'.repeat(a.visits) + '○'.repeat(VISITS_TO_FRIEND - a.visits)}</div><small>${a.power}</small></div>`).join('');
  $('bookPages').innerHTML = rows;
}
$('bBuild').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); unlock(); toggleBuild(); });
$('bBook').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); toggleBook(); });
$('bookClose').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); toggleBook(); });
let lastHud = '';
function drawHud() {
  const P = state.P, s = S, pa = s.pantry;
  const key = [s.coins, s.lvl, P.carry?.kind, P.carry?.gold, P.rolling, state.cart.snack?.kind, pa.s, pa.m, pa.b, pa.gold, friendsCount(), hud.hint, hud.hintT > 0, hud.prompt, !!hud.card, hud.onTread, build.on].join('|');
  elTread.style.display = hud.onTread ? 'block' : 'none'; elTreadBar.style.width = Math.min(100, hud.treadXp * 100) + '%';
  if (key === lastHud) return; lastHud = key;
  elCoins.textContent = `🪙 ${s.coins}`; elSpeed.textContent = `⚡ ${s.lvl}`; elPets.textContent = `🐾 ${friendsCount()}/${ANIMALS.length}`;
  elPantry.textContent = `🧺 ${FOOD_ICON.s}${pa.s} ${FOOD_ICON.m}${pa.m} ${FOOD_ICON.b}${pa.b}${pa.gold ? ' ✨' + pa.gold : ''}`;
  const c = P.carry ? `${P.carry.gold ? '✨' : FOOD_ICON[P.carry.kind]} carrying${P.rolling ? ' (in shell)' : ''}` : state.cart.snack ? '🛒 🍉' : '';
  elCarry.textContent = c; elCarry.style.display = c ? '' : 'none';
  elHint.textContent = hud.hint; elHint.style.opacity = hud.hintT > 0 ? '1' : '0';
  elPrompt.textContent = (document.body.classList.contains('touch') ? '✋ ' : 'E: ') + hud.prompt; elPrompt.style.display = hud.prompt ? 'block' : 'none';
  if (hud.card) { elCard.className = 'hud show' + (hud.card.gold ? ' gold' : ''); (elCard.querySelector('.t') as HTMLElement).textContent = hud.card.title; (elCard.querySelector('.s') as HTMLElement).textContent = hud.card.sub; } else elCard.className = 'hud';
}

// ---------------- loop ----------------
let last = performance.now(), acc = 0; const DT = 1 / 60;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (running && !bookOpen) {
    acc += dt;
    while (acc >= DT) {
      const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const ky = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      update(DT, { x: kx || stick.x, y: ky || stick.y, jump: jumpEdge, roll: keys.has('shift') || rollTouch, act: actEdge });
      jumpEdge = false; actEdge = false; acc -= DT;
    }
  }
  const t = sunTarget(); sun.position.set(t.x + 25, t.y + 45, t.z + 18); sun.target.position.copy(t); (window as any).__sky.position.copy(camera.position);
  if (build.on && lastMouse && !document.body.classList.contains('touch')) hover(rayAt(lastMouse[0], lastMouse[1])); renderer.render(scene, camera); drawHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as any).__game = { state, S, update, camp: { place, erase, build, setBuild: (on: boolean) => { if (build.on !== on) toggleBuild(); }, bookData, campState, toggleBook }, start: () => { start.remove(); running = true; } };
