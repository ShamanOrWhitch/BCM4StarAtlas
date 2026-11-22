#!/usr/bin/env python3
"""Ring boss art -> closed, thick, double-textured GLB meshes + a stage spec.

Input : source boss art and phase-art/phase-art-rear references
Output: six base GLBs plus phase-forms GLBs consumed by ring-platformer.js

The supplied art is a 3/4 illustration, not an orthographic sculpt sheet. The
mesh is therefore an honest thick silhouette extrusion: a bevelled side wall,
a front art cap, and a separately textured rear-reference cap. It is a closed
volumetric mesh, not a full anatomical or skeletal rig. Front and rear art stay
visible when the player/camera is behind the model; the old depth was only 17%
of height (about 6% actual Z bounds), while this pass uses about 54% actual Z.

Animations baked per form: "idle", "hit", "transform_out", "transform_in".
The runtime also adds a phase-shift particle/ring effect while swapping forms.

    python3 tools/ring-bosses/to_mesh.py
"""
import json
import math
import pathlib
import struct
import sys

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage
from skimage import measure
import shapely.geometry as sg
from mapbox_earcut import triangulate_float64

ART = pathlib.Path("mini-sim/assets/ring-bosses")
OUT = ART / "mesh"
BEVEL_STEPS = [(1.000, 0.985), (0.984, 0.820), (0.955, 0.560)]  # (silhouette scale, z fraction)
BACK_Z = -0.985          # fraction of half depth
CONTOUR_TOLERANCE = 0.0016  # of the image diagonal
MIN_HOLE_AREA = 0.0008      # of the silhouette area
INK = [0.035, 0.045, 0.065, 1.0]


# ---------------------------------------------------------------- silhouette
def rings_from_alpha(alpha: np.ndarray):
    """Outer contour + holes of the silhouette, in pixel space (x right, y down)."""
    mask = alpha > 128
    mask = ndimage.binary_closing(mask, np.ones((5, 5)))
    mask = ndimage.binary_fill_holes(mask)  # keep the silhouette solid, holes below
    raw = measure.find_contours(np.pad(mask, 1).astype(float), 0.5)
    polys = [sg.Polygon(c[:, ::-1] - 1) for c in raw]
    polys = [p.buffer(0) for p in polys if p.area > 4]
    outer = max(polys, key=lambda p: p.area)

    # Holes: holes the ink art actually has (space between legs, ring gaps).
    holes = []
    solid = ndimage.binary_fill_holes(alpha > 128)
    ring_only = solid & ~(alpha > 128)
    ring_only = ndimage.binary_opening(ring_only, np.ones((7, 7)))
    for c in measure.find_contours(np.pad(ring_only, 1).astype(float), 0.5):
        p = sg.Polygon(c[:, ::-1] - 1).buffer(0)
        if p.area > MIN_HOLE_AREA * outer.area and outer.contains(p):
            holes.append(p)

    tol = CONTOUR_TOLERANCE * math.hypot(*alpha.shape)
    outer = outer.simplify(tol, preserve_topology=True)
    holes = [h.simplify(tol, preserve_topology=True) for h in holes]
    return outer, [h for h in holes if h.area > MIN_HOLE_AREA * outer.area]


def polygon_rings(outer: sg.Polygon, holes):
    """Earcut input: one flat array of x,y and the ring end indices."""
    coords, ends = [], []
    for ring in [outer.exterior] + [h.exterior for h in holes]:
        pts = np.asarray(ring.coords)[:-1]
        coords.append(pts)
        ends.append(sum(len(c) for c in coords))
    return np.concatenate(coords), np.asarray(ends, dtype=np.uint32)


# ---------------------------------------------------------------- geometry
def build_mesh(art: Image.Image, height_m: float, depth_m: float):
    """Front cap (textured) + beveled rim + back cap, exact per-face normals.

    Caps keep their own vertices with a flat (0,0,+-1) normal; every rim segment
    gets its own pair of vertices with the outward 2D normal of that segment.
    Nothing is shared between a cap and a wall, so shading never averages a
    front normal into a side normal (the first build did, and the rims went black).
    """
    alpha = np.asarray(art.split()[-1])
    h_px, w_px = alpha.shape
    outer, holes = rings_from_alpha(alpha)
    x0, y0, x1, y1 = outer.bounds
    scale = height_m / (y1 - y0)
    cx = (x0 + x1) / 2.0
    bottom = y1

    def to_world(pts):
        return np.stack([(pts[:, 0] - cx) * scale, (bottom - pts[:, 1]) * scale], axis=1)

    rings = [np.asarray(outer.exterior.coords)[:-1]] + [np.asarray(h.exterior.coords)[:-1] for h in holes]
    rings_w = [to_world(r) for r in rings]
    centre = np.mean(np.concatenate(rings_w), axis=0)

    # earcut on the outer ring with the holes as inner rings
    coords, ends = [], []
    for r in rings:
        coords.append(r)
        ends.append(sum(len(c) for c in coords))
    flat = np.concatenate(coords)
    flat_w = to_world(flat)
    tri = triangulate_float64(flat_w, np.asarray(ends, dtype=np.uint32)).reshape(-1, 3)
    if len(tri) == 0:
        raise SystemExit("earcut produced no triangles")
    uv = np.stack([flat[:, 0] / w_px, 1.0 - flat[:, 1] / h_px], axis=1)

    def shell_xy(k):
        sxy, _ = k
        return flat_w * sxy + centre * (1.0 - sxy)

    def shell_z(k):
        return k[1] * depth_m * 0.5

    V, N, UV, IF, II, IB = [], [], [], [], [], []
    n = len(flat_w)

    def add_block(pts, z, normal, uvs):
        base = sum(len(b) for b in V)
        V.append(np.concatenate([pts, np.full((len(pts), 1), z)], axis=1))
        N.append(np.tile(normal, (len(pts), 1)))
        UV.append(uvs)
        return base

    # front cap, full art
    fbase = add_block(shell_xy(BEVEL_STEPS[0]), shell_z(BEVEL_STEPS[0]), [0.0, 0.0, 1.0], uv)
    IF.append(tri + fbase)

    # rear art cap; the side wall stays on the dark ink material
    bbase = add_block(shell_xy(BEVEL_STEPS[0]), BACK_Z * depth_m * 0.5, [0.0, 0.0, -1.0], uv)
    IB.append(tri[:, ::-1] + bbase)

    # rim: shells from the front edge down to the back edge, per-segment normals
    for ring_i, ring_w in enumerate(rings_w):
        signed = np.sum(ring_w[:, 0] * np.roll(ring_w[:, 1], -1) - np.roll(ring_w[:, 0], -1) * ring_w[:, 1])
        hole = ring_i > 0
        # walls of this ring, from the front edge down to the back copy
        ring_index = _ring_offset(ends, ring_i, flat_w)
        pts_ring = flat_w[ring_index]
        profiles = [(s, z) for s, z in BEVEL_STEPS] + [(0.90, BACK_Z)]
        for k in range(len(profiles) - 1):
            (s0, z0), (s1, z1) = profiles[k], profiles[k + 1]
            p0 = pts_ring * s0 + centre * (1.0 - s0)
            p1 = pts_ring * s1 + centre * (1.0 - s1)
            for i in range(len(pts_ring)):
                j = (i + 1) % len(pts_ring)
                seg = p1[j] - p1[i]
                n2 = np.array([seg[1], -seg[0]])
                n2 /= (np.linalg.norm(n2) or 1.0)
                if hole:
                    n2 = -n2
                outward = (p1[i] + p1[j]) / 2 - centre
                if float(np.dot(n2, outward)) < 0:
                    n2 = -n2
                normal = np.array([n2[0], n2[1], 0.0])
                quad = np.array([p0[i], p0[j], p1[j], p1[i]])
                uvs = np.array([uv[ring_index[i]], uv[ring_index[j]], uv[ring_index[j]], uv[ring_index[i]]])
                base = add_block(quad, 0.0, normal, uvs)
                V[-1][0, 2] = z0 * depth_m * 0.5
                V[-1][1, 2] = z0 * depth_m * 0.5
                V[-1][2, 2] = z1 * depth_m * 0.5
                V[-1][3, 2] = z1 * depth_m * 0.5
                II.append(np.array([[base, base + 1, base + 2], [base, base + 2, base + 3]]))

    Vv = np.concatenate(V).astype(np.float32)
    Nn = np.concatenate(N).astype(np.float32)
    UU = np.concatenate(UV).astype(np.float32)
    return {
        "V": Vv, "N": Nn, "UV": UU, "UVback": np.column_stack([1.0 - UU[:, 0], UU[:, 1]]).astype(np.float32),
        "front": np.concatenate([np.asarray(i).reshape(-1, 3) for i in IF]).astype(np.int64),
        "ink": np.concatenate([np.asarray(i).reshape(-1, 3) for i in II]).astype(np.int64),
        "back": np.concatenate([np.asarray(i).reshape(-1, 3) for i in IB]).astype(np.int64),
        "bounds": [[float(Vv[:, i].min()), float(Vv[:, i].max())] for i in range(3)],
    }


def _ring_offset(ends, ring_index, flat_w):
    start = 0 if ring_index == 0 else int(ends[ring_index - 1])
    end = int(ends[ring_index])
    return list(range(start, end))


def ring_vertex_indices(ends):
    out, start = [], 0
    for e in ends:
        out.append(list(range(start, int(e))))
        start = int(e)
    return out


# ---------------------------------------------------------------- GLB writer
def pad4(b: bytes, fill: bytes = b"\x00") -> bytes:
    # glTF 2.0: the JSON chunk is padded with spaces, BIN chunks with zeros.
    return b + fill * ((4 - len(b) % 4) % 4)


class Glb:
    def __init__(self):
        self.bin = b""
        self.views, self.accessors = [], []

    def view(self, data: bytes, target=None):
        off = len(self.bin)
        self.bin += pad4(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        self.views.append(v)
        return len(self.views) - 1

    def acc(self, arr: np.ndarray, ctype: str, atype: str, target=None, minmax=False):
        v = self.view(arr.tobytes(), target)
        a = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0]), "type": atype}
        if minmax:
            a["min"] = arr.min(axis=0).tolist()
            a["max"] = arr.max(axis=0).tolist()
        self.accessors.append(a)
        return len(self.accessors) - 1


ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963
FLOAT, UINT = 5126, 5125


def write_glb(path: pathlib.Path, name: str, mesh: dict, texture_bytes: bytes, rear_texture_bytes: bytes, animations: dict):
    g = Glb()
    pos = g.acc(mesh["V"], FLOAT, "VEC3", ARRAY_BUFFER, True)
    nor = g.acc(mesh["N"], FLOAT, "VEC3", ARRAY_BUFFER)
    tex = g.acc(mesh["UV"], FLOAT, "VEC2", ARRAY_BUFFER)
    tex_back = g.acc(mesh["UVback"], FLOAT, "VEC2", ARRAY_BUFFER)
    prims = []
    for idx, mat, uvacc in ((mesh["front"], 0, tex), (mesh["ink"], 1, tex), (mesh["back"], 2, tex_back)):
        if len(idx) == 0:
            continue
        ia = g.acc(idx.astype(np.uint32).reshape(-1), UINT, "SCALAR", ELEMENT_ARRAY_BUFFER)
        prims.append({"attributes": {"POSITION": pos, "NORMAL": nor, "TEXCOORD_0": uvacc},
                      "indices": ia, "material": mat})
    img = g.view(texture_bytes)
    rear_img = g.view(rear_texture_bytes)

    samplers, anims = [], []
    for anim_name, chans in animations.items():
        sampler_list, channel_list = [], []
        for path_name, times, values, interp in chans:
            t = g.acc(np.asarray(times, dtype=np.float32), FLOAT, "SCALAR")
            # accessor for animation output needs min/max off but must be typed
            vtype = "VEC3" if path_name in ("translation", "scale") else "VEC4"
            v = g.acc(np.asarray(values, dtype=np.float32), FLOAT, vtype)
            sampler_list.append({"input": t, "output": v,
                                 "interpolation": interp or "LINEAR"})
            channel_list.append({"sampler": len(sampler_list) - 1,
                                 "target": {"node": 0, "path": path_name}})
        anims.append({"name": anim_name, "samplers": sampler_list, "channels": channel_list})

    gltf = {
        "asset": {"version": "2.0", "generator": "BCM4SA tools/ring-bosses/to_mesh.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": prims}],
        "materials": [
            {"name": "boss-art", "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0}, "metallicFactor": 0.05, "roughnessFactor": 0.62}},
            {"name": "ink", "pbrMetallicRoughness": {"baseColorFactor": INK,
                                                     "metallicFactor": 0.35, "roughnessFactor": 0.55}},
            {"name": "boss-rear-reference", "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 1}, "metallicFactor": 0.05, "roughnessFactor": 0.62}},
        ],
        "textures": [{"sampler": 0, "source": 0}, {"sampler": 0, "source": 1}],
        "images": [{"bufferView": img, "mimeType": "image/jpeg"},
                   {"bufferView": rear_img, "mimeType": "image/jpeg"}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "accessors": g.accessors,
        "bufferViews": g.views,
        "buffers": [{"byteLength": len(g.bin)}],
        "animations": anims,
    }
    js = pad4(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    binb = pad4(g.bin)
    total = 12 + 8 + len(js) + 8 + len(binb)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, total))
        fh.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        fh.write(struct.pack("<II", len(binb), 0x004E4942) + binb)


# ---------------------------------------------------------------- animations
def anims_for(height_m: float, depth_m: float):
    """Small, readable set: idle breath, hit recoil, transform out/in."""
    bob = 0.045 * height_m
    idle_t = [0.0, 0.9, 1.8]
    idle_y = [0.0, bob, 0.0]
    idle_rot = [[0, 0, 0, 1], quat_z(math.radians(2.2)), [0, 0, 0, 1]]
    out_t = [0.0, 0.18, 0.34, 0.5]
    out_scale = [[1, 1, 1], [0.86, 1.14, 0.9], [0.12, 1.22, 0.12], [0.02, 0.02, 0.02]]
    in_scale = [[0.02, 0.02, 0.02], [0.3, 1.25, 0.3], [1.1, 0.94, 1.1], [1, 1, 1]]
    hit_scale = [[1, 1, 1], [1.14, 0.88, 1.1], [0.96, 1.06, 0.96], [1, 1, 1]]
    return {
        "idle": [("translation", idle_t, [[0, y, 0] for y in idle_y], "LINEAR"),
                 ("rotation", idle_t, idle_rot, "LINEAR")],
        "hit": [("scale", [0, 0.08, 0.18, 0.3], hit_scale, "LINEAR")],
        "transform_out": [("scale", out_t, out_scale, "LINEAR"),
                          ("rotation", out_t, [[0, 0, 0, 1], quat_z(0.6), quat_z(2.4), quat_z(3.14)], "LINEAR")],
        "transform_in": [("scale", [0, 0.16, 0.32, 0.5], in_scale, "LINEAR"),
                         ("rotation", [0, 0.16, 0.32, 0.5],
                          [quat_z(3.14), quat_z(2.4), quat_z(0.6), [0, 0, 0, 1]], "LINEAR")],
    }


def edge_extend(art: Image.Image) -> Image.Image:
    """Fill transparent pixels with the nearest solid colour, keep nothing else."""
    rgba = np.asarray(art).astype(np.float32)
    opaque = rgba[..., 3] > 250
    if not opaque.any():
        return art
    idx = ndimage.distance_transform_edt(~opaque, return_distances=False, return_indices=True)
    filled = rgba[idx[0], idx[1]]
    filled[..., 3] = 255.0
    flat = Image.new("RGBA", art.size, (9, 12, 18, 255))
    flat.alpha_composite(Image.fromarray(filled.astype(np.uint8), "RGBA"))
    return flat


def quat_z(a: float):
    return [0.0, 0.0, math.sin(a / 2), math.cos(a / 2)]


# ---------------------------------------------------------------- stage plan
STAGES = {
    # Three stages, each re-uses a form. Moving through the arena keeps the
    # existing three zones (x -16 / 18 / 58) and the existing boss meter.
    "stages": [
        {"stage": 1, "form": "boss-1-roller", "hp": 4, "arena": "СБОЙНЫЙ СТРАЖ",
         "entry": "rolls in from the left wall", "transform_to": "boss-2-walker",
         "transform_at_hp": 0, "transform_seconds": 0.5},
        {"stage": 2, "form": "boss-2-walker", "hp": 6, "arena": "СБОЙНЫЙ СТРАЖ",
         "entry": "stands up on four legs, stomps the platform",
         "transform_to": "boss-6-stalker", "transform_at_hp": 0, "transform_seconds": 0.5},
        {"stage": 3, "form": "boss-6-stalker", "hp": 9, "arena": "СБОЙНЫЙ СТРАЖ",
         "entry": "jumps in from above, claws out", "transform_to": None},
    ],
    "variants": {
        "arena_0": ["boss-1-roller", "boss-2-walker", "boss-6-stalker"],
        "arena_1": ["boss-5-runner", "boss-4-brawler", "boss-3-orbiter"],
        "arena_2": ["boss-2-walker", "boss-3-orbiter", "boss-6-stalker"],
    },
    "rules": {
        "pick": "hashSeed(seed + '|boss-gate') % 3 -> variant list, same as today's three arenas",
        "swap": "stage end: play transform_out on the old form (0.5 s), then spawn the new form and play transform_in (0.5 s); the boss meter keeps its own maxHp per stage",
        "invulnerable": "during both transform clips, no damage is taken and no damage is dealt",
        "no_new_arena": "same three zones, same BOSSES 0/3 counter, same [data-ring-boss-meter] HUD",
    },
}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ART / "manifest.json").read_text(encoding="utf-8"))
    report = {"generated_by": "tools/ring-bosses/to_mesh.py", "forms": []}
    for form in manifest["forms"]:
        slug = form["id"].lower().replace("ring-", "")  # boss-1-roller, as the sprites
        src = ART / form["file"].replace(".webp", ".webp")
        art = Image.open(src).convert("RGBA")
        height = float(form["suggested_world_height_m"])
        depth = round(height * 0.55, 3)
        mesh = build_mesh(art, height, depth)
        rear_name = {
            "boss-1-roller": "phase-2-roller-rear@1024.webp",
            "boss-2-walker": "phase-2-walker-rear@1024.webp",
            "boss-3-orbiter": "phase-3-orbiter-rear@1024.webp",
            "boss-4-brawler": "phase-4-brawler-rear@1024.webp",
            "boss-5-runner": "phase-5-runner-rear@1024.webp",
            "boss-6-stalker": "phase-6-stalker-rear@1024.webp",
        }[slug]
        rear_art = Image.open(ART / "phase-art-rear" / rear_name).convert("RGBA")
        rear_art = ImageOps.contain(rear_art, art.size, method=Image.Resampling.LANCZOS)
        rear_canvas = Image.new("RGBA", art.size, (9, 12, 18, 255))
        rear_canvas.alpha_composite(rear_art, ((art.width - rear_art.width) // 2, (art.height - rear_art.height) // 2))

        # Base colour texture: the art itself, flattened onto the ink colour so
        # mip-maps at the rim blend into the outline instead of white. The
        # semi-transparent cut edge is first filled inward from the nearest solid
        # pixel ("edge extend"), otherwise those pixels blend toward ink and the
        # silhouette grows a dark halo.
        solid = edge_extend(art)
        tex_path = OUT / f"{slug}-albedo.jpg"
        solid.convert("RGB").save(tex_path, quality=88, optimize=True)

        glb = OUT / f"{slug}.glb"
        rear_path = OUT / f"{slug}-rear-albedo.jpg"
        edge_extend(rear_canvas).convert("RGB").save(rear_path, quality=88, optimize=True)
        write_glb(glb, form["id"], mesh, tex_path.read_bytes(), rear_path.read_bytes(), anims_for(height, depth))
        rear_path.unlink()
        tex_path.unlink()  # texture lives inside the GLB

        tris = (len(mesh["front"]) + len(mesh["ink"]) + len(mesh["back"]))
        report["forms"].append({
            "id": form["id"], "file": f"mesh/{slug}.glb",
            "height_m": height, "depth_m": depth,
            "triangles": int(tris), "vertices": int(len(mesh["V"])),
            "bounds": [[round(v, 3) for v in b] for b in mesh["bounds"]],
            "animations": ["idle", "hit", "transform_out", "transform_in"],
            "bytes": glb.stat().st_size,
        })
        print(f"{form['id']:22} {tris:5} tri  {len(mesh['V']):5} vert  "
              f"{glb.stat().st_size / 1024:7.1f} KB  h={height} m")
    # The game uses these phase-art GLBs (not the original manifest sprites) for forms 2–6.
    phase_dir = OUT / "phase-forms"
    phase_dir.mkdir(parents=True, exist_ok=True)
    phase_report = {"generated_by": "tools/ring-bosses/to_mesh.py", "forms": []}
    form_by_slug = {f["id"].lower().replace("ring-", ""): f for f in manifest["forms"]}
    phase_names = {2: "walker", 3: "orbiter", 4: "brawler", 5: "runner", 6: "stalker"}
    for phase_index, role in phase_names.items():
        slug = f"boss-{phase_index}-{role}"
        base = form_by_slug[slug]
        front_name = f"phase-{phase_index}-{role}@1024.webp"
        rear_name = f"phase-{phase_index}-{role}-rear@1024.webp"
        art = Image.open(ART / "phase-art" / front_name).convert("RGBA")
        rear_art = Image.open(ART / "phase-art-rear" / rear_name).convert("RGBA")
        height = float(base["suggested_world_height_m"])
        depth = round(height * 0.55, 3)
        mesh = build_mesh(art, height, depth)
        rear_art = ImageOps.contain(rear_art, art.size, method=Image.Resampling.LANCZOS)
        rear_canvas = Image.new("RGBA", art.size, (9, 12, 18, 255))
        rear_canvas.alpha_composite(rear_art, ((art.width - rear_art.width) // 2, (art.height - rear_art.height) // 2))
        solid = edge_extend(art)
        phase_glb = phase_dir / f"phase-{phase_index}-{role}.glb"
        front_tex = OUT / f"phase-{phase_index}-front.jpg"
        rear_tex = OUT / f"phase-{phase_index}-rear.jpg"
        solid.convert("RGB").save(front_tex, quality=88, optimize=True)
        edge_extend(rear_canvas).convert("RGB").save(rear_tex, quality=88, optimize=True)
        write_glb(phase_glb, f"RING-BOSS-PHASE-{phase_index}", mesh, front_tex.read_bytes(), rear_tex.read_bytes(), anims_for(height, depth))
        front_tex.unlink(); rear_tex.unlink()
        phase_report["forms"].append({"id": f"RING-BOSS-PHASE-{phase_index}", "file": str(phase_glb.relative_to(OUT)),
            "height_m": height, "depth_m": depth, "triangles": int(len(mesh["front"]) + len(mesh["ink"]) + len(mesh["back"])),
            "vertices": int(len(mesh["V"])), "bounds": [[round(v, 3) for v in b] for b in mesh["bounds"]],
            "animations": ["idle", "hit", "transform_out", "transform_in"], "bytes": phase_glb.stat().st_size})
        print(f"phase-{phase_index:1} {phase_glb.name:28} {phase_glb.stat().st_size / 1024:7.1f} KB  depth={depth} m")
    (phase_dir / "phase-mesh-report.json").write_text(json.dumps(phase_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "ring-boss-stages.json").write_text(
        json.dumps({"meshes": report, **STAGES}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "mesh-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                                          encoding="utf-8")
    print("total", sum(f["bytes"] for f in report["forms"]) / 1024, "KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
