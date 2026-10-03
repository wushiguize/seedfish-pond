import type {FishKind} from './model';
import type {KoiRig} from './koi-model';
import {createAnatomicalFishRig} from './anatomical-fish-model';

/** Every catalog entry is built from its own anatomical landmark data.
 * There is intentionally no old spindle-model or color-only fallback. */
export function createFishRig(kind:FishKind):KoiRig {
  return createAnatomicalFishRig(kind);
}
