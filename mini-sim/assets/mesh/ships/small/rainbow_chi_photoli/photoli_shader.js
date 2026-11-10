/* Photoli chameleon shader for Three.js r128 (WebGL1).
 * Replaces the hull material with a custom ShaderMaterial:
 * iridescent fresnel + flowing bands + specular streak.
 * Heavier than photoli_lite.js — for GPUs that handle it. */
(function (scope) {
  scope.createPhotoliShader = function (root) {
    if (typeof THREE === 'undefined') throw new Error('THREE is required');
    var hull = root.getObjectByName('photoli_hull');
    if (!hull || !hull.isMesh) throw new Error('photoli_hull mesh missing');
    var originalMaterial = hull.material;
    var uniforms = {
      uTime:      { value: 0 },
      uMorph:     { value: 0 },
      uActivity:  { value: 0 },
      uHue:       { value: 0 },
      uFlow:      { value: 1 },
      uIrid:      { value: 0.7 },
      uGloss:     { value: 0.7 }
    };
    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: [
        'uniform float uTime; uniform float uMorph; uniform float uActivity;',
        'varying vec3 vN; varying vec3 vV; varying float vU; varying vec3 vP;',
        'void main(){',
        ' float u=clamp((position.z+1.75)/3.5,0.0,1.0);',
        ' float s=sin(3.14159265*u);',
        ' vec3 p=position;',
        ' p.x*=1.0+uMorph*0.38*s;',
        ' p.y*=1.0-uMorph*0.28*s;',
        ' p.x+=uMorph*0.13*sin(6.2831853*u);',
        ' p.y+=uActivity*0.018*s*sin(uTime*1.2+u*9.0);',
        ' vec4 mv=modelViewMatrix*vec4(p,1.0);',
        ' vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz);',
        ' vU=u; vP=p;',
        ' gl_Position=projectionMatrix*mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision mediump float;',
        'uniform float uTime; uniform float uActivity; uniform float uHue;',
        'uniform float uFlow; uniform float uIrid; uniform float uGloss;',
        'varying vec3 vN; varying vec3 vV; varying float vU; varying vec3 vP;',
        'void main(){',
        ' vec3 n=normalize(vN); vec3 v=normalize(vV);',
        ' float fres=pow(1.0-clamp(abs(dot(n,v)),0.0,1.0),2.1);',
        ' float t=uTime*uFlow;',
        /* two counter-running liquid bands, like metal flowing over the hull */
        ' float bandA=sin(vP.z*4.2+vP.x*3.1-t*0.85);',
        ' float bandB=sin(vP.z*7.3-vP.y*5.2+t*0.55);',
        ' float flow=0.5+0.35*bandA+0.15*bandB;',
        /* narrow moving highlight — the "wet" streak of liquid metal */
        ' float streak=pow(max(0.0,bandA*0.5+0.5),10.0);',
        ' float phase=uHue+vU*2.2+fres*3.1+flow*1.4+t*0.10;',
        ' vec3 irid=0.5+0.5*cos(phase+vec3(0.0,2.094,4.188));',
        ' float spec=pow(max(dot(reflect(normalize(vec3(-0.35,-0.75,-0.55)),n),v),0.0),34.0);',
        ' vec3 L=normalize(vec3(0.4,0.8,0.55));',
        ' float diffuse=max(dot(n,L),0.0);',
        ' vec3 steel=vec3(0.24,0.28,0.33)+vec3(0.16)*diffuse;',
        ' vec3 c=steel;',
        ' c+=irid*uIrid*(0.045+0.20*fres+0.10*flow*uActivity);',
        ' c+=vec3(0.55)*spec*uGloss;',
        ' c+=vec3(0.30,0.36,0.40)*streak*(0.10+0.25*uActivity)*uGloss;',
        ' c+=irid*fres*fres*0.10*uIrid;',
        ' gl_FragColor=vec4(c,1.0);',
        '}'
      ].join('\n')
    });
    hull.material = material;
    function clamp01(x) { if (!Number.isFinite(x)) throw new Error('Expected finite number'); return Math.max(0, Math.min(1, x)); }
    return {
      setMorph:     function (v) { uniforms.uMorph.value = clamp01(v); },
      setActivity:  function (v) { uniforms.uActivity.value = clamp01(v); },
      setHue:       function (v) { if (!Number.isFinite(v)) throw new Error('Expected finite number'); uniforms.uHue.value = v; },
      setFlow:      function (v) { uniforms.uFlow.value = Math.max(0, Math.min(3, v)); },
      setIridescence: function (v) { uniforms.uIrid.value = clamp01(v); },
      setGloss:     function (v) { uniforms.uGloss.value = clamp01(v); },
      update:       function (seconds) { if (Number.isFinite(seconds)) uniforms.uTime.value = seconds; },
      dispose:      function () { hull.material = originalMaterial; material.dispose(); }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
