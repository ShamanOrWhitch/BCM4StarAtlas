import numpy as np,trimesh as t
from PIL import Image,ImageDraw
P='/home/user/rainbow_chi_lite';rings=39;side=8
# +Z forward. Four tessellated panels share the same perimeter points.
v=[];faces=[]
for i in range(rings):
 u=i/(rings-1);z=-1.75+3.5*u
 # broad rectangular tail gently tapers to a narrow, sharp prow.
 width=.50*(1-u)**.70+.012;height=.47*(1-u)**.80+.012
 for k in range(4*side):
  edge=k//side;alpha=(k%side)/side
  corners=[(-width,-height),(width,-height),(width,height),(-width,height)]
  a=np.array(corners[edge]);b=np.array(corners[(edge+1)%4]);x,y=a*(1-alpha)+b*alpha
  v.append([x,y,z])
N=4*side
for i in range(rings-1):
 for k in range(N):
  a=i*N+k;b=i*N+(k+1)%N;faces.extend([(a,b,b+N),(a,b+N,a+N)])
for k in range(1,N-1):faces.extend([(0,k+1,k),((rings-1)*N,(rings-1)*N+k,(rings-1)*N+k+1)])
m=t.Trimesh(vertices=v,faces=faces,process=False);t.repair.fix_normals(m);m.visual.vertex_colors=[137,153,163,255];scene=t.Scene();scene.add_geometry(m,node_name='photoli_hull',geom_name='photoli_hull_geometry');scene.export(P+'/rainbow_chi.glb')
# Visual static preview; shader effects shown in the real-time application, not baked into GLB.
source=open('/home/user/r6_v5/create.py').read();exec(source[source.index('def render(camera,path):'):source.index("out=Image.new('RGB'")])
out=Image.new('RGB',(1200,520),(67,74,78));d=ImageDraw.Draw(out)
for i,(a,label) in enumerate([(0,'BASE GLB'),(.85,'MORPH CONCEPT')]):
 v=np.array(m.vertices).copy();u=(v[:,2]+1.75)/3.5;v[:,0]*=1+a*.38*np.sin(u*np.pi);v[:,1]*=1-a*.28*np.sin(u*np.pi);v[:,0]+=a*.13*np.sin(u*np.pi*2);f=m.faces;co=np.array(m.visual.vertex_colors[:,:3]);render([1.5,1.0,2.2],P+'/temp.png');out.paste(Image.open(P+'/temp.png').resize((600,480)),(i*600,40));d.text((i*600+16,10),label,fill='white')
out.save(P+'/preview.jpg',quality=92)
print('triangles',len(m.faces),'vertices',len(m.vertices),'watertight',m.is_watertight)
