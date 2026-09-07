#!/usr/bin/env python3
"""Generate branded PDF for AGENT_PARTNER_PROGRAM.md (Shopynn field agents).

Run:
  python3 docs/generate_agent_partner_pdf.py

Requires:
  pip install fpdf2
"""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

# Shopynn brand (matches cheqstock/src/config/index.js)
PRIMARY = (10, 116, 218)       # #0A74DA
PRIMARY_LIGHT = (107, 201, 247)  # #6BC9F7
PRIMARY_PALE = (232, 244, 255)
ACCENT_GREEN = (98, 178, 112)    # commission highlights
ACCENT_GOLD = (191, 156, 106)
TEXT_DARK = (28, 32, 36)
TEXT_MID = (55, 65, 75)
TEXT_MUTED = (110, 120, 130)
BORDER = (210, 218, 228)
WHITE = (255, 255, 255)


class AgentProgramPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(16, 16, 16)
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() <= 1:
            return
        y = 10
        self.set_fill_color(*PRIMARY)
        self.rect(0, 0, self.w, 3, style="F")
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*PRIMARY)
        self.set_xy(self.l_margin, y)
        self.cell(40, 5, "SHOPYNN")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*TEXT_MUTED)
        self.cell(0, 5, "Independent Sales Agent Program  |  Ghana", align="R")
        self.ln(10)

    def footer(self):
        self.set_y(-16)
        self.set_draw_color(*BORDER)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*TEXT_MUTED)
        self.cell(0, 5, f"Shopynn Agent Program v1.0  -  Page {self.page_no()}", align="C")


def _ascii_safe(text: str) -> str:
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2026", "...")
        .replace("\u2192", "->")
        .replace("\u2264", "<=")
        .replace("\u2265", ">=")
    )


def _clean_md_line(line: str) -> str:
    s = line.rstrip("\n").replace("**", "")
    if s.lstrip().startswith("> "):
        s = s.lstrip()[2:]
    return _ascii_safe(s)


def _is_table_row(line: str) -> bool:
    s = line.strip()
    return s.startswith("|") and s.endswith("|") and "|" in s[1:-1]


def _parse_table_row(line: str) -> list[str]:
    return [p.strip() for p in line.strip().strip("|").split("|")]


def _is_table_separator(line: str) -> bool:
    s = line.strip().replace("|", "").replace("-", "").replace(":", "").strip()
    return not s


def _draw_cover(pdf: AgentProgramPDF, meta_lines: list[str]) -> None:
    pdf.add_page()
    # Top brand band
    pdf.set_fill_color(*PRIMARY)
    pdf.rect(0, 0, pdf.w, 52, style="F")
    pdf.set_fill_color(*PRIMARY_LIGHT)
    pdf.rect(0, 48, pdf.w, 8, style="F")

    pdf.set_xy(16, 14)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 12, "Shopynn")

    pdf.set_xy(16, 28)
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(240, 248, 255)
    pdf.multi_cell(pdf.w - 32, 6, "Independent Sales Agent Program")

    pdf.set_xy(16, 42)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 5, "Ghana")

    pdf.set_y(68)
    # Meta chips row
    chip_y = pdf.get_y()
    chips = [
        ("Version 1.0", PRIMARY_PALE, PRIMARY),
        ("Digital payments to Shopynn", PRIMARY_PALE, PRIMARY),
        ("Commission paid to agents", (238, 252, 244), ACCENT_GREEN),
    ]
    x = pdf.l_margin
    for label, bg, fg in chips:
        pdf.set_font("Helvetica", "B", 8)
        w = pdf.get_string_width(label) + 8
        if x + w > pdf.w - pdf.r_margin:
            x = pdf.l_margin
            chip_y += 9
        pdf.set_fill_color(*bg)
        pdf.set_draw_color(*fg)
        pdf.set_line_width(0.2)
        pdf.rect(x, chip_y, w, 7, style="FD")
        pdf.set_xy(x + 4, chip_y + 1.5)
        pdf.set_text_color(*fg)
        pdf.cell(w - 8, 5, label)
        x += w + 3
    pdf.set_y(chip_y + 14)

    # Commission highlight box
    box_x = pdf.l_margin
    box_w = pdf.w - pdf.l_margin - pdf.r_margin
    box_y = pdf.get_y()
    box_h = 38
    pdf.set_fill_color(*PRIMARY_PALE)
    pdf.set_draw_color(*PRIMARY)
    pdf.set_line_width(0.4)
    pdf.rect(box_x, box_y, box_w, box_h, style="FD")

    pdf.set_xy(box_x + 6, box_y + 5)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*PRIMARY)
    pdf.cell(0, 6, "Your commission at a glance")

    pdf.set_xy(box_x + 6, box_y + 14)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*PRIMARY)
    pdf.cell(45, 10, "15%")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*TEXT_MID)
    pdf.cell(50, 10, "onboarding fee (once)")

    pdf.set_xy(box_x + 6, box_y + 26)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*ACCENT_GREEN)
    pdf.cell(45, 10, "10%")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*TEXT_MID)
    pdf.cell(50, 10, "on first month subscription (once)")

    pdf.set_xy(box_x + box_w - 62, box_y + 14)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*TEXT_MUTED)
    pdf.multi_cell(56, 4, "Example Standard deal:\napprox. GHS 643 total", align="R")

    pdf.set_y(box_y + box_h + 8)

    if meta_lines:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*TEXT_MID)
        for ml in meta_lines:
            if ml.strip() and not ml.startswith("#"):
                pdf.set_x(pdf.l_margin)
                pdf.multi_cell(0, 5, ml.strip())
        pdf.ln(4)


def _section_heading(pdf: AgentProgramPDF, title: str, number: str | None = None) -> None:
    pdf.ln(4)
    y = pdf.get_y()
    if y > 250:
        pdf.add_page()
        y = pdf.get_y()
    # Accent bar
    pdf.set_fill_color(*PRIMARY)
    pdf.rect(pdf.l_margin, y, 3, 8, style="F")
    pdf.set_xy(pdf.l_margin + 6, y)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*PRIMARY)
    label = f"{number}. {title}" if number else title
    pdf.multi_cell(0, 7, label)
    pdf.ln(2)
    pdf.set_draw_color(*PRIMARY_LIGHT)
    pdf.set_line_width(0.5)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(4)


def _sub_heading(pdf: AgentProgramPDF, title: str) -> None:
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*TEXT_DARK)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 5, title)
    pdf.ln(1)


def _bullet(pdf: AgentProgramPDF, text: str, positive: bool = True) -> None:
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*TEXT_MID)
    marker_color = ACCENT_GREEN if positive else (220, 80, 70)
    y = pdf.get_y()
    pdf.set_fill_color(*marker_color)
    pdf.rect(pdf.l_margin + 1, y + 2, 2, 2, style="F")
    pdf.set_x(pdf.l_margin + 6)
    pdf.multi_cell(0, 5.2, text)


def _paragraph(pdf: AgentProgramPDF, text: str) -> None:
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*TEXT_MID)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 5.2, text)


def _render_table(pdf: AgentProgramPDF, rows: list[list[str]], highlight_col0: bool = False) -> None:
    if not rows:
        return
    col_count = max(len(r) for r in rows)
    usable = pdf.w - pdf.l_margin - pdf.r_margin
    col_widths = [usable / col_count] * col_count
    if col_count == 3:
        col_widths = [usable * 0.38, usable * 0.32, usable * 0.30]

    pdf.ln(2)
    row_h_base = 6

    for row_idx, row in enumerate(rows):
        if pdf.get_y() > 265:
            pdf.add_page()

        y0 = pdf.get_y()
        is_header = row_idx == 0
        is_highlight_row = highlight_col0 and row_idx > 0 and row and "Standard" in row[0]

        if is_header:
            pdf.set_fill_color(*PRIMARY)
            pdf.set_text_color(*WHITE)
            pdf.set_font("Helvetica", "B", 9)
        elif is_highlight_row:
            pdf.set_fill_color(*PRIMARY_PALE)
            pdf.set_text_color(*PRIMARY)
            pdf.set_font("Helvetica", "B", 9)
        else:
            pdf.set_fill_color(*(248, 250, 252) if row_idx % 2 == 0 else WHITE)
            pdf.set_text_color(*TEXT_MID)
            pdf.set_font("Helvetica", "", 9)

        x0 = pdf.l_margin
        max_h = row_h_base
        for col_idx in range(col_count):
            cell = row[col_idx] if col_idx < len(row) else ""
            w = col_widths[col_idx] if col_idx < len(col_widths) else usable / col_count
            pdf.set_xy(x0, y0)
            pdf.set_fill_color(
                *(PRIMARY if is_header else (PRIMARY_PALE if is_highlight_row else (248, 250, 252) if row_idx % 2 == 0 else WHITE))
            )
            pdf.rect(x0, y0, w, row_h_base + 2, style="F")
            pdf.set_xy(x0 + 2, y0 + 1.5)
            if is_header:
                pdf.set_text_color(*WHITE)
            elif is_highlight_row:
                pdf.set_text_color(*PRIMARY)
            else:
                pdf.set_text_color(*TEXT_MID)
            pdf.multi_cell(w - 4, 4.5, _ascii_safe(cell))
            h = pdf.get_y() - y0
            max_h = max(max_h, h)
            x0 += w

        pdf.set_y(y0 + max_h + 1)

    pdf.ln(3)


def _signature_block(pdf: AgentProgramPDF) -> None:
    pdf.ln(4)
    if pdf.get_y() > 200:
        pdf.add_page()

    half = (pdf.w - pdf.l_margin - pdf.r_margin - 6) / 2

    for title, x_off in [("Agent", pdf.l_margin), ("Shopynn", pdf.l_margin + half + 6)]:
        y0 = pdf.get_y()
        pdf.set_fill_color(*PRIMARY_PALE)
        pdf.set_draw_color(*PRIMARY)
        pdf.set_line_width(0.3)
        pdf.rect(x_off, y0, half, 52, style="FD")

        pdf.set_xy(x_off + 5, y0 + 5)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*PRIMARY)
        pdf.cell(half - 10, 6, title)

        fields = ["Full name", "Agent code / Representative", "Phone", "MoMo or bank details", "Signature & date"]
        if title == "Shopynn":
            fields = ["Representative name", "Signature", "Date"]

        fy = y0 + 14
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*TEXT_MUTED)
        for f in fields:
            pdf.set_xy(x_off + 5, fy)
            pdf.cell(half - 10, 4, f)
            pdf.set_draw_color(*BORDER)
            pdf.line(x_off + 5, fy + 7, x_off + half - 5, fy + 7)
            fy += 11

    pdf.set_y(y0 + 58)


def main() -> None:
    base = Path(__file__).resolve().parent
    src = base / "AGENT_PARTNER_PROGRAM.md"
    out = base / "AGENT_PARTNER_PROGRAM.pdf"

    raw = src.read_text(encoding="utf-8")
    lines = [_clean_md_line(l) for l in raw.splitlines()]

    # Extract purpose blurb for cover (lines after title until ---)
    meta_lines: list[str] = []
    for ln in lines[1:12]:
        if ln.strip() == "---":
            break
        if ln.strip() and not ln.startswith("#"):
            meta_lines.append(ln)

    pdf = AgentProgramPDF()
    _draw_cover(pdf, meta_lines)

    table_buffer: list[list[str]] = []
    in_signature = False
    section_num = 0

    def flush_table() -> None:
        nonlocal table_buffer
        if table_buffer:
            highlight = any("Standard" in (r[0] if r else "") for r in table_buffer)
            _render_table(pdf, table_buffer, highlight_col0=highlight)
            table_buffer = []

    i = 0
    while i < len(lines):
        ln = lines[i]
        i += 1

        if not ln.strip():
            flush_table()
            pdf.ln(2)
            continue

        if _is_table_row(ln):
            if _is_table_separator(ln):
                continue
            table_buffer.append(_parse_table_row(ln))
            continue

        flush_table()

        if ln.startswith("# "):
            continue

        if ln.startswith("## "):
            title = ln.replace("## ", "").strip()
            # Parse leading number if present
            num = None
            if ". " in title[:4]:
                parts = title.split(". ", 1)
                if parts[0].isdigit():
                    num = parts[0]
                    title = parts[1]
                    section_num = int(num)
            if pdf.get_y() < 70 and pdf.page_no() == 1:
                pdf.add_page()
            _section_heading(pdf, title, num)
            in_signature = "Acceptance" in title or title.strip() == "11. Acceptance"
            continue

        if ln.startswith("### "):
            _sub_heading(pdf, ln.replace("### ", "").strip())
            continue

        if ln.strip() == "---":
            pdf.ln(2)
            pdf.set_draw_color(*PRIMARY_LIGHT)
            pdf.set_line_width(0.6)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(5)
            continue

        if ln.strip().startswith("**Contact:") or ln.strip().startswith("Contact:"):
            pdf.ln(4)
            pdf.set_fill_color(*PRIMARY)
            pdf.rect(pdf.l_margin, pdf.get_y(), pdf.w - pdf.l_margin - pdf.r_margin, 20, style="F")
            pdf.set_xy(pdf.l_margin + 5, pdf.get_y() + 4)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*WHITE)
            pdf.cell(0, 5, "Contact Shopynn")
            pdf.set_xy(pdf.l_margin + 5, pdf.get_y() + 10)
            pdf.set_font("Helvetica", "", 10)
            pdf.cell(0, 5, ln.replace("**", "").strip())
            if i < len(lines) and lines[i].strip():
                pdf.set_xy(pdf.l_margin + 5, pdf.get_y() + 6)
                pdf.cell(0, 5, lines[i].replace("**", "").strip())
                i += 1
            pdf.ln(12)
            continue

        is_bullet = ln.lstrip().startswith("- ")
        if is_bullet:
            txt = ln.lstrip()[2:].strip()
            positive = not txt.lower().startswith(("collect ", "change ", "register duplicate"))
            _bullet(pdf, txt, positive=positive)
            continue

        # Signature tables - render custom block when we hit Agent under section 11
        if in_signature and ln.strip() in ("Agent", "**Agent**"):
            flush_table()
            # skip markdown tables until summary
            while i < len(lines) and not lines[i].startswith("## 13"):
                if lines[i].startswith("**Shopynn**"):
                    i += 1
                    # skip shopynn table
                    while i < len(lines) and not _is_table_row(lines[i]) and lines[i].strip() != "---":
                        i += 1
                    while i < len(lines) and (_is_table_row(lines[i]) or _is_table_separator(lines[i])):
                        i += 1
                    break
                i += 1
            _signature_block(pdf)
            in_signature = False
            continue

        if in_signature and (_is_table_row(ln) or ln.strip() in ("**Agent**", "**Shopynn**")):
            continue

        _paragraph(pdf, ln.strip())

    flush_table()

    pdf.output(str(out))
    print(f"Wrote: {out}")


if __name__ == "__main__":
    main()
