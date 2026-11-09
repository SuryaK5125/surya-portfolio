"""
Blender optimisation pass for "LEGO 10295 Porsche 911 (Turbo)" by Sleepy Sea Otter
(CC-BY-4.0, https://sketchfab.com/3d-models/lego-10295-porsche-911-turbo-73d0cef548c04c3f9b6cef9871ea8d52).

The Sketchfab download is a BrickLink Studio export: 4,279 meshes, ~15 M triangles,
440 MB. This script turns it into a browser-sized GLB (100k triangles) that the
Node packager (tools/model-pipeline/build-porsche.js) then quantizes and ships.

Run (Blender 4.2+; tested with 5.2):

    blender -b --factory-startup --python tools/model-pipeline/blender/optimize_porsche.py -- \
        --source assets-source/lego-porsche/scene.gltf \
        --out assets-source/lego-porsche/build \
        [--target 100000] [--views 128] [--resolution 2048] [--min-elevation 0]
        [--previews 0|1|2] [--resume 1]

    --resume 1 skips loading and the ID renders (~5 min) and re-runs culling and
    simplification from <out>/_culled.pickle: use it to try other budgets.
    Budget: 60k crumpled the curved slopes and headlights; 100k was the lowest
    that kept every visible piece clean (see tools/model-pipeline/PORSCHE.md).

Stages (each one is logged with triangle counts to <out>/optimize.log and
<out>/optimize-report.json):

1. Load: reads the glTF with numpy (not the glTF importer, which would build all
   15 M triangles first). Bakes node transforms, converts LDraw units (LDU) and
   axes, fixes triangle winding against the source normals (every part has a
   mirrored transform), and welds the per-normal vertex splits.
   Drops the embossed "LEGO" stud logos: 2,819 copies of one 0.2 LDU (0.08 mm)
   relief mesh that make up 85% of the source triangles.
   Merges duplicate colour materials (SOLID-BLACK, SOLID-BLACK_0, ... -> one).
2. Visibility: renders every opaque face with a unique ID colour (Workbench, flat,
   no AA, float EXR) from many orthographic directions, then deletes faces and whole
   parts that no view ever saw: the Technic chassis, gearbox, brick interiors,
   anti-stud tubes and covered studs. Directions stop at --min-elevation (the car
   sits on a desk, so it is never seen from below). Small unseen faces next to seen
   ones are kept, so sub-pixel slivers on visible surfaces don't become holes.
   Transparent parts and printed decorations never occlude and are always kept.
3. Simplify: joins everything into one mesh (one material slot per colour; parts
   stay separate islands, so colours never bleed), dissolves coplanar triangles,
   then runs quadric edge-collapse decimation to --target with mesh boundaries
   weighted so cut edges don't erode.
4. Finish: sharp edges by angle (crisp brick edges, smooth studs and curves),
   millimetres, Y-up, length along +X with the nose at +X, wheels on y = 0,
   centred footprint. Exports <out>/porsche-blender.glb plus before/after previews.
"""

import bmesh
import bpy
import json
import math
import os
import pickle
import re
import sys
import time

import numpy as np
from mathutils import Matrix, Vector

# --------------------------------------------------------------------- settings

MM_PER_LDU = 0.4
WELD_LDU = 0.005  # vertex weld tolerance (source float noise is ~1e-5)
PLANAR_ANGLE_DEG = 1.0  # coplanar dissolve threshold
SHARP_ANGLE_DEG = 35.0  # edges sharper than this get hard normals
BOUNDARY_WEIGHT = 2.0  # decimation vertex-group factor (cost per LDU of open edge)
BOUNDARY_VWEIGHT = 0.1  # vertex-group weight on open (cut) edges; interior = 1
REGION_ANGLE_DEG = 0.5  # faces this close to coplanar form one region for visibility
SMALL_FACE_PX = 1.5  # unseen faces thinner than this (inscribed diameter, pixels)...
SMALL_FACE_RINGS = 2  # ...are kept if within this many edge rings of a kept face

# After the length is aligned to X (Blender space), +1 keeps the orientation and -1
# turns the car 180° so the nose ends up at +X. Verified against the previews.
FRONT_SIGN = 1

# Material names in the source are colour names with Studio's duplicate suffixes.
SUFFIX = re.compile(r"_\d+$")


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = {
        "source": "assets-source/lego-porsche/scene.gltf",
        "out": "assets-source/lego-porsche/build",
        "target": 100000,
        "views": 128,
        "resolution": 2048,
        "min-elevation": 0.0,
        "previews": 1,  # 0 none, 1 before/after, 2 also after each simplify stage
        "resume": 0,  # 1: skip load + visibility, reuse <out>/_culled.pickle
    }
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key not in opts:
            raise SystemExit(f"Unknown option --{key}")
        opts[key] = type(opts[key])(argv[i + 1])
        i += 2
    return opts


OPTS = parse_args()
OUT = os.path.abspath(OPTS["out"])
os.makedirs(OUT, exist_ok=True)
CACHE = os.path.join(OUT, "_culled.pickle")
LOG = open(os.path.join(OUT, "optimize.log"), "a" if OPTS["resume"] else "w", encoding="utf-8")
T0 = time.time()
REPORT = {"stages": []}


def log(msg):
    line = f"[{time.time() - T0:7.1f}s] {msg}"
    print(line)
    LOG.write(line + "\n")
    LOG.flush()


def stage(name, **stats):
    REPORT["stages"].append({"stage": name, **stats})
    log(f"{name}: " + ", ".join(f"{k}={v}" for k, v in stats.items()))


# ------------------------------------------------------------------ glTF input

DTYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def node_matrix(node):
    if "matrix" in node:
        return np.array(node["matrix"], dtype=np.float64).reshape(4, 4).T
    if any(k in node for k in ("translation", "rotation", "scale")):
        t = Matrix.Translation(node.get("translation", (0, 0, 0)))
        x, y, z, w = node.get("rotation", (0, 0, 0, 1))
        from mathutils import Quaternion
        r = Quaternion((w, x, y, z)).to_matrix().to_4x4()
        s = Matrix.Diagonal((*node.get("scale", (1, 1, 1)), 1))
        return np.array(t @ r @ s, dtype=np.float64)
    return np.eye(4)


def is_stud_logo(ext):
    """The embossed LEGO logo Studio places on each stud: 0.2 × 4.7 × 9.3 LDU."""
    e = np.sort(ext)
    return e[0] < 0.35 and 3.5 < e[1] < 6.0 and 8.0 < e[2] < 10.5


def load_parts(path):
    with open(path, "r", encoding="utf-8") as f:
        gl = json.load(f)
    if len(gl["buffers"]) != 1:
        raise SystemExit("Expected a single external buffer")
    with open(os.path.join(os.path.dirname(path), gl["buffers"][0]["uri"]), "rb") as f:
        blob = f.read()

    def accessor(i):
        a = gl["accessors"][i]
        view = gl["bufferViews"][a["bufferView"]]
        dt = np.dtype(DTYPES[a["componentType"]])
        n = WIDTH[a["type"]]
        offset = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = view.get("byteStride", dt.itemsize * n)
        arr = np.ndarray((a["count"], n), dt, blob, offset, (stride, dt.itemsize))
        if a.get("normalized"):
            raise SystemExit("Normalized accessors are not expected in this source")
        return arr.reshape(-1) if n == 1 else arr

    # Materials: merge Studio's duplicate colours by name stem + identical factors.
    materials = {}
    mat_key = []
    for m in gl["materials"]:
        pbr = m.get("pbrMetallicRoughness", {})
        color = tuple(round(c, 5) for c in pbr.get("baseColorFactor", (1, 1, 1, 1)))
        stem = SUFFIX.sub("", m["name"])
        key = stem
        if key in materials and materials[key]["source_color"] != color:
            key = m["name"]  # same stem, different colour: keep separate
        materials.setdefault(key, {
            "source_color": color,
            "blend": m.get("alphaMode") == "BLEND",
            "sources": [],
        })["sources"].append(m["name"])
        mat_key.append(key)

    parts = []
    stats = {"source_meshes": 0, "source_tris": 0, "logo_meshes": 0, "logo_tris": 0,
             "print_meshes": 0, "winding_flipped_tris": 0}
    # glTF (Y-up) -> Blender (Z-up): (x, y, z) -> (x, -z, y)
    to_blender = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], dtype=np.float64)

    def visit(index, parent, part_name):
        node = gl["nodes"][index]
        world = parent @ node_matrix(node)
        name = node.get("name", "")
        if name.startswith("Inner-Node"):
            part_name = name.rsplit("-", 1)[-1]
        if "mesh" in node:
            for prim in gl["meshes"][node["mesh"]]["primitives"]:
                if prim.get("mode", 4) != 4 or "indices" not in prim:
                    raise SystemExit(f"Unsupported primitive in node {index}")
                pa = gl["accessors"][prim["attributes"]["POSITION"]]
                ext = np.array(pa["max"]) - np.array(pa["min"])
                tri_count = gl["accessors"][prim["indices"]]["count"] // 3
                stats["source_meshes"] += 1
                stats["source_tris"] += tri_count
                if is_stud_logo(ext):
                    stats["logo_meshes"] += 1
                    stats["logo_tris"] += tri_count
                    continue
                is_print = ext.min() < 0.01
                stats["print_meshes"] += is_print

                local = accessor(prim["attributes"]["POSITION"]).astype(np.float64)
                normals = accessor(prim["attributes"]["NORMAL"]).astype(np.float64)
                tri = accessor(prim["indices"]).astype(np.int64).reshape(-1, 3)
                m3 = world[:3, :3]
                pos = local @ m3.T + world[:3, 3]
                nrm = normals @ np.linalg.inv(m3)  # inverse-transpose, row form

                # Winding: trust the source normals, triangle by triangle.
                p0, p1, p2 = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
                geo = np.cross(p1 - p0, p2 - p0)
                ref = nrm[tri[:, 0]] + nrm[tri[:, 1]] + nrm[tri[:, 2]]
                flip = np.einsum("ij,ij->i", geo, ref) < 0
                tri[flip] = tri[flip][:, [0, 2, 1]]
                stats["winding_flipped_tris"] += int(flip.sum())

                pos = pos @ to_blender.T
                # Weld the per-normal vertex splits so faces share edges.
                keys = np.round(pos / WELD_LDU).astype(np.int64)
                _, first, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
                inverse = inverse.reshape(-1)
                pos = pos[first]
                tri = inverse[tri]
                ok = (tri[:, 0] != tri[:, 1]) & (tri[:, 1] != tri[:, 2]) & (tri[:, 0] != tri[:, 2])
                tri = tri[ok]
                key = mat_key[prim["material"]]
                parts.append({
                    "name": f"part{part_name}_{len(parts)}",
                    "pos": pos,
                    "tri": tri.astype(np.int32),
                    "mat": key + (".print" if is_print else ""),
                    "base_mat": key,
                    "transparent": materials[key]["blend"],
                    "print": bool(is_print),
                })
        for child in node.get("children", []):
            visit(child, world, part_name)

    for root in gl["scenes"][gl.get("scene", 0)]["nodes"]:
        visit(root, np.eye(4), "")

    if stats["logo_meshes"] < 1000:
        raise SystemExit(f"Found only {stats['logo_meshes']} stud logos; has the source changed?")
    return parts, materials, gl["asset"].get("extras", {}), stats


# --------------------------------------------------------------- Blender setup

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("World")
    scene.world.color = (0.04, 0.04, 0.045)
    return scene


def make_material(name, info):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    color = list(srgb_to_linear(info["source_color"][:3])) + [info["source_color"][3]]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    try:
        if mat.node_tree is None:
            mat.use_nodes = True
        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = color[:3] + [1.0]
        bsdf.inputs["Alpha"].default_value = color[3]
    except Exception:  # exporter falls back to diffuse_color; packager sets final values
        pass
    return mat


def mesh_from_arrays(name, pos, tri, mat_index=None):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(pos))
    me.vertices.foreach_set("co", pos.astype(np.float32).ravel())
    me.loops.add(len(tri) * 3)
    me.loops.foreach_set("vertex_index", tri.astype(np.int32).ravel())
    me.polygons.add(len(tri))
    me.polygons.foreach_set("loop_start", np.arange(0, len(tri) * 3, 3, dtype=np.int32))
    if mat_index is not None:
        me.polygons.foreach_set("material_index", mat_index.astype(np.int32))
    me.update(calc_edges=True)
    return me


def link(scene, name, me):
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def bounds(parts):
    lo = np.min([p["pos"].min(0) for p in parts], 0)
    hi = np.max([p["pos"].max(0) for p in parts], 0)
    return lo, hi


def tri_total(parts):
    return int(sum(len(p["tri"]) for p in parts))


# ------------------------------------------------------------------ visibility

def view_directions(n, min_elevation_deg):
    """Fibonacci-distributed directions on the sphere above min elevation, plus a ring at it."""
    golden = math.pi * (3 - math.sqrt(5))
    zmin = math.sin(math.radians(min_elevation_deg))
    dirs = []
    total = int(n * 2 / max(1e-3, 1 - zmin))  # so ~n land above zmin
    for i in range(total):
        z = 1 - (i + 0.5) / total * 2
        if z < zmin:
            continue
        r = math.sqrt(max(0.0, 1 - z * z))
        dirs.append(Vector((r * math.cos(i * golden), r * math.sin(i * golden), z)))
    ring = max(12, n // 8)
    e = math.radians(min_elevation_deg)
    for k in range(ring):
        a = 2 * math.pi * (k + 0.5) / ring
        dirs.append(Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e))))
    return dirs


def setup_id_render(scene, res):
    scene.render.engine = "BLENDER_WORKBENCH"
    d = scene.display
    d.render_aa = "OFF"
    s = d.shading
    s.light = "FLAT"
    s.color_type = "VERTEX"  # "Attribute" in the UI
    s.show_shadows = False
    s.show_cavity = False
    s.show_object_outline = False
    s.show_specular_highlight = False
    s.show_xray = False
    s.show_backface_culling = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.dither_intensity = 0
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    f = scene.render.image_settings
    f.file_format = "OPEN_EXR"
    f.color_depth = "32"
    f.exr_codec = "ZIP"


def compute_visibility(scene, parts, opts):
    res = opts["resolution"]
    offset = 1
    objects = []
    for p in parts:
        me = mesh_from_arrays(p["name"], p["pos"], p["tri"])
        ob = link(scene, p["name"], me)
        p["obj"] = ob
        n = len(p["tri"])
        if p["transparent"] or p["print"]:
            ob.hide_render = True  # never occlude; always kept
            p["ids"] = None
            continue
        ids = np.arange(offset, offset + n, dtype=np.int64)
        offset += n
        p["ids"] = ids
        corner = np.repeat(ids, 3)
        col = np.empty((len(corner), 4), np.float32)
        col[:, 0] = (corner & 255) / 256.0
        col[:, 1] = ((corner >> 8) & 255) / 256.0
        col[:, 2] = ((corner >> 16) & 255) / 256.0
        col[:, 3] = 1.0
        attr = me.color_attributes.new("fid", "FLOAT_COLOR", "CORNER")
        attr.data.foreach_set("color", col.ravel())
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
        objects.append(ob)
    if offset >= 1 << 24:
        raise SystemExit("Too many faces for 24-bit IDs")

    lo, hi = bounds(parts)
    center = Vector(((lo + hi) / 2).tolist())
    radius = float(np.linalg.norm(hi - lo) / 2) * 1.02
    cam = link(scene, "IdCamera", bpy.data.cameras.new("IdCamera"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = radius * 2
    cam.data.clip_start = radius * 0.5
    cam.data.clip_end = radius * 4
    scene.camera = cam
    setup_id_render(scene, res)
    exr = os.path.join(OUT, "_id.exr")
    scene.render.filepath = exr

    seen = np.zeros(offset, dtype=bool)
    hits = np.zeros(offset, dtype=np.uint32)
    dirs = view_directions(opts["views"], opts["min-elevation"])
    log(f"visibility: {len(dirs)} views at {res}px, {radius * 2 / res:.3f} LDU/px, {offset - 1} faces")
    for i, d in enumerate(dirs):
        cam.location = center + d * radius * 2
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(exr, check_existing=False)
        px = np.empty(res * res * 4, np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        px = px.reshape(-1, 4)
        px = px[px[:, 3] > 0.5]
        q = np.rint(px[:, :3] * 256).astype(np.int64)
        ids = q[:, 0] | (q[:, 1] << 8) | (q[:, 2] << 16)
        if ids.size and (ids.max() >= offset or ids.min() < 1):
            raise SystemExit("Decoded face ID out of range: ID render is not exact on this system")
        u, c = np.unique(ids, return_counts=True)
        seen[u] = True
        hits[u] += c.astype(np.uint32)
        if i % 16 == 0 or i == len(dirs) - 1:
            log(f"  view {i + 1}/{len(dirs)}: {int(seen.sum())} faces seen so far")
    os.remove(exr)
    for ob in objects:
        ob.data.color_attributes.remove(ob.data.color_attributes["fid"])
    bpy.data.objects.remove(cam)
    return seen, radius * 2 / res, len(dirs)


def edge_pairs(tri):
    """Pairs of face indices that share an edge (manifold edges only)."""
    f = np.repeat(np.arange(len(tri)), 3)
    e = np.sort(np.stack([tri, np.roll(tri, -1, 1)], 2).reshape(-1, 2), 1)
    key = e[:, 0].astype(np.int64) * (int(tri.max()) + 1) + e[:, 1]
    order = np.argsort(key, kind="stable")
    key, f = key[order], f[order]
    same = key[1:] == key[:-1]
    # keep edges used by exactly two faces
    first = np.flatnonzero(same)
    single = np.ones(len(first), bool)
    if len(first) > 1:
        triple = np.flatnonzero(same[1:] & same[:-1])
        single[np.isin(first, triple) | np.isin(first, triple + 1)] = False
    first = first[single]
    return f[first], f[first + 1]


def coplanar_regions(pos, tri, normals, a, b):
    """Labels connected faces with (nearly) the same normal: the source's original polygons."""
    flat = np.einsum("ij,ij->i", normals[a], normals[b]) > math.cos(math.radians(REGION_ANGLE_DEG))
    a, b = a[flat], b[flat]
    label = np.arange(len(tri))
    while True:
        m = np.minimum(label[a], label[b])
        new = label.copy()
        np.minimum.at(new, a, m)
        np.minimum.at(new, b, m)
        new = new[new]  # pointer jumping
        while True:
            jumped = new[new]
            if np.array_equal(jumped, new):
                break
            new = jumped
        if np.array_equal(new, label):
            return label
        label = new


def cull_hidden(parts, seen, px_size):
    """
    Keeps every coplanar region (original polygon) that any view saw, plus thin
    faces edge-adjacent to kept ones: Studio fan-triangulates flat faces into long
    slivers that a pixel grid can miss, which would otherwise leave holes.
    """
    thin_width = SMALL_FACE_PX * px_size
    kept_parts = []
    removed_parts = 0
    region_faces = 0
    sliver_faces = 0
    for p in parts:
        if p["ids"] is None:
            kept_parts.append(p)
            continue
        tri, pos = p["tri"], p["pos"]
        seen_face = seen[p["ids"]]
        if not seen_face.any():
            removed_parts += 1
            continue
        cross = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
        area2 = np.linalg.norm(cross, axis=1)
        normals = cross / np.maximum(area2, 1e-12)[:, None]
        a, b = edge_pairs(tri)
        label = coplanar_regions(pos, tri, normals, a, b)
        region_seen = np.zeros(len(tri), bool)
        region_seen[label[seen_face]] = True
        keep = region_seen[label]
        region_faces += int(keep.sum() - seen_face.sum())

        perimeter = sum(np.linalg.norm(pos[tri[:, i]] - pos[tri[:, (i + 1) % 3]], axis=1) for i in range(3))
        thin = 2 * area2 / np.maximum(perimeter, 1e-12) < thin_width  # inscribed diameter
        for _ in range(SMALL_FACE_RINGS):
            touch = np.zeros(len(tri), bool)
            touch[a[keep[b]]] = True
            touch[b[keep[a]]] = True
            grow = thin & ~keep & touch
            if not grow.any():
                break
            sliver_faces += int(grow.sum())
            keep |= grow
        tri = tri[keep]
        used = np.unique(tri)
        remap = np.full(len(pos), -1, np.int64)
        remap[used] = np.arange(len(used))
        p["pos"] = pos[used]
        p["tri"] = remap[tri].astype(np.int32)
        kept_parts.append(p)
    return kept_parts, removed_parts, region_faces, sliver_faces


# ------------------------------------------------------------------ simplify

def join_parts(scene, parts, materials):
    names = sorted({p["mat"] for p in parts})
    slot = {n: i for i, n in enumerate(names)}
    pos, tri, mat = [], [], []
    base = 0
    for p in parts:
        pos.append(p["pos"])
        tri.append(p["tri"] + base)
        mat.append(np.full(len(p["tri"]), slot[p["mat"]], np.int32))
        base += len(p["pos"])
    me = mesh_from_arrays("LEGO_Porsche_911", np.concatenate(pos), np.concatenate(tri), np.concatenate(mat))
    for n in names:
        me.materials.append(make_material(n, materials[n.replace(".print", "")]))
    return link(scene, "LEGO_Porsche_911", me)


def planar_dissolve(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.dissolve_limit(
        bm, angle_limit=math.radians(PLANAR_ANGLE_DEG), use_dissolve_boundaries=False,
        verts=bm.verts[:], edges=bm.edges[:], delimit={"MATERIAL"})
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.to_mesh(ob.data)
    bm.free()
    return len(ob.data.polygons)


def decimate(scene, ob, target):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    boundary = [v.index for v in bm.verts if v.is_boundary]
    interior = [v.index for v in bm.verts if not v.is_boundary]
    bm.free()
    # Blender's collapse never touches a vertex of weight 0 and adds
    # edge_length × (2 − w1 − w2) × factor to the cost otherwise: interior
    # vertices get 1 (no penalty), open edges a small weight (costly, not frozen).
    group = ob.vertex_groups.new(name="protect")
    group.add(interior, 1.0, "REPLACE")
    group.add(boundary, BOUNDARY_VWEIGHT, "REPLACE")

    current = len(ob.data.polygons)
    ratio = min(1.0, target / current)
    mod = ob.modifiers.new("Decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.use_collapse_triangulate = True
    mod.vertex_group = "protect"
    mod.vertex_group_factor = BOUNDARY_WEIGHT
    result = None
    for _ in range(6):
        mod.ratio = ratio
        depsgraph = bpy.context.evaluated_depsgraph_get()
        result = bpy.data.meshes.new_from_object(ob.evaluated_get(depsgraph))
        got = len(result.polygons)
        log(f"  decimate ratio {ratio:.5f} -> {got} tris")
        if abs(got - target) <= target * 0.02:
            break
        ratio = min(1.0, ratio * target / got)
        bpy.data.meshes.remove(result)
        result = None
    if result is None:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        result = bpy.data.meshes.new_from_object(ob.evaluated_get(depsgraph))
    ob.modifiers.remove(mod)
    ob.vertex_groups.remove(group)
    old = ob.data
    ob.data = result  # new_from_object keeps the material slots
    bpy.data.meshes.remove(old)
    return len(ob.data.polygons)


def finish_mesh(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-4, edges=bm.edges[:])
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    me = ob.data  # built from arrays, so there are no custom normals to clear
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(SHARP_ANGLE_DEG))
    return len(me.polygons)


def orient(ob):
    """Length on X, nose at +X, millimetres, wheels on z = 0, centred footprint (Blender space)."""
    me = ob.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(np.float64)
    ext = co.max(0) - co.min(0)
    yaw = 0.0 if ext[0] >= ext[1] else math.pi / 2
    if FRONT_SIGN < 0:
        yaw += math.pi
    m = Matrix.Rotation(yaw, 4, "Z")
    m = Matrix.Scale(MM_PER_LDU, 4) @ m
    me.transform(m)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(np.float64)
    lo, hi = co.min(0), co.max(0)
    shift = Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))
    me.transform(Matrix.Translation(shift))
    me.update()
    size = hi - lo
    return {"length_mm": round(float(size[0]), 1), "width_mm": round(float(size[1]), 1),
            "height_mm": round(float(size[2]), 1), "yaw_deg": round(math.degrees(yaw), 1)}


# ------------------------------------------------------------------ previews

def render_preview(scene, objects, name, target_center, radius, views):
    for ob in scene.objects:
        if ob.type == "MESH":
            ob.hide_render = ob not in objects
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.render_aa = "8"
    s = scene.display.shading
    s.light = "STUDIO"
    s.color_type = "MATERIAL"
    s.show_cavity = True
    s.cavity_type = "WORLD"
    s.show_specular_highlight = True
    s.show_shadows = False
    s.show_backface_culling = True  # holes from wrong winding would show
    scene.view_settings.view_transform = "Standard"
    scene.render.film_transparent = False
    scene.render.resolution_x, scene.render.resolution_y = 1400, 900
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "8"
    cam = link(scene, "PreviewCamera", bpy.data.cameras.new("PreviewCamera"))
    cam.data.lens = 60
    scene.camera = cam
    fov = cam.data.angle
    dist = radius / math.sin(fov / 2) * 0.62
    for label, (az, el) in views.items():
        d = Vector((math.cos(math.radians(el)) * math.cos(math.radians(az)),
                    math.cos(math.radians(el)) * math.sin(math.radians(az)),
                    math.sin(math.radians(el))))
        cam.location = target_center + d * dist
        cam.data.clip_start = dist * 0.05
        cam.data.clip_end = dist * 4
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        scene.render.filepath = os.path.join(OUT, f"preview-{name}-{label}.png")
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


# ------------------------------------------------------------------ main

def main():
    opts = OPTS
    log(f"Blender {bpy.app.version_string}; options {opts}")
    scene = reset_scene()

    parts, materials, source_asset, load_stats = load_parts(os.path.abspath(opts["source"]))
    stage("load", **load_stats, kept_meshes=len(parts), tris_after_logos=tri_total(parts),
          materials_source=sum(len(m["sources"]) for m in materials.values()),
          materials_merged=len(materials))
    REPORT["materials"] = {k: {"sources": v["sources"], "source_color": v["source_color"],
                               "blend": v["blend"]} for k, v in materials.items()}
    REPORT["source"] = source_asset

    for p in parts:
        make_material(p["mat"], materials[p["base_mat"]])

    lo, hi = bounds(parts)
    center = Vector(((lo + hi) / 2).tolist())
    radius = float(np.linalg.norm(hi - lo) / 2)
    preview_views = {"front": (-40, 22), "rear": (140, 22), "side": (-90, 8), "top": (-60, 60)}

    seen, px_size, nviews = compute_visibility(scene, parts, opts)
    for p in parts:
        p["obj"].data.materials.append(bpy.data.materials[p["mat"]])
    if opts["previews"]:
        render_preview(scene, [p["obj"] for p in parts], "1-source", center, radius, preview_views)

    for p in parts:
        bpy.data.objects.remove(p.pop("obj"))
    visibility = {"seen": seen, "px_size": px_size, "views": nviews}
    with open(CACHE, "wb") as f:
        pickle.dump({"parts": parts, "materials": materials, "report": REPORT, "visibility": visibility,
                     "center": tuple(center), "radius": radius, "options": opts}, f)
    simplify(scene, parts, materials, visibility, center, radius, preview_views)


def resume():
    """Re-runs culling and simplification from the cache written after the ID renders."""
    global REPORT
    with open(CACHE, "rb") as f:
        cache = pickle.load(f)
    log(f"Blender {bpy.app.version_string}; resuming from {CACHE} (visibility options {cache['options']})")
    REPORT = cache["report"]
    REPORT["stages"] = [s for s in REPORT["stages"] if s["stage"] == "load"]
    scene = reset_scene()
    for p in cache["parts"]:
        make_material(p["mat"], cache["materials"][p["base_mat"]])
    simplify(scene, cache["parts"], cache["materials"], cache["visibility"], Vector(cache["center"]),
             cache["radius"], {"front": (-40, 22), "rear": (140, 22), "side": (-90, 8), "top": (-60, 60)})


def simplify(scene, parts, materials, visibility, center, radius, preview_views):
    opts = OPTS
    before_parts = len(parts)
    before_tris = tri_total(parts)
    parts, removed_parts, region_faces, slivers = cull_hidden(parts, visibility["seen"], visibility["px_size"])
    stage("visibility", views=visibility["views"], ldu_per_px=round(visibility["px_size"], 4),
          parts_before=before_parts, parts_removed=removed_parts, parts_kept=len(parts),
          faces_seen=int(visibility["seen"].sum()), region_faces_kept=region_faces,
          sliver_faces_kept=slivers, tris_before=before_tris, tris_after=tri_total(parts))

    debug = opts["previews"] > 1
    front = {"front": preview_views["front"], "top": preview_views["top"]}
    ob = join_parts(scene, parts, materials)
    del parts
    stage("join", objects=1, material_slots=len(ob.data.materials), tris=len(ob.data.polygons))
    if debug:
        render_preview(scene, [ob], "3-culled", center, radius, front)
    tris = planar_dissolve(ob)
    stage("planar_dissolve", angle_deg=PLANAR_ANGLE_DEG, tris=tris)
    if debug:
        render_preview(scene, [ob], "4-planar", center, radius, front)
    tris = decimate(scene, ob, opts["target"])
    stage("decimate", target=opts["target"], tris=tris)
    tris = finish_mesh(ob)
    dims = orient(ob)
    stage("finish", tris=tris, verts=len(ob.data.vertices), sharp_angle_deg=SHARP_ANGLE_DEG, **dims)
    REPORT["dimensions"] = dims

    if opts["previews"]:
        r = math.sqrt(dims["length_mm"] ** 2 + dims["width_mm"] ** 2 + dims["height_mm"] ** 2) / 2
        render_preview(scene, [ob], "2-optimized", Vector((0, 0, dims["height_mm"] / 2)), r,
                       {"front": (40, 22), "rear": (-140, 22), "side": (-90, 8), "top": (30, 60),
                        "close": (25, 12)})

    out_glb = os.path.join(OUT, "porsche-blender.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_glb, export_format="GLB", use_selection=False, export_yup=True,
        export_apply=True, export_texcoords=False, export_normals=True,
        export_materials="EXPORT", export_cameras=False, export_lights=False)
    REPORT["output"] = {"file": out_glb, "bytes": os.path.getsize(out_glb)}
    REPORT["settings"] = {"weld_ldu": WELD_LDU, "planar_angle_deg": PLANAR_ANGLE_DEG,
                          "sharp_angle_deg": SHARP_ANGLE_DEG, "boundary_weight": BOUNDARY_WEIGHT,
                          "small_face_px": SMALL_FACE_PX, "small_face_rings": SMALL_FACE_RINGS,
                          "mm_per_ldu": MM_PER_LDU, **{k: v for k, v in opts.items()}}
    with open(os.path.join(OUT, "optimize-report.json"), "w", encoding="utf-8") as f:
        json.dump(REPORT, f, indent=2, default=lambda o: o.item() if hasattr(o, "item") else str(o))
    log(f"done: {out_glb} ({os.path.getsize(out_glb) / 1e6:.2f} MB)")


try:
    resume() if OPTS["resume"] else main()
except SystemExit as e:
    log(f"FAILED: {e}")
    LOG.close()
    sys.exit(1)
except Exception:
    import traceback
    log("FAILED:\n" + traceback.format_exc())
    LOG.close()
    sys.exit(1)
LOG.close()
