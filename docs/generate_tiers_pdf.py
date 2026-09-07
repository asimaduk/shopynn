#!/usr/bin/env python3
"""Generate a PDF from SUBSCRIPTION_TIERS_FEATURES.md

Run:
  python3 docs/generate_tiers_pdf.py

Requires:
  pip install fpdf2
"""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF


class TiersPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(18, 18, 18)
        self.set_auto_page_break(auto=True, margin=18)

    def header(self):
        if self.page_no() <= 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(110, 120, 130)
        self.cell(0, 5, "Subscription tiers & features", align="R")
        self.ln(2)
        self.set_draw_color(225, 230, 235)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(140, 150, 160)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def _clean_md_line(line: str) -> str:
    """Minimal markdown cleanup for PDF text rendering."""
    s = line.rstrip("\n")
    # remove bold markers while keeping content
    s = s.replace("**", "")
    # strip blockquote prefix
    if s.lstrip().startswith("> "):
        s = s.lstrip()[2:]
    return s


def main() -> None:
    base = Path(__file__).resolve().parent
    src = base / "SUBSCRIPTION_TIERS_FEATURES.md"
    out = base / "SUBSCRIPTION_TIERS_FEATURES.pdf"

    raw = src.read_text(encoding="utf-8")
    lines = [_clean_md_line(l) for l in raw.splitlines()]

    pdf = TiersPDF()
    pdf.add_page()

    # Cover title
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(28, 32, 36)
    pdf.multi_cell(0, 10, "Subscription tiers & features")
    pdf.ln(1)

    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(85, 92, 100)
    pdf.multi_cell(0, 6, "Client-friendly breakdown of tier features (Basic, Standard, Premium).")
    pdf.ln(6)

    # Body
    for ln in lines:
        if not ln.strip():
            pdf.ln(2)
            continue

        if ln.startswith("# "):
            # already printed title
            continue

        if ln.startswith("## "):
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(28, 32, 36)
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(0, 7, ln.replace("## ", "").strip())
            pdf.ln(1)
            continue

        if ln.startswith("### "):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(28, 32, 36)
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(0, 6, ln.replace("### ", "").strip())
            continue

        is_bullet = ln.lstrip().startswith("- ")
        if is_bullet:
            txt = ln.lstrip()[2:].strip()
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(45, 50, 56)
            pdf.set_x(pdf.l_margin)
            # Use ASCII bullet to stay compatible with core PDF fonts.
            pdf.multi_cell(0, 5.2, f"- {txt}")
            continue

        # Paragraph
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(45, 50, 56)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5.2, ln.strip())

    pdf.output(str(out))
    print(f"Wrote: {out}")


if __name__ == "__main__":
    main()

