import sys, os, json
import numpy as np
os.chdir('/home/user/mamba_ex_v2'); sys.path.insert(0,'/home/user/mamba_ex_v2')
from PIL import Image
import render_preview as rp
gltf, binc = rp.load_glb('fimbul_mamba_ex.glb')
mj=json.load(open('modes.json')); modes=mj['modes']
def pose(mode):
    m=modes[mode]; p={}
    for i in range(6):
        ml=np.eye(4); ml[1,3]=1.9*(1.0-m.get('legs',1.0)); p['leg_%d'%i]=ml
    return p
W,H=700,560
views=[((-34,10,18),(-4,5.0,0),'нос 3/4 · толстые турбины-клыки, крупные маски'),
       ((-46,6,2),(-8,4.6,0),'прямо в нос · два канала на клык')]
out=Image.new('RGB',(W*2,H),(8,11,16))
for i,(cam,tgt,txt) in enumerate(views):
    tv,tc=rp.collect(gltf,binc,pose('pad'))
    img=rp.raster(tv,tc,W,H,cam,tgt,fov=40,bg=(15,19,26),light=(-0.6,0.7,0.35))
    out.paste(rp.label(img,txt),(i*W,0))
out.save('_chk_nose.jpg',quality=90)
print('ok')
