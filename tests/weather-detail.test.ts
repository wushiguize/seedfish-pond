import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchWeather,CITY_PRESETS} from '../src/weather';
import {createSave,validateSave} from '../src/model';
import {validSceneSettings} from '../src/pond-scene-settings';
afterEach(()=>vi.unstubAllGlobals());
describe('weather details and scene preferences',()=>{
  it('reads provider wind direction and interval precipitation without losing timezone',async()=>{
    let requested='';vi.stubGlobal('fetch',vi.fn(async(url:string)=>{requested=url;return {ok:true,json:async()=>({current:{temperature_2m:14,weather_code:63,time:'2026-10-03T14:00',wind_speed_10m:18,wind_direction_10m:270,precipitation:.8,rain:.8,snowfall:0,is_day:1},timezone:'Asia/Shanghai',utc_offset_seconds:28800})};}));
    const reading=await fetchWeather(CITY_PRESETS[0]);expect(reading).toMatchObject({mode:'rain',wind:18,windDirection:270,precipitation:.8,snowfall:0,timeZone:'Asia/Shanghai'});
    const url=new URL(requested);expect(url.searchParams.get('current')).toContain('wind_direction_10m');expect(url.searchParams.get('wind_speed_unit')).toBe('kmh');
    const save=createSave();save.reading=reading;expect(validateSave(save).reading).toEqual(reading);
  });
  it('preserves old weather saves without requiring new details',()=>{const save=createSave();save.reading={mode:'snow',temperature:0,wind:4,time:'2026-10-03T14:00',fetchedAt:1,isDay:true};expect(validateSave(save)).toEqual(save);});
  it('rejects impossible optional weather values rather than persisting them',()=>{for(const [key,value] of [['precipitation',-1],['snowfall',Infinity],['windDirection',361]] as const){const save=createSave();save.reading={mode:'rain',temperature:15,wind:4,time:'2026-10-03T14:00',fetchedAt:1,isDay:true,[key]:value};expect(()=>validateSave(save)).toThrow('天气细节');}});
  it('restores known season/tool preferences and safely defaults corrupted values',()=>{expect(validSceneSettings({season:'autumn',interaction:'water'})).toEqual({season:'autumn',interaction:'water'});expect(validSceneSettings({season:'monsoon',interaction:'unknown'})).toEqual({season:'auto',interaction:'feed'});expect(validSceneSettings(null)).toEqual({season:'auto',interaction:'feed'});});
});
