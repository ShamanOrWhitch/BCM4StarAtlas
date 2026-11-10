#!/usr/bin/env python3
"""Сборка phi_demo.html: three r128 + GLTFLoader (из chi_demo.html), phi_controls.js,
phi_panel.js и rainbow_phi.glb (base64) — автономная демка без сети."""
import base64, re, pathlib

P = pathlib.Path(__file__).resolve().parent
chi = pathlib.Path('/home/user/chi_v4/chi_demo.html').read_text(encoding='utf-8')
blocks = re.findall(r'<script>([\s\S]*?)</script>', chi)
three = next(b for b in blocks if 'REVISION' in b and 'WebGLRenderer' in b and '!function(t,e)' in b)
loader = next(b for b in blocks if 'class GLTFLoader' in b)
controls = (P / 'phi_controls.js').read_text(encoding='utf-8')
panel = (P / 'phi_panel.js').read_text(encoding='utf-8')
glb = base64.b64encode((P / 'rainbow_phi.glb').read_bytes()).decode()

app = r"""
(function(){
var status=document.getElementById('status');
var scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1420);
scene.fog=new THREE.Fog(0x0d1420,9000,26000);
var camera=new THREE.PerspectiveCamera(38,innerWidth/(innerHeight-56),5.0,40000);
camera.position.set(-3600,2300,3200);camera.lookAt(0,200,0);      // корпус в кадре
var renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){status.textContent='WebGL не запустился: '+e.message;return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight-56);
document.body.appendChild(renderer.domElement);

/* свет нужен только шейдерному режиму, CPU-путь рисует unlit */
var amb=new THREE.AmbientLight(0x33435c,0.9);scene.add(amb);
var sun=new THREE.DirectionalLight(0xffe6c0,1.15);sun.position.set(-4000,6000,3400);scene.add(sun);
var fill=new THREE.DirectionalLight(0x6f8fb8,0.45);fill.position.set(4000,-1500,-2800);scene.add(fill);

var ship=null,rig=null,panel=null;
var GLB=atob("__GLB__");
var bytes=new Uint8Array(GLB.length);for(var i=0;i<GLB.length;i++)bytes[i]=GLB.charCodeAt(i);
new THREE.GLTFLoader().parse(bytes.buffer,'',function(g){
  ship=g.scene;scene.add(ship);
  try{
    rig=createPhiControls(ship);
    rig.setEnvironment(scene.background);
    rig.setChameleon(0.6);rig.setFlow(1.0);rig.setHue(0);rig.setLevitation(0.7);
    rig.setCamouflage(0.30);rig.setMetalTint(1.0);rig.setSilver(0.20);rig.setEngines(true);
    rig.update(0.01,camera);
    panel=createPhiPanel(rig,{top:12,left:12,initial:{setChameleon:0.6,setCamouflage:0.35,
      setMetalTint:1.0,setSilver:0.20,setLevitation:0.7,setFlow:1.0,setHue:0}});
    status.textContent='Rainbow Phi · Titan · 3236×2863×1583 м · 255 экипаж · Photoli light levitation · режимы: крейсер (собран) / левитация / щит / ирис / разборка';
  }catch(e){status.textContent='Ошибка: '+e.message;}
},function(e){status.textContent='Ошибка GLB: '+e;});

var drag=false,lastX=0,lastY=0,yaw=2.42,pitch=0.34,dist=5200;
function place(){
  camera.position.set(Math.cos(yaw)*Math.cos(pitch)*dist,
                      Math.sin(pitch)*dist+200,
                      Math.sin(yaw)*Math.cos(pitch)*dist);
  camera.lookAt(0,200,0);
}
place();
renderer.domElement.addEventListener('pointerdown',function(e){drag=true;lastX=e.clientX;lastY=e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',function(e){if(!drag)return;
  yaw-=(e.clientX-lastX)*0.006;pitch=Math.max(-0.2,Math.min(1.1,pitch+(e.clientY-lastY)*0.005));
  lastX=e.clientX;lastY=e.clientY;place();});
renderer.domElement.addEventListener('pointerup',function(){drag=false;});
renderer.domElement.addEventListener('wheel',function(e){e.preventDefault();
  dist=Math.max(1400,Math.min(14000,dist+e.deltaY*6));place();},{passive:false});
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
<title>Rainbow Phi — Titan, Photoli light levitation</title>
<style>html,body{{margin:0;background:#0d1420;overflow:hidden;font:13px system-ui,sans-serif}}
#status{{height:56px;line-height:56px;text-align:center;color:#9fb4cc;padding:0 12px}}</style>
</head><body><div id="status">загрузка rainbow_phi.glb…</div>
<script>{three}</script>
<script>{loader}</script>
<script>{controls}</script>
<script>{panel}</script>
<script>{app}</script>
</body></html>
"""
(P / 'phi_demo.html').write_text(out, encoding='utf-8')
print('phi_demo.html bytes', len(out.encode('utf-8')))
