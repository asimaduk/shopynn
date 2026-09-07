#!/usr/bin/env python3
"""Generate Shopynn business proposal PDF. Run: python3 generate_proposal_pdf.py

Requires: pip install fpdf2 pillow
"""

from __future__ import annotations

import math
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Align
from PIL import Image, ImageDraw, ImageFont

# Brand palette (RGB)
C_PRIMARY = (0, 82, 120)
C_PRIMARY_LIGHT = (0, 118, 148)
C_ACCENT = (0, 168, 132)
C_BG_LIGHT = (245, 248, 250)
C_WHITE = (255, 255, 255)


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
    candidates = []
    if bold:
        candidates.extend(
            [
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/Helvetica.ttc",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "C:\\\\Windows\\\\Fonts\\\\arialbd.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "C:\\\\Windows\\\\Fonts\\\\arial.ttf",
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
    _vertical_gradient(img, (3, 30, 74), (0, 123, 170))
    dr = ImageDraw.Draw(img, "RGBA")

    # Vibrant glow blobs
    for cx, cy, r, a in [
        (w * 0.82, h * 0.18, 230, 70),
        (w * 0.18, h * 0.78, 250, 60),
        (w * 0.62, h * 0.50, 140, 45),
    ]:
        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 210, 255, a))
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        dr = ImageDraw.Draw(img, "RGBA")

    # Dynamic diagonal streaks
    dr.line([(0, int(h * 0.74)), (int(w * 0.58), 0)], fill=(255, 255, 255, 48), width=4)
    dr.line([(int(w * 0.36), h), (w, int(h * 0.20))], fill=(0, 255, 210, 55), width=3)
    dr.line([(int(w * 0.52), h), (w, int(h * 0.42))], fill=(255, 255, 255, 30), width=2)

    # Right-side "dashboard cards" motif
    for i, (x1, y1, x2, y2) in enumerate(
        [
            (1300, 70, 1860, 155),
            (1410, 170, 1920, 245),
            (1250, 258, 1820, 338),
        ]
    ):
        alpha = 95 - i * 14
        dr.rounded_rectangle((x1, y1, x2, y2), radius=18, fill=(255, 255, 255, alpha))
        dr.rounded_rectangle((x1 + 18, y1 + 22, x1 + 210, y1 + 38), radius=7, fill=(0, 134, 182, min(alpha + 20, 120)))
        dr.rounded_rectangle((x1 + 18, y1 + 48, x1 + 280, y1 + 64), radius=7, fill=(0, 173, 138, min(alpha + 25, 130)))

    font_brand = _load_font(64, bold=True)
    font_sub = _load_font(30, bold=True)
    font_tag = _load_font(20, bold=False)

    dr = ImageDraw.Draw(img)
    dr.text((72, 86), "Shopynn", fill=(255, 255, 255), font=font_brand)
    dr.text((72, 172), "Business Proposal", fill=(226, 248, 255), font=font_sub)
    dr.text((72, 232), "Inventory  |  Sales  |  Reports  |  Operations", fill=(196, 231, 244), font=font_tag)

    dr.rectangle([0, h - 10, w, h], fill=(0, 225, 170))
    img.save(path, "PNG", optimize=True)


def make_infographic_bars(path: Path) -> None:
    """Eye-catching KPI + growth visual."""
    w, h = 1600, 520
    img = Image.new("RGB", (w, h))
    _vertical_gradient(img, (250, 252, 255), (235, 246, 252))
    dr = ImageDraw.Draw(img, "RGBA")
    dr.rectangle([0, 0, w, 8], fill=(0, 150, 196, 255))
    title = _load_font(26, bold=True)
    dr.text((40, 26), "Operational visibility at a glance", fill=C_PRIMARY, font=title)

    # KPI cards
    card_font = _load_font(16, bold=False)
    kpi_font = _load_font(28, bold=True)
    cards = [("Stock Accuracy", "98.4%"), ("Order Fulfillment", "2.1x"), ("Reporting Speed", "4x")]
    for i, (label, value) in enumerate(cards):
        x = 40 + i * 510
        dr.rounded_rectangle([x, 78, x + 470, 166], radius=16, fill=(255, 255, 255, 230), outline=(205, 223, 236, 255), width=2)
        dr.text((x + 24, 96), label, fill=(75, 88, 100), font=card_font)
        dr.text((x + 24, 123), value, fill=(0, 112, 155), font=kpi_font)

    # Bars + light grid
    for gy in [230, 285, 340, 395]:
        dr.line([(70, gy), (1530, gy)], fill=(206, 221, 232, 180), width=1)

    bar_x = [140, 430, 720, 1010, 1300]
    heights = [95, 155, 225, 295, 350]
    bw = 130
    labels = ["Stock", "Sales", "Purchase", "Reports", "Insight"]
    colors = [(0, 120, 167), (0, 146, 176), (0, 171, 167), (0, 190, 148), (0, 209, 129)]
    for i, (x, ht) in enumerate(zip(bar_x, heights)):
        y0 = 420 - ht
        dr.rounded_rectangle([x + 5, y0 + 8, x + bw + 5, 428], radius=12, fill=(120, 150, 170, 40))
        dr.rounded_rectangle([x, y0, x + bw, 420], radius=12, fill=colors[i])
        dr.rounded_rectangle([x + 16, y0 + 16, x + bw - 16, y0 + 30], radius=7, fill=(255, 255, 255, 88))
        lbl = _load_font(16, bold=False)
        dr.text((x + 7, 438), labels[i], fill=(58, 67, 76), font=lbl)

    sub = _load_font(18, bold=False)
    dr.text((40, 480), "Unified data replaces spreadsheet silos and gives faster decisions.", fill=(78, 94, 106), font=sub)
    img.convert("RGB").save(path, "PNG", optimize=True)


def make_process_timeline(path: Path) -> None:
    """Modern timeline with cards + connectors."""
    w, h = 1600, 280
    img = Image.new("RGB", (w, h), (247, 251, 253))
    dr = ImageDraw.Draw(img, "RGBA")
    dr.rectangle([0, 0, w, 6], fill=(0, 168, 132, 255))

    steps = [
        "Discovery",
        "Configuration",
        "Pilot",
        "Training",
        "Go-live",
    ]
    n = len(steps)
    gap = w // (n + 1)
    cy = h // 2 - 18
    font = _load_font(18, bold=True)
    font_sm = _load_font(14, bold=False)
    font_lbl = _load_font(15, bold=True)

    for i, label in enumerate(steps):
        cx = gap * (i + 1)
        r = 18
        dr.rounded_rectangle((cx - 92, cy - 8, cx + 92, cy + 86), radius=12, fill=(255, 255, 255, 220), outline=(201, 219, 230, 255), width=2)
        dr.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 121, 170, 255))
        num = str(i + 1)
        nb = dr.textbbox((0, 0), num, font=font_sm)
        dr.text((cx - (nb[2] - nb[0]) // 2, cy - (nb[3] - nb[1]) // 2 - 2), num, fill=C_WHITE, font=font_sm)
        lb = dr.textbbox((0, 0), label, font=font_lbl)
        tw = lb[2] - lb[0]
        dr.text((cx - tw // 2, cy + 26), label, fill=C_PRIMARY, font=font_lbl)

    # connectors
    for i in range(n - 1):
        x1 = gap * (i + 1) + 92
        x2 = gap * (i + 2) - 92
        y_line = cy + 2
        dr.line([(x1, y_line), (x2, y_line)], fill=(158, 180, 196, 255), width=3)
        dr.polygon([(x2, y_line), (x2 - 11, y_line - 7), (x2 - 11, y_line + 7)], fill=(158, 180, 196, 255))

    img.convert("RGB").save(path, "PNG", optimize=True)


def make_pillars(path: Path) -> None:
    """Three vibrant capability cards."""
    w, h = 1600, 340
    img = Image.new("RGB", (w, h))
    _vertical_gradient(img, (245, 250, 254), (230, 242, 250))
    dr = ImageDraw.Draw(img, "RGBA")
    titles = ["Accuracy", "Speed", "Scale"]
    subs = [
        "One source of truth for stock",
        "Faster checkout and purchasing",
        "Grow locations and users safely",
    ]
    box_w = 460
    gap = 60
    x0 = (w - (3 * box_w + 2 * gap)) // 2
    font_t = _load_font(22, bold=True)
    font_s = _load_font(16, bold=False)
    accents = [(0, 128, 176), (0, 160, 168), (0, 188, 145)]
    for i in range(3):
        x = x0 + i * (box_w + gap)
        dr.rounded_rectangle([x + 5, 46, x + box_w + 5, 306], radius=16, fill=(130, 150, 170, 40))
        dr.rounded_rectangle([x, 40, x + box_w, 300], radius=16, fill=C_WHITE, outline=(196, 215, 228), width=2)
        dr.rectangle([x, 40, x + box_w, 52], fill=accents[i])
        dr.ellipse([x + 26, 78, x + 74, 126], fill=accents[i])
        bbox = dr.textbbox((0, 0), titles[i], font=font_t)
        tw = bbox[2] - bbox[0]
        dr.text((x + (box_w - tw) // 2, 78), titles[i], fill=C_PRIMARY, font=font_t)
        # subtitle wrap
        sy = 150
        for line in _wrap_text(subs[i], 34):
            dr.text((x + 36, sy), line, fill=(70, 78, 86), font=font_s)
            sy += 22
    img.convert("RGB").save(path, "PNG", optimize=True)


def _wrap_text(text: str, max_chars: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur: list[str] = []
    for w in words:
        test = " ".join(cur + [w])
        if len(test) <= max_chars:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines or [text]


def ensure_assets(assets_dir: Path) -> dict[str, Path]:
    assets_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "banner": assets_dir / "cover_banner.png",
        "bars": assets_dir / "infographic_bars.png",
        "timeline": assets_dir / "process_timeline.png",
        "pillars": assets_dir / "pillars.png",
    }
    make_cover_banner(paths["banner"])
    make_infographic_bars(paths["bars"])
    make_process_timeline(paths["timeline"])
    make_pillars(paths["pillars"])
    return paths


class ProposalPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(18, 18, 18)
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() <= 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(100, 110, 120)
        self.cell(0, 4, "Shopynn | Inventory and Retail Operations", align="R")
        self.ln(2)
        self.set_draw_color(220, 225, 230)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-16)
        self.set_draw_color(220, 225, 230)
        self.line(self.l_margin, self.get_y() - 2, self.w - self.r_margin, self.get_y() - 2)
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(130, 135, 140)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def add_title(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(28, 32, 36)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 11, text)
    pdf.ln(3)


def add_subtitle(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(85, 90, 95)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 6, text)
    pdf.ln(6)


def section(pdf: FPDF, title: str) -> None:
    y = pdf.get_y()
    pdf.set_fill_color(*C_PRIMARY)
    pdf.rect(pdf.l_margin, y, 3.2, 9, "F")
    pdf.set_xy(pdf.l_margin + 6, y + 0.5)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*C_PRIMARY)
    pdf.cell(0, 8, title)
    pdf.ln(12)


def body(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(42, 44, 48)
    w = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(w, 5.5, text)
    pdf.ln(4)


def bullet_list(pdf: FPDF, items: list[str]) -> None:
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(42, 44, 48)
    w = pdf.w - pdf.l_margin - pdf.r_margin
    for item in items:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(w, 5.5, f"- {item}")
    pdf.ln(3)


def image_centered(pdf: FPDF, path: Path, width_mm: float) -> None:
    """Place image centered; use flowing mode (do not pass y) so fpdf advances the cursor and runs page breaks."""
    pdf.image(str(path), x=Align.C, w=width_mm)
    pdf.ln(5)


def callout_paragraph(pdf: FPDF, text: str) -> None:
    """Light panel with left accent bar (background sized from text length)."""
    y0 = pdf.get_y()
    w = pdf.w - pdf.l_margin - pdf.r_margin
    line_h = 5.5
    approx_chars_per_line = max(32, int((w - 14) / 2.0))
    nlines = max(1, math.ceil(len(text) / approx_chars_per_line))
    box_h = 12 + nlines * line_h + 6

    pdf.set_fill_color(*C_BG_LIGHT)
    pdf.set_draw_color(220, 228, 235)
    pdf.rect(pdf.l_margin, y0, w, box_h, style="DF")
    pdf.set_fill_color(*C_PRIMARY)
    pdf.rect(pdf.l_margin, y0, 2.8, box_h, "F")

    pdf.set_xy(pdf.l_margin + 6, y0 + 4)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(55, 60, 65)
    pdf.multi_cell(w - 10, line_h, text)
    pdf.ln(4)


def main() -> None:
    base = Path(__file__).resolve().parent
    out = base / "CheqStock_Business_Proposal.pdf"
    assets = ensure_assets(base / "assets")

    pdf = ProposalPDF()
    pdf.add_page()

    # Full-bleed cover banner
    pdf.image(str(assets["banner"]), x=0, y=0, w=pdf.w, h=52)
    pdf.set_y(58)

    add_title(pdf, "Proposal overview")
    add_subtitle(
        pdf,
        "Modern inventory, sales, and reporting for growing retailers and distributors\n"
        "Prepared for: [Client / Organization Name]\n"
        "Date: [Insert date]",
    )
    pdf.ln(2)
    callout_paragraph(
        pdf,
        "This document outlines how Shopynn can help your business gain visibility across stock, "
        "sales, purchases, and financial performance - with less manual work and fewer errors.",
    )
    pdf.ln(6)

    pdf.add_page()
    section(pdf, "Executive summary")
    body(
        pdf,
        "Many businesses still rely on spreadsheets or disconnected tools to track inventory and sales. "
        "That approach is error-prone, hard to audit, and does not scale as you add locations, staff, or product lines. "
        "Shopynn is designed as a unified platform: one place to record stock movements, sell at the counter or on the go, "
        "and understand performance with clear dashboards and reports.",
    )
    body(
        pdf,
        "This proposal describes the value proposition, core capabilities, a suggested rollout, and how we can tailor "
        "the solution to your workflows.",
    )
    pdf.ln(2)
    image_centered(pdf, assets["bars"], width_mm=174)
    pdf.ln(4)

    section(pdf, "Challenges we address")
    bullet_list(
        pdf,
        [
            "Stock discrepancies and slow stock-taking across warehouses or stores",
            "Limited visibility into what sells, margins, and cash tied up in inventory",
            "Fragmented processes between purchasing, receiving, and selling",
            "Difficulty enforcing roles and permissions as the team grows",
            "Need for professional receipts/invoices and consistent company branding",
        ],
    )

    pdf.add_page()
    image_centered(pdf, assets["pillars"], width_mm=174)
    pdf.ln(6)

    section(pdf, "What Shopynn offers")
    body(
        pdf,
        "Shopynn brings together inventory management, point-of-sale style selling, purchasing, "
        "and reporting in a single system accessible on web and mobile.",
    )
    bullet_list(
        pdf,
        [
            "Products and categories: rich product records, images, barcodes, and categorization",
            "Multi-warehouse inventory: stock levels, transfers, adjustments, and stock counts",
            "Sales and purchases: record transactions, line items, and link them to inventory",
            "Dashboards and reports: sales summaries, revenue, and operational insight",
            "User roles and permissions: control who can view or operate sensitive areas",
            "Company profile: consistent business details for receipts and customer-facing touchpoints",
            "Subscription-based access: plans that can align with your size and growth",
        ],
    )

    section(pdf, "Why businesses choose a dedicated IMS")
    body(
        pdf,
        "A purpose-built inventory and sales platform reduces duplicate data entry, improves accuracy of stock on hand, "
        "and gives leadership a factual basis for purchasing and pricing decisions. "
        "Staff can be trained on clear workflows instead of maintaining fragile spreadsheet formulas.",
    )

    section(pdf, "Suggested implementation approach")
    pdf.ln(1)
    image_centered(pdf, assets["timeline"], width_mm=174)
    pdf.ln(6)
    bullet_list(
        pdf,
        [
            "Discovery: map your product catalog, locations, and current processes (1-2 sessions)",
            "Configuration: warehouses, users, roles, and initial product/category structure",
            "Pilot: one location or subset of SKUs to validate workflows and reporting",
            "Training: hands-on sessions for daily operators and administrators",
            "Go-live and support: cutover plan, hypercare window, and ongoing enhancements",
        ],
    )

    section(pdf, "Investment & commercial terms")
    body(
        pdf,
        "Pricing depends on subscription tier, number of users/locations, and any custom integrations or data migration. "
        "We will provide a formal quote after a short discovery call. "
        "Packages are available for basic, standard, and premium. The premium package is available for a monthly payment of GHS 800.00. Basic package is available for a monthly payment of GHS 290.00. Standard package is available for a monthly payment of GHS 170.00.",
    )

    section(pdf, "Next steps")
    body(
        pdf,
        "1. Schedule a 30-minute call to confirm fit and priorities.\n"
        "2. Receive a tailored scope and quote.\n"
        "3. Agree timeline and kick off onboarding.\n\n"
        "Contact:  Kingsford Asimadu  |  mail.asimadu@gmail.com  |  +233 24 888 2990",
    )

    pdf.output(str(out))
    print(f"Wrote: {out}")
    print(f"Assets: {assets['banner'].parent}")


if __name__ == "__main__":
    main()
