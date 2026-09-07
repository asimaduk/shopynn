#!/usr/bin/env python3
"""Generate YDT Systems quotation PDF.

Run:
  python3 docs/generate_ydt_quotation_pdf.py

Requires:
  pip install fpdf2 pillow
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Align
from PIL import Image, ImageDraw, ImageFont

# Brand palette (RGB) – "quotation" look (different from the existing proposal style)
C_PRIMARY = (35, 47, 62)  # deep slate
C_PRIMARY_LIGHT = (64, 81, 98)
C_ACCENT = (0, 163, 136)  # teal
C_ACCENT_2 = (246, 130, 31)  # orange accent
C_BG_LIGHT = (246, 248, 251)
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


def make_cover_banner_v2(path: Path, brand: str, doc_title: str, tagline: str) -> None:
    """Clean, modern cover (white + geometric accents) to differentiate from the original."""
    w, h = 2000, 520
    img = Image.new("RGB", (w, h), C_WHITE)
    dr = ImageDraw.Draw(img, "RGBA")

    # Top accent bar
    dr.rectangle([0, 0, w, 18], fill=(*C_ACCENT, 255))

    # Geometric shapes on the right
    dr.polygon([(w * 0.70, 0), (w, 0), (w, h * 0.72)], fill=(*C_PRIMARY, 255))
    dr.polygon([(w * 0.78, 0), (w, 0), (w, h * 0.52)], fill=(*C_PRIMARY_LIGHT, 210))
    dr.polygon([(w * 0.62, h), (w, h), (w, h * 0.44)], fill=(*C_ACCENT, 180))

    # Small orange accent "chip"
    dr.rounded_rectangle([72, 70, 250, 108], radius=16, fill=(*C_ACCENT_2, 255))
    chip_font = _load_font(20, bold=True)
    dr.text((92, 79), "QUOTATION", fill=(255, 255, 255), font=chip_font)

    font_brand = _load_font(70, bold=True)
    font_sub = _load_font(34, bold=True)
    font_tag = _load_font(22, bold=False)

    dr.text((72, 130), brand, fill=C_PRIMARY, font=font_brand)
    dr.text((72, 220), doc_title, fill=(50, 60, 72), font=font_sub)
    dr.text((72, 280), tagline, fill=(88, 100, 112), font=font_tag)

    # Bottom divider
    dr.rectangle([0, h - 12, w, h], fill=(*C_BG_LIGHT, 255))
    dr.rectangle([0, h - 12, int(w * 0.24), h], fill=(*C_ACCENT, 255))

    img.save(path, "PNG", optimize=True)


class QuotationPDF(FPDF):
    def __init__(self, header_right: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(18, 18, 18)
        self.set_auto_page_break(auto=True, margin=20)
        self._header_right = header_right

    def header(self):
        if self.page_no() <= 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(100, 110, 120)
        self.cell(0, 4, self._header_right, align="R")
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
    pdf.set_fill_color(*C_ACCENT)
    pdf.rect(pdf.l_margin, y, 3.0, 9, "F")
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


def callout_paragraph(pdf: FPDF, text: str) -> None:
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


@dataclass(frozen=True)
class CostLine:
    label: str
    amount_ghs: int


def money(ghs: int) -> str:
    return f"GHS {ghs:,.0f}"


def add_cost_table(pdf: FPDF, title: str, lines: list[CostLine], subtotal_label: str) -> None:
    section(pdf, title)

    w = pdf.w - pdf.l_margin - pdf.r_margin
    col1 = w * 0.70
    col2 = w - col1

    # Header row
    pdf.set_fill_color(232, 237, 243)
    pdf.set_draw_color(220, 228, 235)
    pdf.set_text_color(50, 55, 60)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_x(pdf.l_margin)
    pdf.cell(col1, 8, "Item", border=1, fill=True)
    pdf.cell(col2, 8, "Amount", border=1, fill=True, align="R")
    pdf.ln()

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(42, 44, 48)
    total = 0
    for i, ln in enumerate(lines):
        total += ln.amount_ghs
        if i % 2 == 0:
            pdf.set_fill_color(252, 253, 255)
        else:
            pdf.set_fill_color(246, 248, 251)
        pdf.set_x(pdf.l_margin)
        pdf.cell(col1, 8, ln.label, border=1, fill=True)
        pdf.cell(col2, 8, money(ln.amount_ghs), border=1, align="R", fill=True)
        pdf.ln()

    # Subtotal row
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(232, 237, 243)
    pdf.set_x(pdf.l_margin)
    pdf.cell(col1, 8, subtotal_label, border=1, fill=True)
    pdf.cell(col2, 8, money(total), border=1, align="R", fill=True)
    pdf.ln(10)


def summary_card(pdf: FPDF, items: list[tuple[str, str]]) -> None:
    """Two-column summary card."""
    y0 = pdf.get_y()
    w = pdf.w - pdf.l_margin - pdf.r_margin
    pad = 6
    row_h = 7.0
    card_h = pad * 2 + row_h * len(items)

    pdf.set_fill_color(246, 248, 251)
    pdf.set_draw_color(220, 228, 235)
    pdf.rect(pdf.l_margin, y0, w, card_h, style="DF")
    pdf.set_fill_color(*C_ACCENT)
    pdf.rect(pdf.l_margin, y0, 2.8, card_h, "F")

    pdf.set_xy(pdf.l_margin + 6, y0 + pad)
    label_w = w * 0.36
    val_w = w - label_w - 6
    for k, v in items:
        pdf.set_x(pdf.l_margin + 6)
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(80, 88, 96)
        pdf.cell(label_w, row_h, k)
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(35, 40, 46)
        pdf.multi_cell(val_w, row_h, v)
    pdf.ln(4)


def main() -> None:
    base = Path(__file__).resolve().parent
    assets_dir = base / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    banner_path = assets_dir / "ydt_cover_banner_v2.png"
    make_cover_banner_v2(
        banner_path,
        brand="YDT Systems",
        doc_title="Project Quotation (Cost Build-up)",
        tagline="Web  |  Mobile  |  APIs/Services  |  Payments (MoMo & Card)",
    )

    out = base / "YDT_Quotation_Miss_Mercy_Osei-Bimpong_GHS15000_v2.pdf"

    client = "Miss Mercy Osei-Bimpong"
    total = 15000
    # Use ASCII punctuation to stay compatible with built-in PDF core fonts (Helvetica).
    build_timeline = "2-3 weeks from kickoff"
    included_hosting_support = "12 months"

    build_lines = [
        CostLine("Discovery + solution design", 900),
        CostLine("Web app build/config", 2400),
        CostLine("Mobile app build/config", 2400),
        CostLine("Backend APIs / services", 2700),
        CostLine("Payments integration (MoMo + Card) + reconciliation hooks", 1800),
        CostLine("QA, UAT support, bug-fix window", 500),
        CostLine("Go-live, training, handover", 300),
    ]
    hosting_lines = [
        CostLine(f"Hosting (cloud, monitoring, backups) - {included_hosting_support}", 2600),
        CostLine(f"Support & maintenance - {included_hosting_support}", 1400),
    ]

    pdf = QuotationPDF(header_right="YDT Systems | Project Quotation")
    pdf.add_page()

    # Cover banner
    pdf.image(str(banner_path), x=0, y=0, w=pdf.w, h=62)
    pdf.set_y(70)

    add_title(pdf, "Quotation summary")
    add_subtitle(pdf, "A full web + mobile platform with backend services and payments.")

    summary_card(
        pdf,
        [
            ("Prepared by", "YDT Systems"),
            ("Prepared for", client),
            ("Date", "07 May 2026"),
            ("Delivery timeline", build_timeline),
            ("Hosting & support included", included_hosting_support),
            ("Total (one-time)", money(total)),
            ("Contact", "0248882990 | mail.asimadu@gmail.com"),
        ],
    )

    callout_paragraph(
        pdf,
        "Scope includes Web, Mobile, and APIs/Services, all core features, and payments (MoMo + Card). "
        "Pricing is a one-time fee and includes 12 months hosting and support after go-live.",
    )

    pdf.add_page()
    section(pdf, "1) Overview")
    body(
        pdf,
        "This engagement delivers a complete platform across Web, Mobile, and Backend APIs/Services, "
        "with all core features included. Payment acceptance is enabled via Mobile Money (MoMo) and "
        "Card payments, with basic reconciliation hooks for operational reporting.",
    )
    section(pdf, "2) Delivery timeline")
    bullet_list(
        pdf,
        [
            f"Implementation duration: {build_timeline}",
            "Timeline assumes timely client feedback and access to required accounts/resources (payment provider, hosting, etc.).",
        ],
    )

    add_cost_table(pdf, "3) Cost build-up - A) Delivery (Build)", build_lines, "Subtotal (Delivery)")
    add_cost_table(pdf, "3) Cost build-up - B) Hosting + support (Included)", hosting_lines, "Subtotal (Hosting + Support)")

    section(pdf, "Grand total")
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(28, 32, 36)
    pdf.set_x(pdf.l_margin)
    pdf.cell(0, 10, f"Grand total (one-time fee): {money(total)}")
    pdf.ln(10)

    section(pdf, "4) Inclusions")
    bullet_list(
        pdf,
        [
            "Web application delivery",
            "Mobile application delivery",
            "Backend APIs/services",
            "Payment integration: MoMo and Card",
            "Deployment to production environment",
            "Basic training & handover",
            f"{included_hosting_support} hosting (with backups + basic monitoring)",
            f"{included_hosting_support} support & maintenance (bug fixes and minor adjustments)",
        ],
    )

    section(pdf, "5) Exclusions / third-party costs (client-handled)")
    bullet_list(
        pdf,
        [
            "Payment provider charges (MoMo fees, card processing fees, gateway fees)",
            "SMS/Email/OTP charges (if applicable)",
            "Domain purchase/renewals (if applicable)",
            "Major new features beyond agreed scope",
        ],
    )

    section(pdf, "6) Payment terms (example)")
    bullet_list(pdf, ["60% upfront to commence work", "40% on go-live / handover"])

    section(pdf, "7) Acceptance")
    body(
        pdf,
        "If accepted, please confirm via email and we will share the kickoff checklist and payment details.\n\n"
        "Signed (Client): ____________________   Date: ____________\n"
        "Signed (Vendor): ____________________  Date: ____________\n\n"
        "YDT Systems | 0248882990 | mail.asimadu@gmail.com",
    )

    pdf.output(str(out))
    print(f"Wrote: {out}")


if __name__ == "__main__":
    main()

