#!/usr/bin/env python3
"""Armstrong IMP — капитальный шахтёрский корабль (Star Atlas, IMP3, Legendary, Miner).
443 × 262 × 121 м, экипаж 43.

Собственная интерпретация по карточке маркета, чертежу и 12 кадрам галереи (без
копирования геометрии):

  * ядро — длинное броневое тело; нос — фасетный «клюв» с двумя тёмными
    полированными плитами-мандибулами над буровой головой;
  * буровая голова: барабан-измельчитель с зубцами и бандажами, янтарное
    кольцо-визор по кругу, клешни-резцы впереди, синие прожекторы снизу;
  * шесть «рук» (по три на борт) на шарнирах: сегмент, плоский бак-слэб
    с вентиляционными рёбрами и клешня-измельчитель на конце;
  * корма: две группы по четыре плоских ребра-радиатора, оранжево-красные
    накладки, маршевый блок из восьми сопел;
  * снизу два ангарных проёма с тёплым светом, мостками и решётчатыми полами;
  * четыре стыковочных пилона до Y = 0.

Палитра: сильвер-броня, тёмный полированный металл, красно-оранжевые накладки,
золото-янтарное свечение буровой головы, синие маркеры и прожекторы.

Узлы (25): hull_bow, hull_mid, hull_rear, dorsal, prow_plates, visor_ring,
crusher (вращается), jaws, arm_0..5 (шарниры), fins_l, fins_r, hangar, gantry,
engines, thrusters, pylon_0..3, greebles, lights.
"""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, cylinder, merge

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261117)

# ---------------------------------------------------------------- габарит
L, W, H = 443.0, 262.0, 121.0
HX, HZ = L / 2, W / 2                      # 221.5 / 131.0

NOSE_X, TAIL_X = -150.0, 200.0             # торцы бронированного тела
CRUSH_NOSE, CRUSH_BACK = -196.0, -152.0    # барабан-измельчитель
CRUSH_Y = 54.0
ARM_Z = 34.0                               # шарнир руки от оси (уточняется ниже)
ARM_RETRACT = 14.0                         # насколько рука задвигается в переходе
ARM_SWEEP = 10.0                           # отвод руки назад вокруг Y

# ---------------------------------------------------------------- цвета
SILVER = np.array([0.385, 0.405, 0.445])
SILVER_L = np.array([0.545, 0.565, 0.610])
SILVER_D = np.array([0.245, 0.258, 0.288])
DARK = np.array([0.070, 0.075, 0.090])
DARK_M = np.array([0.125, 0.132, 0.150])
STEEL = np.array([0.150, 0.158, 0.172])
STEEL_L = np.array([0.235, 0.246, 0.268])
ORANGE = np.array([0.66, 0.27, 0.09])
ORANGE_L = np.array([0.80, 0.38, 0.13])
ORANGE_D = np.array([0.42, 0.15, 0.05])
GOLD = np.array([1.00, 0.64, 0.16])
AMBER = np.array([1.00, 0.47, 0.10])
BLUE = np.array([0.55, 0.80, 1.00])
WARM = np.array([1.00, 0.74, 0.40])
RED = np.array([1.00, 0.24, 0.14])

LIGHT = np.array([0.42, 0.82, 0.40])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# ---------------------------------------------------------------- строитель
class PB:
    """Плоские фасетки с запечённым затенением (unlit)."""

    def __init__(self):
        self.V, self.T, self.C = [], [], []

    @staticmethod
    def shade(n):
        lam = max(0.0, float(n @ LIGHT))
        sky = 0.20 * max(0.0, float(n[1])) - 0.12 * max(0.0, -float(n[1]))
        return 0.44 + 0.48 * lam + sky

    def tri(self, p0, p1, p2, color, mul=1.0):
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

    def seg(self, p0, p1, w, t, color, ref=(0, 0, 1), mul=1.0):
        a = np.array(p1, np.float64) - np.array(p0, np.float64)
        ln = np.linalg.norm(a)
        if ln < 1e-9:
            return
        a = a / ln
        r = np.array(ref, np.float64)
        if abs(float(a @ r)) > 0.93:
            r = np.array([0.0, 1.0, 0.0]) if abs(float(a[1])) < 0.9 else np.array([1.0, 0.0, 0.0])
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

    def cyl(self, cx, cy, cz, r, ln, axis='x', seg=14, color=STEEL, teeth=0, cap=True):
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


def vert_bounds(pb, deg_y=0.0, off=(0, 0, 0)):
    """Точный AABB по вершинам с поворотом вокруг Y и переносом."""
    v = np.array(pb.V, np.float64)
    c, s_ = np.cos(np.deg2rad(deg_y)), np.sin(np.deg2rad(deg_y))
    x = v[:, 0] * c + v[:, 2] * s_
    z = -v[:, 0] * s_ + v[:, 2] * c
    return (x.min() + off[0], x.max() + off[0], v[:, 1].min() + off[1],
            v[:, 1].max() + off[1], z.min() + off[2], z.max() + off[2])


CHECK = []


def check(b, kind='detail', off=(0, 0, 0), rot_y=None):
    """AABB детали в мире (+ смещение узла, при необходимости поворот вокруг Y)."""
    if b is None:
        return
    if rot_y:
        deg, (px, py, pz) = rot_y
        c = np.cos(np.deg2rad(deg))
        s = np.sin(np.deg2rad(deg))
        pts = []
        for (lx, ly, lz) in ((b[0], b[3], b[4]), (b[1], b[3], b[5]), (b[0], b[2], b[5]),
                             (b[1], b[2], b[4]), (b[0], b[3], b[5]), (b[1], b[3], b[4]),
                             (b[0], b[2], b[4]), (b[1], b[2], b[5])):
            pts.append([lx * c + lz * s, ly, -lx * s + lz * c])
        p = np.array(pts) + np.array([px, py, pz])
        CHECK.append((p[:, 0].min(), p[:, 0].max(), p[:, 1].min(), p[:, 1].max(),
                      p[:, 2].min(), p[:, 2].max(), kind))
        return
    CHECK.append((b[0] + off[0], b[1] + off[0], b[2] + off[1], b[3] + off[1],
                  b[4] + off[2], b[5] + off[2], kind))


def loft(pb, xs, section_fn, col_fn, cap=True, cap_col=None):
    """Обшивка по сечениям: xs — станции, section_fn(x) -> [(y, z), ...] по кругу."""
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
BODY_X = [NOSE_X, -120.0, -90.0, -50.0, 0.0, 50.0, 100.0, 140.0, 175.0, TAIL_X]
BODY_W = [26.0, 38.0, 45.0, 48.0, 46.0, 42.0, 36.0, 29.0, 21.0, 13.0]
BODY_YB = [42.0, 36.0, 31.0, 28.0, 28.0, 28.0, 30.0, 34.0, 40.0, 44.0]
BODY_YT = [92.0, 100.0, 102.0, 100.0, 98.0, 95.0, 90.0, 84.0, 76.0, 66.0]


def bwidth(x):
    return float(np.interp(x, BODY_X, BODY_W))


def bbelly(x):
    return float(np.interp(x, BODY_X, BODY_YB))


def bback(x):
    return float(np.interp(x, BODY_X, BODY_YT))


def body_sec(x):
    w, yb, yt = bwidth(x), bbelly(x), bback(x)
    h = yt - yb
    return [(yb, -0.42 * w), (yb + 0.10 * h, -0.90 * w), (yb + 0.38 * h, -1.00 * w),
            (yb + 0.72 * h, -0.80 * w), (yt, -0.40 * w),
            (yt, 0.40 * w), (yb + 0.72 * h, 0.80 * w), (yb + 0.38 * h, 1.00 * w),
            (yb + 0.10 * h, 0.90 * w), (yb, 0.42 * w)]


def hull_mid():
    """Бронированное тело: сильвер-обшивка, тёмные пояса, оранжевые накладки."""
    pb = PB()

    def col(i, k):
        if k in (0, 9):
            return SILVER_D * 0.86
        if k in (1, 8):
            return SILVER * 1.02
        if k in (2, 7):
            return SILVER_L * 0.98 if i % 3 else SILVER * 0.88
        if k in (3, 6):
            return SILVER * 0.92
        return SILVER * 0.94
    loft(pb, BODY_X, body_sec, col, cap_col=SILVER_D)
    # тёмные пояса-шпангоуты по бортам
    for x in np.arange(NOSE_X + 12, TAIL_X - 8, 26.0):
        w = bwidth(x)
        yb, yt = bbelly(x), bback(x)
        h = yt - yb
        for (fr, hh) in ((0.34, 0.20), (0.66, 0.16)):
            pb.box((x, yb + h * fr, 0.0), (3.2, h * hh, 2 * w * 0.86),
                   DARK_M * (1.0 if fr > 0.5 else 0.85))
    # оранжево-красные накладки вдоль спины и борта
    for x in np.arange(NOSE_X + 30, TAIL_X - 20, 44.0):
        w = bwidth(x)
        yb, yt = bbelly(x), bback(x)
        pb.box((x, yt - 3.0, 0.0), (26.0, 5.0, 2 * w * 0.52),
               ORANGE * (1.0 if int(x) % 3 else 0.9))
        for zs in (-1, 1):
            pb.box((x, yb + (yt - yb) * 0.52, zs * (w * 0.99)),
                   (22.0, 9.0, 2.0), ORANGE_D * 1.05)
    # ряды иллюминаторов вдоль борта — масштаб и жизнь
    for zs in (-1, 1):
        for x in np.arange(NOSE_X + 34, TAIL_X - 26, 7.0):
            w = bwidth(x)
            yb, yt = bbelly(x), bback(x)
            y = yb + (yt - yb) * 0.58
            pb.face((x - 2.2, y - 1.4, zs * (w * 0.955)), (x + 2.2, y - 1.4, zs * (w * 0.955)),
                    (x + 2.2, y + 1.4, zs * (w * 0.955)), (x - 2.2, y + 1.4, zs * (w * 0.955)),
                    WARM * (0.9 if int(x) % 3 else 0.55))
    # панельные швы: тёмные тонкие полосы по обшивке
    for zs in (-1, 1):
        for x in np.arange(NOSE_X + 20, TAIL_X - 16, 13.0):
            w = bwidth(x)
            yb, yt = bbelly(x), bback(x)
            pb.box((x, yb + (yt - yb) * 0.78, zs * (w * 0.86)), (1.2, (yt - yb) * 0.34, 1.6),
                   DARK_M * 0.9)
    # нижние полозья-балки
    for zs in (-1, 1):
        x = NOSE_X + 24
        while x < TAIL_X - 14:
            w = bwidth(x)
            pb.box((x, bbelly(x) + 1.0, zs * w * 0.62), (24.0, 5.0, 7.0), STEEL)
            x += 26.0
    return pb


def hull_bow():
    """Фасетный нос-клюв: сильвер-броня, рёбра, клыки вокруг буровой головы."""
    pb = PB()
    prow_xs = [-168.0, -152.0, -134.0, -116.0, -98.0]
    prow_w = [22.0, 34.0, 44.0, 50.0, 52.0]
    prow_yb = [46.0, 42.0, 38.0, 34.0, 32.0]
    prow_yt = [96.0, 108.0, 118.0, 121.0, 110.0]

    def psec(x):
        t = np.interp(x, prow_xs, range(len(prow_xs)))
        i = int(np.clip(np.floor(t), 0, len(prow_xs) - 2))
        f = t - i
        w = prow_w[i] + (prow_w[i + 1] - prow_w[i]) * f
        yb = prow_yb[i] + (prow_yb[i + 1] - prow_yb[i]) * f
        yt = prow_yt[i] + (prow_yt[i + 1] - prow_yt[i]) * f
        h = yt - yb
        return [(yb, -w), (yb + 0.5 * h, -0.95 * w), (yt, -0.32 * w),
                (yt, 0.32 * w), (yb + 0.5 * h, 0.95 * w), (yb, w)]

    def col(i, k):
        if k in (0, 5):
            return SILVER_D * 0.9
        if k in (1, 4):
            return SILVER if i % 2 else SILVER_D * 1.15
        return SILVER * 0.98
    loft(pb, prow_xs, psec, col, cap_col=SILVER_D)

    # рёбра-шпангоуты по клюву
    for x in (-160.0, -146.0, -130.0, -114.0):
        t = np.interp(x, prow_xs, range(len(prow_xs)))
        i = int(np.clip(np.floor(t), 0, len(prow_xs) - 2))
        f = t - i
        w = prow_w[i] + (prow_w[i + 1] - prow_w[i]) * f
        yb = prow_yb[i] + (prow_yb[i + 1] - prow_yb[i]) * f
        yt = prow_yt[i] + (prow_yt[i + 1] - prow_yt[i]) * f
        pb.box((x, (yb + yt) / 2, 0.0), (2.6, (yt - yb) * 0.96, 2 * w * 0.94), STEEL * 0.9)
    # оранжевая накладка-гребень на клюве
    pb.box((-140.0, 112.0, 0.0), (34.0, 6.0, 26.0), ORANGE)
    for k in range(5):
        pb.box((-152.0 + k * 7.0, 115.5, 0.0), (3.0, 3.0, 22.0), ORANGE_D)

    # клыки вокруг буровой головы (6 шт.)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.52
        y0 = CRUSH_Y + math.cos(a) * 40.0
        z0 = math.sin(a) * 40.0
        pb.seg((-196.0, y0, z0), (-214.0, CRUSH_Y + math.cos(a) * 26.0, math.sin(a) * 26.0),
               14.0, 12.0, DARK if k % 2 else DARK_M, ref=(0, 1, 0))
        pb.box((-190.0, y0, z0), (10.0, 12.0, 12.0), STEEL)
    # силовые стойки от клюва к буровому блоку
    for zs in (-1, 1):
        pb.seg((-150.0, 88.0, zs * 34.0), (-186.0, 74.0, zs * 30.0), 12.0, 10.0, STEEL_M if False else STEEL_L)
        pb.seg((-150.0, 52.0, zs * 34.0), (-186.0, 40.0, zs * 28.0), 12.0, 10.0, STEEL)
    return pb


def hull_rear():
    """Корма: транцевая плита, оранжевая броня, гнёзда сопел."""
    pb = PB()
    # транцевая плита под маршевый блок
    pb.box((188.0, 56.0, 0.0), (24.0, 54.0, 120.0), STEEL)
    pb.box((176.0, 56.0, 0.0), (10.0, 62.0, 96.0), STEEL_L * 0.9)
    for zs in (-1, 1):
        pb.box((188.0, 84.0, zs * 42.0), (26.0, 8.0, 30.0), ORANGE_D)
        pb.box((186.0, 30.0, zs * 46.0), (26.0, 8.0, 26.0), STEEL * 0.9)
    # транец: оранжевая броня, рёбра жёсткости, люки
    for zs in (-1, 1):
        pb.box((199.0, 84.0, zs * 40.0), (4.0, 22.0, 46.0), ORANGE * 0.95)
        pb.box((199.0, 34.0, zs * 46.0), (4.0, 16.0, 30.0), ORANGE_D)
        for k in range(3):
            pb.box((200.0, 70.0 + k * 9.0, zs * 16.0), (3.0, 5.0, 22.0), STEEL_L * 0.8)
    pb.box((199.0, 58.0, 0.0), (4.0, 60.0, 30.0), STEEL_L * 0.85)
    # рёбра-радиаторы на хвосте (статичная «расчёска» под маршевым блоком)
    for k in range(5):
        pb.box((150.0 + k * 8.0, 34.0, 0.0), (3.0, 8.0, 62.0), DARK_M * (1.1 if k % 2 else 0.9))
    return pb


def dorsal():
    """Спинной гребень: канал, кожухи, баки, антенны."""
    pb = PB()
    for i in range(9):
        x = NOSE_X + 26 + i * 34.0
        w = bwidth(x)
        yt = bback(x)
        pb.box((x, yt + 2.0, 0.0), (26.0, 4.4, 2 * w * 0.56), DARK_M * (1.1 if i % 2 else 0.95))
        pb.box((x, yt + 4.6, 0.0), (18.0, 3.0, 2 * w * 0.30), STEEL_L * 0.85)
    # баки по бортам спины
    for zs in (-1, 1):
        for x in (-60.0, -10.0, 40.0, 90.0):
            w = bwidth(x)
            pb.cyl(x, bback(x) + 3.0, zs * w * 0.66, 6.0, 28.0, axis='x', seg=10,
                   color=SILVER_D * 0.95)
    # спинной гребень-призма: узкий брус по всей длине
    for i in range(len(BODY_X) - 1):
        x0, x1 = BODY_X[i], BODY_X[i + 1]
        xm = (x0 + x1) / 2
        w = bwidth(xm)
        yt = bback(xm)
        pb.box((xm, yt + 1.2, 0.0), (x1 - x0, 2.6, 2 * w * 0.20), SILVER_L * 0.85)
        pb.box((xm, yt + 3.0, 0.0), (x1 - x0 - 2.0, 2.0, 2 * w * 0.10), STEEL_L * 0.9)
    # тёмный настил-панели по спине (разбивает белые блики)
    for i in range(10):
        x = NOSE_X + 22 + i * 32.0
        w = bwidth(x)
        pb.box((x, bback(x) + 0.8, 0.0), (26.0, 2.4, 2 * w * 0.86), DARK_M * (0.95 if i % 2 else 1.1))
    # антенны и мачта
    pb.seg((-30.0, 104.0, 16.0), (-34.0, 118.0, 18.0), 2.2, 2.2, STEEL_L)
    pb.seg((20.0, 100.0, -14.0), (16.0, 116.0, -16.0), 2.0, 2.0, STEEL_L * 0.8)
    pb.box((-32.0, 119.0, 17.0), (4.0, 3.0, 4.0), RED * 0.8)
    return pb


def prow_plates():
    """Две тёмные полированные мандибулы над буровой головой."""
    pb = PB()
    for zs in (-1, 1):
        xs = [-158.0, -140.0, -120.0, -100.0]
        za, zb = 8.0, 40.0
        for i in range(len(xs) - 1):
            x0, x1 = xs[i], xs[i + 1]
            y0 = 104.0 + (1.4 if i == 0 else 0.6) * i * 2.0
            y1 = y0 + 6.0
            pb.face((x0, y0, zs * za), (x1, y0 + 1.0, zs * za),
                    (x1, y1 + 1.0, zs * zb), (x0, y1, zs * zb), DARK)
            pb.face((x0, y0 - 4.0, zs * za), (x1, y0 - 3.0, zs * za),
                    (x1, y0 + 1.0, zs * za), (x0, y0 + 2.0, zs * za), DARK_M)
            # боковая стенка плиты
            pb.face((x0, y1, zs * zb), (x1, y1 + 1.0, zs * zb),
                    (x1, y0 + 1.0, zs * zb), (x0, y0, zs * zb), DARK_M * 0.9)
        # блик-полоса на полированной плите
        pb.box((-130.0, 110.5, zs * 24.0), (30.0, 1.2, 12.0), SILVER_D * 0.55)
    # центральный замок между мандибулами
    pb.box((-150.0, 108.0, 0.0), (16.0, 8.0, 16.0), STEEL_L)
    return pb


def visor_ring():
    """Янтарное кольцо-визор буровой головы (12 сегментов)."""
    pb = PB()
    n = 12
    for k in range(n):
        a0 = 2 * math.pi * k / n + 0.03
        a1 = a0 + (2 * math.pi / n) * 0.74
        r0, r1 = 42.0, 52.0
        x = -200.0
        p0 = (x, CRUSH_Y + math.cos(a0) * r0, math.sin(a0) * r0)
        p1 = (x, CRUSH_Y + math.cos(a1) * r0, math.sin(a1) * r0)
        p2 = (x, CRUSH_Y + math.cos(a1) * r1, math.sin(a1) * r1)
        p3 = (x, CRUSH_Y + math.cos(a0) * r1, math.sin(a0) * r1)
        pb.face(p0, p1, p2, p3, AMBER, 1.0)
        pb.face((x - 4.0,) + p0[1:], (x - 4.0,) + p3[1:], (x - 4.0,) + p2[1:],
                (x - 4.0,) + p1[1:], GOLD * 0.55)
        # торцы сегмента
        pb.face(p0, p3, (x - 4.0,) + p3[1:], (x - 4.0,) + p0[1:], GOLD * 0.8)
        pb.face((x - 4.0,) + p1[1:], (x - 4.0,) + p2[1:], p2, p1, GOLD * 0.8)
    # тёмное тело кольца
    pb.cyl(-198.0, CRUSH_Y, 0.0, 41.0, 6.0, axis='x', seg=18, color=DARK)
    # янтарная «печь» внутри: конус, кольца, радиальные рёбра, блики
    pb.cyl(-194.0, CRUSH_Y, 0.0, 34.0, 14.0, axis='x', seg=18, color=AMBER * 0.42)
    pb.cyl(-188.0, CRUSH_Y, 0.0, 26.0, 10.0, axis='x', seg=16, color=AMBER * 0.62)
    pb.cyl(-184.0, CRUSH_Y, 0.0, 15.0, 8.0, axis='x', seg=14, color=GOLD * 0.85)
    for k in range(8):
        a = 2 * math.pi * k / 8 + 0.15
        pb.seg((-196.0, CRUSH_Y + math.cos(a) * 30.0, math.sin(a) * 30.0),
               (-183.0, CRUSH_Y + math.cos(a) * 13.0, math.sin(a) * 13.0),
               4.0, 4.0, DARK, ref=(1, 0, 0))
    for rr, colr in ((30.0, GOLD * 0.7), (22.0, AMBER), (12.0, GOLD)):
        pb.cyl(-190.0, CRUSH_Y, 0.0, rr, 1.6, axis='x', seg=18, color=colr)
    # тёплые блики в глубине
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.6
        pb.box((-182.0, CRUSH_Y + math.cos(a) * 7.0, math.sin(a) * 7.0),
               (3.0, 5.0, 5.0), WARM)
    return pb


def crusher():
    """Барабан-измельчитель: зубцы, бандажи, ступица. Вращается вокруг X."""
    pb = PB()
    ln = CRUSH_BACK - CRUSH_NOSE
    cx = (CRUSH_NOSE + CRUSH_BACK) / 2
    pb.cyl(cx, CRUSH_Y, 0.0, 30.0, ln, axis='x', seg=20, color=STEEL_L * 1.1, teeth=1)
    for off in (-12.0, 0.0, 12.0):
        pb.cyl(cx + off, CRUSH_Y, 0.0, 33.0, 4.0, axis='x', seg=20, color=STEEL)
        pb.cyl(cx + off, CRUSH_Y, 0.0, 34.5, 1.4, axis='x', seg=20, color=GOLD * 0.55)
    # продольные резцы
    for k in range(12):
        a = 2 * math.pi * k / 12
        pb.box((cx, CRUSH_Y + math.cos(a) * 33.0, math.sin(a) * 33.0),
               (ln * 0.82, 6.0, 6.0), DARK if k % 2 else STEEL)
    # носовая ступица с резцами
    pb.cyl(CRUSH_NOSE + 1.0, CRUSH_Y, 0.0, 18.0, 4.0, axis='x', seg=14, color=STEEL)
    for k in range(8):
        a = 2 * math.pi * k / 8 + 0.2
        pb.box((CRUSH_NOSE - 1.5, CRUSH_Y + math.cos(a) * 24.0, math.sin(a) * 24.0),
               (5.0, 7.0, 7.0), DARK_M)
    # локальные координаты узла: ноль ровно на оси барабана (x и y)
    pb.V = [[vx - cx, vy - CRUSH_Y, vz] for (vx, vy, vz) in pb.V]
    return pb


def jaws():
    """Неподвижные клыки-отбойники под и над барабаном."""
    pb = PB()
    for (yy, hh) in ((CRUSH_Y - 44.0, 12.0), (CRUSH_Y + 44.0, 12.0)):
        pb.box((-186.0, yy, 0.0), (26.0, hh, 54.0), DARK_M)
        for k in (-1, 0, 1):
            pb.box((-200.0, yy, k * 18.0), (10.0, hh * 0.7, 10.0), STEEL)
    for zs in (-1, 1):
        pb.box((-186.0, CRUSH_Y, zs * 46.0), (26.0, 60.0, 10.0), DARK_M)
    return pb


# ---------------------------------------------------------------- руки
ARMS = [(-30.0, 80.0), (48.0, 60.0), (118.0, 50.0)]      # (x, y) шарнира


def arm(idx, sign):
    """Рука: сегмент → плоский бак-слэб → клешня-измельчитель.
    Локальные координаты узла: ноль в шарнире, рука уходит по z * sign."""
    x0, y0 = ARMS[idx]
    pb = PB()
    z = lambda v: sign * v
    # шарнир
    pb.box((0.0, 0.0, z(6.0)), (34.0, 28.0, 18.0), STEEL_L * 0.95)
    pb.cyl(0.0, 0.0, z(12.0), 9.0, 20.0, axis='z', seg=12, color=DARK_M)
    # верхнее и нижнее перо шарнира
    pb.seg((0.0, 12.0, z(2.0)), (0.0, 17.0, z(22.0)), 14.0, 8.0, SILVER_D * 0.95)
    pb.seg((0.0, -12.0, z(2.0)), (0.0, -17.0, z(22.0)), 14.0, 8.0, SILVER_D * 0.9)
    # основной сегмент (толстая «плечевая» связка, уходит наружу)
    pb.seg((0.0, 0.0, z(12.0)), (0.0, 2.0, z(34.0)), 26.0, 20.0, SILVER, ref=(0, 1, 0))
    pb.box((0.0, 2.0, z(36.0)), (26.0, 20.0, 14.0), STEEL)
    # золотые гидравлические тяги плеча
    for dy in (-9.0, 9.0):
        pb.seg((0.0, dy, z(4.0)), (0.0, dy * 0.7, z(34.0)), 3.2, 3.2, GOLD * 0.62,
               ref=(0, 1, 0))
    # накладка-броня на сегменте
    pb.box((0.0, 16.0, z(26.0)), (22.0, 4.0, 26.0), ORANGE)
    # бак-слэб
    pb.box((0.0, 4.0, z(60.0)), (84.0, 17.0, 38.0), SILVER_L * 0.98)
    pb.box((0.0, 14.0, z(60.0)), (80.0, 3.0, 34.0), SILVER)
    pb.box((0.0, -4.0, z(60.0)), (80.0, 3.0, 34.0), SILVER_D * 0.95)
    # вентиляционные рёбра на внешней плоскости слэба
    for k in range(7):
        xx = -34.0 + k * 11.3
        pb.box((xx, 16.0, z(60.0)), (6.4, 2.4, 30.0), DARK_M)
        pb.box((xx + 5.6, 16.2, z(60.0)), (2.0, 1.6, 28.0), GOLD * 0.55)
    for k in range(5):
        pb.box((-30.0 + k * 15.0, 4.0, z(79.5)), (8.0, 13.0, 1.2), STEEL * 1.1)
    # оранжевый маркер на слэбе
    pb.box((28.0, 4.0, z(72.0)), (24.0, 12.0, 2.4), ORANGE)
    # законцовка и клешня
    pb.box((0.0, 4.0, z(83.0)), (30.0, 15.0, 10.0), STEEL_L * 0.9)
    pb.cyl(0.0, 4.0, z(88.0), 10.0, 12.0, axis='z', seg=14, color=STEEL, teeth=1)
    pb.cyl(0.0, 4.0, z(92.5), 5.0, 3.0, axis='z', seg=12, color=GOLD * 0.75)
    for (dx, dy) in ((-11.0, 8.0), (11.0, 8.0), (-11.0, -7.0), (11.0, -7.0)):
        pb.seg((dx * 0.8, 5.0 + dy * 0.8, z(90.0)), (dx * 1.15, 5.0 + dy * 1.15, z(98.0)),
               7.0, 6.0, DARK_M)
        pb.box((dx * 1.2, 5.0 + dy * 1.2, z(99.0)), (6.0, 6.0, 5.0), DARK)
    # оранжевая маркировка
    pb.box((0.0, 5.0, z(44.0)), (20.0, 8.0, 2.0), ORANGE_L * 0.9)
    return pb


# ---------------------------------------------------------------- рёбра-радиаторы
def fins(sign):
    """Четыре плоских ребра-радиатора на корме: короткие, толстые, подняты краем."""
    pb = PB()
    root_x, root_y = 150.0, 78.0
    for i in range(4):
        zc = sign * (26.0 + i * 24.0)
        y0 = root_y + i * 2.0
        tilt = 12.0 + i * 3.0
        x0, x1 = root_x - 26.0, root_x + 34.0
        th = 4.0
        # верхняя и нижняя плоскости ребра
        pb.face((x0, y0, zc - 10.0), (x1, y0, zc - 10.0),
                (x1, y0 + tilt, zc + 10.0), (x0, y0 + tilt, zc + 10.0), SILVER_L * 0.96)
        pb.face((x0, y0 - th, zc - 10.0), (x0, y0 + tilt - th, zc + 10.0),
                (x1, y0 + tilt - th, zc + 10.0), (x1, y0 - th, zc - 10.0), DARK_M)
        pb.face((x0, y0, zc - 10.0), (x0, y0 + tilt, zc + 10.0),
                (x0, y0 + tilt - th, zc + 10.0), (x0, y0 - th, zc - 10.0), SILVER_D)
        pb.face((x1, y0, zc - 10.0), (x1, y0 - th, zc - 10.0),
                (x1, y0 + tilt - th, zc + 10.0), (x1, y0 + tilt, zc + 10.0), SILVER_D * 0.9)
        pb.face((x0, y0, zc - 10.0), (x1, y0, zc - 10.0), (x1, y0 - th, zc - 10.0),
                (x0, y0 - th, zc - 10.0), DARK_M * 0.9)
        pb.face((x0, y0 + tilt, zc + 10.0), (x0, y0 + tilt - th, zc + 10.0),
                (x1, y0 + tilt - th, zc + 10.0), (x1, y0 + tilt, zc + 10.0), SILVER_D)
        # рёбра жёсткости и оранжевая кромка
        for k in range(4):
            xx = x0 + 10.0 + k * 14.0
            pb.box((xx, y0 + tilt * 0.5 + 1.0, zc), (2.2, 3.0, 18.0), STEEL_L * 0.85)
        pb.box((x1 - 4.0, y0 + tilt * 0.6 + 1.0, zc), (5.0, 3.4, 20.0), ORANGE)
        # корневой узел с золотой окантовкой
        pb.box((x0 + 8.0, y0 - 1.0, zc), (20.0, 12.0, 20.0), STEEL)
        pb.box((x0 + 8.0, y0 + 5.4, zc), (16.0, 2.0, 16.0), GOLD * 0.6)
    return pb


# ---------------------------------------------------------------- ангары
def hangar():
    """Два ангарных проёма снизу: тёплый свет, мостки, решётчатые полы."""
    pb = PB()
    for zs in (-1, 1):
        cx, cz = 46.0, zs * 30.0
        # тёмный проём в днище
        pb.box((cx, bbelly(cx) + 1.0, cz), (76.0, 10.0, 40.0), DARK * 0.6)
        pb.face((cx - 38.0, bbelly(cx) - 4.0, cz - 20.0), (cx + 38.0, bbelly(cx) - 4.0, cz - 20.0),
                (cx + 38.0, bbelly(cx) - 4.0, cz + 20.0), (cx - 38.0, bbelly(cx) - 4.0, cz + 20.0),
                WARM * 0.95)
        # рама проёма
        for (dx, dz, sx, sz) in ((-38.0, 0.0, 3.0, 42.0), (38.0, 0.0, 3.0, 42.0),
                                 (0.0, -20.0, 76.0, 3.0), (0.0, 20.0, 76.0, 3.0)):
            pb.box((cx + dx, bbelly(cx) - 3.5, cz + dz), (sx, 5.0, sz), STEEL_L * 0.85)
        # решётчатый пол и мостки
        for k in range(6):
            pb.box((cx - 30.0 + k * 12.0, bbelly(cx) - 5.0, cz), (2.0, 1.2, 34.0),
                   STEEL * 1.2)
        # тёплые полосы света по бортам проёма
        for dx in (-30.0, 30.0):
            pb.face((cx + dx, bbelly(cx) - 6.2, cz - 18.0), (cx + dx + 6.0, bbelly(cx) - 6.2, cz - 18.0),
                    (cx + dx + 6.0, bbelly(cx) - 6.2, cz + 18.0), (cx + dx, bbelly(cx) - 6.2, cz + 18.0),
                    WARM * 1.25)
        # кран-балка в проёме
        pb.box((cx, bbelly(cx) + 6.0, cz), (60.0, 2.0, 2.0), STEEL_L)
    return pb


def gantry():
    """Наружные мостки, кабельные лотки, лестницы по бортам."""
    pb = PB()
    for zs in (-1, 1):
        for x in (-60.0, -10.0, 40.0, 90.0, 140.0):
            w = bwidth(x)
            yb = bbelly(x)
            pb.box((x, yb + 6.0, zs * (w * 0.80)), (30.0, 2.0, 12.0), STEEL_L * 0.8)
            for k in range(4):
                pb.box((x - 9.0 + k * 6.0, yb + 9.0, zs * (w * 0.80)), (1.4, 5.0, 1.4),
                       STEEL)
            pb.box((x, yb + 11.5, zs * (w * 0.80)), (30.0, 1.2, 1.2), STEEL_L * 0.75)
        # кабельные лотки вдоль борта
        for i in range(3):
            pb.cyl(0.0, bbelly(0.0) + 14.0 + i * 4.0, zs * (bwidth(0.0) * 0.9), 1.6, 300.0,
                   axis='x', seg=6, color=STEEL_L * 0.7)
    return pb


# ---------------------------------------------------------------- двигатели
ENGINES = [(-20.0, 44.0), (20.0, 44.0), (-48.0, 44.0), (48.0, 44.0),
           (-20.0, 70.0), (20.0, 70.0), (-48.0, 70.0), (48.0, 70.0)]   # (z, y)


def engines():
    pb = PB()
    for (cz, cy) in ENGINES:
        pb.cyl(206.0, cy, cz, 15.0, 12.0, axis='x', seg=14, color=STEEL)
        pb.cyl(214.0, cy, cz, 15.0, 8.0, axis='x', seg=14, color=DARK_M)
        # обечайка
        pb.cyl(218.0, cy, cz, 17.0, 6.0, axis='x', seg=14, color=STEEL_L * 0.95)
        for k in range(4):
            a = 2 * math.pi * k / 4 + 0.6
            pb.box((212.0, cy + math.cos(a) * 17.0, cz + math.sin(a) * 17.0),
                   (7.0, 4.0, 4.0), STEEL)
    return pb


def thrusters():
    """Диски тяги на срезах сопел."""
    pb = PB()
    for (cz, cy) in ENGINES:
        r = 12.0
        seg = 14
        for k in range(seg):
            a0 = 2 * math.pi * k / seg
            a1 = 2 * math.pi * (k + 1) / seg
            pb.tri((221.0, cy, cz),
                   (221.0, cy + math.cos(a0) * r, cz + math.sin(a0) * r),
                   (221.0, cy + math.cos(a1) * r, cz + math.sin(a1) * r), BLUE * 0.95)
    return pb


# ---------------------------------------------------------------- пилоны
PYLONS = [(-46.0, -62.0), (-46.0, 62.0), (86.0, -70.0), (86.0, 70.0)]


def pylon(idx):
    """Стыковочный пилон: телескоп вниз до Y = 0 (узел в точке крепления)."""
    x, z = PYLONS[idx]
    yb = bbelly(x)
    drop = yb
    pb = PB()
    pb.box((0.0, -5.0, 0.0), (22.0, 8.0, 22.0), STEEL_L * 0.9)
    pb.seg((0.0, -4.0, 0.0), (0.0, -drop * 0.55, 0.0), 15.0, 15.0, STEEL)
    pb.box((0.0, -drop * 0.55, 0.0), (18.0, 6.0, 18.0), STEEL_L * 0.85)
    pb.seg((0.0, -drop * 0.55, 0.0), (0.0, -drop + 3.0, 0.0), 11.0, 11.0, STEEL_L)
    # ступня-захват
    pb.box((0.0, -drop + 2.5, 0.0), (30.0, 5.0, 30.0), DARK_M)
    pb.box((0.0, -drop + 1.0, 0.0), (26.0, 2.0, 26.0), STEEL)
    for (dx, dz) in ((-13.0, -13.0), (13.0, -13.0), (-13.0, 13.0), (13.0, 13.0)):
        pb.box((dx, -drop + 2.5, dz), (5.0, 5.0, 5.0), STEEL_L * 0.8)
    return pb


# ---------------------------------------------------------------- мелочь и свет
def greebles():
    pb = PB()
    # люки и вентиляция по обшивке
    for (x, ys, zs_) in ((-110.0, 0.55, 0.72), (-70.0, 0.30, 0.85), (-20.0, 0.62, 0.70),
                         (30.0, 0.35, 0.88), (80.0, 0.58, 0.74), (120.0, 0.40, 0.80)):
        w = bwidth(x)
        yb, yt = bbelly(x), bback(x)
        y = yb + (yt - yb) * ys
        for s in (-1, 1):
            pb.box((x, y, s * w * zs_), (14.0, 3.0, 8.0), DARK_M)
            pb.box((x, y, s * (w * zs_ + 1.0)), (10.0, 2.0, 1.0), STEEL_L * 0.8)
    # короба на спине
    for i in range(5):
        x = -80.0 + i * 54.0
        yt = bback(x)
        pb.box((x, yt + 6.0, 0.0), (22.0, 8.0, 20.0), STEEL_M if False else STEEL)
        pb.box((x, yt + 10.5, 0.0), (16.0, 2.0, 14.0), DARK_M)
    # мелкие навески у кормы
    for zs in (-1, 1):
        pb.box((150.0, 60.0, zs * 26.0), (16.0, 12.0, 12.0), STEEL_L * 0.8)
        pb.cyl(160.0, 48.0, zs * 34.0, 5.0, 18.0, axis='x', seg=8, color=STEEL)
    # ангарные номера-табло (вместо надписей — светлые панели)
    for zs in (-1, 1):
        pb.box((8.0, bbelly(8.0) + 3.0, zs * (bwidth(8.0) * 0.98)),
               (26.0, 10.0, 1.5), SILVER_L * 1.05)
    return pb


def lights():
    pb = PB()
    # синие прожекторы под носом (как в кадре астероидного поля)
    for zs in (-1, 1):
        for dz in (12.0, 34.0):
            pb.box((-150.0, 44.0, zs * dz), (10.0, 8.0, 10.0), STEEL)
            pb.face((-155.0, 39.0, zs * dz - 4.0), (-155.0, 39.0, zs * dz + 4.0),
                    (-155.0, 47.0, zs * dz + 4.0), (-155.0, 47.0, zs * dz - 4.0),
                    BLUE * 1.25)
    # янтарные рабочие огни у ангаров
    for zs in (-1, 1):
        for dx in (-32.0, 32.0):
            pb.face((46.0 + dx, bbelly(46.0) - 5.4, zs * 30.0 - 3.0),
                    (46.0 + dx, bbelly(46.0) - 5.4, zs * 30.0 + 3.0),
                    (46.0 + dx, bbelly(46.0) - 1.0, zs * 30.0 + 3.0),
                    (46.0 + dx, bbelly(46.0) - 1.0, zs * 30.0 - 3.0), AMBER)
    # маркеры по бортам и на законцовках рук
    for zs in (-1, 1):
        for x in (-110.0, -20.0, 70.0):
            w = bwidth(x)
            pb.face((x - 6.0, 74.0, zs * (w + 0.4)), (x + 6.0, 74.0, zs * (w + 0.4)),
                    (x + 6.0, 78.0, zs * (w + 0.4)), (x - 6.0, 78.0, zs * (w + 0.4)),
                    RED if zs < 0 else BLUE * 0.95)
    # габаритные огни на законцовках рук
    for (ax, ay) in ARMS:
        for zs in (-1, 1):
            pb.box((ax, ay + 5.0, zs * (ARM_Z + 96.0)), (2.0, 2.0, 2.0), RED * 0.9)
    return pb


# ---------------------------------------------------------------- сборка
def main():
    b = GlbBuilder()
    m_armor = b.material('imp_silver', metallic=0.35, roughness=0.48)
    m_body = b.material('imp_hull', metallic=0.55, roughness=0.45)
    m_dark = b.material('imp_dark', metallic=0.70, roughness=0.30)
    m_visor = b.material('imp_visor', metallic=0.0, roughness=0.28)
    m_thrust = b.material('imp_thrust', metallic=0.0, roughness=0.25)
    m_glow = b.material('imp_glow', metallic=0.0, roughness=0.30)

    stats = {}
    tris = 0

    def add(name, pb, mat, pos=None, kind=None, rot_y=None):
        nonlocal tris
        v, t, c = pb.get()
        idx = b.mesh(name, v, t, c, mat)
        quat = None
        if rot_y is not None:
            a = np.deg2rad(rot_y) / 2.0
            quat = [0.0, float(np.sin(a)), 0.0, float(np.cos(a))]
        b.node(name, idx, translation=pos, rotation=quat)
        stats[name] = (len(v), len(t))
        tris += len(t)
        if kind:
            if rot_y is not None:
                CHECK.append(vert_bounds(pb, rot_y, tuple(pos or (0, 0, 0))) + (kind,))
            else:
                check(pb.bounds(), kind, off=pos or (0, 0, 0))

    add('hull_mid', hull_mid(), m_armor, kind='hull')
    add('hull_bow', hull_bow(), m_armor, kind='hull')
    add('hull_rear', hull_rear(), m_body, kind='hull')
    add('dorsal', dorsal(), m_body, kind='hull')
    add('prow_plates', prow_plates(), m_dark, kind='hull')
    add('visor_ring', visor_ring(), m_visor)
    add('crusher', crusher(), m_body, pos=[(CRUSH_NOSE + CRUSH_BACK) / 2, CRUSH_Y, 0.0])
    add('jaws', jaws(), m_dark, kind='jaws')
    add('hangar', hangar(), m_body, kind='hull')
    add('gantry', gantry(), m_body, kind='hull')
    add('engines', engines(), m_body, kind='hull')
    add('thrusters', thrusters(), m_thrust)
    add('greebles', greebles(), m_body, kind='hull')
    add('lights', lights(), m_glow)
    # ширина корабля 262 м — по законцовкам клешней: положение шарнира считаем
    # из фактической геометрии руки, чтобы размах был ровно в габарите
    probe_pb = arm(0, 1)
    pv = np.array(probe_pb.V, np.float64)
    deg = -ARM_SWEEP                      # правый борт: отвод назад
    cs = np.cos(np.deg2rad(deg))
    sn = np.sin(np.deg2rad(deg))
    pz = np.max(-pv[:, 0] * sn + pv[:, 2] * cs)
    arm_z = HZ - pz
    print('шарнир руки на z = %.2f (законцовка %.2f)' % (arm_z, pz))
    for i, (x, y) in enumerate(ARMS):
        for sign in (1, -1):
            name = 'arm_%d%s' % (i, 'r' if sign > 0 else 'l')
            sweep = -ARM_SWEEP * sign
            add(name, arm(i, sign), m_armor, pos=[x, y, sign * arm_z], kind='arm',
                rot_y=sweep)
            zc = sign * (arm_z - ARM_RETRACT)
            CHECK.append(vert_bounds(arm(i, sign), sweep, (x, y, zc)) + ('arm_retracted',))
    for sign in (1, -1):
        add('fins_r' if sign > 0 else 'fins_l', fins(sign), m_armor, kind='fins')
    for i, (x, z) in enumerate(PYLONS):
        add('pylon_%d' % i, pylon(i), m_body, pos=[x, bbelly(x), z], kind='pylon%d' % i)
    # буровой барабан: AABB по его собственной геометрии
    check((CRUSH_NOSE - 4.0, CRUSH_BACK, CRUSH_Y - 36.0, CRUSH_Y + 36.0, -36.0, 36.0), 'crusher')

    data = b.build('armstrong_imp')
    open(os.path.join(P, 'armstrong_imp.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-12s verts %6d tris %6d' % (k, nv, nt))

    modes = {
        'docked':  {'arms': 0.0, 'crusher': 0.0, 'thrust': 0.0, 'pylons': 1.0,
                    'visor': 0.35, 'floods': 0.6},
        'mining':  {'arms': 0.0, 'crusher': 1.2, 'thrust': 0.0, 'pylons': 0.0,
                    'visor': 1.0, 'floods': 1.0},
        'transit': {'arms': 1.0, 'crusher': 0.0, 'thrust': 0.55, 'pylons': 0.0,
                    'visor': 0.3, 'floods': 0.0},
        'warp':    {'arms': 1.0, 'crusher': 0.0, 'thrust': 1.0, 'pylons': 0.0,
                    'visor': 0.5, 'floods': 0.0},
    }
    json.dump({'arms': 6, 'arm_sweep_deg': ARM_SWEEP, 'arm_retract': ARM_RETRACT,
               'pylons': len(PYLONS),
               'crusher_axis_x': (CRUSH_NOSE + CRUSH_BACK) / 2,
               'modes': modes,
               'dims': {'L': L, 'W': W, 'H': H}},
              open(os.path.join(P, 'modes.json'), 'w'), indent=1)
    print('modes.json')

    # ---------------- габарит и пересечения ----------------
    landed = [c for c in CHECK if c[6] != 'arm_retracted']
    xmin = min(c[0] for c in CHECK); xmax = max(c[1] for c in CHECK)
    ymin = min(c[2] for c in landed); ymax = max(c[3] for c in CHECK)
    zmin = min(c[4] for c in CHECK); zmax = max(c[5] for c in CHECK)
    print('габарит: %.1f x %.1f x %.1f м' % (xmax - xmin, ymax - ymin, zmax - zmin))
    bad = []
    if xmin < -HX - 0.6 or xmax > HX + 0.6:
        bad.append('длина')
    if zmin < -HZ - 0.6 or zmax > HZ + 0.6:
        bad.append('ширина')
    if ymin < -0.6 or ymax > H + 0.6:
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
            if 'hull' in (ak, bk) or ak == bk:
                continue
            if str(ak).startswith('arm') and str(bk).startswith('arm'):
                continue
            # клыки охватывают барабан по замыслу — это не пересечение
            if {ak, bk} == {'jaws', 'crusher'}:
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
    # считаем точные мировые границы по вершинам GLB с учётом поворотов узлов
    gx0 = gy0 = gz0 = 1e9
    gx1 = gy1 = gz1 = -1e9
    import struct, json as _json
    raw = open(os.path.join(P, 'armstrong_imp.glb'), 'rb').read()
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
        q = node.get('rotation', [0, 0, 0, 1])
        x, y, z, w = q
        R = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        wp = pv @ R.T + np.array(node.get('translation', [0, 0, 0]))
        gx0, gy0, gz0 = min(gx0, wp[:, 0].min()), min(gy0, wp[:, 1].min()), min(gz0, wp[:, 2].min())
        gx1, gy1, gz1 = max(gx1, wp[:, 0].max()), max(gy1, wp[:, 1].max()), max(gz1, wp[:, 2].max())
    print('по файлу GLB: %.1f x %.1f x %.1f м (x[%.1f..%.1f] y[%.1f..%.1f] z[%.1f..%.1f])'
          % (gx1 - gx0, gy1 - gy0, gz1 - gz0, gx0, gx1, gy0, gy1, gz0, gz1))
    if (gx1 - gx0 > L + 0.6 or gz1 - gz0 > W + 0.6 or gy1 - gy0 > H + 0.6
            or gy0 < -0.6):
        raise SystemExit('GLB envelope broken')
    print('geometry: OK')


if __name__ == '__main__':
    main()
