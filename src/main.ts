import * as THREE from 'three';
import { init, update, hud, rotateCamera, sunTarget, resetSave, state, S } from './game';
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
addEventListener('keydown', (e) => { unlock(); const k = e.key.toLowerCase(); if (k === ' ' || k === 'arrowup' && false) e.preventDefault(); if ((k === ' ') && !keys.has(k)) jumpEdge = true; if (k === 'e' && !keys.has(k)) actEdge = true; keys.add(k); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
let mouseDown = false, mx = 0;
renderer.domElement.addEventListener('mousedown', (e) => { mouseDown = true; mx = e.clientX; });
addEventListener('mouseup', () => (mouseDown = false));
addEventListener('mousemove', (e) => { if (mouseDown) { rotateCamera(e.clientX - mx); mx = e.clientX; } });
const stickEl = document.getElementById('stick')!, knob = document.getElementById('knob')!;
addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true });
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return; unlock();
  if (e.clientX < innerWidth * 0.45 && stick.id < 0) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; stickEl.style.display = 'block'; stickEl.style.left = e.clientX - 60 + 'px'; stickEl.style.top = e.clientY - 60 + 'px'; }
  else if (lookId < 0) { lookId = e.pointerId; lookX = e.clientX; }
});
addEventListener('pointermove', (e) => {
  if (e.pointerId === stick.id) { let dx = (e.clientX - stick.ox) / 50, dy = (e.clientY - stick.oy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } stick.x = dx; stick.y = -dy; knob.style.left = 36 + dx * 40 + 'px'; knob.style.top = 36 + dy * 40 + 'px'; }
  if (e.pointerId === lookId) { rotateCamera((e.clientX - lookX) * 1.4); lookX = e.clientX; }
});
const endPtr = (e: PointerEvent) => { if (e.pointerId === stick.id) { stick.id = -1; stick.x = stick.y = 0; stickEl.style.display = 'none'; } if (e.pointerId === lookId) lookId = -1; };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
function btn(id: string, down: () => void, up: () => void) { const el = document.getElementById(id)!; el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); unlock(); el.classList.add('on'); down(); }); const u = () => { el.classList.remove('on'); up(); }; el.addEventListener('pointerup', u); el.addEventListener('pointerleave', u); el.addEventListener('pointercancel', u); }
btn('bJump', () => (jumpEdge = true), () => {}); btn('bRoll', () => (rollTouch = true), () => (rollTouch = false)); btn('bAct', () => (actEdge = true), () => {});
document.getElementById('reset')!.addEventListener('click', () => { if (confirm('Start over? All pets and coins will be lost.')) resetSave(); });
const start = document.getElementById('start')!;
let running = false;
start.addEventListener('pointerdown', () => { unlock(); start.remove(); running = true; });

// ---------------- HUD ----------------
const $ = (id: string) => document.getElementById(id)!;
const elCoins = $('coins'), elSpeed = $('speed'), elCarry = $('carry'), elPets = $('pets'), elHint = $('hint'), elPrompt = $('prompt'), elCard = $('card'), elTread = $('tread'), elTreadBar = elTread.firstElementChild as HTMLElement;
let lastHud = '';
function drawHud() {
  const P = state.P, s = S;
  const key = [s.coins, s.lvl, P.carry?.kind, P.carry?.kg, P.rolling, state.cart.egg?.kg, s.pets.length, hud.hint, hud.hintT > 0, hud.prompt, !!hud.card, hud.onTread].join('|');
  elTread.style.display = hud.onTread ? 'block' : 'none'; elTreadBar.style.width = Math.min(100, hud.treadXp * 100) + '%';
  if (key === lastHud) return; lastHud = key;
  elCoins.textContent = `🪙 ${s.coins}`; elSpeed.textContent = `⚡ Speed ${s.lvl}`; elPets.textContent = `🐾 ${s.pets.length}`;
  const c = P.carry ? `🥚 ${P.carry.kg} kg${P.rolling ? ' (in shell)' : ''}` : state.cart.egg ? `🛒 ${state.cart.egg.kg} kg` : '';
  elCarry.textContent = c; elCarry.style.display = c ? '' : 'none';
  elHint.textContent = hud.hint; elHint.style.opacity = hud.hintT > 0 ? '1' : '0';
  elPrompt.textContent = (document.body.classList.contains('touch') ? '✋ ' : 'E: ') + hud.prompt; elPrompt.style.display = hud.prompt ? 'block' : 'none';
  if (hud.card) { elCard.className = 'hud show' + (hud.card.gold ? ' gold' : ''); (elCard.querySelector('.t') as HTMLElement).textContent = hud.card.title; (elCard.querySelector('.s') as HTMLElement).textContent = hud.card.sub; } else elCard.className = 'hud';
}

// ---------------- loop ----------------
let last = performance.now(), acc = 0; const DT = 1 / 60;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (running) {
    acc += dt;
    while (acc >= DT) {
      const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const ky = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      update(DT, { x: kx || stick.x, y: ky || stick.y, jump: jumpEdge, roll: keys.has('shift') || rollTouch, act: actEdge });
      jumpEdge = false; actEdge = false; acc -= DT;
    }
  }
  const t = sunTarget(); sun.position.set(t.x + 25, t.y + 45, t.z + 18); sun.target.position.copy(t); (window as any).__sky.position.copy(camera.position);
  renderer.render(scene, camera); drawHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as any).__game = { state, S, update, start: () => { start.remove(); running = true; } };
