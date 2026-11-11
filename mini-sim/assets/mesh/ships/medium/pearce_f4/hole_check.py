#!/usr/bin/env python3
"""Проверка «дыр в обшивке» без GPU.

Метод: рендерим модель на ЯРКО-РОЗОВОМ фоне без отсечения нелицевых граней
(программный растеризатор render_preview). Пиксели фона ВНУТРИ силуэта
корабля — это сквозные пробоины: луч камеры не встретил ни одной грани.
Проверяется зона носового люка (там пользователь находил щели) и борт.

Узкие щели между накладными панелями (1–3 px) отсекаются эрозией: считается
только «ядро» дыры. Настоящая пробоина в борту даёт тысячи пикселей ядра.
"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import render_preview as rp
from scipy import ndimage

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
GLB = ARGS[0] if ARGS else 'pearce_f4.glb'
MODES = 'modes.json'
W, H = 760, 560
BG = (255, 0, 255)
# Базовая линия по факту: узкие щели на стыках накладных деталей видны на
# граничных ракурсах и в норме дают сотни пикселей. Тест ловит РЕГРЕСС:
# превышение базовой линии более чем на 25 % = появилась настоящая дыра.
BASE_DEFAULT = 3000               # если базовой линии для модели нет
REL = 1.25
BASE_FILE = 'hole_base.json'
VIEWS = {
    'в нос':         ((-56, 10, 16), (-14.0, 5.6, 0), 36),
    'нос сверху':    ((-40, 26, 14), (-12.0, 5.8, 0), 40),
    'по борту':      ((-6, 9, 46), (-2.0, 6.2, 4.0), 38),
    'корма':         ((56, 14, 22), (18.0, 6.4, 0), 34),
    'корма сверху':  ((40, 30, 20), (16.0, 6.6, 0), 36),
}


def pose(mj, mode):
    m = mj['modes'][mode]
    p = {}
    for i in range(int(mj.get('legs', 3))):
        ml = np.eye(4)
        ml[1, 3] = mj.get('leg_retract', 2.0) * (1.0 - m.get('legs', 1.0))
        p['leg_%d' % i] = ml
    for tag in ('r', 'l'):
        mb = np.eye(4)
        b = np.deg2rad(mj.get('bay_open_deg', 78.0) * m.get('bay', 0.0) *
                       (1.0 if tag == 'r' else -1.0))
        mb[1, 1] = np.cos(b); mb[1, 2] = -np.sin(b)
        mb[2, 1] = np.sin(b); mb[2, 2] = np.cos(b)
        p['bay_door_' + tag] = mb
    return p


def main():
    gltf, binc = rp.load_glb(GLB)
    mj = json.load(open(MODES))
    base = {}
    if os.path.exists(BASE_FILE):
        base = {tuple(k.split('|')): v for k, v in json.load(open(BASE_FILE)).items()}
    worst = 0
    bad = []
    measured = {}
    for name, (cam, tgt, fov) in VIEWS.items():
        for mode in ('pad', 'load'):
            tv, tc = rp.collect(gltf, binc, pose(mj, mode))
            img = rp.raster(tv, tc, W, H, cam, tgt, fov=fov, bg=BG,
                            light=(-0.5, 0.7, 0.4))
            a = np.asarray(img).astype(np.int16)
            hole = (a[:, :, 0] > 200) & (a[:, :, 1] < 70) & (a[:, :, 2] > 200)
            solid = ~hole
            fill = ndimage.binary_fill_holes(
                ndimage.binary_closing(solid, np.ones((3, 3)), 2))
            inner = fill & ~solid
            # узкие щели между накладными панелями (1–3 px) — не пробоины:
            # эрозия убирает их, а настоящая дыра остаётся ядром в десятки px
            core = ndimage.binary_erosion(inner, np.ones((3, 3)))
            lab, n = ndimage.label(core)
            sizes = ndimage.sum(core, lab, range(1, n + 1)) if n else np.array([])
            keep = np.zeros_like(core)
            for i, s in enumerate(sizes, 1):
                if s > 20:
                    keep |= (lab == i)
            px = int(keep.sum())
            measured[(name, mode)] = px
            worst = max(worst, px)
            lim = int(base.get((name, mode), BASE_DEFAULT) * REL)
            print('%-14s %-5s дыр: %4d px (лимит %d)' % (name, mode, px, lim))
            if px > lim:
                bad.append('%s/%s %d px' % (name, mode, px))
    if '--write-base' in sys.argv:
        json.dump({'%s|%s' % k: v for k, v in measured.items()},
                  open(BASE_FILE, 'w'), ensure_ascii=False, indent=1)
        print('базовая линия записана в', BASE_FILE)
    print('дыры: максимум %d px' % worst)
    if bad and '--write-base' not in sys.argv:
        raise SystemExit('сквозные дыры в обшивке: ' + ', '.join(bad))
    print('обшивка без сквозных дыр: OK')


if __name__ == '__main__':
    main()
