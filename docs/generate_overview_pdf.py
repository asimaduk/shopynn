#!/usr/bin/env python3
"""Render docs/SHOPYNN_OVERVIEW.md as a shareable PDF.

Run:
  python3 docs/generate_overview_pdf.py

Requires:
  pip install fpdf2

Handles only the Markdown used in the overview: headings, paragraphs,
bullet and numbered lists, **bold**, links, and one pipe table.
"""

from __future__ import annotations

import re
from pathlib import Path

from fpdf import FPDF

DOCS = Path(__file__).resolve().parent
SRC = DOCS / "SHOPYNN_OVERVIEW.md"
OUT = DOCS / "Shopynn-Overview.pdf"
LOGO = DOCS.parent / "apps" / "site" / "public" / "logo" / "shopynn-logo.png"

C_BRAND = (31, 111, 235)
C_TEXT = (33, 37, 41)
C_MUTED = (108, 117, 125)
C_BORDER = (222, 226, 230)
C_HEAD_BG = (232, 240, 254)

FONT_CANDIDATES = {
    "": ["/System/Library/Fonts/Supplemental/Arial.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
    "B": ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
}


def _first_existing(paths: list[str]) -> str | None:
    return next((p for p in paths if Path(p).exists()), None)


def _inline(text: str) -> str:
    return re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)


class OverviewPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Body", "", 8)
        self.set_text_color(*C_MUTED)
        self.cell(0, 6, "Shopynn overview", align="L")
        self.ln(8)

    def footer(self):
        self.set_y(-12)
        self.set_font("Body", "", 8)
        self.set_text_color(*C_MUTED)
        self.cell(0, 6, f"shopynn.app  ·  hello@shopynn.app  ·  Page {self.page_no()}", align="C")


def build() -> Path:
    pdf = OverviewPDF(format="A4")
    pdf.set_margins(18, 16, 18)
    pdf.set_auto_page_break(auto=True, margin=18)

    regular = _first_existing(FONT_CANDIDATES[""])
    bold = _first_existing(FONT_CANDIDATES["B"]) or regular
    pdf.add_font("Body", "", regular)
    pdf.add_font("Body", "B", bold)
    pdf.add_page()

    lines = SRC.read_text(encoding="utf-8").splitlines()
    i = 0
    width = pdf.w - pdf.l_margin - pdf.r_margin

    def para(text: str, size: float = 10.5, color=C_TEXT, indent: float = 0, bullet: str | None = None):
        pdf.set_font("Body", "", size)
        pdf.set_text_color(*color)
        pdf.set_x(pdf.l_margin + indent)
        if bullet:
            pdf.cell(5, 5.4, bullet)
        pdf.multi_cell(width - indent - (5 if bullet else 0), 5.4, _inline(text), markdown=True,
                       new_x="LMARGIN", new_y="NEXT")

    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            pdf.ln(1.5)
        elif line.startswith("# "):
            if LOGO.exists():
                pdf.image(str(LOGO), x=pdf.l_margin, y=pdf.get_y(), h=12)
                pdf.ln(15)
            pdf.set_font("Body", "B", 20)
            pdf.set_text_color(*C_BRAND)
            pdf.multi_cell(width, 9, line[2:], new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
        elif line.startswith("## "):
            if pdf.get_y() > pdf.h - 45:
                pdf.add_page()
            pdf.ln(3)
            pdf.set_font("Body", "B", 14)
            pdf.set_text_color(*C_BRAND)
            pdf.cell(0, 8, line[3:], new_x="LMARGIN", new_y="NEXT")
            pdf.set_draw_color(*C_BORDER)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(2)
        elif line.startswith("### "):
            if pdf.get_y() > pdf.h - 35:
                pdf.add_page()
            pdf.ln(1.5)
            pdf.set_font("Body", "B", 11.5)
            pdf.set_text_color(*C_TEXT)
            pdf.cell(0, 6.5, line[4:], new_x="LMARGIN", new_y="NEXT")
        elif line.startswith("- "):
            para(line[2:], indent=2, bullet="•")
        elif re.match(r"^\d+\. ", line):
            num, rest = line.split(" ", 1)
            para(rest, indent=2, bullet=num)
            pdf.ln(0.8)
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"-+", c) for c in cells if c):
                    rows.append(cells)
                i += 1
            i -= 1
            first_w = width * 0.43
            other_w = (width - first_w) / (len(rows[0]) - 1)
            pdf.set_draw_color(*C_BORDER)
            if pdf.get_y() + 7 * len(rows) > pdf.h - pdf.b_margin:
                pdf.add_page()
            for r, cells in enumerate(rows):
                header = r == 0
                pdf.set_font("Body", "B" if header else "", 9.5)
                pdf.set_fill_color(*C_HEAD_BG)
                for c, cell in enumerate(cells):
                    w = first_w if c == 0 else other_w
                    pdf.set_text_color(*(C_BRAND if cell == "Yes" else C_TEXT))
                    pdf.cell(w, 7, _inline(cell), border=1, fill=header, align="L" if c == 0 else "C")
                pdf.ln(7)
            pdf.ln(2)
        else:
            para(line)
        i += 1

    pdf.output(str(OUT))
    return OUT


if __name__ == "__main__":
    print(build())
