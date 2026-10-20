"""US state map rendering from us-atlas (Census Bureau boundaries, public domain).

Geometry is pre-projected with d3.geoAlbersUsa().scale(1300).translate([487.5, 305]);
project() reproduces that projection for the lower 48 so city markers line up.
"""
import math
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from common import ROOT, load_json

SS = 4  # supersampling of the base map (975x610 viewport * SS)

CITIES = {
    "Seattle": (47.6062, -122.3321),
    "Salt Lake City": (40.7608, -111.8910),
    "Granger": (40.6900, -111.9800),
    "Aspen": (39.1911, -106.8175),
    "Glenwood Springs": (39.5505, -107.3248),
    "Tallahassee": (30.4383, -84.2807),
    "Pensacola": (30.4213, -87.2169),
    "Miami": (25.7617, -80.1918),
    "Starke": (29.9441, -82.1098),
}


def _conic_equal_area(lam, phi, p0=29.5, p1=45.5):
    sy0 = math.sin(math.radians(p0))
    n = (sy0 + math.sin(math.radians(p1))) / 2
    c = 1 + sy0 * (2 * n - sy0)
    r0 = math.sqrt(c) / n
    r = math.sqrt(c - 2 * n * math.sin(phi)) / n
    return r * math.sin(lam * n), r0 - r * math.cos(lam * n)


def project(lat, lon):
    k, tx, ty = 1300, 487.5, 305
    cx, cy = _conic_equal_area(math.radians(-0.6), math.radians(38.7))
    x, y = _conic_equal_area(math.radians(lon + 96), math.radians(lat))
    return tx + (x - cx) * k, ty - (y - cy) * k


@lru_cache(None)
def topology():
    topo = load_json(ROOT / "assets" / "data" / "states-albers-10m.json")
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        a = np.cumsum(np.array(arc, dtype=np.float64), axis=0)
        arcs.append(np.column_stack([a[:, 0] * sx + tx, a[:, 1] * sy + ty]))
    states = {}
    for g in topo["objects"]["states"]["geometries"]:
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        rings = []
        for poly in polys:
            for ring in poly:
                pts = []
                for i in ring:
                    seg = arcs[i] if i >= 0 else arcs[~i][::-1]
                    pts.extend(seg[1:] if pts else seg)
                rings.append(np.array(pts))
        states[g["properties"]["name"]] = rings
    return states


@lru_cache(None)
def base_layers():
    """Return (fill_mask, line_mask) as float arrays at SS resolution."""
    w, h = 975 * SS, 610 * SS
    fill = Image.new("L", (w, h), 0)
    line = Image.new("L", (w, h), 0)
    df, dl = ImageDraw.Draw(fill), ImageDraw.Draw(line)
    for name, rings in topology().items():
        for r in rings:
            pts = [tuple(p) for p in (r * SS)]
            df.polygon(pts, fill=255)
            dl.line(pts + [pts[0]], fill=255, width=max(1, SS // 2 + 1))
    return np.asarray(fill, np.float32) / 255, np.asarray(line, np.float32) / 255


@lru_cache(None)
def state_mask(name):
    w, h = 975 * SS, 610 * SS
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    for r in topology()[name]:
        d.polygon([tuple(p) for p in (r * SS)], fill=255)
    return np.asarray(m, np.float32) / 255


def render_view(cx, cy, zoom, out_w, out_h, highlights=(), hl_alpha=1.0):
    """Render the map centred on viewport point (cx, cy); zoom = output px per viewport px.

    Returns float32 RGB array (out_h, out_w, 3) in 0..1.
    """
    fill, line = base_layers()
    # affine crop from supersampled map
    scale = SS / zoom
    x0 = cx * SS - out_w / 2 * scale
    y0 = cy * SS - out_h / 2 * scale

    def sample(arr):
        im = Image.fromarray((arr * 255).astype(np.uint8))
        im = im.transform((out_w, out_h), Image.AFFINE, (scale, 0, x0, 0, scale, y0), resample=Image.BILINEAR)
        return np.asarray(im, np.float32) / 255

    f, l = sample(fill), sample(line)
    land = np.array([0.105, 0.105, 0.112], np.float32)
    sea = np.array([0.043, 0.043, 0.047], np.float32)
    edge = np.array([0.36, 0.36, 0.38], np.float32)
    img = sea + (land - sea) * f[..., None]
    for name in highlights:
        m = sample(state_mask(name)) * hl_alpha
        red = np.array([0.42, 0.06, 0.07], np.float32)
        img = img + (red - img) * (m[..., None] * 0.85)
    img = img + (edge - img) * (l[..., None] * 0.9)
    return img
