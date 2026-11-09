"""Downsample and re-encode the office chair's textures for build-chair.js.

Usage: python tools/model-pipeline/chair-textures.py <sourceTexturesDir> <outDir>
Colour map: 1024 px JPEG. Packed metallic/roughness: 512 px JPEG (smooth,
linear data). Normal map: 512 px PNG (lossless, avoids block artefacts).
"""
import json
import sys
from pathlib import Path

from PIL import Image

src = Path(sys.argv[1])
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

PLAN = [
    ("OfficeChair_Modern_baseColor.png", "baseColor.jpg", 1024, "JPEG", {"quality": 88, "optimize": True}),
    ("OfficeChair_Modern_metallicRoughness.png", "metallicRoughness.jpg", 512, "JPEG", {"quality": 90, "optimize": True}),
    ("OfficeChair_Modern_normal.png", "normal.png", 512, "PNG", {"optimize": True}),
]

report = []
for name, target, size, fmt, opts in PLAN:
    image = Image.open(src / name).convert("RGB")
    original = image.size
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    image.save(out / target, fmt, **opts)
    report.append({"source": name, "file": target, "from": original, "to": [size, size],
                   "kb": round((out / target).stat().st_size / 1024)})
print(json.dumps(report))
