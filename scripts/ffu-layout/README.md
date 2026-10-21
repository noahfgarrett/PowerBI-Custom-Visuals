# FFU layout script

Turns a Bluebeam vector FFU map PDF into the layout CSV that the QCx FFU Map visual reads.

```bash
python3 scripts/ffu-layout/extract_ffu_layout.py "<pdf>" -o <csv>
```

Run against your own copy of the drawing; never commit the PDF or its CSV. Write the CSV
outside the repo.

The script needs PyMuPDF:

```bash
python3 -m pip install pymupdf
```

It prints a stats report (tags found, duplicate tags, lines traced, FFUs on no line, lines
without a home run or finish). It exits 1 if the PDF has no FFU tags and 2 if PyMuPDF is
missing.

CSV columns: `FFU Tag, X, Y, Line, Line Order, Line Colour, Home Run, Finish, Grid Column, Grid Row`.
X and Y are the box centre in PDF points (origin top-left, y down).

Tests build synthetic PDFs at test time:

```bash
python3 -m unittest scripts/ffu-layout/test_extract_ffu_layout.py -v
```
