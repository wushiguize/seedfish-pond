import type { CollisionVolume } from './collision';

/** Test the opaque body projection, including its rounded head and tail. */
export function hitAnimalAt(x:number,y:number,volume:CollisionVolume):boolean {
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(volume.x)||!Number.isFinite(volume.y)||!Number.isFinite(volume.angle)
    ||!Number.isFinite(volume.halfLength)||!Number.isFinite(volume.radius)||volume.halfLength<0||volume.radius<=0)return false;
  const dx=x-volume.x,dy=y-volume.y,cos=Math.cos(volume.angle),sin=Math.sin(volume.angle);
  const along=dx*cos+dy*sin,across=-dx*sin+dy*cos;
  const segmentHalfLength=Math.max(0,volume.halfLength-volume.radius);
  const endDistance=Math.max(0,Math.abs(along)-segmentHalfLength);
  // Include the boundary while allowing only floating-point rotation error.
  const radiusSquared=volume.radius*volume.radius;
  const coordinateScale=Math.max(Math.abs(x),Math.abs(y),Math.abs(volume.x),Math.abs(volume.y));
  const tolerance=Number.EPSILON*Math.max(1,radiusSquared,coordinateScale*volume.radius)*16;
  return endDistance*endDistance+across*across<=radiusSquared+tolerance;
}

/** Every opaque animal blocks selection of animals behind it, owned or ambient. */
export function pickVisibleAnimal(x:number,y:number,animals:readonly CollisionVolume[]):string|null {
  let visible:CollisionVolume|null=null;
  for(const animal of animals){
    if(!Number.isFinite(animal.depth)||!hitAnimalAt(x,y,animal))continue;
    // Lexical ID ordering keeps ties independent of array order and locale.
    if(!visible||animal.depth<visible.depth||(animal.depth===visible.depth&&animal.id<visible.id))visible=animal;
  }
  return visible?.id??null;
}

/** Pixi draws larger zIndex values later, so shallower animals cover deeper ones. */
export function animalZIndex(depth:number):number {return -depth*1000;}
