import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uWhite: { value: 0 }, uBlur: { value: 0 },
    uVig: { value: 0.28 }, uCA: { value: 0.0001 }, uGrain: { value: 0.0 }, uAspect: { value: 1.7 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uWhite,uBlur,uVig,uCA,uGrain,uAspect; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r = length(c*vec2(uAspect,1.0));
      vec2 dir = normalize(c + vec2(1e-5));
      vec3 col;
      if(uBlur > 0.002){
        vec3 acc = vec3(0.0);
        for(int i=0;i<10;i++){ float k = float(i)/9.0; acc += texture2D(tDiffuse, vUv - c*k*uBlur*0.35).rgb; }
        col = acc/10.0;
      } else if (uCA > 0.0005) {
        float ca = uCA*r*r*6.0;
        col = vec3(texture2D(tDiffuse, vUv+dir*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv-dir*ca).b);
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
      }
      col *= 1.0 - uVig*smoothstep(0.38,1.0,r);
      if (uGrain > 0.001) {
        col += (hash(vUv*vec2(1920.0,1080.0)+uTime)-0.5)*uGrain;
      }
      col = mix(col, vec3(2.3,2.2,2.05), clamp(uWhite,0.0,1.0));
      gl_FragColor = vec4(col,1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(Math.floor(size.x / 2), Math.floor(size.y / 2)), CONFIG.bloom.strength, CONFIG.bloom.radius, CONFIG.bloom.threshold);
  composer.addPass(bloom);
  const fin = new ShaderPass(FinalShader); composer.addPass(fin);
  composer.addPass(new OutputPass());
  const u = fin.uniforms;
  return {
    composer, bloom, u,
    resize(w, h, ratio) {
      composer.setPixelRatio(ratio);
      composer.setSize(w, h);
      bloom.setSize(Math.floor(w / 2), Math.floor(h / 2));
      u.uAspect.value = w / h;
    },
    render(time) { u.uTime.value = time % 100; composer.render(); },
  };
}
