import type { FishKind } from './model';

export type FishPersonality = 'calm' | 'curious' | 'bold';
export interface FishPersonalityDefinition {
  readonly name: string;
  readonly description: string;
  readonly cruiseMultiplier: number;
  readonly feedingMultiplier: number;
  readonly separationMultiplier: number;
  readonly patrolMultiplier: number;
  readonly turnMultiplier: number;
}

// These are interaction styles for virtual fish. They do not describe the
// temperament or care needs of the corresponding real-world species.
export const FISH_PERSONALITIES: Readonly<Record<FishPersonality, FishPersonalityDefinition>> = Object.freeze({
  calm: Object.freeze({
    name: '慢游型',
    description: '游一段会停下来休息。遇到拨水先退开一点，观察饲料后再从容靠近。',
    cruiseMultiplier: .78,
    feedingMultiplier: .91,
    separationMultiplier: 1.26,
    patrolMultiplier: .82,
    turnMultiplier: .84,
  }),
  curious: Object.freeze({
    name: '探索型',
    description: '常常转向探索新位置，会靠近波纹查看；同种小鱼更愿意结伴游动。',
    cruiseMultiplier: 1.03,
    feedingMultiplier: 1.02,
    separationMultiplier: 1,
    patrolMultiplier: 1.22,
    turnMultiplier: 1.15,
  }),
  bold: Object.freeze({
    name: '活泼型',
    description: '短促快游后再滑行，拨水时迅速靠近，看到饲料会更早行动。',
    cruiseMultiplier: 1.15,
    feedingMultiplier: 1.15,
    separationMultiplier: .82,
    patrolMultiplier: 1.07,
    turnMultiplier: 1.07,
  }),
});

const DEFAULT_PERSONALITIES: readonly FishPersonality[] = ['calm', 'curious', 'bold'];

export function isFishPersonality(value: unknown): value is FishPersonality {
  return typeof value === 'string' && Object.hasOwn(FISH_PERSONALITIES, value);
}

export function getFishPersonality(record: {
  id: string;
  kind: FishKind;
  personality?: FishPersonality;
}): FishPersonality {
  if (isFishPersonality(record.personality)) return record.personality;

  // FNV-1a over an unambiguous ID/species tuple. A saved fish keeps the same
  // default across reloads, exports/imports, renaming and collection reordering.
  // No random state, clock, rank or food count can influence this assignment.
  const identity = JSON.stringify([record.id, record.kind]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index++) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 0x01000193) >>> 0;
  }
  return DEFAULT_PERSONALITIES[hash % DEFAULT_PERSONALITIES.length];
}
