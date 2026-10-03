import './style.css';
import { PondView } from './pond';
import { loadSave, persist } from './storage';
import { WEATHER_LABELS, validateSave, type City, type WeatherMode, type FishKind, type SaveData, type LightingMode } from './model';
import { FISH_CATALOG, FISH_FAMILIES, MAX_FISH, MAX_OWNED_FISH, createFishRecord, getFishDefinition, type FishFamily } from './fish-catalog';
import { CITY_PRESETS, fetchWeather, searchCities } from './weather';
import { FISH_PERSONALITIES, getFishPersonality, isFishPersonality } from './fish-personality';
import { getLakeClock, getLightingFrame } from './lighting';
import {SEASON_LABELS,getLakeSeason,type SeasonMode} from './lake-environment';
import {loadSceneSettings,saveSceneSettings,type SurfaceInteraction} from './pond-scene-settings';
import {loadPerformance,savePerformance,QUALITY_PROFILES,type PondQuality} from './pond-performance';
import {MAX_SAVE_BYTES,openSaveExport,openSaveImport} from './save-transfer';

const svg = (path:string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const icons = {
  sunny: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'),
  cloudy: svg('<path d="M6 18h12a4 4 0 0 0 .4-8A6.5 6.5 0 0 0 6 9a4.5 4.5 0 0 0 0 9Z"/>'),
  rain: svg('<path d="M5 14h14a3.5 3.5 0 0 0-1-7 6 6 0 0 0-11 0 3.5 3.5 0 0 0-2 7Zm2 3-1 3m6-3-1 3m6-3-1 3"/>'),
  snow: svg('<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M3 10l4-1-1-4m15 9-4 1 1 4M6 19l1-4-4-1m18-4-4-1 1-4"/>'),
  fish: svg('<path d="M3 12C7 3 17 3 21 12c-4 9-14 9-18 0Z"/><path d="m3 12-2-5v10l2-5"/><circle cx="16" cy="10" r=".7" fill="currentColor"/>'),
  close: svg('<path d="m6 6 12 12M6 18 18 6"/>'),
  eye: svg('<path d="m4 8-2-4h4m12 0h4v4M2 16v4h4m12 0h4v-4"/>'),
  edit: svg('<path d="m4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4"/>'),
};
const escape = (s:string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const loaded=loadSave(); let data=loaded.data;
let performanceSettings=loadPerformance();
let sceneSettings=loadSceneSettings();
let libraryPage=0;const LIBRARY_PAGE_SIZE=12;
const thumbnailKey='seedfish.catalog-thumbnails.anatomy-v5-20261003';
const thumbnailPending=new Set<FishKind>();let thumbnailRunning=false;
const emptyThumbnail='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
let thumbnails=new Map<FishKind,string>(FISH_CATALOG.map(f=>[f.kind,emptyThumbnail]));
try{const cached=JSON.parse(sessionStorage.getItem(thumbnailKey)??'null');if(cached&&typeof cached==='object')for(const f of FISH_CATALOG){const image=cached[f.kind];if(typeof image==='string'&&image.startsWith('data:image/png;base64,')&&image.length<1000000)thumbnails.set(f.kind,image);}}catch{/* Catalog cache is optional. */}
let view:PondView;
let ready=false, saveTimer:ReturnType<typeof setTimeout>|undefined, toastTimer:ReturnType<typeof setTimeout>|undefined;
let populationBusy=false,modelInspecting=false,libraryFamily:FishFamily|'all'='all',libraryQuery='';
let weatherRequest:AbortController|undefined, searchRequest:AbortController|undefined;
let weatherStatus='', hasWeatherError=false, isLoadingWeather=false;
let selectedFishId:string|null=null;
const LIGHTING_LABELS:Record<LightingMode,string>={auto:'随时间',dawn:'晨光',day:'白昼',dusk:'暮色',night:'夜色'};
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
  <main id="pond" aria-label="听池互动池塘"></main>
  <div class="vignette"></div>
  <header class="topbar interface">
    <div class="brand"><span class="brand-mark">${icons.fish}</span><div><h1>听池</h1><span class="brand-en">SEEDFISH · A LITTLE STILLNESS</span></div></div>
    <nav class="season-dock glass" aria-label="主界面四季"><span class="season-dock-label">湖畔四季</span><div>${(['spring','summer','autumn','winter'] as const).map((season,index)=>`<button data-season="${season}" aria-label="切换${SEASON_LABELS[season]}季" aria-pressed="false"><span class="season-symbol" aria-hidden="true">${['✿','⌁','❧','❄'][index]}</span><span>${SEASON_LABELS[season]}</span></button>`).join('')}</div><small id="main-season-status"></small></nav>
    <button class="weather-summary glass" id="weather-summary" aria-label="打开城市天气设置">${icons.sunny}<span><strong id="weather-heading">晴 · 手动天气</strong><small id="weather-caption">让池塘，跟着你的城市呼吸</small></span><span class="arrow">↗</span></button>
  </header>
  <div id="loading" role="status">池塘正在醒来<span class="loading-dots">…</span></div>
  <aside class="side-panel" id="side-panel" aria-label="池塘管理" hidden>
    <div class="panel-heading"><div><span class="eyebrow">POND JOURNAL</span><h2>池边小记</h2></div><button class="icon-button" id="close-panel" aria-label="关闭池塘管理">${icons.close}</button></div>
    <nav class="tabs" aria-label="池塘管理分类"><button data-tab="fish" class="active" aria-pressed="true">我的鱼儿</button><button data-tab="library" aria-pressed="false">鱼库</button><button data-tab="rank" aria-pressed="false">进食排行</button><button data-tab="weather" aria-pressed="false">天气</button></nav>
    <section id="fish-panel" class="panel-section"><p class="section-note">每一尾，都有自己的名字。</p><button id="fish-add" class="library-primary">＋ 从鱼库添加鱼儿</button><div id="fish-list"></div><div id="reserve-section"></div><label class="toggle-row"><span>在池塘里显示名字</span><input type="checkbox" id="show-names" role="switch" /></label><div class="save-actions"><button id="export-save">导出存档</button><button id="import-save">导入存档</button></div><p class="tiny-note" id="save-note">鱼种、名字和进食记录自动保存在这台设备。</p></section>
    <section id="library-panel" class="panel-section" hidden><div class="library-intro"><p class="section-note">挑一尾喜欢的，让它住进池塘。</p><span id="library-capacity"></span></div><label class="sr-only" for="fish-search">搜索鱼种</label><input id="fish-search" class="fish-search" type="search" placeholder="搜索鱼种、颜色或特点" maxlength="40" /><div class="library-filters" role="group" aria-label="鱼种分类"><button data-family="all" aria-pressed="true">全部</button>${Object.entries(FISH_FAMILIES).map(([key,name])=>`<button data-family="${key}" aria-pressed="false">${name}</button>`).join('')}</div><p id="library-status" class="tiny-note" role="status"></p><div id="library-list" class="library-grid"></div><div id="library-pagination" class="library-pagination" aria-label="鱼库分页"></div><p class="tiny-note">同一鱼种可添加多尾，每尾都有独立的名字和记录。</p></section>
    <section id="rank-panel" class="panel-section" hidden><p class="section-note">谁是池塘里的小吃货？</p><div id="rank-list"></div><p class="tiny-note">本池塘累计进食量 · 每粒饲料只计一次</p></section>
    <section id="weather-panel" class="panel-section" hidden><p class="section-note">窗外什么天气，池塘就是什么心情。</p><label class="field-label" for="city-query">你的城市</label><form id="city-form" class="city-search"><input id="city-query" placeholder="城市名或拼音，如杭州 / Paris" autocomplete="off" maxlength="80" /><button type="submit">查找</button></form><div id="city-results" class="city-results"></div><div class="preset-cities">${CITY_PRESETS.slice(0,6).map((c,i)=>`<button data-city="${i}">${c.name}</button>`).join('')}</div><div class="city-current" id="city-current">还没有选择城市</div><label class="toggle-row"><span>联动城市天气</span><input type="checkbox" id="auto-weather" role="switch" /></label><p class="weather-status" id="weather-status" role="status"></p><button class="text-button" id="refresh-weather">刷新天气</button><div class="weather-source"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">天气数据 · Open-Meteo ↗</a><span>每 15 分钟更新，具体以数据时间为准。<br />断网时保留最近状态；可随时切换手动天气。<br />免费接口用于个人非商业原型。</span></div></section>
  </aside>
  <footer class="bottom-bar interface"><div class="pond-note"><span class="live-dot"></span><span id="pond-population">5 尾鱼儿 · 1 只小龟</span><small id="total-eaten">点一下水面，喂它们一口。</small></div><div class="weather-dock glass" role="group" aria-label="手动天气">${(Object.keys(WEATHER_LABELS) as WeatherMode[]).map(mode=>`<button data-weather="${mode}" aria-label="切换${WEATHER_LABELS[mode]}天" aria-pressed="false">${icons[mode]}<span>${WEATHER_LABELS[mode]}</span></button>`).join('')}</div><div class="pond-actions"><button id="immersion" class="icon-button glass" aria-label="进入沉浸模式" title="沉浸模式 · H">${icons.eye}</button><button id="open-library" class="glass add-fish-button" aria-label="添加鱼儿">＋<span>加鱼</span></button><button id="open-fish" class="glass fish-button">${icons.fish}<span>我的鱼儿</span><span class="count-badge">5</span></button></div></footer>
  <button id="exit-immersion" class="glass" hidden>退出沉浸 · H</button>
  <div id="toast" role="status" class="toast" hidden></div>
  <aside id="fish-info" class="fish-info glass interface" role="dialog" aria-label="鱼儿信息" hidden></aside>
`;
const el=<T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
const desktopTab=document.createElement('button');desktopTab.dataset.tab='desktop';desktopTab.textContent='桌面';desktopTab.setAttribute('aria-pressed','false');el('side-panel').querySelector('.tabs')!.appendChild(desktopTab);
const desktopPanel=document.createElement('section');desktopPanel.id='desktop-panel';desktopPanel.className='panel-section';desktopPanel.hidden=true;
desktopPanel.innerHTML=`<p class="section-note">让小湖陪你工作，也留一点余力给电脑。</p><label class="field-label">画面品质</label><div class="quality-modes" role="group" aria-label="画面品质">${Object.entries(QUALITY_PROFILES).map(([key,profile])=>`<button data-quality="${key}" aria-pressed="false">${profile.name}</button>`).join('')}</div><p class="tiny-note">节能：轻量水面与少量雨雪 · 最高 20 帧<br>均衡：默认品质 · 最高 30 帧<br>精细：更细的水面与完整雨雪 · 最高 60 帧</p><label class="toggle-row"><span>自动省电</span><input id="adaptive-performance" type="checkbox" role="switch" aria-label="自动省电"></label><p class="tiny-note">45 秒没有互动时降低帧率，操作后恢复。持续卡顿时暂时减轻画面；切到后台时暂停。</p><p id="performance-status" class="weather-status" role="status"></p><p class="tiny-note">设置保存在这台设备，不改变鱼和进食记录。</p>`;
el('side-panel').appendChild(desktopPanel);
const desktopButton=document.createElement('button');desktopButton.id='open-desktop';desktopButton.className='icon-button glass';desktopButton.setAttribute('aria-label','桌面设置');desktopButton.innerHTML=svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>');el('immersion').parentElement!.insertBefore(desktopButton,el('immersion'));
function updatePerformanceUI():void {
  document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.quality===performanceSettings.quality)));
  el<HTMLInputElement>('adaptive-performance').checked=performanceSettings.adaptive;
  if(!ready){el('performance-status').textContent='池塘准备好后应用这些设置。';return;}
  const stats=view.getPerformanceStats(),reason=stats.paused?'已暂停':stats.reason==='idle'?'空闲省电':stats.reason==='load'?'正在减轻负载':'正常运行';
  el('performance-status').textContent=`${QUALITY_PROFILES[stats.quality].name} · ${stats.paused?'0':`上限 ${stats.fps}`} 帧/秒 · ${reason}`;
}
function applyPerformanceSettings():void {view.setPerformance(performanceSettings);if(!savePerformance(performanceSettings))toast('画质设置已应用，但当前环境无法保存设置。');updatePerformanceUI();}
function toast(message:string):void {el('toast').textContent=message;el('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('toast').hidden=true,3600);}
function save():void {
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
    if(!persist(data)) {el('save-note').textContent='自动保存不可用，请使用“导出存档”保留记录。';toast('当前环境无法自动保存，请导出存档。');}
  },250);
}
function renderFish():void {
  el('fish-list').innerHTML=data.fish.length?data.fish.map(f=>`<article class="fish-row" data-fish="${f.id}"><img data-kind="${f.kind}" src="${thumbnails.get(f.kind)}" alt="${escape(getFishDefinition(f.kind).name)}模型"/><div class="fish-details"><strong class="fish-name">${escape(f.name)}</strong><span>${getFishDefinition(f.kind).name} · 吃掉 <b data-count="${f.id}">${f.eaten}</b> 粒</span></div><button class="rename icon-button" aria-label="给${escape(f.name)}改名" ${populationBusy?'disabled':''}>${icons.edit}</button><button class="remove-fish icon-button" aria-label="把${escape(f.name)}移到暂养区" title="移到暂养区，保留记录" ${populationBusy?'disabled':''}>−</button><form class="rename-form" hidden><input aria-label="鱼儿名字" value="${escape(f.name)}" maxlength="24"/><button type="submit">保存</button></form></article>`).join(''):'<p class="empty-fish">池塘还没有鱼儿。<br/>去鱼库挑一尾，给它起个名字吧。</p>';
  el('fish-list').querySelectorAll<HTMLElement>('[data-fish]').forEach(row=>{
    const f=data.fish.find(f=>f.id===row.dataset.fish)!;
    const name=row.querySelector<HTMLElement>('.fish-name')!,infoButton=document.createElement('button');infoButton.className='fish-info-link';infoButton.textContent=f.name;infoButton.setAttribute('aria-label',`查看${f.name}的信息`);infoButton.addEventListener('click',()=>showFishInfo(f.id));name.replaceChildren(infoButton);
    row.querySelector('.rename')!.addEventListener('click',()=>{const form=row.querySelector<HTMLFormElement>('form')!;form.hidden=!form.hidden;if(!form.hidden){form.querySelector('input')!.focus();form.querySelector('input')!.select();}});
    row.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();const name=row.querySelector('input')!.value.trim();if(!name||[...name].length>12){toast('名字请填写 1～12 个字。');return;}f.name=name;save();renderFish();renderCounts();renderFishInfo();toast(`这尾鱼儿现在叫“${name}”。`);});
    row.querySelector('.remove-fish')!.addEventListener('click',()=>void changePopulation({...data,fish:data.fish.filter(fish=>fish.id!==f.id),reserve:[...data.reserve,f]},`“${f.name}”已移到暂养区，可以随时恢复。`));
  });
  el('reserve-section').innerHTML=data.reserve.length?`<details class="reserve-list"><summary>暂养区 · ${data.reserve.length} 尾</summary><p class="tiny-note">移出的鱼儿保留名字和进食记录。</p>${data.reserve.map(f=>`<div class="reserve-row"><img data-kind="${f.kind}" src="${thumbnails.get(f.kind)}" alt=""/><div><strong>${escape(f.name)}</strong><small>${getFishDefinition(f.kind).name} · ${f.eaten} 粒</small></div><button data-restore="${f.id}" aria-label="把${escape(f.name)}放回池塘" ${populationBusy||data.fish.length>=MAX_FISH?'disabled':''}>放回</button></div>`).join('')}</details>`:'';
  document.querySelectorAll<HTMLButtonElement>('[data-restore]').forEach(button=>button.addEventListener('click',()=>{const fish=data.reserve.find(f=>f.id===button.dataset.restore)!;void changePopulation({...data,fish:[...data.fish,fish],reserve:data.reserve.filter(f=>f.id!==fish.id)},`“${fish.name}”回到池塘了。`);}));
}
function showFishInfo(id:string|null):void {selectedFishId=id;if(ready)view.selectFish(id);renderFishInfo();}
function renderFishInfo():void {
  const fish=data.fish.find(f=>f.id===selectedFishId),panel=el('fish-info');
  if(!fish){selectedFishId=null;panel.hidden=true;if(ready)view.selectFish(null);return;}
  const personality=getFishPersonality(fish),definition=getFishDefinition(fish.kind);
  panel.innerHTML=`<div class="fish-info-heading"><div><span>${definition.name}</span><h2>${escape(fish.name)}</h2></div><button class="icon-button" aria-label="关闭鱼儿信息">${icons.close}</button></div><img class="fish-info-model" data-kind="${fish.kind}" src="${thumbnails.get(fish.kind)}" alt="${definition.name}模型"/><p class="fish-info-count">已经吃掉 <strong id="selected-fish-eaten">${fish.eaten}</strong> 粒饲料</p><div class="fish-behavior"><span>此刻</span><strong id="fish-activity" aria-live="polite"></strong><p id="fish-habit"></p></div><label for="fish-personality">它的游动性格</label><select id="fish-personality">${Object.entries(FISH_PERSONALITIES).map(([key,p])=>`<option value="${key}" ${key===personality?'selected':''}>${p.name}</option>`).join('')}</select><p id="personality-note">${FISH_PERSONALITIES[personality].description}</p><small>拨水看它的回应 · 性格会自动保存</small>`;
  panel.hidden=false;
  updateSelectedBehavior();
  panel.querySelector('button')!.addEventListener('click',()=>showFishInfo(null));
  panel.querySelector('select')!.addEventListener('change',event=>{const value=(event.target as HTMLSelectElement).value;if(!isFishPersonality(value))return;fish.personality=value;el('personality-note').textContent=FISH_PERSONALITIES[value].description;save();});
}
function updateSelectedBehavior():void {
  if(!ready||!selectedFishId||el('fish-info').hidden)return;
  const behavior=view.simulation.getBehaviorSnapshot(selectedFishId);if(!behavior)return;
  el('fish-activity').textContent=behavior.label;
  el('fish-habit').textContent=behavior.habit+(behavior.context?' · '+behavior.context:'');
}
setInterval(updateSelectedBehavior,500);
async function ensureThumbnails(kinds:FishKind[]):Promise<void> {
  if(!ready)return;
  for(const kind of kinds)if(!thumbnails.get(kind)||thumbnails.get(kind)===emptyThumbnail)thumbnailPending.add(kind);
  if(thumbnailRunning||!thumbnailPending.size)return;
  thumbnailRunning=true;
  try{while(thumbnailPending.size){const batch=[...thumbnailPending].slice(0,LIBRARY_PAGE_SIZE);batch.forEach(kind=>thumbnailPending.delete(kind));await view.getCatalogThumbnails(batch,(kind,png)=>{thumbnails.set(kind,png);document.querySelectorAll<HTMLImageElement>(`img[data-kind="${kind}"]`).forEach(image=>image.src=png);});try{sessionStorage.setItem(thumbnailKey,JSON.stringify(Object.fromEntries([...thumbnails].filter(([,png])=>png!==emptyThumbnail))));}catch{/* Cache does not affect the user's fish. */}}}
  catch(error){console.warn('Catalog thumbnail unavailable:',error);}
  finally{thumbnailRunning=false;}
}
function renderLibrary():void {
  el('library-capacity').textContent=`${data.fish.length} / ${MAX_FISH} 尾`;
  el('library-status').textContent=populationBusy?'正在安置鱼儿…':!ready?'鱼种模型准备中…':data.fish.length>=MAX_FISH?'池塘已满，可把鱼儿移到暂养区，再添加新朋友。':data.fish.length+data.reserve.length>=MAX_OWNED_FISH?'鱼库收藏已达 64 尾，可从暂养区放回已有鱼儿。':'';
  const query=libraryQuery.trim().toLowerCase(),catalog=FISH_CATALOG.filter(f=>(libraryFamily==='all'||f.family===libraryFamily)&&`${f.name}${f.tag}${f.description}${f.scientificName}`.toLowerCase().includes(query)).sort((a,b)=>Number(a.family==='koi')-Number(b.family==='koi'));
  libraryPage=Math.max(0,Math.min(libraryPage,Math.ceil(catalog.length/LIBRARY_PAGE_SIZE)-1));
  const page=catalog.slice(libraryPage*LIBRARY_PAGE_SIZE,(libraryPage+1)*LIBRARY_PAGE_SIZE);
  el('library-list').innerHTML=catalog.length?page.map(f=>`<article class="library-card"><button class="library-model" data-preview="${f.kind}" aria-label="查看${f.name}三维模型" ${!ready||populationBusy?'disabled':''}><img data-kind="${f.kind}" src="${thumbnails.get(f.kind)}" alt="${f.name}三维模型"/><span>看模型 ↗</span></button><div class="library-card-info"><strong>${f.name}</strong><span>${f.tag}</span><small class="scientific-name">${f.scientificName}</small><p>${f.description}</p></div><div class="library-card-bottom"><small>池中 ${data.fish.filter(fish=>fish.kind===f.kind).length} 尾</small><button data-add="${f.kind}" aria-label="添加${f.name}" ${!ready||populationBusy||data.fish.length>=MAX_FISH||data.fish.length+data.reserve.length>=MAX_OWNED_FISH?'disabled':''}>＋ 加入</button></div></article>`).join(''):'<p class="empty-fish">没有找到这个鱼种，试试其他名字。</p>';
  el('library-capacity').textContent=`${FISH_CATALOG.length} 个品种 / 品系 · 在湖 ${data.fish.length}/${MAX_FISH}`;
  el('library-pagination').innerHTML=catalog.length?`<button id="library-prev" aria-label="鱼库上一页" ${libraryPage===0?'disabled':''}>←</button><span>${libraryPage+1} / ${Math.ceil(catalog.length/LIBRARY_PAGE_SIZE)} 页 · ${catalog.length} 项</span><button id="library-next" aria-label="鱼库下一页" ${(libraryPage+1)*LIBRARY_PAGE_SIZE>=catalog.length?'disabled':''}>→</button>`:'';
  document.getElementById('library-prev')?.addEventListener('click',()=>{libraryPage--;renderLibrary();el('library-list').scrollIntoView({block:'nearest'});});
  document.getElementById('library-next')?.addEventListener('click',()=>{libraryPage++;renderLibrary();el('library-list').scrollIntoView({block:'nearest'});});
  if(!el('library-panel').hidden)void ensureThumbnails(page.map(f=>f.kind));
  document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(button=>button.addEventListener('click',()=>{const fish=createFishRecord(button.dataset.add as FishKind,[...data.fish,...data.reserve]);void changePopulation({...data,fish:[...data.fish,fish]},`“${fish.name}”游进池塘了。`);}));
  document.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(button=>button.addEventListener('click',()=>void inspectModels(button.dataset.preview as FishKind)));
}
async function changePopulation(next:SaveData,message:string,importAll=false):Promise<boolean> {
  if(!ready||populationBusy||modelInspecting)return false;
  populationBusy=true;renderFish();renderLibrary();el<HTMLButtonElement>('import-save').disabled=true;
  if(importAll){weatherRequest?.abort();isLoadingWeather=false;}
  try {await view.setFish(next.fish);for(const [kind,png] of view.getThumbnails())thumbnails.set(kind,png);data=importAll?next:{...data,fish:next.fish,reserve:next.reserve};save();renderCounts();toast(message);return true;}
  catch(error){console.error('Fish population update failed:',error);toast('鱼儿暂时无法安置，请稍后重试。');return false;}
  finally{populationBusy=false;renderFish();renderLibrary();renderFishInfo();el<HTMLButtonElement>('import-save').disabled=false;}
}
function renderCounts():void {
  for(const f of data.fish){const count=document.querySelector(`[data-count="${f.id}"]`);if(count)count.textContent=String(f.eaten);}
  const total=data.fish.reduce((sum,f)=>sum+f.eaten,0);
  const selected=data.fish.find(f=>f.id===selectedFishId);if(selected&&document.getElementById('selected-fish-eaten'))el('selected-fish-eaten').textContent=String(selected.eaten);
  el('total-eaten').textContent=total?`已经吃掉 ${total} 粒 · 点击水面继续投食`:'点一下水面，喂它们一口。';
  el('pond-population').textContent=`${data.fish.length} 尾鱼儿 · 龟、虾与田螺相伴`;
  el('open-fish').querySelector('.count-badge')!.textContent=String(data.fish.length);
  if(sceneSettings.interaction==='water')el('total-eaten').textContent='拨水模式 · 轻点起波，按住拖动推动浮叶';
  if(!data.fish.length)el('total-eaten').textContent='池塘空着，先去鱼库挑一尾吧。';
  const ranking=[...data.fish].sort((a,b)=>b.eaten-a.eaten);
  el('rank-list').innerHTML=ranking.length?ranking.map((f,i)=>`<div class="rank-row"><span class="rank-number">${String(i+1).padStart(2,'0')}</span><img data-kind="${f.kind}" src="${thumbnails.get(f.kind)}" alt=""/><strong>${escape(f.name)}</strong><span class="rank-eaten">${f.eaten}<small>粒</small></span></div>`).join(''):'<p class="empty-fish">添加鱼儿后，就能看到它们的进食排行。</p>';
}
function openPanel(tab:string):void {
  el('side-panel').hidden=false;
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  ['fish','library','rank','weather','desktop'].forEach(name=>el(`${name}-panel`).hidden=name!==tab);
  if(tab==='library')renderLibrary();if(tab==='fish')void ensureThumbnails(data.reserve.map(f=>f.kind));
}
function updateWeatherUI():void {
  const r=data.reading,isLive=data.weatherAuto&&r&&data.city;
  el('weather-heading').textContent=isLive?`${data.city!.name} · ${Math.round(r!.temperature)}° · ${WEATHER_LABELS[data.weatherMode]}`:data.weatherAuto?`${data.city!.name} · ${isLoadingWeather?'获取天气中':'天气待更新'}`:`${WEATHER_LABELS[data.weatherMode]} · 手动天气`;
  el('weather-caption').textContent=isLive?(hasWeatherError?'暂未更新 · 保留上次天气':`${r!.time.slice(11,16)} 数据 · 城市天气联动`):data.weatherAuto?`暂时保留${WEATHER_LABELS[data.weatherMode]}天场景`:'让池塘，跟着你的城市呼吸';
  el('weather-summary').querySelector('svg')!.outerHTML=icons[data.weatherMode];
  el('city-current').textContent=data.city?`${data.city.name} · ${data.city.region}`:'还没有选择城市';
  el<HTMLInputElement>('auto-weather').checked=data.weatherAuto;
  el<HTMLButtonElement>('refresh-weather').disabled=!data.city||isLoadingWeather;
  el('weather-status').textContent=weatherStatus||(r&&data.city?`${r.time.replace('T',' ')} · ${r.temperature}°C · 风速 ${r.wind} km/h`:'选择城市后可获取当地天气。');
  document.querySelectorAll<HTMLButtonElement>('[data-weather]').forEach(b=>{const selected=!data.weatherAuto&&b.dataset.weather===data.weatherMode;b.setAttribute('aria-pressed',String(selected));b.classList.toggle('active',selected);});
  updateLightingUI();updateSeasonUI();
  if(ready){view.setWeather(data.weatherMode,data.weatherAuto?data.reading:null);view.setLighting(data.lightingMode,data.city?data.reading:null);view.setSeason(sceneSettings.season,data.city?.latitude??30);}
}
function updateLightingUI():void {
  const clock=getLakeClock(Date.now(),data.city?data.reading:null),lighting=getLightingFrame(data.lightingMode,clock.hour);
  el('lighting-clock').textContent=data.lightingMode==='auto'?`${clock.source==='city'?data.city!.name+'当地':'本机'} ${clock.text} · ${LIGHTING_LABELS[lighting.phase]}`:`${LIGHTING_LABELS[data.lightingMode]} · 手动预览`;
  document.querySelectorAll<HTMLButtonElement>('[data-lighting]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lighting===data.lightingMode)));
  updateMainWeatherCaption();
}
function updateMainWeatherCaption():void {
  const season=sceneSettings.season==='auto'?getLakeSeason(new Date(),data.city?data.reading:null,data.city?.latitude??30):sceneSettings.season;
  const light=getLightingFrame(data.lightingMode,getLakeClock(Date.now(),data.city?data.reading:null).hour);
  el('weather-caption').textContent=`${SEASON_LABELS[season]}季 · ${LIGHTING_LABELS[light.phase]}${data.lightingMode==='auto'?' · 随时间':''}`;
  el('weather-summary').title='天气与昼夜光照可以分别设置';
}
function setManualWeather(mode:WeatherMode):void {weatherRequest?.abort();isLoadingWeather=false;data.weatherAuto=false;data.weatherMode=mode;weatherStatus='当前为手动天气，城市天气联动已暂停。';updateWeatherUI();save();}
async function refreshWeather():Promise<void> {
  if(!data.city)return;
  weatherRequest?.abort();const controller=new AbortController();weatherRequest=controller;const city={...data.city};
  isLoadingWeather=true;weatherStatus=`正在获取${city.name}的天气…`;updateWeatherUI();
  try {
    const reading=await fetchWeather(city,controller.signal);
    if(controller.signal.aborted)return;
    data.reading=reading;if(data.weatherAuto)data.weatherMode=reading.mode;hasWeatherError=false;weatherStatus=`${reading.time.replace('T',' ')} · ${reading.temperature}°C · 风速 ${reading.wind} km/h`;save();
  } catch(error) {
    if(controller.signal.aborted)return;
    hasWeatherError=true;weatherStatus=data.reading?'天气更新失败，保留上次天气。稍后可重试。':'天气获取失败。手动天气仍可使用，稍后可重试。';console.warn('Weather request failed:',error instanceof Error?error.message:'unknown error');
  } finally {if(!controller.signal.aborted){isLoadingWeather=false;updateWeatherUI();}}
}
function selectCity(city:City):void {weatherRequest?.abort();data.city=city;data.reading=null;data.weatherAuto=true;hasWeatherError=false;el('city-results').replaceChildren();el<HTMLInputElement>('city-query').value=city.name;updateWeatherUI();save();void refreshWeather();}
el('city-form').addEventListener('submit',async event=>{
  event.preventDefault();const query=el<HTMLInputElement>('city-query').value.trim();if(query.length<2){toast('请输入至少两个字的城市名。');return;}
  searchRequest?.abort();const controller=new AbortController();searchRequest=controller;el('city-results').textContent='正在查找城市…';
  try {const cities=await searchCities(query,controller.signal);if(controller.signal.aborted)return;el('city-results').replaceChildren();if(!cities.length){el('city-results').textContent='没有找到城市，可以试试拼音或英文名。';return;}for(const city of cities){const button=document.createElement('button');button.type='button';button.textContent=`${city.name} · ${city.region}`;button.addEventListener('click',()=>selectCity(city));el('city-results').appendChild(button);}}
  catch{if(!controller.signal.aborted)el('city-results').textContent='城市查询暂不可用，可选择下方常用城市。';}
});
document.querySelectorAll<HTMLElement>('[data-city]').forEach(b=>b.addEventListener('click',()=>selectCity(CITY_PRESETS[Number(b.dataset.city)])));
document.querySelectorAll<HTMLElement>('[data-weather]').forEach(b=>b.addEventListener('click',()=>setManualWeather(b.dataset.weather as WeatherMode)));
document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>b.addEventListener('click',()=>openPanel(b.dataset.tab!)));
el('weather-summary').addEventListener('click',()=>openPanel('weather'));
el('open-fish').addEventListener('click',()=>openPanel('fish'));
el('open-library').addEventListener('click',()=>openPanel('library'));
el('open-desktop').addEventListener('click',()=>{openPanel('desktop');updatePerformanceUI();});
document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(button=>button.addEventListener('click',()=>{performanceSettings={...performanceSettings,quality:button.dataset.quality as PondQuality};applyPerformanceSettings();}));
el('adaptive-performance').addEventListener('change',()=>{performanceSettings={...performanceSettings,adaptive:el<HTMLInputElement>('adaptive-performance').checked};applyPerformanceSettings();});
document.addEventListener('pointerdown',()=>{if(view)view.notifyInteraction();},{passive:true});
document.addEventListener('keydown',()=>{if(view)view.notifyInteraction();});
setInterval(()=>{if(!desktopPanel.hidden)updatePerformanceUI();},1000);
el('fish-add').addEventListener('click',()=>openPanel('library'));
el<HTMLInputElement>('fish-search').addEventListener('input',()=>{libraryQuery=el<HTMLInputElement>('fish-search').value;libraryPage=0;renderLibrary();});
document.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(button=>button.addEventListener('click',()=>{libraryFamily=button.dataset.family as FishFamily|'all';libraryPage=0;document.querySelectorAll<HTMLButtonElement>('[data-family]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderLibrary();}));
el('close-panel').addEventListener('click',()=>el('side-panel').hidden=true);
el('show-names').addEventListener('change',()=>{if(ready)view.showNames(el<HTMLInputElement>('show-names').checked);});
el('auto-weather').addEventListener('change',()=>{if(!data.city){el<HTMLInputElement>('auto-weather').checked=false;toast('请先选择城市。');return;}data.weatherAuto=el<HTMLInputElement>('auto-weather').checked;weatherRequest?.abort();isLoadingWeather=false;save();updateWeatherUI();if(data.weatherAuto)void refreshWeather();});
el('refresh-weather').addEventListener('click',()=>void refreshWeather());
const lightingControls=document.createElement('div');lightingControls.className='lighting-settings';lightingControls.innerHTML=`<label class="field-label">水面的光</label><div class="lighting-modes" role="group" aria-label="昼夜光照">${Object.entries(LIGHTING_LABELS).map(([key,label])=>`<button data-lighting="${key}" aria-pressed="false">${label}</button>`).join('')}</div><p id="lighting-clock" class="weather-status"></p><p class="tiny-note">随时间缓慢变化。选城市后使用当地时间；晨暮时段是氛围效果。</p>`;
el('weather-panel').insertBefore(lightingControls,el('weather-panel').querySelector('.weather-source'));
document.querySelectorAll<HTMLButtonElement>('[data-lighting]').forEach(button=>button.addEventListener('click',()=>{data.lightingMode=button.dataset.lighting as LightingMode;updateLightingUI();if(ready)view.setLighting(data.lightingMode,data.city?data.reading:null);save();}));
const sceneControls=document.createElement('div');sceneControls.className='season-settings';
sceneControls.innerHTML=`<label class="field-label">小湖的季节</label><div class="lighting-modes" role="group" aria-label="季节环境">${Object.entries(SEASON_LABELS).map(([key,label])=>`<button data-season="${key}" aria-pressed="false">${label}</button>`).join('')}</div><p id="season-status" class="weather-status"></p><p class="tiny-note">春水轻盈 · 夏夜微光 · 秋叶随风 · 冬日岸冰<br>跟随月份使用城市所在半球，外观会缓慢过渡。</p>`;
el('weather-panel').insertBefore(sceneControls,lightingControls);
const interactionControls=document.createElement('div');interactionControls.className='surface-tools';interactionControls.innerHTML=`<span>轻触水面</span><div role="group" aria-label="水面交互"><button data-interaction="feed" aria-pressed="false">投食</button><button data-interaction="water" aria-pressed="false">拨水</button></div><small>按住轻划水面，也能推开浮叶。</small>`;el('desktop-panel').appendChild(interactionControls);
const waterButton=document.createElement('button');waterButton.id='water-tool';waterButton.className='icon-button glass';waterButton.setAttribute('aria-label','切换拨水模式');waterButton.title='轻触拨水 · W';waterButton.innerHTML=svg('<path d="M3 15c3-4 6 4 9 0s6 4 9 0M4 20c3-3 5 3 8 0s5 3 8 0M12 2s-4 5-4 7a4 4 0 0 0 8 0c0-2-4-7-4-7Z"/>');el('immersion').parentElement!.insertBefore(waterButton,el('immersion'));
function updateSeasonUI():void {
  const resolved=sceneSettings.season==='auto'?getLakeSeason(new Date(),data.city?data.reading:null,data.city?.latitude??30):sceneSettings.season;
  document.querySelectorAll<HTMLButtonElement>('[data-season]').forEach(button=>button.setAttribute('aria-pressed',String(button.closest('.season-dock')?button.dataset.season===resolved:button.dataset.season===sceneSettings.season)));
  el('season-status').textContent=sceneSettings.season==='auto'?`${SEASON_LABELS[resolved]}季 · ${getLakeClock(Date.now(),data.city?data.reading:null).source==='city'?data.city!.name+'当地':'本机'}月份`:`${SEASON_LABELS[resolved]}季 · 手动环境`;
  el('main-season-status').textContent=({spring:'桃花轻落',summer:'柳影与蜻蜓',autumn:'枫叶入水',winter:'晴霜与薄冰'} as const)[resolved]+(sceneSettings.season==='auto'?' · 随月份':'');
  app.dataset.season=resolved;el('weather-summary').dataset.season=resolved;updateMainWeatherCaption();
}
function updateInteractionUI():void {document.querySelectorAll<HTMLButtonElement>('[data-interaction]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.interaction===sceneSettings.interaction)));el('water-tool').classList.toggle('active',sceneSettings.interaction==='water');el('water-tool').setAttribute('aria-pressed',String(sceneSettings.interaction==='water'));el('water-tool').setAttribute('aria-label',sceneSettings.interaction==='water'?'切换投食模式':'切换拨水模式');if(view)view.setInteraction(sceneSettings.interaction);}
function applySceneSettings():void {if(view){view.setSeason(sceneSettings.season,data.city?.latitude??30);view.setInteraction(sceneSettings.interaction);view.notifyInteraction();}if(!saveSceneSettings(sceneSettings))toast('环境已应用，当前设备暂时无法保存偏好。');updateSeasonUI();updateInteractionUI();renderCounts();}
document.querySelectorAll<HTMLButtonElement>('[data-season]').forEach(button=>button.addEventListener('click',()=>{sceneSettings={...sceneSettings,season:button.dataset.season as SeasonMode};applySceneSettings();}));
document.querySelectorAll<HTMLButtonElement>('[data-interaction]').forEach(button=>button.addEventListener('click',()=>{sceneSettings={...sceneSettings,interaction:button.dataset.interaction as SurfaceInteraction};applySceneSettings();}));
el('water-tool').addEventListener('click',()=>{sceneSettings={...sceneSettings,interaction:sceneSettings.interaction==='water'?'feed':'water'};applySceneSettings();toast(sceneSettings.interaction==='water'?'拨水模式 · 轻点起波，按住拖动可推开浮叶。':'投食模式 · 轻点投食，拖动只拨水。');});
setInterval(()=>{updateLightingUI();updateSeasonUI();},30000);
function setImmersion(active:boolean):void {document.body.classList.toggle('immersed',active);document.querySelectorAll<HTMLElement>('.interface').forEach(element=>element.inert=active);el('exit-immersion').hidden=!active;el('side-panel').hidden=true;if(active)showFishInfo(null);}
function toggleImmersion():void {setImmersion(!document.body.classList.contains('immersed'));}
el('immersion').addEventListener('click',toggleImmersion);el('exit-immersion').addEventListener('click',toggleImmersion);
document.addEventListener('keydown',event=>{if((event.target as HTMLElement).matches('input,textarea,select'))return;if(event.key.toLowerCase()==='h')toggleImmersion();if(event.key.toLowerCase()==='w')el('water-tool').click();if(event.key==='Escape'){if(document.body.classList.contains('immersed'))toggleImmersion();else {el('side-panel').hidden=true;showFishInfo(null);}}});
const modelButton=document.createElement('button');modelButton.id='inspect-models';modelButton.className='model-inspect-button';modelButton.textContent='查看鱼种三维模型 ↗';
el('fish-panel').insertBefore(modelButton,el('fish-panel').querySelector('.toggle-row'));
async function inspectModels(kind:FishKind='kohaku'):Promise<void> {
  if(!ready||populationBusy||modelInspecting)return;
  modelInspecting=true;view.setInspecting(true);modelButton.disabled=true;
  try {const {openKoiPreview}=await import('./model-preview');await openKoiPreview(kind);}
  catch(error){console.error('Model preview failed:',error);toast('模型预览暂时无法打开，请刷新后再试。');}
  finally {modelInspecting=false;view.setInspecting(false);modelButton.disabled=false;}
}
modelButton.addEventListener('click',()=>void inspectModels());
el('export-save').addEventListener('click',async()=>{
  view.setInspecting(true);
  try {await openSaveExport(JSON.stringify(data,null,2),`seedfish-save-${new Date().toISOString().slice(0,10)}.json`);}
  finally{view.setInspecting(false);}
});
async function restoreSaveText(text:string):Promise<boolean>{
  try {
    if(new Blob([text]).size>MAX_SAVE_BYTES)throw new Error('存档文件过大');
    const imported=validateSave(JSON.parse(text));
    if(!await changePopulation(imported,'存档已恢复。',true))return false;
    weatherRequest?.abort();isLoadingWeather=false;weatherStatus='';updateWeatherUI();if(data.weatherAuto)void refreshWeather();return true;
  }catch(error){const failure=error instanceof SyntaxError?new Error('存档内容不是有效的 JSON。'):error;toast(failure instanceof Error?`无法导入：${failure.message}`:'无法导入这个文件。');throw failure;}
}
el('import-save').addEventListener('click',async()=>{
  view.setInspecting(true);
  try {await openSaveImport(restoreSaveText);}
  finally{view.setInspecting(false);}
});
window.addEventListener('pagehide',()=>persist(data));
setInterval(()=>{if(data.weatherAuto&&!document.hidden)void refreshWeather();},15*60*1000);

declare global {interface Window {
  livelyPropertyListener?:(name:string,value:unknown)=>void;
  livelyWallpaperPlaybackChanged?:(raw:string)=>void;
  wallpaperPropertyListener?:{setPaused:(paused:boolean)=>void;applyGeneralProperties:(props:{fps?:number})=>void};
}}
window.livelyPropertyListener=(name,value)=>{
  if(name==='weather'&&Number(value)>=0&&Number(value)<4)setManualWeather((['sunny','cloudy','rain','snow'] as WeatherMode[])[Number(value)]);
  if(name==='names'){el<HTMLInputElement>('show-names').checked=Boolean(value);if(ready)view.showNames(Boolean(value));}
  if(name==='fps')view.setFPS(Number(value)||30);
  if(name==='quality'&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<3){performanceSettings={...performanceSettings,quality:(['economy','balanced','fine'] as PondQuality[])[Number(value)]};applyPerformanceSettings();}
  if(name==='adaptive'){performanceSettings={...performanceSettings,adaptive:Boolean(value)};applyPerformanceSettings();}
  if(name==='immersive')setImmersion(Boolean(value));
};
window.livelyWallpaperPlaybackChanged=raw=>{try{const value=JSON.parse(raw);view.setPaused(Boolean(value.IsPaused));}catch{/* Invalid host message is ignored. */}};
window.wallpaperPropertyListener={setPaused:paused=>{view.setPaused(paused);},applyGeneralProperties:props=>{if(props.fps)view.setFPS(props.fps);}};

renderFish();renderCounts();renderLibrary();updateWeatherUI();
view=new PondView(el('pond'),data.fish);
view.setPerformance(performanceSettings);view.setSeason(sceneSettings.season,data.city?.latitude??30);view.setLighting(data.lightingMode,data.city?data.reading:null);view.setWeather(data.weatherMode,data.weatherAuto?data.reading:null);view.setInteraction(sceneSettings.interaction);updatePerformanceUI();updateInteractionUI();updateSeasonUI();
view.simulation.onEat=()=>{renderCounts();save();};
view.onFeed=()=>{el('total-eaten').textContent='投下 6 粒饲料，等它们慢慢游过来。';};
view.onFishSelect=fish=>showFishInfo(fish?.id??null);
view.init().then(async()=>{
  for(const [kind,png] of view.getThumbnails())thumbnails.set(kind,png);
  ready=true;renderFish();renderCounts();renderLibrary();el('loading').hidden=true;app.dataset.ready='true';updateWeatherUI();view.showNames(el<HTMLInputElement>('show-names').checked);
  if(loaded.warning)toast(loaded.warning);if(data.weatherAuto)void refreshWeather();
}).catch(error=>{console.error('Pond initialization failed:',error);const message=error instanceof Error?error.message:String(error),network=/fetch|load|network/i.test(message);el('loading').textContent=network?'池塘资源暂时未能加载。请确认本地预览已启动，再重新载入。':'动态画面暂时未能启动。请重试；若仍失败，可检查浏览器硬件加速。';const retry=document.createElement('button');retry.className='loading-retry';retry.textContent='重新载入池塘';retry.addEventListener('click',()=>location.reload());el('loading').appendChild(retry);el('loading').classList.add('error');});
