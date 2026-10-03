import { getFishDefinition, type FishMorphology } from './fish-catalog';
import { FISH_PERSONALITIES, getFishPersonality, type FishPersonality } from './fish-personality';
import type { FishKind, FishRecord, WeatherMode } from './model';

export type FishActivity='patrol'|'rest'|'explore'|'burst'|'shoal'|'approach'|'retreat'|'feeding'|'watchFood'|'shelter';
export interface FishBehaviorEnvironment {season:'spring'|'summer'|'autumn'|'winter';weather:WeatherMode;rainIntensity:number;daylight:number}
export interface FishSwimProfile {
  habit:string;cruise:number;turn:number;cadence:number;patrolRadius:number;depth:number;depthSpread:number;
  schooling:boolean;nocturnal:boolean;feedingSpeed:number;
}
export interface FishBehaviorSnapshot {
  id:string;activity:FishActivity;label:string;habit:string;personality:FishPersonality;personalityName:string;traits:string[];context:string;
}
export interface WaterStimulus {x:number;y:number;strength:number;startedAt:number;expiresAt:number}
export interface FishBehaviorRuntime {
  personality:FishPersonality;cycleIndex:number;remaining:number;activity:FishActivity;foodSince:number|null;
  water:WaterStimulus|null;homeX:number;homeY:number;context:string;
}
const ordinary:FishSwimProfile={habit:'中层巡游',cruise:1,turn:1,cadence:1,patrolRadius:330,depth:.34,depthSpread:.22,schooling:false,nocturnal:false,feedingSpeed:1};
const p=(patch:Partial<FishSwimProfile>):FishSwimProfile=>({...ordinary,...patch});
const profiles:Record<FishMorphology,FishSwimProfile>={
  carp:p({habit:'宽弧巡游 · 缓慢上浮取食',turn:.77,cadence:.88,patrolRadius:380}),
  singleTail:p({habit:'慢游摇摆 · 游一段歇一会',cruise:.76,turn:.83,cadence:1.05,patrolRadius:235}),
  doubleTail:p({habit:'短程慢游 · 双尾缓摆',cruise:.66,turn:.71,cadence:.94,patrolRadius:190,feedingSpeed:.9}),
  ricefish:p({habit:'浅层短游 · 同种结伴',cruise:1.03,turn:1.13,cadence:1.3,patrolRadius:250,depth:.16,depthSpread:.13,schooling:true}),
  danio:p({habit:'同种结伴 · 短促快游',cruise:1.12,turn:1.16,cadence:1.48,patrolRadius:310,depth:.23,depthSpread:.17,schooling:true}),
  tetra:p({habit:'同种结伴 · 小步快游',cruise:1.04,turn:1.14,cadence:1.35,patrolRadius:240,depth:.30,depthSpread:.15,schooling:true}),
  walkingCatfish:p({habit:'贴底缓行 · 停驻后再巡视',cruise:.66,turn:.67,cadence:1.18,patrolRadius:215,depth:.76,depthSpread:.12,nocturnal:true,feedingSpeed:.85}),
  fanTail:p({habit:'短程巡视 · 灵活转向',cruise:.9,turn:1.03,cadence:1.14,patrolRadius:230,depth:.27,depthSpread:.17,schooling:true}),
  swordTail:p({habit:'短程快游 · 长尾缓转',cruise:.94,turn:.84,cadence:1.10,patrolRadius:270,depth:.27,depthSpread:.18,schooling:true}),
  betta:p({habit:'小范围巡视 · 长鳍慢摆',cruise:.61,turn:.76,cadence:.68,patrolRadius:135,depth:.22,depthSpread:.15,feedingSpeed:.85}),
  gourami:p({habit:'小范围缓游 · 丝足轻摆',cruise:.73,turn:.73,cadence:.80,patrolRadius:190,depth:.25,depthSpread:.17,feedingSpeed:.9}),
  angel:p({habit:'中层缓游 · 高鳍轻摆',cruise:.73,turn:.70,cadence:.78,patrolRadius:220,depth:.36,depthSpread:.17,feedingSpeed:.9}),
  discus:p({habit:'缓缓巡视 · 平稳转身',cruise:.68,turn:.67,cadence:.73,patrolRadius:200,depth:.40,depthSpread:.15,feedingSpeed:.85}),
  cichlid:p({habit:'小范围巡视 · 停驻观察',cruise:.86,turn:.90,cadence:.95,patrolRadius:245,depth:.39,depthSpread:.18}),
  barb:p({habit:'同种结伴 · 短促快游',cruise:1.03,turn:1.07,cadence:1.22,patrolRadius:275,depth:.30,depthSpread:.16,schooling:true}),
  rasbora:p({habit:'同种结伴 · 轻快巡视',cruise:1.04,turn:1.12,cadence:1.28,patrolRadius:250,depth:.25,depthSpread:.18,schooling:true}),
  hatchet:p({habit:'近水面短游 · 同种结伴',cruise:.95,turn:.95,cadence:1.15,patrolRadius:220,depth:.12,depthSpread:.12,schooling:true}),
  armoredCatfish:p({habit:'贴底探游 · 停驻查看',cruise:.65,turn:.93,cadence:1.08,patrolRadius:155,depth:.78,depthSpread:.12,nocturnal:true,feedingSpeed:.8}),
  pleco:p({habit:'贴底慢游 · 长时间停驻',cruise:.52,turn:.72,cadence:.92,patrolRadius:150,depth:.80,depthSpread:.09,nocturnal:true,feedingSpeed:.75}),
  loach:p({habit:'贴底探游 · 长身缓转',cruise:.80,turn:.69,cadence:1.4,patrolRadius:230,depth:.76,depthSpread:.12,nocturnal:true,feedingSpeed:.88}),
  eelLoach:p({habit:'贴底游走 · 长身蛇形摆动',cruise:.76,turn:.60,cadence:1.53,patrolRadius:210,depth:.80,depthSpread:.10,nocturnal:true,feedingSpeed:.85}),
  pictus:p({habit:'底层探游 · 长须轻摆',cruise:.86,turn:.73,cadence:1.18,patrolRadius:290,depth:.74,depthSpread:.13,nocturnal:true,feedingSpeed:.9}),
  arowana:p({habit:'浅层滑游 · 长身宽弧转向',cruise:.88,turn:.52,cadence:.87,patrolRadius:390,depth:.15,depthSpread:.16}),
  ray:p({habit:'贴底滑翔 · 盘缘缓摆',cruise:.71,turn:.49,cadence:.57,patrolRadius:300,depth:.79,depthSpread:.10,feedingSpeed:.8}),
  rainbow:p({habit:'同种结伴 · 活跃巡游',cruise:1.03,turn:.95,cadence:1.18,patrolRadius:310,depth:.31,depthSpread:.17,schooling:true}),
  shark:p({habit:'宽弧巡游 · 尾鳍有力摆动',cruise:1.04,turn:.78,cadence:1.2,patrolRadius:370,depth:.43,depthSpread:.19}),
};
// Species-inspired animation, not a husbandry or biological dynamics model.
// Zebrafish grouping reference: https://pmc.ncbi.nlm.nih.gov/articles/PMC3498229/
// Ray fin propulsion: https://doi.org/10.1242/jeb.202.24.3523
// All speeds, cycles and weather responses below are artistic scene settings.
export function getFishSwimProfile(kind:FishKind):FishSwimProfile {
  const definition=getFishDefinition(kind),profile=profiles[definition.morphology];
  return profile;
}
const cycles:Record<FishPersonality,readonly {activity:FishActivity;seconds:number}[]>={
  calm:[{activity:'patrol',seconds:11},{activity:'rest',seconds:7},{activity:'patrol',seconds:9},{activity:'rest',seconds:5}],
  curious:[{activity:'explore',seconds:10},{activity:'patrol',seconds:6},{activity:'explore',seconds:11},{activity:'rest',seconds:2}],
  bold:[{activity:'burst',seconds:1.8},{activity:'patrol',seconds:6},{activity:'explore',seconds:5},{activity:'burst',seconds:2.1},{activity:'patrol',seconds:5},{activity:'rest',seconds:1.3}],
};
export function createFishBehavior(record:FishRecord,seed:number,x:number,y:number):FishBehaviorRuntime {
  const personality=getFishPersonality(record),cycle=cycles[personality];
  return {personality,cycleIndex:0,remaining:cycle[0].seconds*(.72+seed*.5),activity:cycle[0].activity,foodSince:null,water:null,homeX:x,homeY:y,context:''};
}
export function advanceBehavior(runtime:FishBehaviorRuntime,personality:FishPersonality,dt:number):FishActivity {
  if(runtime.personality!==personality){runtime.personality=personality;runtime.cycleIndex=0;runtime.remaining=cycles[personality][0].seconds;runtime.water=null;}
  runtime.remaining-=dt;
  if(runtime.remaining<=1e-9){runtime.cycleIndex=(runtime.cycleIndex+1)%cycles[personality].length;runtime.remaining+=cycles[personality][runtime.cycleIndex].seconds;}
  return cycles[personality][runtime.cycleIndex].activity;
}
export function behaviorSnapshot(record:FishRecord,runtime:FishBehaviorRuntime,profile:FishSwimProfile):FishBehaviorSnapshot {
  const labels:Record<FishActivity,string>={patrol:'缓缓巡游',rest:'停驻休息',explore:'转向探索',burst:'短促快游',shoal:'同种结伴',approach:'靠近波纹查看',retreat:'退开一点观察',feeding:runtime.personality==='bold'?'抢先靠近饲料':'靠近饲料',watchFood:'观察饲料',shelter:'下潜避开雨波'};
  const personality=getFishPersonality(record);
  return {id:record.id,activity:runtime.activity,label:labels[runtime.activity],habit:profile.habit,personality,personalityName:FISH_PERSONALITIES[personality].name,traits:personality==='calm'?['巡游和停驻交替','拨水时先退开','观察后再取食']:personality==='curious'?['常常转向探索','会靠近波纹查看','查看后换个方向']:['短冲刺后滑行','迅速靠近波纹','更早响应饲料'],context:runtime.context};
}
