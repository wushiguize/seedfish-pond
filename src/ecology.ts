import { Container, Sprite, Texture } from 'pixi.js';
import { WORLD, clampPond } from './model';

interface Plant { sprite:Sprite; rotation:number; phase:number; sway:number; opacity:number }
export interface EcologyAnimal { id:string; rig:Container; x:number; y:number; angle:number; depth:number; halfLength:number; radius:number; halfHeight:number }
interface Minnow { animal:EcologyAnimal; rig:Container; tail:Sprite; forward:number; lateral:number; phase:number }
interface Shoal { fish:Minnow[]; angle:number; radius:number; phase:number; pace:number; spread:number }
interface Bubble { sprite:Sprite; age:number; life:number; x:number; y:number; phase:number }
interface Bed { x:number; y:number }

const tau=Math.PI*2;
const depthScale=200;
function seeded(seed:number):()=>number {
  return ()=>{seed|=0;seed=seed+0x6d2b79f5|0;let value=Math.imul(seed^seed>>>15,1|seed);value^=value+Math.imul(value^value>>>7,61|value);return ((value^value>>>14)>>>0)/4294967296;};
}
function canvas(width:number,height:number,draw:(c:CanvasRenderingContext2D)=>void):Texture {
  const image=document.createElement('canvas');image.width=width;image.height=height;
  const c=image.getContext('2d');if(!c)throw new Error('无法创建湖泊生态纹理');
  draw(c);return Texture.from(image);
}
function ribbonTexture(variant:number):Texture {
  return canvas(64,192,c=>{
    const path=new Path2D();path.moveTo(30,185);
    if(variant===0){path.bezierCurveTo(17,149,14,101,25,70);path.bezierCurveTo(41,43,39,23,31,6);path.bezierCurveTo(50,27,47,56,34,79);path.bezierCurveTo(23,111,32,157,34,185);}
    else {path.bezierCurveTo(37,139,48,114,40,83);path.bezierCurveTo(23,56,19,27,24,5);path.bezierCurveTo(13,32,14,53,28,88);path.bezierCurveTo(37,119,26,157,30,185);}
    path.closePath();
    const g=c.createLinearGradient(14,0,44,192);g.addColorStop(0,'rgba(134,158,102,.52)');g.addColorStop(.34,'rgba(100,137,80,.84)');g.addColorStop(.75,'rgba(55,91,54,.82)');g.addColorStop(1,'rgba(34,68,46,.4)');c.fillStyle=g;c.fill(path);
    c.save();c.clip(path);c.strokeStyle='rgba(178,188,126,.27)';c.lineWidth=.85;c.beginPath();c.moveTo(32,185);c.bezierCurveTo(27,140,33,85,variant?22:36,9);c.stroke();c.restore();
  });
}
function pondweedTexture():Texture {
  return canvas(96,192,c=>{
    c.strokeStyle='rgba(70,105,64,.82)';c.lineWidth=1.7;c.beginPath();c.moveTo(48,188);c.bezierCurveTo(44,147,53,74,43,9);c.stroke();
    for(let i=0;i<11;i++)for(const side of [-1,1]){
      const y=25+i*13,x=46+Math.sin(i*.63)*3,length=12+Math.sin(i*.5)*8;
      const leaf=new Path2D();leaf.moveTo(x,y+4);leaf.quadraticCurveTo(x+side*length*.3,y-6,x+side*length,y-12);leaf.quadraticCurveTo(x+side*length*.85,y+1,x,y+4);
      const g=c.createLinearGradient(x,y,x+side*length,y-8);g.addColorStop(0,'rgba(54,92,53,.8)');g.addColorStop(.6,'rgba(103,137,75,.83)');g.addColorStop(1,'rgba(130,155,98,.5)');c.fillStyle=g;c.fill(leaf);
      c.lineWidth=.65;c.strokeStyle='rgba(172,181,117,.22)';c.beginPath();c.moveTo(x,y+2);c.lineTo(x+side*length*.83,y-9);c.stroke();
    }
  });
}
function pebbleTexture():Texture {
  return canvas(64,48,c=>{
    const outline=new Path2D();outline.moveTo(7,27);outline.bezierCurveTo(5,13,21,6,36,8);outline.bezierCurveTo(55,9,60,22,54,33);outline.bezierCurveTo(44,43,14,42,7,27);outline.closePath();
    const g=c.createRadialGradient(25,16,2,32,24,30);g.addColorStop(0,'rgba(147,153,121,.7)');g.addColorStop(.55,'rgba(99,119,94,.7)');g.addColorStop(1,'rgba(44,72,59,.6)');c.fillStyle=g;c.fill(outline);
    c.save();c.clip(outline);const random=seeded(4701);for(let i=0;i<76;i++){c.fillStyle=i%3?'rgba(39,64,51,.16)':'rgba(190,181,136,.14)';c.fillRect(random()*64,random()*48,.6+random()*1.1,.6+random()*1.1);}c.restore();
  });
}
function minnowBodyTexture():Texture {
  return canvas(88,32,c=>{
    const body=new Path2D();body.moveTo(78,16);body.bezierCurveTo(70,8,51,7,19,14);body.quadraticCurveTo(17,16,19,18);body.bezierCurveTo(45,25,68,25,78,16);body.closePath();
    c.fillStyle='rgba(149,170,146,.25)';for(const side of [-1,1]){c.beginPath();c.moveTo(58,16+side*4);c.quadraticCurveTo(46,16+side*14,42,16+side*9);c.lineTo(52,16+side*4);c.fill();}
    const g=c.createLinearGradient(0,8,0,24);g.addColorStop(0,'#345747');g.addColorStop(.32,'#627c61');g.addColorStop(.48,'#8a9f7e');g.addColorStop(.68,'#627e66');g.addColorStop(1,'#315347');c.fillStyle=g;c.fill(body);
    c.strokeStyle='rgba(163,178,143,.35)';c.lineWidth=.8;c.beginPath();c.moveTo(25,16);c.quadraticCurveTo(48,14,67,16);c.stroke();c.fillStyle='#284439';for(const side of [-1,1]){c.beginPath();c.arc(70,16+side*3.3,1,0,tau);c.fill();}
  });
}
function minnowTailTexture():Texture {
  return canvas(32,32,c=>{
    c.fillStyle='rgba(133,159,132,.5)';c.beginPath();c.moveTo(27,16);c.quadraticCurveTo(16,12,5,4);c.lineTo(9,16);c.lineTo(5,28);c.quadraticCurveTo(15,21,27,16);c.fill();
    c.lineWidth=.7;c.strokeStyle='rgba(65,108,86,.4)';for(const y of [7,12,20,25]){c.beginPath();c.moveTo(26,16);c.lineTo(7,y);c.stroke();}
  });
}
function bubbleTexture():Texture {
  return canvas(24,24,c=>{
    c.lineWidth=1;c.strokeStyle='rgba(159,188,161,.58)';c.beginPath();c.arc(12,12,7,0,tau);c.stroke();c.strokeStyle='rgba(18,64,50,.29)';c.beginPath();c.arc(13,13,6,.3,2.6);c.stroke();c.strokeStyle='rgba(211,224,189,.58)';c.beginPath();c.arc(11,11,5,3.5,4.8);c.stroke();
  });
}

function closestBodyPoints(a:EcologyAnimal,b:EcologyAnimal):{ax:number;ay:number;bx:number;by:number} {
  const adx=Math.cos(a.angle)*a.halfLength,ady=Math.sin(a.angle)*a.halfLength,bdx=Math.cos(b.angle)*b.halfLength,bdy=Math.sin(b.angle)*b.halfLength;
  const ax=a.x-adx,ay=a.y-ady,bx=b.x-bdx,by=b.y-bdy,ux=adx*2,uy=ady*2,vx=bdx*2,vy=bdy*2,wx=ax-bx,wy=ay-by;
  const aa=ux*ux+uy*uy,bb=ux*vx+uy*vy,cc=vx*vx+vy*vy,dd=ux*wx+uy*wy,ee=vx*wx+vy*wy,det=aa*cc-bb*bb;
  let s=det>1e-8?Math.max(0,Math.min(1,(bb*ee-cc*dd)/det)):0,t=cc>0?(bb*s+ee)/cc:0;
  if(t<0){t=0;s=aa>0?Math.max(0,Math.min(1,-dd/aa)):0;}else if(t>1){t=1;s=aa>0?Math.max(0,Math.min(1,(bb-dd)/aa)):0;}
  return {ax:ax+ux*s,ay:ay+uy*s,bx:bx+vx*t,by:by+vy*t};
}

function separateAnimals(animals:EcologyAnimal[]):void {
  // A minnow has a small capsule in the water plane and an elliptical vertical
  // cross-section. Fish at separate depths may cross in projection, but not
  // occupy the same volume. The depths remain stable through every correction.
  for(let pass=0;pass<6;pass++){
    let contacts=0;
    for(let i=0;i<animals.length;i++)for(let j=i+1;j<animals.length;j++){
      const a=animals[i],b=animals[j],vertical=Math.abs(a.depth-b.depth)*depthScale/(a.halfHeight+b.halfHeight);
      if(vertical>=1)continue;
      const reach=a.halfLength+b.halfLength+a.radius+b.radius;if(Math.abs(a.x-b.x)>reach||Math.abs(a.y-b.y)>reach)continue;
      const points=closestBodyPoints(a,b),dx=points.ax-points.bx,dy=points.ay-points.by,distance=Math.hypot(dx,dy),required=(a.radius+b.radius)*Math.sqrt(1-vertical*vertical);
      if(distance>=required+.015)continue;
      const direction=distance>1e-7?{x:dx/distance,y:dy/distance}:{x:-Math.sin(a.angle),y:Math.cos(a.angle)};
      const correction=(required+.025-distance)*.5;a.rig.position.set(a.x+direction.x*correction,a.y+direction.y*correction);b.rig.position.set(b.x-direction.x*correction,b.y-direction.y*correction);contacts++;
    }
    if(!contacts)break;
  }
}

/** Ambient lake life is decorative: it has no ownership, save records or feeding. */
export class LakeEcology {
  readonly container=new Container();
  private plants:Plant[]=[];
  private shoals:Shoal[]=[];
  private animals:EcologyAnimal[]=[];
  private bubbles:Bubble[]=[];
  private beds:Bed[]=[];
  private textures:Texture[]=[];
  private random=seeded(0x71ace);
  private bubbleClock=2.4;
  private fishLayer=new Container();
  private bubbleLayer=new Container();

  constructor(){
    this.container.label='lake-ecology';this.container.eventMode='none';this.container.interactiveChildren=false;
    const ribbons=[ribbonTexture(0),ribbonTexture(1)],weed=pondweedTexture(),pebble=pebbleTexture(),body=minnowBodyTexture(),tail=minnowTailTexture(),bubble=bubbleTexture();
    this.textures.push(...ribbons,weed,pebble,body,tail,bubble);
    const floor=new Container(),vegetation=new Container();this.container.addChild(floor,vegetation,this.fishLayer,this.bubbleLayer);
    // River stones remain scattered along the shallows; vegetation occupies only
    // five small submerged beds, leaving the water surface and centre open.
    const stoneClusters=[.35,.64,1.04,1.93,2.31,2.64,3.24,3.67,4.13,4.72,5.08,5.54,5.96];
    for(const angle of stoneClusters){
      for(let n=0;n<2;n++){
        const a=angle+(this.random()-.5)*.13,r=.80+this.random()*.1;
        const x=WORLD.cx+Math.cos(a)*WORLD.rx*r,y=WORLD.cy+Math.sin(a)*WORLD.ry*r;
        for(let p=0;p<1+Math.floor(this.random()*3);p++){
          const point=clampPond(x+(this.random()-.5)*65,y+(this.random()-.5)*42,.95),stone=new Sprite(pebble);stone.anchor.set(.5);stone.position.set(point.x,point.y);stone.rotation=this.random()*tau;stone.scale.set(.23+this.random()*.34);stone.alpha=.27+this.random()*.2;floor.addChild(stone);
        }
      }
    }
    const plantClusters=[.58,.75,2.68,2.84,4.41];
    for(const [index,angle] of plantClusters.entries()){
        const r=.77+this.random()*.065,x=WORLD.cx+Math.cos(angle)*WORLD.rx*r,y=WORLD.cy+Math.sin(angle)*WORLD.ry*r;
        this.beds.push({x,y});
        const inward=Math.atan2(WORLD.cy-y,WORLD.cx-x)+Math.PI/2,branching=index===2;
        const leafCount=branching?2:3;
        for(let p=0;p<leafCount;p++){
          const sprite=new Sprite(branching?weed:ribbons[p%2]);sprite.anchor.set(.5,.96);sprite.position.set(x+(this.random()-.5)*13,y+(this.random()-.5)*9);
          const rotation=inward+(p-(leafCount-1)/2)*(branching?.23:.18)+(this.random()-.5)*.18;
          sprite.rotation=rotation;sprite.scale.set(branching?.25+this.random()*.1:.30+this.random()*.12,.17+this.random()*.075);
          const opacity=.16+this.random()*.075;sprite.alpha=opacity;sprite.tint=0x83a69d;vegetation.addChild(sprite);
          this.plants.push({sprite,rotation,phase:this.random()*tau,sway:branching?.018:.025+this.random()*.01,opacity});
        }
    }
    for(let group=0;group<3;group++){
      const fish:Minnow[]=[];
      for(let i=0;i<8+group*2;i++){
        const rig=new Container(),fin=new Sprite(tail),shape=new Sprite(body);shape.anchor.set(.5);fin.anchor.set(.84,.5);fin.position.set(-25,0);rig.addChild(fin,shape);
        const scale=.22+this.random()*.075;rig.scale.set(scale);rig.alpha=1;this.fishLayer.addChild(rig);
        const animal:EcologyAnimal={id:`lake-minnow-${group}-${i}`,rig,get x(){return rig.position.x;},get y(){return rig.position.y;},get angle(){return rig.rotation;},depth:.65+this.random()*.3,halfLength:38*scale,radius:8*scale,halfHeight:5.5*scale};
        this.animals.push(animal);fish.push({animal,rig,tail:fin,forward:(this.random()-.5)*100,lateral:(this.random()-.5)*45,phase:this.random()*tau});
      }
      this.shoals.push({fish,angle:.4+group*2.03,radius:.49+group*.08,phase:this.random()*tau,pace:.007+group*.0013,spread:group%2?-1:1});
    }
    // Pool a few bubbles; texture and geometry allocation never happen in update.
    for(let i=0;i<6;i++){const sprite=new Sprite(bubble);sprite.anchor.set(.5);sprite.visible=false;this.bubbleLayer.addChild(sprite);this.bubbles.push({sprite,age:99,life:5,x:0,y:0,phase:this.random()*tau});}
    this.update(0,0,1);
  }

  /** Stable proxies keep world positions current even after their rigs are reparented. */
  getAnimals():EcologyAnimal[] {return this.animals;}

  update(time:number,dt:number,daylight:number):void {
    const light=.65+.35*Math.max(0,Math.min(1,daylight));
    for(const plant of this.plants){plant.sprite.rotation=plant.rotation+Math.sin(time*.65+plant.phase)*plant.sway+Math.sin(time*.29+plant.phase*2)*plant.sway*.4;plant.sprite.alpha=plant.opacity*light;}
    for(const shoal of this.shoals){
      const a=shoal.angle+time*shoal.pace*shoal.spread,r=shoal.radius+Math.sin(time*.027+shoal.phase)*.035;
      const cx=WORLD.cx+Math.cos(a)*WORLD.rx*r,cy=WORLD.cy+Math.sin(a)*WORLD.ry*r;
      const heading=Math.atan2(Math.cos(a)*WORLD.ry*shoal.spread,-Math.sin(a)*WORLD.rx*shoal.spread)+Math.sin(time*.07+shoal.phase)*.12,dx=Math.cos(heading),dy=Math.sin(heading);
      for(const fish of shoal.fish){
        const forward=fish.forward+Math.sin(time*.44+fish.phase)*9,lateral=fish.lateral+Math.sin(time*.29+fish.phase)*6;
        const point=clampPond(cx+dx*forward-dy*lateral,cy+dy*forward+dx*lateral,.82);fish.rig.position.set(point.x,point.y);fish.rig.rotation=heading+Math.sin(time*.63+fish.phase)*.09;fish.rig.alpha=1;
        // Fully opaque bodies absorb warm light with depth instead of exposing
        // animals below them. Only the painted fin and tail edges transmit light.
        const depth=(fish.animal.depth-.65)/.3,shade=.70+light*.3;
        fish.rig.tint=(Math.round((201-depth*25)*shade)<<16)|(Math.round((226-depth*15)*shade)<<8)|Math.round((223-depth*9)*shade);
        fish.tail.rotation=Math.sin(time*6.5+fish.phase)*.24;
      }
    }
    separateAnimals(this.animals);
    this.bubbleClock-=Math.max(0,dt);
    if(this.bubbleClock<=0){
      this.bubbleClock=3.8+this.random()*5.4;const free=this.bubbles.find(b=>b.age>=b.life);
      if(free){const bed=this.beds[Math.floor(this.random()*this.beds.length)];free.x=bed.x-12+this.random()*24;free.y=bed.y-10+this.random()*20;free.age=0;free.life=4+this.random()*2;free.sprite.scale.set(.16+this.random()*.18);free.sprite.visible=true;}
    }
    for(const bubble of this.bubbles){
      bubble.age+=Math.max(0,dt);if(bubble.age>=bubble.life){bubble.sprite.visible=false;continue;}
      const progress=bubble.age/bubble.life,point=clampPond(bubble.x+Math.sin(time*.7+bubble.phase)*3,bubble.y-progress*24,.95);bubble.sprite.position.set(point.x,point.y);
      bubble.sprite.alpha=Math.sin(progress*Math.PI)*.3*light;
    }
  }

  destroy():void {
    for(const animal of this.animals)if(!animal.rig.destroyed)animal.rig.destroy({children:true});
    this.container.destroy({children:true});for(const texture of this.textures)texture.destroy(true);
    this.textures=[];this.plants=[];this.shoals=[];this.animals=[];this.bubbles=[];this.beds=[];
  }
}
