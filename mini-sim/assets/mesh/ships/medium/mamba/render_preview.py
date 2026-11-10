#!/usr/bin/env python3
"""Проба модели без GPU: разбор fimbul_mamba.glb + программная растеризация
с z-буфером (без WebGL). Служит для preview.jpg и собственной проверки формы.

Важно: трансформации узлов (translation / rotation) применяются — иначе лапы
и буровой блок рисуются в начале координат. Режим modes.json задаёт позу
(лапы 0..1, вращение барабанов).
"""
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


def quat_mat(q):
    x, y, z, w = q
    n = x * x + y * y + z * z + w * w
    if n < 1e-12:
        return np.eye(4)
    s = 2.0 / n
    return np.array([
        [1 - s * (y * y + z * z), s * (x * y - z * w), s * (x * z + y * w), 0],
        [s * (x * y + z * w), 1 - s * (x * x + z * z), s * (y * z - x * w), 0],
        [s * (x * z - y * w), s * (y * z + x * w), 1 - s * (x * x + y * y), 0],
        [0, 0, 0, 1]], np.float64)


def rotx(deg):
    a = np.deg2rad(deg)
    m = np.eye(4)
    m[1, 1] = np.cos(a); m[1, 2] = -np.sin(a)
    m[2, 1] = np.sin(a); m[2, 2] = np.cos(a)
    return m


def node_matrix(node, extra=None):
    m = np.eye(4)
    if 'translation' in node:
        m[:3, 3] = node['translation']
    if 'rotation' in node:
        m = m @ quat_mat(node['rotation'])
    if 'scale' in node:
        m[:3, :3] = m[:3, :3] @ np.diag(node['scale'])
    if extra is not None:
        m = m @ extra
    return m


def collect(gltf, binc, pose=None, skip=()):
    """pose: dict имя_узла -> матрица 4x4 (доп. поворот в локальных осях)."""
    pose = pose or {}
    tv, tc = [], []
    for node in gltf['nodes']:
        if 'mesh' not in node:
            continue
        name = node.get('name', '')
        if name in skip:
            continue
        m = node_matrix(node, pose.get(name))
        prim = gltf['meshes'][node['mesh']]['primitives'][0]
        v = accessor(gltf, binc, prim['attributes']['POSITION']).astype(np.float64)
        c = accessor(gltf, binc, prim['attributes']['COLOR_0']).astype(np.float32)[:, :3]
        v = v @ m[:3, :3].T + m[:3, 3]
        idx = accessor(gltf, binc, prim['indices']).astype(np.int64).reshape(-1, 3)
        tv.append(v[idx].astype(np.float32))
        tc.append(c[idx])
    return np.concatenate(tv), np.concatenate(tc)


def raster(tris_v, tris_c, W, H, cam, target, up=(0, 1, 0), ortho=None, fov=None,
           bg=(24, 32, 44), light=(-0.4, 0.8, 0.45), amb=0.40, ambient_sky=0.22):
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
    cz = rel @ fwd
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
    n = np.cross(tris_v[:, 1] - tris_v[:, 0], tris_v[:, 2] - tris_v[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1
    n = n / ln
    L = np.array(light, np.float32)
    L /= np.linalg.norm(L)
    lam = np.abs(n @ L)
    sky = np.clip(n @ np.array([0, 1, 0], np.float32), 0, 1) * ambient_sky
    shade = amb + 0.72 * lam + sky

    zbuf = np.full((H, W), np.inf, np.float32)
    out = np.zeros((H, W, 3), np.float32)
    out[:] = np.array(bg, np.float32) / 255.0
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
        col = np.clip(tris_c[t][0] * 1.45 * (0.55 + 0.45 * shade[t]), 0.0, 1.0)
        out[y0:y1 + 1, x0:x1 + 1][m] = np.clip(col, 0, 1)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def label(img, text):
    dr = ImageDraw.Draw(img)
    try:
        fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
        fnt2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
    except Exception:
        fnt = fnt2 = ImageFont.load_default()
    dr.text((12, 9), text, fill=(158, 186, 212), font=fnt2)
    return img


def main():
    gltf, binc = load_glb('fimbul_mamba.glb')
    try:
        mj = json.load(open('modes.json'))
        modes = mj['modes']
        GUN_ELEV = mj.get('gun_elev_deg', 16.0)
        TURRET_YAW = mj.get('turret_yaw_deg', 110.0)
        TURRET_PITCH = mj.get('turret_pitch_deg', 18.0)
        BAY_OPEN = mj.get('bay_open_deg', 60.0)
        RAMP_OPEN = mj.get('ramp_open_deg', 140.0)
        BRIG_OPEN = 0.0
        LEG_RETRACT = mj.get('leg_retract', 1.9)
    except Exception:
        modes = {}
        GUN_ELEV, TURRET_YAW, TURRET_PITCH = 16.0, 110.0, 18.0
        BAY_OPEN, RAMP_OPEN, LEG_RETRACT = 60.0, 140.0, 1.9

    def pose_for(mode):
        """Поза режима: стойки, носовые блоки стволов, турели, ракетный отсек."""
        m = modes.get(mode) or {}
        p = {}
        legs = m.get('legs', 1.0)
        guns = m.get('guns', 0.0)
        tur = m.get('turret', 0.0)
        bay = m.get('bay', 0.0)
        for i in range(6):
            ml = np.eye(4)
            ml[1, 3] = LEG_RETRACT * (1.0 - legs)
            p['leg_%d' % i] = ml
        for tag in ('r', 'l'):
            mg = np.eye(4)
            g = np.deg2rad(GUN_ELEV * guns)
            mg[1, 1] = np.cos(g); mg[1, 2] = -np.sin(g)
            mg[2, 1] = np.sin(g); mg[2, 2] = np.cos(g)
            p['gun_' + tag] = mg
            mt = np.eye(4)
            t = np.deg2rad(TURRET_YAW * tur * (1.0 if tag == 'r' else -1.0))
            mt[0, 0] = np.cos(t); mt[0, 2] = np.sin(t)
            mt[2, 0] = -np.sin(t); mt[2, 2] = np.cos(t)
            p['turret_' + tag] = mt @ mg
        mb = np.eye(4)
        b = np.deg2rad(-BAY_OPEN * bay)
        mb[1, 1] = np.cos(b); mb[1, 2] = -np.sin(b)
        mb[2, 1] = np.sin(b); mb[2, 2] = np.cos(b)
        p['bay_door'] = mb
        # аппарель: поворот вокруг Z, плита уходит вперёд-вниз
        ram = m.get('ramp', 0.0)
        mr = np.eye(4)
        rr = np.deg2rad(RAMP_OPEN * ram)
        mr[0, 0] = np.cos(rr); mr[0, 1] = -np.sin(rr)
        mr[1, 0] = np.sin(rr); mr[1, 1] = np.cos(rr)
        p['ramp'] = mr
        return p

    TILE_W, TILE_H = 820, 580
    light_a = (-0.55, 0.75, 0.42)
    light_b = (0.45, 0.70, -0.55)
    light_c = (-0.15, 0.30, -0.95)

    def shot(mode, cam, tgt, ortho, up=(0, 1, 0), light=light_a, bg=(15, 19, 26)):
        tv, tc = collect(gltf, binc, pose_for(mode))
        return raster(tv, tc, TILE_W, TILE_H, cam, tgt, up=up, ortho=ortho,
                      bg=bg, light=light)

    tiles = [
        label(shot('pad', (-40, 22, 38), (0, 5, 0), 42),
              'на палубе · шесть стоек, клыки вперёд, фонарь и плавники в корме'),
        label(shot('flight', (34, 16, -40), (0, 5, 0), 42, light=light_b),
              'полёт · стойки убраны, дюзы на марше'),
        label(shot('pad', (-56, 6, 0.01), (0, 5.0, 0), 27, light=(-0.92, 0.25, 0.3)),
              'нос, фронт (орто) · люк-трап закрыт, клыки и блоки стволов'),
        label(shot('pad', (0, 78, 0.01), (0, 0, 0), 50, up=(0, 0, 1),
                   light=(-0.25, 0.95, 0.15)),
              'вид сверху (орто) · 38 × 18 м, клыки в носу, фонарь в корме'),
        label(shot('pad', (0, 6.2, 62), (0, 5.6, 0), 30, light=light_c),
              'борт (орто) · 9 м по высоте, рельсовые пушки, стойки'),
        label(shot('load', (-34, 4.5, 26), (-4.0, 3.2, 0), 30, light=(-0.8, 0.45, 0.35)),
              'погрузка · носовой люк отдраен, аппарель опущена на палубу'),
        label(shot('hunt', (30, 22, 30), (0, 6, 0), 34, light=light_a),
              'охота · стволы подняты, турели развёрнуты, отсек открыт'),
        label(shot('pad', (0, -78, 0.01), (0, 0, 0), 50, up=(0, 0, 1),
                   light=(-0.2, -0.9, 0.2)),
              'снизу (орто) · стойки, опорные подушки, киль'),
    ]
    cols, rows = 2, 4
    Wt, Ht = TILE_W * cols, TILE_H * rows
    out = Image.new('RGB', (Wt, Ht), (8, 11, 16))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % cols) * TILE_W, (i // cols) * TILE_H))
    out = out.resize((int(Wt * 0.82), int(Ht * 0.82)), Image.LANCZOS)
    out.save('preview.jpg', quality=88)
    print('preview.jpg', out.size)


if __name__ == '__main__':
    main()
