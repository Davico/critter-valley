import type * as THREE from 'three';
import type { Bounds, Surface } from '../world';

export type SnackId = 'strawberry' | 'honey' | 'melon' | 'cookie' | 'cocoa' | 'cake';
export type GuardKind = 'hen' | 'ram';
export interface NestDef { x: number; z: number; snack: SnackId; count: number; guard: { kind: GuardKind; size: number; speed: number }; label: string }
export interface Biome {
  id: 'valley' | 'snow';
  name: string;
  bounds: Bounds;
  spawn: [number, number, number];          // x, z, facing
  sky: [string, string]; fog: string; fogNear: number; fogFar: number;
  terrain(x: number, z: number): number;
  surface(x: number, z: number): Surface;
  /** where a carried snack counts as delivered */
  isHome(x: number, z: number): boolean;
  /** guardians never step here */
  noGo(x: number, z: number): boolean;
  nests: NestDef[];
  vehicle: 'cart' | 'sled';
  vehicleAt: [number, number, number];
  water?: { y: number; isWater(x: number, z: number): boolean; onBridge(x: number, z: number): boolean };
  /** a waypoint for a guardian walking from `from` to `to` (e.g. via a bridge); return `to` when the way is free */
  route?(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3;
  /** speed strip: returns the boost direction (unit) or null */
  boost?(x: number, z: number): [number, number] | null;
  /** location-based tips */
  tips?(x: number, z: number, carrying: boolean): [string, string] | null;
  startTip: string;
  build(scene: THREE.Object3D): (t: number, focus: THREE.Vector3) => void;
  /** extra info for the game: e.g. the sled parking spot, signs */
  portal: [number, number];
}
