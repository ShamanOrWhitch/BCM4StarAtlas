#!/usr/bin/env python3
"""Calico Compakt Hero — средний многоцелевой корабль (Star Atlas, CALCH, Rare).
46.6 × 30.1 × 11.5 м, экипаж 4 (пилот, штурман, 2 оператора вооружения),
18 слотов компонентов: 2 medium + 2 small fixed hardpoint, small и x-small
турель, medium и 2 x-small ракетных отсека, 2 medium + 2 small CM, Drone Port.

Собственная интерпретация по карточке маркета, галерее (19 кадров) и чертежу
с конфигурациями landing / flight — без копирования геометрии:

  * клиновидный фасетный корпус: тёмный «клюв» с фонарём, серебристо-белая
    обшивка с тёмными панелями и винно-красными полосами;
  * «почти полностью стеклянная крыша верхней палубы» — длинный фонарь во всю
    длину палубы в серебряных нервюрах, плюс пузырь кабины над пилотом;
  * крупное кольцо турели на верхней палубе (medium turret) с циановым
    свечением и двумя стволами — узел вращается, стволы поднимаются;
  * две высокие хвостовые плоскости: в посадке вертикально, в полёте
    отклоняются назад (конфигурации A / B с чертежа) — отдельные узлы;
  * боковые VTOL-пилоны с гребёнчатыми решётками и толкающими дисками вниз —
    они же держат полную ширину 30.1 м;
  * четыре тонкие посадочные стойки, кормовой грузовой трап (в cargo-режиме
    опускается), два ракетных отсека на палубе, люк дрона в днище,
    четыре пусковых блока контрмер;
  * маркировка: оранжевые шевроны, винные полосы, блок «4 CALCO» без шрифтов,
    предупреждающие полосы у трапа, габариты, прожекторы, оранжевые стробы.
"""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, cylinder

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261212)

# ---------------------------------------------------------------- габарит
L, W, H = 46.6, 30.1, 11.5
HX, HZ = L / 2, W / 2                 # 23.3 / 15.05
NOSE, TAIL = -23.3, 20.5              # тело; дюзы и плоскости идут дальше

# ---------------------------------------------------------------- цвета
WHITE = np.array([0.800, 0.805, 0.815])
SILVER = np.array([0.620, 0.640, 0.665])
SILVER_L = np.array([0.760, 0.775, 0.795])
SILVER_D = np.array([0.400, 0.415, 0.440])
GREY = np.array([0.270, 0.280, 0.300])
DARK = np.array([0.085, 0.088, 0.098])
DARK_M = np.array([0.150, 0.155, 0.170])
BRONZE = np.array([0.190, 0.160, 0.140])
BRONZE_L = np.array([0.280, 0.235, 0.195])
RED = np.array([0.430, 0.090, 0.105])
RED_L = np.array([0.610, 0.150, 0.160])
RED_D = np.array([0.250, 0.050, 0.060])
GLASS = np.array([0.055, 0.095, 0.120])
GLASS_L = np.array([0.160, 0.290, 0.360])
GLASS_T = np.array([0.075, 0.150, 0.185])
CYAN = np.array([0.32, 0.90, 1.00])
AMBER = np.array([1.000, 0.620, 0.200])
ORANGE = np.array([1.000, 0.400, 0.110])
NAVGREEN = np.array([0.30, 1.00, 0.45])
NAVRED = np.array([1.00, 0.22, 0.20])

LIGHT = np.array([0.42, 0.80, 0.42])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# ---------------------------------------------------------------- строитель
class PB:
    """Плоские фасетки с запечённым затенением (unlit)."""

    def __init__(self):
        self.V, self.T, self.C = [], [], []
        self.m = 1.0                     # -1 → зеркальная деталь (обход разворачиваем)

    @staticmethod
    def shade(n):
        lam = max(0.0, float(n @ LIGHT))
        sky = 0.20 * max(0.0, float(n[1])) - 0.12 * max(0.0, -float(n[1]))
        return 0.46 + 0.50 * lam + sky

    def tri(self, p0, p1, p2, color, mul=1.0):
        if self.m < 0:
            p1, p2 = p2, p1
        v = np.array([p0, p1, p2], np.float64)
        n = np.cross(v[1] - v[0], v[2] - v[0])
        ln = np.linalg.norm(n)
        if ln < 1e-9:
            return
        n /= ln
        b = len(self.V)
        col = np.clip(np.asarray(color, np.float64).reshape(-1)[:3] * self.shade(n) * mul, 0, 1)
        for p in v:
            self.V.append([float(p[0]), float(p[1]), float(p[2])])
        for _ in range(3):
            self.C.append([col[0], col[1], col[2], 1.0])
        self.T.append([b, b + 1, b + 2])

    def face(self, p0, p1, p2, p3, color, mul=1.0):
        self.tri(p0, p1, p2, color, mul)
        self.tri(p0, p2, p3, color, mul)

    def box(self, c, s, color, mul=1.0):
        cx, cy, cz = c
        sx, sy, sz = s[0] / 2.0, s[1] / 2.0, s[2] / 2.0
        x0, x1 = cx - sx, cx + sx
        y0, y1 = cy - sy, cy + sy
        z0, z1 = cz - sz, cz + sz
        self.face([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], color, mul)
        self.face([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], color, mul)
        self.face([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], color, mul)
        self.face([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], color, mul)
        self.face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, mul)
        self.face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, mul)

    def seg(self, p0, p1, w, t, color, ref=(0, 1, 0), mul=1.0):
        a = np.array(p1, np.float64) - np.array(p0, np.float64)
        ln = np.linalg.norm(a)
        if ln < 1e-9:
            return
        a = a / ln
        r = np.array(ref, np.float64)
        if abs(float(a @ r)) > 0.93:
            r = np.array([1.0, 0.0, 0.0]) if abs(float(a[0])) < 0.9 else np.array([0.0, 0.0, 1.0])
        s = np.cross(a, r)
        s /= np.linalg.norm(s)
        u = np.cross(s, a)
        u /= np.linalg.norm(u)
        hw, ht = w / 2.0, t / 2.0
        P0 = np.array(p0, np.float64)
        P1 = np.array(p1, np.float64)

        def cor(p, a1, a2):
            return list(p + s * a1 + u * a2)
        A = [cor(P0, -hw, -ht), cor(P0, hw, -ht), cor(P0, hw, ht), cor(P0, -hw, ht)]
        B = [cor(P1, -hw, -ht), cor(P1, hw, -ht), cor(P1, hw, ht), cor(P1, -hw, ht)]
        for k in range(4):
            k2 = (k + 1) % 4
            self.face(A[k], B[k], B[k2], A[k2], color, mul)
        self.face(A[0], A[1], A[2], A[3], color, mul)
        self.face(B[3], B[2], B[1], B[0], color, mul)

    def cyl(self, cx, cy, cz, r, ln, axis='x', seg=14, color=GREY, teeth=0, cap=True):
        v, t, c = cylinder(cx, cy, cz, r, ln, axis=axis, seg=seg, color=color,
                           teeth=teeth, cap=cap)
        base = len(self.V)
        self.V.extend(v.tolist())
        self.C.extend(c.tolist())
        self.T.extend((t + base).tolist())

    def get(self):
        return (np.array(self.V, np.float32), np.array(self.T, np.uint32),
                np.array(self.C, np.float32))

    def bounds(self):
        if not self.V:
            return None
        v = np.array(self.V, np.float32)
        return (float(v[:, 0].min()), float(v[:, 0].max()),
                float(v[:, 1].min()), float(v[:, 1].max()),
                float(v[:, 2].min()), float(v[:, 2].max()))


CHECK = []




CHECK = []


def vert_bounds(pb, deg_y=0.0, deg_z=0.0, off=(0, 0, 0)):
    """Точный AABB по вершинам с поворотами вокруг Y и Z и переносом."""
    v = np.array(pb.V, np.float64)
    if deg_z:
        cz_, sz_ = np.cos(np.deg2rad(deg_z)), np.sin(np.deg2rad(deg_z))
        x = v[:, 0] * cz_ - v[:, 1] * sz_
        y = v[:, 0] * sz_ + v[:, 1] * cz_
        v = np.stack([x, y, v[:, 2]], axis=1)
    if deg_y:
        cy_, sy_ = np.cos(np.deg2rad(deg_y)), np.sin(np.deg2rad(deg_y))
        x = v[:, 0] * cy_ + v[:, 2] * sy_
        z = -v[:, 0] * sy_ + v[:, 2] * cy_
        v = np.stack([x, v[:, 1], z], axis=1)
    v = v + np.array(off, np.float64)
    return (float(v[:, 0].min()), float(v[:, 0].max()), float(v[:, 1].min()),
            float(v[:, 1].max()), float(v[:, 2].min()), float(v[:, 2].max()))


def check(pb, kind, off=(0, 0, 0), rot_y=0.0, rot_z=0.0):
    if pb is None or not pb.V:
        return
    CHECK.append(vert_bounds(pb, rot_y, rot_z, off) + (kind,))


def loft(pb, xs, section_fn, col_fn, cap=True, cap_col=None):
    """Лофт по сечениям: xs — станции, section_fn(x) → список (y, z)."""
    secs = [section_fn(x) for x in xs]
    n = len(secs[0])
    for i in range(len(xs) - 1):
        A, B = secs[i], secs[i + 1]
        x0, x1 = xs[i], xs[i + 1]
        cyA = np.mean([p[0] for p in A])
        cyB = np.mean([p[0] for p in B])
        for k in range(n):
            k2 = (k + 1) % n
            p0 = (x0, A[k][0], A[k][1])
            p1 = (x1, B[k][0], B[k][1])
            p2 = (x1, B[k2][0], B[k2][1])
            p3 = (x0, A[k2][0], A[k2][1])
            nrm = np.cross(np.subtract(p1, p0), np.subtract(p2, p0))
            mid = np.mean(np.array([p0, p1, p2, p3]), axis=0)
            ref = mid - np.array([(x0 + x1) / 2, (cyA + cyB) / 2, 0.0])
            if float(nrm @ ref) < 0:
                p1, p3 = p3, p1
            pb.face(p0, p1, p2, p3, col_fn(i, k))
    if cap:
        for idx, x in ((0, xs[0]), (-1, xs[-1])):
            S = secs[idx]
            cy = np.mean([p[0] for p in S])
            cz = np.mean([p[1] for p in S])
            col = cap_col if cap_col is not None else col_fn(0, 0) * 0.9
            for k in range(n):
                k2 = (k + 1) % n
                pb.tri((x, cy, cz), (x, S[k][0], S[k][1]), (x, S[k2][0], S[k2][1]), col)


def ring(pb, x, y, z, r_out, r_in, thick, seg, col_out, col_in, axis='y'):
    """Кольцо (тор) из квадов: внешняя и внутренняя стенки + торцы."""
    for k in range(seg):
        a0 = 2 * math.pi * k / seg
        a1 = 2 * math.pi * (k + 1) / seg
        def pt(r, a, t):
            if axis == 'y':
                return (x + math.cos(a) * r, y + t, z + math.sin(a) * r)
            return (x + t, y + math.cos(a) * r, z + math.sin(a) * r)
        o0, o1 = pt(r_out, a0, -thick / 2), pt(r_out, a1, -thick / 2)
        o2, o3 = pt(r_out, a1, thick / 2), pt(r_out, a0, thick / 2)
        i0, i1 = pt(r_in, a0, -thick / 2), pt(r_in, a1, -thick / 2)
        i2, i3 = pt(r_in, a1, thick / 2), pt(r_in, a0, thick / 2)
        pb.face(o0, o1, o2, o3, col_out)
        pb.face(i1, i0, i3, i2, col_in)
        pb.face(o3, o2, i2, i3, col_in * 1.25)
        pb.face(o1, o0, i0, i1, col_in * 0.8)


# ---------------------------------------------------------------- профиль тела
BX = [NOSE, -21.0, -18.0, -14.0, -9.0, -3.0, 3.0, 9.0, 13.0, 17.0, TAIL]
BW = [0.95, 2.10, 3.30, 4.70, 5.60, 6.00, 6.10, 5.95, 5.50, 4.70, 3.80]
BYB = [4.30, 3.70, 3.30, 3.00, 2.75, 2.65, 2.65, 2.75, 2.95, 3.25, 3.60]
BYT = [5.60, 6.30, 7.10, 7.90, 8.35, 8.55, 8.55, 8.45, 8.25, 7.95, 7.70]


def bwid(x):
    return float(np.interp(x, BX, BW))


def bbelly(x):
    return float(np.interp(x, BX, BYB))


def btop(x):
    return float(np.interp(x, BX, BYT))


def body_sec(x):
    """Фасетный шпангоут: плоское днище, широкий боковой фасет, скошенная палуба."""
    w, yb, yt = bwid(x), bbelly(x), btop(x)
    h = yt - yb
    return [(yb, -0.55 * w), (yb + 0.22 * h, -0.93 * w), (yb + 0.50 * h, -1.00 * w),
            (yb + 0.80 * h, -0.78 * w), (yt, -0.44 * w),
            (yt, 0.44 * w), (yb + 0.80 * h, 0.78 * w), (yb + 0.50 * h, 1.00 * w),
            (yb + 0.22 * h, 0.93 * w), (yb, 0.55 * w)]


def hull_palette(i, k, band):
    """Пояса: днище графит, борт белый/серебро, верх — тёмный карбон палубы."""
    if k in (0, 9):
        return DARK_M * 1.05                      # днище
    if k in (1, 8):
        return BRONZE_L if band == 'fwd' else SILVER_D
    if k in (2, 7):
        return DARK_M if band == 'fwd' else (SILVER_L if i % 2 else SILVER)
    if k in (3, 6):
        return WHITE if i % 3 else SILVER_L       # широкий белый борт
    return DARK_M * (1.0 + 0.12 * (i % 3))        # палуба — тёмный карбон


def hull_fwd():
    """Нос: тёмный клюв с фонарём, скошенные скулы, пузырь кабины, датчики."""
    pb = PB()
    xs = [NOSE, -21.6, -20.0, -18.0, -16.0, -14.0]
    loft(pb, xs, body_sec, lambda i, k: hull_palette(i, k, 'fwd'), cap_col=DARK)
    # тёмный «клюв» на самом носу: накладка по скулам и по нижней кромке
    for zs in (-1, 1):
        pb.m = zs
        pb.face((-23.15, 4.55, zs * 0.55), (-20.6, 4.20, zs * 1.90),
                (-20.6, 5.30, zs * 2.05), (-23.05, 5.10, zs * 0.60), DARK)
        pb.face((-20.6, 5.30, zs * 2.05), (-20.6, 6.35, zs * 1.95),
                (-22.9, 6.10, zs * 0.70), (-23.05, 5.10, zs * 0.60), BRONZE)
        # оранжевый маркер на скуле
        pb.box((-22.2, 5.25, zs * 1.35), (0.9, 0.16, 0.5), ORANGE)
    pb.m = 1.0
    # носовой фонарь (тёмное стекло) — «клюв» светится изнутри
    pb.face((-23.1, 5.20, -0.52), (-23.1, 5.20, 0.52), (-22.2, 6.05, 0.62),
            (-22.2, 6.05, -0.62), GLASS_T * 1.4)
    # кабина и остекление — в узле canopy, здесь только посадочный комингс
    pb.face((-20.8, 6.42, -0.92), (-20.8, 6.42, 0.92), (-15.0, 7.66, 1.86),
            (-15.0, 7.66, -1.86), SILVER_D)
    # датчики и штанга под носом
    pb.seg((-21.0, 4.10, 0.0), (-22.4, 3.10, 0.0), 0.18, 0.22, GREY, ref=(1, 0, 0))
    pb.box((-22.5, 2.95, 0.0), (0.5, 0.4, 0.9), DARK_M)
    pb.box((-22.5, 2.70, 0.0), (0.3, 0.2, 0.3), AMBER)
    # решётка датчиков за кабиной
    for k in range(4):
        pb.box((-13.2, 8.42, (k - 1.5) * 0.55), (1.6, 0.16, 0.34), DARK_M)
    return pb


def hull_mid():
    """Серебристо-белое тело: панели, тёмные вставки, винные полосы, воздушный шлюз."""
    pb = PB()
    xs = [-14.02, -12.0, -9.0, -6.0, -3.0, 0.0, 3.0, 6.0, 9.0]
    loft(pb, xs, body_sec, lambda i, k: hull_palette(i, k, 'mid'), cap=True,
         cap_col=SILVER_D)
    for zs in (-1, 1):
        for x in (-11.0, -7.5, -4.0, 0.5, 5.0):
            w, yb, yt = bwid(x), bbelly(x), btop(x)
            # тёмные панели на боку
            pb.box((x, yb + (yt - yb) * 0.55, zs * (w * 0.96)),
                   (2.4, (yt - yb) * 0.30, 0.22), DARK_M)
            # серебряная окантовка панели
            pb.box((x, yb + (yt - yb) * 0.55, zs * (w * 0.955)),
                   (2.6, (yt - yb) * 0.36, 0.10), SILVER_L)
        # двойная винная полоса по борту
        pb.box((-6.0, bbelly(-6.0) + (btop(-6.0) - bbelly(-6.0)) * 0.80, zs * 5.30),
               (17.0, 0.50, 0.30), RED)
        pb.box((-8.0, bbelly(-6.0) + (btop(-6.0) - bbelly(-6.0)) * 0.34, zs * 5.35),
               (13.0, 0.26, 0.26), RED_D)
        # циановая полоса-подсветка под панелью
        pb.box((-6.0, bbelly(-6.0) + (btop(-6.0) - bbelly(-6.0)) * 0.70, zs * 5.42),
               (11.0, 0.14, 0.16), CYAN * 0.75)
        # воздушный шлюз (Air-Lock) с рамой
        pb.box((-9.0, 5.05, zs * 6.05), (2.6, 2.2, 0.30), SILVER_D)
        pb.box((-9.0, 5.05, zs * 6.14), (2.1, 1.8, 0.18), DARK_M)
        pb.box((-9.0, 5.05, zs * 6.20), (0.18, 1.5, 0.10), GREY)
        # гребёнка радиатора на корме борта
        for k in range(6):
            pb.box((7.4, 4.15 + k * 0.42, zs * 5.35), (2.6, 0.16, 0.30), SILVER_L)
    # палуба: тёмный карбон, два серебряных рельса, одна винная полоса
    pb.box((-2.5, btop(-2.5) + 0.06, 0.0), (23.0, 0.14, 9.0), DARK_M * 0.95)
    for zs in (-1, 1):
        pb.box((-2.5, btop(-2.5) + 0.12, zs * 4.30), (23.0, 0.18, 0.36), SILVER_L)
        pb.box((-2.5, btop(-2.5) + 0.14, zs * 2.05), (20.0, 0.10, 0.22), RED * 0.95)
        for x in (-11.0, -6.0, -1.0, 4.0):
            pb.box((x, btop(x) + 0.16, zs * 3.40), (1.6, 0.10, 0.5), GREY * 0.9)
        pb.box((-2.5, btop(-2.5) + 0.15, zs * 3.80), (22.0, 0.08, 0.14), AMBER * 0.8)
    return pb


def hull_rear():
    """Кормовой блок: панели, посадочные площадки, кормовой срез под трап."""
    pb = PB()
    xs = [9.0, 13.0, 17.0, TAIL]
    loft(pb, xs, body_sec, lambda i, k: hull_palette(i, k, 'rear'), cap=True,
         cap_col=DARK_M)
    for zs in (-1, 1):
        pb.box((14.0, 6.6, zs * 4.9), (7.0, 0.5, 0.6), SILVER_D)
        pb.box((14.0, 6.6, zs * 4.95), (5.0, 0.2, 0.24), RED_L * 0.9)
        for k in range(4):
            pb.box((12.0 + k * 1.9, 4.4, zs * 4.55), (1.4, 0.5, 0.3), DARK_M)
    # кормовой срез: стенка над трапом, рама и предупреждающие полосы
    pb.box((TAIL - 0.22, 6.10, 0.0), (0.34, 4.2, 7.0), SILVER_D)
    pb.box((TAIL - 0.40, 6.10, 0.0), (0.16, 3.6, 6.2), DARK_M)
    for k in range(5):
        pb.box((TAIL - 0.46, 4.25 + k * 0.02, (k - 2) * 1.25), (0.12, 1.9, 0.6),
               SILVER_L if k % 2 else ORANGE * 0.85)
    pb.box((TAIL - 0.30, 4.05, 0.0), (0.5, 0.34, 6.6), SILVER)
    # порог грузового пола (под ним убирается трап)
    pb.box((TAIL - 1.9, 3.28, 0.0), (3.4, 0.26, 5.6), SILVER_D)
    # кормовые решётки охлаждения
    for k in range(5):
        pb.box((TAIL - 1.2, 7.05 + k * 0.0, (k - 2) * 1.15), (1.8, 0.9, 0.30), DARK_M)
    return pb


def deck_top(x):
    """Верх палубного пояса: там, где лежат стёкла (с учётом накладки палубы)."""
    return btop(x) + 0.10


def dome(pb, stations, frac, height, glass_col, frame_col, y_lift=0.0):
    """Остекление-«оранжерея»: основание лежит НА палубе, свод поднимается вверх.
    Никаких висящих в воздухе плоскостей: первый пояс сечения стоит на обшивке."""
    secs = []
    def sec(x):
        y0 = deck_top(x) + y_lift
        w = frac * 0.44 * bwid(x) * 0.88
        h = height
        return [(y0 - 0.03, -w), (y0 + 0.52 * h, -0.70 * w), (y0 + h, 0.0),
                (y0 + 0.52 * h, 0.70 * w), (y0 - 0.03, w)]
    for x in stations:
        secs.append(sec(x))
    loft(pb, stations, sec, lambda i, k: glass_col if k in (0, 1, 2, 3) else frame_col * 0.9)
    # рамы по станциям: обвод по контуру сечения
    for st, x in zip(secs, stations):
        pts = [(x, p[0], p[1]) for p in st]
        for a, b in zip(pts[:-1], pts[1:]):
            pb.seg(a, b, 0.10, 0.10, frame_col, ref=(1, 0, 0))
        pb.box((x, st[0][0] + 0.06, st[0][1] + 0.11), (0.24, 0.18, 0.22), frame_col)
        pb.box((x, st[0][0] + 0.06, st[4][1] - 0.11), (0.24, 0.18, 0.22), frame_col)
    # продольные рельсы по основанию — прижимают стекло к палубе
    for sgn in (-1, 1):
        for k in range(len(stations) - 1):
            x0, x1 = stations[k], stations[k + 1]
            w0 = frac * 0.44 * bwid(x0)
            w1 = frac * 0.44 * bwid(x1)
            y0 = deck_top(x0) + y_lift
            y1 = deck_top(x1) + y_lift
            pb.face((x0, y0 - 0.02, sgn * (w0 - 0.16)), (x1, y1 - 0.02, sgn * (w1 - 0.16)),
                    (x1, y1 + 0.12, sgn * (w1 - 0.02)), (x0, y0 + 0.12, sgn * (w0 - 0.02)),
                    frame_col)
            pb.face((x0, y0 - 0.02, sgn * (w0 - 0.36)), (x1, y1 - 0.02, sgn * (w1 - 0.36)),
                    (x1, y1 - 0.02, sgn * (w1 - 0.16)), (x0, y0 - 0.02, sgn * (w0 - 0.16)),
                    frame_col * 0.85)
    # тёплая подсветка интерьера под стеклом
    for k in range(len(stations) - 1):
        x0, x1 = stations[k], stations[k + 1]
        y0, y1 = deck_top(x0) + y_lift + 0.05, deck_top(x1) + y_lift + 0.05
        w0 = frac * 0.44 * bwid(x0) * 0.55
        w1 = frac * 0.44 * bwid(x1) * 0.55
        for sgn in (-1, 1):
            pb.face((x0 + 0.10, y0 + 0.01, sgn * w0 * 0.72), (x1 - 0.10, y1 + 0.01, sgn * w1 * 0.72),
                    (x1 - 0.10, y1 + 0.01, sgn * w1 * 0.96), (x0 + 0.10, y0 + 0.01, sgn * w0 * 0.96),
                    AMBER * 0.60)


def canopy():
    """Два остеклённых объёма: фонарь кабины в носу и стеклянная крыша палубы.
    Оба сидят на обшивке, рамы прижимают стекло к палубе."""
    pb = PB()
    # фонарь кабины (нос): узкий, по профилю клюва
    dome(pb, [-20.9, -19.6, -18.2, -16.8, -15.6, -14.9], 0.92, 0.62,
         GLASS_T * 0.95, SILVER, y_lift=0.06)
    # стеклянная крыша верхней палубы
    dome(pb, [-13.6, -11.0, -8.0, -5.0, -2.0, 0.6, 2.4], 0.86, 0.42,
         GLASS_T * 0.80, SILVER, y_lift=0.02)
    # комингс-переход между кабиной и крышей — по контуру палубы на стыке
    hw = 0.44 * bwid(-14.75) * 0.94
    pb.box((-14.3, deck_top(-14.3) + 0.06, 0.0), (0.88, 0.20, 2 * hw), SILVER_D)
    # поперечные нервюры крыши (в дополнение к рамам купола)
    for x in (-9.5, -3.5, 1.5):
        pb.box((x, deck_top(x) + 0.22, 0.0), (0.22, 0.22, 2 * 0.86 * 0.44 * bwid(x) * 0.96),
               SILVER_L)
    return pb


def turret():
    """Кольцо турели: локальный ноль — центр погона на палубе."""
    pb = PB()
    y = 0.0
    pb.cyl(0.0, y + 0.10, 0.0, 2.95, 0.20, axis='y', seg=20, color=SILVER_D)
    ring(pb, 0.0, y + 0.30, 0.0, 2.80, 2.05, 0.42, 20, WHITE, SILVER_D)
    ring(pb, 0.0, y + 0.30, 0.0, 2.12, 1.92, 0.30, 20, CYAN * 1.05, CYAN * 0.7)
    pb.cyl(0.0, y + 0.34, 0.0, 1.55, 0.28, axis='y', seg=16, color=GREY)
    pb.cyl(0.0, y + 0.50, 0.0, 1.20, 0.22, axis='y', seg=16, color=DARK)
    # сектора обоймы
    for k in range(8):
        a = 2 * math.pi * k / 8
        pb.box((math.cos(a) * 2.45, y + 0.46, math.sin(a) * 2.45),
               (0.55, 0.12, 0.55), DARK_M)
    return pb


def turret_guns():
    """Стволы турели: локальный ноль в центре кольца, стволы смотрят вперёд."""
    pb = PB()
    pb.box((0.0, 0.30, 0.0), (1.9, 0.62, 1.7), SILVER)
    pb.box((0.0, 0.66, 0.0), (1.3, 0.30, 1.2), SILVER_D)
    for zs in (-1, 1):
        pb.m = zs
        pb.seg((-0.2, 0.28, zs * 0.55), (-3.7, 0.28, zs * 0.60), 0.26, 0.22, GREY,
               ref=(0, 1, 0))
        pb.cyl(-3.9, 0.28, zs * 0.60, 0.24, 0.5, axis='x', seg=8, color=DARK_M)
        pb.box((-1.6, 0.28, zs * 0.60), (0.5, 0.34, 0.34), SILVER_D)
    pb.m = 1.0
    pb.box((0.9, 0.30, 0.0), (0.7, 0.5, 1.4), GREY)
    pb.box((1.4, 0.55, 0.0), (0.3, 0.3, 0.8), AMBER)
    return pb


def fin(sign):
    """Высокая хвостовая плоскость. Локальный ноль — шарнир у палубы."""
    z = lambda v: sign * v
    pb = PB()
    pb.m = sign
    yb = 0.0
    # контур в плоскости X-Y (y вверх), толщина по Z
    base_f, base_r = (-3.6, 0.0), (4.0, 0.0)
    tip_f, tip_r = (2.6, 3.05), (4.7, 3.05)
    t = 0.30
    A = (base_f[0], yb, z(t)); B = (base_r[0], yb, z(t))
    C = (tip_r[0], tip_f[1], z(t * 0.7)); D = (tip_f[0], tip_f[1], z(t * 0.7))
    A2 = (base_f[0], yb, z(-t)); B2 = (base_r[0], yb, z(-t))
    C2 = (tip_r[0], tip_f[1], z(-t * 0.7)); D2 = (tip_f[0], tip_f[1], z(-t * 0.7))
    pb.face(A, B, C, D, SILVER_L)                  # наружная плоскость
    pb.face(A2, D2, C2, B2, SILVER)                # внутренняя
    pb.face(A, A2, B2, B, SILVER_D)                # корень
    pb.face(D, D2, C2, C, SILVER_D)                # торец
    pb.face(B, B2, C2, C, SILVER_D)                # задняя кромка
    pb.face(A, D, D2, A2, SILVER_L * 0.95)         # передняя кромка
    # гребёнчатые решётки у корня (белые рёбра с тёмными ячейками)
    for k in range(5):
        y0 = 0.25 + k * 0.52
        pb.box((-2.6 + k * 0.15, y0, z(t + 0.10)), (2.0, 0.30, 0.14), WHITE)
        pb.box((-2.6 + k * 0.15, y0 + 0.15, z(t + 0.16)), (1.6, 0.16, 0.08), DARK)
    # тёмный внутренний карбон с белыми нервюрами
    pb.face((-2.9, 0.05, z(-t * 0.55)), (2.6, 0.05, z(-t * 0.55)),
            (2.4, 1.9, z(-t * 0.4)), (-2.4, 1.9, z(-t * 0.4)), DARK_M)
    for k in range(4):
        pb.box((-2.0 + k * 1.5, 0.95, z(-t * 0.5)), (0.22, 1.7, 0.10), SILVER_L)
    # винная полоса и оранжевый маркер на законцовке
    pb.make_strip = None
    pb.face((2.9, 1.6, z(t + 0.02)), (4.6, 1.6, z(t + 0.02)),
            (4.7, 2.4, z(t * 0.75)), (3.1, 2.4, z(t * 0.75)), RED)
    pb.box((4.35, 2.85, z(t * 0.72)), (0.55, 0.20, 0.18), ORANGE)
    pb.box((-0.4, 2.55, z(t * 0.72)), (2.2, 0.14, 0.16), DARK_M)
    return pb


def winglet(sign):
    """Боковой VTOL-пилон: плита, гребёнки, обтекатель, законцовка. Держит ширину."""
    z = lambda v: sign * v
    pb = PB()
    pb.m = sign
    # корневой обтекатель, срастающийся с бортом
    pb.box((0.0, 0.10, z(0.35)), (5.6, 1.55, 1.30), SILVER_D)
    pb.box((0.0, 0.32, z(0.55)), (4.6, 0.95, 1.10), SILVER_L)
    pb.box((0.0, -0.30, z(1.35)), (4.9, 0.45, 1.6), BRONZE_L)
    pb.box((0.0, 0.62, z(1.35)), (4.4, 0.22, 1.5), WHITE)
    # верхняя консоль-крылышко
    pb.face((-2.9, 0.72, z(1.6)), (2.9, 0.72, z(1.6)),
            (2.3, 0.60, z(5.2)), (-2.3, 0.60, z(5.2)), WHITE)
    pb.face((-2.9, 0.72, z(1.6)), (-2.3, 0.60, z(5.2)),
            (-2.0, 0.42, z(5.2)), (-2.4, 0.62, z(1.0)), SILVER_D)
    # плита пилона наружу
    pb.face((-2.4, -0.30, z(1.0)), (2.4, -0.30, z(1.0)),
            (2.2, -0.10, z(6.2)), (-0.4, -0.10, z(6.2)), SILVER)          # низ (скошен)
    pb.face((-2.4, 0.62, z(1.0)), (2.4, 0.62, z(1.0)),
            (2.2, 0.42, z(6.2)), (-0.4, 0.42, z(6.2)), SILVER_L)          # верх
    pb.face((-2.4, -0.30, z(1.0)), (-0.4, -0.10, z(6.2)),
            (-0.4, 0.42, z(6.2)), (-2.4, 0.62, z(1.0)), SILVER_D)         # передняя
    pb.face((2.4, -0.30, z(1.0)), (2.4, 0.62, z(1.0)),
            (2.2, 0.42, z(6.2)), (2.2, -0.10, z(6.2)), SILVER_D)          # задняя
    # винная кромка по передней линии и законцовочное лезвие
    pb.face((-2.3, 0.58, z(1.05)), (-0.5, 0.38, z(6.1)),
            (-0.5, 0.50, z(6.1)), (-2.3, 0.70, z(1.05)), RED)
    pb.face((-0.4, 0.42, z(6.2)), (2.2, 0.42, z(6.2)),
            (1.9, 0.95, z(7.0)), (0.2, 0.95, z(7.0)), SILVER_L)
    pb.face((-0.4, 0.42, z(6.2)), (0.2, 0.95, z(7.0)),
            (0.2, 0.42, z(7.0)), (-0.4, 0.42, z(6.2)), SILVER)
    # обтекатель-гондола с толкающими дисками
    pb.box((0.0, 0.05, z(7.15)), (4.4, 1.70, 2.60), SILVER_L)
    pb.box((0.0, 0.05, z(8.30)), (3.6, 1.35, 0.55), SILVER_D)
    # гребёнчатые решётки сверху гондолы (как на кадрах)
    pb.box((0.0, 0.94, z(7.15)), (4.0, 0.16, 2.15), DARK_M)
    for k in range(5):
        pb.box((-1.6 + k * 0.8, 1.00, z(7.15)), (0.30, 0.26, 1.95), WHITE)
    # боковые створки гондолы и винная полоса
    for dz in (-1.45, 1.45):
        pb.box((0.0, 0.14, z(7.15) + dz), (4.1, 0.9, 0.30), SILVER_D)
    pb.box((0.0, -0.62, z(7.15)), (3.9, 0.22, 2.3), BRONZE_L)
    # винная полоса на гондоле и оранжевый огонёк
    pb.box((0.0, 0.30, z(8.38)), (3.2, 0.26, 0.30), RED_L)
    pb.box((1.7, 0.20, z(7.15)), (0.5, 0.5, 1.5), DARK_M)
    # законцовочный плавник
    pb.face((-0.8, -0.60, z(8.42)), (0.8, -0.60, z(8.42)),
            (0.6, 0.80, z(8.30)), (-0.6, 0.80, z(8.30)), SILVER)
    return pb


def vtol(sign):
    """Толкающие диски VTOL вниз под гондолой (свечение, свой узел)."""
    pb = PB()
    for dz in (-1.0, 0.0, 1.0):
        pb.cyl(0.0, -0.72, sign * (7.15 + dz * 0.62), 0.60, 0.16, axis='y', seg=12,
               color=CYAN * 0.95)
        pb.cyl(0.0, -0.80, sign * (7.15 + dz * 0.62), 0.38, 0.10, axis='y', seg=12,
               color=WHITE * 0.9)
    return pb


def leg(idx):
    """Посадочная стойка: локальный ноль у днища, стопа на Y = 0."""
    pb = PB()
    yb = bbelly(LEGS[idx][0])
    pb.box((0.0, -0.10, 0.0), (1.1, 0.55, 1.1), SILVER_D)
    pb.seg((0.0, -0.25, 0.0), (0.25, -yb + 0.35, 0.0), 0.42, 0.55, SILVER, ref=(0, 0, 1))
    pb.seg((0.0, -0.25, 0.0), (0.0, -yb + 0.55, 0.0), 0.22, 0.26, SILVER_L, ref=(0, 0, 1))
    pb.box((0.25, -yb + 0.22, 0.0), (1.5, 0.30, 1.3), SILVER_D)
    pb.box((0.25, -yb + 0.06, 0.0), (1.9, 0.16, 1.6), GREY)
    pb.box((0.25, -yb + 0.02, 0.0), (1.2, 0.10, 1.0), AMBER * 0.8)
    return pb


LEGS = [(-12.0, 3.35), (-12.0, -3.35), (12.6, 3.35), (12.6, -3.35)]


def ramp():
    """Кормовой грузовой трап. Локальный ноль — шарнир на днище у кормового
    среза; полотно идёт назад по +X, поэтому вращается вокруг Z (поперечной
    оси) и уходит вниз, к палубе площадки. Вокруг X его крутить нельзя —
    полотно складывалось вбок, в сопла двигателей."""
    pb = PB()
    ln = 3.0
    hw0, hw1 = 2.95, 2.55                      # ширина у шарнира и на законцовке
    # настил: нижняя обшивка, верхняя (рабочая) поверхность
    pb.face((0.0, -0.20, -hw0), (ln, -0.20, -hw1), (ln, -0.20, hw1), (0.0, -0.20, hw0),
            SILVER_D)
    pb.face((0.0, 0.04, -hw0), (ln, 0.04, -hw1), (ln, 0.04, hw1), (0.0, 0.04, hw0),
            SILVER_L)
    # боковые балки полотна
    for sgn in (-1, 1):
        pb.m = sgn
        pb.face((0.0, -0.20, sgn * hw0), (ln, -0.20, sgn * hw1),
                (ln, 0.10, sgn * hw1), (0.0, 0.10, sgn * hw0), SILVER)
        pb.face((0.0, 0.10, sgn * hw0), (ln, 0.10, sgn * hw1),
                (ln, 0.16, sgn * (hw1 - 0.22)), (0.0, 0.16, sgn * (hw0 - 0.22)), SILVER_D)
    pb.m = 1.0
    # поперечные рёбра настила и противоскользящие полосы
    for k in range(5):
        x = 0.28 + k * 0.56
        hw = hw0 + (hw1 - hw0) * (x / ln)
        pb.box((x, 0.10, 0.0), (0.26, 0.14, 2 * hw - 0.5), GREY)
    for k in range(2):
        x = 0.55 + k * 1.25
        hw = hw0 + (hw1 - hw0) * (x / ln)
        pb.face((x, 0.12, -hw + 0.35), (x + 0.5, 0.12, -hw + 0.35),
                (x + 0.5, 0.12, -hw + 1.55), (x, 0.12, -hw + 1.55), ORANGE * 0.9)
        pb.face((x, 0.12, hw - 1.55), (x + 0.5, 0.12, hw - 1.55),
                (x + 0.5, 0.12, hw - 0.35), (x, 0.12, hw - 0.35), ORANGE * 0.9)
    # торцевая кромка с упором в палубу площадки
    pb.box((ln - 0.06, -0.02, 0.0), (0.14, 0.34, 2 * hw1), DARK_M)
    pb.box((ln - 0.05, -0.20, 0.0), (0.22, 0.30, 2 * hw1 - 0.4), GREY)
    # гидроцилиндры по бортам (видно в открытом положении)
    for sgn in (-1, 1):
        pb.m = sgn
        pb.seg((0.25, 0.22, sgn * (hw0 - 0.55)), (1.9, 0.22, sgn * (hw1 - 0.35)),
               0.14, 0.14, SILVER_L, ref=(0, 1, 0))
    pb.m = 1.0
    return pb


RAMP_HINGE = (TAIL - 0.30, 3.16, 0.0)


def bay_wells():
    """Шахты ракетных отсеков на палубе: тёмные колодцы с трубами (статика)."""
    pb = PB()
    for zs in (-1, 1):
        pb.m = zs
        pb.box((13.6, btop(13.6) + 0.02, zs * 1.55), (5.0, 0.20, 2.2), DARK_M)
        for k in range(4):
            pb.cyl(12.0 + k * 1.15, btop(13.6) + 0.10, zs * 1.5, 0.34, 0.5, axis='y',
                   seg=8, color=DARK)
    pb.m = 1.0
    return pb


def bay_door(sign):
    """Крышка ракетного отсека: петля у внешней кромки, панель идёт внутрь."""
    pb = PB()
    pb.m = sign
    pb.box((0.0, 0.0, sign * -0.75), (5.2, 0.26, 1.55), SILVER_L)
    pb.box((0.0, 0.10, sign * -1.10), (4.5, 0.14, 0.80), SILVER)
    pb.box((0.0, 0.16, sign * -0.05), (0.45, 0.14, 0.4), ORANGE)
    pb.box((0.0, -0.02, sign * -0.75), (4.9, 0.10, 1.35), SILVER_D)
    pb.m = 1.0
    return pb


def drone_port():
    """Люк дрона в днище: сдвижная крышка с направляющими."""
    pb = PB()
    x = 2.0
    yb = bbelly(x)
    pb.box((0.0, -0.10, 0.0), (3.6, 0.22, 3.0), DARK_M)
    for k in range(3):
        pb.box((0.0, 0.02, (k - 1) * 0.95), (3.2, 0.14, 0.30), GREY)
    pb.box((0.0, -0.20, 0.0), (2.6, 0.12, 2.2), CYAN * 0.6)
    pb.box((1.0, -0.04, 0.0), (1.2, 0.20, 2.6), SILVER_D)
    return pb


ENGINES = [(-2.10, 5.80), (2.10, 5.80), (-2.10, 7.45), (2.10, 7.45)]   # (z, y)


def engines():
    pb = PB()
    for (cz, cy) in ENGINES:
        pb.cyl(TAIL - 1.6, cy, cz, 1.12, 2.4, axis='x', seg=14, color=GREY)
        pb.cyl(TAIL + 0.4, cy, cz, 1.28, 1.7, axis='x', seg=14, color=WHITE)
        pb.cyl(TAIL + 1.1, cy, cz, 1.34, 0.6, axis='x', seg=14, color=SILVER_D)
        pb.cyl(TAIL + 1.45, cy, cz, 1.10, 0.4, axis='x', seg=14, color=DARK)
        for k in range(3):
            a = 2 * math.pi * k / 3 + 0.4
            pb.box((TAIL + 1.2, cy + math.cos(a) * 1.35, cz + math.sin(a) * 1.35),
                   (1.2, 0.45, 0.45), GREY)
    # центральная балка двигательного отсека
    pb.box((TAIL - 0.6, 6.45, 0.0), (2.0, 2.6, 1.5), SILVER_D)
    return pb


def thrusters():
    pb = PB()
    for (cz, cy) in ENGINES:
        r, seg = 1.15, 14
        for k in range(seg):
            a0 = 2 * math.pi * k / seg
            a1 = 2 * math.pi * (k + 1) / seg
            pb.tri((TAIL + 1.98, cy, cz),
                   (TAIL + 1.98, cy + math.cos(a0) * r, cz + math.sin(a0) * r),
                   (TAIL + 1.98, cy + math.cos(a1) * r, cz + math.sin(a1) * r),
                   CYAN * 0.95)
        pb.tri((TAIL + 1.98, cy, cz), (TAIL + 1.98, cy + 0.55, cz),
               (TAIL + 1.98, cy, cz + 0.55), WHITE)
    return pb


def cms():
    """Контрмеры: 2 medium + 2 small пусковых блока по бортам кормы."""
    pb = PB()
    for zs in (-1, 1):
        pb.m = zs
        for (x, y, w, h) in ((10.6, 6.20, 1.5, 1.1), (16.4, 6.05, 1.2, 0.9)):
            pb.box((x, y, zs * 5.30), (1.9, 1.3, 0.85), SILVER_D)
            for r in range(3):
                for c in range(2):
                    pb.cyl(x - 0.45 + c * 0.9, y - 0.32 + r * 0.32, zs * 5.52, 0.13, 0.4,
                           axis='z', seg=6, color=DARK)
            pb.box((x, y + 0.72, zs * 5.30), (1.6, 0.14, 0.85), AMBER * 0.8)
    return pb


def greebles():
    pb = PB()
    # антенны и мачты на носу и палубе
    pb.seg((-20.4, 7.15, 0.0), (-20.9, 8.35, 0.0), 0.14, 0.14, GREY)
    pb.box((-20.9, 8.45, 0.0), (0.35, 0.30, 0.35), AMBER)
    for zs in (-1, 1):
        pb.seg((-15.2, 8.30, zs * 1.6), (-15.6, 9.10, zs * 2.1), 0.12, 0.12, GREY)
        # боковые короба оборудования
        pb.box((-4.5, 4.75, zs * 5.50), (3.2, 0.9, 0.7), SILVER_D)
        pb.box((-4.5, 5.15, zs * 5.50), (2.6, 0.2, 0.5), DARK_M)
        # стойки под палубой
        for x in (-10.0, -6.0, 0.0, 6.0):
            pb.box((x, bbelly(x) - 0.25, zs * 3.2), (2.2, 0.6, 0.8), GREY)
    # подвесные баки и кабели по днищу
    for zs in (-1, 1):
        pb.cyl(-6.0, bbelly(-6.0) - 0.55, zs * 2.2, 0.45, 8.0, axis='x', seg=8, color=SILVER_D)
        pb.cyl(-6.0, bbelly(-6.0) - 0.30, zs * 4.4, 0.16, 12.0, axis='x', seg=6, color=DARK_M)
    # кормовые жалюзи
    for k in range(5):
        pb.box((TAIL - 2.2, 4.35 + k * 0.55, 0.0), (1.6, 0.22, 5.6), DARK_M)
    # верхние люки обслуживания
    for x in (-8.0, -1.0, 8.0):
        pb.box((x, btop(x) + 0.16, 3.6), (1.8, 0.14, 1.4), SILVER_D)
    return pb


def decals():
    """Маркировка: шевроны, номер-блок «4», полосы, предупреждение у трапа."""
    pb = PB()
    for zs in (-1, 1):
        pb.m = zs
        y = 5.15
        # оранжевые шевроны на скуле
        for k in range(3):
            pb.face((-19.6 + k * 0.95, y - 0.45, zs * 4.35), (-19.0 + k * 0.95, y - 0.45, zs * 4.35),
                    (-18.7 + k * 0.95, y + 0.45, zs * 4.35), (-19.3 + k * 0.95, y + 0.45, zs * 4.35),
                    ORANGE)
        # блок «4» и «CALCO» прямоугольниками без шрифта
        pb.box((-16.0, y + 0.30, zs * 4.45), (2.4, 1.5, 0.12), SILVER_L)
        pb.box((-16.4, y + 0.30, zs * 4.52), (0.28, 1.1, 0.06), DARK)
        pb.box((-15.6, y + 0.75, zs * 4.52), (1.1, 0.24, 0.06), DARK)
        pb.box((-15.6, y + 0.10, zs * 4.52), (1.3, 0.24, 0.06), DARK)
        pb.box((-11.6, y + 0.05, zs * 4.45), (2.6, 0.7, 0.10), DARK_M)
        for k in range(5):
            pb.box((-12.6 + k * 0.5, y + 0.05, zs * 4.50), (0.22, 0.42, 0.06), SILVER_L)
        # предупреждающие полосы в корме
        for k in range(4):
            pb.face((16.6 + k * 0.6, 4.60, zs * 4.62), (17.0 + k * 0.6, 4.60, zs * 4.62),
                    (16.8 + k * 0.6, 5.30, zs * 4.62), (16.4 + k * 0.6, 5.30, zs * 4.62),
                    ORANGE if k % 2 else DARK)
    pb.m = 1.0
    # номер на палубе перед кольцом турели
    pb.box((0.0, btop(0.0) + 0.14, 0.0), (2.2, 0.10, 1.6), SILVER_L)
    pb.box((0.0, btop(0.0) + 0.20, 0.0), (1.5, 0.10, 0.5), DARK)
    pb.box((0.0, btop(0.0) + 0.20, 0.0), (0.5, 0.10, 1.2), DARK)
    return pb


def lights():
    """Габариты, прожекторы, подсветка кольца и трапа."""
    pb = PB()
    # носовые прожекторы
    for zs in (-1, 1):
        pb.box((-22.3, 4.55, zs * 1.05), (0.55, 0.45, 0.75), WHITE)
        pb.box((-22.6, 4.55, zs * 1.05), (0.16, 0.30, 0.55), AMBER * 0.7)
    # габариты на законцовках пилонов (левый красный, правый зелёный)
    pb.box((0.0, 0.15, 8.95), (0.7, 0.35, 0.4), NAVGREEN)
    pb.box((0.0, 0.15, -8.95), (0.7, 0.35, 0.4), NAVRED)
    # белые огни на палубе
    for (x, z) in ((-11.0, 2.6), (8.0, 2.6), (-11.0, -2.6), (8.0, -2.6)):
        pb.box((x, btop(x) + 0.22, z), (0.5, 0.16, 0.5), WHITE * 0.95)
    # подсветка кормового среза
    for zs in (-1, 1):
        pb.box((TAIL - 0.4, 4.0, zs * 2.6), (0.4, 0.24, 1.4), CYAN * 0.8)
    return pb


def beacon():
    """Стробы: оранжевые вспышки на плоскостях и на палубе."""
    pb = PB()
    for zs in (-1, 1):
        pb.box((17.2, 8.55, zs * 3.3), (0.55, 0.55, 0.55), ORANGE)
        pb.box((9.6, btop(9.6) + 0.24, zs * 2.2), (0.45, 0.30, 0.45), ORANGE * 0.9)
    pb.box((-18.0, 7.55, 0.0), (0.5, 0.30, 0.5), ORANGE)
    return pb


# ---------------------------------------------------------------- сборка
FIN_HINGE = [(13.5, 8.35, 4.05), (13.5, 8.35, -4.05)]
WING_HINGE = [(2.0, 7.55, 6.30), (2.0, 7.55, -6.30)]
BT_DECK = 8.60
RAMP_OPEN_DEG = 70.0
TURRET_POS = [6.6, BT_DECK, 0.0]


def main():
    b = GlbBuilder()
    m_hull = b.material('hero_silver', metallic=0.30, roughness=0.52)
    m_dark = b.material('hero_dark', metallic=0.55, roughness=0.38)
    m_red = b.material('hero_red', metallic=0.35, roughness=0.45)
    m_glass = b.material('hero_glass', metallic=0.10, roughness=0.15)
    m_glow = b.material('hero_glow', metallic=0.0, roughness=0.28)
    m_thrust = b.material('hero_thrust', metallic=0.0, roughness=0.22)

    stats = {}
    tris = 0

    def add(name, pb, mat, pos=None, kind=None, rot_y=0.0):
        nonlocal tris
        v, t, c = pb.get()
        idx = b.mesh(name, v, t, c, mat)
        quat = None
        if rot_y:
            a = np.deg2rad(rot_y) / 2.0
            quat = [0.0, float(np.sin(a)), 0.0, float(np.cos(a))]
        b.node(name, idx, translation=pos, rotation=quat)
        stats[name] = (len(v), len(t))
        tris += len(t)
        if kind:
            check(pb, kind, off=pos or (0, 0, 0), rot_y=rot_y)

    add('hull_fwd', hull_fwd(), m_hull, kind='hull')
    add('hull_mid', hull_mid(), m_hull, kind='hull')
    add('hull_rear', hull_rear(), m_hull, kind='hull')
    canopy_pb = canopy()
    # остекление обязано сидеть на обшивке: не висеть над палубой и не выходить
    # за её габарит в плане
    worst_out, worst_gap = 0.0, 0.0
    for (vx, vy, vz) in canopy_pb.V:
        half = 0.44 * bwid(vx)
        worst_out = max(worst_out, abs(vz) - half)
        worst_gap = max(worst_gap, vy - (deck_top(vx) + 0.80))
    print('остекление: вынос за палубу %.2f м, подъём над стеклом %.2f м' %
          (worst_out, worst_gap))
    if worst_out > 0.02:
        raise SystemExit('glass hangs outside the hull: %.2f' % worst_out)
    if worst_gap > 0.02:
        raise SystemExit('glass floats above the hull: %.2f' % worst_gap)
    add('canopy', canopy_pb, m_glass, kind='canopy')
    add('turret', turret(), m_hull, pos=TURRET_POS, kind='turret')
    add('turret_guns', turret_guns(), m_dark, pos=[TURRET_POS[0], TURRET_POS[1] + 0.68, 0.0],
        kind='guns')
    add('bay_wells', bay_wells(), m_hull, kind='hull')
    add('mbay_r', bay_door(1), m_hull, pos=[13.6, btop(13.6) + 0.22, 2.75], kind='mbayr')
    add('mbay_l', bay_door(-1), m_hull, pos=[13.6, btop(13.6) + 0.22, -2.75], kind='mbayl')
    add('drone_port', drone_port(), m_hull, pos=[2.0, bbelly(2.0) + 0.05, 0.0], kind='dport')
    add('engines', engines(), m_dark, kind='engines')
    add('thrusters', thrusters(), m_thrust)
    ramp_pb = ramp()
    # в открытом положении трап вращается вокруг Z и не должен пересекать
    # двигательный отсек и сопла (это был дефект: он уходил вбок, в турбину)
    rot = -RAMP_OPEN_DEG
    v = np.array(ramp_pb.V, np.float64)
    cz_, sz_ = np.cos(np.deg2rad(rot)), np.sin(np.deg2rad(rot))
    rx = v[:, 0] * cz_ - v[:, 1] * sz_
    ry = v[:, 0] * sz_ + v[:, 1] * cz_
    open_bb = (rx.min() + RAMP_HINGE[0], rx.max() + RAMP_HINGE[0],
               ry.min() + RAMP_HINGE[1], ry.max() + RAMP_HINGE[1],
               v[:, 2].min(), v[:, 2].max())
    print('трап открыт: x[%.1f..%.1f] y[%.1f..%.1f] z[%.1f..%.1f]' % open_bb)
    if open_bb[3] > RAMP_HINGE[1] + 0.10:
        raise SystemExit('ramp swings up into the engines')
    if open_bb[0] < TAIL - 1.8:
        raise SystemExit('ramp swings forward into the hull')
    # сопла и двигательный отсек
    eng_y = [e[1] for e in ENGINES]
    if open_bb[3] > min(eng_y) - 1.45:
        raise SystemExit('ramp reaches the engine bells: %.2f' % open_bb[3])
    if open_bb[2] > 0.9:
        raise SystemExit('ramp does not reach the ground: %.2f' % open_bb[2])
    add('ramp', ramp_pb, m_hull, pos=RAMP_HINGE, kind='ramp')
    add('cms', cms(), m_hull, kind='cms')
    add('greebles', greebles(), m_hull, kind='hull')
    add('decals', decals(), m_glow)
    add('lights', lights(), m_glow)
    add('beacon', beacon(), m_glow)
    for sign in (1, -1):
        tag = 'r' if sign > 0 else 'l'
        add('fins_' + tag, fin(sign), m_hull, pos=[FIN_HINGE[0 if sign > 0 else 1][0],
                                                   FIN_HINGE[0 if sign > 0 else 1][1],
                                                   FIN_HINGE[0 if sign > 0 else 1][2]],
            kind='fin' + tag)
        add('winglets_' + tag, winglet(sign), m_hull, pos=[WING_HINGE[0 if sign > 0 else 1][0],
                                                          WING_HINGE[0 if sign > 0 else 1][1],
                                                          WING_HINGE[0 if sign > 0 else 1][2]],
            kind='wing' + tag)
        add('vtol_' + tag, vtol(sign), m_glow, pos=[WING_HINGE[0 if sign > 0 else 1][0],
                                                   WING_HINGE[0 if sign > 0 else 1][1],
                                                   WING_HINGE[0 if sign > 0 else 1][2]])
    for li, (lx, lz) in enumerate(LEGS):
        add('leg_%d' % li, leg(li), m_hull, pos=[lx, bbelly(lx), lz], kind='leg%d' % li)

    data = b.build('calico_compakt_hero')
    open(os.path.join(P, 'calico_hero.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-11s verts %5d tris %5d' % (k, nv, nt))

    modes = {
        'pad':    {'legs': 1.0, 'fins': 0.0, 'ramp': 0.0, 'mbay': 0.0, 'dport': 0.0,
                   'thrust': 0.0, 'turret': 0.0, 'guns': 0.0, 'strobe': 0.30,
                   'spots': 0.45, 'vtol': 0.0, 'cms': 0.0},
        'flight': {'legs': 0.0, 'fins': 1.0, 'ramp': 0.0, 'mbay': 0.0, 'dport': 0.0,
                   'thrust': 0.70, 'turret': 0.0, 'guns': 0.0, 'strobe': 0.55,
                   'spots': 1.0, 'vtol': 0.0, 'cms': 0.0},
        'combat': {'legs': 0.0, 'fins': 1.0, 'ramp': 0.0, 'mbay': 1.0, 'dport': 0.0,
                   'thrust': 0.85, 'turret': 1.0, 'guns': 1.0, 'strobe': 1.0,
                   'spots': 1.0, 'vtol': 0.0, 'cms': 1.0},
        'cargo':  {'legs': 1.0, 'fins': 0.0, 'ramp': 1.0, 'mbay': 0.0, 'dport': 1.0,
                   'thrust': 0.0, 'turret': 0.0, 'guns': 0.0, 'strobe': 0.40,
                   'spots': 0.8, 'vtol': 0.9, 'cms': 0.0},
    }
    json.dump({'fins': 2, 'winglets': 2, 'legs': 4, 'vtol': 3,
               'fin_hinge': [FIN_HINGE[0][0], FIN_HINGE[0][1], FIN_HINGE[0][2]],
               'fin_sweep_deg': 58.0, 'wing_hinge': [WING_HINGE[0][0], WING_HINGE[0][1],
                                                     WING_HINGE[0][2]],
               'wing_fold_deg': 34.0, 'leg_retract': 2.6,
               'turret_pos': TURRET_POS, 'turret_yaw_deg': 120.0, 'gun_pitch_deg': 22.0,
               'ramp_hinge': list(RAMP_HINGE), 'ramp_open_deg': RAMP_OPEN_DEG,
               'mbay_open_deg': 64.0, 'dport_slide': 2.4,
               'modes': modes, 'dims': {'L': L, 'W': W, 'H': H}},
              open(os.path.join(P, 'modes.json'), 'w'), indent=1)
    print('modes.json')

    # ---------------- габарит и пересечения ----------------
    xmin = min(c[0] for c in CHECK); xmax = max(c[1] for c in CHECK)
    ymin = min(c[2] for c in CHECK); ymax = max(c[3] for c in CHECK)
    zmin = min(c[4] for c in CHECK); zmax = max(c[5] for c in CHECK)
    print('габарит: %.1f x %.1f x %.1f м' % (xmax - xmin, ymax - ymin, zmax - zmin))
    bad = []
    if xmin < -HX - 0.3 or xmax > HX + 0.3:
        bad.append('длина')
    if zmin < -HZ - 0.3 or zmax > HZ + 0.3:
        bad.append('ширина')
    if ymin < -0.2 or ymax > H + 0.2:
        bad.append('высота')
    print('  x[%.1f..%.1f] y[%.1f..%.1f] z[%.1f..%.1f]' % (xmin, xmax, ymin, ymax, zmin, zmax))
    print('  L %.1f/%.1f  W %.1f/%.1f  H %.1f/%.1f' % (xmax - xmin, L, zmax - zmin, W,
                                                       ymax - ymin, H))
    if bad:
        raise SystemExit('envelope broken: ' + ','.join(bad))

    over = 0
    n = len(CHECK)
    for i in range(n):
        ax0, ax1, ay0, ay1, az0, az1, ak = CHECK[i]
        for j in range(i + 1, n):
            bx0, bx1, by0, by1, bz0, bz1, bk = CHECK[j]
            if 'hull' in (ak, bk):
                continue
            if ak[:3] == bk[:3]:
                continue
            ox = min(ax1, bx1) - max(ax0, bx0)
            oy = min(ay1, by1) - max(ay0, by0)
            oz = min(az1, bz1) - max(az0, bz0)
            if ox > 0.05 and oy > 0.05 and oz > 0.05:
                over += 1
                if over <= 10:
                    print('  ПЕРЕСЕЧЕНИЕ %s/%s: %.2f x %.2f x %.2f' % (ak, bk, ox, oy, oz))
    print('проверка: деталей %d, пересечений %d' % (n, over))
    if over:
        raise SystemExit('overlapping parts')

    # ---------------- контроль по записанному файлу ----------------
    import struct, json as _json
    gx0 = gy0 = gz0 = 1e9
    gx1 = gy1 = gz1 = -1e9
    raw = open(os.path.join(P, 'calico_hero.glb'), 'rb').read()
    jlen = struct.unpack('<I', raw[12:16])[0]
    gj = _json.loads(raw[20:20 + jlen])
    bin_off = 20 + jlen + 8
    for node in gj['nodes']:
        if 'mesh' not in node:
            continue
        prim = gj['meshes'][node['mesh']]['primitives'][0]
        acc = gj['accessors'][prim['attributes']['POSITION']]
        view = gj['bufferViews'][acc['bufferView']]
        start = bin_off + view.get('byteOffset', 0) + acc.get('byteOffset', 0)
        pv = np.frombuffer(raw, np.float32, acc['count'] * 3, offset=start).reshape(-1, 3)
        x, y, z, w = node.get('rotation', [0, 0, 0, 1])
        R = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        wp = pv @ R.T + np.array(node.get('translation', [0, 0, 0]))
        gx0, gy0, gz0 = min(gx0, wp[:, 0].min()), min(gy0, wp[:, 1].min()), min(gz0, wp[:, 2].min())
        gx1, gy1, gz1 = max(gx1, wp[:, 0].max()), max(gy1, wp[:, 1].max()), max(gz1, wp[:, 2].max())
    print('по файлу GLB: %.1f x %.1f x %.1f м (x[%.1f..%.1f] y[%.1f..%.1f] z[%.1f..%.1f])'
          % (gx1 - gx0, gy1 - gy0, gz1 - gz0, gx0, gx1, gy0, gy1, gz0, gz1))
    if (gx1 - gx0 > L + 0.3 or gz1 - gz0 > W + 0.3 or gy1 - gy0 > H + 0.3 or gy0 < -0.2):
        raise SystemExit('GLB envelope broken')
    print('geometry: OK')


if __name__ == '__main__':
    main()
