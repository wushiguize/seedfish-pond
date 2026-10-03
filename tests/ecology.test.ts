import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Container, Texture, TextureSource } from 'pixi.js';
import { LakeEcology, type EcologyAnimal } from '../src/ecology';
import { insidePond } from '../src/model';

const allocated:Texture[]=[];
const sources:TextureSource[]=[];
beforeEach(()=>{
  allocated.length=0;sources.length=0;
  const gradient={addColorStop(){}};
  const context=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get(target,key){return target[key as keyof typeof target]??(()=>{});}});
  vi.stubGlobal('document',{createElement(){return {width:0,height:0,getContext(){return context;}};}});
  vi.stubGlobal('Path2D',class {moveTo(){}lineTo(){}bezierCurveTo(){}quadraticCurveTo(){}closePath(){}});
  // Exercise real Pixi transforms, reparenting and disposal without a GPU or
  // browser canvas. Only raster uploads are replaced by unallocated sources.
  vi.spyOn(Texture,'from').mockImplementation(image=>{
    const dimensions=image as HTMLCanvasElement,source=new TextureSource({width:dimensions.width,height:dimensions.height}),texture=new Texture({source});sources.push(source);allocated.push(texture);return texture;
  });
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

function segmentDistance(a:EcologyAnimal,b:EcologyAnimal):number {
  const ax=Math.cos(a.angle)*a.halfLength,ay=Math.sin(a.angle)*a.halfLength,bx=Math.cos(b.angle)*b.halfLength,by=Math.sin(b.angle)*b.halfLength;
  const a0=[a.x-ax,a.y-ay],a1=[a.x+ax,a.y+ay],b0=[b.x-bx,b.y-by],b1=[b.x+bx,b.y+by];
  const ux=a1[0]-a0[0],uy=a1[1]-a0[1],vx=b1[0]-b0[0],vy=b1[1]-b0[1],wx=b0[0]-a0[0],wy=b0[1]-a0[1],cross=ux*vy-uy*vx;
  if(Math.abs(cross)>1e-8){const s=(wx*vy-wy*vx)/cross,t=(wx*uy-wy*ux)/cross;if(s>=0&&s<=1&&t>=0&&t<=1)return 0;}
  const pointDistance=(p:number[],v0:number[],v1:number[])=>{const dx=v1[0]-v0[0],dy=v1[1]-v0[1],s=Math.max(0,Math.min(1,((p[0]-v0[0])*dx+(p[1]-v0[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-v0[0]-s*dx,p[1]-v0[1]-s*dy);};
  return Math.min(pointDistance(a0,b0,b1),pointDistance(a1,b0,b1),pointDistance(b0,a0,a1),pointDistance(b1,a0,a1));
}

it('ambient bodies stay opaque, finite and separated while schools pass over twelve minutes',()=>{
  const ecology=new LakeEcology(),animals=ecology.getAnimals(),depths=animals.map(f=>f.depth),textureCount=allocated.length;
  expect(animals).toHaveLength(30);expect(new Set(animals.map(f=>f.id)).size).toBe(30);
  let leastClearance=Infinity;
  for(let sample=0;sample<=3000;sample++){
    ecology.update(sample*.25,.25,(Math.cos(sample*.03)+1)*.5);
    for(const fish of animals){
      if(![fish.x,fish.y,fish.angle,fish.depth,fish.halfLength,fish.radius,fish.halfHeight].every(Number.isFinite)||!insidePond(fish.x,fish.y,.86)||fish.rig.alpha!==1)throw new Error(`Invalid ambient body ${fish.id} at ${sample}`);
    }
    for(let i=0;i<animals.length;i++)for(let j=i+1;j<animals.length;j++){
      const a=animals[i],b=animals[j],vertical=(a.depth-b.depth)*200/(a.halfHeight+b.halfHeight);if(Math.abs(vertical)>=1)continue;
      const planar=segmentDistance(a,b)/(a.radius+b.radius),clearance=planar*planar+vertical*vertical;leastClearance=Math.min(leastClearance,clearance);
      if(clearance<1-1e-5)throw new Error(`Intersecting ambient volumes ${a.id}/${b.id}: ${clearance} at ${sample}`);
    }
  }
  expect(leastClearance).toBeGreaterThanOrEqual(1-1e-5);expect(animals.map(f=>f.depth)).toEqual(depths);expect(depths.every(d=>d>=.65&&d<=.95)).toBe(true);
  expect(ecology.getAnimals()).toBe(animals);expect(allocated).toHaveLength(textureCount);
  ecology.destroy();expect(allocated.every(t=>t.destroyed)&&sources.every(s=>s.destroyed)).toBe(true);
});

it('reparented animal rigs keep live proxies and are explicitly destroyed by ecology',()=>{
  const ecology=new LakeEcology(),layer=new Container(),animals=ecology.getAnimals(),first=animals[0],before={x:first.x,y:first.y};
  for(const animal of animals)layer.addChild(animal.rig);
  ecology.update(12,1/30,.2);
  expect(first.rig.parent).toBe(layer);expect(first.x).toBe(first.rig.position.x);expect(first.y).toBe(first.rig.position.y);expect({x:first.x,y:first.y}).not.toEqual(before);
  ecology.destroy();expect(layer.children).toHaveLength(0);expect(animals.every(a=>a.rig.destroyed)).toBe(true);expect(ecology.getAnimals()).toEqual([]);
  expect(allocated.every(t=>t.destroyed)&&sources.every(s=>s.destroyed)).toBe(true);layer.destroy();
});
