export type Food = 's' | 'm' | 'b' | 'gold';
export interface Save {
  coins: number; lvl: number; xp: number; tier: number;
  pantry: Record<Food, number>;
  build: [number, number, number, string][];
  animals: Record<string, { visits: number; friend: boolean }>;
  buddy: string | null; delivered: number; hints: string[];
}
const KEY = 'critter_valley_v1';
const fresh = (): Save => ({ coins: 0, lvl: 0, xp: 0, tier: 0, pantry: { s: 0, m: 0, b: 0, gold: 0 }, build: [], animals: {}, buddy: null, delivered: 0, hints: [] });
export const S: Save = (() => { try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); } })();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }
export function resetSave() { try { localStorage.removeItem(KEY); } catch { /* */ } location.reload(); }
