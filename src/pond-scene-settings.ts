import type { SeasonMode } from './lake-environment';

export type SurfaceInteraction='feed'|'water';
export interface PondSceneSettings {season:SeasonMode;interaction:SurfaceInteraction}
export const SCENE_STORAGE_KEY='seedfish.scene.v1';
export function validSceneSettings(value:unknown):PondSceneSettings {
  const v=value as Partial<PondSceneSettings>|null;
  return {season:['auto','spring','summer','autumn','winter'].includes(v?.season??'')?v!.season!:'auto',interaction:v?.interaction==='water'?'water':'feed'};
}
export function loadSceneSettings():PondSceneSettings {
  try{return validSceneSettings(JSON.parse(localStorage.getItem(SCENE_STORAGE_KEY)??'null'));}catch{return validSceneSettings(null);}
}
export function saveSceneSettings(value:PondSceneSettings):boolean {
  try{localStorage.setItem(SCENE_STORAGE_KEY,JSON.stringify(value));return true;}catch{return false;}
}
