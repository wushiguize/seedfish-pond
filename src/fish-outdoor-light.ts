import { BackSide, CanvasTexture, Mesh, MeshBasicMaterial, PMREMGenerator, Scene, SphereGeometry, SRGBColorSpace, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/** Broad outdoor sky reflections: no indoor luminous boxes or white bars. */
export function createFishOutdoorEnvironment(renderer:WebGLRenderer):WebGLRenderTarget {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const context=canvas.getContext('2d')!,gradient=context.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#b9cbd0');gradient.addColorStop(.34,'#e0e3dc');
  gradient.addColorStop(.50,'#d9ddd2');gradient.addColorStop(.62,'#929d91');gradient.addColorStop(1,'#596e64');
  context.fillStyle=gradient;context.fillRect(0,0,512,256);
  const sun=context.createRadialGradient(175,85,2,175,85,62);
  sun.addColorStop(0,'rgba(255,250,228,0.30)');sun.addColorStop(1,'rgba(255,250,228,0)');context.fillStyle=sun;context.fillRect(0,0,512,256);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
  const geometry=new SphereGeometry(10,32,16),material=new MeshBasicMaterial({map:texture,side:BackSide});
  const sphere=new Mesh(geometry,material);sphere.rotation.x=Math.PI/2;
  const scene=new Scene();scene.add(sphere);const pmrem=new PMREMGenerator(renderer);
  const target=pmrem.fromScene(scene,.12);pmrem.dispose();texture.dispose();geometry.dispose();material.dispose();
  return target;
}
