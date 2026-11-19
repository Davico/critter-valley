let ac: AudioContext | null = null, master: GainNode | null = null;
export function unlock() { if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); } if (ac.state === 'suspended') ac.resume(); }
function tone(f0: number, f1: number, dur: number, type: OscillatorType = 'square', vol = 0.25, delay = 0) {
  if (!ac || !master) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.3, hp = 800, delay = 0) {
  if (!ac || !master) return;
  const t = ac.currentTime + delay, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  s.connect(f).connect(g).connect(master); s.start(t);
}
export const sfx = {
  jump: () => tone(300, 620, 0.16, 'square', 0.16),
  bounce: () => { tone(200, 900, 0.25, 'sine', 0.3); },
  grab: () => { tone(520, 880, 0.08, 'triangle', 0.25); tone(880, 1320, 0.1, 'triangle', 0.2, 0.08); },
  cluck: () => { tone(900, 500, 0.07, 'square', 0.18); tone(1000, 600, 0.07, 'square', 0.18, 0.1); tone(1300, 700, 0.12, 'square', 0.2, 0.2); },
  flap: () => noise(0.25, 0.35, 400),
  stomp: () => { tone(120, 40, 0.35, 'sine', 0.6); noise(0.3, 0.25, 100); },
  splash: () => noise(0.5, 0.4, 600),
  drop: () => tone(400, 150, 0.2, 'triangle', 0.25),
  coin: () => { tone(988, 988, 0.06, 'square', 0.12); tone(1319, 1319, 0.12, 'square', 0.12, 0.06); },
  place: () => { tone(392, 392, 0.1, 'triangle', 0.25); tone(523, 523, 0.1, 'triangle', 0.25, 0.1); tone(659, 659, 0.18, 'triangle', 0.25, 0.2); },
  hatch: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.25, i * 0.09)); noise(0.2, 0.2, 2000); },
  buy: () => { tone(660, 990, 0.1, 'square', 0.15); tone(990, 1480, 0.15, 'square', 0.15, 0.1); },
  no: () => tone(220, 160, 0.2, 'square', 0.15),
  level: () => { [660, 880, 1100].forEach((f, i) => tone(f, f, 0.1, 'square', 0.14, i * 0.07)); },
  roll: () => tone(140, 90, 0.12, 'sine', 0.2),
};
