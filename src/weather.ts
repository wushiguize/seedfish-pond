import type { City, WeatherMode, WeatherReading } from './model';

export const CITY_PRESETS: City[] = [
  { name: '北京', region: '中国 · 北京', latitude: 39.9042, longitude: 116.4074 },
  { name: '上海', region: '中国 · 上海', latitude: 31.2304, longitude: 121.4737 },
  { name: '杭州', region: '中国 · 浙江', latitude: 30.2741, longitude: 120.1551 },
  { name: '深圳', region: '中国 · 广东', latitude: 22.5431, longitude: 114.0579 },
  { name: '成都', region: '中国 · 四川', latitude: 30.5728, longitude: 104.0668 },
  { name: '武汉', region: '中国 · 湖北', latitude: 30.5928, longitude: 114.3055 },
  { name: '广州', region: '中国 · 广东', latitude: 23.1291, longitude: 113.2644 },
  { name: '南京', region: '中国 · 江苏', latitude: 32.0603, longitude: 118.7969 },
];
export function mapWeather(code: number, rain: number, snow: number): WeatherMode {
  if (snow > 0 || [71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if (rain > 0 || (code >= 51 && code <= 67) || [80, 81, 82, 95, 96, 99].includes(code)) return 'rain';
  return code <= 1 ? 'sunny' : 'cloudy';
}
async function getJson(url: string, signal?: AbortSignal): Promise<any> {
  const timeout = AbortSignal.timeout(12000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`天气服务暂不可用 (${response.status})`);
  return response.json();
}
export async function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const local = CITY_PRESETS.filter(c => c.name.includes(text));
  if (local.length) return local;
  const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=8&language=zh&format=json`, signal);
  return (data.results ?? []).filter((r: any) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude)).map((r: any) => ({ name: r.name, region: [r.country, r.admin1].filter(Boolean).join(' · '), latitude: r.latitude, longitude: r.longitude }));
}
export async function fetchWeather(city: City, signal?: AbortSignal): Promise<WeatherReading> {
  const params = new URLSearchParams({ latitude: String(city.latitude), longitude: String(city.longitude), current: 'temperature_2m,weather_code,rain,precipitation,snowfall,wind_speed_10m,wind_direction_10m,is_day', timezone: 'auto', wind_speed_unit:'kmh' });
  const data = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`, signal);
  const c = data.current;
  if (!c || !Number.isFinite(c.temperature_2m) || !Number.isFinite(c.weather_code) || typeof c.time !== 'string') throw new Error('天气服务返回了无效数据');
  return { mode: mapWeather(c.weather_code, c.rain ?? 0, c.snowfall ?? 0), temperature: c.temperature_2m, wind: c.wind_speed_10m ?? 0, time: c.time, fetchedAt: Date.now(), isDay: c.is_day === 1,
    ...(Number.isFinite(c.wind_direction_10m)&&c.wind_direction_10m>=0&&c.wind_direction_10m<=360?{windDirection:c.wind_direction_10m}:{}),
    ...(Number.isFinite(c.precipitation)&&c.precipitation>=0&&c.precipitation<=1000?{precipitation:c.precipitation}:{}),
    ...(Number.isFinite(c.snowfall)&&c.snowfall>=0&&c.snowfall<=1000?{snowfall:c.snowfall}:{}),
    ...(Number.isInteger(data.utc_offset_seconds)&&data.utc_offset_seconds>=-43200&&data.utc_offset_seconds<=50400?{utcOffsetSeconds:data.utc_offset_seconds}:{}),
    ...(typeof data.timezone==='string'&&data.timezone.trim()&&data.timezone.length<=100?{timeZone:data.timezone}:{}) };
}
