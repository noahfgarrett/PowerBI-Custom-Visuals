"""Extract a Fan Filter Unit (FFU) layout CSV from a Bluebeam vector FFU map PDF.

Usage: python3 scripts/ffu-layout/extract_ffu_layout.py <pdf> -o <csv>

Reads page 1 of the PDF and writes one row per FFU tag: the box centre (PDF points, origin
top-left, y down), the traced line it sits on, its 1-based order from the line's home run,
the line colour, the home-run / finish flags and the grid column / row parsed from the tag.
Prints a stats report to stdout.

Run it against your own copy of the drawing and keep the output outside the repo.
"""
import argparse
import collections
import csv
import heapq
import math
import os
import re
import sys

try:
    import fitz
except ImportError:
    fitz = None

INSTALL_MESSAGE = 'PyMuPDF is required: python3 -m pip install pymupdf'

TAG_RE = re.compile(r'^FFU(\d{3})-([A-Z]{2})(\d{2})-([A-Z]\d{2})-([A-Z])$')
GRID_COL_RE = re.compile(r'^[A-Z]{2}$')
GRID_ROW_RE = re.compile(r'^\d{2}$')

CSV_HEADER = ['FFU Tag', 'X', 'Y', 'Line', 'Line Order', 'Line Colour',
              'Home Run', 'Finish', 'Grid Column', 'Grid Row']

# ---------------------------------------------------------------- tolerances (PDF points)
CELL = 20.0                      # spatial hash cell size
THIN_WIDTH = (0.2, 0.3)          # stroke width of box and fan symbol strokes
STRING_WIDTH = (0.5, 1.1)        # stroke width of line polylines (0.6; a few Bluebeam defaults are 1.0)
GRAY_TOL = 0.05                  # max channel spread for a colour to count as grey
COLOUR_MATCH_TOL = 0.06          # per-channel tolerance when matching a tag colour to its box
AXIS_TOL = 0.2                   # a stroke is horizontal / vertical within this
JOIN_TOL = 1.5                   # line endpoints closer than this are the same vertex
BOX_JOIN_PAD = 0.5               # chain ends this far outside a box still count as inside it
BOX_JOIN_COLOUR_TOL = 0.3        # chains meeting in a box join when their colours are this close
ASSIGN_TOL = 2.5                 # a line must pass this close to the fan centre
ASSIGN_SEARCH = 8.0              # search radius for line segments around a fan
END_IN_BOX_PAD = 1.2             # a chain end this far outside a box still attaches the FFU
CROSSING_SEARCH = 9.0            # search radius for a line crossing a box but missing the fan
CROSSING_INSET = 0.3             # a crossing point must lie this far inside the box edge
MARKER_TOL = 9.0                 # home-run / finish square centre to box centre
MARKER_SIZE = (3.0, 16.0)        # side length range of a home-run / finish square
DEFAULT_BOX = 12.3               # box side used when no box strokes are found
BOX_CY_FROM_WORD = -4.575        # box centre y relative to tag word centre y
BOX_SEARCH = 14.0                # search radius for box edges around the fan
BOX_EDGE_LENGTH = (3.0, 40.0)    # length range of a box edge stroke
BOX_EDGE_OFFSET = 10.0           # max distance from fan centre to a box edge
FAN_STROKE_LENGTH = (0.15, 1.0)  # length range of a fan ring stroke
FAN_CLUSTER_GAP = 0.9            # fan strokes closer than this belong to the same fan
FAN_MIN_STROKES = 8
FAN_SIZE = (1.0, 6.0)            # fan bounding box side range
FAN_SQUARE_TOL = 1.0             # fan bounding box width and height differ by less than this
FAN_TAG_MAX_DIST = 10.0          # fan centre to tag word centre
LINE_SORT_ROW_BAND = 26.0        # home runs within this vertical band sort left to right
GRID_BUBBLE_SIZE = (10.0, 40.0)  # diameter range of a grid label bubble
GRID_STROKE_MAX = 5.5            # grid dashes and dots are no longer than this
GRID_AXIS_TOL = 0.4              # a grid stroke lies this close to a grid coordinate

HOME_COLOUR = (0.0, 1.0, 0.0)
FINISH_COLOUR = (0.0, 0.0, 1.0)


def is_gray(c):
    return max(c) - min(c) < GRAY_TOL


def is_red(c):
    return c[0] > 0.9 and c[1] < 0.1 and c[2] < 0.1


def same_colour(a, b):
    return all(abs(x - y) < COLOUR_MATCH_TOL for x, y in zip(a, b))


def hex_colour(c):
    return '#%02X%02X%02X' % tuple(int(round(v * 255)) for v in c)


def snap_colour(c):
    # (0.24,1,1) and (0.25,1,1) are the same Bluebeam colour; snap to quarters.
    return tuple(round(v * 4) / 4 for v in c)


def cell_of(x, y):
    return int(x // CELL), int(y // CELL)


def neighbour_cells(x, y):
    gx, gy = cell_of(x, y)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            yield gx + dx, gy + dy


class SegIndex:
    """Uniform-grid spatial hash over line segments."""

    def __init__(self):
        self.buckets = collections.defaultdict(list)

    def add(self, key, a, b):
        x0, x1 = sorted((a[0], b[0]))
        y0, y1 = sorted((a[1], b[1]))
        for gx in range(int(x0 // CELL), int(x1 // CELL) + 1):
            for gy in range(int(y0 // CELL), int(y1 // CELL) + 1):
                self.buckets[(gx, gy)].append((key, a, b))

    def near(self, x, y, r):
        seen = set()
        for gx in range(int((x - r) // CELL), int((x + r) // CELL) + 1):
            for gy in range(int((y - r) // CELL), int((y + r) // CELL) + 1):
                for item in self.buckets.get((gx, gy), ()):
                    if item not in seen:
                        seen.add(item)
                        yield item


def seg_dist(px, py, a, b):
    """Distance from (px, py) to segment ab, and the projection parameter t in [0, 1]."""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    len2 = dx * dx + dy * dy
    t = 0.0 if len2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / len2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t


class UnionFind:

    def __init__(self, n):
        self.parent = list(range(n))

    def find(self, i):
        while self.parent[i] != i:
            self.parent[i] = self.parent[self.parent[i]]
            i = self.parent[i]
        return i

    def union(self, i, j):
        self.parent[self.find(i)] = self.find(j)


# ---------------------------------------------------------------- tags
def read_tags(page):
    """Tag text spans. The span colour equals the box colour (the FFU level)."""
    tags = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                m = TAG_RE.match(span['text'].strip())
                if not m:
                    continue
                c = span['color']
                rgb = ((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255
                b = span['bbox']
                tags.append({'tag': m.group(0), 'wx': (b[0] + b[2]) / 2, 'wy': (b[1] + b[3]) / 2,
                             'rgb': rgb, 'grid_col': m.group(2), 'grid_row': m.group(3)})
    return tags


# ---------------------------------------------------------------- grid
def find_grid_coordinates(page, drawings):
    """x of each grid column and y of each grid row, from the labelled grid bubbles.

    Only used to recognise grid dash-dot strokes; the grid itself is not output.
    """
    bubbles = {}
    for d in drawings:
        items = d['items']
        if d['type'] == 's' and len(items) == 4 and all(i[0] == 'c' for i in items):
            r = d['rect']
            if GRID_BUBBLE_SIZE[0] < r.width < GRID_BUBBLE_SIZE[1] and abs(r.width - r.height) < 1:
                bubbles[(round(r.x0), round(r.y0))] = r
    cols = collections.defaultdict(list)
    rows = collections.defaultdict(list)
    for w in page.get_text('words'):
        cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
        for r in bubbles.values():
            if r.contains(fitz.Point(cx, cy)):
                if GRID_COL_RE.match(w[4]):
                    cols[w[4]].append((r.x0 + r.x1) / 2)
                elif GRID_ROW_RE.match(w[4]):
                    rows[w[4]].append((r.y0 + r.y1) / 2)
                break
    xs = [sum(v) / len(v) for v in cols.values()]
    ys = [sum(v) / len(v) for v in rows.values()]
    return xs, ys


def is_grid_stroke(a, b, grid_xs, grid_ys):
    """Grid lines are dash-dot strokes on a grid coordinate, drawn in every layer colour."""
    if math.hypot(b[0] - a[0], b[1] - a[1]) > GRID_STROKE_MAX:
        return False
    if abs(a[0] - b[0]) < AXIS_TOL:
        return any(abs(a[0] - x) < GRID_AXIS_TOL for x in grid_xs)
    if abs(a[1] - b[1]) < AXIS_TOL:
        return any(abs(a[1] - y) < GRID_AXIS_TOL for y in grid_ys)
    return False


# ---------------------------------------------------------------- boxes and fans
def build_thin_index(drawings, grid_xs, grid_ys):
    """Thin straight strokes (box edges, fan rings), keyed by stroke colour, minus grid strokes."""
    index = SegIndex()
    for d in drawings:
        col = d.get('color')
        width = d.get('width') or 0
        if d['type'] != 's' or not col or not (THIN_WIDTH[0] <= width <= THIN_WIDTH[1]):
            continue
        if is_gray(col) and max(col) > GRAY_TOL:
            continue
        for item in d['items']:
            if item[0] != 'l':
                continue
            a, b = (item[1].x, item[1].y), (item[2].x, item[2].y)
            if not is_grid_stroke(a, b, grid_xs, grid_ys):
                index.add(tuple(col), a, b)
    return index


def find_fans(thin_index):
    """Each FFU box holds one fan: concentric rings of short strokes in the box colour."""
    short = collections.defaultdict(list)  # colour -> stroke midpoints
    for bucket in thin_index.buckets.values():
        for col, a, b in bucket:
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            if FAN_STROKE_LENGTH[0] < length < FAN_STROKE_LENGTH[1]:
                short[tuple(round(v, 2) for v in col)].append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
    fans = []  # (colour, fx, fy)
    for col, pts in short.items():
        pts = sorted(set(pts))
        uf = UnionFind(len(pts))
        grid = collections.defaultdict(list)
        for i, (x, y) in enumerate(pts):
            grid[(int(x // 1), int(y // 1))].append(i)
        for i, (x, y) in enumerate(pts):
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for j in grid.get((int(x // 1) + dx, int(y // 1) + dy), ()):
                        if j > i and math.hypot(pts[j][0] - x, pts[j][1] - y) < FAN_CLUSTER_GAP:
                            uf.union(i, j)
        groups = collections.defaultdict(list)
        for i in range(len(pts)):
            groups[uf.find(i)].append(pts[i])
        for g in groups.values():
            xs = [p[0] for p in g]
            ys = [p[1] for p in g]
            w, h = max(xs) - min(xs), max(ys) - min(ys)
            if (len(g) >= FAN_MIN_STROKES and FAN_SIZE[0] < w < FAN_SIZE[1]
                    and FAN_SIZE[0] < h < FAN_SIZE[1] and abs(w - h) < FAN_SQUARE_TOL):
                fans.append((col, (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2))
    return fans


def match_fans(tags, fans):
    """Pair each tag with the nearest same-colour fan, closest pairs first."""
    fan_grid = collections.defaultdict(list)
    for k, f in enumerate(fans):
        fan_grid[cell_of(f[1], f[2])].append(k)
    pairs = []
    for ti, t in enumerate(tags):
        for cell in neighbour_cells(t['wx'], t['wy']):
            for k in fan_grid.get(cell, ()):
                f = fans[k]
                if same_colour(f[0], t['rgb']):
                    d = math.hypot(f[1] - t['wx'], f[2] - t['wy'])
                    if d < FAN_TAG_MAX_DIST:
                        pairs.append((d, ti, k))
    pairs.sort()
    fan_of = {}
    used = set()
    for _, ti, k in pairs:
        if ti not in fan_of and k not in used:
            fan_of[ti] = k
            used.add(k)
    return fan_of


def locate_boxes(tags, fans, fan_of, thin_index):
    """Set each tag's fan centre (fx, fy), box centre (x, y) and box size (w, h)."""
    for ti, t in enumerate(tags):
        if ti in fan_of:
            _, fx, fy = fans[fan_of[ti]]
        else:
            fx, fy = t['wx'], t['wy'] + BOX_CY_FROM_WORD
        lefts, rights, tops, bots = [], [], [], []
        for col, a, b in thin_index.near(fx, fy, BOX_SEARCH):
            if not same_colour(col, t['rgb']):
                continue
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            if not (BOX_EDGE_LENGTH[0] <= length <= BOX_EDGE_LENGTH[1]):
                continue
            if abs(a[0] - b[0]) < AXIS_TOL:
                y0, y1 = sorted((a[1], b[1]))
                if y0 <= fy <= y1 and abs(a[0] - fx) < BOX_EDGE_OFFSET:
                    (lefts if a[0] < fx else rights).append(a[0])
            elif abs(a[1] - b[1]) < AXIS_TOL:
                x0, x1 = sorted((a[0], b[0]))
                if x0 <= fx <= x1 and abs(a[1] - fy) < BOX_EDGE_OFFSET:
                    (tops if a[1] < fy else bots).append(a[1])
        if lefts and rights and tops and bots:
            left, right, top, bottom = max(lefts), min(rights), max(tops), min(bots)
        else:
            h = DEFAULT_BOX / 2
            left, right, top, bottom = fx - h, fx + h, fy - h, fy + h
        t['x'], t['y'] = (left + right) / 2, (top + bottom) / 2
        t['w'], t['h'] = right - left, bottom - top
        t['fx'], t['fy'] = fx, fy


# ---------------------------------------------------------------- markers and chains
def read_rect_markers(drawings):
    """Home-run (pure green) and finish (pure blue) squares drawn as single rectangles."""
    markers = []  # (kind, cx, cy)
    for d in drawings:
        col = d.get('color')
        if d['type'] != 's' or not col or len(d['items']) != 1 or d['items'][0][0] not in ('re', 'qu'):
            continue
        r = d['rect']
        if not (MARKER_SIZE[0] < r.width < MARKER_SIZE[1] and MARKER_SIZE[0] < r.height < MARKER_SIZE[1]):
            continue
        c = tuple(round(v, 2) for v in col)
        kind = 'home' if c == HOME_COLOUR else 'finish' if c == FINISH_COLOUR else None
        if kind:
            markers.append((kind, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
    return markers


def read_chains(drawings):
    """Coloured line polylines of string width, as (snapped colour, [points])."""
    chains = []
    for d in drawings:
        col = d.get('color')
        width = d.get('width') or 0
        if d['type'] != 's' or not col or is_gray(col) or is_red(col):
            continue
        if not (STRING_WIDTH[0] <= width <= STRING_WIDTH[1]):
            continue
        cur = None
        for item in d['items']:
            if item[0] != 'l':
                cur = None
                continue
            a, b = (item[1].x, item[1].y), (item[2].x, item[2].y)
            if cur and math.hypot(cur[1][-1][0] - a[0], cur[1][-1][1] - a[1]) < 0.01:
                cur[1].append(b)
            else:
                cur = (snap_colour(col), [a, b])
                chains.append(cur)
    return chains


def split_polyline_markers(chains):
    """Some home-run / finish squares are short green / blue polylines; turn them into markers."""
    kept, markers = [], []
    for col, pts in chains:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        small = max(xs) - min(xs) < MARKER_SIZE[1] and max(ys) - min(ys) < MARKER_SIZE[1]
        if col in (HOME_COLOUR, FINISH_COLOUR) and small:
            kind = 'home' if col == HOME_COLOUR else 'finish'
            markers.append((kind, (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2))
        else:
            kept.append((col, pts))
    return kept, markers


def join_chain_ends(chains, uf):
    """Union same-colour chains whose endpoints lie within JOIN_TOL."""
    ends = collections.defaultdict(list)
    for i, (col, pts) in enumerate(chains):
        for p in (pts[0], pts[-1]):
            ends[(col, round(p[0] / JOIN_TOL), round(p[1] / JOIN_TOL))].append((i, p))
    for (col, gx, gy), lst in list(ends.items()):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j, q in ends.get((col, gx + dx, gy + dy), ()):
                    for i, p in lst:
                        if i != j and math.hypot(p[0] - q[0], p[1] - q[1]) < JOIN_TOL:
                            uf.union(i, j)


# ---------------------------------------------------------------- extraction
def extract(pdf_path):
    """Return (rows, stats) for page 1 of the PDF. Rows are CSV dicts sorted by tag."""
    if fitz is None:
        raise RuntimeError(INSTALL_MESSAGE)
    with fitz.open(pdf_path) as doc:
        page = doc[0]
        tags = read_tags(page)
        drawings = page.get_drawings()
        grid_xs, grid_ys = find_grid_coordinates(page, drawings)

    tag_counts = collections.Counter(t['tag'] for t in tags)
    duplicates = {k: v for k, v in sorted(tag_counts.items()) if v > 1}

    thin_index = build_thin_index(drawings, grid_xs, grid_ys)
    fans = find_fans(thin_index)
    locate_boxes(tags, fans, match_fans(tags, fans), thin_index)

    markers = read_rect_markers(drawings)
    chains, polyline_markers = split_polyline_markers(read_chains(drawings))
    markers += polyline_markers

    uf = UnionFind(len(chains))
    join_chain_ends(chains, uf)

    # ------------------------------------------------ chain geometry lookups
    seg_index = SegIndex()
    seg_pos = {}      # (chain, a, b) -> segment index
    prefix = []       # per chain: arclength at each vertex
    for ci, (col, pts) in enumerate(chains):
        acc = [0.0]
        for k in range(len(pts) - 1):
            seg_index.add(ci, pts[k], pts[k + 1])
            seg_pos[(ci, pts[k], pts[k + 1])] = k
            acc.append(acc[-1] + math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]))
        prefix.append(acc)

    def arclength(ci, a, b, u):
        return prefix[ci][seg_pos[(ci, a, b)]] + u * math.hypot(b[0] - a[0], b[1] - a[1])

    centre_grid = collections.defaultdict(list)
    for fi, t in enumerate(tags):
        centre_grid[cell_of(t['x'], t['y'])].append(fi)

    def boxes_containing(p, pad):
        out = []
        for cell in neighbour_cells(p[0], p[1]):
            for fi in centre_grid.get(cell, ()):
                t = tags[fi]
                if abs(p[0] - t['x']) <= t['w'] / 2 + pad and abs(p[1] - t['y']) <= t['h'] / 2 + pad:
                    out.append(fi)
        return out

    # Chains whose ends meet inside the same FFU box continue each other. Colours may differ
    # slightly (a hand-added connector in a near colour).
    ends_in_box = collections.defaultdict(list)
    for ci, (col, pts) in enumerate(chains):
        for p in (pts[0], pts[-1]):
            for fi in boxes_containing(p, BOX_JOIN_PAD):
                ends_in_box[fi].append(ci)
    for cis in ends_in_box.values():
        for i in range(len(cis)):
            for j in range(i + 1, len(cis)):
                a, b = cis[i], cis[j]
                if a != b and uf.find(a) != uf.find(b) and math.dist(chains[a][0], chains[b][0]) <= BOX_JOIN_COLOUR_TOL:
                    uf.union(a, b)

    # ------------------------------------------------ assignment
    chain_hits = collections.defaultdict(list)  # chain -> [(arclength, ffu)]
    ffu_comp = {}                               # ffu -> component

    # first pass: the line passes through the fan symbol; the closest component wins
    for fi, t in enumerate(tags):
        best = {}
        for ci, a, b in seg_index.near(t['fx'], t['fy'], ASSIGN_SEARCH):
            d, u = seg_dist(t['fx'], t['fy'], a, b)
            if ci not in best or d < best[ci][0]:
                best[ci] = (d, arclength(ci, a, b, u))
        comp_dist = {}
        for ci, (d, s) in best.items():
            if d <= ASSIGN_TOL:
                chain_hits[ci].append((s, fi))
                comp = uf.find(ci)
                comp_dist[comp] = min(d, comp_dist.get(comp, math.inf))
        if comp_dist:
            ffu_comp[fi] = min(comp_dist.items(), key=lambda kv: kv[1])[0]

    # second pass: a chain end stops at the edge of an unassigned home-run / finish box
    for ci, (col, pts) in enumerate(chains):
        for end_s, p in ((0.0, pts[0]), (prefix[ci][-1], pts[-1])):
            best = None
            for cell in neighbour_cells(p[0], p[1]):
                for fi in centre_grid.get(cell, ()):
                    if fi in ffu_comp:
                        continue
                    t = tags[fi]
                    if abs(p[0] - t['x']) <= t['w'] / 2 + END_IN_BOX_PAD and abs(p[1] - t['y']) <= t['h'] / 2 + END_IN_BOX_PAD:
                        d = math.hypot(p[0] - t['fx'], p[1] - t['fy'])
                        if best is None or d < best[0]:
                            best = (d, fi)
            if best:
                ffu_comp[best[1]] = uf.find(ci)
                chain_hits[ci].append((end_s, best[1]))

    # third pass: the line crosses the box interior but misses the fan
    for fi, t in enumerate(tags):
        if fi in ffu_comp:
            continue
        best = None
        for ci, a, b in seg_index.near(t['fx'], t['fy'], CROSSING_SEARCH):
            d, u = seg_dist(t['fx'], t['fy'], a, b)
            qx, qy = a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])
            inside = (abs(qx - t['x']) < t['w'] / 2 - CROSSING_INSET
                      and abs(qy - t['y']) < t['h'] / 2 - CROSSING_INSET)
            if inside and (best is None or d < best[0]):
                best = (d, ci, arclength(ci, a, b, u))
        if best:
            _, ci, s = best
            ffu_comp[fi] = uf.find(ci)
            chain_hits[ci].append((s, fi))

    # ------------------------------------------------ FFU graph
    # Consecutive FFUs along a chain are linked; chains of one component that meet at an
    # endpoint link the nearest FFU on each side of the junction.
    adj = collections.defaultdict(dict)

    def link(i, j, w):
        if i != j and (j not in adj[i] or w < adj[i][j]):
            adj[i][j] = w
            adj[j][i] = w

    for ci, hits in chain_hits.items():
        comp = uf.find(ci)
        hs = sorted((s, fi) for s, fi in hits if ffu_comp.get(fi) == comp)
        for (s1, f1), (s2, f2) in zip(hs, hs[1:]):
            link(f1, f2, s2 - s1)

    comp_chains = collections.defaultdict(list)
    for ci in range(len(chains)):
        comp_chains[uf.find(ci)].append(ci)
    for comp, cis in comp_chains.items():
        if len(cis) < 2:
            continue
        for ci in cis:
            pts = chains[ci][1]
            for end_s, p in ((0.0, pts[0]), (prefix[ci][-1], pts[-1])):
                for cj in cis:
                    if cj == ci:
                        continue
                    qpts = chains[cj][1]
                    for end_t, q in ((0.0, qpts[0]), (prefix[cj][-1], qpts[-1])):
                        if math.hypot(p[0] - q[0], p[1] - q[1]) < JOIN_TOL:
                            hi = sorted((abs(s - end_s), fi) for s, fi in chain_hits.get(ci, []) if ffu_comp.get(fi) == comp)
                            hj = sorted((abs(s - end_t), fi) for s, fi in chain_hits.get(cj, []) if ffu_comp.get(fi) == comp)
                            if hi and hj:
                                link(hi[0][1], hj[0][1], hi[0][0] + hj[0][0])

    # Connected FFU-graph components are the lines: a colour component can still split when a
    # chain carries no FFUs between two groups.
    line_of = {}
    lines = []
    for fi in sorted(ffu_comp):
        if fi in line_of:
            continue
        stack, members = [fi], []
        line_of[fi] = len(lines)
        while stack:
            u = stack.pop()
            members.append(u)
            for v in adj[u]:
                if v not in line_of:
                    line_of[v] = len(lines)
                    stack.append(v)
        lines.append({'members': members, 'comp': ffu_comp[fi]})

    # ------------------------------------------------ home runs and finishes
    is_home, is_finish = set(), set()
    for kind, mx, my in markers:
        best = None
        for cell in neighbour_cells(mx, my):
            for fi in centre_grid.get(cell, ()):
                d = math.hypot(tags[fi]['x'] - mx, tags[fi]['y'] - my)
                if d < MARKER_TOL and (best is None or d < best[0]):
                    best = (d, fi)
        if best:
            (is_home if kind == 'home' else is_finish).add(best[1])

    # ------------------------------------------------ order: Dijkstra from the home run
    order_of = {}
    for ln in lines:
        mem = ln['members']
        homes = [f for f in mem if f in is_home]
        finishes = set(f for f in mem if f in is_finish)
        ln['has_home'] = bool(homes)
        ln['has_finish'] = bool(finishes)
        if homes:
            start = homes[0]
        else:
            # no home run: start at a leaf, preferring one that is not the finish
            leaves = [f for f in mem if len(adj[f]) <= 1]
            start = leaves[0] if leaves else mem[0]
            if finishes and len(leaves) > 1:
                start = next((f for f in leaves if f not in finishes), leaves[0])
        dist = {start: 0.0}
        pq = [(0.0, start)]
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist[u]:
                continue
            for v, w in adj[u].items():
                nd = d + w
                if nd < dist.get(v, math.inf):
                    dist[v] = nd
                    heapq.heappush(pq, (nd, v))
        ln['order'] = sorted(mem, key=lambda f: (dist.get(f, math.inf), f))
        for pos, f in enumerate(ln['order'], start=1):
            order_of[f] = pos

    # ------------------------------------------------ line ids by home-run position
    def first_position(ln):
        t = tags[ln['order'][0]]
        return round(t['y'] / LINE_SORT_ROW_BAND), t['x']

    line_id = {}
    line_colour = {}
    for n, ln in enumerate(sorted(lines, key=first_position), start=1):
        lid = 'L%03d' % n
        hexc = hex_colour(chains[comp_chains[ln['comp']][0]][0])
        for f in ln['members']:
            line_id[f] = lid
            line_colour[f] = hexc

    # ------------------------------------------------ rows and stats
    rows = []
    for fi, t in sorted(enumerate(tags), key=lambda it: (it[1]['tag'], it[1]['x'], it[1]['y'])):
        rows.append({
            'FFU Tag': t['tag'],
            'X': round(t['x'], 2),
            'Y': round(t['y'], 2),
            'Line': line_id.get(fi, ''),
            'Line Order': order_of.get(fi, ''),
            'Line Colour': line_colour.get(fi, ''),
            'Home Run': 'TRUE' if fi in is_home else 'FALSE',
            'Finish': 'TRUE' if fi in is_finish else 'FALSE',
            'Grid Column': t['grid_col'],
            'Grid Row': t['grid_row'],
        })

    stats = {
        'tags': len(tags),
        'duplicate_tags': duplicates,
        'lines': len(lines),
        'ffus_on_lines': len(ffu_comp),
        'unassigned': sorted(t['tag'] for fi, t in enumerate(tags) if fi not in ffu_comp),
        'lines_without_home_run': sum(1 for ln in lines if not ln['has_home']),
        'lines_without_finish': sum(1 for ln in lines if not ln['has_finish']),
    }
    return rows, stats


def write_csv(rows, csv_path):
    with open(csv_path, 'w', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADER)
        writer.writeheader()
        writer.writerows(rows)


def format_stats(stats):
    lines = [
        f"FFU tags found:         {stats['tags']}",
        f"Duplicate tags:         {len(stats['duplicate_tags'])}",
    ]
    lines += [f'  {tag} x{count}' for tag, count in stats['duplicate_tags'].items()]
    lines += [
        f"Lines traced:           {stats['lines']}",
        f"FFUs on lines:          {stats['ffus_on_lines']}",
        f"FFUs on no line:        {len(stats['unassigned'])}",
    ]
    lines += [f'  {tag}' for tag in stats['unassigned']]
    lines += [
        f"Lines without home run: {stats['lines_without_home_run']}",
        f"Lines without finish:   {stats['lines_without_finish']}",
    ]
    return '\n'.join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description='Extract an FFU layout CSV from an FFU map PDF.')
    parser.add_argument('pdf', help='path to the FFU map PDF')
    parser.add_argument('-o', '--output', required=True, help='path of the CSV to write')
    args = parser.parse_args(argv)

    if fitz is None:
        print(INSTALL_MESSAGE, file=sys.stderr)
        return 2

    if not os.path.isfile(args.pdf):
        print(f'PDF not found: {args.pdf}', file=sys.stderr)
        return 1
    rows, stats = extract(args.pdf)
    if stats['tags'] == 0:
        print(f'No FFU tags found in {args.pdf}', file=sys.stderr)
        return 1
    write_csv(rows, args.output)
    print(format_stats(stats))
    return 0


if __name__ == '__main__':
    sys.exit(main())
