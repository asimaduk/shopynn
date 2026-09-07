#!/usr/bin/env python3
"""Generate a client-ready tiers comparison PDF.

Run:
  python3 docs/generate_tiers_client_pdf.py

Requires:
  pip install fpdf2 pillow
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Align
from PIL import Image, ImageDraw, ImageFont


# Brand palette (RGB) – modern and neutral
C_PRIMARY = (35, 47, 62)  # deep slate
C_ACCENT = (0, 163, 136)  # teal
C_BG = (246, 248, 251)
C_BORDER = (224, 231, 236)


def _vertical_gradient(img: Image.Image, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    w, h = img.size
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        for x in range(w):
            px[x, y] = (r, g, b)


def _load_font(size: int, bold: bool = False):
    # Keep in sync with other PDF generators in this repo.
    candidates: list[str] = []
    if bold:
        candidates.extend(
            [
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "C:\\Windows\\Fonts\\arialbd.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "C:\\Windows\\Fonts\\arial.ttf",
            ]
        )
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


def make_cover_banner(path: Path) -> None:
    """Simple banner for client docs."""
    w, h = 2000, 420
    img = Image.new("RGB", (w, h))
    _vertical_gradient(img, (18, 62, 86), (0, 163, 136))
    dr = ImageDraw.Draw(img, "RGBA")

    # Subtle diagonal shapes
    dr.polygon([(w * 0.62, 0), (w, 0), (w, h * 0.78)], fill=(255, 255, 255, 38))
    dr.polygon([(w * 0.68, 0), (w, 0), (w, h * 0.62)], fill=(255, 255, 255, 26))

    font_brand = _load_font(58, bold=True)
    font_sub = _load_font(28, bold=True)
    font_tag = _load_font(20, bold=False)

    dr.text((72, 78), "Subscription tiers", fill=(255, 255, 255), font=font_brand)
    dr.text((72, 154), "Basic  |  Standard  |  Premium", fill=(228, 251, 247), font=font_sub)
    dr.text((72, 220), "A quick comparison of what is included in each plan", fill=(210, 244, 238), font=font_tag)

    dr.rectangle([0, h - 10, w, h], fill=(255, 255, 255))
    img.save(path, "PNG", optimize=True)


class ClientPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(16, 16, 16)
        self.set_auto_page_break(auto=True, margin=18)

    def header(self):
        if self.page_no() <= 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(120, 128, 136)
        self.cell(0, 4, "Subscription tiers comparison", align="R")
        self.ln(2)
        self.set_draw_color(*C_BORDER)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-14)
        self.set_draw_color(*C_BORDER)
        self.line(self.l_margin, self.get_y() - 2, self.w - self.r_margin, self.get_y() - 2)
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(140, 148, 156)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def title(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(26, 32, 40)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 9, text)
    pdf.ln(2)


def subtitle(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(92, 100, 108)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 6, text)
    pdf.ln(5)


def section(pdf: FPDF, text: str) -> None:
    y = pdf.get_y()
    pdf.set_fill_color(*C_ACCENT)
    pdf.rect(pdf.l_margin, y, 3.0, 8.5, "F")
    pdf.set_xy(pdf.l_margin + 6, y + 0.4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*C_PRIMARY)
    pdf.cell(0, 8, text)
    pdf.ln(11)


@dataclass(frozen=True)
class Row:
    module: str
    basic: str
    standard: str
    premium: str


def draw_table(pdf: FPDF, rows: list[Row]) -> None:
    w = pdf.w - pdf.l_margin - pdf.r_margin
    col_module = w * 0.46
    col = (w - col_module) / 3
    x0 = pdf.l_margin
    header_fill = (232, 237, 243)
    zebra_a = (255, 255, 255)
    zebra_b = (246, 248, 251)
    row_h = 8.0

    def truncate(text: str, max_w: float) -> str:
        s = str(text or "")
        if pdf.get_string_width(s) <= max_w:
            return s
        ell = "..."
        max_w2 = max(0.0, max_w - pdf.get_string_width(ell))
        out = ""
        for ch in s:
            if pdf.get_string_width(out + ch) > max_w2:
                break
            out += ch
        return out.rstrip() + ell

    def draw_header() -> None:
        y = pdf.get_y()
        pdf.set_draw_color(*C_BORDER)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(40, 46, 54)

        pdf.set_fill_color(*header_fill)
        pdf.set_xy(x0, y)
        pdf.cell(col_module, row_h, "Module", border=1, fill=True)
        pdf.cell(col, row_h, "Basic", border=1, fill=True, align="C")
        pdf.cell(col, row_h, "Standard", border=1, fill=True, align="C")
        pdf.cell(col, row_h, "Premium", border=1, fill=True, align="C")
        pdf.ln(row_h)

    def ensure_space(height: float) -> None:
        if pdf.get_y() + height > pdf.page_break_trigger:
            pdf.add_page()
            draw_header()

    draw_header()

    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(45, 50, 56)
    pdf.set_draw_color(*C_BORDER)

    for i, r in enumerate(rows):
        ensure_space(row_h)
        fill = zebra_a if i % 2 == 0 else zebra_b
        pdf.set_fill_color(*fill)

        y = pdf.get_y()
        pdf.set_xy(x0, y)
        pdf.cell(col_module, row_h, truncate(r.module, col_module - 2), border=1, fill=True)
        pdf.cell(col, row_h, truncate(r.basic, col - 2), border=1, fill=True, align="C")
        pdf.cell(col, row_h, truncate(r.standard, col - 2), border=1, fill=True, align="C")
        pdf.cell(col, row_h, truncate(r.premium, col - 2), border=1, fill=True, align="C")
        pdf.ln(row_h)

    pdf.ln(4)


def bullet_paragraph(pdf: FPDF, heading: str, items: list[str]) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.set_text_color(*C_PRIMARY)
    pdf.multi_cell(0, 6, heading)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(45, 50, 56)
    for it in items:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(0, 5.3, f"- {it}")
    pdf.ln(2)


def main() -> None:
    base = Path(__file__).resolve().parent
    assets = base / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    banner = assets / "tiers_cover_banner.png"
    make_cover_banner(banner)

    out = base / "SUBSCRIPTION_TIERS_FEATURES_CLIENT_v2.pdf"

    pdf = ClientPDF()
    pdf.add_page()
    pdf.image(str(banner), x=0, y=0, w=pdf.w, h=48)
    pdf.set_y(56)

    title(pdf, "Subscription tiers & features")
    subtitle(
        pdf,
        "This document provides a simple comparison of what is included in each plan.\n"
        "Note: Orders / customer ordering is available on Premium only.",
    )

    section(pdf, "Comparison table")
    rows = [
        Row("Dashboard & profile", "Included", "Included", "Included"),
        Row("Inventory & products", "Included", "Included+", "Included"),
        Row("Sales", "Included", "Included+", "Included"),
        Row("Purchases", "Included", "Included", "Included"),
        Row("Purchase orders workflow", "-", "Included", "Included"),
        Row("Customers & suppliers", "Included", "Included", "Included"),
        Row("Multi-store access", "-", "Included", "Included"),
        Row("Transfers", "-", "Included", "Included"),
        Row("Adjustments", "-", "Included", "Included"),
        Row("Reporting", "-", "View only", "View + Export"),
        Row("Admin (users/roles/permissions)", "-", "Included", "Included"),
        Row("Locations", "-", "Included", "Included"),
        Row("Orders / customer ordering", "-", "-", "Included"),
        Row("Stock counts", "-", "-", "Included"),
        Row("Notifications", "-", "-", "Included"),
        Row("Audit logs", "-", "-", "Included"),
        Row("Exports & data export", "-", "-", "Included"),
    ]
    draw_table(pdf, rows)

    section(pdf, "Notes")
    bullet_paragraph(
        pdf,
        "What 'Included+' means",
        [
            "Included+, on Standard, means additional capabilities beyond Basic (e.g., reorder/expiring stock, receipt sharing).",
        ],
    )

    pdf.output(str(out))
    print(f"Wrote: {out}")


if __name__ == "__main__":
    main()

