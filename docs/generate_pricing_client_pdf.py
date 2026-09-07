#!/usr/bin/env python3
"""Generate a client-ready pricing PDF.

Run:
  python3 docs/generate_pricing_client_pdf.py

Requires:
  pip install fpdf2 pillow
"""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF
from fpdf.enums import MethodReturnValue, XPos, YPos
from PIL import Image, ImageDraw, ImageFont


# Palette (match tiers client PDF style)
C_PRIMARY = (35, 47, 62)  # deep slate
C_ACCENT = (0, 163, 136)  # teal
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
    w, h = 2000, 420
    img = Image.new("RGB", (w, h))
    _vertical_gradient(img, (18, 62, 86), (0, 163, 136))
    dr = ImageDraw.Draw(img, "RGBA")

    dr.polygon([(w * 0.62, 0), (w, 0), (w, h * 0.78)], fill=(255, 255, 255, 38))
    dr.polygon([(w * 0.68, 0), (w, 0), (w, h * 0.62)], fill=(255, 255, 255, 26))

    font_brand = _load_font(58, bold=True)
    font_sub = _load_font(26, bold=True)
    font_tag = _load_font(20, bold=False)

    dr.text((72, 78), "Pricing & packages", fill=(255, 255, 255), font=font_brand)
    dr.text((72, 154), "Basic  |  Standard  |  Premium", fill=(228, 251, 247), font=font_sub)
    dr.text((72, 220), "Ghana (hosting included, WhatsApp support)", fill=(210, 244, 238), font=font_tag)

    dr.rectangle([0, h - 10, w, h], fill=(255, 255, 255))
    img.save(path, "PNG", optimize=True)


class PricingPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(16, 16, 16)
        self.set_auto_page_break(auto=True, margin=18)

    def header(self):
        if self.page_no() <= 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(120, 128, 136)
        self.cell(0, 4, "Pricing & packages", align="R")
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


def section(pdf: FPDF, text: str) -> None:
    y = pdf.get_y()
    pdf.set_fill_color(*C_ACCENT)
    pdf.rect(pdf.l_margin, y, 3.0, 8.5, "F")
    pdf.set_xy(pdf.l_margin + 6, y + 0.4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*C_PRIMARY)
    pdf.cell(0, 8, text)
    pdf.ln(11)


def pricing_table(pdf: FPDF) -> None:
    w = pdf.w - pdf.l_margin - pdf.r_margin
    # Plan names are short; Limits / Best for need more width than a single-line cell().
    col_plan = w * 0.22
    col_price = w * 0.18
    col_limits = w * 0.32
    col_bestfor = w - (col_plan + col_price + col_limits)

    row_h_header = 9.0
    line_h_wrap = 4.25
    header_fill = (232, 237, 243)
    zebra_a = (255, 255, 255)
    zebra_b = (246, 248, 251)

    # Header
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(40, 46, 54)
    pdf.set_fill_color(*header_fill)
    pdf.set_draw_color(*C_BORDER)
    pdf.cell(col_plan, row_h_header, "Plan", border=1, fill=True)
    pdf.cell(col_price, row_h_header, "Price (monthly)", border=1, fill=True, align="C")
    pdf.cell(col_limits, row_h_header, "Limits", border=1, fill=True)
    pdf.cell(col_bestfor, row_h_header, "Best for", border=1, fill=True)
    pdf.ln(row_h_header)

    rows = [
        ("Basic", "GHS 229", "1 branch, up to 3 users", "Single store core operations"),
        ("Standard", "GHS 429", "Up to 5 branches, up to 12 users", "Multi-branch + controls/workflows"),
        ("Premium", "GHS 799", "Up to 10 branches, up to 25 users", "Full platform + customer ordering"),
    ]

    def wrapped_lines(txt: str, col_w: float) -> list[str]:
        return pdf.multi_cell(
            col_w,
            line_h_wrap,
            txt,
            dry_run=True,
            output=MethodReturnValue.LINES,
        )

    for i, (plan, price, limits, bestfor) in enumerate(rows):
        fill = zebra_a if i % 2 == 0 else zebra_b
        pdf.set_font("Helvetica", "", 9.0)
        lim_lines = wrapped_lines(limits, col_limits)
        bf_lines = wrapped_lines(bestfor, col_bestfor)
        row_h = max(
            9.0,
            len(lim_lines) * line_h_wrap + 3.5,
            len(bf_lines) * line_h_wrap + 3.5,
        )

        x0 = pdf.l_margin
        y0 = pdf.get_y()
        pdf.set_draw_color(*C_BORDER)
        pdf.set_fill_color(*fill)
        pdf.set_text_color(45, 50, 56)

        pdf.set_xy(x0, y0)
        pdf.set_font("Helvetica", "B", 10 if plan == "Premium" else 9.5)
        pdf.cell(col_plan, row_h, plan, border=1, fill=True)

        pdf.set_xy(x0 + col_plan, y0)
        pdf.set_font("Helvetica", "B" if plan == "Premium" else "", 9.5)
        pdf.cell(col_price, row_h, price, border=1, fill=True, align="C")

        x_lim = x0 + col_plan + col_price
        x_bf = x_lim + col_limits

        pdf.set_font("Helvetica", "", 9.0)
        pdf.set_fill_color(*fill)
        if len(lim_lines) <= 1:
            pdf.set_xy(x_lim, y0)
            pdf.cell(col_limits, row_h, limits, border=1, fill=True)
        else:
            pdf.set_xy(x_lim, y0)
            pdf.multi_cell(
                col_limits,
                line_h_wrap,
                limits,
                border=1,
                fill=True,
                new_x=XPos.RIGHT,
                new_y=YPos.TOP,
            )

        if len(bf_lines) <= 1:
            pdf.set_xy(x_bf, y0)
            pdf.cell(col_bestfor, row_h, bestfor, border=1, fill=True)
        else:
            pdf.set_xy(x_bf, y0)
            pdf.multi_cell(
                col_bestfor,
                line_h_wrap,
                bestfor,
                border=1,
                fill=True,
                new_x=XPos.RIGHT,
                new_y=YPos.TOP,
            )

        pdf.set_y(y0 + row_h)

    pdf.ln(6)


def bullet_list(pdf: FPDF, items: list[str]) -> None:
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
    banner = assets / "pricing_cover_banner.png"
    make_cover_banner(banner)

    out = base / "PRICING_PACKAGES_CLIENT.pdf"

    pdf = PricingPDF()
    pdf.add_page()
    pdf.image(str(banner), x=0, y=0, w=pdf.w, h=48)
    pdf.set_y(56)

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(26, 32, 40)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 9, "Pricing & packages")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(92, 100, 108)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 6, "Premium product pricing for the Ghanaian market (hosting included).")
    pdf.ln(5)

    section(pdf, "Monthly subscription")
    pricing_table(pdf)

    section(pdf, "What's included (high level)")
    bullet_list(
        pdf,
        [
            "Hosting included in the subscription",
            "WhatsApp support (business-hours on Basic/Standard; priority on Premium)",
            "Premium includes Orders / customer ordering (Premium-only module)",
        ],
    )

    section(pdf, "One-time onboarding")
    bullet_list(
        pdf,
        [
            "Onboarding/setup/training + go-live support: GHS 2,500 - 6,000",
            "Data migration (optional): priced based on volume and source format",
        ],
    )

    section(pdf, "Optional discounts")
    bullet_list(
        pdf,
        [
            "Annual (12-month) commitments can be discounted",
            "Branch/user caps can be adjusted for enterprise customers",
        ],
    )

    pdf.output(str(out))
    print(f"Wrote: {out}")


if __name__ == "__main__":
    main()

