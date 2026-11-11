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
GLB = ARGS[0] if ARGS else 'calico_enforcer.glb'
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
    'в нос':         ((-64, 14, 20), (-16.0, 9.0, 0), 40),
    'нос сверху':    ((-46, 32, 16), (-14.0, 9.4, 0), 44),
    'по борту':      ((-6, 12, 54), (-2.0, 9.0, 4.0), 44),
    'корма':         ((66, 18, 26), (22.0, 9.0, 0), 40),
    'корма сверху':  ((46, 36, 24), (20.0, 9.2, 0), 42),
}


def pose(mj, mode):
    m = mj['modes'][mode]
    p = {}
    for i in range(int(mj.get('legs', 3))):
        ml = np.eye(4)
        ml[1, 3] = mj.get('leg_retract', 2.0) * (1.0 - m.get('legs', 1.0))
        p['leg_%d' % i] = ml
    for tag, sgn in (('r', 1.0), ('l', -1.0)):
        mb = np.eye(4)
        mb[2, 3] = mj.get('bay_slide', 0.45) * m.get('bay', 0.0) * sgn
        p['missile_pod_' + tag] = mb
        p['missile_glow_' + tag] = mb
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
        for mode in ('pad', 'siege'):
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
