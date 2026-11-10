#!/usr/bin/env python3
"""Armstrong IMP Tap — средний шахтёрский корабль (Rare, Miner), 47.8 × 48.5 × 19 м.

Собственная интерпретация по описанию маркета и кадрам галереи (без копирования
геометрии): приземистая двухъярусная «баржа» — тёмная индустриальная рама снизу,
массивная оранжево-песочная броня-карапас сверху с фасетными скосами и тёмным
центральным позвоночником, впереди свес-«бровь» и блок cruncher-muncher из трёх
буровых барабанов с зубцами, сзади батарея дюз 4 + 2, решётчатые выхлопы, по
бортам широкие оранжевые поды-«крылья» с вентиляционными решётками, снизу шесть
посадочных лап со ступнями-зубьями.

Узлы: hull (рама), shell (броня-карапас), armor (плиты, поды, бровь),
machinery, drill_mount, drills (вращение вокруг X), engines, vent_grilles,
thrusters (гаснут/зажигаются), lights, leg_0..5 (шарнир в бедре).

Габарит: всё внутри 47.8 × 48.5 × 19 м, ступни лап в посадочной позе на Y=0.
"""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, cylinder, merge, quad

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261113)

# ---------------------------------------------------------------- габарит
L, W, H = 47.8, 48.5, 19.0
HX, HZ = L / 2, W / 2                 # 23.9 / 24.25

Y_KEEL, Y_MID, Y_TOP = 7.2, 11.6, 18.4   # низ рамы / стык ярусов / верх брони
Y_SPINE = 19.0                            # гребень позвоночника — максимум
NOSE, TAIL = -12.0, 22.0                  # торцы корпуса
DRUM_NOSE, DRUM_BACK = -23.0, -8.0        # буровые барабаны (нос ровно в габарите)
DRUM_AXIS = (DRUM_NOSE + DRUM_BACK) / 2.0
ENG_X0, ENG_X1 = 20.0, 23.9               # дюзы (срез внутри габарита)

# ---------------------------------------------------------------- цвета
ORANGE = np.array([0.62, 0.33, 0.10])
ORANGE_L = np.array([0.78, 0.47, 0.16])
ORANGE_D = np.array([0.42, 0.21, 0.07])
TAN = np.array([0.72, 0.57, 0.35])
STEEL = np.array([0.085, 0.090, 0.100])
STEEL_M = np.array([0.150, 0.155, 0.168])
STEEL_L = np.array([0.245, 0.250, 0.262])
RUST = np.array([0.40, 0.21, 0.10])
GLOW_W = np.array([1.0, 0.94, 0.80])
GLOW_V = np.array([0.66, 0.34, 1.0])
RED = np.array([1.0, 0.26, 0.14])
BLUE = np.array([0.45, 0.78, 1.0])
GLASS = np.array([0.06, 0.10, 0.14])

LIGHT = np.array([0.45, 0.80, 0.40])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# ---------------------------------------------------------------- строитель
class PB:
    """Плоские фасетки с запечённым затенением (материал unlit)."""

    def __init__(self):
        self.V, self.T, self.C = [], [], []

    @staticmethod
    def shade(n):
        lam = max(0.0, float(n @ LIGHT))
        sky = 0.20 * max(0.0, float(n[1])) - 0.12 * max(0.0, -float(n[1]))
        return 0.50 + 0.52 * lam + sky

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
        self.face([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], color, mul)   # верх
        self.face([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], color, mul)   # низ
        self.face([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], color, mul)   # +x
        self.face([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], color, mul)   # -x
        self.face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, mul)   # +z
        self.face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, mul)   # -z

    def seg(self, p0, p1, w, t, color, ref=(0, 0, 1), mul=1.0):
        """Призма вдоль отрезка p0→p1: наклонные стойки лап и тяги."""
        a = np.array(p1, np.float64) - np.array(p0, np.float64)
        ln = np.linalg.norm(a)
        if ln < 1e-9:
            return
        a = a / ln
        r = np.array(ref, np.float64)
        if abs(float(a @ r)) > 0.93:
            r = np.array([1.0, 0.0, 0.0])
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

    def get(self):
        return (np.array(self.V, np.float32), np.array(self.T, np.uint32),
                np.array(self.C, np.float32))

    def bounds(self):
        if not self.V:
            return None
        v = np.array(self.V, np.float32)
        return (v[:, 0].min(), v[:, 0].max(), v[:, 1].min(), v[:, 1].max(),
                v[:, 2].min(), v[:, 2].max())


CHECK = []


def check(b, kind='detail', off=(0, 0, 0)):
    if b is None:
        return
    CHECK.append((b[0] + off[0], b[1] + off[0], b[2] + off[1], b[3] + off[1],
                  b[4] + off[2], b[5] + off[2], kind))


# ---------------------------------------------------------------- профиль
PROFILE = [(-12.0, 17.6), (-9.6, 19.8), (-6.0, 21.0), (-2.0, 21.5), (2.0, 21.6),
           (7.0, 21.3), (12.0, 20.6), (17.0, 19.8), (22.0, 19.2)]
_PX = [p[0] for p in PROFILE]
_PW = [p[1] for p in PROFILE]


def wout(x):
    """Полуширина корпуса в сечении x — плавный «щит» с сужением к носу/корме."""
    return float(np.interp(x, _PX, _PW))


XS = [-12.0, -9.6, -7.2, -4.8, -2.4, 0.0, 2.4, 4.8, 7.2, 9.6, 12.0, 14.4,
      16.8, 19.2, 21.0, 22.0]

def topY(x):
    """Высота палубы карапаса по длине: приподнята в середине, опущена к носу
    и корме — силуэт читается как броневой панцирь, а не коробка."""
    t = min(1.0, max(0.0, (x - NOSE) / 13.0))
    rear = min(1.0, max(0.0, (x - 13.0) / 9.0))
    return 15.7 + 2.7 * t ** 0.65 - 1.1 * rear ** 1.3


# сечения (доля высоты яруса, доля полуширины) — обход от -z низа
SHELL_FR = [0.00, 0.26, 0.60, 0.92, 1.00]
SHELL_ZF = [-1.000, -0.985, -0.930, -0.840, -0.720]


def shell_sec(x):
    w = wout(x)
    t = topY(x)
    left = [(Y_MID + (t - Y_MID) * fr, zf * w) for (fr, zf) in zip(SHELL_FR, SHELL_ZF)]
    right = [(y, -z) for (y, z) in reversed(left)]
    return left + right
FRAME_SEC = [(Y_KEEL, -0.82), (8.4, -0.88), (Y_MID, -0.90),
             (Y_MID, 0.90), (8.4, 0.88), (Y_KEEL, 0.82)]
BROW_UNDER = 13.4


def loft(pb, xs, section_fn, col_fn, cap=(True, True), cap_col=None):
    secs = [section_fn(x) for x in xs]
    n = len(secs[0])
    for i in range(len(xs) - 1):
        A, B = secs[i], secs[i + 1]
        x0, x1 = xs[i], xs[i + 1]
        cA = np.array([[0.0, p[0], p[1]] for p in A]).mean(axis=0)
        cB = np.array([[0.0, p[0], p[1]] for p in B]).mean(axis=0)
        for k in range(n):
            k2 = (k + 1) % n
            p0 = (x0, A[k][0], A[k][1]); p1 = (x1, B[k][0], B[k][1])
            p2 = (x1, B[k2][0], B[k2][1]); p3 = (x0, A[k2][0], A[k2][1])
            nrm = np.cross(np.subtract(p1, p0), np.subtract(p2, p0))
            mid = np.mean(np.array([p0, p1, p2, p3]), axis=0)
            ref = mid - np.array([(x0 + x1) / 2, (cA[1] + cB[1]) / 2, 0.0])
            if float(nrm @ ref) < 0:
                p1, p3 = p3, p1
            pb.face(p0, p1, p2, p3, col_fn(i, k))
    # заглушки торцов
    for idx, flag in ((0, cap[0]), (-1, cap[1])):
        if not flag:
            continue
        S = secs[idx]
        x = xs[idx]
        cy = np.mean([p[0] for p in S])
        cz = np.mean([p[1] for p in S])
        col = cap_col if cap_col is not None else col_fn(0, 0) * 0.9
        for k in range(n):
            k2 = (k + 1) % n
            pb.tri((x, cy, cz), (x, S[k][0], S[k][1]), (x, S[k2][0], S[k2][1]), col)


# ---------------------------------------------------------------- корпус
def hull():
    """Тёмная несущая рама: узкая относительно карапаса, с рёбрами и стойками."""
    pb = PB()
    # пояс-тень на стыке ярусов (читается как зазор под карапасом)
    for i in range(len(XS) - 1):
        x0, x1 = XS[i], XS[i + 1]
        xm = (x0 + x1) / 2
        pb.box((xm, Y_MID - 0.35, 0.0), (x1 - x0, 0.7, 2 * wout(xm) * 0.985), STEEL)
    secs = []

    def sec(x):
        w = wout(x) * 0.965
        return [(y, zf * w) for (y, zf) in FRAME_SEC]
    loft(pb, XS, sec, lambda i, k: STEEL_M * (1.0 if k in (0, 5) else 1.12),
         cap_col=STEEL)
    # продольные рёбра жёсткости по бортам рамы
    for zs in (-1, 1):
        for yy in (8.6, 10.6):
            x = NOSE + 1.5
            while x < TAIL - 1.0:
                w = wout(x) * 0.965 * 0.90
                pb.box((x, yy, zs * (w + 0.25)), (2.9, 0.9, 0.9), STEEL_L * 0.85)
                x += 3.4
    # поперечные шпангоуты снизу
    x = NOSE + 2.0
    while x < TAIL - 1.0:
        w = wout(x) * 0.90
        pb.box((x, Y_KEEL + 0.25, 0.0), (1.3, 1.1, 2 * w * 0.92), STEEL_M * 0.95)
        x += 3.6
    return pb


def shell():
    """Оранжево-песочный карапас: фасетные скосы, тёмный позвоночник сверху."""
    pb = PB()

    def sec(x):
        return shell_sec(x)

    def col(i, k):
        base = ORANGE
        if k in (0, 9):
            return base * 0.78                      # низ борта — тень
        if k in (1, 8):
            return base * 0.93
        if k in (4, 5):
            return base * 0.80                      # палуба под плитами
        if k in (2, 7):
            return (TAN * 0.94 if i % 3 == 1 else base * 1.02)
        return base * 1.06
    loft(pb, XS, sec, col, cap_col=ORANGE_D)

    # тёмный позвоночник по палубе (гребень = максимальная высота корабля)
    for i in range(len(XS) - 1):
        x0, x1 = XS[i] + 0.3, XS[i + 1] - 0.3
        if x0 > 9.0:
            continue
        xm = (x0 + x1) / 2
        hw = 4.6 if xm < 3.0 else 4.6 - (xm - 3.0) * 0.42
        pb.box((xm, (Y_TOP + Y_SPINE) / 2, 0.0), (x1 - x0, Y_SPINE - Y_TOP, 2 * hw),
               STEEL_M * (1.35 if i % 2 else 1.12))
        for zs in (-1, 1):                       # бортики канала
            pb.box((xm, Y_SPINE - 0.20, zs * (hw + 0.25)),
                   (x1 - x0, 0.36, 0.5), STEEL_L * 0.8)
    # машинерия в позвоночнике: секции, патрубки, поперечные рёбра
    for i in range(6):
        x = -10.0 + i * 2.9
        pb.box((x, Y_SPINE - 0.16, 0.0), (2.3, 0.30, 7.6), STEEL_L * 0.72)
        pb.box((x, Y_SPINE - 0.34, 0.0), (0.7, 0.36, 8.6), ORANGE_D * 0.8)
    # кожух-обтекатель на носу позвоночника
    pb.box((-10.6, Y_SPINE - 0.30, 0.0), (2.2, 0.5, 9.4), ORANGE * 0.9)
    for zs in (-1, 1):
        v, t, c = cylinder(-2.0, Y_SPINE - 0.55, zs * 3.6, 0.42, 26.0, axis='x', seg=8,
                           color=RUST * 1.1)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
        for xk in (-8.0, -1.0, 6.0):
            pb.box((xk, Y_SPINE - 0.55, zs * 3.6), (0.45, 1.1, 1.1), STEEL_M * 1.2)
    # передний обтекатель позвоночника (переход к брови)
    pb.box((-11.4, Y_TOP + 0.14, 0.0), (2.6, 0.3, 7.0), ORANGE_D)
    return pb


# ---------------------------------------------------------------- броня
def armor():
    pb = PB()
    plates = []

    def plate(x0, x1, a, b, zs, col):
        # накладная плита по кривизне палубы (тонкая, повторяет скат)
        z0, z1 = sorted((zs * a, zs * b))
        y0, y1 = topY(x0) + 0.30, topY(x1) + 0.30
        pb.face((x0, y0, z0), (x0, y0, z1), (x1, y1, z1), (x1, y1, z0), col)
        plates.append((x0, x1, min(y0, y1), max(y0, y1) + 0.1,
                       min(z0, z1), max(z0, z1)))

    # навесные плиты палубы: крупные, с редкими песочными вставками
    xs = np.linspace(NOSE + 1.0, TAIL - 2.0, 6)
    for i in range(len(xs) - 1):
        x0, x1 = xs[i] + 0.40, xs[i + 1] - 0.40
        xm = (x0 + x1) / 2
        zin = 5.0 if xm < 6.0 else 5.0 + (xm - 6.0) * 0.16      # отступ от позвоночника
        zout = wout(xm) * 0.70 - 0.9
        span = zout - zin
        if span < 1.5:
            continue
        cuts = 2
        for j in range(cuts):
            a = zin + span * j / cuts + 0.25
            b = zin + span * (j + 1) / cuts - 0.25
            if b - a < 1.2:
                continue
            for zs in (-1, 1):
                r = rng.random()
                if r < 0.16:
                    col = ORANGE_D * 1.02
                else:
                    col = ORANGE * rng.uniform(0.94, 1.03)
                plate(x0, x1, a, b, zs, np.clip(col, 0, 1))
    # узкие полосы-рёбра по кромке палубы (повторяют контур)
    for zs in (-1, 1):
        x = NOSE + 2.0
        while x < TAIL - 2.2:
            pb.box((x, topY(x) + 0.20, zs * (wout(x) * 0.70 + 0.10)),
                   (3.4, 0.30, 0.55), ORANGE_D)
            x += 3.9
    # палубная деталировка: люки, вентиляция, кнехты, поручни вдоль канала
    for (hx, hz, hr) in ((-4.0, -9.0, 1.8), (2.0, 10.0, 1.5), (9.5, -8.6, 2.1),
                         (-7.0, 8.4, 1.4), (13.0, 9.6, 1.6)):
        y = topY(hx) + 0.36
        v, t, c = cylinder(hx, y + 0.02, hz, hr, 0.34, axis='y', seg=12,
                           color=STEEL_L * 0.85)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
        v, t, c = cylinder(hx, y + 0.10, hz, hr * 0.55, 0.20, axis='y', seg=12,
                           color=ORANGE_D)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
    for zs in (-1, 1):
        for k in range(3):
            x = -4.0 + k * 8.4
            pb.box((x, topY(x) + 0.10, zs * 6.4), (4.6, 0.34, 1.0), STEEL_M * 1.15)
            for q in range(3):
                pb.box((x - 1.5 + q * 1.5, topY(x) + 0.16, zs * 6.4), (0.7, 0.24, 0.7),
                       STEEL * 1.25)
        # поручни вдоль канала
        for x in np.arange(-7.0, 7.0, 2.4):
            pb.box((x, Y_SPINE - 0.75, zs * 5.1), (0.22, 1.1, 0.22), STEEL_M * 1.15)
        pb.box((-1.0, Y_SPINE - 0.28, zs * 5.1), (15.0, 0.20, 0.20), STEEL_M * 1.25)
        # кнехты и мелкие короба у борта
        for x in (-9.5, -1.0, 7.5, 15.0):
            w = wout(x)
            pb.box((x, topY(x) + 0.24, zs * (w * 0.70 - 1.4)), (1.3, 0.62, 1.3), RUST * 0.9)

    # бортовые бронеплиты карапаса — длинные накладки с редкими швами
    for zs in (-1, 1):
        for fr, hh, tan in ((0.32, 2.8, False), (0.70, 2.3, True)):
            x = NOSE + 1.5
            while x < TAIL - 2.5:
                x1 = min(x + 8.6, TAIL - 2.0)
                xm = (x + x1) / 2
                w, t = wout(xm), topY(xm)
                yy = Y_MID + (t - Y_MID) * fr
                zf = float(np.interp(fr, SHELL_FR, SHELL_ZF))
                col = TAN * 0.90 if tan else ORANGE * rng.uniform(0.95, 1.05)
                pb.box((xm, yy, zs * (w * zf + 0.28)), (x1 - x - 0.7, hh, 1.0),
                       np.clip(col, 0, 1))
                x = x1 + 0.7

    # кормовые скулы-поды («крылья») — самая широкая часть корабля
    POD_SEC = [(7.8, -0.06), (9.4, -0.55), (12.6, -0.92), (15.0, -1.00),
               (15.0, 1.00), (12.6, 0.92), (9.4, 0.55), (7.8, 0.06)]
    pod_xs = [2.6, 5.0, 8.0, 11.5, 15.0, 17.5, 19.5, 20.6]
    pod_w = [0.5, 4.2, 6.4, 7.3, 7.3, 6.0, 3.6, 0.6]

    for zs in (-1, 1):
        def psec(x, zs=zs):
            t = np.interp(x, pod_xs, pod_w)
            return [(y, zs * (16.6 + zf * t)) for (y, zf) in POD_SEC]
        loft(pb, pod_xs, psec,
             lambda i, k: ORANGE * (1.08 if k in (4, 5) else (0.9 if k in (0, 7) else 1.0)),
             cap_col=ORANGE_D)
        # внешняя песочная плита с вентиляционными щелями
        pb.box((10.5, 11.4, zs * 23.9), (12.0, 5.0, 0.7), TAN * 0.95)
        for k in range(5):
            pb.box((5.4 + k * 2.4, 11.4, zs * 24.18), (1.3, 3.2, 0.18), STEEL_M * 0.75)
        # рёбра по верхней полке пода
        for k in range(4):
            pb.box((4.6 + k * 3.8, 15.4, zs * 20.0), (0.9, 0.6, 5.4), STEEL_M * 1.25)
        # кормовой толкатель пода
        pb.box((19.4, 10.2, zs * 20.4), (1.6, 3.2, 3.6), STEEL_M)
        pb.box((20.3, 10.2, zs * 20.4), (0.3, 2.0, 2.4), GLOW_W * 0.26)
        # нижняя бронеплита пода
        pb.box((11.0, 7.9, zs * 20.6), (14.0, 0.9, 6.6), ORANGE_D * 0.9)
        # маркировочные плиты (вместо надписей) и лючки
        pb.box((8.6, 13.9, zs * 23.9), (5.4, 1.5, 0.35), TAN * 1.05)
        for k in range(4):
            pb.box((6.4 + k * 1.4, 13.9, zs * 24.12), (0.55, 1.0, 0.14), STEEL * 1.3)
        pb.box((15.6, 12.2, zs * 24.02), (2.2, 2.2, 0.2), STEEL_M * 0.9)

    for pl in plates:
        CHECK.append((pl[0], pl[1], pl[2], pl[3], pl[4], pl[5], 'hull'))

    # бровь-свес над буровым блоком
    brow_xs = [-19.4, -18.0, -16.6, -15.0, -13.4, NOSE]

    def bsec(x):
        t = (x - (-19.4)) / (NOSE - (-19.4))           # 0 у кончика, 1 у корпуса
        w = 7.4 + 8.2 * t ** 0.8
        top = 14.5 + 1.5 * t ** 0.7
        u = BROW_UNDER
        arc = [(0.00, -0.560), (0.46, -0.800), (0.80, -0.950), (1.00, -1.000)]
        left = [(u + (top - u) * fr, zf * w) for (fr, zf) in arc]
        right = [(y, -z) for (y, z) in reversed(left)]
        return left + right
    loft(pb, brow_xs, bsec, lambda i, k: ORANGE * (1.06 if k in (1, 6) else
                                                  (0.96 if k in (0, 7) else 1.0)),
         cap_col=ORANGE_D)
    # лобовое стекло кабины на переднем скосе брови + рама
    pb.face((-19.5, 15.1, -4.6), (-18.2, 15.6, -4.6), (-18.2, 15.6, 4.6),
            (-19.5, 15.1, 4.6), GLASS * 2.2)
    for zs in (-1, 1):
        pb.box((-18.9, 15.35, zs * 5.0), (1.5, 0.9, 0.9), STEEL_M)
        pb.box((-18.6, 14.6, zs * 4.0), (1.2, 0.5, 9.0), STEEL_M * 1.2)
        # скулы-«жвала» по краям брови
        pb.box((-17.2, 13.9, zs * 13.6), (3.4, 3.4, 2.6), ORANGE_D)
        pb.box((-16.0, 12.4, zs * 12.2), (3.0, 3.0, 2.0), STEEL_M * 1.3)
    return pb


# ---------------------------------------------------------------- машинерия
def machinery():
    pb = PB()
    # трубопроводы по днищу
    for zs in (-1, 1):
        for zz, rr in ((5.0, 0.55), (8.6, 0.42), (12.0, 0.48)):
            v, t, c = cylinder(6.0, Y_KEEL - 0.55, zs * zz, rr, 27.0, axis='x', seg=8,
                               color=STEEL_L * 0.9)
            pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
            pb.T.extend((t + len(pb.V) - len(v)).tolist())
        # хомуты труб
        for x in (-2.0, 6.0, 14.0):
            pb.box((x, Y_KEEL - 0.55, zs * 8.6), (0.5, 1.2, 1.2), STEEL_M)
    # насосные блоки и баки под рамой
    for (bx, by, bz, sx, sy, sz, col) in (
            (2.0, Y_KEEL + 0.6, 0.0, 6.0, 1.6, 4.4, STEEL_M * 1.2),
            (-6.0, Y_KEEL + 0.5, 7.4, 4.4, 1.4, 3.0, STEEL_L * 0.85),
            (-6.0, Y_KEEL + 0.5, -7.4, 4.4, 1.4, 3.0, STEEL_L * 0.85),
            (12.0, Y_KEEL + 0.6, 6.4, 5.0, 1.6, 3.6, RUST * 0.9),
            (12.0, Y_KEEL + 0.6, -6.4, 5.0, 1.6, 3.6, RUST * 0.9),
            (18.0, Y_KEEL + 0.7, 0.0, 4.0, 1.8, 7.0, STEEL_M)):
        pb.box((bx, by, bz), (sx, sy, sz), col)
    # радиаторные гребёнки по бортам рамы
    for zs in (-1, 1):
        for x in (-8.0, -2.0, 4.0, 10.0, 16.0):
            w = wout(x) * 0.965 * 0.90
            pb.box((x, Y_MID - 1.9, zs * (w + 0.45)), (3.4, 2.6, 0.6), STEEL_L * 0.8)
            for k in range(3):
                pb.box((x - 1.1 + k * 1.1, Y_MID - 1.9, zs * (w + 0.80)),
                       (0.35, 2.2, 0.35), STEEL * 1.5)
    # выдвижные трапы и поручни у передних лап
    for zs in (-1, 1):
        for k in range(4):
            pb.box((-9.0, 6.0 - k * 0.8, zs * 13.4), (2.6, 0.28, 0.28), STEEL_L * 0.8)
    # наружная машинерия рамы между подом и днищем
    for zs in (-1, 1):
        for x in (-8.0, -1.0, 6.0, 13.0):
            w = wout(x) * 0.965 * 0.90
            pb.box((x, 9.0, zs * (w + 0.55)), (5.2, 1.2, 1.0), STEEL_L * 0.72)
            for k in range(3):
                pb.box((x - 1.7 + k * 1.7, 9.0, zs * (w + 1.05)), (0.4, 0.9, 0.4),
                       STEEL * 1.5)
        v, t, c = cylinder(2.0, 8.0, zs * 16.4, 0.5, 22.0, axis='x', seg=8,
                           color=RUST * 1.05)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
    # брызговики-обтекатели вокруг шарниров лап
    for (lx, lz) in LEGS:
        pb.box((lx, Y_KEEL + 0.45, lz), (6.4, 1.9, 6.4), STEEL_M * 1.2)
        pb.box((lx, Y_KEEL + 1.5, lz + (1.0 if lz > 0 else -1.0) * 2.6),
               (5.6, 1.1, 1.6), ORANGE_D * 0.95)
    return pb


# ---------------------------------------------------------------- бур
DRILLS = [(-9.6, 7.7, 4.15), (0.0, 8.2, 4.55), (9.6, 7.7, 4.15)]   # (z, y, r)


def drill_mount():
    """Тёмный силовой блок, куда заходят барабаны, и armour-щёки по краям."""
    pb = PB()
    pb.box((-11.0, 10.6, 0.0), (7.4, 7.2, 26.6), STEEL_M)                 # плита
    for zz in (-13.2, -5.4, 5.4, 13.2):                                   # секции фасада
        pb.box((-14.9, 10.4, zz), (1.6, 6.0, 5.2), STEEL * 1.5)
        pb.box((-14.4, 8.2, zz), (1.0, 1.2, 4.0), STEEL_L * 0.8)
    for yy in (7.4, 13.4):
        pb.box((-14.6, yy, 0.0), (1.2, 1.0, 25.0), STEEL_L * 0.7)
    for (cz, cy, r) in DRILLS:                                            # гнёзда
        pb.box((-9.0, cy, cz), (5.0, r * 2.05, r * 1.5), STEEL * 1.35)
        # кожух-козырёк над барабаном (не вращается вместе с ним)
        pb.box((-14.5, cy + r * 0.92, cz), (9.0, 1.5, r * 1.9), ORANGE * 0.94)
        pb.box((-11.0, cy + r * 1.15, cz), (4.0, 1.2, r * 1.7), ORANGE_D)
        v, t, c = cylinder(-16.0, cy + r * 0.75, cz, 0.52, 5.2, axis='z', seg=8,
                           color=STEEL_M)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
    for zs in (-1, 1):                                                    # щёки
        pb.box((-13.6, 9.2, zs * 14.6), (5.6, 7.4, 3.0), ORANGE_D)
        pb.box((-15.6, 11.4, zs * 15.2), (2.2, 4.0, 2.4), ORANGE * 0.92)
        pb.box((-14.4, 5.9, zs * 12.4), (4.4, 1.8, 3.0), STEEL_M)
    # нижняя стяжка и гидравлика блока
    pb.box((-11.0, 6.2, 0.0), (6.0, 1.4, 22.0), STEEL)
    for zs in (-1, 1):
        pb.seg((-14.0, 7.4, zs * 10.4), (-8.0, 6.6, zs * 6.0), 1.0, 1.0, STEEL_L * 0.9)
    return pb


def drills():
    """Три барабана cruncher-muncher. Геометрия вокруг оси блока по X."""
    pb = PB()
    for (cz, cy, r) in DRILLS:
        # кожух-статор, примыкающий к блоку
        v, t, c = cylinder(DRUM_BACK - 2.2, cy, cz, r * 1.10, 4.6, axis='x', seg=16,
                           color=ORANGE * 0.95)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
        # барабан с зубцами
        v, t, c = cylinder(DRUM_NOSE + 8.0, cy, cz, r, 12.4, axis='x', seg=20,
                           color=STEEL_L * 1.05, teeth=1)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
        # три бандажа-коронки
        for k, off in enumerate((-3.6, 0.0, 3.6)):
            v, t, c = cylinder(DRUM_NOSE + 8.0 + off, cy, cz, r * 1.09, 1.15, axis='x',
                               seg=20, color=(RUST * 1.15 if k == 1 else STEEL_L * 0.85))
            pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
            pb.T.extend((t + len(pb.V) - len(v)).tolist())
        # круглая ступица с резцами
        v, t, c = cylinder(DRUM_NOSE + 0.5, cy, cz, r * 0.60, 1.6, axis='x', seg=16,
                           color=STEEL_L * 0.85)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
        v, t, c = cylinder(DRUM_NOSE - 0.15, cy, cz, r * 0.34, 0.9, axis='x', seg=12,
                           color=RUST * 1.3)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
        for k in range(9):
            a = 2 * math.pi * k / 9 + 0.2
            pb.box((DRUM_NOSE + 0.15, cy + math.cos(a) * r * 0.78,
                    cz + math.sin(a) * r * 0.78), (1.5, 1.1, 1.1), STEEL * 1.5)
        # спицы-грунтозацепы по окружности
        for k in range(10):
            a = 2 * math.pi * k / 10 + 0.3
            rr = r * 1.02
            pb.box((DRUM_NOSE + 8.0 + (k % 3 - 1) * 3.6, cy + math.cos(a) * rr,
                    cz + math.sin(a) * rr), (1.0, 1.5, 1.5), STEEL * 1.45)
    # начало координат узла — на оси барабанов, чтобы вращение шло на месте
    pb.V = [[vx - DRUM_AXIS, vy, vz] for (vx, vy, vz) in pb.V]
    return pb


# ---------------------------------------------------------------- двигатели
ENGINES = [(-5.2, 13.6, 3.65), (5.2, 13.6, 3.65), (-13.6, 13.6, 3.65), (13.6, 13.6, 3.65),
           (-9.8, 8.6, 3.15), (9.8, 8.6, 3.15)]           # (z, y, r) — 4 + 2


def _ring(cy, cz, r, seg):
    return [(cy + r * math.cos(2 * math.pi * i / seg),
             cz + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]


def engines():
    pb = PB()
    # силовая плита кормы
    pb.box((TAIL - 1.6, 13.0, 0.0), (3.2, 11.0, 35.0), STEEL)
    for (cz, cy, r) in ENGINES:
        # раструб дюзы (конус), внутри тёмный, на срезе — кольцо
        A = _ring(cy, cz, r * 0.62, 18)
        B = _ring(cy, cz, r, 18)
        for i in range(18):
            j = (i + 1) % 18
            pb.face((ENG_X0, A[i][0], A[i][1]), (ENG_X1, B[i][0], B[i][1]),
                    (ENG_X1, B[j][0], B[j][1]), (ENG_X0, A[j][0], A[j][1]), STEEL_M * 0.95)
        # обечайка снаружи
        Cc = _ring(cy, cz, r * 1.16, 18)
        for i in range(18):
            j = (i + 1) % 18
            pb.face((ENG_X0 + 0.4, B[i][0], B[i][1]), (ENG_X0 + 0.4, Cc[i][0], Cc[i][1]),
                    (ENG_X1 - 0.5, Cc[j][0], Cc[j][1]), (ENG_X1 - 0.5, B[j][0], B[j][1]),
                    STEEL * 1.25)
            pb.face((ENG_X1 - 0.5, Cc[i][0], Cc[i][1]), (ENG_X1 - 0.5, Cc[j][0], Cc[j][1]),
                    (ENG_X1, B[j][0], B[j][1]), (ENG_X1, B[i][0], B[i][1]), STEEL_L * 0.9)
        # задняя монтажная плита дюзы
        pb.box((ENG_X0 + 0.2, cy, cz), (0.8, r * 2.3, r * 2.3), STEEL * 1.15)
        # кольца крепления
        for xx in (ENG_X0 + 1.0, ENG_X0 + 3.0):
            v, t, c = cylinder(xx, cy, cz, r * 1.06, 0.6, axis='x', seg=18,
                               color=STEEL_L * 0.8)
            pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
            pb.T.extend((t + len(pb.V) - len(v)).tolist())
    # решётчатые выхлопы на палубе кормы — 2 блока 3×3
    for cz in (-5.4, 5.4):
        pb.box((17.4, topY(17.4) + 0.22, cz), (4.6, 0.55, 6.0), STEEL_M * 1.1)
        for i in range(3):
            pb.box((17.4, topY(17.4) + 0.42, cz + (i - 1) * 1.9), (3.8, 0.35, 1.1),
                   STEEL * 0.8)
        pb.box((17.4, topY(17.4) + 0.30, cz), (4.2, 0.35, 5.4), STEEL * 0.95)
    # кормовые бленкеры-радиаторы
    for zs in (-1, 1):
        pb.box((TAIL + 0.35, 16.4, zs * 8.0), (0.7, 3.0, 6.4), STEEL_M * 1.2)
        for k in range(4):
            pb.box((TAIL + 0.6, 15.4 + k * 0.85, zs * 8.0), (0.4, 0.3, 6.0), STEEL * 1.4)
    return pb


def thrusters():
    """Диски тяги на срезах дюз — отдельный узел, зажигается в полёте."""
    pb = PB()
    for (cz, cy, r) in ENGINES:
        A = _ring(cy, cz, r * 0.60, 18)
        for i in range(18):
            j = (i + 1) % 18
            pb.tri((ENG_X1 - 0.45, cy, cz), (ENG_X1 - 0.45, A[j][0], A[j][1]),
                   (ENG_X1 - 0.45, A[i][0], A[i][1]), GLOW_V * 0.95)
        pb.tri((ENG_X1 - 0.45, cy, cz), (ENG_X1 - 0.45, cy + r * 0.34, cz),
               (ENG_X1 - 0.45, cy, cz + r * 0.34), GLOW_W * 0.9)
    return pb


# ---------------------------------------------------------------- лапы
LEGS = [(-4.2, -15.0), (-4.2, 15.0), (3.6, -16.6), (3.6, 16.6),
        (15.5, -16.2), (15.5, 16.2)]                 # (x, z) шарнир бедра
FOLD_DEG = 96.0
HIP_Y = Y_KEEL               # 7.2
FOOT_DROP = HIP_Y            # ступня ровно на Y=0


def leg(idx):
    """Лапа в координатах шарнира (0,0,0), ступня на y = -HIP_Y."""
    x, z = LEGS[idx]
    zs = 1.0 if z > 0 else -1.0
    pb = PB()
    # бедренный узел в нише рамы
    pb.box((0, -0.8, 0), (4.6, 2.2, 4.6), STEEL_M * 1.1)
    pb.box((0, -0.2, zs * 2.3), (2.6, 1.6, 1.4), STEEL_L * 0.8)
    pb.box((0, -1.9, 0), (3.4, 1.0, 3.4), STEEL)
    # верхняя стойка → колено (наружу и вниз)
    pb.seg((0, -2.2, 0), (0, -3.3, zs * 2.1), 5.0, 5.0, STEEL_M)
    pb.seg((0, -2.1, zs * 2.4), (0, -3.4, zs * 4.4), 2.6, 3.6, ORANGE_D * 1.05,
           ref=(1, 0, 0))
    # колено: шарнирный узел с осью
    pb.box((0, -3.5, zs * 2.4), (5.6, 2.8, 5.6), STEEL)
    for k in (-1, 1):
        v, t, c = cylinder(0, -3.5, zs * 2.2, 1.05, 5.2, axis='x', seg=10,
                           color=STEEL_L * 0.85)
        pb.V.extend(v.tolist()); pb.C.extend(c.tolist())
        pb.T.extend((t + len(pb.V) - len(v)).tolist())
        break
    # нижняя стойка → голеностоп
    pb.seg((0, -4.6, zs * 2.7), (0, -6.0, zs * 3.5), 4.4, 4.6, STEEL_M * 1.05)
    # бронещиток голени
    pb.seg((0, -4.3, zs * 4.9), (0, -6.2, zs * 5.4), 2.2, 4.2, ORANGE_D * 0.95,
           ref=(1, 0, 0))
    pb.seg((0, -4.4, zs * 0.5), (0, -6.0, zs * 1.2), 1.8, 3.4, STEEL_L * 0.62,
           ref=(1, 0, 0))
    pb.seg((0, -4.4, zs * 0.6), (0, -5.8, zs * 1.0), 1.4, 2.4, STEEL_L * 0.7,
           ref=(1, 0, 0))
    # гидравлика
    pb.seg((1.6, -1.9, -zs * 1.2), (1.6, -5.6, zs * 2.2), 1.0, 1.0, STEEL_L)
    pb.seg((-1.6, -1.9, -zs * 1.2), (-1.6, -5.6, zs * 2.2), 1.0, 1.0, STEEL_L * 0.7)
    # голеностоп и ступня
    pb.box((0, -6.25, zs * 3.5), (3.8, 1.3, 3.8), STEEL)
    pb.box((0, -6.62, zs * 3.8), (5.6, 1.0, 6.0), RUST * 1.05)
    pb.box((0, -6.3, zs * 6.4), (5.2, 1.0, 1.6), RUST * 0.9)
    pb.box((0, -6.78, zs * 3.8), (5.6, 0.5, 5.0), STEEL_M * 1.2)
    # зубья-грунтозацепы
    for k in (-1, 0, 1):
        pb.box((0, -6.98, zs * 3.8 + k * 1.7), (5.2, 0.44, 1.0), STEEL * 1.35)
    for k in (-1, 1):
        pb.box((k * 2.2, -6.98, zs * 3.8), (1.0, 0.44, 5.2), STEEL * 1.2)
    return pb


# ---------------------------------------------------------------- огни
def lights():
    pb = PB()
    # посадочные прожекторы под бровью (пары)
    for zs in (-1, 1):
        for zz in (4.2, 9.6):
            pb.box((-15.6, 13.0, zs * zz), (2.2, 1.4, 2.2), STEEL_M)
            pb.face((-16.75, 12.3, zs * zz - 0.9), (-16.75, 12.3, zs * zz + 0.9),
                    (-16.75, 13.7, zs * zz + 0.9), (-16.75, 13.7, zs * zz - 0.9),
                    BLUE * 1.25)
    # маркеры на бортах пода
    for zs in (-1, 1):
        for x in (6.0, 15.0):
            pb.face((x - 0.7, 12.6, zs * 24.22), (x + 0.7, 12.6, zs * 24.22),
                    (x + 0.7, 13.6, zs * 24.22), (x - 0.7, 13.6, zs * 24.22),
                    RED if zs < 0 else BLUE * 1.2)
    # огни на скулах кормы
    for zs in (-1, 1):
        pb.box((TAIL - 0.4, 17.6, zs * 12.0), (1.2, 0.9, 1.2), STEEL)
        pb.face((TAIL + 0.25, 17.2, zs * 11.5), (TAIL + 0.25, 17.2, zs * 12.5),
                (TAIL + 0.25, 18.0, zs * 12.5), (TAIL + 0.25, 18.0, zs * 11.5), RED)
    # подсветка бурового блока
    for zs in (-1, 1):
        pb.box((-9.6, 13.4, zs * 12.2), (1.6, 0.9, 1.6), STEEL_M)
        pb.face((-9.6, 12.95, zs * 11.6), (-9.6, 12.95, zs * 12.8),
                (-10.5, 13.0, zs * 12.8), (-10.5, 13.0, zs * 11.6), GLOW_W * 0.8)
    return pb


# ---------------------------------------------------------------- сборка
def rotate_x_bounds(b, deg, pos):
    """AABB части после поворота вокруг локальной оси X (для складки лап)."""
    v = np.array([[b[0], b[2], b[4]], [b[1], b[3], b[5]],
                  [b[0], b[3], b[4]], [b[1], b[2], b[5]]], np.float64)
    a = np.deg2rad(deg)
    R = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])
    p = v @ R.T + np.array(pos)
    return (p[:, 0].min(), p[:, 0].max(), p[:, 1].min(), p[:, 1].max(),
            p[:, 2].min(), p[:, 2].max())


def main():
    b = GlbBuilder()
    m_body = b.material('imp_body', metallic=0.20, roughness=0.72)
    m_armor = b.material('imp_armor', metallic=0.30, roughness=0.62)
    m_steel = b.material('imp_steel', metallic=0.55, roughness=0.48)
    m_glow = b.material('imp_glow', metallic=0.0, roughness=0.35,
                        emissive=None) if False else b.material('imp_glow', 0.0, 0.35)

    stats = {}
    tris = 0

    def add(name, pb, mat, pos=None, kind=None):
        nonlocal tris
        v, t, c = pb.get()
        idx = b.mesh(name, v, t, c, mat)
        b.node(name, idx, translation=pos)
        stats[name] = (len(v), len(t))
        tris += len(t)
        if kind:
            check(pb.bounds(), kind, off=pos or (0, 0, 0))

    add('hull', hull(), m_body, kind='hull')
    add('shell', shell(), m_armor, kind='hull')
    add('armor', armor(), m_armor, kind='hull')
    add('machinery', machinery(), m_steel, kind='hull')
    add('drill_mount', drill_mount(), m_steel, kind='hull')
    add('drills', drills(), m_steel, pos=[DRUM_AXIS, 0.0, 0.0])
    add('engines', engines(), m_steel, kind='hull')
    add('thrusters', thrusters(), m_glow)
    add('lights', lights(), m_glow)
    for i, (x, z) in enumerate(LEGS):
        add('leg_%d' % i, leg(i), m_steel, pos=[x, HIP_Y, z])
    # проверки бурового блока и лап по их мировому положению
    for (cz, cy, r) in DRILLS:
        rr = r * 1.16
        check((DRUM_NOSE - 0.9, DRUM_BACK + 0.1, cy - rr, cy + rr,
               cz - rr, cz + rr), 'drum')
    for i, (x, z) in enumerate(LEGS):
        lb = leg(i).bounds()
        sign = 1.0 if z > 0 else -1.0
        check(rotate_x_bounds(lb, FOLD_DEG * sign, (x, HIP_Y, z)), 'fold%d' % i)
        check((lb[0] + x, lb[1] + x, lb[2] + HIP_Y, lb[3] + HIP_Y,
               lb[4] + z, lb[5] + z), 'leg%d' % i)

    data = b.build('imp_tap')
    open(os.path.join(P, 'imp_tap.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-13s verts %5d tris %5d' % (k, nv, nt))

    modes = {
        'landed':  {'legs': 0.0, 'drills': 0.0, 'thrust': 0.0},
        'mining':  {'legs': 0.0, 'drills': 2.6, 'thrust': 0.0},
        'flight':  {'legs': 1.0, 'drills': 0.55, 'thrust': 1.0},
        'transit': {'legs': 1.0, 'drills': 0.0, 'thrust': 0.5},
    }
    json.dump({'legs': len(LEGS),
               'hip_y': HIP_Y,
               'hip_z': [z for (_, z) in LEGS],
               'hip_fold_deg': FOLD_DEG,
               'foot_drop': FOOT_DROP,
               'modes': modes,
               'dims': {'L': L, 'W': W, 'H': H}},
              open(os.path.join(P, 'modes.json'), 'w'), indent=1)
    print('modes.json')

    # ---- габариты и пересечения крупных деталей ----
    landed = [c for c in CHECK if not c[6].startswith('fold')]
    xmin = min(c[0] for c in CHECK); xmax = max(c[1] for c in CHECK)
    ymin = min(c[2] for c in landed); ymax = max(c[3] for c in CHECK)
    zmin = min(c[4] for c in CHECK); zmax = max(c[5] for c in CHECK)
    print('габарит: %.1f x %.1f x %.1f м' % (xmax - xmin, ymax - ymin, zmax - zmin))
    tol = 0.05
    out = []
    if xmin < -HX - tol or xmax > HX + tol:
        out.append('длина')
    if zmin < -HZ - tol or zmax > HZ + tol:
        out.append('ширина')
    if ymin < -tol or ymax > H + tol:
        out.append('высота')
    if out:
        print('  !!! выход за габарит %s: x[%.2f..%.2f] y[%.2f..%.2f] z[%.2f..%.2f]'
              % (','.join(out), xmin, xmax, ymin, ymax, zmin, zmax))
        raise SystemExit('envelope broken')
    print('  L %.1f / %.1f   W %.1f / %.1f   H %.1f / %.1f  — в габарите'
          % (xmax - xmin, L, zmax - zmin, W, ymax - ymin, H))

    bad = 0
    n = len(CHECK)
    for i in range(n):
        ax0, ax1, ay0, ay1, az0, az1, ak = CHECK[i]
        for j in range(i + 1, n):
            bx0, bx1, by0, by1, bz0, bz1, bk = CHECK[j]
            if 'hull' in (ak, bk) or ak == bk:
                continue
            if ak.replace('fold', '').replace('leg', '') == \
                    bk.replace('fold', '').replace('leg', ''):
                continue
            ox = min(ax1, bx1) - max(ax0, bx0)
            oy = min(ay1, by1) - max(ay0, by0)
            oz = min(az1, bz1) - max(az0, bz0)
            if ox > 0.05 and oy > 0.05 and oz > 0.05:
                bad += 1
                if bad <= 6:
                    print('  ПЕРЕСЕЧЕНИЕ %s/%s: %.2f x %.2f x %.2f' % (ak, bk, ox, oy, oz))
    print('проверка: деталей %d, пересечений %d' % (n, bad))
    if bad:
        raise SystemExit('overlapping parts')
    print('geometry: OK')


if __name__ == '__main__':
    main()
