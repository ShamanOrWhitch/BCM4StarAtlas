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


def collect(gltf, binc, mode='flight', modes=None, skip=()):
    tv, tc = [], []
    for node in gltf['nodes']:
        if 'mesh' not in node:
            continue
        name = node.get('name', '')
        if name in skip:
            continue
        off = np.zeros(3, np.float32)
        if modes and name.startswith('plates_'):
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
    gltf, binc = load_glb('rainbow_phi.glb')
    modes = json.load(open('modes.json'))['modes']
    D = 5200.0                      # дистанция камеры для 3.2-км корабля

    def view(mode, eye, tgt, label_text, fov=38, W=900, H=420):
        tv, tc = collect(gltf, binc, mode, modes)
        return label(raster(tv, tc, W, H, eye, tgt, fov=fov, bg=(14, 18, 26)), label_text)

    tiles = [
        view('cruise', (0, 4200, 300), (0, 200, 0), up=1, label_text='') if False else None,
    ]
    # 1) сверху, ортографически: треугольник 3236 x 2863
    tv, tc = collect(gltf, binc, 'cruise', modes)
    tiles = [label(raster(tv, tc, 900, 420, (0, 1200, 4600), (0, 0, 0), ortho=3600,
                          bg=(15, 19, 26), light=(-0.1, 0.35, -0.93)),
                   'вид сбоку (орто) · плоский профиль, как на чертеже'),
             label(raster(tv, tc, 900, 420, (0, 4000, 60), (0, 0, 0), up=(0, 0, -1),
                          ortho=3800, bg=(15, 19, 26), light=(-0.2, 0.9, 0.25)),
                   'вид сверху (орто) · треугольник 3236 × 2863 м'),
             label(raster(tv, tc, 900, 420, (-3600, 2300, 3200), (0, 200, 0), fov=38,
                          bg=(14, 18, 26)),
                   'крейсер · панели на световом поле')]
    tv2, tc2 = collect(gltf, binc, 'levitation', modes)
    tiles.append(label(raster(tv2, tc2, 900, 420, (-3600, 2300, 3200), (0, 320, 0), fov=38,
                              bg=(14, 18, 26)),
                       'левитация · обшивка поднята волной'))
    tv3, tc3 = collect(gltf, binc, 'iris', modes)
    tiles.append(label(raster(tv3, tc3, 900, 420, (-3600, 2300, 3200), (0, 420, 0), fov=38,
                              bg=(14, 18, 26)),
                       'ирис · террасы раскрыты, видно ядро'))
    tv4, tc4 = collect(gltf, binc, 'shield', modes)
    tiles.append(label(raster(tv4, tc4, 900, 420, (3400, 1900, 3000), (0, 200, 0), fov=38,
                              bg=(14, 18, 26)),
                       'щит · обшивка стянута к раме'))
    tiles.append(label(raster(tv, tc, 900, 420, (4200, 1500, 600), (0, 150, 0), fov=40,
                              bg=(14, 18, 26)),
                       'от кормы · двигатели в основании'))

    tiles.append(label(raster(tv, tc, 900, 420, (3400, -2100, 3000), (0, -200, 0), fov=38,
                              bg=(14, 18, 26)),
                       'снизу · нижняя палуба и пологий киль'))
    # цех: смотрим внутрь каньона на стапели и краны

    cols, rows = 2, 4
    Wt, Ht = 900 * cols, 420 * rows
    out = Image.new('RGB', (Wt, Ht), (8, 11, 16))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * 900, (i // cols) * 420))
    out = out.resize((int(Wt * 0.66), int(Ht * 0.66)), Image.LANCZOS)
    out.save('preview.jpg', quality=90)
    print('preview.jpg', out.size)

    # --- два крупных вида отдельными файлами ---
    tv5, tc5 = collect(gltf, binc, 'iris', modes, skip=('lower_hull', 'keel'))
    big = raster(tv5, tc5, 1500, 860, (-1850, 1120, 1560), (-420, -300, 40), fov=46, bg=(11, 14, 20))
    label(big, 'разрез · ангарная палуба: стапели с кораблями, краны-порталы, эмблема').save(
        'preview_interior.jpg', quality=92)
    tv6, tc6 = collect(gltf, binc, 'dismantle', modes)
    big2 = raster(tv6, tc6, 1500, 860, (-2500, 1350, 2300), (0, 280, 0), fov=44, bg=(11, 14, 20))
    label(big2, 'разборка · обшивка уходит по своим траекториям, корпус распадается на 16 частей').save(
        'preview_dismantle.jpg', quality=92)
    print('preview_interior.jpg / preview_dismantle.jpg')


if __name__ == '__main__':
    main()
