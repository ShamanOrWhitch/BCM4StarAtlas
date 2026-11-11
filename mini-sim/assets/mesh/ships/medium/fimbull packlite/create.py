#!/usr/bin/env python3
"""Fimbul BYOS Packlite — средний грузовик-баржа (Star Atlas, FBLBPL, Rare).
67.1 × 26.5 × 21.6 м, экипаж 6 (пилот, штурман, инженер, 2 оператора, ...).

Компоновка восстановлена по чертежу Fimbul (вид сверху / сбоку / снизу /
сзади) и по кадрам галереи карточки NFT:

  * НОС: охристая броневая кабина-рубка с ленточным остеклением, перед ней —
    два больших круглых ВОЗДУХОЗАБОРНИКА-барабана, снизу — скуловой «плуг»;
  * СЕРЕДИНА: открытая грузовая палуба-баржа с рядами контейнеров, стойками
    ограждения (красные трубы), двумя турелями и радиомачтой;
  * КОРМА: открытая ФЕРМА с маршевыми двигателями, блок из ПЯТИ сопел
    (одно большое по центру, четыре по сторонам) и бортовые РЁБРИСТЫЕ
    гондолы-радиаторы по два барабана на борт;
  * шасси — четыре посадочные лыжи-стойки, пятна строго на Y = 0;
  * ливрея: выцветшая жёлто-охристая броня, промышленный серо-зелёный
    металл, красные трубы ограждения, бирюзовое остекление, циановые дюзы.
"""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, cylinder

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261101)

# ---------------------------------------------------------------- габарит
L, W, H = 67.1, 26.5, 21.6
HX, HZ = L / 2, W / 2                    # 33.55 / 13.25

# ---------------------------------------------------------------- цвета
# выцветшая жёлто-охристая броня баржи
OCHRE_D = np.array([0.225, 0.176, 0.098])
OCHRE = np.array([0.320, 0.262, 0.150])
OCHRE_L = np.array([0.408, 0.340, 0.205])
OCHRE_H = np.array([0.492, 0.418, 0.268])
# промышленный металл
STEEL_D = np.array([0.118, 0.126, 0.132])
STEEL = np.array([0.196, 0.208, 0.214])
STEEL_L = np.array([0.280, 0.296, 0.300])
STEEL_H = np.array([0.370, 0.386, 0.390])
# грузовые контейнеры
BOX_D = np.array([0.168, 0.180, 0.184])
BOX = np.array([0.246, 0.262, 0.266])
BOX_L = np.array([0.330, 0.348, 0.352])
# оливковый «ферменный» металл кормы
OLIVE = np.array([0.160, 0.172, 0.128])
OLIVE_L = np.array([0.226, 0.240, 0.176])
RED = np.array([0.470, 0.098, 0.080])
RED_L = np.array([0.620, 0.160, 0.120])
RUST = np.array([0.300, 0.170, 0.098])
BRONZE = np.array([0.300, 0.215, 0.140])
BRONZE_L = np.array([0.440, 0.330, 0.215])
GREY = np.array([0.255, 0.255, 0.262])
DARK = np.array([0.070, 0.074, 0.078])
DARK_M = np.array([0.130, 0.136, 0.142])
WHITE = np.array([0.780, 0.775, 0.760])
WHITE_D = np.array([0.600, 0.598, 0.585])
SILVER = np.array([0.560, 0.560, 0.560])
SILVER_D = np.array([0.370, 0.372, 0.378])
GLASS = np.array([0.070, 0.130, 0.120])
GLASS_L = np.array([0.150, 0.360, 0.320])       # бирюзовое остекление рубки
CYAN = np.array([0.35, 0.92, 1.00])
CYAN_D = np.array([0.16, 0.46, 0.56])
AMBER = np.array([1.000, 0.600, 0.180])

LIGHT = np.array([0.44, 0.78, 0.44])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# ---------------------------------------------------------------- строитель
class PB:
    """Плоские фасетки с запечённым затенением (unlit)."""

    def __init__(self):
        self.V, self.T, self.C = [], [], []
        self.TC, self.TM = [], []          # базовый цвет и множитель по треугольнику
        self.PRE = []                      # треугольник уже окрашен (цилиндры)
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
        # цвет ПОКА не считаем: get() сначала починит ориентацию (иначе
        # затенение запёклось бы по перевёрнутой нормали)
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
        # ВАЖНО: обход задан так, чтобы ВСЕ шесть нормалей смотрели НАРУЖУ.
        # Раньше верх/низ/±X были вывернуты: в браузере (материал
        # односторонний) эти стены отбрасывались, и коробки «просвечивали»,
        # а запечённое затенение считалось по перевёрнутой нормали (верх
        # получался тёмным). Ловится автопроверкой ориентации ниже.
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
        """Геометрия с ПРОВЕРЕННОЙ ориентацией и запечённым затенением.

        Никакая деталь не может уйти в браузер вывернутой: для каждого
        связного куска считается знаковый объём, и кусок с отрицательным
        объёмом разворачивается. Цвета считаются уже по итоговым нормалям,
        поэтому верхние грани не бывают тёмными «из-под низа».
        """
        V = np.array(self.V, np.float32)
        T = np.array(self.T, np.int64)
        if not len(T):
            return V, np.zeros((0, 3), np.uint32), np.zeros((0, 4), np.float32)
        base = np.array(self.TC, np.float64)
        mul = np.array(self.TM, np.float64)

        # --- разворот вывернутых кусков
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
        flipped = 0
        for root in np.unique(roots):
            sel = roots == root
            P = V[T[sel]].astype(np.float64)
            vol = np.einsum('ij,ij->i', P[:, 0],
                            np.cross(P[:, 1], P[:, 2])).sum() / 6.0
            if vol < -1e-7:
                T[sel] = T[sel][:, [0, 2, 1]]
                flipped += int(sel.sum())
        self.flipped = flipped

        # --- нормали и запечённое затенение по итоговой ориентации
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
        # треугольники, окрашенные генератором цилиндра, оставляем как есть:
        # у них цвет уже посчитан по своей нормали
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


def merge_pb(dst, src):
    """Слить готовую геометрию src в dst (цвета уже посчитаны и проверены)."""
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
        dst.PRE.append(True)          # уже окрашено и ориентировано
    return dst


def orient_check(pb, name, tol=0.02):
    """Все ЗАМКНУТЫЕ куски должны быть вывернуты наружу.

    Считаем знаковый объём каждого связного куска (теорема о дивергенции:
    сумма dot(a, cross(b, c)) / 6 по треугольникам). Для замкнутой оболочки
    объём положителен только при нормалях НАРУЖУ. Если минус — кусок
    вывернут: в браузере (односторонний материал) он «просвечивает».
    Возвращает список проблем.
    """
    V, comps = _components(pb)
    bad = []
    for T in comps:
        P = V[T]
        vol = np.einsum('ij,ij->i',
                        P[:, 0],
                        np.cross(P[:, 1], P[:, 2])).sum() / 6.0
        if vol < -tol:
            bad.append('%s: вывернутый кусок объёмом %.3f м3 (центр %s)'
                       % (name, vol, np.round(P.reshape(-1, 3).mean(0), 1)))
    return bad


def _pt_tri_dist(P, tri):
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


def _components(pb, eps=1e-3):
    """Связные куски геометрии (PB дублирует вершины — свариваем по позиции)."""
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
        a, b, cc = idx[tri[0]], idx[tri[1]], idx[tri[2]]
        ra, rb, rc = find(a), find(b), find(cc)
        par[rb] = ra
        par[find(rc)] = ra
    groups = {}
    for tri in T:
        groups.setdefault(find(idx[tri[0]]), []).append(tri)
    return V, [np.array(g, np.int64) for g in groups.values()]


def contact_check(details, hulls, tol_touch=0.12, tol_flat=0.38, tol_bulk=6.0, quiet=False):
    """Каждая ОТДЕЛЬНАЯ деталь декора должна касаться обшивки.

    • делим декор на связные куски (отдельные планки/трубы/ящики);
    • плоский кусок (тонкий в одном измерении) обязан ЛЕЖАТЬ: все его вершины
      не дальше tol_flat от обшивки — так ловятся «полосочки, висящие в
      воздухе параллельно борту»;
    • объёмный кусок (ящик, стойка, мачта) должен лишь КАСАТЬСЯ обшивки,
      а его центр не может быть дальше tol_bulk (ловит улетевшие детали).
    """
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
        worst_touch = 0.0
        worst_flat = 0.0
        n_float = 0
        for ci, T in enumerate(comps):
            P = V[T.reshape(-1)]
            d = _pt_tri_dist(P, tri)
            span = P.max(0) - P.min(0)
            thin = span.min() < 0.40
            worst_touch = max(worst_touch, d.min())
            if thin:
                worst_flat = max(worst_flat, d.max())
                if d.max() > opt.get('tol_flat', tol_flat):
                    n_float += 1
            cen = P.mean(0)
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
def quad_solid(pb, pts, up, dn, col_top, col_bot, col_edge=None, sgn=1):
    """Плоская деталь из четырёх точек с толщиной; грани смотрят наружу."""
    col_edge = col_edge if col_edge is not None else col_top * 0.88
    p = [np.array(q, np.float64) for q in pts]
    up_v = np.array([0.0, up, 0.0])
    dn_v = np.array([0.0, -dn, 0.0])

    def mk(q, col, want):
        pb.face(*[list(x) for x in q], col)
    top = [list(q + up_v) for q in p]
    bot = [list(q - dn_v) for q in p]
    pb.face(bot[0], bot[1], bot[2], bot[3], col_bot)
    pb.face(top[3], top[2], top[1], top[0], col_top)
    for k in range(4):
        k2 = (k + 1) % 4
        pb.face(bot[k], bot[k2], top[k2], top[k], col_edge)


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
            # обход против часовой стрелки СНАРУЖИ (иначе оболочка вывернута
            # и в браузере с односторонним материалом просвечивает насквозь)
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


# ---------------------------------------------------------------- корпус
# станции корпуса баржи: длинный плоский корпус, заострённый нос, срез в корме
UX = [-33.55, -31.6, -29.0, -26.0, -22.0, -16.0, -8.0, 1.0, 8.0, 13.0, 15.40]
UW = [0.90, 2.60, 4.20, 5.10, 5.70, 6.00, 6.15, 6.20, 6.05, 5.60, 5.20]
UYB = [5.60, 4.10, 3.10, 2.55, 2.20, 2.05, 2.00, 2.05, 2.20, 2.55, 2.90]
UYT = [7.80, 8.60, 9.00, 9.15, 9.20, 9.20, 9.20, 9.20, 9.15, 9.00, 8.70]


def cw(x):
    return float(np.interp(x, UX, UW))


def cyb(x):
    return float(np.interp(x, UX, UYB))


def cyt(x):
    return float(np.interp(x, UX, UYT))


def hull_sec(x):
    """Сечение баржи: плоское днище, прямые борта, плоская палуба."""
    w, yb, yt = cw(x), cyb(x), cyt(x)
    h = yt - yb
    return [(yb, -0.72 * w), (yb + 0.26 * h, -1.00 * w), (yb + 0.74 * h, -0.99 * w),
            (yt, -0.94 * w), (yt, 0.94 * w), (yb + 0.74 * h, 0.99 * w),
            (yb + 0.26 * h, 1.00 * w), (yb, 0.72 * w)]


def hull_palette(i, k):
    # выцветшая охра по ВСЕМУ борту, тёмный металл только снизу и на палубе
    if k in (0, 7):
        return STEEL_D if i % 2 else STEEL
    if k in (1, 6):
        return OCHRE_D if i % 2 else OCHRE
    if k in (2, 5):
        return OCHRE if i % 3 else OCHRE_L
    if k in (3, 4):
        return STEEL_L if i % 3 else OCHRE_D
    return OCHRE


def deck_y(x):
    return cyt(x)


def hull_side_pts(x, sgn=1):
    yb, yt = cyb(x), cyt(x)
    h = yt - yb
    return [(yb, 0.72 * cw(x)), (yb + 0.26 * h, 1.00 * cw(x)),
            (yb + 0.74 * h, 0.99 * cw(x)), (yt, 0.94 * cw(x))]


def skin_z(x, y, sgn=1):
    pts = hull_side_pts(x, sgn)
    z = float(np.interp(y, [p[0] for p in pts], [p[1] for p in pts]))
    return sgn * z


def side_box(pb, x, y, dx, dy, dz, col, sgn=1, out=0.10, mul=1.0):
    """Планка на БОРТУ, ПОВТОРЯЮЩАЯ наклон обшивки.

    Борт баржи наклонён, поэтому плоская вертикальная планка на нём висит
    углами (именно так рождались «полосочки в воздухе»). Здесь все четыре
    угла берутся по skin_z(), то есть планка лежит на обшивке как наклейка.
    """
    x0, x1 = x - dx / 2.0, x + dx / 2.0
    y0, y1 = y - dy / 2.0, y + dy / 2.0
    z00 = skin_z(x0, y0, sgn)
    z01 = skin_z(x0, y1, sgn)
    z10 = skin_z(x1, y0, sgn)
    z11 = skin_z(x1, y1, sgn)
    o = sgn * out
    quad = [(x0, y0, z00), (x1, y0, z10), (x1, y1, z11), (x0, y1, z01)]
    inner = [(q[0], q[1], q[2] - o) for q in quad]
    outer = [(q[0], q[1], q[2] + o) for q in quad]
    # наружная и внутренняя грани
    # обход подобран так, чтобы нормали смотрели НАРУЖУ с обеих сторон
    pb.face(outer[0], outer[3], outer[2], outer[1], col, mul)
    pb.face(inner[0], inner[1], inner[2], inner[3], col * 0.8, mul)
    for k in range(4):
        k2 = (k + 1) % 4
        pb.face(inner[k], inner[k2], outer[k2], outer[k], col * 0.86, mul)


def deck_box(pb, x, z, dx, dy, dz, col, out=0.10, mul=1.0):
    pb.box((x, deck_y(x) + out - 0.5 * dy, z), (dx, dy, dz), col, mul)


def deck_obj(pb, x, z, dx, dy, dz, col, out=0.10, mul=1.0):
    """ОБЪЁМНАЯ деталь, СТОЯЩАЯ на палубе (низ чуть утоплен в настил)."""
    pb.box((x, deck_y(x) + out + dy / 2.0, z), (dx, dy, dz), col, mul)


def belly_box(pb, x, z, dx, dy, dz, col, out=0.08, mul=1.0):
    pb.box((x, cyb(x) - out + 0.5 * dy, z), (dx, dy, dz), col, mul)


def side_run(pb, x0, x1, y, r, col, sgn=1, seg=1.25, out=0.06):
    n = max(1, int(round(abs(x1 - x0) / seg)))
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n
        xb = x0 + (x1 - x0) * (i + 1) / n
        xm = 0.5 * (xa + xb)
        if not (cyb(xm) + 0.35 < y < cyt(xm) + 0.10):
            continue
        z = skin_z(xm, y, sgn) + sgn * (out - r)
        pb.cyl(xm, y, z, r, abs(xb - xa) + 0.10, axis='x', seg=6, color=col)


def side_run_box(pb, x0, x1, y, dx, dy, dz, col, sgn=1, seg=1.2, out=0.08):
    n = max(1, int(round(abs(x1 - x0) / seg)))
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n
        xb = x0 + (x1 - x0) * (i + 1) / n
        xm = 0.5 * (xa + xb)
        side_box(pb, xm, y, abs(xb - xa) + 0.06, dy, dz, col, sgn=sgn, out=out)


def deck_run(pb, x0, x1, z, w, t, col, seg=1.4, out=0.06):
    n = max(1, int(round(abs(x1 - x0) / seg)))
    for i in range(n):
        xa = x0 + (x1 - x0) * i / n
        xb = x0 + (x1 - x0) * (i + 1) / n
        xm = 0.5 * (xa + xb)
        deck_box(pb, xm, z, abs(xb - xa) + 0.08, t, w, col, out=out)


# ---------------------------------------------------------------- узлы
def hull_skin():
    """Обшивка: лофт корпуса, скуловой «плуг» носа, палуба-настил."""
    pb = PB()
    loft(pb, UX, hull_sec, hull_palette, cap_col=STEEL)
    # --- носовой «плуг»: гранёный форштевень под кабиной
    for sgn in (-1, 1):
        pb.face((-33.55, cyb(-33.55) + 0.10, sgn * 0.60),
                (-33.55, cyt(-33.55) - 0.30, sgn * 0.60),
                (-31.0, cyt(-31.0) - 0.50, sgn * 2.60),
                (-31.0, cyb(-31.0) + 0.20, sgn * 2.60), OCHRE_D)
        pb.face((-31.0, cyb(-31.0) + 0.20, sgn * 2.60),
                (-31.0, cyt(-31.0) - 0.50, sgn * 2.60),
                (-28.2, cyt(-28.2) - 0.35, sgn * 4.40),
                (-28.2, cyb(-28.2) + 0.45, sgn * 4.20), OCHRE)
    pb.face((-33.55, cyb(-33.55) + 0.10, -0.60), (-33.55, cyb(-33.55) + 0.10, 0.60),
            (-31.0, cyb(-31.0) - 0.10, 1.40), (-31.0, cyb(-31.0) - 0.10, -1.40), STEEL_L)
    # --- настил палубы (риббон-полосы между шпангоутами)
    for x in np.arange(-27.0, 14.0, 1.6):
        deck_box(pb, x, 0.0, 0.34, 0.10, 2 * 0.90 * cw(x), STEEL_L if int(x) % 2 else STEEL,
                 out=0.05)
    return pb


def hull_trim():
    """Панелировка, скуловые накладки, люки — ВСЁ по обшивке (skin_z/deck_y)."""
    pb = PB()
    for sgn in (-1, 1):
        for x in np.arange(-30.0, 14.0, 2.3):
            side_box(pb, x, cyb(x) + 0.34, 2.1, 0.30, 0.16, STEEL_D, sgn=sgn, out=0.09)
            side_box(pb, x, cyt(x) - 0.30, 1.9, 0.16, 0.14, STEEL_D, sgn=sgn, out=0.08)
        # охристые бортовые листы (главный цвет баржи)
        side_run_box(pb, -27.0, -2.0, cyb(-14.0) + 0.95, 1.6, 1.05, 0.16, OCHRE, sgn=sgn,
                     seg=1.8, out=0.08)
        side_run_box(pb, -24.0, 6.0, cyb(-6.0) + 2.15, 1.4, 0.70, 0.14, OCHRE_D, sgn=sgn,
                     seg=1.8, out=0.07)
        # красная труба-ограждение по борту грузовой палубы
        side_run(pb, -21.0, 12.0, cyt(-4.0) - 0.30, 0.16, RED_L, sgn=sgn, seg=1.6, out=0.10)
        # стяжки-шпангоуты на борту
        for x in np.arange(-26.0, 10.0, 3.6):
            side_box(pb, x, cyb(x) + 1.90, 0.22, 2.40, 0.20, STEEL, sgn=sgn, out=0.10)
        # скуловая накладка с решёткой
        for i, x in enumerate(np.arange(-24.0, 8.0, 4.0)):
            side_box(pb, x, cyb(x) + 0.62, 2.8, 0.50, 0.22, STEEL_L if i % 2 else STEEL,
                     sgn=sgn, out=0.12)
            for k in range(3):
                side_box(pb, x - 0.9 + k * 0.9, cyb(x) + 0.64, 0.20, 0.36, 0.10, STEEL_D,
                         sgn=sgn, out=0.18)
    # палубные бронеплиты
    for i, x in enumerate(np.arange(-27.0, 13.0, 2.6)):
        deck_box(pb, x, 0.0, 2.30, 0.08, 1.94 * cw(x), OCHRE_L if i % 2 else OCHRE,
                 out=0.06)
        deck_box(pb, x + 1.26, 0.0, 0.12, 0.09, 1.94 * cw(x) + 0.06, STEEL_D, out=0.06)
    return pb


# станции рубки — одни и те же для надстройки и для остекления
BST = [-33.20, -31.6, -29.4, -26.4, -22.60]
BW = [4.30, 4.55, 4.80, 4.80, 4.45]
BYB = [9.05, 9.10, 9.15, 9.15, 9.10]
BYT = [12.90, 13.70, 14.10, 14.05, 13.30]


def bridge_w(x):
    return float(np.interp(x, BST, BW))


def bridge_yb(x):
    return float(np.interp(x, BST, BYB))


def bridge_yt(x):
    return float(np.interp(x, BST, BYT))


def bridge_cabin():
    """Носовая рубка: охристый бронеблок с ленточным бирюзовым остеклением."""
    pb = PB()
    X0, X1 = BST[0], BST[-1]
    st, w, yb, yt = BST, BW, BYB, BYT

    def sec(x):
        ww = float(np.interp(x, st, w))
        b = float(np.interp(x, st, yb))
        t = float(np.interp(x, st, yt))
        return [(b, -ww), (t - 0.55, -ww), (t, -0.80 * ww), (t, 0.80 * ww),
                (t - 0.55, ww), (b, ww)]
    loft(pb, st, sec, lambda i, k: (OCHRE_L if k in (2, 3) else
                                   (OCHRE if k in (1, 4) else OCHRE_D)), cap_col=OCHRE)
    # --- броневой козырёк над лобовым стеклом
    pb.face((-33.28, 12.55, -4.30), (-33.28, 12.55, 4.30),
            (-31.90, 13.35, 3.95), (-31.90, 13.35, -3.95), OCHRE_H)
    pb.box((-32.45, 12.90, 0.0), (1.40, 0.18, 8.20), OCHRE_L)
    # --- рёбра по крыше рубки
    for z in np.arange(-3.6, 3.7, 1.8):
        pb.box((-27.6, 14.22, z), (8.4, 0.20, 0.26), STEEL_D)
    # --- выхлопной стек и антенны на крыше (толстые, без шпилей)
    pb.cyl(-26.6, 14.60, 2.55, 0.62, 1.40, axis='y', seg=10, color=STEEL_D)
    pb.cyl(-26.6, 15.35, 2.55, 0.50, 0.20, axis='y', seg=10, color=DARK)
    pb.cyl(-26.8, 14.50, -2.60, 0.52, 1.20, axis='y', seg=10, color=STEEL)
    # --- бортовые люки и поручни рубки
    for sgn in (-1, 1):
        pb.box((-29.4, 11.20, sgn * 4.76), (3.20, 2.40, 0.14), OCHRE_L)
        pb.box((-29.4, 11.20, sgn * 4.84), (2.60, 1.90, 0.10), OCHRE_D)
        pb.box((-29.4, 11.20, sgn * 4.90), (2.70, 0.44, 0.06), STEEL_D)
        for k in range(3):
            pb.box((-30.4 + k * 1.0, 12.40, sgn * 4.86), (0.16, 0.80, 0.10), STEEL_D)
        pb.box((-31.6, 13.40, sgn * 2.10), (1.00, 0.24, 1.00), STEEL_D)
    return pb


def canopy():
    """Бирюзовое ленточное остекление рубки — ЛЕЖИТ на её стенах.

    Каждая точка ленты берётся по фактической ширине рубки bridge_w(x) плюс
    0.05 м наружу, поэтому стекло нигде не утоплено и не висит в воздухе.
    """
    pb = PB()
    X0, X1 = BST[0], BST[-1]
    OUT = 0.05
    # лобовая лента (чуть впереди лобовой грани рубки)
    xf = X0 - OUT
    pb.face((xf, 11.35, -3.95), (xf, 11.35, 3.95),
            (xf, 12.60, 4.15), (xf, 12.60, -4.15), GLASS_L * 0.72)
    # бортовые ленты — по ширине рубки на каждой станции
    xs = [-32.9, -31.6, -29.4, -27.6, -26.2]
    for sgn in (-1, 1):
        for k in range(len(xs) - 1):
            xa, xb = xs[k], xs[k + 1]
            za = bridge_w(xa) + OUT
            zb = bridge_w(xb) + OUT
            ya0, ya1 = bridge_yb(xa) + 2.15, bridge_yb(xa) + 3.45
            yb0, yb1 = bridge_yb(xb) + 2.15, bridge_yb(xb) + 3.45
            col = GLASS_L * (0.66 if k % 2 else 0.60)
            if sgn > 0:
                pb.face((xa, ya1, za), (xb, yb1, zb), (xb, yb0, zb), (xa, ya0, za), col)
            else:
                pb.face((xa, ya0, -za), (xb, yb0, -zb), (xb, yb1, -zb), (xa, ya1, -za), col)
        # стойки переплёта
        for x in xs[:-1]:
            pb.box((x + 0.35, bridge_yb(x) + 2.80, sgn * (bridge_w(x) + OUT)),
                   (0.18, 1.30, 0.18), STEEL_D)
    # центральная стойка лобового стекла
    pb.box((xf, 11.95, 0.0), (0.12, 1.30, 0.30), STEEL_D)
    return pb


def intake(sgn):
    """Круглый воздухозаборник, ВПИСАННЫЙ в скулу носа (а не «ухо» сбоку)."""
    pb = PB()
    pb.m = sgn
    cx, cy, cz = -31.0, 9.30, sgn * 2.70
    # кожух-стакан, стыкующийся с бортом и с рубкой
    pb.box((cx + 0.30, cy + 0.10, sgn * 1.90), (3.60, 3.40, 2.60), OCHRE_D)
    pb.cyl(cx, cy, cz, 2.00, 2.20, axis='x', seg=16, color=OCHRE)
    pb.cyl(cx + 0.85, cy, cz, 2.10, 0.50, axis='x', seg=16, color=OCHRE_L)
    pb.cyl(cx - 1.12, cy, cz, 1.86, 0.30, axis='x', seg=16, color=STEEL_D)
    pb.cyl(cx - 1.24, cy, cz, 1.56, 0.16, axis='x', seg=16, color=DARK)
    # внутренние лопатки
    for k in range(6):
        a = math.pi * k / 6.0
        pb.box((cx - 0.70, cy + 1.02 * math.cos(a), cz + 1.02 * math.sin(a)),
               (0.90, 0.22, 0.22), STEEL)
    # стяжки-раскосы от кожуха к корпусу и к рубке
    pb.seg((cx + 0.30, cy - 1.30, sgn * 1.90), (cx + 1.60, cy - 1.90, sgn * 3.40),
           0.30, 0.30, STEEL_D, ref=(1, 0, 0))
    pb.seg((cx + 0.30, cy + 1.40, sgn * 1.90), (cx + 1.30, cy + 2.10, sgn * 2.60),
           0.26, 0.26, STEEL_D, ref=(1, 0, 0))
    return pb


def cargo_deck():
    """Рама грузовой палубы: продольные балки, стойки ограждения, настил."""
    pb = PB()
    # продольные балки-комингсы по краям палубы
    for sgn in (-1, 1):
        for x in np.arange(-21.0, 13.0, 2.0):
            deck_box(pb, x, sgn * 5.05, 2.20, 0.34, 0.44, STEEL, out=0.20)
        # стойки ограждения + красная труба сверху
        for x in np.arange(-20.0, 12.5, 2.6):
            deck_box(pb, x, sgn * 5.05, 0.26, 1.55, 0.26, STEEL_L, out=0.10)
        pb.box((0.0, deck_y(0.0) + 1.60, sgn * 5.05), (33.0, 0.16, 0.16), RED_L)
        pb.box((0.0, deck_y(0.0) + 1.05, sgn * 5.05), (33.0, 0.10, 0.10), RED)
    # поперечные балки-ложементы под контейнеры
    for x in np.arange(-19.0, 12.0, 5.4):
        deck_box(pb, x, 0.0, 0.50, 0.26, 9.60, STEEL_L, out=0.16)
    return pb


def container(i, sgn):
    """Грузовой контейнер на палубе: рёбра, торцевые створки, стяжки."""
    pb = PB()
    x = -16.6 + i * 5.6
    z = sgn * 2.55
    body = (BOX, OCHRE_L, OLIVE_L, BOX, OCHRE)[i % 5]
    y0 = deck_y(x) + 0.08                       # поддон на настиле
    cy = y0 + 1.55
    pb.box((x, cy, z), (5.10, 3.10, 4.30), body)
    # рёбра жёсткости
    for k in range(6):
        pb.box((x - 2.10 + k * 0.84, cy, z), (0.20, 3.16, 4.34), body * 1.22)
    # торцевые створки и замки
    for sx in (-1, 1):
        pb.box((x + sx * 2.58, cy, z), (0.14, 2.80, 4.10), BOX_D)
        for dz in (-1.4, 0.0, 1.4):
            pb.box((x + sx * 2.66, cy, z + dz), (0.10, 0.30, 0.30), STEEL_D)
    # маркировочная полоса на контейнере
    pb.box((x, y0 + 2.55, z), (5.12, 0.30, 4.32), body * 1.35)
    # верхняя крышка с накаткой
    pb.box((x, y0 + 3.22, z), (5.16, 0.24, 4.36), body * 1.28)
    pb.box((x, y0 + 0.05, z), (5.30, 0.18, 4.50), STEEL_D)
    return pb


def deck_crane():
    """Палубный кран-деррик у кормового края грузовой палубы."""
    pb = PB()
    x = 11.6
    y0 = deck_y(x)
    # тумба
    pb.box((x, y0 + 0.90, 0.0), (2.20, 1.80, 2.20), STEEL)
    pb.box((x, y0 + 1.95, 0.0), (1.60, 0.30, 1.60), STEEL_L)
    pb.cyl(x, y0 + 2.30, 0.0, 0.55, 0.60, axis='y', seg=10, color=OLIVE)
    # стрела вперёд-вверх (к палубе)
    pb.seg((x, y0 + 2.50, 0.0), (x - 7.40, y0 + 6.20, 0.0), 0.62, 0.62, OLIVE_L)
    pb.seg((x, y0 + 2.50, 0.0), (x - 3.60, y0 + 5.20, 0.0), 0.30, 0.30, OLIVE)
    # ферма-раскосы стрелы
    for k in range(4):
        t0 = 0.25 + k * 0.20
        t1 = t0 + 0.20
        ax = x - 7.40 * t0
        ay = y0 + 2.50 + 3.70 * t0
        bx = x - 7.40 * t1
        by = y0 + 2.50 + 3.70 * t1
        pb.seg((ax, ay, 0.0), (bx, by - 0.42, 0.0), 0.16, 0.16, STEEL_D)
    # противовес и блок
    pb.box((x + 1.30, y0 + 1.90, 0.0), (1.60, 1.20, 1.60), STEEL_D)
    pb.cyl(x - 7.40, y0 + 6.10, 0.0, 0.30, 0.80, axis='y', seg=8, color=BRONZE_L)
    # трос с крюком
    pb.seg((x - 7.40, y0 + 5.90, 0.0), (x - 7.40, y0 + 3.10, 0.0), 0.10, 0.10, DARK_M)
    pb.box((x - 7.40, y0 + 2.90, 0.0), (0.40, 0.60, 0.40), STEEL_D)
    return pb


def turret(sgn):
    """Турель на палубе: основание, вертлюг, спарка стволов вперёд."""
    pb = PB()
    pb.m = sgn
    x, z = -20.4, sgn * 3.45
    y = deck_y(x)
    pb.cyl(x, y + 0.34, z, 1.05, 0.68, axis='y', seg=12, color=STEEL)
    pb.cyl(x, y + 0.76, z, 0.86, 0.30, axis='y', seg=12, color=STEEL_L)
    pb.box((x, y + 1.28, z), (1.70, 0.92, 1.40), OCHRE_D)
    pb.box((x, y + 1.86, z), (1.10, 0.30, 1.00), OCHRE)
    for dz in (-0.34, 0.34):
        pb.cyl(x - 1.30, y + 1.34, z + dz, 0.16, 2.10, axis='x', seg=8, color=STEEL_D)
        pb.cyl(x - 2.30, y + 1.34, z + dz, 0.21, 0.42, axis='x', seg=8, color=DARK_M)
    return pb


def radar_tower():
    """Радиомачта: ферма-стакан с решётчатой антенной (толстая, не шпиль)."""
    pb = PB()
    x = -23.2
    y0 = deck_y(x)
    # ферма: 4 стойки + раскосы
    for dx in (-0.8, 0.8):
        for dz in (-0.8, 0.8):
            pb.box((x + dx, y0 + 3.10, dz), (0.28, 6.20, 0.28), STEEL_L)
    for k in range(5):
        yy = y0 + 0.8 + k * 1.20
        pb.box((x, yy, 0.0), (1.90, 0.16, 1.90), STEEL_D)
        for s in (-1, 1):
            pb.box((x + s * 0.8, yy + 0.60, 0.0), (0.14, 1.30, 0.14), STEEL_D)
            pb.box((x, yy + 0.60, s * 0.8), (0.14, 1.30, 0.14), STEEL_D)
    # платформа и решётчатая антенна
    pb.box((x, y0 + 6.30, 0.0), (2.40, 0.28, 2.40), STEEL)
    for k in range(4):
        pb.box((x - 0.60 + k * 0.40, y0 + 7.60, 0.0), (0.14, 2.40, 1.90), STEEL_L)
    pb.box((x, y0 + 8.95, 0.0), (0.90, 0.24, 2.10), OCHRE_L)
    # флагшток (толстая труба, не шпиль) — по чертежу на рубке
    pb.cyl(x + 1.55, y0 + 9.10, 0.0, 0.16, 5.00, axis='y', seg=8, color=STEEL_L)
    pb.box((x + 1.55, y0 + 10.90, 0.55), (0.10, 1.30, 1.90), RED_L)
    pb.cyl(x + 1.55, y0 + 11.70, 0.0, 0.09, 0.60, axis='y', seg=6, color=GREY)
    # прожектор на площадке
    pb.cyl(x + 0.95, y0 + 6.70, 0.90, 0.26, 0.36, axis='y', seg=8, color=AMBER * 0.9)
    return pb


def engine_frame():
    """Кормовая открытая ферма: боковые балки, раскосы, рама сопел."""
    pb = PB()
    for sgn in (-1, 1):
        # боковые балки фермы
        pb.box((22.4, 8.10, sgn * 5.30), (17.0, 0.90, 0.90), OLIVE)
        pb.box((22.4, 5.20, sgn * 4.90), (16.0, 0.70, 0.70), OLIVE_L)
        pb.box((22.4, 11.10, sgn * 4.90), (16.0, 0.60, 0.60), OLIVE_L)
        # раскосы
        for k in range(6):
            x = 15.6 + k * 2.6
            pb.box((x, 6.65, sgn * 5.05), (0.20, 3.10, 0.20), OLIVE)
            pb.box((x, 9.70, sgn * 5.10), (0.20, 1.70, 0.20),
                   OLIVE_L if k % 2 else OLIVE)
        # поперечные связи
        for x in (16.4, 21.0, 25.6, 29.2):
            pb.box((x, 5.30, 0.0), (0.34, 0.34, 10.60), OLIVE)
            pb.box((x, 11.05, 0.0), (0.28, 0.28, 9.80), OLIVE_L)
    # рама блока сопел
    pb.box((30.6, 8.20, 0.0), (1.40, 8.60, 11.40), STEEL_D)
    for sgn in (-1, 1):
        pb.box((30.6, 8.20, sgn * 5.20), (1.60, 8.80, 0.60), STEEL)
    # технологические короба на ферме
    for sgn in (-1, 1):
        pb.box((19.4, 9.60, sgn * 4.10), (4.60, 1.40, 1.80), STEEL)
        pb.box((19.4, 10.40, sgn * 4.10), (3.20, 0.30, 1.20), STEEL_L)
    return pb


# --- сопла: геометрия из одних чисел и для металла, и для свечения
NOZ_X0 = 30.90          # начало раструба
NOZ_X1 = 32.90          # срез
NOZ_R = 2.02            # радиус большого сопла
NOZ_RS = 1.42           # радиус малых
NOZ_POS = [(0.0, 0.0, NOZ_R), (2.95, 2.95, NOZ_RS), (2.95, -2.95, NOZ_RS),
           (-2.95, 2.95, NOZ_RS), (-2.95, -2.95, NOZ_RS)]
NOZ_CY = 8.20


def nozzle_cluster():
    """Блок из пяти сопел: обечайка, раструб, тёмное устье, рёбра."""
    pb = PB()
    for (dy, dz, r) in NOZ_POS:
        cy, cz = NOZ_CY + dy, dz
        pb.cyl(NOZ_X0 + 0.55, cy, cz, r * 1.06, 1.10, axis='x', seg=16, color=STEEL)
        pb.cyl(NOZ_X1 - 0.30, cy, cz, r * 0.94, 0.60, axis='x', seg=16, color=STEEL_L)
        pb.cyl(NOZ_X1 - 0.05, cy, cz, r * 0.78, 0.20, axis='x', seg=16, color=STEEL_D)
        pb.cyl(NOZ_X0 + 1.05, cy, cz, r * 0.55, 0.60, axis='x', seg=16, color=DARK_M)
        # рёбра охлаждения
        for k in range(8):
            a = 2.0 * math.pi * k / 8.0
            pb.box((NOZ_X0 + 0.55, cy + r * 1.02 * math.cos(a), cz + r * 1.02 * math.sin(a)),
                   (1.00, 0.16, 0.16), STEEL_D)
    return pb


def thrusters():
    """Свечение в устьях пяти сопел — строго внутри круга среза."""
    pb = PB()
    for (dy, dz, r) in NOZ_POS:
        cy, cz = NOZ_CY + dy, dz
        rr = r * 0.80
        seg = 16
        for k in range(seg):
            a0 = 2.0 * math.pi * k / seg
            a1 = 2.0 * math.pi * (k + 1) / seg
            p0 = (NOZ_X1 - 0.16, cy + rr * math.cos(a0), cz + rr * math.sin(a0))
            p1 = (NOZ_X1 - 0.16, cy + rr * math.cos(a1), cz + rr * math.sin(a1))
            pb.tri((NOZ_X1 - 0.16, cy, cz), p0, p1, CYAN * 0.95)
        # внутренние лопатки
        for k in range(4):
            a = 2.0 * math.pi * k / 4.0 + 0.4
            pb.box((NOZ_X1 - 0.34, cy + rr * 0.5 * math.cos(a), cz + rr * 0.5 * math.sin(a)),
                   (0.10, rr * 0.9, 0.14), CYAN * 0.55)
    return pb


def pod(sgn, i):
    """Бортовая рёбристая гондола-радиатор (по два барабана на борт)."""
    pb = PB()
    pb.m = sgn
    x = 17.4 + i * 6.8
    y = 7.10
    z = sgn * (10.60 + i * 0.28)
    pb.cyl(x, y, z, 1.84, 3.90, axis='x', seg=16, color=OLIVE)
    # рёбра радиатора — тёмный металл, чтобы барабан не читался «колесом»
    for k in range(7):
        pb.cyl(x - 1.65 + k * 0.55, y, z, 2.12, 0.18, axis='x', seg=16, color=STEEL_D)
    # торцевые кольца, ось и патрубки
    pb.cyl(x + 1.98, y, z, 1.94, 0.24, axis='x', seg=16, color=STEEL)
    pb.cyl(x - 1.98, y, z, 1.94, 0.24, axis='x', seg=16, color=STEEL)
    pb.cyl(x, y, z, 0.52, 4.60, axis='x', seg=10, color=OLIVE_L)
    for dz in (-0.9, 0.9):
        pb.cyl(x + 1.90, y + 1.30, z + dz, 0.26, 0.60, axis='x', seg=8, color=BRONZE_L)
    # пилон к корпусу (мост от борта до гондолы) + подкос
    pb.box((x, y + 0.10, sgn * 8.00), (3.20, 1.20, 4.40), OLIVE)
    pb.box((x, y + 0.80, sgn * 8.00), (2.40, 0.30, 3.20), OLIVE_L)
    pb.seg((x, y - 1.10, sgn * 8.20), (x, y - 0.10, sgn * 6.60), 0.36, 0.36,
           OLIVE_L, ref=(1, 0, 0))
    return pb


def cm_pod(sgn):
    """Блок контрмер на борту."""
    pb = PB()
    pb.m = sgn
    x = 6.0
    y = cyb(x) + 2.30
    pb.box((x, y, sgn * 5.60), (2.40, 0.90, 0.80), STEEL_L)
    pb.box((x, y, sgn * 5.90), (1.90, 0.60, 0.50), STEEL_D)
    for k in range(4):
        pb.cyl(x - 0.7 + k * 0.46, y, sgn * 6.05, 0.13, 0.30, axis='z', seg=6,
               color=BRONZE_L)
    return pb


def cargo_hold():
    """Грузовой трюм под палубой: комингс, поддоны, переборки (виден при люке)."""
    pb = PB()
    # комингс колодца в палубе
    for sgn in (-1, 1):
        deck_box(pb, 4.6, sgn * 2.55, 6.20, 0.26, 0.30, STEEL, out=0.04)
    deck_box(pb, -1.4, 0.0, 0.30, 0.26, 5.40, STEEL, out=0.04)
    deck_box(pb, 10.6, 0.0, 0.30, 0.26, 5.40, STEEL, out=0.04)
    # дно трюма и поддоны
    pb.box((4.6, deck_y(4.6) - 2.60, 0.0), (11.6, 0.30, 5.00), STEEL_D)
    for i in range(3):
        for j in range(2):
            pb.box((1.2 + i * 3.4, deck_y(4.6) - 2.10, -1.60 + j * 3.20),
                   (2.60, 0.70, 2.60), BOX_L if (i + j) % 2 else BOX)
    # переборки
    for sgn in (-1, 1):
        pb.box((4.6, deck_y(4.6) - 1.35, sgn * 2.60), (12.0, 2.70, 0.24), STEEL)
    return pb


def cargo_lid(sgn):
    """Створка грузового люка в палубе: петля на комингсе, раскрытие наружу."""
    pb = PB()
    pb.m = sgn
    # локальные координаты: петля в начале координат, полотно вдоль -Z
    pb.box((0.0, 0.10, -sgn * 2.55), (6.00, 0.22, 5.00), OCHRE_L)
    pb.box((0.0, 0.26, -sgn * 2.55), (5.40, 0.12, 4.40), OCHRE)
    for k in range(4):
        pb.box((-2.20 + k * 1.46, 0.34, -sgn * 2.55), (0.20, 0.14, 4.60), STEEL_D)
    pb.box((0.0, 0.34, -sgn * 5.00), (6.10, 0.20, 0.30), STEEL)
    return pb


def leg(i):
    """Посадочная лыжа-стойка: локальный ноль — пятно контакта на Y = 0."""
    pb = PB()
    h = LEGS[i][2]
    for dz in (-0.62, 0.62):
        pb.box((0.0, h * 0.46, dz), (0.60, h * 0.92, 0.34), STEEL)
        pb.box((0.0, h * 0.30, dz * 1.5), (0.40, 1.10, 0.22), STEEL_L)
    # лыжа
    pb.box((0.0, 0.22, 0.0), (3.40, 0.44, 2.10), STEEL_D)
    pb.box((0.0, 0.48, 0.0), (2.60, 0.24, 1.50), STEEL)
    pb.box((0.0, 0.10, 0.0), (3.60, 0.20, 2.30), DARK_M)
    # верхний узел
    pb.box((0.0, h - 0.40, 0.0), (1.60, 0.90, 1.90), OLIVE)
    pb.cyl(0.0, h * 0.55, 0.0, 0.26, 1.30, axis='y', seg=8, color=BRONZE_L)
    return pb


LEGS = [(-26.0, 4.55, 3.05), (9.6, 4.55, 3.05), (-26.0, -4.55, 3.05), (9.6, -4.55, 3.05)]


def greebles():
    """Мелочь: магистрали, люки, поручни, ящики — всё по обшивке."""
    pb = PB()
    for sgn in (-1, 1):
        side_run(pb, -28.0, -3.0, cyb(-14.0) + 0.85, 0.13, BRONZE_L, sgn=sgn, seg=1.3)
        side_run(pb, -24.0, 2.0, cyb(-10.0) + 1.45, 0.09, BRONZE, sgn=sgn, seg=1.3)
        # люки обслуживания
        for x in (-25.0, -15.0, -6.0, 3.0):
            side_box(pb, x, cyb(x) + 0.80, 1.8, 0.62, 0.16, STEEL_L, sgn=sgn, out=0.09)
            side_box(pb, x, cyb(x) + 0.80, 1.3, 0.40, 0.10, STEEL_D, sgn=sgn, out=0.12)
        # ящики ЗИП на палубе
        for x in (-21.5, 11.0):
            deck_obj(pb, x, sgn * 4.10, 1.30, 0.80, 1.10, OLIVE_L, out=0.12)
        # стяжки фермы под днищем
        for k in range(3):
            x = -8.0 + k * 5.0
            belly_box(pb, x, sgn * 3.30, 3.0, 0.18, 0.28, STEEL_D, out=0.10)
    # лестница-скоба на БОРТУ РУБКИ (скобы держатся за стенку рубки)
    for sgn in (-1, 1):
        for k in range(5):
            pb.box((-26.60, 9.90 + k * 0.46, sgn * 4.72), (0.90, 0.12, 0.30), STEEL_D)
    return pb


def decals():
    """Ливрея: жёлтые полосы, шеврон Fimbul, трафареты, чёрные канты."""
    pb = PB()
    for sgn in (-1, 1):
        # чёрная полоса-кант по борту
        side_run_box(pb, -26.0, 8.0, cyb(-12.0) + 1.62, 1.4, 0.14, 0.08, DARK_M, sgn=sgn,
                     seg=1.6, out=0.07)
        # охристая полоса-молния под кантом
        side_run_box(pb, -24.0, 6.0, cyb(-12.0) + 1.38, 1.4, 0.22, 0.08, OCHRE_H, sgn=sgn,
                     seg=1.6, out=0.07)
        # трафарет «FIMBUL» планками на борту
        for k in range(6):
            x = -20.4 + k * 0.60
            side_box(pb, x, cyb(x) + 2.05, 0.30, 0.32, 0.07, WHITE_D, sgn=sgn, out=0.07)
        # красные предупредительные прямоугольники у люков
        for x in (-25.0, 3.0):
            side_box(pb, x, cyb(x) + 1.30, 0.60, 0.42, 0.07, RED_L, sgn=sgn, out=0.08)
        # трафареты на палубе
        for k in range(5):
            deck_box(pb, -13.0 + k * 0.55, sgn * 1.20, 0.26, 0.05, 0.72, WHITE_D * 0.8,
                     out=0.05)
    return pb


def lights():
    """Прожекторы, палубные огни, подсветка трюма."""
    pb = PB()
    for sgn in (-1, 1):
        # прожекторы под скулой носа
        pb.cyl(-29.4, cyb(-29.4) - 0.04, sgn * 2.6, 0.30, 0.20, axis='y', seg=8,
               color=AMBER * 0.9)
        # палубные огни вдоль комингсов
        for x in (-18.0, -8.0, 2.0, 11.0):
            deck_box(pb, x, sgn * 4.55, 0.30, 0.10, 0.30, AMBER * 0.85, out=0.12)
        # подсветка трюма (внутри)
        deck_run(pb, 0.0, 9.5, sgn * 2.30, 0.14, 0.10, CYAN * 0.75, seg=1.4, out=-2.30)
    return pb


def beacon():
    """Красные стробы на мачте и на кормовой ферме."""
    pb = PB()
    for sgn in (-1, 1):
        pb.cyl(15.9, 11.45, sgn * 4.90, 0.22, 0.22, axis='y', seg=8, color=RED_L)
        pb.box((15.9, 11.35, sgn * 4.90), (0.50, 0.16, 0.50), STEEL_D)
    pb.cyl(-23.2, deck_y(-23.2) + 9.25, 0.0, 0.24, 0.24, axis='y', seg=8, color=RED_L)
    return pb


def main():
    b = GlbBuilder()
    m_hull = b.material('pl_hull', metallic=0.62, roughness=0.48)
    m_dark = b.material('pl_dark', metallic=0.72, roughness=0.36)
    m_glass = b.material('pl_glass', metallic=0.16, roughness=0.14)
    m_glow = b.material('pl_glow', metallic=0.0, roughness=0.26)
    m_thrust = b.material('pl_thrust', metallic=0.0, roughness=0.20)

    stats = {}
    tris = 0
    REF = {}

    def add(name, pb, mat, pos=None, kind=None, rot=None):
        nonlocal tris
        REF[name] = pb
        v, t, c = pb.get()
        idx = b.mesh(name, v, t, c, mat)
        b.node(name, idx, translation=pos, rotation=rot)
        stats[name] = (len(v), len(t))
        tris += len(t)
        if kind:
            check(pb, kind, off=pos or (0, 0, 0))

    skin = hull_skin()
    trim = hull_trim()
    ch = merge_pb(skin, trim)
    add('center_hull', ch, m_hull, kind='hull')

    br = bridge_cabin()
    add('bridge', br, m_hull, kind='hull')
    add('canopy', canopy(), m_glass)
    for sgn in (1, -1):
        tag = 'r' if sgn > 0 else 'l'
        add('intake_' + tag, intake(sgn), m_hull, kind='hull')

    add('cargo_deck', cargo_deck(), m_hull, kind='hull')
    for i in range(5):
        for sgn in (1, -1):
            tag = 'r' if sgn > 0 else 'l'
            add('container_%s%d' % (tag, i), container(i, sgn), m_hull, kind='hull')
    add('cargo_hold', cargo_hold(), m_hull, kind='hull')
    for sgn in (1, -1):
        tag = 'r' if sgn > 0 else 'l'
        add('cargo_lid_' + tag, cargo_lid(sgn), m_hull,
            pos=[4.6, deck_y(4.6) + 0.06, sgn * 2.70], kind='lid' + tag)
        add('turret_' + tag, turret(sgn), m_hull, kind='turret' + tag)
        add('cm_pod_' + tag, cm_pod(sgn), m_hull, kind='hull')

    add('radar_tower', radar_tower(), m_hull, kind='hull')
    add('deck_crane', deck_crane(), m_hull, kind='hull')
    add('engine_frame', engine_frame(), m_hull, kind='hull')
    add('nozzle_cluster', nozzle_cluster(), m_dark, kind='hull')
    for sgn in (1, -1):
        tag = 'r' if sgn > 0 else 'l'
        for i in range(2):
            add('pod_%s%d' % (tag, i), pod(sgn, i), m_hull, kind='hull')

    _thr = thrusters()
    add('thrusters', _thr, m_thrust)
    _gr, _dc, _li, _bc = greebles(), decals(), lights(), beacon()
    add('greebles', _gr, m_glow)
    add('decals', _dc, m_glow)
    add('lights', _li, m_glow)
    add('beacon', _bc, m_glow)
    for i in range(len(LEGS)):
        add('leg_%d' % i, leg(i), m_hull,
            pos=[LEGS[i][0], -0.02, LEGS[i][1]])

    # --- свечение строго в круге среза сопла
    for (vx, vy, vz) in _thr.V:
        for (dy, dz, r) in NOZ_POS:
            cy, cz = NOZ_CY + dy, dz
            d = ((vy - cy) ** 2 + (vz - cz) ** 2) ** 0.5
            if d <= r * 0.82:
                break
        else:
            raise SystemExit('свечение вылезло за круг устья: %.2f м' % d)
        if vx > NOZ_X1 + 1e-6:
            raise SystemExit('свечение торчит из среза наружу: x %.2f' % vx)
    print('  посадка сопел: 5 струй внутри кругов среза (%.0f%% радиуса)'
          % (0.80 * 100))

    # ---------------- ориентация граней (чтобы ничего не «просвечивало») ----
    orient_bad = []
    for _nm, _pb in REF.items():
        orient_bad += orient_check(_pb, _nm)
    print('ориентация граней: %s' % ('OK (всё наружу)' if not orient_bad else
                                     'НЕ ИСПРАВЛЕНО: %d кусков' % len(orient_bad)))
    for _q in orient_bad[:12]:
        print('   ', _q)
    if orient_bad:
        raise SystemExit('вывернутые грани остались: %d' % len(orient_bad))

    data = b.build('packlite')
    open(os.path.join(P, 'packlite.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-16s verts %5d tris %5d' % (k, nv, nt))

    modes = {
        'pad':    {'legs': 1.0, 'guns': 0.0, 'bay': 0.0, 'lid': 0.0, 'thrust': 0.0,
                   'strobe': 0.30, 'spots': 0.45, 'interior': 0.45},
        'flight': {'legs': 0.0, 'guns': 0.0, 'bay': 0.0, 'lid': 0.0, 'thrust': 0.70,
                   'strobe': 0.55, 'spots': 1.0, 'interior': 0.55},
        'hunt':   {'legs': 0.0, 'guns': 1.0, 'bay': 0.0, 'lid': 0.0, 'thrust': 0.88,
                   'strobe': 1.0, 'spots': 1.0, 'interior': 0.70},
        'load':   {'legs': 1.0, 'guns': 0.0, 'bay': 1.0, 'lid': 1.0, 'thrust': 0.0,
                   'strobe': 0.40, 'spots': 0.85, 'interior': 1.0},
    }
    json.dump({'pods': 2, 'guns': 2, 'legs': len(LEGS), 'barrels_per_pod': 2,
               'gun_elev_deg': 16.0, 'bay_open_deg': 82.0, 'ramp_open_deg': 0.0,
               'ramp_ext_len': 0.0, 'leg_retract': 2.0,
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
         'cargo_deck': (REF['cargo_deck'], {'tol_max': 0.80})},
        [skin, REF['cargo_deck'], REF['engine_frame'], REF['bridge'],
         REF['radar_tower'], REF['cargo_hold'], REF['container_r0'], REF['container_l0'],
         REF['deck_crane']])
    print('посадка декора на обшивку: %s' % ('OK' if not float_bad else float_bad))
    if float_bad:
        raise SystemExit('декор не лежит на корпусе: ' + '; '.join(float_bad))

    # ---------------- контроль по записанному файлу ----------------
    raw = open(os.path.join(P, 'packlite.glb'), 'rb').read()
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
