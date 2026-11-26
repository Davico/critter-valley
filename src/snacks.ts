import type * as THREE from 'three';
import { makeSnack, makeSnowSnack } from './models';
import type { SnackId } from './biomes/types';

export type Size = 's' | 'm' | 'b';
export type Food = SnackId | 'gold';
export const SNACKS: Record<SnackId, { icon: string; name: string; size: Size; make(gold: boolean): THREE.Group }> = {
  strawberry: { icon: '🍓', name: 'Strawberry', size: 's', make: (g) => makeSnack('s', g) },
  honey: { icon: '🍯', name: 'Honey', size: 'm', make: (g) => makeSnack('m', g) },
  melon: { icon: '🍉', name: 'Giant Melon', size: 'b', make: (g) => makeSnack('b', g) },
  cookie: { icon: '🍪', name: 'Cookie', size: 's', make: (g) => makeSnowSnack('s', g) },
  cocoa: { icon: '☕', name: 'Cocoa', size: 'm', make: (g) => makeSnowSnack('m', g) },
  cake: { icon: '🎂', name: 'Giant Cake', size: 'b', make: (g) => makeSnowSnack('b', g) },
};
export const FOOD_ICON: Record<Food, string> = { ...Object.fromEntries(Object.entries(SNACKS).map(([k, v]) => [k, v.icon])) as Record<SnackId, string>, gold: '✨' };
export const SNACK_R: Record<Size, number> = { s: 0.38, m: 0.6, b: 1.25 };
