#!/usr/bin/env python3
"""Проба модели без GPU: разбор rainbow_arc.glb + программная растеризация
с z-буфером (без WebGL). Служит для preview.jpg и собственной проверки формы —
в том числе ортографические виды рядом с официальным чертежом."""
import json, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def load_glb(path):
    data = open(path, 'rb').read()
    assert struct.unpack('<I', data[:4])[0] == 0x46546C67
    off, gltf, binc = 12, None, None
    while off < len(data):
        ln, typ = struct.unpack('<II', data[off:off + 8])
        chunk = data[off + 8:off + 8 + ln]
        if typ == 0x4E4F534A:
            gltf = json.loads(chunk.decode('utf-8'))
        elif typ == 0x004E4942:
            binc = chunk
        off += 8 + ln
    return gltf, binc


def accessor(gltf, binc, idx):
    acc = gltf['accessors'][idx]
    view = gltf['bufferViews'][acc['bufferView']]
    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    ncomp = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[acc['type']]
    dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[acc['componentType']]
    arr = np.frombuffer(binc, dtype=dtype, count=acc['count'] * ncomp, offset=start)
    return arr.reshape(acc['count'], ncomp) if ncomp > 1 else arr


def collect(gltf, binc, mode='flight', modes=None):
    tv, tc = [], []
    for node in gltf['nodes']:
        if 'mesh' not in node:
            continue
        name = node.get('name', '')
        off = np.zeros(3, np.float32)
        if modes and name.startswith('panel_'):
            off = np.array(modes[mode][int(name.split('_')[1])], np.float32)
        prim = gltf['meshes'][node['mesh']]['primitives'][0]
        v = accessor(gltf, binc, prim['attributes']['POSITION']).astype(np.float32) + off
        c = accessor(gltf, binc, prim['attributes']['COLOR_0']).astype(np.float32)
        idx = accessor(gltf, binc, prim['indices']).astype(np.int64).reshape(-1, 3)
        tv.append(v[idx])
        tc.append(c[idx][:, 0])
    return np.concatenate(tv), np.concatenate(tc)


def raster(tris_v, tris_c, W, H, cam, target, up=(0, 1, 0), ortho=None, fov=None,
           bg=(24, 32, 44), light=(-0.4, 0.8, 0.45), amb=0.45, ambient_sky=0.25):
    """cam — позиция глаза; ortho — ширина кадра в метрах (ортопроекция),
    иначе перспектива по вертикальному fov."""
    eye = np.array(cam, np.float32)
    tgt = np.array(target, np.float32)
    fwd = tgt - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, np.array(up, np.float32))
    right /= np.linalg.norm(right)
    upv = np.cross(right, fwd)
    rel = tris_v - eye
    cx = rel @ right
    cy = rel @ upv
    cz = rel @ fwd                              # глубина
    if ortho:
        s = (H / 2) / (ortho / 2)
        px = cx * s + W / 2
        py = -cy * s + H / 2
    else:
        f = 1.0 / np.tan(np.deg2rad(fov) / 2)
        zz = np.maximum(cz, 0.4)
        px = (cx / zz) * f * (H / 2) + W / 2
        py = -(cy / zz) * f * (H / 2) + H / 2
        cz = zz
    # плоское затенение
    n = np.cross(tris_v[:, 1] - tris_v[:, 0], tris_v[:, 2] - tris_v[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1
    n = n / ln
    L = np.array(light, np.float32)
    L /= np.linalg.norm(L)
    # двусторонний свет: панели видны и с изнанки
    lam = np.abs(n @ L)
    sky = np.clip(n @ np.array([0, 1, 0], np.float32), 0, 1) * ambient_sky
    shade = amb + 0.7 * lam + sky

    zbuf = np.full((H, W), np.inf, np.float32)
    out = np.zeros((H, W, 3), np.float32)
    out[:] = np.array(bg, np.float32) / 255.0
    # фон: лёгкий градиент
    grad = np.linspace(0.75, 1.25, H, dtype=np.float32)[:, None]
    out *= grad[..., None]
    np.clip(out, 0, 1, out)

    for t in range(len(tris_v)):
        xs, ys, zs = px[t], py[t], cz[t]
        x0, x1 = int(np.floor(xs.min())), int(np.ceil(xs.max()))
        y0, y1 = int(np.floor(ys.min())), int(np.ceil(ys.max()))
        if x1 < 0 or y1 < 0 or x0 >= W or y0 >= H:
            continue
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(W - 1, x1), min(H - 1, y1)
        if x1 <= x0 or y1 <= y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-9:
            continue
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            continue
        z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
        sub = zbuf[y0:y1 + 1, x0:x1 + 1]
        m = inside & (z < sub)
        if not m.any():
            continue
        sub[m] = z[m]
        col = tris_c[t][:3] * shade[t]
        out[y0:y1 + 1, x0:x1 + 1][m] = np.clip(col, 0, 1)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def label(img, text):
    dr = ImageDraw.Draw(img)
    try:
        fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
    except Exception:
        fnt = ImageFont.load_default()
    dr.text((14, 10), text, fill=(150, 178, 205), font=fnt)
    return img


def main():
    gltf, binc = load_glb('rainbow_arc.glb')
    modes = json.load(open('modes.json'))['modes']

    tiles = []
    # 1) ортографический вид сбоку — сверка с чертежом
    tv, tc = collect(gltf, binc, 'flight', modes)
    tiles.append(label(raster(tv, tc, 900, 340, (0, 14, 400), (0, 14, 0), ortho=150,
                             bg=(18, 22, 28), light=(-0.2, 0.5, -0.9)), 'вид сбоку (ортo) · сверка с чертежом 130 × 30'))
    # 2) вид сверху
    tiles.append(label(raster(tv, tc, 900, 340, (0, 400, 0.001), (0, 0, 0), up=(0, 0, -1),
                             ortho=150, bg=(18, 22, 28), light=(-0.3, -0.9, 0.4)),
                       'вид сверху (ортo) · 38 м в ширину'))
    # 3) три четверти, крейсер
    tiles.append(label(raster(tv, tc, 900, 340, (118, 62, 128), (0, 14, 0), fov=42),
                       'крейсер · обшивка прижата светом'))
    # 4) подъём
    tv2, tc2 = collect(gltf, binc, 'lift', modes)
    tiles.append(label(raster(tv2, tc2, 900, 340, (118, 62, 128), (0, 15, 0), fov=42),
                       'левитация · панели подняты над корпусом'))
    # 5) погрузка
    tv3, tc3 = collect(gltf, binc, 'load', modes)
    tiles.append(label(raster(tv3, tc3, 900, 340, (-112, 66, 122), (-4, 12, 0), fov=42),
                       'погрузка · секции разошлись'))
    # 6) щит
    tv4, tc4 = collect(gltf, binc, 'shield', modes)
    tiles.append(label(raster(tv4, tc4, 900, 340, (118, 62, 128), (0, 14, 0), fov=42),
                       'щит · обшивка стянута вперёд'))

    cols, rows = 2, 3
    Wt = 900 * cols
    Ht = 340 * rows
    out = Image.new('RGB', (Wt, Ht), (8, 11, 16))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * 900, (i // cols) * 340))
    out = out.resize((int(Wt * 0.72), int(Ht * 0.72)), Image.LANCZOS)
    out.save('preview.jpg', quality=90)
    print('preview.jpg', out.size)


if __name__ == '__main__':
    main()
