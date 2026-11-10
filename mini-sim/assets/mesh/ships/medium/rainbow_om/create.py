import numpy as np, trimesh as t, json, math, os
P='/home/user/rainbow_om_v1'; os.makedirs(P,exist_ok=True)
rng=np.random.default_rng(7)

# ---------- hull: 38.5 x 7.8 x 7.8, rear box 9 m, top slopes down to nose ----------
Z0,Z1=-19.25,19.25; SEAM=-10.25; SLOPE=4.35
def W(z):  # half width
    if z<=SEAM: return 3.9
    u=min(1.0,(z-SEAM)/(Z1-SEAM)); return 3.9-(3.9-0.70)*(u**1.3)
def TOP(z):
    if z<=SLOPE: return 3.9
    u=min(1.0,(z-SLOPE)/(Z1-SLOPE)); return 3.9+(-3.75-3.9)*u
def CH(z):
    h=max(0.10, TOP(z)+3.9); return min(1.10,h*0.22), min(0.90,h*0.16)
def section(z):
    w=W(z); tp=TOP(z); ct,cb=CH(z)
    return [(-w+ct,tp),(w-ct,tp),(w,tp-ct),(w,-3.9+cb),(w-cb,-3.9),
            (-w+cb,-3.9),(-w,-3.9+cb),(-w,tp-ct)]
zs=list(np.arange(Z0,SEAM,0.6))+[SEAM]
zs+=list(np.arange(SEAM,SLOPE,0.55))+[SLOPE]
zs+=list(np.arange(SLOPE,Z1,0.5))+[Z1]
zs=sorted(set(round(z,4) for z in zs))
rings=[section(z) for z in zs]; N=8; V=[];F=[]
for zi,ring in enumerate(rings):
    for p in ring: V.append([p[0],p[1],zs[zi]])
for i in range(len(zs)-1):
    for k in range(N):
        a=i*N+k; b=i*N+(k+1)%N
        F.extend([(a,b,b+N),(a,b+N,a+N)])
# caps
c_rear=[0,0,Z0]; c_nose=[0,0,Z1]
V.append(c_rear); cr=len(V)-1
V.append(c_nose); cn=len(V)-1
for k in range(1,N-1): F.append((cr,k+1,k))
off=(len(zs)-1)*N
for k in range(1,N-1): F.append((cn,off+k,off+k+1))
hull=t.Trimesh(vertices=V,faces=F,process=False); t.repair.fix_normals(hull)
assert abs(hull.bounds[1][2]-hull.bounds[0][2]-38.5)<1e-6

# ---------- belly cargo pod (module, walls embedded in hull -> one mesh) ----------
pod=[]
pod.append(t.creation.box(extents=[0.15,1.0,9.0],transform=t.transformations.translation_matrix([-2.125,-4.20,-1.0])))
pod.append(t.creation.box(extents=[0.15,1.0,9.0],transform=t.transformations.translation_matrix([ 2.125,-4.20,-1.0])))
pod.append(t.creation.box(extents=[4.4,1.0,0.15],transform=t.transformations.translation_matrix([0,-4.20, 3.425])))
pod.append(t.creation.box(extents=[4.4,1.0,0.15],transform=t.transformations.translation_matrix([0,-4.20,-5.425])))
hull=t.util.concatenate([hull]+pod); t.repair.fix_normals(hull)

# ---------- gold trim ribbons ----------
def ribbon(path,width,side):
    side=np.array(side,float); half=side*(width/2); V=[];F=[]
    for i in range(len(path)-1):
        a=np.array(path[i],float)+0.0; b=np.array(path[i+1],float)
        j=len(V)
        V += [list(a-half),list(a+half),list(b+half),list(b-half)]
        F.append((j,j+1,j+2,j+3))
    return V,F
TV=[];TF=[]
edge=np.arange(Z0+0.05,Z1-0.2,0.55)
for sgn in (-1,1):
    pl=[(sgn*(W(z)-CH(z)[0]), TOP(z)+0.02, z) for z in edge]           # top chamfer edges
    v,f=ribbon(pl,0.16,(1,0,0)); o=len(TV); TV+=v; TF+= [tuple(i+o for i in q) for q in f]
    pl=[(sgn*(W(z)-CH(z)[1]), -3.915, z) for z in edge]                 # bottom edges
    v,f=ribbon(pl,0.16,(1,0,0)); o=len(TV); TV+=v; TF+= [tuple(i+o for i in q) for q in f]
    # diagonal panel line on flank: seam-top -> slope-start-bottom
    dpath=[]
    for z in np.arange(SEAM,SLOPE,0.4):
        y=2.7+(-2.9-2.7)*((z-SEAM)/(SLOPE-SEAM))
        dpath.append((sgn*(W(z)+0.02),y,z))
    v,f=ribbon(dpath,0.15,(0,1,0)); o=len(TV); TV+=v; TF+= [tuple(i+o for i in q) for q in f]
def seam_strip(p0,p1,sd):
    a=np.array([p0[0],p0[1],SEAM]); b=np.array([p1[0],p1[1],SEAM])
    return ribbon([a,b],0.16,sd)
for (p0,p1,sd) in [((-(W(SEAM)-CH(SEAM)[0]),3.915),((W(SEAM)-CH(SEAM)[0]),3.915),(0,0,1)),
                   ((-(W(SEAM)-CH(SEAM)[1]),-3.915),((W(SEAM)-CH(SEAM)[1]),-3.915),(0,0,1)),
                   ((W(SEAM)+0.02,3.9-CH(SEAM)[0]),(W(SEAM)+0.02,-3.9+CH(SEAM)[1]),(0,0,1)),
                   ((-W(SEAM)-0.02,3.9-CH(SEAM)[0]),(-W(SEAM)-0.02,-3.9+CH(SEAM)[1]),(0,0,1))]:
    v,f=seam_strip(p0,p1,sd); o=len(TV); TV+=v; TF+=[tuple(i+o for i in q) for q in f]
# rear engine-face rim
zr=Z0-0.02
for (p0,p1,sd) in [((-(3.9-1.1),3.915),((3.9-1.1),3.915),(0,0,1)), ((-(3.9-0.9),-3.915),((3.9-0.9),-3.915),(0,0,1)),
                   ((3.915,3.9-1.1),(3.915,-3.9+0.9),(0,0,1)), ((-3.915,3.9-1.1),(-3.915,-3.9+0.9),(0,0,1))]:
    a=np.array([p0[0],p0[1],zr]); b=np.array([p1[0],p1[1],zr])
    v,f=ribbon([a,b],0.18,sd); o=len(TV); TV+=v; TF+=[tuple(i+o for i in q) for q in f]
trim=t.Trimesh(vertices=TV,faces=TF,process=False)

# ---------- engine glow strips ----------
glow=t.util.concatenate([
    t.creation.box(extents=[2.6,0.55,0.14],transform=t.transformations.translation_matrix([0,y,Z0-0.05]))
    for y in (-1.9,0.0,1.9)])

# ---------- segmented boxes for armor plates ----------
def seg_box(sx,sy,sz,nx,ny,nz):
    hx,hy,hz=sx/2,sy/2,sz/2; V=[];F=[]
    def face(origin,du,dv,n,nu,nv):
        base=len(V)
        for i in range(nu+1):
            for j in range(nv+1):
                V.append(list(np.array(origin)+du*(i/nu)+dv*(j/nv)))
        for i in range(nu):
            for j in range(nv):
                a=base+i*(nv+1)+j; b=a+nv+1
                F.append((a,b,b+1,a+1))
    face([-hx,-hy,hz],np.array([sx/nx,0,0]),np.array([0,sy/ny,0]),(0,0,1),nx,ny)
    face([ hx,-hy,-hz],np.array([-sx/nx,0,0]),np.array([0,sy/ny,0]),(0,0,-1),nx,ny)
    face([-hx,-hy,-hz],np.array([sx/nx,0,0]),np.array([0,0,sz/nz]),(0,-1,0),nx,nz)
    face([-hx, hy,-hz],np.array([sx/nx,0,0]),np.array([0,0,sz/nz]),(0,1,0),nx,nz)
    face([-hx,-hy,-hz],np.array([0,sy/ny,0]),np.array([0,0,sz/nz]),(-1,0,0),ny,nz)
    face([ hx,-hy,-hz],np.array([0,sy/ny,0]),np.array([0,0,sz/nz]),(1,0,0),ny,nz)
    m=t.Trimesh(vertices=V,faces=F,process=False); t.repair.fix_normals(m); return m
plates=[seg_box(2.0,0.28,4.6,4,1,6) for _ in range(6)]+[seg_box(0.28,3.4,5.0,1,4,6) for _ in range(2)]
ribs =[seg_box(4.0,0.22,1.9,4,1,3) for _ in range(3)]

# ---------- movement modes (same numbers go into om_controls.js) ----------
CRUISE=[[-1.2,4.05,-15.0],[1.2,4.05,-15.0],[-1.2,4.05,-9.0],[1.2,4.05,-9.0],
        [-1.2,4.05,-3.0],[1.2,4.05,-3.0],[-4.05,0.0,-15.0],[4.05,0.0,-15.0]]
RAM=[[0.0,4.05,2.0],[-1.2,4.05,-2.7],[1.2,4.05,-2.7],[-1.3,4.05,-7.4],[1.3,4.05,-7.4],
     [0.0,4.05,-12.2],[-4.05,0.0,-12.8],[4.05,0.0,-12.8]]
AFT=[[-1.2,4.05,-16.7],[1.2,4.05,-16.7],[-1.2,4.05,-11.9],[1.2,4.05,-11.9],
     [-1.2,4.05,-7.1],[1.2,4.05,-7.1],[-4.05,0.0,-16.7],[4.05,0.0,-16.7]]
OPEN=[[p[0],4.50,p[2]] for p in CRUISE[:6]]+[[-4.5,0.0,-15.0],[4.5,0.0,-15.0]]
ribs_cruise=[[0,-4.15,-4.0],[0,-4.15,-1.0],[0,-4.15,2.0]]
ribs_ram=[[0,-4.59,-4.0],[0,-4.59,-1.0],[0,-4.59,2.0]]
ribs_open=[[0,-5.35,z] for z in (-4.0,-1.0,2.0)]
MODES={'cruise':CRUISE+ribs_cruise,'ram':RAM+ribs_ram,'aft':AFT+ribs_cruise,'open':OPEN+ribs_open}

# ---------- colors ----------
def vcols(mesh):
    """per-vertex mottle colour (smooth, no per-face banding)"""
    V=mesh.vertices; Nv=mesh.vertex_normals
    out=np.zeros((len(V),3))
    dark=np.array([30,37,44.]); teal=np.array([46,92,86.]); rust=np.array([118,74,48.]); slate=np.array([52,62,72.])
    for i,(c,n) in enumerate(zip(V,Nv)):
        n1=math.sin(c[0]*0.31+c[2]*0.17+1.3)+0.6*math.sin(c[2]*0.11-c[1]*0.4)
        n2=math.sin(c[0]*0.23-c[2]*0.19+4.1)+0.6*math.sin(c[1]*0.33+c[2]*0.13)
        m_rust=max(0.0,min(1.0,(n1-0.90)*1.0))
        m_teal=max(0.0,min(1.0,(n2-0.75)*1.0))
        m_slate=max(0.0,min(1.0,(n1+n2-1.1)*0.7))
        col=dark.copy()
        col=col*(1-m_slate)+slate*m_slate
        col=col*(1-m_teal)+teal*m_teal
        col=col*(1-m_rust)+rust*m_rust
        if n[1]<-0.5: col*=0.62
        out[i]=col
    return out
def expand(mesh, vcol):
    """unshared corners keep smooth per-vertex colours from the parent mesh"""
    V=mesh.vertices[mesh.faces].reshape(-1,3)
    Nn=mesh.vertex_normals[mesh.faces].reshape(-1,3)
    F=np.arange(len(V)).reshape(-1,3)
    m=t.Trimesh(vertices=V,faces=F,process=False)
    cols=vcol[mesh.faces].reshape(-1,3)
    m.visual.vertex_colors=np.clip(np.hstack([cols,np.full((len(cols),1),255)]),0,255).astype(np.uint8)
    m.vertex_normals=Nn
    return m
# ---------- gold trim ribbons ----------
def ribbon(path,width,side):
    side=np.array(side,float); half=side*(width/2); V=[];F=[]
    for i in range(len(path)-1):
        a=np.array(path[i],float)+0.0; b=np.array(path[i+1],float)
        j=len(V)
        V += [list(a-half),list(a+half),list(b+half),list(b-half)]
        F.append((j,j+1,j+2,j+3))
    return V,F
TV=[];TF=[]
edge=np.arange(Z0+0.05,Z1-0.2,0.55)
for sgn in (-1,1):
    pl=[(sgn*(W(z)-CH(z)[0]), TOP(z)+0.02, z) for z in edge]           # top chamfer edges
    v,f=ribbon(pl,0.16,(1,0,0)); o=len(TV); TV+=v; TF+= [tuple(i+o for i in q) for q in f]
    pl=[(sgn*(W(z)-CH(z)[1]), -3.915, z) for z in edge]                 # bottom edges
    v,f=ribbon(pl,0.16,(1,0,0)); o=len(TV); TV+=v; TF+= [tuple(i+o for i in q) for q in f]
    # diagonal panel line on flank: seam-top -> slope-start-bottom
    dpath=[]
    for z in np.arange(SEAM,SLOPE,0.4):
        y=2.7+(-2.9-2.7)*((z-SEAM)/(SLOPE-SEAM))
        dpath.append((sgn*(W(z)+0.02),y,z))
    v,f=ribbon(dpath,0.15,(0,1,0)); o=len(TV); TV+=v; TF+= [tuple(i+o for i in q) for q in f]
def seam_strip(p0,p1,sd):
    a=np.array([p0[0],p0[1],SEAM]); b=np.array([p1[0],p1[1],SEAM])
    return ribbon([a,b],0.16,sd)
for (p0,p1,sd) in [((-(W(SEAM)-CH(SEAM)[0]),3.915),((W(SEAM)-CH(SEAM)[0]),3.915),(0,0,1)),
                   ((-(W(SEAM)-CH(SEAM)[1]),-3.915),((W(SEAM)-CH(SEAM)[1]),-3.915),(0,0,1)),
                   ((W(SEAM)+0.02,3.9-CH(SEAM)[0]),(W(SEAM)+0.02,-3.9+CH(SEAM)[1]),(0,0,1)),
                   ((-W(SEAM)-0.02,3.9-CH(SEAM)[0]),(-W(SEAM)-0.02,-3.9+CH(SEAM)[1]),(0,0,1))]:
    v,f=seam_strip(p0,p1,sd); o=len(TV); TV+=v; TF+=[tuple(i+o for i in q) for q in f]
# rear engine-face rim
zr=Z0-0.02
for (p0,p1,sd) in [((-(3.9-1.1),3.915),((3.9-1.1),3.915),(0,0,1)), ((-(3.9-0.9),-3.915),((3.9-0.9),-3.915),(0,0,1)),
                   ((3.915,3.9-1.1),(3.915,-3.9+0.9),(0,0,1)), ((-3.915,3.9-1.1),(-3.915,-3.9+0.9),(0,0,1))]:
    a=np.array([p0[0],p0[1],zr]); b=np.array([p1[0],p1[1],zr])
    v,f=ribbon([a,b],0.18,sd); o=len(TV); TV+=v; TF+=[tuple(i+o for i in q) for q in f]
trim=t.Trimesh(vertices=TV,faces=TF,process=False)

# ---------- engine glow strips ----------
glow=t.util.concatenate([
    t.creation.box(extents=[2.6,0.55,0.14],transform=t.transformations.translation_matrix([0,y,Z0-0.05]))
    for y in (-1.9,0.0,1.9)])

# ---------- segmented boxes for armor plates ----------
def seg_box(sx,sy,sz,nx,ny,nz):
    hx,hy,hz=sx/2,sy/2,sz/2; V=[];F=[]
    def face(origin,du,dv,n,nu,nv):
        base=len(V)
        for i in range(nu+1):
            for j in range(nv+1):
                V.append(list(np.array(origin)+du*(i/nu)+dv*(j/nv)))
        for i in range(nu):
            for j in range(nv):
                a=base+i*(nv+1)+j; b=a+nv+1
                F.append((a,b,b+1,a+1))
    face([-hx,-hy,hz],np.array([sx/nx,0,0]),np.array([0,sy/ny,0]),(0,0,1),nx,ny)
    face([ hx,-hy,-hz],np.array([-sx/nx,0,0]),np.array([0,sy/ny,0]),(0,0,-1),nx,ny)
    face([-hx,-hy,-hz],np.array([sx/nx,0,0]),np.array([0,0,sz/nz]),(0,-1,0),nx,nz)
    face([-hx, hy,-hz],np.array([sx/nx,0,0]),np.array([0,0,sz/nz]),(0,1,0),nx,nz)
    face([-hx,-hy,-hz],np.array([0,sy/ny,0]),np.array([0,0,sz/nz]),(-1,0,0),ny,nz)
    face([ hx,-hy,-hz],np.array([0,sy/ny,0]),np.array([0,0,sz/nz]),(1,0,0),ny,nz)
    m=t.Trimesh(vertices=V,faces=F,process=False); t.repair.fix_normals(m); return m
plates=[seg_box(2.0,0.28,4.6,4,1,6) for _ in range(6)]+[seg_box(0.28,3.4,5.0,1,4,6) for _ in range(2)]
ribs =[seg_box(4.0,0.22,1.9,4,1,3) for _ in range(3)]

# ---------- movement modes (same numbers go into om_controls.js) ----------
CRUISE=[[-1.2,4.05,-15.0],[1.2,4.05,-15.0],[-1.2,4.05,-9.0],[1.2,4.05,-9.0],
        [-1.2,4.05,-3.0],[1.2,4.05,-3.0],[-4.05,0.0,-15.0],[4.05,0.0,-15.0]]
RAM=[[0.0,4.05,2.0],[-1.2,4.05,-2.7],[1.2,4.05,-2.7],[-1.3,4.05,-7.4],[1.3,4.05,-7.4],
     [0.0,4.05,-12.2],[-4.05,0.0,-12.8],[4.05,0.0,-12.8]]
AFT=[[-1.2,4.05,-16.7],[1.2,4.05,-16.7],[-1.2,4.05,-11.9],[1.2,4.05,-11.9],
     [-1.2,4.05,-7.1],[1.2,4.05,-7.1],[-4.05,0.0,-16.7],[4.05,0.0,-16.7]]
OPEN=[[p[0],4.50,p[2]] for p in CRUISE[:6]]+[[-4.5,0.0,-15.0],[4.5,0.0,-15.0]]
ribs_cruise=[[0,-4.15,-4.0],[0,-4.15,-1.0],[0,-4.15,2.0]]
ribs_ram=[[0,-4.59,-4.0],[0,-4.59,-1.0],[0,-4.59,2.0]]
ribs_open=[[0,-5.35,z] for z in (-4.0,-1.0,2.0)]
MODES={'cruise':CRUISE+ribs_cruise,'ram':RAM+ribs_ram,'aft':AFT+ribs_cruise,'open':OPEN+ribs_open}

# ---------- colors ----------
hull_m=expand(hull,vcols(hull))
trim_m=expand(trim,np.tile([255,188,96],(len(trim.vertices),1)))
glow_m=expand(glow,np.tile([120,235,255],(len(glow.vertices),1)))
plate_ms=[]
for pl in plates:
    base=np.tile([58,68,78],(len(pl.vertices),1))
    jitter=rng.normal(0,4,(len(pl.vertices),1))
    plate_ms.append(expand(pl,np.clip(base+jitter,0,255)))
rib_ms=[]
for rb in ribs:
    base=np.tile([30,34,40],(len(rb.vertices),1))
    jitter=rng.normal(0,3,(len(rb.vertices),1))
    rib_ms.append(expand(rb,np.clip(base+jitter,0,255)))
print('hull tris',len(hull.faces),'trim',len(trim.faces))

# ---------- export ----------
scene=t.Scene()
scene.add_geometry(hull_m,node_name='hull',geom_name='hull_g')
scene.add_geometry(trim_m,node_name='trim',geom_name='trim_g')
scene.add_geometry(glow_m,node_name='engine_glow',geom_name='glow_g')
for i,m in enumerate(plate_ms): scene.add_geometry(m,node_name=f'armor_{i}',geom_name=f'armor_{i}_g')
for i,m in enumerate(rib_ms):   scene.add_geometry(m,node_name=f'rib_{i}',geom_name=f'rib_{i}_g')
scene.export(P+'/rainbow_om.glb')

# ---------- om_controls.js (positions embedded from this file) ----------
JS = """/* Rainbow Om armor controller — Three.js r128, CPU only, no custom shaders.
 * Heavy photoli slabs slide across the hull by "thought":
 *   cruise — plates spread over the deck
 *   ram    — armor converges toward the nose, bay ribs seal the cargo slot
 *   aft    — plates cluster over the engines
 *   open   — plates lift off the hull, ribs drop from the belly pod
 * Plus CPU shimmer (vertex colours) on hull/plates/ribs: no GPU required. */
(function (scope) {
  var MODES = __MODES__;
  scope.createOmControls = function (root, opts) {
    opts = opts || {};
    if (typeof THREE === 'undefined') throw new Error('THREE is required');
    var hull = root.getObjectByName('hull');
    var trim = root.getObjectByName('trim');
    var glow = root.getObjectByName('engine_glow');
    var plates = [], ribs = [], i;
    for (i = 0; i < 8; i++) { var p = root.getObjectByName('armor_' + i); if (p) plates.push(p); }
    for (i = 0; i < 3; i++) { var r = root.getObjectByName('rib_' + i); if (r) ribs.push(r); }
    if (!hull || !trim || !glow || plates.length !== 8 || ribs.length !== 3)
      throw new Error('rainbow_om nodes missing');
    /* unlit vertex-coloured materials: visible without scene lights, cheapest path */
    var prevTrimM = trim.material, prevGlowM = glow.material;
    trim.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    glow.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    var nodes = plates.concat(ribs);
    var target = MODES.cruise.map(function (a) { return new THREE.Vector3(a[0], a[1], a[2]); });
    var mode = 'cruise', lastT = -Infinity, lastPaint = -Infinity;
    var shimmerMeshes = [hull].concat(plates, ribs);
    var material = new THREE.MeshBasicMaterial({ vertexColors: true });
    var data = shimmerMeshes.map(function (m) {
      var g = m.geometry.clone();
      var src = g.getAttribute('color');
      var n = g.getAttribute('position').count;
      var base = new Float32Array(n * 4);
      if (src) {
        var raw = src.array, isz = src.itemSize, mx = 0, k;
        for (k = 0; k < raw.length; k++) if (raw[k] > mx) mx = raw[k];
        var scale = mx > 1.5 ? 1 / 255 : 1;
        for (k = 0; k < n; k++)
          for (var c = 0; c < 4; c++)
            base[k * 4 + c] = (c < isz ? raw[k * isz + c] : 255) * scale;
      } else {
        for (k = 0; k < n; k++) { base[k*4] = 0.16; base[k*4+1] = 0.18; base[k*4+2] = 0.21; base[k*4+3] = 1; }
      }
      var arr = new Float32Array(base);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 4));
      var prevG = m.geometry, prevM = m.material;
      m.geometry = g; m.material = material;
      return { mesh: m, geo: g, base: base, arr: arr, attr: g.getAttribute('color'),
               prevG: prevG, prevM: prevM, pos: g.getAttribute('position') };
    });
    var shimmer = 0.6, flow = 1.0, hue = 0.0;
    function clamp01(v) { if (!Number.isFinite(v)) throw new Error('Expected finite number'); return Math.max(0, Math.min(1, v)); }
    function lerp(dt) {
      var k = 1 - Math.exp(-dt * 5);
      for (var i = 0; i < nodes.length; i++) nodes[i].position.lerp(target[i], k);
    }
    function paint(time) {
      var irid = shimmer * 0.10;
      for (var m = 0; m < data.length; m++) {
        var d = data[m], pos = d.pos, base = d.base, arr = d.arr;
        for (var i = 0, n = pos.count; i < n; i++) {
          var k = i * 4, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          var band = Math.pow(Math.max(0, Math.sin(z * 0.55 + x * 0.4 + y * 0.3 - time * flow * 0.8)), 6);
          var ph = hue + (z + x) * 0.25 + time * 0.3;
          var g0 = shimmer * 0.35 * band;
          var r = base[k] * (0.82 + g0) + irid * (0.5 + 0.5 * Math.cos(ph));
          var g1 = base[k+1] * (0.82 + g0) + irid * (0.5 + 0.5 * Math.cos(ph + 2.094));
          var b = base[k+2] * (0.82 + g0) + irid * (0.5 + 0.5 * Math.cos(ph + 4.188));
          arr[k] = r < 0 ? 0 : r > 1 ? 1 : r;
          arr[k+1] = g1 < 0 ? 0 : g1 > 1 ? 1 : g1;
          arr[k+2] = b < 0 ? 0 : b > 1 ? 1 : b;
          arr[k+3] = base[k+3];
        }
        d.attr.needsUpdate = true;
      }
    }
    return {
      setArmorMode: function (name) {
        if (!MODES[name]) throw new Error('Unknown armor mode: ' + name);
        mode = name;
        target = MODES[name].map(function (a) { return new THREE.Vector3(a[0], a[1], a[2]); });
      },
      getArmorMode: function () { return mode; },
      setEngines: function (on) { glow.visible = !!on; },
      setShimmer: function (v) { shimmer = clamp01(v); },
      setFlow: function (v) { if (!Number.isFinite(v)) throw new Error('Expected finite number'); flow = Math.max(0, Math.min(3, v)); },
      setHue: function (v) { if (!Number.isFinite(v)) throw new Error('Expected finite number'); hue = v; },
      update: function (time) {
        if (!Number.isFinite(time)) return;
        var dt = lastT < 0 || time < lastT ? 0.05 : Math.min(0.1, time - lastT);
        lastT = time;
        lerp(dt);
        if (shimmer > 0 && time - lastPaint >= 1/30) { lastPaint = time; paint(time); }
      },
      dispose: function () {
        data.forEach(function (d) { d.mesh.geometry = d.prevG; d.mesh.material = d.prevM; d.geo.dispose(); });
        material.dispose();
        trim.material = prevTrimM; glow.material = prevGlowM;
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
"""
open(P+'/om_controls.js','w').write(JS.replace('__MODES__', json.dumps(MODES)))
open(P+'/modes.json','w').write(json.dumps(MODES, indent=1))

# ---------- preview: cruise / ram / open ----------
def collect(mode):
    items=[]
    table={f'armor_{i}':np.array(MODES[mode][i]) for i in range(8)}
    table.update({f'rib_{i}':np.array(MODES[mode][8+i]) for i in range(3)})
    for name,m in [('hull',hull_m),('trim',trim_m),('engine_glow',glow_m)]+\
                  [(f'armor_{i}',plate_ms[i]) for i in range(8)]+[(f'rib_{i}',rib_ms[i]) for i in range(3)]:
        tr=table.get(name,np.zeros(3))
        V=m.vertices+tr
        F=m.faces
        C=np.array(m.visual.vertex_colors)[:,:3][F].mean(axis=1)
        items.append((V,F,C))
    return items
def render(mode,C,W=400,H=440,focal=520):
    C=np.array(C,float); tgt=np.array([0,0,0.0]); fwd=tgt-C; fwd/=np.linalg.norm(fwd)
    right=np.cross(fwd,[0,1,0]); right/=np.linalg.norm(right); up=np.cross(right,fwd)
    tris=[]
    for V,F,Cc in collect(mode):
        rel=V-C; z=rel@fwd; x=rel@right; y=rel@up
        z=np.maximum(z,0.2)
        sx=W/2+(x/z)*focal; sy=H/2-(y/z)*focal
        e1=V[F[:,1]]-V[F[:,0]]; e2=V[F[:,2]]-V[F[:,0]]
        n=np.cross(e1,e2); view=V[F].mean(axis=1)-C
        front=(n*view).sum(axis=1)<0
        for fi,f3 in enumerate(F):
            if not front[fi]: continue
            zz=z[f3].mean()
            tris.append((zz,[(sx[f3[0]],sy[f3[0]]),(sx[f3[1]],sy[f3[1]]),(sx[f3[2]],sy[f3[2]])],Cc[fi]))
    tris.sort(key=lambda t:-t[0])
    from PIL import Image,ImageDraw,ImageFont
    img=Image.new('RGB',(W,H),(16,22,32)); d=ImageDraw.Draw(img)
    for zz,pts,col in tris:
        c=tuple(int(max(0,min(255,v))) for v in col)
        d.polygon(pts,fill=c)
        d.line([pts[0],pts[1],pts[2],pts[0]],fill=c,width=1)  # close raster cracks
    return img,d
from PIL import Image,ImageDraw,ImageFont
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
cam=(21,27,42)
panels=[('cruise','КРЕЙСЕР — плиты распределены'),
        ('ram','ТАРАН — броня стянута к носу'),
        ('open','ОТКРЫТО — плиты отошли от корпуса')]
sheet=Image.new('RGB',(1240,500),(10,14,20)); ds=ImageDraw.Draw(sheet)
for i,(mode,label) in enumerate(panels):
    img,d=render(mode,cam)
    sheet.paste(img,(10+i*410,46))
    ds.text((14+i*410,14),label,fill='white',font=font)
sheet.save(P+'/preview.jpg',quality=92)
print('OK tris total',len(hull.faces)+len(trim.faces)+len(glow.faces)+sum(len(m.faces) for m in plates+ribs))
