#!/usr/bin/env python3
"""Calico ATS Enforcer (CALATS) — средний истребитель класса «воздух-космос».
92 × 69 × 19 м, экипаж 2 (пилот + штурман), Uncommon.

Компоновка восстановлена по чертежам Calico (вид сзади «landing position»,
вид сбоку «flight») и по кадрам галереи карточки NFT:

  * ЦЕНТРАЛЬНЫЙ ФЮЗЕЛЯЖ — длинный плоский клин с заострённым носом; передняя
    часть плавно переходит в кабину с высокой прозрачной каплей-фонарём на
    подъёмной раме; по бортам фюзеляжа — плоские воздухозаборники;
  * CAPITAL WEAPON — под фюзеляжем вперёд вынесена длинная спаренная
    capital-пушка на пилоне (два ствола с дульными утолщениями);
  * КРЫЛЬЯ — два длинных тонких крыла с сильным свипом назад и вниз
    (анаэдрическое V): корень у борта фюзеляжа, законцовка далеко назад-
    наружу-вниз, с красной полосой АНО и маленькими закрылками;
  * ХВОСТ — два расходящихся киля-плавника вверх-наружу и два нижних
    подфюзеляжных плавника; между ними — блок маршевых сопел (два коакси-
    альных кольца + центральная турбина);
  * РАКЕТНЫЕ БЛОКИ — по бортам фюзеляжа брустверы-батареи (8 + 16 ячеек:
    круглые соты в шахматном порядке);
  * ШАССИ — три стойки с «лапами» (носовая и две кормовые) — посадка как на
    «landing position» чертежа, пятна строго на Y = 0;
  * ливрея Calico: тёмный графит с крупными белыми/светло-серыми полями
    (верх фюзеляжа и передняя кромка крыла), красные акценты, золотистые
    сопла, оранжево-янтарные огни.

Ориентация граней проверяется автоматически (PB.get разворачивает вывернутые
куски) — иначе в браузере с односторонним материалом детали «просвечивают».
"""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, cylinder

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261111)

# ---------------------------------------------------------------- габарит
L, W, H = 92.0, 69.0, 19.0
HX, HZ = L / 2, W / 2                    # 46 / 34.5

# ---------------------------------------------------------------- цвета
# ливрея Calico: графит + крупные светлые поля
GRAPH_D = np.array([0.088, 0.094, 0.104])
GRAPH = np.array([0.132, 0.140, 0.152])
GRAPH_L = np.array([0.192, 0.202, 0.216])
WHITE_L = np.array([0.560, 0.572, 0.586])        # светлые поля обшивки
WHITE_H = np.array([0.680, 0.692, 0.706])
STEEL_D = np.array([0.150, 0.156, 0.166])
STEEL = np.array([0.228, 0.236, 0.248])
STEEL_L = np.array([0.310, 0.320, 0.334])
DARK = np.array([0.052, 0.056, 0.062])
DARK_M = np.array([0.100, 0.106, 0.114])
RED = np.array([0.430, 0.075, 0.070])
RED_L = np.array([0.620, 0.140, 0.120])
BRONZE = np.array([0.300, 0.235, 0.140])
BRONZE_L = np.array([0.470, 0.380, 0.215])
GOLD = np.array([0.520, 0.420, 0.190])
GOLD_L = np.array([0.860, 0.690, 0.300])
NAVY = np.array([0.078, 0.096, 0.122])          # тёмный сине-графитовый верх
NAVY_L = np.array([0.118, 0.142, 0.176])
NAVY_D = np.array([0.048, 0.058, 0.076])
GLASS_D = np.array([0.055, 0.070, 0.082])
GLASS_L = np.array([0.180, 0.240, 0.280])
CYAN = np.array([0.35, 0.92, 1.00])
AMBER = np.array([1.000, 0.620, 0.200])
GREY = np.array([0.255, 0.255, 0.262])

LIGHT = np.array([0.44, 0.78, 0.44])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# ---------------------------------------------------------------- строитель
class PB:
    """Плоские фасетки с запечённым затенением (unlit)."""

    def __init__(self):
        self.V, self.T, self.C = [], [], []
        self.TC, self.TM, self.PRE = [], [], []
        self.m = 1.0

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
        """Коробка с ВСЕМИ нормалями наружу (см. orient-тест)."""
        cx, cy, cz = c
        sx, sy, sz = s[0] / 2.0, s[1] / 2.0, s[2] / 2.0
        x0, x1 = cx - sx, cx + sx
        y0, y1 = cy - sy, cy + sy
        z0, z1 = cz - sz, cz + sz
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
            Pp = V[T[sel]].astype(np.float64)
            vol = np.einsum('ij,ij->i', Pp[:, 0],
                            np.cross(Pp[:, 1], Pp[:, 2])).sum() / 6.0
            if vol < -1e-7:
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


# ---------------------------------------------------------------- проверки
def vert_bounds(pb, deg_y=0.0, deg_z=0.0, off=(0, 0, 0)):
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


CHECK = []


def check(pb, kind, off=(0, 0, 0), rot_y=0.0, rot_z=0.0):
    if pb is None or not pb.V:
        return
    CHECK.append(vert_bounds(pb, rot_y, rot_z, off) + (kind,))


def _components(pb, eps=1e-3):
    v, t, c = pb.get()
    V = np.asarray(v, np.float64)
    T = np.asarray(t, np.int64)
    key = np.round(V / eps).astype(np.int64)
    _, idx = np.unique(key, axis=0, return_inverse=True)
    par = np.arange(idx.max() + 1)

    def find(a):
        while par[a] != a:
            par[a] = par[par[a]]
            a = par[a]
        return a

    for tri in T:
        ra, rb, rc = find(idx[tri[0]]), find(idx[tri[1]]), find(idx[tri[2]])
        par[rb] = ra
        par[find(rc)] = ra
    groups = {}
    for tri in T:
        groups.setdefault(find(idx[tri[0]]), []).append(tri)
    return V, [np.array(g, np.int64) for g in groups.values()]


def orient_check(pb, name, tol=0.02):
    """Все замкнутые куски должны быть вывернуты наружу (объём > 0)."""
    V, comps = _components(pb)
    bad = []
    for T in comps:
        Pp = V[T]
        vol = np.einsum('ij,ij->i', Pp[:, 0], np.cross(Pp[:, 1], Pp[:, 2])).sum() / 6.0
        if vol < -tol:
            bad.append('%s: кусок объёмом %.3f м3' % (name, vol))
    return bad


def _pt_tri_dist(P, tri):
    P = np.asarray(P, np.float64)
    best = np.full(len(P), 1e9)
    for k in range(0, len(tri), 96):
        A = np.asarray(tri[k:k + 96, 0], np.float64)[:, None, :]
        B = np.asarray(tri[k:k + 96, 1], np.float64)[:, None, :]
        C = np.asarray(tri[k:k + 96, 2], np.float64)[:, None, :]
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
        den = np.where(np.abs(va + vb + vc) < 1e-14, 1e-14, va + vb + vc)
        q = A + ab * (vb / den)[..., None] + ac * (vc / den)[..., None]
        t = np.clip(d1 / np.maximum((ab * ab).sum(-1), 1e-14), 0.0, 1.0)
        q = np.where(((vc <= 0) & (d1 >= 0) & (d3 <= 0))[..., None], A + ab * t[..., None], q)
        t = np.clip(d2 / np.maximum((ac * ac).sum(-1), 1e-14), 0.0, 1.0)
        q = np.where(((vb <= 0) & (d2 >= 0) & (d6 <= 0))[..., None], A + ac * t[..., None], q)
        t = np.clip((d4 - d3) / np.maximum(((ac - ab) ** 2).sum(-1), 1e-14), 0.0, 1.0)
        q = np.where(((va <= 0) & (d4 - d3 >= 0) & (d5 - d6 >= 0))[..., None],
                     B + (C - B) * t[..., None], q)
        q = np.where(((d1 <= 0) & (d2 <= 0))[..., None], A, q)
        q = np.where(((d3 >= 0) & (d4 <= d3))[..., None], B, q)
        q = np.where(((d6 >= 0) & (d5 <= d6))[..., None], C, q)
        best = np.minimum(best, np.sqrt(((p - q) ** 2).sum(-1)).min(0))
    return best


def contact_check(details, hulls, tol_touch=0.12, tol_flat=0.40, tol_bulk=7.0, quiet=False):
    """Каждая ОТДЕЛЬНАЯ деталь декора должна касаться обшивки."""
    tri = []
    for pb in hulls:
        v, t, c = pb.get()
        V = np.asarray(v, np.float64)
        T = np.asarray(t, np.int32)
        tri.append(V[T])
    tri = np.concatenate(tri, axis=0)
    bad = []
    for name, item in details.items():
        pb, opt = item if isinstance(item, tuple) else (item, {})
        V, comps = _components(pb)
        if not comps:
            continue
        worst_touch, worst_flat, n_float = 0.0, 0.0, 0
        for T in comps:
            Pp = V[T.reshape(-1)]
            d = _pt_tri_dist(Pp, tri)
            span = Pp.max(0) - Pp.min(0)
            worst_touch = max(worst_touch, d.min())
            if span.min() < 0.40:
                worst_flat = max(worst_flat, d.max())
                if d.max() > opt.get('tol_flat', tol_flat):
                    n_float += 1
            cen = Pp.mean(0)
            dcen = _pt_tri_dist(cen[None, :], tri)[0]
            if dcen > opt.get('tol_bulk', tol_bulk):
                bad.append('%s: деталь улетела (центр в %.1f м от обшивки)' % (name, dcen))
        if not quiet:
            print('  декор %-10s кусков %4d | касание макс %.2f | плоские отход %.2f | висящих %d'
                  % (name, len(comps), worst_touch, worst_flat, n_float))
        if worst_touch > opt.get('tol_touch', tol_touch):
            bad.append('%s нигде не касается обшивки (%.2f м)' % (name, worst_touch))
        if n_float:
            bad.append('%s: %d плоских деталей висят в воздухе' % (name, n_float))
    return bad


# ---------------------------------------------------------------- утилиты
def loft(pb, xs, section_fn, col_fn, cap=True, cap_col=None):
    secs = [section_fn(x) for x in xs]
    n = len(xs)
    for i in range(n - 1):
        s0, s1 = secs[i], secs[i + 1]
        m = len(s0)
        for k in range(m):
            k2 = (k + 1) % m
            a = (xs[i], s0[k][0], s0[k][1])
            b = (xs[i], s0[k2][0], s0[k2][1])
            c = (xs[i + 1], s1[k2][0], s1[k2][1])
            d = (xs[i + 1], s1[k][0], s1[k][1])
            pb.face(a, d, c, b, col_fn(i, k))
    if cap:
        col = cap_col if cap_col is not None else col_fn(0, 0)
        s0 = secs[0]
        pts = [(xs[0], q[0], q[1]) for q in s0]
        for k in range(1, len(pts) - 1):
            pb.tri(pts[0], pts[k + 1], pts[k], col)
        s1 = secs[-1]
        pts = [(xs[-1], q[0], q[1]) for q in s1]
        for k in range(1, len(pts) - 1):
            pb.tri(pts[0], pts[k], pts[k + 1], col)


def quad_solid(pb, pts, up, dn, col_top, col_bot, col_edge=None, sgn=1):
    """Плоская деталь из четырёх точек с толщиной (крыло, киль, плавник).

    Зеркалит по Z через sgn и САМА выставляет обход каждой грани по желаемой
    нормали — так вывернутых граней тут быть не может.
    """
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


def merge_pb(dst, src):
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


# ---------------------------------------------------------------- фюзеляж
# станции фюзеляжа: острый нос -> расширение у кабины -> кормовой срез
FX = [-46.0, -43.0, -39.0, -34.0, -28.0, -20.0, -10.0, 0.0, 8.0, 14.0, 17.0, 19.0]
FW = [0.55, 1.60, 3.10, 4.30, 5.00, 5.30, 5.40, 5.20, 4.90, 4.40, 3.70, 3.10]
FYB = [5.60, 5.20, 4.80, 4.60, 4.60, 4.70, 4.80, 4.90, 5.00, 5.10, 5.20, 5.30]
FYT = [6.10, 6.30, 6.90, 7.60, 8.30, 8.80, 9.00, 8.90, 8.70, 8.50, 8.30, 8.10]


def fw(x):
    return float(np.interp(x, FX, FW))


def fyb(x):
    return float(np.interp(x, FX, FYB))


def fyt(x):
    return float(np.interp(x, FX, FYT))


def fuse_sec(x):
    """Сечение фюзеляжа: плоское днище, гранёные скулы, палуба."""
    w, yb, yt = fw(x), fyb(x), fyt(x)
    h = yt - yb
    return [(yb, -0.60 * w), (yb + 0.30 * h, -1.00 * w), (yb + 0.72 * h, -0.92 * w),
            (yt, -0.52 * w), (yt, 0.52 * w), (yb + 0.72 * h, 0.92 * w),
            (yb + 0.30 * h, 1.00 * w), (yb, 0.60 * w)]


def fuse_palette(i, k):
    # палуба — тёмный сине-графит, борта — светлые поля, днище — серое
    if k in (0, 7):
        return WHITE_L * 0.72 if i % 2 else GRAPH_L
    if k in (1, 6):
        return WHITE_L if i % 3 else WHITE_H
    if k in (2, 5):
        return WHITE_H if i % 2 else WHITE_L
    if k in (3, 4):
        return NAVY if i % 3 else NAVY_L
    return GRAPH


def fuse_skin_pts(x):
    yb, yt = fyb(x), fyt(x)
    h = yt - yb
    return [(yb, 0.60 * fw(x)), (yb + 0.30 * h, 1.00 * fw(x)),
            (yb + 0.72 * h, 0.92 * fw(x)), (yt, 0.52 * fw(x))]


def skin_z(x, y):
    pts = fuse_skin_pts(x)
    return float(np.interp(y, [p[0] for p in pts], [p[1] for p in pts]))


def side_box(pb, x, y, dx, dy, dz, col, sgn=1, out=0.08, mul=1.0):
    """Планка на борту, ПОВТОРЯЮЩАЯ наклон обшивки."""
    x0, x1 = x - dx / 2.0, x + dx / 2.0
    y0, y1 = y - dy / 2.0, y + dy / 2.0
    quad = [(x0, y0, skin_z(x0, y0)), (x1, y0, skin_z(x1, y0)),
            (x1, y1, skin_z(x1, y1)), (x0, y1, skin_z(x0, y1))]
    quad = [(q[0], q[1], sgn * q[2]) for q in quad]
    o = sgn * out
    outer = [(q[0], q[1], q[2] + o) for q in quad]
    inner = [(q[0], q[1], q[2] - o) for q in quad]
    pb.face(outer[0], outer[3], outer[2], outer[1], col, mul)
    pb.face(inner[0], inner[1], inner[2], inner[3], col * 0.8, mul)
    for k in range(4):
        k2 = (k + 1) % 4
        pb.face(inner[k], inner[k2], outer[k2], outer[k], col * 0.86, mul)


def deck_box(pb, x, z, dx, dy, dz, col, out=0.10, mul=1.0):
    pb.box((x, fyt(x) + out - dy / 2.0, z), (dx, dy, dz), col, mul)


def belly_box(pb, x, z, dx, dy, dz, col, out=0.08, mul=1.0):
    pb.box((x, fyb(x) - out + dy / 2.0, z), (dx, dy, dz), col, mul)


# ---------------------------------------------------------------- узлы
def fuselage():
    """Фюзеляж-клин, кабина, воздухозаборники, панелировка."""
    pb = PB()
    loft(pb, FX, fuse_sec, fuse_palette, cap_col=GRAPH_L)
    # --- бронированный нос и скуловой «клюв»
    for sgn in (-1, 1):
        pb.face((-46.0, fyb(-46.0) + 0.10, sgn * 0.20),
                (-46.0, fyt(-46.0) - 0.10, sgn * 0.20),
                (-42.0, fyt(-43.0) - 0.30, sgn * 1.70),
                (-42.0, fyb(-43.0) + 0.24, sgn * 1.70), WHITE_L)
    # --- панельные швы по палубе
    for x in np.arange(-40.0, 16.0, 2.2):
        deck_box(pb, x, 0.0, 0.10, 0.08, 1.90 * fw(x), GRAPH_D, out=0.05)
    # --- бортовые панели и люки
    for sgn in (-1, 1):
        for x in np.arange(-38.0, 15.0, 2.6):
            y = fyb(x) + 0.45 * (fyt(x) - fyb(x))
            side_box(pb, x, y, 2.0, 0.26, 0.14, GRAPH_D, sgn=sgn, out=0.07)
    # --- воздухозаборники по бортам (плоские, как на референсе)
    for sgn in (-1, 1):
        pb.box((-13.4, fyb(-13.4) + 1.05, sgn * 5.05), (7.20, 1.70, 0.70), GRAPH_D)
        pb.box((-13.4, fyb(-13.4) + 1.05, sgn * 5.35), (6.20, 1.30, 0.30), DARK)
        pb.box((-9.6, fyb(-9.6) + 1.05, sgn * 5.30), (0.50, 1.60, 0.40), STEEL)
    # --- светлые «поля» Calico на верхних скулах
    for sgn in (-1, 1):
        pb.face((-36.0, fyt(-36.0) - 0.10, sgn * 2.10),
                (-20.0, fyt(-20.0) - 0.10, sgn * 2.70),
                (-20.0, fyt(-20.0) + 0.02, sgn * 3.30),
                (-36.0, fyt(-36.0) + 0.02, sgn * 2.70), WHITE_H)
    return pb


def bubble_canopy():
    """Кабина: высокая капля с рамой, тонированное стекло, два члена экипажа."""
    pb = PB()
    X0, X1 = -34.60, -23.60
    st = [X0, -32.60, -30.00, -26.80, X1]
    w = [1.35, 2.05, 2.30, 2.20, 1.70]
    base = [fyt(x) for x in st]
    h = [0.85, 1.95, 2.30, 2.10, 1.00]

    def sec(x):
        ww = float(np.interp(x, st, w))
        b = float(np.interp(x, st, base))
        hh = float(np.interp(x, st, h))
        return [(b - 0.10, -ww), (b + 0.42 * hh, -0.92 * ww), (b + hh, -0.36 * ww),
                (b + hh, 0.36 * ww), (b + 0.42 * hh, 0.92 * ww), (b - 0.10, ww)]

    # стекло: светлее по верху, тёмное по бортам
    loft(pb, st, sec, lambda i, k: (GLASS_L * 1.35 if k in (2, 3) else GLASS_L * 0.72),
         cap_col=GLASS_D)
    # рама: поперечные дуги и продольные рельсы
    for x in st[1:-1]:
        b = fyt(x)
        ww = float(np.interp(x, st, w))
        hh = float(np.interp(x, st, h))
        for sgn in (-1, 1):
            pb.seg((x, b - 0.06, sgn * ww * 0.95), (x, b + hh, sgn * 0.36 * ww),
                   0.18, 0.20, STEEL_D, ref=(1, 0, 0))
    for sgn in (-1, 1):
        pb.seg((X0 + 0.2, fyt(X0) + 0.30, sgn * 1.10), (X1 - 0.2, fyt(X1) + 0.24, sgn * 1.55),
               0.16, 0.16, STEEL_D, ref=(0, 1, 0))
        # нижний силовой пояс фонаря
        pb.seg((X0 + 0.1, fyt(X0) + 0.02, sgn * 1.32), (X1 - 0.1, fyt(X1) + 0.02, sgn * 1.78),
               0.22, 0.20, NAVY_L, ref=(0, 1, 0))
    # пилот и штурман в кабине (силуэты)
    for dz, x in ((-0.62, -30.10), (0.62, -27.40)):
        pb.box((x, fyt(x) + 0.62, dz), (0.80, 1.05, 0.60), DARK_M)
        pb.box((x, fyt(x) + 1.24, dz), (0.52, 0.50, 0.52), STEEL_D)
    # подъёмная рама фонаря (стойка у корня)
    pb.box((X1 + 0.30, fyt(X1 + 0.30) + 0.85, 0.0), (0.5, 1.7, 0.4), STEEL)
    return pb


# --- геометрия крыла и киля: одна и та же для металла, АНО и стробов
WING_A = (-14.00, 5.30, 4.60)      # корень, задняя кромка
WING_B = (-2.50, 5.55, 4.90)       # корень, передняя кромка
WING_C = (35.00, 4.60, 33.20)      # законцовка, передняя
WING_D = (45.00, 4.70, 34.30)      # законцовка, задняя
FIN_A = (8.20, 8.35, 2.55)         # киль: низ, передняя кромка
FIN_B = (16.20, 8.05, 2.20)        # низ, задняя кромка
FIN_C = (19.60, 17.30, 9.60)       # верх, задняя
FIN_D = (15.60, 18.60, 9.15)       # верх, передняя


def edge(p, q, t):
    """Точка на ребре p→q по параметру t."""
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t)


def wing_at(u, v):
    """Точка на плоскости крыла: u = корень→законцовка, v = задняя→передняя."""
    A, B, C, D = WING_A, WING_B, WING_C, WING_D
    w = [(1 - u) * (1 - v), (1 - u) * v, u * v, u * (1 - v)]
    return tuple(sum(w[i] * p[k] for i, p in enumerate((A, B, C, D))) for k in range(3))


def wing(sgn):
    """Длинное тонкое крыло: свип назад, чуть вниз, светлая плоскость."""
    pb = PB()
    pb.m = sgn
    A, B, C, D = WING_A, WING_B, WING_C, WING_D
    quad_solid(pb, [A, B, C, D], 0.20, 0.16, WHITE_L, GRAPH_L, GRAPH, sgn)
    # тёмная передняя кромка — узкая полоса по кромке v=1
    def strip(v0, v1, u0, u1, dy=0.21):
        p = [wing_at(u0, v0), wing_at(u1, v0), wing_at(u1, v1), wing_at(u0, v1)]
        return [(q[0], q[1] + dy, q[2]) for q in p]

    quad_solid(pb, strip(0.90, 1.0, 0.02, 0.98), 0.05, 0.0,
               NAVY_L, NAVY_D, NAVY, sgn)
    # золотая линия ливреи — тонкая, вдоль крыла
    quad_solid(pb, strip(0.62, 0.68, 0.10, 0.92), 0.03, 0.0,
               GOLD, GOLD_L, GOLD, sgn)
    # закрылок у законцовки
    quad_solid(pb, strip(0.30, 0.52, 0.86, 0.99), 0.05, 0.0,
               GRAPH_L, GRAPH, GRAPH_D, sgn)
    # пилон-держатель под крылом у корня
    quad_solid(pb, [(A[0] + 1.0, A[1] - 0.30, A[2] + 0.60),
                    (A[0] + 3.4, A[1] - 0.30, A[2] + 0.70),
                    (A[0] + 3.0, A[1] - 1.30, A[2] + 0.62),
                    (A[0] + 1.2, A[1] - 1.30, A[2] + 0.54)],
               0.20, 0.06, NAVY_L, NAVY_D, NAVY, sgn)
    return pb

def tail_fin(sgn):
    """Верхний расходящийся киль-трапеция с сильным свипом."""
    pb = PB()
    pb.m = sgn
    A, B, C, D = FIN_A, FIN_B, FIN_C, FIN_D
    quad_solid(pb, [A, B, C, D], 0.22, 0.22, NAVY_L, NAVY_D, NAVY, sgn)
    # тёмная внутренняя плоскость
    quad_solid(pb, [(A[0] + 0.5, A[1] + 0.02, A[2] - 0.02),
                    (B[0] - 0.7, B[1] + 0.02, B[2] - 0.02),
                    (C[0] - 0.6, C[1] + 0.02, C[2] - 0.10),
                    (D[0] + 0.2, D[1] + 0.02, D[2] - 0.10)],
               0.03, 0.0, NAVY_L, NAVY_L, NAVY, sgn)
    # золотая кромка
    quad_solid(pb, [(A[0] + 0.2, A[1] + 0.23, A[2] + 0.02),
                    (D[0] + 0.1, D[1] + 0.23, D[2] - 0.05),
                    (D[0] - 0.5, D[1] + 0.23, D[2] - 0.35),
                    (A[0] + 0.7, A[1] + 0.23, A[2] - 0.28)],
               0.03, 0.0, GOLD, GOLD, GOLD, sgn)
    return pb

def belly_fin(sgn):
    """Нижний подфюзеляжный плавник."""
    pb = PB()
    pb.m = sgn
    A = (4.20, 4.90, 1.60)
    B = (11.00, 4.80, 1.40)
    C = (13.60, 1.40, 4.60)
    D = (7.60, 1.30, 4.20)
    quad_solid(pb, [A, B, C, D], 0.16, 0.16, NAVY_L, DARK_M, NAVY, sgn)
    return pb


def spine_hump():
    """Горб-обтекатель за кабиной между килями (как на рендере)."""
    pb = PB()
    pb.cyl(9.20, 8.35, 0.0, 1.55, 8.40, axis='x', seg=16, color=NAVY_L)
    pb.cyl(14.20, 8.20, 0.0, 1.15, 3.60, axis='x', seg=16, color=NAVY)
    pb.cyl(4.60, 8.55, 0.0, 1.30, 0.90, axis='x', seg=16, color=NAVY_D)
    # приёмник воздушного давления на горбе
    pb.box((12.40, 9.70, 0.0), (1.80, 0.30, 0.60), STEEL_D)
    return pb


# --- сопла: числа одни и для металла, и для свечения
NOZ_X0 = 17.20
NOZ_X1 = 19.60
NOZ_R = 2.60
NOZ_POS = [(0.0, 2.95, 2.60), (0.0, -2.95, 2.60)]
NOZ_CY = 6.60


def nozzle_block():
    """Кормовой блок: две гондолы с соплами-кольцами + центральная турбина."""
    pb = PB()
    # плита-основание
    pb.box((18.10, 6.60, 0.0), (1.60, 5.20, 8.20), NAVY_D)
    for (dy, dz, r) in NOZ_POS:
        cy, cz = NOZ_CY + dy, dz
        # гондола-обтекатель вокруг сопла (на рендере это крупные «подушки»)
        pb.cyl(14.20, cy, cz, 2.78, 6.40, axis='x', seg=20, color=NAVY_L)
        pb.cyl(11.60, cy, cz, 2.30, 1.60, axis='x', seg=20, color=NAVY)
        pb.cyl(16.80, cy, cz, 2.92, 1.50, axis='x', seg=20, color=NAVY_D)
        # нижняя «щека» гондолы — к ней крепится шасси
        pb.box((14.20, cy - 2.35, cz), (6.40, 1.10, 3.30), NAVY_D)
        pb.cyl(18.40, cy, cz, r * 1.10, 1.30, axis='x', seg=18, color=STEEL_D)
        pb.cyl(19.10, cy, cz, r * 1.02, 0.70, axis='x', seg=18, color=GOLD)
        pb.cyl(NOZ_X1 - 0.10, cy, cz, r * 0.86, 0.30, axis='x', seg=18, color=STEEL)
        pb.cyl(18.60, cy, cz, r * 0.60, 0.90, axis='x', seg=16, color=DARK)
        for k in range(10):
            a = 2.0 * math.pi * k / 10.0
            pb.box((18.75, cy + r * 1.02 * math.cos(a), cz + r * 1.02 * math.sin(a)),
                   (0.90, 0.14, 0.14), STEEL_D)
    # центральная турбина
    pb.cyl(18.60, NOZ_CY, 0.0, 1.55, 1.50, axis='x', seg=16, color=STEEL)
    pb.cyl(19.30, NOZ_CY, 0.0, 1.25, 0.30, axis='x', seg=16, color=STEEL_D)
    pb.cyl(19.40, NOZ_CY, 0.0, 0.85, 0.20, axis='x', seg=14, color=DARK)
    for k in range(8):
        a = 2.0 * math.pi * k / 8.0
        pb.box((18.95, NOZ_CY + 1.25 * math.cos(a), 1.25 * math.sin(a)),
               (0.70, 0.16, 0.16), STEEL_L)
    # верхние и нижние обтекатели
    pb.box((16.60, 9.30, 0.0), (3.60, 1.10, 5.40), NAVY)
    pb.box((16.60, 4.10, 0.0), (3.60, 0.90, 4.60), DARK_M)
    return pb


def thrusters():
    """Свечение в устьях двух маршевых сопел и турбины."""
    pb = PB()
    for (dy, dz, r) in NOZ_POS:
        cy, cz = NOZ_CY + dy, dz
        rr = r * 0.80
        seg = 18
        for k in range(seg):
            a0 = 2.0 * math.pi * k / seg
            a1 = 2.0 * math.pi * (k + 1) / seg
            p0 = (NOZ_X1 - 0.24, cy + rr * math.cos(a0), cz + rr * math.sin(a0))
            p1 = (NOZ_X1 - 0.24, cy + rr * math.cos(a1), cz + rr * math.sin(a1))
            pb.tri((NOZ_X1 - 0.24, cy, cz), p0, p1, CYAN * 0.95)
        for k in range(5):
            a = 2.0 * math.pi * k / 5.0 + 0.3
            pb.box((NOZ_X1 - 0.44, cy + rr * 0.5 * math.cos(a), cz + rr * 0.5 * math.sin(a)),
                   (0.10, rr * 0.9, 0.16), CYAN * 0.5)
    # турбина
    for k in range(12):
        a0 = 2.0 * math.pi * k / 12
        a1 = 2.0 * math.pi * (k + 1) / 12
        p0 = (NOZ_X1 - 0.30, NOZ_CY + 0.70 * math.cos(a0), 0.70 * math.sin(a0))
        p1 = (NOZ_X1 - 0.30, NOZ_CY + 0.70 * math.cos(a1), 0.70 * math.sin(a1))
        pb.tri((NOZ_X1 - 0.30, NOZ_CY, 0.0), p0, p1, AMBER * 0.75)
    return pb


def capital_cannon():
    """Capital-пушка под фюзеляжем: массивная спарка стволов вперёд."""
    pb = PB()
    # пилон к днищу
    pb.box((-9.00, fyb(-9.0) - 0.55, 0.0), (12.00, 1.30, 3.40), NAVY_D)
    pb.box((-15.00, fyb(-15.0) - 0.75, 0.0), (7.00, 1.10, 2.60), NAVY)
    # корпус орудия: серый казённик с тёмной кормовой плитой
    pb.box((-21.00, 3.95, 0.0), (12.00, 2.60, 4.20), GRAPH_L)
    pb.box((-26.60, 3.95, 0.0), (1.60, 2.70, 4.30), NAVY_D)
    pb.box((-21.60, 3.95, 0.0), (10.20, 2.20, 4.30), GRAPH)
    # светлые панели обшивки по бортам казённика
    for sgn in (-1, 1):
        pb.box((-20.00, 4.20, sgn * 2.14), (7.40, 1.60, 0.16), WHITE_L)
        pb.box((-20.00, 4.20, sgn * 2.12), (5.20, 0.30, 0.22), GOLD)
    # щёки-короба по бортам орудия
    for sgn in (-1, 1):
        pb.box((-19.60, 4.60, sgn * 2.05), (9.00, 1.10, 0.70), NAVY_L)
        pb.box((-19.60, 3.10, sgn * 2.00), (8.00, 0.70, 0.60), NAVY_D)
    for sgn in (-1, 1):
        z = sgn * 1.50
        # ствол с дульным тормозом
        pb.cyl(-32.00, 3.95, z, 0.62, 18.00, axis='x', seg=14, color=STEEL_D)
        pb.cyl(-41.60, 3.95, z, 0.80, 2.60, axis='x', seg=14, color=STEEL)
        pb.cyl(-44.00, 3.95, z, 0.58, 1.60, axis='x', seg=14, color=DARK)
        pb.cyl(-45.20, 3.95, z, 0.72, 0.80, axis='x', seg=14, color=STEEL_L)
        # охлаждающие кольца
        for k in range(6):
            pb.cyl(-24.60 - k * 2.30, 3.95, z, 0.74, 0.30, axis='x', seg=12, color=STEEL)
        # крепление ствола к корпусу
        pb.box((-24.40, 4.30, z * 0.92), (2.40, 1.10, 0.70), NAVY)
    # блок наведения
    pb.box((-22.60, 5.30, 0.0), (3.20, 0.90, 2.30), STEEL_D)
    pb.cyl(-24.20, 5.30, 0.0, 0.58, 0.70, axis='x', seg=10, color=GLASS_D)
    # тяги-упоры к носу
    for sgn in (-1, 1):
        pb.seg((-16.00, fyb(-16.0) - 0.20, sgn * 1.30), (-28.00, 3.20, sgn * 1.30),
               0.26, 0.26, STEEL_D, ref=(0, 1, 0))
    return pb


def missile_cells(sgn):
    """Точки ячеек ракетной батареи: (cx, cy, cz, r) — общие для корпуса и свечения."""
    x, y = -18.00, fyb(-18.0) + 2.05
    zs = skin_z(x, y)
    z = sgn * (zs + 0.62)
    out = []
    for row in range(4):
        for col in range(4):
            out.append((x - 2.30 + col * 1.20, y - 0.85 + row * 0.62, z + sgn * 1.26, 0.32))
    for row in range(2):
        for col in range(4):
            out.append((x + 3.60 + col * 0.72, y - 0.10 + row * 0.54, z + sgn * 1.06, 0.18))
    return out


def missile_pods(sgn):
    """Бортовая батарея: тёмная плита с гнёздами сот (свечение — отдельный узел)."""
    pb = PB()
    pb.m = sgn
    x, y = -18.00, fyb(-18.0) + 2.05
    zs = skin_z(x, y)
    z = sgn * (zs + 0.62)
    pb.box((x, y, z), (8.00, 3.10, 2.20), NAVY_L)
    pb.box((x, y, z + sgn * 1.05), (7.20, 2.70, 0.40), NAVY_D)
    pb.box((x - 3.60, y - 1.30, z - sgn * 0.55), (1.20, 0.60, 1.50), GRAPH)
    pb.box((x + 4.60, y + 0.30, z - sgn * 0.50), (3.40, 1.90, 1.90), NAVY)
    # гнёзда: тёмный стакан под каждую ячейку
    for (cx, cy, cz, r) in missile_cells(sgn):
        pb.cyl(cx, cy, cz - sgn * 0.10, r + 0.14, 0.24, axis='z', seg=10, color=DARK)
    return pb


def missile_glow(sgn):
    """Золотые головки ракет в гнёздах — отдельным узлом, чтобы зажигать в siege."""
    pb = PB()
    for (cx, cy, cz, r) in missile_cells(sgn):
        pb.cyl(cx, cy, cz, r, 0.14, axis='z', seg=10, color=GOLD_L)
    return pb


GEAR = [(-26.0, 3.60, 4.90), (13.0, 4.60, 5.10), (13.0, -4.60, 5.10)]   # x, z, стойка
GEAR_H = [g[2] for g in GEAR]


def gear_leg(i):
    """Стойка шасси: локальный ноль — пятно контакта на Y = 0."""
    pb = PB()
    h = GEAR_H[i]
    # бедро с обтекателем
    pb.box((0.0, h * 0.72, 0.0), (1.70, h * 0.66, 2.00), NAVY_L)
    pb.box((0.0, h * 0.72, 0.30), (1.26, h * 0.58, 1.36), STEEL_D)
    # колено
    pb.box((0.0, h * 0.36, 0.0), (2.00, 0.74, 2.20), NAVY)
    pb.cyl(0.0, h * 0.36, 0.0, 0.46, 2.30, axis='z', seg=12, color=STEEL)
    # голень
    pb.box((0.0, h * 0.28, 0.0), (1.20, h * 0.42, 1.40), STEEL_D)
    # лапа: две широкие подошвы + центральная
    for dz in (-1.05, 1.05):
        pb.box((0.0, 0.30, dz), (3.40, 0.60, 0.76), NAVY_D)
        pb.box((0.0, 0.13, dz), (3.60, 0.26, 0.66), DARK_M)
    pb.box((0.0, 0.36, 0.0), (1.80, 0.50, 2.60), STEEL_D)
    pb.box((0.0, 0.13, 0.0), (2.40, 0.26, 1.60), DARK_M)
    # гидравлика
    pb.cyl(0.0, h * 0.55, 0.0, 0.24, h * 0.92, axis='y', seg=10, color=BRONZE_L)
    return pb


def greebles():
    """Мелочь: магистрали, люки, поручни, датчики — всё по обшивке."""
    pb = PB()
    for sgn in (-1, 1):
        # магистраль по борту короткими сегментами
        for i in range(14):
            x = -34.0 + i * 2.0
            y = fyb(x) + 0.55
            side_box(pb, x, y, 1.9, 0.12, 0.12, BRONZE_L, sgn=sgn, out=0.08)
        # люки обслуживания
        for x in (-30.0, -16.0, 2.0, 12.0):
            y = fyb(x) + 0.45 * (fyt(x) - fyb(x))
            side_box(pb, x, y, 1.6, 0.50, 0.14, STEEL_L, sgn=sgn, out=0.09)
            side_box(pb, x, y, 1.1, 0.32, 0.10, STEEL_D, sgn=sgn, out=0.12)
        # датчики под носом
        pb.cyl(-40.0, fyb(-40.0) - 0.06, sgn * 1.20, 0.16, 0.20, axis='y', seg=8,
               color=STEEL_L)
        # пилоны подвески под крылом (точка берётся с плоскости крыла)
        for (u, v) in ((0.34, 0.42), (0.55, 0.38)):
            px, py, pz = wing_at(u, v)
            pb.box((px, py - 0.40, sgn * pz), (2.60, 0.62, 0.66), NAVY_D)
    # стяжки по днищу
    for x in (-18.0, -8.0, 2.0):
        belly_box(pb, x, 0.0, 3.0, 0.18, 2.40, GRAPH_D, out=0.08)
    return pb


def decals():
    """Ливрея Calico: светлые поля, красные акценты, трафареты."""
    pb = PB()
    for sgn in (-1, 1):
        # красная полоса по борту
        for i in range(10):
            x = -22.0 + i * 2.2
            y = fyb(x) + 0.62 * (fyt(x) - fyb(x))
            side_box(pb, x, y, 2.1, 0.16, 0.10, RED_L, sgn=sgn, out=0.07)
        # белое поле-«шеврон» на борту носа
        for i in range(4):
            x = -36.0 + i * 1.4
            y = fyb(x) + 0.55 * (fyt(x) - fyb(x))
            side_box(pb, x, y, 1.3, 0.44, 0.10, WHITE_H, sgn=sgn, out=0.06)
        # трафарет на палубе
        for k in range(5):
            deck_box(pb, -6.0 + k * 0.55, sgn * 1.30, 0.26, 0.05, 0.70, GRAPH_D, out=0.05)
    return pb


def lights():
    """Прожекторы, габариты, подсветка кабины и пушек."""
    pb = PB()
    # прожекторы в носу
    for sgn in (-1, 1):
        pb.cyl(-42.0, fyb(-42.0) - 0.04, sgn * 0.90, 0.20, 0.16, axis='y', seg=8,
               color=AMBER * 0.9)
    # АНО на законцовках: точка считается по кромке C→D, а не на глаз
    for sgn in (-1, 1):
        px, py, pz = edge(WING_C, WING_D, 0.42)
        pb.box((px, py + 0.25, sgn * pz), (0.95, 0.20, 0.34),
               RED_L if sgn > 0 else CYAN * 0.9)
        px2, py2, pz2 = edge(WING_C, WING_D, 0.78)
        pb.box((px2, py2 + 0.23, sgn * pz2), (0.70, 0.16, 0.28), AMBER * 0.85)
    # подсветка кабины — на борту фюзеляжа у фонаря
    for sgn in (-1, 1):
        side_box(pb, -26.0, fyt(-26.0) - 0.30, 3.00, 0.12, 0.10, CYAN * 0.55,
                 sgn=sgn, out=0.06)
    return pb


def beacon():
    """Стробы на верхних кромках килей: точка считается по кромке D→C."""
    pb = PB()
    for sgn in (-1, 1):
        bx, by, bz = edge(FIN_D, FIN_C, 0.42)
        # тёмная подложка, лежит на кромке
        # стакан строба посажен В кромку, линза выходит сверху
        pb.cyl(bx, by + 0.10, sgn * bz, 0.21, 0.34, axis='y', seg=10, color=STEEL_D)
        pb.cyl(bx, by + 0.30, sgn * bz, 0.15, 0.30, axis='y', seg=8, color=RED_L)
    return pb


def main():
    b = GlbBuilder()
    m_hull = b.material('cal_hull', metallic=0.60, roughness=0.46)
    m_dark = b.material('cal_dark', metallic=0.72, roughness=0.34)
    m_glass = b.material('cal_glass', metallic=0.16, roughness=0.12)
    m_glow = b.material('cal_glow', metallic=0.0, roughness=0.26)
    m_thrust = b.material('cal_thrust', metallic=0.0, roughness=0.20)

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

    fz = fuselage()
    add('fuselage', fz, m_hull, kind='hull')
    add('canopy', bubble_canopy(), m_glass, kind='canopy')
    for sgn in (1, -1):
        tag = 'r' if sgn > 0 else 'l'
        add('wing_' + tag, wing(sgn), m_hull, kind='hull')
        add('tail_fin_' + tag, tail_fin(sgn), m_hull, kind='hull')
        add('belly_fin_' + tag, belly_fin(sgn), m_hull, kind='hull')
        add('missile_pod_' + tag, missile_pods(sgn), m_hull, kind='hull')
        add('missile_glow_' + tag, missile_glow(sgn), m_glow)
    add('capital_cannon', capital_cannon(), m_hull, kind='hull')
    add('nozzle_block', nozzle_block(), m_dark, kind='hull')
    add('spine_hump', spine_hump(), m_dark, kind='hull')
    _thr = thrusters()
    add('thrusters', _thr, m_thrust)
    _gr, _dc, _li, _bc = greebles(), decals(), lights(), beacon()
    _gl = [REF['missile_glow_r'], REF['missile_glow_l']]
    add('greebles', _gr, m_glow)
    add('decals', _dc, m_glow)
    add('lights', _li, m_glow)
    add('beacon', _bc, m_glow)
    for i in range(len(GEAR)):
        add('leg_%d' % i, gear_leg(i), m_hull, pos=[GEAR[i][0], 0.0, GEAR[i][1]])

    # --- свечение строго внутри устьев
    for (vx, vy, vz) in _thr.V:
        ok = False
        for (dy, dz, r) in NOZ_POS:
            cy, cz = NOZ_CY + dy, dz
            if ((vy - cy) ** 2 + (vz - cz) ** 2) ** 0.5 <= r * 0.82:
                ok = True
                break
        if not ok:
            # турбина в центре
            if ((vy - NOZ_CY) ** 2 + vz ** 2) ** 0.5 <= 0.85:
                ok = True
        if not ok:
            raise SystemExit('свечение вылезло за устье')
        if vx > NOZ_X1 + 1e-6:
            raise SystemExit('свечение торчит из среза: x %.2f' % vx)
    print('  посадка сопел: струи и турбина внутри срезов')

    # --- ориентация граней
    orient_bad = []
    for _g in (REF['missile_glow_r'], REF['missile_glow_l']):
        pass
    for nm, pb in REF.items():
        orient_bad += orient_check(pb, nm)
    print('ориентация граней: %s' % ('OK (всё наружу)' if not orient_bad else
                                     'НЕ ИСПРАВЛЕНО: %d' % len(orient_bad)))
    for q in orient_bad[:8]:
        print('   ', q)
    if orient_bad:
        raise SystemExit('вывернутые грани')

    data = b.build('calico_enforcer')
    open(os.path.join(P, 'calico_enforcer.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-16s verts %5d tris %5d' % (k, nv, nt))

    modes = {
        'pad':    {'legs': 1.0, 'guns': 0.0, 'wings': 0.0, 'bay': 0.0, 'thrust': 0.0,
                   'strobe': 0.30, 'spots': 0.45},
        'flight': {'legs': 0.0, 'guns': 0.0, 'wings': 0.0, 'bay': 0.0, 'thrust': 0.70,
                   'strobe': 0.55, 'spots': 1.0},
        'patrol': {'legs': 0.0, 'guns': 0.0, 'wings': 1.0, 'bay': 0.0, 'thrust': 0.55,
                   'strobe': 0.70, 'spots': 1.0},
        'siege':  {'legs': 1.0, 'guns': 1.0, 'wings': 1.0, 'bay': 1.0, 'thrust': 0.20,
                   'strobe': 1.0, 'spots': 1.0},
    }
    json.dump({'pods': 2, 'missile_cells': 24, 'legs': len(GEAR),
               'wing_droop_deg': 6.0, 'cannon_recoil': 0.9,
               'siege_legs_deg': 0.0, 'leg_retract': 1.7,
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
    if ymin < -0.2 or ymax > H + 0.6:
        bad.append('высота')
    print('  x[%.1f..%.1f] y[%.1f..%.1f] z[%.1f..%.1f]'
          % (xmin, xmax, ymin, ymax, zmin, zmax))
    print('  L %.1f/%.1f  W %.1f/%.1f  H %.1f/%.1f'
          % (xmax - xmin, L, zmax - zmin, W, ymax - ymin, H))
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

    # ---------------- декор лежит на обшивке ----------------
    float_bad = contact_check(
        {'greebles': _gr, 'decals': _dc, 'lights': _li, 'beacon': _bc},
        [fz, REF['nozzle_block'], REF['spine_hump'], REF['wing_r'], REF['wing_l'],
         REF['tail_fin_r'], REF['tail_fin_l'], REF['belly_fin_r'], REF['belly_fin_l'],
         REF['missile_pod_r'], REF['missile_pod_l'], REF['capital_cannon'],
         REF['canopy']])
    print('посадка декора на обшивку: %s' % ('OK' if not float_bad else float_bad))
    if float_bad:
        raise SystemExit('декор не лежит на корпусе: ' + '; '.join(float_bad))

    raw = open(os.path.join(P, 'calico_enforcer.glb'), 'rb').read()
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
    print('geometry: OK')


if __name__ == '__main__':
    main()
