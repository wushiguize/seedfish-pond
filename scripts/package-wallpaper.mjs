import {build} from 'vite';
import {mkdir, writeFile, copyFile, readFile, rename, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'output/wallpaper');
await build({
  configFile: false, root, base: './', publicDir: false,
  build: {
    outDir: out, emptyOutDir: true, target: 'es2022',
    lib: {entry: resolve(root, 'src/pond-main.ts'), name: 'Seedfish', formats: ['iife'], fileName: () => 'seedfish.js', cssFileName: 'seedfish'},
    rollupOptions: {output: {inlineDynamicImports: true}},
  },
});
await mkdir(resolve(out, 'assets'), {recursive: true});
for (const name of ['lake-open-water.png', ...['spring', 'summer', 'autumn', 'winter'].map(season => `lake-season-${season}-v6.png`)]) {
  await copyFile(resolve(root, 'public/assets', name), resolve(out, 'assets', name));
}
const cssPath = resolve(out, 'seedfish.css');
const css = await readFile(cssPath, 'utf8');
await writeFile(cssPath, css.replace(/(?:\.\.\/|\.\/|\/)assets\/lake-open-water\.png/g, './assets/lake-open-water.png'), 'utf8');
await writeFile(resolve(out, 'index.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>听池 · Seedfish</title><link rel="stylesheet" href="./seedfish.css"></head><body><div id="app"></div><script defer src="./seedfish.js"></script></body></html>', 'utf8');
await writeFile(resolve(out, 'LivelyInfo.json'), JSON.stringify({
  AppVersion: '2.0.0.0', Title: '听池 · Seedfish', Thumbnail: 'assets/lake-open-water.png', Preview: null,
  Desc: '交互小湖桌面：四季、天气、56 个鱼类品种与品系，投食、拨水和本机存档。',
  Author: 'Seedfish', License: null, Contact: null, Type: 1, FileName: 'index.html', Arguments: '--pause-event true', IsAbsolutePath: false,
}, null, 2), 'utf8');
await writeFile(resolve(out, 'LivelyProperties.json'), JSON.stringify({
  weather: {type: 'dropdown', value: 4, text: '天气', items: ['晴', '阴', '雨', '雪', '保留网页天气设置']},
  names: {type: 'checkbox', value: false, text: '显示鱼儿名字'},
  quality: {type: 'dropdown', value: 1, text: '画面品质', items: ['节能', '均衡', '精细']},
  adaptive: {type: 'checkbox', value: true, text: '自动省电'},
  fps: {type: 'slider', value: 30, min: 15, max: 60, step: 1, text: '帧率上限'},
  immersive: {type: 'checkbox', value: false, text: '沉浸模式'},
}, null, 2), 'utf8');
await copyFile(resolve(root, 'GETTING_STARTED.md'), resolve(out, '使用说明.md'));
await copyFile(resolve(root, 'THIRD_PARTY_NOTICES.txt'), resolve(out, 'THIRD_PARTY_NOTICES.txt'));
console.log(`Wallpaper folder: ${out}`);
if (process.platform === 'win32') {
  const zip = resolve(root, 'output/seedfish-lively.zip');
  const temporaryZip = resolve(root, 'output/seedfish-lively.building.zip');
  await rm(temporaryZip, {force: true});
  execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:SEEDFISH_PACKAGE_DIR,$env:SEEDFISH_PACKAGE_ZIP)'], {
    env: {...process.env, SEEDFISH_PACKAGE_DIR: out, SEEDFISH_PACKAGE_ZIP: temporaryZip}, stdio: 'inherit', windowsHide: true,
  });
  await rename(temporaryZip, zip);
  console.log(`Lively zip: ${zip}`);
} else {
  console.log('ZIP packaging uses Windows PowerShell. The output/wallpaper folder can also be imported into Lively by index.html.');
}
