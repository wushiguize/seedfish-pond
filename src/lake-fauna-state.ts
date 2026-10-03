import { WORLD, clampPond, insidePond } from './model';
import { getCollisionContact, type CollisionVolume } from './collision';
import type { LakeSeason } from './lake-environment';

export type LakeFaunaKind='shrimp'|'snail'|'frog'|'dragonfly';
export interface LakeFaunaEnvironment {
  resolvedSeason:LakeSeason;
  rainIntensity:number;
  snowIntensity:number;
  seasonMix?:Partial<Record<LakeSeason,number>>;
}
export interface FaunaLight {daylight:number;tint?:readonly number[]}
export interface FaunaWaterImpact {x:number;y:number;strength:number}
export interface FaunaBody extends CollisionVolume {
  kind:LakeFaunaKind;homeX:number;homeY:number;phase:number;visibility:number;
  activity:'grazing'|'resting'|'darting'|'hovering'|'patrolling'|'returning';
  remaining:number;speed:number;altitude:number;wingAmount:number;disturbed:number;touchRemaining:number;
}

const STEP=1/60,TAU=Math.PI*2;
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const turn=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const approach=(value:number,target:number,dt:number,rate:number)=>value+(target-value)*(1-Math.exp(-dt*rate));
const coastPoint=(angle:number,radius:number)=>({x:WORLD.cx+Math.cos(angle)*WORLD.rx*radius,y:WORLD.cy+Math.sin(angle)*WORLD.ry*radius});
export const FAUNA_LIMITS={shrimp:5,snail:4,frog:2,dragonfly:3,impactsPerTick:3} as const;
export const FAUNA_SHAPES={shrimp:{halfLength:36,radius:16,halfHeight:5},snail:{halfLength:23,radius:16,halfHeight:9}} as const;

/** Small decorative visitors have no ownership, hunger, timers or save data. */
export class LakeFaunaSimulation {
  readonly bodies:FaunaBody[]=[];
  time=0;
  private accumulator=0;
  private impactClock=0;
  constructor(private random:()=>number=Math.random){
    for(let i=0;i<FAUNA_LIMITS.shrimp;i++){
      const angle=[.52,1.98,2.69,3.95,5.6][i],point=coastPoint(angle,.83+i%2*.045);
      this.bodies.push(this.body('shrimp',i,point.x,point.y,angle+Math.PI/2,.79+i*.015,FAUNA_SHAPES.shrimp));
    }
    for(let i=0;i<FAUNA_LIMITS.snail;i++){
      const angle=[.76,2.34,4.18,5.88][i],point=coastPoint(angle,.88);
      this.bodies.push(this.body('snail',i,point.x,point.y,angle+Math.PI,.86+i*.012,FAUNA_SHAPES.snail));
    }
    // Dry stone positions, away from the turtle path and main water area.
    for(const [i,p] of [{x:154,y:1178},{x:2229,y:211}].entries())this.bodies.push(this.body('frog',i,p.x,p.y,i?2.7:-.4,0,{halfLength:30,radius:24,halfHeight:12}));
    for(const [i,p] of [{x:355,y:108},{x:2257,y:750},{x:1740,y:1257}].entries()){
      const b=this.body('dragonfly',i,p.x,p.y,i*2.1,0,{halfLength:32,radius:28,halfHeight:4});
      b.activity=i===0?'hovering':'resting';b.remaining=i===0?6:6+i*4;b.altitude=i===0?25:0;
      b.visibility=0;this.bodies.push(b);
    }
  }
  private body(kind:LakeFaunaKind,index:number,x:number,y:number,angle:number,depth:number,shape:{halfLength:number;radius:number;halfHeight:number}):FaunaBody {
    return {id:`lake-${kind}-${index}`,kind,x,y,homeX:x,homeY:y,angle,depth,...shape,phase:this.random()*TAU,visibility:1,activity:kind==='shrimp'||kind==='snail'?'grazing':'resting',remaining:8+index*3,speed:0,altitude:0,wingAmount:0,disturbed:0,touchRemaining:0};
  }
  getAnimals():FaunaBody[]{return this.bodies.filter(b=>b.kind==='shrimp'||b.kind==='snail');}
  disturbWater(x:number,y:number):number {
    if(!Number.isFinite(x)||!Number.isFinite(y))return 0;
    let affected=0;
    for(const b of this.bodies)if(b.kind==='shrimp'&&Math.hypot(x-b.x,y-b.y)<190){
      b.disturbed=1.25;b.activity='darting';b.angle=Math.atan2(b.y-y,b.x-x);affected++;
    }
    for(const b of this.bodies)if(b.kind==='dragonfly'&&b.visibility>.05&&Math.hypot(x-b.x,y-b.y)<160){b.activity='returning';b.remaining=2.5;}
    return affected;
  }
  update(dt:number,env:LakeFaunaEnvironment,light:FaunaLight,obstacles:readonly CollisionVolume[]=[]):FaunaWaterImpact[] {
    const impacts:FaunaWaterImpact[]=[];
    if(!Number.isFinite(dt)||dt<=0)return impacts;
    this.accumulator+=Math.min(dt,.25);
    while(this.accumulator+1e-10>=STEP){this.accumulator-=STEP;this.step(STEP,env,light,obstacles,impacts);}
    return impacts.slice(-FAUNA_LIMITS.impactsPerTick);
  }
  private step(dt:number,env:LakeFaunaEnvironment,light:FaunaLight,obstacles:readonly CollisionVolume[],impacts:FaunaWaterImpact[]):void {
    this.time+=dt;this.impactClock+=dt;
    const winter=env.seasonMix?.winter??(env.resolvedSeason==='winter'?1:0),summer=env.seasonMix?.summer??(env.resolvedSeason==='summer'?1:0);
    const insectActivity=summer*clamp((light.daylight-.3)/.3)*(1-clamp(env.rainIntensity*3))*(1-clamp(env.snowIntensity*4));
    for(const [index,b] of this.bodies.entries()){
      b.phase+=dt*(b.kind==='dragonfly'?45:b.kind==='shrimp'?4:.7);b.remaining-=dt;
      if(b.kind==='shrimp'||b.kind==='snail'){
        b.disturbed=Math.max(0,b.disturbed-dt);
        if(b.disturbed>0){b.activity='darting';b.speed=approach(b.speed,42,dt,7);}
        else{
          if(b.remaining<=0){b.activity=b.activity==='resting'?'grazing':'resting';b.remaining=(b.kind==='snail'?16:7)+this.random()*15;}
          const desired=b.activity==='resting'?0:b.kind==='snail'?.65:2.2;
          b.speed=approach(b.speed,desired*(1-winter*.72),dt,3);
          const heading=Math.atan2(b.homeY-b.y,b.homeX-b.x)+Math.sin(this.time*.12+index)*1.1;
          if(Math.hypot(b.x-b.homeX,b.y-b.homeY)>30)b.angle+=clamp(turn(heading-b.angle),-.55*dt,.55*dt);
          else b.angle+=Math.sin(this.time*.11+index)*dt*.055;
        }
        b.x+=Math.cos(b.angle)*b.speed*dt;b.y+=Math.sin(b.angle)*b.speed*dt;
        const p=clampPond(b.x,b.y,.92);b.x=p.x;b.y=p.y;
        this.separate(b,obstacles);
        // Bodies remain solid. Winter changes pace, never their opacity.
        b.visibility=1;
      }else if(b.kind==='frog'){
        const target=(1-winter)*(.74+.26*clamp(light.daylight));b.visibility=approach(b.visibility,target,dt,1.5);
        b.speed=0;b.activity='resting';b.angle+=Math.sin(this.time*.065+index)*dt*.005;
      }else{
        b.visibility=approach(b.visibility,insectActivity,dt,2);
        if(insectActivity<.08){
          b.activity='returning';b.touchRemaining=0;this.returnToPerch(b,dt);
        }else{
          if(b.remaining<=0){
            if(b.activity==='resting'){b.activity='hovering';b.remaining=7+this.random()*6;}
            else if(b.activity==='hovering'){b.activity='patrolling';b.remaining=11+this.random()*8;}
            else if(b.activity==='patrolling'){b.activity='returning';b.remaining=4;}
            else{b.activity='resting';b.remaining=8+this.random()*12;}
          }
          if(b.activity==='returning')this.returnToPerch(b,dt);
          else if(b.activity==='resting'){b.altitude=approach(b.altitude,0,dt,3);b.x=approach(b.x,b.homeX,dt,3);b.y=approach(b.y,b.homeY,dt,3);b.speed=0;}
          else{
            const centre=clampPond(b.homeX,b.homeY,.78),patrol=b.activity==='patrolling';
            const period=this.time*(patrol?.34:.2)+index*.9;
            const tx=centre.x+Math.cos(period)*(patrol?75:9),ty=centre.y+Math.sin(period)*(patrol?40:6);
            const previousX=b.x,previousY=b.y;b.x=approach(b.x,tx,dt,patrol?1.2:2);b.y=approach(b.y,ty,dt,patrol?1.2:2);
            b.angle+=turn(Math.atan2(ty-b.y,tx-b.x)-b.angle)*(1-Math.exp(-dt*4));
            b.altitude=approach(b.altitude,25+Math.sin(this.time*1.8+index)*3,dt,2);b.speed=Math.hypot(b.x-previousX,b.y-previousY)/dt;
            // At most one brief surface touch per 14 seconds, shared by all three.
            // The visible abdomen really descends before the small ring appears.
            if(patrol&&b.touchRemaining===0&&this.impactClock>=14&&insidePond(b.x,b.y,.87)){this.impactClock=0;b.touchRemaining=.8;}
            if(b.touchRemaining>0){
              const previous=b.touchRemaining;b.touchRemaining=Math.max(0,previous-dt);
              const progress=1-b.touchRemaining/.8;
              b.altitude=25*Math.cos(progress*Math.PI)**2;
              if(previous>.4&&b.touchRemaining<=.4)impacts.push({x:b.x,y:b.y,strength:.17});
            }
          }
        }
        b.wingAmount=approach(b.wingAmount,b.activity==='resting'?0:1,dt,5);
      }
    }
  }
  private returnToPerch(b:FaunaBody,dt:number):void {
    const previousX=b.x,previousY=b.y;
    b.x=approach(b.x,b.homeX,dt,1.9);b.y=approach(b.y,b.homeY,dt,1.9);b.altitude=approach(b.altitude,0,dt,1.5);
    b.speed=Math.hypot(b.x-previousX,b.y-previousY)/dt;
    b.angle+=turn(Math.atan2(b.homeY-b.y,b.homeX-b.x)-b.angle)*(1-Math.exp(-dt*4));
  }
  private separate(body:FaunaBody,obstacles:readonly CollisionVolume[]):void {
    const others=[...obstacles,...this.bodies.filter(b=>b!==body&&(b.kind==='shrimp'||b.kind==='snail'))];
    for(let pass=0;pass<12;pass++){
      let corrected=false;
      for(const obstacle of others){
        if(obstacle.id===body.id)continue;
        const contact=getCollisionContact(body,obstacle);if(!contact)continue;
        body.x+=contact.nx*(contact.penetration+.04);body.y+=contact.ny*(contact.penetration+.04);corrected=true;
      }
      const p=clampPond(body.x,body.y,.93);body.x=p.x;body.y=p.y;
      if(!corrected)return;
    }
    if(!others.some(b=>b.id!==body.id&&getCollisionContact(body,b)) )return;
    // Rare crowded-boundary fallback, bounded and deterministic.
    for(let radius=12;radius<=180;radius+=12)for(let sample=0;sample<16;sample++){
      const angle=sample*TAU/16,candidate={...body,x:body.x+Math.cos(angle)*radius,y:body.y+Math.sin(angle)*radius};
      if(!insidePond(candidate.x,candidate.y,.93)||others.some(b=>b.id!==body.id&&getCollisionContact(candidate,b)))continue;
      body.x=candidate.x;body.y=candidate.y;return;
    }
  }
}
