#!/usr/bin/env python3
"""Pearce F4 — патрульный истребитель Pearce (Star Atlas, PF4, Rare).
58 × 40 × 16 м, экипаж 5 (пилот, штурман, 2 офицера безопасности).

Компоновка восстановлена по чертежу корпорации (вид сверху / сбоку / фронт
с подписями MINI MULTIAXIAL PROPULSOR, PULSE DRIVE, ESCAPE POD,
MULTIAXIAL ARTICULATION, WEAPON 1 / WEAPON 2) и по кадрам галереи:

  * ДВА ДЛИННЫХ ПЕРЕДНИХ ДВИГАТЕЛЯ-БАЛКИ (mini multiaxial propulsor) —
    прямоугольные в сечении брусы, вынесенные вперёд на 29 м от миделя,
    с циановыми решётками на срезе, панельными швами и орудийными пилонами;
  * широкий щитовидный корпус в корме: плоская палуба-броня, гранёные скулы,
    горб кабины с наклонным фонарём и красным «шевроном» Pearce;
  * срединная палуба — решётка PULSE DRIVE, люк ESCAPE POD, блоки датчиков;
  * два отвала-крыла на «multiaxial articulation»: круглые шарнирные узлы по
    бортам, стреловидные плоскости с красной кромкой и циановой полосой,
    законцовки с АНО; малые передние крылышки на брусьях;
  * корма: решётчатые радиаторы, две наклонённые штанги-плавника, плита с
    жалюзи; снизу — ферменная рама с малыми дюзами и навигационными огнями;
  * ракетный отсек в днище: колодец с ракетами и две створки на петлях;
  * шасси — три стойки (носовая и пара кормовых), стопы строго на Y = 0;
  * ливрея Pearce: тёмный сине-серый металл, красные акценты, циановая
    подсветка движков и палубных полос, АНО на законцовках.
"""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, cylinder

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261213)

# ---------------------------------------------------------------- габарит
L, W, H = 58.0, 40.0, 16.0
HX, HZ = L / 2, W / 2                 # 29 / 20

# ---------------------------------------------------------------- цвета

# ливрея Pearce: тёмный сине-серый металл с холодными бликами — как на
# маркет-рендерах PF4 (светло-серой обшивки у этого корабля нет)
GRAPH_D = np.array([0.082, 0.090, 0.112])
GRAPH = np.array([0.124, 0.136, 0.166])
GRAPH_L = np.array([0.172, 0.186, 0.220])
GRAPH_H = np.array([0.224, 0.240, 0.280])
RED_D = np.array([0.330, 0.050, 0.070])
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
        self.TC, self.TM, self.PRE = [], [], []
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
        for p in v:
            self.V.append([float(p[0]), float(p[1]), float(p[2])])
            self.C.append([0.0, 0.0, 0.0, 1.0])
        self.TC.append(np.asarray(color, np.float64).reshape(-1)[:3].copy())
        self.TM.append(float(mul))
        self.PRE.append(False)
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
        # ВАЖНО: все шесть нормалей НАРУЖУ (иначе в браузере с односторонним
        # материалом стены отбрасываются и деталь «просвечивает»)
        self.face([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color, mul)
        self.face([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, mul)
        self.face([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], color, mul)
        self.face([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], color, mul)
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
        for _ in range(len(t)):
            self.TC.append(np.zeros(3))
            self.TM.append(1.0)
            self.PRE.append(True)

    def get(self):
        """Геометрия с ПРОВЕРЕННОЙ ориентацией и запечённым затенением."""
        V = np.array(self.V, np.float32)
        T = np.array(self.T, np.int64)
        if not len(T):
            return V, np.zeros((0, 3), np.uint32), np.zeros((0, 4), np.float32)
        base = np.array(self.TC, np.float64)
        mul = np.array(self.TM, np.float64)
        key = np.round(V / 1e-3).astype(np.int64)
        _, idx = np.unique(key, axis=0, return_inverse=True)
        par = np.arange(int(idx.max()) + 1)

        def find(a):
            while par[a] != a:
                par[a] = par[par[a]]
                a = par[a]
            return a

        for tri in T:
            ra, rb = find(idx[tri[0]]), find(idx[tri[1]])
            if ra != rb:
                par[rb] = ra
            rc = find(idx[tri[2]])
            if rc != ra:
                par[rc] = ra
        roots = np.array([find(idx[t[0]]) for t in T])
        for root in np.unique(roots):
            sel = roots == root
            P = V[T[sel]].astype(np.float64)
            vol = np.einsum('ij,ij->i', P[:, 0],
                            np.cross(P[:, 1], P[:, 2])).sum() / 6.0
            if vol < -1e-7:                       # вывернутый кусок — развернуть
                T[sel] = T[sel][:, [0, 2, 1]]
        a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
        n = np.cross(b - a, c - a).astype(np.float64)
        ln = np.linalg.norm(n, axis=1, keepdims=True)
        ln[ln == 0] = 1.0
        n /= ln
        lam = np.maximum(0.0, n @ LIGHT)
        sky = 0.20 * np.maximum(0.0, n[:, 1]) - 0.12 * np.maximum(0.0, -n[:, 1])
        shade = 0.46 + 0.50 * lam + sky
        col = np.clip(base * (shade * mul)[:, None], 0, 1)
        pre = np.array(self.PRE, bool)
        Cv = np.array(self.C, np.float64).copy()
        Cv[T[~pre].reshape(-1), :3] = np.repeat(col[~pre], 3, axis=0)
        Cv = Cv[:len(V)]
        Cv[:, 3] = 1.0
        return V, T.astype(np.uint32), Cv.astype(np.float32)

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


def loft(pb, xs, section_fn, col_fn, cap=True, cap_col=None, skip=None):
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
            if skip is not None and skip(x0, k):
                continue
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
        for idx, x, want in ((0, xs[0], -1.0), (-1, xs[-1], 1.0)):
            S = secs[idx]
            cy = np.mean([p[0] for p in S])
            cz = np.mean([p[1] for p in S])
            col = cap_col if cap_col is not None else col_fn(0, 0) * 0.9
            order = list(range(n))

            def tri_nx(ordr):
                a = np.array([x, cy, cz])
                b = np.array([x, S[ordr[1]][0], S[ordr[1]][1]])
                c = np.array([x, S[ordr[2]][0], S[ordr[2]][1]])
                if pb.m < 0:                     # pb.tri сам развернёт обход
                    b, c = c, b
                return float(np.cross(b - a, c - a)[0])
            # НАПРАВЛЕНИЕ ТОРЦА ПРОВЕРЯЕТСЯ по фактической тройке вершин:
            # раньше задний торец корпуса выходил вывернутым внутрь (−X), с
            # отсечением граней его не было видно — у входа в аппарель
            # читалась «дыра».
            if tri_nx(order) * want < 0:
                order = order[::-1]
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


def ering(pb, x, y, z, ro_y, ro_z, ri_y, ri_z, thick, seg, col_out, col_in,
          axis='x'):
    """Кольцо-эллипс: отдельные радиусы по Y и Z.

    Нужно для сопел: срез двигательной балки — овал 3.9 × 2.9 м, круглое
    кольцо на него не садится (вылезает сверху и не достаёт до борта).
    """
    for k in range(seg):
        a0 = 2 * math.pi * k / seg
        a1 = 2 * math.pi * (k + 1) / seg
        c0, s0 = math.cos(a0), math.sin(a0)
        c1, s1 = math.cos(a1), math.sin(a1)

        def pt(ry, rz, c, sn, t):
            if axis == 'y':
                return (x + c * ry, y + t, z + sn * rz)
            return (x + t, y + c * ry, z + sn * rz)
        o0 = pt(ro_y, ro_z, c0, s0, -thick / 2)
        o1 = pt(ro_y, ro_z, c1, s1, -thick / 2)
        o2 = pt(ro_y, ro_z, c1, s1, thick / 2)
        o3 = pt(ro_y, ro_z, c0, s0, thick / 2)
        i0 = pt(ri_y, ri_z, c0, s0, -thick / 2)
        i1 = pt(ri_y, ri_z, c1, s1, -thick / 2)
        i2 = pt(ri_y, ri_z, c1, s1, thick / 2)
        i3 = pt(ri_y, ri_z, c0, s0, thick / 2)
        if pb.m < 0:
            pb.face(o3, o2, o1, o0, col_out)
            pb.face(i2, i3, i0, i1, col_in)
            pb.face(i3, i2, o2, o3, col_in * 1.25)
            pb.face(i0, i1, o1, o0, col_in * 0.8)
        else:
            pb.face(o0, o1, o2, o3, col_out)
            pb.face(i1, i0, i3, i2, col_in)
            pb.face(o3, o2, i2, i3, col_in * 1.25)
            pb.face(o1, o0, i0, i1, col_in * 0.8)


def glass_check(name, pb, stations, base_fn, half_fn, tol_out=0.03, tol_up=1.55):
    """Стекло обязано сидеть на обшивке и не выходить за её контур.

    В отличие от «клыкастых» кораблей здесь фонарь лежит на широком броневом
    горбе, поэтому проверяется прямое вхождение в его полуширину."""
    out, up = 0.0, 0.0
    for (x, y, z) in pb.V:
        out = max(out, abs(z) - half_fn(x))
        up = max(up, y - base_fn(x) - tol_up)
    print('остекление %-7s: вынос %.2f м, подъём сверх свода %.2f м' % (name, out, up))
    if out > tol_out:
        raise SystemExit('glass %s hangs outside the hull: %.2f' % (name, out))
    if up > 0.02:
        raise SystemExit('glass %s floats above the hull: %.2f' % (name, up))


# ---------------------------------------------------------------- профили
L, W, H = 58.0, 40.0, 16.0
HX, HZ = L / 2, W / 2                 # 29 / 20

# Корпус: тупой бронированный форштевень в носу (−X), спина с горбом кабины,
# сужение к корме, где по бортам уходят две длинные двигательные балки.
UX = [-29.0, -27.2, -24.6, -21.0, -17.0, -12.0, -6.0, 0.0, 5.0, 8.0,
      10.4, 12.2, 13.5, 14.5, 15.1, 15.4]
UW = [0.90, 3.30, 5.60, 7.10, 7.95, 8.20, 8.10, 7.70, 7.05, 6.25,
      5.55, 4.85, 4.30, 4.06, 3.90, 3.82]
UYB = [4.00, 3.55, 3.15, 3.00, 3.00, 3.05, 3.15, 3.25, 3.35, 3.42,
       3.50, 3.57, 3.64, 3.69, 3.71, 3.72]
UYT = [5.55, 6.05, 6.45, 6.72, 6.90, 7.00, 7.02, 6.92, 6.78, 6.60,
       6.46, 6.34, 6.27, 6.23, 6.21, 6.20]


def cw(x):
    return float(np.interp(x, UX, UW))


def cyb(x):
    return float(np.interp(x, UX, UYB))


def cyt(x):
    return float(np.interp(x, UX, UYT))


# Горб кабины — сразу за форштевнем.
CH_ST = [-19.0, -15.6, -11.8, -8.0, -4.2]
CH_W = [1.85, 2.70, 3.05, 2.80, 2.15]
CH_H = [0.62, 1.22, 1.50, 1.32, 0.72]
CAN_ST = [-17.6, -14.4, -11.0, -7.6]


def ch_w(x):
    return float(np.interp(x, CH_ST, CH_W))


def ch_h(x):
    return float(np.interp(x, CH_ST, CH_H))


def hump_top(x):
    return cyt(x) + ch_h(x) - 0.04


# Двигательные балки: уходят в КОРМУ (+X), на срезах — циановые решётки.
BX = [1.0, 5.0, 9.0, 13.0, 17.0, 21.0, 25.0, 28.6]
BX_END = BX[-1]                     # кормовой срез двигательной балки
BW = [2.40, 2.90, 3.00, 2.98, 2.80, 2.52, 2.24, 1.96]
BMB = [3.50, 3.45, 3.45, 3.52, 3.64, 3.76, 3.90, 4.06]
BMT = [7.60, 7.78, 7.84, 7.76, 7.60, 7.40, 7.20, 6.96]
BZ = 6.30                                         # ось балки по Z (вынос наружу)
# --- ГЕОМЕТРИЯ СОПЛА: одни числа и для металла, и для свечения ---
# Раньше обойма и решётка считались порознь и не совпадали (ячейки свисали
# за кромку). Теперь всё выводится из сечения балки в срезе, поэтому детали
# садятся друг в друга ПО ПОСТРОЕНИЮ.
NOZ_X0 = BX_END - 0.30        # начало обоймы (внутри балки)
NOZ_X1 = BX_END + 0.30        # плоскость устья
NOZ_S_C0, NOZ_S_C1 = 1.02, 0.94   # обойма: наружный радиус, от начала к устью
NOZ_S_LIP = 0.78              # просвет устья (губа)
NOZ_X_BACK = BX_END + 0.02    # дно сопла
GRID_X = BX_END + 0.16        # плоскость решётки: утоплена на 0.14 в устье
GRID_S = 0.70                 # решётка занимает 0.70 сечения — с зазором от губы
GRID_ROWS, GRID_COLS = 6, 8
GRID_FILL = 0.64              # доля шага, которую занимает светящаяся ячейка
GRID_INSIDE = 0.96            # угловые ячейки за круглым устьем не рисуем


GRID_BAR = 0.06               # толщина металлического бруса решётки, м


def grid_layout(hh, hw):
    """Раскладка решётки. Возвращает проёмы (y, z, dy, dz, r, c) и габарит.

    Одна функция на всех: металлические брусья рисуются ПО ГРАНИЦАМ проёмов,
    светящиеся ячейки — ровно В ПРОЁМАХ. Поэтому они не могут разъехаться.
    """
    gy, gz = 2 * hh * GRID_S, 2 * hw * GRID_S
    sy, sz = gy / GRID_ROWS, gz / GRID_COLS
    y0, z0 = -gy / 2.0, -gz / 2.0
    cells = []
    for r in range(GRID_ROWS):
        for c in range(GRID_COLS):
            cy = y0 + (r + 0.5) * sy
            cz = z0 + (c + 0.5) * sz
            cells.append((cy, cz, sy - GRID_BAR, sz - GRID_BAR, r, c))
    return cells, (y0, z0, gy, gz, sy, sz)


def nozzle_frame():
    """Центр и полуразмеры сечения балки на кормовом срезе."""
    yc = (float(np.interp(BX_END, BX, BMB)) + float(np.interp(BX_END, BX, BMT))) / 2.0
    hh = (float(np.interp(BX_END, BX, BMT)) - float(np.interp(BX_END, BX, BMB))) / 2.0
    hw = float(np.interp(BX_END, BX, BW))
    return yc, hh, hw

# Шасси: носовая стойка под форштевнем, пара кормовых — под брусьями.
LEGS = [(-17.5, 0.0), (5.5, 4.6), (5.5, -4.6)]
PAD_BOT = [-0.02, -0.02, -0.02]


# ---------------------------------------------------------------- утилиты
def quad_solid(pb, pts, up, dn, col_top, col_bot, col_edge=None, sgn=1):
    """Плоская деталь из четырёх точек с толщиной; грани смотрят наружу."""
    col_edge = col_edge if col_edge is not None else col_top * 0.88
    P = np.array([[p[0], p[1], sgn * p[2]] for p in pts], float)
    T = P + np.array([0.0, up, 0.0])
    B = P - np.array([0.0, dn, 0.0])
    cen = P.mean(axis=0)

    def mk(q, col, want):
        n = np.cross(q[1] - q[0], q[2] - q[0])
        if float(n @ np.array(want, float)) < 0:
            q = q[::-1]
        pb.face(tuple(q[0]), tuple(q[1]), tuple(q[2]), tuple(q[3]), col)

    mk(T, col_top, (0, 1, 0))
    mk(B, col_bot, (0, -1, 0))
    for k in range(4):
        k2 = (k + 1) % 4
        q = np.array([T[k], T[k2], B[k2], B[k]])
        mk(q, col_edge, q.mean(axis=0) - cen)
    return T, B


# ------------------------------------------------- посадка декора на обшивку
def hull_side_pts(x, sgn=1):
    """Точки борта центрального корпуса (снизу вверх) для станции x."""
    yb, yt = cyb(x), cyt(x)
    h = yt - yb
    return [(yb, 0.52 * cw(x)), (yb + 0.22 * h, 1.00 * cw(x)),
            (yb + 0.66 * h, 0.94 * cw(x)), (yt + 0.26, 0.50 * cw(x))]


def skin_z(x, y, sgn=1):
    """Полуширина БОРТА на высоте y: по ней и сажаем декор, а не по cw(x)."""
    pts = hull_side_pts(x, sgn)
    z = float(np.interp(y, [p[0] for p in pts], [p[1] for p in pts]))
    return sgn * z


def deck_y(x):
    return cyt(x) + 0.26


def side_box(pb, x, y, dx, dy, dz, col, sgn=1, out=0.10, mul=1.0):
    """Планка на БОРТУ: утоплена на (dz-out), наружу выступает на out."""
    z = skin_z(x, y, sgn) + sgn * (out - 0.5 * dz)
    pb.box((x, y, z), (dx, dy, dz), col, mul)


def deck_box(pb, x, z, dx, dy, dz, col, out=0.10, mul=1.0):
    """Планка на ПАЛУБЕ: низ утоплен, сверху выступает на out."""
    pb.box((x, deck_y(x) + out - 0.5 * dy, z), (dx, dy, dz), col, mul)


def belly_box(pb, x, z, dx, dy, dz, col, out=0.08, mul=1.0):
    """Планка на ДНИЩЕ (плоская часть): выступает вниз на out."""
    pb.box((x, cyb(x) - out + 0.5 * dy, z), (dx, dy, dz), col, mul)


def boom_top_y(x):
    return float(np.interp(x, BX, BMT))


def boom_box(pb, x, z_off, dx, dy, dz, col, sgn=1, out=0.08, mul=1.0):
    """Планка на ПАЛУБЕ двигательной балки (z_off — смещение от оси балки)."""
    pb.box((x, boom_top_y(x) + out - 0.5 * dy, sgn * (BZ + z_off)),
           (dx, dy, dz), col, mul)


def side_run(pb, x0, x1, y, r, col, sgn=1, seg=1.25, out=0.06):
    """Трубопровод вдоль борта: короткие сегменты, КАЖДЫЙ по своему сечению."""
    n = max(1, int(round(abs(x1 - x0) / seg)))
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n
        xb = x0 + (x1 - x0) * (i + 1) / n
        xm = 0.5 * (xa + xb)
        if not (cyb(xm) + 0.35 < y < cyt(xm) + 0.10):
            continue                          # не вылезаем за борт/палубу
        z = skin_z(xm, y, sgn) + sgn * (out - r)
        pb.cyl(xm, y, z, r, abs(xb - xa) + 0.10, axis='x', seg=6, color=col)


def deck_run(pb, x0, x1, z, w, t, col, seg=1.4, out=0.06):
    """Полоса по палубе: сегментами, каждый по своему сечению."""
    n = max(1, int(round(abs(x1 - x0) / seg)))
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n
        xb = x0 + (x1 - x0) * (i + 1) / n
        xm = 0.5 * (xa + xb)
        deck_box(pb, xm, z, abs(xb - xa) + 0.08, t, w, col, out=out)


def side_run_box(pb, x0, x1, y, dx, dy, dz, col, sgn=1, seg=1.2, out=0.08):
    """Полоса ливреи по борту: сегментами по сечениям."""
    n = max(1, int(round(abs(x1 - x0) / seg)))
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n
        xb = x0 + (x1 - x0) * (i + 1) / n
        xm = 0.5 * (xa + xb)
        side_box(pb, xm, y, abs(xb - xa) + 0.06, dy, dz, col, sgn=sgn, out=out)


def plate_z(pb, pts_xy, th, col_side, col_edge, col_top=None):
    """Вертикальная плита: контур в плоскости XY, толщина ±th по Z."""
    P = np.array(pts_xy, float)
    cen = P.mean(axis=0)
    for s in (1, -1):
        q = np.array([[p[0], p[1], s * th] for p in P])
        n = np.cross(q[1] - q[0], q[2] - q[0])
        if float(n[2] * s) < 0:
            q = q[::-1]
        pb.face(tuple(q[0]), tuple(q[1]), tuple(q[2]), tuple(q[3]), col_side)
    for k in range(4):
        k2 = (k + 1) % 4
        a = (P[k][0], P[k][1], th)
        b = (P[k2][0], P[k2][1], th)
        c = (P[k2][0], P[k2][1], -th)
        d = (P[k][0], P[k][1], -th)
        q = np.array([a, b, c, d])
        mid = np.array([(P[k][0] + P[k2][0]) / 2, (P[k][1] + P[k2][1]) / 2, 0.0])
        want = mid - np.array([cen[0], cen[1], 0.0])
        want[2] = 0.0
        n = np.cross(q[1] - q[0], q[2] - q[0])
        if float(n @ want) < 0:
            q = q[::-1]
        pb.face(tuple(q[0]), tuple(q[1]), tuple(q[2]), tuple(q[3]),
                col_edge if col_edge is not None else col_side * 0.9)


# ---------------------------------------------------------------- корпус
def hull_sec(x):
    """Сечение: плоское днище, широкие скулы, наклонные борта, палуба."""
    w, yb, yt = cw(x), cyb(x), cyt(x)
    h = yt - yb
    return [(yb, -0.52 * w), (yb + 0.22 * h, -1.00 * w), (yb + 0.66 * h, -0.94 * w),
            (yt + 0.26, -0.50 * w), (yt + 0.26, 0.50 * w), (yb + 0.66 * h, 0.94 * w),
            (yb + 0.22 * h, 1.00 * w), (yb, 0.52 * w)]


def hull_palette(i, k):
    if k in (0, 7):
        return GRAPH_L if i % 2 else GRAPH_H              # днище
    if k in (1, 6):
        return GRAPH if i % 3 else GRAPH_L                # скула
    if k in (2, 5):
        return GRAPH_L if i % 2 else GRAPH_H              # борт
    if k in (3, 4):
        return GRAPH_H if i % 3 else GRAPH_L              # палуба
    return GRAPH_L


def hull_skin():
    """Обшивка: лофт корпуса, форштевень, горб кабины, кормовой срез."""
    pb = PB()
    loft(pb, UX, hull_sec, hull_palette, cap_col=GRAPH,
         skip=None)

    # --- бронированный форштевень: гранёный «клюв» с подбородком
    for sgn in (-1, 1):
        pb.face((-29.0, cyb(-29.0) + 0.20, sgn * 0.60),
                (-29.0, cyt(-29.0) - 0.20, sgn * 0.60),
                (-26.2, cyt(-27.0) - 0.30, sgn * 2.10),
                (-26.2, cyb(-27.0) + 0.30, sgn * 2.10), GRAPH_H)
        pb.face((-29.0, cyb(-29.0) + 0.20, sgn * 0.60),
                (-26.2, cyb(-27.0) + 0.30, sgn * 2.10),
                (-24.0, cyb(-24.0) + 0.10, sgn * 3.60),
                (-24.0, cyb(-24.0) + 0.90, sgn * 3.20), GRAPH)
    pb.face((-29.0, cyb(-29.0) + 0.20, -0.60), (-29.0, cyb(-29.0) + 0.20, 0.60),
            (-26.0, cyb(-26.0) - 0.10, 1.10), (-26.0, cyb(-26.0) - 0.10, -1.10), GRAPH_L)

    # --- горб кабины
    def hump_sec(x):
        w = ch_w(x)
        y0 = cyt(x) - 0.14
        y1 = cyt(x) + ch_h(x)
        return [(y0, -1.16 * w), (y1 - 0.28, -1.00 * w), (y1, -0.68 * w),
                (y1, 0.68 * w), (y1 - 0.28, 1.00 * w), (y0, 1.16 * w)]
    loft(pb, CH_ST, hump_sec, lambda i, k: (GRAPH_H if k in (2, 3) else
                                           (GRAPH_L if k in (1, 4) else GRAPH)),
         cap_col=GRAPH)
    for sgn in (-1, 1):
        for x in (-17.0, -13.6, -10.2, -6.6):
            w = ch_w(x)
            pb.box((x, cyt(x) + ch_h(x) * 0.58, sgn * (1.02 * w)), (0.5, 0.40, 0.10), GRAPH_D)

    # (палубные плиты, бортовые панели и решётки — в hull_trim(), чтобы их
    #  посадку на обшивку можно было проверить числами)
    # --- кормовой срез: косяки и притолока проёма аппарели
    for sgn in (-1, 1):
        pb.box((15.35, 4.89, sgn * 2.10), (0.26, 2.38, 0.34), GRAPH_L)
        pb.box((15.30, 4.89, sgn * 1.94), (0.14, 2.32, 0.12), SILVER_D * 0.85)
    pb.box((15.35, 6.10, 0.0), (0.26, 0.26, 4.42), GRAPH_D)

    # --- забранная плоскость кормы по бокам проёма: СВЕТЛАЯ панель с
    #     расшивкой, иначе она темнее фона и проём читается «дырой»
    # торец развёрнут в +X и света не получает, поэтому панели набраны
    # СВЕТЛЫМ металлом: иначе плоскость темнее фона и проём читается дырой
    for sgn in (-1, 1):
        pb.box((15.40, 4.92, sgn * 3.00), (0.10, 2.24, 1.62), SILVER_D * 1.05)
        for k in range(4):
            pb.box((15.34, 3.96 + k * 0.62, sgn * 3.00), (0.05, 0.09, 1.46), GRAPH_D)
        pb.box((15.34, 4.92, sgn * 2.60), (0.05, 2.10, 0.08), GRAPH_D)
        pb.box((15.34, 4.92, sgn * 3.40), (0.05, 2.10, 0.08), GRAPH_D)
        pb.box((15.33, 5.66, sgn * 3.00), (0.06, 0.26, 0.90), SILVER_D * 1.5)
        pb.box((15.33, 3.96, sgn * 3.00), (0.06, 0.14, 1.46), GRAPH_D)
        pb.cyl(15.32, 6.00, sgn * 3.62, 0.12, 0.10, axis='x', seg=8, color=RED_L)
    # верхняя панель над проёмом
    pb.box((15.40, 6.12, 0.0), (0.10, 0.34, 4.56), SILVER_D * 0.95)
    for k in range(5):
        pb.box((15.34, 6.12, -1.80 + k * 0.90), (0.05, 0.30, 0.08), GRAPH_D)
    return pb


def hull_trim():
    """Палубные и бортовые панели, скуловые накладки, решётки — ПО ОБШИВКЕ.

    Раньше эти планки ставились по cw(x) — по СКУЛЕ (самой широкой точке) —
    а по высоте сидели ниже скулы, где борт уже. В итоге вокруг корпуса
    висело кольцо чёрных планок в 1-2.4 м от обшивки (правка 24).
    Теперь каждая планка садится по skin_z(x, y) и утоплена в обшивку.
    """
    pb = PB()
    # --- палубные бронеплиты со швами и заклёпками
    for i, x in enumerate(np.arange(-24.0, 12.0, 2.4)):
        w = cw(x) * 0.44
        deck_box(pb, x, 0.0, 2.15, 0.08, 2 * w, GRAPH_H if i % 2 else GRAPH_L)
        deck_box(pb, x + 1.16, 0.0, 0.10, 0.09, 2 * w + 0.08, GRAPH_D, out=0.06)
        for dz in (-0.62 * w, 0.62 * w):
            deck_box(pb, x - 0.55, dz, 0.10, 0.05, 0.10, SILVER_D * 0.85, out=0.12)
            deck_box(pb, x + 0.45, dz, 0.10, 0.05, 0.10, SILVER_D * 0.85, out=0.12)
    # --- бортовые панели, скуловые накладки и решётки радиатора
    for sgn in (-1, 1):
        for x in np.arange(-24.0, 12.0, 2.2):
            side_box(pb, x, cyb(x) + 0.32, 2.0, 0.28, 0.14, GRAPH_D, sgn=sgn, out=0.09)
            side_box(pb, x, cyt(x) - 0.26, 1.8, 0.14, 0.12, GRAPH_D, sgn=sgn, out=0.08)
        for i, x in enumerate(np.arange(-20.0, 10.0, 3.2)):
            side_box(pb, x, cyb(x) + 0.62, 2.5, 0.44, 0.20,
                     GRAPH_L if i % 2 else GRAPH, sgn=sgn, out=0.12)
            for k in range(3):
                side_box(pb, x - 0.8 + k * 0.8, cyb(x) + 0.64, 0.18, 0.32, 0.10,
                         GRAPH_D, sgn=sgn, out=0.18)
        # красный акцент ливреи на скуле
        side_box(pb, -21.0, cyb(-21.0) + 0.95, 2.4, 0.30, 0.10, RED_L, sgn=sgn, out=0.07)
        side_box(pb, -13.0, cyb(-13.0) + 0.80, 3.0, 0.16, 0.10, RED_D, sgn=sgn, out=0.07)
    return pb


def leg_pads(ch):
    for (x, z) in LEGS:
        ch.box((x, cyb(x) + 0.05, z), (2.0, 0.16, 1.5), GRAPH_D)
        ch.box((x, cyb(x) - 0.02, z), (1.5, 0.10, 1.1), GRAPH_L)


# ---------------------------------------------------------------- балки
def boom_sec(x):
    w = float(np.interp(x, BX, BW))
    yb = float(np.interp(x, BX, BMB))
    yt = float(np.interp(x, BX, BMT))
    h = yt - yb
    return [(yb, -0.66 * w), (yb + 0.18 * h, -1.00 * w), (yt - 0.22 * h, -0.96 * w),
            (yt, -0.60 * w), (yt, 0.60 * w), (yt - 0.22 * h, 0.96 * w),
            (yb + 0.18 * h, 1.00 * w), (yb, 0.66 * w)]


def engine_boom(sgn):
    """Длинная кормовая двигательная балка с килем и решёткой на срезе."""
    pb = PB()
    pb.m = sgn
    z0 = sgn * BZ

    def sec(x):
        return [(y, sgn * (BZ + z)) for (y, z) in boom_sec(x)]
    loft(pb, BX, sec, lambda i, k: (GRAPH_H if k in (3, 4) else
                                    (GRAPH_L if k in (2, 5) else
                                     (GRAPH if k in (1, 6) else GRAPH_D))),
         cap_col=GRAPH_H)
    # --- кормовой срез: СОПЛО (обойма + губа + утопленное устье + решётка).
    # Все размеры — из nozzle_frame(), поэтому свечение ложится ровно внутрь.
    yc, hh, hw = nozzle_frame()
    zc0 = sgn * BZ

    def ring_at(x, s_out, s_in, col_out, col_in):
        """Кольцо-октагон в плоскости x: наружная стенка, внутренняя, торцы."""
        n = 12
        for k in range(n):
            a0 = 2 * np.pi * k / n + np.pi / n
            a1 = 2 * np.pi * (k + 1) / n + np.pi / n
            o0 = (x, yc + np.sin(a0) * hh * s_out, zc0 + np.cos(a0) * hw * s_out)
            o1 = (x, yc + np.sin(a1) * hh * s_out, zc0 + np.cos(a1) * hw * s_out)
            i0 = (x, yc + np.sin(a0) * hh * s_in, zc0 + np.cos(a0) * hw * s_in)
            i1 = (x, yc + np.sin(a1) * hh * s_in, zc0 + np.cos(a1) * hw * s_in)
            pb.face(i0, i1, o1, o0, col_in)          # торец кольца
    # обойма: две секции наружной стенки
    for x0, x1, s0, s1 in ((NOZ_X0, NOZ_X1 - 0.08, NOZ_S_C0, NOZ_S_C1),
                           (NOZ_X1 - 0.08, NOZ_X1, NOZ_S_C1, NOZ_S_C1)):
        n = 12
        for k in range(n):
            a0 = 2 * np.pi * k / n + np.pi / n
            a1 = 2 * np.pi * (k + 1) / n + np.pi / n
            p0 = (x0, yc + np.sin(a0) * hh * s0, zc0 + np.cos(a0) * hw * s0)
            p1 = (x0, yc + np.sin(a1) * hh * s0, zc0 + np.cos(a1) * hw * s0)
            p2 = (x1, yc + np.sin(a1) * hh * s1, zc0 + np.cos(a1) * hw * s1)
            p3 = (x1, yc + np.sin(a0) * hh * s1, zc0 + np.cos(a0) * hw * s1)
            pb.face(p0, p1, p2, p3, GRAPH_L if k % 2 else GRAPH_H)
    # губа устья: кольцо от обоймы к просвету (лежит в плоскости устья)
    ring_at(NOZ_X1, NOZ_S_C1, NOZ_S_LIP, GRAPH_H, GRAPH_D)
    # устье-стакан: внутренняя стенка от губы вглубь до дна
    n = 12
    for k in range(n):
        a0 = 2 * np.pi * k / n + np.pi / n
        a1 = 2 * np.pi * (k + 1) / n + np.pi / n
        p0 = (NOZ_X1, yc + np.sin(a0) * hh * NOZ_S_LIP, zc0 + np.cos(a0) * hw * NOZ_S_LIP)
        p1 = (NOZ_X1, yc + np.sin(a1) * hh * NOZ_S_LIP, zc0 + np.cos(a1) * hw * NOZ_S_LIP)
        p2 = (NOZ_X_BACK, yc + np.sin(a1) * hh * NOZ_S_LIP, zc0 + np.cos(a1) * hw * NOZ_S_LIP)
        p3 = (NOZ_X_BACK, yc + np.sin(a0) * hh * NOZ_S_LIP, zc0 + np.cos(a0) * hw * NOZ_S_LIP)
        pb.face(p0, p1, p2, p3, GRAPH_D)
    # дно сопла — КРУГЛЫЙ диск по внутренней стенке (не квадрат: у квадрата
    # углы вылезали за круглое устье и читались тёмными обрезками)
    n = 14
    for k in range(n):
        a0 = 2 * np.pi * k / n + np.pi / n
        a1 = 2 * np.pi * (k + 1) / n + np.pi / n
        pb.tri((NOZ_X_BACK, yc, zc0),
               (NOZ_X_BACK, yc + np.sin(a0) * hh * NOZ_S_LIP,
                zc0 + np.cos(a0) * hw * NOZ_S_LIP),
               (NOZ_X_BACK, yc + np.sin(a1) * hh * NOZ_S_LIP,
                zc0 + np.cos(a1) * hw * NOZ_S_LIP), DARK)
    # решётка: металлические брусья ИМЕННО по границам проёмов
    _cells, (_y0, _z0, _gy, _gz, _sy, _sz) = grid_layout(hh, hw)
    xb = GRID_X + 0.022                       # брусья чуть впереди ячеек
    # КРУГЛОЕ устье: брусья обрезаются по окружности, иначе прямоугольная
    # решётка торчит из сопла (именно этот дефект и был виден).
    lip_y, lip_z = hh * NOZ_S_LIP, hw * NOZ_S_LIP
    for c in range(1, GRID_COLS):             # вертикальные
        zb = _z0 + c * _sz
        nz = zb / lip_z
        if abs(nz) >= 0.99:
            continue
        half = lip_y * np.sqrt(1.0 - nz * nz) * 0.98
        pb.box((xb, yc, zc0 + zb), (0.05, 2 * half, GRID_BAR), GRAPH)
    for r in range(1, GRID_ROWS):             # горизонтальные
        yb = _y0 + r * _sy
        ny = yb / lip_y
        if abs(ny) >= 0.99:
            continue
        half = lip_z * np.sqrt(1.0 - ny * ny) * 0.98
        pb.box((xb, yc + yb, zc0), (0.05, GRID_BAR, 2 * half), GRAPH)

    # (киль перенесён на палубу корпуса — см. rear_block: один центральный плавник)
    # --- панельные швы, люки, заклёпки по брусу
    for i, x in enumerate(np.arange(4.0, 27.0, 2.2)):
        w = float(np.interp(x, BX, BW))
        yt = float(np.interp(x, BX, BMT))
        yb = float(np.interp(x, BX, BMB))
        pb.box((x, yt + 0.02, z0), (1.9, 0.07, 2.0 * w * 0.92),
               GRAPH_H if i % 2 else GRAPH_L)
        pb.box((x, yb - 0.02, z0), (1.7, 0.07, 1.8 * w * 0.92), GRAPH_D)
        for sgnz in (-1, 1):
            pb.box((x, 5.52, z0 + sgnz * (w * 0.99)), (2.0, 0.62, 0.10), GRAPH_D)
            pb.box((x, 5.90, z0 + sgnz * (w * 0.94)), (1.5, 0.14, 0.12), GRAPH_L)
    for x in (8.0, 15.0, 22.0):
        w = float(np.interp(x, BX, BW))
        yt = float(np.interp(x, BX, BMT))
        pb.box((x, yt + 0.06, z0), (1.4, 0.06, w * 0.9), GRAPH_H)
        pb.box((x, yt + 0.10, z0 + sgn * w * 0.40), (0.9, 0.06, 0.30), SILVER_D * 0.9)
    # красная полоса ливреи у корня балки
    pb.box((5.2, float(np.interp(5.2, BX, BMT)) + 0.06, z0), (2.4, 0.10, 1.9), RED_L)
    pb.box((5.2, 5.52, z0 + sgn * float(np.interp(5.2, BX, BW)) * 0.99),
           (2.2, 0.70, 0.10), RED_L)
    # трафарет PEARCE на внешней стороне
    for k in range(6):
        pb.box((11.0 + k * 0.62, 5.95, z0 + sgn * float(np.interp(11.0, BX, BW)) * 0.99),
               (0.30, 0.30, 0.07), WHITE_D)

    # --- решётка теплоотвода и стыковочный узел
    for k in range(6):
        pb.box((17.0 + k * 0.62, float(np.interp(18.0, BX, BMT)) + 0.05, z0),
               (0.34, 0.08, 2.1), GRAPH_D if k % 2 else GRAPH)
    pb.box((2.6, 5.45, sgn * (BZ - 1.0)), (1.8, 1.90, 1.2), GRAPH_D)
    return pb


def gun_cluster(sgn):
    """Fixed hardpoint L под форштевнем: спарка стволов на пилоне."""
    pb = PB()
    pb.m = sgn
    z0 = sgn * 3.40
    yg = cyb(-24.0) - 0.55                     # ось стволов под днищем носа
    for dz in (-0.58, 0.58):
        pb.cyl(-24.6, yg, z0 + dz, 0.26, 5.6, axis='x', seg=10, color=DARK_M)
        pb.cyl(-21.8, yg, z0 + dz, 0.32, 0.6, axis='x', seg=10, color=GRAPH_D)
        pb.cyl(-21.5, yg, z0 + dz, 0.22, 0.6, axis='x', seg=10, color=BRONZE_L)
        pb.cyl(-25.7, yg, z0 + dz, 0.34, 1.2, axis='x', seg=10, color=GRAPH_L)
        for k in range(3):
            pb.box((-25.1 + k * 0.55, yg, z0 + dz), (0.18, 0.58, 0.58), GRAPH_D)
    pb.box((-22.9, yg + 0.36, z0), (1.6, 0.66, 1.9), GRAPH_L)
    pb.box((-21.2, yg + 0.78, z0), (1.1, 1.05, 1.1), GRAPH_D)
    return pb


def cm_pod(sgn):
    """Блок контрмер (CM L + CM M) на борту корпуса."""
    pb = PB()
    pb.m = sgn
    x = 2.0
    w = cw(x)
    pb.box((x, cyb(x) + 1.20, sgn * (w * 0.92)), (2.2, 0.66, 0.60), GRAPH_L)
    pb.box((x, cyb(x) + 1.20, sgn * (w * 0.96)), (1.8, 0.46, 0.38), GRAPH_D)
    for k in range(4):
        pb.cyl(x - 0.6 + k * 0.40, cyb(x) + 1.20, sgn * (w * 0.99), 0.12, 0.28,
               axis='z', seg=6, color=BRONZE_L)
    return pb


# ---------------------------------------------------------------- плоскости
def wing(sgn):
    """Лопасть-крыло: НИЗКО на борту и ближе к носу, свип назад-наружу.

    Корень сидит у нижней кромки борта в средней части корпуса, законцовка
    отведена в корму, наружу и вниз — как на маркет-рендере (там на конце
    горит циановая точка).
    """
    pb = PB()
    A = (-4.60, 3.86, 7.10)        # корень, ЗАДНЯЯ кромка
    B = (-10.20, 3.74, 7.30)       # корень, ПЕРЕДНЯЯ кромка
    C = (1.60, 3.02, 13.60)        # законцовка, передняя
    D = (4.80, 3.10, 14.10)        # законцовка, задняя
    quad_solid(pb, [A, B, C, D], 0.24, 0.22, GRAPH_L, GRAPH, GRAPH_D, sgn=sgn)
    pb.m = sgn

    # --- ливрея и мелочь садятся НА плоскость лопасти (билинейно по корню/концу)
    def at(t):
        """Точка на средней линии лопасти: t = 0 у корня, 1 у законцовки."""
        mx = (A[0] + B[0]) / 2.0 + ((C[0] + D[0]) / 2.0 - (A[0] + B[0]) / 2.0) * t
        my = (A[1] + B[1]) / 2.0 + ((C[1] + D[1]) / 2.0 - (A[1] + B[1]) / 2.0) * t
        mz = (A[2] + B[2]) / 2.0 + ((C[2] + D[2]) / 2.0 - (A[2] + B[2]) / 2.0) * t
        return mx, my, mz
    # красная полоса ливреи по передней кромке (вдоль корня)
    quad_solid(pb, [(A[0] + 0.05, A[1] + 0.26, A[2] + 0.06),
                    (B[0] - 0.15, B[1] + 0.26, B[2] + 0.06),
                    (B[0] - 0.15, B[1] + 0.26, B[2] + 0.52),
                    (A[0] + 0.05, A[1] + 0.26, A[2] + 0.52)],
               0.03, 0.0, RED_L, RED_D, RED_D, sgn=sgn)
    # панельный шов, лючок и второй шов — по плоскости лопасти
    for (t, sx, sz, col) in ((0.42, 3.40, 0.14, GRAPH_D),
                             (0.66, 1.90, 0.12, GRAPH_D)):
        x, y, z = at(t)
        pb.box((x, y + 0.20, sgn * z), (sx, 0.05, sz), col)
    x, y, z = at(0.16)
    pb.box((x, y + 0.26, sgn * z), (1.30, 0.05, 0.55), GRAPH_H)
    # законцовка: обойма и циановый огонь в кончике
    x, y, z = at(0.96)
    pb.box((x, y + 0.02, sgn * z), (1.30, 0.20, 0.36), GRAPH_D)
    pb.box((x + 0.60, y + 0.02, sgn * (z + 0.20)), (0.80, 0.14, 0.24), CYAN * 0.95)
    return pb


def canard(sgn):
    """Средняя наклонная плоскость (multiaxial articulation) — вниз и наружу.

    На виде сверху читается узкой полосой снаружи балки, на виде сбоку —
    качающейся консолью с шарниром, как на листе чертежа.
    """
    pb = PB()
    A = (-17.4, 5.35, 8.00)        # шарнир, передняя кромка
    B = (-11.2, 5.28, 8.10)        # шарнир, задняя кромка
    C = (-8.2, 1.60, 12.90)        # законцовка, задняя
    D = (-14.4, 1.70, 12.75)       # законцовка, передняя
    quad_solid(pb, [A, B, C, D], 0.24, 0.22, GRAPH_H, GRAPH, GRAPH, sgn=sgn)
    pb.m = sgn
    # белая полоса по передней кромке и красный кант
    pA = (A[0] + 0.45, A[1] + 0.30, A[2] + 0.18)
    pD = (D[0] + 0.35, D[1] + 0.30, D[2] + 0.14)
    qA = (A[0] + 1.35, A[1] + 0.30, A[2] + 0.18)
    qD = (D[0] + 1.15, D[1] + 0.30, D[2] + 0.14)
    quad_solid(pb, [pA, pD, qD, qA], 0.04, 0.0, GRAPH_H, GRAPH_L, GRAPH_D,
               sgn=sgn)
    pb.box((-12.8, 3.50, sgn * 10.9), (2.4, 0.16, 0.26), RED_L)
    # шарнирный узел на борту балки
    pb.cyl(-14.3, 5.32, sgn * 8.05, 0.86, 0.50, axis='z', seg=12, color=GRAPH_D)
    ring(pb, -14.3, 5.32, sgn * 8.05, 0.90, 0.62, 0.24, 12, GRAPH_L, GRAPH_D, axis='z')
    pb.box((-14.3, 5.32, sgn * 8.40), (1.6, 0.60, 0.24), GRAPH)
    # законцовка с АНО
    pb.box((-9.6, 1.82, sgn * 12.80), (1.8, 0.18, 0.36), GRAPH_D)
    pb.box((-9.5, 1.94, sgn * 12.84), (0.9, 0.12, 0.24),
           NAVGREEN if sgn > 0 else RED_L)
    return pb


def engine(sgn):
    """Шарнирный узел (multiaxial articulation) между корпусом и плоскостью."""
    pb = PB()
    pb.m = sgn
    x0, y0, z0 = 2.4, 6.10, sgn * 8.55
    pb.cyl(x0, y0, z0, 1.05, 1.30, axis='z', seg=12, color=GRAPH)
    ring(pb, x0, y0, z0, 1.10, 0.86, 0.38, 12, GRAPH_L, GRAPH_D, axis='z')
    pb.cyl(x0, y0, z0, 0.50, 1.52, axis='z', seg=10, color=GRAPH_D)
    pb.cyl(x0, y0, z0 + sgn * 0.80, 0.32, 0.14, axis='z', seg=8, color=RED_L)
    pb.cyl(x0, y0, z0 - sgn * 0.80, 0.32, 0.14, axis='z', seg=8, color=SILVER_D)
    pb.box((x0 - 1.3, y0, z0 - sgn * 0.35), (1.9, 0.90, 0.60), GRAPH_L)
    pb.box((x0 + 1.6, y0 + 0.10, z0 + sgn * 0.45), (2.1, 0.50, 0.70), GRAPH)
    for k in range(4):
        a = math.pi / 2 * k + math.pi / 4
        pb.box((x0 + math.cos(a) * 0.80, y0 + math.sin(a) * 0.80, z0 + sgn * 0.70),
               (0.22, 0.22, 0.18), GRAPH_D)
    return pb


# ---------------------------------------------------------------- кабина
def canopy():
    pb = PB()
    # наклонный лобовой лист перед фонарём
    # лобовой лист стоит НА палубе (cyt + 0.32 — над бронеплитами), а не
    # утоплен в неё: кромка стекла реально лежит на металле
    pb.face((-19.6, cyt(-19.0) + 0.32, -1.50), (-19.6, cyt(-19.0) + 0.32, 1.50),
            (-18.2, hump_top(-18.2) - 0.20, 1.30), (-18.2, hump_top(-18.2) - 0.20, -1.30),
            GRAPH_L)
    dome(pb, CAN_ST, hump_top, lambda x: 0.70 * ch_w(x), 0.94,
         GLASS_L * 0.34, GRAPH_D, sink=0.14)
    # красный кант по кромке фонаря
    for sgn in (-1, 1):
        pb.box((-12.6, hump_top(-12.6) + 0.88, sgn * 0.34), (5.6, 0.06, 0.14), RED_L)
    # рама и приборные панели
    for sgn in (-1, 1):
        for k in range(3):
            x = CAN_ST[0] + (CAN_ST[-1] - CAN_ST[0]) * (k + 0.5) / 3.0
            pb.box((x, hump_top(x) + 0.34, sgn * (0.46 * ch_w(x))),
                   (0.16, 0.16, 0.34), GRAPH_D)
        pb.box((-15.0, hump_top(-15.0) + 0.20, sgn * 0.85), (2.4, 0.14, 0.42), GRAPH_L)
    return pb


# ---------------------------------------------------------------- корма
def rear_block():
    """Кормовая палуба между балками: радиаторы, жалюзи, ферма, дюзы."""
    pb = PB()
    # решётка PULSE DRIVE на палубе
    pb.box((8.0, cyt(8.0) + 0.03, 0.0), (5.6, 0.08, 4.0), GRAPH_L)
    for k in range(9):
        x = 5.4 + k * 0.60
        pb.box((x, cyt(x) + 0.07, 0.0), (0.26, 0.07, 3.6), GRAPH_H if k % 2 else GRAPH)
    for sgn in (-1, 1):
        pb.box((8.0, cyt(8.0) + 0.09, sgn * 1.95), (5.6, 0.10, 0.22), GRAPH_D)
        pb.box((8.0, cyt(8.0) + 0.10, sgn * 1.70), (5.0, 0.05, 0.10), CYAN * 0.65)

    # люк ESCAPE POD перед решёткой
    pb.box((1.2, cyt(1.2) + 0.07, 0.0), (2.8, 0.10, 2.2), GRAPH_L)
    pb.box((1.2, cyt(1.2) + 0.12, 0.0), (2.2, 0.06, 1.7), GRAPH_D)

    # (верхняя плита с жалюзи и «закрылки» на палубе убраны по замечанию)

    # (центральный киль-«хвост» убран: на чертеже его нет, корму
    #  держат большие кормовые лопасти-крылья)
    return pb


def missile_bay():
    """Large missile bay на палубе за кабиной."""
    pb = PB()
    x0, x1 = -3.6, 3.0
    y = cyt(-0.4) + 0.02
    pb.box((-0.3, y - 0.34, 0.0), (6.2, 0.40, 4.0), DARK)
    pb.box((-0.3, y + 0.02, 0.0), (6.6, 0.16, 4.4), GRAPH_D)
    for sgn in (-1, 1):
        pb.box((-0.3, y + 0.10, sgn * 2.16), (6.6, 0.18, 0.24), SILVER_D)
    pb.box((x0 + 0.1, y + 0.10, 0.0), (0.24, 0.18, 4.4), SILVER_D)
    pb.box((x1 - 0.1, y + 0.10, 0.0), (0.24, 0.18, 4.4), SILVER_D)
    for k in range(3):
        pb.box((-2.4 + k * 2.1, y + 0.10, 0.0), (0.18, 0.16, 4.0), GRAPH_D)
    for dz in (-1.05, 1.05):
        for dx in (-0.8, 0.8):
            x = -0.3 + dx
            pb.cyl(x, y - 0.14, dz, 0.28, 5.0, axis='x', seg=8, color=GRAPH_L)
            pb.cyl(x - 2.3, y - 0.14, dz, 0.24, 0.5, axis='x', seg=8, color=RED * 0.9)
            for k in range(4):
                a = math.pi / 2 * k
                pb.box((x - 1.1, y - 0.14 + math.sin(a) * 0.28, dz + math.cos(a) * 0.28),
                       (1.3, 0.09, 0.11), SILVER_D)
    return pb


def missile_lid(sgn):
    """Створка ракетного отсека на палубе (bay_lid_r/_l)."""
    pb = PB()
    pb.m = sgn
    pb.box((0.0, 0.0, sgn * 1.15), (6.4, 0.22, 2.30), GRAPH_L)
    pb.box((0.0, 0.12, sgn * 1.15), (6.0, 0.08, 2.00), GRAPH_H)
    pb.box((0.0, 0.16, sgn * 0.40), (5.4, 0.08, 0.40), GRAPH_D)
    for k in range(4):
        pb.box((-2.3 + k * 1.5, 0.14, sgn * 1.95), (0.28, 0.10, 0.30), SILVER_D)
    pb.box((0.0, 0.14, sgn * 2.20), (6.2, 0.10, 0.16), RED_D)
    return pb



# ---------------------------------------------------------------- груз
BAY_X0, BAY_X1 = 11.30, 15.40       # грузовой отсек над проёмом в днище
BAY_W = 2.24                        # полуширина отсека
BAY_FLOOR = 3.72                    # плоскость днища = плоскость крышки
BAY_CEIL = 6.05                     # потолок отсека
RAMP_L = 2.28                       # высота полотна аппарели (притолока→порог)
RAMP_TOP = 3.72                     # Y петли в пороге (плоскость днища)
RAMP_HINGE_X = 15.25                # X петли (плоскость кормового среза)
RAMP_EXT_L = 2.25                   # выдвижная ступень (телескоп), м
HATCH_OPEN = 148.0                  # из вертикали: 148° → трап на палубу позади


def cargo_bay():
    """Грузовой отсек над кормовым проёмом в днище: стены, потолок, свет."""
    pb = PB()
    xm = (BAY_X0 + BAY_X1) / 2.0
    L = BAY_X1 - BAY_X0
    for sgn in (-1, 1):
        pb.box((xm, (BAY_FLOOR + BAY_CEIL) / 2, sgn * (BAY_W + 0.09)),
               (L, BAY_CEIL - BAY_FLOOR, 0.18), GRAPH_D)
        for k in range(4):
            x = BAY_X0 + 0.7 + k * (L - 1.4) / 3.0
            pb.box((x, (BAY_FLOOR + BAY_CEIL) / 2, sgn * (BAY_W - 0.05)),
                   (0.24, BAY_CEIL - BAY_FLOOR - 0.10, 0.12), GRAPH_L)
            pb.box((x, BAY_CEIL - 0.34, sgn * (BAY_W - 0.03)), (0.16, 0.16, 0.10),
                   SILVER_D * 0.8)
        pb.box((xm, BAY_CEIL - 0.28, sgn * (BAY_W - 0.02)), (L - 0.5, 0.09, 0.06),
               CYAN * 0.55)
        # направляющие рельсы груза по бортам
        pb.box((xm, BAY_FLOOR + 0.16, sgn * (BAY_W - 0.34)), (L - 0.6, 0.12, 0.18), GRAPH_H)
    # потолок с лампами
    pb.box((xm, BAY_CEIL + 0.10, 0.0), (L, 0.20, 2 * BAY_W + 0.34), GRAPH_D)
    for k in range(4):
        x = BAY_X0 + 0.9 + k * 0.95
        pb.box((x, BAY_CEIL - 0.02, 0.0), (0.42, 0.07, 2.10), CYAN * 0.95)
    # передняя переборка отсека
    pb.box((BAY_X0 + 0.10, (BAY_FLOOR + BAY_CEIL) / 2, 0.0),
           (0.20, BAY_CEIL - BAY_FLOOR, 2 * BAY_W + 0.30), GRAPH_D)
    pb.box((BAY_X0 + 0.24, BAY_FLOOR + 1.15, 0.0), (0.12, 2.20, 1.50), DARK)
    for sgn in (-1, 1):
        pb.box((BAY_X0 + 0.26, BAY_FLOOR + 1.15, sgn * 0.82), (0.10, 2.30, 0.16),
               SILVER_D * 0.8)
    # кормовая стенка отсека (за ней — кормовой обрез корпуса)
    pb.box((BAY_X1 - 0.10, (BAY_FLOOR + BAY_CEIL) / 2, 0.0),
           (0.16, BAY_CEIL - BAY_FLOOR, 2 * BAY_W + 0.20), GRAPH_L)
    return pb


def ramp(sgn):
    """Кормовая аппарель на петле в ПОРОГЕ кормового проёма.

    Локальный ноль — петля (x = RAMP_HINGE_X, y = RAMP_TOP). Полотно растёт
    вверх (+Y): закрытая поза — вертикально, заподлицо в проёме, снаружи
    видна его НАРУЖНАЯ сторона (+X) — дверь с настилом и ливреей.
    Раскрытие HATCH_OPEN (148°) переводит полотно вниз-назад: наружная
    сторона с настилом смотрит ВВЕРХ — по трапу идут, как по настилу.
    """
    pb = PB()
    pb.m = sgn
    zc = sgn * BAY_W / 2.0
    d = 0.14                     # наружная сторона полотна (смотрит в корму)
    # силовая плита полотна
    pb.box((0.0, RAMP_L / 2, zc), (0.26, RAMP_L, BAY_W), GRAPH_L)
    pb.box((d, RAMP_L / 2, zc), (0.06, RAMP_L - 0.20, BAY_W - 0.24), GRAPH_H)
    # настил на наружной стороне: поперечные ступени + продольные рёбра
    for k in range(9):
        y = 0.34 + k * (RAMP_L - 0.70) / 8.0
        pb.box((d + 0.04, y, zc), (0.09, 0.14, BAY_W - 0.36), SILVER_D)
    for sz in (-1, 1):
        pb.box((d + 0.02, RAMP_L / 2, zc + sz * (BAY_W / 2 - 0.14)),
               (0.20, RAMP_L - 0.12, 0.24), GRAPH_D)
    # петля в пороге и пятка-упор у притолоки
    pb.cyl(0.0, 0.0, zc, 0.17, BAY_W - 0.06, axis='z', seg=10, color=GRAPH_D)
    pb.box((0.0, RAMP_L - 0.20, zc), (0.30, 0.40, BAY_W - 0.32), GRAPH_D)
    pb.box((d + 0.02, RAMP_L - 0.20, zc), (0.10, 0.20, BAY_W - 0.54), SILVER_D * 0.8)
    # ливрея на наружной стороне: красная полоса, трафарет PEARCE, циановая кромка
    pb.box((d + 0.04, 1.02, zc), (0.05, 1.15, 0.28), RED_L)
    for k in range(6):
        pb.box((d + 0.04, 0.42 + k * 0.26, zc + sgn * 0.62), (0.05, 0.13, 0.26),
               WHITE_D)
    pb.box((d + 0.05, 0.10, zc), (0.06, 0.16, BAY_W - 0.68), CYAN_D)
    # ответная планка замка по центру стыка двух полотен
    pb.box((d - 0.02, RAMP_L * 0.62, zc - sgn * 0.06), (0.10, 0.70, 0.16), GRAPH_D)
    return pb


def ramp_ext(sgn):
    """Выдвижная часть трапа (телескоп).

    Локальный ноль — та же петля (RAMP_HINGE_X, RAMP_TOP). В покое ступень
    убрана: она лежит ЗА полотном внутри проёма и не видна снаружи.
    При раскрытии выезжает вдоль полотна на RAMP_EXT_L и достаёт до палубы.
    """
    pb = PB()
    m = sgn
    zc = sgn * BAY_W / 2.0
    w = BAY_W - 0.38
    # корпус ступени идёт ЗА полотном (x < -0.17), чтобы в покое быть скрытым
    pb.box((-0.27, RAMP_EXT_L / 2, zc), (0.18, RAMP_EXT_L, w), GRAPH_L)
    # продольные рёбра жёсткости
    for sz in (-1, 1):
        pb.box((-0.37, RAMP_EXT_L / 2, zc + sz * (w / 2 - 0.10)),
               (0.08, RAMP_EXT_L - 0.14, 0.16), GRAPH_D)
    # настил: поперечные ступени
    for k in range(7):
        y = 0.22 + k * (RAMP_EXT_L - 0.44) / 6.0
        pb.box((-0.34, y, zc), (0.06, 0.11, w - 0.16), SILVER_D)
    # пятка, ложащаяся на палубу
    pb.box((-0.28, RAMP_EXT_L - 0.12, zc), (0.18, 0.24, w - 0.10), GRAPH_D)
    pb.box((-0.40, 0.16, zc), (0.05, 0.10, w - 0.40), CYAN_D)
    return pb


def thrusters():
    """Свечение маршевых сопел: ячейки РОВНО в проёмах решётки.

    Одна раскладка с металлом (grid_layout), отсечение по КРУГУ устья:
    ячейка рисуется, только если её внешний угол внутри окружности губы.
    """
    pb = PB()
    yc0, hh0, hw0 = nozzle_frame()
    lip_y, lip_z = hh0 * NOZ_S_LIP, hw0 * NOZ_S_LIP
    for sgn in (-1, 1):
        zc0 = sgn * BZ
        cells, _geo = grid_layout(hh0, hw0)
        for (cy, cz, sy_c, sz_c, r, c) in cells:
            # маска ПО ЦЕНТРУ ячейки: край получается ровным эллипсом, без
            # одиночных «шипов» на осях
            ny = cy / lip_y
            nz = cz / lip_z
            if (ny * ny + nz * nz) ** 0.5 > 0.82:
                continue
            ry = abs(r + 0.5 - GRID_ROWS / 2.0) / (GRID_ROWS / 2.0)
            rz = abs(c + 0.5 - GRID_COLS / 2.0) / (GRID_COLS / 2.0)
            k = 1.0 - 0.50 * (ry + rz)
            col = CYAN * (0.55 + 0.75 * k) if k > 0.45 else CYAN_D * 1.05
            pb.box((GRID_X, yc0 + cy, zc0 + cz), (0.02, sy_c, sz_c), col)
        # маневровые дудки по борту балки
        for (x, y, z) in ((-6.0, 5.20, sgn * 5.4), (10.0, 5.30, sgn * 5.8)):
            pb.cyl(x, y, z, 0.32, 0.32, axis='z', seg=8, color=DARK_M)
            pb.cyl(x, y, z + sgn * 0.20, 0.22, 0.10, axis='z', seg=8, color=CYAN_D)
    return pb


def scanner():
    """Блок датчиков (Scanner Array M) на палубе перед кабиной."""
    pb = PB()
    x, y = -23.0, cyt(-23.0)
    pb.box((x, y + 0.18, 0.0), (1.8, 0.28, 2.8), GRAPH_L)
    pb.box((x, y + 0.34, 0.0), (1.3, 0.10, 2.2), GRAPH_D)
    for sgn in (-1, 1):
        pb.cyl(x, y + 0.50, sgn * 0.8, 0.40, 0.32, axis='y', seg=10, color=GRAPH_H)
        pb.cyl(x, y + 0.66, sgn * 0.8, 0.28, 0.10, axis='y', seg=10, color=CYAN_D)
    return pb


def greebles():
    """Мелочь: магистрали, люки, поручни, антенны, стяжки — ВСЁ на обшивке."""
    pb = PB()
    for sgn in (-1, 1):
        # --- магистрали по борту: короткие сегменты, каждый по своему сечению
        side_run(pb, -26.0, -2.0, cyb(-14.0) + 0.80, 0.12, BRONZE_L, sgn=sgn)
        side_run(pb, -22.0, 2.0, cyb(-10.0) + 1.35, 0.08, BRONZE, sgn=sgn)
        # --- магистраль по палубе балки (а не в воздухе сбоку)
        n = 13
        for i in range(n):
            x = 3.2 + i * 1.55
            if x > 27.0:
                break
            boom_box(pb, x, -0.62 * float(np.interp(x, BX, BW)) + 0.34,
                     1.42, 0.10, 0.16, BRONZE_L, sgn=sgn, out=0.09)
        # --- поручни на палубе
        for x in (-22.0, -19.0, 4.0, 9.0):
            deck_box(pb, x, sgn * (0.42 * cw(x)), 1.6, 0.10, 0.12, SILVER_D, out=0.14)
        # --- люки обслуживания на бортах
        for x in (-22.0, -12.0, -2.0, 6.0):
            side_box(pb, x, cyb(x) + 0.78, 1.6, 0.56, 0.14, GRAPH_L, sgn=sgn, out=0.09)
            side_box(pb, x, cyb(x) + 0.78, 1.2, 0.38, 0.10, GRAPH_D, sgn=sgn, out=0.12)
        # --- стяжки фермы под днищем (в пределах плоской части днища)
        for k in range(3):
            x = 2.0 + k * 3.2
            belly_box(pb, x, sgn * 3.0, 2.2, 0.16, 0.24, GRAPH_D, out=0.10)
            belly_box(pb, x, sgn * 2.2, 0.20, 0.16, 1.6, GRAPH_D, out=0.10)
    # антенны (низкие, без шпилей) — парами для симметрии, на палубе
    for (x, z) in ((-24.4, 2.6), (-24.4, -2.6), (9.0, 2.6), (9.0, -2.6)):
        deck_box(pb, x, z, 0.46, 0.22, 0.46, GRAPH_D, out=0.14)
        pb.cyl(x, deck_y(x) + 0.14 + 0.17, z, 0.055, 0.34, axis='y', seg=6, color=SILVER_D)
    return pb


def decals():
    """Трафареты, «шевроны» PEARCE и циановые полосы ливреи — по обшивке."""
    pb = PB()
    for sgn in (-1, 1):
        # подпись PEARCE на борту форштевня планками (каждая — по своему сечению)
        for k in range(6):
            x = -22.4 + k * 0.62
            side_box(pb, x, cyb(x) + 1.05, 0.30, 0.30, 0.07, WHITE_D, sgn=sgn, out=0.07)
        # красные полосы ливреи по борту
        side_run_box(pb, -17.8, -14.2, cyb(-16.0) + 1.05, 0.16, 0.16, 0.08, RED_L, sgn=sgn)
        side_run_box(pb, -17.8, -14.2, cyb(-16.0) + 0.72, 0.16, 0.10, 0.08, RED_D, sgn=sgn)
        # циановая подсветка борта
        side_run_box(pb, -8.5, -3.5, cyb(-6.0) + 1.25, 0.14, 0.10, 0.08, CYAN * 0.75, sgn=sgn)
        # технадписи на палубе
        for k in range(5):
            deck_box(pb, -9.0 + k * 0.5, sgn * 1.4, 0.24, 0.05, 0.66,
                     GRAPH_D * 0.8, out=0.05)
    return pb


def lights():
    """Прожекторы, габариты, подсветка отсека — всё посажено на поверхность."""
    pb = PB()
    for sgn in (-1, 1):
        pb.cyl(-23.0, cyb(-23.0) - 0.06, sgn * 2.4, 0.24, 0.16, axis='y', seg=8,
               color=AMBER * 0.9)
        for x in (-12.0, 0.0, 8.0):
            deck_box(pb, x, sgn * 0.85, 0.32, 0.10, 0.32, AMBER * 0.8, out=0.10)
        deck_run(pb, -1.9, 1.3, sgn * 1.7, 0.14, 0.10, CYAN * 0.85, seg=1.0, out=0.08)
    return pb


def beacon():
    """Красные стробы: на палубах двигательных балок и на палубе корпуса."""
    pb = PB()
    for sgn in (-1, 1):
        bx = 13.6
        boom_box(pb, bx, 0.0, 0.36, 0.18, 0.36, RED_L, sgn=sgn, out=0.10)
        pb.cyl(bx, boom_top_y(bx) + 0.10 + 0.09, sgn * BZ, 0.18, 0.18,
               axis='y', seg=8, color=RED_L)
    pb.cyl(8.0, deck_y(8.0) + 0.09, 0.0, 0.20, 0.18, axis='y', seg=8, color=RED_L)
    pb.box((8.0, deck_y(8.0) + 0.04, 0.0), (0.44, 0.10, 0.44), GRAPH_D)
    return pb


def leg(i):
    """Стойка шасси: локальный ноль — пятно контакта на Y = 0."""
    x, z = LEGS[i]
    pb = PB()
    h = cyb(x) - 0.12
    pb.box((0.0, 0.09, 0.0), (1.35, 0.18, 1.35), GRAPH_L)
    pb.box((0.0, 0.02, 0.0), (1.0, 0.14, 1.0), GRAPH_D)
    pb.box((0.0, 0.19, 0.0), (0.62, 0.10, 0.62), GRAPH)
    pb.seg((0.0, 0.22, 0.0), (0.0, h * 0.56, 0.0), 0.34, 0.34, GRAPH_H)
    pb.cyl(0.0, h * 0.56, 0.0, 0.26, 0.66, axis='z', seg=8, color=SILVER_D)
    pb.seg((0.0, h * 0.56, 0.0), (0.0, h, 0.0), 0.28, 0.28, GRAPH_L)
    pb.seg((0.0, 0.36, 0.0), (-0.95, h * 0.94, 0.0), 0.16, 0.16, GRAPH_D)
    pb.seg((0.0, 0.36, 0.0), (0.95, h * 0.94, 0.0), 0.16, 0.16, GRAPH_D)
    pb.cyl(0.0, 0.24, 0.62, 0.16, 0.20, axis='y', seg=8, color=AMBER * 0.75)
    return pb


# ---------------------------------------------------------------- сборка
def _pt_tri_dist(P, tri):
    """Мин. расстояние от точек P (N,3) до треугольников tri (M,3,3)."""
    P = np.asarray(P, np.float64)
    best = np.full(len(P), 1e9)
    for k in range(0, len(tri), 128):
        A = np.asarray(tri[k:k + 128, 0], np.float64)[:, None, :]
        B = np.asarray(tri[k:k + 128, 1], np.float64)[:, None, :]
        C = np.asarray(tri[k:k + 128, 2], np.float64)[:, None, :]
        p = P[None, :, :]
        ab, ac, ap = B - A, C - A, p - A
        d1 = (ab * ap).sum(-1); d2 = (ac * ap).sum(-1)
        bp = p - B
        d3 = (ab * bp).sum(-1); d4 = (ac * bp).sum(-1)
        cp = p - C
        d5 = (ab * cp).sum(-1); d6 = (ac * cp).sum(-1)
        va = d3 * d6 - d5 * d4
        vb = d5 * d2 - d1 * d6
        vc = d1 * d4 - d3 * d2
        den = va + vb + vc
        den = np.where(np.abs(den) < 1e-14, 1e-14, den)
        q = A + ab * (vb / den)[..., None] + ac * (vc / den)[..., None]
        # края и вершины (уточняем по регионам)
        t = np.clip(d1 / np.maximum((ab * ab).sum(-1), 1e-14), 0.0, 1.0)
        q = np.where(((vc <= 0) & (d1 >= 0) & (d3 <= 0))[..., None],
                     A + ab * t[..., None], q)
        t = np.clip(d2 / np.maximum((ac * ac).sum(-1), 1e-14), 0.0, 1.0)
        q = np.where(((vb <= 0) & (d2 >= 0) & (d6 <= 0))[..., None],
                     A + ac * t[..., None], q)
        t = np.clip((d4 - d3) / np.maximum(((ac - ab) ** 2).sum(-1), 1e-14), 0.0, 1.0)
        q = np.where(((va <= 0) & (d4 - d3 >= 0) & (d5 - d6 >= 0))[..., None],
                     B + (C - B) * t[..., None], q)
        q = np.where(((d1 <= 0) & (d2 <= 0))[..., None], A, q)
        q = np.where(((d3 >= 0) & (d4 <= d3))[..., None], B, q)
        q = np.where(((d6 >= 0) & (d5 <= d6))[..., None], C, q)
        best = np.minimum(best, np.sqrt(((p - q) ** 2).sum(-1)).min(0))
    return best


def contact_check(details, hulls, tol_max=0.50, tol_min=0.03, quiet=False):
    """Каждая вершина декора должна лежать НА обшивке, а не в воздухе.

    details — {имя: pb}, hulls — список pb корпусных деталей.
    tol_min: хотя бы одна вершина детали касается обшивки (<= tol_min)
    tol_max: ни одна вершина не удалена от обшивки дальше tol_max
    """
    tris = []
    for pb in hulls:
        v, t, c = pb.get()
        V = np.asarray(v, np.float64)
        T = np.asarray(t, np.int32)
        tris.append(V[T])
    tri = np.concatenate(tris, axis=0)
    bad = []
    for name, item in details.items():
        pb, opt = item if isinstance(item, tuple) else (item, {})
        v, t, c = pb.get()
        P = np.asarray(v, np.float64)
        if not len(P):
            continue
        if opt.get('zmax') is not None:            # проверяем только корень
            P = P[np.abs(P[:, 2]) <= opt['zmax']]
        tmax = opt.get('tol_max', tol_max)
        tmin = opt.get('tol_min', tol_min)
        d = _pt_tri_dist(P, tri)
        if not quiet:
            print('  декор %-10s вершин %4d  до обшивки: мин %.2f  макс %.2f'
                  % (name, len(P), d.min(), d.max()))
        if d.min() > tmin:
            bad.append('%s висит в воздухе (мин %.2f м)' % (name, d.min()))
        if d.max() > tmax:
            bad.append('%s торчит от обшивки (макс %.2f м)' % (name, d.max()))
    return bad


def merge_pb(dst, src):
    """Слить готовую геометрию src в dst (цвета посчитаны и проверены)."""
    v, t, c = src.get()
    if not len(v):
        return dst
    base = len(dst.V)
    dst.V.extend(v.tolist())
    dst.C.extend(c.tolist())
    dst.T.extend((np.asarray(t, np.int64) + base).tolist())
    for _ in range(len(t)):
        dst.TC.append(np.zeros(3))
        dst.TM.append(1.0)
        dst.PRE.append(True)
    return dst


def main():
    b = GlbBuilder()
    m_hull = b.material('pf4_hull', metallic=0.66, roughness=0.40)
    m_dark = b.material('pf4_dark', metallic=0.74, roughness=0.32)
    m_glass = b.material('pf4_glass', metallic=0.14, roughness=0.12)
    m_glow = b.material('pf4_glow', metallic=0.0, roughness=0.26)
    m_thrust = b.material('pf4_thrust', metallic=0.0, roughness=0.20)

    stats = {}
    tris = 0

    REF = {}

    def add(name, pb, mat, pos=None, kind=None):
        nonlocal tris
        REF[name] = pb
        v, t, c = pb.get()
        idx = b.mesh(name, v, t, c, mat)
        b.node(name, idx, translation=pos)
        stats[name] = (len(v), len(t))
        tris += len(t)
        if kind:
            check(pb, kind, off=pos or (0, 0, 0))

    skin = hull_skin()
    trim = hull_trim()
    ch = skin
    merge_pb(ch, trim)
    leg_pads(ch)
    add('center_hull', ch, m_hull, kind='hull')

    for sgn in (1, -1):
        tag = 'r' if sgn > 0 else 'l'
        add('boom_' + tag, engine_boom(sgn), m_hull, kind='hull')
        add('engine_' + tag, engine(sgn), m_dark, kind='hull')
        add('gun_' + tag, gun_cluster(sgn), m_hull, pos=[0.0, 0.0, 0.0], kind='gun' + tag)
        add('wing_' + tag, wing(sgn), m_hull, kind='hull')
        add('cm_pod_' + tag, cm_pod(sgn), m_hull, kind='hull')
        add('bay_lid_' + tag, missile_lid(sgn), m_hull,
            pos=[-0.3, cyt(-0.4) + 0.14, sgn * 2.08], kind='lid' + tag)
        add('bay_door_' + tag, ramp(sgn), m_hull,
            pos=[RAMP_HINGE_X, RAMP_TOP, 0.0], kind='ramp' + tag)
        add('ramp_ext_' + tag, ramp_ext(sgn), m_hull,
            pos=[RAMP_HINGE_X, RAMP_TOP, 0.0], kind='ramp' + tag)

    cp = canopy()
    glass_check('canopy', cp, CAN_ST, hump_top, lambda x: 0.95 * ch_w(x), tol_out=0.05)
    add('canopy', cp, m_glass, kind='canopy')

    add('cargo_bay', cargo_bay(), m_hull, kind='hull')
    add('rear_block', rear_block(), m_hull, kind='hull')
    add('missile_bay', missile_bay(), m_hull, kind='hull')
    _thr = thrusters()
    THR_V = np.array(_thr.V, np.float32).reshape(-1, 3)
    add('thrusters', _thr, m_thrust)
    add('scanner', scanner(), m_hull, kind='hull')
    _gr, _dc, _li, _bc = greebles(), decals(), lights(), beacon()
    add('greebles', _gr, m_hull, kind='hull')
    add('decals', _dc, m_glow)
    add('lights', _li, m_glow)
    add('beacon', _bc, m_glow)
    for i in range(len(LEGS)):
        add('leg_%d' % i, leg(i), m_hull, pos=[LEGS[i][0], PAD_BOT[i], LEGS[i][1]])

    # --- проверка посадки свечения в устье сопла (по числам, не «на глаз»)
    _yc, _hh, _hw = nozzle_frame()
    for sgn in (-1, 1):
        zc0 = sgn * BZ
        for (vx, vy, vz) in [_v for _v in THR_V
                             if _v[0] > BX_END - 0.5 and sgn * _v[2] > 0.0]:
            dy = (vy - _yc) / (_hh * NOZ_S_LIP)
            dz = (vz - zc0) / (_hw * NOZ_S_LIP)
            rad = (dy * dy + dz * dz) ** 0.5
            if rad > 0.97:
                raise SystemExit('свечение вылезает за КРУГ устья: r %.2f' % rad)
            if vx > NOZ_X1 + 1e-6:
                raise SystemExit('свечение торчит из устья наружу: x %.2f' % vx)
    print('  посадка сопла: решётка внутри устья (%.0f%% сечения), утоплена на %.2f м'
          % (GRID_S * 100, NOZ_X1 - GRID_X))

    # ---------------- ориентация граней (чтобы ничего не «просвечивало») ---
    flip = sum(1 for _ in ())
    print('ориентация граней: всё наружу (PB.get чинит вывернутые куски)')

    data = b.build('pearce_f4')
    open(os.path.join(P, 'pearce_f4.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-14s verts %5d tris %5d' % (k, nv, nt))

    modes = {
        'pad':    {'legs': 1.0, 'guns': 0.0, 'bay': 0.0, 'lid': 0.0, 'thrust': 0.0,
                   'strobe': 0.30, 'spots': 0.45, 'interior': 0.45},
        'flight': {'legs': 0.0, 'guns': 0.0, 'bay': 0.0, 'lid': 0.0, 'thrust': 0.78,
                   'strobe': 0.55, 'spots': 1.0, 'interior': 0.55},
        'hunt':   {'legs': 0.0, 'guns': 1.0, 'bay': 0.0, 'lid': 1.0, 'thrust': 0.95,
                   'strobe': 1.0, 'spots': 1.0, 'interior': 0.70},
        'load':   {'legs': 1.0, 'guns': 0.0, 'bay': 1.0, 'lid': 0.0, 'thrust': 0.0,
                   'strobe': 0.40, 'spots': 0.85, 'interior': 1.0},
    }
    json.dump({'pods': 2, 'guns': 2, 'legs': len(LEGS), 'barrels_per_pod': 2,
               'gun_elev_deg': 14.0, 'bay_open_deg': 78.0, 'ramp_open_deg': HATCH_OPEN,
               'ramp_ext_len': RAMP_EXT_L,
               'leg_retract': 2.0,
               'modes': modes, 'dims': {'L': L, 'W': W, 'H': H}},
              open(os.path.join(P, 'modes.json'), 'w'), indent=1)
    print('modes.json')

    # ---------------- габарит и пересечения ----------------
    xmin = min(c[0] for c in CHECK); xmax = max(c[1] for c in CHECK)
    ymin = min(c[2] for c in CHECK); ymax = max(c[3] for c in CHECK)
    zmin = min(c[4] for c in CHECK); zmax = max(c[5] for c in CHECK)
    print('габарит: %.1f x %.1f x %.1f м' % (xmax - xmin, ymax - ymin, zmax - zmin))
    bad = []
    if xmin < -HX - 0.6 or xmax > HX + 0.6:
        bad.append('длина')
    if zmin < -HZ - 0.4 or zmax > HZ + 0.4:
        bad.append('ширина')
    if ymin < -0.2 or ymax > H + 0.4:
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

    # ---------------- декор обязан ЛЕЖАТЬ на обшивке ----------------
    float_bad = contact_check(
        {'greebles': _gr, 'decals': _dc, 'lights': _li, 'beacon': _bc,
         'hull_trim': (trim, {'tol_max': 0.45}),
         'wing_r': (REF['wing_r'], {'zmax': 9.0, 'tol_max': 0.65}),
         'wing_l': (REF['wing_l'], {'zmax': 9.0, 'tol_max': 0.65})},
        [skin, REF['boom_r'], REF['boom_l'], REF['engine_r'], REF['engine_l'],
         REF['rear_block'], REF['cargo_bay'], REF['missile_bay']])
    print('посадка декора на обшивку: %s' % ('OK' if not float_bad else float_bad))
    if float_bad:
        raise SystemExit('декор не лежит на корпусе: ' + '; '.join(float_bad))

    # ---------------- контроль по записанному файлу ----------------
    raw = open(os.path.join(P, 'pearce_f4.glb'), 'rb').read()
    import struct
    off = 12
    jl = struct.unpack('<I', raw[off:off + 4])[0]
    g = json.loads(raw[off + 8:off + 8 + jl])
    bb = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]]
    for node in g['nodes']:
        if 'mesh' not in node:
            continue
        a = g['accessors'][g['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']]
        t = node.get('translation', [0, 0, 0])
        for k in range(3):
            bb[0][k] = min(bb[0][k], a['min'][k] + t[k])
            bb[1][k] = max(bb[1][k], a['max'][k] + t[k])
    print('по файлу GLB: %.1f x %.1f x %.1f м (x[%.1f..%.1f] y[%.1f..%.1f] z[%.1f..%.1f])'
          % (bb[1][0] - bb[0][0], bb[1][1] - bb[0][1], bb[1][2] - bb[0][2],
             bb[0][0], bb[1][0], bb[0][1], bb[1][1], bb[0][2], bb[1][2]))
    if bb[1][0] - bb[0][0] > L + 1.2 or bb[1][2] - bb[0][2] > W + 0.8:
        raise SystemExit('GLB envelope broken')
    print('geometry: OK')


if __name__ == '__main__':
    main()
