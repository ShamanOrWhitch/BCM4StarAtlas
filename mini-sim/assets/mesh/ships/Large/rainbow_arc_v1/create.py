#!/usr/bin/env python3
"""Rainbow Arc — большой грузовой Rainbow (130 × 38 × 30 м, экипаж 14).
Photoli light levitation: панели обшивки держатся светом, их можно поднимать,
расходиться и стягиваться в плотный щит. Модель: корпус-клин + 10 подвижных
панельных секций + золотые световые швы + полосы левитации + двигатели + ниша.

Габариты и силуэт — по официальному чертежу (side/top view) и обложке.
Ничего не пересекается: панели стоят над поверхностью корпуса с зазором,
внутри каждой грани разложены по непересекающимся ячейкам."""
import numpy as np, json, os, math
from glb_writer import GlbBuilder, box, box_colored, merge, quad

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261110)

L, W, H = 130.0, 38.0, 30.0
X_NOSE, X_TAIL = -L / 2, L / 2          # -65 .. +65
HW = W / 2                               # 19

# ---------- профиль корпуса ----------
def half_width(x):
    """Ширина к носу слегка сужается (по чертежу top view)."""
    if x < -32:
        t = (-32 - x) / 33.0             # 0..1 к носу
        return HW - 9.5 * t ** 1.25
    return HW

def y_top(x):
    """Верх: плоская палуба от середины, нос — длинный наклонный клин."""
    if x < 6:
        t = (6 - x) / 71.0               # 0 при x=6, 1 при x=-65
        return H - 17.0 * t ** 1.15
    return H

def y_bottom(x):
    """Днище плоское, у носа слегка поднимается, под нишей — вырез."""
    if x < -44:
        t = (-44 - x) / 21.0
        return 5.0 * t ** 1.3
    return 0.0

def lean(x):
    """Наклон верхней палубы к носу (для поворота панелей)."""
    d = 1e-3
    return math.atan2(y_top(x + d) - y_top(x - d), 2 * d)

# ---------- корпус ----------
XS = [-65, -58, -50, -44, -38, -30, -20, -6, 6, 20, 34, 46, 56, 62, 65]
def ring(x):
    """Сечение корпусом: ось X — длина (нос -65, корма +65), ось Z — ширина.
    Порядок вершин: низ-левый, низ-правый, верх-правый, верх-левый."""
    b, t, hw = y_bottom(x), y_top(x), half_width(x)
    return np.array([[x, b, -hw], [x, b, hw], [x, t, hw], [x, t, -hw]], np.float32)

def hull_core():
    parts = []
    rings = [ring(x) for x in XS]
    V, T = [], []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        base = len(V)
        V.extend(a); V.extend(b)
        # 4 продольные грани: низ, правый борт, верх, левый борт
        for f in range(4):
            n = (f + 1) % 4
            T.append([base + f, base + 4 + f, base + 4 + n])
            T.append([base + f, base + 4 + n, base + n])
    # носовая и кормовая заглушки
    base = len(V); V.extend(rings[0]); T.append([base + 0, base + 2, base + 1]); T.append([base + 0, base + 3, base + 2])
    base = len(V); V.extend(rings[-1]); T.append([base + 0, base + 1, base + 2]); T.append([base + 0, base + 2, base + 3])
    V = np.array(V, np.float32); T = np.array(T, np.uint32)
    # тёмная сталь с лёгкой патиной, по граням чуть разный тон
    col = np.zeros((len(V), 4), np.float32)
    for i in range(len(V)):
        x, y, z = V[i]
        base = 0.105 + 0.018 * math.sin(x * 0.4 + y * 0.7 + z * 0.3) + rng.normal(0, 0.004)
        # палуба светлее борта, днище темнее — объём без света сцены
        if y > y_top(x) - 1.2:
            base *= 1.22
        elif y < 1.2:
            base *= 0.72
        elif abs(z) > half_width(x) - 1.2:
            base *= 0.92
        col[i] = [base * 0.92, base * 1.0, base * 1.07, 1.0]   # холодный металл с патиной
    parts.append((V, T, np.clip(col, 0, 1)))
    return merge(parts)

# ---------- панели ----------
SECTIONS = 10
SEC_EDGES = np.linspace(X_NOSE + 2, X_TAIL - 2, SECTIONS + 1)
PANEL_COL_DARK = np.array([0.135, 0.148, 0.160])
PANEL_COL_STEEL = np.array([0.235, 0.245, 0.255])
RUST = np.array([0.30, 0.19, 0.13])

def panel_color():
    r = rng.random()
    if r < 0.12:
        base = RUST * rng.uniform(0.7, 1.25)
    elif r < 0.45:
        base = PANEL_COL_STEEL * rng.uniform(0.85, 1.35)
    else:
        base = PANEL_COL_DARK * rng.uniform(0.8, 1.6)
    base = base * rng.uniform(0.9, 1.1)
    return np.clip(np.concatenate([base, [1.0]]), 0, 1)

def slab_on_face(x0, x1, w0, w1, outer, thick, axis, sign):
    """Плита, лежащая на грани. axis='y' (верх/низ) или 'z' (борт).
    outer — координата внешней плоскости, sign — направление наружу."""
    return (x0, x1, w0, w1, outer, thick, axis, sign)

BOXES = []          # (x0,x1,y0,y1,z0,z1) для проверки пересечений

def build_slab(x0, x1, w0, w1, outer, thick, axis, sign):
    cx, cz = (x0 + x1) / 2, (w0 + w1) / 2
    sx, sz = (x1 - x0), (w1 - w0)
    if axis == 'y':
        ang = lean(cx) if sign > 0 else 0.0
        # наклонённая плита опускает угол на (sx/2)*|sin| — поднимаем на столько же,
        # иначе угол врезается в палубу
        if abs(ang) > 1e-4:
            outer = outer + (sx / 2.0) * abs(math.sin(ang)) + 0.02
        cy = outer + sign * thick / 2
        v, t, _c = box_colored(cx, cy, cz, sx, thick, sz, panel_color(),
                               top=1.0 if sign < 0 else 1.28, side=0.84,
                               bottom=1.0 if sign > 0 else 0.62)
        if sign > 0 and abs(ang) > 1e-4:
            ca, sa = math.cos(ang), math.sin(ang)
            y0, z0 = v[:, 1] - cy, v[:, 2] - cz
            v[:, 1] = y0 * ca - (v[:, 0] - cx) * sa + cy
            v[:, 0] = (v[:, 0] - cx) * ca + y0 * sa + cx
    else:
        cy = (y_top(cx) + y_bottom(cx)) / 2 if outer is None else outer
        raise RuntimeError('unused')
    c = _c
    BOXES.append((v[:,0].min(), v[:,0].max(), v[:,1].min(), v[:,1].max(),
                  v[:,2].min(), v[:,2].max()))
    return v, t, c

def side_slab(x0, x1, y0, y1, zface, thick, sign):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    cz = zface + sign * thick / 2
    v, t, c = box_colored(cx, cy, cz, x1 - x0, y1 - y0, thick, panel_color(),
                          top=1.22, side=0.86, bottom=0.6,
                          front=1.0 if sign > 0 else 0.95)
    BOXES.append((v[:,0].min(), v[:,0].max(), v[:,1].min(), v[:,1].max(),
                  v[:,2].min(), v[:,2].max()))
    return v, t, c

def top_surface_y(x, z):
    return y_top(x)

def section_panels(sec):
    """Панели одной секции: верх, оба борта, низ. Ячейки не пересекаются."""
    xa, xb = SEC_EDGES[sec], SEC_EDGES[sec + 1]
    parts = []
    # ---- верх ----
    nx = max(3, int(round((xb - xa) / 5.0)))
    nz = 5
    for i in range(nx):
        for j in range(nz):
            gx0 = xa + (xb - xa) * i / nx
            gx1 = xa + (xb - xa) * (i + 1) / nx
            gz0 = -HW + 2 * HW * j / nz
            gz1 = -HW + 2 * HW * (j + 1) / nz
            # зазор между панелями (световой шов)
            mx, mz = (gx1 - gx0) * rng.uniform(0.045, 0.09), (gz1 - gz0) * rng.uniform(0.05, 0.10)
            x0, x1 = gx0 + mx, gx1 - mx * rng.uniform(0.4, 1.0)
            z0, z1 = gz0 + mz, gz1 - mz * rng.uniform(0.4, 1.0)
            if x1 - x0 < 1.2 or z1 - z0 < 1.2:
                continue
            # внутренний край не должен выйти за корпус: сужаем у борта
            lim = half_width((x0 + x1) / 2) - 0.6
            z0, z1 = max(z0, -lim), min(z1, lim)
            if z1 - z0 < 1.0:
                continue
            lift = rng.uniform(0.06, 0.5)            # одни панели выше, другие ниже
            thick = rng.uniform(0.5, 1.3)
            outer = y_top((x0 + x1) / 2) + lift
            base_part = build_slab(x0, x1, z0, z1, outer, thick, 'y', 1)
            parts.append(base_part)
            # второй слой: на части панелей лежит ещё одна, поменьше (как на референсах)
            if rng.random() < 0.34 and (x1 - x0) > 3.0 and (z1 - z0) > 3.0:
                k0 = (x1 - x0) * rng.uniform(0.12, 0.3)
                k1 = (z1 - z0) * rng.uniform(0.12, 0.3)
                # верх второго слоя считаем по фактическим вершинам базовой панели:
                # у наклонённой плиты высокий угол выше центра, формула тут врёт
                top_max = float(base_part[0][:, 1].max()) + 0.12
                parts.append(build_slab(x0 + k0, x1 - k0, z0 + k1, z1 - k1,
                                        top_max, rng.uniform(0.4, 0.9), 'y', 1))
    # ---- борта ----
    ny = 4
    for side in (-1, 1):
        for i in range(nx):
            for j in range(ny):
                gx0 = xa + (xb - xa) * i / nx
                gx1 = xa + (xb - xa) * (i + 1) / nx
                gy0 = y_bottom(gx0) + 1.0 + (y_top(gx0) - y_bottom(gx0) - 2.0) * j / ny
                gy1 = y_bottom(gx0) + 1.0 + (y_top(gx0) - y_bottom(gx0) - 2.0) * (j + 1) / ny
                mx = (gx1 - gx0) * rng.uniform(0.045, 0.09)
                my = (gy1 - gy0) * rng.uniform(0.05, 0.10)
                x0, x1 = gx0 + mx, gx1 - mx * rng.uniform(0.4, 1.0)
                y0, y1 = gy0 + my, gy1 - my * rng.uniform(0.4, 1.0)
                if x1 - x0 < 1.2 or y1 - y0 < 1.0:
                    continue
                lift = rng.uniform(0.08, 0.55)
                thick = rng.uniform(0.5, 1.3)
                zface = side * (half_width((x0 + x1) / 2) + lift)
                parts.append(side_slab(x0, x1, y0, y1, zface, thick, side))
    # ---- низ ----
    nz = 2
    for i in range(nx):
        for j in range(nz):
            gx0 = xa + (xb - xa) * i / nx
            gx1 = xa + (xb - xa) * (i + 1) / nx
            gz0 = -HW * 0.92 + 2 * HW * 0.92 * j / nz
            gz1 = -HW * 0.92 + 2 * HW * 0.92 * (j + 1) / nz
            # грузовая ниша по центру — низ в этой зоне не закрываем
            if abs((gz0 + gz1) / 2) < 6.5 and X_NOSE + 12 < (gx0 + gx1) / 2 < X_TAIL - 14:
                continue
            if y_bottom((gx0 + gx1) / 2) > 0.4 and (gx0 + gx1) / 2 < -46:
                continue
            mx = (gx1 - gx0) * rng.uniform(0.045, 0.09)
            mz = (gz1 - gz0) * rng.uniform(0.05, 0.10)
            x0, x1 = gx0 + mx, gx1 - mx * rng.uniform(0.4, 1.0)
            z0, z1 = gz0 + mz, gz1 - mz * rng.uniform(0.4, 1.0)
            if x1 - x0 < 1.2 or z1 - z0 < 1.2:
                continue
            lift = rng.uniform(0.08, 0.45)
            thick = rng.uniform(0.5, 1.1)
            outer = y_bottom((x0 + x1) / 2) - lift
            parts.append(build_slab(x0, x1, z0, z1, outer, thick, 'y', -1))
    return merge(parts)

# ---------- золотые световые швы ----------
GOLD = np.array([1.0, 0.80, 0.45, 1.0])
def seams():
    parts = []
    for x in SEC_EDGES[1:-1]:
        # поперечный шов по палубе
        parts.append(quad([x - 0.18, y_top(x) + 0.07, -HW + 1.2],
                          [x + 0.18, y_top(x) + 0.07, -HW + 1.2],
                          [x + 0.18, y_top(x) + 0.07, HW - 1.2],
                          [x - 0.18, y_top(x) + 0.07, HW - 1.2], GOLD))
        for side in (-1, 1):
            zf = side * (half_width(x) + 0.07)
            parts.append(quad([x - 0.16, y_bottom(x) + 1.4, zf],
                              [x + 0.16, y_bottom(x) + 1.4, zf],
                              [x + 0.16, y_top(x) - 1.4, zf],
                              [x - 0.16, y_top(x) - 1.4, zf], GOLD))
    # продольные швы по палубе
    for z in (-HW + 6.0, 0.0, HW - 6.0):
        v, t = box(0.0, H + 0.06, z, L - 16, 0.12, 0.32)
        parts.append((v, t, np.tile(GOLD, (len(v), 1))))
    return merge(parts)

# ---------- полосы левитации и двигатели ----------
def levitation():
    parts = []
    for z in (-11.0, 0.0, 11.0):
        v, t = box(4.0, -1.6, z, 88.0, 0.30, 1.6)
        parts.append((v, t, np.tile(np.array([1.0, 0.86, 0.55, 1.0]), (len(v), 1))))
    return merge(parts)

def engines():
    parts = []
    for z in (-11.0, -3.6, 3.6, 11.0):
        v, t = box(X_TAIL - 1.2, H - 8.0, z, 5.0, 5.0, 5.0)
        parts.append((v, t, np.tile(np.array([0.10, 0.11, 0.12, 1.0]), (len(v), 1))))
        # сопло
        parts.append(quad([X_TAIL + 1.4, H - 10.6, z - 2.2],
                          [X_TAIL + 1.4, H - 5.4, z - 2.2],
                          [X_TAIL + 1.4, H - 5.4, z + 2.2],
                          [X_TAIL + 1.4, H - 10.6, z + 2.2],
                          np.array([0.55, 0.85, 1.0, 1.0])))
    return merge(parts)

# ---------- грузовая ниша (внутренние стеллажи) ----------
def bay():
    parts = []
    z0, z1 = -6.0, 6.0
    x0, x1 = X_NOSE + 14, X_TAIL - 16
    # стены и потолок ниши
    for zz, s in ((z0, 1), (z1, -1)):
        v, t = box((x0 + x1) / 2, 3.2, zz, x1 - x0, 6.4, 0.5)
        parts.append((v, t, np.tile(np.array([0.07, 0.075, 0.085, 1.0]), (len(v), 1))))
    v, t = box((x0 + x1) / 2, 6.6, 0.0, x1 - x0, 0.5, 12.0)
    parts.append((v, t, np.tile(np.array([0.06, 0.065, 0.075, 1.0]), (len(v), 1))))
    # стеллажи-контейнеры
    n = 9
    for i in range(n):
        cx = x0 + 4 + (x1 - x0 - 8) * i / (n - 1)
        for zz in (-3.4, 3.4):
            v, t = box(cx, 1.6, zz, 3.6, 3.2, 4.4)
            v, t, c = box_colored(cx, 1.6, zz, 3.6, 3.2, 4.4, np.array([0.22, 0.19, 0.16]) * rng.uniform(0.85, 1.25), top=1.35, side=0.85, bottom=0.5)
            parts.append((v, t, np.clip(c, 0, 1)))
    return merge(parts)

# ---------- надстройка-мостик ----------
def bridge():
    parts = []
    # основной объём
    parts.append(box_colored(14.0, H + 2.1, 0.0, 26.0, 4.2, 15.0,
                             np.array([0.20, 0.215, 0.235]), top=1.25, side=0.88, bottom=0.6))
    # рубка
    parts.append(box_colored(6.0, H + 4.4 + 1.6, 0.0, 9.0, 3.2, 9.0,
                             np.array([0.235, 0.25, 0.27]), top=1.3, side=0.9, bottom=0.62))
    # стеклянная полоса рубки
    parts.append((np.array([[1.6, H + 4.6, -4.6], [1.6, H + 4.6, 4.6],
                            [1.6, H + 7.0, 4.6], [1.6, H + 7.0, -4.6]], np.float32),
                  np.array([[0, 1, 2], [0, 2, 3]], np.uint32),
                  np.tile(np.array([1.0, 0.84, 0.5, 1.0]), (4, 1))))
    # мелкие блоки на палубе (оборудование)
    for (bx, bz, sx, sz, bh) in ((26.0, 9.2, 6.0, 4.0, 2.2), (26.0, -9.2, 6.0, 4.0, 2.2),
                                 (34.0, 0.0, 5.0, 6.0, 1.8), (-2.0, 9.6, 4.5, 3.0, 1.5),
                                 (-2.0, -9.6, 4.5, 3.0, 1.5)):
        parts.append(box_colored(bx, H + bh / 2, bz, sx, bh, sz,
                                 np.array([0.17, 0.185, 0.20]), top=1.3, side=0.85, bottom=0.6))
    return merge(parts)


# ---------- сборка GLB ----------
def main():
    b = GlbBuilder()
    m_hull = b.material('arc_hull', metallic=0.35, roughness=0.6)
    m_panel = b.material('arc_panels', metallic=0.45, roughness=0.55)
    m_glow = b.material('arc_glow', metallic=0.0, roughness=0.4)
    m_eng = b.material('arc_engine', metallic=0.2, roughness=0.7, double_sided=True)
    m_bay = b.material('arc_bay', metallic=0.1, roughness=0.9)

    tris_total = 0
    def add(name, merged, mat):
        nonlocal tris_total
        v, t, c = merged
        idx = b.mesh(name, v, t, c, mat)
        node = b.node(name, idx)
        tris_total += len(t)
        return node, len(v), len(t)

    info = {}
    info['hull'] = add('hull_core', hull_core(), m_hull)[1:]
    for s in range(SECTIONS):
        info['panel_%d' % s] = add('panel_%d' % s, section_panels(s), m_panel)[1:]
    info['bridge'] = add('bridge', bridge(), m_panel)[1:]
    info['seams'] = add('light_seams', seams(), m_glow)[1:]
    info['levitation'] = add('levitation', levitation(), m_glow)[1:]
    info['engines'] = add('engines', engines(), m_eng)[1:]
    info['bay'] = add('cargo_bay', bay(), m_bay)[1:]

    data = b.build('rainbow_arc')
    with open(os.path.join(P, 'rainbow_arc.glb'), 'wb') as f:
        f.write(data)
    print('nodes', len(b.nodes), 'meshes', len(b.meshes), 'tris', tris_total,
          'bytes', len(data))
    for k, (nv, nt) in info.items():
        print('  %-12s verts %5d tris %5d' % (k, nv, nt))

    # ---------- таблица режимов для контроллера ----------
    modes = {'flight': [], 'load': [], 'shield': [], 'lift': []}
    xs = [(SEC_EDGES[s] + SEC_EDGES[s + 1]) / 2 for s in range(SECTIONS)]
    for s, x in enumerate(xs):
        t = (x - X_NOSE) / L                       # 0 нос .. 1 корма
        # flight: панели прижаты
        modes['flight'].append([0.0, 0.0, 0.0])
        # load: днище/борта расходятся, палуба поднимается и уезжает к корме
        modes['load'].append([round(6.0 * (t - 0.35), 3),
                              round(3.2 + 2.6 * t, 3),
                              round(3.0 * (-1 if s % 2 else 1) * (0.4 + t), 3)])
        # shield: всё стянуто вплотную к корпусу, секции сдвинуты вперёд
        modes['shield'].append([round(-1.6 * (1 - t), 3), -0.35, 0.0])
        # lift: вся обшивка поднимается светом над корпусом
        modes['lift'].append([0.0, round(2.6 + 1.4 * math.sin(t * math.pi), 3),
                              round(1.2 * (-1 if s % 2 else 1), 3)])
    with open(os.path.join(P, 'modes.json'), 'w') as f:
        json.dump({'sections': SECTIONS, 'modes': modes}, f, indent=1)
    print('modes.json written')
    check_geometry()


def check_geometry():
    """Никаких пересечений: панели не наезжают друг на друга и не входят в корпус."""
    bad = 0
    n = len(BOXES)
    for i in range(n):
        ax0, ax1, ay0, ay1, az0, az1 = BOXES[i]
        for j in range(i + 1, n):
            bx0, bx1, by0, by1, bz0, bz1 = BOXES[j]
            ox = min(ax1, bx1) - max(ax0, bx0)
            oy = min(ay1, by1) - max(ay0, by0)
            oz = min(az1, bz1) - max(az0, bz0)
            if ox > 0.02 and oy > 0.02 and oz > 0.02:
                bad += 1
                if bad <= 6:
                    print('  ПЕРЕСЕЧЕНИЕ %d/%d: %.2f x %.2f x %.2f' % (i, j, ox, oy, oz))
    pen = []
    for (x0, x1, y0, y1, z0, z1) in BOXES:
        xm = (x0 + x1) / 2.0
        hw, yt, yb = half_width(xm), y_top(xm), y_bottom(xm)
        side = min(abs(z0), abs(z1)) > hw - 0.6      # панель борта
        top = not side and y1 > yt - 1.5             # панель палубы
        bot = not side and not top                   # панель днища
        if side:
            if min(abs(z0), abs(z1)) < hw - 0.05:
                pen.append(('борт', xm, min(abs(z0), abs(z1)), hw))
        elif top:
            if y0 < yt - 0.05:
                pen.append(('палуба', xm, y0, yt))
        else:
            if y1 > yb + 0.05:
                pen.append(('днище', xm, y1, yb))
    for p in pen[:6]:
        print('  ВХОД В КОРПУС:', p)
    print('проверка: панелей %d, пересечений %d, входов в корпус %d' % (n, bad, len(pen)))
    if bad or pen:
        raise SystemExit('geometry check failed')
    print('geometry: OK')


if __name__ == "__main__":
    main()
