// Custom GLSL shaders: sky dome, water, lava, swaying grass, portals, waterfalls, waving flags.
import * as THREE from 'three';
import { U } from './toon.js';

const NOISE = /* glsl */ `
  float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash21(i), b = hash21(i+vec2(1.,0.)), c = hash21(i+vec2(0.,1.)), d = hash21(i+vec2(1.,1.));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++){ v += a*vnoise(p); p = p*2.03 + 7.1; a *= 0.5; }
    return v;
  }
`;

const fogU = () => THREE.UniformsLib.fog;

// ---------------------------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------------------------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uTop: { value: new THREE.Color('#3a8dde') },
      uMid: { value: new THREE.Color('#8fd3ff') },
      uBot: { value: new THREE.Color('#eaf7ff') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, -0.5).normalize() },
      uSunCol: { value: new THREE.Color('#fff2c4') },
      uClouds: { value: 0.6 },
      uStars: { value: 0 },
      uAurora: { value: 0 },
      uCloudCol: { value: new THREE.Color('#ffffff') },
      uCloudShade: { value: new THREE.Color('#b9d4f2') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w * 0.9999;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uTop, uMid, uBot, uSunDir, uSunCol, uCloudCol, uCloudShade;
      uniform float uClouds, uStars, uAurora;
      varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uBot, uMid, smoothstep(-0.08, 0.22, h));
        col = mix(col, uTop, smoothstep(0.18, 0.85, h));
        // stars
        if (uStars > 0.0 && h > 0.0) {
          vec2 sp = d.xz / (h + 0.35) * 46.0;
          vec2 g = floor(sp); vec2 f = fract(sp) - 0.5;
          float r = hash21(g);
          float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
          float star = step(0.93, r) * smoothstep(0.22, 0.0, length(f + (hash21(g + 3.1) - 0.5) * 0.5));
          col += vec3(1.0, 0.95, 0.9) * star * tw * uStars * smoothstep(0.0, 0.25, h);
        }
        // aurora ribbons
        if (uAurora > 0.0 && h > 0.05) {
          vec2 ap = d.xz / (h + 0.25);
          float w = sin(ap.x * 1.3 + uTime * 0.25 + sin(ap.y * 0.9 + uTime * 0.2) * 1.6);
          float band = smoothstep(0.55, 0.0, abs(w - 0.1 * sin(ap.y * 2.0))) * smoothstep(0.05, 0.4, h) * smoothstep(1.0, 0.45, h);
          vec3 ac = mix(vec3(0.2, 1.0, 0.6), vec3(0.6, 0.3, 1.0), smoothstep(0.1, 0.7, h + 0.2 * w));
          col += ac * band * uAurora * (0.6 + 0.4 * fbm(ap * 1.5 + uTime * 0.05));
        }
        // sun
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunCol * (smoothstep(0.9975, 0.9985, s) * 2.5 + pow(s, 14.0) * 0.28);
        // toon clouds
        if (uClouds > 0.0 && h > 0.015) {
          vec2 uv = d.xz / (h + 0.32) * 1.35 + vec2(uTime * 0.012, uTime * 0.004);
          float n = fbm(uv);
          float c = smoothstep(0.58 - uClouds * 0.16, 0.66 - uClouds * 0.12, n);
          float shade = smoothstep(0.62, 0.8, fbm(uv + vec2(0.18, -0.12)));
          vec3 cc = mix(uCloudCol, uCloudShade, shade * 0.85);
          col = mix(col, cc, c * smoothstep(0.015, 0.18, h) * 0.96);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

// ---------------------------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------------------------
export function makeWaterMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      fogU(),
      {
        uTime: U.uTime,
        uShallow: { value: new THREE.Color(o.shallow || '#64e6ff') },
        uDeep: { value: new THREE.Color(o.deep || '#1c74d8') },
        uFoam: { value: new THREE.Color(o.foam || '#ffffff') },
        uSky: { value: new THREE.Color(o.sky || '#bfe8ff') },
        uAmp: { value: o.amp ?? 0.03 },
        uScale: { value: o.scale ?? 1.0 },
        uAlpha: { value: o.alpha ?? 0.9 },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uAmp;
      varying vec2 vUv; varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        vec3 p = position;
        p.y += (sin(uv.x * 2.1 + uTime * 1.3) + sin(uv.y * 1.7 - uTime * 1.1)) * uAmp;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vWorld = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uShallow, uDeep, uFoam, uSky; uniform float uScale, uAlpha;
      varying vec2 vUv; varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${NOISE}
      float ripple(vec2 p, float t){
        float a = sin(p.x * 1.3 + t * 0.9 + sin(p.y * 0.7 + t * 0.6) * 1.2);
        float b = sin(p.y * 1.7 - t * 1.1 + sin(p.x * 0.9 - t * 0.4) * 1.5);
        float c = sin((p.x + p.y) * 0.8 + t * 0.5);
        return (a + b + c) / 3.0;
      }
      void main(){
        vec2 p = vUv * uScale;
        float r = ripple(p, uTime);
        float depthMix = 0.5 + 0.5 * ripple(p * 0.35 + 3.0, uTime * 0.5);
        depthMix = floor(depthMix * 4.0 + 0.5) / 4.0; // cel steps
        vec3 col = mix(uDeep, uShallow, depthMix);
        float line = smoothstep(0.50, 0.56, r);
        col = mix(col, uFoam, line * 0.32);
        float wob = fbm(p * 1.4 + vec2(uTime * 0.15, -uTime * 0.1));
        col = mix(col, uFoam, smoothstep(0.72, 0.78, wob) * 0.22);
        float spk = vnoise(p * 5.0 + vec2(uTime * 0.35, -uTime * 0.25));
        float sp = smoothstep(0.80, 0.88, spk) * (0.55 + 0.45 * sin(uTime * 3.2 + p.x * 5.0 + p.y * 3.0));
        col += vec3(1.0) * sp * 0.5;
        vec3 vdir = normalize(cameraPosition - vWorld);
        float f = pow(1.0 - clamp(vdir.y, 0.0, 1.0), 3.0);
        col = mix(col, uSky, f * 0.45);
        gl_FragColor = vec4(col, uAlpha);
        #include <fog_fragment>
      }`,
    transparent: true,
    fog: true,
    depthWrite: true,
  });
}

// ---------------------------------------------------------------------------------------------
// Lava
// ---------------------------------------------------------------------------------------------
export function makeLavaMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      fogU(),
      {
        uTime: U.uTime,
        uHot: { value: new THREE.Color(o.hot || '#ffd23a') },
        uMid: { value: new THREE.Color(o.mid || '#ff5a12') },
        uCrust: { value: new THREE.Color(o.crust || '#4a1410') },
        uGlow: { value: o.glow ?? 1.7 },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        vec3 p = position;
        p.y += sin(uv.x * 3.0 + uTime * 1.6) * 0.025 + sin(uv.y * 2.6 - uTime * 1.3) * 0.025;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uHot, uMid, uCrust; uniform float uGlow;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE}
      void main(){
        vec2 p = vUv * 0.55;
        float n1 = fbm(p + vec2(uTime * 0.05, uTime * 0.03));
        float n2 = fbm(p * 1.9 - vec2(uTime * 0.04, -uTime * 0.05) + n1 * 1.5);
        float cracks = 1.0 - smoothstep(0.0, 0.16, abs(n2 - 0.5));
        float blob = smoothstep(0.52, 0.62, n1);
        float heat = clamp(cracks * 0.9 + (1.0 - blob) * 0.55, 0.0, 1.0);
        heat = floor(heat * 4.0 + 0.5) / 4.0;
        vec3 col = mix(uCrust, uMid, smoothstep(0.15, 0.6, heat));
        col = mix(col, uHot, smoothstep(0.6, 1.0, heat));
        col *= mix(0.6, uGlow, heat);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
}

// ---------------------------------------------------------------------------------------------
// Swaying grass tufts (instanced)
// ---------------------------------------------------------------------------------------------
export function makeGrassMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      fogU(),
      {
        uTime: U.uTime,
        uBase: { value: new THREE.Color(o.base || '#2f8f3a') },
        uTip: { value: new THREE.Color(o.tip || '#b6f068') },
        uWind: { value: o.wind ?? 1.0 },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uWind;
      varying float vH; varying vec3 vTint;
      #include <fog_pars_vertex>
      void main(){
        vH = clamp(position.y / 0.55, 0.0, 1.0);
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float ph = uTime * 1.9 + wp.x * 0.55 + wp.z * 0.43;
        float gust = sin(uTime * 0.6 + wp.x * 0.12) * 0.5 + 0.5;
        float amp = (0.10 + 0.14 * gust) * uWind * vH * vH;
        wp.x += sin(ph) * amp;
        wp.z += cos(ph * 0.8 + 1.7) * amp * 0.7;
        vTint = instanceColor;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase; uniform vec3 uTip;
      varying float vH; varying vec3 vTint;
      #include <fog_pars_fragment>
      void main(){
        float h = floor(vH * 3.0 + 0.5) / 3.0;
        vec3 c = mix(uBase, uTip, h) * vTint;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
    side: THREE.DoubleSide,
    fog: true,
  });
}

/** A little bundle of tapered grass blades (geometry for the instanced grass). */
export function makeTuftGeometry(blades = 5, height = 0.5) {
  const pos = [];
  const idx = [];
  let n = 0;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + i * 0.7;
    const r = 0.05 + (i % 3) * 0.03;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const h = height * (0.65 + ((i * 37) % 10) / 28);
    const w = 0.045;
    const lean = 0.08 + 0.04 * (i % 2);
    const dx = Math.cos(a + 1.57) * w;
    const dz = Math.sin(a + 1.57) * w;
    const lx = Math.cos(a) * lean;
    const lz = Math.sin(a) * lean;
    pos.push(cx - dx, 0, cz - dz, cx + dx, 0, cz + dz, cx - dx * 0.6 + lx * 0.5, h * 0.55, cz - dz * 0.6 + lz * 0.5, cx + dx * 0.6 + lx * 0.5, h * 0.55, cz + dz * 0.6 + lz * 0.5, cx + lx, h, cz + lz);
    idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2, n + 2, n + 3, n + 4);
    n += 5;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Portals, waterfalls, flags
// ---------------------------------------------------------------------------------------------
export function makePortalMaterial(colorA = '#7a5cff', colorB = '#2ce6ff') {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uA: { value: new THREE.Color(colorA) },
      uB: { value: new THREE.Color(colorB) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uA, uB; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float sw = sin(a * 3.0 + r * 9.0 - uTime * 3.2) * 0.5 + 0.5;
        float sw2 = sin(a * 5.0 - r * 14.0 + uTime * 2.0) * 0.5 + 0.5;
        vec3 col = mix(uA, uB, sw) * (1.2 + sw2 * 0.9);
        col += vec3(1.0) * smoothstep(0.35, 0.0, r) * 1.4;
        float alpha = smoothstep(1.0, 0.82, r) * (0.55 + 0.45 * sw);
        gl_FragColor = vec4(col * 1.5, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

export function makeWaterfallMaterial(color = '#bfefff') {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([fogU(), { uTime: U.uTime, uColor: { value: new THREE.Color(color) } }]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE}
      void main(){
        float col = floor(vUv.x * 14.0);
        float sp = 1.4 + hash21(vec2(col, 1.0)) * 1.6;
        float s = fract(vUv.y * 3.0 - uTime * sp + hash21(vec2(col, 7.0)));
        float streak = smoothstep(0.35, 0.55, s) * (1.0 - smoothstep(0.85, 1.0, s));
        vec3 base = mix(uColor * 0.75, vec3(1.0), streak);
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(base, 0.86 * edge);
        #include <fog_fragment>
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    fog: true,
    depthWrite: false,
  });
}

export function makeFlagMaterial(map, color = '#ff4d5e') {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      fogU(),
      { uTime: U.uTime, uMap: { value: map || null }, uColor: { value: new THREE.Color(color) }, uHasMap: { value: map ? 1 : 0 } },
    ]),
    vertexShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        vec3 p = position;
        float k = uv.x;
        p.z += sin(uv.x * 7.0 - uTime * 6.5) * 0.07 * k + sin(uv.x * 3.0 - uTime * 3.0 + uv.y) * 0.04 * k;
        p.y += sin(uv.x * 5.0 - uTime * 5.0) * 0.02 * k;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uHasMap; varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){
        vec4 t = uHasMap > 0.5 ? texture2D(uMap, vUv) : vec4(0.0);
        vec3 c = mix(uColor, t.rgb, t.a);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
    side: THREE.DoubleSide,
    fog: true,
  });
}

/** Additive glowing billboard-ish material for beams, halos, flames. */
export function makeGlowSpriteMaterial(color = '#ffb347', intensity = 2.0) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uTime: U.uTime },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uI; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.-1.; float d = length(p); float a = smoothstep(1.0, 0.0, d); a = a*a; gl_FragColor = vec4(uColor * uI, a); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}
