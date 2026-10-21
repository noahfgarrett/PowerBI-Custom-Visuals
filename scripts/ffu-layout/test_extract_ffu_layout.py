"""Tests for extract_ffu_layout.py.

Every PDF used here is synthetic, built at test time with made-up tags. Never add a real
drawing, or anything derived from one, to this folder.

Run: python3 -m unittest scripts/ffu-layout/test_extract_ffu_layout.py -v
"""
import csv
import math
import os
import subprocess
import sys
import tempfile
import unittest

import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import extract_ffu_layout  # noqa: E402

SCRIPT = os.path.join(HERE, 'extract_ffu_layout.py')

EXPECTED_HEADER = ['FFU Tag', 'X', 'Y', 'Line', 'Line Order', 'Line Colour',
                   'Home Run', 'Finish', 'Grid Column', 'Grid Row']

BLACK = (0.0, 0.0, 0.0)
MAGENTA = (1.0, 0.0, 1.0)
GREEN = (0.0, 1.0, 0.0)
BLUE = (0.0, 0.0, 1.0)

BOX_SIDE = 12.3
THIN = 0.25           # box and fan stroke width
STRING_WIDTH = 0.6    # coloured line width
MARKER_WIDTH = 1.5    # thick home-run / finish outline
FAN_RADIUS = 2.0
FAN_STROKES = 16

# Box centres of the six synthetic FFUs. The fan sits at the box centre.
BOXES = [
    ('FFU900-ZZ01-F01-A', 100.0, 100.0),   # 1: line A, home run
    ('FFU900-ZZ01-F02-A', 150.0, 100.0),   # 2: line A
    ('FFU900-ZZ02-F03-A', 200.0, 100.0),   # 3: line A, finish
    ('FFU901-ZY03-F01-A', 100.0, 200.0),   # 4: line B, home run
    ('FFU901-ZY03-F02-A', 150.0, 200.0),   # 5: line B, finish
    ('FFU902-ZX04-F01-A', 250.0, 300.0),   # 6: on no line
]
TAG = [b[0] for b in BOXES]


def draw_ffu(page, tag, cx, cy):
    """A thin square box, a fan ring of short strokes and the tag text, all in one colour."""
    h = BOX_SIDE / 2
    shape = page.new_shape()
    # Edges are drawn top, bottom, left, right so they stay separate strokes; four connected
    # edges would be read back as a single quad item.
    shape.draw_line((cx - h, cy - h), (cx + h, cy - h))
    shape.draw_line((cx - h, cy + h), (cx + h, cy + h))
    shape.draw_line((cx - h, cy - h), (cx - h, cy + h))
    shape.draw_line((cx + h, cy - h), (cx + h, cy + h))
    for k in range(FAN_STROKES):
        a0 = 2 * math.pi * k / FAN_STROKES
        a1 = 2 * math.pi * (k + 1) / FAN_STROKES
        shape.draw_line((cx + FAN_RADIUS * math.cos(a0), cy + FAN_RADIUS * math.sin(a0)),
                        (cx + FAN_RADIUS * math.cos(a1), cy + FAN_RADIUS * math.sin(a1)))
    shape.finish(color=BLACK, width=THIN)
    shape.commit()
    # The tag text sits in the lower part of the box, below the fan.
    page.insert_text((cx - 5.5, cy + 4.9), tag, fontsize=0.9, color=BLACK)


def draw_string(page, points):
    shape = page.new_shape()
    shape.draw_polyline(points)
    shape.finish(color=MAGENTA, width=STRING_WIDTH, closePath=False)
    shape.commit()


def draw_marker(page, cx, cy, colour):
    h = BOX_SIDE / 2 + 0.4
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(cx - h, cy - h, cx + h, cy + h))
    shape.finish(color=colour, width=MARKER_WIDTH)
    shape.commit()


def build_fixture_pdf(path):
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    for tag, cx, cy in BOXES:
        draw_ffu(page, tag, cx, cy)
    # Line A joins boxes 1, 2 and 3, drawn from the finish end so the order must come from the
    # home run, not the drawing direction. Line B: boxes 4 -> 5, same colour, not touching line A.
    draw_string(page, [(BOXES[2][1], BOXES[2][2]), (BOXES[1][1], BOXES[1][2]), (BOXES[0][1], BOXES[0][2])])
    draw_string(page, [(BOXES[3][1], BOXES[3][2]), (BOXES[4][1], BOXES[4][2])])
    draw_marker(page, BOXES[0][1], BOXES[0][2], GREEN)
    draw_marker(page, BOXES[2][1], BOXES[2][2], BLUE)
    draw_marker(page, BOXES[3][1], BOXES[3][2], GREEN)
    draw_marker(page, BOXES[4][1], BOXES[4][2], BLUE)
    doc.save(path)
    doc.close()


class ExtractFfuLayoutTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls.pdf_path = os.path.join(cls._tmp.name, 'synthetic.pdf')
        cls.csv_path = os.path.join(cls._tmp.name, 'ffu_layout.csv')
        build_fixture_pdf(cls.pdf_path)
        cls.cli = subprocess.run([sys.executable, SCRIPT, cls.pdf_path, '-o', cls.csv_path],
                                 capture_output=True, text=True)
        with open(cls.csv_path, newline='') as fh:
            reader = csv.reader(fh)
            cls.header = next(reader)
        with open(cls.csv_path, newline='') as fh:
            cls.rows = {row['FFU Tag']: row for row in csv.DictReader(fh)}
        cls.extracted_rows, cls.stats = extract_ffu_layout.extract(cls.pdf_path)

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_cli_exits_0(self):
        self.assertEqual(self.cli.returncode, 0, self.cli.stderr)

    def test_cli_prints_stats_report(self):
        report = self.cli.stdout.splitlines()
        self.assertIn(f'FFU tags found:         {len(TAG)}', report)
        self.assertIn('Lines traced:           2', report)
        self.assertIn('FFUs on no line:        1', report)
        self.assertIn(f'  {TAG[5]}', report)

    def test_writes_header_in_order(self):
        self.assertEqual(self.header, EXPECTED_HEADER)

    def test_same_colour_lines_split_by_connectivity(self):
        line_a = self.rows[TAG[0]]
        line_b = self.rows[TAG[3]]
        self.assertNotEqual(line_a['Line'], '')
        self.assertNotEqual(line_b['Line'], '')
        self.assertNotEqual(line_a['Line'], line_b['Line'])
        self.assertEqual(line_a['Line Colour'], '#FF00FF')
        self.assertEqual(line_b['Line Colour'], '#FF00FF')
        self.assertEqual(self.stats['lines'], 2)

    def test_line_order_starts_at_home_run(self):
        self.assertEqual([self.rows[t]['Line Order'] for t in TAG[:3]], ['1', '2', '3'])
        self.assertEqual([self.rows[t]['Home Run'] for t in TAG[:3]], ['TRUE', 'FALSE', 'FALSE'])
        self.assertEqual([self.rows[t]['Finish'] for t in TAG[:3]], ['FALSE', 'FALSE', 'TRUE'])

    def test_unassigned_ffu_keeps_position(self):
        row = self.rows[TAG[5]]
        self.assertAlmostEqual(float(row['X']), BOXES[5][1], delta=0.5)
        self.assertAlmostEqual(float(row['Y']), BOXES[5][2], delta=0.5)
        self.assertEqual(row['Line'], '')
        self.assertEqual(row['Line Order'], '')
        self.assertEqual(row['Line Colour'], '')
        self.assertEqual(self.stats['unassigned'], [TAG[5]])

    def test_grid_fields_parsed_from_tag(self):
        for tag in TAG:
            grid = tag.split('-')[1]
            self.assertEqual(self.rows[tag]['Grid Column'], grid[:2])
            self.assertEqual(self.rows[tag]['Grid Row'], grid[2:])

    def test_grid_dashes_inside_box_do_not_move_it(self):
        # A dash-dot grid line runs through the box, between the fan and the right edge. Its dashes
        # must not be read as a box edge, and its dots must not be read as part of the fan.
        tag, cx, cy = 'FFU903-ZW05-F01-A', 100.0, 100.0
        grid_x = cx + 3.0
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        draw_ffu(page, tag, cx, cy)
        bubble = page.new_shape()
        bubble.draw_circle((grid_x, 20.0), 8.0)
        bubble.finish(color=BLACK, width=THIN)
        bubble.commit()
        page.insert_text((grid_x - 3.0, 22.0), 'ZW', fontsize=6, color=BLACK)
        dashes = page.new_shape()
        y = 30.0
        while y < 190.0:
            dashes.draw_line((grid_x, y), (grid_x, y + 4.5))
            dashes.draw_line((grid_x, y + 5.5), (grid_x, y + 5.8))
            y += 7.0
        dashes.finish(color=BLACK, width=THIN)
        dashes.commit()
        pdf_path = os.path.join(self._tmp.name, 'grid.pdf')
        doc.save(pdf_path)
        doc.close()
        rows, _ = extract_ffu_layout.extract(pdf_path)
        self.assertEqual(len(rows), 1)
        self.assertAlmostEqual(rows[0]['X'], cx, delta=0.05)
        self.assertAlmostEqual(rows[0]['Y'], cy, delta=0.05)

    def test_missing_pdf_tags_exits_1(self):
        blank_pdf = os.path.join(self._tmp.name, 'blank.pdf')
        doc = fitz.open()
        doc.new_page(width=200, height=200)
        doc.save(blank_pdf)
        doc.close()
        out_csv = os.path.join(self._tmp.name, 'blank.csv')
        result = subprocess.run([sys.executable, SCRIPT, blank_pdf, '-o', out_csv],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)


if __name__ == '__main__':
    unittest.main()
