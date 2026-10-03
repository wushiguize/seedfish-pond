import {BufferAttribute,BufferGeometry,CatmullRomCurve3,Color,DoubleSide,Group,Mesh,MeshPhysicalMaterial,MeshStandardMaterial,SphereGeometry,Vector2,Vector3} from 'three';
import type {FishKind} from './model';
import type {KoiRig} from './koi-model';
import {FISH_ANATOMIES,getAnatomicalMouthX,type FishAnatomy} from './fish-anatomy';
import {createAnatomicalSkin} from './fish-surface';
type Point=[number,number,number];
const clamp=(value:number,a=0,b=1)=>Math.max(a,Math.min(b,value));
const smooth=(a:number,b:number,value:number)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};
const BODY_SEGMENTS=60,BODY_SIDES=36;

/** Monotone Hermite interpolation prevents rounded heads/flat skulls gaining
 * shoulders or pinches that do not occur in their explicit reference profile. */
export function anatomicalSection(a:FishAnatomy,x:number):number[] {
  const p=a.profile;let i=0;while(i<p.length-2&&x>p[i+1][0])i++;
  const left=p[i],right=p[i+1],h=right[0]-left[0],t=clamp((x-left[0])/h);
  return [1,2,3,4].map(k=>{
    const slope=(right[k]-left[k])/h,before=p[Math.max(0,i-1)],after=p[Math.min(p.length-1,i+2)];
    const harmonic=(s0:number,s1:number)=>s0*s1<=0?0:2*s0*s1/(s0+s1);
    const m0=i===0?slope:harmonic((left[k]-before[k])/(left[0]-before[0]),slope);
    const m1=i===p.length-2?slope:harmonic(slope,(after[k]-right[k])/(after[0]-right[0]));
    return (2*t*t*t-3*t*t+1)*left[k]+(t*t*t-2*t*t+t)*h*m0+(-2*t*t*t+3*t*t)*right[k]+(t*t*t-t*t)*h*m1;
  });
}
const normalScratch=new WeakMap<BufferGeometry,{valid:Uint32Array;invalid:Uint32Array}>();
/** Same face accumulation and Float32 rounding as Three's normal calculation.
 * Direct arrays avoid hundreds of thousands of Vector3/attribute calls per
 * school update; topology, normal direction and degenerate-root repair stay. */
export function repairNormals(g:BufferGeometry):void {
  const p=g.getAttribute('position') as BufferAttribute,index=g.getIndex();
  let n=g.getAttribute('normal') as BufferAttribute|undefined;
  if(!n||n.count!==p.count){n=new BufferAttribute(new Float32Array(p.count*3),3);g.setAttribute('normal',n);}
  if(!(p.array instanceof Float32Array)||!(n.array instanceof Float32Array)||p.itemSize!==3||n.itemSize!==3||p.normalized||n.normalized){g.computeVertexNormals();return;}
  const positions=p.array,normals=n.array;normals.fill(0);
  const count=index?.count??p.count;
  for(let i=0;i<count;i+=3){
    const a=(index?index.array[i]:i)*3,b=(index?index.array[i+1]:i+1)*3,c=(index?index.array[i+2]:i+2)*3;
    const cx=positions[c]-positions[b],cy=positions[c+1]-positions[b+1],cz=positions[c+2]-positions[b+2];
    const ax=positions[a]-positions[b],ay=positions[a+1]-positions[b+1],az=positions[a+2]-positions[b+2];
    const x=cy*az-cz*ay,y=cz*ax-cx*az,z=cx*ay-cy*ax;
    if(index){normals[a]+=x;normals[a+1]+=y;normals[a+2]+=z;normals[b]+=x;normals[b+1]+=y;normals[b+2]+=z;normals[c]+=x;normals[c+1]+=y;normals[c+2]+=z;}
    else {normals[a]=normals[b]=normals[c]=x;normals[a+1]=normals[b+1]=normals[c+1]=y;normals[a+2]=normals[b+2]=normals[c+2]=z;}
  }
  let scratch=normalScratch.get(g);
  if(!scratch||scratch.valid.length!==p.count){scratch={valid:new Uint32Array(p.count),invalid:new Uint32Array(p.count)};normalScratch.set(g,scratch);}
  let validCount=0,invalidCount=0;
  for(let i=0;i<p.count;i++){
    const at=i*3,x=normals[at],y=normals[at+1],z=normals[at+2],inverse=1/(Math.sqrt(x*x+y*y+z*z)||1);
    normals[at]=x*inverse;normals[at+1]=y*inverse;normals[at+2]=z*inverse;
    if(x!==0||y!==0||z!==0)scratch.valid[validCount++]=i;else scratch.invalid[invalidCount++]=i;
  }
  for(let i=0;i<invalidCount;i++){
    const at=scratch.invalid[i]*3;let best=-1,distance=Infinity;
    for(let j=0;j<validCount;j++){const candidate=scratch.valid[j]*3,dx=positions[at]-positions[candidate],dy=positions[at+1]-positions[candidate+1],dz=positions[at+2]-positions[candidate+2],d=dx*dx+dy*dy+dz*dz;if(d<distance){distance=d;best=candidate;}}
    if(best>=0){normals[at]=normals[best];normals[at+1]=normals[best+1];normals[at+2]=normals[best+2];}else {normals[at]=0;normals[at+1]=0;normals[at+2]=1;}
  }
  n.needsUpdate=true;
}
function bodyGeometry(a:FishAnatomy,ray=false):BufferGeometry {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],start=a.profile[0][0],end=a.profile.at(-1)![0];
  for(let i=0;i<=BODY_SEGMENTS;i++){
    const x=start+(end-start)*i/BODY_SEGMENTS,[w,top,bottom,z0]=anatomicalSection(a,x);
    for(let j=0;j<=BODY_SIDES;j++){
      const angle=j/BODY_SIDES*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle),power=1+(a.crossSection-1)*smooth(a.gillX-.16,a.gillX+.15,x);
      const y=Math.sign(s)*Math.abs(s)**power*w;
      const gillBulge=ray?0:Math.exp(-(((x-a.gillX+.025)/.06)**2))*Math.abs(s)**4*.003;
      const skull=ray?Math.exp(-(((x-.49)/.15)**2)-((y/.16)**2))*Math.max(0,c)*.045:0;
      positions.push(x,y+Math.sign(s)*gillBulge,z0+c*(c>=0?top:bottom)+skull);
      uv.push(i/BODY_SEGMENTS,ray?.5+y/(.57*2):j/BODY_SIDES);
    }
  }
  for(let i=0;i<BODY_SEGMENTS;i++)for(let j=0;j<BODY_SIDES;j++){const at=i*(BODY_SIDES+1)+j,next=at+BODY_SIDES+1;indices.push(at,next,at+1,at+1,next,next+1);}
  // Blunt snouts and real tail peduncles have closed planar caps, not needle tips.
  for(const endIndex of [0,BODY_SEGMENTS]){
    const first=endIndex*(BODY_SIDES+1),center=positions.length/3,x=endIndex?end:start,z0=anatomicalSection(a,x)[3];positions.push(x,0,z0);uv.push(endIndex?1:0,.5);
    for(let j=0;j<BODY_SIDES;j++)if(endIndex)indices.push(center,first+j+1,first+j);else indices.push(center,first+j,first+j+1);
  }
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));g.setIndex(indices);repairNormals(g);return g;
}
function bodyNormals(g:BufferGeometry):void {
  repairNormals(g);const n=g.getAttribute('normal') as BufferAttribute;
  for(let i=0;i<=BODY_SEGMENTS;i++){const first=i*(BODY_SIDES+1),last=first+BODY_SIDES;let x=n.getX(first)+n.getX(last),y=n.getY(first)+n.getY(last),z=n.getZ(first)+n.getZ(last),length=Math.hypot(x,y,z)||1;n.setXYZ(first,x/length,y/length,z/length);n.setXYZ(last,x/length,y/length,z/length);}
}
function ventralDiscGeometry(source:BufferGeometry,a:FishAnatomy):BufferGeometry {
  const p=source.getAttribute('position'),index=source.getIndex()!,positions:number[]=[],indices:number[]=[],mapped=new Map<number,number>();
  for(let i=0;i<index.count;i+=3){const old=[index.getX(i),index.getX(i+1),index.getX(i+2)],below=old.every(v=>p.getZ(v)<=anatomicalSection(a,p.getX(v))[3]+.001);if(!below)continue;
    for(const vertex of old){let at=mapped.get(vertex);if(at===undefined){at=positions.length/3;mapped.set(vertex,at);positions.push(p.getX(vertex),p.getY(vertex),p.getZ(vertex)-.0009);}indices.push(at);}}
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setIndex(indices);repairNormals(g);return g;
}
function opercularCover(a:FishAnatomy,side:number,bodyMaterial:MeshPhysicalMaterial):{mesh:Mesh;edge:Point[]} {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],edge:Point[]=[],rows=8,columns=14,start=a.profile[0][0],length=a.profile.at(-1)![0]-start;
  for(let i=0;i<=columns;i++){const theta=.42+i/columns*2.26,back=a.gillX+.018+Math.cos(theta)*.037,front=a.eye.x+.003;
    for(let j=0;j<=rows;j++){const t=j/rows,x=back+(front-back)*t,s=anatomicalSection(a,x),power=1+(a.crossSection-1)*smooth(a.gillX-.16,a.gillX+.15,x),y=side*Math.sin(theta)**power*s[0],c=Math.cos(theta),z=s[3]+c*(c>=0?s[1]:s[2]),bulge=.0019+Math.sin(Math.PI*t)*.0032;
      const point:Point=[x,y+side*bulge,z+bulge*c*.50];positions.push(...point);uv.push((x-start)/length,side>0?theta/(Math.PI*2):1-theta/(Math.PI*2));if(j===0)edge.push([x-.001,point[1]+side*.001,point[2]]);}}
  for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){const at=i*(rows+1)+j,next=at+rows+1;if(side>0)indices.push(at,at+1,next,at+1,next+1,next);else indices.push(at,next,at+1,at+1,next,next+1);}
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));g.setIndex(indices);repairNormals(g);
  const material=bodyMaterial.clone();material.roughness=.82;material.clearcoat=.14;const mesh=new Mesh(g,material);mesh.name=`anatomical-opercular-cover-${side}`;return {mesh,edge};
}
function tubeBundle(curves:Point[][],color:string,radius:number,opaque=false):Mesh {
  const positions:number[]=[],indices:number[]=[];
  for(const points of curves){const curve=new CatmullRomCurve3(points.map(p=>new Vector3(...p))),steps=9,sides=5,frames=curve.computeFrenetFrames(steps,false),offset=positions.length/3;
    for(let i=0;i<=steps;i++){const center=curve.getPoint(i/steps),r=radius*(1-i/steps*.62);for(let j=0;j<=sides;j++){const angle=j/sides*Math.PI*2,point=center.clone().addScaledVector(frames.normals[i],Math.cos(angle)*r).addScaledVector(frames.binormals[i],Math.sin(angle)*r);positions.push(point.x,point.y,point.z);}}
    for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const at=offset+i*(sides+1)+j,next=at+sides+1;indices.push(at,next,at+1,at+1,next,next+1);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setIndex(indices);repairNormals(g);
  return new Mesh(g,new MeshStandardMaterial({color,roughness:opaque?.49:.62,transparent:!opaque,opacity:opaque?1:.43,depthWrite:opaque}));
}
type FinPart={geometry:BufferGeometry;rest:Float32Array;role:string;radial?:Float32Array};
/** A fin is a volume-curved radial membrane with embedded ray ridges. It is not
 * a flat eight-point decal. Alpha thins toward each free membrane edge. */
function finPigment(kind:FishKind,role:string,u:number,t:number,a:FishAnatomy):Color {
  const color=new Color(a.fin),dark=new Color('#394d42'),cream=new Color('#d1d0b3');
  if(kind==='rummynose'&&role==='caudal')color.lerp(Math.floor(u*5)%2===0?dark:cream,smooth(.22,.65,t)*.83);
  if(['electricyellow','rainbowshark','balashark'].includes(kind)&&t>.76)color.lerp(dark,smooth(.76,.97,t)*.88);
  if(kind==='guppy'&&(role==='caudal'||role==='dorsal')){color.set('#b77c49');const blue=Math.sin(u*16+t*5)*Math.sin(t*8-u*4);color.lerp(new Color('#4b7b8b'),smooth(-.15,.45,blue)*.86);const spots=Math.sin(u*38+t*17)*Math.sin(t*42-u*12);if(spots>.43)color.lerp(dark,smooth(.43,.86,spots)*.72);}
  if(kind==='endler'&&role==='caudal'){color.set('#b88647');color.lerp(dark,(u<.13||u>.87)?smooth(.20,.8,t)*.73:0);if(u>.28&&u<.72)color.lerp(new Color('#849d87'),.56);}
  if(kind==='boesemani')color.lerp(cream,t*.15);
  if(kind==='clownloach')color.lerp(new Color('#986347'),.30);
  if(kind==='betta'&&['caudal','dorsal','anal'].includes(role)){color.set('#935747');color.lerp(new Color('#46777f'),Math.sin(u*Math.PI)**2*(1-t)*.65);color.lerp(new Color('#354f5d'),t**3*.22);}
  return color;
}
const pigmentedLongFin=(kind:FishKind,role:string)=>['guppy','endler','betta'].includes(kind)&&['caudal','dorsal','anal'].includes(role);
const finAlpha=(kind:FishKind,role:string,t:number)=>pigmentedLongFin(kind,role)?.96-t**1.8*.13:.79-t**1.4*.45;
function finMesh(g:BufferGeometry,parts:FinPart[],role:string,radial:number[],kind:FishKind):Mesh {
  repairNormals(g);parts.push({geometry:g,rest:(g.getAttribute('position').array as Float32Array).slice(),role,radial:new Float32Array(radial)});
  return new Mesh(g,new MeshPhysicalMaterial({color:0xffffff,vertexColors:true,transparent:true,opacity:pigmentedLongFin(kind,role)?1:.76,side:DoubleSide,roughness:.46,metalness:0,clearcoat:.12,clearcoatRoughness:.35,depthWrite:false}));
}
function fanMembrane(root:Point,edges:Point[],a:FishAnatomy,kind:FishKind,role:string,parts:FinPart[],rayCurves:Point[][]):Mesh {
  const curve=new CatmullRomCurve3(edges.map(p=>new Vector3(...p)),false,'centripetal'),rays=role==='caudal'?22:13,rows=5,positions:number[]=[],indices:number[]=[],colors:number[]=[],uv:number[]=[],radial:number[]=[];
  const rootVec=new Vector3(...root);
  for(let i=0;i<=rays;i++){
    const edge=curve.getPoint(i/rays),delta=edge.clone().sub(rootVec),rayPoints:Point[]=[];
    for(let j=0;j<=rows;j++){const t=j/rows,point=rootVec.clone().addScaledVector(delta,t),camber=Math.sin(Math.PI*t)*Math.sin(i/rays*Math.PI)*.016;
      if(role==='pectoral'||role==='pelvic')point.z+=camber;else point.y+=camber;
      positions.push(point.x,point.y,point.z);uv.push(i/rays,t);radial.push(t);
      const color=finPigment(kind,role,i/rays,t,a),grain=1+Math.sin(i*2.399)*.045,rootShade=.76+.24*t;
      colors.push(color.r*grain*rootShade,color.g*grain*rootShade,color.b*grain*rootShade,finAlpha(kind,role,t));
      if(j===0||j===2||j===rows)rayPoints.push([point.x,point.y,point.z]);
    }
    if(i>0&&i<rays)rayCurves.push(rayPoints);
  }
  for(let i=0;i<rays;i++)for(let j=0;j<rows;j++){const at=i*(rows+1)+j,next=at+rows+1;indices.push(at,next,at+1,at+1,next,next+1);}
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));g.setAttribute('color',new BufferAttribute(new Float32Array(colors),4));g.setIndex(indices);repairNormals(g);
  return finMesh(g,parts,role,radial,kind);
}
/** Each median fin ray begins at its own vertebral station. A long Clarias fin
 * therefore follows the whole back rather than fanning out of one anchor. */
function medianMembrane(a:FishAnatomy,kind:FishKind,outline:[number,number][],role:string,parts:FinPart[],rayCurves:Point[][]):Mesh {
  const curve=new CatmullRomCurve3(outline.map(([x,h])=>new Vector3(x,h,0)),false,'centripetal'),columns=28,rows=5,positions:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[],radial:number[]=[],sign=role==='anal'?-1:1;
  for(let i=0;i<=columns;i++){const edge=curve.getPoint(i/columns),s=anatomicalSection(a,edge.x),z=s[3]+sign*(role==='anal'?s[2]:s[1]),points:Point[]=[];
    for(let j=0;j<=rows;j++){const t=j/rows,height=Math.max(0,edge.y),y=Math.sin(Math.PI*t)*Math.sin(i/columns*Math.PI)*.013,point:Point=[edge.x,y,z+sign*height*t];positions.push(...point);radial.push(t);uv.push(i/columns,t);
      const color=finPigment(kind,role,i/columns,t,a),shade=.76+t*.24;colors.push(color.r*shade,color.g*shade,color.b*shade,finAlpha(kind,role,t));if(j===0||j===2||j===rows)points.push(point);}
    if(i>0&&i<columns)rayCurves.push(points);
  }
  for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){const at=i*(rows+1)+j,next=at+rows+1;indices.push(at,next,at+1,at+1,next,next+1);}
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));g.setAttribute('color',new BufferAttribute(new Float32Array(colors),4));g.setIndex(indices);return finMesh(g,parts,role,radial,kind);
}
function caudalEdge(a:FishAnatomy,kind:FishKind,side=0):Point[]{
  const x=a.profile[0][0],z=a.profile[0][4],{form,length:l,height:h,notch:n}=a.tail;
  const points:[number,number][]=form==='round'?[[.025,.020],[l*.40,h*.86],[l*.78,h],[l,h*.51],[l,0],[l,-h*.51],[l*.78,-h],[l*.40,-h*.86],[.025,-.020]]:
    form==='fan'||form==='veil'?[[.028,.025],[l*.34,h*.82],[l*.76,h],[l*.95,h*.69],[l,0],[l*.95,-h*.69],[l*.76,-h],[l*.34,-h*.82],[.028,-.025]]:
    form==='truncate'?[[.02,.025],[l*.90,h],[l,h*.9],[l,-h*.9],[l*.90,-h],[.02,-.025]]:
    [[.025,.023],[l*.40,h*.58],[l*.92,h],[l,h*.93],[n,0],[l,-h*.93],[l*.92,-h],[l*.40,-h*.58],[.025,-.023]];
  if(form==='sword')points.splice(points.length-2,0,[l+.10,-h*.82]);
  if(form==='lyre'){points[2]=[l+.05,h];points[6]=[l+.05,-h];}
  if(kind==='guppy'){points.splice(0,points.length,[.016,.018],[l*.85,h],[l*.99,h*.85],[l,h*.37],[l,-h*.37],[l*.99,-h*.85],[l*.85,-h],[.016,-.018]);}
  return points.map(([dx,dz])=>[x-dx,side*(.022+dx*.16)+dz*.045,z+dz]);
}

export function createAnatomicalFishRig(kind:FishKind):KoiRig {
  const a=FISH_ANATOMIES[kind];if(!a)throw new Error(`Anatomical reconstruction missing: ${kind}`);
  const isRay=kind==='stingray',group=new Group();group.name=`anatomical-${kind}`;group.userData={kind,scan:false,modelingMethod:'Independent anatomical landmark reconstruction with manually interpreted reference profiles',modelVersion:5,referenceUrl:a.referenceUrl,notes:a.notes};
  const textures=createAnatomicalSkin(kind,a),geometry=bodyGeometry(a,isRay),bodyMaterial=new MeshPhysicalMaterial({map:textures.color,normalMap:textures.normal,normalScale:new Vector2(a.scales?.30:.09,a.scales?.30:.09),roughnessMap:textures.roughness,roughness:.88,metalness:kind==='yamabuki'||kind==='platinum'?.022:.003,clearcoat:.11,clearcoatRoughness:.45});
  const body=new Mesh(geometry,bodyMaterial);body.name='anatomical-body';group.add(body);
  const bodyRest=(geometry.getAttribute('position').array as Float32Array).slice(),parts:FinPart[]=[],rayCurves:Point[][]=[];
  if(isRay){const g=ventralDiscGeometry(geometry,a),ventral=new Mesh(g,new MeshPhysicalMaterial({color:'#b9b5a0',roughness:.69,clearcoat:.16,clearcoatRoughness:.45}));ventral.name='pale-ventral-disc-skin';group.add(ventral);parts.push({geometry:g,rest:(g.getAttribute('position').array as Float32Array).slice(),role:'ventral'});}
  if(a.tail.form==='whip'){
    const x=a.profile[0][0],tail=tubeBundle([[[x,0,0],[x-.27,0,-.003],[x-.66,.014,-.01],[x-a.tail.length,.009,-.012]]],a.base,.017,true);tail.name='tapered-whip-tail';group.add(tail);parts.push({geometry:tail.geometry,rest:(tail.geometry.getAttribute('position').array as Float32Array).slice(),role:'whip'});
  } else for(const side of a.tail.form==='double'?[-1,1]:[0]){
    const x=a.profile[0][0],tail=fanMembrane([x,side*.023,a.profile[0][4]],caudalEdge(a,kind,side),a,kind,'caudal',parts,rayCurves);tail.name=side?`double-caudal-${side}`:'caudal-membrane';group.add(tail);
  }
  for(const [role,outline] of [['dorsal',a.dorsal],['anal',a.anal]] as const){
    if(!outline.length)continue;const fin=medianMembrane(a,kind,outline,role,parts,rayCurves);fin.name=`${role}-anatomical-membrane`;group.add(fin);
  }
  if(a.adipose){const f=a.adipose,outline:[number,number][]=[[f.x+f.length*.50,0],[f.x+f.length*.15,f.height*.84],[f.x-f.length*.20,f.height],[f.x-f.length*.50,0]],fin=medianMembrane(a,kind,outline,'adipose',parts,[]);fin.name='independent-soft-adipose-fin';group.add(fin);}
  for(const side of [-1,1])for(const role of ['pectoral','pelvic'] as const){const spec=a[role];if(!spec.length&&!spec.reach)continue;
    const s=anatomicalSection(a,spec.x),root:Point=[spec.x,side*s[0]*.97,s[3]-s[2]*.40],l=spec.length,r=spec.reach;
    const edges:Point[]=[[root[0]+.018,root[1]+side*r*.20,root[2]-.012],[root[0]-l*.18,root[1]+side*r*.74,root[2]-.025],[root[0]-l*.63,root[1]+side*r,root[2]-.030],[root[0]-l,root[1]+side*r*.57,root[2]-.020],[root[0]-l*.82,root[1]+side*r*.08,root[2]]];
    const fin=fanMembrane(root,edges,a,kind,role,parts,rayCurves);fin.name=`${role}-membrane-${side}`;group.add(fin);
    const filament=role==='pelvic'?a.pelvic.filament:undefined;
    if(filament){const line=tubeBundle([[root,[root[0]-.14,root[1]+side*.03,root[2]-.14],[root[0]-.31,root[1]+side*.035,root[2]-filament]]],a.fin,.0014,true);line.name=`pelvic-filament-${side}`;group.add(line);parts.push({geometry:line.geometry,rest:(line.geometry.getAttribute('position').array as Float32Array).slice(),role:'filament'});}
  }
  if(rayCurves.length){const rays=tubeBundle(rayCurves,a.fin,.00085);rays.name='combined-anatomical-fin-rays';group.add(rays);parts.push({geometry:rays.geometry,rest:(rays.geometry.getAttribute('position').array as Float32Array).slice(),role:'rays'});}

  const eyes=new Group();eyes.name='embedded-cranial-details';group.add(eyes);
  const pupil=new MeshPhysicalMaterial({color:'#20261e',roughness:.13,metalness:0,clearcoat:1,clearcoatRoughness:.07}),irisMaterial=new MeshStandardMaterial({color:kind==='yamabuki'?'#7c7546':'#6a7462',roughness:.46});
  for(const side of [-1,1]){
    const eyeX=a.eye.x,s=anatomicalSection(a,eyeX),r=a.eye.radius,power=1+(a.crossSection-1)*smooth(a.gillX-.16,a.gillX+.15,eyeX),lift=a.eye.lift;
    const eyeY=isRay?side*.112:side*Math.sqrt(1-lift*lift)**power*s[0],raySurface=s[3]+s[1]*Math.sqrt(1-(eyeY/s[0])**2)+Math.exp(-(((eyeX-.49)/.15)**2)-((eyeY/.16)**2))*.045;
    const eyeZ=isRay?raySurface+r*.03:s[3]+s[1]*lift,normal=isRay?new Vector3(0,side*.12,1).normalize():new Vector3(0,side*Math.sqrt(1-lift*lift),lift).normalize(),origin=new Vector3(eyeX,eyeY,eyeZ).addScaledVector(normal,-r*.19);
    const globe=new Mesh(new SphereGeometry(r,14,10),irisMaterial);globe.scale.set(1,.49,.84);globe.quaternion.setFromUnitVectors(new Vector3(0,1,0),normal);globe.position.copy(origin);globe.name=`embedded-eye-${side}`;eyes.add(globe);
    const lens=new Mesh(new SphereGeometry(r*.74,14,10),pupil);lens.scale.set(.94,.37,.78);lens.quaternion.copy(globe.quaternion);lens.position.copy(origin).addScaledVector(normal,r*.36);lens.name=`corneal-lens-${side}`;eyes.add(lens);
    if(isRay){const spiracle=new Mesh(new SphereGeometry(1,16,8),new MeshStandardMaterial({color:'#454b3a',roughness:.86}));spiracle.scale.set(.018,.010,.0014);spiracle.position.set(eyeX-.064,side*.112,raySurface-.004);spiracle.name=`recessed-spiracle-${side}`;eyes.add(spiracle);}
    else {const x=a.eye.x+.058,sn=anatomicalSection(a,x),nostril=new Mesh(new SphereGeometry(.0028,10,7),new MeshStandardMaterial({color:'#727c69',roughness:.72}));nostril.scale.set(1,.55,.48);nostril.position.set(x,side*sn[0]*.81,sn[3]+sn[1]*.58);nostril.name=`small-embedded-nasal-pore-${side}`;eyes.add(nostril);}
  }
  const mouth=new Group();mouth.name='mouth';mouth.position.set(getAnatomicalMouthX(kind),0,a.mouthZ);group.add(mouth);
  const lipX=0;
  const mouthOpening=new Mesh(new SphereGeometry(1,16,8),new MeshStandardMaterial({color:'#4b5140',roughness:.85}));mouthOpening.position.x=lipX;mouthOpening.scale.set(.0018,a.mouthWidth*.76,a.mouthHeight*.65);mouth.add(mouthOpening);
  const lipCurves:Point[][]=[];for(const sign of [-1,1]){const points:Point[]=[];for(let i=0;i<=10;i++){const angle=i/10*Math.PI;points.push([lipX+.001,a.mouthWidth*Math.cos(angle),sign*a.mouthHeight*Math.sin(angle)]);}lipCurves.push(points);}
  const lip=tubeBundle(lipCurves,a.base,.0015,true);lip.name='fine-upper-lower-lips';mouth.add(lip);
  if(isRay||kind==='bristlenose'||kind==='otocinclus')mouth.rotation.y=-Math.PI/2;
  if(a.barbels){const whiskers:Point[][]=[];for(const side of [-1,1])for(let pair=0;pair<a.barbels;pair++){const sx=a.mouthX-.018-pair*.023,sy=side*(a.mouthWidth*.77+pair*.018),sz=a.mouthZ-pair*.009,l=a.barbelLength*(pair===0?1:pair===1?.70:.48);
    whiskers.push(kind==='arowana'?[[sx,sy,sz],[sx+l*.55,sy+side*.006,sz+.006],[sx+l,sy+side*.011,sz+.002]]:[[sx,sy,sz],[sx-.033,sy+side*l*.47,sz-.016],[sx-.106,sy+side*l,sz-.052]]);}
    const barbels=tubeBundle(whiskers,a.base,a.barbels>2?.002:.0016,true);barbels.name='tapered-sensory-barbels';group.add(barbels);parts.push({geometry:barbels.geometry,rest:(barbels.geometry.getAttribute('position').array as Float32Array).slice(),role:'barbels'});}
  if(kind==='bristlenose'){const tentacles:Point[][]=[];for(const side of [-1,1])for(let i=0;i<5;i++){const x=.79-i*.032,s=anatomicalSection(a,x),y=side*(.050+i*.022),z=s[3]+s[1]*Math.sqrt(Math.max(0,1-(y/s[0])**2)),tip:Point=[x+.014,y+side*.012,z+.043+(i%2)*.016];tentacles.push([[x,y,z],[x+.005,y+side*.005,z+.028],tip]);if(i<3)tentacles.push([[tip[0]-.008,tip[1]-.004,tip[2]-.012],[tip[0]+.010,tip[1]+side*.006,tip[2]+.009],[tip[0]+.013,tip[1]+side*.010,tip[2]+.012]]);}
    const bristles=tubeBundle(tentacles,a.base,.0019,true);bristles.name='branched-nasal-tentacles';group.add(bristles);}
  if(!isRay){const darkLines:Point[][]=[],highlights:Point[][]=[];for(const side of [-1,1]){const {mesh,edge}=opercularCover(a,side,bodyMaterial);group.add(mesh);darkLines.push(edge);highlights.push(edge.map(([x,y,z])=>[x+.004,y+side*.0007,z+.0007]));}
    const shade=new Color(a.base).multiplyScalar(.70),light=new Color(a.base).lerp(new Color('#d2d1b5'),.33),dark=tubeBundle(darkLines,`#${shade.getHexString()}`,.0013,true),highlight=tubeBundle(highlights,`#${light.getHexString()}`,.0011,true);dark.name='subtle-opercular-shadow-lip';highlight.name='wet-opercular-edge-highlight';group.add(dark,highlight);}
  const span=.35-a.profile[0][0];
  const bendCoefficients=(x:number)=>{const t=clamp((.35-x)/span,0,1.6),power=t**1.65;return [power*Math.cos(t*2.1),-power*Math.sin(t*2.1),t*t];};
  const prepareDeformation=(g:BufferGeometry,rest:Float32Array,role:string,radial?:Float32Array)=>{
    const count=rest.length/3,indices=new Uint32Array(count),xs:number[]=[],lookup=new Map<number,number>();
    for(let i=0;i<count;i++){const x=rest[i*3];let at=lookup.get(x);if(at===undefined){at=xs.length;lookup.set(x,at);xs.push(x);}indices[i]=at;}
    // Equal rest X coordinates share the exact same bend and heading. Static
    // spatial sine/cosine terms let each phase be evaluated once per rig.
    const coefficients=new Float64Array(xs.length*6);
    for(let i=0;i<xs.length;i++){const at=i*6,value=bendCoefficients(xs[i]),plus=bendCoefficients(xs[i]+.004),minus=bendCoefficients(xs[i]-.004);for(let j=0;j<3;j++){coefficients[at+j]=value[j];coefficients[at+3+j]=plus[j]-minus[j];}}
    const flutter=radial?new Float64Array(count*2):undefined;
    const disc=isRay&&(role==='body'||role==='ventral')?new Float64Array(count*2):undefined;
    for(let i=0;i<count;i++){const x=rest[i*3],y=rest[i*3+1];if(flutter){const q=-x*3+y*4,scale=(radial![i]**2)*(['caudal','dorsal','anal'].includes(role)?.012:.019);flutter[i*2]=Math.cos(q)*scale;flutter[i*2+1]=Math.sin(q)*scale;}if(disc){const q=-x*3+Math.abs(y)*5,scale=(Math.abs(y)**2)*.10;disc[i*2]=Math.cos(q)*scale;disc[i*2+1]=Math.sin(q)*scale;}}
    return {g,rest,role,indices,coefficients,flutter,disc,offset:new Float64Array(xs.length),sin:new Float64Array(xs.length),cos:new Float64Array(xs.length)};
  };
  const deformers=[prepareDeformation(geometry,bodyRest,'body'),...parts.map(part=>prepareDeformation(part.geometry,part.rest,part.role,part.radial))];
  let previousPhase=NaN,previousSpeed=NaN,previousTurn=NaN;
  const animate=(phase:number,speed:number,turn:number)=>{
    if(phase===previousPhase&&speed===previousSpeed&&turn===previousTurn)return;previousPhase=phase;previousSpeed=speed;previousTurn=turn;
    const vigor=clamp(speed/80),amplitude=(.015+vigor*.042)*a.bend,turning=clamp(turn,-1.6,1.6)*.022;
    const sinPhase=Math.sin(phase),cosPhase=Math.cos(phase),sinFlutter=Math.sin(phase*.78),cosFlutter=Math.cos(phase*.78),sinDisc=Math.sin(phase*.67),cosDisc=Math.cos(phase*.67);
    for(const d of deformers){
      const c=d.coefficients;
      for(let i=0;i<d.offset.length;i++){const at=i*6,h=Math.atan2(amplitude*(sinPhase*c[at+3]+cosPhase*c[at+4])+turning*c[at+5],.008);d.offset[i]=amplitude*(sinPhase*c[at]+cosPhase*c[at+1])+turning*c[at+2];d.sin[i]=Math.sin(h);d.cos[i]=Math.cos(h);}
      const p=d.g.getAttribute('position') as BufferAttribute,positions=p.array as Float32Array;
      const lateral=d.role==='caudal'||d.role==='dorsal'||d.role==='anal',vertical=d.role==='pectoral'||d.role==='pelvic';
      for(let i=0;i<p.count;i++){const at=i*3,slot=d.indices[i],y=d.rest[at+1],flutter=d.flutter?sinFlutter*d.flutter[i*2]+cosFlutter*d.flutter[i*2+1]:0,disc=d.disc?sinDisc*d.disc[i*2]+cosDisc*d.disc[i*2+1]:0;
        positions[at]=d.rest[at]-y*d.sin[slot];positions[at+1]=d.offset[slot]+y*d.cos[slot]+(lateral?flutter:0);positions[at+2]=d.rest[at+2]+disc+(vertical?flutter:0);}
      p.needsUpdate=true;if(d.role==='body')bodyNormals(d.g);else repairNormals(d.g);
    }
    mouth.scale.z=1+Math.sin(phase*.51)*.035;
  };
  animate(0,30,0);
  return {group,animate,dispose:()=>{const gs=new Set<BufferGeometry>(),ms=new Set<MeshStandardMaterial>();group.traverse(o=>{if(o instanceof Mesh){gs.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());textures.color.dispose();textures.normal.dispose();textures.roughness.dispose();}};
}
