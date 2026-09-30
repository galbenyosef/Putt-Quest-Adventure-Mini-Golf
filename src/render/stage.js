// Renderer, lights, sky and post-processing (bloom + vignette) wrapped in one object.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeSky } from './shaders.js';
import { U } from './toon.js';

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.32 }, uFlash: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') }, uDip: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmount, uFlash, uDip; uniform vec3 uTint; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.25, length(d) * 1.25);
      c.rgb *= mix(1.0 - uAmount, 1.0, v);
      c.rgb = mix(c.rgb, uTint, uFlash);
      c.rgb *= 1.0 - uDip;
      gl_FragColor = c;
    }`,
};

export class Stage {
  constructor(canvas) {
    const params = new URLSearchParams(location.search);
    this.quality = params.get('q') || 'high';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 1200);
    this.scene.add(this.camera);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.4);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.pointLights = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.PointLight('#ffa040', 0, 10, 2);
      p.visible = false;
      this.scene.add(p);
      this.pointLights.push(p);
    }

    this.sky = makeSky();
    this.scene.add(this.sky);

    // post
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.quality === 'low' ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.65, 1.02);
    const bs = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w, h) => bs(Math.max(2, w >> 1), Math.max(2, h >> 1));
    this.composer.addPass(this.bloom);
    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());
    this.bloomEnabled = this.quality !== 'low';
    this.bloom.enabled = this.bloomEnabled;

    this.course = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._w = w;
    this._h = h;
    this._dpr = window.devicePixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // world-units → pixels for GPU point sprites
    U.uPointScale.value = (h * this.pixelRatio) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
  }

  setPixelRatio(pr) {
    this.pixelRatio = pr;
    this.resize();
  }

  setBloom(on) {
    this.bloomEnabled = on;
    this.bloom.enabled = on;
  }

  applyTheme(theme, bounds) {
    const t = theme;
    const u = this.sky.material.uniforms;
    u.uTop.value.set(t.sky.top);
    u.uMid.value.set(t.sky.mid);
    u.uBot.value.set(t.sky.bottom);
    u.uSunDir.value.set(...t.sky.sun).normalize();
    u.uSunCol.value.set(t.sky.sunColor || '#fff2c4');
    u.uClouds.value = t.sky.clouds ?? 0.6;
    u.uStars.value = t.sky.stars ?? 0;
    u.uAurora.value = t.sky.aurora ?? 0;
    u.uCloudCol.value.set(t.sky.cloudCol || '#ffffff');
    u.uCloudShade.value.set(t.sky.cloudShade || '#b9d4f2');
    this.scene.fog = new THREE.Fog(t.fog.color, t.fog.near, t.fog.far);
    this.hemi.color.set(t.hemi.sky);
    this.hemi.groundColor.set(t.hemi.ground);
    this.hemi.intensity = t.hemi.intensity;
    this.sun.color.set(t.sun.color);
    this.sun.intensity = t.sun.intensity;
    this.bloom.strength = t.bloom ?? 0.5;
    this.bloom.threshold = t.bloomThreshold ?? 1.02;
    this.vignette.uniforms.uAmount.value = t.vignette ?? 0.3;
    // fit the shadow camera to the course
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const rad = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 4;
    const dir = new THREE.Vector3(...t.sun.dir).normalize();
    this.sun.position.set(cx + dir.x * 70, cy + dir.y * 70, cz + dir.z * 70);
    this.sun.target.position.set(cx, cy, cz);
    const sc = this.sun.shadow.camera;
    sc.left = -rad; sc.right = rad; sc.top = rad; sc.bottom = -rad;
    sc.near = 5; sc.far = 160;
    sc.updateProjectionMatrix();
    this.sun.shadow.needsUpdate = true;
  }

  setCourse(course) {
    if (this.course) {
      this.scene.remove(this.course.root);
      this.course.dispose();
    }
    this.course = course;
    if (course) {
      this.scene.add(course.root);
      this.applyTheme(course.theme, course.bounds);
      const defs = course.lightDefs || [];
      this.pointLights.forEach((p, i) => {
        p.visible = i < defs.length;
      });
    }
  }

  updateLights() {
    const defs = this.course?.lightDefs;
    if (!defs) return;
    for (let i = 0; i < this.pointLights.length && i < defs.length; i++) {
      const d = defs[i];
      const p = this.pointLights[i];
      p.position.set(d.x, d.y, d.z);
      p.color.set(d.color);
      p.distance = d.dist;
      p.intensity = d.cur;
    }
  }

  render() {
    if (window.innerWidth !== this._w || window.innerHeight !== this._h || window.devicePixelRatio !== this._dpr) {
      if (window.devicePixelRatio !== this._dpr) this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.5);
      this.resize();
    }
    this.sky.position.copy(this.camera.position);
    this.updateLights();
    this.composer.render();
  }
}
