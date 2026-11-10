/* Rainbow Chi / experimental Photoli material for Three.js r128 / WebGL 1.
 * Include after three.min.js. Call with gltf.scene. */
(function(scope){
  scope.createPhotoliControls = function(root) {
    if (typeof THREE === 'undefined') throw new Error('THREE is required');
    var hull = root.getObjectByName('photoli_hull');
    if (!hull || !hull.isMesh) throw new Error('photoli_hull mesh missing');
    var original = hull.material;
    var uniforms = {
      uTime: {value: 0}, uMorph: {value: 0}, uActivity: {value: 0}, uHue: {value: 0}
    };
    var shader = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: [
        'uniform float uTime; uniform float uMorph; uniform float uActivity;',
        'varying vec3 vNormalView; varying vec3 vView; varying float vU; varying vec3 vPos;',
        'void main(){',
        ' float u=clamp((position.z+1.75)/3.5,0.0,1.0);',
        ' float s=sin(3.14159265*u);',
        ' vec3 p=position;',
        ' p.x *= 1.0 + uMorph*0.38*s;',
        ' p.y *= 1.0 - uMorph*0.28*s;',
        ' p.x += uMorph*0.13*sin(6.2831853*u);',
        ' p.y += uActivity*0.018*s*sin(uTime*1.2+u*9.0);',
        ' vec4 mv = modelViewMatrix * vec4(p,1.0);',
        ' vNormalView=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); vU=u; vPos=p;',
        ' gl_Position=projectionMatrix*mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision mediump float;',
        'uniform float uTime; uniform float uActivity; uniform float uHue;',
        'varying vec3 vNormalView; varying vec3 vView; varying float vU; varying vec3 vPos;',
        'void main(){',
        ' vec3 n=normalize(vNormalView); vec3 v=normalize(vView);',
        ' float fres=pow(1.0-clamp(abs(dot(n,v)),0.0,1.0),2.0);',
        ' float flow=sin(vPos.z*5.0+vPos.x*4.0-uTime*0.75)*0.5+0.5;',
        ' float phase=uHue+fres*3.3+flow*.8+uTime*.10;',
        ' vec3 tint=0.5+0.5*cos(phase+vec3(0.0,2.094,4.188));',
        ' float streak=pow(max(0.0,cos(vPos.z*7.0+vPos.x*4.0-uTime*.7)),10.0);',
        ' float spec=pow(max(dot(reflect(normalize(vec3(-.3,-.7,-.6)),n),v),0.0),32.0);',
        ' float diffuse=max(dot(n,normalize(vec3(.4,.8,.6))),0.0);',
        ' vec3 steel=vec3(.26,.31,.34)+vec3(.15)*diffuse;',
        ' vec3 c=steel+tint*(.035+.14*fres)+vec3(.32,.39,.43)*streak*(.24+.18*uActivity)+vec3(.55)*spec;',
        ' gl_FragColor=vec4(c,1.0);',
        '}'
      ].join('\n')
    });
    hull.material=shader;
    function clamp(x){if(!Number.isFinite(x))throw new Error('Expected finite number');return Math.max(0,Math.min(1,x));}
    return {
      setMorph:function(v){uniforms.uMorph.value=clamp(v);},
      setActivity:function(v){uniforms.uActivity.value=clamp(v);},
      setHue:function(v){if(!Number.isFinite(v))throw new Error('Expected finite number');uniforms.uHue.value=v;},
      update:function(seconds){if(Number.isFinite(seconds)) uniforms.uTime.value=seconds;},
      dispose:function(){hull.material=original;shader.dispose();}
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
