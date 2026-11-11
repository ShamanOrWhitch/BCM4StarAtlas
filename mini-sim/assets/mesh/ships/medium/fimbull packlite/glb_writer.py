"""Минимальный экспортёр GLB (glTF 2.0 binary) без внешних зависимостей.
Поддерживает: несколько узлов, по одному мешу на узел, POSITION/NORMAL/COLOR_0
(float32), индексы uint32, один PBR-материал на узел (vertex colors)."""
import json, struct, math
import numpy as np


def _pad4(b, fill=b'\x00'):
    return b + fill * ((4 - len(b) % 4) % 4)


class GlbBuilder:
    def __init__(self):
        self.bin = bytearray()
        self.views = []       # bufferViews
        self.accessors = []
        self.nodes = []
        self.meshes = []
        self.materials = []

    # ---------- низкоуровневые буферы ----------
    def _view(self, arr, target=None):
        data = arr.tobytes()
        offset = len(self.bin)
        self.bin += data
        self.bin += b'\x00' * ((4 - len(self.bin) % 4) % 4)
        v = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)}
        if target:
            v['target'] = target
        self.views.append(v)
        return len(self.views) - 1

    def _accessor(self, arr, comp_type, type_str, minmax=False, normalized=False):
        view = self._view(arr, 34962)
        a = {'bufferView': view, 'componentType': comp_type,
             'count': int(arr.shape[0]), 'type': type_str}
        if normalized:
            a['normalized'] = True
        if minmax:
            a['min'] = [float(v) for v in np.asarray(arr).min(axis=0)]
            a['max'] = [float(v) for v in np.asarray(arr).max(axis=0)]
        self.accessors.append(a)
        return len(self.accessors) - 1

    # ---------- материалы ----------
    def material(self, name, metallic=0.0, roughness=0.85, double_sided=False):
        m = {
            'name': name,
            'pbrMetallicRoughness': {
                'baseColorFactor': [1, 1, 1, 1],
                'metallicFactor': metallic,
                'roughnessFactor': roughness,
            },
        }
        if double_sided:
            m['doubleSided'] = True
        self.materials.append(m)
        return len(self.materials) - 1

    # ---------- меши и узлы ----------
    def mesh(self, name, verts, tris, colors, mat=0):
        """verts (N,3) float, tris (M,3) int, colors (N,4) float 0..1."""
        verts = np.asarray(verts, dtype=np.float32)
        tris = np.asarray(tris, dtype=np.uint32)
        colors = np.asarray(colors, dtype=np.float32)
        if colors.shape[1] == 3:
            colors = np.hstack([colors, np.ones((colors.shape[0], 1), np.float32)])
        # плоские нормали
        a = verts[tris[:, 0]]
        b = verts[tris[:, 1]]
        c = verts[tris[:, 2]]
        n = np.cross(b - a, c - a)
        ln = np.linalg.norm(n, axis=1, keepdims=True)
        ln[ln == 0] = 1
        n = n / ln
        normals = np.zeros_like(verts)
        cnt = np.zeros(len(verts), np.float32)
        for k in range(3):
            np.add.at(normals, tris[:, k], n)
            np.add.at(cnt, tris[:, k], 1)
        cnt[cnt == 0] = 1
        normals /= cnt[:, None]
        nl = np.linalg.norm(normals, axis=1, keepdims=True)
        nl[nl == 0] = 1
        normals /= nl

        pos_acc = self._accessor(verts, 5126, 'VEC3', minmax=True)
        nrm_acc = self._accessor(normals, 5126, 'VEC3')
        col_acc = self._accessor(colors, 5126, 'VEC4')
        idx_view = self._view(tris.reshape(-1), 34963)
        idx_acc = {'bufferView': idx_view, 'componentType': 5125,
                   'count': int(tris.size), 'type': 'SCALAR'}
        self.accessors.append(idx_acc)
        idx_acc = len(self.accessors) - 1

        prim = {'attributes': {'POSITION': pos_acc, 'NORMAL': nrm_acc, 'COLOR_0': col_acc},
                'indices': idx_acc, 'material': mat, 'mode': 4}
        self.meshes.append({'name': name, 'primitives': [prim]})
        return len(self.meshes) - 1

    def node(self, name, mesh_index=None, translation=None, children=None,
             rotation=None):
        node = {'name': name}
        if mesh_index is not None:
            node['mesh'] = mesh_index
        if translation is not None:
            node['translation'] = [float(v) for v in translation]
        if rotation is not None:          # кватернион [x, y, z, w]
            node['rotation'] = [float(v) for v in rotation]
        if children:
            node['children'] = children
        self.nodes.append(node)
        return len(self.nodes) - 1

    # ---------- сборка ----------
    def build(self, scene_name='scene'):
        gltf = {
            'asset': {'version': '2.0', 'generator': 'rainbow photoli glb builder'},
            'scene': 0,
            'scenes': [{'name': scene_name, 'nodes': list(range(len(self.nodes)))}],
            'nodes': self.nodes,
            'meshes': self.meshes,
            'accessors': self.accessors,
            'bufferViews': self.views,
            'materials': self.materials,
            'buffers': [{'byteLength': len(self.bin)}],
        }
        js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
        js = _pad4(js, b' ')
        bin_data = _pad4(bytes(self.bin))
        total = 12 + 8 + len(js) + 8 + len(bin_data)
        out = bytearray()
        out += struct.pack('<III', 0x46546C67, 2, total)
        out += struct.pack('<II', len(js), 0x4E4F534A) + js
        out += struct.pack('<II', len(bin_data), 0x004E4942) + bin_data
        return bytes(out)


# ---------- геометрические помощники ----------
def box(cx, cy, cz, sx, sy, sz):
    """Ось-ориентированный ящик: 8 вершин, 12 треугольников, центр в (cx,cy,cz)."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = np.array([
        [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
        [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
    ], np.float32) + np.array([cx, cy, cz], np.float32)
    t = np.array([
        [0, 2, 1], [0, 3, 2],   # -z
        [4, 5, 6], [4, 6, 7],   # +z
        [0, 1, 5], [0, 5, 4],   # -y
        [3, 7, 6], [3, 6, 2],   # +y
        [0, 4, 7], [0, 7, 3],   # -x
        [1, 2, 6], [1, 6, 5],   # +x
    ], np.uint32)
    return v, t


def box_colored(cx, cy, cz, sx, sy, sz, color, top=1.30, side=0.82, bottom=0.55, front=1.0):
    """Ящик с ЗАПЕЧЁННЫМ затенением: у каждой грани своя яркость (24 вершины,
    по 4 на грань). Модели рисуются unlit-материалом, поэтому объём должен
    жить в цветах вершин, а не в свете сцены."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    F = [
        # (4 угла, множитель)
        ([[-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]], top),
        ([[-hx, -hy, hz], [hx, -hy, hz], [hx, -hy, -hz], [-hx, -hy, -hz]], bottom),
        ([[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz]], side * front),
        ([[hx, -hy, hz], [-hx, -hy, hz], [-hx, hy, hz], [hx, hy, hz]], side),
        ([[-hx, -hy, hz], [-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz]], side * 0.92),
        ([[hx, -hy, -hz], [hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz]], side * 1.02),
    ]
    V, T, C = [], [], []
    color = np.asarray(color, np.float32).reshape(-1)
    if color.size == 3:
        color = np.concatenate([color, [1.0]])
    for k, (corners, mul) in enumerate(F):
        base = len(V)
        for c in corners:
            V.append([c[0] + cx, c[1] + cy, c[2] + cz])
            C.append(np.clip(color * mul, 0, 1))
        T.append([base, base + 1, base + 2])
        T.append([base, base + 2, base + 3])
    return np.array(V, np.float32), np.array(T, np.uint32), np.array(C, np.float32)


def cylinder(cx, cy, cz, radius, length, axis='x', seg=14, color=(0.3, 0.3, 0.3),
             teeth=0, cap=True):
    """Цилиндр вдоль оси axis с затенением по граням. teeth — число зубцов
    на внешней поверхности (буровые барабаны)."""
    color = np.asarray(color, np.float32).reshape(-1)
    if color.size == 3:
        color = np.concatenate([color, [1.0]])
    ring = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring.append((math.cos(a) * radius, math.sin(a) * radius))
    V, T, C = [], [], []

    def pt(u, v, w):
        # ось цилиндра = axis, кольцо строится в двух других осях
        if axis == 'x':
            return [cx + w, cy + u, cz + v]
        if axis == 'y':
            return [cx + u, cy + w, cz + v]
        return [cx + u, cy + v, cz + w]

    half = length / 2.0
    for i in range(seg):
        u0 = ring[i]
        u1 = ring[(i + 1) % seg]
        shade = 0.62 + 0.38 * (0.5 + 0.5 * math.cos(2 * math.pi * i / seg + 0.7))
        r0 = radius * (1.0 + (0.16 if (teeth and i % 2 == 0) else 0.0))
        base = len(V)
        for (uu, w) in ((u0, -half), (u1, -half), (u1, half), (u0, half)):
            V.append(pt(uu[0], uu[1], w))
            C.append(np.clip(color * shade, 0, 1))
        T.append([base, base + 1, base + 2])
        T.append([base, base + 2, base + 3])
    if cap:
        for w in (-half, half):
            cbase = len(V)
            V.append(pt(0, 0, w))
            C.append(np.clip(color * (0.55 if w < 0 else 0.95), 0, 1))
            for i in range(seg):
                a = pt(ring[i][0], ring[i][1], w)
                b = pt(ring[(i + 1) % seg][0], ring[(i + 1) % seg][1], w)
                V.append(a); C.append(np.clip(color * 0.8, 0, 1))
                V.append(b); C.append(np.clip(color * 0.8, 0, 1))
                if w < 0:
                    T.append([cbase, cbase + 2 * i + 2, cbase + 2 * i + 1])
                else:
                    T.append([cbase, cbase + 2 * i + 1, cbase + 2 * i + 2])
    return np.array(V, np.float32), np.array(T, np.uint32), np.array(C, np.float32)


def merge(parts):
    """parts: список (verts (N,3), tris (M,3), colors (N,4))."""
    vs, ts, cs, off = [], [], [], 0
    for v, t, c in parts:
        vs.append(v)
        ts.append(t + off)
        cs.append(c)
        off += len(v)
    return (np.vstack(vs), np.vstack(ts), np.vstack(cs))


def quad(p0, p1, p2, p3, color):
    """Плоский четырёхугольник (два треугольника) с плоской окраской RGBA."""
    v = np.array([p0, p1, p2, p3], np.float32)
    t = np.array([[0, 1, 2], [0, 2, 3]], np.uint32)
    col = np.asarray(color, np.float32).reshape(-1)
    if col.size == 3:
        col = np.concatenate([col, [1.0]])
    c = np.tile(col, (4, 1))
    return v, t, c
