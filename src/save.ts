import type { Food } from './snacks';
export interface Save {
  coins: number; lvl: number; xp: number; tier: number;
  pantry: Partial<Record<Food, number>>;
  build: [number, number, number, string][];
  builds: Record<string, [number, number, number, string][]>;
  animals: Record<string, { visits: number; friend: boolean }>;
  buddy: string | null; delivered: number; hints: string[];
  area: 'valley' | 'snow'; visited: string[]; riding: boolean;
}
const KEY = 'critter_valley_v1';
const fresh = (): Save => ({ coins: 0, lvl: 0, xp: 0, tier: 0, pantry: {}, build: [], builds: {}, animals: {}, buddy: null, delivered: 0, hints: [], area: 'valley', visited: ['valley'], riding: false });
function load(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}'), s = { ...fresh(), ...raw } as Save;
    // v1 pantry used s/m/b keys
    const p = s.pantry as Record<string, number>;
    for (const [a, b] of [['s', 'strawberry'], ['m', 'honey'], ['b', 'melon']]) if (a in p) { p[b] = (p[b] ?? 0) + p[a]; delete p[a]; }
    return s;
  } catch { return fresh(); }
}
export const S: Save = load();
export const pantry = (f: Food) => S.pantry[f] ?? 0;
export function addPantry(f: Food, n: number) { S.pantry[f] = Math.max(0, pantry(f) + n); }
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }
export function resetSave() { try { localStorage.removeItem(KEY); } catch { /* */ } location.reload(); }
