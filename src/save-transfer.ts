import './save-transfer.css';

export const MAX_SAVE_BYTES = 100000;

function createTransfer(title:string,note:string,readonly:boolean){
  const dialog=document.createElement('dialog');dialog.className='save-transfer';dialog.setAttribute('aria-label',title);
  dialog.innerHTML=`<div class="save-transfer-heading"><h2></h2><button type="button" class="icon-button" aria-label="关闭存档对话框">×</button></div><p class="save-transfer-note"></p><label for="save-transfer-text">${readonly?'完整存档备份':'存档内容'}</label><textarea id="save-transfer-text" spellcheck="false" ${readonly?'readonly':'maxlength="100000" placeholder="在这里粘贴完整备份，或选择 JSON 文件。"'}></textarea><div class="save-transfer-actions"></div><p class="save-transfer-status" role="status" aria-live="polite"></p>`;
  dialog.querySelector('h2')!.textContent=title;dialog.querySelector('.save-transfer-note')!.textContent=note;
  const text=dialog.querySelector<HTMLTextAreaElement>('textarea')!,actions=dialog.querySelector<HTMLDivElement>('.save-transfer-actions')!,status=dialog.querySelector<HTMLParagraphElement>('.save-transfer-status')!,close=dialog.querySelector<HTMLButtonElement>('.save-transfer-heading button')!;
  let busy=false;
  const done=new Promise<void>(resolve=>dialog.addEventListener('close',()=>{dialog.remove();resolve();},{once:true}));
  close.addEventListener('click',()=>{if(!busy)dialog.close();});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  // Keep pond shortcuts from responding while the text dialog owns the keyboard.
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  const setBusy=(value:boolean)=>{busy=value;close.disabled=value;text.readOnly=readonly||value;actions.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=value);};
  const button=(label:string)=>{const element=document.createElement('button');element.type='button';element.textContent=label;actions.appendChild(element);return element;};
  const show=()=>{document.body.appendChild(dialog);dialog.showModal();};
  return {dialog,text,status,button,setBusy,show,done};
}

export function openSaveExport(json:string,filename:string):Promise<void>{
  const ui=createTransfer('备份池塘','保留鱼儿、暂养区、名字、性格、进食记录和天气设置。复制备份后，可在另一个池塘的“导入存档”中粘贴恢复。',true);
  ui.text.value=json;
  ui.button('下载 JSON').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download=filename;link.hidden=true;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
    ui.status.textContent='已尝试下载 JSON；如果当前环境不支持下载，请使用“复制备份”。';
  });
  ui.button('复制备份').addEventListener('click',async()=>{
    try {
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard is unavailable');
      await navigator.clipboard.writeText(json);
      if(ui.dialog.open)ui.status.textContent='备份已复制。请粘贴到文本文件保存，或粘贴到另一个池塘的“导入存档”。';
    }catch{
      if(!ui.dialog.open)return;ui.text.focus();ui.text.select();ui.status.textContent='自动复制不可用，已选中全部备份。请按 Ctrl+C 复制，再粘贴保存。';
    }
  });
  ui.show();return ui.done;
}

export function openSaveImport(restore:(text:string)=>Promise<boolean>):Promise<void>{
  const ui=createTransfer('恢复池塘','选择 JSON 文件或粘贴备份。点击“恢复存档”会替换当前鱼儿、暂养区和天气设置；建议先备份。关闭窗口不会恢复。',false);
  const file=document.createElement('input');file.type='file';file.accept='application/json,.json';file.hidden=true;ui.dialog.appendChild(file);
  ui.button('选择 JSON 文件').addEventListener('click',()=>file.click());
  const restoreButton=ui.button('恢复存档');restoreButton.classList.add('save-transfer-primary');
  let loading=false,fileSequence=0;
  const syncButton=()=>{restoreButton.disabled=loading||!ui.text.value.trim();};
  ui.text.addEventListener('input',syncButton);
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;
    const sequence=++fileSequence;loading=true;ui.text.value='';syncButton();ui.status.textContent='正在读取存档文件…';
    try {
      if(selected.size>MAX_SAVE_BYTES)throw new Error('存档文件过大，最多 100 KB。');
      const text=await selected.text();if(!ui.dialog.open||sequence!==fileSequence)return;
      ui.text.value=text;syncButton();ui.status.textContent='文件已载入。确认后点击“恢复存档”，当前池塘尚未改变。';
    }catch(error){if(ui.dialog.open&&sequence===fileSequence)ui.status.textContent=`无法读取：${error instanceof Error?error.message:'请选择 JSON 存档文件。'}`;}
    finally{file.value='';if(sequence===fileSequence){loading=false;syncButton();}}
  });
  restoreButton.addEventListener('click',async()=>{
    ui.setBusy(true);ui.status.textContent='正在恢复池塘…';
    try {
      if(await restore(ui.text.value)){ui.dialog.close();return;}
      ui.status.textContent='暂时无法恢复，请待池塘准备好后重试。';
    }catch(error){ui.status.textContent=`无法导入：${error instanceof Error?error.message:'存档格式不正确。'}`;}
    finally{ui.setBusy(false);syncButton();}
  });
  ui.show();syncButton();return ui.done;
}
