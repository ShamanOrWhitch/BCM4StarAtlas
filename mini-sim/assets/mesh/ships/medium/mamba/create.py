#!/usr/bin/env python3
"""Fimbul Mamba — средний охотник за головами (Star Atlas, FBLMAM, Uncommon).
38 × 18 × 9 м, экипаж 5 (пилот, штурман, 2 оператора вооружения, офицер
безопасности). Слоты: 4 medium fixed hardpoint, 2 small турели, missile bay,
3 блока контрмер, Drone Port, Tractor Beam, Scanner; модули Fuel, 2×Ammo, Cargo.

Собственная интерпретация по карточке, 27 кадрам галереи и чертежу
(top view / side view с подписями) — без копирования геометрии:

  * «клыкастая» катамаранная компоновка: два длинных орудийных корпуса-клыка
    по бортам, в носовых срезах — счетверённые блоки стволов (2×2);
  * между клыками — компактный центральный корпус с кабиной и стеклянным
    бригом: длинный остеклённый блок удержания с частыми нервюрами и
    холодной подсветкой интерьера;
  * корма — тяжёлый блок двигателей с двумя соплами, прямоугольными
    радиаторами и оливковыми коробами (по кадрам сзади);
  * верх — четыре рельсовые пушки fixed hardpoint, малая турель, ракетный
    отсек, антенны и сканеры; по бортам — модульные орудия и блоки контрмер;
  * шасси — шесть коротких стоек, машина сидит низко (9 м);
  * ливрея: выцветший белый металл с грязью и потёками, бронзовые и оливковые
    акценты, винно-красные полосы, холодная циановая подсветка брига.
"""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, cylinder

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261213)

# ---------------------------------------------------------------- габарит
L, W, H = 38.0, 18.0, 9.0
HX, HZ = L / 2, W / 2                 # 19.0 / 9.0
NOSE, TAIL = -17.4, 17.6              # корпуса; стволы и сопла идут дальше

# ---------------------------------------------------------------- цвета
WHITE = np.array([0.780, 0.775, 0.760])
WHITE_D = np.array([0.610, 0.600, 0.580])
SILVER = np.array([0.560, 0.560, 0.560])
SILVER_D = np.array([0.370, 0.372, 0.378])
GREY = np.array([0.255, 0.255, 0.262])
DARK = np.array([0.078, 0.080, 0.086])
DARK_M = np.array([0.140, 0.142, 0.150])
OLIVE = np.array([0.235, 0.265, 0.180])
OLIVE_L = np.array([0.330, 0.360, 0.250])
BRONZE = np.array([0.300, 0.215, 0.140])
BRONZE_L = np.array([0.440, 0.330, 0.215])
RUST = np.array([0.260, 0.150, 0.100])
RED = np.array([0.420, 0.090, 0.100])
RED_L = np.array([0.600, 0.150, 0.150])
GLASS = np.array([0.060, 0.090, 0.110])
GLASS_L = np.array([0.150, 0.240, 0.290])
CYAN = np.array([0.35, 0.92, 1.00])
CYAN_D = np.array([0.16, 0.46, 0.56])
AMBER = np.array([1.000, 0.600, 0.180])
ORANGE = np.array([1.000, 0.380, 0.100])
NAVGREEN = np.array([0.300, 1.000, 0.450])

LIGHT = np.array([0.44, 0.78, 0.44])
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
        # центр сечения — по y И по z: у клыков ось вынесена на ±6.25 м, и
        # старая ссылка «в z = 0» разворачивала грани правого и левого клыка
        # в ПРОТИВОПОЛОЖНЫЕ стороны (правый борт живой, левый просвечивал).
        cyA, czA = np.mean([p[0] for p in A]), np.mean([p[1] for p in A])
        cyB, czB = np.mean([p[0] for p in B]), np.mean([p[1] for p in B])
        for k in range(n):
            k2 = (k + 1) % n
            p0 = (x0, A[k][0], A[k][1])
            p1 = (x1, B[k][0], B[k][1])
            p2 = (x1, B[k2][0], B[k2][1])
            p3 = (x0, A[k2][0], A[k2][1])
            nrm = np.cross(np.subtract(p1, p0), np.subtract(p2, p0))
            mid = np.mean(np.array([p0, p1, p2, p3]), axis=0)
            ref = mid - np.array([(x0 + x1) / 2, (cyA + cyB) / 2, (czA + czB) / 2])
            flip = float(nrm @ ref) < 0
            # pb.tri у зеркальной детали сам разворачивает обход, поэтому
            # требуемую ориентацию инвертируем заранее — иначе двойной разворот
            if pb.m < 0:
                flip = not flip
            if flip:
                p1, p3 = p3, p1
            pb.face(p0, p1, p2, p3, col_fn(i, k))
    if cap:
        for idx, x in ((0, xs[0]), (-1, xs[-1])):
            S = secs[idx]
            cy = np.mean([p[0] for p in S])
            cz = np.mean([p[1] for p in S])
            order = list(range(n))
            if idx == -1:
                order = order[::-1]        # задний торец смотрит наружу в +X
            col = cap_col if cap_col is not None else col_fn(0, 0) * 0.9
            for k in range(n):
                k2 = (k + 1) % n
                pb.tri((x, cy, cz), (x, S[order[k]][0], S[order[k]][1]),
                       (x, S[order[k2]][0], S[order[k2]][1]), col)


def dome(pb, stations, base_fn, half_fn, height, glass_col, frame_col, sink=0.04):
    """Остекление: основание лежит НА обшивке (sink — утоплено в неё), свод
    поднимается вверх. Ни одна вершина не висит в воздухе — см. glass_check()."""
    def sec(x):
        y0 = base_fn(x) - sink
        w = half_fn(x)
        h = height(x) if callable(height) else height
        return [(y0, -w), (y0 + 0.46 * h, -0.68 * w), (y0 + h, 0.0),
                (y0 + 0.46 * h, 0.68 * w), (y0, w)]
    loft(pb, stations, sec, lambda i, k: glass_col * (0.96 if k != 4 else 0.90))
    for x in stations:
        st = sec(x)
        pts = [(x, p[0], p[1]) for p in st]
        for a, b in zip(pts[:-1], pts[1:]):
            pb.seg(a, b, 0.09, 0.09, frame_col, ref=(1, 0, 0))
        for k in (0, 4):
            pb.box((x, st[k][0] + 0.05, st[k][1] * 0.94), (0.24, 0.16, 0.22), frame_col)
    for sgn in (-1, 1):
        for k in range(len(stations) - 1):
            x0, x1 = stations[k], stations[k + 1]
            st0, st1 = sec(x0), sec(x1)
            w0, w1 = abs(st0[0][1]), abs(st1[0][1])
            y0, y1 = st0[0][0], st1[0][0]
            pb.face((x0, y0, sgn * (w0 - 0.18)), (x1, y1, sgn * (w1 - 0.18)),
                    (x1, y1 + 0.14, sgn * w1), (x0, y0 + 0.14, sgn * w0), frame_col)


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
        F = (lambda *q: pb.face(*q[::-1], col_out)) if pb.m < 0 else \
            (lambda *q: pb.face(*q, col_out))
        G = (lambda *q: pb.face(*q[::-1], col_in)) if pb.m < 0 else \
            (lambda *q: pb.face(*q, col_in))
        H = (lambda *q: pb.face(*q[::-1], col_in * 1.25)) if pb.m < 0 else \
            (lambda *q: pb.face(*q, col_in * 1.25))
        K = (lambda *q: pb.face(*q[::-1], col_in * 0.8)) if pb.m < 0 else \
            (lambda *q: pb.face(*q, col_in * 0.8))
        F(o0, o1, o2, o3)
        G(i1, i0, i3, i2)
        H(o3, o2, i2, i3)
        K(o1, o0, i0, i1)


# ---------------------------------------------------------------- профили
# клык (орудийный корпус): длина вдоль X, круглое сечение в плане
POD_X = [-17.4, -14.0, -10.0, -5.0, 1.0, 7.0, 12.0, 15.6]
POD_YB = [3.05, 2.75, 2.60, 2.55, 2.55, 2.62, 2.85, 3.25]
POD_YT = [5.25, 6.15, 6.90, 7.20, 7.25, 7.15, 6.80, 6.05]
POD_R = [1.51, 2.02, 2.23, 2.30, 2.30, 2.23, 2.04, 1.77]   # ×0.85: обычная
# Mamba — с узкими крыльями-лезвиями; широкие «лопухи» остаются у EX
POD_Z = 6.66                                   # ось клыка по Z (размах 17.9)


def pod_sec(x, sgn):
    """Сечение клыка: скруглённый корпус (8 граней) вокруг оси z = sgn*POD_Z."""
    yb = float(np.interp(x, POD_X, POD_YB))
    yt = float(np.interp(x, POD_X, POD_YT))
    r = float(np.interp(x, POD_X, POD_R))
    cy, cz = (yb + yt) / 2, sgn * POD_Z
    ry, rz = (yt - yb) / 2, r
    pts = []
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        pts.append((cy + math.cos(a) * ry, cz + math.sin(a) * rz))
    return pts


# центральный корпус
CX = [-17.0, -14.0, -10.0, -6.0, -2.0, 3.0, 8.0, 12.0, 15.6]
CW = [1.65, 2.70, 3.28, 3.58, 3.68, 3.64, 3.48, 3.18, 2.40]
CYB = [3.55, 3.25, 3.05, 2.98, 2.96, 3.02, 3.12, 3.32, 3.60]
CYT = [5.30, 6.10, 6.70, 7.02, 7.14, 7.12, 7.00, 6.80, 6.20]


def cw(x):
    return float(np.interp(x, CX, CW))


def cyb(x):
    return float(np.interp(x, CX, CYB))


def cyt(x):
    return float(np.interp(x, CX, CYT))


def center_sec(x):
    w, yb, yt = cw(x), cyb(x), cyt(x)
    h = yt - yb
    return [(yb, -0.62 * w), (yb + 0.26 * h, -1.00 * w), (yb + 0.66 * h, -0.92 * w),
            (yt, -0.52 * w), (yt, 0.52 * w), (yb + 0.66 * h, 0.92 * w),
            (yb + 0.26 * h, 1.00 * w), (yb, 0.62 * w)]


def hull_palette(i, k):
    """Выцветший белый металл с бронзовыми и тёмными поясами."""
    if k in (0, 7):
        return WHITE_D * 0.95
    if k in (1, 6):
        return BRONZE_L if i % 3 == 0 else WHITE_D
    if k in (2, 5):
        return WHITE if i % 2 else WHITE_D
    return WHITE * 1.02


# ---------------------------------------------------------------- корпуса
def pod(sgn):
    """Орудийный клык: корпус, панели, грязь, накладки, боковые модули."""
    pb = PB()
    pb.m = sgn
    z0 = sgn * POD_Z
    def sec(x):
        # координаты строим сразу для своего борта: флаг pb.m меняет только
        # обход треугольника (нормали/затенение), не координаты
        return pod_sec(x, sgn)
    loft(pb, POD_X, sec, lambda i, k: (WHITE if k in (1, 2, 5, 6) else
                                       (WHITE_D if k in (0, 7) else SILVER)),
         cap_col=WHITE_D)
    # продольный тёмный шов по верху клыка и по борту: панелировка читается
    # и в CPU, и в шейдерном режиме, где блики «съедали» разницу оттенков
    for sgn2 in (1, -1):
        for x0 in np.arange(-16.2, 14.4, 2.2):
            r0 = float(np.interp(x0, POD_X, POD_R))
            yb0 = float(np.interp(x0, POD_X, POD_YB))
            yt0 = float(np.interp(x0, POD_X, POD_YT))
            pb.box((x0 + 1.1, (yb0 + yt0) / 2 + (yt0 - yb0) / 2 * sgn2 * 0.86,
                    z0 + math.copysign(r0 * 0.42, z0)),
                   (2.12, 0.08, r0 * 0.86), WHITE_D * 0.82)
    # панельные швы, люки и грязевые потёки по внешнему борту
    for x in np.arange(-15.0, 14.0, 2.6):
        r = float(np.interp(x, POD_X, POD_R))
        yb = float(np.interp(x, POD_X, POD_YB))
        yt = float(np.interp(x, POD_X, POD_YT))
        yc = (yb + yt) / 2
        pb.box((x, yc + 0.62, z0 + sgn * (r - 0.06)), (1.7, 0.9, 0.16), WHITE_D)
        pb.box((x + 0.15, yc + 0.05, z0 + sgn * (r - 0.04)), (1.5, 1.2, 0.14), WHITE * 0.94)
        pb.box((x, yc - 0.62, z0 + sgn * (r - 0.02)), (1.2, 0.34, 0.14), RUST * 0.85)
        # грязевые потёки и потёртости
        for k in range(3):
            pb.box((x - 0.5 + k * 0.55, yc + 0.20 - k * 0.42, z0 + sgn * (r - 0.10)),
                   (0.28, 0.22 + 0.16 * k, 0.08), RUST * (0.6 + 0.15 * k))
        # накладная бронеплита и её крепёж
        pb.box((x + 0.5, yc + 0.10, z0 + sgn * (r - 0.16)), (2.0, 1.5, 0.24), WHITE)
        pb.box((x + 0.5, yc + 0.10, z0 + sgn * (r - 0.30)), (1.6, 1.1, 0.18), WHITE * 0.97)
        for dz in (-0.55, 0.55):
            pb.box((x + 0.5, yc + 0.70 + dz * 0.4, z0 + sgn * (r - 0.36)), (1.7, 0.10, 0.10), DARK_M)
        pb.box((x + 0.4, yb + 0.14, z0 + sgn * (r * 0.55)), (2.2, 0.22, 0.9), DARK_M)
    # обручи-шпангоуты: клык читается как круглая труба
    def band(xc, wdt, sc, col):
        def sec(x):
            yb = float(np.interp(x, POD_X, POD_YB))
            yt = float(np.interp(x, POD_X, POD_YT))
            r = float(np.interp(x, POD_X, POD_R))
            cy, ry = (yb + yt) / 2, (yt - yb) / 2
            out = []
            for k in range(8):
                a = 2 * math.pi * (k + 0.5) / 8
                out.append((cy + math.cos(a) * ry * sc, z0 + math.sin(a) * r * sc))
            return out
        loft(pb, [xc - wdt / 2, xc + wdt / 2], sec, lambda i, k: col, cap=False)

    for xc in (-16.55, -14.6, -9.8, -4.8, 0.4, 5.6, 10.6, 14.4):
        band(xc - 0.22, 0.16, 1.002, DARK_M * 0.55)
        band(xc, 0.40, 1.026, WHITE_D)
        band(xc + 0.24, 0.14, 1.004, DARK_M * 0.5)

    # тёмный пояс по низу борта
    for x0 in np.arange(-16.0, 14.5, 3.0):
        yb = float(np.interp(x0, POD_X, POD_YB))
        rb = float(np.interp(x0, POD_X, POD_R))
        pb.box((x0, yb + 0.30, z0 + sgn * rb * 0.62), (3.0, 0.55, 1.0), GREY * 0.9)

    # винная полоса и номер-блок вдоль клыка
    pb.box((-4.0, 5.05, z0 + sgn * 1.45), (16.0, 0.34, 0.22), RED)
    pb.box((-4.0, 4.77, z0 + sgn * 1.42), (12.0, 0.14, 0.18), BRONZE)
    for k in range(4):
        pb.box((-9.0 + k * 1.1, 4.72, z0 + sgn * (float(np.interp(-9.0, POD_X, POD_R)) - 0.02)),
               (0.5, 0.5, 0.06), WHITE * 0.95)
    # верхние накладки-броня и короткие решётки
    for x in (-12.0, -3.0, 6.0):
        yt = float(np.interp(x, POD_X, POD_YT))
        rr = float(np.interp(x, POD_X, POD_R))
        pb.box((x, yt - 0.05, z0), (2.8, 0.26, 1.5 * rr), WHITE * 0.99)
        for k in range(2):
            pb.box((x, yt + 0.10, z0 + (k - 0.5) * 0.86), (2.2, 0.08, 0.22), GREY)
        pb.box((x + 1.2, yt - 0.02, z0 + sgn * 0.8), (0.7, 0.16, 0.7), SILVER_D)
        pb.box((x - 1.1, yt - 0.02, z0 - sgn * 0.8), (0.7, 0.16, 0.7), AMBER * 0.55)
    return pb


def gun_cluster(sgn):
    """Дульный блок в носовом срезе клыка: тяжёлая эллиптическая маска с двумя
    глубокими каналами, потёртым бронзовым ободом и болтами — как на
    маркет-рендере морды (два боре на клык, всего 4 fixed hardpoint).
    Локальный ноль — плоскость носового среза клыка."""
    pb = PB()
    pb.m = sgn
    xs = [-1.38, -0.95, -0.45, 0.30]
    RY = [0.84, 0.98, 1.05, 1.00]
    RZ = [1.28, 1.50, 1.62, 1.56]

    def sec(x):
        ry = float(np.interp(x, xs, RY))
        rz = float(np.interp(x, xs, RZ))
        pts = []
        for k in range(12):
            a = 2 * math.pi * (k + 0.5) / 12
            pts.append((math.sin(a) * ry, math.cos(a) * rz))
        return pts

    loft(pb, xs, sec, lambda i, k: (WHITE if k in (2, 3, 8, 9) else
                                    (WHITE_D if k in (0, 1, 10, 11) else SILVER)),
         cap_col=BRONZE_L * 0.90)
    # обод маски: бронзовое кольцо и стяжные болты по кругу
    ring(pb, -1.30, 0.0, 0.0, 1.34, 1.02, 0.30, 12, BRONZE_L, SILVER_D, axis='x')
    for k in range(12):
        a = 2 * math.pi * (k + 0.5) / 12
        pb.box((-1.26, math.sin(a) * 1.08, math.cos(a) * 1.52),
               (0.20, 0.16, 0.16), SILVER)
    # два глубоких канала: чёрный зев с тонкими рёбрами, обод тёмный
    for dz in (-0.62, 0.62):
        pb.cyl(-1.34, 0.0, dz, 0.52, 0.10, axis='x', seg=12, color=SILVER_D)
        ring(pb, -1.33, 0.0, dz, 0.56, 0.46, 0.12, 12, BRONZE_L * 0.85, DARK, axis='x')
        pb.cyl(-1.05, 0.0, dz, 0.44, 0.60, axis='x', seg=12, color=DARK)
        pb.cyl(-0.55, 0.0, dz, 0.40, 0.24, axis='x', seg=12, color=DARK)
        for k in range(3):
            pb.cyl(-0.72 - k * 0.20, 0.0, dz, 0.41, 0.05, axis='x', seg=12, color=GREY * 0.8)
    # накладка-«костяшка» сверху и бронеплиты по бортам маски
    pb.box((-0.30, 0.86, 0.0), (1.5, 0.34, 1.20), WHITE_D)
    pb.box((-0.55, 1.04, 0.0), (0.9, 0.12, 0.86), SILVER)
    for dz in (-1.26, 1.26):
        pb.box((0.10, 0.10, dz), (1.5, 1.30, 0.30), SILVER_D)
        pb.box((-0.32, -0.62, dz * 0.86), (0.9, 0.30, 0.24), BRONZE_L * 0.85)
    # короба подачи и амортизаторы в срезе клыка
    pb.box((0.75, 0.96, 0.0), (1.3, 0.30, 1.9), OLIVE_L * 0.9)
    pb.box((0.75, -0.96, 0.0), (1.3, 0.30, 1.9), OLIVE_L * 0.9)
    pb.box((0.95, 0.0, 0.0), (0.6, 0.86, 1.5), OLIVE)
    return pb


def center_hull():
    """Центральный корпус: компактная кабина, палуба, стыки с клыками.
    Средняя часть короткая: тело начинается на HULL_X0 = 3.2 м (это меньше
    трети длины клыков), впереди — только ферма-шасси между клыками. Фонарь
    кабины поднят над боковыми панелями на 1.2 м, чтобы пилот видел палубу."""
    pb = PB()
    loft(pb, HULL_ST, center_sec, lambda i, k: hull_palette(i, k), cap_col=WHITE_D)
    # ---- носовые «щёки»: объём корпуса по бокам от проёма.
    # Между носовым блоком и клыками оставались сквозные щели (пользователь
    # обвёл их на двух скринах: «оба корпуса с дырами возле погрузочной»).
    # Это не перемычка-ферма, а сам корпус: он плавно расширяется от рамы
    # люка к скуловым фартукам, поэтому щели закрыты, а между клыками впереди
    # по-прежнему пусто.
    for sgn in (-1, 1):
        pb.m = sgn
        xn = [1.82, 2.40, 3.10, 3.90]

        def cheek(x):
            t = (x - xn[0]) / (xn[-1] - xn[0])
            z_near = 1.42
            z_far = 1.42 + t * 3.45
            yb = cyb(max(x, HULL_X0)) + 0.04 - 0.10 * (1 - t)
            yt = cyt(max(x, HULL_X0)) - 0.02 - 0.16 * (1 - t)
            return [(yb, sgn * z_near), (yt, sgn * z_near),
                    (yt, sgn * z_far), (yb, sgn * z_far)]

        loft(pb, xn, cheek,
             lambda i, k: (WHITE_D if k in (0, 3) else
                           (BRONZE_L if i == 2 and k == 2 else
                            (WHITE if (i + k) % 2 else WHITE_D * 0.96))),
             cap_col=WHITE_D)
        # рёбра по щеке: деталировка вместо гладкой заплатки
        for x in (2.20, 2.80, 3.45):
            t = (x - xn[0]) / (xn[-1] - xn[0])
            zf = 1.42 + t * 3.45
            pb.box((x, (cyb(max(x, HULL_X0)) + cyt(max(x, HULL_X0))) / 2,
                    sgn * (1.42 + zf) / 2),
                   (0.18, cyt(max(x, HULL_X0)) - cyb(max(x, HULL_X0)) - 0.30,
                    zf - 1.42), SILVER_D)
    pb.m = 1.0

    # ---- передний торец корпуса: ПРОЁМ под аппарель, а не глухая плита.
    # Раньше здесь была плита с решёткой — пользователь справедливо сказал,
    # что это должен быть откидывающийся вниз трап (как на маркет-рендере).
    # Рамка проёма светлая, внутри — тёмный колодец.
    y_bot = cyb(HULL_X0) + 0.02
    y_top = cyt(HULL_X0) - 0.34
    h_op = y_top - y_bot
    w_op = cw(HULL_X0) * 0.68      # полная ширина проёма ≈ 3.0 м
    # рамка проёма
    for sgn in (-1, 1):
        pb.box((2.00, y_bot + h_op / 2, sgn * (w_op / 2 + 0.11)),
               (0.28, h_op + 0.30, 0.22), WHITE_D)
    pb.box((2.00, y_top + 0.15, 0.0), (0.28, 0.30, w_op + 0.44), WHITE_D)
    pb.box((2.00, y_bot - 0.12, 0.0), (0.28, 0.24, w_op + 0.44), SILVER_D)
    # вестибюль за проёмом: тёмный объём, но с полом, рёбрами и подсветкой —
    # в открытом виде это помещение, а не чёрная дыра
    pb.box((2.86, y_bot + h_op / 2, 0.0), (1.70, h_op, w_op), SILVER_D * 0.55)
    pb.box((2.62, y_bot + 0.10, 0.0), (1.56, 0.20, w_op * 0.96), SILVER_D)   # пол
    pb.box((2.62, y_top - 0.16, 0.0), (1.56, 0.16, w_op * 0.96), DARK_M)     # потолок
    for sgn in (-1, 1):                                                       # борта
        pb.box((2.62, y_bot + h_op / 2, sgn * w_op * 0.47), (1.56, h_op * 0.92, 0.10),
               WHITE_D * 0.85)
    for xr in (2.30, 2.95):                                                    # рамы-нервюры
        pb.box((xr, y_bot + h_op / 2, 0.0), (0.12, h_op * 0.94, w_op * 0.94), SILVER_D)
    pb.box((2.30, y_top - 0.34, 0.0), (1.50, 0.10, w_op * 0.60),
           AMBER * 0.75)                                                       # лампа сверху
    # порог и направляющие под аппарель
    pb.box((2.10, y_bot - 0.02, 0.0), (0.60, 0.10, w_op * 0.94), SILVER)
    pb.box((2.62, y_bot - 0.10, 0.0), (1.30, 0.16, w_op * 0.90), SILVER_D)   # поддон
    for sgn in (-1, 1):
        pb.box((2.30, y_bot + 0.16, sgn * w_op * 0.42), (0.9, 0.16, 0.18), SILVER_D)
    # габаритные огни на рамке
    for sgn in (-1, 1):
        pb.box((1.86, y_top + 0.16, sgn * w_op * 0.46), (0.12, 0.14, 0.26), AMBER * 0.85)
    # над проёмом — визор и два фонаря (обзор пилоту сверху-вперёд)
    pb.box((1.98, cyt(HULL_X0) - 0.16, 0.0), (0.14, 0.20, w_op * 0.62), GLASS_L * 0.5)
    for sgn in (-1, 1):
        pb.box((1.92, cyt(HULL_X0) - 0.14, sgn * w_op * 0.40), (0.10, 0.14, 0.22), WHITE)

    # ---- панели по бортам компактного корпуса
    for sgn in (-1, 1):
        pb.m = sgn
        for x in (4.8, 8.2, 11.8):
            w = cw(x)
            pb.box((x, cyb(x) + 0.9, sgn * (w * 0.94)), (2.2, 0.9, 0.20), WHITE_D)
            pb.box((x, cyb(x) + 0.32, sgn * (w * 0.90)), (1.8, 0.26, 0.16), RUST * 0.8)
        # блок контрмер у борта (Medium CM)
        pb.box((9.9, cyt(9.9) + 0.56, sgn * (cw(9.9) - 0.60)), (1.5, 0.90, 0.85), SILVER_D)
        for r in range(2):
            for c in range(2):
                pb.cyl(9.6 + c * 0.6, cyt(9.9) + 0.32 + r * 0.46,
                       sgn * (cw(9.9) - 0.25), 0.12, 0.36, axis='z', seg=6, color=DARK)
    pb.m = 1.0

    # ---- палуба: тёмные настилы и люки. ВСЁ зеркальными парами по бортам:
    # асимметрия в палубе читается как «сзади нет симметрии» (правка по скрину).
    for (xa, xb, zc, wz) in ((4.0, 6.2, 2.55, 1.5), (6.6, 8.8, 2.55, 1.5),
                             (9.4, 10.9, 2.45, 1.2)):
        for sgn in (-1, 1):
            xc = (xa + xb) / 2
            pb.box((xc, cyt(xc) + 0.03, sgn * zc), (xb - xa, 0.10, wz), DARK_M)
            for k in range(int((xb - xa) / 0.7)):
                pb.box((xa + 0.35 + k * 0.7, cyt(xc) + 0.09, sgn * zc),
                       (0.09, 0.06, wz * 0.94), GREY)
    for x in (5.1, 7.7, 10.2):
        for sgn in (-1, 1):
            pb.box((x, cyt(x) + 0.10, sgn * 2.55), (1.3, 0.16, 1.0), WHITE_D)
            pb.box((x, cyt(x) + 0.19, sgn * 2.55), (0.9, 0.08, 0.7), DARK_M)
    # окантовка палубы и поручни по бортам
    for sgn in (-1, 1):
        pb.m = sgn
        for x in np.arange(4.0, 12.0, 2.0):
            pb.box((x, cyt(x) + 0.06, sgn * (cw(x) - 0.10)), (2.0, 0.14, 0.22), SILVER_D)
        for x in np.arange(4.5, 11.0, 2.0):
            pb.box((x, cyt(x) + 0.26, sgn * (cw(x) - 0.16)), (0.10, 0.34, 0.10), SILVER)
        pb.box((7.5, cyt(7.5) + 0.44, sgn * (cw(7.5) - 0.16)), (6.6, 0.09, 0.09), SILVER)
    pb.m = 1.0

    # ---- пилоны, связывающие клыки с корпусом
    for sgn in (-1, 1):
        pb.m = sgn
        for x in (4.4, 9.6):
            pb.box((x, 4.05, sgn * 3.55), (2.4, 1.3, 3.4), SILVER_D)
            pb.box((x, 4.07, sgn * 3.55), (1.7, 0.9, 2.6), DARK_M)
    pb.m = 1.0

    # ---- скуловые фартуки: смыкают скорлупу с клыками по всей высоте борта.
    # Седьмая правка сузила клыки, и между бортом скорлупы и внутренней стенкой
    # клыка открылась вертикальная щель — на скринах пользователя она читалась
    # как «дыры в обоих корпусах возле погрузочной». Фартук теперь идёт от
    # нижней кромки борта вверх по склону до внутренней стенки КЛЫКА (z берём
    # из фактического профиля клыка), и начинается он с рамы носового люка.
    for sgn in (-1, 1):
        pb.m = sgn

        def z_in(x):
            return 0.94 * cw(x)                      # утоплено в борт скорлупы

        def z_out(x):
            r = float(np.interp(x, POD_X, POD_R))
            return (POD_Z - 0.924 * r) + 0.30        # заходит внутрь клыка

        def y_pod_b(x):
            return float(np.interp(x, POD_X, POD_YB)) + 0.18

        def y_pod_t(x):
            return float(np.interp(x, POD_X, POD_YT)) - 0.06

        xs = np.linspace(1.95, 15.20, 13)
        for i in range(len(xs) - 1):
            x0, x1 = xs[i], xs[i + 1]
            zi0, zi1 = z_in(x0), z_in(x1)
            zo0, zo1 = z_out(x0), z_out(x1)
            # низ: от днища скорлупы к нижней стенке клыка
            pb.face((x0, cyb(x0) + 0.10, sgn * zi0), (x1, cyb(x1) + 0.10, sgn * zi1),
                    (x1, y_pod_b(x1), sgn * zo1), (x0, y_pod_b(x0), sgn * zo0),
                    WHITE_D if i % 2 else WHITE * 0.97)
            # верх: от палубы скорлупы к ВЕРХНЕЙ стенке клыка — именно этот
            # участок был открыт, и сверху щель читалась как дыра в борту
            pb.face((x0, cyt(x0) + 0.02, sgn * zi0), (x1, cyt(x1) + 0.02, sgn * zi1),
                    (x1, y_pod_t(x1), sgn * zo1), (x0, y_pod_t(x0), sgn * zo0),
                    WHITE if i % 2 else WHITE_D * 0.95)
            # тёмная расшивка по стыку (панелировка, а не гладкая заплатка)
            if i % 2 == 0:
                pb.box((x0, (cyb(x0) + cyt(x0)) / 2, sgn * (zi0 + 0.28)),
                       (0.20, cyt(x0) - cyb(x0), 0.50), SILVER_D)
            # торцевая заглушка на носу — закрывает торец фартука у рамы люка
            if i == 0:
                pb.face((x0, cyb(x0) + 0.10, sgn * zi0),
                        (x0, y_pod_b(x0), sgn * zo0),
                        (x0, y_pod_t(x0), sgn * zo0),
                        (x0, cyt(x0) + 0.02, sgn * zi0), SILVER_D)
    pb.m = 1.0

    # ---- кожух кабины: броневой «горб» под остекление (выше боковых панелей)
    for x in CANOPY_ST:
        w = 0.62 * cw(x)
        pb.box((x, cyt(x) + 0.44, 0.0), (1.5, 0.88, 2 * w), WHITE_D)
        pb.box((x, cyt(x) + 0.86, 0.0), (1.35, 0.14, 2 * w * 0.98), SILVER_D)
        for sgn in (-1, 1):
            pb.box((x, cyt(x) + 0.36, sgn * w), (1.25, 0.56, 0.16), SILVER)
        # скос кожуха к палубе: без него под фонарём читается ступень
        for sgn in (-1, 1):
            pb.face((x - 0.75, cyt(x) + 0.02, sgn * (w + 0.42)),
                    (x + 0.75, cyt(x) + 0.02, sgn * (w + 0.42)),
                    (x + 0.75, cyt(x) + 0.88, sgn * w), (x - 0.75, cyt(x) + 0.88, sgn * w),
                    WHITE_D * 0.98)
    pb.box((4.40, cyt(4.4) + 0.40, 0.0), (0.5, 0.80, 2 * 0.62 * cw(4.4)), SILVER_D)
    pb.box((4.10, cyt(4.1) + 0.94, 0.0), (0.42, 0.16, 2 * 0.52 * cw(4.1)), SILVER)

    # ---- палубное оборудование: укладки, мачта, антенна, сканер
    # мачта перед фонарём
    mh = cyt(12.20) + 0.24
    pb.box((12.20, mh, 0.0), (0.7, 0.40, 0.7), SILVER_D)
    pb.cyl(12.20, mh + 0.42, 0.0, 0.09, 0.70, axis='y', seg=6, color=SILVER)
    pb.cyl(12.20, mh + 0.78, 0.0, 0.12, 0.36, axis='y', seg=6, color=SILVER_D)
    pb.box((12.20, mh + 0.96, 0.0), (0.15, 0.40, 0.15), SILVER)
    for sgn in (-1, 1):
        pb.box((12.20, mh + 0.86, sgn * 0.36), (0.09, 0.09, 0.62), SILVER_D)
    # оливковые укладки по бортам
    for x, w in ((5.6, 1.0), (8.6, 0.8)):
        for sgn in (-1, 1):
            pb.box((x, cyt(x) + 0.30, sgn * 2.95), (w, 0.46, w * 0.9), OLIVE * 0.95)
            pb.box((x, cyt(x) + 0.55, sgn * 2.95), (w * 0.8, 0.10, w * 0.7), OLIVE_L)
    # катушки расходников — парами
    for sgn in (-1, 1):
        pb.cyl(4.2, cyt(4.2) + 0.40, sgn * 2.0, 0.30, 1.0, axis='x', seg=8, color=BRONZE_L)
    # сканер-тарелки: пара по бортам (раньше стояла одна — была асимметрия)
    for sgn in (-1, 1):
        pb.cyl(11.2, cyt(11.2) + 0.52, sgn * 2.1, 0.06, 0.8, axis='y', seg=6, color=SILVER_D)
        pb.cyl(11.2, cyt(11.2) + 0.96, sgn * 2.1, 0.48, 0.12, axis='y', seg=10, color=WHITE_D)
    return pb


def canopy():
    """Остекление кабины: свод на броневом кожухе (узел canopy)."""
    pb = PB()
    stations = CANOPY_ST

    def base(x):
        # фонарь стоит выше боковых панелей и палубного оборудования на 0.28 м:
        # пилоту нужен обзор поверх левого и правого борта
        return cyt(x) + 0.86

    def half(x):
        return 0.50 * cw(x)

    def hgt(x):
        # свод выше всего над передней рамой кабины и плавно сходит к корме
        return 0.92 - 0.10 * (x - stations[0])

    dome(pb, stations, base, half, hgt, GLASS_L * 0.62, SILVER_D, sink=0.06)
    # передняя рама-козырёк и стойки
    x0 = stations[0]
    pb.box((x0 - 0.10, base(x0) + 0.30, 0.0), (0.30, 0.90, 2 * 0.50 * cw(x0) + 0.24), SILVER)
    pb.box((x0 + 0.30, base(x0) + 0.74, 0.0), (0.9, 0.16, 1.5), SILVER_D)
    return pb


def rear_block():
    """Кормовой блок: два сопла, радиаторы, оливковые короба (по кадрам сзади)."""
    pb = PB()
    # центральный блок
    pb.box((14.2, 4.75, 0.0), (3.6, 3.3, 4.6), SILVER_D)
    pb.box((14.6, 4.75, 0.0), (2.4, 2.6, 3.4), DARK_M)
    # оливковые короба с боков блока
    for sgn in (-1, 1):
        pb.m = sgn
        pb.box((15.4, 3.55, sgn * 3.15), (2.4, 2.5, 1.7), OLIVE)
        pb.box((15.4, 3.55, sgn * 3.95), (1.8, 1.9, 0.4), OLIVE_L)
        for k in range(4):
            pb.box((15.0, 2.60 + k * 0.52, sgn * 4.02), (1.5, 0.14, 0.16), DARK_M)
        # радиаторы-«жалюзи» на корме
        for k in range(5):
            pb.box((16.6, 3.30 + k * 0.55, sgn * 1.55), (1.2, 0.18, 1.9), SILVER)
    pb.m = 1.0
    # верхние решётки-радиаторы
    for k in range(3):
        pb.box((13.2, 6.55, (k - 1) * 1.25), (2.2, 0.16, 0.9), DARK_M)
    pb.box((13.2, 6.70, 0.0), (2.8, 0.14, 4.2), SILVER)
    # кормовая надстройка с радиаторными жалюзи
    pb.box((12.4, 6.95, 0.0), (2.2, 1.0, 3.0), WHITE_D)
    pb.box((12.4, 7.48, 0.0), (1.8, 0.14, 2.6), SILVER)
    for k in range(4):
        pb.box((11.4, 6.85 + k * 0.34, 0.0), (0.30, 0.16, 2.4), DARK_M)
    # выносные кормовые блоки (Rear thrusters): тяжёлые короба по бортам
    for sgn in (-1, 1):
        pb.m = sgn
        pb.box((17.2, 4.95, sgn * 6.95), (2.9, 2.7, 3.3), SILVER_D)
        pb.box((17.4, 4.95, sgn * 7.10), (2.2, 2.0, 2.6), OLIVE * 0.95)
        pb.box((17.5, 5.70, sgn * 7.20), (1.6, 0.5, 1.9), OLIVE_L)
        for k in range(3):
            pb.box((16.0, 3.95 + k * 0.62, sgn * 8.10), (0.7, 0.18, 0.18), DARK_M)
        # рулевой щиток-«тормоз» (Brake system с чертежа)
        pb.box((16.4, 6.55, sgn * 5.30), (1.5, 1.5, 0.22), WHITE_D)
        pb.box((16.4, 6.55, sgn * 5.42), (1.0, 1.0, 0.10), DARK_M)
        for k in range(2):
            pb.cyl(18.60, 4.70 + k * 0.60, sgn * 6.60, 0.42, 0.40, axis='x', seg=10, color=GREY)
    pb.m = 1.0
    return pb


ENGINES = [(-3.05, 4.85), (3.05, 4.85), (-3.05, 3.15), (3.05, 3.15)]   # (z, y)


def engines():
    """Сопла в кормовом блоке: тяжёлые раструбы с кольцом на срезе."""
    pb = PB()
    for (cz, cy) in ENGINES:
        pb.cyl(15.40, cy, cz, 1.24, 2.70, axis='x', seg=14, color=SILVER_D)
        pb.cyl(17.30, cy, cz, 1.14, 1.10, axis='x', seg=14, color=GREY)
        pb.cyl(18.05, cy, cz, 1.32, 0.95, axis='x', seg=14, color=SILVER_D)
        ring(pb, 18.92, cy, cz, 1.36, 1.16, 0.28, 14, SILVER, DARK_M, axis='x')
        pb.cyl(18.60, cy, cz, 1.12, 0.30, axis='x', seg=14, color=DARK_M)
        pb.cyl(18.86, cy, cz, 0.98, 0.24, axis='x', seg=14, color=DARK)
        for k in range(4):
            a = 2 * math.pi * (k + 0.5) / 4
            pb.cyl(17.60, cy + math.cos(a) * 1.24, cz + math.sin(a) * 1.24,
                   0.09, 1.05, axis='x', seg=5, color=GREY)
    return pb


def thrusters():
    pb = PB()
    for (cz, cy) in ENGINES:
        r, seg = 0.72, 12
        for k in range(seg):
            a0 = 2 * math.pi * k / seg
            a1 = 2 * math.pi * (k + 1) / seg
            pb.tri((TAIL + 1.60, cy, cz),
                   (TAIL + 1.60, cy + math.cos(a0) * r, cz + math.sin(a0) * r),
                   (TAIL + 1.60, cy + math.cos(a1) * r, cz + math.sin(a1) * r),
                   CYAN * 0.95)
        pb.tri((TAIL + 1.60, cy, cz), (TAIL + 1.60, cy + 0.35, cz),
               (TAIL + 1.60, cy, cz + 0.35), WHITE)
    return pb


def rail_guns(sgn):
    """Две рельсовые пушки fixed hardpoint на клыке (свой узел на борт).
    Локальный ноль — ось стволов, чтобы узел мог поднимать стволы."""
    pb = PB()
    z = sgn * POD_Z
    yt = float(np.interp(-6.0, POD_X, POD_YT))
    pb.box((-6.4, 0.0, z), (4.6, 0.7, 1.3), SILVER_D)
    for dz in (-0.42, 0.42):
        pb.cyl(-4.3, 0.0, z + dz, 0.16, 3.2, axis='x', seg=8, color=GREY)
        pb.cyl(-2.8, 0.0, z + dz, 0.13, 0.8, axis='x', seg=8, color=SILVER)
    yt2 = float(np.interp(6.0, POD_X, POD_YT))
    pb.box((4.2, yt2 - yt, z), (3.6, 0.6, 1.1), SILVER_D)
    pb.cyl(5.9, yt2 - yt, z, 0.15, 2.8, axis='x', seg=8, color=GREY)
    return pb


TURRET_X = -1.5


def turret_y(sgn):
    return float(np.interp(TURRET_X, POD_X, POD_YT)) + 0.10


def turret_base(sgn):
    """Погон малой турели на верхней плоскости клыка (статика)."""
    pb = PB()
    pb.cyl(0.0, 0.10, 0.0, 1.10, 0.20, axis='y', seg=14, color=SILVER_D)
    pb.cyl(0.0, 0.30, 0.0, 0.80, 0.30, axis='y', seg=12, color=SILVER)
    return pb


def turret_guns():
    """Башня со стволами. Локальный ноль — ось вращения."""
    pb = PB()
    pb.box((-0.5, 0.30, 0.0), (1.5, 0.55, 1.3), WHITE_D)
    pb.box((-0.2, 0.62, 0.0), (0.8, 0.14, 0.9), SILVER_D)
    for dz in (-0.35, 0.35):
        pb.cyl(-1.5, 0.30, dz, 0.13, 1.9, axis='x', seg=8, color=GREY)
        pb.cyl(-2.5, 0.30, dz, 0.11, 0.4, axis='x', seg=8, color=SILVER)
    return pb


def missile_bay():
    """Ракетный отсек: колодец шахты в белом комингсе с ракетами и рамкой.
    Раньше это была плоская тёмная плита на тёмной палубе — открытая крышка
    читалась как закрытая («люк не отдраивается»). Теперь проём обведён
    светлым комингсом, а стенки колодца светлые, поэтому открытый отсек видно
    с любого ракурса."""
    pb = PB()
    y0 = cyt(10.3)
    # белый комингс вокруг проёма (читается на тёмном настиле)
    for dz in (-1.12, 1.12):
        pb.box((10.30, y0 + 0.05, dz), (2.42, 0.10, 0.30), WHITE)
    for dx in (-1.21, 1.21):
        pb.box((10.30 + dx, y0 + 0.05, 0.0), (0.30, 0.10, 2.54), WHITE)
    for dz in (-0.94, 0.94):
        pb.box((10.30, y0 + 0.02, dz), (2.02, 0.05, 0.14), SILVER_D)
    for dx in (-1.01, 1.01):
        pb.box((10.30 + dx, y0 + 0.02, 0.0), (0.14, 0.05, 2.02), SILVER_D)
    # стенки колодца — светлые, дно тёмное
    pb.box((10.30, y0 - 0.30, 0.94), (1.90, 0.62, 0.12), WHITE_D)
    pb.box((10.30, y0 - 0.30, -0.94), (1.90, 0.62, 0.12), WHITE_D)
    pb.box((9.36, y0 - 0.30, 0.0), (0.12, 0.62, 1.90), WHITE_D)
    pb.box((11.24, y0 - 0.30, 0.0), (0.12, 0.62, 1.90), WHITE_D)
    pb.box((10.30, y0 - 0.60, 0.0), (1.90, 0.06, 1.90), DARK)
    # рёбра жёсткости по светлым стенкам
    for k in range(3):
        pb.box((10.30, y0 - 0.34, -0.60 + k * 0.60), (1.84, 0.10, 0.08), SILVER_D)
    # направляющие и две ракеты в шахте
    for k in range(2):
        x = 9.90 + k * 0.80
        pb.cyl(x, y0 - 0.34, 0.0, 0.28, 0.34, axis='y', seg=10, color=DARK_M)
        pb.cyl(x, y0 - 0.06, 0.0, 0.24, 0.34, axis='y', seg=10, color=WHITE_D)
        pb.cyl(x, y0 + 0.12, 0.0, 0.13, 0.12, axis='y', seg=10, color=ORANGE * 0.95)
        for a in range(4):
            ang = 2 * math.pi * a / 4
            pb.box((x + math.cos(ang) * 0.26, y0 - 0.22, math.sin(ang) * 0.26),
                   (0.08, 0.42, 0.08), GREY * 0.85)
    return pb


def wing_root(sgn):
    """Скуловая связка борта: стык скорлупы с клыком ТОЛЬКО в районе корпуса.

    Важно: клыки уходят вперёд до x = -17.4, а скорлупа начинается с
    HULL_X0 = 3.2 — впереди скорлупы между клыками должно быть ПУСТО (фермы и
    плиты там запрещены). Поэтому связка строится строго по длине корпуса,
    низким скуловым поясом с тёмными нервюрами, без широких плоскостей.
    """
    pb = PB()
    pb.m = sgn
    X0, X1 = HULL_X0 + 0.25, 14.60
    xs = np.linspace(X0, X1, 7)

    def sec(x):
        yb = float(np.interp(x, POD_X, POD_YB))
        r = float(np.interp(x, POD_X, POD_R))
        cy = cyb(x) + 0.42
        h = 0.26
        zi = sgn * (0.92 * cw(x))
        zo = sgn * ((POD_Z - r) + 0.62)
        a, b = sorted((abs(zi), abs(zo)))
        lo, hi = sgn * a, sgn * b
        return [(cy - h, lo), (cy + h, lo), (cy + h * 0.78, hi), (cy - h * 0.78, hi)]

    loft(pb, xs, sec,
         lambda i, k: (SILVER_D if k in (0, 3) else
                       (DARK_M if i % 3 == 1 else WHITE_D * 0.90)),
         cap_col=SILVER_D)

    # ---- тёмные нервюры и раскосы по стыку: стык читается как механика
    for x in (4.2, 7.0, 9.8, 12.6, 14.2):
        r = float(np.interp(x, POD_X, POD_R))
        zi = 0.90 * cw(x)
        zo = (POD_Z - r) + 0.45
        span = zo - zi
        if span < 0.3:
            continue
        yc = cyb(x) + 0.72
        pb.box((x, yc, sgn * (zi + zo) / 2), (0.40, 0.46, span * 0.94), DARK_M)
        pb.box((x, yc + 0.27, sgn * (zi + zo) / 2), (0.26, 0.12, span * 0.88), SILVER_D)
        pb.face((x - 0.09, cyb(x) + 0.45, sgn * (zi + span * 0.20)),
                (x + 0.09, cyb(x) + 0.45, sgn * (zi + span * 0.20)),
                (x + 0.09, yc + 0.12, sgn * (zi + span * 0.78)),
                (x - 0.09, yc + 0.12, sgn * (zi + span * 0.78)), SILVER_D)
        pb.cyl(x, yc - 0.30, sgn * (zi + span * 0.55), 0.08, span * 0.72, axis='z', seg=6,
               color=BRONZE_L if x < 8 else GREY)
    return pb


def ramp():
    """Аппарель: откидная плита в переднем проёме корпуса. Локальный ноль —
    петля на НИЖНЕЙ кромке проёма, плита стоит вверх (закрыто) и уходит
    вперёд-вниз при раскрытии. Обрешётка, ступени и рельсы — снаружи."""
    pb = PB()
    L, W = 3.70, 2.40
    pb.box((0.0, L / 2, 0.0), (0.22, L, W), SILVER)
    pb.box((-0.13, L / 2, 0.0), (0.08, L - 0.16, W - 0.20), WHITE_D)
    # В закрытом виде это БРОНЕВАЯ ДВЕРЬ, а не лестница: наружная плоскость
    # гладкая, с трафаретом и предупредительной полосой. Проступи видны только
    # с внутренней стороны (они на обратной плоскости плиты), поэтому нос
    # больше не читается как «второй трап сверху» (замечание пользователя).
    for k in range(9):
        y = 0.22 + k * (L - 0.44) / 8.0
        pb.box((0.19, y, 0.0), (0.03, 0.09, W - 0.34), DARK_M * 0.9)
    # пара горизонтальных швов и трафарет на наружной плоскости
    for y in (L * 0.34, L * 0.66):
        pb.box((-0.18, y, 0.0), (0.02, 0.05, W - 0.34), SILVER_D)
    pb.box((-0.18, L * 0.80, 0.0), (0.02, 0.30, W * 0.34), DARK_M * 0.8)
    # боковые рельсы и петли
    for sgn in (-1, 1):
        pb.box((0.02, L / 2, sgn * (W / 2 - 0.05)), (0.26, L, 0.10), SILVER_D)
        pb.cyl(0.0, 0.16, sgn * (W / 2 - 0.34), 0.12, 0.32, axis='z', seg=6, color=GREY)
        pb.cyl(0.0, L - 0.16, sgn * (W / 2 - 0.34), 0.10, 0.28, axis='z', seg=6, color=GREY)
        # привод-тяга вдоль рельса
        pb.cyl(0.16, L * 0.55, sgn * (W / 2 - 0.30), 0.07, L * 0.70, axis='y', seg=6,
               color=BRONZE_L)
    # настил-накладка и концевой упор
    pb.box((-0.185, L * 0.26, 0.0), (0.02, L * 0.40, W * 0.44), DARK_M * 0.85)
    pb.box((-0.02, L - 0.05, 0.0), (0.18, 0.12, W * 0.94), SILVER_D)
    for sgn in (-1, 1):
        pb.box((-0.14, L / 2, sgn * (W / 2 - 0.30)), (0.06, L - 0.10, 0.55), WHITE)
    pb.box((-0.15, 0.34, 0.0), (0.06, 0.16, W - 0.60), AMBER * 0.85)
    return pb


def bay_door():
    """Крышка ракетного отсека. Локальный ноль — петля на КОРМОВОЙ кромке:
    передняя кромка отдраивается первой и уходит вверх-вперёд вокруг Z.
    По контуру — уплотнение и язычок замка спереди."""
    pb = PB()
    # крышка светлая и крупная: в открытом положении она должна читаться
    # на тёмной палубе, иначе кажется, что люк не открывается
    pb.box((-0.99, 0.0, 0.0), (2.00, 0.24, 2.16), WHITE)
    pb.box((-0.99, 0.15, 0.0), (1.66, 0.14, 1.80), WHITE_D)
    pb.box((-0.99, 0.24, 0.0), (1.34, 0.10, 1.42), SILVER)
    # оранжевая предупреждающая полоса и рёбра
    pb.box((-1.66, 0.05, 0.0), (0.28, 0.06, 2.04), ORANGE * 0.9)
    for k in range(3):
        pb.box((-0.99, 0.31, -0.48 + k * 0.48), (1.26, 0.06, 0.16), DARK_M)
    # уплотнение по периметру и петля сзади
    for dz in (-1.06, 1.06):
        pb.box((-0.99, -0.03, dz), (1.94, 0.10, 0.10), DARK_M)
    pb.box((-0.05, -0.03, 0.0), (0.12, 0.10, 2.02), DARK_M)
    # два гидроцилиндра на петле: в открытом положении видно, что это привод
    for dz in (-0.52, 0.52):
        pb.cyl(-0.06, 0.30, dz, 0.09, 0.72, axis='x', seg=6, color=SILVER_D)
    pb.cyl(0.0, 0.0, 0.0, 0.11, 2.00, axis='z', seg=6, color=GREY)
    for dz in (-0.62, 0.62):
        pb.cyl(0.0, 0.0, dz, 0.16, 0.22, axis='z', seg=6, color=SILVER)
    # язычок замка на передней (отдраиваемой) кромке
    pb.box((-1.94, 0.02, 0.0), (0.22, 0.16, 0.46), SILVER_D)
    pb.box((-2.04, 0.05, 0.0), (0.10, 0.08, 0.26), AMBER * 0.9)
    return pb


LEGS = [(-13.5, 6.66), (-13.5, -6.66), (6.0, 2.85), (6.0, -2.85),
        (12.6, 5.55), (12.6, -5.55)]


_POD_CACHE = {}
PAD_BOT = {}          # низ опорной подушки под стойку (абс. Y)


def _pod_verts(sgn):
    """Вершины корпуса-клыка (нужны, чтобы стойки упирались ровно в днище)."""
    if sgn not in _POD_CACHE:
        _POD_CACHE[sgn] = np.array(pod(sgn).V)
    return _POD_CACHE[sgn]


def leg_belly(i):
    """Низ обшивки над стойкой: берём реальные вершины ближайшей детали.

    Обобщённый бокс корпуса занижен на всяких потёках и скулах, поэтому
    считаем по вершинам в окне вокруг стойки — иначе стойка либо висит,
    либо лезет внутрь.
    """
    x, z = LEGS[i]
    if abs(z) <= 4.0:
        return cyb(x)
    v = _pod_verts(1 if z > 0 else -1)
    win = v[(np.abs(v[:, 0] - x) < 1.05) & (np.abs(v[:, 2] - z) < 0.85)]
    if len(win) == 0:
        win = v[(np.abs(v[:, 0] - x) < 2.0) & (np.abs(v[:, 2] - z) < 1.6)]
    if len(win) == 0:
        return cyb(x)
    return float(win[:, 1].min())


def leg_pads(pb, sgn):
    """Опорные подушки под стойки — ввариваются в днище клыка."""
    v = _pod_verts(sgn)
    vmin = float(v[:, 1].min())
    for i, (x, z) in enumerate(LEGS):
        if abs(z) <= 4.0 or (z > 0) != (sgn > 0):
            continue
        bot = vmin - 0.06
        top = leg_belly(i) + 0.34           # верх утоплен в обшивку
        hgt = max(0.20, top - bot)
        PAD_BOT[i] = bot
        pb.box((x, bot + hgt / 2, z), (1.54, hgt, 1.34), SILVER_D)
        pb.box((x, bot + 0.10, z), (1.80, 0.20, 1.58), GREY)
        pb.box((x + 0.52, bot + hgt / 2, z), (0.20, hgt * 0.8, 1.0), DARK_M)


def leg(i):
    """Стойка шасси. Локальный ноль — крепление на подушке (Y совпадает с её
    низом), стопа уходит на -h, то есть ровно на палубу."""
    pb = PB()
    h = PAD_BOT.get(i, leg_belly(i))
    # корневой шарнир
    pb.box((0.0, -0.22, 0.0), (1.10, 0.44, 1.10), SILVER_D)
    pb.cyl(0.0, -0.22, 0.0, 0.32, 1.24, axis='z', seg=8, color=GREY)
    # телескоп
    pb.seg((0.0, -0.40, 0.0), (0.16, -h + 0.44, 0.0), 0.58, 0.62, SILVER, ref=(0, 0, 1))
    pb.seg((0.16, -h * 0.62, 0.0), (0.16, -h + 0.44, 0.0), 0.44, 0.46, SILVER_D, ref=(0, 0, 1))
    # гидроцилиндр сбоку и диагональная тяга
    pb.cyl(0.0, -h * 0.46, 0.40, 0.13, h * 0.78, axis='y', seg=6, color=GREY)
    pb.seg((-0.34, -0.42, 0.0), (0.02, -h + 0.52, 0.0), 0.18, 0.24, SILVER_D, ref=(0, 0, 1))
    # стопа: плита, амортизатор, габаритный огонь
    pb.box((0.20, -h + 0.26, 0.0), (1.56, 0.30, 1.30), SILVER_D)
    pb.box((0.20, -h + 0.08, 0.0), (1.74, 0.16, 1.52), GREY)
    pb.box((0.20, -h + 0.02, 0.0), (1.10, 0.10, 0.94), AMBER * 0.75)
    for dz in (-0.52, 0.52):
        pb.box((0.20, -h + 0.12, dz), (1.30, 0.06, 0.10), DARK)
    return pb


def greebles():
    """Мелочь: трубопроводы, кабели, антенны, сканеры, трапы."""
    pb = PB()
    # трубопроводы вдоль клыков (латунные линии с кадров)
    for sgn in (-1, 1):
        z0 = sgn * POD_Z
        pb.cyl(-8.0, 2.95, z0 + sgn * 1.1, 0.18, 16.0, axis='x', seg=6, color=BRONZE_L)
        pb.cyl(-8.0, 2.70, z0 + sgn * 1.5, 0.12, 14.0, axis='x', seg=6, color=BRONZE)
        # кабельные петли на стыке
        for x in (-11.0, -4.0, 3.0, 10.0):
            pb.box((x, 3.05, z0 * 0.72), (0.8, 0.5, 1.6), DARK_M)
    # антенны и сканер на палубе
    for sgn in (-1, 1):
        pb.box((4.8, cyt(4.8) + 0.26, sgn * 2.6), (1.1, 0.42, 0.7), SILVER_D)
    # ---- кормовые плавники (по маркету: зелёные «перья» над двигателями)
    # Киль растёт назад-вверх от надстройки, по бортам — два коротких пера.
    # Основания утоплены в металл на 0.03 м: щелей и висящих плоскостей нет.
    fin_base = 7.45
    fin_segs = [(12.10, 8.02, 0.40), (12.95, 8.36, 0.36), (13.80, 8.62, 0.31),
                (14.65, 8.82, 0.25), (15.50, 8.95, 0.19)]
    for (xf, yt, th) in fin_segs:
        h = yt - fin_base
        pb.box((xf, fin_base + h / 2.0, 0.0), (0.90, h, th), OLIVE_L * 1.06)
        pb.box((xf, yt - 0.07, 0.0), (0.92, 0.12, th * 1.08), OLIVE)
    pb.box((13.80, fin_base + 0.12, 0.0), (3.90, 0.24, 0.50), OLIVE)
    for sgn in (-1, 1):
        for (xf, yt, th) in [(13.55, 7.62, 0.22), (14.45, 7.86, 0.20),
                             (15.30, 7.96, 0.17)]:
            h = yt - 6.74
            pb.box((xf, 6.74 + h / 2.0, sgn * 2.05), (0.86, h, th), OLIVE_L)
            pb.box((xf, yt - 0.06, sgn * 2.05), (0.88, 0.11, th * 1.08), OLIVE)
        # зелёная накладка на кормовом срезе, как на кадрах
        pb.box((16.35, 7.05, sgn * 2.60), (1.10, 0.62, 0.30), OLIVE)

    # кормовые короба и лестницы
    pb.box((14.2, 2.95, 0.0), (2.6, 0.5, 3.0), DARK_M)
    for sgn in (-1, 1):
        for k in range(3):
            pb.box((6.6 + k * 0.8, 2.62, sgn * 2.5), (0.7, 0.08, 0.7), SILVER)
    return pb


def decals():
    """Маркировка: винно-красные полосы, шевроны, номера, наклейки команд."""
    pb = PB()
    for sgn in (-1, 1):
        pb.m = sgn
        z0 = sgn * POD_Z
        # полоса по клыку и блок номера
        pb.box((-6.0, 5.55, z0 + sgn * 1.0), (14.0, 0.20, 0.14), RED_L * 0.95)
        pb.box((6.0, 5.10, z0 + sgn * 1.62), (2.6, 1.0, 0.10), WHITE_D)
        for k in range(3):
            pb.box((5.2 + k * 0.7, 5.10, z0 + sgn * 1.69), (0.4, 0.7, 0.05), DARK)
        # шевроны у носового среза
        for k in range(3):
            pb.face((-15.4 + k * 0.8, 4.35, z0 + sgn * 1.55),
                    (-14.9 + k * 0.8, 4.35, z0 + sgn * 1.55),
                    (-14.6 + k * 0.8, 5.05, z0 + sgn * 1.55),
                    (-15.1 + k * 0.8, 5.05, z0 + sgn * 1.55), ORANGE * 0.9)
        # предупреждающая полоса у кормового среза
        for k in range(4):
            pb.face((15.0, 3.30 + k * 0.0, z0 + sgn * (0.2 + k * 0.6)),
                    (15.4, 3.30, z0 + sgn * (0.2 + k * 0.6)),
                    (15.4, 4.10, z0 + sgn * (0.2 + k * 0.6)),
                    (15.0, 4.10, z0 + sgn * (0.2 + k * 0.6)), ORANGE if k % 2 else DARK)
    pb.m = 1.0
    return pb


def lights():
    """Габариты, прожекторы, подсветка брига и стыков."""
    pb = PB()
    # носовые прожекторы в блоках стволов
    for sgn in (-1, 1):
        pb.box((-16.6, 4.10, sgn * (POD_Z - 1.5)), (0.4, 0.4, 0.6), WHITE)
        pb.box((-16.4, 5.65, sgn * (POD_Z + 1.4)), (0.5, 0.4, 0.5), AMBER * 0.9)
    # габариты на законцовках клыков
    pb.box((-15.0, 5.50, 7.6), (0.6, 0.3, 0.4), NAVGREEN)
    pb.box((-15.0, 5.50, -7.6), (0.6, 0.3, 0.4), RED_L)
    # подсветка брига и палубных люков
    for x in (4.4, 6.0, 7.6, 9.2):
        for sgn in (-1, 1):
            pb.box((x, cyt(x) + 0.16, sgn * 1.9), (0.9, 0.10, 0.24), CYAN * 0.85)
    for x in (4.0, 6.4, 9.6):
        pb.box((x, cyt(x) + 0.20, 0.0), (0.5, 0.14, 0.5), WHITE * 0.95)
    return pb


def beacon():
    """Стробы: оранжевые вспышки на клыках и палубе."""
    pb = PB()
    for sgn in (-1, 1):
        pb.box((9.0, float(np.interp(9.0, POD_X, POD_YT)) + 0.30, sgn * POD_Z),
               (0.5, 0.4, 0.5), ORANGE)
    for sgn in (-1, 1):
        pb.box((9.9, cyt(9.9) + 1.05, sgn * (cw(9.9) - 0.60)), (0.42, 0.32, 0.42), ORANGE * 0.9)
    return pb



# ---------------------------------------------------------------- сборка
CANOPY_ST = [4.6, 6.1, 7.6, 9.2]
HULL_X0 = 3.2            # передний срез центрального корпуса: впереди — только ферма и клыки
HULL_ST = [2.1] + [x for x in CX if x >= HULL_X0]
TURRET_POS = [-2.0, cyt(-2.0) + 0.18, 0.0]
GUN_X = NOSE


def glass_check(name, pb, stations, base_fn, half_fn, tol_out=0.03, tol_up=1.55):
    """Стекло обязано сидеть на обшивке и не выходить за её контур."""
    out, up = 0.0, 0.0
    for (x, y, z) in pb.V:
        out = max(out, abs(z) - half_fn(x) / 0.68 * 1.0)
        up = max(up, y - base_fn(x) - tol_up)
    print('остекление %-7s: вынос %.2f м, подъём сверх свода %.2f м' % (name, out, up))
    if out > tol_out:
        raise SystemExit('glass %s hangs outside the hull: %.2f' % (name, out))
    if up > 0.02:
        raise SystemExit('glass %s floats above the hull: %.2f' % (name, up))


def main():
    b = GlbBuilder()
    m_hull = b.material('mamba_hull', metallic=0.34, roughness=0.56)
    m_dark = b.material('mamba_dark', metallic=0.58, roughness=0.36)
    m_glass = b.material('mamba_glass', metallic=0.10, roughness=0.16)
    m_glow = b.material('mamba_glow', metallic=0.0, roughness=0.28)
    m_thrust = b.material('mamba_thrust', metallic=0.0, roughness=0.22)
    m_olive = b.material('mamba_olive', metallic=0.20, roughness=0.66)

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

    # корпуса
    for sgn in (1, -1):
        tag = 'r' if sgn > 0 else 'l'
        pbp = pod(sgn)
        _POD_CACHE[sgn] = np.array(pbp.V)
        leg_pads(pbp, sgn)
        add('pod_' + tag, pbp, m_hull, kind='pod' + tag)
        # блок стволов вставляется в носовой срез клыка — это стык, не пересечение
        add('gun_' + tag, gun_cluster(sgn), m_hull,
            pos=[GUN_X + 0.0, (float(np.interp(GUN_X, POD_X, POD_YB)) +
                               float(np.interp(GUN_X, POD_X, POD_YT))) / 2,
                 sgn * POD_Z])
    add('center_hull', center_hull(), m_hull, kind='hull')
    for sgn in (1, -1):
        add('wing_root_' + ('r' if sgn > 0 else 'l'), wing_root(sgn), m_hull, kind='hull')

    cp = canopy()
    glass_check('canopy', cp, CANOPY_ST, lambda x: cyt(x) + 0.86, lambda x: 0.50 * cw(x))
    add('canopy', cp, m_glass, kind='canopy')

    add('rear_block', rear_block(), m_hull, kind='hull')
    add('engines', engines(), m_dark, kind='hull')
    add('thrusters', thrusters(), m_thrust)
    for sgn in (1, -1):
        tag = 'r' if sgn > 0 else 'l'
        add('turret_base_' + tag, turret_base(sgn), m_hull,
            pos=[TURRET_X, turret_y(sgn), sgn * POD_Z])
        add('turret_' + tag, turret_guns(), m_hull,
            pos=[TURRET_X, turret_y(sgn) + 0.52, sgn * POD_Z])
        add('rail_guns_' + tag, rail_guns(sgn), m_hull,
            pos=[0.0, float(np.interp(-6.0, POD_X, POD_YT)) + 0.42, 0.0],
            kind='pod' + tag + '_rail')
    add('missile_bay', missile_bay(), m_hull, kind='hull')
    add('bay_door', bay_door(), m_hull, pos=[11.17, cyt(11.17) + 0.30, 0.0], kind='bdoor2')
    add('ramp', ramp(), m_hull, pos=[1.90, cyb(HULL_X0) + 0.04, 0.0], kind='ramp')
    add('greebles', greebles(), m_hull, kind='hull')
    add('decals', decals(), m_glow)
    add('lights', lights(), m_glow)
    add('beacon', beacon(), m_glow)
    for i in range(6):
        y0 = PAD_BOT.get(i, leg_belly(i))
        kd = 'leg%d' % i
        if abs(LEGS[i][1]) > 4.0:
            kd = 'pod' + ('r' if LEGS[i][1] > 0 else 'l') + '_leg%d' % i
        add('leg_%d' % i, leg(i), m_hull, pos=[LEGS[i][0], y0, LEGS[i][1]], kind=kd)

    data = b.build('fimbul_mamba')
    open(os.path.join(P, 'fimbul_mamba.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-12s verts %5d tris %5d' % (k, nv, nt))

    modes = {
        'pad':    {'legs': 1.0, 'guns': 0.0, 'turret': 0.0, 'bay': 0.0, 'ramp': 0.0,
                   'thrust': 0.0, 'strobe': 0.30, 'spots': 0.45, 'interior': 0.45},
        'flight': {'legs': 0.0, 'guns': 0.0, 'turret': 0.0, 'bay': 0.0, 'ramp': 0.0,
                   'thrust': 0.75, 'strobe': 0.55, 'spots': 1.0, 'interior': 0.55},
        'hunt':   {'legs': 0.0, 'guns': 1.0, 'turret': 1.0, 'bay': 1.0, 'ramp': 0.0,
                   'thrust': 0.9, 'strobe': 1.0, 'spots': 1.0, 'interior': 0.7},
        'load':   {'legs': 1.0, 'guns': 0.0, 'turret': 0.0, 'bay': 1.0, 'ramp': 1.0,
                   'thrust': 0.0, 'strobe': 0.4, 'spots': 0.85, 'interior': 1.0},
    }
    json.dump({'pods': 2, 'guns': 2, 'legs': 6, 'barrels_per_pod': 4,
               'gun_elev_deg': 16.0, 'turret_yaw_deg': 110.0, 'turret_pitch_deg': 18.0,
               'bay_open_deg': 60.0, 'ramp_open_deg': 140.0, 'leg_retract': 1.9,
               'turret_pos': TURRET_POS,
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
    raw = open(os.path.join(P, 'fimbul_mamba.glb'), 'rb').read()
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
