import { Container, Sprite, Texture } from 'pixi.js';
import type { CollisionVolume } from './collision';
import { animalZIndex } from './animal-visibility';
import type { PondQuality } from './pond-performance';
import { LakeFaunaSimulation, type FaunaBody, type FaunaLight, type LakeFaunaEnvironment, type FaunaWaterImpact } from './lake-fauna-state';

export type { FaunaWaterImpact, LakeFaunaEnvironment, FaunaLight } from './lake-fauna-state';
export interface LakeFaunaAnimal extends CollisionVolume {rig:Container;kind:'shrimp'|'snail'}
interface FaunaView {body:FaunaBody;rig:Container;shadow:Sprite;parts:Sprite[]}
const TAU=Math.PI*2;
function canvas(width:number,height:number,paint:(c:CanvasRenderingContext2D)=>void):Texture {
  const surface=document.createElement('canvas');surface.width=width;surface.height=height;
  const c=surface.getContext('2d');if(!c)throw new Error('无法创建小湖生物纹理');paint(c);return Texture.from(surface);
}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,rotation=0):void{c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,TAU);}
function grain(c:CanvasRenderingContext2D,outline:Path2D,width:number,height:number,amount:number):void {
  c.save();c.clip(outline);
  for(let i=0;i<amount;i++){const x=((i*67.31)%width),y=((i*39.17)%height);c.fillStyle=i%3?'rgba(37,48,27,.10)':'rgba(230,223,172,.13)';c.fillRect(x,y,.6+i%2*.35,.6);}
  c.restore();
}
function shrimpBody():Texture {
  return canvas(160,88,c=>{
    const outline=new Path2D();outline.moveTo(112,44);outline.bezierCurveTo(117,34,105,27,92,30);outline.bezierCurveTo(75,29,46,32,30,40);outline.quadraticCurveTo(18,46,31,50);outline.bezierCurveTo(52,57,73,57,92,52);outline.quadraticCurveTo(108,55,112,44);outline.closePath();
    const flesh=c.createLinearGradient(0,27,0,57);flesh.addColorStop(0,'#506452');flesh.addColorStop(.25,'#b2ba92');flesh.addColorStop(.5,'#c4c5a3');flesh.addColorStop(.78,'#87957c');flesh.addColorStop(1,'#425b4b');
    c.fillStyle=flesh;c.fill(outline);grain(c,outline,160,88,680);
    c.strokeStyle='rgba(48,71,49,.6)';c.lineWidth=.9;
    for(const [x,rx] of [[38,5],[49,6],[61,6],[73,7],[86,7]]){c.beginPath();c.ellipse(x,44,rx,10,0,-1.35,1.35);c.stroke();c.strokeStyle='rgba(221,225,181,.33)';c.beginPath();c.ellipse(x+.9,43.5,rx,9,0,-1.35,1.35);c.stroke();c.strokeStyle='rgba(48,71,49,.6)';}
    c.strokeStyle='#546c52';c.lineWidth=1;c.beginPath();c.moveTo(96,31);c.quadraticCurveTo(85,43,99,53);c.stroke();
    c.fillStyle='#243b31';for(const side of [-1,1]){ellipse(c,110,44+side*7,2.3,2);c.fill();c.fillStyle='#bdc6a0';ellipse(c,110.5,43.5+side*7,.6,.6);c.fill();c.fillStyle='#243b31';}
    // Rostrum and fine, curved antennae sit ahead of the cephalothorax.
    c.strokeStyle='rgba(96,110,70,.86)';c.lineWidth=.7;
    c.beginPath();c.moveTo(112,43);c.lineTo(127,41);c.stroke();
    for(const side of [-1,1]){c.beginPath();c.moveTo(115,44+side*3);c.bezierCurveTo(130,44+side*9,143,44+side*23,150,44+side*14);c.stroke();c.beginPath();c.moveTo(112,44+side*4);c.quadraticCurveTo(138,44+side*3,151,44+side*7);c.stroke();}
    c.strokeStyle='rgba(217,221,172,.35)';c.beginPath();c.moveTo(41,39);c.quadraticCurveTo(76,32,101,38);c.stroke();
  });
}
function shrimpTail():Texture {
  return canvas(52,56,c=>{
    c.translate(36,28);
    for(const [rotation,color] of [[-.4,'#728d77'],[0,'#95a887'],[.4,'#69816c']] as const){c.save();c.rotate(rotation);const path=new Path2D();path.moveTo(0,0);path.bezierCurveTo(-7,-8,-22,-9,-26,-4);path.quadraticCurveTo(-27,3,-21,5);path.quadraticCurveTo(-8,6,0,0);c.fillStyle=color;c.fill(path);c.strokeStyle='rgba(186,203,169,.5)';c.lineWidth=.6;c.stroke(path);c.restore();}
  });
}
function shrimpLimbs():Texture {
  return canvas(140,72,c=>{
    c.strokeStyle='rgba(87,110,81,.72)';c.lineWidth=1;
    for(const side of [-1,1])for(let i=0;i<5;i++){c.beginPath();c.moveTo(48+i*9,36+side*6);c.lineTo(44+i*9,36+side*(14+i%2*2));c.lineTo(36+i*10,36+side*(23+i%2*2));c.stroke();}
    c.lineWidth=.7;c.strokeStyle='rgba(183,196,145,.55)';for(const side of [-1,1]){c.beginPath();c.moveTo(97,36+side*6);c.lineTo(108,36+side*18);c.lineTo(123,36+side*14);c.stroke();}
  });
}
function snailBody():Texture {
  return canvas(128,96,c=>{
    const foot=c.createLinearGradient(0,37,0,65);foot.addColorStop(0,'#82765b');foot.addColorStop(.5,'#c4b491');foot.addColorStop(1,'#59644c');c.fillStyle=foot;
    c.beginPath();c.moveTo(104,48);c.quadraticCurveTo(111,36,90,34);c.bezierCurveTo(66,34,49,35,28,46);c.quadraticCurveTo(40,65,81,62);c.quadraticCurveTo(111,64,104,48);c.fill();
    for(const side of [-1,1]){c.strokeStyle='#827757';c.lineWidth=1.7;c.beginPath();c.moveTo(99,48+side*8);c.quadraticCurveTo(113,48+side*13,120,48+side*17);c.stroke();c.fillStyle='#2c3825';ellipse(c,118,48+side*16,1.2,1.1);c.fill();}
    const shell=new Path2D();shell.ellipse(58,46,31,29,-.16,0,TAU);
    const g=c.createRadialGradient(48,34,2,61,48,35);g.addColorStop(0,'#aa9870');g.addColorStop(.3,'#96805b');g.addColorStop(.62,'#685e42');g.addColorStop(.88,'#413e2b');g.addColorStop(1,'#2d3526');c.fillStyle=g;c.fill(shell);grain(c,shell,128,96,420);
    c.save();c.clip(shell);
    c.lineWidth=1.45;c.strokeStyle='rgba(35,38,26,.73)';c.beginPath();for(let i=0;i<=140;i++){const a=i/140*TAU*2.6,r=1+i/140*26,x=56+Math.cos(a)*r,y=45+Math.sin(a)*r*.86;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
    c.strokeStyle='rgba(198,175,115,.55)';c.lineWidth=.7;c.beginPath();for(let i=0;i<=140;i++){const a=i/140*TAU*2.6,r=2+i/140*26,x=55.2+Math.cos(a)*r,y=44.2+Math.sin(a)*r*.86;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
    for(let i=0;i<37;i++){const a=i/37*TAU;c.strokeStyle='rgba(224,200,139,.17)';c.lineWidth=.65;c.beginPath();c.moveTo(58+Math.cos(a)*23,46+Math.sin(a)*22);c.lineTo(58+Math.cos(a+.07)*31,46+Math.sin(a+.07)*29);c.stroke();}c.restore();
  });
}
function frogBody():Texture {
  return canvas(176,140,c=>{
    // Bent hind thighs, long shins and small splayed toes have their own shadow.
    for(const side of [-1,1]){
      const thigh=c.createLinearGradient(45,45,60,103);thigh.addColorStop(0,'#6b7b46');thigh.addColorStop(.4,'#95a067');thigh.addColorStop(1,'#445938');c.fillStyle=thigh;
      ellipse(c,57,70+side*25,27,15,side*.4);c.fill();
      c.strokeStyle='#556c42';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(44,70+side*32);c.lineTo(20,70+side*40);c.lineTo(24,70+side*19);c.stroke();
      c.lineWidth=1.5;for(let i=0;i<3;i++){c.beginPath();c.moveTo(24,70+side*19);c.lineTo(11+i*7,70+side*(9+i*3));c.stroke();}
      c.lineWidth=4;c.beginPath();c.moveTo(119,70+side*14);c.lineTo(135,70+side*32);c.lineTo(153,70+side*27);c.stroke();c.lineWidth=1.3;for(let i=0;i<3;i++){c.beginPath();c.moveTo(153,70+side*27);c.lineTo(161+i*3,70+side*(22+i*5));c.stroke();}
    }
    const outline=new Path2D();outline.moveTo(153,70);outline.bezierCurveTo(153,49,129,42,104,47);outline.bezierCurveTo(90,37,58,43,46,61);outline.quadraticCurveTo(41,70,47,81);outline.bezierCurveTo(61,98,94,101,107,92);outline.bezierCurveTo(133,98,153,90,153,70);outline.closePath();
    const g=c.createLinearGradient(45,41,130,96);g.addColorStop(0,'#526a3b');g.addColorStop(.36,'#8f9b57');g.addColorStop(.55,'#a0a566');g.addColorStop(1,'#40583a');c.fillStyle=g;c.fill(outline);grain(c,outline,176,140,1200);
    c.save();c.clip(outline);for(let i=0;i<65;i++){const x=50+(i*23.37)%100,y=44+(i*17.49)%52;c.fillStyle=i%3?'rgba(40,56,29,.38)':'rgba(159,151,86,.38)';ellipse(c,x,y,1.2+(i%4)*.6,1.1+(i%3)*.4,.3);c.fill();}
    c.lineWidth=2.4;c.strokeStyle='rgba(177,176,113,.62)';for(const side of [-1,1]){c.beginPath();c.moveTo(57,70+side*17);c.bezierCurveTo(81,70+side*20,107,70+side*17,134,70+side*13);c.stroke();}c.restore();
    for(const side of [-1,1]){const eye=c.createRadialGradient(137,70+side*17,1,135,70+side*17,7);eye.addColorStop(0,'#ccb770');eye.addColorStop(.6,'#b7ad64');eye.addColorStop(1,'#495c30');c.fillStyle=eye;ellipse(c,136,70+side*17,7,5);c.fill();c.fillStyle='#17241e';ellipse(c,137,70+side*17,3.3,2);c.fill();c.fillStyle='#ece6bb';ellipse(c,138,69.3+side*17,.8,.6);c.fill();}
    c.lineWidth=.8;c.strokeStyle='rgba(36,53,29,.67)';c.beginPath();c.moveTo(149,63);c.quadraticCurveTo(152,70,149,77);c.stroke();
  });
}
function dragonflyBody():Texture {
  return canvas(144,50,c=>{
    const abdomen=c.createLinearGradient(0,17,0,32);abdomen.addColorStop(0,'#405c4e');abdomen.addColorStop(.45,'#8bafab');abdomen.addColorStop(.7,'#609390');abdomen.addColorStop(1,'#355a52');c.fillStyle=abdomen;
    c.beginPath();c.moveTo(21,25);c.lineTo(75,19);c.quadraticCurveTo(94,15,105,22);c.lineTo(107,28);c.quadraticCurveTo(93,33,77,30);c.lineTo(21,27);c.closePath();c.fill();
    c.strokeStyle='#28443a';c.lineWidth=1.2;for(let i=0;i<9;i++){c.beginPath();c.moveTo(28+i*7,25-(i+1)*.45);c.lineTo(28+i*7,27+(i+1)*.35);c.stroke();}
    c.fillStyle='#596d3d';ellipse(c,98,25,11,8);c.fill();
    for(const side of [-1,1]){c.fillStyle='#798c50';ellipse(c,116,25+side*5,7.3,5.5);c.fill();c.fillStyle='rgba(186,193,119,.63)';ellipse(c,117,24+side*5,3.7,2.3);c.fill();}
    c.strokeStyle='#384b31';c.lineWidth=1;for(const side of [-1,1])for(let i=0;i<3;i++){c.beginPath();c.moveTo(92+i*5,25+side*4);c.lineTo(86+i*5,25+side*10);c.lineTo(102+i*3,25+side*12);c.stroke();}
  });
}
function dragonflyWing():Texture {
  return canvas(150,176,c=>{
    for(const side of [-1,1])for(const [x,width,reach] of [[84,10,70],[99,8,62]]){
      const wing=new Path2D();wing.moveTo(x,88);wing.bezierCurveTo(x-width*1.8,88+side*25,x-width*1.9,88+side*reach,x-5,88+side*(reach+2));wing.bezierCurveTo(x+width,88+side*(reach+2),x+width*.7,88+side*20,x,88);wing.closePath();
      const g=c.createLinearGradient(x,88,x,88+side*reach);g.addColorStop(0,'rgba(224,224,185,.47)');g.addColorStop(.55,'rgba(232,235,216,.32)');g.addColorStop(1,'rgba(226,229,209,.44)');c.fillStyle=g;c.fill(wing);
      c.save();c.clip(wing);c.strokeStyle='rgba(75,89,57,.49)';c.lineWidth=.55;c.beginPath();c.moveTo(x,88);c.lineTo(x-3,88+side*(reach+2));c.stroke();
      for(let i=0;i<15;i++){const y=88+side*(6+i*4.1);c.beginPath();c.moveTo(x-14,y+side*4);c.lineTo(x+8,y-side*3);c.stroke();}c.strokeStyle='rgba(133,143,113,.48)';c.lineWidth=.4;for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(x+i*4,88);c.lineTo(x+i*3,88+side*reach);c.stroke();}
      c.fillStyle='rgba(85,64,29,.8)';c.fillRect(x-5,88+side*(reach-11),7,2);c.restore();
    }
  });
}
function shadowTexture():Texture{return canvas(128,80,c=>{const g=c.createRadialGradient(64,40,4,64,40,55);g.addColorStop(0,'rgba(13,40,29,.45)');g.addColorStop(.5,'rgba(20,43,31,.19)');g.addColorStop(1,'rgba(20,43,31,0)');c.fillStyle=g;c.fillRect(0,0,128,80);});}

/** Underwater rigs can be reparented into the common opaque depth-sorted layer. */
export class LakeFauna {
  readonly underwater=new Container();
  readonly shore=new Container();
  readonly simulation:LakeFaunaSimulation;
  private textures:Texture[]=[];
  private views:FaunaView[]=[];
  private animals:LakeFaunaAnimal[]=[];
  private quality:PondQuality='balanced';
  private destroyed=false;
  constructor(random:()=>number=Math.random){
    this.simulation=new LakeFaunaSimulation(random);this.underwater.label='lake-fauna-underwater';this.shore.label='lake-fauna-shore';
    for(const layer of [this.underwater,this.shore]){layer.eventMode='none';layer.interactiveChildren=false;}
    const shrimp=shrimpBody(),tail=shrimpTail(),limbs=shrimpLimbs(),snail=snailBody(),frog=frogBody(),dragon=dragonflyBody(),wing=dragonflyWing(),shade=shadowTexture();this.textures.push(shrimp,tail,limbs,snail,frog,dragon,wing,shade);
    for(const body of this.simulation.bodies){
      const rig=new Container(),shadow=new Sprite(shade),parts:Sprite[]=[];shadow.anchor.set(.5);rig.label=body.id;
      if(body.kind==='shrimp'){
        const legs=new Sprite(limbs),fan=new Sprite(tail),shell=new Sprite(shrimp);for(const s of [legs,fan,shell])s.anchor.set(.5);
        legs.position.set(-8,-8);fan.pivot.set(10,0);fan.position.set(-51,0);rig.addChild(legs,fan,shell);parts.push(legs,fan);rig.scale.set(.43);shadow.scale.set(.31,.2);
      }else if(body.kind==='snail'){
        const shell=new Sprite(snail);shell.anchor.set(.5);rig.addChild(shell);rig.scale.set(.37);shadow.scale.set(.24,.19);
      }else if(body.kind==='frog'){
        const skin=new Sprite(frog);skin.anchor.set(.5);rig.addChild(skin);rig.scale.set(.43);shadow.scale.set(.49,.36);
      }else{
        const wings=new Sprite(wing),torso=new Sprite(dragon);wings.anchor.set(.5);torso.anchor.set(.5);wings.position.set(3,0);rig.addChild(wings,torso);parts.push(wings);rig.scale.set(.41);shadow.scale.set(.35,.23);
      }
      const layer=body.kind==='shrimp'||body.kind==='snail'?this.underwater:this.shore;layer.addChild(shadow,rig);this.views.push({body,rig,shadow,parts});
      if(body.kind==='shrimp'||body.kind==='snail'){
        const proxy:LakeFaunaAnimal={id:body.id,rig,kind:body.kind,get x(){return body.x;},get y(){return body.y;},get angle(){return body.angle;},get depth(){return body.depth;},get halfLength(){return body.halfLength;},get radius(){return body.radius;},get halfHeight(){return body.halfHeight;}};this.animals.push(proxy);
      }
    }
    this.render({daylight:1});
  }
  static create(random?:()=>number):LakeFauna {return new LakeFauna(random);}
  getAnimals():readonly LakeFaunaAnimal[]{return this.animals;}
  setQuality(quality:PondQuality|number):void{this.quality=typeof quality==='number'?(quality<.55?'economy':quality>.85?'fine':'balanced'):quality;}
  disturbWater(x:number,y:number):number{return this.simulation.disturbWater(x,y);}
  update(dt:number,environment:LakeFaunaEnvironment,lighting:FaunaLight,obstacles:readonly CollisionVolume[]=[]):FaunaWaterImpact[]{
    if(this.destroyed)return [];
    const impacts=this.simulation.update(dt,environment,lighting,obstacles);this.render(lighting);return impacts;
  }
  private render(light:FaunaLight):void {
    const daylight=Math.max(0,Math.min(1,light.daylight)),shade=.72+daylight*.28;
    for(const [index,view] of this.views.entries()){
      const {body,rig,shadow,parts}=view,underwater=body.kind==='shrimp'||body.kind==='snail';
      const enabled=body.kind!=='dragonfly'||this.quality!=='economy'||index===this.views.findIndex(v=>v.body.kind==='dragonfly');
      rig.visible=enabled&&body.visibility>.005;shadow.visible=rig.visible;rig.alpha=underwater?1:body.visibility;
      rig.position.set(body.x,body.y-body.altitude);rig.rotation=body.angle;rig.zIndex=animalZIndex(body.depth);
      const red=Math.min(255,Math.round((underwater?220:255)*shade)),green=Math.min(255,Math.round((underwater?237:255)*shade)),blue=Math.min(255,Math.round((underwater?222:245)*shade));rig.tint=(red<<16)|(green<<8)|blue;
      const offset=underwater?7+body.depth*8:2+body.altitude*.23;shadow.position.set(body.x+offset,body.y+offset*.7);shadow.rotation=body.angle;shadow.alpha=(underwater?.32:.42)*body.visibility*(1-body.altitude*.013);
      if(body.kind==='shrimp'){parts[0].rotation=Math.sin(body.phase)*.035;parts[1].rotation=Math.sin(body.phase*.72)*(body.activity==='darting'?.34:.055);}
      else if(body.kind==='frog'){rig.scale.set(.43,.43+Math.sin(body.phase)*.0035);}
      else if(body.kind==='dragonfly'){
        parts[0].scale.y=1-body.wingAmount*(.17+.28*Math.abs(Math.sin(body.phase)));parts[0].rotation=Math.sin(body.phase*.51)*body.wingAmount*.025;
      }
    }
  }
  getStats(){
    const kinds=['shrimp','snail','frog','dragonfly'] as const;
    return {animals:this.animals.length,total:this.views.length,textures:this.textures.length,time:this.simulation.time,visible:Object.fromEntries(kinds.map(kind=>[kind,this.views.filter(v=>v.body.kind===kind&&v.rig.visible).length])),dragonflyActivities:this.simulation.bodies.filter(b=>b.kind==='dragonfly').map(b=>b.activity),quality:this.quality};
  }
  destroy():void {
    if(this.destroyed)return;this.destroyed=true;
    for(const view of this.views){if(!view.rig.destroyed)view.rig.destroy({children:true});if(!view.shadow.destroyed)view.shadow.destroy();}
    this.underwater.destroy({children:true});this.shore.destroy({children:true});for(const texture of this.textures)texture.destroy(true);this.views=[];this.animals=[];this.textures=[];
  }
}
