#!/usr/bin/env python3
"""Calico Evac — средний спасательный корабль (Star Atlas, CALEV, Uncommon, Rescue).
53 × 30 × 13 м, экипаж 7. «По сути капсула для эвакуации, и она же корабль».

Собственная интерпретация по карточке маркета, чертежу и 22 кадрам галереи
(без копирования геометрии):

  * вытянутый стреловидный корпус: чёрный нос-игла с фонарём кабины, длинное
    серебристо-белое тело, красная кормовая секция с фасетными сколами;
  * купол кабины: светлая рама, панели стекла, «прорезающий обшивку» экран
    по мотивам описания — широкий фонарь с усиленным переплётом;
  * две красные дельта-крыла на корме с тёмными решётками на верхней плоскости
    и красными законцовками; небольшие канарды у носа;
  * кормовой блок: четыре дюзы с циановым свечением, красные обтекатели;
  * борта: медицинские красные кресты, блок «02 CALICO», панельные швы и лючки;
  * снизу: две шахты спас-капсул с направляющими, четыре посадочные лыжи,
    две шарнирные спасательные руки с захватами и четыре дрона-спасателя под
    крыльями (Rescue Rig / Drone Port / 2 Passenger из карточки);
  * маяки: белые прожекторы под носом, красно-синие медицинские стробы,
    циановые габариты на законцовках.

Узлы (24): hull_fwd, hull_mid, hull_rear, spine, nose_glass, canopy, wings_l,
wings_r, canards, tail, engines, thrusters, arms_l, arms_r, clamps,
pods_l, pods_r, pod_drones, skids, bay, greebles, decals, lights, beacon.
"""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, cylinder

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261211)

# ---------------------------------------------------------------- габарит
L, W, H = 53.0, 30.0, 13.0
HX, HZ = L / 2, W / 2                 # 26.5 / 15.0
NOSE, TAIL = -24.0, 25.0              # тело (нос дальше — игла фонаря)
Y_BELLY, Y_DECK = 2.8, 9.4            # днище / палуба тела

# ---------------------------------------------------------------- цвета
SILVER = np.array([0.560, 0.585, 0.640])
SILVER_L = np.array([0.735, 0.755, 0.790])
SILVER_D = np.array([0.360, 0.380, 0.425])
GREY = np.array([0.250, 0.265, 0.290])
DARK = np.array([0.070, 0.075, 0.085])
DARK_M = np.array([0.140, 0.148, 0.165])
RED = np.array([0.560, 0.075, 0.085])
RED_L = np.array([0.720, 0.130, 0.140])
RED_D = np.array([0.330, 0.045, 0.055])
GLASS = np.array([0.055, 0.085, 0.115])
GLASS_L = np.array([0.180, 0.260, 0.320])
CYAN = np.array([0.35, 0.92, 1.00])
WHITE = np.array([1.00, 0.96, 0.90])
AMBER = np.array([1.00, 0.58, 0.16])
MEDRED = np.array([1.00, 0.20, 0.22])
MEDBLUE = np.array([0.35, 0.62, 1.00])

LIGHT = np.array([0.40, 0.84, 0.36])
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


# ---------------------------------------------------------------- профиль тела
BX = [NOSE, -22.0, -19.0, -15.0, -10.0, -5.0, 0.0, 6.0, 11.0, 16.0, 21.0, TAIL]
BW = [1.15, 2.10, 3.05, 3.90, 4.70, 5.35, 5.70, 6.10, 6.70, 7.30, 7.60, 6.20]
BYB = [4.55, 3.95, 3.55, 3.15, 2.90, 2.80, 2.80, 2.85, 3.05, 3.35, 3.65, 4.60]
BYT = [5.55, 6.10, 6.70, 7.40, 8.10, 8.60, 8.95, 9.25, 9.70, 10.20, 10.10, 8.60]


def bwid(x):
    return float(np.interp(x, BX, BW))


def bbelly(x):
    return float(np.interp(x, BX, BYB))


def btop(x):
    return float(np.interp(x, BX, BYT))


def body_sec(x):
    w, yb, yt = bwid(x), bbelly(x), btop(x)
    h = yt - yb
    return [(yb, -0.34 * w), (yb + 0.12 * h, -0.86 * w), (yb + 0.42 * h, -1.00 * w),
            (yb + 0.76 * h, -0.86 * w), (yt, -0.52 * w),
            (yt, 0.52 * w), (yb + 0.76 * h, 0.86 * w), (yb + 0.42 * h, 1.00 * w),
            (yb + 0.12 * h, 0.86 * w), (yb, 0.34 * w)]


def hull_mid():
    """Серебристо-белое тело: панельные пояса, лючки, швы."""
    pb = PB()

    def col(i, k):
        if k in (0, 9):
            return SILVER_D * 0.92
        if k in (1, 8):
            return SILVER * 1.02
        if k in (2, 7):
            return SILVER_L if i % 3 else SILVER * 0.94
        if k in (3, 6):
            return SILVER * 0.96
        return SILVER_L * 1.05
    xs = [NOSE + 1.5, -20.0, -17.0, -13.0, -8.0, -3.0, 2.0, 7.0, 12.0, 17.0, 21.0, TAIL]
    loft(pb, xs, body_sec, col, cap_col=SILVER_D)
    # панельные швы и лючки по бортам
    for zs in (-1, 1):
        for x in np.arange(-18.0, 23.0, 3.4):
            w = bwid(x)
            yb, yt = bbelly(x), btop(x)
            pb.box((x, yb + (yt - yb) * 0.62, zs * (w * 0.905)),
                   (0.5, (yt - yb) * 0.42, 0.9), GREY * 0.9)
        for (x, fr, sx, sy) in ((-13.0, 0.55, 2.6, 1.6), (-4.0, 0.35, 3.2, 1.2),
                                (6.0, 0.62, 2.2, 1.4), (15.0, 0.45, 2.8, 1.2)):
            w = bwid(x)
            yb, yt = bbelly(x), btop(x)
            pb.box((x, yb + (yt - yb) * fr, zs * (w * 0.95)), (sx, sy, 0.5), DARK_M * 1.1)
    # палуба: серебряные пояса, узкая тёмная дорожка, красные полосы, швы
    for i in range(len(xs) - 1):
        xm = (xs[i] + xs[i + 1]) / 2
        w = bwid(xm)
        ln = xs[i + 1] - xs[i] - 0.5
        pb.box((xm, btop(xm) + 0.06, 0.0), (ln, 0.14, 2 * w * 0.78), SILVER_L * 1.04)
        pb.box((xm, btop(xm) + 0.14, 0.0), (ln, 0.14, 2 * w * 0.26), GREY * 0.95)
        for zs in (-1, 1):
            pb.box((xm, btop(xm) + 0.15, zs * w * 0.56), (ln, 0.12, 0.9), RED * 0.92)
            pb.box((xm, btop(xm) + 0.13, zs * w * 0.44), (ln, 0.10, 0.28), DARK_M)
        # поперечные швы панелей
        pb.box((xs[i] + 0.15, btop(xm) + 0.15, 0.0), (0.22, 0.12, 2 * w * 0.74), DARK_M * 0.9)
    return pb


def hull_fwd():
    """Нос-игла: чёрный обтекатель, игла с датчиком, канарды."""
    pb = PB()
    # игла фонаря
    pb.seg((-26.1, 5.30, 0.0), (-22.5, 5.62, 0.0), 0.9, 1.1, DARK_M * 1.1, ref=(0, 1, 0))
    pb.cyl(-26.1, 5.32, 0.0, 0.55, 0.8, axis='x', seg=8, color=SILVER_D)
    pb.cyl(-25.3, 5.34, 0.0, 0.78, 0.6, axis='x', seg=12, color=GREY)   # корпус фонаря
    pb.cyl(-24.9, 5.34, 0.0, 0.62, 0.24, axis='x', seg=12, color=WHITE)  # линза
    pb.box((-25.3, 4.55, 0.0), (0.9, 0.3, 0.9), CYAN * 0.9)              # габарит под фонарём
    # чёрный обтекатель носа (фонарь кабины)
    nx = [-24.4, -22.6, -20.8, -18.6, -16.4]
    nw = [1.35, 2.15, 2.95, 3.55, 3.95]

    def nsec(x):
        w = float(np.interp(x, nx, nw))
        yb = float(np.interp(x, nx, [4.6, 4.15, 3.85, 3.6, 3.5]))
        yt = float(np.interp(x, nx, [5.9, 6.7, 7.5, 8.05, 8.3]))
        h = yt - yb
        return [(yb + 0.30 * h, -0.55 * w), (yb + 0.72 * h, -0.94 * w), (yt, -0.62 * w),
                (yt, 0.62 * w), (yb + 0.72 * h, 0.94 * w), (yb + 0.30 * h, 0.55 * w)]
    loft(pb, nx, nsec, lambda i, k: DARK * (1.0 + 0.16 * k), cap_col=DARK_M)
    # стекло фонаря: две панели сверху
    for zs in (-1, 1):
        pb.m = zs
        pb.face((-23.6, 5.72, zs * 0.55), (-21.2, 6.55, zs * 1.55),
                (-19.2, 7.35, zs * 1.30), (-20.4, 6.35, zs * 0.40), GLASS_L * 0.95)
    pb.m = 1.0
    pb.face((-23.0, 5.85, -0.5), (-20.0, 7.15, -0.9), (-20.0, 7.15, 0.9),
            (-23.0, 5.85, 0.5), GLASS_L * 1.15)
    # переплёт фонаря
    for zs in (-1, 1):
        pb.box((-22.0, 6.3, zs * 1.15), (3.6, 0.22, 0.22), SILVER_D)
    # канарды у носа
    for zs in (-1, 1):
        pb.m = zs
        pb.face((-20.0, 5.30, zs * 2.6), (-15.6, 5.05, zs * 2.6),
                (-15.2, 5.05, zs * 5.1), (-19.2, 5.35, zs * 4.6), SILVER_L * 0.95)
        pb.face((-20.0, 5.20, zs * 2.6), (-19.2, 5.25, zs * 4.6),
                (-15.2, 4.95, zs * 5.1), (-15.6, 4.95, zs * 2.6), GREY)
        pb.face((-19.2, 5.35, zs * 4.6), (-15.2, 5.05, zs * 5.1),
                (-15.2, 4.95, zs * 5.1), (-19.2, 5.25, zs * 4.6), RED)
    pb.m = 1.0
    # датчики и штанги под носом
    for zs in (-1, 1):
        pb.seg((-21.0, 4.0, zs * 1.9), (-22.6, 3.4, zs * 2.3), 0.35, 0.35, GREY, ref=(0, 1, 0))
    return pb


def hull_rear():
    """Красная кормовая секция с фасетными сколами, спина и хвост."""
    pb = PB()
    xs = [14.0, 17.0, 20.0, 23.0, TAIL]
    secs = []

    def rsec(x):
        w = float(np.interp(x, xs, [7.2, 7.5, 7.6, 7.62, 7.0]))
        yb = float(np.interp(x, xs, [3.3, 3.45, 3.6, 3.9, 4.5]))
        yt = float(np.interp(x, xs, [10.2, 10.35, 10.3, 10.1, 9.2]))
        h = yt - yb
        return [(yb, -0.40 * w), (yb + 0.16 * h, -0.92 * w), (yb + 0.52 * h, -1.00 * w),
                (yb + 0.84 * h, -0.80 * w), (yt, -0.42 * w),
                (yt, 0.42 * w), (yb + 0.84 * h, 0.80 * w), (yb + 0.52 * h, 1.00 * w),
                (yb + 0.16 * h, 0.92 * w), (yb, 0.40 * w)]
    loft(pb, xs, rsec, lambda i, k: (RED_L if k in (3, 6) else
                                     (RED if k in (2, 7) else RED_D)), cap_col=RED_D)
    # фасетные красные накладки поверх
    for (x, zs) in ((16.6, 1), (16.6, -1), (20.4, 1), (20.4, -1), (23.6, 1), (23.6, -1)):
        pb.m = zs * (1 if x < 19 else -1) if False else zs
        pb.face((x - 1.2, 9.4, zs * 3.6), (x + 1.2, 9.6, zs * 3.7),
                (x + 1.2, 7.6, zs * 6.6), (x - 1.2, 7.4, zs * 6.4), RED_L * 0.95)
    pb.m = 1.0
    # выхлопные обтекатели и хвостовой гребень
    pb.box((TAIL - 1.4, 8.6, 0.0), (2.6, 2.4, 9.0), RED_D)
    pb.seg((23.0, 10.4, 0.0), (TAIL - 0.4, 9.4, 0.0), 1.6, 2.2, RED, ref=(0, 1, 0))
    return pb


def spine():
    """Спинная надстройка: купол кабины — тёмное стекло в серебряных нервюрах,
    гребни, штанга с маяком."""
    pb = PB()
    cx, half = -9.6, 4.0
    xs = list(np.linspace(cx - half, cx + half, 17))

    def dome_sec(x):
        t = (x - cx) / half
        f = max(0.0, 1.0 - t * t) ** 0.5
        w, h, y0 = 3.35 * f, 2.05 * f, 8.55
        pts = []
        for k in range(7):
            a = math.pi * (1.0 - k / 6.0)
            pts.append((y0 + h * math.sin(a), w * math.cos(a)))
        return pts

    def dome_col(i, k):
        if k in (0, 5):
            return SILVER_D                      # комингс у палубы
        if i % 4 == 0:
            return SILVER                        # нервюра-обруч
        if k in (1, 4):
            return GLASS_L * 0.52                # бортовое стекло
        if k == 2:
            return GLASS_L * 0.78
        return GLASS_L * 0.95                    # верхнее стекло

    loft(pb, xs, dome_sec, dome_col, cap=False)
    # лобовой экран, «прорезающий обшивку»
    pb.face((cx - 3.1, 8.62, -2.9), (cx - 3.1, 8.62, 2.9),
            (cx - 1.9, 9.72, 1.9), (cx - 1.9, 9.72, -1.9), GLASS_L * 1.05)
    # продольные серебряные стрингеры по куполу
    for zz in (-1.9, 0.0, 1.9):
        for xa in (cx - 3.4, cx - 1.1, cx + 1.2, cx + 3.4):
            h = 8.55 + 2.05 * max(0.0, 1.0 - ((xa - cx) / half) ** 2) ** 0.5 * \
                max(0.0, 1.0 - (zz / 3.4) ** 2) ** 0.5
            pb.box((xa, h + 0.04, zz), (2.2, 0.16, 0.22), SILVER)
    # гребни-плавники на спине
    for (x, h, zs) in ((1.5, 1.4, 1), (1.5, 1.4, -1), (8.0, 1.0, 1), (8.0, 1.0, -1)):
        pb.m = zs
        pb.face((x - 2.2, 9.3, zs * 1.0), (x + 2.2, 9.3, zs * 1.0),
                (x + 1.4, 9.3 + h, zs * 1.35), (x - 1.4, 9.3 + h, zs * 1.35), SILVER_L)
        pb.face((x - 2.2, 9.3, zs * 1.0), (x - 1.4, 9.3 + h, zs * 1.35),
                (x + 1.4, 9.3 + h, zs * 1.35), (x + 2.2, 9.3, zs * 1.0), GREY)
    pb.m = 1.0
    # штанга и маяк
    pb.seg((-2.0, 9.3, 0.0), (-1.0, 11.0, 0.0), 0.22, 0.22, GREY)
    pb.box((-1.0, 11.1, 0.0), (0.5, 0.5, 0.5), MEDRED)
    # крест на спине за куполом
    pb.box((3.6, 9.30, 0.0), (2.6, 0.1, 2.6), WHITE * 0.95)
    pb.box((3.6, 9.36, 0.0), (2.2, 0.1, 0.72), MEDRED)
    pb.box((3.6, 9.36, 0.0), (0.72, 0.1, 2.2), MEDRED)
    return pb


# ---------------------------------------------------------------- крылья
WING_ROOT = (6.0, 6.45)          # (x, z) корневой точки
WING_TIP = (15.0, 14.7)          # (x, z) законцовки


def wing(sign):
    """Красное дельта-крыло: верх красный с тёмными решётками, низ тёмный.
    Локальные координаты: ноль в узле навески (X=8, y=7.1, z=±5.4)."""
    z = lambda v: sign * v
    pb = PB()
    pb.m = sign
    # контур крыла в плане (относительно узла)
    root_le = (-5.2, 0.0)
    root_te = (13.0, 1.2)
    tip_le = (6.4, 8.6)
    tip_te = (14.4, 8.0)
    ytop, ybot = 0.55, -0.35
    A = (root_le[0], ytop, z(root_le[1]))
    B = (tip_le[0], ytop - 0.15, z(tip_le[1]))
    C = (tip_te[0], ytop - 0.15, z(tip_te[1]))
    D = (root_te[0], ytop, z(root_te[1]))
    pb.face(A, B, C, D, RED_L, 1.0)                       # верх
    A2 = (A[0], ybot, A[2]); B2 = (B[0], ybot, B[2])
    C2 = (C[0], ybot, C[2]); D2 = (D[0], ybot, D[2])
    pb.face(D2, C2, B2, A2, RED_D * 1.05)                 # низ
    pb.face(A, A2, B2, B, RED)                            # передняя кромка
    pb.face(B2, C2, C, B, RED_D)                          # законцовка
    pb.face(D, C, C2, D2, RED_D)                          # задняя кромка
    pb.face(A, D, D2, A2, RED * 0.9)                      # корень
    # тёмные вентиляционные решётки на верхней плоскости
    def q(t, s2):
        """Билинейная точка внутри трапеции крыла: t — по размаху, s2 — по хорде."""
        x = (1 - t) * ((1 - s2) * root_le[0] + s2 * root_te[0]) + \
            t * ((1 - s2) * tip_le[0] + s2 * tip_te[0])
        zz = (1 - t) * ((1 - s2) * root_le[1] + s2 * root_te[1]) + \
            t * ((1 - s2) * tip_le[1] + s2 * tip_te[1])
        return x, zz
    # тёмные решётки-радиаторы внутри плоскости крыла
    for (t, s2, sx, sz) in ((0.30, 0.52, 3.0, 1.9), (0.62, 0.48, 2.6, 1.7)):
        cxg, czg = q(t, s2)
        pb.box((cxg, ytop + 0.03, z(czg)), (sx, 0.08, sz), DARK_M)
        n = 5
        for j2 in range(n):
            pb.box((cxg - sx / 2 + sx * (j2 + 0.5) / n, ytop + 0.09, z(czg)),
                   (sx / n * 0.55, 0.06, sz * 0.92), SILVER_D * 0.85)
        pb.box((cxg, ytop + 0.05, z(czg) + (sx / 2 + 0.6) * (1 if sign > 0 else -1) * 0),
               (sx, 0.05, 0.16), SILVER_D)
    # красная законцовка-плавник
    # узкая законцовка-плавник (наклон наружу)
    pb.face((tip_le[0] + 1.6, ytop, z(tip_le[1] - 0.6)), (tip_te[0] - 0.4, ytop, z(tip_te[1] - 1.2)),
            (tip_te[0] - 1.2, ytop + 1.35, z(tip_te[1] - 1.6)),
            (tip_le[0] + 1.6, ytop + 1.15, z(tip_le[1] - 1.0)), RED)
    pb.face((tip_le[0] + 1.6, ytop, z(tip_le[1] - 0.6)), (tip_le[0] + 1.6, ytop + 1.15, z(tip_le[1] - 1.0)),
            (tip_te[0] - 1.2, ytop + 1.35, z(tip_te[1] - 1.6)),
            (tip_te[0] - 0.4, ytop, z(tip_te[1] - 1.2)), RED_D)
    # циановый габарит на законцовке
    pb.box((tip_te[0] - 1.2, ytop + 0.3, z(tip_te[1] - 0.8)), (0.5, 0.4, 0.5), CYAN)
    return pb


def tail():
    """Два наклонных красных плавника над дюзами (как в кадрах)."""
    pb = PB()
    for zs in (-1, 1):
        pb.m = zs
        root0 = (TAIL - 5.4, 8.3, zs * 1.2)
        root1 = (TAIL - 0.2, 8.7, zs * 2.0)
        up0 = (TAIL - 6.6, 10.6, zs * 2.9)
        up1 = (TAIL - 1.2, 12.2, zs * 3.9)
        pb.face(root0, root1, up1, up0, RED)
        pb.face(root0, up0, up1, root1, RED_D * 1.05)
        # циановая кромка
        pb.seg(up0, up1, 0.22, 0.22, CYAN * 0.8, ref=(0, 1, 0))
        # корневая накладка
        pb.box((TAIL - 4.0, 8.7, zs * 1.6), (2.6, 1.0, 1.2), RED_L * 0.9)
    return pb


# ---------------------------------------------------------------- двигатели
ENGINES = [(-2.55, 6.15), (2.55, 6.15), (-2.55, 8.55), (2.55, 8.55)]   # (z, y)


def engines():
    pb = PB()
    for (cz, cy) in ENGINES:
        pb.cyl(TAIL - 2.2, cy, cz, 1.30, 3.2, axis='x', seg=14, color=GREY)
        pb.cyl(TAIL + 0.2, cy, cz, 1.42, 2.2, axis='x', seg=14, color=DARK_M)
        pb.cyl(TAIL + 0.85, cy, cz, 1.55, 0.8, axis='x', seg=14, color=SILVER_D)
        for k in range(3):
            a = 2 * math.pi * k / 3 + 0.5
            pb.box((TAIL + 0.6, cy + math.cos(a) * 1.5, cz + math.sin(a) * 1.5),
                   (1.4, 0.5, 0.5), GREY)
    return pb


def thrusters():
    pb = PB()
    for (cz, cy) in ENGINES:
        r, seg = 1.25, 14
        for k in range(seg):
            a0 = 2 * math.pi * k / seg
            a1 = 2 * math.pi * (k + 1) / seg
            pb.tri((TAIL + 1.30, cy, cz),
                   (TAIL + 1.30, cy + math.cos(a0) * r, cz + math.sin(a0) * r),
                   (TAIL + 1.30, cy + math.cos(a1) * r, cz + math.sin(a1) * r),
                   CYAN * 0.95)
        pb.tri((TAIL + 1.30, cy, cz), (TAIL + 1.30, cy + 0.6, cz),
               (TAIL + 1.30, cy, cz + 0.6), WHITE)
    return pb


# ---------------------------------------------------------------- спас-руки
ARM_MOUNT = [(-6.5, 3.05), (-2.0, 3.05)]     # (x, z) — по одной на борт? см. main


def arm(sign):
    """Спасательная рука: плечо, два сегмента, платформа-захват с подсветкой.
    Ноль узла — шарнир на борту; в сложенном виде рука идёт вдоль борта."""
    z = lambda v: sign * v
    pb = PB()
    pb.m = sign
    pb.box((0.0, 0.0, z(0.2)), (1.8, 1.7, 1.8), SILVER_D)           # шарнир
    pb.box((0.0, 0.9, z(0.4)), (1.4, 0.8, 1.2), GREY)               # силовой цилиндр
    pb.seg((0.3, -0.15, z(0.6)), (3.0, -0.7, z(1.3)), 1.05, 1.15, SILVER, ref=(0, 0, 1))
    pb.box((3.2, -0.75, z(1.4)), (1.4, 1.3, 1.4), GREY)             # локоть
    pb.seg((3.4, -0.75, z(1.5)), (6.0, -0.9, z(1.9)), 0.9, 1.0, SILVER_D, ref=(0, 0, 1))
    pb.box((6.2, -0.9, z(2.0)), (1.2, 1.1, 1.2), GREY)              # запястье
    # платформа-захват с створками и подсветкой
    pb.box((7.4, -0.95, z(2.1)), (1.8, 0.5, 2.6), SILVER_L * 0.95)
    for dz in (-1.0, 1.0):
        pb.seg((7.4, -1.1, z(2.1) + dz), (8.8, -1.4, z(2.1) + dz * 1.3),
               0.45, 0.55, SILVER_L, ref=(0, 1, 0))
        pb.box((9.0, -1.5, z(2.1) + dz * 1.35), (0.6, 0.7, 0.6), MEDBLUE * 1.15)
    pb.box((7.4, -0.6, z(2.1)), (1.2, 0.25, 1.8), AMBER * 0.9)      # маркер
    pb.box((3.2, 0.05, z(1.4)), (0.35, 0.35, 0.35), AMBER)
    return pb


# ---------------------------------------------------------------- капсулы
PODS = [(-2.4, -1.0), (2.4, -1.0)]        # (z, x) локальные в узле pods


def rescue_pod():
    """Спас-капсула: каплевидный корпус, фонарь, свои микро-дюзы, крест."""
    pb = PB()
    xs = [-2.2, -1.6, -0.8, 0.0, 0.9, 1.7, 2.3]
    rr = [0.35, 0.75, 1.02, 1.12, 1.04, 0.80, 0.42]

    def psec(x):
        r = float(np.interp(x, xs, rr))
        return [(0.0 + r * 0.92, 0.0), (r * 0.42, -r * 0.98), (r * 1.0, -r * 0.35),
                (r * 1.0, r * 0.35), (r * 0.42, r * 0.98)]
    loft(pb, xs, psec, lambda i, k: (RED_L if k == 2 else (RED if k >= 3 else RED_D)))
    # фонарь сверху
    pb.face((-1.0, 1.02, -0.55), (0.9, 1.02, -0.55), (0.9, 1.02, 0.55),
            (-1.0, 1.02, 0.55), GLASS_L * 1.2)
    # белая полоса и крест
    pb.box((0.1, 1.02, 0.0), (0.5, 0.12, 1.9), WHITE * 0.9)
    pb.box((-0.4, 1.10, 0.0), (0.35, 0.10, 0.9), MEDRED)
    pb.box((-0.4, 1.10, 0.0), (0.9, 0.10, 0.35), MEDRED)
    # микро-дюзы
    for zs in (-1, 1):
        pb.cyl(-2.15, 0.35, zs * 0.45, 0.22, 0.5, axis='x', seg=8, color=GREY)
    # днище: белая плита с красным крестом (видно снизу)
    pb.box((0.1, -1.02, 0.0), (2.4, 0.12, 1.7), WHITE * 0.95)
    pb.box((0.1, -1.09, 0.0), (1.9, 0.1, 0.55), MEDRED)
    pb.box((0.1, -1.09, 0.0), (0.55, 0.1, 1.5), MEDRED)
    pb.box((1.5, -0.95, 0.0), (0.4, 0.18, 1.1), CYAN * 0.8)
    # посадочные упоры
    for (dx, dz) in ((-1.3, -0.85), (0.9, -0.85), (-1.3, 0.85), (0.9, 0.85)):
        pb.box((dx, -0.98, dz), (0.5, 0.5, 0.4), GREY)
    return pb


def pods(sign):
    """Две капсулы в шахте борта (узел: центр шахты)."""
    pb = PB()
    for (zz, xx) in ((-2.9, -1.0), (2.9, -1.0)):
        v, t, c = rescue_pod().get()
        sc = 1.25
        base = len(pb.V)
        pb.V.extend([[p[0] * sc + xx, p[1] * sc + 2.35, sign * zz + p[2] * sc] for p in v])
        pb.C.extend(c.tolist())
        pb.T.extend((t + base).tolist())
    return pb


def bay():
    """Две шахты спас-капсул снизу: направляющие, тёплый свет, створки."""
    pb = PB()
    for zs in (-1, 1):
        pb.m = zs
        cx = -1.0
        y = bbelly(cx) - 0.2
        # рама шахты по четырём сторонам (капсула просматривается снизу)
        for dz in (-2.3, 2.3):
            pb.box((cx, y - 0.55, zs * 2.9 + dz), (10.2, 0.9, 0.55), DARK_M * 0.95)
            pb.box((cx, y - 0.98, zs * 2.9 + dz), (9.6, 0.14, 0.42), AMBER * 0.75)
        for dx in (-5.0, 5.0):
            pb.box((cx + dx, y - 0.55, zs * 2.9), (0.55, 0.9, 4.8), DARK_M * 0.95)
            pb.box((cx + dx * 0.94, y - 0.98, zs * 2.9), (0.42, 0.14, 4.2), AMBER * 0.75)
        for dx in (-5.0, 5.0):
            pb.box((cx + dx, y - 0.3, zs * 2.9), (0.7, 1.8, 4.8), SILVER_D * 0.9)
        for dz in (-2.3, 2.3):
            pb.box((cx, y - 0.3, zs * 2.9 + dz), (10.2, 1.8, 0.7), SILVER_D * 0.9)
        # направляющие
        for dz in (-1.0, 1.0):
            pb.cyl(cx, y - 0.55, zs * 2.9 + dz, 0.16, 9.2, axis='x', seg=6, color=GREY)
    pb.m = 1.0
    return pb


SKIDS = [(-15.0, 1), (-15.0, -1), (17.0, 1), (17.0, -1)]


def skids_one(x, zs):
    pb = PB()
    yb = bbelly(x)
    pb.box((0.0, yb - 0.35, 0.0), (2.4, 0.7, 1.3), GREY)
    pb.seg((0.0, yb - 0.6, 0.0), (0.6, 0.90, zs * 0.8), 0.8, 0.8, SILVER_D, ref=(0, 1, 0))
    pb.box((0.6, 0.65, zs * 0.8), (3.0, 0.5, 1.8), DARK_M)
    pb.box((0.0, 0.10, 0.0), (1.2, 0.2, 1.0), AMBER * 0.8)
    return pb


def skids():
    """Четыре посадочные лыжи: узлы выпускаются на Y = 0, убираются в корпус."""
    pb = PB()
    for (x, zs) in SKIDS:
        yb = bbelly(x)
        pb.box((0.0, yb - 0.35, 0.0), (2.4, 0.7, 1.3), GREY)
        pb.seg((0.0, yb - 0.6, 0.0), (0.6, 0.55, zs * 0.8),
               0.8, 0.8, SILVER_D, ref=(0, 1, 0))
        pb.box((0.6, 0.28, zs * 0.8), (3.0, 0.5, 1.8), DARK_M)
        pb.box((0.0, 0.10, 0.0), (1.2, 0.2, 1.0), AMBER * 0.8)
    return pb


def skids_one(x, zs):
    pb = PB()
    yb = bbelly(x)
    pb.box((0.0, yb - 0.35, 0.0), (2.4, 0.7, 1.3), GREY)
    pb.seg((0.0, yb - 0.6, 0.0), (0.6, 0.90, zs * 0.8), 0.8, 0.8, SILVER_D, ref=(0, 1, 0))
    pb.box((0.6, 0.65, zs * 0.8), (3.0, 0.5, 1.8), DARK_M)
    pb.box((0.0, 0.10, 0.0), (1.2, 0.2, 1.0), AMBER * 0.8)
    return pb


def skids():
    """Стойки-лыжи в локальных координатах узла (шарнир у днища)."""
    pb = PB()
    return pb


def drone_unit():
    """Один дрон-спасатель. Локальный ноль — центр корпуса (для узла)."""
    pb = PB()
    pb.box((0.0, 0.0, 0.0), (3.2, 1.35, 2.0), SILVER_L * 0.92)
    pb.box((-1.7, 0.05, 0.0), (0.7, 0.95, 1.5), DARK_M)           # сенсорный блок
    pb.box((-2.0, 0.05, 0.0), (0.16, 0.5, 0.9), CYAN)             # объектив
    pb.box((1.4, 0.10, 0.0), (0.5, 0.7, 1.2), CYAN * 0.75)        # маркер
    pb.box((0.1, 0.72, 0.0), (2.6, 0.14, 1.7), SILVER_D)          # крышка гнезда
    pb.box((0.0, -0.74, 0.0), (2.4, 0.16, 1.6), DARK_M)           # днище
    for dz in (-0.75, 0.75):                                      # посадочные стойки
        pb.box((-0.3, -0.72, dz), (1.6, 0.4, 0.4), SILVER_D)
    for dz in (-1.05, 1.05):                                      # грави-диски
        pb.cyl(0.2, 0.0, dz, 0.42, 0.35, axis='z', seg=8, color=GREY)
    pb.box((1.7, -0.4, 0.0), (0.5, 0.35, 1.4), AMBER * 0.85)      # сигнал
    return pb


DRONE_SLOTS = [(8.6, 1), (8.6, -1), (14.6, 1), (14.6, -1)]


def drone_slot(i2):
    x, zs = DRONE_SLOTS[i2]
    yy = 6.15
    z = zs * (8.9 if x < 12 else 11.6)
    # пилон и гнездо на крыле
    pb = PB()
    pb.box((0.0, 0.80, 0.0), (1.0, 0.9, 0.9), GREY)
    pb.box((0.0, 1.42, 0.0), (3.4, 0.22, 2.2), SILVER_D)
    return pb, (x, yy, z)


# ---------------------------------------------------------------- мелочь и свет
def decals():
    """Медицинские кресты, номера-блоки, цветные полосы (без текста)."""
    pb = PB()
    for zs in (-1, 1):
        x = 9.0
        w = bwid(x)
        y = bbelly(x) + (btop(x) - bbelly(x)) * 0.55
        zz = zs * (w * 0.97)
        pb.box((x, y, zz), (1.1, 3.4, 0.22), WHITE * 0.92)
        pb.box((x, y, zz + zs * 0.14), (1.1, 1.1, 0.1), MEDRED)
        pb.box((x, y, zz + zs * 0.14), (3.2, 0.9, 0.1), MEDRED)
        # номер-блок «02 CALICO» — светлая плита с тёмными штрихами
        pb.box((17.0, y - 0.4, zz), (4.6, 1.6, 0.2), SILVER_L * 1.02)
        for k in range(3):
            pb.box((15.6 + k * 1.3, y - 0.4, zz + zs * 0.13), (0.5, 1.0, 0.08), DARK)
        # красная и циановая полосы по борту
        pb.box((-2.0, y + 1.4, zz), (14.0, 0.42, 0.16), RED_L * 0.9)
        pb.box((-2.0, y + 0.85, zz), (10.0, 0.2, 0.14), CYAN * 0.65)
        # тёмные «жабры» — вентиляция у кормовой секции
        for k in range(3):
            pb.box((21.0, y - 0.6 + k * 0.5, zz), (4.0, 0.22, 0.12), DARK_M)
    # крест на верхней плоскости каждого крыла
    for zs in (-1, 1):
        for (cx, cy, cz) in ((11.6, 7.75, zs * 10.4),):
            pb.box((cx, cy, cz), (2.6, 0.1, 2.6), WHITE * 0.95)
            pb.box((cx, cy + 0.06, cz), (2.2, 0.1, 0.72), MEDRED)
            pb.box((cx, cy + 0.06, cz), (0.72, 0.1, 2.2), MEDRED)
    # мед-маркировка на днище между шахтами
    pb.box((11.0, bbelly(11.0) - 0.3, 0.0), (2.4, 0.1, 2.4), WHITE * 0.9)
    pb.box((11.0, bbelly(11.0) - 0.36, 0.0), (2.0, 0.1, 0.7), MEDRED)
    pb.box((11.0, bbelly(11.0) - 0.36, 0.0), (0.7, 0.1, 2.0), MEDRED)
    return pb


def greebles():
    pb = PB()
    # ------- палуба: техника, люки, лебёдка, баллоны, поручни
    for x in (-14.0, -6.0, 1.0, 9.0, 16.0):
        w, yt = bwid(x), btop(x)
        for zs in (-1, 1):
            pb.box((x, yt + 0.42, zs * w * 0.30), (2.2, 0.5, 1.5), GREY)          # вент-короб
            for k in range(3):
                pb.box((x, yt + 0.70, zs * w * 0.30 + (k - 1) * 0.42),
                       (1.9, 0.12, 0.18), DARK_M)                                  # жалюзи
            pb.box((x + 1.6, yt + 0.30, zs * w * 0.62), (1.4, 0.28, 1.0), SILVER_D)  # люк
            pb.box((x + 1.6, yt + 0.46, zs * w * 0.62), (0.4, 0.1, 0.28), DARK)      # ручка
    # кабельные лотки вдоль палубы
    for zs in (-1, 1):
        pb.box((0.0, btop(0.0) + 0.24, zs * bwid(0.0) * 0.72), (30.0, 0.16, 0.34), DARK_M)
        for x in np.arange(-14.0, 17.0, 2.0):
            pb.box((x, btop(x) + 0.24, zs * bwid(x) * 0.72), (0.18, 0.22, 0.5), GREY)
    # лебёдка (барабан) — узел winch отдельно
    pb.box((6.0, btop(6.0) + 0.35, -1.6), (3.4, 0.4, 1.6), SILVER_D)
    pb.box((3.2, btop(3.2) + 0.55, -1.6), (1.0, 0.9, 1.2), AMBER * 0.9)          # пульт лебёдки
    # баллоны и ящики ЗИП
    for k in range(3):
        pb.cyl(11.0 + k * 0.0, btop(11.0) + 0.65, 1.4 + k * 0.95, 0.42, 3.2,
               axis='x', seg=8, color=SILVER_L * 0.9)
    pb.box((12.6, btop(12.6) + 0.55, -1.4), (3.0, 0.9, 2.2), GREY)
    pb.box((12.6, btop(12.6) + 1.02, -1.4), (2.4, 0.1, 1.6), DARK_M)
    # поручни по кромке палубы
    for zs in (-1, 1):
        for x in np.arange(-11.0, 15.0, 1.6):
            pb.box((x, btop(x) + 0.42, zs * bwid(x) * 0.86), (0.14, 0.8, 0.14), SILVER_D)
        pb.box((2.0, btop(2.0) + 0.80, zs * bwid(2.0) * 0.86), (26.0, 0.12, 0.12), SILVER_D)
    # стяжные кольца и люки ТО
    for x in (-9.0, -2.0, 5.0, 13.0):
        for zs in (-1, 1):
            pb.box((x, btop(x) + 0.20, zs * bwid(x) * 0.10), (0.7, 0.16, 0.7), GREY)
    # лючки, короба, кабельные лотки
    for (x, zs, fr) in ((-16.0, 1, 0.35), (-7.0, -1, 0.55), (3.0, 1, 0.42),
                        (12.0, -1, 0.5), (20.0, 1, 0.38)):
        w = bwid(x)
        y = bbelly(x) + (btop(x) - bbelly(x)) * fr
        pb.box((x, y, zs * w * 0.86), (2.4, 1.0, 0.8), GREY)
        pb.box((x, y + 0.55, zs * w * 0.86), (1.6, 0.3, 0.5), SILVER_D)
    # кабели по днищу
    for zs in (-1, 1):
        pb.cyl(-4.0, bbelly(-4.0) - 0.35, zs * 3.0, 0.18, 18.0, axis='x', seg=6, color=GREY)
        pb.cyl(-4.0, bbelly(-4.0) - 0.35, zs * 4.6, 0.14, 16.0, axis='x', seg=6, color=DARK_M)
    # трос-лоток по днищу (сам крюк — узел winch)
    by = bbelly(9.0)
    pb.cyl(9.0, by - 0.9, 0.0, 0.12, 6.0, axis='x', seg=6, color=DARK_M)
    pb.box((6.2, by - 0.9, 0.0), (1.2, 0.5, 1.2), DARK_M)
    # страховочные площадки у шахт
    for zs in (-1, 1):
        pb.box((7.6, by - 0.55, zs * 2.9), (3.4, 0.3, 3.6), SILVER_L * 0.92)
        for x in (6.3, 8.9):
            pb.box((x, by - 0.35, zs * 2.9), (0.3, 0.5, 3.6), GREY)
    # аккумуляторные короба днища
    for zs in (-1, 1):
        pb.box((-14.0, bbelly(-14.0) - 0.5, zs * 2.4), (4.0, 0.8, 2.0), DARK_M)
        pb.box((-14.0, bbelly(-14.0) - 0.85, zs * 2.4), (3.4, 0.14, 1.4), CYAN * 0.55)
    # торцевые короба и антенны
    for zs in (-1, 1):
        pb.box((17.0, 5.2, zs * 6.0), (3.0, 1.2, 1.0), SILVER_D)
    pb.seg((14.0, 9.8, -2.0), (16.0, 11.0, -2.4), 0.18, 0.18, GREY)
    return pb


def lights():
    pb = PB()
    # белые прожекторы под носом
    for zs in (-1, 1):
        pb.box((-19.0, 4.1, zs * 1.6), (1.6, 1.0, 1.2), GREY)
        pb.face((-19.85, 3.65, zs * 1.6 - 0.5), (-19.85, 3.65, zs * 1.6 + 0.5),
                (-19.85, 4.5, zs * 1.6 + 0.5), (-19.85, 4.5, zs * 1.6 - 0.5), WHITE)
    # циановые габариты по бортам
    for zs in (-1, 1):
        for x in (-12.0, 0.0, 12.0):
            w = bwid(x)
            y = bbelly(x) + (btop(x) - bbelly(x)) * 0.30
            pb.face((x - 0.3, y - 0.3, zs * (w + 0.1)), (x + 0.3, y - 0.3, zs * (w + 0.1)),
                    (x + 0.3, y + 0.3, zs * (w + 0.1)), (x - 0.3, y + 0.3, zs * (w + 0.1)),
                    CYAN * 1.1)
    # подсветка шахт капсул снизу
    for zs in (-1, 1):
        pb.face((-1.0, bbelly(-1.0) - 1.3, zs * 2.9 - 1.7), (2.6, bbelly(-1.0) - 1.3, zs * 2.9 - 1.7),
                (2.6, bbelly(-1.0) - 1.3, zs * 2.9 + 1.7), (-1.0, bbelly(-1.0) - 1.3, zs * 2.9 + 1.7),
                AMBER)
    return pb


def beacon():
    """Медицинские стробы: красно-синие, на спине и на законцовках."""
    pb = PB()
    for (x, y, z, col) in ((-2.0, 9.6, 2.6, MEDRED), (-2.0, 9.6, -2.6, MEDBLUE),
                           (5.0, 9.5, 1.9, MEDRED), (5.0, 9.5, -1.9, MEDBLUE),
                           (TAIL - 3.0, 9.3, 2.2, MEDRED), (TAIL - 3.0, 9.3, -2.2, MEDBLUE)):
        pb.box((x, y, z), (0.6, 0.5, 0.6), col)
    return pb


def winch():
    """Лебёдочный трос с крюком и люлькой. Локальный ноль — на днище."""
    pb = PB()
    pb.box((0.0, -0.05, 0.0), (0.5, 0.5, 0.5), GREY)
    pb.seg((0.0, -0.1, 0.0), (0.0, -0.9, 0.0), 0.16, 0.16, SILVER_L)
    pb.box((0.0, -1.15, 0.0), (1.5, 0.26, 0.85), AMBER)
    for zs in (-1, 1):                                   # дуги крюка
        pb.seg((0.0, -1.2, zs * 0.4), (0.0, -1.7, zs * 0.72), 0.2, 0.24, SILVER_L,
               ref=(1, 0, 0))
    pb.box((0.0, -1.85, 0.0), (0.9, 0.12, 0.5), WHITE * 0.9)
    return pb


# ---------------------------------------------------------------- сборка
ARM_X, ARM_Y, ARM_Z = -9.4, 5.6, 5.2
POD_NODE = (0.0, 0.0, 0.0)


def main():
    b = GlbBuilder()
    m_hull = b.material('evac_silver', metallic=0.30, roughness=0.55)
    m_red = b.material('evac_red', metallic=0.35, roughness=0.48)
    m_dark = b.material('evac_dark', metallic=0.60, roughness=0.35)
    m_glass = b.material('evac_glass', metallic=0.10, roughness=0.18)
    m_glow = b.material('evac_glow', metallic=0.0, roughness=0.30)
    m_thrust = b.material('evac_thrust', metallic=0.0, roughness=0.25)

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

    add('hull_mid', hull_mid(), m_hull, kind='hull')
    add('hull_fwd', hull_fwd(), m_hull, kind='hull')
    add('hull_rear', hull_rear(), m_red, kind='hull')
    add('spine', spine(), m_hull, kind='hull')
    add('canopy', spine(), m_glass) if False else None
    add('tail', tail(), m_red, kind='hull')
    add('engines', engines(), m_dark, kind='hull')
    add('thrusters', thrusters(), m_thrust)
    add('bay', bay(), m_hull, kind='hull')
    for di in range(4):
        dpb, dpos = drone_slot(di)
        dz = 'r' if dpos[2] > 0 else 'l'
        add('drone_%d%s' % (di // 2, dz), drone_unit(), m_hull, pos=list(dpos))
        add('drone_cradle_%d%s' % (di // 2, dz), dpb, m_hull, pos=[dpos[0], dpos[1], dpos[2]])
    add('winch', winch(), m_hull, pos=[6.2, bbelly(9.0) - 0.9, 0.0])
    for si, (sx, szs) in enumerate(SKIDS):
        add('skid_%d' % si, skids_one(sx, szs), m_hull, pos=[sx, 0.0, szs * bwid(sx) * 0.74])
    add('greebles', greebles(), m_hull, kind='hull')
    add('decals', decals(), m_glow)
    add('lights', lights(), m_glow)
    add('beacon', beacon(), m_glow)
    for sign in (1, -1):
        tag = 'r' if sign > 0 else 'l'
        add('wings_' + tag, wing(sign), m_red, pos=[8.0, 7.1, sign * 5.55], kind='wing' + tag,
            rot_y=-6.0 * sign)
        add('arms_' + tag, arm(sign), m_hull, pos=[ARM_X, ARM_Y, sign * ARM_Z],
            kind='arms' + tag, rot_y=-6.0 * sign)
        add('pods_' + tag, pods(sign), m_red, pos=[POD_NODE[0], POD_NODE[1], POD_NODE[2]],
            kind='pod' + tag)

    data = b.build('calico_evac')
    open(os.path.join(P, 'calico_evac.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-11s verts %5d tris %5d' % (k, nv, nt))

    modes = {
        'pad':    {'skids': 1.0, 'wings': 0.0, 'arms': 0.0, 'pods': 0.0, 'thrust': 0.0,
                   'strobe': 0.35, 'spots': 0.4, 'drones': 0.0, 'winch': 0.0},
        'launch': {'skids': 0.0, 'wings': 0.35, 'arms': 0.0, 'pods': 0.0, 'thrust': 1.0,
                   'strobe': 0.6, 'spots': 1.0, 'drones': 0.35, 'winch': 0.0},
        'rescue': {'skids': 0.0, 'wings': 0.0, 'arms': 1.0, 'pods': 1.0, 'thrust': 0.35,
                   'strobe': 1.0, 'spots': 1.0, 'drones': 1.0, 'winch': 0.35},
        'evac':   {'skids': 0.0, 'wings': 0.0, 'arms': 0.0, 'pods': 1.0, 'thrust': 0.8,
                   'strobe': 0.8, 'spots': 0.7, 'drones': 1.0, 'winch': 0.0},
    }
    json.dump({'pods': 2, 'drones': 4, 'skids': 4, 'drone_slots': DRONE_SLOTS,
               'skid_retract': 1.35,
               'drone_drop': 1.5, 'drone_spread': 1.6, 'winch_drop': 3.4, 'arm_pivot': [ARM_X, ARM_Y, ARM_Z],
               'pod_drop': 6.2, 'pod_spread': 2.2, 'wing_fold_deg': 62.0,
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
            if ak[:3] == bk[:3]:            # симметричные пары (крылья/руки/капсулы)
                continue
            ox = min(ax1, bx1) - max(ax0, bx0)
            oy = min(ay1, by1) - max(ay0, by0)
            oz = min(az1, bz1) - max(az0, bz0)
            if ox > 0.05 and oy > 0.05 and oz > 0.05:
                over += 1
                if over <= 8:
                    print('  ПЕРЕСЕЧЕНИЕ %s/%s: %.2f x %.2f x %.2f' % (ak, bk, ox, oy, oz))
    print('проверка: деталей %d, пересечений %d' % (n, over))
    if over:
        raise SystemExit('overlapping parts')

    # ---------------- контроль по записанному файлу ----------------
    import struct, json as _json
    gx0 = gy0 = gz0 = 1e9
    gx1 = gy1 = gz1 = -1e9
    raw = open(os.path.join(P, 'calico_evac.glb'), 'rb').read()
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
