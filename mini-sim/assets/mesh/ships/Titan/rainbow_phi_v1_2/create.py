#!/usr/bin/env python3
"""Rainbow Phi — Titan, Anomaly, 3236 × 2863 × 1583 м, экипаж 255.

Форма строго по официальному blueprint (вид сбоку / сверху / два три-четверти):
  * ПЛОСКИЙ профиль: сверху тонкий треугольный обод (рама-плита), ниже —
    отдельная нижняя палуба; между ними открытый с борта каньон.
  * Внутри обода — концентрические террасы, спускающиеся ступенями вниз,
    на дне каньона золотой треугольник-эмблема Rainbow.
  * Снизу — пологая килевая надстройка (даёт паспортную высоту), без шпилей
    и мастов: на чертеже их нет.
Обшивка (photoli) набрана плитами на ободе, террасах и нижней палубе;
восемь секций поднимаются световым полем (позы)."""
import numpy as np, json, math, os
from glb_writer import GlbBuilder, box_colored, merge, quad

P = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261112)

LEN, WID = 3236.0, 2863.0
APEX = np.array([-LEN / 2, 0.0, 0.0])
B0 = np.array([LEN / 2, 0.0, WID / 2])
B1 = np.array([LEN / 2, 0.0, -WID / 2])
TRI = np.array([APEX, B0, B1])
CEN = TRI.mean(axis=0)

# --- вертикальная раскладка (плоский корпус) ---
RIM_TOP, RIM_BOT = 120.0, 40.0            # верхний обод: тонкая плита
STEPS = [                                  # (доля внутрь, верх ступени) — каньон
    (0.26, 20.0),
    (0.46, -90.0),
    (0.64, -200.0),
]
DECK_TOP, DECK_BOT = -260.0, -330.0        # ангарная палуба: сборочный цех
EMBLEM_Y = DECK_TOP + 2.0
SECTIONS = 16                              # гранулярность разборки
LOWER_TOP, LOWER_BOT = -420.0, -470.0      # нижняя палуба (вторая тонкая плита)
KEEL_BOT = -1460.0                         # пологий киль: общая высота ≈ 1580 м
RIM_W = 240.0

GOLD = np.array([1.0, 0.66, 0.26])
EMBER = np.array([1.0, 0.42, 0.12])
ICE = np.array([0.55, 0.78, 1.0])
STEEL_D = np.array([0.115, 0.125, 0.138])
STEEL_M = np.array([0.175, 0.185, 0.198])
STEEL_L = np.array([0.245, 0.252, 0.262])
COPPER = np.array([0.235, 0.155, 0.105])


def inset(f):
    return CEN + (TRI - CEN) * (1.0 - f)


def p_uv(r0, r1, k, u, v):
    a = r0[k] + (r0[(k + 1) % 3] - r0[k]) * u
    b = r1[k] + (r1[(k + 1) % 3] - r1[k]) * u
    return a + (b - a) * v


def y_of(p, y):
    return np.array([p[0], y, p[2]])


def z_span(x, f=0.0):
    """Диапазон z треугольника, сжатого к центру на долю f, при данном x.
    Нужен, чтобы разметка палубы и стапели не выходили за корпус."""
    t = inset(f)
    (ax, _, az), (bx, _, bz), (cx, _, cz) = t
    if x < min(ax, bx, cx) or x > max(ax, bx, cx):
        return None
    zs = []
    for (x0, z0), (x1, z1) in (((ax, az), (bx, bz)), ((bx, bz), (cx, cz)), ((cx, cz), (ax, az))):
        if abs(x1 - x0) < 1e-9:
            continue
        u = (x - x0) / (x1 - x0)
        if -1e-6 <= u <= 1 + 1e-6:
            zs.append(z0 + (z1 - z0) * u)
    if len(zs) < 2:
        return None
    return min(zs), max(zs)


def flat_band(r_out, r_in, y_top, y_bot, c_top, c_out, c_in, c_bot=None):
    """Плоская треугольная полоса (обод / ступень террасы): верх, низ,
    外部 и внутренняя кромки — ничего не торчит вверх."""
    c_bot = c_top * 0.5 if c_bot is None else c_bot
    parts = []
    for k in range(3):
        a0 = p_uv(r_out, r_in, k, 0.0, 0.0)
        a1 = p_uv(r_out, r_in, k, 1.0, 0.0)
        a2 = p_uv(r_out, r_in, k, 1.0, 1.0)
        a3 = p_uv(r_out, r_in, k, 0.0, 1.0)
        parts.append(quad(y_of(a0, y_top), y_of(a1, y_top), y_of(a2, y_top), y_of(a3, y_top), c_top))
        parts.append(quad(y_of(a0, y_bot), y_of(a3, y_bot), y_of(a2, y_bot), y_of(a1, y_bot), c_bot))
        parts.append(quad(y_of(a0, y_bot), y_of(a1, y_bot), y_of(a1, y_top), y_of(a0, y_top), c_out))
        parts.append(quad(y_of(a3, y_top), y_of(a2, y_top), y_of(a2, y_bot), y_of(a3, y_bot), c_in))
    return merge(parts)


# ---------- верхний обод ----------
def hull_ring():
    r_out, r_in = inset(0.0), inset(RIM_W / 1449.0)
    parts = [flat_band(r_out, r_in, RIM_TOP, RIM_BOT, STEEL_M * 1.2, STEEL_D * 1.1, STEEL_D * 0.85)]
    # ребро жёсткости по внешней кромке (низкая полка, не штырь)
    r_o2 = inset(-0.006)
    parts.append(flat_band(r_o2, r_out, RIM_TOP + 26.0, RIM_TOP - 30.0,
                           STEEL_L * 1.05, STEEL_D * 1.05, STEEL_M * 0.9))
    return merge(parts)


# ---------- террасы каньона ----------
def terraces():
    parts = []
    for i, (f, y) in enumerate(STEPS):
        f_next = STEPS[i + 1][0] if i + 1 < len(STEPS) else 0.64
        r_out = inset(f)
        r_in = inset(f_next - 0.02)
        shade = 0.9 + 0.1 * i
        parts.append(flat_band(r_out, r_in, y, y - 64.0,
                               STEEL_M * shade, STEEL_D * 1.05, STEEL_D * 0.7,
                               c_bot=STEEL_D * 0.6))
        # стенка-откос между ступенями (невысокая, внутри каньона)
        if i + 1 < len(STEPS):
            y2 = STEPS[i + 1][1]
            for k in range(3):
                a = p_uv(r_in, r_in, k, 0.0, 0.0)
                b = p_uv(r_in, r_in, k, 1.0, 0.0)
                parts.append(quad(y_of(a, y - 64.0), y_of(a, y2), y_of(b, y2), y_of(b, y - 64.0),
                                  STEEL_D * 0.95))
    return merge(parts)


# ---------- эмблема ----------
def core_emblem():
    parts = []
    f = 0.30
    rr = inset(f)
    ri = inset(f + 0.05)
    for k in range(3):
        a = y_of(p_uv(rr, ri, k, 0.03, 0.0), EMBLEM_Y + 3.0)
        b = y_of(p_uv(rr, ri, k, 0.97, 0.0), EMBLEM_Y + 3.0)
        c = y_of(p_uv(rr, ri, k, 0.97, 1.0), EMBLEM_Y + 3.0)
        d = y_of(p_uv(rr, ri, k, 0.03, 1.0), EMBLEM_Y + 3.0)
        parts.append(quad(a, b, c, d, GOLD))
        # внутренняя заливка — тёмная плита с золотым подсветом по краю
        a2 = y_of(p_uv(ri, inset(f + 0.11), k, 0.03, 0.0), EMBLEM_Y + 1.0)
        b2 = y_of(p_uv(ri, inset(f + 0.11), k, 0.97, 0.0), EMBLEM_Y + 1.0)
        c2 = y_of(p_uv(ri, inset(f + 0.11), k, 0.97, 1.0), EMBLEM_Y + 1.0)
        d2 = y_of(p_uv(ri, inset(f + 0.11), k, 0.03, 1.0), EMBLEM_Y + 1.0)
        parts.append(quad(a2, b2, c2, d2, GOLD * 0.35))
    return merge(parts)


# ---------- нижняя палуба и пологий киль ----------
def lower_hull():
    r_out, r_in = inset(0.06), inset(0.92)
    parts = [flat_band(r_out, r_in, LOWER_TOP, LOWER_BOT,
                       STEEL_D * 1.25, STEEL_M * 0.95, STEEL_D * 0.8,
                       c_bot=STEEL_D * 0.75)]
    return merge(parts)


def keel():
    """Пологий ступенчатый киль под нижней палубой — паспортная высота,
    без шпилей: широкий, с двумя уступами."""
    parts = []
    a = inset(0.30)
    b = inset(0.46)
    c = inset(0.60)
    levels = [(inset(0.24), inset(0.40), LOWER_BOT, -640.0, 1.30),
              (inset(0.30), inset(0.46), -640.0, -880.0, 1.15),
              (inset(0.36), inset(0.52), -880.0, -1120.0, 1.0),
              (inset(0.42), inset(0.56), -1120.0, KEEL_BOT, 0.88)]
    for (r_out, r_in, y0, y1, k) in levels:
        parts.append(flat_band(r_out, r_in, y0, y1, STEEL_M * k, STEEL_M * k * 0.8,
                               STEEL_D * 0.9, c_bot=STEEL_M * k * 0.7))
    # плиты на стенках киля (обшивка photoli)
    for (r_out, r_in, y0, y1, k) in levels:
        for side in range(3):
            for i in range(5):
                u0, u1 = i / 5 + 0.01, (i + 1) / 5 - 0.01
                a = y_of(p_uv(r_out, inset(0.0), side, u0, 0.0), y1 + 20.0)
                b = y_of(p_uv(r_out, inset(0.0), side, u1, 0.0), y1 + 20.0)
                parts.append(quad(np.array([a[0], y0 + (y1 - y0) * 0.15, a[2]]),
                                  np.array([b[0], y0 + (y1 - y0) * 0.15, b[2]]),
                                  np.array([b[0], y0 + (y1 - y0) * 0.85, b[2]]),
                                  np.array([a[0], y0 + (y1 - y0) * 0.85, a[2]]),
                                  pick_color() * 0.9))
    return merge(parts)


def hangar_deck():
    """Ангарная палуба — сборочный цех внутри каньона (≈2.2 км²)."""
    parts = [flat_band(inset(0.64), inset(1.02), DECK_TOP, DECK_BOT,
                       STEEL_D * 1.45, STEEL_M * 0.9, STEEL_D * 0.9,
                       c_bot=STEEL_D * 0.7)]
    # разметка палубы: сетка световых линий (полосы хода)
    for gx in (-1150, -800, -450, -100, 250, 600, 950):
        sp = z_span(gx, 0.68)
        if not sp:
            continue
        z0, z1 = sp[0] + 40, sp[1] - 40
        if z1 - z0 < 60:
            continue
        a = np.array([gx, DECK_TOP + 1.5, z0])
        b = np.array([gx, DECK_TOP + 1.5, z1])
        parts.append(quad(a, b, np.array([gx + 8, DECK_TOP + 1.5, z1]),
                          np.array([gx + 8, DECK_TOP + 1.5, z0]), GOLD * 0.55))
    return merge(parts)


def docks():
    """Стапели под большие корабли: рамы-ложа с подсветкой.
    Ложе 460 × 150 м — в него встаёт Rainbow Arc (130 м) в любую сторону."""
    parts = []
    spots = [(-1150, 0.5), (-800, -0.45), (-800, 0.45), (-450, -0.5), (-450, 0.0),
             (-450, 0.5), (-100, -0.45), (-100, 0.45), (250, -0.4), (250, 0.4),
             (600, 0.0), (950, 0.0)]
    for (cx, zf) in spots:
        sp = z_span(cx, 0.68)
        if not sp:
            continue
        zc = (sp[0] + sp[1]) / 2 + (sp[1] - sp[0]) * 0.5 * zf
        half = min(220.0, (sp[1] - sp[0]) * 0.22)
        if half < 70:
            continue
        cz = zc
        w, d = 420.0, 2 * half
        y = DECK_TOP + 2.0
        # контур ложа
        pts = [np.array([cx - w / 2, y, cz - d / 2]), np.array([cx + w / 2, y, cz - d / 2]),
               np.array([cx + w / 2, y, cz + d / 2]), np.array([cx - w / 2, y, cz + d / 2])]
        for i in range(4):
            p0, p1 = pts[i], pts[(i + 1) % 4]
            parts.append(quad(p0, p1, p1 + np.array([0, 0, 0]), p0, GOLD * 0.7))
            n = p1 - p0
            n = n / (np.linalg.norm(n) or 1)
            off = np.array([-n[2], 0, n[0]]) * 10.0
            parts.append(quad(p0, p1, p1 + off, p0 + off, GOLD * 0.8))
        # ложе-опоры по краям
        for sx in (-1, 1):
            parts.append(box_colored(cx + sx * (w / 2 - 20), y + 16, cz, 40, 32, d,
                                     STEEL_D * 1.4, top=1.3, side=0.85, bottom=0.6))
    return merge(parts)


def gantries():
    """Сборочные краны-порталы над стапелями: две стойки и траверса.
    Высота держится ниже обода — силуэт корабля не меняется."""
    parts = []
    for (gx, zf, spanf) in ((-1000, 0.0, 0.8), (-620, -0.5, 0.75), (-620, 0.5, 0.75),
                            (-200, 0.0, 0.9), (200, -0.45, 0.7), (200, 0.45, 0.7),
                            (650, 0.0, 0.6)):
        sp = z_span(gx, 0.70)
        if not sp:
            continue
        span = (sp[1] - sp[0]) * spanf
        if span < 160:
            continue
        gz = (sp[0] + sp[1]) / 2 + (sp[1] - sp[0]) * 0.5 * zf
        base = DECK_TOP + 4.0
        h = 320.0
        col = 34.0
        for sz in (-1, 1):
            parts.append(box_colored(gx, base + h / 2, gz + sz * span / 2, col, h, col,
                                     STEEL_M * 1.1, top=1.25, side=0.85, bottom=0.6))
        # траверса
        parts.append(box_colored(gx, base + h, gz, col * 1.1, col * 1.1, span + col,
                                 STEEL_L * 0.95, top=1.3, side=0.9, bottom=0.7))
        # световая полоса на траверсе
        parts.append(quad(np.array([gx, base + h - 6, gz - span / 2]),
                          np.array([gx, base + h - 6, gz + span / 2]),
                          np.array([gx, base + h + 4, gz + span / 2]),
                          np.array([gx, base + h + 4, gz - span / 2]), EMBER))
    return merge(parts)


def fleet():
    """Силуэты больших кораблей на стапелях: показывает, что Titan — цех,
    в который встаёт флот. Три типа корпусов, размеры разные (не клоны)."""
    parts = []
    ships = [(-1150, 0.0, 0), (-800, -0.45, 1), (-800, 0.45, 2), (-450, -0.5, 0),
             (-450, 0.5, 1), (-100, -0.45, 2), (-100, 0.45, 0), (250, -0.4, 1),
             (250, 0.4, 2), (600, 0.0, 0), (950, 0.0, 1)]
    shapes = [(520.0, 96.0, 74.0), (380.0, 190.0, 58.0), (250.0, 128.0, 92.0)]
    for (cx, zf, kind) in ships:
        sp = z_span(cx, 0.68)
        if not sp:
            continue
        zc = (sp[0] + sp[1]) / 2 + (sp[1] - sp[0]) * 0.5 * zf
        ln, wd, ht = shapes[kind]
        if (sp[1] - sp[0]) < wd * 1.2:
            continue
        y = DECK_TOP + 18.0 + ht / 2
        col = STEEL_M * rng.uniform(0.75, 1.05)
        parts.append(box_colored(cx, y, zc, ln, ht, wd, col, top=1.28, side=0.8, bottom=0.5))
        # рёбра и надстройка — свой рисунок у каждого типа
        if kind == 0:
            for i in range(4):
                bx = cx - ln / 2 + ln * (0.25 + 0.5 * i / 3)
                parts.append(box_colored(bx, y + ht * 0.62, zc, ln * 0.06, ht * 0.30, wd * 0.92,
                                         STEEL_D * 1.5, top=1.3, side=0.8, bottom=0.6))
        elif kind == 1:
            parts.append(box_colored(cx + ln * 0.22, y + ht * 0.6, zc, ln * 0.3, ht * 0.34, wd * 0.55,
                                     STEEL_D * 1.4, top=1.3, side=0.8, bottom=0.6))
        else:
            for sz in (-1, 1):
                parts.append(box_colored(cx, y + ht * 0.55, zc + sz * wd * 0.3,
                                         ln * 0.42, ht * 0.3, wd * 0.26,
                                         STEEL_D * 1.4, top=1.3, side=0.8, bottom=0.6))
        # подсветка стапеля под кораблём
        parts.append(quad(np.array([cx - ln / 2 + 6, DECK_TOP + 6, zc - wd / 2 + 4]),
                          np.array([cx + ln / 2 - 6, DECK_TOP + 6, zc - wd / 2 + 4]),
                          np.array([cx + ln / 2 - 6, DECK_TOP + 6, zc + wd / 2 - 4]),
                          np.array([cx - ln / 2 + 6, DECK_TOP + 6, zc + wd / 2 - 4]),
                          EMBER * 0.5))
    return merge(parts)


# ---------- обшивка ----------
def pick_color():
    r = rng.random()
    if r < 0.10:
        base = COPPER * rng.uniform(0.7, 1.2)
    elif r < 0.42:
        base = STEEL_L * rng.uniform(0.8, 1.15)
    elif r < 0.75:
        base = STEEL_M * rng.uniform(0.85, 1.2)
    else:
        base = STEEL_D * rng.uniform(0.9, 1.5)
    return np.clip(base, 0, 1)


def side_plate(k, u0, u1, v0, v1, r_out, r_in, y, thick=8.0, color=None):
    """Плита обшивки, лежащая на плоскости (тонкая, с бортиком)."""
    c = pick_color() if color is None else color
    top = y + thick
    a = [y_of(p_uv(r_out, r_in, k, u, v), top) for (u, v) in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
    parts = [quad(a[0], a[1], a[2], a[3], c * 1.18)]
    parts.append(quad(y_of(p_uv(r_out, r_in, k, u0, v0), y), y_of(p_uv(r_out, r_in, k, u1, v0), y),
                      a[1], a[0], c * 0.82))
    parts.append(quad(y_of(p_uv(r_out, r_in, k, u1, v1), y), y_of(p_uv(r_out, r_in, k, u0, v1), y),
                      a[3], a[2], c * 0.76))
    parts.append(quad(y_of(p_uv(r_out, r_in, k, u0, v1), y), y_of(p_uv(r_out, r_in, k, u0, v0), y),
                      a[0], a[3], c * 0.88))
    parts.append(quad(y_of(p_uv(r_out, r_in, k, u1, v0), y), y_of(p_uv(r_out, r_in, k, u1, v1), y),
                      a[2], a[1], c * 0.72))
    return merge(parts)


def build_plates():
    """SECTIONS секций обшивки. Плиты собираются в общий список и сортируются
    по (сторона, положение вдоль стороны) — тогда секции равны по числу плит
    и при разборке расходятся связными кусками, а не вперемешку."""
    items = []
    r_out, r_in = inset(0.0), inset(RIM_W / 1449.0)
    # обод — 3 стороны × 16 × 2 ячейки
    for k in range(3):
        for i in range(16):
            for j in range(2):
                u0, u1 = i / 16 + 0.004, (i + 1) / 16 - 0.004
                v0 = 0.06 + 0.88 * j / 2
                v1 = 0.06 + 0.88 * (j + 1) / 2 - 0.02
                items.append(((k, i / 16.0, j), side_plate(k, u0, u1, v0, v1, r_out, r_in,
                                                           RIM_TOP, 7.0 + rng.uniform(0, 4))))
    # террасы — 3 стороны × 6 ячеек на ступень
    for ti, (f, y) in enumerate(STEPS):
        f_next = STEPS[ti + 1][0] if ti + 1 < len(STEPS) else 0.64
        rr, ri = inset(f + 0.008), inset(f_next - 0.03)
        for k in range(3):
            for i in range(6):
                u0, u1 = i / 6 + 0.006, (i + 1) / 6 - 0.006
                items.append(((k, i / 6.0, 2 + ti),
                              side_plate(k, u0, u1, 0.12, 0.88, rr, ri, y + 2.0, 5.0)))
    # нижняя палуба — внешнее кольцо, 3 × 10
    rl_out, rl_in = inset(0.06), inset(0.30)
    for k in range(3):
        for i in range(10):
            u0, u1 = i / 10 + 0.005, (i + 1) / 10 - 0.005
            items.append(((k, i / 10.0, 6), side_plate(k, u0, u1, 0.1, 0.9, rl_out, rl_in,
                                                       LOWER_TOP, 6.0)))
    items.sort(key=lambda it: it[0])
    buckets = [[] for _ in range(SECTIONS)]
    n = len(items)
    for idx, (_, part) in enumerate(items):
        buckets[min(SECTIONS - 1, idx * SECTIONS // n)].append(part)
    return [merge(b) if b else None for b in buckets]


def wall_plates():
    """Плиты на кромке обода (вид «крепости» сбоку) — вертикальные, тонкие."""
    parts = []
    r_out, r_in = inset(0.0), inset(0.012)
    for k in range(3):
        for i in range(14):
            u0, u1 = i / 14 + 0.006, (i + 1) / 14 - 0.006
            yb, yt = RIM_BOT + 6.0, RIM_TOP - 6.0
            a = y_of(p_uv(r_out, r_in, k, u0, 0.0), yb)
            b = y_of(p_uv(r_out, r_in, k, u1, 0.0), yb)
            parts.append(quad(a, b, np.array([b[0], yt, b[2]]), np.array([a[0], yt, a[2]]),
                              pick_color() * 0.95))
    return merge(parts)


def greebles():
    """Мелкая механизация внутри каньона (на террасах) — как на референсах."""
    parts = []
    for ti, (f, y) in enumerate(STEPS):
        f_next = STEPS[ti + 1][0] if ti + 1 < len(STEPS) else f + 0.14
        rr, ri = inset(f + 0.02), inset(f_next - 0.05)
        for k in range(3):
            for i in range(14):
                u = 0.05 + 0.9 * i / 13
                v = 0.2 + 0.6 * ((i * 0.53 + ti * 0.31) % 1.0)
                p = p_uv(rr, ri, k, u, v)
                w = rng.uniform(16, 46)
                h = rng.uniform(8, 26)
                parts.append(box_colored(p[0], y + h / 2, p[2], w, h, w * rng.uniform(0.7, 1.3),
                                         STEEL_D * rng.uniform(0.9, 1.6), top=1.35, side=0.85,
                                         bottom=0.6))
    return merge(parts)


def edge_lights():
    """Световые швы: по внутренней кромке обода и по ступеням каньона."""
    parts = []
    r_out, r_in = inset(0.0), inset(RIM_W / 1449.0)
    for k in range(3):
        for (v, col) in ((0.995, GOLD), (0.02, EMBER * 0.9)):
            a = y_of(p_uv(r_out, r_in, k, 0.0, v), RIM_TOP + 2.0)
            b = y_of(p_uv(r_out, r_in, k, 1.0, v), RIM_TOP + 2.0)
            d = y_of(p_uv(r_out, r_in, k, 1.0, v + 0.02), RIM_TOP + 2.0)
            e = y_of(p_uv(r_out, r_in, k, 0.0, v + 0.02), RIM_TOP + 2.0)
            parts.append(quad(a, b, d, e, col))
    # швы по нижней кромке обода — те самые оранжевые линии с обложки
    for k in range(3):
        u0 = 0.03
        a = y_of(p_uv(r_out, inset(-0.004), k, u0, 0.0), RIM_BOT - 2.0)
        b = y_of(p_uv(r_out, inset(-0.004), k, 1.0 - u0, 0.0), RIM_BOT - 2.0)
        parts.append(quad(a, b, np.array([b[0], RIM_BOT - 8.0, b[2]]),
                          np.array([a[0], RIM_BOT - 8.0, a[2]]), EMBER))
    return merge(parts)


def engines():
    """Двигатели в корме, заподлицо с нижней палубой (ничего не торчит)."""
    parts = []
    xb = LEN / 2 - 60.0
    for i in range(7):
        z = -1080 + 360 * i
        parts.append(box_colored(xb - 90, LOWER_BOT + 40, z, 170, 130, 210,
                                 STEEL_D * 1.2, top=1.2, side=0.8, bottom=0.6))
        parts.append(quad([xb + 6, LOWER_BOT - 6, z - 78], [xb + 6, LOWER_BOT + 104, z - 78],
                          [xb + 6, LOWER_BOT + 104, z + 78], [xb + 6, LOWER_BOT - 6, z + 78],
                          STEEL_D * 1.5))
        parts.append(quad([xb + 10, LOWER_BOT + 16, z - 44], [xb + 10, LOWER_BOT + 84, z - 44],
                          [xb + 10, LOWER_BOT + 84, z + 44], [xb + 10, LOWER_BOT + 16, z + 44],
                          ICE * 0.75))
    return merge(parts)


# ---------- сборка ----------
def main():
    b = GlbBuilder()
    m_hull = b.material('phi_hull', metallic=0.35, roughness=0.6)
    m_plate = b.material('phi_panels', metallic=0.45, roughness=0.5)
    m_glow = b.material('phi_glow', metallic=0.0, roughness=0.35)
    m_eng = b.material('phi_engine', metallic=0.2, roughness=0.6, double_sided=True)

    stats = {}
    tris = 0

    def add(name, merged, mat):
        nonlocal tris
        v, t, c = merged
        idx = b.mesh(name, v, t, c, mat)
        b.node(name, idx)
        stats[name] = (len(v), len(t))
        tris += len(t)

    add('hull_ring', hull_ring(), m_hull)
    add('terraces', terraces(), m_hull)
    add('core_emblem', core_emblem(), m_glow)
    add('hangar_deck', hangar_deck(), m_hull)
    add('docks', docks(), m_glow)
    add('gantries', gantries(), m_hull)
    add('fleet', fleet(), m_plate)
    add('lower_hull', lower_hull(), m_hull)
    add('keel', keel(), m_hull)
    for si, geo in enumerate(build_plates()):
        if geo is not None:
            add('plates_%d' % si, geo, m_plate)
    add('wall_plates', wall_plates(), m_plate)
    add('greebles', greebles(), m_hull)
    add('edge_lights', edge_lights(), m_glow)
    add('engines', engines(), m_eng)

    data = b.build('rainbow_phi')
    open(os.path.join(P, 'rainbow_phi.glb'), 'wb').write(data)
    print('nodes', len(b.nodes), 'tris', tris, 'bytes', len(data))
    for k, (nv, nt) in stats.items():
        print('  %-12s verts %5d tris %5d' % (k, nv, nt))

    # позы: смещение секции + её поворот (градусы), чтобы разборка читалась
    modes = {'cruise': [], 'levitation': [], 'shield': [], 'iris': [], 'dismantle': []}
    rots = {'cruise': [], 'levitation': [], 'shield': [], 'iris': [], 'dismantle': []}
    for i in range(SECTIONS):
        t = i / (SECTIONS - 1.0)
        ang = 2 * math.pi * t
        modes['cruise'].append([0.0, 0.0, 0.0])
        modes['levitation'].append([round(24 * math.sin(ang), 2),
                                    round(140 + 150 * math.sin(math.pi * t + 1.1), 2),
                                    round(26 * math.cos(ang), 2)])
        modes['shield'].append([round(-60 * (0.4 + t), 2), round(34 * (1 - t), 2), 0.0])
        modes['iris'].append([round(150 * (t - 0.5), 2),
                              round(320 * (0.55 + 0.45 * math.sin(ang)), 2),
                              round(90 * (t - 0.5), 2)])
        # полная разборка: каждая секция уходит по своей траектории и
        # разворачивается — корпус распадается на части
        modes['dismantle'].append([round(520 * math.cos(ang), 2),
                                   round(420 + 520 * abs(math.sin(ang * 0.5)), 2),
                                   round(520 * math.sin(ang), 2)])
        rots['dismantle'].append([round(22 * math.sin(ang), 2),
                                  round(28 * math.cos(ang * 1.5), 2),
                                  round(18 * math.sin(ang * 2.0), 2)])
        for m in ('cruise', 'levitation', 'shield', 'iris'):
            rots[m].append([0.0, 0.0, 0.0])
    json.dump({'sections': SECTIONS, 'modes': modes, 'rotations': rots},
              open(os.path.join(P, 'modes.json'), 'w'), indent=1)
    print('modes.json')


if __name__ == '__main__':
    main()
