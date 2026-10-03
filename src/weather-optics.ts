import type { WeatherMode } from './model';
import type { LakeSeason } from './lake-environment';
import type { LightingFrame } from './lighting';

export interface WeatherOptics {
  brightness:number;directSun:number;daylight:number;clarity:number;
  reflection:number;contrast:number;saturation:number;refraction:number;
  tint:[number,number,number];
}
const profiles={
  sunny:{sun:1,reflection:.018,contrast:1.04,saturation:1.055,refraction:.78},
  cloudy:{sun:.18,reflection:.14,contrast:.92,saturation:.94,refraction:1},
  rain:{sun:.055,reflection:.17,contrast:.90,saturation:.91,refraction:1.18},
  snow:{sun:.12,reflection:.10,contrast:.97,saturation:.96,refraction:.78},
} as const;
const beds:Record<LakeSeason,{sun:number;cloud:number;clear:number;overcast:number}>={
  spring:{sun:1.20,cloud:1,clear:.99,overcast:.92},
  summer:{sun:1.24,cloud:1,clear:.98,overcast:.89},
  autumn:{sun:1.20,cloud:1.01,clear:.97,overcast:.90},
  winter:{sun:1.12,cloud:1.03,clear:.99,overcast:.94},
};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
/** Display optics only. Animal activity always uses the unmodified clock. */
export function getWeatherOptics(weather:WeatherMode,mix:Partial<Record<LakeSeason,number>>,light:LightingFrame):WeatherOptics {
  const profile=profiles[weather],daylight=clamp(light.daylight),day=clamp((daylight-.18)/.82);
  let weight=0,exposure=0,clarity=0;
  for(const season of Object.keys(beds) as LakeSeason[]){
    const w=clamp(Number.isFinite(mix[season])?mix[season]!:0),bed=beds[season];weight+=w;
    exposure+=w*(weather==='sunny'?bed.sun:weather==='cloudy'?bed.cloud:weather==='snow'?bed.cloud+.025:bed.cloud-.035);
    clarity+=w*(weather==='sunny'?bed.clear:weather==='cloudy'?bed.overcast:weather==='snow'?bed.overcast-.015:bed.overcast-.07);
  }
  if(weight===0){exposure=1;clarity=.94;}else{exposure/=weight;clarity/=weight;}
  return {
    brightness:(.80+daylight*.20)*(1+(exposure-1)*(.35+.65*day)),
    directSun:profile.sun*day,daylight,clarity,
    reflection:profile.reflection*(.35+.65*day),
    contrast:1+(profile.contrast-1)*day,saturation:1+(profile.saturation-1)*day,
    refraction:profile.refraction,
    tint:light.tint.map((value,i)=>(1+(value-1)*.55)*(weather==='sunny'?(i===0?1.012:1):i===2?1.015:1)) as WeatherOptics['tint'],
  };
}
