#!/usr/bin/env python3
"""Печём спрайты астероидов из НАСТОЯЩИХ GLB репозитория.

Зачем печь, а не грузить GLB в игре: слой варпа — Canvas 2D, и второй
WebGL-контекст на слабом Android не нужен (это уже зафиксировано в ревизии 11).
Поэтому меши один раз рендерятся здесь (свой софт-растеризатор, без GPU) и
попадают в скрипт как спрайты: в кадре это один drawImage на камень.

Источник: mini-sim/assets/mesh/asteroid_variety/*.glb
  large_01..04, medium_01..04, small_01..04 — 5120 треугольников, встроенная
  текстура 256x256. Размеры-классы берём из имён файлов, как и просил владелец
  («папки распределения по размерам»).
"""
import base64
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "asteroids_src")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "asteroids_out")


def read_glb(path):
    with open(path, "rb") as fh:
        data = fh.read()
    magic, version, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "не GLB: " + path
    off = 12
    js, bin_ = None, None
    while off < length:
        clen, ctype = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode("utf-8"))
        elif ctype == 0x004E4942:
            bin_ = chunk
        off += 8 + clen + ((4 - clen % 4) % 4)
    return js, bin_


COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def accessor(js, bin_, index):
    acc = js["accessors"][index]
    fmt, size = COMP[acc["componentType"]]
    ncomp = NCOMP[acc["type"]]
    count = acc["count"]
    bv = js["bufferViews"][acc["bufferView"]]
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride") or (size * ncomp)
    out = np.zeros((count, ncomp), dtype=np.float64)
    for i in range(count):
        vals = struct.unpack_from("<" + fmt * ncomp, bin_, start + i * stride)
        out[i] = vals
    return out


def load_mesh(path):
    js, bin_ = read_glb(path)
    mesh = js["meshes"][0]
    prim = mesh["primitives"][0]
    pos = accessor(js, bin_, prim["attributes"]["POSITION"])
    nrm = accessor(js, bin_, prim["attributes"]["NORMAL"]) if "NORMAL" in prim["attributes"] else None
    uv = accessor(js, bin_, prim["attributes"]["TEXCOORD_0"]) if "TEXCOORD_0" in prim["attributes"] else None
    idx = accessor(js, bin_, prim["indices"]).reshape(-1).astype(np.int64) if "indices" in prim else None
    # текстура
    tex = None
    try:
        mat = js["materials"][prim["material"]]
        ti = mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]
        src = js["textures"][ti]["source"]
        image = js["images"][src]
        if "bufferView" in image:
            bv = js["bufferViews"][image["bufferView"]]
            s = bv.get("byteOffset", 0)
            blob = bin_[s: s + bv["byteLength"]]
            tex = Image.open(io.BytesIO(blob)).convert("RGBA")
    except Exception as exc:                       # текстуры нет — обойдёмся цветом
        print("  текстуры нет:", exc, file=sys.stderr)
    if idx is None:
        idx = np.arange(len(pos))
    return pos, nrm, uv, idx.reshape(-1, 3), tex


def render(path, size_px, angle_deg=32.0, tilt_deg=22.0, quality=3):
    pos, nrm, uv, tris, tex = load_mesh(path)
    if tex is None:
        tex = Image.new("RGBA", (8, 8), (126, 128, 134, 255))
    tw, th = tex.size
    tex_np = np.asarray(tex, dtype=np.float64)[:, :, :3]

    # центрируем и нормируем
    center = (pos.max(axis=0) + pos.min(axis=0)) * 0.5
    p = pos - center
    scale = np.abs(p).max()
    p = p / (scale if scale else 1.0)

    a = np.radians(angle_deg)
    t = np.radians(tilt_deg)
    ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    rx = np.array([[1, 0, 0], [0, np.cos(t), -np.sin(t)], [0, np.sin(t), np.cos(t)]])
    rot = rx @ ry
    p = p @ rot.T
    if nrm is not None:
        n = nrm - nrm.mean(axis=0)
        n = n / np.maximum(1e-6, np.linalg.norm(n, axis=1, keepdims=True))
        n = n @ rot.T
    else:
        n = None

    ss = quality
    px = int(size_px * ss)
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    tri = tris if len(tris) else np.arange(len(p)).reshape(-1, 3)
    p_tri = p[tri]
    light = np.array([0.45, 0.72, 0.53])
    light = light / np.linalg.norm(light)

    faces = []
    for k in range(len(tri)):
        v = p_tri[k]
        e1 = v[1] - v[0]
        e2 = v[2] - v[0]
        fn = np.cross(e1, e2)
        ln = np.linalg.norm(fn)
        if ln < 1e-9:
            continue
        fn = fn / ln
        # Двусторонний свет: нормали у меша нет (в GLB только POSITION/UV),
        # а разворот грани по знаку z давал «слоёные» полосы — половина
        # граней получала ноль и весь камень становился плоским.
        depth = float(v[:, 2].mean())
        lam = 0.5 * abs(float(np.dot(fn, light))) + 0.5 * max(0.0, float(np.dot(fn, light)))
        shade = 0.30 + 1.55 * lam
        # дальние грани чуть темнее: объём читается и без нормалей
        shade *= 0.86 + 0.14 * ((depth + 1.0) * 0.5)
        if uv is not None:
            u = float(uv[tri[k]][:, 0].mean()) % 1.0
            vv = float(uv[tri[k]][:, 1].mean()) % 1.0
            c = tex_np[min(th - 1, int(vv * th)), min(tw - 1, int(u * tw))] / 255.0
        else:
            c = np.array([0.5, 0.5, 0.53])
        # атмосферный сдвиг: дальние камни холоднее
        rim = 0.9 + 0.1 * (-depth)
        col = (
            min(1.0, c[0] * shade * 1.02 * rim),
            min(1.0, c[1] * shade * 1.00 * rim),
            min(1.0, c[2] * shade * 1.08 * rim),
        )
        xs = (v[:, 0] * 0.5 + 0.5) * (px - 1)
        ys = (0.5 - v[:, 1] * 0.5) * (px - 1)
        faces.append((depth, [(xs[i], ys[i]) for i in range(3)], col))
    # painter: от дальних к ближним (мень z рисуем первыми)
    faces.sort(key=lambda f: f[0])
    for _, pts, col in faces:
        draw.polygon(pts, fill=(int(col[0] * 255), int(col[1] * 255), int(col[2] * 255), 255))
    if ss > 1:
        img = img.resize((size_px, size_px), Image.LANCZOS)
    return add_rim(img)


def add_rim(img, tint=(123, 228, 244), strength=0.55):
    """Тонкий неоновый контур по силуэту: камень читается на тёмном космосе
    и попадает в палитру варпа. Это рисование по альфе, не «наклейка»."""
    alpha = img.getchannel("A")
    inner = alpha.filter(ImageFilter.MinFilter(3))
    edge = Image.new("RGBA", img.size, (0, 0, 0, 0))
    edge_np = np.zeros((img.height, img.width, 4), dtype=np.uint8)
    a_out = np.asarray(alpha, dtype=np.float64)
    a_in = np.asarray(inner, dtype=np.float64)
    rim = np.clip((a_out - a_in) * (strength * 255.0 / 255.0), 0, 255)
    edge_np[:, :, 0] = tint[0]
    edge_np[:, :, 1] = tint[1]
    edge_np[:, :, 2] = tint[2]
    edge_np[:, :, 3] = rim.astype(np.uint8)
    edge.putdata([tuple(v) for v in edge_np.reshape(-1, 4)])
    out = Image.alpha_composite(img, edge)
    return out


SIZES = {"small": 80, "medium": 112, "large": 160}
VARIANTS = {
    "small": ["small_01", "small_02"],
    "medium": ["medium_01", "medium_02"],
    "large": ["large_01", "large_02"],
}
ANGLES = {"small": (28, 14), "medium": (44, 20), "large": (18, 26)}


def main():
    os.makedirs(OUT, exist_ok=True)
    table = []
    for size, names in VARIANTS.items():
        for name in names:
            path = os.path.join(SRC, name + ".glb")
            if not os.path.exists(path):
                print("нет файла", path, file=sys.stderr)
                continue
            ax, ay = ANGLES[size]
            img = render(path, SIZES[size], ax, ay)
            # палитра 96 цветов — вдвое-втрое меньше base64 при том же виде.
            # PIL не умеет quantize RGBA напрямую: квантуем RGB, альфу
            # возвращаем отдельной маской (она бинарная — край камня).
            alpha = img.getchannel("A")
            q = img.convert("RGB").quantize(colors=56, method=Image.MEDIANCUT)
            q = q.convert("RGBA")
            q.putalpha(alpha.point(lambda v: 255 if v > 110 else 0))
            buf = io.BytesIO()
            q.save(buf, format="PNG", optimize=True)
            raw = buf.getvalue()
            out = os.path.join(OUT, name + ".png")
            q.save(out, format="PNG", optimize=True)
            table.append({"id": name, "size": size, "px": SIZES[size],
                          "bytes": len(raw),
                          "b64": base64.b64encode(raw).decode("ascii")})
            print(f"{name:10s} {size:7s} {SIZES[size]:3d}px  PNG {len(raw):6d} Б  b64 {len(table[-1]['b64']):7d}")
    total = sum(len(t["b64"]) for t in table)
    print("итого base64:", total, "символов =", round(total / 1024, 1), "КБ")
    with open(os.path.join(OUT, "atlas.json"), "w", encoding="utf-8") as fh:
        json.dump(table, fh, ensure_ascii=False)


if __name__ == "__main__":
    main()
