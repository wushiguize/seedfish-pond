import {describe,it,expect,vi} from 'vitest';
import {BufferAttribute,BufferGeometry,DataTexture,Mesh} from 'three';
import {FISH_CATALOG} from '../src/fish-catalog';
import {FISH_ANATOMIES,type FishAnatomy} from '../src/fish-anatomy';

vi.mock('../src/fish-surface',()=>({createAnatomicalSkin:()=>({color:new DataTexture(new Uint8Array([255,255,255,255]),1,1),normal:new DataTexture(new Uint8Array([127,127,255,255]),1,1),roughness:new DataTexture(new Uint8Array([225,225,225,255]),1,1)})}));
import {anatomicalSection,createAnatomicalFishRig,repairNormals} from '../src/anatomical-fish-model';

// Independent reference: standard Three normals plus the original nearest
// nonzero-normal repair, not the optimized direct-array implementation.
function referenceNormals(g:BufferGeometry):void {
  g.computeVertexNormals();const n=g.getAttribute('normal'),p=g.getAttribute('position'),valid:number[]=[];
  for(let i=0;i<n.count;i++)if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))>1e-8)valid.push(i);
  for(let i=0;i<n.count;i++)if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<1e-8){let best=-1,distance=Infinity;for(const j of valid){const d=(p.getX(i)-p.getX(j))**2+(p.getY(i)-p.getY(j))**2+(p.getZ(i)-p.getZ(j))**2;if(d<distance){distance=d;best=j;}}if(best>=0)n.setXYZ(i,n.getX(best),n.getY(best),n.getZ(best));else n.setXYZ(i,0,0,1);}
}
function maximumDifference(a:ArrayLike<number>,b:ArrayLike<number>):number {
  expect(a.length).toBe(b.length);let difference=0;
  for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);if(!Number.isFinite(delta))throw new Error(`Non-finite vertex/normal difference at ${i}`);difference=Math.max(difference,delta);}
  return difference;
}
const clamp=(value:number,a=0,b=1)=>Math.max(a,Math.min(b,value));
const smooth=(a:number,b:number,value:number)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};
function referenceBodyRest(a:FishAnatomy,ray:boolean):Float32Array {
  const positions:number[]=[],start=a.profile[0][0],end=a.profile.at(-1)![0];
  for(let i=0;i<=60;i++){const x=start+(end-start)*i/60,[w,top,bottom,z0]=anatomicalSection(a,x);for(let j=0;j<=36;j++){const angle=j/36*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle),power=1+(a.crossSection-1)*smooth(a.gillX-.16,a.gillX+.15,x),y=Math.sign(s)*Math.abs(s)**power*w,gillBulge=ray?0:Math.exp(-(((x-a.gillX+.025)/.06)**2))*Math.abs(s)**4*.003,skull=ray?Math.exp(-(((x-.49)/.15)**2)-((y/.16)**2))*Math.max(0,c)*.045:0;positions.push(x,y+Math.sign(s)*gillBulge,z0+c*(c>=0?top:bottom)+skull);}}
  for(const endIndex of [0,60]){const x=endIndex?end:start;positions.push(x,0,anatomicalSection(a,x)[3]);}
  return new Float32Array(positions);
}
function referenceBodyPose(rest:Float32Array,a:FishAnatomy,ray:boolean,phase:number,speed:number,turn:number):Float32Array {
  const positions=new Float32Array(rest.length),amplitude=(.015+clamp(speed/80)*.042)*a.bend,turning=clamp(turn,-1.6,1.6)*.022,span=.35-a.profile[0][0];
  const offset=(x:number)=>{const t=clamp((.35-x)/span,0,1.6);return amplitude*t**1.65*Math.sin(phase-t*2.1)+turning*t*t;};
  for(let at=0;at<rest.length;at+=3){const x=rest[at],y=rest[at+1],h=Math.atan2(offset(x+.004)-offset(x-.004),.008),disc=ray?Math.sin(phase*.67-x*3+Math.abs(y)*5)*(Math.abs(y)**2)*.10:0;positions[at]=x-y*Math.sin(h);positions[at+1]=offset(x)+y*Math.cos(h);positions[at+2]=rest[at+2]+disc;}
  return positions;
}
function stitchBodyNormals(g:BufferGeometry):void {
  const n=g.getAttribute('normal');for(let i=0;i<=60;i++){const first=i*37,last=first+36,x=n.getX(first)+n.getX(last),y=n.getY(first)+n.getY(last),z=n.getZ(first)+n.getZ(last),length=Math.hypot(x,y,z)||1;n.setXYZ(first,x/length,y/length,z/length);n.setXYZ(last,x/length,y/length,z/length);}
}

describe('animated normal calculation',()=>{
  it('preserves Three face accumulation, Float32 rounding and duplicate fan-root repair',()=>{
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,0,0,0,0,0,0,1,0,.2,0,1,.1,-1,0,-.1,0,-1,.2]),3));g.setIndex([0,3,4,1,4,5,2,5,6,0,0,3]);
    const reference=g.clone();referenceNormals(reference);repairNormals(g);
    expect(maximumDifference(g.getAttribute('normal').array,reference.getAttribute('normal').array)).toBe(0);
    // Repeat after deforming the shared fan while keeping its roots coincident.
    const p=g.getAttribute('position');p.setZ(3,.35);p.setZ(4,-.24);p.setZ(6,.39);reference.getAttribute('position').array.set(p.array);referenceNormals(reference);repairNormals(g);
    expect(maximumDifference(g.getAttribute('normal').array,reference.getAttribute('normal').array)).toBe(0);g.dispose();reference.dispose();
  });
  it('preserves non-indexed faces and the finite fallback for completely collapsed geometry',()=>{
    for(const positions of [[0,0,0,1,0,.2,0,1,.1],[0,0,0,0,0,0,0,0,0]]){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));const reference=g.clone();referenceNormals(reference);repairNormals(g);expect(maximumDifference(g.getAttribute('normal').array,reference.getAttribute('normal').array)).toBe(0);g.dispose();reference.dispose();}
  });
});

describe('anatomical bend equivalence',()=>{
  it.each(FISH_CATALOG.map(fish=>[fish.kind] as const))('keeps %s body positions and normals equal to the original bend formula',kind=>{
    const anatomy=FISH_ANATOMIES[kind];if(!anatomy)throw new Error(`Missing anatomical data: ${kind}`);
    const ray=kind==='stingray',rig=createAnatomicalFishRig(kind),body=rig.group.getObjectByName('anatomical-body') as Mesh;
    const rest=referenceBodyRest(anatomy,ray),reference=body.geometry.clone();
    try{for(const pose of [{phase:0,speed:0,turn:0},{phase:2.35,speed:47,turn:.8},{phase:7.8,speed:93,turn:-1.6}]){
      rig.animate(pose.phase,pose.speed,pose.turn);const expected=referenceBodyPose(rest,anatomy,ray,pose.phase,pose.speed,pose.turn);reference.getAttribute('position').array.set(expected);referenceNormals(reference);stitchBodyNormals(reference);
      expect(maximumDifference(body.geometry.getAttribute('position').array,expected)).toBeLessThanOrEqual(1e-7);
      expect(maximumDifference(body.geometry.getAttribute('normal').array,reference.getAttribute('normal').array)).toBeLessThanOrEqual(1e-6);
    }}finally{reference.dispose();rig.dispose();}
  });
});
