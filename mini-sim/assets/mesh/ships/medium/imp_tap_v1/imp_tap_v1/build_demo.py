#!/usr/bin/env python3
"""Сборка imp_demo.html: three r128 + GLTFLoader (из chi_demo.html), imp_controls.js,
imp_panel.js и imp_tap.glb (base64) — автономная демка без сети."""
import base64, re, pathlib

P = pathlib.Path(__file__).resolve().parent
chi = pathlib.Path('/home/user/chi_v4/chi_demo.html').read_text(encoding='utf-8')
blocks = re.findall(r'<script>([\s\S]*?)</script>', chi)
three = next(b for b in blocks if 'REVISION' in b and 'WebGLRenderer' in b and '!function(t,e)' in b)
loader = next(b for b in blocks if 'class GLTFLoader' in b)
controls = (P / 'imp_controls.js').read_text(encoding='utf-8')
panel = (P / 'imp_panel.js').read_text(encoding='utf-8')
glb = base64.b64encode((P / 'imp_tap.glb').read_bytes()).decode()

app = r"""
(function(){
var status=document.getElementById('status');
var scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1420);
scene.fog=new THREE.Fog(0x0d1420,260,900);
var camera=new THREE.PerspectiveCamera(40,innerWidth/(innerHeight-56),0.5,4000);
camera.position.set(-78,38,66);camera.lookAt(0,8,0);        // корабль 48 м в кадре
var renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){status.textContent='WebGL не запустился: '+e.message;return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight-56);
document.body.appendChild(renderer.domElement);

/* земля-«площадка»: чтобы посадка читалась */
var grid=new THREE.GridHelper(400,40,0x2a3444,0x1a2230);grid.position.y=0;scene.add(grid);

/* свет нужен только шейдерному режиму, CPU-путь рисует unlit */
scene.add(new THREE.AmbientLight(0x3a4a62,0.95));
var sun=new THREE.DirectionalLight(0xffe2b8,1.2);sun.position.set(-70,110,60);scene.add(sun);
var fill=new THREE.DirectionalLight(0x6f8fb8,0.5);fill.position.set(70,-30,-60);scene.add(fill);

var ship=null,rig=null,panel=null;
var GLB=atob("__GLB__");
var bytes=new Uint8Array(GLB.length);for(var i=0;i<GLB.length;i++)bytes[i]=GLB.charCodeAt(i);
new THREE.GLTFLoader().parse(bytes.buffer,'',function(g){
  ship=g.scene;scene.add(ship);
  try{
    rig=createImpTapControls(ship);
    rig.setMode('landed');
    rig.update(0.01,camera);
    panel=createImpTapPanel(rig,{top:12,left:12});
    status.textContent='Armstrong IMP Tap · Miner · Rare · 47.8×48.5×19 м · 6 лап, 3 буровых барабана, 6 дюз · режимы: посадка / добыча / полёт / переход';
  }catch(e){status.textContent='Ошибка: '+e.message;}
},function(e){status.textContent='Ошибка GLB: '+e;});

var drag=false,lastX=0,lastY=0,yaw=-2.28,pitch=0.30,dist=132;
function place(){
  camera.position.set(Math.cos(yaw)*Math.cos(pitch)*dist,
                      Math.sin(pitch)*dist+8,
                      Math.sin(yaw)*Math.cos(pitch)*dist);
  camera.lookAt(0,8,0);
}
place();
renderer.domElement.addEventListener('pointerdown',function(e){drag=true;lastX=e.clientX;lastY=e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',function(e){if(!drag)return;
  yaw-=(e.clientX-lastX)*0.006;pitch=Math.max(-0.15,Math.min(1.2,pitch+(e.clientY-lastY)*0.005));
  lastX=e.clientX;lastY=e.clientY;place();});
renderer.domElement.addEventListener('pointerup',function(){drag=false;});
renderer.domElement.addEventListener('wheel',function(e){e.preventDefault();
  dist=Math.max(55,Math.min(420,dist+e.deltaY*0.18));place();},{passive:false});
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
<title>Armstrong IMP Tap — средний шахтёрский корабль</title>
<style>html,body{{margin:0;background:#0d1420;overflow:hidden;font:13px system-ui,sans-serif}}
#status{{height:56px;line-height:56px;text-align:center;color:#9fb4cc;padding:0 12px}}</style>
</head><body><div id="status">загрузка imp_tap.glb…</div>
<script>{three}</script>
<script>{loader}</script>
<script>{controls}</script>
<script>{panel}</script>
<script>{app}</script>
</body></html>
"""
(P / 'imp_demo.html').write_text(out, encoding='utf-8')
print('imp_demo.html bytes', len(out.encode('utf-8')))
