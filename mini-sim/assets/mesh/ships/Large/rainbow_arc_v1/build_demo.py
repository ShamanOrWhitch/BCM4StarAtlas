#!/usr/bin/env python3
"""Сборка arc_demo.html: three r128 + GLTFLoader (из chi_demo.html), arc_controls.js,
arc_panel.js и rainbow_arc.glb (base64) — автономная демка без сети."""
import base64, re, pathlib

P = pathlib.Path(__file__).resolve().parent
chi = pathlib.Path('/home/user/chi_v4/chi_demo.html').read_text(encoding='utf-8')
blocks = re.findall(r'<script>([\s\S]*?)</script>', chi)
three = next(b for b in blocks if 'REVISION' in b and 'WebGLRenderer' in b and '!function(t,e)' in b)
loader = next(b for b in blocks if 'class GLTFLoader' in b)
controls = (P / 'arc_controls.js').read_text(encoding='utf-8')
panel = (P / 'arc_panel.js').read_text(encoding='utf-8')
glb = base64.b64encode((P / 'rainbow_arc.glb').read_bytes()).decode()

app = r"""
(function(){
var status=document.getElementById('status');
var scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1420);
scene.fog=new THREE.Fog(0x0d1420,240,620);
var camera=new THREE.PerspectiveCamera(40,innerWidth/(innerHeight-56),.5,2000);
camera.position.set(176,96,206);camera.lookAt(0,14,0);      // корпус в кадре
var renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){status.textContent='WebGL не запустился: '+e.message;return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight-56);
document.body.appendChild(renderer.domElement);

/* свет нужен только шейдерному режиму, CPU-путь рисует unlit */
var amb=new THREE.AmbientLight(0x33435c,0.9);scene.add(amb);
var sun=new THREE.DirectionalLight(0xffe6c0,1.15);sun.position.set(-160,220,140);scene.add(sun);
var fill=new THREE.DirectionalLight(0x6f8fb8,0.45);fill.position.set(180,-60,-120);scene.add(fill);

var ship=null,rig=null,panel=null;
var GLB=atob("__GLB__");
var bytes=new Uint8Array(GLB.length);for(var i=0;i<GLB.length;i++)bytes[i]=GLB.charCodeAt(i);
new THREE.GLTFLoader().parse(bytes.buffer,'',function(g){
  ship=g.scene;scene.add(ship);
  try{
    rig=createArcControls(ship);
    rig.setEnvironment(scene.background);
    rig.setChameleon(0.6);rig.setFlow(1.0);rig.setHue(0);rig.setLevitation(0.7);
    rig.setCamouflage(0.35);rig.setMetalTint(1.0);rig.setSilver(0.25);rig.setEngines(true);
    rig.update(0.01,camera);
    panel=createArcPanel(rig,{top:12,left:12,initial:{setChameleon:0.6,setCamouflage:0.35,
      setMetalTint:1.0,setSilver:0.25,setLevitation:0.7,setFlow:1.0,setHue:0}});
    status.textContent='Rainbow Arc · 130×38×30 м · Photoli light levitation · режимы: крейсер / погрузка / щит / подъём';
  }catch(e){status.textContent='Ошибка: '+e.message;}
},function(e){status.textContent='Ошибка GLB: '+e;});

var drag=false,lastX=0,lastY=0,yaw=0.62,pitch=0.28,dist=300;
function place(){
  camera.position.set(Math.cos(yaw)*Math.cos(pitch)*dist,
                      Math.sin(pitch)*dist+14,
                      Math.sin(yaw)*Math.cos(pitch)*dist);
  camera.lookAt(0,14,0);
}
place();
renderer.domElement.addEventListener('pointerdown',function(e){drag=true;lastX=e.clientX;lastY=e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',function(e){if(!drag)return;
  yaw-=(e.clientX-lastX)*0.006;pitch=Math.max(-0.2,Math.min(1.1,pitch+(e.clientY-lastY)*0.005));
  lastX=e.clientX;lastY=e.clientY;place();});
renderer.domElement.addEventListener('pointerup',function(){drag=false;});
renderer.domElement.addEventListener('wheel',function(e){e.preventDefault();
  dist=Math.max(120,Math.min(620,dist+e.deltaY*0.35));place();},{passive:false});
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
<title>Rainbow Arc — Photoli light levitation</title>
<style>html,body{{margin:0;background:#0d1420;overflow:hidden;font:13px system-ui,sans-serif}}
#status{{height:56px;line-height:56px;text-align:center;color:#9fb4cc;padding:0 12px}}</style>
</head><body><div id="status">загрузка rainbow_arc.glb…</div>
<script>{three}</script>
<script>{loader}</script>
<script>{controls}</script>
<script>{panel}</script>
<script>{app}</script>
</body></html>
"""
(P / 'arc_demo.html').write_text(out, encoding='utf-8')
print('arc_demo.html bytes', len(out.encode('utf-8')))
