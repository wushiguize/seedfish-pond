import { AmbientLight, Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer, ACESFilmicToneMapping } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createFishOutdoorEnvironment } from './fish-outdoor-light';
import type { KoiRig } from './koi-model';
import { createFishRig } from './fish-model';
import { FISH_CATALOG } from './fish-catalog';
import type { FishKind } from './model';

export function openKoiPreview(initialKind:FishKind='kohaku'):Promise<void> {
  return new Promise((resolve,reject)=>{
    const dialog=document.createElement('dialog');dialog.className='model-preview';dialog.setAttribute('aria-label','鱼种三维模型预览');
    dialog.innerHTML=`<div class="model-heading"><div><span class="eyebrow">FISH STUDY</span><h2>从每个角度，看看它</h2></div><button class="icon-button model-close" aria-label="关闭模型预览">×</button></div><div class="model-types"><select class="fish-search model-kind" aria-label="鱼种">${FISH_CATALOG.map(f=>`<option value="${f.kind}" ${f.kind===initialKind?'selected':''}>${f.name} · ${f.tag}</option>`).join('')}</select></div><div class="model-canvas"></div><div class="model-controls"><div class="model-views" role="group" aria-label="模型视角"><button data-view="angle" aria-pressed="true">立体</button><button data-view="top" aria-pressed="false">俯视</button><button data-view="side" aria-pressed="false">侧面</button></div><label><input type="checkbox" class="model-swim" checked/>游动</label><label><input type="checkbox" class="model-clay"/>灰模</label></div><p class="model-hint">拖动旋转 · 滚轮缩放 · 可切换灰模检查鱼体与鳍尾</p><div class="model-footer"><p>依据实物照片参考制作，非实物扫描。<br/>${FISH_CATALOG.length} 个可选品种 / 品系，可导出当前模型或完整鱼库。游动由池塘实时控制。</p><div class="model-views"><button class="model-export model-export-current">导出当前 · GLB</button><button class="model-export model-export-library">导出鱼库 · GLB</button></div></div><p class="model-status" role="status" aria-live="polite"></p>`;
    document.body.appendChild(dialog);dialog.showModal();
    const host=dialog.querySelector<HTMLDivElement>('.model-canvas')!;
    let renderer:WebGLRenderer;
    try {renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}
    catch(error){dialog.remove();reject(error);return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1;host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label','可旋转的鱼儿三维模型');renderer.domElement.setAttribute('role','img');
    const scene=new Scene();scene.background=new Color('#dfe8de');
    const environment=createFishOutdoorEnvironment(renderer);
    scene.environment=environment.texture;scene.environmentIntensity=.44;
    const camera=new PerspectiveCamera(35,1,.01,50);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=1.7;controls.maxDistance=7;
    const sun=new DirectionalLight(0xfff9ed,1.55);sun.position.set(-2,3,6);
    const fill=new DirectionalLight(0xdbeefa,.55);fill.position.set(3,-3,2);
    scene.add(sun,fill,new AmbientLight(0xffffff,.42),new HemisphereLight(0xe9f0f2,0x718077,.55));
    let selectedKind=initialKind,rig:KoiRig=createFishRig(initialKind);scene.add(rig.group);
    let swim=true,clay=false,closed=false,frame=0,phase=.3,last=performance.now(),exporting=false;
    const gray=new MeshStandardMaterial({color:0x9fae9f,roughness:.62,metalness:0});
    const materials=new Map<Mesh,Mesh['material']>();
    function applyClay():void {rig.group.traverse(object=>{if(object instanceof Mesh){if(!materials.has(object))materials.set(object,object.material);object.material=clay?gray:materials.get(object)!;}});}
    function setView(view:string):void {
      camera.up.set(0,0,1);
      if(view==='top'){camera.position.set(0,0,2.9);camera.up.set(0,1,0);}
      else if(view==='side')camera.position.set(.2,-3.1,.1);
      else camera.position.set(1.55,-2.6,1.7);
      controls.target.set(-.05,0,0);controls.update();
      dialog.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
    }
    setView('angle');
    const observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(host);
    dialog.querySelector<HTMLSelectElement>('.model-kind')!.addEventListener('change',event=>{
      materials.forEach((material,mesh)=>mesh.material=material);materials.clear();scene.remove(rig.group);rig.dispose();
      selectedKind=(event.target as HTMLSelectElement).value as FishKind;
      rig=createFishRig(selectedKind);scene.add(rig.group);applyClay();
    });
    dialog.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view!)));
    dialog.querySelector<HTMLInputElement>('.model-swim')!.addEventListener('change',event=>swim=(event.target as HTMLInputElement).checked);
    dialog.querySelector<HTMLInputElement>('.model-clay')!.addEventListener('change',event=>{clay=(event.target as HTMLInputElement).checked;applyClay();});
    const exportButtons=[...dialog.querySelectorAll<HTMLButtonElement>('.model-export')],status=dialog.querySelector<HTMLElement>('.model-status')!;
    async function exportModels(library:boolean):Promise<void> {
      if(exporting)return;exporting=true;exportButtons.forEach(button=>button.disabled=true);
      const kinds=library?FISH_CATALOG.map(fish=>fish.kind):[selectedKind];
      status.textContent=`正在打包 ${kinds.length} 个鱼种模型…`;
      const exportRigs:KoiRig[]=[],collection=new Group();collection.name='Seedfish_Fish_Library';
      try {
        // Export models never enter the preview's scene: their textures remain
        // on the CPU. Normal viewing keeps only the selected model on the GPU.
        for(const [i,kind] of kinds.entries()){
          await new Promise<void>(resolve=>setTimeout(resolve,0));if(closed)return;
          const model=createFishRig(kind);model.group.position.set((i%5)*2.8,Math.floor(i/5)*1.4,0);model.group.name=kind;collection.add(model.group);exportRigs.push(model);
          status.textContent=`正在打包鱼种模型… ${i+1} / ${kinds.length}`;
        }
        const bounds=new Box3().setFromObject(collection);collection.userData={source:'Modeled from real fish photograph references; procedural materials; not a 3D scan',units:'arbitrary model units',bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},motion:'Runtime vertex deformation and independent fin transforms in fish-model.ts and koi-model.ts'};
        const binary=await new GLTFExporter().parseAsync(collection,{binary:true,onlyVisible:true});
        if(closed)return;
        if(!(binary instanceof ArrayBuffer))throw new Error('GLB export did not produce binary data');
        const url=URL.createObjectURL(new Blob([binary],{type:'model/gltf-binary'})),link=document.createElement('a');link.href=url;link.download=library?'seedfish-fish-library.glb':`seedfish-${kinds[0]}.glb`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
        status.textContent=`已导出 ${kinds.length} 个鱼种的三维模型。`;
      } catch(error){console.error('Koi GLB export failed:',error);status.textContent='导出失败，请稍后重试。';}
      finally {exportRigs.forEach(model=>model.dispose());exporting=false;exportButtons.forEach(button=>button.disabled=false);}
    }
    dialog.querySelector('.model-export-current')!.addEventListener('click',()=>void exportModels(false));
    dialog.querySelector('.model-export-library')!.addEventListener('click',()=>void exportModels(true));
    function draw(now:number):void {if(closed)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(swim&&!document.hidden)phase+=dt*3.3;rig.animate(phase,swim?30:0,0);controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);}
    frame=requestAnimationFrame(draw);
    dialog.querySelector('.model-close')!.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{if(closed)return;closed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();materials.forEach((material,mesh)=>mesh.material=material);rig.dispose();gray.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();dialog.remove();resolve();},{once:true});
  });
}
