import type {Group} from 'three';
import type {FishKind} from './model';
import {createAnatomicalFishRig} from './anatomical-fish-model';

/** Model coordinates: +X nose, ±Y flanks, +Z back.
 * Existing fish IDs, world scales and real-time animation contract stay stable. */
export interface KoiRig {
  group:Group;
  animate(phase:number,speed:number,turn:number):void;
  dispose():void;
}

/** Legacy public entry point now uses the same complete reconstruction as all fish. */
export function createKoiRig(kind:FishKind):KoiRig {
  return createAnatomicalFishRig(kind);
}
