import { meadow } from './meadow';
import { snow } from './snow';
import type { Biome } from './types';
export const BIOMES: Record<Biome['id'], Biome> = { valley: meadow, snow };
export type { Biome };
