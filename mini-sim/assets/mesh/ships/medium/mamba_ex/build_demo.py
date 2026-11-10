#!/usr/bin/env python3
"""Сборка fimbul_mamba_ex_demo.html: three r128 + GLTFLoader (из chi_demo.html),
fimbul_mamba_ex_controls.js, fimbul_mamba_ex_panel.js и fimbul_mamba_ex.glb (base64) —
автономная демка без сети."""
import base64, re, pathlib

P = pathlib.Path(__file__).resolve().parent
chi = pathlib.Path('/home/user/chi_v4/chi_demo.html').read_text(encoding='utf-8')
blocks = re.findall(r'<script>([\s\S]*?)</script>', chi)
three = next(b for b in blocks if 'REVISION' in b and 'WebGLRenderer' in b and '!function(t,e)' in b)
loader = next(b for b in blocks if 'class GLTFLoader' in b)
controls = (P / 'fimbul_mamba_ex_controls.js').read_text(encoding='utf-8')
panel = (P / 'fimbul_mamba_ex_panel.js').read_text(encoding='utf-8')
glb = base64.b64encode((P / 'fimbul_mamba_ex.glb').read_bytes()).decode()

app = r"""
(function(){
var status=document.getElementById('status');
var scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1420);
scene.fog=new THREE.Fog(0x0c1018,320,1200);
var camera=new THREE.PerspectiveCamera(40,innerWidth/(innerHeight-56),0.3,4000);
camera.position.set(-56,22,44);camera.lookAt(0,4.6,0);   // корабль 38 м в кадре
var renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){status.textContent='WebGL не запустился: '+e.message;return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight-56);
document.body.appendChild(renderer.domElement);

/* площадка: чтобы посадка на шесть стоек читалась */
var grid=new THREE.GridHelper(300,30,0x28313d,0x1a222c);grid.position.y=-0.05;scene.add(grid);
var padm=new THREE.Mesh(new THREE.CircleGeometry(26,48),
  new THREE.MeshBasicMaterial({color:0x18202a,transparent:true,opacity:0.85}));
padm.rotation.x=-Math.PI/2;padm.position.y=-0.12;scene.add(padm);

/* свет нужен только шейдерному режиму, CPU-путь рисует unlit */
scene.add(new THREE.AmbientLight(0x3a4a62,0.95));
var sun=new THREE.DirectionalLight(0xffe6c4,1.25);sun.position.set(-80,120,62);scene.add(sun);
var fill=new THREE.DirectionalLight(0x6f8fb8,0.55);fill.position.set(110,-45,-90);scene.add(fill);

var ship=null,rig=null,panel=null;
var GLB=atob("__GLB__");
var bytes=new Uint8Array(GLB.length);for(var i=0;i<GLB.length;i++)bytes[i]=GLB.charCodeAt(i);
new THREE.GLTFLoader().parse(bytes.buffer,'',function(g){
  ship=g.scene;scene.add(ship);
  try{
    rig=createFimbulMambaControls(ship);
    rig.setMode('pad');
    rig.update(0.01,camera);
    panel=createFimbulMambaPanel(rig,{top:12,left:12});
    status.textContent='Fimbul Mamba EX · Epic · 40\u00D724\u00D79 м (крылья-турбины шире, чем у обычной Mamba) · экипаж 5 · 4 fixed hardpoint, 2 турели, ракетный отсек, 3 контрмеры, Drone Port, Tractor Beam, аппарель · режимы: палуба / полёт / охота / погрузка';
  }catch(e){status.textContent='Ошибка: '+e.message;}
},function(e){status.textContent='Ошибка GLB: '+e;});

var drag=false,lastX=0,lastY=0,yaw=-1.06,pitch=0.24,dist=84;
function place(){
  camera.position.set(Math.cos(yaw)*Math.cos(pitch)*dist,
                      Math.sin(pitch)*dist+5,
                      Math.sin(yaw)*Math.cos(pitch)*dist);
  camera.lookAt(0,4.6,0);
}
place();
renderer.domElement.addEventListener('pointerdown',function(e){drag=true;lastX=e.clientX;lastY=e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',function(e){if(!drag)return;
  yaw-=(e.clientX-lastX)*0.006;pitch=Math.max(-0.35,Math.min(1.25,pitch+(e.clientY-lastY)*0.005));
  lastX=e.clientX;lastY=e.clientY;place();});
renderer.domElement.addEventListener('pointerup',function(){drag=false;});
renderer.domElement.addEventListener('wheel',function(e){e.preventDefault();
  dist=Math.max(28,Math.min(300,dist+e.deltaY*0.12));place();},{passive:false});
var clock=new THREE.Clock();
function frame(){requestAnimationFrame(frame);
  if(rig)rig.update(clock.getElapsedTime(),camera);
  renderer.render(scene,camera);}
frame();
addEventListener('resize',function(){camera.aspect=innerWidth/(innerHeight-56);camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight-56);});
})();
""".replace('__GLB__', glb)

out = f"""<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fimbul Mamba EX — эпический охотник</title>
<style>html,body{{margin:0;background:#0d1420;overflow:hidden;font:13px system-ui,sans-serif}}
#status{{height:56px;line-height:56px;text-align:center;color:#9fb4cc;padding:0 12px}}</style>
</head><body><div id="status">загрузка fimbul_mamba_ex.glb…</div>
<script>{three}</script>
<script>{loader}</script>
<script>{controls}</script>
<script>{panel}</script>
<script>{app}</script>
</body></html>
"""
(P / 'fimbul_mamba_ex_demo.html').write_text(out, encoding='utf-8')
print('fimbul_mamba_ex_demo.html bytes', len(out.encode('utf-8')))
