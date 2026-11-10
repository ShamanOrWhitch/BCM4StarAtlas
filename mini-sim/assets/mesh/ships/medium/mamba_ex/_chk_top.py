import sys, os, json
import numpy as np
os.chdir('/home/user/mamba_ex_v2'); sys.path.insert(0,'/home/user/mamba_ex_v2')
from PIL import Image
import render_preview as rp
gltf, binc = rp.load_glb('fimbul_mamba_ex.glb')
tv,tc = rp.collect(gltf, binc, {})
W,H=820,520
img = rp.raster(tv,tc,W,H,(-6,26,20),(4,6.5,6),fov=42,bg=(15,19,26),light=(-0.5,0.85,0.3))
img.save('_chk_top.jpg',quality=92)
print('ok')
