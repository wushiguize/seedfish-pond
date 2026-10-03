import { Application, Container, Graphics, Sprite, Texture, Text } from 'pixi.js';
import { turtleCanvas, turtleLegCanvas, butterflyCanvas, mistCanvas, snowBankCanvas } from './art';
import { PondSimulation, WORLD, getFishCollisionVolume, type WeatherMode, type FishRecord, type FishKind, type LightingMode, type WeatherReading } from './model';
import { getFishDefinition } from './fish-catalog';
import { WaterSurface } from './water';
import {LakeEnvironment,getLakeSeason,type SeasonMode} from './lake-environment';
import {SeasonalBackgroundLayer} from './season-background';
import {SeasonSurfaceLayer} from './season-surface';
import {SurfaceGesture} from './surface-gesture';
import type {SurfaceInteraction} from './pond-scene-settings';
import { Critters } from './critters';
import { KoiAtlas } from './koi-atlas';
import { LakeEcology } from './ecology';
import { LakeFauna } from './lake-fauna';
import { getLakeClock, getLightingFrame } from './lighting';
import { getWeatherOptics, type WeatherOptics } from './weather-optics';
import { animalZIndex, hitAnimalAt } from './animal-visibility';
import type { CollisionVolume } from './collision';
import { DEFAULT_PERFORMANCE, PondPerformancePolicy, QUALITY_PROFILES, type PondPerformanceSettings, type PerformanceFrame } from './pond-performance';

interface Ripple { x:number; y:number; age:number; strength:number; rain?:boolean }
interface Wake { x:number; y:number; angle:number; age:number; strength:number }
interface FishView { rig:Container; projection:Sprite; shadow:Sprite; label:Text; size:number; wakeClock:number }
interface ButterflyView { rig:Container; wings:Sprite[]; shadow:Sprite }
interface WeatherParticle { x:number; y:number; z:number; seed:number }
const approach=(value:number,target:number,dt:number,speed=1)=>value+(target-value)*(1-Math.exp(-dt*speed));
const particles=(count:number):WeatherParticle[]=>Array.from({length:count},()=>({x:Math.random(),y:Math.random(),z:.18+Math.random()*.82,seed:Math.random()*100}));

function hitCanvasSprite(container:Container,global:{x:number;y:number}):boolean {
  if(container instanceof Sprite){
    const canvas=container.texture.source.resource as HTMLCanvasElement,frame=container.texture.frame;
    const context=canvas?.getContext?.('2d');if(!context)return false;
    const point=container.toLocal(global),x=Math.floor(point.x+container.anchor.x*frame.width+frame.x),y=Math.floor(point.y+container.anchor.y*frame.height+frame.y);
    if(x>=frame.x&&y>=frame.y&&x<frame.x+frame.width&&y<frame.y+frame.height&&context.getImageData(x,y,1,1).data[3]>=96)return true;
  }
  return container.children.some(child=>hitCanvasSprite(child,global));
}

export class PondView {
  app=new Application();
  simulation:PondSimulation;
  private stage=new Container();
  private underwater=new Container();
  private fishLayer=new Container();
  private shadowLayer=new Container();
  private selectedHalo=new Graphics();
  private selectedId:string|null=null;
  private water=new WaterSurface();
  private critters=new Critters();
  private ecology=new LakeEcology();
  private fauna=new LakeFauna();
  private environment=new LakeEnvironment();
  private seasonalBackground!:SeasonalBackgroundLayer;
  private seasonSurface=new SeasonSurfaceLayer();
  private season:SeasonMode='auto';
  private latitude=30;
  private weatherReading:WeatherReading|null=null;
  private interaction:SurfaceInteraction='feed';
  private gesture=new SurfaceGesture();
  private surfaceDetails=new Graphics();
  private summerLights=new Graphics();
  private gestureDisturbances=0;
  private waves=new Graphics();
  private rippleMask=new Graphics();
  private wakesGraphic=new Graphics();
  private foodGraphic=new Graphics();
  private atmosphere=new Graphics();
  private weatherGraphic=new Graphics();
  private fishViews:FishView[]=[];
  private koi!:KoiAtlas;
  private turtle=new Container();
  private turtleLegs:Sprite[]=[];
  private turtleShadow!:Sprite;
  private butterflyViews:ButterflyView[]=[];
  private mists:Sprite[]=[];
  private snowBank!:Sprite;
  private ripples:Ripple[]=[];
  private wakes:Wake[]=[];
  private raindrops=particles(185);
  private snowflakes=particles(115);
  private rainClock=0;
  private rainAmount=0;
  private snowAmount=0;
  private snowCover=0;
  private daylight=1;
  private dark=0;
  private waterEnergy=1;
  private mode:WeatherMode='sunny';
  private night=false;
  private lightingMode:LightingMode='auto';
  private clockReading:WeatherReading|null=null;
  private tint:[number,number,number]=[1,1,1];
  private warmth=0;
  private optics:WeatherOptics=getWeatherOptics('sunny',{spring:1},getLightingFrame('day',12));
  private names=false;
  private scale=1;
  private paused=false;
  private inspecting=false;
  private populationUpdating=false;
  private fps=30;
  private initialized=false;
  private performanceSettings:PondPerformanceSettings={...DEFAULT_PERFORMANCE};
  private performancePolicy=new PondPerformancePolicy(this.performanceSettings,performance.now());
  private performanceFrame:PerformanceFrame={fps:30,quality:'balanced',reason:'normal'};
  private appliedQuality='';
  private cpuMs=0;
  private sampledFrames=0;
  private sampledCpu=0;
  private maxCpu=0;
  private turtleBreathClock=0;
  private atlasClock=1;
  private smoothedCpuMs=0;
  onFeed?:()=>void;
  onFishSelect?:(fish:FishRecord|null)=>void;
  constructor(private host:HTMLElement,records:FishRecord[]) {this.simulation=new PondSimulation(records);}

  async init():Promise<void> {
    await this.app.init({background:'#143f39',antialias:true,resolution:Math.min(window.devicePixelRatio||1,QUALITY_PROFILES[this.performanceSettings.quality].resolution),autoDensity:true,preference:'webgl',resizeTo:this.host});
    this.host.appendChild(this.app.canvas);this.app.canvas.setAttribute('aria-label','互动小湖，点击鱼儿查看信息，点击空水面投食');this.app.canvas.setAttribute('role','img');
    this.app.stage.addChild(this.stage);
    const initialSeason=this.season==='auto'?getLakeSeason(new Date(),this.clockReading,this.latitude):this.season;
    this.environment=new LakeEnvironment(Math.random,{season:this.season,weather:this.mode,latitude:this.latitude,reading:this.weatherReading,calendarReading:this.clockReading});
    this.seasonalBackground=await SeasonalBackgroundLayer.create(initialSeason);
    const backgroundTexture=this.seasonalBackground.sourceTexture;
    this.fishLayer.sortableChildren=true;
    this.underwater.addChild(this.seasonalBackground,this.ecology.container,this.fauna.underwater,this.wakesGraphic,this.shadowLayer,this.fishLayer);this.underwater.filters=[this.water];
    for(const animal of this.ecology.getAnimals()){this.fishLayer.addChild(animal.rig);animal.rig.zIndex=animalZIndex(animal.depth);animal.rig.label=animal.id;}
    for(const animal of this.fauna.getAnimals()){this.fishLayer.addChild(animal.rig);animal.rig.zIndex=animalZIndex(animal.depth);}
    this.stage.addChild(this.underwater);
    this.koi=await KoiAtlas.create(this.simulation.fish.map(body=>body.record.kind));
    this.buildFishViews();
    const turtleTexture=Texture.from(turtleCanvas());
    this.turtleShadow=new Sprite(turtleTexture);this.turtleShadow.anchor.set(.5);this.turtleShadow.tint=0x0b3027;this.turtleShadow.alpha=.16;this.turtleShadow.scale.set(.5);
    const legTexture=Texture.from(turtleLegCanvas());
    for(const [x,y] of [[-20,-21],[19,-23],[-20,21],[19,23]]) {const leg=new Sprite(legTexture);leg.pivot.set(7,20);leg.position.set(x,y);leg.scale.set(.58);this.turtleLegs.push(leg);this.turtle.addChild(leg);}
    const shell=new Sprite(turtleTexture);shell.anchor.set(.5);this.turtle.addChild(shell);this.turtle.scale.set(.5);
    this.turtle.label='pond-turtle';this.shadowLayer.addChild(this.turtleShadow);this.fishLayer.addChild(this.turtle);this.underwater.addChild(this.foodGraphic);
    this.snowBank=new Sprite(Texture.from(snowBankCanvas(backgroundTexture.source.resource as CanvasImageSource)));this.snowBank.width=WORLD.width;this.snowBank.height=WORLD.height;this.snowBank.alpha=0;
    this.rippleMask.ellipse(WORLD.cx,WORLD.cy,WORLD.rx,WORLD.ry).fill(0xffffff);
    this.waves.mask=this.rippleMask;
    this.stage.addChild(this.rippleMask,this.waves,this.surfaceDetails,this.snowBank,this.seasonSurface,this.atmosphere,this.summerLights,this.selectedHalo,this.fauna.shore);
    const mistTexture=Texture.from(mistCanvas());
    for(let i=0;i<3;i++){const mist=new Sprite(mistTexture);mist.anchor.set(.5);mist.width=WORLD.width*(.45+i*.07);mist.height=WORLD.height*.21;mist.alpha=0;this.mists.push(mist);this.stage.addChild(mist);}
    const wingTextures=[Texture.from(butterflyCanvas('left')),Texture.from(butterflyCanvas('right'))],butterflyBody=Texture.from(butterflyCanvas('body'));
    for(let i=0;i<2;i++) {
      const rig=new Container(),shadow=new Sprite(Texture.from(butterflyCanvas()));shadow.anchor.set(.5);shadow.tint=0x16362b;shadow.alpha=.2;shadow.scale.set(.17);this.stage.addChild(shadow);
      const wings=wingTextures.map(texture=>{const wing=new Sprite(texture);wing.anchor.set(.5);rig.addChild(wing);return wing;});
      const body=new Sprite(butterflyBody);body.anchor.set(.5);rig.addChild(body);this.stage.addChild(rig);this.butterflyViews.push({rig,wings,shadow});
    }
    this.app.stage.addChild(this.weatherGraphic);
    this.resize();new ResizeObserver(()=>this.resize()).observe(this.host);
    this.initialized=true;this.refreshPerformance();
    this.app.ticker.add(ticker=>{const start=performance.now();this.refreshPerformance();this.draw(Math.min(.1,ticker.deltaMS/1000));this.cpuMs=performance.now()-start;this.smoothedCpuMs+=(this.cpuMs-this.smoothedCpuMs)*.1;this.sampledFrames++;this.sampledCpu+=this.cpuMs;this.maxCpu=Math.max(this.maxCpu,this.cpuMs);});
    const point=(event:PointerEvent)=>{const rect=this.app.canvas.getBoundingClientRect();return this.stage.toLocal({x:event.clientX-rect.left,y:event.clientY-rect.top});};
    const canInteract=()=>!this.paused&&!this.populationUpdating&&!this.inspecting;
    this.app.canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0||!canInteract())return;
      this.notifyInteraction();this.gesture.begin(event.pointerId,event.clientX,event.clientY);this.app.canvas.setPointerCapture(event.pointerId);
    });
    this.app.canvas.addEventListener('pointermove',event=>{
      if(!canInteract()){this.gesture.cancel();return;}
      if(this.gesture.move(event.pointerId,event.clientX,event.clientY)){const p=point(event);if(this.environment.addDisturbance(p.x,p.y,.55)){this.gestureDisturbances++;this.simulation.interactWater(p.x,p.y,.55);this.seasonSurface.addDisturbance(p.x,p.y,.55);this.fauna.disturbWater(p.x,p.y);}this.notifyInteraction();}
    });
    this.app.canvas.addEventListener('pointerup',event=>{
      const intent=this.gesture.end(event.pointerId,event.clientX,event.clientY);if(this.app.canvas.hasPointerCapture(event.pointerId))this.app.canvas.releasePointerCapture(event.pointerId);
      if(!intent||!canInteract()||intent==='drag')return;
      const {x,y}=point(event),hit=this.pickAnimal(x,y);
      if(hit){const fish=this.simulation.fish.find(body=>body.record.id===hit);if(fish){this.selectFish(hit);this.onFishSelect?.(fish.record);}return;}
      this.selectFish(null);this.onFishSelect?.(null);
      if(this.interaction==='water'){if(this.environment.addDisturbance(x,y,.85)){this.gestureDisturbances++;this.simulation.interactWater(x,y,.85);this.seasonSurface.addDisturbance(x,y,.85);this.fauna.disturbWater(x,y);}return;}
      if(this.simulation.addFood(x,y)){this.environment.addDisturbance(x,y,.4);this.onFeed?.();}
    });
    this.app.canvas.addEventListener('pointercancel',()=>this.gesture.cancel());
    this.app.canvas.addEventListener('lostpointercapture',()=>this.gesture.cancel());
    document.addEventListener('visibilitychange',()=>this.syncPause());
    this.syncPause();
  }
  private pickAnimal(x:number,y:number):string|null {
    const animals:CollisionVolume[]=[...this.simulation.fish.map(getFishCollisionVolume),this.critters.getTurtleCollisionVolume(),...this.ecology.getAnimals(),...this.fauna.getAnimals()];
    animals.sort((a,b)=>a.depth-b.depth||(a.id===b.id?0:a.id<b.id?-1:1));
    // WebGL canvases need a fresh render before copying their current alpha.
    this.koi.render(this.simulation.fish,this.daylight,this.warmth);
    const global=this.stage.toGlobal({x,y});
    for(const animal of animals){
      if(!hitAnimalAt(x,y,animal))continue;
      const index=this.simulation.fish.findIndex(body=>body.record.id===animal.id);
      if(index>=0){const body=this.simulation.fish[index],size=this.fishViews[index].size,dx=x-body.x,dy=y-body.y,cos=Math.cos(body.angle),sin=Math.sin(body.angle);
        if(this.koi.hitTest(index,(dx*cos+dy*sin)/size,(-dx*sin+dy*cos)/size))return animal.id;
      }else{const rig=animal.id==='pond-turtle'?this.turtle:this.ecology.getAnimals().find(item=>item.id===animal.id)?.rig??this.fauna.getAnimals().find(item=>item.id===animal.id)?.rig;if(rig&&hitCanvasSprite(rig,global))return animal.id;}
    }
    return null;
  }
  private buildFishViews():void {
    for(const [i,body] of this.simulation.fish.entries()) {
      const texture=this.koi.textures[i];
      const shadow=new Sprite(texture);shadow.anchor.set(.5);shadow.tint=0x082d25;shadow.alpha=.18;
      const rig=new Container(),projection=new Sprite(texture);projection.anchor.set(.5);rig.addChild(projection);rig.label=body.record.id;
      const label=new Text({text:body.record.name,style:{fontFamily:'Microsoft YaHei, sans-serif',fontSize:18,fill:'#f3edd4',dropShadow:{color:'#123c30',blur:4,distance:1}}});label.anchor.set(.5);label.visible=false;
      const size=getFishDefinition(body.record.kind).size;
      this.shadowLayer.addChild(shadow);this.fishLayer.addChild(rig);this.stage.addChild(label);this.fishViews.push({rig,projection,shadow,label,size,wakeClock:i*.13});
    }
  }
  private resize():void {
    const width=this.host.clientWidth,height=this.host.clientHeight;
    this.scale=Math.max(width/WORLD.width,height/WORLD.height);
    this.stage.pivot.set(WORLD.width/2,WORLD.height/2);this.stage.rotation=0;this.stage.scale.set(this.scale);this.stage.position.set(width/2,height/2);
  }
  setWeather(mode:WeatherMode,reading:WeatherReading|null=null):void {this.mode=mode;this.weatherReading=reading;}
  setSeason(season:SeasonMode,latitude=30):void {this.season=season;this.latitude=latitude;}
  setInteraction(mode:SurfaceInteraction):void {this.interaction=mode;this.gesture.cancel();}
  getEnvironmentStates(){return {...this.environment.state,seasonMode:this.season,interaction:this.interaction,disturbances:this.gestureDisturbances,impacts:this.environment.impacts.map(x=>({...x})),floaters:this.environment.floaters.map(x=>({...x}))};}
  setLighting(mode:LightingMode,reading:WeatherReading|null=null):void {this.lightingMode=mode;this.clockReading=reading;}
  selectFish(id:string|null):void {this.selectedId=id&&this.simulation.fish.some(body=>body.record.id===id)?id:null;}
  getThumbnails():Map<FishKind,string> {this.koi.render();return new Map(this.simulation.fish.map((body,i)=>[body.record.kind,this.koi.thumbnail(i)]));}
  async getCatalogThumbnails(kinds:FishKind[],onThumbnail?:(kind:FishKind,png:string)=>void):Promise<Map<FishKind,string>> {
    return KoiAtlas.catalogThumbnails(kinds,onThumbnail);
  }
  async setFish(records:FishRecord[]):Promise<void> {
    this.populationUpdating=true;this.syncPause();
    try {
      await this.koi.setKinds(records.map(fish=>fish.kind));
      this.fishViews.forEach(({rig,shadow,label})=>{rig.destroy({children:true});shadow.destroy();label.destroy();});this.fishViews=[];
      this.simulation.reconcileFish(records);this.buildFishViews();this.drawFish(0,this.simulation.time);
      if(this.selectedId&&!records.some(fish=>fish.id===this.selectedId)){this.selectFish(null);this.onFishSelect?.(null);}
    } finally {this.populationUpdating=false;this.syncPause();}
  }
  showNames(value:boolean):void {this.names=value;this.fishViews.forEach(view=>view.label.visible=value);}
  setFPS(value:number):void {this.performancePolicy.setHostFPS(value);if(this.initialized)this.refreshPerformance();}
  setPerformance(settings:PondPerformanceSettings):void {this.performanceSettings={...settings};this.performancePolicy.configure(settings,performance.now());if(this.initialized)this.refreshPerformance();}
  notifyInteraction():void {this.performancePolicy.interact(performance.now());if(this.initialized)this.refreshPerformance();}
  getPerformanceStats(){return {...this.performanceFrame,selectedQuality:this.performanceSettings.quality,adaptive:this.performanceSettings.adaptive,paused:this.paused||this.inspecting||this.populationUpdating||document.hidden,frames:this.sampledFrames,meanUpdateMs:this.sampledFrames?this.sampledCpu/this.sampledFrames:0,maxUpdateMs:this.maxCpu,simulationTime:this.simulation.time,ripples:this.ripples.length,wakes:this.wakes.length,fish:this.simulation.fish.length,modelMemory:this.koi?.getMemoryStats(),modelFPS:QUALITY_PROFILES[this.performanceFrame.quality].modelFPS,pixelResolution:this.initialized?this.app.renderer.resolution:0,waterResolution:this.water.resolution};}
  getAnimalStates(){return {turtle:{state:this.critters.turtle.state,depth:this.critters.turtle.depth,x:this.critters.turtle.x,y:this.critters.turtle.y},butterflies:this.critters.butterflies.map(visitor=>({state:visitor.state,altitude:visitor.altitude,wingFold:visitor.wingFold,x:visitor.x,y:visitor.y,perch:visitor.perchIndex}))};}
  getEcologyStats(){return {fauna:this.fauna.getStats(),surface:this.seasonSurface.getStats(),backgroundTextures:this.seasonalBackground?.children.length??0,displayLight:this.daylight,atmosphereAlpha:this.dark,weatherOptics:{...this.optics,tint:[...this.optics.tint]}};}
  private refreshPerformance():void {
    this.performanceFrame=this.performancePolicy.sample(performance.now(),this.smoothedCpuMs);this.fps=this.performanceFrame.fps;this.app.ticker.maxFPS=this.fps;
    const profile=QUALITY_PROFILES[this.performanceFrame.quality];
    if(this.appliedQuality!==this.performanceFrame.quality){
      this.appliedQuality=this.performanceFrame.quality;this.app.renderer.resolution=Math.min(window.devicePixelRatio||1,profile.resolution);this.app.renderer.resize(this.host.clientWidth,this.host.clientHeight);this.water.resolution=profile.waterResolution;
    }
  }
  setPaused(value:boolean):void {this.paused=value;if(value)this.gesture.cancel();this.syncPause();}
  setInspecting(value:boolean):void {this.inspecting=value;this.syncPause();}
  private syncPause():void {if(!this.initialized)return;if(this.paused||this.inspecting||this.populationUpdating||document.hidden)this.app.ticker.stop();else {this.notifyInteraction();this.app.ticker.start();}}

  private draw(dt:number):void {
    this.critters.update(dt,[...this.simulation.fish.map(getFishCollisionVolume),...this.fauna.getAnimals()]);
    this.ecology.update(this.simulation.time+dt,dt,this.daylight);
    const lighting=getLightingFrame(this.lightingMode,getLakeClock(Date.now(),this.clockReading).hour);
    this.night=lighting.night>.65;
    this.environment.setConditions({weather:this.mode,season:this.season,date:new Date(),reading:this.weatherReading,calendarReading:this.clockReading,latitude:this.latitude,daylight:lighting.daylight});
    this.environment.update(dt,QUALITY_PROFILES[this.performanceFrame.quality].particles);
    const environment=this.environment.state;
    this.fauna.setQuality(this.performanceFrame.quality);
    const faunaImpacts=this.fauna.update(dt,environment,lighting,[...this.simulation.fish.map(getFishCollisionVolume),this.critters.getTurtleCollisionVolume(),...this.ecology.getAnimals()]);
    for(const impact of faunaImpacts)this.environment.addDisturbance(impact.x,impact.y,impact.strength);
    this.simulation.setObstacles([this.critters.getTurtleCollisionVolume(),...this.ecology.getAnimals(),...this.fauna.getAnimals()]);
    this.simulation.setEnvironment({season:environment.resolvedSeason,weather:this.mode,rainIntensity:environment.rainIntensity,daylight:lighting.daylight});
    this.simulation.update(dt);const t=this.simulation.time;
    this.seasonalBackground.update(environment.seasonMix);
    this.seasonSurface.setQuality(QUALITY_PROFILES[this.performanceFrame.quality].particles);
    this.seasonSurface.update(dt,environment,this.environment.floaters,this.daylight);
    this.rainAmount=approach(this.rainAmount,this.mode==='rain'?1:0,dt,1.4);
    this.snowAmount=approach(this.snowAmount,this.mode==='snow'?1:0,dt,1.1);
    this.snowCover=approach(this.snowCover,this.mode==='snow'?1:0,dt,.14);this.snowBank.alpha=this.snowCover*.68;
    this.daylight=approach(this.daylight,lighting.daylight,dt,.8);
    const targetOptics=getWeatherOptics(this.mode,environment.seasonMix,lighting);
    for(const field of ['brightness','directSun','daylight','clarity','reflection','contrast','saturation','refraction'] as const)this.optics[field]=approach(this.optics[field],targetOptics[field],dt,.8);
    this.optics.tint=this.optics.tint.map((value,i)=>approach(value,targetOptics.tint[i],dt,.8)) as WeatherOptics['tint'];
    this.warmth=approach(this.warmth,lighting.warmth+(environment.resolvedSeason==='autumn'?.13:environment.resolvedSeason==='spring'?.04:environment.resolvedSeason==='winter'?-.035:0),dt,.8);
    this.tint=this.tint.map((value,i)=>approach(value,this.optics.tint[i]*(1+(environment.tint[i]-1)*.35),dt,.8)) as [number,number,number];
    // Readable winter water and soft overcast light; the calendar's night state
    // still controls animal activity independently of this display exposure.
    const surfaceBrightness=this.optics.brightness;
    const bankColor=this.tint.map(value=>Math.max(0,Math.min(255,Math.round(value*surfaceBrightness*255))));
    this.snowBank.tint=(bankColor[0]<<16)|(bankColor[1]<<8)|bankColor[2];
    this.waterEnergy=approach(this.waterEnergy,environment.waveStrength,dt,.8);
    const shaderImpacts=this.performanceFrame.quality==='economy'?8:this.performanceFrame.quality==='fine'?24:16;
    this.water.setEnvironment(environment.windX*.12,environment.windY*.12,this.optics.clarity,environment.iceFraction,[...this.seasonSurface.getImpacts(),...this.environment.impacts],shaderImpacts);
    this.water.setSeasonOptics(environment.waterColor,environment.causticStrength,environment.bedGreen);
    this.water.setWeatherOptics(this.optics.daylight,this.optics.contrast,this.optics.saturation,this.optics.reflection,this.optics.refraction);
    this.water.update(t,this.waterEnergy,this.optics.directSun,this.tint,surfaceBrightness);
    this.drawFish(dt,t);this.drawVisitors(t,dt);this.drawWater(dt,t);this.drawSurface(t);this.drawWeather(dt,t);
    // A quiet veil floats at water level and changes gradually with the weather.
    const targetDark=lighting.night*.035+(this.mode==='rain'?.015:0);this.dark=approach(this.dark,targetDark,dt,.75);
    this.atmosphere.clear().rect(0,0,WORLD.width,WORLD.height).fill({color:this.mode==='snow'?0x5d7e8a:0x082b2d,alpha:this.dark});
    this.mists.forEach((mist,i)=>{mist.position.set(WORLD.width*(.22+i*.29)+Math.sin(t*.07+i*2)*WORLD.width*.13,WORLD.height*(.33+i*.18)+Math.sin(t*.12+i)*WORLD.height*.04);mist.alpha=approach(mist.alpha,(this.mode==='sunny'?.005:.016)+this.snowAmount*.20+this.rainAmount*.055+(this.night?.055:0),dt,.6);});
    this.fishLayer.sortChildren();
    this.fishLayer.children.sort((a,b)=>a.zIndex-b.zIndex||(a.label===b.label?0:a.label<b.label?1:-1));
  }
  private drawFish(dt:number,t:number):void {
    const interval=1/QUALITY_PROFILES[this.performanceFrame.quality].modelFPS;this.atlasClock+=dt;
    if(dt===0||this.atlasClock>=interval){this.koi.render(this.simulation.fish,this.daylight,this.warmth);this.atlasClock=0;}
    this.simulation.fish.forEach((body,i)=>{
      const view=this.fishViews[i],{rig,projection,shadow,label,size}=view;
      // Body depth belongs to the volume simulation. Solid bodies stay opaque;
      // deeper animals are cooler in color and are drawn below shallow ones.
      const depth=body.depth;
      rig.position.set(body.x,body.y);rig.rotation=body.angle;rig.scale.set(size);rig.alpha=1;rig.zIndex=animalZIndex(depth);
      const red=Math.round(255*Math.exp(-depth*.19)),green=Math.round(255*Math.exp(-depth*.055)),blue=Math.round(255*Math.exp(-depth*.025));
      projection.tint=(red<<16)|(green<<8)|blue;
      const shadowOffset=8+depth*26;shadow.position.set(body.x+shadowOffset,body.y+shadowOffset*.7);shadow.rotation=body.angle;shadow.scale.set(size*(1+depth*.065));shadow.alpha=.13-depth*.075;
      label.text=body.record.name;label.position.set(body.x,body.y-45);label.visible=this.names||body.record.id===this.selectedId;
      view.wakeClock+=dt;if(view.wakeClock>.5 && body.speed>20){view.wakeClock=0;const tailDistance=size*170;this.wakes.push({x:body.x-Math.cos(body.angle)*tailDistance,y:body.y-Math.sin(body.angle)*tailDistance,angle:body.angle,age:0,strength:Math.min(1,body.speed/90)*(1-depth*.7)});}
      if(t-body.lastEatenAt<dt*1.5)this.ripples.push({x:body.x+Math.cos(body.angle)*body.mouthOffset,y:body.y+Math.sin(body.angle)*body.mouthOffset,age:0,strength:.45});
    });
    this.selectedHalo.clear();
    const selected=this.simulation.fish.find(body=>body.record.id===this.selectedId);
    if(selected){const volume=getFishCollisionVolume(selected);this.selectedHalo.position.set(volume.x,volume.y);this.selectedHalo.rotation=selected.angle;this.selectedHalo.ellipse(0,0,volume.halfLength+10,volume.radius+10).stroke({color:0xece2b1,alpha:.55,width:1.4});}
  }
  private drawVisitors(t:number,dt:number):void {
    const turtle=this.critters.turtle;this.turtle.position.set(turtle.x,turtle.y);this.turtle.rotation=turtle.angle;
    const depth=turtle.depth,shade=.78+this.daylight*.22;
    this.turtle.alpha=1;this.turtle.zIndex=animalZIndex(depth);this.turtle.tint=(Math.round((239-depth*63)*shade)<<16)|(Math.round((248-depth*34)*shade)<<8)|Math.round((239-depth*26)*shade);this.turtle.scale.set(.5,.5+Math.sin(turtle.phase)*.008*turtle.paddleAmount);
    this.turtleLegs.forEach((leg,i)=>{const side=i<2?-1:1;leg.rotation=side*Math.PI/2+side*(Math.sin(turtle.phase+(i%2)*2.3)*.42*turtle.paddleAmount-.25);leg.scale.x=.5+.1*Math.sin(turtle.phase+(i%2)*2.3)*turtle.paddleAmount;});
    const offset=8+depth*28;this.turtleShadow.position.set(turtle.x+offset,turtle.y+offset*.7);this.turtleShadow.rotation=turtle.angle;this.turtleShadow.alpha=.15-depth*.11;
    this.turtleBreathClock+=dt;
    if(turtle.state==='breathing'&&this.turtleBreathClock>1.8){this.turtleBreathClock=0;this.ripples.push({x:turtle.x+Math.cos(turtle.angle)*31,y:turtle.y+Math.sin(turtle.angle)*31,age:0,strength:.26+.15*turtle.breathAmount});}
    this.butterflyViews.forEach((view,i)=>{
      const visitor=this.critters.butterflies[i],{rig,wings,shadow}=view;
      const altitude=visitor.altitude,visibility=this.night||this.environment.state.resolvedSeason==='winter'?0:this.environment.state.visitorActivity;
      rig.alpha=approach(rig.alpha,visibility,dt,2);shadow.alpha=rig.alpha*.12;rig.visible=rig.alpha>.005;shadow.visible=rig.visible;
      const x=visitor.x,y=visitor.y;
      rig.position.set(x,y-altitude);rig.rotation=visitor.angle+Math.PI/2+Math.sin(visitor.phase*.16)*.09*visitor.wingMotion;rig.scale.set(.18+altitude*.0012);
      const fold=visitor.wingFold;wings[0].scale.x=fold;wings[1].scale.x=fold;wings[0].rotation=Math.sin(visitor.phase)*.1*visitor.wingMotion;wings[1].rotation=-Math.sin(visitor.phase)*.1*visitor.wingMotion;
      shadow.position.set(x+altitude*.28,y+altitude*.22);shadow.scale.set(.17+altitude*.0005);shadow.rotation=rig.rotation;
    });
  }
  private drawWater(dt:number,t:number):void {
    this.waves.clear();
    for(const ripple of this.ripples) {
      ripple.age+=dt;const life=ripple.rain?1.3:2.6,alpha=Math.max(0,1-ripple.age/life)*.3*ripple.strength,r=4+ripple.age*(ripple.rain?30:48);
      this.waves.ellipse(ripple.x,ripple.y,r,r*.78).stroke({color:0xd2e3c3,width:1.2,alpha});
      if(ripple.age>.2)this.waves.ellipse(ripple.x,ripple.y,r*.67,r*.52).stroke({color:0xd2e3c3,width:.8,alpha:alpha*.55});
      if(ripple.rain&&ripple.age<.18)this.waves.moveTo(ripple.x-2,ripple.y).lineTo(ripple.x,ripple.y-ripple.age*28).lineTo(ripple.x+2,ripple.y).stroke({color:0xe0eed7,width:1,alpha:.19*ripple.strength});
    }
    this.ripples=this.ripples.filter(r=>r.age<(r.rain?1.3:2.6)).slice(-120);
    this.wakesGraphic.clear();
    for(const wake of this.wakes){wake.age+=dt;const length=7+wake.age*15,alpha=(1-wake.age/2.3)*wake.strength*.12,dx=Math.cos(wake.angle),dy=Math.sin(wake.angle);if(alpha<=0)continue;this.wakesGraphic.moveTo(wake.x-dy*length,wake.y+dx*length).quadraticCurveTo(wake.x-dx*7,wake.y-dy*7,wake.x+dy*length,wake.y-dx*length).stroke({color:0xb9dcc0,width:1,alpha});}
    this.wakes=this.wakes.filter(w=>w.age<2.3).slice(-90);
    this.foodGraphic.clear();for(const pellet of this.simulation.food){const bob=Math.sin(t*3+pellet.id)*1.1;this.foodGraphic.circle(pellet.x+2,pellet.y+2,3.2).fill({color:0x122e20,alpha:.3});this.foodGraphic.circle(pellet.x,pellet.y+bob,2.7).fill({color:0xd5ad60,alpha:Math.min(1,(40-pellet.age)/3)});this.foodGraphic.circle(pellet.x-.6,pellet.y-1+bob,.7).fill({color:0xf0d899,alpha:.6});}
  }
  private drawSurface(t:number):void {
    const env=this.environment.state,g=this.surfaceDetails;g.clear();
    for(const impact of [...this.environment.impacts,...this.seasonSurface.getImpacts()]){
      const fade=Math.max(0,1-impact.age/impact.lifetime),r=impact.radius;
      const alpha=fade*impact.strength*(impact.kind==='touch'?.28:.17);
      g.ellipse(impact.x,impact.y,r,r*.78).stroke({color:0xc4e2d7,width:impact.kind==='touch'?1.2:.75,alpha});
      if(impact.age>.2)g.ellipse(impact.x,impact.y,r*.64,r*.5).stroke({color:0x1b5756,width:.65,alpha:alpha*.8});
      if(impact.kind==='rain'&&impact.age<.16){const height=Math.sin(impact.age/.16*Math.PI)*5;g.moveTo(impact.x-2,impact.y).quadraticCurveTo(impact.x,impact.y-height*1.8,impact.x+2,impact.y).stroke({color:0xd5e9e3,width:1,alpha:fade*.32});}
      if(impact.kind==='snow'&&impact.age<.8)g.circle(impact.x,impact.y,1+impact.age*2).fill({color:0xecf3ec,alpha:(1-impact.age/.8)*.35});
    }
    this.summerLights.clear();
    if(env.summerGlow>.005)for(let i=0;i<7;i++){const a=i*2.41+t*.005,r=.79+Math.sin(i*3.1)*.09,x=WORLD.cx+Math.cos(a)*WORLD.rx*r,y=WORLD.cy+Math.sin(a)*WORLD.ry*r+Math.sin(t*.7+i)*4,alpha=env.summerGlow*(.5+Math.sin(t*1.1+i*2.5)*.5);this.summerLights.circle(x,y,8).fill({color:0xdbe9a1,alpha:alpha*.03}).circle(x,y,1.6).fill({color:0xe9ecbd,alpha:alpha*.8});}
  }
  private drawWeather(dt:number,t:number):void {
    const width=this.host.clientWidth,height=this.host.clientHeight,env=this.environment.state,wind=env.windX*.04;
    this.weatherGraphic.clear();
    // The final rain streak, crown splash and refracted ring share a lake point.
    for(const impact of this.environment.impacts)if(impact.kind==='rain'&&impact.age<.10){const p=this.stage.toGlobal({x:impact.x,y:impact.y}),length=(1-impact.age/.1)*26;this.weatherGraphic.moveTo(p.x-wind*length,p.y-length).lineTo(p.x,p.y).stroke({color:0xc2d8dc,width:.8,alpha:env.rainIntensity*.28});}
    const density=QUALITY_PROFILES[this.performanceFrame.quality].particles;
    if(this.rainAmount>.01)for(let i=0;i<Math.ceil(this.raindrops.length*density*.5);i++){const drop=this.raindrops[i];drop.x+=dt*(.015+wind*.02)*drop.z;drop.y+=dt*(.45+drop.z*.4);if(drop.y>1.05){drop.y=-.05;drop.x=Math.random();}if(drop.x>1.1)drop.x=-.1;if(drop.x<-.1)drop.x=1.1;const x=drop.x*width,y=drop.y*height,length=8+drop.z*23;this.weatherGraphic.moveTo(x-wind*length,y-length).lineTo(x,y).stroke({color:0xc2d6db,width:.45+drop.z*.55,alpha:(.035+drop.z*.12)*this.rainAmount});}
    if(this.snowAmount>.01)for(let i=0;i<Math.ceil(this.snowflakes.length*density);i++){const flake=this.snowflakes[i];flake.x+=dt*(.004+wind*.04)*flake.z;flake.y+=dt*(.02+flake.z*.046);if(flake.y>1.03){flake.y=-.03;flake.x=Math.random();}if(flake.x>1.05)flake.x=-.05;if(flake.x<-.05)flake.x=1.05;const x=flake.x*width+Math.sin(t*.7+flake.seed)*10*flake.z,y=flake.y*height;this.weatherGraphic.circle(x,y,.8+flake.z*2.7).fill({color:0xe9f0e6,alpha:(.18+flake.z*.56)*this.snowAmount});if(flake.z>.8)this.weatherGraphic.circle(x,y,5).fill({color:0xe5efea,alpha:.06*this.snowAmount});}
  }
}
